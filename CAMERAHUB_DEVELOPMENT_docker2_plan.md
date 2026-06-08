# CameraHub Docker 2 发布分步骤计划

## 0. 目标

本计划用于整理 CameraHub 发布到 GitHub 并通过 GHCR + Docker Compose 一键部署的完整步骤。

重点区分两类工作：

1. 发布前，本地仓库需要完成哪些修改
2. 发布后，在 GitHub 上需要执行哪些操作

并明确以下结论：

- `docker publish` 继续采用 **GitHub Actions 手动操作**
- GitHub Packages 的正式版本号使用 **Git tag**
- 前后端共用同一个版本号
- 目前已有的 GHCR package 如果只有 `latest` 或 `sha-...`，**不能直接“改名”为 `0.1.0`**，必须重新发布一次，把 `0.1.0` 作为新的镜像 tag 推上去

---

## 1. 发布策略总览

统一规则如下：

```text
版本来源：Git tag
版本格式：v0.1.0 / v0.2.0 / v1.0.0
镜像 tag：0.1.0 / 0.2.0 / 1.0.0
镜像仓库：GHCR
发布方式：GitHub Actions 手动 Run workflow
部署方式：服务器 docker compose pull && docker compose up -d
```

统一版本策略：

- backend 和 frontend 使用同一个发布版本号
- `backend/pyproject.toml` 和 `frontend/package.json` 中的 `version` 必须保持一致

GHCR 最终应同时保留的 tag：

```text
latest
sha-<commit>
0.1.0
0.1
```

说明：

- `0.1.0` 是正式版本 tag
- `0.1` 是可选的次版本滚动 tag
- `latest` 只表示最新默认版本，不适合精确部署
- `sha-<commit>` 用于追溯具体构建

---

## 2. 阶段 A：发布前，本地仓库修改计划

这一阶段全部在本地仓库完成，完成后再提交到 GitHub。

### A1. 版本号统一

需要修改：

```text
backend/pyproject.toml
frontend/package.json
```

要求：

- 两个文件中的版本号统一为同一个值
- 例如第一次正式版本统一改为：

```text
0.1.0
```

当前仓库现状：

- `backend/pyproject.toml` 已经是 `0.1.0`
- `frontend/package.json` 已经是 `0.1.0`

如果要发布 `0.1.0`，这一项当前 **无需改动**

如果后续发布 `0.2.0`，则需要同时修改这两个文件。

---

### A2. GitHub Actions 工作流调整

需要修改：

```text
.github/workflows/docker-publish.yml
```

当前现状：

- 只支持 `workflow_dispatch`
- 只推送：

```text
latest
sha-${github.sha}
```

当前问题：

- GHCR package 页面看不到正式版本号
- 服务器只能稳定拉 `latest`
- 无法精确回滚到某个正式版本

需要改成：

1. 保留 `workflow_dispatch`
2. 增加 tag 触发：

```yaml
on:
  workflow_dispatch:
  push:
    tags:
      - "v*"
```

3. 引入标准镜像 metadata 生成逻辑
4. 对 backend 和 frontend 两个镜像都生成以下 tag：

```text
latest
sha-<commit>
0.1.0
0.1
```

5. OCI metadata 里加入：

```text
org.opencontainers.image.version
org.opencontainers.image.revision
org.opencontainers.image.source
```

6. `latest` 只在默认分支正式发布时保留

建议实现方式：

- 使用 `docker/metadata-action`
- 使用矩阵分别构建 backend / frontend
- 继续手动触发 workflow，但正式版本发布时通过推送 Git tag 触发

---

### A3. Docker Compose 改成支持指定版本

需要修改：

```text
docker-compose.yml
```

当前现状：

```yaml
image: ghcr.io/jim-git-2000/camerahub-backend:latest
image: ghcr.io/jim-git-2000/camerahub-frontend:latest
```

当前问题：

- 服务器永远拉 `latest`
- 无法锁定版本
- 无法精确回滚

需要改成：

```yaml
image: ghcr.io/jim-git-2000/camerahub-backend:${CAMERAHUB_VERSION:-latest}
image: ghcr.io/jim-git-2000/camerahub-frontend:${CAMERAHUB_VERSION:-latest}
```

要求：

- 默认仍兼容 `latest`
- 服务器部署时优先通过 `.env` 指定：

```env
CAMERAHUB_VERSION=0.1.0
```

---

### A4. README 完善

需要修改：

```text
README.md
```

至少补齐以下内容：

1. 版本发布方式
2. GitHub Release 与 GHCR 的关系
3. `latest` 与 `0.1.0` 的区别
4. 本地开发方式
5. 发布镜像方式
6. 服务器部署方式
7. 服务器升级方式
8. 回滚方式

README 中必须明确写清：

- `docker-publish` 仍然是 **手动操作**
- 正式版本号来自 Git tag
- GitHub Packages 中的版本号体现在镜像 tag，不是 branch 名

---

### A5. 环境变量模板与部署说明

建议修改：

```text
.env.example
```

建议增加：

