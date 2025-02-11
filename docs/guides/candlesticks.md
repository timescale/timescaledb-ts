# Candlesticks and Rollups with TimescaleDB and TypeORM

## Introduction

Candlesticks are a powerful way to analyze time-series data, particularly in financial applications. TimescaleDB provides advanced functionality for generating candlestick data, and with TypeORM, we can easily create and query these aggregations.

## Prerequisites

- Node.js >= 22.13.0
- TypeORM
- @timescaledb/typeorm package
- PostgreSQL with TimescaleDB extension

## Setting Up a Stock Price Entity

Let's create a stock price entity that will serve as our base for candlestick and rollup operations:

```typescript
import { Entity, Column } from 'typeorm';
import { Hypertable, TimeColumn } from '@timescaledb/typeorm';

@Entity('stock_prices')
@Hypertable({
  compression: {
    compress: true,
    compress_orderby: 'timestamp',
    compress_segmentby: 'symbol',
    policy: {
      schedule_interval: '7 days',
    },
  },
})
export class StockPrice {
  @PrimaryColumn({ type: 'varchar' })
  symbol!: string;

  @TimeColumn()
  timestamp!: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  volume!: number;
}
```

## Generating 1-Minute Candlesticks

First, let's create a continuous aggregate for 1-minute candlesticks:

```typescript
import { ContinuousAggregate, BucketColumn, CandlestickColumn } from '@timescaledb/typeorm';
import { StockPrice } from './StockPrice';
import { Candlestick } from '@timescaledb/schemas';

@ContinuousAggregate(StockPrice, {
  name: 'stock_candlesticks_1m',
  bucket_interval: '1 minute',
  refresh_policy: {
    start_offset: '1 day',
    end_offset: '1 minute',
    schedule_interval: '1 minute',
  },
})
export class StockPrice1M {
  @BucketColumn({
    source_column: 'timestamp',
  })
  bucket!: Date;

  @PrimaryColumn()
  symbol!: string;

  @CandlestickColumn({
    time_column: 'timestamp',
    price_column: 'price',
    volume_column: 'volume',
  })
  candlestick!: Candlestick;
}
```

## Creating 1-Hour Rollups

Now, let's create a rollup that aggregates the 1-minute candlesticks into 1-hour candlesticks:

```typescript
import { Rollup, BucketColumn, CandlestickColumn } from '@timescaledb/typeorm';
import { StockPrice1M } from './StockPrice1M';
import { Candlestick } from '@timescaledb/schemas';

@Rollup(StockPrice1M, {
  name: 'stock_candlesticks_1h',
  bucket_interval: '1 hour',
  refresh_policy: {
    start_offset: '7 days',
    end_offset: '1 hour',
    schedule_interval: '1 hour',
  },
})
export class StockPrice1H {
  @BucketColumn({
    source_column: 'bucket',
  })
  bucket!: Date;

  @PrimaryColumn()
  symbol!: string;

  @CandlestickColumn({
    source_column: 'candlestick',
  })
  candlestick!: Candlestick;
}
```

## Querying Candlesticks

### 1-Minute Candlesticks

```typescript
import { AppDataSource } from './data-source';
import { StockPrice1M } from './models/StockPrice1M';

async function get1MinuteCandlesticks() {
  const repository = AppDataSource.getRepository(StockPrice1M);

  const candlesticks = await repository
    .createQueryBuilder()
    .where('bucket >= :start', { start: new Date('2025-01-01') })
    .andWhere('bucket < :end', { end: new Date('2025-01-02') })
    .andWhere('symbol = :symbol', { symbol: 'AAPL' })
    .orderBy('bucket', 'ASC')
    .getMany();

  console.log(JSON.stringify(candlesticks, null, 2));
  // Example output:
  // [
  //   {
  //     "bucket": "2025-01-01T00:00:00.000Z",
  //     "symbol": "AAPL",
  //     "candlestick": {
  //       "open": 150.25,
  //       "high": 152.30,
  //       "low": 149.80,
  //       "close": 151.45,
  //       "volume": 1250000,
  //       "open_time": "2025-01-01T00:00:15.000Z",
  //       "close_time": "2025-01-01T00:59:45.000Z"
  //     }
  //   },
  //   ...
  // ]
}
```

### 1-Hour Rollup Candlesticks

```typescript
import { AppDataSource } from './data-source';
import { StockPrice1H } from './models/StockPrice1H';

async function get1HourCandlesticks() {
  const repository = AppDataSource.getRepository(StockPrice1H);

  const candlesticks = await repository
    .createQueryBuilder()
    .where('bucket >= :start', { start: new Date('2025-01-01') })
    .andWhere('bucket < :end', { end: new Date('2025-02-01') })
    .andWhere('symbol = :symbol', { symbol: 'AAPL' })
    .orderBy('bucket', 'ASC')
    .getMany();

  console.log(JSON.stringify(candlesticks, null, 2));
  // Example output:
  // [
  //   {
  //     "bucket": "2025-01-01T00:00:00.000Z",
  //     "symbol": "AAPL",
  //     "candlestick": {
  //       "open": 150.25,
  //       "high": 155.60,
  //       "low": 149.50,
  //       "close": 153.20,
  //       "volume": 8750000,
  //       "open_time": "2025-01-01T00:00:15.000Z",
  //       "close_time": "2025-01-01T00:59:45.000Z"
  //     }
  //   },
  //   ...
  // ]
}
```

### Using Repository Method for Candlesticks

You can also use the repository's `getCandlesticks` method directly on the base `StockPrice` entity:

```typescript
import { AppDataSource } from './data-source';
import { StockPrice } from './models/StockPrice';

async function getCandlesticksDirectly() {
  const repository = AppDataSource.getRepository(StockPrice);

  const candlesticks = await repository.getCandlesticks({
    timeRange: {
      start: new Date('2025-01-01'),
      end: new Date('2025-01-02'),
    },
    config: {
      price_column: 'price',
      volume_column: 'volume',
      bucket_interval: '1 hour',
    },
    where: {
      symbol: 'AAPL',
    },
  });

  console.log(JSON.stringify(candlesticks, null, 2));
  // Example output:
  // [
  //   {
  //     "bucket_time": "2025-01-01T00:00:00.000Z",
  //     "open": 150.25,
  //     "high": 155.60,
  //     "low": 149.50,
  //     "close": 153.20,
  //     "volume": 8750000,
  //     "vwap": 152.75,
  //     "open_time": "2025-01-01T00:00:15.000Z",
  //     "close_time": "2025-01-01T00:59:45.000Z"
  //   },
  //   ...
  // ]
}
```

## Example Use Cases

- Stock price analysis
- Cryptocurrency trading
- IoT sensor data aggregation
- Performance metrics tracking
