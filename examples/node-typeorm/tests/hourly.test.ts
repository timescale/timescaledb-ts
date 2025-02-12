import { describe, it, expect, beforeEach, afterAll } from '@jest/globals';
import { request } from './mock-request';
import { AppDataSource } from '../src/data-source';
import { PageLoad } from '../src/models/PageLoad';
import { faker } from '@faker-js/faker';

describe('GET /api/hourly', () => {
  beforeEach(async () => {
    const repository = AppDataSource.getRepository(PageLoad);
    await repository.clear();

    await AppDataSource.query(`CALL refresh_continuous_aggregate('hourly_page_views', null, null);`);
  });

  afterAll(async () => {
    await AppDataSource.destroy();
  });

  it('should return hourly stats for a given time range', async () => {
    const repository = AppDataSource.getRepository(PageLoad);
    const baseTime = new Date();
    baseTime.setMinutes(0, 0, 0);

    // Create test data across 3 hours
    for (let hour = 0; hour < 3; hour++) {
      const time = new Date(baseTime.getTime() - hour * 3600000);

      // Create multiple records per hour
      for (let i = 0; i < 5; i++) {
        await repository.save({
          userAgent: faker.internet.userAgent(),
          time: new Date(time.getTime() + i * 60000), // Spread over minutes
        });
      }
    }

    // Manually refresh the continuous aggregate
    await AppDataSource.query(`CALL refresh_continuous_aggregate('hourly_page_views', null, null);`);

    // Wait for refresh to complete
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const start = new Date(baseTime.getTime() - 4 * 3600000); // 4 hours ago
    const end = baseTime;

    const response = await request().get('/api/hourly').query({
      start: start.toISOString(),
      end: end.toISOString(),
    });

    expect(response.status).toBe(200);
    expect(response.body.length).toBeCloseTo(3);

    const firstHour = response.body[0];
    expect(firstHour).toHaveProperty('bucket');
    expect(firstHour).toHaveProperty('total_views');
    expect(firstHour).toHaveProperty('unique_users');
  });
});
