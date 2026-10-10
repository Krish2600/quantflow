import React, { useState, useEffect, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { API_URL } from '../context/AuthContext';

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface StockChartProps {
  symbol: string;
  livePrice: number | null;
  lastCandleTime: number;
}

export const StockChart: React.FC<StockChartProps> = ({ symbol, livePrice, lastCandleTime }) => {
  const [history, setHistory] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<'live'>('live'); // Placeholder for multiple TF support

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch(`${API_URL}/stocks/${symbol}/history`);
        if (res.ok) {
          const data = await res.json();
          setHistory(data);
        }
      } catch (err) {
        console.error('Error fetching stock history:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [symbol, lastCandleTime]);

  // Merge the active livePrice tick into the final candle in the history array
  const chartData = useMemo(() => {
    if (history.length === 0 || livePrice === null) return history;
    
    const data = [...history];
    const lastIdx = data.length - 1;
    const lastCandle = { ...data[lastIdx] };

    // Update candle close with the live price tick
    lastCandle.close = livePrice;
    lastCandle.high = Math.max(lastCandle.high, livePrice);
    lastCandle.low = Math.min(lastCandle.low, livePrice);
    
    data[lastIdx] = lastCandle;
    return data;
  }, [history, livePrice]);

  const priceDirection = useMemo(() => {
    if (chartData.length < 2) return 'up';
    const first = chartData[0].close;
    const last = chartData[chartData.length - 1].close;
    return last >= first ? 'up' : 'down';
  }, [chartData]);

  const strokeColor = priceDirection === 'up' ? '#00e676' : '#ff1744';

  const formatTime = (ms: number) => {
    const date = new Date(ms);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  if (loading) {
    return (
      <div className="glass-panel" style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <p style={{ marginTop: '12px', color: 'var(--text-secondary)' }}>Loading chart history...</p>
      </div>
    );
  }

  return (
    <div className="glass-panel" style={styles.container}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.chartTitle}>{symbol} Price Chart</h2>
          <p style={styles.chartSubtitle}>Streaming active 30s candles</p>
        </div>
        <div style={styles.timeframeTabs}>
          <button 
            style={{...styles.tab, ...(timeframe === 'live' ? styles.activeTab : {})}}
            onClick={() => setTimeframe('live')}
          >
            Live Chart
          </button>
        </div>
      </div>

      <div style={styles.chartContainer}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={strokeColor} stopOpacity={0.25}/>
                <stop offset="95%" stopColor={strokeColor} stopOpacity={0.0}/>
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.03)" vertical={false} />
            <XAxis 
              dataKey="time" 
              tickFormatter={formatTime}
              stroke="var(--text-muted)" 
              fontSize={11}
              dy={10}
              tickLine={false}
            />
            <YAxis 
              domain={['auto', 'auto']}
              stroke="var(--text-muted)"
              fontSize={11}
              dx={-5}
              tickLine={false}
              tickFormatter={(val) => `$${val.toFixed(2)}`}
            />
            <Tooltip 
              content={<CustomTooltip />}
              cursor={{ stroke: 'rgba(255, 255, 255, 0.1)', strokeWidth: 1 }}
            />
            <Area 
              type="monotone" 
              dataKey="close" 
              stroke={strokeColor} 
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorPrice)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as Candle;
    const isGaining = data.close >= data.open;

    return (
      <div style={styles.tooltip}>
        <p style={styles.tooltipTime}>{new Date(data.time).toLocaleTimeString()}</p>
        <div style={styles.tooltipGrid}>
          <span style={styles.tooltipLabel}>Open:</span>
          <span style={styles.tooltipVal}>${data.open.toFixed(2)}</span>
          
          <span style={styles.tooltipLabel}>Close:</span>
          <span style={{...styles.tooltipVal, color: isGaining ? 'var(--color-success)' : 'var(--color-danger)'}}>
            ${data.close.toFixed(2)}
          </span>

          <span style={styles.tooltipLabel}>High:</span>
          <span style={styles.tooltipVal}>${data.high.toFixed(2)}</span>

          <span style={styles.tooltipLabel}>Low:</span>
          <span style={styles.tooltipVal}>${data.low.toFixed(2)}</span>
        </div>
      </div>
    );
  }
  return null;
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '24px',
    height: '420px',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
  },
  loadingContainer: {
    height: '420px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '3px solid rgba(0, 176, 255, 0.1)',
    borderTop: '3px solid var(--color-brand)',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  chartTitle: {
    fontSize: '1.2rem',
    fontWeight: '600',
  },
  chartSubtitle: {
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
    marginTop: '2px',
  },
  timeframeTabs: {
    display: 'flex',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    padding: '4px',
  },
  tab: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    padding: '6px 12px',
    fontSize: '0.8rem',
    fontWeight: '500',
    borderRadius: '6px',
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
    transition: 'all var(--transition-fast)',
  },
  activeTab: {
    backgroundColor: 'var(--color-brand-glow)',
    color: 'var(--color-brand)',
  },
  chartContainer: {
    flex: 1,
    width: '100%',
    minHeight: 0, // critical for Recharts responsive sizing
  },
  tooltip: {
    backgroundColor: '#1c1f2e',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    padding: '12px',
    boxShadow: 'var(--shadow-md)',
  },
  tooltipTime: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    marginBottom: '6px',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    paddingBottom: '4px',
  },
  tooltipGrid: {
    display: 'grid',
    gridTemplateColumns: 'auto auto',
    gap: '4px 12px',
    fontSize: '0.8rem',
  },
  tooltipLabel: {
    color: 'var(--text-secondary)',
  },
  tooltipVal: {
    fontWeight: '600',
    textAlign: 'right',
  },
};
