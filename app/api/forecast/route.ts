import { NextRequest, NextResponse } from 'next/server';
import { forecastES, forecastARIMA } from '@/lib/forecasting';
import type { ForecastRequest } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const body: ForecastRequest = await req.json();
    const { data, model, horizon, seasonalPeriods, arimaP, arimaD, arimaQ } = body;

    if (!data || data.length < 4) {
      return NextResponse.json({ error: 'Need at least 4 data points.' }, { status: 400 });
    }
    if (horizon < 1 || horizon > 365) {
      return NextResponse.json({ error: 'Horizon must be 1–365.' }, { status: 400 });
    }

    const result =
      model === 'arima'
        ? forecastARIMA(data, horizon, arimaP ?? 1, arimaD ?? 1, arimaQ ?? 0)
        : forecastES(data, horizon, seasonalPeriods ?? 52);

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
