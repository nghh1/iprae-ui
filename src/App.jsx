import { useState, useMemo } from 'react';
import { Activity, Loader2, AlertTriangle, ShieldAlert, ChartColumn, ChartSpline, TrendingUp, ShieldPlus, Database, Download, Info } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';

// Color palette for dynamic historical lines
const LINE_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316'];

// Tooltip component (Adaptive Width & Safe Positioning)
const InfoTooltip = ({ text, align = "center", side = "top" }) => {
  const [isOpen, setIsOpen] = useState(false);

  let alignClass = "left-1/2 -translate-x-1/2";
  let arrowClass = "left-1/2 -translate-x-1/2";
  
  if (align === "left") {
    alignClass = "left-0";
    arrowClass = "left-2";
  } else if (align === "right") {
    alignClass = "right-0";
    arrowClass = "right-2";
  }

  const isTop = side === "top";
  const sideClass = isTop ? "bottom-full mb-2" : "top-full mt-2";
  const arrowSideClass = isTop ? "top-full border-t-slate-900" : "bottom-full border-b-slate-900";

  return (
    <span 
      tabIndex={0}
      className="relative inline-flex items-center justify-center ml-1.5 cursor-pointer z-50 outline-none"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
      onClick={() => setIsOpen(!isOpen)}
      onBlur={() => setIsOpen(false)}
    >
      <Info className={`w-3.5 h-3.5 transition-colors ${isOpen ? 'text-blue-500' : 'text-slate-400'}`} />
      {isOpen && (
        <span className={`absolute ${sideClass} ${alignClass} w-max max-w-[220px] sm:max-w-[260px] p-2.5 bg-slate-900 text-white text-xs rounded-md shadow-2xl text-left font-normal normal-case tracking-normal leading-relaxed pointer-events-none`}>
          {text}
          <span className={`absolute ${arrowSideClass} ${arrowClass} border-4 border-transparent`}></span>
        </span>
      )}
    </span>
  );
};

