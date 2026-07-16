# 云端自动部署

`npm run deploy:cloud` 用于把当前 Go/Astro 发布包部署到云服务器。

## 前置条件

- 本地能通过 SSH 登录服务器。
- 服务器是 Linux amd64，或通过 `GO_RELEASE_OS` / `GO_RELEASE_ARCH` 生成匹配平台的 Go 二进制。
- 宝塔网站根目录可配置为 `/www/wwwroot/reset-life/current/public`。
- 宝塔 Nginx 将 `/api/` 反向代理到 `127.0.0.1:8080`。

## 基本用法

```bash
DEPLOY_HOST=your.server DEPLOY_USER=root npm run deploy:cloud
```

跳过本地重新打包，直接使用 `dist/releases/` 最新发布包：

```bash
DEPLOY_HOST=your.server DEPLOY_USER=root npm run deploy:cloud:skip-release
```

## 环境变量

```bash
DEPLOY_HOST=your.server
DEPLOY_USER=root
DEPLOY_PORT=22
DEPLOY_IDENTITY_FILE=~/.ssh/id_rsa
DEPLOY_APP_ROOT=/www/wwwroot/reset-life
DEPLOY_ROOT=/www/wwwroot/reset-life/releases
DEPLOY_CURRENT_LINK=/www/wwwroot/reset-life/current
DEPLOY_DATA_ROOT=/www/wwwroot/reset-life/data
DEPLOY_SQLITE_PATH=/www/wwwroot/reset-life/data/app.sqlite
DEPLOY_APP_PORT=8080
DEPLOY_INTERNAL_REMINDER_TOKEN=随机长字符串
DEPLOY_KEEP_RELEASES=3
DEPLOY_RESTART=1
```

## 部署流程

脚本会执行：

1. 本地 `npm run release` 生成 Go/Astro 发布包。
2. 通过 `scp` 上传到服务器。
3. 解压到 `releases/<version>`。
4. 复用上一版 `.env`，或按环境变量生成新的 `.env`。
5. 切换 `current` 软链。
6. 执行 `scripts/restart-api.sh` 重启 Go API。
7. 请求 `http://127.0.0.1:<DEPLOY_APP_PORT>/api/healthz` 验证服务。
8. 清理旧发布目录。

服务器端不会执行 `npm install`，也不会运行 Node 后端。
