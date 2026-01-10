import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
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
  HardDrive
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageTransition } from '@/components/layout/PageTransition';
import { useAuth, withAuth } from '@/contexts/AuthContext';
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
      console.error('Error fetching system stats:', error);
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
      console.error('Error fetching recent activity:', error);
    }
  };

  const handleSystemAction = async (action: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_URL}/api/admin/system/${action}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: `System ${action} completed successfully`
        });
        fetchSystemStats();
      } else {
        throw new Error(`Failed to ${action} system`);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to ${action} system`,
        variant: "destructive"
      });
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'detection': return <Activity className="h-4 w-4" />;
      case 'user_login': return <Users className="h-4 w-4" />;
      case 'system_alert': return <AlertTriangle className="h-4 w-4" />;
      case 'data_update': return <Database className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const getSeverityColor = (severity?: string) => {
    switch (severity) {
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'outline';
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <PageTransition>
          <div className="flex items-center justify-center min-h-screen">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
          </div>
        </PageTransition>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <PageTransition>
        <div className="container mx-auto px-4 py-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  Admin Dashboard
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-2">
                  Welcome back, {user?.username}. Monitor and manage your marine detection system.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => handleSystemAction('backup')}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <HardDrive className="h-4 w-4" />
                  Backup System
                </Button>
                <Button
                  onClick={() => handleSystemAction('maintenance')}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Settings className="h-4 w-4" />
                  Maintenance
                </Button>
              </div>
            </div>

            {/* System Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Users</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.active_users || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    {stats?.active_sessions || 0} active sessions
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Detections</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.total_detections || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    {stats?.api_requests_today || 0} API requests today
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Database Size</CardTitle>
                  <Database className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {stats?.database_size ? `${(stats.database_size / 1024 / 1024).toFixed(1)} MB` : '0 MB'}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {stats?.storage_used ? `${(stats.storage_used / 1024 / 1024).toFixed(1)} MB used` : '0 MB used'}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">System Health</CardTitle>
                  <Shield className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {stats?.error_rate !== undefined ? `${(100 - stats.error_rate).toFixed(1)}%` : '100%'}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Uptime: {stats?.system_uptime || 'Unknown'}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Tabs for different admin sections */}
            <Tabs defaultValue="activity" className="space-y-6">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="activity">Recent Activity</TabsTrigger>
                <TabsTrigger value="users">User Management</TabsTrigger>
                <TabsTrigger value="system">System Logs</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
              </TabsList>

              <TabsContent value="activity" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Recent Activity
                    </CardTitle>
                    <CardDescription>
                      Latest system events and user activities
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {recentActivity.length > 0 ? (
                        recentActivity.map((activity) => (
                          <div key={activity.id} className="flex items-center justify-between p-4 border rounded-lg">
                            <div className="flex items-center gap-3">
                              {getActivityIcon(activity.type)}
                              <div>
                                <p className="font-medium">{activity.message}</p>
                                <p className="text-sm text-muted-foreground">
                                  {new Date(activity.timestamp).toLocaleString()}
                                </p>
                              </div>
                            </div>
                            {activity.severity && (
                              <Badge variant={getSeverityColor(activity.severity)}>
                                {activity.severity}
                              </Badge>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          No recent activity to display
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="users" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      User Management
                    </CardTitle>
                    <CardDescription>
                      Manage user accounts and permissions
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8 text-muted-foreground">
                      User management interface coming soon...
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="system" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      System Logs
                    </CardTitle>
                    <CardDescription>
                      View detailed system logs and error reports
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8 text-muted-foreground">
                      System logs interface coming soon...
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="settings" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      System Settings
                    </CardTitle>
                    <CardDescription>
                      Configure system parameters and preferences
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Button
                          onClick={() => handleSystemAction('clear-cache')}
                          variant="outline"
                          className="flex items-center gap-2"
                        >
                          <Database className="h-4 w-4" />
                          Clear Cache
                        </Button>
                        <Button
                          onClick={() => handleSystemAction('optimize-db')}
                          variant="outline"
                          className="flex items-center gap-2"
                        >
                          <TrendingUp className="h-4 w-4" />
                          Optimize Database
                        </Button>
                        <Button
                          onClick={() => handleSystemAction('restart-services')}
                          variant="outline"
                          className="flex items-center gap-2"
                        >
                          <Clock className="h-4 w-4" />
                          Restart Services
                        </Button>
                        <Button
                          onClick={() => handleSystemAction('export-data')}
                          variant="outline"
                          className="flex items-center gap-2"
                        >
                          <HardDrive className="h-4 w-4" />
                          Export Data
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </motion.div>
        </div>
      </PageTransition>
    </MainLayout>
  );
};

export default withAuth(AdminDashboard);