export default function AboutPage() {
  const stack = [
    ['Framework',   'Next.js 14 (App Router)'],
    ['Language',    'TypeScript'],
    ['Styling',     'Tailwind CSS'],
    ['Charts',      'Recharts'],
    ['Deployment',  'Vercel (serverless)'],
    ['Version',     '0.5.0'],
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">About</h1>
        <p className="text-slate-500 mt-1">Demand Planning App — construction supply chain analytics.</p>
      </div>

      {/* What it does */}
      <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-3">
        <h2 className="text-base font-semibold text-slate-800">What Is Demand Planning?</h2>
        <p className="text-sm text-slate-600">
          Demand planning is the process of forecasting future product or material demand to ensure
          supply chains can fulfil customer orders without excessive inventory costs. For construction
          firms this means predicting how much concrete, steel, lumber, and other materials will be
          needed — week by week — so procurement can stay ahead of site schedules.
        </p>
        <p className="text-sm text-slate-600">
          This application combines statistical time-series forecasting (Exponential Smoothing and
          ARIMA) with inventory optimisation algorithms (safety stock, EOQ) to give planners
          actionable insights from their own historical data.
        </p>
      </section>

      {/* Models */}
      <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <h2 className="text-base font-semibold text-slate-800">Forecasting Models</h2>

        <div className="space-y-3 text-sm text-slate-600">
          <div>
            <p className="font-medium text-slate-800">Exponential Smoothing (Holt-Winters Additive)</p>
            <p>
              Captures level, trend, and seasonality via three smoothing parameters (α, β, γ).
              Best for data with consistent seasonal patterns — ideal for weekly construction demand
              peaking in spring/summer.
            </p>
          </div>
          <div>
            <p className="font-medium text-slate-800">ARIMA (p, d, q)</p>
            <p>
              Auto-Regressive Integrated Moving Average. Handles non-stationary series via
              differencing (d), autoregressive lags (p), and moving-average residual correction (q).
              Default order is (1, 1, 0) — a random walk with drift correction. 95% confidence
              intervals widen with forecast horizon.
            </p>
          </div>
        </div>
      </section>

      {/* Inventory */}
      <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-3">
        <h2 className="text-base font-semibold text-slate-800">Inventory Calculations</h2>
        <dl className="grid grid-cols-1 gap-2 text-sm">
          {[
            ['Safety Stock',  'Z × σ × √(lead time) — buffer for demand variability at the chosen service level.'],
            ['Reorder Point', 'Forecast demand during lead time + safety stock.'],
            ['EOQ',           '√(2 × annual demand × ordering cost / holding cost) — minimises total inventory cost.'],
          ].map(([term, def]) => (
            <div key={term} className="flex gap-3">
              <dt className="shrink-0 font-medium text-slate-800 w-36">{term}</dt>
              <dd className="text-slate-600">{def}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Security */}
      <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-2">
        <h2 className="text-base font-semibold text-slate-800">Security & Data Privacy</h2>
        <ul className="text-sm text-slate-600 list-disc list-inside space-y-1">
          <li>All file parsing happens client-side in the browser — files are never sent to a server.</li>
          <li>Forecasting and inventory calculations run in Vercel Edge serverless functions; no data is persisted.</li>
          <li>No cookies or analytics are collected.</li>
          <li>Store secrets in Vercel environment variables, never in source code.</li>
        </ul>
      </section>

      {/* Tech stack */}
      <section className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-base font-semibold text-slate-800 mb-4">Tech Stack</h2>
        <table className="text-sm min-w-full">
          <tbody className="divide-y divide-slate-100">
            {stack.map(([k, v]) => (
              <tr key={k} className="hover:bg-slate-50">
                <td className="py-2 pr-8 font-medium text-slate-500 w-36">{k}</td>
                <td className="py-2 text-slate-800">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
