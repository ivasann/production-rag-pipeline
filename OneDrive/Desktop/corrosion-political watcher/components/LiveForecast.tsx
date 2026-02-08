
import React, { useState, useEffect } from 'react';
import { geminiService } from '../services/geminiService';
import { BroadForecast, Contender } from '../types';
import { Target, Zap, Activity, Users, MapPin, Loader2, AlertCircle, TrendingUp, TrendingDown, DollarSign, Info, ArrowUpRight, AlertTriangle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const REGION_PRESETS = [
  'India - National',
  'Delhi',
  'Mumbai',
  'Karnataka',
  'Uttar Pradesh',
  'Tamil Nadu'
];

const LiveForecast: React.FC = () => {
  const [region, setRegion] = useState('');
  const [loading, setLoading] = useState(false);
  const [forecast, setForecast] = useState<BroadForecast | null>(null);
  const [narrative, setNarrative] = useState('');
  const [simulatedTrades, setSimulatedTrades] = useState<{ id: number; text: string; type: 'YES' | 'NO'; time: string }[]>([]);
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  useEffect(() => {
    if (forecast && !quotaExceeded) {
      const interval = setInterval(() => {
        const randomContender = forecast.contenders[Math.floor(Math.random() * forecast.contenders.length)];
        const action = Math.random() > 0.5 ? 'YES' : 'NO';
        const newTrade = {
          id: Date.now(),
          text: `${randomContender.party} ${action} @ Rs.0.${randomContender.winProbability}`,
          type: action as 'YES' | 'NO',
          time: 'Just now'
        };
        setSimulatedTrades(prev => [newTrade, ...prev].slice(0, 8));
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [forecast, quotaExceeded]);

  const handlePredict = async (e: React.FormEvent | null, overrideRegion?: string) => {
    if (e) e.preventDefault();
    const activeRegion = (overrideRegion ?? region).trim();
    if (!activeRegion) return;

    setLoading(true);
    setForecast(null);
    setNarrative('');
    setQuotaExceeded(false);

    try {
      const stream = geminiService.getLiveBroadForecast(activeRegion);
      for await (const update of stream) {
        setNarrative(update.text);
        if (update.data) setForecast(update.data);
      }
    } catch (err: any) {
      if (err.message === "QUOTA_EXCEEDED") {
        setQuotaExceeded(true);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto py-8 px-6 animate-in fade-in duration-700">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-8 mb-12 border-b border-zinc-200 dark:border-zinc-900 pb-12">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full shadow-[0_0_10px_rgba(34,197,94,0.5)] ${quotaExceeded ? 'bg-red-500 animate-none' : 'bg-green-500 animate-pulse'}`} />
            <span className={`text-[10px] mono font-bold uppercase tracking-[0.4em] ${quotaExceeded ? 'text-red-500' : 'text-green-600 dark:text-green-500'}`}>
              {quotaExceeded ? 'Prediction Market Suspended' : 'Live Prediction Market Active'}
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-light tracking-tighter text-zinc-900 dark:text-white">War Room: {forecast?.region || 'Global Terminal'}</h1>
          <div className="flex flex-wrap gap-2">
            {REGION_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => { setRegion(preset); if (!loading) handlePredict(null, preset); }}
                className="px-3 py-1.5 rounded-full text-[10px] uppercase tracking-widest border border-zinc-300 dark:border-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors"
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-6 w-full">
          <div className="px-4 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100/60 dark:bg-zinc-900/40 text-[11px] uppercase tracking-widest text-zinc-600 dark:text-zinc-400 font-medium">
            Pick a preset above to open the market feed.
          </div>

          {forecast && (
            <div className="hidden lg:flex items-center gap-8 border-l border-zinc-200 dark:border-zinc-900 pl-8">
              <div className="text-center">
                <div className="text-[9px] uppercase tracking-widest text-zinc-500 mb-1">Vol (24h)</div>
                <div className="text-sm font-bold text-zinc-900 dark:text-white">{forecast.volume}</div>
              </div>
              <div className="text-center">
                <div className="text-[9px] uppercase tracking-widest text-zinc-500 mb-1">Liquidity</div>
                <div className={`text-sm font-bold ${quotaExceeded ? 'text-red-500' : 'text-zinc-900 dark:text-white'}`}>
                  {quotaExceeded ? 'Drained' : forecast.liquidity}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {forecast && !quotaExceeded && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          <div className="p-5 rounded-2xl border border-zinc-200 dark:border-zinc-900 bg-white/70 dark:bg-zinc-950/50 backdrop-blur">
            <div className="text-[9px] uppercase tracking-widest text-zinc-500 mb-2">Win Probability</div>
            <div className="text-2xl font-light text-zinc-900 dark:text-white mono">{forecast.winProbability}%</div>
            <div className="text-[10px] text-zinc-500">Market-weighted</div>
          </div>
          <div className="p-5 rounded-2xl border border-zinc-200 dark:border-zinc-900 bg-white/70 dark:bg-zinc-950/50 backdrop-blur">
            <div className="text-[9px] uppercase tracking-widest text-zinc-500 mb-2">Sentiment</div>
            <div className="text-2xl font-light text-zinc-900 dark:text-white">{forecast.sentiment}</div>
            <div className="text-[10px] text-zinc-500">News + polling</div>
          </div>
          <div className="p-5 rounded-2xl border border-zinc-200 dark:border-zinc-900 bg-white/70 dark:bg-zinc-950/50 backdrop-blur">
            <div className="text-[9px] uppercase tracking-widest text-zinc-500 mb-2">Volume (24h)</div>
            <div className="text-2xl font-light text-zinc-900 dark:text-white mono">{forecast.volume}</div>
            <div className="text-[10px] text-zinc-500">Signals ingested</div>
          </div>
          <div className="p-5 rounded-2xl border border-zinc-200 dark:border-zinc-900 bg-white/70 dark:bg-zinc-950/50 backdrop-blur">
            <div className="text-[9px] uppercase tracking-widest text-zinc-500 mb-2">Liquidity</div>
            <div className="text-2xl font-light text-zinc-900 dark:text-white mono">{forecast.liquidity}</div>
            <div className="text-[10px] text-zinc-500">Confidence index</div>
          </div>
        </div>
      )}

      {quotaExceeded && (
        <div className="py-24 text-center space-y-8 animate-in zoom-in-95 duration-500">
          <div className="inline-flex flex-col items-center gap-6 p-12 bg-red-500/5 dark:bg-red-500/10 border border-red-500/20 rounded-[40px] max-w-2xl mx-auto shadow-2xl">
            <AlertTriangle size={48} className="text-red-500 animate-pulse" />
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-white uppercase tracking-tighter italic">MARKET HALTED</h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed font-mono uppercase tracking-widest">
                API QUOTA EXCEEDED. Prediction engines have been temporarily suspended to prevent data corruption. 
                Liquidity is currently zero. Please try again after the next cycle or refresh your credentials.
              </p>
            </div>
            <button 
              onClick={() => { setQuotaExceeded(false); handlePredict(null, region); }}
              className="mt-4 px-8 py-3 bg-red-600 text-white rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-red-700 transition-all"
            >
              Re-Attempt Connection
            </button>
          </div>
        </div>
      )}

      {!forecast && loading && (
        <div className="py-24 text-center space-y-8">
          <div className="inline-flex items-center gap-3 px-4 py-2 bg-zinc-200/50 dark:bg-zinc-900 rounded-full border border-zinc-300 dark:border-zinc-800">
            <Loader2 className="animate-spin text-yellow-500" size={14} />
            <span className="text-[10px] mono text-zinc-600 dark:text-zinc-400 uppercase tracking-[0.5em]">Syncing Order Books...</span>
          </div>
          <div className="prose dark:prose-invert max-w-2xl mx-auto opacity-50 text-xs italic">
             <ReactMarkdown>{narrative}</ReactMarkdown>
          </div>
        </div>
      )}

      {forecast && !quotaExceeded && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-8">
            <section className="bg-white dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 overflow-hidden relative shadow-sm">
              <div className="flex justify-between items-start mb-8">
                <div className="space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Market Consensus</div>
                  <h2 className="text-2xl font-medium text-zinc-900 dark:text-white leading-tight">
                    {forecast.verdict}
                  </h2>
                </div>
                <div className={`px-4 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-widest ${
                  forecast.sentiment === 'Positive' ? 'bg-green-50 text-green-600 border-green-200 dark:bg-green-500/10 dark:text-green-500 dark:border-green-500/20' : 
                  'bg-red-50 text-red-600 border-red-200 dark:bg-red-500/10 dark:text-red-500 dark:border-red-500/20'
                }`}>
                  {forecast.sentiment} Momentum
                </div>
              </div>
              
              <div className="prose dark:prose-invert max-w-none text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed mb-8">
                <ReactMarkdown>{narrative}</ReactMarkdown>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8 border-t border-zinc-100 dark:border-zinc-900">
                {forecast.keyIssues.map((issue, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-zinc-100/50 dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800">
                    <Info size={14} className="text-zinc-400" />
                    <span className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300">{issue}</span>
                  </div>
                ))}
              </div>
            </section>

            <div className="space-y-4">
              <div className="flex justify-between items-end px-4">
                <h3 className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">Market Contenders</h3>
                <div className="text-[10px] text-zinc-500 mono">Prices in Probability %</div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {forecast.contenders.map((c, i) => (
                  <div key={i} className="bg-white dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 hover:border-zinc-400 dark:hover:border-zinc-600 transition-all group">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex gap-4 items-center">
                        <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center font-bold text-zinc-400 group-hover:bg-yellow-500 group-hover:text-black transition-colors">
                          {c.party[0]}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-zinc-900 dark:text-white">{c.name}</div>
                          <div className="text-[10px] text-zinc-500 uppercase tracking-widest">{c.party}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-light text-zinc-900 dark:text-white mono">{c.winProbability}%</div>
                        <div className={`flex items-center justify-end gap-1 text-[10px] font-bold ${c.change24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {c.change24h >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                          {Math.abs(c.change24h)}% (24h)
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-6">
                      <button className="py-2.5 rounded-xl bg-green-500/10 hover:bg-green-500 text-green-600 hover:text-white text-[11px] font-bold uppercase tracking-widest border border-green-500/20 transition-all flex items-center justify-center gap-2">
                        Buy Yes
                        <ArrowUpRight size={14} />
                      </button>
                      <button className="py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500 text-red-600 hover:text-white text-[11px] font-bold uppercase tracking-widest border border-red-500/20 transition-all flex items-center justify-center gap-2">
                        Buy No
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 space-y-8">
            <div className="bg-zinc-900 dark:bg-zinc-950 border border-zinc-800 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-2xl">
              <div className="p-6 border-b border-zinc-800 bg-zinc-900 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity size={14} className="text-yellow-500" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-100">Live Activity Feed</span>
                </div>
                <div className="text-[8px] mono text-green-500 animate-pulse">STREAMING</div>
              </div>
              <div className="p-4 h-[420px] overflow-y-auto space-y-3 font-mono">
                {simulatedTrades.map(trade => (
                  <div key={trade.id} className="text-[10px] p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50 flex justify-between items-center animate-in slide-in-from-left-2 duration-500">
                    <span className={trade.type === 'YES' ? 'text-green-400' : 'text-red-400'}>{trade.text}</span>
                    <span className="text-zinc-600 text-[8px]">{trade.time}</span>
                  </div>
                ))}
                {simulatedTrades.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-zinc-700 space-y-4">
                    <Loader2 className="animate-spin" size={20} />
                    <span className="text-[10px] uppercase tracking-widest">Awaiting Activity...</span>
                  </div>
                )}
              </div>
            </div>

            <div className="p-8 bg-zinc-200/50 dark:bg-zinc-900/40 border border-zinc-300 dark:border-zinc-800 rounded-3xl space-y-6">
               <div className="flex items-center gap-3">
                <Users size={16} className="text-zinc-500" />
                <h3 className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Verification Pool</h3>
              </div>
              <div className="space-y-3">
                {forecast.pollDataSources.map((source, i) => (
                  <div key={i} className="flex justify-between items-center py-2 border-b border-zinc-300 dark:border-zinc-800 last:border-0">
                    <span className="text-[11px] font-medium text-zinc-800 dark:text-zinc-300">{source}</span>
                    <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
                  </div>
                ))}
              </div>
              <div className="p-4 bg-yellow-500/5 border border-yellow-500/10 rounded-2xl flex gap-4 items-start">
                <AlertCircle size={16} className="text-yellow-600 shrink-0 mt-0.5" />
                <p className="text-[10px] text-zinc-500 leading-relaxed uppercase tracking-tight font-medium">
                  Integrity score: High. Multiple independent polling vectors aligned.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {!forecast && !loading && !quotaExceeded && (
        <div className="py-40 flex flex-col items-center justify-center opacity-20">
          <DollarSign size={80} className="mb-8 text-zinc-400 dark:text-zinc-700" />
          <p className="text-[12px] mono uppercase tracking-[0.8em] text-center max-w-sm leading-loose text-zinc-600 dark:text-zinc-400">
            Input region to open prediction pool. Market volatility indexing initialized.
          </p>
        </div>
      )}
    </div>
  );
};

export default LiveForecast;






