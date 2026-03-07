import type { DataSeries, InventoryMetrics } from './types';
import { mean, stdDev, normInvCDF } from './utils';

export function calculateInventoryMetrics(
  historical: DataSeries,
  forecast:   DataSeries,
  leadTime:   number,
  serviceLevel: number,
  orderingCost?: number,
  holdingCost?:  number,
): InventoryMetrics {
  const histVals = historical.map(d => d.value);
  const fcstVals = forecast.slice(0, leadTime).map(d => d.value);

  const avgDemand       = mean(histVals);
  const sigma           = stdDev(histVals);
  const zScore          = normInvCDF(Math.min(0.9999, Math.max(0.5001, serviceLevel)));
  const safetyStock     = zScore * sigma * Math.sqrt(leadTime);
  const demandDuringLead = fcstVals.length > 0
    ? fcstVals.reduce((a, b) => a + b, 0)
    : avgDemand * leadTime;
  const reorderPoint    = demandDuringLead + safetyStock;

  const result: InventoryMetrics = {
    averageDemand: avgDemand,
    demandDuringLead,
    sigma,
    zScore,
    safetyStock,
    reorderPoint,
  };

  if (orderingCost && holdingCost && orderingCost > 0 && holdingCost > 0) {
    const annualDemand = avgDemand * 52; // weekly series → 52 weeks/year
    result.eoq = Math.sqrt((2 * annualDemand * orderingCost) / holdingCost);
  }

  return result;
}
