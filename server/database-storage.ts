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
    return scheduleEntry;
  }

  async updateScheduleEntry(id: string, updates: Partial<ScheduleEntry>): Promise<ScheduleEntry | undefined> {
    const [entry] = await db
      .update(scheduleEntries)
      .set(updates)
      .where(eq(scheduleEntries.id, id))
      .returning();
    return entry || undefined;
  }

  async deleteScheduleEntry(id: string): Promise<boolean> {
    try {
      await db.delete(scheduleEntries).where(eq(scheduleEntries.id, id));
      return true;
    } catch (error) {
      console.error('Error deleting schedule entry:', error);
      return false;
    }
  }

  async clearAllScheduleEntries(): Promise<void> {
    await db.delete(scheduleEntries);
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
        console.log(`     ❌ Machine ${machine.machineId} rejected - not compatible`);
        continue;
      }

      // Check if there are resources available for this machine on this shift
      // Resources must be active, work the shift, AND be qualified for this specific machine
      // SPECIAL CASE: OUTSOURCE machines don't need operator resources - they are external vendors
      let machineResources = [];
      if (machine.type === 'OUTSOURCE') {
        // Outsource machines always have "virtual" resources available
        machineResources = [{ id: 'outsource-virtual', name: 'External Vendor' }];
        console.log(`     ✅ OUTSOURCE machine ${machine.machineId} uses external vendor resources`);
      } else {
        machineResources = allResources.filter(resource => 
          resource.isActive &&
          resource.shiftSchedule?.includes(shift) &&
          resource.workCenters?.includes(machine.id)
        );
        
        if (machineResources.length === 0) {
          console.log(`     ❌ Machine ${machine.machineId} has NO qualified resources on shift ${shift}`);
          console.log(`     Resources needed: active=true, shifts=${shift}, workCenters includes ${machine.id}`);
          continue;
        }
      }

      if (machine.type !== 'OUTSOURCE') {
        console.log(`     ✅ Machine ${machine.machineId} has ${machineResources.length} qualified resources on shift ${shift}`);
      }
      compatibleMachines.push(machine);
    }

    if (compatibleMachines.length === 0) return null;

    // Score each machine based on multiple factors
    const scoredMachines = compatibleMachines.map(machine => {
      const efficiencyFactor = parseFloat(machine.efficiencyFactor);
      const adjustedHours = parseFloat(operation.estimatedHours) / efficiencyFactor;
      
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

    // Return the highest scored machine
    const bestMatch = scoredMachines.sort((a, b) => b.score - a.score)[0];
    
    // Log efficiency impact if this is a substitution
    if (bestMatch.efficiencyImpact !== 0) {
      console.log(`⚠️ Efficiency Impact: ${bestMatch.efficiencyImpact.toFixed(1)}% for ${(operation as any).operationName || (operation as any).name || operation.machineType} (${bestMatch.machine.machineId})`);
    }
    
    return bestMatch;
  }

  // Get shifts ordered by current load (least loaded first) for better load balancing
  private async getShiftsOrderedByLoad(targetDate: Date): Promise<number[]> {
    const allScheduleEntries = await this.getScheduleEntries();
    
    // Count hours scheduled per shift for the target date
    const shiftLoads = { 1: 0, 2: 0 };
    
    for (const entry of allScheduleEntries) {
      const entryDate = new Date(entry.startTime);
      if (entryDate.toDateString() === targetDate.toDateString()) {
        const duration = (new Date(entry.endTime).getTime() - new Date(entry.startTime).getTime()) / (1000 * 60 * 60);
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
    for (const entry of allScheduleEntries) {
      const entryDate = new Date(entry.startTime);
      if (entry.shift === 2 && entryDate >= weekStart && entryDate <= weekEnd) {
        const duration = (new Date(entry.endTime).getTime() - new Date(entry.startTime).getTime()) / (1000 * 60 * 60);
        shift2WeeklyHours += duration;
      }
    }
    
    console.log(`📊 Shift 2 weekly capacity: ${shift2WeeklyHours.toFixed(1)}h / 120h limit`);
    
    // REALISTIC CAPACITY ENFORCEMENT: Filter out shifts that are over capacity
    const availableShifts = [];
    // More realistic daily capacity limits based on actual machine/operator availability
    if (shiftLoads[1] < 120) availableShifts.push(1); // Shift 1 daily capacity ~120h (15 machines × 8h)
    if (shiftLoads[2] < 40 && shift2WeeklyHours < 120) availableShifts.push(2); // Shift 2 daily capacity ~40h (5 machines × 8h), 120h/week limit
    
    if (availableShifts.length === 0) {
      console.log(`❌ CAPACITY EXCEEDED: Both shifts at capacity for ${targetDate.toDateString()}`);
      console.log(`   Shift 1: ${shiftLoads[1].toFixed(1)}h/120h, Shift 2: ${shiftLoads[2].toFixed(1)}h/40h (weekly: ${shift2WeeklyHours.toFixed(1)}h/120h)`);
      return []; // Return empty array to force job to move to next week
    }
    
    // Return shifts ordered by load (least loaded first)
    return availableShifts.sort((a, b) => shiftLoads[a as keyof typeof shiftLoads] - shiftLoads[b as keyof typeof shiftLoads]);
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

  private async canSubstitute(machine: Machine, operation: RoutingOperationType): Promise<boolean> {
    // Check if machine is in same substitution group as any compatible machine
    if (!machine.substitutionGroup) return false;
    
    const compatibleMachineIds = operation.compatibleMachines;
    const allMachines = await this.getMachines();
    
    const basicSubstitutionValid = allMachines.some(compatMachine => 
      compatibleMachineIds.includes(compatMachine.machineId) &&
      compatMachine.substitutionGroup === machine.substitutionGroup
    );

    if (!basicSubstitutionValid) return false;

    // Additional validation for bar fed lathes
    if (machine.type === "LATHE") {
      // Find the original compatible machine
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
        
        return validation.isValid;
      }
    }
    
    return true;
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
    const job = await this.getJob(jobId);
    if (!job || !job.routing || job.routing.length === 0) {
      return { 
        success: false, 
        failureReason: "Job not found or has no routing operations",
        failureDetails: []
      };
    }

    const scheduleEntries: ScheduleEntry[] = [];
    const failureDetails: any[] = [];
    const now = new Date();
    const dayInMs = 24 * 60 * 60 * 1000;
    
    // Start scheduling 7 days from job creation (material prep period)
    let currentDate = new Date(job.createdDate.getTime() + (7 * dayInMs));
    const maxDate = new Date(job.createdDate.getTime() + (21 * dayInMs)); // 21-day manufacturing window
    
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
        
        // OPTIMIZATION: Handle outsource operations specially - don't schedule them on specific machines
        if (operation.machineType === 'OUTSOURCE' || operation.compatibleMachines.includes('OUTSOURCE-01')) {
          // Outsource operations are placeholders - create entry without actual machine scheduling
          const scheduleEntry = await this.createScheduleEntry({
            jobId: job.id,
            machineId: (await this.getMachines()).find(m => m.machineId === 'OUTSOURCE-01')?.id || 'outsource-placeholder', // Use actual outsource machine ID
            operationSequence: operation.sequence,
            startTime: currentDate,
            endTime: new Date(currentDate.getTime() + (parseFloat(operation.estimatedHours) * 60 * 60 * 1000)),
            shift: 1, // Default to shift 1 for outsource
            status: "Outsourced"
          });
          
          scheduleEntries.push(scheduleEntry);
          onProgress?.({
            percentage: ((i + 1) / sortedOperations.length) * 90,
            status: `Operation ${i + 1} marked as outsourced`,
            stage: 'scheduled',
            operationName: operation.name,
            currentOperation: i + 1,
            totalOperations: sortedOperations.length
          });
          
          // Move to next day
          currentDate = new Date(currentDate.getTime() + dayInMs);
          scheduled = true;
          continue;
        }

        // PRIORITY-BASED SCHEDULING: Check if capacity allows or if we can displace lower priority jobs
        const availableShifts = await this.getShiftsOrderedByLoad(currentDate);
        if (availableShifts.length === 0) {
          // Try priority-based displacement for critical/high priority jobs
          if (job.priority === 'Critical' || job.priority === 'High') {
            const displacementResult = await this.attemptPriorityDisplacement(job, operation, currentDate);
            if (displacementResult.success) {
              console.log(`🔄 PRIORITY DISPLACEMENT: ${job.priority} job ${job.jobNumber} displaced lower priority job`);
              // Schedule this operation in the freed slot
              const scheduleEntry = await this.createScheduleEntry({
                jobId: job.id,
                machineId: displacementResult.machineId!,
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
                operationName: operation.operationName || operation.name,
                currentOperation: i + 1,
                totalOperations: sortedOperations.length
              });
              
              // Move to next day
              currentDate = new Date(currentDate.getTime() + dayInMs);
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
          const result = await this.findBestMachineForOperation(operation, currentDate, shift);
          
          if (!result) {
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
            const shiftStart = shift === 1 ? 3 : 15; // 3 AM or 3 PM
            const startTime = new Date(currentDate);
            startTime.setHours(shiftStart, 0, 0, 0);
            
            const endTime = new Date(startTime.getTime() + (result.adjustedHours * 60 * 60 * 1000));
            
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
                status: "Scheduled"
              });
              
              scheduleEntries.push(scheduleEntry);
              
              // Update machine utilization
              const currentUtil = parseFloat(result.machine.utilization);
              const newUtil = Math.min(100, currentUtil + (result.adjustedHours / 8) * 100); // Assume 8-hour shifts
              await this.updateMachine(result.machine.id, { utilization: newUtil.toString() });
              
              // Move to next day for next operation (no simultaneous operations)
              currentDate = new Date(endTime.getTime() + dayInMs);
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
          message: `Unable to schedule operation ${operation.sequence} (${operation.operationName || operation.name}) for job ${job.jobNumber}: ${failureDetail.reasons.join('; ')}`,
          jobId: job.id
        });
        
        return { 
          success: false, 
          failureReason: `Failed to schedule operation ${operation.sequence} (${operation.operationName || operation.name})`,
          failureDetails 
        };
      }
    }
    
    // Update job status to scheduled
    await this.updateJob(jobId, { status: "Scheduled" });
    
    return { success: true, scheduleEntries };
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

    const scheduleEntries: ScheduleEntry[] = [];
    let currentDate = new Date(startDateTime);
    const dayInMs = 24 * 60 * 60 * 1000;
    
    // Sort operations by sequence
    const sortedOperations = [...job.routing].sort((a, b) => a.sequence - b.sequence);
    
    for (let i = 0; i < sortedOperations.length; i++) {
      const operation = sortedOperations[i];
      let scheduled = false;
      let attempts = 0;
      const maxAttempts = 10; // Try up to 10 working days
      
      while (!scheduled && attempts < maxAttempts) {
        // Skip weekends (Fri-Sun) - only schedule Mon-Thu
        if (currentDate.getDay() === 0 || currentDate.getDay() === 5 || currentDate.getDay() === 6) {
          currentDate = new Date(currentDate.getTime() + dayInMs);
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
              startTime: currentDate,
              endTime: new Date(currentDate.getTime() + (parseFloat(operation.estimatedHours) * 60 * 60 * 1000)),
              shift: 1,
              status: "Outsourced"
            });
            scheduleEntries.push(scheduleEntry);
            scheduled = true;
            // Move to next day for next operation
            currentDate = new Date(currentDate.getTime() + dayInMs);
            break;
          }
        } else {
          // Try scheduling regular operations - prioritize shift 1, then shift 2
          for (const shift of [1, 2]) {
            const machineResult = await this.findBestMachineForOperation(operation, currentDate, shift);
            
            if (machineResult) {
              const operationDurationMs = machineResult.adjustedHours * 60 * 60 * 1000;
              const shiftStartHour = shift === 1 ? 6 : 18; // 6 AM or 6 PM
              
              const startTime = new Date(currentDate);
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
                
                scheduleEntries.push(scheduleEntry);
                scheduled = true;
                
                // Calculate next start date - if operation ends same day, next operation can start next day
                // If operation spans multiple days, next operation starts day after completion
                const daysToAdd = Math.ceil(machineResult.adjustedHours / 8) || 1; // Assume 8-hour shifts
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
          failureReason: `Failed to schedule operation ${operation.sequence} (${operation.name || operation.operationName}) - no available machines found`
        };
      }
    }
    
    // Update job status to scheduled
    await this.updateJob(jobId, { status: "Scheduled" });
    
    return { success: true, scheduleEntries };
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
          const shiftStartHour = shift === 1 ? 6 : 18; // 6 AM or 6 PM
          
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
          failureReason: `Failed to schedule operation ${operation.sequence} (${operation.name || operation.operationName})`
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
    const scheduleEntries = await this.autoScheduleJobWithOptimalStart(jobId, onProgress);
    
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

  // Calculate job priority based on promised date and hours to complete
  private calculateJobPriority(job: any): { priority: number, classification: string } {
    const now = new Date();
    const promisedDate = new Date(job.promisedDate);
    const totalHours = parseFloat(job.estimatedHours) || 0;
    
    // Calculate days until promised date
    const daysUntilPromised = Math.ceil((promisedDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    
    // Estimate total work days needed (assuming 8-hour days)
    const workDaysNeeded = Math.ceil(totalHours / 8);
    
    // Calculate urgency score (lower is more urgent)
    const daysBuffer = daysUntilPromised - workDaysNeeded;
    
    let priority: number;
    let classification: string;
    
    if (daysBuffer < 0) {
      // Already late or will be late
      priority = 1000 - daysBuffer; // Higher number = higher priority
      classification = 'Critical';
    } else if (daysBuffer <= 2) {
      // Very tight timeline
      priority = 800 + (2 - daysBuffer) * 50;
      classification = 'High';  
    } else if (daysBuffer <= 7) {
      // Some urgency
      priority = 500 + (7 - daysBuffer) * 20;
      classification = 'Normal';
    } else {
      // Plenty of time
      priority = Math.max(100, 400 - daysBuffer * 5);
      classification = 'Low';
    }
    
    console.log(`📊 Job ${job.jobNumber} priority: ${priority} (${classification}) - Days until promised: ${daysUntilPromised}, Work days needed: ${workDaysNeeded}, Buffer: ${daysBuffer}`);
    
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
  async scheduleJobsByPriority(maxJobs: number = 50): Promise<{ scheduled: number, failed: number, results: any[] }> {
    await this.updateAllJobPriorities();
    
    const jobs = await this.getJobs();
    const unscheduledJobs = jobs.filter(job => job.status === 'Unscheduled' || job.status === 'Open');
    
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
        
        if (scheduleEntries && scheduleEntries.length > 0) {
          scheduled++;
          results.push({ jobNumber: job.jobNumber, status: 'scheduled', priority: job.priority });
        } else {
          failed++;
          results.push({ jobNumber: job.jobNumber, status: 'failed', priority: job.priority, reason: 'No available machines' });
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
        
        // REALISTIC CAPACITY ENFORCEMENT: Check if any shifts have capacity before attempting
        const availableShifts = await this.getShiftsOrderedByLoad(currentDate);
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
            machineResults.push({ ...machineResult, shift });
            break; // Use first available shift with capacity
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
          // Use the shift that was already validated for capacity
          const shift = result.shift || 1;
          console.log(`🔧 Using validated shift ${shift} for machine ${result.machine.machineId}`);
          const shiftStart = shift === 1 ? 3 : 15; // 3 AM or 3 PM
          const startTime = new Date(currentDate);
          startTime.setHours(shiftStart, 0, 0, 0);
          
          const endTime = new Date(startTime.getTime() + (result.adjustedHours * 60 * 60 * 1000));
          
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
              status: "Scheduled"
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
            
            break;
          }
          if (scheduled) break;
        }
        
        if (!scheduled) {
          currentDate = new Date(currentDate.getTime() + dayInMs);
          attemptDays++;
        }
      }
      
      if (!scheduled) {
        await this.createAlert({
          type: "warning",
          title: "Scheduling Conflict",
          message: `Unable to schedule operation ${operation.sequence} for job ${job.jobNumber} within manufacturing window`,
          jobId: job.id
        });
        return null;
      }
    }
    
    // Update job status to scheduled
    await this.updateJob(jobId, { status: "Scheduled" });
    
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