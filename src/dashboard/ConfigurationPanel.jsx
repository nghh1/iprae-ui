import { ShieldAlert, Loader2, Plus, Trash2, PieChart } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { motion, AnimatePresence } from 'framer-motion';

export const ConfigurationPanel = ({ state, setters, runSimulation, loading }) => {
  
  // --- DYNAMIC ASSET HANDLERS ---
  const handleAddAsset = () => {
    setters.setAssets([...state.assets, { id: Date.now(), ticker: "", weight: 0 }]);
  };

  const handleRemoveAsset = (id) => {
    if (state.assets.length <= 1) return; // Prevent deleting the last row
    setters.setAssets(state.assets.filter(a => a.id !== id));
  };

  const handleAssetChange = (id, field, value) => {
    setters.setAssets(state.assets.map(a => a.id === id ? { ...a, [field]: value } : a));
  };

  // Calculate total weight to validate (must equal exactly 100%)
  const totalWeight = state.assets.reduce((sum, asset) => sum + (parseFloat(asset.weight) || 0), 0);
  const isWeightValid = Math.abs(totalWeight - 100) < 0.01;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Portfolio Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {/* --- NEW DYNAMIC ASSET UI --- */}
          <div className="space-y-3">
            <Label className="flex items-center">
              Asset Allocation
              <InfoTooltip align="center" side="bottom" text="Add the stock tickers in your portfolio and their target weights. Total must equal 100%." />
            </Label>
            
            <div className="space-y-2">
              <div className="flex gap-2 px-1">
                <span className="text-xs font-semibold text-slate-500 uppercase flex-1">Ticker</span>
                <span className="text-xs font-semibold text-slate-500 uppercase w-24 text-center">Weight (%)</span>
                <span className="w-8"></span> {/* Empty space for trash icon alignment */}
              </div>
              
              <AnimatePresence initial={false}>
                {state.assets.map((asset) => (
                  <motion.div 
                    key={asset.id} 
                    initial={{ opacity: 0, height: 0, overflow: "hidden" }}
                    animate={{ opacity: 1, height: "auto", overflow: "visible" }}
                    exit={{ opacity: 0, height: 0, overflow: "hidden" }}
                    transition={{ duration: 0.2 }}
                    className="flex gap-2 items-center"
                  >
                    <Input 
                      placeholder="e.g. AAPL" 
                      value={asset.ticker} 
                      onChange={(e) => handleAssetChange(asset.id, 'ticker', e.target.value.toUpperCase())}
                      className="flex-1 uppercase font-medium"
                    />
                    <Input 
                      type="number" 
                      placeholder="0" 
                      value={asset.weight} 
                      onChange={(e) => handleAssetChange(asset.id, 'weight', e.target.value)}
                      className="w-24 text-center"
                    />
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleRemoveAsset(asset.id)}
                      disabled={state.assets.length <= 1}
                      className="h-10 w-10 text-slate-400 hover:text-red-500 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button variant="outline" size="sm" onClick={handleAddAsset} className="text-blue-600 border-blue-200 hover:bg-blue-50">
                <Plus className="h-4 w-4 mr-1" /> Add Asset
              </Button>
              <div className={`text-sm font-semibold flex items-center px-3 py-1.5 rounded-md ${isWeightValid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                <PieChart className="w-4 h-4 mr-2" />
                Total: {totalWeight.toFixed(1)}%
              </div>
            </div>
          </div>
          {/* --- END DYNAMIC ASSET UI --- */}

          <div className="space-y-2 border-t pt-4">
            <Label className="flex items-center">
              Capital ($)
              <InfoTooltip align="left" text="The total initial cash value of the portfolio at the start of the simulation." />
            </Label>
            <Input type="number" value={state.baseCapital} onChange={(e) => setters.setBaseCapital(e.target.value)} />
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="space-y-2 w-full max-w-[200px] sm:max-w-none sm:flex-1">
              <Label className="flex items-center text-sm tracking-tight">
                Start Date
                <InfoTooltip align="left" text="The beginning of the historical lookback period used to calculate volatility and drift." />
              </Label>
              <Input type="date" value={state.startDate} onChange={(e) => setters.setStartDate(e.target.value)} />
            </div>
            
            <div className="space-y-2 w-full max-w-[200px] sm:max-w-none sm:flex-1">
              <Label className="flex items-center text-sm tracking-tight">
                End Date
                <InfoTooltip align="left" text="The end of the historical lookback period." />
              </Label>
              <Input type="date" value={state.endDate} onChange={(e) => setters.setEndDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <Label className="flex items-center">
              Forecast Horizon (Days)
              <InfoTooltip align="center" text="Number of trading days to project into the future (e.g., 60 days is roughly 3 months)." />
            </Label>
            <div className="flex items-center gap-3">
              <input type="range" min="5" max="252" step="1" value={state.dayHorizon} onChange={(e) => setters.setDayHorizon(e.target.value)} className="flex-1 accent-blue-600 cursor-pointer" />
              <Input type="number" className="w-20 text-right h-8" value={state.dayHorizon} onChange={(e) => setters.setDayHorizon(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center">
              Simulations
              <InfoTooltip align="left" text="Number of simulated futures. Higher numbers increase accuracy but take longer to calculate." />
            </Label>
            <div className="flex items-center gap-3">
              <input type="range" min="100" max="5000" step="100" value={state.simulations} onChange={(e) => setters.setSimulations(e.target.value)} className="flex-1 accent-blue-600 cursor-pointer" />
              <Input type="number" className="w-20 text-right h-8" value={state.simulations} onChange={(e) => setters.setSimulations(e.target.value)} />
            </div>
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <input type="checkbox" id="rebalance" checked={state.rebalance} onChange={(e) => setters.setRebalance(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
            <Label htmlFor="rebalance" className="cursor-pointer flex items-center">
              Enable Daily Rebalancing
              <InfoTooltip align="center" text="If checked, the engine forces the portfolio back to target weights every day. If unchecked, winners will drift and overweight naturally." />
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
          <div className="space-y-2">
            <Label className="flex items-center">
              Volatility Multiplier (x)
              <InfoTooltip align="center" side="bottom" text="Scales the volatility. The market will swing as violently as it did in the past." />
            </Label>
            <div className="flex items-center gap-3">
              <input type="range" min="1.0" max="5.0" step="0.1" value={state.shockVol} onChange={(e) => setters.setShockVol(e.target.value)} className="flex-1 accent-red-600 cursor-pointer" />
              <Input type="number" step="0.1" className="w-20 text-right h-8" value={state.shockVol} onChange={(e) => setters.setShockVol(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center">
              Overnight Gap Down (%)
              <InfoTooltip align="center" text="Simulates an instant market crash on Day 1 of the simulation before the random paths begin." />
            </Label>
            <div className="flex items-center gap-3">
              <input type="range" min="-20.0" max="0.0" step="0.5" value={state.mktGap} onChange={(e) => setters.setMktGap(e.target.value)} className="flex-1 accent-red-600 cursor-pointer" />
              <Input type="number" step="0.5" className="w-20 text-right h-8" value={state.mktGap} onChange={(e) => setters.setMktGap(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center">
              Annualised Negative Drift
              <InfoTooltip align="center" text="Simulates a sustained Bear Market. A value of -0.20 forces the engine to trend downward 20% annualised." />
            </Label>
            <div className="flex items-center gap-3">
              <input type="range" min="-1.0" max="0.5" step="0.05" value={state.meanShock} onChange={(e) => setters.setMeanShock(e.target.value)} className="flex-1 accent-red-600 cursor-pointer" />
              <Input type="number" step="0.05" className="w-20 text-right h-8" value={state.meanShock} onChange={(e) => setters.setMeanShock(e.target.value)} />
            </div>
          </div>

          <div className="pt-2">
            {/* Wrap the button in a motion.div for a satisfying click effect */}
            <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.97 }}>
              <Button className="w-full" onClick={runSimulation} disabled={loading || !isWeightValid}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {!isWeightValid ? "Weights must equal 100%" : (loading ? "Calculating..." : "Run Engine")}
              </Button>
            </motion.div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};