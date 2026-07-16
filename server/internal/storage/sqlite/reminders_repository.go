package sqlite

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"

	"resetlife/server/internal/auth"
	"resetlife/server/internal/reminders"
)

type RemindersRepository struct {
	DB *sql.DB
}

func (r RemindersRepository) ListActiveUsers(ctx context.Context) ([]auth.User, error) {
	rows, err := r.DB.QueryContext(ctx, `
		select id, username, display_name, role, password_hash
		from users
		where disabled_at_iso is null
		order by created_at_iso asc
	`)
	if err != nil {
		return nil, fmt.Errorf("list active users: %w", err)
	}
	defer rows.Close()

	var users []auth.User
	for rows.Next() {
		var user auth.User
		var displayName sql.NullString
		if err := rows.Scan(&user.ID, &user.Username, &displayName, &user.Role, &user.PasswordHash); err != nil {
			return nil, fmt.Errorf("scan user: %w", err)
		}
		if displayName.Valid {
			user.DisplayName = &displayName.String
		}
		users = append(users, user)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate users: %w", err)
	}

	return users, nil
}

func (r RemindersRepository) HasHealthRecord(ctx context.Context, userID string, localDate string) (bool, error) {
	var count int
	if err := r.DB.QueryRowContext(ctx, `
		select count(*)
		from health_records
		where user_id = ? and local_date = ?
	`, userID, localDate).Scan(&count); err != nil {
		return false, fmt.Errorf("count health records: %w", err)
	}
	return count > 0, nil
}

func (r RemindersRepository) CountRunRecords(ctx context.Context, userID string, localDate string) (int, error) {
	var count int
	if err := r.DB.QueryRowContext(ctx, `
		select count(*)
		from run_records
		where user_id = ? and local_date = ?
	`, userID, localDate).Scan(&count); err != nil {
		return 0, fmt.Errorf("count run records: %w", err)
	}
	return count, nil
}

func (r RemindersRepository) GetEvent(ctx context.Context, userID string, localDate string, reminderType string, channel reminders.Channel) (*reminders.Event, error) {
	row := r.DB.QueryRowContext(ctx, `
		select id, user_id, local_date, reminder_type, channel, status, message, created_at_iso, updated_at_iso
		from reminder_events
		where user_id = ? and local_date = ? and reminder_type = ? and channel = ?
	`, userID, localDate, reminderType, string(channel))

	event, err := scanReminderEvent(row)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("get reminder event: %w", err)
	}
	return event, nil
}

func (r RemindersRepository) GetLatestEmailEvent(ctx context.Context, userID string) (*reminders.Event, error) {
	row := r.DB.QueryRowContext(ctx, `
		select id, user_id, local_date, reminder_type, channel, status, message, created_at_iso, updated_at_iso
		from reminder_events
		where user_id = ? and channel = 'email'
		order by updated_at_iso desc
		limit 1
	`, userID)

	event, err := scanReminderEvent(row)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("get latest email reminder event: %w", err)
	}
	return event, nil
}

func (r RemindersRepository) CreateEvent(ctx context.Context, input reminders.CreateEventInput) (*reminders.Event, error) {
	existing, err := r.GetEvent(ctx, input.UserID, input.LocalDate, input.ReminderType, input.Channel)
	if err != nil || existing != nil {
		return existing, err
	}

	id := uuid.NewString()
	nowIso := input.Now.UTC().Format(time.RFC3339)
	_, err = r.DB.ExecContext(ctx, `
		insert into reminder_events (
			id, user_id, local_date, reminder_type, channel, status, message, created_at_iso, updated_at_iso
		) values (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, id, input.UserID, input.LocalDate, input.ReminderType, string(input.Channel), string(input.Status), input.Message, nowIso, nowIso)
	if err != nil {
		return nil, fmt.Errorf("insert reminder event: %w", err)
	}

	return r.GetEvent(ctx, input.UserID, input.LocalDate, input.ReminderType, input.Channel)
}

func (r RemindersRepository) UpdateEvent(ctx context.Context, input reminders.UpdateEventInput) (*reminders.Event, error) {
	nowIso := input.Now.UTC().Format(time.RFC3339)
	_, err := r.DB.ExecContext(ctx, `
		update reminder_events
		set status = ?, message = ?, updated_at_iso = ?
		where user_id = ? and id = ?
	`, string(input.Status), input.Message, nowIso, input.UserID, input.ID)
	if err != nil {
		return nil, fmt.Errorf("update reminder event: %w", err)
	}

	row := r.DB.QueryRowContext(ctx, `
		select id, user_id, local_date, reminder_type, channel, status, message, created_at_iso, updated_at_iso
		from reminder_events
		where user_id = ? and id = ?
	`, input.UserID, input.ID)
	event, err := scanReminderEvent(row)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("get updated reminder event: %w", err)
	}
	return event, nil
}

func scanReminderEvent(row scanner) (*reminders.Event, error) {
	var event reminders.Event
	var channel string
	var status string
	if err := row.Scan(
		&event.ID,
		&event.UserID,
		&event.LocalDate,
		&event.ReminderType,
		&channel,
		&status,
		&event.Message,
		&event.CreatedAtIso,
		&event.UpdatedAtIso,
	); err != nil {
		return nil, err
	}
	event.Channel = reminders.Channel(channel)
	event.Status = reminders.Status(status)
	return &event, nil
}
