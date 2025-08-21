"""
Unit tests for inventory metric calculations in the Demand Planning app.

This module tests the ``calculate_inventory_metrics`` function using small,
synthetic datasets to verify that safety stock and reorder point values
follow the expected mathematical formulas.  If additional metrics such
as EOQ are provided, those values are also asserted.  Running these
tests helps ensure that future refactors do not inadvertently change
the behaviour of the inventory calculations.
"""

from math import sqrt

import numpy as np
import pandas as pd
import pytest

from demand_planning_app import calculate_inventory_metrics


def test_basic_inventory_metrics():
    """Check safety stock and reorder point for a simple daily series."""
    # Create a simple series with constant demand (10 units per day)
    dates = pd.date_range(start="2025-01-01", periods=30, freq="D")
    series = pd.Series(10, index=dates)
    # Forecast predicts the same constant demand into the future
    forecast = pd.Series(10, index=pd.date_range(start=dates[-1] + pd.Timedelta(days=1), periods=7, freq="D"))
    # Lead time of 3 days and 95% service level
    lead_time = 3
    service_level = 0.95
    metrics = calculate_inventory_metrics(series, forecast, lead_time, service_level)
    # Average demand should equal the constant value
    assert metrics["average_demand"] == 10
    # Demand during lead time is forecast demand * lead_time
    assert metrics["demand_during_lead"] == pytest.approx(10 * lead_time)
    # Standard deviation for constant series is zero
    assert metrics["sigma"] == 0
    # Safety stock should be zero when sigma is zero
    assert metrics["safety_stock"] == 0
    # Reorder point reduces to demand during lead time
    assert metrics["reorder_point"] == metrics["demand_during_lead"]


def test_eoq_calculation():
    """Verify that EOQ is computed when ordering and holding costs are provided."""
    dates = pd.date_range(start="2025-01-01", periods=30, freq="D")
    # Demand gradually increases over time
    demand_values = np.linspace(50, 100, len(dates))
    series = pd.Series(demand_values, index=dates)
    forecast = pd.Series(75, index=pd.date_range(start=dates[-1] + pd.Timedelta(days=1), periods=5, freq="D"))
    lead_time = 2
    service_level = 0.9
    ordering_cost = 100
    holding_cost = 5
    metrics = calculate_inventory_metrics(series, forecast, lead_time, service_level, ordering_cost, holding_cost)
    # EOQ should exist in the returned metrics
    assert "eoq" in metrics
    # Basic sanity check: EOQ should be positive and larger than zero
    assert metrics["eoq"] > 0