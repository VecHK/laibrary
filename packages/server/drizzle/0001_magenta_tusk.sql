ALTER TABLE "items" DROP CONSTRAINT "items_role_check";--> statement-breakpoint
UPDATE "items" SET "role" = 'text-block' WHERE "role" = 'textline';--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_role_check" CHECK (
    "items"."role" IN ('page', 'entity', 'text-block', 'text-heading-1', 'text-heading-2', 'text-heading-3', 'image', 'file', 'itemlink', 'tag', 'database')
  );