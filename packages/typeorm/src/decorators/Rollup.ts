import { getMetadataArgsStorage, ViewEntity } from 'typeorm';
import { CreateContinuousAggregateOptions, RollupConfig } from '@timescaledb/schemas';
import { BUCKET_COLUMN_METADATA_KEY, validateBucketColumn } from './BucketColumn';
import { ROLLUP_COLUMN_METADATA_KEY } from './RollupColumn';

export const ROLLUP_METADATA_KEY = Symbol('timescale:rollup');

export interface RollupOptions extends Omit<CreateContinuousAggregateOptions, 'time_column'> {
  bucket_interval: string;
  materialized_only?: boolean;
}

export interface RollupMetadata {
  sourceModel: Function;
  options: CreateContinuousAggregateOptions;
  rollupConfig: RollupConfig;
  sourceBucketColumn: string;
  targetBucketColumn: string;
}

function validateSourceModel(sourceModel: Function) {
  if (Reflect.getMetadata(ROLLUP_METADATA_KEY, sourceModel)) {
    throw new Error('Multi-level rollups are not supported. The source model is already a rollup view.');
  }

  const sourceMetadata = getMetadataArgsStorage().tables.find((table) => table.target === sourceModel);
  return sourceMetadata;
}

function validateSourceModelMetadata(metadata: any) {
  if (!metadata) {
    throw new Error('Source model is not a TypeORM entity');
  }
  return metadata;
}

function validateSourceBucketColumn(sourceModel: Function, bucketMetadata: { source_column: string }) {
  const sourceBucketMetadata = Reflect.getMetadata(BUCKET_COLUMN_METADATA_KEY, sourceModel);

  if (!sourceBucketMetadata) {
    throw new Error('Source model must have a bucket column');
  }

  if (bucketMetadata.source_column !== sourceBucketMetadata.propertyKey.toString()) {
    throw new Error('Rollup bucket column must reference a bucket column from the source view');
  }

  return sourceBucketMetadata;
}

export function Rollup<T extends { new (...args: any[]): any }>(sourceModel: Function, options: RollupOptions) {
  return function (target: T): T {
    const sourceMetadata = validateSourceModelMetadata(validateSourceModel(sourceModel));
    if (!sourceMetadata) {
      throw new Error('Source model is not a TypeORM entity');
    }

    const sourcePrimaryColumns = getMetadataArgsStorage()
      .columns.filter((col) => col.target === sourceModel && col.options?.primary)
      .map((col) => col.propertyName || col.options?.name)
      .filter((name): name is string => name !== undefined);

    const targetPrimaryColumns = getMetadataArgsStorage()
      .columns.filter((col) => col.target === target && col.options?.primary)
      .map((col) => col.propertyName || col.options?.name)
      .filter((name): name is string => name !== undefined);

    const groupColumns = Array.from(
      new Set([...sourcePrimaryColumns, ...targetPrimaryColumns, ...(options?.group_columns || [])]),
    );

    const targetBucketMetadata = validateBucketColumn(target);
    const sourceBucketMetadata = validateSourceBucketColumn(sourceModel, {
      source_column: targetBucketMetadata.source_column,
    });

    const rollupColumns = Reflect.getMetadata(ROLLUP_COLUMN_METADATA_KEY, target) || {};

    const rollupConfig: RollupConfig = {
      continuousAggregateOptions: {
        ...options,
        name: options.name,
        time_column: sourceBucketMetadata.source_column,
        group_columns: groupColumns,
      },
      rollupOptions: {
        sourceView: sourceMetadata.name!,
        bucketInterval: options.bucket_interval,
        name: options.name,
        materializedOnly: options.materialized_only || false,
        rollupRules: Object.values(rollupColumns).map((column: any) => ({
          rollupFn: column.rollup_fn || 'rollup',
          aggregateType: column.type,
          sourceColumn: column.source_column,
          targetColumn: column.propertyKey.toString(),
        })),
        bucketColumn: {
          source: sourceBucketMetadata.propertyKey.toString(),
          target: targetBucketMetadata.propertyKey.toString(),
        },
      },
    };

    const metadata: RollupMetadata = {
      sourceModel,
      options,
      rollupConfig,
      sourceBucketColumn: sourceBucketMetadata.propertyKey.toString(),
      targetBucketColumn: targetBucketMetadata.propertyKey.toString(),
    };

    Reflect.defineMetadata(ROLLUP_METADATA_KEY, metadata, target);

    return ViewEntity({
      name: options.name,
      materialized: true,
      synchronize: false,
    })(target) as T;
  };
}
