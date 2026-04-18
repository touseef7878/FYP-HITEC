import { ReactNode } from "react";
import type { Variants } from "framer-motion";

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

/** Inner page padding wrapper — no animation, just layout */
export function PageTransition({ children, className = "" }: PageTransitionProps) {
  return (
    <div className={`px-3 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-6 lg:py-8 ${className}`}>
      {children}
    </div>
  );
}

// Stagger children — used in lists/grids
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.22 } },
};
