import { z } from 'zod';

export enum AggregateType {
  Count = 'count',
  CountDistinct = 'count_distinct',
  Sum = 'sum',
  Avg = 'avg',
  Min = 'min',
  Max = 'max',
}
export const AggregateTypeSchema = z.nativeEnum(AggregateType);

export const AggregateColumnOptionsSchema = z.object({
  type: AggregateTypeSchema,
  column: z.string().optional(),
  column_alias: z.string().optional(),
});
export type AggregateColumnOptions = z.infer<typeof AggregateColumnOptionsSchema>;

export const RefreshPolicySchema = z.object({
  start_offset: z.string(),
  end_offset: z.string(),
  schedule_interval: z.string(),
});

export const CreateContinuousAggregateOptionsSchema = z
  .object({
    name: z.string(),
    bucket_interval: z.string(),
    time_column: z.string(),
    refresh_policy: RefreshPolicySchema.optional(),
    aggregates: z.record(AggregateColumnOptionsSchema).optional(),
  })
  .strict();

export type CreateContinuousAggregateOptions = z.infer<typeof CreateContinuousAggregateOptionsSchema>;
