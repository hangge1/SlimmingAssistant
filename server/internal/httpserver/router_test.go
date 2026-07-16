package httpserver

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"resetlife/server/internal/auth"
	"resetlife/server/internal/settings"
	"resetlife/server/internal/slimming"
)

func TestHealthRoutesReturnStableJSON(t *testing.T) {
	t.Parallel()

	router := testRouter()

	for _, path := range []string{"/healthz", "/healthz/", "/api/healthz", "/api/healthz/"} {
		t.Run(path, func(t *testing.T) {
			t.Parallel()

			response := httptest.NewRecorder()
			request := httptest.NewRequest(http.MethodGet, path, nil)

			router.ServeHTTP(response, request)

			if response.Code != http.StatusOK {
				t.Fatalf("expected status 200, got %d", response.Code)
			}

			var payload healthResponse
			if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
				t.Fatalf("decode response: %v", err)
			}

			if !payload.OK {
				t.Fatal("expected ok=true")
			}
			if payload.Service != serviceName {
				t.Fatalf("expected service %q, got %q", serviceName, payload.Service)
			}
			if payload.Timestamp != "2026-07-15T00:00:00Z" {
				t.Fatalf("unexpected timestamp %q", payload.Timestamp)
			}
			if got := response.Header().Get("Content-Type"); got != "application/json; charset=utf-8" {
				t.Fatalf("unexpected content type %q", got)
			}
		})
	}
}

func TestVersionRoute(t *testing.T) {
	t.Parallel()

	response := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/version", nil)

	testRouter().ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", response.Code)
	}

	var payload versionResponse
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}

	if payload.Service != serviceName {
		t.Fatalf("expected service %q, got %q", serviceName, payload.Service)
	}
	if payload.Version != serviceVersion {
		t.Fatalf("expected version %q, got %q", serviceVersion, payload.Version)
	}
}

func TestUnknownRouteReturnsJSONNotFound(t *testing.T) {
	t.Parallel()

	response := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/missing", nil)

	testRouter().ServeHTTP(response, request)

	assertErrorResponse(t, response, http.StatusNotFound, "not_found")
}

func TestKnownRouteWithWrongMethodReturnsJSONMethodNotAllowed(t *testing.T) {
	t.Parallel()

	response := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/healthz", nil)

	testRouter().ServeHTTP(response, request)

	assertErrorResponse(t, response, http.StatusMethodNotAllowed, "method_not_allowed")
}

func TestRouterCanServeStaticAstroBuild(t *testing.T) {
	t.Parallel()

	staticDir := t.TempDir()
	if err := os.WriteFile(filepath.Join(staticDir, "index.html"), []byte("<html>home</html>"), 0o644); err != nil {
		t.Fatalf("write index: %v", err)
	}
	if err := os.MkdirAll(filepath.Join(staticDir, "projects", "slimming"), 0o755); err != nil {
		t.Fatalf("make nested dir: %v", err)
	}
	if err := os.WriteFile(filepath.Join(staticDir, "projects", "slimming", "index.html"), []byte("<html>project</html>"), 0o644); err != nil {
		t.Fatalf("write nested index: %v", err)
	}

	router := NewRouter(RouterConfig{
		Logger:    slog.New(slog.NewTextHandler(io.Discard, nil)),
		StaticDir: staticDir,
	})

	for _, tc := range []struct {
		path string
		body string
	}{
		{path: "/", body: "home"},
		{path: "/projects/slimming", body: "project"},
		{path: "/unknown-route", body: "home"},
	} {
		response := httptest.NewRecorder()
		request := httptest.NewRequest(http.MethodGet, tc.path, nil)

		router.ServeHTTP(response, request)

		if response.Code != http.StatusOK {
			t.Fatalf("expected status 200 for %s, got %d", tc.path, response.Code)
		}
		if !strings.Contains(response.Body.String(), tc.body) {
			t.Fatalf("expected body %q for %s, got %q", tc.body, tc.path, response.Body.String())
		}
	}

	apiMissing := httptest.NewRecorder()
	router.ServeHTTP(apiMissing, httptest.NewRequest(http.MethodGet, "/api/missing", nil))
	assertErrorResponse(t, apiMissing, http.StatusNotFound, "not_found")
}

func TestSessionRouteReturnsUnauthenticatedWithoutCookie(t *testing.T) {
	t.Parallel()

	response := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/auth/session", nil)

	testRouter().ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", response.Code)
	}

	var payload sessionResponse
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if payload.Authenticated {
		t.Fatal("expected unauthenticated session")
	}
	if payload.User != nil {
		t.Fatalf("expected nil user, got %#v", payload.User)
	}
}

func TestSessionRouteReturnsUnauthenticatedWithoutCookieEvenWhenResolverIsUnavailable(t *testing.T) {
	t.Parallel()

	response := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/auth/session", nil)

	NewRouter(RouterConfig{Logger: slog.New(slog.NewTextHandler(io.Discard, nil))}).ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", response.Code)
	}

	var payload sessionResponse
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if payload.Authenticated {
		t.Fatal("expected unauthenticated session")
	}
}

