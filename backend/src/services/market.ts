import { EventEmitter } from 'events';

export interface StockPrice {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  category: 'US_STOCKS' | 'IN_STOCKS' | 'COMMODITIES' | 'ETFS' | 'MUTUAL_FUNDS';
  currency: 'USD' | 'INR';
}

export let usdInrRate = 83.5;

export interface Candle {
  time: number; // timestamp in ms
  open: number;
  high: number;
  low: number;
  close: number;
}

// Multi-asset catalog definition (US/Indian Stocks, Gold/Commodity ETFs, Indices, Mutual Funds)
const INITIAL_STOCKS: Array<{
  symbol: string;
  name: string;
  basePrice: number;
  volatility: number;
  category: 'US_STOCKS' | 'IN_STOCKS' | 'COMMODITIES' | 'ETFS' | 'MUTUAL_FUNDS';
  currency: 'USD' | 'INR';
}> = [
  // US Stocks
  { symbol: 'AAPL', name: 'Apple Inc. (US)', basePrice: 215.20, volatility: 0.012, category: 'US_STOCKS', currency: 'USD' },
  { symbol: 'MSFT', name: 'Microsoft Corp. (US)', basePrice: 425.60, volatility: 0.010, category: 'US_STOCKS', currency: 'USD' },
  { symbol: 'TSLA', name: 'Tesla Inc. (US)', basePrice: 195.10, volatility: 0.025, category: 'US_STOCKS', currency: 'USD' },
  { symbol: 'NVDA', name: 'NVIDIA Corp. (US)', basePrice: 108.40, volatility: 0.030, category: 'US_STOCKS', currency: 'USD' },
  { symbol: 'GOOGL', name: 'Alphabet Inc. (US)', basePrice: 168.50, volatility: 0.015, category: 'US_STOCKS', currency: 'USD' },
  { symbol: 'AMZN', name: 'Amazon.com Inc. (US)', basePrice: 178.30, volatility: 0.014, category: 'US_STOCKS', currency: 'USD' },

  // Indian Stocks (NSE)
  { symbol: 'RELIANCE.NS', name: 'Reliance Industries Ltd. (IN)', basePrice: 2950.00, volatility: 0.011, category: 'IN_STOCKS', currency: 'INR' },
  { symbol: 'TCS.NS', name: 'Tata Consultancy Services Ltd. (IN)', basePrice: 3950.00, volatility: 0.010, category: 'IN_STOCKS', currency: 'INR' },
  { symbol: 'INFY.NS', name: 'Infosys Ltd. (IN)', basePrice: 1750.00, volatility: 0.013, category: 'IN_STOCKS', currency: 'INR' },
  { symbol: 'HDFCBANK.NS', name: 'HDFC Bank Ltd. (IN)', basePrice: 1610.00, volatility: 0.012, category: 'IN_STOCKS', currency: 'INR' },
  { symbol: 'ICICIBANK.NS', name: 'ICICI Bank Ltd. (IN)', basePrice: 1180.00, volatility: 0.012, category: 'IN_STOCKS', currency: 'INR' },

  // Commodities & Gold
  { symbol: 'GLD', name: 'SPDR Gold Shares ETF (US)', basePrice: 228.50, volatility: 0.007, category: 'COMMODITIES', currency: 'USD' },
  { symbol: 'SLV', name: 'iShares Silver Trust ETF (US)', basePrice: 27.20, volatility: 0.013, category: 'COMMODITIES', currency: 'USD' },
  { symbol: 'USO', name: 'United States Oil Fund (US)', basePrice: 78.40, volatility: 0.016, category: 'COMMODITIES', currency: 'USD' },
  { symbol: 'GOLDBEES.NS', name: 'Nippon India Gold BeES ETF (IN)', basePrice: 62.50, volatility: 0.006, category: 'COMMODITIES', currency: 'INR' },

  // Index ETFs
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF Trust (US)', basePrice: 530.40, volatility: 0.008, category: 'ETFS', currency: 'USD' },
  { symbol: 'QQQ', name: 'Invesco QQQ Trust Nasdaq (US)', basePrice: 465.80, volatility: 0.011, category: 'ETFS', currency: 'USD' },
  { symbol: 'NIFTYBEES.NS', name: 'Nippon India Nifty 50 BeES ETF (IN)', basePrice: 272.50, volatility: 0.009, category: 'ETFS', currency: 'INR' },

  // Mutual Funds
  { symbol: 'VFIAX', name: 'Vanguard 500 Index Fund Adm (US)', basePrice: 495.20, volatility: 0.008, category: 'MUTUAL_FUNDS', currency: 'USD' },
  { symbol: 'VTSAX', name: 'Vanguard Total Stock Market Index (US)', basePrice: 122.60, volatility: 0.009, category: 'MUTUAL_FUNDS', currency: 'USD' },
];

