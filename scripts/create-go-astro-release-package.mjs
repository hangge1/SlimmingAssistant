import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const packageJson = await import("../package.json", { with: { type: "json" } });
const targetOs = process.env.GO_RELEASE_OS || "linux";
const targetArch = process.env.GO_RELEASE_ARCH || "amd64";
const timestamp = new Date()
  .toISOString()
  .replaceAll("-", "")
  .replaceAll(":", "")
  .replace(/\.\d{3}Z$/, "");
const packageBaseName = `${packageJson.default.name}-go-astro-${packageJson.default.version}-${timestamp}`;
const distRoot = resolve(projectRoot, "dist");
const releasesRoot = resolve(distRoot, "releases");
const stagingRoot = resolve(distRoot, "go-astro-release-staging");
const packageRoot = resolve(stagingRoot, packageBaseName);
const apiBinaryName = targetOs === "windows" ? "resetlife-api.exe" : "resetlife-api";

function pathSeparator() {
  return process.platform === "win32" ? "\\" : "/";
}

function assertInside(parent, target) {
  const parentPath = resolve(parent);
  const targetPath = resolve(target);
  const targetRelative = relative(parentPath, targetPath);

  if (targetRelative.startsWith("..") || targetRelative === "" || targetRelative.includes(`..${pathSeparator()}`)) {
    throw new Error(`Refusing to operate outside ${parentPath}: ${targetPath}`);
  }
}

function resolveGoCommand() {
  if (process.env.GO_BINARY) {
    return process.env.GO_BINARY;
  }

  if (process.platform !== "win32") {
    return "go";
  }

  const candidates = [
    resolve(process.env.USERPROFILE ?? "", "go", "bin", "go.cmd"),
    resolve(process.env.USERPROFILE ?? "", "sdk", "go-current", "bin", "go.exe"),
  ];

  return candidates.find((candidate) => existsSync(candidate)) ?? "go";
}

function resolveLocalCommand(command, args) {
  if (process.platform === "win32" && command === "npm") {
    return { executable: "cmd.exe", args: ["/d", "/s", "/c", command, ...args] };
  }

  if (command === "go") {
    const goCommand = resolveGoCommand();
    if (process.platform === "win32" && goCommand.endsWith(".cmd")) {
      return { executable: "cmd.exe", args: ["/d", "/s", "/c", goCommand, ...args] };
    }

    return { executable: goCommand, args };
  }

  return { executable: command, args };
}

