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
- 资产概览与统计图表（胶片按单卷价格与库存数量计价）

存储方式保持简单：

- 数据库：SQLite
- 图片：本地 `uploads/`
- 部署：GHCR 镜像 + Docker Compose

## 项目截图

### 浅色模式

#### 概览

![概览 Light](./Readme_pictures/概览light.png)

#### 器材

![器材 Light](./Readme_pictures/器材light.png)

#### 器材详情

![器材详情 Light](./Readme_pictures/器材详情页light.png)

#### 统计

![统计 Light](./Readme_pictures/统计light.png)

#### 照片

![照片 Light](./Readme_pictures/照片light.png)

#### 照片详情

![照片详情 Light](./Readme_pictures/照片详情页light.png)

#### 一言设置

![一言设置 Light](./Readme_pictures/一言设置light.png)

### 深色模式

#### 概览

![概览 Dark](./Readme_pictures/概览dark.png)

#### 器材

![器材 Dark](./Readme_pictures/器材dark.png)

#### 器材详情

![器材详情 Dark](./Readme_pictures/器材详情页dark.png)

#### 统计

![统计 Dark](./Readme_pictures/统计dark.png)

#### 照片

![照片 Dark](./Readme_pictures/照片ldark.png)

#### 照片详情

![照片详情 Dark](./Readme_pictures/照片详情页dark.png)

#### 一言设置

![一言设置 Dark](./Readme_pictures/一言设置dark.png)

## 手机端适配

当前前端已经按手机端做过以下适配：

- 顶部导航和右上角工具区在小屏幕下会收成更紧凑的移动端布局，不继续沿用桌面三列头部结构
- 列表和统计页面的网格会自动降列，器材卡片等密集内容在窄屏下会退化为单列或更少列展示
- 卡片和内容区使用了 `w-full`、`max-w-full`、`min-w-0` 这类宽度约束，避免页面横向撑出屏幕
- 长标题、标签和元信息会在需要时截断或换行，避免把布局挤出视口
- 依赖 hover 的交互保留了移动端降级方式，手机端点击仍然可以正常进入详情页，不依赖悬停
- 拍摄事项卡片、统计页内容和表单控件都压缩了间距并支持换行，保证窄屏下仍可操作

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

需要 Python 3.12+、uv、Node.js 和 npm。

启动后端：

```bash
cd backend
uv sync --frozen
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

若仓库位于不支持符号链接的共享文件系统（例如 CIFS），请把 uv 的虚拟环境和缓存放到本机磁盘：

```bash
cd backend
export UV_PROJECT_ENVIRONMENT=/tmp/camerahub-backend-venv
export UV_CACHE_DIR=/tmp/camerahub-uv-cache
uv sync --frozen
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

另开一个终端启动前端：

首次克隆项目、`frontend/package-lock.json` 变更，或 `node_modules` 损坏时，先安装依赖：

```bash
cd frontend
npm ci
```

日常启动不需要重复运行 `npm ci`，直接执行：

```bash
cd frontend
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run dev
```

访问 `http://localhost:3010`。提交前端改动前运行 `npm run lint` 和 `npm run build`；后端语法校验运行 `uv run python -m compileall app`。

### 局域网访问

后端以 `--host 0.0.0.0` 启动后，前端已监听所有网络接口。若从局域网设备访问服务器 `192.168.32.123`，前端必须使用服务器 IP 作为 API 地址，不能使用 `localhost`，否则浏览器会连接访问设备自身的 `8000` 端口：

```bash
cd frontend
NEXT_PUBLIC_API_BASE_URL=http://192.168.32.123:8000 npm run dev
```

随后在局域网设备访问 `http://192.168.32.123:3010/`。如果页面能打开但没有数据，请停止并按上述命令重启前端。

## Docker Compose 部署

CameraHub 可以通过 Docker Compose 拉取 GHCR 上的预构建镜像完成部署。服务器需要：

- Docker
- Docker Compose plugin
- 一个包含 `docker-compose.yml`、`.env`、`data/`、`uploads/` 和 `backups/` 的部署目录

### 1. 准备部署目录

在服务器上创建独立部署目录：

```bash
mkdir -p camerahub/data camerahub/uploads camerahub/backups
cd camerahub
```

