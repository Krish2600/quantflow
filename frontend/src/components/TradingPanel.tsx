import React, { useState, useMemo } from 'react';
import { useAuth, API_URL } from '../context/AuthContext';

interface TradingPanelProps {
  symbol: string;
  livePrice: number | null;
  userBalance: number; // in USD
  holding: { shares: number; averageBuyPrice: number } | null;
  usdInrRate: number; // Exchange rate from portfolioData
  onTradeSuccess: () => void;
}

export const TradingPanel: React.FC<TradingPanelProps> = ({
  symbol,
  livePrice,
  userBalance,
  holding,
  usdInrRate,
  onTradeSuccess,
}) => {
  const { token } = useAuth();
  const [orderType, setOrderType] = useState<'BUY' | 'SELL'>('BUY');
  const [sharesInput, setSharesInput] = useState('1');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const shares = useMemo(() => {
    const val = parseFloat(sharesInput);
    return isNaN(val) || val <= 0 ? 0 : val;
  }, [sharesInput]);

  const isINR = symbol.endsWith('.NS');
  const currencySymbol = isINR ? '₹' : '$';
  const effectiveRate = usdInrRate || 83.5;

  const estimatedCostLocal = useMemo(() => {
    if (!livePrice || shares <= 0) return 0;
    return parseFloat((livePrice * shares).toFixed(2));
  }, [livePrice, shares]);

  const estimatedCostUSD = useMemo(() => {
    if (!isINR) return estimatedCostLocal;
    return parseFloat((estimatedCostLocal / effectiveRate).toFixed(2));
  }, [estimatedCostLocal, isINR, effectiveRate]);

  const isOrderValid = useMemo(() => {
    if (shares <= 0) return false;
    if (orderType === 'BUY') {
      return userBalance >= estimatedCostUSD;
    } else {
      const heldShares = holding ? holding.shares : 0;
      return heldShares >= shares;
    }
  }, [shares, orderType, userBalance, estimatedCostUSD, holding]);

  const handleTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOrderValid || !livePrice || isSubmitting) return;

    setError('');
    setSuccess('');
    setIsSubmitting(true);

    try {
      const res = await fetch(`${API_URL}/portfolio/trade`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          symbol,
          type: orderType,
          shares,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Trade execution failed');
      }

      setSuccess(data.message);
      setSharesInput('1');
      onTradeSuccess(); // Refresh user portfolio data in parent
      
      // Auto-clear success message after 4s
      setTimeout(() => setSuccess(''), 4000);
    } catch (err: any) {
      setError(err.message || 'An error occurred during trade placement');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="glass-panel" style={styles.container}>
      <h2 style={styles.title}>Place Order</h2>
      
      <div style={styles.tabs}>
        <button
          type="button"
          style={{
            ...styles.tab,
            ...(orderType === 'BUY' ? styles.buyTabActive : {}),
          }}
          onClick={() => {
            setOrderType('BUY');
            setError('');
          }}
        >
          Buy {symbol}
        </button>
        <button
          type="button"
          style={{
            ...styles.tab,
            ...(orderType === 'SELL' ? styles.sellTabActive : {}),
          }}
          onClick={() => {
            setOrderType('SELL');
            setError('');
          }}
        >
          Sell {symbol}
        </button>
      </div>

      <form onSubmit={handleTrade} style={styles.form}>
        <div style={styles.infoRow}>
          <span style={styles.infoLabel}>Cash Available</span>
          <span style={styles.infoVal}>${userBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</span>
        </div>
        <div style={styles.infoRow}>
          <span style={styles.infoLabel}>Holding Quantity</span>
          <span style={styles.infoVal}>
            {holding ? `${holding.shares.toFixed(4)} shares` : '0.0000 shares'}
          </span>
        </div>

        {holding && (
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>Avg. Buy Price</span>
            <span style={styles.infoVal}>{currencySymbol}{holding.averageBuyPrice.toFixed(2)}</span>
          </div>
        )}

        <hr style={styles.divider} />

        <div style={styles.inputGroup}>
          <label style={styles.inputLabel}>Shares to {orderType.toLowerCase()}</label>
          <input
            type="number"
            step="any"
            min="0.0001"
            className="form-input"
            value={sharesInput}
            onChange={(e) => setSharesInput(e.target.value)}
            placeholder="0.00"
            required
          />
        </div>

        {livePrice && (
          <div style={styles.summaryGroup}>
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>Price per Share</span>
              <span style={styles.infoVal}>{currencySymbol}{livePrice.toFixed(2)}</span>
            </div>
            
            <div style={{ ...styles.infoRow, marginTop: '8px' }}>
              <span style={{ ...styles.infoLabel, color: 'var(--text-primary)', fontWeight: '600' }}>
                Est. {orderType === 'BUY' ? 'Cost' : 'Proceeds'}
              </span>
              <span
                style={{
                  ...styles.infoVal,
                  color: orderType === 'BUY' ? 'var(--color-brand)' : 'var(--color-success)',
                  fontWeight: '700',
                  fontSize: '1.1rem',
                }}
              >
                {currencySymbol}{estimatedCostLocal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            {isINR && (
              <div style={{ ...styles.infoRow, marginTop: '4px', borderTop: '1px dashed var(--border-color)', paddingTop: '6px' }}>
                <span style={styles.infoLabel}>In Base Currency</span>
                <span style={{ ...styles.infoVal, color: 'var(--color-brand)', fontWeight: '600' }}>
                  ${estimatedCostUSD.toLocaleString(undefined, { minimumFractionDigits: 2 })} USD
                </span>
              </div>
            )}
          </div>
        )}

        {error && <div style={styles.errorAlert}>{error}</div>}
        {success && <div style={styles.successAlert}>{success}</div>}

        <button
          type="submit"
          className="btn-primary"
          style={{
            ...styles.submitBtn,
            backgroundColor: orderType === 'BUY' ? 'var(--color-brand)' : 'var(--color-success)',
            boxShadow:
              orderType === 'BUY'
                ? '0 4px 14px var(--color-brand-glow)'
                : '0 4px 14px var(--color-success-bg)',
            color: '#000',
          }}
          disabled={!isOrderValid || isSubmitting || !livePrice}
        >
          {isSubmitting
            ? 'Executing...'
            : orderType === 'BUY'
            ? `Buy ${symbol}`
            : `Sell ${symbol}`}
        </button>
      </form>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
  },
  title: {
    fontSize: '1.2rem',
    fontWeight: '600',
    marginBottom: '16px',
  },
  tabs: {
    display: 'flex',
    backgroundColor: 'rgba(255,255,255,0.03)',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    padding: '4px',
    marginBottom: '20px',
  },
  tab: {
    flex: 1,
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    padding: '10px',
    fontSize: '0.85rem',
    fontWeight: '600',
    borderRadius: '6px',
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
    transition: 'all var(--transition-fast)',
  },
  buyTabActive: {
    backgroundColor: 'var(--color-brand-glow)',
    color: 'var(--color-brand)',
  },
  sellTabActive: {
    backgroundColor: 'rgba(0, 230, 118, 0.15)',
    color: 'var(--color-success)',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.85rem',
    marginBottom: '10px',
  },
  infoLabel: {
    color: 'var(--text-secondary)',
  },
  infoVal: {
    color: 'var(--text-primary)',
    fontWeight: '500',
  },
  divider: {
    border: 'none',
    borderBottom: '1px solid var(--border-color)',
    margin: '12px 0 20px 0',
  },
  inputGroup: {
    marginBottom: '20px',
  },
  inputLabel: {
    display: 'block',
    fontSize: '0.85rem',
    fontWeight: '500',
    color: 'var(--text-secondary)',
    marginBottom: '8px',
  },
  summaryGroup: {
    backgroundColor: 'rgba(255, 255, 255, 0.01)',
    border: '1px dashed var(--border-color)',
    borderRadius: '8px',
    padding: '12px',
    marginBottom: '20px',
  },
  submitBtn: {
    width: '100%',
    padding: '14px',
    fontSize: '0.95rem',
  },
  errorAlert: {
    backgroundColor: 'var(--color-danger-bg)',
    border: '1px solid var(--color-danger)',
    color: 'var(--color-danger)',
    padding: '12px',
    borderRadius: '8px',
    fontSize: '0.8rem',
    marginBottom: '16px',
    fontWeight: '500',
  },
  successAlert: {
    backgroundColor: 'var(--color-success-bg)',
    border: '1px solid var(--color-success)',
    color: 'var(--color-success)',
    padding: '12px',
    borderRadius: '8px',
    fontSize: '0.8rem',
    marginBottom: '16px',
    fontWeight: '500',
  },
};