func TestSessionRouteReturnsUserContext(t *testing.T) {
	t.Parallel()

	displayName := "管理员"
	response := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/auth/session", nil)
	request.AddCookie(&http.Cookie{Name: auth.UserSessionCookieName, Value: "session-token"})

	NewRouter(RouterConfig{
		Logger: slog.New(slog.NewTextHandler(io.Discard, nil)),
		AuthResolver: &auth.Resolver{
			Repository: &fakeAuthRepository{
				session: &auth.Session{ID: "session-1", UserID: "user-1"},
				user: &auth.User{
					ID:          "user-1",
					Username:    "admin",
					DisplayName: &displayName,
					Role:        auth.RoleAdmin,
				},
			},
		},
	}).ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", response.Code)
	}

	var payload sessionResponse
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if !payload.Authenticated {
		t.Fatal("expected authenticated session")
	}
	if payload.User == nil || payload.User.UserID != "user-1" || payload.User.Role != auth.RoleAdmin {
		t.Fatalf("unexpected user payload %#v", payload.User)
	}
}

func TestSessionRouteReturnsServiceUnavailableWithoutResolver(t *testing.T) {
	t.Parallel()

	response := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/auth/session", nil)
	request.AddCookie(&http.Cookie{Name: auth.UserSessionCookieName, Value: "session-token"})

	NewRouter(RouterConfig{Logger: slog.New(slog.NewTextHandler(io.Discard, nil))}).ServeHTTP(response, request)

	assertErrorResponse(t, response, http.StatusServiceUnavailable, "auth_unavailable")
}

func TestSetupStatusRouteReportsNeedsInitialAdmin(t *testing.T) {
	t.Parallel()

	response := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/auth/setup", nil)

	NewRouter(RouterConfig{
		Logger:       slog.New(slog.NewTextHandler(io.Discard, nil)),
		AdminService: &auth.AdminService{Repository: &fakeAdminRepository{}},
	}).ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", response.Code)
	}
	var payload setupResponse
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if !payload.NeedsInitialAdmin {
		t.Fatalf("expected setup to be needed, got %#v", payload)
	}
}

func TestSetupRouteCreatesInitialAdminAndSetsCookie(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 7, 15, 0, 0, 0, 0, time.UTC)
	repository := &fakeAdminRepository{}
	response := httptest.NewRecorder()
	request := httptest.NewRequest(
		http.MethodPost,
		"/api/auth/setup",
		strings.NewReader(`{"username":"admin","displayName":"Admin","password":"password123","confirmPassword":"password123"}`),
	)

	NewRouter(RouterConfig{
		Logger: slog.New(slog.NewTextHandler(io.Discard, nil)),
		AdminService: &auth.AdminService{
			Repository: repository,
			Clock: func() time.Time {
				return now
			},
		},
	}).ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", response.Code, response.Body.String())
	}
	if repository.createdUser == nil || repository.createdUser.Username != "admin" {
		t.Fatalf("expected user to be created, got %#v", repository.createdUser)
	}
	cookies := response.Result().Cookies()
	if len(cookies) != 1 || cookies[0].Name != auth.UserSessionCookieName || cookies[0].Value == "" {
		t.Fatalf("unexpected cookies %#v", cookies)
	}
}

func TestSetupRouteRejectsWhenAdminExists(t *testing.T) {
	t.Parallel()

	response := httptest.NewRecorder()
	request := httptest.NewRequest(
		http.MethodPost,
		"/api/auth/setup",
		strings.NewReader(`{"username":"admin","password":"password123","confirmPassword":"password123"}`),
	)

	NewRouter(RouterConfig{
		Logger:       slog.New(slog.NewTextHandler(io.Discard, nil)),
		AdminService: &auth.AdminService{Repository: &fakeAdminRepository{activeUsers: 1}},
	}).ServeHTTP(response, request)

	if response.Code != http.StatusUnauthorized {
		t.Fatalf("expected status 401, got %d", response.Code)
	}
	var payload authFailureResponse
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if payload.Form != "admin_already_exists" {
		t.Fatalf("unexpected payload %#v", payload)
	}
}

