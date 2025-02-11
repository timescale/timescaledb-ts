# Energy Data Analytics with TimescaleDB

This guide demonstrates how to use TimescaleDB for energy data analytics, including monitoring consumption, generation, and peak usage patterns.

## Basic Setup

First, let's set up our energy metrics model:

```typescript
import { Entity, PrimaryColumn, Column } from 'typeorm';
import { Hypertable, TimeColumn } from '@timescaledb/typeorm';

@Entity('energy_metrics')
@Hypertable({
  compression: {
    compress: true,
    compress_orderby: 'timestamp',
    compress_segmentby: 'meter_id',
    policy: {
      schedule_interval: '7 days',
    },
  },
})
export class EnergyMetric {
  @PrimaryColumn({ type: 'varchar' })
  meter_id!: string;

  @TimeColumn()
  timestamp!: Date;

  @Column({ type: 'float' })
  consumption_kwh!: number;

  @Column({ type: 'float' })
  generation_kwh!: number; // For solar/wind generation

  @Column({ type: 'float' })
  voltage!: number;

  @Column({ type: 'float', nullable: true })
  temperature!: number; // Ambient temperature for correlation
}
```

## Time Bucketing

Analyze energy patterns across different time intervals:

```typescript
async function analyzeEnergyUsage() {
  const repository = AppDataSource.getRepository(EnergyMetric);

  const hourlyUsage = await repository.getTimeBucket({
    timeRange: {
      start: new Date('2025-01-01'),
      end: new Date('2025-01-02'),
    },
    bucket: {
      interval: '1 hour',
      metrics: [
        { type: 'sum', column: 'consumption_kwh', alias: 'total_consumption' },
        { type: 'sum', column: 'generation_kwh', alias: 'total_generation' },
        { type: 'avg', column: 'voltage', alias: 'avg_voltage' },
        { type: 'max', column: 'consumption_kwh', alias: 'peak_consumption' },
      ],
    },
  });

  console.log('Hourly Energy Usage:', hourlyUsage);
  // [
  //   {
  //     interval: '2025-01-01T00:00:00Z',
  //     total_consumption: 245.6,    // kWh
  //     total_generation: 12.8,      // kWh from solar
  //     avg_voltage: 120.2,          // V
  //     peak_consumption: 12.4       // kWh
  //   },
  //   ...
  // ]
}
```

### Peak Usage Analysis

Identify peak consumption periods:

```typescript
const peakUsagePeriods = await repository.getTimeBucket({
  timeRange: {
    start: new Date('2025-01-01'),
    end: new Date('2025-01-02'),
  },
  bucket: {
    interval: '15 minutes',
    metrics: [
      { type: 'sum', column: 'consumption_kwh', alias: 'usage' },
      { type: 'avg', column: 'temperature', alias: 'avg_temp' },
    ],
  },
  where: {
    consumption_kwh: { '>': 10 }, // High usage threshold
    meter_id: 'building-a',
  },
});
```

## Continuous Aggregates

Create materialized views for energy analytics:

```typescript
import { ContinuousAggregate, AggregateColumn, BucketColumn } from '@timescaledb/typeorm';

@ContinuousAggregate(EnergyMetric, {
  name: 'daily_energy_stats',
  bucket_interval: '1 day',
  refresh_policy: {
    start_offset: '2 days',
    end_offset: '1 hour',
    schedule_interval: '1 hour',
  },
})
export class DailyEnergyStats {
  @BucketColumn({
    source_column: 'timestamp',
  })
  bucket!: Date;

  @AggregateColumn({
    type: 'sum',
    column: 'consumption_kwh',
  })
  total_consumption!: number;

  @AggregateColumn({
    type: 'sum',
    column: 'generation_kwh',
  })
  total_generation!: number;

  @AggregateColumn({
    type: 'max',
    column: 'consumption_kwh',
  })
  peak_consumption!: number;

  @AggregateColumn({
    type: 'avg',
    column: 'temperature',
  })
  avg_temperature!: number;
}
```

Query the daily statistics:

```typescript
const dailyStats = await AppDataSource.getRepository(DailyEnergyStats)
  .createQueryBuilder()
  .where('bucket >= :start', { start: new Date('2025-01-01') })
  .andWhere('bucket < :end', { end: new Date('2025-01-31') })
  .orderBy('bucket', 'DESC')
  .getMany();

console.log('Daily Energy Stats:', dailyStats);
// [
//   {
//     bucket: '2025-01-01T00:00:00Z',
//     total_consumption: 5840.5,    // kWh
//     total_generation: 324.6,      // kWh
//     peak_consumption: 12.4,       // kWh
//     avg_temperature: 22.5         // °C
//   },
//   ...
// ]
```

For more information, check out:

- [TypeORM Integration Docs](https://github.com/timescale/timescaledb-ts/tree/main/packages/typeorm)
- [Example Projects](https://github.com/timescale/timescaledb-ts/tree/main/examples)
