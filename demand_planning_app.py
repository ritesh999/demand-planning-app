"""
Demand Planning Application for the Construction Consulting domain
================================================================

This Streamlit application helps planners in the construction
industry forecast demand, optimize inventory levels and allocate
resources more effectively.  It was designed to be easy to use
while remaining flexible enough to integrate with existing supply
chain systems.

Key features
------------

* **Data ingestion** – Users can upload CSV files directly through
  the web interface or configure a connection to an external
  database.  The application reads the data into a Pandas
  DataFrame and provides a quick preview so that planners can
  verify the contents.  (Connecting to remote systems should
  always be done using environment variables or secrets to avoid
  exposing credentials in source code.)

* **Exploratory charts** – After loading the data, the app
  produces interactive line charts showing historical demand.
  Inspecting trends and seasonality helps planners understand the
  underlying patterns before producing a forecast.  Plotly is
  used for plotting so that charts can be zoomed and exported.

* **Demand forecasting** – The application offers two models
  implemented with ``statsmodels``:

  - **Exponential smoothing** for quick baseline forecasts with
    optional trend and seasonality.
  - **ARIMA (Auto-Regressive Integrated Moving Average)** for more
    sophisticated time-series modelling when underlying patterns
    require differencing.  ARIMA results include 95% confidence
    intervals shown as a shaded band on the chart.

  Users choose the model, select the column representing dates and
  the column representing demand, and specify a forecast horizon.
  Forecast results and confidence intervals are displayed.

* **Forecast accuracy** – After fitting, the app reports Mean
  Absolute Error (MAE), Root Mean Squared Error (RMSE) and Mean
  Absolute Percentage Error (MAPE) computed against the
  in-sample fitted values.  These metrics help planners assess
  model quality before committing to a forecast.

* **Inventory optimisation** – Once a demand forecast exists, the
  app can compute safety stock and reorder points.  Safety stock
  is calculated using the standard deviation of historical demand,
  the chosen service level and lead time.  The reorder point is
  the sum of expected demand during the lead time and safety stock.
  Optionally the user can enter ordering and holding costs to
  estimate an Economic Order Quantity (EOQ).  These metrics enable
  planners to reduce stock-outs and overstock situations.

* **Construction-specific context** – The app recognises common
  construction material columns (steel, concrete, lumber, etc.)
  and surfaces category-level summaries on the dashboard.

* **Real-time analytics** – The app monitors the uploaded data
  during each run and updates charts and calculations whenever
  inputs change.  Planners can repeatedly upload updated
  datasets or adjust modelling parameters to see the impact
  immediately without restarting the app.

* **Security and integration** – Data transmitted between the
  browser and backend travels over HTTPS when deployed behind
  Streamlit's cloud or any TLS-enabled web server.  Sensitive
  credentials (for example database passwords) should be
  provided via environment variables.

Usage
-----

Run this script with Streamlit:

```
streamlit run demand_planning_app.py
```

If running behind a corporate firewall or container orchestrator,
expose the appropriate port (the default is 8501) and configure
TLS termination at your load balancer.  To connect to an external
database, set a ``DATABASE_URL`` environment variable with the
connection string (including ``sslmode=require`` for encrypted
connections) and uncomment the relevant code section in
``load_data_from_database``.
"""

import io
import os
import random
from datetime import datetime, timedelta
from math import sqrt
from typing import Optional, Tuple

import numpy as np
import pandas as pd
import plotly.graph_objects as go
import streamlit as st
from scipy.stats import norm
from statsmodels.tsa.arima.model import ARIMA
from statsmodels.tsa.holtwinters import ExponentialSmoothing

# -----------------------------------------------------------------------------
# UI/UX configuration
#
st.set_page_config(page_title="Demand Planning Application", page_icon="📈", layout="wide")

# Construction material categories used for dashboard filtering
CONSTRUCTION_MATERIALS = [
    "Concrete", "Steel", "Lumber", "Rebar", "Bricks",
    "Electrical", "Plumbing", "Insulation", "Glass", "Aggregate",
]


