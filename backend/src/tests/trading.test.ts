import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TradingEngine } from '../services/trading';
import { prisma } from '../services/db';
import { market } from '../services/market';

// Mock the prisma database instance
vi.mock('../services/db', () => ({
  prisma: {
    $transaction: vi.fn(),
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    holding: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    transaction: {
      create: vi.fn(),
    },
  },
}));

vi.mock('../services/market', () => ({
  market: {
    getStockPrice: vi.fn(),
  },
  usdInrRate: 83.5,
}));

describe('TradingEngine Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('executeBuyOrder', () => {
    it('should successfully buy stock when user has sufficient balance', async () => {
      // Setup mock data
      const mockUserId = 'user-123';
      const mockSymbol = 'AAPL';
      const mockPrice = 150.00;
      const mockShares = 2;
      const mockTotalCost = 300.00;

      vi.mocked(market.getStockPrice).mockReturnValue(mockPrice);

      const mockUser = { id: mockUserId, email: 'test@demo.com', balance: 1000.00 };
      const mockUpdatedUser = { ...mockUser, balance: 700.00 };

      // Mock prisma transaction execution
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        const txMock = {
          user: {
            findUnique: vi.fn().mockResolvedValue(mockUser),
            update: vi.fn().mockResolvedValue(mockUpdatedUser),
          },
          holding: {
            findUnique: vi.fn().mockResolvedValue(null), // No existing holdings
            create: vi.fn().mockResolvedValue({ id: 'holding-1', userId: mockUserId, symbol: mockSymbol, shares: mockShares }),
          },
          transaction: {
            create: vi.fn().mockResolvedValue({ id: 'tx-1' }),
          },
        };
        return callback(txMock as any);
      });

      const result = await TradingEngine.executeBuyOrder(mockUserId, mockSymbol, mockShares);

      expect(result.success).toBe(true);
      expect(result.balance).toBe(700.00);
      expect(result.sharesHeld).toBe(mockShares);
      expect(result.message).toContain('Successfully bought 2 shares of AAPL');
    });

    it('should fail buy stock when user balance is insufficient', async () => {
      const mockUserId = 'user-123';
      const mockSymbol = 'AAPL';
      const mockPrice = 150.00;
      const mockShares = 10; // Requires $1500

      vi.mocked(market.getStockPrice).mockReturnValue(mockPrice);

      const mockUser = { id: mockUserId, email: 'test@demo.com', balance: 500.00 }; // Only $500 balance

      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        const txMock = {
          user: {
            findUnique: vi.fn().mockResolvedValue(mockUser),
          },
        };
        return callback(txMock as any);
      });

      await expect(
        TradingEngine.executeBuyOrder(mockUserId, mockSymbol, mockShares)
      ).rejects.toThrowError(/Insufficient balance/);
    });
  });

  describe('executeSellOrder', () => {
    it('should successfully sell stock when user holds enough shares', async () => {
      const mockUserId = 'user-123';
      const mockSymbol = 'AAPL';
      const mockPrice = 150.00;
      const mockSharesToSell = 2;

      vi.mocked(market.getStockPrice).mockReturnValue(mockPrice);

      const mockHolding = { id: 'holding-1', userId: mockUserId, symbol: mockSymbol, shares: 5, averageBuyPrice: 140.00 };
      const mockUser = { id: mockUserId, email: 'test@demo.com', balance: 100.00 };
      const mockUpdatedUser = { ...mockUser, balance: 400.00 }; // $100 + $300 revenue

      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        const txMock = {
          holding: {
            findUnique: vi.fn().mockResolvedValue(mockHolding),
            update: vi.fn().mockResolvedValue({ ...mockHolding, shares: 3 }),
          },
          user: {
            update: vi.fn().mockResolvedValue(mockUpdatedUser),
          },
          transaction: {
            create: vi.fn().mockResolvedValue({ id: 'tx-2' }),
          },
        };
        return callback(txMock as any);
      });

      const result = await TradingEngine.executeSellOrder(mockUserId, mockSymbol, mockSharesToSell);

      expect(result.success).toBe(true);
      expect(result.balance).toBe(400.00);
      expect(result.sharesHeld).toBe(3); // 5 owned - 2 sold
      expect(result.message).toContain('Successfully sold 2 shares of AAPL');
    });

    it('should fail when user attempts to sell more shares than held', async () => {
      const mockUserId = 'user-123';
      const mockSymbol = 'AAPL';
      const mockPrice = 150.00;
      const mockSharesToSell = 10; // Sell 10

      vi.mocked(market.getStockPrice).mockReturnValue(mockPrice);

      const mockHolding = { id: 'holding-1', userId: mockUserId, symbol: mockSymbol, shares: 4, averageBuyPrice: 140.00 }; // Only has 4

      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        const txMock = {
          holding: {
            findUnique: vi.fn().mockResolvedValue(mockHolding),
          },
        };
        return callback(txMock as any);
      });

      await expect(
        TradingEngine.executeSellOrder(mockUserId, mockSymbol, mockSharesToSell)
      ).rejects.toThrowError(/Insufficient shares/);
    });
  });
});
