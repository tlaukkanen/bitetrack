using System.Text.Json;
using Azure.AI.OpenAI; // AzureOpenAIClient type lives here
using BiteTrack.Api.Data;
using BiteTrack.Api.Domain;
using Microsoft.EntityFrameworkCore;
using System.Threading.Channels;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.DependencyInjection;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Processing;
using System.ClientModel;
using OpenAI.Chat;
using BiteTrack.Api.Utils;

namespace BiteTrack.Api.Processing;

public record MealAnalysisRequest(Guid MealId);

public interface IMealAnalysisQueue
{
    Task EnqueueAsync(MealAnalysisRequest request);
    IAsyncEnumerable<MealAnalysisRequest> DequeueAllAsync(CancellationToken ct);
}

public class InMemoryMealAnalysisQueue : IMealAnalysisQueue
{
    private readonly Channel<MealAnalysisRequest> _channel = Channel.CreateUnbounded<MealAnalysisRequest>();
    public Task EnqueueAsync(MealAnalysisRequest request) => _channel.Writer.WriteAsync(request).AsTask();
    public async IAsyncEnumerable<MealAnalysisRequest> DequeueAllAsync([System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken ct)
    {
        while (await _channel.Reader.WaitToReadAsync(ct))
        {
            while (_channel.Reader.TryRead(out var item)) yield return item;
        }
    }
}

public interface IAiMealAnalyzer
{
    Task<MealAnalysisResult> AnalyzeAsync(string localPhotoPath, CancellationToken ct = default);
}

public record MealAnalysisResult(string RawJson, int Calories, float Protein, float Carbs, float Fat, IEnumerable<MealItemResult> Items);
public record MealItemResult(string Name, float? Grams, int? Calories, float? Protein, float? Carbs, float? Fat, float? Confidence);

public class AzureOpenAiMealAnalyzer : IAiMealAnalyzer
{
    private readonly IConfiguration _config;
    public AzureOpenAiMealAnalyzer(IConfiguration config) { _config = config; }
    public async Task<MealAnalysisResult> AnalyzeAsync(string localPhotoPath, CancellationToken ct = default)
    {
        var endpoint = _config.GetValue<string>("AOAI_ENDPOINT");
        var apiKey = _config.GetValue<string>("AOAI_API_KEY");
        var deployment = _config.GetValue<string>("AOAI_DEPLOYMENT") ?? "gpt-4o";

        if (string.IsNullOrWhiteSpace(endpoint)) throw new InvalidOperationException("AOAI_ENDPOINT not configured");

        AzureOpenAIClient azureClient = !string.IsNullOrWhiteSpace(apiKey)
            ? new AzureOpenAIClient(
                new Uri(endpoint),
                new ApiKeyCredential(apiKey),
                new AzureOpenAIClientOptions(version: AzureOpenAIClientOptions.ServiceVersion.V2024_10_21)
                )
            : new AzureOpenAIClient(
                new Uri(endpoint),
                new Azure.Identity.DefaultAzureCredential(),
                new AzureOpenAIClientOptions(version: AzureOpenAIClientOptions.ServiceVersion.V2024_10_21)
                );

    var chatClient = azureClient.GetChatClient(deployment);
    using var stream = File.OpenRead(localPhotoPath);

        var systemPrompt = "You are a nutrition assistant. Analyze the given meal photo and extract estimated calories and macros. Return only JSON that matches the provided schema with no extra commentary.";
        var userInstruction = "Estimate totals and list recognizable items with grams and per-item macros when possible.";

        var schema = new
        {
            type = "object",
            properties = new
            {
                items = new
                {
                    type = "array",
                    items = new
                    {
                        type = "object",
                        properties = new
                        {
                            name = new { type = "string" },
                            grams = new { type = new object[] { "number", "null" } },
                            calories = new { type = new object[] { "integer", "null" } },
                            protein = new { type = new object[] { "number", "null" } },
                            carbs = new { type = new object[] { "number", "null" } },
                            fat = new { type = new object[] { "number", "null" } },
                            confidence = new { type = new object[] { "number", "null" }, minimum = 0, maximum = 1 }
                        },
                        // In strict schema mode, every defined property must be listed in 'required'.
                        required = new[] { "name", "grams", "calories", "protein", "carbs", "fat", "confidence" },
                        additionalProperties = false
                    }
                },
                totals = new
                {
                    type = "object",
                    properties = new
                    {
                        calories = new { type = "integer" },
                        protein = new { type = "number" },
                        carbs = new { type = "number" },
                        fat = new { type = "number" }
                    },
                    required = new[] { "calories", "protein", "carbs", "fat" },
                    additionalProperties = false
                }
            },
            required = new[] { "items", "totals" },
            additionalProperties = false
        };

        var options = new ChatCompletionOptions
        {
            ResponseFormat = ChatResponseFormat.CreateJsonSchemaFormat(
                jsonSchemaFormatName: "meal_analysis",
                jsonSchema: BinaryData.FromString(JsonSerializer.Serialize(schema)),
                jsonSchemaIsStrict: true)
        };

        // Provide the image inline (Azure GA does not support Files yet).
        var contentType = ContentTypeHelper.GetContentType(localPhotoPath);
        var bytes = BinaryData.FromStream(stream);
        var messages = new List<ChatMessage>
        {
            new SystemChatMessage(systemPrompt),
            ChatMessage.CreateUserMessage(
                ChatMessageContentPart.CreateTextPart(userInstruction),
                ChatMessageContentPart.CreateImagePart(bytes, contentType))
        };

        var completion = await chatClient.CompleteChatAsync(messages, options, ct);
        string content = completion.Value.Content?.FirstOrDefault()?.Text ?? "{}";

        using var doc = JsonDocument.Parse(content);
        var root = doc.RootElement;
        var totals = root.GetProperty("totals");
        int calories = totals.GetProperty("calories").GetInt32();
        float protein = totals.GetProperty("protein").GetSingle();
        float carbs = totals.GetProperty("carbs").GetSingle();
        float fat = totals.GetProperty("fat").GetSingle();

        var itemsList = new List<MealItemResult>();
        if (root.TryGetProperty("items", out var itemsEl) && itemsEl.ValueKind == JsonValueKind.Array)
        {
            foreach (var it in itemsEl.EnumerateArray())
            {
                string name = it.TryGetProperty("name", out var n) ? n.GetString() ?? "item" : "item";
                float? grams = it.TryGetProperty("grams", out var g) && g.ValueKind != JsonValueKind.Null ? g.GetSingle() : (float?)null;
                int? ic = it.TryGetProperty("calories", out var c) && c.ValueKind != JsonValueKind.Null ? c.GetInt32() : (int?)null;
                float? ip = it.TryGetProperty("protein", out var p) && p.ValueKind != JsonValueKind.Null ? p.GetSingle() : (float?)null;
                float? ia = it.TryGetProperty("carbs", out var a) && a.ValueKind != JsonValueKind.Null ? a.GetSingle() : (float?)null;
                float? ifat = it.TryGetProperty("fat", out var fEl) && fEl.ValueKind != JsonValueKind.Null ? fEl.GetSingle() : (float?)null;
                float? conf = it.TryGetProperty("confidence", out var confEl) && confEl.ValueKind != JsonValueKind.Null ? confEl.GetSingle() : (float?)null;
                itemsList.Add(new MealItemResult(name, grams, ic, ip, ia, ifat, conf));
            }
        }

        return new MealAnalysisResult(content, calories, protein, carbs, fat, itemsList);
    }
}

public interface IPhotoStorage
{
    Task<(string PhotoPath, string ThumbnailPath)> SaveAsync(string fileName, Stream data, string contentType, CancellationToken ct = default);
    string ResolvePath(string storedPath);
    Task DeleteAsync(string storedPath, CancellationToken ct = default);
}

public class LocalPhotoStorage : IPhotoStorage
{
    private readonly string _root;
    public LocalPhotoStorage(IConfiguration config)
    {
        _root = config.GetValue<string>("PHOTO_STORAGE_ROOT") ?? Path.Combine(AppContext.BaseDirectory, "photos");
        Directory.CreateDirectory(_root);
    }
    public async Task<(string PhotoPath, string ThumbnailPath)> SaveAsync(string fileName, Stream data, string contentType, CancellationToken ct = default)
    {
        var path = Path.Combine(_root, fileName);
        var dir = Path.GetDirectoryName(path);
        if (!string.IsNullOrEmpty(dir)) Directory.CreateDirectory(dir);
        var baseName = Path.GetFileNameWithoutExtension(fileName);
        var ext = Path.GetExtension(fileName);
        var thumbName = (Path.GetDirectoryName(fileName)?.Replace('\\','/') is string d && !string.IsNullOrEmpty(d) ? d + "/" : string.Empty) + baseName + "_thumb" + ext;
        var thumbPath = Path.Combine(_root, thumbName);
        var thumbDir = Path.GetDirectoryName(thumbPath);
        if (!string.IsNullOrEmpty(thumbDir)) Directory.CreateDirectory(thumbDir);
        try
        {
            data.Position = 0;
            using var image = await Image.LoadAsync(data, ct);
            image.Metadata.ExifProfile = null;
            var maxDim = 512;
            if (image.Width > maxDim || image.Height > maxDim)
            {
                var ratio = Math.Min((double)maxDim / image.Width, (double)maxDim / image.Height);
                var newWidth = (int)Math.Round(image.Width * ratio);
                var newHeight = (int)Math.Round(image.Height * ratio);
                image.Mutate(x => x.Resize(newWidth, newHeight));
            }
            await image.SaveAsync(path, ct);
            using var thumbImage = await Image.LoadAsync(path, ct);
            thumbImage.Metadata.ExifProfile = null;
            var tMax = 160;
            if (thumbImage.Width > tMax || thumbImage.Height > tMax)
            {
                var ratioT = Math.Min((double)tMax / thumbImage.Width, (double)tMax / thumbImage.Height);
                var tw = (int)Math.Round(thumbImage.Width * ratioT);
                var th = (int)Math.Round(thumbImage.Height * ratioT);
                thumbImage.Mutate(x => x.Resize(tw, th));
            }
            await thumbImage.SaveAsync(thumbPath, ct);
            return (fileName, thumbName);
        }
        catch
        {
            data.Position = 0;
            using var fs = File.Create(path);
            await data.CopyToAsync(fs, ct);
            return (fileName, fileName);
        }
    }
    public string ResolvePath(string storedPath) => Path.Combine(_root, storedPath);

