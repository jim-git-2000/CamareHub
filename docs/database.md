# CameraHub Database

默认数据库：

```text
data/gear.db
```

数据库使用 SQLite，由 SQLModel 在后端启动时自动创建表。

## items

Item 表说明

核心器材表。所有相机、镜头、胶片和配件都先写入 `items`。

主要字段：

- `id`: 主键
- `type`: `camera` / `lens` / `film` / `accessory`
- `brand`: 品牌
- `model`: 型号
- `nickname`: 昵称
- `serial_number`: 序列号
- `status`: `owned` / `sold` / `wishlist` / `archived`
- `purchase_date`: 购买日期
- `purchase_price`: 购买价格
- `current_value`: 当前估值
- `currency`: 币种，默认 `CNY`
- `condition`: 成色
- `location`: 存放位置
- `notes`: 备注
- `custom_fields`: 自定义字段，当前按字符串保存，可存 JSON
- `created_at`: 创建时间
- `updated_at`: 更新时间

## cameras

Camera 表说明

相机扩展表，通过 `item_id` 关联 `items.id`。

主要字段：

- `id`: 主键
- `item_id`: 对应器材 ID
- `mount`: 卡口
- `format`: 画幅
- `camera_type`: 相机类型
- `film_format`: 胶片规格
- `sensor_type`: 传感器类型
- `megapixels`: 像素
- `shutter_type`: 快门类型
- `metering`: 测光
- `battery_type`: 电池类型
- `weight_g`: 重量，单位 g

## lenses

Lens 表说明

镜头扩展表，通过 `item_id` 关联 `items.id`。

主要字段：

- `id`: 主键
- `item_id`: 对应器材 ID
- `mount`: 卡口
- `focal_length_min`: 最短焦距，单位 mm
- `focal_length_max`: 最长焦距，单位 mm
- `aperture_max`: 最大光圈
- `aperture_min`: 最小光圈
- `filter_size_mm`: 滤镜口径，单位 mm
- `minimum_focus_m`: 最近对焦距离，单位 m
- `stabilization`: 是否防抖
- `autofocus`: 是否自动对焦
- `weight_g`: 重量，单位 g

## films

Film 表说明

胶片扩展表，通过 `item_id` 关联 `items.id`。

主要字段：

- `id`: 主键
- `item_id`: 对应器材 ID
- `iso`: ISO
- `film_format`: 胶片规格，例如 `135`
- `color_type`: 黑白、彩负等
- `process`: 冲洗工艺，例如 `C-41` 或 `B&W`
- `expiry_date`: 有效期
- `quantity`: 库存数量
- `storage_location`: 存储位置

## photos

Photo 表说明

图片表，通过 `item_id` 关联 `items.id`。

主要字段：

- `id`: 主键
- `item_id`: 对应器材 ID
- `file_path`: 图片相对路径
- `file_name`: 原始文件名
- `content_type`: MIME 类型
- `file_size`: 文件大小，单位 byte
- `sort_order`: 排序值
- `created_at`: 上传时间

实际图片文件默认保存在：

```text
uploads/
```

## transactions

Transaction 表说明

交易记录表，通过 `item_id` 关联 `items.id`。

主要字段：

- `id`: 主键
- `item_id`: 对应器材 ID
- `type`: `purchase` / `repair` / `sale` / `maintenance` / `accessory`
- `amount`: 金额
- `currency`: 币种，默认 `CNY`
- `date`: 交易日期
- `vendor`: 商家、维修点或买家
- `notes`: 备注
- `created_at`: 创建时间

## 备份与恢复

备份数据库：

```bash
mkdir -p backups
cp data/gear.db backups/gear-$(date +%Y%m%d).db
```

备份图片：

```bash
mkdir -p backups
tar -czf backups/uploads-$(date +%Y%m%d).tar.gz uploads/
```

恢复数据库：

```bash
cp backups/gear-YYYYMMDD.db data/gear.db
```

恢复图片：

```bash
tar -xzf backups/uploads-YYYYMMDD.tar.gz
```
