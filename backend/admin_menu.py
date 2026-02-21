#!/usr/bin/env python3
"""
Marine Detection System - Simple Admin Menu
Clean and simple database administration tool
"""

import os
import sys
from datetime import datetime
from tabulate import tabulate
import getpass

# Import the database manager
from core.database import db

class Colors:
    """Simple color codes for terminal output"""
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    CYAN = '\033[96m'
    BOLD = '\033[1m'
    ENDC = '\033[0m'

def clear_screen():
    """Clear terminal screen"""
    os.system('cls' if os.name == 'nt' else 'clear')

def print_header():
    """Print application header"""
    clear_screen()
    print(f"{Colors.CYAN}{Colors.BOLD}")
    print("=" * 60)
    print("    MARINE DETECTION SYSTEM - ADMIN PANEL")
    print("=" * 60)
    print(f"{Colors.ENDC}")
    print(f"{Colors.YELLOW}Database: {os.path.basename(db.db_path)}{Colors.ENDC}")
    print()

def show_menu():
    """Display main menu"""
    print(f"{Colors.GREEN}{Colors.BOLD}ADMIN MENU{Colors.ENDC}")
    print(f"{Colors.CYAN}{'─' * 60}{Colors.ENDC}")
    print(f"{Colors.BOLD}1.{Colors.ENDC}  👥 View All Users")
    print(f"{Colors.BOLD}2.{Colors.ENDC}  🔍 View All Detections") 
    print(f"{Colors.BOLD}3.{Colors.ENDC}  📊 System Statistics")
    print(f"{Colors.BOLD}4.{Colors.ENDC}  📋 View Reports")
    print(f"{Colors.BOLD}5.{Colors.ENDC}  🔮 View Predictions")
    print(f"{Colors.BOLD}6.{Colors.ENDC}  ➕ Add New User")
    print(f"{Colors.BOLD}7.{Colors.ENDC}  🗑️  Delete All Data")
    print(f"{Colors.BOLD}8.{Colors.ENDC}  💾 Backup Database")
    print(f"{Colors.BOLD}0.{Colors.ENDC}  🚪 Exit")
    print(f"{Colors.CYAN}{'─' * 60}{Colors.ENDC}")

def view_all_users():
    """Display all users"""
    print_header()
    print(f"{Colors.GREEN}{Colors.BOLD}👥 ALL USERS{Colors.ENDC}\n")
    
    try:
        users = db.get_all_users()
        
        if users:
            table_data = []
            for user in users:
                table_data.append([
                    user['id'],
                    user['username'],
                    user.get('email', 'N/A'),
                    user['role'],
                    'Active' if user.get('is_active', True) else 'Inactive',
                    user.get('created_at', 'N/A')[:19] if user.get('created_at') else 'N/A'
                ])
            
            print(tabulate(table_data, 
                         headers=['ID', 'Username', 'Email', 'Role', 'Status', 'Created'],
                         tablefmt='grid'))
            print(f"\n{Colors.CYAN}Total Users: {len(users)}{Colors.ENDC}")
        else:
            print(f"{Colors.YELLOW}No users found.{Colors.ENDC}")
    
    except Exception as e:
        print(f"{Colors.RED}Error: {e}{Colors.ENDC}")

def view_all_detections():
    """Display all detections"""
    print_header()
    print(f"{Colors.GREEN}{Colors.BOLD}🔍 ALL DETECTIONS{Colors.ENDC}\n")
    
    try:
        users = db.get_all_users()
        all_detections = []
        
        for user in users:
            user_detections = db.get_user_detections(user['id'])
            for detection in user_detections:
                detection['username'] = user['username']
                all_detections.append(detection)
        
        if all_detections:
            table_data = []
            for det in all_detections[:20]:  # Show last 20
                table_data.append([
                    det['id'],
                    det.get('username', 'N/A'),
                    det['filename'][:25] + '...' if len(det['filename']) > 25 else det['filename'],
                    det['file_type'].upper(),
                    det.get('total_detections', 0),
                    det.get('status', 'N/A'),
                    det.get('created_at', 'N/A')[:19] if det.get('created_at') else 'N/A'
                ])
            
            print(tabulate(table_data,
                         headers=['ID', 'User', 'Filename', 'Type', 'Objects', 'Status', 'Created'],
                         tablefmt='grid'))
            print(f"\n{Colors.CYAN}Showing last 20 detections (Total: {len(all_detections)}){Colors.ENDC}")
        else:
            print(f"{Colors.YELLOW}No detections found.{Colors.ENDC}")
    
    except Exception as e:
        print(f"{Colors.RED}Error: {e}{Colors.ENDC}")

