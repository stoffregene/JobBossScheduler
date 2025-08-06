import { 
  type Job, type InsertJob, 
  type Machine, type InsertMachine, 
  type ScheduleEntry, type InsertScheduleEntry, 
  type Alert, type InsertAlert, 
  type DashboardStats, 
  type RoutingOperation, type InsertRoutingOperation,
  type MaterialOrder, type InsertMaterialOrder, 
  type OutsourcedOperation, type InsertOutsourcedOperation,
  type Resource, type InsertResource,
  type ResourceUnavailability, type InsertResourceUnavailability,
  type RoutingOperationType
} from "@shared/schema";
import { db } from "./db";
import { 
  jobs, machines, scheduleEntries, alerts, 
  materialOrders, outsourcedOperations, routingOperations,
  resources, resourceUnavailability 
} from "@shared/schema";
import { eq, and, gte, lte, desc, isNull, sql } from "drizzle-orm";
import type { IStorage } from "./storage-interface";
import { barFeederService } from "./bar-feeder-service";
import { OperatorAvailabilityManager, createOperatorAvailabilityManager } from './operator-availability';

export class DatabaseStorage implements IStorage {
  // OPTIMIZATION: Cache frequently accessed data to improve performance
  private scheduleCache: ScheduleEntry[] | null = null;
  private scheduleCacheExpiry: number = 0;
  private readonly CACHE_DURATION = 30000; // 30 seconds cache

  // OPTIMIZATION: Cache machine capabilities for faster lookups
  private machineCapabilitiesCache: Map<string, {
    machine: Machine;
    shifts: number[];
    maxHours: number;
    capabilities: string[];
  }> = new Map();
  
  // ANTI-SPAM: Prevent infinite logging in resource scheduling
  private schedulingLogCache: Set<string> = new Set();

  // Year-round operator availability manager
  private operatorAvailabilityManager: OperatorAvailabilityManager | null = null;

  constructor() {
    this.initializeDefaultData();
  }

  // Initialize or update the operator availability manager
  private async ensureOperatorAvailabilityManager(): Promise<OperatorAvailabilityManager> {
    if (!this.operatorAvailabilityManager) {
      const resources = await this.getResources();
      const unavailabilityEntries = await this.getResourceUnavailabilities();
      this.operatorAvailabilityManager = await createOperatorAvailabilityManager(resources, unavailabilityEntries);
    }
    return this.operatorAvailabilityManager;
  }

  // Update the operator availability manager when data changes
  private async refreshOperatorAvailabilityManager(): Promise<void> {
    const resources = await this.getResources();
    const unavailabilityEntries = await this.getResourceUnavailabilities();
    
    if (this.operatorAvailabilityManager) {
      this.operatorAvailabilityManager.updateData(resources, unavailabilityEntries);
    } else {
      this.operatorAvailabilityManager = await createOperatorAvailabilityManager(resources, unavailabilityEntries);
    }
  }

