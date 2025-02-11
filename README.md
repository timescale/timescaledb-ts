# timescaledb-ts

[![npm version](https://badge.fury.io/js/@timescaledb%2Ftypeorm.svg)](https://badge.fury.io/js/@timescaledb%2Ftypeorm) [![Tests](https://github.com/timescale/timescaledb-ts/actions/workflows/test.yml/badge.svg?branch=main)](https://github.com/timescale/timescaledb-ts/actions/workflows/test.yml) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Welcome to the [Timescale](https://www.timescale.com/) Typescript library. This library is a collection of packages that help you work with TimescaleDB in a Typescript environment.

If you are looking to setup this project locally, you can follow the instructions in the [CONTRIBUTING.md](./docs/CONTRIBUTING.md) file.

## Packages

- [@timescaledb/typeorm](./packages/typeorm/README.md) - Official TimescaleDB integration for TypeORM.
- [@timescaledb/core](./packages/core/README.md) - Migration and query helpers
- [@timescaledb/schemas](./packages/schemas/README.md) - TimescaleDB object schemas
- [@timescaledb/utils](./packages/utils/README.md) - utilities and helpers

## Examples

- [Node Sequelize Example](./examples/node-sequelize/README.md) - Using TimescaleDB with Node.js and [Sequelize](https://sequelize.org/)
- [Node TypeORM Example](./examples/node-typeorm/README.md) - Using TimescaleDB with Node.js and [TypeORM](https://typeorm.io/)

## Guides

- [Getting Started](./docs/guides/getting-started.md) - A guide to getting started with TimescaleDB and this library.
- [Working with Energy Data](./docs/guides/energy-data.md) - A guide to working with energy data in TimescaleDB.

## Feature Compatibility

| Feature                                                                                                                                         | Core | TypeORM | Sequelize            |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ------- | -------------------- |
| **Core Functions**                                                                                                                              |      |         |                      |
| [Create Hypertable](https://docs.timescale.com/api/latest/hypertable/create_hypertable/)                                                        | ✅   | ✅ Auto | ✅ Manual (via Core) |
| [Add Compression](https://docs.timescale.com/api/latest/compression/alter_table_compression/)                                                   | ✅   | ✅ Auto | ✅ Manual (via Core) |
| [Add Compression Policy](https://docs.timescale.com/api/latest/compression/add_compression_policy/)                                             | ✅   | ✅ Auto | ✅ Manual (via Core) |
| [Add Retention Policy](https://docs.timescale.com/use-timescale/latest/data-retention/create-a-retention-policy/)                               | ❌   | ❌      | ❌                   |
| [Continuous Aggregates](https://docs.timescale.com/api/latest/continuous-aggregates/create_materialized_view/)                                  | ✅   | ✅ Auto | ✅ Manual (via Core) |
| **Hyperfunctions**                                                                                                                              |      |         |                      |
| [Time Bucket](https://docs.timescale.com/api/latest/hyperfunctions/time_bucket/)                                                                | ✅   | ✅      | ✅ Manual (via Core) |
| [Candlestick Aggregates](https://docs.timescale.com/api/latest/hyperfunctions/financial-analysis/candlestick_agg/)                              | ✅   | ✅      | ✅ Manual (via Core) |
| [Stats Aggregates](https://docs.timescale.com/api/latest/hyperfunctions/statistical-and-regression-analysis/stats_agg-one-variable/)            | ❌   | ❌      | ❌                   |
| [Percentile Approximation](https://docs.timescale.com/api/latest/hyperfunctions/percentile-approximation/uddsketch/)                            | ❌   | ❌      | ❌                   |
| **Info Views**                                                                                                                                  |      |         |                      |
| [Chunks](https://docs.timescale.com/api/latest/hypertable/show_chunks/)                                                                         | ❌   | ❌      | ❌                   |
| [User Defined Actions](https://docs.timescale.com/api/latest/actions/)                                                                          | ❌   | ❌      | ❌                   |
| [Compression Settings](https://docs.timescale.com/api/latest/compression/)                                                                      | ✅   | ✅      | ✅ Manual (via Core) |
| [Continuous Aggregates](https://docs.timescale.com/api/latest/continuous-aggregates/create_materialized_view/)                                  | ✅   | ✅      | ✅ Manual (via Core) |
| [Hierarchical continuous aggregates](https://docs.timescale.com/use-timescale/latest/continuous-aggregates/hierarchical-continuous-aggregates/) | ✅   | ✅      | ✅ Manual (via Core) |

Legend:

- ✅ Supported
- ❌ Not Supported at this time
- Auto = Automatic integration with ORM
- Manual = Manual integration using Core package

## Getting Started

- TypeORM: [README](./packages/typeorm/README.md)

To get started with TypeORM simply install the package:

```bash
npm install typeorm @timescaledb/typeorm
```

Then you can use the `@Hypertable` decorator to define your hypertables:

```diff
import { Entity, PrimaryColumn } from 'typeorm';
+ import { Hypertable, TimeColumn } from '@timescaledb/typeorm';

+ @Hypertable({ ... })
@Entity('page_loads')
export class PageLoad {
  @PrimaryColumn({ type: 'varchar' })
  user_agent!: string;

+  @TimeColumn
  time!: Date;
}
```

Then you can query a Hypertable using the attached methods:

```typescript
import { AppDataSource } from './data-source';
import { PageLoad } from './models/PageLoad';

const repository = AppDataSource.getRepository(PageLoad);
const stats = await repository.getTimeBucket({
  timeRange: {
    start: new Date('2025-01-01'),
    end: new Date('2025-01-02'),
  },
  where: {
    user_agent: 'Chrome',
  },
  bucket: {
    interval: '1 hour',
    metrics: [{ type: 'distinct_count', column: 'user_agent', alias: 'unique_users' }],
  },
});

console.log(stats);
// [
//   { time: '2021-01-01T00:00:00.000Z', unique_users: 5 },
//   { time: '2021-01-01T01:00:00.000Z', unique_users: 10 },
//   { time: '2021-01-01T02:00:00.000Z', unique_users: 15 },
//   ...
// ]
```

## License

The library is available as open source under the terms of the MIT License.

## Code of Conduct

Everyone interacting in the Timescale project's codebases, issue trackers, chat rooms and mailing lists is expected to follow the [code of conduct](./docs/CODE_OF_CONDUCT.md).
