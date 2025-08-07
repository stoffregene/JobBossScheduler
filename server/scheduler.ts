/**
 * @file scheduler.ts
 * @description A robust scheduler that now includes shift-based load balancing.
 */
import { Job, Machine, RoutingOperation, ScheduleEntry, Resource } from '../shared/schema';
import { IStorage } from './storage-interface';
import { OperatorAvailabilityManager } from './operator-availability';
import { ShiftCapacityManager } from './shift-capacity-manager';

export interface ScheduleChunk { machine: Machine; resource: Resource; startTime: Date; endTime: Date; shift: number; }
export interface JobScheduleResult { success: boolean; scheduledEntries: ScheduleEntry[]; failureReason?: string; }
export interface ChunkResult { success: boolean; chunks: ScheduleChunk[]; failureReason?: string; }

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

    // Get routing operations from job.routing array instead of separate table
    const allOps = job.routing || [];
    if (allOps.length === 0) {
      return { success: false, scheduledEntries: [], failureReason: 'No routing operations found for this job.' };
    }
    
    const opsToSchedule = allOps.sort((a, b) => a.sequence - b.sequence);
    
    const allScheduledEntries: ScheduleEntry[] = [];
    let boundaryTime = scheduleAfter;

    for (const op of opsToSchedule) {
      // Map the routing operation fields to expected names
      const mappedOp = {
        ...op,
        operationName: op.name || 'UNKNOWN',
        machineType: op.machineType,
        estimatedHours: op.estimatedHours || 0,
        setupHours: 0, // RoutingOperationType doesn't have setupHours
        sequence: op.sequence || 10,
        compatibleMachines: op.compatibleMachines || []
      };

      if (mappedOp.machineType.toUpperCase().includes('INSPECT')) {
        continue;
      }
      
      const earliestStartTime = this.getEarliestStartTimeForOperation(mappedOp, boundaryTime);
      const chunkResult = await this.scheduleOperationInChunks(job, mappedOp, earliestStartTime);

      if (!chunkResult.success) {
        return { success: false, scheduledEntries: allScheduledEntries, failureReason: `Failed on Op ${mappedOp.sequence}: Could not find a suitable machine.` };
      }
      
      const entriesForOperation = chunkResult.chunks.map(chunk => ({
        id: crypto.randomUUID(), 
        jobId: job.id, machineId: chunk.machine.id, assignedResourceId: chunk.resource.id,
        operationSequence: mappedOp.sequence, startTime: chunk.startTime, endTime: chunk.endTime,
        shift: chunk.shift, status: 'Scheduled',
      } as ScheduleEntry));

      allScheduledEntries.push(...entriesForOperation);
      if (chunkResult.chunks.length > 0) {
        boundaryTime = chunkResult.chunks[chunkResult.chunks.length - 1].endTime;
      }
    }
    
    return { success: true, scheduledEntries: allScheduledEntries };
  }
  
  private async scheduleOperationInChunks(job: Job, operation: any, searchFromDate: Date): Promise<ChunkResult> {
    const estimatedHours = operation.estimatedHours || 0;
    const setupHours = operation.setupHours || 0;
    let remainingDurationMs = (parseFloat(estimatedHours.toString()) + parseFloat(setupHours.toString())) * 3600000;
    let currentTime = new Date(searchFromDate);
    const scheduledChunks: ScheduleChunk[] = [];
    let lockedMachine: Machine | null = null, lockedResource: Resource | null = null;

    while (remainingDurationMs > 0) {
      const nextChunk = await this.findNextAvailableChunk(job, operation, currentTime, lockedMachine, lockedResource);
      if (!nextChunk) return { success: false, chunks: [], failureReason: `No available time slots found for operation.` };
      
      if (!lockedMachine) lockedMachine = nextChunk.machine;
      if (!lockedResource) lockedResource = nextChunk.resource;

      const chunkDurationMs = nextChunk.endTime.getTime() - nextChunk.startTime.getTime();
      const durationToSchedule = Math.min(remainingDurationMs, chunkDurationMs);
      const finalChunk = { ...nextChunk, endTime: new Date(nextChunk.startTime.getTime() + durationToSchedule) };

      scheduledChunks.push(finalChunk);
      remainingDurationMs -= durationToSchedule;
      currentTime = finalChunk.endTime;
    }
    return { success: true, chunks: scheduledChunks, failureReason: undefined };
  }

  private async findNextAvailableChunk(incomingJob: Job, operation: any, searchFrom: Date, lockedMachine: Machine | null, lockedResource: Resource | null) {
    const compatibleMachines = lockedMachine ? [lockedMachine] : await this.getCompatibleMachinesForOperation(operation);
    if (compatibleMachines.length === 0) {
      console.log(`No compatible machines found for operation ${operation.operationName || operation.operation || 'UNKNOWN'} (${operation.machineType})`);
      return null;
    }
    
    const optimalShift = this.shiftCapacityManager.getOptimalShift();
    const shiftsToTry = optimalShift === 1 ? [1, 2] : [2, 1];

    for (let i = 0; i < 30 * 24 * 60; i++) {
      const currentTime = new Date(searchFrom.getTime() + i * 60 * 1000);
      for (const machine of compatibleMachines) {
        const allScheduleEntries = await this.storage.getScheduleEntries();
        const machineSchedule = allScheduleEntries.filter(e => e.machineId === machine.id);
        const isBusy = machineSchedule.some(e => currentTime >= e.startTime && currentTime < e.endTime);
        if (isBusy) continue;

        const resource = await this.findAvailableResourceForTime(operation, machine, currentTime, lockedResource, shiftsToTry);
        if (resource) {
          const workBlockEnd = await this.calculateContinuousWorkBlock(currentTime, machine, resource.resource, machineSchedule);
          if(workBlockEnd.getTime() > currentTime.getTime()) {
            return { machine, resource: resource.resource, startTime: currentTime, endTime: workBlockEnd, shift: resource.shift };
          }
        }
      }
    }
    return null;
  }

  private async findAvailableResourceForTime(operation: any, machine: Machine, time: Date, lockedResource: Resource | null, shiftsToTry: number[]) {
    for (const shift of shiftsToTry) {
      const availableOperators = this.operatorManager.getAvailableOperators(time, shift, undefined, [machine.id]);
      const qualifiedOperators = availableOperators.filter(op => {
        if (lockedResource && op.id !== lockedResource.id) return false;
        if (!operation.requiredSkills || operation.requiredSkills.length === 0) return true;
        return operation.requiredSkills.every((skill: string) => op.skills.includes(skill));
      });
      if (qualifiedOperators.length > 0) return { resource: qualifiedOperators[0], shift };
    }
    return null;
  }

  private async calculateContinuousWorkBlock(startTime: Date, machine: Machine, resource: Resource, machineSchedule: ScheduleEntry[]) {
      const operatorWorkingHours = this.operatorManager.getOperatorWorkingHours(resource.id, startTime);
      if (!operatorWorkingHours || !operatorWorkingHours.endTime) {
        // Fallback to 8-hour work block if operator hours not available
        return new Date(startTime.getTime() + 8 * 60 * 60 * 1000);
      }
      const nextJobStart = machineSchedule.filter(e => e.startTime > startTime).sort((a, b) => a.startTime.getTime() - b.startTime.getTime())[0]?.startTime || new Date(startTime.getTime() + 24 * 60 * 60 * 1000);
      return new Date(Math.min(operatorWorkingHours.endTime.getTime(), nextJobStart.getTime()));
  }

  private getEarliestStartTimeForOperation = (op: any, time: Date) => (op.earliestStartDate && new Date(op.earliestStartDate) > time) ? new Date(op.earliestStartDate) : time;

  private async getCompatibleMachinesForOperation(operation: any): Promise<Machine[]> {
    const allMachines = await this.storage.getMachines();
    const potentialMachines = new Map<string, Machine>();

    // 1. Prioritize the originally quoted machine.
    if (operation.originalQuotedMachineId) {
        const quotedMachine = allMachines.find(m => m.id === operation.originalQuotedMachineId);
        if (quotedMachine) {
            potentialMachines.set(quotedMachine.id, quotedMachine);
            // 2. If quoted machine has a substitution group, add all machines from that group.
            if (quotedMachine.substitutionGroup) {
                const substituteMachines = await this.storage.getMachinesBySubstitutionGroup(quotedMachine.substitutionGroup);
                substituteMachines.forEach(m => potentialMachines.set(m.id, m));
            }
        }
    }

    // 3. Add machines from the operation's explicit compatible list.
    if (operation.compatibleMachines && operation.compatibleMachines.length > 0) {
        operation.compatibleMachines.forEach((machineId: string) => {
            const machine = allMachines.find(m => m.id === machineId || m.machineId === machineId);
            if (machine) potentialMachines.set(machine.id, machine);
        });
    }
    
    // 4. Check if machineType is actually a specific machine ID rather than a type
    const machineBySpecificId = allMachines.find(m => m.id === operation.machineType || m.machineId === operation.machineType);
    if (machineBySpecificId) {
        potentialMachines.set(machineBySpecificId.id, machineBySpecificId);
    }
    
    // 5. As a fallback, if no other options are found, add all machines of the correct type.
    if (potentialMachines.size === 0) {
        allMachines.forEach(m => {
            if (m.type === operation.machineType) {
                potentialMachines.set(m.id, m);
            }
        });
    }
    
    return Array.from(potentialMachines.values());
  }
}