推荐目录结构：

```text
camerahub/
  docker-compose.yml
  .env
  data/
  uploads/
  backups/
```

`data/` 保存 SQLite 数据库和本地设置，`uploads/` 保存上传图片，`backups/` 保存自动迁移恢复点和运维备份。升级时请保留这三个目录。

### 2. 创建 `.env`

如果希望部署可重复、方便回滚，建议使用固定版本：

```env
CAMERAHUB_VERSION=0.4.0
```

也可以使用 `latest`，但固定版本更适合长期使用：

```env
CAMERAHUB_VERSION=latest
```

### 3. 创建 `docker-compose.yml`

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

说明：

- backend 默认不直接暴露到宿主机
- frontend 默认通过宿主机 `3010` 对外提供访问
- SQLite 数据、本地设置、上传图片和备份都保留在宿主机挂载目录中
- `CAMERAHUB_VERSION` 用于控制拉取哪个 GHCR 版本

### 4. 拉取并启动

拉取镜像并启动服务：

```bash
docker compose pull
docker compose up -d
```

在浏览器中访问：

```text
http://服务器IP:3010
```

如果在服务器本机测试：

```text
http://localhost:3010
```

### 5. 查看运行状态

查看容器状态：

```bash
docker compose ps
```

查看日志：

```bash
docker compose logs -f
```

只看后端日志：

```bash
docker compose logs -f backend
```

只看前端日志：

```bash
docker compose logs -f frontend
```

### 6. 升级

如果需要切换版本，先修改 `.env`：

```env
CAMERAHUB_VERSION=0.4.0
```

然后重新拉取并创建容器：

```bash
docker compose pull
docker compose up -d
```

Docker Compose 会继续使用宿主机上的 `./data` 和 `./uploads`。

### 7. 回滚

把 `.env` 改回上一个镜像版本：

```env
CAMERAHUB_VERSION=0.1.0
```

然后执行：

```bash
docker compose pull
docker compose up -d
```

### 8. 重启或停止

重启服务：

```bash
docker compose restart
```

停止服务但不删除数据：

```bash
docker compose down
```

确认不再需要旧镜像时，可以停止后清理未使用镜像：

```bash
docker compose down
docker image prune
```

当前 compose 文件解析出的镜像为：

```text
ghcr.io/jim-git-2000/camerahub-backend:${CAMERAHUB_VERSION:-latest}
ghcr.io/jim-git-2000/camerahub-frontend:${CAMERAHUB_VERSION:-latest}
```

含义：

- 不设置 `CAMERAHUB_VERSION`：部署 `latest`
- 设置 `CAMERAHUB_VERSION=0.4.0`：部署正式版本 `0.4.0`

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

### 备份

一条命令备份并校验 SQLite、一言配置和全部上传文件：

```bash
cd backend
uv run python -m app.maintenance backup
```

Docker 部署执行：

```bash
docker compose run --rm backend uv run python -m app.maintenance backup
```

命令会在 `backups/` 生成带格式版本、SQLite schema 信息、文件清单、字节数、SHA-256 和 SQLite 一致性快照的 ZIP 归档。移动或恢复前可独立校验：

```bash
cd backend
uv run python -m app.maintenance verify ../backups/camerahub-backup-*.zip
```

恢复要求独占数据，必须先停止前后端。恢复命令覆盖数据前会自动再创建一份可验证保护备份；恢复中途失败会自动回滚到该恢复点：

```bash
docker compose stop frontend backend
docker compose run --rm backend uv run python -m app.maintenance restore /app/backups/camerahub-backup-YYYYMMDDTHHMMSSZ-ID.zip
docker compose up -d
docker compose ps
```

## 上传

CameraHub 会把上传图片保存到 `uploads/`，并在 SQLite 中记录相对路径。迁移到另一台服务器时，请同时迁移 `data/gear.db` 和 `uploads/`。

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

如果上传失败，请检查：

- 文件格式是否受支持
- 文件大小是否超过限制
- 服务器是否对 `./uploads` 有写入权限
- 后端容器是否正在运行：`docker compose ps`

上传后的图片访问路径类似：

```text
/uploads/...
```
