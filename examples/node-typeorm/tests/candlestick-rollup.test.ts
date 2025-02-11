import { describe, it, expect, beforeEach, afterAll } from '@jest/globals';
import { request } from './mock-request';
import { AppDataSource } from '../src/data-source';
import { StockPrice } from '../src/models/StockPrice';

describe('Candlestick 1H Rollup Tests', () => {
  beforeEach(async () => {
    const repository = AppDataSource.getRepository(StockPrice);
    await repository.clear();
  });

  afterAll(async () => {
    await AppDataSource.destroy();
  });

  it('should rollup 1-minute candlesticks into 1-hour candlesticks', async () => {
    const repository = AppDataSource.getRepository(StockPrice);
    const baseTime = new Date('2025-01-01T00:00:00Z');
    const symbol = 'BTC';

    const testData = [
      // First 15 minutes
      { symbol, timestamp: new Date(baseTime.getTime() + 5 * 60000), price: 102000, volume: 1.5 },
      { symbol, timestamp: new Date(baseTime.getTime() + 10 * 60000), price: 103000, volume: 2.0 },
      { symbol, timestamp: new Date(baseTime.getTime() + 15 * 60000), price: 101500, volume: 1.0 },

      // Middle of the hour
      { symbol, timestamp: new Date(baseTime.getTime() + 30 * 60000), price: 104000, volume: 2.5 },
      { symbol, timestamp: new Date(baseTime.getTime() + 35 * 60000), price: 105000, volume: 1.8 },

      // Last 15 minutes
      { symbol, timestamp: new Date(baseTime.getTime() + 45 * 60000), price: 103500, volume: 1.2 },
      { symbol, timestamp: new Date(baseTime.getTime() + 50 * 60000), price: 104500, volume: 1.7 },
      { symbol, timestamp: new Date(baseTime.getTime() + 55 * 60000), price: 103800, volume: 1.5 },

      // Data for another symbol that shouldn't affect our results
      { symbol: 'ETH', timestamp: new Date(baseTime.getTime() + 25 * 60000), price: 2500, volume: 10.0 },
    ];

    await Promise.all(testData.map((data) => repository.save(data)));

    // Manually refresh the 1m continuous aggregate
    await AppDataSource.query(`CALL refresh_continuous_aggregate('stock_candlesticks_1m', null, null);`);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Manually refresh the 1h rollup
    await AppDataSource.query(`CALL refresh_continuous_aggregate('stock_candlesticks_1h', null, null);`);
    await new Promise((resolve) => setTimeout(resolve, 4000));

    // Query the hourly rollup
    const response = await request()
      .get('/api/candlestick/1h')
      .query({
        start: baseTime.toISOString(),
        end: new Date(baseTime.getTime() + 3600000).toISOString(), // 1 hour later
        symbol,
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);

    const hourlyCandle = response.body[0];
    expect(new Date(hourlyCandle.bucket_time)).toEqual(baseTime);
    expect(hourlyCandle.symbol).toBe(symbol);

    // Verify the rolled up values
    expect(Number(hourlyCandle.open)).toBeCloseTo(102000, 0);
    expect(Number(hourlyCandle.high)).toBeCloseTo(105000, 0);
    expect(Number(hourlyCandle.low)).toBeCloseTo(101500, 0);
    expect(Number(hourlyCandle.close)).toBeCloseTo(103800, 0);
    expect(Number(hourlyCandle.volume)).toBeCloseTo(13.2, 1);
  });

  it('should handle empty periods in hourly rollup', async () => {
    const repository = AppDataSource.getRepository(StockPrice);
    const baseTime = new Date('2025-01-01T00:00:00Z');
    const symbol = 'BTC';

    const testData = [
      // First hour
      { symbol, timestamp: new Date(baseTime.getTime() + 15 * 60000), price: 102000, volume: 1.5 },
      { symbol, timestamp: new Date(baseTime.getTime() + 45 * 60000), price: 103000, volume: 2.0 },

      // Third hour (2 hours after base)
      { symbol, timestamp: new Date(baseTime.getTime() + 125 * 60000), price: 104000, volume: 2.5 },
      { symbol, timestamp: new Date(baseTime.getTime() + 155 * 60000), price: 105000, volume: 1.8 },
    ];

    await Promise.all(testData.map((data) => repository.save(data)));

    // Refresh aggregates
    await AppDataSource.query(`CALL refresh_continuous_aggregate('stock_candlesticks_1m', null, null);`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await AppDataSource.query(`CALL refresh_continuous_aggregate('stock_candlesticks_1h', null, null);`);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const response = await request()
      .get('/api/candlestick/1h')
      .query({
        start: baseTime.toISOString(),
        end: new Date(baseTime.getTime() + 4 * 3600000).toISOString(), // 4 hours later
        symbol,
      });

    expect(response.status).toBe(200);

    expect(response.body).toHaveLength(2);

    // Verify first hour
    const firstHour = response.body[0];
    expect(new Date(firstHour.bucket_time)).toEqual(baseTime);
    expect(Number(firstHour.open)).toBeCloseTo(102000, 0);
    expect(Number(firstHour.close)).toBeCloseTo(103000, 0);
    expect(Number(firstHour.volume)).toBeCloseTo(3.5, 1);

    // Verify third hour
    const thirdHour = response.body[1];
    expect(new Date(thirdHour.bucket_time)).toEqual(new Date(baseTime.getTime() + 2 * 3600000));
    expect(Number(thirdHour.open)).toBeCloseTo(104000, 0);
    expect(Number(thirdHour.close)).toBeCloseTo(105000, 0);
    expect(Number(thirdHour.volume)).toBeCloseTo(4.3, 1);
  });
});
