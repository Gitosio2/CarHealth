CREATE TYPE "public"."maintenance_performed_by" AS ENUM('self', 'workshop');--> statement-breakpoint
CREATE TYPE "public"."odometer_source" AS ENUM('manual', 'maintenance');--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_subject" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_auth_subject_unique" UNIQUE("auth_subject")
);
--> statement-breakpoint
CREATE TABLE "maintenances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"performed_at" timestamp with time zone NOT NULL,
	"notes" text,
	"performed_by" "maintenance_performed_by" NOT NULL,
	"workshop_id" uuid,
	"total_cost" numeric(10, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "maintenances_workshop_only_when_workshop_performed" CHECK ("maintenances"."performed_by" = 'workshop' or "maintenances"."workshop_id" is null),
	CONSTRAINT "maintenances_total_cost_non_negative" CHECK ("maintenances"."total_cost" is null or "maintenances"."total_cost" >= 0)
);
--> statement-breakpoint
CREATE TABLE "parts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"name" varchar(160) NOT NULL,
	"part_number" varchar(80),
	"quantity" numeric(10, 3) NOT NULL,
	"unit_price" numeric(10, 2),
	CONSTRAINT "parts_quantity_positive" CHECK ("parts"."quantity" > 0),
	CONSTRAINT "parts_unit_price_non_negative" CHECK ("parts"."unit_price" is null or "parts"."unit_price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "task_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid,
	"name" varchar(120) NOT NULL,
	"interval_km" integer,
	"interval_months" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_types_interval_km_positive" CHECK ("task_types"."interval_km" is null or "task_types"."interval_km" > 0),
	CONSTRAINT "task_types_interval_months_positive" CHECK ("task_types"."interval_months" is null or "task_types"."interval_months" > 0)
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"maintenance_id" uuid NOT NULL,
	"task_type_id" uuid NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "workshops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "odometer_readings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"kilometers" integer NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	"source" "odometer_source" NOT NULL,
	"maintenance_id" uuid,
	CONSTRAINT "odometer_readings_kilometers_non_negative" CHECK ("odometer_readings"."kilometers" >= 0),
	CONSTRAINT "odometer_readings_maintenance_link" CHECK (("odometer_readings"."source" = 'maintenance') = ("odometer_readings"."maintenance_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "vehicle_task_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"task_type_id" uuid NOT NULL,
	"interval_km" integer,
	"interval_months" integer,
	"baseline_date" date,
	"baseline_km" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vehicle_task_schedules_interval_km_positive" CHECK ("vehicle_task_schedules"."interval_km" is null or "vehicle_task_schedules"."interval_km" > 0),
	CONSTRAINT "vehicle_task_schedules_interval_months_positive" CHECK ("vehicle_task_schedules"."interval_months" is null or "vehicle_task_schedules"."interval_months" > 0),
	CONSTRAINT "vehicle_task_schedules_baseline_km_non_negative" CHECK ("vehicle_task_schedules"."baseline_km" is null or "vehicle_task_schedules"."baseline_km" >= 0)
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"make" varchar(100) NOT NULL,
	"model" varchar(100) NOT NULL,
	"plate" varchar(20) NOT NULL,
	"vin" varchar(17),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "maintenances" ADD CONSTRAINT "maintenances_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenances" ADD CONSTRAINT "maintenances_workshop_id_workshops_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshops"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parts" ADD CONSTRAINT "parts_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_types" ADD CONSTRAINT "task_types_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_maintenance_id_maintenances_id_fk" FOREIGN KEY ("maintenance_id") REFERENCES "public"."maintenances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_task_type_id_task_types_id_fk" FOREIGN KEY ("task_type_id") REFERENCES "public"."task_types"("id") ON DELETE no action ON UPDATE no action DEFERRABLE INITIALLY DEFERRED;--> statement-breakpoint
ALTER TABLE "workshops" ADD CONSTRAINT "workshops_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "odometer_readings" ADD CONSTRAINT "odometer_readings_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "odometer_readings" ADD CONSTRAINT "odometer_readings_maintenance_id_maintenances_id_fk" FOREIGN KEY ("maintenance_id") REFERENCES "public"."maintenances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_task_schedules" ADD CONSTRAINT "vehicle_task_schedules_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_task_schedules" ADD CONSTRAINT "vehicle_task_schedules_task_type_id_task_types_id_fk" FOREIGN KEY ("task_type_id") REFERENCES "public"."task_types"("id") ON DELETE no action ON UPDATE no action DEFERRABLE INITIALLY DEFERRED;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "maintenances_vehicle_performed_at_idx" ON "maintenances" USING btree ("vehicle_id","performed_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "maintenances_workshop_idx" ON "maintenances" USING btree ("workshop_id");--> statement-breakpoint
CREATE INDEX "parts_task_idx" ON "parts" USING btree ("task_id");--> statement-breakpoint
CREATE UNIQUE INDEX "task_types_profile_name_unique" ON "task_types" USING btree ("profile_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "task_types_shared_name_unique" ON "task_types" USING btree ("name") WHERE "task_types"."profile_id" is null;--> statement-breakpoint
CREATE INDEX "tasks_maintenance_idx" ON "tasks" USING btree ("maintenance_id");--> statement-breakpoint
CREATE INDEX "tasks_task_type_idx" ON "tasks" USING btree ("task_type_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workshops_profile_name_unique" ON "workshops" USING btree ("profile_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "odometer_readings_maintenance_unique" ON "odometer_readings" USING btree ("maintenance_id");--> statement-breakpoint
CREATE INDEX "odometer_readings_vehicle_recorded_at_idx" ON "odometer_readings" USING btree ("vehicle_id","recorded_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_task_schedules_vehicle_task_type_unique" ON "vehicle_task_schedules" USING btree ("vehicle_id","task_type_id");--> statement-breakpoint
CREATE INDEX "vehicle_task_schedules_task_type_idx" ON "vehicle_task_schedules" USING btree ("task_type_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicles_profile_plate_unique" ON "vehicles" USING btree ("profile_id","plate");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicles_profile_vin_unique" ON "vehicles" USING btree ("profile_id","vin") WHERE "vehicles"."vin" is not null;