func TestLoginRouteSetsSessionCookie(t *testing.T) {
	t.Parallel()

	displayName := "Admin"
	now := time.Date(2026, 7, 15, 0, 0, 0, 0, time.UTC)
	repository := &fakeLoginRepository{
		user: &auth.User{
			ID:           "user-1",
			Username:     "admin",
			DisplayName:  &displayName,
			Role:         auth.RoleAdmin,
			PasswordHash: "scrypt:v1:16384:8:1:MDEyMzQ1Njc4OWFiY2RlZg:tjK03tRvEjqCcPwmgtddMkgjlXrk8U_b9rIvfeBMKCcxlckVogBtTKwjk3CpCcSQhX0X2CBkh7x8-hWN0EaASQ",
		},
	}
	response := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/auth/login", strings.NewReader(`{"username":"admin","password":"correct horse battery staple"}`))

	NewRouter(RouterConfig{
		Logger: slog.New(slog.NewTextHandler(io.Discard, nil)),
		LoginService: &auth.LoginService{
			Repository: repository,
			Clock: func() time.Time {
				return now
			},
		},
	}).ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", response.Code, response.Body.String())
	}
	cookies := response.Result().Cookies()
	if len(cookies) != 1 || cookies[0].Name != auth.UserSessionCookieName || cookies[0].Value == "" {
		t.Fatalf("unexpected cookies %#v", cookies)
	}
	if cookies[0].MaxAge != int(auth.SessionMaxAge.Seconds()) || !cookies[0].HttpOnly {
		t.Fatalf("unexpected session cookie %#v", cookies[0])
	}

	var payload loginResponse
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if !payload.Authenticated || payload.User.UserID != "user-1" || payload.ExpiresAt != now.Add(auth.SessionMaxAge).Format(time.RFC3339) {
		t.Fatalf("unexpected login payload %#v", payload)
	}
	if repository.createdSession == nil {
		t.Fatal("expected session to be created")
	}
}

func TestLoginRouteRejectsInvalidCredentials(t *testing.T) {
	t.Parallel()

	response := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/auth/login", strings.NewReader(`{"username":"admin","password":"wrong"}`))

	NewRouter(RouterConfig{
		Logger: slog.New(slog.NewTextHandler(io.Discard, nil)),
		LoginService: &auth.LoginService{
			Repository: &fakeLoginRepository{
				user: &auth.User{
					ID:           "user-1",
					Username:     "admin",
					Role:         auth.RoleAdmin,
					PasswordHash: "scrypt:v1:16384:8:1:MDEyMzQ1Njc4OWFiY2RlZg:tjK03tRvEjqCcPwmgtddMkgjlXrk8U_b9rIvfeBMKCcxlckVogBtTKwjk3CpCcSQhX0X2CBkh7x8-hWN0EaASQ",
				},
			},
		},
	}).ServeHTTP(response, request)

	if response.Code != http.StatusUnauthorized {
		t.Fatalf("expected status 401, got %d", response.Code)
	}
	var payload authFailureResponse
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if payload.OK || payload.Form != "invalid_credentials" {
		t.Fatalf("unexpected payload %#v", payload)
	}
}

func TestAdminUsersRoutesRequireAdminAndCreateUser(t *testing.T) {
	t.Parallel()

	response := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/admin/users", strings.NewReader(`{"username":"runner","displayName":"Runner","role":"user","password":"password123","confirmPassword":"password123"}`))
	request.AddCookie(&http.Cookie{Name: auth.UserSessionCookieName, Value: "session-token"})
	repository := &fakeAdminRepository{activeUsers: 1, activeAdmins: 1}

	NewRouter(RouterConfig{
		Logger: slog.New(slog.NewTextHandler(io.Discard, nil)),
		AuthResolver: &auth.Resolver{
			Repository: &fakeAuthRepository{
				session: &auth.Session{ID: "session-1", UserID: "admin-1"},
				user:    &auth.User{ID: "admin-1", Username: "admin", Role: auth.RoleAdmin},
			},
		},
		AdminService: &auth.AdminService{Repository: repository},
	}).ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d body=%s", response.Code, response.Body.String())
	}
	if repository.createdUser == nil || repository.createdUser.Username != "runner" || repository.createdUser.Role != auth.RoleUser {
		t.Fatalf("expected created user input, got %#v", repository.createdUser)
	}

	var payload auth.ManagedUser
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if payload.Username != "runner" || payload.Role != auth.RoleUser {
		t.Fatalf("unexpected payload %#v", payload)
	}

	forbidden := httptest.NewRecorder()
	forbiddenRequest := httptest.NewRequest(http.MethodGet, "/api/admin/users", nil)
	forbiddenRequest.AddCookie(&http.Cookie{Name: auth.UserSessionCookieName, Value: "session-token"})
	NewRouter(RouterConfig{
		Logger: slog.New(slog.NewTextHandler(io.Discard, nil)),
		AuthResolver: &auth.Resolver{
			Repository: &fakeAuthRepository{
				session: &auth.Session{ID: "session-1", UserID: "user-1"},
				user:    &auth.User{ID: "user-1", Username: "runner", Role: auth.RoleUser},
			},
		},
		AdminService: &auth.AdminService{Repository: repository},
	}).ServeHTTP(forbidden, forbiddenRequest)
	assertErrorResponse(t, forbidden, http.StatusForbidden, "admin_required")
}

