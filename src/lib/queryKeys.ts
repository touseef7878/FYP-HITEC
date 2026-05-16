/**
 * Centralized React Query key factory.
 * Every page that fetches data uses these keys so invalidation is consistent.
 */
export const queryKeys = {
  // Detection history list
  history: () => ["history"] as const,

  // Analytics / dashboard stats
  analytics: () => ["analytics"] as const,

  // Single detection result
  detection: (id: string | number) => ["detection", String(id)] as const,

  // Heatmap hotspots
  heatmap: (range: string, mode: string) => ["heatmap", range, mode] as const,

  // Reports list
  reports: () => ["reports"] as const,

  // Admin stats
  adminStats: () => ["admin", "stats"] as const,
  adminActivity: () => ["admin", "activity"] as const,
} as const;

/**
 * Invalidate all user-data queries after a new detection completes.
 * Call this from Upload page after a successful detection.
 */
export const ALL_DATA_KEYS = [
  queryKeys.history(),
  queryKeys.analytics(),
  queryKeys.reports(),
  // heatmap has dynamic keys — we use a prefix match below
] as const;
