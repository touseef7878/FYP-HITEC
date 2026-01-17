"""
Database Module
Handles all database operations for the marine detection system
"""

import sqlite3
import os
import json
import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any
import logging
from contextlib import contextmanager

logger = logging.getLogger(__name__)

class DatabaseManager:
    """Centralized database manager for all operations"""
    
    def __init__(self, db_path: str = None):
        if db_path is None:
            db_path = os.path.join(os.path.dirname(__file__), "marine_detection.db")
        self.db_path = db_path
        
        # Ensure database exists
        if not os.path.exists(db_path):
            logger.warning(f"Database not found at {db_path}. Run init_db.py first!")
    
    @contextmanager
    def get_connection(self):
        """Context manager for database connections"""
        conn = None
        try:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row  # Enable dict-like access
            yield conn
        except Exception as e:
            if conn:
                conn.rollback()
            logger.error(f"Database error: {e}")
            raise
        finally:
            if conn:
                conn.close()
    
    def hash_password(self, password: str) -> str:
        """Hash password with salt"""
        salt = secrets.token_hex(16)
        password_hash = hashlib.sha256((password + salt).encode()).hexdigest()
        return f"{salt}:{password_hash}"
    
    def verify_password(self, password: str, password_hash: str) -> bool:
        """Verify password against hash"""
        try:
            salt, hash_value = password_hash.split(':')
            return hashlib.sha256((password + salt).encode()).hexdigest() == hash_value
        except:
            return False
    
    # ==================== USER MANAGEMENT ====================
    
    def create_user(self, username: str, email: str, password: str, role: str = "USER") -> Optional[int]:
        """Create a new user"""
        try:
            password_hash = self.hash_password(password)
            
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO users (username, email, password_hash, role, profile_data)
                    VALUES (?, ?, ?, ?, ?)
                """, (username, email, password_hash, role, '{}'))
                
                user_id = cursor.lastrowid
                conn.commit()
                
                logger.info(f"Created user: {username} (ID: {user_id})")
                return user_id
                
        except sqlite3.IntegrityError as e:
            logger.error(f"User creation failed - duplicate: {e}")
            return None
        except Exception as e:
            logger.error(f"User creation failed: {e}")
            return None
    
    def authenticate_user(self, username: str, password: str) -> Optional[Dict]:
        """Authenticate user and return user data"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT id, username, email, password_hash, role, is_active, 
                           created_at, last_login, profile_data
                    FROM users WHERE username = ? OR email = ?
                """, (username, username))
                
                user = cursor.fetchone()
                
                if user and user['is_active'] and self.verify_password(password, user['password_hash']):
                    # Update last login
                    cursor.execute("""
                        UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?
                    """, (user['id'],))
                    conn.commit()
                    
                    # Get updated user data with new last_login
                    cursor.execute("""
                        SELECT id, username, email, role, created_at, last_login, profile_data
                        FROM users WHERE id = ?
                    """, (user['id'],))
                    
                    updated_user = cursor.fetchone()
                    
                    return {
                        'id': updated_user['id'],
                        'username': updated_user['username'],
                        'email': updated_user['email'],
                        'role': updated_user['role'],
                        'created_at': updated_user['created_at'],
                        'last_login': updated_user['last_login'],
                        'profile_data': json.loads(updated_user['profile_data'] or '{}')
                    }
                
                return None
                
        except Exception as e:
            logger.error(f"Authentication failed: {e}")
            return None
    
    def get_user_by_id(self, user_id: int) -> Optional[Dict]:
        """Get user by ID"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT id, username, email, role, created_at, last_login, is_active, profile_data
                    FROM users WHERE id = ?
                """, (user_id,))
                
                user = cursor.fetchone()
                if user:
                    return {
                        'id': user['id'],
                        'username': user['username'],
                        'email': user['email'],
                        'role': user['role'],
                        'created_at': user['created_at'],
                        'last_login': user['last_login'],
                        'is_active': bool(user['is_active']),
                        'profile_data': json.loads(user['profile_data'] or '{}')
                    }
                return None
                
        except Exception as e:
            logger.error(f"Get user failed: {e}")
            return None
    
    def get_all_users(self, admin_user_id: int) -> List[Dict]:
        """Get all users (admin only)"""
        try:
            # Verify admin role
            admin = self.get_user_by_id(admin_user_id)
            if not admin or admin['role'] != 'ADMIN':
                return []
            
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT id, username, email, role, created_at, last_login, is_active
                    FROM users ORDER BY created_at DESC
                """)
                
                users = []
                for row in cursor.fetchall():
                    users.append({
                        'id': row['id'],
                        'username': row['username'],
                        'email': row['email'],
                        'role': row['role'],
                        'created_at': row['created_at'],
                        'last_login': row['last_login'],
                        'is_active': bool(row['is_active'])
                    })
                
                return users
                
        except Exception as e:
            logger.error(f"Get all users failed: {e}")
            return []
    
    def update_user_profile(self, user_id: int, profile_data: Dict) -> bool:
        """Update user profile data"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    UPDATE users SET profile_data = ? WHERE id = ?
                """, (json.dumps(profile_data), user_id))
                
                conn.commit()
                return cursor.rowcount > 0
                
        except Exception as e:
            logger.error(f"Update profile failed: {e}")
            return False
    
    def deactivate_user(self, admin_user_id: int, target_user_id: int) -> bool:
        """Deactivate user (admin only)"""
        try:
            # Verify admin role
            admin = self.get_user_by_id(admin_user_id)
            if not admin or admin['role'] != 'ADMIN':
                return False
            
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    UPDATE users SET is_active = 0 WHERE id = ? AND id != ?
                """, (target_user_id, admin_user_id))  # Prevent admin from deactivating themselves
                
                conn.commit()
                return cursor.rowcount > 0
                
        except Exception as e:
            logger.error(f"Deactivate user failed: {e}")
            return False
    
    # ==================== DETECTION MANAGEMENT ====================
    
    def create_detection(self, user_id: int, filename: str, file_type: str, 
                        file_path: str = None, file_size: int = None,
                        total_detections: int = 0, confidence_threshold: float = 0.25,
                        processing_time: float = None, metadata: Dict = None) -> Optional[int]:
        """Create a new detection record"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO detections (user_id, filename, file_type, file_path, file_size, 
                                          total_detections, confidence_threshold, processing_time, 
                                          status, metadata)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?)
                """, (user_id, filename, file_type, file_path, file_size, total_detections,
                     confidence_threshold, processing_time, json.dumps(metadata or {})))
                
                detection_id = cursor.lastrowid
                conn.commit()
                
                logger.info(f"Created detection: {filename} (ID: {detection_id})")
                return detection_id
                
        except Exception as e:
            logger.error(f"Create detection failed: {e}")
            return None
    
    def add_detection_result(self, detection_id: int, class_name: str, confidence: float,
                            bbox_x1: float, bbox_y1: float, bbox_x2: float, bbox_y2: float,
                            frame_number: int = 0) -> bool:
        """Add a single detection result"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO detection_results 
                    (detection_id, class_name, confidence, bbox_x1, bbox_y1, bbox_x2, bbox_y2, frame_number)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (detection_id, class_name, confidence, bbox_x1, bbox_y1, bbox_x2, bbox_y2, frame_number))
                
                conn.commit()
                return True
                
        except Exception as e:
            logger.error(f"Add detection result failed: {e}")
            return False
    
    def save_image_metadata(self, detection_id: int, width: int, height: int,
                           original_path: str = None, annotated_path: str = None) -> bool:
        """Save image metadata"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO images (detection_id, width, height, original_path, annotated_path)
                    VALUES (?, ?, ?, ?, ?)
                """, (detection_id, width, height, original_path, annotated_path))
                
                conn.commit()
                return True
                
        except Exception as e:
            logger.error(f"Save image metadata failed: {e}")
            return False
    
    def save_video_metadata(self, detection_id: int, total_frames: int, processed_frames: int,
                           fps: float, duration: float, resolution: str,
                           original_path: str = None, annotated_path: str = None) -> bool:
        """Save video metadata"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO videos (detection_id, total_frames, processed_frames, fps, 
                                      duration, resolution, original_path, annotated_path)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (detection_id, total_frames, processed_frames, fps, duration, resolution,
                     original_path, annotated_path))
                
                conn.commit()
                return True
                
        except Exception as e:
            logger.error(f"Save video metadata failed: {e}")
            return False
    
    def get_video_metadata(self, detection_id: int) -> Optional[Dict]:
        """Get video metadata by detection ID"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT * FROM videos WHERE detection_id = ?
                """, (detection_id,))
                
                row = cursor.fetchone()
                if row:
                    return dict(row)
                return None
                
        except Exception as e:
            logger.error(f"Get video metadata failed: {e}")
            return None
    
    def update_detection_status(self, detection_id: int, status: str, 
                               total_detections: int = None, processing_time: float = None,
                               error_message: str = None, metadata: Dict = None) -> bool:
        """Update detection status and results"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                
                update_fields = ["status = ?"]
                params = [status]
                
                if total_detections is not None:
                    update_fields.append("total_detections = ?")
                    params.append(total_detections)
                
                if processing_time is not None:
                    update_fields.append("processing_time = ?")
                    params.append(processing_time)
                
                if error_message is not None:
                    update_fields.append("error_message = ?")
                    params.append(error_message)
                
                if metadata is not None:
                    update_fields.append("metadata = ?")
                    params.append(json.dumps(metadata))
                
                params.append(detection_id)
                
                cursor.execute(f"""
                    UPDATE detections SET {', '.join(update_fields)} WHERE id = ?
                """, params)
                
                conn.commit()
                return cursor.rowcount > 0
                
        except Exception as e:
            logger.error(f"Update detection status failed: {e}")
            return False
    
    def add_detection_results(self, detection_id: int, results: List[Dict]) -> bool:
        """Add individual detection results"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                
                for result in results:
                    cursor.execute("""
                        INSERT INTO detection_results 
                        (detection_id, class_name, confidence, bbox_x1, bbox_y1, bbox_x2, bbox_y2, frame_number)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        detection_id,
                        result['class'],
                        result['confidence'],
                        result['bbox']['x1'],
                        result['bbox']['y1'],
                        result['bbox']['x2'],
                        result['bbox']['y2'],
                        result.get('frame_number', 0)
                    ))
                
                conn.commit()
                return True
                
        except Exception as e:
            logger.error(f"Add detection results failed: {e}")
            return False
    
    def get_user_detections(self, user_id: int, limit: int = 50, offset: int = 0, days: int = None) -> List[Dict]:
        """Get user's detection history with optional date filtering"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                
                # Build query with optional date filter
                query = """
                    SELECT d.*, 
                           COUNT(dr.id) as result_count,
                           v.total_frames, v.fps, v.duration,
                           i.width, i.height
                    FROM detections d
                    LEFT JOIN detection_results dr ON d.id = dr.detection_id
                    LEFT JOIN videos v ON d.id = v.detection_id
                    LEFT JOIN images i ON d.id = i.detection_id
                    WHERE d.user_id = ?
                """
                
                params = [user_id]
                
                # Add date filter if specified
                if days is not None:
                    from datetime import datetime, timedelta
                    cutoff_date = datetime.now() - timedelta(days=days)
                    query += " AND d.created_at >= ?"
                    params.append(cutoff_date.isoformat())
                
                query += """
                    GROUP BY d.id
                    ORDER BY d.created_at DESC
                    LIMIT ? OFFSET ?
                """
                params.extend([limit, offset])
                
                cursor.execute(query, params)
                
                detections = []
                for row in cursor.fetchall():
                    detection = dict(row)
                    detection['metadata'] = json.loads(detection['metadata'] or '{}')
                    detections.append(detection)
                
                return detections
                
        except Exception as e:
            logger.error(f"Get user detections failed: {e}")
            return []
    
    def get_detection_by_id(self, detection_id: int, user_id: int = None) -> Optional[Dict]:
        """Get detection by ID with results"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                
                # Get detection info
                query = "SELECT * FROM detections WHERE id = ?"
                params = [detection_id]
                
                if user_id is not None:
                    query += " AND user_id = ?"
                    params.append(user_id)
                
                cursor.execute(query, params)
                detection = cursor.fetchone()
                
                if not detection:
                    return None
                
                detection = dict(detection)
                detection['metadata'] = json.loads(detection['metadata'] or '{}')
                
                # Get detection results
                cursor.execute("""
                    SELECT * FROM detection_results WHERE detection_id = ?
                """, (detection_id,))
                
                results = []
                for row in cursor.fetchall():
                    results.append({
                        'class': row['class_name'],
                        'confidence': row['confidence'],
                        'bbox': {
                            'x1': row['bbox_x1'],
                            'y1': row['bbox_y1'],
                            'x2': row['bbox_x2'],
                            'y2': row['bbox_y2']
                        },
                        'frame_number': row['frame_number']
                    })
                
                detection['results'] = results
                return detection
                
        except Exception as e:
            logger.error(f"Get detection by ID failed: {e}")
            return None
    
    def delete_detection(self, detection_id: int, user_id: int) -> bool:
        """Delete detection (user can only delete their own)"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    DELETE FROM detections WHERE id = ? AND user_id = ?
                """, (detection_id, user_id))
                
                conn.commit()
                return cursor.rowcount > 0
                
        except Exception as e:
            logger.error(f"Delete detection failed: {e}")
            return False
    
    # ==================== PREDICTION MANAGEMENT ====================
    
    def save_prediction(self, user_id: int, region: str, prediction_date: str,
                       predicted_pollution_level: float, confidence_interval: Tuple[float, float] = None,
                       model_version: str = None, input_features: Dict = None) -> Optional[int]:
        """Save LSTM prediction"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO predictions 
                    (user_id, region, prediction_date, predicted_pollution_level, 
                     confidence_interval_lower, confidence_interval_upper, model_version, input_features)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    user_id, region, prediction_date, predicted_pollution_level,
                    confidence_interval[0] if confidence_interval else None,
                    confidence_interval[1] if confidence_interval else None,
                    model_version,
                    json.dumps(input_features or {})
                ))
                
                prediction_id = cursor.lastrowid
                conn.commit()
                
                return prediction_id
                
        except Exception as e:
            logger.error(f"Save prediction failed: {e}")
            return None
    
    def get_user_predictions(self, user_id: int, region: str = None, limit: int = 100, days: int = None) -> List[Dict]:
        """Get user's predictions with optional date filtering"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                
                query = """
                    SELECT id, region, prediction_date, predicted_pollution_level,
                           confidence_interval_lower, confidence_interval_upper,
                           model_version, input_features, created_at
                    FROM predictions 
                    WHERE user_id = ?
                """
                params = [user_id]
                
                if region:
                    query += " AND region = ?"
                    params.append(region)
                
                # Add date filter if specified
                if days is not None:
                    from datetime import datetime, timedelta
                    cutoff_date = datetime.now() - timedelta(days=days)
                    query += " AND created_at >= ?"
                    params.append(cutoff_date.isoformat())
                
                query += " ORDER BY created_at DESC LIMIT ?"
                params.append(limit)
                
                cursor.execute(query, params)
                
                predictions = []
                for row in cursor.fetchall():
                    import json
                    input_features = json.loads(row['input_features']) if row['input_features'] else {}
                    
                    predictions.append({
                        'id': row['id'],
                        'region': row['region'],
                        'prediction_date': row['prediction_date'],
                        'predicted_pollution_level': row['predicted_pollution_level'],
                        'confidence_interval_lower': row['confidence_interval_lower'],
                        'confidence_interval_upper': row['confidence_interval_upper'],
                        'model_version': row['model_version'],
                        'input_features': input_features,
                        'created_at': row['created_at']
                    })
                
                return predictions
                
        except Exception as e:
            logger.error(f"Get user predictions failed: {e}")
            return []
    
    # ==================== ANALYTICS & REPORTS ====================
    
    def save_analytics_data(self, user_id: int, data_type: str, region: str,
                           date_recorded: str, value: float, metadata: Dict = None) -> bool:
        """Save analytics data point"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO analytics_data (user_id, data_type, region, date_recorded, value, metadata)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (user_id, data_type, region, date_recorded, value, json.dumps(metadata or {})))
                
                conn.commit()
                return True
                
        except Exception as e:
            logger.error(f"Save analytics data failed: {e}")
            return False
    
    def get_analytics_data(self, user_id: int, data_type: str = None, region: str = None,
                          start_date: str = None, end_date: str = None) -> List[Dict]:
        """Get analytics data"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                
                query = "SELECT * FROM analytics_data WHERE user_id = ?"
                params = [user_id]
                
                if data_type:
                    query += " AND data_type = ?"
                    params.append(data_type)
                
                if region:
                    query += " AND region = ?"
                    params.append(region)
                
                if start_date:
                    query += " AND date_recorded >= ?"
                    params.append(start_date)
                
                if end_date:
                    query += " AND date_recorded <= ?"
                    params.append(end_date)
                
                query += " ORDER BY date_recorded ASC"
                
                cursor.execute(query, params)
                
                data = []
                for row in cursor.fetchall():
                    item = dict(row)
                    item['metadata'] = json.loads(item['metadata'] or '{}')
                    data.append(item)
                
                return data
                
        except Exception as e:
            logger.error(f"Get analytics data failed: {e}")
            return []
    
    def get_user_reports(self, user_id: int, limit: int = 50) -> List[Dict]:
        """Get user's reports"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT * FROM reports WHERE user_id = ? 
                    ORDER BY created_at DESC LIMIT ?
                """, (user_id, limit))
                
                reports = []
                for row in cursor.fetchall():
                    report = dict(row)
                    report['metadata'] = json.loads(report['metadata'] or '{}')
                    reports.append(report)
                
                return reports
                
        except Exception as e:
            logger.error(f"Get user reports failed: {e}")
            return []
    
    # ==================== LOGGING ====================
    
    def log_activity(self, level: str, message: str, user_id: int = None,
                    module: str = None, function_name: str = None, 
                    line_number: int = None, metadata: Dict = None) -> bool:
        """Log system activity"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO logs (user_id, level, message, module, function_name, line_number, metadata)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (user_id, level, message, module, function_name, line_number, json.dumps(metadata or {})))
                
                conn.commit()
                return True
                
        except Exception as e:
            logger.error(f"Log activity failed: {e}")
            return False
    
    def get_system_logs(self, admin_user_id: int, level: str = None, 
                       limit: int = 1000, offset: int = 0) -> List[Dict]:
        """Get system logs (admin only)"""
        try:
            # Verify admin role
            admin = self.get_user_by_id(admin_user_id)
            if not admin or admin['role'] != 'ADMIN':
                return []
            
            with self.get_connection() as conn:
                cursor = conn.cursor()
                
                query = """
                    SELECT l.*, u.username 
                    FROM logs l 
                    LEFT JOIN users u ON l.user_id = u.id
                    WHERE 1=1
                """
                params = []
                
                if level:
                    query += " AND l.level = ?"
                    params.append(level)
                
                query += " ORDER BY l.timestamp DESC LIMIT ? OFFSET ?"
                params.extend([limit, offset])
                
                cursor.execute(query, params)
                
                logs = []
                for row in cursor.fetchall():
                    log = dict(row)
                    log['metadata'] = json.loads(log['metadata'] or '{}')
                    logs.append(log)
                
                return logs
                
        except Exception as e:
            logger.error(f"Get system logs failed: {e}")
            return []
    
    # ==================== STATISTICS ====================
    
    def get_user_statistics(self, user_id: int) -> Dict:
        """Get user statistics"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                
                stats = {}
                
                # Detection count
                cursor.execute("SELECT COUNT(*) FROM detections WHERE user_id = ?", (user_id,))
                stats['total_detections'] = cursor.fetchone()[0]
                
                # Successful detections
                cursor.execute("SELECT COUNT(*) FROM detections WHERE user_id = ? AND status = 'completed'", (user_id,))
                stats['successful_detections'] = cursor.fetchone()[0]
                
                # Total objects detected
                cursor.execute("""
                    SELECT COALESCE(SUM(total_detections), 0) 
                    FROM detections WHERE user_id = ? AND status = 'completed'
                """, (user_id,))
                stats['total_objects_detected'] = cursor.fetchone()[0]
                
                # Prediction count
                cursor.execute("SELECT COUNT(*) FROM predictions WHERE user_id = ?", (user_id,))
                stats['total_predictions'] = cursor.fetchone()[0]
                
                # Report count
                cursor.execute("SELECT COUNT(*) FROM reports WHERE user_id = ?", (user_id,))
                stats['total_reports'] = cursor.fetchone()[0]
                
                # Recent activity (last 30 days)
                cursor.execute("""
                    SELECT COUNT(*) FROM detections 
                    WHERE user_id = ? AND created_at >= datetime('now', '-30 days')
                """, (user_id,))
                stats['recent_detections'] = cursor.fetchone()[0]
                
                return stats
                
        except Exception as e:
            logger.error(f"Get user statistics failed: {e}")
            return {}
    
    def get_system_statistics(self, admin_user_id: int) -> Dict:
        """Get system-wide statistics (admin only)"""
        try:
            # Verify admin role
            admin = self.get_user_by_id(admin_user_id)
            if not admin or admin['role'] != 'ADMIN':
                return {}
            
            with self.get_connection() as conn:
                cursor = conn.cursor()
                
                stats = {}
                
                # User counts
                cursor.execute("SELECT COUNT(*) FROM users WHERE is_active = 1")
                stats['active_users'] = cursor.fetchone()[0]
                
                cursor.execute("SELECT COUNT(*) FROM users")
                stats['total_users'] = cursor.fetchone()[0]
                
                # Detection counts
                cursor.execute("SELECT COUNT(*) FROM detections")
                stats['total_detections'] = cursor.fetchone()[0]
                
                cursor.execute("SELECT COUNT(*) FROM detections WHERE status = 'completed'")
                stats['successful_detections'] = cursor.fetchone()[0]
                
                # Storage usage (approximate)
                cursor.execute("SELECT COALESCE(SUM(file_size), 0) FROM detections WHERE file_size IS NOT NULL")
                stats['total_storage_bytes'] = cursor.fetchone()[0]
                
                # Recent activity
                cursor.execute("""
                    SELECT COUNT(*) FROM detections 
                    WHERE created_at >= datetime('now', '-7 days')
                """)
                stats['detections_last_7_days'] = cursor.fetchone()[0]
                
                cursor.execute("""
                    SELECT COUNT(*) FROM users 
                    WHERE last_login >= datetime('now', '-7 days')
                """)
                stats['active_users_last_7_days'] = cursor.fetchone()[0]
                
                return stats
                
        except Exception as e:
            logger.error(f"Get system statistics failed: {e}")
            return {}
    
    # ==================== ADMIN METHODS ====================
    
    def get_system_stats(self) -> Dict:
        """Get system statistics for admin dashboard"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                
                stats = {}
                
                # Active users (logged in within last 24 hours)
                cursor.execute("""
                    SELECT COUNT(*) FROM users 
                    WHERE is_active = 1 AND last_login >= datetime('now', '-1 day')
                """)
                stats['active_users'] = cursor.fetchone()[0]
                
                # Total detections
                cursor.execute("SELECT COUNT(*) FROM detections")
                stats['total_detections'] = cursor.fetchone()[0]
                
                # Database size (approximate)
                cursor.execute("SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()")
                result = cursor.fetchone()
                stats['database_size'] = result[0] if result else 0
                
                # API requests today (using detections as proxy)
                cursor.execute("""
                    SELECT COUNT(*) FROM detections 
                    WHERE created_at >= date('now')
                """)
                stats['api_requests_today'] = cursor.fetchone()[0]
                
                # Storage used
                cursor.execute("SELECT COALESCE(SUM(file_size), 0) FROM detections WHERE file_size IS NOT NULL")
                stats['storage_used'] = cursor.fetchone()[0]
                
                # Active sessions
                cursor.execute("""
                    SELECT COUNT(*) FROM sessions 
                    WHERE is_active = 1 AND expires_at > datetime('now')
                """)
                stats['active_sessions'] = cursor.fetchone()[0]
                
                return stats
                
        except Exception as e:
            logger.error(f"Get system stats failed: {e}")
            return {}
    
    def get_recent_logs(self, limit: int = 20, level: str = None) -> List[Dict]:
        """Get recent system logs"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                
                query = """
                    SELECT l.*, u.username 
                    FROM logs l 
                    LEFT JOIN users u ON l.user_id = u.id
                    WHERE 1=1
                """
                params = []
                
                if level:
                    query += " AND l.level = ?"
                    params.append(level)
                
                query += " ORDER BY l.timestamp DESC LIMIT ?"
                params.append(limit)
                
                cursor.execute(query, params)
                
                logs = []
                for row in cursor.fetchall():
                    log = dict(row)
                    log['metadata'] = json.loads(log['metadata'] or '{}')
                    logs.append(log)
                
                return logs
                
        except Exception as e:
            logger.error(f"Get recent logs failed: {e}")
            return []
    
    def backup_database(self) -> str:
        """Create database backup"""
        try:
            import shutil
            from datetime import datetime
            
            backup_dir = os.path.join(os.path.dirname(self.db_path), "backups")
            os.makedirs(backup_dir, exist_ok=True)
            
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_filename = f"marine_detection_backup_{timestamp}.db"
            backup_path = os.path.join(backup_dir, backup_filename)
            
            shutil.copy2(self.db_path, backup_path)
            
            logger.info(f"Database backup created: {backup_path}")
            return backup_path
            
        except Exception as e:
            logger.error(f"Database backup failed: {e}")
            raise
    
    def optimize_database(self) -> bool:
        """Optimize database performance"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                
                # Run VACUUM to reclaim space and defragment
                cursor.execute("VACUUM")
                
                # Analyze tables for query optimization
                cursor.execute("ANALYZE")
                
                conn.commit()
                
            logger.info("Database optimization completed")
            return True
            
        except Exception as e:
            logger.error(f"Database optimization failed: {e}")
            return False
    
    def export_system_data(self) -> str:
        """Export system data to JSON"""
        try:
            import json
            from datetime import datetime
            
            export_dir = os.path.join(os.path.dirname(self.db_path), "exports")
            os.makedirs(export_dir, exist_ok=True)
            
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            export_filename = f"system_data_export_{timestamp}.json"
            export_path = os.path.join(export_dir, export_filename)
            
            with self.get_connection() as conn:
                cursor = conn.cursor()
                
                export_data = {}
                
                # Export users (without passwords)
                cursor.execute("""
                    SELECT id, username, email, role, created_at, last_login, is_active 
                    FROM users
                """)
                export_data['users'] = [dict(row) for row in cursor.fetchall()]
                
                # Export detections
                cursor.execute("SELECT * FROM detections")
                export_data['detections'] = [dict(row) for row in cursor.fetchall()]
                
                # Export predictions
                cursor.execute("SELECT * FROM predictions")
                export_data['predictions'] = [dict(row) for row in cursor.fetchall()]
                
                # Export reports
                cursor.execute("SELECT * FROM reports")
                export_data['reports'] = [dict(row) for row in cursor.fetchall()]
                
                # Export analytics
                cursor.execute("SELECT * FROM analytics_data")
                export_data['analytics'] = [dict(row) for row in cursor.fetchall()]
            
            # Write to JSON file
            with open(export_path, 'w') as f:
                json.dump(export_data, f, indent=2, default=str)
            
            logger.info(f"System data exported: {export_path}")
            return export_path
            
        except Exception as e:
            logger.error(f"System data export failed: {e}")
            raise
    
    def cleanup_old_sessions(self, days: int = 7) -> int:
        """Clean up old inactive sessions"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                
                cursor.execute("""
                    DELETE FROM sessions 
                    WHERE (expires_at <= datetime('now') OR is_active = 0)
                    AND created_at <= datetime('now', '-{} days')
                """.format(days))
                
                deleted_count = cursor.rowcount
                conn.commit()
                
                if deleted_count > 0:
                    logger.info(f"Cleaned up {deleted_count} old sessions")
                
                return deleted_count
                
        except Exception as e:
            logger.error(f"Cleanup old sessions failed: {e}")
            return 0
    
    def cleanup_old_logs(self, days: int = 30) -> int:
        """Clean up old log entries"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                
                cursor.execute("""
                    DELETE FROM logs 
                    WHERE timestamp <= datetime('now', '-{} days')
                    AND level NOT IN ('error', 'critical')
                """.format(days))
                
                deleted_count = cursor.rowcount
                conn.commit()
                
                if deleted_count > 0:
                    logger.info(f"Cleaned up {deleted_count} old log entries")
                
                return deleted_count
                
        except Exception as e:
            logger.error(f"Cleanup old logs failed: {e}")
            return 0
    
    def get_all_users(self) -> List[Dict]:
        """Get all users (admin only)"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                
                cursor.execute("""
                    SELECT id, username, email, role, created_at, last_login, is_active
                    FROM users
                    ORDER BY created_at DESC
                """)
                
                users = []
                for row in cursor.fetchall():
                    users.append(dict(row))
                
                return users
                
        except Exception as e:
            logger.error(f"Get all users failed: {e}")
            return []
    
    def deactivate_user(self, user_id: int) -> bool:
        """Deactivate a user account"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                
                cursor.execute("""
                    UPDATE users SET is_active = 0 WHERE id = ?
                """, (user_id,))
                
                success = cursor.rowcount > 0
                conn.commit()
                
                if success:
                    # Also revoke all sessions
                    cursor.execute("""
                        UPDATE sessions SET is_active = 0 WHERE user_id = ?
                    """, (user_id,))
                    conn.commit()
                
                return success
                
        except Exception as e:
            logger.error(f"Deactivate user failed: {e}")
            return False
    
    def get_user_by_username(self, username: str) -> Optional[Dict]:
        """Get user by username"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT id, username, email, password_hash, role, is_active, 
                           created_at, last_login, profile_data
                    FROM users WHERE username = ?
                """, (username,))
                
                user = cursor.fetchone()
                return dict(user) if user else None
                
        except Exception as e:
            logger.error(f"Get user by username failed: {e}")
            return None
    
    def get_user_by_email(self, email: str) -> Optional[Dict]:
        """Get user by email"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT id, username, email, password_hash, role, is_active, 
                           created_at, last_login, profile_data
                    FROM users WHERE email = ?
                """, (email,))
                
                user = cursor.fetchone()
                return dict(user) if user else None
                
        except Exception as e:
            logger.error(f"Get user by email failed: {e}")
            return None
    
    def update_user_last_login(self, user_id: int) -> bool:
        """Update user's last login timestamp"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?
                """, (user_id,))
                
                conn.commit()
                return cursor.rowcount > 0
                
        except Exception as e:
            logger.error(f"Update last login failed: {e}")
            return False
    
    def invalidate_user_sessions(self, user_id: int) -> bool:
        """Invalidate all sessions for a user"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    UPDATE sessions SET is_active = 0 WHERE user_id = ?
                """, (user_id,))
                
                conn.commit()
                return cursor.rowcount > 0
                
        except Exception as e:
            logger.error(f"Invalidate user sessions failed: {e}")
            return False
    
    def update_user_profile(self, user_id: int, email: str = None, profile_data: Dict = None) -> bool:
        """Update user profile"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                
                updates = []
                params = []
                
                if email:
                    updates.append("email = ?")
                    params.append(email)
                
                if profile_data:
                    updates.append("profile_data = ?")
                    params.append(json.dumps(profile_data))
                
                if not updates:
                    return True
                
                params.append(user_id)
                
                cursor.execute(f"""
                    UPDATE users SET {', '.join(updates)} WHERE id = ?
                """, params)
                
                conn.commit()
                return cursor.rowcount > 0
                
        except Exception as e:
            logger.error(f"Update user profile failed: {e}")
            return False
    
    def update_user_password(self, user_id: int, new_password: str) -> bool:
        """Update user password"""
        try:
            password_hash = self.hash_password(new_password)
            
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    UPDATE users SET password_hash = ? WHERE id = ?
                """, (password_hash, user_id))
                
                conn.commit()
                return cursor.rowcount > 0
                
        except Exception as e:
            logger.error(f"Update user password failed: {e}")
            return False
    
    def delete_detection(self, detection_id: int) -> bool:
        """Delete a detection and its associated data"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                
                # Delete associated files (this would need file cleanup logic)
                # For now, just delete database records
                
                # Delete detection results
                cursor.execute("DELETE FROM detection_results WHERE detection_id = ?", (detection_id,))
                
                # Delete video/image records
                cursor.execute("DELETE FROM videos WHERE detection_id = ?", (detection_id,))
                cursor.execute("DELETE FROM images WHERE detection_id = ?", (detection_id,))
                
                # Delete main detection record
                cursor.execute("DELETE FROM detections WHERE id = ?", (detection_id,))
                
                success = cursor.rowcount > 0
                conn.commit()
                
                return success
                
        except Exception as e:
            logger.error(f"Delete detection failed: {e}")
            return False
    
    def update_report_file_path(self, report_id: int, file_path: str) -> bool:
        """Update report file path"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                
                # Get file size
                file_size = os.path.getsize(file_path) if os.path.exists(file_path) else 0
                
                cursor.execute("""
                    UPDATE reports SET file_path = ?, file_size = ? WHERE id = ?
                """, (file_path, file_size, report_id))
                
                conn.commit()
                return cursor.rowcount > 0
                
        except Exception as e:
            logger.error(f"Update report file path failed: {e}")
            return False
    
    def get_report_by_id(self, report_id: int) -> Optional[Dict]:
        """Get report by ID"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT * FROM reports WHERE id = ?
                """, (report_id,))
                
                report = cursor.fetchone()
                if report:
                    report = dict(report)
                    report['data_range'] = json.loads(report['data_range'] or '{}')
                    report['metadata'] = json.loads(report['metadata'] or '{}')
                
                return report
                
        except Exception as e:
            logger.error(f"Get report by ID failed: {e}")
            return None
    
    def log_system_event(self, user_id: int, level: str, message: str, module: str, function_name: str = None, line_number: int = None, metadata: Dict = None) -> bool:
        """Log system event"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                
                cursor.execute("""
                    INSERT INTO logs (user_id, level, message, module, function_name, line_number, metadata)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (user_id, level, message, module, function_name, line_number, json.dumps(metadata or {})))
                
                conn.commit()
                return True
                
        except Exception as e:
            logger.error(f"Log system event failed: {e}")
            return False

# Global database instance
    
    # ==================== ANALYTICS MANAGEMENT ====================
    
    def save_analytics_data(self, user_id: int, analytics_data: Dict) -> bool:
        """Save analytics data for user"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                
                # Save different types of analytics data
                import json
                from datetime import datetime
                
                today = datetime.now().date()
                
                # Save summary stats
                cursor.execute("""
                    INSERT OR REPLACE INTO analytics_data 
                    (user_id, data_type, date_recorded, value, metadata)
                    VALUES (?, ?, ?, ?, ?)
                """, (
                    user_id, 'summary', today, 
                    analytics_data['stats']['totalDetections'],
                    json.dumps(analytics_data['stats'])
                ))
                
                # Save trend data
                for trend in analytics_data.get('trendData', []):
                    cursor.execute("""
                        INSERT OR REPLACE INTO analytics_data 
                        (user_id, data_type, date_recorded, value, metadata)
                        VALUES (?, ?, ?, ?, ?)
                    """, (
                        user_id, 'trend', trend['date'], 
                        trend['detections'],
                        json.dumps(trend)
                    ))
                
                # Save class distribution
                for class_data in analytics_data.get('classDistribution', []):
                    cursor.execute("""
                        INSERT OR REPLACE INTO analytics_data 
                        (user_id, data_type, date_recorded, value, metadata)
                        VALUES (?, ?, ?, ?, ?)
                    """, (
                        user_id, 'heatmap', today, 
                        class_data['value'],
                        json.dumps(class_data)
                    ))
                
                conn.commit()
                return True
                
        except Exception as e:
            logger.error(f"Save analytics data failed: {e}")
            return False
    
    def get_detection_results(self, detection_id: int, user_id: int = None) -> List[Dict]:
        """Get detection results for a specific detection - with optional user verification"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                
                # If user_id is provided, verify the detection belongs to the user
                if user_id is not None:
                    cursor.execute("""
                        SELECT dr.class_name, dr.confidence, dr.bbox_x1, dr.bbox_y1, 
                               dr.bbox_x2, dr.bbox_y2, dr.frame_number
                        FROM detection_results dr
                        JOIN detections d ON dr.detection_id = d.id
                        WHERE dr.detection_id = ? AND d.user_id = ?
                        ORDER BY dr.confidence DESC
                    """, (detection_id, user_id))
                else:
                    # Legacy method for internal use (analytics generation)
                    cursor.execute("""
                        SELECT class_name, confidence, bbox_x1, bbox_y1, bbox_x2, bbox_y2, frame_number
                        FROM detection_results 
                        WHERE detection_id = ?
                        ORDER BY confidence DESC
                    """, (detection_id,))
                
                results = []
                for row in cursor.fetchall():
                    results.append({
                        'class_name': row['class_name'],
                        'confidence': row['confidence'],
                        'bbox_x1': row['bbox_x1'],
                        'bbox_y1': row['bbox_y1'],
                        'bbox_x2': row['bbox_x2'],
                        'bbox_y2': row['bbox_y2'],
                        'frame_number': row['frame_number']
                    })
                
                return results
                
        except Exception as e:
            logger.error(f"Get detection results failed: {e}")
            return []
    
    # ==================== REPORTS MANAGEMENT ====================
    
    def create_report(self, user_id: int, title: str, report_type: str, 
                     date_range_days: int = 30) -> Optional[int]:
        """Create a new report"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                
                from datetime import datetime, timedelta
                now = datetime.now()
                start_date = now - timedelta(days=date_range_days)
                
                cursor.execute("""
                    INSERT INTO reports 
                    (user_id, title, report_type, data_range_start, data_range_end, metadata)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (
                    user_id, title, report_type, 
                    start_date.date(), now.date(),
                    '{"status": "generating"}'
                ))
                
                conn.commit()
                return cursor.lastrowid
                
        except Exception as e:
            logger.error(f"Create report failed: {e}")
            return None
    
    def update_report(self, report_id: int, report_data: Dict) -> bool:
        """Update report with generated data"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                
                import json
                from datetime import datetime
                
                cursor.execute("""
                    UPDATE reports 
                    SET metadata = ?
                    WHERE id = ?
                """, (
                    json.dumps({
                        "status": "completed",
                        "data": report_data,
                        "generated_at": datetime.now().isoformat()
                    }),
                    report_id
                ))
                
                conn.commit()
                return cursor.rowcount > 0
                
        except Exception as e:
            logger.error(f"Update report failed: {e}")
            return False
    
    def get_user_reports(self, user_id: int, limit: int = 50) -> List[Dict]:
        """Get user's reports"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT id, title, report_type, created_at, data_range_start, 
                           data_range_end, metadata
                    FROM reports 
                    WHERE user_id = ?
                    ORDER BY created_at DESC
                    LIMIT ?
                """, (user_id, limit))
                
                reports = []
                for row in cursor.fetchall():
                    import json
                    metadata = json.loads(row['metadata']) if row['metadata'] else {}
                    
                    reports.append({
                        'id': row['id'],
                        'title': row['title'],
                        'report_type': row['report_type'],
                        'created_at': row['created_at'],
                        'data_range_start': row['data_range_start'],
                        'data_range_end': row['data_range_end'],
                        'status': metadata.get('status', 'unknown'),
                        'size': '1.2 MB',  # Placeholder
                        'metadata': metadata
                    })
                
                return reports
                
        except Exception as e:
            logger.error(f"Get user reports failed: {e}")
            return []
    
    def get_report_by_id(self, report_id: int) -> Optional[Dict]:
        """Get report by ID"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT id, user_id, title, report_type, created_at, 
                           data_range_start, data_range_end, metadata
                    FROM reports 
                    WHERE id = ?
                """, (report_id,))
                
                row = cursor.fetchone()
                if row:
                    import json
                    metadata = json.loads(row['metadata']) if row['metadata'] else {}
                    
                    return {
                        'id': row['id'],
                        'user_id': row['user_id'],
                        'title': row['title'],
                        'report_type': row['report_type'],
                        'created_at': row['created_at'],
                        'data_range_start': row['data_range_start'],
                        'data_range_end': row['data_range_end'],
                        'metadata': metadata,
                        'data': metadata.get('data', {})
                    }
                
                return None
                
        except Exception as e:
            logger.error(f"Get report by ID failed: {e}")
            return None
    
    def get_user_report_by_id(self, user_id: int, report_id: int) -> Optional[Dict]:
        """Get user's specific report - ensures user can only access their own reports"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT id, user_id, title, report_type, created_at, 
                           data_range_start, data_range_end, metadata
                    FROM reports 
                    WHERE id = ? AND user_id = ?
                """, (report_id, user_id))
                
                row = cursor.fetchone()
                if row:
                    import json
                    metadata = json.loads(row['metadata']) if row['metadata'] else {}
                    
                    return {
                        'id': row['id'],
                        'user_id': row['user_id'],
                        'title': row['title'],
                        'report_type': row['report_type'],
                        'created_at': row['created_at'],
                        'data_range_start': row['data_range_start'],
                        'data_range_end': row['data_range_end'],
                        'metadata': metadata,
                        'data': metadata.get('data', {})
                    }
                
                return None
                
        except Exception as e:
            logger.error(f"Get user report by ID failed: {e}")
            return None
# Global database instance
db = DatabaseManager()