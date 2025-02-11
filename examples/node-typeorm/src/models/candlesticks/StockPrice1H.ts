import { PrimaryColumn } from 'typeorm';
import { BucketColumn, CandlestickColumn, Rollup } from '@timescaledb/typeorm';
import { StockPrice1M } from './StockPrice1M';
import { Candlestick } from '@timescaledb/schemas';

@Rollup(StockPrice1M, {
  name: 'stock_candlesticks_1h',
  bucket_interval: '1 hour',
  refresh_policy: {
    start_offset: '7 days',
    end_offset: '1 hour',
    schedule_interval: '1 hour',
  },
})
export class StockPrice1H {
  @BucketColumn({
    source_column: 'bucket',
  })
  bucket!: Date;

  @PrimaryColumn()
  symbol!: string;

  @CandlestickColumn({
    source_column: 'candlestick',
  })
  candlestick!: Candlestick;
}
