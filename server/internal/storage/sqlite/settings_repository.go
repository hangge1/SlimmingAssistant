package sqlite

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"

	"resetlife/server/internal/settings"
)

type SettingsRepository struct {
	DB *sql.DB
}

func (r SettingsRepository) GetSetting(ctx context.Context, userID string, settingType string, key string) (*settings.Setting, error) {
	row := r.DB.QueryRowContext(ctx, `
		select id, user_id, type, key, value_json
		from settings
		where user_id = ? and type = ? and key = ?
	`, userID, settingType, key)

	var setting settings.Setting
	if err := row.Scan(&setting.ID, &setting.UserID, &setting.Type, &setting.Key, &setting.ValueJSON); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("get setting: %w", err)
	}

	return &setting, nil
}

func (r SettingsRepository) SaveSetting(ctx context.Context, input settings.SaveSettingInput) (*settings.Setting, error) {
	nowIso := input.Now.UTC().Format(time.RFC3339)
	existing := r.DB.QueryRowContext(ctx, `
		select id
		from settings
		where user_id = ? and type = ? and key = ?
	`, input.UserID, input.Type, input.Key)

	var id string
	switch err := existing.Scan(&id); {
	case err == nil:
		_, err := r.DB.ExecContext(ctx, `
			update settings
			set value_json = ?, updated_at_iso = ?
			where id = ?
		`, input.ValueJSON, nowIso, id)
		if err != nil {
			return nil, fmt.Errorf("update setting: %w", err)
		}
	case err == sql.ErrNoRows:
		id = uuid.NewString()
		_, err := r.DB.ExecContext(ctx, `
			insert into settings (
				id, user_id, type, key, value_json, created_at_iso, updated_at_iso
			) values (?, ?, ?, ?, ?, ?, ?)
		`, id, input.UserID, input.Type, input.Key, input.ValueJSON, nowIso, nowIso)
		if err != nil {
			return nil, fmt.Errorf("insert setting: %w", err)
		}
	default:
		return nil, fmt.Errorf("find setting: %w", err)
	}

	return r.GetSetting(ctx, input.UserID, input.Type, input.Key)
}
