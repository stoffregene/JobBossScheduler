import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, decimal, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const jobs = pgTable("jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobNumber: text("job_number").notNull().unique(),
  partNumber: text("part_number").notNull(),
  description: text("description").notNull(),
  customer: text("customer").notNull(),
  quantity: integer("quantity").notNull(),
  dueDate: timestamp("due_date").notNull(),
  createdDate: timestamp("created_date").notNull().default(sql`now()`),
  orderDate: timestamp("order_date").notNull(),
  promisedDate: timestamp("promised_date").notNull(),
  priority: text("priority").notNull().default("Normal"), // Normal, High, Critical
  status: text("status").notNull().default("Unscheduled"), // Unscheduled, Scheduled, In Progress, Complete, Company Late, Customer Late
  routing: jsonb("routing").$type<RoutingOperationType[]>().notNull().default([]),
  estimatedHours: decimal("estimated_hours", { precision: 10, scale: 2 }).notNull().default("0"),
  outsourcedVendor: text("outsourced_vendor"), // WC_Vendor from CSV
  leadDays: integer("lead_days"), // Lead_Days from CSV
  linkMaterial: boolean("link_material").notNull().default(false), // Link_Material from CSV
  material: text("material"), // Material from CSV
  routingModified: boolean("routing_modified").default(false), // Track if routing was changed during scheduling
});

export const machines = pgTable("machines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  machineId: text("machine_id").notNull().unique(),
  name: text("name").notNull(),
  type: text("type").notNull(), // MILL, LATHE, WATERJET, BEAD BLAST, SAW, WELD, INSPECT, ASSEMBLE, OUTSOURCE
  category: text("category"), // For MILL: Horizontal Milling Centers, 3-Axis Vertical Milling Centers, etc.
  subcategory: text("subcategory"), // For detailed groupings like Bar Fed Lathes, Live Tooling Lathes
  tier: text("tier").notNull().default("Tier 1"), // Tier 1 for all main machine types
  capabilities: jsonb("capabilities").$type<string[]>().notNull().default([]),
  status: text("status").notNull().default("Available"), // Available, Busy, Maintenance, Offline
  utilization: decimal("utilization", { precision: 5, scale: 2 }).notNull().default("0"),
  availableShifts: jsonb("available_shifts").$type<number[]>().notNull().default([1, 2]), // 1 = 1st shift, 2 = 2nd shift
  efficiencyFactor: decimal("efficiency_factor", { precision: 4, scale: 2 }).notNull().default("1.0"), // 1.0 = baseline, 0.8 = 20% slower, 1.2 = 20% faster
  substitutionGroup: text("substitution_group"), // Machines in same group can substitute for each other
  spindles: text("spindles"), // For lathes: Single or Dual
  liveTooling: boolean("live_tooling").default(false), // For lathes with live tooling capability
  barFeeder: boolean("bar_feeder").default(false), // For bar fed lathes
  barLength: integer("bar_length"), // Bar feeder length in feet (12 for SL-204, 6 for others)
  fourthAxis: boolean("fourth_axis").default(false), // For VMCs with 4th axis capability
});

export const scheduleEntries = pgTable("schedule_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id),
  machineId: varchar("machine_id").notNull().references(() => machines.id),
  assignedResourceId: varchar("assigned_resource_id").references(() => resources.id), // Which operator/resource is assigned
  operationSequence: integer("operation_sequence").notNull(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  shift: integer("shift").notNull(), // 1 or 2
  status: text("status").notNull().default("Scheduled"), // Scheduled, In Progress, Complete
});

