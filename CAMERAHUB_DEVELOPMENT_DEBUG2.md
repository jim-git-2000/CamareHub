# CameraHub 下一步调整与调试计划

> 文件用途：记录当前本地开发版的下一阶段调试计划。  
> 主要参考：`CAMERAHUB_DEVELOPMENT_DEBUG.md`。  
> 辅助参考：`CAMERAHUB_DEVELOPMENT_PLAN.md`。  
> 使用方式：每次让 Codex 开发时，请指定只执行某一个“调试 N”。  
> 项目名称：CameraHub  
> 项目类型：个人摄影器材管理系统  
> 当前阶段：本地开发版后续调整。  
> 核心原则：兼容目前 SQLite 数据库格式；图片文件不做旧图兼容，用户会清理旧图片并重新上传，后续 Docker 发布后不影响已有数据库继续使用。

---

## 0. Codex 工作规则

每次让 Codex 开发时，请使用类似下面的指令：

```text
请阅读 CAMERAHUB_DEVELOPMENT_DEBUG2.md，只执行「调试 N」。
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
11. 兼容已有数据库优先：不要要求用户重建 `data/gear.db`；图片不做旧图兼容或迁移，用户会清理旧图片并重新上传。

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

当前代码中已存在：

- `items.purchase_date`
- `items.purchase_price`
- `items.current_value`
- `items.status`
- `photos.file_path`
- `shooting_entry_photos.file_path`
- `transactions` 表和交易记录 API

本阶段必须兼容这些已有数据：

1. 不删除 `transactions` 表，不删除交易记录 API。详情页可以不展示交易记录，但后端兼容保留。
2. 不删除 `archived` 数据。前端不再提供“已归档”选项，但数据库里已有 `archived` 记录仍可被读取。
3. 不强制修改已有 `current_value`。如果已有用户手动填写过当前估值，不能被购买价格覆盖。
4. 图片按重新上传后的新数据处理。新上传图片使用新目录结构；器材图片按上传记录展示，拍摄事项详情图片按对应文件夹展示。
5. 拍摄事项详情图片展示必须限定在对应拍摄事项文件夹内，避免只按文件名查找导致其他文件夹图片被误展示。
6. 所有新增字段如果确实需要，只能追加字段；优先通过现有字段、目录规则和派生 URL 解决。

---

# 4. 后续调试计划

下面的调试计划必须按顺序执行。

---

## 调试 1：最近新增器材改为按购买日期展示

### 目标

Dashboard 的“最近新增器材”不再按创建条目的时间排序，而是按 `purchase_date` 展示和排序。

也就是说：

- 最近购买的器材排在前面。
- 卡片上展示的日期仍然是购买日期。
- 没有购买日期的器材排在有购买日期的器材后面。
- 如果购买日期相同，再用 `created_at` 或 `id` 做稳定排序。

### 只允许做

- 调整统计摘要接口 `/api/stats/summary` 中 `recent_items` 的排序口径。
- 调整 Dashboard 前端兜底加载逻辑。
- 调整 Dashboard 本地 fallback 汇总逻辑。
- 必要时调整 `listItems` 调用的 sort 参数。

### 不允许做

- 不要新增数据库字段。
- 不要迁移数据库。
- 不要改变器材列表页默认排序，除非该页当前就是被 Dashboard 复用导致必须调整。
- 不要改变“最近拍摄事项”的排序逻辑。

### 后端实现要求

重点检查：

```text
backend/app/routers/stats.py
backend/app/crud.py
```

要求：

1. `/api/stats/summary` 的 `recent_items` 使用 `purchase_date desc`。
2. `purchase_date is null` 的记录排在最后。
3. 同一天购买的多条记录排序稳定，可以使用 `created_at desc`、`id desc` 作为次级排序。
4. 如果继续复用 `crud.list_items(sort="-purchase_date")`，要确认 SQLite 下空日期排序符合预期；不符合时单独写查询或前端二次排序。

### 前端实现要求

重点检查：

```text
frontend/src/app/dashboard/page.tsx
frontend/src/lib/api.ts
```

要求：

1. `sortRecentItems` 改为按 `purchase_date` 排序。
2. `fetchDashboardSummary` 中 `listItems` fallback 改为请求 `sort=-purchase_date`。
3. `fetchAllItems` 的 fallback 汇总不再用 `created_at` 推导最近新增器材。
4. Dashboard 卡片中日期展示继续使用 `purchase_date`。

### 验收标准

- 创建三条器材记录，购买日期分别为较早、较晚、空值。
- Dashboard “最近新增器材”中较晚购买日期排在最前。
- 空购买日期记录排在有购买日期记录后面。
- 改变记录创建时间不影响该区域排序。
- `/api/stats/summary` 返回的 `recent_items` 顺序与 Dashboard 一致。

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
http://192.168.32.123:3010/dashboard
```

可选 API 检查：

```bash
curl http://127.0.0.1:8000/api/stats/summary
```

### 完成后输出

完成后请列出：

1. 修改了哪些文件
2. 最近新增器材现在按哪个字段排序
3. 空购买日期如何处理
4. 如何启动或测试
5. 下一步应该执行「调试 2」

