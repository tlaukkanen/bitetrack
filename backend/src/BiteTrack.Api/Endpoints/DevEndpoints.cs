namespace BiteTrack.Api.Endpoints;

using BiteTrack.Api.Contracts;
using BiteTrack.Api.Data;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;

public static class DevEndpoints
{
    public static WebApplication MapDevEndpoints(this WebApplication app)
    {
        if (!app.Environment.IsDevelopment()) return app;

        var group = app.MapGroup("/api/dev").WithTags("Dev");

        group.MapGet("/users", async (AppDbContext db) =>
        {
            var list = await db.Users
                .OrderBy(u => u.Email)
                .Select(u => new DevUserDto(
                    u.Id,
                    u.Email,
                    u.DisplayName,
                    u.Meals.Count(),
                    u.Meals.Max(m => (DateTime?)DateTime.SpecifyKind(m.CreatedAtUtc, DateTimeKind.Utc))
                ))
                .ToListAsync();
            return Results.Ok(list);
        }).WithDescription("List users (dev only)");

        group.MapGet("/users/{id:guid}", async (AppDbContext db, Guid id) =>
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
                        .Select(m => new DevMealDto(m.Id, DateTime.SpecifyKind(m.CreatedAtUtc, DateTimeKind.Utc), m.Status.ToString(), m.Calories, m.Protein, m.Carbs, m.Fat))
                        .ToList()
                ))
                .FirstOrDefaultAsync();
            return user is null ? Results.NotFound() : Results.Ok(user);
        }).WithDescription("Get user detail (dev only)");

        return app;
    }
}
