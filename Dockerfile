# Unified multi-stage build for BiteTrack (frontend + backend)
# 1. Build frontend (Vite/React) -> dist assets
# 2. Publish backend (.NET 8) including copied frontend assets into wwwroot
# 3. Produce minimal final runtime image serving API + static SPA

# ---- Frontend build ----
FROM node:20-alpine AS frontend-build
WORKDIR /frontend
# Install deps (separate copy for better layer caching)
COPY frontend/package*.json ./
RUN npm install
# Copy source and build
COPY frontend/. ./
RUN npm run build:docker

# ---- Backend build/publish ----
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS backend-build
WORKDIR /src
# Copy backend source
COPY backend/. ./backend/
# Copy built frontend assets into API project wwwroot BEFORE publish so they are included.
# We build to a temporary dist then copy into the backend project path expected by the .NET publish.
COPY --from=frontend-build /frontend/dist/ ./backend/src/BiteTrack.Api/wwwroot/
# Restore & publish
RUN dotnet restore ./backend/BiteTrack.sln \
 && dotnet publish ./backend/BiteTrack.sln -c Release -o /app/publish /p:UseAppHost=false

# ---- Final runtime image ----
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
# Environment configuration
ENV ASPNETCORE_URLS=http://+:8080 \
    ASPNETCORE_ENVIRONMENT=Production \
    DB_PATH=/app/data/bitetrack.db \
    PHOTO_STORAGE_ROOT=/app/photos
# Copy published output
COPY --from=backend-build /app/publish .
# Create mount points for persistent data (optional but convenient)
VOLUME ["/app/data", "/app/photos"]
EXPOSE 8080
ENTRYPOINT ["dotnet", "BiteTrack.Api.dll"]
