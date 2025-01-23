import { CreateContinuousAggregateOptions } from '@timescaledb/schemas';
import { TimescaleDB } from '@timescaledb/core';
import { getMetadataArgsStorage, ViewEntity } from 'typeorm';

export const CONTINUOUS_AGGREGATE_METADATA_KEY = Symbol('timescale:continuous_aggregate');

export interface ContinuousAggregateMetadata {
  sourceModel: Function;
  options: CreateContinuousAggregateOptions;
}

export function ContinuousAggregate<T extends { new (...args: any[]): any }>(
  sourceModel: Function,
  options: CreateContinuousAggregateOptions,
) {
  return function (target: T): T {
    // Store the metadata for later use
    Reflect.defineMetadata(CONTINUOUS_AGGREGATE_METADATA_KEY, { sourceModel, options }, target);

    // Get the source table name from the source model metadata
    const sourceMetadata = getMetadataArgsStorage().tables.find((table) => table.target === sourceModel);

    if (!sourceMetadata) {
      throw new Error('Source model is not a TypeORM entity');
    }

    const sourceTableName = sourceMetadata.name || sourceModel.name.toLowerCase();

    // Use the builder to generate the view expression
    const aggregate = TimescaleDB.createContinuousAggregate(options.name, sourceTableName, options);
    const selectExpression = aggregate.up().getViewDefinition();

    // Apply the ViewEntity decorator with just the SELECT expression
    const decoratedClass = ViewEntity({
      name: options.name,
      expression: selectExpression,
      materialized: true,
      synchronize: false,
    })(target);

    return decoratedClass as T;
  };
}
