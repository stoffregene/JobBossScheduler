import { type Job, type InsertJob, type Machine, type InsertMachine, type ScheduleEntry, type InsertScheduleEntry, type Alert, type InsertAlert, type DashboardStats, type RoutingOperation } from "@shared/schema";

export interface IStorage {
  // Jobs
  getJobs(): Promise<Job[]>;
  getJob(id: string): Promise<Job | undefined>;
  createJob(job: InsertJob): Promise<Job>;
  updateJob(id: string, job: Partial<Job>): Promise<Job | undefined>;
  deleteJob(id: string): Promise<boolean>;

  // Machines
  getMachines(): Promise<Machine[]>;
  getMachine(id: string): Promise<Machine | undefined>;
  createMachine(machine: InsertMachine): Promise<Machine>;
  updateMachine(id: string, machine: Partial<Machine>): Promise<Machine | undefined>;

  // Schedule
  getScheduleEntries(): Promise<ScheduleEntry[]>;
  getScheduleEntriesForJob(jobId: string): Promise<ScheduleEntry[]>;
  getScheduleEntriesForMachine(machineId: string): Promise<ScheduleEntry[]>;
  createScheduleEntry(entry: InsertScheduleEntry): Promise<ScheduleEntry>;
  updateScheduleEntry(id: string, entry: Partial<ScheduleEntry>): Promise<ScheduleEntry | undefined>;
  deleteScheduleEntry(id: string): Promise<boolean>;

  // Alerts
  getAlerts(): Promise<Alert[]>;
  createAlert(alert: InsertAlert): Promise<Alert>;
  markAlertAsRead(id: string): Promise<boolean>;
  deleteAlert(id: string): Promise<boolean>;

  // Dashboard Stats
  getDashboardStats(): Promise<DashboardStats>;

  // Auto-scheduling methods
  findBestMachineForOperation(operation: RoutingOperation, targetDate: Date, shift: number): Promise<{ machine: Machine; adjustedHours: number; score: number } | null>;
  autoScheduleJob(jobId: string): Promise<ScheduleEntry[] | null>;
  getMachinesBySubstitutionGroup(substitutionGroup: string): Promise<Machine[]>;
}