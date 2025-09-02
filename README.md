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
| `DB_CONNECTION` | (Production/Azure) Full SQL Server connection string (overrides individual DB_* vars) |
| `DB_HOST` | SQL Server host (dev defaults to `sqlserver`) |
| `DB_NAME` | Database name (default `BiteTrack`) |
| `DB_USER` | SQL auth user (default `sa` for dev) |
| `DB_PASSWORD` | SQL auth password (match docker-compose SA password in dev) |
| `PHOTO_STORAGE_ROOT` | Directory for stored photos (defaults to ./photos) |
| `AOAI_ENDPOINT` | Azure OpenAI endpoint URL |
| `AOAI_API_KEY` | Azure OpenAI key (local dev only) |
| `AOAI_DEPLOYMENT` | Deployment name (e.g. gpt-4o) |
| `INVITE_CODE` | Optional: If set, registration requires matching invitation code |
| `DB_INIT_SECRET` | Secret token required to trigger `?create=yes` on `/health/ready` (dev safeguard) |

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
Visit: Frontend http://localhost:5173 | Swagger http://localhost:5087/swagger | SQL Server localhost,14333

### Register & Use
1. Register: POST /api/auth/register (or via UI Login -> switch to register)
2. Upload meal image (Add Meal page)
3. Dashboard updates as statuses change from Processing -> Ready

## Azure OpenAI Setup
Deploy a vision-capable `gpt-4o` or successor in region `swedencentral`. Provide `AOAI_ENDPOINT` and `AOAI_API_KEY` locally. Future enhancement: use Managed Identity + Key Vault.

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
Proprietary (add license details as needed)
