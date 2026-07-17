# AGENT.md

本文档给后续 AI 代理和开发者使用。项目对外沟通、页面文案和错误信息默认使用中文。

## 当前默认架构

默认开发、构建、启动、发布路径已经切到 Astro/Vue + Go。

- `npm run dev`：启动 Go API + Astro dev server。
- `npm run build`：构建 Astro 静态站点并编译 Go API。
- `npm run start`：Go 服务托管 `frontend/dist` 并提供 `/api/*`。
- `npm run release`：生成 Go + Astro 宝塔部署包。
- `npm run deploy:cloud`：上传 Go/Astro 发布包并重启服务器上的 Go API。

不要再新增 Next.js、React Server Actions、Drizzle 或 Node 后端路径。

## 项目概览

根路径 `/` 是“复位”首页，定位为重建人生系统。当前产品结构必须收敛为两块：`/state` 自我定位，以及自我定位之后进入的自我修复。`/state` 通过心理秩序、认知秩序、行动秩序三维识别生成秩序结构图；`/path` 承接为复位报告，并推荐 `/psychology`、`/cognition`、`/action` 三条自我修复方向。`/records` 是我的复位记录，`/community` 是复位社区，`/review` 是复盘再校准。表单数据第一版保存到浏览器本地。跑步瘦身助手作为行动复位中的工具入口保留，详情页在 `/projects/slimming`，应用入口在 `/app/slimming`。

跑步瘦身助手当前能力：

- 管理员、普通用户、访客模式
- 登录保护和用户管理
- 每日健康记录，同日覆盖
- 跑步记录，同日可多条
- 历史筛选、补录、编辑、删除
- 健康目标与跑步目标
- 趋势曲线、目标进度、BMI 和反馈文案
- 个人资料、提醒规则、站内提醒、SMTP 邮件提醒

## 技术栈

- `frontend/`：Astro + Vue
- `backend/`：Go + SQLite
- `scripts/`：Node.js 辅助脚本，只负责开发编排、发布打包和云部署
- `tests/`：Node test runner，验证 Go/Astro 默认架构

## 常用命令

```bash
npm run dev
npm test
npm run typecheck
npm run lint
npm run check
npm run build
npm run release
```

## 目录结构

- `frontend/`：复位网站和跑步助手前端。
- `backend/`：Go API、业务服务、SQLite repository。
- `scripts/`：`dev-go-astro`、`start-go-astro`、发布包和云部署脚本。
- `tests/`：默认架构回归测试。
- `doc/`：规划和部署文档。
- `_bmad-output/`：BMad 规划和 story 执行记录。

## 开发约束

- 页面、表单、错误信息和用户可见文案使用中文。
- 根路径 `/` 保持为复位首页，不要重新变成跑步助手首页。
- 跑步助手应用入口保持 `/app/slimming`。
- 前端通过 `/api/*` 调用 Go 后端。
- 不直接在前端写数据库。
- 密码、设备 token、提醒内部 token 不保存明文。
- 跑步配速是只读计算值，由运动时长和公里数得到。
- 访客模式只做临时体验，数据不写入持久数据库。
- SMTP 发信配置只允许管理员维护。
- 运行产物不要提交：`dist/`、`frontend/dist/`、`data/`、`backend/data/`、`.dev-logs/`、`.agents/`、`node_modules/`。

## 产品硬约束

产品体验规则单独维护在 `doc/product-constraints.md`。新增页面、修改表单交互、调整页面文案前，必须先阅读并遵守该文档。

## 验证要求

提交前至少运行：

```bash
npm run check
npm run build
```

涉及部署脚本或发布结构时还要运行：

```bash
npm run release
```
