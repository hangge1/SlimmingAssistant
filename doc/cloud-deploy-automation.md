# 云服务器自动化部署

目标服务器信息不写入代码仓库，需要部署时通过环境变量提供：

- `DEPLOY_HOST`：服务器公网 IP 或域名
- `DEPLOY_USER`：SSH 登录用户名
- `DEPLOY_ROOT`：部署根目录，默认 `/www/wwwroot`
- `DEPLOY_KEEP_RELEASES`：部署后保留的最近版本目录数量，默认 `3`

脚本负责构建、上传、解压、安装生产依赖、执行 `prepare:bt`、切换当前版本、重启应用进程，并清理旧发布目录。
脚本会维护一个固定入口目录：

```bash
/www/wwwroot/slimming-assistant-current
```

以后宝塔项目可以固定配置到这个目录；每次部署时脚本会把它切换到最新版本目录。
用户数据会固定保存在共享目录：

```bash
/www/wwwroot/slimming-assistant-data/slimming-assistant.sqlite
```

不要把生产数据放在某个版本目录的 `data/` 下，否则切换版本时容易误以为账号或个人数据丢失。

## 推荐：先配置 SSH Key

不要把服务器密码写进仓库或脚本。建议在本机执行一次：

```bash
ssh-keygen -t ed25519 -C "slimming-assistant-deploy"
ssh-copy-id <ssh-user>@<server-host>
```

Windows 如果没有 `ssh-copy-id`，可以手动把本机 `~/.ssh/id_ed25519.pub` 内容追加到服务器：

```bash
/root/.ssh/authorized_keys
```

## 一键打包并部署

```bash
npm run deploy:cloud
```

流程：

1. 本地执行 `npm run release`
2. 上传最新 `dist/releases/*.tar.gz` 到 `/www/wwwroot`
3. 在服务器解压到 `/www/wwwroot/<release-folder>`
4. 在服务器执行 `npm run prepare:bt`
5. 更新 `/www/wwwroot/slimming-assistant-current` 指向新版本
6. 使用共享 SQLite 路径重启 `3000` 端口上的应用进程

`prepare:bt` 会自动处理：

- 生产依赖安装：`npm install --omit=dev`
- SQLite 迁移：`npm run db:migrate`
- Next 生产构建需要的 `better-sqlite3-*` 运行时别名

## 使用已有发布包部署

如果已经打过包，不想重新构建：

```bash
npm run deploy:cloud:skip-release
```

也可以指定包：

```bash
DEPLOY_ARCHIVE=dist/releases/slimming-assistant-0.1.0-xxx.tar.gz npm run deploy:cloud:skip-release
```

## 可配置环境变量

```bash
DEPLOY_HOST=<server-host>
DEPLOY_USER=<ssh-user>
DEPLOY_ROOT=/www/wwwroot
DEPLOY_PORT=22
DEPLOY_IDENTITY_FILE=~/.ssh/id_ed25519
DEPLOY_ARCHIVE=dist/releases/xxx.tar.gz
DEPLOY_CURRENT_LINK=/www/wwwroot/slimming-assistant-current
DEPLOY_DATA_ROOT=/www/wwwroot/slimming-assistant-data
DEPLOY_SQLITE_PATH=/www/wwwroot/slimming-assistant-data/slimming-assistant.sqlite
DEPLOY_APP_PORT=3000
DEPLOY_START_SCRIPT=start:bt:3000
DEPLOY_RESTART=1
DEPLOY_KEEP_RELEASES=3
```

示例：

PowerShell：

```powershell
$env:DEPLOY_HOST="<server-host>"
$env:DEPLOY_USER="<ssh-user>"
$env:DEPLOY_IDENTITY_FILE="$env:USERPROFILE\.ssh\id_ed25519"
npm run deploy:cloud
```

Bash：

```bash
export DEPLOY_HOST="<server-host>"
export DEPLOY_USER="<ssh-user>"
export DEPLOY_IDENTITY_FILE="$HOME/.ssh/id_ed25519"
npm run deploy:cloud
```

## 宝塔项目只需要配置一次

推荐把宝塔 Node 项目的根目录设置为：

```bash
/www/wwwroot/slimming-assistant-current
```

启动命令设置为：

```bash
npm run start:bt:3000
```

如果你仍然使用宝塔手动启动，建议在项目环境变量里设置：

```bash
SQLITE_PATH=/www/wwwroot/slimming-assistant-data/slimming-assistant.sqlite
```

以后不要再删除旧项目、添加新项目。执行：

```bash
npm run deploy:cloud
```

脚本会自动切换 `slimming-assistant-current` 并重启 `3000` 端口应用。

部署完成后，目标目录会输出：

```bash
/www/wwwroot/<release-folder>
```

如果临时不想让脚本重启应用，可以执行：

```bash
DEPLOY_RESTART=0 npm run deploy:cloud
```

默认只保留最近 3 个版本目录，旧版本会在部署成功后自动删除。必要时可以手动把 `slimming-assistant-current` 指回仍保留的旧目录回滚：

```bash
ln -sfn /www/wwwroot/<old-release-folder> /www/wwwroot/slimming-assistant-current
```

如果服务器空间紧张，可以临时只保留当前版本：

```bash
DEPLOY_KEEP_RELEASES=1 npm run deploy:cloud
```

不要把 `npm install`、`npm run build`、`npm run release` 放到宝塔启动命令里。

## 自动创建或修复宝塔 Node 项目

部署脚本默认会在发布完成后执行：

```bash
npm run bt:ensure-project
```

这个步骤会通过 SSH 调用宝塔面板自带的 Node 项目模型，自动完成：

1. 在宝塔 Node 项目列表中创建或更新项目。
2. 项目根目录固定为 `/www/wwwroot/slimming-assistant-current`。
3. 启动命令固定为 `/usr/bin/env SQLITE_PATH=/www/wwwroot/slimming-assistant-data/slimming-assistant.sqlite npm run start:bt:3000`。
4. 绑定域名并重写 Nginx 反向代理配置。
5. 保留已有 SSL 证书配置并重载 Nginx。
6. 用宝塔项目机制重启 Node 进程。

可配置环境变量：

```bash
DEPLOY_BT_PROJECT=1
DEPLOY_BT_PROJECT_NAME=slimming_assistant
DEPLOY_BT_DOMAINS=www.hangge.xyz
DEPLOY_BT_NODE_VERSION=v24.18.0
DEPLOY_BT_RUN_USER=root
DEPLOY_BT_PACKAGE_MANAGER=npm
```

如果只是想上传代码，不希望脚本改动宝塔项目记录，可以临时关闭：

```bash
DEPLOY_BT_PROJECT=0 npm run deploy:cloud
```

`DEPLOY_RESTART=0` 也会跳过这个步骤，因为宝塔项目修复会重启 Node 进程。

如果你在宝塔面板里手动删除了 Node 项目，但 `/www/wwwroot/slimming-assistant-current` 和发布目录仍在，可以直接执行：

```bash
npm run bt:ensure-project
```
