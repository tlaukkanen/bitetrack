using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Azure;
using Azure.AI.OpenAI;
using BiteTrack.Data;
using BiteTrack.Domain;
using BiteTrack.Processing;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

// Config
var config = builder.Configuration;
var services = builder.Services;

services.AddDbContext<AppDbContext>(opts =>
{
    var dbPath = config.GetValue<string>("DB_PATH") ?? Path.Combine(AppContext.BaseDirectory, "bitetrack.db");
    opts.UseSqlite($"Data Source={dbPath}");
});

services.AddScoped<AuthService>();
services.AddScoped<MealService>();
services.AddSingleton<IPhotoStorage, LocalPhotoStorage>();
services.AddSingleton<IMealAnalysisQueue, InMemoryMealAnalysisQueue>();
services.AddHostedService<MealAnalysisBackgroundService>();
services.AddScoped<IAiMealAnalyzer, AzureOpenAiMealAnalyzer>();

var jwtSecret = builder.Configuration.GetValue<string>("JWT_SECRET") ?? "dev-secret-change";
if (jwtSecret.Length < 32)
{
    var bytes = RandomNumberGenerator.GetBytes(48);
    jwtSecret = Convert.ToBase64String(bytes);
    Console.WriteLine("[WARN] Provided JWT_SECRET too short. Generated ephemeral dev secret.");
}
// Expose a unified secret instance for both token validation and creation
services.AddSingleton(new JwtSecret(jwtSecret));
var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret));
services.AddAuthentication(o =>
{
    o.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    o.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
}).AddJwtBearer(o =>
{
    o.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = false,
        ValidateAudience = false,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = key
    };
});

services.AddAuthorization();
services.AddEndpointsApiExplorer();
services.AddSwaggerGen();
services.AddCors(o =>
{
    o.AddPolicy("dev", p => p.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod());
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();
}

// Static files (React build output). Place BEFORE auth so index.html is served anonymously.
app.UseDefaultFiles();
app.UseStaticFiles();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();

    // Development-only debug endpoints
    app.MapGet("/api/dev/users", async (AppDbContext db) =>
    {
        // Order before projecting to record to avoid translation issue with OrderBy(new DevUserDto(...).Email)
        var list = await db.Users
            .OrderBy(u => u.Email)
            .Select(u => new DevUserDto(
                u.Id,
                u.Email,
                u.DisplayName,
                u.Meals.Count(),
                // Use Max (returns null if no meals) which translates well in EF Core
                u.Meals.Max(m => (DateTime?)m.CreatedAtUtc)
            ))
            .ToListAsync();
        return Results.Ok(list);
    }).WithTags("Dev").WithDescription("List users (dev only)");

    app.MapGet("/api/dev/users/{id:guid}", async (AppDbContext db, Guid id) =>
    {
        var user = await db.Users
            .Where(u => u.Id == id)
            .Select(u => new DevUserDetailDto(
                u.Id,
                u.Email,
                u.DisplayName,
                u.Meals
                    .OrderByDescending(m => m.CreatedAtUtc)
                    .Take(20)
                    .Select(m => new DevMealDto(m.Id, m.CreatedAtUtc, m.Status.ToString(), m.Calories, m.Protein, m.Carbs, m.Fat))
                    .ToList()
            ))
            .FirstOrDefaultAsync();
        return user is null ? Results.NotFound() : Results.Ok(user);
    }).WithTags("Dev").WithDescription("Get user detail (dev only)");
}

app.UseCors("dev");
app.UseAuthentication();
app.UseAuthorization();

// Auth endpoints
app.MapPost("/api/auth/register", async (AuthService auth, RegisterRequest req) =>
{
    var token = await auth.RegisterAsync(req.Email, req.Password, req.DisplayName);
    return Results.Ok(new { token });
});

app.MapPost("/api/auth/login", async (AuthService auth, LoginRequest req) =>
{
    var token = await auth.LoginAsync(req.Email, req.Password);
    return token is null ? Results.Unauthorized() : Results.Ok(new { token });
});

