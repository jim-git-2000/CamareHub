# CameraHub Docker 1 分步骤计划

## 0. 总目标

把 CameraHub 做成可以通过 GHCR 镜像直接拉取运行的 Docker 部署方式。

最终使用方式：

```bash
docker compose pull
docker compose up -d
```

核心约束：

- 开发机不需要安装 Docker。
- 开发机只负责改代码、提交、push 到 GitHub。
- push 到 GitHub 后不自动构建镜像。
- 镜像构建只通过 GitHub Actions 手动触发。
- 服务器不需要 clone 整个仓库。
- 服务器只需要一份 `docker-compose.yml`。
- 服务器不执行 `docker compose build`。
- 服务器不需要安装 Node、Python、uv、pnpm。
- 不把 `192.168.32.123` 或任何开发机 IP 写死进镜像。

---

## 1. 整体流程

```text
本地创建 Docker/GHCR 配置
    ↓
提交并 push 到 GitHub
    ↓
在 GitHub Actions 页面手动 Run workflow
    ↓
GitHub Actions 构建前端、后端镜像
    ↓
镜像推送到 GHCR
    ↓
服务器准备 docker-compose.yml
    ↓
服务器执行 docker compose pull
    ↓
服务器执行 docker compose up -d
    ↓
浏览器访问 http://服务器IP:宿主机端口
```

阶段划分：

```text
阶段 A：push 前，本地仓库准备 Docker/GHCR 配置
阶段 B：push 后，手动发布 GHCR 镜像指南
阶段 C：服务器只用 compose 文件运行指南
阶段 D：端到端验收指南
```

---

## 2. 技术方案

### 2.1 容器拆分

使用两个容器：

```text
backend   FastAPI / Uvicorn / SQLite / uploads
frontend  Next.js production server
```

原因：

- 当前项目本身就是前后端分离。
- 双容器更容易看日志和定位问题。
- 后续如果要替换数据库或增加反向代理，不需要重写部署结构。

---

### 2.2 浏览器访问方式

浏览器只访问前端：

```text
http://服务器IP:3010
```

如果宿主机端口改为 `8080`，则访问：

```text
http://服务器IP:8080
```

前端负责代理：

```text
/api/*      -> http://backend:8000/api/*
/uploads/*  -> http://backend:8000/uploads/*
```

这样可以避免：

- 前端镜像写死后端 IP。
- 换服务器后重新构建前端。
- 浏览器跨域请求后端。
- CORS 配置依赖某个固定服务器 IP。

---

### 2.3 端口规则

容器内部端口固定：

```text
frontend container: 3010
backend container: 8000
```

宿主机端口可以自定义：

```yaml
ports:
  - "3010:3010"
```

含义：

```text
宿主机 3010 -> 前端容器 3010
```

如果服务器 `3010` 被占用，可以改为：

```yaml
ports:
  - "8080:3010"
```

访问地址变为：

```text
http://服务器IP:8080
```

后端端口默认不暴露给宿主机。

如需临时调试后端 API，可临时增加：

```yaml
ports:
  - "8000:8000"
```

正常使用时不需要。

---

## 3. 阶段 A：push 前，本地仓库准备

这些内容都在本地仓库完成，完成后再提交并 push。

阶段 A 分三部分执行：

```text
A1：容器基础文件
A2：前端同源代理改造
A3：发布与部署配置
```

---

### A1：容器基础文件

#### A1.1 新增 `.dockerignore`

新增文件：

```text
.dockerignore
```

必须排除：

```text
.git
.github
frontend/node_modules
frontend/.next
backend/.venv
__pycache__
.pytest_cache
.mypy_cache
.ruff_cache
data
uploads
backups
*.db
*.sqlite
*.log
```

要求：

- 数据库不进入镜像。
- 上传图片不进入镜像。
- 前端构建产物不进入构建上下文。
- 本地依赖目录不进入构建上下文。

验收：

- `.dockerignore` 存在。
- `data/`、`uploads/`、`frontend/node_modules`、`frontend/.next` 都被排除。

#### A1.2 新增后端 Dockerfile

新增文件：

```text
backend/Dockerfile
```

要求：

- 使用 `python:3.12-slim`。
- 安装 `uv`。
- 复制 `pyproject.toml` 和 `uv.lock`。
- 安装后端依赖。
- 复制 `app/`。
- 工作目录使用 `/app`。
- 容器内部监听 `8000`。
- 启动 FastAPI：

