# CameraHub 下一步调整与调试计划 3

> 文件用途：记录当前本地开发版在 DEBUG2 之后的下一阶段调试计划。  
> 主要参考：`CAMERAHUB_DEVELOPMENT_DEBUG2.md`。  
> 使用方式：每次让 Codex 开发时，请指定只执行某一个“调试 N”。  
> 项目名称：CameraHub  
> 项目类型：个人摄影器材管理系统  
> 当前阶段：本地开发版后续调整。  
> 核心原则：兼容目前 SQLite 数据库格式；图片文件不做旧图迁移，后续新上传图片按新规则处理。

---

## 0. Codex 工作规则

每次让 Codex 开发时，请使用类似下面的指令：

```text
请阅读 CAMERAHUB_DEVELOPMENT_DEBUG3.md，只执行「调试 N」。
不要执行后续调试。
完成后请列出：
1. 修改了哪些文件
2. 如何启动或测试
3. 哪些验收项已通过
4. 是否有未完成问题
5. 下一步应该执行哪个调试
```

Codex 必须遵守：

1. 每次只完成一个调试计划。
2. 不要自行跳到后续调试。
3. 不要自行升级技术栈。
4. 不要添加 Docker、PWA、PostgreSQL、Redis、MinIO、Celery、RabbitMQ、Elasticsearch、Kubernetes、GraphQL、OAuth、多租户权限系统。
5. 不要把数据库文件放进 `frontend/` 或 `backend/` 源码目录。
6. 不要把上传图片放进 `frontend/public/`。
7. 所有路径、API 地址、上传目录都要尽量通过环境变量配置，避免写死。
8. 每个调试完成后，都要保证项目仍然可以启动。
9. 如果调试涉及数据库结构变更，必须说明是否需要重建或迁移 SQLite 表。
10. 如果调试涉及移动、删除、覆盖实际图片文件，必须说明具体路径策略；删除实际文件必须有二次确认。
11. 兼容已有数据库优先：不要要求用户重建 `data/gear.db`；图片不做旧图迁移，用户会清理旧图片并重新上传。

---

## 1. 技术栈固定

### 1.1 Frontend

使用：

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui
- ECharts

不要使用：

- Vue
- Nuxt
- Angular
- Redux
- Ant Design
- Material UI
- Chart.js

---

### 1.2 Backend

使用：

- Python
- FastAPI
- SQLModel
- SQLite
- uv
- Uvicorn
- Pillow

不要使用：

- Django
- Flask
- PostgreSQL
- MySQL
- MongoDB
- Redis
- Celery

---

## 2. 本地开发运行方式

后端：

