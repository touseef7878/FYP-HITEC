"""
Authentication Module
JWT-based authentication system with role-based access control
"""

import jwt
import os
from datetime import datetime, timedelta
from typing import Dict, Optional, Callable
from functools import wraps
from fastapi import HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import logging

from database import db

logger = logging.getLogger(__name__)

# JWT Configuration
JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY')
if not JWT_SECRET_KEY:
    raise ValueError(
        "JWT_SECRET_KEY environment variable is required! "
        "Please set it in your .env file. "
        "Generate a secure key with: python -c 'import secrets; print(secrets.token_urlsafe(32))'"
    )
if len(JWT_SECRET_KEY) < 32:
    raise ValueError("JWT_SECRET_KEY must be at least 32 characters long for security")

JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_HOURS = 24

security = HTTPBearer()

class AuthManager:
    """Handles JWT token creation and validation"""
    
    @staticmethod
    def create_access_token(user_data: Dict) -> str:
        """Create JWT access token"""
        try:
            payload = {
                'user_id': user_data['id'],
                'username': user_data['username'],
                'email': user_data['email'],
                'role': user_data['role'],
                'exp': datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS),
                'iat': datetime.utcnow(),
                'type': 'access'
            }
            
            token = jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
            
            # Save session to database
            db.save_session(user_data['id'], token)
            
            logger.info(f"Created access token for user: {user_data['username']}")
            return token
            
        except Exception as e:
            logger.error(f"Token creation failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Token creation failed"
            )
    
    @staticmethod
    def verify_token(token: str) -> Optional[Dict]:
        """Verify JWT token and return user data"""
        try:
            payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
            
            # Check if token is still valid in database
            if not db.is_session_active(payload['user_id'], token):
                return None
            
            # Update last used timestamp
            db.update_session_last_used(payload['user_id'], token)
            
            return {
                'user_id': payload['user_id'],
                'username': payload['username'],
                'email': payload['email'],
                'role': payload['role']
            }
            
        except jwt.ExpiredSignatureError:
            logger.warning("Token expired")
            return None
        except jwt.InvalidTokenError:
            logger.warning("Invalid token")
            return None
        except Exception as e:
            logger.error(f"Token verification failed: {e}")
            return None
    
    @staticmethod
    def revoke_token(user_id: int, token: str) -> bool:
        """Revoke a specific token"""
        return db.revoke_session(user_id, token)
    
    @staticmethod
    def revoke_all_tokens(user_id: int) -> bool:
        """Revoke all tokens for a user"""
        return db.revoke_all_sessions(user_id)

# Dependency functions for FastAPI

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict:
    """Get current authenticated user"""
    token = credentials.credentials
    user_data = AuthManager.verify_token(token)
    
    if not user_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return user_data

async def get_current_active_user(current_user: Dict = Depends(get_current_user)) -> Dict:
    """Get current active user"""
    user = db.get_user_by_id(current_user['user_id'])
    
    if not user or not user['is_active']:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Inactive user"
        )
    
    return current_user

async def get_admin_user(current_user: Dict = Depends(get_current_active_user)) -> Dict:
    """Get current user if they are admin"""
    if current_user['role'] != 'ADMIN':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    
    return current_user

# Decorator functions for route protection

def require_auth(f: Callable) -> Callable:
    """Decorator to require authentication"""
    @wraps(f)
    async def decorated_function(*args, **kwargs):
        # This decorator is used with FastAPI dependencies
        # The actual authentication is handled by get_current_user dependency
        return await f(*args, **kwargs)
    return decorated_function

def require_admin(f: Callable) -> Callable:
    """Decorator to require admin role"""
    @wraps(f)
    async def decorated_function(*args, **kwargs):
        # This decorator is used with FastAPI dependencies
        # The actual admin check is handled by get_admin_user dependency
        return await f(*args, **kwargs)
    return decorated_function

# Session management extensions for database

