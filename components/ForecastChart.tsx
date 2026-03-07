'use client';

import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import type { ForecastResult } from '@/lib/types';

interface ForecastChartProps {
  result: ForecastResult;
}

export default function ForecastChart({ result }: ForecastChartProps) {
  const { historical, fitted, forecast, confidenceLower, confidenceUpper } = result;

  // Merge all data into a single array for Recharts
  const histMap  = new Map(historical.map(d => [d.date, d.value]));
  const fitMap   = new Map(fitted.map(d => [d.date, d.value]));
  const fcstMap  = new Map(forecast.map(d => [d.date, d.value]));
  const loMap    = new Map((confidenceLower ?? []).map(d => [d.date, d.value]));
  const hiMap    = new Map((confidenceUpper ?? []).map(d => [d.date, d.value]));

  const allDates = Array.from(new Set([
    ...historical.map(d => d.date),
    ...forecast.map(d => d.date),
  ])).sort();

  const firstFcstDate = forecast[0]?.date;

  const chartData = allDates.map(date => {
    const lo  = loMap.get(date);
    const hi  = hiMap.get(date);
    return {
      date,
      historical: histMap.get(date) ?? null,
      fitted:     fitMap.get(date)  ?? null,
      forecast:   fcstMap.get(date) ?? null,
      // Area band: [lo, hi-lo] so recharts stacks correctly
      ciLo: lo  != null && hi != null ? lo : null,
      ciBand: lo != null && hi != null ? hi - lo : null,
    };
  });

  const tickFormatter = (v: string) => {
    const d = new Date(v);
    return `${d.toLocaleString('default', { month: 'short' })} ${d.getFullYear().toString().slice(2)}`;
  };

  return (
    <ResponsiveContainer width="100%" height={380}>
      <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey="date"
          tickFormatter={tickFormatter}
          tick={{ fontSize: 11 }}
          minTickGap={40}
        />
        <YAxis tick={{ fontSize: 11 }} width={60} />
        <Tooltip
          formatter={(val: any) => (val != null ? Number(val).toFixed(1) : '—')}
          labelFormatter={(l: string) => new Date(l).toLocaleDateString('en-GB')}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />

        {/* 95% CI band (ARIMA only) */}
        {confidenceLower && (
          <>
            <Area
              dataKey="ciLo"
              stackId="ci"
              stroke="none"
              fill="transparent"
              legendType="none"
              dot={false}
              activeDot={false}
              name="CI lower (hidden)"
            />
            <Area
              dataKey="ciBand"
              stackId="ci"
              stroke="none"
              fill="#fb923c"
              fillOpacity={0.15}
              name="95% CI"
              dot={false}
              activeDot={false}
            />
          </>
        )}

        {/* Historical */}
        <Line
          type="monotone"
          dataKey="historical"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={false}
          name="Historical"
          connectNulls={false}
        />

        {/* Fitted */}
        <Line
          type="monotone"
          dataKey="fitted"
          stroke="#f97316"
          strokeWidth={1.5}
          strokeDasharray="4 3"
          dot={false}
          name="Fitted"
          connectNulls={false}
        />

        {/* Forecast */}
        <Line
          type="monotone"
          dataKey="forecast"
          stroke="#ef4444"
          strokeWidth={2}
          dot={false}
          name="Forecast"
          connectNulls={false}
        />

        {/* Divider between history and forecast */}
        {firstFcstDate && (
          <ReferenceLine x={firstFcstDate} stroke="#94a3b8" strokeDasharray="4 2" label="" />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
