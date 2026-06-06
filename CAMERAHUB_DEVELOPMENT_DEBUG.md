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

---

## 调试 2：优化拍摄事项汇总页卡片与筛选

### 目标

优化 `/films` 拍摄事项汇总页：

1. 汇总卡片视觉更美观。
2. 筛选器从单一“全部关联器材”改成相机、镜头、胶片三栏多选筛选。

---

### 只允许做

- 只调整 `/films` 拍摄事项汇总页。
- 可以新增前端辅助函数或小组件。
- 如后端现有接口不足以表达多栏筛选，可以在拍摄事项列表 API 中增加筛选参数。
- 保持 `/films/[id]` 详情页现有编辑、删除、上传、设置封面逻辑不变。
- 保持 item 管理页面现有功能不变。

---

### 不允许做

- 不改 `/films` 路由名称。
- 不把编辑、删除、上传图片重新放回汇总页。
- 不新增无关页面。
- 不改变拍摄事项、图片、item 的数据结构，除非筛选接口确实需要轻量扩展。

---

### 卡片视觉调整

当前汇总页每个拍摄事项卡片只展示一张封面图，这是正确的。

需要调整为：

- 封面图移动到卡片最右侧。
- 左侧主体区域使用纯色背景。
- 左侧背景色来自封面图主色。
- 左侧背景与右侧封面图边缘处要平缓过渡。
- 没有封面图时使用稳定的默认低饱和度背景色。
- 卡片仍然整体可点击，点击进入 `/films/{id}`。

建议实现方式：

- 前端读取封面图后用 `canvas` 采样主色或平均色。
- 抽一个 `CoverColorCard` 或局部 helper。
- 卡片背景使用 CSS `linear-gradient`：

```css
linear-gradient(90deg, 主色 0%, 主色 62%, rgba(...) 78%, transparent 100%)
```

实际实现时不要硬套上面的比例，应根据桌面和移动布局调整。

移动端要求：

- 移动端可以保持封面图在上方或右侧，但不能出现文字和图片重叠。
- 文字必须清晰可读。
- 卡片高度不应因图片加载前后大幅跳动。

---

### 筛选调整

当前筛选只有一个：

```text
全部关联器材
```

需要改为三栏：

```text
相机
镜头
胶片
```

每一栏：

- 可以多选。
- 使用 checkbox / dropdown checkbox / popover 多选均可。
- 默认不选择时表示“不限制该类型”。
- 可以只筛选某一栏，例如只筛选某个相机。
- 也可以同时筛选多栏，例如相机 + 镜头 + 胶片。

筛选逻辑：

- 三栏之间是“同时满足”。
- 同一栏内多个选项是“满足任意一个”。

示例：

```text
相机：富士 XH-1、佳能 RP
镜头：富士 XC15-45
胶片：不选择
```

含义：

```text
拍摄事项必须关联 富士 XH-1 或 佳能 RP
并且必须关联 富士 XC15-45
胶片不限
```

---

### 后端 API 建议

如果前端现有数据量较小，可以先前端筛选。

但更稳妥的方式是在后端列表 API 支持：

```text
GET /api/shooting-entries?camera_item_ids=1,2&lens_item_ids=3,4&film_item_ids=5
```

或重复参数：

```text
GET /api/shooting-entries?camera_item_ids=1&camera_item_ids=2&lens_item_ids=3
```

实现时优先选择与当前 API helper 最容易维护的方式。

要求：

- 不选择某栏时不传该栏参数。
- 每个栏内按 OR 匹配。
- 栏与栏之间按 AND 匹配。
- 分页 total 应按筛选后的结果计算。

---

### 前端实现要求

更新：

```text
frontend/src/app/films/page.tsx
frontend/src/lib/api.ts
```

可能新增：

```text
frontend/src/components/shooting-entry-filter.tsx
frontend/src/components/shooting-entry-card.tsx
```

要求：

- 相机选项只来自 `item.type === "camera"`。
- 镜头选项只来自 `item.type === "lens"`。
- 胶片选项只来自 `item.type === "film"`。
- 多选状态清晰可见。
- 能一键清空某一栏选择。
- 搜索框仍然保留。
- 搜索框与三栏筛选同时生效。

---

### 验收标准

