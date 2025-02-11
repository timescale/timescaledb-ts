import { describe, it, expect } from '@jest/globals';
import { parseCandlestick } from '../src/utils/parse-candlestick';

describe('parseCandlestick', () => {
  it('should correctly parse a candlestick string with all fields', () => {
    const input =
      '(version:1,open:(ts:"2025-01-01 00:00:10+00",val:102000),high:(ts:"2025-01-01 00:00:20+00",val:104000),low:(ts:"2025-01-01 00:00:30+00",val:101500),close:(ts:"2025-01-01 00:00:40+00",val:103500),volume:Transaction(vol:6.3,vwap:64800))';

    const result = parseCandlestick(input);

    expect(result).toEqual({
      open: 102000,
      high: 104000,
      low: 101500,
      close: 103500,
      open_time: new Date('2025-01-01T00:00:10Z'),
      high_time: new Date('2025-01-01T00:00:20Z'),
      low_time: new Date('2025-01-01T00:00:30Z'),
      close_time: new Date('2025-01-01T00:00:40Z'),
      volume: 6.3,
      vwap: 64800,
    });

    // Verify types
    expect(typeof result.open).toBe('number');
    expect(typeof result.high).toBe('number');
    expect(typeof result.low).toBe('number');
    expect(typeof result.close).toBe('number');
    expect(result.open_time instanceof Date).toBe(true);
    expect(typeof result.volume).toBe('number');
    expect(typeof result.vwap).toBe('number');
  });

  it('should handle candlestick string without volume info', () => {
    const input =
      '(version:1,open:(ts:"2025-01-01 00:00:10+00",val:102000),high:(ts:"2025-01-01 00:00:20+00",val:104000),low:(ts:"2025-01-01 00:00:30+00",val:101500),close:(ts:"2025-01-01 00:00:40+00",val:103500))';

    const result = parseCandlestick(input);

    expect(result).toEqual({
      open: 102000,
      high: 104000,
      low: 101500,
      close: 103500,
      open_time: new Date('2025-01-01T00:00:10Z'),
      high_time: new Date('2025-01-01T00:00:20Z'),
      low_time: new Date('2025-01-01T00:00:30Z'),
      close_time: new Date('2025-01-01T00:00:40Z'),
      volume: undefined,
      vwap: undefined,
    });
  });

  it('should handle decimal values', () => {
    const input =
      '(version:1,open:(ts:"2025-01-01 00:00:10+00",val:102000.50),high:(ts:"2025-01-01 00:00:20+00",val:104000.75),low:(ts:"2025-01-01 00:00:30+00",val:101500.25),close:(ts:"2025-01-01 00:00:40+00",val:103500.80),volume:Transaction(vol:6.3,vwap:64800.45))';

    const result = parseCandlestick(input);

    expect(result.open).toBeCloseTo(102000.5, 2);
    expect(result.high).toBeCloseTo(104000.75, 2);
    expect(result.low).toBeCloseTo(101500.25, 2);
    expect(result.close).toBeCloseTo(103500.8, 2);
    expect(result.volume).toBeCloseTo(6.3, 1);
    expect(result.vwap).toBeCloseTo(64800.45, 2);
  });

  it('should handle different timezone offsets', () => {
    const input = '(version:1,open:(ts:"2025-01-01 00:00:10-05:00",val:102000))';

    const result = parseCandlestick(input);

    // EST time should be converted to UTC
    expect(result.open_time).toEqual(new Date('2025-01-01T05:00:10Z'));
  });

  it('should handle malformed input gracefully', () => {
    const input = 'invalid candlestick format';

    expect(() => parseCandlestick(input)).toThrow();
  });
});