---

## 调试 2：购买价格与当前估值逻辑简化

### 目标

器材入库时主要填写购买价格，当前估值默认等于购买价格。只有用户手动修改当前估值时，当前估值才与购买价格不同。

同时调整 items 界面展示：

- 在当前估值前面同一行展示购买价格。
- 显示顺序为“购买价格 / 当前估值”。
- 当前估值为空但购买价格存在的新建场景，应自动保存为购买价格。

器材详情页中：

- 删除“购买记录”“维修记录”“出售记录”三个交易记录卡片展示。
- 不删除后端交易记录表和 API，保证已有数据和后续兼容。

### 只允许做

- 调整 item 创建和更新时的 `current_value` 默认逻辑。
- 调整 item 新建/编辑表单中的购买价格、当前估值交互。
- 调整 items 汇总卡片中的价格展示。
- 调整 items 详情页，去掉交易记录区块和不必要的交易记录请求。

### 不允许做

- 不要删除 `transactions` 表。
- 不要删除 `backend/app/routers/transactions.py`。
- 不要删除 `frontend/src/lib/api.ts` 中交易记录 API 封装，除非确认没有其他引用且不影响兼容。
- 不要把已有手动填写的 `current_value` 覆盖为 `purchase_price`。
- 不要添加购买记录、维修记录、出售记录的新 UI。

### 后端实现要求

重点检查：

```text
backend/app/crud.py
backend/app/schemas.py
backend/app/models.py
```

要求：

1. 创建 item 时，如果 `purchase_price` 有值且 `current_value` 为空，则保存 `current_value = purchase_price`。
2. 更新 item 时：
   - 如果请求明确传入 `current_value`，尊重请求值。
   - 如果请求未传入 `current_value`，不要覆盖已有 `current_value`。
   - 如果请求传入 `current_value: null` 且传入了 `purchase_price`，可以按表单语义保存为 `purchase_price`，但必须确认不会误伤已有手动估值。
3. 不改数据库结构。
4. 不做全量数据迁移。

### 前端实现要求

重点检查：

```text
frontend/src/components/item-form.tsx
frontend/src/app/items/page.tsx
frontend/src/app/items/[id]/page.tsx
frontend/src/lib/api.ts
frontend/src/types/index.ts
```

表单要求：

1. 新建器材时，用户填写购买价格后，如果尚未手动编辑当前估值，则当前估值自动同步为购买价格。
2. 用户手动修改当前估值后，购买价格再次变化不再覆盖当前估值。
3. 编辑已有器材时，如果已有当前估值，不自动覆盖。
4. 当前估值输入框可以保留，但它应是“可选手动调整”的字段。

items 汇总页要求：

1. 每张器材卡片在同一行展示购买价格与当前估值。
2. 顺序必须是购买价格在前，当前估值在后。
3. 示例文案：

```text
购买 ¥8,000 / 估值 ¥8,000
```

4. 小屏幕下不允许文本溢出或遮挡。

详情页要求：

1. 详情页不再请求 `listItemTransactions`。
2. 详情页 state 不再依赖 `transactions`。
3. 删除三个交易记录卡片：

```text
购买记录
维修记录
出售记录
```

4. 基础信息中的购买价格、当前估值仍然展示。

### 验收标准

- 新建器材只填写购买价格，不填写当前估值，保存后详情页当前估值等于购买价格。
- 新建器材填写购买价格后手动改当前估值，保存后保留手动当前估值。
- 编辑已有器材时，已有当前估值不会被购买价格覆盖。
- items 汇总卡片同一行展示购买价格和当前估值。
- items 详情页不再显示购买记录、维修记录、出售记录三个卡片。
- 旧数据库中的 `transactions` 数据仍保留，后端交易记录 API 仍能启动。

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
http://192.168.32.123:3010/items/new
http://192.168.32.123:3010/items/{id}
```

### 完成后输出

完成后请列出：

1. 修改了哪些文件
2. 当前估值默认逻辑如何实现
3. 详情页删除了哪些展示区块
4. 是否改动数据库结构
5. 下一步应该执行「调试 3」

---

## 调试 3：移除“已归档”状态入口并调整总资产估值口径

### 目标

器材状态取消“已归档”这个分类。

前端可选状态只保留：

```text
持有 owned
已出售 sold
愿望单 wishlist
```

总资产估值只根据：

```text
status = owned
```

的器材 `current_value` 计算。

### 只允许做

- 从前端状态选项中移除“已归档”。
- 调整状态筛选选项。
- 调整状态标签映射。
- 调整 `/api/stats/summary` 的总资产估值口径。
- 调整 Dashboard fallback 汇总中的总资产估值口径。
- 如有品牌、类型统计中的估值，也按 owned 口径统一处理。

### 不允许做

- 不要删除数据库中已有 `status = archived` 的记录。
- 不要批量把 `archived` 改成其他状态。
- 不要新增状态系统。
- 不要引入软删除、回收站或归档页面。

### 后端实现要求

重点检查：

```text
backend/app/routers/stats.py
backend/app/crud.py
backend/app/schemas.py
```

要求：

1. `StatsSummaryRead.total_value` 只统计 `Item.status == "owned"` 的 `current_value`。
2. `current_value` 为空时按 0 计算。
3. `sold`、`wishlist`、`archived` 均不进入总资产估值。
4. 如果 `/api/stats/by-brand` 和 `/api/stats/by-type` 返回 `total_value`，也应明确只统计 owned 器材的估值，避免页面口径不一致。
5. 后端可以继续读取和返回 `archived` 状态，保证旧数据兼容。

### 前端实现要求

重点检查：

```text
frontend/src/components/item-form.tsx
frontend/src/app/items/page.tsx
frontend/src/app/items/[id]/page.tsx
frontend/src/app/dashboard/page.tsx
frontend/src/app/stats/page.tsx
```

要求：

1. 新建/编辑表单状态选项移除“已归档”。
2. items 筛选状态选项移除“已归档”。
3. 详情页如果遇到旧数据 `archived`，仍能显示为“已归档”或原始值，不报错。
4. Dashboard fallback 的 `totalValue` 只统计 `status === "owned"` 的器材。
5. 页面文案如果写了“总资产估值”，其含义应是“持有器材当前估值合计”。

### 验收标准

- 新建和编辑器材时不能再选择“已归档”。
- items 筛选中不能再选择“已归档”。
- 旧数据库里已经是 `archived` 的器材仍能打开详情页。
- 总资产估值只统计持有状态器材。
- 已出售、愿望单、已归档器材的当前估值不会进入总资产估值。

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
http://192.168.32.123:3010/dashboard
http://192.168.32.123:3010/items
http://192.168.32.123:3010/stats
```

