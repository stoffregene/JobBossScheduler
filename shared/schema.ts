import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, decimal, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const jobs = pgTable("jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobNumber: text("job_number").notNull().unique(),
  partNumber: text("part_number").notNull(),
  description: text("description").notNull(),
  quantity: integer("quantity").notNull(),
  dueDate: timestamp("due_date").notNull(),
  createdDate: timestamp("created_date").notNull().default(sql`now()`),
  priority: text("priority").notNull().default("Normal"), // Normal, High, Critical
  status: text("status").notNull().default("Unscheduled"), // Unscheduled, Scheduled, In Progress, Complete, Company Late, Customer Late
  routing: jsonb("routing").$type<RoutingOperation[]>().notNull().default([]),
  estimatedHours: decimal("estimated_hours", { precision: 10, scale: 2 }).notNull().default("0"),
});

export const machines = pgTable("machines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  machineId: text("machine_id").notNull().unique(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  capabilities: jsonb("capabilities").$type<string[]>().notNull().default([]),
  status: text("status").notNull().default("Available"), // Available, Busy, Maintenance, Offline
  utilization: decimal("utilization", { precision: 5, scale: 2 }).notNull().default("0"),
  availableShifts: jsonb("available_shifts").$type<number[]>().notNull().default([1, 2]), // 1 = 1st shift, 2 = 2nd shift
});

export const scheduleEntries = pgTable("schedule_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id),
  machineId: varchar("machine_id").notNull().references(() => machines.id),
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

export type RoutingOperation = {
  sequence: number;
  name: string;
  machineType: string;
  compatibleMachines: string[];
  estimatedHours: number;
  notes?: string;
};

export const insertJobSchema = createInsertSchema(jobs).omit({
  id: true,
  createdDate: true,
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

export type Job = typeof jobs.$inferSelect;
export type InsertJob = z.infer<typeof insertJobSchema>;
export type Machine = typeof machines.$inferSelect;
export type InsertMachine = z.infer<typeof insertMachineSchema>;
export type ScheduleEntry = typeof scheduleEntries.$inferSelect;
export type InsertScheduleEntry = z.infer<typeof insertScheduleEntrySchema>;
export type Alert = typeof alerts.$inferSelect;
export type InsertAlert = z.infer<typeof insertAlertSchema>;

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
