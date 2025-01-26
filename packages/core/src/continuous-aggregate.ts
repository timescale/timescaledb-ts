import { CreateContinuousAggregateOptions, CreateContinuousAggregateOptionsSchema } from '@timescaledb/schemas';
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

  private generateAggregate(config: { type: string; column?: string; column_alias: string }): string {
    const alias = escapeIdentifier(config.column_alias);

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
      default:
        throw new Error(`Unsupported aggregate type: ${config.type}`);
    }
  }

  private generateSelect(): string {
    const timeColumn = escapeIdentifier(this.options.time_column);
    const interval = escapeLiteral(this.options.bucket_interval);
    const sourceName = escapeIdentifier(this.source);

    const aggregates = Object.entries(this.options.aggregates).map(([, config]) => {
      return this.generateAggregate(config);
    });

    return `
      SELECT
        time_bucket(${interval}, ${timeColumn}) as bucket,
        ${aggregates.join(',\n        ')}
      FROM ${sourceName}
      GROUP BY bucket
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