  private async initializeDefaultData() {
    try {
      // Check if data already exists
      const existingMachines = await db.select().from(machines).limit(1);
      if (existingMachines.length > 0) return;

      console.log('Initializing default manufacturing data...');

      // Create default machines
      const defaultMachines: InsertMachine[] = [
        {
          machineId: "HAAS-VF2",
          name: "Haas VF-2 VMC",
          type: "MILL",
          status: "Available",
          availableShifts: [1, 2],
          capabilities: ["3-Axis Milling", "4-Axis Positioning", "Drilling", "Tapping"],
          substitutionGroup: "VMC",
          efficiencyFactor: "1.0",
          category: "3-Axis Vertical Milling Centers"
        },
        {
          machineId: "MAZAK-QT250",
          name: "Mazak QT250 Lathe",
          type: "LATHE",
          status: "Available",
          availableShifts: [1, 2],
          capabilities: ["Turning", "Boring", "Threading", "Parting"],
          substitutionGroup: "Lathe",
          efficiencyFactor: "1.0",
          category: "Turning Center"
        },
        {
          machineId: "OUTSOURCE-01",
          name: "Outsource Operations",
          type: "OUTSOURCE",
          status: "Available",
          availableShifts: [1, 2],
          capabilities: ["Outsourced Operations"],
          substitutionGroup: "External",
          efficiencyFactor: "1.0",
          category: "Outsourced"
        }
      ];

      // Create default resources (operators) after machines are created
      const createdMachines = await db.insert(machines).values(defaultMachines).returning();

      const defaultResources: InsertResource[] = [
        {
          name: "John Smith",
          employeeId: "EMP001",
          role: "Machinist",
          email: "john.smith@company.com",
          workCenters: [createdMachines[0].id],
          skills: ["CNC Mill", "Setup"],
          shiftSchedule: [1],
          workSchedule: {
            monday: { enabled: true, startTime: "03:00", endTime: "15:00" },
            tuesday: { enabled: true, startTime: "03:00", endTime: "15:00" },
            wednesday: { enabled: true, startTime: "03:00", endTime: "15:00" },
            thursday: { enabled: true, startTime: "03:00", endTime: "15:00" },
            friday: { enabled: false, startTime: "03:00", endTime: "15:00" }
          }
        },
        {
          name: "Jane Doe",
          employeeId: "EMP002",
          role: "Machinist",
          email: "jane.doe@company.com",
          workCenters: [createdMachines[1].id],
          skills: ["CNC Lathe", "Programming"],
          shiftSchedule: [1],
          workSchedule: {
            monday: { enabled: true, startTime: "03:00", endTime: "15:00" },
            tuesday: { enabled: true, startTime: "03:00", endTime: "15:00" },
            wednesday: { enabled: true, startTime: "03:00", endTime: "15:00" },
            thursday: { enabled: true, startTime: "03:00", endTime: "15:00" },
            friday: { enabled: false, startTime: "03:00", endTime: "15:00" }
          }
        }
      ];

      await db.insert(resources).values(defaultResources);

      console.log('Default manufacturing data initialized');
    } catch (error) {
      console.error('Error initializing default data:', error);
    }
  }

  // Jobs
  async getJobs(): Promise<Job[]> {
    return await db.select().from(jobs).orderBy(desc(jobs.createdDate));
  }

  async getJob(id: string): Promise<Job | undefined> {
    const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
    return job || undefined;
  }

  async createJob(job: InsertJob): Promise<Job> {
    const [created] = await db.insert(jobs).values(job).returning();
    return created;
  }

  async updateJob(id: string, updates: Partial<Job>): Promise<Job | undefined> {
    const [job] = await db
      .update(jobs)
      .set(updates)
      .where(eq(jobs.id, id))
      .returning();
    return job || undefined;
  }

  async deleteJob(id: string): Promise<boolean> {
    try {
      // Delete related entries first
      await db.delete(scheduleEntries).where(eq(scheduleEntries.jobId, id));
      await db.delete(alerts).where(eq(alerts.jobId, id));
      await db.delete(jobs).where(eq(jobs.id, id));
      return true;
    } catch (error) {
      console.error('Error deleting job:', error);
      return false;
    }
  }

  async deleteAllJobs(): Promise<number> {
    try {
      // Clear related data first
      await this.clearAllScheduleEntries();
      await db.delete(alerts);
      const result = await db.delete(jobs);
      return result.rowCount || 0;
    } catch (error) {
      console.error('Error deleting all jobs:', error);
      return 0;
    }
  }

  // Machines
  async getMachines(): Promise<Machine[]> {
    return await db.select().from(machines).orderBy(machines.machineId);
  }

  async getMachine(id: string): Promise<Machine | undefined> {
    const [machine] = await db.select().from(machines).where(eq(machines.id, id));
    return machine || undefined;
  }

  async createMachine(machine: InsertMachine): Promise<Machine> {
    const [created] = await db.insert(machines).values(machine).returning();
    return created;
  }

