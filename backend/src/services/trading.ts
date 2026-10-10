import { prisma } from './db';
import { market, usdInrRate } from './market';

export interface OrderResult {
  success: boolean;
  message: string;
  balance: number; // User balance in base currency (USD)
  sharesHeld: number;
}

export class TradingEngine {
  /**
   * Executes a buy order for a user inside an atomic database transaction.
   */
  static async executeBuyOrder(userId: string, symbol: string, shares: number): Promise<OrderResult> {
    if (shares <= 0) {
      throw new Error('Number of shares must be greater than zero');
    }

    const price = market.getStockPrice(symbol);
    if (!price) {
      throw new Error(`Invalid stock symbol: ${symbol}`);
    }

    // Currency conversion logic
    const isINR = symbol.endsWith('.NS');
    const rate = isINR ? usdInrRate : 1.0;
    const currencySymbol = isINR ? '₹' : '$';

    const totalCostLocal = price * shares;
    const totalCostUSD = parseFloat((totalCostLocal / rate).toFixed(2));

    // Run within a Prisma transaction to guarantee atomic execution and prevent double-spending
    return await prisma.$transaction(async (tx) => {
      // 1. Fetch user and lock the row
      const user = await tx.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new Error('User not found');
      }

      if (user.balance < totalCostUSD) {
        throw new Error(`Insufficient balance. Required: $${totalCostUSD.toFixed(2)} USD, Available: $${user.balance.toFixed(2)} USD`);
      }

      // 2. Deduct funds from user balance (base currency is USD)
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { balance: { decrement: totalCostUSD } },
      });

      // 3. Find if the user already holds this stock
      const existingHolding = await tx.holding.findUnique({
        where: {
          userId_symbol: { userId, symbol },
        },
      });

      let updatedShares = shares;
      let newAverageBuyPrice = price;

      if (existingHolding) {
        // Recalculate average buy price in local currency
        updatedShares = existingHolding.shares + shares;
        const totalOldCost = existingHolding.shares * existingHolding.averageBuyPrice;
        newAverageBuyPrice = (totalOldCost + totalCostLocal) / updatedShares;

        await tx.holding.update({
          where: { id: existingHolding.id },
          data: {
            shares: updatedShares,
            averageBuyPrice: parseFloat(newAverageBuyPrice.toFixed(4)),
          },
        });
      } else {
        await tx.holding.create({
          data: {
            userId,
            symbol,
            shares,
            averageBuyPrice: parseFloat(price.toFixed(4)),
          },
        });
      }

      // 4. Log the transaction (price is stored in the asset's local currency)
      await tx.transaction.create({
        data: {
          userId,
          symbol,
          type: 'BUY',
          shares,
          price,
        },
      });

      return {
        success: true,
        message: `Successfully bought ${shares} shares of ${symbol} at ${currencySymbol}${price.toFixed(2)}`,
        balance: updatedUser.balance,
        sharesHeld: updatedShares,
      };
    });
  }

  /**
   * Executes a sell order for a user inside an atomic database transaction.
   */
  static async executeSellOrder(userId: string, symbol: string, shares: number): Promise<OrderResult> {
    if (shares <= 0) {
      throw new Error('Number of shares must be greater than zero');
    }

    const price = market.getStockPrice(symbol);
    if (!price) {
      throw new Error(`Invalid stock symbol: ${symbol}`);
    }

    // Currency conversion logic
    const isINR = symbol.endsWith('.NS');
    const rate = isINR ? usdInrRate : 1.0;
    const currencySymbol = isINR ? '₹' : '$';

    const totalRevenueLocal = price * shares;
    const totalRevenueUSD = parseFloat((totalRevenueLocal / rate).toFixed(2));

    return await prisma.$transaction(async (tx) => {
      // 1. Check if user holds the stock and in sufficient quantity
      const holding = await tx.holding.findUnique({
        where: {
          userId_symbol: { userId, symbol },
        },
      });

      if (!holding || holding.shares < shares) {
        const heldAmount = holding ? holding.shares : 0;
        throw new Error(`Insufficient shares of ${symbol}. Attempted to sell: ${shares}, Held: ${heldAmount}`);
      }

      // 2. Add proceeds to user balance (base currency is USD)
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { balance: { increment: totalRevenueUSD } },
      });

      // 3. Update or delete holding depending on remaining shares
      const remainingShares = holding.shares - shares;
      let finalSharesHeld = remainingShares;

      if (remainingShares <= 0.00001) {
        // Delete holding if shares are zero (with minor margin for floating-point inaccuracies)
        await tx.holding.delete({
          where: { id: holding.id },
        });
        finalSharesHeld = 0;
      } else {
        await tx.holding.update({
          where: { id: holding.id },
          data: {
            shares: remainingShares,
          },
        });
      }

      // 4. Log the transaction (price is stored in the asset's local currency)
      await tx.transaction.create({
        data: {
          userId,
          symbol,
          type: 'SELL',
          shares,
          price,
        },
      });

      return {
        success: true,
        message: `Successfully sold ${shares} shares of ${symbol} at ${currencySymbol}${price.toFixed(2)}`,
        balance: updatedUser.balance,
        sharesHeld: finalSharesHeld,
      };
    });
  }
}
