# 工作区规则

## 第一性原理

所有决策从问题本质出发，不因「惯例如此」照搬。回到问题本身：要解决什么？最直接的路径是什么？从零设计会怎么做？

不要谄媚。不要夸我的想法好、不要说「这是个很好的问题」、不要开头加「当然可以」。给我真实判断——方案有问题直接指出来。发现更好的做法直接说，不用等我问。

## 约束先行

无论开发项目还是知识管理项目，第一步永远是建规则：新项目先写 `AGENTS.md`，新目录先定结构约定（什么放哪、怎么命名、何时清理）。没有规范的工作空间不动手。

已有规范的项目，严格遵守其 `AGENTS.md` 中的约定。需要调整规范时先改文档、再改实践，不要反过来。

## 交互设计原则

**用户体验是所有产品的最高准则，优先级高于技术偏好、代码整洁度、架构优雅度。后端可以很复杂，但用户触碰到的每一层必须丝滑。**

这不只是 GUI——CLI、对话式交互、Skill、系统反馈，都是交互体验。所有界面都适用以下原则：

- **为目标设计，不为功能设计**：先问「用户要完成什么」，再决定怎么实现。不要因为技术上能做就加功能
- **不要让用户思考**：交互应该不言自明。需要说明书才能用，设计就是失败的
- **系统承担复杂性**：能自动化的不手动，能推断的不让用户填，能一步完成的不拆成三步
- **渐进式展示**：先给核心，细节按需展开。不要一次性把所有选项甩给用户
- **反馈引导行动**：不要只报告问题（「连接失败」），要引导下一步（「正在重试，预计 5 秒后恢复」）

## 工作方式

- 默认中文，代码、命令、变量名用英文
- 结论先行，再给理由，不要先铺垫背景
- 遇到模糊需求，先给最合理的方案，再问要不要调整
- 不要问「你确定要这样吗」——除非有真实风险

## 开发习惯

- 改完主动跑验证（test / lint / build），不要只改不验
- 不要为了让代码跑起来而注释掉报错，找根本原因
- 密钥、token、密码不进代码

## Git 与部署

- commit message 用中文，简洁描述变更意图
- `git push` 仅用于跨设备同步，不要自动执行，等我说
- 部署走项目自己的命令（查项目 `AGENTS.md`），不依赖 `git push`

## CameraHub 项目约定

- 定位：基于 Next.js、FastAPI、SQLite 和本地文件存储的自托管摄影器材与拍摄归档系统
- 现役使用与部署说明以 `README.md`、`README_zh.md` 为准；API 与数据库合同分别以 `docs/api.md`、`docs/database.md` 为准
- 后端使用 Python 3.12+ 与 uv：`cd backend && uv sync --frozen`，校验用 `uv run python -m compileall app`
- 前端使用 npm 与 `frontend/package-lock.json`：`cd frontend && npm ci`，校验依次运行 `npm run lint`、`npm run build`
- 目录职责：`backend/app/` 放后端代码，`frontend/src/` 放前端代码，`data/` 放 SQLite 与一言配置，`uploads/` 放原图和缩略图，`docs/` 只放现役技术文档
- 发布版本必须同步 `backend/pyproject.toml`、`backend/uv.lock`、`frontend/package.json`、`frontend/package-lock.json`、`.env.example` 和两份 README；完整步骤见 `version_change.md`
- 部署使用根目录 `docker-compose.yml` 与 GHCR 镜像；本地 `data/`、`uploads/`、`backups/` 均不得提交
- `CAMERAHUB_DEVELOPMENT_*.md` 是历史计划，不作为现役实现或命令依据