- `/films` 汇总页卡片封面在右侧。
- 有封面图时，左侧背景色接近封面主色。
- 左侧背景与右侧封面边缘过渡自然。
- 无封面图时卡片仍然美观。
- 汇总页不出现编辑、删除、上传图片按钮。
- 汇总页不展示全部图片，只展示封面。
- 筛选区域包含相机、镜头、胶片三栏。
- 每栏可以多选。
- 只选相机时筛选正确。
- 只选镜头时筛选正确。
- 只选胶片时筛选正确。
- 同时选择相机、镜头、胶片时按 AND 逻辑筛选。
- 搜索关键字与三栏筛选可以同时生效。
- 手机浏览器布局正常。

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

启动检查：

```bash
cd backend
UV_PROJECT_ENVIRONMENT="$HOME/.venvs/camerahub-backend" uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

```bash
cd frontend
NEXT_PUBLIC_API_BASE_URL=http://192.168.32.123:8000 npm run dev -- -p 3010
```

---

### 完成后输出

```text
调试 2 完成。
修改文件：...
筛选逻辑：...
验证结果：...
仍需人工检查的问题：...
下一步：调试 3。
```

---

## 调试 3：修复 DELETE 后空响应 JSON 解析错误

### 目标

修复删除操作后前端报错：

```text
Unexpected end of JSON input
```

以及：

```text
Failed to execute 'json' on 'Response': Unexpected end of JSON input
```

已知触发场景：

- 删除 item 后出现 `Unexpected end of JSON input`。
- 删除拍摄事项详情中的一张图片后出现 `Failed to execute 'json' on 'Response': Unexpected end of JSON input`。

---

### 原因判断

后端 DELETE 接口返回 `204 No Content`。

前端 `parseResponse` 当前会尝试按 JSON 解析响应体。

当响应体为空时，调用：

```ts
response.json()
```

会抛出：

```text
Unexpected end of JSON input
```

---

### 只允许做

- 优先修复前端通用 API 解析逻辑。
- 可以补充少量删除流程验证。
- 不改变后端 DELETE 接口语义。
- 不把 DELETE 改成返回假 JSON，除非前端无法统一修复。

---

### 实现要求

更新：

```text
frontend/src/lib/api.ts
```

要求：

- `204 No Content` 直接返回，不解析 JSON。
- `Content-Length: 0` 或空响应体也不能报 JSON 解析错误。
- 非 2xx 响应仍然要正常解析错误信息。
- 兼容 JSON 响应与文本响应。

建议逻辑：

- 如果 `response.status === 204`，直接返回 `undefined as T`。
- 否则根据 `content-type` 判断是否 JSON。
- 对 JSON 响应可先读取 text，再判断是否为空：

```ts
const raw = await response.text();
const payload = raw ? JSON.parse(raw) : undefined;
```

这样可以避免空 body 调用 `response.json()`。

---

### 验收标准

- 删除 item 成功后不再出现 `Unexpected end of JSON input`。
- 删除拍摄事项详情中的单张图片成功后不再出现 JSON 解析错误。
- 删除拍摄事项成功后不出现 JSON 解析错误。
- 删除 item 图片成功后不出现 JSON 解析错误。
- 非 2xx API 错误仍能显示错误信息。
- 前端构建通过。

---

### 验证命令

前端构建：

```bash
cd frontend
npm run build
```

人工验证：

```text
1. 删除一个 item。
2. 删除一个 item 详情页图片。
3. 删除一个拍摄事项详情页图片。
4. 删除一个拍摄事项。
5. 确认浏览器界面和 console 不再出现空 JSON 解析错误。
```

---

### 完成后输出

```text
调试 3 完成。
修改文件：...
修复原因：...
验证结果：...
仍需人工检查的问题：...
下一步：调试 4。
```

---

## 调试 4：Dashboard 增加最近拍摄事项

### 目标

在 dashboard 页面增加“最近拍摄事项”展示，显示最近 5 条拍摄事项。

---

### 只允许做

- 只调整 dashboard 相关展示和必要 API 调用。
- 可以复用已有拍摄事项列表 API。
- 不新增 dashboard 之外的大功能。
- 不改变 `/films` 和 `/films/[id]` 的核心交互。

---

### 前端实现要求

更新：

```text
frontend/src/app/dashboard/page.tsx
```

可能更新：

```text
frontend/src/lib/api.ts
frontend/src/types/index.ts
```

要求：

- 使用已有 `listShootingEntries`。
- 请求最近 5 条：

```text
page=1
page_size=5
```

- 展示标题、日期、地点、照片数量。
- 每条可以点击进入 `/films/{id}`。
- 无拍摄事项时显示空状态。
- API 加载失败时不影响 dashboard 其他统计卡片显示。

---

### UI 要求

- 与 dashboard 现有卡片风格保持一致。
- 不做营销式大 hero。
- 信息密度适中，方便快速扫描。
- 最近拍摄事项应作为 dashboard 的一块功能区，而不是替代现有内容。

---

### 验收标准

- `/dashboard` 显示“最近拍摄事项”。
- 最多展示 5 条。
- 最近拍摄事项按创建时间倒序。
- 每条显示标题。
- 每条显示日期或未填写日期。
- 每条显示地点或未填写地点。
- 每条显示照片数量。
- 点击条目可以进入对应拍摄事项详情页。
- 无拍摄事项时有空状态。
- 拍摄事项 API 失败时 dashboard 其他内容仍可显示。
- 前端构建通过。

---

### 验证命令

前端构建：

```bash
cd frontend
npm run build
```

人工验证：

```text
1. 打开 /dashboard。
2. 确认最近拍摄事项显示最近 5 条。
3. 点击其中一条进入 /films/{id}。
```

---

### 完成后输出

```text
调试 4 完成。
修改文件：...
新增展示：...
验证结果：...
仍需人工检查的问题：...
下一步：调试 5。
```

---

## 调试 5：美化 Dashboard / Stats 四个统计卡片背景

### 目标

美化 dashboard 和 stats 界面的四个核心统计卡片背景：

```text
总资产估值
相机数量
镜头数量
胶片库存
```

要求使用低饱和度、小清新、纯色背景。

---

### 只允许做

- 只调整四个统计卡片的视觉样式。
- 可以抽取共享样式配置。
- 不改变统计数据来源和计算逻辑。
- 不改变 dashboard / stats 的页面结构，除非为了复用样式做轻量整理。

---

### 视觉要求

背景：

- 使用纯色或非常轻微的单色层次。
- 颜色低饱和度。
- 不使用大面积渐变。
- 不使用紫蓝重渐变。
- 不使用深色重背景。
- 不使用装饰性光斑、圆球、bokeh。

建议色彩方向：

```text
总资产估值：低饱和度薄荷绿 / 青绿色
相机数量：低饱和度天空蓝
镜头数量：低饱和度薰衣草灰
胶片库存：低饱和度暖黄 / 杏色
```

注意：

- 文本对比度必须足够。
- 卡片里的数字和标题不能被背景影响可读性。
- 卡片边框、hover 状态要与现有设计系统协调。

---

### 前端实现要求

更新：

```text
frontend/src/app/dashboard/page.tsx
frontend/src/app/stats/page.tsx
```

如果两处代码重复明显，可以新增共享配置：

```text
frontend/src/lib/stat-card-styles.ts
```

或局部常量：

```ts
const statCardStyles = {
  totalValue: "...",
  cameraCount: "...",
  lensCount: "...",
  filmStock: "..."
};
```

要求：

- dashboard 和 stats 对应四张卡片颜色保持一致。
- 不影响其他统计图表、列表、最近 items、最近拍摄事项。
- 移动端布局正常。

---

### 验收标准

- dashboard 的四个统计卡片使用新的低饱和度纯色背景。
- stats 的四个统计卡片使用相同的背景方案。
- 四个卡片颜色彼此有区分。
- 文本可读性正常。
- 数字、标题、辅助说明不溢出。
- 页面没有大面积单一色系压迫感。
- 前端构建通过。

---

### 验证命令

前端构建：

```bash
cd frontend
npm run build
```

人工验证：

```text
1. 打开 /dashboard。
2. 打开 /stats。
3. 检查四个统计卡片在桌面和手机宽度下的视觉效果。
```

---

### 完成后输出

```text
调试 5 完成。
修改文件：...
视觉调整：...
验证结果：...
仍需人工检查的问题：...
下一步：调试 6。
```
