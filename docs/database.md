# CameraHub Database

默认数据库为 `data/gear.db`。后端使用 SQLite 与 SQLModel：启动时创建缺失表，并通过命名兼容迁移补充当前代码明确支持的字段和索引。升级前仍应保留 `data/`、`uploads/` 和 `backups/`。

## 兼容迁移

当前命名迁移记录在 `schema_migrations`。已有数据库第一次执行 `20260813_safe_shooting_entry_photo_uniqueness` 前，后端使用 SQLite backup API 在 `backups/` 创建并校验一致性恢复点；备份失败时停止启动，不修改数据库。

迁移处理旧版 `shooting_entry_photos` 重复路径记录时：

1. 把同一 `entry_id + file_path` 组中除最小 `id` 外的完整原始行复制到 `migration_shooting_entry_photo_duplicates`。
2. 核对归档数量后才从现役表移出对应行；原图和缩略图文件不删除、不覆盖。
3. 建立 `uq_shooting_entry_photos_entry_file_path` 唯一索引并记录迁移名、执行时间和备份路径。
4. 重复启动只验证现役 schema，不重复归档或迁移。

迁移失败会回滚当前数据库事务并阻止应用以成功状态继续启动。需要回滚时先停止服务，然后执行：

```bash
cd backend
uv run python -m app.maintenance verify-database ../backups/<migration-backup>.db
uv run python -m app.maintenance rollback-database ../backups/<migration-backup>.db
```

回滚命令替换数据库前会在 `backups/` 再创建一份 `before-rollback` 恢复点。Docker 部署使用同一命令入口，并通过 `./backups:/app/backups` 保留恢复点。

## `items`

所有相机、镜头、胶片和配件的核心表。

- `id`：主键
- `type`：`camera`、`lens`、`film` 或 `accessory`
- `brand`、`model`、`nickname`、`serial_number`
- `status`：现役表单使用 `owned`、`sold`、`wishlist`；兼容读取旧值 `archived`
- `purchase_date`、`purchase_price`、`current_value`、`currency`
- `condition`、`location`、`notes`、`custom_fields`
- `created_at`、`updated_at`

## `cameras`

通过 `item_id` 关联 `items.id` 的相机扩展表。

- `id`、`item_id`
- `mount`、`format`、`camera_type`、`film_format`
- `sensor_type`、`megapixels`、`shutter_type`、`metering`
- `battery_type`、`weight_g`

`camera_type` 是用户自由文本字段。系统不预设、映射或迁移其值；器材页会从现有非空字段值动态生成筛选项。

## `lenses`

通过 `item_id` 关联 `items.id` 的镜头扩展表。

- `id`、`item_id`、`mount`
- `focal_length_min`、`focal_length_max`
- `aperture_max`、`aperture_min`
- `filter_size_mm`、`minimum_focus_m`
- `stabilization`、`autofocus`、`weight_g`

## `films`

通过 `item_id` 关联 `items.id` 的胶片扩展表。

- `id`、`item_id`
- `iso`、`film_format`、`color_type`、`process`
- `expiry_date`、`quantity`、`storage_location`

胶片的 `items.purchase_price` 和 `items.current_value` 均表示单卷价格；持有资产统计使用 `current_value * quantity`。空数量按 `0` 处理。

## `photos`

通过 `item_id` 关联器材的图片表。

- `id`、`item_id`
- `file_path`：原图相对路径
- `thumbnail_path`：WebP 缩略图相对路径，可为空；读取时会尝试补齐
- `file_name`、`content_type`、`file_size`
- `sort_order`、`created_at`

## `transactions`

通过 `item_id` 关联器材的交易记录表。

- `id`、`item_id`
- `type`：`purchase`、`repair`、`sale`、`maintenance` 或 `accessory`
- `amount`、`currency`、`date`、`vendor`、`notes`
- `created_at`

## `shooting_entries`

拍摄事项主表。

- `id`、`title`、`date`、`location`、`notes`
- `created_at`、`updated_at`

## `shooting_entry_items`

拍摄事项与器材的关联表。

- `id`、`entry_id`、`item_id`
- `role`：`camera`、`lens`、`film` 或 `other`

## `shooting_entry_photos`

拍摄事项图片表。

- `id`、`entry_id`
- `file_path`、`thumbnail_path`
- `file_name`、`content_type`、`file_size`
- `dominant_color`：封面主色，格式为十六进制颜色字符串
- `sort_order`：`0` 表示当前封面
- `created_at`

`entry_id + file_path` 有唯一索引。旧库升级时，启动迁移会先创建 SQLite 恢复点，把同一事项内的重复路径完整归档到冲突表，核对数量后再从现役表移出重复行并建立索引；图片文件不会被删除。

## 文件存储

SQLite 只保存相对路径。文件默认位于：

```text
uploads/
  camera/
  lens/
  film/
  accessory/
  shooting-entries/
```

各图片目录下的 `thumbs/` 保存 WebP 缩略图。摄影一言设置单独保存在本地运行数据 `data/quote_banner.txt`；该文件不纳入 Git，备份或迁移时应与数据库一起保留。

## 备份与恢复

完整备份使用项目维护命令。归档包含 SQLite 一致性快照、可选的一言配置、全部上传文件和 `manifest.json`；manifest 记录格式版本、应用版本、创建时间、SQLite schema 信息及其 SHA-256、各文件路径、字节数和 SHA-256。

```bash
cd backend
uv run python -m app.maintenance backup
uv run python -m app.maintenance verify ../backups/camerahub-backup-*.zip
```

恢复会拒绝路径穿越、符号链接、重复路径、清单不一致、SHA-256 错误或 SQLite 损坏的归档。恢复前先停止所有服务；命令会先创建恢复前保护归档，替换后再次核对数据库和文件清单，中途失败则自动回滚到该保护归档：

```bash
cd backend
uv run python -m app.maintenance restore ../backups/camerahub-backup-YYYYMMDDTHHMMSSZ-ID.zip
```