### 完成后输出

完成后请列出：

1. 修改了哪些文件
2. 哪些地方移除了“已归档”选项
3. 总资产估值现在统计哪些状态
4. 是否影响旧 `archived` 数据读取
5. 下一步应该执行「调试 4」

---

## 调试 4：uploads 图片按器材类型和拍摄事项分文件夹存放

### 目标

新上传图片不再全部直接放在 `uploads/` 根目录，而是按用途分文件夹存放。

器材图片：

```text
uploads/camera/
uploads/lens/
uploads/film/
uploads/accessory/
```

拍摄事项图片：

```text
uploads/shooting-entries/{entry_folder}/
```

其中 `{entry_folder}` 使用拍摄事项的同名文件夹，但必须做安全处理，避免非法路径字符。

### 只允许做

- 调整新上传器材图片的保存目录。
- 调整新上传拍摄事项图片的保存目录。
- 调整图片 URL 生成逻辑，支持子目录。
- 保留 `/uploads` 静态挂载能力；器材图片仍按上传记录展示，拍摄事项图片后续按对应文件夹展示。
- 必要时新增路径清洗 helper。

### 不允许做

- 不要实现图片迁移、旧路径修复或清理脚本。
- 不要重建数据库。
- 不要把图片放入 `frontend/public/`。
- 不要引入 MinIO、S3 或其他对象存储。

### 后端实现要求

重点检查：

```text
backend/app/crud.py
backend/app/main.py
backend/app/core/config.py
backend/app/models.py
```

要求：

1. `UPLOAD_DIR` 仍然作为上传根目录。
2. `create_photo` 根据 item 的 `type` 写入对应子目录：

```text
camera
lens
film
accessory
```

3. `create_shooting_entry_photo` 写入拍摄事项目录：

```text
shooting-entries/{safe_entry_folder}/
```

4. `{safe_entry_folder}` 建议包含 entry id，避免同名冲突。例如：

```text
{entry_id}-{safe_title}
```

5. 文件名继续使用 UUID，避免原始文件名冲突。
6. 数据库 `file_path` 保存相对路径，例如：

```text
uploads/camera/{uuid}.jpg
uploads/shooting-entries/12-weekend-shoot/{uuid}.jpg
```

7. `_photo_url` 和 `_shooting_entry_photo_url` 必须保留子目录，不可再只使用 `path.name`。
8. 删除图片时必须能删除子目录中的新图片；器材图片删除仍以图片记录为准。
9. `app.mount("/uploads", StaticFiles(...))` 保持使用上传根目录。

### 路径要求

新数据路径应为：

```text
uploads/camera/{uuid}.jpg
uploads/lens/{uuid}.jpg
uploads/film/{uuid}.jpg
uploads/accessory/{uuid}.jpg
uploads/shooting-entries/{entry_folder}/{uuid}.jpg
```

实现时必须保证：

1. 新路径生成 URL 为 `/uploads/camera/{uuid}.jpg` 这类带子目录路径。
2. 图片 URL 生成必须保留文件夹信息，不可再只使用 `path.name`。
3. 器材图片按上传记录展示的规则由现有逻辑保留，不额外按文件夹过滤。
4. 拍摄事项图片按对应文件夹展示的规则在「调试 5」实现，本调试只负责让新上传图片进入正确文件夹。
5. 删除文件时根据 `file_path` 解析到 `UPLOAD_DIR` 下的真实路径。
6. 不允许通过 `../` 删除或访问上传目录外的文件。
7. 只按本调试的新路径规则处理图片。

### 前端实现要求

