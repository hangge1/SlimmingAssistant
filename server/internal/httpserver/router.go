package httpserver

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"resetlife/server/internal/auth"
	"resetlife/server/internal/reminders"
	"resetlife/server/internal/settings"
	"resetlife/server/internal/slimming"
)

type RouterConfig struct {
	Logger                *slog.Logger
	Clock                 func() time.Time
	AuthResolver          *auth.Resolver
	LoginService          *auth.LoginService
	AdminService          *auth.AdminService
	SlimmingService       *slimming.Service
	SettingsService       *settings.Service
	ReminderService       *reminders.Service
	InternalReminderToken string
	StaticDir             string
}

type healthResponse struct {
	OK        bool   `json:"ok"`
	Service   string `json:"service"`
	Timestamp string `json:"timestamp"`
}

type versionResponse struct {
	Service string `json:"service"`
	Version string `json:"version"`
}

type errorResponse struct {
	OK    bool   `json:"ok"`
	Error string `json:"error"`
}

type sessionResponse struct {
	Authenticated bool          `json:"authenticated"`
	User          *auth.Context `json:"user"`
}

type loginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type createInitialAdminRequest struct {
	Username        string `json:"username"`
	DisplayName     string `json:"displayName"`
	Password        string `json:"password"`
	ConfirmPassword string `json:"confirmPassword"`
}

type createManagedUserRequest struct {
	Username        string `json:"username"`
	DisplayName     string `json:"displayName"`
	Role            string `json:"role"`
	Password        string `json:"password"`
	ConfirmPassword string `json:"confirmPassword"`
}

type updateManagedUserRequest struct {
	UserID          string `json:"userId"`
	DisplayName     string `json:"displayName"`
	Role            string `json:"role"`
	Password        string `json:"password"`
	ConfirmPassword string `json:"confirmPassword"`
}

type disableManagedUserRequest struct {
	UserID string `json:"userId"`
}

type managedUsersResponse struct {
	Users []auth.ManagedUser `json:"users"`
}

type loginResponse struct {
	Authenticated bool         `json:"authenticated"`
	User          auth.Context `json:"user"`
	ExpiresAt     string       `json:"expiresAt"`
}

type setupResponse struct {
	NeedsInitialAdmin bool `json:"needsInitialAdmin"`
}

type authFailureResponse struct {
	OK          bool              `json:"ok"`
	FieldErrors map[string]string `json:"fieldErrors,omitempty"`
	Form        string            `json:"form,omitempty"`
}

type saveHealthRecordRequest struct {
	LocalDate         string `json:"localDate"`
	WeightKg          string `json:"weightKg"`
	WaistCm           string `json:"waistCm"`
	HipCm             string `json:"hipCm"`
	BodyFatPercentage string `json:"bodyFatPercentage"`
}

type updateHealthRecordRequest struct {
	ID                string `json:"id"`
	LocalDate         string `json:"localDate"`
	WeightKg          string `json:"weightKg"`
	WaistCm           string `json:"waistCm"`
	HipCm             string `json:"hipCm"`
	BodyFatPercentage string `json:"bodyFatPercentage"`
}

type saveRunRecordRequest struct {
	LocalDate           string `json:"localDate"`
	DistanceKm          string `json:"distanceKm"`
	DurationMinutes     string `json:"durationMinutes"`
	AverageHeartRateBpm string `json:"averageHeartRateBpm"`
	AverageStrideMeters string `json:"averageStrideMeters"`
	CadenceSpm          string `json:"cadenceSpm"`
}

type updateRunRecordRequest struct {
	ID                  string `json:"id"`
	LocalDate           string `json:"localDate"`
	DistanceKm          string `json:"distanceKm"`
	DurationMinutes     string `json:"durationMinutes"`
	AverageHeartRateBpm string `json:"averageHeartRateBpm"`
	AverageStrideMeters string `json:"averageStrideMeters"`
	CadenceSpm          string `json:"cadenceSpm"`
}

type deleteRecordRequest struct {
	ID   string `json:"id"`
	Kind string `json:"kind"`
}

type saveHealthGoalRequest struct {
	TargetWeightKg          string `json:"targetWeightKg"`
	TargetWaistCm           string `json:"targetWaistCm"`
	TargetHipCm             string `json:"targetHipCm"`
	TargetBodyFatPercentage string `json:"targetBodyFatPercentage"`
}

type saveRunGoalRequest struct {
	WeeklyRunCount   string `json:"weeklyRunCount"`
	WeeklyDistanceKm string `json:"weeklyDistanceKm"`
}

type saveProfileRequest struct {
	Nickname      string `json:"nickname"`
	HeightCm      string `json:"heightCm"`
	ReminderEmail string `json:"reminderEmail"`
}

type saveTrendThresholdsRequest struct {
	MinimumDays    string `json:"minimumDays"`
	MinimumRecords string `json:"minimumRecords"`
}

type saveReminderRulesRequest struct {
	ReminderTime string `json:"reminderTime"`
	InAppEnabled bool   `json:"inAppEnabled"`
	EmailEnabled bool   `json:"emailEnabled"`
}

type saveSmtpConfigRequest struct {
	Host       string `json:"host"`
	Port       string `json:"port"`
	Username   string `json:"username"`
	Password   string `json:"password"`
	FromEmail  string `json:"fromEmail"`
	SecureMode string `json:"secureMode"`
}

