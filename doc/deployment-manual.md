# 部署手册

## 宝塔生产部署

生产环境推荐使用本地或 CI 生成的发布包。服务器只负责安装生产依赖、迁移数据库和启动长运行 Node.js 服务。

```bash
npm install
npm run release
```

上传 `dist/releases/*.tar.gz` 到服务器后解压：

```bash
mkdir -p /www/wwwroot/slimming-assistant
tar -xzf slimming-assistant-*.tar.gz -C /www/wwwroot/slimming-assistant --strip-components=1
cd /www/wwwroot/slimming-assistant
```

首次部署或更新依赖后，在 SSH 里执行一次：

```bash
npm run prepare:bt
```

宝塔项目启动命令只保留：

```bash
npm run start:bt:3000
```

不要把 `npm install`、`npm run build`、`npm run release` 或 `npm run prepare:bt` 放进宝塔启动命令。宝塔会在重启、守护拉起或开机时重复执行启动命令，小内存服务器容易因此被依赖安装或构建打满。

## 反向代理请求头

Next.js Server Actions 会校验浏览器 `Origin` 与 `Host` / `X-Forwarded-Host` 是否一致。HTTPS 反代常见问题是代理把默认端口带进 `X-Forwarded-Host`，例如：

```text
Origin: https://www.hangge.xyz
X-Forwarded-Host: www.hangge.xyz:443
```

这种请求会被 Next.js 判定为无效 Server Actions 请求。宝塔 Nginx 反向代理建议固定为：

```nginx
proxy_set_header Host $host;
proxy_set_header X-Forwarded-Host $host;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Forwarded-Port $server_port;
```

项目的 `npm run start:bt` 入口也会在请求进入 Next.js 前规范化默认端口，把 `www.hangge.xyz:443` 转为 `www.hangge.xyz`，把 `www.hangge.xyz:80` 转为 `www.hangge.xyz`，但会保留 `www.hangge.xyz:3000` 这类真实非默认端口。

## 多域名配置

如果同一应用允许多个公网域名访问，在构建发布包前设置：

```bash
SERVER_ACTION_ALLOWED_ORIGINS=www.hangge.xyz,hangge.xyz npm run release
```

也可以使用这些环境变量之一，项目会自动解析并写入 Next.js Server Actions 的可信来源：

```text
SERVER_ACTION_ALLOWED_ORIGINS
APP_ORIGIN
APP_URL
SITE_ORIGIN
SITE_URL
PUBLIC_ORIGIN
PUBLIC_URL
NEXT_PUBLIC_APP_ORIGIN
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_SITE_ORIGIN
NEXT_PUBLIC_SITE_URL
BT_PUBLIC_HOST
```

变量值可以是域名、完整 URL 或逗号分隔列表。默认端口 `:80`、`:443` 会被自动去掉。

## 排障检查

本机服务检查：

```bash
curl http://127.0.0.1:3000
ss -lntp | grep :3000
```

模拟宝塔 HTTPS 反代请求头：

```bash
curl -H 'X-Forwarded-Host: www.hangge.xyz:443' \
  -H 'X-Forwarded-Proto: https' \
  http://127.0.0.1:3000
```

如果页面能打开但提交目标、记录或设置时报：

```text
x-forwarded-host header with value ... does not match origin header ...
Invalid Server Actions request
```

优先检查：

- 宝塔 Nginx 是否使用了上面的 `proxy_set_header` 配置。
- 宝塔启动命令是否仍是 `npm run start:bt:3000`，没有绕过 `scripts/start-bt.mjs`。
- 发布包是否是最新构建，服务器是否已重启 Node 进程。
- 多域名场景是否设置了 `SERVER_ACTION_ALLOWED_ORIGINS` 并重新执行 `npm run release`。

每次修改部署脚本或反代头处理后，本地必须运行：

```bash
npm run check
```