```env
CAMERAHUB_VERSION=0.1.0
DATABASE_URL=sqlite:///./data/gear.db
UPLOAD_DIR=./uploads
BACKEND_CORS_ORIGINS=http://localhost:3010,http://127.0.0.1:3010
APP_NAME=CameraHub
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

说明：

- 本地 `.env.example` 和服务器部署 `.env` 可以复用思路
- 服务器部署时最关键的是 `CAMERAHUB_VERSION`

---

### A6. 可选但推荐的补充

建议新增：

```text
CHANGELOG.md
```

目的：

- 对应 GitHub Release 的版本说明
- 便于用户理解 `0.1.0` 相比之前做了什么

这一项不是必须，但正式开源或长期维护时很有价值。

---

## 3. 阶段 B：发布后，在 GitHub 上的操作步骤

这一阶段发生在本地代码已经修改完成、并 push 到 GitHub 之后。

### B1. 提交并 push 本地修改

本地操作：

```bash
git add .
git commit -m "prepare docker release 0.1.0"
git push origin main
```

说明：

- 这一步只是把“发布机制改造”推上去
- 还没有生成正式版本包

---

### B2. 创建正式版本 Git tag

本地操作：

```bash
git tag v0.1.0
git push origin v0.1.0
```

说明：

- `v0.1.0` 是 GitHub Release 的版本号
- workflow 会把它转换成镜像 tag `0.1.0`

如果后续发布 `0.2.0`，则使用：

```bash
git tag v0.2.0
git push origin v0.2.0
```

---

### B3. 在 GitHub Actions 手动操作 docker publish

这里需要明确：

`docker publish` 仍然是 **手动操作**。

推荐方式：

1. 打开 GitHub 仓库页面
2. 进入 `Actions`
3. 选择 `docker-publish`
4. 点击 `Run workflow`
5. 选择发布对应分支，一般是 `main`
6. 执行 workflow

说明：

- 即使配置了 tag 触发，也仍然保留手动触发入口
- 手动触发适合重发镜像、补发镜像、调试 workflow

正式发布建议顺序：

```text
先 push main
再 push v0.1.0
必要时手动 Run workflow 作为补发
```

---

### B4. 在 GitHub Release 页面创建版本说明

GitHub 操作：

1. 进入 `Releases`
2. 选择 `Draft a new release`
3. 选择 tag `v0.1.0`
4. 标题写：

```text
CameraHub v0.1.0
```

5. 填写本次更新说明
6. 发布 Release

目的：

- 用户看到清晰的正式版本说明
- GHCR package 和 Release 页面对应起来

---

### B5. 在 GitHub Packages 中检查版本是否出现

检查位置：

- GitHub 仓库右侧 `Packages`
- 或 `https://github.com/<owner>?tab=packages`

应该看到两个 package：

```text
camerahub-backend
camerahub-frontend
```

每个 package 内部应看到版本相关 tag：

```text
0.1.0
0.1
latest
sha-<commit>
```

这里的“版本号体现”就是镜像 tag。

---

## 4. 阶段 C：服务器部署步骤

### C1. 服务器准备目录

服务器目录结构建议：

```text
camerahub/
  docker-compose.yml
  .env
  data/
  uploads/
```

---

### C2. 服务器 `.env` 指定版本号

服务器 `.env` 示例：

```env
CAMERAHUB_VERSION=0.1.0
```

如果要升级到 `0.2.0`：

```env
CAMERAHUB_VERSION=0.2.0
```

---

### C3. 拉取并启动

服务器操作：

```bash
docker compose pull
docker compose up -d
```

说明：

- 服务器不执行 build
- 服务器不需要 clone 整个仓库
- 服务器只需要 compose 文件和数据目录

---

### C4. 回滚

如果 `0.2.0` 有问题，要回滚到 `0.1.0`：

1. 修改服务器 `.env`

```env
CAMERAHUB_VERSION=0.1.0
```

2. 重新执行：

```bash
docker compose pull
docker compose up -d
```

---

## 5. 目前已有 package 怎么改成 0.1.0 版本

这个问题要写清楚：

### 结论

**不能直接把现有的 GHCR package 从 `latest` 改名成 `0.1.0`。**

GHCR package 的版本展示本质上来自镜像 tag。

所以要让当前 package 体现 `0.1.0`，正确做法是：

1. 确保本地代码对应你想发布的那一版
2. 保证：

```text
backend/pyproject.toml -> 0.1.0
frontend/package.json  -> 0.1.0
```

3. push 到 GitHub
4. 创建并 push：

```bash
git tag v0.1.0
git push origin v0.1.0
```

5. 运行 `docker-publish`
6. 重新把同一套镜像推送出：

```text
ghcr.io/jim-git-2000/camerahub-backend:0.1.0
ghcr.io/jim-git-2000/camerahub-frontend:0.1.0
```

### 结果

原来的 package 不会“被重命名”，而是会在同一个 package 下新增一个正式版本 tag：

```text
latest
sha-xxxxxxx
0.1.0
0.1
```

### 如果当前 workflow 还没支持版本 tag

那就必须先完成本计划中的阶段 A2，再去发布 `v0.1.0`。

否则你即使 push 了 tag，也只会继续得到：

```text
latest
sha-xxxxxxx
```

而不会出现 `0.1.0`。

---

## 6. 推荐执行顺序

推荐按下面顺序推进：

```text
1. 本地修改 workflow
2. 本地修改 docker-compose.yml
3. 本地完善 README
4. 检查 version 是否已是 0.1.0
5. 提交并 push 到 main
6. 创建并 push v0.1.0 tag
7. 在 GitHub Actions 手动 Run docker-publish
8. 在 GHCR 检查 0.1.0 tag 是否出现
9. 在 GitHub Releases 发布 v0.1.0
10. 服务器设置 CAMERAHUB_VERSION=0.1.0 并部署
```

---

## 7. 最终验收标准

完成后应满足：

1. `docker-publish` 仍然支持手动操作
2. GitHub Actions 能为 backend/frontend 同时生成正式版本镜像
3. GHCR 中能看到 `0.1.0` 版本 tag
4. `docker-compose.yml` 可以通过 `CAMERAHUB_VERSION` 部署指定版本
5. README 清楚说明本地修改、GitHub 发布、服务器部署、升级与回滚
6. 现有 package 不需要删除，只需补发 `0.1.0` tag 即可
7. 服务器可以通过：

```bash
docker compose pull
docker compose up -d
```

完成指定版本部署
