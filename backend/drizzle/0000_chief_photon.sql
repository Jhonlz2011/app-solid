CREATE TYPE "public"."attribute_data_type" AS ENUM('TEXT', 'NUMBER', 'SELECT', 'BOOLEAN');--> statement-breakpoint
CREATE TYPE "public"."bom_calculation_type" AS ENUM('FIXED', 'AREA', 'PERIMETER', 'VOLUMEN');--> statement-breakpoint
CREATE TYPE "public"."condition" AS ENUM('GOOD', 'DAMAGED', 'UNUSABLE');--> statement-breakpoint
CREATE TYPE "public"."document_type" AS ENUM('INVOICE', 'CREDIT_NOTE', 'DEBIT_NOTE', 'REMISSION_GUIDE', 'PURCHASE_LIQUIDATION', 'WITHHOLDING');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('DRAFT', 'SIGNED', 'SENDING', 'AUTHORIZED', 'ANNULLED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."justification_type" AS ENUM('LIBRE', 'FALTA', 'IESS', 'VACACIONES', 'FERIADO', 'SAB', 'DOM');--> statement-breakpoint
CREATE TYPE "public"."location_type" AS ENUM('VIEW', 'INTERNAL', 'SUPPLIER', 'CUSTOMER', 'ADJUSTMENT', 'PRODUCTION');--> statement-breakpoint
CREATE TYPE "public"."material_request_status" AS ENUM('PENDING', 'APPROVED', 'IN_TRANSIT', 'RECEIVED', 'COMPLETED');--> statement-breakpoint
CREATE TYPE "public"."movement_reference_type" AS ENUM('INVOICE', 'PURCHASE_ORDER', 'MANUFACTURING_ORDER', 'MATERIAL_REQUEST', 'ADJUSTMENT', 'POS_SALE', 'RETURN');--> statement-breakpoint
CREATE TYPE "public"."movement_type" AS ENUM('PURCHASE', 'SALE', 'PRODUCTION_CONSUMPTION', 'PRODUCTION_OUTPUT', 'ADJUSTMENT', 'TRANSFER_OUT', 'TRANSFER_IN');--> statement-breakpoint
CREATE TYPE "public"."payment_method_sri" AS ENUM('01', '15', '16', '17', '18', '19', '20', '21');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('PENDING', 'PARTIAL', 'PAID', 'OVERDUE', 'WRITTEN_OFF');--> statement-breakpoint
CREATE TYPE "public"."person_type" AS ENUM('NATURAL', 'JURIDICA');--> statement-breakpoint
CREATE TYPE "public"."pos_session_status" AS ENUM('OPEN', 'CLOSED', 'RECONCILED');--> statement-breakpoint
CREATE TYPE "public"."price_change_source" AS ENUM('PURCHASE_ORDER', 'GOODS_RECEIPT', 'MANUAL', 'IMPORT');--> statement-breakpoint
CREATE TYPE "public"."price_change_type" AS ENUM('COST', 'SALE');--> statement-breakpoint
CREATE TYPE "public"."product_subtype" AS ENUM('SIMPLE', 'COMPUESTO', 'FABRICADO');--> statement-breakpoint
CREATE TYPE "public"."product_type" AS ENUM('PRODUCTO', 'SERVICIO');--> statement-breakpoint
CREATE TYPE "public"."production_status" AS ENUM('PLANNED', 'IN_CUTTING', 'ASSEMBLY', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."purchase_order_status" AS ENUM('DRAFT', 'SENT', 'PARTIAL', 'RECEIVED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."purchase_quote_status" AS ENUM('DRAFT', 'SENT', 'APPROVED', 'REJECTED', 'CONVERTED_TO_PO');--> statement-breakpoint
CREATE TYPE "public"."quotation_status" AS ENUM('DRAFT', 'SENT', 'APPROVED', 'REJECTED', 'CONVERTED_TO_WO');--> statement-breakpoint
CREATE TYPE "public"."request_destination" AS ENUM('WORKSHOP', 'FIELD_SITE');--> statement-breakpoint
CREATE TYPE "public"."retention_type" AS ENUM('IVA', 'RENTA', 'ISD');--> statement-breakpoint
CREATE TYPE "public"."tax_id_type" AS ENUM('RUC', 'CEDULA', 'PASAPORTE', 'CONSUMIDOR_FINAL', 'EXTERIOR');--> statement-breakpoint
CREATE TYPE "public"."tax_regime_type" AS ENUM('RIMPE_NEGOCIO_POPULAR', 'RIMPE_EMPRENDEDOR', 'GENERAL');--> statement-breakpoint
CREATE TYPE "public"."technical_visit_status" AS ENUM('SCHEDULED', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."uom_group" AS ENUM('VOLUMEN', 'LONGITUD', 'PESO', 'AREA', 'CANTIDAD', 'TIEMPO', 'DATA');--> statement-breakpoint
CREATE TYPE "public"."work_order_status" AS ENUM('DRAFT', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'INVOICED');--> statement-breakpoint
CREATE TYPE "public"."audit_action" AS ENUM('INSERT', 'UPDATE', 'DELETE', 'LOGIN', 'EXPORT');--> statement-breakpoint
CREATE TABLE "carrier_drivers" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "carrier_drivers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"carrier_id" integer NOT NULL,
	"identification_number" text NOT NULL,
	"full_name" text NOT NULL,
	"phone" text,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "carrier_vehicles" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "carrier_vehicles_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"carrier_id" integer NOT NULL,
	"license_plate" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee_details" (
	"entity_id" integer PRIMARY KEY NOT NULL,
	"department" text,
	"job_title" text,
	"salary_base" numeric(10, 2),
	"hire_date" date,
	"cost_per_hour" numeric(10, 2)
);
--> statement-breakpoint
CREATE TABLE "entities" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "entities_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"company_id" integer NOT NULL,
	"tax_id" text NOT NULL,
	"tax_id_type" "tax_id_type" NOT NULL,
	"person_type" "person_type" DEFAULT 'NATURAL' NOT NULL,
	"business_name" text NOT NULL,
	"trade_name" text,
	"email_billing" text,
	"phone" text,
	"is_client" boolean DEFAULT false,
	"is_supplier" boolean DEFAULT false,
	"is_employee" boolean DEFAULT false,
	"is_carrier" boolean DEFAULT false,
	"tax_regime_type" "tax_regime_type" DEFAULT 'GENERAL',
	"is_retention_agent" boolean DEFAULT false,
	"is_special_contributor" boolean DEFAULT false,
	"obligado_contabilidad" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "entities" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "entity_addresses" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "entity_addresses_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"entity_id" integer NOT NULL,
	"address_line" text NOT NULL,
	"country" text DEFAULT 'Ecuador' NOT NULL,
	"country_code" text DEFAULT 'EC',
	"state" text,
	"city" text,
	"parish" text,
	"postal_code" text,
	"is_main" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "entity_contacts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "entity_contacts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"entity_id" integer NOT NULL,
	"name" text NOT NULL,
	"position" text,
	"email" text,
	"phone" text,
	"is_primary" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "companies_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"ruc" text NOT NULL,
	"business_name" text NOT NULL,
	"trade_name" text,
	"main_address" text NOT NULL,
	"business_type" text,
	"plan" text DEFAULT 'free' NOT NULL,
	"plan_expires_at" timestamp with time zone,
	"obligado_contabilidad" boolean DEFAULT false NOT NULL,
	"contribuyente_especial" text,
	"agente_retencion" text,
	"rimpe_type" text,
	"sri_environment" text DEFAULT '2' NOT NULL,
	"logo_url" text,
	"primary_color" text DEFAULT '#2563eb' NOT NULL,
	"secondary_color" text DEFAULT '#64748b' NOT NULL,
	"login_bg_url" text,
	"email" text,
	"phone" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "companies_slug_unique" UNIQUE("slug"),
	CONSTRAINT "companies_ruc_unique" UNIQUE("ruc")
);
--> statement-breakpoint
CREATE TABLE "sri_certificates" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sri_certificates_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"company_id" integer NOT NULL,
	"label" text NOT NULL,
	"file_path" text NOT NULL,
	"password_encrypted" text NOT NULL,
	"issued_to" text,
	"valid_from" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sri_certificates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sri_establishments" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sri_establishments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"company_id" integer NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"emission_points" text[] NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unq_sri_estab_code" UNIQUE("company_id","code")
);
--> statement-breakpoint
ALTER TABLE "sri_establishments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "uom" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "uom_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" text NOT NULL,
	"name" text NOT NULL,
	"uom_group" "uom_group" NOT NULL,
	"base_factor" numeric(15, 8),
	"company_id" integer,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unq_uom_code_company" UNIQUE("code","company_id")
);
--> statement-breakpoint
ALTER TABLE "uom" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "attribute_definitions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "attribute_definitions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"company_id" integer NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"type" "attribute_data_type" NOT NULL,
	"default_options" jsonb,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unq_attr_key_company" UNIQUE("company_id","key")
);
--> statement-breakpoint
ALTER TABLE "attribute_definitions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "brands" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "brands_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"company_id" integer NOT NULL,
	"name" text NOT NULL,
	"website" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unq_brand_name_company" UNIQUE("company_id","name")
);
--> statement-breakpoint
ALTER TABLE "brands" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "categories" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "categories_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"company_id" integer NOT NULL,
	"name" text NOT NULL,
	"parent_id" integer,
	"description" text,
	"icon" text,
	"name_template" text,
	"path" "ltree" NOT NULL,
	"depth" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0,
	"requires_return" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	CONSTRAINT "unq_category_name_parent" UNIQUE("company_id","name","parent_id")
);
--> statement-breakpoint
ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "category_attributes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "category_attributes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"category_id" integer NOT NULL,
	"attribute_def_id" integer NOT NULL,
	"required" boolean DEFAULT false,
	"order" integer DEFAULT 0,
	"specific_options" jsonb,
	CONSTRAINT "unq_cat_attr" UNIQUE("category_id","attribute_def_id")
);
--> statement-breakpoint
CREATE TABLE "auth_menu_items" (
	"id" smallint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "auth_menu_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 32767 START WITH 1 CACHE 1),
	"key" text NOT NULL,
	"label" text NOT NULL,
	"icon" text,
	"path" text,
	"parent_id" smallint,
	"sort_order" smallint DEFAULT 0,
	"permission_prefix" text,
	"is_active" boolean DEFAULT true,
	CONSTRAINT "auth_menu_items_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "auth_permissions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "auth_permissions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"module" text NOT NULL,
	"action" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	CONSTRAINT "auth_permissions_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "auth_role_permissions" (
	"role_id" integer NOT NULL,
	"permission_id" integer NOT NULL,
	CONSTRAINT "auth_role_permissions_role_id_permission_id_pk" PRIMARY KEY("role_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE "auth_roles" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "auth_roles_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"company_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_system" boolean DEFAULT false,
	"priority" smallint DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth_roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "auth_user_roles" (
	"user_id" integer NOT NULL,
	"role_id" integer NOT NULL,
	CONSTRAINT "auth_user_roles_user_id_role_id_pk" PRIMARY KEY("user_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "auth_users" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "auth_users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"company_id" integer NOT NULL,
	"entity_id" integer,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"is_active" boolean DEFAULT true,
	"is_owner" boolean DEFAULT false NOT NULL,
	"email_verified_at" timestamp with time zone,
	"last_login" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth_users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "auth_verification_tokens" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "auth_verification_tokens_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"company_id" integer NOT NULL,
	"user_agent" text,
	"ip_address" "inet",
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid NOT NULL,
	"company_id" integer,
	"table_name" varchar(64) NOT NULL,
	"record_id" varchar(128) NOT NULL,
	"action" "audit_action" NOT NULL,
	"old_data" jsonb,
	"new_data" jsonb,
	"user_id" integer,
	"ip_address" "inet",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_logs_id_created_at_pk" PRIMARY KEY("id","created_at")
) PARTITION BY RANGE ("created_at");

CREATE TABLE IF NOT EXISTS "audit_logs_default" PARTITION OF "audit_logs" DEFAULT;
--> statement-breakpoint
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "_audit_queue" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "_audit_queue_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1 CYCLE),
	"company_id" integer,
	"table_name" text NOT NULL,
	"record_id" text NOT NULL,
	"action" text NOT NULL,
	"old_data" jsonb,
	"new_data" jsonb,
	"user_id" text,
	"ip_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_components" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "product_components_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"parent_product_id" integer NOT NULL,
	"component_product_id" integer NOT NULL,
	"quantity_per_parent" numeric(6, 2) NOT NULL,
	"is_reversible" boolean DEFAULT true,
	"notes" text,
	CONSTRAINT "unq_prod_component" UNIQUE("parent_product_id","component_product_id")
);
--> statement-breakpoint
CREATE TABLE "product_uom_conversions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "product_uom_conversions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"product_id" integer NOT NULL,
	"from_uom" integer NOT NULL,
	"to_uom" integer NOT NULL,
	"conversion_factor" numeric(15, 8) NOT NULL,
	"is_exact" boolean DEFAULT true,
	"notes" text,
	CONSTRAINT "unq_prod_uom_conv" UNIQUE("product_id","from_uom","to_uom")
);
--> statement-breakpoint
CREATE TABLE "product_variants" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "product_variants_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"product_id" integer NOT NULL,
	"sku" text NOT NULL,
	"variant_name" text,
	"variant_attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"content_quantity" numeric(12, 4) DEFAULT '1' NOT NULL,
	"sale_uom_id" integer,
	"base_price" numeric(12, 4),
	"last_cost" numeric(12, 4) DEFAULT '0',
	"barcode" text,
	"image_urls" text[],
	"std_length_cm" numeric(12, 4),
	"std_width_cm" numeric(12, 4),
	"is_default" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"sort_order" integer DEFAULT 0,
	CONSTRAINT "product_variants_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "products_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"company_id" integer NOT NULL,
	"product_type" "product_type" NOT NULL,
	"product_subtype" "product_subtype",
	"category_id" integer NOT NULL,
	"brand_id" integer,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"shared_attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"extra_specs" jsonb DEFAULT '{}'::jsonb,
	"description" text,
	"image_urls" text[] DEFAULT ARRAY[]::text[],
	"uom_inventory_id" integer NOT NULL,
	"is_stockable" boolean DEFAULT true NOT NULL,
	"has_dimensional_tracking" boolean DEFAULT false,
	"min_stock_alert" numeric(12, 4) DEFAULT '0',
	"default_base_price" numeric(12, 4) DEFAULT '0',
	"iva_rate_code" integer DEFAULT 4 NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unq_product_slug_company" UNIQUE("company_id","slug"),
	CONSTRAINT "chk_iva_rate_code" CHECK (iva_rate_code IN (0, 2, 3, 4, 6, 7))
);
--> statement-breakpoint
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "variant_price_history" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "variant_price_history_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"variant_id" integer NOT NULL,
	"price_type" "price_change_type" NOT NULL,
	"old_price" numeric(12, 4),
	"new_price" numeric(12, 4) NOT NULL,
	"reference_type" "price_change_source",
	"reference_id" integer,
	"changed_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goods_receipt_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "goods_receipt_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"receipt_id" integer NOT NULL,
	"purchase_order_item_id" integer,
	"variant_id" integer NOT NULL,
	"quantity_received" numeric(12, 4) NOT NULL,
	"quantity_rejected" numeric(12, 4) DEFAULT '0',
	"unit_cost_actual" numeric(12, 4) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goods_receipts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "goods_receipts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"purchase_order_id" integer,
	"warehouse_id" integer NOT NULL,
	"received_by" integer NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"supplier_invoice_number" text,
	"supplier_invoice_date" date,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "purchase_order_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "purchase_order_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"purchase_order_id" integer NOT NULL,
	"supplier_product_id" integer NOT NULL,
	"variant_id" integer NOT NULL,
	"quantity_ordered" numeric(12, 4) NOT NULL,
	"quantity_received" numeric(12, 4) DEFAULT '0',
	"unit_price" numeric(12, 4) NOT NULL,
	"subtotal" numeric(12, 2) NOT NULL,
	"iva_rate" numeric(5, 2) DEFAULT '0',
	"iva_amount" numeric(12, 2) DEFAULT '0'
);
--> statement-breakpoint
CREATE TABLE "purchase_orders" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "purchase_orders_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"company_id" integer NOT NULL,
	"code_sequence" integer,
	"supplier_id" integer NOT NULL,
	"work_order_id" integer,
	"status" "purchase_order_status" DEFAULT 'DRAFT',
	"destination_warehouse_id" integer NOT NULL,
	"subtotal" numeric(12, 2) DEFAULT '0',
	"tax_total" numeric(12, 2) DEFAULT '0',
	"total" numeric(12, 2) DEFAULT '0',
	"expected_delivery_date" date,
	"actual_delivery_date" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "purchase_orders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "supplier_products" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "supplier_products_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"supplier_id" integer NOT NULL,
	"variant_id" integer NOT NULL,
	"supplier_sku" text,
	"supplier_product_name" text,
	"purchase_uom" integer,
	"conversion_to_inventory_factor" numeric(12, 4) DEFAULT '1',
	"agreed_price" numeric(12, 4),
	"last_purchase_date" date,
	"lead_time_days" integer,
	"min_order_quantity" numeric(12, 4),
	"is_preferred" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unq_supplier_variant" UNIQUE("supplier_id","variant_id")
);
--> statement-breakpoint
CREATE TABLE "inventory_dimensional_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "inventory_dimensional_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"location_id" integer NOT NULL,
	"variant_id" integer NOT NULL,
	"length_cm" numeric(12, 4) NOT NULL,
	"width_cm" numeric(12, 4) NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_equivalent" numeric(12, 4),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unq_dim_item_dims" UNIQUE("location_id","variant_id","length_cm","width_cm")
);
--> statement-breakpoint
CREATE TABLE "inventory_movements" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "inventory_movements_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"source_location_id" integer NOT NULL,
	"destination_location_id" integer NOT NULL,
	"variant_id" integer NOT NULL,
	"product_id" integer,
	"dimensional_item_id" integer,
	"type" "movement_type" NOT NULL,
	"quantity" numeric(12, 4) NOT NULL,
	"source_previous_stock" numeric(12, 4),
	"source_new_stock" numeric(12, 4),
	"dest_previous_stock" numeric(12, 4),
	"dest_new_stock" numeric(12, 4),
	"unit_cost" numeric(12, 4),
	"reference_id" integer,
	"reference_type" "movement_reference_type",
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_stock" (
	"location_id" integer NOT NULL,
	"variant_id" integer NOT NULL,
	"quantity_on_hand" numeric(15, 4) DEFAULT '0' NOT NULL,
	"quantity_reserved" numeric(15, 4) DEFAULT '0' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_stock_location_id_variant_id_pk" PRIMARY KEY("location_id","variant_id")
);
--> statement-breakpoint
CREATE TABLE "warehouse_locations" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "warehouse_locations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"company_id" integer NOT NULL,
	"warehouse_id" integer,
	"parent_id" integer,
	"name" text NOT NULL,
	"path" "ltree" NOT NULL,
	"type" "location_type" DEFAULT 'INTERNAL' NOT NULL,
	"depth" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true,
	CONSTRAINT "unq_location_id_company" UNIQUE("id","company_id")
);
--> statement-breakpoint
ALTER TABLE "warehouse_locations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "warehouses" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "warehouses_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"company_id" integer NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"is_mobile" boolean DEFAULT false,
	"manager_id" integer,
	"is_active" boolean DEFAULT true,
	CONSTRAINT "unq_warehouse_code_company" UNIQUE("company_id","code"),
	CONSTRAINT "unq_warehouse_id_company" UNIQUE("id","company_id")
);
--> statement-breakpoint
ALTER TABLE "warehouses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quotation_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "quotation_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"quotation_id" integer NOT NULL,
	"variant_id" integer,
	"description" text NOT NULL,
	"quantity" numeric(12, 4) DEFAULT '1',
	"unit_price" numeric(12, 4) DEFAULT '0',
	"subtotal" numeric(12, 2) DEFAULT '0',
	"iva_rate" numeric(5, 2) DEFAULT '0',
	"iva_amount" numeric(12, 2) DEFAULT '0'
);
--> statement-breakpoint
CREATE TABLE "quotations" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "quotations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code_sequence" integer,
	"client_id" integer NOT NULL,
	"technical_visit_id" integer,
	"status" "quotation_status" DEFAULT 'DRAFT',
	"total_amount" numeric(12, 2) DEFAULT '0',
	"valid_until" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer
);
--> statement-breakpoint
CREATE TABLE "technical_visits" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "technical_visits_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"client_id" integer NOT NULL,
	"assigned_employee_id" integer,
	"visit_date" timestamp with time zone NOT NULL,
	"status" "technical_visit_status" DEFAULT 'SCHEDULED',
	"notes" text,
	"evidence_files" text[] DEFAULT ARRAY[]::text[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bom_details" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "bom_details_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"bom_id" integer NOT NULL,
	"component_product_id" integer NOT NULL,
	"quantity_factor" numeric(12, 4) NOT NULL,
	"calculation_type" "bom_calculation_type" DEFAULT 'FIXED' NOT NULL,
	"wastage_percent" numeric(5, 2) DEFAULT '0',
	"formula_expression" text,
	"sort_order" integer DEFAULT 0,
	"processing_notes" text,
	"is_optional" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "bom_headers" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "bom_headers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"product_id" integer NOT NULL,
	"name" text NOT NULL,
	"source_template_id" integer,
	"revision" integer DEFAULT 1,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bom_template_details" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "bom_template_details_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"template_id" integer NOT NULL,
	"component_product_id" integer NOT NULL,
	"quantity_formula" text NOT NULL,
	"base_type" "bom_calculation_type" DEFAULT 'FIXED',
	"wastage_percent" numeric(5, 2) DEFAULT '0',
	"sort_order" integer DEFAULT 0,
	"is_optional" boolean DEFAULT false,
	"processing_notes" text
);
--> statement-breakpoint
CREATE TABLE "bom_templates" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "bom_templates_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"company_id" integer NOT NULL,
	"name" text NOT NULL,
	"category_id" integer,
	"required_variables" jsonb DEFAULT '[]'::jsonb,
	"variable_constraints" jsonb DEFAULT '{}'::jsonb,
	"description" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bom_templates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "employee_work_schedules" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "employee_work_schedules_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"employee_id" integer NOT NULL,
	"work_order_id" integer,
	"work_date" timestamp with time zone NOT NULL,
	"hours_normal" integer DEFAULT 0,
	"hours_supplementary" integer DEFAULT 0,
	"hours_extraordinary" integer DEFAULT 0,
	"hours_total" integer DEFAULT 0,
	"val_gm" numeric(6, 2) DEFAULT '0',
	"val_gt" numeric(6, 2) DEFAULT '0',
	"val_gc" numeric(6, 2) DEFAULT '0',
	"val_gh" numeric(6, 2) DEFAULT '0',
	"val_gg" numeric(6, 2) DEFAULT '0',
	"val_ga" numeric(6, 2) DEFAULT '0',
	"value_normal_hours" numeric(6, 2) DEFAULT '0',
	"value_supplementary_hours" numeric(6, 2) DEFAULT '0',
	"value_extraordinary_hours" numeric(6, 2) DEFAULT '0',
	"value_total_hours" numeric(6, 2) DEFAULT '0',
	"additional_1215" numeric(6, 2) DEFAULT '0',
	"thirteenth_salary" numeric(6, 2) DEFAULT '0',
	"fourteenth_salary" numeric(6, 2) DEFAULT '0',
	"vacations" numeric(6, 2) DEFAULT '0',
	"reserve_fund" numeric(6, 2) DEFAULT '0',
	"labor_cost" numeric(12, 2) DEFAULT '0',
	"project_expense" numeric(12, 2) DEFAULT '0',
	"total_cost" numeric(12, 2),
	"justification" "justification_type",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "manufacturing_log" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "manufacturing_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"manufacturing_order_id" integer NOT NULL,
	"variant_id" integer,
	"quantity_consumed" numeric(12, 4),
	"scrap_item_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer
);
--> statement-breakpoint
CREATE TABLE "manufacturing_order_inputs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "manufacturing_order_inputs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"manufacturing_order_id" integer NOT NULL,
	"variant_id" integer NOT NULL,
	"planned_quantity" numeric(12, 4) NOT NULL,
	"is_additional" boolean DEFAULT false,
	"added_by" integer,
	"reason" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "manufacturing_orders" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "manufacturing_orders_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"work_order_id" integer NOT NULL,
	"output_variant_id" integer NOT NULL,
	"target_quantity" numeric(12, 4) DEFAULT '1',
	"status" "production_status" DEFAULT 'PLANNED',
	"start_date" timestamp with time zone,
	"end_date" timestamp with time zone,
	"assigned_supervisor_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_order_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "work_order_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"work_order_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"quantity" numeric(12, 4) NOT NULL,
	"custom_width" numeric(10, 4),
	"custom_length" numeric(10, 4),
	"custom_thickness" numeric(10, 4),
	"requested_uom" integer
);
--> statement-breakpoint
CREATE TABLE "work_orders" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "work_orders_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"company_id" integer NOT NULL,
	"code_sequence" integer,
	"client_id" integer,
	"quotation_id" integer,
	"status" "work_order_status" DEFAULT 'DRAFT',
	"start_date" date,
	"delivery_date" date,
	"total_estimated" numeric(12, 2),
	"total_actual" numeric(12, 2),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "work_orders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "material_request_dispatches" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "material_request_dispatches_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"request_item_id" integer NOT NULL,
	"variant_id" integer NOT NULL,
	"quantity_dispatched" numeric(12, 4) NOT NULL,
	"dispatched_from_location_id" integer NOT NULL,
	"dispatched_by" integer NOT NULL,
	"dispatched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "material_request_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "material_request_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"request_id" integer NOT NULL,
	"variant_id" integer NOT NULL,
	"quantity_requested" numeric(12, 4) NOT NULL,
	"requires_return" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "material_requests" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "material_requests_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"work_order_id" integer NOT NULL,
	"requester_id" integer NOT NULL,
	"destination_type" "request_destination" DEFAULT 'WORKSHOP' NOT NULL,
	"location_detail" text,
	"status" "material_request_status" DEFAULT 'PENDING',
	"expected_return_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "request_return_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "request_return_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"return_id" integer NOT NULL,
	"original_request_item_id" integer NOT NULL,
	"variant_id" integer NOT NULL,
	"quantity_returned" numeric(12, 4) NOT NULL,
	"returned_condition" "condition",
	"scrap_dimensional_item_id" integer
);
--> statement-breakpoint
CREATE TABLE "request_returns" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "request_returns_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"request_id" integer NOT NULL,
	"return_date" timestamp with time zone DEFAULT now(),
	"received_by" integer NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "request_template_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "request_template_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"template_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"default_quantity" numeric(12, 4) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "request_templates" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "request_templates_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "credit_notes" (
	"document_id" integer PRIMARY KEY NOT NULL,
	"modified_document_id" integer NOT NULL,
	"modification_reason" text NOT NULL,
	"total_modification" numeric(12, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "debit_notes" (
	"document_id" integer PRIMARY KEY NOT NULL,
	"modified_document_id" integer NOT NULL,
	"modification_reason" text NOT NULL,
	"subtotal_vat" numeric(12, 2) DEFAULT '0',
	"subtotal_no_vat" numeric(12, 2) DEFAULT '0',
	"tax_vat_amount" numeric(12, 2) DEFAULT '0',
	"total" numeric(12, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_sequences" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "document_sequences_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"company_id" integer NOT NULL,
	"establishment" text NOT NULL,
	"emission_point" text NOT NULL,
	"document_type" text NOT NULL,
	"current_value" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "unq_seq" UNIQUE("company_id","establishment","emission_point","document_type")
);
--> statement-breakpoint
ALTER TABLE "document_sequences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "electronic_documents" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "electronic_documents_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"company_id" integer NOT NULL,
	"type" "document_type" NOT NULL,
	"sri_access_key" text,
	"sri_authorization_date" timestamp with time zone,
	"establishment" text NOT NULL,
	"emission_point" text NOT NULL,
	"sequential" integer NOT NULL,
	"issue_date" date NOT NULL,
	"entity_id" integer NOT NULL,
	"work_order_id" integer,
	"status" "invoice_status" DEFAULT 'DRAFT',
	"sri_error_message" text,
	"sri_environment" text DEFAULT '2' NOT NULL,
	"xml_version" text DEFAULT '1.0.0',
	"signature_hash" text,
	"sri_deadline" timestamp with time zone,
	"retry_count" integer DEFAULT 0,
	"emission_type" text DEFAULT '1',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "electronic_documents_sri_access_key_unique" UNIQUE("sri_access_key"),
	CONSTRAINT "unq_document_identity" UNIQUE("company_id","establishment","emission_point","sequential","type")
);
--> statement-breakpoint
ALTER TABLE "electronic_documents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "invoice_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "invoice_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"invoice_id" integer NOT NULL,
	"variant_id" integer NOT NULL,
	"description" text,
	"quantity" numeric(12, 4) NOT NULL,
	"unit_price" numeric(12, 4) NOT NULL,
	"discount" numeric(12, 2) DEFAULT '0',
	"subtotal" numeric(12, 2) NOT NULL,
	"iva_rate" numeric(5, 2) NOT NULL,
	"iva_amount" numeric(12, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_payments" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "invoice_payments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"invoice_id" integer NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"payment_date" date NOT NULL,
	"payment_method_code" "payment_method_sri" NOT NULL,
	"transaction_reference" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"document_id" integer PRIMARY KEY NOT NULL,
	"subtotal_vat" numeric(12, 2) DEFAULT '0',
	"subtotal_no_vat" numeric(12, 2) DEFAULT '0',
	"subtotal_exempt" numeric(12, 2) DEFAULT '0',
	"subtotal_no_obj" numeric(12, 2) DEFAULT '0',
	"discount_total" numeric(12, 2) DEFAULT '0',
	"tax_vat_amount" numeric(12, 2) DEFAULT '0',
	"tip_amount" numeric(12, 2) DEFAULT '0',
	"total" numeric(12, 2) NOT NULL,
	"payment_status" "payment_status" DEFAULT 'PENDING',
	"billed_to_name" text NOT NULL,
	"billed_to_address" text NOT NULL,
	"billed_to_ruc" text NOT NULL,
	"establishment_address" text,
	"currency" text DEFAULT 'DOLAR' NOT NULL,
	"additional_info" jsonb,
	"xml_content" text,
	"digital_files" text[] DEFAULT ARRAY[]::text[]
);
--> statement-breakpoint
CREATE TABLE "purchase_liquidations" (
	"document_id" integer PRIMARY KEY NOT NULL,
	"supplier_name" text NOT NULL,
	"supplier_identification" text NOT NULL,
	"supplier_identification_type" text NOT NULL,
	"supplier_address" text,
	"subtotal_vat" numeric(12, 2) DEFAULT '0',
	"subtotal_no_vat" numeric(12, 2) DEFAULT '0',
	"tax_vat_amount" numeric(12, 2) DEFAULT '0',
	"total" numeric(12, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "remission_guides" (
	"document_id" integer PRIMARY KEY NOT NULL,
	"origin_material_request_id" integer,
	"related_invoice_id" integer,
	"carrier_id" integer,
	"vehicle_plate" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"route_origin" text NOT NULL,
	"route_destination" text NOT NULL,
	"reason" text,
	"supporting_doc_type" text,
	"supporting_doc_number" text,
	"evidence_files" text[] DEFAULT ARRAY[]::text[]
);
--> statement-breakpoint
CREATE TABLE "tax_retentions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tax_retentions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"invoice_id" integer,
	"retention_type" "retention_type",
	"tax_code" text,
	"base_amount" numeric(12, 2),
	"percentage" numeric(5, 2),
	"retained_value" numeric(12, 2)
);
--> statement-breakpoint
CREATE TABLE "withholding_receipt_details" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "withholding_receipt_details_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"receipt_document_id" integer NOT NULL,
	"tax_type" "retention_type" NOT NULL,
	"tax_code" text NOT NULL,
	"base_amount" numeric(12, 2) NOT NULL,
	"percentage" numeric(5, 2) NOT NULL,
	"retained_value" numeric(12, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "withholding_receipts" (
	"document_id" integer PRIMARY KEY NOT NULL,
	"supplier_invoice_number" text NOT NULL,
	"supplier_invoice_date" date NOT NULL,
	"supplier_id" integer NOT NULL,
	"fiscal_period" text NOT NULL,
	"total_retained" numeric(12, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cash_registers" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "cash_registers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"company_id" integer NOT NULL,
	"name" text NOT NULL,
	"warehouse_id" integer,
	"default_location_id" integer,
	"establishment" text NOT NULL,
	"emission_point" text NOT NULL,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
ALTER TABLE "cash_registers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "pos_sale_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "pos_sale_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"sale_id" integer NOT NULL,
	"variant_id" integer NOT NULL,
	"location_id" integer,
	"quantity" numeric(12, 4) NOT NULL,
	"unit_price" numeric(12, 4) NOT NULL,
	"discount" numeric(12, 2) DEFAULT '0',
	"subtotal" numeric(12, 2) NOT NULL,
	"iva_rate" numeric(5, 2) NOT NULL,
	"iva_amount" numeric(12, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pos_sale_payments" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "pos_sale_payments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"sale_id" integer NOT NULL,
	"payment_method" "payment_method_sri" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"transaction_reference" text
);
--> statement-breakpoint
CREATE TABLE "pos_sales" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "pos_sales_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"session_id" integer NOT NULL,
	"client_id" integer,
	"document_id" integer,
	"subtotal" numeric(12, 2) DEFAULT '0' NOT NULL,
	"discount_total" numeric(12, 2) DEFAULT '0',
	"tax_total" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total" numeric(12, 2) NOT NULL,
	"change_given" numeric(12, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pos_sessions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "pos_sessions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"cash_register_id" integer NOT NULL,
	"opened_by" integer NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"opening_balance" numeric(12, 2) DEFAULT '0' NOT NULL,
	"closed_by" integer,
	"closed_at" timestamp with time zone,
	"closing_balance" numeric(12, 2),
	"cash_counted" numeric(12, 2),
	"difference" numeric(12, 2),
	"status" "pos_session_status" DEFAULT 'OPEN' NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "accounts_payable" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "accounts_payable_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"company_id" integer NOT NULL,
	"purchase_order_id" integer,
	"supplier_invoice_number" text,
	"supplier_invoice_date" date,
	"entity_id" integer NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"amount_paid" numeric(12, 2) DEFAULT '0' NOT NULL,
	"balance" numeric(12, 2) NOT NULL,
	"due_date" date NOT NULL,
	"status" "payment_status" DEFAULT 'PENDING' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts_payable" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "accounts_receivable" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "accounts_receivable_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"company_id" integer NOT NULL,
	"document_id" integer NOT NULL,
	"entity_id" integer NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"amount_paid" numeric(12, 2) DEFAULT '0' NOT NULL,
	"balance" numeric(12, 2) NOT NULL,
	"due_date" date NOT NULL,
	"status" "payment_status" DEFAULT 'PENDING' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts_receivable" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fiscal_periods" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "fiscal_periods_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"company_id" integer NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"is_closed" boolean DEFAULT false NOT NULL,
	"closed_by" integer,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unq_fiscal_period" UNIQUE("company_id","year","month")
);
--> statement-breakpoint
ALTER TABLE "fiscal_periods" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "purchase_quote_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "purchase_quote_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"quote_id" integer NOT NULL,
	"variant_id" integer NOT NULL,
	"description" text,
	"quantity" numeric(12, 4) NOT NULL,
	"unit_price" numeric(12, 4) NOT NULL,
	"subtotal" numeric(12, 2) NOT NULL,
	"iva_rate" numeric(5, 2) DEFAULT '0',
	"iva_amount" numeric(12, 2) DEFAULT '0',
	"purchase_uom" integer
);
--> statement-breakpoint
CREATE TABLE "purchase_quotes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "purchase_quotes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"company_id" integer NOT NULL,
	"code_sequence" integer,
	"supplier_id" integer NOT NULL,
	"status" "purchase_quote_status" DEFAULT 'DRAFT' NOT NULL,
	"subtotal" numeric(12, 2) DEFAULT '0',
	"tax_total" numeric(12, 2) DEFAULT '0',
	"total" numeric(12, 2) DEFAULT '0',
	"valid_until" date,
	"notes" text,
	"converted_po_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "purchase_quotes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "product_variant_warehouse_locations" (
	"variant_id" integer NOT NULL,
	"warehouse_id" integer NOT NULL,
	"default_location_id" integer NOT NULL,
	CONSTRAINT "product_variant_warehouse_locations_variant_id_warehouse_id_pk" PRIMARY KEY("variant_id","warehouse_id")
);
--> statement-breakpoint
ALTER TABLE "carrier_drivers" ADD CONSTRAINT "carrier_drivers_carrier_id_entities_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carrier_vehicles" ADD CONSTRAINT "carrier_vehicles_carrier_id_entities_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_details" ADD CONSTRAINT "employee_details_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entities" ADD CONSTRAINT "entities_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_addresses" ADD CONSTRAINT "entity_addresses_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_contacts" ADD CONSTRAINT "entity_contacts_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sri_certificates" ADD CONSTRAINT "sri_certificates_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sri_establishments" ADD CONSTRAINT "sri_establishments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uom" ADD CONSTRAINT "uom_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attribute_definitions" ADD CONSTRAINT "attribute_definitions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brands" ADD CONSTRAINT "brands_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_attributes" ADD CONSTRAINT "category_attributes_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_attributes" ADD CONSTRAINT "category_attributes_attribute_def_id_attribute_definitions_id_fk" FOREIGN KEY ("attribute_def_id") REFERENCES "public"."attribute_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_menu_items" ADD CONSTRAINT "auth_menu_items_parent_id_auth_menu_items_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."auth_menu_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_role_permissions" ADD CONSTRAINT "auth_role_permissions_role_id_auth_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."auth_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_role_permissions" ADD CONSTRAINT "auth_role_permissions_permission_id_auth_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."auth_permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_roles" ADD CONSTRAINT "auth_roles_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_user_roles" ADD CONSTRAINT "auth_user_roles_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_user_roles" ADD CONSTRAINT "auth_user_roles_role_id_auth_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."auth_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_users" ADD CONSTRAINT "auth_users_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_users" ADD CONSTRAINT "auth_users_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_verification_tokens" ADD CONSTRAINT "auth_verification_tokens_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_components" ADD CONSTRAINT "product_components_parent_product_id_products_id_fk" FOREIGN KEY ("parent_product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_components" ADD CONSTRAINT "product_components_component_product_id_products_id_fk" FOREIGN KEY ("component_product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_uom_conversions" ADD CONSTRAINT "product_uom_conversions_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_uom_conversions" ADD CONSTRAINT "product_uom_conversions_from_uom_uom_id_fk" FOREIGN KEY ("from_uom") REFERENCES "public"."uom"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_uom_conversions" ADD CONSTRAINT "product_uom_conversions_to_uom_uom_id_fk" FOREIGN KEY ("to_uom") REFERENCES "public"."uom"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_sale_uom_id_uom_id_fk" FOREIGN KEY ("sale_uom_id") REFERENCES "public"."uom"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_uom_inventory_id_uom_id_fk" FOREIGN KEY ("uom_inventory_id") REFERENCES "public"."uom"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_created_by_auth_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_updated_by_auth_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant_price_history" ADD CONSTRAINT "variant_price_history_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant_price_history" ADD CONSTRAINT "variant_price_history_changed_by_auth_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_receipt_id_goods_receipts_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "public"."goods_receipts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_purchase_order_item_id_purchase_order_items_id_fk" FOREIGN KEY ("purchase_order_item_id") REFERENCES "public"."purchase_order_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_received_by_auth_users_id_fk" FOREIGN KEY ("received_by") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_supplier_product_id_supplier_products_id_fk" FOREIGN KEY ("supplier_product_id") REFERENCES "public"."supplier_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_entities_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_destination_warehouse_id_warehouses_id_fk" FOREIGN KEY ("destination_warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_created_by_auth_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_products" ADD CONSTRAINT "supplier_products_supplier_id_entities_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_products" ADD CONSTRAINT "supplier_products_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_products" ADD CONSTRAINT "supplier_products_purchase_uom_uom_id_fk" FOREIGN KEY ("purchase_uom") REFERENCES "public"."uom"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_dimensional_items" ADD CONSTRAINT "inventory_dimensional_items_location_id_warehouse_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."warehouse_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_dimensional_items" ADD CONSTRAINT "inventory_dimensional_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_source_location_id_warehouse_locations_id_fk" FOREIGN KEY ("source_location_id") REFERENCES "public"."warehouse_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_destination_location_id_warehouse_locations_id_fk" FOREIGN KEY ("destination_location_id") REFERENCES "public"."warehouse_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_dimensional_item_id_inventory_dimensional_items_id_fk" FOREIGN KEY ("dimensional_item_id") REFERENCES "public"."inventory_dimensional_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_created_by_auth_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_stock" ADD CONSTRAINT "inventory_stock_location_id_warehouse_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."warehouse_locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_stock" ADD CONSTRAINT "inventory_stock_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_locations" ADD CONSTRAINT "warehouse_locations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_locations" ADD CONSTRAINT "fk_location_warehouse_tenant" FOREIGN KEY ("warehouse_id","company_id") REFERENCES "public"."warehouses"("id","company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_manager_id_entities_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_quotation_id_quotations_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "public"."quotations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_client_id_entities_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_technical_visit_id_technical_visits_id_fk" FOREIGN KEY ("technical_visit_id") REFERENCES "public"."technical_visits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_created_by_auth_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technical_visits" ADD CONSTRAINT "technical_visits_client_id_entities_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technical_visits" ADD CONSTRAINT "technical_visits_assigned_employee_id_entities_id_fk" FOREIGN KEY ("assigned_employee_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bom_details" ADD CONSTRAINT "bom_details_bom_id_bom_headers_id_fk" FOREIGN KEY ("bom_id") REFERENCES "public"."bom_headers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bom_details" ADD CONSTRAINT "bom_details_component_product_id_products_id_fk" FOREIGN KEY ("component_product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bom_headers" ADD CONSTRAINT "bom_headers_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bom_headers" ADD CONSTRAINT "bom_headers_source_template_id_bom_templates_id_fk" FOREIGN KEY ("source_template_id") REFERENCES "public"."bom_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bom_template_details" ADD CONSTRAINT "bom_template_details_template_id_bom_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."bom_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bom_template_details" ADD CONSTRAINT "bom_template_details_component_product_id_products_id_fk" FOREIGN KEY ("component_product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bom_templates" ADD CONSTRAINT "bom_templates_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bom_templates" ADD CONSTRAINT "bom_templates_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_work_schedules" ADD CONSTRAINT "employee_work_schedules_employee_id_entities_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_work_schedules" ADD CONSTRAINT "employee_work_schedules_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manufacturing_log" ADD CONSTRAINT "manufacturing_log_manufacturing_order_id_manufacturing_orders_id_fk" FOREIGN KEY ("manufacturing_order_id") REFERENCES "public"."manufacturing_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manufacturing_log" ADD CONSTRAINT "manufacturing_log_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manufacturing_log" ADD CONSTRAINT "manufacturing_log_scrap_item_id_inventory_dimensional_items_id_fk" FOREIGN KEY ("scrap_item_id") REFERENCES "public"."inventory_dimensional_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manufacturing_log" ADD CONSTRAINT "manufacturing_log_created_by_auth_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manufacturing_order_inputs" ADD CONSTRAINT "manufacturing_order_inputs_manufacturing_order_id_manufacturing_orders_id_fk" FOREIGN KEY ("manufacturing_order_id") REFERENCES "public"."manufacturing_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manufacturing_order_inputs" ADD CONSTRAINT "manufacturing_order_inputs_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manufacturing_order_inputs" ADD CONSTRAINT "manufacturing_order_inputs_added_by_auth_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manufacturing_orders" ADD CONSTRAINT "manufacturing_orders_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manufacturing_orders" ADD CONSTRAINT "manufacturing_orders_output_variant_id_product_variants_id_fk" FOREIGN KEY ("output_variant_id") REFERENCES "public"."product_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manufacturing_orders" ADD CONSTRAINT "manufacturing_orders_assigned_supervisor_id_entities_id_fk" FOREIGN KEY ("assigned_supervisor_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_items" ADD CONSTRAINT "work_order_items_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_items" ADD CONSTRAINT "work_order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_items" ADD CONSTRAINT "work_order_items_requested_uom_uom_id_fk" FOREIGN KEY ("requested_uom") REFERENCES "public"."uom"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_client_id_entities_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_quotation_id_quotations_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "public"."quotations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_request_dispatches" ADD CONSTRAINT "material_request_dispatches_request_item_id_material_request_items_id_fk" FOREIGN KEY ("request_item_id") REFERENCES "public"."material_request_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_request_dispatches" ADD CONSTRAINT "material_request_dispatches_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_request_dispatches" ADD CONSTRAINT "material_request_dispatches_dispatched_from_location_id_warehouse_locations_id_fk" FOREIGN KEY ("dispatched_from_location_id") REFERENCES "public"."warehouse_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_request_dispatches" ADD CONSTRAINT "material_request_dispatches_dispatched_by_entities_id_fk" FOREIGN KEY ("dispatched_by") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_request_items" ADD CONSTRAINT "material_request_items_request_id_material_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."material_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_request_items" ADD CONSTRAINT "material_request_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_requests" ADD CONSTRAINT "material_requests_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_requests" ADD CONSTRAINT "material_requests_requester_id_entities_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_return_items" ADD CONSTRAINT "request_return_items_return_id_request_returns_id_fk" FOREIGN KEY ("return_id") REFERENCES "public"."request_returns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_return_items" ADD CONSTRAINT "request_return_items_original_request_item_id_material_request_items_id_fk" FOREIGN KEY ("original_request_item_id") REFERENCES "public"."material_request_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_return_items" ADD CONSTRAINT "request_return_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_return_items" ADD CONSTRAINT "request_return_items_scrap_dimensional_item_id_inventory_dimensional_items_id_fk" FOREIGN KEY ("scrap_dimensional_item_id") REFERENCES "public"."inventory_dimensional_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_returns" ADD CONSTRAINT "request_returns_request_id_material_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."material_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_returns" ADD CONSTRAINT "request_returns_received_by_entities_id_fk" FOREIGN KEY ("received_by") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_template_items" ADD CONSTRAINT "request_template_items_template_id_request_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."request_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_template_items" ADD CONSTRAINT "request_template_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_document_id_electronic_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."electronic_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_modified_document_id_electronic_documents_id_fk" FOREIGN KEY ("modified_document_id") REFERENCES "public"."electronic_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debit_notes" ADD CONSTRAINT "debit_notes_document_id_electronic_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."electronic_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debit_notes" ADD CONSTRAINT "debit_notes_modified_document_id_electronic_documents_id_fk" FOREIGN KEY ("modified_document_id") REFERENCES "public"."electronic_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_sequences" ADD CONSTRAINT "document_sequences_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electronic_documents" ADD CONSTRAINT "electronic_documents_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electronic_documents" ADD CONSTRAINT "electronic_documents_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electronic_documents" ADD CONSTRAINT "electronic_documents_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_invoices_document_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("document_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_invoice_id_invoices_document_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("document_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_created_by_auth_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_document_id_electronic_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."electronic_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_liquidations" ADD CONSTRAINT "purchase_liquidations_document_id_electronic_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."electronic_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remission_guides" ADD CONSTRAINT "remission_guides_document_id_electronic_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."electronic_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remission_guides" ADD CONSTRAINT "remission_guides_origin_material_request_id_material_requests_id_fk" FOREIGN KEY ("origin_material_request_id") REFERENCES "public"."material_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remission_guides" ADD CONSTRAINT "remission_guides_related_invoice_id_electronic_documents_id_fk" FOREIGN KEY ("related_invoice_id") REFERENCES "public"."electronic_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remission_guides" ADD CONSTRAINT "remission_guides_carrier_id_entities_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_retentions" ADD CONSTRAINT "tax_retentions_invoice_id_invoices_document_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("document_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withholding_receipt_details" ADD CONSTRAINT "withholding_receipt_details_receipt_document_id_withholding_receipts_document_id_fk" FOREIGN KEY ("receipt_document_id") REFERENCES "public"."withholding_receipts"("document_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withholding_receipts" ADD CONSTRAINT "withholding_receipts_document_id_electronic_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."electronic_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withholding_receipts" ADD CONSTRAINT "withholding_receipts_supplier_id_entities_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_registers" ADD CONSTRAINT "cash_registers_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_registers" ADD CONSTRAINT "cash_registers_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_registers" ADD CONSTRAINT "cash_registers_default_location_id_warehouse_locations_id_fk" FOREIGN KEY ("default_location_id") REFERENCES "public"."warehouse_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_sale_items" ADD CONSTRAINT "pos_sale_items_sale_id_pos_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."pos_sales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_sale_items" ADD CONSTRAINT "pos_sale_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_sale_items" ADD CONSTRAINT "pos_sale_items_location_id_warehouse_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."warehouse_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_sale_payments" ADD CONSTRAINT "pos_sale_payments_sale_id_pos_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."pos_sales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_sales" ADD CONSTRAINT "pos_sales_session_id_pos_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."pos_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_sales" ADD CONSTRAINT "pos_sales_client_id_entities_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_sales" ADD CONSTRAINT "pos_sales_document_id_electronic_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."electronic_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_sales" ADD CONSTRAINT "pos_sales_created_by_auth_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_sessions" ADD CONSTRAINT "pos_sessions_cash_register_id_cash_registers_id_fk" FOREIGN KEY ("cash_register_id") REFERENCES "public"."cash_registers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_sessions" ADD CONSTRAINT "pos_sessions_opened_by_auth_users_id_fk" FOREIGN KEY ("opened_by") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_sessions" ADD CONSTRAINT "pos_sessions_closed_by_auth_users_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts_payable" ADD CONSTRAINT "accounts_payable_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts_payable" ADD CONSTRAINT "accounts_payable_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts_payable" ADD CONSTRAINT "accounts_payable_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts_receivable" ADD CONSTRAINT "accounts_receivable_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts_receivable" ADD CONSTRAINT "accounts_receivable_document_id_electronic_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."electronic_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts_receivable" ADD CONSTRAINT "accounts_receivable_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fiscal_periods" ADD CONSTRAINT "fiscal_periods_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fiscal_periods" ADD CONSTRAINT "fiscal_periods_closed_by_auth_users_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_quote_items" ADD CONSTRAINT "purchase_quote_items_quote_id_purchase_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."purchase_quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_quote_items" ADD CONSTRAINT "purchase_quote_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_quote_items" ADD CONSTRAINT "purchase_quote_items_purchase_uom_uom_id_fk" FOREIGN KEY ("purchase_uom") REFERENCES "public"."uom"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_quotes" ADD CONSTRAINT "purchase_quotes_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_quotes" ADD CONSTRAINT "purchase_quotes_supplier_id_entities_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_quotes" ADD CONSTRAINT "purchase_quotes_converted_po_id_purchase_orders_id_fk" FOREIGN KEY ("converted_po_id") REFERENCES "public"."purchase_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_quotes" ADD CONSTRAINT "purchase_quotes_created_by_auth_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variant_warehouse_locations" ADD CONSTRAINT "product_variant_warehouse_locations_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variant_warehouse_locations" ADD CONSTRAINT "product_variant_warehouse_locations_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variant_warehouse_locations" ADD CONSTRAINT "product_variant_warehouse_locations_default_location_id_warehouse_locations_id_fk" FOREIGN KEY ("default_location_id") REFERENCES "public"."warehouse_locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_carrier_drivers_carrier_id" ON "carrier_drivers" USING btree ("carrier_id");--> statement-breakpoint
CREATE INDEX "idx_carrier_vehicles_carrier_id" ON "carrier_vehicles" USING btree ("carrier_id");--> statement-breakpoint
CREATE INDEX "idx_active_vehicles_plate" ON "carrier_vehicles" USING btree ("license_plate") WHERE "carrier_vehicles"."is_active" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_entities_company_tax_id" ON "entities" USING btree ("company_id","tax_id");--> statement-breakpoint
CREATE INDEX "idx_entities_company" ON "entities" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_entities_roles" ON "entities" USING btree ("is_client","is_supplier","is_employee","is_carrier");--> statement-breakpoint
CREATE INDEX "idx_entities_active" ON "entities" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_active_suppliers" ON "entities" USING btree ("company_id","id") WHERE "entities"."is_supplier" = true AND "entities"."is_active" = true;--> statement-breakpoint
CREATE INDEX "idx_entities_business_name_id" ON "entities" USING btree ("business_name","id");--> statement-breakpoint
CREATE INDEX "idx_entities_created_at_id" ON "entities" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "idx_entity_contacts_entity_id" ON "entity_contacts" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "idx_companies_slug" ON "companies" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_companies_plan" ON "companies" USING btree ("plan");--> statement-breakpoint
CREATE INDEX "idx_sri_certs_company" ON "sri_certificates" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_sri_certs_active" ON "sri_certificates" USING btree ("company_id","is_active");--> statement-breakpoint
CREATE INDEX "idx_sri_estab_company" ON "sri_establishments" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_uom_company" ON "uom" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_uom_code" ON "uom" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_attr_defs_company" ON "attribute_definitions" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_brands_company" ON "brands" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_categories_parent" ON "categories" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "idx_categories_active" ON "categories" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_categories_company" ON "categories" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_categories_path_gist" ON "categories" USING gist ("path");--> statement-breakpoint
CREATE INDEX "idx_menu_parent" ON "auth_menu_items" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "idx_menu_order" ON "auth_menu_items" USING btree ("parent_id","sort_order");--> statement-breakpoint
CREATE INDEX "idx_menu_active" ON "auth_menu_items" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_perm_module_action" ON "auth_permissions" USING btree ("module","action");--> statement-breakpoint
CREATE INDEX "idx_perm_module" ON "auth_permissions" USING btree ("module");--> statement-breakpoint
CREATE INDEX "idx_role_perms_by_perm" ON "auth_role_permissions" USING btree ("permission_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_auth_roles_name" ON "auth_roles" USING btree ("company_id","name");--> statement-breakpoint
CREATE INDEX "idx_auth_roles_company" ON "auth_roles" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_user_roles_by_role" ON "auth_user_roles" USING btree ("role_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_auth_users_username" ON "auth_users" USING btree ("company_id","username");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_auth_users_email" ON "auth_users" USING btree ("company_id","email");--> statement-breakpoint
CREATE INDEX "idx_auth_users_company" ON "auth_users" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_auth_verif_tokens_user" ON "auth_verification_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_auth_verif_tokens_hash" ON "auth_verification_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "idx_sessions_user" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_sessions_expires" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_sessions_company" ON "sessions" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_audit_target" ON "audit_logs" USING btree ("table_name","record_id");--> statement-breakpoint
CREATE INDEX "idx_audit_user" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_audit_company" ON "audit_logs" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_variants_product" ON "product_variants" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_variants_barcode" ON "product_variants" USING btree ("barcode");--> statement-breakpoint
CREATE INDEX "idx_variants_attrs" ON "product_variants" USING gin ("variant_attributes");--> statement-breakpoint
CREATE INDEX "idx_products_company" ON "products" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_products_shared_attrs" ON "products" USING gin ("shared_attributes");--> statement-breakpoint
CREATE INDEX "idx_products_category" ON "products" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "idx_products_brand" ON "products" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "idx_products_cat_active" ON "products" USING btree ("category_id","is_active");--> statement-breakpoint
CREATE INDEX "idx_vph_variant" ON "variant_price_history" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "idx_vph_variant_type" ON "variant_price_history" USING btree ("variant_id","price_type","created_at");--> statement-breakpoint
CREATE INDEX "idx_vph_date" ON "variant_price_history" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_gri_receipt" ON "goods_receipt_items" USING btree ("receipt_id");--> statement-breakpoint
CREATE INDEX "idx_gri_variant" ON "goods_receipt_items" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "idx_gr_po" ON "goods_receipts" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE INDEX "idx_gr_date" ON "goods_receipts" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "idx_poi_order" ON "purchase_order_items" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE INDEX "idx_poi_variant" ON "purchase_order_items" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "idx_poi_supplier_product" ON "purchase_order_items" USING btree ("supplier_product_id");--> statement-breakpoint
CREATE INDEX "idx_po_supplier" ON "purchase_orders" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "idx_po_status" ON "purchase_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_po_wo" ON "purchase_orders" USING btree ("work_order_id");--> statement-breakpoint
CREATE INDEX "idx_po_company" ON "purchase_orders" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_supplier_products_variant" ON "supplier_products" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "idx_sp_supplier_active" ON "supplier_products" USING btree ("supplier_id") WHERE "supplier_products"."is_active" = true;--> statement-breakpoint
CREATE INDEX "idx_dim_items_variant" ON "inventory_dimensional_items" USING btree ("variant_id","location_id");--> statement-breakpoint
CREATE INDEX "idx_movements_src_loc" ON "inventory_movements" USING btree ("source_location_id","variant_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_movements_dest_loc" ON "inventory_movements" USING btree ("destination_location_id","variant_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_movements_type_date" ON "inventory_movements" USING btree ("type","created_at");--> statement-breakpoint
CREATE INDEX "idx_movements_ref" ON "inventory_movements" USING btree ("reference_type","reference_id");--> statement-breakpoint
CREATE INDEX "idx_movements_product" ON "inventory_movements" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_inv_stock_variant" ON "inventory_stock" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "idx_locations_company" ON "warehouse_locations" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_locations_warehouse" ON "warehouse_locations" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "idx_locations_parent" ON "warehouse_locations" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "idx_locations_path_gist" ON "warehouse_locations" USING gist ("path");--> statement-breakpoint
CREATE INDEX "idx_warehouses_company" ON "warehouses" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_quotation_items_quotation" ON "quotation_items" USING btree ("quotation_id");--> statement-breakpoint
CREATE INDEX "idx_quotations_client" ON "quotations" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_quotations_status" ON "quotations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_quotations_date" ON "quotations" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_visits_client" ON "technical_visits" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_visits_date" ON "technical_visits" USING btree ("visit_date");--> statement-breakpoint
CREATE INDEX "idx_bom_details_bom_component" ON "bom_details" USING btree ("bom_id","component_product_id");--> statement-breakpoint
CREATE INDEX "idx_bom_details_component" ON "bom_details" USING btree ("component_product_id");--> statement-breakpoint
CREATE INDEX "idx_bom_tpl_details_template" ON "bom_template_details" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "idx_bom_tpl_details_component" ON "bom_template_details" USING btree ("component_product_id");--> statement-breakpoint
CREATE INDEX "idx_bom_templates_category" ON "bom_templates" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "idx_bom_templates_company" ON "bom_templates" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_schedule_date" ON "employee_work_schedules" USING btree ("work_date");--> statement-breakpoint
CREATE INDEX "idx_schedule_employee" ON "employee_work_schedules" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_schedule_wo" ON "employee_work_schedules" USING btree ("work_order_id");--> statement-breakpoint
CREATE INDEX "idx_mfg_log_order" ON "manufacturing_log" USING btree ("manufacturing_order_id");--> statement-breakpoint
CREATE INDEX "idx_mfg_log_variant" ON "manufacturing_log" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "idx_mfg_inputs_order" ON "manufacturing_order_inputs" USING btree ("manufacturing_order_id");--> statement-breakpoint
CREATE INDEX "idx_mfg_orders_wo" ON "manufacturing_orders" USING btree ("work_order_id");--> statement-breakpoint
CREATE INDEX "idx_mfg_orders_status" ON "manufacturing_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_mfg_orders_variant" ON "manufacturing_orders" USING btree ("output_variant_id");--> statement-breakpoint
CREATE INDEX "idx_wo_items_order" ON "work_order_items" USING btree ("work_order_id");--> statement-breakpoint
CREATE INDEX "idx_wo_items_product" ON "work_order_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_wo_status" ON "work_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_wo_client" ON "work_orders" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_wo_dates" ON "work_orders" USING btree ("start_date","delivery_date");--> statement-breakpoint
CREATE INDEX "idx_wo_company" ON "work_orders" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_dispatches_item" ON "material_request_dispatches" USING btree ("request_item_id");--> statement-breakpoint
CREATE INDEX "idx_dispatches_location" ON "material_request_dispatches" USING btree ("dispatched_from_location_id");--> statement-breakpoint
CREATE INDEX "idx_dispatches_variant" ON "material_request_dispatches" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "idx_mri_request" ON "material_request_items" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "idx_mri_variant" ON "material_request_items" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "idx_mr_work_order" ON "material_requests" USING btree ("work_order_id","status");--> statement-breakpoint
CREATE INDEX "idx_mr_requester" ON "material_requests" USING btree ("requester_id");--> statement-breakpoint
CREATE INDEX "idx_rri_return" ON "request_return_items" USING btree ("return_id");--> statement-breakpoint
CREATE INDEX "idx_rri_variant" ON "request_return_items" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "idx_returns_request" ON "request_returns" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "idx_docs_access_key" ON "electronic_documents" USING btree ("sri_access_key");--> statement-breakpoint
CREATE INDEX "idx_docs_type_date" ON "electronic_documents" USING btree ("type","issue_date");--> statement-breakpoint
CREATE INDEX "idx_docs_status" ON "electronic_documents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_docs_company" ON "electronic_documents" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_docs_company_type" ON "electronic_documents" USING btree ("company_id","type","issue_date");--> statement-breakpoint
CREATE INDEX "idx_invoice_items_invoice" ON "invoice_items" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "idx_invoices_ruc" ON "invoices" USING btree ("billed_to_ruc");--> statement-breakpoint
CREATE INDEX "idx_invoices_payment_status" ON "invoices" USING btree ("payment_status");--> statement-breakpoint
CREATE INDEX "idx_wh_details_receipt" ON "withholding_receipt_details" USING btree ("receipt_document_id");--> statement-breakpoint
CREATE INDEX "idx_wh_receipts_supplier" ON "withholding_receipts" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "idx_wh_receipts_period" ON "withholding_receipts" USING btree ("fiscal_period");--> statement-breakpoint
CREATE INDEX "idx_cash_registers_company" ON "cash_registers" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_pos_items_sale" ON "pos_sale_items" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "idx_pos_payments_sale" ON "pos_sale_payments" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "idx_pos_sales_session" ON "pos_sales" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_pos_sales_date" ON "pos_sales" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_pos_sales_client" ON "pos_sales" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_pos_sessions_status" ON "pos_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_pos_sessions_register" ON "pos_sessions" USING btree ("cash_register_id","status");--> statement-breakpoint
CREATE INDEX "idx_ap_company" ON "accounts_payable" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_ap_entity" ON "accounts_payable" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "idx_ap_status" ON "accounts_payable" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "idx_ap_due_date" ON "accounts_payable" USING btree ("company_id","due_date");--> statement-breakpoint
CREATE INDEX "idx_ap_po" ON "accounts_payable" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE INDEX "idx_ar_company" ON "accounts_receivable" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_ar_entity" ON "accounts_receivable" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "idx_ar_status" ON "accounts_receivable" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "idx_ar_due_date" ON "accounts_receivable" USING btree ("company_id","due_date");--> statement-breakpoint
CREATE INDEX "idx_ar_document" ON "accounts_receivable" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "idx_fiscal_company" ON "fiscal_periods" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_pqi_quote" ON "purchase_quote_items" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX "idx_pqi_variant" ON "purchase_quote_items" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "idx_pq_company" ON "purchase_quotes" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_pq_supplier" ON "purchase_quotes" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "idx_pq_status" ON "purchase_quotes" USING btree ("status");--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "entities" AS PERMISSIVE FOR ALL TO public USING (company_id = current_setting('app.current_company_id', true)::integer) WITH CHECK (company_id = current_setting('app.current_company_id', true)::integer);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "sri_certificates" AS PERMISSIVE FOR ALL TO public USING (company_id = current_setting('app.current_company_id', true)::integer) WITH CHECK (company_id = current_setting('app.current_company_id', true)::integer);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "sri_establishments" AS PERMISSIVE FOR ALL TO public USING (company_id = current_setting('app.current_company_id', true)::integer) WITH CHECK (company_id = current_setting('app.current_company_id', true)::integer);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "uom" AS PERMISSIVE FOR ALL TO public USING (company_id = current_setting('app.current_company_id', true)::integer
            OR (company_id IS NULL AND is_system = true)) WITH CHECK (company_id = current_setting('app.current_company_id', true)::integer);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "attribute_definitions" AS PERMISSIVE FOR ALL TO public USING (company_id = current_setting('app.current_company_id', true)::integer) WITH CHECK (company_id = current_setting('app.current_company_id', true)::integer);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "brands" AS PERMISSIVE FOR ALL TO public USING (company_id = current_setting('app.current_company_id', true)::integer) WITH CHECK (company_id = current_setting('app.current_company_id', true)::integer);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "categories" AS PERMISSIVE FOR ALL TO public USING (company_id = current_setting('app.current_company_id', true)::integer) WITH CHECK (company_id = current_setting('app.current_company_id', true)::integer);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "auth_roles" AS PERMISSIVE FOR ALL TO public USING (company_id = current_setting('app.current_company_id', true)::integer) WITH CHECK (company_id = current_setting('app.current_company_id', true)::integer);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "auth_users" AS PERMISSIVE FOR ALL TO public USING (company_id = current_setting('app.current_company_id', true)::integer
            OR username = current_setting('app.current_username', true)
            OR email = current_setting('app.current_username', true)) WITH CHECK (company_id = current_setting('app.current_company_id', true)::integer);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "sessions" AS PERMISSIVE FOR ALL TO public USING (company_id = current_setting('app.current_company_id', true)::integer
            OR id = current_setting('app.current_session_id', true)) WITH CHECK (company_id = current_setting('app.current_company_id', true)::integer);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "audit_logs" AS PERMISSIVE FOR ALL TO public USING (company_id IS NULL OR company_id = current_setting('app.current_company_id', true)::integer) WITH CHECK (company_id IS NULL OR company_id = current_setting('app.current_company_id', true)::integer);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "products" AS PERMISSIVE FOR ALL TO public USING (company_id = current_setting('app.current_company_id', true)::integer) WITH CHECK (company_id = current_setting('app.current_company_id', true)::integer);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "purchase_orders" AS PERMISSIVE FOR ALL TO public USING (company_id = current_setting('app.current_company_id', true)::integer) WITH CHECK (company_id = current_setting('app.current_company_id', true)::integer);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "warehouse_locations" AS PERMISSIVE FOR ALL TO public USING (company_id = current_setting('app.current_company_id', true)::integer) WITH CHECK (company_id = current_setting('app.current_company_id', true)::integer);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "warehouses" AS PERMISSIVE FOR ALL TO public USING (company_id = current_setting('app.current_company_id', true)::integer) WITH CHECK (company_id = current_setting('app.current_company_id', true)::integer);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "bom_templates" AS PERMISSIVE FOR ALL TO public USING (company_id = current_setting('app.current_company_id', true)::integer) WITH CHECK (company_id = current_setting('app.current_company_id', true)::integer);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "work_orders" AS PERMISSIVE FOR ALL TO public USING (company_id = current_setting('app.current_company_id', true)::integer) WITH CHECK (company_id = current_setting('app.current_company_id', true)::integer);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "document_sequences" AS PERMISSIVE FOR ALL TO public USING (company_id = current_setting('app.current_company_id', true)::integer) WITH CHECK (company_id = current_setting('app.current_company_id', true)::integer);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "electronic_documents" AS PERMISSIVE FOR ALL TO public USING (company_id = current_setting('app.current_company_id', true)::integer) WITH CHECK (company_id = current_setting('app.current_company_id', true)::integer);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "cash_registers" AS PERMISSIVE FOR ALL TO public USING (company_id = current_setting('app.current_company_id', true)::integer) WITH CHECK (company_id = current_setting('app.current_company_id', true)::integer);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "accounts_payable" AS PERMISSIVE FOR ALL TO public USING (company_id = current_setting('app.current_company_id', true)::integer) WITH CHECK (company_id = current_setting('app.current_company_id', true)::integer);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "accounts_receivable" AS PERMISSIVE FOR ALL TO public USING (company_id = current_setting('app.current_company_id', true)::integer) WITH CHECK (company_id = current_setting('app.current_company_id', true)::integer);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "fiscal_periods" AS PERMISSIVE FOR ALL TO public USING (company_id = current_setting('app.current_company_id', true)::integer) WITH CHECK (company_id = current_setting('app.current_company_id', true)::integer);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "purchase_quotes" AS PERMISSIVE FOR ALL TO public USING (company_id = current_setting('app.current_company_id', true)::integer) WITH CHECK (company_id = current_setting('app.current_company_id', true)::integer);