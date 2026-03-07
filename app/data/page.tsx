'use client';

import { useState, useRef, useCallback } from 'react';
import type { DataSeries } from '@/lib/types';
import DataTable from '@/components/DataTable';
import { formatNumber } from '@/lib/utils';
import { Upload, FlaskConical } from 'lucide-react';

type Tab = 'upload' | 'sample';

export default function DataPage() {
  const [tab,     setTab]     = useState<Tab>('upload');
  const [data,    setData]    = useState<DataSeries | null>(null);
  const [error,   setError]   = useState<string>('');
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const persist = (d: DataSeries) => {
    setData(d);
    setError('');
    sessionStorage.setItem('demandData', JSON.stringify(d));
  };

  // ── File upload ───────────────────────────────────────────────────────────
  const handleFile = useCallback(async (file: File) => {
    setLoading(true);
    setError('');
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

      if (ext === 'csv' || ext === 'tsv') {
        const { default: Papa } = await import('papaparse');
        const text = await file.text();
        const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });

        const rows  = parsed.data;
        const cols  = Object.keys(rows[0] ?? {});
        const dateCols  = cols.filter(c => /date|week|period|time/i.test(c));
        const valueCols = cols.filter(c => /demand|qty|quantity|value|amount|vol/i.test(c));

        const dc = dateCols[0]  ?? cols[0];
        const vc = valueCols[0] ?? cols[1];

        const series: DataSeries = rows
          .map(r => ({ date: String(r[dc] ?? ''), value: parseFloat(r[vc]) }))
          .filter(r => r.date && !isNaN(r.value));

        if (series.length === 0) throw new Error('No valid rows found.');
        persist(series);

      } else if (ext === 'xlsx' || ext === 'xls') {
        const { read, utils } = await import('xlsx');
        const buf  = await file.arrayBuffer();
        const wb   = read(buf, { type: 'array' });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const rows = utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });

        const cols      = Object.keys(rows[0] ?? {});
        const dateCols  = cols.filter(c => /date|week|period|time/i.test(String(c)));
        const valueCols = cols.filter(c => /demand|qty|quantity|value|amount|vol/i.test(String(c)));

        const dc = dateCols[0]  ?? cols[0];
        const vc = valueCols[0] ?? cols[1];

        const series: DataSeries = rows
          .map(r => ({ date: String(r[dc] ?? ''), value: parseFloat(String(r[vc])) }))
          .filter(r => r.date && !isNaN(r.value));

        if (series.length === 0) throw new Error('No valid rows found.');
        persist(series);

      } else {
        throw new Error('Unsupported file type. Please upload CSV, TSV, XLSX, or XLS.');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  // ── Sample data ───────────────────────────────────────────────────────────
  const loadSample = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res  = await fetch('/api/sample-data');
      const json = await res.json();
      persist(json.data);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const tableColumns = [
    { key: 'date',  header: 'Date' },
    { key: 'value', header: 'Demand', format: (v: number) => formatNumber(v, 0) },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Data Upload</h1>
        <p className="text-slate-500 mt-1">Load your demand data or use the sample dataset.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        {(['upload', 'sample'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === t
                ? 'bg-white shadow text-slate-900'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {t === 'upload' ? <Upload className="w-4 h-4" /> : <FlaskConical className="w-4 h-4" />}
            {t === 'upload' ? 'Upload File' : 'Sample Data'}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'upload' ? (
        <div
          className="border-2 border-dashed border-slate-300 rounded-xl p-10 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
          onDrop={onDrop}
          onDragOver={e => e.preventDefault()}
          onClick={() => fileRef.current?.click()}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.tsv,.xlsx,.xls"
            onChange={onFileChange}
            className="hidden"
          />
          <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <p className="text-slate-600 font-medium">Drop a file here or click to browse</p>
          <p className="text-xs text-slate-400 mt-1">Supports CSV, TSV, XLSX, XLS · up to 200 MB</p>
        </div>
      ) : (
        <div className="border border-slate-200 rounded-xl p-8 text-center bg-white">
          <FlaskConical className="w-10 h-10 text-blue-400 mx-auto mb-3" />
          <p className="text-slate-700 font-medium mb-1">104-week construction material dataset</p>
          <p className="text-xs text-slate-400 mb-5">
            Concrete, steel, lumber, rebar & bricks with realistic seasonality and trend.
          </p>
          <button
            onClick={loadSample}
            disabled={loading}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Loading…' : 'Load Sample Dataset'}
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Preview */}
      {data && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-800">
              Data loaded — {data.length} rows
            </h2>
            <span className="text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded-full font-medium">
              Saved to session
            </span>
          </div>
          <DataTable columns={tableColumns} rows={data as unknown as Record<string, unknown>[]} maxRows={20} />
        </div>
      )}
    </div>
  );
}
