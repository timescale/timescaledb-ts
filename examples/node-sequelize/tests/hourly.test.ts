import { describe, it, expect, beforeEach, afterAll } from '@jest/globals';
import { request } from './mock-request';
import sequelize from '../src/database';
import PageLoad from '../src/models/PageLoad';
import { faker } from '@faker-js/faker';

describe('GET /api/hourly', () => {
  beforeEach(async () => {
    await PageLoad.destroy({ where: {} });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('should return hourly stats for a given time range', async () => {
    const baseTime = new Date();
    baseTime.setMinutes(0, 0, 0);

    // Create test data across 3 hours
    for (let hour = 0; hour < 3; hour++) {
      const time = new Date(baseTime.getTime() - hour * 3600000);

      // Create multiple records per hour
      for (let i = 0; i < 5; i++) {
        await PageLoad.create({
          userAgent: faker.internet.userAgent(),
          time: new Date(time.getTime() + i * 60000), // Spread over minutes
        });
      }
    }

    // Manually refresh the continuous aggregate
    await sequelize.query(`CALL refresh_continuous_aggregate('hourly_page_views', null, null);`);

    // Wait for refresh to complete
    await new Promise((resolve) => setTimeout(resolve, 4000));

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
    expect(firstHour).toHaveProperty('totalViews');
    expect(firstHour).toHaveProperty('uniqueUsers');
  });
});
