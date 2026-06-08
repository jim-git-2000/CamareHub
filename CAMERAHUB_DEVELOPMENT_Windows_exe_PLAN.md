# CameraHub Windows EXE 桌面版开发计划

## 0. 目标

为 CameraHub 规划一个第一阶段可落地的 Windows 桌面版方案。

本计划只针对：

- Windows 平台
- Electron 技术路线
- 运行后直接打开桌面窗口
- 安装包内置 Python 运行环境和 FastAPI 后端

不包含：

- Tauri 方案落地
- macOS / Linux 安装包
- 自动更新
- 签名
- 多平台统一安装器

---

## 1. 总体建议

对于当前仓库，第一阶段更适合选 **Electron**，不建议直接上 Tauri。

原因：

1. 当前项目是 `Next.js + FastAPI + SQLite + uploads` 的 Web 架构
2. Electron 更适合把“本地网页应用”快速封装成桌面软件
3. 开发环境更简单
4. 启动本地 Python 后端、管理子进程、打 Windows 安装包都更直接
5. 第一版重点是先做出一个能安装、能运行、用户不需要额外装 Python 的桌面版本

结论：

```text
第一阶段桌面版：Electron + Windows + 内置 Python + 应用窗口
```

---

## 2. 分支策略

这个版本 **必须建议单独开分支开发**。

推荐分支名：

```text
feature/windows-desktop
```

或：

```text
feature/electron-windows
```

原因：

1. 改动面很大  
   会同时碰前端 API 地址策略、后端数据路径、启动方式、构建脚本、GitHub Actions、发布说明。

2. 会引入第二条发布链  
   当前主线已经有：

```text
Web + Docker + GHCR
```

桌面版会新增：

```text
Electron + Windows 安装包 + GitHub Release 附件
```

3. 中间状态很容易不可用  
   开发过程中可能出现：

- Electron 能跑，但 Web 版坏了
- 桌面路径改好了，但 Docker 版不兼容
- 后端可运行，但打包链还没打通

4. 便于反复试错  
   桌面版第一版通常要多轮调整：

- 本地端口
- Python 内置方式
- 用户数据目录
- 安装包打包方式
- GitHub Actions 构建方式

建议主线策略：

- `main` 继续保持当前 Web / Docker 发布可用
- 所有 Electron、Windows 安装包、桌面路径、桌面 workflow 改动只进桌面分支
- 满足桌面版验收条件后再考虑合并

推荐合并前最少验收条件：

1. 本地桌面版可启动
2. 用户机器无需手动安装 Python
3. 数据目录与 uploads 路径稳定
4. Web / Docker 构建未回归
5. GitHub Actions 能产出 `.exe`

---

## 3. 需要安装的开发环境

### 3.1 本地开发机

需要安装：

- Node.js 22.x
- npm
- Python 3.12
- uv
- Git
- Windows 10 或 Windows 11

建议：

- 优先在 Windows 本机上开发桌面版
- 不建议第一版主要在 Linux 虚拟机里做 Windows 桌面打包调试

### 3.1.1 当前这台 Ubuntu 开发环境检查结果

当前开发环境：

```text
Ubuntu 24.04.4 LTS
```

当前已具备：

```text
Node v24.16.0
npm 11.13.0
Python 3.12.3
uv 0.11.19
git 2.43.0
```

当前磁盘空间：

```text
/          约 17GB 可用
/workspace 约 39GB 可用
/tmp       约 17GB 可用
```

因此，这台机器当前已经具备：

- Python / uv / git
- Node / npm
- 足够的开发空间

还建议补齐的内容：

1. 安装 Node.js 22.x  
   当前机器是 Node 24，但桌面版和后续 CI 更建议统一到 Node 22 LTS，减少 Electron 兼容风险。

2. 安装 Electron 相关 npm 依赖  
   当前仓库还没有 Electron 工程，后续会新增例如：

```text
electron
electron-builder
concurrently
wait-on
cross-env
```

3. 按需补 Linux 图形运行库  
   如果后续 Electron 在 Ubuntu 上启动时报缺少 GTK / NSS / libasound 等库，再按需安装，不建议现在盲目装一大批。

当前这台 Ubuntu 机器 **不需要先安装**：

- wine
- nsis
- mingw
- rust
- cargo
- Windows SDK

前提是桌面版的 Windows `.exe` 交给 GitHub Actions 的 Windows runner 生成，而不是在这台 Ubuntu 本地打包。

### 3.1.2 当前 Linux 开发环境建议目标

对当前这台 Ubuntu 机器，建议目标固定为：