type testEmailRequest struct {
	RecipientEmail string `json:"recipientEmail"`
}

type route struct {
	method  string
	path    string
	handler http.HandlerFunc
}

const (
	serviceName    = "resetlife-api"
	serviceVersion = "0.1.0"
)

func NewRouter(cfg RouterConfig) http.Handler {
	logger := cfg.Logger
	if logger == nil {
		logger = slog.Default()
	}

	clock := cfg.Clock
	if clock == nil {
		clock = func() time.Time {
			return time.Now().UTC()
		}
	}

	routes := []route{
		{method: http.MethodGet, path: "/healthz", handler: handleHealth(clock)},
		{method: http.MethodGet, path: "/api/healthz", handler: handleHealth(clock)},
		{method: http.MethodGet, path: "/api/version", handler: handleVersion},
		{method: http.MethodGet, path: "/api/auth/session", handler: handleSession(cfg.AuthResolver)},
		{method: http.MethodGet, path: "/api/auth/setup", handler: handleSetupStatus(cfg.AdminService)},
		{method: http.MethodPost, path: "/api/auth/setup", handler: handleCreateInitialAdmin(cfg.AdminService)},
		{method: http.MethodPost, path: "/api/auth/login", handler: handleLogin(cfg.LoginService)},
		{method: http.MethodPost, path: "/api/auth/logout", handler: handleLogout(cfg.LoginService)},
		{method: http.MethodGet, path: "/api/admin/users", handler: handleListManagedUsers(cfg.AuthResolver, cfg.AdminService)},
		{method: http.MethodPost, path: "/api/admin/users", handler: handleCreateManagedUser(cfg.AuthResolver, cfg.AdminService)},
		{method: http.MethodPost, path: "/api/admin/users/update", handler: handleUpdateManagedUser(cfg.AuthResolver, cfg.AdminService)},
		{method: http.MethodPost, path: "/api/admin/users/disable", handler: handleDisableManagedUser(cfg.AuthResolver, cfg.AdminService)},
		{method: http.MethodGet, path: "/api/slimming/summary", handler: handleSlimmingSummary(cfg.AuthResolver, cfg.SlimmingService)},
		{method: http.MethodGet, path: "/api/slimming/history", handler: handleSlimmingHistory(cfg.AuthResolver, cfg.SlimmingService)},
		{method: http.MethodPost, path: "/api/slimming/records/health", handler: handleSaveHealthRecord(cfg.AuthResolver, cfg.SlimmingService)},
		{method: http.MethodPost, path: "/api/slimming/records/runs", handler: handleCreateRunRecord(cfg.AuthResolver, cfg.SlimmingService)},
		{method: http.MethodPost, path: "/api/slimming/records/health/update", handler: handleUpdateHealthRecord(cfg.AuthResolver, cfg.SlimmingService)},
		{method: http.MethodPost, path: "/api/slimming/records/runs/update", handler: handleUpdateRunRecord(cfg.AuthResolver, cfg.SlimmingService)},
		{method: http.MethodPost, path: "/api/slimming/records/delete", handler: handleDeleteRecord(cfg.AuthResolver, cfg.SlimmingService)},
		{method: http.MethodPost, path: "/api/slimming/goals/health", handler: handleSaveHealthGoal(cfg.AuthResolver, cfg.SlimmingService)},
		{method: http.MethodPost, path: "/api/slimming/goals/run", handler: handleSaveRunGoal(cfg.AuthResolver, cfg.SlimmingService)},
		{method: http.MethodGet, path: "/api/settings/profile", handler: handleGetProfile(cfg.AuthResolver, cfg.SettingsService)},
		{method: http.MethodPost, path: "/api/settings/profile", handler: handleSaveProfile(cfg.AuthResolver, cfg.SettingsService)},
		{method: http.MethodGet, path: "/api/settings/trend-thresholds", handler: handleGetTrendThresholds(cfg.AuthResolver, cfg.SettingsService)},
		{method: http.MethodPost, path: "/api/settings/trend-thresholds", handler: handleSaveTrendThresholds(cfg.AuthResolver, cfg.SettingsService)},
		{method: http.MethodGet, path: "/api/settings/reminder-rules", handler: handleGetReminderRules(cfg.AuthResolver, cfg.SettingsService)},
		{method: http.MethodPost, path: "/api/settings/reminder-rules", handler: handleSaveReminderRules(cfg.AuthResolver, cfg.SettingsService)},
		{method: http.MethodGet, path: "/api/settings/smtp", handler: handleGetSmtpConfig(cfg.AuthResolver, cfg.SettingsService)},
		{method: http.MethodPost, path: "/api/settings/smtp", handler: handleSaveSmtpConfig(cfg.AuthResolver, cfg.SettingsService)},
		{method: http.MethodPost, path: "/api/settings/smtp/clear", handler: handleClearSmtpConfig(cfg.AuthResolver, cfg.SettingsService)},
		{method: http.MethodPost, path: "/api/settings/smtp/test", handler: handleTestEmail(cfg.AuthResolver, cfg.SettingsService)},
		{method: http.MethodPost, path: "/api/reminders/run", handler: handleRunReminders(cfg.AuthResolver, cfg.ReminderService, cfg.InternalReminderToken)},
		{method: http.MethodGet, path: "/api/reminders/latest-email", handler: handleLatestEmailReminder(cfg.AuthResolver, cfg.ReminderService)},
	}

	return requestLogger(logger, routeRequest(routes, staticFallback(cfg.StaticDir)))
}

