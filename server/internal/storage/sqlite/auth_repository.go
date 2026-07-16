package sqlite

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"resetlife/server/internal/auth"
)

type AuthRepository struct {
	DB *sql.DB
}

func (r AuthRepository) CountActiveUsers(ctx context.Context) (int, error) {
	row := r.DB.QueryRowContext(ctx, `
		select count(*)
		from users
		where disabled_at_iso is null
	`)

	var count int
	if err := row.Scan(&count); err != nil {
		return 0, fmt.Errorf("count active users: %w", err)
	}

	return count, nil
}

func (r AuthRepository) CountActiveAdmins(ctx context.Context) (int, error) {
	row := r.DB.QueryRowContext(ctx, `
		select count(*)
		from users
		where disabled_at_iso is null and role = 'admin'
	`)

	var count int
	if err := row.Scan(&count); err != nil {
		return 0, fmt.Errorf("count active admins: %w", err)
	}

	return count, nil
}

func (r AuthRepository) ListUsers(ctx context.Context) ([]auth.ManagedUser, error) {
	rows, err := r.DB.QueryContext(ctx, `
		select id, username, display_name, role, created_at_iso, updated_at_iso, disabled_at_iso
		from users
		order by created_at_iso desc
	`)
	if err != nil {
		return nil, fmt.Errorf("list users: %w", err)
	}
	defer rows.Close()

	users := make([]auth.ManagedUser, 0)
	for rows.Next() {
		user, err := scanManagedUser(rows)
		if err != nil {
			return nil, err
		}
		users = append(users, *user)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate users: %w", err)
	}

	return users, nil
}

func (r AuthRepository) GetAnyUserByID(ctx context.Context, userID string) (*auth.ManagedUser, error) {
	row := r.DB.QueryRowContext(ctx, `
		select id, username, display_name, role, created_at_iso, updated_at_iso, disabled_at_iso
		from users
		where id = ?
	`, userID)

	user, err := scanManagedUser(row)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("get any user: %w", err)
	}

	return user, nil
}

func (r AuthRepository) CreateUser(ctx context.Context, input auth.CreateUserInput) (*auth.User, error) {
	userID := uuid.NewString()
	nowIso := input.Now.UTC().Format(time.RFC3339)

	var displayName any
	if input.DisplayName != nil {
		displayName = *input.DisplayName
	}

	_, err := r.DB.ExecContext(ctx, `
		insert into users (
			id, username, display_name, role, password_hash, password_hash_algorithm,
			created_at_iso, updated_at_iso, disabled_at_iso
		) values (?, ?, ?, ?, ?, ?, ?, ?, null)
	`, userID, input.Username, displayName, input.Role, input.PasswordHash, input.PasswordHashAlgorithm, nowIso, nowIso)
	if err != nil {
		if isUniqueUserError(err) {
			return nil, auth.ErrDuplicateUsername
		}
		return nil, fmt.Errorf("create user: %w", err)
	}

	return r.GetActiveUserByID(ctx, userID)
}

func (r AuthRepository) UpdateUser(ctx context.Context, input auth.UpdateUserInput) (*auth.ManagedUser, error) {
	nowIso := input.Now.UTC().Format(time.RFC3339)
	var displayName any
	if input.DisplayName != nil {
		displayName = *input.DisplayName
	}

	result, err := r.DB.ExecContext(ctx, `
		update users
		set display_name = ?, role = ?, updated_at_iso = ?
		where id = ? and disabled_at_iso is null
	`, displayName, input.Role, nowIso, input.UserID)
	if err != nil {
		return nil, fmt.Errorf("update user: %w", err)
	}
	if rows, err := result.RowsAffected(); err != nil {
		return nil, fmt.Errorf("update user rows affected: %w", err)
	} else if rows == 0 {
		return nil, nil
	}

	return r.GetAnyUserByID(ctx, input.UserID)
}

func (r AuthRepository) UpdateUserPassword(ctx context.Context, input auth.UpdateUserPasswordInput) error {
	nowIso := input.Now.UTC().Format(time.RFC3339)
	result, err := r.DB.ExecContext(ctx, `
		update users
		set password_hash = ?, password_hash_algorithm = ?, updated_at_iso = ?
		where id = ? and disabled_at_iso is null
	`, input.PasswordHash, input.PasswordHashAlgorithm, nowIso, input.UserID)
	if err != nil {
		return fmt.Errorf("update user password: %w", err)
	}
	if rows, err := result.RowsAffected(); err != nil {
		return fmt.Errorf("update user password rows affected: %w", err)
	} else if rows == 0 {
		return sql.ErrNoRows
	}

	return nil
}

func (r AuthRepository) DisableUser(ctx context.Context, userID string, now time.Time) (*auth.ManagedUser, error) {
	nowIso := now.UTC().Format(time.RFC3339)
	result, err := r.DB.ExecContext(ctx, `
		update users
		set disabled_at_iso = ?, updated_at_iso = ?
		where id = ? and disabled_at_iso is null
	`, nowIso, nowIso, userID)
	if err != nil {
		return nil, fmt.Errorf("disable user: %w", err)
	}
	if rows, err := result.RowsAffected(); err != nil {
		return nil, fmt.Errorf("disable user rows affected: %w", err)
	} else if rows == 0 {
		return nil, nil
	}

	return r.GetAnyUserByID(ctx, userID)
}

func (r AuthRepository) RevokeUserSessions(ctx context.Context, userID string, now time.Time) error {
	nowIso := now.UTC().Format(time.RFC3339)
	_, err := r.DB.ExecContext(ctx, `
		update user_sessions
		set revoked_at_iso = ?, last_seen_at_iso = ?
		where user_id = ? and revoked_at_iso is null
	`, nowIso, nowIso, userID)
	if err != nil {
		return fmt.Errorf("revoke user sessions: %w", err)
	}

	return nil
}

