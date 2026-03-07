/**
 * Forecasting algorithms – pure TypeScript, no external deps.
 *
 * Implements:
 *   1. Holt-Winters Additive Exponential Smoothing  (Holt's linear when m < 2)
 *   2. ARIMA(p, d, q)  via OLS for AR coefficients + 2-stage residual MA
 */

import type { DataSeries, ForecastResult, AccuracyMetrics } from './types';
import { mean, inferDateStep, addStep } from './utils';

// ---------------------------------------------------------------------------
// Accuracy helpers
// ---------------------------------------------------------------------------

function mae(actual: number[], pred: number[]): number {
  const n = Math.min(actual.length, pred.length);
  let s = 0;
  for (let i = 0; i < n; i++) s += Math.abs(actual[i] - pred[i]);
  return s / n;
}

function rmse(actual: number[], pred: number[]): number {
  const n = Math.min(actual.length, pred.length);
  let s = 0;
  for (let i = 0; i < n; i++) s += (actual[i] - pred[i]) ** 2;
  return Math.sqrt(s / n);
}

function mape(actual: number[], pred: number[]): number {
  const n = Math.min(actual.length, pred.length);
  let s = 0, cnt = 0;
  for (let i = 0; i < n; i++) {
    if (actual[i] !== 0) { s += Math.abs((actual[i] - pred[i]) / actual[i]); cnt++; }
  }
  return cnt > 0 ? (s / cnt) * 100 : 0;
}

function metrics(actual: number[], pred: number[]): AccuracyMetrics {
  return { mae: mae(actual, pred), rmse: rmse(actual, pred), mape: mape(actual, pred) };
}

// ---------------------------------------------------------------------------
// Holt-Winters Additive Exponential Smoothing
// ---------------------------------------------------------------------------

export function forecastES(
  series: DataSeries,
  horizon: number,
  seasonalPeriods: number,
  alpha = 0.3,
  beta  = 0.1,
  gamma = 0.1,
): ForecastResult {
  const y      = series.map(d => d.value);
  const n      = y.length;
  const m      = seasonalPeriods >= 2 ? seasonalPeriods : 0;
  const step   = inferDateStep(series.map(d => d.date));
  const lastDt = series[n - 1].date;

  let fitted: number[];
  let fcstVals: number[];

  if (m < 2) {
    // ── Holt's linear (no seasonality) ──────────────────────────────────────
    let l = y[0];
    let b = n > 1 ? y[1] - y[0] : 0;
    fitted = [];

    for (let t = 0; t < n; t++) {
      fitted.push(l + b);          // one-step ahead from previous state
      const lp = l, bp = b;
      l = alpha * y[t] + (1 - alpha) * (lp + bp);
      b = beta  * (l - lp) + (1 - beta) * bp;
    }

    fcstVals = Array.from({ length: horizon }, (_, h) => l + (h + 1) * b);

  } else {
    // ── Holt-Winters Additive ────────────────────────────────────────────────
    // Initialise using first two complete seasons (or first season if n < 2m)
    const season1 = y.slice(0, m);
    const season2 = n >= 2 * m ? y.slice(m, 2 * m) : season1;

    let l = mean(season1);
    let b = (mean(season2) - mean(season1)) / m;
    // Seasonal indices: deviation from initial level
    const s = season1.map(v => v - l);

    fitted = [];

    for (let t = 0; t < n; t++) {
      const sMinus = s[((t % m) - m + m) % m];  // s_{t - m}
      const lp = l, bp = b;

      // Store one-step-ahead forecast made at t-1
      fitted.push(lp + bp + sMinus);

      // Update state
      l = alpha * (y[t] - sMinus) + (1 - alpha) * (lp + bp);
      b = beta  * (l - lp)        + (1 - beta)  * bp;
      s[t % m] = gamma * (y[t] - l) + (1 - gamma) * sMinus;
    }

    // h-step forecast
    fcstVals = Array.from({ length: horizon }, (_, h) => {
      const hh   = h + 1;
      const sIdx = ((n + hh - 1) % m + m) % m;
      return l + hh * b + s[sIdx];
    });
  }

  const forecastSeries: DataSeries = fcstVals.map((v, i) => ({
    date:  addStep(lastDt, i + 1, step),
    value: Math.max(0, v),
  }));

  return {
    historical: series,
    fitted: series.map((d, i) => ({ date: d.date, value: Math.max(0, fitted[i] ?? y[i]) })),
    forecast: forecastSeries,
    metrics: metrics(y, fitted),
    model: 'exponential_smoothing',
  };
}

