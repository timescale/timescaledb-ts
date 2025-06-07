import { describe, it } from '@jest/globals';
import { TimescaleDB, HypertableErrors } from '../src';
import { CreateHypertableOptions } from '@timescaledb/schemas';

describe('Hypertable', () => {
  it('should fail when creating a hypertable without a name', () => {
    expect(() => {
      // @ts-ignore
      TimescaleDB.createHypertable('');
    }).toThrow(HypertableErrors.NAME_REQUIRED);
  });

  it('should fail when creating a hypertable without options', () => {
    expect(() => {
      // @ts-ignore
      TimescaleDB.createHypertable('my_table');
    }).toThrow(HypertableErrors.OPTIONS_REQUIRED);
  });

  it('should fail when creating a hypertable with invalid options', () => {
    expect(() => {
      // @ts-ignore
      TimescaleDB.createHypertable('my_table', {});
    }).toThrow(HypertableErrors.INVALID_OPTIONS);
  });

  describe('should validate table names correctly', () => {
    // Invalid names
    const invalidNames = [
      '2invalid',
      'invalid-name',
      'invalid.name.table',
      'invalid$name',
      'some-2rand}}(*&^name',
      '_invalidstart',
    ];

    const validNames = ['valid_table_name', 'schema1.table1'];

    it.each(invalidNames)('should fail when creating a hypertable with invalid name: %s', (name) => {
      expect(() =>
        TimescaleDB.createHypertable(name, {
          by_range: { column_name: 'time' },
        }),
      ).toThrow(HypertableErrors.INVALID_NAME);
    });

    it.each(validNames)('should create a hypertable with valid name: %s', (name) => {
      expect(() =>
        TimescaleDB.createHypertable(name, {
          by_range: { column_name: 'time' },
        }),
      ).not.toThrow();
    });
  });

  describe('up', () => {
    it('should create and build a hypertable', () => {
      const options: CreateHypertableOptions = {
        by_range: {
          column_name: 'time',
        },
      };

      const sql = TimescaleDB.createHypertable('my_table', options).up().build();
      expect(sql).toMatchSnapshot();
    });

    it('should create and build a hypertable with compression', () => {
      const options: CreateHypertableOptions = {
        by_range: {
          column_name: 'time',
        },
        compression: {
          compress: true,
          compress_orderby: 'time',
          compress_segmentby: 'user_agent',
        },
      };

      const sql = TimescaleDB.createHypertable('my_table', options).up().build();
      expect(sql).toMatchSnapshot();
    });

    it('should create and build a hypertable with compression policy', () => {
      const options: CreateHypertableOptions = {
        by_range: {
          column_name: 'time',
        },
        compression: {
          compress: true,
          compress_orderby: 'time',
          compress_segmentby: 'user_agent',
          policy: {
            schedule_interval: '1d',
          },
        },
      };

      const sql = TimescaleDB.createHypertable('my_table', options).up().build();
      expect(sql).toMatchSnapshot();
    });

    it('should create and build a hypertable with a set chunk time interval', () => {
      const options: CreateHypertableOptions = {
        by_range: {
          column_name: 'time',
        },
        compression: {
          compress: true,
          compress_orderby: 'time',
          compress_segmentby: 'user_agent',
          chunk_time_interval: '1d'
          policy: {
            schedule_interval: '1d',
          },
        },
      };

      const sql = TimescaleDB.createHypertable('my_table', options).up().build();
      expect(sql).toMatchSnapshot();
    });
  });

  describe('inspect', () => {
    it('should inspect a hypertable', () => {
      const sql = TimescaleDB.createHypertable('my_table', {
        by_range: {
          column_name: 'time',
        },
      })
        .inspect()
        .build();

      expect(sql).toMatchSnapshot();
    });
  });

  describe('down', () => {
    it('should drop a hypertable', () => {
      const options: CreateHypertableOptions = {
        by_range: {
          column_name: 'time',
        },
      };

      const sql = TimescaleDB.createHypertable('my_table', options).down().build();
      expect(sql).toMatchSnapshot();
    });

    it('should drop a hypertable with compression', () => {
      const options: CreateHypertableOptions = {
        by_range: {
          column_name: 'time',
        },
        compression: {
          compress: true,
          compress_orderby: 'time',
          compress_segmentby: 'user_agent',
        },
      };

      const sql = TimescaleDB.createHypertable('my_table', options).down().build();
      expect(sql).toMatchSnapshot();
    });

    it('should drop a hypertable with compression policy', () => {
      const options: CreateHypertableOptions = {
        by_range: {
          column_name: 'time',
        },
        compression: {
          compress: true,
          compress_orderby: 'time',
          compress_segmentby: 'user_agent',
          policy: {
            schedule_interval: '1d',
          },
        },
      };

      const sql = TimescaleDB.createHypertable('my_table', options).down().build();
      expect(sql).toMatchSnapshot();
    });

    it('should drop a hypertable with a set chunk time interval', () => {
      const options: CreateHypertableOptions = {
        by_range: {
          column_name: 'time',
        },
        compression: {
          compress: true,
          compress_orderby: 'time',
          compress_segmentby: 'user_agent',
          chunk_time_interval: '1d',
          policy: {
            schedule_interval: '1d',
          },
        },
      };

      const sql = TimescaleDB.createHypertable('my_table', options).down().build();
      expect(sql).toMatchSnapshot();
    });
  });

  describe('SQL Escaping', () => {
    it('should properly escape column names with special characters', () => {
      const options: CreateHypertableOptions = {
        by_range: {
          column_name: 'time-stamp"field',
        },
      };

      const sql = TimescaleDB.createHypertable('my_table', options).up().build();
      expect(sql).toMatchSnapshot();
    });

    it('should properly escape compression fields with special characters', () => {
      const options: CreateHypertableOptions = {
        by_range: {
          column_name: 'time',
        },
        compression: {
          compress: true,
          compress_orderby: 'timestamp"field',
          compress_segmentby: 'user-agent"field',
        },
      };

      const sql = TimescaleDB.createHypertable('my_table', options).up().build();
      expect(sql).toMatchSnapshot();
    });

    it('should properly escape interval values with special characters', () => {
      const options: CreateHypertableOptions = {
        by_range: {
          column_name: 'time',
        },
        compression: {
          compress: true,
          compress_orderby: 'time',
          compress_segmentby: 'user_agent',
          policy: {
            schedule_interval: "7 days'--injection",
          },
        },
      };

      const sql = TimescaleDB.createHypertable('my_table', options).up().build();
      expect(sql).toMatchSnapshot();
    });
  });
});
