import { DateTime } from "luxon";
import type { Job, RoutingOperation, ScheduleEntry, Machine, Resource } from "@shared/schema";
import { db } from "./db";
import { jobs, machines, resources, scheduleEntries, routingOperations } from "@shared/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { OperatorAvailabilityManager } from "./operator-availability";
import { roundToShiftStart, advancePastShiftEnd, getShiftNumber } from "./shift-utils";

interface SchedulingContext {
  operatorManager: OperatorAvailabilityManager;
  machineLocks: Map<string, DateTime>;
  scheduledEntries: ScheduleEntry[];
}

/**
 * Main auto-scheduler function that schedules a single job
 * Returns the created schedule entries or throws an error
 */
export async function scheduleJob(
  job: Job,
  routingOps: any[],
  context: SchedulingContext
): Promise<ScheduleEntry[]> {
  console.log(`🎯 Starting to schedule job ${job.jobNumber} with ${routingOps.length} operations`);
  
  // Start scheduling 7 days from job creation to allow for planning
  let earliest = DateTime.fromJSDate(job.createdDate).plus({ days: 7 });
  const scheduledEntries: ScheduleEntry[] = [];

  for (const op of routingOps.sort((a, b) => a.sequence - b.sequence)) {
    try {
      console.log(`📋 Scheduling operation ${op.sequence}: ${op.name} (${op.machineType})`);
      
      // Extract the base machine type (remove specific machine numbers like SAW-001 -> SAW)
      const rawMachineType = op.machineType.split('-')[0];
      
      // Map equivalent machine types (common in manufacturing)
      const machineTypeMapping: Record<string, string> = {
        'VMC': 'MILL',      // VMC (Vertical Machining Center) -> MILL
        'CNC': 'MILL',      // CNC Machining Center -> MILL  
        'MC': 'MILL'        // Machining Center -> MILL
      };
      
      const baseMachineType = machineTypeMapping[rawMachineType] || rawMachineType;
      console.log(`🔧 Extracted base machine type: ${baseMachineType} from ${op.machineType}${baseMachineType !== rawMachineType ? ` (mapped from ${rawMachineType})` : ''}`);
      
      // Find suitable machine for this operation
      const machine = await selectMachine({ ...op, machineType: baseMachineType }, context);
      if (!machine) {
        throw new Error(`No suitable machine found for operation ${op.name} (${baseMachineType})`);
      }
      console.log(`🏭 Selected machine: ${machine.name} (${machine.type})`);
      
      // Find suitable operator for this machine
      const operator = await selectOperator(machine, op, context);
      if (!operator) {
        throw new Error(`No suitable operator found for machine ${machine.name} on operation ${op.name}`);
      }
      console.log(`👷 Selected operator: ${operator.name} (${operator.role})`);
      
      // Find next available window that works for both machine and operator
      const durationHours = parseFloat(op.estimatedHours);
      console.log(`⏰ Looking for ${durationHours} hour window starting from ${earliest.toISO()}`);
      
      let window;
      try {
        console.log(`🔍 About to call getNextAvailableWindow for operator ${operator.id}`);
        window = context.operatorManager.getNextAvailableWindow(
          operator.id,
          durationHours,
          earliest.toJSDate()
        );
        console.log(`🔍 Successfully called getNextAvailableWindow, result:`, window);
      } catch (error) {
        console.error(`❌ Error in getNextAvailableWindow:`, error);
        throw error;
      }

      if (!window) {
        throw new Error(`No available time window found for operator ${operator.name} for ${durationHours} hours`);
      }
      console.log(`✅ Found time window: ${window.start.toISOString()} to ${window.end.toISOString()}`);

      if (!window) {
        throw new Error(`No available time window found for operator ${operator.name} for ${durationHours} hours`);
      }

      // Ensure machine is also available during this window
      const windowStart = DateTime.fromJSDate(window.start);
      const windowEnd = DateTime.fromJSDate(window.end);
      
      if (!isMachineAvailable(machine.id, windowStart, windowEnd, context)) {
        // If machine conflict, advance time and try again
        earliest = windowEnd;
        continue; // Retry this operation with later time
      }

      // Create schedule entry
      const scheduleEntry: ScheduleEntry = {
        id: crypto.randomUUID(),
        jobId: job.id,
        machineId: machine.id,
        assignedResourceId: operator.id,
        operationSequence: op.sequence,
        startTime: window.start,
        endTime: window.end,
        shift: getShiftNumber(windowStart),
        status: 'Scheduled'
      };

      // Persist to database
      const [createdEntry] = await db.insert(scheduleEntries).values(scheduleEntry).returning();
      scheduledEntries.push(createdEntry);

      // Lock resources to prevent double-booking
      context.machineLocks.set(machine.id, windowEnd);
      context.operatorManager.lockOperatorUntil(operator.id, window.end);

      // Apply 24-hour lag rule for SAW/WATERJET operations
      earliest = windowEnd;
      if (["SAW", "WATERJET"].includes(op.machineType)) {
        earliest = earliest.plus({ days: 1 }).startOf("day");
        console.log(`⏰ Applied 24-hour lag rule after ${op.machineType} operation, next earliest: ${earliest.toISO()}`);
      }

      console.log(`✅ Scheduled operation ${op.sequence} from ${window.start.toISOString()} to ${window.end.toISOString()} on ${machine.name} with ${operator.name}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ Failed to schedule operation ${op.sequence}: ${errorMessage}`);
      throw error;
    }
  }

  // Update job status to scheduled
  await db.update(jobs)
    .set({ status: 'Scheduled' })
    .where(eq(jobs.id, job.id));

  console.log(`🎉 Successfully scheduled job ${job.jobNumber} with ${scheduledEntries.length} operations`);
  return scheduledEntries;
}

