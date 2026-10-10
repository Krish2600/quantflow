import React, { useState, useEffect, useCallback } from 'react';
import { useAuth, API_URL } from '../context/AuthContext';
import { useStockWS } from '../hooks/useStockWS';
import { StockChart } from './StockChart';
import { TradingPanel } from './TradingPanel';
import { PortfolioOverview } from './PortfolioOverview';

export const Dashboard: React.FC = () => {
  const { user, logout, token } = useAuth();
  const { stocks, stockMap, isConnected, lastCandleTime } = useStockWS();
  const [selectedSymbol, setSelectedSymbol] = useState('AAPL');
  const [portfolioData, setPortfolioData] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [categoryTab, setCategoryTab] = useState<'ALL' | 'US_STOCKS' | 'IN_STOCKS' | 'COMMODITIES' | 'ETFS' | 'MUTUAL_FUNDS'>('ALL');

  const filteredStocks = stocks.filter(
    (stock) => categoryTab === 'ALL' || stock.category === categoryTab
  );

  // Fetch portfolio data from HTTP API
  const fetchPortfolio = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/portfolio`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPortfolioData(data);
      }
    } catch (err) {
      console.error('Error fetching portfolio:', err);
    }
  }, [token]);

  // Fetch transaction ledger
  const fetchTransactions = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/portfolio/transactions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTransactions(data);
      }
    } catch (err) {
      console.error('Error fetching transactions:', err);
    }
  }, [token]);

  // Refresh all data (called on mount or after a trade order succeeds)
  const refreshAllData = useCallback(() => {
    fetchPortfolio();
    fetchTransactions();
  }, [fetchPortfolio, fetchTransactions]);

  useEffect(() => {
    refreshAllData();
  }, [refreshAllData]);

  // Find holding details for the active stock
  const activeHolding = portfolioData?.holdings.find(
    (h: any) => h.symbol === selectedSymbol
  ) || null;

  const activeStock = stockMap[selectedSymbol] || null;

  return (
    <div className="app-container" style={styles.app}>
      {/* Header Navigation */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.logoIcon}>⚡</div>
          <span style={styles.logoText}>QuantFlow</span>
          <span
            style={{
              ...styles.statusIndicator,
              backgroundColor: isConnected ? 'var(--color-success)' : 'var(--color-danger)',
              boxShadow: isConnected ? '0 0 8px var(--color-success)' : '0 0 8px var(--color-danger)',
            }}
            title={isConnected ? 'Live Market Feed Connected' : 'Market Feed Offline'}
          />
        </div>
        <div style={styles.headerRight}>
          <div style={styles.userInfo}>
            <span style={styles.userEmail}>{user?.email}</span>
            <span style={styles.userBalance}>
              Balance: ${portfolioData?.totalPortfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'}
            </span>
          </div>
          <button onClick={logout} className="btn-secondary" style={styles.logoutBtn}>
            Logout
          </button>
        </div>
      </header>

      {/* Main Grid Layout */}
      <main className="dashboard-grid">
        {/* Watchlist Sidebar */}
        <section className="glass-panel stocks-sidebar" style={styles.sidebar}>
          <h2 style={styles.sidebarTitle}>Watchlist</h2>
          
          <div className="tab-filter-container">
            <button 
              className={`filter-tab ${categoryTab === 'ALL' ? 'active' : ''}`}
              onClick={() => setCategoryTab('ALL')}
            >
              All
            </button>
            <button 
              className={`filter-tab ${categoryTab === 'US_STOCKS' ? 'active' : ''}`}
              onClick={() => setCategoryTab('US_STOCKS')}
            >
              US Stocks
            </button>
            <button 
              className={`filter-tab ${categoryTab === 'IN_STOCKS' ? 'active' : ''}`}
              onClick={() => setCategoryTab('IN_STOCKS')}
            >
              IN Stocks
            </button>
            <button 
              className={`filter-tab ${categoryTab === 'COMMODITIES' ? 'active' : ''}`}
              onClick={() => setCategoryTab('COMMODITIES')}
            >
              Gold/Metal
            </button>
            <button 
              className={`filter-tab ${categoryTab === 'ETFS' ? 'active' : ''}`}
              onClick={() => setCategoryTab('ETFS')}
            >
              ETFs
            </button>
            <button 
              className={`filter-tab ${categoryTab === 'MUTUAL_FUNDS' ? 'active' : ''}`}
              onClick={() => setCategoryTab('MUTUAL_FUNDS')}
            >
              Funds
            </button>
          </div>

          <div style={styles.stockList}>
            {filteredStocks.map((stock) => {
              const isPositive = stock.change >= 0;
              const flashClass = stock.flash === 'up' ? 'flash-up' : stock.flash === 'down' ? 'flash-down' : '';
              const currencySymbol = stock.currency === 'INR' ? '₹' : '$';
              
              return (
                <div
                  key={stock.symbol}
                  className={`stock-item ${flashClass} ${selectedSymbol === stock.symbol ? 'selected-stock' : ''}`}
                  style={{
                    ...styles.stockCard,
                    ...(selectedSymbol === stock.symbol ? styles.stockCardSelected : {}),
                  }}
                  onClick={() => setSelectedSymbol(stock.symbol)}
                >
                  <div style={styles.stockRow}>
                    <span style={styles.stockSymbol}>{stock.symbol}</span>
                    <span style={styles.stockPrice}>
                      {currencySymbol}{stock.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div style={styles.stockRow}>
                    <span style={styles.stockName}>{stock.name}</span>
                    <span
                      style={{
                        ...styles.stockChange,
                        color: isPositive ? 'var(--color-success)' : 'var(--color-danger)',
                      }}
                    >
                      {isPositive ? '+' : ''}{currencySymbol}{Math.abs(stock.change).toLocaleString(undefined, { minimumFractionDigits: 2 })} ({isPositive ? '+' : ''}{stock.changePercent.toFixed(2)}%)
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Center Panel (Chart & Portfolio) */}
        <section style={styles.mainContent}>
          {/* Active Stock Banner & Chart */}
          <div className="glass-panel" style={styles.chartWrapper}>
            {activeStock && (
              <div style={styles.stockBanner}>
                <div style={styles.bannerLeft}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h1 style={styles.bannerSymbol}>{activeStock.symbol}</h1>
                    <span className="currency-badge">{activeStock.currency}</span>
                    <span className="category-badge">{activeStock.category.replace('_', ' ')}</span>
                  </div>
                  <span style={styles.bannerName}>{activeStock.name}</span>
                </div>
                <div style={styles.bannerRight}>
                  <h2 style={styles.bannerPrice}>
                    {activeStock.currency === 'INR' ? '₹' : '$'}{activeStock.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </h2>
                  <span
                    style={{
                      ...styles.bannerChange,
                      color: activeStock.change >= 0 ? 'var(--color-success)' : 'var(--color-danger)',
                    }}
                  >
                    {activeStock.change >= 0 ? '+' : ''}{activeStock.currency === 'INR' ? '₹' : '$'}{Math.abs(activeStock.change).toLocaleString(undefined, { minimumFractionDigits: 2 })} ({activeStock.change >= 0 ? '+' : ''}{activeStock.changePercent.toFixed(2)}%)
                  </span>
                </div>
              </div>
            )}

            <StockChart
              symbol={selectedSymbol}
              livePrice={activeStock?.price || null}
              lastCandleTime={lastCandleTime}
            />
          </div>

          {/* Portfolio Overview */}
          <PortfolioOverview
            portfolioData={portfolioData}
            transactions={transactions}
            stockMap={stockMap}
            onSelectStock={setSelectedSymbol}
          />
        </section>

        {/* Right Side Order Panel */}
        <section className="trading-sidebar" style={styles.tradeSidebar}>
          <TradingPanel
            symbol={selectedSymbol}
            livePrice={activeStock?.price || null}
            userBalance={portfolioData?.cash || 0}
            holding={activeHolding}
            usdInrRate={portfolioData?.usdInrRate || 83.5}
            onTradeSuccess={refreshAllData}
          />
        </section>
      </main>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  app: {
    backgroundColor: 'var(--bg-main)',
    minHeight: '100vh',
  },
  header: {
    height: '64px',
    borderBottom: '1px solid var(--border-color)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 24px',
    backgroundColor: '#0e1017',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  logoIcon: {
    fontSize: '1.5rem',
    textShadow: '0 0 10px rgba(0, 176, 255, 0.4)',
  },
  logoText: {
    fontSize: '1.25rem',
    fontWeight: '800',
    letterSpacing: '-0.5px',
    background: 'linear-gradient(135deg, #fff 0%, #00b0ff 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  statusIndicator: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    marginLeft: '6px',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
  },
  userInfo: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '2px',
  },
  userEmail: {
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
  },
  userBalance: {
    fontSize: '0.9rem',
    fontWeight: '600',
    color: 'var(--color-brand)',
  },
  logoutBtn: {
    padding: '6px 14px',
    fontSize: '0.8rem',
  },
  sidebar: {
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    height: 'calc(100vh - 104px)',
    overflowY: 'auto',
  },
  sidebarTitle: {
    fontSize: '1.1rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
  },
  stockList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  stockCard: {
    padding: '14px',
    borderRadius: '8px',
    border: '1px solid var(--border-color)',
    cursor: 'pointer',
    backgroundColor: 'rgba(255, 255, 255, 0.01)',
    transition: 'all var(--transition-fast)',
  },
  stockCardSelected: {
    borderColor: 'var(--color-brand)',
    backgroundColor: 'var(--color-brand-glow)',
  },
  stockRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stockSymbol: {
    fontWeight: '700',
    fontSize: '0.95rem',
  },
  stockPrice: {
    fontWeight: '600',
    fontSize: '0.95rem',
  },
  stockName: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    marginTop: '4px',
  },
  stockChange: {
    fontSize: '0.8rem',
    fontWeight: '500',
    marginTop: '4px',
  },
  mainContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  chartWrapper: {
    padding: '24px 24px 0 24px',
    backgroundColor: 'var(--bg-card)',
  },
  stockBanner: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '16px',
  },
  bannerLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  bannerSymbol: {
    fontSize: '2rem',
    fontWeight: '800',
    lineHeight: '1',
  },
  bannerName: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
  },
  bannerRight: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '4px',
  },
  bannerPrice: {
    fontSize: '2rem',
    fontWeight: '700',
    lineHeight: '1',
  },
  bannerChange: {
    fontSize: '0.95rem',
    fontWeight: '600',
  },
  tradeSidebar: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
};

// Add CSS classes for active selected stock sidebar highlight
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.innerHTML = `
    .stock-item:hover {
      border-color: rgba(255, 255, 255, 0.2) !important;
      background-color: var(--bg-card-hover) !important;
    }
    .selected-stock {
      border-color: var(--color-brand) !important;
    }
  `;
  document.head.appendChild(style);
}
