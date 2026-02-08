CREATE TYPE "public"."bom_calculation_type" AS ENUM('FIXED', 'AREA', 'PERIMETER', 'VOLUMEN');--> statement-breakpoint
CREATE TYPE "public"."condition" AS ENUM('GOOD', 'DAMAGED', 'UNUSABLE');--> statement-breakpoint
CREATE TYPE "public"."dimensional_source" AS ENUM('PURCHASE', 'CUT', 'RETURN', 'ADJUSTMENT', 'PRODUCTION');--> statement-breakpoint
CREATE TYPE "public"."document_type" AS ENUM('INVOICE', 'CREDIT_NOTE', 'DEBIT_NOTE', 'REMISSION_GUIDE', 'PURCHASE_LIQUIDATION');--> statement-breakpoint
CREATE TYPE "public"."inventory_status" AS ENUM('AVAILABLE', 'RESERVED', 'SCRAP', 'CONSUMED');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('DRAFT', 'SIGNED', 'SENDING', 'AUTHORIZED', 'ANNULLED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."justification_type" AS ENUM('LIBRE', 'FALTA', 'IESS', 'VACACIONES', 'FERIADO', 'SAB', 'DOM');--> statement-breakpoint
CREATE TYPE "public"."material_request_status" AS ENUM('PENDING', 'APPROVED', 'IN_TRANSIT', 'RECEIVED', 'COMPLETED');--> statement-breakpoint
CREATE TYPE "public"."movement_type" AS ENUM('PURCHASE', 'SALE', 'PRODUCTION_CONSUMPTION', 'PRODUCTION_OUTPUT', 'ADJUSTMENT', 'TRANSFER_OUT', 'TRANSFER_IN');--> statement-breakpoint
CREATE TYPE "public"."payment_method_sri" AS ENUM('01', '16', '19', '20');--> statement-breakpoint
CREATE TYPE "public"."person_type" AS ENUM('NATURAL', 'JURIDICA');--> statement-breakpoint
CREATE TYPE "public"."pos_session_status" AS ENUM('OPEN', 'CLOSED', 'RECONCILED');--> statement-breakpoint
CREATE TYPE "public"."product_subtype" AS ENUM('SIMPLE', 'COMPUESTO', 'FABRICADO');--> statement-breakpoint
CREATE TYPE "public"."product_type" AS ENUM('PRODUCTO', 'SERVICIO');--> statement-breakpoint
CREATE TYPE "public"."production_status" AS ENUM('PLANNED', 'IN_CUTTING', 'ASSEMBLY', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."quotation_status" AS ENUM('DRAFT', 'SENT', 'APPROVED', 'REJECTED', 'CONVERTED_TO_WO');--> statement-breakpoint
CREATE TYPE "public"."request_destination" AS ENUM('WORKSHOP', 'FIELD_SITE');--> statement-breakpoint
CREATE TYPE "public"."retention_type" AS ENUM('IVA', 'RENTA', 'ISD');--> statement-breakpoint
CREATE TYPE "public"."sale_origin" AS ENUM('POS', 'PROJECT', 'ECOMMERCE');--> statement-breakpoint
CREATE TYPE "public"."sri_contributor_type" AS ENUM('RIMPE_POPULAR', 'RIMPE_EMPRENDEDOR', 'GENERAL', 'ESP_AGENT');--> statement-breakpoint
CREATE TYPE "public"."tax_id_type" AS ENUM('RUC', 'CEDULA', 'PASAPORTE');--> statement-breakpoint
CREATE TYPE "public"."technical_visit_status" AS ENUM('SCHEDULED', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."work_order_status" AS ENUM('DRAFT', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'INVOICED');--> statement-breakpoint
CREATE TABLE "attribute_definitions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "attribute_definitions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"key" text NOT NULL,
	"label" text NOT NULL,
	"type" text NOT NULL,
	"default_options" jsonb,
	"is_active" boolean DEFAULT true,
	CONSTRAINT "attribute_definitions_key_unique" UNIQUE("key")
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
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "auth_menu_items_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "auth_permissions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "auth_permissions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
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
	"name" text NOT NULL,
	"description" text,
	CONSTRAINT "auth_roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "auth_user_roles" (
	"user_id" integer NOT NULL,
	"role_id" integer NOT NULL,
	CONSTRAINT "auth_user_roles_user_id_role_id_pk" PRIMARY KEY("user_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "auth_users" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "auth_users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"entity_id" integer,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"is_active" boolean DEFAULT true,
	"last_login" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "auth_users_username_unique" UNIQUE("username"),
	CONSTRAINT "auth_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "bom_details" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "bom_details_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"bom_id" integer,
	"component_product_id" integer,
	"quantity_factor" numeric(12, 4) NOT NULL,
	"calculation_type" "bom_calculation_type" DEFAULT 'FIXED' NOT NULL,
	"wastage_percent" numeric(5, 2) DEFAULT '0',
	"formula_expression" text,
	"sort_order" integer DEFAULT 0,
	"processing_notes" text,
	"is_optional" boolean DEFAULT false,
	CONSTRAINT "unq_bom_component" UNIQUE("bom_id","component_product_id")
);
--> statement-breakpoint
CREATE TABLE "bom_headers" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "bom_headers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"product_id" integer,
	"name" text,
	"revision" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bom_template_details" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "bom_template_details_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"template_id" integer NOT NULL,
	"component_product_id" integer,
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
	"name" text NOT NULL,
	"category_id" integer,
	"required_variables" jsonb DEFAULT '[]'::jsonb,
	"variable_constraints" jsonb DEFAULT '{}'::jsonb,
	"description" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brands" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "brands_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"website" text,
	"is_active" boolean DEFAULT true,
	CONSTRAINT "brands_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "cash_registers" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "cash_registers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"warehouse_id" integer,
	"establishment" text NOT NULL,
	"emission_point" text NOT NULL,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "categories_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"parent_id" integer,
	"description" text,
	"icon" text,
	"name_template" text,
	"sort_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
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
CREATE TABLE "credit_notes" (
	"document_id" integer PRIMARY KEY NOT NULL,
	"modified_document_id" integer NOT NULL,
	"modification_reason" text NOT NULL,
	"total_modification" numeric(12, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_sequences" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "document_sequences_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"establishment" text NOT NULL,
	"emission_point" text NOT NULL,
	"document_type" text NOT NULL,
	"current_value" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "unq_seq" UNIQUE("establishment","emission_point","document_type")
);
--> statement-breakpoint
CREATE TABLE "electronic_documents" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "electronic_documents_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"type" "document_type" NOT NULL,
	"sri_access_key" text,
	"sri_authorization_date" timestamp,
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
	"sri_deadline" timestamp,
	"retry_count" integer DEFAULT 0,
	"emission_type" text DEFAULT '1',
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "electronic_documents_sri_access_key_unique" UNIQUE("sri_access_key"),
	CONSTRAINT "unq_document_identity" UNIQUE("establishment","emission_point","sequential","type")
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
CREATE TABLE "employee_work_schedules" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "employee_work_schedules_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"employee_id" integer NOT NULL,
	"work_order_id" integer,
	"work_date" timestamp NOT NULL,
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
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entities" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "entities_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tax_id" text NOT NULL,
	"tax_id_type" "tax_id_type" NOT NULL,
	"person_type" "person_type" DEFAULT 'NATURAL' NOT NULL,
	"business_name" text NOT NULL,
	"trade_name" text,
	"email_billing" text NOT NULL,
	"phone" text,
	"address_fiscal" text NOT NULL,
	"is_client" boolean DEFAULT false,
	"is_supplier" boolean DEFAULT false,
	"is_employee" boolean DEFAULT false,
	"is_carrier" boolean DEFAULT false,
	"sri_contributor_type" "sri_contributor_type",
	"obligado_contabilidad" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "entities_tax_id_unique" UNIQUE("tax_id")
);
--> statement-breakpoint
CREATE TABLE "entity_addresses" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "entity_addresses_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"entity_id" integer NOT NULL,
	"address_line" text NOT NULL,
	"city" text,
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
CREATE TABLE "inventory_dimensional_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "inventory_dimensional_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"warehouse_id" integer,
	"product_id" integer,
	"parent_item_id" integer,
	"variant_id" integer,
	"quantity" numeric(12, 4) DEFAULT '1' NOT NULL,
	"length_cm" numeric(12, 4),
	"width_cm" numeric(12, 4),
	"thickness_cm" numeric(12, 4),
	"area_m2" numeric(12, 4),
	"equivalent_standard_units" numeric(12, 6),
	"batch_number" text,
	"status" "inventory_status" DEFAULT 'AVAILABLE',
	"location_rack" text,
	"source_type" "dimensional_source",
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_movements" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "inventory_movements_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"warehouse_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"dimensional_item_id" integer,
	"type" "movement_type" NOT NULL,
	"quantity" numeric(12, 4) NOT NULL,
	"quantity_secondary" numeric(12, 4),
	"previous_stock" numeric(12, 4),
	"new_stock" numeric(12, 4),
	"unit_cost" numeric(12, 4),
	"reference_id" integer,
	"reference_type" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" integer
);
--> statement-breakpoint
CREATE TABLE "inventory_stock" (
	"warehouse_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"quantity_on_hand" numeric(15, 4) DEFAULT '0',
	"quantity_secondary" numeric(15, 4) DEFAULT '0',
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_stock_warehouse_id_product_id_pk" PRIMARY KEY("warehouse_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "invoice_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "invoice_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"invoice_id" integer NOT NULL,
	"product_id" integer NOT NULL,
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
	"created_at" timestamp DEFAULT now() NOT NULL,
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
CREATE TABLE "manufacturing_log" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "manufacturing_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"manufacturing_order_id" integer NOT NULL,
	"product_id" integer,
	"dimensional_item_id" integer,
	"quantity_consumed" numeric(12, 4),
	"area_consumed_m2" numeric(12, 4),
	"scrap_generated" boolean DEFAULT false,
	"scrap_quantity" numeric(12, 4),
	"scrap_item_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" integer
);
--> statement-breakpoint
CREATE TABLE "manufacturing_order_inputs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "manufacturing_order_inputs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"manufacturing_order_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"planned_quantity" numeric(12, 4) NOT NULL,
	"reserved_dimensional_item_id" integer,
	"is_additional" boolean DEFAULT false,
	"added_by" integer,
	"reason" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "manufacturing_orders" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "manufacturing_orders_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"work_order_id" integer NOT NULL,
	"output_product_id" integer,
	"custom_width" numeric(10, 2),
	"custom_height" numeric(10, 2),
	"custom_thickness" numeric(10, 2),
	"target_quantity" numeric(12, 4) DEFAULT '1',
	"status" "production_status" DEFAULT 'PLANNED',
	"start_date" timestamp,
	"end_date" timestamp,
	"assigned_supervisor_id" integer
);
--> statement-breakpoint
CREATE TABLE "material_request_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "material_request_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"request_id" integer,
	"product_id" integer,
	"quantity_requested" numeric(12, 4),
	"quantity_dispatched" numeric(12, 4) DEFAULT '0',
	"inventory_item_id" integer,
	"quantity_returned" numeric(12, 4) DEFAULT '0'
);
--> statement-breakpoint
CREATE TABLE "material_requests" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "material_requests_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"work_order_id" integer,
	"requester_id" integer,
	"destination_type" "request_destination" DEFAULT 'WORKSHOP' NOT NULL,
	"location_detail" text,
	"status" "material_request_status" DEFAULT 'PENDING',
	"dispatch_date" timestamp,
	"expected_return_date" date,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pos_sale_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "pos_sale_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"sale_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"quantity" numeric(12, 4) NOT NULL,
	"unit_price" numeric(12, 4) NOT NULL,
	"discount" numeric(12, 2) DEFAULT '0',
	"subtotal" numeric(12, 2) NOT NULL,
	"iva_rate" numeric(5, 2) NOT NULL,
	"iva_amount" numeric(12, 2) NOT NULL,
	"dimensional_item_id" integer
);
--> statement-breakpoint
CREATE TABLE "pos_sales" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "pos_sales_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"session_id" integer NOT NULL,
	"client_id" integer,
	"document_id" integer,
	"sale_origin" "sale_origin" DEFAULT 'POS' NOT NULL,
	"subtotal" numeric(12, 2) DEFAULT '0' NOT NULL,
	"discount_total" numeric(12, 2) DEFAULT '0',
	"tax_total" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total" numeric(12, 2) NOT NULL,
	"payment_method" "payment_method_sri" NOT NULL,
	"amount_received" numeric(12, 2),
	"change_given" numeric(12, 2),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pos_sessions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "pos_sessions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"cash_register_id" integer NOT NULL,
	"opened_by" integer NOT NULL,
	"opened_at" timestamp DEFAULT now() NOT NULL,
	"opening_balance" numeric(12, 2) DEFAULT '0' NOT NULL,
	"closed_by" integer,
	"closed_at" timestamp,
	"closing_balance" numeric(12, 2),
	"cash_counted" numeric(12, 2),
	"difference" numeric(12, 2),
	"status" "pos_session_status" DEFAULT 'OPEN' NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "price_lists" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "price_lists_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"description" text,
	"is_default" boolean DEFAULT false,
	"is_active" boolean DEFAULT true
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
CREATE TABLE "product_dimensions" (
	"product_id" integer PRIMARY KEY NOT NULL,
	"width" numeric(10, 4) DEFAULT '0',
	"length" numeric(10, 4) DEFAULT '0',
	"thickness" numeric(10, 4) DEFAULT '0',
	"area" numeric(12, 4)
);
--> statement-breakpoint
CREATE TABLE "product_prices" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "product_prices_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"product_id" integer NOT NULL,
	"price_list_id" integer NOT NULL,
	"price" numeric(12, 4) NOT NULL,
	"min_quantity" numeric(12, 4) DEFAULT '1',
	"valid_from" date,
	"valid_until" date,
	"is_active" boolean DEFAULT true,
	CONSTRAINT "unq_product_price" UNIQUE("product_id","price_list_id","min_quantity")
);
--> statement-breakpoint
CREATE TABLE "product_uom_conversions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "product_uom_conversions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"product_id" integer NOT NULL,
	"from_uom" text NOT NULL,
	"to_uom" text NOT NULL,
	"conversion_factor" numeric(15, 8) NOT NULL,
	"is_exact" boolean DEFAULT true,
	"notes" text,
	CONSTRAINT "unq_prod_uom_conv" UNIQUE("product_id","from_uom","to_uom")
);
--> statement-breakpoint
CREATE TABLE "product_variants" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "product_variants_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"product_id" integer NOT NULL,
	"variant_name" text NOT NULL,
	"sku_suffix" text,
	"length" numeric(10, 4),
	"width" numeric(10, 4),
	"thickness" numeric(10, 4),
	"area" numeric(12, 4),
	"uom_conversion_factor" numeric(12, 4) NOT NULL,
	"is_default" boolean DEFAULT false,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "products_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"product_type" "product_type" NOT NULL,
	"product_subtype" "product_subtype",
	"category_id" integer,
	"brand_id" integer,
	"sku" text NOT NULL,
	"name" text NOT NULL,
	"specs" jsonb DEFAULT '{}'::jsonb,
	"description" text,
	"image_urls" text[] DEFAULT ARRAY[]::text[],
	"uom_inventory_code" text,
	"uom_consumption_code" text,
	"track_dimensional" boolean DEFAULT false,
	"min_stock_alert" numeric(12, 4) DEFAULT '0',
	"last_cost" numeric(12, 4) DEFAULT '0',
	"base_price" numeric(12, 4) DEFAULT '0',
	"secondary_uom_code" text,
	"conversion_factor_secondary" numeric(12, 4) DEFAULT '1',
	"iva_rate_code" integer DEFAULT 4 NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" integer,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "products_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