func TestLogoutRouteRevokesAndClearsSessionCookie(t *testing.T) {
	t.Parallel()

	repository := &fakeLoginRepository{}
	response := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/auth/logout", nil)
	request.AddCookie(&http.Cookie{Name: auth.UserSessionCookieName, Value: "session-token"})

	NewRouter(RouterConfig{
		Logger:       slog.New(slog.NewTextHandler(io.Discard, nil)),
		LoginService: &auth.LoginService{Repository: repository},
	}).ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", response.Code)
	}
	if repository.revokedHash != auth.HashSessionToken("session-token") {
		t.Fatalf("unexpected revoked hash %q", repository.revokedHash)
	}
	cookies := response.Result().Cookies()
	if len(cookies) != 1 || cookies[0].Name != auth.UserSessionCookieName || cookies[0].MaxAge != -1 {
		t.Fatalf("unexpected cookies %#v", cookies)
	}
}

func TestSlimmingSummaryRequiresAuthenticatedSession(t *testing.T) {
	t.Parallel()

	response := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/slimming/summary", nil)

	testRouter().ServeHTTP(response, request)

	assertErrorResponse(t, response, http.StatusUnauthorized, "unauthenticated")
}

func TestSlimmingSummaryReturnsUserScopedPayload(t *testing.T) {
	t.Parallel()

	response := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/slimming/summary", nil)
	request.AddCookie(&http.Cookie{Name: auth.UserSessionCookieName, Value: "session-token"})

	NewRouter(RouterConfig{
		Logger: slog.New(slog.NewTextHandler(io.Discard, nil)),
		AuthResolver: &auth.Resolver{
			Repository: &fakeAuthRepository{
				session: &auth.Session{ID: "session-1", UserID: "user-1"},
				user:    &auth.User{ID: "user-1", Username: "admin", Role: auth.RoleAdmin},
			},
		},
		SlimmingService: &slimming.Service{
			Repository: &fakeSlimmingRepository{
				summary: &slimming.Summary{
					TodayRun: slimming.RunAggregate{LocalDate: "2026-07-15", Count: 2, DistanceKm: 8.5},
				},
			},
			Clock: func() time.Time {
				return time.Date(2026, 7, 15, 0, 0, 0, 0, time.UTC)
			},
		},
	}).ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", response.Code)
	}
	var payload slimming.Summary
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if payload.TodayRun.Count != 2 || payload.TodayRun.DistanceKm != 8.5 {
		t.Fatalf("unexpected summary %#v", payload)
	}
}

func TestSaveHealthRecordRouteRequiresAuthenticatedSession(t *testing.T) {
	t.Parallel()

	response := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/slimming/records/health", strings.NewReader(`{}`))

	testRouter().ServeHTTP(response, request)

	assertErrorResponse(t, response, http.StatusUnauthorized, "unauthenticated")
}

func TestSaveHealthRecordRouteReturnsSavedRecord(t *testing.T) {
	t.Parallel()

	repository := &fakeSlimmingRepository{}
	response := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/slimming/records/health", strings.NewReader(`{"localDate":"2026-07-15","weightKg":"81.8","waistCm":"90.4"}`))
	request.AddCookie(&http.Cookie{Name: auth.UserSessionCookieName, Value: "session-token"})

	NewRouter(RouterConfig{
		Logger: slog.New(slog.NewTextHandler(io.Discard, nil)),
		AuthResolver: &auth.Resolver{
			Repository: &fakeAuthRepository{
				session: &auth.Session{ID: "session-1", UserID: "user-1"},
				user:    &auth.User{ID: "user-1", Username: "admin", Role: auth.RoleAdmin},
			},
		},
		SlimmingService: &slimming.Service{Repository: repository},
	}).ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", response.Code, response.Body.String())
	}
	if repository.healthInput == nil || repository.healthInput.UserID != "user-1" {
		t.Fatalf("expected health input for user-1, got %#v", repository.healthInput)
	}
	var payload slimming.HealthRecord
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if payload.LocalDate != "2026-07-15" || payload.WeightKg == nil || *payload.WeightKg != 81.8 {
		t.Fatalf("unexpected payload %#v", payload)
	}
}

func TestSlimmingHistoryRouteReturnsMergedEntries(t *testing.T) {
	t.Parallel()

	repository := &fakeSlimmingRepository{
		healthRecords: []slimming.HealthRecord{
			{ID: "health-1", LocalDate: "2026-07-15", CreatedAtIso: "2026-07-15T08:00:00Z"},
		},
		runRecords: []slimming.RunRecord{
			{ID: "run-1", LocalDate: "2026-07-15", DistanceKm: 5, CreatedAtIso: "2026-07-15T09:00:00Z"},
		},
	}
	response := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/slimming/history?type=all&range=last7&todayLocalDate=2026-07-15", nil)
	request.AddCookie(&http.Cookie{Name: auth.UserSessionCookieName, Value: "session-token"})

	NewRouter(RouterConfig{
		Logger: slog.New(slog.NewTextHandler(io.Discard, nil)),
		AuthResolver: &auth.Resolver{
			Repository: &fakeAuthRepository{
				session: &auth.Session{ID: "session-1", UserID: "user-1"},
				user:    &auth.User{ID: "user-1", Username: "admin", Role: auth.RoleAdmin},
			},
		},
		SlimmingService: &slimming.Service{Repository: repository},
	}).ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", response.Code, response.Body.String())
	}
	var payload slimming.HistoryResponse
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(payload.Entries) != 2 || payload.Entries[0].ID != "run-1" || payload.Entries[1].ID != "health-1" {
		t.Fatalf("unexpected history payload %#v", payload)
	}
}