def extend_database_with_sessions():
    """Add session management methods to database"""
    
    def save_session(self, user_id: int, token: str, ip_address: str = None, user_agent: str = None) -> bool:
        """Save session to database"""
        try:
            # Hash token for storage (don't store raw JWT)
            import hashlib
            token_hash = hashlib.sha256(token.encode()).hexdigest()
            
            expires_at = datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
            
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO sessions (user_id, token_hash, expires_at, ip_address, user_agent)
                    VALUES (?, ?, ?, ?, ?)
                """, (user_id, token_hash, expires_at, ip_address, user_agent))
                
                conn.commit()
                return True
                
        except Exception as e:
            logger.error(f"Save session failed: {e}")
            return False
    
    def is_session_active(self, user_id: int, token: str) -> bool:
        """Check if session is active"""
        try:
            import hashlib
            token_hash = hashlib.sha256(token.encode()).hexdigest()
            
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT id FROM sessions 
                    WHERE user_id = ? AND token_hash = ? AND is_active = 1 AND expires_at > CURRENT_TIMESTAMP
                """, (user_id, token_hash))
                
                return cursor.fetchone() is not None
                
        except Exception as e:
            logger.error(f"Check session failed: {e}")
            return False
    
    def update_session_last_used(self, user_id: int, token: str) -> bool:
        """Update session last used timestamp"""
        try:
            import hashlib
            token_hash = hashlib.sha256(token.encode()).hexdigest()
            
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    UPDATE sessions SET last_used = CURRENT_TIMESTAMP 
                    WHERE user_id = ? AND token_hash = ?
                """, (user_id, token_hash))
                
                conn.commit()
                return cursor.rowcount > 0
                
        except Exception as e:
            logger.error(f"Update session failed: {e}")
            return False
    
    def revoke_session(self, user_id: int, token: str) -> bool:
        """Revoke a specific session"""
        try:
            import hashlib
            token_hash = hashlib.sha256(token.encode()).hexdigest()
            
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    UPDATE sessions SET is_active = 0 
                    WHERE user_id = ? AND token_hash = ?
                """, (user_id, token_hash))
                
                conn.commit()
                return cursor.rowcount > 0
                
        except Exception as e:
            logger.error(f"Revoke session failed: {e}")
            return False
    
    def revoke_all_sessions(self, user_id: int) -> bool:
        """Revoke all sessions for a user"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    UPDATE sessions SET is_active = 0 WHERE user_id = ?
                """, (user_id,))
                
                conn.commit()
                return cursor.rowcount > 0
                
        except Exception as e:
            logger.error(f"Revoke all sessions failed: {e}")
            return False
    
    def get_user_sessions(self, user_id: int) -> list:
        """Get active sessions for a user"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT id, created_at, last_used, ip_address, user_agent, expires_at
                    FROM sessions 
                    WHERE user_id = ? AND is_active = 1 AND expires_at > CURRENT_TIMESTAMP
                    ORDER BY last_used DESC
                """, (user_id,))
                
                sessions = []
                for row in cursor.fetchall():
                    sessions.append(dict(row))
                
                return sessions
                
        except Exception as e:
            logger.error(f"Get user sessions failed: {e}")
            return []
    
    def cleanup_expired_sessions(self) -> int:
        """Clean up expired sessions"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    DELETE FROM sessions WHERE expires_at <= CURRENT_TIMESTAMP
                """)
                
                deleted_count = cursor.rowcount
                conn.commit()
                
                if deleted_count > 0:
                    logger.info(f"Cleaned up {deleted_count} expired sessions")
                
                return deleted_count
                
        except Exception as e:
            logger.error(f"Cleanup expired sessions failed: {e}")
            return 0
    
    # Add methods to database class
    db.__class__.save_session = save_session
    db.__class__.is_session_active = is_session_active
    db.__class__.update_session_last_used = update_session_last_used
    db.__class__.revoke_session = revoke_session
    db.__class__.revoke_all_sessions = revoke_all_sessions
    db.__class__.get_user_sessions = get_user_sessions
    db.__class__.cleanup_expired_sessions = cleanup_expired_sessions

# Initialize session management
extend_database_with_sessions()

# Pydantic models for API requests/responses

from pydantic import BaseModel, EmailStr

class UserRegistration(BaseModel):
    username: str
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    username: str  # Can be username or email
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