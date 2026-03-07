import type { DataSeries } from './types';

/** Deterministic LCG seeded PRNG (seed 42 → reproducible output). */
class SeededRandom {
  private s: number;
  constructor(seed: number) { this.s = seed >>> 0; }

  next(): number {
    this.s = Math.imul(this.s, 1664525) + 1013904223;
    return (this.s >>> 0) / 4294967295;
  }

  /** Box-Muller normal sample. */
  normal(mu = 0, sigma = 1): number {
    const u1 = Math.max(1e-15, this.next());
    const u2 = this.next();
    const z  = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mu + sigma * z;
  }
}

/**
 * Generates 104 weeks of realistic construction material demand data.
 * Mirrors the Python `generate_sample_construction_data()` function.
 */
export function generateSampleData(): DataSeries {
  const rng = new SeededRandom(42);
  const series: DataSeries = [];
  const start  = new Date('2024-01-01');
  const base   = 500;

  for (let week = 0; week < 104; week++) {
    const date = new Date(start.getTime() + week * 7 * 86400_000);
    const weekOfYear = (week % 52) + 1;

    // Additive seasonality: peak in spring/summer (~±35 %)
    const seasonality = 1 + 0.35 * Math.sin(((weekOfYear - 10) / 52) * 2 * Math.PI);
    // Linear trend: +5 % per year
    const trend = 1 + 0.05 * (week / 52);
    // Multiplicative noise: N(1, 0.08)
    const noise = 1 + rng.normal(0, 0.08);

    const value = Math.max(0, Math.round(base * seasonality * trend * noise));
    series.push({ date: date.toISOString().split('T')[0], value });
  }

  return series;
}
