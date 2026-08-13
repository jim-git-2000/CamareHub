# CameraHub Database

默认数据库为 `data/gear.db`。后端使用 SQLite 与 SQLModel：启动时创建缺失表，并为已有数据库补充当前代码明确支持的兼容字段和索引。它不是通用迁移框架，升级前仍应备份数据库与 `uploads/`。

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

`entry_id + file_path` 有唯一索引，启动兼容逻辑会先去除同一事项内的重复路径记录，再补索引。

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

备份：

```bash
mkdir -p backups
cp data/gear.db backups/gear-$(date +%Y%m%d).db
if [ -f data/quote_banner.txt ]; then cp data/quote_banner.txt backups/quote-banner-$(date +%Y%m%d).txt; fi
tar -czf backups/uploads-$(date +%Y%m%d).tar.gz uploads/
```

恢复前先停止服务，再替换数据库和图片目录：

```bash
cp backups/gear-YYYYMMDD.db data/gear.db
if [ -f backups/quote-banner-YYYYMMDD.txt ]; then cp backups/quote-banner-YYYYMMDD.txt data/quote_banner.txt; fi
tar -xzf backups/uploads-YYYYMMDD.tar.gz
```
