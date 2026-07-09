# AGENT.md

本文件给后续 AI 代理和开发者使用。项目对外沟通和页面文案默认使用中文。

## 项目概览

SlimmingAssistant 是一个个人使用的瘦身助手 Web 应用。第一版只支持手动录入，不接自动健康数据源；账号体系采用轻量管理员、普通用户、访客模式，不引入复杂注册系统。

核心能力：

- 管理员、普通用户、访客模式。
- 设备信任 + 登录保护。
- 每日健康记录，重复提交覆盖当天记录。
- 跑步记录，同日可多条。
- 历史筛选、补录、编辑、删除。
- 健康目标与跑步目标。
- 首页健康/运动曲线、目标进度、趋势估算、BMI、鼓励文案。
- 配置中心、站内提醒、SMTP 邮件提醒。

## 技术栈

- Next.js App Router
- React
- TypeScript
- SQLite
- Drizzle ORM
- Tailwind CSS
- Node test runner
- Playwright，用于本地 UI 截图

## 常用命令

```bash
npm run dev
npm test
npm run typecheck
npm run lint
npm run build
npm run ui:screenshot
npm run db:migrate
```

`npm run ui:screenshot` 会使用临时 SQLite 数据库，不污染真实本地数据。截图输出在 `.ui-screenshots/<timestamp>/`。

## 目录结构

- `app/`：Next.js 路由页面和全局样式。
- `components/`：通用布局和 UI 组件。
- `features/access/`：访问密码、设备 token、受信设备。
- `features/records/`：健康记录、跑步记录、历史记录。
- `features/goals/`：健康目标和跑步目标。
- `features/dashboard/`：首页摘要、曲线、目标进度。
- `features/settings/`：配置中心、个人资料、提醒、SMTP。
- `features/reminders/`：提醒事件与提醒 runner。
- `db/`：Drizzle schema、SQLite client、迁移文件。
- `scripts/`：迁移脚本、UI 截图脚本。
- `tests/`：Node test runner 测试。
- `doc/`：需求和开发日志。
- `_bmad-output/`：BMad 规划和 story 执行记录。

## 开发约束

- 页面、表单、错误信息和用户可见文案必须使用中文。
- 账号体系保持轻量：管理员维护用户，普通用户数据隔离，访客只做临时体验，不引入复杂注册、找回密码或第三方登录。
- 不直接在页面或 action 中操作数据库，优先经过 repository/service。
- 访问保护相关数据不能保存明文密码或明文设备 token。
- 跑步配速是只读计算值，由运动时长 / 公里数得到，不允许用户手动覆盖。
- 首页是工具界面，不做营销型 landing page。
- 桌面端主内容应使用可用宽度，避免固定窄容器造成右侧大面积空白。
- 曲线区域优先保持信息密度可控：单图展示，通过下拉切换指标。
- 运行产物不要提交：`.next/`、`.next-dev-logs/`、`.ui-screenshots/`、`data/`、`.agents/`。

## 产品防回归约定

- 首页第一屏目标区固定为两张卡片：健康目标（目标体重、目标腰围）和运动目标（每周跑步次数、每周跑量）。不要再拆成“目标体重 / 目标腰围”两张独立卡片。
- 首页状态配色必须可区分且克制：未设置目标用蓝灰中性提示；健康目标已设置或达成用翠绿色系；运动目标已设置或达成用运动蓝色系；今日打卡未完成用红色，完成用翠绿色。
- 登录页和首次创建管理员页必须保留鼠标移动、点击反馈的运动背景；登录后的所有主导航页必须共享全视口运动背景和鼠标跟随效果，不能只局限在首页或中间内容容器；动效要尊重 `prefers-reduced-motion`。
- 每日提醒时间必须用“小时 / 分钟”两个下拉框，分钟支持 `0-59`，后端仍保存为 `HH:mm`。
- SMTP 发信配置只允许管理员维护；普通用户只维护自己的提醒收件邮箱，并应有测试邮件入口。
- 邮件提醒不能用“同一用户同一天已有任意邮件事件”作为全局阻断。提醒事件需要按提醒时间区分；保存提醒规则或收件邮箱后，应清理当天相关邮件提醒事件，允许新的提醒时间重新发送。
- 管理员创建用户时填写的显示名称是用户默认昵称；用户设置页需要显示这个昵称并允许修改。
- 访客模式只做临时体验，数据只保存在本次前端会话，不写入持久数据库；访客不能进入设置页。
- 自动化部署优先使用项目内脚本，不把服务器 IP、用户名、密码写死到仓库；缺少凭据时由执行者在环境变量或交互输入中补齐。

## 验证要求

提交前至少运行：

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

涉及 UI 布局或视觉调整时还要运行：

```bash
npm run ui:screenshot
```

然后检查 `wide-首页.png`、`desktop-首页.png`、`mobile-首页.png`。如果改动影响其他页面，也检查对应页面截图。

## Git 约定

- 默认提交到 `main`。
- 第一个版本提交使用 `feat: initial slimming assistant app`。
- 不提交本地截图、日志、SQLite 数据文件、node_modules。
- 如果工作树出现与当前任务无关的用户改动，不要回滚，先确认改动来源和影响。

