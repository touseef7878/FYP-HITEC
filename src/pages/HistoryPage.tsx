import { useState } from "react";
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
import { PageTransition, staggerContainer, fadeInUp } from "@/components/layout/PageTransition";
import { MainLayout } from "@/components/layout/MainLayout";

// Sample history data
const historyData = [
  {
    id: "det_001",
    filename: "pacific_sample_001.jpg",
    type: "image",
    date: "2024-01-15",
    time: "14:32",
    objects: 47,
    confidence: 94.5,
    classes: ["Plastic Bottle", "Plastic Bag", "Fishing Net"],
  },
  {
    id: "det_002",
    filename: "underwater_video_001.mp4",
    type: "video",
    date: "2024-01-14",
    time: "09:15",
    objects: 128,
    confidence: 92.1,
    classes: ["Styrofoam", "Plastic Cap", "Other"],
  },
  {
    id: "det_003",
    filename: "beach_debris_002.jpg",
    type: "image",
    date: "2024-01-13",
    time: "16:45",
    objects: 23,
    confidence: 97.2,
    classes: ["Plastic Bottle", "Plastic Cap"],
  },
  {
    id: "det_004",
    filename: "ocean_surface_003.jpg",
    type: "image",
    date: "2024-01-12",
    time: "11:20",
    objects: 56,
    confidence: 91.8,
    classes: ["Fishing Net", "Plastic Bag"],
  },
  {
    id: "det_005",
    filename: "dive_footage_002.mp4",
    type: "video",
    date: "2024-01-11",
    time: "08:00",
    objects: 89,
    confidence: 93.4,
    classes: ["Plastic Bottle", "Styrofoam", "Other"],
  },
];

export default function HistoryPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");

  const filteredData = historyData.filter((item) => {
    const matchesSearch = item.filename
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === "all" || item.type === typeFilter;
    return matchesSearch && matchesType;
  });

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
                </div>
              </div>
            </CardContent>
          </Card>

          {/* History Timeline */}
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            className="space-y-4"
          >
            {filteredData.map((item, index) => (
              <motion.div key={item.id} variants={fadeInUp}>
                <Link to={`/results`}>
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
                            <span>{item.confidence}% confidence</span>
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

                        {/* Arrow */}
                        <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </motion.div>

          {filteredData.length === 0 && (
            <Card className="glass-card">
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">No results found</p>
              </CardContent>
            </Card>
          )}
        </div>
      </PageTransition>
    </MainLayout>
  );
}