# -----------------------------------------------------------------------------
# Data loading helpers
# -----------------------------------------------------------------------------

def load_data_from_upload() -> Optional[pd.DataFrame]:
    """Load a CSV or Excel file uploaded by the user.

    Returns
    -------
    pandas.DataFrame or ``None``
        Parsed tabular data when a file is provided, otherwise ``None``.
    """
    uploaded_file = st.file_uploader(
        "Upload a CSV or Excel file containing your demand history",
        type=["csv", "xlsx", "xls"],
        help=(
            "The file should contain at least a date column and a demand column. "
            "Additional columns (e.g. material category, project, region) are welcome."
        ),
    )
    if uploaded_file is None:
        return None
    filename = uploaded_file.name.lower()
    try:
        if filename.endswith(('.csv', '.tsv')):
            data = pd.read_csv(uploaded_file)
        elif filename.endswith(('.xlsx', '.xls')):
            data = pd.read_excel(uploaded_file)
        else:
            st.error("Unsupported file type. Please upload a CSV or Excel file.")
            return None
    except Exception as e:
        st.error(f"Failed to read file: {e}")
        return None
    return data


def load_data_from_database() -> Optional[pd.DataFrame]:
    """Load data from a database configured via the DATABASE_URL environment variable.

    Returns ``None`` when the environment variable is not set.
    """
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        return None
    # Example code (commented out to avoid errors when the driver is absent)
    # from sqlalchemy import create_engine
    # engine = create_engine(database_url, connect_args={"sslmode": "require"})
    # with engine.connect() as conn:
    #     return pd.read_sql("SELECT * FROM demand_table", conn)
    return None


def generate_sample_construction_data() -> pd.DataFrame:
    """Generate a realistic sample dataset for construction material demand.

    Creates 2 years of weekly demand data for common construction materials
    with trend, seasonality, and random noise — useful for demos.
    """
    random.seed(42)
    np.random.seed(42)
    weeks = pd.date_range(start="2023-01-02", periods=104, freq="W-MON")
    materials = ["Concrete (m³)", "Steel (tonnes)", "Lumber (board-ft)", "Rebar (tonnes)", "Bricks (units)"]
    records = []
    base_demand = {"Concrete (m³)": 500, "Steel (tonnes)": 80, "Lumber (board-ft)": 12000,
                   "Rebar (tonnes)": 40, "Bricks (units)": 25000}
    for week in weeks:
        # Construction is highly seasonal: peaks in spring/summer (Q2-Q3)
        month = week.month
        seasonal_factor = 1.0 + 0.35 * np.sin((month - 3) * np.pi / 6)
        # Gradual upward trend (5% annual growth)
        week_index = (week - weeks[0]).days / 365
        trend_factor = 1.0 + 0.05 * week_index
        for material in materials:
            base = base_demand[material]
            demand = base * seasonal_factor * trend_factor * (1 + np.random.normal(0, 0.08))
            demand = max(0, round(demand, 1))
            records.append({"Date": week, "Material": material, "Demand": demand,
                            "Project": random.choice(["Highway A1", "Bridge Overpass", "Commercial Block", "Residential"]),
                            "Region": random.choice(["North", "South", "East", "West"])})
    return pd.DataFrame(records)


# -----------------------------------------------------------------------------
# Time-series preparation
# -----------------------------------------------------------------------------