// Helper to fetch live quote from public Yahoo Finance API
async function fetchYahooPrice(symbol: string): Promise<{ price: number; previousClose: number } | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data: any = await response.json();
    const result = data?.chart?.result?.[0];
    if (result) {
      const price = result.meta?.regularMarketPrice;
      const previousClose = result.meta?.previousClose ?? price;
      if (typeof price === 'number') {
        return { price, previousClose };
      }
    }
    return null;
  } catch (err) {
    console.error(`[QuantFlow API] Failed to fetch price for ${symbol}:`, err);
    return null;
  }
}

class MarketSimulator extends EventEmitter {
  private stocks: Record<string, StockPrice> = {};
  private history: Record<string, Candle[]> = {};
  private intervalId: NodeJS.Timeout | null = null;
  private candleIntervalId: NodeJS.Timeout | null = null;
  private currentCandle: Record<string, Candle> = {};
  private syncIntervalId: NodeJS.Timeout | null = null;

  // Standard candle length is 30 seconds for demonstration, so candles form quickly.
  private readonly CANDLE_DURATION_MS = 30000; 

  constructor() {
    super();
    this.initializeMarket();
    this.startBackgroundSync();
  }

  private initializeMarket() {
    const now = Date.now();
    for (const config of INITIAL_STOCKS) {
      // 1. Set current stock state with defaults
      this.stocks[config.symbol] = {
        symbol: config.symbol,
        name: config.name,
        price: config.basePrice,
        change: 0,
        changePercent: 0,
        high: config.basePrice,
        low: config.basePrice,
        open: config.basePrice,
        category: config.category,
        currency: config.currency,
      };

      // 2. Pre-generate 100 candles of history for charts (e.g. going back 50 minutes)
      const candles: Candle[] = [];
      let tempPrice = config.basePrice;
      const totalCandles = 100;
      
      for (let i = totalCandles; i > 0; i--) {
        const time = now - i * this.CANDLE_DURATION_MS;
        const open = tempPrice;
        
        // Generate minor random fluctuations for the candle min/max/close
        const close = this.calculateNextPrice(open, config.volatility * 3, 0.0001);
        const high = Math.max(open, close) * (1 + Math.random() * config.volatility);
        const low = Math.min(open, close) * (1 - Math.random() * config.volatility);
        
        candles.push({
          time,
          open: parseFloat(open.toFixed(2)),
          high: parseFloat(high.toFixed(2)),
          low: parseFloat(low.toFixed(2)),
          close: parseFloat(close.toFixed(2)),
        });
        
        tempPrice = close;
      }
      
      this.history[config.symbol] = candles;
      this.stocks[config.symbol].price = tempPrice;
      this.stocks[config.symbol].open = candles[0].open;
      this.stocks[config.symbol].high = Math.max(...candles.map(c => c.high));
      this.stocks[config.symbol].low = Math.min(...candles.map(c => c.low));

      // Calculate initial daily changes
      const dayStartPrice = candles[0].open;
      const change = tempPrice - dayStartPrice;
      this.stocks[config.symbol].change = parseFloat(change.toFixed(2));
      this.stocks[config.symbol].changePercent = parseFloat(((change / dayStartPrice) * 100).toFixed(2));

      // Initialize the running active candle
      this.currentCandle[config.symbol] = {
        time: now,
        open: tempPrice,
        high: tempPrice,
        low: tempPrice,
        close: tempPrice,
      };
    }
  }