func handleHealth(clock func() time.Time) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, healthResponse{
			OK:        true,
			Service:   serviceName,
			Timestamp: clock().UTC().Format(time.RFC3339),
		})
	}
}

func handleVersion(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, versionResponse{
		Service: serviceName,
		Version: serviceVersion,
	})
}

func handleSession(resolver *auth.Resolver) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie(auth.UserSessionCookieName)
		if err != nil {
			if errors.Is(err, http.ErrNoCookie) {
				writeJSON(w, http.StatusOK, sessionResponse{Authenticated: false})
				return
			}

			writeError(w, http.StatusBadRequest, "invalid_cookie")
			return
		}

		if resolver == nil {
			writeError(w, http.StatusServiceUnavailable, "auth_unavailable")
			return
		}

		context, err := resolver.Resolve(r.Context(), cookie.Value)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "session_lookup_failed")
			return
		}
		if context == nil {
			writeJSON(w, http.StatusOK, sessionResponse{Authenticated: false})
			return
		}

		writeJSON(w, http.StatusOK, sessionResponse{Authenticated: true, User: context})
	}
}

func handleSetupStatus(service *auth.AdminService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if service == nil {
			writeError(w, http.StatusServiceUnavailable, "auth_unavailable")
			return
		}

		needsInitialAdmin, err := service.NeedsInitialAdmin(r.Context())
		if err != nil {
			writeError(w, http.StatusInternalServerError, "setup_lookup_failed")
			return
		}

		writeJSON(w, http.StatusOK, setupResponse{NeedsInitialAdmin: needsInitialAdmin})
	}
}

func handleCreateInitialAdmin(service *auth.AdminService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if service == nil {
			writeError(w, http.StatusServiceUnavailable, "auth_unavailable")
			return
		}

		var input createInitialAdminRequest
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			writeError(w, http.StatusBadRequest, "invalid_json")
			return
		}

		result, failure, err := service.CreateInitialAdmin(r.Context(), auth.CreateInitialAdminInput{
			Username:        input.Username,
			DisplayName:     input.DisplayName,
			Password:        input.Password,
			ConfirmPassword: input.ConfirmPassword,
		})
		if err != nil {
			writeError(w, http.StatusInternalServerError, "setup_failed")
			return
		}
		if failure != nil {
			writeJSON(w, http.StatusUnauthorized, authFailureResponse{
				OK:          false,
				FieldErrors: failure.FieldErrors,
				Form:        failure.Form,
			})
			return
		}

		http.SetCookie(w, sessionCookie(result.SessionToken, result.ExpiresAt))
		writeJSON(w, http.StatusOK, loginResponse{
			Authenticated: true,
			User:          result.User,
			ExpiresAt:     result.ExpiresAt.UTC().Format(time.RFC3339),
		})
	}
}

func handleLogin(service *auth.LoginService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if service == nil {
			writeError(w, http.StatusServiceUnavailable, "auth_unavailable")
			return
		}

		var input loginRequest
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			writeError(w, http.StatusBadRequest, "invalid_json")
			return
		}

		result, failure, err := service.Login(r.Context(), auth.LoginInput{
			Username: input.Username,
			Password: input.Password,
		})
		if err != nil {
			writeError(w, http.StatusInternalServerError, "login_failed")
			return
		}
		if failure != nil {
			writeJSON(w, http.StatusUnauthorized, authFailureResponse{
				OK:          false,
				FieldErrors: failure.FieldErrors,
				Form:        failure.Form,
			})
			return
		}

		http.SetCookie(w, sessionCookie(result.SessionToken, result.ExpiresAt))
		writeJSON(w, http.StatusOK, loginResponse{
			Authenticated: true,
			User:          result.User,
			ExpiresAt:     result.ExpiresAt.UTC().Format(time.RFC3339),
		})
	}
}

func handleLogout(service *auth.LoginService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if service == nil {
			writeError(w, http.StatusServiceUnavailable, "auth_unavailable")
			return
		}

		cookie, err := r.Cookie(auth.UserSessionCookieName)
		if err != nil && !errors.Is(err, http.ErrNoCookie) {
			writeError(w, http.StatusBadRequest, "invalid_cookie")
			return
		}

		if cookie != nil {
			if err := service.Logout(r.Context(), cookie.Value); err != nil {
				writeError(w, http.StatusInternalServerError, "logout_failed")
				return
			}
		}

		http.SetCookie(w, expiredSessionCookie())
		writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
	}
}

func handleListManagedUsers(resolver *auth.Resolver, service *auth.AdminService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if service == nil {
			writeError(w, http.StatusServiceUnavailable, "auth_unavailable")
			return
		}
		if _, ok := resolveRequiredAdmin(w, r, resolver); !ok {
			return
		}

		users, err := service.ListManagedUsers(r.Context())
		if err != nil {
			writeError(w, http.StatusInternalServerError, "users_lookup_failed")
			return
		}

		writeJSON(w, http.StatusOK, managedUsersResponse{Users: users})
	}
}