CREATE TABLE "quotation_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "quotation_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"quotation_id" integer NOT NULL,
	"product_id" integer,
	"description" text NOT NULL,
	"quantity" numeric(12, 4) DEFAULT '1',
	"unit_price" numeric(12, 4) DEFAULT '0',
	"subtotal" numeric(12, 2) DEFAULT '0'
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
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" integer
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "refresh_tokens_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"selector" text NOT NULL,
	"token_hash" text NOT NULL,
	"session_chain_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"last_activity" timestamp DEFAULT now() NOT NULL,
	"revoked" boolean DEFAULT false,
	"replaced_by" integer,
	"user_agent" text,
	"ip_address" text,
	CONSTRAINT "refresh_tokens_selector_unique" UNIQUE("selector")
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
CREATE TABLE "request_return_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "request_return_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"return_id" integer,
	"original_request_item_id" integer,
	"quantity_returned" numeric(12, 4) NOT NULL,
	"returned_condition" "condition",
	"is_scrap_reusable" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "request_returns" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "request_returns_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"request_id" integer,
	"return_date" timestamp DEFAULT now(),
	"received_by" integer,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "request_template_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "request_template_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"template_id" integer,
	"product_id" integer,
	"default_quantity" numeric(12, 4)
);
--> statement-breakpoint
CREATE TABLE "request_templates" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "request_templates_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "supplier_products" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "supplier_products_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"supplier_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"supplier_sku" text,
	"supplier_product_name" text,
	"purchase_uom" text,
	"conversion_to_inventory_factor" numeric(12, 4) DEFAULT '1',
	"agreed_price" numeric(12, 4),
	"last_purchase_date" date,
	"lead_time_days" integer,
	"min_order_quantity" numeric(12, 4),
	"is_preferred" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	CONSTRAINT "unq_supplier_product" UNIQUE("supplier_id","product_id")
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
CREATE TABLE "technical_visits" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "technical_visits_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"client_id" integer NOT NULL,
	"assigned_employee_id" integer,
	"visit_date" timestamp NOT NULL,
	"status" "technical_visit_status" DEFAULT 'SCHEDULED',
	"notes" text,
	"evidence_files" text[] DEFAULT ARRAY[]::text[],
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "uom" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "warehouses" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "warehouses_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"address" text,
	"is_mobile" boolean DEFAULT false,
	"is_active" boolean DEFAULT true
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
	"requested_uom" text
);
--> statement-breakpoint
CREATE TABLE "work_orders" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "work_orders_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code_sequence" integer,
	"client_id" integer,
	"quotation_id" integer,
	"status" "work_order_status" DEFAULT 'DRAFT',
	"start_date" date,
	"delivery_date" date,
	"total_estimated" numeric(12, 2),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth_menu_items" ADD CONSTRAINT "auth_menu_items_parent_id_auth_menu_items_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."auth_menu_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_role_permissions" ADD CONSTRAINT "auth_role_permissions_role_id_auth_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."auth_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_role_permissions" ADD CONSTRAINT "auth_role_permissions_permission_id_auth_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."auth_permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_user_roles" ADD CONSTRAINT "auth_user_roles_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_user_roles" ADD CONSTRAINT "auth_user_roles_role_id_auth_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."auth_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_users" ADD CONSTRAINT "auth_users_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bom_details" ADD CONSTRAINT "bom_details_bom_id_bom_headers_id_fk" FOREIGN KEY ("bom_id") REFERENCES "public"."bom_headers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bom_details" ADD CONSTRAINT "bom_details_component_product_id_products_id_fk" FOREIGN KEY ("component_product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bom_headers" ADD CONSTRAINT "bom_headers_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bom_template_details" ADD CONSTRAINT "bom_template_details_template_id_bom_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."bom_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bom_template_details" ADD CONSTRAINT "bom_template_details_component_product_id_products_id_fk" FOREIGN KEY ("component_product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bom_templates" ADD CONSTRAINT "bom_templates_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_registers" ADD CONSTRAINT "cash_registers_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_attributes" ADD CONSTRAINT "category_attributes_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_attributes" ADD CONSTRAINT "category_attributes_attribute_def_id_attribute_definitions_id_fk" FOREIGN KEY ("attribute_def_id") REFERENCES "public"."attribute_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_document_id_electronic_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."electronic_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_modified_document_id_electronic_documents_id_fk" FOREIGN KEY ("modified_document_id") REFERENCES "public"."electronic_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electronic_documents" ADD CONSTRAINT "electronic_documents_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electronic_documents" ADD CONSTRAINT "electronic_documents_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_details" ADD CONSTRAINT "employee_details_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_work_schedules" ADD CONSTRAINT "employee_work_schedules_employee_id_entities_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_work_schedules" ADD CONSTRAINT "employee_work_schedules_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_addresses" ADD CONSTRAINT "entity_addresses_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_contacts" ADD CONSTRAINT "entity_contacts_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_dimensional_items" ADD CONSTRAINT "inventory_dimensional_items_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_dimensional_items" ADD CONSTRAINT "inventory_dimensional_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_dimensional_items" ADD CONSTRAINT "inventory_dimensional_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_dimensional_items" ADD CONSTRAINT "inventory_dimensional_items_parent_item_id_inventory_dimensional_items_id_fk" FOREIGN KEY ("parent_item_id") REFERENCES "public"."inventory_dimensional_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_dimensional_item_id_inventory_dimensional_items_id_fk" FOREIGN KEY ("dimensional_item_id") REFERENCES "public"."inventory_dimensional_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_created_by_auth_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_stock" ADD CONSTRAINT "inventory_stock_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_stock" ADD CONSTRAINT "inventory_stock_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_invoices_document_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("document_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_invoice_id_invoices_document_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("document_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_created_by_auth_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_document_id_electronic_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."electronic_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manufacturing_log" ADD CONSTRAINT "manufacturing_log_manufacturing_order_id_manufacturing_orders_id_fk" FOREIGN KEY ("manufacturing_order_id") REFERENCES "public"."manufacturing_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manufacturing_log" ADD CONSTRAINT "manufacturing_log_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manufacturing_log" ADD CONSTRAINT "manufacturing_log_dimensional_item_id_inventory_dimensional_items_id_fk" FOREIGN KEY ("dimensional_item_id") REFERENCES "public"."inventory_dimensional_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manufacturing_log" ADD CONSTRAINT "manufacturing_log_scrap_item_id_inventory_dimensional_items_id_fk" FOREIGN KEY ("scrap_item_id") REFERENCES "public"."inventory_dimensional_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manufacturing_log" ADD CONSTRAINT "manufacturing_log_created_by_auth_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manufacturing_order_inputs" ADD CONSTRAINT "manufacturing_order_inputs_manufacturing_order_id_manufacturing_orders_id_fk" FOREIGN KEY ("manufacturing_order_id") REFERENCES "public"."manufacturing_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manufacturing_order_inputs" ADD CONSTRAINT "manufacturing_order_inputs_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manufacturing_order_inputs" ADD CONSTRAINT "manufacturing_order_inputs_reserved_dimensional_item_id_inventory_dimensional_items_id_fk" FOREIGN KEY ("reserved_dimensional_item_id") REFERENCES "public"."inventory_dimensional_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manufacturing_order_inputs" ADD CONSTRAINT "manufacturing_order_inputs_added_by_auth_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manufacturing_orders" ADD CONSTRAINT "manufacturing_orders_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manufacturing_orders" ADD CONSTRAINT "manufacturing_orders_output_product_id_products_id_fk" FOREIGN KEY ("output_product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manufacturing_orders" ADD CONSTRAINT "manufacturing_orders_assigned_supervisor_id_entities_id_fk" FOREIGN KEY ("assigned_supervisor_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_request_items" ADD CONSTRAINT "material_request_items_request_id_material_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."material_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_request_items" ADD CONSTRAINT "material_request_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_request_items" ADD CONSTRAINT "material_request_items_inventory_item_id_inventory_dimensional_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_dimensional_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_requests" ADD CONSTRAINT "material_requests_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_requests" ADD CONSTRAINT "material_requests_requester_id_entities_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_sale_items" ADD CONSTRAINT "pos_sale_items_sale_id_pos_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."pos_sales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_sale_items" ADD CONSTRAINT "pos_sale_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_sale_items" ADD CONSTRAINT "pos_sale_items_dimensional_item_id_inventory_dimensional_items_id_fk" FOREIGN KEY ("dimensional_item_id") REFERENCES "public"."inventory_dimensional_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_sales" ADD CONSTRAINT "pos_sales_session_id_pos_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."pos_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_sales" ADD CONSTRAINT "pos_sales_client_id_entities_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_sales" ADD CONSTRAINT "pos_sales_document_id_electronic_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."electronic_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_sales" ADD CONSTRAINT "pos_sales_created_by_auth_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_sessions" ADD CONSTRAINT "pos_sessions_cash_register_id_cash_registers_id_fk" FOREIGN KEY ("cash_register_id") REFERENCES "public"."cash_registers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_sessions" ADD CONSTRAINT "pos_sessions_opened_by_auth_users_id_fk" FOREIGN KEY ("opened_by") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_sessions" ADD CONSTRAINT "pos_sessions_closed_by_auth_users_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_components" ADD CONSTRAINT "product_components_parent_product_id_products_id_fk" FOREIGN KEY ("parent_product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_components" ADD CONSTRAINT "product_components_component_product_id_products_id_fk" FOREIGN KEY ("component_product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_dimensions" ADD CONSTRAINT "product_dimensions_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_prices" ADD CONSTRAINT "product_prices_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_prices" ADD CONSTRAINT "product_prices_price_list_id_price_lists_id_fk" FOREIGN KEY ("price_list_id") REFERENCES "public"."price_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_uom_conversions" ADD CONSTRAINT "product_uom_conversions_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_uom_conversions" ADD CONSTRAINT "product_uom_conversions_from_uom_uom_code_fk" FOREIGN KEY ("from_uom") REFERENCES "public"."uom"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_uom_conversions" ADD CONSTRAINT "product_uom_conversions_to_uom_uom_code_fk" FOREIGN KEY ("to_uom") REFERENCES "public"."uom"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_uom_inventory_code_uom_code_fk" FOREIGN KEY ("uom_inventory_code") REFERENCES "public"."uom"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_uom_consumption_code_uom_code_fk" FOREIGN KEY ("uom_consumption_code") REFERENCES "public"."uom"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_secondary_uom_code_uom_code_fk" FOREIGN KEY ("secondary_uom_code") REFERENCES "public"."uom"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_updated_by_auth_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_quotation_id_quotations_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "public"."quotations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_client_id_entities_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_technical_visit_id_technical_visits_id_fk" FOREIGN KEY ("technical_visit_id") REFERENCES "public"."technical_visits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_created_by_auth_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remission_guides" ADD CONSTRAINT "remission_guides_document_id_electronic_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."electronic_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remission_guides" ADD CONSTRAINT "remission_guides_origin_material_request_id_material_requests_id_fk" FOREIGN KEY ("origin_material_request_id") REFERENCES "public"."material_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remission_guides" ADD CONSTRAINT "remission_guides_related_invoice_id_electronic_documents_id_fk" FOREIGN KEY ("related_invoice_id") REFERENCES "public"."electronic_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remission_guides" ADD CONSTRAINT "remission_guides_carrier_id_entities_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_return_items" ADD CONSTRAINT "request_return_items_return_id_request_returns_id_fk" FOREIGN KEY ("return_id") REFERENCES "public"."request_returns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_return_items" ADD CONSTRAINT "request_return_items_original_request_item_id_material_request_items_id_fk" FOREIGN KEY ("original_request_item_id") REFERENCES "public"."material_request_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_returns" ADD CONSTRAINT "request_returns_request_id_material_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."material_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_returns" ADD CONSTRAINT "request_returns_received_by_entities_id_fk" FOREIGN KEY ("received_by") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_template_items" ADD CONSTRAINT "request_template_items_template_id_request_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."request_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_template_items" ADD CONSTRAINT "request_template_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_products" ADD CONSTRAINT "supplier_products_supplier_id_entities_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_products" ADD CONSTRAINT "supplier_products_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_products" ADD CONSTRAINT "supplier_products_purchase_uom_uom_code_fk" FOREIGN KEY ("purchase_uom") REFERENCES "public"."uom"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_retentions" ADD CONSTRAINT "tax_retentions_invoice_id_invoices_document_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("document_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technical_visits" ADD CONSTRAINT "technical_visits_client_id_entities_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technical_visits" ADD CONSTRAINT "technical_visits_assigned_employee_id_entities_id_fk" FOREIGN KEY ("assigned_employee_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_items" ADD CONSTRAINT "work_order_items_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_items" ADD CONSTRAINT "work_order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_items" ADD CONSTRAINT "work_order_items_requested_uom_uom_code_fk" FOREIGN KEY ("requested_uom") REFERENCES "public"."uom"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_client_id_entities_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_quotation_id_quotations_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "public"."quotations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_menu_parent" ON "auth_menu_items" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "idx_menu_order" ON "auth_menu_items" USING btree ("parent_id","sort_order");--> statement-breakpoint
CREATE INDEX "idx_menu_active" ON "auth_menu_items" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_bom_templates_category" ON "bom_templates" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "idx_categories_parent" ON "categories" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "idx_categories_active" ON "categories" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_docs_access_key" ON "electronic_documents" USING btree ("sri_access_key");--> statement-breakpoint
CREATE INDEX "idx_docs_type_date" ON "electronic_documents" USING btree ("type","issue_date");--> statement-breakpoint
CREATE INDEX "idx_docs_status" ON "electronic_documents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_schedule_date" ON "employee_work_schedules" USING btree ("work_date");--> statement-breakpoint
CREATE INDEX "idx_schedule_employee" ON "employee_work_schedules" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_schedule_wo" ON "employee_work_schedules" USING btree ("work_order_id");--> statement-breakpoint
CREATE INDEX "idx_entities_tax_id" ON "entities" USING btree ("tax_id");--> statement-breakpoint
CREATE INDEX "idx_entities_roles" ON "entities" USING btree ("is_client","is_supplier","is_employee","is_carrier");--> statement-breakpoint
CREATE INDEX "idx_entities_active" ON "entities" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_dim_items_avail" ON "inventory_dimensional_items" USING btree ("product_id","length_cm","width_cm") WHERE status = 'AVAILABLE';--> statement-breakpoint
CREATE INDEX "idx_dim_items_wh_status" ON "inventory_dimensional_items" USING btree ("warehouse_id","status");--> statement-breakpoint
CREATE INDEX "idx_dim_items_variant" ON "inventory_dimensional_items" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "idx_dim_items_parent" ON "inventory_dimensional_items" USING btree ("parent_item_id");--> statement-breakpoint
CREATE INDEX "idx_movements_kardex" ON "inventory_movements" USING btree ("product_id","warehouse_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_movements_type" ON "inventory_movements" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_inv_stock_wh" ON "inventory_stock" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "idx_invoice_items_invoice" ON "invoice_items" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "idx_invoices_ruc" ON "invoices" USING btree ("billed_to_ruc");--> statement-breakpoint
CREATE INDEX "idx_mfg_log_order" ON "manufacturing_log" USING btree ("manufacturing_order_id");--> statement-breakpoint
CREATE INDEX "idx_mfg_log_product" ON "manufacturing_log" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_mfg_inputs_order" ON "manufacturing_order_inputs" USING btree ("manufacturing_order_id");--> statement-breakpoint
CREATE INDEX "idx_pos_items_sale" ON "pos_sale_items" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "idx_pos_sales_session" ON "pos_sales" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_pos_sales_date" ON "pos_sales" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_pos_sales_client" ON "pos_sales" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_pos_sessions_status" ON "pos_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_pos_sessions_register" ON "pos_sessions" USING btree ("cash_register_id","status");--> statement-breakpoint
CREATE INDEX "idx_prices_product" ON "product_prices" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_prices_list" ON "product_prices" USING btree ("price_list_id");--> statement-breakpoint
CREATE INDEX "idx_variants_product" ON "product_variants" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_products_sku" ON "products" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "idx_products_specs" ON "products" USING gin ("specs");--> statement-breakpoint
CREATE INDEX "idx_products_active" ON "products" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_products_category" ON "products" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "idx_products_brand" ON "products" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "idx_products_type" ON "products" USING btree ("product_type");--> statement-breakpoint
CREATE INDEX "idx_products_subtype" ON "products" USING btree ("product_subtype");--> statement-breakpoint
CREATE INDEX "idx_products_cat_active" ON "products" USING btree ("category_id","is_active");--> statement-breakpoint
CREATE INDEX "idx_products_type_subtype" ON "products" USING btree ("product_type","product_subtype");--> statement-breakpoint
CREATE INDEX "idx_quotation_items_quotation" ON "quotation_items" USING btree ("quotation_id");--> statement-breakpoint
CREATE INDEX "idx_quotations_client" ON "quotations" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_quotations_status" ON "quotations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_quotations_date" ON "quotations" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_supplier_products_product" ON "supplier_products" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_visits_client" ON "technical_visits" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_visits_date" ON "technical_visits" USING btree ("visit_date");--> statement-breakpoint
CREATE INDEX "idx_wo_items_order" ON "work_order_items" USING btree ("work_order_id");--> statement-breakpoint
CREATE INDEX "idx_wo_status" ON "work_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_wo_client" ON "work_orders" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_wo_dates" ON "work_orders" USING btree ("start_date","delivery_date");