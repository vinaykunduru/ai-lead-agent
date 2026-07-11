"use client";

import { useState } from "react";

export type BarChartDatum = { label: string; value: number };

/**
 * A single-series bar chart — every analytics report in this module
 * produces either a time series or a category breakdown, never more than
 * one series at once, so this stays a single reusable primitive with no
 * legend (dataviz skill: "none for one series"). Thin bars, rounded data
 * ends, a recessive baseline only (no gridlines), a hover tooltip, and a
 * visually-hidden data table for accessibility/screen readers.
 */
export function BarChart({
  data,
  height = 220,
  formatValue = (v: number) => String(v),
  ariaLabel,
}: {
  data: BarChartDatum[];
  height?: number;
  formatValue?: (value: number) => string;
  ariaLabel: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);

  const width = 600;
  const paddingBottom = 28;
  const paddingTop = 8;
  const chartHeight = height - paddingBottom - paddingTop;
  const maxValue = Math.max(1, ...data.map((d) => d.value));
  const gap = 4;
  const barWidth = data.length > 0 ? Math.max(4, width / data.length - gap) : 0;

  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No data for this range.</p>;
  }

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label={ariaLabel}
        preserveAspectRatio="none"
      >
        <line
          x1={0}
          x2={width}
          y1={height - paddingBottom}
          y2={height - paddingBottom}
          className="stroke-border"
          strokeWidth={1}
        />
        {data.map((d, i) => {
          const barHeight = maxValue > 0 ? (d.value / maxValue) * chartHeight : 0;
          const x = i * (barWidth + gap);
          const y = height - paddingBottom - barHeight;
          const isHovered = hovered === i;
          return (
            <g key={`${d.label}-${i}`}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(barHeight, 1)}
                rx={3}
                className={isHovered ? "fill-primary" : "fill-[var(--chart-2)]"}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
              />
              {/* Larger, invisible hit target so short bars are still easy to hover. */}
              <rect
                x={x}
                y={paddingTop}
                width={barWidth}
                height={chartHeight}
                fill="transparent"
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
              />
              {data.length <= 14 ? (
                <text
                  x={x + barWidth / 2}
                  y={height - paddingBottom + 16}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[9px]"
                >
                  {d.label.length > 8 ? `${d.label.slice(0, 7)}…` : d.label}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      {hovered !== null ? (
        <div
          className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-md border bg-popover px-2 py-1 text-xs whitespace-nowrap text-popover-foreground shadow-md"
          style={{ left: `${((hovered + 0.5) / data.length) * 100}%` }}
        >
          <p className="font-medium">{data[hovered].label}</p>
          <p className="text-muted-foreground">{formatValue(data[hovered].value)}</p>
        </div>
      ) : null}
      <table className="sr-only">
        <caption>{ariaLabel}</caption>
        <thead>
          <tr>
            <th>Label</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d, i) => (
            <tr key={`${d.label}-row-${i}`}>
              <td>{d.label}</td>
              <td>{formatValue(d.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
