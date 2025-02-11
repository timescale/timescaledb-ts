# @timescaledb/typeorm

This is the official TimescaleDB plugin for TypeORM.

## Installation

```bash
npm install typeorm @timescaledb/typeorm
```

## Hypertables

### Creating a Hypertable

Use the `@Hypertable` decorator to define your time-series tables:

See:

- https://docs.timescale.com/use-timescale/latest/hypertables/create/

Usage:

```typescript
import { Entity, PrimaryColumn } from 'typeorm';
import { Hypertable, TimeColumn } from '@timescaledb/typeorm';

@Entity('page_loads')
@Hypertable({
  compression: {
    compress: true,
    compress_orderby: 'time',
    compress_segmentby: 'user_agent',
    policy: {
      schedule_interval: '7 days',
    },
  },
})
export class PageLoad {
  @PrimaryColumn({ name: 'user_agent', type: 'varchar' })
  userAgent!: string;

  @TimeColumn()
  time!: Date;
}
```

## Hypertable Methods

### `getTimeBucket`

This method allows you to perform time bucketing queries on the hypertable:

See:

- https://docs.timescale.com/api/latest/hyperfunctions/time_bucket/

Usage:

```typescript
import { AppDataSource } from './data-source';
import { PageLoad } from './models/PageLoad';

const repository = AppDataSource.getRepository(PageLoad);

const stats = await repository.getTimeBucket({
  timeRange: {
    start,
    end,
  },
  bucket: {
    interval: '1 hour',
    metrics: [
      { type: 'count', alias: 'count' },
      { type: 'distinct_count', column: 'user_agent', alias: 'unique_users' },
    ],
  },
  where: {
    user_agent: 'Mozilla/5.0',
  },
});

console.log(stats);
// [
//   { interval: '2021-01-01T00:00:00Z', count: 10, unique_users: 5 },
//   { interval: '2021-01-01T01:00:00Z', count: 20, unique_users: 10 },
//   { interval: '2021-01-01T02:00:00Z', count: 30, unique_users: 15 },
//   ...
// ]
```

### `getCompressionStats`

Get compression statistics for a hypertable:

See:

- https://docs.timescale.com/api/latest/compression/hypertable_compression_stats/

Usage:

```typescript
import { AppDataSource } from './data-source';
import { PageLoad } from './models/PageLoad';

const repository = AppDataSource.getRepository(PageLoad);
const stats = await repository.getCompressionStats();

console.log(stats);
// {
//   total_chunks: 100,
//   compressed_chunks: 50,
//   number_compressed_chunks: 10,
// }
```

### `getCandlesticks`

See:

- [Candlestick 👇](#Candlesticks)

## Continuous Aggregates

### Creating a Continuous Aggregate

Use the `@ContinuousAggregate` decorator to define materialized views that automatically maintain aggregates over time windows, plus the `@AggregateColumn` decorator to define the columns in the materialized view:

See:

- https://docs.timescale.com/use-timescale/latest/continuous-aggregates/create-a-continuous-aggregate/

Usage:

```ts
import { ViewColumn } from 'typeorm';
import { ContinuousAggregate, AggregateColumn, BucketColumn } from '@timescaledb/typeorm';
import { PageLoad } from './PageLoad';

@ContinuousAggregate(PageLoad, {
  name: 'hourly_page_views',
  bucket_interval: '1 hour',
  refresh_policy: {
    start_offset: '3 days',
    end_offset: '1 hour',
    schedule_interval: '1 hour',
  },
})
export class HourlyPageViews {
  @BucketColumn({
    source_column: 'time',
  })
  bucket!: Date;

  @AggregateColumn({
    type: 'count',
  })
  total_views!: number;

  @AggregateColumn({
    type: 'unique_count',
    column: 'user_agent',
  })
  unique_users!: number;
}
```

### Using Continuous Aggregates

Query the materialized view like a regular entity:

See:

- https://orkhan.gitbook.io/typeorm/docs/view-entities

Usage:

```ts
const hourlyStats = await AppDataSource.getRepository(HourlyPageViews)
  .createQueryBuilder()
  .where('bucket >= :start', { start })
  .andWhere('bucket <= :end', { end })
  .orderBy('bucket', 'DESC')
  .getMany();
```

## Rollups

Rollups let you aggregate data from continuous aggregates into longer time intervals (e.g., roll up hourly statistics into daily summaries).

See:

- https://docs.timescale.com/use-timescale/latest/continuous-aggregates/hierarchical-continuous-aggregates/

### Usage

First, define your source continuous aggregate:

```typescript
import { ContinuousAggregate, BucketColumn, AggregateColumn } from '@timescaledb/typeorm';

@ContinuousAggregate(PageLoad, {
  name: 'hourly_page_views',
  bucket_interval: '1 hour',
})
export class HourlyPageViews {
  @BucketColumn({
    source_column: 'time',
  })
  bucket!: Date;

  @AggregateColumn({
    type: 'count',
  })
  total_views!: number;
}
```

Then define your rollup:

```typescript
import { Rollup, RollupColumn, BucketColumn } from '@timescaledb/typeorm';

@Rollup(HourlyPageViews, {
  name: 'daily_page_stats',
  bucket_interval: '1 day',
  refresh_policy: {
    start_offset: '30 days',
    end_offset: '1 day',
    schedule_interval: '1 day',
  },
})
export class DailyPageStats {
  @BucketColumn({
    source_column: 'bucket',
  })
  bucket!: Date;

  @RollupColumn({
    type: 'sum',
    source_column: 'total_views',
  })
  daily_total!: number;
}
```

Query the rollup:

```typescript
const stats = await AppDataSource.getRepository(DailyPageStats)
  .createQueryBuilder()
  .where('bucket >= :start', { start })
  .andWhere('bucket < :end', { end })
  .getMany();
```

The library automatically handles rollup creation and updates during migrations.

## Candlesticks

Use a Hypertable to define a time-series table, then use the `getCandlesticks` method on the repository to query candlestick data:

See:

- https://docs.timescale.com/api/latest/hyperfunctions/financial-analysis/candlestick_agg/

### Defining a Candlestick Entity

```typescript
import { Entity } from 'typeorm';
import { Hypertable, TimeColumn } from '@timescaledb/typeorm';

@Entity('stock_prices')
@Hypertable()
export class StockPrice {
  @PrimaryColumn({ type: 'varchar' })
  tickerSymbol: string;

  @TimeColumn()
  timestamp: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  volume: number;
}
```

### Querying Candlestick Data

Use the appended `getCandlesticks` method on the repository to query candlestick data:

```typescript
const repository = AppDataSource.getRepository(StockPrice);

const candlesticks = await repository.getCandlesticks({
  timeRange: {
    start: new Date('2025-01-01'),
    end: new Date('2025-01-02'),
  },
  config: {
    time_column: 'timestamp',
    price_column: 'price',
    volume_column: 'volume',
    bucket_interval: '1 hour',
  },
  where: {
    symbol: 'AAPL',
  },
});

console.log(candlesticks);
// Output:
// [
//   {
//     bucket_time: "2025-01-01T00:00:00.000Z",
//     open: 185.25,
//     high: 186.64,
//     low: 183.34,
//     close: 184.87,
//     open_time: "2025-01-01T00:02:15.000Z",
//     high_time: "2025-01-01T00:45:12.000Z",
//     low_time: "2025-01-01T00:15:33.000Z",
//     close_time: "2025-01-01T00:59:45.000Z",
//     volume: 2589100,
//     vwap: 184.95
//   },
//   ...
// ]
```

## Migrations

To hook into the TypeORM migration process, import the library at the top of your `data-source` file:

```typescript
import '@timescaledb/typeorm'; // This should be the first import in your file to hook into the TypeORM migration process

import { DataSource } from 'typeorm';
import { PageLoad, HourlyPageViews } from './models';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
  entities: [PageLoad, HourlyPageViews, StockPrice], // <-- Add your entities here
  migrations: ['migrations/*.ts'],
});
```

Then run your normal TypeORM migration commands:

```bash
typeorm-ts-node-commonjs migration:run -d src/data-source.ts
```

The `@timescaledb/typeorm` library will automatically create the necessary hypertables and other TimescaleDB-specific objects in the database.

If you wish to have more control over the migration process, then please reffer to the `@timescaledb/core` library and how its used in this integration.
