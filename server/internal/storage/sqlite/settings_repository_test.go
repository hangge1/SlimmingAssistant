package sqlite

import (
	"context"
	"testing"
	"time"

	"resetlife/server/internal/settings"
)

func TestSettingsRepositorySavesAndLoadsUserScopedSettings(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	db := openTestDB(t)
	repository := SettingsRepository{DB: db}
	now := time.Date(2026, 7, 15, 0, 0, 0, 0, time.UTC)

	saved, err := repository.SaveSetting(ctx, settings.SaveSettingInput{
		UserID:    "user-1",
		Type:      "profile",
		Key:       "basic",
		ValueJSON: `{"nickname":"Admin"}`,
		Now:       now,
	})
	if err != nil {
		t.Fatalf("save setting: %v", err)
	}
	if saved == nil || saved.ID == "" || saved.ValueJSON == "" {
		t.Fatalf("unexpected saved setting %#v", saved)
	}

	updated, err := repository.SaveSetting(ctx, settings.SaveSettingInput{
		UserID:    "user-1",
		Type:      "profile",
		Key:       "basic",
		ValueJSON: `{"nickname":"Updated"}`,
		Now:       now.Add(time.Hour),
	})
	if err != nil {
		t.Fatalf("update setting: %v", err)
	}
	if updated.ID != saved.ID || updated.ValueJSON != `{"nickname":"Updated"}` {
		t.Fatalf("unexpected updated setting %#v", updated)
	}

	otherUser, err := repository.GetSetting(ctx, "user-2", "profile", "basic")
	if err != nil {
		t.Fatalf("get other user setting: %v", err)
	}
	if otherUser != nil {
		t.Fatalf("expected other user setting to be nil, got %#v", otherUser)
	}
}
