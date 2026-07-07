import { randomUUID } from "node:crypto";
import type { Goal, HealthRecord, RunRecord } from "../../../db/schema.ts";
import type {
  CreateRunRecordInput,
  RecordsRepositoryResult,
  UpdateHealthRecordInput,
  UpdateRunRecordInput,
  UpsertHealthRecordInput,
} from "../../records/repositories/records-repository.ts";
import type {
  GoalType,
  GoalsRepositoryResult,
  SaveHealthGoalInput,
  SaveRunGoalInput,
} from "../../goals/repositories/goals-repository.ts";

type GuestSessionData = {
  healthRecords: HealthRecord[];
  runRecords: RunRecord[];
  goals: Goal[];
  updatedAtMs: number;
};

const guestSessions = new Map<string, GuestSessionData>();
const guestTtlMs = 2 * 60 * 60 * 1000;

function ok<T>(data: T) {
  return { ok: true as const, data };
}

function touch(session: GuestSessionData) {
  session.updatedAtMs = Date.now();
}

function getSession(guestSessionId: string) {
  const now = Date.now();

  for (const [sessionId, session] of guestSessions) {
    if (now - session.updatedAtMs > guestTtlMs) {
      guestSessions.delete(sessionId);
    }
  }

  let session = guestSessions.get(guestSessionId);
  if (!session) {
    session = {
      healthRecords: [],
      runRecords: [],
      goals: [],
      updatedAtMs: now,
    };
    guestSessions.set(guestSessionId, session);
  }

  touch(session);
  return session;
}

export function deleteGuestSession(guestSessionId: string) {
  guestSessions.delete(guestSessionId);
}

export function createGuestRecordsRepository(guestSessionId: string) {
  const session = getSession(guestSessionId);

  return {
    upsertHealthRecord(input: UpsertHealthRecordInput): RecordsRepositoryResult<HealthRecord> {
      const existing = session.healthRecords.find((record) => record.localDate === input.localDate);
      if (existing) {
        Object.assign(existing, {
          weightKg: input.weightKg ?? null,
          waistCm: input.waistCm ?? null,
          hipCm: input.hipCm ?? null,
          bodyFatPercentage: input.bodyFatPercentage ?? null,
          updatedAtIso: input.nowIso,
        });
        touch(session);
        return ok(existing);
      }

      const record: HealthRecord = {
        id: randomUUID(),
        userId: "guest",
        localDate: input.localDate,
        weightKg: input.weightKg ?? null,
        waistCm: input.waistCm ?? null,
        hipCm: input.hipCm ?? null,
        bodyFatPercentage: input.bodyFatPercentage ?? null,
        createdAtIso: input.nowIso,
        updatedAtIso: input.nowIso,
      };
      session.healthRecords.push(record);
      touch(session);
      return ok(record);
    },

    getHealthRecordByDate(localDate: string): RecordsRepositoryResult<HealthRecord | null> {
      return ok(session.healthRecords.find((record) => record.localDate === localDate) ?? null);
    },

    listHealthRecords(): RecordsRepositoryResult<HealthRecord[]> {
      return ok([...session.healthRecords].sort((a, b) => b.localDate.localeCompare(a.localDate)));
    },

    updateHealthRecord(id: string, input: UpdateHealthRecordInput): RecordsRepositoryResult<HealthRecord | null> {
      const record = session.healthRecords.find((item) => item.id === id) ?? null;
      if (!record) {
        return ok(null);
      }

      Object.assign(record, {
        ...(input.localDate === undefined ? {} : { localDate: input.localDate }),
        ...(input.weightKg === undefined ? {} : { weightKg: input.weightKg }),
        ...(input.waistCm === undefined ? {} : { waistCm: input.waistCm }),
        ...(input.hipCm === undefined ? {} : { hipCm: input.hipCm }),
        ...(input.bodyFatPercentage === undefined ? {} : { bodyFatPercentage: input.bodyFatPercentage }),
        updatedAtIso: input.updatedAtIso,
      });
      touch(session);
      return ok(record);
    },

    deleteHealthRecord(id: string): RecordsRepositoryResult<HealthRecord | null> {
      const index = session.healthRecords.findIndex((record) => record.id === id);
      if (index === -1) {
        return ok(null);
      }
      const [deleted] = session.healthRecords.splice(index, 1);
      touch(session);
      return ok(deleted ?? null);
    },

    createRunRecord(input: CreateRunRecordInput): RecordsRepositoryResult<RunRecord> {
      const record: RunRecord = {
        id: randomUUID(),
        userId: "guest",
        localDate: input.localDate,
        distanceKm: input.distanceKm,
        durationSeconds: input.durationSeconds ?? null,
        paceSecondsPerKm: input.paceSecondsPerKm ?? null,
        averageHeartRateBpm: input.averageHeartRateBpm ?? null,
        averageStrideMeters: input.averageStrideMeters ?? null,
        cadenceSpm: input.cadenceSpm ?? null,
        createdAtIso: input.nowIso,
        updatedAtIso: input.nowIso,
      };
      session.runRecords.push(record);
      touch(session);
      return ok(record);
    },

    getRunRecordById(id: string): RecordsRepositoryResult<RunRecord | null> {
      return ok(session.runRecords.find((record) => record.id === id) ?? null);
    },

    listRunRecordsByDate(localDate: string): RecordsRepositoryResult<RunRecord[]> {
      return ok(session.runRecords.filter((record) => record.localDate === localDate));
    },

    listRunRecords(): RecordsRepositoryResult<RunRecord[]> {
      return ok([...session.runRecords].sort((a, b) => b.localDate.localeCompare(a.localDate)));
    },

    updateRunRecord(id: string, input: UpdateRunRecordInput): RecordsRepositoryResult<RunRecord | null> {
      const record = session.runRecords.find((item) => item.id === id) ?? null;
      if (!record) {
        return ok(null);
      }
      Object.assign(record, {
        ...(input.localDate === undefined ? {} : { localDate: input.localDate }),
        ...(input.distanceKm === undefined ? {} : { distanceKm: input.distanceKm }),
        ...(input.durationSeconds === undefined ? {} : { durationSeconds: input.durationSeconds }),
        ...(input.paceSecondsPerKm === undefined ? {} : { paceSecondsPerKm: input.paceSecondsPerKm }),
        ...(input.averageHeartRateBpm === undefined ? {} : { averageHeartRateBpm: input.averageHeartRateBpm }),
        ...(input.averageStrideMeters === undefined ? {} : { averageStrideMeters: input.averageStrideMeters }),
        ...(input.cadenceSpm === undefined ? {} : { cadenceSpm: input.cadenceSpm }),
        updatedAtIso: input.updatedAtIso,
      });
      touch(session);
      return ok(record);
    },

    deleteRunRecord(id: string): RecordsRepositoryResult<RunRecord | null> {
      const index = session.runRecords.findIndex((record) => record.id === id);
      if (index === -1) {
        return ok(null);
      }
      const [deleted] = session.runRecords.splice(index, 1);
      touch(session);
      return ok(deleted ?? null);
    },
  };
}

