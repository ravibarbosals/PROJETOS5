import {
  DataSource,
  EntityMetadata,
  EntityTarget,
  ObjectLiteral,
} from 'typeorm';
import { buildDatabaseOptions } from '@/infrastructure/database/database.options';

// Builds TypeORM metadata without opening a connection, so unit tests can check
// that entities mirror the migrations (erd.md).
class MetadataOnlyDataSource extends DataSource {
  build() {
    return this.buildMetadatas();
  }
}

export async function loadEntityMetadata(
  entities: EntityTarget<ObjectLiteral>[],
): Promise<(entity: EntityTarget<ObjectLiteral>) => EntityMetadata> {
  const dataSource = new MetadataOnlyDataSource({
    ...buildDatabaseOptions({
      DATABASE_URL: 'postgresql://unused:unused@localhost:5432/unused',
    }),
    entities: entities as DataSource['options']['entities'],
  });
  await dataSource.build();
  return (entity) => dataSource.getMetadata(entity);
}

// Column names of app.table after the migrations' SQL, in order: those declared
// in "CREATE TABLE app.table (...)" plus "ADD COLUMN", minus "DROP COLUMN".
// Constraint lines (CONSTRAINT, and REFERENCES continuing a foreign key) are skipped.
export function columnsCreatedIn(sql: string, table: string): string[] {
  const block = new RegExp(
    String.raw`CREATE TABLE app\.${table} \(([\s\S]*?)\n\s*\)\s*$`,
    'm',
  ).exec(sql);
  if (!block) throw new Error(`CREATE TABLE app.${table} not found`);
  const columns = [...block[1].matchAll(/^\s*(\w+)\s+\w/gm)]
    .map((m) => m[1])
    .filter((name) => name !== 'CONSTRAINT' && name !== 'REFERENCES');

  const alter = new RegExp(
    String.raw`ALTER TABLE app\.${table} (ADD|DROP) COLUMN (\w+)`,
    'g',
  );
  for (const [, operation, name] of sql.matchAll(alter)) {
    if (operation === 'ADD') columns.push(name);
    else columns.splice(columns.indexOf(name), 1);
  }
  return columns;
}
