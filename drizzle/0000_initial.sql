CREATE TABLE IF NOT EXISTS "jobs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
	"job_number" text NOT NULL UNIQUE,
	"part_number" text NOT NULL,
	"description" text NOT NULL,
	"customer" text NOT NULL,
	"quantity" integer NOT NULL,
	"due_date" timestamp NOT NULL,
	"created_date" timestamp NOT NULL DEFAULT now(),
	"order_date" timestamp NOT NULL,
	"promised_date" timestamp NOT NULL,
	"priority" text NOT NULL DEFAULT 'Normal',
	"status" text NOT NULL DEFAULT 'Unscheduled',
	"routing" jsonb NOT NULL DEFAULT '[]',
	"estimated_hours" decimal(10,2) NOT NULL DEFAULT '0',
	"outsourced_vendor" text,
	"lead_days" integer,
	"link_material" boolean NOT NULL DEFAULT false,
	"material" text,
	"routing_modified" boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS "machines" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
	"machine_id" text NOT NULL UNIQUE,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"category" text,
	"subcategory" text,
	"tier" text NOT NULL DEFAULT 'Tier 1',
	"capabilities" jsonb NOT NULL DEFAULT '[]',
	"status" text NOT NULL DEFAULT 'Available',
	"utilization" decimal(5,2) NOT NULL DEFAULT '0',
	"available_shifts" jsonb NOT NULL DEFAULT '[1, 2]',
	"efficiency_factor" decimal(4,2) NOT NULL DEFAULT '1.0',
	"substitution_group" text,
	"spindles" text,
	"live_tooling" boolean DEFAULT false,
	"bar_feeder" boolean DEFAULT false,
	"bar_length" integer,
	"fourth_axis" boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS "schedule_entries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
	"job_id" varchar NOT NULL REFERENCES "jobs"("id") ON DELETE CASCADE,
	"machine_id" varchar NOT NULL REFERENCES "machines"("id") ON DELETE CASCADE,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL,
	"shift" integer NOT NULL,
	"operation_sequence" integer NOT NULL,
	"estimated_hours" decimal(5,2) NOT NULL,
	"actual_hours" decimal(5,2),
	"status" text NOT NULL DEFAULT 'Scheduled',
	"notes" text
);

CREATE TABLE IF NOT EXISTS "alerts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
	"job_id" varchar REFERENCES "jobs"("id") ON DELETE CASCADE,
	"type" text NOT NULL,
	"message" text NOT NULL,
	"severity" text NOT NULL DEFAULT 'Medium',
	"is_read" boolean NOT NULL DEFAULT false,
	"created_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "resources" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" text NOT NULL,
	"employee_id" text NOT NULL UNIQUE,
	"role" text NOT NULL,
	"email" text NOT NULL,
	"work_centers" jsonb NOT NULL DEFAULT '[]',
	"skills" jsonb NOT NULL DEFAULT '[]',
	"shift_schedule" jsonb NOT NULL DEFAULT '[1]',
	"work_schedule" jsonb NOT NULL DEFAULT '{}',
	"hourly_rate" decimal(8,2),
	"overtime_rate" decimal(8,2),
	"status" text NOT NULL DEFAULT 'Active'
);

CREATE TABLE IF NOT EXISTS "resource_unavailability" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
	"resource_id" varchar NOT NULL REFERENCES "resources"("id") ON DELETE CASCADE,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"reason" text NOT NULL,
	"type" text NOT NULL DEFAULT 'Vacation'
);

CREATE TABLE IF NOT EXISTS "routing_operations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
	"job_id" varchar NOT NULL REFERENCES "jobs"("id") ON DELETE CASCADE,
	"sequence" integer NOT NULL,
	"operation_name" text NOT NULL,
	"machine_type" text NOT NULL,
	"compatible_machines" jsonb NOT NULL DEFAULT '[]',
	"required_skills" jsonb NOT NULL DEFAULT '[]',
	"estimated_hours" decimal(10,2) NOT NULL,
	"setup_hours" decimal(10,2) NOT NULL DEFAULT '0',
	"dependencies" jsonb NOT NULL DEFAULT '[]',
	"earliest_start_date" timestamp,
	"latest_finish_date" timestamp,
	"status" text NOT NULL DEFAULT 'Unscheduled',
	"scheduled_start_time" timestamp,
	"scheduled_end_time" timestamp,
	"assigned_machine_id" varchar REFERENCES "machines"("id"),
	"assigned_resource_id" varchar REFERENCES "resources"("id"),
	"original_quoted_machine_id" varchar REFERENCES "machines"("id"),
	"original_estimated_hours" decimal(10,2),
	"efficiency_impact" decimal(5,2) DEFAULT '0',
	"notes" text
);

CREATE TABLE IF NOT EXISTS "material_orders" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
	"job_id" varchar NOT NULL REFERENCES "jobs"("id") ON DELETE CASCADE,
	"material" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit" text NOT NULL,
	"supplier" text NOT NULL,
	"order_date" timestamp NOT NULL,
	"due_date" timestamp NOT NULL,
	"received_date" timestamp,
	"status" text NOT NULL DEFAULT 'Open',
	"cost" decimal(10,2),
	"notes" text
);

CREATE TABLE IF NOT EXISTS "outsourced_operations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
	"job_id" varchar NOT NULL REFERENCES "jobs"("id") ON DELETE CASCADE,
	"operation_sequence" integer NOT NULL,
	"operation_description" text NOT NULL,
	"vendor" text NOT NULL,
	"order_date" timestamp NOT NULL,
	"due_date" timestamp NOT NULL,
	"completed_date" timestamp,
	"status" text NOT NULL DEFAULT 'Open',
	"cost" decimal(10,2),
	"notes" text
);