```bash
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
```

后端容器默认环境变量：

```env
APP_NAME=CameraHub
DATABASE_URL=sqlite:////app/data/gear.db
UPLOAD_DIR=/app/uploads
BACKEND_CORS_ORIGINS=http://localhost:3010,http://127.0.0.1:3010
```

说明：

- Docker 生产访问主要走前端同源代理。
- `BACKEND_CORS_ORIGINS` 保留给本机调试和直接访问后端时使用。
- 不写死开发机 IP。

验收：

- Dockerfile 不复制 `data/`、`uploads/`。
- 后端启动命令监听 `0.0.0.0:8000`。
- SQLite 路径指向 `/app/data/gear.db`。
- 上传目录指向 `/app/uploads`。

#### A1.3 新增前端 Dockerfile

新增文件：

```text
frontend/Dockerfile
```

要求：

- 使用多阶段构建。
- 基础镜像建议 `node:22-slim`。
- 构建阶段执行：

```bash
npm run build
```

- 运行阶段执行：

```bash
npm run start -- --hostname 0.0.0.0 --port 3010
```

要求：

- 前端容器内部端口固定为 `3010`。
- 不把 `NEXT_PUBLIC_API_BASE_URL=http://192.168.32.123:8000` 写进镜像。
- 不把任何服务器 IP 写进镜像。
- 前端生产默认通过相对路径请求 `/api` 和 `/uploads`。

验收：

- Dockerfile 使用多阶段构建。
- runner 阶段不包含完整开发依赖缓存。
- 启动命令监听 `0.0.0.0:3010`。

---

### A2：前端同源代理改造

#### A2.1 修改前端 API 默认地址策略

当前前端默认：

```ts
http://localhost:8000
```

Docker 化后默认应改为同源相对路径。

目标行为：

```text
NEXT_PUBLIC_API_BASE_URL 未设置 -> ""
apiRequest("/api/health")       -> /api/health
图片 /uploads/...               -> /uploads/...
```

保留本地开发覆盖方式：

```bash
NEXT_PUBLIC_API_BASE_URL=http://192.168.32.123:8000 npm run dev
```

要求：

- 不破坏当前本地开发方式。
- Docker 生产环境不需要配置服务器 IP。
- 浏览器 Network 中 API 请求应显示为 `http://服务器IP:宿主机端口/api/...`。

验收：

- 未设置 `NEXT_PUBLIC_API_BASE_URL` 时，前端请求相对路径。
- 设置 `NEXT_PUBLIC_API_BASE_URL` 时，本地开发仍可直连独立后端。

#### A2.2 增加 Next.js rewrites 代理

修改文件：

```text
frontend/next.config.ts
```

新增代理：

```text
/api/:path*      -> http://backend:8000/api/:path*
/uploads/:path*  -> http://backend:8000/uploads/:path*
```

要求：

- `backend` 必须和 compose 中后端 service 名称一致。
- 浏览器访问前端的 `/api/*` 时，Next server 转发到后端容器。
- 浏览器访问前端的 `/uploads/*` 时，Next server 转发到后端容器。

验收：

- Docker 部署后 `http://服务器IP:端口/api/health` 能返回后端健康检查。
- Docker 部署后图片地址 `/uploads/...` 能正常显示。

---

### A3：发布与部署配置

#### A3.1 新增服务器版 `docker-compose.yml`

新增文件：

```text
docker-compose.yml
```

该文件面向服务器 pull-only 部署。

必须使用：

```yaml
image:
```

禁止使用：

```yaml
build:
```

服务名固定：

```text
backend
frontend
```

镜像名格式：

```text
ghcr.io/<github_user_or_org>/camerahub-backend:latest
ghcr.io/<github_user_or_org>/camerahub-frontend:latest
```

端口默认：

```yaml
frontend:
  ports:
    - "3010:3010"
```

后端默认不暴露端口。

数据挂载：

```yaml
backend:
  volumes:
    - ./data:/app/data
    - ./uploads:/app/uploads
```

依赖关系：

```yaml
frontend:
  depends_on:
    - backend
```

验收：

- `docker-compose.yml` 不包含 `build:`。
- `docker-compose.yml` 使用 GHCR `image:`。
- 前端映射默认是 `3010:3010`。
- 后端 `data` 和 `uploads` 挂载到宿主机当前目录。
- 可以通过修改左侧宿主机端口实现自定义访问端口，例如 `8080:3010`。

