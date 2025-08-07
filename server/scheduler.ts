/**
 * @file scheduler.ts
 * @description A robust scheduler that now includes shift-based load balancing.
 */
import { Job, Machine, RoutingOperation, ScheduleEntry, Resource, RoutingOperationType } from '../shared/schema';
import { IStorage } from './storage-interface';
import { OperatorAvailabilityManager } from './operator-availability';
import { ShiftCapacityManager } from './shift-capacity-manager';

export interface ScheduleChunk { machine: Machine; resource: Resource; startTime: Date; endTime: Date; shift: number; }
export interface JobScheduleResult { success: boolean; scheduledEntries: ScheduleEntry[]; failureReason?: string; }

export class JobScheduler {
  private storage: IStorage;
  private operatorManager: OperatorAvailabilityManager;
  private shiftCapacityManager: ShiftCapacityManager;

  constructor(storage: IStorage, operatorManager: OperatorAvailabilityManager, shiftCapacityManager: ShiftCapacityManager) {
    this.storage = storage;
    this.operatorManager = operatorManager;
    this.shiftCapacityManager = shiftCapacityManager;
  }

  public async scheduleJob(jobId: string, scheduleAfter: Date = new Date()): Promise<JobScheduleResult> {
    const job = await this.storage.getJob(jobId);
    if (!job) return { success: false, scheduledEntries: [], failureReason: 'Job not found.' };

    console.log(`🎯 Scheduling job ${job.jobNumber} with ${job.routing.length} operations`);

    // Use job.routing directly instead of separate database call
    const opsToSchedule = job.routing.sort((a, b) => a.sequence - b.sequence);
    
    const allScheduledEntries: ScheduleEntry[] = [];
    
    // Start from next business day at work start time instead of current time
    const now = new Date();
    const nextWorkDay = new Date(now);
    nextWorkDay.setDate(now.getDate() + 1); // Start tomorrow
    nextWorkDay.setHours(3, 0, 0, 0); // 3:00 AM start time
    
    let boundaryTime = scheduleAfter > now ? scheduleAfter : nextWorkDay;
    console.log(`🕐 Starting scheduling from: ${boundaryTime.toISOString()}`);

    for (const op of opsToSchedule) {
      console.log(`  📋 Processing operation ${op.sequence}: ${op.name} (${op.estimatedHours}h)`);
      
      if (op.machineType.toUpperCase().includes('INSPECT')) {
        console.log(`  ⏭️ Skipping inspection operation ${op.sequence}`);
        continue;
      }
      
      const earliestStartTime = boundaryTime; // Use boundary time as job.routing doesn't have earliestStartDate
      const chunkResult = await this.scheduleOperationInChunks(job, op, earliestStartTime);

      console.log(`  📊 Chunk result for op ${op.sequence}:`, { success: chunkResult.success, chunks: chunkResult.chunks?.length || 0, failureReason: chunkResult.failureReason });

      if (!chunkResult.success) {
        console.log(`  ❌ Failed operation ${op.sequence}: ${chunkResult.failureReason}`);
        return { success: false, scheduledEntries: allScheduledEntries, failureReason: chunkResult.failureReason || `Failed on Op ${op.sequence}: Could not find a suitable machine/operator.` };
      }
      
      const entriesForOperation = chunkResult.chunks.map(chunk => ({
        id: `${jobId}-${op.sequence}-${chunk.startTime.getTime()}`,
        jobId: job.id,
        machineId: chunk.machine.id,
        assignedResourceId: chunk.resource.id,
        operationSequence: op.sequence,
        operationName: op.name,
        startTime: chunk.startTime,
        endTime: chunk.endTime,
        shift: chunk.shift,
        status: 'Scheduled'
      } as ScheduleEntry));

      allScheduledEntries.push(...entriesForOperation);
      this.shiftCapacityManager.addEntries(entriesForOperation);
      
      if (chunkResult.chunks.length > 0) {
        boundaryTime = chunkResult.chunks[chunkResult.chunks.length - 1].endTime;
      }
    }
    
    console.log(`🎯 Job ${job.jobNumber} scheduled with ${allScheduledEntries.length} total entries`);
    return { success: true, scheduledEntries: allScheduledEntries };
  }
  
  private async scheduleOperationInChunks(job: Job, operation: RoutingOperationType, searchFromDate: Date) {
    let remainingDurationMs = (parseFloat(operation.estimatedHours) + (parseFloat(operation.setupHours) || 0)) * 3600000;
    let currentTime = new Date(searchFromDate);
    const scheduledChunks: ScheduleChunk[] = [];
    let lockedMachine: Machine | null = null, lockedResource: Resource | null = null;



    while (remainingDurationMs > 0) {
      const nextChunk = await this.findNextAvailableChunk(job, operation, currentTime, lockedMachine, lockedResource);
      if (!nextChunk) {
        return { success: false, chunks: [], failureReason: `No available time slot found for operation ${operation.sequence} after ${currentTime.toISOString()}` };
      }
      
      if (!lockedMachine) lockedMachine = nextChunk.machine;
      if (!lockedResource) lockedResource = nextChunk.resource;

      const chunkDurationMs = nextChunk.endTime.getTime() - nextChunk.startTime.getTime();
      const durationToSchedule = Math.min(remainingDurationMs, chunkDurationMs);
      const finalChunk = { ...nextChunk, endTime: new Date(nextChunk.startTime.getTime() + durationToSchedule) };

      scheduledChunks.push(finalChunk);
      remainingDurationMs -= durationToSchedule;
      currentTime = finalChunk.endTime;
    }
    return { success: true, chunks: scheduledChunks };
  }

