<p align="center">
  <img src="frontend/public/camerahub-logo.png" alt="CameraHub logo" width="108">
</p>

<h1 align="center">CameraHub</h1>

<p align="center">A self-hosted photography gear and shooting archive built with Next.js, FastAPI, SQLite, and local file storage.</p>

<p align="center">
  <a href="./README_zh.md">简体中文</a>
</p>

## Overview

CameraHub is a local-first photography management system for:

- cameras, lenses, film, and accessories
- item photos and cover images
- shooting entries and related photos
- asset summary and statistics

Storage is intentionally simple:

- database: SQLite
- images: local `uploads/`
- deployment: GHCR images + Docker Compose

## Stack

- Frontend: Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, ECharts
- Backend: FastAPI, SQLModel, SQLite, Pillow, uv, Uvicorn
- Deployment: GitHub Actions, GHCR, Docker Compose

## Repository Layout

```text
backend/
  app/
frontend/
  src/
data/
uploads/
docs/
```

## Local Development

Start backend first, then frontend.

### Backend

The workspace may not allow a valid virtualenv inside `backend/.venv`. Use an external uv environment:

```bash
cd backend
UV_PROJECT_ENVIRONMENT="$HOME/.venvs/camerahub-backend" uv sync
UV_PROJECT_ENVIRONMENT="$HOME/.venvs/camerahub-backend" uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Health check:

```text
http://localhost:8000/api/health
```

### Frontend

```bash
cd frontend
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run dev
```

Open:

```text
http://localhost:3010
```

If you are accessing from another machine on the LAN, set `NEXT_PUBLIC_API_BASE_URL` to the backend host IP and port.

## Versioning and Releases

CameraHub uses one shared release version for both backend and frontend.

Current release files:

- [backend/pyproject.toml](backend/pyproject.toml)
- [frontend/package.json](frontend/package.json)

Release source of truth:

- Git tag: `v0.1.0`
- GHCR image tag: `0.1.0`

Each image package should expose tags like:

```text
latest
sha-<commit>
0.1.0
0.1
```

Important:

- `latest` is the newest default image, not a stable deployment target
- precise deployment should use a fixed version such as `0.1.0`
- GitHub Packages version visibility comes from image tags, not branch names

## GitHub Publish Flow

`docker-publish` remains a manual GitHub Actions workflow.

Recommended release flow:

1. Update code and confirm the release version in `backend/pyproject.toml` and `frontend/package.json`
2. Commit and push to `main`
3. Create and push a Git tag such as `v0.1.0`
4. Open GitHub Actions and manually run `docker-publish`
5. Wait for GHCR images to finish publishing
6. Create or update the matching GitHub Release

Commands:

```bash
git add .
git commit -m "prepare release 0.1.0"
git push origin main
git tag v0.1.0
git push origin v0.1.0
```

Current workflow behavior:

- manual trigger via `workflow_dispatch`
- tag trigger via `push.tags: v*`
- pushes backend and frontend images to GHCR

## Existing Package to 0.1.0

If the existing GHCR package only has `latest` or `sha-...`, it cannot be renamed in place to `0.1.0`.

The correct process is:

1. Make sure the repo state corresponds to release `0.1.0`
2. Make sure both version files are `0.1.0`
3. Push tag `v0.1.0`
4. Run `docker-publish`
5. Publish the same images again with the new GHCR tags:

```text
ghcr.io/jim-git-2000/camerahub-backend:0.1.0
ghcr.io/jim-git-2000/camerahub-frontend:0.1.0
```

After that, the same package should show multiple tags under one package:

```text
latest
sha-xxxxxxx
0.1.0
0.1
```

## Docker Deployment

The development machine does not need Docker. It only prepares code and triggers GitHub publishing.

The server needs:

- Docker
- Docker Compose plugin
- a deployment directory with `docker-compose.yml`, `.env`, `data/`, and `uploads/`

Minimal server layout:

```text
camerahub/
  docker-compose.yml
  .env
  data/
  uploads/
