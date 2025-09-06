namespace BiteTrack.Api.Services;

using System;
using BiteTrack.Api.Data;
using BiteTrack.Api.Domain;
using BiteTrack.Api.Processing;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

public class MealService
{
    private readonly AppDbContext _db;
    public MealService(AppDbContext db) { _db = db; }

    public async Task<Meal> CreateMealAsync(Guid userId, IFormFile photo, IPhotoStorage storage, IMealAnalysisQueue queue, DateTime? createdAtUtc = null)
    {
        var fileName = $"{Guid.NewGuid()}{Path.GetExtension(photo.FileName)}";
        var saved = await storage.SaveAsync(fileName, photo.OpenReadStream(), photo.ContentType);
        var meal = new Meal { UserId = userId, PhotoPath = saved.PhotoPath, ThumbnailPath = saved.ThumbnailPath, Status = MealStatus.Processing };
        if (createdAtUtc.HasValue)
        {
            meal.CreatedAtUtc = createdAtUtc.Value;
            meal.UpdatedAtUtc = createdAtUtc.Value;
        }
        _db.Meals.Add(meal);
        await _db.SaveChangesAsync();
        await queue.EnqueueAsync(new MealAnalysisRequest(meal.Id));
        return meal;
    }

    public async Task<List<Meal>> GetMealsAsync(Guid userId, DateOnly date)
    {
        var start = date.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var end = start.AddDays(1);
        return await _db.Meals.Include(m => m.Items)
            .Where(m => m.UserId == userId && m.CreatedAtUtc >= start && m.CreatedAtUtc < end)
            .OrderByDescending(m => m.CreatedAtUtc)
            .ToListAsync();
    }

    public async Task<Meal?> GetMealAsync(Guid userId, Guid id) => await _db.Meals.Include(m => m.Items).FirstOrDefaultAsync(m => m.Id == id && m.UserId == userId);

    public async Task<DailySummary> GetDailySummaryAsync(Guid userId, DateOnly date)
    {
        var meals = await GetMealsAsync(userId, date);
        var calories = meals.Sum(m => m.Calories ?? 0);
        float protein = meals.Sum(m => m.Protein ?? 0);
        float carbs = meals.Sum(m => m.Carbs ?? 0);
        float fat = meals.Sum(m => m.Fat ?? 0);
        return new DailySummary(date, calories, protein, carbs, fat);
    }

    public Task<int> SaveChangesAsync() => _db.SaveChangesAsync();
}
