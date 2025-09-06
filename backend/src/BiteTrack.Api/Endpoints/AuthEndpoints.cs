namespace BiteTrack.Api.Endpoints;

using BiteTrack.Api.Contracts;
using BiteTrack.Api.Services;
using Microsoft.AspNetCore.Routing;

public static class AuthEndpoints
{
    public static IEndpointRouteBuilder MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/auth");

        group.MapPost("/register", async (AuthService auth, RegisterRequest req, IConfiguration cfg) =>
        {
            var inviteCode = cfg["INVITE_CODE"];
            if (!string.IsNullOrWhiteSpace(inviteCode))
            {
                if (string.IsNullOrWhiteSpace(req.InvitationCode) || !string.Equals(req.InvitationCode.Trim(), inviteCode.Trim(), StringComparison.Ordinal))
                {
                    return Results.BadRequest(new { error = "Invalid invitation code" });
                }
            }
            try
            {
                var token = await auth.RegisterAsync(req.Email, req.Password, req.DisplayName);
                return Results.Ok(new { token });
            }
            catch (InvalidOperationException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });

        group.MapPost("/login", async (AuthService auth, LoginRequest req) =>
        {
            var token = await auth.LoginAsync(req.Email, req.Password);
            return token is null ? Results.Unauthorized() : Results.Ok(new { token });
        });

        return app;
    }
}