通常前端不需要大改，但要检查：

```text
frontend/src/app/items/page.tsx
frontend/src/app/items/[id]/page.tsx
frontend/src/app/films/page.tsx
frontend/src/app/films/[id]/page.tsx
frontend/src/app/dashboard/page.tsx
frontend/src/lib/api.ts
```

要求：

1. 前端继续使用后端返回的 `url`。
2. 不要自行拼接文件名。
3. `photo.url` 中包含子目录时，图片仍能正常加载。

### 验收标准

- 新上传相机图片保存到 `uploads/camera/`。
- 新上传镜头图片保存到 `uploads/lens/`。
- 新上传胶片图片保存到 `uploads/film/`。
- 新上传配件图片保存到 `uploads/accessory/`。
- 新上传拍摄事项图片保存到 `uploads/shooting-entries/{entry_id}-{safe_title}/`。
- 器材图片按上传记录显示，新上传拍摄事项图片进入对应拍摄事项文件夹。
- 删除新目录中的图片时，只删除对应文件，不影响其他图片。

### 验证命令

```bash
cd backend
UV_PROJECT_ENVIRONMENT="$HOME/.venvs/camerahub-backend" uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

```bash
cd frontend
NEXT_PUBLIC_API_BASE_URL=http://192.168.32.123:8000 npm run dev
```

文件检查：

```bash
find uploads -maxdepth 3 -type f | sort | head -80
```

浏览器检查：

```text
http://192.168.32.123:3010/items/{id}
http://192.168.32.123:3010/films/{id}
```

### 完成后输出

完成后请列出：

1. 修改了哪些文件
2. 新上传图片分别存到哪些目录
3. 器材图片是否仍按上传记录展示
4. 是否添加了图片迁移、旧路径修复或清理脚本
5. 下一步应该执行「调试 5」

---

## 调试 5：器材按上传记录展示，拍摄事项展示对应文件夹全部图片

### 目标

器材图片和拍摄事项图片使用不同展示规则。

器材图片：

```text
上传哪张就显示哪张
按数据库 photos 记录展示
```

说明：

- 器材图片仍然以用户在器材详情页上传的图片记录为准。
- 不额外扫描 `uploads/camera/`、`uploads/lens/`、`uploads/film/`、`uploads/accessory/` 文件夹。
- 不按文件夹自动导入器材图片。
- 器材图片以重新上传后的 `photos` 记录为准。

拍摄事项图片：

```text
展示对应拍摄事项文件夹中的所有图片
```

说明：

- 通过页面上传拍摄事项图片时，图片保存到该拍摄事项对应文件夹。
- 用户也可以直接把图片文件放入该拍摄事项对应文件夹。
- 拍摄事项详情页展示该文件夹内的所有图片。
- 拍摄事项详情页不只依赖 `shooting_entry_photos` 数据库记录。
- 拍摄事项汇总页不需要为每条记录扫描文件夹，避免列表加载变慢。

### 只允许做

- 保持器材图片按 `photos` 表记录展示。
- 调整拍摄事项详情或图片接口读取逻辑，返回对应拍摄事项文件夹内的所有图片。
- 调整拍摄事项图片上传逻辑，确保上传图片保存到对应拍摄事项文件夹。
- 调整拍摄事项图片 URL 生成逻辑，保留目录层级。
- 必要时新增拍摄事项文件夹路径 helper。
- 必要时为文件夹扫描图片构造只读响应对象。

### 不允许做

- 不要让器材图片扫描文件夹自动导入。
- 不要让器材图片按类型文件夹过滤掉已有上传记录。
- 不要实现图片迁移、旧路径修复或清理脚本。
- 不要允许跨文件夹展示图片，例如拍摄事项 A 展示拍摄事项 B 文件夹中的图片。
- 不要把拍摄事项文件夹扫描范围扩大到 `uploads/` 根目录。
- 不要让拍摄事项汇总列表为了每条记录扫描图片文件夹。

### 后端实现要求

重点检查：

```text
backend/app/crud.py
backend/app/models.py
backend/app/schemas.py
backend/app/routers/photos.py
backend/app/routers/shooting_entries.py
```

要求：

1. 器材图片接口继续按 `Photo` 表记录返回图片，不额外扫描目录。
2. 器材图片 URL 生成必须保留 `file_path` 里的目录层级，不允许用 `path.name` 丢掉目录。
3. 拍摄事项上传图片时，目标目录固定为该拍摄事项对应目录：

```text
uploads/shooting-entries/{entry_id}-{safe_title}/
```

4. 拍摄事项详情接口或图片接口读取图片时，扫描该拍摄事项对应目录中的允许图片文件：

```text
jpg
jpeg
png
webp
```

5. 扫描结果和数据库 `shooting_entry_photos` 记录需要合并或统一返回，避免重复展示同一个文件。
6. 手动放入文件夹的图片可以没有数据库记录，但必须能返回：

```text
file_name
url
content_type 可选
file_size 可选
created_at 可选
```

7. 手动放入文件夹的图片如果没有数据库 id，可以使用稳定的虚拟 id 或单独字段标记来源，但前端 key 必须稳定。
8. 拍摄事项图片 URL 只能来自对应文件夹内的安全相对路径。
9. 如果拍摄事项标题变化，必须明确文件夹策略：
   - 推荐不自动重命名旧文件夹，避免移动文件风险。
   - 文件夹定位优先使用 entry id 前缀，例如查找 `uploads/shooting-entries/{entry_id}-*`。
   - 如果已经存在该 entry id 前缀的文件夹，继续使用已有文件夹。
   - 如果不存在，再按当前标题创建 `{entry_id}-{safe_title}`。
10. 如果需要路径 helper，必须限制在 `UPLOAD_DIR` 内运行，禁止 `../` 路径穿越。
11. 拍摄事项文件夹不存在时，应返回空图片列表，不报错。
12. 拍摄事项汇总接口不应逐条扫描文件夹；汇总页封面和数量可以继续使用数据库记录或后续缩略图逻辑。

### 前端实现要求

重点检查：

```text
frontend/src/app/items/page.tsx
frontend/src/app/items/[id]/page.tsx
frontend/src/app/films/page.tsx
frontend/src/app/films/[id]/page.tsx
frontend/src/app/dashboard/page.tsx
frontend/src/types/index.ts
```

要求：

1. 前端继续只使用后端返回的图片列表和 URL。
2. 器材汇总页和器材详情页继续展示用户上传过的器材图片。
3. 前端不要自行扫描或拼接器材类型文件夹。
4. 拍摄事项详情页展示后端返回的对应文件夹全部图片。
5. 拍摄事项详情页能同时展示页面上传图片和手动放入文件夹的图片。
6. 拍摄事项详情页不要展示其他拍摄事项文件夹中的图片。
7. 拍摄事项汇总页不要求展示手动放入文件夹但未上传入库的图片。

### 拍摄事项文件夹说明

拍摄事项对应文件夹规则：

```text
uploads/shooting-entries/{entry_id}-{safe_title}/
```

如果拍摄事项标题发生变化，不自动重命名旧文件夹。后端应优先按 `{entry_id}-` 前缀找到已有文件夹，避免标题变化后图片消失。

用户可以：

1. 在页面上传图片。
2. 直接把图片文件复制到该文件夹。

两种方式的图片都应在拍摄事项详情页显示。

器材图片不采用这种文件夹扫描模式；器材图片仍通过页面上传并按上传记录展示。

### 验收标准

- 器材详情页上传哪张图片就展示哪张图片。
- 器材图片不会因为不在 `camera`、`lens`、`film`、`accessory` 文件夹而被过滤掉。
- 新上传器材图片仍保存到对应类型文件夹。
- 新上传拍摄事项图片保存到对应拍摄事项文件夹。
- 手动复制图片到对应拍摄事项文件夹后，刷新拍摄事项详情页可以看到该图片。
- 拍摄事项详情页展示该拍摄事项文件夹中的所有允许格式图片。
- 拍摄事项详情页不会展示其他拍摄事项文件夹中的图片。
- 拍摄事项文件夹不存在时页面不报错。

### 验证命令

```bash
cd backend
UV_PROJECT_ENVIRONMENT="$HOME/.venvs/camerahub-backend" uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

