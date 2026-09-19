import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ArrowUpDown,
  Search,
  Check,
  AlertCircle,
  Clock,
  ChevronDown,
  X,
} from 'lucide-react';
import { currencyApi, type CurrencyList, type ConversionResult, type HistoricalResult } from '@/features/currency/api/currencyApi';
import CurrencyChart from '@/features/currency/components/CurrencyChart';
import { Button } from '@/shared/ui';

export default function CurrencyConverterPage() {
  // State
  const [currencies, setCurrencies] = useState<CurrencyList>({});

  const [fromCurrency, setFromCurrency] = useState('USD');
  const [toCurrency, setToCurrency] = useState('UZS');
  const [amount, setAmount] = useState('1');

  const [conversion, setConversion] = useState<ConversionResult | null>(null);
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Historical chart state
  const [range, setRange] = useState('1M');
  const [historyData, setHistoryData] = useState<HistoricalResult | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Currency Select Modal State
  const [modalType, setModalType] = useState<'from' | 'to' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Fetch currencies list
  useEffect(() => {
    currencyApi
      .getCurrencies()
      .then((data) => setCurrencies(data))
      .catch((err) => console.warn('Failed to load currency list:', err));
  }, []);

  // 2. Perform live conversion
  const doConvert = useCallback(async (val: string, from: string, to: string) => {
    const num = parseFloat(val);
    if (isNaN(num) || num < 0) return;

    setConverting(true);
    setError(null);
    try {
      const res = await currencyApi.convert(num, from, to);
      setConversion(res);
    } catch (err: any) {
      setError(err?.message || 'Kursni hisoblashda xatolik yuz berdi');
    } finally {
      setConverting(false);
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      doConvert(amount, fromCurrency, toCurrency);
    }, 150);
    return () => clearTimeout(timeout);
  }, [amount, fromCurrency, toCurrency, doConvert]);

  // 3. Fetch historical chart data
  const loadHistory = useCallback(async (from: string, to: string, r: string) => {
    setHistoryLoading(true);
    try {
      const data = await currencyApi.getHistorical(from, to, r);
      setHistoryData(data);
    } catch (err) {
      console.warn('Failed to fetch historical chart data:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory(fromCurrency, toCurrency, range);
  }, [fromCurrency, toCurrency, range, loadHistory]);

  const handleSwap = () => {
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
  };

  const filteredCurrencies = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const entries = Object.entries(currencies);
    if (!query) return entries;
    return entries.filter(([code, item]) => {
      return (
        code.toLowerCase().includes(query) ||
        item.name.toLowerCase().includes(query) ||
        item.symbol.toLowerCase().includes(query)
      );
    });
  }, [currencies, searchQuery]);

  const fromMeta = currencies[fromCurrency] || { name: fromCurrency, flag: '🌐', symbol: fromCurrency };
  const toMeta = currencies[toCurrency] || { name: toCurrency, flag: '🌐', symbol: toCurrency };

  const popularPairs = [
    { from: 'USD', to: 'UZS', label: 'USD/UZS' },
    { from: 'EUR', to: 'UZS', label: 'EUR/UZS' },
    { from: 'RUB', to: 'UZS', label: 'RUB/UZS' },
    { from: 'USD', to: 'EUR', label: 'USD/EUR' },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-8" style={{ fontFamily: 'var(--font-sans)', color: 'var(--text-primary)' }}>
      {/* Compact header */}
      <div className="flex items-center justify-between">
        <h1 className="m-0 font-serif text-3xl font-medium tracking-tight text-white md:text-4xl">
          Currency Converter
        </h1>
        <div className="flex gap-1.5">
          {popularPairs.map((p) => {
            const isActive = fromCurrency === p.from && toCurrency === p.to;
            return (
              <button
                key={p.label}
                onClick={() => {
                  setFromCurrency(p.from);
                  setToCurrency(p.to);
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
                  isActive
                    ? 'border-[var(--accent)] bg-[var(--accent-glow)] text-[var(--accent)]'
                    : 'border-white/[0.08] text-white/50 hover:text-white hover:border-white/20'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="px-3.5 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle size={14} className="shrink-0" />
            <span>{error}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => doConvert(amount, fromCurrency, toCurrency)}>
            Try Again
          </Button>
        </div>
      )}

      {/* ── Compact converter card (Google-style stacked rows) ── */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#111109] p-3.5">
        {/* FROM row */}
        <div className="flex items-center gap-3 px-3 py-2.5">
          <input
            type="number"
            min="0"
            step="any"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className="w-full bg-transparent p-0 font-mono text-2xl font-semibold text-white outline-none"
          />
          <button
            type="button"
            onClick={() => setModalType('from')}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.06] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-white/[0.1] transition-colors"
          >
            <span className="text-base">{fromMeta.flag}</span>
            <span>{fromCurrency}</span>
            <ChevronDown size={13} className="text-white/40" />
          </button>
        </div>

        {/* Divider with swap button */}
        <div className="relative flex items-center">
          <div className="h-px flex-1 bg-white/[0.06]" />
          <button
            onClick={handleSwap}
            title="Almashtirish"
            className="mx-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#1a1710] text-white/60 transition-transform hover:rotate-180 hover:text-[var(--accent)] active:scale-90"
          >
            <ArrowUpDown size={14} />
          </button>
          <div className="h-px flex-1 bg-white/[0.06]" />
        </div>

        {/* TO row (result) */}
        <div className="flex items-center gap-3 px-3 py-2.5">
          <div className="w-full truncate font-mono text-2xl font-semibold text-[var(--accent)]">
            {converting ? (
              <span className="text-lg text-white/40 animate-pulse">…</span>
            ) : conversion ? (
              conversion.result.toLocaleString('uz-UZ', { maximumFractionDigits: 4 })
            ) : (
              '0'
            )}
          </div>
          <button
            type="button"
            onClick={() => setModalType('to')}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.06] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-white/[0.1] transition-colors"
          >
            <span className="text-base">{toMeta.flag}</span>
            <span>{toCurrency}</span>
            <ChevronDown size={13} className="text-white/40" />
          </button>
        </div>

        {/* Rate footer */}
        <div className="mt-1 flex flex-wrap items-center gap-2 border-t border-white/[0.06] px-3 pt-2.5 text-[11px] text-white/40">
          <span className="font-mono text-white/60">
            1 {fromCurrency} = {conversion ? conversion.rate.toLocaleString('uz-UZ', { maximumFractionDigits: 4 }) : '—'} {toCurrency}
          </span>
          <span>•</span>
          <span className="inline-flex items-center gap-1">
            <Clock size={11} />
            {conversion?.lastUpdated ? conversion.lastUpdated : 'Rasmiy kurs'}
          </span>
        </div>
      </div>

      {/* ── Historical Chart ── */}
      <CurrencyChart
        points={historyData?.points || []}
        base={fromCurrency}
        quote={toCurrency}
        range={range}
        onRangeChange={setRange}
        loading={historyLoading}
        currentRate={conversion?.rate}
      />

      {/* ── Searchable Currency Selection Modal ── */}
      {modalType !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="w-full max-w-sm rounded-2xl border border-white/[0.12] bg-[#14110E] p-5 shadow-2xl flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
              <h3 className="text-sm font-semibold text-white">
                {modalType === 'from' ? 'Valyutani tanlang' : 'Qabul qiluvchi valyuta'}
              </h3>
              <button
                onClick={() => {
                  setModalType(null);
                  setSearchQuery('');
                }}
                className="w-7 h-7 rounded-full bg-white/[0.05] hover:bg-white/[0.1] flex items-center justify-center text-white/60 transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            <div className="relative my-3">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                autoFocus
                placeholder="Nom, kod yoki belgi bo'yicha qidiring…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-[var(--accent)] transition-colors"
              />
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-white/[0.04] pr-1">
              {filteredCurrencies.length === 0 ? (
                <div className="py-10 text-center text-white/40 text-xs">Topilmadi</div>
              ) : (
                filteredCurrencies.map(([code, item]) => {
                  const isSelected = (modalType === 'from' ? fromCurrency : toCurrency) === code;
                  return (
                    <button
                      key={code}
                      onClick={() => {
                        if (modalType === 'from') setFromCurrency(code);
                        else setToCurrency(code);
                        setModalType(null);
                        setSearchQuery('');
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-colors ${
                        isSelected ? 'bg-[var(--accent-glow)] text-[var(--accent)]' : 'hover:bg-white/[0.03] text-white/80'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-lg shrink-0">{item.flag || '🌐'}</span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-xs text-white">{code}</span>
                            <span className="text-[11px] text-white/40 font-mono">({item.symbol})</span>
                          </div>
                          <p className="text-[11px] text-white/50 truncate">{item.name}</p>
                        </div>
                      </div>
                      {isSelected && <Check size={14} className="text-[var(--accent)] shrink-0 ml-2" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}