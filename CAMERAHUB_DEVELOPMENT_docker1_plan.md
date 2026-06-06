# CameraHub Docker 1 Plan

## 目标

将 CameraHub 封装为可直接拉取运行的 Docker 部署方式。

最终目标：

- 开发机不需要安装 Docker。
- 开发机只负责修改代码并 push 到 GitHub。
- GitHub Actions 不在 push 后自动构建。
- 需要发布镜像时，在 GitHub Actions 页面手动触发 workflow，构建前端、后端镜像并推送到 GHCR。
- 测试服务器只需要安装 Docker / Docker Compose。
- 测试服务器不需要 clone 整个仓库。
- 测试服务器只需要准备一份 `docker-compose.yml`，即可从 GHCR 拉取镜像并运行。
- 测试服务器执行 `docker compose pull && docker compose up -d` 后即可使用。
- 测试服务器不执行 `docker compose build`，也不需要安装 Node、Python、uv、pnpm。
- 不把 `192.168.32.123` 这类开发机 IP 写死进镜像或默认配置。

---

## 方案原则

### 采用双容器

使用 `docker compose` 管理两个服务：

```text
camerahub-frontend
camerahub-backend
```

原因：

- 当前项目天然是 Next.js 前端 + FastAPI 后端。
- 前后端拆开后更容易排错、升级、查看日志。
- 后续如果需要单独扩展后端或替换数据库，也更清晰。

### 采用 GitHub Actions 构建镜像

开发机不做镜像构建。

流程：

```text
开发机 push 代码到 GitHub
    ↓
在 GitHub Actions 页面手动触发 docker-publish workflow
    ↓
GitHub Actions 构建镜像
    ↓
推送到 GHCR
    ↓
服务器准备 docker-compose.yml
    ↓
服务器 docker compose pull
    ↓
服务器 docker compose up -d
```

服务器部署命令固定为：

```bash
docker compose pull
docker compose up -d
```

要求：

- 服务器端 `docker-compose.yml` 必须使用 GHCR 的 `image:`。
- 服务器端 `docker-compose.yml` 不写 `build:`。
- 镜像构建只发生在 GitHub Actions 中。

### 前端使用同源代理后端

浏览器只访问前端：

```text
http://服务器IP:3010
```

前端把请求代理给后端容器：

```text
/api/*     -> http://backend:8000/api/*
/uploads/* -> http://backend:8000/uploads/*
```

这样：

- 不需要把服务器 IP 写进前端镜像。
- 不需要每换一台服务器就重新构建前端。
- 不依赖固定的 `NEXT_PUBLIC_API_BASE_URL=http://某个IP:8000`。
- 浏览器看到的 API 地址是同源的 `http://服务器IP:3010/api/...`。
- Docker 部署下基本绕开 CORS 问题。

---

## 任务 1：增加 Docker 忽略规则

新增文件：

```text
.dockerignore
```

需要排除：

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

注意：

- `data/` 和 `uploads/` 不进入镜像。
- 运行时通过 volume 挂载。

验收：

- Docker 构建上下文不包含 `node_modules`、`.next`、数据库、上传图片。

---

## 任务 2：后端 Dockerfile

新增文件：

```text
backend/Dockerfile
```

建议：

- 基础镜像使用 `python:3.12-slim`。
- 安装 `uv`。
- 复制 `pyproject.toml`、`uv.lock`。
- 使用 uv 安装依赖。
- 复制 `app/`。
- 工作目录为 `/app`。
- 暴露端口 `8000`。
- 启动命令：

```bash
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
```

后端容器环境变量：

```env
APP_NAME=CameraHub
DATABASE_URL=sqlite:////app/data/gear.db
UPLOAD_DIR=/app/uploads
BACKEND_CORS_ORIGINS=http://localhost:3010,http://127.0.0.1:3010
```

说明：

- Docker 部署下浏览器请求默认走前端同源代理。
- `BACKEND_CORS_ORIGINS` 仍保留给本机调试或直接访问后端使用。
- 不写死 `192.168.32.123`。

验收：

- 后端容器启动后可访问：

```text
http://localhost:8000/api/health
```

---

## 任务 3：前端 Dockerfile

新增文件：

```text
frontend/Dockerfile
```

建议使用多阶段构建：

```text
deps 阶段：安装依赖
builder 阶段：构建 Next.js
runner 阶段：运行生产服务
```

基础镜像建议：

```text
node:22-slim
```

构建命令：

```bash
npm run build
```

运行命令：

```bash
npm run start -- --hostname 0.0.0.0 --port 3010
```

注意：

- 前端镜像不要写死 `NEXT_PUBLIC_API_BASE_URL=http://192.168.32.123:8000`。
- Docker 生产默认应使用同源代理。
- 如果保留 `NEXT_PUBLIC_API_BASE_URL`，默认值应为空或相对路径方案，不应绑定固定 IP。

验收：

