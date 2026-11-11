ALTER TABLE "items" DROP CONSTRAINT "items_role_check";--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_role_check" CHECK (
    "items"."role" IN ('page', 'entity', 'text-block', 'text-heading-1', 'text-heading-2', 'text-heading-3', 'text-list', 'text-todo', 'image', 'file', 'itemlink', 'tag', 'database')
  );