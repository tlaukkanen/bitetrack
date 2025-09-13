# BiteTrack

Food macro tracking app with .NET 8 Web API backend & React (Vite + TS) frontend. Supports photo upload -> async AI macro estimation via Azure OpenAI (gpt-4o). Mobile-first responsive UI.

## Features (MVP)
- User registration & JWT auth
- Upload meal photo (multipart)
- Async background processing (in-memory queue) calling Azure OpenAI
- Macro + calories estimation stored per meal + daily summary endpoint
- React dashboard with polling & live macro totals

## Tech Stack
- Backend: .NET 8 Minimal API, EF Core (SQL Server) | Projects: Api, Data, Domain, Processing
- Frontend: React 18, Vite, TypeScript, Tailwind, React Query
- AI: Azure OpenAI (gpt-4o) vision (requires proper model deployment)
- Containerization: Docker + docker-compose

## Environment Variables (Backend)
| Name | Description |
|------|-------------|
| `JWT_SECRET` | Secret for signing JWTs |
| `ConnectionStrings__Default` | Full SQL Server connection string (preferred if set) |
| `DB_CONNECTION` | Full SQL Server connection string (fallback if `ConnectionStrings__Default` not provided) |
| `DB_HOST` | SQL Server host (dev defaults to `sqlserver`) |
| `DB_NAME` | Database name (default `BiteTrack`) |
| `DB_USER` | SQL auth user (default `sa` for dev) |
| `DB_PASSWORD` | SQL auth password (match docker-compose SA password in dev) |
| `PHOTO_STORAGE_ROOT` | Directory for stored photos (defaults to `AppContext.BaseDirectory/photos`; in Docker it’s `/app/photos`) |
| `AOAI_ENDPOINT` | Azure OpenAI endpoint URL |
| `AOAI_API_KEY` | Azure OpenAI key (optional if using AAD/Managed Identity) |
| `AOAI_DEPLOYMENT` | Deployment name (e.g. `gpt-4o`) |
| `INVITE_CODE` | Optional: If set, registration requires matching invitation code |
| `DB_INIT_SECRET` | Secret token required to trigger `?create=yes` on `/health/ready` (dev safeguard) |
| `PHOTOS_STORAGE_ACCOUNT_NAME` | If set with KEY, use Azure Blob Storage for photos |
| `PHOTOS_STORAGE_ACCOUNT_KEY` | Storage key; presence switches from local storage to Blob |
| `PHOTOS_STORAGE_ACCOUNT_CONTAINER` | Blob container name (default `photos`) |

## Local Development

### Prerequisites
- .NET 8 SDK
- Node 20+
- (Optional) Docker / Docker Compose

### Run with separate processes
```bash
# Backend
cd backend
dotnet restore
dotnet run --project src/BiteTrack.Api

# Frontend (new shell)
cd frontend
npm install
npm run dev
```
Frontend dev server proxies API calls to `http://localhost:5087`.

### Run with Docker Compose (API + SQL Server)
```bash
docker compose up --build
```
Visit: Frontend http://localhost:5173 | Swagger http://localhost:5087/swagger | SQL Server localhost,1433

### Using VS Code tasks
- `dev:all`: starts backend watch, frontend dev server, and opens the browser.
- `watch`: backend hot-reload (`dotnet watch run`).
- `frontend:dev:background`: Vite dev server on port 5173 with `/api` proxy to 5087.

### Ports
- Dev: API `http://localhost:5087` (see `launchSettings.json`), Frontend dev server `http://localhost:5173` (Vite proxy to API).
- Docker: API listens on `8080` in-container and is mapped to host `5087` by compose. The SPA static build is served by the API with client-side routing fallback.

### Register & Use
1. Register: POST /api/auth/register (or via UI Login -> switch to register)
2. Upload meal image (Add Meal page)
3. Dashboard updates as statuses change from Processing -> Ready

## Azure OpenAI Setup
Deploy a vision-capable `gpt-4o` or successor in region `swedencentral`. Provide `AOAI_ENDPOINT` and either:
- `AOAI_API_KEY` for key-based auth; or
- no key and authenticate via Azure AD using DefaultAzureCredential (e.g., Managed Identity in Azure, or developer login locally).

Set `AOAI_DEPLOYMENT` to your deployed model name (e.g., `gpt-4o`).

The app supports both key and AAD-based auth today; consider moving keys to Key Vault for production.

## Database readiness and init
- Readiness: `GET /health/ready` checks DB connectivity and migration state.
- Guarded init (Development safe-path): set `DB_INIT_SECRET`, then call:

```bash
curl "http://localhost:5087/health/ready?create=yes&secret=YOUR_SECRET"
```

Behavior: applies pending EF migrations if any. In Development with no compiled migrations, falls back to `EnsureCreated()`.

## Example environment files

Local development (.env example):

```bash
JWT_SECRET=change-me
AOAI_ENDPOINT=https://<your-aoai>.openai.azure.com/
AOAI_API_KEY=<optional if using AAD>
AOAI_DEPLOYMENT=gpt-4o
DB_HOST=localhost,1433
DB_NAME=BiteTrack
DB_USER=sa
DB_PASSWORD=Your_strong_password123
PHOTO_STORAGE_ROOT=./photos
INVITE_CODE=devinvite
DB_INIT_SECRET=dev-init-token
```

Use Azure Blob for photos (switches storage provider):

```bash
PHOTOS_STORAGE_ACCOUNT_NAME=<name>
PHOTOS_STORAGE_ACCOUNT_KEY=<key>
PHOTOS_STORAGE_ACCOUNT_CONTAINER=photos
```

## Roadmap
- Replace in-memory queue with Azure Storage Queue
- Blob Storage for photos
- Managed Identity auth for Azure OpenAI
- Infrastructure as Code (Terraform) + CI/CD
- Error resilience (retry & circuit breaker)
- Manual meal item correction endpoint
- PWA offline meal capture queue

## Security Notes
- JWT secret must be strong & rotated
- Do not commit real API keys
- Add rate limiting & input validation for production

## License
Proprietary

Copyright 2025 Tommi Laukkanen