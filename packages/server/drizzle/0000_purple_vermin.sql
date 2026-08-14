CREATE TABLE "items" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"role" text DEFAULT 'item' NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"tags" bigint[] DEFAULT '{}' NOT NULL,
	"parent_id" bigint,
	"order_index" double precision DEFAULT 0 NOT NULL,
	"create_date" timestamp with time zone DEFAULT now() NOT NULL,
	"update_date" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_parent_id_items_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "items_parent_idx" ON "items" USING btree ("parent_id","order_index");--> statement-breakpoint
CREATE INDEX "items_role_idx" ON "items" USING btree ("role");--> statement-breakpoint
CREATE INDEX "items_tags_gin_idx" ON "items" USING gin ("tags");--> statement-breakpoint
CREATE INDEX "items_create_date_idx" ON "items" USING btree ("create_date");--> statement-breakpoint
CREATE INDEX "items_update_date_idx" ON "items" USING btree ("update_date");--> statement-breakpoint
CREATE UNIQUE INDEX "items_tag_title_unique_idx" ON "items" USING btree (lower("title")) WHERE "items"."role" = 'tag';