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
from database import DatabaseManager

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
                profile_data TEXT -- JSON data for user preferences
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
        
        indexes = [
            "CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)",
            "CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)",
            "CREATE INDEX IF NOT EXISTS idx_detections_user_id ON detections(user_id)",
            "CREATE INDEX IF NOT EXISTS idx_detections_created_at ON detections(created_at)",
            "CREATE INDEX IF NOT EXISTS idx_detection_results_detection_id ON detection_results(detection_id)",
            "CREATE INDEX IF NOT EXISTS idx_predictions_user_id ON predictions(user_id)",
            "CREATE INDEX IF NOT EXISTS idx_predictions_region ON predictions(region)",
            "CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id)",
            "CREATE INDEX IF NOT EXISTS idx_analytics_user_id ON analytics_data(user_id)",
            "CREATE INDEX IF NOT EXISTS idx_analytics_date ON analytics_data(date_recorded)",
            "CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp)",
            "CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)",
            "CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash)"
        ]
        
        for index_sql in indexes:
            cursor.execute(index_sql)
        
        # Create default admin account
        logger.info("🔧 Creating default admin account...")
        
        admin_password = "admin123"  # Change this in production!
        admin_password_hash = db_manager.hash_password(admin_password)
        
        cursor.execute("""
            INSERT OR IGNORE INTO users (username, email, password_hash, role, profile_data)
            VALUES (?, ?, ?, ?, ?)
        """, (
            "admin",
            "admin@marinedetection.local",
            admin_password_hash,
            "ADMIN",
            '{"theme": "light", "notifications": true, "language": "en"}'
        ))
        
        # Create sample user account
        user_password = "user123"  # Change this in production!
        user_password_hash = db_manager.hash_password(user_password)
        
        cursor.execute("""
            INSERT OR IGNORE INTO users (username, email, password_hash, role, profile_data)
            VALUES (?, ?, ?, ?, ?)
        """, (
            "demo_user",
            "user@marinedetection.local",
            user_password_hash,
            "USER",
            '{"theme": "dark", "notifications": true, "language": "en"}'
        ))
        
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
        
        logger.info("🔑 Default accounts created:")
        logger.info(f"   - Admin: username='admin', password='{admin_password}'")
        logger.info(f"   - User: username='demo_user', password='{user_password}'")
        logger.info("⚠️  IMPORTANT: Change default passwords in production!")
        
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
        print("You can now start the Flask backend and React frontend.")
        print("\nNext steps:")
        print("1. cd backend && python main.py")
        print("2. cd .. && npm run dev")
    else:
        print("\n❌ Database setup failed. Check the logs above.")
        exit(1)