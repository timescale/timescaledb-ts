/// <reference types="reflect-metadata" />
import { CreateHypertableOptions } from '@timescaledb/schemas';
import { timescaleMethods } from '../repository/TimescaleRepository';
import { validateTimeColumn } from './TimeColumn';

export const HYPERTABLE_METADATA_KEY = Symbol('timescale:hypertable');

export function Hypertable(options: Omit<CreateHypertableOptions, 'by_range'>) {
  return function (target: Function) {
    const timeColumnMetadata = validateTimeColumn(target);

    const updatedOptions: CreateHypertableOptions = {
      ...options,
      by_range: {
        column_name: timeColumnMetadata.columnName,
      },
    };

    Reflect.defineMetadata(HYPERTABLE_METADATA_KEY, updatedOptions, target);
    Reflect.defineMetadata('typeorm:repository:extend', timescaleMethods, target);
  };
}
