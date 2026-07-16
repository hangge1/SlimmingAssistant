package sqlite

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"

	"resetlife/server/internal/slimming"
)

type SlimmingRepository struct {
	DB *sql.DB
}

func (r SlimmingRepository) GetSummary(ctx context.Context, userID string, localDate string) (*slimming.Summary, error) {
	summary := &slimming.Summary{
		TodayRun: slimming.RunAggregate{LocalDate: localDate},
		TotalRun: slimming.RunAggregate{},
	}

	healthSnapshot, err := r.getLatestHealthSnapshot(ctx, userID)
	if err != nil {
		return nil, err
	}
	summary.HealthSnapshot = healthSnapshot

	healthGoal, runGoal, err := r.getGoals(ctx, userID)
	if err != nil {
		return nil, err
	}
	summary.HealthGoal = healthGoal
	summary.RunGoal = runGoal

	todayRun, err := r.getRunAggregate(ctx, userID, &localDate)
	if err != nil {
		return nil, err
	}
	summary.TodayRun = *todayRun

	totalRun, err := r.getRunAggregate(ctx, userID, nil)
	if err != nil {
		return nil, err
	}
	summary.TotalRun = *totalRun

	return summary, nil
}

func (r SlimmingRepository) UpsertHealthRecord(ctx context.Context, input slimming.UpsertHealthRecordInput) (*slimming.HealthRecord, error) {
	nowIso := input.Now.UTC().Format(time.RFC3339)
	existing := r.DB.QueryRowContext(ctx, `
		select id
		from health_records
		where user_id = ? and local_date = ?
	`, input.UserID, input.LocalDate)

	var existingID string
	switch err := existing.Scan(&existingID); {
	case err == nil:
		_, err := r.DB.ExecContext(ctx, `
			update health_records
			set weight_kg = ?, waist_cm = ?, hip_cm = ?, body_fat_percentage = ?, updated_at_iso = ?
			where id = ?
		`, nullableArg(input.WeightKg), nullableArg(input.WaistCm), nullableArg(input.HipCm), nullableArg(input.BodyFatPercentage), nowIso, existingID)
		if err != nil {
			return nil, fmt.Errorf("update health record: %w", err)
		}
	case err == sql.ErrNoRows:
		existingID = uuid.NewString()
		_, err := r.DB.ExecContext(ctx, `
			insert into health_records (
				id, user_id, local_date, weight_kg, waist_cm, hip_cm, body_fat_percentage, created_at_iso, updated_at_iso
			) values (?, ?, ?, ?, ?, ?, ?, ?, ?)
		`, existingID, input.UserID, input.LocalDate, nullableArg(input.WeightKg), nullableArg(input.WaistCm), nullableArg(input.HipCm), nullableArg(input.BodyFatPercentage), nowIso, nowIso)
		if err != nil {
			return nil, fmt.Errorf("insert health record: %w", err)
		}
	default:
		return nil, fmt.Errorf("find health record: %w", err)
	}

	return r.getHealthRecordByID(ctx, input.UserID, existingID)
}