```bash
cd frontend
NEXT_PUBLIC_API_BASE_URL=http://192.168.32.123:8000 npm run dev
```

文件检查：

```bash
find uploads -maxdepth 3 -type f | sort | head -80
```

浏览器检查：

```text
http://192.168.32.123:3010/items
http://192.168.32.123:3010/items/{id}
http://192.168.32.123:3010/films
http://192.168.32.123:3010/films/{id}
```

### 完成后输出

完成后请列出：

1. 修改了哪些文件
2. 器材图片是否仍按上传记录展示
3. 拍摄事项图片如何读取对应文件夹
4. 手动放入拍摄事项文件夹的图片是否能显示
5. 是否存在跨文件夹误展示风险
6. 下一步应该执行「调试 6」

---

## 调试 6：生成缩略图，汇总页和概览页只加载缩略图

### 目标

器材汇总页面、拍摄事项汇总页面、概览页面中的卡片图片使用缩略图，不加载原图。

只有进入详情页时才加载和展示原图：

```text
items 详情页
拍摄事项详情页
```

### 只允许做

- 为每一张新上传的器材图片生成缩略图。
- 为拍摄事项封面图片生成缩略图。
- 支持自动封面和手动设置封面两种场景下的缩略图生成。
- 为图片返回原图 URL 和缩略图 URL。
- 调整汇总页、概览页使用缩略图。
- 调整详情页继续使用原图。
- 手动放入拍摄事项文件夹的非封面图片可以在详情页显示原图，但不要求为其生成缩略图。

### 不允许做

- 不要引入外部图片服务。
- 不要把缩略图放进 `frontend/public/`。
- 不要强制要求用户重建数据库。
- 不要在汇总页加载原图后再用 CSS 缩小。
- 不要实现旧路径兼容、缩略图补齐或懒生成。
- 不要让汇总页或概览页为了显示手动放入的拍摄事项图片而加载原图。
- 不要因为来回切换拍摄事项封面而为同一张图片重复生成多个缩略图。

### 后端实现要求

