import { type Job, type InsertJob, type Machine, type InsertMachine, type ScheduleEntry, type InsertScheduleEntry, type Alert, type InsertAlert, type DashboardStats, type RoutingOperation } from "@shared/schema";
import { randomUUID } from "crypto";

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

export class MemStorage implements IStorage {
  private jobs: Map<string, Job>;
  private machines: Map<string, Machine>;
  private scheduleEntries: Map<string, ScheduleEntry>;
  private alerts: Map<string, Alert>;

  constructor() {
    this.jobs = new Map();
    this.machines = new Map();
    this.scheduleEntries = new Map();
    this.alerts = new Map();
    this.initializeDefaultData();
  }

  private initializeDefaultData() {
    // Initialize machines with tiers and efficiency factors
    const defaultMachines: InsertMachine[] = [
      { machineId: "CNC-001", name: "Haas VF-2", type: "CNC Mill", tier: "Standard", capabilities: ["milling", "drilling", "tapping"], status: "Available", utilization: "92", availableShifts: [1, 2], efficiencyFactor: "1.0", substitutionGroup: "mill_group_a" },
      { machineId: "CNC-002", name: "Mazak VTC-800", type: "CNC Mill", tier: "Premium", capabilities: ["milling", "drilling", "tapping"], status: "Available", utilization: "78", availableShifts: [1, 2], efficiencyFactor: "1.15", substitutionGroup: "mill_group_a" },
      { machineId: "CNC-003", name: "DMG MORI", type: "CNC Mill", tier: "Premium", capabilities: ["milling", "drilling", "tapping"], status: "Available", utilization: "45", availableShifts: [1, 2], efficiencyFactor: "1.25", substitutionGroup: "mill_group_a" },
      { machineId: "CNC-004", name: "Haas ST-30", type: "CNC Lathe", tier: "Standard", capabilities: ["turning", "drilling"], status: "Maintenance", utilization: "0", availableShifts: [1, 2], efficiencyFactor: "1.0", substitutionGroup: "lathe_group_a" },
      { machineId: "CNC-005", name: "Mazak QT-250", type: "CNC Lathe", tier: "Premium", capabilities: ["turning", "drilling"], status: "Available", utilization: "65", availableShifts: [1, 2], efficiencyFactor: "1.2", substitutionGroup: "lathe_group_a" },
      { machineId: "CNC-006", name: "Haas VF-3", type: "CNC Mill", tier: "Budget", capabilities: ["milling", "drilling"], status: "Available", utilization: "25", availableShifts: [1, 2], efficiencyFactor: "0.85", substitutionGroup: "mill_group_b" },
      { machineId: "CNC-007", name: "Bridgeport Manual", type: "Manual Mill", tier: "Budget", capabilities: ["milling", "drilling"], status: "Available", utilization: "15", availableShifts: [1], efficiencyFactor: "0.6", substitutionGroup: "mill_group_b" },
      { machineId: "CNC-008", name: "Okuma LT-200", type: "CNC Lathe", tier: "Standard", capabilities: ["turning", "drilling"], status: "Available", utilization: "55", availableShifts: [1, 2], efficiencyFactor: "0.95", substitutionGroup: "lathe_group_a" },
      { machineId: "WELD-001", name: "TIG Station", type: "Welding", tier: "Standard", capabilities: ["tig_welding"], status: "Available", utilization: "67", availableShifts: [1], efficiencyFactor: "1.0", substitutionGroup: "welding_group" },
      { machineId: "BLAST-001", name: "Bead Blast", type: "Finishing", tier: "Standard", capabilities: ["bead_blast"], status: "Available", utilization: "34", availableShifts: [1], efficiencyFactor: "1.0", substitutionGroup: "finishing_group" },
      { machineId: "INSPECT-001", name: "CMM", type: "Inspection", tier: "Premium", capabilities: ["inspection"], status: "Available", utilization: "45", availableShifts: [1, 2], efficiencyFactor: "1.1", substitutionGroup: "inspection_group" },
    ];

    defaultMachines.forEach(machine => {
      this.createMachine(machine);
    });

    // Initialize sample jobs
    const defaultJobs: InsertJob[] = [
      {
        jobNumber: "JB-2024-1847",
        partNumber: "ALM-4567-REV-C",
        description: "Aluminum Housing",
        quantity: 25,
        dueDate: new Date("2025-01-12T00:00:00Z"),
        priority: "High",
        status: "Company Late",
        routing: [
          { sequence: 10, name: "Rough Machining", machineType: "CNC Mill", compatibleMachines: ["CNC-001", "CNC-002", "CNC-003"], estimatedHours: 6.0, notes: "Face and bore operations. Requires 0.5\" end mill and boring bar." },
          { sequence: 20, name: "Welding", machineType: "Welding", compatibleMachines: ["WELD-001"], estimatedHours: 2.0, notes: "TIG weld seam preparation and execution. ER4043 filler rod." },
          { sequence: 30, name: "Finish Machining", machineType: "CNC Mill", compatibleMachines: ["CNC-001", "CNC-002", "CNC-003"], estimatedHours: 4.0, notes: "Final dimensions and surface finish. +/- 0.001\" tolerance." },
          { sequence: 40, name: "Bead Blast", machineType: "Finishing", compatibleMachines: ["BLAST-001"], estimatedHours: 1.0, notes: "Glass bead finish per specification ABC-123." }
        ] as RoutingOperation[],
        estimatedHours: "13.0"
      },
      {
        jobNumber: "JB-2024-1848",
        partNumber: "STL-9876-A",
        description: "Steel Bracket",
        quantity: 50,
        dueDate: new Date("2025-01-15T00:00:00Z"),
        priority: "Normal",
        status: "Scheduled",
        routing: [
          { sequence: 10, name: "Rough Turning", machineType: "CNC Lathe", compatibleMachines: ["CNC-005"], estimatedHours: 4.0, notes: "Rough turn to near net shape." },
          { sequence: 20, name: "Finish Turning", machineType: "CNC Lathe", compatibleMachines: ["CNC-005"], estimatedHours: 4.0, notes: "Final dimensions and surface finish." }
        ] as RoutingOperation[],
        estimatedHours: "8.0"
      },
      {
        jobNumber: "JB-2024-1849",
        partNumber: "TIT-3344-REV-B",
        description: "Titanium Component",
        quantity: 10,
        dueDate: new Date("2024-12-18T00:00:00Z"),
        priority: "Critical",
        status: "Customer Late",
        routing: [
          { sequence: 10, name: "Precision Milling", machineType: "CNC Mill", compatibleMachines: ["CNC-002", "CNC-003"], estimatedHours: 8.0, notes: "Titanium requires special tooling and coolant." }
        ] as RoutingOperation[],
        estimatedHours: "8.0"
      }
    ];

    defaultJobs.forEach(job => {
      this.createJob(job);
    });

    // Initialize alerts
    const defaultAlerts: InsertAlert[] = [
      { type: "error", title: "Customer Late Job", message: "Job JB-1849 (TIT-3344-REV-B) is 3 days past customer due date", jobId: Array.from(this.jobs.values()).find(j => j.jobNumber === "JB-2024-1849")?.id },
      { type: "warning", title: "Machine Maintenance Due", message: "CNC-004 (Haas ST-30) requires scheduled maintenance", machineId: Array.from(this.machines.values()).find(m => m.machineId === "CNC-004")?.id },
      { type: "info", title: "Resource Optimization", message: "Machine substitution available: CNC-002 can handle JB-1847 routing" },
      { type: "success", title: "Schedule Updated", message: "Jobs JB-1850 through JB-1853 successfully scheduled for next week" }
    ];

    defaultAlerts.forEach(alert => {
      this.createAlert(alert);
    });
  }

