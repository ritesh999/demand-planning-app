"""
Tests for the prepare_time_series helper function.

These tests ensure that the prepare_time_series function parses dates
correctly, handles aggregation and missing values, infers a reasonable
frequency, and returns a Pandas Series with a datetime index.
"""

import pandas as pd

from demand_planning_app import prepare_time_series


def test_prepare_time_series_defaults():
    """Prepare a simple series and verify its properties."""
    data = pd.DataFrame(
        {
            "date": ["2025-01-01", "2025-01-02", "2025-01-04", "2025-01-04"],
            "demand": [10, 12, 8, 7],
        }
    )
    series = prepare_time_series(data, "date", "demand", agg_func="sum")
    # Index should be datetime
    assert isinstance(series.index, pd.DatetimeIndex)
    # The frequency should be daily (1D) inferred and missing dates filled
    assert series.index.freq == pd.offsets.Day()
    # Aggregation: value for 2025-01-04 should combine two rows (8 + 7)
    assert series.loc[pd.Timestamp("2025-01-04")] == 15
    # Missing date 2025-01-03 should be filled by forward fill (value 12)
    assert series.loc[pd.Timestamp("2025-01-03")] == 12