// ---------------------------------------------------------------------------
// OLS solver (Gaussian elimination with partial pivoting)
// ---------------------------------------------------------------------------

function ols(X: number[][], yVec: number[]): number[] {
  const p = X[0].length;
  const n = X.length;

  // Build X'X and X'y
  const XtX: number[][] = Array.from({ length: p }, () => new Array(p).fill(0));
  const Xty: number[]   = new Array(p).fill(0);

  for (let k = 0; k < n; k++) {
    for (let i = 0; i < p; i++) {
      Xty[i] += X[k][i] * yVec[k];
      for (let j = 0; j < p; j++) XtX[i][j] += X[k][i] * X[k][j];
    }
  }

  // Augmented matrix [XtX | Xty]
  const aug: number[][] = XtX.map((row, i) => [...row, Xty[i]]);

  // Forward elimination with partial pivoting
  for (let col = 0; col < p; col++) {
    let maxRow = col;
    for (let row = col + 1; row < p; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row;
    }
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];
    if (Math.abs(aug[col][col]) < 1e-12) continue;
    for (let row = 0; row < p; row++) {
      if (row === col) continue;
      const f = aug[row][col] / aug[col][col];
      for (let j = col; j <= p; j++) aug[row][j] -= f * aug[col][j];
    }
  }

  return aug.map(row => (Math.abs(row[row.length - 2]) < 1e-12 ? 0 : row[p] / row[p - 1]));
}

// ---------------------------------------------------------------------------
// ARIMA(p, d, q)
// ---------------------------------------------------------------------------

/** Difference a series d times. */
function difference(arr: number[], d: number): number[] {
  let x = arr;
  for (let i = 0; i < d; i++) x = x.slice(1).map((v, j) => v - x[j]);
  return x;
}

/** Integrate a differenced forecast back to the original scale. */
function integrate(diff: number[], origSeries: number[], d: number): number[] {
  if (d === 0) return diff;

  // We need the "last d levels" to un-difference correctly
  // For d=1: ŷ[T+h] = ŷ[T+h-1] + diff[h], starting from y[T]
  // For d=2: apply integration twice, using the last differenced value
  let result = diff;
  for (let level = d; level >= 1; level--) {
    // The last value of the series at differencing level (level-1)
    let src = origSeries;
    for (let i = 0; i < level - 1; i++) src = src.slice(1).map((v, j) => v - src[j]);
    const lastVal = src[src.length - 1];

    const integrated: number[] = [];
    let prev = lastVal;
    for (const v of result) { prev += v; integrated.push(prev); }
    result = integrated;
  }
  return result;
}