func TestUpdateHealthRecordRouteReturnsUpdatedRecord(t *testing.T) {
	t.Parallel()

	repository := &fakeSlimmingRepository{}
	response := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/slimming/records/health/update", strings.NewReader(`{"id":"health-1","localDate":"2026-07-15","weightKg":"81.8"}`))
	request.AddCookie(&http.Cookie{Name: auth.UserSessionCookieName, Value: "session-token"})

	NewRouter(RouterConfig{
		Logger: slog.New(slog.NewTextHandler(io.Discard, nil)),
		AuthResolver: &auth.Resolver{
			Repository: &fakeAuthRepository{
				session: &auth.Session{ID: "session-1", UserID: "user-1"},
				user:    &auth.User{ID: "user-1", Username: "admin", Role: auth.RoleAdmin},
			},
		},
		SlimmingService: &slimming.Service{Repository: repository},
	}).ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", response.Code, response.Body.String())
	}
	if repository.updatedHealth == nil || repository.updatedHealth.ID != "health-1" || repository.updatedHealth.UserID != "user-1" {
		t.Fatalf("unexpected update input %#v", repository.updatedHealth)
	}
}

func TestDeleteRecordRouteReturnsDeletedRecord(t *testing.T) {
	t.Parallel()

	repository := &fakeSlimmingRepository{}
	response := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/slimming/records/delete", strings.NewReader(`{"kind":"run","id":"run-1"}`))
	request.AddCookie(&http.Cookie{Name: auth.UserSessionCookieName, Value: "session-token"})

	NewRouter(RouterConfig{
		Logger: slog.New(slog.NewTextHandler(io.Discard, nil)),
		AuthResolver: &auth.Resolver{
			Repository: &fakeAuthRepository{
				session: &auth.Session{ID: "session-1", UserID: "user-1"},
				user:    &auth.User{ID: "user-1", Username: "admin", Role: auth.RoleAdmin},
			},
		},
		SlimmingService: &slimming.Service{Repository: repository},
	}).ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", response.Code, response.Body.String())
	}
	if repository.deletedRunID != "run-1" {
		t.Fatalf("expected run-1 to be deleted, got %q", repository.deletedRunID)
	}
}

func TestCreateRunRecordRouteReturnsFieldErrors(t *testing.T) {
	t.Parallel()

	response := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/slimming/records/runs", strings.NewReader(`{"localDate":"2026-07-15","durationMinutes":"30"}`))
	request.AddCookie(&http.Cookie{Name: auth.UserSessionCookieName, Value: "session-token"})

	NewRouter(RouterConfig{
		Logger: slog.New(slog.NewTextHandler(io.Discard, nil)),
		AuthResolver: &auth.Resolver{
			Repository: &fakeAuthRepository{
				session: &auth.Session{ID: "session-1", UserID: "user-1"},
				user:    &auth.User{ID: "user-1", Username: "admin", Role: auth.RoleAdmin},
			},
		},
		SlimmingService: &slimming.Service{Repository: &fakeSlimmingRepository{}},
	}).ServeHTTP(response, request)

	if response.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d", response.Code)
	}
	var payload authFailureResponse
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if payload.OK || payload.FieldErrors["distanceKm"] != "required" {
		t.Fatalf("unexpected payload %#v", payload)
	}
}

func TestSaveHealthGoalRouteReturnsSavedGoal(t *testing.T) {
	t.Parallel()

	repository := &fakeSlimmingRepository{}
	response := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/slimming/goals/health", strings.NewReader(`{"targetWeightKg":"75","targetWaistCm":"84","targetHipCm":"96","targetBodyFatPercentage":"18"}`))
	request.AddCookie(&http.Cookie{Name: auth.UserSessionCookieName, Value: "session-token"})

	NewRouter(RouterConfig{
		Logger: slog.New(slog.NewTextHandler(io.Discard, nil)),
		AuthResolver: &auth.Resolver{
			Repository: &fakeAuthRepository{
				session: &auth.Session{ID: "session-1", UserID: "user-1"},
				user:    &auth.User{ID: "user-1", Username: "admin", Role: auth.RoleAdmin},
			},
		},
		SlimmingService: &slimming.Service{Repository: repository},
	}).ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", response.Code, response.Body.String())
	}
	if repository.healthGoalInput == nil || repository.healthGoalInput.UserID != "user-1" {
		t.Fatalf("expected health goal input for user-1, got %#v", repository.healthGoalInput)
	}
	var payload slimming.HealthGoal
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if payload.TargetWeightKg == nil || *payload.TargetWeightKg != 75 {
		t.Fatalf("unexpected payload %#v", payload)
	}
}

