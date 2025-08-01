import { type Job, type InsertJob, type Machine, type InsertMachine, type ScheduleEntry, type InsertScheduleEntry, type Alert, type InsertAlert, type DashboardStats, type RoutingOperation, type MaterialOrder, type InsertMaterialOrder, type OutsourcedOperation, type InsertOutsourcedOperation } from "@shared/schema";
import { db } from "./db";
import { jobs, machines, scheduleEntries, alerts, materialOrders, outsourcedOperations } from "@shared/schema";
import { eq, and, gte, lte, desc, isNull } from "drizzle-orm";
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
          quantity: 50,
          dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
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
          quantity: 25,
          dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
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
          quantity: 10,
          dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
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
      
      // Delete related schedule entries first (cascade delete)
      await db.delete(scheduleEntries).where(eq(scheduleEntries.jobId, id));
      
      // Delete the job
      await db.delete(jobs).where(eq(jobs.id, id));
      return true;
    } catch (error) {
      console.error('Error deleting job:', error);
      return false;
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
    jobRouting: RoutingOperation[],
    jobPriority: "Critical" | "High" | "Normal" | "Low" = "Normal"
  ): Promise<{ operation: RoutingOperation; assignedMachine: Machine | null; alternatives: Machine[] }[]> {
    const assignments: { operation: RoutingOperation; assignedMachine: Machine | null; alternatives: Machine[] }[] = [];
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
    
    const activeJobs = allJobs.filter(job => job.status !== "Completed" && job.status !== "Cancelled").length;
    const lateJobs = allJobs.filter(job => job.status === "Customer Late" || job.status === "Company Late").length;
    const customerLateJobs = allJobs.filter(job => job.status === "Customer Late").length;
    const companyLateJobs = allJobs.filter(job => job.status === "Company Late").length;
    
    const totalUtilization = allMachines.reduce((sum, machine) => sum + parseFloat(machine.utilization), 0);
    const averageUtilization = allMachines.length > 0 ? Math.round(totalUtilization / allMachines.length) : 0;
    
    const totalCapacity = (11 * 7.5) + (5 * 6.5); // 1st shift: 11 operators × 7.5hrs, 2nd shift: 5 operators × 6.5hrs
    const usedCapacity = totalCapacity * (averageUtilization / 100);
    
    return {
      activeJobs,
      utilization: averageUtilization,
      lateJobs,
      atRiskJobs: Math.max(0, lateJobs - 1), // At risk jobs are those approaching late status
      customerLateJobs,
      companyLateJobs,
      totalCapacity,
      usedCapacity,
      shift1Resources: 11,
      shift2Resources: 5,
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
    const allMachines = await this.getMachines();
    
    // Find machines that can handle this operation
    const compatibleMachines = [];
    for (const machine of allMachines) {
      if (machine.status === "Available" &&
          machine.availableShifts.includes(shift) &&
          (operation.compatibleMachines.includes(machine.machineId) || 
           (machine.substitutionGroup && await this.canSubstitute(machine, operation)))) {
        compatibleMachines.push(machine);
      }
    }

    if (compatibleMachines.length === 0) return null;

    // Score each machine based on multiple factors
    const scoredMachines = compatibleMachines.map(machine => {
      const efficiencyFactor = parseFloat(machine.efficiencyFactor);
      const adjustedHours = operation.estimatedHours / efficiencyFactor;
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
        score
      };
    });

    // Return the highest scored machine
    return scoredMachines.sort((a, b) => b.score - a.score)[0];
  }

  private async canSubstitute(machine: Machine, operation: RoutingOperation): Promise<boolean> {
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

  async autoScheduleJob(jobId: string): Promise<ScheduleEntry[] | null> {
    const job = await this.getJob(jobId);
    if (!job || !job.routing || job.routing.length === 0) return null;

    const scheduleEntries: ScheduleEntry[] = [];
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
        // Skip weekends for most operations
        if (currentDate.getDay() === 0 || currentDate.getDay() === 6) {
          currentDate = new Date(currentDate.getTime() + dayInMs);
          continue;
        }
        
        // Try both shifts, preferring first shift
        for (const shift of [1, 2]) {
          const result = await this.findBestMachineForOperation(operation, currentDate, shift);
          
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
      
      // If couldn't schedule within window, create alert
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

  // New scheduling method with optimal start date logic
  async autoScheduleJobWithOptimalStart(jobId: string): Promise<ScheduleEntry[] | null> {
    const job = await this.getJob(jobId);
    if (!job) return null;

    const scheduleEntries: ScheduleEntry[] = [];
    
    // Start at day 0 (immediate scheduling)
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0); // Start of today
    
    // Calculate optimal start (day 7 for material buffer)
    const optimalStartDate = new Date(currentDate);
    optimalStartDate.setDate(optimalStartDate.getDate() + 7);
    
    // Use optimal start date as actual start date
    currentDate = new Date(optimalStartDate);
    
    const dayInMs = 24 * 60 * 60 * 1000;
    const maxDaysOut = 30; // Manufacturing window

    for (const operation of job.routing) {
      let scheduled = false;
      let attemptDays = 0;
      
      while (!scheduled && attemptDays < maxDaysOut) {
        const machineResults = await this.findOptimalMachineAssignment([operation], job.priority as "Critical" | "High" | "Normal" | "Low");
        
        if (machineResults.length === 0) {
          currentDate = new Date(currentDate.getTime() + dayInMs);
          attemptDays++;
          continue;
        }
        
        for (const result of machineResults) {
          for (const shift of result.machine.availableShifts) {
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
              break;
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
}