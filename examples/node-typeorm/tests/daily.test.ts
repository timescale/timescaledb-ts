import { describe, it, expect, beforeEach, afterAll } from '@jest/globals';
import { request } from './mock-request';
import { AppDataSource } from '../src/data-source';
import { PageLoad } from '../src/models/PageLoad';
import { faker } from '@faker-js/faker';

describe('GET /api/daily', () => {
  beforeEach(async () => {
    const repository = AppDataSource.getRepository(PageLoad);
    await repository.clear();
    await AppDataSource.query(`CALL refresh_continuous_aggregate('hourly_page_views', null, null);`);
    await AppDataSource.query(`CALL refresh_continuous_aggregate('daily_page_stats', null, null);`);
  });

  afterAll(async () => {
    await AppDataSource.destroy();
  });

  it('should return daily stats for a given time range', async () => {
    const repository = AppDataSource.getRepository(PageLoad);
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
          await repository.save({
            userAgent: faker.internet.userAgent(),
            time: new Date(time.getTime() + i * 60000), // Spread over minutes
          });
        }
      }
    }

    await AppDataSource.query(`CALL refresh_continuous_aggregate('hourly_page_views', null, null);`);
    await new Promise((resolve) => setTimeout(resolve, 3000));
    await AppDataSource.query(`CALL refresh_continuous_aggregate('daily_page_stats', null, null);`);
    await new Promise((resolve) => setTimeout(resolve, 3000));

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
    expect(firstDay).toHaveProperty('sum_total_views');
    expect(firstDay).toHaveProperty('avg_unique_users');
  }, 10000);
});