/**
 * Select the best machine for a routing operation
 */
async function selectMachine(
  operation: any,
  context: SchedulingContext
): Promise<Machine | null> {
  // Get all machines that can handle this operation type
  const availableMachines = await db
    .select()
    .from(machines)
    .where(eq(machines.type, operation.machineType));

  console.log(`🔍 Looking for machines of type "${operation.machineType}", found ${availableMachines.length} machines`);

  if (availableMachines.length === 0) {
    console.warn(`⚠️ No machines found for operation type: ${operation.machineType}`);
    return null;
  }

  // Prefer machines that are not currently locked or have shorter lock times
  const sortedMachines = availableMachines.sort((a, b) => {
    const lockTimeA = context.machineLocks.get(a.id);
    const lockTimeB = context.machineLocks.get(b.id);
    
    if (!lockTimeA && !lockTimeB) return 0;
    if (!lockTimeA) return -1;
    if (!lockTimeB) return 1;
    
    return lockTimeA.toMillis() - lockTimeB.toMillis();
  });

  console.log(`✅ Selected machine: ${sortedMachines[0].name} (${sortedMachines[0].type})`);
  return sortedMachines[0];
}

/**
 * Select the best operator for a machine and operation
 */
async function selectOperator(
  machine: Machine,
  operation: any,
  context: SchedulingContext
): Promise<Resource | null> {
  // Get all resources that can operate this type of machine
  const availableOperators = await db
    .select()
    .from(resources)
    .where(eq(resources.isActive, true));

  // Filter operators who can work on this machine type
  const suitableOperators = availableOperators.filter(operator => {
    // Check if operator's work centers include this machine type
    const workCenters = operator.workCenters || [];
    return workCenters.includes(machine.type) || workCenters.includes('ALL');
  });

  if (suitableOperators.length === 0) {
    // If no specific operators found, use any active operator
    return availableOperators[0] || null;
  }

  // Prefer operators by role priority: Operator > Shift Lead > Supervisor
  const rolePreferences = ['Operator', 'Shift Lead', 'Supervisor'];
  suitableOperators.sort((a, b) => {
    const aIndex = rolePreferences.indexOf(a.role) >= 0 ? rolePreferences.indexOf(a.role) : 999;
    const bIndex = rolePreferences.indexOf(b.role) >= 0 ? rolePreferences.indexOf(b.role) : 999;
    return aIndex - bIndex;
  });

  return suitableOperators[0];
}

/**
 * Check if a machine is available during a specific time window
 */
function isMachineAvailable(
  machineId: string,
  startTime: DateTime,
  endTime: DateTime,
  context: SchedulingContext
): boolean {
  // Check if machine is locked beyond the start time
  const lockTime = context.machineLocks.get(machineId);
  if (lockTime && lockTime > startTime) {
    return false;
  }

  // Check existing schedule entries for conflicts
  const hasConflict = context.scheduledEntries.some(entry => {
    if (entry.machineId !== machineId) return false;
    
    const entryStart = DateTime.fromJSDate(entry.startTime);
    const entryEnd = DateTime.fromJSDate(entry.endTime);
    
    // Check for time overlap
    return startTime < entryEnd && endTime > entryStart;
  });

  return !hasConflict;
}

/**
 * Initialize a new scheduling context
 */
export function createSchedulingContext(operatorManager: OperatorAvailabilityManager): SchedulingContext {
  return {
    operatorManager,
    machineLocks: new Map(),
    scheduledEntries: []
  };
}

/**
 * Schedule multiple jobs by priority
 */
export async function scheduleJobsByPriority(
  jobsToSchedule: Job[],
  operatorManager: OperatorAvailabilityManager
): Promise<{ scheduled: ScheduleEntry[]; failed: string[] }> {
  const context = createSchedulingContext(operatorManager);
  const scheduledEntries: ScheduleEntry[] = [];
  const failedJobs: string[] = [];

  // Load existing schedule entries to avoid conflicts
  context.scheduledEntries = await db.select().from(scheduleEntries);

  // Sort jobs by priority (Critical > High > Normal > Stock)
  const priorityOrder = { 'Critical': 0, 'High': 1, 'Normal': 2, 'Stock': 3 };
  const sortedJobs = jobsToSchedule.sort((a, b) => {
    const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 999;
    const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 999;
    return aPriority - bPriority;
  });

  for (const job of sortedJobs) {
    try {
      // Get routing operations from job.routing (embedded JSON)
      const routingOps = job.routing || [];

      if (routingOps.length === 0) {
        console.warn(`⚠️ Job ${job.jobNumber} has no routing operations, skipping`);
        failedJobs.push(job.jobNumber);
        continue;
      }

      const jobEntries = await scheduleJob(job, routingOps, context);
      scheduledEntries.push(...jobEntries);
      
      // Add new entries to context to prevent conflicts with subsequent jobs
      context.scheduledEntries.push(...jobEntries);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ Failed to schedule job ${job.jobNumber}: ${errorMessage}`);
      failedJobs.push(job.jobNumber);
    }
  }

  return { scheduled: scheduledEntries, failed: failedJobs };
}