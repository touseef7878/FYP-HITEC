import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Search,
  Filter,
  Image,
  Video,
  Calendar,
  ChevronRight,
  Clock,
  Package,
  FileX,
  Trash2,
  Eye,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageTransition, staggerContainer, fadeInUp } from "@/components/layout/PageTransition";
import { MainLayout } from "@/components/layout/MainLayout";
import { dataService, HistoryItem } from "@/lib/dataService";
import { useToast } from "@/hooks/use-toast";

export default function HistoryPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [historyData, setHistoryData] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showClearAllDialog, setShowClearAllDialog] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<HistoryItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  // Load history data
  useEffect(() => {
    const loadHistoryData = async () => {
      try {
        setIsLoading(true);
        const history = await dataService.getHistory();
        setHistoryData(history);
      } catch (error) {
        console.error('Error loading history data:', error);
        toast({
          title: "Error Loading History",
          description: "Failed to load detection history. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadHistoryData();
  }, [toast]);

  const filteredData = historyData.filter((item) => {
    const matchesSearch = item.filename
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === "all" || item.type === typeFilter;
    
    let matchesDate = true;
    if (dateFilter !== "all") {
      const itemDate = new Date(item.date);
      const now = new Date();
      
      switch (dateFilter) {
        case "today":
          matchesDate = itemDate.toDateString() === now.toDateString();
          break;
        case "week":
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          matchesDate = itemDate >= weekAgo;
          break;
        case "month":
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          matchesDate = itemDate >= monthAgo;
          break;
      }
    }
    
    return matchesSearch && matchesType && matchesDate;
  });

  const handleDeleteItem = async (item: HistoryItem) => {
    setItemToDelete(item);
    setShowDeleteDialog(true);
  };

  const confirmDeleteItem = async () => {
    if (!itemToDelete) return;
    
    setIsDeleting(true);
    try {
      // Call backend API to delete from database
      const token = localStorage.getItem('auth_token');
      if (token && itemToDelete.detectionId) {
        const response = await fetch(`http://localhost:8000/api/user/detections/${itemToDelete.detectionId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.detail || 'Failed to delete from server');
        }
      }

      // Update local state only after successful backend deletion
      const updatedHistory = historyData.filter(item => item.id !== itemToDelete.id);
      setHistoryData(updatedHistory);
      
      // Update localStorage as backup
      localStorage.setItem('detectionHistory', JSON.stringify(updatedHistory));
      
      toast({
        title: "Detection Deleted",
        description: `"${itemToDelete.filename}" has been permanently removed`,
      });

    } catch (error: any) {
      console.error('Error deleting item:', error);
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

  const handleClearAll = () => {
    setShowClearAllDialog(true);
  };

  const confirmClearAll = async () => {
    try {
      // Call backend API to clear all history
      const token = localStorage.getItem('auth_token');
      if (token) {
        const response = await fetch('http://localhost:8000/api/user/history/clear', {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.detail || 'Failed to clear history from server');
        }
      }

      // Clear local state only after successful backend deletion
      setHistoryData([]);
      
      // Clear localStorage
      localStorage.removeItem('detectionHistory');
      
      toast({
        title: "History Cleared",
        description: "All detection history has been permanently removed",
      });

    } catch (error: any) {
      console.error('Error clearing history:', error);
      toast({
        title: "Clear Failed",
        description: error.message || "Failed to clear history. Please try again.",
        variant: "destructive",
      });
    } finally {
      setShowClearAllDialog(false);
    }
  };

  if (isLoading) {
    return (
      <MainLayout>
        <PageTransition className="page-container">
          <div className="max-w-5xl mx-auto">
            <div className="mb-8">
              <h1 className="section-header">Detection History</h1>
              <p className="text-muted-foreground">
                Browse and manage your past detection results
              </p>
            </div>
            <Card className="glass-card">
              <CardContent className="py-12 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading history...</p>
              </CardContent>
            </Card>
          </div>
        </PageTransition>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <PageTransition className="page-container">
        <div className="max-w-5xl mx-auto">
          <div className="mb-8">
            <h1 className="section-header">Detection History</h1>
            <p className="text-muted-foreground">
              Browse and manage your past detection results
            </p>
          </div>

          {/* Filters */}
          <Card className="glass-card mb-6">
            <CardContent className="py-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by filename..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex gap-2">
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-[130px]">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="image">Images</SelectItem>
                      <SelectItem value="video">Videos</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={dateFilter} onValueChange={setDateFilter}>
                    <SelectTrigger className="w-[130px]">
                      <Calendar className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Date" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Time</SelectItem>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="week">This Week</SelectItem>
                      <SelectItem value="month">This Month</SelectItem>
                    </SelectContent>
                  </Select>
                  {historyData.length > 0 && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={handleClearAll}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Clear All
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {filteredData.length === 0 && !isLoading && (
            <Card className="glass-card">
              <CardContent className="py-12 text-center">
                <FileX className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No Detection History</h3>
                <p className="text-muted-foreground mb-4">
                  {searchQuery || typeFilter !== "all" || dateFilter !== "all"
                    ? "No results found for your search criteria" 
                    : "You haven't performed any detections yet"}
                </p>
                <Button asChild>
                  <Link to="/upload">Start Your First Detection</Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {filteredData.length > 0 && (
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="show"
              className="space-y-4"
            >
              {filteredData.map((item, index) => (
                <motion.div key={item.id} variants={fadeInUp}>
                  <Card className="glass-card hover-lift cursor-pointer group">
                    <CardContent className="py-4">
                      <div className="flex items-center gap-4">
                        {/* Icon */}
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                          {item.type === "image" ? (
                            <Image className="h-6 w-6 text-primary" />
                          ) : (
                            <Video className="h-6 w-6 text-primary" />
                          )}
                        </div>

                        {/* Main Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium truncate">{item.filename}</h3>
                            <Badge variant="secondary" className="text-xs">
                              {item.type}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" />
                              {item.date} at {item.time}
                            </span>
                            <span className="flex items-center gap-1">
                              <Package className="h-3.5 w-3.5" />
                              {item.objects} objects
                            </span>
                            <span>{item.confidence.toFixed(1)}% confidence</span>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {item.classes.map((cls, i) => (
                              <Badge
                                key={i}
                                variant="outline"
                                className="text-xs"
                              >
                                {cls}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Link to={`/results/${item.id}`}>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="View Results"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Link to={`/results/${item.id}`}>
                            <Button variant="ghost" size="icon" title="Open Results">
                              <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteItem(item)}
                            className="text-destructive hover:text-destructive"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
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

        {/* Delete Confirmation Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Delete Detection
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to delete <strong>"{itemToDelete?.filename}"</strong>? 
                This will permanently remove the detection result and cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setShowDeleteDialog(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={confirmDeleteItem}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Clear All Confirmation Dialog */}
        <Dialog open={showClearAllDialog} onOpenChange={setShowClearAllDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Clear All History
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to clear all detection history? This will permanently 
                remove <strong>all {historyData.length} detection results</strong> and cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setShowClearAllDialog(false)}
              >
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={confirmClearAll}
              >
                Clear All History
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageTransition>
    </MainLayout>
  );
}
