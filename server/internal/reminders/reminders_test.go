package reminders

import (
	"context"
	"testing"
	"time"

	"resetlife/server/internal/auth"
	"resetlife/server/internal/settings"
)

func TestServiceCreatesInAppReminderWhenRecordsMissing(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 7, 15, 13, 0, 0, 0, time.UTC)
	repository := &fakeRepository{}
	settingsRepository := &fakeSettingsRepository{}
	service := Service{
		Repository: repository,
		SettingsService: &settings.Service{
			Repository: settingsRepository,
		},
	}
	saveReminderRules(t, service.SettingsService, "user-1", true, false)

	result, err := service.RunForUser(context.Background(), "user-1", "2026-07-15", "21:00", now)
	if err != nil {
		t.Fatalf("run reminder: %v", err)
	}
	if result.Status != "created" || len(result.Events) != 1 || result.Events[0].Channel != ChannelInApp {
		t.Fatalf("unexpected result %#v", result)
	}

	again, err := service.RunForUser(context.Background(), "user-1", "2026-07-15", "21:00", now.Add(time.Minute))
	if err != nil {
		t.Fatalf("run reminder again: %v", err)
	}
	if len(again.Events) != 1 || len(repository.events) != 1 {
		t.Fatalf("expected idempotent event creation, again=%#v events=%#v", again, repository.events)
	}
}

func TestServiceSkipsReminderWhenDisabledOrTooEarly(t *testing.T) {
	t.Parallel()

	repository := &fakeRepository{}
	settingsRepository := &fakeSettingsRepository{}
	service := Service{Repository: repository, SettingsService: &settings.Service{Repository: settingsRepository}}
	saveReminderRules(t, service.SettingsService, "user-1", true, false)

	result, err := service.RunForUser(context.Background(), "user-1", "2026-07-15", "19:00", time.Now())
	if err != nil {
		t.Fatalf("run reminder: %v", err)
	}
	if result.Status != "skipped" || len(repository.events) != 0 {
		t.Fatalf("unexpected early result=%#v events=%#v", result, repository.events)
	}
}

func TestServiceSendsEmailReminderAndUpdatesStatus(t *testing.T) {
	t.Parallel()

	repository := &fakeRepository{}
	settingsRepository := &fakeSettingsRepository{}
	mailSender := &fakeMailSender{}
	settingsService := &settings.Service{Repository: settingsRepository}
	service := Service{Repository: repository, SettingsService: settingsService, MailSender: mailSender}
	saveReminderRules(t, settingsService, "user-1", false, true)
	saveProfile(t, settingsService, "user-1")
	saveSmtp(t, settingsService)

	result, err := service.RunForUser(context.Background(), "user-1", "2026-07-15", "21:00", time.Date(2026, 7, 15, 13, 0, 0, 0, time.UTC))
	if err != nil {
		t.Fatalf("run reminder: %v", err)
	}
	if len(result.Events) != 1 || result.Events[0].Status != StatusSent {
		t.Fatalf("unexpected result %#v", result)
	}
	if mailSender.recipientEmail != "to@example.com" || mailSender.subject == "" || mailSender.text == "" {
		t.Fatalf("unexpected mail sender %#v", mailSender)
	}
}

func TestServiceRunsForActiveUsers(t *testing.T) {
	t.Parallel()

	repository := &fakeRepository{users: []auth.User{{ID: "user-1"}, {ID: "user-2"}}}
	settingsRepository := &fakeSettingsRepository{}
	service := Service{Repository: repository, SettingsService: &settings.Service{Repository: settingsRepository}}
	saveReminderRules(t, service.SettingsService, "user-1", true, false)
	saveReminderRules(t, service.SettingsService, "user-2", true, false)

	result, err := service.RunForActiveUsers(context.Background())
	if err != nil {
		t.Fatalf("run active users: %v", err)
	}
	if result.Checked != 2 || result.Failed != 0 {
		t.Fatalf("unexpected result %#v", result)
	}
}

func saveReminderRules(t *testing.T, service *settings.Service, userID string, inApp bool, email bool) {
	t.Helper()
	_, failure, err := service.SaveReminderRules(context.Background(), userID, settings.ReminderRuleInput{
		ReminderTime: "20:30",
		InAppEnabled: inApp,
		EmailEnabled: email,
	})
	if err != nil || failure != nil {
		t.Fatalf("save rules err=%v failure=%#v", err, failure)
	}
}

