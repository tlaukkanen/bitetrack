namespace BiteTrack.Api.Services;

using System;
using BiteTrack.Api.Data;
using BiteTrack.Api.Domain;
using BiteTrack.Api.Processing;
using BiteTrack.Api.Utils;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

public class MealService
{
    private readonly AppDbContext _db;
    public MealService(AppDbContext db) { _db = db; }

    public async Task<Meal> CreateMealAsync(Guid userId, IFormFile photo, IPhotoStorage storage, IMealAnalysisQueue queue, DateTime? createdAtUtc = null)
    {
        var ext = Path.GetExtension(photo.FileName);
        var safeExt = string.IsNullOrEmpty(ext) ? ".jpg" : ext;
        var fileName = $"users/{userId}/" + Guid.NewGuid().ToString("N") + safeExt;
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

    public async Task<Meal> CreateMealFromDescriptionAsync(Guid userId, string? description, IMealAnalysisQueue queue, DateTime? createdAtUtc = null)
    {
        var meal = new Meal
        {
            UserId = userId,
            Status = MealStatus.Processing,
            PhotoPath = string.Empty,
            ThumbnailPath = string.Empty,
            Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim()
        };
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
        var start = date.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var end = start.AddDays(1);
        var waterMl = await _db.WaterIntakes
            .Where(w => w.UserId == userId && w.CreatedAtUtc >= start && w.CreatedAtUtc < end)
            .SumAsync(w => (int?)w.AmountMl) ?? 0;
        return new DailySummary(date, calories, protein, carbs, fat, waterMl);
    }

    public Task<int> SaveChangesAsync() => _db.SaveChangesAsync();

    public async Task<bool> DeleteMealAsync(Guid userId, Guid id, IPhotoStorage storage, CancellationToken ct = default)
    {
        var meal = await _db.Meals.Include(m => m.Items).FirstOrDefaultAsync(m => m.Id == id && m.UserId == userId, ct);
        if (meal == null) return false;
        var photo = meal.PhotoPath;
        var thumb = meal.ThumbnailPath;
        if (meal.Items.Count > 0)
        {
            _db.MealFoodItems.RemoveRange(meal.Items);
        }
        _db.Meals.Remove(meal);
        await _db.SaveChangesAsync(ct);
        try { if (!string.IsNullOrWhiteSpace(photo)) await storage.DeleteAsync(photo, ct); } catch { }
        try { if (!string.IsNullOrWhiteSpace(thumb)) await storage.DeleteAsync(thumb, ct); } catch { }
        return true;
    }

    public async Task<Meal?> DuplicateMealAsync(Guid userId, Guid sourceMealId, IPhotoStorage storage, DateTime? createdAtUtc = null, CancellationToken ct = default)
    {
        var source = await _db.Meals.Include(m => m.Items).FirstOrDefaultAsync(m => m.Id == sourceMealId && m.UserId == userId, ct);
        if (source == null) return null;
        if (string.IsNullOrWhiteSpace(source.PhotoPath)) return null;

        var fullPath = storage.ResolvePath(source.PhotoPath);
        if (!File.Exists(fullPath)) return null;

        var ext = Path.GetExtension(source.PhotoPath);
        if (string.IsNullOrEmpty(ext)) ext = ".jpg";
        var newFileName = $"users/{userId}/" + Guid.NewGuid().ToString("N") + ext;
        await using var fs = File.OpenRead(fullPath);
        var contentType = ContentTypeHelper.GetContentType(fullPath);
        var saved = await storage.SaveAsync(newFileName, fs, contentType, ct);

        var when = createdAtUtc.HasValue ? createdAtUtc.Value : DateTime.UtcNow;

        var clone = new Meal
        {
            UserId = userId,
            CreatedAtUtc = when,
            UpdatedAtUtc = when,
            Status = source.Status,
            PhotoPath = saved.PhotoPath,
            ThumbnailPath = saved.ThumbnailPath,
            Description = source.Description,
            Calories = source.Calories,
            Protein = source.Protein,
            Carbs = source.Carbs,
            Fat = source.Fat,
            RawAiJson = source.RawAiJson,
            AiModel = source.AiModel,
            ErrorMessage = source.ErrorMessage
        };

        foreach (var it in source.Items)
        {
            clone.Items.Add(new Domain.MealFoodItem
            {
                Name = it.Name,
                Grams = it.Grams,
                Calories = it.Calories,
                Protein = it.Protein,
                Carbs = it.Carbs,
                Fat = it.Fat,
                Confidence = it.Confidence
            });
        }

        _db.Meals.Add(clone);
        await _db.SaveChangesAsync(ct);
        return clone;
    }
}
