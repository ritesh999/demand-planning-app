# Demand Planning for Construction Consulting

This repository contains a **Streamlit** application that helps construction consulting firms forecast demand, optimise inventory levels and allocate resources more effectively.  The app leverages Python data‑science libraries to provide interactive forecasting (Exponential Smoothing and ARIMA models) and inventory metrics while remaining simple enough for non‑technical users.

## Features

- **Data ingestion** – Upload historical demand data in **CSV** or **Excel** format or load data from an external database via a connection string.  The app previews the first few rows and reports dataset dimensions.
- **Exploratory visualisations** – Interactive line charts reveal trends and seasonality in your data.  Plotly charts support zooming, panning and exporting.
- **Demand forecasting** – Choose between **Exponential Smoothing** (with optional seasonality) and **ARIMA** models.  Specify a forecast horizon and produce fitted and forecasted values with confidence shading.
- **Inventory optimisation** – Enter lead time and desired service level to compute average demand, expected demand during lead time, standard deviation, **Z‑score**, safety stock and reorder point.  Optional ordering and holding costs produce an Economic Order Quantity (EOQ).
- **Real‑time analytics** – Changing inputs or uploading new datasets refreshes charts and calculations without restarting the app.
- **Security** – Designed with best practices in mind.  When deployed behind Streamlit Cloud or another TLS‑enabled server, all data travels over HTTPS.  Secrets such as database credentials should be stored in environment variables.

## Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/your‑username/demand‑planning‑app.git
   cd demand‑planning‑app
   ```
2. Create a virtual environment (optional but recommended):
   ```bash
   python -m venv .venv
   source .venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
   To run development tests you can also install additional tools from `requirements‑dev.txt`.

## Usage

Run the application with Streamlit:

```bash
streamlit run demand_planning_app.py
```

The app opens in your default browser.  Follow these steps:

1. **Data Upload** – Navigate to the “Data Upload” section using the sidebar.  Upload a **CSV** or **Excel** file containing at least two columns: a date column and a demand column.  The app previews the data and informs you how many rows and columns were loaded.
2. **Forecasting** – After uploading data, go to the “Forecasting” section.  Select the date and demand columns, choose an aggregation method (`sum` or `mean`), pick a model (Exponential Smoothing or ARIMA) and set your forecast horizon.  Click **Run Forecast** to generate forecasts.  An interactive chart and a table of forecast values are displayed.
3. **Inventory Optimisation** – Once a forecast has been generated, open the “Inventory Optimisation” section.  Enter the lead time (number of periods) and desired service level.  Optionally provide ordering and holding costs.  Click **Calculate Inventory Metrics** to view safety stock and reorder point calculations.
4. **About** – Read a summary of the project’s purpose and security best practices.

The app is designed to be easily deployable on [Streamlit Community Cloud](https://streamlit.io/cloud) or any cloud platform that supports Python.  When deploying, ensure that TLS/HTTPS is configured and that sensitive credentials are managed via environment variables.

## User Acceptance Testing

Detailed UAT results, including test cases and outcomes, are documented in [docs/uat.md](docs/uat.md).  Highlights from UAT include:

- Successful upload of CSV files and rejection of unsupported formats with clear error messages.
- Correct generation of forecasts and inventory metrics using the provided sample dataset.
- Clear success messages and informative error handling during user interactions.

The UAT report also outlines recommendations for future enhancements such as supporting additional file types, enforcing input validation before running forecasts, and testing with larger datasets.

## Contribution Guidelines

Contributions are welcome!  To propose an enhancement or fix a bug:

1. Fork this repository and create a new branch for your feature.
2. Make your changes.  Please include tests where appropriate and run `pytest` to ensure existing tests pass.
3. Commit your changes with a descriptive message and open a pull request against the `main` branch.
4. Describe your changes in the PR and link any related issues.  We’ll review and merge after validation.

## Changelog

- **v1.1** – Added User Acceptance Testing documentation and enabled Excel file uploads via `pandas.read_excel`.  Improved input validation and updated requirements to include `openpyxl`.
- **v1.0** – Initial release with CSV upload, forecasting (Exponential Smoothing & ARIMA) and inventory optimisation.

## License

This project is licensed under the [MIT License](LICENSE).  You are free to use, modify and distribute the code provided you include the original copyright and license notice.