func TestSaveRunGoalRouteReturnsFieldErrors(t *testing.T) {
	t.Parallel()

	response := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/slimming/goals/run", strings.NewReader(`{"weeklyRunCount":"1.5","weeklyDistanceKm":""}`))
	request.AddCookie(&http.Cookie{Name: auth.UserSessionCookieName, Value: "session-token"})

	NewRouter(RouterConfig{
		Logger: slog.New(slog.NewTextHandler(io.Discard, nil)),
		AuthResolver: &auth.Resolver{
			Repository: &fakeAuthRepository{
				session: &auth.Session{ID: "session-1", UserID: "user-1"},
				user:    &auth.User{ID: "user-1", Username: "admin", Role: auth.RoleAdmin},
			},
		},
		SlimmingService: &slimming.Service{Repository: &fakeSlimmingRepository{}},
	}).ServeHTTP(response, request)

	if response.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d", response.Code)
	}
	var payload authFailureResponse
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if payload.OK || payload.FieldErrors["weeklyRunCount"] != "range" || payload.FieldErrors["weeklyDistanceKm"] != "required" {
		t.Fatalf("unexpected payload %#v", payload)
	}
}

func TestProfileRouteRequiresAuthenticatedSession(t *testing.T) {
	t.Parallel()

	response := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/settings/profile", nil)

	testRouter().ServeHTTP(response, request)

	assertErrorResponse(t, response, http.StatusUnauthorized, "unauthenticated")
}

func TestSaveProfileRouteReturnsSavedProfile(t *testing.T) {
	t.Parallel()

	repository := &fakeSettingsRepository{}
	response := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/settings/profile", strings.NewReader(`{"nickname":"Admin","heightCm":"178.5","reminderEmail":"admin@example.com"}`))
	request.AddCookie(&http.Cookie{Name: auth.UserSessionCookieName, Value: "session-token"})

	NewRouter(RouterConfig{
		Logger: slog.New(slog.NewTextHandler(io.Discard, nil)),
		AuthResolver: &auth.Resolver{
			Repository: &fakeAuthRepository{
				session: &auth.Session{ID: "session-1", UserID: "user-1"},
				user:    &auth.User{ID: "user-1", Username: "admin", Role: auth.RoleAdmin},
			},
		},
		SettingsService: &settings.Service{Repository: repository},
	}).ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", response.Code, response.Body.String())
	}
	if repository.saved == nil || repository.saved.UserID != "user-1" {
		t.Fatalf("unexpected saved input %#v", repository.saved)
	}
	var payload settings.Profile
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if payload.Nickname != "Admin" || payload.HeightCm == nil || *payload.HeightCm != 178.5 {
		t.Fatalf("unexpected profile payload %#v", payload)
	}
}

func TestSmtpConfigRouteRequiresAdmin(t *testing.T) {
	t.Parallel()

	response := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/settings/smtp", nil)
	request.AddCookie(&http.Cookie{Name: auth.UserSessionCookieName, Value: "session-token"})

	NewRouter(RouterConfig{
		Logger: slog.New(slog.NewTextHandler(io.Discard, nil)),
		AuthResolver: &auth.Resolver{
			Repository: &fakeAuthRepository{
				session: &auth.Session{ID: "session-1", UserID: "user-1"},
				user:    &auth.User{ID: "user-1", Username: "user", Role: auth.RoleUser},
			},
		},
		SettingsService: &settings.Service{Repository: &fakeSettingsRepository{}},
	}).ServeHTTP(response, request)

	assertErrorResponse(t, response, http.StatusForbidden, "admin_required")
}

func TestSaveSmtpConfigRouteReturnsPublicConfig(t *testing.T) {
	t.Parallel()

	repository := &fakeSettingsRepository{}
	response := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/settings/smtp", strings.NewReader(`{"host":"smtp.example.com","port":"465","username":"mailer","password":"secret","fromEmail":"from@example.com","secureMode":"ssl"}`))
	request.AddCookie(&http.Cookie{Name: auth.UserSessionCookieName, Value: "session-token"})

	NewRouter(RouterConfig{
		Logger: slog.New(slog.NewTextHandler(io.Discard, nil)),
		AuthResolver: &auth.Resolver{
			Repository: &fakeAuthRepository{
				session: &auth.Session{ID: "session-1", UserID: "user-1"},
				user:    &auth.User{ID: "user-1", Username: "admin", Role: auth.RoleAdmin},
			},
		},
		SettingsService: &settings.Service{Repository: repository},
	}).ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", response.Code, response.Body.String())
	}
	if repository.saved == nil || repository.saved.UserID != auth.DefaultAdminUserID {
		t.Fatalf("unexpected saved input %#v", repository.saved)
	}
	var payload map[string]any
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if payload["password"] != nil || payload["passwordConfigured"] != true {
		t.Fatalf("expected public smtp payload without password, got %#v", payload)
	}
}

func testRouter() http.Handler {
	return NewRouter(RouterConfig{
		Logger: slog.New(slog.NewTextHandler(io.Discard, nil)),
		Clock: func() time.Time {
			return time.Date(2026, 7, 15, 0, 0, 0, 0, time.UTC)
		},
		AuthResolver: &auth.Resolver{Repository: &fakeAuthRepository{}},
	})
}

