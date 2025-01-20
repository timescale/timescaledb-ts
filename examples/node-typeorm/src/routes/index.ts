import { Router } from 'express';
import { AppDataSource } from '../data-source';
import { PageLoad } from '../models/PageLoad';

const router = Router();

router.post('/pageview', async (req, res) => {
  try {
    const userAgent = req.get('user-agent') || 'unknown';
    const time = new Date();

    const pageLoadRepository = AppDataSource.getRepository(PageLoad);
    await pageLoadRepository.save({ userAgent, time });

    res.json({ message: 'Page view recorded' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to record page view' });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const start = new Date(req.query.start as string);
    const end = new Date(req.query.end as string);

    const repository = AppDataSource.getRepository(PageLoad);

    const stats = await repository.getTimeBucket({
      timeRange: {
        start,
        end,
      },
      bucket: {
        interval: '1 hour',
        metrics: [
          { type: 'count', alias: 'count' },
          { type: 'distinct_count', column: 'user_agent', alias: 'unique_users' },
        ],
      },
    });

    res.json(stats);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

router.get('/compression', async (req, res) => {
  try {
    const repository = AppDataSource.getRepository(PageLoad);
    const stats = await repository.getCompressionStats();
    res.json(stats);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to get compression stats' });
  }
});

export default router;
