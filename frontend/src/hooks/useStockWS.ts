import { useState, useEffect, useRef } from 'react';

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
  flash?: 'up' | 'down' | null;
}

const getWsUrl = () => {
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }
  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'ws://localhost:5000/ws';
    }
    const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:';
    return `${wsProtocol}//${window.location.host}/ws`;
  }
  return 'ws://localhost:5000/ws';
};

const WS_URL = getWsUrl();

export const useStockWS = () => {
  const [stocks, setStocks] = useState<Record<string, StockPrice>>({});
  const [isConnected, setIsConnected] = useState(false);
  const [lastCandleTime, setLastCandleTime] = useState<number>(0);
  
  const wsRef = useRef<WebSocket | null>(null);
  const flashTimeoutsRef = useRef<Record<string, any>>({});

  useEffect(() => {
    connect();

    return () => {
      // Cleanup WebSocket and timeouts on unmount
      if (wsRef.current) {
        wsRef.current.close();
      }
      Object.values(flashTimeoutsRef.current).forEach(clearTimeout);
    };
  }, []);

  const connect = () => {
    if (wsRef.current?.readyState === WebSocket.CONNECTING || wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[QuantFlow WS] Connected to market feed');
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        if (message.type === 'INIT') {
          // Initialize stocks record
          const initialStocks: Record<string, StockPrice> = {};
          message.data.forEach((stock: StockPrice) => {
            initialStocks[stock.symbol] = { ...stock, flash: null };
          });
          setStocks(initialStocks);
        } else if (message.type === 'TICK') {
          const updates = message.data;
          
          setStocks((prevStocks) => {
            const nextStocks = { ...prevStocks };
            
            for (const [symbol, update] of Object.entries(updates) as [string, Partial<StockPrice>][]) {
              if (nextStocks[symbol]) {
                const oldPrice = nextStocks[symbol].price;
                const newPrice = update.price ?? oldPrice;
                
                // Determine price direction flash
                let flash: 'up' | 'down' | null = null;
                if (newPrice > oldPrice) {
                  flash = 'up';
                } else if (newPrice < oldPrice) {
                  flash = 'down';
                }

                nextStocks[symbol] = {
                  ...nextStocks[symbol],
                  ...update,
                  flash,
                };

                // Clear previous flash timeout if exists
                if (flashTimeoutsRef.current[symbol]) {
                  clearTimeout(flashTimeoutsRef.current[symbol]);
                }

                // Schedule reset of flash status after 800ms
                flashTimeoutsRef.current[symbol] = setTimeout(() => {
                  setStocks((currentStocks) => {
                    if (currentStocks[symbol]) {
                      return {
                        ...currentStocks,
                        [symbol]: {
                          ...currentStocks[symbol],
                          flash: null,
                        },
                      };
                    }
                    return currentStocks;
                  });
                }, 800);
              }
            }
            return nextStocks;
          });
        } else if (message.type === 'CANDLE') {
          // Trigger reload of chart history
          setLastCandleTime(Date.now());
        }
      } catch (err) {
        console.error('[QuantFlow WS] Error parsing message:', err);
      }
    };

    ws.onclose = () => {
      console.log('[QuantFlow WS] Disconnected. Reconnecting in 3s...');
      setIsConnected(false);
      wsRef.current = null;
      setTimeout(connect, 3000);
    };

    ws.onerror = (err) => {
      console.error('[QuantFlow WS] Socket error:', err);
      ws.close();
    };
  };

  return { stocks: Object.values(stocks), stockMap: stocks, isConnected, lastCandleTime };
};
