import { Link, Navigate } from "react-router-dom";
import { Upload, BarChart3, Map, TrendingUp, ArrowRight, Sparkles, Shield, Zap, Users, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MainLayout } from "@/components/layout/MainLayout";
import { useAuth } from "@/contexts/AuthContext";
import logoImg from "@/assets/images/marine-logo.png";

const features = [
  { icon: Sparkles, title: "Object Detection",    description: "YOLOv11s model trained on 17,429 marine debris images across 8 debris categories" },
  { icon: TrendingUp, title: "Trend Forecasting", description: "Predict pollution trends and identify accumulation zones" },
  { icon: Map,        title: "Interactive Maps",  description: "Visualize pollution density across marine regions" },
  { icon: Shield,     title: "Real-time Processing", description: "Process images and videos with live progress tracking" },
];

const stats = [
  { value: "70.3%", label: "mAP50 Accuracy" },
  { value: "8",     label: "Debris Classes" },
  { value: "17K+",  label: "Training Images" },
  { value: "~25ms", label: "Inference Time" },
];

const teamMembers = [
  { name: "Touseef Ur Rehman", role: "ML Engineer" },
  { name: "Qasim Shahzad",     role: "Backend Engineer" },
  { name: "Zohaib Ashraf",     role: "Frontend Engineer" },
];

