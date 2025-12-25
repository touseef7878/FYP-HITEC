import { motion } from "framer-motion";
import {
  BarChart3,
  TrendingUp,
  Package,
  Percent,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageTransition, staggerContainer, fadeInUp } from "@/components/layout/PageTransition";
import { MainLayout } from "@/components/layout/MainLayout";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";

// Sample analytics data
const stats = [
  {
    title: "Total Detections",
    value: "1,247",
    change: "+12.5%",
    trend: "up",
    icon: Package,
  },
  {
    title: "Avg Confidence",
    value: "94.2%",
    change: "+2.3%",
    trend: "up",
    icon: Percent,
  },
  {
    title: "This Week",
    value: "156",
    change: "+8.1%",
    trend: "up",
    icon: Calendar,
  },
  {
    title: "Detection Rate",
    value: "98.7%",
    change: "-0.2%",
    trend: "down",
    icon: TrendingUp,
  },
];

const pieData = [
  { name: "Plastic Bottles", value: 35, color: "hsl(203, 77%, 26%)" },
  { name: "Plastic Bags", value: 25, color: "hsl(170, 50%, 45%)" },
  { name: "Fishing Nets", value: 15, color: "hsl(177, 59%, 41%)" },
  { name: "Styrofoam", value: 12, color: "hsl(160, 84%, 39%)" },
  { name: "Other", value: 13, color: "hsl(38, 92%, 50%)" },
];

const trendData = [
  { date: "Mon", detections: 45, confidence: 92 },
  { date: "Tue", detections: 52, confidence: 94 },
  { date: "Wed", detections: 38, confidence: 91 },
  { date: "Thu", detections: 65, confidence: 96 },
  { date: "Fri", detections: 48, confidence: 93 },
  { date: "Sat", detections: 72, confidence: 95 },
  { date: "Sun", detections: 61, confidence: 94 },
];

const barData = [
  { class: "Bottles", count: 423 },
  { class: "Bags", count: 312 },
  { class: "Nets", count: 187 },
  { class: "Styrofoam", count: 156 },
  { class: "Caps", value: 98, count: 98 },
  { class: "Other", count: 71 },
];

export default function DashboardPage() {
  return (
    <MainLayout>
      <PageTransition className="page-container">
        <div className="mb-8">
          <h1 className="section-header">Analytics Dashboard</h1>
          <p className="text-muted-foreground">
            Real-time insights from marine plastic detection analysis
          </p>
        </div>

        {/* Stats Grid */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
        >
          {stats.map((stat, index) => (
            <motion.div key={index} variants={fadeInUp}>
              <Card className="glass-card hover-lift">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">
                        {stat.title}
                      </p>
                      <p className="text-2xl font-bold">{stat.value}</p>
                    </div>
                    <div className="w-10 h-10 rounded-lg ocean-gradient flex items-center justify-center">
                      <stat.icon className="h-5 w-5 text-white" />
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mt-2">
                    {stat.trend === "up" ? (
                      <ArrowUpRight className="h-4 w-4 text-success" />
                    ) : (
                      <ArrowDownRight className="h-4 w-4 text-destructive" />
                    )}
                    <span
                      className={`text-sm font-medium ${
                        stat.trend === "up" ? "text-success" : "text-destructive"
                      }`}
                    >
                      {stat.change}
                    </span>
                    <span className="text-sm text-muted-foreground">vs last week</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          {/* Detection Trend */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="glass-card h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Detection Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData}>
                      <defs>
                        <linearGradient id="colorDetections" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(203, 77%, 26%)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(203, 77%, 26%)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="date" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="detections"
                        stroke="hsl(203, 77%, 26%)"
                        strokeWidth={2}
                        fill="url(#colorDetections)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Class Distribution */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="glass-card h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Class Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] flex items-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          color: "hsl(var(--foreground))",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap justify-center gap-4 mt-4">
                  {pieData.map((item, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-sm text-muted-foreground">{item.name}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Object Counts Bar Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Objects by Class (Total Count)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="class" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar
                      dataKey="count"
                      fill="hsl(170, 50%, 45%)"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </PageTransition>
    </MainLayout>
  );
}
