# SlimmingAssistant 瘦身助手

SlimmingAssistant 是一个面向个人私有使用的 Web 健康管理助手。它的核心目的不是替代专业运动平台，而是把减脂过程中最容易断掉的一条链路补起来：集中记录每日健康数据和跑步数据，用趋势、目标差距和提醒机制给自己持续反馈，降低“忘记记录、懒得运动、看不到进步就放弃”的概率。

产品闭环可以概括为：

```text
设置目标 -> 每日记录 -> 查看趋势和目标差距 -> 收到提醒 -> 继续行动
```

## 核心功能

- **访问保护**：首次使用时创建访问密码，新浏览器需要验证后才能访问数据；已验证浏览器会作为受信设备保存。
- **今日记录**：录入当天健康记录和跑步记录。健康记录按自然日唯一保存，同一天重复提交会覆盖当天记录；跑步记录按单次运动保存，同一天可以有多条。
- **健康数据管理**：记录体重、腰围、臀围、体脂率，并结合身高计算 BMI 展示。
- **跑步数据管理**：记录跑步距离、时长、配速、平均心率、平均步幅、步频等指标。
- **历史记录**：按类型和时间范围查看健康记录、跑步记录，支持补录、编辑和删除。
- **目标管理**：设置健康目标和跑步目标，例如目标体重、目标围度、每周跑步次数、每周跑量。
- **首页仪表盘**：展示今日状态、健康摘要、运动摘要、目标进度、趋势曲线、预计达成时间和鼓励反馈。
- **提醒与配置**：配置个人资料、站内提醒、邮件提醒、SMTP 参数、趋势估算阈值、访问密码和受信设备。

## 技术栈

- Next.js 16 + React 19
- TypeScript 6
- SQLite + Drizzle ORM
- Tailwind CSS 4
- Nodemailer
- Node.js 内置测试运行器

## 本地运行

### 环境要求

- Node.js >= 24.0.0
- npm

### 安装依赖

```bash
npm install
```

### 初始化或迁移数据库

默认数据库路径为 `data/slimming-assistant.sqlite`。应用启动时也会自动执行迁移；如果希望手动迁移，可以运行：

```bash
npm run db:migrate
```

如需指定 SQLite 文件位置，可以设置 `SQLITE_PATH`：

```bash
SQLITE_PATH=./data/local.sqlite npm run db:migrate
```

### 启动开发服务

```bash
npm run dev
```

启动后打开 Next.js 输出的本地地址。首次访问会进入访问密码创建流程。

## 常用命令

```bash
npm run dev          # 启动开发服务
npm run build        # 构建生产版本
npm run start        # 启动生产服务，默认监听 0.0.0.0:3000
npm run start:bt     # 宝塔一键启动入口，自动安装生产依赖、迁移数据库并启动
npm run start:bt:3001 # 宝塔一键启动入口，固定监听 0.0.0.0:3001
npm run release      # 本地构建并生成 Linux 服务器发布包
npm run check        # 依次运行 lint、typecheck 和 test
npm run lint         # 运行 ESLint
npm run typecheck    # 生成 Next 类型并执行 TypeScript 检查
npm run test         # 运行单元测试
npm run db:generate  # 根据 schema 生成 Drizzle 迁移
npm run db:migrate   # 执行数据库迁移
```

## 生产部署

推荐在本地或 CI 构建发布包，服务器只负责安装生产依赖、迁移数据库和启动服务。

本地或 CI 执行：

```bash
npm install
npm run release
```

上传 `dist/releases/*.tar.gz` 到服务器并解压后，宝塔项目的启动命令只填写一个：

```bash
npm run start:bt:3000
```

这个命令会自动完成三件事：

- 首次部署或依赖变化时执行 `npm install --omit=dev`
- 每次启动前执行 `npm run db:migrate`
- 启动生产服务并监听 `0.0.0.0:3000`

如果宝塔无法配置环境变量，并且需要改端口，可以直接使用固定端口脚本：

```bash
npm run start:bt:3001
```

或者在启动脚本后追加参数：

```bash
node scripts/start-bt.mjs --port 3001
```

不要把 `npm run build` 放进宝塔启动命令；构建应该在发布包生成阶段完成，避免服务器重启时打满 CPU 和内存。

## 目录结构

```text
app/          Next.js App Router 页面与布局
components/   通用 UI 和布局组件
features/     按业务领域组织的组件、服务、仓储和 actions
db/           SQLite/Drizzle schema、客户端和迁移文件
lib/          通用工具函数
scripts/      数据库迁移、截图等辅助脚本
tests/        Node.js 测试用例
doc/          原始需求说明
docs/         项目文档
```

## 数据与隐私边界

SlimmingAssistant 当前按单用户、本地私有使用设计。健康记录、跑步记录、目标和提醒配置都保存在本地 SQLite 数据库中。访问密码和受信设备机制用于个人 MVP 的轻量访问保护，不等同于面向公网或多用户场景的完整认证系统。

如果要公开部署、多人使用或保存更敏感的数据，需要重新评估认证、授权、密钥管理、备份和传输安全方案。

## 当前不做的事情

- 不做公开注册、多用户账号、社交、排行榜或好友监督。
- 不做手表、跑步 App、体脂秤或第三方平台自动同步。
- 不做短信、微信、QQ 推送。
- 不做 AI 健身教练、饮食处方、疾病管理或医疗建议。

## 项目目标

这个项目优先服务一个朴素但明确的目标：让个人减脂和跑步记录变得足够集中、足够低摩擦、足够有反馈。只要每天能快速记录、首页能看懂自己离目标还有多远、忘记行动时能被提醒，SlimmingAssistant 就完成了第一阶段的价值。