重点检查：

```text
backend/app/models.py
backend/app/schemas.py
backend/app/crud.py
```

优先方案：

1. 数据库追加可选字段：

```text
photos.thumbnail_path nullable
shooting_entry_photos.thumbnail_path nullable
```

2. 通过兼容迁移方式添加字段：
   - 如果字段不存在，则 `ALTER TABLE ADD COLUMN`。
   - 如果字段已存在，不重复添加。
   - 不要求重建数据库。
3. 器材图片上传时同时生成缩略图；每条 `photos` 记录最多只有一个缩略图。
4. 缩略图建议保存到同级目录下的 `thumbs/` 子目录：

器材图片示例：

```text
uploads/camera/{uuid}.jpg
uploads/camera/thumbs/{uuid}.webp
```

拍摄事项封面图片示例：

```text
uploads/shooting-entries/12-weekend-shoot/{uuid}.jpg
uploads/shooting-entries/12-weekend-shoot/thumbs/{uuid}.webp
```

5. 缩略图尺寸建议：

```text
宽度 640px 以内
高度 640px 以内
保持比例
格式 webp
质量 75-82
```

6. `PhotoRead` 增加：

```text
thumbnail_url: str | None
```

7. `ShootingEntryPhotoRead` 增加：

```text
thumbnail_url: str | None
```

8. 拍摄事项图片不是上传时全部生成缩略图，而是只为封面图片生成缩略图。
9. 自动封面规则：
   - 如果拍摄事项已有图片但没有手动设置封面，默认第一张图片作为封面。
   - 自动封面图片必须有缩略图。
10. 手动封面规则：
   - 用户手动设置某张拍摄事项图片为封面时，如果该图片还没有缩略图，则生成一次缩略图。
   - 如果该图片已经有缩略图，直接复用，不重复生成。
   - 来回切换封面时，每张图片最多保留一个缩略图。
11. 如果封面图片是手动放入拍摄事项文件夹、没有数据库记录的图片，后端可以按文件路径生成稳定缩略图路径；仍必须保证同一原图最多只有一个缩略图。
12. 手动放入拍摄事项文件夹的非封面图片不要求生成缩略图；详情页可以直接使用原图 URL。
13. 只为新规则下的器材图片和拍摄事项封面生成缩略图，不做旧路径兼容、补齐脚本或懒生成。

### 前端实现要求

重点检查：

```text
frontend/src/types/index.ts
frontend/src/app/items/page.tsx
frontend/src/app/films/page.tsx
frontend/src/app/dashboard/page.tsx
frontend/src/app/items/[id]/page.tsx
frontend/src/app/films/[id]/page.tsx
```

汇总页要求：

1. 器材汇总页卡片使用器材图片的 `thumbnail_url`。
2. 拍摄事项汇总页卡片背景或封面使用封面图片的 `thumbnail_url`。
3. Dashboard 最近拍摄事项卡片如果展示图片或背景，使用封面图片的 `thumbnail_url`。
4. Dashboard 最近新增器材如果后续展示器材图片，也必须使用 `thumbnail_url`。
5. 如果 `thumbnail_url` 为空，显示占位图，不直接加载原图，除非用户进入详情页。
6. 手动放入拍摄事项文件夹但不是封面的图片，不应作为汇总页或概览页原图背景加载。

详情页要求：

1. items 详情页仍使用原图 `url`。
2. 拍摄事项详情页仍使用原图 `url`。
3. 点击图片新窗口打开的仍是原图。
4. 拍摄事项详情页可以展示手动放入对应文件夹的原图。

### 手动图片策略

1. 手动放入对应拍摄事项文件夹的图片可以在详情页显示原图。
2. 只有当手动放入的图片成为封面时，才需要生成缩略图。
3. 汇总页和概览页没有封面缩略图时显示占位图，不加载手动放入的原图。
4. 不把手动图片写入数据库，除非后续另行规划。

器材缩略图针对每张上传图片生成。拍摄事项缩略图只针对封面生成。

### 验收标准

- 新上传器材图片后，同目录 `thumbs/` 下生成缩略图。
- 新上传多张拍摄事项图片后，只为当前封面图片生成缩略图。
- 自动封面图片有缩略图。
- 手动设置拍摄事项封面后，该封面图片有缩略图。
- 来回切换拍摄事项封面时，同一张图片不会生成多个缩略图。
- items 汇总页 Network 面板中卡片图片请求的是缩略图路径，不是原图路径。
- 拍摄事项汇总页 Network 面板中封面图片请求的是缩略图路径，不是原图路径。
- Dashboard 中卡片图片或背景不加载原图。
- items 详情页加载原图。
- 拍摄事项详情页加载原图。
- 手动放入拍摄事项文件夹的图片可以在拍摄事项详情页显示。
- 手动放入拍摄事项文件夹但不是封面的图片不会导致汇总页加载原图。
- 不存在手动图片懒生成缩略图逻辑。

### 验证命令