  // Jobs
  async getJobs(): Promise<Job[]> {
    return Array.from(this.jobs.values()).sort((a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime());
  }

  async getJob(id: string): Promise<Job | undefined> {
    return this.jobs.get(id);
  }

  async createJob(insertJob: InsertJob): Promise<Job> {
    const id = randomUUID();
    const job: Job = {
      id,
      createdDate: new Date(),
      jobNumber: insertJob.jobNumber,
      partNumber: insertJob.partNumber,
      description: insertJob.description,
      quantity: insertJob.quantity,
      dueDate: insertJob.dueDate,
      priority: insertJob.priority || "Normal",
      status: insertJob.status || "Unscheduled",
      routing: insertJob.routing || [],
      estimatedHours: insertJob.estimatedHours || "0",
    };
    this.jobs.set(id, job);
    return job;
  }

  async updateJob(id: string, jobUpdate: Partial<Job>): Promise<Job | undefined> {
    const job = this.jobs.get(id);
    if (!job) return undefined;
    
    const updatedJob = { ...job, ...jobUpdate };
    this.jobs.set(id, updatedJob);
    return updatedJob;
  }

  async deleteJob(id: string): Promise<boolean> {
    return this.jobs.delete(id);
  }

  // Machines
  async getMachines(): Promise<Machine[]> {
    return Array.from(this.machines.values()).sort((a, b) => a.machineId.localeCompare(b.machineId));
  }

  async getMachine(id: string): Promise<Machine | undefined> {
    return this.machines.get(id);
  }

  async createMachine(insertMachine: InsertMachine): Promise<Machine> {
    const id = randomUUID();
    const machine: Machine = {
      id,
      machineId: insertMachine.machineId,
      name: insertMachine.name,
      type: insertMachine.type,
      tier: insertMachine.tier || "Standard",
      capabilities: insertMachine.capabilities ? [...insertMachine.capabilities] : [],
      status: insertMachine.status || "Available",
      utilization: insertMachine.utilization || "0",
      availableShifts: insertMachine.availableShifts ? [...insertMachine.availableShifts] : [1, 2],
      efficiencyFactor: insertMachine.efficiencyFactor || "1.0",
      substitutionGroup: insertMachine.substitutionGroup || null,
    };
    this.machines.set(id, machine);
    return machine;
  }

  async updateMachine(id: string, machineUpdate: Partial<Machine>): Promise<Machine | undefined> {
    const machine = this.machines.get(id);
    if (!machine) return undefined;
    
    const updatedMachine = { ...machine, ...machineUpdate };
    this.machines.set(id, updatedMachine);
    return updatedMachine;
  }

  // Schedule
  async getScheduleEntries(): Promise<ScheduleEntry[]> {
    return Array.from(this.scheduleEntries.values()).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }

  async getScheduleEntriesForJob(jobId: string): Promise<ScheduleEntry[]> {
    return Array.from(this.scheduleEntries.values()).filter(entry => entry.jobId === jobId);
  }

  async getScheduleEntriesForMachine(machineId: string): Promise<ScheduleEntry[]> {
    return Array.from(this.scheduleEntries.values()).filter(entry => entry.machineId === machineId);
  }

  async createScheduleEntry(insertEntry: InsertScheduleEntry): Promise<ScheduleEntry> {
    const id = randomUUID();
    const entry: ScheduleEntry = {
      id,
      jobId: insertEntry.jobId,
      machineId: insertEntry.machineId,
      operationSequence: insertEntry.operationSequence,
      startTime: insertEntry.startTime,
      endTime: insertEntry.endTime,
      shift: insertEntry.shift,
      status: insertEntry.status || "Scheduled",
    };
    this.scheduleEntries.set(id, entry);
    return entry;
  }

  async updateScheduleEntry(id: string, entryUpdate: Partial<ScheduleEntry>): Promise<ScheduleEntry | undefined> {
    const entry = this.scheduleEntries.get(id);
    if (!entry) return undefined;
    
    const updatedEntry = { ...entry, ...entryUpdate };
    this.scheduleEntries.set(id, updatedEntry);
    return updatedEntry;
  }

  async deleteScheduleEntry(id: string): Promise<boolean> {
    return this.scheduleEntries.delete(id);
  }

  // Alerts
  async getAlerts(): Promise<Alert[]> {
    return Array.from(this.alerts.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10); // Return only latest 10 alerts
  }

  async createAlert(insertAlert: InsertAlert): Promise<Alert> {
    const id = randomUUID();
    const alert: Alert = {
      id,
      createdAt: new Date(),
      type: insertAlert.type,
      title: insertAlert.title,
      message: insertAlert.message,
      jobId: insertAlert.jobId || null,
      machineId: insertAlert.machineId || null,
      isRead: insertAlert.isRead || false,
    };
    this.alerts.set(id, alert);
    return alert;
  }

  async markAlertAsRead(id: string): Promise<boolean> {
    const alert = this.alerts.get(id);
    if (!alert) return false;
    
    alert.isRead = true;
    this.alerts.set(id, alert);
    return true;
  }

  async deleteAlert(id: string): Promise<boolean> {
    return this.alerts.delete(id);
  }

  // Dashboard Stats
  async getDashboardStats(): Promise<DashboardStats> {
    const jobs = await this.getJobs();
    const machines = await this.getMachines();
    
    const activeJobs = jobs.filter(job => job.status !== "Complete").length;
    const lateJobs = jobs.filter(job => job.status === "Customer Late" || job.status === "Company Late").length;
    const customerLateJobs = jobs.filter(job => job.status === "Customer Late").length;
    const companyLateJobs = jobs.filter(job => job.status === "Company Late").length;
    
    const totalUtilization = machines.reduce((sum, machine) => sum + parseFloat(machine.utilization), 0);
    const avgUtilization = Math.round(totalUtilization / machines.length);
    
    // Shift capacities: 1st shift = 11 operators * 7.5 hours = 82.5 hours, 2nd shift = 5 operators * 6.5 hours = 32.5 hours
    // Weekly capacity = (82.5 + 32.5) * 4 days = 460 hours
    const totalCapacity = 460;
    const usedCapacity = Math.round(totalCapacity * (avgUtilization / 100));
    
    return {
      activeJobs,
      utilization: avgUtilization,
      lateJobs,
      atRiskJobs: lateJobs,
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
    const machines = await this.getMachines();
    return machines.filter(machine => machine.substitutionGroup === substitutionGroup);
  }

  async findBestMachineForOperation(
    operation: RoutingOperation, 
    targetDate: Date, 
    shift: number
  ): Promise<{ machine: Machine; adjustedHours: number; score: number } | null> {
    const machines = await this.getMachines();
    
    // Find machines that can handle this operation
    const compatibleMachines = machines.filter(machine => 
      machine.status === "Available" &&
      machine.availableShifts.includes(shift) &&
      (operation.compatibleMachines.includes(machine.machineId) || 
       (machine.substitutionGroup && this.canSubstitute(machine, operation)))
    );

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

  private canSubstitute(machine: Machine, operation: RoutingOperation): boolean {
    // Check if machine is in same substitution group as any compatible machine
    if (!machine.substitutionGroup) return false;
    
    const compatibleMachineIds = operation.compatibleMachines;
    const allMachines = Array.from(this.machines.values());
    
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

export const storage = new MemStorage();
