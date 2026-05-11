import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
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
import ENV from '@/config/env';

// Backend API URL
const API_URL = ENV.API_URL;

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
        <div className="space-y-5">
          <Card className="glass-card">
            <CardContent className="py-14 text-center">
              <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground text-sm font-medium">Loading admin dashboard...</p>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-5">
        {/* Welcome Section */}
        <div className="ocean-gradient rounded-2xl p-5 sm:p-6 text-white shadow-glow">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="font-display text-xl sm:text-2xl font-bold mb-1 tracking-tight">Welcome back, {user?.username}</h1>
              <p className="text-white/75 text-sm font-medium">
                System administration and monitoring
              </p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleSystemAction('backup')}
                className="bg-white/15 hover:bg-white/25 text-white border-white/20 border font-semibold text-xs"
              >
                <Download className="h-4 w-4 mr-2" />
                Backup System
              </Button>
            </div>
          </div>
        </div>

        {/* System Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="glass-card hover-lift border-l-4 border-l-primary">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Active Users</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="font-display text-2xl font-bold tracking-tight">{stats?.active_users || 0}</div>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">
                {stats?.active_sessions || 0} active sessions
              </p>
            </CardContent>
          </Card>

          <Card className="glass-card hover-lift border-l-4 border-l-success">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Total Detections</CardTitle>
              <Activity className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="font-display text-2xl font-bold tracking-tight">{stats?.total_detections || 0}</div>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">
                {stats?.api_requests_today || 0} API requests today
              </p>
            </CardContent>
          </Card>

          <Card className="glass-card hover-lift border-l-4 border-l-warning">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Database Size</CardTitle>
              <Database className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="font-display text-2xl font-bold tracking-tight">{stats?.database_size || 0} MB</div>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">
                {stats?.storage_used || 0} MB used
              </p>
            </CardContent>
          </Card>

          <Card className="glass-card hover-lift border-l-4 border-l-secondary">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground">System Health</CardTitle>
              <Shield className="h-4 w-4 text-secondary" />
            </CardHeader>
            <CardContent>
              <div className="font-display text-2xl font-bold tracking-tight text-success">{systemHealth}%</div>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">
                Uptime: {stats?.system_uptime || '24h 15m'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* System Status and Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* System Status */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-[15px] font-bold tracking-tight">
                <Cpu className="h-5 w-5 text-primary" />
                System Status
              </CardTitle>
              <CardDescription className="text-[12.5px] font-medium">
                Current system health and performance
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-muted/40 rounded-xl">
                <div className="flex items-center gap-2.5">
                  <Database className="h-4 w-4 text-success" />
                  <span className="text-[13.5px] font-semibold">Database</span>
                </div>
                <Badge className="bg-success/15 text-success border-success/20 font-bold text-[11px]">
                  Online
                </Badge>
              </div>

              <div className="flex items-center justify-between p-3 bg-muted/40 rounded-xl">
                <div className="flex items-center gap-2.5">
                  <Wifi className="h-4 w-4 text-success" />
                  <span className="text-[13.5px] font-semibold">API Services</span>
                </div>
                <Badge className="bg-success/15 text-success border-success/20 font-bold text-[11px]">
                  Connected
                </Badge>
              </div>

              <div className="pt-3 border-t border-border/60">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[13.5px] font-semibold">Overall Health</span>
                  <span className="text-[13.5px] font-bold text-success">{systemHealth}%</span>
                </div>
                <Progress value={systemHealth} className="h-2" />
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-[15px] font-bold tracking-tight">
                <Settings className="h-5 w-5 text-primary" />
                Quick Actions
              </CardTitle>
              <CardDescription className="text-[12.5px] font-medium">
                Common administrative tasks
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="justify-start gap-2 font-semibold text-[12.5px] h-9"
                  onClick={() => handleSystemAction('cache-clear')}
                >
                  <RefreshCw className="h-4 w-4" />
                  Clear Cache
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="justify-start gap-2 font-semibold text-[12.5px] h-9"
                  onClick={() => handleSystemAction('optimize-db')}
                >
                  <Database className="h-4 w-4" />
                  Optimize DB
                </Button>

                <Link to="/admin/logs" className="w-full">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start gap-2 font-semibold text-[12.5px] h-9"
                  >
                    <FileText className="h-4 w-4" />
                    View Logs
                  </Button>
                </Link>

                <Button
                  variant="outline"
                  size="sm"
                  className="justify-start gap-2 font-semibold text-[12.5px] h-9"
                  onClick={() => handleSystemAction('export-data')}
                >
                  <Download className="h-4 w-4" />
                  Export Data
                </Button>
              </div>

              <div className="pt-3 border-t border-border/60">
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full gap-2 font-bold text-[12.5px]"
                  onClick={() => handleSystemAction('maintenance')}
                >
                  <AlertTriangle className="h-4 w-4" />
                  Enable Maintenance Mode
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-[15px] font-bold tracking-tight">
              <Activity className="h-5 w-5 text-primary" />
              Recent System Activity
            </CardTitle>
            <CardDescription className="text-[12.5px] font-medium">
              Latest system events and user activities
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentActivity.length > 0 ? (
              <div className="space-y-2">
                {recentActivity.slice(0, 8).map((activity) => (
                  <div key={activity.id} className="flex items-center gap-3 p-3 bg-muted/40 rounded-xl">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      activity.severity === 'high'   ? 'bg-destructive' :
                      activity.severity === 'medium' ? 'bg-warning'     : 'bg-success'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold truncate">{activity.message}</p>
                      <p className="text-[11px] text-muted-foreground font-medium">
                        {new Date(activity.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[11px] font-semibold flex-shrink-0">
                      {activity.type.replace('_', ' ')}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 text-muted-foreground">
                <Activity className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm font-semibold">No recent activity to display</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;