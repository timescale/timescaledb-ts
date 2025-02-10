import { ViewColumn } from 'typeorm';
import { CandlestickColumnOptions } from '@timescaledb/schemas';

export const CANDLESTICK_COLUMN_METADATA_KEY = Symbol('timescale:candlestick-column');

export interface CandlestickColumnMetadata extends CandlestickColumnOptions {
  propertyKey: string | symbol;
}

export function CandlestickColumn(options: Partial<CandlestickColumnOptions>) {
  return function (target: any, propertyKey: string | symbol) {
    const metadata: CandlestickColumnMetadata = {
      ...(options as CandlestickColumnOptions),
      propertyKey,
    };

    ViewColumn()(target, propertyKey);

    // Store metadata for use during migrations
    Reflect.defineMetadata(CANDLESTICK_COLUMN_METADATA_KEY, metadata, target.constructor);

    return target;
  };
}

export function getCandlestickSQL(entity: Function, isRollup: boolean = false): string {
  const metadata = Reflect.getMetadata(CANDLESTICK_COLUMN_METADATA_KEY, entity) as CandlestickColumnMetadata;
  if (!metadata) return '';

  if (isRollup) {
    if (!metadata.source_column) {
      throw new Error('source_column must be specified for candlestick rollups');
    }
    return `rollup(${metadata.source_column}) as ${String(metadata.propertyKey)}`;
  }

  if (!metadata.time_column || !metadata.price_column) {
    throw new Error('time_column and price_column must be specified for candlestick aggregation');
  }

  const args = [metadata.time_column, metadata.price_column];
  if (metadata.volume_column) {
    args.push(metadata.volume_column);
  }

  return `candlestick_agg(${args.join(', ')}) as ${String(metadata.propertyKey)}`;
}