function App() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const [tickers, setTickers] = useState("NVDA, GOOG, AVGO");
  const [weights, setWeights] = useState("0.66, 0.26, 0.08");
  const [baseCapital, setBaseCapital] = useState(23270);
  const [startDate, setStartDate] = useState("2025-03-31");
  const [endDate, setEndDate] = useState("2026-03-31");
  
  // Slider states
  const [dayHorizon, setDayHorizon] = useState(60);
  const [simulations, setSimulations] = useState(2000);
  const [shockVol, setShockVol] = useState(1.15);
  const [mktGap, setMktGap] = useState(-2.0); 
  const [meanShock, setMeanShock] = useState(-0.20);
  
  const [rebalance, setRebalance] = useState(false);

  const runSimulation = async () => {
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const tickerArray = tickers.split(',').map(t => t.trim().toUpperCase());
      const weightArray = weights.split(',').map(w => parseFloat(w.trim()));
      const API_URL = import.meta.env.VITE_API_URL;

      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tickers: tickerArray,
          weights: weightArray,
          base: parseFloat(baseCapital),
          start_date: startDate,             
          end_date: endDate,                 
          day_horizon: parseInt(dayHorizon), 
          simulations: parseInt(simulations),
          shock_volatility: parseFloat(shockVol), 
          market_gap: parseFloat(mktGap) / 100,
          mean_shock: parseFloat(meanShock),     
          rebalance: rebalance 
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "API request failed");
      }

      const data = await response.json();
      setResults(data);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const riskMetrics = useMemo(() => {
    if (!results) return null;
    const rf = 0.0365; 
    const horizon = parseFloat(dayHorizon);
    const base = parseFloat(baseCapital);

    const lastDayIndex = results.normal_simulation.length - 1;
    const finalGeneral = [...results.normal_simulation[lastDayIndex]].sort((a, b) => a - b);
    const finalCrash = [...results.stress_simulation[lastDayIndex]].sort((a, b) => a - b);

    const varIndex = Math.floor(finalGeneral.length * 0.05);
    const normalVaR = base - finalGeneral[varIndex];
    const stressVaR = base - finalCrash[varIndex];

    const tailGeneral = finalGeneral.slice(0, varIndex);
    const normalCVaR = base - (tailGeneral.reduce((a, b) => a + b, 0) / tailGeneral.length);

    const tailCrash = finalCrash.slice(0, varIndex);
    const stressCVaR = base - (tailCrash.reduce((a, b) => a + b, 0) / tailCrash.length);

    const calcSortino = (finals) => {
      const pathReturns = finals.map(v => ((v / base) - 1) * (252 / horizon));
      const medianReturn = [...pathReturns].sort((a, b) => a - b)[Math.floor(pathReturns.length / 2)];
      const excess = medianReturn - rf;
      const downsides = pathReturns.map(r => Math.min(0, r - rf));
      const downsideVol = Math.sqrt(downsides.reduce((sum, d) => sum + Math.pow(d, 2), 0) / downsides.length);
      return excess > 0 ? (excess / (downsideVol + 1e-9)) : (excess * downsideVol);
    };

    return {
      normalVaR, stressVaR, 
      normalCVaR, stressCVaR, 
      normalSortino: calcSortino(finalGeneral),
      stressSortino: calcSortino(finalCrash)
    };
  }, [results, baseCapital, dayHorizon]);

  const processChartData = (matrix) => {
    if (!matrix) return [];
    return matrix.map((dayPaths, index) => {
      const sorted = [...dayPaths].sort((a, b) => a - b);
      return {
        day: index,
        expected: Math.round(sorted[Math.floor(sorted.length * 0.5)]),
        lowerBound: Math.round(sorted[Math.floor(sorted.length * 0.05)]),
        upperBound: Math.round(sorted[Math.floor(sorted.length * 0.95)])
      };
    });
  };

  const normalChartData = useMemo(() => processChartData(results?.normal_simulation), [results]);
  const stressChartData = useMemo(() => processChartData(results?.stress_simulation), [results]);

  const riskAttributionData = useMemo(() => {
    if (!results || !results.risk_contribution) return [];
    const tickerArray = tickers.split(',').map(t => t.trim().toUpperCase());
    const weightArray = weights.split(',').map(w => parseFloat(w.trim()));
    return tickerArray.map((ticker, i) => {
      let rcValue = results.risk_contribution[ticker] !== undefined ? results.risk_contribution[ticker] : results.risk_contribution[i];
      return { name: ticker, Allocation: weightArray[i] * 100, RiskContribution: (Number(rcValue) || 0) * 100 };
    });
  }, [results, tickers, weights]);

  const maxRiskAsset = useMemo(() => {
    if (!riskAttributionData.length) return null;
    return riskAttributionData.reduce((prev, current) => (prev.RiskContribution > current.RiskContribution) ? prev : current);
  }, [riskAttributionData]);

  const getHeatmapColor = (val) => {
    if (val > 0) return `rgba(59, 130, 246, ${val})`; 
    if (val < 0) return `rgba(239, 68, 68, ${Math.abs(val)})`; 
    return `rgba(248, 250, 252, 1)`; 
  };

  const getCorrelation = (rowTicker, colTicker, rowIdx, colIdx) => {
    const matrix = results?.correlation_matrix;
    if (!matrix) return 0;
    let val = matrix[rowTicker]?.[colTicker] ?? matrix[rowIdx]?.[colTicker] ?? (Array.isArray(matrix[rowIdx]) ? matrix[rowIdx][colIdx] : 0);
    return Number(val) || 0;
  };

  const historyData = useMemo(() => {
    if (!results || !results.historical_prices) return [];
    try {
      const raw = results.historical_prices;
      const tks = Object.keys(raw);
      if (tks.length === 0) return [];
      const dates = Object.keys(raw[tks[0]]).sort(); 
      const basePrices = {};
      tks.forEach(t => basePrices[t] = raw[t][dates[0]]); 
      return dates.map(date => {
        const row = { date: date.split(' ')[0] }; 
        tks.forEach(t => {
          row[t] = (raw[t][date] / basePrices[t]) * 100; 
          row[`${t}_raw`] = raw[t][date]; 
        });
        return row;
      });
    } catch (e) {
      return [];
    }
  }, [results]);

  const downloadCSV = () => {
    if (!historyData.length) return;
    const tks = Object.keys(results.historical_prices);
    let csvContent = "Date," + tks.join(",") + "\n";
    historyData.forEach(row => {
      csvContent += [row.date, ...tks.map(t => row[`${t}_raw`].toFixed(4))].join(",") + "\n";
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }));
    link.download = `portfolio_data_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans">
      <header className="mb-8 flex items-center gap-3">
        <div className="bg-blue-600 p-2 rounded-lg shadow-sm">
          <Activity className="text-white" size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">IPRAE Risk Engine</h1>
          <p className="text-slate-500 text-sm">Investment Portfolio Stress Testing</p>
        </div>
      </header>
      
      <main className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Input form */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle>Portfolio Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="flex items-center">
                  Tickers
                  <InfoTooltip align="left" side="bottom" text="Comma-separated list of stock tickers to include in the portfolio (e.g., AAPL, MSFT)." />
                </Label>
                <Input value={tickers} onChange={(e) => setTickers(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center">
                  Weights
                  <InfoTooltip align="left" text="Comma-separated decimal weights. Must match the number of tickers and sum perfectly to 1.0 (e.g., 0.5, 0.5)." />
                </Label>
                <Input value={weights} onChange={(e) => setWeights(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center">
                  Capital ($)
                  <InfoTooltip align="left" text="The total initial cash value of the portfolio at the start of the simulation." />
                </Label>
                <Input type="number" value={baseCapital} onChange={(e) => setBaseCapital(e.target.value)} />
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                {/* Max-width prevents it from getting awkwardly long on phones */}
                <div className="space-y-2 w-full max-w-[200px] sm:max-w-none sm:flex-1">
                  <Label className="flex items-center text-sm tracking-tight">
                    Start Date
                    <InfoTooltip align="left" text="The beginning of the historical lookback period used to calculate volatility and drift." />
                  </Label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                
                <div className="space-y-2 w-full max-w-[200px] sm:max-w-none sm:flex-1">
                  <Label className="flex items-center text-sm tracking-tight">
                    End Date
                    <InfoTooltip align="right" text="The end of the historical lookback period." />
                  </Label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </div>

              {/* Slider 1: Time horizon */}
              <div className="space-y-2 pt-2">
                <Label className="flex items-center">
                  Forecast Horizon (Days)
                  <InfoTooltip align="left" text="Number of trading days to project into the future (e.g., 60 days is roughly 3 months)." />
                </Label>
                <div className="flex items-center gap-3">
                  <input type="range" min="5" max="252" step="1" value={dayHorizon} onChange={(e) => setDayHorizon(e.target.value)} className="flex-1 accent-blue-600 cursor-pointer" />
                  <Input type="number" className="w-20 text-right h-8" value={dayHorizon} onChange={(e) => setDayHorizon(e.target.value)} />
                </div>
              </div>

              {/* Slider 2: Simulations */}
              <div className="space-y-2">
                <Label className="flex items-center">
                  Simulations
                  <InfoTooltip align="left" text="Number of simulated futures. Higher numbers increase accuracy but take longer to calculate." />
                </Label>
                <div className="flex items-center gap-3">
                  <input type="range" min="100" max="5000" step="100" value={simulations} onChange={(e) => setSimulations(e.target.value)} className="flex-1 accent-blue-600 cursor-pointer" />
                  <Input type="number" className="w-20 text-right h-8" value={simulations} onChange={(e) => setSimulations(e.target.value)} />
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <input type="checkbox" id="rebalance" checked={rebalance} onChange={(e) => setRebalance(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                <Label htmlFor="rebalance" className="cursor-pointer flex items-center">
                  Enable Daily Rebalancing
                  <InfoTooltip align="left" text="If checked, the engine forces the portfolio back to target weights every day. If unchecked, winners will drift and overweight naturally." />
                </Label>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-red-600 flex items-center gap-2">
                <ShieldAlert size={18} /> Stress Factors
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              
              {/* Slider 3: Volatility multiplier */}
              <div className="space-y-2">
                <Label className="flex items-center">
                  Volatility Multiplier (x)
                  <InfoTooltip align="left" side="bottom" text="Scales the volatility. The market will swing as violently as it did in the past." />
                </Label>
                <div className="flex items-center gap-3">
                  <input type="range" min="1.0" max="5.0" step="0.1" value={shockVol} onChange={(e) => setShockVol(e.target.value)} className="flex-1 accent-red-600 cursor-pointer" />
                  <Input type="number" step="0.1" className="w-20 text-right h-8" value={shockVol} onChange={(e) => setShockVol(e.target.value)} />
                </div>
              </div>

              {/* Slider 4: Market gap */}
              <div className="space-y-2">
                <Label className="flex items-center">
                  Overnight Gap Down (%)
                  <InfoTooltip align="left" text="Simulates an instant market crash on Day 1 of the simulation before the random paths begin." />
                </Label>
                <div className="flex items-center gap-3">
                  <input type="range" min="-20.0" max="0.0" step="0.5" value={mktGap} onChange={(e) => setMktGap(e.target.value)} className="flex-1 accent-red-600 cursor-pointer" />
                  <Input type="number" step="0.5" className="w-20 text-right h-8" value={mktGap} onChange={(e) => setMktGap(e.target.value)} />
                </div>
              </div>

              {/* Slider 5: Negative drift */}
              <div className="space-y-2">
                <Label className="flex items-center">
                  Annualised Negative Drift
                  <InfoTooltip align="left" text="Simulates a sustained Bear Market. A value of -0.20 forces the engine to trend downward 20% annualised." />
                </Label>
                <div className="flex items-center gap-3">
                  <input type="range" min="-1.0" max="0.5" step="0.05" value={meanShock} onChange={(e) => setMeanShock(e.target.value)} className="flex-1 accent-red-600 cursor-pointer" />
                  <Input type="number" step="0.05" className="w-20 text-right h-8" value={meanShock} onChange={(e) => setMeanShock(e.target.value)} />
                </div>
              </div>

              <div className="pt-2">
                <Button className="w-full" onClick={runSimulation} disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {loading ? "Calculating..." : "Run Engine"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Outputs & charts */}
        <Card className="lg:col-span-2 flex flex-col">
          <CardHeader>
            <CardTitle>Simulation Results</CardTitle>
            <CardDescription>Compare normal conditions vs. severe market crashes.</CardDescription>
          </CardHeader>
          
          <CardContent className="flex-1 flex flex-col border-t p-6">
            {!loading && !results && !error && (
              <div className="flex-1 min-h-[400px] flex items-center justify-center text-slate-400 text-sm">
                Configure portfolio and run engine...
              </div>
            )}
            
            {loading && (
              <div className="flex-1 min-h-[400px] flex flex-col items-center justify-center text-blue-600">
                <Loader2 className="h-8 w-8 animate-spin mb-4" />
                <p className="text-sm font-medium">Running {simulations} x 2 Monte Carlo Paths...</p>
              </div>
            )}

            {error && (
              <div className="text-red-500 bg-red-50 p-4 rounded-md w-full border border-red-200">
                <p className="font-semibold">Engine Error:</p>
                <p className="text-sm">{error}</p>
              </div>
            )}

            {results && riskMetrics && (
              <Tabs defaultValue="normal" className="w-full">
                <TabsList 
                  className="grid w-full grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 p-1 mb-6 bg-slate-200/50 rounded-lg"
                  style={{ height: 'auto' }}
                >
                  <TabsTrigger value="normal"><ChartSpline className="w-4 h-4 mr-2 hidden sm:inline-block" /> Normal</TabsTrigger>
                  <TabsTrigger value="stress" className="data-[state=active]:bg-red-50 data-[state=active]:text-red-700">
                    <AlertTriangle className="w-4 h-4 mr-2 hidden sm:inline-block" /> Stress</TabsTrigger>
                  <TabsTrigger value="attribution"><ChartColumn className="w-4 h-4 mr-2 hidden sm:inline-block" /> Risk</TabsTrigger>
                  <TabsTrigger value="history"><TrendingUp className="w-4 h-4 mr-2 hidden sm:inline-block" /> History</TabsTrigger>
                  <TabsTrigger value="hedging"><ShieldPlus className="w-4 h-4 mr-2 hidden sm:inline-block" /> Hedging</TabsTrigger>
                  <TabsTrigger value="data"><Database className="w-4 h-4 mr-2 hidden sm:inline-block" /> Data</TabsTrigger>
                </TabsList>

                {/* Tab 1: Normal market */}
                <TabsContent value="normal" className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                      <p className="text-xs font-semibold text-slate-500 uppercase flex items-center">
                        VaR (95%)
                        <InfoTooltip align="left" text="Value at Risk. The absolute maximum expected loss with 95% confidence. Only 5% of simulated futures performed worse than this number." />
                      </p>
                      <p className="text-xl font-bold text-slate-900">${riskMetrics.normalVaR.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                      <p className="text-xs font-semibold text-slate-500 uppercase flex items-center">
                        CVaR (Tail Risk)
                        <InfoTooltip align="center" text="Conditional Value at Risk (Expected Shortfall). If a worst-case 5% crash happens, this is the average amount of money you will lose." />
                      </p>
                      <p className="text-xl font-bold text-slate-900">${riskMetrics.normalCVaR.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                      <p className="text-xs font-semibold text-slate-500 uppercase flex items-center">
                        Sortino Ratio
                        <InfoTooltip align="right" text="Measures risk-adjusted return. Similar to the Sharpe Ratio, but only penalises harmful 'downside' volatility. Higher is better." />
                      </p>
                      <p className="text-xl font-bold text-slate-900">{riskMetrics.normalSortino.toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="w-full h-[350px]">
                    <ResponsiveContainer width="99%" height="100%" minWidth={1} minHeight={1}>
                      <LineChart data={normalChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="day" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis domain={['auto', 'auto']} stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value.toLocaleString()}`} />
                        <RechartsTooltip formatter={(value) => `$${value.toLocaleString()}`} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                        <Legend />
                        <Line type="monotone" dataKey="upperBound" name="95th Percentile" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                        <Line type="monotone" dataKey="expected" name="Expected Path (Median)" stroke="#2563eb" strokeWidth={3} dot={false} />
                        <Line type="monotone" dataKey="lowerBound" name="5th Percentile" stroke="#f43f5e" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </TabsContent>

                {/* Tab 2: Stress test */}
                <TabsContent value="stress" className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                      <p className="text-xs font-semibold text-red-700 uppercase flex items-center">
                        Stress VaR
                        <InfoTooltip align="left" text="The new Value at Risk calculated under severe crash parameters." />
                      </p>
                      <p className="text-xl font-bold text-red-900">${riskMetrics.stressVaR.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
                      <p className="text-xs text-red-600 mt-1 font-medium">
                        {riskMetrics.normalVaR > 0 ? `${(((riskMetrics.stressVaR / riskMetrics.normalVaR) - 1) * 100 > 0 ? '+' : '')}${(((riskMetrics.stressVaR / riskMetrics.normalVaR) - 1) * 100).toFixed(1)}% vs Normal` : "New Risk"}
                      </p>
                    </div>
                    <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                      <p className="text-xs font-semibold text-red-700 uppercase flex items-center">
                        Stress CVaR
                        <InfoTooltip align="center" text="The average expected loss during the worst-case crash scenarios." />
                      </p>
                      <p className="text-xl font-bold text-red-900">${riskMetrics.stressCVaR.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
                      <p className="text-xs text-red-600 mt-1 font-medium">
                        {riskMetrics.normalCVaR > 0 ? `${(((riskMetrics.stressCVaR / riskMetrics.normalCVaR) - 1) * 100 > 0 ? '+' : '')}${(((riskMetrics.stressCVaR / riskMetrics.normalCVaR) - 1) * 100).toFixed(1)}% vs Normal` : "New Risk"}
                      </p>
                    </div>
                    <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                      <p className="text-xs font-semibold text-red-700 uppercase flex items-center">
                        Stress Sortino
                        <InfoTooltip align="right" text="The risk-adjusted return ratio completely devastated by the simulated bear market drift." />
                      </p>
                      <p className="text-xl font-bold text-red-900">{riskMetrics.stressSortino.toFixed(2)}</p>
                      <p className="text-xs text-red-600 mt-1 font-medium">
                        {(riskMetrics.stressSortino - riskMetrics.normalSortino).toFixed(2)} difference
                      </p>
                    </div>
                  </div>
                  <div className="w-full h-[350px]">
                    <ResponsiveContainer width="99%" height="100%" minWidth={1} minHeight={1}>
                      <LineChart data={stressChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="day" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis domain={['auto', 'auto']} stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value.toLocaleString()}`} />
                        <RechartsTooltip formatter={(value) => `$${value.toLocaleString()}`} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                        <Legend />
                        <Line type="monotone" dataKey="upperBound" name="95th Pctl (Crash)" stroke="#fca5a5" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                        <Line type="monotone" dataKey="expected" name="Expected Crash Path" stroke="#dc2626" strokeWidth={3} dot={false} />
                        <Line type="monotone" dataKey="lowerBound" name="5th Pctl (Crash)" stroke="#991b1b" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </TabsContent>

                {/* Tab 3: Risk attribution */}
                <TabsContent value="attribution" className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                      <p className="text-xs font-semibold text-slate-500 uppercase flex items-center">
                        Diversification Ratio
                        <InfoTooltip align="left" text="Measures how well assets offset each other. A ratio of 1.0 means no diversification. >1.5 indicates excellent uncorrelated hedging." />
                      </p>
                      <p className="text-2xl font-bold text-slate-900">{results.diversification_ratio?.toFixed(2) || "N/A"}</p>
                    </div>
                    {results.diversification_ratio < 1.1 ? (
                      <div className="bg-red-50 p-4 rounded-lg border border-red-200 flex flex-col justify-center">
                        <p className="text-sm font-semibold text-red-700">Low Diversification</p>
                        <p className="text-xs text-red-600">Assets are highly correlated.</p>
                      </div>
                    ) : results.diversification_ratio < 1.5 ? (
                      <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 flex flex-col justify-center">
                        <p className="text-sm font-semibold text-yellow-700">Moderate Diversification</p>
                      </div>
                    ) : (
                      <div className="bg-green-50 p-4 rounded-lg border border-green-200 flex flex-col justify-center">
                        <p className="text-sm font-semibold text-green-700">Strong Diversification</p>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t">
                    <div className="md:col-span-2 h-[250px]">
                      <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center">
                        Allocation vs Risk Contribution (%)
                        <InfoTooltip align="left" text="Just because an asset makes up 10% of your capital does not mean it is 10% of your risk. Highly volatile assets contribute disproportionately more risk." />
                      </h3>
                      <ResponsiveContainer width="99%" height="100%" minWidth={1} minHeight={1}>
                        <BarChart data={riskAttributionData} margin={{ top: 5, right: 30, left: -20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                          <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                          <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                          <Legend verticalAlign="top" height={36} wrapperStyle={{ paddingBottom: '10px' }} />
                          <Bar dataKey="Allocation" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="RiskContribution" name="Risk Contribution" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    {maxRiskAsset && (
                      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 flex flex-col justify-center">
                        <AlertTriangle className="w-8 h-8 text-blue-600 mb-2" />
                        <p className="text-sm text-blue-900 leading-relaxed">
                          <strong>{maxRiskAsset.name}</strong> is your primary risk driver, accounting for <strong>{maxRiskAsset.RiskContribution.toFixed(1)}%</strong> of total portfolio volatility.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t">
                    <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center">
                      Asset Correlation Matrix
                      <InfoTooltip align="left" text="1.0 means assets move in perfect sync. 0.0 means no relationship. Negative numbers mean they move in opposite directions (a perfect hedge)." />
                    </h3>
                    <div className="overflow-x-auto pb-4">
                      <div className="inline-grid gap-1 justify-start" style={{ gridTemplateColumns: `auto repeat(${riskAttributionData.length}, 60px)` }}>
                        <div></div>
                        {riskAttributionData.map((asset, idx) => (
                          <div key={`col-${idx}`} className="text-center text-xs font-semibold text-slate-500 pb-2">
                            {asset.name}
                          </div>
                        ))}
                        {riskAttributionData.map((asset, rowIdx) => (
                          <div key={`row-wrapper-${rowIdx}`} className="contents">
                            <div className="flex items-center justify-end pr-4 text-xs font-semibold text-slate-500">
                              {asset.name}
                            </div>
                            {riskAttributionData.map((colAsset, colIdx) => {
                              const val = getCorrelation(asset.name, colAsset.name, rowIdx, colIdx);
                              return (
                                <div 
                                  key={`cell-${rowIdx}-${colIdx}`} 
                                  className="aspect-square rounded-md flex items-center justify-center text-xs font-medium transition-colors hover:brightness-90 cursor-default"
                                  style={{ backgroundColor: getHeatmapColor(val), color: Math.abs(val) > 0.4 ? 'white' : '#1e293b' }}
                                  title={`${asset.name} x ${colAsset.name}: ${val.toFixed(2)}`}
                                >
                                  {val.toFixed(2)}
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* Tab 4: Historical trends */}
                <TabsContent value="history" className="space-y-6">
                  <div className="w-full h-[450px]">
                    <h3 className="text-sm font-semibold text-slate-700 mb-4">Historical Asset Performance (Base 100)</h3>
                    <ResponsiveContainer width="99%" height="100%" minWidth={1} minHeight={1}>
                      <LineChart data={historyData} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis 
                          dataKey="date" 
                          stroke="#64748b" 
                          fontSize={12} 
                          tickLine={false} 
                          axisLine={false}
                          tickFormatter={(val) => {
                            const date = new Date(val);
                            return `${date.getMonth() + 1}/${date.getFullYear().toString().slice(2)}`;
                          }} 
                        />
                        <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                        <RechartsTooltip 
                          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                          formatter={(val) => val.toFixed(2)}
                        />
                        <Legend verticalAlign="top" height={36} wrapperStyle={{ paddingBottom: '10px' }} />
                        {Object.keys(results?.historical_prices || {}).map((ticker, idx) => (
                          <Line 
                            key={ticker} 
                            type="monotone" 
                            dataKey={ticker} 
                            stroke={LINE_COLORS[idx % LINE_COLORS.length]} 
                            strokeWidth={2} 
                            dot={false} 
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </TabsContent>

                {/* Tab 5: Optimal hedging */}
                <TabsContent value="hedging" className="space-y-6">
                  <div className="bg-amber-50 p-6 rounded-lg border border-amber-200 flex flex-col items-center justify-center text-center space-y-4">
                    <ShieldPlus className="w-12 h-12 text-amber-500" />
                    <div>
                      <h3 className="text-lg font-bold text-amber-900 mb-2 flex items-center justify-center">
                        Optimal Hedge Suggestion
                        <InfoTooltip align="center" text="Calculates the absolute difference between Normal VaR and Stress VaR to recommend a defensive cash/bond position." />
                      </h3>
                      <p className="text-amber-800 max-w-xl mx-auto leading-relaxed">
                        To neutralise the unnecessary risk identified in the Stress Test, consider reallocating 
                        <strong className="text-amber-900 font-extrabold text-xl ml-2 mr-2">
                          {(((riskMetrics.stressVaR - riskMetrics.normalVaR) / baseCapital) * 100).toFixed(2)}%
                        </strong>
                        of your portfolio to defensive or non-correlated assets.
                      </p>
                    </div>
                  </div>
                </TabsContent>

                {/* Tab 6: Raw market data */}
                <TabsContent value="data" className="space-y-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-semibold text-slate-700">Raw Historical Prices</h3>
                    <Button variant="outline" size="sm" onClick={downloadCSV}>
                      <Download className="w-4 h-4 mr-2" /> Download CSV
                    </Button>
                  </div>
                  <div className="border rounded-md overflow-x-auto max-h-[400px]">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-slate-500 uppercase bg-slate-50 sticky top-0 border-b">
                        <tr>
                          <th className="px-6 py-3 font-semibold">Date</th>
                          {Object.keys(results?.historical_prices || {}).map(ticker => (
                            <th key={ticker} className="px-6 py-3 font-semibold">{ticker}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {historyData.slice().reverse().map((row, i) => (
                          <tr key={i} className="bg-white border-b hover:bg-slate-50">
                            <td className="px-6 py-3 text-slate-500">{row.date}</td>
                            {Object.keys(results?.historical_prices || {}).map(ticker => (
                              <td key={`${i}-${ticker}`} className="px-6 py-3 font-medium">
                                ${row[`${ticker}_raw`]?.toFixed(2)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </TabsContent>

              </Tabs>
            )}

          </CardContent>
        </Card>
      </main>
    </div>
  )
}

export default App