# ResetLife

## 当前架构

项目已经切换为 **Astro/Vue 前端 + Go API 后端**。

- `/` 是个人 Web 站点首页，包含认知、技术、项目三个板块。
- `/projects/slimming` 是跑步瘦身助手的项目详情页。
- `/app/slimming` 是跑步瘦身助手应用入口。
- Go 服务提供 `/api/*`，同时在生产模式下可以托管 `web/dist` 静态文件。
- 宝塔部署发布包位于 `dist/releases/*-go-astro-*.tar.gz`。

跑步瘦身助手仍是一个面向个人和小范围私有使用的健康记录工具，覆盖账号隔离、健康记录、跑步记录、目标管理、历史编辑、提醒规则、SMTP 邮件提醒和管理员用户管理。

## 技术栈

- Astro + Vue
- Go
- SQLite
- Node.js 脚本用于本地构建、检查和发布打包
- 宝塔 Nginx：静态文件 + `/api/` 反向代理

## 本地开发

环境要求：

- Node.js >= 24
- npm
- Go

常用命令：

```bash
npm install
npm --prefix web install
npm run dev
npm run check
npm run build
npm run release
```

`npm run dev` 会同时启动 Go API 和 Astro dev server。`npm run start` 会启动 Go 服务，并把 `STATIC_DIR` 指向 `web/dist`。

## 宝塔部署

本地生成发布包：

```bash
npm run release
```

发布包包含：

- `web/public/`：Astro 开发期静态资源；发布包内会生成 `public/` 静态站点目录
- `api/resetlife-api`：Linux Go API 二进制
- `scripts/restart-api.sh`：加载 `.env` 后重启 API
- `nginx-site.conf.example`：宝塔/Nginx 反代示例
- `README_DEPLOY.md`：服务器部署说明

典型服务器目录：

```text
/www/wwwroot/reset-life/
  current -> releases/<version>
  releases/
  data/app.sqlite
```

宝塔站点根目录指向：

```text
/www/wwwroot/reset-life/current/public
```

Nginx 需要把 `/api/` 反向代理到 Go API，例如：

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

可选自动部署：

```bash
DEPLOY_HOST=your.server DEPLOY_USER=root npm run deploy:cloud
```

部署脚本会上传最新 Go/Astro 发布包、切换 `current` 软链、写入或复用 `.env`、重启 Go API，并检查 `/api/healthz`。

## 环境变量

Go API 常用环境变量：

```bash
API_ADDR=127.0.0.1:8080
DATA_DIR=/www/wwwroot/reset-life/data
SQLITE_PATH=/www/wwwroot/reset-life/data/app.sqlite
INTERNAL_REMINDER_TOKEN=change-this-token
REMINDER_TIME_ZONE=Asia/Shanghai
REMINDER_CHECK_INTERVAL_MS=60000
REMINDER_CHECK_DISABLED=1
```

## 目录结构

```text
web/      Astro/Vue 前端
server/   Go API、SQLite 存储和业务服务
scripts/  开发、启动、发布和云部署脚本
tests/    Go/Astro 架构与脚本回归测试
doc/      规划、部署和开发记录
dist/     本地构建与发布产物
```

## 验证

提交前至少运行：

```bash
npm run check
npm run build
```

发布前运行：

```bash
npm run release
```
