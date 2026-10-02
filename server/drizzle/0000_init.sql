CREATE TABLE "group_setlists" (
	"group_id" text NOT NULL,
	"setlist_id" text NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "group_setlists_group_id_setlist_id_pk" PRIMARY KEY("group_id","setlist_id")
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" text PRIMARY KEY NOT NULL,
	"group_name" text NOT NULL,
	"created_by" text,
	"last_updated_by" text,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "groups_id_object_id" CHECK ("groups"."id" ~ '^[0-9a-f]{24}$')
);
--> statement-breakpoint
CREATE TABLE "ownership_groups" (
	"ownership_id" text NOT NULL,
	"position" integer NOT NULL,
	"entry_name" text,
	"entry_created_at" text,
	"group_id" text,
	CONSTRAINT "ownership_groups_ownership_id_position_pk" PRIMARY KEY("ownership_id","position")
);
--> statement-breakpoint
CREATE TABLE "ownership_setlists" (
	"ownership_id" text NOT NULL,
	"position" integer NOT NULL,
	"entry_name" text,
	"entry_created_at" text,
	"setlist_id" text,
	CONSTRAINT "ownership_setlists_ownership_id_position_pk" PRIMARY KEY("ownership_id","position")
);
--> statement-breakpoint
CREATE TABLE "ownerships" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"full_name" text NOT NULL,
	"access_type" text DEFAULT 'unsigned' NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ownerships_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "ownerships_id_object_id" CHECK ("ownerships"."id" ~ '^[0-9a-f]{24}$')
);
--> statement-breakpoint
CREATE TABLE "setlist_song_keys" (
	"setlist_id" text NOT NULL,
	"song_id" text NOT NULL,
	"key" text NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "setlist_song_keys_setlist_id_song_id_pk" PRIMARY KEY("setlist_id","song_id"),
	CONSTRAINT "setlist_song_keys_key_music_key" CHECK ("setlist_song_keys"."key" in ('A', 'A#', 'Bb', 'B', 'C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab'))
);
--> statement-breakpoint
CREATE TABLE "setlist_songs" (
	"setlist_id" text NOT NULL,
	"position" integer NOT NULL,
	"song_id" text NOT NULL,
	CONSTRAINT "setlist_songs_setlist_id_position_pk" PRIMARY KEY("setlist_id","position")
);
--> statement-breakpoint
CREATE TABLE "setlists" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"date" timestamp with time zone,
	"created_by" text,
	"last_updated_by" text,
	"public_link" text,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "setlists_public_link_unique" UNIQUE("public_link"),
	CONSTRAINT "setlists_id_object_id" CHECK ("setlists"."id" ~ '^[0-9a-f]{24}$')
);
--> statement-breakpoint
CREATE TABLE "songs" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"tempo" text[] DEFAULT '{}' NOT NULL,
	"original_key" text NOT NULL,
	"recommended_keys" text[] DEFAULT '{}' NOT NULL,
	"themes" text[] DEFAULT '{}' NOT NULL,
	"artist" text NOT NULL,
	"year" text,
	"code" text,
	"created_by" text,
	"last_updated_by" text,
	"time_signature" text[] DEFAULT '{}' NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"chord_lyrics" text NOT NULL,
	"simplified_chord_lyrics" text,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "songs_id_object_id" CHECK ("songs"."id" ~ '^[0-9a-f]{24}$')
);
--> statement-breakpoint
ALTER TABLE "group_setlists" ADD CONSTRAINT "group_setlists_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_setlists" ADD CONSTRAINT "group_setlists_setlist_id_setlists_id_fk" FOREIGN KEY ("setlist_id") REFERENCES "public"."setlists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ownership_groups" ADD CONSTRAINT "ownership_groups_ownership_id_ownerships_id_fk" FOREIGN KEY ("ownership_id") REFERENCES "public"."ownerships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ownership_setlists" ADD CONSTRAINT "ownership_setlists_ownership_id_ownerships_id_fk" FOREIGN KEY ("ownership_id") REFERENCES "public"."ownerships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "setlist_song_keys" ADD CONSTRAINT "setlist_song_keys_setlist_id_setlists_id_fk" FOREIGN KEY ("setlist_id") REFERENCES "public"."setlists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "setlist_song_keys" ADD CONSTRAINT "setlist_song_keys_song_id_songs_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "setlist_songs" ADD CONSTRAINT "setlist_songs_setlist_id_setlists_id_fk" FOREIGN KEY ("setlist_id") REFERENCES "public"."setlists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "setlist_songs" ADD CONSTRAINT "setlist_songs_song_id_songs_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "group_setlists_setlist_id_idx" ON "group_setlists" USING btree ("setlist_id");--> statement-breakpoint
CREATE INDEX "ownership_groups_group_id_idx" ON "ownership_groups" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "setlist_song_keys_song_id_idx" ON "setlist_song_keys" USING btree ("song_id");--> statement-breakpoint
CREATE INDEX "setlist_songs_song_id_idx" ON "setlist_songs" USING btree ("song_id");--> statement-breakpoint
CREATE INDEX "setlists_created_by_idx" ON "setlists" USING btree ("created_by");