func handleCreateManagedUser(resolver *auth.Resolver, service *auth.AdminService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if service == nil {
			writeError(w, http.StatusServiceUnavailable, "auth_unavailable")
			return
		}
		if _, ok := resolveRequiredAdmin(w, r, resolver); !ok {
			return
		}

		var input createManagedUserRequest
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			writeError(w, http.StatusBadRequest, "invalid_json")
			return
		}

		user, failure, err := service.CreateManagedUser(r.Context(), auth.CreateManagedUserInput{
			Username:        input.Username,
			DisplayName:     input.DisplayName,
			Role:            input.Role,
			Password:        input.Password,
			ConfirmPassword: input.ConfirmPassword,
		})
		if err != nil {
			writeError(w, http.StatusInternalServerError, "user_create_failed")
			return
		}
		if failure != nil {
			writeAuthFailure(w, http.StatusBadRequest, failure)
			return
		}

		writeJSON(w, http.StatusOK, user)
	}
}

func handleUpdateManagedUser(resolver *auth.Resolver, service *auth.AdminService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if service == nil {
			writeError(w, http.StatusServiceUnavailable, "auth_unavailable")
			return
		}
		context, ok := resolveRequiredAdmin(w, r, resolver)
		if !ok {
			return
		}

		var input updateManagedUserRequest
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			writeError(w, http.StatusBadRequest, "invalid_json")
			return
		}

		user, failure, err := service.UpdateManagedUser(r.Context(), auth.UpdateManagedUserInput{
			CurrentAdminUserID: context.UserID,
			UserID:             input.UserID,
			DisplayName:        input.DisplayName,
			Role:               input.Role,
			Password:           input.Password,
			ConfirmPassword:    input.ConfirmPassword,
		})
		if err != nil {
			writeError(w, http.StatusInternalServerError, "user_update_failed")
			return
		}
		if failure != nil {
			writeAuthFailure(w, http.StatusBadRequest, failure)
			return
		}

		writeJSON(w, http.StatusOK, user)
	}
}

func handleDisableManagedUser(resolver *auth.Resolver, service *auth.AdminService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if service == nil {
			writeError(w, http.StatusServiceUnavailable, "auth_unavailable")
			return
		}
		context, ok := resolveRequiredAdmin(w, r, resolver)
		if !ok {
			return
		}

		var input disableManagedUserRequest
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			writeError(w, http.StatusBadRequest, "invalid_json")
			return
		}

		user, failure, err := service.DisableManagedUser(r.Context(), auth.DisableManagedUserInput{
			CurrentAdminUserID: context.UserID,
			UserID:             input.UserID,
		})
		if err != nil {
			writeError(w, http.StatusInternalServerError, "user_disable_failed")
			return
		}
		if failure != nil {
			writeAuthFailure(w, http.StatusBadRequest, failure)
			return
		}

		writeJSON(w, http.StatusOK, user)
	}
}

func handleSlimmingSummary(resolver *auth.Resolver, service *slimming.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		context, ok := resolveRequiredSession(w, r, resolver)
		if !ok {
			return
		}
		if service == nil {
			writeError(w, http.StatusServiceUnavailable, "slimming_unavailable")
			return
		}

		summary, err := service.GetSummary(r.Context(), context.UserID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "summary_lookup_failed")
			return
		}

		writeJSON(w, http.StatusOK, summary)
	}
}

func handleSlimmingHistory(resolver *auth.Resolver, service *slimming.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		context, ok := resolveRequiredSession(w, r, resolver)
		if !ok {
			return
		}
		if service == nil {
			writeError(w, http.StatusServiceUnavailable, "slimming_unavailable")
			return
		}

		query := r.URL.Query()
		history, err := service.ListHistory(r.Context(), context.UserID, slimming.HistoryFilters{
			Type:           slimming.HistoryRecordType(query.Get("type")),
			Range:          slimming.HistoryRange(query.Get("range")),
			TodayLocalDate: query.Get("todayLocalDate"),
			StartDate:      query.Get("startDate"),
			EndDate:        query.Get("endDate"),
		})
		if err != nil {
			writeError(w, http.StatusInternalServerError, "history_lookup_failed")
			return
		}

		writeJSON(w, http.StatusOK, history)
	}
}

func handleSaveHealthRecord(resolver *auth.Resolver, service *slimming.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		context, ok := resolveRequiredSession(w, r, resolver)
		if !ok {
			return
		}
		if service == nil {
			writeError(w, http.StatusServiceUnavailable, "slimming_unavailable")
			return
		}

		var input saveHealthRecordRequest
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			writeError(w, http.StatusBadRequest, "invalid_json")
			return
		}

		record, failure, err := service.SaveHealthRecord(r.Context(), context.UserID, slimming.HealthRecordInput{
			LocalDate:         input.LocalDate,
			WeightKg:          input.WeightKg,
			WaistCm:           input.WaistCm,
			HipCm:             input.HipCm,
			BodyFatPercentage: input.BodyFatPercentage,
		})
		if err != nil {
			writeError(w, http.StatusInternalServerError, "health_record_save_failed")
			return
		}
		if failure != nil {
			writeJSON(w, http.StatusBadRequest, authFailureResponse{
				OK:          false,
				FieldErrors: failure.FieldErrors,
				Form:        failure.Form,
			})
			return
		}

		writeJSON(w, http.StatusOK, record)
	}
}

