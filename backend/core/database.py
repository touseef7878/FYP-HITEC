"""
Supabase REST database module for OceanScan AI.

The backend stores application data in Supabase/Postgres through PostgREST.
There is no local database fallback in this project.
"""

import hashlib
import json
import logging
import os
import secrets
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

from dotenv import load_dotenv

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
BACKEND_DIR = os.path.dirname(os.path.dirname(__file__))

load_dotenv(os.path.join(ROOT_DIR, ".env"))
load_dotenv(os.path.join(BACKEND_DIR, ".env"), override=True)

logger = logging.getLogger(__name__)

try:
    import httpx
except ImportError as exc:
    raise ImportError("httpx is required for the Supabase REST database backend") from exc


SUPABASE_URL = os.getenv("SUPABASE_URL", "https://zuophfoyuxlxumwcdvuz.supabase.co").rstrip("/")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_SERVICE_KEY:
    raise ValueError(
        "SUPABASE_SERVICE_KEY environment variable is required. "
        "Set it in backend/.env or your hosting provider secrets."
    )

_http = httpx.Client(
    base_url=SUPABASE_URL,
    headers={
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    },
    timeout=30.0,
)

logger.info("Database backend: Supabase REST API")


def _rest(method: str, path: str, **kwargs) -> httpx.Response:
    """Execute a Supabase REST call and raise a concise error on failure."""
    response = _http.request(method, path, **kwargs)
    if response.status_code >= 400:
        raise RuntimeError(
            f"Supabase REST {method} {path} -> "
            f"{response.status_code}: {response.text[:300]}"
        )
    return response


def _rpc_sql(sql: str, params: dict = None) -> List[Dict]:
    """
    Execute SQL through a Supabase `run_sql` RPC if the project provides it.
    Kept for test/debug compatibility; normal runtime uses table REST calls.
    """
    payload = {"query": sql}
    if params:
        payload["params"] = params
    result = _rest("POST", "/rest/v1/rpc/run_sql", json=payload).json()
    if isinstance(result, list):
        return result
    if isinstance(result, dict) and isinstance(result.get("rows"), list):
        return result["rows"]
    return []


def _parse_filters(filters: str) -> Dict[str, str]:
    params: Dict[str, str] = {}
    if not filters:
        return params
    for part in filters.split("&"):
        if "=" in part:
            key, value = part.split("=", 1)
            params[key] = value
    return params


def _sb_select(
    table: str,
    query: str = "*",
    filters: str = "",
    order: str = "",
    limit: int = None,
    offset: int = None,
    single: bool = False,
) -> Any:
    params = {"select": query}
    params.update(_parse_filters(filters))
    if order:
        params["order"] = order
    if limit is not None:
        params["limit"] = str(limit)
    if offset is not None:
        params["offset"] = str(offset)

    data = _rest("GET", f"/rest/v1/{table}", params=params).json()
    if single:
        return data[0] if isinstance(data, list) and data else None
    return data if isinstance(data, list) else []


def _sb_insert(table: str, data: Any) -> Optional[Dict]:
    result = _rest(
        "POST",
        f"/rest/v1/{table}",
        json=data,
        headers={"Prefer": "return=representation"},
    ).json()
    if isinstance(result, list):
        return result[0] if result else None
    return result if isinstance(result, dict) else None


def _sb_update(table: str, data: dict, filters: str) -> List[Dict]:
    result = _rest(
        "PATCH",
        f"/rest/v1/{table}?{filters}",
        json=data,
        headers={"Prefer": "return=representation"},
    ).json()
    return result if isinstance(result, list) else []


def _sb_delete(table: str, filters: str) -> int:
    result = _rest(
        "DELETE",
        f"/rest/v1/{table}?{filters}",
        headers={"Prefer": "return=representation"},
    ).json()
    return len(result) if isinstance(result, list) else 0


def _json_loads(value: Any, fallback: Any = None) -> Any:
    if fallback is None:
        fallback = {}
    if isinstance(value, (dict, list)):
        return value
    if not value:
        return fallback
    try:
        return json.loads(value)
    except Exception:
        return fallback


def _iso_now() -> str:
    return datetime.utcnow().isoformat()


