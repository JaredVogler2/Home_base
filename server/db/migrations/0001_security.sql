-- Roles, row-level security and grants.
--
-- The server reaches the database as the role that owns these tables. Whenever it is working for a household it
-- first steps down, for that one transaction, to "homebase_app" and names the household:
--
--     select set_config('app.household_id', '<uuid>', true);  set local role homebase_app;
--
-- From then on the database itself refuses any row of another household, whatever the query says, and refuses
-- to change or delete a line of the star ledger at all. Sign-in, sessions and pairing run as the owner and are
-- the only code that does; "homebase_app" cannot read a password hash, a session or an e-mail address.
--
-- Row-level security is switched on for every table, including the ones "homebase_app" may not touch, so that a
-- host which publishes tables over an HTTP data API has nothing to publish.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'homebase_app') THEN
    CREATE ROLE homebase_app NOLOGIN;
  END IF;
  -- The owner must be allowed to step down to it. From PostgreSQL 16 that is the SET option of a membership.
  IF current_setting('server_version_num')::int >= 160000 THEN
    EXECUTE format('GRANT homebase_app TO %I WITH SET TRUE, INHERIT FALSE', current_user);
  ELSE
    EXECUTE format('GRANT homebase_app TO %I', current_user);
  END IF;
END
$$;
--> statement-breakpoint
GRANT USAGE ON SCHEMA "homebase" TO homebase_app;
--> statement-breakpoint
ALTER TABLE "homebase"."users" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "homebase"."households" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "homebase"."sessions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "homebase"."pair_codes" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "homebase"."rate_limits" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "homebase"."recovery_codes" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "homebase"."memberships" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "homebase"."invites" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "homebase"."devices" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "homebase"."shortcut_tokens" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "homebase"."profiles" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "homebase"."task_templates" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "homebase"."task_occurrences" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "homebase"."rewards" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "homebase"."redemptions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "homebase"."goals" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "homebase"."routines" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "homebase"."routine_runs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "homebase"."routine_step_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "homebase"."shopping_lists" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "homebase"."shopping_items" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "homebase"."academy_links" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "homebase"."academy_sessions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "homebase"."connections" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "homebase"."calendar_rules" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "homebase"."calendar_days" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "homebase"."media" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "homebase"."media_blobs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "homebase"."weather_cache" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "homebase"."weekly_totals" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "homebase"."milestones" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "homebase"."badges" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "homebase"."ai_proposals" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "homebase"."task_template_versions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "homebase"."routine_versions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "homebase"."operations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "homebase"."ai_usage" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "homebase"."ledger" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "homebase"."audit" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "homebase"."shopping_item_history" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "homebase"."events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "homebase"."wallets" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "household_isolation" ON "homebase"."memberships" FOR ALL TO homebase_app
  USING ("household_id" = nullif(current_setting('app.household_id', true), '')::uuid)
  WITH CHECK ("household_id" = nullif(current_setting('app.household_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY "household_isolation" ON "homebase"."invites" FOR ALL TO homebase_app
  USING ("household_id" = nullif(current_setting('app.household_id', true), '')::uuid)
  WITH CHECK ("household_id" = nullif(current_setting('app.household_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY "household_isolation" ON "homebase"."devices" FOR ALL TO homebase_app
  USING ("household_id" = nullif(current_setting('app.household_id', true), '')::uuid)
  WITH CHECK ("household_id" = nullif(current_setting('app.household_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY "household_isolation" ON "homebase"."shortcut_tokens" FOR ALL TO homebase_app
  USING ("household_id" = nullif(current_setting('app.household_id', true), '')::uuid)
  WITH CHECK ("household_id" = nullif(current_setting('app.household_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY "household_isolation" ON "homebase"."profiles" FOR ALL TO homebase_app
  USING ("household_id" = nullif(current_setting('app.household_id', true), '')::uuid)
  WITH CHECK ("household_id" = nullif(current_setting('app.household_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY "household_isolation" ON "homebase"."task_templates" FOR ALL TO homebase_app
  USING ("household_id" = nullif(current_setting('app.household_id', true), '')::uuid)
  WITH CHECK ("household_id" = nullif(current_setting('app.household_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY "household_isolation" ON "homebase"."task_occurrences" FOR ALL TO homebase_app
  USING ("household_id" = nullif(current_setting('app.household_id', true), '')::uuid)
  WITH CHECK ("household_id" = nullif(current_setting('app.household_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY "household_isolation" ON "homebase"."rewards" FOR ALL TO homebase_app
  USING ("household_id" = nullif(current_setting('app.household_id', true), '')::uuid)
  WITH CHECK ("household_id" = nullif(current_setting('app.household_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY "household_isolation" ON "homebase"."redemptions" FOR ALL TO homebase_app
  USING ("household_id" = nullif(current_setting('app.household_id', true), '')::uuid)
  WITH CHECK ("household_id" = nullif(current_setting('app.household_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY "household_isolation" ON "homebase"."goals" FOR ALL TO homebase_app
  USING ("household_id" = nullif(current_setting('app.household_id', true), '')::uuid)
  WITH CHECK ("household_id" = nullif(current_setting('app.household_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY "household_isolation" ON "homebase"."routines" FOR ALL TO homebase_app
  USING ("household_id" = nullif(current_setting('app.household_id', true), '')::uuid)
  WITH CHECK ("household_id" = nullif(current_setting('app.household_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY "household_isolation" ON "homebase"."routine_runs" FOR ALL TO homebase_app
  USING ("household_id" = nullif(current_setting('app.household_id', true), '')::uuid)
  WITH CHECK ("household_id" = nullif(current_setting('app.household_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY "household_isolation" ON "homebase"."routine_step_events" FOR ALL TO homebase_app
  USING ("household_id" = nullif(current_setting('app.household_id', true), '')::uuid)
  WITH CHECK ("household_id" = nullif(current_setting('app.household_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY "household_isolation" ON "homebase"."shopping_lists" FOR ALL TO homebase_app
  USING ("household_id" = nullif(current_setting('app.household_id', true), '')::uuid)
  WITH CHECK ("household_id" = nullif(current_setting('app.household_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY "household_isolation" ON "homebase"."shopping_items" FOR ALL TO homebase_app
  USING ("household_id" = nullif(current_setting('app.household_id', true), '')::uuid)
  WITH CHECK ("household_id" = nullif(current_setting('app.household_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY "household_isolation" ON "homebase"."academy_links" FOR ALL TO homebase_app
  USING ("household_id" = nullif(current_setting('app.household_id', true), '')::uuid)
  WITH CHECK ("household_id" = nullif(current_setting('app.household_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY "household_isolation" ON "homebase"."academy_sessions" FOR ALL TO homebase_app
  USING ("household_id" = nullif(current_setting('app.household_id', true), '')::uuid)
  WITH CHECK ("household_id" = nullif(current_setting('app.household_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY "household_isolation" ON "homebase"."connections" FOR ALL TO homebase_app
  USING ("household_id" = nullif(current_setting('app.household_id', true), '')::uuid)
  WITH CHECK ("household_id" = nullif(current_setting('app.household_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY "household_isolation" ON "homebase"."calendar_rules" FOR ALL TO homebase_app
  USING ("household_id" = nullif(current_setting('app.household_id', true), '')::uuid)
  WITH CHECK ("household_id" = nullif(current_setting('app.household_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY "household_isolation" ON "homebase"."calendar_days" FOR ALL TO homebase_app
  USING ("household_id" = nullif(current_setting('app.household_id', true), '')::uuid)
  WITH CHECK ("household_id" = nullif(current_setting('app.household_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY "household_isolation" ON "homebase"."media" FOR ALL TO homebase_app
  USING ("household_id" = nullif(current_setting('app.household_id', true), '')::uuid)
  WITH CHECK ("household_id" = nullif(current_setting('app.household_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY "household_isolation" ON "homebase"."media_blobs" FOR ALL TO homebase_app
  USING ("household_id" = nullif(current_setting('app.household_id', true), '')::uuid)
  WITH CHECK ("household_id" = nullif(current_setting('app.household_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY "household_isolation" ON "homebase"."weather_cache" FOR ALL TO homebase_app
  USING ("household_id" = nullif(current_setting('app.household_id', true), '')::uuid)
  WITH CHECK ("household_id" = nullif(current_setting('app.household_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY "household_isolation" ON "homebase"."weekly_totals" FOR ALL TO homebase_app
  USING ("household_id" = nullif(current_setting('app.household_id', true), '')::uuid)
  WITH CHECK ("household_id" = nullif(current_setting('app.household_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY "household_isolation" ON "homebase"."milestones" FOR ALL TO homebase_app
  USING ("household_id" = nullif(current_setting('app.household_id', true), '')::uuid)
  WITH CHECK ("household_id" = nullif(current_setting('app.household_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY "household_isolation" ON "homebase"."badges" FOR ALL TO homebase_app
  USING ("household_id" = nullif(current_setting('app.household_id', true), '')::uuid)
  WITH CHECK ("household_id" = nullif(current_setting('app.household_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY "household_isolation" ON "homebase"."ai_proposals" FOR ALL TO homebase_app
  USING ("household_id" = nullif(current_setting('app.household_id', true), '')::uuid)
  WITH CHECK ("household_id" = nullif(current_setting('app.household_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY "household_isolation" ON "homebase"."task_template_versions" FOR ALL TO homebase_app
  USING ("household_id" = nullif(current_setting('app.household_id', true), '')::uuid)
  WITH CHECK ("household_id" = nullif(current_setting('app.household_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY "household_isolation" ON "homebase"."routine_versions" FOR ALL TO homebase_app
  USING ("household_id" = nullif(current_setting('app.household_id', true), '')::uuid)
  WITH CHECK ("household_id" = nullif(current_setting('app.household_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY "household_isolation" ON "homebase"."operations" FOR ALL TO homebase_app
  USING ("household_id" = nullif(current_setting('app.household_id', true), '')::uuid)
  WITH CHECK ("household_id" = nullif(current_setting('app.household_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY "household_isolation" ON "homebase"."ai_usage" FOR ALL TO homebase_app
  USING ("household_id" = nullif(current_setting('app.household_id', true), '')::uuid)
  WITH CHECK ("household_id" = nullif(current_setting('app.household_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY "household_isolation" ON "homebase"."ledger" FOR ALL TO homebase_app
  USING ("household_id" = nullif(current_setting('app.household_id', true), '')::uuid)
  WITH CHECK ("household_id" = nullif(current_setting('app.household_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY "household_isolation" ON "homebase"."audit" FOR ALL TO homebase_app
  USING ("household_id" = nullif(current_setting('app.household_id', true), '')::uuid)
  WITH CHECK ("household_id" = nullif(current_setting('app.household_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY "household_isolation" ON "homebase"."shopping_item_history" FOR ALL TO homebase_app
  USING ("household_id" = nullif(current_setting('app.household_id', true), '')::uuid)
  WITH CHECK ("household_id" = nullif(current_setting('app.household_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY "household_isolation" ON "homebase"."events" FOR ALL TO homebase_app
  USING ("household_id" = nullif(current_setting('app.household_id', true), '')::uuid)
  WITH CHECK ("household_id" = nullif(current_setting('app.household_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY "household_isolation" ON "homebase"."wallets" FOR ALL TO homebase_app
  USING ("household_id" = nullif(current_setting('app.household_id', true), '')::uuid)
  WITH CHECK ("household_id" = nullif(current_setting('app.household_id', true), '')::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "homebase"."memberships" TO homebase_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "homebase"."invites" TO homebase_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "homebase"."devices" TO homebase_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "homebase"."shortcut_tokens" TO homebase_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "homebase"."profiles" TO homebase_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "homebase"."task_templates" TO homebase_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "homebase"."task_occurrences" TO homebase_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "homebase"."rewards" TO homebase_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "homebase"."redemptions" TO homebase_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "homebase"."goals" TO homebase_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "homebase"."routines" TO homebase_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "homebase"."routine_runs" TO homebase_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "homebase"."routine_step_events" TO homebase_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "homebase"."shopping_lists" TO homebase_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "homebase"."shopping_items" TO homebase_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "homebase"."academy_links" TO homebase_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "homebase"."academy_sessions" TO homebase_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "homebase"."connections" TO homebase_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "homebase"."calendar_rules" TO homebase_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "homebase"."calendar_days" TO homebase_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "homebase"."media" TO homebase_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "homebase"."media_blobs" TO homebase_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "homebase"."weather_cache" TO homebase_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "homebase"."weekly_totals" TO homebase_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "homebase"."milestones" TO homebase_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "homebase"."badges" TO homebase_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "homebase"."ai_proposals" TO homebase_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON "homebase"."task_template_versions" TO homebase_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON "homebase"."routine_versions" TO homebase_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON "homebase"."operations" TO homebase_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON "homebase"."ai_usage" TO homebase_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON "homebase"."ledger" TO homebase_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON "homebase"."audit" TO homebase_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON "homebase"."shopping_item_history" TO homebase_app;
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON "homebase"."events" TO homebase_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "homebase"."wallets" TO homebase_app;
--> statement-breakpoint
-- A household may read itself, and change its own name, zone, settings and revision. Nothing else.
CREATE POLICY "household_self" ON "homebase"."households" FOR ALL TO homebase_app
  USING ("id" = nullif(current_setting('app.household_id', true), '')::uuid)
  WITH CHECK ("id" = nullif(current_setting('app.household_id', true), '')::uuid);
--> statement-breakpoint
GRANT SELECT ON "homebase"."households" TO homebase_app;
--> statement-breakpoint
GRANT UPDATE ("name", "time_zone", "settings", "revision", "housekept_on") ON "homebase"."households" TO homebase_app;
--> statement-breakpoint
-- Of a grown-up's account, a household may see a name and a picture, and only of its own members.
CREATE POLICY "household_members" ON "homebase"."users" FOR SELECT TO homebase_app
  USING ("id" IN (SELECT "user_id" FROM "homebase"."memberships"));
--> statement-breakpoint
GRANT SELECT ("id", "display_name", "avatar") ON "homebase"."users" TO homebase_app;
--> statement-breakpoint
-- Belt and braces for the ledger: even the owner's ordinary code path cannot rewrite a line. Lines leave only
-- when the child they belong to is deleted (a cascade), which this trigger lets through.
CREATE FUNCTION "homebase"."ledger_is_append_only"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'the star ledger is append-only' USING ERRCODE = 'restrict_violation';
  END IF;
  IF TG_OP = 'DELETE' AND pg_trigger_depth() < 2 THEN
    RAISE EXCEPTION 'the star ledger is append-only' USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN COALESCE(NEW, OLD);
END
$$;
--> statement-breakpoint
CREATE TRIGGER "ledger_append_only" BEFORE UPDATE OR DELETE ON "homebase"."ledger"
  FOR EACH ROW EXECUTE FUNCTION "homebase"."ledger_is_append_only"();