@st.cache_data(show_spinner=False)
def prepare_time_series(
    data: pd.DataFrame, date_col: str, demand_col: str, agg_func: str = "sum"
) -> pd.Series:
    """Prepare a pandas Series indexed by datetime for modelling.

    Groups data by the selected date column, sorts, infers frequency and
    forward-fills any gaps.

    Args:
        data: The raw DataFrame.
        date_col: Name of the column containing date information.
        demand_col: Name of the column containing demand values.
        agg_func: Aggregation function — 'sum' or 'mean'.

    Returns:
        A pandas Series with datetime index and numeric values.
    """
    df = data.copy()
    df[date_col] = pd.to_datetime(df[date_col], errors="coerce")
    df = df.dropna(subset=[date_col, demand_col])
    if agg_func == "sum":
        series = df.groupby(date_col)[demand_col].sum()
    else:
        series = df.groupby(date_col)[demand_col].mean()
    series = series.sort_index()
    if hasattr(series.index, "inferred_freq") and series.index.inferred_freq:
        freq = series.index.inferred_freq
    else:
        diffs = series.index.to_series().diff().dropna().dt.days
        if not diffs.empty:
            mode = diffs.mode()[0]
            freq = f"{int(mode)}D"
        else:
            freq = "D"
    series = series.asfreq(freq, method="ffill")
    return series


# -----------------------------------------------------------------------------
# Forecasting models
# -----------------------------------------------------------------------------

def forecast_exponential_smoothing(
    series: pd.Series, forecast_horizon: int, seasonal_periods: Optional[int] = None
) -> Tuple[pd.Series, pd.Series]:
    """Produce a forecast using Exponential Smoothing (Holt-Winters).

    Returns the forecast and fitted values.
    """
    try:
        model = ExponentialSmoothing(
            series,
            trend="add",
            seasonal="add" if seasonal_periods else None,
            seasonal_periods=seasonal_periods,
        ).fit()
    except Exception as e:
        st.error(f"Exponential Smoothing failed: {e}")
        raise
    forecast_index = pd.date_range(
        start=series.index[-1] + series.index.freq,
        periods=forecast_horizon,
        freq=series.index.freq,
    )
    forecast = model.forecast(forecast_horizon)
    forecast.index = forecast_index
    fitted = model.fittedvalues
    return forecast, fitted


def forecast_arima(
    series: pd.Series,
    forecast_horizon: int,
    order: Tuple[int, int, int] = (1, 1, 0),
) -> Tuple[pd.Series, pd.Series, Optional[pd.DataFrame]]:
    """Produce a forecast using an ARIMA model.

    Returns a 3-tuple: (forecast, fitted, conf_int).
    ``conf_int`` is a DataFrame with columns ``lower`` and ``upper``
    representing the 95% confidence interval.
    """
    try:
        model = ARIMA(series, order=order)
        model_fit = model.fit()
    except Exception as e:
        st.error(f"ARIMA model failed: {e}")
        raise
    forecast_result = model_fit.get_forecast(steps=forecast_horizon)
    forecast_index = pd.date_range(
        start=series.index[-1] + series.index.freq,
        periods=forecast_horizon,
        freq=series.index.freq,
    )
    forecast = pd.Series(forecast_result.predicted_mean.values, index=forecast_index)
    fitted = model_fit.fittedvalues
    raw_ci = forecast_result.conf_int(alpha=0.05)
    conf_int = pd.DataFrame(
        {"lower": raw_ci.iloc[:, 0].values, "upper": raw_ci.iloc[:, 1].values},
        index=forecast_index,
    )
    return forecast, fitted, conf_int


# -----------------------------------------------------------------------------
# Accuracy metrics
# -----------------------------------------------------------------------------

def calculate_accuracy_metrics(series: pd.Series, fitted: pd.Series) -> dict:
    """Compute in-sample forecast accuracy metrics.

    Args:
        series: Actual historical demand.
        fitted: Model fitted values aligned to the same index.

    Returns:
        Dictionary with ``mae``, ``rmse`` and ``mape`` (percent).
    """
    actual = series.values
    pred = fitted.reindex(series.index).values
    mask = ~np.isnan(actual) & ~np.isnan(pred)
    actual, pred = actual[mask], pred[mask]
    mae = np.mean(np.abs(actual - pred))
    rmse = np.sqrt(np.mean((actual - pred) ** 2))
    nonzero = actual != 0
    mape = np.mean(np.abs((actual[nonzero] - pred[nonzero]) / actual[nonzero])) * 100 if nonzero.any() else np.nan
    return {"mae": mae, "rmse": rmse, "mape": mape}