#### A3.2 新增手动触发的 GitHub Actions workflow

新增文件：

```text
.github/workflows/docker-publish.yml
```

只允许手动触发：

```yaml
on:
  workflow_dispatch:
```

不要配置：

```yaml
on:
  push:
```

构建并推送：

```text
backend/Dockerfile  -> ghcr.io/<github_user_or_org>/camerahub-backend
frontend/Dockerfile -> ghcr.io/<github_user_or_org>/camerahub-frontend
```

标签：

```text
latest
sha-<commit_sha>
```

权限：

```yaml
permissions:
  contents: read
  packages: write
```

认证：

- 使用 `GITHUB_TOKEN` 推送 GHCR。
- 私有仓库时，服务器拉取私有 GHCR 镜像需要先 `docker login ghcr.io`。

验收：

- push 到 GitHub 后不会自动执行 workflow。
- 只有手动点击 `Run workflow` 才构建镜像。
- workflow 构建 backend 和 frontend 两个镜像。
- workflow 推送 `latest` 和 `sha-...` 标签。

#### A3.3 更新 README Docker 部署说明

更新文件：

```text
README.md
```

新增 Docker 部署章节，必须说明：

- 开发机不需要 Docker。
- 服务器需要 Docker 和 Docker Compose plugin。
- 服务器不需要 clone 仓库。
- 服务器只需要一份 `docker-compose.yml`。
- 服务器不执行 build。
- 服务器启动命令：

```bash
docker compose pull
docker compose up -d
```

- 手动发布镜像步骤：

```text
1. push 代码到 GitHub。
2. 打开 GitHub Actions。
3. 选择 docker-publish。
4. 点击 Run workflow。
5. 等待 GHCR 镜像发布完成。
6. 服务器执行 docker compose pull && docker compose up -d。
```

- 服务器最小目录：

```text
camerahub/
  docker-compose.yml
  data/
  uploads/
```

- 自定义宿主机端口方式：

```yaml
ports:
  - "8080:3010"
```

- 备份：

```bash
tar -czf camerahub-backup-$(date +%Y%m%d).tar.gz data uploads
```

验收：

- README 中没有要求服务器 `git clone`。
- README 中没有要求服务器 `docker compose build`。
- README 中写清楚端口左侧可改、右侧容器端口保持默认。

#### A3.4 push 前本地检查

在 push 前执行：

```bash
python3 -m py_compile backend/app/main.py backend/app/models.py backend/app/schemas.py backend/app/crud.py backend/app/routers/*.py
cd frontend
npm run build
```

检查：

```bash
git diff --check
git status --short
```

注意：

- `npm run build` 可能修改 `frontend/next-env.d.ts`。
- 如果只出现 `./.next/types/routes.d.ts` 和 `./.next/dev/types/routes.d.ts` 的生成差异，应恢复该生成文件差异。

验收：

- 后端语法检查通过。
- 前端 build 通过。
- `git diff --check` 通过。
- 未误提交 `data/`、`uploads/`、`frontend/.next`、`frontend/node_modules`。

---

## 4. 阶段 B：push 后，手动发布 GHCR 镜像指南

这些步骤由你在 GitHub 页面手动完成。

### B1：确认代码已 push 到 GitHub

前提：

```text
Docker 相关配置已经提交并 push 到 GitHub。
```

验收：

- GitHub 上能看到包含 Docker 配置的代码。
- push 后 GitHub Actions 不会自动构建镜像。

---

### B2：手动触发 GitHub Actions

操作步骤：

```text
1. 打开 GitHub 仓库。
2. 进入 Actions。
3. 选择 docker-publish。
4. 点击 Run workflow。
5. 选择要发布的分支。
6. 确认运行。
7. 等待 workflow 完成。
```

验收：

- workflow 成功。
- GHCR 中出现：

```text
camerahub-backend:latest
camerahub-frontend:latest
```

- 同时出现对应 commit 的 `sha-...` 标签。

---

### B3：确认 GHCR 访问权限

如果仓库或 package 是 public：

```text
服务器通常可以直接 docker compose pull
```

如果仓库或 package 是 private：

服务器需要登录：

```bash
docker login ghcr.io
```

验收：

- 服务器能拉取 GHCR 镜像。
- 如需登录，README 已写明登录要求。

---

