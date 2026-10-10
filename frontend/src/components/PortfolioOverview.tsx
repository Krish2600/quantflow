import React, { useMemo } from 'react';
import type { StockPrice } from '../hooks/useStockWS';

interface Holding {
  id: string;
  symbol: string;
  shares: number;
  averageBuyPrice: number; // local currency
  currentPrice: number;   // local currency
  marketValue: number;    // USD
  profitLoss: number;     // USD
  profitLossPercent: number;
  currency: 'USD' | 'INR';
}

interface Transaction {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  shares: number;
  price: number; // local currency
  timestamp: string;
}

interface PortfolioOverviewProps {
  portfolioData: {
    cash: number;
    holdingsValue: number;
    totalPortfolioValue: number;
    holdings: Holding[];
    usdInrRate?: number;
  } | null;
  transactions: Transaction[];
  stockMap: Record<string, StockPrice>;
  onSelectStock: (symbol: string) => void;
}

export const PortfolioOverview: React.FC<PortfolioOverviewProps> = ({
  portfolioData,
  transactions,
  stockMap,
  onSelectStock,
}) => {
  // Dynamically recalculate live holdings using real-time WS ticks, converting INR→USD
  const usdInrRate = portfolioData?.usdInrRate || 83.5;
  const liveStats = useMemo(() => {
    if (!portfolioData) return { cash: 0, holdingsValue: 0, totalPortfolioValue: 0, holdings: [] };

    let totalHoldingsValueUSD = 0;
    const liveHoldings = portfolioData.holdings.map((holding) => {
      const livePrice = stockMap[holding.symbol]?.price || holding.currentPrice;
      const isINR = holding.symbol.endsWith('.NS');
      const rate = isINR ? usdInrRate : 1.0;
      const marketValueUSD = parseFloat((holding.shares * livePrice / rate).toFixed(2));
      const totalCostUSD = parseFloat((holding.shares * holding.averageBuyPrice / rate).toFixed(2));
      const profitLossUSD = parseFloat((marketValueUSD - totalCostUSD).toFixed(2));
      const profitLossPercent = totalCostUSD > 0 ? parseFloat(((profitLossUSD / totalCostUSD) * 100).toFixed(2)) : 0;

      totalHoldingsValueUSD += marketValueUSD;

      return {
        ...holding,
        currentPrice: livePrice,
        marketValue: marketValueUSD,
        profitLoss: profitLossUSD,
        profitLossPercent,
      };
    });

    const totalPortfolioValue = parseFloat((portfolioData.cash + totalHoldingsValueUSD).toFixed(2));

    return {
      cash: portfolioData.cash,
      holdingsValue: parseFloat(totalHoldingsValueUSD.toFixed(2)),
      totalPortfolioValue,
      holdings: liveHoldings,
    };
  }, [portfolioData, stockMap, usdInrRate]);

  if (!portfolioData) {
    return (
      <div className="glass-panel" style={styles.loadingContainer}>
        <p>Loading portfolio data...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* 3-Card Summary Grid */}
      <div style={styles.summaryGrid}>
        <div className="glass-panel" style={styles.summaryCard}>
          <span style={styles.cardLabel}>Net Portfolio Value</span>
          <h3 style={{ ...styles.cardValue, color: 'var(--color-brand)' }}>
            ${liveStats.totalPortfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </h3>
        </div>
        <div className="glass-panel" style={styles.summaryCard}>
          <span style={styles.cardLabel}>Holdings Value</span>
          <h3 style={styles.cardValue}>
            ${liveStats.holdingsValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </h3>
        </div>
        <div className="glass-panel" style={styles.summaryCard}>
          <span style={styles.cardLabel}>Available Cash</span>
          <h3 style={{ ...styles.cardValue, color: 'var(--text-primary)' }}>
            ${liveStats.cash.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </h3>
        </div>
      </div>

      {/* Holdings Section */}
      <div className="glass-panel" style={styles.sectionPanel}>
        <h2 style={styles.sectionTitle}>Asset Holdings</h2>
        
        {liveStats.holdings.length === 0 ? (
          <div style={styles.emptyState}>
            <p>You don't hold any assets yet. Buy stocks to populate your portfolio!</p>
          </div>
        ) : (
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Asset</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Shares</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Avg. Cost</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Live Price</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Market Value</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Total Returns</th>
                </tr>
              </thead>
              <tbody>
                {liveStats.holdings.map((h) => {
                  const isPositive = h.profitLoss >= 0;
                  const isINR = h.symbol.endsWith('.NS');
                  const cs = isINR ? '₹' : '$';
                  return (
                    <tr 
                      key={h.id} 
                      style={styles.tr} 
                      onClick={() => onSelectStock(h.symbol)}
                    >
                      <td style={{ ...styles.td, fontWeight: '700', color: 'var(--text-primary)' }}>
                        <span style={styles.symbolLink}>{h.symbol}</span>
                        {isINR && <span className="currency-badge" style={{ marginLeft: 6 }}>NSE</span>}
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>{h.shares.toFixed(4)}</td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>{cs}{h.averageBuyPrice.toFixed(2)}</td>
                      <td style={{ ...styles.td, textAlign: 'right', fontWeight: '500' }}>
                        {cs}{h.currentPrice.toFixed(2)}
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right', fontWeight: '600' }}>
                        ${h.marketValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td
                        style={{
                          ...styles.td,
                          textAlign: 'right',
                          color: isPositive ? 'var(--color-success)' : 'var(--color-danger)',
                          fontWeight: '600',
                        }}
                      >
                        {isPositive ? '+' : ''}${h.profitLoss.toFixed(2)} ({isPositive ? '+' : ''}{h.profitLossPercent.toFixed(2)}%)
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Transaction History Section */}
      <div className="glass-panel" style={styles.sectionPanel}>
        <h2 style={styles.sectionTitle}>Transaction History</h2>
        
        {transactions.length === 0 ? (
          <div style={styles.emptyState}>
            <p>No transactions logged. Complete a trade to view history.</p>
          </div>
        ) : (
          <div style={{ ...styles.tableWrapper, maxHeight: '250px', overflowY: 'auto' }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Date & Time</th>
                  <th style={styles.th}>Asset</th>
                  <th style={styles.th}>Action</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Shares</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Exec. Price</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Total Value</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => {
                  const isBuy = tx.type === 'BUY';
                  return (
                    <tr key={tx.id} style={styles.trStatic}>
                      <td style={{ ...styles.td, color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        {new Date(tx.timestamp).toLocaleString()}
                      </td>
                      <td style={{ ...styles.td, fontWeight: '600' }}>{tx.symbol}</td>
                      <td style={styles.td}>
                        <span
                          style={{
                            ...styles.badge,
                            backgroundColor: isBuy ? 'var(--color-brand-glow)' : 'var(--color-success-bg)',
                            color: isBuy ? 'var(--color-brand)' : 'var(--color-success)',
                          }}
                        >
                          {tx.type}
                        </span>
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>{tx.shares.toFixed(4)}</td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>
                        {tx.symbol.endsWith('.NS') ? '₹' : '$'}{tx.price.toFixed(2)}
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right', fontWeight: '500' }}>
                        {tx.symbol.endsWith('.NS') ? '₹' : '$'}{(tx.shares * tx.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  loadingContainer: {
    padding: '40px',
    textAlign: 'center',
    color: 'var(--text-secondary)',
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '20px',
  },
  summaryCard: {
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  cardLabel: {
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
    fontWeight: '500',
  },
  cardValue: {
    fontSize: '1.6rem',
    fontWeight: '700',
  },
  sectionPanel: {
    padding: '24px',
  },
  sectionTitle: {
    fontSize: '1.1rem',
    fontWeight: '600',
    marginBottom: '16px',
  },
  emptyState: {
    padding: '20px',
    textAlign: 'center',
    color: 'var(--text-secondary)',
    fontSize: '0.9rem',
    border: '1px dashed var(--border-color)',
    borderRadius: '8px',
  },
  tableWrapper: {
    width: '100%',
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.9rem',
  },
  th: {
    color: 'var(--text-secondary)',
    fontWeight: '500',
    fontSize: '0.8rem',
    padding: '10px 12px',
    borderBottom: '1px solid var(--border-color)',
    textAlign: 'left',
  },
  tr: {
    borderBottom: '1px solid var(--border-color)',
    cursor: 'pointer',
    transition: 'background var(--transition-fast)',
  },
  trStatic: {
    borderBottom: '1px solid var(--border-color)',
  },
  td: {
    padding: '12px',
    color: 'var(--text-secondary)',
    verticalAlign: 'middle',
  },
  symbolLink: {
    color: 'var(--color-brand)',
    textDecoration: 'none',
    borderBottom: '1px solid transparent',
    transition: 'border-color var(--transition-fast)',
  },
  badge: {
    padding: '4px 8px',
    borderRadius: '6px',
    fontSize: '0.75rem',
    fontWeight: '600',
  },
};
// Add custom hover style to tr using stylesheet dynamically or inline
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.innerHTML = `
    tbody tr:hover {
      background-color: var(--bg-card-hover) !important;
    }
  `;
  document.head.appendChild(style);
}
