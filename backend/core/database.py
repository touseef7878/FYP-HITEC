"""
Database Module — Supabase REST API backend (HTTPS port 443, works everywhere)

HOW IT WORKS:
  - Uses Supabase PostgREST API for simple CRUD (fast, no SQL needed)
  - Uses Supabase /rpc/run_sql for complex queries (JOINs, aggregates, etc.)
  - Service-role key bypasses RLS — full server-side access
  - Synchronous httpx client — drop-in replacement, zero changes to main.py

FALLBACK:
  - USE_SQLITE=true  → local SQLite for offline dev (no internet needed)
  - USE_SQLITE=false → Supabase REST API (default, works on any machine/server)
"""

import os, json, hashlib, secrets, logging, shutil, re
from contextlib import contextmanager
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any
from queue import Queue

from dotenv import load_dotenv
load_dotenv()

logger = logging.getLogger(__name__)

# ── Backend flag ──────────────────────────────────────────────────────────────
_USE_SQLITE = os.getenv("USE_SQLITE", "false").lower() in ("1", "true", "yes")
logger.info(f"🗄️  DB backend: {'SQLite' if _USE_SQLITE else 'Supabase REST API (HTTPS)'}")

# ── SQLite import ─────────────────────────────────────────────────────────────
if _USE_SQLITE:
    import sqlite3

# ── Supabase REST client ──────────────────────────────────────────────────────
SUPABASE_URL        = "https://zuophfoyuxlxumwcdvuz.supabase.co"
SUPABASE_SERVICE_KEY = os.getenv(
    "SUPABASE_SERVICE_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1b3BoZm95dXhseHVtd2NkdnV6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTQwNjYwNSwiZXhwIjoyMDk2OTgyNjA1fQ.HAfd-uYfqG40fEJr63Ww1mwXpEs7BGg_9YBoo_xl8DE"
)

if not _USE_SQLITE:
    try:
        import httpx
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
        logger.info("✅ Supabase REST client ready")
    except ImportError:
        raise ImportError("httpx required: pip install httpx")


# =============================================================================
# Supabase REST helpers
# =============================================================================

def _rest(method: str, path: str, **kwargs) -> httpx.Response:
    """Execute a REST call and raise on HTTP errors."""
    r = _http.request(method, path, **kwargs)
    if r.status_code >= 400:
        raise RuntimeError(f"Supabase REST {method} {path} → {r.status_code}: {r.text[:300]}")
    return r

def _rpc_sql(sql: str, params: dict = None) -> List[Dict]:
    """
    Execute arbitrary SQL via Supabase /rpc/run_sql.
    Returns list of dicts (rows).
    """
    payload = {"query": sql}
    if params:
        payload["params"] = params
    r = _rest("POST", "/rest/v1/rpc/run_sql", json=payload)
    result = r.json()
    if isinstance(result, list):
        return result
    if isinstance(result, dict) and "rows" in result:
        return result["rows"]
    return []

def _sb_select(table: str, query: str = "*", filters: str = "",
               order: str = "", limit: int = None, single: bool = False) -> Any:
    """GET from a Supabase table via PostgREST."""
    import urllib.parse
    path = f"/rest/v1/{table}"
    params = {"select": query}
    if order:
        params["order"] = order
    if limit:
        params["limit"] = str(limit)
    if filters:
        # Parse filter string and add as params (handles special chars like @)
        for part in filters.split("&"):
            if "=" in part:
                k, v = part.split("=", 1)
                params[k] = v
    r = _rest("GET", path, params=params)
    data = r.json()
    if single:
        return data[0] if isinstance(data, list) and data else (data if isinstance(data, dict) else None)
    return data if isinstance(data, list) else []

def _sb_insert(table: str, data: dict) -> Optional[Dict]:
    """INSERT a row and return it."""
    r = _rest("POST", f"/rest/v1/{table}", json=data,
              headers={"Prefer": "return=representation"})
    result = r.json()
    return result[0] if isinstance(result, list) and result else result

def _sb_update(table: str, data: dict, filters: str) -> List[Dict]:
    """UPDATE rows matching filters."""
    r = _rest("PATCH", f"/rest/v1/{table}?{filters}", json=data,
              headers={"Prefer": "return=representation"})
    result = r.json()
    return result if isinstance(result, list) else []

def _sb_delete(table: str, filters: str) -> int:
    """DELETE rows matching filters. Returns rowcount."""
    r = _rest("DELETE", f"/rest/v1/{table}?{filters}",
              headers={"Prefer": "return=representation"})
    result = r.json()
    return len(result) if isinstance(result, list) else 0


# =============================================================================
# SQLite pool (for USE_SQLITE=true local dev)
# =============================================================================

class _SQLitePool:
    def __init__(self, path: str, size: int = 10):
        self._pool = Queue(maxsize=size)
        for _ in range(size):
            c = sqlite3.connect(path, check_same_thread=False)
            c.row_factory = sqlite3.Row
            c.execute("PRAGMA journal_mode=WAL")
            self._pool.put(c)
        logger.info(f"✅ SQLite pool ready ({size}): {path}")

    @contextmanager
    def get_connection(self):
        conn = self._pool.get()
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            self._pool.put(conn)


def _row_to_dict(cursor, row) -> Optional[Dict]:
    if row is None:
        return None
    return dict(row)

def _rows_to_dicts(cursor, rows) -> List[Dict]:
    return [dict(r) for r in rows] if rows else []

def _sql_sqlite(query: str) -> str:
    return query


# =============================================================================
# DatabaseManager — identical public API for both backends
# =============================================================================

