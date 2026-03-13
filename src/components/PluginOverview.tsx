import React, { useState, useEffect } from 'react';
import { Download, TrendingUp, Info, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PluginEstimateResponse } from '../lib/wordpress/types';

interface PluginOverviewProps {
  slug: string;
}

export default function PluginOverview({ slug: initialSlug }: PluginOverviewProps) {
  const [slug, setSlug] = useState(initialSlug);
  const [inputSlug, setInputSlug] = useState(initialSlug);
  const [data, setData] = useState<PluginEstimateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async (targetSlug: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/plugin-estimate/${targetSlug}`);

      const contentType = response.headers.get('content-type') || '';

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Request failed (${response.status}): ${text.slice(0, 200)}`);
      }

      if (!contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(`Expected JSON but got ${contentType || 'unknown type'}: ${text.slice(0, 200)}`);
      }

      const result: PluginEstimateResponse = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(slug);
  }, [slug]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputSlug.trim()) {
      setSlug(inputSlug.trim());
    }
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Search Header */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-black/5">
        <form onSubmit={handleSubmit} className="flex gap-3">
          <input
            type="text"
            value={inputSlug}
            onChange={(e) => setInputSlug(e.target.value)}
            placeholder="Enter plugin slug (e.g., contact-form-7)"
            className="flex-1 px-4 py-2 rounded-xl border border-black/10 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Analyze
          </button>
        </form>
      </div>

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col items-center justify-center py-20 space-y-4"
          >
            <div className="relative">
              <div className="w-16 h-16 border-4 border-emerald-100 rounded-full"></div>
              <div className="w-16 h-16 border-4 border-emerald-600 rounded-full border-t-transparent animate-spin absolute top-0 left-0"></div>
            </div>
            <p className="text-stone-500 font-medium animate-pulse">Scraping WordPress.org rankings...</p>
          </motion.div>
        ) : error ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-red-50 border border-red-100 p-4 rounded-xl flex items-center gap-3 text-red-700"
          >
            <AlertCircle className="w-5 h-5" />
            <p>{error}</p>
          </motion.div>
        ) : data ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Plugin Header */}
            <div className="flex items-end justify-between">
              <div>
                <h1 className="text-3xl font-bold text-stone-900 tracking-tight">{data.name}</h1>
                <p className="text-stone-500 font-mono text-sm uppercase tracking-wider mt-1">{data.slug}</p>
              </div>
              <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full text-sm font-medium">
                <CheckCircle2 className="w-4 h-4" />
                Live Data
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Active Installs Card */}
              <div className="bg-white rounded-2xl p-8 shadow-sm border border-black/5 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <Download className="w-24 h-24" />
                </div>

                <div className="relative space-y-4">
                  <div className="flex items-center gap-2 text-stone-500 text-sm font-medium uppercase tracking-widest">
                    <Download className="w-4 h-4" />
                    Active Installs
                  </div>

                  <div className="space-y-1">
                    <div className="text-5xl font-bold text-stone-900 tracking-tighter flex items-center gap-3">
                      {data.estimatedInstalls ? (
                        <>
                          <span className="text-emerald-600">~</span>
                          {formatNumber(data.estimatedInstalls)}
                          {data.trend && (
                            <span className={`text-xl font-medium flex items-center ${data.trend.includes('↑') ? 'text-emerald-500' : 'text-rose-500'}`}>
                              {data.trend}
                            </span>
                          )}
                        </>
                      ) : (
                        data.active_installs
                      )}
                    </div>
                    {data.estimatedInstalls && (
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase rounded tracking-wider">
                          Estimated
                        </span>
                        <span className="text-stone-400 text-sm italic">
                          Official bucket: {data.active_installs}
                        </span>
                      </div>
                    )}
                  </div>

                  <p className="text-stone-500 text-sm leading-relaxed">
                    Based on popularity ranking within the {data.active_installs} bracket on WordPress.org.
                  </p>
                </div>
              </div>

              {/* Ranking Card */}
              <div className="bg-stone-900 rounded-2xl p-8 shadow-lg text-white relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <TrendingUp className="w-24 h-24" />
                </div>

                <div className="relative space-y-4">
                  <div className="flex items-center gap-2 text-stone-400 text-sm font-medium uppercase tracking-widest">
                    <TrendingUp className="w-4 h-4" />
                    Popularity Rank
                  </div>

                  <div className="space-y-1">
                    <div className="text-5xl font-bold tracking-tighter">
                      #{data.installEstimateMeta?.rank !== -1 ? data.installEstimateMeta?.rank : 'N/A'}
                    </div>
                    <div className="text-stone-400 text-sm">
                      Overall rank in Popular Plugins
                    </div>
                  </div>

                  {data.installEstimateMeta && data.installEstimateMeta.rank !== -1 && (
                    <div className="pt-4 border-t border-white/10 grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-[10px] text-stone-500 uppercase font-bold tracking-wider">Bracket Size</div>
                        <div className="text-sm font-mono">{formatNumber(data.installEstimateMeta.pluginsInBracket)} plugins</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-stone-500 uppercase font-bold tracking-wider">Installs/Rank</div>
                        <div className="text-sm font-mono">{data.installEstimateMeta.installsPerRank.toFixed(1)}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Detailed Meta (Optional/Debug) */}
            {data.installEstimateMeta && (
              <div className="bg-stone-50 rounded-2xl p-6 border border-black/5">
                <div className="flex items-center gap-2 text-stone-400 text-xs font-bold uppercase tracking-widest mb-4">
                  <Info className="w-3 h-3" />
                  Estimation Metadata
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="space-y-1">
                    <p className="text-[10px] text-stone-400 uppercase font-bold">Lower Bound</p>
                    <p className="text-sm font-mono text-stone-600">{formatNumber(data.installEstimateMeta.bracketLowerBound)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-stone-400 uppercase font-bold">Upper Bound</p>
                    <p className="text-sm font-mono text-stone-600">{formatNumber(data.installEstimateMeta.bracketUpperBound)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-stone-400 uppercase font-bold">Next Bracket Rank</p>
                    <p className="text-sm font-mono text-stone-600">{data.installEstimateMeta.nextBracketRank}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-stone-400 uppercase font-bold">Prev Bracket Rank</p>
                    <p className="text-sm font-mono text-stone-600">{data.installEstimateMeta.previousBracketRank}</p>
                  </div>
                </div>
                {data.installEstimateMeta.reason && (
                  <div className="mt-4 pt-4 border-t border-black/5 text-xs text-stone-500 font-medium italic flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                    Source: {data.installEstimateMeta.reason}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        ) : (
          <div className="text-center py-20 text-stone-400">
            Enter a plugin slug to start estimation.
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