function run(command, args, options = {}) {
  console.log(`\n$ ${[command, ...args].join(" ")}`);
  const { executable, args: resolvedArgs } = resolveLocalCommand(command, args);
  const result = spawnSync(executable, resolvedArgs, {
    cwd: options.cwd ?? projectRoot,
    env: options.env ? { ...process.env, ...options.env } : process.env,
    shell: false,
    stdio: "inherit",
  });

  if (result.error) {
    console.error(result.error.message);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function createArchive() {
  mkdirSync(releasesRoot, { recursive: true });

  const tarPath = resolve(releasesRoot, `${packageBaseName}.tar.gz`);
  const tarResult = spawnSync("tar", ["-czf", tarPath, packageBaseName], {
    cwd: stagingRoot,
    shell: false,
    stdio: "inherit",
  });
  if (tarResult.status === 0) {
    return tarPath;
  }

  if (process.platform !== "win32") {
    throw new Error("Could not create tar.gz archive.");
  }

  const zipPath = resolve(releasesRoot, `${packageBaseName}.zip`);
  const psCommand = [
    "Compress-Archive",
    "-Path",
    JSON.stringify(join(packageRoot, "*")),
    "-DestinationPath",
    JSON.stringify(zipPath),
    "-Force",
  ].join(" ");
  run("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", psCommand]);

  return zipPath;
}

function listTopLevelEntries(root) {
  return readdirSync(root).map((entry) => {
    const entryPath = join(root, entry);
    return statSync(entryPath).isDirectory() ? `${entry}/` : entry;
  });
}

function writeDeployFiles() {
  const scriptsDir = resolve(packageRoot, "scripts");
  mkdirSync(scriptsDir, { recursive: true });

  writeFileSync(
    resolve(packageRoot, ".env.example"),
    [
      "API_ADDR=127.0.0.1:8080",
      "DATA_DIR=/www/wwwroot/reset-life/data",
      "SQLITE_PATH=/www/wwwroot/reset-life/data/app.sqlite",
      "INTERNAL_REMINDER_TOKEN=change-this-token",
      "",
    ].join("\n"),
  );

  writeFileSync(
    resolve(scriptsDir, "start-api.sh"),
    [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      "cd \"$(dirname \"$0\")/..\"",
      "mkdir -p \"${DATA_DIR:-./data}\"",
      "nohup ./api/resetlife-api > ./api/api.log 2>&1 &",
      "echo $! > ./api/api.pid",
      "",
    ].join("\n"),
    { mode: 0o755 },
  );

  writeFileSync(
    resolve(scriptsDir, "stop-api.sh"),
    [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      "cd \"$(dirname \"$0\")/..\"",
      "if [ -f ./api/api.pid ]; then",
      "  kill \"$(cat ./api/api.pid)\" 2>/dev/null || true",
      "  rm -f ./api/api.pid",
      "fi",
      "",
    ].join("\n"),
    { mode: 0o755 },
  );

  writeFileSync(
    resolve(scriptsDir, "restart-api.sh"),
    [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      "cd \"$(dirname \"$0\")/..\"",
      "if [ -f ./.env ]; then",
      "  set -a",
      "  . ./.env",
      "  set +a",
      "fi",
      "./scripts/stop-api.sh",
      "./scripts/start-api.sh",
      "",
    ].join("\n"),
    { mode: 0o755 },
  );

  writeFileSync(
    resolve(packageRoot, "nginx-site.conf.example"),
    [
      "server {",
      "    listen 80;",
      "    server_name example.com;",
      "    root /www/wwwroot/reset-life/current/public;",
      "    index index.html;",
      "",
      "    location /api/ {",
      "        proxy_pass http://127.0.0.1:8080;",
      "        proxy_set_header Host $host;",
      "        proxy_set_header X-Real-IP $remote_addr;",
      "        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;",
      "        proxy_set_header X-Forwarded-Proto $scheme;",
      "    }",
      "",
      "    location / {",
      "        try_files $uri $uri/ /index.html;",
      "    }",
      "}",
      "",
    ].join("\n"),
  );

  writeFileSync(
    resolve(packageRoot, "README_DEPLOY.md"),
    [
      "# Go + Astro 宝塔部署包",
      "",
      "目录说明：",
      "- `public/`：Astro 静态站点，可作为宝塔网站根目录。",
      "- `api/resetlife-api`：Linux Go API 二进制。",
      "- `scripts/restart-api.sh`：加载 `.env` 后重启 API。",
      "- `nginx-site.conf.example`：`/api/` 反代到 Go API 的 Nginx 示例。",
      "",
      "部署要点：",
      "1. 解压到服务器目录，例如 `/www/wwwroot/reset-life/releases/<version>`。",
      "2. 将 `.env.example` 复制为 `.env`，并按服务器路径调整 `DATA_DIR` / `SQLITE_PATH` / `INTERNAL_REMINDER_TOKEN`。",
      "3. 在宝塔网站配置中把根目录指向本包的 `public/`。",
      "4. 在 Nginx 配置中加入 `/api/` 反代，目标为 `http://127.0.0.1:8080`。",
      "5. 执行 `chmod +x scripts/*.sh api/resetlife-api && ./scripts/restart-api.sh`。",
      "6. 如需服务器定时执行提醒，可用宝塔计划任务请求 `POST /api/reminders/run`，请求头带 `X-Internal-Reminder-Token: <INTERNAL_REMINDER_TOKEN>`。",
      "",
    ].join("\n"),
  );
}

assertInside(distRoot, stagingRoot);

run("npm", ["--prefix", "web", "run", "build"]);
run("go", ["test", "./..."], { cwd: resolve(projectRoot, "server") });

rmSync(stagingRoot, { recursive: true, force: true });
mkdirSync(resolve(packageRoot, "public"), { recursive: true });
mkdirSync(resolve(packageRoot, "api"), { recursive: true });

cpSync(resolve(projectRoot, "web", "dist"), resolve(packageRoot, "public"), { recursive: true });

run("go", ["build", "-trimpath", "-ldflags=-s -w", "-o", resolve(packageRoot, "api", apiBinaryName), "./cmd/api"], {
  cwd: resolve(projectRoot, "server"),
  env: {
    CGO_ENABLED: "0",
    GOOS: targetOs,
    GOARCH: targetArch,
  },
});

if (!existsSync(resolve(packageRoot, "api", apiBinaryName))) {
  throw new Error("Go API binary was not created.");
}

writeDeployFiles();

const archivePath = createArchive();
const packageContents = listTopLevelEntries(packageRoot);
rmSync(stagingRoot, { recursive: true, force: true });

console.log("");
console.log(`Go + Astro release package created: ${archivePath}`);
console.log(`Target: ${targetOs}/${targetArch}`);
console.log("Top-level package contents:");
for (const entry of packageContents) {
  console.log(`- ${entry}`);
}