export const alerts = pgTable("alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(), // error, warning, info, success
  title: text("title").notNull(),
  message: text("message").notNull(),
  jobId: varchar("job_id").references(() => jobs.id),
  machineId: varchar("machine_id").references(() => machines.id),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Resource availability tracking for operators/technicians
export const resources = pgTable("resources", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: text("employee_id").notNull().unique(),
  name: text("name").notNull(),
  email: text("email"),
  role: text("role").notNull(), // Operator, Technician, Inspector, etc.
  workCenters: jsonb("work_centers").$type<string[]>().notNull().default([]), // Machine IDs they can operate
  skills: jsonb("skills").$type<string[]>().notNull().default([]), // Skill sets
  shiftSchedule: jsonb("shift_schedule").$type<number[]>().notNull().default([1]), // Normal shifts
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Resource unavailability periods (vacation, sick, training, etc.)
export const resourceUnavailability = pgTable("resource_unavailability", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  resourceId: varchar("resource_id").notNull().references(() => resources.id),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  startTime: text("start_time"), // "08:00" for hour-based granularity (24hr format)
  endTime: text("end_time"), // "12:00" for hour-based granularity (24hr format)
  isPartialDay: boolean("is_partial_day").notNull().default(false), // true for hour-based unavailability
  reason: text("reason").notNull(), // Vacation, Sick, Training, Meeting, etc.
  shifts: jsonb("shifts").$type<number[]>().notNull().default([1, 2]), // Which shifts affected
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  createdBy: text("created_by").notNull(), // Who marked them unavailable
});

// Enhanced routing operations with dependencies and constraints
export const routingOperations = pgTable("routing_operations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id),
  sequence: integer("sequence").notNull(),
  operationName: text("operation_name").notNull(),
  machineType: text("machine_type").notNull(),
  compatibleMachines: jsonb("compatible_machines").$type<string[]>().notNull().default([]),
  requiredSkills: jsonb("required_skills").$type<string[]>().notNull().default([]),
  estimatedHours: decimal("estimated_hours", { precision: 10, scale: 2 }).notNull(),
  setupHours: decimal("setup_hours", { precision: 10, scale: 2 }).notNull().default("0"),
  dependencies: jsonb("dependencies").$type<number[]>().notNull().default([]), // Previous operation sequences that must complete first
  earliestStartDate: timestamp("earliest_start_date"), // Constraint from customer or engineering
  latestFinishDate: timestamp("latest_finish_date"), // Due date constraint for this operation
  status: text("status").notNull().default("Unscheduled"), // Unscheduled, Scheduled, In Progress, Complete
  scheduledStartTime: timestamp("scheduled_start_time"),
  scheduledEndTime: timestamp("scheduled_end_time"),
  assignedMachineId: varchar("assigned_machine_id").references(() => machines.id),
  assignedResourceId: varchar("assigned_resource_id").references(() => resources.id),
  originalQuotedMachineId: varchar("original_quoted_machine_id").references(() => machines.id), // Machine operation was originally quoted for
  originalEstimatedHours: decimal("original_estimated_hours", { precision: 10, scale: 2 }), // Original estimate for the quoted machine
  efficiencyImpact: decimal("efficiency_impact", { precision: 5, scale: 2 }).default("0"), // Percentage impact from substitution (+ is slower, - is faster)
  notes: text("notes"),
});

// Material Orders table - tracks material requirements for jobs
export const materialOrders = pgTable("material_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id),
  orderNumber: text("order_number").notNull(), // Material order number from JobBoss
  materialDescription: text("material_description").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 3 }).notNull(),
  unit: text("unit").notNull(), // 'EA', 'LB', 'FT', etc.
  supplier: text("supplier"),
  orderDate: timestamp("order_date").notNull(),
  dueDate: timestamp("due_date").notNull(),
  receivedDate: timestamp("received_date"), // null until received
  status: text("status").notNull().default("Open"), // 'Open', 'Closed', 'Cancelled'
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

