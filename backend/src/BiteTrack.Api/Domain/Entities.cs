namespace BiteTrack.Api.Domain;

public enum MealStatus
{
    Processing = 0,
    Ready = 1,
    Error = 2
}

public class User
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Email { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public ICollection<Meal> Meals { get; set; } = new List<Meal>();
}

public class Meal
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public User? User { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
    public MealStatus Status { get; set; } = MealStatus.Processing;
    public string PhotoPath { get; set; } = string.Empty; // local or blob relative path
    public string ThumbnailPath { get; set; } = string.Empty; // resized smaller variant for lists
    public string? Description { get; set; }
    public int? Calories { get; set; }
    public float? Protein { get; set; }
    public float? Carbs { get; set; }
    public float? Fat { get; set; }
    public string? RawAiJson { get; set; }
    public string? AiModel { get; set; }
    public string? ErrorMessage { get; set; }
    public ICollection<MealFoodItem> Items { get; set; } = new List<MealFoodItem>();
}

public class MealFoodItem
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid MealId { get; set; }
    public Meal? Meal { get; set; }
    public string Name { get; set; } = string.Empty;
    public float? Grams { get; set; }
    public int? Calories { get; set; }
    public float? Protein { get; set; }
    public float? Carbs { get; set; }
    public float? Fat { get; set; }
    public float? Confidence { get; set; }
}

public class WaterIntake
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public User? User { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public int AmountMl { get; set; }
    public string? Unit { get; set; } // e.g., "ml" or "oz"
}

public class UserSettings
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public User? User { get; set; }
    public int? DefaultGlassMl { get; set; }
    public string? PreferredUnit { get; set; } // "ml" or "oz"
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}

public class UserGoal
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public User? User { get; set; }
    public int Calories { get; set; }
    public float Protein { get; set; }
    public float Carbs { get; set; }
    public float Fat { get; set; }
    public int WaterMl { get; set; } // hydration goal per day
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}

public record DailySummary(DateOnly Date, int Calories, float Protein, float Carbs, float Fat, int WaterMl);
