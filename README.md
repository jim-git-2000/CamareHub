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
- asset summary and statistics, including per-roll film valuation

Storage is intentionally simple:

- database: SQLite
- images: local `uploads/`
- deployment: GHCR images + Docker Compose

## Screenshots

### Light

#### Dashboard

![Dashboard Light](./Readme_pictures/概览light.png)

#### Items

![Items Light](./Readme_pictures/器材light.png)

#### Item Detail

![Item Detail Light](./Readme_pictures/器材详情页light.png)

#### Stats

![Stats Light](./Readme_pictures/统计light.png)

#### Photos

![Photos Light](./Readme_pictures/照片light.png)

#### Photo Detail

![Photo Detail Light](./Readme_pictures/照片详情页light.png)

#### Quote Settings

![Quote Settings Light](./Readme_pictures/一言设置light.png)

### Dark

#### Dashboard

![Dashboard Dark](./Readme_pictures/概览dark.png)

#### Items

![Items Dark](./Readme_pictures/器材dark.png)

#### Item Detail

![Item Detail Dark](./Readme_pictures/器材详情页dark.png)

#### Stats

![Stats Dark](./Readme_pictures/统计dark.png)

#### Photos

![Photos Dark](./Readme_pictures/照片ldark.png)

#### Photo Detail

![Photo Detail Dark](./Readme_pictures/照片详情页dark.png)

#### Quote Settings

![Quote Settings Dark](./Readme_pictures/一言设置dark.png)

## Mobile Adaptation

The current frontend has been adjusted for phone-sized screens with these rules:

- top navigation and header actions collapse into a compact mobile layout instead of keeping the desktop three-column header
- grids switch down to fewer columns, and dense cards are reduced to single-column stacking on small screens
- cards and content areas use width constraints such as `w-full`, `max-w-full`, and `min-w-0` to avoid horizontal overflow
- long text is truncated or wrapped where needed so titles, badges, and metadata do not push the layout wider than the viewport
- hover-only detail patterns keep mobile-safe fallback behavior, so tapping still goes to the detail page without depending on hover
- shooting entry cards, stats content, and form controls use smaller spacing and wrapped layouts so they remain usable on narrow screens

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

Requirements: Python 3.12+, uv, Node.js, and npm.

Start the backend:

```bash
cd backend
uv sync --frozen
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

If the repository is on a shared filesystem that does not support symbolic links (for example CIFS), keep uv's environment and cache on the local disk instead:

```bash
cd backend
export UV_PROJECT_ENVIRONMENT=/tmp/camerahub-backend-venv
export UV_CACHE_DIR=/tmp/camerahub-uv-cache
uv sync --frozen
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

In another terminal, start the frontend:

Install dependencies only after a fresh clone, a change to `frontend/package-lock.json`, or damage to `node_modules`:

```bash
cd frontend
npm ci
```

For normal daily startup, do not run `npm ci` again. Run:

```bash
cd frontend
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run dev
```

Open `http://localhost:3010`. Before committing frontend changes, run `npm run lint` and `npm run build`; validate backend syntax with `uv run python -m compileall app`.

### LAN access

When the backend runs with `--host 0.0.0.0`, the frontend already listens on all network interfaces. To access a server at `192.168.32.123` from another device on the LAN, start the frontend with the server IP as its API base URL. Do not use `localhost`, because the browser would resolve it to the device being used for access:

```bash
cd frontend
NEXT_PUBLIC_API_BASE_URL=http://192.168.32.123:8000 npm run dev
```

Then open `http://192.168.32.123:3010/`. If the page opens but no data loads, stop and restart the frontend with the command above.

## Docker Compose Deployment

CameraHub can be deployed by pulling prebuilt GHCR images with Docker Compose. The server needs:

- Docker
- Docker Compose plugin
- a deployment directory with `docker-compose.yml`, `.env`, `data/`, `uploads/`, and `backups/`

### 1. Prepare the deployment directory

Create a dedicated directory on the server:

```bash
mkdir -p camerahub/data camerahub/uploads camerahub/backups
cd camerahub
```

Recommended directory layout:

