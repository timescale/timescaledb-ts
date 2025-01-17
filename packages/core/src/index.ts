import { CreateExtensionOptions, CreateHypertableOptions } from '@timescaledb/schemas';
import { Hypertable } from './hypertable';
import { Extension } from './extension';

export const name = '@timescaledb/core';

export class TimescaleDB {
  public static Hypertable: Hypertable;

  public static createHypertable(tableName: string, options: CreateHypertableOptions): Hypertable {
    const hypertable = new Hypertable(tableName, options);

    return hypertable;
  }

  public static createExtension(options?: CreateExtensionOptions): Extension {
    const extension = new Extension(options);

    return extension;
  }
}

export * from './errors';
