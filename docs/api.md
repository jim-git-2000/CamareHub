# CameraHub API

默认后端地址：

```text
http://localhost:8000
```

所有业务 API 挂在 `/api` 前缀下。

## Health API

### GET /api/health

返回后端运行状态。

响应：

```json
{
  "status": "ok",
  "app": "CameraHub"
}
```

## Items API

### GET /api/items

查询器材列表。

Query 参数：

- `type`: `camera` / `lens` / `film` / `accessory`
- `brand`: 品牌精确筛选
- `status`: `owned` / `sold` / `wishlist` / `archived`
- `mount`: 相机或镜头卡口筛选
- `keyword`: 搜索品牌、型号、昵称、序列号、备注
- `sort`: `-created_at`、`created_at`、`brand`、`model` 等
- `page`: 默认 `1`
- `page_size`: 默认 `20`，最大 `100`

### GET /api/items/{item_id}

查询单个器材详情，包含类型扩展字段：

- `camera`
- `lens`
- `film`

不存在时返回 `404`。

### POST /api/items

新增器材。

最小请求：

```json
{
  "type": "camera",
  "brand": "Fujifilm",
  "model": "X-H1"
}
```

相机、镜头、胶片可分别附加 `camera`、`lens`、`film` 对象。

### PUT /api/items/{item_id}

更新器材。支持更新基础字段和类型扩展字段。

### DELETE /api/items/{item_id}

删除器材。后端会同时删除扩展信息、图片记录、交易记录，并删除图片实际文件。

## Photos API

### POST /api/items/{item_id}/photos

上传器材图片。

请求类型：`multipart/form-data`

字段：

- `file`: 图片文件

限制：

- 支持 `jpg`、`jpeg`、`png`、`webp`
- 单张最大 `10MB`

### GET /api/items/{item_id}/photos

查询器材图片列表。

响应项包含：

- `id`
- `item_id`
- `file_name`
- `content_type`
- `file_size`
- `sort_order`
- `created_at`
- `url`

### DELETE /api/photos/{photo_id}

删除图片记录和实际图片文件。

## Transactions API

### GET /api/items/{item_id}/transactions

查询器材交易记录。

### POST /api/items/{item_id}/transactions

新增交易记录。

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

支持类型：

- `purchase`
- `repair`
- `sale`
- `maintenance`
- `accessory`

### PUT /api/transactions/{transaction_id}

更新交易记录。

### DELETE /api/transactions/{transaction_id}

删除交易记录。

## Stats API

### GET /api/stats/summary

返回 Dashboard 和统计页基础汇总：

- `total_value`
- `camera_count`
- `lens_count`
- `film_stock`
- `recent_items`

### GET /api/stats/by-brand

按品牌统计器材数量和估值。

### GET /api/stats/by-type

按器材类型统计数量和估值。

### GET /api/stats/lens-focal-length

按镜头焦段统计数量。

### GET /api/stats/film-stock

按胶片条目统计库存数量。
