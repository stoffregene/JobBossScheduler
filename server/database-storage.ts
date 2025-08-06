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

  constructor() {
    this.initializeDefaultData();
  }

  private async initializeDefaultData() {
    try {
      // Check if data already exists
      const existingMachines = await db.select().from(machines).limit(1);
      if (existingMachines.length > 0) return;

      // Initialize machines based on user's exact machine hierarchy
      const defaultMachines: InsertMachine[] = [
        // OUTSOURCE work center for third-party operations
        { 
          machineId: "OUTSOURCE-01", 
          name: "Outsourced Operations", 
          type: "OUTSOURCE", 
          category: "Third Party",
          subcategory: "External Vendor",
          tier: "External", 
          capabilities: ["plating", "coating", "heat_treat", "finishing"], 
          status: "Available", 
          utilization: "0", 
          availableShifts: [1, 2, 3], // Available 24/7 since it's external
          efficiencyFactor: "1.0", 
          substitutionGroup: null // No substitution for outsourced work
        },
        // MILL - Horizontal Milling Centers
        { 
          machineId: "HMC-001", 
          name: "MAZAK HCN5000 NEO", 
          type: "MILL", 
          category: "Horizontal Milling Centers",
          tier: "Tier 1", 
          capabilities: ["horizontal_milling", "drilling", "tapping", "boring"], 
          status: "Available", 
          utilization: "85", 
          availableShifts: [1, 2], 
          efficiencyFactor: "1.2", 
          substitutionGroup: "hmc_group" 
        },
        { 
          machineId: "HMC-002", 
          name: "MORI-SEIKI MH-50", 
          type: "MILL", 
          category: "Horizontal Milling Centers",
          tier: "Tier 1", 
          capabilities: ["horizontal_milling", "drilling", "tapping", "boring"], 
          status: "Available", 
          utilization: "72", 
          availableShifts: [1, 2], 
          efficiencyFactor: "1.15", 
          substitutionGroup: "hmc_group" 
        },
        
        // MILL - 3-Axis Vertical Milling Centers
        { 
          machineId: "VMC-001", 
          name: "HAAS VF-4SS", 
          type: "MILL", 
          category: "3-Axis Vertical Milling Centers",
          tier: "Tier 1", 
          capabilities: ["vertical_milling", "drilling", "tapping"], 
          status: "Available", 
          utilization: "78", 
          availableShifts: [1, 2], 
          efficiencyFactor: "1.1", 
          substitutionGroup: "vmc_3axis_group" 
        },
        { 
          machineId: "VMC-002", 
          name: "FADAL 4020", 
          type: "MILL", 
          category: "3-Axis Vertical Milling Centers",
          tier: "Tier 1", 
          capabilities: ["vertical_milling", "drilling", "tapping"], 
          status: "Available", 
          utilization: "65", 
          availableShifts: [1, 2], 
          efficiencyFactor: "1.0", 
          substitutionGroup: "vmc_3axis_group" 
        },
        { 
          machineId: "VMC-003", 
          name: "YAMA-SEIKI BM-1200", 
          type: "MILL", 
          category: "3-Axis Vertical Milling Centers",
          tier: "Tier 1", 
          capabilities: ["vertical_milling", "drilling", "tapping"], 
          status: "Available", 
          utilization: "55", 
          availableShifts: [1, 2], 
          efficiencyFactor: "1.05", 
          substitutionGroup: "vmc_3axis_group" 
        },
        
        // MILL - 3-Axis VMC's with pseudo 4th axis
        { 
          machineId: "VMC-004", 
          name: "VESTA 1050B", 
          type: "MILL", 
          category: "3-Axis VMC's with pseudo 4th axis",
          tier: "Tier 1", 
          capabilities: ["vertical_milling", "drilling", "tapping", "4th_axis"], 
          status: "Available", 
          utilization: "82", 
          availableShifts: [1, 2], 
          efficiencyFactor: "1.15", 
          substitutionGroup: "vmc_4axis_group",
          fourthAxis: true
        },
        { 
          machineId: "VMC-005", 
          name: "MORI-SEIKI MV-653", 
          type: "MILL", 
          category: "3-Axis VMC's with pseudo 4th axis",
          tier: "Tier 1", 
          capabilities: ["vertical_milling", "drilling", "tapping", "4th_axis"], 
          status: "Available", 
          utilization: "68", 
          availableShifts: [1, 2], 
          efficiencyFactor: "1.2", 
          substitutionGroup: "vmc_4axis_group",
          fourthAxis: true
        },
        
        // MILL - Large envelope VMC's (Note: MORI-SEIKI MV-653 is listed in both categories as per user specification)
        { 
          machineId: "VMC-006", 
          name: "OKUMA MC-6VA", 
          type: "MILL", 
          category: "Large envelope VMC's",
          tier: "Tier 1", 
          capabilities: ["large_envelope_milling", "vertical_milling", "drilling", "tapping"], 
          status: "Available", 
          utilization: "45", 
          availableShifts: [1, 2], 
          efficiencyFactor: "1.25", 
          substitutionGroup: "large_vmc_group" 
        },
        
        // LATHE - Bar Fed Lathes
        { 
          machineId: "LATHE-001", 
          name: "MORI-SEIKI SL-204", 
          type: "LATHE", 
          category: "Bar Fed Lathes",
          subcategory: "Live Tooling Lathes",
          tier: "Tier 1", 
          capabilities: ["turning", "drilling", "live_tooling", "bar_feeding"], 
          status: "Available", 
          utilization: "75", 
          availableShifts: [1, 2], 
          efficiencyFactor: "1.15", 
          substitutionGroup: "bar_fed_lathe_group",
          spindles: "Single",
          liveTooling: true,
          barFeeder: true,
          barLength: 12
        },
        { 
          machineId: "LATHE-002", 
          name: "HAAS DS30Y", 
          type: "LATHE", 
          category: "Bar Fed Lathes",
          subcategory: "Live Tooling Lathes",
          tier: "Tier 1", 
          capabilities: ["turning", "drilling", "live_tooling", "bar_feeding", "dual_spindle"], 
          status: "Available", 
          utilization: "88", 
          availableShifts: [1, 2], 
          efficiencyFactor: "1.3", 
          substitutionGroup: "dual_spindle_group",
          spindles: "Dual",
          liveTooling: true,
          barFeeder: true,
          barLength: 6
        },
        { 
          machineId: "LATHE-003", 
          name: "FEMCO HL-25", 
          type: "LATHE", 
          category: "Bar Fed Lathes",
          tier: "Tier 1", 
          capabilities: ["turning", "drilling", "bar_feeding"], 
          status: "Available", 
          utilization: "52", 
          availableShifts: [1, 2], 
          efficiencyFactor: "1.0", 
          substitutionGroup: "bar_fed_lathe_group",
          spindles: "Single",
          liveTooling: false,
          barFeeder: true,
          barLength: 6
        },
        
        // LATHE - Single Spindle Lathes (new SL-25 machines)
        { 
          machineId: "LATHE-006", 
          name: "MORI-SEIKI SL-25 (Gray)", 
          type: "LATHE", 
          category: "Single Spindle Lathes",
          tier: "Tier 1", 
          capabilities: ["turning", "drilling"], 
          status: "Available", 
          utilization: "35", 
          availableShifts: [1, 2], 
          efficiencyFactor: "0.9", 
          substitutionGroup: "single_spindle_lathe_group",
          spindles: "Single",
          liveTooling: false,
          barFeeder: false
        },
        { 
          machineId: "LATHE-007", 
          name: "MORI-SEIKI SL-25 (Blue)", 
          type: "LATHE", 
          category: "Single Spindle Lathes",
          tier: "Tier 1", 
          capabilities: ["turning", "drilling"], 
          status: "Available", 
          utilization: "28", 
          availableShifts: [1, 2], 
          efficiencyFactor: "0.9", 
          substitutionGroup: "single_spindle_lathe_group",
          spindles: "Single",
          liveTooling: false,
          barFeeder: false
        },
        
        // LATHE - Live Tooling Lathes (additional ones not already listed)
        { 
          machineId: "LATHE-004", 
          name: "HAAS ST30Y", 
          type: "LATHE", 
          category: "Live Tooling Lathes",
          tier: "Tier 1", 
          capabilities: ["turning", "drilling", "live_tooling"], 
          status: "Available", 
          utilization: "62", 
          availableShifts: [1, 2], 
          efficiencyFactor: "1.1", 
          substitutionGroup: "live_tooling_group",
          spindles: "Single",
          liveTooling: true,
          barFeeder: false
        },
        { 
          machineId: "LATHE-005", 
          name: "MAZAK QTN 350IIMY", 
          type: "LATHE", 
          category: "Live Tooling Lathes",
          tier: "Tier 1", 
          capabilities: ["turning", "drilling", "live_tooling", "y_axis"], 
          status: "Available", 
          utilization: "70", 
          availableShifts: [1, 2], 
          efficiencyFactor: "1.2", 
          substitutionGroup: "live_tooling_group",
          spindles: "Single",
          liveTooling: true,
          barFeeder: false
        },
        
        // SAWS
        { 
          machineId: "SAW-001", 
          name: "AMADA HFA", 
          type: "SAW", 
          tier: "Tier 1", 
          capabilities: ["cutting", "sawing"], 
          status: "Available", 
          utilization: "35", 
          availableShifts: [1, 2], 
          efficiencyFactor: "1.0", 
          substitutionGroup: "saw_group" 
        },
        { 
          machineId: "SAW-002", 
          name: "HYD-MECH", 
          type: "SAW", 
          tier: "Tier 1", 
          capabilities: ["cutting", "sawing"], 
          status: "Available", 
          utilization: "28", 
          availableShifts: [1, 2], 
          efficiencyFactor: "1.0", 
          substitutionGroup: "saw_group" 
        },
        
        // WATERJET
        { 
          machineId: "WJ-001", 
          name: "FLOW MACH 500", 
          type: "WATERJET", 
          tier: "Tier 1", 
          capabilities: ["waterjet_cutting", "precision_cutting"], 
          status: "Available", 
          utilization: "45", 
          availableShifts: [1, 2], 
          efficiencyFactor: "1.1", 
          substitutionGroup: "waterjet_group" 
        },
        
        // WELD
        { 
          machineId: "WELD-001", 
          name: "WELD BAY", 
          type: "WELD", 
          tier: "Tier 1", 
          capabilities: ["welding", "tig", "mig", "fabrication"], 
          status: "Available", 
          utilization: "58", 
          availableShifts: [1], 
          efficiencyFactor: "1.0", 
          substitutionGroup: "weld_group" 
        },
        
        // BEAD BLAST
        { 
          machineId: "BLAST-001", 
          name: "BEAD BLAST BAY", 
          type: "BEAD BLAST", 
          tier: "Tier 1", 
          capabilities: ["bead_blasting", "surface_finishing"], 
          status: "Available", 
          utilization: "32", 
          availableShifts: [1], 
          efficiencyFactor: "1.0", 
          substitutionGroup: "blast_group" 
        },
        
        // INSPECT
        { 
          machineId: "INSPECT-001", 
          name: "INSPECT BAY", 
          type: "INSPECT", 
          tier: "Tier 1", 
          capabilities: ["inspection", "quality_control", "measurement"], 
          status: "Available", 
          utilization: "42", 
          availableShifts: [1, 2], 
          efficiencyFactor: "1.0", 
          substitutionGroup: "inspect_group" 
        },
        
        // ASSEMBLE
        { 
          machineId: "ASSEMBLE-001", 
          name: "ASSEMBLE BAY", 
          type: "ASSEMBLE", 
          tier: "Tier 1", 
          capabilities: ["assembly", "fitting", "final_assembly"], 
          status: "Available", 
          utilization: "38", 
          availableShifts: [1], 
          efficiencyFactor: "1.0", 
          substitutionGroup: "assemble_group" 
        }
      ];

      await db.insert(machines).values(defaultMachines);

      // Initialize default jobs
      const defaultJobs: InsertJob[] = [
        {
          jobNumber: "JOB-2024-001",
          partNumber: "PART-AC-001",
          description: "Aluminum Bracket",
          customer: "ACME Corp",
          quantity: 50,
          dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
          orderDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          promisedDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
          priority: "High",
          status: "Unscheduled",
          routing: [
            { sequence: 1, name: "CNC Milling", machineType: "MILL", estimatedHours: 2.5, compatibleMachines: ["VMC-001", "VMC-002", "VMC-003"] },
            { sequence: 2, name: "Inspection", machineType: "INSPECT", estimatedHours: 0.5, compatibleMachines: ["INSPECT-001"] }
          ],
          estimatedHours: "3.0"
        },
        {
          jobNumber: "JOB-2024-002",
          partNumber: "PART-ST-015",
          description: "Steel Shaft",
          customer: "Tech Industries",
          quantity: 25,
          dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
          orderDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
          promisedDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
          priority: "Critical",
          status: "Unscheduled",
          routing: [
            { sequence: 1, name: "CNC Turning", machineType: "LATHE", estimatedHours: 1.5, compatibleMachines: ["LATHE-001", "LATHE-002", "LATHE-004"] },
            { sequence: 2, name: "Inspection", machineType: "INSPECT", estimatedHours: 0.25, compatibleMachines: ["INSPECT-001"] }
          ],
          estimatedHours: "1.75"
        },
        {
          jobNumber: "JOB-2024-003",
          partNumber: "PART-WD-007",
          description: "Welded Assembly",
          customer: "Manufacturing Plus",
          quantity: 10,
          dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
          orderDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
          promisedDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
          priority: "Normal",
          status: "Unscheduled",
          routing: [
            { sequence: 1, name: "CNC Milling", machineType: "MILL", estimatedHours: 3.0, compatibleMachines: ["VMC-001", "VMC-002", "VMC-003"] },
            { sequence: 2, name: "TIG Welding", machineType: "WELD", estimatedHours: 2.0, compatibleMachines: ["WELD-001"] },
            { sequence: 3, name: "Bead Blast", machineType: "BEAD BLAST", estimatedHours: 0.5, compatibleMachines: ["BLAST-001"] },
            { sequence: 4, name: "Inspection", machineType: "INSPECT", estimatedHours: 0.75, compatibleMachines: ["INSPECT-001"] }
          ],
          estimatedHours: "6.25"
        }
      ];

      await db.insert(jobs).values(defaultJobs);

      // Initialize alerts
      const createdMachines = await db.select().from(machines).where(eq(machines.machineId, "CNC-004"));
      const createdJobs = await db.select().from(jobs).where(eq(jobs.jobNumber, "JOB-2024-002"));

      await db.insert(alerts).values([
        {
          type: "warning",
          title: "Machine Maintenance Due",
          message: "CNC-004 (Haas ST-30) requires scheduled maintenance within 2 days",
          machineId: createdMachines[0]?.id
        },
        {
          type: "error",
          title: "Critical Job Behind Schedule",
          message: "JOB-2024-002 is approaching customer due date and requires immediate attention",
          jobId: createdJobs[0]?.id
        }
      ]);
    } catch (error) {
      console.error("Error initializing default data:", error);
    }
  }

  // Jobs implementation
  async getJobs(): Promise<Job[]> {
    return await db.select().from(jobs).orderBy(desc(jobs.createdDate));
  }

  async getJob(id: string): Promise<Job | undefined> {
    const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
    return job || undefined;
  }

  async createJob(insertJob: InsertJob): Promise<Job> {
    const [job] = await db
      .insert(jobs)
      .values({
        ...insertJob,
        priority: insertJob.priority || "Normal",
        status: insertJob.status || "Unscheduled",
        routing: insertJob.routing || [],
        estimatedHours: insertJob.estimatedHours || "0",
      })
      .returning();
    return job;
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
      // Check if job exists first
      const existingJob = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
      if (existingJob.length === 0) {
        return false;
      }
      
      // Delete all related data in correct order to avoid foreign key constraints
      // 1. Delete alerts that reference this job
      await db.delete(alerts).where(eq(alerts.jobId, id));
      
      // 2. Delete schedule entries
      await db.delete(scheduleEntries).where(eq(scheduleEntries.jobId, id));
      
      // 3. Delete routing operations
      await db.delete(routingOperations).where(eq(routingOperations.jobId, id));
      
      // 4. Delete material orders
      await db.delete(materialOrders).where(eq(materialOrders.jobId, id));
      
      // 5. Delete outsourced operations
      await db.delete(outsourcedOperations).where(eq(outsourcedOperations.jobId, id));
      
      // Finally, delete the job itself
      await db.delete(jobs).where(eq(jobs.id, id));
      return true;
    } catch (error) {
      console.error('Error deleting job:', error);
      return false;
    }
  }

  async deleteAllJobs(): Promise<number> {
    try {
      // Get count of jobs before deletion
      const jobCount = await db.select({ count: sql<number>`count(*)` }).from(jobs);
      const count = Number(jobCount[0]?.count || 0);
      
      // Delete all related data in correct order to avoid foreign key constraints
      // 1. Delete all alerts
      await db.delete(alerts);
      
      // 2. Delete all schedule entries
      await db.delete(scheduleEntries);
      
      // 3. Delete all routing operations
      await db.delete(routingOperations);
      
      // 4. Delete all material orders
      await db.delete(materialOrders);
      
      // 5. Delete all outsourced operations
      await db.delete(outsourcedOperations);
      
      // Finally, delete all jobs
      await db.delete(jobs);
      
      return count;
    } catch (error) {
      console.error('Error deleting all jobs:', error);
      throw error;
    }
  }

  async scheduleAllJobs(): Promise<{ scheduled: number; failed: number; details: Array<{ jobId: string; status: string; reason?: string }> }> {
    try {
      const allJobs = await this.getJobs();
      const unscheduledJobs = allJobs.filter(job => job.status === 'Unscheduled' || job.status === 'Planning');
      
      let scheduled = 0;
      let failed = 0;
      const details: Array<{ jobId: string; status: string; reason?: string }> = [];
      
      for (const job of unscheduledJobs) {
        try {
          console.log(`🔄 Attempting to schedule job ${job.jobNumber} (${job.id})`);
          console.log(`   Job routing:`, job.routing);
          
          const result = await this.autoScheduleJobWithMaterialCheck(job.id);
          if (result.success) {
            console.log(`✅ Successfully scheduled job ${job.jobNumber}`);
            scheduled++;
            details.push({ jobId: job.id, status: 'scheduled' });
          } else {
            console.log(`❌ Failed to schedule job ${job.jobNumber}: ${result.reason}`);
            failed++;
            details.push({ 
              jobId: job.id, 
              status: 'failed', 
              reason: result.reason || 'Unknown scheduling error'
            });
          }
        } catch (error) {
          console.log(`💥 Exception while scheduling job ${job.jobNumber}:`, error);
          failed++;
          details.push({ 
            jobId: job.id, 
            status: 'failed', 
            reason: `Scheduling error: ${error instanceof Error ? error.message : 'Unknown error'}`
          });
        }
      }
      
      return { scheduled, failed, details };
    } catch (error) {
      console.error('Error scheduling all jobs:', error);
      throw error;
    }
  }

  // Machines implementation
  async getMachines(): Promise<Machine[]> {
    return await db.select().from(machines);
  }

  async getMachine(id: string): Promise<Machine | undefined> {
    const [machine] = await db.select().from(machines).where(eq(machines.id, id));
    return machine || undefined;
  }

  async createMachine(insertMachine: InsertMachine): Promise<Machine> {
    const [machine] = await db
      .insert(machines)
      .values({
        ...insertMachine,
        tier: insertMachine.tier || "Standard",
        status: insertMachine.status || "Available",
        utilization: insertMachine.utilization || "0",
        availableShifts: insertMachine.availableShifts || [1, 2],
        efficiencyFactor: insertMachine.efficiencyFactor || "1.0",
      })
      .returning();
    return machine;
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
      // Check if machine exists first
      const existingMachine = await db.select().from(machines).where(eq(machines.id, id)).limit(1);
      if (existingMachine.length === 0) {
        return false;
      }
      
      // Delete all related data in correct order to avoid foreign key constraints
      // 1. Delete alerts that reference this machine
      await db.delete(alerts).where(eq(alerts.machineId, id));
      
      // 2. Delete schedule entries for this machine
      await db.delete(scheduleEntries).where(eq(scheduleEntries.machineId, id));
      
      // 3. Update routing operations to remove this machine from compatible machines
      const routingOps = await db.select().from(routingOperations);
      for (const op of routingOps) {
        if (op.compatibleMachines.includes(id)) {
          const updatedMachines = op.compatibleMachines.filter(m => m !== id);
          await db.update(routingOperations)
            .set({ compatibleMachines: updatedMachines })
            .where(eq(routingOperations.id, op.id));
        }
        // Also clear assigned machine if it's this machine
        if (op.assignedMachineId === id) {
          await db.update(routingOperations)
            .set({ assignedMachineId: null })
            .where(eq(routingOperations.id, op.id));
        }
      }
      
      // Finally, delete the machine itself
      await db.delete(machines).where(eq(machines.id, id));
      return true;
    } catch (error) {
      console.error('Error deleting machine:', error);
      return false;
    }
  }

  // Schedule implementation
  async getScheduleEntries(): Promise<ScheduleEntry[]> {
    return await db.select().from(scheduleEntries).orderBy(scheduleEntries.startTime);
  }

  async getScheduleEntriesForJob(jobId: string): Promise<ScheduleEntry[]> {
    return await db.select().from(scheduleEntries).where(eq(scheduleEntries.jobId, jobId));
  }

  async getScheduleEntriesByJobId(jobId: string): Promise<ScheduleEntry[]> {
    return await db.select().from(scheduleEntries).where(eq(scheduleEntries.jobId, jobId));
  }

  async getScheduleEntriesForMachine(machineId: string): Promise<ScheduleEntry[]> {
    return await db.select().from(scheduleEntries).where(eq(scheduleEntries.machineId, machineId));
  }

  async createScheduleEntry(entry: InsertScheduleEntry): Promise<ScheduleEntry> {
    const [scheduleEntry] = await db
      .insert(scheduleEntries)
      .values({
        ...entry,
        status: entry.status || "Scheduled",
      })
      .returning();
    
    // OPTIMIZATION: Invalidate cache when creating new entries
    this.invalidateScheduleCache();
    
    return scheduleEntry;
  }

  async updateScheduleEntry(id: string, updates: Partial<ScheduleEntry>): Promise<ScheduleEntry | undefined> {
    const [entry] = await db
      .update(scheduleEntries)
      .set(updates)
      .where(eq(scheduleEntries.id, id))
      .returning();
    
    // OPTIMIZATION: Invalidate cache when updating entries
    this.invalidateScheduleCache();
    
    return entry || undefined;
  }

  async deleteScheduleEntry(id: string): Promise<boolean> {
    try {
      await db.delete(scheduleEntries).where(eq(scheduleEntries.id, id));
      
      // OPTIMIZATION: Invalidate cache when deleting entries
      this.invalidateScheduleCache();
      
      return true;
    } catch (error) {
      console.error('Error deleting schedule entry:', error);
      return false;
    }
  }

  async clearAllScheduleEntries(): Promise<void> {
    await db.delete(scheduleEntries);
    
    // OPTIMIZATION: Invalidate cache when clearing all entries
    this.invalidateScheduleCache();
  }

  // Alerts implementation
  async getAlerts(): Promise<Alert[]> {
    return await db.select().from(alerts).orderBy(desc(alerts.createdAt));
  }

  async createAlert(alert: InsertAlert): Promise<Alert> {
    const [newAlert] = await db
      .insert(alerts)
      .values({
        ...alert,
        isRead: false,
      })
      .returning();
    return newAlert;
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

  // Machine substitution and scheduling logic with tier-based capability flows
  async getCompatibleMachines(
    jobType: string, 
    preferredCategory?: string,
    tierLevel: "Tier 1" | "Standard" | "Budget" = "Tier 1"
  ): Promise<Machine[]> {
    const allMachines = await this.getMachines();
    
    // Define tier-based capability flows
    const compatibleMachines = this.getCapabilityFlowMachines(allMachines, jobType, tierLevel);

    // If a preferred category is specified, prioritize those machines
    let orderedMachines = compatibleMachines;
    if (preferredCategory) {
      const categoryMachines = compatibleMachines.filter(m => m.category === preferredCategory);
      const otherMachines = compatibleMachines.filter(m => m.category !== preferredCategory);
      
      // Return category machines first, then others as alternatives
      orderedMachines = [...categoryMachines, ...otherMachines];
    }

    // Sort by efficiency factor (higher is better) and utilization (lower is better)
    return orderedMachines.sort((a, b) => {
      const efficiencyDiff = parseFloat(b.efficiencyFactor) - parseFloat(a.efficiencyFactor);
      if (Math.abs(efficiencyDiff) > 0.01) return efficiencyDiff;
      return parseFloat(a.utilization) - parseFloat(b.utilization);
    });
  }

  private getCapabilityFlowMachines(allMachines: Machine[], jobType: string, tierLevel: string): Machine[] {
    const tierMachines = allMachines.filter(m => m.tier === tierLevel);
    
    switch (jobType) {
      // LATHE TIER FLOWS
      case "single_spindle_turning":
        // Single Spindle jobs can upgrade to any lathe type
        return tierMachines.filter(m => 
          m.type === "LATHE" && (
            m.category === "Single Spindle Lathes" ||
            m.category === "Live Tooling Lathes" ||
            m.category === "Bar Fed Lathes" ||
            m.subcategory === "Live Tooling Lathes" // Dual spindle with live tooling
          )
        );
        
      case "live_tooling_turning":
        // Live Tooling jobs can ONLY run on Live Tooling or Dual Spindle machines
        return tierMachines.filter(m => 
          m.type === "LATHE" && (
            m.category === "Live Tooling Lathes" ||
            (m.category === "Bar Fed Lathes" && m.subcategory === "Live Tooling Lathes") // Dual spindle
          )
        );
        
      case "bar_fed_turning":
        // Bar Fed jobs can ONLY run on Bar Fed or Dual Spindle machines
        return tierMachines.filter(m => 
          m.type === "LATHE" && (
            m.category === "Bar Fed Lathes"
          )
        );
        
      case "dual_spindle_turning":
        // Dual Spindle jobs can ONLY run on Dual Spindle machines
        return tierMachines.filter(m => 
          m.type === "LATHE" && 
          m.category === "Bar Fed Lathes" && 
          m.subcategory === "Live Tooling Lathes"
        );

      // MILL TIER FLOWS  
      case "vmc_milling":
        // VMC jobs can upgrade to pseudo 4th axis, HMC, or 5-axis
        return tierMachines.filter(m => 
          m.type === "MILL" && (
            m.category === "3-Axis Vertical Milling Centers" ||
            m.category === "3-Axis VMC's with pseudo 4th axis" ||
            m.category === "Large envelope VMC's" ||
            m.category === "Horizontal Milling Centers" ||
            m.category === "5-Axis Milling Centers"
          )
        );
        
      case "pseudo_4th_axis_milling":
        // Pseudo 4th axis jobs can run on pseudo 4th, HMC, or 5-axis (but NOT basic VMC)
        return tierMachines.filter(m => 
          m.type === "MILL" && (
            m.category === "3-Axis VMC's with pseudo 4th axis" ||
            m.category === "Horizontal Milling Centers" ||
            m.category === "5-Axis Milling Centers"
          )
        );
        
      case "true_4th_axis_milling":
        // True 4th axis jobs can ONLY run on HMC or 5-axis (cannot use pseudo)
        return tierMachines.filter(m => 
          m.type === "MILL" && (
            m.category === "Horizontal Milling Centers" ||
            m.category === "5-Axis Milling Centers"
          )
        );
        
      case "5_axis_milling":
        // 5-axis jobs can ONLY run on 5-axis machines
        return tierMachines.filter(m => 
          m.type === "MILL" && 
          m.category === "5-Axis Milling Centers"
        );

      // LEGACY COMPATIBILITY - map old capability names to new job types
      case "turning":
        return this.getCapabilityFlowMachines(allMachines, "single_spindle_turning", tierLevel);
      case "live_tooling":
        return this.getCapabilityFlowMachines(allMachines, "live_tooling_turning", tierLevel);
      case "bar_feeding":
        return this.getCapabilityFlowMachines(allMachines, "bar_fed_turning", tierLevel);
      case "vertical_milling":
        return this.getCapabilityFlowMachines(allMachines, "vmc_milling", tierLevel);
      case "horizontal_milling":
        return this.getCapabilityFlowMachines(allMachines, "true_4th_axis_milling", tierLevel);

      // OTHER MACHINE TYPES (no tier flow complexity)
      default:
        return tierMachines.filter(m => m.capabilities.includes(jobType));
    }
  }

  async findOptimalMachineAssignment(
    jobRouting: RoutingOperationType[],
    jobPriority: "Critical" | "High" | "Normal" | "Low" = "Normal"
  ): Promise<{ operation: RoutingOperationType; assignedMachine: Machine | null; alternatives: Machine[] }[]> {
    const assignments: { operation: RoutingOperationType; assignedMachine: Machine | null; alternatives: Machine[] }[] = [];
    const allMachines = await this.getMachines();
    
    for (const operation of jobRouting) {
      // Map operation types to machine capabilities and preferred categories
      const capabilityMapping: Record<string, { capability: string; preferredCategory?: string }> = {
        "CNC Milling": { capability: "vertical_milling", preferredCategory: "3-Axis Vertical Milling Centers" },
        "HMC Milling": { capability: "horizontal_milling", preferredCategory: "Horizontal Milling Centers" },
        "CNC Turning": { capability: "turning", preferredCategory: "Live Tooling Lathes" },
        "Bar Turning": { capability: "turning", preferredCategory: "Bar Fed Lathes" },
        "4th Axis Work": { capability: "vertical_milling", preferredCategory: "3-Axis VMC's with pseudo 4th axis" },
        "Large Part Milling": { capability: "vertical_milling", preferredCategory: "Large envelope VMC's" },
        "Waterjet Cutting": { capability: "waterjet_cutting" },
        "TIG Welding": { capability: "welding" },
        "Bead Blast": { capability: "finishing" },
        "Inspection": { capability: "inspection" },
        "Assembly": { capability: "assembly" }
      };

      const mapping = capabilityMapping[operation.name] || { capability: operation.machineType.toLowerCase() };
      
      // Get all compatible machines for this operation
      let compatibleMachines = await this.getCompatibleMachines(
        mapping.capability,
        mapping.preferredCategory,
        "Tier 1"
      );

      // Apply bar feeder constraints for lathe operations
      if (operation.machineType === "LATHE" || mapping.capability === "turning") {
        // Filter machines based on bar feeder constraints
        const validBarFedMachines = barFeederService.getValidBarFedMachines(jobRouting, allMachines);
        
        // If job has saw operations, remove all bar fed machines
        const hasSawOps = jobRouting.some(op => 
          op.name.toLowerCase().includes('saw') || 
          op.operationType?.toLowerCase() === 'saw'
        );
        if (hasSawOps) {
          compatibleMachines = compatibleMachines.filter(m => !m.barFeeder);
        } else if (operation.name.toLowerCase().includes('bar') || mapping.preferredCategory === "Bar Fed Lathes") {
          // For bar operations, only use valid bar fed machines
          compatibleMachines = compatibleMachines.filter(m => 
            validBarFedMachines.some(valid => valid.id === m.id)
          );
        }
      }

      // For critical/high priority jobs, prefer machines with higher efficiency
      let assignedMachine: Machine | null = null;
      if (compatibleMachines.length > 0) {
        if (jobPriority === "Critical" || jobPriority === "High") {
          // Assign to highest efficiency machine with lowest utilization
          assignedMachine = compatibleMachines[0];
        } else {
          // For normal/low priority, find machine with good balance of efficiency and availability
          assignedMachine = compatibleMachines.find(m => parseFloat(m.utilization) < 80) || compatibleMachines[0];
        }
      }

      assignments.push({
        operation,
        assignedMachine,
        alternatives: compatibleMachines.slice(0, 5) // Top 5 alternatives
      });
    }

    return assignments;
  }

  // Dashboard stats implementation
  async getDashboardStats(): Promise<DashboardStats> {
    const allJobs = await this.getJobs();
    const allMachines = await this.getMachines();
    const allScheduleEntries = await this.getScheduleEntries();
    
    const activeJobs = allJobs.filter(job => job.status !== "Completed" && job.status !== "Cancelled" && job.status !== "Complete").length;
    const lateJobs = allJobs.filter(job => job.status === "Customer Late" || job.status === "Company Late").length;
    const customerLateJobs = allJobs.filter(job => job.status === "Customer Late").length;
    const companyLateJobs = allJobs.filter(job => job.status === "Company Late").length;
    
    // Calculate real machine utilization based on scheduled hours
    const currentDate = new Date();
    const weekStart = new Date(currentDate);
    weekStart.setDate(currentDate.getDate() - currentDate.getDay()); // Start of current week
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6); // End of current week
    
    // Calculate total machine capacity for the week (per machine: 8 hours/shift * shifts * 7 days)
    let totalMachineCapacity = 0;
    let shift1Machines = 0;
    let shift2Machines = 0;
    
    allMachines.forEach(machine => {
      const shifts = machine.availableShifts || [1, 2];
      if (shifts.includes(1)) {
        shift1Machines++;
        totalMachineCapacity += 8 * 7; // 8 hours per day * 7 days
      }
      if (shifts.includes(2)) {
        shift2Machines++;
        totalMachineCapacity += 8 * 7; // 8 hours per day * 7 days
      }
    });
    
    // Calculate actual used capacity from schedule entries this week
    let usedMachineCapacity = 0;
    
    allScheduleEntries.forEach(entry => {
      const entryDate = new Date(entry.startTime);
      if (entryDate >= weekStart && entryDate <= weekEnd) {
        const job = allJobs.find(j => j.id === entry.jobId);
        if (job) {
          usedMachineCapacity += parseFloat(job.estimatedHours || '0');
        }
      }
    });
    
    const realUtilization = totalMachineCapacity > 0 ? Math.round((usedMachineCapacity / totalMachineCapacity) * 100) : 0;
    
    return {
      activeJobs,
      utilization: realUtilization,
      lateJobs,
      atRiskJobs: Math.max(0, lateJobs - 1), // At risk jobs are those approaching late status
      customerLateJobs,
      companyLateJobs,
      totalCapacity: totalMachineCapacity,
      usedCapacity: usedMachineCapacity,
      shift1Resources: shift1Machines,
      shift2Resources: shift2Machines,
    };
  }

  // Auto-scheduling implementation
  async getMachinesBySubstitutionGroup(substitutionGroup: string): Promise<Machine[]> {
    const allMachines = await this.getMachines();
    return allMachines.filter(machine => machine.substitutionGroup === substitutionGroup);
  }

  async findBestMachineForOperation(
    operation: RoutingOperation, 
    targetDate: Date, 
    shift: number
  ): Promise<{ machine: Machine; adjustedHours: number; score: number } | null> {
    // Check if target date is a working day (Monday-Thursday only)
    const dayOfWeek = targetDate.getDay(); 
    if (dayOfWeek < 1 || dayOfWeek > 4) { // 0=Sunday, 1=Monday, ..., 4=Thursday, 5=Friday, 6=Saturday
      console.log(`   ❌ Target date ${targetDate.toDateString()} is not a working day (Mon-Thu only)`);
      return null;
    }

    const allMachines = await this.getMachines();
    const allResources = await this.getResources();
    
    console.log(`🔍 Finding machine for operation: ${(operation as any).operationName || (operation as any).name || operation.machineType}, machineType: ${operation.machineType}`);
    console.log(`   Compatible machines required: [${operation.compatibleMachines.join(', ')}]`);
    
    // OPTIMIZATION: Pre-filter machines by type and compatible machines to avoid checking irrelevant machines
    const preFilteredMachines = allMachines.filter(machine => {
      // Check if machine is directly compatible
      const isDirectlyCompatible = operation.compatibleMachines.includes(machine.machineId);
      
      // Check if machine could potentially substitute (same type or substitution group)
      const sameType = machine.type === operation.machineType;
      const hasSubstitutionGroup = machine.substitutionGroup && operation.compatibleMachines.some(compatId => {
        const compatMachine = allMachines.find(m => m.machineId === compatId);
        return compatMachine && compatMachine.substitutionGroup === machine.substitutionGroup;
      });
      
      return isDirectlyCompatible || sameType || hasSubstitutionGroup;
    });
    
    // ERROR HANDLING: Check if work center exists
    if (preFilteredMachines.length === 0) {
      console.log(`❌ WORK CENTER NOT FOUND: ${operation.machineType} - no machines of this type exist`);
      throw new Error(`${operation.machineType} WORKCENTER NOT FOUND`);
    }
    
    console.log(`   Pre-filtered from ${allMachines.length} to ${preFilteredMachines.length} relevant machines`);
    console.log(`   Target date: ${targetDate.toDateString()} (${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dayOfWeek]}), shift: ${shift}`);
    
    // Find machines that can handle this operation
    const compatibleMachines = [];
    for (const machine of preFilteredMachines) {
      console.log(`   Checking machine: ${machine.machineId} (${machine.type})`);
      console.log(`     Status: ${machine.status}, availableShifts: ${machine.availableShifts}, shift needed: ${shift}`);
      console.log(`     Compatible check: ${operation.compatibleMachines.includes(machine.machineId)}`);
      
      // Check if machine has available shifts that match the requested shift
      if (machine.status !== "Available" || !machine.availableShifts?.includes(shift)) {
        console.log(`     ❌ Machine ${machine.machineId} rejected - not available or shift mismatch`);
        continue;
      }

      // Check if machine is compatible or can substitute
      const isDirectlyCompatible = operation.compatibleMachines.includes(machine.machineId);
      const canSubstitute = machine.substitutionGroup && await this.canSubstitute(machine, operation);
      
      if (!isDirectlyCompatible && !canSubstitute) {
        console.log(`     ❌ Machine ${machine.machineId} rejected - not compatible (direct: ${isDirectlyCompatible}, substitute: ${canSubstitute})`);
        continue;
      } else {
        console.log(`     ✅ Machine ${machine.machineId} is compatible (direct: ${isDirectlyCompatible}, substitute: ${canSubstitute})`);
      }

      // Check if there are resources available for this machine on this shift
      // Resources must be active, work the shift, AND be qualified for this specific machine
      // SPECIAL CASE: OUTSOURCE machines don't need operator resources - they are external vendors
      let machineResources = [];
      if (machine.type === 'OUTSOURCE') {
        // CRITICAL FIX: Outsource machines get NO internal resources - work is done externally
        machineResources = []; // Empty array but not null to avoid type issues
        console.log(`     ✅ OUTSOURCE machine ${machine.machineId} requires NO internal resources - external vendor`);
      } else if (machine.type === 'INSPECT') {
        // CRITICAL FIX: INSPECT machines need Quality Inspectors only - STRICT COMPATIBILITY CHECK
        console.log(`🔍 Resource Assignment for ${machine.machineId} (${machine.type}) on Shift ${shift}`);
        machineResources = allResources.filter(resource => {
          const isActive = resource.isActive;
          const worksShift = resource.shiftSchedule?.includes(shift);
          const isMachineQualified = resource.workCenters?.includes(machine.id);
          const isInspector = resource.role === 'Quality Inspector';
          
          console.log(`🔍 ${machine.type} check ${resource.name}: active=${isActive}, shift=${worksShift}, machine=${isMachineQualified}, inspector=${isInspector}`);
          
          // CRITICAL: Only Quality Inspectors qualified for THIS specific machine
          return isActive && worksShift && isMachineQualified && isInspector;
        });
        
        if (machineResources.length === 0) {
          console.log(`     ❌ INSPECT machine ${machine.machineId} has NO qualified Quality Inspectors on shift ${shift}`);
          continue;
        }
      } else {
        // PRODUCTION machines need operators qualified for this specific machine
        console.log(`⚙️ Resource Assignment for ${machine.machineId} (${machine.type}) on Shift ${shift}`);
        machineResources = allResources.filter(resource => {
          const isActive = resource.isActive;
          const worksShift = resource.shiftSchedule?.includes(shift);
          const isMachineQualified = resource.workCenters?.includes(machine.id);
          const isOperator = resource.role === 'Operator' || resource.role === 'Shift Lead';
          
          console.log(`⚙️ PRODUCTION check ${resource.name}: active=${isActive}, shift=${worksShift}, machine=${isMachineQualified}, operator=${isOperator}`);
          console.log(`   Resource work centers: ${resource.workCenters?.join(', ')}`);
          console.log(`   Target machine ID: ${machine.id}, Machine: ${machine.machineId}`);
          
          // CRITICAL: Only Operators/Shift Leads qualified for THIS specific machine
          return isActive && worksShift && isMachineQualified && isOperator;
        });
        
        if (machineResources.length === 0) {
          console.log(`     ❌ PRODUCTION machine ${machine.machineId} has NO qualified operators on shift ${shift}`);
          console.log(`     Resources needed: active=true, shifts=${shift}, workCenters includes ${machine.id}, role=Operator/Shift Lead`);
          continue;
        }
      }

      if (machine.type !== 'OUTSOURCE') {
        console.log(`     ✅ Machine ${machine.machineId} has ${machineResources.length} qualified resources on shift ${shift}`);
      }
      compatibleMachines.push(machine);
    }

    if (compatibleMachines.length === 0) {
      // Try multi-shift logic for large operations
      const operationHours = Number(operation.estimatedHours);
      if (operationHours > 8) {
        console.log(`🔀 No single-shift machines found, trying multi-shift approach for ${operationHours}h operation`);
        return await this.findOptimalMachineForMultiShift(operation as any, targetDate, shift);
      }
      return null;
    }

    // Score each machine based on multiple factors
    const scoredMachines = compatibleMachines.map(machine => {
      const efficiencyFactor = parseFloat(machine.efficiencyFactor);
      const adjustedHours = Number(operation.estimatedHours) / efficiencyFactor;
      
      // Calculate efficiency impact if this is a substitution
      let efficiencyImpact = 0;
      if (operation.originalQuotedMachineId && operation.originalQuotedMachineId !== machine.id) {
        const originalMachine = allMachines.find(m => m.id === operation.originalQuotedMachineId);
        if (originalMachine) {
          const originalEfficiency = parseFloat(originalMachine.efficiencyFactor);
          const currentEfficiency = efficiencyFactor;
          // Positive impact = slower (inefficient), negative = faster (more efficient)
          efficiencyImpact = ((1/currentEfficiency) / (1/originalEfficiency) - 1) * 100;
        }
      }
      
      const utilizationScore = 100 - parseFloat(machine.utilization); // Lower utilization = better
      
      // Tier scoring: Premium = 30, Standard = 20, Budget = 10
      const tierScore = machine.tier === "Premium" ? 30 : machine.tier === "Standard" ? 20 : 10;
      
      // Efficiency scoring: Higher efficiency = better score
      const efficiencyScore = efficiencyFactor * 20;
      
      // Preference for exact matches over substitutions
      const exactMatchBonus = operation.compatibleMachines.includes(machine.machineId) ? 15 : 0;
      
      // Calculate total score
      const score = utilizationScore + tierScore + efficiencyScore + exactMatchBonus;
      
      return {
        machine,
        adjustedHours,
        score,
        efficiencyImpact
      };
    });

    // OPTIMIZATION: Enhanced capacity check with consolidated logic and better debugging
    const availableMachines = [];
    for (const result of scoredMachines) {
      const { machine, adjustedHours } = result;
      
      // OPTIMIZATION: Use consolidated capacity function for better performance
      const capacity = await this.getMachineCapacityInfo(machine.id, targetDate, shift);
      
      // DEBUGGING AID: Log detailed capacity information
      console.log(`🔍 Capacity Check - ${machine.machineId}: ${capacity.currentHours.toFixed(1)}h/${capacity.maxHours}h used (${capacity.utilizationPercent.toFixed(1)}%), Available: ${capacity.availableHours.toFixed(1)}h`);
      
      // For large operations (>max hours per shift), check if machine can accommodate at least partial work
      if (adjustedHours > capacity.maxHours) {
        if (capacity.availableHours > 1) { // Need at least 1 hour to start multi-shift operation
          availableMachines.push(result);
          console.log(`✅ Multi-shift ${machine.machineId}: ${capacity.availableHours.toFixed(1)}h available for ${adjustedHours.toFixed(1)}h operation (will span shifts)`);
        } else {
          console.log(`❌ Multi-shift ${machine.machineId}: Insufficient capacity - need >1h to start, only ${capacity.availableHours.toFixed(1)}h available`);
        }
      } else {
        // Standard single-shift capacity validation
        if (adjustedHours <= capacity.availableHours) {
          availableMachines.push(result);
          console.log(`✅ Single-shift ${machine.machineId}: ${adjustedHours.toFixed(1)}h fits in ${capacity.availableHours.toFixed(1)}h available`);
        } else {
          console.log(`❌ Single-shift ${machine.machineId}: ${adjustedHours.toFixed(1)}h needed > ${capacity.availableHours.toFixed(1)}h available`);
        }
      }
    }
    
    if (availableMachines.length === 0) {
      console.log(`❌ No machines have available capacity on ${targetDate.toDateString()} shift ${shift}`);
      return null;
    }

    // Return the highest scored machine from available machines
    const bestMatch = availableMachines.sort((a, b) => b.score - a.score)[0];
    
    // Log efficiency impact if this is a substitution
    if (bestMatch.efficiencyImpact !== 0) {
      console.log(`⚠️ Efficiency Impact: ${bestMatch.efficiencyImpact.toFixed(1)}% for ${(operation as any).operationName || (operation as any).name || operation.machineType} (${bestMatch.machine.machineId})`);
    }
    
    // Return machine without resource assignment - resource will be assigned later with proper timing
    return { ...bestMatch, shift, assignedResource: null };
  }

  // OPTIMIZATION: Centralized duration calculation function to eliminate redundant code
  private calculateEntryDurationHours(entry: ScheduleEntry): number {
    return (new Date(entry.endTime).getTime() - new Date(entry.startTime).getTime()) / (1000 * 60 * 60);
  }

  // Get shifts ordered by current load (least loaded first) for better load balancing
  private async getShiftsOrderedByLoad(targetDate: Date, operation?: RoutingOperationType): Promise<number[]> {
    const scheduleEntries = await this.getCachedScheduleEntries(); // OPTIMIZATION: Use cached entries
    
    // Count hours scheduled per shift for the target date
    const shiftLoads = { 1: 0, 2: 0 };
    
    for (const entry of scheduleEntries) {
      const entryDate = new Date(entry.startTime);
      if (entryDate.toDateString() === targetDate.toDateString()) {
        const duration = this.calculateEntryDurationHours(entry); // OPTIMIZATION: Use centralized function
        shiftLoads[entry.shift as keyof typeof shiftLoads] += duration;
      }
    }
    
    console.log(`📊 Shift loads for ${targetDate.toDateString()}: Shift 1: ${shiftLoads[1].toFixed(1)}h, Shift 2: ${shiftLoads[2].toFixed(1)}h`);
    
    // Check weekly capacity for shift 2 (120h/week limit)
    const weekStart = new Date(targetDate);
    weekStart.setDate(targetDate.getDate() - targetDate.getDay() + 1); // Monday of this week
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6); // Sunday of this week
    
    let shift2WeeklyHours = 0;
    for (const entry of scheduleEntries) {
      const entryDate = new Date(entry.startTime);
      if (entry.shift === 2 && entryDate >= weekStart && entryDate <= weekEnd) {
        const duration = this.calculateEntryDurationHours(entry); // OPTIMIZATION: Use centralized function
        shift2WeeklyHours += duration;
      }
    }
    
    console.log(`📊 Shift 2 weekly capacity: ${shift2WeeklyHours.toFixed(1)}h / 120h limit`);
    
    // PRIORITY SHIFT SELECTION: Always try Shift 1 first, then Shift 2 if needed
    const availableShifts = [];
    
    // If we have a specific operation, check which shifts have compatible machines first
    if (operation) {
      const allMachines = await this.getMachines();
      const compatibleMachines = allMachines.filter(machine => 
        operation.compatibleMachines.includes(machine.machineId) &&
        machine.status === 'Available'
      );
      
      console.log(`🔍 Compatible machines for ${operation.machineType}: ${compatibleMachines.map(m => m.machineId).join(', ')}`);
      
      // Check which shifts these machines support
      const shift1Compatible = compatibleMachines.some(m => m.availableShifts?.includes(1));
      const shift2Compatible = compatibleMachines.some(m => m.availableShifts?.includes(2));
      
      console.log(`📅 Shift compatibility: Shift 1: ${shift1Compatible}, Shift 2: ${shift2Compatible}`);
      
      // Always prioritize Shift 1 if machines are available there
      if (shift1Compatible) {
        availableShifts.push(1);
      }
      
      // Only add Shift 2 if machines are available there
      if (shift2Compatible) {
        availableShifts.push(2);
      }
      
      // If no compatible machines found, still return both shifts to let the scheduler try substitution
      if (availableShifts.length === 0) {
        console.log(`⚠️ No compatible machines found, but returning all shifts for substitution check`);
        availableShifts.push(1, 2);
      }
    } else {
      // No specific operation, return shifts in priority order
      availableShifts.push(1, 2);
    }
    
    // Get resource information for logging
    const resources = await this.getResources();
    const shift1Resources = resources.filter(r => r.shiftSchedule?.includes(1) && r.isActive).length;
    const shift2Resources = resources.filter(r => r.shiftSchedule?.includes(2) && r.isActive).length;
    const shift1DailyCapacity = shift1Resources * 8;
    const shift2DailyCapacity = shift2Resources * 8;
    
    console.log(`📊 Resource capacity: Shift 1: ${shift1Resources} operators (${shift1DailyCapacity}h/day, current: ${shiftLoads[1].toFixed(1)}h), Shift 2: ${shift2Resources} operators (${shift2DailyCapacity}h/day, current: ${shiftLoads[2].toFixed(1)}h)`);
    
    // Check if shifts are severely overloaded (more than 150% capacity) and warn
    const operationHours = operation ? operation.estimatedHours || 0 : 0;
    if (availableShifts.includes(1) && shiftLoads[1] + operationHours > shift1DailyCapacity * 1.5) {
      console.log(`⚠️ WARNING: Shift 1 severely overloaded: ${(shiftLoads[1] + operationHours).toFixed(1)}h > ${(shift1DailyCapacity * 1.5).toFixed(1)}h capacity`);
    }
    if (availableShifts.includes(2) && shiftLoads[2] + operationHours > shift2DailyCapacity * 1.5) {
      console.log(`⚠️ WARNING: Shift 2 severely overloaded: ${(shiftLoads[2] + operationHours).toFixed(1)}h > ${(shift2DailyCapacity * 1.5).toFixed(1)}h capacity`);
    }
    
    // LOAD BALANCING: For machines that support both shifts, prioritize the less loaded shift
    if (operation && availableShifts.length === 2) {
      // Check if the machine for this operation supports both shifts
      const compatibleMachines = await this.getMachines();
      const operationMachines = compatibleMachines.filter(m => 
        operation.compatibleMachines.includes(m.machineId) && 
        m.availableShifts?.includes(1) && 
        m.availableShifts?.includes(2)
      );
      
      if (operationMachines.length > 0) {
        // Machine supports both shifts, return least loaded first for load balancing
        return availableShifts.sort((a, b) => {
          const loadA = shiftLoads[a as keyof typeof shiftLoads];
          const loadB = shiftLoads[b as keyof typeof shiftLoads];
          return loadA - loadB;
        });
      }
    }
    
    // Otherwise, prioritize shift 1 first (for machines that only run on shift 1)
    return availableShifts.sort((a, b) => a - b);
  }

  // Priority-based displacement: High priority jobs can displace lower priority jobs with buffer time
  private async attemptPriorityDisplacement(
    highPriorityJob: Job, 
    operation: RoutingOperationType, 
    targetDate: Date
  ): Promise<{
    success: boolean;
    machineId?: string;
    startTime?: Date;
    endTime?: Date;
    shift?: number;
    displacedJobId?: string;
  }> {
    console.log(`🔄 Attempting priority displacement for ${highPriorityJob.priority} job ${highPriorityJob.jobNumber}`);
    
    // Get all scheduled entries for the target date
    const allScheduleEntries = await this.getScheduleEntries();
    const targetDateEntries = allScheduleEntries.filter(entry => {
      const entryDate = new Date(entry.startTime);
      return entryDate.toDateString() === targetDate.toDateString();
    });
    
    // Get all jobs to check priorities and due dates
    const allJobs = await this.getJobs();
    
    // Priority hierarchy: Critical > High > Normal > Low
    const priorityRanking = { 'Critical': 4, 'High': 3, 'Normal': 2, 'Low': 1 };
    const highPriorityRank = priorityRanking[highPriorityJob.priority as keyof typeof priorityRanking] || 2;
    
    // Find lower priority jobs that can be displaced
    for (const entry of targetDateEntries) {
      const scheduledJob = allJobs.find(j => j.id === entry.jobId);
      if (!scheduledJob) continue;
      
      const scheduledJobRank = priorityRanking[scheduledJob.priority as keyof typeof priorityRanking] || 2;
      
      // Only displace lower priority jobs
      if (scheduledJobRank >= highPriorityRank) continue;
      
      // Check if the scheduled job has buffer time (can be moved later)
      const daysToDue = Math.ceil((scheduledJob.promisedDate.getTime() - targetDate.getTime()) / (24 * 60 * 60 * 1000));
      const estimatedDaysNeeded = Math.ceil(parseFloat(scheduledJob.estimatedHours) / 8); // Assuming 8h/day
      const bufferDays = daysToDue - estimatedDaysNeeded;
      
      // Require at least 2 days buffer for displacement (don't push jobs too close to due date)
      if (bufferDays < 2) {
        console.log(`   ❌ Job ${scheduledJob.jobNumber} has insufficient buffer (${bufferDays} days)`);
        continue;
      }
      
      // Check if the displaced job's machine can handle the high priority operation
      const machines = await this.getMachines();
      const entryMachine = machines.find(m => m.id === entry.machineId);
      if (!entryMachine) continue;
      
      // Check compatibility (direct or substitution)
      const isCompatible = operation.compatibleMachines.includes(entryMachine.machineId) ||
        (entryMachine.substitutionGroup && await this.canSubstitute(entryMachine, operation));
      
      if (!isCompatible) {
        console.log(`   ❌ Machine ${entryMachine.machineId} not compatible with operation`);
        continue;
      }
      
      // Check if machine has the right shift availability
      if (!entryMachine.availableShifts?.includes(entry.shift)) {
        console.log(`   ❌ Machine ${entryMachine.machineId} not available on shift ${entry.shift}`);
        continue;
      }
      
      console.log(`   ✅ Found displacement candidate: ${scheduledJob.jobNumber} (${scheduledJob.priority}) with ${bufferDays} days buffer`);
      
      // Move the lower priority job to a future date
      const futureDate = new Date(targetDate.getTime() + (3 * 24 * 60 * 60 * 1000)); // Move 3 days later
      const rescheduled = await this.rescheduleEntry(entry.id, futureDate);
      
      if (rescheduled) {
        console.log(`   🔄 Successfully displaced job ${scheduledJob.jobNumber} to ${futureDate.toDateString()}`);
        
        return {
          success: true,
          machineId: entry.machineId,
          startTime: new Date(entry.startTime),
          endTime: new Date(entry.endTime),
          shift: entry.shift,
          displacedJobId: scheduledJob.id
        };
      }
    }
    
    console.log(`   ❌ No suitable displacement candidates found for ${highPriorityJob.jobNumber}`);
    return { success: false };
  }

  // Helper method to reschedule a schedule entry to a new date
  private async rescheduleEntry(entryId: string, newDate: Date): Promise<boolean> {
    try {
      const entry = await db.select().from(scheduleEntries).where(eq(scheduleEntries.id, entryId)).limit(1);
      if (entry.length === 0) return false;
      
      const originalEntry = entry[0];
      const duration = new Date(originalEntry.endTime).getTime() - new Date(originalEntry.startTime).getTime();
      
      // Update the entry with new date
      await db.update(scheduleEntries)
        .set({
          startTime: newDate,
          endTime: new Date(newDate.getTime() + duration)
        })
        .where(eq(scheduleEntries.id, entryId));
      
      return true;
    } catch (error) {
      console.error(`Failed to reschedule entry ${entryId}:`, error);
      return false;
    }
  }

  // NEW: Multi-shift machine finder for operations >8 hours
  private async findOptimalMachineForMultiShift(
    operation: RoutingOperationType,
    targetDate: Date,
    shift: number
  ) {
    console.log(`🔀 Multi-shift finder: ${operation.name} (${operation.estimatedHours}h)`);
    
    // Get all machines and apply basic filtering
    const allMachines = await this.getMachines();
    const compatibleMachineIds = operation.compatibleMachines;
    
    // Filter machines that could potentially handle this operation
    const candidateMachines = allMachines.filter(machine => {
      const isCompatible = compatibleMachineIds.includes(machine.machineId);
      const isAvailable = machine.status === 'Available';
      const hasShift = machine.availableShifts?.includes(shift);
      
      return (isCompatible || this.canSubstituteSync(machine, operation)) && isAvailable && hasShift;
    });
    
    if (candidateMachines.length === 0) {
      console.log(`   ❌ No candidate machines found for multi-shift operation`);
      return null;
    }
    
    // Score machines and check if they can accommodate partial operation
    for (const machine of candidateMachines) {
      const efficiencyFactor = parseFloat(machine.efficiencyFactor);
      const adjustedHours = Number(operation.estimatedHours) / efficiencyFactor;
      
      // OPTIMIZATION: Use consolidated capacity function for better performance
      const capacity = await this.getMachineCapacityInfo(machine.id, targetDate, shift);
      const machineHours = capacity.currentHours;
      const maxShiftHours = capacity.maxHours;
      const availableHours = capacity.availableHours;
      
      if (availableHours > 0) {
        console.log(`   ✅ Multi-shift machine found: ${machine.machineId} (${availableHours}h available, will span multiple shifts)`);
        
        // CRITICAL: Apply same strict resource assignment rules everywhere
        let assignedResource = null;
        
        if (machine.type === 'OUTSOURCE' || machine.machineId === 'INSPECT-001') {
          assignedResource = null; // RULE 1: External vendor or inspection station, no internal resources
        } else if (machine.type === 'INSPECT') {
          const allResources = await this.getResources();
          const inspectors = allResources.filter(r => 
            r.isActive && r.shiftSchedule?.includes(shift) && 
            r.workCenters?.includes(machine.id) && r.role === 'Quality Inspector'
          );
          assignedResource = inspectors[0] || null;
        } else {
          const allResources = await this.getResources();
          const operators = allResources.filter(r => 
            r.isActive && r.shiftSchedule?.includes(shift) && 
            r.workCenters?.includes(machine.id) && 
            (r.role === 'Operator' || r.role === 'Shift Lead')
          );
          assignedResource = operators[0] || null;
        }
        
        return {
          machine,
          adjustedHours,
          score: 100, // High score for multi-shift operations
          efficiencyImpact: Math.abs(efficiencyFactor - 1) * 100,
          shift,
          assignedResource
        };
      }
    }
    
    console.log(`   ❌ No machines have available capacity for multi-shift operation`);
    return null;
  }

  // Quick substitution check without async calls for filtering
  private canSubstituteSync(machine: Machine, operation: RoutingOperationType): boolean {
    if (!machine.substitutionGroup) return false;
    
    // Basic substitution group check - detailed validation happens in canSubstitute
    const compatibleMachineIds = operation.compatibleMachines;
    return compatibleMachineIds.some(machineId => {
      // This is a simplified check - the async version handles more complex validation
      return machine.substitutionGroup && machineId.includes(machine.type);
    });
  }

  // Enhanced substitution logic using the compatibility matrix
  private async canSubstitute(machine: Machine, operation: RoutingOperationType): Promise<boolean> {
    // Check if machine is in same substitution group as any compatible machine
    if (!machine.substitutionGroup) return false;
    
    const compatibleMachineIds = operation.compatibleMachines;
    const allMachines = await this.getMachines();
    
    // Find the primary machines that this operation requires
    const requiredMachines = allMachines.filter(m => compatibleMachineIds.includes(m.machineId));
    
    const basicSubstitutionValid = allMachines.some(compatMachine => 
      compatibleMachineIds.includes(compatMachine.machineId) &&
      compatMachine.substitutionGroup === machine.substitutionGroup
    );

    if (!basicSubstitutionValid) return false;

    // Apply compatibility matrix rules for specific substitutions
    
    // 4th axis rule: 4th axis machines can do 3-axis work, but not vice versa
    const requiredHas4thAxis = requiredMachines.some(m => m.fourthAxis === true);
    const machineHas4thAxis = machine.fourthAxis === true;
    
    if (requiredHas4thAxis && !machineHas4thAxis) {
      console.log(`     🚫 Substitution blocked: ${machine.machineId} (no 4th axis) cannot do 4th axis work`);
      return false;
    }
    
    // Live tooling rule: Live tooling lathes can do simple turning, but not vice versa
    if (machine.type === 'LATHE') {
      const requiredHasLiveTooling = requiredMachines.some(m => m.liveTooling === true);
      const machineHasLiveTooling = machine.liveTooling === true;
      
      if (requiredHasLiveTooling && !machineHasLiveTooling) {
        console.log(`     🚫 Substitution blocked: ${machine.machineId} (no live tooling) cannot do live tooling work`);
        return false;
      }
      
      // Additional validation for bar fed lathes
      const originalMachine = allMachines.find(m => 
        compatibleMachineIds.includes(m.machineId) && 
        m.substitutionGroup === machine.substitutionGroup
      );

      if (originalMachine) {
        // Get all routing operations for this job to check bar feeder constraints
        const jobRouting = [operation]; // We only have this operation, but ideally we'd get full job routing
        const validation = barFeederService.validateBarFedSubstitution(
          originalMachine,
          machine,
          jobRouting
        );
        
        if (!validation.isValid) {
          console.log(`     🚫 Substitution blocked: Bar feeder validation failed for ${machine.machineId}`);
          return false;
        }
      }
    }
    
    // Tier rule: Lower tier machines can substitute for higher tier, but with efficiency impact
    const requiredMaxTier = Math.max(...requiredMachines.map(m => 
      m.tier === 'Premium' ? 3 : m.tier === 'Tier 1' ? 2 : m.tier === 'Standard' ? 1 : 0
    ));
    const machineTier = machine.tier === 'Premium' ? 3 : machine.tier === 'Tier 1' ? 2 : machine.tier === 'Standard' ? 1 : 0;
    
    if (machineTier < requiredMaxTier - 1) {
      console.log(`     ⚠️ Substitution allowed but with efficiency impact: ${machine.machineId} (${machine.tier}) for ${requiredMachines[0]?.tier} work`);
    }
    
    console.log(`     ✅ Substitution allowed: ${machine.machineId} can substitute for ${requiredMachines.map(m => m.machineId).join(', ')}`);
    return true;
  }

  // Helper to calculate week string from date
  private getWeekString(date: Date): string {
    const yearStart = new Date(date.getFullYear(), 0, 1);
    const days = Math.floor((date.getTime() - yearStart.getTime()) / (24 * 60 * 60 * 1000));
    const weekNumber = Math.ceil((days + yearStart.getDay() + 1) / 7);
    return `${date.getFullYear()}-W${weekNumber.toString().padStart(2, '0')}`;
  }

  // OPTIMIZATION: Validate weekly capacity constraints with caching
  private async validateWeeklyCapacity(
    targetDate: Date,
    shift: number,
    hoursToAdd: number
  ): Promise<{ valid: boolean; currentHours: number; maxHours: number }> {
    const weekString = this.getWeekString(targetDate);
    const allScheduleEntries = await this.getCachedScheduleEntries(); // OPTIMIZATION: Use cached entries
    
    // Calculate current hours for this week and shift
    const weekHours = allScheduleEntries
      .filter(entry => {
        const entryWeek = this.getWeekString(new Date(entry.startTime));
        return entryWeek === weekString && entry.shift === shift;
      })
      .reduce((total, entry) => total + this.calculateEntryDurationHours(entry), 0);
    
    // Weekly capacity limits
    const maxHours = shift === 1 ? 448 : 120; // Shift 1: 112h/day × 4 days, Shift 2: 120h/week
    const valid = (weekHours + hoursToAdd) <= maxHours;
    
    if (!valid) {
      console.log(`🚫 CAPACITY EXCEEDED - Week ${weekString} Shift ${shift}: ${weekHours.toFixed(1)}h + ${hoursToAdd.toFixed(1)}h = ${(weekHours + hoursToAdd).toFixed(1)}h / ${maxHours}h max`);
    } else {
      console.log(`📊 Week ${weekString} Shift ${shift}: ${weekHours.toFixed(1)}h + ${hoursToAdd.toFixed(1)}h = ${(weekHours + hoursToAdd).toFixed(1)}h / ${maxHours}h max`);
    }
    
    return { valid, currentHours: weekHours, maxHours };
  }

  // Check if an operation is a saw or waterjet operation (requires 24hr lag time)
  private isSawOrWaterjetOperation(operation: RoutingOperationType): boolean {
    const sawWaterjetKeywords = ['saw', 'cut', 'cutoff', 'part off', 'sawing', 'waterjet', 'water jet', 'plasma'];
    const operationName = operation.name.toLowerCase();
    const machineType = operation.machineType.toLowerCase();
    
    // Check machine type first
    if (machineType.includes('saw') || machineType.includes('waterjet') || machineType.includes('plasma')) {
      return true;
    }

    // Check operation name for saw/waterjet keywords
    return sawWaterjetKeywords.some(keyword => operationName.includes(keyword));
  }

  // OPTIMIZATION: Centralized capacity checking with caching
  private async getCachedScheduleEntries(): Promise<ScheduleEntry[]> {
    const now = Date.now();
    if (this.scheduleCache && now < this.scheduleCacheExpiry) {
      return this.scheduleCache;
    }
    
    this.scheduleCache = await this.getScheduleEntries();
    this.scheduleCacheExpiry = now + this.CACHE_DURATION;
    return this.scheduleCache;
  }

  // OPTIMIZATION: Invalidate cache when schedule changes
  private invalidateScheduleCache(): void {
    this.scheduleCache = null;
    this.scheduleCacheExpiry = 0;
  }

  // OPTIMIZATION: Consolidated capacity checking function
  private async getMachineCapacityInfo(
    machineId: string, 
    targetDate: Date, 
    shift: number
  ): Promise<{
    currentHours: number;
    maxHours: number;
    availableHours: number;
    utilizationPercent: number;
  }> {
    const scheduleEntries = await this.getCachedScheduleEntries();
    
    const currentHours = scheduleEntries
      .filter(entry => {
        const entryDate = new Date(entry.startTime);
        return entry.machineId === machineId && 
               entry.shift === shift &&
               entryDate.toDateString() === targetDate.toDateString();
      })
      .reduce((total, entry) => total + this.calculateEntryDurationHours(entry), 0);
    
    const maxHours = shift === 1 ? 12 : 12; // 12 hours per shift (3am-3pm, 3pm-3am)
    const availableHours = Math.max(0, maxHours - currentHours);
    const utilizationPercent = (currentHours / maxHours) * 100;
    
    return {
      currentHours,
      maxHours, 
      availableHours,
      utilizationPercent
    };
  }

  // OPTIMIZATION: Consolidated resource assignment function to eliminate duplicate code
  private async assignOptimalResource(
    machine: Machine, 
    shift: number, 
    operationType: 'PRODUCTION' | 'INSPECT' | 'OUTSOURCE',
    startTime?: Date,
    endTime?: Date
  ): Promise<Resource | null> {
    console.log(`🔍 Resource Assignment for ${machine.machineId} (${operationType}) on Shift ${shift}`);
    
    if (machine.type === 'OUTSOURCE' || operationType === 'OUTSOURCE' || machine.machineId === 'INSPECT-001') {
      console.log(`🏭 OUTSOURCE/INSPECT-001 operation: No internal resource assignment, external vendor or inspection station handles work`);
      return null; // External vendors or inspection stations handle work
    }
    
    const allResources = await this.getResources();
    
    if (operationType === 'INSPECT') {
      // INSPECT operations: Only assign Quality Inspectors
      const inspectors = allResources.filter(async (resource) => {
        const isActive = resource.isActive;
        const hasShift = resource.shiftSchedule?.includes(shift);
        const canOperateMachine = resource.workCenters?.includes(machine.id);
        const isInspector = resource.role === 'Quality Inspector';
        
        // CRITICAL: Check if resource is already busy during the target time period
        let isAvailable = true;
        if (startTime && endTime) {
          isAvailable = await this.isResourceAvailableAtTime(resource.id, startTime, endTime);
        }
        
        console.log(`🔍 INSPECT check ${resource.name}: active=${isActive}, shift=${hasShift}, machine=${canOperateMachine}, inspector=${isInspector}, available=${isAvailable}`);
        return isActive && hasShift && canOperateMachine && isInspector && isAvailable;
      });
      
      // Wait for all async filters to resolve
      const availableInspectors = [];
      for (const resource of allResources) {
        const isActive = resource.isActive;
        const hasShift = resource.shiftSchedule?.includes(shift);
        const canOperateMachine = resource.workCenters?.includes(machine.id);
        const isInspector = resource.role === 'Quality Inspector';
        
        let isAvailable = true;
        if (startTime && endTime) {
          isAvailable = await this.isResourceAvailableAtTime(resource.id, startTime, endTime);
        }
        
        console.log(`🔍 INSPECT check ${resource.name}: active=${isActive}, shift=${hasShift}, machine=${canOperateMachine}, inspector=${isInspector}, available=${isAvailable}`);
        
        if (isActive && hasShift && canOperateMachine && isInspector && isAvailable) {
          availableInspectors.push(resource);
        }
      }
      
      if (availableInspectors.length > 0) {
        console.log(`✅ Assigned inspector: ${availableInspectors[0].name} to ${machine.machineId}`);
        return availableInspectors[0];
      } else {
        console.log(`❌ No qualified inspectors available for ${machine.machineId}`);
        return null;
      }
    }
    
    // PRODUCTION operations: Assign Operators or Shift Leads
    const availableOperators = [];
    for (const resource of allResources) {
      const isActive = resource.isActive;
      const hasShift = resource.shiftSchedule?.includes(shift);
      const canOperateMachine = resource.workCenters?.includes(machine.id);
      const isOperator = resource.role === 'Operator' || resource.role === 'Shift Lead';
      
      // CRITICAL: Check if resource is already busy during the target time period
      let isAvailable = true;
      if (startTime && endTime) {
        isAvailable = await this.isResourceAvailableAtTime(resource.id, startTime, endTime);
      }
      
      console.log(`⚙️ PRODUCTION check ${resource.name}: active=${isActive}, shift=${hasShift}, machine=${canOperateMachine}, operator=${isOperator}, available=${isAvailable}`);
      console.log(`   Resource work centers: ${resource.workCenters?.join(', ')}`);
      console.log(`   Target machine ID: ${machine.id}, Machine: ${machine.machineId}`);
      
      if (isActive && hasShift && canOperateMachine && isOperator && isAvailable) {
        availableOperators.push(resource);
      }
    }
    
    if (availableOperators.length > 0) {
      // Prefer Shift Leads over regular Operators
      const shiftLeads = availableOperators.filter(r => r.role === 'Shift Lead');
      const selectedResource = shiftLeads.length > 0 ? shiftLeads[0] : availableOperators[0];
      console.log(`⚙️ Assigned operator: ${selectedResource.name} to machine ${machine.machineId}`);
      return selectedResource;
    } else {
      console.log(`❌ No qualified operators available for machine ${machine.machineId}`);
      return null;
    }
  }

  // CRITICAL: Get custom work schedule start/end times for a resource on a specific day
  private getResourceWorkTimes(resource: Resource, date: Date): { startTime: Date; endTime: Date } | null {
    const dayOfWeek = date.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayNames[dayOfWeek] as keyof typeof resource.workSchedule;
    
    const workDay = resource.workSchedule?.[dayName];
    if (!workDay?.enabled) {
      return null; // Resource doesn't work on this day
    }
    
    const startTime = new Date(date);
    const endTime = new Date(date);
    
    // Parse the time strings (e.g., "05:00", "16:00")
    const [startHour, startMin] = (workDay.startTime || "03:00").split(':').map(Number);
    const [endHour, endMin] = (workDay.endTime || "15:00").split(':').map(Number);
    
    startTime.setHours(startHour, startMin, 0, 0);
    endTime.setHours(endHour, endMin, 0, 0);
    
    // REDUCED LOGGING: Only log once per unique resource-date combination to prevent infinite log spam
    const logKey = `${resource.name}-${dayName}-${date.toDateString()}`;
    if (!this.schedulingLogCache) {
      this.schedulingLogCache = new Set();
    }
    if (!this.schedulingLogCache.has(logKey)) {
      console.log(`📅 ${resource.name} work schedule on ${dayName}: ${startTime.toLocaleTimeString()} - ${endTime.toLocaleTimeString()}`);
      this.schedulingLogCache.add(logKey);
    }
    
    return { startTime, endTime };
  }

  // CRITICAL: Check if a resource is available at a specific time (no conflicts with other assignments)
  private async isResourceAvailableAtTime(resourceId: string, startTime: Date, endTime: Date): Promise<boolean> {
    const scheduleEntries = await this.getCachedScheduleEntries();
    
    // Check for any overlapping assignments for this resource
    const conflicts = scheduleEntries.filter(entry => {
      if (entry.assignedResourceId !== resourceId) {
        return false; // Different resource, no conflict
      }
      
      const entryStart = new Date(entry.startTime);
      const entryEnd = new Date(entry.endTime);
      
      // Check for time overlap: (start1 < end2) && (start2 < end1)
      const hasOverlap = startTime < entryEnd && entryStart < endTime;
      
      if (hasOverlap) {
        console.log(`⚠️ RESOURCE CONFLICT: ${resourceId} busy on machine ${entry.machineId} from ${entryStart.toLocaleString()} to ${entryEnd.toLocaleString()}`);
        console.log(`   Requested time: ${startTime.toLocaleString()} to ${endTime.toLocaleString()}`);
      }
      
      return hasOverlap;
    });
    
    const isAvailable = conflicts.length === 0;
    console.log(`🔍 Resource ${resourceId} availability check: ${isAvailable ? 'AVAILABLE' : 'BUSY'} (${conflicts.length} conflicts)`);
    
    return isAvailable;
  }

  // DEPRECATED: Use getMachineCapacityInfo instead
  private async getMachineHoursOnDate(machineId: string, targetDate: Date, shift: number): Promise<number> {
    const capacity = await this.getMachineCapacityInfo(machineId, targetDate, shift);
    return capacity.currentHours;
  }

  async autoScheduleJob(
    jobId: string, 
    onProgress?: (progress: {
      percentage: number;
      status: string;
      stage: string;
      operationName?: string;
      currentOperation?: number;
      totalOperations?: number;
    }) => void
  ): Promise<{ success: boolean; scheduleEntries?: ScheduleEntry[]; failureReason?: string; failureDetails?: any[] }> {
    console.log(`🚀 DEBUG: Starting autoScheduleJob for ${jobId}`);
    
    const job = await this.getJob(jobId);
    if (!job || !job.routing || job.routing.length === 0) {
      console.log(`❌ DEBUG: Job validation failed - job: ${!!job}, routing: ${job?.routing?.length || 0}`);
      return { 
        success: false, 
        failureReason: "Job not found or has no routing operations",
        failureDetails: []
      };
    }
    
    console.log(`📋 DEBUG: Job ${job.jobNumber} has ${job.routing.length} operations`);
    
    // Initialize multiDayEntries array for scheduling operations
    const multiDayEntries: any[] = [];
    
    // DEBUG: Check machine and resource availability
    const allMachines = await this.getMachines();
    const allResources = await this.getResources();
    console.log(`🏭 DEBUG: Available machines: ${allMachines.length}, resources: ${allResources.length}`);
    console.log(`🔧 DEBUG: Machine types: ${[...new Set(allMachines.map(m => m.type))].join(', ')}`);
    console.log(`👥 DEBUG: Resource roles: ${[...new Set(allResources.map(r => r.role))].join(', ')}`);
    
    // DEBUG: Check first operation compatibility
    const firstOp = job.routing[0];
    console.log(`🎯 DEBUG: First operation - Type: ${firstOp.machineType}, Compatible: [${firstOp.compatibleMachines.join(', ')}], Hours: ${firstOp.estimatedHours}`);
    
    const compatibleMachines = allMachines.filter(m => firstOp.compatibleMachines.includes(m.machineId));
    console.log(`✅ DEBUG: Found ${compatibleMachines.length} directly compatible machines for first operation`);
    if (compatibleMachines.length > 0) {
      console.log(`🔧 DEBUG: Compatible machines: ${compatibleMachines.map(m => `${m.machineId}(${m.status})`).join(', ')}`);
    }

    const scheduleEntries: ScheduleEntry[] = [];
    const failureDetails: any[] = [];
    const dayInMs = 24 * 60 * 60 * 1000;
    
    // CRITICAL FIX: Get current time in US Central timezone
    const nowUTC = new Date();
    const centralOffset = -6; // US Central Standard Time (CST) is UTC-6
    const nowCentral = new Date(nowUTC.getTime() + (centralOffset * 60 * 60 * 1000));
    
    // BUSINESS RULE: NEVER schedule in the past - earliest is tomorrow in Central time
    const earliestStartDate = new Date(nowCentral.getTime() + dayInMs); // Tomorrow in Central time
    
    // Traditional scheduling would be 7 days from creation, but enforce minimum of tomorrow
    const materialPrepDate = new Date(job.createdDate.getTime() + (7 * dayInMs));
    let currentDate = materialPrepDate < earliestStartDate ? earliestStartDate : materialPrepDate;
    
    console.log(`📅 SCHEDULING DATES: Current Central: ${nowCentral.toLocaleString('en-US', {timeZone: 'America/Chicago'})}`);
    console.log(`📅 SCHEDULING DATES: Earliest allowed: ${earliestStartDate.toLocaleString('en-US', {timeZone: 'America/Chicago'})}`);
    console.log(`📅 SCHEDULING DATES: Material prep would be: ${materialPrepDate.toLocaleString('en-US', {timeZone: 'America/Chicago'})}`);
    console.log(`📅 SCHEDULING DATES: Starting from: ${currentDate.toLocaleString('en-US', {timeZone: 'America/Chicago'})}`);
    
    const maxDate = new Date(currentDate.getTime() + (21 * dayInMs)); // 21-day window from start date
    
    // Sort operations by sequence
    const sortedOperations = [...job.routing].sort((a, b) => a.sequence - b.sequence);
    
    for (let i = 0; i < sortedOperations.length; i++) {
      const operation = sortedOperations[i];
      let scheduled = false;
      
      // Try to schedule within the 21-day window
      while (currentDate <= maxDate && !scheduled) {
        // Skip weekends (Friday-Sunday) for most operations
        if (currentDate.getDay() === 0 || currentDate.getDay() === 5 || currentDate.getDay() === 6) {
          currentDate = new Date(currentDate.getTime() + dayInMs);
          continue;
        }
        
        // OPTIMIZATION: Handle outsource and inspect operations specially - no capacity limits
        if (operation.machineType === 'OUTSOURCE' || operation.compatibleMachines.includes('OUTSOURCE-01') || 
            operation.machineType.includes('INSPECT') || operation.name.toLowerCase().includes('inspect')) {
          // Outsource/Inspect operations are placeholders - create entry without capacity constraints
          const machines = await this.getMachines();
          let machineId = 'outsource-placeholder';
          let status = "Outsourced";
          let assignedResourceId = null;
          
          if (operation.machineType.includes('INSPECT') || operation.name.toLowerCase().includes('inspect')) {
            // INSPECT: Find inspect machine and assign ONLY quality inspectors
            const inspectMachine = machines.find(m => m.machineId.includes('INSPECT'));
            machineId = inspectMachine?.id || 'inspect-placeholder';
            status = "Scheduled";
            
            // Find available quality inspectors for this machine
            const resources = await this.getResources();
            const inspectors = resources.filter(resource => {
              const isActive = resource.isActive;
              const hasShift = resource.shiftSchedule?.includes(1); // Default to shift 1
              const canOperateMachine = resource.workCenters?.includes(machineId);
              const isInspector = resource.role === 'Quality Inspector';
              
              console.log(`🔍 INSPECT resource check ${resource.name}: active=${isActive}, shift=${hasShift}, machine=${canOperateMachine}, inspector=${isInspector}`);
              
              return isActive && hasShift && canOperateMachine && isInspector;
            });
            
            if (inspectors.length > 0) {
              assignedResourceId = inspectors[0].id;
              console.log(`🔍 Assigned inspector ${inspectors[0].name} to INSPECT operation`);
            } else {
              console.log(`❌ No qualified inspectors available for INSPECT operation`);
              console.log(`❌ Total resources: ${resources.length}, Active: ${resources.filter(r => r.isActive).length}, Inspectors: ${resources.filter(r => r.role === 'Quality Inspector').length}`);
              // Still create the entry but without resource assignment
            }
          } else {
            // OUTSOURCE: Find outsource machine, NO internal resource assignment
            const outsourceMachine = machines.find(m => m.machineId === 'OUTSOURCE-01');
            machineId = outsourceMachine?.id || 'outsource-placeholder';
            assignedResourceId = null; // CRITICAL: Never assign internal resources to outsource
            console.log(`🏭 OUTSOURCE operation: No internal resource assigned, handled by external vendor`);
          }
          
          // CRITICAL: Ensure we're scheduling at proper shift start time in Central timezone  
          const centralStartTime = new Date(currentDate);
          centralStartTime.setHours(3, 0, 0, 0); // 3:00 AM Central = Shift 1 start (fallback for OUTSOURCE/INSPECT)
          const centralEndTime = new Date(centralStartTime.getTime() + (parseFloat(operation.estimatedHours) * 60 * 60 * 1000));
          
          console.log(`📅 OUTSOURCE/INSPECT scheduling: ${centralStartTime.toLocaleString('en-US', {timeZone: 'America/Chicago'})} to ${centralEndTime.toLocaleString('en-US', {timeZone: 'America/Chicago'})}`);
          
          const scheduleEntry = await this.createScheduleEntry({
            jobId: job.id,
            machineId: machineId,
            assignedResourceId: assignedResourceId,
            operationSequence: operation.sequence,
            startTime: centralStartTime,
            endTime: centralEndTime,
            shift: 1, // Default to shift 1
            status: status
          });
          
          scheduleEntries.push(scheduleEntry);
          onProgress?.({
            percentage: ((i + 1) / sortedOperations.length) * 90,
            status: `Operation ${i + 1} scheduled (${status.toLowerCase()})`,
            stage: 'scheduled',
            operationName: operation.name,
            currentOperation: i + 1,
            totalOperations: sortedOperations.length
          });
          
          // Check if this is a saw/waterjet operation - add 24hr lag to next operation
          const isSawOrWaterjet = this.isSawOrWaterjetOperation(operation);
          if (isSawOrWaterjet) {
            currentDate = new Date(currentDate.getTime() + dayInMs); // Add 24hr lag for saw/waterjet
          } else {
            // For other operations, schedule next operation immediately after (by hours, not days)
            const operationHours = parseFloat(operation.estimatedHours);
            currentDate = new Date(currentDate.getTime() + (operationHours * 60 * 60 * 1000));
          }
          scheduled = true;
          continue;
        }

        // PRIORITY-BASED SCHEDULING: Check if capacity allows or if we can displace lower priority jobs
        const availableShifts = await this.getShiftsOrderedByLoad(currentDate, operation);
        if (availableShifts.length === 0) {
          // Try priority-based displacement for critical/high priority jobs
          if (job.priority === 'Critical' || job.priority === 'High') {
            const displacementResult = await this.attemptPriorityDisplacement(job, operation, currentDate);
            if (displacementResult.success) {
              console.log(`🔄 PRIORITY DISPLACEMENT: ${job.priority} job ${job.jobNumber} displaced lower priority job`);
              
              // CRITICAL: Apply strict resource assignment rules even for displacement
              const machine = await this.getMachine(displacementResult.machineId!);
              if (!machine) {
                console.log(`❌ DISPLACEMENT ERROR: Machine not found for displacement`);
                continue;
              }
              
              const operationType = machine.type === 'OUTSOURCE' ? 'OUTSOURCE' : 
                                   machine.type === 'INSPECT' ? 'INSPECT' : 'PRODUCTION';
              const assignedResource = operationType === 'OUTSOURCE' ? null : 
                                     await this.assignOptimalResource(machine, displacementResult.shift!, operationType, displacementResult.startTime!, displacementResult.endTime!);
              
              // Schedule this operation in the freed slot
              const scheduleEntry = await this.createScheduleEntry({
                jobId: job.id,
                machineId: displacementResult.machineId!,
                assignedResourceId: assignedResource?.id || null, // STRICT RESOURCE ASSIGNMENT
                operationSequence: operation.sequence,
                startTime: displacementResult.startTime!,
                endTime: displacementResult.endTime!,
                shift: displacementResult.shift!,
                status: "Scheduled"
              });
              
              scheduleEntries.push(scheduleEntry);
              onProgress?.({
                percentage: ((i + 1) / sortedOperations.length) * 90,
                status: `Operation ${i + 1} scheduled via priority displacement`,
                stage: 'scheduled',
                operationName: operation.name,
                currentOperation: i + 1,
                totalOperations: sortedOperations.length
              });
              
              // ENHANCED: Update currentDate based on when this operation ends
              if (multiDayEntries.length > 0) {
                // Use the end time of the last entry for complex multi-day operations
                const lastEntry = multiDayEntries[multiDayEntries.length - 1];
                currentDate = new Date(lastEntry.endTime);
              } else {
                // Check if this is a saw/waterjet operation - add 24hr lag to next operation
                const isSawOrWaterjet = this.isSawOrWaterjetOperation(operation);
                if (isSawOrWaterjet) {
                  currentDate = new Date(currentDate.getTime() + dayInMs); // Add 24hr lag for saw/waterjet
                } else {
                  // For other operations, schedule next operation immediately after (by hours, not days)
                  const operationHours = parseFloat(operation.estimatedHours);
                  currentDate = new Date(currentDate.getTime() + (operationHours * 60 * 60 * 1000));
                }
              }
              scheduled = true;
              break;
            }
          }
          
          console.log(`⏭️ MOVING TO NEXT WEEK: No capacity available on ${currentDate.toDateString()}`);
          // Move to next Monday to find capacity in following week
          const nextMonday = new Date(currentDate);
          nextMonday.setDate(currentDate.getDate() + (8 - currentDate.getDay())); // Move to next Monday
          currentDate = nextMonday;
          continue; // Skip this day entirely
        }
        
        let operationFailureReasons: string[] = [];
        
        // Use only shifts that have available capacity
        for (const shift of availableShifts) {
          console.log(`🔍 DEBUG: Trying shift ${shift} for operation ${operation.sequence} (${operation.name || operation.machineType})`);
          
          const result = await this.findBestMachineForOperation(operation, currentDate, shift);
          
          if (!result) {
            console.log(`❌ DEBUG: findBestMachineForOperation returned null for shift ${shift}`);
            // Collect detailed failure reason for this shift attempt
            const availableMachines = await this.getMachines();
            const directlyCompatible = availableMachines.filter(m => 
              operation.compatibleMachines.includes(m.machineId)
            );
            
            // Check substitution compatibility for machines with substitution groups
            const substitutionCompatible = [];
            for (const machine of availableMachines) {
              if (machine.substitutionGroup && !operation.compatibleMachines.includes(machine.machineId)) {
                if (await this.canSubstitute(machine, operation)) {
                  substitutionCompatible.push(machine);
                }
              }
            }
            
            const compatibleMachines = [...directlyCompatible, ...substitutionCompatible];
            
            if (compatibleMachines.length === 0) {
              operationFailureReasons.push(`Shift ${shift}: No compatible machines available for ${operation.machineType}`);
            } else {
              const shiftAvailableMachines = compatibleMachines.filter(m => m.availableShifts?.includes(shift));
              if (shiftAvailableMachines.length === 0) {
                operationFailureReasons.push(`Shift ${shift}: Compatible machines (${compatibleMachines.map(m => m.machineId).join(', ')}) not available on shift ${shift}`);
              } else {
                operationFailureReasons.push(`Shift ${shift}: Compatible machines available but fully booked or conflicted`);
              }
            }
            continue;
          }
          
          if (result) {
            let currentShift = shift; // Keep track of current shift separately
            const shiftHoursPerDay = 8;
            let remainingHours = result.adjustedHours;
            let operationStartTime = new Date(currentDate);
            
            // CRITICAL: Assign resource with proper timing to avoid conflicts
            const operationType = result.machine.type === 'OUTSOURCE' ? 'OUTSOURCE' : 
                                 result.machine.type === 'INSPECT' ? 'INSPECT' : 'PRODUCTION';
            const assignedResource = operationType === 'OUTSOURCE' ? null : 
                                   await this.assignOptimalResource(result.machine, currentShift, operationType);
            
            // ENHANCED: Use custom work schedule if resource is assigned, fallback to generic shifts
            if (assignedResource) {
              const workTimes = this.getResourceWorkTimes(assignedResource, currentDate);
              if (workTimes) {
                operationStartTime = new Date(workTimes.startTime);
                console.log(`🕐 Using ${assignedResource.name}'s custom schedule: ${operationStartTime.toLocaleString()} (${workTimes.startTime.toLocaleTimeString()} - ${workTimes.endTime.toLocaleTimeString()})`);
              } else {
                // Resource doesn't work on this day - skip to next day
                console.log(`❌ ${assignedResource.name} doesn't work on ${currentDate.toDateString()}, moving to next day`);
                currentDate = new Date(currentDate.getTime() + dayInMs);
                continue;
              }
            } else {
              // Fallback to generic shift times when no resource assigned
              operationStartTime.setHours(currentShift === 1 ? 3 : 15, 0, 0, 0);
              console.log(`🕐 Using generic shift time: ${operationStartTime.toLocaleString()} (Shift ${currentShift})`);
            }
            
            // If this is not the first operation and not a saw/waterjet, start immediately after previous
            if (i > 0 && !this.isSawOrWaterjetOperation(operation)) {
              // Get the last scheduled entry to continue from its end time
              const lastScheduled = scheduleEntries[scheduleEntries.length - 1];
              if (lastScheduled) {
                operationStartTime = new Date(lastScheduled.endTime);
                
                // Adjust to next available shift time if needed
                const hour = operationStartTime.getHours();
                if (hour < 3) {
                  operationStartTime.setHours(3, 0, 0, 0); // Start of shift 1
                  currentShift = 1;
                } else if (hour >= 15 && hour < 15) {
                  operationStartTime.setHours(15, 0, 0, 0); // Start of shift 2  
                  currentShift = 2;
                } else if (hour >= 15) {
                  // Past shift 1, check if machine supports shift 2
                  if (result.machine.availableShifts?.includes(2)) {
                    operationStartTime.setHours(15, 0, 0, 0); // Start of shift 2
                    currentShift = 2;
                  } else {
                    // Move to next day shift 1
                    operationStartTime = new Date(operationStartTime.getTime() + dayInMs);
                    operationStartTime.setHours(3, 0, 0, 0);
                    currentShift = 1;
                  }
                }
              }
            }
            
            // ENHANCED MULTI-SHIFT JOB HANDLING: Properly bridge operations across shifts/days
            let multiShiftAttempts = 0;
            const maxMultiShiftAttempts = 50; // CRITICAL: Prevent infinite loops
            
            while (remainingHours > 0 && multiShiftAttempts < maxMultiShiftAttempts) {
              multiShiftAttempts++;
              // ENHANCED: Skip days based on resource's custom work schedule
              if (assignedResource) {
                // Skip days when resource doesn't work (with loop protection)
                let daySkipCount = 0;
                while (!this.getResourceWorkTimes(assignedResource, operationStartTime) && daySkipCount < 10) {
                  operationStartTime = new Date(operationStartTime.getTime() + dayInMs);
                  daySkipCount++;
                }
                if (daySkipCount >= 10) {
                  console.log(`❌ CRITICAL: Could not find working day for ${assignedResource.name} after 10 attempts`);
                  break; // Exit the multi-shift loop
                }
              } else {
                // Fallback: Skip weekends (Friday-Sunday) for generic shifts
                while (operationStartTime.getDay() === 0 || operationStartTime.getDay() === 5 || operationStartTime.getDay() === 6) {
                  operationStartTime = new Date(operationStartTime.getTime() + dayInMs);
                  operationStartTime.setHours(3, 0, 0, 0); // Start at 3am on next business day
                  currentShift = 1;
                }
              }
              
              // ENHANCED: Calculate available hours in current work schedule (custom or generic)
              const currentHour = operationStartTime.getHours();
              let availableHoursInShift = 0;
              let workEndTime: Date;
              
              if (assignedResource) {
                // Use resource's custom work schedule
                const workTimes = this.getResourceWorkTimes(assignedResource, operationStartTime);
                if (workTimes) {
                  workEndTime = workTimes.endTime;
                  const workStartHour = workTimes.startTime.getHours();
                  const workEndHour = workTimes.endTime.getHours();
                  
                  if (currentHour < workStartHour) {
                    operationStartTime = new Date(workTimes.startTime);
                    availableHoursInShift = workEndHour - workStartHour;
                  } else if (currentHour < workEndHour) {
                    availableHoursInShift = workEndHour - currentHour;
                  } else {
                    // Past work hours, move to next working day
                    operationStartTime = new Date(operationStartTime.getTime() + dayInMs);
                    continue;
                  }
                  console.log(`📅 ${assignedResource.name} has ${availableHoursInShift}h available on ${operationStartTime.toDateString()}`);
                } else {
                  // Resource doesn't work on this day
                  operationStartTime = new Date(operationStartTime.getTime() + dayInMs);
                  continue;
                }
              } else {
                // Fallback to generic shift logic
                if (currentShift === 1) {
                  // Shift 1: 3am-3pm (12 hours)
                  if (currentHour < 3) {
                    operationStartTime.setHours(3, 0, 0, 0);
                    availableHoursInShift = 12;
                  } else if (currentHour < 15) {
                    availableHoursInShift = 15 - currentHour;
                  } else {
                    // Past shift 1, move to shift 2 if machine supports it
                    if (result.machine.availableShifts?.includes(2)) {
                      operationStartTime.setHours(15, 0, 0, 0);
                      currentShift = 2;
                      availableHoursInShift = 8;
                    } else {
                    // Move to next day
                    operationStartTime = new Date(operationStartTime.getTime() + dayInMs);
                    operationStartTime.setHours(3, 0, 0, 0);
                    currentShift = 1;
                    continue;
                  }
                }
              } else {
                // Shift 2: 3pm-11pm (8 hours)
                if (currentHour < 15) {
                  operationStartTime.setHours(15, 0, 0, 0);
                  availableHoursInShift = 8; // 3pm to 11pm same day
                } else if (currentHour < 23) {
                  availableHoursInShift = 23 - currentHour; // Hours until 11pm
                } else {
                  // Past shift 2, move to next day
                  operationStartTime = new Date(operationStartTime.getTime() + dayInMs);
                  operationStartTime.setHours(3, 0, 0, 0);
                  currentShift = 1;
                  continue;
                }
              }
              
              // OPTIMIZATION: Use consolidated capacity function for better performance
              const capacity = await this.getMachineCapacityInfo(result.machine.id, operationStartTime, currentShift);
              const availableCapacity = capacity.availableHours;
              
              const hoursThisShift = Math.min(remainingHours, availableHoursInShift, availableCapacity);
              
              if (hoursThisShift <= 0) {
                console.log(`   ⏭️ No capacity in shift ${currentShift}, moving to next time slot`);
                // Move to next available time
                if (currentShift === 1 && result.machine.availableShifts?.includes(2)) {
                  operationStartTime.setHours(15, 0, 0, 0);
                  currentShift = 2;
                } else {
                  operationStartTime = new Date(operationStartTime.getTime() + dayInMs);
                  operationStartTime.setHours(3, 0, 0, 0);
                  currentShift = 1;
                }
                continue;
              }
              
              // Ensure segment starts at proper shift time
              const segmentStartTime = new Date(operationStartTime);
              if (currentShift === 1) {
                segmentStartTime.setHours(3, 0, 0, 0); // 3:00 AM for Shift 1
              } else if (currentShift === 2) {
                segmentStartTime.setHours(15, 0, 0, 0); // 3:00 PM for Shift 2
              }
              
              const segmentEndTime = new Date(segmentStartTime.getTime() + (hoursThisShift * 60 * 60 * 1000));
              
              console.log(`   📅 Scheduling ${hoursThisShift.toFixed(1)}h segment from ${segmentStartTime.toLocaleString('en-US', {timeZone: 'America/Chicago'})} to ${segmentEndTime.toLocaleString('en-US', {timeZone: 'America/Chicago'})} (Shift ${currentShift})`);
              
              // CRITICAL: Assign resource with proper timing to avoid conflicts
              const operationType = result.machine.type === 'OUTSOURCE' ? 'OUTSOURCE' : 
                                   result.machine.type === 'INSPECT' ? 'INSPECT' : 'PRODUCTION';
              const assignedResource = operationType === 'OUTSOURCE' ? null : 
                                     await this.assignOptimalResource(result.machine, currentShift, operationType, segmentStartTime, segmentEndTime);
              
              multiDayEntries.push({
                jobId: job.id,
                machineId: result.machine.id,
                assignedResourceId: assignedResource?.id || null,
                operationSequence: operation.sequence,
                startTime: segmentStartTime,
                endTime: segmentEndTime,
                shift: currentShift,
                status: "Scheduled"
              });
              
              remainingHours -= hoursThisShift;
              
              if (remainingHours > 0) {
                // CRITICAL FIX: Handle machines that only work one shift (like HMCs)
                if (currentShift === 1 && result.machine.availableShifts?.includes(2)) {
                  // Machine supports both shifts - continue on shift 2 same day
                  operationStartTime.setHours(15, 0, 0, 0);
                  currentShift = 2;
                  console.log(`   ⏩ Continuing on shift 2 same day for machine ${result.machine.machineId}`);
                } else {
                  // Machine only works one shift OR already on shift 2 - move to next business day
                  operationStartTime = new Date(operationStartTime.getTime() + dayInMs);
                  operationStartTime.setHours(3, 0, 0, 0);
                  currentShift = 1; // Reset to shift 1 (many machines only work shift 1)
                  console.log(`   ⏩ Moving to next business day shift 1 (machine ${result.machine.machineId} only works shift ${result.machine.availableShifts?.join(',')})`);
                }
              }
            }
            
            // CRITICAL: Check if loop exited due to attempt limit
            if (multiShiftAttempts >= maxMultiShiftAttempts) {
              console.log(`❌ CRITICAL: Multi-shift scheduling exceeded maximum attempts (${maxMultiShiftAttempts}) for operation ${operation.name}`);
              console.log(`   Remaining hours: ${remainingHours}, Entries created: ${multiDayEntries.length}`);
              // Still continue with any entries we did create
            }
            
            // Create all the schedule entries for this multi-day operation
            if (multiDayEntries.length > 0) {
              for (const entry of multiDayEntries) {
                const scheduleEntry = await this.createScheduleEntry(entry);
                scheduleEntries.push(scheduleEntry);
              }
              
              // Update machine utilization
              const currentUtil = parseFloat(result.machine.utilization);
              const newUtil = Math.min(100, currentUtil + (result.adjustedHours / 8) * 100);
              await this.updateMachine(result.machine.id, { utilization: newUtil.toString() });
              
              // Move to next operation start time based on operation type
              const lastEntry = multiDayEntries[multiDayEntries.length - 1];
              const isSawOrWaterjet = this.isSawOrWaterjetOperation(operation);
              
              if (isSawOrWaterjet) {
                // Add 24hr lag for saw/waterjet operations
                currentDate = new Date(lastEntry.endTime.getTime() + dayInMs);
              } else {
                // Schedule next operation immediately after this one (continuous flow)
                currentDate = new Date(lastEntry.endTime);
              }
              
              scheduled = true;
              break;
            }
          }
        }
        
        if (!scheduled) {
          currentDate = new Date(currentDate.getTime() + dayInMs);
        }
      }
      
      // If couldn't schedule within window, collect failure details and create alert
      if (!scheduled) {
        const failureDetail = {
          operationSequence: operation.sequence,
          operationName: operation.name,
          machineType: operation.machineType,
          compatibleMachines: operation.compatibleMachines,
          attemptedDates: Math.ceil((maxDate.getTime() - (job.createdDate.getTime() + (7 * dayInMs))) / dayInMs),
          reasons: [`No suitable machines found for ${operation.machineType}`]
        };
        failureDetails.push(failureDetail);
        
        await this.createAlert({
          type: "warning",
          title: "Scheduling Conflict",
          message: `Unable to schedule operation ${operation.sequence} (${operation.name}) for job ${job.jobNumber}: ${failureDetail.reasons.join('; ')}`,
          jobId: job.id
        });
        
        return { 
          success: false, 
          failureReason: `Failed to schedule operation ${operation.sequence} (${operation.name})`,
          failureDetails 
        };
      }
    }
    
    // Update job status to scheduled
    await this.updateJob(jobId, { status: "Scheduled" });
    
    return { success: true, scheduleEntries };
  }
  }

  async manualScheduleJob(jobId: string, startDate: string): Promise<{ success: boolean; scheduleEntries?: ScheduleEntry[]; failureReason?: string }> {
    const job = await this.getJob(jobId);
    if (!job || !job.routing || job.routing.length === 0) {
      return { 
        success: false, 
        failureReason: "Job not found or has no routing operations"
      };
    }

    // Validate start date is not in the past
    const startDateTime = new Date(startDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (startDateTime < today) {
      return { 
        success: false, 
        failureReason: "Cannot schedule jobs in the past" 
      };
    }

    const manualScheduleEntries: ScheduleEntry[] = [];
    let manualCurrentDate = new Date(startDateTime);
    const manualDayInMs = 24 * 60 * 60 * 1000;
    
    // Sort operations by sequence
    const manualSortedOperations = [...job.routing].sort((a, b) => a.sequence - b.sequence);
    
    for (let i = 0; i < manualSortedOperations.length; i++) {
      const operation = manualSortedOperations[i];
      let scheduled = false;
      let attempts = 0;
      const maxAttempts = 10; // Try up to 10 working days
      
      while (!scheduled && attempts < maxAttempts) {
        // Skip weekends (Fri-Sun) - only schedule Mon-Thu
        if (manualCurrentDate.getDay() === 0 || manualCurrentDate.getDay() === 5 || manualCurrentDate.getDay() === 6) {
          manualCurrentDate = new Date(manualCurrentDate.getTime() + manualDayInMs);
          attempts++;
          continue;
        }
        
        // Handle outsource operations
        if (operation.machineType === 'OUTSOURCE' || operation.compatibleMachines.includes('OUTSOURCE-01')) {
          const machines = await this.getMachines();
          const outsourceMachine = machines.find(m => m.machineId === 'OUTSOURCE-01');
          
          if (outsourceMachine) {
            const scheduleEntry = await this.createScheduleEntry({
              jobId: job.id,
              machineId: outsourceMachine.id,
              operationSequence: operation.sequence,
              startTime: manualCurrentDate,
              endTime: new Date(manualCurrentDate.getTime() + (parseFloat(operation.estimatedHours.toString()) * 60 * 60 * 1000)),
              shift: 1,
              status: "Outsourced"
            });
            manualScheduleEntries.push(scheduleEntry);
            scheduled = true;
            // Move to next day for next operation
            manualCurrentDate = new Date(manualCurrentDate.getTime() + manualDayInMs);
            break;
          }
        } else {
          // Try scheduling regular operations - prioritize shift 1, then shift 2
          for (const shift of [1, 2]) {
            const machineResult = await this.findBestMachineForOperation(operation, manualCurrentDate, shift);
            
            if (machineResult) {
              const operationDurationMs = machineResult.adjustedHours * 60 * 60 * 1000;
              const shiftStartHour = shift === 1 ? 6 : 18; // 6 AM or 6 PM
              
              const startTime = new Date(manualCurrentDate);
              startTime.setHours(shiftStartHour, 0, 0, 0);
              
              const endTime = new Date(startTime.getTime() + operationDurationMs);
              
              // Check for conflicts
              const hasConflicts = await this.checkScheduleConflicts(machineResult.machine.id, startTime, endTime);
              
              if (!hasConflicts) {
                const scheduleEntry = await this.createScheduleEntry({
                  jobId: job.id,
                  machineId: machineResult.machine.id,
                  operationSequence: operation.sequence,
                  startTime,
                  endTime,
                  shift,
                  status: "Scheduled"
                });
                
                manualScheduleEntries.push(scheduleEntry);
                scheduled = true;
                
                // Calculate next start date - if operation ends same day, next operation can start next day
                // If operation spans multiple days, next operation starts day after completion
                const daysToAdd = Math.ceil(machineResult.adjustedHours / 8) || 1; // Assume 8-hour shifts
                manualCurrentDate = new Date(manualCurrentDate.getTime() + (daysToAdd * manualDayInMs));
                break;
              }
            }
          }
        }
        
        if (!scheduled) {
          manualCurrentDate = new Date(manualCurrentDate.getTime() + manualDayInMs);
          attempts++;
        }
      }
      
      if (!scheduled) {
        return {
          success: false,
          failureReason: `Failed to schedule operation ${operation.sequence} (${operation.name}) - no available machines found`
        };
      }
    }
    
    // Update job status to scheduled
    await this.updateJob(jobId, { status: "Scheduled" });
    
    return { success: true, scheduleEntries: manualScheduleEntries };
  }

  async dragScheduleJob(jobId: string, machineId: string, startDate: string, shift: number): Promise<{ success: boolean; scheduleEntries?: ScheduleEntry[]; failureReason?: string }> {
    const job = await this.getJob(jobId);
    if (!job || !job.routing || job.routing.length === 0) {
      return { 
        success: false, 
        failureReason: "Job not found or has no routing operations"
      };
    }

    // Validate start date is not in the past
    const startDateTime = new Date(startDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (startDateTime < today) {
      return { 
        success: false, 
        failureReason: "Cannot schedule jobs in the past" 
      };
    }

    // Get the target machine
    const machine = await this.getMachine(machineId);
    if (!machine) {
      return {
        success: false,
        failureReason: "Target machine not found"
      };
    }

    // Check if machine supports the requested shift
    if (!machine.availableShifts?.includes(shift)) {
      return {
        success: false,
        failureReason: `Machine ${machine.machineId} does not support shift ${shift}`
      };
    }

    const scheduleEntries: ScheduleEntry[] = [];
    let currentDate = new Date(startDateTime);
    const dayInMs = 24 * 60 * 60 * 1000;
    
    // Sort operations by sequence
    const sortedOperations = [...job.routing].sort((a, b) => a.sequence - b.sequence);
    
    // Try to schedule the first operation on the specified machine/date/shift
    for (let i = 0; i < sortedOperations.length; i++) {
      const operation = sortedOperations[i];
      let scheduled = false;
      let attempts = 0;
      const maxAttempts = 10;
      
      while (!scheduled && attempts < maxAttempts) {
        // Skip weekends (Fri-Sun) - only schedule Mon-Thu
        if (currentDate.getDay() === 0 || currentDate.getDay() === 5 || currentDate.getDay() === 6) {
          currentDate = new Date(currentDate.getTime() + dayInMs);
          attempts++;
          continue;
        }
        
        // For the first operation, use the specified machine if compatible
        if (i === 0) {
          // Check if the target machine is compatible with this operation
          const machines = await this.getMachines();
          const isCompatible = operation.compatibleMachines.includes(machine.machineId) || 
                              operation.machineType === machine.type ||
                              (machine.substitutionGroup && operation.compatibleMachines.some(compatId => {
                                const compatMachine = machines.find(m => m.machineId === compatId);
                                return compatMachine && compatMachine.substitutionGroup === machine.substitutionGroup;
                              }));

          if (!isCompatible) {
            return {
              success: false,
              failureReason: `Machine ${machine.machineId} is not compatible with operation ${operation.name} (requires: ${operation.compatibleMachines.join(', ')})`
            };
          }

          // Calculate operation duration and timing
          const operationHours = parseFloat(operation.estimatedHours);
          const operationDurationMs = operationHours * 60 * 60 * 1000;
          const shiftStartHour = shift === 1 ? 3 : 15; // 3 AM or 3 PM Central
          
          const startTime = new Date(currentDate);
          startTime.setHours(shiftStartHour, 0, 0, 0);
          
          const endTime = new Date(startTime.getTime() + operationDurationMs);
          
          // Check for conflicts
          const hasConflicts = await this.checkScheduleConflicts(machine.id, startTime, endTime);
          
          if (!hasConflicts) {
            const scheduleEntry = await this.createScheduleEntry({
              jobId: job.id,
              machineId: machine.id,
              operationSequence: operation.sequence,
              startTime,
              endTime,
              shift,
              status: "Scheduled"
            });
            
            scheduleEntries.push(scheduleEntry);
            scheduled = true;
            
            // Move to next day for subsequent operations
            const daysToAdd = Math.ceil(operationHours / 8) || 1;
            currentDate = new Date(currentDate.getTime() + (daysToAdd * dayInMs));
          } else {
            return {
              success: false,
              failureReason: `Time slot conflict: Machine ${machine.machineId} is already booked during the requested time`
            };
          }
        } else {
          // For subsequent operations, use normal scheduling logic
          for (const tryShift of [1, 2]) {
            const machineResult = await this.findBestMachineForOperation(operation, currentDate, tryShift);
            
            if (machineResult) {
              const operationDurationMs = machineResult.adjustedHours * 60 * 60 * 1000;
              const shiftStartHour = tryShift === 1 ? 6 : 18;
              
              const startTime = new Date(currentDate);
              startTime.setHours(shiftStartHour, 0, 0, 0);
              
              const endTime = new Date(startTime.getTime() + operationDurationMs);
              
              const hasConflicts = await this.checkScheduleConflicts(machineResult.machine.id, startTime, endTime);
              
              if (!hasConflicts) {
                const scheduleEntry = await this.createScheduleEntry({
                  jobId: job.id,
                  machineId: machineResult.machine.id,
                  operationSequence: operation.sequence,
                  startTime,
                  endTime,
                  shift: tryShift,
                  status: "Scheduled"
                });
                
                scheduleEntries.push(scheduleEntry);
                scheduled = true;
                
                const daysToAdd = Math.ceil(machineResult.adjustedHours / 8) || 1;
                currentDate = new Date(currentDate.getTime() + (daysToAdd * dayInMs));
                break;
              }
            }
          }
        }
        
        if (!scheduled) {
          currentDate = new Date(currentDate.getTime() + dayInMs);
          attempts++;
        }
      }
      
      if (!scheduled) {
        return {
          success: false,
          failureReason: `Failed to schedule operation ${operation.sequence} (${operation.name})`
        };
      }
    }
    
    // Update job status to scheduled
    await this.updateJob(jobId, { status: "Scheduled" });
    
    return { success: true, scheduleEntries };
  }

  private async checkScheduleConflicts(machineId: string, startTime: Date, endTime: Date): Promise<boolean> {
    const existingEntries = await this.getScheduleEntriesForMachine(machineId);
    
    return existingEntries.some(entry => {
      const entryStart = new Date(entry.startTime);
      const entryEnd = new Date(entry.endTime);
      
      // Check for overlap
      return (startTime < entryEnd && endTime > entryStart);
    });
  }

  // Material Order Management
  async getMaterialOrders(): Promise<MaterialOrder[]> {
    return await db.select().from(materialOrders).orderBy(desc(materialOrders.dueDate));
  }

  async getMaterialOrdersForJob(jobId: string): Promise<MaterialOrder[]> {
    return await db.select().from(materialOrders).where(eq(materialOrders.jobId, jobId));
  }

  async createMaterialOrder(orderData: InsertMaterialOrder): Promise<MaterialOrder> {
    const [order] = await db.insert(materialOrders).values(orderData).returning();
    return order;
  }

  async updateMaterialOrder(orderId: string, updates: Partial<MaterialOrder>): Promise<MaterialOrder | null> {
    const [order] = await db.update(materialOrders)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(materialOrders.id, orderId))
      .returning();
    return order || null;
  }

  async markMaterialReceived(orderId: string): Promise<MaterialOrder | null> {
    return await this.updateMaterialOrder(orderId, { 
      status: "Closed", 
      receivedDate: new Date() 
    });
  }

  async deleteAllMaterialOrders(): Promise<number> {
    const result = await db.delete(materialOrders);
    return result.rowCount || 0;
  }

  async deleteAllJobsAwaitingMaterial(): Promise<number> {
    // This deletes all material orders for jobs that are awaiting material
    // which effectively removes them from the "awaiting material" status
    const result = await db.delete(materialOrders).where(eq(materialOrders.status, "Open"));
    return result.rowCount || 0;
  }

  // Get jobs awaiting material - key method for material tracking
  async getJobsAwaitingMaterial(): Promise<Array<Job & { materialOrders: MaterialOrder[] }>> {
    const jobsWithMaterial = await db.select({
      job: jobs,
      materialOrder: materialOrders
    })
    .from(jobs)
    .leftJoin(materialOrders, eq(jobs.id, materialOrders.jobId))
    .where(eq(materialOrders.status, "Open"));

    // Group by job and collect material orders
    const jobMap = new Map<string, Job & { materialOrders: MaterialOrder[] }>();
    
    for (const row of jobsWithMaterial) {
      if (!jobMap.has(row.job.id)) {
        jobMap.set(row.job.id, { ...row.job, materialOrders: [] });
      }
      if (row.materialOrder) {
        jobMap.get(row.job.id)!.materialOrders.push(row.materialOrder);
      }
    }

    return Array.from(jobMap.values()).filter(job => job.materialOrders.length > 0);
  }

  // Check if job has material concerns but don't block scheduling
  async isJobReadyForScheduling(jobId: string): Promise<{ ready: boolean; reason?: string; pendingMaterials?: MaterialOrder[]; needsReview?: boolean }> {
    // Jobs are always ready for scheduling (day 0 scheduling policy)
    const materialOrders = await this.getMaterialOrdersForJob(jobId);
    const pendingMaterials = materialOrders.filter(order => order.status === "Open");
    
    // Check for outsourced operations (these still block scheduling)
    const outsourcedOps = await this.getOutsourcedOperationsForJob(jobId);
    const pendingOutsourced = outsourcedOps.filter(op => op.status !== "Completed");
    
    if (pendingOutsourced.length > 0) {
      return {
        ready: false,
        reason: `Awaiting ${pendingOutsourced.length} outsourced operation(s)`,
      };
    }

    return { 
      ready: true,
      pendingMaterials: pendingMaterials.length > 0 ? pendingMaterials : undefined,
      needsReview: pendingMaterials.length > 0
    };
  }

  // Outsourced Operations Management
  async getOutsourcedOperations(): Promise<OutsourcedOperation[]> {
    return await db.select().from(outsourcedOperations).orderBy(desc(outsourcedOperations.dueDate));
  }

  async getOutsourcedOperationsForJob(jobId: string): Promise<OutsourcedOperation[]> {
    return await db.select().from(outsourcedOperations).where(eq(outsourcedOperations.jobId, jobId));
  }

  async createOutsourcedOperation(opData: InsertOutsourcedOperation): Promise<OutsourcedOperation> {
    const [operation] = await db.insert(outsourcedOperations).values(opData).returning();
    return operation;
  }

  async updateOutsourcedOperation(opId: string, updates: Partial<OutsourcedOperation>): Promise<OutsourcedOperation | null> {
    const [operation] = await db.update(outsourcedOperations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(outsourcedOperations.id, opId))
      .returning();
    return operation || null;
  }

  async markOutsourcedOperationComplete(opId: string): Promise<OutsourcedOperation | null> {
    return await this.updateOutsourcedOperation(opId, { 
      status: "Completed", 
      completedDate: new Date() 
    });
  }

  // Enhanced scheduling with day 0 start and material flagging
  async autoScheduleJobWithMaterialCheck(jobId: string): Promise<{ success: boolean; scheduleEntries?: ScheduleEntry[]; reason?: string; pendingItems?: any[]; needsReview?: boolean }> {
    const readinessCheck = await this.isJobReadyForScheduling(jobId);
    
    // Only block for outsourced operations, not materials
    if (!readinessCheck.ready) {
      return {
        success: false,
        reason: readinessCheck.reason
      };
    }

    // Schedule at day 0 regardless of material status
    const scheduleEntries = await this.autoScheduleJobWithOptimalStart(jobId);
    
    if (scheduleEntries) {
      // Create alert if materials need review
      if (readinessCheck.needsReview && readinessCheck.pendingMaterials) {
        await this.createAlert({
          type: "warning",
          title: "Material Review Required",
          message: `Job ${jobId} scheduled but has ${readinessCheck.pendingMaterials.length} pending material order(s) - review needed before optimal start date`,
          jobId
        });
      }
      
      return { 
        success: true, 
        scheduleEntries,
        needsReview: readinessCheck.needsReview,
        pendingItems: readinessCheck.pendingMaterials
      };
    } else {
      return { success: false, reason: "Unable to schedule job within manufacturing window" };
    }
  }

  // Calculate job priority based on 28-day lead time from creation date
  private calculateJobPriority(job: any): { priority: number, classification: string } {
    const now = new Date();
    const createdDate = job.createdDate ? new Date(job.createdDate) : null;
    const promisedDate = new Date(job.promisedDate);
    
    if (!createdDate) {
      // Fallback to promised date logic if no creation date
      const daysUntilPromised = Math.ceil((promisedDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      const priority = daysUntilPromised < 0 ? 1000 : Math.max(100, 500 - daysUntilPromised * 10);
      const classification = daysUntilPromised < 0 ? 'Critical' : daysUntilPromised <= 7 ? 'High' : 'Normal';
      console.log(`📊 Job ${job.jobNumber} priority: ${priority} (${classification}) - NO CREATION DATE, using promised: ${daysUntilPromised} days`);
      return { priority, classification };
    }
    
    // Calculate 28-day lead time target from creation date
    const leadTimeTarget = new Date(createdDate.getTime() + (28 * 24 * 60 * 60 * 1000));
    
    // Calculate "late time in days" - how many days past the 28-day lead time we are
    const lateTimeDays = Math.ceil((now.getTime() - leadTimeTarget.getTime()) / (24 * 60 * 60 * 1000));
    
    // Also consider promised date urgency
    const daysUntilPromised = Math.ceil((promisedDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    
    let priority: number;
    let classification: string;
    
    // Priority based on "late time" - higher late time = higher priority
    if (lateTimeDays > 0) {
      // Job is already late beyond 28-day lead time
      priority = 1000 + lateTimeDays * 10; // Higher number = higher priority
      classification = 'Critical';
    } else if (lateTimeDays >= -3) {
      // Within 3 days of 28-day lead time
      priority = 800 + (3 + lateTimeDays) * 50;
      classification = 'High';  
    } else if (daysUntilPromised <= 7) {
      // Not late on lead time but promised date is soon
      priority = 600 + (7 - daysUntilPromised) * 20;
      classification = 'High';
    } else if (lateTimeDays >= -7) {
      // Within a week of 28-day lead time
      priority = 400 + (7 + lateTimeDays) * 20;
      classification = 'Normal';
    } else {
      // Plenty of time before lead time
      priority = Math.max(100, 300 + lateTimeDays * 5);
      classification = 'Low';
    }
    
    console.log(`📊 Job ${job.jobNumber} priority: ${priority} (${classification}) - Late time: ${lateTimeDays} days, Days until promised: ${daysUntilPromised}, Lead time target: ${leadTimeTarget.toDateString()}`);
    
    return { priority, classification };
  }

  // Update priorities for all unscheduled jobs
  async updateAllJobPriorities(): Promise<void> {
    const jobs = await this.getJobs();
    const unscheduledJobs = jobs.filter(job => job.status === 'Unscheduled' || job.status === 'Open');
    
    console.log(`📊 Updating priorities for ${unscheduledJobs.length} unscheduled jobs...`);
    
    for (const job of unscheduledJobs) {
      const { classification } = this.calculateJobPriority(job);
      if (job.priority !== classification) {
        await this.updateJob(job.id, { priority: classification });
      }
    }
  }

  // Schedule multiple jobs in priority order
  async scheduleJobsByPriority(maxJobs: number = 100): Promise<{ scheduled: number, failed: number, results: any[] }> {
    await this.updateAllJobPriorities();
    
    const jobs = await this.getJobs();
    const unscheduledJobs = jobs.filter(job => 
      job.status === 'Unscheduled' || job.status === 'Open' || job.status === 'Planning'
    );
    
    console.log(`📋 Total jobs: ${jobs.length}, Unscheduled/Planning/Open: ${unscheduledJobs.length}`);
    if (unscheduledJobs.length === 0) {
      console.log(`📋 Job statuses found: ${[...new Set(jobs.map(j => j.status))].join(', ')}`);
      return { scheduled: 0, failed: 0, results: [] };
    }
    
    // Sort jobs by priority (Critical > High > Normal > Low), then by promised date
    const priorityOrder = { 'Critical': 4, 'High': 3, 'Normal': 2, 'Low': 1 };
    const sortedJobs = unscheduledJobs
      .map(job => ({
        ...job,
        priorityScore: this.calculateJobPriority(job).priority
      }))
      .sort((a, b) => {
        // First by priority classification
        const priorityDiff = (priorityOrder[b.priority as keyof typeof priorityOrder] || 0) - (priorityOrder[a.priority as keyof typeof priorityOrder] || 0);
        if (priorityDiff !== 0) return priorityDiff;
        
        // Then by priority score (higher score = more urgent)
        const scoreDiff = b.priorityScore - a.priorityScore;
        if (scoreDiff !== 0) return scoreDiff;
        
        // Finally by promised date (earlier first)
        return new Date(a.promisedDate).getTime() - new Date(b.promisedDate).getTime();
      })
      .slice(0, maxJobs);
    
    console.log(`🎯 Scheduling ${sortedJobs.length} jobs in priority order...`);
    
    let scheduled = 0;
    let failed = 0;
    const results = [];
    
    for (const job of sortedJobs) {
      try {
        console.log(`📋 Scheduling job ${job.jobNumber} (${job.priority} priority)`);
        const scheduleEntries = await this.autoScheduleJobWithOptimalStart(job.id);
        
        // Check if ALL operations were scheduled (not just some)
        const jobData = await this.getJob(job.id);
        const expectedOperations = jobData?.routing?.length || 0;
        
        if (scheduleEntries && scheduleEntries.length > 0 && scheduleEntries.length === expectedOperations) {
          scheduled++;
          results.push({ jobNumber: job.jobNumber, status: 'scheduled', priority: job.priority, operations: scheduleEntries.length });
        } else {
          failed++;
          const reason = scheduleEntries && scheduleEntries.length > 0 
            ? `Only ${scheduleEntries.length}/${expectedOperations} operations scheduled`
            : 'No available machines or capacity';
          results.push({ jobNumber: job.jobNumber, status: 'failed', priority: job.priority, reason });
        }
      } catch (error) {
        failed++;
        results.push({ 
          jobNumber: job.jobNumber, 
          status: 'error', 
          priority: job.priority, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }
    
    console.log(`✅ Priority scheduling complete: ${scheduled} scheduled, ${failed} failed`);
    return { scheduled, failed, results };
  }

  // New scheduling method with priority-based logic and no past scheduling
  async autoScheduleJobWithOptimalStart(
    jobId: string, 
    onProgress?: (progress: {
      percentage: number;
      status: string;
      stage: string;
      operationName?: string;
      currentOperation?: number;
      totalOperations?: number;
    }) => void
  ): Promise<ScheduleEntry[] | null> {
    const job = await this.getJob(jobId);
    if (!job) return null;

    const scheduleEntries: ScheduleEntry[] = [];
    const totalOperations = job.routing.length;
    
    // Calculate job priority and update job priority field
    const { priority, classification } = this.calculateJobPriority(job);
    await this.updateJob(jobId, { priority: classification });
    
    // Initial progress
    onProgress?.({
      percentage: 5,
      status: 'Calculating job priority and preparing schedule dates...',
      stage: 'preparing',
      totalOperations
    });
    
    // Never schedule in the past - start at earliest tomorrow
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    currentDate.setDate(currentDate.getDate() + 1); // Start tomorrow at earliest
    
    // For high priority jobs, start immediately (tomorrow)
    // For normal/low priority jobs, allow material buffer time
    if (classification === 'Critical' || classification === 'High') {
      console.log(`🚨 High priority job ${job.jobNumber} - scheduling to start tomorrow`);
      // Keep current date as tomorrow
    } else {
      // Calculate optimal start (day 7 for material buffer) but don't go past promised date
      const optimalStartDate = new Date(currentDate);
      optimalStartDate.setDate(optimalStartDate.getDate() + 6); // 7 total days from now
      
      const promisedDate = new Date(job.promisedDate);
      const totalHours = parseFloat(job.estimatedHours) || 0;
      const workDaysNeeded = Math.ceil(totalHours / 8);
      const latestStartDate = new Date(promisedDate);
      latestStartDate.setDate(latestStartDate.getDate() - workDaysNeeded - 2); // Leave 2-day buffer
      
      // Use the earlier of optimal start or latest feasible start
      currentDate = optimalStartDate < latestStartDate ? optimalStartDate : latestStartDate;
      
      // But never go before tomorrow
      const tomorrow = new Date();
      tomorrow.setHours(0, 0, 0, 0);
      tomorrow.setDate(tomorrow.getDate() + 1);
      if (currentDate < tomorrow) {
        currentDate = new Date(tomorrow);
      }
      
      console.log(`📅 Job ${job.jobNumber} scheduled to start ${currentDate.toDateString()}`);
    }
    
    // Adjust to next working day if needed (Monday-Thursday only)
    while (currentDate.getDay() < 1 || currentDate.getDay() > 4) {
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    onProgress?.({
      percentage: 10,
      status: 'Starting operation scheduling...',
      stage: 'scheduling',
      totalOperations
    });
    
    const dayInMs = 24 * 60 * 60 * 1000;
    const maxDaysOut = 30; // Manufacturing window

    for (let opIndex = 0; opIndex < job.routing.length; opIndex++) {
      const operation = job.routing[opIndex];
      
      // Progress update for each operation
      const baseProgress = 10 + ((opIndex / totalOperations) * 80);
      onProgress?.({
        percentage: baseProgress,
        status: `Scheduling operation ${opIndex + 1} of ${totalOperations}...`,
        stage: 'scheduling',
        operationName: operation.name,
        currentOperation: opIndex + 1,
        totalOperations
      });
      let scheduled = false;
      let attemptDays = 0;
      
      while (!scheduled && attemptDays < maxDaysOut) {
        // Progress update for machine finding attempts
        const attemptProgress = baseProgress + ((attemptDays / maxDaysOut) * (80 / totalOperations));
        onProgress?.({
          percentage: attemptProgress,
          status: `Finding machine for ${operation.name} (attempt ${attemptDays + 1})...`,
          stage: 'finding_machine',
          operationName: operation.name,
          currentOperation: opIndex + 1,
          totalOperations
        });
        
        console.log(`🎯 Trying to find machine for operation ${operation.name} on attempt ${attemptDays}`);
        
        // ANTI-LOOP: Stop infinite loops after reasonable attempts
        if (attemptDays >= 20) {
          console.log(`❌ SCHEDULING FAILED: Operation ${operation.machineType} failed after 20 attempts`);
          throw new Error(`${operation.machineType} SCHEDULING FAILED - EXCEEDED MAX ATTEMPTS`);
        }
        
        // REALISTIC CAPACITY ENFORCEMENT: Check if any shifts have capacity before attempting
        const availableShifts = await this.getShiftsOrderedByLoad(currentDate, operation as any);
        if (availableShifts.length === 0) {
          console.log(`⏭️ MOVING TO NEXT WEEK: No capacity available on ${currentDate.toDateString()}`);
          // Move to next Monday to find capacity in following week
          const nextMonday = new Date(currentDate);
          nextMonday.setDate(currentDate.getDate() + (8 - currentDate.getDay())); // Move to next Monday
          currentDate = nextMonday;
          attemptDays = Math.floor((currentDate.getTime() - (new Date().getTime() + dayInMs)) / dayInMs);
          continue; // Skip this day entirely
        }
        
        let machineResults = [];
        for (const shift of availableShifts) {
          const machineResult = await this.findBestMachineForOperation(operation, currentDate, shift);
          if (machineResult) {
            // Validate weekly capacity before accepting this machine
            const weeklyCheck = await this.validateWeeklyCapacity(currentDate, shift, machineResult.adjustedHours);
            if (weeklyCheck.valid) {
              machineResults.push({ ...machineResult, shift });
              break; // Use first available shift with capacity
            } else {
              console.log(`   ❌ Weekly capacity exceeded for shift ${shift}, trying next shift`);
            }
          }
        }
        
        console.log(`🎯 Machine result (with capacity check):`, machineResults);
        
        if (machineResults.length === 0) {
          console.log(`❌ No machine found for operation ${operation.name} on ${currentDate.toDateString()}`);
          console.log(`   - Operation requires: ${operation.compatibleMachines.join(', ')}`);
          console.log(`   - Machine type: ${operation.machineType}`);
          
          // Move to next day, but skip weekends and Fridays
          do {
            currentDate = new Date(currentDate.getTime() + dayInMs);
            attemptDays++;
          } while ((currentDate.getDay() < 1 || currentDate.getDay() > 4) && attemptDays < maxDaysOut);
          continue;
        }
        
        for (const result of machineResults) {
          console.log(`🔧 Processing machine result:`, result);
          if (!result || !result.machine) {
            console.log(`❌ Invalid machine result, skipping`);
            continue;
          }
          
          // Check if operation needs to be split across multiple shifts
          const maxShiftHours = 8;
          const totalHours = result.adjustedHours;
          
          if (totalHours > maxShiftHours) {
            console.log(`🔀 Operation ${operation.name} requires ${totalHours.toFixed(1)}h - splitting across multiple shifts`);
            
            // Split operation into multiple segments
            const segments = [];
            let remainingHours = totalHours;
            let segmentNumber = 1;
            
            while (remainingHours > 0) {
              const segmentHours = Math.min(remainingHours, maxShiftHours);
              segments.push({
                hours: segmentHours,
                isPartial: totalHours > maxShiftHours,
                segmentNumber,
                totalSegments: Math.ceil(totalHours / maxShiftHours)
              });
              remainingHours -= segmentHours;
              segmentNumber++;
            }
            
            console.log(`🔀 Split into ${segments.length} segments: ${segments.map(s => s.hours.toFixed(1) + 'h').join(', ')}`);
            
            // Schedule each segment sequentially
            let segmentDate = new Date(currentDate);
            let segmentScheduled = false;
            
            for (const segment of segments) {
              // Find available machine and shift for this segment
              let segmentResult = null;
              let attempts = 0;
              const maxAttempts = 20; // Prevent infinite loops
              
              while (!segmentResult && attempts < maxAttempts) {
                // CRITICAL: Skip weekends (Friday-Sunday) with loop protection
                let weekendSkipCount = 0;
                while ((segmentDate.getDay() < 1 || segmentDate.getDay() > 4) && weekendSkipCount < 10) {
                  segmentDate = new Date(segmentDate.getTime() + dayInMs);
                  weekendSkipCount++;
                }
                
                if (weekendSkipCount >= 10) {
                  console.log(`❌ CRITICAL: Weekend skip loop exceeded maximum attempts`);
                  break; // Exit segment loop to prevent infinite iterations
                }
                
                console.log(`🔍 Multi-day segment ${segment.segmentNumber}: Checking ${segmentDate.toDateString()} (attempt ${attempts + 1})`);
                
                const availableShifts = await this.getShiftsOrderedByLoad(segmentDate, operation as any);
                if (availableShifts.length === 0) {
                  console.log(`❌ No available shifts on ${segmentDate.toDateString()}, moving to next day`);
                  segmentDate = new Date(segmentDate.getTime() + dayInMs);
                  attempts++;
                  continue;
                }
                
                for (const shift of availableShifts) {
                  const tempResult = await this.findBestMachineForOperation(operation as any, segmentDate, shift);
                  if (tempResult) {
                    // OPTIMIZATION: Use consolidated capacity function
                    const capacity = await this.getMachineCapacityInfo(tempResult.machine.id, segmentDate, shift);
                    if (capacity.currentHours + segment.hours <= capacity.maxHours) {
                      segmentResult = { ...tempResult, adjustedHours: segment.hours, shift };
                      console.log(`✅ Found segment result: ${tempResult.machine.machineId} on ${segmentDate.toDateString()} shift ${shift}`);
                      break;
                    }
                  }
                }
                
                if (!segmentResult) {
                  console.log(`❌ No suitable machine for segment ${segment.segmentNumber} on ${segmentDate.toDateString()}, trying next day`);
                  segmentDate = new Date(segmentDate.getTime() + dayInMs);
                  attempts++;
                }
              }
              
              if (!segmentResult) {
                console.log(`❌ Could not schedule segment ${segment.segmentNumber} after ${maxAttempts} attempts`);
                break;
              }
              
              // CRITICAL: Schedule this segment with proper Central timezone handling
              const shift = segmentResult.shift;
              const shiftStart = shift === 1 ? 3 : 15; // 3 AM or 3 PM Central
              const startTime = new Date(segmentDate);
              startTime.setHours(shiftStart, 0, 0, 0);
              
              // Verify we're not scheduling in the past
              const nowCentral = new Date();
              nowCentral.setHours(nowCentral.getHours() - 6); // Convert to Central
              if (startTime < nowCentral) {
                console.log(`⚠️ WARNING: Multi-day segment attempted to schedule in past, moving to next available day`);
                segmentDate = new Date(segmentDate.getTime() + dayInMs);
                continue;
              }
              
              const endTime = new Date(startTime.getTime() + (segment.hours * 60 * 60 * 1000));
              console.log(`📅 MULTI-DAY segment scheduling: ${startTime.toLocaleString('en-US', {timeZone: 'America/Chicago'})} to ${endTime.toLocaleString('en-US', {timeZone: 'America/Chicago'})}`);
              
              const segmentEntry = await this.createScheduleEntry({
                jobId: job.id,
                machineId: segmentResult.machine.id,
                operationSequence: operation.sequence,
                startTime,
                endTime,
                shift,
                status: "Scheduled",
                assignedResourceId: segmentResult.assignedResource?.id || null
              });
              
              scheduleEntries.push(segmentEntry);
              console.log(`✅ Scheduled segment ${segment.segmentNumber}/${segment.totalSegments}: ${segment.hours.toFixed(1)}h on ${segmentDate.toDateString()} shift ${shift}`);
              
              // Move to next available time slot (could be same day next shift or next day)
              if (shift === 1 && availableShifts.includes(2)) {
                // Try shift 2 same day
                segmentDate = new Date(segmentDate);
              } else {
                // Move to next business day
                segmentDate = new Date(segmentDate.getTime() + dayInMs);
              }
              
              segmentScheduled = true;
            }
            
            if (segmentScheduled) {
              scheduled = true;
              // Set currentDate to end of last segment for next operation
              currentDate = new Date(segmentDate.getTime() + dayInMs);
            }
            
          } else {
            // Single shift operation - original logic
            const shift = result.shift || 1;
            console.log(`🔧 Using validated shift ${shift} for machine ${result.machine.machineId}`);
            
            // CRITICAL: Ensure proper Central timezone scheduling
            const shiftStart = shift === 1 ? 3 : 15; // 3 AM or 3 PM Central
            const startTime = new Date(currentDate);
            startTime.setHours(shiftStart, 0, 0, 0);
            
            // Verify we're not scheduling in the past
            const nowCentral = new Date();
            nowCentral.setHours(nowCentral.getHours() - 6); // Convert to Central
            if (startTime < nowCentral) {
              console.log(`⚠️ WARNING: Attempted to schedule in past (${startTime.toLocaleString('en-US', {timeZone: 'America/Chicago'})}), skipping to next day`);
              currentDate = new Date(currentDate.getTime() + dayInMs);
              continue;
            }
            
            const endTime = new Date(startTime.getTime() + (result.adjustedHours * 60 * 60 * 1000));
            console.log(`📅 PRODUCTION scheduling: ${startTime.toLocaleString('en-US', {timeZone: 'America/Chicago'})} to ${endTime.toLocaleString('en-US', {timeZone: 'America/Chicago'})}`);
            
            // Check for conflicts with existing schedule
            const conflicts = await this.checkScheduleConflicts(result.machine.id, startTime, endTime);
            
            if (!conflicts) {
              const scheduleEntry = await this.createScheduleEntry({
                jobId: job.id,
                machineId: result.machine.id,
                operationSequence: operation.sequence,
                startTime,
                endTime,
                shift,
                status: "Scheduled",
                assignedResourceId: result.assignedResource?.id || null
              });
              
              scheduleEntries.push(scheduleEntry);
              
              // Update machine utilization
              const currentUtil = parseFloat(result.machine.utilization);
              const newUtil = Math.min(100, currentUtil + (result.adjustedHours / 8) * 100);
              await this.updateMachine(result.machine.id, { utilization: newUtil.toString() });
              
              // Move to next day for next operation
              currentDate = new Date(endTime.getTime() + dayInMs);
              scheduled = true;
              
              // Progress update for successful scheduling
              const completedProgress = 10 + (((opIndex + 1) / totalOperations) * 80);
              onProgress?.({
                percentage: completedProgress,
                status: `Operation ${opIndex + 1} scheduled successfully on ${result.machine.machineId}`,
                stage: 'scheduled',
                operationName: operation.name,
                currentOperation: opIndex + 1,
                totalOperations
              });
            }
          }
          
          if (scheduled) break;
        }
        
        if (!scheduled) {
          currentDate = new Date(currentDate.getTime() + dayInMs);
          attemptDays++;
        }
      }
      
      if (!scheduled) {
        // Failed to schedule this operation - rollback all schedule entries for this job
        console.log(`❌ DEBUG: Failed to schedule operation ${operation.sequence} (${operation.name || operation.machineType}) for job ${job.jobNumber}`);
        console.log(`❌ DEBUG: Operation details:`, {
          sequence: operation.sequence,
          name: operation.name,
          machineType: operation.machineType,
          compatibleMachines: operation.compatibleMachines,
          estimatedHours: operation.estimatedHours
        });
        
        // Delete any schedule entries we created for this job
        for (const entry of scheduleEntries) {
          await this.deleteScheduleEntry(entry.id);
        }
        
        await this.createAlert({
          type: "warning",
          title: "Scheduling Conflict",
          message: `Unable to schedule operation ${operation.sequence} for job ${job.jobNumber} within manufacturing window`,
          jobId: job.id
        });
        
        // Return empty array instead of null to indicate failure
        return [];
      }
    }
    
    // Only update job status if ALL operations were scheduled successfully
    if (scheduleEntries.length === job.routing?.length) {
      await this.updateJob(jobId, { status: "Scheduled" });
    } else {
      console.log(`⚠️ Job ${job.jobNumber} only partially scheduled: ${scheduleEntries.length}/${job.routing?.length || 0} operations`);
    }
    
    return scheduleEntries;
  }

  // Resources implementation
  async getResources(): Promise<Resource[]> {
    return await db.select().from(resources).where(eq(resources.isActive, true));
  }

  async getResource(id: string): Promise<Resource | undefined> {
    const [resource] = await db.select().from(resources).where(eq(resources.id, id));
    return resource || undefined;
  }

  async createResource(insertResource: InsertResource): Promise<Resource> {
    const [resource] = await db.insert(resources).values(insertResource).returning();
    return resource;
  }

  async updateResource(id: string, updates: Partial<Resource>): Promise<Resource | undefined> {
    const [resource] = await db
      .update(resources)
      .set(updates)
      .where(eq(resources.id, id))
      .returning();
    return resource || undefined;
  }

  async deleteResource(id: string): Promise<boolean> {
    try {
      const [deleted] = await db
        .update(resources)
        .set({ isActive: false })
        .where(eq(resources.id, id))
        .returning();
      return !!deleted;
    } catch (error) {
      console.error('Error deleting resource:', error);
      return false;
    }
  }

  async getResourcesByWorkCenter(machineId: string): Promise<Resource[]> {
    return await db
      .select()
      .from(resources)
      .where(
        and(
          eq(resources.isActive, true),
          sql`${resources.workCenters} @> ${JSON.stringify([machineId])}`
        )
      );
  }

  // Resource Unavailability implementation
  async getResourceUnavailabilities(): Promise<ResourceUnavailability[]> {
    return await db.select().from(resourceUnavailability).orderBy(desc(resourceUnavailability.startDate));
  }

  async getResourceUnavailability(id: string): Promise<ResourceUnavailability | undefined> {
    const [unavailability] = await db
      .select()
      .from(resourceUnavailability)
      .where(eq(resourceUnavailability.id, id));
    return unavailability || undefined;
  }

  async createResourceUnavailability(insertUnavailability: InsertResourceUnavailability): Promise<ResourceUnavailability> {
    const [unavailability] = await db
      .insert(resourceUnavailability)
      .values(insertUnavailability)
      .returning();
    return unavailability;
  }

  async updateResourceUnavailability(id: string, updates: Partial<ResourceUnavailability>): Promise<ResourceUnavailability | undefined> {
    const [unavailability] = await db
      .update(resourceUnavailability)
      .set(updates)
      .where(eq(resourceUnavailability.id, id))
      .returning();
    return unavailability || undefined;
  }

  async deleteResourceUnavailability(id: string): Promise<boolean> {
    try {
      await db.delete(resourceUnavailability).where(eq(resourceUnavailability.id, id));
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

  async getJobsRequiringRescheduling(
    resourceIds: string[], 
    startDate: Date, 
    endDate: Date, 
    shifts: number[]
  ): Promise<Job[]> {
    try {
      // Find schedule entries that overlap with the unavailability period
      // and are assigned to any of the unavailable resources
      const affectedScheduleEntries = await db
        .select()
        .from(scheduleEntries)
        .where(
          and(
            // Time overlap: schedule overlaps with unavailability period
            lte(scheduleEntries.startTime, endDate),
            gte(scheduleEntries.endTime, startDate)
            // Note: Resource assignment checking disabled due to schema mismatch
            // Will need to filter affected entries in application logic
          )
        );

      // Get unique job IDs from affected schedule entries
      const affectedJobIds = [...new Set(affectedScheduleEntries.map(entry => entry.jobId))];
      
      // Return jobs that need rescheduling
      if (affectedJobIds.length === 0) {
        return [];
      }

      return await db
        .select()
        .from(jobs)
        .where(
          and(
            sql`${jobs.id} = ANY(${affectedJobIds})`,
            sql`${jobs.status} != 'completed'`
          )
        );
    } catch (error) {
      console.error('Error finding jobs requiring rescheduling:', error);
      return [];
    }
  }

  // Routing Operations implementation
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

  async getEfficiencyImpactData(): Promise<{
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
  }> {
    // For now, return mock data since we're using in-memory storage
    // In a real implementation, this would query the routing operations table
    const mockData = {
      totalOperations: 15,
      substitutedOperations: 4,
      averageEfficiencyImpact: 12.5,
      worstImpacts: [
        {
          jobNumber: "J240801-001",
          operationName: "Rough Turn",
          originalMachine: "HCN-5000",
          assignedMachine: "MH-50", 
          efficiencyImpact: 42.8
        },
        {
          jobNumber: "J240801-003", 
          operationName: "Finish Mill",
          originalMachine: "VMC-850", 
          assignedMachine: "VMC-4020",
          efficiencyImpact: 18.5
        },
        {
          jobNumber: "J240801-007",
          operationName: "Drill & Tap",
          originalMachine: "DMG-80",
          assignedMachine: "HMC-001",
          efficiencyImpact: 8.3
        }
      ]
    };

    return mockData;
  }
}