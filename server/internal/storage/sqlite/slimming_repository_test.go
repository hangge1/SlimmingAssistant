package sqlite

import (
	"context"
	"database/sql"
	"testing"
	"time"

	"resetlife/server/internal/slimming"
)

func TestSlimmingRepositoryReturnsUserScopedSummary(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	db := openTestDB(t)
	repository := SlimmingRepository{DB: db}
	now := time.Date(2026, 7, 15, 0, 0, 0, 0, time.UTC)

	insertHealthRecord(t, db, "health-1", "user-1", "2026-07-14", 82.3, 91.2, 24.5, now)
	insertHealthRecord(t, db, "health-2", "user-1", "2026-07-15", 81.8, 90.4, 24.1, now)
	insertHealthRecord(t, db, "health-other", "user-2", "2026-07-16", 70, 80, 20, now)
	insertRunRecord(t, db, "run-1", "user-1", "2026-07-15", 5.2, now)
	insertRunRecord(t, db, "run-2", "user-1", "2026-07-15", 3.3, now)
	insertRunRecord(t, db, "run-3", "user-1", "2026-07-14", 10, now)
	insertRunRecord(t, db, "run-other", "user-2", "2026-07-15", 99, now)
	insertGoal(t, db, "goal-health", "user-1", "health", 75, 84, 18, nil, nil, now)
	runCount := 4
	runDistance := 32.5
	insertGoal(t, db, "goal-run", "user-1", "run", 0, 0, 0, &runCount, &runDistance, now)

	summary, err := repository.GetSummary(ctx, "user-1", "2026-07-15")
	if err != nil {
		t.Fatalf("get summary: %v", err)
	}
	if summary.HealthSnapshot == nil || summary.HealthSnapshot.LocalDate != "2026-07-15" {
		t.Fatalf("unexpected health snapshot %#v", summary.HealthSnapshot)
	}
	if summary.HealthSnapshot.WeightKg == nil || *summary.HealthSnapshot.WeightKg != 81.8 {
		t.Fatalf("unexpected weight %#v", summary.HealthSnapshot.WeightKg)
	}
	if summary.HealthGoal == nil || summary.HealthGoal.TargetWeightKg == nil || *summary.HealthGoal.TargetWeightKg != 75 {
		t.Fatalf("unexpected health goal %#v", summary.HealthGoal)
	}
	if summary.RunGoal == nil || summary.RunGoal.WeeklyRunCount == nil || *summary.RunGoal.WeeklyRunCount != 4 {
		t.Fatalf("unexpected run goal %#v", summary.RunGoal)
	}
	if summary.TodayRun.Count != 2 || summary.TodayRun.DistanceKm != 8.5 || summary.TodayRun.LocalDate != "2026-07-15" {
		t.Fatalf("unexpected today run %#v", summary.TodayRun)
	}
	if summary.TotalRun.Count != 3 || summary.TotalRun.DistanceKm != 18.5 {
		t.Fatalf("unexpected total run %#v", summary.TotalRun)
	}
}

func TestSlimmingRepositoryUpsertsHealthRecord(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	db := openTestDB(t)
	repository := SlimmingRepository{DB: db}
	now := time.Date(2026, 7, 15, 0, 0, 0, 0, time.UTC)
	weight := 82.3
	waist := 91.2

	record, err := repository.UpsertHealthRecord(ctx, slimming.UpsertHealthRecordInput{
		UserID:    "user-1",
		LocalDate: "2026-07-15",
		WeightKg:  &weight,
		WaistCm:   &waist,
		Now:       now,
	})
	if err != nil {
		t.Fatalf("upsert health record: %v", err)
	}
	if record == nil || record.ID == "" || record.WeightKg == nil || *record.WeightKg != 82.3 {
		t.Fatalf("unexpected record %#v", record)
	}

	updatedWeight := 81.8
	updated, err := repository.UpsertHealthRecord(ctx, slimming.UpsertHealthRecordInput{
		UserID:    "user-1",
		LocalDate: "2026-07-15",
		WeightKg:  &updatedWeight,
		Now:       now.Add(time.Hour),
	})
	if err != nil {
		t.Fatalf("update health record: %v", err)
	}
	if updated.ID != record.ID || updated.WeightKg == nil || *updated.WeightKg != 81.8 || updated.WaistCm != nil {
		t.Fatalf("unexpected updated record %#v", updated)
	}

	var count int
	if err := db.QueryRowContext(ctx, "select count(*) from health_records where user_id = ?", "user-1").Scan(&count); err != nil {
		t.Fatalf("count health records: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected one upserted record, got %d", count)
	}
}

