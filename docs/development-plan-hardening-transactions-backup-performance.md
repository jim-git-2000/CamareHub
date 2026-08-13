# CameraHub 稳定性、交易、备份与性能开发计划

- 状态：开发与自动化验收完成，等待 Docker 环境验收
- 制定日期：2026-08-13
- 适用版本基线：`0.3.0`
- 适用范围：前端发布门禁、SQLite 兼容迁移、器材交易界面、备份恢复、器材与拍摄事项列表性能
- 权威合同：使用与部署以 `README.md`、`README_zh.md` 为准，API 以 `docs/api.md` 为准，数据库与迁移以 `docs/database.md` 为准
- 文档生命周期：本计划只在开发和验收期间保留。全部任务完成后，把长期有效的行为同步到上述权威文档，再删除本文件，避免 `docs/` 留存已完成计划

2026-08-13 实施进度：阶段 0–5 已完成；器材列表封面、facets、器材与拍摄事项渐进加载、超过 100 条数据的完整读取，以及拍摄事项器材选择器按类型和关键词服务端搜索均已落地。后端 23 项回归测试、前端 lint、TypeScript 与 production build 已通过。当前环境没有 Docker，尚不能执行 `docker compose config` 和容器内维护命令验收，因此本计划继续保留。

## 1. 总目标

本轮按“先恢复发布能力，再消除数据风险，最后补产品闭环和扩展能力”的顺序完成五项工作：

1. 修复前端 lint 与 production build，使现有发布门禁全部恢复绿色。
2. 把启动时静默删除重复图片记录的逻辑改造成自动备份、可审计、幂等且可回滚的兼容迁移。
3. 在器材详情页补齐交易记录的新增、查看、编辑和删除界面。
4. 提供本地与 Docker 均可使用的一键备份、校验和受控恢复命令。
5. 消除器材列表 N+1 图片请求、全量拉取和拍摄事项 `100` 条截断问题。

本轮完成后应达到以下用户结果：

- 正常代码可以通过 lint、类型检查和 production build，不再依赖忽略错误发布。
- 旧数据库升级前自动留下恢复点，重复记录如何处理有明确审计证据。
- 用户无需调用 API 即可维护器材的完整交易历史。
- 用户可以用一条项目命令生成可校验备份，并能在恢复失败时回到恢复前状态。
- 数据增长到数百件器材和数百条拍摄事项时，列表仍完整、可分页，且不会为每张卡片额外请求一次图片接口。

## 2. 不可退让的约束

### 2.1 数据兼容

- 不修改现有字段语义，不删除旧字段，不要求重新录入器材、交易、拍摄事项或图片。
- 所有 schema 变化必须是增量式的；旧版 `data/gear.db`、`uploads/` 和 `data/quote_banner.txt` 必须可被新版直接使用。
- 迁移必须自动、幂等、可审计、可回滚。任何需要从现役表移出记录的操作，都必须先创建数据库备份，并在数据库内保留原始记录副本和迁移标识。
- 必须使用旧版本数据库副本验证首次升级、重复启动和回滚，不得用用户真实数据库直接试验。
- 文件恢复不得在校验归档失败时覆盖现有数据；恢复前必须自动创建一份恢复前备份。

### 2.2 交互

- 默认展示用户完成目标所需的最少信息，高级字段按需展开。
- 所有保存、删除、备份、恢复和分页动作必须有明确的加载、成功、失败与下一步反馈。
- 交易删除和数据恢复必须明确影响范围；恢复操作只通过维护命令提供，不放进普通网页按钮。
- 不因性能优化改变现有排序、筛选、封面、资产统计或自由文本字段语义。

### 2.3 工程与目录