func (r SlimmingRepository) CreateRunRecord(ctx context.Context, input slimming.CreateRunRecordInput) (*slimming.RunRecord, error) {
	id := uuid.NewString()
	nowIso := input.Now.UTC().Format(time.RFC3339)
	_, err := r.DB.ExecContext(ctx, `
		insert into run_records (
			id, user_id, local_date, distance_km, duration_seconds, pace_seconds_per_km,
			average_heart_rate_bpm, average_stride_meters, cadence_spm, created_at_iso, updated_at_iso
		) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, id, input.UserID, input.LocalDate, input.DistanceKm, nullableArg(input.DurationSeconds), nullableArg(input.PaceSecondsPerKm), nullableArg(input.AverageHeartRateBpm), nullableArg(input.AverageStrideMeters), nullableArg(input.CadenceSpm), nowIso, nowIso)
	if err != nil {
		return nil, fmt.Errorf("insert run record: %w", err)
	}

	return r.getRunRecordByID(ctx, input.UserID, id)
}

func (r SlimmingRepository) UpdateHealthRecord(ctx context.Context, input slimming.UpdateHealthRecordInput) (*slimming.HealthRecord, error) {
	nowIso := input.Now.UTC().Format(time.RFC3339)
	result, err := r.DB.ExecContext(ctx, `
		update health_records
		set local_date = ?, weight_kg = ?, waist_cm = ?, hip_cm = ?, body_fat_percentage = ?, updated_at_iso = ?
		where user_id = ? and id = ?
	`, input.LocalDate, nullableArg(input.WeightKg), nullableArg(input.WaistCm), nullableArg(input.HipCm), nullableArg(input.BodyFatPercentage), nowIso, input.UserID, input.ID)
	if err != nil {
		return nil, fmt.Errorf("update health record: %w", err)
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return nil, fmt.Errorf("count updated health record rows: %w", err)
	}
	if affected == 0 {
		return nil, nil
	}

	return r.getHealthRecordByID(ctx, input.UserID, input.ID)
}

func (r SlimmingRepository) UpdateRunRecord(ctx context.Context, input slimming.UpdateRunRecordInput) (*slimming.RunRecord, error) {
	nowIso := input.Now.UTC().Format(time.RFC3339)
	result, err := r.DB.ExecContext(ctx, `
		update run_records
		set local_date = ?, distance_km = ?, duration_seconds = ?, pace_seconds_per_km = ?,
			average_heart_rate_bpm = ?, average_stride_meters = ?, cadence_spm = ?, updated_at_iso = ?
		where user_id = ? and id = ?
	`, input.LocalDate, input.DistanceKm, nullableArg(input.DurationSeconds), nullableArg(input.PaceSecondsPerKm), nullableArg(input.AverageHeartRateBpm), nullableArg(input.AverageStrideMeters), nullableArg(input.CadenceSpm), nowIso, input.UserID, input.ID)
	if err != nil {
		return nil, fmt.Errorf("update run record: %w", err)
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return nil, fmt.Errorf("count updated run record rows: %w", err)
	}
	if affected == 0 {
		return nil, nil
	}

	return r.getRunRecordByID(ctx, input.UserID, input.ID)
}

func (r SlimmingRepository) DeleteHealthRecord(ctx context.Context, userID string, id string) (*slimming.HealthRecord, error) {
	existing, err := r.getHealthRecordByID(ctx, userID, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	_, err = r.DB.ExecContext(ctx, `
		delete from health_records
		where user_id = ? and id = ?
	`, userID, id)
	if err != nil {
		return nil, fmt.Errorf("delete health record: %w", err)
	}

	return existing, nil
}

func (r SlimmingRepository) DeleteRunRecord(ctx context.Context, userID string, id string) (*slimming.RunRecord, error) {
	existing, err := r.getRunRecordByID(ctx, userID, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	_, err = r.DB.ExecContext(ctx, `
		delete from run_records
		where user_id = ? and id = ?
	`, userID, id)
	if err != nil {
		return nil, fmt.Errorf("delete run record: %w", err)
	}

	return existing, nil
}

func (r SlimmingRepository) ListHealthRecords(ctx context.Context, userID string) ([]slimming.HealthRecord, error) {
	rows, err := r.DB.QueryContext(ctx, `
		select id, local_date, weight_kg, waist_cm, hip_cm, body_fat_percentage, created_at_iso, updated_at_iso
		from health_records
		where user_id = ?
		order by local_date desc, created_at_iso desc
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("list health records: %w", err)
	}
	defer rows.Close()

	var records []slimming.HealthRecord
	for rows.Next() {
		record, err := scanHealthRecord(rows)
		if err != nil {
			return nil, fmt.Errorf("scan health record: %w", err)
		}
		records = append(records, *record)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate health records: %w", err)
	}

	return records, nil
}

