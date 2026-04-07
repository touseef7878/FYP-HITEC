"""
Authentication Module
JWT-based authentication with role-based access control.
Session methods are injected into DatabaseManager at import time.
"""

import jwt
import hashlib
import os
from datetime import datetime, timedelta
from typing import Dict, Optional
from fastapi import HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
import logging

from core.database import db, DatabaseManager

logger = logging.getLogger(__name__)

# ── JWT config ────────────────────────────────────────────────────────────────
JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY')
if not JWT_SECRET_KEY:
    raise ValueError(
        "JWT_SECRET_KEY environment variable is required! "
        "Set it in your .env file. "
        "Generate one: python -c 'import secrets; print(secrets.token_urlsafe(32))'"
    )
if len(JWT_SECRET_KEY) < 32:
    raise ValueError("JWT_SECRET_KEY must be at least 32 characters long")

JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_HOURS = 24

security = HTTPBearer()


# ── Session methods injected into DatabaseManager ────────────────────────────
# Avoids monkey-patching by adding them once at module load via proper assignment.

def _save_session(self, user_id: int, token: str,
                  ip_address: str = None, user_agent: str = None) -> bool:
    try:
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        expires_at = datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
        with self.get_connection() as conn:
            conn.cursor().execute(
                "INSERT INTO sessions (user_id, token_hash, expires_at, ip_address, user_agent) "
                "VALUES (?, ?, ?, ?, ?)",
                (user_id, token_hash, expires_at, ip_address, user_agent)
            )
        return True
    except Exception as e:
        logger.error(f"Save session failed: {e}")
        return False


def _is_session_active(self, user_id: int, token: str) -> bool:
    try:
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        with self.get_connection() as conn:
            row = conn.cursor().execute(
                "SELECT id FROM sessions "
                "WHERE user_id=? AND token_hash=? AND is_active=1 AND expires_at>CURRENT_TIMESTAMP",
                (user_id, token_hash)
            ).fetchone()
        return row is not None
    except Exception as e:
        logger.error(f"Check session failed: {e}")
        return False


def _update_session_last_used(self, user_id: int, token: str) -> bool:
    try:
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                "UPDATE sessions SET last_used=CURRENT_TIMESTAMP "
                "WHERE user_id=? AND token_hash=?",
                (user_id, token_hash)
            )
        return True
    except Exception as e:
        logger.error(f"Update session failed: {e}")
        return False


def _revoke_session(self, user_id: int, token: str) -> bool:
    try:
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                "UPDATE sessions SET is_active=0 WHERE user_id=? AND token_hash=?",
                (user_id, token_hash)
            )
        return True
    except Exception as e:
        logger.error(f"Revoke session failed: {e}")
        return False


def _revoke_all_sessions(self, user_id: int) -> bool:
    try:
        with self.get_connection() as conn:
            conn.cursor().execute(
                "UPDATE sessions SET is_active=0 WHERE user_id=?", (user_id,)
            )
        return True
    except Exception as e:
        logger.error(f"Revoke all sessions failed: {e}")
        return False


def _cleanup_expired_sessions(self) -> int:
    try:
        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute("DELETE FROM sessions WHERE expires_at <= CURRENT_TIMESTAMP")
            count = cur.rowcount
        if count:
            logger.info(f"Cleaned up {count} expired sessions")
        return count
    except Exception as e:
        logger.error(f"Cleanup expired sessions failed: {e}")
        return 0


# Attach session methods to DatabaseManager class (once, at import time)
DatabaseManager.save_session = _save_session
DatabaseManager.is_session_active = _is_session_active
DatabaseManager.update_session_last_used = _update_session_last_used
DatabaseManager.revoke_session = _revoke_session
DatabaseManager.revoke_all_sessions = _revoke_all_sessions
DatabaseManager.cleanup_expired_sessions = _cleanup_expired_sessions


# ── AuthManager ───────────────────────────────────────────────────────────────

class AuthManager:
    """JWT token creation and validation."""

    @staticmethod
    def create_access_token(user_data: Dict) -> str:
        try:
            payload = {
                'user_id': user_data['id'],
                'username': user_data['username'],
                'email': user_data['email'],
                'role': user_data['role'],
                'exp': datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS),
                'iat': datetime.utcnow(),
                'type': 'access',
            }
            token = jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
            db.save_session(user_data['id'], token)
            logger.info(f"Token created for user: {user_data['username']}")
            return token
        except Exception as e:
            logger.error(f"Token creation failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Token creation failed",
            )

    @staticmethod
    def verify_token(token: str) -> Optional[Dict]:
        """
        Verify JWT signature + expiry, then confirm session is still active in DB.
        The DB check supports forced logout (invalidate_user_sessions).
        """
        try:
            payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])

            if not db.is_session_active(payload['user_id'], token):
                return None

            # Non-blocking last-used update (best-effort)
            try:
                db.update_session_last_used(payload['user_id'], token)
            except Exception:
                pass

            return {
                'user_id': payload['user_id'],
                'username': payload['username'],
                'email': payload['email'],
                'role': payload['role'],
            }
        except jwt.ExpiredSignatureError:
            return None
        except jwt.InvalidTokenError:
            return None
        except Exception as e:
            logger.error(f"Token verification failed: {e}")
            return None

    @staticmethod
    def revoke_token(user_id: int, token: str) -> bool:
        return db.revoke_session(user_id, token)

    @staticmethod
    def revoke_all_tokens(user_id: int) -> bool:
        return db.revoke_all_sessions(user_id)


# ── FastAPI dependency functions ──────────────────────────────────────────────

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> Dict:
    user_data = AuthManager.verify_token(credentials.credentials)
    if not user_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user_data


async def get_current_active_user(
    current_user: Dict = Depends(get_current_user),
) -> Dict:
    user = db.get_user_by_id(current_user['user_id'])
    if not user or not user['is_active']:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Inactive user",
        )
    return current_user


async def get_admin_user(
    current_user: Dict = Depends(get_current_active_user),
) -> Dict:
    if current_user['role'] != 'ADMIN':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user


# ── Pydantic request/response models ─────────────────────────────────────────

class UserRegistration(BaseModel):
    username: str
    email: EmailStr
    password: str


class UserLogin(BaseModel):
    username: str   # accepts username or email
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int = JWT_EXPIRATION_HOURS * 3600
    user: Dict


class UserProfile(BaseModel):
    id: int
    username: str
    email: str
    role: str
    created_at: str
    last_login: Optional[str] = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str


class ProfileUpdate(BaseModel):
    email: Optional[str] = None
    profile_data: Optional[Dict] = None
