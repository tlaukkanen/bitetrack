namespace BiteTrack.Api.Services;

using System.Text;
using Azure.AI.OpenAI;
using BiteTrack.Api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using OpenAI.Chat;
using System.ClientModel;

public class AiSuggestionService
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _config;

    public AiSuggestionService(AppDbContext db, IConfiguration config)
    {
        _db = db;
        _config = config;
    }

    public async Task<string> GenerateSuggestionsAsync(Guid userId, string goalKey, CancellationToken ct = default)
    {
        var since = DateTime.UtcNow.AddDays(-30);
        var meals = await _db.Meals
            .Include(m => m.Items)
            .Where(m => m.UserId == userId && m.CreatedAtUtc >= since)
            .OrderByDescending(m => m.CreatedAtUtc)
            .Take(60) // keep prompt bounded
            .ToListAsync(ct);

        var goal = await _db.UserGoals.FirstOrDefaultAsync(g => g.UserId == userId, ct);
        var settings = await _db.UserSettings.FirstOrDefaultAsync(s => s.UserId == userId, ct);
        var water = await _db.WaterIntakes
            .Where(w => w.UserId == userId && w.CreatedAtUtc >= since)
            .ToListAsync(ct);

        var summary = BuildUserHistorySummary(meals, goal);
        // Hydration stats
        int waterDays = water.GroupBy(w => DateOnly.FromDateTime(DateTime.SpecifyKind(w.CreatedAtUtc, DateTimeKind.Utc))).Count();
        double avgWater = waterDays > 0 ? water.Sum(w => (double)w.AmountMl) / waterDays : 0;
        if (avgWater > 0 || (goal?.WaterMl ?? 0) > 0 || (settings?.DefaultGlassMl ?? 0) > 0)
        {
            var extra = new StringBuilder();
            extra.Append($"Avg daily water: {Math.Round(avgWater)} ml.");
            if ((goal?.WaterMl ?? 0) > 0) extra.Append($" Target: {goal!.WaterMl} ml/day.");
            if ((settings?.DefaultGlassMl ?? 0) > 0) extra.Append($" Default glass: {settings!.DefaultGlassMl} ml.");
            summary += "\n" + extra.ToString();
        }
        var goalText = MapGoalKey(goalKey);

        var endpoint = _config.GetValue<string>("AOAI_ENDPOINT");
        var apiKey = _config.GetValue<string>("AOAI_API_KEY");
        var deployment = _config.GetValue<string>("AOAI_DEPLOYMENT") ?? "gpt-4o";
        if (string.IsNullOrWhiteSpace(endpoint))
            throw new InvalidOperationException("AOAI_ENDPOINT not configured");

        AzureOpenAIClient client = !string.IsNullOrWhiteSpace(apiKey)
            ? new AzureOpenAIClient(new Uri(endpoint), new ApiKeyCredential(apiKey), new AzureOpenAIClientOptions(version: AzureOpenAIClientOptions.ServiceVersion.V2024_10_21))
            : new AzureOpenAIClient(new Uri(endpoint), new Azure.Identity.DefaultAzureCredential(), new AzureOpenAIClientOptions(version: AzureOpenAIClientOptions.ServiceVersion.V2024_10_21));

        var chat = client.GetChatClient(deployment);

        var system = "You are a friendly, practical nutrition coach. Provide clear, actionable guidance based on the user's meal history and stated goal. Focus on small sustainable changes and concrete examples. Keep tone encouraging and specific.";

    var user = $@"User goal: {goalText}
Known macro goals (if any): calories={goal?.Calories ?? 0}, protein={goal?.Protein ?? 0}, carbs={goal?.Carbs ?? 0}, fat={goal?.Fat ?? 0}

Recent meal history summary (last 30 days, most recent first):
{summary}

Please respond in concise Markdown with:
1) A brief overview (2-3 sentences) tailored to the user's habits and goal.
2) 5-7 specific suggestions (bulleted) that adapt what they already eat.
3) 2-3 meal ideas likely to match their preferences with estimated macros.
4) Optional: gentle cautions or substitutions relating to the goal.
Avoid generic platitudes; be specific and realistic.";

        var messages = new List<ChatMessage>
        {
            new SystemChatMessage(system),
            ChatMessage.CreateUserMessage(ChatMessageContentPart.CreateTextPart(user))
        };

        var completion = await chat.CompleteChatAsync(messages, new ChatCompletionOptions(), ct);
        var content = completion.Value.Content?.FirstOrDefault()?.Text?.Trim();
        return content ?? "";
    }

    private static string BuildUserHistorySummary(IEnumerable<BiteTrack.Api.Domain.Meal> meals, BiteTrack.Api.Domain.UserGoal? goal)
    {
        var sb = new StringBuilder();
        // Aggregate totals and favorites
        int days = 0;
        var perDay = meals
            .GroupBy(m => DateOnly.FromDateTime(DateTime.SpecifyKind(m.CreatedAtUtc, DateTimeKind.Utc)))
            .OrderByDescending(g => g.Key)
            .ToList();
        days = perDay.Count;
        var totalCals = 0;
        double totalP = 0, totalC = 0, totalF = 0;
        var itemCounts = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        foreach (var g in perDay)
        {
            var cals = g.Sum(m => m.Calories ?? 0);
            var p = g.Sum(m => m.Protein ?? 0);
            var c = g.Sum(m => m.Carbs ?? 0);
            var f = g.Sum(m => m.Fat ?? 0);
            totalCals += cals;
            totalP += p; totalC += c; totalF += f;
            foreach (var m in g)
            {
                foreach (var it in m.Items)
                {
                    if (string.IsNullOrWhiteSpace(it.Name)) continue;
                    itemCounts[it.Name] = itemCounts.TryGetValue(it.Name, out var cnt) ? cnt + 1 : 1;
                }
            }
        }
        double avgCals = days > 0 ? totalCals / (double)days : 0;
        double avgP = days > 0 ? totalP / days : 0;
        double avgC = days > 0 ? totalC / days : 0;
        double avgF = days > 0 ? totalF / days : 0;
        var topFoods = itemCounts.OrderByDescending(kv => kv.Value).Take(10).Select(kv => $"{kv.Key} (x{kv.Value})");

        sb.AppendLine($"Days recorded: {days}");
        sb.AppendLine($"Avg daily macros: {Math.Round(avgCals)} kcal, P {Math.Round(avgP)}g, C {Math.Round(avgC)}g, F {Math.Round(avgF)}g");
        if (goal is not null)
        {
            sb.AppendLine($"User targets (if set): {goal.Calories} kcal, P {goal.Protein}g, C {goal.Carbs}g, F {goal.Fat}g");
        }
        if (topFoods.Any())
        {
            sb.AppendLine("Frequent items: " + string.Join(", ", topFoods));
        }

        // Include a few recent meals for concreteness
        foreach (var m in meals.Take(6))
        {
            var dt = DateTime.SpecifyKind(m.CreatedAtUtc, DateTimeKind.Utc).ToString("yyyy-MM-dd");
            var desc = string.IsNullOrWhiteSpace(m.Description) ? null : m.Description.Trim();
            var macro = $"{(m.Calories ?? 0)} kcal, P {m.Protein ?? 0}g, C {m.Carbs ?? 0}g, F {m.Fat ?? 0}g";
            var items = (m.Items?.Any() == true) ? string.Join(", ", m.Items.Select(i => i.Name)) : null;
            sb.AppendLine($"- {dt}: {(desc ?? items ?? "meal")} ({macro})");
        }

        return sb.ToString();
    }

    private static string MapGoalKey(string key)
    {
        return key switch
        {
            "mild_weight_loss" => "Aim for ~0.25 kg/week weight loss with moderate calorie deficit and protein-preserving choices.",
            "weight_loss" => "Aim for ~0.5 kg/week weight loss using a consistent but sustainable energy deficit and higher-protein meals.",
            "maintain" => "Maintain current weight with balanced macros and consistent meal timing.",
            "eat_healthier" => "Eat healthier overall with more whole foods, fiber, and minimally processed options.",
            "energy" => "Boost daily energy through steady blood sugar meals, hydration, and balanced macros.",
            "nutrient_balance" => "Improve nutrient balance by increasing variety, color, fiber, and micronutrient-dense options.",
            "heart_health" => "Support heart health with more unsaturated fats, fiber, and reduced sodium and saturated fat.",
            "blood_sugar" => "Manage blood sugar with consistent carbs, fiber, protein pairings, and portion awareness.",
            "anti_inflammation" => "Reduce inflammation by emphasizing omega-3s, colorful produce, and minimizing ultra-processed foods.",
            "reduce_processed" => "Reduce processed foods by swapping to simple whole-food alternatives.",
            "more_plant_based" => "Eat more plant-based meals while keeping protein adequate and enjoyable.",
            _ => key
        };
    }
}
