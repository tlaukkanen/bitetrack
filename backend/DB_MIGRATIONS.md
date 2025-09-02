# Database Migrations

Entity Framework Core migrations are now enabled (Program.cs uses `db.Database.Migrate();`).

## Tooling
Install or upgrade the EF Core CLI tools to match runtime (8.0.x):
```
dotnet tool uninstall --global dotnet-ef || true
dotnet tool install --global dotnet-ef --version 8.0.8
```

## Creating a Migration
After changing domain classes or `AppDbContext`:
```
# From repo root
dotnet ef migrations add MeaningfulName --project backend/src/BiteTrack.Data --startup-project backend/src/BiteTrack.Api
```
Commit the generated files under `backend/src/BiteTrack.Data/Migrations/`.

## Applying Migrations
Automatically applied on app startup via `Migrate()`. You can also apply manually:
```
dotnet ef database update --project backend/src/BiteTrack.Data --startup-project backend/src/BiteTrack.Api
```

## Development vs Production
Development uses the `sqlserver` container from `docker-compose.yml`. The API constructs a connection string from `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` if `DB_CONNECTION` is not provided. For production / Azure, set `DB_CONNECTION` to the full Azure SQL connection string (or use Managed Identity in the future).

To recreate the dev database from scratch:
1. Stop containers (`docker compose down -v` to remove the volume if you want a fresh DB)
2. Start again (`docker compose up -d sqlserver` then the API) – migrations will apply automatically.

To inspect the dev DB (example using sqlcmd inside container):
```
docker exec -it <container_name_for_sqlserver> /opt/mssql-tools/bin/sqlcmd -S localhost -U sa -P Your_strong_password123 -Q "SELECT name FROM sys.tables"
```

## Adding Future Changes
Repeat the create/apply steps (no manual intervention needed after baseline).

## Troubleshooting
- Mismatch Tool Version: Upgrade `dotnet-ef` (see tooling section).
- Connection refused: Ensure SQL container is healthy before API starts (compose has healthcheck).
- Login failed for user: Confirm `DB_USER` / `DB_PASSWORD` match compose env.
- Rollback last migration:
  ```
  dotnet ef migrations remove --project backend/src/BiteTrack.Data --startup-project backend/src/BiteTrack.Api
  ```
  (Only if it is the latest and not applied to important environments.)

