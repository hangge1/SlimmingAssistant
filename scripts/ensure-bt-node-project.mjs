import { spawnSync } from "node:child_process";

const defaultRoot = "/www/wwwroot";
const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");

const host = readRequiredEnv("DEPLOY_HOST", "cloud server host or public IP");
const user = readRequiredEnv("DEPLOY_USER", "SSH login username");
const deployRoot = process.env.DEPLOY_ROOT ?? defaultRoot;
const identityFile = process.env.DEPLOY_IDENTITY_FILE;
const sshPort = process.env.DEPLOY_PORT;
const currentLink = process.env.DEPLOY_CURRENT_LINK ?? `${deployRoot}/slimming-assistant-current`;
const appPort = process.env.DEPLOY_APP_PORT ?? "3000";
const startScript = process.env.DEPLOY_START_SCRIPT ?? `start:bt:${appPort}`;
const dataRoot = process.env.DEPLOY_DATA_ROOT ?? `${deployRoot}/slimming-assistant-data`;
const sqlitePath = process.env.DEPLOY_SQLITE_PATH ?? `${dataRoot}/slimming-assistant.sqlite`;
const btProjectName = process.env.DEPLOY_BT_PROJECT_NAME ?? "slimming_assistant";
const btNodeVersion = process.env.DEPLOY_BT_NODE_VERSION ?? "v24.18.0";
const btRunUser = process.env.DEPLOY_BT_RUN_USER ?? "root";
const btPackageManager = process.env.DEPLOY_BT_PACKAGE_MANAGER ?? "npm";
const btDomains = readDomains();

if (!/^\d{2,5}$/.test(appPort)) {
  throw new Error(`DEPLOY_APP_PORT must be a port number, received: ${appPort}`);
}

function readRequiredEnv(name, description) {
  const value = process.env[name]?.trim();

  if (value) {
    return value;
  }

  console.error(`Missing required environment variable: ${name}`);
  console.error(`Set ${name} to the ${description}.`);
  console.error("Do not commit server usernames, passwords, or private keys.");
  process.exit(1);
}

function readDomains() {
  const rawValue =
    process.env.DEPLOY_BT_DOMAINS ??
    process.env.BT_PUBLIC_HOST ??
    process.env.APP_ORIGIN ??
    process.env.APP_URL ??
    process.env.SITE_ORIGIN ??
    process.env.SITE_URL ??
    "www.hangge.xyz";

  return rawValue
    .split(",")
    .map((value) => normalizeDomain(value.trim()))
    .filter(Boolean);
}

