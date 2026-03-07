# Changelog

## [0.4.0] - 2026-03-07

### Added
- ARIMA confidence interval bands (95%) rendered as shaded areas on the forecast chart.
- In-sample accuracy metrics dashboard (MAE, RMSE, MAPE) displayed after each forecast run.
- CSV download buttons for forecast results and inventory reports.
- Sample construction dataset generator (2 years weekly data: concrete, steel, lumber, rebar, bricks) with realistic seasonality and growth trend.
- Construction material category bar chart on the Dashboard when a category column is detected.
- Peak demand and trend-direction metrics on the Dashboard.
- Data Upload section now uses tabs (Upload File / Generate Sample Data).
- Inventory Optimisation shows key metrics as cards (Safety Stock, Reorder Point, Avg Demand).

### Changed
- `render_forecast_chart` rewritten with `plotly.graph_objects` for richer control (confidence band, improved legend, unified hover).
- `forecast_arima` now returns a 3-tuple `(forecast, fitted, conf_int)`.
- Forecasting form uses a two-column layout; seasonal periods default to 52 (weekly construction data).
- Removed raw citation artefacts from module docstring and About section.
- About section updated with construction-specific context and cleaner security guidance.

### Fixed
- Forecast table column rename bug (column `0` replaced with explicit column assignment).

## [0.3.0] - 2025-07-30

### Added
- Dashboard page with dataset summary and auto-detected overview chart.
- Sidebar navigation restructure (Dashboard, Data Upload, Forecasting, Inventory Optimisation, About).
- Excel upload support (`.xlsx` via openpyxl).
- Clearer validation & error states on upload/config forms.
- UAT docs (`docs/uat.md`) and UI/UX plan (`docs/uiux_plan.md`).
- Wireframe images for core flows.

### Changed
- Layout refined for enterprise-style look (wide layout, consistent headers, sections).
- Forecasting and Inventory pages split into clearer steps with expanders/columns.

### Fixed
- Minor copy and help-text issues.