```bash
cd backend
UV_PROJECT_ENVIRONMENT="$HOME/.venvs/camerahub-backend" uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

```bash
cd frontend
NEXT_PUBLIC_API_BASE_URL=http://192.168.32.123:8000 npm run dev
```

文件检查：

```bash
find uploads -path "*/thumbs/*" -type f | sort | head -80
```

浏览器检查：

```text
http://192.168.32.123:3010/dashboard
http://192.168.32.123:3010/items
http://192.168.32.123:3010/films
http://192.168.32.123:3010/items/{id}
http://192.168.32.123:3010/films/{id}
```

### 完成后输出

完成后请列出：

1. 修改了哪些文件
2. 缩略图保存目录和尺寸策略
3. 器材图片是否每张上传图都有缩略图
4. 拍摄事项是否只为封面生成缩略图
5. 封面切换是否避免重复生成缩略图

---

## 调试 7：右上角工具区增加 GitHub Star 和设置入口

### 目标

调整页面右上角工具区：

1. 在 `API online` 左边增加 GitHub Star 按钮。
2. 设置页面入口不要放在页面中间，移动到右上角工具区。

本调试只处理右上角工具区的 GitHub Star 按钮和设置入口，不做深色模式。

### 只允许做

- 在现有顶部区域或右上角状态区域中增加 GitHub Star 按钮。
- GitHub Star 按钮使用 GitHub 图标和 `Star` 文案。
- 点击 GitHub Star 按钮跳转到：

```text
https://github.com/jim-git-2000/CamareHub
```

- 设置页面入口移动到右上角工具区。
- 保持现有页面布局、路由和数据接口不变。

### 不允许做

- 不要修改后端接口。
- 不要新增数据库字段。
- 不要引入新的全局状态管理库。
- 不要新增登录、权限、用户偏好 API。
- 不要把 GitHub 链接做成页面中部的大卡片或营销区块。
- 不要改变 `API online` 的含义和接口状态检测逻辑。
- 不要实现深色模式、主题切换或 `localStorage` 主题持久化。
- 不要执行调试 8 或后续调试。

### 前端实现要求

重点检查：

```text
frontend/src/app/dashboard/page.tsx
frontend/src/app/items/page.tsx
frontend/src/app/films/page.tsx
frontend/src/app/settings/page.tsx
frontend/src/app/layout.tsx
frontend/src/components/
frontend/src/lib/
```

实现建议：

1. 优先查找项目中是否已有共享导航、顶部栏、状态栏或布局组件。
2. 如果已有共享组件，应在共享组件中实现右上角工具区，避免每个页面重复写一份。
3. 如果目前没有共享组件，可以新增一个轻量组件，例如：

```text
frontend/src/components/top-actions.tsx
```

4. GitHub Star 按钮样式：
   - 放在 `API online` 左侧。
   - 是一个小矩形按钮。
   - 左侧为 GitHub 图标，右侧文字为 `Star`。
   - 点击后新窗口打开 GitHub 项目地址。
   - 建议使用 `target="_blank"` 和 `rel="noreferrer"`。
5. 设置入口：
   - 从页面中间或主要内容区域移除。
   - 放到右上角工具区。
   - 使用设置图标或图标加短文字均可。
6. 如果设置页面内部原来有明显的“返回设置入口”或居中的设置入口卡片，应按现有页面结构做最小调整。
7. 所有新增按钮应适配桌面和移动宽度，不能遮挡 `API online` 状态。

### 验收标准

- Dashboard 右上角 `API online` 左边出现 GitHub 图标加 `Star` 的小矩形按钮。
- 点击 GitHub Star 按钮会跳转到 `https://github.com/jim-git-2000/CamareHub`。
- 设置页面入口位于右上角工具区，不再作为页面中间的主要入口。
- Dashboard、items、films、settings 页面右上角工具区显示一致。
- `API online` 状态仍正常显示。
- 没有新增深色模式相关 UI 或逻辑。
- 没有修改后端接口和数据库结构。

### 验证命令

```bash
cd frontend
NEXT_PUBLIC_API_BASE_URL=http://192.168.32.123:8000 npm run dev
```

浏览器检查：

```text
http://192.168.32.123:3010/dashboard
http://192.168.32.123:3010/items
http://192.168.32.123:3010/films
http://192.168.32.123:3010/settings
```

如果前端依赖已安装，可以执行：

```bash
cd frontend
npm run lint
```

### 完成后输出

完成后请列出：

1. 修改了哪些文件
2. 如何启动或测试
3. GitHub Star 按钮是否可跳转
4. 设置入口是否已移动到右上角
5. 是否有未完成问题
6. 下一步应该执行哪个调试

---

## 调试 8：增加深色模式开关

### 目标

在调试 7 已完成的右上角工具区中增加深色模式按钮或开关，用于切换当前浅色显示效果和深色主题。

本调试只处理深色模式，不再调整 GitHub Star 按钮和设置入口的位置。

### 只允许做

- 在 GitHub Star 按钮左侧增加深色模式按钮或开关。
- 深色模式开关用于切换当前浅色显示效果和深色主题。
- 深色模式状态可以保存在 `localStorage`，刷新页面后保持用户上次选择。
- 调整全局样式或主要页面样式，使深色主题可读且统一。
- 保持现有页面布局、路由和数据接口不变。

### 不允许做

