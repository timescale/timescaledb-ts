import { DataSource, EntityMetadata, getMetadataArgsStorage } from 'typeorm';
import { TimescaleDB, generateTimestamptzCheck } from '@timescaledb/core';
import { HYPERTABLE_METADATA_KEY } from '../decorators/Hypertable';
import { timescaleMethods } from '../repository/TimescaleRepository';
import { CONTINUOUS_AGGREGATE_METADATA_KEY, ContinuousAggregateMetadata } from '../decorators/ContinuousAggregate';
import { AGGREGATE_COLUMN_METADATA_KEY } from '../decorators/AggregateColumn';
import { AggregateColumnOptions, AggregateType } from '@timescaledb/schemas';
import { validateBucketColumn } from '../decorators/BucketColumn';
import { ROLLUP_METADATA_KEY, RollupMetadata } from '../decorators/Rollup';
import { CANDLESTICK_COLUMN_METADATA_KEY, CandlestickColumnMetadata } from '../decorators/CandlestickColumn';
import { ROLLUP_COLUMN_METADATA_KEY } from '../decorators/RollupColumn';
import { TIME_COLUMN_METADATA_KEY, TimeColumnMetadata } from '../decorators/TimeColumn';
import { debugTypeOrm } from '../debug';

const debug = debugTypeOrm('migration');

const originalRunMigrations = DataSource.prototype.runMigrations;
const originalUndoLastMigration = DataSource.prototype.undoLastMigration;
const originalSynchronize = DataSource.prototype.synchronize;
const originalInitialize = DataSource.prototype.initialize;

const eligibleEntityMetadatas = (entityMetadatas: EntityMetadata[]) => {
  return entityMetadatas.filter((entity) => {
    return typeof entity.target !== 'string';
  })
}

DataSource.prototype.initialize = async function () {
  debug('Initializing TimescaleDB');

  const connection = await originalInitialize.call(this);

  for (const entity of eligibleEntityMetadatas(this.entityMetadatas)) {
    const hypertableOptions = Reflect.getMetadata(HYPERTABLE_METADATA_KEY, entity.target);
    const aggregateOptions = Reflect.getMetadata(CONTINUOUS_AGGREGATE_METADATA_KEY, entity.target);
    const rollupOptions = Reflect.getMetadata(ROLLUP_METADATA_KEY, entity.target);

    if (hypertableOptions || aggregateOptions || rollupOptions) {
      const repository = this.getRepository(entity.target);
      Object.assign(repository, timescaleMethods);
    }
  }

  debug('TimescaleDB initialized');

  return connection;
};

async function setupTimescaleExtension(dataSource: DataSource) {
  debug('Setting up TimescaleDB extension');

  try {
    const extension = TimescaleDB.createExtension();
    await dataSource.query(extension.up().build());

    await dataSource.query('CREATE EXTENSION IF NOT EXISTS timescaledb_toolkit;');
  } catch (error) {
    debug('Error setting up TimescaleDB extension:', error);

    if (
      !(error as Error).message.includes('extension "timescaledb" already exists') &&
      !(error as Error).message.includes('extension "timescaledb_toolkit" already exists')
    ) {
      throw error;
    }
  }
}

DataSource.prototype.runMigrations = async function (options?: { transaction?: 'all' | 'none' | 'each' }) {
  debug('Running migrations');

  const migrations = await originalRunMigrations.call(this, options);

  await setupTimescaleObjects(this);

  debug('Migrations complete');

  return migrations;
};

DataSource.prototype.undoLastMigration = async function (options?: { transaction?: 'all' | 'none' | 'each' }) {
  await removeTimescaleObjects(this);
  return originalUndoLastMigration.call(this, options);
};

DataSource.prototype.synchronize = async function (dropBeforeSync: boolean = false) {
  if (dropBeforeSync) {
    await removeTimescaleObjects(this);
  }

  await originalSynchronize.call(this, dropBeforeSync);
  await setupTimescaleObjects(this);
};