    public Task DeleteAsync(string storedPath, CancellationToken ct = default)
    {
        try
        {
            var full = ResolvePath(storedPath);
            if (File.Exists(full)) File.Delete(full);
        }
        catch { }
        return Task.CompletedTask;
    }
}

public class AzureBlobPhotoStorage : IPhotoStorage
{
    private readonly Azure.Storage.Blobs.BlobContainerClient _container;
    private readonly string _cacheRoot;
    public AzureBlobPhotoStorage(IConfiguration config)
    {
        var account = config.GetValue<string>("PHOTOS_STORAGE_ACCOUNT_NAME") ?? throw new InvalidOperationException("PHOTOS_STORAGE_ACCOUNT_NAME is required for Azure photo storage");
        var key = config.GetValue<string>("PHOTOS_STORAGE_ACCOUNT_KEY") ?? throw new InvalidOperationException("PHOTOS_STORAGE_ACCOUNT_KEY is required for Azure photo storage");
        var container = config.GetValue<string>("PHOTOS_STORAGE_ACCOUNT_CONTAINER") ?? "photos";
        var service = new Azure.Storage.Blobs.BlobServiceClient(new Uri($"https://{account}.blob.core.windows.net"), new Azure.Storage.StorageSharedKeyCredential(account, key));
        _container = service.GetBlobContainerClient(container);
        _container.CreateIfNotExists();
        _cacheRoot = Path.Combine(Path.GetTempPath(), "bitetrack-cache");
        Directory.CreateDirectory(_cacheRoot);
    }

