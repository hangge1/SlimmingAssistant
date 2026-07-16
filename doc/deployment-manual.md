# 宝塔部署手册

当前生产部署使用 Astro 静态文件 + Go API，不需要在服务器上运行 Node 后端。

## 1. 本地生成发布包

```bash
npm install
npm --prefix web install
npm run release
```

发布包生成在：

```text
dist/releases/reset-life-go-astro-<version>-<timestamp>.tar.gz
```

## 2. 服务器目录建议

```text
/www/wwwroot/reset-life/
  current -> releases/<version>
  releases/
  data/app.sqlite
```

## 3. 手动部署

```bash
mkdir -p /www/wwwroot/reset-life/releases
tar -xzf reset-life-go-astro-*.tar.gz -C /www/wwwroot/reset-life/releases
ln -sfn /www/wwwroot/reset-life/releases/<解压后的目录名> /www/wwwroot/reset-life/current
cd /www/wwwroot/reset-life/current
cp .env.example .env
```

编辑 `.env`：

```bash
API_ADDR=127.0.0.1:8080
DATA_DIR=/www/wwwroot/reset-life/data
SQLITE_PATH=/www/wwwroot/reset-life/data/app.sqlite
INTERNAL_REMINDER_TOKEN=请替换为随机长字符串
REMINDER_TIME_ZONE=Asia/Shanghai
```

启动或重启 Go API：

```bash
chmod +x api/resetlife-api scripts/*.sh
./scripts/restart-api.sh
curl http://127.0.0.1:8080/api/healthz
```

## 4. 宝塔站点配置

宝塔网站根目录指向：

```text
/www/wwwroot/reset-life/current/public
```

Nginx 增加 `/api/` 反向代理：

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

location / {
    try_files $uri $uri/ /index.html;
}
```

如果宝塔启用 HTTPS，保持上述 `X-Forwarded-Proto` 即可。

## 5. 自动部署

本地配置 SSH 环境变量后执行：

```bash
DEPLOY_HOST=your.server DEPLOY_USER=root npm run deploy:cloud
```

常用可选变量：

```bash
DEPLOY_PORT=22
DEPLOY_IDENTITY_FILE=~/.ssh/id_rsa
DEPLOY_APP_ROOT=/www/wwwroot/reset-life
DEPLOY_APP_PORT=8080
DEPLOY_INTERNAL_REMINDER_TOKEN=随机长字符串
DEPLOY_KEEP_RELEASES=3
```

自动部署脚本会：

- 生成或复用最新发布包
- 上传并解压到 `releases/`
- 复用上一版 `.env`，或生成新的 `.env`
- 切换 `current` 软链
- 重启 Go API
- 检查 `/api/healthz`
- 清理旧发布包

## 6. 排查

检查 API：

```bash
curl http://127.0.0.1:8080/api/healthz
tail -80 /www/wwwroot/reset-life/current/api/api.log
```

检查端口：

```bash
ss -lntp | grep :8080
```

停止 API：

```bash
cd /www/wwwroot/reset-life/current
./scripts/stop-api.sh
```

如果静态页面能打开但接口失败，优先检查宝塔 Nginx 的 `/api/` 反向代理配置。