export function forecastARIMA(
  series: DataSeries,
  horizon: number,
  p: number,
  d: number,
  q: number,
): ForecastResult {
  const y      = series.map(pt => pt.value);
  const n      = y.length;
  const step   = inferDateStep(series.map(d => d.date));
  const lastDt = series[n - 1].date;

  // ── 1. Difference ────────────────────────────────────────────────────────
  const stat = difference(y, d);
  const sn   = stat.length;

  let phi:   number[] = [];
  let theta: number[] = [];
  let mu = 0;
  let eps: number[] = new Array(sn).fill(0);
  let fittedDiff: number[] = new Array(sn).fill(0);

  // ── 2. Fit AR(p) via OLS ─────────────────────────────────────────────────
  if (p > 0 && sn > p) {
    const X: number[][] = [];
    const yy: number[]  = [];
    for (let t = p; t < sn; t++) {
      X.push([1, ...Array.from({ length: p }, (_, k) => stat[t - 1 - k])]);
      yy.push(stat[t]);
    }
    const beta = ols(X, yy);
    mu  = beta[0];
    phi = beta.slice(1);

    // Compute AR residuals
    for (let t = p; t < sn; t++) {
      let pred = mu;
      for (let k = 0; k < p; k++) pred += phi[k] * stat[t - 1 - k];
      fittedDiff[t] = pred;
      eps[t]        = stat[t] - pred;
    }
  } else {
    // p=0: forecast constant (mean of stationary series)
    mu = mean(stat);
    fittedDiff = new Array(sn).fill(mu);
    eps        = stat.map(v => v - mu);
  }

  // ── 3. Fit MA(q) residuals (2-stage) ─────────────────────────────────────
  if (q > 0 && sn > Math.max(p, q)) {
    const Xma: number[][] = [];
    const yma: number[]  = [];
    const start = Math.max(p, q);
    for (let t = start; t < sn; t++) {
      Xma.push(Array.from({ length: q }, (_, k) => (t - 1 - k >= 0 ? eps[t - 1 - k] : 0)));
      yma.push(eps[t]);
    }
    if (Xma.length > 0 && Xma[0].length > 0) theta = ols(Xma, yma);
  }

  // Refine fittedDiff with MA correction
  for (let t = Math.max(p, q); t < sn; t++) {
    let maCorr = 0;
    for (let j = 0; j < q; j++) {
      if (t - 1 - j >= 0) maCorr += (theta[j] || 0) * eps[t - 1 - j];
    }
    fittedDiff[t] += maCorr;
    eps[t]         = stat[t] - fittedDiff[t];
  }

  // ── 4. Forecast in stationary space ──────────────────────────────────────
  const extStat  = [...stat];
  const extEps   = [...eps];
  const diffFcst: number[] = [];

  for (let h = 0; h < horizon; h++) {
    let pred = mu;
    for (let k = 0; k < p; k++) pred += phi[k] * extStat[extStat.length - 1 - k];
    for (let j = 0; j < q; j++) pred += (theta[j] || 0) * (extEps[extEps.length - 1 - j] || 0);
    diffFcst.push(pred);
    extStat.push(pred);
    extEps.push(0);
  }

  // ── 5. Integrate forecast back to level ──────────────────────────────────
  const fcstLevels = integrate(diffFcst, y, d);

  // ── 6. Integrate fitted values back to level ──────────────────────────────
  // For d=1: fitted_level[t] = y[t-1] + fitted_diff[t]  (shift by 1)
  const fittedLevel: number[] = y.map((v, t) => {
    if (t < d + Math.max(p, 1)) return v;  // can't fit initial values; echo actual
    if (d === 0) return fittedDiff[t] ?? v;
    if (d === 1) return (y[t - 1] ?? v) + (fittedDiff[t - 1] ?? 0);
    return v;
  });

  // ── 7. Confidence intervals (widening with horizon) ───────────────────────
  const resStd = Math.sqrt(
    eps.slice(Math.max(p, q)).reduce((s, r) => s + r * r, 0) /
    Math.max(1, sn - Math.max(p, q) - 1),
  );
  const z95 = 1.96;

  const forecastSeries: DataSeries = fcstLevels.map((v, i) => ({
    date:  addStep(lastDt, i + 1, step),
    value: Math.max(0, v),
  }));

  return {
    historical: series,
    fitted:     series.map((pt, i) => ({ date: pt.date, value: Math.max(0, fittedLevel[i] ?? pt.value) })),
    forecast:   forecastSeries,
    confidenceLower: fcstLevels.map((v, i) => ({
      date:  forecastSeries[i].date,
      value: Math.max(0, v - z95 * resStd * Math.sqrt(i + 1)),
    })),
    confidenceUpper: fcstLevels.map((v, i) => ({
      date:  forecastSeries[i].date,
      value: Math.max(0, v + z95 * resStd * Math.sqrt(i + 1)),
    })),
    metrics: metrics(y, fittedLevel),
    model: 'arima',
  };
}