func handleUpdateHealthRecord(resolver *auth.Resolver, service *slimming.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		context, ok := resolveRequiredSession(w, r, resolver)
		if !ok {
			return
		}
		if service == nil {
			writeError(w, http.StatusServiceUnavailable, "slimming_unavailable")
			return
		}

		var input updateHealthRecordRequest
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			writeError(w, http.StatusBadRequest, "invalid_json")
			return
		}
		if strings.TrimSpace(input.ID) == "" {
			writeError(w, http.StatusBadRequest, "missing_record_id")
			return
		}

		record, failure, err := service.UpdateHealthRecord(r.Context(), context.UserID, input.ID, slimming.HealthRecordInput{
			LocalDate:         input.LocalDate,
			WeightKg:          input.WeightKg,
			WaistCm:           input.WaistCm,
			HipCm:             input.HipCm,
			BodyFatPercentage: input.BodyFatPercentage,
		})
		if err != nil {
			writeError(w, http.StatusInternalServerError, "health_record_update_failed")
			return
		}
		if failure != nil {
			writeJSON(w, http.StatusBadRequest, authFailureResponse{
				OK:          false,
				FieldErrors: failure.FieldErrors,
				Form:        failure.Form,
			})
			return
		}
		if record == nil {
			writeError(w, http.StatusNotFound, "record_not_found")
			return
		}

		writeJSON(w, http.StatusOK, record)
	}
}

func handleCreateRunRecord(resolver *auth.Resolver, service *slimming.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		context, ok := resolveRequiredSession(w, r, resolver)
		if !ok {
			return
		}
		if service == nil {
			writeError(w, http.StatusServiceUnavailable, "slimming_unavailable")
			return
		}

		var input saveRunRecordRequest
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			writeError(w, http.StatusBadRequest, "invalid_json")
			return
		}

		record, failure, err := service.CreateRunRecord(r.Context(), context.UserID, slimming.RunRecordInput{
			LocalDate:           input.LocalDate,
			DistanceKm:          input.DistanceKm,
			DurationMinutes:     input.DurationMinutes,
			AverageHeartRateBpm: input.AverageHeartRateBpm,
			AverageStrideMeters: input.AverageStrideMeters,
			CadenceSpm:          input.CadenceSpm,
		})
		if err != nil {
			writeError(w, http.StatusInternalServerError, "run_record_save_failed")
			return
		}
		if failure != nil {
			writeJSON(w, http.StatusBadRequest, authFailureResponse{
				OK:          false,
				FieldErrors: failure.FieldErrors,
				Form:        failure.Form,
			})
			return
		}

		writeJSON(w, http.StatusOK, record)
	}
}

func handleUpdateRunRecord(resolver *auth.Resolver, service *slimming.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		context, ok := resolveRequiredSession(w, r, resolver)
		if !ok {
			return
		}
		if service == nil {
			writeError(w, http.StatusServiceUnavailable, "slimming_unavailable")
			return
		}

		var input updateRunRecordRequest
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			writeError(w, http.StatusBadRequest, "invalid_json")
			return
		}
		if strings.TrimSpace(input.ID) == "" {
			writeError(w, http.StatusBadRequest, "missing_record_id")
			return
		}

		record, failure, err := service.UpdateRunRecord(r.Context(), context.UserID, input.ID, slimming.RunRecordInput{
			LocalDate:           input.LocalDate,
			DistanceKm:          input.DistanceKm,
			DurationMinutes:     input.DurationMinutes,
			AverageHeartRateBpm: input.AverageHeartRateBpm,
			AverageStrideMeters: input.AverageStrideMeters,
			CadenceSpm:          input.CadenceSpm,
		})
		if err != nil {
			writeError(w, http.StatusInternalServerError, "run_record_update_failed")
			return
		}
		if failure != nil {
			writeJSON(w, http.StatusBadRequest, authFailureResponse{
				OK:          false,
				FieldErrors: failure.FieldErrors,
				Form:        failure.Form,
			})
			return
		}
		if record == nil {
			writeError(w, http.StatusNotFound, "record_not_found")
			return
		}

		writeJSON(w, http.StatusOK, record)
	}
}

func handleDeleteRecord(resolver *auth.Resolver, service *slimming.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		context, ok := resolveRequiredSession(w, r, resolver)
		if !ok {
			return
		}
		if service == nil {
			writeError(w, http.StatusServiceUnavailable, "slimming_unavailable")
			return
		}

		var input deleteRecordRequest
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			writeError(w, http.StatusBadRequest, "invalid_json")
			return
		}
		if strings.TrimSpace(input.ID) == "" {
			writeError(w, http.StatusBadRequest, "missing_record_id")
			return
		}

		switch input.Kind {
		case string(slimming.HistoryRecordHealth):
			record, err := service.DeleteHealthRecord(r.Context(), context.UserID, input.ID)
			if err != nil {
				writeError(w, http.StatusInternalServerError, "health_record_delete_failed")
				return
			}
			if record == nil {
				writeError(w, http.StatusNotFound, "record_not_found")
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"ok": true, "deleted": record})
		case string(slimming.HistoryRecordRun):
			record, err := service.DeleteRunRecord(r.Context(), context.UserID, input.ID)
			if err != nil {
				writeError(w, http.StatusInternalServerError, "run_record_delete_failed")
				return
			}
			if record == nil {
				writeError(w, http.StatusNotFound, "record_not_found")
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"ok": true, "deleted": record})
		default:
			writeError(w, http.StatusBadRequest, "invalid_record_kind")
		}
	}
}

