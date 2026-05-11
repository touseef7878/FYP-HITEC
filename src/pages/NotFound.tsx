import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import logger from "@/utils/logger";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    logger.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center px-4">
        <p className="font-display text-8xl font-bold gradient-text mb-4 tracking-tight">404</p>
        <h1 className="font-display text-2xl font-bold mb-2 tracking-tight">Page not found</h1>
        <p className="text-muted-foreground mb-6 font-medium">The page you're looking for doesn't exist.</p>
        <a
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity"
        >
          Return to Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;