- 开始新增维护命令或服务目录前，先在 `AGENTS.md` 规定其职责、命名和测试位置，再创建目录。
- 建议新增 `backend/app/maintenance/`：只放备份、恢复和迁移维护命令；业务 API 不放入该目录。
- 建议新增 `backend/app/services/`：只放可被启动迁移和维护命令共同复用的备份、校验等无 HTTP 状态逻辑。
- 后端测试继续放在 `backend/tests/test_<domain>.py`，只使用内存数据库或 `/tmp` 临时目录。
- 不新增数据库迁移框架或前端状态管理库；优先使用 Python 标准库、现有 SQLAlchemy/SQLModel 和现有 React 组件体系。
- 本轮不自动执行版本发布、Git tag、`git push` 或生产恢复。

## 3. 当前基线

### 3.1 前端门禁

2026-08-13 复核结果：

- `npm run lint`：11 个错误、7 个 warning。
- `npm run build`：Webpack 编译成功，随后 TypeScript worker 退出，构建失败。
- 独立执行 `node node_modules/typescript/bin/tsc --noEmit`：通过。

已知问题类别：

- 渲染期间动态创建图标组件：`dashboard/page.tsx`、`items/page.tsx`。
- effect 内同步 `setState`：器材详情、器材编辑、拍摄事项详情、器材列表、主题初始化和拍摄事项表单。
- 空接口类型：`components/ui/input.tsx`、`components/ui/textarea.tsx`。
- CommonJS `require`：`tailwind.config.ts`。
- 未使用导入：`films/page.tsx`。
- 原生 `<img>` warning：仪表盘、器材、拍摄事项及应用头部。

### 3.2 数据库启动兼容

`backend/app/database.py` 当前在建立 `uq_shooting_entry_photos_entry_file_path` 索引前执行 `DELETE FROM shooting_entry_photos`，仅保留每组最小 `id`。这会静默丢弃数据库记录，没有迁移备份、冲突清单或回滚入口，与项目数据兼容红线冲突。

### 3.3 交易记录

后端已经支持：

- `GET /api/items/{item_id}/transactions`
- `POST /api/items/{item_id}/transactions`
- `PUT /api/transactions/{transaction_id}`
- `DELETE /api/transactions/{transaction_id}`

前端只有 `listItemTransactions` 和 `TransactionRead`，没有创建、更新、删除请求函数，也没有交易列表或表单界面。

### 3.4 备份与恢复

README 目前提供手工复制数据库、一言配置和压缩 `uploads/` 的命令，但没有：

- SQLite 一致性快照；
- 归档格式和 manifest；
- 文件校验和；
- 归档内容与路径安全验证；
- 恢复前自动备份；
- 恢复失败回滚；
- Docker 内统一命令。

### 3.5 列表性能和完整性

- 器材页先循环拉取所有分页，再为每件器材调用一次图片列表接口，形成 N+1 请求。
- 品牌、镜头卡口和相机类型选项依赖拉取全部器材后在浏览器计算。
- 拍摄事项页和拍摄事项表单只请求前 `100` 条数据或器材，超过部分不可见、不可选择。
- 器材页没有面向用户的真实分页或渐进加载，数据量增长后首屏等待时间会持续增加。

## 4. 目标设计

### 4.1 发布门禁

前端保持当前 ESLint 规则强度，不关闭 `react-hooks/static-components`、`react-hooks/set-state-in-effect`、`@next/next/no-img-element` 等规则，不通过注释或 ignore 掩盖问题。

修复原则：

- 图标渲染使用模块级稳定组件或模块级映射，不在组件渲染函数中制造新的组件类型。
- 无效路由参数作为派生状态处理；异步请求 effect 只负责与外部 API 同步。
- 表单需要随弹窗打开重置时，用有明确 `key` 的内部表单组件或在打开动作中初始化，不用同步 effect 重灌整份 state。
- 主题首屏通过服务端可接受的默认值、初始化脚本或稳定的懒初始化方案处理，避免 hydration 闪烁。
- 上传图片使用 `next/image`；对本地 `/uploads/...` 资源允许 `unoptimized`，避免引入远程图片域名和缓存语义变化。

### 4.2 可回滚兼容迁移

引入最小的命名迁移机制，不引入 Alembic：

