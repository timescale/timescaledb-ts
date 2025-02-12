import { describe, it, expect, beforeEach, afterAll } from '@jest/globals';
import { request } from './mock-request';
import sequelize from '../src/database';
import PageLoad from '../src/models/PageLoad';
import { faker } from '@faker-js/faker';

describe('GET /api/daily', () => {
  beforeEach(async () => {
    await PageLoad.destroy({ where: {} });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('should return daily stats for a given time range', async () => {
    const baseTime = new Date();
    baseTime.setHours(0, 0, 0, 0); // Start of day

    // Create test data across 3 days
    for (let day = 0; day < 3; day++) {
      const dayStart = new Date(baseTime.getTime() - day * 24 * 3600000);

      // Create multiple records per day across different hours
      for (let hour = 0; hour < 24; hour += 4) {
        const time = new Date(dayStart.getTime() + hour * 3600000);

        // Create multiple records per hour
        for (let i = 0; i < 5; i++) {
          await PageLoad.create({
            userAgent: faker.internet.userAgent(),
            time: new Date(time.getTime() + i * 60000), // Spread over minutes
          });
        }
      }
    }

    // Manually refresh the continuous aggregate for hourly views
    await sequelize.query(`CALL refresh_continuous_aggregate('hourly_page_views', null, null);`);

    // Wait for hourly refresh to complete
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Manually refresh the rollup for daily stats
    await sequelize.query(`CALL refresh_continuous_aggregate('daily_page_stats', null, null);`);

    // Wait for daily refresh to complete
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const start = new Date(baseTime.getTime() - 4 * 24 * 3600000); // 4 days ago
    const end = baseTime;

    const response = await request().get('/api/daily').query({
      start: start.toISOString(),
      end: end.toISOString(),
    });

    expect(response.status).toBe(200);
    expect(response.body.length).toBeCloseTo(3);

    const firstDay = response.body[0];
    expect(firstDay).toHaveProperty('bucket');
    expect(firstDay).toHaveProperty('sumTotalViews');
    expect(firstDay).toHaveProperty('avgUniqueUsers');

    // Each day should have:
    // - 6 time slots (every 4 hours)
    // - 5 views per time slot
    // - 30 total views per day
    response.body.forEach((day: any) => {
      expect(day.sumTotalViews).toBe('30');
      expect(Number(day.avgUniqueUsers)).toBeGreaterThan(0);
      expect(Number(day.avgUniqueUsers)).toBeLessThanOrEqual(30);
    });
  });
});
