import { randomUUID } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb, type AppDb } from "../../../db/client.ts";
import {
  accessSecrets,
  type User,
  type UserSession,
  userSessions,
  users,
} from "../../../db/schema.ts";
import { DEFAULT_ADMIN_USER_ID, type UserRole } from "../services/auth-context.ts";

export type UserRepositoryError = {
  code: "duplicate_username" | "database_error";
  message: string;
};

export type UserRepositoryResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: UserRepositoryError };

type CreateUserInput = {
  username: string;
  displayName?: string | null;
  role: UserRole;
  passwordHash: string;
  passwordHashAlgorithm: string;
  nowIso: string;
};

type CreateSessionInput = {
  userId: string;
  sessionTokenHash: string;
  nowIso: string;
  expiresAtIso: string;
};

type UpdateUserPasswordInput = {
  userId: string;
  passwordHash: string;
  passwordHashAlgorithm: string;
  nowIso: string;
};

type UpdateUserInput = {
  userId: string;
  displayName?: string | null;
  role: UserRole;
  nowIso: string;
};

function ok<T>(data: T): UserRepositoryResult<T> {
  return { ok: true, data };
}

function fail(error: UserRepositoryError): UserRepositoryResult<never> {
  return { ok: false, error };
}

function mapRepositoryError(error: unknown): UserRepositoryError {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("UNIQUE") && message.includes("users")) {
    return { code: "duplicate_username", message: "用户名已存在" };
  }

  return { code: "database_error", message: "用户数据操作失败" };
}