```bash
cd backend
UV_PROJECT_ENVIRONMENT="$HOME/.venvs/camerahub-backend" uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

前端：

```bash
cd frontend
NEXT_PUBLIC_API_BASE_URL=http://192.168.32.123:8000 npm run dev
```

访问：

```text
http://192.168.32.123:3010
```

后端 uv 说明：

- 当前工作区可能不允许在 `backend/.venv` 内创建 Python 虚拟环境需要的符号链接。
- 因此后端运行 `uv` 命令时，统一带上 `UV_PROJECT_ENVIRONMENT="$HOME/.venvs/camerahub-backend"`。
- 如果忘记设置该变量，`uv` 可能会再次尝试使用 `backend/.venv`，并报 `no Python executable was found`。

---

# 3. 当前上下文与兼容要求

DEBUG2 已经规划或实现过：

1. 上传图片按器材类型和拍摄事项分目录存放。
2. 拍摄事项详情可以按对应文件夹展示图片。
3. 新上传图片生成缩略图，并在汇总页和概览页优先使用缩略图。
4. `photos.thumbnail_path` 和 `shooting_entry_photos.thumbnail_path` 为可选字段。
5. `shooting_entry_photos.dominant_color` 为封面主色调相关字段。

本阶段继续保持：

1. 不重建 SQLite 数据库。
2. 不要求迁移旧图片。
3. 不删除现有图片字段。
4. 不改变上传目录根规则。
5. 图片 URL 必须由后端返回，前端不要自行拼接文件名。
6. 缩略图用于页面内预览和列表展示，原图只在用户点开某张具体图片时加载。
7. 拍摄事项卡片左侧纯色背景区必须跟随封面图主色调变化。

---

# 4. 后续调试计划

下面的调试计划必须按顺序执行。

---

## 调试 1：详情页也只展示缩略图，点击具体图片才加载原图

### 目标

器材详情页和照片详情页中的图片网格也改为展示缩略图。

也就是说：

- 器材汇总页继续只展示缩略图。
- 照片汇总页继续只展示缩略图。
- Dashboard 继续只展示缩略图。
- 器材详情页图片网格展示缩略图。
- 照片详情页图片网格展示缩略图。
- 只有用户点击某一张具体图片并打开链接时，才请求原图。
- 缩略图生成策略改为：每一张器材图片、每一张拍摄事项照片都必须有对应缩略图，不再只为拍摄事项封面生成缩略图。

当前需要修正的重点是：

```text
frontend/src/app/items/[id]/page.tsx
frontend/src/app/films/[id]/page.tsx
```

这些详情页中 `<img>` 不应该直接使用 `photo.url`。

### 只允许做

- 调整器材详情页图片网格的 `<img src>` 使用 `thumbnail_url`。
- 调整照片详情页图片网格的 `<img src>` 使用 `thumbnail_url`。
- 保留图片外层 `<a href>` 指向原图 `url`。
- 修正后端缩略图生成逻辑，确保每张器材图片和每张拍摄事项照片都有 `thumbnail_url`。
- 对已有数据库记录中缺少 `thumbnail_path` 的图片，在读取或返回前进行轻量补齐。
- 必要时补充轻量 helper，例如 `thumbnailSrc`、`originalSrc`。
- 必要时检查后端返回的 `thumbnail_url` 是否完整。

### 不允许做

- 不要让详情页 `<img>` 回退加载原图。
- 不要为了兜底在前端用 `photo.url` 当缩略图。
- 不要新增外部图片服务。
- 不要把缩略图放到 `frontend/public/`。
- 不要写独立的全量旧图片迁移脚本；允许在接口读取、图片列表返回、详情返回时对当前请求涉及的图片轻量补齐缩略图。
- 不要改变上传目录结构。
- 不要改变图片删除逻辑。
- 不要执行调试 2。

### 后端实现要求

重点检查：

```text
backend/app/crud.py
backend/app/models.py
backend/app/schemas.py
backend/app/database.py
```

要求：

1. `PhotoRead` 必须返回：

```text
url
thumbnail_url
```

2. `ShootingEntryPhotoRead` 必须返回：

```text
url
thumbnail_url
```

3. `thumbnail_url` 必须保留子目录，例如：

```text
/uploads/camera/thumbs/{uuid}.webp
/uploads/shooting-entries/12-weekend-shoot/thumbs/{uuid}.webp
```

4. `url` 必须仍然是原图路径。
5. 不要改变原图 URL 语义。
6. 新上传器材图片时，必须为每一张图片生成缩略图并保存 `thumbnail_path`。
7. 新上传拍摄事项照片时，必须为每一张照片生成缩略图并保存 `thumbnail_path`。
8. 拍摄事项图片不再采用“只为封面生成缩略图”的策略；封面和非封面照片都要有缩略图。
9. 手动放入拍摄事项文件夹并被详情接口扫描到的图片，也应在本次读取中生成稳定缩略图路径并返回 `thumbnail_url`。
10. 读取器材图片列表时，如果当前图片记录缺少 `thumbnail_path`，后端应尝试基于原图生成缩略图，成功后写回该记录。
11. 读取拍摄事项详情或图片列表时，如果当前照片缺少 `thumbnail_path`，后端应尝试基于原图生成缩略图，成功后写回该记录或在只读响应中返回稳定缩略图路径。
12. 轻量补齐只处理当前接口请求涉及的图片，不写独立全量迁移脚本，不扫描整个 `uploads/` 根目录。
13. 如果原图文件不存在或损坏，应让该图片返回明确错误状态或跳过该图片；不要返回原图 URL 假装缩略图。
14. 删除图片时应同时删除原图和对应缩略图。

### 前端实现要求

重点检查：

```text
frontend/src/app/items/[id]/page.tsx
frontend/src/app/films/[id]/page.tsx
frontend/src/types/index.ts
frontend/src/lib/api.ts
```

器材详情页要求：

1. 图片网格中的 `<img src>` 使用 `photo.thumbnail_url`。
2. 点击图片打开的新窗口仍使用 `photo.url`。
3. 前端不使用 `photo.url` 作为 `<img src>` 的兜底。
4. 正常情况下后端必须返回 `photo.thumbnail_url`；如果仍为空，显示错误占位并暴露问题，不静默加载原图。
5. 删除图片逻辑不变。

照片详情页要求：

1. 图片网格中的 `<img src>` 使用 `photo.thumbnail_url`。
2. 点击图片打开的新窗口仍使用 `photo.url`。
3. 前端不使用 `photo.url` 作为 `<img src>` 的兜底。
4. 手动放入拍摄事项文件夹的图片也应由后端返回 `thumbnail_url`；前端不为手动图片加载原图预览。
5. 设置封面、删除图片逻辑不变。

### 图片加载原则

页面内预览：

```text
thumbnail_url
```

用户点击具体图片后：

```text
url
```

禁止在以下页面的 `<img>` 中直接使用原图：

```text
frontend/src/app/items/page.tsx
frontend/src/app/films/page.tsx
frontend/src/app/dashboard/page.tsx
frontend/src/app/items/[id]/page.tsx
frontend/src/app/films/[id]/page.tsx
```

其中详情页允许 `<a href>`、按钮、打开原图操作使用 `url`。

### 验收标准

- 新上传每一张器材图片后，同目录 `thumbs/` 下都有对应 `.webp` 缩略图。
- 新上传每一张拍摄事项照片后，对应拍摄事项目录的 `thumbs/` 下都有对应 `.webp` 缩略图。
- 手动放入拍摄事项文件夹的允许格式图片，刷新照片详情页后也有对应缩略图 URL。
- 器材详情页图片网格中 Network 面板请求的是 `thumbs/*.webp`。
- 照片详情页图片网格中 Network 面板请求的是 `thumbs/*.webp`。
- 点击器材详情页某张图片后，新窗口打开原图路径。
- 点击照片详情页某张图片后，新窗口打开原图路径。
- API 返回的器材图片和拍摄事项照片均包含非空 `thumbnail_url`，除非原图文件不存在或损坏。
- 没有 `thumbnail_url` 的异常图片不会在页面内预览阶段加载原图。
- 器材汇总页、照片汇总页、Dashboard 仍然只加载缩略图。
- 删除图片、上传图片、设置拍摄事项封面仍正常工作。

### 验证命令

```bash
cd backend
UV_PROJECT_ENVIRONMENT="$HOME/.venvs/camerahub-backend" uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

```bash
cd frontend
NEXT_PUBLIC_API_BASE_URL=http://192.168.32.123:8000 npm run dev
```

浏览器检查：

```text
http://192.168.32.123:3010/items
http://192.168.32.123:3010/items/{id}
http://192.168.32.123:3010/films
http://192.168.32.123:3010/films/{id}
http://192.168.32.123:3010/dashboard
```

Network 面板检查：

```text
页面内图片请求路径应包含 /thumbs/ 和 .webp
点击具体图片打开的新窗口应是原图路径，不是 /thumbs/ 路径
```

文件检查：

```bash
find uploads -path "*/thumbs/*.webp" -type f | sort | head -80
```

如果前端依赖已安装，可以执行：

```bash
cd frontend
npm run lint
```

### 完成后输出

完成后请列出：

1. 修改了哪些文件
2. 详情页 `<img>` 现在使用哪个字段
3. 点击具体图片时使用哪个字段打开原图
4. 每张器材图片和每张拍摄事项照片的缩略图如何生成或补齐
5. 如何启动或测试
6. 下一步应该执行「调试 2」

---

## 调试 2：恢复拍摄事项卡片左侧背景随封面主色调变化

### 目标

照片详情页和 Dashboard 页面中的拍摄事项卡片，左侧纯色背景区恢复为按照封面图主要色调设置。

这里的“拍摄事项卡片”主要包括：

```text
frontend/src/app/dashboard/page.tsx
frontend/src/app/films/page.tsx
```

如果照片详情页中也出现拍摄事项卡片或封面色块区域，也要一起检查：

```text
frontend/src/app/films/[id]/page.tsx
```

当前要求：

- 卡片左侧文字区或纯色背景区使用封面图主色调。
- 封面图变化后，背景色同步变化。
- 没有封面主色调时才使用统一 fallback 色。
- 深色模式和浅色模式下文字仍可读。

### 只允许做

- 修正 `dominant_color` 的生成、保存、读取或前端使用链路。
- 调整 Dashboard 最近拍摄事项卡片背景色。
- 调整照片汇总页拍摄事项卡片背景色。
- 如果照片详情页有同类封面色块，也同步修正。
- 必要时在设置封面时确保新封面有 `dominant_color`。
- 必要时为已有数据库记录在读取时做轻量补齐，但不要写全量迁移脚本。

### 不允许做

- 不要移除封面主色调设计，改成固定色卡。
- 不要只用 Tailwind 固定颜色替代 `dominant_color`。
- 不要在前端从图片像素重新计算主色调。
- 不要引入新的颜色提取库，后端继续使用 Pillow。
- 不要重建数据库。
- 不要做全量图片扫描迁移脚本。
- 不要改变缩略图加载原则。

### 后端实现要求

重点检查：

```text
backend/app/crud.py
backend/app/models.py
backend/app/schemas.py
backend/app/database.py
backend/app/routers/shooting_entries.py
```

要求：

1. `ShootingEntryPhoto` 必须有可选字段：

```text
dominant_color
```

2. `ShootingEntryPhotoRead` 必须返回：

```text
dominant_color
```

3. 页面上传拍摄事项图片时，后端用原图内容计算并保存 `dominant_color`。
4. 手动设置某张图片为封面时，如果该图片 `dominant_color` 为空，应尝试从该图片文件补齐一次。
5. 自动封面图片如果 `dominant_color` 为空，应尝试从该图片文件补齐一次。
6. 如果封面图片是手动放入拍摄事项文件夹、没有数据库记录的图片，返回给前端的封面响应也应尽量带有 `dominant_color`。
7. 轻量补齐只应发生在当前请求涉及的封面或当前拍摄事项图片上，不做全量库迁移。
8. 计算失败时返回 `null`，前端使用 fallback 色，不报错。
9. 设置封面或排序后，列表接口和详情接口返回的第一张照片必须是当前封面。
10. `dominant_color` 格式保持为 6 位十六进制颜色，例如：

```text
#dbe4db
```

### 前端实现要求

重点检查：

```text
frontend/src/app/dashboard/page.tsx
frontend/src/app/films/page.tsx
frontend/src/app/films/[id]/page.tsx
frontend/src/types/index.ts
frontend/src/lib/api.ts
```

要求：

1. `ShootingEntryPhotoRead` 类型必须包含：

```text
dominant_color?: string | null
```

2. Dashboard 最近拍摄事项卡片应使用：

```text
parseColor(cover?.dominant_color)
```

作为左侧纯色背景区和渐变遮罩的基础色。
3. 照片汇总页拍摄事项卡片应使用同样的主色调逻辑。
4. 如果照片详情页存在封面色块或拍摄事项摘要卡片，也应使用封面 `dominant_color`。
5. 如果 `dominant_color` 为空、格式错误或没有封面，才使用 fallback 色。
6. 文本颜色应根据背景亮度计算，保证浅色和深色主色调下都可读。
7. 不要让左侧纯色区域被固定 `bg-muted`、固定 style 或主题变量覆盖。
8. 卡片图片仍然使用 `thumbnail_url`，不要因为颜色修复改回原图。

### 需要重点排查的问题

可能导致颜色不随封面变化的原因包括：

1. 后端返回的 `dominant_color` 为空。
2. 手动设置封面后只改了 `sort_order`，但新封面没有 `dominant_color`。
3. 手动放入文件夹的图片被作为封面返回时没有主色调。
4. 前端类型缺少 `dominant_color`，导致使用时被漏掉。
5. 前端 `entryCover(entry)` 拿到的不是当前封面。
6. 卡片外层样式被固定背景色覆盖。
7. `thumbnail_url` 可用，但 `dominant_color` 没有随封面一起返回。

### 验收标准

- 上传一张偏红封面图后，照片汇总页对应拍摄事项卡片左侧背景接近红色系。
- 上传一张偏蓝封面图并设为封面后，照片汇总页对应卡片左侧背景变为蓝色系。
- Dashboard 最近拍摄事项卡片与照片汇总页使用同一封面主色调。
- 手动切换拍摄事项封面后，刷新页面，卡片左侧背景随新封面变化。
- 没有封面或主色调计算失败时，卡片使用 fallback 色且页面不报错。
- 浅色模式和深色模式下卡片标题、日期、地点、图片数量文字可读。
- 卡片内图片仍然请求 `thumbnail_url`，不加载原图。

### 验证命令

```bash
cd backend
UV_PROJECT_ENVIRONMENT="$HOME/.venvs/camerahub-backend" uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

```bash
cd frontend
NEXT_PUBLIC_API_BASE_URL=http://192.168.32.123:8000 npm run dev
```

浏览器检查：

```text
http://192.168.32.123:3010/films
http://192.168.32.123:3010/films/{id}
http://192.168.32.123:3010/dashboard
```

可选 API 检查：

```bash
curl http://127.0.0.1:8000/api/shooting-entries
curl http://127.0.0.1:8000/api/shooting-entries/{id}
```

检查返回中封面图片是否包含：

```text
dominant_color
thumbnail_url
url
```

如果前端依赖已安装，可以执行：

```bash
cd frontend
npm run lint
```

### 完成后输出

完成后请列出：

1. 修改了哪些文件
2. `dominant_color` 现在在哪里生成或补齐
3. Dashboard 和照片汇总页如何使用封面主色调
4. 封面切换后颜色是否会更新
5. 如何启动或测试
6. 是否还有未完成问题