  private async findNextAvailableChunk(incomingJob: Job, operation: RoutingOperationType, searchFrom: Date, lockedMachine: Machine | null, lockedResource: Resource | null) {
    const compatibleMachines = lockedMachine ? [lockedMachine] : await this.getCompatibleMachinesForOperation(operation);
    if (compatibleMachines.length === 0) {
      console.log(`    ❌ No compatible machines found for operation ${operation.sequence}`);
      return null;
    }
    
    console.log(`    🕐 Searching for time slot starting from ${searchFrom.toISOString()}`);
    const optimalShift = this.shiftCapacityManager.getOptimalShift();
    const shiftsToTry = optimalShift === 1 ? [1, 2] : [2, 1];
    console.log(`    📊 Trying shifts: [${shiftsToTry.join(', ')}]`);

    for (let i = 0; i < 30 * 24 * 60; i++) {
      const currentTime = new Date(searchFrom.getTime() + i * 60 * 1000);
      
      for (const machine of compatibleMachines) {
        const machineSchedule = await this.storage.getScheduleEntriesForMachine(machine.id);
        const isBusy = machineSchedule.some(e => currentTime >= e.startTime && currentTime < e.endTime);
        
        if (isBusy) {
          if (i < 10) console.log(`    ⏸️ Machine ${machine.machineId} busy at ${currentTime.toISOString()}`);
          continue;
        }

        const resource = await this.findAvailableResourceForTime(operation, machine, currentTime, lockedResource, shiftsToTry as (1 | 2)[]);
        
        if (!resource) {
          if (i < 10) console.log(`    👤 No available resource for ${machine.machineId} at ${currentTime.toISOString()}`);
          continue;
        }
        
        const workBlockEnd = await this.calculateContinuousWorkBlock(currentTime, machine, resource.resource, machineSchedule);
        
        if(workBlockEnd.getTime() > currentTime.getTime()) {
          console.log(`    ✅ Found chunk: ${machine.machineId} with ${resource.resource.name} from ${currentTime.toISOString()} to ${workBlockEnd.toISOString()}`);
          return { machine, resource: resource.resource, startTime: currentTime, endTime: workBlockEnd, shift: resource.shift };
        } else {
          if (i < 10) console.log(`    ⏰ Work block too short for ${machine.machineId} at ${currentTime.toISOString()}`);
        }
      }
      
      if (i % (24 * 60) === 0 && i > 0) {
        console.log(`    📅 Searched ${i / (24 * 60)} days, continuing...`);
      }
    }
    
    console.log(`    ❌ No available time slot found after searching 30 days`);
    return null;
  }

  private async findAvailableResourceForTime(operation: RoutingOperationType, machine: Machine, time: Date, lockedResource: Resource | null, shiftsToTry: (1 | 2)[]) {
    for (const shift of shiftsToTry) {
      const availableOperators = this.operatorManager.getAvailableOperators(time, shift, undefined, [machine.machineId]);
      
      const qualifiedOperators = availableOperators.filter(op => {
        if (lockedResource && op.id !== lockedResource.id) return false;
        // RoutingOperationType doesn't have requiredSkills, so always return true for now
        return true;

      });

      if (qualifiedOperators.length > 0) {
        // Prefer Operators over Supervisors and other roles
        const preferredOperator = qualifiedOperators.find(op => op.role === 'Operator') || 
                                  qualifiedOperators.find(op => op.role === 'Shift Lead') || 
                                  qualifiedOperators[0];
        return { resource: preferredOperator, shift };
      }
    }
    return null;
  }

  private async calculateContinuousWorkBlock(startTime: Date, machine: Machine, resource: Resource, machineSchedule: ScheduleEntry[]) {
      const operatorWorkingHours = this.operatorManager.getOperatorWorkingHours(resource.id, startTime);
      if (!operatorWorkingHours) return startTime;
      const nextJobStart = machineSchedule.filter(e => e.startTime > startTime).sort((a, b) => a.startTime.getTime() - b.startTime.getTime())[0]?.startTime || new Date(startTime.getTime() + 24 * 60 * 60 * 1000);
      return new Date(Math.min(operatorWorkingHours.endTime.getTime(), nextJobStart.getTime()));
  }

  // Removed unused method - replaced inline above

  private async getCompatibleMachinesForOperation(operation: RoutingOperationType): Promise<Machine[]> {
    const allMachines = await this.storage.getMachines();
    const potentialMachines = new Map<string, Machine>();

    console.log(`    🔧 Finding machines for operation ${operation.sequence}:`);
    console.log(`    - Compatible machines: [${operation.compatibleMachines.join(', ')}]`);
    console.log(`    - Machine type: ${operation.machineType}`);

    // RoutingOperationType doesn't have originalQuotedMachineId, skip this logic

    // Fix: Compare with machineId field, not id field
    if (operation.compatibleMachines && operation.compatibleMachines.length > 0) {
        operation.compatibleMachines.forEach((machineId: string) => {
            const machine = allMachines.find(m => m.machineId === machineId);
            if (machine) {
                console.log(`    ✅ Found compatible machine: ${machine.machineId} (${machine.name})`);
                potentialMachines.set(machine.id, machine);
            } else {
                console.log(`    ❌ Could not find machine with machineId: ${machineId}`);
            }
        });
    }
    
    // Fallback to machine type matching
    if (potentialMachines.size === 0) {
        console.log(`    🔄 No compatible machines found, trying machine type: ${operation.machineType}`);
        allMachines.forEach(m => {
            if (m.type === operation.machineType) {
                console.log(`    ✅ Found machine by type: ${m.machineId} (${m.name})`);
                potentialMachines.set(m.id, m);
            }
        });
    }
    
    console.log(`    🎯 Final compatible machines: [${Array.from(potentialMachines.values()).map(m => m.machineId).join(', ')}]`);
    return Array.from(potentialMachines.values());
  }
}