export function createUserRepository(appDb: AppDb = getDb()) {
  return {
    countActiveUsers(): UserRepositoryResult<number> {
      try {
        const row = appDb
          .select()
          .from(users)
          .where(isNull(users.disabledAtIso))
          .all();

        return ok(row.length);
      } catch (error) {
        return fail(mapRepositoryError(error));
      }
    },

    getUserById(id: string): UserRepositoryResult<User | null> {
      try {
        return ok(
          appDb.select().from(users).where(and(eq(users.id, id), isNull(users.disabledAtIso))).get() ?? null,
        );
      } catch (error) {
        return fail(mapRepositoryError(error));
      }
    },

    getAnyUserById(id: string): UserRepositoryResult<User | null> {
      try {
        return ok(appDb.select().from(users).where(eq(users.id, id)).get() ?? null);
      } catch (error) {
        return fail(mapRepositoryError(error));
      }
    },

    getUserByUsername(username: string): UserRepositoryResult<User | null> {
      try {
        return ok(
          appDb
            .select()
            .from(users)
            .where(and(eq(users.username, username), isNull(users.disabledAtIso)))
            .get() ?? null,
        );
      } catch (error) {
        return fail(mapRepositoryError(error));
      }
    },

    listUsers(): UserRepositoryResult<User[]> {
      try {
        return ok(appDb.select().from(users).orderBy(desc(users.createdAtIso)).all());
      } catch (error) {
        return fail(mapRepositoryError(error));
      }
    },

    createUser(input: CreateUserInput): UserRepositoryResult<User> {
      try {
        const id = randomUUID();
        appDb
          .insert(users)
          .values({
            id,
            username: input.username,
            displayName: input.displayName ?? null,
            role: input.role,
            passwordHash: input.passwordHash,
            passwordHashAlgorithm: input.passwordHashAlgorithm,
            createdAtIso: input.nowIso,
            updatedAtIso: input.nowIso,
            disabledAtIso: null,
          })
          .run();

        return ok(appDb.select().from(users).where(eq(users.id, id)).get()!);
      } catch (error) {
        return fail(mapRepositoryError(error));
      }
    },

    ensureLegacyDefaultAdmin(nowIso: string): UserRepositoryResult<User | null> {
      try {
        const existing = appDb.select().from(users).where(eq(users.id, DEFAULT_ADMIN_USER_ID)).get();
        if (existing) {
          return ok(existing);
        }

        const secret = appDb.select().from(accessSecrets).where(eq(accessSecrets.id, "current")).get();
        if (!secret) {
          return ok(null);
        }

        appDb
          .insert(users)
          .values({
            id: DEFAULT_ADMIN_USER_ID,
            username: "admin",
            displayName: "管理员",
            role: "admin",
            passwordHash: secret.passwordHash,
            passwordHashAlgorithm: secret.passwordHashAlgorithm,
            createdAtIso: secret.createdAtIso,
            updatedAtIso: nowIso,
            disabledAtIso: null,
          })
          .run();

        return ok(appDb.select().from(users).where(eq(users.id, DEFAULT_ADMIN_USER_ID)).get()!);
      } catch (error) {
        return fail(mapRepositoryError(error));
      }
    },

    createSession(input: CreateSessionInput): UserRepositoryResult<UserSession> {
      try {
        const id = randomUUID();
        appDb
          .insert(userSessions)
          .values({
            id,
            userId: input.userId,
            sessionTokenHash: input.sessionTokenHash,
            createdAtIso: input.nowIso,
            lastSeenAtIso: input.nowIso,
            expiresAtIso: input.expiresAtIso,
            revokedAtIso: null,
          })
          .run();

        return ok(appDb.select().from(userSessions).where(eq(userSessions.id, id)).get()!);
      } catch (error) {
        return fail(mapRepositoryError(error));
      }
    },

    updateUserPassword(input: UpdateUserPasswordInput): UserRepositoryResult<User | null> {
      try {
        appDb
          .update(users)
          .set({
            passwordHash: input.passwordHash,
            passwordHashAlgorithm: input.passwordHashAlgorithm,
            updatedAtIso: input.nowIso,
          })
          .where(eq(users.id, input.userId))
          .run();

        return ok(appDb.select().from(users).where(eq(users.id, input.userId)).get() ?? null);
      } catch (error) {
        return fail(mapRepositoryError(error));
      }
    },

    updateUser(input: UpdateUserInput): UserRepositoryResult<User | null> {
      try {
        appDb
          .update(users)
          .set({
            displayName: input.displayName ?? null,
            role: input.role,
            updatedAtIso: input.nowIso,
          })
          .where(and(eq(users.id, input.userId), isNull(users.disabledAtIso)))
          .run();

        return ok(appDb.select().from(users).where(eq(users.id, input.userId)).get() ?? null);
      } catch (error) {
        return fail(mapRepositoryError(error));
      }
    },

    findActiveSessionByHash(sessionTokenHash: string, nowIso: string): UserRepositoryResult<UserSession | null> {
      try {
        const session =
          appDb
            .select()
            .from(userSessions)
            .where(and(eq(userSessions.sessionTokenHash, sessionTokenHash), isNull(userSessions.revokedAtIso)))
            .get() ?? null;

        if (!session || session.expiresAtIso <= nowIso) {
          return ok(null);
        }

        appDb
          .update(userSessions)
          .set({ lastSeenAtIso: nowIso })
          .where(eq(userSessions.id, session.id))
          .run();

        return ok(appDb.select().from(userSessions).where(eq(userSessions.id, session.id)).get() ?? null);
      } catch (error) {
        return fail(mapRepositoryError(error));
      }
    },

    revokeSessionByHash(sessionTokenHash: string, nowIso: string): UserRepositoryResult<void> {
      try {
        appDb
          .update(userSessions)
          .set({
            revokedAtIso: nowIso,
            lastSeenAtIso: nowIso,
          })
          .where(and(eq(userSessions.sessionTokenHash, sessionTokenHash), isNull(userSessions.revokedAtIso)))
          .run();

        return ok(undefined);
      } catch (error) {
        return fail(mapRepositoryError(error));
      }
    },

    revokeUserSessions(userId: string, nowIso: string): UserRepositoryResult<void> {
      try {
        appDb
          .update(userSessions)
          .set({
            revokedAtIso: nowIso,
            lastSeenAtIso: nowIso,
          })
          .where(and(eq(userSessions.userId, userId), isNull(userSessions.revokedAtIso)))
          .run();

        return ok(undefined);
      } catch (error) {
        return fail(mapRepositoryError(error));
      }
    },

    disableUser(userId: string, nowIso: string): UserRepositoryResult<User | null> {
      try {
        appDb
          .update(users)
          .set({
            disabledAtIso: nowIso,
            updatedAtIso: nowIso,
          })
          .where(and(eq(users.id, userId), isNull(users.disabledAtIso)))
          .run();

        return ok(appDb.select().from(users).where(eq(users.id, userId)).get() ?? null);
      } catch (error) {
        return fail(mapRepositoryError(error));
      }
    },
  };
}