func TestSlimmingRepositoryCreatesRunRecord(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	db := openTestDB(t)
	repository := SlimmingRepository{DB: db}
	now := time.Date(2026, 7, 15, 0, 0, 0, 0, time.UTC)
	durationSeconds := 2040
	paceSeconds := 392
	heartRate := 145
	stride := 1.08
	cadence := 166

	record, err := repository.CreateRunRecord(ctx, slimming.CreateRunRecordInput{
		UserID:              "user-1",
		LocalDate:           "2026-07-15",
		DistanceKm:          5.2,
		DurationSeconds:     &durationSeconds,
		PaceSecondsPerKm:    &paceSeconds,
		AverageHeartRateBpm: &heartRate,
		AverageStrideMeters: &stride,
		CadenceSpm:          &cadence,
		Now:                 now,
	})
	if err != nil {
		t.Fatalf("create run record: %v", err)
	}
	if record == nil || record.ID == "" || record.DistanceKm != 5.2 {
		t.Fatalf("unexpected record %#v", record)
	}
	if record.DurationSeconds == nil || *record.DurationSeconds != durationSeconds {
		t.Fatalf("unexpected duration %#v", record.DurationSeconds)
	}
	if record.PaceSecondsPerKm == nil || *record.PaceSecondsPerKm != paceSeconds {
		t.Fatalf("unexpected pace %#v", record.PaceSecondsPerKm)
	}
}

func TestSlimmingRepositoryListsUpdatesAndDeletesRecords(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	db := openTestDB(t)
	repository := SlimmingRepository{DB: db}
	now := time.Date(2026, 7, 15, 0, 0, 0, 0, time.UTC)
	waist := 91.2
	updatedWeight := 81.8
	durationSeconds := 2160
	paceSeconds := 360

	insertHealthRecord(t, db, "health-1", "user-1", "2026-07-14", 82.3, 91.2, 24.5, now)
	insertHealthRecord(t, db, "health-other", "user-2", "2026-07-15", 70, 80, 20, now)
	insertRunRecord(t, db, "run-1", "user-1", "2026-07-14", 5.2, now)
	insertRunRecord(t, db, "run-other", "user-2", "2026-07-15", 99, now)

	healthRecords, err := repository.ListHealthRecords(ctx, "user-1")
	if err != nil {
		t.Fatalf("list health records: %v", err)
	}
	if len(healthRecords) != 1 || healthRecords[0].ID != "health-1" || healthRecords[0].CreatedAtIso == "" {
		t.Fatalf("unexpected health records %#v", healthRecords)
	}

	updatedHealth, err := repository.UpdateHealthRecord(ctx, slimming.UpdateHealthRecordInput{
		UserID:    "user-1",
		ID:        "health-1",
		LocalDate: "2026-07-15",
		WeightKg:  &updatedWeight,
		WaistCm:   &waist,
		Now:       now.Add(time.Hour),
	})
	if err != nil {
		t.Fatalf("update health record: %v", err)
	}
	if updatedHealth == nil || updatedHealth.LocalDate != "2026-07-15" || updatedHealth.WeightKg == nil || *updatedHealth.WeightKg != 81.8 {
		t.Fatalf("unexpected updated health record %#v", updatedHealth)
	}

	updatedRun, err := repository.UpdateRunRecord(ctx, slimming.UpdateRunRecordInput{
		UserID:           "user-1",
		ID:               "run-1",
		LocalDate:        "2026-07-15",
		DistanceKm:       6,
		DurationSeconds:  &durationSeconds,
		PaceSecondsPerKm: &paceSeconds,
		Now:              now.Add(time.Hour),
	})
	if err != nil {
		t.Fatalf("update run record: %v", err)
	}
	if updatedRun == nil || updatedRun.LocalDate != "2026-07-15" || updatedRun.DistanceKm != 6 {
		t.Fatalf("unexpected updated run record %#v", updatedRun)
	}

	deletedHealth, err := repository.DeleteHealthRecord(ctx, "user-1", "health-1")
	if err != nil {
		t.Fatalf("delete health record: %v", err)
	}
	deletedRun, err := repository.DeleteRunRecord(ctx, "user-1", "run-1")
	if err != nil {
		t.Fatalf("delete run record: %v", err)
	}
	if deletedHealth == nil || deletedRun == nil {
		t.Fatalf("expected deleted records health=%#v run=%#v", deletedHealth, deletedRun)
	}

	var userOneHealthCount int
	if err := db.QueryRowContext(ctx, "select count(*) from health_records where user_id = ?", "user-1").Scan(&userOneHealthCount); err != nil {
		t.Fatalf("count user health records: %v", err)
	}
	if userOneHealthCount != 0 {
		t.Fatalf("expected user-1 health records to be deleted, got %d", userOneHealthCount)
	}
	var otherUserRunCount int
	if err := db.QueryRowContext(ctx, "select count(*) from run_records where user_id = ?", "user-2").Scan(&otherUserRunCount); err != nil {
		t.Fatalf("count other user run records: %v", err)
	}
	if otherUserRunCount != 1 {
		t.Fatalf("expected other user run record to remain, got %d", otherUserRunCount)
	}

	missing, err := repository.DeleteHealthRecord(ctx, "user-1", "missing")
	if err != nil {
		t.Fatalf("delete missing health record: %v", err)
	}
	if missing != nil {
		t.Fatalf("expected missing delete to return nil, got %#v", missing)
	}

}