```

Example `.env` for deployment:

```env
CAMERAHUB_VERSION=0.1.0
```

### `docker-compose.yml` content

Use this file on the server:

```yaml
services:
  backend:
    image: ghcr.io/jim-git-2000/camerahub-backend:${CAMERAHUB_VERSION:-latest}
    restart: unless-stopped
    environment:
      APP_NAME: CameraHub
      DATABASE_URL: sqlite:////app/data/gear.db
      UPLOAD_DIR: /app/uploads
      BACKEND_CORS_ORIGINS: http://localhost:3010,http://127.0.0.1:3010
    volumes:
      - ./data:/app/data
      - ./uploads:/app/uploads

  frontend:
    image: ghcr.io/jim-git-2000/camerahub-frontend:${CAMERAHUB_VERSION:-latest}
    restart: unless-stopped
    depends_on:
      - backend
    ports:
      - "3010:3010"
```

Notes:

- backend is not exposed to the public host by default
- frontend is exposed on host port `3010`
- uploaded files and SQLite data stay on the host through mounted volumes
- `CAMERAHUB_VERSION` controls which GHCR image version will be pulled

### Docker Compose operations

First deployment on the server:

```bash
mkdir -p camerahub/data camerahub/uploads
cd camerahub
```

Create `.env`:

```env
CAMERAHUB_VERSION=0.1.0
```

Create `docker-compose.yml`, then run:

```bash
docker compose pull
docker compose up -d
```

Start or upgrade:

```bash
docker compose pull
docker compose up -d
```

Check status:

```bash
docker compose ps
```

View logs:

```bash
docker compose logs -f
```

Restart services:

```bash
docker compose restart
```

Stop services:

```bash
docker compose down
```

Default access:

```text
http://SERVER_IP:3010
```

Current compose file resolves images as:

```text
ghcr.io/jim-git-2000/camerahub-backend:${CAMERAHUB_VERSION:-latest}
ghcr.io/jim-git-2000/camerahub-frontend:${CAMERAHUB_VERSION:-latest}
```

This means:

- no `CAMERAHUB_VERSION` => deploy `latest`
- `CAMERAHUB_VERSION=0.1.0` => deploy release `0.1.0`

## Rollback

To roll back from `0.2.0` to `0.1.0`, edit server `.env`:

```env
CAMERAHUB_VERSION=0.1.0
```

Then run:

```bash
docker compose pull
docker compose up -d
```

## Environment Variables

Copy the template:

```bash
cp .env.example .env
```

Common variables:

```env
CAMERAHUB_VERSION=0.1.0
DATABASE_URL=sqlite:///./data/gear.db
UPLOAD_DIR=./uploads
BACKEND_CORS_ORIGINS=http://localhost:3010,http://127.0.0.1:3010,http://192.168.32.123:3010
APP_NAME=CameraHub
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

Notes:

- `CAMERAHUB_VERSION` is mainly used by server-side Docker Compose deployment
- local development can keep using direct frontend/backend startup commands

## Data and Uploads

Default database file:

```text
data/gear.db
```

Default upload directory:

```text
uploads/
```

The database stores relative paths. Uploaded files are served through backend `/uploads/...`.

## Backup

Backup database:

```bash
mkdir -p backups
cp data/gear.db backups/gear-$(date +%Y%m%d).db
```

Backup uploads:

```bash
mkdir -p backups
tar -czf backups/uploads-$(date +%Y%m%d).tar.gz uploads/
```

Restore database:

```bash
cp backups/gear-YYYYMMDD.db data/gear.db
```

Restore uploads:

```bash
tar -xzf backups/uploads-YYYYMMDD.tar.gz
```

## Troubleshooting

### `backend/.venv` is not a valid Python environment

```bash
cd backend
rm -rf .venv
UV_PROJECT_ENVIRONMENT="$HOME/.venvs/camerahub-backend" uv sync
```

### Frontend shows `API error` or `Failed to fetch`

Check:

- backend is running on port `8000`
- `NEXT_PUBLIC_API_BASE_URL` points to the correct backend address
- `BACKEND_CORS_ORIGINS` includes the actual frontend origin when calling backend directly

### `/api/stats/summary` returns `404`

Usually the backend process is outdated. Restart the backend service.

### Upload fails

Supported image formats:

```text
jpg
jpeg
png
webp
```

Current per-file limit:

```text
10MB
```

## Docs

- API docs: [docs/api.md](docs/api.md)
- Database docs: [docs/database.md](docs/database.md)