  async updateMachine(id: string, updates: Partial<Machine>): Promise<Machine | undefined> {
    const [machine] = await db
      .update(machines)
      .set(updates)
      .where(eq(machines.id, id))
      .returning();
    return machine || undefined;
  }

  async deleteMachine(id: string): Promise<boolean> {
    try {
      await db.delete(machines).where(eq(machines.id, id));
      return true;
    } catch (error) {
      console.error('Error deleting machine:', error);
      return false;
    }
  }

  // Schedule Entries
  async getScheduleEntries(): Promise<ScheduleEntry[]> {
    if (this.scheduleCache && Date.now() < this.scheduleCacheExpiry) {
      return this.scheduleCache;
    }

    const entries = await db.select().from(scheduleEntries).orderBy(scheduleEntries.startTime);
    this.scheduleCache = entries;
    this.scheduleCacheExpiry = Date.now() + this.CACHE_DURATION;
    return entries;
  }

  async getScheduleEntriesForJob(jobId: string): Promise<ScheduleEntry[]> {
    return await db
      .select()
      .from(scheduleEntries)
      .where(eq(scheduleEntries.jobId, jobId))
      .orderBy(scheduleEntries.operationSequence);
  }

  async getScheduleEntriesByJobId(jobId: string): Promise<ScheduleEntry[]> {
    return this.getScheduleEntriesForJob(jobId);
  }

  async getScheduleEntriesForMachine(machineId: string): Promise<ScheduleEntry[]> {
    return await db
      .select()
      .from(scheduleEntries)
      .where(eq(scheduleEntries.machineId, machineId))
      .orderBy(scheduleEntries.startTime);
  }

  async getScheduleEntriesInDateRange(startDate: Date, endDate: Date): Promise<ScheduleEntry[]> {
    return await db
      .select()
      .from(scheduleEntries)
      .where(
        and(
          gte(scheduleEntries.startTime, startDate),
          lte(scheduleEntries.endTime, endDate)
        )
      )
      .orderBy(scheduleEntries.startTime);
  }

  async createScheduleEntry(entry: InsertScheduleEntry): Promise<ScheduleEntry> {
    const [created] = await db.insert(scheduleEntries).values(entry).returning();
    
    // Clear cache
    this.scheduleCache = null;
    return created;
  }

  async updateScheduleEntry(id: string, updates: Partial<ScheduleEntry>): Promise<ScheduleEntry | undefined> {
    const [entry] = await db
      .update(scheduleEntries)
      .set(updates)
      .where(eq(scheduleEntries.id, id))
      .returning();
    
    // Clear cache
    this.scheduleCache = null;
    return entry || undefined;
  }

  async deleteScheduleEntry(id: string): Promise<boolean> {
    try {
      await db.delete(scheduleEntries).where(eq(scheduleEntries.id, id));
      this.scheduleCache = null;
      return true;
    } catch (error) {
      console.error('Error deleting schedule entry:', error);
      return false;
    }
  }

  async clearAllScheduleEntries(): Promise<void> {
    await db.delete(scheduleEntries);
    this.scheduleCache = null;
  }

  // Alerts
  async getAlerts(): Promise<Alert[]> {
    return await db.select().from(alerts).orderBy(desc(alerts.createdAt));
  }

  async createAlert(alert: InsertAlert): Promise<Alert> {
    const [created] = await db.insert(alerts).values(alert).returning();
    return created;
  }

  async markAlertAsRead(id: string): Promise<boolean> {
    try {
      await db
        .update(alerts)
        .set({ isRead: true })
        .where(eq(alerts.id, id));
      return true;
    } catch (error) {
      console.error('Error marking alert as read:', error);
      return false;
    }
  }

  async deleteAlert(id: string): Promise<boolean> {
    try {
      await db.delete(alerts).where(eq(alerts.id, id));
      return true;
    } catch (error) {
      console.error('Error deleting alert:', error);
      return false;
    }
  }

  // Resources
  async getResources(): Promise<Resource[]> {
    return await db.select().from(resources).orderBy(resources.name);
  }

