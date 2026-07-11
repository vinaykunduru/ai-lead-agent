"use client";

import { useState } from "react";

export type DonutDatum = { label: string; value: number };

const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
const MAX_SLICES = CHART_COLORS.length;

function foldIntoOther(data: DonutDatum[]): DonutDatum[] {
  if (data.length <= MAX_SLICES) return data;
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const head = sorted.slice(0, MAX_SLICES - 1);
  const rest = sorted.slice(MAX_SLICES - 1);
  const otherTotal = rest.reduce((sum, d) => sum + d.value, 0);
  return [...head, { label: "Other", value: otherTotal }];
}

/**
 * A donut for part-of-whole distributions (pipeline stages, provider/model
 * share). Categorical hues are assigned in a fixed order from the design
 * system's --chart-1..5 ramp (dataviz skill: "assign categorical hues in
 * fixed order, never cycled"); a distribution with more than 5 categories
 * folds the smallest into "Other" rather than generating a 6th hue.
 * Identity is never color-alone — every slice keeps its label + value in
 * the always-present legend, and a screen-reader table is included.
 */
export function DonutChart({ data, ariaLabel }: { data: DonutDatum[]; ariaLabel: string }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const slices = foldIntoOther(data.filter((d) => d.value > 0));
  const total = slices.reduce((sum, d) => sum + d.value, 0);

  if (total === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No data for this range.</p>;
  }

  const radius = 60;
  const innerRadius = 36;
  const center = 70;

  // Compute each slice's [startAngle, endAngle) as a pure fold over the
  // running total, rather than mutating a variable across map iterations
  // (React Compiler disallows reassigning a variable captured across a
  // render-time .map callback).
  const angleRanges = slices.reduce<{ start: number; end: number }[]>((ranges, slice) => {
    const previousEnd = ranges.length > 0 ? ranges[ranges.length - 1].end : -90;
    const angle = (slice.value / total) * 360;
    return [...ranges, { start: previousEnd, end: previousEnd + angle }];
  }, []);

  const arcs = slices.map((slice, i) => {
    const fraction = slice.value / total;
    const { start: startAngle, end: endAngle } = angleRanges[i];
    const angle = endAngle - startAngle;

    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const outerStart = { x: center + radius * Math.cos(toRad(startAngle)), y: center + radius * Math.sin(toRad(startAngle)) };
    const outerEnd = { x: center + radius * Math.cos(toRad(endAngle)), y: center + radius * Math.sin(toRad(endAngle)) };
    const innerStart = { x: center + innerRadius * Math.cos(toRad(endAngle)), y: center + innerRadius * Math.sin(toRad(endAngle)) };
    const innerEnd = { x: center + innerRadius * Math.cos(toRad(startAngle)), y: center + innerRadius * Math.sin(toRad(startAngle)) };
    const largeArc = angle > 180 ? 1 : 0;

    const path = [
      `M ${outerStart.x} ${outerStart.y}`,
      `A ${radius} ${radius} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
      `L ${innerStart.x} ${innerStart.y}`,
      `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerEnd.x} ${innerEnd.y}`,
      "Z",
    ].join(" ");

    return { path, color: CHART_COLORS[i % CHART_COLORS.length], slice, percent: Math.round(fraction * 1000) / 10 };
  });

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <svg viewBox="0 0 140 140" className="h-40 w-40 shrink-0" role="img" aria-label={ariaLabel}>
        {arcs.map((arc, i) => (
          <path
            key={arc.slice.label}
            d={arc.path}
            fill={arc.color}
            opacity={hovered === null || hovered === i ? 1 : 0.4}
            stroke="var(--background)"
            strokeWidth={2}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          />
        ))}
      </svg>
      <div className="flex-1 space-y-1.5">
        {arcs.map((arc, i) => (
          <div
            key={arc.slice.label}
            className="flex items-center justify-between gap-3 text-sm"
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          >
            <span className="flex items-center gap-1.5 truncate text-foreground">
              <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: arc.color }} />
              {arc.slice.label}
            </span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {arc.slice.value} ({arc.percent}%)
            </span>
          </div>
        ))}
      </div>
      <table className="sr-only">
        <caption>{ariaLabel}</caption>
        <thead>
          <tr>
            <th>Label</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          {arcs.map((arc) => (
            <tr key={`${arc.slice.label}-row`}>
              <td>{arc.slice.label}</td>
              <td>{arc.slice.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
