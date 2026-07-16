package reminders

import (
	"context"
	"fmt"
	"strings"
	"time"

	"resetlife/server/internal/auth"
	"resetlife/server/internal/settings"
)

type Channel string

const (
	ChannelInApp Channel = "in_app"
	ChannelEmail Channel = "email"
)

type Status string

const (
	StatusCreated Status = "created"
	StatusSent    Status = "sent"
	StatusFailed  Status = "failed"
	StatusSkipped Status = "skipped"
)

type Event struct {
	ID           string  `json:"id"`
	UserID       string  `json:"userId"`
	LocalDate    string  `json:"localDate"`
	ReminderType string  `json:"reminderType"`
	Channel      Channel `json:"channel"`
	Status       Status  `json:"status"`
	Message      string  `json:"message"`
	CreatedAtIso string  `json:"createdAtIso"`
	UpdatedAtIso string  `json:"updatedAtIso"`
}

type CreateEventInput struct {
	UserID       string
	LocalDate    string
	ReminderType string
	Channel      Channel
	Status       Status
	Message      string
	Now          time.Time
}

type UpdateEventInput struct {
	UserID  string
	ID      string
	Status  Status
	Message string
	Now     time.Time
}

type Repository interface {
	ListActiveUsers(ctx context.Context) ([]auth.User, error)
	HasHealthRecord(ctx context.Context, userID string, localDate string) (bool, error)
	CountRunRecords(ctx context.Context, userID string, localDate string) (int, error)
	GetEvent(ctx context.Context, userID string, localDate string, reminderType string, channel Channel) (*Event, error)
	GetLatestEmailEvent(ctx context.Context, userID string) (*Event, error)
	CreateEvent(ctx context.Context, input CreateEventInput) (*Event, error)
	UpdateEvent(ctx context.Context, input UpdateEventInput) (*Event, error)
}

type Service struct {
	Repository      Repository
	SettingsService *settings.Service
	Clock           func() time.Time
	TimeZone        *time.Location
	MailSender      settings.MailSender
}

type RunResult struct {
	Checked     int          `json:"checked"`
	Failed      int          `json:"failed"`
	Failures    []RunFailure `json:"failures"`
	LocalDate   string       `json:"localDate"`
	CurrentTime string       `json:"currentTime"`
	NowIso      string       `json:"nowIso"`
	Events      []Event      `json:"events,omitempty"`
}

type RunFailure struct {
	UserID  string `json:"userId"`
	Message string `json:"message"`
}

type SingleResult struct {
	Status string  `json:"status"`
	Events []Event `json:"events,omitempty"`
}

func (s Service) RunForActiveUsers(ctx context.Context) (*RunResult, error) {
	users, err := s.Repository.ListActiveUsers(ctx)
	if err != nil {
		return nil, err
	}

	localDate, currentTime, now := s.localNow()
	result := &RunResult{
		Checked:     len(users),
		Failures:    []RunFailure{},
		LocalDate:   localDate,
		CurrentTime: currentTime,
		NowIso:      now.UTC().Format(time.RFC3339),
		Events:      []Event{},
	}

	for _, user := range users {
		single, err := s.RunForUser(ctx, user.ID, localDate, currentTime, now)
		if err != nil {
			result.Failures = append(result.Failures, RunFailure{UserID: user.ID, Message: err.Error()})
			continue
		}
		result.Events = append(result.Events, single.Events...)
	}
	result.Failed = len(result.Failures)
	return result, nil
}

