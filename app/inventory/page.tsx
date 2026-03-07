'use client';

import { useState, useEffect, useCallback } from 'react';
import type { DataSeries, ForecastResult, InventoryMetrics } from '@/lib/types';
import MetricCard from '@/components/MetricCard';
import { formatNumber } from '@/lib/utils';

interface FormState {
  leadTime:     number;
  serviceLevel: number;
  orderingCost: string;
  holdingCost:  string;
}

const defaults: FormState = {
  leadTime:     4,
  serviceLevel: 95,
  orderingCost: '',
  holdingCost:  '',
};

export default function InventoryPage() {
  const [data,     setData]     = useState<DataSeries | null>(null);
  const [forecast, setForecast] = useState<DataSeries | null>(null);
  const [form,     setForm]     = useState<FormState>(defaults);
  const [metrics,  setMetrics]  = useState<InventoryMetrics | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  useEffect(() => {
    const raw = sessionStorage.getItem('demandData');
    if (raw) setData(JSON.parse(raw));
    const fr  = sessionStorage.getItem('forecastResult');
    if (fr) {
      const r: ForecastResult = JSON.parse(fr);
      setForecast(r.forecast);
    }
  }, []);

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm(f => ({ ...f, [key]: val }));

  const run = useCallback(async () => {
    if (!data)     { setError('No historical data loaded.'); return; }
    if (!forecast) { setError('No forecast data — run a forecast first.'); return; }
    setLoading(true);
    setError('');
    try {
      const body = {
        data,
        forecast,
        leadTime:     form.leadTime,
        serviceLevel: form.serviceLevel / 100,
        orderingCost: form.orderingCost ? parseFloat(form.orderingCost) : undefined,
        holdingCost:  form.holdingCost  ? parseFloat(form.holdingCost)  : undefined,
      };
      const res = await fetch('/api/inventory', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error ?? res.statusText);
      }
      setMetrics(await res.json());
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [data, forecast, form]);

  const downloadCSV = () => {
    if (!metrics) return;
    const rows = [
      ['Metric', 'Value'],
      ['Average Demand / Period', metrics.averageDemand.toFixed(2)],
      ['Demand During Lead Time',  metrics.demandDuringLead.toFixed(2)],
      ['Std Deviation (σ)',        metrics.sigma.toFixed(2)],
      ['Z-Score',                  metrics.zScore.toFixed(4)],
      ['Safety Stock',             metrics.safetyStock.toFixed(2)],
      ['Reorder Point',            metrics.reorderPoint.toFixed(2)],
      ...(metrics.eoq != null ? [['EOQ', metrics.eoq.toFixed(2)]] : []),
    ];
    const csv  = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'inventory_report.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const inputCls = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
  const labelCls = 'block text-xs font-medium text-slate-600 mb-1';

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Inventory Optimisation</h1>
        <p className="text-slate-500 mt-1">Calculate safety stock, reorder point, and EOQ.</p>
      </div>

      {(!data || !forecast) && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-3 text-sm space-y-1">
          {!data     && <p>No demand data loaded — go to <strong>Data Upload</strong>.</p>}
          {!forecast && <p>No forecast found — run a forecast on the <strong>Forecasting</strong> page first.</p>}
        </div>
      )}

      {/* Form */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
        <h2 className="text-base font-semibold text-slate-800">Inventory Parameters</h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className={labelCls}>Lead Time (periods)</label>
            <input
              type="number" min={1}
              className={inputCls}
              value={form.leadTime}
              onChange={e => set('leadTime', parseInt(e.target.value) || 1)}
            />
          </div>
          <div>
            <label className={labelCls}>Service Level (%)</label>
            <input
              type="number" min={50} max={99} step={1}
              className={inputCls}
              value={form.serviceLevel}
              onChange={e => set('serviceLevel', parseFloat(e.target.value) || 95)}
            />
          </div>
          <div>
            <label className={labelCls}>Ordering Cost (£, optional)</label>
            <input
              type="number" min={0}
              placeholder="e.g. 150"
              className={inputCls}
              value={form.orderingCost}
              onChange={e => set('orderingCost', e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>Holding Cost / unit / yr (£, optional)</label>
            <input
              type="number" min={0}
              placeholder="e.g. 2.5"
              className={inputCls}
              value={form.holdingCost}
              onChange={e => set('holdingCost', e.target.value)}
            />
          </div>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        <button
          onClick={run}
          disabled={loading || !data || !forecast}
          className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Calculating…' : '▶ Calculate'}
        </button>
      </div>

      {/* Results */}
      {metrics && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <MetricCard label="Safety Stock"   value={formatNumber(metrics.safetyStock, 0)}   accent="blue"  />
            <MetricCard label="Reorder Point"  value={formatNumber(metrics.reorderPoint, 0)}  accent="green" />
            <MetricCard label="Avg Demand / Period" value={formatNumber(metrics.averageDemand)} accent="amber" />
            {metrics.eoq != null && (
              <MetricCard label="EOQ" value={formatNumber(metrics.eoq, 0)} sub="Economic Order Quantity" accent="rose" />
            )}
          </div>

          {/* Full table */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-slate-800">Full Report</h2>
              <button onClick={downloadCSV} className="text-sm text-blue-600 hover:underline">
                Download CSV
              </button>
            </div>
            <table className="min-w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                {[
                  ['Average Demand / Period',  formatNumber(metrics.averageDemand)],
                  ['Demand During Lead Time',   formatNumber(metrics.demandDuringLead)],
                  ['Std Deviation (σ)',          formatNumber(metrics.sigma)],
                  ['Z-Score',                   metrics.zScore.toFixed(4)],
                  ['Safety Stock',              formatNumber(metrics.safetyStock)],
                  ['Reorder Point',             formatNumber(metrics.reorderPoint)],
                  ...(metrics.eoq != null ? [['EOQ (units)', formatNumber(metrics.eoq)]] : []),
                ].map(([label, value]) => (
                  <tr key={label} className="hover:bg-slate-50">
                    <td className="py-2.5 pr-8 text-slate-500 font-medium">{label}</td>
                    <td className="py-2.5 text-slate-900 font-semibold">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Info */}
          <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-xl p-5 text-sm space-y-1">
            <p><strong>Reorder Point:</strong> Place a new order when stock drops to {formatNumber(metrics.reorderPoint, 0)} units.</p>
            <p><strong>Safety Stock:</strong> {formatNumber(metrics.safetyStock, 0)} units held as buffer against demand variability at {form.serviceLevel}% service level.</p>
            {metrics.eoq != null && (
              <p><strong>EOQ:</strong> Order {formatNumber(metrics.eoq, 0)} units per order to minimise total ordering + holding costs.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
