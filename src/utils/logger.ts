/**
 * Production-safe logger utility
 * Prevents console pollution in production builds
 */

const isDev = import.meta.env.DEV;
const isTest = import.meta.env.MODE === 'test';

export const logger = {
  log: (...args: any[]) => {
    if (isDev || isTest) {
      console.log(...args);
    }
  },
  
  error: (...args: any[]) => {
    if (isDev || isTest) {
      console.error(...args);
    } else {
      // In production, send to error tracking service
      // Example: Sentry.captureException(args[0]);
    }
  },
  
  warn: (...args: any[]) => {
    if (isDev || isTest) {
      console.warn(...args);
    }
  },
  
  info: (...args: any[]) => {
    if (isDev) {
      console.info(...args);
    }
  },
  
  debug: (...args: any[]) => {
    if (isDev) {
      console.debug(...args);
    }
  },
};

export default logger;
