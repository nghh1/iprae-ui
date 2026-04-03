import { useMemo } from 'react';
import { Loader2, AlertTriangle, ChartColumn, ChartSpline, TrendingUp, ShieldPlus, Database, Download } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { motion, AnimatePresence } from 'framer-motion';

const LINE_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316'];

export const ResultsPanel = ({ results, loading, error, baseCapital, dayHorizon, tickers, weights }) => {
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

    return { normalVaR, stressVaR, normalCVaR, stressCVaR, normalSortino: calcSortino(finalGeneral), stressSortino: calcSortino(finalCrash) };
  }, [results, baseCapital, dayHorizon]);

  const processChartData = (matrix) => {
    if (!matrix) return [];
    return matrix.map((dayPaths, index) => {
      const sorted = [...dayPaths].sort((a, b) => a - b);
      return {
        day: index, expected: Math.round(sorted[Math.floor(sorted.length * 0.5)]),
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
    } catch (e) { return []; }
  }, [results]);

  const downloadCSV = () => {
    if (!historyData.length) return;
    const tks = Object.keys(results.historical_prices);
    let csvContent = "Date," + tks.join(",") + "\n";
    historyData.forEach(row => { csvContent += [row.date, ...tks.map(t => row[`${t}_raw`].toFixed(4))].join(",") + "\n"; });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }));
    link.download = `portfolio_data_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <Card className="lg:col-span-2 flex flex-col overflow-hidden">
      <CardHeader>
        <CardTitle>Simulation Results</CardTitle>
        <CardDescription>Compare normal conditions vs. severe market crashes.</CardDescription>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col border-t p-6 relative">
        {/* ADD ANIMATE PRESENCE FOR SMOOTH MOUNTING/UNMOUNTING */}
        <AnimatePresence mode="wait">
          
          {/* INITIAL STATE */}
          {!loading && !results && !error && (
            <motion.div 
              key="empty"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex-1 min-h-[400px] flex items-center justify-center text-slate-400 text-sm"
            >
              Configure portfolio and run engine...
            </motion.div>
          )}
          
          {/* LOADING STATE */}
          {loading && (
            <motion.div 
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 min-h-[400px] flex flex-col items-center justify-center space-y-6"
            >
              <div className="flex flex-col items-center text-blue-600">
                <Loader2 className="h-10 w-10 animate-spin mb-4" />
                <p className="text-sm font-medium animate-pulse">Running Monte Carlo Simulations...</p>
              </div>
            </motion.div>
          )}

          {/* ERROR STATE */}
          {error && (
            <motion.div 
              key="error"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="text-red-500 bg-red-50 p-4 rounded-md w-full border border-red-200"
            >
              <p className="font-semibold flex items-center"><AlertTriangle className="w-4 h-4 mr-2" /> Engine Error:</p>
              <p className="text-sm mt-1">{error}</p>
            </motion.div>
          )}

          {/* SUCCESS STATE (Results) */}
          {results && riskMetrics && !loading && (
            <motion.div 
              key="results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="w-full"
            >
              <Tabs defaultValue="normal" className="w-full">
                <TabsList className="grid w-full grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 p-1 mb-6 bg-slate-200/50 rounded-lg" style={{ height: 'auto' }}>
                  <TabsTrigger value="normal"><ChartSpline className="w-4 h-4 mr-2 hidden sm:inline-block" /> Normal</TabsTrigger>
                  <TabsTrigger value="stress" className="data-[state=active]:bg-red-50 data-[state=active]:text-red-700">
                    <AlertTriangle className="w-4 h-4 mr-2 hidden sm:inline-block" /> Stress</TabsTrigger>
                  <TabsTrigger value="attribution"><ChartColumn className="w-4 h-4 mr-2 hidden sm:inline-block" /> Risk</TabsTrigger>
                  <TabsTrigger value="history"><TrendingUp className="w-4 h-4 mr-2 hidden sm:inline-block" /> History</TabsTrigger>
                  <TabsTrigger value="hedging"><ShieldPlus className="w-4 h-4 mr-2 hidden sm:inline-block" /> Hedging</TabsTrigger>
                  <TabsTrigger value="data"><Database className="w-4 h-4 mr-2 hidden sm:inline-block" /> Data</TabsTrigger>
                </TabsList>

                {/* TAB 1: NORMAL MARKET */}
                <TabsContent value="normal" className="space-y-6">
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                      <p className="text-xs font-semibold text-slate-500 uppercase flex items-center">VaR (95%) <InfoTooltip align="left" text="Value at Risk. Maximum expected loss with 95% confidence." /></p>
                      <p className="text-xl font-bold text-slate-900">${riskMetrics.normalVaR.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                      <p className="text-xs font-semibold text-slate-500 uppercase flex items-center">CVaR (Tail Risk) <InfoTooltip align="center" text="Conditional Value at Risk. Average expected loss during a crash." /></p>
                      <p className="text-xl font-bold text-slate-900">${riskMetrics.normalCVaR.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                      <p className="text-xs font-semibold text-slate-500 uppercase flex items-center">Sortino Ratio <InfoTooltip align="center" text="Risk-adjusted return focusing on downside volatility." /></p>
                      <p className="text-xl font-bold text-slate-900">{riskMetrics.normalSortino.toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="w-full h-[350px]">
                    <ResponsiveContainer width="99%" height="100%" minWidth={1} minHeight={1}>
                      <LineChart data={normalChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="day" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis domain={['auto', 'auto']} stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value.toLocaleString()}`} />
                        <RechartsTooltip formatter={(value) => `$${value.toLocaleString()}`} contentStyle={{ borderRadius: '8px', border: 'none' }} />
                        <Legend />
                        <Line type="monotone" dataKey="upperBound" name="95th Percentile" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                        <Line type="monotone" dataKey="expected" name="Expected Path (Median)" stroke="#2563eb" strokeWidth={3} dot={false} />
                        <Line type="monotone" dataKey="lowerBound" name="5th Percentile" stroke="#f43f5e" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </TabsContent>

                {/* TAB 2: STRESS TEST */}
                <TabsContent value="stress" className="space-y-6">
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Stress VaR */}
                    <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                      <p className="text-xs font-semibold text-red-700 uppercase flex items-center">
                        Stress VaR <InfoTooltip align="left" text="Value at Risk under severe crash parameters." />
                      </p>
                      <p className="text-xl font-bold text-red-900">${riskMetrics.stressVaR.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
                      <p className="text-xs text-red-600 mt-1 font-medium">
                        {riskMetrics.normalVaR > 0 ? `${(((riskMetrics.stressVaR / riskMetrics.normalVaR) - 1) * 100 > 0 ? '+' : '')}${(((riskMetrics.stressVaR / riskMetrics.normalVaR) - 1) * 100).toFixed(1)}% vs Normal` : "New Risk"}
                      </p>
                    </div>
                    
                    {/* Stress CVaR */}
                    <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                      <p className="text-xs font-semibold text-red-700 uppercase flex items-center">
                        Stress CVaR <InfoTooltip align="center" text="Average expected loss during worst-case crashes." />
                      </p>
                      <p className="text-xl font-bold text-red-900">${riskMetrics.stressCVaR.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
                      <p className="text-xs text-red-600 mt-1 font-medium">
                        {riskMetrics.normalCVaR > 0 ? `${(((riskMetrics.stressCVaR / riskMetrics.normalCVaR) - 1) * 100 > 0 ? '+' : '')}${(((riskMetrics.stressCVaR / riskMetrics.normalCVaR) - 1) * 100).toFixed(1)}% vs Normal` : "New Risk"}
                      </p>
                    </div>
                    
                    {/* Stress Sortino */}
                    <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                      <p className="text-xs font-semibold text-red-700 uppercase flex items-center">
                        Stress Sortino <InfoTooltip align="center" text="Risk-adjusted return during a bear market drift." />
                      </p>
                      <p className="text-xl font-bold text-red-900">{riskMetrics.stressSortino.toFixed(2)}</p>
                      <p className="text-xs text-red-600 mt-1 font-medium">
                        {(riskMetrics.stressSortino - riskMetrics.normalSortino).toFixed(2)} difference
                      </p>
                    </div>

                  </div>

                  {/* STRESS CHART */}
                  <div className="w-full h-[350px]">
                    <ResponsiveContainer width="99%" height="100%" minWidth={1} minHeight={1}>
                      <LineChart data={stressChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="day" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis domain={['auto', 'auto']} stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value.toLocaleString()}`} />
                        <RechartsTooltip formatter={(value) => `$${value.toLocaleString()}`} contentStyle={{ borderRadius: '8px', border: 'none' }} />
                        <Legend />
                        <Line type="monotone" dataKey="upperBound" name="95th Pctl (Crash)" stroke="#fca5a5" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                        <Line type="monotone" dataKey="expected" name="Expected Crash Path" stroke="#dc2626" strokeWidth={3} dot={false} />
                        <Line type="monotone" dataKey="lowerBound" name="5th Pctl (Crash)" stroke="#991b1b" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </TabsContent>

                {/* TAB 3: RISK ATTRIBUTION */}
                <TabsContent value="attribution" className="space-y-6">
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                      <p className="text-xs font-semibold text-slate-500 uppercase flex items-center">Diversification Ratio</p>
                      <p className="text-2xl font-bold text-slate-900">{results.diversification_ratio?.toFixed(2) || "N/A"}</p>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 flex flex-col justify-center">
                      <p className="text-sm font-semibold text-blue-700">Primary Risk Driver</p>
                      <p className="text-xs text-blue-900">{maxRiskAsset ? `${maxRiskAsset.name} accounts for ${maxRiskAsset.RiskContribution.toFixed(1)}% of total risk.` : "N/A"}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t">
                    {/* Left Side: Bar Chart */}
                    <div className="md:col-span-2 h-[250px]">
                      <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center">Allocation vs Risk Contribution (%)</h3>
                      <ResponsiveContainer width="99%" height="100%" minWidth={1} minHeight={1}>
                        <BarChart data={riskAttributionData} margin={{ top: 5, right: 30, left: -20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                          <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                          <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none' }} />
                          <Legend verticalAlign="top" height={36} />
                          <Bar dataKey="Allocation" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="RiskContribution" name="Risk Contribution" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Right Side: Correlation Matrix */}
                    <div className="pt-4 md:pt-0 border-t md:border-t-0 flex flex-col h-[250px]">
                      <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center">Correlation Matrix</h3>
                      <div className="overflow-x-auto pb-4">
                        <div className="inline-grid gap justify-start" style={{ gridTemplateColumns: `auto repeat(${riskAttributionData.length}, 56px)` }}>
                          <div></div>
                          {riskAttributionData.map((asset, idx) => (
                            <div key={`col-${idx}`} className="text-center text-sm font-semibold text-slate-500 pb-2">{asset.name}</div>
                          ))}
                          {riskAttributionData.map((asset, rowIdx) => (
                            <div key={`row-wrapper-${rowIdx}`} className="contents">
                              <div className="flex items-center justify-end pr-3 text-sm font-semibold text-slate-500">{asset.name}</div>
                              {riskAttributionData.map((colAsset, colIdx) => {
                                const val = getCorrelation(asset.name, colAsset.name, rowIdx, colIdx);
                                return (
                                  <div 
                                    key={`cell-${rowIdx}-${colIdx}`} 
                                    className="aspect-square rounded-md flex items-center justify-center text-sm font-medium" 
                                    style={{ backgroundColor: getHeatmapColor(val), color: Math.abs(val) > 0.4 ? 'white' : '#1e293b' }}
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
                  </div>
                </TabsContent>

                {/* TAB 4: HISTORICAL TRENDS */}
                <TabsContent value="history" className="space-y-6">
                  
                  <div className="w-full h-[450px]">
                    <h3 className="text-sm font-semibold text-slate-700 mb-4">Historical Asset Performance (Base 100)</h3>
                    <ResponsiveContainer width="99%" height="100%" minWidth={1} minHeight={1}>
                      <LineChart data={historyData} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `${new Date(val).getMonth() + 1}/${new Date(val).getFullYear().toString().slice(2)}`} />
                        <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                        <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none' }} formatter={(val) => val.toFixed(2)} />
                        <Legend verticalAlign="top" height={36} />
                        {Object.keys(results?.historical_prices || {}).map((ticker, idx) => (
                          <Line key={ticker} type="monotone" dataKey={ticker} stroke={LINE_COLORS[idx % LINE_COLORS.length]} strokeWidth={2} dot={false} />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </TabsContent>

                <TabsContent value="hedging" className="space-y-6">
                   <div className="bg-amber-50 p-6 rounded-lg border border-amber-200 flex flex-col items-center justify-center text-center space-y-4">
                    <ShieldPlus className="w-12 h-12 text-amber-500" />
                    <div>
                      <h3 className="text-lg font-bold text-amber-900 mb-2">Optimal Hedge Suggestion</h3>
                      <p className="text-amber-800 max-w-xl mx-auto leading-relaxed">Consider reallocating <strong className="text-amber-900 font-extrabold text-xl ml-2 mr-2">{(((riskMetrics.stressVaR - riskMetrics.normalVaR) / baseCapital) * 100).toFixed(2)}%</strong> to defensive assets.</p>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="data" className="space-y-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-semibold text-slate-700">Raw Historical Prices</h3>
                    <Button variant="outline" size="sm" onClick={downloadCSV}><Download className="w-4 h-4 mr-2" /> Download CSV</Button>
                  </div>
                  <div className="border rounded-md overflow-x-auto max-h-[400px]">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-slate-500 uppercase bg-slate-50 sticky top-0 border-b">
                        <tr><th className="px-6 py-3">Date</th>{Object.keys(results?.historical_prices || {}).map(ticker => (<th key={ticker} className="px-6 py-3">{ticker}</th>))}</tr>
                      </thead>
                      <tbody>
                        {historyData.slice().reverse().map((row, i) => (
                          <tr key={i} className="bg-white border-b"><td className="px-6 py-3">{row.date}</td>{Object.keys(results?.historical_prices || {}).map(ticker => (<td key={`${i}-${ticker}`} className="px-6 py-3">${row[`${ticker}_raw`]?.toFixed(2)}</td>))}</tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </TabsContent>
              </Tabs>
            </motion.div>
          )}

        </AnimatePresence>
      </CardContent>
    </Card>
  );
};
