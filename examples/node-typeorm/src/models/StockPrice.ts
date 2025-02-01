import { Entity, PrimaryColumn, Column } from 'typeorm';
import { Hypertable } from '@timescaledb/typeorm';

@Entity('stock_prices')
@Hypertable({
  by_range: {
    column_name: 'timestamp',
  },
  compression: {
    compress: true,
    compress_orderby: 'timestamp',
    compress_segmentby: 'symbol',
    policy: {
      schedule_interval: '7 days',
    },
  },
})
export class StockPrice {
  @PrimaryColumn({ type: 'varchar' })
  symbol!: string;

  @PrimaryColumn({ type: 'timestamp' })
  timestamp!: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  volume!: number;
}
