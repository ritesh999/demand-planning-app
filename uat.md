# User Acceptance Testing (UAT) Report – Demand Planning Application

**Application:** Demand Planning for Construction Consulting (Streamlit)

**Tester:** QA specialist with expertise in Python, Streamlit, ML/AI, SCM and Demand Planning

**Date:** 30 July 2025

## 1. Objective
The goal of this UAT was to simulate real‑world use cases for the newly developed Demand Planning application and verify its ability to handle file uploads and subsequent demand forecasting and inventory optimisation tasks. Tests were conducted on the live Streamlit deployment.

## 2. Test Environment
- **App URL:** `https://demand‑planning‑app‑bvskdinbdmayfpzjto8ffk.streamlit.app`
- **Browser:** Chromium (on Linux)
- **Sample Data:** Synthetic daily demand data for January 2025 (30 rows) saved as `uat_sample.csv` and `uat_sample.xlsx`.

## 3. Test Cases and Results

### 3.1 Upload Functionality

| ID | Test case | Expected Result | Outcome |
|---|---|---|---|
| **U‑1** | Upload valid CSV (`uat_sample.csv`) via **Browse files** on the “Data Upload” page. | Application reads the CSV, displays “File uploaded successfully” and shows a preview of the first 5 rows. | Success. A green success message appeared; the preview table listed date and demand columns. |
| **U‑2** | Upload invalid file type (Excel `uat_sample.xlsx`). | Upload should be rejected and a clear error message displayed. | Success. App displayed an error message indicating that `.xlsx` files are not allowed. |
| **U‑3** | Remove uploaded file by clicking “×” and re‑upload the CSV. | App returns to awaiting state and accepts a new file. | Success. After clicking “×”, the page returned to “Awaiting data upload.” Re‑uploading the CSV worked as in U‑1. |

### 3.2 Data Handling and Processing

| ID | Test case | Expected Result | Outcome |
|---|---|---|---|
| **D‑1** | Run Exponential Smoothing forecasting after CSV upload (Date column = `date`, Demand column = `demand`). | App should compute fitted and forecast values, display a Plotly line chart of historical vs. forecasted demand, and show a forecast table. | Success. A chart with Demand (blue), Fitted (cyan) and Forecast (red) lines appeared; a “Forecast completed” message appeared, followed by a table of forecast values. |
| **D‑2** | Adjust forecast horizon and run ARIMA model. | App recalculates results accordingly. | Not tested. Basic forecasting confirmed. |
| **D‑3** | Navigate to “Inventory Optimisation,” enter lead‑time = 7 periods, service level = 95 %, and click **Calculate Inventory Metrics**. | App should compute and display metrics such as average demand, expected demand during lead time, standard deviation, Z‑score, safety stock and reorder point. | Success. The page showed “Inventory metrics calculated” and a table with metrics (average demand per period ≈ 95.87 units, safety stock ≈ 35.72 units, reorder point ≈ 719.23 units). |

### 3.3 User Feedback and Error Handling

| ID | Test case | Expected Result | Outcome |
|---|---|---|---|
| **F‑1** | Observe messages after successful file upload, forecast completion and inventory calculation. | The app should display clear success messages. | Success. Green banners indicated “File uploaded successfully,” “Forecast completed,” and “Inventory metrics calculated.” |
| **F‑2** | Observe message after invalid file upload (Excel). | App should present a descriptive error explaining the problem. | Success. The message specified that `.xlsx` files are not allowed and prompted the user accordingly. |
| **F‑3** | Submit forecasting form without uploading a file. | App should prevent forecasting and inform the user to upload data. | Not tested; potential area for validation. |

### 3.4 Integration Consistency

The current test environment did not include actual SCM tool integrations. However:

- Data flowed correctly from Upload → Forecasting → Inventory Optimisation within the app. The uploaded dataset was persistently available across modules.
- Integration with external SCM systems is to be validated separately in staging when connectors are configured.

### 3.5 Security Protocols

- Upload mechanism used Streamlit’s built‑in file uploader, which restricts file types (CSV) and size (max 200 MB). The application did not expose sensitive information during upload and error messages were generic.
- TLS/HTTPS is enforced via Streamlit Cloud; network traffic is encrypted (verified by inspecting the URL prefix `https://`).
- Further tests such as authentication/authorization, rate limiting and secure storage of uploaded files are recommended when integrating with enterprise systems.

## 4. Observations & Recommendations
1. **File type support:** The app explicitly accepts CSV. Users may attempt to upload Excel files; a helpful message directs them to convert to CSV. Consider supporting Excel `.xlsx` if required by end users.
2. **Validation before forecasting:** Running the forecasting module without an uploaded dataset should trigger a warning. Include a guard in the code to check for data presence.
3. **Integration hooks:** When connecting to SCM tools or databases, ensure credentials are loaded from environment variables and errors are handled gracefully. Automated tests should be added for API connectivity.
4. **User guidance:** Add brief instructions on required column names (e.g., `date`, `demand`) on the upload page to help users format data correctly.
5. **Performance:** The app handled a 30‑row file instantly; larger files were not tested. Conduct performance tests with larger datasets (e.g., 50 k rows) to observe responsiveness.
6. **Security:** If authentication is added, implement multi‑factor authentication and role‑based access control. Use secure storage for uploaded data and ensure logs do not contain sensitive information.

## 5. Conclusion

The Demand Planning application successfully handled CSV uploads, performed demand forecasting, and calculated inventory metrics during UAT. Core functionality operated without errors, and user feedback messages were clear. Future work should focus on supporting more file formats, adding input validation, testing with larger datasets, and verifying integration and security features in a full production environment.