import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Search, Filter, Image, Video, Calendar,
  Clock, Package, FileX, Trash2, Eye,
  AlertTriangle, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { PageTransition, staggerContainer, fadeInUp } from "@/components/layout/PageTransition";
import { MainLayout } from "@/components/layout/MainLayout";
import { dataService, HistoryItem } from "@/services/data.service";
import { useToast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/queryKeys";
import ENV from "@/config/env";

const API_URL = ENV.API_URL;

export default function HistoryPage() {
  const [searchQuery, setSearchQuery]       = useState("");
  const [typeFilter, setTypeFilter]         = useState("all");
  const [dateFilter, setDateFilter]         = useState("all");
  const [showDeleteDialog, setShowDeleteDialog]   = useState(false);
  const [showClearAllDialog, setShowClearAllDialog] = useState(false);
  const [itemToDelete, setItemToDelete]     = useState<HistoryItem | null>(null);
  const [isDeleting, setIsDeleting]         = useState(false);
  const { toast }      = useToast();
  const queryClient    = useQueryClient();

  // ── React Query ─────────────────────────────────────────────────────────────
  // Automatically refetches whenever the "history" query key is invalidated
  // (e.g. after a new detection completes in Upload.tsx).
  const {
    data: historyData = [],
    isLoading,
    isFetching,
  } = useQuery<HistoryItem[]>({
    queryKey: queryKeys.history(),
    queryFn:  () => dataService.getHistory(),
    staleTime: 30 * 1000,       // treat data as fresh for 30 s
    gcTime:    5 * 60 * 1000,
    refetchOnWindowFocus: true, // refetch when user tabs back in
    refetchOnMount: "always",   // always hit the API on mount
  });

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.history() });
    toast({ title: "History Refreshed", description: "Detection history has been updated." });
  };

  const handleDeleteItem = (item: HistoryItem) => {
    setItemToDelete(item);
    setShowDeleteDialog(true);
  };

  const confirmDeleteItem = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    try {
      const token = localStorage.getItem("auth_token");
      if (token && itemToDelete.detectionId) {
        const res = await fetch(
          `${API_URL}/api/user/detections/${itemToDelete.detectionId}`,
          { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || "Failed to delete from server");
        }
      }

      // Optimistic update — remove from React Query cache immediately
      queryClient.setQueryData<HistoryItem[]>(queryKeys.history(), (old = []) =>
        old.filter((h) => h.id !== itemToDelete.id)
      );
      localStorage.removeItem("detectionHistory");

      toast({
        title: "Detection Deleted",
        description: `"${itemToDelete.filename}" has been permanently removed`,
      });
    } catch (error: any) {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete detection. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setItemToDelete(null);
    }
  };

  const handleClearAll = () => setShowClearAllDialog(true);

  const confirmClearAll = async () => {
    try {
      const token = localStorage.getItem("auth_token");
      if (token) {
        const res = await fetch(`${API_URL}/api/user/history/clear`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || "Failed to clear history from server");
        }
      }

      // Optimistic update — clear React Query cache immediately
      queryClient.setQueryData<HistoryItem[]>(queryKeys.history(), []);
      localStorage.removeItem("detectionHistory");

      toast({
        title: "History Cleared",
        description: "All detection history has been permanently removed",
      });
    } catch (error: any) {
      toast({
        title: "Clear Failed",
        description: error.message || "Failed to clear history. Please try again.",
        variant: "destructive",
      });
    } finally {
      setShowClearAllDialog(false);
    }
  };

  // ── Filtered data (derived, no extra state) ─────────────────────────────────
  const filteredData = useMemo(() => {
    return historyData.filter((item) => {
      const matchesSearch = item.filename.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType   = typeFilter === "all" || item.type === typeFilter;

      let matchesDate = true;
      if (dateFilter !== "all") {
        const itemDate = new Date(item.date);
        const now      = new Date();
        if (dateFilter === "today") {
          matchesDate = itemDate.toDateString() === now.toDateString();
        } else if (dateFilter === "week") {
          matchesDate = itemDate >= new Date(now.getTime() - 7 * 86400000);
        } else if (dateFilter === "month") {
          matchesDate = itemDate >= new Date(now.getTime() - 30 * 86400000);
        }
      }
      return matchesSearch && matchesType && matchesDate;
    });
  }, [historyData, searchQuery, typeFilter, dateFilter]);

  // ── Loading skeleton ─────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <MainLayout>
        <PageTransition className="page-container">
          <div className="max-w-4xl sm:max-w-5xl mx-auto">
            <div className="mb-4 sm:mb-6">
              <h1 className="section-header mb-1">Detection History</h1>
              <p className="text-muted-foreground text-xs sm:text-sm font-medium">
                View and manage your past detections
              </p>
            </div>
            <Card className="glass-card">
              <CardContent className="py-14 text-center">
                <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin mx-auto mb-4" />
                <p className="text-muted-foreground text-sm font-medium">Loading history…</p>
              </CardContent>
            </Card>
          </div>
        </PageTransition>
      </MainLayout>
    );
  }

  // ── Main render ──────────────────────────────────────────────────────────────
  return (
    <MainLayout>
      <PageTransition className="page-container">
        <div className="max-w-4xl sm:max-w-5xl mx-auto">

          {/* Header */}
          <div className="mb-4 sm:mb-6">
            <h1 className="section-header mb-1">Detection History</h1>
            <p className="text-muted-foreground text-xs sm:text-sm font-medium">
              View and manage your past detections
            </p>
          </div>

          {/* Filters */}
          <Card className="glass-card mb-4 sm:mb-6">
            <CardContent className="py-3 sm:py-4 px-3 sm:px-4">
              <div className="flex flex-col gap-2 sm:gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search by filename…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-9 text-[13px] font-medium"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-[115px] h-8 text-[12px] font-semibold">
                      <Filter className="h-3 w-3 mr-1" />
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="image">Images</SelectItem>
                      <SelectItem value="video">Videos</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={dateFilter} onValueChange={setDateFilter}>
                    <SelectTrigger className="w-[115px] h-8 text-[12px] font-semibold">
                      <Calendar className="h-3 w-3 mr-1" />
                      <SelectValue placeholder="Date" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Time</SelectItem>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="week">This Week</SelectItem>
                      <SelectItem value="month">This Month</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button
                    variant="outline" size="sm"
                    onClick={handleRefresh}
                    disabled={isFetching}
                    className="h-8 text-[12px] px-2.5 font-semibold"
                  >
                    <RefreshCw className={`h-3 w-3 mr-1 ${isFetching ? "animate-spin" : ""}`} />
                    Refresh
                  </Button>

                  {historyData.length > 0 && (
                    <Button
                      variant="outline" size="sm"
                      onClick={handleClearAll}
                      className="h-8 text-[12px] px-2.5 text-destructive hover:text-destructive font-semibold"
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Clear All
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Empty state */}
          {filteredData.length === 0 && (
            <Card className="glass-card">
              <CardContent className="py-14 text-center">
                <FileX className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
                <h3 className="font-display text-base font-bold mb-2 tracking-tight">
                  No Detection History
                </h3>
                <p className="text-muted-foreground text-[13px] mb-4 font-medium">
                  {searchQuery || typeFilter !== "all" || dateFilter !== "all"
                    ? "No results match your filters"
                    : "You haven't performed any detections yet"}
                </p>
                <Button asChild>
                  <Link to="/upload">Start Your First Detection</Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {/* History list */}
          {filteredData.length > 0 && (
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="show"
              className="space-y-3"
            >
              {filteredData.map((item) => (
                <motion.div key={item.id} variants={fadeInUp}>
                  <Card className="glass-card hover-lift cursor-pointer group">
                    <CardContent className="py-3 sm:py-4 px-3 sm:px-4">
                      <div className="flex items-center gap-3">
                        {/* Icon */}
                        <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                          {item.type === "image"
                            ? <Image className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                            : <Video className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <h3 className="font-semibold truncate text-[12.5px] sm:text-[13.5px] tracking-tight">
                              {item.filename}
                            </h3>
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 flex-shrink-0 font-bold uppercase">
                              {item.type}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[11px] text-muted-foreground font-medium">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />{item.date}
                            </span>
                            <span className="flex items-center gap-1">
                              <Package className="h-3 w-3" />{item.objects} obj
                            </span>
                            <span className="font-semibold text-foreground/70">
                              {item.confidence.toFixed(0)}%
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {item.classes.slice(0, 3).map((cls, i) => (
                              <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0 font-semibold">
                                {cls}
                              </Badge>
                            ))}
                            {item.classes.length > 3 && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-semibold">
                                +{item.classes.length - 3}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Link to={`/results/${item.id}`}>
                            <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8" title="View">
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost" size="icon"
                            className="h-7 w-7 sm:h-8 sm:w-8 text-destructive hover:text-destructive"
                            onClick={() => handleDeleteItem(item)}
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>

        {/* Delete dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent className="max-w-sm mx-4 sm:mx-auto rounded-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Delete Detection
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                Are you sure you want to delete{" "}
                <strong>"{itemToDelete?.filename}"</strong>?{" "}
                This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowDeleteDialog(false)} disabled={isDeleting} className="w-full sm:w-auto">
                Cancel
              </Button>
              <Button variant="destructive" size="sm" onClick={confirmDeleteItem} disabled={isDeleting} className="w-full sm:w-auto">
                {isDeleting ? "Deleting…" : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Clear All dialog */}
        <Dialog open={showClearAllDialog} onOpenChange={setShowClearAllDialog}>
          <DialogContent className="max-w-sm mx-4 sm:mx-auto rounded-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Clear All History
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                This will permanently remove{" "}
                <strong>all {historyData.length} detection results</strong>.
                This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowClearAllDialog(false)} className="w-full sm:w-auto">
                Cancel
              </Button>
              <Button variant="destructive" size="sm" onClick={confirmClearAll} className="w-full sm:w-auto">
                Clear All History
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </PageTransition>
    </MainLayout>
  );
}