  async getResource(id: string): Promise<Resource | undefined> {
    const [resource] = await db.select().from(resources).where(eq(resources.id, id));
    return resource || undefined;
  }

  async createResource(resource: InsertResource): Promise<Resource> {
    const [created] = await db.insert(resources).values(resource).returning();
    await this.refreshOperatorAvailabilityManager();
    return created;
  }

  async updateResource(id: string, updates: Partial<Resource>): Promise<Resource | undefined> {
    const [resource] = await db
      .update(resources)
      .set(updates)
      .where(eq(resources.id, id))
      .returning();
    await this.refreshOperatorAvailabilityManager();
    return resource || undefined;
  }

  async deleteResource(id: string): Promise<boolean> {
    try {
      await db.delete(resources).where(eq(resources.id, id));
      await this.refreshOperatorAvailabilityManager();
      return true;
    } catch (error) {
      console.error('Error deleting resource:', error);
      return false;
    }
  }

  async getResourcesByWorkCenter(machineId: string): Promise<Resource[]> {
    return await db
      .select()
      .from(resources)
      .where(sql`${machineId} = ANY(${resources.workCenters})`)
      .orderBy(resources.name);
  }

  // Resource Unavailability
  async getResourceUnavailabilities(): Promise<ResourceUnavailability[]> {
    return await db.select().from(resourceUnavailability).orderBy(resourceUnavailability.startDate);
  }

  async getResourceUnavailability(id: string): Promise<ResourceUnavailability | undefined> {
    const [unavailability] = await db.select().from(resourceUnavailability).where(eq(resourceUnavailability.id, id));
    return unavailability || undefined;
  }

  async createResourceUnavailability(unavailability: InsertResourceUnavailability): Promise<ResourceUnavailability> {
    const [created] = await db.insert(resourceUnavailability).values(unavailability).returning();
    await this.refreshOperatorAvailabilityManager();
    return created;
  }

  async updateResourceUnavailability(id: string, updates: Partial<ResourceUnavailability>): Promise<ResourceUnavailability | undefined> {
    const [unavailability] = await db
      .update(resourceUnavailability)
      .set(updates)
      .where(eq(resourceUnavailability.id, id))
      .returning();
    await this.refreshOperatorAvailabilityManager();
    return unavailability || undefined;
  }

  async deleteResourceUnavailability(id: string): Promise<boolean> {
    try {
      await db.delete(resourceUnavailability).where(eq(resourceUnavailability.id, id));
      await this.refreshOperatorAvailabilityManager();
      return true;
    } catch (error) {
      console.error('Error deleting resource unavailability:', error);
      return false;
    }
  }

  async getResourceUnavailabilitiesInDateRange(startDate: Date, endDate: Date): Promise<ResourceUnavailability[]> {
    return await db
      .select()
      .from(resourceUnavailability)
      .where(
        and(
          gte(resourceUnavailability.startDate, startDate),
          lte(resourceUnavailability.endDate, endDate)
        )
      )
      .orderBy(resourceUnavailability.startDate);
  }

  async getJobsRequiringRescheduling(resourceIds: string[], startDate: Date, endDate: Date, shifts: number[]): Promise<Job[]> {
    // Find all schedule entries affected by the resource unavailability
    const affectedMachines = await db
      .select()
      .from(resources)
      .where(sql`${resources.id} = ANY(${resourceIds})`);
    
    const machineIds = affectedMachines.map(m => m.workCenter).filter(Boolean);
    
    if (machineIds.length === 0) return [];

    const affectedScheduleEntries = await db
      .select()
      .from(scheduleEntries)
      .where(
        and(
          sql`${scheduleEntries.machineId} = ANY(${machineIds})`,
          gte(scheduleEntries.startTime, startDate),
          lte(scheduleEntries.endTime, endDate),
          shifts.length > 0 ? sql`${scheduleEntries.shift} = ANY(${shifts})` : sql`1=1`
        )
      );

    const jobIds = [...new Set(affectedScheduleEntries.map(entry => entry.jobId))];
    
    if (jobIds.length === 0) return [];

    return await db
      .select()
      .from(jobs)
      .where(sql`${jobs.id} = ANY(${jobIds})`);
  }

