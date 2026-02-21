import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import logger from '@/utils/logger';
import { 
  Users, 
  Activity, 
  Database, 
  AlertTriangle, 
  TrendingUp, 
  FileText, 
  Settings, 
  Shield, 
  Clock, 
  HardDrive,
  Cpu,
  Wifi,
  CheckCircle,
  XCircle,
  RefreshCw,
  Download,
  Trash2
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import AdminLayout from '@/components/layout/AdminLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

// Backend API URL
const API_URL = "http://localhost:8000";

interface SystemStats {
  active_users: number;
  total_detections: number;
  database_size: number;
  system_uptime: string;
  api_requests_today: number;
  storage_used: number;
  active_sessions: number;
  error_rate: number;
}

interface RecentActivity {
  id: string;
  type: 'detection' | 'user_login' | 'system_alert' | 'data_update';
  message: string;
  timestamp: string;
  severity?: 'low' | 'medium' | 'high';
}

const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [systemHealth, setSystemHealth] = useState(97.5);

  useEffect(() => {
    fetchSystemStats();
    fetchRecentActivity();
    
    // Set up polling for real-time updates
    const interval = setInterval(() => {
      fetchSystemStats();
      fetchRecentActivity();
    }, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const fetchSystemStats = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_URL}/api/admin/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      } else {
        throw new Error('Failed to fetch system stats');
      }
    } catch (error) {
      logger.error('Error fetching system stats:', error);
      toast({
        title: "Error",
        description: "Failed to load system statistics",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentActivity = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_URL}/api/admin/activity`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setRecentActivity(data);
      }
    } catch (error) {
      logger.error('Error fetching recent activity:', error);
    }
  };

  const handleSystemAction = async (action: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_URL}/api/admin/system/${action}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        toast({
          title: "Action Completed",
          description: data.message,
        });
        
        // Refresh stats after action
        fetchSystemStats();
      } else {
        throw new Error('Action failed');
      }
    } catch (error) {
      toast({
        title: "Action Failed",
        description: "Failed to execute system action",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <Card className="glass-card">
            <CardContent className="py-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading admin dashboard...</p>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Welcome Section */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold mb-2">Welcome back, {user?.username}</h1>
              <p className="text-blue-100">
                Monitor and manage your marine detection system
              </p>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="secondary" 
                size="sm"
                onClick={() => handleSystemAction('backup')}
              >
                <Download className="h-4 w-4 mr-2" />
                Backup System
              </Button>
              <Button 
                variant="secondary" 
                size="sm"
                onClick={() => handleSystemAction('maintenance')}
              >
                <Settings className="h-4 w-4 mr-2" />
                Maintenance
              </Button>
            </div>
          </div>
        </div>

        {/* System Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Users</CardTitle>
              <Users className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.active_users || 0}</div>
              <p className="text-xs text-muted-foreground">
                {stats?.active_sessions || 0} active sessions
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Detections</CardTitle>
              <Activity className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.total_detections || 0}</div>
              <p className="text-xs text-muted-foreground">
                {stats?.api_requests_today || 0} API requests today
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-orange-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Database Size</CardTitle>
              <Database className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.database_size || 0} MB</div>
              <p className="text-xs text-muted-foreground">
                {stats?.storage_used || 0} MB used
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">System Health</CardTitle>
              <Shield className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{systemHealth}%</div>
              <p className="text-xs text-muted-foreground">
                Uptime: {stats?.system_uptime || '24h 15m'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* System Status and Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* System Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cpu className="h-5 w-5 text-blue-600" />
                System Status
              </CardTitle>
              <CardDescription>
                Current system health and performance
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium">Database</span>
                </div>
                <Badge variant="secondary" className="bg-green-100 text-green-700">
                  Online
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wifi className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium">API Services</span>
                </div>
                <Badge variant="secondary" className="bg-green-100 text-green-700">
                  Connected
                </Badge>
              </div>

              <div className="pt-4 border-t">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Overall Health</span>
                  <span className="text-sm text-green-600">{systemHealth}%</span>
                </div>
                <Progress value={systemHealth} className="h-2" />
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-blue-600" />
                Quick Actions
              </CardTitle>
              <CardDescription>
                Common administrative tasks
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="justify-start gap-2"
                  onClick={() => handleSystemAction('cache-clear')}
                >
                  <RefreshCw className="h-4 w-4" />
                  Clear Cache
                </Button>
                
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="justify-start gap-2"
                  onClick={() => handleSystemAction('optimize-db')}
                >
                  <Database className="h-4 w-4" />
                  Optimize DB
                </Button>
                
                <Link to="/admin/logs" className="w-full">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full justify-start gap-2"
                  >
                    <FileText className="h-4 w-4" />
                    View Logs
                  </Button>
                </Link>
                
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="justify-start gap-2"
                  onClick={() => handleSystemAction('export-data')}
                >
                  <Download className="h-4 w-4" />
                  Export Data
                </Button>
              </div>
              
              <div className="pt-3 border-t">
                <Button 
                  variant="destructive" 
                  size="sm" 
                  className="w-full gap-2"
                  onClick={() => {
                    if (confirm('Are you sure you want to enable maintenance mode?')) {
                      handleSystemAction('maintenance');
                    }
                  }}
                >
                  <AlertTriangle className="h-4 w-4" />
                  Enable Maintenance Mode
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-600" />
              Recent System Activity
            </CardTitle>
            <CardDescription>
              Latest system events and user activities
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentActivity.length > 0 ? (
              <div className="space-y-3">
                {recentActivity.slice(0, 8).map((activity) => (
                  <div key={activity.id} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <div className={`w-2 h-2 rounded-full ${
                      activity.severity === 'high' ? 'bg-red-500' :
                      activity.severity === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                    }`} />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{activity.message}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(activity.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {activity.type.replace('_', ' ')}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No recent activity to display</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;