func assertErrorResponse(t *testing.T, response *httptest.ResponseRecorder, status int, code string) {
	t.Helper()

	if response.Code != status {
		t.Fatalf("expected status %d, got %d", status, response.Code)
	}

	var payload errorResponse
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}

	if payload.OK {
		t.Fatal("expected ok=false")
	}
	if payload.Error != code {
		t.Fatalf("expected error %q, got %q", code, payload.Error)
	}
	if got := response.Header().Get("Content-Type"); got != "application/json; charset=utf-8" {
		t.Fatalf("unexpected content type %q", got)
	}
}

type fakeAuthRepository struct {
	session *auth.Session
	user    *auth.User
	err     error
}

func (r *fakeAuthRepository) FindActiveSessionByHash(context.Context, string, time.Time) (*auth.Session, error) {
	if r.err != nil {
		return nil, r.err
	}

	return r.session, nil
}

func (r *fakeAuthRepository) GetActiveUserByID(context.Context, string) (*auth.User, error) {
	if r.err != nil {
		return nil, r.err
	}

	return r.user, nil
}

type fakeLoginRepository struct {
	user           *auth.User
	createdSession *auth.CreateSessionInput
	revokedHash    string
}

func (r *fakeLoginRepository) GetActiveUserByUsername(context.Context, string) (*auth.User, error) {
	return r.user, nil
}

func (r *fakeLoginRepository) CreateSession(_ context.Context, input auth.CreateSessionInput) (*auth.Session, error) {
	r.createdSession = &input
	return &auth.Session{ID: "session-1", UserID: input.UserID, SessionTokenHash: input.SessionTokenHash, ExpiresAt: input.ExpiresAt}, nil
}

func (r *fakeLoginRepository) RevokeSessionByHash(_ context.Context, sessionTokenHash string, _ time.Time) error {
	r.revokedHash = sessionTokenHash
	return nil
}

type fakeAdminRepository struct {
	fakeLoginRepository
	activeUsers     int
	activeAdmins    int
	users           []auth.ManagedUser
	createdUser     *auth.CreateUserInput
	updatedUser     *auth.UpdateUserInput
	updatedPassword *auth.UpdateUserPasswordInput
	disabledUserID  string
	revokedUserID   string
}

func (r *fakeAdminRepository) CountActiveUsers(context.Context) (int, error) {
	return r.activeUsers, nil
}

func (r *fakeAdminRepository) CountActiveAdmins(context.Context) (int, error) {
	return r.activeAdmins, nil
}

func (r *fakeAdminRepository) ListUsers(context.Context) ([]auth.ManagedUser, error) {
	return r.users, nil
}

func (r *fakeAdminRepository) GetAnyUserByID(_ context.Context, userID string) (*auth.ManagedUser, error) {
	for index := range r.users {
		if r.users[index].ID == userID {
			return &r.users[index], nil
		}
	}
	return nil, nil
}

func (r *fakeAdminRepository) CreateUser(_ context.Context, input auth.CreateUserInput) (*auth.User, error) {
	r.createdUser = &input
	userID := "user-1"
	managed := auth.ManagedUser{
		ID:          userID,
		Username:    input.Username,
		DisplayName: input.DisplayName,
		Role:        input.Role,
	}
	r.users = append(r.users, managed)
	return &auth.User{
		ID:           userID,
		Username:     input.Username,
		DisplayName:  input.DisplayName,
		Role:         input.Role,
		PasswordHash: input.PasswordHash,
	}, nil
}

func (r *fakeAdminRepository) UpdateUser(_ context.Context, input auth.UpdateUserInput) (*auth.ManagedUser, error) {
	r.updatedUser = &input
	for index := range r.users {
		if r.users[index].ID == input.UserID {
			r.users[index].DisplayName = input.DisplayName
			r.users[index].Role = input.Role
			return &r.users[index], nil
		}
	}
	return nil, nil
}

func (r *fakeAdminRepository) UpdateUserPassword(_ context.Context, input auth.UpdateUserPasswordInput) error {
	r.updatedPassword = &input
	return nil
}

func (r *fakeAdminRepository) DisableUser(_ context.Context, userID string, now time.Time) (*auth.ManagedUser, error) {
	r.disabledUserID = userID
	disabledAtIso := now.UTC().Format(time.RFC3339)
	for index := range r.users {
		if r.users[index].ID == userID {
			r.users[index].DisabledAtIso = &disabledAtIso
			return &r.users[index], nil
		}
	}
	return nil, nil
}

func (r *fakeAdminRepository) RevokeUserSessions(_ context.Context, userID string, _ time.Time) error {
	r.revokedUserID = userID
	return nil
}

