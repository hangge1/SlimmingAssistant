# AI 自动化部署执行手册

本手册用于让 AI 或维护者在任意电脑拉取最新代码后，按同一套流程完成部署。

本项目同时提供项目内 Codex Skill：

```bash
.codex/skills/cloud-ssh-deploy
```

如果当前 Codex 环境不会自动发现项目内 Skill，可以直接要求 AI：

```text
请使用项目内 .codex/skills/cloud-ssh-deploy 这个 Skill 执行云端部署。
```

## 安全原则

- 不要把服务器用户名、密码、私钥、面板地址、面板 token 写入仓库。
- 不要把密码写进脚本、文档、提交信息、`.env` 示例或命令历史。
- 优先使用 SSH Key。密码只用于用户本人输入，或一次性配置 SSH Key。
- AI 如果缺少部署信息，必须先反问用户，不要猜测。

## AI 开始前必须确认

如果上下文里没有这些信息，先问用户补全：

1. `DEPLOY_HOST`：服务器公网 IP 或域名。
2. `DEPLOY_USER`：SSH 登录用户名。
3. `DEPLOY_PORT`：SSH 端口，默认 `22`。
4. 认证方式：本机是否已有 SSH Key；如果没有，让用户输入密码完成 SSH Key 配置。
5. `DEPLOY_ROOT`：部署根目录，默认 `/www/wwwroot`。
6. `DEPLOY_APP_PORT`：应用监听端口，默认 `3000`。
7. `DEPLOY_KEEP_RELEASES`：部署后保留的最近版本目录数量，默认 `3`。

不要要求用户把密码写入文件。需要密码时，说明只用于当前 SSH 连接或让用户在终端提示中输入。

## 新电脑首次准备

拉取代码后安装依赖：

```bash
npm install
```

确认本机有 SSH 客户端：

```bash
ssh -V
scp -V
```

推荐配置 SSH Key：

```bash
ssh-keygen -t ed25519 -C "slimming-assistant-deploy"
ssh-copy-id <ssh-user>@<server-host>
```

Windows 如果没有 `ssh-copy-id`，把本机公钥内容追加到服务器：

```bash
~/.ssh/id_ed25519.pub
```

服务器目标文件：

```bash
/root/.ssh/authorized_keys
```

如果 SSH 用户不是 `root`，目标路径应换成该用户的 home 目录下 `.ssh/authorized_keys`。

## 设置部署变量

PowerShell：

```powershell
$env:DEPLOY_HOST="<server-host>"
$env:DEPLOY_USER="<ssh-user>"
$env:DEPLOY_PORT="22"
$env:DEPLOY_IDENTITY_FILE="$env:USERPROFILE\.ssh\id_ed25519"
```

Bash：

```bash
export DEPLOY_HOST="<server-host>"
export DEPLOY_USER="<ssh-user>"
export DEPLOY_PORT="22"
export DEPLOY_IDENTITY_FILE="$HOME/.ssh/id_ed25519"
```

可选变量：

```bash
DEPLOY_ROOT=/www/wwwroot
DEPLOY_CURRENT_LINK=/www/wwwroot/slimming-assistant-current
DEPLOY_DATA_ROOT=/www/wwwroot/slimming-assistant-data
DEPLOY_SQLITE_PATH=/www/wwwroot/slimming-assistant-data/slimming-assistant.sqlite
DEPLOY_APP_PORT=3000
DEPLOY_START_SCRIPT=start:bt:3000
DEPLOY_RESTART=1
DEPLOY_KEEP_RELEASES=3
```

## 部署前检查

```bash
git status --short --branch
npm run check
node scripts/deploy-cloud.mjs --skip-release --dry-run
```

如果没有现成发布包，`--skip-release --dry-run` 可能提示缺少 release 包，这是正常的。正式部署会先构建。

## 正式部署

```bash
npm run deploy:cloud
```

脚本会自动执行：

1. 本地构建发布包。
2. 上传到服务器 `DEPLOY_ROOT`。
3. 解压到独立版本目录。
4. 使用共享 SQLite 路径执行迁移。
5. 更新 `slimming-assistant-current` 指向新版本。
6. 重启 `DEPLOY_APP_PORT` 上的应用。
7. 删除旧发布目录和残留压缩包，只保留最近 `DEPLOY_KEEP_RELEASES` 个 `slimming-assistant-数字版本` 目录。

## 部署后验证

确认固定入口目录：

```bash
ssh <ssh-user>@<server-host> "readlink -f /www/wwwroot/slimming-assistant-current"
```

确认应用进程：

```bash
ssh <ssh-user>@<server-host> "ss -ltnp | grep ':3000'"
```

确认公网访问：

```bash
curl -I https://<your-domain>/access/verify
```

确认退出登录不会跳到 `0.0.0.0`：

```bash
curl -I -X POST https://<your-domain>/access/logout
```

`Location` 应该是公网域名下的 `/access/verify`。

## 常见问题

如果脚本提示缺少 `DEPLOY_HOST` 或 `DEPLOY_USER`，让用户补充服务器地址和 SSH 用户名，然后设置环境变量再执行。

## 宝塔 Node 项目恢复

如果用户说“宝塔项目被删了”“Node 项目列表为空”“重新添加宝塔项目”，优先执行项目内脚本，而不是手工改面板：

```bash
npm run bt:ensure-project
```

执行前必须确认并设置：

```bash
DEPLOY_HOST=<server-host>
DEPLOY_USER=<ssh-user>
DEPLOY_PORT=22
```

常用可选项：

```bash
DEPLOY_BT_PROJECT_NAME=slimming_assistant
DEPLOY_BT_DOMAINS=www.hangge.xyz
DEPLOY_BT_NODE_VERSION=v24.18.0
DEPLOY_APP_PORT=3000
DEPLOY_START_SCRIPT=start:bt:3000
DEPLOY_SQLITE_PATH=/www/wwwroot/slimming-assistant-data/slimming-assistant.sqlite
```

脚本会调用宝塔面板的 `mod.project.nodejs.nodeMod`，创建或更新 Node 项目记录，并强制把启动命令写成带 `SQLITE_PATH` 的形式，避免应用读到版本目录里的临时数据库。

如果 SSH 提示密码，优先让用户配置 SSH Key。不要把密码写入仓库。

如果用户数据像丢失，检查应用是否使用共享数据库：

```bash
/www/wwwroot/slimming-assistant-data/slimming-assistant.sqlite
```

如果宝塔里仍然指向某个版本目录，把宝塔 Node 项目根目录固定为：

```bash
/www/wwwroot/slimming-assistant-current
```
