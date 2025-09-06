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
        return GenerateJwt(user);
    }

    public async Task<string?> LoginAsync(string email, string password)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == email);
        if (user == null) return null;
        if (!BCrypt.Net.BCrypt.Verify(password, user.PasswordHash)) return null;
        return GenerateJwt(user);
    }

    private string GenerateJwt(User user)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwt.Value));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(
            claims: new[] {
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(ClaimTypes.Email, user.Email),
                new Claim(ClaimTypes.Name, user.DisplayName)
            },
            expires: DateTime.UtcNow.AddDays(7),
            signingCredentials: creds);
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