type fakeSlimmingRepository struct {
	summary         *slimming.Summary
	healthInput     *slimming.UpsertHealthRecordInput
	runInput        *slimming.CreateRunRecordInput
	updatedHealth   *slimming.UpdateHealthRecordInput
	updatedRun      *slimming.UpdateRunRecordInput
	deletedHealthID string
	deletedRunID    string
	healthRecords   []slimming.HealthRecord
	runRecords      []slimming.RunRecord
	healthGoalInput *slimming.SaveHealthGoalInput
	runGoalInput    *slimming.SaveRunGoalInput
}

func (r *fakeSlimmingRepository) GetSummary(context.Context, string, string) (*slimming.Summary, error) {
	return r.summary, nil
}

func (r *fakeSlimmingRepository) UpsertHealthRecord(_ context.Context, input slimming.UpsertHealthRecordInput) (*slimming.HealthRecord, error) {
	r.healthInput = &input
	return &slimming.HealthRecord{
		ID:        "health-1",
		LocalDate: input.LocalDate,
		WeightKg:  input.WeightKg,
		WaistCm:   input.WaistCm,
	}, nil
}

func (r *fakeSlimmingRepository) CreateRunRecord(_ context.Context, input slimming.CreateRunRecordInput) (*slimming.RunRecord, error) {
	r.runInput = &input
	return &slimming.RunRecord{
		ID:               "run-1",
		LocalDate:        input.LocalDate,
		DistanceKm:       input.DistanceKm,
		DurationSeconds:  input.DurationSeconds,
		PaceSecondsPerKm: input.PaceSecondsPerKm,
	}, nil
}

func (r *fakeSlimmingRepository) UpdateHealthRecord(_ context.Context, input slimming.UpdateHealthRecordInput) (*slimming.HealthRecord, error) {
	r.updatedHealth = &input
	return &slimming.HealthRecord{
		ID:        input.ID,
		LocalDate: input.LocalDate,
		WeightKg:  input.WeightKg,
		WaistCm:   input.WaistCm,
	}, nil
}

func (r *fakeSlimmingRepository) UpdateRunRecord(_ context.Context, input slimming.UpdateRunRecordInput) (*slimming.RunRecord, error) {
	r.updatedRun = &input
	return &slimming.RunRecord{
		ID:               input.ID,
		LocalDate:        input.LocalDate,
		DistanceKm:       input.DistanceKm,
		DurationSeconds:  input.DurationSeconds,
		PaceSecondsPerKm: input.PaceSecondsPerKm,
	}, nil
}

func (r *fakeSlimmingRepository) DeleteHealthRecord(_ context.Context, _ string, id string) (*slimming.HealthRecord, error) {
	r.deletedHealthID = id
	return &slimming.HealthRecord{ID: id, LocalDate: "2026-07-15"}, nil
}

func (r *fakeSlimmingRepository) DeleteRunRecord(_ context.Context, _ string, id string) (*slimming.RunRecord, error) {
	r.deletedRunID = id
	return &slimming.RunRecord{ID: id, LocalDate: "2026-07-15", DistanceKm: 5}, nil
}

func (r *fakeSlimmingRepository) ListHealthRecords(context.Context, string) ([]slimming.HealthRecord, error) {
	return r.healthRecords, nil
}

func (r *fakeSlimmingRepository) ListRunRecords(context.Context, string) ([]slimming.RunRecord, error) {
	return r.runRecords, nil
}

func (r *fakeSlimmingRepository) SaveHealthGoal(_ context.Context, input slimming.SaveHealthGoalInput) (*slimming.HealthGoal, error) {
	r.healthGoalInput = &input
	return &slimming.HealthGoal{
		TargetWeightKg:          &input.TargetWeightKg,
		TargetWaistCm:           input.TargetWaistCm,
		TargetHipCm:             input.TargetHipCm,
		TargetBodyFatPercentage: input.TargetBodyFatPercentage,
	}, nil
}

func (r *fakeSlimmingRepository) SaveRunGoal(_ context.Context, input slimming.SaveRunGoalInput) (*slimming.RunGoal, error) {
	r.runGoalInput = &input
	return &slimming.RunGoal{
		WeeklyRunCount:   &input.WeeklyRunCount,
		WeeklyDistanceKm: &input.WeeklyDistanceKm,
	}, nil
}

type fakeSettingsRepository struct {
	settings map[string]*settings.Setting
	saved    *settings.SaveSettingInput
}

func (r *fakeSettingsRepository) GetSetting(_ context.Context, _ string, settingType string, key string) (*settings.Setting, error) {
	return r.settings[settingType+"/"+key], nil
}

func (r *fakeSettingsRepository) SaveSetting(_ context.Context, input settings.SaveSettingInput) (*settings.Setting, error) {
	if r.settings == nil {
		r.settings = map[string]*settings.Setting{}
	}
	r.saved = &input
	setting := &settings.Setting{
		ID:        "setting-1",
		UserID:    input.UserID,
		Type:      input.Type,
		Key:       input.Key,
		ValueJSON: input.ValueJSON,
	}
	r.settings[input.Type+"/"+input.Key] = setting
	return setting, nil
}
