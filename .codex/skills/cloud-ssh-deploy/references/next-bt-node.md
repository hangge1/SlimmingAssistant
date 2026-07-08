# Next.js + Baota Node Deployment Notes

## Environment Variables

Required:

```bash
DEPLOY_HOST=<server-host>
DEPLOY_USER=<ssh-user>
```

Common optional values:

```bash
DEPLOY_PORT=22
DEPLOY_ROOT=/www/wwwroot
DEPLOY_IDENTITY_FILE=~/.ssh/id_ed25519
DEPLOY_CURRENT_LINK=/www/wwwroot/slimming-assistant-current
DEPLOY_DATA_ROOT=/www/wwwroot/slimming-assistant-data
DEPLOY_SQLITE_PATH=/www/wwwroot/slimming-assistant-data/slimming-assistant.sqlite
DEPLOY_APP_PORT=3000
DEPLOY_START_SCRIPT=start:bt:3000
DEPLOY_RESTART=1
DEPLOY_KEEP_RELEASES=3
DEPLOY_BT_PROJECT=1
DEPLOY_BT_PROJECT_NAME=slimming_assistant
DEPLOY_BT_DOMAINS=www.hangge.xyz
DEPLOY_BT_NODE_VERSION=v24.18.0
```

After a successful deployment, the script deletes stale uploaded archives and keeps only the latest `DEPLOY_KEEP_RELEASES` version directories matching `slimming-assistant-[0-9]*`. The shared SQLite directory is outside this pattern and must not be deleted.

## BT Node Project Repair

If the BT panel Node project was deleted, run:

```bash
npm run bt:ensure-project
```

The script connects over SSH and invokes BT's own Node project model under `/www/server/panel/mod/project/nodejs/nodeMod.py`. It creates or updates the `sites` row, writes the Node vhost config, keeps the existing SSL material when available, and restarts the project with:

```bash
/usr/bin/env SQLITE_PATH=/www/wwwroot/slimming-assistant-data/slimming-assistant.sqlite npm run start:bt:3000
```

## BT Panel Setup

BT Node project should be configured once:

```bash
Root directory: /www/wwwroot/slimming-assistant-current
Start command: npm run start:bt:3000
```

If BT starts the app manually, set:

```bash
SQLITE_PATH=/www/wwwroot/slimming-assistant-data/slimming-assistant.sqlite
```

## Why The Shared SQLite Path Matters

Release packages intentionally do not include production data. If SQLite stays under a versioned release directory, switching versions can make users and records appear missing. Keep production data at:

```bash
/www/wwwroot/slimming-assistant-data/slimming-assistant.sqlite
```

## SSH Key Bootstrap

Do not store passwords. If key auth is missing, help the user configure a key.

Linux/macOS:

```bash
ssh-keygen -t ed25519 -C "slimming-assistant-deploy"
ssh-copy-id <ssh-user>@<server-host>
```

Windows without `ssh-copy-id`: append the local public key, such as `~/.ssh/id_ed25519.pub`, to the remote user's `~/.ssh/authorized_keys`.

## Troubleshooting

If deployment appears successful but the old app is visible, verify the process working directory:

```bash
ssh <ssh-user>@<server-host> "ps -eo pid,ppid,lstart,cmd | grep -E 'next|node|npm|slimming' | grep -v grep"
```

If logout redirects to `0.0.0.0`, verify the deployed version includes `scripts/forwarded-host.mjs` support for BT `X-Host` and `X-Scheme` headers.

If dependency install warns about `better-sqlite3` or `sharp` scripts, treat it as a warning unless runtime alias preparation fails. The deployment script runs `npm run prepare:bt`, which prepares the `better-sqlite3-*` runtime alias used by Next builds.