```text
本地负责开发和调试 Electron 桌面版
Windows 安装包由 GitHub Actions 打包
```

不建议把当前 Linux 环境的第一阶段目标设为：

```text
本地直接生成 Windows .exe
```

因为那会额外引入：

- wine
- NSIS 相关链路
- 更多 Windows 打包兼容问题

会显著增加环境复杂度和空间占用。

### 3.1.3 当前 Linux 环境额外空间占用预估

如果采用：

```text
Ubuntu 本地开发 + GitHub Actions 打 Windows exe
```

则这台机器后续新增占用大致为：

1. Node 22 LTS

```text
约 150MB - 250MB
```

2. Electron + electron-builder + npm 缓存

```text
约 500MB - 1.2GB
```

3. Electron 工程、本地构建产物和缓存

```text
约 300MB - 800MB
```

综合预估：

```text
新增约 1GB - 2GB
更现实的值约为 1.5GB 左右
```

因此当前这台 Ubuntu 开发环境空间是够的。

如果未来要把目标改成：

```text
Ubuntu 本地也要直接打 Windows exe
```

则通常还要再额外准备：

```text
约 1.5GB - 3GB
```

甚至更多的空间给 Wine、打包链和中间产物。

### 3.2 GitHub Actions / CI

需要：

- `windows-latest` runner
- Node.js 22
- Python 3.12
- Electron 打包工具，例如 `electron-builder`

不需要：

- Rust
- cargo
- Tauri toolchain

---

## 4. 当前仓库会涉及的关键改动点

### 4.1 前端 API 地址策略

当前前端核心逻辑在：

```text
frontend/src/lib/api.ts
```

当前行为：

- 依赖 `NEXT_PUBLIC_API_BASE_URL`
- 或通过 Next.js rewrite 访问 `/api`
- Docker 环境依赖 `http://backend:8000`

桌面版不能继续依赖这些策略。

桌面版应固定为：

```text
Electron 主进程启动本地后端
后端监听 127.0.0.1:38000
前端统一访问 http://127.0.0.1:38000
```

因此需要新增：

- 桌面模式 API 地址配置
- Web 模式兼容逻辑

要求：

- 不破坏现有 Web / Docker 路线
- 不把 Electron 的本地地址写死进普通网页部署

---

### 4.2 后端数据库与上传目录

当前后端配置在：

```text
backend/app/core/config.py
backend/app/database.py
backend/app/main.py
```

当前默认路径：

```text
sqlite:///./data/gear.db
./uploads
```

这对桌面版不合适，因为桌面用户不会在仓库根目录运行程序。

桌面版必须改成用户目录，例如：

```text
%APPDATA%/CameraHub/data/gear.db
%APPDATA%/CameraHub/uploads/
```

说明：

- SQLite 数据库
- 上传图片
- `data/quote_banner.txt`
- 后续新增本地配置文件

都应该统一进入用户数据目录。

实现方式建议：

- Electron 主进程启动时先计算应用数据目录
- 通过环境变量传给 FastAPI：

```text
DATABASE_URL
UPLOAD_DIR
APP_NAME
BACKEND_CORS_ORIGINS
```

---

### 4.3 桌面壳层

需要新增一个独立目录，例如：

```text
electron/
```

其中至少包含：

- Electron 主进程入口
- BrowserWindow 配置
- 后端子进程启动逻辑
- 应用退出时子进程清理逻辑
- 打包配置

推荐启动流程：

1. Electron 启动
2. 创建用户数据目录
3. 启动内置 FastAPI 后端
4. 等待健康检查通过
5. 打开桌面窗口
6. 加载前端页面
7. 退出时关闭后端子进程

不建议第一版：

- 启动系统默认浏览器
- 只做本地服务不做窗口

---

### 4.4 前端构建与桌面加载方式

当前前端是标准 Next.js 项目。

桌面版第一阶段建议：

- 使用生产构建产物
- Electron 加载前端页面
- 前端页面访问本地 FastAPI

建议做法：

1. 继续用 `next build`
2. 为 Electron 提供桌面专用启动方式
3. 明确桌面版使用的环境变量

注意：

- 不能依赖 `next dev`
- 不能依赖 Docker 网络中的 `backend`
- 不能继续假设浏览器外部环境存在

---

## 5. Electron 接入方案

### 5.1 方案结论

桌面版采用：

```text
Electron 主进程 + 本地 FastAPI 子进程 + 本地窗口
```

体验方式：

- 用户双击 `.exe`
- 自动打开 CameraHub 窗口
- 用户不需要自己打开浏览器

