# IPRAE (Main Dashboard)

A modern, responsive React web application for investment portfolio stress testing and risk analysis. This is the main frontend dashboard for the IPRAE Risk Engine, completely re-engineered from the original Streamlit prototype to deliver lightning-fast performance, interactive charts, and a polished user experience.

## Key Features

* **Interactive Monte Carlo Simulations:** Run up to 5,000 parallel futures to calculate VaR (95%), CVaR (Tail Risk), and the Sortino Ratio.
* **Severe Stress Testing:** Model market crash events by applying custom volatility multipliers, overnight market gaps, and sustained negative drifts.
* **Risk Attribution:** Visualise how individual assets contribute to overall portfolio volatility using interactive Bar Charts and Heatmaps.
* **Optimal Hedging Strategy:** Automatically calculates the risk gap and recommends the exact percentage of capital to reallocate to defensive assets.
* **Raw Data Export:** Clean, scrollable data tables of historical prices with CSV download.
* **Fully Responsive:** Beautifully adapts to desktops, tablets, and mobile devices using a fluid layout and adaptive UI components.

## Tech Stack

This UI was built using modern, industry-standard web technologies:

* **Framework:** React + Vite
* **Styling:** Tailwind CSS
* **Components:** shadcn/ui & Base UI (Accessible, headless components)
* **Charts:** Recharts
* **Icons:** Lucide React
* **Animation:** Motion
* **Backend:** Communicates with a Python/FastAPI quantitative engine.

## Live Deployment

The frontend is continuously deployed on Vercel:
**https://iprae-ui.vercel.app/**

## Local Development Setup

To run this React frontend on your local machine, follow these steps:

### 1. Clone the repository
```bash
git clone https://github.com/nghh1/iprae-ui.git
cd iprae-ui
```

### 2. Install dependencies
```bash
npm install
```

### 3. Setup Environment Variables
Create a .env file in the root directory and add the URL for Python backend API.
```bash
VITE_API_URL=https://iprae-api.onrender.com/api/v1/simulate
```

### 4. Start the Development Server
```bash
npm run dev
```
Open **http://localhost:5173/** in the browser to view the application.

## Architecture
This application uses a Multi-Repo Architecture:

Frontend (This Repo): Handles all UI state, API requests, and Recharts data parsing. Deployed on Vercel.

Backend Engine: A standalone Python API that downloads financial data, computes and runs the actual simulations. Deployed on Render.

If you are looking for the backend engine, please visit the **https://github.com/nghh1/IPRAE**
