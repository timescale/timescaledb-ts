import { Entity, ManyToOne, PrimaryColumn } from 'typeorm';
import { Hypertable, TimeColumn } from '@timescaledb/typeorm';
import { Page } from './Page';

@Entity('page_loads')
@Hypertable({
  compression: {
    compress: true,
    compress_orderby: 'time',
    compress_segmentby: 'user_agent',
    policy: {
      schedule_interval: '7 days',
    },
  },
})
export class PageLoad {
  @PrimaryColumn({ name: 'user_agent', type: 'varchar' })
  userAgent!: string;

  @TimeColumn()
  time!: Date;

  @ManyToOne(() => Page, (page) => page, { nullable: true })
  page?: Page;
}
