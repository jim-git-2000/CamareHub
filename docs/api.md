# CameraHub API

本地开发时后端默认地址为 `http://localhost:8000`。业务 API 使用 `/api` 前缀，上传文件通过 `/uploads/...` 提供。Docker 部署由前端同源代理 `/api` 和 `/uploads`，浏览器不需要直连后端容器。

删除成功统一返回 `204 No Content`。列表接口的 `page` 默认为 `1`，`page_size` 默认为 `20`、最大为 `100`。

## 健康检查

### `GET /api/health`

返回后端状态与应用名：

```json
{
  "status": "ok",
  "app": "CameraHub"
}
```

## 器材

### `GET /api/items`

查询参数：

- `type`：`camera`、`lens`、`film` 或 `accessory`
- `brand`：品牌精确筛选
- `status`：`owned`、`sold` 或 `wishlist`；旧数据中的 `archived` 仍可读取和筛选
- `mount`：相机或镜头卡口
- `camera_type`：相机类型文本筛选；接受任意非空值，按去除首尾空白后的值精确匹配 `cameras.camera_type`
- `keyword`：搜索品牌、型号、昵称、序列号和备注
- `sort`：支持 `created_at`、`updated_at`、`purchase_date`、`brand`、`model` 及各字段前加 `-` 的倒序形式；`catalog` 按相机、镜头、配件、胶片排序，类内按购买日期从新到旧，空日期置后
- `page`、`page_size`：分页

### `GET /api/items/{item_id}`

返回器材基础字段及对应的 `camera`、`lens` 或 `film` 扩展对象；不存在时返回 `404`。

器材列表与详情响应还包含可空的 `cover_photo`，提供封面 `url` 和 `thumbnail_url`。旧图片没有缩略图时，`thumbnail_url` 降级为原图 URL，列表读取不会写入或生成文件。

### `GET /api/items/facets`

返回未筛选器材全集的动态筛选选项：`brands`、`lens_mounts` 和 `camera_types`。值会去除首尾空白并去重，不合并大小写或改写数据库记录。

### `POST /api/items`

最小请求：

```json
{
  "type": "camera",
  "brand": "Fujifilm",
  "model": "X-H1"
}
```

相机、镜头、胶片可分别附加 `camera`、`lens`、`film` 对象。创建成功返回 `201`。

### `PUT /api/items/{item_id}`

更新基础字段和类型扩展字段。

### `DELETE /api/items/{item_id}`

删除器材及其扩展数据、交易记录、图片记录和图片文件。

## 器材图片

### `POST /api/items/{item_id}/photos`

使用 `multipart/form-data`，字段名为 `file`。支持 JPEG、PNG、WebP，单张最大 `10MB`。后端同时生成 WebP 缩略图；成功返回 `201`。

### `GET /api/items/{item_id}/photos`

返回字段包括 `file_path`、`thumbnail_path`、`file_name`、`content_type`、`file_size`、`sort_order`、`created_at`、`url` 和 `thumbnail_url`。

### `DELETE /api/photos/{photo_id}`

删除数据库记录、原图和缩略图。

## 交易记录

- `GET /api/items/{item_id}/transactions`：列出器材交易记录
- `POST /api/items/{item_id}/transactions`：新增交易记录，成功返回 `201`
- `PUT /api/transactions/{transaction_id}`：更新交易记录
- `DELETE /api/transactions/{transaction_id}`：删除交易记录

请求示例：

```json
{
  "type": "purchase",
  "amount": 3200,
  "currency": "CNY",
  "date": "2026-06-06",
  "vendor": "Local store",
  "notes": "Body only"
}
```

`type` 可使用 `purchase`、`repair`、`sale`、`maintenance` 或 `accessory`。
`amount` 可为空；填写时必须大于或等于 `0`。交易记录只作为账本，不会自动修改器材的 `status`、`purchase_price` 或 `current_value`。

## 拍摄事项

### `GET /api/shooting-entries`

查询参数：

- `keyword`：搜索标题、地点和备注
- `item_id`：筛选关联指定器材的事项
- `camera_item_ids`、`lens_item_ids`、`film_item_ids`：逗号分隔的器材 ID
- `page`、`page_size`：分页

### `GET /api/shooting-entries/{entry_id}`

返回事项、关联器材 `item_links`、图片 `photos` 和 `photo_count`。

### `POST /api/shooting-entries`

创建成功返回 `201`。请求示例：

```json
{
  "title": "周末街拍",
  "date": "2026-06-06",
  "location": "Shanghai",
  "notes": null,
  "item_links": [
    {"item_id": 1, "role": "camera"},
    {"item_id": 2, "role": "lens"}
  ]
}
```

`role` 使用 `camera`、`lens`、`film` 或 `other`。

- `PUT /api/shooting-entries/{entry_id}`：更新事项及关联器材
- `DELETE /api/shooting-entries/{entry_id}`：删除事项、关联记录、图片记录和图片文件

## 拍摄事项图片

- `POST /api/shooting-entries/{entry_id}/photos`：上传图片，限制与器材图片相同，成功返回 `201`
- `GET /api/shooting-entries/{entry_id}/photos`：列出图片
- `PUT /api/shooting-entry-photos/{photo_id}/cover`：把指定图片设为封面
- `DELETE /api/shooting-entry-photos/{photo_id}`：删除原图、缩略图和记录

图片响应除通用图片字段外还包含 `entry_id` 和 `dominant_color`。同一事项的 `sort_order = 0` 图片为封面。

## 摄影一言

- `GET /api/quote-banner`：读取轮换间隔、自定义文本和默认值状态
- `PUT /api/quote-banner`：写入 `interval_seconds` 和 `quotes`；省略的字段使用内置默认值
- `DELETE /api/quote-banner`：恢复默认设置

设置保存在本地运行数据 `data/quote_banner.txt`，不写入 SQLite，也不纳入 Git；文件不存在时使用代码内置默认值。

## 统计

- `GET /api/stats/summary`：自有器材总估值、相机数、镜头数、胶片库存和最近器材
- `GET /api/stats/by-brand`：按品牌统计数量和估值
- `GET /api/stats/by-type`：按器材类型统计数量和估值
- `GET /api/stats/lens-focal-length`：按镜头焦段统计
- `GET /api/stats/lens-zoom-type`：按定焦/变焦统计
- `GET /api/stats/lens-focal-category`：按焦段类别统计
- `GET /api/stats/film-stock`：按胶片条目统计库存

资产估值只统计 `status = owned` 的器材，并使用 `current_value`。胶片的 `current_value` 是单卷估值，统计时按 `current_value * quantity` 计算；其他器材按 `current_value` 计算。新增器材时若只填写 `purchase_price`，后端会把它同步为初始 `current_value`。
