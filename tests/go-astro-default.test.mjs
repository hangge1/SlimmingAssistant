import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const packageSource = JSON.parse(readFileSync("package.json", "utf8"));
const eslintSource = readFileSync("eslint.config.mjs", "utf8");
const startGoAstroSource = readFileSync("scripts/start-go-astro.mjs", "utf8");
const devGoAstroSource = readFileSync("scripts/dev-go-astro.mjs", "utf8");
const deployCloudSource = readFileSync("scripts/deploy-cloud.mjs", "utf8");
const releaseSource = readFileSync("scripts/create-go-astro-release-package.mjs", "utf8");
const apiConfigSource = readFileSync("server/internal/config/config.go", "utf8");
const routerSource = readFileSync("server/internal/httpserver/router.go", "utf8");
const mainSource = readFileSync("server/cmd/api/main.go", "utf8");
const astroConfigSource = readFileSync("web/astro.config.mjs", "utf8");
const siteSource = readFileSync("web/src/data/site.ts", "utf8");
const homePageSource = readFileSync("web/src/pages/index.astro", "utf8");
const projectPageSource = readFileSync("web/src/pages/projects/slimming.astro", "utf8");
const slimmingPageSource = readFileSync("web/src/pages/app/slimming.astro", "utf8");
const apiClientSource = readFileSync("web/src/lib/api.ts", "utf8");
const slimmingShellSource = readFileSync("web/src/components/slimming/SlimmingAppShell.vue", "utf8");
const readmeSource = readFileSync("README.md", "utf8");
const agentSource = readFileSync("AGENT.md", "utf8");

function listFiles(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  });
}

test("default npm scripts and root dependencies are Go and Astro only", () => {
  assert.equal(packageSource.scripts.dev, "node scripts/dev-go-astro.mjs");
  assert.equal(packageSource.scripts.build, "npm run web:build && npm run api:build");
  assert.equal(packageSource.scripts.start, "node scripts/start-go-astro.mjs");
  assert.equal(packageSource.scripts.release, "node scripts/create-go-astro-release-package.mjs");
  assert.equal(packageSource.scripts.typecheck, "npm run web:check");
  assert.equal(packageSource.scripts.test, "node --test tests/go-astro-default.test.mjs");
  assert.equal(packageSource.scripts.lint, "eslint scripts/create-go-astro-release-package.mjs scripts/deploy-cloud.mjs scripts/dev-go-astro.mjs scripts/start-go-astro.mjs tests/go-astro-default.test.mjs web/src/**/*.ts");
  assert.equal(packageSource.scripts.check, "npm run lint && npm run typecheck && npm test && npm run api:test");

  for (const name of ["dev", "build", "start", "release", "typecheck", "test", "lint", "check"]) {
    assert.doesNotMatch(packageSource.scripts[name], /next|start-bt|create-release-package/);
  }

  assert.deepEqual(
    Object.keys(packageSource.scripts).filter((name) => name.startsWith("legacy:")),
    [],
  );
  assert.deepEqual(Object.keys(packageSource.dependencies ?? {}), []);
  for (const name of ["next", "react", "react-dom", "better-sqlite3", "drizzle-orm", "eslint-config-next"]) {
    assert.equal(packageSource.devDependencies?.[name], undefined);
  }

  assert.doesNotMatch(eslintSource, /eslint-config-next|core-web-vitals|next\/typescript/);
});

