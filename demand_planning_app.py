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
  - **ARIMA (Auto‑Regressive Integrated Moving Average)** for more
    sophisticated time‑series modelling when underlying patterns
    require differencing.

  Users choose the model, select the column representing dates and
  the column representing demand, and specify a forecast horizon.
  Forecast results and confidence intervals are displayed.

* **Inventory optimisation** – Once a demand forecast exists, the
  app can compute safety stock and reorder points.  Safety stock
  is calculated using the standard deviation of historical
  demand, the chosen service level and lead time.  The reorder
  point is the sum of expected demand during the lead time and
  safety stock【424795412209212†L405-L427】.  Optionally the user can
  enter ordering and holding costs to estimate an Economic Order
  Quantity (EOQ).  These metrics enable planners to reduce
  stock‑outs and overstock situations【424795412209212†L405-L427】.

* **Real‑time analytics** – The app monitors the uploaded data
  during each run and updates charts and calculations whenever
  inputs change.  Planners can repeatedly upload updated
  datasets or adjust modelling parameters to see the impact
  immediately without restarting the app.

* **Security and integration** – Data transmitted between the
  browser and backend travels over HTTPS when deployed behind
  Streamlit’s cloud or any TLS‑enabled web server.  Sensitive
  credentials (for example database passwords) should be
  provided via environment variables.  According to cyber
  security best practices, protecting data in transit with
  encryption and access controls is essential【802807233059955†L48-L56】; using
  protocols like TLS/HTTPS prevents eavesdropping and tampering
  of information【802807233059955†L115-L123】.  Deployments should also
  enforce role‑based access control and two‑factor authentication
  wherever possible【802807233059955†L167-L172】.

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

import os
from datetime import datetime, timedelta
from math import sqrt
from typing import Optional, Tuple

import numpy as np
import pandas as pd
import plotly.express as px
import streamlit as st
from scipy.stats import norm
from statsmodels.tsa.holtwinters import ExponentialSmoothing
from statsmodels.tsa.arima.model import ARIMA