class DatabaseManager:

    def __init__(self, db_path: str = None):
        if _USE_SQLITE:
            if db_path is None:
                db_path = os.path.join(
                    os.path.dirname(os.path.dirname(__file__)), "marine_detection.db"
                )
            self.db_path = db_path
            self.pool = (
                _SQLitePool(db_path, size=10) if os.path.exists(db_path) else None
            )
            if not self.pool:
                logger.warning(f"SQLite DB not found: {db_path}. Run init_db.py first!")
        else:
            self.db_path = None
            self.pool = None  # REST API — no pool needed

    # ── SQLite context manager (used only when USE_SQLITE=true) ───────────────
    @contextmanager
    def get_connection(self):
        if not _USE_SQLITE:
            # Yield a dummy object so code that uses get_connection still works
            yield _FakeConn(self)
            return
        if self.pool:
            with self.pool.get_connection() as conn:
                yield conn
        else:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            try:
                yield conn
                conn.commit()
            except Exception:
                conn.rollback()
                raise
            finally:
                conn.close()

    # ── SQLite exec helper ────────────────────────────────────────────────────
    def _exec(self, conn, query: str, params: tuple = ()):
        """SQLite-only helper kept for security.py injected methods."""
        if _USE_SQLITE:
            cur = conn.cursor()
            cur.execute(query, params)
            return cur
        else:
            # REST backend: _exec is only called by security.py session methods
            # which are re-routed via _FakeConn below
            return _FakeConn(self)._exec(query, params)

    def _insert_returning_id(self, conn, query: str, params: tuple) -> Optional[int]:
        """SQLite INSERT returning last row id."""
        if _USE_SQLITE:
            cur = conn.cursor()
            cur.execute(query, params)
            return cur.lastrowid
        return None  # REST path uses _sb_insert directly

    # =========================================================================
    # Password helpers
    # =========================================================================

    def hash_password(self, password: str) -> str:
        try:
            import bcrypt
            return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
        except ImportError:
            salt = secrets.token_hex(16)
            dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 260000)
            return f"pbkdf2:{salt}:{dk.hex()}"

    def verify_password(self, password: str, password_hash: str) -> bool:
        try:
            if password_hash.startswith(("$2b$", "$2a$")):
                import bcrypt
                return bcrypt.checkpw(password.encode(), password_hash.encode())
            elif password_hash.startswith("pbkdf2:"):
                _, salt, stored = password_hash.split(":", 2)
                dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 260000)
                return dk.hex() == stored
            else:
                parts = password_hash.split(":")
                if len(parts) == 2:
                    salt, hv = parts
                    return hashlib.sha256((password + salt).encode()).hexdigest() == hv
                return False
        except Exception as e:
            logger.error(f"verify_password error: {e}")
            return False

    # =========================================================================
    # Email verification migration (SQLite only — PG columns already exist)
    # =========================================================================

    def add_email_verification_columns(self) -> None:
        if not _USE_SQLITE:
            logger.info("✅ Email verification columns ready (Supabase)")
            return
        try:
            with self.get_connection() as conn:
                cur = conn.cursor()
                cur.execute("PRAGMA table_info(users)")
                cols = {row[1] for row in cur.fetchall()}
                if "email_verified" not in cols:
                    cur.execute("ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT 0")
                if "verification_token" not in cols:
                    cur.execute("ALTER TABLE users ADD COLUMN verification_token VARCHAR(128)")
                if "verification_token_expires" not in cols:
                    cur.execute("ALTER TABLE users ADD COLUMN verification_token_expires TIMESTAMP")
                conn.commit()
        except Exception as e:
            logger.error(f"add_email_verification_columns: {e}")

    # =========================================================================
    # USER MANAGEMENT
    # =========================================================================

    def create_user(self, username: str, email: str, password: str,
                    role: str = "USER") -> Optional[int]:
        try:
            pw_hash = self.hash_password(password)
            if _USE_SQLITE:
                with self.get_connection() as conn:
                    return self._insert_returning_id(
                        conn,
                        "INSERT INTO users (username,email,password_hash,role,profile_data) VALUES (?,?,?,?,?)",
                        (username, email, pw_hash, role, "{}")
                    )
            else:
                row = _sb_insert("users", {
                    "username": username, "email": email,
                    "password_hash": pw_hash, "role": role,
                    "profile_data": "{}", "is_active": True,
                    "email_verified": False,
                })
                uid = row.get("id") if row else None
                logger.info(f"Created user: {username} (ID: {uid})")
                return uid
        except Exception as e:
            logger.error(f"create_user failed: {e}")
            return None

    def authenticate_user(self, username: str, password: str) -> Optional[Dict]:
        try:
            if _USE_SQLITE:
                with self.get_connection() as conn:
                    cur = conn.cursor()
                    cur.execute(
                        "SELECT id,username,email,password_hash,role,is_active,"
                        "created_at,last_login,profile_data,"
                        "COALESCE(email_verified,0) as email_verified "
                        "FROM users WHERE username=? OR email=?",
                        (username, username)
                    )
                    row = cur.fetchone()
            else:
                # Try by username first, then by email
                rows = _sb_select("users",
                    "id,username,email,password_hash,role,is_active,"
                    "created_at,last_login,profile_data,email_verified",
                    filters=f"username=eq.{username}", limit=1)
                if not rows:
                    # Try as email (use direct params to handle @ symbol)
                    r = _http.get("/rest/v1/users", params={
                        "select": "id,username,email,password_hash,role,is_active,created_at,last_login,profile_data,email_verified",
                        "email": f"eq.{username}", "limit": "1"
                    })
                    rows = r.json() if r.status_code == 200 else []
                row = rows[0] if rows else None

            if not row:
                return None
            r = dict(row) if hasattr(row, "keys") else row
            if not r.get("is_active"):
                return None
            if not self.verify_password(password, r["password_hash"]):
                return None
            if not r.get("email_verified"):
                logger.warning(f"Login blocked — email not verified: {r['username']}")
                return "unverified"

            # Update last_login
            if _USE_SQLITE:
                with self.get_connection() as conn:
                    conn.cursor().execute(
                        "UPDATE users SET last_login=CURRENT_TIMESTAMP WHERE id=?", (r["id"],)
                    )
                    conn.commit()
            else:
                _sb_update("users",
                    {"last_login": datetime.utcnow().isoformat()},
                    f"id=eq.{r['id']}"
                )

            return {
                "id": r["id"], "username": r["username"],
                "email": r["email"], "role": r["role"],
                "created_at": str(r.get("created_at", "")),
                "last_login": str(r.get("last_login", "")) if r.get("last_login") else None,
                "profile_data": json.loads(r.get("profile_data") or "{}"),
            }
        except Exception as e:
            logger.error(f"authenticate_user failed: {e}")
            return None

    def get_user_by_id(self, user_id: int) -> Optional[Dict]:
        try:
            if _USE_SQLITE:
                with self.get_connection() as conn:
                    cur = conn.cursor()
                    cur.execute(
                        "SELECT id,username,email,role,created_at,last_login,is_active,profile_data FROM users WHERE id=?",
                        (user_id,)
                    )
                    row = cur.fetchone()
                    if not row: return None
                    r = dict(row)
            else:
                rows = _sb_select("users",
                    "id,username,email,role,created_at,last_login,is_active,profile_data",
                    filters=f"id=eq.{user_id}", limit=1)
                if not rows: return None
                r = rows[0]
            return {
                "id": r["id"], "username": r["username"],
                "email": r["email"], "role": r["role"],
                "created_at": str(r.get("created_at", "")),
                "last_login": str(r.get("last_login", "")) if r.get("last_login") else None,
                "is_active": bool(r.get("is_active", True)),
                "profile_data": json.loads(r.get("profile_data") or "{}"),
            }
        except Exception as e:
            logger.error(f"get_user_by_id failed: {e}")
            return None

    def get_user_by_username(self, username: str) -> Optional[Dict]:
        try:
            if _USE_SQLITE:
                with self.get_connection() as conn:
                    cur = conn.cursor()
                    cur.execute("SELECT * FROM users WHERE username=?", (username,))
                    row = cur.fetchone()
                    return dict(row) if row else None
            else:
                rows = _sb_select("users", "*",
                    filters=f"username=eq.{username}", limit=1)
                return rows[0] if rows else None
        except Exception as e:
            logger.error(f"get_user_by_username failed: {e}")
            return None

    def get_user_by_email(self, email: str) -> Optional[Dict]:
        try:
            if _USE_SQLITE:
                with self.get_connection() as conn:
                    cur = conn.cursor()
                    cur.execute("SELECT * FROM users WHERE email=?", (email,))
                    row = cur.fetchone()
                    return dict(row) if row else None
            else:
                # Use PostgREST params dict — handles @ and other special chars
                r = _http.get("/rest/v1/users", params={"select": "*", "email": f"eq.{email}", "limit": "1"})
                if r.status_code >= 400:
                    raise RuntimeError(f"get_user_by_email → {r.status_code}: {r.text[:200]}")
                rows = r.json()
                return rows[0] if isinstance(rows, list) and rows else None
        except Exception as e:
            logger.error(f"get_user_by_email failed: {e}")
            return None

    def update_user_last_login(self, user_id: int) -> bool:
        try:
            if _USE_SQLITE:
                with self.get_connection() as conn:
                    conn.cursor().execute(
                        "UPDATE users SET last_login=CURRENT_TIMESTAMP WHERE id=?", (user_id,)
                    )
                    conn.commit()
            else:
                _sb_update("users", {"last_login": datetime.utcnow().isoformat()}, f"id=eq.{user_id}")
            return True
        except Exception as e:
            logger.error(f"update_user_last_login failed: {e}")
            return False

    def update_user_profile(self, user_id: int, email: str = None,
                            profile_data: Dict = None) -> bool:
        try:
            data = {}
            if email: data["email"] = email
            if profile_data: data["profile_data"] = json.dumps(profile_data)
            if not data: return True
            if _USE_SQLITE:
                with self.get_connection() as conn:
                    sets = ", ".join(f"{k}=?" for k in data)
                    conn.cursor().execute(
                        f"UPDATE users SET {sets} WHERE id=?",
                        (*data.values(), user_id)
                    )
                    conn.commit()
            else:
                _sb_update("users", data, f"id=eq.{user_id}")
            return True
        except Exception as e:
            logger.error(f"update_user_profile failed: {e}")
            return False

    def update_user_password(self, user_id: int, new_password: str) -> bool:
        try:
            pw_hash = self.hash_password(new_password)
            if _USE_SQLITE:
                with self.get_connection() as conn:
                    conn.cursor().execute(
                        "UPDATE users SET password_hash=? WHERE id=?", (pw_hash, user_id)
                    )
                    conn.commit()
            else:
                _sb_update("users", {"password_hash": pw_hash}, f"id=eq.{user_id}")
            return True
        except Exception as e:
            logger.error(f"update_user_password failed: {e}")
            return False

    def deactivate_user(self, user_id: int) -> bool:
        try:
            if _USE_SQLITE:
                with self.get_connection() as conn:
                    conn.cursor().execute(
                        "UPDATE users SET is_active=0 WHERE id=?", (user_id,)
                    )
                    conn.cursor().execute("DELETE FROM sessions WHERE user_id=?", (user_id,))
                    conn.commit()
            else:
                _sb_update("users", {"is_active": False}, f"id=eq.{user_id}")
                _sb_delete("sessions", f"user_id=eq.{user_id}")
            return True
        except Exception as e:
            logger.error(f"deactivate_user failed: {e}")
            return False

    def invalidate_user_sessions(self, user_id: int) -> bool:
        try:
            if _USE_SQLITE:
                with self.get_connection() as conn:
                    conn.cursor().execute(
                        "UPDATE sessions SET is_active=0 WHERE user_id=?", (user_id,)
                    )
                    conn.commit()
            else:
                _sb_update("sessions", {"is_active": False}, f"user_id=eq.{user_id}")
            return True
        except Exception as e:
            logger.error(f"invalidate_user_sessions failed: {e}")
            return False

    def get_all_users(self) -> List[Dict]:
        try:
            if _USE_SQLITE:
                with self.get_connection() as conn:
                    cur = conn.cursor()
                    cur.execute(
                        "SELECT id,username,email,role,is_active,created_at,last_login FROM users ORDER BY created_at DESC"
                    )
                    return [dict(r) for r in cur.fetchall()]
            else:
                return _sb_select("users",
                    "id,username,email,role,is_active,created_at,last_login",
                    order="created_at.desc")
        except Exception as e:
            logger.error(f"get_all_users failed: {e}")
            return []

    def get_user_stats(self, user_id: int) -> Dict:
        try:
            if _USE_SQLITE:
                with self.get_connection() as conn:
                    cur = conn.cursor()
                    cur.execute("SELECT COUNT(*) FROM detections WHERE user_id=?", (user_id,))
                    det = cur.fetchone()[0]
                    cur.execute("SELECT COUNT(*) FROM reports WHERE user_id=?", (user_id,))
                    rep = cur.fetchone()[0]
            else:
                det_rows = _sb_select("detections", "id", filters=f"user_id=eq.{user_id}")
                rep_rows = _sb_select("reports", "id", filters=f"user_id=eq.{user_id}")
                det, rep = len(det_rows), len(rep_rows)
            return {"total_detections": det, "total_reports": rep,
                    "storage_used": round(det * 2.5, 2)}
        except Exception as e:
            logger.error(f"get_user_stats failed: {e}")
            return {"total_detections": 0, "total_reports": 0, "storage_used": 0}

    # =========================================================================
    # EMAIL VERIFICATION
    # =========================================================================

    def set_verification_token(self, user_id: int, token: str,
                                expires_at: datetime) -> bool:
        try:
            data = {"verification_token": token,
                    "verification_token_expires": expires_at.isoformat()}
            if _USE_SQLITE:
                with self.get_connection() as conn:
                    conn.cursor().execute(
                        "UPDATE users SET verification_token=?,verification_token_expires=? WHERE id=?",
                        (token, expires_at, user_id)
                    )
                    conn.commit()
            else:
                _sb_update("users", data, f"id=eq.{user_id}")
            return True
        except Exception as e:
            logger.error(f"set_verification_token failed: {e}")
            return False

    def verify_email_token(self, token: str) -> Optional[Dict]:
        try:
            if _USE_SQLITE:
                with self.get_connection() as conn:
                    cur = conn.cursor()
                    cur.execute(
                        "SELECT id,username,email,verification_token_expires,email_verified FROM users WHERE verification_token=?",
                        (token,)
                    )
                    row = cur.fetchone()
                    r = dict(row) if row else None
            else:
                rows = _sb_select("users",
                    "id,username,email,verification_token_expires,email_verified",
                    filters=f"verification_token=eq.{token}", limit=1)
                r = rows[0] if rows else None

            if not r: return None
            if r.get("email_verified"): return r

            exp = r.get("verification_token_expires")
            if exp:
                exp_dt = exp if isinstance(exp, datetime) else datetime.fromisoformat(str(exp).replace("Z", "").replace("+00:00", ""))
                # Compare as naive UTC
                exp_dt = exp_dt.replace(tzinfo=None)
                if exp_dt < datetime.utcnow(): return None

            # Mark verified
            if _USE_SQLITE:
                with self.get_connection() as conn:
                    conn.cursor().execute(
                        "UPDATE users SET email_verified=1,verification_token=NULL,verification_token_expires=NULL WHERE id=?",
                        (r["id"],)
                    )
                    conn.commit()
            else:
                _sb_update("users", {
                    "email_verified": True,
                    "verification_token": None,
                    "verification_token_expires": None
                }, f"id=eq.{r['id']}")
            logger.info(f"Email verified for user id={r['id']}")
            return r
        except Exception as e:
            logger.error(f"verify_email_token failed: {e}")
            return None

    def is_email_verified(self, user_id: int) -> bool:
        try:
            if _USE_SQLITE:
                with self.get_connection() as conn:
                    cur = conn.cursor()
                    cur.execute("SELECT email_verified FROM users WHERE id=?", (user_id,))
                    row = cur.fetchone()
                    return bool(row[0]) if row else False
            else:
                rows = _sb_select("users", "email_verified", filters=f"id=eq.{user_id}", limit=1)
                return bool(rows[0].get("email_verified")) if rows else False
        except Exception as e:
            logger.error(f"is_email_verified failed: {e}")
            return False

    # =========================================================================
    # SESSION MANAGEMENT  (methods injected by security.py)
    # save_session / is_session_active / update_session_last_used /
    # revoke_session / revoke_all_sessions / cleanup_expired_sessions
    # =========================================================================

    # =========================================================================
    # DETECTION MANAGEMENT
    # =========================================================================

    def create_detection(self, user_id: int, filename: str, file_type: str,
                         file_path: str = None, file_size: int = None,
                         total_detections: int = 0, confidence_threshold: float = 0.25,
                         processing_time: float = None, metadata: Dict = None) -> Optional[int]:
        try:
            payload = {
                "user_id": user_id, "filename": filename, "file_type": file_type,
                "file_path": file_path, "file_size": file_size,
                "total_detections": total_detections,
                "confidence_threshold": confidence_threshold,
                "processing_time": processing_time,
                "status": "completed",
                "metadata": json.dumps(metadata or {}),
            }
            if _USE_SQLITE:
                with self.get_connection() as conn:
                    return self._insert_returning_id(
                        conn,
                        "INSERT INTO detections (user_id,filename,file_type,file_path,file_size,"
                        "total_detections,confidence_threshold,processing_time,status,metadata) "
                        "VALUES (?,?,?,?,?,?,?,?,?,?)",
                        (user_id, filename, file_type, file_path, file_size,
                         total_detections, confidence_threshold, processing_time,
                         "completed", json.dumps(metadata or {}))
                    )
            else:
                row = _sb_insert("detections", payload)
                return row.get("id") if row else None
        except Exception as e:
            logger.error(f"create_detection failed: {e}")
            return None

    def add_detection_result(self, detection_id: int, class_name: str,
                             confidence: float, bbox_x1: float, bbox_y1: float,
                             bbox_x2: float, bbox_y2: float, frame_number: int = 0) -> bool:
        """Single row — images. For video use add_detection_results (batch)."""
        try:
            payload = {
                "detection_id": detection_id, "class_name": class_name,
                "confidence": confidence, "bbox_x1": bbox_x1, "bbox_y1": bbox_y1,
                "bbox_x2": bbox_x2, "bbox_y2": bbox_y2, "frame_number": frame_number,
            }
            if _USE_SQLITE:
                with self.get_connection() as conn:
                    conn.cursor().execute(
                        "INSERT INTO detection_results (detection_id,class_name,confidence,"
                        "bbox_x1,bbox_y1,bbox_x2,bbox_y2,frame_number) VALUES (?,?,?,?,?,?,?,?)",
                        (detection_id, class_name, confidence,
                         bbox_x1, bbox_y1, bbox_x2, bbox_y2, frame_number)
                    )
                    conn.commit()
            else:
                _sb_insert("detection_results", payload)
            return True
        except Exception as e:
            logger.error(f"add_detection_result failed: {e}")
            return False

    def add_detection_results(self, detection_id: int, results: List[Dict]) -> bool:
        """
        Batch insert for video detections.
        REST mode: sends up to 500 rows per HTTP call instead of 1 per call.
        This is ~500x faster for videos with many detections.
        """
        if not results:
            return True
        try:
            if _USE_SQLITE:
                with self.get_connection() as conn:
                    conn.cursor().executemany(
                        "INSERT INTO detection_results (detection_id,class_name,confidence,"
                        "bbox_x1,bbox_y1,bbox_x2,bbox_y2,frame_number) VALUES (?,?,?,?,?,?,?,?)",
                        [(detection_id, r["class"], r["confidence"],
                          r["bbox"]["x1"], r["bbox"]["y1"],
                          r["bbox"]["x2"], r["bbox"]["y2"],
                          r.get("frame_number", 0)) for r in results]
                    )
                    conn.commit()
            else:
                BATCH_SIZE = 500
                payload_list = [
                    {
                        "detection_id": detection_id,
                        "class_name": r["class"],
                        "confidence": r["confidence"],
                        "bbox_x1": r["bbox"]["x1"], "bbox_y1": r["bbox"]["y1"],
                        "bbox_x2": r["bbox"]["x2"], "bbox_y2": r["bbox"]["y2"],
                        "frame_number": r.get("frame_number", 0),
                    }
                    for r in results
                ]
                batches = range(0, len(payload_list), BATCH_SIZE)
                for i in batches:
                    batch = payload_list[i : i + BATCH_SIZE]
                    _rest("POST", "/rest/v1/detection_results",
                          json=batch,
                          headers={"Prefer": "return=minimal"})
                logger.info(
                    f"Batch saved {len(results)} detection_results "
                    f"in {len(list(batches))} request(s) for detection_id={detection_id}"
                )
            return True
        except Exception as e:
            logger.error(f"add_detection_results (batch) failed: {e}")
            return False

    def save_image_metadata(self, detection_id: int, width: int, height: int,
                            original_path: str = None, annotated_path: str = None,
                            original_base64: str = None, annotated_base64: str = None) -> bool:
        try:
            payload = {
                "detection_id": detection_id, "width": width, "height": height,
                "original_path": original_path, "annotated_path": annotated_path,
                "original_base64": original_base64, "annotated_base64": annotated_base64,
            }
            if _USE_SQLITE:
                with self.get_connection() as conn:
                    conn.cursor().execute(
                        "INSERT INTO images (detection_id,width,height,original_path,"
                        "annotated_path,original_base64,annotated_base64) VALUES (?,?,?,?,?,?,?)",
                        (detection_id, width, height, original_path, annotated_path,
                         original_base64, annotated_base64)
                    )
                    conn.commit()
            else:
                _sb_insert("images", payload)
            return True
        except Exception as e:
            logger.error(f"save_image_metadata failed: {e}")
            return False

    def save_video_metadata(self, detection_id: int, total_frames: int,
                            processed_frames: int, fps: float, duration: float,
                            resolution: str, original_path: str = None,
                            annotated_path: str = None) -> bool:
        try:
            payload = {
                "detection_id": detection_id, "total_frames": total_frames,
                "processed_frames": processed_frames, "fps": fps,
                "duration": duration, "resolution": resolution,
                "original_path": original_path, "annotated_path": annotated_path,
            }
            if _USE_SQLITE:
                with self.get_connection() as conn:
                    conn.cursor().execute(
                        "INSERT INTO videos (detection_id,total_frames,processed_frames,"
                        "fps,duration,resolution,original_path,annotated_path) VALUES (?,?,?,?,?,?,?,?)",
                        (detection_id, total_frames, processed_frames, fps,
                         duration, resolution, original_path, annotated_path)
                    )
                    conn.commit()
            else:
                _sb_insert("videos", payload)
            return True
        except Exception as e:
            logger.error(f"save_video_metadata failed: {e}")
            return False

    def get_video_metadata(self, detection_id: int) -> Optional[Dict]:
        try:
            if _USE_SQLITE:
                with self.get_connection() as conn:
                    cur = conn.cursor()
                    cur.execute("SELECT * FROM videos WHERE detection_id=?", (detection_id,))
                    row = cur.fetchone()
                    return dict(row) if row else None
            else:
                rows = _sb_select("videos", "*", filters=f"detection_id=eq.{detection_id}", limit=1)
                return rows[0] if rows else None
        except Exception as e:
            logger.error(f"get_video_metadata failed: {e}")
            return None

    def update_detection_status(self, detection_id: int, status: str,
                                total_detections: int = None, processing_time: float = None,
                                error_message: str = None, metadata: Dict = None) -> bool:
        try:
            data = {"status": status}
            if total_detections is not None: data["total_detections"] = total_detections
            if processing_time is not None:  data["processing_time"] = processing_time
            if error_message is not None:    data["error_message"] = error_message
            if metadata is not None:         data["metadata"] = json.dumps(metadata)
            if _USE_SQLITE:
                with self.get_connection() as conn:
                    sets = ", ".join(f"{k}=?" for k in data)
                    conn.cursor().execute(
                        f"UPDATE detections SET {sets} WHERE id=?",
                        (*data.values(), detection_id)
                    )
                    conn.commit()
            else:
                _sb_update("detections", data, f"id=eq.{detection_id}")
            return True
        except Exception as e:
            logger.error(f"update_detection_status failed: {e}")
            return False

    def get_user_detections(self, user_id: int, limit: int = 50,
                            offset: int = 0, days: int = None) -> List[Dict]:
        try:
            if _USE_SQLITE:
                with self.get_connection() as conn:
                    cur = conn.cursor()
                    sql = ("SELECT d.*,v.total_frames,v.fps,v.duration,i.width,i.height "
                           "FROM detections d "
                           "LEFT JOIN videos v ON d.id=v.detection_id "
                           "LEFT JOIN images i ON d.id=i.detection_id "
                           "WHERE d.user_id=?")
                    params = [user_id]
                    if days:
                        sql += " AND d.created_at>=datetime('now',?)"
                        params.append(f"-{days} days")
                    sql += " ORDER BY d.created_at DESC LIMIT ? OFFSET ?"
                    params += [limit, offset]
                    cur.execute(sql, params)
                    rows = [dict(r) for r in cur.fetchall()]
            else:
                filters = f"user_id=eq.{user_id}"
                if days:
                    cutoff = (datetime.utcnow() - timedelta(days=days)).isoformat()
                    filters += f"&created_at=gte.{cutoff}"
                rows = _sb_select("detections", "*",
                    filters=filters, order="created_at.desc", limit=limit)
                # Enrich with video/image metadata
                for row in rows:
                    vid = _sb_select("videos", "total_frames,fps,duration",
                        filters=f"detection_id=eq.{row['id']}", limit=1)
                    if vid:
                        row.update(vid[0])
                    img = _sb_select("images", "width,height",
                        filters=f"detection_id=eq.{row['id']}", limit=1)
                    if img:
                        row.update(img[0])

            for row in rows:
                if isinstance(row.get("metadata"), str):
                    row["metadata"] = json.loads(row["metadata"] or "{}")
            return rows
        except Exception as e:
            logger.error(f"get_user_detections failed: {e}")
            return []

    def get_detection_by_id(self, detection_id: int,
                            user_id: int = None) -> Optional[Dict]:
        try:
            if _USE_SQLITE:
                with self.get_connection() as conn:
                    cur = conn.cursor()
                    sql = "SELECT * FROM detections WHERE id=?"
                    params = [detection_id]
                    if user_id:
                        sql += " AND user_id=?"
                        params.append(user_id)
                    cur.execute(sql, params)
                    row = cur.fetchone()
                    if not row: return None
                    d = dict(row)
            else:
                filters = f"id=eq.{detection_id}"
                if user_id: filters += f"&user_id=eq.{user_id}"
                rows = _sb_select("detections", "*", filters=filters, limit=1)
                if not rows: return None
                d = rows[0]

            if isinstance(d.get("metadata"), str):
                d["metadata"] = json.loads(d["metadata"] or "{}")

            # Get detection results
            results = self.get_detection_results(detection_id, user_id)
            d["results"] = [
                {"class": r["class_name"], "confidence": r["confidence"],
                 "bbox": {"x1": r["bbox_x1"], "y1": r["bbox_y1"],
                          "x2": r["bbox_x2"], "y2": r["bbox_y2"]},
                 "frame_number": r.get("frame_number", 0)}
                for r in results
            ]

            if d.get("file_type") == "image":
                if _USE_SQLITE:
                    with self.get_connection() as conn:
                        cur = conn.cursor()
                        cur.execute("SELECT original_base64,annotated_base64 FROM images WHERE detection_id=?",
                                    (detection_id,))
                        img = cur.fetchone()
                        if img:
                            d["original_image_base64"] = img[0]
                            d["annotated_image_base64"] = img[1]
                else:
                    imgs = _sb_select("images", "original_base64,annotated_base64",
                        filters=f"detection_id=eq.{detection_id}", limit=1)
                    if imgs:
                        d["original_image_base64"] = imgs[0].get("original_base64")
                        d["annotated_image_base64"] = imgs[0].get("annotated_base64")
            return d
        except Exception as e:
            logger.error(f"get_detection_by_id failed: {e}")
            return None

    def get_detection_results(self, detection_id: int,
                              user_id: int = None) -> List[Dict]:
        try:
            if _USE_SQLITE:
                with self.get_connection() as conn:
                    cur = conn.cursor()
                    cur.execute(
                        "SELECT class_name,confidence,bbox_x1,bbox_y1,bbox_x2,bbox_y2,frame_number "
                        "FROM detection_results WHERE detection_id=? ORDER BY confidence DESC",
                        (detection_id,)
                    )
                    return [dict(r) for r in cur.fetchall()]
            else:
                return _sb_select("detection_results",
                    "class_name,confidence,bbox_x1,bbox_y1,bbox_x2,bbox_y2,frame_number",
                    filters=f"detection_id=eq.{detection_id}",
                    order="confidence.desc")
        except Exception as e:
            logger.error(f"get_detection_results failed: {e}")
            return []

    def delete_detection(self, detection_id: int, user_id: int = None) -> bool:
        try:
            if _USE_SQLITE:
                with self.get_connection() as conn:
                    cur = conn.cursor()
                    sql = "SELECT id FROM detections WHERE id=?"
                    p = [detection_id]
                    if user_id: sql += " AND user_id=?"; p.append(user_id)
                    cur.execute(sql, p)
                    if not cur.fetchone(): return False
                    for tbl in ("detection_results", "videos", "images"):
                        cur.execute(f"DELETE FROM {tbl} WHERE detection_id=?", (detection_id,))
                    cur.execute("DELETE FROM detections WHERE id=?", (detection_id,))
                    conn.commit()
            else:
                filters = f"id=eq.{detection_id}"
                if user_id: filters += f"&user_id=eq.{user_id}"
                rows = _sb_select("detections", "id", filters=filters, limit=1)
                if not rows: return False
                _sb_delete("detection_results", f"detection_id=eq.{detection_id}")
                _sb_delete("videos", f"detection_id=eq.{detection_id}")
                _sb_delete("images", f"detection_id=eq.{detection_id}")
                _sb_delete("detections", filters)
            return True
        except Exception as e:
            logger.error(f"delete_detection failed: {e}")
            return False

    def delete_all_user_detections(self, user_id: int) -> bool:
        try:
            if _USE_SQLITE:
                with self.get_connection() as conn:
                    cur = conn.cursor()
                    cur.execute("SELECT id FROM detections WHERE user_id=?", (user_id,))
                    ids = [r[0] for r in cur.fetchall()]
                    for did in ids:
                        for tbl in ("detection_results", "videos", "images"):
                            cur.execute(f"DELETE FROM {tbl} WHERE detection_id=?", (did,))
                    cur.execute("DELETE FROM detections WHERE user_id=?", (user_id,))
                    conn.commit()
            else:
                rows = _sb_select("detections", "id", filters=f"user_id=eq.{user_id}")
                for row in rows:
                    did = row["id"]
                    _sb_delete("detection_results", f"detection_id=eq.{did}")
                    _sb_delete("videos", f"detection_id=eq.{did}")
                    _sb_delete("images", f"detection_id=eq.{did}")
                _sb_delete("detections", f"user_id=eq.{user_id}")
            return True
        except Exception as e:
            logger.error(f"delete_all_user_detections failed: {e}")
            return False

    def delete_all_user_data(self, user_id: int) -> bool:
        try:
            self.delete_all_user_detections(user_id)
            if _USE_SQLITE:
                with self.get_connection() as conn:
                    cur = conn.cursor()
                    for tbl in ("reports", "predictions", "analytics_data", "sessions"):
                        cur.execute(f"DELETE FROM {tbl} WHERE user_id=?", (user_id,))
                    conn.commit()
            else:
                for tbl in ("reports", "predictions", "analytics_data", "sessions"):
                    _sb_delete(tbl, f"user_id=eq.{user_id}")
            return True
        except Exception as e:
            logger.error(f"delete_all_user_data failed: {e}")
            return False

    # =========================================================================
    # PREDICTIONS
    # =========================================================================

    def save_prediction(self, user_id: int, region: str, prediction_date: str,
                        predicted_pollution_level: float,
                        confidence_interval: Tuple[float, float] = None,
                        model_version: str = None,
                        input_features: Dict = None) -> Optional[int]:
        try:
            payload = {
                "user_id": user_id, "region": region,
                "prediction_date": str(prediction_date),
                "predicted_pollution_level": predicted_pollution_level,
                "confidence_interval_lower": confidence_interval[0] if confidence_interval else None,
                "confidence_interval_upper": confidence_interval[1] if confidence_interval else None,
                "model_version": model_version,
                "input_features": json.dumps(input_features or {}),
            }
            if _USE_SQLITE:
                with self.get_connection() as conn:
                    return self._insert_returning_id(
                        conn,
                        "INSERT INTO predictions (user_id,region,prediction_date,"
                        "predicted_pollution_level,confidence_interval_lower,"
                        "confidence_interval_upper,model_version,input_features) "
                        "VALUES (?,?,?,?,?,?,?,?)",
                        (user_id, region, str(prediction_date), predicted_pollution_level,
                         payload["confidence_interval_lower"],
                         payload["confidence_interval_upper"],
                         model_version, json.dumps(input_features or {}))
                    )
            else:
                row = _sb_insert("predictions", payload)
                return row.get("id") if row else None
        except Exception as e:
            logger.error(f"save_prediction failed: {e}")
            return None

    def get_user_predictions(self, user_id: int, region: str = None,
                             limit: int = 100, days: int = None) -> List[Dict]:
        try:
            if _USE_SQLITE:
                with self.get_connection() as conn:
                    cur = conn.cursor()
                    sql = ("SELECT id,region,prediction_date,predicted_pollution_level,"
                           "confidence_interval_lower,confidence_interval_upper,"
                           "model_version,input_features,created_at "
                           "FROM predictions WHERE user_id=?")
                    params = [user_id]
                    if region: sql += " AND region=?"; params.append(region)
                    if days:
                        sql += " AND created_at>=datetime('now',?)"
                        params.append(f"-{days} days")
                    sql += " ORDER BY created_at DESC LIMIT ?"; params.append(limit)
                    cur.execute(sql, params)
                    rows = [dict(r) for r in cur.fetchall()]
            else:
                filters = f"user_id=eq.{user_id}"
                if region: filters += f"&region=eq.{region}"
                if days:
                    cutoff = (datetime.utcnow() - timedelta(days=days)).isoformat()
                    filters += f"&created_at=gte.{cutoff}"
                rows = _sb_select("predictions",
                    "id,region,prediction_date,predicted_pollution_level,"
                    "confidence_interval_lower,confidence_interval_upper,"
                    "model_version,input_features,created_at",
                    filters=filters, order="created_at.desc", limit=limit)
            for row in rows:
                row["input_features"] = json.loads(row.get("input_features") or "{}")
            return rows
        except Exception as e:
            logger.error(f"get_user_predictions failed: {e}")
            return []

    # =========================================================================
    # HEATMAP DATA
    # =========================================================================

    _REGION_BASELINE = {
        "pacific":       {"avg": 65.0, "max": 72.0},
        "atlantic":      {"avg": 45.0, "max": 52.0},
        "indian":        {"avg": 55.0, "max": 63.0},
        "mediterranean": {"avg": 40.0, "max": 48.0},
    }
    _REGION_COORDS = {
        "pacific":       (10.0,  -150.0),
        "atlantic":      (30.0,   -40.0),
        "indian":        (-20.0,   75.0),
        "mediterranean": (36.0,    18.0),
    }

    @staticmethod
    def _pollution_score(avg: float, mx: float, n: int) -> float:
        return round(min((avg/100*0.6) + (mx/100*0.2) + (min(n/30,1)*0.2), 1.0), 4)

    @staticmethod
    def _intensity(avg: float) -> str:
        if avg < 30: return "Low"
        if avg < 60: return "Moderate"
        if avg < 80: return "High"
        return "Critical"

    def _heatmap_from_predictions(self, days: int = 7) -> Dict[str, Dict]:
        """Aggregate predictions by region."""
        try:
            cutoff = (datetime.utcnow() - timedelta(days=days)).isoformat()
            if _USE_SQLITE:
                with self.get_connection() as conn:
                    cur = conn.cursor()
                    cur.execute(
                        "SELECT region,AVG(predicted_pollution_level),MAX(predicted_pollution_level),COUNT(*) "
                        "FROM predictions WHERE created_at>=? GROUP BY region",
                        (cutoff,)
                    )
                    rows = cur.fetchall()
                    return {r[0]: {"avg_level": r[1], "max_level": r[2], "sample_count": r[3]} for r in rows}
            else:
                all_rows = _sb_select("predictions",
                    "region,predicted_pollution_level",
                    filters=f"created_at=gte.{cutoff}")
                agg: Dict[str, Dict] = {}
                for row in all_rows:
                    reg = row["region"]
                    val = float(row["predicted_pollution_level"])
                    if reg not in agg:
                        agg[reg] = {"vals": [], "max_level": val}
                    agg[reg]["vals"].append(val)
                    agg[reg]["max_level"] = max(agg[reg]["max_level"], val)
                return {
                    reg: {
                        "avg_level": sum(d["vals"]) / len(d["vals"]),
                        "max_level": d["max_level"],
                        "sample_count": len(d["vals"]),
                    }
                    for reg, d in agg.items()
                }
        except Exception as e:
            logger.error(f"_heatmap_from_predictions failed: {e}")
            return {}

    def get_heatmap_data(self, days: int = 7) -> List[Dict]:
        db_rows = self._heatmap_from_predictions(days)
        results = []
        for region, coords in self._REGION_COORDS.items():
            if region in db_rows:
                d = db_rows[region]
                avg, mx, n = float(d["avg_level"]), float(d["max_level"]), int(d["sample_count"])
                is_est = False
            else:
                b = self._REGION_BASELINE[region]; avg, mx, n, is_est = b["avg"], b["max"], 0, True
            results.append({
                "region": region, "lat": coords[0], "lng": coords[1],
                "avg_pollution_level": round(avg, 2), "max_pollution_level": round(mx, 2),
                "pollution_score": self._pollution_score(avg, mx, n),
                "intensity": self._intensity(avg), "sample_count": n,
                "time_range_days": days, "is_estimated": is_est,
            })
        return results

    def get_heatmap_predictions(self) -> List[Dict]:
        db_rows = self._heatmap_from_predictions(days=1)
        results = []
        for region, coords in self._REGION_COORDS.items():
            if region in db_rows:
                d = db_rows[region]
                avg, mx, n, is_est = float(d["avg_level"]), float(d["max_level"]), int(d["sample_count"]), False
            else:
                b = self._REGION_BASELINE[region]; avg, mx, n, is_est = b["avg"], b["max"], 0, True
            results.append({
                "region": region, "lat": coords[0], "lng": coords[1],
                "avg_pollution_level": round(avg, 2), "max_pollution_level": round(mx, 2),
                "pollution_score": self._pollution_score(avg, mx, n),
                "intensity": self._intensity(avg), "sample_count": n,
                "is_prediction": True, "is_estimated": is_est,
            })
        return results

    # =========================================================================
    # ANALYTICS
    # =========================================================================

    def save_analytics_point(self, user_id: int, data_type: str, region: str,
                             date_recorded: str, value: float,
                             metadata: Dict = None) -> bool:
        try:
            payload = {"user_id": user_id, "data_type": data_type, "region": region,
                       "date_recorded": str(date_recorded), "value": value,
                       "metadata": json.dumps(metadata or {})}
            if _USE_SQLITE:
                with self.get_connection() as conn:
                    conn.cursor().execute(
                        "INSERT INTO analytics_data (user_id,data_type,region,date_recorded,value,metadata) VALUES (?,?,?,?,?,?)",
                        (user_id, data_type, region, str(date_recorded), value, json.dumps(metadata or {}))
                    )
                    conn.commit()
            else:
                _sb_insert("analytics_data", payload)
            return True
        except Exception as e:
            logger.error(f"save_analytics_point failed: {e}")
            return False

    def save_analytics_data(self, user_id: int, analytics_data: Dict) -> bool:
        try:
            today = str(datetime.now().date())
            self.save_analytics_point(user_id, "summary", "", today,
                                      analytics_data["stats"]["totalDetections"],
                                      analytics_data["stats"])
            return True
        except Exception as e:
            logger.error(f"save_analytics_data failed: {e}")
            return False

    def get_analytics_data(self, user_id: int, data_type: str = None, region: str = None,
                           start_date: str = None, end_date: str = None) -> List[Dict]:
        try:
            if _USE_SQLITE:
                with self.get_connection() as conn:
                    cur = conn.cursor()
                    sql = "SELECT * FROM analytics_data WHERE user_id=?"
                    params = [user_id]
                    if data_type: sql += " AND data_type=?"; params.append(data_type)
                    if region:    sql += " AND region=?";    params.append(region)
                    if start_date: sql += " AND date_recorded>=?"; params.append(start_date)
                    if end_date:   sql += " AND date_recorded<=?"; params.append(end_date)
                    sql += " ORDER BY date_recorded ASC"
                    cur.execute(sql, params)
                    rows = [dict(r) for r in cur.fetchall()]
            else:
                filters = f"user_id=eq.{user_id}"
                if data_type:   filters += f"&data_type=eq.{data_type}"
                if region:      filters += f"&region=eq.{region}"
                if start_date:  filters += f"&date_recorded=gte.{start_date}"
                if end_date:    filters += f"&date_recorded=lte.{end_date}"
                rows = _sb_select("analytics_data", "*", filters=filters, order="date_recorded.asc")
            for row in rows:
                if isinstance(row.get("metadata"), str):
                    row["metadata"] = json.loads(row["metadata"] or "{}")
            return rows
        except Exception as e:
            logger.error(f"get_analytics_data failed: {e}")
            return []

    # =========================================================================
    # REPORTS
    # =========================================================================

    def create_report(self, user_id: int, title: str, report_type: str,
                      date_range_days: int = 30) -> Optional[int]:
        try:
            now = datetime.now()
            payload = {
                "user_id": user_id, "title": title, "report_type": report_type,
                "data_range_start": str((now - timedelta(days=date_range_days)).date()),
                "data_range_end": str(now.date()),
                "metadata": '{"status":"generating"}',
            }
            if _USE_SQLITE:
                with self.get_connection() as conn:
                    return self._insert_returning_id(
                        conn,
                        "INSERT INTO reports (user_id,title,report_type,data_range_start,data_range_end,metadata) VALUES (?,?,?,?,?,?)",
                        (user_id, title, report_type, payload["data_range_start"],
                         payload["data_range_end"], payload["metadata"])
                    )
            else:
                row = _sb_insert("reports", payload)
                return row.get("id") if row else None
        except Exception as e:
            logger.error(f"create_report failed: {e}")
            return None

    def update_report(self, report_id: int, report_data: Dict) -> bool:
        try:
            meta = json.dumps({"status": "completed", "data": report_data,
                               "generated_at": datetime.now().isoformat()})
            if _USE_SQLITE:
                with self.get_connection() as conn:
                    conn.cursor().execute(
                        "UPDATE reports SET metadata=? WHERE id=?", (meta, report_id)
                    )
                    conn.commit()
            else:
                _sb_update("reports", {"metadata": meta}, f"id=eq.{report_id}")
            return True
        except Exception as e:
            logger.error(f"update_report failed: {e}")
            return False

    def get_user_reports(self, user_id: int, limit: int = 50, days: int = None) -> List[Dict]:
        try:
            if _USE_SQLITE:
                with self.get_connection() as conn:
                    cur = conn.cursor()
                    sql = ("SELECT id,title,report_type,created_at,data_range_start,data_range_end,metadata "
                           "FROM reports WHERE user_id=?")
                    params = [user_id]
                    if days:
                        sql += " AND created_at>=datetime('now',?)"; params.append(f"-{days} days")
                    sql += " ORDER BY created_at DESC LIMIT ?"; params.append(limit)
                    cur.execute(sql, params)
                    rows = [dict(r) for r in cur.fetchall()]
            else:
                filters = f"user_id=eq.{user_id}"
                if days:
                    cutoff = (datetime.utcnow()-timedelta(days=days)).isoformat()
                    filters += f"&created_at=gte.{cutoff}"
                rows = _sb_select("reports",
                    "id,title,report_type,created_at,data_range_start,data_range_end,metadata",
                    filters=filters, order="created_at.desc", limit=limit)
            result = []
            for row in rows:
                meta = json.loads(row.get("metadata") or "{}")
                result.append({
                    "id": row["id"], "title": row["title"],
                    "report_type": row["report_type"],
                    "created_at": str(row.get("created_at", "")),
                    "data_range_start": str(row.get("data_range_start") or ""),
                    "data_range_end": str(row.get("data_range_end") or ""),
                    "status": meta.get("status", "unknown"),
                    "size": "1.2 MB", "metadata": meta,
                })
            return result
        except Exception as e:
            logger.error(f"get_user_reports failed: {e}")
            return []

    def _get_report_raw(self, report_id: int, user_id: int = None) -> Optional[Dict]:
        try:
            if _USE_SQLITE:
                with self.get_connection() as conn:
                    cur = conn.cursor()
                    sql = "SELECT * FROM reports WHERE id=?"
                    params = [report_id]
                    if user_id: sql += " AND user_id=?"; params.append(user_id)
                    cur.execute(sql, params)
                    row = cur.fetchone()
                    r = dict(row) if row else None
            else:
                filters = f"id=eq.{report_id}"
                if user_id: filters += f"&user_id=eq.{user_id}"
                rows = _sb_select("reports", "*", filters=filters, limit=1)
                r = rows[0] if rows else None
            if r:
                meta = json.loads(r.get("metadata") or "{}")
                r["metadata"] = meta
                r["data"] = meta.get("data", {})
            return r
        except Exception as e:
            logger.error(f"_get_report_raw failed: {e}")
            return None

    def get_report_by_id(self, report_id: int) -> Optional[Dict]:
        return self._get_report_raw(report_id)

    def get_user_report_by_id(self, user_id: int, report_id: int) -> Optional[Dict]:
        return self._get_report_raw(report_id, user_id)

    def delete_report(self, report_id: int, user_id: int) -> bool:
        try:
            if _USE_SQLITE:
                with self.get_connection() as conn:
                    cur = conn.cursor()
                    cur.execute("DELETE FROM reports WHERE id=? AND user_id=?", (report_id, user_id))
                    conn.commit()
                    return cur.rowcount > 0
            else:
                rows = _sb_delete("reports", f"id=eq.{report_id}&user_id=eq.{user_id}")
                return rows > 0
        except Exception as e:
            logger.error(f"delete_report failed: {e}")
            return False

    def delete_all_user_reports(self, user_id: int) -> bool:
        try:
            if _USE_SQLITE:
                with self.get_connection() as conn:
                    conn.cursor().execute("DELETE FROM reports WHERE user_id=?", (user_id,))
                    conn.commit()
            else:
                _sb_delete("reports", f"user_id=eq.{user_id}")
            return True
        except Exception as e:
            logger.error(f"delete_all_user_reports failed: {e}")
            return False

    def update_report_file_path(self, report_id: int, file_path: str) -> bool:
        return True  # File-based reports not used in REST mode

    # =========================================================================
    # LOGGING
    # =========================================================================

    def log_activity(self, user_id: int, level: str, message: str,
                     module: str = "system") -> bool:
        try:
            payload = {"user_id": user_id, "level": level.upper(),
                       "message": message, "module": module}
            if _USE_SQLITE:
                with self.get_connection() as conn:
                    conn.cursor().execute(
                        "INSERT INTO logs (user_id,level,message,module) VALUES (?,?,?,?)",
                        (user_id, level.upper(), message, module)
                    )
                    conn.commit()
            else:
                _sb_insert("logs", payload)
            return True
        except Exception as e:
            logger.error(f"log_activity failed: {e}")
            return False

    def log_system_event(self, user_id: int, level: str, message: str, module: str,
                         function_name: str = None, line_number: int = None,
                         metadata: Dict = None) -> bool:
        try:
            payload = {
                "user_id": user_id, "level": level, "message": message,
                "module": module, "function_name": function_name,
                "line_number": line_number, "metadata": json.dumps(metadata or {}),
            }
            if _USE_SQLITE:
                with self.get_connection() as conn:
                    conn.cursor().execute(
                        "INSERT INTO logs (user_id,level,message,module,function_name,line_number,metadata) VALUES (?,?,?,?,?,?,?)",
                        (user_id, level, message, module, function_name, line_number, json.dumps(metadata or {}))
                    )
                    conn.commit()
            else:
                _sb_insert("logs", payload)
            return True
        except Exception as e:
            logger.error(f"log_system_event failed: {e}")
            return False

    def get_recent_logs(self, limit: int = 50, level: str = None) -> List[Dict]:
        try:
            if _USE_SQLITE:
                with self.get_connection() as conn:
                    cur = conn.cursor()
                    sql = "SELECT id,user_id,level,message,module,timestamp FROM logs"
                    params = []
                    if level: sql += " WHERE level=?"; params.append(level.upper())
                    sql += " ORDER BY timestamp DESC LIMIT ?"; params.append(limit)
                    cur.execute(sql, params)
                    return [dict(r) for r in cur.fetchall()]
            else:
                filters = f"level=eq.{level.upper()}" if level else ""
                return _sb_select("logs", "id,user_id,level,message,module,timestamp",
                    filters=filters, order="timestamp.desc", limit=limit)
        except Exception as e:
            logger.error(f"get_recent_logs failed: {e}")
            return []

    def get_system_logs(self, admin_user_id: int, level: str = None,
                        limit: int = 1000, offset: int = 0) -> List[Dict]:
        admin = self.get_user_by_id(admin_user_id)
        if not admin or admin["role"] != "ADMIN":
            return []
        return self.get_recent_logs(limit=limit, level=level)

    # =========================================================================
    # ADMIN / STATISTICS
    # =========================================================================

    def get_system_stats(self) -> Dict:
        try:
            if _USE_SQLITE:
                with self.get_connection() as conn:
                    cur = conn.cursor()
                    def cnt(sql, p=()):
                        cur.execute(sql, p); return cur.fetchone()[0]
                    return {
                        "active_users": cnt("SELECT COUNT(DISTINCT user_id) FROM sessions WHERE last_used>datetime('now','-1 day')"),
                        "total_detections": cnt("SELECT COUNT(*) FROM detections"),
                        "database_size": 0,
                        "active_sessions": cnt("SELECT COUNT(*) FROM sessions WHERE last_used>datetime('now','-1 hour')"),
                        "api_requests_today": 0,
                        "storage_used": cnt("SELECT COUNT(*) FROM detections") * 2.5,
                    }
            else:
                det_rows  = _sb_select("detections", "id")
                sess_rows = _sb_select("sessions", "user_id,last_used")
                cutoff_day  = (datetime.utcnow()-timedelta(days=1)).isoformat()
                cutoff_hour = (datetime.utcnow()-timedelta(hours=1)).isoformat()
                active_users = len({r["user_id"] for r in sess_rows
                                    if str(r.get("last_used","")) > cutoff_day})
                active_sess  = sum(1 for r in sess_rows
                                   if str(r.get("last_used","")) > cutoff_hour)
                total_det = len(det_rows)
                return {
                    "active_users": active_users,
                    "total_detections": total_det,
                    "database_size": 0,
                    "active_sessions": active_sess,
                    "api_requests_today": 0,
                    "storage_used": round(total_det * 2.5, 2),
                }
        except Exception as e:
            logger.error(f"get_system_stats failed: {e}")
            return {"active_users":0,"total_detections":0,"database_size":0,
                    "active_sessions":0,"api_requests_today":0,"storage_used":0}

    def get_user_statistics(self, user_id: int) -> Dict:
        try:
            if _USE_SQLITE:
                with self.get_connection() as conn:
                    cur = conn.cursor()
                    def cnt(sql, p=()):
                        cur.execute(sql, p); return cur.fetchone()[0]
                    return {
                        "total_detections": cnt("SELECT COUNT(*) FROM detections WHERE user_id=?", (user_id,)),
                        "successful_detections": cnt("SELECT COUNT(*) FROM detections WHERE user_id=? AND status='completed'", (user_id,)),
                        "total_objects_detected": cnt("SELECT COALESCE(SUM(total_detections),0) FROM detections WHERE user_id=? AND status='completed'", (user_id,)),
                        "total_predictions": cnt("SELECT COUNT(*) FROM predictions WHERE user_id=?", (user_id,)),
                        "total_reports": cnt("SELECT COUNT(*) FROM reports WHERE user_id=?", (user_id,)),
                        "recent_detections": cnt("SELECT COUNT(*) FROM detections WHERE user_id=? AND created_at>=datetime('now','-30 days')", (user_id,)),
                    }
            else:
                dets = _sb_select("detections", "id,total_detections,status", filters=f"user_id=eq.{user_id}")
                preds = _sb_select("predictions", "id", filters=f"user_id=eq.{user_id}")
                reps  = _sb_select("reports", "id", filters=f"user_id=eq.{user_id}")
                cutoff = (datetime.utcnow()-timedelta(days=30)).isoformat()
                rec_dets = _sb_select("detections", "id", filters=f"user_id=eq.{user_id}&created_at=gte.{cutoff}")
                total_obj = sum(d.get("total_detections",0) or 0 for d in dets if d.get("status")=="completed")
                return {
                    "total_detections": len(dets),
                    "successful_detections": sum(1 for d in dets if d.get("status")=="completed"),
                    "total_objects_detected": total_obj,
                    "total_predictions": len(preds),
                    "total_reports": len(reps),
                    "recent_detections": len(rec_dets),
                }
        except Exception as e:
            logger.error(f"get_user_statistics failed: {e}")
            return {}

    def get_system_statistics(self, admin_user_id: int) -> Dict:
        admin = self.get_user_by_id(admin_user_id)
        if not admin or admin["role"] != "ADMIN":
            return {}
        return self.get_system_stats()

    # =========================================================================
    # DATABASE MAINTENANCE
    # =========================================================================

    def backup_database(self) -> str:
        if not _USE_SQLITE:
            return "supabase_managed_backup"
        import shutil
        backup_dir = os.path.join(os.path.dirname(self.db_path), "backups")
        os.makedirs(backup_dir, exist_ok=True)
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        path = os.path.join(backup_dir, f"marine_detection_backup_{ts}.db")
        shutil.copy2(self.db_path, path)
        return path

    def optimize_database(self) -> bool:
        if not _USE_SQLITE:
            return True
        try:
            with self.get_connection() as conn:
                conn.cursor().execute("VACUUM")
                conn.cursor().execute("ANALYZE")
                conn.commit()
            return True
        except Exception as e:
            logger.error(f"optimize_database failed: {e}")
            return False

    def cleanup_old_sessions(self, days: int = 7) -> int:
        try:
            if _USE_SQLITE:
                with self.get_connection() as conn:
                    cur = conn.cursor()
                    cur.execute(
                        "DELETE FROM sessions WHERE (expires_at<=datetime('now') OR is_active=0) "
                        "AND created_at<=datetime('now',?)", (f"-{days} days",)
                    )
                    count = cur.rowcount; conn.commit(); return count
            else:
                cutoff = (datetime.utcnow()-timedelta(days=days)).isoformat()
                deleted = _sb_delete("sessions", f"created_at=lte.{cutoff}&is_active=eq.false")
                return deleted
        except Exception as e:
            logger.error(f"cleanup_old_sessions failed: {e}")
            return 0

    def cleanup_old_logs(self, days: int = 30) -> int:
        try:
            if _USE_SQLITE:
                with self.get_connection() as conn:
                    cur = conn.cursor()
                    cur.execute(
                        "DELETE FROM logs WHERE timestamp<=datetime('now',?) AND level NOT IN ('ERROR','CRITICAL')",
                        (f"-{days} days",)
                    )
                    count = cur.rowcount; conn.commit(); return count
            else:
                cutoff = (datetime.utcnow()-timedelta(days=days)).isoformat()
                deleted = _sb_delete("logs", f"timestamp=lte.{cutoff}&level=neq.ERROR&level=neq.CRITICAL")
                return deleted
        except Exception as e:
            logger.error(f"cleanup_old_logs failed: {e}")
            return 0

    def export_system_data(self) -> str:
        return "use_supabase_dashboard_for_export"


