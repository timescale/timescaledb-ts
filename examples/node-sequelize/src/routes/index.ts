import { Router } from 'express';
import PageLoad from '../models/PageLoad';
import { getPageViewStats, getCompressionStats, getCandlestickData } from '../services/timescale';
import HourlyPageView from '../models/HourlyPageView';
import { Op } from 'sequelize';

const router = Router();

router.post('/pageview', async (req, res) => {
  try {
    const userAgent = req.get('user-agent') || 'unknown';
    const time = new Date();

    await PageLoad.create({ userAgent, time });
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

    const stats = await getPageViewStats({ start, end });
    res.json(stats);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

router.get('/compression', async (req, res) => {
  try {
    const stats = await getCompressionStats();
    res.json(stats);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to get compression stats' });
  }
});

router.get('/hourly', async (req, res) => {
  try {
    const start = new Date(req.query.start as string);
    const end = new Date(req.query.end as string);

    const hourlyViews = await HourlyPageView.findAll({
      where: {
        bucket: {
          [Op.between]: [start, end],
        },
      },
      order: [['bucket', 'DESC']],
    });

    res.json(hourlyViews);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to get hourly stats' });
  }
});

router.get('/candlestick', async (req, res) => {
  try {
    const start = new Date(req.query.start as string);
    const end = new Date(req.query.end as string);
    const interval = req.query.interval as string;

    const candlesticks = await getCandlestickData({ start, end, interval });
    res.json(candlesticks);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to get candlestick data' });
  }
});

export default router;
