# 云服务器自动化部署

目标服务器默认值：

- Host: `112.124.69.114`
- User: `root`
- Deploy root: `/www/wwwroot`

脚本只负责构建、上传、解压、安装生产依赖和执行 `prepare:bt`。网站启动仍由宝塔或你手动处理。

## 推荐：先配置 SSH Key

不要把服务器密码写进仓库或脚本。建议在本机执行一次：

```bash
ssh-keygen -t ed25519 -C "slimming-assistant-deploy"
ssh-copy-id root@112.124.69.114
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
DEPLOY_HOST=112.124.69.114
DEPLOY_USER=root
DEPLOY_ROOT=/www/wwwroot
DEPLOY_PORT=22
DEPLOY_IDENTITY_FILE=~/.ssh/id_ed25519
DEPLOY_ARCHIVE=dist/releases/xxx.tar.gz
```

示例：

```bash
DEPLOY_IDENTITY_FILE=~/.ssh/id_ed25519 npm run deploy:cloud
```

## 部署后启动

脚本不会启动网站。部署完成后，目标目录会输出：

```bash
/www/wwwroot/<release-folder>
```

进入该目录后启动：

```bash
npm run start:bt
```

宝塔启动命令也保持：

```bash
npm run start:bt
```

不要把 `npm install`、`npm run build`、`npm run release` 放到宝塔启动命令里。