async function setupHypertables(dataSource: DataSource) {
  debug('Setting up hypertables');

  const entities = dataSource.entityMetadatas;

  for await (const entity of entities) {
    const options = Reflect.getMetadata(HYPERTABLE_METADATA_KEY, entity.target);

    if (options) {
      const hypertable = TimescaleDB.createHypertable(entity.tableName, options);
      const hypertableCheck = await dataSource.query(hypertable.inspect().build());

      if (!hypertableCheck[0].table_exists) {
        debug(`Table ${entity.tableName} does not exist, skipping hypertable setup`);
        continue;
      }

      if (hypertableCheck[0].is_hypertable) {
        debug(`Hypertable for ${entity.tableName} already exists`);
        continue;
      }

      debug(`Setting up hypertable for ${entity.tableName}`);

      await dataSource.query(hypertable.up().build());

      const repository = dataSource.getRepository(entity.target);
      Object.assign(repository, timescaleMethods);
    }
  }

  debug('Hypertables setup');
}

async function removeHypertables(dataSource: DataSource) {
  debug('Removing hypertables');

  const entities = dataSource.entityMetadatas;

  for await (const entity of entities) {
    const options = Reflect.getMetadata(HYPERTABLE_METADATA_KEY, entity.target);

    if (options) {
      const hypertable = TimescaleDB.createHypertable(entity.tableName, options);
      const hypertableCheck = await dataSource.query(hypertable.inspect().build());

      if (!hypertableCheck[0].is_hypertable) {
        debug(`Table ${entity.tableName} is not a hypertable, skipping removal`);
        continue;
      }

      await dataSource.query(hypertable.down().build());

      debug(`Hypertable for ${entity.tableName} removed`);
    }
  }
}

async function setupTimescaleObjects(dataSource: DataSource) {
  if (!dataSource.isInitialized) {
    throw new Error('DataSource must be initialized before setting up TimescaleDB objects');
  }

  await setupTimescaleExtension(dataSource);
  await setupTimeColumns(dataSource);
  await setupHypertables(dataSource);
  await setupContinuousAggregates(dataSource);
  await setupRollups(dataSource);
}

async function removeContinuousAggregates(dataSource: DataSource) {
  debug('Removing continuous aggregates');

  const entities = dataSource.entityMetadatas;

  for (const entity of entities) {
    const aggregateMetadata = Reflect.getMetadata(
      CONTINUOUS_AGGREGATE_METADATA_KEY,
      entity.target,
    ) as ContinuousAggregateMetadata;

    if (!aggregateMetadata) continue;

    const aggregate = TimescaleDB.createContinuousAggregate(
      entity.tableName,
      '', // Source table not needed for down()
      aggregateMetadata.options,
    );

    const statements = aggregate.down().build();
    for (const sql of statements) {
      await dataSource.query(sql);

      debug(`Continuous aggregate for ${entity.tableName} removed`);
    }
  }

  debug('Continuous aggregates removed');
}

async function removeTimescaleObjects(dataSource: DataSource) {
  if (!dataSource.isInitialized) {
    throw new Error('DataSource must be initialized before removing TimescaleDB objects');
  }

  await removeRollups(dataSource);
  await removeContinuousAggregates(dataSource);
  await removeHypertables(dataSource);
}

async function validateAggregateColumns(dataSource: DataSource) {
  for (const entity of dataSource.entityMetadatas) {
    const aggregateColumns =
      // @ts-ignore
      Reflect.getMetadata(AGGREGATE_COLUMN_METADATA_KEY, entity.target.prototype) ||
      Reflect.getMetadata(AGGREGATE_COLUMN_METADATA_KEY, entity.target);

    if (aggregateColumns) {
      const continuousAggregateMetadata = Reflect.getMetadata(CONTINUOUS_AGGREGATE_METADATA_KEY, entity.target);
      if (!continuousAggregateMetadata) {
        throw new Error(`Class ${entity.name} uses @AggregateColumn but is not decorated with @ContinuousAggregate`);
      }

      const { sourceModel } = continuousAggregateMetadata;
      const sourceMetadata = getMetadataArgsStorage().tables.find((table) => table.target === sourceModel);
      if (!sourceMetadata) {
        throw new Error(`Source model for ${entity.name} is not a valid TypeORM entity`);
      }
    }
  }
}

