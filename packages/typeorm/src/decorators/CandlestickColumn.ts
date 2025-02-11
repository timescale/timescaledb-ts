import { ViewColumn } from 'typeorm';
import { CandlestickColumnOptions } from '@timescaledb/schemas';
import { parseCandlestick } from '../utils/parse-candlestick';

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

    Reflect.defineMetadata(CANDLESTICK_COLUMN_METADATA_KEY, metadata, target.constructor);

    const backingFieldKey = `_${String(propertyKey)}`;

    Object.defineProperty(target, propertyKey, {
      get: function () {
        const value = this[backingFieldKey];
        if (typeof value === 'string') {
          return parseCandlestick(value);
        }
        return value;
      },
      set: function (value: any) {
        this[backingFieldKey] = value;
      },
      enumerable: true,
      configurable: true,
    });

    const originalToJSON = target.constructor.prototype.toJSON;
    if (!originalToJSON) {
      target.constructor.prototype.toJSON = function () {
        const json: any = {};
        for (const key in this) {
          if (key.startsWith('_')) {
            const publicKey = key.substring(1);
            json[publicKey] = this[key];
          } else {
            json[key] = this[key];
          }
        }
        return json;
      };
    }

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