func (r SlimmingRepository) ListRunRecords(ctx context.Context, userID string) ([]slimming.RunRecord, error) {
	rows, err := r.DB.QueryContext(ctx, `
		select id, local_date, distance_km, duration_seconds, pace_seconds_per_km,
			average_heart_rate_bpm, average_stride_meters, cadence_spm, created_at_iso, updated_at_iso
		from run_records
		where user_id = ?
		order by local_date desc, created_at_iso desc
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("list run records: %w", err)
	}
	defer rows.Close()

	var records []slimming.RunRecord
	for rows.Next() {
		record, err := scanRunRecord(rows)
		if err != nil {
			return nil, fmt.Errorf("scan run record: %w", err)
		}
		records = append(records, *record)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate run records: %w", err)
	}

	return records, nil
}

func (r SlimmingRepository) SaveHealthGoal(ctx context.Context, input slimming.SaveHealthGoalInput) (*slimming.HealthGoal, error) {
	nowIso := input.Now.UTC().Format(time.RFC3339)
	id, err := r.upsertGoal(ctx, input.UserID, "health", map[string]any{
		"target_weight_kg":           input.TargetWeightKg,
		"target_waist_cm":            nullableArg(input.TargetWaistCm),
		"target_hip_cm":              nullableArg(input.TargetHipCm),
		"target_body_fat_percentage": nullableArg(input.TargetBodyFatPercentage),
		"weekly_run_count":           nil,
		"weekly_distance_km":         nil,
	}, nowIso)
	if err != nil {
		return nil, err
	}

	return r.getHealthGoalByID(ctx, input.UserID, id)
}

func (r SlimmingRepository) SaveRunGoal(ctx context.Context, input slimming.SaveRunGoalInput) (*slimming.RunGoal, error) {
	nowIso := input.Now.UTC().Format(time.RFC3339)
	id, err := r.upsertGoal(ctx, input.UserID, "run", map[string]any{
		"target_weight_kg":           nil,
		"target_waist_cm":            nil,
		"target_hip_cm":              nil,
		"target_body_fat_percentage": nil,
		"weekly_run_count":           input.WeeklyRunCount,
		"weekly_distance_km":         input.WeeklyDistanceKm,
	}, nowIso)
	if err != nil {
		return nil, err
	}

	return r.getRunGoalByID(ctx, input.UserID, id)
}

func (r SlimmingRepository) upsertGoal(ctx context.Context, userID string, goalType string, values map[string]any, nowIso string) (string, error) {
	row := r.DB.QueryRowContext(ctx, `
		select id
		from goals
		where user_id = ? and type = ?
	`, userID, goalType)

	var id string
	switch err := row.Scan(&id); {
	case err == nil:
		_, err := r.DB.ExecContext(ctx, `
			update goals
			set target_weight_kg = ?, target_waist_cm = ?, target_hip_cm = ?, target_body_fat_percentage = ?,
				weekly_run_count = ?, weekly_distance_km = ?, updated_at_iso = ?
			where id = ?
		`, values["target_weight_kg"], values["target_waist_cm"], values["target_hip_cm"], values["target_body_fat_percentage"], values["weekly_run_count"], values["weekly_distance_km"], nowIso, id)
		if err != nil {
			return "", fmt.Errorf("update goal: %w", err)
		}
	case err == sql.ErrNoRows:
		id = uuid.NewString()
		_, err := r.DB.ExecContext(ctx, `
			insert into goals (
				id, user_id, type, target_weight_kg, target_waist_cm, target_hip_cm,
				target_body_fat_percentage, weekly_run_count, weekly_distance_km, created_at_iso, updated_at_iso
			) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`, id, userID, goalType, values["target_weight_kg"], values["target_waist_cm"], values["target_hip_cm"], values["target_body_fat_percentage"], values["weekly_run_count"], values["weekly_distance_km"], nowIso, nowIso)
		if err != nil {
			return "", fmt.Errorf("insert goal: %w", err)
		}
	default:
		return "", fmt.Errorf("find goal: %w", err)
	}

	return id, nil
}

func (r SlimmingRepository) getHealthGoalByID(ctx context.Context, userID string, id string) (*slimming.HealthGoal, error) {
	row := r.DB.QueryRowContext(ctx, `
		select target_weight_kg, target_waist_cm, target_hip_cm, target_body_fat_percentage
		from goals
		where user_id = ? and id = ? and type = 'health'
	`, userID, id)

	var targetWeightKg sql.NullFloat64
	var targetWaistCm sql.NullFloat64
	var targetHipCm sql.NullFloat64
	var targetBodyFatPercentage sql.NullFloat64
	if err := row.Scan(&targetWeightKg, &targetWaistCm, &targetHipCm, &targetBodyFatPercentage); err != nil {
		return nil, fmt.Errorf("get health goal: %w", err)
	}

	return &slimming.HealthGoal{
		TargetWeightKg:          nullableFloat(targetWeightKg),
		TargetWaistCm:           nullableFloat(targetWaistCm),
		TargetHipCm:             nullableFloat(targetHipCm),
		TargetBodyFatPercentage: nullableFloat(targetBodyFatPercentage),
	}, nil
}

func (r SlimmingRepository) getRunGoalByID(ctx context.Context, userID string, id string) (*slimming.RunGoal, error) {
	row := r.DB.QueryRowContext(ctx, `
		select weekly_run_count, weekly_distance_km
		from goals
		where user_id = ? and id = ? and type = 'run'
	`, userID, id)

	var weeklyRunCount sql.NullInt64
	var weeklyDistanceKm sql.NullFloat64
	if err := row.Scan(&weeklyRunCount, &weeklyDistanceKm); err != nil {
		return nil, fmt.Errorf("get run goal: %w", err)
	}

	return &slimming.RunGoal{
		WeeklyRunCount:   nullableInt(weeklyRunCount),
		WeeklyDistanceKm: nullableFloat(weeklyDistanceKm),
	}, nil
}

func (r SlimmingRepository) getHealthRecordByID(ctx context.Context, userID string, id string) (*slimming.HealthRecord, error) {
	row := r.DB.QueryRowContext(ctx, `
		select id, local_date, weight_kg, waist_cm, hip_cm, body_fat_percentage, created_at_iso, updated_at_iso
		from health_records
		where user_id = ? and id = ?
	`, userID, id)

	record, err := scanHealthRecord(row)
	if err != nil {
		return nil, fmt.Errorf("get health record: %w", err)
	}

	return record, nil
}

func (r SlimmingRepository) getRunRecordByID(ctx context.Context, userID string, id string) (*slimming.RunRecord, error) {
	row := r.DB.QueryRowContext(ctx, `
		select id, local_date, distance_km, duration_seconds, pace_seconds_per_km,
			average_heart_rate_bpm, average_stride_meters, cadence_spm, created_at_iso, updated_at_iso
		from run_records
		where user_id = ? and id = ?
	`, userID, id)

	record, err := scanRunRecord(row)
	if err != nil {
		return nil, fmt.Errorf("get run record: %w", err)
	}

	return record, nil
}

type scanner interface {
	Scan(dest ...any) error
}

func scanHealthRecord(row scanner) (*slimming.HealthRecord, error) {
	var record slimming.HealthRecord
	var weightKg sql.NullFloat64
	var waistCm sql.NullFloat64
	var hipCm sql.NullFloat64
	var bodyFatPercentage sql.NullFloat64
	if err := row.Scan(&record.ID, &record.LocalDate, &weightKg, &waistCm, &hipCm, &bodyFatPercentage, &record.CreatedAtIso, &record.UpdatedAtIso); err != nil {
		return nil, err
	}

	record.WeightKg = nullableFloat(weightKg)
	record.WaistCm = nullableFloat(waistCm)
	record.HipCm = nullableFloat(hipCm)
	record.BodyFatPercentage = nullableFloat(bodyFatPercentage)
	return &record, nil
}

func scanRunRecord(row scanner) (*slimming.RunRecord, error) {
	var record slimming.RunRecord
	var durationSeconds sql.NullInt64
	var paceSecondsPerKm sql.NullInt64
	var averageHeartRateBpm sql.NullInt64
	var averageStrideMeters sql.NullFloat64
	var cadenceSpm sql.NullInt64
	if err := row.Scan(
		&record.ID,
		&record.LocalDate,
		&record.DistanceKm,
		&durationSeconds,
		&paceSecondsPerKm,
		&averageHeartRateBpm,
		&averageStrideMeters,
		&cadenceSpm,
		&record.CreatedAtIso,
		&record.UpdatedAtIso,
	); err != nil {
		return nil, err
	}

	record.DurationSeconds = nullableInt(durationSeconds)
	record.PaceSecondsPerKm = nullableInt(paceSecondsPerKm)
	record.AverageHeartRateBpm = nullableInt(averageHeartRateBpm)
	record.AverageStrideMeters = nullableFloat(averageStrideMeters)
	record.CadenceSpm = nullableInt(cadenceSpm)
	return &record, nil
}

func (r SlimmingRepository) getLatestHealthSnapshot(ctx context.Context, userID string) (*slimming.HealthSnapshot, error) {
	row := r.DB.QueryRowContext(ctx, `
		select local_date, weight_kg, waist_cm, body_fat_percentage
		from health_records
		where user_id = ?
		order by local_date desc, created_at_iso desc
		limit 1
	`, userID)

	var localDate string
	var weightKg sql.NullFloat64
	var waistCm sql.NullFloat64
	var bodyFatPercentage sql.NullFloat64
	if err := row.Scan(&localDate, &weightKg, &waistCm, &bodyFatPercentage); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}

		return nil, fmt.Errorf("get latest health snapshot: %w", err)
	}

	return &slimming.HealthSnapshot{
		LocalDate:         localDate,
		WeightKg:          nullableFloat(weightKg),
		WaistCm:           nullableFloat(waistCm),
		BodyFatPercentage: nullableFloat(bodyFatPercentage),
	}, nil
}

func (r SlimmingRepository) getGoals(ctx context.Context, userID string) (*slimming.HealthGoal, *slimming.RunGoal, error) {
	rows, err := r.DB.QueryContext(ctx, `
		select type, target_weight_kg, target_waist_cm, target_hip_cm, target_body_fat_percentage, weekly_run_count, weekly_distance_km
		from goals
		where user_id = ?
	`, userID)
	if err != nil {
		return nil, nil, fmt.Errorf("get goals: %w", err)
	}
	defer rows.Close()

	var healthGoal *slimming.HealthGoal
	var runGoal *slimming.RunGoal
	for rows.Next() {
		var goalType string
		var targetWeightKg sql.NullFloat64
		var targetWaistCm sql.NullFloat64
		var targetHipCm sql.NullFloat64
		var targetBodyFatPercentage sql.NullFloat64
		var weeklyRunCount sql.NullInt64
		var weeklyDistanceKm sql.NullFloat64
		if err := rows.Scan(
			&goalType,
			&targetWeightKg,
			&targetWaistCm,
			&targetHipCm,
			&targetBodyFatPercentage,
			&weeklyRunCount,
			&weeklyDistanceKm,
		); err != nil {
			return nil, nil, fmt.Errorf("scan goal: %w", err)
		}

		switch goalType {
		case "health":
			healthGoal = &slimming.HealthGoal{
				TargetWeightKg:          nullableFloat(targetWeightKg),
				TargetWaistCm:           nullableFloat(targetWaistCm),
				TargetHipCm:             nullableFloat(targetHipCm),
				TargetBodyFatPercentage: nullableFloat(targetBodyFatPercentage),
			}
		case "run":
			runGoal = &slimming.RunGoal{
				WeeklyRunCount:   nullableInt(weeklyRunCount),
				WeeklyDistanceKm: nullableFloat(weeklyDistanceKm),
			}
		}
	}
	if err := rows.Err(); err != nil {
		return nil, nil, fmt.Errorf("iterate goals: %w", err)
	}

	return healthGoal, runGoal, nil
}

func (r SlimmingRepository) getRunAggregate(ctx context.Context, userID string, localDate *string) (*slimming.RunAggregate, error) {
	query := `
		select count(*), coalesce(sum(distance_km), 0)
		from run_records
		where user_id = ?
	`
	args := []any{userID}
	aggregate := &slimming.RunAggregate{}
	if localDate != nil {
		query += " and local_date = ?"
		args = append(args, *localDate)
		aggregate.LocalDate = *localDate
	}

	row := r.DB.QueryRowContext(ctx, query, args...)
	if err := row.Scan(&aggregate.Count, &aggregate.DistanceKm); err != nil {
		return nil, fmt.Errorf("get run aggregate: %w", err)
	}

	return aggregate, nil
}

func nullableFloat(value sql.NullFloat64) *float64 {
	if !value.Valid {
		return nil
	}

	return &value.Float64
}

func nullableInt(value sql.NullInt64) *int {
	if !value.Valid {
		return nil
	}

	converted := int(value.Int64)
	return &converted
}

func nullableArg[T any](value *T) any {
	if value == nil {
		return nil
	}

	return *value
}
