CREATE SCHEMA "homebase";
--> statement-breakpoint
CREATE TABLE "homebase"."academy_links" (
	"profile_id" uuid PRIMARY KEY NOT NULL,
	"household_id" uuid NOT NULL,
	"player_id" text NOT NULL,
	"consent_by" uuid,
	"consent_at" timestamp with time zone NOT NULL,
	"last_import_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "homebase"."academy_sessions" (
	"household_id" uuid NOT NULL,
	"session_id" text NOT NULL,
	"profile_id" uuid NOT NULL,
	"world" text NOT NULL,
	"lesson_id" text NOT NULL,
	"local_date" date NOT NULL,
	"completed" boolean NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"independent" integer DEFAULT 0 NOT NULL,
	"supported" integer DEFAULT 0 NOT NULL,
	"credit_tx" uuid,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "academy_sessions_household_id_session_id_pk" PRIMARY KEY("household_id","session_id")
);
--> statement-breakpoint
CREATE TABLE "homebase"."ai_proposals" (
	"id" uuid PRIMARY KEY NOT NULL,
	"household_id" uuid NOT NULL,
	"workflow" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"envelope" jsonb NOT NULL,
	"transcript" jsonb,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	CONSTRAINT "ai_proposals_status_check" CHECK ("homebase"."ai_proposals"."status" in ('draft', 'accepted', 'dismissed'))
);
--> statement-breakpoint
CREATE TABLE "homebase"."ai_usage" (
	"id" uuid PRIMARY KEY NOT NULL,
	"household_id" uuid NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"local_date" date NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"workflow" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cost_millicents" integer DEFAULT 0 NOT NULL,
	"outcome" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "homebase"."audit" (
	"id" uuid PRIMARY KEY NOT NULL,
	"household_id" uuid NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"action" text NOT NULL,
	"actor" text NOT NULL,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "homebase"."badges" (
	"household_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"badge" text NOT NULL,
	"earned_on" date NOT NULL,
	CONSTRAINT "badges_profile_id_badge_pk" PRIMARY KEY("profile_id","badge")
);
--> statement-breakpoint
CREATE TABLE "homebase"."calendar_days" (
	"household_id" uuid NOT NULL,
	"local_date" date NOT NULL,
	"label" text NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	CONSTRAINT "calendar_days_household_id_local_date_label_source_pk" PRIMARY KEY("household_id","local_date","label","source")
);
--> statement-breakpoint
CREATE TABLE "homebase"."calendar_rules" (
	"id" uuid PRIMARY KEY NOT NULL,
	"household_id" uuid NOT NULL,
	"match" text NOT NULL,
	"label" text NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "homebase"."connections" (
	"id" uuid PRIMARY KEY NOT NULL,
	"household_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"label" text NOT NULL,
	"secret" text,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'ok' NOT NULL,
	"last_sync_at" timestamp with time zone,
	"last_error" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "connections_provider_check" CHECK ("homebase"."connections"."provider" in ('calendar_ics'))
);
--> statement-breakpoint
CREATE TABLE "homebase"."devices" (
	"id" uuid PRIMARY KEY NOT NULL,
	"household_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'wall' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "devices_kind_check" CHECK ("homebase"."devices"."kind" in ('wall', 'tablet'))
);
--> statement-breakpoint
CREATE TABLE "homebase"."events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"household_id" uuid NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"local_date" date NOT NULL,
	"kind" text NOT NULL,
	"profile_id" uuid,
	"subject_id" uuid,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"actor" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "homebase"."goals" (
	"profile_id" uuid PRIMARY KEY NOT NULL,
	"household_id" uuid NOT NULL,
	"reward_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "homebase"."households" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"time_zone" text NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"demo" boolean DEFAULT false NOT NULL,
	"housekept_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "homebase"."invites" (
	"id" uuid PRIMARY KEY NOT NULL,
	"household_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"code_hash" text NOT NULL,
	"role" text DEFAULT 'guardian' NOT NULL,
	"user_id" uuid,
	"created_by" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invites_kind_check" CHECK ("homebase"."invites"."kind" in ('join', 'reset')),
	CONSTRAINT "invites_role_check" CHECK ("homebase"."invites"."role" in ('guardian', 'caregiver'))
);
--> statement-breakpoint
CREATE TABLE "homebase"."ledger" (
	"id" uuid PRIMARY KEY NOT NULL,
	"household_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"available" integer DEFAULT 0 NOT NULL,
	"reserved" integer DEFAULT 0 NOT NULL,
	"lifetime" integer DEFAULT 0 NOT NULL,
	"source" text NOT NULL,
	"source_id" uuid,
	"idempotency_key" text NOT NULL,
	"reverses" uuid,
	"note" text,
	"actor" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ledger_kind_check" CHECK ("homebase"."ledger"."kind" in ('grant', 'reserve', 'release', 'spend', 'refund', 'correction')),
	CONSTRAINT "ledger_source_check" CHECK ("homebase"."ledger"."source" in ('task', 'routine', 'academy', 'bonus', 'allowance', 'redemption', 'correction')),
	CONSTRAINT "ledger_shape_check" CHECK (case "homebase"."ledger"."kind"
            when 'grant' then "homebase"."ledger"."available" >= 0 and "homebase"."ledger"."reserved" = 0 and "homebase"."ledger"."lifetime" >= 0
            when 'reserve' then "homebase"."ledger"."available" < 0 and "homebase"."ledger"."reserved" = -"homebase"."ledger"."available" and "homebase"."ledger"."lifetime" = 0
            when 'release' then "homebase"."ledger"."available" > 0 and "homebase"."ledger"."reserved" = -"homebase"."ledger"."available" and "homebase"."ledger"."lifetime" = 0
            when 'spend' then "homebase"."ledger"."available" = 0 and "homebase"."ledger"."reserved" < 0 and "homebase"."ledger"."lifetime" = 0
            when 'refund' then "homebase"."ledger"."available" > 0 and "homebase"."ledger"."reserved" = 0 and "homebase"."ledger"."lifetime" = 0
            else "homebase"."ledger"."reserved" = 0
          end)
);
--> statement-breakpoint
CREATE TABLE "homebase"."media" (
	"id" uuid PRIMARY KEY NOT NULL,
	"household_id" uuid NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"widths" integer[] NOT NULL,
	"bytes" integer NOT NULL,
	"in_slideshow" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "homebase"."media_blobs" (
	"media_id" uuid NOT NULL,
	"household_id" uuid NOT NULL,
	"width" integer NOT NULL,
	"content_type" text NOT NULL,
	"data" "bytea" NOT NULL,
	CONSTRAINT "media_blobs_media_id_width_pk" PRIMARY KEY("media_id","width")
);
--> statement-breakpoint
CREATE TABLE "homebase"."memberships" (
	"id" uuid PRIMARY KEY NOT NULL,
	"household_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"pin_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "memberships_role_check" CHECK ("homebase"."memberships"."role" in ('owner', 'guardian', 'caregiver'))
);
--> statement-breakpoint
CREATE TABLE "homebase"."milestones" (
	"id" uuid PRIMARY KEY NOT NULL,
	"household_id" uuid NOT NULL,
	"local_date" date NOT NULL,
	"title" text NOT NULL,
	"picture" text,
	"profile_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "homebase"."operations" (
	"household_id" uuid NOT NULL,
	"op_id" uuid NOT NULL,
	"type" text NOT NULL,
	"status" text NOT NULL,
	"result" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"actor" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "operations_household_id_op_id_pk" PRIMARY KEY("household_id","op_id")
);
--> statement-breakpoint
CREATE TABLE "homebase"."pair_codes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code_hash" text NOT NULL,
	"secret_hash" text NOT NULL,
	"kind" text DEFAULT 'wall' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"claimed_by" uuid,
	"claimed_household" uuid,
	"device_name" text,
	"claimed_at" timestamp with time zone,
	"collected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "homebase"."profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"household_id" uuid NOT NULL,
	"nickname" text NOT NULL,
	"avatar" text NOT NULL,
	"age_band" text NOT NULL,
	"independent" boolean DEFAULT true NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"prefs" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_age_band_check" CHECK ("homebase"."profiles"."age_band" in ('baby', 'toddler', 'preschool', 'early', 'older'))
);
--> statement-breakpoint
CREATE TABLE "homebase"."rate_limits" (
	"key" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "rate_limits_key_window_start_pk" PRIMARY KEY("key","window_start")
);
--> statement-breakpoint
CREATE TABLE "homebase"."recovery_codes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "homebase"."redemptions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"household_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"reward_id" uuid NOT NULL,
	"reward_version" integer NOT NULL,
	"title" text NOT NULL,
	"picture" text NOT NULL,
	"price" integer NOT NULL,
	"status" text DEFAULT 'requested' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	"decided_by" text,
	"decline_reason" text,
	"fulfilled_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "redemptions_status_check" CHECK ("homebase"."redemptions"."status" in ('requested', 'approved', 'declined', 'cancelled', 'fulfilled', 'refunded')),
	CONSTRAINT "redemptions_price_check" CHECK ("homebase"."redemptions"."price" > 0)
);
--> statement-breakpoint
CREATE TABLE "homebase"."rewards" (
	"id" uuid PRIMARY KEY NOT NULL,
	"household_id" uuid NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"title" text NOT NULL,
	"picture" text NOT NULL,
	"say" text,
	"price" integer NOT NULL,
	"stock" integer,
	"profiles" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rewards_status_check" CHECK ("homebase"."rewards"."status" in ('active', 'paused', 'archived')),
	CONSTRAINT "rewards_price_check" CHECK ("homebase"."rewards"."price" between 1 and 1000),
	CONSTRAINT "rewards_stock_check" CHECK ("homebase"."rewards"."stock" is null or "homebase"."rewards"."stock" >= 0)
);
--> statement-breakpoint
CREATE TABLE "homebase"."routine_runs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"household_id" uuid NOT NULL,
	"routine_id" uuid NOT NULL,
	"routine_version" integer NOT NULL,
	"profile_id" uuid NOT NULL,
	"local_date" date NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "routine_runs_status_check" CHECK ("homebase"."routine_runs"."status" in ('active', 'suspended', 'completed'))
);
--> statement-breakpoint
CREATE TABLE "homebase"."routine_step_events" (
	"run_id" uuid NOT NULL,
	"household_id" uuid NOT NULL,
	"step_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"actor" text NOT NULL,
	CONSTRAINT "routine_step_events_run_id_step_id_kind_pk" PRIMARY KEY("run_id","step_id","kind"),
	CONSTRAINT "routine_step_events_kind_check" CHECK ("homebase"."routine_step_events"."kind" in ('done', 'together', 'skipped', 'help'))
);
--> statement-breakpoint
CREATE TABLE "homebase"."routine_versions" (
	"routine_id" uuid NOT NULL,
	"household_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"picture" text NOT NULL,
	"steps" jsonb NOT NULL,
	"assignees" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"days" integer[] NOT NULL,
	"start_time" text,
	"end_time" text,
	"skip" text DEFAULT 'grownup' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "routine_versions_routine_id_version_pk" PRIMARY KEY("routine_id","version"),
	CONSTRAINT "routine_versions_skip_check" CHECK ("homebase"."routine_versions"."skip" in ('child', 'grownup', 'off'))
);
--> statement-breakpoint
CREATE TABLE "homebase"."routines" (
	"id" uuid PRIMARY KEY NOT NULL,
	"household_id" uuid NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "routines_status_check" CHECK ("homebase"."routines"."status" in ('active', 'paused', 'archived'))
);
--> statement-breakpoint
CREATE TABLE "homebase"."sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"kind" text NOT NULL,
	"household_id" uuid NOT NULL,
	"user_id" uuid,
	"device_id" uuid,
	"unlocked_by" uuid,
	"unlocked_until" timestamp with time zone,
	"unlocked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "sessions_kind_check" CHECK ("homebase"."sessions"."kind" in ('guardian', 'device')),
	CONSTRAINT "sessions_subject_check" CHECK (("homebase"."sessions"."kind" = 'guardian' and "homebase"."sessions"."user_id" is not null and "homebase"."sessions"."device_id" is null) or ("homebase"."sessions"."kind" = 'device' and "homebase"."sessions"."device_id" is not null and "homebase"."sessions"."user_id" is null))
);
--> statement-breakpoint
CREATE TABLE "homebase"."shopping_item_history" (
	"id" uuid PRIMARY KEY NOT NULL,
	"household_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor" text NOT NULL,
	"change" text NOT NULL,
	"before" jsonb,
	"after" jsonb
);
--> statement-breakpoint
CREATE TABLE "homebase"."shopping_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"household_id" uuid NOT NULL,
	"list_id" uuid NOT NULL,
	"text" text NOT NULL,
	"normalized" text NOT NULL,
	"picture" text DEFAULT 'other' NOT NULL,
	"category" text DEFAULT 'other' NOT NULL,
	"quantity" integer,
	"unit" text,
	"note" text,
	"url" text,
	"store" text,
	"priority" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'needed' NOT NULL,
	"requested_by" uuid,
	"added_by" text NOT NULL,
	"also_asked" integer DEFAULT 0 NOT NULL,
	"field_versions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"checked_at" timestamp with time zone,
	"checked_by" text,
	"archived_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shopping_items_status_check" CHECK ("homebase"."shopping_items"."status" in ('needed', 'checked', 'requested', 'declined')),
	CONSTRAINT "shopping_items_quantity_check" CHECK ("homebase"."shopping_items"."quantity" is null or "homebase"."shopping_items"."quantity" between 1 and 999)
);
--> statement-breakpoint
CREATE TABLE "homebase"."shopping_lists" (
	"id" uuid PRIMARY KEY NOT NULL,
	"household_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'groceries' NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shopping_lists_kind_check" CHECK ("homebase"."shopping_lists"."kind" in ('groceries', 'general'))
);
--> statement-breakpoint
CREATE TABLE "homebase"."shortcut_tokens" (
	"id" uuid PRIMARY KEY NOT NULL,
	"household_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "homebase"."task_occurrences" (
	"id" uuid PRIMARY KEY NOT NULL,
	"household_id" uuid NOT NULL,
	"template_id" uuid NOT NULL,
	"template_version" integer NOT NULL,
	"profile_id" uuid,
	"local_date" date NOT NULL,
	"status" text DEFAULT 'available' NOT NULL,
	"stars" integer NOT NULL,
	"done_by" uuid,
	"started_at" timestamp with time zone,
	"submitted_at" timestamp with time zone,
	"decided_at" timestamp with time zone,
	"decided_by" text,
	"return_reason" text,
	"help_asked" boolean DEFAULT false NOT NULL,
	"undo_until" timestamp with time zone,
	"snoozed_until" timestamp with time zone,
	"credit_tx" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_occurrences_status_check" CHECK ("homebase"."task_occurrences"."status" in ('available', 'in_progress', 'submitted', 'approved', 'returned', 'skipped')),
	CONSTRAINT "task_occurrences_stars_check" CHECK ("homebase"."task_occurrences"."stars" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "homebase"."task_template_versions" (
	"template_id" uuid NOT NULL,
	"household_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"picture" text NOT NULL,
	"say" text,
	"steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"schedule" jsonb NOT NULL,
	"assignees" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"shared" boolean DEFAULT false NOT NULL,
	"stars" integer NOT NULL,
	"effort" integer DEFAULT 1 NOT NULL,
	"verification" text NOT NULL,
	"skip" text DEFAULT 'child' NOT NULL,
	"needs_adult" boolean DEFAULT false NOT NULL,
	"timer_seconds" integer,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_template_versions_template_id_version_pk" PRIMARY KEY("template_id","version"),
	CONSTRAINT "task_template_versions_kind_check" CHECK ("homebase"."task_template_versions"."kind" in ('core', 'bonus')),
	CONSTRAINT "task_template_versions_verification_check" CHECK ("homebase"."task_template_versions"."verification" in ('auto', 'guardian')),
	CONSTRAINT "task_template_versions_skip_check" CHECK ("homebase"."task_template_versions"."skip" in ('child', 'grownup', 'off')),
	CONSTRAINT "task_template_versions_stars_check" CHECK ("homebase"."task_template_versions"."stars" between 0 and 100),
	CONSTRAINT "task_template_versions_effort_check" CHECK ("homebase"."task_template_versions"."effort" between 1 and 3)
);
--> statement-breakpoint
CREATE TABLE "homebase"."task_templates" (
	"id" uuid PRIMARY KEY NOT NULL,
	"household_id" uuid NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_templates_status_check" CHECK ("homebase"."task_templates"."status" in ('active', 'paused', 'archived'))
);
--> statement-breakpoint
CREATE TABLE "homebase"."users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"avatar" text DEFAULT 'owl' NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"disabled_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "homebase"."wallets" (
	"profile_id" uuid PRIMARY KEY NOT NULL,
	"household_id" uuid NOT NULL,
	"available" integer DEFAULT 0 NOT NULL,
	"reserved" integer DEFAULT 0 NOT NULL,
	"lifetime" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wallets_available_check" CHECK ("homebase"."wallets"."available" >= 0),
	CONSTRAINT "wallets_reserved_check" CHECK ("homebase"."wallets"."reserved" >= 0),
	CONSTRAINT "wallets_lifetime_check" CHECK ("homebase"."wallets"."lifetime" >= 0)
);
--> statement-breakpoint
CREATE TABLE "homebase"."weather_cache" (
	"household_id" uuid PRIMARY KEY NOT NULL,
	"place" text NOT NULL,
	"state" text NOT NULL,
	"temperature_c" integer,
	"observed_at" timestamp with time zone NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"failures" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "homebase"."weekly_totals" (
	"household_id" uuid NOT NULL,
	"week_start" date NOT NULL,
	"profile_id" uuid NOT NULL,
	"metric" text NOT NULL,
	"value" integer NOT NULL,
	CONSTRAINT "weekly_totals_household_id_week_start_profile_id_metric_pk" PRIMARY KEY("household_id","week_start","profile_id","metric")
);
--> statement-breakpoint
ALTER TABLE "homebase"."academy_links" ADD CONSTRAINT "academy_links_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "homebase"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homebase"."academy_links" ADD CONSTRAINT "academy_links_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "homebase"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homebase"."academy_links" ADD CONSTRAINT "academy_links_consent_by_users_id_fk" FOREIGN KEY ("consent_by") REFERENCES "homebase"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homebase"."academy_sessions" ADD CONSTRAINT "academy_sessions_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "homebase"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homebase"."academy_sessions" ADD CONSTRAINT "academy_sessions_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "homebase"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homebase"."ai_proposals" ADD CONSTRAINT "ai_proposals_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "homebase"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homebase"."ai_proposals" ADD CONSTRAINT "ai_proposals_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "homebase"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homebase"."ai_usage" ADD CONSTRAINT "ai_usage_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "homebase"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homebase"."audit" ADD CONSTRAINT "audit_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "homebase"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homebase"."badges" ADD CONSTRAINT "badges_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "homebase"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homebase"."badges" ADD CONSTRAINT "badges_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "homebase"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homebase"."calendar_days" ADD CONSTRAINT "calendar_days_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "homebase"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homebase"."calendar_rules" ADD CONSTRAINT "calendar_rules_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "homebase"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homebase"."connections" ADD CONSTRAINT "connections_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "homebase"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homebase"."connections" ADD CONSTRAINT "connections_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "homebase"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homebase"."devices" ADD CONSTRAINT "devices_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "homebase"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homebase"."devices" ADD CONSTRAINT "devices_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "homebase"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homebase"."events" ADD CONSTRAINT "events_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "homebase"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homebase"."events" ADD CONSTRAINT "events_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "homebase"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homebase"."goals" ADD CONSTRAINT "goals_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "homebase"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homebase"."goals" ADD CONSTRAINT "goals_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "homebase"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homebase"."goals" ADD CONSTRAINT "goals_reward_id_rewards_id_fk" FOREIGN KEY ("reward_id") REFERENCES "homebase"."rewards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homebase"."invites" ADD CONSTRAINT "invites_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "homebase"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homebase"."invites" ADD CONSTRAINT "invites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "homebase"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homebase"."invites" ADD CONSTRAINT "invites_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "homebase"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homebase"."ledger" ADD CONSTRAINT "ledger_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "homebase"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homebase"."ledger" ADD CONSTRAINT "ledger_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "homebase"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homebase"."media" ADD CONSTRAINT "media_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "homebase"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homebase"."media" ADD CONSTRAINT "media_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "homebase"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homebase"."media_blobs" ADD CONSTRAINT "media_blobs_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "homebase"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homebase"."media_blobs" ADD CONSTRAINT "media_blobs_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "homebase"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homebase"."memberships" ADD CONSTRAINT "memberships_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "homebase"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homebase"."memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "homebase"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homebase"."milestones" ADD CONSTRAINT "milestones_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "homebase"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homebase"."milestones" ADD CONSTRAINT "milestones_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "homebase"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homebase"."milestones" ADD CONSTRAINT "milestones_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "homebase"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homebase"."operations" ADD CONSTRAINT "operations_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "homebase"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homebase"."pair_codes" ADD CONSTRAINT "pair_codes_claimed_by_users_id_fk" FOREIGN KEY ("claimed_by") REFERENCES "homebase"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homebase"."pair_codes" ADD CONSTRAINT "pair_codes_claimed_household_households_id_fk" FOREIGN KEY ("claimed_household") REFERENCES "homebase"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homebase"."profiles" ADD CONSTRAINT "profiles_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "homebase"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homebase"."recovery_codes" ADD CONSTRAINT "recovery_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "homebase"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homebase"."redemptions" ADD CONSTRAINT "redemptions_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "homebase"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homebase"."redemptions" ADD CONSTRAINT "redemptions_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "homebase"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homebase"."redemptions" ADD CONSTRAINT "redemptions_reward_id_rewards_id_fk" FOREIGN KEY ("reward_id") REFERENCES "homebase"."rewards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homebase"."rewards" ADD CONSTRAINT "rewards_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "homebase"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homebase"."routine_runs" ADD CONSTRAINT "routine_runs_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "homebase"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homebase"."routine_runs" ADD CONSTRAINT "routine_runs_routine_id_routines_id_fk" FOREIGN KEY ("routine_id") REFERENCES "homebase"."routines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homebase"."routine_runs" ADD CONSTRAINT "routine_runs_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "homebase"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homebase"."routine_step_events" ADD CONSTRAINT "routine_step_events_run_id_routine_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "homebase"."routine_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homebase"."routine_step_events" ADD CONSTRAINT "routine_step_events_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "homebase"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homebase"."routine_versions" ADD CONSTRAINT "routine_versions_routine_id_routines_id_fk" FOREIGN KEY ("routine_id") REFERENCES "homebase"."routines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homebase"."routine_versions" ADD CONSTRAINT "routine_versions_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "homebase"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homebase"."routines" ADD CONSTRAINT "routines_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "homebase"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homebase"."sessions" ADD CONSTRAINT "sessions_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "homebase"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homebase"."sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "homebase"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homebase"."sessions" ADD CONSTRAINT "sessions_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "homebase"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homebase"."sessions" ADD CONSTRAINT "sessions_unlocked_by_users_id_fk" FOREIGN KEY ("unlocked_by") REFERENCES "homebase"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homebase"."shopping_item_history" ADD CONSTRAINT "shopping_item_history_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "homebase"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homebase"."shopping_item_history" ADD CONSTRAINT "shopping_item_history_item_id_shopping_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "homebase"."shopping_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homebase"."shopping_items" ADD CONSTRAINT "shopping_items_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "homebase"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homebase"."shopping_items" ADD CONSTRAINT "shopping_items_list_id_shopping_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "homebase"."shopping_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homebase"."shopping_items" ADD CONSTRAINT "shopping_items_requested_by_profiles_id_fk" FOREIGN KEY ("requested_by") REFERENCES "homebase"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homebase"."shopping_lists" ADD CONSTRAINT "shopping_lists_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "homebase"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homebase"."shortcut_tokens" ADD CONSTRAINT "shortcut_tokens_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "homebase"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homebase"."shortcut_tokens" ADD CONSTRAINT "shortcut_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "homebase"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homebase"."task_occurrences" ADD CONSTRAINT "task_occurrences_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "homebase"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homebase"."task_occurrences" ADD CONSTRAINT "task_occurrences_template_id_task_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "homebase"."task_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homebase"."task_occurrences" ADD CONSTRAINT "task_occurrences_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "homebase"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homebase"."task_occurrences" ADD CONSTRAINT "task_occurrences_done_by_profiles_id_fk" FOREIGN KEY ("done_by") REFERENCES "homebase"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homebase"."task_template_versions" ADD CONSTRAINT "task_template_versions_template_id_task_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "homebase"."task_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homebase"."task_template_versions" ADD CONSTRAINT "task_template_versions_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "homebase"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homebase"."task_templates" ADD CONSTRAINT "task_templates_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "homebase"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homebase"."wallets" ADD CONSTRAINT "wallets_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "homebase"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homebase"."wallets" ADD CONSTRAINT "wallets_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "homebase"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homebase"."weather_cache" ADD CONSTRAINT "weather_cache_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "homebase"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homebase"."weekly_totals" ADD CONSTRAINT "weekly_totals_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "homebase"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homebase"."weekly_totals" ADD CONSTRAINT "weekly_totals_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "homebase"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "academy_links_player_key" ON "homebase"."academy_links" USING btree ("household_id","player_id");--> statement-breakpoint
CREATE INDEX "academy_sessions_profile_idx" ON "homebase"."academy_sessions" USING btree ("profile_id","local_date");--> statement-breakpoint
CREATE INDEX "ai_proposals_household_idx" ON "homebase"."ai_proposals" USING btree ("household_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_usage_household_idx" ON "homebase"."ai_usage" USING btree ("household_id","local_date");--> statement-breakpoint
CREATE INDEX "audit_household_idx" ON "homebase"."audit" USING btree ("household_id","at");--> statement-breakpoint
CREATE INDEX "badges_household_idx" ON "homebase"."badges" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "calendar_rules_household_idx" ON "homebase"."calendar_rules" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "connections_household_idx" ON "homebase"."connections" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "devices_household_idx" ON "homebase"."devices" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "events_day_idx" ON "homebase"."events" USING btree ("household_id","local_date");--> statement-breakpoint
CREATE INDEX "events_kind_idx" ON "homebase"."events" USING btree ("household_id","kind","local_date");--> statement-breakpoint
CREATE UNIQUE INDEX "invites_code_key" ON "homebase"."invites" USING btree ("code_hash");--> statement-breakpoint
CREATE INDEX "invites_household_idx" ON "homebase"."invites" USING btree ("household_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_idempotency_key" ON "homebase"."ledger" USING btree ("household_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "ledger_profile_idx" ON "homebase"."ledger" USING btree ("profile_id","at");--> statement-breakpoint
CREATE INDEX "media_household_idx" ON "homebase"."media" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "media_blobs_household_idx" ON "homebase"."media_blobs" USING btree ("household_id");--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_household_user_key" ON "homebase"."memberships" USING btree ("household_id","user_id");--> statement-breakpoint
CREATE INDEX "memberships_user_idx" ON "homebase"."memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "milestones_household_idx" ON "homebase"."milestones" USING btree ("household_id","local_date");--> statement-breakpoint
CREATE INDEX "operations_created_idx" ON "homebase"."operations" USING btree ("household_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "pair_codes_code_key" ON "homebase"."pair_codes" USING btree ("code_hash");--> statement-breakpoint
CREATE INDEX "profiles_household_idx" ON "homebase"."profiles" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "recovery_codes_user_idx" ON "homebase"."recovery_codes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "redemptions_household_idx" ON "homebase"."redemptions" USING btree ("household_id","status");--> statement-breakpoint
CREATE INDEX "rewards_household_idx" ON "homebase"."rewards" USING btree ("household_id");--> statement-breakpoint
CREATE UNIQUE INDEX "routine_runs_once_key" ON "homebase"."routine_runs" USING btree ("routine_id","profile_id","local_date");--> statement-breakpoint
CREATE INDEX "routine_runs_day_idx" ON "homebase"."routine_runs" USING btree ("household_id","local_date");--> statement-breakpoint
CREATE INDEX "routine_step_events_household_idx" ON "homebase"."routine_step_events" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "routine_versions_household_idx" ON "homebase"."routine_versions" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "routines_household_idx" ON "homebase"."routines" USING btree ("household_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_key" ON "homebase"."sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_household_idx" ON "homebase"."sessions" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "shopping_item_history_item_idx" ON "homebase"."shopping_item_history" USING btree ("item_id","at");--> statement-breakpoint
CREATE INDEX "shopping_item_history_household_idx" ON "homebase"."shopping_item_history" USING btree ("household_id","at");--> statement-breakpoint
CREATE INDEX "shopping_items_list_idx" ON "homebase"."shopping_items" USING btree ("household_id","list_id","status");--> statement-breakpoint
CREATE INDEX "shopping_items_normalized_idx" ON "homebase"."shopping_items" USING btree ("household_id","normalized");--> statement-breakpoint
CREATE INDEX "shopping_lists_household_idx" ON "homebase"."shopping_lists" USING btree ("household_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shortcut_tokens_token_key" ON "homebase"."shortcut_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "shortcut_tokens_household_idx" ON "homebase"."shortcut_tokens" USING btree ("household_id");--> statement-breakpoint
CREATE UNIQUE INDEX "task_occurrences_once_key" ON "homebase"."task_occurrences" USING btree ("template_id","local_date",coalesce("profile_id", '00000000-0000-0000-0000-000000000000'::uuid));--> statement-breakpoint
CREATE INDEX "task_occurrences_day_idx" ON "homebase"."task_occurrences" USING btree ("household_id","local_date");--> statement-breakpoint
CREATE INDEX "task_occurrences_status_idx" ON "homebase"."task_occurrences" USING btree ("household_id","status");--> statement-breakpoint
CREATE INDEX "task_template_versions_household_idx" ON "homebase"."task_template_versions" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "task_templates_household_idx" ON "homebase"."task_templates" USING btree ("household_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "homebase"."users" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "wallets_household_idx" ON "homebase"."wallets" USING btree ("household_id");