// Outsourced Operations table - tracks operations sent to external vendors
export const outsourcedOperations = pgTable("outsourced_operations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id),
  operationSequence: integer("operation_sequence").notNull(),
  operationDescription: text("operation_description").notNull(),
  vendor: text("vendor").notNull(),
  poNumber: text("po_number"), // Purchase order number
  orderDate: timestamp("order_date").notNull(),
  dueDate: timestamp("due_date").notNull(),
  completedDate: timestamp("completed_date"), // null until completed
  status: text("status").notNull().default("Open"), // 'Open', 'In Progress', 'Completed', 'Cancelled'
  cost: decimal("cost", { precision: 10, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export type RoutingOperationType = {
  sequence: number;
  name: string;
  machineType: string;
  compatibleMachines: string[];
  estimatedHours: number;
  notes?: string;
  operationType?: string; // SAW, TURN, MILL, etc.
  barLength?: number; // Required bar length in feet for bar fed operations
};

export const insertJobSchema = createInsertSchema(jobs).omit({
  id: true,
  createdDate: true,
}).extend({
  dueDate: z.string().or(z.date()).transform(str => typeof str === 'string' ? new Date(str) : str),
  orderDate: z.string().or(z.date()).transform(str => typeof str === 'string' ? new Date(str) : str),
  promisedDate: z.string().or(z.date()).transform(str => typeof str === 'string' ? new Date(str) : str),
  estimatedHours: z.string().or(z.number()).transform(val => typeof val === 'number' ? val.toString() : val),
  routing: z.array(z.any()).optional().default([]),
});

export const insertMachineSchema = createInsertSchema(machines).omit({
  id: true,
});

export const insertScheduleEntrySchema = createInsertSchema(scheduleEntries).omit({
  id: true,
});

export const insertAlertSchema = createInsertSchema(alerts).omit({
  id: true,
  createdAt: true,
});

export const insertResourceSchema = createInsertSchema(resources).omit({
  id: true,
  createdAt: true,
});

export const insertResourceUnavailabilitySchema = createInsertSchema(resourceUnavailability).omit({
  id: true,
  createdAt: true,
});

export const insertRoutingOperationSchema = createInsertSchema(routingOperations).omit({
  id: true,
});

export const insertMaterialOrderSchema = createInsertSchema(materialOrders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  orderDate: z.string().or(z.date()).transform(str => typeof str === 'string' ? new Date(str) : str),
  dueDate: z.string().or(z.date()).transform(str => typeof str === 'string' ? new Date(str) : str),
});

export const insertOutsourcedOperationSchema = createInsertSchema(outsourcedOperations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Job = typeof jobs.$inferSelect;
export type InsertJob = z.infer<typeof insertJobSchema>;
export type Machine = typeof machines.$inferSelect;
export type InsertMachine = z.infer<typeof insertMachineSchema>;
export type ScheduleEntry = typeof scheduleEntries.$inferSelect;
export type InsertScheduleEntry = z.infer<typeof insertScheduleEntrySchema>;
export type Alert = typeof alerts.$inferSelect;
export type InsertAlert = z.infer<typeof insertAlertSchema>;
export type Resource = typeof resources.$inferSelect;
export type InsertResource = z.infer<typeof insertResourceSchema>;
export type ResourceUnavailability = typeof resourceUnavailability.$inferSelect;
export type InsertResourceUnavailability = z.infer<typeof insertResourceUnavailabilitySchema>;
export type RoutingOperation = typeof routingOperations.$inferSelect;
export type InsertRoutingOperation = z.infer<typeof insertRoutingOperationSchema>;
export type MaterialOrder = typeof materialOrders.$inferSelect;
export type InsertMaterialOrder = z.infer<typeof insertMaterialOrderSchema>;
export type OutsourcedOperation = typeof outsourcedOperations.$inferSelect;
export type InsertOutsourcedOperation = z.infer<typeof insertOutsourcedOperationSchema>;

export type DashboardStats = {
  activeJobs: number;
  utilization: number;
  lateJobs: number;
  atRiskJobs: number;
  customerLateJobs: number;
  companyLateJobs: number;
  totalCapacity: number;
  usedCapacity: number;
  shift1Resources: number;
  shift2Resources: number;
};

// Rescheduling and conflict detection
export type ScheduleConflict = {
  id: string;
  type: 'resource_unavailable' | 'machine_conflict' | 'dependency_violation' | 'due_date_risk';
  severity: 'low' | 'medium' | 'high' | 'critical';
  jobId: string;
  operationId?: string;
  resourceId?: string;
  machineId?: string;
  conflictStart: Date;
  conflictEnd: Date;
  impact: string;
  suggestedActions: string[];
};

export type RescheduleRequest = {
  reason: string;
  affectedResourceIds?: string[];
  affectedMachineIds?: string[];
  unavailabilityStart: Date;
  unavailabilityEnd: Date;
  shifts: number[];
  forceReschedule: boolean;
  prioritizeJobs?: string[]; // Job IDs to prioritize during rescheduling
};

export type RescheduleResult = {
  success: boolean;
  conflictsResolved: number;
  jobsRescheduled: number;
  operationsRescheduled: number;
  unresolvableConflicts: ScheduleConflict[];
  warnings: string[];
  summary: string;
};