# -----------------------------------------------------------------------------
# Inventory optimisation
# -----------------------------------------------------------------------------

def calculate_inventory_metrics(
    series: pd.Series,
    forecast: pd.Series,
    lead_time: int,
    service_level: float,
    ordering_cost: Optional[float] = None,
    holding_cost: Optional[float] = None,
) -> dict:
    """Calculate safety stock, reorder point and optional EOQ.

    Args:
        series: Historical demand series.
        forecast: Forecasted demand series (at least ``lead_time`` periods).
        lead_time: Lead time in periods matching the series frequency.
        service_level: Desired service level as a fraction (e.g. 0.95).
        ordering_cost: Fixed cost per order (optional).
        holding_cost: Annual holding cost per unit (optional).

    Returns:
        Dictionary with ``average_demand``, ``demand_during_lead``,
        ``sigma``, ``z_score``, ``safety_stock``, ``reorder_point``
        and optionally ``eoq``.
    """
    avg_demand = series.mean()
    demand_during_lead = forecast.iloc[:lead_time].sum()
    sigma = series.std()
    z_score = norm.ppf(service_level)
    safety_stock = z_score * sigma * sqrt(lead_time)
    reorder_point = demand_during_lead + safety_stock
    metrics = {
        "average_demand": avg_demand,
        "demand_during_lead": demand_during_lead,
        "sigma": sigma,
        "z_score": z_score,
        "safety_stock": safety_stock,
        "reorder_point": reorder_point,
    }
    if ordering_cost and holding_cost and avg_demand > 0 and holding_cost > 0:
        annual_demand = avg_demand * 365
        eoq = sqrt((2 * annual_demand * ordering_cost) / holding_cost)
        metrics["eoq"] = eoq
    return metrics


# -----------------------------------------------------------------------------
# Chart rendering
# -----------------------------------------------------------------------------

def render_forecast_chart(
    series: pd.Series,
    fitted: pd.Series,
    forecast: pd.Series,
    title: str,
    conf_int: Optional[pd.DataFrame] = None,
) -> None:
    """Render an interactive Plotly chart of historical and forecasted demand.

    Args:
        series: Historical demand series.
        fitted: In-sample fitted values.
        forecast: Forecast series.
        title: Chart title.
        conf_int: Optional DataFrame with 'lower' and 'upper' columns for
            ARIMA confidence intervals.
    """
    fig = go.Figure()

    # Historical demand
    fig.add_trace(go.Scatter(
        x=series.index, y=series.values,
        mode="lines", name="Historical Demand",
        line=dict(color="#1f77b4", width=2),
    ))

    # Fitted values
    fitted_aligned = fitted.reindex(series.index)
    fig.add_trace(go.Scatter(
        x=fitted_aligned.index, y=fitted_aligned.values,
        mode="lines", name="Fitted",
        line=dict(color="#ff7f0e", width=1.5, dash="dot"),
    ))

    # Confidence interval band (ARIMA only)
    if conf_int is not None:
        fig.add_trace(go.Scatter(
            x=list(conf_int.index) + list(conf_int.index[::-1]),
            y=list(conf_int["upper"]) + list(conf_int["lower"][::-1]),
            fill="toself",
            fillcolor="rgba(255, 127, 14, 0.15)",
            line=dict(color="rgba(255, 255, 255, 0)"),
            name="95% Confidence Interval",
        ))

    # Forecast line
    fig.add_trace(go.Scatter(
        x=forecast.index, y=forecast.values,
        mode="lines", name="Forecast",
        line=dict(color="#d62728", width=2.5),
    ))

    # Forecast horizon shading
    fig.add_vrect(
        x0=forecast.index[0], x1=forecast.index[-1],
        fillcolor="LightSalmon", opacity=0.12, line_width=0,
        annotation_text="Forecast horizon", annotation_position="top left",
    )

    fig.update_layout(
        title=title,
        xaxis_title="Date",
        yaxis_title="Demand",
        hovermode="x unified",
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
    )
    st.plotly_chart(fig, use_container_width=True)