def view_statistics():
    """Display system statistics"""
    print_header()
    print(f"{Colors.GREEN}{Colors.BOLD}📊 SYSTEM STATISTICS{Colors.ENDC}\n")
    
    try:
        users = db.get_all_users()
        total_detections = 0
        total_reports = 0
        total_predictions = 0
        
        for user in users:
            detections = db.get_user_detections(user['id'])
            reports = db.get_user_reports(user['id'])
            predictions = db.get_user_predictions(user['id'])
            
            total_detections += len(detections)
            total_reports += len(reports)
            total_predictions += len(predictions)
        
        print(f"{Colors.CYAN}{'─' * 40}{Colors.ENDC}")
        print(f"{Colors.BOLD}USERS{Colors.ENDC}")
        print(f"  Total Users: {len(users)}")
        print(f"  Admin Users: {len([u for u in users if u['role'] == 'ADMIN'])}")
        print(f"  Regular Users: {len([u for u in users if u['role'] == 'USER'])}")
        
        print(f"\n{Colors.BOLD}DATA{Colors.ENDC}")
        print(f"  Total Detections: {total_detections}")
        print(f"  Total Reports: {total_reports}")
        print(f"  Total Predictions: {total_predictions}")
        
        # Database size
        if os.path.exists(db.db_path):
            size_mb = os.path.getsize(db.db_path) / (1024 * 1024)
            print(f"  Database Size: {size_mb:.2f} MB")
        
        print(f"{Colors.CYAN}{'─' * 40}{Colors.ENDC}")
        
    except Exception as e:
        print(f"{Colors.RED}Error: {e}{Colors.ENDC}")

def view_reports():
    """Display all reports"""
    print_header()
    print(f"{Colors.GREEN}{Colors.BOLD}📋 ALL REPORTS{Colors.ENDC}\n")
    
    try:
        users = db.get_all_users()
        all_reports = []
        
        for user in users:
            user_reports = db.get_user_reports(user['id'])
            for report in user_reports:
                report['username'] = user['username']
                all_reports.append(report)
        
        if all_reports:
            table_data = []
            for report in all_reports:
                table_data.append([
                    report['id'],
                    report.get('username', 'N/A'),
                    report['title'][:30] + '...' if len(report['title']) > 30 else report['title'],
                    report['report_type'],
                    report.get('created_at', 'N/A')[:19] if report.get('created_at') else 'N/A'
                ])
            
            print(tabulate(table_data,
                         headers=['ID', 'User', 'Title', 'Type', 'Created'],
                         tablefmt='grid'))
            print(f"\n{Colors.CYAN}Total Reports: {len(all_reports)}{Colors.ENDC}")
        else:
            print(f"{Colors.YELLOW}No reports found.{Colors.ENDC}")
    
    except Exception as e:
        print(f"{Colors.RED}Error: {e}{Colors.ENDC}")

def view_predictions():
    """Display LSTM predictions"""
    print_header()
    print(f"{Colors.GREEN}{Colors.BOLD}🔮 LSTM PREDICTIONS{Colors.ENDC}\n")
    
    try:
        users = db.get_all_users()
        all_predictions = []
        
        for user in users:
            user_predictions = db.get_user_predictions(user['id'])
            for prediction in user_predictions:
                prediction['username'] = user['username']
                all_predictions.append(prediction)
        
        if all_predictions:
            table_data = []
            for pred in all_predictions:
                table_data.append([
                    pred['id'],
                    pred.get('username', 'N/A'),
                    pred.get('region', 'N/A'),
                    pred.get('prediction_date', 'N/A'),
                    f"{pred.get('predicted_pollution_level', 0):.2f}",
                    pred.get('created_at', 'N/A')[:19] if pred.get('created_at') else 'N/A'
                ])
            
            print(tabulate(table_data,
                         headers=['ID', 'User', 'Region', 'Pred Date', 'Pollution Level', 'Created'],
                         tablefmt='grid'))
            print(f"\n{Colors.CYAN}Total Predictions: {len(all_predictions)}{Colors.ENDC}")
        else:
            print(f"{Colors.YELLOW}No predictions found.{Colors.ENDC}")
    
    except Exception as e:
        print(f"{Colors.RED}Error: {e}{Colors.ENDC}")

