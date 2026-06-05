# CameraHub 开发总任务与 Codex 分步骤执行指南

> 文件用途：把本文件放到项目根目录，供 Codex 每次读取并按任务编号逐步开发。  
> 项目名称：CameraHub  
> 项目类型：个人摄影器材管理系统  
> 当前阶段：本地开发版  
> 暂不开发：Docker、PWA、HTTPS、域名部署、PostgreSQL、Redis、MinIO、复杂登录系统。

---

## 0. Codex 工作规则

每次让 Codex 开发时，请使用类似下面的指令：

```text
请阅读 CAMERAHUB_DEVELOPMENT_PLAN.md，只执行「任务 X」。
不要执行后续任务。
完成后请列出：
1. 修改了哪些文件
2. 如何启动或测试
3. 哪些验收项已通过
4. 是否有未完成问题
5. 下一步应该执行哪个任务
```

Codex 必须遵守：

1. 每次只完成一个任务。
2. 不要自行跳到后续任务。
3. 不要自行升级技术栈。
4. 不要添加 Docker、PWA、PostgreSQL、Redis、MinIO、Celery、RabbitMQ、Elasticsearch、Kubernetes、GraphQL、OAuth、多租户权限系统。
5. 不要把数据库文件放进 `frontend/` 或 `backend/` 源码目录。
6. 不要把上传图片放进 `frontend/public/`。
7. 所有路径、API 地址、上传目录都要尽量通过环境变量配置，避免写死。
8. 每个任务完成后，都要保证项目仍然可以启动。

---

## 1. 总目标

开发一个个人使用的摄影器材管理系统 `CameraHub`，用于管理：

- 相机
- 镜头
- 胶片
- 配件
- 器材图片
- 购买、维修、出售等简单记录
- 基础统计图表

第一阶段目标：

```text
本地可运行
功能完整
界面美观
代码清晰
后期容易 Docker 化
后期容易加 PWA
```

---

## 2. 技术栈固定

### 2.1 Frontend

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

### 2.2 Backend

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

### 2.3 Storage

数据库：

```text
data/gear.db
```

图片：

```text
uploads/
```

说明：

- SQLite 是文件数据库，不需要单独数据库服务。
- 图片直接存本地文件夹，不需要 MinIO 或 S3。
- 数据库和图片目录必须放在项目根目录下，方便后期 Docker 挂载和备份。

---

## 3. 目标目录结构

项目根目录使用：

```text
camerahub/
```

最终第一阶段目录结构：

```text
camerahub/
├── frontend/
│   ├── src/
│   ├── public/
│   └── package.json
│
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── database.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   ├── crud.py
│   │   ├── routers/
│   │   │   ├── health.py
│   │   │   ├── items.py
│   │   │   ├── photos.py
│   │   │   ├── transactions.py
│   │   │   └── stats.py
│   │   └── core/
│   │       └── config.py
│   ├── pyproject.toml
│   └── uv.lock
│
├── data/
│   └── .gitkeep
│
├── uploads/
│   └── .gitkeep
│
├── docs/
│   ├── database.md
│   └── api.md
│
├── .env.example
├── .gitignore
├── CAMERAHUB_DEVELOPMENT_PLAN.md
└── README.md
```

第一阶段不要创建：

```text
Dockerfile
docker-compose.yml
PWA service worker
manifest
```

---

## 4. 数据库设计原则

使用 SQLite + SQLModel。

数据库文件路径：

```text
data/gear.db
```

设计原则：

1. 通用字段放在 `items`。
2. 相机、镜头、胶片的特殊字段放在独立表。
3. 不确定或冷门参数放进 `custom_fields`。
4. 不要为每个冷门参数都建单独字段。
5. 第一版以易用为主，不追求复杂范式。
6. 删除器材时，应同时删除它的扩展信息、图片记录、交易记录。
7. 图片实际文件也应在删除图片记录时删除。

---

## 5. 数据模型

### 5.1 Item

所有器材的基础表。

