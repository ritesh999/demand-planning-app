'use client';

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import type { DataSeries } from '@/lib/types';

export default function HistoricalChart({ data }: { data: DataSeries }) {
  const tickFmt = (v: string) => {
    const d = new Date(v);
    return `${d.toLocaleString('default', { month: 'short' })} ${d.getFullYear().toString().slice(2)}`;
  };

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 5, right: 15, left: 5, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="date" tickFormatter={tickFmt} tick={{ fontSize: 11 }} minTickGap={40} />
        <YAxis tick={{ fontSize: 11 }} width={55} />
        <Tooltip
          formatter={(v: number) => v.toFixed(1)}
          labelFormatter={(l: string) => new Date(l).toLocaleDateString('en-GB')}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={false}
          name="Demand"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
