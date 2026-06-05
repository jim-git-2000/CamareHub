# CameraHub

## 项目介绍

CameraHub 是一个本地运行的个人摄影器材管理系统，用于管理相机、镜头、胶片、配件、器材图片、购买/维修/出售记录和基础统计图表。

## 技术栈

- Frontend: Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, ECharts
- Backend: Python, FastAPI, SQLModel, SQLite, uv, Uvicorn
- Storage: SQLite database and local uploads directory

未引入 Docker、PWA、PostgreSQL、Redis、MinIO。

## 目录结构

```text
backend/
  app/
    core/
    routers/
    crud.py
    database.py
    main.py
    models.py
    schemas.py
frontend/
  src/
    app/
    components/
    lib/
    types/
data/
uploads/
docs/
```

## 本地开发启动方式

先启动后端，再启动前端。

### 后端启动方式

当前工作区可能不允许在 `backend/.venv` 内创建 Python 虚拟环境需要的符号链接。后端运行 `uv` 命令时，统一带上 `UV_PROJECT_ENVIRONMENT="$HOME/.venvs/camerahub-backend"`。

```bash
cd backend
UV_PROJECT_ENVIRONMENT="$HOME/.venvs/camerahub-backend" uv sync
UV_PROJECT_ENVIRONMENT="$HOME/.venvs/camerahub-backend" uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

健康检查：

```text
http://localhost:8000/api/health
```

### 前端启动方式

```bash
cd frontend
NEXT_PUBLIC_API_BASE_URL=http://192.168.32.123:8000 npm run dev
```

访问：

```text
http://192.168.32.123:3010
```

如果只在虚拟机本机浏览器访问，也可以把 API 地址设为 `http://localhost:8000` 并访问 `http://localhost:3010`。

## 环境变量

可从 `.env.example` 复制：

```bash
cp .env.example .env
```

常用变量：

```env
DATABASE_URL=sqlite:///./data/gear.db
UPLOAD_DIR=./uploads
BACKEND_CORS_ORIGINS=http://localhost:3010,http://127.0.0.1:3010,http://192.168.32.123:3010
APP_NAME=CameraHub
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

## 数据库位置

默认数据库文件：

```text
data/gear.db
```

SQLite 数据库由后端启动时自动创建表结构。

## 图片位置

上传图片默认保存在：

```text
uploads/
```

数据库中保存相对路径，前端通过后端 `/uploads/...` 静态路径访问图片。

## 备份方式

备份数据库：

```bash
mkdir -p backups
cp data/gear.db backups/gear-$(date +%Y%m%d).db
```

备份图片：

```bash
mkdir -p backups
tar -czf backups/uploads-$(date +%Y%m%d).tar.gz uploads/
```

恢复数据库：

```bash
cp backups/gear-YYYYMMDD.db data/gear.db
```

恢复图片：

```bash
tar -xzf backups/uploads-YYYYMMDD.tar.gz
```

## 常见问题

### uv 提示 backend/.venv 不是有效 Python 环境

删除坏的 `.venv`，并使用项目外虚拟环境：

```bash
cd backend
rm -rf .venv
UV_PROJECT_ENVIRONMENT="$HOME/.venvs/camerahub-backend" uv sync
```

### 前端显示 API error / Failed to fetch

检查：

- 后端是否已启动在 `8000`。
- 前端 `NEXT_PUBLIC_API_BASE_URL` 是否指向正确 IP。
- 后端 `BACKEND_CORS_ORIGINS` 是否包含当前前端地址，例如 `http://192.168.32.123:3010`。

### /api/stats/summary 404

任务 14 已实现 stats API。若仍然 404，通常是后端进程未重启，重启后端即可。

### 图片上传失败

仅支持 `jpg`、`jpeg`、`png`、`webp`，单张图片最大 `10MB`。

## 文档

- API 文档：[docs/api.md](docs/api.md)
- 数据库文档：[docs/database.md](docs/database.md)
