import { motion } from "framer-motion";
import { Sun, Moon, Trash2, Info, Monitor, Cpu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { PageTransition } from "@/components/layout/PageTransition";
import { MainLayout } from "@/components/layout/MainLayout";
import { useTheme } from "@/hooks/useTheme";
import { useToast } from "@/hooks/use-toast";

export default function SettingsPage() {
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();

  const handleClearHistory = () => {
    toast({
      title: "History Cleared",
      description: "All detection history has been removed.",
    });
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
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <Trash2 className="h-5 w-5" />
                  Data Management
                </CardTitle>
                <CardDescription>
                  Manage your detection history and stored data
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-destructive/10 rounded-lg border border-destructive/20">
                  <h4 className="font-medium text-destructive mb-2">
                    Clear Detection History
                  </h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    This will permanently delete all your detection history and
                    cannot be undone.
                  </p>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleClearHistory}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear All History
                  </Button>
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