func saveProfile(t *testing.T, service *settings.Service, userID string) {
	t.Helper()
	_, failure, err := service.SaveProfile(context.Background(), userID, settings.ProfileInput{ReminderEmail: "to@example.com"})
	if err != nil || failure != nil {
		t.Fatalf("save profile err=%v failure=%#v", err, failure)
	}
}

func saveSmtp(t *testing.T, service *settings.Service) {
	t.Helper()
	_, failure, err := service.SaveSmtpConfig(context.Background(), auth.DefaultAdminUserID, settings.SmtpConfigInput{
		Host:       "smtp.example.com",
		Port:       "465",
		Password:   "secret",
		FromEmail:  "from@example.com",
		SecureMode: "ssl",
	})
	if err != nil || failure != nil {
		t.Fatalf("save smtp err=%v failure=%#v", err, failure)
	}
}

type fakeRepository struct {
	users     []auth.User
	hasHealth bool
	runCount  int
	events    map[string]*Event
}

func (r *fakeRepository) ListActiveUsers(context.Context) ([]auth.User, error) {
	if r.users == nil {
		return []auth.User{{ID: "user-1"}}, nil
	}
	return r.users, nil
}

func (r *fakeRepository) HasHealthRecord(context.Context, string, string) (bool, error) {
	return r.hasHealth, nil
}

func (r *fakeRepository) CountRunRecords(context.Context, string, string) (int, error) {
	return r.runCount, nil
}

func (r *fakeRepository) GetEvent(_ context.Context, userID string, localDate string, reminderType string, channel Channel) (*Event, error) {
	return r.events[eventKey(userID, localDate, reminderType, channel)], nil
}

func (r *fakeRepository) GetLatestEmailEvent(context.Context, string) (*Event, error) {
	for _, event := range r.events {
		if event.Channel == ChannelEmail {
			return event, nil
		}
	}
	return nil, nil
}

func (r *fakeRepository) CreateEvent(_ context.Context, input CreateEventInput) (*Event, error) {
	if r.events == nil {
		r.events = map[string]*Event{}
	}
	key := eventKey(input.UserID, input.LocalDate, input.ReminderType, input.Channel)
	if event := r.events[key]; event != nil {
		return event, nil
	}
	event := &Event{
		ID:           key,
		UserID:       input.UserID,
		LocalDate:    input.LocalDate,
		ReminderType: input.ReminderType,
		Channel:      input.Channel,
		Status:       input.Status,
		Message:      input.Message,
	}
	r.events[key] = event
	return event, nil
}

func (r *fakeRepository) UpdateEvent(_ context.Context, input UpdateEventInput) (*Event, error) {
	for _, event := range r.events {
		if event.ID == input.ID && event.UserID == input.UserID {
			event.Status = input.Status
			event.Message = input.Message
			return event, nil
		}
	}
	return nil, nil
}

type fakeSettingsRepository struct {
	settings map[string]*settings.Setting
}

func (r *fakeSettingsRepository) GetSetting(_ context.Context, userID string, settingType string, key string) (*settings.Setting, error) {
	return r.settings[userID+"/"+settingType+"/"+key], nil
}

func (r *fakeSettingsRepository) SaveSetting(_ context.Context, input settings.SaveSettingInput) (*settings.Setting, error) {
	if r.settings == nil {
		r.settings = map[string]*settings.Setting{}
	}
	setting := &settings.Setting{
		ID:        input.UserID + "/" + input.Type + "/" + input.Key,
		UserID:    input.UserID,
		Type:      input.Type,
		Key:       input.Key,
		ValueJSON: input.ValueJSON,
	}
	r.settings[setting.ID] = setting
	return setting, nil
}

type fakeMailSender struct {
	recipientEmail string
	subject        string
	text           string
}

func (s *fakeMailSender) Send(_ context.Context, _ settings.SmtpSecretConfig, recipientEmail string, subject string, text string) error {
	s.recipientEmail = recipientEmail
	s.subject = subject
	s.text = text
	return nil
}

func eventKey(userID string, localDate string, reminderType string, channel Channel) string {
	return userID + "/" + localDate + "/" + reminderType + "/" + string(channel)
}
