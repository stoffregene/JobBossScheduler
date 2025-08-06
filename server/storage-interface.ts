import { 
  type Job, type InsertJob, 
  type Machine, type InsertMachine, 
  type ScheduleEntry, type InsertScheduleEntry, 
  type Alert, type InsertAlert, 
  type DashboardStats, type RoutingOperation,
  type Resource, type InsertResource,
  type ResourceUnavailability, type InsertResourceUnavailability,
  type InsertRoutingOperation,

  type OutsourcedOperation, type InsertOutsourcedOperation
} from "@shared/schema";

export interface IStorage {
  // Jobs
  getJobs(): Promise<Job[]>;
  getJob(id: string): Promise<Job | undefined>;
  createJob(job: InsertJob): Promise<Job>;
  updateJob(id: string, job: Partial<Job>): Promise<Job | undefined>;
  deleteJob(id: string): Promise<boolean>;
  deleteAllJobs(): Promise<number>;

  // Machines
  getMachines(): Promise<Machine[]>;
  getMachine(id: string): Promise<Machine | undefined>;
  createMachine(machine: InsertMachine): Promise<Machine>;
  updateMachine(id: string, machine: Partial<Machine>): Promise<Machine | undefined>;
  deleteMachine(id: string): Promise<boolean>;

  // Schedule
  getScheduleEntries(): Promise<ScheduleEntry[]>;
  getScheduleEntriesForJob(jobId: string): Promise<ScheduleEntry[]>;
  getScheduleEntriesByJobId(jobId: string): Promise<ScheduleEntry[]>;
  getScheduleEntriesForMachine(machineId: string): Promise<ScheduleEntry[]>;
  getScheduleEntriesInDateRange(startDate: Date, endDate: Date): Promise<ScheduleEntry[]>;
  createScheduleEntry(entry: InsertScheduleEntry): Promise<ScheduleEntry>;
  updateScheduleEntry(id: string, entry: Partial<ScheduleEntry>): Promise<ScheduleEntry | undefined>;
  deleteScheduleEntry(id: string): Promise<boolean>;
  clearAllScheduleEntries(): Promise<void>;

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
  getJobsRequiringRescheduling(resourceIds: string[], startDate: Date, endDate: Date, shifts: number[]): Promise<Job[]>;

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
  findBestMachineForOperation(operation: RoutingOperation, targetDate: Date, shift: number): Promise<{ machine: Machine; adjustedHours: number; score: number; efficiencyImpact?: number } | null>;
  updateAllJobPriorities(): Promise<void>;
  scheduleJobsByPriority(maxJobs?: number): Promise<{ scheduled: number, failed: number, results: any[] }>;
  autoScheduleJob(jobId: string, progressCallback?: (progress: any) => void): Promise<{ success: boolean; scheduleEntries?: ScheduleEntry[]; failureReason?: string; failureDetails?: any }>;
  manualScheduleJob(jobId: string, startDate: string): Promise<{ success: boolean; scheduleEntries?: ScheduleEntry[]; failureReason?: string }>;
  dragScheduleJob(jobId: string, machineId: string, startDate: string, shift: number): Promise<{ success: boolean; scheduleEntries?: ScheduleEntry[]; failureReason?: string }>;
  getMachinesBySubstitutionGroup(substitutionGroup: string): Promise<Machine[]>;
  
  // Efficiency tracking
  getEfficiencyImpactData(): Promise<{
    totalOperations: number;
    substitutedOperations: number;
    averageEfficiencyImpact: number;
    worstImpacts: Array<{
      jobNumber: string;
      operationName: string;
      originalMachine: string;
      assignedMachine: string;
      efficiencyImpact: number;
    }>;
  }>;
  getCompatibleMachines(capability: string, category?: string, tier?: "Tier 1" | "Standard" | "Budget"): Promise<Machine[]>;
  findOptimalMachineAssignment(routing: any[], priority: "Critical" | "High" | "Normal" | "Low"): Promise<any[]>;

  // Material Orders
  getMaterialOrders(): Promise<MaterialOrder[]>;
  getMaterialOrdersForJob(jobId: string): Promise<MaterialOrder[]>;
  createMaterialOrder(orderData: InsertMaterialOrder): Promise<MaterialOrder>;
  updateMaterialOrder(orderId: string, updates: Partial<MaterialOrder>): Promise<MaterialOrder | null>;
  markMaterialReceived(orderId: string): Promise<MaterialOrder | null>;
  deleteAllMaterialOrders(): Promise<number>;
  deleteAllJobsAwaitingMaterial(): Promise<number>;
  getJobsAwaitingMaterial(): Promise<Array<Job & { materialOrders: MaterialOrder[] }>>;
  isJobReadyForScheduling(jobId: string): Promise<{ ready: boolean; reason?: string; pendingMaterials?: MaterialOrder[] }>;
  autoScheduleJobWithMaterialCheck(jobId: string): Promise<{ success: boolean; scheduleEntries?: ScheduleEntry[]; reason?: string; pendingItems?: any[] }>;

  // Outsourced Operations
  getOutsourcedOperations(): Promise<OutsourcedOperation[]>;
  getOutsourcedOperationsForJob(jobId: string): Promise<OutsourcedOperation[]>;
  createOutsourcedOperation(opData: InsertOutsourcedOperation): Promise<OutsourcedOperation>;
  updateOutsourcedOperation(opId: string, updates: Partial<OutsourcedOperation>): Promise<OutsourcedOperation | null>;
  markOutsourcedOperationComplete(opId: string): Promise<OutsourcedOperation | null>;
}