- 不要修改后端接口。
- 不要新增数据库字段。
- 不要新增登录、权限、用户偏好 API。
- 不要移动 GitHub Star 按钮、设置入口或 `API online` 状态。
- 不要重做页面布局。
- 不要只改变深色模式按钮本身，页面主体必须有完整深色主题效果。
- 不要执行调试 9 或后续未定义调试。

### 前端实现要求

重点检查：

```text
frontend/src/app/layout.tsx
frontend/src/app/globals.css
frontend/src/components/
frontend/src/app/dashboard/page.tsx
frontend/src/app/items/page.tsx
frontend/src/app/films/page.tsx
frontend/src/app/settings/page.tsx
```

实现建议：

1. 优先复用调试 7 中的右上角工具区组件。
2. 深色模式开关放在 GitHub Star 按钮左侧。
3. 可以使用图标按钮、Switch 或小型分段按钮。
4. 开关状态要能清楚表达当前处于浅色或深色主题。
5. 如果使用 Tailwind `dark:` 类，应确保根节点或 `html` 有稳定的 `dark` class 切换逻辑。
6. 如果现有 CSS 已有主题变量，应优先复用现有变量，不要重复创造一套互相冲突的颜色系统。
7. 切换后应影响主要页面背景、文字、卡片、边框、按钮、输入框和导航区域。
8. Dashboard、items、films、settings 等主要页面都要检查浅色和深色效果。
9. 刷新页面后，应自动恢复用户上次选择的主题。

### 验收标准

- GitHub Star 按钮左侧出现深色模式开关。
- 深色模式开关可以在当前浅色效果和深色主题之间切换。
- 刷新页面后深色模式选择保持不变。
- Dashboard 页面在浅色和深色模式下文字都可读。
- items 页面在浅色和深色模式下文字都可读。
- films 页面在浅色和深色模式下文字都可读。
- settings 页面在浅色和深色模式下文字都可读。
- `API online`、GitHub Star、设置入口在浅色和深色模式下都清晰可见。
- 没有修改后端接口和数据库结构。

### 验证命令

```bash
cd frontend
NEXT_PUBLIC_API_BASE_URL=http://192.168.32.123:8000 npm run dev
```

浏览器检查：

```text
http://192.168.32.123:3010/dashboard
http://192.168.32.123:3010/items
http://192.168.32.123:3010/films
http://192.168.32.123:3010/settings
```

如果前端依赖已安装，可以执行：

```bash
cd frontend
npm run lint
```

### 完成后输出

完成后请列出：

1. 修改了哪些文件
2. 如何启动或测试
3. 深色模式是否可切换并持久化
4. 哪些页面已检查浅色和深色可读性
5. 是否有未完成问题
6. 下一步应该执行哪个调试

---

# 5. 推荐执行顺序

按下面顺序执行：

```text
调试 1 -> 调试 2 -> 调试 3 -> 调试 4 -> 调试 5 -> 调试 6 -> 调试 7 -> 调试 8
```

原因：

1. 调试 1、2、3 主要调整数据口径和 UI，风险较小。
2. 调试 4 涉及文件路径，必须在拍摄事项文件夹展示和缩略图之前完成。
3. 调试 5 明确器材图片按上传记录展示，拍摄事项图片展示对应文件夹中的全部图片。
4. 调试 6 依赖调试 4 和调试 5 的目录与展示规则，否则缩略图路径会重复返工。
5. 调试 7 是顶部工具区入口调整，不依赖后端数据结构，应放在图片路径与缩略图规则稳定之后执行。
6. 调试 8 基于调试 7 的右上角工具区继续增加深色模式开关，避免一次修改范围过大。

---

# 6. 本阶段最终验收

完成全部调试后，应满足：

1. Dashboard 最近新增器材按购买日期排序。
2. 入库时一般只需填写购买价格，当前估值默认等于购买价格。
3. items 汇总页同一行展示购买价格和当前估值。
4. items 详情页不再展示购买记录、维修记录、出售记录。
5. 前端不再提供“已归档”状态入口。
6. 总资产估值只统计持有状态器材的当前估值。
7. 新上传器材图片按 `camera`、`lens`、`film`、`accessory` 存放。
8. 新上传拍摄事项图片按拍摄事项文件夹存放。
9. 器材图片上传哪张显示哪张，不扫描类型文件夹自动导入。
10. 拍摄事项详情页展示对应拍摄事项文件夹中的全部允许格式图片，包含页面上传和手动放入的图片。
11. 器材每张上传图片都有且最多只有一个缩略图。
12. 拍摄事项只为封面图片生成缩略图，自动封面和手动封面都适用。
13. 拍摄事项来回切换封面时，同一张图片不会重复生成多个缩略图。
14. 汇总页和概览页使用缩略图。
15. 详情页使用原图。
16. 旧数据库可正常启动；图片按重新上传后的新数据处理。
17. 右上角工具区包含 GitHub Star 按钮、`API online` 状态和设置入口。
18. GitHub Star 按钮跳转到项目 GitHub 地址。
19. 深色模式开关位于 GitHub Star 按钮左侧。
20. 深色模式可切换并在刷新后保持选择。