function normalizeDomain(value) {
  if (!value) {
    return "";
  }

  try {
    const url = value.includes("://") ? new URL(value) : new URL(`https://${value}`);
    return url.host;
  } catch {
    return value.replace(/^https?:\/\//u, "").split("/")[0];
  }
}

function sshBaseArgs() {
  const base = [];

  if (identityFile) {
    base.push("-i", identityFile);
  }

  if (sshPort) {
    base.push("-p", sshPort);
  }

  return base;
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function runSshScript(remoteScript) {
  const remote = `${user}@${host}`;
  const commandArgs = [...sshBaseArgs(), remote, "bash -s"];
  console.log(`\n$ ssh ${commandArgs.join(" ")} < ensure-bt-node-project`);

  if (dryRun) {
    console.log(remoteScript);
    return;
  }

  const result = spawnSync("ssh", commandArgs, {
    input: remoteScript,
    shell: false,
    stdio: ["pipe", "inherit", "inherit"],
  });

  if (result.error) {
    console.error(result.error.message);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const config = {
  appPort: Number(appPort),
  currentLink,
  domains: btDomains,
  nodeVersion: btNodeVersion,
  packageManager: btPackageManager,
  projectName: btProjectName,
  runUser: btRunUser,
  sqlitePath,
  startCommand: `/usr/bin/env SQLITE_PATH=${sqlitePath} npm run ${startScript}`,
};
const encodedConfig = Buffer.from(JSON.stringify(config), "utf8").toString("base64");

console.log("");
console.log(`BT project: ${btProjectName}`);
console.log(`BT domains: ${btDomains.length ? btDomains.join(", ") : "(none)"}`);
console.log(`BT root: ${currentLink}`);
console.log(`BT start command: ${config.startCommand}`);

const remoteScript = `set -e
panel_python="/www/server/panel/pyenv/bin/python"
if [ ! -x "$panel_python" ]; then
  echo "Baota panel Python was not found at $panel_python" >&2
  exit 1
fi

"$panel_python" - <<'PY'
import base64
import datetime
import json
import os
import sqlite3
import subprocess
import sys

sys.path.insert(0, "/www/server/panel")
sys.path.insert(0, "/www/server/panel/class")
os.chdir("/www/server/panel")

import public
from mod.project.nodejs.nodeMod import main as NodeProject

config = json.loads(base64.b64decode("${encodedConfig}").decode("utf-8"))
site_db = "/www/server/panel/data/db/site.db"

class Ws:
    def send(self, message):
        print("BT_WS", message)

    def close(self):
        print("BT_WS_CLOSE")

def split_domain(value):
    value = value.strip()
    if not value:
        return None
    if ":" in value:
        name, port = value.rsplit(":", 1)
        try:
            return name, int(port)
        except ValueError:
            return value, 80
    return value, 80

def format_domains():
    formatted = []
    for domain in config["domains"]:
        item = split_domain(domain)
        if not item:
            continue
        name, port = item
        formatted.append((name, port, "{}:{}".format(name, port)))
    return formatted

def kill_port(port):
    command = """
port_pids=$(ss -ltnp 2>/dev/null | sed -n 's/.*:%s .*pid=\\([0-9][0-9]*\\).*/\\1/p' | sort -u)
for pid in $port_pids; do
  parent=$(ps -o ppid= -p "$pid" | tr -d ' ')
  kill "$pid" 2>/dev/null || true
  if [ -n "$parent" ] && [ "$parent" != "1" ]; then kill "$parent" 2>/dev/null || true; fi
done
""" % int(port)
    subprocess.run(["bash", "-lc", command], check=True)

def base_project_config():
    domains = [item[2] for item in format_domains()]
    return {
        "project_name": config["projectName"],
        "pm2_name": "",
        "add_type": None,
        "watch": False,
        "cluster": 1,
        "project_cwd": config["currentLink"],
        "project_file": "",
        "project_script": config["startCommand"],
        "project_args": "",
        "project_type": "nodejs",
        "config_file": "",
        "config_body": "",
        "env": "",
        "bind_extranet": 1 if domains else 0,
        "domains": domains,
        "is_power_on": True,
        "run_user": config["runUser"],
        "max_memory_limit": 4096,
        "nodejs_version": config["nodeVersion"],
        "port": int(config["appPort"]),
        "log_path": "/www/wwwlogs/nodejs",
        "pkg_manager": config["packageManager"],
    }

def connect_site_db():
    if os.path.exists(site_db):
        backup = "{}.bak.{}".format(site_db, datetime.datetime.now().strftime("%Y%m%d%H%M%S"))
        subprocess.run(["cp", "-a", site_db, backup], check=True)
    return sqlite3.connect(site_db)

def get_project_row(conn):
    return conn.execute(
        "select id from sites where project_type='Node' and name=?",
        (config["projectName"],),
    ).fetchone()

def upsert_domain_rows(conn, project_id):
    conn.execute("delete from domain where pid=?", (project_id,))
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    for name, port, _domain in format_domains():
        conn.execute(
            "insert into domain(pid,name,port,addtime) values(?,?,?,?)",
            (project_id, name, port, now),
        )

def update_project(conn, project_id):
    project_config = base_project_config()
    conn.execute(
        """
        update sites
        set path=?, status='1', ps=?, project_config=?
        where id=?
        """,
        (
            config["currentLink"],
            "managed by scripts/ensure-bt-node-project.mjs",
            json.dumps(project_config, ensure_ascii=False),
            project_id,
        ),
    )
    upsert_domain_rows(conn, project_id)
    conn.commit()

def create_project():
    kill_port(config["appPort"])
    payload = {
        "def_name": config["projectName"],
        "project_cwd": config["currentLink"],
        "project_name": config["projectName"],
        "project_type": "nodejs",
        "project_script": config["startCommand"],
        "run_user": config["runUser"],
        "port": str(config["appPort"]),
        "env": "",
        "nodejs_version": config["nodeVersion"],
        "pkg_manager": config["packageManager"],
        "not_install_pkg": True,
        "release_firewall": False,
        "is_power_on": True,
        "max_memory_limit": 4096,
        "domains": [item[0] for item in format_domains()],
        "project_ps": "managed by scripts/ensure-bt-node-project.mjs",
    }
    get = public.to_dict_obj(payload)
    get._ws = Ws()
    NodeProject().create_project(get)

def restart_project():
    model = NodeProject()
    get = public.to_dict_obj({"project_name": config["projectName"]})
    stop_result = model.stop_project(get)
    if not stop_result.get("status"):
        kill_port(config["appPort"])
    start_result = model.start_project(get)
    if not start_result.get("status"):
        raise RuntimeError(json.dumps(start_result, ensure_ascii=False))
    model.set_config(config["projectName"])

conn = connect_site_db()
try:
    row = get_project_row(conn)
    if row:
        print("Updating existing BT Node project:", config["projectName"])
        update_project(conn, row[0])
        restart_project()
    else:
        print("Creating BT Node project:", config["projectName"])
        create_project()
finally:
    conn.close()

print("BT Node project is ready:", config["projectName"])
PY

if command -v nginx >/dev/null 2>&1; then
  nginx -t
  systemctl reload nginx 2>/dev/null || service nginx reload 2>/dev/null || true
fi

sleep 2
ss -ltnp 2>/dev/null | grep ${shellQuote(`:${appPort}`)}
`;

runSshScript(remoteScript);
