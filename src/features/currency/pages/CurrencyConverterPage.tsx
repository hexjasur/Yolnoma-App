import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ArrowRightLeft,
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
      .then((data) => {
        setCurrencies(data);
      })
      .catch((err) => {
        console.warn('Failed to load currency list:', err);
      });
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

  // Trigger conversion on amount or currency change
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

  // Swap currencies
  const handleSwap = () => {
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
  };

  // Filter currencies for search modal
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

  // Popular Quick Pairs
  const popularPairs = [
    { from: 'USD', to: 'UZS', label: 'USD / UZS' },
    { from: 'EUR', to: 'UZS', label: 'EUR / UZS' },
    { from: 'RUB', to: 'UZS', label: 'RUB / UZS' },
    { from: 'USD', to: 'EUR', label: 'USD / EUR' },
    { from: 'USD', to: 'TRY', label: 'USD / TRY' },
    { from: 'USD', to: 'JPY', label: 'USD / JPY' },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-10" style={{ fontFamily: 'var(--font-sans)', color: 'var(--text-primary)' }}>
      {/* Header */}
      <div>
        <p className="text-[11px] tracking-[0.18em] uppercase text-[var(--accent)] mb-1.5 font-semibold">
          FINANCIAL INSTRUMENTS
        </p>
        <h1 className="m-0 font-serif text-3xl font-medium tracking-tight text-white md:text-4xl">
          Currency Converter
        </h1>
        <p className="mt-1.5 text-sm text-white/40">
          Official international bank rates and real-time exchange rate dynamics
        </p>
      </div>

      {/* Popular Quick Pairs Strip */}
      <div className="flex flex-wrap gap-2">
        <span className="text-xs text-white/35 self-center mr-1">Popular pairs:</span>
        {popularPairs.map((p) => {
          const isActive = fromCurrency === p.from && toCurrency === p.to;
          return (
            <button
              key={p.label}
              onClick={() => {
                setFromCurrency(p.from);
                setToCurrency(p.to);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                isActive
                  ? 'border-[var(--accent)] bg-[var(--accent-glow)] text-[var(--accent)] shadow-sm'
                  : 'border-white/[0.08] bg-[#111109] text-white/60 hover:text-white hover:border-white/20'
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Error banner */}
      {error && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <AlertCircle size={17} className="shrink-0" />
            <span>{error}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => doConvert(amount, fromCurrency, toCurrency)}>
            Retry
          </Button>
        </div>
      )}

      {/* ── Main Google-style Converter Card ── */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111109] p-4 shadow-2xl sm:p-5 md:p-6">
        {/* Glow ambient effect */}
        <div
          className="pointer-events-none absolute -top-20 -right-20 w-64 h-64 rounded-full opacity-15 blur-3xl"
          style={{ background: 'var(--accent)' }}
        />

        {/* Big Rate Statement */}
        <div className="mb-5 border-b border-white/[0.06] pb-4">
          <p className="mb-1 text-xs font-medium text-white/60">
            {amount || '1'} {fromMeta.name} equal
          </p>
          <div className="flex flex-wrap items-baseline gap-3">
            <h2 className="font-mono text-2xl font-bold tracking-tight text-white md:text-3xl">
              {converting ? (
                <span className="opacity-50 animate-pulse">Calculating…</span>
              ) : conversion ? (
                conversion.result.toLocaleString('uz-UZ', { maximumFractionDigits: 4 })
              ) : (
                '—'
              )}
            </h2>
            <span className="font-serif text-lg text-[var(--accent)] md:text-xl">
              {toMeta.name}
            </span>
          </div>

          {/* Reference Rate Badge & Date */}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-white/40">
            <span className="inline-flex items-center gap-1.5 font-mono text-white/70">
              1 {fromCurrency} = {conversion ? conversion.rate.toLocaleString('uz-UZ', { maximumFractionDigits: 4 }) : '—'} {toCurrency}
            </span>
            <span>•</span>
            <span className="inline-flex items-center gap-1">
              <Clock size={12} />
              {conversion?.lastUpdated
                ? `Refresh: ${conversion.lastUpdated}`
                : 'Official Reference Course'}
            </span>
          </div>
        </div>

        {/* Input Controls Form */}
        <div className="grid grid-cols-1 items-center gap-2.5 md:grid-cols-[minmax(0,1fr),auto,minmax(0,1fr)]">
          {/* FROM Input Box */}
          <div className="rounded-xl border border-white/[0.09] bg-white/[0.02] p-3 transition-all focus-within:border-[var(--accent)]">
            <span className="text-[11px] font-semibold text-white/40 uppercase tracking-wider block mb-1">
              Miqdor ({fromCurrency})
            </span>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="0"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="1.00"
                className="w-full bg-transparent p-0 font-mono text-xl font-bold text-white outline-none focus:ring-0"
              />
              <button
                type="button"
                onClick={() => setModalType('from')}
                className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.06] px-2.5 py-1.5 text-xs font-semibold text-white transition-all hover:bg-white/[0.1]"
              >
                <span className="text-base">{fromMeta.flag}</span>
                <span>{fromCurrency}</span>
                <ChevronDown size={14} className="text-white/40" />
              </button>
            </div>
            <p className="mt-1 truncate text-[11px] text-white/40">{fromMeta.name}</p>
          </div>

          {/* SWAP Button */}
          <div className="flex justify-center my-1 md:my-0">
            <button
              onClick={handleSwap}
              title="Valyutalarni almashtirish"
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-white/70 shadow-lg transition-all duration-300 hover:rotate-180 hover:bg-[var(--accent)] hover:text-white active:scale-95"
            >
              <ArrowRightLeft size={18} />
            </button>
          </div>

          {/* TO Result Box */}
          <div className="rounded-xl border border-white/[0.09] bg-white/[0.02] p-3 transition-all">
            <span className="text-[11px] font-semibold text-white/40 uppercase tracking-wider block mb-1">
              Conversion result ({toCurrency})
            </span>
            <div className="flex items-center gap-3">
              <div className="w-full truncate font-mono text-xl font-bold text-[var(--accent)]">
                {converting ? (
                  <span className="opacity-40 animate-pulse text-lg">…</span>
                ) : conversion ? (
                  conversion.result.toLocaleString('uz-UZ', { maximumFractionDigits: 4 })
                ) : (
                  '0.00'
                )}
              </div>
              <button
                type="button"
                onClick={() => setModalType('to')}
                className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.06] px-2.5 py-1.5 text-xs font-semibold text-white transition-all hover:bg-white/[0.1]"
              >
                <span className="text-base">{toMeta.flag}</span>
                <span>{toCurrency}</span>
                <ChevronDown size={14} className="text-white/40" />
              </button>
            </div>
            <p className="mt-1 truncate text-[11px] text-white/40">{toMeta.name}</p>
          </div>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl border border-white/[0.12] bg-[#14110E] p-6 shadow-2xl flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/[0.06]">
              <div>
                <h3 className="text-base font-semibold text-white">
                  {modalType === 'from' ? 'Exit valyutasini tanlang' : 'Select the receiving currency'}
                </h3>
                <p className="text-xs text-white/40">Over 160+ global currencies</p>
              </div>
              <button
                onClick={() => {
                  setModalType(null);
                  setSearchQuery('');
                }}
                className="w-8 h-8 rounded-full bg-white/[0.05] hover:bg-white/[0.1] flex items-center justify-center text-white/60 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Search Input */}
            <div className="relative my-4">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                autoFocus
                placeholder="Search by currency name, code, or symbol…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-[var(--accent)] transition-colors"
              />
            </div>

            {/* Currency List */}
            <div className="flex-1 overflow-y-auto divide-y divide-white/[0.04] pr-1 space-y-0.5">
              {filteredCurrencies.length === 0 ? (
                <div className="py-12 text-center text-white/40 text-xs">
                  Currency not found
                </div>
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
                      className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-left transition-colors ${
                        isSelected
                          ? 'bg-[var(--accent-glow)] text-[var(--accent)]'
                          : 'hover:bg-white/[0.03] text-white/80'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xl shrink-0">{item.flag || '🌐'}</span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-sm text-white">{code}</span>
                            <span className="text-xs text-white/40 font-mono">({item.symbol})</span>
                          </div>
                          <p className="text-xs text-white/50 truncate">{item.name}</p>
                        </div>
                      </div>

                      {isSelected && (
                        <Check size={16} className="text-[var(--accent)] shrink-0 ml-2" />
                      )}
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