```text
camerahub/
  docker-compose.yml
  .env
  data/
  uploads/
  backups/
```

`data/` stores the SQLite database and local settings. `uploads/` stores uploaded images. `backups/` stores automatic migration recovery points and operator backups. Keep all three directories when upgrading.

### 2. Create `.env`

Use a fixed version when you want repeatable deployment:

```env
CAMERAHUB_VERSION=0.3.0
```

You can also use `latest`, but a fixed version is easier to roll back:

```env
CAMERAHUB_VERSION=latest
```

### 3. Create `docker-compose.yml`

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
      BACKUP_DIR: /app/backups
      BACKEND_CORS_ORIGINS: http://localhost:3010,http://127.0.0.1:3010
    volumes:
      - ./data:/app/data
      - ./uploads:/app/uploads
      - ./backups:/app/backups

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
- uploaded files, SQLite data, local settings, and backups stay on the host through mounted volumes
- `CAMERAHUB_VERSION` controls which GHCR image version will be pulled

### 4. Pull and start

Pull images and start services:

```bash
docker compose pull
docker compose up -d
```

Open CameraHub in a browser:

```text
http://SERVER_IP:3010
```

For local testing on the server itself:

```text
http://localhost:3010
```

### 5. Check runtime status

Check containers:

```bash
docker compose ps
```

View logs:

```bash
docker compose logs -f
```

View only backend logs:

```bash
docker compose logs -f backend
```

View only frontend logs:

```bash
docker compose logs -f frontend
```

### 6. Upgrade

Edit `.env` if you want to switch versions:

```env
CAMERAHUB_VERSION=0.3.0
```

Then pull and recreate containers:

```bash
docker compose pull
docker compose up -d
```

Docker Compose keeps `./data` and `./uploads` because they are mounted host directories.

### 7. Roll back

Change `.env` back to the previous image version:

```env
CAMERAHUB_VERSION=0.1.0
```

Then run:

```bash
docker compose pull
docker compose up -d
```

### 8. Restart or stop

Restart services:

```bash
docker compose restart
```

Stop services without deleting data:

```bash
docker compose down
```

Stop services and remove unused pulled images only when you are sure they are no longer needed:

```bash
docker compose down
docker image prune
```

The compose file resolves images as:

```text
ghcr.io/jim-git-2000/camerahub-backend:${CAMERAHUB_VERSION:-latest}
ghcr.io/jim-git-2000/camerahub-frontend:${CAMERAHUB_VERSION:-latest}
```

This means:

- no `CAMERAHUB_VERSION` => deploy `latest`
- `CAMERAHUB_VERSION=0.3.0` => deploy release `0.3.0`

## Data and Images

Default database file:

```text
data/gear.db
```

Default upload directory:

```text
uploads/
```

The database stores relative paths. Uploaded files are served through backend `/uploads/...`.

### Backup

Create and verify one archive containing SQLite, quote settings, and all uploads:

```bash
cd backend
uv run python -m app.maintenance backup
```

For Docker deployment:

```bash
docker compose run --rm backend uv run python -m app.maintenance backup
```

The command writes a versioned ZIP archive to `backups/` with a manifest, SQLite schema metadata, file sizes, SHA-256 hashes, and a consistent SQLite snapshot. Verify an archive before moving or restoring it:

```bash
cd backend
uv run python -m app.maintenance verify ../backups/camerahub-backup-*.zip
```

Restore requires exclusive access. Stop both services first; the restore command creates another verified protection archive before replacing data and automatically rolls back to it if restoration fails:

```bash
docker compose stop frontend backend
docker compose run --rm backend uv run python -m app.maintenance restore /app/backups/camerahub-backup-YYYYMMDDTHHMMSSZ-ID.zip
docker compose up -d
docker compose ps
```

## Uploads

CameraHub stores uploaded images under `uploads/` and records relative paths in SQLite. Keep `uploads/` together with `data/gear.db` when migrating to another server.

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

If upload fails, check:

- the file format is supported
- the file size is within the limit
- the server has write permission for `./uploads`
- the backend container is running: `docker compose ps`

Uploaded images are available through paths like:

```text
/uploads/...
```
