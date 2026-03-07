'use client';

import { useEffect, useState, useCallback } from 'react';
import type { DataSeries } from '@/lib/types';
import MetricCard from '@/components/MetricCard';
import HistoricalChart from '@/components/HistoricalChart';
import DataTable from '@/components/DataTable';
import { formatNumber, mean } from '@/lib/utils';

export default function DashboardPage() {
  const [data, setData] = useState<DataSeries | null>(null);

  // Load persisted data from sessionStorage on mount
  useEffect(() => {
    const raw = sessionStorage.getItem('demandData');
    if (raw) setData(JSON.parse(raw));
  }, []);

  const loadSample = useCallback(async () => {
    const res  = await fetch('/api/sample-data');
    const json = await res.json();
    setData(json.data);
    sessionStorage.setItem('demandData', JSON.stringify(json.data));
  }, []);

  // ── Summary metrics ──────────────────────────────────────────────────────
  const values     = data?.map(d => d.value) ?? [];
  const avgDemand  = values.length ? mean(values) : 0;
  const peakVal    = values.length ? Math.max(...values) : 0;
  const peakDate   = data?.[values.indexOf(peakVal)]?.date ?? '—';
  const trendPct   = (() => {
    if (!data || data.length < 8) return null;
    const q  = Math.floor(data.length / 4);
    const m1 = mean(data.slice(0, q).map(d => d.value));
    const m2 = mean(data.slice(-q).map(d => d.value));
    return m1 === 0 ? null : ((m2 - m1) / m1) * 100;
  })();

  const tableColumns = [
    { key: 'date',  header: 'Date' },
    { key: 'value', header: 'Demand', format: (v: number) => formatNumber(v, 0) },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 mt-1">Overview of your demand data.</p>
      </div>

      {!data ? (
        <div className="rounded-xl border-2 border-dashed border-slate-200 p-12 text-center">
          <p className="text-slate-500 mb-4">No data loaded yet.</p>
          <button
            onClick={loadSample}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Load sample construction dataset
          </button>
          <p className="text-xs text-slate-400 mt-3">
            Or upload your own data on the <strong>Data Upload</strong> page.
          </p>
        </div>
      ) : (
        <>
          {/* Metric cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard label="Total Records"  value={data.length.toLocaleString()} accent="blue" />
            <MetricCard label="Avg Demand/Period" value={formatNumber(avgDemand)} accent="green" />
            <MetricCard
              label="Peak Demand"
              value={formatNumber(peakVal, 0)}
              sub={peakDate}
              accent="amber"
            />
            <MetricCard
              label="Trend"
              value={trendPct != null ? `${trendPct >= 0 ? '+' : ''}${trendPct.toFixed(1)}%` : '—'}
              sub="Q1 vs Q4"
              accent={trendPct != null && trendPct >= 0 ? 'green' : 'rose'}
            />
          </div>

          {/* Chart */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-base font-semibold text-slate-800 mb-4">Historical Demand</h2>
            <HistoricalChart data={data} />
          </div>

          {/* Data preview */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-base font-semibold text-slate-800 mb-4">Data Preview</h2>
            <DataTable columns={tableColumns} rows={data as unknown as Record<string, unknown>[]} maxRows={20} />
          </div>

          <button
            onClick={loadSample}
            className="text-sm text-blue-600 hover:underline"
          >
            Reload sample data
          </button>
        </>
      )}
    </div>
  );
}
