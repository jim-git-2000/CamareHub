# CameraHub 后续调整与调试计划

> 文件用途：记录第一阶段完成后的后续调整计划。  
> 使用方式：每次让 Codex 开发时，请指定只执行某一个“调试 N”。  
> 项目名称：CameraHub  
> 项目类型：个人摄影器材管理系统  
> 当前阶段：本地开发版后续调整。  
> 暂不开发：Docker、PWA、HTTPS、域名部署、PostgreSQL、Redis、MinIO、复杂登录系统。

---

## 0. Codex 工作规则

每次让 Codex 开发时，请使用类似下面的指令：

```text
请阅读 CAMERAHUB_DEVELOPMENT_DEBUG.md，只执行「调试 N」。
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
10. 如果调试涉及删除实际图片文件，必须有二次确认或明确的删除路径。

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

# 3. 后续调试计划

下面的调试计划必须按顺序执行。

---

## 调试 1：将 `/films` 改为照片记录 / 拍摄事项页

### 目标

把现有 `/films` 占位页改成“照片记录”功能页。

每个条目代表一次拍摄事项，可以记录：

- 时间
- 地点
- 标题
- 备注
- 对应相机
- 对应镜头
- 对应胶片
- 其他关联器材
- 多张照片

说明：

- `/films` 从此不再作为胶片库存页。
- 胶片库存仍保留在 `/items?type=film`、Dashboard 和 Stats 中。
- 照片记录不是器材详情页里的器材图片；它是独立的拍摄事项记录。

### 只允许做

- 新增照片记录相关数据表
- 新增照片记录 API
- 将 `/films` 页面改为照片记录页面
- 拍摄事项创建、编辑、删除
- 拍摄事项图片上传、预览、删除
- 拍摄事项关联已有 items
- 导航文案调整

### 不允许做

- 不要写 Docker
- 不要写 PWA
- 不要写登录系统
- 不要写地图功能
- 不要写 EXIF 自动解析
- 不要写胶片库存自动扣减
- 不要改造现有器材图片表为通用图片表
- 不要破坏 `/items`、`/items/[id]` 现有功能

---

### 后端数据模型

新增表：

```text
shooting_entries
shooting_entry_items
shooting_entry_photos
```

#### shooting_entries

拍摄事项主表。

字段：

```text
id
title
date
location
notes
created_at
updated_at
```

字段说明：

- `title` 必填。
- `date` 可选，使用 date。
- `location` 可选。
- `notes` 可选。

#### shooting_entry_items

拍摄事项与器材的关联表。

字段：

```text
id
entry_id
item_id
role
```

`role` 固定为：

```text
camera
lens
film
other
```

说明：

- 一个拍摄事项可以关联多个器材。
- 可以关联多个镜头。
- 可以关联多个胶片或其他器材。
- 关联 item 不存在时，API 应返回 400。

#### shooting_entry_photos

拍摄事项图片表。

字段：

```text
id
entry_id
file_path
file_name
content_type
file_size
sort_order
created_at
```

说明：

- 图片仍保存到 `uploads/`。
- 不复用现有 `photos` 表，避免污染器材图片模型。
- 删除拍摄事项时，应删除图片记录和实际文件。
- 删除单张图片时，也应删除实际文件。

---

### 后端 API

新增 router：

```text
backend/app/routers/shooting_entries.py
```

在 `backend/app/main.py` 中注册：

```text
app.include_router(shooting_entries.router, prefix="/api")
```

#### GET /api/shooting-entries

查询拍摄事项列表。

Query 参数：

```text
keyword
item_id
page
page_size
```

返回：

```text
items
page
page_size
total
```

每个条目应包含：

- 基本信息
- 关联 items
- 图片列表或至少首图
- 图片数量

#### GET /api/shooting-entries/{entry_id}

查询单个拍摄事项详情。

不存在返回 404。

#### POST /api/shooting-entries

创建拍摄事项。

请求包含：

```text
title
date
location
notes
item_links
```

`item_links` 每项包含：

```text
item_id
role
```

#### PUT /api/shooting-entries/{entry_id}

更新拍摄事项。

说明：

- 基本字段可更新。
- `item_links` 采用整体替换策略。
- 如果请求中传入 `item_links`，先删除旧关联，再写入新关联。

#### DELETE /api/shooting-entries/{entry_id}

删除拍摄事项。

必须删除：

- 主记录
- 关联 items
- 图片记录
- 实际图片文件

#### POST /api/shooting-entries/{entry_id}/photos

上传拍摄事项图片。

请求：

```text
multipart/form-data
file
```

限制：

- 支持 jpg、jpeg、png、webp
- 单张最大 10MB

#### GET /api/shooting-entries/{entry_id}/photos

查询拍摄事项图片列表。

#### DELETE /api/shooting-entry-photos/{photo_id}

删除单张拍摄事项图片。

必须删除：

- 图片记录
- 实际图片文件

---

### 后端实现要求

应新增或更新：

```text
backend/app/models.py
backend/app/schemas.py
backend/app/crud.py
backend/app/routers/shooting_entries.py
backend/app/main.py
```

复用现有逻辑：

- 图片格式校验
- 图片大小限制
- 上传目录解析
- 删除实际文件

注意：

- 不要改变现有 `Photo` 表和器材图片 API。
- 新表使用 SQLModel 自动建表。
- 第一版不写 Alembic migration。
- SQLite 已存在时，SQLModel 会自动创建新增表；不应删除旧数据。

---

### 前端页面

重做：

```text
frontend/src/app/films/page.tsx
```

页面定位：

```text
照片记录
```

页面内容：

- 标题：照片记录
- 新增记录按钮
- 搜索框
- 按关联器材筛选
- 拍摄事项卡片列表
- 空状态

卡片内容：

- 封面图
- 标题
- 日期
- 地点
- 关联设备 badges
- 图片数量
- 备注摘要
- 编辑按钮
- 删除按钮

---

### 前端表单

可以使用 Dialog 或页面内表单。第一版推荐使用 Dialog，避免新增更多路由。

表单字段：

```text
title
date
location
notes
camera item
lens items
film item
other items
```

校验：

- `title` 必填。
- 关联设备可选，但 UI 提示建议至少选择相机或镜头。

关联 items：

- 从 `GET /api/items?page_size=100` 加载。
- 按 `type` 分组：
  - camera
  - lens
  - film
  - accessory
- 选择后写入 `item_links`。

---

### 前端图片管理

每个拍摄事项详情或展开区域支持：

- 上传图片
- 图片网格预览
- 点击图片打开原图
- 删除图片按钮
- 删除前二次确认
- 上传后自动刷新图片列表
- 删除后自动刷新图片列表

图片限制提示：

```text
支持 jpg、jpeg、png、webp，单张最大 10MB
```

---

### 前端 API 与类型

更新：

```text
frontend/src/lib/api.ts
frontend/src/types/index.ts
```

新增类型：

```text
ShootingEntryRead
ShootingEntryCreate
ShootingEntryUpdate
ShootingEntryItemLink
ShootingEntryPhotoRead
ShootingEntryListResponse
```

新增 API helper：

```text
listShootingEntries
getShootingEntry
createShootingEntry
updateShootingEntry
deleteShootingEntry
uploadShootingEntryPhoto
listShootingEntryPhotos
deleteShootingEntryPhoto
```

---

### 导航调整

当前导航：

```text
Films
```

建议改为：

```text
Photos
```

路径仍然保留：

```text
/films
```

原因：

- 避免改路由带来额外迁移。
- 但导航文案应符合新功能语义。

---

### 验收标准

- `/films` 可以访问。
- 页面标题显示照片记录。
- 可以新增拍摄事项。
- 可以编辑拍摄事项。
- 可以删除拍摄事项，并有二次确认。
- 可以关联已有相机。
- 可以关联已有镜头。
- 可以关联已有胶片。
- 可以关联其他 items。
- 可以上传 jpg/jpeg/png/webp 图片。
- 超过 10MB 或非图片类型会被拒绝。
- 上传后自动刷新图片列表。
- 可以预览图片。
- 可以删除单张图片，并有二次确认。
- 删除图片后实际文件被删除。
- 删除拍摄事项后其图片记录和实际文件被删除。
- 没有记录时显示空状态。
- 手机浏览器布局正常。
- `/items` 和 `/items/[id]` 原有器材图片功能不受影响。

---

### 验证命令

后端语法检查：

```bash
python3 -m py_compile backend/app/main.py backend/app/models.py backend/app/schemas.py backend/app/crud.py backend/app/routers/*.py
```

前端构建：

```bash
cd frontend
npm run build
```

后端启动：

```bash
cd backend
UV_PROJECT_ENVIRONMENT="$HOME/.venvs/camerahub-backend" uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

前端启动：

```bash
cd frontend
NEXT_PUBLIC_API_BASE_URL=http://192.168.32.123:8000 npm run dev
```

---

### 完成后输出

```text
调试 1 完成。
修改文件：...
新增 API：...
数据库变化：...
验证结果：...
仍需人工检查的问题：...
下一步：调试 2。
```