- `schema_migrations` 记录迁移名、执行时间、备份路径和结果。
- `migration_shooting_entry_photo_duplicates` 保存被判定为重复的完整原始行、迁移名和归档时间。
- 迁移开始前使用 SQLite backup API 在 `backups/` 生成一致性数据库副本。
- 先复制所有冗余行到冲突归档表并核对数量，再从现役表移出冗余行，最后建立唯一索引。
- 图片原文件和缩略图一个都不删除；同组保留行继续引用原路径。
- 迁移重复执行时检测迁移记录、归档行和索引状态，不重复归档、不重复删除。
- 备份失败、归档计数不一致或索引创建失败时回滚当前事务，保留原数据库状态并阻止应用以“迁移成功”继续启动。
- 提供明确的数据库回滚维护命令；回滚要求停止服务，并在替换数据库前再次保存当前数据库。

### 4.3 交易记录界面

器材详情页新增“交易记录”卡片：

- 默认按创建时间倒序展示；每条显示类型、金额、币种、日期、商家和备注。
- 空列表给出“暂无交易记录”和“新增交易”主动作。
- 新增和编辑共用一个弹窗表单。
- 类型使用现有值：`purchase`、`repair`、`sale`、`maintenance`、`accessory`。
- 金额允许为空；填写时必须是有限且不小于零的数值。币种默认继承器材币种。
- 删除使用二次确认，并在成功后原位刷新交易列表。
- 交易记录只作为账本，不自动修改器材 `status`、`purchase_price` 或 `current_value`，避免隐式覆盖用户数据。

### 4.4 一键备份与恢复

统一维护命令建议为：

```bash
cd backend
uv run python -m app.maintenance backup
uv run python -m app.maintenance verify /path/to/archive
uv run python -m app.maintenance restore /path/to/archive
```

Docker 使用相同 Python 入口，不增加 shell 包装器：

```bash
docker compose run --rm backend uv run python -m app.maintenance backup
docker compose run --rm backend uv run python -m app.maintenance verify /app/backups/<archive>
```

恢复必须先停止服务，再执行：

```bash
docker compose stop frontend backend
docker compose run --rm backend uv run python -m app.maintenance restore /app/backups/<archive>
docker compose up -d
docker compose ps
```

备份归档至少包含：

- SQLite 一致性快照 `data/gear.db`；
- 可选的 `data/quote_banner.txt`；
- `uploads/` 全部原图和缩略图；
- `manifest.json`。

`manifest.json` 至少记录：归档格式版本、CameraHub 版本、创建时间、源数据库 schema 信息、每个文件的相对路径、字节数和 SHA-256。

恢复顺序固定为：

1. 在临时目录安全解包，拒绝绝对路径、`..` 和链接逃逸。
2. 校验 manifest、文件数量、大小和 SHA-256。
3. 对临时数据库执行 `PRAGMA integrity_check`。
4. 自动生成恢复前完整备份并再次验证。
5. 替换数据库、一言配置和上传文件。
6. 再次执行数据库完整性检查及文件清单校验。
7. 任一步失败时恢复到第 4 步生成的恢复点，并返回可执行的错误说明。

`docker-compose.yml` 增加 `./backups:/app/backups` 挂载；`backups/` 继续由 Git 忽略。

### 4.5 列表 API 与交互

使用兼容的增量 API 变化：

- `ItemRead` 新增可空 `cover_photo`，器材列表一次返回封面缩略图信息；旧客户端忽略新字段即可。
- 新增 `GET /api/items/facets`，返回未筛选全集的 `brands`、`lens_mounts` 和 `camera_types`，不再为筛选选项拉取全部器材。
- 器材列表继续使用 `GET /api/items` 的现有分页合同，前端改为页码分页或“加载更多”；筛选变化时回到第一页。
- 拍摄事项列表增加真实分页或“加载更多”，不得用 `page_size=100` 冒充全部数据。
- 拍摄事项器材选择器支持按器材类型和关键词服务端搜索，并能保留已选但不在当前搜索页中的器材。
- 列表返回封面不得触发批量缩略图写入；旧记录缺少缩略图时允许返回原图 URL 作为兼容降级，缩略图补齐继续由明确的图片读取或维护流程负责。

