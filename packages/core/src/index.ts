import {
  CandlestickAggregateOptions,
  CreateContinuousAggregateOptions,
  CreateExtensionOptions,
  CreateHypertableOptions,
  RollupConfig,
} from '@timescaledb/schemas';
import { Hypertable } from './hypertable';
import { Extension } from './extension';
import { ContinuousAggregate } from './continuous-aggregate';
import { CandlestickAggregateBuilder } from './candlestick';
import { RollupBuilder } from './rollup';

export const name = '@timescaledb/core';

export class TimescaleDB {
  public static Hypertable: Hypertable;

  public static createHypertable(tableName: string, options: CreateHypertableOptions): Hypertable {
    const hypertable = new Hypertable(tableName, options);

    return hypertable;
  }

  public static createExtension(options?: CreateExtensionOptions): Extension {
    const extension = new Extension(options);

    return extension;
  }

  public static createContinuousAggregate(
    name: string,
    source: string,
    options: Omit<CreateContinuousAggregateOptions, 'name'>,
  ): ContinuousAggregate {
    return new ContinuousAggregate(name, source, { ...options, name });
  }

  public static createCandlestickAggregate(
    tableName: string,
    options: CandlestickAggregateOptions,
  ): CandlestickAggregateBuilder {
    return new CandlestickAggregateBuilder(tableName, options);
  }

  public static createRollup(config: RollupConfig): RollupBuilder {
    return new RollupBuilder(config);
  }
}

export { generateTimestamptzCheck } from './time-column';
export * from './errors';