export function createGuestGoalsRepository(guestSessionId: string) {
  const session = getSession(guestSessionId);

  return {
    getGoalByType(type: GoalType): GoalsRepositoryResult<Goal | null> {
      return ok(session.goals.find((goal) => goal.type === type) ?? null);
    },

    listGoals(): GoalsRepositoryResult<Goal[]> {
      return ok([...session.goals]);
    },

    saveHealthGoal(input: SaveHealthGoalInput): GoalsRepositoryResult<Goal> {
      return saveGoal(session, {
        type: "health",
        targetWeightKg: input.targetWeightKg,
        targetWaistCm: input.targetWaistCm ?? null,
        targetHipCm: input.targetHipCm ?? null,
        targetBodyFatPercentage: input.targetBodyFatPercentage ?? null,
        weeklyRunCount: null,
        weeklyDistanceKm: null,
        nowIso: input.nowIso,
      });
    },

    saveRunGoal(input: SaveRunGoalInput): GoalsRepositoryResult<Goal> {
      return saveGoal(session, {
        type: "run",
        targetWeightKg: null,
        targetWaistCm: null,
        targetHipCm: null,
        targetBodyFatPercentage: null,
        weeklyRunCount: input.weeklyRunCount,
        weeklyDistanceKm: input.weeklyDistanceKm,
        nowIso: input.nowIso,
      });
    },
  };
}

function saveGoal(
  session: GuestSessionData,
  input: {
    type: GoalType;
    targetWeightKg: number | null;
    targetWaistCm: number | null;
    targetHipCm: number | null;
    targetBodyFatPercentage: number | null;
    weeklyRunCount: number | null;
    weeklyDistanceKm: number | null;
    nowIso: string;
  },
) {
  let goal = session.goals.find((item) => item.type === input.type);
  if (!goal) {
    goal = {
      id: randomUUID(),
      userId: "guest",
      type: input.type,
      targetWeightKg: null,
      targetWaistCm: null,
      targetHipCm: null,
      targetBodyFatPercentage: null,
      weeklyRunCount: null,
      weeklyDistanceKm: null,
      createdAtIso: input.nowIso,
      updatedAtIso: input.nowIso,
    };
    session.goals.push(goal);
  }

  Object.assign(goal, {
    targetWeightKg: input.targetWeightKg,
    targetWaistCm: input.targetWaistCm,
    targetHipCm: input.targetHipCm,
    targetBodyFatPercentage: input.targetBodyFatPercentage,
    weeklyRunCount: input.weeklyRunCount,
    weeklyDistanceKm: input.weeklyDistanceKm,
    updatedAtIso: input.nowIso,
  });
  touch(session);
  return ok(goal);
}
