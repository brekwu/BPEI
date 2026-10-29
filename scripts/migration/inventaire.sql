-- BPEI / Préflight sans modification des tables permanentes.
-- Utilise seulement une table temporaire effacée au COMMIT.
-- Aucun enregistrement personnel n'est exporté : uniquement les comptes de lignes.
-- Exécution : psql -X -qAt -v ON_ERROR_STOP=1 -f scripts/migration/inventaire.sql > inventaire-source.json
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';
CREATE TEMP TABLE bpei_migration_inventory (
  schema_name text NOT NULL,
  table_name text NOT NULL,
  row_count bigint NOT NULL
) ON COMMIT DROP;

DO $audit$
DECLARE
  row_item record;
  rows_found bigint;
BEGIN
  FOR row_item IN
    SELECT n.nspname AS schema_name, c.relname AS table_name
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname IN ('public', 'auth', 'storage')
       AND c.relkind IN ('r', 'p')
       AND NOT c.relispartition
     ORDER BY n.nspname, c.relname
  LOOP
    BEGIN
      EXECUTE format(
        'SELECT count(*) FROM %I.%I',
        row_item.schema_name, row_item.table_name
      ) INTO rows_found;
    EXCEPTION WHEN insufficient_privilege THEN
      rows_found := -1;
    END;
    INSERT INTO bpei_migration_inventory(schema_name, table_name, row_count)
    VALUES(row_item.schema_name, row_item.table_name, rows_found);
  END LOOP;
END
$audit$;

SELECT COALESCE(
  json_agg(
    json_build_object('schema', schema_name, 'table', table_name, 'rows', row_count)
    ORDER BY schema_name, table_name
  )::text,
  '[]'
)
FROM bpei_migration_inventory;
COMMIT;
