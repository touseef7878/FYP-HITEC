import { motion } from "framer-motion";
import { Link, Navigate } from "react-router-dom";
import { Upload, BarChart3, Map, TrendingUp, ArrowRight, Sparkles, Shield, Zap, Users, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageTransition, staggerContainer, fadeInUp } from "@/components/layout/PageTransition";
import { MainLayout } from "@/components/layout/MainLayout";
import { FishBackground } from "@/components/features/home/FishBackground";
import { useAuth } from "@/contexts/AuthContext";
import logoImg from "@/assets/images/marine-logo.png";
const features = [{
  icon: Sparkles,
  title: "AI-Powered Detection",
  description: "YOLOv12n model trained on marine plastic waste for accurate detection"
}, {
  icon: TrendingUp,
  title: "LSTM Predictions",
  description: "Forecast pollution trends and hotspot accumulation zones"
}, {
  icon: Map,
  title: "Interactive Heatmaps",
  description: "Visualize pollution density across global marine regions"
}, {
  icon: Shield,
  title: "Real-time Processing",
  description: "Process images and videos with live progress tracking"
}];
const stats = [{
  value: "95%+",
  label: "Detection Accuracy"
}, {
  value: "12",
  label: "Plastic Classes"
}, {
  value: "50+",
  label: "Research Locations"
}, {
  value: "<2s",
  label: "Processing Time"
}];
const teamMembers = [{
  name: "Touseef Ur Rehman",
  role: "ML Engineer"
}, {
  name: "Qasim Shahzad",
  role: "Backend Engineer"
}, {
  name: "Zohaib Ashraf",
  role: "Frontend Engineer"
}];
export default function HomePage() {
  const { isAuthenticated, isAdmin } = useAuth();

  // Only redirect authenticated admins to admin panel
  // Regular users should be able to access the home page
  if (isAuthenticated && isAdmin) {
    return <Navigate to="/admin" replace />;
  }
  return <MainLayout>
      <PageTransition className="page-container">
        {/* Hero Section with Underwater Scene */}
        <section className="relative overflow-hidden rounded-2xl lg:rounded-3xl mb-8 lg:mb-12 min-h-[500px] lg:min-h-[650px]">
          {/* Underwater Video Background */}
          <div className="absolute inset-0 z-0">
            <video autoPlay loop muted playsInline className="w-full h-full object-cover" poster="https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=1920&q=80">
              <source src="https://cdn.pixabay.com/video/2024/03/21/205032-925779429_large.mp4" type="video/mp4" />
            </video>
          </div>
          
          {/* Overlay Gradient */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#0A1628]/95 via-[#0F4C75]/80 to-[#0A1628]/70 z-10" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A1628] via-transparent to-transparent z-10" />
          
          {/* Animated Fish Layer */}
          <div className="absolute inset-0 z-15 hidden md:block">
            <FishBackground />
          </div>

          <div className="relative z-20 px-4 py-10 sm:px-6 sm:py-12 lg:py-24 lg:px-16">
            <div className="max-w-4xl">
              {/* University Badge */}
              <motion.div initial={{
              opacity: 0,
              y: -20
            }} animate={{
              opacity: 1,
              y: 0
            }} transition={{
              duration: 0.5
            }} className="inline-flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 mb-4 sm:mb-6">
                <GraduationCap className="h-3 w-3 sm:h-4 sm:w-4 text-cyan-300" />
                <span className="text-white/90 text-xs sm:text-sm font-medium">HITEC University Taxila — FYP 2026</span>
              </motion.div>

              <motion.div initial={{
              opacity: 0,
              y: 30
            }} animate={{
              opacity: 1,
              y: 0
            }} transition={{
              duration: 0.6,
              delay: 0.1
            }}>
                <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                  <motion.img src={logoImg} alt="OceanGuard AI" className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl" animate={{
                  rotate: [0, 5, -5, 0]
                }} transition={{
                  duration: 4,
                  repeat: Infinity
                }} />
                  <span className="text-cyan-300 text-xs sm:text-sm font-semibold uppercase tracking-widest">
                    AI Research Platform
                  </span>
                </div>
                
                <h1 className="text-2xl sm:text-4xl lg:text-6xl font-bold text-white mb-4 sm:mb-6 leading-tight">
                  Marine Plastic Pollution
                  <br />
                  <span className="bg-gradient-to-r from-cyan-300 via-teal-300 to-emerald-300 bg-clip-text text-transparent">
                    Detection & Analysis
                  </span>
                </h1>
                
                <p className="text-sm sm:text-lg lg:text-xl text-white/70 mb-6 sm:mb-8 max-w-2xl leading-relaxed">An intelligent system leveraging YOLOv12n for debris detection and LSTM networks for predictive analysis of marine plastic pollution patterns.<span className="text-cyan-300 font-medium">YOLOv12n</span> for real-time detection 
                  and <span className="text-teal-300 font-medium">LSTM networks</span> for predictive analysis of marine plastic pollution patterns.
                </p>
                
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-8 sm:mb-12">
                  <Button size="lg" className="group bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-white border-0 shadow-lg shadow-cyan-500/25 w-full sm:w-auto" asChild>
                    <Link to="/upload">
                      <Upload className="mr-2 h-5 w-5" />
                      Start Detection
                      <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </Link>
                  </Button>
                  <Button size="lg" variant="outline" className="bg-white/5 border-white/20 text-white hover:bg-white/10 backdrop-blur-sm w-full sm:w-auto" asChild>
                    <Link to="/dashboard">
                      <BarChart3 className="mr-2 h-5 w-5" />
                      View Analytics
                    </Link>
                  </Button>
                </div>

                {/* Team Section */}
                <motion.div initial={{
                opacity: 0,
                y: 20
              }} animate={{
                opacity: 1,
                y: 0
              }} transition={{
                duration: 0.6,
                delay: 0.4
              }} className="pt-6 sm:pt-8 border-t border-white/10">
                  <div className="flex items-center gap-2 mb-3 sm:mb-4">
                    <Users className="h-4 w-4 text-cyan-300" />
                    <span className="text-white/60 text-xs sm:text-sm uppercase tracking-wider">Project Team</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                    {teamMembers.map((member, index) => <motion.div key={member.name} initial={{
                    opacity: 0,
                    x: -20
                  }} animate={{
                    opacity: 1,
                    x: 0
                  }} transition={{
                    delay: 0.5 + index * 0.1
                  }} className="flex items-center gap-3">
                        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-cyan-400 to-teal-500 flex items-center justify-center text-white font-bold text-xs sm:text-sm flex-shrink-0">
                          {member.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <p className="text-white font-medium text-xs sm:text-sm">{member.name}</p>
                          <p className="text-white/50 text-xs">{member.role}</p>
                        </div>
                      </motion.div>)}
                  </div>
                </motion.div>
              </motion.div>
            </div>
          </div>
          
          {/* Bottom Wave */}
          <div className="absolute bottom-0 left-0 right-0 z-20">
            <svg viewBox="0 0 1200 120" className="w-full h-12 sm:h-16 fill-background">
              <path d="M0,60 C300,120 600,0 900,60 C1200,120 1200,120 1200,120 L1200,120 L0,120 Z" />
            </svg>
          </div>
        </section>

        {/* Stats Section */}
        <motion.section variants={staggerContainer} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8 lg:mb-12">
          {stats.map((stat, index) => <motion.div key={index} variants={fadeInUp}>
              <Card className="glass-card hover-lift text-center py-4 sm:py-6">
                <CardContent className="p-0">
                  <p className="text-xl sm:text-3xl font-bold gradient-text mb-1">{stat.value}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">{stat.label}</p>
                </CardContent>
              </Card>
            </motion.div>)}
        </motion.section>

        {/* Features Section */}
        <section className="mb-8 lg:mb-12">
          <div className="text-center mb-6 sm:mb-8">
            <h2 className="text-xl sm:text-2xl font-bold mb-2">Platform Capabilities</h2>
            <p className="text-muted-foreground text-sm sm:text-base">
              Advanced tools for marine pollution research and analysis
            </p>
          </div>
          <motion.div variants={staggerContainer} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {features.map((feature, index) => <motion.div key={index} variants={fadeInUp}>
                <Card className="glass-card hover-lift h-full">
                  <CardContent className="pt-5 sm:pt-6">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl ocean-gradient flex items-center justify-center mb-3 sm:mb-4">
                      <feature.icon className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                    </div>
                    <h3 className="font-semibold mb-1 sm:mb-2 text-sm sm:text-base">{feature.title}</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>)}
          </motion.div>
        </section>

        {/* Quick Actions */}
        <section className="mb-8 lg:mb-12">
          <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <Link to="/upload">
              <Card className="glass-card hover-lift cursor-pointer group">
                <CardContent className="flex items-center gap-3 sm:gap-4 p-4 sm:p-6">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors flex-shrink-0">
                    <Upload className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm sm:text-base">Upload Media</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Detect plastic in images/videos
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
            <Link to="/heatmap">
              <Card className="glass-card hover-lift cursor-pointer group">
                <CardContent className="flex items-center gap-3 sm:gap-4 p-4 sm:p-6">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-secondary/10 flex items-center justify-center group-hover:bg-secondary/20 transition-colors flex-shrink-0">
                    <Map className="h-5 w-5 sm:h-6 sm:w-6 text-secondary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm sm:text-base">Explore Map</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      View global pollution zones
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
            <Link to="/predictions" className="sm:col-span-2 lg:col-span-1">
              <Card className="glass-card hover-lift cursor-pointer group">
                <CardContent className="flex items-center gap-3 sm:gap-4 p-4 sm:p-6">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 transition-colors flex-shrink-0">
                    <Zap className="h-5 w-5 sm:h-6 sm:w-6 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm sm:text-base">View Predictions</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      LSTM-powered trend analysis
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center py-6 sm:py-8 border-t border-border/50">
          <p className="text-xs sm:text-sm text-muted-foreground">
            Developed as part of Final Year Project at{" "}
            <span className="text-foreground font-medium">HITEC University, Taxila</span>
          </p>
          <p className="text-xs text-muted-foreground mt-2">© 2025 — Touseef Ur Rehman, Qasim Shahzad, Zohaib Ashraf</p>
        </footer>
      </PageTransition>
    </MainLayout>;
}