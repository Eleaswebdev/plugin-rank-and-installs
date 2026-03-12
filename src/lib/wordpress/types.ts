export type RankedPlugin = {
  slug: string;
  name: string;
  rank: number;
  activeInstalls: number;
  activeInstallsLabel: string;
  url: string;
  ptEstimate?: number | null;
  trend?: string | null;
};

export type InstallEstimateMeta = {
  rank: number;
  nextBracketRank: number;
  previousBracketRank: number;
  bracketLowerBound: number;
  bracketUpperBound: number;
  bracketSize: number;
  pluginsInBracket: number;
  installsPerRank: number;
  distanceFromUpper: number;
  confidence: "estimated" | "fallback";
  reason?: string;
};

export type PluginEstimateResponse = {
  slug: string;
  name: string;
  active_installs: string;
  activeInstallsParsed: number;
  estimatedInstalls: number | null;
  trend?: string | null;
  installEstimateMeta: InstallEstimateMeta | null;
};
