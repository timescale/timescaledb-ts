import { Entity, PrimaryColumn } from 'typeorm';

@Entity('page')
export class Page {
  @PrimaryColumn({ name: 'url', type: 'varchar' })
  url!: string;

  @PrimaryColumn({ name: 'title', type: 'varchar' })
  title!: string;

  @PrimaryColumn({ name: 'content', type: 'text' })
  content!: string;
}