## 5. 分阶段实施

### 阶段 0：规则和可复现基线

1. 在 `AGENTS.md` 先补充 `backend/app/maintenance/`、`backend/app/services/` 的目录职责和命名规则。
2. 保存当前 lint、build、后端测试输出作为开发基线，不修改规则强度。
3. 为五项工作建立测试文件清单；任何持久化测试必须使用 `/tmp`。
4. 确认 `data/gear.db`、`data/quote_banner.txt`、`uploads/` 和 `backups/` 均不被 Git 新增跟踪。

完成标准：新目录约定先于实践存在；基线问题可稳定复现；没有测试接触用户真实数据。

### 阶段 1：恢复前端门禁

预计修改：

- `frontend/src/app/dashboard/page.tsx`
- `frontend/src/app/films/[id]/page.tsx`
- `frontend/src/app/films/page.tsx`
- `frontend/src/app/items/[id]/edit/page.tsx`
- `frontend/src/app/items/[id]/page.tsx`
- `frontend/src/app/items/page.tsx`
- `frontend/src/components/app-shell.tsx`
- `frontend/src/components/shooting-entry-form-dialog.tsx`
- `frontend/src/components/ui/input.tsx`
- `frontend/src/components/ui/textarea.tsx`
- `frontend/tailwind.config.ts`
- 必要时调整 `frontend/next.config.ts`

实施要求：

1. 逐类修复 lint 根因，禁止关闭或降级规则。
2. 把动态图标改成稳定组件。
3. 把无效 ID、加载态和弹窗重置改成派生状态或事件驱动状态。
4. 使用 ES module 导入 Tailwind 插件。
5. 清理未使用导入。
6. 将现有原生图片迁移到适合本地文件代理的 `next/image` 用法。
7. 确认主题初始化没有首屏闪烁或 hydration warning。

验收：

```bash
cd frontend
npm run lint
npm run build
```

完成标准：lint 为 0 error、0 warning；production build 成功；仪表盘、器材、拍摄事项、设置页的浅色/深色和移动布局无回归。

### 阶段 2：安全兼容迁移

预计修改或新增：

- `backend/app/database.py`
- `backend/app/services/sqlite_backup.py`
- `backend/app/maintenance/__main__.py`
- `backend/tests/test_database_migrations.py`
- `backend/tests/test_migration_rollback.py`
- `docs/database.md`

实施顺序：

1. 先实现 SQLite 一致性备份原语和备份校验。
2. 增加命名迁移记录表和重复图片冲突归档表。
3. 把当前匿名 `_ensure_sqlite_columns()` 行为拆成可识别、可重复执行的迁移步骤。
4. 对重复图片记录执行“备份 → 归档 → 计数核对 → 现役表去重 → 建索引”。
5. 增加失败注入测试，证明备份、归档或建索引失败不会留下半迁移状态。
6. 增加停止服务后的数据库回滚命令，并在文档中写清恢复点位置。

旧数据副本测试矩阵：

- 无重复记录、无新字段的旧数据库首次启动。
- 同一事项同一路径存在 2 条和 3 条重复记录。
- 首次迁移后重复启动两次。
- 备份目录不可写。
- 索引创建失败。
- 迁移成功后执行回滚，再重新升级。
- 比较迁移前备份、冲突归档表和保留记录，确认字段值完整。
- 比较升级前后 `uploads/` 清单和 SHA-256，确认没有图片被删除或覆盖。

完成标准：迁移自动、幂等、可审计、可回滚；任何失败都不静默继续；旧数据兼容证据写入 `docs/database.md`。

### 阶段 3：交易记录产品闭环

预计修改或新增：

