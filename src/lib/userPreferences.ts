/** UI-level preferences that influence scoring across all rows. */

export interface UserPreferences {
  /** Equity as fraction of purchase price (0..1). Flows into the simulation. */
  equityPercent: number;
  /** What the user currently pays in rent (₪/month). Used in scenario C. */
  currentRent: number;
}

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  equityPercent: 0.25,
  currentRent: 6500,
};
