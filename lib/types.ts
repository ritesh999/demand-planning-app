export interface DataPoint {
  date: string;
  value: number;
}

export type DataSeries = DataPoint[];

export interface AccuracyMetrics {
  mae: number;
  rmse: number;
  mape: number;
}

export interface ForecastResult {
  historical: DataSeries;
  fitted: DataSeries;
  forecast: DataSeries;
  confidenceLower?: DataSeries;
  confidenceUpper?: DataSeries;
  metrics: AccuracyMetrics;
  model: 'exponential_smoothing' | 'arima';
}

export interface InventoryMetrics {
  averageDemand: number;
  demandDuringLead: number;
  sigma: number;
  zScore: number;
  safetyStock: number;
  reorderPoint: number;
  eoq?: number;
}

export interface ForecastRequest {
  data: DataSeries;
  model: 'exponential_smoothing' | 'arima';
  horizon: number;
  seasonalPeriods: number;
  arimaP: number;
  arimaD: number;
  arimaQ: number;
}

export interface InventoryRequest {
  data: DataSeries;
  forecast: DataSeries;
  leadTime: number;
  serviceLevel: number;
  orderingCost?: number;
  holdingCost?: number;
}

export interface CategoryDataPoint {
  category: string;
  total: number;
}
