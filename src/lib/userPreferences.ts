/** UI-level preferences that influence scoring across all rows. */

export interface UserPreferences {
  /** Equity as fraction of purchase price (0..1). Flows into the simulation. */
  equityPercent: number;
  /** What the user currently pays in rent (₪/month). Used in scenario C. */
  currentRent: number;
  /**
   * What-if discount applied to the gov-set list price per m² (0..1).
   * Replaces the per-lottery discount parsed from Notes — lets the user
   * stress-test "what if the discount were 15% / 30% / etc." Default 0.25
   * matches the current Mehir Matara regulation across all open lotteries.
   */
  discountOverride: number;
}

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  equityPercent: 0.25,
  currentRent: 6500,
  discountOverride: 0.25,
};
