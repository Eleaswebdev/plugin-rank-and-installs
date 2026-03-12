/**
 * Determines the upper bound of an active install bracket.
 * 
 * Rules based on WordPress.org bucketing:
 * - < 100: 10 increments (10, 20, 30...)
 * - 100 - 1,000: 100 increments (100, 200, 300...)
 * - 1,000 - 10,000: 1,000 increments (1,000, 2,000...)
 * - 10,000 - 100,000: 10,000 increments (10,000, 20,000...)
 * - >= 100,000: 100,000 increments (100,000, 200,000...)
 */
export function getBracketUpperBound(lowerBound: number): number {
  if (lowerBound <= 0) return 10;
  
  // For 5M+, the next official bucket is 10M+
  if (lowerBound >= 5000000 && lowerBound < 10000000) {
    return 10000000;
  }
  
  // For 10M+, we don't have a higher bucket in the current system, 
  // but let's assume 20M+ for interpolation purposes.
  if (lowerBound >= 10000000) {
    return lowerBound * 2;
  }

  const magnitude = Math.pow(10, Math.floor(Math.log10(lowerBound)));
  return lowerBound + magnitude;
}
