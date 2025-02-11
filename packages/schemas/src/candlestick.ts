import { z } from 'zod';
import { TimeRangeSchema } from './time-range';
import { WhereClauseSchema } from './where';

export const CandlestickAggregateOptionsSchema = z.object({
  price_column: z.string(),
  time_column: z.string().optional(),
  volume_column: z.string().optional(),
  bucket_interval: z.string().optional().default('1 hour'),
});

export type CandlestickAggregateOptions = z.infer<typeof CandlestickAggregateOptionsSchema>;

export const CandlesticksResultSchema = z.object({
  bucket_time: z.date(),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  volume: z.number().optional(),
  vwap: z.number().optional(),
  open_time: z.date(),
  high_time: z.date(),
  low_time: z.date(),
  close_time: z.date(),
});

export type CandlesticksResult = z.infer<typeof CandlesticksResultSchema>;

export type Candlestick = Omit<CandlesticksResult, 'bucket_time'>;

export type GetCandlesticksOptions = z.infer<typeof GetCandlesticksOptionsSchema>;

export const GetCandlesticksOptionsSchema = z.object({
  timeRange: TimeRangeSchema,
  config: CandlestickAggregateOptionsSchema,
  where: WhereClauseSchema.optional(),
});

export const CandlestickColumnOptionsSchema = z.object({
  time_column: z.string().optional(),
  price_column: z.string(),
  volume_column: z.string(),
  source_column: z.string(),
});

export type CandlestickColumnOptions = z.infer<typeof CandlestickColumnOptionsSchema>;
