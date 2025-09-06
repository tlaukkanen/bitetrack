namespace BiteTrack.Api.Endpoints;

using BiteTrack.Api.Contracts;
using BiteTrack.Api.Services;
using BiteTrack.Api.Security;
using BiteTrack.Api.Processing;
using BiteTrack.Api.Utils;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

public static class MealsEndpoints
{
    public static IEndpointRouteBuilder MapMealsEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/meals").RequireAuthorization();

        group.MapPost("/", async (HttpRequest httpRequest, MealService meals, System.Security.Claims.ClaimsPrincipal user, IPhotoStorage photoStorage, IMealAnalysisQueue queue) =>
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
        });

        group.MapGet("/", async (MealService meals, System.Security.Claims.ClaimsPrincipal user, DateOnly? date) =>
        {
            var userId = user.GetUserId();
            if (userId == Guid.Empty) return Results.Unauthorized();
            var list = await meals.GetMealsAsync(userId, date ?? DateOnly.FromDateTime(DateTime.UtcNow));
            return Results.Ok(list.Select(MealDto.FromEntity));
        });

        group.MapGet("/{id:guid}", async (MealService meals, System.Security.Claims.ClaimsPrincipal user, Guid id) =>
        {
            var userId = user.GetUserId();
            if (userId == Guid.Empty) return Results.Unauthorized();
            var meal = await meals.GetMealAsync(userId, id);
            return meal is null ? Results.NotFound() : Results.Ok(MealDto.FromEntity(meal));
        });

        group.MapPost("/{id:guid}/retry", async (MealService meals, System.Security.Claims.ClaimsPrincipal user, Guid id, IMealAnalysisQueue queue) =>
        {
            var userId = user.GetUserId();
            if (userId == Guid.Empty) return Results.Unauthorized();
            var meal = await meals.GetMealAsync(userId, id);
            if (meal is null) return Results.NotFound();
            meal.Status = BiteTrack.Api.Domain.MealStatus.Processing;
            meal.ErrorMessage = null;
            meal.UpdatedAtUtc = DateTime.UtcNow;
            await meals.SaveChangesAsync();
            await queue.EnqueueAsync(new MealAnalysisRequest(meal.Id));
            return Results.Ok(MealDto.FromEntity(meal));
        });

        group.MapPut("/{id:guid}", async (MealService meals, System.Security.Claims.ClaimsPrincipal user, Guid id, UpdateMealRequest req) =>
        {
            var userId = user.GetUserId();
            if (userId == Guid.Empty) return Results.Unauthorized();
            var meal = await meals.GetMealAsync(userId, id);
            if (meal is null) return Results.NotFound();
            meal.Description = req.Description?.Trim();
            meal.Calories = req.Calories;
            meal.Protein = req.Protein;
            meal.Carbs = req.Carbs;
            meal.Fat = req.Fat;
            if (req.CreatedAtUtc.HasValue)
            {
                var newUtc = DateTime.SpecifyKind(req.CreatedAtUtc.Value, DateTimeKind.Utc);
                if (newUtc > DateTime.UtcNow.AddMinutes(5)) newUtc = DateTime.UtcNow;
                meal.CreatedAtUtc = newUtc;
            }
            meal.UpdatedAtUtc = DateTime.UtcNow;
            await meals.SaveChangesAsync();
            return Results.Ok(MealDto.FromEntity(meal));
        });

        group.MapGet("/{id:guid}/image", async (MealService meals, System.Security.Claims.ClaimsPrincipal user, IPhotoStorage storage, Guid id, bool? thumb) =>
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
        });

        return app;
    }
}
