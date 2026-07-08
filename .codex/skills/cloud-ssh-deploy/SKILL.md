---
name: cloud-ssh-deploy
description: Project-local workflow for deploying this repository to a cloud Linux server over SSH. Use when the user asks to deploy, publish, release to cloud, update the Baota/BT Node site, run npm run deploy:cloud, or make deployment reusable across machines. Guides Codex to collect missing host/user/auth details safely, run the repo deployment script, and verify the live service without storing secrets.
---

# Cloud SSH Deploy

Use this skill only from this repository root. It orchestrates the project-owned deployment script; it does not store server credentials.

## Safety Rules

- Never write server passwords, private keys, panel tokens, or concrete production credentials into repo files, commits, logs, or docs.
- If `DEPLOY_HOST`, `DEPLOY_USER`, SSH port, or auth method is missing, ask the user for it before deploying.
- Prefer SSH key authentication. Use a password only transiently to let the user authenticate or to configure an SSH public key.
- Do not infer credentials from old chat history. Reconfirm missing deployment details in the current task.

## Required Context

Collect these before running a real deploy:

- `DEPLOY_HOST`: cloud server IP or domain.
- `DEPLOY_USER`: SSH username.
- `DEPLOY_PORT`: SSH port, default `22`.
- Auth method: existing SSH key, identity file, or user-entered password.
- Target app port, default `3000`.
- Release retention, default `DEPLOY_KEEP_RELEASES=3`.
- BT Node project name/domains if project creation is needed, defaults `DEPLOY_BT_PROJECT_NAME=slimming_assistant` and `DEPLOY_BT_DOMAINS=www.hangge.xyz`.

If the user wants details or troubleshooting, read `references/next-bt-node.md`.

## Workflow

1. Check repo state:

```bash
git status --short --branch
```

2. Set deployment variables in the current shell only.

PowerShell:

```powershell
$env:DEPLOY_HOST="<server-host>"
$env:DEPLOY_USER="<ssh-user>"
$env:DEPLOY_PORT="22"
```

Bash:

```bash
export DEPLOY_HOST="<server-host>"
export DEPLOY_USER="<ssh-user>"
export DEPLOY_PORT="22"
```

Set `DEPLOY_IDENTITY_FILE` only when the user provides a key path.

3. Validate locally:

```bash
npm run check
```

4. Dry-run the deploy command:

```bash
node scripts/deploy-cloud.mjs --skip-release --dry-run
```

If no release archive exists, continue with the real deploy; it will build one.

5. Deploy:

```bash
npm run deploy:cloud
```

6. If the BT Node project was manually deleted or the list is empty, repair it with the project script:

```bash
npm run bt:ensure-project
```

The normal deploy command runs this step automatically unless `DEPLOY_BT_PROJECT=0` or `DEPLOY_RESTART=0`.

7. Verify:

```bash
ssh <ssh-user>@<server-host> "readlink -f /www/wwwroot/slimming-assistant-current"
ssh <ssh-user>@<server-host> "ss -ltnp | grep ':3000'"
```

Check the public site and logout redirect:

```bash
curl -I https://<domain>/access/verify
curl -I -X POST https://<domain>/access/logout
```

`/access/logout` must redirect to the public domain, not `0.0.0.0`.

## Project Contract

The project deploy script owns these conventions:

- fixed current link: `/www/wwwroot/slimming-assistant-current`
- shared SQLite database: `/www/wwwroot/slimming-assistant-data/slimming-assistant.sqlite`
- production preparation: `npm run prepare:bt`
- default restart script: `npm run start:bt:3000`
- BT project repair script: `npm run bt:ensure-project`
- default BT project name: `slimming_assistant`
- default BT domain: `www.hangge.xyz`
- default release cleanup: keep the latest 3 `slimming-assistant-*` version directories; override with `DEPLOY_KEEP_RELEASES`

Do not manually reimplement these steps unless the script is broken. Fix `scripts/deploy-cloud.mjs` instead.