class DatabaseManager:
    """Application data access layer backed only by Supabase REST."""

    _REGION_BASELINE = {
        "pacific": {"avg": 65.0, "max": 72.0},
        "atlantic": {"avg": 45.0, "max": 52.0},
        "indian": {"avg": 55.0, "max": 63.0},
        "mediterranean": {"avg": 40.0, "max": 48.0},
    }
    _REGION_COORDS = {
        "pacific": (10.0, -150.0),
        "atlantic": (30.0, -40.0),
        "indian": (-20.0, 75.0),
        "mediterranean": (36.0, 18.0),
    }

    def __init__(self) -> None:
        self.backend = "supabase"

    # ---------------------------------------------------------------------
    # Password helpers
    # ---------------------------------------------------------------------

    def hash_password(self, password: str) -> str:
        try:
            import bcrypt

            return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
        except ImportError:
            salt = secrets.token_hex(16)
            digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 260000)
            return f"pbkdf2:{salt}:{digest.hex()}"

    def verify_password(self, password: str, password_hash: str) -> bool:
        try:
            if password_hash.startswith(("$2b$", "$2a$")):
                import bcrypt

                return bcrypt.checkpw(password.encode(), password_hash.encode())
            if password_hash.startswith("pbkdf2:"):
                _, salt, stored = password_hash.split(":", 2)
                digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 260000)
                return digest.hex() == stored
            parts = password_hash.split(":")
            if len(parts) == 2:
                salt, stored = parts
                return hashlib.sha256((password + salt).encode()).hexdigest() == stored
            return False
        except Exception as exc:
            logger.error(f"verify_password failed: {exc}")
            return False

    # ---------------------------------------------------------------------
    # User management
    # ---------------------------------------------------------------------

    def add_email_verification_columns(self) -> None:
        logger.info("Email verification columns are managed by Supabase schema")

    def create_user(
        self,
        username: str,
        email: str,
        password: str,
        role: str = "USER",
    ) -> Optional[int]:
        try:
            row = _sb_insert(
                "users",
                {
                    "username": username,
                    "email": email,
                    "password_hash": self.hash_password(password),
                    "role": role,
                    "profile_data": "{}",
                    "is_active": True,
                    "email_verified": False,
                },
            )
            return row.get("id") if row else None
        except Exception as exc:
            logger.error(f"create_user failed: {exc}")
            return None

    def authenticate_user(self, username: str, password: str) -> Optional[Dict]:
        try:
            rows = _sb_select(
                "users",
                "id,username,email,password_hash,role,is_active,created_at,last_login,profile_data,email_verified",
                filters=f"username=eq.{username}",
                limit=1,
            )
            if not rows:
                response = _http.get(
                    "/rest/v1/users",
                    params={
                        "select": "id,username,email,password_hash,role,is_active,created_at,last_login,profile_data,email_verified",
                        "email": f"eq.{username}",
                        "limit": "1",
                    },
                )
                if response.status_code >= 400:
                    raise RuntimeError(response.text[:200])
                rows = response.json()

            if not rows:
                return None

            row = rows[0]
            if not row.get("is_active"):
                return None
            if not self.verify_password(password, row["password_hash"]):
                return None
            if not row.get("email_verified"):
                logger.warning(f"Login blocked for unverified user: {row['username']}")
                return "unverified"

            _sb_update("users", {"last_login": _iso_now()}, f"id=eq.{row['id']}")

            return {
                "id": row["id"],
                "username": row["username"],
                "email": row["email"],
                "role": row["role"],
                "created_at": str(row.get("created_at", "")),
                "last_login": str(row.get("last_login", "")) if row.get("last_login") else None,
                "profile_data": _json_loads(row.get("profile_data")),
            }
        except Exception as exc:
            logger.error(f"authenticate_user failed: {exc}")
            return None

    def get_user_by_id(self, user_id: int) -> Optional[Dict]:
        try:
            rows = _sb_select(
                "users",
                "id,username,email,role,created_at,last_login,is_active,profile_data",
                filters=f"id=eq.{user_id}",
                limit=1,
            )
            if not rows:
                return None
            row = rows[0]
            return {
                "id": row["id"],
                "username": row["username"],
                "email": row["email"],
                "role": row["role"],
                "created_at": str(row.get("created_at", "")),
                "last_login": str(row.get("last_login", "")) if row.get("last_login") else None,
                "is_active": bool(row.get("is_active", True)),
                "profile_data": _json_loads(row.get("profile_data")),
            }
        except Exception as exc:
            logger.error(f"get_user_by_id failed: {exc}")
            return None

    def get_user_by_username(self, username: str) -> Optional[Dict]:
        try:
            rows = _sb_select("users", "*", filters=f"username=eq.{username}", limit=1)
            return rows[0] if rows else None
        except Exception as exc:
            logger.error(f"get_user_by_username failed: {exc}")
            return None

    def get_user_by_email(self, email: str) -> Optional[Dict]:
        try:
            response = _http.get(
                "/rest/v1/users",
                params={"select": "*", "email": f"eq.{email}", "limit": "1"},
            )
            if response.status_code >= 400:
                raise RuntimeError(response.text[:200])
            rows = response.json()
            return rows[0] if isinstance(rows, list) and rows else None
        except Exception as exc:
            logger.error(f"get_user_by_email failed: {exc}")
            return None

    def update_user_last_login(self, user_id: int) -> bool:
        try:
            _sb_update("users", {"last_login": _iso_now()}, f"id=eq.{user_id}")
            return True
        except Exception as exc:
            logger.error(f"update_user_last_login failed: {exc}")
            return False

    def update_user_profile(
        self,
        user_id: int,
        email: str = None,
        profile_data: Dict = None,
    ) -> bool:
        try:
            data: Dict[str, Any] = {}
            if email:
                data["email"] = email
            if profile_data is not None:
                data["profile_data"] = json.dumps(profile_data)
            if data:
                _sb_update("users", data, f"id=eq.{user_id}")
            return True
        except Exception as exc:
            logger.error(f"update_user_profile failed: {exc}")
            return False

    def update_user_password(self, user_id: int, new_password: str) -> bool:
        try:
            _sb_update(
                "users",
                {"password_hash": self.hash_password(new_password)},
                f"id=eq.{user_id}",
            )
            return True
        except Exception as exc:
            logger.error(f"update_user_password failed: {exc}")
            return False

    def set_user_admin_state(
        self,
        user_id: int,
        username: str,
        email: str,
        password: str = None,
    ) -> bool:
        try:
            data = {
                "username": username,
                "email": email,
                "role": "ADMIN",
                "is_active": True,
                "email_verified": True,
                "verification_token": None,
                "verification_token_expires": None,
            }
            if password is not None:
                data["password_hash"] = self.hash_password(password)
            _sb_update("users", data, f"id=eq.{user_id}")
            return True
        except Exception as exc:
            logger.error(f"set_user_admin_state failed: {exc}")
            return False

    def deactivate_user(self, user_id: int) -> bool:
        try:
            _sb_update("users", {"is_active": False}, f"id=eq.{user_id}")
            _sb_delete("sessions", f"user_id=eq.{user_id}")
            return True
        except Exception as exc:
            logger.error(f"deactivate_user failed: {exc}")
            return False

    def invalidate_user_sessions(self, user_id: int) -> bool:
        return self.revoke_all_sessions(user_id)

    def get_all_users(self) -> List[Dict]:
        try:
            return _sb_select(
                "users",
                "id,username,email,role,is_active,created_at,last_login",
                order="created_at.desc",
            )
        except Exception as exc:
            logger.error(f"get_all_users failed: {exc}")
            return []

    def get_user_stats(self, user_id: int) -> Dict:
        try:
            det = len(_sb_select("detections", "id", filters=f"user_id=eq.{user_id}"))
            rep = len(_sb_select("reports", "id", filters=f"user_id=eq.{user_id}"))
            return {
                "total_detections": det,
                "total_reports": rep,
                "storage_used": round(det * 2.5, 2),
            }
        except Exception as exc:
            logger.error(f"get_user_stats failed: {exc}")
            return {"total_detections": 0, "total_reports": 0, "storage_used": 0}

    # ---------------------------------------------------------------------
    # Email verification
    # ---------------------------------------------------------------------

    def set_verification_token(self, user_id: int, token: str, expires_at: datetime) -> bool:
        try:
            _sb_update(
                "users",
                {
                    "verification_token": token,
                    "verification_token_expires": expires_at.isoformat(),
                },
                f"id=eq.{user_id}",
            )
            return True
        except Exception as exc:
            logger.error(f"set_verification_token failed: {exc}")
            return False

    def verify_email_token(self, token: str) -> Optional[Dict]:
        try:
            rows = _sb_select(
                "users",
                "id,username,email,verification_token_expires,email_verified",
                filters=f"verification_token=eq.{token}",
                limit=1,
            )
            if not rows:
                return None
            row = rows[0]
            if row.get("email_verified"):
                return row

            expires = row.get("verification_token_expires")
            if expires:
                expires_at = datetime.fromisoformat(
                    str(expires).replace("Z", "").replace("+00:00", "")
                ).replace(tzinfo=None)
                if expires_at < datetime.utcnow():
                    return None

            _sb_update(
                "users",
                {
                    "email_verified": True,
                    "verification_token": None,
                    "verification_token_expires": None,
                },
                f"id=eq.{row['id']}",
            )
            return row
        except Exception as exc:
            logger.error(f"verify_email_token failed: {exc}")
            return None

    def is_email_verified(self, user_id: int) -> bool:
        try:
            rows = _sb_select("users", "email_verified", filters=f"id=eq.{user_id}", limit=1)
            return bool(rows[0].get("email_verified")) if rows else False
        except Exception as exc:
            logger.error(f"is_email_verified failed: {exc}")
            return False

    # ---------------------------------------------------------------------
    # Session management
    # ---------------------------------------------------------------------

    def save_session(
        self,
        user_id: int,
        token: str,
        ip_address: str = None,
        user_agent: str = None,
        expiration_hours: int = 24,
    ) -> bool:
        try:
            token_hash = hashlib.sha256(token.encode()).hexdigest()
            expires_at = datetime.utcnow() + timedelta(hours=expiration_hours)
            _sb_insert(
                "sessions",
                {
                    "user_id": user_id,
                    "token_hash": token_hash,
                    "expires_at": expires_at.isoformat(),
                    "ip_address": ip_address,
                    "user_agent": user_agent,
                    "is_active": True,
                },
            )
            return True
        except Exception as exc:
            logger.error(f"save_session failed: {exc}")
            return False

    def is_session_active(self, user_id: int, token: str) -> bool:
        try:
            token_hash = hashlib.sha256(token.encode()).hexdigest()
            rows = _sb_select(
                "sessions",
                "id",
                filters=(
                    f"user_id=eq.{user_id}&token_hash=eq.{token_hash}"
                    f"&is_active=eq.true&expires_at=gt.{_iso_now()}"
                ),
                limit=1,
            )
            return bool(rows)
        except Exception as exc:
            logger.error(f"is_session_active failed: {exc}")
            return False

    def update_session_last_used(self, user_id: int, token: str) -> bool:
        try:
            token_hash = hashlib.sha256(token.encode()).hexdigest()
            _sb_update(
                "sessions",
                {"last_used": _iso_now()},
                f"user_id=eq.{user_id}&token_hash=eq.{token_hash}",
            )
            return True
        except Exception as exc:
            logger.error(f"update_session_last_used failed: {exc}")
            return False

    def revoke_session(self, user_id: int, token: str) -> bool:
        try:
            token_hash = hashlib.sha256(token.encode()).hexdigest()
            _sb_update(
                "sessions",
                {"is_active": False},
                f"user_id=eq.{user_id}&token_hash=eq.{token_hash}",
            )
            return True
        except Exception as exc:
            logger.error(f"revoke_session failed: {exc}")
            return False

    def revoke_all_sessions(self, user_id: int) -> bool:
        try:
            _sb_update("sessions", {"is_active": False}, f"user_id=eq.{user_id}")
            return True
        except Exception as exc:
            logger.error(f"revoke_all_sessions failed: {exc}")
            return False

    def cleanup_expired_sessions(self) -> int:
        try:
            return _sb_delete("sessions", f"expires_at=lte.{_iso_now()}")
        except Exception as exc:
            logger.error(f"cleanup_expired_sessions failed: {exc}")
            return 0

    # ---------------------------------------------------------------------
    # Detections
    # ---------------------------------------------------------------------

    def create_detection(
        self,
        user_id: int,
        filename: str,
        file_type: str,
        file_path: str = None,
        file_size: int = None,
        total_detections: int = 0,
        confidence_threshold: float = 0.25,
        processing_time: float = None,
        metadata: Dict = None,
    ) -> Optional[int]:
        try:
            row = _sb_insert(
                "detections",
                {
                    "user_id": user_id,
                    "filename": filename,
                    "file_type": file_type,
                    "file_path": file_path,
                    "file_size": file_size,
                    "total_detections": total_detections,
                    "confidence_threshold": confidence_threshold,
                    "processing_time": processing_time,
                    "status": "completed",
                    "metadata": json.dumps(metadata or {}),
                },
            )
            return row.get("id") if row else None
        except Exception as exc:
            logger.error(f"create_detection failed: {exc}")
            return None

    def add_detection_result(
        self,
        detection_id: int,
        class_name: str,
        confidence: float,
        bbox_x1: float,
        bbox_y1: float,
        bbox_x2: float,
        bbox_y2: float,
        frame_number: int = 0,
    ) -> bool:
        try:
            _sb_insert(
                "detection_results",
                {
                    "detection_id": detection_id,
                    "class_name": class_name,
                    "confidence": confidence,
                    "bbox_x1": bbox_x1,
                    "bbox_y1": bbox_y1,
                    "bbox_x2": bbox_x2,
                    "bbox_y2": bbox_y2,
                    "frame_number": frame_number,
                },
            )
            return True
        except Exception as exc:
            logger.error(f"add_detection_result failed: {exc}")
            return False

    def add_detection_results(self, detection_id: int, results: List[Dict]) -> bool:
        if not results:
            return True
        try:
            payload = [
                {
                    "detection_id": detection_id,
                    "class_name": item["class"],
                    "confidence": item["confidence"],
                    "bbox_x1": item["bbox"]["x1"],
                    "bbox_y1": item["bbox"]["y1"],
                    "bbox_x2": item["bbox"]["x2"],
                    "bbox_y2": item["bbox"]["y2"],
                    "frame_number": item.get("frame_number", 0),
                }
                for item in results
            ]
            batch_size = 500
            for start in range(0, len(payload), batch_size):
                _rest(
                    "POST",
                    "/rest/v1/detection_results",
                    json=payload[start : start + batch_size],
                    headers={"Prefer": "return=minimal"},
                )
            return True
        except Exception as exc:
            logger.error(f"add_detection_results failed: {exc}")
            return False

    def save_image_metadata(
        self,
        detection_id: int,
        width: int,
        height: int,
        original_path: str = None,
        annotated_path: str = None,
        original_base64: str = None,
        annotated_base64: str = None,
    ) -> bool:
        try:
            _sb_insert(
                "images",
                {
                    "detection_id": detection_id,
                    "width": width,
                    "height": height,
                    "original_path": original_path,
                    "annotated_path": annotated_path,
                    "original_base64": original_base64,
                    "annotated_base64": annotated_base64,
                },
            )
            return True
        except Exception as exc:
            logger.error(f"save_image_metadata failed: {exc}")
            return False

    def save_video_metadata(
        self,
        detection_id: int,
        total_frames: int,
        processed_frames: int,
        fps: float,
        duration: float,
        resolution: str,
        original_path: str = None,
        annotated_path: str = None,
    ) -> bool:
        try:
            _sb_insert(
                "videos",
                {
                    "detection_id": detection_id,
                    "total_frames": total_frames,
                    "processed_frames": processed_frames,
                    "fps": fps,
                    "duration": duration,
                    "resolution": resolution,
                    "original_path": original_path,
                    "annotated_path": annotated_path,
                },
            )
            return True
        except Exception as exc:
            logger.error(f"save_video_metadata failed: {exc}")
            return False

    def get_video_metadata(self, detection_id: int) -> Optional[Dict]:
        try:
            rows = _sb_select("videos", "*", filters=f"detection_id=eq.{detection_id}", limit=1)
            return rows[0] if rows else None
        except Exception as exc:
            logger.error(f"get_video_metadata failed: {exc}")
            return None

    def update_detection_status(
        self,
        detection_id: int,
        status: str,
        total_detections: int = None,
        processing_time: float = None,
        error_message: str = None,
        metadata: Dict = None,
    ) -> bool:
        try:
            data: Dict[str, Any] = {"status": status}
            if total_detections is not None:
                data["total_detections"] = total_detections
            if processing_time is not None:
                data["processing_time"] = processing_time
            if error_message is not None:
                data["error_message"] = error_message
            if metadata is not None:
                data["metadata"] = json.dumps(metadata)
            _sb_update("detections", data, f"id=eq.{detection_id}")
            return True
        except Exception as exc:
            logger.error(f"update_detection_status failed: {exc}")
            return False

    def get_user_detections(
        self,
        user_id: int,
        limit: int = 50,
        offset: int = 0,
        days: int = None,
    ) -> List[Dict]:
        try:
            filters = f"user_id=eq.{user_id}"
            if days:
                filters += f"&created_at=gte.{(datetime.utcnow() - timedelta(days=days)).isoformat()}"
            rows = _sb_select(
                "detections",
                "*",
                filters=filters,
                order="created_at.desc",
                limit=limit,
                offset=offset,
            )
            for row in rows:
                row["metadata"] = _json_loads(row.get("metadata"))
                video = _sb_select(
                    "videos",
                    "total_frames,fps,duration",
                    filters=f"detection_id=eq.{row['id']}",
                    limit=1,
                )
                if video:
                    row.update(video[0])
                image = _sb_select(
                    "images",
                    "width,height",
                    filters=f"detection_id=eq.{row['id']}",
                    limit=1,
                )
                if image:
                    row.update(image[0])
            return rows
        except Exception as exc:
            logger.error(f"get_user_detections failed: {exc}")
            return []

    def get_detection_by_id(self, detection_id: int, user_id: int = None) -> Optional[Dict]:
        try:
            filters = f"id=eq.{detection_id}"
            if user_id is not None:
                filters += f"&user_id=eq.{user_id}"
            rows = _sb_select("detections", "*", filters=filters, limit=1)
            if not rows:
                return None

            detection = rows[0]
            detection["metadata"] = _json_loads(detection.get("metadata"))
            detection["results"] = [
                {
                    "class": row["class_name"],
                    "confidence": row["confidence"],
                    "bbox": {
                        "x1": row["bbox_x1"],
                        "y1": row["bbox_y1"],
                        "x2": row["bbox_x2"],
                        "y2": row["bbox_y2"],
                    },
                    "frame_number": row.get("frame_number", 0),
                }
                for row in self.get_detection_results(detection_id, user_id)
            ]

            if detection.get("file_type") == "image":
                images = _sb_select(
                    "images",
                    "original_base64,annotated_base64",
                    filters=f"detection_id=eq.{detection_id}",
                    limit=1,
                )
                if images:
                    detection["original_image_base64"] = images[0].get("original_base64")
                    detection["annotated_image_base64"] = images[0].get("annotated_base64")

            return detection
        except Exception as exc:
            logger.error(f"get_detection_by_id failed: {exc}")
            return None

    def get_detection_results(self, detection_id: int, user_id: int = None) -> List[Dict]:
        try:
            return _sb_select(
                "detection_results",
                "class_name,confidence,bbox_x1,bbox_y1,bbox_x2,bbox_y2,frame_number",
                filters=f"detection_id=eq.{detection_id}",
                order="confidence.desc",
            )
        except Exception as exc:
            logger.error(f"get_detection_results failed: {exc}")
            return []

    def delete_detection(self, detection_id: int, user_id: int = None) -> bool:
        try:
            filters = f"id=eq.{detection_id}"
            if user_id is not None:
                filters += f"&user_id=eq.{user_id}"
            rows = _sb_select("detections", "id", filters=filters, limit=1)
            if not rows:
                return False
            _sb_delete("detection_results", f"detection_id=eq.{detection_id}")
            _sb_delete("videos", f"detection_id=eq.{detection_id}")
            _sb_delete("images", f"detection_id=eq.{detection_id}")
            _sb_delete("detections", filters)
            return True
        except Exception as exc:
            logger.error(f"delete_detection failed: {exc}")
            return False

    def delete_all_user_detections(self, user_id: int) -> bool:
        try:
            rows = _sb_select("detections", "id", filters=f"user_id=eq.{user_id}")
            for row in rows:
                detection_id = row["id"]
                _sb_delete("detection_results", f"detection_id=eq.{detection_id}")
                _sb_delete("videos", f"detection_id=eq.{detection_id}")
                _sb_delete("images", f"detection_id=eq.{detection_id}")
            _sb_delete("detections", f"user_id=eq.{user_id}")
            return True
        except Exception as exc:
            logger.error(f"delete_all_user_detections failed: {exc}")
            return False

    def delete_all_user_data(self, user_id: int) -> bool:
        try:
            self.delete_all_user_detections(user_id)
            for table in ("reports", "predictions", "analytics_data", "sessions"):
                _sb_delete(table, f"user_id=eq.{user_id}")
            return True
        except Exception as exc:
            logger.error(f"delete_all_user_data failed: {exc}")
            return False

    # ---------------------------------------------------------------------
    # Predictions and heatmap
    # ---------------------------------------------------------------------

    def save_prediction(
        self,
        user_id: int,
        region: str,
        prediction_date: str,
        predicted_pollution_level: float,
        confidence_interval: Tuple[float, float] = None,
        model_version: str = None,
        input_features: Dict = None,
    ) -> Optional[int]:
        try:
            row = _sb_insert(
                "predictions",
                {
                    "user_id": user_id,
                    "region": region,
                    "prediction_date": str(prediction_date),
                    "predicted_pollution_level": predicted_pollution_level,
                    "confidence_interval_lower": (
                        confidence_interval[0] if confidence_interval else None
                    ),
                    "confidence_interval_upper": (
                        confidence_interval[1] if confidence_interval else None
                    ),
                    "model_version": model_version,
                    "input_features": json.dumps(input_features or {}),
                },
            )
            return row.get("id") if row else None
        except Exception as exc:
            logger.error(f"save_prediction failed: {exc}")
            return None

    def get_user_predictions(
        self,
        user_id: int,
        region: str = None,
        limit: int = 100,
        days: int = None,
    ) -> List[Dict]:
        try:
            filters = f"user_id=eq.{user_id}"
            if region:
                filters += f"&region=eq.{region}"
            if days:
                filters += f"&created_at=gte.{(datetime.utcnow() - timedelta(days=days)).isoformat()}"
            rows = _sb_select(
                "predictions",
                "id,region,prediction_date,predicted_pollution_level,"
                "confidence_interval_lower,confidence_interval_upper,"
                "model_version,input_features,created_at",
                filters=filters,
                order="created_at.desc",
                limit=limit,
            )
            for row in rows:
                row["input_features"] = _json_loads(row.get("input_features"))
            return rows
        except Exception as exc:
            logger.error(f"get_user_predictions failed: {exc}")
            return []

    @staticmethod
    def _pollution_score(avg: float, max_level: float, sample_count: int) -> float:
        return round(min((avg / 100 * 0.6) + (max_level / 100 * 0.2) + (min(sample_count / 30, 1) * 0.2), 1.0), 4)

    @staticmethod
    def _intensity(avg: float) -> str:
        if avg < 30:
            return "Low"
        if avg < 60:
            return "Moderate"
        if avg < 80:
            return "High"
        return "Critical"

    def _heatmap_from_predictions(self, days: int = 7) -> Dict[str, Dict]:
        try:
            cutoff = (datetime.utcnow() - timedelta(days=days)).isoformat()
            rows = _sb_select(
                "predictions",
                "region,predicted_pollution_level",
                filters=f"created_at=gte.{cutoff}",
            )
            aggregated: Dict[str, Dict] = {}
            for row in rows:
                region = row["region"]
                value = float(row["predicted_pollution_level"])
                if region not in aggregated:
                    aggregated[region] = {"values": [], "max_level": value}
                aggregated[region]["values"].append(value)
                aggregated[region]["max_level"] = max(aggregated[region]["max_level"], value)
            return {
                region: {
                    "avg_level": sum(data["values"]) / len(data["values"]),
                    "max_level": data["max_level"],
                    "sample_count": len(data["values"]),
                }
                for region, data in aggregated.items()
            }
        except Exception as exc:
            logger.error(f"_heatmap_from_predictions failed: {exc}")
            return {}

    def get_heatmap_data(self, days: int = 7) -> List[Dict]:
        db_rows = self._heatmap_from_predictions(days)
        results = []
        for region, coords in self._REGION_COORDS.items():
            if region in db_rows:
                data = db_rows[region]
                avg = float(data["avg_level"])
                max_level = float(data["max_level"])
                samples = int(data["sample_count"])
                estimated = False
            else:
                baseline = self._REGION_BASELINE[region]
                avg = baseline["avg"]
                max_level = baseline["max"]
                samples = 0
                estimated = True
            results.append(
                {
                    "region": region,
                    "lat": coords[0],
                    "lng": coords[1],
                    "avg_pollution_level": round(avg, 2),
                    "max_pollution_level": round(max_level, 2),
                    "pollution_score": self._pollution_score(avg, max_level, samples),
                    "intensity": self._intensity(avg),
                    "sample_count": samples,
                    "time_range_days": days,
                    "is_estimated": estimated,
                }
            )
        return results

    def get_heatmap_predictions(self) -> List[Dict]:
        rows = self.get_heatmap_data(days=1)
        for row in rows:
            row["is_prediction"] = True
        return rows

    # ---------------------------------------------------------------------
    # Analytics
    # ---------------------------------------------------------------------

    def save_analytics_point(
        self,
        user_id: int,
        data_type: str,
        region: str,
        date_recorded: str,
        value: float,
        metadata: Dict = None,
    ) -> bool:
        try:
            _sb_insert(
                "analytics_data",
                {
                    "user_id": user_id,
                    "data_type": data_type,
                    "region": region,
                    "date_recorded": str(date_recorded),
                    "value": value,
                    "metadata": json.dumps(metadata or {}),
                },
            )
            return True
        except Exception as exc:
            logger.error(f"save_analytics_point failed: {exc}")
            return False

    def save_analytics_data(self, user_id: int, analytics_data: Dict) -> bool:
        try:
            return self.save_analytics_point(
                user_id,
                "summary",
                "",
                str(datetime.now().date()),
                analytics_data["stats"]["totalDetections"],
                analytics_data["stats"],
            )
        except Exception as exc:
            logger.error(f"save_analytics_data failed: {exc}")
            return False

    def get_analytics_data(
        self,
        user_id: int,
        data_type: str = None,
        region: str = None,
        start_date: str = None,
        end_date: str = None,
    ) -> List[Dict]:
        try:
            filters = f"user_id=eq.{user_id}"
            if data_type:
                filters += f"&data_type=eq.{data_type}"
            if region:
                filters += f"&region=eq.{region}"
            if start_date:
                filters += f"&date_recorded=gte.{start_date}"
            if end_date:
                filters += f"&date_recorded=lte.{end_date}"
            rows = _sb_select("analytics_data", "*", filters=filters, order="date_recorded.asc")
            for row in rows:
                row["metadata"] = _json_loads(row.get("metadata"))
            return rows
        except Exception as exc:
            logger.error(f"get_analytics_data failed: {exc}")
            return []

    # ---------------------------------------------------------------------
    # Reports
    # ---------------------------------------------------------------------

    def create_report(
        self,
        user_id: int,
        title: str,
        report_type: str,
        date_range_days: int = 30,
    ) -> Optional[int]:
        try:
            now = datetime.now()
            row = _sb_insert(
                "reports",
                {
                    "user_id": user_id,
                    "title": title,
                    "report_type": report_type,
                    "data_range_start": str((now - timedelta(days=date_range_days)).date()),
                    "data_range_end": str(now.date()),
                    "metadata": '{"status":"generating"}',
                },
            )
            return row.get("id") if row else None
        except Exception as exc:
            logger.error(f"create_report failed: {exc}")
            return None

    def update_report(self, report_id: int, report_data: Dict) -> bool:
        try:
            _sb_update(
                "reports",
                {
                    "metadata": json.dumps(
                        {
                            "status": "completed",
                            "data": report_data,
                            "generated_at": datetime.now().isoformat(),
                        }
                    )
                },
                f"id=eq.{report_id}",
            )
            return True
        except Exception as exc:
            logger.error(f"update_report failed: {exc}")
            return False

    def get_user_reports(
        self,
        user_id: int,
        limit: int = 50,
        days: int = None,
    ) -> List[Dict]:
        try:
            filters = f"user_id=eq.{user_id}"
            if days:
                filters += f"&created_at=gte.{(datetime.utcnow() - timedelta(days=days)).isoformat()}"
            rows = _sb_select(
                "reports",
                "id,title,report_type,created_at,data_range_start,data_range_end,metadata",
                filters=filters,
                order="created_at.desc",
                limit=limit,
            )
            reports = []
            for row in rows:
                metadata = _json_loads(row.get("metadata"))
                reports.append(
                    {
                        "id": row["id"],
                        "title": row["title"],
                        "report_type": row["report_type"],
                        "created_at": str(row.get("created_at", "")),
                        "data_range_start": str(row.get("data_range_start") or ""),
                        "data_range_end": str(row.get("data_range_end") or ""),
                        "status": metadata.get("status", "unknown"),
                        "size": "1.2 MB",
                        "metadata": metadata,
                    }
                )
            return reports
        except Exception as exc:
            logger.error(f"get_user_reports failed: {exc}")
            return []

    def _get_report_raw(self, report_id: int, user_id: int = None) -> Optional[Dict]:
        try:
            filters = f"id=eq.{report_id}"
            if user_id is not None:
                filters += f"&user_id=eq.{user_id}"
            rows = _sb_select("reports", "*", filters=filters, limit=1)
            if not rows:
                return None
            report = rows[0]
            metadata = _json_loads(report.get("metadata"))
            report["metadata"] = metadata
            report["data"] = metadata.get("data", {})
            return report
        except Exception as exc:
            logger.error(f"_get_report_raw failed: {exc}")
            return None

    def get_report_by_id(self, report_id: int) -> Optional[Dict]:
        return self._get_report_raw(report_id)

    def get_user_report_by_id(self, user_id: int, report_id: int) -> Optional[Dict]:
        return self._get_report_raw(report_id, user_id)

    def delete_report(self, report_id: int, user_id: int) -> bool:
        try:
            return _sb_delete("reports", f"id=eq.{report_id}&user_id=eq.{user_id}") > 0
        except Exception as exc:
            logger.error(f"delete_report failed: {exc}")
            return False

    def delete_all_user_reports(self, user_id: int) -> bool:
        try:
            _sb_delete("reports", f"user_id=eq.{user_id}")
            return True
        except Exception as exc:
            logger.error(f"delete_all_user_reports failed: {exc}")
            return False

    def update_report_file_path(self, report_id: int, file_path: str) -> bool:
        try:
            _sb_update("reports", {"file_path": file_path}, f"id=eq.{report_id}")
            return True
        except Exception as exc:
            logger.error(f"update_report_file_path failed: {exc}")
            return False

    # ---------------------------------------------------------------------
    # Logs and admin stats
    # ---------------------------------------------------------------------

    def log_activity(self, user_id: int, level: str, message: str, module: str = "system") -> bool:
        try:
            _sb_insert(
                "logs",
                {
                    "user_id": user_id,
                    "level": level.upper(),
                    "message": message,
                    "module": module,
                },
            )
            return True
        except Exception as exc:
            logger.error(f"log_activity failed: {exc}")
            return False

    def log_system_event(
        self,
        user_id: int,
        level: str,
        message: str,
        module: str,
        function_name: str = None,
        line_number: int = None,
        metadata: Dict = None,
    ) -> bool:
        try:
            _sb_insert(
                "logs",
                {
                    "user_id": user_id,
                    "level": level,
                    "message": message,
                    "module": module,
                    "function_name": function_name,
                    "line_number": line_number,
                    "metadata": json.dumps(metadata or {}),
                },
            )
            return True
        except Exception as exc:
            logger.error(f"log_system_event failed: {exc}")
            return False

    def get_recent_logs(self, limit: int = 50, level: str = None) -> List[Dict]:
        try:
            filters = f"level=eq.{level.upper()}" if level else ""
            return _sb_select(
                "logs",
                "id,user_id,level,message,module,timestamp",
                filters=filters,
                order="timestamp.desc",
                limit=limit,
            )
        except Exception as exc:
            logger.error(f"get_recent_logs failed: {exc}")
            return []

    def get_system_logs(
        self,
        admin_user_id: int,
        level: str = None,
        limit: int = 1000,
        offset: int = 0,
    ) -> List[Dict]:
        admin = self.get_user_by_id(admin_user_id)
        if not admin or admin["role"] != "ADMIN":
            return []
        return self.get_recent_logs(limit=limit, level=level)

    def get_system_stats(self) -> Dict:
        try:
            detections = _sb_select("detections", "id")
            sessions = _sb_select("sessions", "user_id,last_used")
            day_cutoff = (datetime.utcnow() - timedelta(days=1)).isoformat()
            hour_cutoff = (datetime.utcnow() - timedelta(hours=1)).isoformat()
            active_users = len(
                {
                    row["user_id"]
                    for row in sessions
                    if str(row.get("last_used", "")) > day_cutoff
                }
            )
            active_sessions = sum(
                1 for row in sessions if str(row.get("last_used", "")) > hour_cutoff
            )
            total_detections = len(detections)
            return {
                "active_users": active_users,
                "total_detections": total_detections,
                "database_size": 0,
                "active_sessions": active_sessions,
                "api_requests_today": 0,
                "storage_used": round(total_detections * 2.5, 2),
            }
        except Exception as exc:
            logger.error(f"get_system_stats failed: {exc}")
            return {
                "active_users": 0,
                "total_detections": 0,
                "database_size": 0,
                "active_sessions": 0,
                "api_requests_today": 0,
                "storage_used": 0,
            }

    def get_user_statistics(self, user_id: int) -> Dict:
        try:
            detections = _sb_select(
                "detections",
                "id,total_detections,status",
                filters=f"user_id=eq.{user_id}",
            )
            predictions = _sb_select("predictions", "id", filters=f"user_id=eq.{user_id}")
            reports = _sb_select("reports", "id", filters=f"user_id=eq.{user_id}")
            cutoff = (datetime.utcnow() - timedelta(days=30)).isoformat()
            recent_detections = _sb_select(
                "detections",
                "id",
                filters=f"user_id=eq.{user_id}&created_at=gte.{cutoff}",
            )
            total_objects = sum(
                row.get("total_detections", 0) or 0
                for row in detections
                if row.get("status") == "completed"
            )
            return {
                "total_detections": len(detections),
                "successful_detections": sum(
                    1 for row in detections if row.get("status") == "completed"
                ),
                "total_objects_detected": total_objects,
                "total_predictions": len(predictions),
                "total_reports": len(reports),
                "recent_detections": len(recent_detections),
            }
        except Exception as exc:
            logger.error(f"get_user_statistics failed: {exc}")
            return {}

    def get_system_statistics(self, admin_user_id: int) -> Dict:
        admin = self.get_user_by_id(admin_user_id)
        if not admin or admin["role"] != "ADMIN":
            return {}
        return self.get_system_stats()

    # ---------------------------------------------------------------------
    # Maintenance helpers
    # ---------------------------------------------------------------------

    def backup_database(self) -> str:
        return "Supabase manages database backups; use the Supabase dashboard for exports."

    def optimize_database(self) -> bool:
        logger.info("Supabase/Postgres optimization is managed by Supabase")
        return True

    def cleanup_old_sessions(self, days: int = 7) -> int:
        try:
            cutoff = (datetime.utcnow() - timedelta(days=days)).isoformat()
            return _sb_delete("sessions", f"created_at=lte.{cutoff}&is_active=eq.false")
        except Exception as exc:
            logger.error(f"cleanup_old_sessions failed: {exc}")
            return 0

    def cleanup_old_logs(self, days: int = 30) -> int:
        try:
            cutoff = (datetime.utcnow() - timedelta(days=days)).isoformat()
            return _sb_delete(
                "logs",
                f"timestamp=lte.{cutoff}&level=neq.ERROR&level=neq.CRITICAL",
            )
        except Exception as exc:
            logger.error(f"cleanup_old_logs failed: {exc}")
            return 0

    def export_system_data(self) -> str:
        return "Use the Supabase dashboard or API for full system exports."


db = DatabaseManager()