# -----------------------------------------------------------------------------
# Main application
# -----------------------------------------------------------------------------

def main() -> None:
    st.title("📈 Demand Planning for Construction")
    st.markdown(
        "Forecast material demand, optimise inventory levels and allocate resources "
        "for construction projects. Use the sidebar to navigate between sections."
    )

    st.sidebar.header("Navigation")
    section = st.sidebar.radio(
        "Go to", [
            "Dashboard",
            "Data Upload",
            "Forecasting",
            "Inventory Optimisation",
            "About",
        ]
    )

    data: Optional[pd.DataFrame] = st.session_state.get("data")
    series: Optional[pd.Series] = st.session_state.get("series")
    forecast: Optional[pd.Series] = st.session_state.get("forecast")
    fitted: Optional[pd.Series] = st.session_state.get("fitted")
    conf_int: Optional[pd.DataFrame] = st.session_state.get("conf_int")

    # -------------------------------------------------------------------------
    # Dashboard
    # -------------------------------------------------------------------------
    if section == "Dashboard":
        st.header("Overview Dashboard")
        if data is None:
            st.info(
                "No dataset loaded. Upload data in the **Data Upload** section to see your demand overview. "
                "You can also generate a sample construction dataset from that section."
            )
        else:
            # Top-level KPI metrics
            numeric_cols = data.select_dtypes(include=[np.number]).columns.tolist()
            date_candidates = [
                c for c in data.columns
                if "date" in c.lower() or data[c].dtype == "datetime64[ns]"
            ]

            col1, col2, col3, col4 = st.columns(4)
            col1.metric("Rows", f"{data.shape[0]:,}")
            col2.metric("Columns", f"{data.shape[1]:,}")
            col3.metric("Numeric Columns", f"{len(numeric_cols)}")

            # Show date range if detectable
            if date_candidates:
                dc = date_candidates[0]
                try:
                    parsed = pd.to_datetime(data[dc], errors="coerce").dropna()
                    col4.metric("Date Range", f"{parsed.min().date()} → {parsed.max().date()}")
                except Exception:
                    pass

            # Per-material totals if a category column exists
            category_candidates = [
                c for c in data.columns
                if any(kw in c.lower() for kw in ["material", "category", "type", "item"])
            ]
            if category_candidates and numeric_cols:
                cat_col = category_candidates[0]
                demand_col = numeric_cols[0]
                st.subheader(f"Demand by {cat_col}")
                cat_summary = (
                    data.groupby(cat_col)[demand_col]
                    .sum()
                    .sort_values(ascending=False)
                    .reset_index()
                )
                cat_summary.columns = [cat_col, "Total Demand"]
                import plotly.express as px
                bar_fig = px.bar(
                    cat_summary, x=cat_col, y="Total Demand",
                    title=f"Total Demand by {cat_col}",
                    color="Total Demand", color_continuous_scale="Blues",
                )
                st.plotly_chart(bar_fig, use_container_width=True)

            # Historical trend line
            if date_candidates and numeric_cols:
                date_col = date_candidates[0]
                demand_col = numeric_cols[0]
                try:
                    df = data[[date_col, demand_col]].copy()
                    df[date_col] = pd.to_datetime(df[date_col], errors="coerce")
                    df = df.dropna()
                    df_grouped = df.groupby(date_col)[demand_col].sum().reset_index()

                    # Compute simple trend (first vs last quarter)
                    if len(df_grouped) >= 8:
                        n = len(df_grouped)
                        q1_avg = df_grouped[demand_col].iloc[: n // 4].mean()
                        q4_avg = df_grouped[demand_col].iloc[-n // 4 :].mean()
                        trend_pct = ((q4_avg - q1_avg) / q1_avg * 100) if q1_avg else 0
                        peak_row = df_grouped.loc[df_grouped[demand_col].idxmax()]
                        st.markdown("---")
                        m1, m2 = st.columns(2)
                        m1.metric(
                            "Trend (first vs last quarter)",
                            f"{trend_pct:+.1f}%",
                            delta=f"{trend_pct:+.1f}%",
                        )
                        m2.metric(
                            "Peak Demand",
                            f"{peak_row[demand_col]:,.0f}",
                            f"on {pd.Timestamp(peak_row[date_col]).date()}",
                        )

                    import plotly.express as px
                    line_fig = px.line(
                        df_grouped, x=date_col, y=demand_col,
                        title="Historical Demand Trend",
                        labels={date_col: "Date", demand_col: "Demand"},
                    )
                    line_fig.update_traces(line_color="#1f77b4")
                    st.plotly_chart(line_fig, use_container_width=True)
                except Exception:
                    st.info("Unable to auto-detect date and demand columns for plotting.")
            else:
                st.info("Ensure your dataset has a date column and at least one numeric column.")

            with st.expander("Preview data", expanded=False):
                st.dataframe(data.head(20))

    # -------------------------------------------------------------------------
    # Data Upload
    # -------------------------------------------------------------------------
    elif section == "Data Upload":
        st.header("Upload Data")
        st.markdown(
            "Upload a CSV or Excel file with your demand history, or generate a sample "
            "construction dataset to explore the app's features."
        )

        tab_upload, tab_sample = st.tabs(["Upload File", "Generate Sample Data"])

        with tab_upload:
            uploaded_data = load_data_from_upload()
            db_data = load_data_from_database()
            if db_data is not None:
                st.success("Data loaded from database.")
                data = db_data
            elif uploaded_data is not None:
                st.success("File uploaded successfully.")
                data = uploaded_data
            else:
                st.info("Awaiting data upload or database configuration.")

            if data is not None:
                st.session_state["data"] = data
                st.write(f"Dataset: **{len(data):,} rows × {data.shape[1]} columns**")
                st.dataframe(data.head())

        with tab_sample:
            st.markdown(
                "Click below to load a pre-built sample dataset containing 2 years of weekly "
                "construction material demand (concrete, steel, lumber, rebar, bricks) with "
                "realistic seasonality and a growth trend."
            )
            if st.button("Load Sample Construction Dataset"):
                sample_df = generate_sample_construction_data()
                st.session_state["data"] = sample_df
                st.success(f"Sample dataset loaded: {len(sample_df):,} rows.")
                st.dataframe(sample_df.head(10))

    # -------------------------------------------------------------------------
    # Forecasting
    # -------------------------------------------------------------------------
    elif section == "Forecasting":
        st.header("Demand Forecasting")
        if data is None:
            st.warning("Please upload your dataset first in the **Data Upload** section.")
        else:
            with st.form("forecast_form"):
                st.subheader("Model Configuration")

                # Pre-select sensible defaults for construction data
                date_candidates = [c for c in data.columns if "date" in c.lower()]
                default_date_idx = 0 if not date_candidates else list(data.columns).index(date_candidates[0])
                numeric_cols = data.select_dtypes(include=[np.number]).columns.tolist()
                default_demand_idx = 0 if not numeric_cols else list(data.columns).index(numeric_cols[0])

                col_a, col_b = st.columns(2)
                with col_a:
                    date_col = st.selectbox("Date column", options=list(data.columns), index=default_date_idx)
                    demand_col = st.selectbox("Demand column", options=list(data.columns), index=default_demand_idx)
                    agg_func = st.selectbox("Aggregation", options=["sum", "mean"], index=0)
                with col_b:
                    model_type = st.selectbox("Model type", options=["Exponential Smoothing", "ARIMA"], index=0)
                    forecast_horizon = st.number_input(
                        "Forecast horizon (periods)", min_value=1, max_value=365, value=12,
                        help="Number of periods ahead to forecast (e.g. 12 weeks)"
                    )
                    seasonal_periods = st.number_input(
                        "Seasonal periods (0 = none)", min_value=0, max_value=365, value=52,
                        help="52 for annual seasonality on weekly data, 12 for monthly data"
                    )

                st.markdown("**ARIMA parameters** *(only used when ARIMA is selected)*")
                c1, c2, c3 = st.columns(3)
                arima_p = c1.number_input("p (autoregressive)", min_value=0, max_value=5, value=1)
                arima_d = c2.number_input("d (differencing)", min_value=0, max_value=2, value=1)
                arima_q = c3.number_input("q (moving average)", min_value=0, max_value=5, value=0)

                submitted = st.form_submit_button("▶ Run Forecast")

            if submitted:
                series = prepare_time_series(data, date_col, demand_col, agg_func)
                st.session_state["series"] = series
                st.session_state["conf_int"] = None  # reset

                try:
                    if model_type == "Exponential Smoothing":
                        s_periods = int(seasonal_periods) if seasonal_periods > 0 else None
                        forecast, fitted = forecast_exponential_smoothing(
                            series, int(forecast_horizon), s_periods
                        )
                        ci = None
                    else:
                        order = (int(arima_p), int(arima_d), int(arima_q))
                        forecast, fitted, ci = forecast_arima(series, int(forecast_horizon), order)

                    st.session_state["forecast"] = forecast
                    st.session_state["fitted"] = fitted
                    st.session_state["conf_int"] = ci

                    st.success("Forecast completed.")

                    # Accuracy metrics
                    accuracy = calculate_accuracy_metrics(series, fitted)
                    st.subheader("In-Sample Accuracy")
                    a1, a2, a3 = st.columns(3)
                    a1.metric("MAE", f"{accuracy['mae']:,.2f}")
                    a2.metric("RMSE", f"{accuracy['rmse']:,.2f}")
                    mape_label = f"{accuracy['mape']:.1f}%" if not np.isnan(accuracy['mape']) else "N/A"
                    a3.metric("MAPE", mape_label)

                    render_forecast_chart(
                        series, fitted, forecast,
                        title="Historical and Forecasted Demand",
                        conf_int=ci,
                    )

                    # Forecast table + download
                    st.subheader("Forecast Values")
                    forecast_df = forecast.reset_index()
                    forecast_df.columns = ["Date", "Forecast"]
                    forecast_df["Forecast"] = forecast_df["Forecast"].round(2)
                    if ci is not None:
                        forecast_df["Lower 95%"] = ci["lower"].values.round(2)
                        forecast_df["Upper 95%"] = ci["upper"].values.round(2)
                    st.dataframe(forecast_df, use_container_width=True)

                    csv_bytes = forecast_df.to_csv(index=False).encode()
                    st.download_button(
                        label="⬇ Download forecast as CSV",
                        data=csv_bytes,
                        file_name="demand_forecast.csv",
                        mime="text/csv",
                    )

                except Exception as e:
                    st.error(f"An error occurred during forecasting: {e}")

    # -------------------------------------------------------------------------
    # Inventory Optimisation
    # -------------------------------------------------------------------------
    elif section == "Inventory Optimisation":
        st.header("Inventory Optimisation")
        if series is None or forecast is None:
            st.warning("Please run a forecast first in the **Forecasting** section.")
        else:
            with st.form("inventory_form"):
                st.subheader("Inventory Parameters")
                col_l, col_r = st.columns(2)
                with col_l:
                    lead_time = st.number_input(
                        "Lead time (periods, same frequency as data)",
                        min_value=1, max_value=len(forecast), value=4,
                        help="Periods between placing an order and receiving stock. "
                             "For weekly data, 4 = one month."
                    )
                    service_level_percent = st.slider(
                        "Desired service level (%)",
                        min_value=50, max_value=99, value=95,
                        help="Probability of not stocking out during lead time"
                    )
                with col_r:
                    ordering_cost = st.number_input(
                        "Ordering cost per order (£/$ optional)",
                        min_value=0.0, value=0.0
                    )
                    holding_cost = st.number_input(
                        "Holding cost per unit per year (£/$ optional)",
                        min_value=0.0, value=0.0
                    )
                submitted_inv = st.form_submit_button("Calculate Inventory Metrics")

            if submitted_inv:
                service_level = service_level_percent / 100.0
                metrics = calculate_inventory_metrics(
                    series, forecast, int(lead_time), service_level,
                    ordering_cost if ordering_cost > 0 else None,
                    holding_cost if holding_cost > 0 else None,
                )
                st.success("Inventory metrics calculated.")

                # Key metric cards
                m1, m2, m3 = st.columns(3)
                m1.metric("Safety Stock", f"{metrics['safety_stock']:,.1f} units")
                m2.metric("Reorder Point", f"{metrics['reorder_point']:,.1f} units")
                m3.metric("Avg Demand / Period", f"{metrics['average_demand']:,.1f} units")

                # Full results table
                st.subheader("Full Metrics")
                metric_labels = {
                    "average_demand": "Average demand per period",
                    "demand_during_lead": "Expected demand during lead time",
                    "sigma": "Std deviation of demand",
                    "z_score": "Z-score",
                    "safety_stock": "Safety stock",
                    "reorder_point": "Reorder point",
                    "eoq": "Economic Order Quantity (EOQ)",
                }
                results = []
                for key, value in metrics.items():
                    if value is None or (isinstance(value, float) and np.isnan(value)):
                        continue
                    results.append({
                        "Metric": metric_labels.get(key, key),
                        "Value": round(float(value), 2),
                    })
                st.table(pd.DataFrame(results))

                st.info(
                    "**Reorder Point**: place a new order when stock falls to this level.  \n"
                    "**Safety Stock**: buffer against demand variability and supply delays.  \n"
                    "**EOQ** (if costs provided): optimal order quantity minimising total ordering "
                    "and holding costs using the classic Wilson formula."
                )

                # Download inventory report
                inv_df = pd.DataFrame(results)
                st.download_button(
                    label="⬇ Download inventory report as CSV",
                    data=inv_df.to_csv(index=False).encode(),
                    file_name="inventory_metrics.csv",
                    mime="text/csv",
                )

    # -------------------------------------------------------------------------
    # About
    # -------------------------------------------------------------------------
    elif section == "About":
        st.header("About this Application")
        st.markdown(
            "This demand planning tool was built to demonstrate how Python and Streamlit "
            "can power data-driven applications for construction supply chain management.\n\n"
            "**What is demand planning?**  \n"
            "Demand planning is the supply chain process of forecasting future product or "
            "service demand so that materials can be procured and delivered on time. "
            "In construction, accurate forecasting of materials such as concrete, steel and "
            "lumber reduces costly project delays, prevents overstock tying up capital, and "
            "keeps site logistics running smoothly.\n\n"
            "**Why it matters for construction?**  \n"
            "Construction demand is inherently seasonal — activity peaks in spring and summer "
            "in most regions — and subject to project-specific spikes. Poor forecasts lead "
            "to stockouts that halt work or surplus that inflates storage costs. "
            "The models in this app (Exponential Smoothing and ARIMA) are well-established "
            "in the operations research literature and are well-suited to these patterns."
        )
        st.markdown("---")
        st.markdown(
            "**Security best practices**  \n"
            "- Always deploy behind HTTPS/TLS to protect data in transit.  \n"
            "- Store database credentials and API keys in environment variables, never in code.  \n"
            "- Apply role-based access control (RBAC) so only authorised users can access "
            "sensitive demand and inventory data.  \n"
            "- Enable multi-factor authentication on your hosting platform.  \n"
            "- Audit logs of data uploads and exports where regulations require it."
        )
        st.markdown("---")
        st.markdown(
            "**Deployment guidance**  \n"
            "Deploy on Streamlit Community Cloud (free for public apps), AWS, GCP, Azure, or "
            "Snowflake (enterprise with private app support). "
            "Set up a CI/CD pipeline (see `.github/workflows/ci.yml`) to automate testing on "
            "every pull request.  \n\n"
            "**Version**: 0.4.0  \n"
            "**Tech stack**: Python · Streamlit · pandas · statsmodels · Plotly · scipy"
        )


if __name__ == "__main__":
    main()