func (s Service) RunForUser(ctx context.Context, userID string, localDate string, currentTime string, now time.Time) (*SingleResult, error) {
	rules, err := s.SettingsService.GetReminderRules(ctx, userID)
	if err != nil {
		return nil, err
	}
	if (!rules.InAppEnabled && !rules.EmailEnabled) || currentTime < rules.ReminderTime {
		return &SingleResult{Status: "skipped"}, nil
	}

	hasHealth, err := s.Repository.HasHealthRecord(ctx, userID, localDate)
	if err != nil {
		return nil, err
	}
	runCount, err := s.Repository.CountRunRecords(ctx, userID, localDate)
	if err != nil {
		return nil, err
	}
	if hasHealth && runCount > 0 {
		return &SingleResult{Status: "completed"}, nil
	}

	missing := missingLabels(hasHealth, runCount)
	message := fmt.Sprintf("Today is missing %s. Add a quick record when convenient.", strings.Join(missing, " and "))
	result := &SingleResult{Status: "skipped"}

	if rules.InAppEnabled {
		event, err := s.Repository.CreateEvent(ctx, CreateEventInput{
			UserID:       userID,
			LocalDate:    localDate,
			ReminderType: "daily_record",
			Channel:      ChannelInApp,
			Status:       StatusCreated,
			Message:      message,
			Now:          now,
		})
		if err != nil {
			return nil, err
		}
		result.Status = string(StatusCreated)
		result.Events = append(result.Events, *event)
	}

	if rules.EmailEnabled {
		event, err := s.runEmailReminder(ctx, userID, localDate, rules.ReminderTime, message, now)
		if err != nil {
			return nil, err
		}
		if event != nil {
			result.Events = append(result.Events, *event)
		}
	}

	return result, nil
}

func (s Service) runEmailReminder(ctx context.Context, userID string, localDate string, reminderTime string, body string, now time.Time) (*Event, error) {
	reminderType := emailReminderType(reminderTime)
	existing, err := s.Repository.GetEvent(ctx, userID, localDate, reminderType, ChannelEmail)
	if err != nil || existing != nil {
		return existing, err
	}

	profile, err := s.SettingsService.GetProfile(ctx, userID)
	if err != nil {
		return nil, err
	}
	smtpConfig, err := s.SettingsService.GetSmtpSecretConfig(ctx, auth.DefaultAdminUserID)
	if err != nil {
		return nil, err
	}
	if profile.ReminderEmail == "" || smtpConfig == nil || smtpConfig.Host == "" || smtpConfig.FromEmail == "" {
		return s.Repository.CreateEvent(ctx, CreateEventInput{
			UserID:       userID,
			LocalDate:    localDate,
			ReminderType: reminderType,
			Channel:      ChannelEmail,
			Status:       StatusSkipped,
			Message:      "Email reminder skipped: configure SMTP and recipient email first.",
			Now:          now,
		})
	}

	created, err := s.Repository.CreateEvent(ctx, CreateEventInput{
		UserID:       userID,
		LocalDate:    localDate,
		ReminderType: reminderType,
		Channel:      ChannelEmail,
		Status:       StatusCreated,
		Message:      "Email reminder queued.",
		Now:          now,
	})
	if err != nil {
		return nil, err
	}

	sender := s.MailSender
	if sender == nil {
		sender = settings.DefaultMailSender{}
	}
	if err := sender.Send(ctx, *smtpConfig, profile.ReminderEmail, "Slimming Assistant reminder", body); err != nil {
		return s.Repository.UpdateEvent(ctx, UpdateEventInput{
			UserID:  userID,
			ID:      created.ID,
			Status:  StatusFailed,
			Message: "Email reminder failed: " + err.Error(),
			Now:     now,
		})
	}

	return s.Repository.UpdateEvent(ctx, UpdateEventInput{
		UserID:  userID,
		ID:      created.ID,
		Status:  StatusSent,
		Message: "Email reminder sent.",
		Now:     now,
	})
}

func (s Service) LatestEmailEvent(ctx context.Context, userID string) (*Event, error) {
	return s.Repository.GetLatestEmailEvent(ctx, userID)
}

func (s Service) localNow() (string, string, time.Time) {
	now := time.Now().UTC()
	if s.Clock != nil {
		now = s.Clock().UTC()
	}
	location := s.TimeZone
	if location == nil {
		location = time.FixedZone("Asia/Shanghai", 8*60*60)
	}
	local := now.In(location)
	return local.Format("2006-01-02"), local.Format("15:04"), now
}

func emailReminderType(reminderTime string) string {
	return "daily_record_email_" + strings.ReplaceAll(reminderTime, ":", "")
}

func missingLabels(hasHealth bool, runCount int) []string {
	var missing []string
	if !hasHealth {
		missing = append(missing, "health record")
	}
	if runCount == 0 {
		missing = append(missing, "run record")
	}
	return missing
}
