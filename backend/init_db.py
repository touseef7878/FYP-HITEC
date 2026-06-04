#!/usr/bin/env python3
"""
Database Initialization Script
Creates SQLite database with all required tables for the marine detection system
Run this once for first-time setup
"""

import sqlite3
import os
import logging
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Import the DatabaseManager to use its hashing method
from core.database import DatabaseManager

def init_database():
    """Initialize the SQLite database with all required tables"""
    
    db_path = os.path.join(os.path.dirname(__file__), "marine_detection.db")
    
    # Create a DatabaseManager instance to use its hashing method
    db_manager = DatabaseManager(db_path)
    
    try:
        # Connect to database
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        logger.info("🔧 Creating database tables...")
        
        # 1. Users table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                role VARCHAR(20) DEFAULT 'USER' CHECK (role IN ('USER', 'ADMIN')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_login TIMESTAMP,
                is_active BOOLEAN DEFAULT 1,
                profile_data TEXT,
                email_verified BOOLEAN DEFAULT 0,
                verification_token VARCHAR(128),
                verification_token_expires TIMESTAMP
            )
        """)
        
        # 2. Detections table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS detections (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                filename VARCHAR(255) NOT NULL,
                file_type VARCHAR(10) NOT NULL CHECK (file_type IN ('image', 'video')),
                file_path VARCHAR(500),
                file_size INTEGER,
                total_detections INTEGER DEFAULT 0,
                confidence_threshold REAL DEFAULT 0.25,
                processing_time REAL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('pending', 'processing', 'completed', 'error')),
                error_message TEXT,
                metadata TEXT, -- JSON data for additional info
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )
        """)
        
        # 3. Detection results table (individual objects detected)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS detection_results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                detection_id INTEGER NOT NULL,
                class_name VARCHAR(50) NOT NULL,
                confidence REAL NOT NULL,
                bbox_x1 REAL NOT NULL,
                bbox_y1 REAL NOT NULL,
                bbox_x2 REAL NOT NULL,
                bbox_y2 REAL NOT NULL,
                frame_number INTEGER DEFAULT 0, -- For video detections
                FOREIGN KEY (detection_id) REFERENCES detections (id) ON DELETE CASCADE
            )
        """)
        
        # 4. Videos table (video-specific metadata)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS videos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                detection_id INTEGER NOT NULL,
                original_path VARCHAR(500),
                annotated_path VARCHAR(500),
                total_frames INTEGER,
                processed_frames INTEGER,
                fps REAL,
                duration REAL,
                resolution VARCHAR(20),
                FOREIGN KEY (detection_id) REFERENCES detections (id) ON DELETE CASCADE
            )
        """)
        
        # 5. Images table (image-specific metadata)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS images (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                detection_id INTEGER NOT NULL,
                original_path VARCHAR(500),
                annotated_path VARCHAR(500),
                width INTEGER,
                height INTEGER,
                original_base64 TEXT,
                annotated_base64 TEXT,
                FOREIGN KEY (detection_id) REFERENCES detections (id) ON DELETE CASCADE
            )
        """)
        
        # 6. Predictions table (LSTM predictions)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS predictions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                region VARCHAR(50) NOT NULL,
                prediction_date DATE NOT NULL,
                predicted_pollution_level REAL NOT NULL,
                confidence_interval_lower REAL,
                confidence_interval_upper REAL,
                model_version VARCHAR(50),
                input_features TEXT, -- JSON data
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )
        """)
        
        # 7. Reports table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                title VARCHAR(200) NOT NULL,
                report_type VARCHAR(50) NOT NULL CHECK (report_type IN ('detection', 'prediction', 'analytics', 'custom')),
                file_path VARCHAR(500),
                file_size INTEGER,
                data_range_start DATE,
                data_range_end DATE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                metadata TEXT, -- JSON data for report parameters
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )
        """)
        
        # 8. Analytics data table (for charts and heatmaps)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS analytics_data (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                data_type VARCHAR(50) NOT NULL CHECK (data_type IN ('heatmap', 'trend', 'summary', 'comparison')),
                region VARCHAR(50),
                date_recorded DATE NOT NULL,
                value REAL NOT NULL,
                metadata TEXT, -- JSON data for additional context
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )
        """)
        
        # 9. System logs table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                level VARCHAR(20) NOT NULL CHECK (level IN ('DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL')),
                message TEXT NOT NULL,
                module VARCHAR(100),
                function_name VARCHAR(100),
                line_number INTEGER,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                metadata TEXT, -- JSON data for additional context
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
            )
        """)
        
        # 10. Sessions table (for JWT token management)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                token_hash VARCHAR(255) NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                ip_address VARCHAR(45),
                user_agent TEXT,
                is_active BOOLEAN DEFAULT 1,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )
        """)
        
        # Create indexes for better performance
        logger.info("🔧 Creating database indexes...")
        
        # OPTIMIZED: Added comprehensive indexes for query performance
        indexes = [
            # User indexes
            "CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)",
            "CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)",
            
            # Detection indexes (most frequently queried)
            "CREATE INDEX IF NOT EXISTS idx_detections_user_id ON detections(user_id)",
            "CREATE INDEX IF NOT EXISTS idx_detections_created_at ON detections(created_at DESC)",
            "CREATE INDEX IF NOT EXISTS idx_detections_user_created ON detections(user_id, created_at DESC)",
            "CREATE INDEX IF NOT EXISTS idx_detections_file_type ON detections(file_type)",
            
            # Detection results indexes
            "CREATE INDEX IF NOT EXISTS idx_detection_results_detection_id ON detection_results(detection_id)",
            "CREATE INDEX IF NOT EXISTS idx_detection_results_class ON detection_results(class_name)",
            
            # Video/Image indexes
            "CREATE INDEX IF NOT EXISTS idx_videos_detection_id ON videos(detection_id)",
            "CREATE INDEX IF NOT EXISTS idx_images_detection_id ON images(detection_id)",
            
            # Prediction indexes
            "CREATE INDEX IF NOT EXISTS idx_predictions_user_id ON predictions(user_id)",
            "CREATE INDEX IF NOT EXISTS idx_predictions_region ON predictions(region)",
            "CREATE INDEX IF NOT EXISTS idx_predictions_date ON predictions(prediction_date)",
            
            # Report indexes
            "CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id)",
            "CREATE INDEX IF NOT EXISTS idx_reports_created ON reports(created_at DESC)",
            
            # Analytics indexes
            "CREATE INDEX IF NOT EXISTS idx_analytics_user_id ON analytics_data(user_id)",
            "CREATE INDEX IF NOT EXISTS idx_analytics_date ON analytics_data(date_recorded DESC)",
            
            # Log indexes
            "CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp DESC)",
            "CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level)",
            "CREATE INDEX IF NOT EXISTS idx_logs_user_id ON logs(user_id)",
            
            # Session indexes
            "CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)",
            "CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash)",
            "CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at)"
        ]
        
        for index_sql in indexes:
            cursor.execute(index_sql)
        
        logger.info(f"✅ Created {len(indexes)} database indexes for optimal performance")
        
        # Create default admin account — always upsert with correct credentials
        logger.info("🔧 Creating admin account...")

        # Migration: add email verification columns if they don't exist yet
        cursor.execute("PRAGMA table_info(users)")
        existing_cols = {row[1] for row in cursor.fetchall()}
        if 'email_verified' not in existing_cols:
            cursor.execute("ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT 0")
        if 'verification_token' not in existing_cols:
            cursor.execute("ALTER TABLE users ADD COLUMN verification_token VARCHAR(128)")
        if 'verification_token_expires' not in existing_cols:
            cursor.execute("ALTER TABLE users ADD COLUMN verification_token_expires TIMESTAMP")
        conn.commit()
        logger.info("✅ Email verification columns ready")

        admin_username = "touseef"
        admin_email    = "touseefurrehman5554@gmail.com"
        admin_password = "touseef5554"
        admin_hash     = db_manager.hash_password(admin_password)

        # Check if admin already exists by email
        cursor.execute("SELECT id FROM users WHERE email = ? OR role = 'ADMIN'", (admin_email,))
        existing = cursor.fetchone()

        if existing:
            # Update credentials to make sure they are always correct
            cursor.execute("""
                UPDATE users
                SET username = ?, email = ?, password_hash = ?,
                    role = 'ADMIN', is_active = 1, email_verified = 1
                WHERE id = ?
            """, (admin_username, admin_email, admin_hash, existing[0]))
            logger.info(f"✅ Admin account updated (id={existing[0]})")
        else:
            cursor.execute("""
                INSERT INTO users
                    (username, email, password_hash, role, is_active, email_verified, profile_data)
                VALUES (?, ?, ?, 'ADMIN', 1, 1, ?)
            """, (
                admin_username, admin_email, admin_hash,
                '{"theme": "light", "notifications": true, "language": "en"}'
            ))
            logger.info("✅ Admin account created")
        
        # Commit changes
        conn.commit()
        
        # Verify tables were created
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = cursor.fetchall()
        
        logger.info("✅ Database initialization completed successfully!")
        logger.info(f"📊 Created {len(tables)} tables:")
        for table in tables:
            cursor.execute(f"SELECT COUNT(*) FROM {table[0]}")
            count = cursor.fetchone()[0]
            logger.info(f"   - {table[0]}: {count} records")
        
        logger.info("🔑 Admin account:")
        logger.info(f"   - username: touseef")
        logger.info(f"   - email:    touseefurrehman5554@gmail.com")
        logger.info(f"   - password: touseef5554")
        logger.info(f"   - verified: yes (no email verification required)")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Database initialization failed: {e}")
        return False
        
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    print("🚀 Marine Detection System - Database Initialization")
    print("=" * 60)
    
    success = init_database()
    
    if success:
        print("\n✅ Database setup completed successfully!")
        print("You can now start the FastAPI backend and React frontend.")
        print("\nNext steps:")
        print("1. cd backend && uvicorn main:app --reload")
        print("2. cd .. && npm run dev")
    else:
        print("\n❌ Database setup failed. Check the logs above.")
        exit(1)