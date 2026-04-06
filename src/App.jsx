import { useState } from 'react';
import { Activity } from 'lucide-react';
import { ConfigurationPanel } from './dashboard/ConfigurationPanel';
import { ResultsPanel } from './dashboard/ResultsPanel';

function App() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [assets, setAssets] = useState([
    { id: 1, ticker: "NVDA", weight: 66 },
    { id: 2, ticker: "GOOG", weight: 26 },
    { id: 3, ticker: "AVGO", weight: 8 }
  ]);

  const [baseCapital, setBaseCapital] = useState(23270);
  const [startDate, setStartDate] = useState("2025-03-31");
  const [endDate, setEndDate] = useState("2026-03-31");
  const [dayHorizon, setDayHorizon] = useState(60);
  const [simulations, setSimulations] = useState(2000);
  const [shockVol, setShockVol] = useState(1.15);
  const [mktGap, setMktGap] = useState(-2.0); 
  const [meanShock, setMeanShock] = useState(-0.20);
  const [rebalance, setRebalance] = useState(false);

  const state = { assets, baseCapital, startDate, endDate, dayHorizon, simulations, shockVol, mktGap, meanShock, rebalance };
  const setters = { setAssets, setBaseCapital, setStartDate, setEndDate, setDayHorizon, setSimulations, setShockVol, setMktGap, setMeanShock, setRebalance };

  const runSimulation = async () => {
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      // Dynamically extract the arrays from our new object state
      const tickerArray = assets.map(a => a.ticker.trim().toUpperCase());
      const weightArray = assets.map(a => parseFloat(a.weight) / 100);
      
      const API_URL = import.meta.env.VITE_API_URL || "https://iprae-api.onrender.com/api/v1/simulate";

      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tickers: tickerArray, weights: weightArray, base: parseFloat(baseCapital),
          start_date: startDate, end_date: endDate, day_horizon: parseInt(dayHorizon), 
          simulations: parseInt(simulations), shock_volatility: parseFloat(shockVol), 
          market_gap: parseFloat(mktGap) / 100, mean_shock: parseFloat(meanShock), rebalance 
        })
      });

      if (!response.ok) throw new Error((await response.json()).detail || "API request failed");
      setResults(await response.json());

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const legacyTickers = assets.map(a => a.ticker).join(', ');
  const legacyWeights = assets.map(a => (a.weight / 100).toString()).join(', ');

  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans">
      <header className="mb-8 flex items-center gap-3">
        <div className="bg-blue-600 p-2 rounded-lg shadow-sm">
          <Activity className="text-white" size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">IPRAE Risk Engine</h1>
          <p className="text-slate-500 text-sm">Institutional Portfolio Stress Testing</p>
        </div>
      </header>
      
      <main className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ConfigurationPanel state={state} setters={setters} runSimulation={runSimulation} loading={loading} />
        
        <ResultsPanel 
          results={results} 
          loading={loading} 
          error={error} 
          baseCapital={baseCapital} 
          dayHorizon={dayHorizon} 
          tickers={legacyTickers} 
          weights={legacyWeights} 
          startDate = {startDate}
          endDate = {endDate}
          simulations = {simulations}
          shockVol = {shockVol}
          mktGap = {mktGap}
          meanShock = {meanShock}
          rebalance = {rebalance}
        />
      </main>
    </div>
  );
}

export default App;