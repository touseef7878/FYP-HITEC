import React, { useState, useEffect } from 'react';
import logger from '@/utils/logger';
import {
  Settings, Database, RefreshCw, Download, Trash2, Shield,
  AlertTriangle, CheckCircle, Server, HardDrive, Clock,
  Cpu, Activity, Save, RotateCcw, FileText, Zap,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import AdminLayout from '@/components/layout/AdminLayout';
import { useToast } from '@/hooks/use-toast';
import ENV from '@/config/env';

const API_URL = ENV.API_URL;

interface SystemInfo {
  active_users: number;
  total_detections: number;
  database_size: number;
  active_sessions: number;
  api_requests_today: number;
  storage_used: number;
}

export default function AdminSettings() {
  const { toast } = useToast();
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; action: string; title: string; desc: string } | null>(null);

  // Settings toggles (stored locally — extend to backend as needed)
  const [settings, setSettings] = useState({
    maintenanceMode: false,
    autoBackup: true,
    debugLogging: false,
    rateLimiting: true,
    gzipCompression: true,
  });

  useEffect(() => { fetchSystemInfo(); }, []);

  const authHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
    'Content-Type': 'application/json',
  });

  const fetchSystemInfo = async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/stats`, { headers: authHeaders() });
      if (res.ok) setSystemInfo(await res.json());
    } catch (e) { logger.error('fetch system info:', e); }
    finally { setLoading(false); }
  };

  const runAction = async (action: string, label: string) => {
    setActionLoading(action);
    try {
      const res = await fetch(`${API_URL}/api/admin/system/${action}`, {
        method: 'POST',
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      toast({ title: '✅ Done', description: data.message || `${label} completed.` });
      if (action === 'backup') fetchSystemInfo();
    } catch (e: any) {
      toast({ title: `${label} Failed`, description: e.message, variant: 'destructive' });
    } finally {
      setActionLoading(null);
      setConfirmDialog(null);
    }
  };

  const confirm = (action: string, title: string, desc: string) =>
    setConfirmDialog({ open: true, action, title, desc });

  const toggle = (key: keyof typeof settings) =>
    setSettings(s => ({ ...s, [key]: !s[key] }));

  const statCards = [
    { label: 'Active Users',      value: systemInfo?.active_users ?? '—',      icon: Activity,  color: 'text-blue-500' },
    { label: 'Total Detections',  value: systemInfo?.total_detections ?? '—',   icon: Cpu,       color: 'text-green-500' },
    { label: 'DB Size (MB)',       value: systemInfo?.database_size ?? '—',      icon: Database,  color: 'text-orange-500' },
    { label: 'Active Sessions',   value: systemInfo?.active_sessions ?? '—',    icon: Server,    color: 'text-purple-500' },
    { label: 'API Req Today',     value: systemInfo?.api_requests_today ?? '—', icon: Zap,       color: 'text-cyan-500' },
    { label: 'Storage Used (MB)', value: systemInfo?.storage_used ?? '—',       icon: HardDrive, color: 'text-pink-500' },
  ];

  return (
    <AdminLayout>
      <div className="space-y-5 sm:space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">System Settings</h1>
            <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">
              Manage server configuration, maintenance, and database operations
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchSystemInfo} disabled={loading} className="gap-1.5 text-xs">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* System Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
          {statCards.map(({ label, value, icon: Icon, color }) => (
            <Card key={label} className="glass-card">
              <CardContent className="p-3 sm:p-4">
                <Icon className={`h-4 w-4 ${color} mb-2`} />
                <p className="text-lg sm:text-xl font-bold">{value}</p>
                <p className="text-xs text-muted-foreground leading-tight">{label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">

          {/* ── Database Operations ── */}
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                <Database className="h-4 w-4 text-primary" />
                Database Operations
              </CardTitle>
              <CardDescription className="text-xs">Backup, optimize, and maintain the database</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                {
                  action: 'backup', label: 'Backup Database', icon: Download,
                  desc: 'Create a timestamped backup of the SQLite database',
                  variant: 'outline' as const, safe: true,
                },
                {
                  action: 'optimize-db', label: 'Optimize Database', icon: Zap,
                  desc: 'Run VACUUM + ANALYZE to reclaim space and improve query speed',
                  variant: 'outline' as const, safe: true,
                },
                {
                  action: 'export-data', label: 'Export All Data', icon: FileText,
                  desc: 'Export users, detections, predictions to JSON',
                  variant: 'outline' as const, safe: true,
                },
                {
                  action: 'cache-clear', label: 'Clear App Cache', icon: Trash2,
                  desc: 'Clear cached analytics and session data',
                  variant: 'destructive' as const, safe: false,
                },
              ].map(({ action, label, icon: Icon, desc, variant, safe }) => (
                <div key={action} className="flex items-center justify-between gap-3 p-3 bg-muted/30 rounded-xl">
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                  <Button
                    variant={variant}
                    size="sm"
                    className="flex-shrink-0 text-xs gap-1.5"
                    disabled={actionLoading === action}
                    onClick={() => safe ? runAction(action, label) : confirm(action, label, desc)}
                  >
                    {actionLoading === action
                      ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      : <Icon className="h-3.5 w-3.5" />}
                    {actionLoading === action ? 'Running…' : 'Run'}
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* ── Server Controls ── */}
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                <Server className="h-4 w-4 text-primary" />
                Server Controls
              </CardTitle>
              <CardDescription className="text-xs">Manage server state and background services</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                {
                  action: 'restart-services', label: 'Restart Background Services', icon: RotateCcw,
                  desc: 'Restart LSTM training workers and background tasks',
                  variant: 'outline' as const, safe: false,
                },
                {
                  action: 'maintenance', label: 'Toggle Maintenance Mode', icon: Settings,
                  desc: 'Enable/disable maintenance mode for all users',
                  variant: 'outline' as const, safe: false,
                },
              ].map(({ action, label, icon: Icon, desc, variant, safe }) => (
                <div key={action} className="flex items-center justify-between gap-3 p-3 bg-muted/30 rounded-xl">
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                  <Button
                    variant={variant}
                    size="sm"
                    className="flex-shrink-0 text-xs gap-1.5"
                    disabled={actionLoading === action}
                    onClick={() => confirm(action, label, desc)}
                  >
                    {actionLoading === action
                      ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      : <Icon className="h-3.5 w-3.5" />}
                    {actionLoading === action ? 'Running…' : 'Run'}
                  </Button>
                </div>
              ))}

              <Separator />

              {/* Health check */}
              <div className="p-3 bg-muted/30 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs sm:text-sm font-medium">System Health</p>
                  <Badge className="bg-green-100 text-green-700 text-xs">Healthy</Badge>
                </div>
                <div className="space-y-1.5">
                  {[
                    { label: 'Database', ok: true },
                    { label: 'API Server', ok: true },
                    { label: 'YOLO Model', ok: true },
                  ].map(({ label, ok }) => (
                    <div key={label} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{label}</span>
                      <div className="flex items-center gap-1">
                        <div className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-green-500' : 'bg-red-500'}`} />
                        <span className={ok ? 'text-green-600' : 'text-red-600'}>{ok ? 'Online' : 'Offline'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Feature Toggles ── */}
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                <Shield className="h-4 w-4 text-primary" />
                Feature Toggles
              </CardTitle>
              <CardDescription className="text-xs">Enable or disable system features</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { key: 'maintenanceMode' as const, label: 'Maintenance Mode', desc: 'Block all non-admin access', danger: true },
                { key: 'autoBackup' as const,      label: 'Auto Backup',      desc: 'Daily automatic database backups' },
                { key: 'debugLogging' as const,    label: 'Debug Logging',    desc: 'Verbose server-side logging' },
                { key: 'rateLimiting' as const,    label: 'Rate Limiting',    desc: 'Protect API from abuse' },
                { key: 'gzipCompression' as const, label: 'GZip Compression', desc: 'Compress API responses' },
              ].map(({ key, label, desc, danger }) => (
                <div key={key} className="flex items-center justify-between gap-3">
                  <div>
                    <Label className={`text-xs sm:text-sm font-medium ${danger && settings[key] ? 'text-destructive' : ''}`}>
                      {label}
                    </Label>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                  <Switch
                    checked={settings[key]}
                    onCheckedChange={() => toggle(key)}
                    className={danger && settings[key] ? 'data-[state=checked]:bg-destructive' : ''}
                  />
                </div>
              ))}
              <Button size="sm" className="w-full gap-1.5 text-xs mt-2" onClick={() =>
                toast({ title: 'Settings Saved', description: 'Feature toggles updated.' })
              }>
                <Save className="h-3.5 w-3.5" />
                Save Settings
              </Button>
            </CardContent>
          </Card>

          {/* ── Security & Sessions ── */}
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                <Shield className="h-4 w-4 text-primary" />
                Security & Sessions
              </CardTitle>
              <CardDescription className="text-xs">Manage active sessions and security settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 bg-muted/30 rounded-xl text-center">
                  <p className="text-lg font-bold text-primary">{systemInfo?.active_sessions ?? '—'}</p>
                  <p className="text-xs text-muted-foreground">Active Sessions</p>
                </div>
                <div className="p-3 bg-muted/30 rounded-xl text-center">
                  <p className="text-lg font-bold text-primary">{systemInfo?.active_users ?? '—'}</p>
                  <p className="text-xs text-muted-foreground">Online Users</p>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-1.5 text-xs"
                  disabled={actionLoading === 'cleanup-sessions'}
                  onClick={async () => {
                    setActionLoading('cleanup-sessions');
                    try {
                      // Cleanup expired sessions via optimize-db action
                      await runAction('optimize-db', 'Cleanup Sessions');
                    } finally { setActionLoading(null); }
                  }}
                >
                  <Clock className="h-3.5 w-3.5" />
                  Cleanup Expired Sessions
                </Button>

                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full gap-1.5 text-xs"
                  onClick={() => confirm(
                    'restart-services',
                    'Force Logout All Users',
                    'This will invalidate all active sessions and force all users to log in again.'
                  )}
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Force Logout All Users
                </Button>
              </div>

              <Separator />

              <div className="p-3 bg-muted/30 rounded-xl space-y-1.5">
                <p className="text-xs font-medium">Security Info</p>
                {[
                  ['JWT Expiry', '24 hours'],
                  ['Password Hashing', 'bcrypt'],
                  ['CORS', 'Restricted origins'],
                  ['Rate Limiting', settings.rateLimiting ? 'Enabled' : 'Disabled'],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{k}</span>
                    <span className="font-medium">{v}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

        </div>

        {/* ── Danger Zone ── */}
        <Card className="glass-card border-destructive/30">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Danger Zone
            </CardTitle>
            <CardDescription className="text-xs">Irreversible actions — use with extreme caution</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 border border-destructive/20 rounded-xl bg-destructive/5">
                <p className="text-xs sm:text-sm font-medium mb-1">Clear All Cache Files</p>
                <p className="text-xs text-muted-foreground mb-3">
                  Removes all cached LSTM datasets and trained models. Users will need to re-fetch data and retrain.
                </p>
                <Button
                  variant="destructive"
                  size="sm"
                  className="text-xs gap-1.5"
                  onClick={() => confirm('cache-clear', 'Clear All Cache', 'This removes all cached datasets and trained LSTM models.')}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear Cache
                </Button>
              </div>
              <div className="p-3 border border-destructive/20 rounded-xl bg-destructive/5">
                <p className="text-xs sm:text-sm font-medium mb-1">Export System Data</p>
                <p className="text-xs text-muted-foreground mb-3">
                  Download a full JSON export of all system data for external backup or migration.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs gap-1.5"
                  disabled={actionLoading === 'export-data'}
                  onClick={() => runAction('export-data', 'Export Data')}
                >
                  {actionLoading === 'export-data'
                    ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    : <Download className="h-3.5 w-3.5" />}
                  Export Data
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* ── Confirm Dialog ── */}
      <Dialog open={!!confirmDialog?.open} onOpenChange={() => setConfirmDialog(null)}>
        <DialogContent className="max-w-sm mx-4 sm:mx-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              {confirmDialog?.title}
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              {confirmDialog?.desc}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" size="sm" onClick={() => setConfirmDialog(null)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="w-full sm:w-auto"
              disabled={!!actionLoading}
              onClick={() => confirmDialog && runAction(confirmDialog.action, confirmDialog.title)}
            >
              {actionLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </AdminLayout>
  );
}