async function setupContinuousAggregates(dataSource: DataSource) {
  debug('Setting up continuous aggregates');

  const entities = dataSource.entityMetadatas;

  for (const entity of entities) {
    const aggregateMetadata = Reflect.getMetadata(
      CONTINUOUS_AGGREGATE_METADATA_KEY,
      entity.target,
    ) as ContinuousAggregateMetadata;

    if (!aggregateMetadata) continue;

    const sourceMetadata = dataSource.getMetadata(aggregateMetadata.sourceModel);
    const sourceTableName = sourceMetadata.tableName;

    const sourceOptions = Reflect.getMetadata(HYPERTABLE_METADATA_KEY, aggregateMetadata.sourceModel);
    const sourceHypertable = TimescaleDB.createHypertable(sourceTableName, sourceOptions);

    const hypertableCheck = await dataSource.query(sourceHypertable.inspect().build());
    if (!hypertableCheck[0].is_hypertable) {
      debug(`Source table ${sourceTableName} is not a hypertable, skipping continuous aggregate setup`);
      continue;
    }

    await validateAggregateColumns(dataSource);

    const aggregateColumns =
      // @ts-ignore
      Reflect.getMetadata(AGGREGATE_COLUMN_METADATA_KEY, entity.target.prototype) ||
      (Reflect.getMetadata(AGGREGATE_COLUMN_METADATA_KEY, entity.target) as Record<string, AggregateColumnOptions>);

    if (!aggregateColumns) {
      const error = `No aggregates defined for continuous aggregate ${entity.tableName}`;
      debug(error);
      throw new Error(error);
    }

    // @ts-ignore
    const bucketMetadata = validateBucketColumn(entity.target);

    const candlestickMetadata = Reflect.getMetadata(
      CANDLESTICK_COLUMN_METADATA_KEY,
      entity.target,
    ) as CandlestickColumnMetadata;

    if (candlestickMetadata) {
      aggregateColumns[candlestickMetadata.propertyKey.toString()] = {
        type: 'candlestick',
        time_column: candlestickMetadata.time_column,
        price_column: candlestickMetadata.price_column,
        volume_column: candlestickMetadata.volume_column,
        column_alias: candlestickMetadata.propertyKey.toString(),
      };
    }

    aggregateMetadata.options.aggregates = {
      [bucketMetadata.propertyKey.toString()]: {
        type: AggregateType.Bucket,
        column: bucketMetadata.source_column,
        column_alias: bucketMetadata.propertyKey.toString(),
      },
      ...aggregateMetadata.options.aggregates,
      ...Object.entries(aggregateColumns).reduce<{ [key: string]: AggregateColumnOptions }>((acc, [key, value]) => {
        // @ts-ignore
        acc[key] = value;
        return acc;
      }, {}),
    };

    const aggregate = TimescaleDB.createContinuousAggregate(
      entity.tableName,
      sourceTableName,
      aggregateMetadata.options,
    );

    const exists = await dataSource.query(aggregate.inspect().build());
    if (!exists[0].hypertable_exists) {
      await dataSource.query(aggregate.up().build());

      const refreshPolicy = aggregate.up().getRefreshPolicy();
      if (refreshPolicy) {
        await dataSource.query(refreshPolicy);
      }
    }

    debug(`Continuous aggregate for ${entity.tableName} set up`);
  }

  debug('Continuous aggregates setup');
}

