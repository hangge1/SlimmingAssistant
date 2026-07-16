package sqlite

import (
	"context"
	"database/sql"
	"path/filepath"
	"testing"
	"time"

	"resetlife/server/internal/auth"
)

func TestAuthRepositoryResolvesActiveSessionAndTouchesLastSeen(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	db := openTestDB(t)
	repository := AuthRepository{DB: db}
	now := time.Date(2026, 7, 15, 0, 0, 0, 0, time.UTC)
	expiresAt := now.Add(24 * time.Hour)
	displayName := "管理员"
	token := "session-token"
	tokenHash := auth.HashSessionToken(token)

	insertUser(t, db, "user-1", "admin", displayName, "admin", "")
	insertSession(t, db, "session-1", "user-1", tokenHash, now.Add(-time.Hour), expiresAt, "")

	session, err := repository.FindActiveSessionByHash(ctx, tokenHash, now)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if session == nil || session.UserID != "user-1" {
		t.Fatalf("unexpected session %#v", session)
	}

	var lastSeenAtIso string
	if err := db.QueryRowContext(ctx, "select last_seen_at_iso from user_sessions where id = ?", "session-1").Scan(&lastSeenAtIso); err != nil {
		t.Fatalf("read last_seen_at_iso: %v", err)
	}
	if lastSeenAtIso != now.Format(time.RFC3339) {
		t.Fatalf("expected last seen %q, got %q", now.Format(time.RFC3339), lastSeenAtIso)
	}

	user, err := repository.GetActiveUserByID(ctx, "user-1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if user == nil || user.Username != "admin" || user.Role != auth.RoleAdmin {
		t.Fatalf("unexpected user %#v", user)
	}
	if user.DisplayName == nil || *user.DisplayName != displayName {
		t.Fatalf("unexpected display name %#v", user.DisplayName)
	}
}

func TestAuthRepositoryHidesExpiredRevokedAndDisabledRecords(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	db := openTestDB(t)
	repository := AuthRepository{DB: db}
	now := time.Date(2026, 7, 15, 0, 0, 0, 0, time.UTC)

	insertUser(t, db, "active", "active", "", "user", "")
	insertUser(t, db, "disabled", "disabled", "", "user", now.Add(-time.Hour).Format(time.RFC3339))
	insertSession(t, db, "expired", "active", "expired-hash", now.Add(-2*time.Hour), now, "")
	insertSession(t, db, "revoked", "active", "revoked-hash", now.Add(-2*time.Hour), now.Add(time.Hour), now.Add(-time.Hour).Format(time.RFC3339))

	if session, err := repository.FindActiveSessionByHash(ctx, "expired-hash", now); err != nil || session != nil {
		t.Fatalf("expected expired session to be hidden, session=%#v err=%v", session, err)
	}
	if session, err := repository.FindActiveSessionByHash(ctx, "revoked-hash", now); err != nil || session != nil {
		t.Fatalf("expected revoked session to be hidden, session=%#v err=%v", session, err)
	}
	if user, err := repository.GetActiveUserByID(ctx, "disabled"); err != nil || user != nil {
		t.Fatalf("expected disabled user to be hidden, user=%#v err=%v", user, err)
	}
}

func TestAuthRepositoryFindsUserByUsernameAndCreatesRevokesSession(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	db := openTestDB(t)
	repository := AuthRepository{DB: db}
	now := time.Date(2026, 7, 15, 0, 0, 0, 0, time.UTC)
	expiresAt := now.Add(auth.SessionMaxAge)

	insertUser(t, db, "user-1", "admin", "Admin", "admin", "")

	user, err := repository.GetActiveUserByUsername(ctx, "admin")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if user == nil || user.ID != "user-1" || user.PasswordHash != "hash" {
		t.Fatalf("unexpected user %#v", user)
	}

	session, err := repository.CreateSession(ctx, auth.CreateSessionInput{
		UserID:           "user-1",
		SessionTokenHash: "token-hash",
		Now:              now,
		ExpiresAt:        expiresAt,
	})
	if err != nil {
		t.Fatalf("create session: %v", err)
	}
	if session == nil || session.ID == "" || session.ExpiresAt != expiresAt {
		t.Fatalf("unexpected session %#v", session)
	}

	found, err := repository.FindActiveSessionByHash(ctx, "token-hash", now)
	if err != nil {
		t.Fatalf("find active session: %v", err)
	}
	if found == nil || found.UserID != "user-1" {
		t.Fatalf("unexpected found session %#v", found)
	}

	if err := repository.RevokeSessionByHash(ctx, "token-hash", now.Add(time.Minute)); err != nil {
		t.Fatalf("revoke session: %v", err)
	}
	found, err = repository.FindActiveSessionByHash(ctx, "token-hash", now.Add(2*time.Minute))
	if err != nil {
		t.Fatalf("find revoked session: %v", err)
	}
	if found != nil {
		t.Fatalf("expected revoked session to be hidden, got %#v", found)
	}
}

