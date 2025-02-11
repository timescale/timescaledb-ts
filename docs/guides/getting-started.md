# Getting Started with TimescaleDB and TypeORM

This guide will walk you through setting up a TypeScript project with TimescaleDB and TypeORM to track and analyze cryptocurrency prices.

## Prerequisites

- Node.js >= 22.13.0
- Docker (for running TimescaleDB)
- pnpm (or npm/yarn)

## Setup TimescaleDB

First, let's start a TimescaleDB instance using Docker:

```bash
docker run -d \
  --name timescaledb \
  -p 5432:5432 \
  -e POSTGRES_PASSWORD=password \
  timescale/timescaledb-ha:pg15
```

## Project Setup

Create a new directory and initialize a TypeScript project:

```bash
mkdir crypto-tracker
cd crypto-tracker
pnpm init
pnpm add -D typescript @types/node ts-node
pnpm add typeorm @timescaledb/typeorm reflect-metadata pg dotenv
```

Create a `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["es2020"],
    "strict": true,
    "esModuleInterop": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "skipLibCheck": true,
    "outDir": "./dist"
  }
}
```

Create a `.env` file:

```env
DATABASE_URL=postgres://postgres:password@localhost:5432/crypto
```

## Create the Database

Connect to the PostgreSQL instance and create the database:

```bash
psql postgres://postgres:password@localhost:5432/postgres
```

Then create the database:

```sql
CREATE DATABASE crypto;
```

## Setup TypeORM

Create a `src/data-source.ts` file:

```typescript
import 'reflect-metadata';
import '@timescaledb/typeorm';
import { DataSource } from 'typeorm';
import { CryptoPrice } from './models/CryptoPrice';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  synchronize: false,
  logging: true,
  entities: [CryptoPrice],
  migrations: ['migrations/*.ts'],
});
```

## Create the Entity

Create `src/models/CryptoPrice.ts`:

```typescript
import { Entity, PrimaryColumn, Column } from 'typeorm';
import { Hypertable, TimeColumn } from '@timescaledb/typeorm';

@Entity('crypto_prices')
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
export class CryptoPrice {
  @PrimaryColumn({ type: 'varchar' })
  symbol!: string;

  @TimeColumn()
  timestamp!: Date;

  @Column({ type: 'decimal', precision: 18, scale: 8 })
  price!: number;

  @Column({ type: 'decimal', precision: 18, scale: 8 })
  volume!: number;
}
```

## Create a Migration

Initialize TypeORM CLI:

```bash
pnpm add -D typeorm
```

Add this to your `package.json`:

```json
{
  "scripts": {
    "typeorm": "typeorm-ts-node-commonjs",
    "migration:generate": "npm run typeorm migration:generate",
    "migration:run": "npm run typeorm migration:run -- -d src/data-source.ts"
  }
}
```

Generate the migration:

```bash
pnpm migration:generate migrations/CreateCryptoPrice -d src/data-source.ts
```

This will create a migration file in `migrations/`. The TimescaleDB-specific parts like creating the hypertable will be handled automatically by the TypeORM integration.

Run the migration:

```bash
pnpm migration:run
```

## Query Candlestick Data

Now you can query candlestick data for crypto prices. Create a file called `src/analyze.ts`:

```typescript
import { AppDataSource } from './data-source';
import { CryptoPrice } from './models/CryptoPrice';
import { Between } from 'typeorm';

async function analyzeBTC() {
  await AppDataSource.initialize();

  const repository = AppDataSource.getRepository(CryptoPrice);

  // First, let's insert some sample data
  await repository.save([
    { symbol: 'BTC', timestamp: new Date('2025-01-01T00:00:00Z'), price: 42000.0, volume: 1.5 },
    { symbol: 'BTC', timestamp: new Date('2025-01-01T00:15:00Z'), price: 42100.0, volume: 2.0 },
    { symbol: 'BTC', timestamp: new Date('2025-01-01T00:30:00Z'), price: 41900.0, volume: 1.8 },
    { symbol: 'BTC', timestamp: new Date('2025-01-01T00:45:00Z'), price: 42200.0, volume: 2.2 },
  ]);

  // Query hourly candlesticks
  const candlesticks = await repository.getCandlesticks({
    timeRange: {
      start: new Date('2025-01-01T00:00:00Z'),
      end: new Date('2025-01-02T00:00:00Z'),
    },
    config: {
      price_column: 'price',
      volume_column: 'volume',
      bucket_interval: '1 hour',
    },
    where: {
      symbol: 'BTC',
    },
  });

  console.log(JSON.stringify(candlesticks, null, 2));

  await AppDataSource.destroy();
}

analyzeBTC().catch(console.error);
```

Run it:

```bash
ts-node src/analyze.ts
```

You should see output like:

```json
[
  {
    "bucket_time": "2025-01-01T00:00:00.000Z",
    "open": 42000,
    "high": 42200,
    "low": 41900,
    "close": 42200,
    "volume": 7.5,
    "vwap": 42050,
    "open_time": "2025-01-01T00:00:00.000Z",
    "high_time": "2025-01-01T00:45:00.000Z",
    "low_time": "2025-01-01T00:30:00.000Z",
    "close_time": "2025-01-01T00:45:00.000Z"
  }
]
```

## What's Next?

- Add more pairs (ETH, SOL, etc.)
- Create a continuous aggregate for daily/weekly OHLCV
- Add compression policies for older data
- Build an API to serve the data
- Add technical indicators using window functions

For more details, check out:

- [TimescaleDB TypeORM Documentation](https://github.com/timescale/timescaledb-ts/tree/main/packages/typeorm)
- [Example Project](https://github.com/timescale/timescaledb-ts/tree/main/examples/node-typeorm)