func handleSaveHealthGoal(resolver *auth.Resolver, service *slimming.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		context, ok := resolveRequiredSession(w, r, resolver)
		if !ok {
			return
		}
		if service == nil {
			writeError(w, http.StatusServiceUnavailable, "slimming_unavailable")
			return
		}

		var input saveHealthGoalRequest
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			writeError(w, http.StatusBadRequest, "invalid_json")
			return
		}

		goal, failure, err := service.SaveHealthGoal(r.Context(), context.UserID, slimming.HealthGoalInput{
			TargetWeightKg:          input.TargetWeightKg,
			TargetWaistCm:           input.TargetWaistCm,
			TargetHipCm:             input.TargetHipCm,
			TargetBodyFatPercentage: input.TargetBodyFatPercentage,
		})
		if err != nil {
			writeError(w, http.StatusInternalServerError, "health_goal_save_failed")
			return
		}
		if failure != nil {
			writeJSON(w, http.StatusBadRequest, authFailureResponse{
				OK:          false,
				FieldErrors: failure.FieldErrors,
				Form:        failure.Form,
			})
			return
		}

		writeJSON(w, http.StatusOK, goal)
	}
}

func handleSaveRunGoal(resolver *auth.Resolver, service *slimming.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		context, ok := resolveRequiredSession(w, r, resolver)
		if !ok {
			return
		}
		if service == nil {
			writeError(w, http.StatusServiceUnavailable, "slimming_unavailable")
			return
		}

		var input saveRunGoalRequest
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			writeError(w, http.StatusBadRequest, "invalid_json")
			return
		}

		goal, failure, err := service.SaveRunGoal(r.Context(), context.UserID, slimming.RunGoalInput{
			WeeklyRunCount:   input.WeeklyRunCount,
			WeeklyDistanceKm: input.WeeklyDistanceKm,
		})
		if err != nil {
			writeError(w, http.StatusInternalServerError, "run_goal_save_failed")
			return
		}
		if failure != nil {
			writeJSON(w, http.StatusBadRequest, authFailureResponse{
				OK:          false,
				FieldErrors: failure.FieldErrors,
				Form:        failure.Form,
			})
			return
		}

		writeJSON(w, http.StatusOK, goal)
	}
}

func handleGetProfile(resolver *auth.Resolver, service *settings.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		context, ok := resolveRequiredSession(w, r, resolver)
		if !ok {
			return
		}
		if service == nil {
			writeError(w, http.StatusServiceUnavailable, "settings_unavailable")
			return
		}

		profile, err := service.GetProfile(r.Context(), context.UserID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "profile_lookup_failed")
			return
		}

		writeJSON(w, http.StatusOK, profile)
	}
}

func handleSaveProfile(resolver *auth.Resolver, service *settings.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		context, ok := resolveRequiredSession(w, r, resolver)
		if !ok {
			return
		}
		if service == nil {
			writeError(w, http.StatusServiceUnavailable, "settings_unavailable")
			return
		}

		var input saveProfileRequest
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			writeError(w, http.StatusBadRequest, "invalid_json")
			return
		}

		profile, failure, err := service.SaveProfile(r.Context(), context.UserID, settings.ProfileInput{
			Nickname:      input.Nickname,
			HeightCm:      input.HeightCm,
			ReminderEmail: input.ReminderEmail,
		})
		if err != nil {
			writeError(w, http.StatusInternalServerError, "profile_save_failed")
			return
		}
		if failure != nil {
			writeJSON(w, http.StatusBadRequest, authFailureResponse{
				OK:          false,
				FieldErrors: failure.FieldErrors,
				Form:        failure.Form,
			})
			return
		}

		writeJSON(w, http.StatusOK, profile)
	}
}

func handleGetTrendThresholds(resolver *auth.Resolver, service *settings.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		context, ok := resolveRequiredSession(w, r, resolver)
		if !ok {
			return
		}
		if service == nil {
			writeError(w, http.StatusServiceUnavailable, "settings_unavailable")
			return
		}

		thresholds, err := service.GetTrendThresholds(r.Context(), context.UserID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "trend_thresholds_lookup_failed")
			return
		}

		writeJSON(w, http.StatusOK, thresholds)
	}
}

func handleSaveTrendThresholds(resolver *auth.Resolver, service *settings.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		context, ok := resolveRequiredSession(w, r, resolver)
		if !ok {
			return
		}
		if service == nil {
			writeError(w, http.StatusServiceUnavailable, "settings_unavailable")
			return
		}

		var input saveTrendThresholdsRequest
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			writeError(w, http.StatusBadRequest, "invalid_json")
			return
		}

		thresholds, failure, err := service.SaveTrendThresholds(r.Context(), context.UserID, settings.TrendThresholdInput{
			MinimumDays:    input.MinimumDays,
			MinimumRecords: input.MinimumRecords,
		})
		if err != nil {
			writeError(w, http.StatusInternalServerError, "trend_thresholds_save_failed")
			return
		}
		if failure != nil {
			writeJSON(w, http.StatusBadRequest, authFailureResponse{
				OK:          false,
				FieldErrors: failure.FieldErrors,
				Form:        failure.Form,
			})
			return
		}

		writeJSON(w, http.StatusOK, thresholds)
	}
}