  // Box-Muller transform for normal distribution
  private randomNormal(): number {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  private calculateNextPrice(currentPrice: number, volatility: number, drift = 0.00005): number {
    // Geometric Brownian Motion step
    const changePercent = (drift - (volatility * volatility) / 2) + volatility * this.randomNormal();
    const nextPrice = currentPrice * Math.exp(changePercent);
    return Math.max(0.01, parseFloat(nextPrice.toFixed(2)));
  }

  private async startBackgroundSync() {
    // Sync immediately on boot
    await this.syncWithRealMarket();

    // Re-sync with Yahoo Finance every 5 minutes
    this.syncIntervalId = setInterval(() => {
      this.syncWithRealMarket();
    }, 5 * 60 * 1000);
  }

  public async syncWithRealMarket() {
    console.log('[QuantFlow API] Synchronizing assets with live Yahoo Finance feeds...');
    
    // First, sync exchange rate
    const exData = await fetchYahooPrice('USDINR=X');
    if (exData && typeof exData.price === 'number') {
      usdInrRate = exData.price;
      console.log(`[QuantFlow API] Synced USD/INR exchange rate: 1 USD = ${usdInrRate} INR`);
    }

    for (const config of INITIAL_STOCKS) {
      const liveData = await fetchYahooPrice(config.symbol);
      if (liveData) {
        const stock = this.stocks[config.symbol];
        if (stock) {
          // Safely update baseline price and opening daily baseline
          stock.price = liveData.price;
          stock.open = liveData.previousClose;
          stock.high = Math.max(stock.high, liveData.price);
          stock.low = Math.min(stock.low, liveData.price);

          const change = stock.price - stock.open;
          stock.change = parseFloat(change.toFixed(2));
          stock.changePercent = parseFloat(((change / stock.open) * 100).toFixed(2));
          
          // Re-initialize active candle close to prevent discontinuities
          if (this.currentCandle[config.symbol]) {
            this.currentCandle[config.symbol].close = liveData.price;
            this.currentCandle[config.symbol].open = liveData.price;
            this.currentCandle[config.symbol].high = liveData.price;
            this.currentCandle[config.symbol].low = liveData.price;
          }
        }
      }
      // Delay slightly between requests to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    console.log('[QuantFlow API] Asset synchronization complete.');
    this.emit('sync_complete', this.stocks);
  }

  public startSimulation() {
    if (this.intervalId) return;

    // Tick stock prices every 1 second
    this.intervalId = setInterval(() => {
      const updates: Record<string, Partial<StockPrice>> = {};

      for (const config of INITIAL_STOCKS) {
        const stock = this.stocks[config.symbol];
        const nextPrice = this.calculateNextPrice(stock.price, config.volatility);

        // Update daily stats
        const change = nextPrice - stock.open;
        const changePercent = (change / stock.open) * 100;
        
        stock.price = nextPrice;
        stock.change = parseFloat(change.toFixed(2));
        stock.changePercent = parseFloat(changePercent.toFixed(2));
        stock.high = Math.max(stock.high, nextPrice);
        stock.low = Math.min(stock.low, nextPrice);

        updates[config.symbol] = {
          price: nextPrice,
          change: stock.change,
          changePercent: stock.changePercent,
          high: stock.high,
          low: stock.low,
        };

        // Update current candle stats
        const candle = this.currentCandle[config.symbol];
        if (candle) {
          candle.close = nextPrice;
          candle.high = Math.max(candle.high, nextPrice);
          candle.low = Math.min(candle.low, nextPrice);
        }
      }

      this.emit('tick', updates);
    }, 1000);

    // Roll over candles every 30 seconds
    this.candleIntervalId = setInterval(() => {
      const now = Date.now();
      
      for (const config of INITIAL_STOCKS) {
        const symbol = config.symbol;
        const closedCandle = { ...this.currentCandle[symbol] };
        
        // Push closed candle to historical list
        this.history[symbol].push(closedCandle);
        if (this.history[symbol].length > 150) {
          this.history[symbol].shift(); // Keep history size bounded
        }

        // Initialize new active candle
        this.currentCandle[symbol] = {
          time: now,
          open: this.stocks[symbol].price,
          high: this.stocks[symbol].price,
          low: this.stocks[symbol].price,
          close: this.stocks[symbol].price,
        };
      }

      this.emit('candle', this.currentCandle);
    }, this.CANDLE_DURATION_MS);
  }

  public stopSimulation() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.candleIntervalId) {
      clearInterval(this.candleIntervalId);
      this.candleIntervalId = null;
    }
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
    }
  }

  public getStocks(): StockPrice[] {
    return Object.values(this.stocks);
  }

  public getStockPrice(symbol: string): number | null {
    return this.stocks[symbol]?.price || null;
  }

  public getHistory(symbol: string): Candle[] {
    const list = this.history[symbol] || [];
    // Include current live candle in history return for absolute up-to-date rendering
    return [...list, this.currentCandle[symbol]].filter(Boolean);
  }
}

export const market = new MarketSimulator();
