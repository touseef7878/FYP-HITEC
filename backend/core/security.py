"""
JWT authentication and role-based access control.
"""

import logging
import os
from datetime import datetime, timedelta
from typing import Dict, Optional

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr

from core.database import db

logger = logging.getLogger(__name__)

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
if not JWT_SECRET_KEY:
    raise ValueError(
        "JWT_SECRET_KEY environment variable is required. "
        "Generate one with: python -c \"import secrets; print(secrets.token_urlsafe(32))\""
    )
if len(JWT_SECRET_KEY) < 32:
    raise ValueError("JWT_SECRET_KEY must be at least 32 characters long")

JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

security = HTTPBearer()


class AuthManager:
    """JWT token creation, validation, and revocation."""

    @staticmethod
    def create_access_token(user_data: Dict) -> str:
        try:
            payload = {
                "user_id": user_data["id"],
                "username": user_data["username"],
                "email": user_data["email"],
                "role": user_data["role"],
                "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS),
                "iat": datetime.utcnow(),
                "type": "access",
            }
            token = jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
            db.save_session(user_data["id"], token, expiration_hours=JWT_EXPIRATION_HOURS)
            logger.info(f"Token created for user: {user_data['username']}")
            return token
        except Exception as exc:
            logger.error(f"Token creation failed: {exc}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Token creation failed",
            )

    @staticmethod
    def verify_token(token: str) -> Optional[Dict]:
        try:
            payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])

            if not db.is_session_active(payload["user_id"], token):
                return None

            try:
                db.update_session_last_used(payload["user_id"], token)
            except Exception:
                pass

            return {
                "user_id": payload["user_id"],
                "username": payload["username"],
                "email": payload["email"],
                "role": payload["role"],
            }
        except jwt.ExpiredSignatureError:
            return None
        except jwt.InvalidTokenError:
            return None
        except Exception as exc:
            logger.error(f"Token verification failed: {exc}")
            return None

    @staticmethod
    def revoke_token(user_id: int, token: str) -> bool:
        return db.revoke_session(user_id, token)

    @staticmethod
    def revoke_all_tokens(user_id: int) -> bool:
        return db.revoke_all_sessions(user_id)


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
    user = db.get_user_by_id(current_user["user_id"])
    if not user or not user["is_active"]:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Inactive user",
        )
    return current_user


async def get_admin_user(
    current_user: Dict = Depends(get_current_active_user),
) -> Dict:
    if current_user["role"] != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user


class UserRegistration(BaseModel):
    username: str
    email: EmailStr
    password: str


class UserLogin(BaseModel):
    username: str
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