func handleGetReminderRules(resolver *auth.Resolver, service *settings.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		context, ok := resolveRequiredSession(w, r, resolver)
		if !ok {
			return
		}
		if service == nil {
			writeError(w, http.StatusServiceUnavailable, "settings_unavailable")
			return
		}

		rules, err := service.GetReminderRules(r.Context(), context.UserID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "reminder_rules_lookup_failed")
			return
		}

		writeJSON(w, http.StatusOK, rules)
	}
}

func handleSaveReminderRules(resolver *auth.Resolver, service *settings.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		context, ok := resolveRequiredSession(w, r, resolver)
		if !ok {
			return
		}
		if service == nil {
			writeError(w, http.StatusServiceUnavailable, "settings_unavailable")
			return
		}

		var input saveReminderRulesRequest
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			writeError(w, http.StatusBadRequest, "invalid_json")
			return
		}

		rules, failure, err := service.SaveReminderRules(r.Context(), context.UserID, settings.ReminderRuleInput{
			ReminderTime: input.ReminderTime,
			InAppEnabled: input.InAppEnabled,
			EmailEnabled: input.EmailEnabled,
		})
		if err != nil {
			writeError(w, http.StatusInternalServerError, "reminder_rules_save_failed")
			return
		}
		if failure != nil {
			writeJSON(w, http.StatusBadRequest, authFailureResponse{
				OK:          false,
				FieldErrors: failure.FieldErrors,
				Form:        failure.Form,
			})
			return
		}

		writeJSON(w, http.StatusOK, rules)
	}
}

func handleGetSmtpConfig(resolver *auth.Resolver, service *settings.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if _, ok := resolveRequiredAdmin(w, r, resolver); !ok {
			return
		}
		if service == nil {
			writeError(w, http.StatusServiceUnavailable, "settings_unavailable")
			return
		}

		config, err := service.GetSmtpConfig(r.Context(), auth.DefaultAdminUserID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "smtp_lookup_failed")
			return
		}

		writeJSON(w, http.StatusOK, config)
	}
}

func handleSaveSmtpConfig(resolver *auth.Resolver, service *settings.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if _, ok := resolveRequiredAdmin(w, r, resolver); !ok {
			return
		}
		if service == nil {
			writeError(w, http.StatusServiceUnavailable, "settings_unavailable")
			return
		}

		var input saveSmtpConfigRequest
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			writeError(w, http.StatusBadRequest, "invalid_json")
			return
		}

		config, failure, err := service.SaveSmtpConfig(r.Context(), auth.DefaultAdminUserID, settings.SmtpConfigInput{
			Host:       input.Host,
			Port:       input.Port,
			Username:   input.Username,
			Password:   input.Password,
			FromEmail:  input.FromEmail,
			SecureMode: input.SecureMode,
		})
		if err != nil {
			writeError(w, http.StatusInternalServerError, "smtp_save_failed")
			return
		}
		if failure != nil {
			writeJSON(w, http.StatusBadRequest, authFailureResponse{
				OK:          false,
				FieldErrors: failure.FieldErrors,
				Form:        failure.Form,
			})
			return
		}

		writeJSON(w, http.StatusOK, config)
	}
}

func handleClearSmtpConfig(resolver *auth.Resolver, service *settings.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if _, ok := resolveRequiredAdmin(w, r, resolver); !ok {
			return
		}
		if service == nil {
			writeError(w, http.StatusServiceUnavailable, "settings_unavailable")
			return
		}

		config, err := service.ClearSmtpConfig(r.Context(), auth.DefaultAdminUserID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "smtp_clear_failed")
			return
		}

		writeJSON(w, http.StatusOK, config)
	}
}

func handleTestEmail(resolver *auth.Resolver, service *settings.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if _, ok := resolveRequiredAdmin(w, r, resolver); !ok {
			return
		}
		if service == nil {
			writeError(w, http.StatusServiceUnavailable, "settings_unavailable")
			return
		}

		var input testEmailRequest
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			writeError(w, http.StatusBadRequest, "invalid_json")
			return
		}

		result, failure, err := service.SendTestEmail(r.Context(), auth.DefaultAdminUserID, settings.TestEmailInput{
			RecipientEmail: input.RecipientEmail,
		})
		if err != nil {
			writeError(w, http.StatusInternalServerError, "test_email_failed")
			return
		}
		if failure != nil {
			writeJSON(w, http.StatusBadRequest, authFailureResponse{
				OK:          false,
				FieldErrors: failure.FieldErrors,
				Form:        failure.Form,
			})
			return
		}

		writeJSON(w, http.StatusOK, result)
	}
}

func handleRunReminders(resolver *auth.Resolver, service *reminders.Service, internalToken string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if service == nil {
			writeError(w, http.StatusServiceUnavailable, "reminders_unavailable")
			return
		}

		requestToken := r.Header.Get("x-internal-reminder-token")
		if internalToken == "" || requestToken != internalToken {
			if _, ok := resolveRequiredAdmin(w, r, resolver); !ok {
				return
			}
		}

		result, err := service.RunForActiveUsers(r.Context())
		if err != nil {
			writeError(w, http.StatusInternalServerError, "reminder_run_failed")
			return
		}

		writeJSON(w, http.StatusOK, result)
	}
}

