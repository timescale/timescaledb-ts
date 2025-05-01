import { PrimaryColumn } from 'typeorm';

export const TIME_COLUMN_METADATA_KEY = Symbol('timescale:time-column');

export interface TimeColumnMetadata {
  propertyKey: string | symbol;
  columnName: string;
}

export function TimeColumn(options?: { name?: string }) {
  return function (target: any, propertyKey: string | symbol) {
    const metadata: TimeColumnMetadata = {
      propertyKey,
      columnName: propertyKey.toString(),
    };

    Reflect.defineMetadata(TIME_COLUMN_METADATA_KEY, metadata, target.constructor);

    PrimaryColumn({ type: 'timestamp with time zone', name: options?.name })(target, propertyKey);
  };
}

export function validateTimeColumn(target: Function): TimeColumnMetadata {
  const metadata = Reflect.getMetadata(TIME_COLUMN_METADATA_KEY, target);

  if (!metadata) {
    throw new Error('Hypertables must have exactly one column decorated with @TimeColumn');
  }

  return metadata;
}
