namespace BiteTrack.Api.Endpoints;

using BiteTrack.Api.Contracts;
using BiteTrack.Api.Services;
using Microsoft.AspNetCore.Routing;

public static class AuthEndpoints
{
    public static IEndpointRouteBuilder MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/auth");

        group.MapPost("/register", async (AuthService auth, RegisterRequest req, IConfiguration cfg, HttpResponse http, IHostEnvironment env) =>
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
                var access = await auth.RegisterAsync(req.Email, req.Password, req.DisplayName);
                // Generate refresh token and set as HttpOnly cookie
                var handler = new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler();
                var jwt = handler.ReadJwtToken(access);
                var userId = jwt.Claims.First(c => c.Type == System.Security.Claims.ClaimTypes.NameIdentifier).Value;
                var refresh = auth.GenerateRefreshToken(new Domain.User { Id = Guid.Parse(userId) });
                http.Cookies.Append("refreshToken", refresh, new CookieOptions
                {
                    HttpOnly = true,
                    Secure = env.IsDevelopment() ? false : true,
                    SameSite = SameSiteMode.Strict,
                    Expires = DateTimeOffset.UtcNow.AddDays(30)
                });
                return Results.Ok(new { token = access });
            }
            catch (InvalidOperationException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });

        group.MapPost("/login", async (AuthService auth, LoginRequest req, HttpResponse http) =>
        {
            var access = await auth.LoginAsync(req.Email, req.Password);
            if (access is null) return Results.Unauthorized();
            var handler = new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler();
            var jwt = handler.ReadJwtToken(access);
            var userId = jwt.Claims.First(c => c.Type == System.Security.Claims.ClaimTypes.NameIdentifier).Value;
            var refresh = auth.GenerateRefreshToken(new Domain.User { Id = Guid.Parse(userId) });
            http.Cookies.Append("refreshToken", refresh, new CookieOptions
            {
                HttpOnly = true,
                Secure = http.HttpContext?.Request.IsHttps ?? false ? true : false,
                SameSite = SameSiteMode.Strict,
                Expires = DateTimeOffset.UtcNow.AddDays(30)
            });
            return Results.Ok(new { token = access });
        });

        group.MapPost("/refresh", async (AuthService auth, HttpRequest http) =>
        {
            if (!http.Cookies.TryGetValue("refreshToken", out var refreshToken) || string.IsNullOrWhiteSpace(refreshToken))
            {
                return Results.Unauthorized();
            }
            var userId = auth.ValidateRefreshToken(refreshToken);
            if (userId is null) return Results.Unauthorized();
            var access = await auth.GenerateAccessTokenForUserId(userId.Value);
            if (access is null) return Results.Unauthorized();
            return Results.Ok(new { token = access });
        });

        group.MapPost("/logout", (HttpResponse http) =>
        {
            http.Cookies.Delete("refreshToken");
            return Results.Ok();
        });

        return app;
    }
}
