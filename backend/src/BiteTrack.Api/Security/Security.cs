namespace BiteTrack.Api.Security;

using System;
using System.Security.Claims;

public record JwtSecret(string Value);

public static class PrincipalExtensions
{
    public static Guid GetUserId(this ClaimsPrincipal principal)
    {
        var id = principal.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(id, out var g) ? g : Guid.Empty;
    }
}
