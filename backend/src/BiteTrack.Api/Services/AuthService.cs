namespace BiteTrack.Api.Services;

using System;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using BiteTrack.Api.Data;
using BiteTrack.Api.Domain;
using BiteTrack.Api.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

public class AuthService
{
    private readonly AppDbContext _db;
    private readonly JwtSecret _jwt;
    public AuthService(AppDbContext db, JwtSecret jwt) { _db = db; _jwt = jwt; }

    public async Task<string> RegisterAsync(string email, string password, string displayName)
    {
        if (await _db.Users.AnyAsync(u => u.Email == email)) throw new InvalidOperationException("Email already registered");
        var hash = BCrypt.Net.BCrypt.HashPassword(password);
        var user = new User { Email = email, DisplayName = displayName, PasswordHash = hash };
        _db.Users.Add(user);
        await _db.SaveChangesAsync();
        return GenerateAccessToken(user);
    }

    public async Task<string?> LoginAsync(string email, string password)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == email);
        if (user == null) return null;
        if (!BCrypt.Net.BCrypt.Verify(password, user.PasswordHash)) return null;
        return GenerateAccessToken(user);
    }

    public string GenerateAccessToken(User user)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwt.Value));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(
            claims: new[] {
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(ClaimTypes.Email, user.Email),
                new Claim(ClaimTypes.Name, user.DisplayName),
                new Claim("typ", "access")
            },
            expires: DateTime.UtcNow.AddDays(7),
            signingCredentials: creds);
        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public string GenerateRefreshToken(User user)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwt.Value));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(
            claims: new[] {
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim("typ", "refresh")
            },
            expires: DateTime.UtcNow.AddDays(30),
            signingCredentials: creds);
        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public Guid? ValidateRefreshToken(string refreshToken)
    {
        var handler = new JwtSecurityTokenHandler();
        try
        {
            var principal = handler.ValidateToken(refreshToken, new TokenValidationParameters
            {
                ValidateIssuer = false,
                ValidateAudience = false,
                ValidateLifetime = true,
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwt.Value))
            }, out var validatedToken);
            var jwt = validatedToken as JwtSecurityToken;
            if (jwt == null) return null;
            var typ = jwt.Claims.FirstOrDefault(c => c.Type == "typ")?.Value;
            if (!string.Equals(typ, "refresh", StringComparison.Ordinal)) return null;
            var sub = principal.Claims.FirstOrDefault(c => c.Type == ClaimTypes.NameIdentifier)?.Value;
            if (Guid.TryParse(sub, out var userId)) return userId;
            return null;
        }
        catch
        {
            return null;
        }
    }

    public async Task<string?> GenerateAccessTokenForUserId(Guid userId)
    {
        var user = await _db.Users.FindAsync(userId);
        if (user is null) return null;
        return GenerateAccessToken(user);
    }
}