def add_new_user():
    """Add a new user"""
    print_header()
    print(f"{Colors.GREEN}{Colors.BOLD}➕ ADD NEW USER{Colors.ENDC}\n")
    
    try:
        username = input(f"{Colors.CYAN}Username: {Colors.ENDC}").strip()
        if not username:
            print(f"{Colors.RED}Username cannot be empty!{Colors.ENDC}")
            return
        
        email = input(f"{Colors.CYAN}Email: {Colors.ENDC}").strip()
        if not email:
            print(f"{Colors.RED}Email cannot be empty!{Colors.ENDC}")
            return
        
        password = getpass.getpass(f"{Colors.CYAN}Password: {Colors.ENDC}")
        if not password:
            print(f"{Colors.RED}Password cannot be empty!{Colors.ENDC}")
            return
        
        print(f"\n{Colors.CYAN}Role:{Colors.ENDC}")
        print("1. USER")
        print("2. ADMIN")
        role_choice = input(f"{Colors.CYAN}Choose (1-2): {Colors.ENDC}").strip()
        
        role = 'ADMIN' if role_choice == '2' else 'USER'
        
        user_id = db.create_user(username, email, password, role)
        
        if user_id:
            print(f"\n{Colors.GREEN}✓ User '{username}' created successfully as {role}!{Colors.ENDC}")
            print(f"{Colors.CYAN}User ID: {user_id}{Colors.ENDC}")
        else:
            print(f"{Colors.RED}Failed to create user. Username or email might already exist.{Colors.ENDC}")
    
    except Exception as e:
        print(f"{Colors.RED}Error: {e}{Colors.ENDC}")

def delete_all_data():
    """Delete all data (dangerous operation)"""
    print_header()
    print(f"{Colors.RED}{Colors.BOLD}⚠️  DELETE ALL DATA{Colors.ENDC}\n")
    
    print(f"{Colors.YELLOW}This will delete ALL detection data, reports, and predictions.{Colors.ENDC}")
    print(f"{Colors.YELLOW}Users will NOT be deleted.{Colors.ENDC}\n")
    
    confirm1 = input(f"{Colors.YELLOW}Type 'DELETE' to confirm: {Colors.ENDC}").strip()
    if confirm1 != 'DELETE':
        print(f"{Colors.GREEN}Operation cancelled.{Colors.ENDC}")
        return
    
    confirm2 = input(f"{Colors.RED}Are you sure? (yes/no): {Colors.ENDC}").strip().lower()
    if confirm2 != 'yes':
        print(f"{Colors.GREEN}Operation cancelled.{Colors.ENDC}")
        return
    
    try:
        with db.get_connection() as conn:
            cursor = conn.cursor()
            
            # Delete in correct order
            cursor.execute("DELETE FROM detection_results")
            cursor.execute("DELETE FROM images")
            cursor.execute("DELETE FROM videos")
            cursor.execute("DELETE FROM detections")
            cursor.execute("DELETE FROM analytics_data")
            cursor.execute("DELETE FROM reports")
            cursor.execute("DELETE FROM predictions")
            cursor.execute("DELETE FROM logs")
            
            conn.commit()
        
        print(f"\n{Colors.GREEN}✓ All data deleted successfully!{Colors.ENDC}")
    
    except Exception as e:
        print(f"{Colors.RED}Error: {e}{Colors.ENDC}")

def backup_database():
    """Create database backup"""
    print_header()
    print(f"{Colors.GREEN}{Colors.BOLD}💾 BACKUP DATABASE{Colors.ENDC}\n")
    
    try:
        backup_path = db.backup_database()
        
        print(f"{Colors.GREEN}✓ Backup created successfully!{Colors.ENDC}")
        print(f"{Colors.CYAN}Location: {backup_path}{Colors.ENDC}")
        
        if os.path.exists(backup_path):
            size = os.path.getsize(backup_path) / 1024
            print(f"{Colors.CYAN}Size: {size:.2f} KB{Colors.ENDC}")
    
    except Exception as e:
        print(f"{Colors.RED}Error: {e}{Colors.ENDC}")

def main():
    """Main application loop"""
    while True:
        print_header()
        show_menu()
        
        choice = input(f"\n{Colors.BOLD}Enter choice (0-8): {Colors.ENDC}").strip()
        
        if choice == '1':
            view_all_users()
        elif choice == '2':
            view_all_detections()
        elif choice == '3':
            view_statistics()
        elif choice == '4':
            view_reports()
        elif choice == '5':
            view_predictions()
        elif choice == '6':
            add_new_user()
        elif choice == '7':
            delete_all_data()
        elif choice == '8':
            backup_database()
        elif choice == '0':
            print(f"\n{Colors.GREEN}Goodbye!{Colors.ENDC}")
            sys.exit(0)
        else:
            print(f"{Colors.RED}Invalid choice! Please try again.{Colors.ENDC}")
        
        input(f"\n{Colors.CYAN}Press Enter to continue...{Colors.ENDC}")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print(f"\n\n{Colors.YELLOW}Goodbye!{Colors.ENDC}")
        sys.exit(0)