test("Go server can be the production entrypoint for Astro static files and APIs", () => {
  assert.match(apiConfigSource, /StaticDir\s+string/);
  assert.match(apiConfigSource, /os\.Getenv\("STATIC_DIR"\)/);
  assert.match(mainSource, /StaticDir:\s+cfg\.StaticDir/);
  assert.match(routerSource, /staticFallback\(cfg\.StaticDir\)/);
  assert.match(routerSource, /http\.ServeFile\(w, r, candidate\)/);
  assert.match(routerSource, /strings\.HasPrefix\(cleanPath\(r\.URL\.Path\), "\/api"\)/);
  assert.match(startGoAstroSource, /STATIC_DIR/);
  assert.match(startGoAstroSource, /web", "dist"/);
  assert.match(startGoAstroSource, /\["run", "\.\/cmd\/api"\]/);
  assert.match(devGoAstroSource, /spawnProcess\("api", resolveGoCommand\(\), \["run", "\.\/cmd\/api"\]/);
  assert.match(devGoAstroSource, /"--prefix", "web", "run", "dev"/);
});

test("Astro public site owns the homepage and keeps slimming assistant as a project app", () => {
  assert.match(astroConfigSource, /@astrojs\/vue/);
  assert.match(astroConfigSource, /output:\s*"static"/);
  assert.match(homePageSource, /认知板块|cognition/i);
  assert.match(homePageSource, /技术板块|technology/i);
  assert.match(homePageSource, /项目板块|projects/i);
  assert.match(siteSource, /\/projects\/slimming/);
  assert.match(siteSource, /\/projects\/slimming-home-preview\.png/);
  assert.match(homePageSource, /project-card-image/);
  assert.match(projectPageSource, /detail-backdrop/);
  assert.match(projectPageSource, /\/app\/slimming/);
  assert.match(slimmingPageSource, /SlimmingAppShell/);
  assert.match(siteSource, /跑步瘦身助手|Slimming Assistant/);
});

test("Vue slimming app talks only to Go API endpoints for migrated capabilities", () => {
  for (const endpoint of [
    "/api/auth/session",
    "/api/auth/setup",
    "/api/auth/login",
    "/api/admin/users",
    "/api/slimming/summary",
    "/api/slimming/history",
    "/api/slimming/records/health",
    "/api/slimming/records/runs",
    "/api/slimming/goals/health",
    "/api/settings/profile",
    "/api/settings/smtp",
    "/api/reminders/run",
  ]) {
    assert.match(apiClientSource, new RegExp(endpoint.replaceAll("/", "\\/")));
  }

  assert.match(slimmingShellSource, /用户管理/);
  assert.match(slimmingShellSource, /提醒状态/);
  assert.match(slimmingShellSource, /邮件服务器配置/);
  assert.doesNotMatch(slimmingShellSource, /User management|Reminder status|SMTP config|Save profile/);
  assert.doesNotMatch(slimmingShellSource, /from "next|next\//);
});

test("Go and Astro release package is the default Baota artifact", () => {
  assert.match(releaseSource, /resolve\(projectRoot, "web", "dist"\)/);
  assert.match(releaseSource, /go", \["test", "\.\/\.\.\."\]/);
  assert.match(releaseSource, /go", \["build"/);
  assert.match(releaseSource, /apiBinaryName/);
  assert.match(releaseSource, /nginx-site\.conf\.example/);
  assert.match(releaseSource, /README_DEPLOY\.md/);
  assert.match(releaseSource, /X-Internal-Reminder-Token/);
  assert.match(readmeSource, /Astro\/Vue 前端 \+ Go API 后端/);
  assert.match(agentSource, /默认开发、构建、启动、发布路径已经切到 Astro\/Vue \+ Go/);
});

test("web and server trees do not import Next runtime APIs", () => {
  for (const file of [...listFiles("web/src"), ...listFiles("server")]) {
    if (!/\.(astro|vue|ts|go|mjs|js)$/.test(file)) continue;
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(source, /from ["']next(?:\/|["'])|next\/navigation|next\/server|next\/cache/, file);
  }
});

test("cloud deployment uses the Go binary release without remote Node runtime steps", () => {
  assert.match(deployCloudSource, /DEPLOY_APP_PORT \?\? "8080"/);
  assert.match(deployCloudSource, /restart-api\.sh/);
  assert.match(deployCloudSource, /api\/resetlife-api/);
  assert.match(deployCloudSource, /\/api\/healthz/);
  assert.doesNotMatch(deployCloudSource, /npm run prepare:bt|npm run .*start:bt|ensure-bt-node-project|\.next-start/);
});
