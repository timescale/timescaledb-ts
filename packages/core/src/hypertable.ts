import { CreateHypertableOptions, CreateHypertableOptionsSchema, TimeBucketConfig } from '@timescaledb/schemas';
import { HypertableErrors } from './errors';
import { escapeIdentifier, escapeLiteral, validateIdentifier } from '@timescaledb/utils';
import { CompressionBuilder } from './compression';
import { TimeBucketBuilder } from './time-bucket';
import { debugCore } from './debug';

const debug = debugCore('Hypertable');

class HypertableUpBuilder {
  private options: CreateHypertableOptions;
  private name: string;
  private statements: string[] = [];

  constructor(name: string, options: CreateHypertableOptions) {
    this.name = name;
    this.options = options;
  }

  public build(): string {
    debug(`Building up query for hypertable '${this.name}'`);
    const tableName = escapeIdentifier(this.name);

    this.statements.push(
      `SELECT create_hypertable(${escapeLiteral(this.name)}, by_range(${escapeLiteral(this.options.by_range.column_name)}));`,
    );

    if (this.options.compression?.compress) {
      const orderBy = escapeIdentifier(this.options.compression.compress_orderby);
      const segmentBy = escapeIdentifier(this.options.compression.compress_segmentby);

      const alter = `ALTER TABLE ${tableName} SET (
        timescaledb.compress,
        timescaledb.compress_orderby = ${orderBy},
        timescaledb.compress_segmentby = ${segmentBy}
      );`;
      this.statements.push(alter);

      if (this.options.compression.policy) {
        const interval = escapeLiteral(this.options.compression.policy.schedule_interval);
        const policy = `SELECT add_compression_policy(${escapeLiteral(this.name)}, INTERVAL ${interval});`;
        this.statements.push(policy);
      }

      if (this.options.compression.chunk_time_interval) {
        const interval = escapeLiteral(this.options.compression.chunk_time_interval);
        const timeInterval = `SELECT set_chunk_time_interval(${escapeLiteral(this.name)}, INTERVAL ${interval});`;
        this.statements,push(timeInterval);
      }
    }

    const result = this.statements.join('\n');
    debug(`Up query built for '${this.name}':\n${result}`);
    return result;
  }
}

class HypertableDownBuilder {
  private name: string;
  private options: CreateHypertableOptions;
  private statements: string[] = [];

  constructor(name: string, options: CreateHypertableOptions) {
    this.name = name;
    this.options = options;
  }

  public build(): string {
    debug(`Building down query for hypertable '${this.name}'`);
    const tableName = escapeIdentifier(this.name);
    const literalName = escapeLiteral(this.name);

    if (this.options.compression?.compress) {
      this.statements.push(`ALTER TABLE ${tableName} SET (timescaledb.compress = false);`);
    }

    if (this.options.compression?.policy) {
      this.statements.push(`SELECT remove_compression_policy(${literalName}, if_exists => true);`);
    }

    this.statements.push(`SELECT drop_chunks(${literalName}, NOW()::timestamp without time zone);`);

    const result = this.statements.join('\n');
    debug(`Down query built for '${this.name}':\n${result}`);
    return result;
  }
}

export class HypertableInspectBuilder {
  private name: string;
  private statements: string[] = [];

  constructor(name: string) {
    this.name = name;
  }

  public build(): string {
    debug(`Building inspect query for hypertable '${this.name}'`);
    const literalName = escapeLiteral(this.name);

    this.statements.push('SELECT');

    this.statements.push(`  EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = ${literalName}
  ) AS table_exists,`);

    this.statements.push(`  EXISTS (
    SELECT FROM timescaledb_information.hypertables
    WHERE hypertable_name = ${literalName}
  ) AS is_hypertable`);

    const result = this.statements.join('\n');
    debug(`Inspect query built for '${this.name}':\n${result}`);
    return result;
  }
}

export class Hypertable {
  private options: CreateHypertableOptions;
  private name: string;

  constructor(name: string, options: CreateHypertableOptions) {
    if (!name) {
      throw new Error(HypertableErrors.NAME_REQUIRED);
    }

    try {
      validateIdentifier(name, true);
      this.name = name;
    } catch (error) {
      throw new Error(HypertableErrors.INVALID_NAME + ' ' + (error as Error).message);
    }

    if (!options) {
      throw new Error(HypertableErrors.OPTIONS_REQUIRED);
    }

    try {
      this.options = CreateHypertableOptionsSchema.parse(options);
    } catch (error) {
      const e = error as Error;
      throw new Error(HypertableErrors.INVALID_OPTIONS + ' ' + e.message);
    }
  }

  public up(): HypertableUpBuilder {
    return new HypertableUpBuilder(this.name, this.options);
  }

  public down(): HypertableDownBuilder {
    return new HypertableDownBuilder(this.name, this.options);
  }

  public inspect(): HypertableInspectBuilder {
    return new HypertableInspectBuilder(this.name);
  }

  public compression(): CompressionBuilder {
    return new CompressionBuilder(this.name, this.options);
  }

  public timeBucket(config: TimeBucketConfig): TimeBucketBuilder {
    return new TimeBucketBuilder(this.name, this.options.by_range.column_name, config);
  }
}
