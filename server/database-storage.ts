import { type Job, type InsertJob, type Machine, type InsertMachine, type ScheduleEntry, type InsertScheduleEntry, type Alert, type InsertAlert, type DashboardStats, type RoutingOperation } from "@shared/schema";
import { db } from "./db";
import { jobs, machines, scheduleEntries, alerts } from "@shared/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import type { IStorage } from "./storage-interface";

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
          barFeeder: true
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
          barFeeder: true
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
          barFeeder: true
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
    const result = await db.delete(jobs).where(eq(jobs.id, id));
    return result.rowCount !== null && result.rowCount > 0;
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
    const result = await db.delete(scheduleEntries).where(eq(scheduleEntries.id, id));
    return result.rowCount !== null && result.rowCount > 0;
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
    const result = await db
      .update(alerts)
      .set({ isRead: true })
      .where(eq(alerts.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async deleteAlert(id: string): Promise<boolean> {
    const result = await db.delete(alerts).where(eq(alerts.id, id));
    return result.rowCount !== null && result.rowCount > 0;
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
    
    return allMachines.some(compatMachine => 
      compatibleMachineIds.includes(compatMachine.machineId) &&
      compatMachine.substitutionGroup === machine.substitutionGroup
    );
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
}