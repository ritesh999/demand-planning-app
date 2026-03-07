'use client';

import { useState, useEffect, useCallback } from 'react';
import type { DataSeries, ForecastResult, ForecastRequest } from '@/lib/types';
import MetricCard from '@/components/MetricCard';
import ForecastChart from '@/components/ForecastChart';
import DataTable from '@/components/DataTable';
import { formatNumber } from '@/lib/utils';

type Model = 'exponential_smoothing' | 'arima';

interface FormState {
  model:           Model;
  horizon:         number;
  seasonalPeriods: number;
  arimaP:          number;
  arimaD:          number;
  arimaQ:          number;
}

const defaults: FormState = {
  model:           'exponential_smoothing',
  horizon:         12,
  seasonalPeriods: 52,
  arimaP:          1,
  arimaD:          1,
  arimaQ:          0,
};

export default function ForecastPage() {
  const [data,    setData]    = useState<DataSeries | null>(null);
  const [form,    setForm]    = useState<FormState>(defaults);
  const [result,  setResult]  = useState<ForecastResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  // Load persisted data
  useEffect(() => {
    const raw = sessionStorage.getItem('demandData');
    if (raw) setData(JSON.parse(raw));

    const savedResult = sessionStorage.getItem('forecastResult');
    if (savedResult) setResult(JSON.parse(savedResult));
  }, []);

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm(f => ({ ...f, [key]: val }));

  const runForecast = useCallback(async () => {
    if (!data) { setError('Please load data first.'); return; }
    setLoading(true);
    setError('');
    try {
      const body: ForecastRequest = { data, ...form };
      const res  = await fetch('/api/forecast', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error ?? res.statusText);
      }
      const r: ForecastResult = await res.json();
      setResult(r);
      sessionStorage.setItem('forecastResult', JSON.stringify(r));
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [data, form]);

  const downloadCSV = () => {
    if (!result) return;
    const hasCI = !!result.confidenceLower;
    const header = hasCI
      ? 'Date,Forecast,Lower 95%,Upper 95%'
      : 'Date,Forecast';
    const rows = result.forecast.map((d, i) => {
      const lo = result.confidenceLower?.[i]?.value?.toFixed(2) ?? '';
      const hi = result.confidenceUpper?.[i]?.value?.toFixed(2) ?? '';
      return hasCI
        ? `${d.date},${d.value.toFixed(2)},${lo},${hi}`
        : `${d.date},${d.value.toFixed(2)}`;
    });
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url; a.download = 'demand_forecast.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const fcstTableCols = [
    { key: 'date',  header: 'Date' },
    { key: 'value', header: 'Forecast', format: (v: number) => formatNumber(v) },
  ];

  const inputCls = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
  const labelCls = 'block text-xs font-medium text-slate-600 mb-1';

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Forecasting</h1>
        <p className="text-slate-500 mt-1">Run demand forecasts using statistical models.</p>
      </div>

      {!data && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-3 text-sm">
          No data loaded. Go to <strong>Data Upload</strong> to load your dataset first.
        </div>
      )}

      {/* Settings form */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
        <h2 className="text-base font-semibold text-slate-800">Forecast Settings</h2>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {/* Model */}
          <div className="col-span-2 md:col-span-1">
            <label className={labelCls}>Model</label>
            <select className={inputCls} value={form.model} onChange={e => set('model', e.target.value as Model)}>
              <option value="exponential_smoothing">Exponential Smoothing</option>
              <option value="arima">ARIMA</option>
            </select>
          </div>

          {/* Horizon */}
          <div>
            <label className={labelCls}>Forecast Horizon (periods)</label>
            <input
              type="number" min={1} max={365}
              className={inputCls}
              value={form.horizon}
              onChange={e => set('horizon', parseInt(e.target.value) || 1)}
            />
          </div>

          {/* Seasonal periods */}
          <div>
            <label className={labelCls}>Seasonal Periods (0 = none)</label>
            <input
              type="number" min={0} max={365}
              className={inputCls}
              value={form.seasonalPeriods}
              onChange={e => set('seasonalPeriods', parseInt(e.target.value) || 0)}
            />
          </div>
        </div>

        {/* ARIMA params */}
        {form.model === 'arima' && (
          <div>
            <p className={labelCls}>ARIMA Order (p, d, q)</p>
            <div className="grid grid-cols-3 gap-3">
              {(['arimaP', 'arimaD', 'arimaQ'] as const).map((key, idx) => (
                <div key={key}>
                  <label className={labelCls}>{['p — AR order', 'd — Differencing', 'q — MA order'][idx]}</label>
                  <input
                    type="number" min={0} max={5}
                    className={inputCls}
                    value={form[key]}
                    onChange={e => set(key, parseInt(e.target.value) || 0)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        <button
          onClick={runForecast}
          disabled={loading || !data}
          className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Running…' : '▶ Run Forecast'}
        </button>
      </div>

      {/* Results */}
      {result && (
        <>
          {/* Accuracy metrics */}
          <div className="grid grid-cols-3 gap-4">
            <MetricCard label="MAE"  value={formatNumber(result.metrics.mae)}  accent="blue"  />
            <MetricCard label="RMSE" value={formatNumber(result.metrics.rmse)} accent="green" />
            <MetricCard label="MAPE" value={`${formatNumber(result.metrics.mape)} %`} accent="amber" />
          </div>

          {/* Chart */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-base font-semibold text-slate-800 mb-4">Forecast Chart</h2>
            <ForecastChart result={result} />
          </div>

          {/* Forecast table */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-slate-800">Forecast Values</h2>
              <button
                onClick={downloadCSV}
                className="text-sm text-blue-600 hover:underline"
              >
                Download CSV
              </button>
            </div>
            <DataTable columns={fcstTableCols} rows={result.forecast as unknown as Record<string, unknown>[]} maxRows={50} />
          </div>
        </>
      )}
    </div>
  );
}
