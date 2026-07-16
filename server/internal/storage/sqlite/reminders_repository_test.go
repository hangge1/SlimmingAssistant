package sqlite

import (
	"context"
	"testing"
	"time"

	"resetlife/server/internal/reminders"
)

func TestRemindersRepositoryCreatesUpdatesAndReadsEvents(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	db := openTestDB(t)
	repository := RemindersRepository{DB: db}
	now := time.Date(2026, 7, 15, 0, 0, 0, 0, time.UTC)

	created, err := repository.CreateEvent(ctx, reminders.CreateEventInput{
		UserID:       "user-1",
		LocalDate:    "2026-07-15",
		ReminderType: "daily_record_email_2030",
		Channel:      reminders.ChannelEmail,
		Status:       reminders.StatusCreated,
		Message:      "queued",
		Now:          now,
	})
	if err != nil {
		t.Fatalf("create event: %v", err)
	}
	if created == nil || created.ID == "" || created.Status != reminders.StatusCreated {
		t.Fatalf("unexpected created event %#v", created)
	}

	again, err := repository.CreateEvent(ctx, reminders.CreateEventInput{
		UserID:       "user-1",
		LocalDate:    "2026-07-15",
		ReminderType: "daily_record_email_2030",
		Channel:      reminders.ChannelEmail,
		Status:       reminders.StatusSkipped,
		Message:      "duplicate",
		Now:          now.Add(time.Minute),
	})
	if err != nil {
		t.Fatalf("create duplicate event: %v", err)
	}
	if again.ID != created.ID || again.Message != "queued" {
		t.Fatalf("expected idempotent event, got %#v", again)
	}

	updated, err := repository.UpdateEvent(ctx, reminders.UpdateEventInput{
		UserID:  "user-1",
		ID:      created.ID,
		Status:  reminders.StatusSent,
		Message: "sent",
		Now:     now.Add(time.Hour),
	})
	if err != nil {
		t.Fatalf("update event: %v", err)
	}
	if updated == nil || updated.Status != reminders.StatusSent || updated.Message != "sent" {
		t.Fatalf("unexpected updated event %#v", updated)
	}

	latest, err := repository.GetLatestEmailEvent(ctx, "user-1")
	if err != nil {
		t.Fatalf("get latest email: %v", err)
	}
	if latest == nil || latest.ID != created.ID {
		t.Fatalf("unexpected latest event %#v", latest)
	}
}

func TestRemindersRepositoryChecksDailyRecords(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	db := openTestDB(t)
	repository := RemindersRepository{DB: db}
	now := time.Date(2026, 7, 15, 0, 0, 0, 0, time.UTC)

	insertHealthRecord(t, db, "health-1", "user-1", "2026-07-15", 81, 90, 24, now)
	insertRunRecord(t, db, "run-1", "user-1", "2026-07-15", 5, now)

	hasHealth, err := repository.HasHealthRecord(ctx, "user-1", "2026-07-15")
	if err != nil {
		t.Fatalf("has health record: %v", err)
	}
	runCount, err := repository.CountRunRecords(ctx, "user-1", "2026-07-15")
	if err != nil {
		t.Fatalf("count run records: %v", err)
	}
	if !hasHealth || runCount != 1 {
		t.Fatalf("unexpected record checks hasHealth=%v runCount=%d", hasHealth, runCount)
	}
}