- 前端容器启动后可访问：

```text
http://localhost:3010
```

---

## 任务 4：修改前端 API 默认地址策略

当前前端 API 默认值：

```ts
http://localhost:8000
```

Docker 部署下建议改为：

```ts
NEXT_PUBLIC_API_BASE_URL 未设置时使用空字符串
```

行为：

```text
apiRequest("/api/health") -> /api/health
图片 /uploads/...        -> /uploads/...
```

保留本地开发覆盖方式：

```bash
NEXT_PUBLIC_API_BASE_URL=http://192.168.32.123:8000 npm run dev
```

验收：

- Docker 生产环境 Network 中 API 请求为：

```text
http://服务器IP:3010/api/...
```

- 本地开发仍可通过 `NEXT_PUBLIC_API_BASE_URL` 指向独立后端。

---

## 任务 5：增加 Next.js 代理

修改文件：

```text
frontend/next.config.ts
```

新增 rewrites：

```text
/api/:path*      -> http://backend:8000/api/:path*
/uploads/:path*  -> http://backend:8000/uploads/:path*
```

注意：

- `backend` 是 docker compose 中后端 service 名称。
- 该代理只服务 Docker 生产部署。
- 本地开发仍可继续使用 `NEXT_PUBLIC_API_BASE_URL` 直连后端。

验收：

- 浏览器访问 `http://服务器IP:3010/api/health` 能返回后端健康检查。
- 页面图片 URL 可以通过 `http://服务器IP:3010/uploads/...` 正常加载。

---

## 任务 6：docker-compose.yml

新增文件：

```text
docker-compose.yml
```

该文件面向服务器部署，必须能直接 pull GHCR 镜像运行。

不要在服务器使用的 `docker-compose.yml` 中配置：

```yaml
build:
```

只使用：

```yaml
image:
```

服务：

```text
backend
frontend
```

端口：

```text
frontend: 宿主机端口:3010
backend: 可选宿主机端口:8000
```

端口说明：

- `3010` 是前端容器内部端口。
- `8000` 是后端容器内部端口。
- 端口映射左侧是宿主机端口，可以自定义。
- 默认 compose 可以写成 `3010:3010`，表示宿主机 `3010` 映射到前端容器 `3010`。
- 如果服务器的 `3010` 已被占用，可以改为 `8080:3010`，访问地址变成 `http://服务器IP:8080`。
- 后端浏览器不需要直接访问，默认可以不暴露 `8000` 到宿主机。
- 如需调试后端 API，可以临时增加 `8000:8000`，访问 `http://服务器IP:8000/api/health`。

默认推荐：

```yaml
ports:
  - "3010:3010"
```

可选调试：

```yaml
ports:
  - "3010:3010"
  - "8000:8000"
```

volume：

```text
./data:/app/data
./uploads:/app/uploads
```

依赖：

```text
frontend depends_on backend
```

镜像名称建议：

```text
ghcr.io/<github_user_or_org>/camerahub-backend:latest
ghcr.io/<github_user_or_org>/camerahub-frontend:latest
```

注意：

- `<github_user_or_org>` 需要在实际执行时替换为真实 GitHub 用户名或组织名。
- 服务器使用的 compose 文件只保留 `image:`，不要保留 `build:`。
- 如未来需要本地 Docker 调试，可以单独新增 `docker-compose.dev.yml`，不要影响服务器 pull-only 流程。

验收：

服务器上执行：

```bash
docker compose pull
docker compose up -d
```

可以直接启动。

额外验收：

- 执行 `docker compose config` 时不应出现 `build:`。
- 执行 `docker compose pull` 能拉取前端和后端镜像。
- 执行 `docker compose up -d` 不触发本地构建。

---

## 任务 7：GitHub Actions 发布镜像

新增文件：

```text
.github/workflows/docker-publish.yml
```

触发条件：

```text
只允许手动 workflow_dispatch
```

不要配置：

```yaml
on:
  push:
```

只配置：

```yaml
on:
  workflow_dispatch:
```

手动发布操作步骤：

```text
1. 开发机正常提交代码。
2. push 到 GitHub。
3. 打开 GitHub 仓库页面。
4. 进入 Actions。
5. 选择 docker-publish workflow。
6. 点击 Run workflow。
7. 选择要构建的分支。
8. 点击确认运行。
9. 等待 workflow 成功。
10. 确认 GHCR 出现最新 backend / frontend 镜像。
```

构建并推送：

```text
backend/Dockerfile  -> ghcr.io/<github_user_or_org>/camerahub-backend:latest
frontend/Dockerfile -> ghcr.io/<github_user_or_org>/camerahub-frontend:latest
```

标签建议：

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
- 如果仓库是私有仓库，服务器拉取私有 GHCR 镜像时需要 `docker login ghcr.io`。

验收：

- push 到 GitHub 后不会自动构建镜像。
- 手动 Run workflow 后 GitHub Actions 成功。
- GHCR 能看到两个镜像。
- 服务器能 `docker compose pull` 拉取镜像。