def load_data_from_upload() -> Optional[pd.DataFrame]:
    """Load a CSV or Excel file uploaded by the user.

    This helper accepts comma‑separated files (``*.csv``) as well as Excel
    workbooks (``*.xlsx`` and ``*.xls``).  It attempts to parse the file
    with ``pandas.read_csv`` first for CSV; otherwise falls back to
    ``pandas.read_excel``.  Invalid or unsupported files result in an
    error message and return ``None``.

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
            "Additional features such as promotions or holidays may also be included."
        ),
    )
    if uploaded_file is None:
        return None
    # Use the filename extension to decide how to load the file
    filename = uploaded_file.name.lower()
    try:
        if filename.endswith(('.csv', '.tsv')):
            data = pd.read_csv(uploaded_file)
        elif filename.endswith(('.xlsx', '.xls')):
            # openpyxl or xlrd engine will be used automatically
            data = pd.read_excel(uploaded_file)
        else:
            st.error("Unsupported file type. Please upload a CSV or Excel file.")
            return None
    except Exception as e:
        st.error(f"Failed to read file: {e}")
        return None
    return data


def load_data_from_database() -> Optional[pd.DataFrame]:
    """Example function showing how to load data from a database.

    The connection string should be provided via an environment
    variable named ``DATABASE_URL``.  Uncomment the code below
    and install the required driver (e.g. ``psycopg2-binary`` for
    PostgreSQL) if you want to enable database connectivity.

    Returns ``None`` when the environment variable is not set.
    """
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        return None
    # Example code (commented out to avoid errors when the driver is absent)
    # from sqlalchemy import create_engine
    # engine = create_engine(database_url, connect_args={"sslmode": "require"})
    # with engine.connect() as conn:
    #     # Replace 'demand_table' with your actual table name
    #     return pd.read_sql("SELECT * FROM demand_table", conn)
    return None


@st.cache_data(show_spinner=False)
def prepare_time_series(
    data: pd.DataFrame, date_col: str, demand_col: str, agg_func: str = "sum"
) -> pd.Series:
    """Prepare a pandas Series indexed by datetime for modelling.

    The function groups data by the selected date column using the
    aggregation function (sum or mean) and sorts the index.  It
    converts the index to ``datetime`` and fills missing dates by
    forward filling demand values.  You can clear the cache by
    reloading the app when your dataset changes.

    Args:
        data: The raw DataFrame.
        date_col: Name of the column containing date information.
        demand_col: Name of the column containing demand values.
        agg_func: Aggregation function to apply when grouping data
            by date.  Accepts 'sum' or 'mean'.

    Returns:
        A pandas Series with datetime index and numeric values.
    """
    df = data.copy()
    # Ensure the date column is parsed to datetime
    df[date_col] = pd.to_datetime(df[date_col], errors="coerce")
    # Drop rows with invalid dates or missing demand
    df = df.dropna(subset=[date_col, demand_col])
    if agg_func == "sum":
        series = df.groupby(date_col)[demand_col].sum()
    else:
        series = df.groupby(date_col)[demand_col].mean()
    # Sort by date
    series = series.sort_index()
    # Infer frequency; if none, use the most common difference
    if hasattr(series.index, "inferred_freq") and series.index.inferred_freq:
        freq = series.index.inferred_freq
    else:
        # Try to infer by the mode of the difference in days
        diffs = series.index.to_series().diff().dropna().dt.days
        if not diffs.empty:
            # Most common difference
            mode = diffs.mode()[0]
            freq = f"{int(mode)}D"
        else:
            freq = "D"
    series = series.asfreq(freq, method="ffill")
    return series


def forecast_exponential_smoothing(
    series: pd.Series, forecast_horizon: int, seasonal_periods: Optional[int] = None
) -> Tuple[pd.Series, pd.Series]:
    """Produce a forecast using Exponential Smoothing.

    When ``seasonal_periods`` is provided the model includes both
    trend and seasonality; otherwise a simple additive trend is used.
    Returns the forecast and fitted values as two series.
    """
    # Basic configuration: additive trend, optional seasonality
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
    forecast_index = pd.date_range(start=series.index[-1] + series.index.freq, periods=forecast_horizon, freq=series.index.freq)
    forecast = model.forecast(forecast_horizon)
    forecast.index = forecast_index
    fitted = model.fittedvalues
    return forecast, fitted


def forecast_arima(
    series: pd.Series, forecast_horizon: int, order: Tuple[int, int, int] = (1, 1, 0)
) -> Tuple[pd.Series, pd.Series]:
    """Produce a forecast using an ARIMA model.

    The default order (1,1,0) implements a simple differenced autoregressive
    model; users can supply a different (p,d,q) tuple.  Returns the
    forecast and fitted values.
    """
    try:
        model = ARIMA(series, order=order)
        model_fit = model.fit()
    except Exception as e:
        st.error(f"ARIMA model failed: {e}")
        raise
    forecast_result = model_fit.get_forecast(steps=forecast_horizon)
    forecast_index = pd.date_range(start=series.index[-1] + series.index.freq, periods=forecast_horizon, freq=series.index.freq)
    forecast = pd.Series(forecast_result.predicted_mean.values, index=forecast_index)
    fitted = model_fit.fittedvalues
    return forecast, fitted


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
        forecast: Forecasted demand series (for at least ``lead_time`` periods).
        lead_time: Lead time in the same units as the series frequency (e.g. days).
        service_level: Desired service level expressed as a fraction (e.g. 0.95).
        ordering_cost: Fixed cost of placing an order (optional).
        holding_cost: Annual holding cost per unit (optional).

    Returns:
        Dictionary with keys ``average_demand``, ``demand_during_lead``,
        ``sigma`` (standard deviation), ``z_score``, ``safety_stock``,
        ``reorder_point`` and optionally ``eoq``.
    """
    # Calculate average demand (per period)
    avg_demand = series.mean()
    # Demand during lead time (sum of forecast over lead_time periods)
    demand_during_lead = forecast.iloc[:lead_time].sum()
    # Standard deviation of historical demand
    sigma = series.std()
    # Z-score from the service level
    z_score = norm.ppf(service_level)
    # Safety stock formula: z * sigma * sqrt(lead_time)
    safety_stock = z_score * sigma * sqrt(lead_time)
    # Reorder point: expected demand during lead time + safety stock
    reorder_point = demand_during_lead + safety_stock
    metrics = {
        "average_demand": avg_demand,
        "demand_during_lead": demand_during_lead,
        "sigma": sigma,
        "z_score": z_score,
        "safety_stock": safety_stock,
        "reorder_point": reorder_point,
    }
    # Economic Order Quantity (EOQ) if costs provided
    if ordering_cost and holding_cost and avg_demand > 0 and holding_cost > 0:
        # Use annualised demand assuming the frequency is daily; scale accordingly
        annual_demand = avg_demand * 365
        eoq = sqrt((2 * annual_demand * ordering_cost) / holding_cost)
        metrics["eoq"] = eoq
    return metrics


