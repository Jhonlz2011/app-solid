CREATE TABLE "auth_menu_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "auth_menu_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"key" text NOT NULL,
	"label" text NOT NULL,
	"icon" text,
	"path" text,
	"parent_id" integer,
	"sort_order" integer DEFAULT 0,
	"permission_prefix" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "auth_menu_items_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "auth_menu_items" ADD CONSTRAINT "auth_menu_items_parent_id_auth_menu_items_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."auth_menu_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_menu_parent" ON "auth_menu_items" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "idx_menu_order" ON "auth_menu_items" USING btree ("parent_id","sort_order");--> statement-breakpoint
CREATE INDEX "idx_menu_active" ON "auth_menu_items" USING btree ("is_active");