## 5. 阶段 C：服务器只用 compose 文件运行指南

服务器不需要源码仓库。

### C1：准备服务器目录

服务器执行：

```bash
mkdir -p camerahub
cd camerahub
mkdir -p data uploads
```

目录结构：

```text
camerahub/
  docker-compose.yml
  data/
  uploads/
```

`docker-compose.yml` 获取方式任选一种：

```text
方式 1：手动创建并粘贴 README 中的 compose 内容。
方式 2：从 GitHub 单独下载 docker-compose.yml 原始文件。
方式 3：通过 scp 上传 docker-compose.yml。
```

验收：

- 服务器没有 clone 仓库。
- 当前目录有 `docker-compose.yml`、`data/`、`uploads/`。

---

### C2：拉取并启动

服务器执行：

```bash
docker compose pull
docker compose up -d
```

禁止执行：

```bash
docker compose build
```

验收：

- `docker compose pull` 成功拉取 backend 和 frontend。
- `docker compose up -d` 不出现本地构建步骤。
- `docker compose ps` 显示两个服务运行中。

---

### C3：访问验证

默认端口：

```text
http://服务器IP:3010
```

如果 compose 改为：

```yaml
ports:
  - "8080:3010"
```

则访问：

```text
http://服务器IP:8080
```

验证页面：

```text
/dashboard
/items
/films
/stats
```

验证 API：

```text
/api/health
```

验收：

- 页面可打开。
- API 健康检查正常。
- 浏览器 Network 中 API 请求不包含开发机 IP。
- 图片 URL 使用同源 `/uploads/...`。

---

## 6. 阶段 D：端到端验收指南

### D1：功能验收

在服务器页面上验证：

- 新增一个器材。
- 上传一张器材图片。
- 新建或查看照片记录。
- 打开统计页面。
- 刷新页面后数据仍存在。

验收：

- 新增数据成功。
- 图片上传成功。
- 图片能正常显示。
- 统计页面能正常加载。

---

### D2：持久化验收

服务器执行：

```bash
docker compose restart
```

再次打开页面。

验收：

- 数据库数据没有丢失。
- 上传图片没有丢失。
- `data/gear.db` 存在于服务器 `camerahub/data/`。
- 上传图片存在于服务器 `camerahub/uploads/`。

---

### D3：升级流程验收

流程：

```text
1. 本地修改代码。
2. push 到 GitHub。
3. 手动 Run workflow。
4. workflow 推送新 latest 镜像。
5. 服务器执行 docker compose pull。
6. 服务器执行 docker compose up -d。
```

验收：

- 服务器不需要 clone 仓库。
- 服务器不需要 build。
- 新版本镜像可以替换旧容器。
- 数据和图片仍然保留。

---

## 7. 镜像体积预估

后端：

```text
约 180MB - 280MB
```

前端：

```text
约 250MB - 450MB
```

合计：

```text
约 450MB - 750MB
```

说明：

- 这是镜像体积，不包含数据库和上传图片。
- 数据库和图片存放在服务器的 `data/` 和 `uploads/`。
- 前端必须使用多阶段构建，否则体积可能明显增加。

---

## 8. 本轮不做

Docker 1 不做：

- 不引入 PostgreSQL。
- 不引入 Redis。
- 不引入 MinIO。
- 不引入 Nginx。
- 不做 HTTPS。
- 不做域名绑定。
- 不做多用户认证。
- 不把开发机 IP 写死到镜像中。
- 不要求服务器 clone 仓库。
- 不要求服务器 build 镜像。

---

## 9. 最终完成标准

Docker 1 完成时必须满足：

- 代码 push 到 GitHub 后不会自动构建镜像。
- GitHub Actions 可以手动 Run workflow。
- 手动 workflow 能构建并推送前端、后端 GHCR 镜像。
- 服务器只需要 `docker-compose.yml`。
- 服务器执行 `docker compose pull && docker compose up -d` 后可运行。
- 服务器不需要 Node、Python、uv、pnpm。
- 服务器不执行 `docker compose build`。
- 默认访问 `http://服务器IP:3010` 可用。
- 自定义端口如 `8080:3010` 后，访问 `http://服务器IP:8080` 可用。
- API 请求走前端同源 `/api`。
- 图片请求走前端同源 `/uploads`。
- 数据库和上传图片持久化。
- README 包含手动发布、服务器部署、升级、备份说明。
