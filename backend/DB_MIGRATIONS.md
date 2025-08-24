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

## Existing Dev Databases (Pre-Migration)
Previously the app used `EnsureCreated()`; existing SQLite DBs lack a migrations history table. First migration (which creates all tables) will fail with errors like `table "Users" already exists`.

### Option A (Recommended for dev): Reset DB
If you don't need existing data:
1. Stop the running API.
2. Delete the SQLite file (default path: `backend/src/BiteTrack.Api/bin/Debug/net8.0/bitetrack.db` or wherever `DB_PATH` points).
3. Run the app (or `dotnet ef database update`) to create schema via the migration.

### Option B: Preserve Data (Manual Baseline)
1. Backup DB file.
2. Create migrations history table and register the existing schema as baseline:
   ```
   sqlite3 path/to/bitetrack.db <<'SQL'
   CREATE TABLE IF NOT EXISTS __EFMigrationsHistory (
     MigrationId TEXT NOT NULL PRIMARY KEY,
     ProductVersion TEXT NOT NULL
   );
   INSERT OR IGNORE INTO __EFMigrationsHistory (MigrationId, ProductVersion)
     VALUES ('20250824161239_AddUserGoal', '8.0.8');
   SQL
   ```
   (Only do this if the current schema already matches everything in the migration except the new table.)
3. If `UserGoals` table does not exist, create it:
   ```
   sqlite3 path/to/bitetrack.db "CREATE TABLE IF NOT EXISTS UserGoals (Id TEXT PRIMARY KEY NOT NULL, UserId TEXT NOT NULL, Calories INTEGER NOT NULL, Protein REAL NOT NULL, Carbs REAL NOT NULL, Fat REAL NOT NULL, UpdatedAtUtc TEXT NOT NULL, CONSTRAINT FK_UserGoals_Users_UserId FOREIGN KEY (UserId) REFERENCES Users (Id) ON DELETE CASCADE); CREATE UNIQUE INDEX IF NOT EXISTS IX_UserGoals_UserId ON UserGoals(UserId);"
   ```
4. Start the app; EF should see the migration entry and not attempt to recreate tables.

Use Option B only if you fully understand the implications; Option A is simpler during active development.

## Adding Future Changes
Repeat the create/apply steps (no manual intervention needed after baseline).

## Troubleshooting
- Mismatch Tool Version: Upgrade `dotnet-ef` (see tooling section).
- Locked DB File (Windows): Ensure no running process is using the `.db` file before deleting or modifying.
- Rollback last migration:
  ```
  dotnet ef migrations remove --project backend/src/BiteTrack.Data --startup-project backend/src/BiteTrack.Api
  ```
  (Only if it is the latest and not applied to important environments.)