### 5.2 启动流程

固定流程：

1. Electron 主进程启动
2. 生成或确认用户数据目录
3. 启动内置 Python 后端
4. FastAPI 监听：

```text
127.0.0.1:38000
```

5. Electron 主进程轮询健康检查
6. 健康检查通过后创建主窗口
7. 主窗口加载前端
8. 退出应用时关闭子进程

### 5.3 窗口策略

第一阶段固定：

- 单窗口
- 默认打开概览页
- 不做托盘
- 不做最小化后台常驻
- 不做多实例管理

---

## 6. GitHub Actions 发布方案

桌面版应新增独立 workflow，不要和现有 Docker workflow 混在一起。

建议新增：

```text
.github/workflows/windows-desktop-release.yml
```

触发方式：

```text
workflow_dispatch
push tag: v*
```

构建平台：

```text
windows-latest
```

输出产物：

```text
CameraHub-Setup-0.1.0.exe
```

发布位置：

- GitHub Release 附件

保留现状：

- 现有 `docker-publish` 继续用于 Web / Docker 版
- 桌面 workflow 只负责 Windows 安装包

---

## 7. 代码改动范围

### 7.1 改动量判断

这不是小改。

改动量属于：

```text
中等到中等偏大
```

因为需要同时改：

- 前端 API 地址策略
- 后端路径来源
- Electron 主进程
- 打包流程
- GitHub Actions
- README / README_zh

### 7.2 需要新增的主要内容

- Electron 工程目录
- Electron 主进程入口
- Windows 打包配置
- 桌面版 GitHub Actions workflow
- 桌面版 README 说明

### 7.3 需要改动的现有系统

- 前端 API 调用入口
- 后端配置入口
- 数据目录解析逻辑
- 发布流程文档

---

## 8. EXE 安装包最终大小预估

按当前项目结构估算：

- Electron 运行时
- 内置 Python 3.12
- FastAPI / Pillow / SQLModel 等依赖
- Next.js 前端构建产物
- SQLite 数据初始化逻辑

第一版安装包体积预估：

```text
180MB - 280MB
```

更接近当前项目实际的估算值：

```text
约 220MB ± 40MB
```

安装后磁盘占用预估：

```text
350MB - 550MB
```

更接近当前项目实际的估算值：

```text
约 420MB ± 80MB
```

主要体积来源：

1. Electron 自身运行时
2. Python 运行时
3. Python 依赖
4. Next.js 构建产物

如果以后改成 Tauri，体积通常能小很多，但首版开发复杂度会上升。

---

## 9. 推荐开发顺序

建议按下面顺序推进桌面分支：

### 第一步：先开分支

```bash
git checkout -b feature/windows-desktop
```

### 第二步：先做运行方式打底

优先完成：

- Electron 主进程最小启动
- 后端子进程拉起
- 健康检查
- 窗口打开

先不要急着做打包。

### 第三步：再处理路径问题

完成：

- 数据目录改到用户目录
- uploads 改到用户目录
- quote banner 配置等本地文件改到用户目录

### 第四步：再做前端 API 兼容

完成：

- Electron 模式访问本地 FastAPI
- 保持 Web / Docker 不回归

### 第五步：最后再做打包与 CI

完成：

- Electron Builder 配置
- Windows 安装包输出
- GitHub Actions 自动构建
- GitHub Release 附件上传

### 第六步：最后补文档

补：

- README
- README_zh
- 安装说明
- 已知限制

---

## 10. 第一阶段不建议做的事

第一版不要同时做：

- Tauri 双路线
- Windows + macOS + Linux 三平台一起支持
- 自动更新
- 安装包签名
- 多窗口
- 系统托盘
- 后台常驻
- 数据迁移向导

这样会显著拖慢第一版落地。

---

## 11. 验收标准

桌面版分支准备合并前，至少应满足：

1. Windows 本机能直接启动桌面程序
2. 程序启动后自动打开 CameraHub 窗口
3. 用户机器无需额外安装 Python
4. SQLite 与 uploads 存在用户目录，不依赖仓库路径
5. 关闭窗口后，FastAPI 子进程会退出
6. Web / Docker 版构建未回归
7. GitHub Actions 能产出 Windows `.exe`
8. README 中能说明桌面版安装与使用方式

---

## 12. 最终建议

当前最合理的路线是：

```text
先稳定现有 Web / Docker 发布链
再新开 feature/windows-desktop 分支
第一版只做 Electron + Windows + 内置 Python
```

这是当前成本、复杂度、落地速度三者之间最稳妥的方案。