    public async Task<(string PhotoPath, string ThumbnailPath)> SaveAsync(string fileName, Stream data, string contentType, CancellationToken ct = default)
    {
        var blobName = fileName.Replace('\\','/');
        var dir = Path.GetDirectoryName(blobName)?.Replace('\\','/');
        var baseName = Path.GetFileNameWithoutExtension(blobName);
        var ext = Path.GetExtension(blobName);
        var thumbName = (string.IsNullOrEmpty(dir) ? string.Empty : dir + "/") + baseName + "_thumb" + ext;

        try
        {
            data.Position = 0;
            using var image = await Image.LoadAsync(data, ct);
            image.Metadata.ExifProfile = null;
            var maxDim = 512;
            if (image.Width > maxDim || image.Height > maxDim)
            {
                var ratio = Math.Min((double)maxDim / image.Width, (double)maxDim / image.Height);
                var newWidth = (int)Math.Round(image.Width * ratio);
                var newHeight = (int)Math.Round(image.Height * ratio);
                image.Mutate(x => x.Resize(newWidth, newHeight));
            }

            using var mainMs = new MemoryStream();
            await SaveImageToStreamAsync(image, ext, mainMs, ct);
            mainMs.Position = 0;
            var mainBlob = _container.GetBlobClient(blobName);
            await mainBlob.UploadAsync(mainMs, new Azure.Storage.Blobs.Models.BlobHttpHeaders { ContentType = contentType }, cancellationToken: ct);

            using var thumbImage = image.Clone(x => { });
            var tMax = 160;
            if (thumbImage.Width > tMax || thumbImage.Height > tMax)
            {
                var ratioT = Math.Min((double)tMax / thumbImage.Width, (double)tMax / thumbImage.Height);
                var tw = (int)Math.Round(thumbImage.Width * ratioT);
                var th = (int)Math.Round(thumbImage.Height * ratioT);
                thumbImage.Mutate(x => x.Resize(tw, th));
            }
            using var thumbMs = new MemoryStream();
            await SaveImageToStreamAsync(thumbImage, ext, thumbMs, ct);
            thumbMs.Position = 0;
            var thumbBlob = _container.GetBlobClient(thumbName);
            await thumbBlob.UploadAsync(thumbMs, new Azure.Storage.Blobs.Models.BlobHttpHeaders { ContentType = contentType }, cancellationToken: ct);

            return (blobName, thumbName);
        }
        catch
        {
            try
            {
                data.Position = 0;
                var mainBlob = _container.GetBlobClient(blobName);
                await mainBlob.UploadAsync(data, new Azure.Storage.Blobs.Models.BlobHttpHeaders { ContentType = contentType }, cancellationToken: ct);
                return (blobName, blobName);
            }
            catch
            {
                throw;
            }
        }
    }