  // Routing Operations
  async getAllRoutingOperations(): Promise<RoutingOperation[]> {
    return await db.select().from(routingOperations).orderBy(routingOperations.jobId, routingOperations.sequence);
  }

  async getRoutingOperation(id: string): Promise<RoutingOperation | undefined> {
    const [operation] = await db.select().from(routingOperations).where(eq(routingOperations.id, id));
    return operation || undefined;
  }

  async getRoutingOperationsByJobId(jobId: string): Promise<RoutingOperation[]> {
    return await db
      .select()
      .from(routingOperations)
      .where(eq(routingOperations.jobId, jobId))
      .orderBy(routingOperations.sequence);
  }

  async createRoutingOperation(operation: InsertRoutingOperation): Promise<RoutingOperation> {
    const [created] = await db.insert(routingOperations).values(operation).returning();
    return created;
  }

  async updateRoutingOperation(id: string, updates: Partial<RoutingOperation>): Promise<RoutingOperation | undefined> {
    const [operation] = await db
      .update(routingOperations)
      .set(updates)
      .where(eq(routingOperations.id, id))
      .returning();
    return operation || undefined;
  }

  async deleteRoutingOperation(id: string): Promise<boolean> {
    try {
      await db.delete(routingOperations).where(eq(routingOperations.id, id));
      return true;
    } catch (error) {
      console.error('Error deleting routing operation:', error);
      return false;
    }
  }

  // Dashboard Stats
  async getDashboardStats(): Promise<DashboardStats> {
    const allJobs = await this.getJobs();
    const allMachines = await this.getMachines();
    const allScheduleEntries = await this.getScheduleEntries();
    const allAlerts = await this.getAlerts();

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    const todaySchedule = allScheduleEntries.filter(entry => 
      entry.startTime >= todayStart && entry.startTime < todayEnd
    );

    const utilization = allMachines.length > 0 
      ? (todaySchedule.length / (allMachines.length * 2)) * 100 // 2 shifts per machine
      : 0;

    return {
      totalJobs: allJobs.length,
      scheduledJobs: allJobs.filter(job => job.status === 'Scheduled').length,
      totalMachines: allMachines.length,
      availableMachines: allMachines.filter(machine => machine.status === 'Available').length,
      utilization,
      alerts: allAlerts.filter(alert => !alert.isRead).length,
      jobsByStatus: {
        Open: allJobs.filter(job => job.status === 'Open').length,
        Planning: allJobs.filter(job => job.status === 'Planning').length,
        Scheduled: allJobs.filter(job => job.status === 'Scheduled').length,
        'In Production': allJobs.filter(job => job.status === 'In Production').length,
        Complete: allJobs.filter(job => job.status === 'Complete').length,
        Hold: allJobs.filter(job => job.status === 'Hold').length
      }
    };
  }

  // Auto-scheduling methods - Basic implementations
  async findBestMachineForOperation(operation: RoutingOperation, targetDate: Date, shift: number): Promise<{ machine: Machine; adjustedHours: number; score: number; efficiencyImpact?: number } | null> {
    const machines = await this.getMachines();
    const compatibleMachines = machines.filter(machine => 
      machine.status === 'Available' &&
      machine.availableShifts?.includes(shift) &&
      (operation.compatibleMachines.includes(machine.machineId) || 
       operation.machineType === machine.type)
    );

    if (compatibleMachines.length === 0) return null;

    // Simple scoring: prefer machines with higher efficiency
    const bestMachine = compatibleMachines.sort((a, b) => (b.efficiency || 1) - (a.efficiency || 1))[0];
    
    return {
      machine: bestMachine,
      adjustedHours: parseFloat(operation.estimatedHours.toString()) / (bestMachine.efficiency || 1),
      score: bestMachine.efficiency || 1
    };
  }

