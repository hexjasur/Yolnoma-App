import React from 'react';
import { CrosshairConfig } from '../types';

interface CrosshairSVGProps {
  config: CrosshairConfig;
  size?: number; // Canvas size in px (defaults to 100)
  className?: string;
}

export const CrosshairSVG: React.FC<CrosshairSVGProps> = ({
  config,
  size = 100,
  className = '',
}) => {
  const {
    type,
    size: lineSize,
    thickness,
    gap,
    dot,
    dotSize,
    showRing,
    ringRadius,
    color,
    opacity,
    outline,
    outlineColor = '#000000',
    outlineThickness = 1,
    offsetX = 0,
    offsetY = 0,
  } = config;

  const cx = 50 + offsetX;
  const cy = 50 + offsetY;

  const outlineWidth = thickness + outlineThickness * 2;

  // Helper to render lines with optional outline
  const renderLine = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    keyPrefix: string
  ) => {
    return (
      <React.Fragment key={keyPrefix}>
        {outline && (
          <line
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={outlineColor}
            strokeWidth={outlineWidth}
            strokeLinecap="square"
          />
        )}
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={color}
          strokeWidth={thickness}
          strokeLinecap="square"
        />
      </React.Fragment>
    );
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={`overflow-visible select-none pointer-events-none ${className}`}
      style={{ opacity }}
    >
      {/* ── Outer Ring / Circle ── */}
      {(showRing || type === 'circle-dot') && (
        <>
          {outline && (
            <circle
              cx={cx}
              cy={cy}
              r={ringRadius}
              fill="none"
              stroke={outlineColor}
              strokeWidth={outlineWidth}
            />
          )}
          <circle
            cx={cx}
            cy={cy}
            r={ringRadius}
            fill="none"
            stroke={color}
            strokeWidth={thickness}
          />
        </>
      )}

      {/* ── Classic 4-Way Cross ── */}
      {type === 'classic' && (
        <g>
          {/* Top */}
          {renderLine(cx, cy - gap, cx, cy - gap - lineSize, 'top')}
          {/* Bottom */}
          {renderLine(cx, cy + gap, cx, cy + gap + lineSize, 'bottom')}
          {/* Left */}
          {renderLine(cx - gap, cy, cx - gap - lineSize, cy, 'left')}
          {/* Right */}
          {renderLine(cx + gap, cy, cx + gap + lineSize, cy, 'right')}
        </g>
      )}

      {/* ── Tactical T-Shape (No Top line) ── */}
      {type === 't-shape' && (
        <g>
          {/* Bottom */}
          {renderLine(cx, cy + gap, cx, cy + gap + lineSize, 'bottom')}
          {/* Left */}
          {renderLine(cx - gap, cy, cx - gap - lineSize, cy, 'left')}
          {/* Right */}
          {renderLine(cx + gap, cy, cx + gap + lineSize, cy, 'right')}
        </g>
      )}

      {/* ── Tactical Chevron / Arrow ── */}
      {type === 'chevron' && (
        <g>
          {outline && (
            <path
              d={`M ${cx - lineSize} ${cy + lineSize} L ${cx} ${cy + gap} L ${cx + lineSize} ${cy + lineSize}`}
              fill="none"
              stroke={outlineColor}
              strokeWidth={outlineWidth}
              strokeLinejoin="miter"
              strokeLinecap="square"
            />
          )}
          <path
            d={`M ${cx - lineSize} ${cy + lineSize} L ${cx} ${cy + gap} L ${cx + lineSize} ${cy + lineSize}`}
            fill="none"
            stroke={color}
            strokeWidth={thickness}
            strokeLinejoin="miter"
            strokeLinecap="square"
          />
        </g>
      )}

      {/* ── Center Dot ── */}
      {(dot || type === 'dot') && (
        <>
          {outline && (
            <circle
              cx={cx}
              cy={cy}
              r={dotSize + outlineThickness}
              fill={outlineColor}
            />
          )}
          <circle cx={cx} cy={cy} r={dotSize} fill={color} />
        </>
      )}
    </svg>
  );
};