# =============================================================================
# _FakeConn — lets security.py session methods work transparently on REST backend
# =============================================================================

class _FakeConn:
    """
    Fake connection object returned by get_connection() in REST mode.
    Intercepts _exec() calls from security.py injected session methods
    and routes them to the Supabase REST API.
    """
    def __init__(self, mgr: "DatabaseManager"):
        self._mgr = mgr
        self._last_rowcount = 0
        self._last_rows = []

    def cursor(self):
        return self

    def commit(self):
        pass

    def fetchone(self):
        return self._last_rows[0] if self._last_rows else None

    def fetchall(self):
        return self._last_rows

    @property
    def rowcount(self):
        return self._last_rowcount

    def _exec(self, query: str, params: tuple = ()):
        """Route SQL to REST API."""
        q = query.strip()
        q_up = q.upper()

        # ── INSERT INTO sessions ────────────────────────────────────────────
        if q_up.startswith("INSERT INTO SESSIONS"):
            # (user_id, token_hash, expires_at, ip_address, user_agent)
            payload = {
                "user_id": params[0], "token_hash": params[1],
                "expires_at": params[2].isoformat() if hasattr(params[2], "isoformat") else str(params[2]),
                "ip_address": params[3] if len(params) > 3 else None,
                "user_agent": params[4] if len(params) > 4 else None,
                "is_active": True,
            }
            _sb_insert("sessions", payload)
            self._last_rowcount = 1
            return self

        # ── SELECT FROM sessions (is_session_active) ────────────────────────
        if q_up.startswith("SELECT") and "SESSIONS" in q_up:
            uid, token_hash = params[0], params[1]
            now_iso = datetime.utcnow().isoformat()
            rows = _sb_select("sessions", "id",
                filters=f"user_id=eq.{uid}&token_hash=eq.{token_hash}&is_active=eq.true&expires_at=gte.{now_iso}",
                limit=1)
            self._last_rows = rows
            self._last_rowcount = len(rows)
            return self

        # ── UPDATE sessions SET last_used ────────────────────────────────────
        if q_up.startswith("UPDATE SESSIONS") and "LAST_USED" in q_up:
            uid, token_hash = params[0], params[1]
            _sb_update("sessions",
                {"last_used": datetime.utcnow().isoformat()},
                f"user_id=eq.{uid}&token_hash=eq.{token_hash}")
            self._last_rowcount = 1
            return self

        # ── UPDATE sessions SET is_active=false (revoke single) ─────────────
        if q_up.startswith("UPDATE SESSIONS") and "IS_ACTIVE=FALSE" in q_up.replace(" ", ""):
            if len(params) == 2:
                uid, token_hash = params[0], params[1]
                _sb_update("sessions", {"is_active": False},
                    f"user_id=eq.{uid}&token_hash=eq.{token_hash}")
            elif len(params) == 1:
                uid = params[0]
                _sb_update("sessions", {"is_active": False}, f"user_id=eq.{uid}")
            self._last_rowcount = 1
            return self

        # ── DELETE FROM sessions (cleanup expired) ───────────────────────────
        if q_up.startswith("DELETE FROM SESSIONS"):
            now_iso = datetime.utcnow().isoformat()
            n = _sb_delete("sessions", f"expires_at=lte.{now_iso}")
            self._last_rowcount = n
            return self

        # ── Fallback: log and no-op ──────────────────────────────────────────
        logger.warning(f"_FakeConn._exec: unhandled query: {q[:80]}")
        self._last_rows = []
        self._last_rowcount = 0
        return self

    # execute() alias (used by some legacy paths)
    def execute(self, query: str, params: tuple = ()):
        return self._exec(query, params)


# Patch DatabaseManager._exec to route through _FakeConn in REST mode
_orig_exec = DatabaseManager._exec

def _patched_exec(self, conn, query: str, params: tuple = ()):
    if not _USE_SQLITE and isinstance(conn, _FakeConn):
        return conn._exec(query, params)
    return _orig_exec(self, conn, query, params)

DatabaseManager._exec = _patched_exec


# =============================================================================
# Update .env with SUPABASE_SERVICE_KEY if not set
# =============================================================================

def _update_env_service_key():
    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
    if not os.path.exists(env_path):
        return
    with open(env_path, "r") as f:
        content = f.read()
    if "SUPABASE_SERVICE_KEY" not in content:
        with open(env_path, "a") as f:
            f.write(f"\nSUPABASE_SERVICE_KEY={SUPABASE_SERVICE_KEY}\n")

if not _USE_SQLITE:
    try:
        _update_env_service_key()
    except Exception:
        pass


# =============================================================================
# Global singleton
# =============================================================================
db = DatabaseManager()