字段：

```text
id
    int primary key

type
    str
    camera / lens / film / accessory

brand
    str
    品牌，例如 Leica、Nikon、Kodak

model
    str
    型号，例如 M6 TTL、FM2、Portra 400

nickname
    optional str
    昵称

serial_number
    optional str
    序列号

status
    str
    owned / sold / wishlist / archived

purchase_date
    optional date
    购买日期

purchase_price
    optional float
    购买价格

current_value
    optional float
    当前估值

currency
    str
    默认 CNY

condition
    str
    new / excellent / good / fair / poor / unknown

location
    optional str
    存放位置

notes
    optional str
    备注

custom_fields
    optional JSON
    自定义字段

created_at
    datetime

updated_at
    datetime
```

---

### 5.2 Camera

相机扩展表。

字段：

```text
id
item_id
mount
format
camera_type
film_format
sensor_type
megapixels
shutter_type
metering
battery_type
weight_g
```

示例：

```text
brand = Leica
model = M6 TTL
mount = Leica M
format = 35mm
camera_type = rangefinder
film_format = 135
```

---

### 5.3 Lens

镜头扩展表。

字段：

```text
id
item_id
mount
focal_length_min
focal_length_max
aperture_max
aperture_min
filter_size_mm
minimum_focus_m
stabilization
autofocus
weight_g
```

示例：

```text
brand = Voigtlander
model = Nokton 35mm F1.4 SC
mount = Leica M
focal_length_min = 35
focal_length_max = 35
aperture_max = 1.4
filter_size_mm = 43
```

---

### 5.4 Film

胶片扩展表。

字段：

```text
id
item_id
iso
film_format
color_type
process
expiry_date
quantity
storage_location
```

`color_type` 可选：

```text
color_negative
color_positive
black_white
instant
```

`process` 示例：

```text
C-41
E-6
BW
ECN-2
```

---

### 5.5 Photo

图片表。

字段：

```text
id
item_id
file_path
file_name
content_type
file_size
sort_order
created_at
```

图片实际保存在：

```text
uploads/
```

数据库只保存相对路径。

---

### 5.6 Transaction

购买、维修、出售等记录表。

字段：

```text
id
item_id
type
amount
currency
date
vendor
notes
created_at
```

`type` 可选：

```text
purchase
repair
sale
maintenance
accessory
```

---

## 6. 后端 API 设计

基础路径：

```text
/api
```

### 6.1 Health Check

```text
GET /api/health
```

返回：

```json
{
  "status": "ok",
  "app": "CameraHub"
}
```

---

### 6.2 Items

```text
GET    /api/items
GET    /api/items/{id}
POST   /api/items
PUT    /api/items/{id}
DELETE /api/items/{id}
```

查询参数：

```text
type
brand
status
mount
keyword
sort
page
page_size
```

---

### 6.3 Photos

```text
POST   /api/items/{id}/photos
GET    /api/items/{id}/photos
DELETE /api/photos/{photo_id}
```

上传要求：

- 只允许 jpg、jpeg、png、webp
- 单张图片最大 10MB
- 文件名自动重命名
- 数据库保存相对路径
- 删除数据库记录时也删除实际图片文件

---

### 6.4 Transactions

```text
GET    /api/items/{id}/transactions
POST   /api/items/{id}/transactions
PUT    /api/transactions/{id}
DELETE /api/transactions/{id}
```

---

### 6.5 Stats

```text
GET /api/stats/summary
GET /api/stats/by-brand
GET /api/stats/by-type
GET /api/stats/lens-focal-length
GET /api/stats/film-stock
```

---

## 7. 前端页面设计

页面：

```text
/dashboard
/items
/items/new
/items/[id]
/items/[id]/edit
/films
/stats
/settings
```

### 7.1 Dashboard

展示：

- 总资产估值
- 相机数量
- 镜头数量
- 胶片库存
- 最近新增器材
- 品牌占比图
- 类型占比图
- 焦段分布图