func TestAuthRepositoryCountsAndCreatesUsers(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	db := openTestDB(t)
	repository := AuthRepository{DB: db}
	now := time.Date(2026, 7, 15, 0, 0, 0, 0, time.UTC)
	displayName := "Administrator"

	count, err := repository.CountActiveUsers(ctx)
	if err != nil {
		t.Fatalf("count users: %v", err)
	}
	if count != 0 {
		t.Fatalf("expected empty database, got %d users", count)
	}

	user, err := repository.CreateUser(ctx, auth.CreateUserInput{
		Username:              "admin",
		DisplayName:           &displayName,
		Role:                  auth.RoleAdmin,
		PasswordHash:          "hash-value",
		PasswordHashAlgorithm: auth.PasswordHashAlgorithm,
		Now:                   now,
	})
	if err != nil {
		t.Fatalf("create user: %v", err)
	}
	if user == nil || user.ID == "" || user.Username != "admin" || user.Role != auth.RoleAdmin || user.PasswordHash != "hash-value" {
		t.Fatalf("unexpected user %#v", user)
	}
	if user.DisplayName == nil || *user.DisplayName != displayName {
		t.Fatalf("unexpected display name %#v", user.DisplayName)
	}

	count, err = repository.CountActiveUsers(ctx)
	if err != nil {
		t.Fatalf("count users after create: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected one active user, got %d", count)
	}
}

func TestAuthRepositoryManagesUsersAndSessions(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	db := openTestDB(t)
	repository := AuthRepository{DB: db}
	now := time.Date(2026, 7, 15, 0, 0, 0, 0, time.UTC)

	insertUser(t, db, "admin-1", "admin", "Admin", "admin", "")
	insertUser(t, db, "user-1", "runner", "Runner", "user", "")
	insertSession(t, db, "session-1", "user-1", "token-hash", now.Add(-time.Hour), now.Add(time.Hour), "")

	adminCount, err := repository.CountActiveAdmins(ctx)
	if err != nil {
		t.Fatalf("count active admins: %v", err)
	}
	if adminCount != 1 {
		t.Fatalf("expected one active admin, got %d", adminCount)
	}

	users, err := repository.ListUsers(ctx)
	if err != nil {
		t.Fatalf("list users: %v", err)
	}
	if len(users) != 2 {
		t.Fatalf("expected two users, got %#v", users)
	}

	displayName := "Runner Updated"
	updated, err := repository.UpdateUser(ctx, auth.UpdateUserInput{
		UserID:      "user-1",
		DisplayName: &displayName,
		Role:        auth.RoleAdmin,
		Now:         now,
	})
	if err != nil {
		t.Fatalf("update user: %v", err)
	}
	if updated == nil || updated.Role != auth.RoleAdmin || updated.DisplayName == nil || *updated.DisplayName != displayName {
		t.Fatalf("unexpected updated user %#v", updated)
	}

	if err := repository.UpdateUserPassword(ctx, auth.UpdateUserPasswordInput{
		UserID:                "user-1",
		PasswordHash:          "new-hash",
		PasswordHashAlgorithm: auth.PasswordHashAlgorithm,
		Now:                   now,
	}); err != nil {
		t.Fatalf("update password: %v", err)
	}

	var passwordHash string
	if err := db.QueryRowContext(ctx, "select password_hash from users where id = ?", "user-1").Scan(&passwordHash); err != nil {
		t.Fatalf("read password hash: %v", err)
	}
	if passwordHash != "new-hash" {
		t.Fatalf("expected password hash update, got %q", passwordHash)
	}

	if err := repository.RevokeUserSessions(ctx, "user-1", now); err != nil {
		t.Fatalf("revoke user sessions: %v", err)
	}
	if session, err := repository.FindActiveSessionByHash(ctx, "token-hash", now.Add(time.Minute)); err != nil || session != nil {
		t.Fatalf("expected session revoked, session=%#v err=%v", session, err)
	}

	disabled, err := repository.DisableUser(ctx, "user-1", now)
	if err != nil {
		t.Fatalf("disable user: %v", err)
	}
	if disabled == nil || disabled.DisabledAtIso == nil || *disabled.DisabledAtIso != now.Format(time.RFC3339) {
		t.Fatalf("unexpected disabled user %#v", disabled)
	}
}

func openTestDB(t *testing.T) *sql.DB {
	t.Helper()

	db, err := Open(context.Background(), filepath.Join(t.TempDir(), "test.sqlite"))
	if err != nil {
		t.Fatalf("open test sqlite: %v", err)
	}
	t.Cleanup(func() {
		if err := db.Close(); err != nil {
			t.Fatalf("close test sqlite: %v", err)
		}
	})

	return db
}

func insertUser(t *testing.T, db *sql.DB, id string, username string, displayName string, role string, disabledAtIso string) {
	t.Helper()

	var displayValue any
	if displayName != "" {
		displayValue = displayName
	}

	var disabledValue any
	if disabledAtIso != "" {
		disabledValue = disabledAtIso
	}

	_, err := db.Exec(`
		insert into users (
			id, username, display_name, role, password_hash, password_hash_algorithm,
			created_at_iso, updated_at_iso, disabled_at_iso
		) values (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, id, username, displayValue, role, "hash", "test", time.Now().UTC().Format(time.RFC3339), time.Now().UTC().Format(time.RFC3339), disabledValue)
	if err != nil {
		t.Fatalf("insert user: %v", err)
	}
}

func insertSession(t *testing.T, db *sql.DB, id string, userID string, tokenHash string, createdAt time.Time, expiresAt time.Time, revokedAtIso string) {
	t.Helper()

	var revokedValue any
	if revokedAtIso != "" {
		revokedValue = revokedAtIso
	}

	_, err := db.Exec(`
		insert into user_sessions (
			id, user_id, session_token_hash, created_at_iso, last_seen_at_iso, expires_at_iso, revoked_at_iso
		) values (?, ?, ?, ?, ?, ?, ?)
	`, id, userID, tokenHash, createdAt.UTC().Format(time.RFC3339), createdAt.UTC().Format(time.RFC3339), expiresAt.UTC().Format(time.RFC3339), revokedValue)
	if err != nil {
		t.Fatalf("insert session: %v", err)
	}
}
