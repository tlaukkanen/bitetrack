namespace BiteTrack.Api.Endpoints;

using BiteTrack.Api.Contracts;
using BiteTrack.Api.Services;
using BiteTrack.Api.Security;
using BiteTrack.Api.Processing;
using BiteTrack.Api.Utils;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Processing;

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
            if (file is null)
            {
                if (string.IsNullOrWhiteSpace(description))
                {
                    return Results.BadRequest("Provide either a photo or a description");
                }
                var meal = await meals.CreateMealFromDescriptionAsync(userId, description, queue, createdAtUtc);
                return Results.Ok(MealDto.FromEntity(meal));
            }
            else
            {
                var meal = await meals.CreateMealAsync(userId, file, photoStorage, queue, createdAtUtc);
                if (!string.IsNullOrWhiteSpace(description))
                {
                    meal.Description = description.Trim();
                    meal.UpdatedAtUtc = DateTime.UtcNow;
                    await meals.SaveChangesAsync();
                }
                return Results.Ok(MealDto.FromEntity(meal));
            }
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
                var incoming = req.CreatedAtUtc.Value;
                DateTime newUtc = incoming.Kind switch
                {
                    DateTimeKind.Utc => incoming,
                    DateTimeKind.Local => incoming.ToUniversalTime(),
                    _ => DateTime.SpecifyKind(incoming, DateTimeKind.Utc) // assume already UTC if unspecified
                };
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

        group.MapPost("/{id:guid}/image/rotate", async (MealService meals, System.Security.Claims.ClaimsPrincipal user, IPhotoStorage storage, Guid id, string? direction, int? degrees) =>
        {
            var userId = user.GetUserId();
            if (userId == Guid.Empty) return Results.Unauthorized();
            var meal = await meals.GetMealAsync(userId, id);
            if (meal is null) return Results.NotFound();
            if (string.IsNullOrWhiteSpace(meal.PhotoPath)) return Results.BadRequest("No photo to rotate");

            var full = storage.ResolvePath(meal.PhotoPath);
            if (!System.IO.File.Exists(full)) return Results.NotFound();

            int deg = Math.Abs(degrees ?? 90) % 360;
            if (deg % 90 != 0) return Results.BadRequest("degrees must be a multiple of 90");
            bool ccw = string.Equals(direction, "left", StringComparison.OrdinalIgnoreCase) || string.Equals(direction, "ccw", StringComparison.OrdinalIgnoreCase);
            deg = ccw ? (360 - deg) % 360 : deg;

            using (var image = await Image.LoadAsync(full))
            {
                image.Metadata.ExifProfile = null;
                switch (deg)
                {
                    case 90: image.Mutate(x => x.Rotate(RotateMode.Rotate90)); break;
                    case 180: image.Mutate(x => x.Rotate(RotateMode.Rotate180)); break;
                    case 270: image.Mutate(x => x.Rotate(RotateMode.Rotate270)); break;
                    default: break;
                }

                await using var ms = new MemoryStream();
                var ext = System.IO.Path.GetExtension(full).ToLowerInvariant();
                if (ext == ".png") await image.SaveAsPngAsync(ms);
                else if (ext == ".webp") await image.SaveAsWebpAsync(ms);
                else await image.SaveAsJpegAsync(ms);
                ms.Position = 0;
                var contentType = ContentTypeHelper.GetContentType(full);
                if (!string.IsNullOrWhiteSpace(meal.ThumbnailPath))
                {
                    await storage.DeleteAsync(meal.ThumbnailPath);
                }
                await storage.DeleteAsync(meal.PhotoPath);
                var saved = await storage.SaveAsync(meal.PhotoPath, ms, contentType);
                meal.PhotoPath = saved.PhotoPath;
                meal.ThumbnailPath = saved.ThumbnailPath;
                meal.UpdatedAtUtc = DateTime.UtcNow;
                await meals.SaveChangesAsync();
            }

            return Results.Ok(MealDto.FromEntity(meal));
        });

        group.MapDelete("/{id:guid}", async (MealService meals, System.Security.Claims.ClaimsPrincipal user, IPhotoStorage storage, Guid id) =>
        {
            var userId = user.GetUserId();
            if (userId == Guid.Empty) return Results.Unauthorized();
            var ok = await meals.DeleteMealAsync(userId, id, storage);
            return ok ? Results.NoContent() : Results.NotFound();
        });

        group.MapPost("/{id:guid}/duplicate", async (MealService meals, System.Security.Claims.ClaimsPrincipal user, IPhotoStorage storage, Guid id, DateTime? createdAtUtc) =>
        {
            var userId = user.GetUserId();
            if (userId == Guid.Empty) return Results.Unauthorized();
            // If client provides a future timestamp more than 5 minutes ahead, clamp to now
            if (createdAtUtc.HasValue && createdAtUtc.Value > DateTime.UtcNow.AddMinutes(5))
            {
                createdAtUtc = DateTime.UtcNow;
            }
            var clone = await meals.DuplicateMealAsync(userId, id, storage, createdAtUtc);
            return clone is null ? Results.NotFound() : Results.Ok(MealDto.FromEntity(clone));
        });

        return app;
    }
}
