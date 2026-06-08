<p align="center">
  <img src="frontend/public/camerahub-logo.png" alt="CameraHub logo" width="108">
</p>

<h1 align="center">CameraHub</h1>

<p align="center">一个基于 Next.js、FastAPI、SQLite 和本地文件存储的自托管摄影器材与拍摄归档系统。</p>

<p align="center">
  <a href="./README.md">English</a>
</p>

## 项目简介

CameraHub 是一个本地优先的摄影管理系统，当前支持：

- 相机、镜头、胶片、配件管理
- 器材图片上传、封面和缩略图展示
- 拍摄事项与关联图片归档
- 资产概览与统计图表

存储方式保持简单：

- 数据库：SQLite
- 图片：本地 `uploads/`
- 部署：GHCR 镜像 + Docker Compose

## 技术栈

- 前端：Next.js App Router、TypeScript、Tailwind CSS、shadcn/ui、ECharts
- 后端：FastAPI、SQLModel、SQLite、Pillow、uv、Uvicorn
- 部署：GitHub Actions、GHCR、Docker Compose

## 目录结构

```text
backend/
  app/
frontend/
  src/
data/
uploads/
docs/
```

## 本地开发

先启动后端，再启动前端。

### 后端

当前工作区可能不允许在 `backend/.venv` 中创建有效虚拟环境，建议使用项目外的 uv 环境：

```bash
cd backend
UV_PROJECT_ENVIRONMENT="$HOME/.venvs/camerahub-backend" uv sync
UV_PROJECT_ENVIRONMENT="$HOME/.venvs/camerahub-backend" uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

健康检查：

```text
http://localhost:8000/api/health
```

### 前端

```bash
cd frontend
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run dev
```

访问地址：

```text
http://localhost:3010
```

如果通过局域网其他机器访问，请把 `NEXT_PUBLIC_API_BASE_URL` 改成后端所在主机的 IP 和端口。

## 版本与发布

CameraHub 当前采用前后端统一版本号。

版本文件：

- [backend/pyproject.toml](backend/pyproject.toml)
- [frontend/package.json](frontend/package.json)

正式版本来源：

- Git tag：`v0.1.0`
- GHCR 镜像 tag：`0.1.0`

每个镜像 package 应保留这些 tag：

```text
latest
sha-<commit>
0.1.0
0.1
```

注意：

- `latest` 表示当前默认最新镜像，不适合精确部署
- 生产部署应优先使用固定版本，例如 `0.1.0`
- GitHub Packages 中的版本号体现在镜像 tag，而不是分支名

## GitHub 发布流程

`docker-publish` 仍然采用 GitHub Actions **手动触发** 的方式。

推荐发布顺序：

1. 更新代码并确认 `backend/pyproject.toml` 和 `frontend/package.json` 中的版本号
2. 提交并 push 到 `main`
3. 创建并 push 对应的 Git tag，例如 `v0.1.0`
4. 打开 GitHub Actions，手动运行 `docker-publish`
5. 等待 GHCR 镜像发布完成
6. 创建或补充对应的 GitHub Release

示例命令：

```bash
git add .
git commit -m "prepare release 0.1.0"
git push origin main
git tag v0.1.0
git push origin v0.1.0
```

当前 workflow 行为：

- 支持 `workflow_dispatch` 手动触发
- 支持 `push.tags: v*` tag 触发
- 同时发布 backend 和 frontend 两个 GHCR 镜像

## 已有 Package 如何体现 0.1.0

如果当前 GHCR package 里只有 `latest` 或 `sha-...`，不能直接在 GitHub 上把它改名成 `0.1.0`。

正确做法是：

1. 确认当前仓库状态对应 `0.1.0`
2. 确认两个版本文件都是 `0.1.0`
3. push `v0.1.0`
4. 运行 `docker-publish`
5. 重新把同一套镜像以新 tag 发布：

```text
ghcr.io/jim-git-2000/camerahub-backend:0.1.0
ghcr.io/jim-git-2000/camerahub-frontend:0.1.0
```

完成后，同一个 package 下应能看到：

```text
latest
sha-xxxxxxx
0.1.0
0.1
```

## Docker 部署

开发机不需要安装 Docker，只负责准备代码并触发 GitHub 发布。

服务器需要：

- Docker
- Docker Compose plugin
- 一个包含 `docker-compose.yml`、`.env`、`data/` 和 `uploads/` 的部署目录

服务器最小目录结构：

```text
camerahub/
  docker-compose.yml
  .env
  data/
  uploads/
