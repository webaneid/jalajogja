CREATE TABLE "ref_provinces" (
	"id" integer PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ref_regencies" (
	"id" integer PRIMARY KEY NOT NULL,
	"province_id" integer NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ref_districts" (
	"id" integer PRIMARY KEY NOT NULL,
	"regency_id" integer NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ref_villages" (
	"id" bigint PRIMARY KEY NOT NULL,
	"district_id" integer NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"postal_code" text,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ref_professions" (
	"id" smallint PRIMARY KEY NOT NULL,
	"category" text NOT NULL,
	"name" text NOT NULL,
	"order" smallint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" text,
	"detail" text,
	"province_id" integer,
	"regency_id" integer,
	"district_id" integer,
	"village_id" bigint,
	"postal_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text,
	"whatsapp" text,
	"email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_medias" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instagram" text,
	"facebook" text,
	"linkedin" text,
	"twitter" text,
	"youtube" text,
	"tiktok" text,
	"website" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_number" text,
	"stambuk_number" text,
	"nik" text,
	"name" text NOT NULL,
	"gender" text,
	"birth_regency_id" integer,
	"birth_place_text" text,
	"birth_date" date,
	"photo_url" text,
	"graduation_year" smallint,
	"profession_id" smallint,
	"domicile_status" text,
	"domicile_tenant_id" uuid,
	"home_address_id" uuid,
	"contact_id" uuid,
	"social_media_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "members_member_number_unique" UNIQUE("member_number")
);
--> statement-breakpoint
CREATE TABLE "member_educations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"level" text NOT NULL,
	"institution_name" text NOT NULL,
	"major" text,
	"start_year" smallint,
	"end_year" smallint,
	"is_gontor" boolean DEFAULT false NOT NULL,
	"gontor_campus" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member_businesses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"name" text NOT NULL,
	"brand" text,
	"description" text,
	"category" text NOT NULL,
	"sector" text NOT NULL,
	"legality" text,
	"position" text,
	"employees" text,
	"branches" text,
	"revenue" text,
	"address_id" uuid,
	"contact_id" uuid,
	"social_media_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member_domicile_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"from_tenant_id" uuid NOT NULL,
	"to_tenant_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"note" text,
	"admin_note" text,
	"resolved_by" text,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "tenant_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"joined_at" date,
	"registered_via" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_memberships_unique" UNIQUE("tenant_id","member_id")
);
--> statement-breakpoint
ALTER TABLE "ref_regencies" ADD CONSTRAINT "ref_regencies_province_id_ref_provinces_id_fk" FOREIGN KEY ("province_id") REFERENCES "public"."ref_provinces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ref_districts" ADD CONSTRAINT "ref_districts_regency_id_ref_regencies_id_fk" FOREIGN KEY ("regency_id") REFERENCES "public"."ref_regencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ref_villages" ADD CONSTRAINT "ref_villages_district_id_ref_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."ref_districts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_province_id_ref_provinces_id_fk" FOREIGN KEY ("province_id") REFERENCES "public"."ref_provinces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_regency_id_ref_regencies_id_fk" FOREIGN KEY ("regency_id") REFERENCES "public"."ref_regencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_district_id_ref_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."ref_districts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_village_id_ref_villages_id_fk" FOREIGN KEY ("village_id") REFERENCES "public"."ref_villages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_birth_regency_id_ref_regencies_id_fk" FOREIGN KEY ("birth_regency_id") REFERENCES "public"."ref_regencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_profession_id_ref_professions_id_fk" FOREIGN KEY ("profession_id") REFERENCES "public"."ref_professions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_domicile_tenant_id_tenants_id_fk" FOREIGN KEY ("domicile_tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_home_address_id_addresses_id_fk" FOREIGN KEY ("home_address_id") REFERENCES "public"."addresses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_social_media_id_social_medias_id_fk" FOREIGN KEY ("social_media_id") REFERENCES "public"."social_medias"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_educations" ADD CONSTRAINT "member_educations_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_businesses" ADD CONSTRAINT "member_businesses_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_businesses" ADD CONSTRAINT "member_businesses_address_id_addresses_id_fk" FOREIGN KEY ("address_id") REFERENCES "public"."addresses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_businesses" ADD CONSTRAINT "member_businesses_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_businesses" ADD CONSTRAINT "member_businesses_social_media_id_social_medias_id_fk" FOREIGN KEY ("social_media_id") REFERENCES "public"."social_medias"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_domicile_requests" ADD CONSTRAINT "member_domicile_requests_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_domicile_requests" ADD CONSTRAINT "member_domicile_requests_from_tenant_id_tenants_id_fk" FOREIGN KEY ("from_tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_domicile_requests" ADD CONSTRAINT "member_domicile_requests_to_tenant_id_tenants_id_fk" FOREIGN KEY ("to_tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ref_regencies_province_id" ON "ref_regencies" USING btree ("province_id");--> statement-breakpoint
CREATE INDEX "idx_ref_districts_regency_id" ON "ref_districts" USING btree ("regency_id");--> statement-breakpoint
CREATE INDEX "idx_ref_villages_district_id" ON "ref_villages" USING btree ("district_id");--> statement-breakpoint
CREATE INDEX "idx_addresses_province_id" ON "addresses" USING btree ("province_id");--> statement-breakpoint
CREATE INDEX "idx_addresses_regency_id" ON "addresses" USING btree ("regency_id");--> statement-breakpoint
CREATE INDEX "idx_members_birth_regency_id" ON "members" USING btree ("birth_regency_id");--> statement-breakpoint
CREATE INDEX "idx_members_profession_id" ON "members" USING btree ("profession_id");--> statement-breakpoint
CREATE INDEX "idx_members_domicile_tenant_id" ON "members" USING btree ("domicile_tenant_id");--> statement-breakpoint
CREATE INDEX "idx_member_educations_member_id" ON "member_educations" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "idx_member_educations_is_gontor" ON "member_educations" USING btree ("is_gontor");--> statement-breakpoint
CREATE INDEX "idx_member_businesses_member_id" ON "member_businesses" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "idx_member_businesses_sector" ON "member_businesses" USING btree ("sector");--> statement-breakpoint
CREATE INDEX "idx_member_businesses_category" ON "member_businesses" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_domicile_requests_member_id" ON "member_domicile_requests" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "idx_domicile_requests_status" ON "member_domicile_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_domicile_requests_to_tenant_id" ON "member_domicile_requests" USING btree ("to_tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "members_nik_not_null_unique" ON "members" ("nik") WHERE nik IS NOT NULL;