---

### 7.2 Items List

功能：

- 卡片视图
- 搜索
- 类型筛选
- 品牌筛选
- 状态筛选
- 点击进入详情页

卡片内容：

```text
图片
品牌
型号
类型
状态
当前估值
关键参数
```

---

### 7.3 Item Detail

展示：

- 基本信息
- 类型专属参数
- 图片
- 购买记录
- 维修记录
- 出售记录
- 自定义字段
- 编辑按钮
- 删除按钮

---

### 7.4 New/Edit Form

要求：

- 根据 `type` 动态显示字段
- 相机显示相机字段
- 镜头显示镜头字段
- 胶片显示胶片字段
- 支持自定义字段
- 支持保存后返回详情页

---

## 8. UI 风格

整体风格：

- 干净
- 现代
- 轻量
- 类似 Notion / Linear / Apple
- 不要企业后台风
- 不要过度装饰

使用 shadcn/ui 组件：

```text
Card
Button
Input
Select
Dialog
Sheet
Tabs
Badge
Table
Dropdown Menu
Textarea
```

移动端要求：

- 卡片优先
- 页面宽度自适应
- 表单不要太密
- 按钮足够大
- 图片显示清楚

---

## 9. 图表

使用 ECharts。

不要使用 Chart.js。

需要图表：

```text
品牌占比：饼图
器材类型占比：饼图
焦段分布：柱状图
胶片库存：柱状图
资产估值：数字卡片
```

---

## 10. 本地开发运行方式

前端：

```bash
cd frontend
pnpm dev --hostname 0.0.0.0
```

访问：

```text
http://服务器IP:3000
```

后端：

```bash
cd backend
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

访问：

```text
http://服务器IP:8000/api/health
```

---

## 11. 环境变量

创建 `.env.example`：

```env
DATABASE_URL=sqlite:///./data/gear.db
UPLOAD_DIR=./uploads
BACKEND_CORS_ORIGINS=http://localhost:3000
APP_NAME=CameraHub
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

第一阶段暂时不做复杂登录。

---

# 12. 分步骤任务

下面的任务必须按顺序执行。

---

## 任务 1：初始化项目结构

### 目标

创建 CameraHub 项目的基础目录结构和基础文档。

### 只允许做

- 创建目录
- 创建基础文档
- 创建 `.env.example`
- 创建 `.gitignore`

### 不允许做

- 不要初始化 Next.js
- 不要初始化 FastAPI
- 不要写数据库模型
- 不要写 API
- 不要创建 Dockerfile
- 不要创建 docker-compose.yml
- 不要创建 PWA 文件

### 需要创建

```text
camerahub/
├── frontend/
├── backend/
│   └── app/
│       ├── routers/
│       └── core/
├── data/
│   └── .gitkeep
├── uploads/
│   └── .gitkeep
├── docs/
│   ├── database.md
│   └── api.md
├── .env.example
├── .gitignore
├── CAMERAHUB_DEVELOPMENT_PLAN.md
└── README.md
```

### `.env.example`

