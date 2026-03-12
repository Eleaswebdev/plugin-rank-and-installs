/**
 * Parses a string like "100,000+" or "1M+" into a number like 100000 or 1000000.
 * Improved to avoid picking up dates or other numbers.
 */
export function parseInstalls(value: string): number {
  if (!value) return 0;
  
  const lower = value.toLowerCase();
  
  // Guard against dates, ratings, and other non-install numbers
  if (lower.includes('ago') || lower.includes('updated') || lower.includes('version') || 
      lower.includes('rating') || lower.includes('review') || lower.includes('star') ||
      lower.includes('average') || lower.includes('score')) {
    return 0;
  }
  
  // Install counts in WP.org labels are almost never decimals (e.g., "4.5+")
  // Ratings often are.
  if (value.includes('.') && !lower.includes('m') && !lower.includes('k')) {
    return 0;
  }
  
  // If it's a very small number without a '+' or 'k'/'m', it's likely not an install count
  // unless the string explicitly mentions "installs"
  const hasPlus = value.includes('+');
  const mentionsInstalls = lower.includes('install');
  
  // Remove commas, plus signs, and whitespace
  const cleanValue = lower.replace(/[,+\s]/g, '');
  
  // Handle millions (e.g., "5M+", "1.2m")
  if (cleanValue.includes('m')) {
    const match = cleanValue.match(/(\d+\.?\d*)m/);
    if (match) return Math.floor(parseFloat(match[1]) * 1000000);
  }
  
  // Handle thousands (e.g., "100k+", "50.5K")
  if (cleanValue.includes('k')) {
    const match = cleanValue.match(/(\d+\.?\d*)k/);
    if (match) return Math.floor(parseFloat(match[1]) * 1000);
  }
  
  // Just numbers (e.g., "500+", "1,000")
  const numMatch = cleanValue.match(/\d+/);
  if (numMatch) {
    const parsed = parseInt(numMatch[0], 10);
    
    // Sanity check for small numbers
    // Official buckets are 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 200...
    // Anything less than 10 is almost certainly not an active install bucket
    if (parsed < 10 && !mentionsInstalls) {
      return 0;
    }
    
    return isNaN(parsed) ? 0 : parsed;
  }
  
  return 0;
}