// Meal endpoints
app.MapPost("/api/meals", async (HttpRequest httpRequest, MealService meals, ClaimsPrincipal user, IPhotoStorage photoStorage, IMealAnalysisQueue queue) =>
{
    var userId = user.GetUserId();
    if (userId == Guid.Empty) return Results.Unauthorized();
    if (!httpRequest.HasFormContentType) return Results.BadRequest("Multipart form expected");
    var form = await httpRequest.ReadFormAsync();
    var file = form.Files.GetFile("photo");
    if (file == null) return Results.BadRequest("Missing photo file");
    DateTime? createdAtUtc = null;
    var createdAtRaw = form["createdAt"].FirstOrDefault();
    if (!string.IsNullOrWhiteSpace(createdAtRaw))
    {
        if (DateTime.TryParse(createdAtRaw, null, System.Globalization.DateTimeStyles.AdjustToUniversal | System.Globalization.DateTimeStyles.AssumeUniversal, out var parsed))
        {
            // Prevent future timestamps beyond a small tolerance
            if (parsed > DateTime.UtcNow.AddMinutes(5)) parsed = DateTime.UtcNow;
            createdAtUtc = parsed;
        }
    }
    var description = form["description"].FirstOrDefault();
    var meal = await meals.CreateMealAsync(userId, file, photoStorage, queue, createdAtUtc);
    if (!string.IsNullOrWhiteSpace(description))
    {
        meal.Description = description.Trim();
        meal.UpdatedAtUtc = DateTime.UtcNow;
        await meals.SaveChangesAsync();
    }
    return Results.Ok(MealDto.FromEntity(meal));
}).RequireAuthorization();

app.MapGet("/api/meals", async (MealService meals, ClaimsPrincipal user, DateOnly? date) =>
{
    var userId = user.GetUserId();
    if (userId == Guid.Empty) return Results.Unauthorized();
    var list = await meals.GetMealsAsync(userId, date ?? DateOnly.FromDateTime(DateTime.UtcNow));
    return Results.Ok(list.Select(MealDto.FromEntity));
}).RequireAuthorization();

app.MapGet("/api/meals/{id:guid}", async (MealService meals, ClaimsPrincipal user, Guid id) =>
{
    var userId = user.GetUserId();
    if (userId == Guid.Empty) return Results.Unauthorized();
    var meal = await meals.GetMealAsync(userId, id);
    return meal is null ? Results.NotFound() : Results.Ok(MealDto.FromEntity(meal));
}).RequireAuthorization();

// Update meal (description & macro overrides)
app.MapPut("/api/meals/{id:guid}", async (MealService meals, ClaimsPrincipal user, Guid id, UpdateMealRequest req) =>
{
    var userId = user.GetUserId();
    if (userId == Guid.Empty) return Results.Unauthorized();
    var meal = await meals.GetMealAsync(userId, id);
    if (meal is null) return Results.NotFound();
    // Apply changes if provided
    meal.Description = req.Description?.Trim();
    meal.Calories = req.Calories;
    meal.Protein = req.Protein;
    meal.Carbs = req.Carbs;
    meal.Fat = req.Fat;
    if (req.CreatedAtUtc.HasValue)
    {
        var newUtc = DateTime.SpecifyKind(req.CreatedAtUtc.Value, DateTimeKind.Utc);
        // Clamp future times (5 min tolerance)
        if (newUtc > DateTime.UtcNow.AddMinutes(5)) newUtc = DateTime.UtcNow;
        meal.CreatedAtUtc = newUtc;
    }
    meal.UpdatedAtUtc = DateTime.UtcNow;
    await meals.SaveChangesAsync();
    return Results.Ok(MealDto.FromEntity(meal));
}).RequireAuthorization();

// Image (photo / thumbnail) endpoint
app.MapGet("/api/meals/{id:guid}/image", async (MealService meals, ClaimsPrincipal user, IPhotoStorage storage, Guid id, bool? thumb) =>
{
    var userId = user.GetUserId();
    if (userId == Guid.Empty) return Results.Unauthorized();
    var meal = await meals.GetMealAsync(userId, id);
    if (meal is null) return Results.NotFound();
    var relative = thumb == true ? meal.ThumbnailPath : meal.PhotoPath;
    if (string.IsNullOrWhiteSpace(relative)) return Results.NotFound();
    var full = storage.ResolvePath(relative);
    if (!System.IO.File.Exists(full)) return Results.NotFound();
    var contentType = ContentTypeHelper.GetContentType(full);
    return Results.File(full, contentType);
}).RequireAuthorization();

