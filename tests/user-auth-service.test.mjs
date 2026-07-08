import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { createUserRepository } from "../features/access/repositories/user-repository.ts";
import { loginUser } from "../features/access/services/user-auth-service.ts";
import * as schema from "../db/schema.ts";

function createTempUserRepository() {
  const dir = mkdtempSync(join(tmpdir(), "slimming-assistant-user-auth-"));
  const sqlitePath = join(dir, "test.sqlite");
  const sqlite = new Database(sqlitePath);
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: "./db/migrations" });

  return {
    repository: createUserRepository(db),
    cleanup() {
      sqlite.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

test("登录空用户名和空密码会返回字段级中文提示", async () => {
  const { repository, cleanup } = createTempUserRepository();

  try {
    const result = await loginUser(repository, {
      username: "",
      password: "",
      nowIso: "2026-07-08T00:00:00.000Z",
    });

    assert.equal(result.ok, false);
    assert.equal(result.ok ? "" : result.fieldErrors.username, "请输入用户名");
    assert.equal(result.ok ? "" : result.fieldErrors.password, "请输入密码");
  } finally {
    cleanup();
  }
});