```env
DATABASE_URL=sqlite:///./data/gear.db
UPLOAD_DIR=./uploads
BACKEND_CORS_ORIGINS=http://localhost:3000
APP_NAME=CameraHub
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

### `.gitignore` 至少包含

```text
node_modules/
.next/
.venv/
__pycache__/
*.pyc
.env
data/*.db
uploads/*
!uploads/.gitkeep
```

### 验收标准

- 目录结构正确
- README 存在
- `.env.example` 存在
- `.gitignore` 存在
- `data/.gitkeep` 存在
- `uploads/.gitkeep` 存在

### 完成后输出

```text
任务 1 完成。
修改文件：...
验证结果：...
下一步：任务 2 初始化后端 FastAPI。
```

---

## 任务 2：初始化后端 FastAPI

### 目标

让后端 FastAPI 能正常启动，并提供健康检查接口。

### 只允许做

- 初始化 `backend` Python 项目
- 安装后端基础依赖
- 创建 FastAPI 应用
- 创建 health check API
- 配置 CORS

### 不允许做

- 不要写业务模型
- 不要创建数据库表
- 不要写 CRUD
- 不要写图片上传
- 不要写前端

### 依赖

在 `backend/` 中使用 `uv`。

安装：

```bash
uv add fastapi uvicorn sqlmodel python-dotenv
```

### 需要创建

```text
backend/
├── app/
│   ├── main.py
│   ├── database.py
│   ├── models.py
│   ├── schemas.py
│   ├── crud.py
│   ├── routers/
│   │   └── health.py
│   └── core/
│       └── config.py
├── pyproject.toml
└── uv.lock
```

### API

```text
GET /api/health
```

返回：

```json
{
  "status": "ok",
  "app": "CameraHub"
}
```

### 启动命令

```bash
cd backend
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 验收标准

访问：

```text
http://服务器IP:8000/api/health
```

能返回：

```json
{
  "status": "ok",
  "app": "CameraHub"
}
```

### 完成后输出

```text
任务 2 完成。
修改文件：...
启动命令：...
验证结果：...
下一步：任务 3 数据库模型与建表。
```

---

## 任务 3：数据库模型与自动建表

### 目标

实现 SQLite 连接、SQLModel 数据模型、自动建表。

### 只允许做

- 配置数据库连接
- 创建 SQLModel 模型
- 应用启动时自动建表
- 提供简单数据库连接测试

### 不允许做

- 不要写完整 CRUD API
- 不要写前端
- 不要写图片上传
- 不要写统计图表

### 模型

实现：

```text
Item
Camera
Lens
Film
Photo
Transaction
```

字段按本文件第 5 节实现。

### 技术要求

- 使用 SQLModel
- SQLite 数据库路径来自环境变量 `DATABASE_URL`
- 默认值为 `sqlite:///./data/gear.db`
- 应用启动时自动创建数据表
- `created_at`、`updated_at` 使用 datetime
- `custom_fields` 可以先用 JSON 字符串保存，或用 SQLModel 可支持的 JSON 处理方式

### 验收标准

启动后端后：

- `data/gear.db` 被创建
- 数据库中存在对应表
- `/api/health` 仍然可访问

### 完成后输出

```text
任务 3 完成。
修改文件：...
数据库位置：...
创建的表：...
验证结果：...
下一步：任务 4 器材 CRUD API。
```

---

## 任务 4：器材 CRUD API

### 目标

实现器材的创建、查询、详情、编辑、删除 API。

### 只允许做

- Items API
- 对应 schema
- 对应 crud 函数
- 基础错误处理

### 不允许做

- 不要写图片上传
- 不要写交易记录
- 不要写统计图表
- 不要写前端页面

### API

```text
GET    /api/items
GET    /api/items/{id}
POST   /api/items
PUT    /api/items/{id}
DELETE /api/items/{id}
```

### 查询参数

```text
type
brand
status
mount
keyword
sort
page
page_size
```

### 创建逻辑

创建 item 时，根据 `type` 可同时创建对应扩展信息：

```text
camera -> Camera
lens   -> Lens
film   -> Film
```

### 删除逻辑

删除 item 时，同时删除：

- Camera/Lens/Film 扩展记录
- Photo 记录
- Transaction 记录

如果 Photo 已有实际文件，也应删除实际文件；如果当前任务还没有图片上传功能，可以先预留逻辑。

### 验收标准

可以用 curl 或 FastAPI `/docs` 完成：

- 创建相机
- 创建镜头
- 创建胶片
- 查询列表
- 查看详情
- 编辑器材
- 删除器材

### 完成后输出

```text
任务 4 完成。
修改文件：...
新增 API：...
测试样例：...
验证结果：...
下一步：任务 5 交易记录 API。
```

---

## 任务 5：交易记录 API

### 目标

实现购买、维修、出售、维护等记录 API。

### 只允许做

- Transaction API
- 对应 schema
- 对应 crud 函数
- 基础错误处理

### 不允许做

- 不要写图片上传
- 不要写统计图表
- 不要写前端页面

### API

```text
GET    /api/items/{id}/transactions
POST   /api/items/{id}/transactions
PUT    /api/transactions/{id}
DELETE /api/transactions/{id}
```

### 类型

```text
purchase
repair
sale
maintenance
accessory
```

### 验收标准

可以：

- 给某个器材添加购买记录
- 给某个器材添加维修记录
- 查询某个器材的记录
- 编辑记录
- 删除记录

### 完成后输出

```text
任务 5 完成。
修改文件：...
新增 API：...
验证结果：...
下一步：任务 6 图片上传后端 API。
```

---

## 任务 6：图片上传后端 API

### 目标

实现器材图片上传、查询和删除。

### 只允许做

- 图片上传 API
- 图片查询 API
- 图片删除 API
- 静态文件访问

### 不允许做

- 不要写前端上传页面
- 不要写统计图表

### 依赖

安装：

```bash
uv add python-multipart pillow
```

### API

```text
POST   /api/items/{id}/photos
GET    /api/items/{id}/photos
DELETE /api/photos/{photo_id}
```

### 上传要求

- 只允许 jpg、jpeg、png、webp
- 单张图片最大 10MB
- 文件名使用 UUID 重命名
- 图片保存到 `uploads/`
- 数据库保存相对路径
- 删除图片记录时删除实际文件
- FastAPI 挂载 `/uploads` 静态路径

### 验收标准

可以：

- 给器材上传图片
- 查询器材图片列表
- 通过 URL 访问图片
- 删除图片后实际文件也被删除

### 完成后输出

```text
任务 6 完成。
修改文件：...
新增 API：...
上传目录：...
验证结果：...
下一步：任务 7 初始化前端 Next.js。
```

---

## 任务 7：初始化前端 Next.js

### 目标

初始化前端项目，并配置基础 UI 环境。

### 只允许做

- 创建 Next.js 项目
- 配置 Tailwind CSS
- 配置 shadcn/ui
- 安装 ECharts
- 创建基础页面框架

### 不允许做

- 不要写完整业务页面
- 不要写 PWA
- 不要写 Docker

### 技术要求

使用：

```text
Next.js App Router
TypeScript
Tailwind CSS
src directory
```

安装依赖：

```bash
pnpm add echarts echarts-for-react
```

shadcn/ui 初始化后，至少添加：

```text
button
card
input
select
textarea
badge
tabs
dialog
dropdown-menu
table
```

### 页面占位

创建占位页面：

```text
/dashboard
/items
/items/new
/items/[id]
/items/[id]/edit
/films
/stats
/settings
```

### 启动命令

```bash
cd frontend
pnpm dev --hostname 0.0.0.0
```

### 验收标准

- 前端可以启动
- 可以访问 `http://服务器IP:3000`
- 页面无明显报错
- Tailwind 生效
- shadcn/ui Button 可正常渲染

### 完成后输出

```text
任务 7 完成。
修改文件：...
启动命令：...
验证结果：...
下一步：任务 8 前端 API 客户端与基础布局。
```

---

## 任务 8：前端 API 客户端与基础布局

### 目标

建立前端统一 API 调用方式和基础页面布局。

### 只允许做

- API client
- 类型定义
- layout
- navigation
- 简单错误和 loading 处理

### 不允许做

- 不要写完整表单
- 不要写图片上传
- 不要写统计图表

### 要求

创建：

```text
frontend/src/lib/api.ts
frontend/src/types/index.ts
frontend/src/components/app-shell.tsx
frontend/src/components/nav.tsx
```

API 地址来自：

```text
NEXT_PUBLIC_API_BASE_URL
```

默认：

```text
http://localhost:8000
```

### 布局要求

- 桌面端：左侧或顶部导航
- 手机端：顶部导航或简化导航
- 页面最大宽度适中
- 风格干净

### 验收标准

- 所有页面使用统一布局
- 前端可以请求 `/api/health`
- API 错误时有基础提示

### 完成后输出

```text
任务 8 完成。
修改文件：...
API 配置：...
验证结果：...
下一步：任务 9 Dashboard 页面。
```

---

## 任务 9：Dashboard 页面

### 目标

实现首页 Dashboard，展示基础概览。

### 只允许做

- Dashboard 页面
- 调用 stats summary API
- 基础数字卡片
- 最近器材列表

### 不允许做

- 不要写完整图表页
- 不要写新增编辑表单
- 不要写图片上传表单

### 展示内容

- 总资产估值
- 相机数量
- 镜头数量
- 胶片库存
- 最近新增器材

如果 stats API 还不完整，可以先用现有 items API 计算。

### 验收标准

- `/dashboard` 可以访问
- 数字卡片正常显示
- 没有数据时显示空状态
- 手机浏览器布局正常

### 完成后输出

```text
任务 9 完成。
修改文件：...
验证结果：...
下一步：任务 10 器材列表页。
```

---

## 任务 10：器材列表页

### 目标

实现器材列表页。

### 只允许做

- `/items` 页面
- 器材卡片
- 搜索
- 类型筛选
- 品牌筛选
- 状态筛选

### 不允许做

- 不要写详情页
- 不要写新增编辑表单
- 不要写图片上传表单

### 卡片内容

```text
图片
品牌
型号
类型
状态
当前估值
关键参数
```

无图片时显示占位区域。

### 验收标准

- 可以加载器材列表
- 可以搜索
- 可以按类型筛选
- 可以按品牌筛选
- 可以按状态筛选
- 点击卡片可以进入 `/items/[id]`

### 完成后输出

```text
任务 10 完成。
修改文件：...
验证结果：...
下一步：任务 11 器材详情页。
```

---

## 任务 11：器材详情页

### 目标

实现器材详情页。

### 只允许做

- `/items/[id]` 页面
- 详情展示
- 图片展示
- 交易记录展示
- 删除按钮

### 不允许做

- 不要写新增编辑表单
- 不要写图片上传控件
- 不要写统计图表

### 展示内容

- 基本信息
- 类型专属参数
- 图片列表
- 购买记录
- 维修记录
- 出售记录
- 自定义字段
- 编辑按钮
- 删除按钮

删除必须二次确认。

### 验收标准

- 可以查看器材详情
- 不存在的 ID 有错误提示
- 可以跳转编辑页
- 可以删除器材
- 删除后返回列表页

### 完成后输出

```text
任务 11 完成。
修改文件：...
验证结果：...
下一步：任务 12 新增与编辑表单。
```

---

## 任务 12：新增与编辑表单

### 目标

实现器材新增和编辑。

### 只允许做

- `/items/new`
- `/items/[id]/edit`
- 表单组件
- 基础校验

### 不允许做

- 不要写图片上传控件
- 不要写统计图表

### 表单要求

- `type` 为必填
- `brand` 为必填
- `model` 为必填
- 根据 `type` 动态显示字段
- 相机显示相机字段
- 镜头显示镜头字段
- 胶片显示胶片字段
- 支持 notes
- 支持 custom_fields 的简单录入，第一版可以用 JSON textarea

### 保存逻辑

- 新增成功后跳转详情页
- 编辑成功后跳转详情页
- 保存失败时显示错误

### 验收标准

- 可以新增相机
- 可以新增镜头
- 可以新增胶片
- 可以编辑已有器材
- 表单校验有效

### 完成后输出

```text
任务 12 完成。
修改文件：...
验证结果：...
下一步：任务 13 前端图片上传。
```

---

## 任务 13：前端图片上传

### 目标

在器材详情页或编辑页实现图片上传。

### 只允许做

- 图片上传组件
- 图片删除按钮
- 图片预览

### 不允许做

- 不要写统计图表
- 不要写 Docker
- 不要写 PWA

### 要求

- 支持 jpg、jpeg、png、webp
- 前端提示最大 10MB
- 上传后自动刷新图片列表
- 删除图片需要确认
- 没有图片时显示空状态

### 验收标准

- 可以上传图片
- 可以看到图片预览
- 可以删除图片
- 刷新页面后图片仍然存在

### 完成后输出

```text
任务 13 完成。
修改文件：...
验证结果：...
下一步：任务 14 统计 API 与图表页面。
```

---

## 任务 14：统计 API 与图表页面

### 目标

实现基础统计 API 和图表页面。

### 只允许做

- stats API
- `/stats` 页面
- ECharts 图表

### 不允许做

- 不要写 Docker
- 不要写 PWA

### API

```text
GET /api/stats/summary
GET /api/stats/by-brand
GET /api/stats/by-type
GET /api/stats/lens-focal-length
GET /api/stats/film-stock
```

### 图表

```text
品牌占比：饼图
器材类型占比：饼图
焦段分布：柱状图
胶片库存：柱状图
资产估值：数字卡片
```

### 验收标准

- `/stats` 可以访问
- 图表正常显示
- 没有数据时显示空状态
- 移动端显示正常

### 完成后输出

```text
任务 14 完成。
修改文件：...
新增 API：...
验证结果：...
下一步：任务 15 文档整理与最终检查。
```

---

## 任务 15：文档整理与最终检查

### 目标

整理 README、API 文档、数据库文档，并做第一阶段最终验收。

### 只允许做

- 文档整理
- 小范围 bug 修复
- 启动命令检查
- 最终验收清单

### 不允许做

- 不要添加新功能
- 不要添加 Docker
- 不要添加 PWA

### README 必须包含

```text
项目介绍
技术栈
目录结构
本地开发启动方式
后端启动方式
前端启动方式
数据库位置
图片位置
备份方式
常见问题
```

### docs/database.md 必须包含

- Item 表说明
- Camera 表说明
- Lens 表说明
- Film 表说明
- Photo 表说明
- Transaction 表说明

### docs/api.md 必须包含

- Health API
- Items API
- Photos API
- Transactions API
- Stats API

### 备份说明

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

### 最终验收标准

第一阶段完成后，应满足：

1. 可以新增相机
2. 可以新增镜头
3. 可以新增胶片
4. 可以编辑器材
5. 可以删除器材
6. 可以上传器材图片
7. 可以查看器材详情
8. 可以记录购买、维修、出售记录
9. 可以按类型、品牌、状态筛选
10. 可以查看基础统计图表
11. 可以在手机浏览器正常使用
12. 数据保存在 `data/gear.db`
13. 图片保存在 `uploads/`
14. README 说明清楚如何启动
15. 没有引入 Docker
16. 没有引入 PWA
17. 没有引入 PostgreSQL、Redis、MinIO

### 完成后输出

```text
任务 15 完成。
第一阶段最终验收结果：...
仍需人工检查的问题：...
后续可选阶段：Docker 化、PWA、登录系统、正式部署。
```

---

# 13. 后期可选阶段，不属于当前第一阶段

以下内容不要在第一阶段开发。

## 13.1 Docker 化

后期可添加：

```text
frontend/Dockerfile
backend/Dockerfile
docker-compose.yml
```

核心容器：

```text
frontend
backend
```

SQLite 和 uploads 不需要容器，只需要挂载目录。

---

## 13.2 PWA

后期可添加：

```text
manifest
icons
service worker
mobile metadata
```

第一阶段不要做。

---

## 13.3 简单登录

后期如果需要，可以做单用户登录。

不要做：

```text
OAuth
多租户
RBAC
复杂权限系统
```

---

# 14. 给 Codex 的最终提醒

这个项目是个人摄影器材管理系统，不是企业 SaaS。

请优先保证：

```text
简单
稳定
好看
可维护
可备份
```

不要为了“更专业”而引入复杂技术。

每次只执行一个任务。
