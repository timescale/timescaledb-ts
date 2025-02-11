export function generateTimestamptzCheck(tableName: string, columnName: string): string {
  return `
  DO $$ 
  BEGIN
    IF EXISTS (
      SELECT 1 
      FROM information_schema.columns 
      WHERE table_name = '${tableName}' 
      AND column_name = '${columnName}' 
      AND data_type != 'timestamp with time zone'
    ) THEN
      EXECUTE format('ALTER TABLE %I ALTER COLUMN %I TYPE timestamptz', 
        '${tableName}', 
        '${columnName}'
      );
    END IF;
  END $$;
  `;
}