---

## 任务 8：服务器部署说明

更新：

```text
README.md
```

新增 Docker 部署章节。

服务器前置条件：

```text
Docker
Docker Compose plugin
```

首次部署：

```bash
mkdir -p camerahub
cd camerahub
mkdir -p data uploads
# 将 docker-compose.yml 放到当前目录。
docker compose pull
docker compose up -d
```

服务器上的最小文件结构：

```text
camerahub/
  docker-compose.yml
  data/
  uploads/
```

`docker-compose.yml` 可以通过以下任一方式放到服务器：

```text
方式 1：手动创建并粘贴 README 中的 compose 内容。
方式 2：从 GitHub 单独下载 docker-compose.yml 原始文件。
方式 3：通过 scp 上传 docker-compose.yml。
```

不要求：

```bash
git clone <repo>
git pull
docker compose build
```

如果要自定义宿主机访问端口，修改 `docker-compose.yml` 中前端端口映射：

```yaml
ports:
  - "8080:3010"
```

然后访问：

```text
http://服务器IP:8080
```

说明：

- 左侧 `8080` 是宿主机端口，可以自定义。
- 右侧 `3010` 是容器内部端口，不建议改。
- 后端 `8000` 是容器内部端口，前端通过 Docker 网络访问 `http://backend:8000`。
- 正常使用时后端不需要映射到宿主机端口。

查看日志：

```bash
docker compose logs -f
docker compose logs -f backend
docker compose logs -f frontend
```

升级：

```bash
docker compose pull
docker compose up -d
```

升级说明：

- 先在 GitHub Actions 手动 Run workflow，发布新镜像到 GHCR。
- 服务器只执行 `docker compose pull && docker compose up -d`。
- 如果 `docker-compose.yml` 本身没有变化，服务器不需要更新任何源码文件。

停止：

```bash
docker compose down
```

数据备份：

```bash
tar -czf camerahub-backup-$(date +%Y%m%d).tar.gz data uploads
```

验收：

- README 中明确说明开发机不需要 Docker。
- README 中明确说明服务器需要 Docker。
- README 中明确说明服务器不需要 clone 仓库。
- README 中明确说明服务器只需要准备 `docker-compose.yml`。
- README 中明确说明不需要写死服务器 IP。
- README 中明确说明宿主机端口可以自定义，容器内部端口保持默认。
- README 中明确说明服务器只执行 `docker compose pull && docker compose up -d`，不执行 build。

---

## 任务 9：端到端验证

在 GitHub Actions 推送镜像后，找一台测试服务器执行：

```bash
mkdir -p camerahub
cd camerahub
mkdir -p data uploads
# 将 docker-compose.yml 放到当前目录。
docker compose pull
docker compose up -d
```

验证页面：

```text
http://服务器IP:3010
http://服务器IP:3010/dashboard
http://服务器IP:3010/items
http://服务器IP:3010/films
http://服务器IP:3010/stats
```

验证 API：

```text
http://服务器IP:3010/api/health
```

验证数据：

- 新增一个器材。
- 上传一张图片。
- 刷新页面，确认数据存在。
- 执行 `docker compose restart`。
- 再次打开页面，确认数据和图片仍存在。

验收：

- 服务器没有执行 `docker compose build`。
- 服务器没有执行 `git clone`。
- 服务器只执行 pull 和 up 即可运行。
- `docker compose up -d` 日志中不出现本地构建步骤。
- 浏览器 Network 中 API 请求没有出现开发机 IP。
- 数据库和上传图片在容器重启后不丢失。

---

## 镜像体积预估

后端：

```text
约 180MB - 280MB
```

前端：

```text
约 250MB - 450MB
```

总计：

```text
约 450MB - 750MB
```

注意：

- 这是镜像体积，不包含数据库和上传图片。
- 数据库和图片保存在服务器 volume 对应目录中。
- 如果前端不使用多阶段构建，体积可能明显增大。

---

## 不做的事情

本轮 Docker 1 不做：

- 不引入 PostgreSQL。
- 不引入 Redis。
- 不引入 MinIO。
- 不引入 Nginx。
- 不做 HTTPS。
- 不做域名绑定。
- 不做多用户认证。
- 不把开发机 IP 写死到镜像中。

---

## 完成标准

Docker 1 完成时，应满足：

- GitHub Actions 能构建并推送前端、后端镜像。
- 服务器能直接 pull GHCR 镜像运行。
- 服务器不需要安装 Node、Python、uv、pnpm。
- 服务器不需要执行 build。
- 默认访问 `http://服务器IP:3010` 可用。
- 如宿主机端口改为 `8080:3010`，访问 `http://服务器IP:8080` 可用。
- API 和图片请求走前端同源代理。
- 数据库和 uploads 持久化。
- README 包含完整部署、升级、备份说明。
