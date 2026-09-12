import { useState, useMemo } from 'react';
import { ArrowUpRight, ArrowDownRight, Loader2, Calendar } from 'lucide-react';
import type { HistoricalPoint } from '@/features/currency/api/currencyApi';

interface CurrencyChartProps {
  points: HistoricalPoint[];
  base: string;
  quote: string;
  range: string;
  onRangeChange: (range: string) => void;
  loading: boolean;
  currentRate?: number;
}

const RANGES = ['1D', '5D', '1M', '1Y', '5Y', 'MAX'] as const;

export default function CurrencyChart({
  points,
  base,
  quote,
  range,
  onRangeChange,
  loading,
  currentRate,
}: CurrencyChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Statistics calculation
  const stats = useMemo(() => {
    if (!points || points.length === 0) return { min: 0, max: 0, avg: 0, change: 0, isPositive: true };
    const rates = points.map(p => p.rate);
    const min = Math.min(...rates);
    const max = Math.max(...rates);
    const avg = rates.reduce((a, b) => a + b, 0) / rates.length;
    const firstRate = rates[0] || 1;
    const lastRate = currentRate || rates[rates.length - 1] || 1;
    const change = ((lastRate - firstRate) / firstRate) * 100;
    return { min, max, avg, change, isPositive: change >= 0 };
  }, [points, currentRate]);

  // SVG dimensions
  const svgWidth = 640;
  const svgHeight = 220;
  const paddingX = 24;
  const paddingY = 24;

  const chartData = useMemo(() => {
    if (!points || points.length === 0) return { pathD: '', areaD: '', coordinates: [] };

    const rates = points.map(p => p.rate);
    const min = Math.min(...rates);
    const max = Math.max(...rates);
    const rangeVal = max - min || 1;

    const widthSpan = svgWidth - paddingX * 2;
    const heightSpan = svgHeight - paddingY * 2;

    const coordinates = points.map((p, i) => {
      const x = paddingX + (i / Math.max(1, points.length - 1)) * widthSpan;
      const normalizedY = (p.rate - min) / rangeVal;
      const y = svgHeight - paddingY - normalizedY * heightSpan;
      return { x, y, point: p };
    });

    if (coordinates.length === 1) {
      const c = coordinates[0];
      return {
        pathD: `M ${paddingX} ${c.y} L ${svgWidth - paddingX} ${c.y}`,
        areaD: `M ${paddingX} ${c.y} L ${svgWidth - paddingX} ${c.y} L ${svgWidth - paddingX} ${svgHeight} L ${paddingX} ${svgHeight} Z`,
        coordinates,
      };
    }

    // Smooth spline calculation
    let pathD = `M ${coordinates[0].x} ${coordinates[0].y}`;
    for (let i = 0; i < coordinates.length - 1; i++) {
      const p0 = coordinates[i];
      const p1 = coordinates[i + 1];
      const cp1x = p0.x + (p1.x - p0.x) / 2;
      const cp1y = p0.y;
      const cp2x = p0.x + (p1.x - p0.x) / 2;
      const cp2y = p1.y;
      pathD += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p1.x} ${p1.y}`;
    }

    const first = coordinates[0];
    const last = coordinates[coordinates.length - 1];
    const areaD = `${pathD} L ${last.x} ${svgHeight} L ${first.x} ${svgHeight} Z`;

    return { pathD, areaD, coordinates };
  }, [points, svgWidth, svgHeight]);

  const activePoint = hoveredIndex !== null && chartData.coordinates[hoveredIndex]
    ? chartData.coordinates[hoveredIndex]
    : chartData.coordinates[chartData.coordinates.length - 1];

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-white/[0.08] bg-[#14110E] p-4 shadow-xl md:p-5">
      {/* Header + Range Selectors */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold tracking-wider uppercase text-[var(--accent)]">
              Historical dynamics
            </span>
            <span className="text-xs text-white/40">({base} / {quote})</span>
          </div>
          <div className="flex items-baseline gap-3 mt-1">
            <span className="text-2xl font-bold font-mono text-white">
              {activePoint ? activePoint.point.rate.toLocaleString('uz-UZ', { maximumFractionDigits: 4 }) : '—'}
            </span>
            <span className="text-xs text-white/40 font-mono">{quote}</span>
            <span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full ${
              stats.isPositive
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                : 'bg-red-500/15 text-red-400 border border-red-500/20'
            }`}>
              {stats.isPositive ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
              {Math.abs(stats.change).toFixed(2)}%
            </span>
          </div>
          <p className="text-[11px] text-white/35 mt-0.5">
            {activePoint ? activePoint.point.date : 'Sana tanlanmagan'}
          </p>
        </div>

        {/* Range Selector Buttons */}
        <div className="inline-flex bg-white/[0.04] p-1 rounded-xl border border-white/[0.06] self-start sm:self-auto">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => onRangeChange(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                range === r
                  ? 'bg-[var(--accent)] text-white shadow-md'
                  : 'text-white/50 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* SVG Chart Canvas */}
      <div className="relative h-[180px] w-full select-none md:h-[200px]">
        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#14110E]/80 backdrop-blur-sm z-20 rounded-xl">
            <Loader2 className="animate-spin text-[var(--accent)]" size={24} />
            <span className="text-xs text-white/50">Chart is loading...</span>
          </div>
        ) : null}

        {points.length === 0 && !loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white/30 text-xs">
            <Calendar size={28} className="mb-2 opacity-40" />
           No graphical data is available for this period.
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full h-full overflow-visible"
            preserveAspectRatio="none"
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <defs>
              <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#D97757" stopOpacity="0.35" />
                <stop offset="90%" stopColor="#D97757" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#F59E0B" />
                <stop offset="100%" stopColor="#D97757" />
              </linearGradient>
            </defs>

            {/* Horizontal Grid lines */}
            <line x1={paddingX} y1={paddingY} x2={svgWidth - paddingX} y2={paddingY} stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
            <line x1={paddingX} y1={svgHeight / 2} x2={svgWidth - paddingX} y2={svgHeight / 2} stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
            <line x1={paddingX} y1={svgHeight - paddingY} x2={svgWidth - paddingX} y2={svgHeight - paddingY} stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />

            {/* Area Fill */}
            <path d={chartData.areaD} fill="url(#areaGradient)" />

            {/* Main Smooth Line */}
            <path
              d={chartData.pathD}
              fill="none"
              stroke="url(#lineGradient)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Interactive Points & Vertical Crosshair */}
            {activePoint && (
              <g>
                <line
                  x1={activePoint.x}
                  y1={paddingY}
                  x2={activePoint.x}
                  y2={svgHeight - paddingY}
                  stroke="rgba(217,119,87,0.4)"
                  strokeWidth="1.5"
                  strokeDasharray="2 2"
                />
                <circle
                  cx={activePoint.x}
                  cy={activePoint.y}
                  r="5.5"
                  fill="#D97757"
                  stroke="#14110E"
                  strokeWidth="2.5"
                  className="transition-all"
                />
              </g>
            )}

            {/* Invisible Hover Rectangles */}
            {chartData.coordinates.map((c, i) => {
              const colWidth = svgWidth / chartData.coordinates.length;
              return (
                <rect
                  key={i}
                  x={c.x - colWidth / 2}
                  y={0}
                  width={colWidth}
                  height={svgHeight}
                  fill="transparent"
                  className="cursor-crosshair"
                  onMouseEnter={() => setHoveredIndex(i)}
                />
              );
            })}
          </svg>
        )}
      </div>

      {/* Footer Mini Stats */}
      <div className="grid grid-cols-3 gap-2 border-t border-white/[0.06] pt-3 text-center">
        <div className="bg-white/[0.02] p-2.5 rounded-xl border border-white/[0.04]">
          <p className="text-[11px] text-white/40 mb-0.5">Lowest</p>
          <p className="text-xs font-mono font-semibold text-white/90">
            {stats.min.toLocaleString('uz-UZ', { maximumFractionDigits: 4 })}
          </p>
        </div>
        <div className="bg-white/[0.02] p-2.5 rounded-xl border border-white/[0.04]">
          <p className="text-[11px] text-white/40 mb-0.5">Average</p>
          <p className="text-xs font-mono font-semibold text-white/90">
            {stats.avg.toLocaleString('uz-UZ', { maximumFractionDigits: 4 })}
          </p>
        </div>
        <div className="bg-white/[0.02] p-2.5 rounded-xl border border-white/[0.04]">
          <p className="text-[11px] text-white/40 mb-0.5">The highest</p>
          <p className="text-xs font-mono font-semibold text-white/90">
            {stats.max.toLocaleString('uz-UZ', { maximumFractionDigits: 4 })}
          </p>
        </div>
      </div>
    </div>
  );
}