- `frontend/src/types/index.ts`
- `frontend/src/lib/api.ts`
- `frontend/src/app/items/[id]/page.tsx`
- `frontend/src/components/transaction-form-dialog.tsx`
- `backend/tests/test_transactions.py`
- `docs/api.md`
- 必要时补充 `README.md`、`README_zh.md`

实施顺序：

1. 补齐 `TransactionMutationPayload` 及 create、update、delete 前端请求函数。
2. 为现有后端交易 API 增加创建、更新、删除、非法类型和不存在器材的回归测试。
3. 器材详情请求同时加载图片和交易，单个子区失败时给出局部错误和重试，不让整个详情页不可用。
4. 增加交易列表、空状态、新增动作、编辑动作和删除确认。
5. 表单校验金额、日期、币种和必填交易类型；保存时防重复提交。
6. 明确交易不会自动改写器材状态或估值。

完成标准：用户可在器材详情页完成交易 CRUD；刷新后数据一致；错误状态可恢复；后端测试、前端 lint 和 build 全部通过。

### 阶段 4：一键备份、验证和恢复

预计修改或新增：

- `backend/app/services/backup_archive.py`
- `backend/app/maintenance/__main__.py`
- `backend/tests/test_backup_restore.py`
- `docker-compose.yml`
- `.env.example`
- `README.md`
- `README_zh.md`
- `docs/database.md`

实施顺序：

1. 在阶段 2 的 SQLite 备份原语上实现完整归档和 manifest。
2. 实现独立 `verify`，保证用户可在恢复前验证任意归档。
3. 实现受控恢复、恢复前自动备份和失败回滚。
4. 为 Docker 增加 `backups` 挂载，并保证旧部署只需创建目录即可升级。
5. 输出面向行动的命令结果：归档路径、大小、文件数量、数据库检查结果和下一步命令。

测试矩阵：

- 数据库、一言配置、空上传目录。
- 数据库、一言配置、嵌套原图和缩略图。
- 不存在一言配置时仍可备份和恢复。
- 篡改文件、错误 SHA-256、损坏 SQLite、缺失 manifest。
- 归档路径穿越和符号链接逃逸。
- 恢复中途失败并自动回到恢复前状态。
- 同一归档重复验证；恢复后再次备份并比较逻辑数据和文件 SHA-256。

完成标准：本地与 Docker 命令均可执行；损坏归档在写入前被拒绝；恢复前后都有可验证恢复点；文档命令与实际 CLI `--help` 一致。

### 阶段 5：列表性能和数量完整性

预计修改：

- `backend/app/schemas.py`
- `backend/app/crud.py`
- `backend/app/routers/items.py`
- `backend/app/routers/shooting_entries.py`
- `backend/tests/test_item_listing.py`
- 新增 `backend/tests/test_item_facets.py`
- 新增 `backend/tests/test_list_scaling.py`
- `frontend/src/types/index.ts`
- `frontend/src/lib/api.ts`
- `frontend/src/app/items/page.tsx`
- `frontend/src/app/films/page.tsx`
- `frontend/src/app/films/[id]/page.tsx`
- `frontend/src/components/shooting-entry-form-dialog.tsx`
- `docs/api.md`

实施顺序：

1. 为器材列表返回封面信息，消除每件器材一次图片请求。
2. 增加 facets API，并保持自由文本去空白、大小写不合并等现有语义。
3. 器材页改成分页或“加载更多”，筛选变化时取消旧请求并重置页码。
4. 拍摄事项页增加分页或“加载更多”，移除固定 `100` 条截断。
5. 拍摄事项器材选择器改为服务端搜索，确保第 101 条以后的器材可以被找到和选择。
6. 为加载更多、空页、请求失败、筛选切换和已选项保留提供明确反馈。

规模验收数据：

- 至少 250 件器材，覆盖四种类型、多个品牌、卡口和相机类型。
- 至少 250 条拍摄事项。
- 有封面、无封面、只有原图而无缩略图的混合数据。

