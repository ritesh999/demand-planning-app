"""
Tests for forecasting functions in the Demand Planning app.

These tests verify that the exponential smoothing forecast returns a
Series of the expected length and that it aligns with the requested
forecast horizon.  The goal is not to validate the statistical
performance of the model but to ensure that the function operates
without errors on small datasets.
"""

import pandas as pd

from demand_planning_app import prepare_time_series, forecast_exponential_smoothing


def test_exponential_smoothing_forecast_length():
    """Ensure the forecast length matches the horizon."""
    # Create a weekly series with a trend
    dates = pd.date_range(start="2025-01-01", periods=20, freq="W")
    demand = pd.Series(range(20), index=dates)
    series = prepare_time_series(
        pd.DataFrame({"date": dates, "demand": demand}), "date", "demand", agg_func="sum"
    )
    horizon = 4
    forecast, fitted = forecast_exponential_smoothing(series, forecast_horizon=horizon)
    # Forecast should have the requested number of periods
    assert len(forecast) == horizon
    # Fitted values should have the same length as the historical series
    assert len(fitted) == len(series)