import { Router, Response } from 'express';
import { prisma } from '../services/db';
import { market, usdInrRate } from '../services/market';
import { TradingEngine } from '../services/trading';
import { authenticateJWT, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// GET /api/portfolio - Fetch user's cash, live holdings, and total portfolio valuation
router.get('/', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    // Fetch user cash balance and holdings
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        holdings: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    let totalHoldingsValueUSD = 0;
    const liveHoldings = user.holdings.map((holding) => {
      const livePrice = market.getStockPrice(holding.symbol) || holding.averageBuyPrice;
      const isINR = holding.symbol.endsWith('.NS');
      const rate = isINR ? usdInrRate : 1.0;

      // Calculate local values
      const marketValueLocal = holding.shares * livePrice;
      const totalCostLocal = holding.shares * holding.averageBuyPrice;
      const profitLossLocal = marketValueLocal - totalCostLocal;

      // Calculate USD equivalents
      const marketValueUSD = parseFloat((marketValueLocal / rate).toFixed(2));
      const totalCostUSD = parseFloat((totalCostLocal / rate).toFixed(2));
      const profitLossUSD = parseFloat((marketValueUSD - totalCostUSD).toFixed(2));
      const profitLossPercent = totalCostLocal > 0 ? parseFloat(((profitLossLocal / totalCostLocal) * 100).toFixed(2)) : 0;

      totalHoldingsValueUSD += marketValueUSD;

      return {
        id: holding.id,
        symbol: holding.symbol,
        shares: holding.shares,
        averageBuyPrice: holding.averageBuyPrice, // local currency
        currentPrice: livePrice,                  // local currency
        marketValue: marketValueUSD,               // converted to USD
        profitLoss: profitLossUSD,                 // converted to USD
        profitLossPercent,                         // identical local vs USD
        currency: isINR ? 'INR' : 'USD',
      };
    });

    const totalPortfolioValue = parseFloat((user.balance + totalHoldingsValueUSD).toFixed(2));

    res.json({
      cash: user.balance,
      holdingsValue: parseFloat(totalHoldingsValueUSD.toFixed(2)),
      totalPortfolioValue,
      holdings: liveHoldings,
      usdInrRate,
    });
  } catch (error) {
    console.error('Error fetching portfolio:', error);
    res.status(500).json({ error: 'An error occurred fetching portfolio data' });
  }
});

// GET /api/portfolio/transactions - Retrieve ledger of all past trades
router.get('/transactions', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    const transactions = await prisma.transaction.findMany({
      where: { userId },
      orderBy: { timestamp: 'desc' },
    });

    res.json(transactions);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'An error occurred fetching transactions' });
  }
});

// POST /api/portfolio/trade - Place a buy or sell trade order
router.post('/trade', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id!;
    const { symbol, type, shares } = req.body;

    if (!symbol || !type || shares === undefined) {
      return res.status(400).json({ error: 'Missing required trade arguments (symbol, type, shares)' });
    }

    const numShares = parseFloat(shares);
    if (isNaN(numShares) || numShares <= 0) {
      return res.status(400).json({ error: 'Shares must be a positive number' });
    }

    let result;
    if (type === 'BUY') {
      result = await TradingEngine.executeBuyOrder(userId, symbol, numShares);
    } else if (type === 'SELL') {
      result = await TradingEngine.executeSellOrder(userId, symbol, numShares);
    } else {
      return res.status(400).json({ error: "Invalid trade type. Must be 'BUY' or 'SELL'" });
    }

    res.json(result);
  } catch (error: any) {
    console.error('Trade execution error:', error);
    res.status(400).json({ error: error.message || 'An error occurred during trade execution' });
  }
});

export default router;