export default function HomePage() {
  const { isAuthenticated, isAdmin } = useAuth();
  if (isAuthenticated && isAdmin) return <Navigate to="/admin" replace />;

  return (
    <MainLayout>
      {/* ── Hero — flush to top, no outer padding ─────────────────────── */}
      <section className="relative overflow-hidden hero-section">

        {/* Local video */}
        <video
          className="hero-video"
          autoPlay loop muted playsInline preload="auto"
          disablePictureInPicture
        >
          <source src="/hero-ocean.mp4" type="video/mp4" />
        </video>

        {/* Overlays */}
        <div className="hero-overlay-lr" />
        <div className="hero-overlay-tb" />

        {/* Content — top padding accounts for mobile hamburger */}
        <div className="relative z-10 px-4 pt-16 pb-10 sm:px-8 sm:pt-12 sm:pb-14 lg:pt-16 lg:pb-20 xl:pb-28 lg:px-14 xl:px-20">
          <div className="max-w-3xl xl:max-w-4xl">

            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 mb-4">
              <GraduationCap className="h-3.5 w-3.5 text-cyan-300 flex-shrink-0" />
              <span className="text-white/90 text-xs sm:text-sm font-medium">HITEC University Taxila — FYP 2026</span>
            </div>

            {/* Logo + label */}
            <div className="flex items-center gap-2 sm:gap-3 mb-3">
              <img src={logoImg} alt="OceanGuard AI" className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl flex-shrink-0" />
              <span className="text-cyan-300 text-xs sm:text-sm font-semibold uppercase tracking-widest">
                AI Research Platform
              </span>
            </div>

            {/* Headline */}
            <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-3 sm:mb-5 leading-tight">
              Marine Plastic Pollution
              <br />
              <span className="bg-gradient-to-r from-cyan-300 via-teal-300 to-emerald-300 bg-clip-text text-transparent">
                Detection & Analysis
              </span>
            </h1>

            {/* Sub */}
            <p className="text-sm sm:text-base lg:text-lg text-white/70 mb-5 sm:mb-7 max-w-xl lg:max-w-2xl leading-relaxed">
              Computer vision and deep learning for real-time identification and tracking of marine debris.
              Combines YOLOv11s detection with LSTM forecasting for pollution analysis.
            </p>

            {/* CTA buttons — stack on mobile, row on sm+ */}
            <div className="flex flex-col sm:flex-row gap-3 mb-7 sm:mb-10">
              <Button
                size="lg"
                className="group bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-white border-0 shadow-lg shadow-cyan-500/25 w-full sm:w-auto justify-center"
                asChild
              >
                <Link to="/upload">
                  <Upload className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                  Start Detection
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              {/* Analytics button — solid teal outline so it's always visible */}
              <Button
                size="lg"
                className="w-full sm:w-auto justify-center bg-transparent border-2 border-white/40 text-white hover:bg-white/10 hover:border-white/60 transition-colors"
                asChild
              >
                <Link to="/dashboard">
                  <BarChart3 className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                  View Analytics
                </Link>
              </Button>
            </div>

            {/* Team */}
            <div className="pt-4 sm:pt-5 border-t border-white/10">
              <div className="flex items-center gap-2 mb-3">
                <Users className="h-3.5 w-3.5 text-cyan-300" />
                <span className="text-white/60 text-xs uppercase tracking-wider">Project Team</span>
              </div>
              <div className="flex flex-wrap gap-3 sm:gap-5">
                {teamMembers.map((member) => (
                  <div key={member.name} className="flex items-center gap-2">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-cyan-400 to-teal-500 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                      {member.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <p className="text-white font-medium text-xs leading-tight">{member.name}</p>
                      <p className="text-white/50 text-xs">{member.role}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom wave — blends into page background */}
        <div className="absolute bottom-0 left-0 right-0 z-10">
          <svg viewBox="0 0 1200 60" className="w-full h-6 sm:h-10 lg:h-14 fill-background" preserveAspectRatio="none">
            <path d="M0,30 C300,60 600,0 900,30 C1200,60 1200,60 1200,60 L0,60 Z" />
          </svg>
        </div>
      </section>

      {/* ── Rest of page — padded ─────────────────────────────────────── */}
      <div className="px-3 sm:px-5 lg:px-7 xl:px-10 pb-6 sm:pb-8">

        {/* Stats */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 mt-5 sm:mt-7 mb-6 sm:mb-8">
          {stats.map((stat) => (
            <Card key={stat.label} className="glass-card text-center py-3 sm:py-5 hover-lift">
              <CardContent className="p-0">
                <p className="text-lg sm:text-2xl lg:text-3xl font-bold gradient-text mb-0.5">{stat.value}</p>
                <p className="text-xs sm:text-sm text-muted-foreground">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        {/* Features */}
        <section className="mb-6 sm:mb-8">
          <div className="text-center mb-4 sm:mb-6">
            <h2 className="text-lg sm:text-xl lg:text-2xl font-bold mb-1">Key Features</h2>
            <p className="text-muted-foreground text-xs sm:text-sm">Tools for marine pollution research and analysis</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
            {features.map((feature) => (
              <Card key={feature.title} className="glass-card hover-lift">
                <CardContent className="p-4 sm:p-5">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl ocean-gradient flex items-center justify-center mb-3">
                    <feature.icon className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                  </div>
                  <h3 className="font-semibold mb-1 text-sm sm:text-base">{feature.title}</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Quick Actions */}
        <section className="mb-6 sm:mb-8">
          <h2 className="text-base sm:text-lg font-semibold mb-3">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4">
            {[
              { to: "/upload",      icon: Upload,    bg: "bg-primary/10 group-hover:bg-primary/20",   ic: "text-primary",   title: "Upload Media",     desc: "Detect plastic in images/videos" },
              { to: "/heatmap",     icon: Map,       bg: "bg-secondary/10 group-hover:bg-secondary/20", ic: "text-secondary", title: "Explore Map",      desc: "View global pollution zones" },
              { to: "/predictions", icon: Zap,       bg: "bg-accent/10 group-hover:bg-accent/20",     ic: "text-accent",    title: "View Predictions", desc: "Trend analysis and forecasting" },
            ].map((item) => (
              <Link key={item.to} to={item.to}>
                <Card className="glass-card hover-lift cursor-pointer group">
                  <CardContent className="flex items-center gap-3 p-3.5 sm:p-5">
                    <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl ${item.bg} flex items-center justify-center transition-colors flex-shrink-0`}>
                      <item.icon className={`h-4 w-4 sm:h-5 sm:w-5 ${item.ic}`} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm sm:text-base">{item.title}</h3>
                      <p className="text-xs sm:text-sm text-muted-foreground">{item.desc}</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center py-4 sm:py-6 border-t border-border/50">
          <p className="text-xs sm:text-sm text-muted-foreground">
            Developed as part of Final Year Project at{" "}
            <span className="text-foreground font-medium">HITEC University, Taxila</span>
          </p>
          <p className="text-xs text-muted-foreground mt-1">© 2025 — Touseef Ur Rehman, Qasim Shahzad, Zohaib Ashraf</p>
        </footer>
      </div>
    </MainLayout>
  );
}
