import { NextRequest, NextResponse } from 'next/server';
import { calculateInventoryMetrics } from '@/lib/inventory';
import type { InventoryRequest } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const body: InventoryRequest = await req.json();
    const { data, forecast, leadTime, serviceLevel, orderingCost, holdingCost } = body;

    if (!data || data.length < 2) {
      return NextResponse.json({ error: 'Need at least 2 historical data points.' }, { status: 400 });
    }
    if (!forecast || forecast.length === 0) {
      return NextResponse.json({ error: 'Forecast data required.' }, { status: 400 });
    }
    if (leadTime < 1) {
      return NextResponse.json({ error: 'Lead time must be ≥ 1.' }, { status: 400 });
    }

    const result = calculateInventoryMetrics(
      data,
      forecast,
      leadTime,
      serviceLevel,
      orderingCost,
      holdingCost,
    );

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
