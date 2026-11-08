CREATE TABLE "blobs" (
	"id" text PRIMARY KEY NOT NULL,
	"size" bigint NOT NULL,
	"mime" text NOT NULL,
	"width" integer,
	"height" integer,
	"create_date" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"role" text DEFAULT 'page' NOT NULL,
	"kind" text,
	"unity_name" text,
	"title" text DEFAULT '' NOT NULL,
	"attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"tags" bigint[] DEFAULT '{}' NOT NULL,
	"parent_id" bigint,
	"order_index" double precision DEFAULT 0 NOT NULL,
	"blob_id" text,
	"target_id" bigint,
	"create_date" timestamp with time zone DEFAULT now() NOT NULL,
	"update_date" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "items_role_check" CHECK (
    "items"."role" IN ('page', 'entity', 'textline', 'image', 'file', 'itemlink', 'tag', 'database')
  ),
	CONSTRAINT "items_entity_kind_check" CHECK (
    ("items"."role" = 'entity') = ("items"."kind" IS NOT NULL)
  ),
	CONSTRAINT "items_itemlink_target_check" CHECK (
    ("items"."role" = 'itemlink') = ("items"."target_id" IS NOT NULL)
  ),
	CONSTRAINT "items_blob_role_check" CHECK (
    ("items"."role" IN ('file', 'image')) = ("items"."blob_id" IS NOT NULL)
  ),
	CONSTRAINT "items_attributes_object_check" CHECK (
    jsonb_typeof("items"."attributes") = 'object'
  ),
	CONSTRAINT "items_tags_no_null_check" CHECK (
    array_position("items"."tags", NULL) IS NULL
  ),
	CONSTRAINT "items_order_index_finite_check" CHECK (
    abs("items"."order_index") < 'Infinity'::double precision
  ),
	CONSTRAINT "items_kind_format_check" CHECK (
    "items"."kind" IS NULL OR "items"."kind" ~ '^[a-z][a-z0-9._-]{0,63}$'
  ),
	CONSTRAINT "items_unity_name_format_check" CHECK (
    "items"."unity_name" IS NULL OR "items"."unity_name" ~ '^[a-z][a-z0-9._-]{0,199}$'
  )
);
--> statement-breakpoint
CREATE TABLE "thumbnails" (
	"image_id" bigint NOT NULL,
	"size" smallint NOT NULL,
	"blob_id" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"create_date" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "thumbnails_image_id_size_pk" PRIMARY KEY("image_id","size"),
	CONSTRAINT "thumbnails_size_check" CHECK (
    "thumbnails"."size" IN (96, 384, 800, 1440)
  )
);
--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_parent_id_items_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_blob_id_blobs_id_fk" FOREIGN KEY ("blob_id") REFERENCES "public"."blobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thumbnails" ADD CONSTRAINT "thumbnails_image_id_items_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thumbnails" ADD CONSTRAINT "thumbnails_blob_id_blobs_id_fk" FOREIGN KEY ("blob_id") REFERENCES "public"."blobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "blobs_create_date_idx" ON "blobs" USING btree ("create_date");--> statement-breakpoint
CREATE INDEX "items_parent_idx" ON "items" USING btree ("parent_id","order_index","id");--> statement-breakpoint
CREATE INDEX "items_role_idx" ON "items" USING btree ("role");--> statement-breakpoint
CREATE INDEX "items_kind_idx" ON "items" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "items_tags_gin_idx" ON "items" USING gin ("tags");--> statement-breakpoint
CREATE INDEX "items_create_date_idx" ON "items" USING btree ("create_date");--> statement-breakpoint
CREATE INDEX "items_update_date_idx" ON "items" USING btree ("update_date");--> statement-breakpoint
CREATE INDEX "items_blob_id_idx" ON "items" USING btree ("blob_id");--> statement-breakpoint
CREATE INDEX "items_target_id_idx" ON "items" USING btree ("target_id");--> statement-breakpoint
CREATE UNIQUE INDEX "items_tag_title_unique_idx" ON "items" USING btree (lower("title")) WHERE "items"."role" = 'tag';--> statement-breakpoint
CREATE UNIQUE INDEX "items_unity_name_unique_idx" ON "items" USING btree ("unity_name") WHERE "items"."unity_name" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "thumbnails_blob_id_idx" ON "thumbnails" USING btree ("blob_id");