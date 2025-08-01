import { 
  type Job, type InsertJob, 
  type Machine, type InsertMachine, 
  type ScheduleEntry, type InsertScheduleEntry, 
  type Alert, type InsertAlert, 
  type DashboardStats, type RoutingOperation,
  type Resource, type InsertResource,
  type ResourceUnavailability, type InsertResourceUnavailability,
  type InsertRoutingOperation
} from "@shared/schema";

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
  getScheduleEntriesInDateRange(startDate: Date, endDate: Date): Promise<ScheduleEntry[]>;
  createScheduleEntry(entry: InsertScheduleEntry): Promise<ScheduleEntry>;
  updateScheduleEntry(id: string, entry: Partial<ScheduleEntry>): Promise<ScheduleEntry | undefined>;
  deleteScheduleEntry(id: string): Promise<boolean>;

  // Alerts
  getAlerts(): Promise<Alert[]>;
  createAlert(alert: InsertAlert): Promise<Alert>;
  markAlertAsRead(id: string): Promise<boolean>;
  deleteAlert(id: string): Promise<boolean>;

  // Resources
  getResources(): Promise<Resource[]>;
  getResource(id: string): Promise<Resource | undefined>;
  createResource(resource: InsertResource): Promise<Resource>;
  updateResource(id: string, updates: Partial<Resource>): Promise<Resource | undefined>;
  deleteResource(id: string): Promise<boolean>;
  getResourcesByWorkCenter(machineId: string): Promise<Resource[]>;

  // Resource Unavailability
  getResourceUnavailabilities(): Promise<ResourceUnavailability[]>;
  getResourceUnavailability(id: string): Promise<ResourceUnavailability | undefined>;
  createResourceUnavailability(unavailability: InsertResourceUnavailability): Promise<ResourceUnavailability>;
  updateResourceUnavailability(id: string, updates: Partial<ResourceUnavailability>): Promise<ResourceUnavailability | undefined>;
  deleteResourceUnavailability(id: string): Promise<boolean>;
  getResourceUnavailabilitiesInDateRange(startDate: Date, endDate: Date): Promise<ResourceUnavailability[]>;

  // Routing Operations  
  getAllRoutingOperations(): Promise<RoutingOperation[]>;
  getRoutingOperation(id: string): Promise<RoutingOperation | undefined>;
  getRoutingOperationsByJobId(jobId: string): Promise<RoutingOperation[]>;
  createRoutingOperation(operation: InsertRoutingOperation): Promise<RoutingOperation>;
  updateRoutingOperation(id: string, updates: Partial<RoutingOperation>): Promise<RoutingOperation | undefined>;
  deleteRoutingOperation(id: string): Promise<boolean>;

  // Dashboard Stats
  getDashboardStats(): Promise<DashboardStats>;

  // Auto-scheduling methods
  findBestMachineForOperation(operation: RoutingOperation, targetDate: Date, shift: number): Promise<{ machine: Machine; adjustedHours: number; score: number } | null>;
  autoScheduleJob(jobId: string): Promise<ScheduleEntry[] | null>;
  getMachinesBySubstitutionGroup(substitutionGroup: string): Promise<Machine[]>;
}