app.MapGet("/api/profile/daily-summary", async (MealService meals, ClaimsPrincipal user, DateOnly? date) =>
{
    var userId = user.GetUserId();
    if (userId == Guid.Empty) return Results.Unauthorized();
    var summary = await meals.GetDailySummaryAsync(userId, date ?? DateOnly.FromDateTime(DateTime.UtcNow));
    return Results.Ok(summary);
}).RequireAuthorization();

// Goal endpoints
app.MapGet("/api/profile/goal", async (AppDbContext db, ClaimsPrincipal user) =>
{
    var userId = user.GetUserId();
    if (userId == Guid.Empty) return Results.Unauthorized();
    var goal = await db.UserGoals.FirstOrDefaultAsync(g => g.UserId == userId);
    if (goal is null) return Results.Ok(new { calories = 0, protein = 0f, carbs = 0f, fat = 0f });
    return Results.Ok(new { calories = goal.Calories, protein = goal.Protein, carbs = goal.Carbs, fat = goal.Fat });
}).RequireAuthorization();

app.MapPut("/api/profile/goal", async (AppDbContext db, ClaimsPrincipal user, GoalRequest req) =>
{
    var userId = user.GetUserId();
    if (userId == Guid.Empty) return Results.Unauthorized();
    var goal = await db.UserGoals.FirstOrDefaultAsync(g => g.UserId == userId);
    if (goal is null)
    {
        goal = new UserGoal { UserId = userId, Calories = req.Calories, Protein = req.Protein, Carbs = req.Carbs, Fat = req.Fat };
        db.UserGoals.Add(goal);
    }
    else
    {
        goal.Calories = req.Calories;
        goal.Protein = req.Protein;
        goal.Carbs = req.Carbs;
        goal.Fat = req.Fat;
        goal.UpdatedAtUtc = DateTime.UtcNow;
    }
    await db.SaveChangesAsync();
    return Results.Ok(new { calories = goal.Calories, protein = goal.Protein, carbs = goal.Carbs, fat = goal.Fat });
}).RequireAuthorization();

// SPA fallback: for any non-API route, serve index.html (supports client-side routing)
app.MapFallback(() => Results.File(Path.Combine(AppContext.BaseDirectory, "wwwroot", "index.html"), "text/html"));

app.Run();

// DTOs & helper types
record RegisterRequest(string Email, string Password, string DisplayName);
record LoginRequest(string Email, string Password);

record MealDto(Guid Id, DateTime CreatedAtUtc, string Status, string PhotoPath, string? ThumbnailPath, string? Description, int? Calories, float? Protein, float? Carbs, float? Fat, IEnumerable<MealItemDto> Items, string? ErrorMessage)
{
    public static MealDto FromEntity(Meal m) => new(
    m.Id, m.CreatedAtUtc, m.Status.ToString(), m.PhotoPath, m.ThumbnailPath, m.Description, m.Calories, m.Protein, m.Carbs, m.Fat,
    m.Items.Select(i => new MealItemDto(i.Id, i.Name, i.Grams, i.Calories, i.Protein, i.Carbs, i.Fat, i.Confidence)), m.ErrorMessage);
}
record UpdateMealRequest(string? Description, int? Calories, float? Protein, float? Carbs, float? Fat, DateTime? CreatedAtUtc);

record MealItemDto(Guid Id, string Name, float? Grams, int? Calories, float? Protein, float? Carbs, float? Fat, float? Confidence);
record GoalRequest(int Calories, float Protein, float Carbs, float Fat);

// Dev DTOs (development only endpoints)
record DevUserDto(Guid Id, string Email, string DisplayName, int MealCount, DateTime? LastMealAtUtc);
record DevUserDetailDto(Guid Id, string Email, string DisplayName, List<DevMealDto> RecentMeals);
record DevMealDto(Guid Id, DateTime CreatedAtUtc, string Status, int? Calories, float? Protein, float? Carbs, float? Fat);