```

部署 `.env` 示例：

```env
CAMERAHUB_VERSION=0.1.0
```

### `docker-compose.yml` 内容

服务器上可直接使用下面的文件：

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

说明：

- backend 默认不直接暴露到宿主机
- frontend 默认通过宿主机 `3010` 对外提供访问
- SQLite 数据和上传图片都保留在宿主机挂载目录中
- `CAMERAHUB_VERSION` 用于控制拉取哪个 GHCR 版本

### Docker Compose 操作步骤

服务器首次部署：

```bash
mkdir -p camerahub/data camerahub/uploads
cd camerahub
```

创建 `.env`：

```env
CAMERAHUB_VERSION=0.1.0
```

创建 `docker-compose.yml` 后执行：

```bash
docker compose pull
docker compose up -d
```

升级或重新启动：

```bash
docker compose pull
docker compose up -d
```

查看状态：

```bash
docker compose ps
```

查看日志：

```bash
docker compose logs -f
```

重启服务：

```bash
docker compose restart
```

停止服务：

```bash
docker compose down
```

默认访问地址：

```text
http://服务器IP:3010
```

当前 compose 文件解析出的镜像为：

```text
ghcr.io/jim-git-2000/camerahub-backend:${CAMERAHUB_VERSION:-latest}
ghcr.io/jim-git-2000/camerahub-frontend:${CAMERAHUB_VERSION:-latest}
```

含义：

- 不设置 `CAMERAHUB_VERSION`：部署 `latest`
- 设置 `CAMERAHUB_VERSION=0.1.0`：部署正式版本 `0.1.0`

## 回滚

如果要从 `0.2.0` 回滚到 `0.1.0`，修改服务器 `.env`：

```env
CAMERAHUB_VERSION=0.1.0
```

然后执行：

```bash
docker compose pull
docker compose up -d
```

## 环境变量

复制模板：

```bash
cp .env.example .env
```

常用变量：

```env
CAMERAHUB_VERSION=0.1.0
DATABASE_URL=sqlite:///./data/gear.db
UPLOAD_DIR=./uploads
BACKEND_CORS_ORIGINS=http://localhost:3010,http://127.0.0.1:3010,http://192.168.32.123:3010
APP_NAME=CameraHub
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

说明：

- `CAMERAHUB_VERSION` 主要用于服务器侧 Docker Compose 部署
- 本地开发仍然可以继续使用前后端分开启动的方式

## 数据与图片

默认数据库文件：

```text
data/gear.db
```

默认上传目录：

```text
uploads/
```

数据库保存相对路径，上传图片通过后端 `/uploads/...` 提供访问。

## 备份

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

### `backend/.venv` 不是有效 Python 环境

```bash
cd backend
rm -rf .venv
UV_PROJECT_ENVIRONMENT="$HOME/.venvs/camerahub-backend" uv sync
```

### 前端显示 `API error` 或 `Failed to fetch`

请检查：

- backend 是否运行在 `8000`
- `NEXT_PUBLIC_API_BASE_URL` 是否指向正确地址
- 如果浏览器直接访问 backend，`BACKEND_CORS_ORIGINS` 是否包含前端实际访问地址

### `/api/stats/summary` 返回 `404`

通常是后端进程仍是旧版本，重启后端即可。

### 图片上传失败

当前支持的图片格式：

```text
jpg
jpeg
png
webp
```

当前单张图片大小限制：

```text
10MB
```

## 文档

- API 文档：[docs/api.md](docs/api.md)
- 数据库文档：[docs/database.md](docs/database.md)