func (r AuthRepository) FindActiveSessionByHash(ctx context.Context, sessionTokenHash string, now time.Time) (*auth.Session, error) {
	row := r.DB.QueryRowContext(ctx, `
		select id, user_id, session_token_hash, expires_at_iso, revoked_at_iso
		from user_sessions
		where session_token_hash = ? and revoked_at_iso is null
	`, sessionTokenHash)

	var session auth.Session
	var expiresAtIso string
	var revokedAtIso sql.NullString
	if err := row.Scan(&session.ID, &session.UserID, &session.SessionTokenHash, &expiresAtIso, &revokedAtIso); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}

		return nil, fmt.Errorf("find active session: %w", err)
	}

	expiresAt, err := time.Parse(time.RFC3339, expiresAtIso)
	if err != nil {
		return nil, fmt.Errorf("parse session expires_at_iso: %w", err)
	}
	session.ExpiresAt = expiresAt

	if revokedAtIso.Valid {
		revokedAt, err := time.Parse(time.RFC3339, revokedAtIso.String)
		if err != nil {
			return nil, fmt.Errorf("parse session revoked_at_iso: %w", err)
		}
		session.RevokedAt = &revokedAt
	}

	if session.RevokedAt != nil || !session.ExpiresAt.After(now) {
		return nil, nil
	}

	if _, err := r.DB.ExecContext(ctx, `
		update user_sessions
		set last_seen_at_iso = ?
		where id = ?
	`, now.UTC().Format(time.RFC3339), session.ID); err != nil {
		return nil, fmt.Errorf("touch session: %w", err)
	}

	return &session, nil
}

type managedUserScanner interface {
	Scan(dest ...any) error
}

func scanManagedUser(scanner managedUserScanner) (*auth.ManagedUser, error) {
	var user auth.ManagedUser
	var displayName sql.NullString
	var disabledAtIso sql.NullString
	if err := scanner.Scan(
		&user.ID,
		&user.Username,
		&displayName,
		&user.Role,
		&user.CreatedAtIso,
		&user.UpdatedAtIso,
		&disabledAtIso,
	); err != nil {
		return nil, err
	}

	if displayName.Valid {
		user.DisplayName = &displayName.String
	}
	if disabledAtIso.Valid {
		value := disabledAtIso.String
		user.DisabledAtIso = &value
		if disabledAt, err := time.Parse(time.RFC3339, value); err == nil {
			user.DisabledAt = &disabledAt
		}
	}

	return &user, nil
}

func isUniqueUserError(err error) bool {
	message := strings.ToLower(err.Error())
	return strings.Contains(message, "unique") && strings.Contains(message, "users")
}

func (r AuthRepository) GetActiveUserByID(ctx context.Context, userID string) (*auth.User, error) {
	return r.getActiveUser(ctx, "id", userID)
}

func (r AuthRepository) GetActiveUserByUsername(ctx context.Context, username string) (*auth.User, error) {
	return r.getActiveUser(ctx, "username", username)
}

func (r AuthRepository) CreateSession(ctx context.Context, input auth.CreateSessionInput) (*auth.Session, error) {
	sessionID := uuid.NewString()
	nowIso := input.Now.UTC().Format(time.RFC3339)
	expiresAtIso := input.ExpiresAt.UTC().Format(time.RFC3339)

	_, err := r.DB.ExecContext(ctx, `
		insert into user_sessions (
			id, user_id, session_token_hash, created_at_iso, last_seen_at_iso, expires_at_iso, revoked_at_iso
		) values (?, ?, ?, ?, ?, ?, null)
	`, sessionID, input.UserID, input.SessionTokenHash, nowIso, nowIso, expiresAtIso)
	if err != nil {
		return nil, fmt.Errorf("create session: %w", err)
	}

	return &auth.Session{
		ID:               sessionID,
		UserID:           input.UserID,
		SessionTokenHash: input.SessionTokenHash,
		ExpiresAt:        input.ExpiresAt,
	}, nil
}

func (r AuthRepository) RevokeSessionByHash(ctx context.Context, sessionTokenHash string, now time.Time) error {
	_, err := r.DB.ExecContext(ctx, `
		update user_sessions
		set revoked_at_iso = ?, last_seen_at_iso = ?
		where session_token_hash = ? and revoked_at_iso is null
	`, now.UTC().Format(time.RFC3339), now.UTC().Format(time.RFC3339), sessionTokenHash)
	if err != nil {
		return fmt.Errorf("revoke session: %w", err)
	}

	return nil
}

func (r AuthRepository) getActiveUser(ctx context.Context, field string, value string) (*auth.User, error) {
	if field != "id" && field != "username" {
		return nil, fmt.Errorf("unsupported user lookup field %q", field)
	}

	row := r.DB.QueryRowContext(ctx, `
		select id, username, display_name, role, password_hash, disabled_at_iso
		from users
		where `+field+` = ? and disabled_at_iso is null
	`, value)

	var user auth.User
	var displayName sql.NullString
	var disabledAtIso sql.NullString
	if err := row.Scan(&user.ID, &user.Username, &displayName, &user.Role, &user.PasswordHash, &disabledAtIso); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}

		return nil, fmt.Errorf("get active user: %w", err)
	}

	if displayName.Valid {
		user.DisplayName = &displayName.String
	}

	if disabledAtIso.Valid {
		disabledAt, err := time.Parse(time.RFC3339, disabledAtIso.String)
		if err != nil {
			return nil, fmt.Errorf("parse user disabled_at_iso: %w", err)
		}
		user.DisabledAt = &disabledAt
	}

	return &user, nil
}
