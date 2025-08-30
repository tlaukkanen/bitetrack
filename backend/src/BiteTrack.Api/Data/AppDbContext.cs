using BiteTrack.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace BiteTrack.Api.Data;

public class AppDbContext : DbContext
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Meal> Meals => Set<Meal>();
    public DbSet<MealFoodItem> MealFoodItems => Set<MealFoodItem>();
    public DbSet<UserGoal> UserGoals => Set<UserGoal>();

    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>().HasIndex(u => u.Email).IsUnique();
        modelBuilder.Entity<Meal>().HasIndex(m => new { m.UserId, m.CreatedAtUtc });
        modelBuilder.Entity<MealFoodItem>().HasIndex(i => i.MealId);
        modelBuilder.Entity<UserGoal>().HasIndex(g => g.UserId).IsUnique();
    }
}
