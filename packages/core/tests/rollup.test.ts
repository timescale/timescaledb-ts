import { describe, it, expect } from '@jest/globals';
import { RollupBuilder } from '../src/rollup';
import { RollupConfig, RollupFunctionType, AggregateType } from '@timescaledb/schemas';

describe('RollupBuilder', () => {
  const baseConfig: RollupConfig = {
    continuousAggregateOptions: {
      name: 'daily_rollup',
      bucket_interval: '1 hour',
      time_column: 'time',
      refresh_policy: {
        start_offset: '1 day',
        end_offset: '1 hour',
        schedule_interval: '1 hour',
      },
    },
    rollupOptions: {
      refresh_policy: {
        start_offset: '30 days',
        end_offset: '1 day',
        schedule_interval: '1 day',
      },
      bucketColumn: {
        source: 'bucket',
        target: 'bucket',
      },
      name: 'daily_rollup',
      sourceView: 'hourly_metrics',
      bucketInterval: '1 day',
      rollupRules: [
        {
          rollupFn: RollupFunctionType.Rollup,
          sourceColumn: 'percentile_hourly',
          targetColumn: 'percentile_daily',
        },
        {
          rollupFn: RollupFunctionType.Rollup,
          sourceColumn: 'total_hourly',
          targetColumn: 'total_daily',
          aggregateType: AggregateType.Sum,
        },
      ],
      materializedOnly: false,
    },
  };

  describe('SQL Generation', () => {
    describe('up()', () => {
      it('should generate basic rollup SQL', () => {
        const builder = new RollupBuilder(baseConfig);
        const sql = builder.up().build({
          rollupRules: baseConfig.rollupOptions.rollupRules,
        });
        expect(sql).toMatchSnapshot();
      });

      it('should generate SQL with materialized-only option', () => {
        const config = {
          ...baseConfig,
          rollupOptions: {
            ...baseConfig.rollupOptions,
            materializedOnly: true,
          },
        };
        const builder = new RollupBuilder(config);
        const sql = builder.up().build({
          rollupRules: config.rollupOptions.rollupRules,
        });
        expect(sql).toMatchSnapshot();
      });

      it('should include candlestick columns', () => {
        const builder = new RollupBuilder(baseConfig);
        const sql = builder.up().build({
          rollupRules: baseConfig.rollupOptions.rollupRules,
          candlestick: {
            propertyName: 'candlestick',
            sourceColumn: 'candlestick',
          },
        });
        expect(sql).toMatchSnapshot();
      });

      it('should handle group columns', () => {
        const config = {
          ...baseConfig,
          continuousAggregateOptions: {
            ...baseConfig.continuousAggregateOptions,
            group_columns: ['symbol', 'exchange'],
          },
        };
        const builder = new RollupBuilder(config);
        const sql = builder.up().build({
          rollupRules: config.rollupOptions.rollupRules,
        });
        expect(sql).toMatchSnapshot();
      });

      it('should handle special characters in column names', () => {
        const config = {
          ...baseConfig,
          rollupOptions: {
            ...baseConfig.rollupOptions,
            rollupRules: [
              {
                rollupFn: RollupFunctionType.Rollup,
                sourceColumn: 'percentile"hourly',
                targetColumn: 'percentile"daily',
              },
            ],
          },
        };
        const builder = new RollupBuilder(config);
        const sql = builder.up().build({
          rollupRules: config.rollupOptions.rollupRules,
        });
        expect(sql).toMatchSnapshot();
      });

      it('should handle different aggregate types', () => {
        const config = {
          ...baseConfig,
          rollupOptions: {
            ...baseConfig.rollupOptions,
            rollupRules: [
              {
                rollupFn: RollupFunctionType.Rollup,
                sourceColumn: 'value',
                targetColumn: 'sum_value',
                aggregateType: AggregateType.Sum,
              },
              {
                rollupFn: RollupFunctionType.Rollup,
                sourceColumn: 'value',
                targetColumn: 'avg_value',
                aggregateType: AggregateType.Avg,
              },
            ],
          },
        };
        const builder = new RollupBuilder(config);
        const sql = builder.up().build({
          rollupRules: config.rollupOptions.rollupRules,
        });
        expect(sql).toMatchSnapshot();
      });

      it('should handle different bucket columns', () => {
        const config = {
          ...baseConfig,
          rollupOptions: {
            ...baseConfig.rollupOptions,
            bucketColumn: {
              source: 'custom_bucket',
              target: 'custom_bucket',
            },
          },
        };
        const builder = new RollupBuilder(config);
        const sql = builder.up().build({
          rollupRules: config.rollupOptions.rollupRules,
        });
        expect(sql).toMatchSnapshot();
      });
    });

    describe('refresh policy', () => {
      it('should generate refresh policy SQL', () => {
        const builder = new RollupBuilder(baseConfig);
        const sql = builder.up().getRefreshPolicy();
        expect(sql).toMatchSnapshot();
      });

      it('should escape interval values in refresh policy', () => {
        const config = {
          ...baseConfig,
          rollupOptions: {
            ...baseConfig.rollupOptions,
            refresh_policy: {
              start_offset: "30 days'--injection",
              end_offset: '1 day',
              schedule_interval: '1 day',
            },
          },
        };
        const builder = new RollupBuilder(config);
        const sql = builder.up().getRefreshPolicy();
        expect(sql).toMatchSnapshot();
      });

      it('should handle missing refresh policy', () => {
        const config = {
          ...baseConfig,
          rollupOptions: {
            ...baseConfig.rollupOptions,
            refresh_policy: undefined,
          },
        };
        const builder = new RollupBuilder(config);
        const sql = builder.up().getRefreshPolicy();
        expect(sql).toBeNull();
      });
    });

    describe('down()', () => {
      it('should generate drop statements with refresh policy', () => {
        const builder = new RollupBuilder(baseConfig);
        const sql = builder.down().build();
        expect(sql).toMatchSnapshot();
      });

      it('should generate drop statements without refresh policy', () => {
        const config = {
          ...baseConfig,
          rollupOptions: {
            ...baseConfig.rollupOptions,
            refresh_policy: undefined,
          },
        };
        const builder = new RollupBuilder(config);
        const sql = builder.down().build();
        expect(sql).toMatchSnapshot();
      });

      it('should escape special characters in view names', () => {
        const config = {
          ...baseConfig,
          rollupOptions: {
            ...baseConfig.rollupOptions,
            name: 'daily"rollup.view',
          },
        };
        const builder = new RollupBuilder(config);
        const sql = builder.down().build();
        expect(sql).toMatchSnapshot();
      });
    });

    describe('inspect()', () => {
      it('should generate inspect SQL', () => {
        const builder = new RollupBuilder(baseConfig);
        const sql = builder.inspect().build();
        expect(sql).toMatchSnapshot();
      });

      it('should handle schema qualified names', () => {
        const config = {
          ...baseConfig,
          rollupOptions: {
            ...baseConfig.rollupOptions,
            name: 'public.daily_rollup',
            sourceView: 'public.hourly_metrics',
          },
        };
        const builder = new RollupBuilder(config);
        const sql = builder.inspect().build();
        expect(sql).toMatchSnapshot();
      });

      it('should escape special characters in view names', () => {
        const config = {
          ...baseConfig,
          rollupOptions: {
            ...baseConfig.rollupOptions,
            name: 'my"rollup.view',
            sourceView: 'source"view',
          },
        };
        const builder = new RollupBuilder(config);
        const sql = builder.inspect().build();
        expect(sql).toMatchSnapshot();
      });
    });
  });
});