  async updateAllJobPriorities(): Promise<void> {
    // Basic priority update - can be enhanced
    const jobs = await this.getJobs();
    const now = new Date();
    
    for (const job of jobs) {
      if (job.status === 'Unscheduled' || job.status === 'Open') {
        const promisedDate = new Date(job.promisedDate);
        const daysUntilPromised = Math.ceil((promisedDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
        
        let priority: "Critical" | "High" | "Normal" | "Low";
        if (daysUntilPromised < 0) priority = "Critical";
        else if (daysUntilPromised <= 7) priority = "High";
        else if (daysUntilPromised <= 14) priority = "Normal";
        else priority = "Low";
        
        await this.updateJob(job.id, { priority });
      }
    }
  }

  async scheduleJobsByPriority(maxJobs: number = 100): Promise<{ scheduled: number, failed: number, results: any[] }> {
    // Basic implementation - can be enhanced
    return { scheduled: 0, failed: 0, results: [] };
  }

  async autoScheduleJob(jobId: string, progressCallback?: (progress: any) => void): Promise<{ success: boolean; scheduleEntries?: ScheduleEntry[]; failureReason?: string; failureDetails?: any }> {
    // Basic implementation - can be enhanced
    return { success: false, failureReason: "Auto-scheduling not fully implemented" };
  }

  async manualScheduleJob(jobId: string, startDate: string): Promise<{ success: boolean; scheduleEntries?: ScheduleEntry[]; failureReason?: string }> {
    // Basic implementation - can be enhanced
    return { success: false, failureReason: "Manual scheduling not fully implemented" };
  }

  async dragScheduleJob(jobId: string, machineId: string, startDate: string, shift: number): Promise<{ success: boolean; scheduleEntries?: ScheduleEntry[]; failureReason?: string }> {
    // Basic implementation - can be enhanced
    return { success: false, failureReason: "Drag scheduling not fully implemented" };
  }

  async getMachinesBySubstitutionGroup(substitutionGroup: string): Promise<Machine[]> {
    const allMachines = await this.getMachines();
    return allMachines.filter(machine => machine.substitutionGroup === substitutionGroup);
  }

  async getCompatibleMachines(capability: string, category?: string, tier?: "Tier 1" | "Standard" | "Budget"): Promise<Machine[]> {
    const allMachines = await this.getMachines();
    return allMachines.filter(machine => 
      machine.capabilities?.includes(capability) &&
      (!category || machine.category === category)
    );
  }

  async findOptimalMachineAssignment(routing: any[], priority: "Critical" | "High" | "Normal" | "Low"): Promise<any[]> {
    // Basic implementation - can be enhanced
    return [];
  }

  // Outsourced Operations
  async getOutsourcedOperations(): Promise<OutsourcedOperation[]> {
    return await db.select().from(outsourcedOperations).orderBy(outsourcedOperations.dueDate);
  }

  async getOutsourcedOperationsForJob(jobId: string): Promise<OutsourcedOperation[]> {
    return await db
      .select()
      .from(outsourcedOperations)
      .where(eq(outsourcedOperations.jobId, jobId))
      .orderBy(outsourcedOperations.operationSequence);
  }

  async createOutsourcedOperation(opData: InsertOutsourcedOperation): Promise<OutsourcedOperation> {
    const [created] = await db.insert(outsourcedOperations).values(opData).returning();
    return created;
  }

  async updateOutsourcedOperation(opId: string, updates: Partial<OutsourcedOperation>): Promise<OutsourcedOperation | null> {
    const [operation] = await db
      .update(outsourcedOperations)
      .set(updates)
      .where(eq(outsourcedOperations.id, opId))
      .returning();
    return operation || null;
  }

  async markOutsourcedOperationComplete(opId: string): Promise<OutsourcedOperation | null> {
    return this.updateOutsourcedOperation(opId, { 
      status: "Complete",
      completedDate: new Date()
    });
  }
}