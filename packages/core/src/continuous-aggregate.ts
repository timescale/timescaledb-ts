import {
  AggregateColumnOptions,
  AggregateType,
  CreateContinuousAggregateOptions,
  CreateContinuousAggregateOptionsSchema,
} from '@timescaledb/schemas';
import { escapeIdentifier, escapeLiteral } from '@timescaledb/utils';

class ContinuousAggregateInspectBuilder {
  constructor(private name: string) {}

  public build(): string {
    const literalName = escapeLiteral(this.name);

    return `SELECT EXISTS (
      SELECT FROM timescaledb_information.continuous_aggregates
      WHERE view_name = ${literalName}
    ) as hypertable_exists;`;
  }
}

class ContinuousAggregateUpBuilder {
  constructor(
    private name: string,
    private source: string,
    private options: CreateContinuousAggregateOptions,
  ) {}

  private generateAggregate(config: AggregateColumnOptions): string {
    const alias = escapeIdentifier(config.column_alias!);

    switch (config.type) {
      case 'count':
        return `COUNT(*) as ${alias}`;
      case 'count_distinct': {
        if (!config.column) {
          throw new Error('Column is required for count_distinct aggregate');
        }
        const column = escapeIdentifier(config.column);
        return `COUNT(DISTINCT ${column}) as ${alias}`;
      }
      case 'sum': {
        if (!config.column) {
          throw new Error('Column is required for sum aggregate');
        }
        const sumColumn = escapeIdentifier(config.column);
        return `SUM(${sumColumn}) as ${alias}`;
      }
      case 'avg': {
        if (!config.column) {
          throw new Error('Column is required for avg aggregate');
        }
        const avgColumn = escapeIdentifier(config.column);
        return `AVG(${avgColumn}) as ${alias}`;
      }
      case 'min': {
        if (!config.column) {
          throw new Error('Column is required for min aggregate');
        }
        const minColumn = escapeIdentifier(config.column);
        return `MIN(${minColumn}) as ${alias}`;
      }
      case 'max': {
        if (!config.column) {
          throw new Error('Column is required for max aggregate');
        }
        const maxColumn = escapeIdentifier(config.column);
        return `MAX(${maxColumn}) as ${alias}`;
      }
      case 'bucket': {
        if (!config.column) {
          throw new Error('Column is required for bucket aggregate');
        }
        const interval = escapeLiteral(this.options.bucket_interval);
        const bucketColumn = escapeIdentifier(config.column);

        return `time_bucket(${interval}, ${bucketColumn}) as ${alias}`;
      }
      case 'candlestick': {
        if (!config.time_column || !config.price_column) {
          throw new Error('time_column and price_column are required for candlestick aggregate');
        }
        const args = [config.time_column, config.price_column];
        if (config.volume_column) {
          args.push(config.volume_column);
        }

        return `candlestick_agg(${args.map(escapeIdentifier).join(', ')}) as ${alias}`;
      }
      default:
        throw new Error(`Unsupported aggregate type: ${config.type}`);
    }
  }

  private generateSelect(): string {
    const sourceName = escapeIdentifier(this.source);

    const hasGroupByColumns = [] as string[];
    const aggregates = [] as string[];

    const bucketAggregate = Object.entries(this.options.aggregates || []).find(
      ([, config]) => config.type === AggregateType.Bucket,
    );

    const bucketColumnAlias = escapeIdentifier(bucketAggregate?.[1].column_alias || 'bucket');
    const generatedBucketStr = bucketAggregate
      ? this.generateAggregate(bucketAggregate[1])
      : this.generateAggregate({
          type: AggregateType.Bucket,
          column: this.options.time_column,
          column_alias: 'bucket',
        });

    aggregates.push(generatedBucketStr);
    hasGroupByColumns.push(bucketColumnAlias);

    const primaryColumns = this.options.group_columns || [];
    primaryColumns.forEach((column) => {
      const columnName = escapeIdentifier(column);
      aggregates.push(`${columnName} as ${columnName}`);
      hasGroupByColumns.push(columnName);
    });

    Object.entries(this.options.aggregates || []).forEach(([, config]) => {
      if (config.type === AggregateType.Bucket) return;
      aggregates.push(this.generateAggregate(config));
    });

    return `
      SELECT
        ${aggregates.join(',\n      ')}
      FROM ${sourceName}
      GROUP BY ${hasGroupByColumns.join(', ')}
    `;
  }

  public getRefreshPolicy(): string | null {
    if (!this.options.refresh_policy) return null;

    const policy = this.options.refresh_policy;
    const viewName = escapeLiteral(this.name);
    return `SELECT add_continuous_aggregate_policy(${viewName},
      start_offset => INTERVAL ${escapeLiteral(policy.start_offset)},
      end_offset => INTERVAL ${escapeLiteral(policy.end_offset)},
      schedule_interval => INTERVAL ${escapeLiteral(policy.schedule_interval)}
    );`;
  }

  public build(): string {
    const viewName = escapeIdentifier(this.name);
    return `CREATE MATERIALIZED VIEW ${viewName} WITH (timescaledb.continuous) AS ${this.generateSelect()} WITH NO DATA;`;
  }
}

class ContinuousAggregateDownBuilder {
  constructor(
    private name: string,
    private options: CreateContinuousAggregateOptions,
  ) {}

  public build(): string[] {
    const statements: string[] = [];
    const viewName = this.name;

    if (this.options.refresh_policy) {
      statements.push(`SELECT remove_continuous_aggregate_policy(${escapeLiteral(viewName)}, if_exists => true);`);
    }

    statements.push(`DROP MATERIALIZED VIEW IF EXISTS ${escapeIdentifier(viewName)};`);

    return statements;
  }
}

export class ContinuousAggregate {
  private name: string;
  private source: string;
  private options: CreateContinuousAggregateOptions;

  constructor(name: string, source: string, options: CreateContinuousAggregateOptions) {
    this.name = name;
    this.source = source;
    this.options = CreateContinuousAggregateOptionsSchema.parse(options);
  }

  public up(): ContinuousAggregateUpBuilder {
    return new ContinuousAggregateUpBuilder(this.name, this.source, this.options);
  }

  public down(): ContinuousAggregateDownBuilder {
    return new ContinuousAggregateDownBuilder(this.name, this.options);
  }

  public inspect(): ContinuousAggregateInspectBuilder {
    return new ContinuousAggregateInspectBuilder(this.name);
  }
}
