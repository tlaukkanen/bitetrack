namespace BiteTrack.Api.Contracts;

using System;
using System.Collections.Generic;
using System.Linq;
using BiteTrack.Api.Domain;

public record RegisterRequest(string Email, string Password, string DisplayName, string? InvitationCode);
public record LoginRequest(string Email, string Password);

public record MealItemDto(Guid Id, string Name, float? Grams, int? Calories, float? Protein, float? Carbs, float? Fat, float? Confidence);
public record UpdateMealRequest(string? Description, int? Calories, float? Protein, float? Carbs, float? Fat, DateTime? CreatedAtUtc);

public record MealDto(Guid Id, DateTime CreatedAtUtc, string Status, string PhotoPath, string? ThumbnailPath, string? Description, int? Calories, float? Protein, float? Carbs, float? Fat, IEnumerable<MealItemDto> Items, string? ErrorMessage)
{
    public static MealDto FromEntity(Meal m) => new(
        m.Id,
        m.CreatedAtUtc,
        m.Status.ToString(),
        m.PhotoPath,
        m.ThumbnailPath,
        m.Description,
        m.Calories,
        m.Protein,
        m.Carbs,
        m.Fat,
        m.Items is null
            ? Array.Empty<MealItemDto>()
            : m.Items.Select(i => new MealItemDto(i.Id, i.Name, i.Grams, i.Calories, i.Protein, i.Carbs, i.Fat, i.Confidence)),
        m.ErrorMessage);
}

public record GoalRequest(int Calories, float Protein, float Carbs, float Fat);

// Dev-only DTOs
public record DevUserDto(Guid Id, string Email, string DisplayName, int MealCount, DateTime? LastMealAtUtc);
public record DevMealDto(Guid Id, DateTime CreatedAtUtc, string Status, int? Calories, float? Protein, float? Carbs, float? Fat);
public record DevUserDetailDto(Guid Id, string Email, string DisplayName, List<DevMealDto> RecentMeals);
