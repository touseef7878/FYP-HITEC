import { Sun, Moon, Trash2, Info, Monitor, Cpu, Download, Upload, RefreshCw, LogOut, User, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageTransition } from "@/components/layout/PageTransition";
import { MainLayout } from "@/components/layout/MainLayout";
import { useTheme } from "@/hooks/useTheme";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { dataService } from "@/services/data.service";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import logger from "@/utils/logger";
import { queryKeys } from "@/lib/queryKeys";
import ENV from "@/config/env";

const API_URL = ENV.API_URL;

export default function SettingsPage() {
  const { theme, toggleTheme } = useTheme();
  const { toast }    = useToast();
  const { user, logout } = useAuth();
  const navigate     = useNavigate();
  const queryClient  = useQueryClient();

  const [isClearing, setIsClearing]   = useState(false);
  const [isDeleting, setIsDeleting]   = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showClearDialog, setShowClearDialog]   = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Pull stats from React Query cache (already fetched by History/Dashboard)
  const [historyQuery, analyticsQuery] = useQueries({
    queries: [
      {
        queryKey: queryKeys.history(),
        queryFn:  () => dataService.getHistory(),
        staleTime: 30 * 1000,
        refetchOnMount: true as const,
      },
      {
        queryKey: queryKeys.analytics(),
        queryFn:  () => dataService.getAnalytics(),
        staleTime: 30 * 1000,
        refetchOnMount: true as const,
      },
    ],
  });

  const stats = {
    detections:   historyQuery.data?.length ?? 0,
    totalObjects: analyticsQuery.data?.stats.totalDetections ?? 0,
    hotspots:     dataService.getHotspots().length,
  };

  const handleClearHistory = async () => {
    setIsClearing(true);
    setShowClearDialog(false);
    try {
      const token = localStorage.getItem("auth_token");
      if (token) {
        const res = await fetch(`${API_URL}/api/user/history/clear`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Server error");
      }
      await dataService.clearAllData();
      // Invalidate React Query caches so History/Dashboard update immediately
      queryClient.setQueryData(queryKeys.history(), []);
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics() });
      toast({ title: "History Cleared", description: "All detection history removed." });
    } catch {
      toast({ title: "Error", description: "Failed to clear history.", variant: "destructive" });
    } finally { setIsClearing(false); }
  };

  const handleDeleteAllData = async () => {
    setIsDeleting(true);
    setShowDeleteDialog(false);
    try {
      const token = localStorage.getItem("auth_token");
      if (!token) throw new Error("Not authenticated");
      const res = await fetch(`${API_URL}/api/user/data/all`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed");
      }
      await dataService.clearAllData();
      // Invalidate all caches
      queryClient.setQueryData(queryKeys.history(), []);
      queryClient.setQueryData(queryKeys.reports(), []);
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics() });
      toast({ title: "All Data Deleted", description: "Your account data has been permanently removed." });
    } catch (e: any) {
      toast({ title: "Delete Failed", description: e.message, variant: "destructive" });
    } finally { setIsDeleting(false); }
  };

  const handleExportData = async () => {
    try {
      const token = localStorage.getItem("auth_token");
      if (!token) throw new Error("Not authenticated");
      const res = await fetch(`${API_URL}/api/user/data/export`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Export failed");
      const result = await res.json();
      const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `oceanguard-${user?.username}-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Data Exported", description: "Your data has been downloaded." });
    } catch (e: any) {
      toast({ title: "Export Failed", description: e.message, variant: "destructive" });
    }
  };

  const handleImportData = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          if (dataService.importData(ev.target?.result as string)) {
            toast({ title: "Data Imported", description: "Import successful." });
            window.location.reload();
          } else throw new Error();
        } catch {
          toast({ title: "Import Failed", description: "Invalid file format.", variant: "destructive" });
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try { await logout(); navigate("/auth"); }
    catch { toast({ title: "Logout Failed", variant: "destructive" }); }
    finally { setIsLoggingOut(false); }
  };

  return (
    <MainLayout>
      <PageTransition className="page-container">
        <div className="max-w-xl sm:max-w-2xl mx-auto">

          <div className="mb-4 sm:mb-6">
            <h1 className="section-header mb-1">Settings</h1>
            <p className="text-muted-foreground text-xs sm:text-sm font-medium">Manage your account and preferences</p>
          </div>

          {/* Account */}
          <Card className="glass-card mb-3 sm:mb-4">
            <CardHeader className="pb-2 sm:pb-4">
              <CardTitle className="flex items-center gap-2 text-[13.5px] sm:text-[15px] font-display font-bold tracking-tight">
                <User className="h-4 w-4 text-primary" />
                Account
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-3 p-3 sm:p-4 bg-muted/40 rounded-xl">
                <div className="min-w-0">
                  <p className="font-display font-bold text-sm sm:text-[15px] truncate tracking-tight">{user?.username}</p>
                  <p className="text-xs sm:text-[13px] text-muted-foreground truncate font-medium mt-0.5">{user?.email || "No email set"}</p>
                  <span className="inline-block mt-1.5 text-[11px] px-2 py-0.5 rounded-full bg-primary/12 text-primary font-bold uppercase tracking-wide">
                    {user?.role}
                  </span>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="flex-shrink-0 text-xs sm:text-[13px] font-bold"
                >
                  {isLoggingOut
                    ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    : <><LogOut className="h-3.5 w-3.5 mr-1.5" />Logout</>}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Appearance */}
          <Card className="glass-card mb-3 sm:mb-4">
            <CardHeader className="pb-2 sm:pb-4">
              <CardTitle className="flex items-center gap-2 text-[13.5px] sm:text-[15px] font-display font-bold tracking-tight">
                <Monitor className="h-4 w-4 text-primary" />
                Appearance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-3 bg-muted/40 rounded-xl">
                <div className="flex items-center gap-3">
                  {theme === "light"
                    ? <Sun className="h-4 w-4 text-warning" />
                    : <Moon className="h-4 w-4 text-primary" />}
                  <div>
                    <Label className="text-[13.5px] sm:text-[15px] font-semibold">Dark Mode</Label>
                    <p className="text-[11px] text-muted-foreground font-medium">Switch between light and dark</p>
                  </div>
                </div>
                <Switch checked={theme === "dark"} onCheckedChange={toggleTheme} />
              </div>
            </CardContent>
          </Card>

          {/* Model Info */}
          <Card className="glass-card mb-3 sm:mb-4">
            <CardHeader className="pb-2 sm:pb-4">
              <CardTitle className="flex items-center gap-2 text-[13.5px] sm:text-[15px] font-display font-bold tracking-tight">
                <Cpu className="h-4 w-4 text-primary" />
                Model Configuration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-3 bg-primary/8 rounded-xl flex items-start gap-2.5 mb-3 border border-primary/15">
                <Info className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-[12.5px] sm:text-[13.5px]">YOLOv26s — Custom Marine Debris Model</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 font-medium">Trained on ~16,500 images from 7 merged marine datasets</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[12px] sm:text-[13px]">
                {[
                  ["Version", "v1.0.0"],
                  ["Classes", "8"],
                  ["Resolution", "640 × 640"],
                  ["mAP50", "71%"],
                  ["Precision", "83%"],
                  ["Recall", "67%"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between p-2.5 bg-muted/40 rounded-xl">
                    <span className="text-muted-foreground font-medium">{k}</span>
                    <span className="font-bold">{v}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Data Management */}
          <Card className="glass-card mb-3 sm:mb-4">
            <CardHeader className="pb-2 sm:pb-4">
              <CardTitle className="flex items-center gap-2 text-[13.5px] sm:text-[15px] font-display font-bold tracking-tight">
                <Trash2 className="h-4 w-4 text-primary" />
                Data Management
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Detections", value: stats.detections },
                  { label: "Objects", value: stats.totalObjects },
                  { label: "Hotspots", value: stats.hotspots },
                ].map((s) => (
                  <div key={s.label} className="text-center p-3 sm:p-3.5 bg-muted/40 rounded-xl">
                    <div className="font-display text-xl sm:text-2xl font-bold text-primary tracking-tight">{s.value}</div>
                    <div className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>

              <Separator />

              {/* Export / Import */}
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" onClick={handleExportData} className="text-[12.5px] font-semibold">
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  Export Data
                </Button>
                <Button variant="outline" size="sm" onClick={handleImportData} className="text-[12.5px] font-semibold">
                  <Upload className="h-3.5 w-3.5 mr-1.5" />
                  Import Data
                </Button>
              </div>

              {/* Clear History */}
              <div className="p-3 sm:p-4 bg-destructive/6 rounded-xl border border-destructive/15">
                <h4 className="font-bold text-destructive text-[12.5px] sm:text-[13.5px] mb-1">Clear Detection History</h4>
                <p className="text-[11px] text-muted-foreground mb-3 font-medium">Permanently delete all detection history.</p>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowClearDialog(true)}
                  disabled={isClearing}
                  className="text-[12.5px] font-bold"
                >
                  {isClearing
                    ? <><RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />Clearing...</>
                    : <><Trash2 className="h-3.5 w-3.5 mr-1.5" />Clear History</>}
                </Button>
              </div>

              {/* Delete All */}
              <div className="p-3 sm:p-4 bg-destructive/6 rounded-xl border border-destructive/15">
                <h4 className="font-bold text-destructive text-[12.5px] sm:text-[13.5px] mb-1 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Delete ALL Account Data
                </h4>
                <p className="text-[11px] text-muted-foreground mb-3 font-medium">
                  Permanently removes all detections, reports, predictions, and files. Cannot be undone.
                </p>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={isDeleting}
                  className="text-[12.5px] font-bold"
                >
                  {isDeleting
                    ? <><RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />Deleting...</>
                    : <><Trash2 className="h-3.5 w-3.5 mr-1.5" />Delete All Data</>}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* About */}
          <p className="text-center text-[11px] text-muted-foreground py-4 font-medium">
            OceanGuard AI — Marine Plastic Detection Platform · FYP 2026
          </p>
        </div>

        {/* ── Clear History Dialog ── */}
        <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
          <DialogContent className="max-w-sm mx-4 sm:mx-auto rounded-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <Trash2 className="h-4 w-4 text-destructive" />
                Clear Detection History
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                This will permanently delete all your detection history. This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowClearDialog(false)} className="w-full sm:w-auto">
                Cancel
              </Button>
              <Button variant="destructive" size="sm" onClick={handleClearHistory} className="w-full sm:w-auto">
                Clear History
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Delete All Data Dialog ── */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent className="max-w-sm mx-4 sm:mx-auto rounded-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base text-destructive">
                <AlertTriangle className="h-4 w-4" />
                Delete All Account Data
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                This will permanently delete <strong>all</strong> your detections, reports, predictions, analytics, and files.
                This action <strong>cannot be undone</strong>.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowDeleteDialog(false)} className="w-full sm:w-auto">
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeleteAllData}
                className="w-full sm:w-auto bg-red-600 hover:bg-red-700"
              >
                Yes, Delete Everything
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </PageTransition>
    </MainLayout>
  );
}