func TestSlimmingRepositorySavesGoalsByType(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	db := openTestDB(t)
	repository := SlimmingRepository{DB: db}
	now := time.Date(2026, 7, 15, 0, 0, 0, 0, time.UTC)
	targetWaist := 84.0
	targetHip := 96.0
	targetBodyFat := 18.0

	healthGoal, err := repository.SaveHealthGoal(ctx, slimming.SaveHealthGoalInput{
		UserID:                  "user-1",
		TargetWeightKg:          75,
		TargetWaistCm:           &targetWaist,
		TargetHipCm:             &targetHip,
		TargetBodyFatPercentage: &targetBodyFat,
		Now:                     now,
	})
	if err != nil {
		t.Fatalf("save health goal: %v", err)
	}
	if healthGoal == nil || healthGoal.TargetWeightKg == nil || *healthGoal.TargetWeightKg != 75 {
		t.Fatalf("unexpected health goal %#v", healthGoal)
	}
	if healthGoal.TargetHipCm == nil || *healthGoal.TargetHipCm != 96 {
		t.Fatalf("unexpected hip goal %#v", healthGoal.TargetHipCm)
	}

	updatedHealthGoal, err := repository.SaveHealthGoal(ctx, slimming.SaveHealthGoalInput{
		UserID:         "user-1",
		TargetWeightKg: 74,
		Now:            now.Add(time.Hour),
	})
	if err != nil {
		t.Fatalf("update health goal: %v", err)
	}
	if updatedHealthGoal.TargetWeightKg == nil || *updatedHealthGoal.TargetWeightKg != 74 || updatedHealthGoal.TargetWaistCm != nil {
		t.Fatalf("unexpected updated health goal %#v", updatedHealthGoal)
	}

	runGoal, err := repository.SaveRunGoal(ctx, slimming.SaveRunGoalInput{
		UserID:           "user-1",
		WeeklyRunCount:   4,
		WeeklyDistanceKm: 32.5,
		Now:              now,
	})
	if err != nil {
		t.Fatalf("save run goal: %v", err)
	}
	if runGoal == nil || runGoal.WeeklyRunCount == nil || *runGoal.WeeklyRunCount != 4 {
		t.Fatalf("unexpected run goal %#v", runGoal)
	}

	var count int
	if err := db.QueryRowContext(ctx, "select count(*) from goals where user_id = ?", "user-1").Scan(&count); err != nil {
		t.Fatalf("count goals: %v", err)
	}
	if count != 2 {
		t.Fatalf("expected one health and one run goal, got %d", count)
	}
}

func insertHealthRecord(t *testing.T, db *sql.DB, id string, userID string, localDate string, weightKg float64, waistCm float64, bodyFatPercentage float64, now time.Time) {
	t.Helper()

	_, err := db.Exec(`
		insert into health_records (
			id, user_id, local_date, weight_kg, waist_cm, hip_cm, body_fat_percentage, created_at_iso, updated_at_iso
		) values (?, ?, ?, ?, ?, null, ?, ?, ?)
	`, id, userID, localDate, weightKg, waistCm, bodyFatPercentage, now.UTC().Format(time.RFC3339), now.UTC().Format(time.RFC3339))
	if err != nil {
		t.Fatalf("insert health record: %v", err)
	}
}

func insertRunRecord(t *testing.T, db *sql.DB, id string, userID string, localDate string, distanceKm float64, now time.Time) {
	t.Helper()

	_, err := db.Exec(`
		insert into run_records (
			id, user_id, local_date, distance_km, duration_seconds, pace_seconds_per_km,
			average_heart_rate_bpm, average_stride_meters, cadence_spm, created_at_iso, updated_at_iso
		) values (?, ?, ?, ?, null, null, null, null, null, ?, ?)
	`, id, userID, localDate, distanceKm, now.UTC().Format(time.RFC3339), now.UTC().Format(time.RFC3339))
	if err != nil {
		t.Fatalf("insert run record: %v", err)
	}
}

func insertGoal(
	t *testing.T,
	db *sql.DB,
	id string,
	userID string,
	goalType string,
	targetWeightKg float64,
	targetWaistCm float64,
	targetBodyFatPercentage float64,
	weeklyRunCount *int,
	weeklyDistanceKm *float64,
	now time.Time,
) {
	t.Helper()

	var runCountValue any
	if weeklyRunCount != nil {
		runCountValue = *weeklyRunCount
	}
	var runDistanceValue any
	if weeklyDistanceKm != nil {
		runDistanceValue = *weeklyDistanceKm
	}
	var weightValue any
	var waistValue any
	var bodyFatValue any
	if goalType == "health" {
		weightValue = targetWeightKg
		waistValue = targetWaistCm
		bodyFatValue = targetBodyFatPercentage
	}

	_, err := db.Exec(`
		insert into goals (
			id, user_id, type, target_weight_kg, target_waist_cm, target_hip_cm,
			target_body_fat_percentage, weekly_run_count, weekly_distance_km, created_at_iso, updated_at_iso
		) values (?, ?, ?, ?, ?, null, ?, ?, ?, ?, ?)
	`, id, userID, goalType, weightValue, waistValue, bodyFatValue, runCountValue, runDistanceValue, now.UTC().Format(time.RFC3339), now.UTC().Format(time.RFC3339))
	if err != nil {
		t.Fatalf("insert goal: %v", err)
	}
}
