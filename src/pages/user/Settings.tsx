import { motion } from "framer-motion";
import { Sun, Moon, Trash2, Info, Monitor, Cpu, Download, Upload, RefreshCw, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { PageTransition } from "@/components/layout/PageTransition";
import { MainLayout } from "@/components/layout/MainLayout";
import { useTheme } from "@/hooks/useTheme";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { dataService } from "@/services/data.service";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function SettingsPage() {
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isClearing, setIsClearing] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [stats, setStats] = useState({
    detections: 0,
    totalObjects: 0,
    hotspots: 0,
  });

  // Load data stats
  useEffect(() => {
    const loadStats = async () => {
      try {
        const history = await dataService.getHistory();
        const analytics = await dataService.getAnalytics();
        const hotspots = dataService.getHotspots();
        
        setStats({
          detections: history.length,
          totalObjects: analytics.stats.totalDetections,
          hotspots: hotspots.length,
        });
      } catch (error) {
        logger.error('Error loading stats:', error);
      }
    };

    loadStats();
  }, []);

  const handleClearHistory = async () => {
    setIsClearing(true);
    
    try {
      const token = localStorage.getItem('auth_token');
      if (token) {
        const response = await fetch('http://localhost:8000/api/user/history/clear', {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to clear history from server');
        }
      }

      // Also clear local data
      await dataService.clearAllData();
      
      toast({
        title: "History Cleared",
        description: "All detection history has been permanently removed from your account.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to clear history. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsClearing(false);
    }
  };

  const handleDeleteAllData = async () => {
    if (!confirm("⚠️ WARNING: This will permanently delete ALL your data including detections, reports, predictions, and analytics. This action cannot be undone. Are you sure?")) {
      return;
    }

    if (!confirm("This is your final confirmation. Type 'DELETE' in the next prompt to proceed.")) {
      return;
    }

    const confirmation = prompt("Type 'DELETE' to confirm permanent deletion of all your data:");
    if (confirmation !== 'DELETE') {
      toast({
        title: "Cancelled",
        description: "Data deletion cancelled.",
      });
      return;
    }

    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch('http://localhost:8000/api/user/data/all', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to delete data');
      }

      const result = await response.json();

      // Clear local data
      await dataService.clearAllData();
      
      toast({
        title: "All Data Deleted",
        description: "All your data has been permanently deleted from your account.",
      });

      // Refresh stats
      setStats({
        detections: 0,
        totalObjects: 0,
        hotspots: 0,
      });

    } catch (error: any) {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete data. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleExportData = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch('http://localhost:8000/api/user/data/export', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to export data from server');
      }

      const result = await response.json();
      
      // Create and download the file
      const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `oceanguard-data-${user?.username}-${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
      
      toast({
        title: "Data Exported",
        description: "Your complete data has been exported successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Export Failed",
        description: error.message || "Failed to export data. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleImportData = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = e.target?.result as string;
            const success = dataService.importData(data);
            
            if (success) {
              toast({
                title: "Data Imported",
                description: "Your data has been imported successfully.",
              });
              // Refresh the page to show imported data
              window.location.reload();
            } else {
              throw new Error('Import failed');
            }
          } catch (error) {
            toast({
              title: "Import Failed",
              description: "Failed to import data. Please check the file format.",
              variant: "destructive",
            });
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      navigate('/auth');
    } catch (error) {
      toast({
        title: "Logout Failed",
        description: "Failed to logout. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <MainLayout>
      <PageTransition className="page-container">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <h1 className="section-header">Settings</h1>
            <p className="text-muted-foreground">
              Customize your experience and manage preferences
            </p>
          </div>

          {/* Account Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
          >
            <Card className="glass-card mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" />
                  Account
                </CardTitle>
                <CardDescription>
                  Manage your account settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                  <div>
                    <p className="font-medium">{user?.username}</p>
                    <p className="text-sm text-muted-foreground">{user?.email || 'No email set'}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Role: <span className="font-medium text-primary">{user?.role}</span>
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                  >
                    {isLoggingOut ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <LogOut className="h-4 w-4 mr-2" />
                    )}
                    {isLoggingOut ? "Logging out..." : "Logout"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Appearance */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="glass-card mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Monitor className="h-5 w-5 text-primary" />
                  Appearance
                </CardTitle>
                <CardDescription>
                  Customize the look and feel of the application
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Theme Toggle */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {theme === "light" ? (
                      <Sun className="h-5 w-5 text-warning" />
                    ) : (
                      <Moon className="h-5 w-5 text-primary" />
                    )}
                    <div>
                      <Label className="text-base">Dark Mode</Label>
                      <p className="text-sm text-muted-foreground">
                        Switch between light and dark theme
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={theme === "dark"}
                    onCheckedChange={toggleTheme}
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Model Settings */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="glass-card mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cpu className="h-5 w-5 text-primary" />
                  Model Configuration
                </CardTitle>
                <CardDescription>
                  Detection model settings (for future use)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-muted/30 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="font-medium">Current Model: YOLOv12n</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Custom trained on marine plastic waste dataset.
                        Model switching will be available in future updates.
                      </p>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Model Version</span>
                    <span>v1.0.0</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Classes Supported</span>
                    <span>12</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Input Resolution</span>
                    <span>640 × 640</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">LSTM Horizon</span>
                    <span>6 months</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Data Management */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="glass-card mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trash2 className="h-5 w-5 text-primary" />
                  Data Management
                </CardTitle>
                <CardDescription>
                  Manage your detection history and stored data
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Data Statistics */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 bg-muted/30 rounded-lg">
                    <div className="text-2xl font-bold text-primary">{stats.detections}</div>
                    <div className="text-xs text-muted-foreground">Detections</div>
                  </div>
                  <div className="text-center p-3 bg-muted/30 rounded-lg">
                    <div className="text-2xl font-bold text-primary">{stats.totalObjects}</div>
                    <div className="text-xs text-muted-foreground">Objects Found</div>
                  </div>
                  <div className="text-center p-3 bg-muted/30 rounded-lg">
                    <div className="text-2xl font-bold text-primary">{stats.hotspots}</div>
                    <div className="text-xs text-muted-foreground">Hotspots</div>
                  </div>
                </div>

                <Separator />

                {/* Data Actions */}
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExportData}
                      className="flex-1"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export Data
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleImportData}
                      className="flex-1"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Import Data
                    </Button>
                  </div>
                  
                  <div className="p-4 bg-destructive/10 rounded-lg border border-destructive/20">
                    <h4 className="font-medium text-destructive mb-2">
                      Clear Detection History
                    </h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      This will permanently delete all your detection history from your account.
                    </p>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleClearHistory}
                      disabled={isClearing}
                    >
                      {isClearing ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 mr-2" />
                      )}
                      {isClearing ? "Clearing..." : "Clear History"}
                    </Button>
                  </div>

                  <div className="p-4 bg-red-500/10 rounded-lg border border-red-500/20">
                    <h4 className="font-medium text-red-600 mb-2">
                      ⚠️ Delete ALL Account Data
                    </h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      This will permanently delete ALL your data including detections, reports, 
                      predictions, analytics, and associated files. This action cannot be undone.
                    </p>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleDeleteAllData}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete All Data
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* About */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-8 text-center text-sm text-muted-foreground"
          >
            <p>OceanGuard AI - Marine Plastic Detection Platform</p>
            <p>Final Year Project © 2024</p>
          </motion.div>
        </div>
      </PageTransition>
    </MainLayout>
  );
}