    public string ResolvePath(string storedPath)
    {
        var local = Path.Combine(_cacheRoot, storedPath.Replace('/', Path.DirectorySeparatorChar));
        var dir = Path.GetDirectoryName(local);
        if (!string.IsNullOrEmpty(dir)) Directory.CreateDirectory(dir);
        try
        {
            var blob = _container.GetBlobClient(storedPath);
            blob.DownloadTo(local);
        }
        catch
        {
            // Ignore download failures here; caller can check File.Exists(local)
        }
        return local;
    }

    public async Task DeleteAsync(string storedPath, CancellationToken ct = default)
    {
        try
        {
            await _container.DeleteBlobIfExistsAsync(storedPath, cancellationToken: ct);
        }
        catch { }
        try
        {
            var local = Path.Combine(_cacheRoot, storedPath.Replace('/', Path.DirectorySeparatorChar));
            if (File.Exists(local)) File.Delete(local);
        }
        catch { }
    }

    private static Task SaveImageToStreamAsync(Image image, string ext, Stream target, CancellationToken ct)
    {
        SixLabors.ImageSharp.Formats.IImageEncoder e = (ext?.ToLowerInvariant()) switch
        {
            ".jpg" => new SixLabors.ImageSharp.Formats.Jpeg.JpegEncoder(),
            ".jpeg" => new SixLabors.ImageSharp.Formats.Jpeg.JpegEncoder(),
            ".png" => new SixLabors.ImageSharp.Formats.Png.PngEncoder(),
            ".webp" => new SixLabors.ImageSharp.Formats.Webp.WebpEncoder(),
            _ => new SixLabors.ImageSharp.Formats.Jpeg.JpegEncoder()
        };
        return image.SaveAsync(target, e, ct);
    }
}

public class MealAnalysisBackgroundService : BackgroundService
{
    private readonly IServiceProvider _sp;
    private readonly IMealAnalysisQueue _queue;
    private readonly ILogger<MealAnalysisBackgroundService> _logger;
    public MealAnalysisBackgroundService(IServiceProvider sp, IMealAnalysisQueue queue, ILogger<MealAnalysisBackgroundService> logger)
    { _sp = sp; _queue = queue; _logger = logger; }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var req in _queue.DequeueAllAsync(stoppingToken))
        {
            try
            {
                using var scope = _sp.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var analyzer = scope.ServiceProvider.GetRequiredService<IAiMealAnalyzer>();
                var storage = scope.ServiceProvider.GetRequiredService<IPhotoStorage>();
                var meal = await db.Meals.Include(m => m.Items).FirstOrDefaultAsync(m => m.Id == req.MealId, stoppingToken);
                if (meal == null) continue;
                var path = storage.ResolvePath(meal.PhotoPath);
                var result = await analyzer.AnalyzeAsync(path, stoppingToken);
                meal.Status = MealStatus.Ready;
                meal.Calories = result.Calories;
                meal.Protein = result.Protein;
                meal.Carbs = result.Carbs;
                meal.Fat = result.Fat;
                meal.RawAiJson = result.RawJson;
                meal.AiModel = "gpt-4o";
                if (meal.Items.Count > 0)
                {
                    var existing = meal.Items.ToList();
                    foreach (var old in existing)
                    {
                        db.MealFoodItems.Remove(old);
                    }
                }
                foreach (var i in result.Items)
                {
                    db.MealFoodItems.Add(new MealFoodItem
                    {
                        MealId = meal.Id,
                        Name = i.Name,
                        Grams = i.Grams,
                        Calories = i.Calories,
                        Protein = i.Protein,
                        Carbs = i.Carbs,
                        Fat = i.Fat,
                        Confidence = i.Confidence
                    });
                }
                meal.UpdatedAtUtc = DateTime.UtcNow;
                foreach (var entry in db.ChangeTracker.Entries())
                {
                    _logger.LogDebug("Tracking {Entity} state {State}", entry.Entity.GetType().Name, entry.State);
                }
                await db.SaveChangesAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Meal analysis failed");
                try
                {
                    using var scope = _sp.CreateScope();
                    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                    var meal = await db.Meals.FirstOrDefaultAsync(m => m.Id == req.MealId, stoppingToken);
                    if (meal != null)
                    {
                        meal.Status = MealStatus.Error;
                        meal.ErrorMessage = ex.Message;
                        meal.UpdatedAtUtc = DateTime.UtcNow;
                        await db.SaveChangesAsync(stoppingToken);
                    }
                }
                catch { }
            }
        }
    }
}
