import { beforeAll } from '@jest/globals';
import dotenv from 'dotenv';
import { AppDataSource } from '../src/data-source';

dotenv.config({ path: '.env' });

process.env.NODE_ENV = 'test';
process.env.PORT = '4100';

beforeAll(async () => {
  try {
    await AppDataSource.initialize();
  } catch (error) {
    console.error('Test setup failed:', error);
    throw error;
  }
});
