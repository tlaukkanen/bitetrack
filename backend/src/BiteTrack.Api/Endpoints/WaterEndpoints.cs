namespace BiteTrack.Api.Endpoints;

using BiteTrack.Api.Data;
using BiteTrack.Api.Security;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;

public static class WaterEndpoints
{
    public static IEndpointRouteBuilder MapWaterEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/water").RequireAuthorization();

        group.MapGet("/", async (AppDbContext db, System.Security.Claims.ClaimsPrincipal user, DateOnly? date) =>
        {
            var userId = user.GetUserId();
            if (userId == Guid.Empty) return Results.Unauthorized();
            var day = date ?? DateOnly.FromDateTime(DateTime.UtcNow);
            var start = day.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
            var end = start.AddDays(1);
            var list = await db.WaterIntakes
                .Where(w => w.UserId == userId && w.CreatedAtUtc >= start && w.CreatedAtUtc < end)
                .OrderByDescending(w => w.CreatedAtUtc)
                .Select(w => new { id = w.Id, createdAtUtc = w.CreatedAtUtc, amountMl = w.AmountMl, unit = w.Unit })
                .ToListAsync();
            return Results.Ok(list);
        });

        group.MapPost("/", async (AppDbContext db, System.Security.Claims.ClaimsPrincipal user, [FromBody] WaterRequest req) =>
        {
            var userId = user.GetUserId();
            if (userId == Guid.Empty) return Results.Unauthorized();
            DateTime when;
            if (req.CreatedAtUtc.HasValue)
            {
                var incoming = req.CreatedAtUtc.Value;
                when = incoming.Kind switch
                {
                    DateTimeKind.Utc => incoming,
                    DateTimeKind.Local => incoming.ToUniversalTime(),
                    _ => DateTime.SpecifyKind(incoming, DateTimeKind.Utc) // assume already UTC if unspecified
                };
                if (when > DateTime.UtcNow.AddMinutes(5)) when = DateTime.UtcNow;
            }
            else
            {
                when = DateTime.UtcNow;
            }
            if (req.AmountMl <= 0) return Results.BadRequest("amountMl must be > 0");
            var entity = new BiteTrack.Api.Domain.WaterIntake
            {
                UserId = userId,
                CreatedAtUtc = when,
                AmountMl = req.AmountMl,
                Unit = string.IsNullOrWhiteSpace(req.Unit) ? "ml" : req.Unit!.Trim()
            };
            db.WaterIntakes.Add(entity);
            await db.SaveChangesAsync();
            return Results.Ok(new { id = entity.Id, createdAtUtc = entity.CreatedAtUtc, amountMl = entity.AmountMl, unit = entity.Unit });
        });

        group.MapDelete("/{id:guid}", async (AppDbContext db, System.Security.Claims.ClaimsPrincipal user, Guid id) =>
        {
            var userId = user.GetUserId();
            if (userId == Guid.Empty) return Results.Unauthorized();
            var it = await db.WaterIntakes.FirstOrDefaultAsync(w => w.Id == id && w.UserId == userId);
            if (it is null) return Results.NotFound();
            db.WaterIntakes.Remove(it);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        group.MapGet("/{id:guid}", async (AppDbContext db, System.Security.Claims.ClaimsPrincipal user, Guid id) =>
        {
            var userId = user.GetUserId();
            if (userId == Guid.Empty) return Results.Unauthorized();
            var it = await db.WaterIntakes.AsNoTracking().FirstOrDefaultAsync(w => w.Id == id && w.UserId == userId);
            if (it is null) return Results.NotFound();
            return Results.Ok(new { id = it.Id, createdAtUtc = it.CreatedAtUtc, amountMl = it.AmountMl, unit = it.Unit });
        });

        group.MapPut("/{id:guid}", async (AppDbContext db, System.Security.Claims.ClaimsPrincipal user, Guid id, [FromBody] UpdateWaterRequest req) =>
        {
            var userId = user.GetUserId();
            if (userId == Guid.Empty) return Results.Unauthorized();
            var it = await db.WaterIntakes.FirstOrDefaultAsync(w => w.Id == id && w.UserId == userId);
            if (it is null) return Results.NotFound();
            if (req.AmountMl.HasValue && req.AmountMl.Value > 0) it.AmountMl = req.AmountMl.Value;
            if (req.CreatedAtUtc.HasValue)
            {
                var incoming = req.CreatedAtUtc.Value;
                DateTime newUtc = incoming.Kind switch
                {
                    DateTimeKind.Utc => incoming,
                    DateTimeKind.Local => incoming.ToUniversalTime(),
                    _ => DateTime.SpecifyKind(incoming, DateTimeKind.Utc)
                };
                if (newUtc > DateTime.UtcNow.AddMinutes(5)) newUtc = DateTime.UtcNow;
                it.CreatedAtUtc = newUtc;
            }
            if (req.Unit is not null) it.Unit = string.IsNullOrWhiteSpace(req.Unit) ? null : req.Unit.Trim();
            await db.SaveChangesAsync();
            return Results.Ok(new { id = it.Id, createdAtUtc = it.CreatedAtUtc, amountMl = it.AmountMl, unit = it.Unit });
        });

        return app;
    }

    public record WaterRequest(int AmountMl, DateTime? CreatedAtUtc, string? Unit);
    public record UpdateWaterRequest(int? AmountMl, DateTime? CreatedAtUtc, string? Unit);
}
