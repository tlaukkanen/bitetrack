namespace BiteTrack.Api.Endpoints;

using BiteTrack.Api.Data;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;

public static class HealthEndpoints
{
    public static IEndpointRouteBuilder MapHealthEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/health/live", () => Results.Ok(new { status = "ok" }))
           .WithName("Liveness")
           .WithDescription("Basic liveness probe; always returns ok if process is running.");

        app.MapGet("/health/ready", async (IServiceProvider sp, HttpRequest req, IConfiguration cfg) =>
        {
            using var scope = sp.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var details = new Dictionary<string, object?>();

            var createRequested = string.Equals(req.Query["create"], "yes", StringComparison.OrdinalIgnoreCase);
            var providedSecret = req.Query["secret"].ToString();
            var expectedSecret = cfg["DB_INIT_SECRET"];
            details["createRequested"] = createRequested;
            details["env"] = scope.ServiceProvider.GetRequiredService<IHostEnvironment>().EnvironmentName;

            if (createRequested)
            {
                if (string.IsNullOrWhiteSpace(expectedSecret))
                {
                    details["createAuthorized"] = false;
                    details["createDeniedReason"] = "Server missing DB_INIT_SECRET";
                    return Results.Json(new { status = "create-forbidden", details }, statusCode: 403);
                }
                if (string.IsNullOrWhiteSpace(providedSecret))
                {
                    details["createAuthorized"] = false;
                    details["createDeniedReason"] = "Missing secret query parameter";
                    return Results.Json(new { status = "create-forbidden", details }, statusCode: 403);
                }
                var a = System.Text.Encoding.UTF8.GetBytes(providedSecret);
                var b = System.Text.Encoding.UTF8.GetBytes(expectedSecret);
                if (a.Length != b.Length || !System.Security.Cryptography.CryptographicOperations.FixedTimeEquals(a, b))
                {
                    details["createAuthorized"] = false;
                    details["createDeniedReason"] = "Invalid secret";
                    return Results.Json(new { status = "create-forbidden", details }, statusCode: 403);
                }
                details["createAuthorized"] = true;
            }

            try
            {
                var canConnect = await db.Database.CanConnectAsync();
                details["dbCanConnect"] = canConnect;
                if (!canConnect)
                    return Results.Json(new { status = "unhealthy", details }, statusCode: 503);

                var all = db.Database.GetMigrations().ToList();
                var applied = db.Database.GetAppliedMigrations().ToList();
                var pending = db.Database.GetPendingMigrations().ToList();
                details["allMigrations"] = all;
                details["appliedMigrations"] = applied;
                details["pendingMigrations"] = pending;

                if (createRequested && Equals(details["createAuthorized"], true))
                {
                    try
                    {
                        if (pending.Count > 0)
                        {
                            db.Database.Migrate();
                            details["createAction"] = "Applied pending migrations";
                        }
                        else if (all.Count == 0)
                        {
                            if (scope.ServiceProvider.GetRequiredService<IHostEnvironment>().IsDevelopment())
                            {
                                if (db.Database.EnsureCreated())
                                    details["createAction"] = "EnsureCreated created schema (dev fallback)";
                                else
                                    details["createAction"] = "EnsureCreated found existing schema (dev fallback)";
                            }
                            else
                            {
                                details["createAction"] = "No migrations compiled in production";
                            }
                        }
                        else
                        {
                            details["createAction"] = "No action (up to date)";
                        }

                        all = db.Database.GetMigrations().ToList();
                        applied = db.Database.GetAppliedMigrations().ToList();
                        pending = db.Database.GetPendingMigrations().ToList();
                        details["allMigrations"] = all;
                        details["appliedMigrations"] = applied;
                        details["pendingMigrations"] = pending;
                    }
                    catch (Exception cex)
                    {
                        details["createError"] = cex.Message;
                    }
                }

                bool usersTableExists;
                try
                {
                    await db.Users.AsNoTracking().Take(1).AnyAsync();
                    usersTableExists = true;
                }
                catch
                {
                    usersTableExists = false;
                    if (createRequested && Equals(details["createAuthorized"], true) && scope.ServiceProvider.GetRequiredService<IHostEnvironment>().IsDevelopment())
                    {
                        try
                        {
                            db.Database.Migrate();
                            await db.Users.AsNoTracking().Take(1).AnyAsync();
                            usersTableExists = true;
                            details["postFallbackMigrate"] = true;
                        }
                        catch (Exception mfex)
                        {
                            details["postFallbackMigrateError"] = mfex.Message;
                        }
                    }
                }
                details["usersTableExists"] = usersTableExists;
                if (!usersTableExists)
                    return Results.Json(new { status = "schema-missing", details }, statusCode: 503);

                if (pending.Count > 0)
                    return Results.Json(new { status = "migrating", details }, statusCode: 503);
                if (all.Count == 0)
                    return Results.Json(new { status = "no-migrations-compiled", details }, statusCode: 503);

                return Results.Ok(new { status = "ready", details });
            }
            catch (Exception ex)
            {
                details["exception"] = ex.Message;
                return Results.Json(new { status = "error", details }, statusCode: 503);
            }
        })
        .WithName("Readiness")
        .WithDescription("Readiness probe; ensures DB reachable, migrations applied, and base schema present. Supports ?create=yes in Development.");

        return app;
    }
}