func handleLatestEmailReminder(resolver *auth.Resolver, service *reminders.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		context, ok := resolveRequiredSession(w, r, resolver)
		if !ok {
			return
		}
		if service == nil {
			writeError(w, http.StatusServiceUnavailable, "reminders_unavailable")
			return
		}

		event, err := service.LatestEmailEvent(r.Context(), context.UserID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "latest_email_reminder_lookup_failed")
			return
		}

		writeJSON(w, http.StatusOK, map[string]any{"event": event})
	}
}

func resolveRequiredSession(w http.ResponseWriter, r *http.Request, resolver *auth.Resolver) (*auth.Context, bool) {
	cookie, err := r.Cookie(auth.UserSessionCookieName)
	if err != nil {
		if errors.Is(err, http.ErrNoCookie) {
			writeError(w, http.StatusUnauthorized, "unauthenticated")
			return nil, false
		}

		writeError(w, http.StatusBadRequest, "invalid_cookie")
		return nil, false
	}

	if resolver == nil {
		writeError(w, http.StatusServiceUnavailable, "auth_unavailable")
		return nil, false
	}

	context, err := resolver.Resolve(r.Context(), cookie.Value)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "session_lookup_failed")
		return nil, false
	}
	if context == nil {
		writeError(w, http.StatusUnauthorized, "unauthenticated")
		return nil, false
	}

	return context, true
}

func resolveRequiredAdmin(w http.ResponseWriter, r *http.Request, resolver *auth.Resolver) (*auth.Context, bool) {
	context, ok := resolveRequiredSession(w, r, resolver)
	if !ok {
		return nil, false
	}
	if context.Role != auth.RoleAdmin {
		writeError(w, http.StatusForbidden, "admin_required")
		return nil, false
	}
	return context, true
}

func routeRequest(routes []route, fallback http.HandlerFunc) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		methodAllowed := false
		requestPath := cleanPath(r.URL.Path)

		for _, candidate := range routes {
			if cleanPath(candidate.path) != requestPath {
				continue
			}

			if candidate.method != r.Method {
				methodAllowed = true
				continue
			}

			candidate.handler(w, r)
			return
		}

		if methodAllowed {
			writeError(w, http.StatusMethodNotAllowed, "method_not_allowed")
			return
		}

		if fallback != nil {
			fallback(w, r)
			return
		}

		writeError(w, http.StatusNotFound, "not_found")
	})
}

func staticFallback(staticDir string) http.HandlerFunc {
	if strings.TrimSpace(staticDir) == "" {
		return nil
	}

	root := filepath.Clean(staticDir)
	return func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(cleanPath(r.URL.Path), "/api") {
			writeError(w, http.StatusNotFound, "not_found")
			return
		}
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			writeError(w, http.StatusMethodNotAllowed, "method_not_allowed")
			return
		}

		requestPath := filepath.Clean("/" + strings.TrimPrefix(r.URL.Path, "/"))
		candidate := filepath.Join(root, requestPath)
		if !isInsidePath(root, candidate) {
			writeError(w, http.StatusBadRequest, "invalid_static_path")
			return
		}

		info, err := os.Stat(candidate)
		if err == nil && info.IsDir() {
			candidate = filepath.Join(candidate, "index.html")
			info, err = os.Stat(candidate)
		}
		if err != nil || info.IsDir() {
			candidate = filepath.Join(root, "index.html")
			if _, err := os.Stat(candidate); err != nil {
				writeError(w, http.StatusNotFound, "not_found")
				return
			}
		}

		http.ServeFile(w, r, candidate)
	}
}

func isInsidePath(root string, candidate string) bool {
	relative, err := filepath.Rel(root, candidate)
	if err != nil {
		return false
	}
	return relative == "." || (!strings.HasPrefix(relative, "..") && !filepath.IsAbs(relative))
}

func cleanPath(path string) string {
	if path == "/" {
		return path
	}

	return strings.TrimRight(path, "/")
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeError(w http.ResponseWriter, status int, code string) {
	writeJSON(w, status, errorResponse{OK: false, Error: code})
}

func writeAuthFailure(w http.ResponseWriter, status int, failure *auth.AuthFailure) {
	writeJSON(w, status, authFailureResponse{
		OK:          false,
		FieldErrors: failure.FieldErrors,
		Form:        failure.Form,
	})
}

func sessionCookie(value string, expiresAt time.Time) *http.Cookie {
	return &http.Cookie{
		Name:     auth.UserSessionCookieName,
		Value:    value,
		Path:     "/",
		Expires:  expiresAt.UTC(),
		MaxAge:   int(auth.SessionMaxAge.Seconds()),
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	}
}

func expiredSessionCookie() *http.Cookie {
	return &http.Cookie{
		Name:     auth.UserSessionCookieName,
		Value:    "",
		Path:     "/",
		Expires:  time.Unix(0, 0).UTC(),
		MaxAge:   -1,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	}
}

func requestLogger(logger *slog.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		startedAt := time.Now()
		recorder := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(recorder, r)
		logger.Info("request handled",
			"method", r.Method,
			"path", r.URL.Path,
			"status", recorder.status,
			"duration_ms", time.Since(startedAt).Milliseconds(),
		)
	})
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(status int) {
	if status < 100 {
		status = http.StatusInternalServerError
	}

	r.status = status
	r.ResponseWriter.WriteHeader(status)
}

func (r *statusRecorder) Write(payload []byte) (int, error) {
	if r.status == 0 {
		return 0, errors.New("response status is unset")
	}

	return r.ResponseWriter.Write(payload)
}
