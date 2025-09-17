namespace BiteTrack.Api.Endpoints;

using BiteTrack.Api.Security;
using BiteTrack.Api.Services;
using Microsoft.AspNetCore.Routing;

public static class SuggestionsEndpoints
{
    public record SuggestionRequest(string GoalKey, string? TimeframeKey);

    public static IEndpointRouteBuilder MapSuggestionsEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/suggestions").RequireAuthorization();

        group.MapPost("/", async (AiSuggestionService svc, System.Security.Claims.ClaimsPrincipal user, SuggestionRequest req) =>
        {
            var userId = user.GetUserId();
            if (userId == Guid.Empty) return Results.Unauthorized();
            if (req is null || string.IsNullOrWhiteSpace(req.GoalKey)) return Results.BadRequest("Missing goal key");
            var text = await svc.GenerateSuggestionsAsync(userId, req.GoalKey, timeframeKey: req.TimeframeKey);
            return Results.Ok(new { content = text });
        });

        return app;
    }
}
