using System.Linq;
using System.Security.Cryptography;
using System.Text;
using BiteTrack.Api.Data;
using BiteTrack.Api.Endpoints;
using BiteTrack.Api.Processing;
using BiteTrack.Api.Security;
using BiteTrack.Api.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

// Config
var config = builder.Configuration;
var services = builder.Services;

services.AddDbContext<AppDbContext>(opts =>
{
    // Prefer full connection string via DB_CONNECTION or ConnectionStrings:Default
    var conn = config.GetConnectionString("Default") ?? config["DB_CONNECTION"];
    if (string.IsNullOrWhiteSpace(conn))
    {
        // Fallback dev default (local SQL Server container)
        var host = config.GetValue<string>("DB_HOST") ?? "sqlserver"; // docker-compose service name
        var db = config.GetValue<string>("DB_NAME") ?? "BiteTrack";
        var user = config.GetValue<string>("DB_USER") ?? "sa";
        var pwd = config.GetValue<string>("DB_PASSWORD") ?? "Your_strong_password123"; // override in env
        conn = $"Server={host};Database={db};User Id={user};Password={pwd};TrustServerCertificate=True;Encrypt=False;";
    }
    opts.UseSqlServer(conn);
});

services.AddScoped<AuthService>();
services.AddScoped<MealService>();
services.AddScoped<AiSuggestionService>();
if (!string.IsNullOrWhiteSpace(config["PHOTOS_STORAGE_ACCOUNT_KEY"]))
{
    Console.WriteLine("[Photos] Using Azure Blob Storage for photo storage.");
    services.AddSingleton<IPhotoStorage, AzureBlobPhotoStorage>();
}
else
{
    Console.WriteLine("[Photos] Using local file system for photo storage.");
    services.AddSingleton<IPhotoStorage, LocalPhotoStorage>();
}
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
services.AddHttpClient();
services.AddCors(o =>
{
    o.AddPolicy("dev", p => p.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod());
});
services.AddHttpContextAccessor();

var app = builder.Build();

// Apply migrations / dev ensure-created fallback
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    try
    {
        var allMigrations = db.Database.GetMigrations().ToList();
        var appliedMigrations = db.Database.GetAppliedMigrations().ToList();
        var pending = db.Database.GetPendingMigrations().ToList();
        Console.WriteLine($"[DB] Available migrations: {(allMigrations.Count == 0 ? "(none)" : string.Join(", ", allMigrations))}");
        Console.WriteLine($"[DB] Applied migrations: {(appliedMigrations.Count == 0 ? "(none)" : string.Join(", ", appliedMigrations))}");
        Console.WriteLine($"[DB] Pending migrations: {(pending.Count == 0 ? "(none)" : string.Join(", ", pending))}");

        if (pending.Count > 0)
        {
            Console.WriteLine($"[DB] Applying {pending.Count} pending migration(s): {string.Join(", ", pending)}");
            db.Database.Migrate();
            Console.WriteLine("[DB] Migrations applied successfully.");
        }
        else if (allMigrations.Count == 0)
        {
            if (app.Environment.IsDevelopment())
            {
                Console.WriteLine("[DB][WARN] No migrations found in assembly. Using EnsureCreated() as dev fallback. Rebuild image to include migrations.");
                if (db.Database.EnsureCreated())
                    Console.WriteLine("[DB] EnsureCreated created schema (dev fallback).");
                else
                    Console.WriteLine("[DB] EnsureCreated found existing schema (dev fallback).");
            }
            else
            {
                Console.WriteLine("[DB][ERROR] No migrations found in assembly in non-development environment.");
            }
        }
        else
        {
            Console.WriteLine("[DB] Database already up to date (no pending migrations).");
        }
    }
    catch (Exception ex)
    {
        Console.WriteLine("[DB][ERROR] Failed to apply migrations on startup: " + ex.Message);
        throw;
    }
}

// Static files (React build output). Place BEFORE auth so index.html is served anonymously.
app.UseDefaultFiles();
app.UseStaticFiles();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("dev");
app.UseAuthentication();
app.UseAuthorization();

// Endpoint modules
app.MapAuthEndpoints();
app.MapMealsEndpoints();
app.MapProfileEndpoints();
app.MapSuggestionsEndpoints();
app.MapHealthEndpoints();
app.MapDevEndpoints(); // only maps in Development

// SPA fallback: for any non-API route, serve index.html (supports client-side routing)
app.MapFallback(() => Results.File(Path.Combine(AppContext.BaseDirectory, "wwwroot", "index.html"), "text/html"));

app.Run();
