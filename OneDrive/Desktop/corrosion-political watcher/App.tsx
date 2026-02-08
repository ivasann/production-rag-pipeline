
import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { geminiService } from './services/geminiService';
import { SearchResult, HistoryEntry } from './types';
import HistoryItem from './components/HistoryItem';
import { Clock, Trash2, ChevronLeft, Shield, History, ExternalLink, Zap, Target, Sun, Moon, AlertTriangle, X, Search } from 'lucide-react';

const LiveForecast = lazy(() => import('./components/LiveForecast'));

const TRENDING = [
  { name: 'Narendra Modi', party: 'BJP', role: 'Prime Minister' },
  { name: 'Rahul Gandhi', party: 'INC', role: 'MP' },
  { name: 'Amit Shah', party: 'BJP', role: 'Home Minister' },
  { name: 'Nirmala Sitharaman', party: 'BJP', role: 'Finance Minister' }
];

const App: React.FC = () => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("Initializing...");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [view, setView] = useState<'home' | 'profile' | 'history' | 'forecast'>('home');
  const [isDark, setIsDark] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const toggleTheme = useCallback(() => {
    setIsDark(prev => {
      const next = !prev;
      if (next) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('pfd_theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('pfd_theme', 'light');
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA';
      if (e.key.toLowerCase() === 't' && !isInput) {
        toggleTheme();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleTheme]);

  useEffect(() => {
    const savedHistory = localStorage.getItem('pfd_history');
    if (savedHistory) {
      try { setHistory(JSON.parse(savedHistory)); } catch (e) { console.error("History parse error"); }
    }
    const savedRecent = localStorage.getItem('pfd_recent');
    if (savedRecent) {
      try { setRecentSearches(JSON.parse(savedRecent)); } catch (e) { console.error("Recent parse error"); }
    }
    const savedTheme = localStorage.getItem('pfd_theme');
    if (savedTheme === 'light') {
      setIsDark(false);
      document.documentElement.classList.remove('dark');
    } else {
      setIsDark(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('pfd_history', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem('pfd_recent', JSON.stringify(recentSearches));
  }, [recentSearches]);

  const handleSearch = async (e: React.FormEvent | string) => {
    if (typeof e !== 'string') e.preventDefault();
    const activeQuery = typeof e === 'string' ? e : query;
    if (!activeQuery.trim()) return;

    setLoading(true);
    setResult(null); 
    setError(null);
    setStatus("Accessing Archive...");
    setView('profile'); 

    try {
      const stream = geminiService.searchDisclosureStream(activeQuery);
      for await (const update of stream) {
        if (update.result) {
          setResult(update.result);
          const newEntry: HistoryEntry = {
            id: Math.random().toString(36).substr(2, 9),
            query: activeQuery,
            result: update.result,
            timestamp: Date.now()
          };
          setHistory(prev => [newEntry, ...prev.filter(h => h.query !== activeQuery)].slice(0, 15));
          setRecentSearches(prev => [activeQuery, ...prev.filter(q => q !== activeQuery)].slice(0, 8));
        } else {
          setResult({ text: update.text, sources: [] });
          setStatus("Streaming analysis...");
        }
      }
    } catch (err: any) {
      if (err.message === "QUOTA_EXCEEDED") {
        setError("Archive Access Denied: API Quota Exceeded. Please try again later.");
      } else {
        setError("Archive connection failed. Check network stability.");
      }
      setView('home');
    } finally {
      setLoading(false);
    }
  };

  const clearHistory = () => {
    if (confirm("Clear all recorded archives?")) {
      setHistory([]);
      localStorage.removeItem('pfd_history');
      if (view === 'history') setView('home');
    }
  };

  const renderHome = () => (
    <div className="flex flex-col items-center justify-center min-h-[70vh] animate-in fade-in duration-1000">
      {error && (
        <div className="w-full max-w-xl mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-between animate-in slide-in-from-top-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="text-red-500" size={16} />
            <span className="text-[11px] font-bold uppercase tracking-widest text-red-600 dark:text-red-400">{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 transition-colors">
            <X size={14} />
          </button>
        </div>
      )}

      <div className="w-full max-w-5xl px-4">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between p-3 rounded-2xl border border-zinc-200 dark:border-zinc-900 bg-white/70 dark:bg-zinc-950/50 shadow-sm backdrop-blur mb-6">
          <div className="flex items-center gap-3 text-xs font-medium text-zinc-600 dark:text-zinc-400">
            <span className="px-2 py-1 rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-500/30">Live</span>
            <span>Integrity Pipeline Stable · 11 data feeds synced</span>
          </div>
          <div className="flex items-center gap-4 text-[10px] uppercase tracking-[0.35em] text-zinc-400 dark:text-zinc-600">
            <span className="flex items-center gap-2"><Shield size={12} /> Zero trust</span>
            <span className="flex items-center gap-2"><Clock size={12} /> <span className="mono">~480ms</span></span>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 items-center mb-12">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-zinc-200/50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800">
              <Shield size={12} className="text-zinc-500" />
              <span className="kicker text-zinc-500">Public Accountability Ledger</span>
            </div>
            <h1 className="hero-title font-semibold text-zinc-900 dark:text-white leading-tight">Audit Indian political finance, instantly.</h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-500 leading-relaxed max-w-xl">
              Search across affidavits, disclosures, market chatter and filings. Corrosion scores every candidate with explainable signals.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-2xl border border-zinc-200 dark:border-zinc-900 bg-white/70 dark:bg-zinc-950/60">
                <div className="text-[10px] uppercase tracking-widest text-zinc-500">Coverage</div>
                <div className="text-sm font-bold text-zinc-900 dark:text-white">Lok Sabha + States</div>
              </div>
              <div className="p-3 rounded-2xl border border-zinc-200 dark:border-zinc-900 bg-white/70 dark:bg-zinc-950/60">
                <div className="text-[10px] uppercase tracking-widest text-zinc-500">Refresh</div>
                <div className="text-sm font-bold text-zinc-900 dark:text-white">Daily + Alerts</div>
              </div>
              <div className="p-3 rounded-2xl border border-zinc-200 dark:border-zinc-900 bg-white/70 dark:bg-zinc-950/60">
                <div className="text-[10px] uppercase tracking-widest text-zinc-500">Sources</div>
                <div className="text-sm font-bold text-zinc-900 dark:text-white">Filings · Media · OSINT</div>
              </div>
            </div>
          </div>

          <div className="bg-white/80 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-900 rounded-3xl shadow-lg backdrop-blur p-6 lg:p-7">
            <form onSubmit={handleSearch} className="relative group mb-6">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Search candidate name or constituency..."
                aria-label="Search candidate"
                className="w-full bg-transparent py-5 pl-12 pr-36 text-lg md:text-xl font-light focus:border-yellow-500 focus:outline-none text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-700 rounded-2xl border border-zinc-200 dark:border-zinc-800"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={loading}
              />
              <button type="submit" className="absolute right-3 top-2.5 px-5 py-2 rounded-xl bg-black text-white dark:bg-white dark:text-black text-[10px] font-bold uppercase tracking-widest hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-40" disabled={loading || !query.trim()}>
                {loading ? 'Consulting...' : 'Run Audit'}
              </button>
            </form>

            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
              <div className="text-[10px] uppercase tracking-[0.35em] text-zinc-400 dark:text-zinc-600">
                Tip: Pair candidate + state for tighter signals
              </div>
              {recentSearches.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  {recentSearches.slice(0, 5).map((item) => (
                    <button
                      key={item}
                      onClick={() => { setQuery(item); handleSearch(item); }}
                      className="px-3 py-1.5 rounded-full text-[10px] uppercase tracking-widest border border-zinc-300 dark:border-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-900 bg-zinc-100/60 dark:bg-zinc-900/50">
                <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2 flex items-center gap-2"><Zap size={12} className="text-yellow-500" /> Live Signal Density</div>
                <div className="text-2xl font-semibold text-zinc-900 dark:text-white">High</div>
                <div className="text-[11px] text-zinc-500">Press, social, filings aligned</div>
              </div>
              <div className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-900 bg-zinc-100/60 dark:bg-zinc-900/50">
                <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2 flex items-center gap-2"><Target size={12} className="text-yellow-500" /> Forecast Readiness</div>
                <div className="text-2xl font-semibold text-zinc-900 dark:text-white">Instant</div>
                <div className="text-[11px] text-zinc-500">War Room spins up on demand</div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-center gap-4 mb-10">
          <button onClick={() => { setError(null); setView('forecast'); }} className="group flex items-center gap-3 px-8 py-3 rounded-full bg-yellow-500 text-black text-[11px] font-bold uppercase tracking-widest hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all">
            <Target size={14} className="group-hover:animate-spin" /> Enter Live War Room
          </button>
          <button onClick={() => { setError(null); setView('history'); }} className="group flex items-center gap-3 px-8 py-3 rounded-full border border-zinc-300 dark:border-zinc-800 text-[11px] font-bold uppercase tracking-widest text-zinc-700 dark:text-zinc-300 hover:border-yellow-400 dark:hover:border-yellow-500">
            <History size={14} /> View Ledger
          </button>
        </div>

        <div>
          <div className="flex items-center gap-4 mb-6">
            <Zap size={10} className="text-yellow-600 dark:text-yellow-500" />
            <h3 className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-700">Verified Trending Audits</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {TRENDING.map(t => (
              <button 
                key={t.name}
                onClick={() => { setQuery(t.name); handleSearch(t.name); }}
                className="flex flex-col items-start p-4 rounded-2xl border border-zinc-300 dark:border-zinc-900 bg-zinc-100/30 dark:bg-zinc-950/50 hover:border-zinc-400 dark:hover:border-zinc-700 transition-all text-left shadow-sm"
              >
                <span className="text-xs font-semibold text-zinc-900 dark:text-white mb-1">{t.name}</span>
                <span className="text-[9px] text-zinc-500 dark:text-zinc-600 uppercase tracking-widest mb-2">{t.party} · {t.role}</span>
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400">Tap to pull latest dossier</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-zinc-900 dark:text-white flex flex-col relative">
      <div className="app-bg" />
      <div className="app-grid" />
      <div className="relative z-10 flex flex-col min-h-screen">
      <header className="py-5 md:py-6 px-6 md:px-12 border-b border-zinc-200 dark:border-zinc-900/50 sticky top-0 bg-background/80 backdrop-blur-xl z-50">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4 cursor-pointer" onClick={() => { setError(null); setView('home'); }}>
            <span className="text-xs font-bold tracking-[0.6em] text-zinc-900 dark:text-white">CORROSION</span>
          </div>
          <div className="flex items-center gap-6 md:gap-12 text-[9px] mono text-zinc-500 dark:text-zinc-700 uppercase tracking-widest">
            <button onClick={() => { setError(null); setView('forecast'); }} className={`hover:text-black dark:hover:text-white transition-colors ${view === 'forecast' ? 'text-yellow-600 dark:text-yellow-500 font-bold' : ''}`}>Live Forecast</button>
            <button onClick={() => { setError(null); setView('history'); }} className={`hover:text-black dark:hover:text-white transition-colors ${view === 'history' ? 'text-zinc-900 dark:text-white underline underline-offset-8' : ''}`}>History Ledger</button>
            <button 
              onClick={toggleTheme} 
              className="p-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-900 transition-all text-zinc-900 dark:text-white flex items-center gap-2 group"
              title="Toggle Theme (Shortcut: T)"
            >
              {isDark ? <Sun size={14} /> : <Moon size={14} />}
              <span className="text-[8px] opacity-0 group-hover:opacity-40 transition-opacity">[T]</span>
            </button>
            <span className="hidden lg:inline">Archive System V1.2</span>
          </div>
        </div>
        <div className="mt-3 hidden lg:flex items-center gap-6 text-[9px] uppercase tracking-[0.35em] text-zinc-400 dark:text-zinc-600">
          <span className="flex items-center gap-2"><span className="h-[6px] w-[6px] rounded-full bg-yellow-400/80" />Audit</span>
          <span className="flex items-center gap-2"><span className="h-[6px] w-[6px] rounded-full bg-blue-400/80" />Signal</span>
          <span className="flex items-center gap-2"><span className="h-[6px] w-[6px] rounded-full bg-emerald-400/80" />Coverage</span>
        </div>
      </header>

      <main className="px-6 md:px-12 flex-grow">
        {view === 'home' && renderHome()}
        {view === 'forecast' && (
          <Suspense fallback={
            <div className="max-w-4xl mx-auto py-20 text-center animate-in fade-in">
              <div className="inline-flex items-center gap-3 px-4 py-2 bg-zinc-200/50 dark:bg-zinc-900 rounded-full border border-zinc-300 dark:border-zinc-800">
                <Clock size={14} className="text-yellow-500 animate-spin" />
                <span className="text-[10px] mono text-zinc-600 dark:text-zinc-400 uppercase tracking-[0.5em]">Loading forecast module…</span>
              </div>
            </div>
          }>
            <LiveForecast />
          </Suspense>
        )}
        {view === 'history' && (
          <div className="max-w-4xl mx-auto py-24 animate-in fade-in duration-700">
            <div className="flex justify-between items-end mb-12">
              <div><h2 className="text-4xl font-light text-zinc-900 dark:text-white mb-2">Audit History Ledger</h2><p className="text-xs text-zinc-500 uppercase mono">Local Records Only</p></div>
              <button onClick={clearHistory} className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 dark:text-zinc-700 hover:text-red-500 uppercase"><Trash2 size={12} /> Wipe</button>
            </div>
            {history.length === 0 ? (
              <div className="border border-dashed border-zinc-300 dark:border-zinc-800 rounded-3xl p-12 text-center bg-white/60 dark:bg-zinc-950/40 backdrop-blur">
                <div className="text-[10px] uppercase tracking-[0.35em] text-zinc-500 mb-3">Empty Ledger</div>
                <h3 className="text-2xl font-light text-zinc-900 dark:text-white mb-3">No audits captured yet</h3>
                <p className="text-xs text-zinc-500 max-w-md mx-auto mb-6">Run a search to create your first record. Results are stored locally in this browser only.</p>
                <button onClick={() => { setView('home'); }} className="action-btn">Start an Audit</button>
              </div>
            ) : (
              <div className="prose prose-zinc dark:prose-invert max-w-none">
                <table className="w-full">
                  <thead><tr><th className="text-left py-4 uppercase text-[9px] tracking-widest text-zinc-500">Candidate</th><th className="text-left py-4 uppercase text-[9px] tracking-widest text-zinc-500">Audit Time</th><th className="text-right py-4 uppercase text-[9px] tracking-widest text-zinc-500">Action</th></tr></thead>
                  <tbody>
                    {history.map(entry => (
                      <tr key={entry.id} className="cursor-pointer group border-b border-zinc-200 dark:border-zinc-900/50 hover:bg-zinc-200/50 dark:hover:bg-zinc-900/10" onClick={() => { setResult(entry.result); setQuery(entry.query); setView('profile'); }}>
                        <td className="py-6 text-zinc-900 dark:text-white font-medium">{entry.query}</td>
                        <td className="py-6 mono text-zinc-500 dark:text-zinc-600 text-[10px]">{new Date(entry.timestamp).toLocaleString()}</td>
                        <td className="py-6 text-right"><ExternalLink size={12} className="text-zinc-400 dark:text-zinc-500 opacity-0 group-hover:opacity-100 inline" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
        {view === 'profile' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
            <div className="flex justify-between items-center mt-12 mb-8">
              <button onClick={() => setView('home')} className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-600 hover:text-zinc-900 dark:hover:text-white transition-colors"><ChevronLeft size={14} /> Directory</button>
              {loading && <div className="flex items-center gap-3"><span className="text-[10px] mono text-zinc-500 dark:text-zinc-500 uppercase">{status}</span></div>}
            </div>
            {loading && !result && (
              <div className="max-w-3xl mx-auto">
                <div className="border border-zinc-200 dark:border-zinc-900 rounded-3xl p-8 bg-white/70 dark:bg-zinc-950/50 backdrop-blur">
                  <div className="animate-pulse space-y-4">
                    <div className="h-4 w-1/3 bg-zinc-200 dark:bg-zinc-800 rounded" />
                    <div className="h-6 w-2/3 bg-zinc-200 dark:bg-zinc-800 rounded" />
                    <div className="h-3 w-full bg-zinc-200 dark:bg-zinc-800 rounded" />
                    <div className="h-3 w-11/12 bg-zinc-200 dark:bg-zinc-800 rounded" />
                    <div className="h-3 w-5/6 bg-zinc-200 dark:bg-zinc-800 rounded" />
                  </div>
                </div>
              </div>
            )}
            {result && <HistoryItem query={query} result={result} />}
          </div>
        )}
      </main>

      <footer className="py-12 border-t border-zinc-200 dark:border-zinc-950 px-6 md:px-12 mt-auto">
        <div className="flex flex-col md:flex-row justify-between gap-12 text-[10px] mono uppercase text-zinc-500 dark:text-zinc-700">
          <div>(c) {new Date().getFullYear()} Corrosion Integrity Archive</div>
          <div className="flex gap-12"><span>Predictive War Room</span><span>Security Protocol</span></div>
        </div>
      </footer>
      </div>
    </div>
  );
};
export default App;

