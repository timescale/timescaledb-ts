/// <reference types="reflect-metadata" />
import { CreateContinuousAggregateOptions } from '@timescaledb/schemas';
import { getMetadataArgsStorage, ViewEntity } from 'typeorm';
import { AGGREGATE_COLUMN_METADATA_KEY } from './AggregateColumn';
import { validateBucketColumn } from './BucketColumn';

export const CONTINUOUS_AGGREGATE_METADATA_KEY = Symbol('timescale:continuous_aggregate');

export interface ContinuousAggregateMetadata {
  sourceModel: Function;
  options: CreateContinuousAggregateOptions;
  bucketColumn: string | symbol;
}

export function ContinuousAggregate<T extends { new (...args: any[]): any }>(
  sourceModel: Function,
  options: Omit<CreateContinuousAggregateOptions, 'time_column'>,
) {
  return function (target: T): T {
    const bucketMetadata = validateBucketColumn(target);

    const sourceMetadata = getMetadataArgsStorage().tables.find((table) => table.target === sourceModel);
    if (!sourceMetadata) {
      throw new Error('Source model is not a TypeORM entity');
    }

    const primaryColumns = getMetadataArgsStorage()
      .columns.filter((col) => col.target === sourceModel && col.options?.primary)
      .map((col) => col.options.name || col.propertyName)
      .filter((colName: string | undefined) => colName !== bucketMetadata.source_column);

    const metadata: ContinuousAggregateMetadata = {
      sourceModel,
      options: {
        ...options,
        time_column: bucketMetadata.source_column,
        group_columns: primaryColumns,
      },
      bucketColumn: bucketMetadata.propertyKey,
    };

    Reflect.defineMetadata(CONTINUOUS_AGGREGATE_METADATA_KEY, metadata, target);
    Reflect.defineMetadata(AGGREGATE_COLUMN_METADATA_KEY, sourceModel, target);

    target.prototype.toJSON = function () {
      const jsonObj: { [key: string]: any } = {};
      for (const key in this) {
        if (key.startsWith('_')) {
          jsonObj[key.substring(1)] = this[key];
        } else {
          jsonObj[key] = this[key];
        }
      }
      return jsonObj;
    };

    return ViewEntity({
      name: options.name,
      materialized: true,
      synchronize: false,
    })(target) as T;
  };
}