完成标准：

- 第 101 条之后的器材和拍摄事项均可发现和操作。
- 器材列表不再调用每件器材的图片列表接口。
- 筛选选项不依赖全量下载器材。
- 分页前后排序稳定，无重复、无漏项。
- 现有 API 旧字段和默认排序保持兼容。

### 阶段 6：合同同步与完整收尾

1. 同步 `docs/api.md`、`docs/database.md`、`README.md`、`README_zh.md`、`.env.example` 和必要的 `AGENTS.md` 规则。
2. 使用旧版本数据副本执行升级、重复启动、备份、验证、恢复和回滚全链路。
3. 执行所有门禁：

```bash
cd backend
uv sync --frozen
uv run python -m compileall app
uv run python -m unittest discover -s tests -v
cd ../frontend
npm ci
npm run lint
npm run build
cd ..
git diff --check
```

4. 检查 Git 不跟踪 `data/gear.db`、`data/quote_banner.txt`、`uploads/` 用户文件、`backups/` 或测试归档。
5. 若本轮被指定为版本发布，再按 `version_change.md` 同步全部版本面；否则不修改版本号。
6. 全部验收通过后，把长期合同留在权威文档，删除本计划。

## 6. 总体验收清单

- [x] 前端 lint 为 0 error、0 warning。
- [x] 前端 production build 成功。
- [x] 后端语法编译与全部回归测试通过。
- [x] 旧数据库升级前自动创建可验证备份。
- [x] 重复图片记录的原始字段完整保存在冲突归档表和迁移前备份中。
- [x] 迁移重复启动不产生重复归档、重复删除或索引错误。
- [x] 数据库迁移可按文档回滚，并可再次升级。
- [x] 迁移前后 `uploads/` 文件数量和 SHA-256 不变。
- [x] 器材详情页支持交易新增、查看、编辑和删除。
- [x] 交易 CRUD 不隐式修改器材状态、价格或估值。
- [x] 一条命令可生成包含数据库、一言配置、上传文件和 manifest 的备份。
- [x] 损坏、篡改或路径不安全的归档会在覆盖数据前被拒绝。
- [x] 恢复前自动备份；恢复失败可自动回到恢复前状态。
- [x] 器材列表没有 N+1 图片请求。
- [x] 第 101 条之后的器材和拍摄事项可被查看、筛选和选择。
- [x] API、数据库、README、环境变量示例与最终实现一致。
- [x] 用户数据目录和备份目录没有新增 Git 跟踪文件。
- [ ] 在具备 Docker 的环境执行 Compose 解析及容器内备份、验证命令。

## 7. 风险与回滚边界

- 前端门禁修复只调整实现方式，不改变 API、路由和数据格式；可按文件回退。
- 数据库迁移是本轮最高风险项，必须以迁移前数据库备份和冲突归档表作为双重恢复证据；没有旧数据副本验收不得进入发布阶段。
- 交易界面复用现有 API，不让交易自动驱动器材字段，避免引入新的数据耦合。
- 备份格式首次发布后即成为外部合同；归档格式必须带版本，后续只能兼容扩展，不能静默改变含义。
- 列表 API 只新增可空字段和新路由，不删除或重命名旧字段；发现性能优化改变排序时立即回退查询实现。
- 任何恢复操作都要求服务停止。网页运行态不提供恢复入口，防止并发写入和误操作。

## 8. 推荐执行顺序

严格按以下顺序推进，每个阶段验收通过后再进入下一阶段：

```text
阶段 0 规则与基线
  -> 阶段 1 前端门禁
  -> 阶段 2 安全兼容迁移
  -> 阶段 3 交易记录界面
  -> 阶段 4 备份与恢复
  -> 阶段 5 列表性能与数量完整性
  -> 阶段 6 合同同步与收尾
```

阶段 2 先建立的 SQLite 备份原语必须由阶段 4 复用，不能出现迁移备份和用户备份两套互不兼容的实现。
