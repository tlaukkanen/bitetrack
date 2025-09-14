namespace BiteTrack.Api.Endpoints;

using BiteTrack.Api.Contracts;
using BiteTrack.Api.Data;
using BiteTrack.Api.Security;
using BiteTrack.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;

public static class ProfileEndpoints
{
    public static IEndpointRouteBuilder MapProfileEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/profile").RequireAuthorization();

        group.MapGet("/daily-summary", async (MealService meals, System.Security.Claims.ClaimsPrincipal user, DateOnly? date) =>
        {
            var userId = user.GetUserId();
            if (userId == Guid.Empty) return Results.Unauthorized();
            var summary = await meals.GetDailySummaryAsync(userId, date ?? DateOnly.FromDateTime(DateTime.UtcNow));
            return Results.Ok(summary);
        });

        group.MapGet("/goal", async (AppDbContext db, System.Security.Claims.ClaimsPrincipal user) =>
        {
            var userId = user.GetUserId();
            if (userId == Guid.Empty) return Results.Unauthorized();
            var goal = await db.UserGoals.FirstOrDefaultAsync(g => g.UserId == userId);
            if (goal is null) return Results.Ok(new { calories = 0, protein = 0f, carbs = 0f, fat = 0f, waterMl = 0 });
            return Results.Ok(new { calories = goal.Calories, protein = goal.Protein, carbs = goal.Carbs, fat = goal.Fat, waterMl = goal.WaterMl });
        });

        group.MapPut("/goal", async (AppDbContext db, System.Security.Claims.ClaimsPrincipal user, GoalRequest req) =>
        {
            var userId = user.GetUserId();
            if (userId == Guid.Empty) return Results.Unauthorized();
            var goal = await db.UserGoals.FirstOrDefaultAsync(g => g.UserId == userId);
            if (goal is null)
            {
                goal = new BiteTrack.Api.Domain.UserGoal { UserId = userId, Calories = req.Calories, Protein = req.Protein, Carbs = req.Carbs, Fat = req.Fat, WaterMl = req.WaterMl };
                db.UserGoals.Add(goal);
            }
            else
            {
                goal.Calories = req.Calories;
                goal.Protein = req.Protein;
                goal.Carbs = req.Carbs;
                goal.Fat = req.Fat;
                goal.WaterMl = req.WaterMl;
                goal.UpdatedAtUtc = DateTime.UtcNow;
            }
            await db.SaveChangesAsync();
            return Results.Ok(new { calories = goal.Calories, protein = goal.Protein, carbs = goal.Carbs, fat = goal.Fat, waterMl = goal.WaterMl });
        });

        // Settings endpoints (default glass size, preferred unit)
        group.MapGet("/settings", async (AppDbContext db, System.Security.Claims.ClaimsPrincipal user) =>
        {
            var userId = user.GetUserId();
            if (userId == Guid.Empty) return Results.Unauthorized();
            var s = await db.UserSettings.FirstOrDefaultAsync(x => x.UserId == userId);
            return Results.Ok(new { defaultGlassMl = s?.DefaultGlassMl, preferredUnit = s?.PreferredUnit });
        });

        group.MapPut("/settings", async (AppDbContext db, System.Security.Claims.ClaimsPrincipal user, [FromBody] SettingsRequest req) =>
        {
            var userId = user.GetUserId();
            if (userId == Guid.Empty) return Results.Unauthorized();
            var s = await db.UserSettings.FirstOrDefaultAsync(x => x.UserId == userId);
            if (s is null)
            {
                s = new BiteTrack.Api.Domain.UserSettings { UserId = userId, DefaultGlassMl = req.DefaultGlassMl, PreferredUnit = req.PreferredUnit };
                db.UserSettings.Add(s);
            }
            else
            {
                s.DefaultGlassMl = req.DefaultGlassMl;
                s.PreferredUnit = req.PreferredUnit;
                s.UpdatedAtUtc = DateTime.UtcNow;
            }
            await db.SaveChangesAsync();
            return Results.Ok(new { defaultGlassMl = s.DefaultGlassMl, preferredUnit = s.PreferredUnit });
        });

        return app;
    }

    public record SettingsRequest(int? DefaultGlassMl, string? PreferredUnit);
}
