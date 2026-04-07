import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import logger from '@/utils/logger';
import { 
  FileText, 
  Filter, 
  Search, 
  RefreshCw, 
  AlertTriangle, 
  Info, 
  AlertCircle, 
  XCircle,
  CheckCircle,
  Clock,
  User,
  Settings
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MainLayout } from '@/components/layout/MainLayout';
import AdminLayout from '@/components/layout/AdminLayout';
import { PageTransition } from '@/components/layout/PageTransition';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import ENV from '@/config/env';

const API_URL = ENV.API_URL;

interface LogEntry {
  id: number;
  user_id: number | null;
  level: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  message: string;
  module: string;
  timestamp: string;
}

const AdminLogs: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [autoRefresh, setAutoRefresh] = useState(false);

  useEffect(() => {
    fetchLogs();
    
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(fetchLogs, 10000); // Refresh every 10 seconds
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [levelFilter, autoRefresh]);

  const fetchLogs = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const params = new URLSearchParams({
        limit: '100',
        ...(levelFilter !== 'all' && { level: levelFilter })
      });

      const response = await fetch(`${API_URL}/api/admin/logs?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs || []);
      } else {
        throw new Error('Failed to fetch logs');
      }
    } catch (error) {
      logger.error('Error fetching logs:', error);
      toast({
        title: "Error",
        description: "Failed to load system logs",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'CRITICAL':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'ERROR':
        return <AlertCircle className="h-4 w-4 text-red-400" />;
      case 'WARNING':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'INFO':
        return <Info className="h-4 w-4 text-blue-500" />;
      case 'DEBUG':
        return <Settings className="h-4 w-4 text-gray-500" />;
      default:
        return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'CRITICAL':
        return 'bg-red-500/10 text-red-700 border-red-500/20';
      case 'ERROR':
        return 'bg-red-400/10 text-red-600 border-red-400/20';
      case 'WARNING':
        return 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20';
      case 'INFO':
        return 'bg-blue-500/10 text-blue-700 border-blue-500/20';
      case 'DEBUG':
        return 'bg-gray-500/10 text-gray-700 border-gray-500/20';
      default:
        return 'bg-green-500/10 text-green-700 border-green-500/20';
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         log.module.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesModule = moduleFilter === 'all' || log.module === moduleFilter;
    return matchesSearch && matchesModule;
  });

  const uniqueModules = [...new Set(logs.map(log => log.module))];

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <Card className="glass-card">
            <CardContent className="py-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading system logs...</p>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">System Logs</h1>
          <p className="text-muted-foreground">
            View system activity and events
          </p>
        </div>

          {/* Controls */}
          <Card className="glass-card mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Log Filters & Controls
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search logs..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                
                <Select value={levelFilter} onValueChange={setLevelFilter}>
                  <SelectTrigger className="w-full md:w-40">
                    <SelectValue placeholder="Log Level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    <SelectItem value="CRITICAL">Critical</SelectItem>
                    <SelectItem value="ERROR">Error</SelectItem>
                    <SelectItem value="WARNING">Warning</SelectItem>
                    <SelectItem value="INFO">Info</SelectItem>
                    <SelectItem value="DEBUG">Debug</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={moduleFilter} onValueChange={setModuleFilter}>
                  <SelectTrigger className="w-full md:w-40">
                    <SelectValue placeholder="Module" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Modules</SelectItem>
                    {uniqueModules.map(module => (
                      <SelectItem key={module} value={module}>
                        {module}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchLogs}
                    disabled={loading}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                  
                  <Button
                    variant={autoRefresh ? "default" : "outline"}
                    size="sm"
                    onClick={() => setAutoRefresh(!autoRefresh)}
                  >
                    <Clock className="h-4 w-4 mr-2" />
                    Auto
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Log Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            {['CRITICAL', 'ERROR', 'WARNING', 'INFO', 'DEBUG'].map(level => {
              const count = logs.filter(log => log.level === level).length;
              return (
                <Card key={level} className="glass-card">
                  <CardContent className="p-4 text-center">
                    <div className="flex items-center justify-center mb-2">
                      {getLevelIcon(level)}
                    </div>
                    <div className="text-2xl font-bold">{count}</div>
                    <div className="text-xs text-muted-foreground capitalize">
                      {level.toLowerCase()}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Logs List */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>
                Showing {filteredLogs.length} of {logs.length} log entries
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredLogs.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No logs match your filters</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {filteredLogs.map((log, index) => (
                    <motion.div
                      key={log.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.02 }}
                      className="flex items-start gap-3 p-3 rounded-lg border bg-card/50 hover:bg-card/80 transition-colors"
                    >
                      <div className="flex-shrink-0 mt-0.5">
                        {getLevelIcon(log.level)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${getLevelColor(log.level)}`}
                          >
                            {log.level}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {log.module}
                          </Badge>
                          {log.user_id && (
                            <Badge variant="outline" className="text-xs">
                              <User className="h-3 w-3 mr-1" />
                              User {log.user_id}
                            </Badge>
                          )}
                        </div>
                        
                        <p className="text-sm text-foreground mb-1 break-words">
                          {log.message}
                        </p>
                        
                        <p className="text-xs text-muted-foreground">
                          {formatTimestamp(log.timestamp)}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminLogs;