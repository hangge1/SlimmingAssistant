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
const apiConfigSource = readFileSync("backend/internal/config/config.go", "utf8");
const routerSource = readFileSync("backend/internal/httpserver/router.go", "utf8");
const mainSource = readFileSync("backend/cmd/api/main.go", "utf8");
const astroConfigSource = readFileSync("frontend/astro.config.mjs", "utf8");
const siteSource = readFileSync("frontend/src/data/site.ts", "utf8");
const homePageSource = readFileSync("frontend/src/pages/index.astro", "utf8");
const statePageSource = readFileSync("frontend/src/pages/state.astro", "utf8");
const pathPageSource = readFileSync("frontend/src/pages/path.astro", "utf8");
const recordsPageSource = readFileSync("frontend/src/pages/records.astro", "utf8");
const communityPageSource = readFileSync("frontend/src/pages/community.astro", "utf8");
const reviewPageSource = readFileSync("frontend/src/pages/review.astro", "utf8");
const projectPageSource = readFileSync("frontend/src/pages/projects/slimming.astro", "utf8");
const slimmingPageSource = readFileSync("frontend/src/pages/app/slimming.astro", "utf8");
const apiClientSource = readFileSync("frontend/src/lib/api.ts", "utf8");
const slimmingShellSource = readFileSync("frontend/src/components/slimming/SlimmingAppShell.vue", "utf8");
const readmeSource = readFileSync("README.md", "utf8");
const agentSource = readFileSync("AGENT.md", "utf8");
const productConstraintsSource = readFileSync("doc/product-constraints.md", "utf8");

function listFiles(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  });
}

test("default npm scripts and root dependencies are Go and Astro only", () => {
  assert.equal(packageSource.scripts.dev, "node scripts/dev-go-astro.mjs");
  assert.equal(packageSource.scripts.build, "npm run frontend:build && npm run backend:build");
  assert.equal(packageSource.scripts.start, "node scripts/start-go-astro.mjs");
  assert.equal(packageSource.scripts.release, "node scripts/create-go-astro-release-package.mjs");
  assert.equal(packageSource.scripts.typecheck, "npm run frontend:check");
  assert.equal(packageSource.scripts.test, "node --test tests/go-astro-default.test.mjs");
  assert.equal(packageSource.scripts.lint, "eslint scripts/create-go-astro-release-package.mjs scripts/deploy-cloud.mjs scripts/dev-go-astro.mjs scripts/start-go-astro.mjs tests/go-astro-default.test.mjs frontend/src/**/*.ts");
  assert.equal(packageSource.scripts.check, "npm run lint && npm run typecheck && npm test && npm run backend:test");

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
  assert.match(startGoAstroSource, /frontend", "dist"/);
  assert.match(startGoAstroSource, /\["run", "\.\/cmd\/api"\]/);
  assert.match(devGoAstroSource, /spawnProcess\("api", resolveGoCommand\(\), \["run", "\.\/cmd\/api"\]/);
  assert.match(devGoAstroSource, /"--prefix", "frontend", "run", "dev"/);
});

test("Astro public site owns ResetLife MVP and keeps slimming assistant as an action tool", () => {
  assert.match(astroConfigSource, /@astrojs\/vue/);
  assert.match(astroConfigSource, /output:\s*"static"/);
  assert.match(homePageSource, /复位/);
  assert.match(homePageSource, /重建人生系统/);
  assert.match(siteSource, /心理复位/);
  assert.match(siteSource, /认知复位/);
  assert.match(siteSource, /行动复位/);
  assert.match(siteSource, /自我定位/);
  assert.match(siteSource, /自我修复/);
  assert.match(siteSource, /复位社区/);
  assert.match(homePageSource, /自我定位/);
  assert.match(homePageSource, /自我修复/);
  assert.match(siteSource, /\/projects\/slimming/);
  assert.match(siteSource, /\/projects\/slimming-home-preview\.png/);
  assert.match(siteSource, /行动复位工具/);
  assert.match(statePageSource, /three/);
  assert.match(statePageSource, /order-map-canvas/);
  assert.match(statePageSource, /floating-fragment/);
  assert.match(statePageSource, /心理秩序/);
  assert.match(statePageSource, /认知秩序/);
  assert.match(statePageSource, /行动秩序/);
  assert.match(statePageSource, /有一点像/);
  assert.match(statePageSource, /很像/);
  assert.match(statePageSource, /几乎就是我/);
  assert.match(statePageSource, /resetlife:latest-path/);
  assert.match(statePageSource, /保存并查看复位路径/);
  assert.match(pathPageSource, /复位报告/);
  assert.match(pathPageSource, /自我修复的三条方向/);
  assert.match(recordsPageSource, /我的复位记录/);
  assert.match(communityPageSource, /复位社区/);
  assert.match(reviewPageSource, /复盘再校准/);
  assert.match(projectPageSource, /从身体秩序开始/);
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
  assert.match(releaseSource, /resolve\(projectRoot, "frontend", "dist"\)/);
  assert.match(releaseSource, /go", \["test", "\.\/\.\.\."\]/);
  assert.match(releaseSource, /go", \["build"/);
  assert.match(releaseSource, /apiBinaryName/);
  assert.match(releaseSource, /nginx-site\.conf\.example/);
  assert.match(releaseSource, /README_DEPLOY\.md/);
  assert.match(releaseSource, /X-Internal-Reminder-Token/);
  assert.match(readmeSource, /Astro\/Vue 前端 \+ Go API 后端/);
  assert.match(readmeSource, /\/state/);
  assert.match(readmeSource, /\/path/);
  assert.match(readmeSource, /\/records/);
  assert.match(readmeSource, /\/community/);
  assert.match(readmeSource, /\/review/);
  assert.match(readmeSource, /doc\/product-constraints\.md/);
  assert.match(agentSource, /doc\/product-constraints\.md/);
  assert.match(productConstraintsSource, /选择题/);
  assert.match(productConstraintsSource, /卡片式分步对话/);
  assert.match(productConstraintsSource, /自我定位/);
  assert.match(productConstraintsSource, /自我修复/);
  assert.match(productConstraintsSource, /三维识别/);
  assert.match(productConstraintsSource, /面对面对话/);
  assert.match(productConstraintsSource, /复位社区约束/);
  assert.match(productConstraintsSource, /默认不公开/);
  assert.match(agentSource, /默认开发、构建、启动、发布路径已经切到 Astro\/Vue \+ Go/);
});

test("frontend and backend trees do not import Next runtime APIs", () => {
  for (const file of [...listFiles("frontend/src"), ...listFiles("backend")]) {
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
