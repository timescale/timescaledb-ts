import './hooks/migration';

export { Hypertable, HYPERTABLE_METADATA_KEY } from './decorators/Hypertable';
export { ContinuousAggregate, CONTINUOUS_AGGREGATE_METADATA_KEY } from './decorators/ContinuousAggregate';
export { AggregateColumn, AGGREGATE_COLUMN_METADATA_KEY } from './decorators/AggregateColumn';

export * from './repository/TimescaleRepository';