static class PrincipalExtensions
{
    public static Guid GetUserId(this ClaimsPrincipal principal)
    {
        var id = principal.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(id, out var g) ? g : Guid.Empty;
    }
}

record JwtSecret(string Value);

class AuthService
{
    private readonly AppDbContext _db;
    private readonly JwtSecret _jwt;
    public AuthService(AppDbContext db, JwtSecret jwt) { _db = db; _jwt = jwt; }

    public async Task<string> RegisterAsync(string email, string password, string displayName)
    {
        if (await _db.Users.AnyAsync(u => u.Email == email)) throw new InvalidOperationException("Email already registered");
        var hash = BCrypt.Net.BCrypt.HashPassword(password);
        var user = new User { Email = email, DisplayName = displayName, PasswordHash = hash };
        _db.Users.Add(user);
        await _db.SaveChangesAsync();
        return GenerateJwt(user);
    }

    public async Task<string?> LoginAsync(string email, string password)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == email);
        if (user == null) return null;
        if (!BCrypt.Net.BCrypt.Verify(password, user.PasswordHash)) return null;
        return GenerateJwt(user);
    }

    private string GenerateJwt(User user)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwt.Value));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(
            claims: new[] {
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(ClaimTypes.Email, user.Email),
                new Claim(ClaimTypes.Name, user.DisplayName)
            },
            expires: DateTime.UtcNow.AddDays(7),
            signingCredentials: creds);
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}

class MealService
{
    private readonly AppDbContext _db;
    public MealService(AppDbContext db) { _db = db; }

    public async Task<Meal> CreateMealAsync(Guid userId, IFormFile photo, IPhotoStorage storage, IMealAnalysisQueue queue, DateTime? createdAtUtc = null)
    {
        var fileName = $"{Guid.NewGuid()}{Path.GetExtension(photo.FileName)}";
        var saved = await storage.SaveAsync(fileName, photo.OpenReadStream(), photo.ContentType);
        var meal = new Meal { UserId = userId, PhotoPath = saved.PhotoPath, ThumbnailPath = saved.ThumbnailPath, Status = MealStatus.Processing };
        if (createdAtUtc.HasValue)
        {
            meal.CreatedAtUtc = createdAtUtc.Value;
            meal.UpdatedAtUtc = createdAtUtc.Value;
        }
        _db.Meals.Add(meal);
        await _db.SaveChangesAsync();
        await queue.EnqueueAsync(new MealAnalysisRequest(meal.Id));
        return meal;
    }

    public async Task<List<Meal>> GetMealsAsync(Guid userId, DateOnly date)
    {
        var start = date.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var end = start.AddDays(1);
        return await _db.Meals.Include(m => m.Items)
            .Where(m => m.UserId == userId && m.CreatedAtUtc >= start && m.CreatedAtUtc < end)
            .OrderByDescending(m => m.CreatedAtUtc)
            .ToListAsync();
    }

    public async Task<Meal?> GetMealAsync(Guid userId, Guid id) => await _db.Meals.Include(m => m.Items).FirstOrDefaultAsync(m => m.Id == id && m.UserId == userId);

    public async Task<DailySummary> GetDailySummaryAsync(Guid userId, DateOnly date)
    {
        var meals = await GetMealsAsync(userId, date);
        var calories = meals.Sum(m => m.Calories ?? 0);
        float protein = meals.Sum(m => m.Protein ?? 0);
        float carbs = meals.Sum(m => m.Carbs ?? 0);
        float fat = meals.Sum(m => m.Fat ?? 0);
        return new DailySummary(date, calories, protein, carbs, fat);
    }

    public Task<int> SaveChangesAsync() => _db.SaveChangesAsync();
}

static class ContentTypeHelper
{
    public static string GetContentType(string path)
    {
        var ext = Path.GetExtension(path).ToLowerInvariant();
        return ext switch
        {
            ".jpg" or ".jpeg" => "image/jpeg",
            ".png" => "image/png",
            ".gif" => "image/gif",
            ".webp" => "image/webp",
            _ => "application/octet-stream"
        };
    }
}
