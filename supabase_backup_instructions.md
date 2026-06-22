# Supabase Schema Backup Instructions

Since Phase 7 is complete and we are moving to Phase 8, it is highly recommended to take a snapshot of your database schema.

### How to export from the Supabase Dashboard:
1. Go to your [Supabase Project Dashboard](https://app.supabase.com/).
2. Navigate to **Database** -> **Backups**.
3. If you are on the Pro plan, you can trigger a manual backup.
4. If you are on the Free plan or prefer a raw SQL dump:
   - Go to **SQL Editor**.
   - You can dump the schema using the Supabase CLI locally if you have it installed:
     ```bash
     npx supabase login
     npx supabase link --project-ref your-project-id
     npx supabase db dump -f supabase_schema_backup_phase7.sql
     ```
   - Alternatively, you can use `pg_dump` if you have your connection string password:
     ```bash
     pg_dump -h db.izcuwepzeqhfnjcmpekz.supabase.co -U postgres -d postgres --schema-only > schema_backup.sql
     ```

*Note: Please keep this SQL file safe as we transition to Phase 8.*
