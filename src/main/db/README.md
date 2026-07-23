# Database migrations

`migrationRunner.ts` and its `DATABASE_MIGRATIONS` registry are the only executable source of truth for the SQLite schema.

- Published migrations are append-only: never edit or renumber an existing version.
- Add each schema change as the next contiguous TypeScript migration.
- Keep each migration transactional and cover new database, upgrade, repeated startup and rollback paths in `migrationRunner.test.ts`.
- Do not add standalone numbered SQL files. They are not loaded by the application and would create a misleading second migration registry.
- AI report source song IDs are immutable JSON snapshots, not foreign keys to the disposable song cache. Cache ownership changes must not delete `ai_reports` or `ai_report_sources`.
