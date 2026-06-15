# CameraHub Docker 3 发布计划（v0.2.0）

## 0. 目标

本计划用于发布 CameraHub `0.2.0` Docker 版本。

原则：

- 简单高效，只做发布 `0.2.0` 必要事项。
- 不重复改造 Docker 发布机制；`docker2` 阶段已完成的 workflow、GHCR tag、compose 版本变量继续复用。
- 前后端共用同一个版本号。
- 服务器通过 `CAMERAHUB_VERSION=0.2.0` 拉取固定版本，保留回滚到 `0.1.0` 的能力。

---

## 1. 当前状态

当前已具备：

```text
.github/workflows/docker-publish.yml
docker-compose.yml
backend/Dockerfile
frontend/Dockerfile
```

其中：

- GitHub Actions 已支持 `workflow_dispatch` 和 `v*` tag 触发。
- GHCR 镜像 tag 已支持 `latest`、`sha-*`、`0.2.0`、`0.2` 这类版本 tag。
- `docker-compose.yml` 已支持：

```text
CAMERAHUB_VERSION
```

当前仍是 `0.1.0`：

```text
backend/pyproject.toml
frontend/package.json
```

---

## 2. 本地最小修改

### A1. 修改后端版本号

文件：

```text
backend/pyproject.toml
```

修改：

```toml
version = "0.2.0"
```

---

### A2. 修改前端版本号

文件：

```text
frontend/package.json
```

修改：

```json
"version": "0.2.0"
```

说明：

- 如果 `package-lock.json` 顶层 package 版本仍记录 `0.1.0`，同步更新为 `0.2.0`。
- 不升级依赖，不执行无关 `npm update`。

---

### A3. README 只做必要更新

文件：

```text
README.md
README_zh.md
```

只需要把部署示例中的固定版本从：

```env
CAMERAHUB_VERSION=0.1.0
```

更新为：

```env
CAMERAHUB_VERSION=0.2.0
```

保留回滚示例：

```env
CAMERAHUB_VERSION=0.1.0
```

不要大改 README 结构。

---

### A4. 可选：补充 CHANGELOG

如果仓库已有 `CHANGELOG.md`，追加 `0.2.0` 更新说明。

如果没有，可以暂时不新增；本次以简单发布为主。

建议 `0.2.0` 说明包含：

- 详情页改为缩略图预览，点击图片才打开原图。
- 每张器材图片和拍摄事项照片都生成缩略图。
- 拍摄事项卡片背景色恢复为随封面主色调变化。
- 拍摄事项文件夹名与拍摄事项标题同步。

---

## 3. 不需要修改

本次不需要改：

```text
.github/workflows/docker-publish.yml
docker-compose.yml
backend/Dockerfile
frontend/Dockerfile
```

除非实际发布验证发现问题。

不要新增：

- PostgreSQL
- Redis
- MinIO
- Nginx
- Kubernetes
- 多环境 compose 拆分
- 自动迁移脚本

---

## 4. 发布前验证

后端：

```bash
cd /workspace/other-projects/CamareHub
python3 -m compileall backend/app
```

前端：

```bash
cd /workspace/other-projects/CamareHub/frontend
node node_modules/next/dist/bin/next build --webpack
node node_modules/typescript/bin/tsc --noEmit
```

注意：

- 当前 `npm run lint` 使用 `next lint`，在 Next 16 下可能报 `Invalid project directory ... /frontend/lint`。
- 如果仍是该错误，不阻塞 Docker 版本发布；以 build 和 TypeScript 检查为准。
- 验证后不要提交 `.next/`、`tsconfig.tsbuildinfo` 这类构建产物变动。

---

## 5. 提交与打 tag

提交版本修改：

```bash
git add backend/pyproject.toml frontend/package.json frontend/package-lock.json README.md README_zh.md
git commit -m "prepare docker release 0.2.0"
git push origin main
```

创建并推送 tag：

```bash
git tag v0.2.0
git push origin v0.2.0
```

说明：

- Git tag 使用 `v0.2.0`。
- GHCR 镜像 tag 会生成 `0.2.0` 和 `0.2`。
- 不要用 branch 名当版本号。

---

## 6. GitHub Actions 发布

推荐流程：

1. push `main`
2. push `v0.2.0`
3. 到 GitHub Actions 检查 `docker-publish`
4. 如 tag 触发未自动完成，手动 `Run workflow`

发布后 GHCR 应看到：

```text
ghcr.io/jim-git-2000/camerahub-backend:0.2.0
ghcr.io/jim-git-2000/camerahub-backend:0.2
ghcr.io/jim-git-2000/camerahub-backend:latest
ghcr.io/jim-git-2000/camerahub-backend:sha-...

ghcr.io/jim-git-2000/camerahub-frontend:0.2.0
ghcr.io/jim-git-2000/camerahub-frontend:0.2
ghcr.io/jim-git-2000/camerahub-frontend:latest
ghcr.io/jim-git-2000/camerahub-frontend:sha-...
```

---

## 7. GitHub Release

创建 Release：

```text
tag: v0.2.0
title: CameraHub v0.2.0
```

建议说明：

```text
## CameraHub v0.2.0

- 详情页图片预览统一使用缩略图，点击后打开原图。
- 每张器材图片和每张拍摄事项照片都会生成缩略图。
- 拍摄事项卡片背景色随封面主色调变化。
- 拍摄事项文件夹名会与拍摄事项标题同步。
- 保持 SQLite 数据库兼容，不要求重建数据库。
```

---

## 8. 服务器升级

服务器 `.env`：

```env
CAMERAHUB_VERSION=0.2.0
```

执行：

```bash
docker compose pull
docker compose up -d
```

确认：

```bash
docker compose ps
docker compose logs -f
```

浏览器检查：

```text
http://服务器地址:3010/dashboard
http://服务器地址:3010/items
http://服务器地址:3010/films
```

---

## 9. 回滚

如果 `0.2.0` 有问题，服务器 `.env` 改回：

```env
CAMERAHUB_VERSION=0.1.0
```

然后执行：

```bash
docker compose pull
docker compose up -d
```

说明：

- 数据库仍使用原来的 `./data` volume。
- 上传图片仍使用原来的 `./uploads` volume。
- 本次不设计自动回滚数据库或图片文件。

---

## 10. 最终验收标准

完成后应满足：

1. `backend/pyproject.toml` 版本为 `0.2.0`。
2. `frontend/package.json` 版本为 `0.2.0`。
3. 如 `frontend/package-lock.json` 记录项目版本，也同步为 `0.2.0`。
4. GHCR 中 backend/frontend 都有 `0.2.0` tag。
5. 服务器 `.env` 使用 `CAMERAHUB_VERSION=0.2.0` 可以启动。
6. 页面可以正常访问 dashboard、items、films。
7. 回滚到 `CAMERAHUB_VERSION=0.1.0` 的步骤明确保留。