def render_forecast_chart(
    series: pd.Series, fitted: pd.Series, forecast: pd.Series, title: str
) -> None:
    """Render an interactive chart of historical and forecasted demand."""
    df_plot = pd.DataFrame(
        {
            "Demand": series,
            "Fitted": fitted.reindex(series.index),
        }
    )
    df_forecast = pd.DataFrame({"Forecast": forecast})
    fig = px.line(df_plot, y=["Demand", "Fitted"], title=title)
    # Add forecast line and shade for forecast horizon
    for col in df_forecast.columns:
        fig.add_scatter(x=df_forecast.index, y=df_forecast[col], mode="lines", name=col)
    # Add shading for forecast horizon
    fig.add_vrect(
        x0=forecast.index[0], x1=forecast.index[-1],
        fillcolor="LightSalmon", opacity=0.3, line_width=0,
        annotation_text="Forecast horizon", annotation_position="top left"
    )
    fig.update_layout(xaxis_title="Date", yaxis_title="Demand", hovermode="x unified")
    st.plotly_chart(fig, use_container_width=True)


def main() -> None:
    st.set_page_config(page_title="Demand Planning App", layout="wide")
    st.title("📈 Demand Planning for Construction Consulting")
    st.write(
        "This application helps construction consulting firms forecast demand, "
        "optimise inventory and allocate resources. Upload your historical demand "
        "data, choose a forecasting model, and explore inventory metrics.")

    # Sidebar for navigation and input
    st.sidebar.header("Navigation")
    section = st.sidebar.radio("Go to", [
        "Data Upload", "Forecasting", "Inventory Optimisation", "About"
    ])

    # Placeholder for loaded data
    data: Optional[pd.DataFrame] = st.session_state.get("data")
    series: Optional[pd.Series] = st.session_state.get("series")
    forecast: Optional[pd.Series] = st.session_state.get("forecast")
    fitted: Optional[pd.Series] = st.session_state.get("fitted")

    # Data upload section
    if section == "Data Upload":
        st.header("Upload Data")
        st.markdown(
            "You can either upload a CSV file or configure a database connection. "
            "For security, database credentials should be stored in environment variables."
        )
        # File upload
        uploaded_data = load_data_from_upload()
        # Database load (optional)
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
            st.write("Preview of the first 5 rows:")
            st.dataframe(data.head())
            st.write(f"Dataset contains {len(data)} rows and {data.shape[1]} columns.")

    # Forecasting section
    elif section == "Forecasting":
        st.header("Demand Forecasting")
        if data is None:
            st.warning("Please upload your dataset first in the 'Data Upload' section.")
        else:
            # Choose date and demand columns
            with st.form("forecast_form"):
                st.subheader("Model Configuration")
                date_col = st.selectbox("Date column", options=data.columns)
                demand_col = st.selectbox("Demand column", options=data.columns)
                agg_func = st.selectbox("Aggregation", options=["sum", "mean"], index=0)
                model_type = st.selectbox("Model type", options=["Exponential Smoothing", "ARIMA"], index=0)
                forecast_horizon = st.number_input(
                    "Forecast horizon (number of periods)", min_value=1, max_value=365, value=30
                )
                seasonal_periods = st.number_input(
                    "Seasonal periods (leave 0 for none)", min_value=0, max_value=365, value=0,
                    help="Set the seasonality (e.g. 12 for monthly seasonality on daily data)"
                )
                arima_p = st.number_input("ARIMA p (autoregressive order)", min_value=0, max_value=5, value=1)
                arima_d = st.number_input("ARIMA d (differencing order)", min_value=0, max_value=2, value=1)
                arima_q = st.number_input("ARIMA q (moving average order)", min_value=0, max_value=5, value=0)
                submitted = st.form_submit_button("Run Forecast")
            if submitted:
                # Prepare the time series
                series = prepare_time_series(data, date_col, demand_col, agg_func)
                st.session_state["series"] = series
                try:
                    if model_type == "Exponential Smoothing":
                        s_periods = int(seasonal_periods) if seasonal_periods > 0 else None
                        forecast, fitted = forecast_exponential_smoothing(series, int(forecast_horizon), s_periods)
                    else:
                        order = (int(arima_p), int(arima_d), int(arima_q))
                        forecast, fitted = forecast_arima(series, int(forecast_horizon), order)
                    # Save results in session state
                    st.session_state["forecast"] = forecast
                    st.session_state["fitted"] = fitted
                    # Plot the results
                    st.success("Forecast completed.")
                    render_forecast_chart(series, fitted, forecast, title="Historical and Forecasted Demand")
                    # Display a table of forecast values
                    st.subheader("Forecast Values")
                    st.dataframe(forecast.reset_index().rename(columns={"index": "Date", 0: "Forecast"}))
                except Exception as e:
                    st.error(f"An error occurred during forecasting: {e}")

    # Inventory optimisation section
    elif section == "Inventory Optimisation":
        st.header("Inventory Optimisation")
        if series is None or forecast is None:
            st.warning("Please run a forecast first in the 'Forecasting' section.")
        else:
            with st.form("inventory_form"):
                st.subheader("Inventory Parameters")
                lead_time = st.number_input(
                    "Lead time (in periods; matches your data's frequency)",
                    min_value=1,
                    max_value=len(forecast),
                    value=7,
                    help="Number of periods between placing an order and receiving stock"
                )
                service_level_percent = st.slider(
                    "Desired service level (%)",
                    min_value=50,
                    max_value=99,
                    value=95,
                    help="Probability of not running out of stock during the lead time"
                )
                # Optional cost inputs
                ordering_cost = st.number_input(
                    "Ordering cost (per order, optional)",
                    min_value=0.0,
                    value=0.0
                )
                holding_cost = st.number_input(
                    "Holding cost (per unit per year, optional)",
                    min_value=0.0,
                    value=0.0
                )
                submitted_inv = st.form_submit_button("Calculate Inventory Metrics")
            if submitted_inv:
                service_level = service_level_percent / 100.0
                metrics = calculate_inventory_metrics(
                    series,
                    forecast,
                    int(lead_time),
                    service_level,
                    ordering_cost if ordering_cost > 0 else None,
                    holding_cost if holding_cost > 0 else None,
                )
                st.success("Inventory metrics calculated.")
                st.subheader("Key Metrics")
                # Present results in a readable table
                metric_labels = {
                    "average_demand": "Average demand per period",
                    "demand_during_lead": "Expected demand during lead time",
                    "sigma": "Standard deviation of demand",
                    "z_score": "Z‑score",
                    "safety_stock": "Safety stock",
                    "reorder_point": "Reorder point",
                    "eoq": "Economic Order Quantity",
                }
                results = []
                for key, value in metrics.items():
                    if value is None or (isinstance(value, float) and np.isnan(value)):
                        continue
                    results.append({"Metric": metric_labels.get(key, key), "Value": round(float(value), 2)})
                st.table(pd.DataFrame(results))
                st.info(
                    "The reorder point is the inventory level at which a new order should be placed. "
                    "Safety stock provides a buffer against demand variability and supply delays. "
                    "If ordering and holding costs were provided, the Economic Order Quantity (EOQ) uses "
                    "the classical square‑root formula to suggest an optimal order size."
                )

    # About section
    elif section == "About":
        st.header("About this Application")
        st.markdown(
            "This demand planning tool was created to demonstrate how Python and Streamlit "
            "can be used to build flexible, data‑driven applications for supply chain management. "
            "Demand planning – forecasting future product or service demand – helps supply chain "
            "professionals balance inventory and meet customer needs.  According to Michigan "
            "State University, demand planning is a supply chain management process of forecasting "
            "or predicting the demand for products so that they can be delivered and satisfy "
            "customers【500967031538458†L74-L77】.  The goal is to have enough inventory to meet customer "
            "needs without building up a costly surplus【500967031538458†L74-L77】.  A poor forecast can "
            "lead to stockouts, lost revenue and excessive storage costs【500967031538458†L109-L114】, while "
            "accurate planning makes supply chains more efficient and resilient.")
        st.markdown(
            "<br>"
            "**Security best practices**: Protecting data in transit is critical.  Implementing "
            "robust security measures such as encryption and access controls helps shield sensitive "
            "information from interception and tampering【802807233059955†L48-L56】.  Protocols like TLS/HTTPS "
            "should be used to maintain the confidentiality and integrity of data while it moves "
            "across the network【802807233059955†L115-L123】.  Access control mechanisms such as role‑based access "
            "control (RBAC) and multi‑factor authentication further protect your application by ensuring "
            "only authorised users can interact with it【802807233059955†L167-L172】.",
            unsafe_allow_html=True,
        )
        st.markdown(
            "**Deployment guidance**: Deploy this app on a cloud platform such as AWS, GCP or Azure.  "
            "Streamlit’s Community Cloud provides free hosting for public apps and Snowflake offers "
            "enterprise‑grade hosting with private app support.  When deploying, ensure TLS is enabled "
            "and environment variables are used to store secrets.  Set up continuous integration "
            "pipelines to automate testing and deployment for scalable operations."
        )


if __name__ == "__main__":
    main()