async function setupRollups(dataSource: DataSource) {
  debug('Setting up rollups');

  for (const entity of eligibleEntityMetadatas(dataSource.entityMetadatas)) {
    const rollupMetadata = Reflect.getMetadata(ROLLUP_METADATA_KEY, entity.target) as RollupMetadata;
    if (!rollupMetadata) continue;

    const { rollupConfig } = rollupMetadata;

    const builder = TimescaleDB.createRollup(rollupConfig);

    const inspectResults = await dataSource.query(builder.inspect().build());

    if (!inspectResults[0].source_view_exists) {
      debug(`Source view ${rollupConfig.rollupOptions.sourceView} does not exist for rollup ${entity.tableName}`);
      continue;
    }

    if (inspectResults[0].rollup_view_exists) {
      debug(`Rollup view ${entity.tableName} already exists, skipping creation`);
      continue;
    }

    const candlestickMetadata = Reflect.getMetadata(
      CANDLESTICK_COLUMN_METADATA_KEY,
      entity.target,
    ) as CandlestickColumnMetadata;

    const candlestick = candlestickMetadata
      ? {
          propertyName: String(candlestickMetadata.propertyKey),
          timeColumn: candlestickMetadata.time_column,
          priceColumn: candlestickMetadata.price_column,
          volumeColumn: candlestickMetadata.volume_column,
          sourceColumn: candlestickMetadata.source_column,
        }
      : undefined;

    const rollupColumns = Reflect.getMetadata(ROLLUP_COLUMN_METADATA_KEY, entity.target) || {};
    const rollupRules = Object.entries(rollupColumns).map(([, value]: [string, any]) => ({
      sourceColumn: value.source_column,
      targetColumn: String(value.propertyKey),
      aggregateType: value.type,
      rollupFn: value.rollup_fn || 'rollup',
    }));

    try {
      const inspectResults = await dataSource.query(builder.inspect().build());

      if (!inspectResults[0].source_view_exists) {
        debug(`Source view ${rollupConfig.rollupOptions.sourceView} does not exist for rollup ${entity.tableName}`);
        continue;
      }

      if (inspectResults[0].rollup_view_exists) {
        debug(`Rollup view ${entity.tableName} already exists, skipping creation`);
        continue;
      }

      const sql = builder.up().build({
        candlestick,
        rollupRules,
      });

      await dataSource.query(sql);

      const refreshPolicy = builder.up().getRefreshPolicy();
      if (refreshPolicy) {
        await dataSource.query(refreshPolicy);
      }
    } catch (error) {
      debug(`Failed to setup rollup for ${entity.tableName}:`, error);
      throw error;
    }

    const refreshPolicy = builder.up().getRefreshPolicy();
    if (refreshPolicy) {
      await dataSource.query(refreshPolicy);
    }

    debug(`Rollup for ${entity.tableName} set up`);
  }
}

async function removeRollups(dataSource: DataSource) {
  debug('Removing rollups');

  for (const entity of eligibleEntityMetadatas(dataSource.entityMetadatas)) {
    const rollupMetadata = Reflect.getMetadata(ROLLUP_METADATA_KEY, entity.target);

    if (!rollupMetadata) continue;

    const { rollupConfig } = rollupMetadata;
    const builder = TimescaleDB.createRollup(rollupConfig);
    const statements = builder.down().build();

    for (const sql of statements) {
      await dataSource.query(sql);

      debug(`Rollup for ${entity.tableName} removed`);
    }
  }

  debug('Rollups removed');
}

async function setupTimeColumns(dataSource: DataSource) {
  debug('Setting up time columns');

  for (const entity of eligibleEntityMetadatas(dataSource.entityMetadatas)) {
    const timeColumnMetadata = Reflect.getMetadata(TIME_COLUMN_METADATA_KEY, entity.target) as TimeColumnMetadata;

    if (timeColumnMetadata) {
      const checkSql = generateTimestamptzCheck(entity.tableName, timeColumnMetadata.columnName);

      await dataSource.query(checkSql);
    }
  }

  debug('Time columns setup');
}
