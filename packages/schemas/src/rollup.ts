import { z } from 'zod';
import {
  AggregateTypeSchema,
  CreateContinuousAggregateOptionsSchema,
  RefreshPolicySchema,
} from './continuous-aggregate';

export enum RollupFunctionType {
  Rollup = 'rollup',
}

export const RollupFunctionTypeSchema = z.nativeEnum(RollupFunctionType);

export const RollupRuleSchema = z.object({
  aggregateType: AggregateTypeSchema.optional(),
  rollupFn: RollupFunctionTypeSchema,
  sourceColumn: z.string(),
  targetColumn: z.string().optional(),
});

export type RollupRule = z.infer<typeof RollupRuleSchema>;

export const RollupOptionsSchema = z.object({
  name: z.string(),
  sourceView: z.string(),
  bucketInterval: z.string(),
  rollupRules: z.array(RollupRuleSchema),
  materializedOnly: z.boolean().default(false),
  bucketColumn: z.object({
    source: z.string(),
    target: z.string(),
  }),
  refresh_policy: RefreshPolicySchema.optional(),
});

export type RollupOptions = z.infer<typeof RollupOptionsSchema>;

export const RollupConfigSchema = z.object({
  continuousAggregateOptions: CreateContinuousAggregateOptionsSchema,
  rollupOptions: RollupOptionsSchema,
});

export type RollupConfig = z.infer<typeof RollupConfigSchema>;

export const BucketIntervalSchema = z.object({
  value: z.number(),
  unit: z.enum(['minute', 'hour', 'day', 'week', 'month', 'year']),
});

export type BucketInterval = z.infer<typeof BucketIntervalSchema>;
