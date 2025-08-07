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

  constructor(storage: IStorage, operatorManager: OperatorAvailabilityManager, allResources: Resource[], allEntries: ScheduleEntry[]) {
    this.storage = storage;
    this.operatorManager = operatorManager;
    this.shiftCapacityManager = new ShiftCapacityManager(allResources, allEntries);
  }

  public async scheduleJob(jobId: string, scheduleAfter: Date = new Date()): Promise<JobScheduleResult> {
    const job = await this.storage.getJob(jobId);
    if (!job) return { success: false, scheduledEntries: [], failureReason: 'Job not found.' };

    const allOps = await this.storage.getRoutingOperationsByJobId(jobId);
    const opsToSchedule = allOps.sort((a, b) => a.sequence - b.sequence);
    
    const allScheduledEntries: ScheduleEntry[] = [];
    let boundaryTime = scheduleAfter;

    for (const op of opsToSchedule) {
      if (op.machineType.toUpperCase().includes('INSPECT')) {
        continue;
      }
      
      const earliestStartTime = this.getEarliestStartTimeForOperation(op, boundaryTime);
      const chunkResult = await this.scheduleOperationInChunks(job, op, earliestStartTime);

      if (!chunkResult.success) {
        return { success: false, scheduledEntries: allScheduledEntries, failureReason: `Failed on Op ${op.sequence}: Could not find a suitable machine.` };
      }
      
      const entriesForOperation = chunkResult.chunks.map(chunk => ({
        id: '', jobId: job.id, machineId: chunk.machine.id, assignedResourceId: chunk.resource.id,
        operationSequence: op.sequence, startTime: chunk.startTime, endTime: chunk.endTime,
        shift: chunk.shift, status: 'Scheduled',
      } as ScheduleEntry));

      allScheduledEntries.push(...entriesForOperation);
      boundaryTime = chunkResult.chunks[chunkResult.chunks.length - 1].endTime;
    }
    
    return { success: true, scheduledEntries: allScheduledEntries };
  }
  
  private async scheduleOperationInChunks(job: Job, operation: RoutingOperation, searchFromDate: Date): Promise<ChunkResult> {
    let remainingDurationMs = (parseFloat(operation.estimatedHours) + (parseFloat(operation.setupHours) || 0)) * 3600000;
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

  private async findNextAvailableChunk(incomingJob: Job, operation: RoutingOperation, searchFrom: Date, lockedMachine: Machine | null, lockedResource: Resource | null) {
    const compatibleMachines = lockedMachine ? [lockedMachine] : await this.getCompatibleMachinesForOperation(operation);
    if (compatibleMachines.length === 0) {
      console.log(`No compatible machines found for operation ${operation.operationName} (${operation.machineType})`);
      return null;
    }
    
    const optimalShift = this.shiftCapacityManager.getOptimalShift();
    const shiftsToTry = optimalShift === 1 ? [1, 2] : [2, 1];

    for (let i = 0; i < 30 * 24 * 60; i++) {
      const currentTime = new Date(searchFrom.getTime() + i * 60 * 1000);
      for (const machine of compatibleMachines) {
        const machineSchedule = await this.storage.getScheduleEntriesForMachine(machine.id);
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

  private async findAvailableResourceForTime(operation: RoutingOperation, machine: Machine, time: Date, lockedResource: Resource | null, shiftsToTry: number[]) {
    for (const shift of shiftsToTry) {
      const availableOperators = this.operatorManager.getAvailableOperators(time, shift, undefined, [machine.machineId]);
      const qualifiedOperators = availableOperators.filter(op => {
        if (lockedResource && op.id !== lockedResource.id) return false;
        if (!operation.requiredSkills || operation.requiredSkills.length === 0) return true;
        return operation.requiredSkills.every(skill => op.skills.includes(skill));
      });
      if (qualifiedOperators.length > 0) return { resource: qualifiedOperators[0], shift };
    }
    return null;
  }

  private async calculateContinuousWorkBlock(startTime: Date, machine: Machine, resource: Resource, machineSchedule: ScheduleEntry[]) {
      const operatorWorkingHours = this.operatorManager.getOperatorWorkingHours(resource.id, startTime);
      if (!operatorWorkingHours) return startTime;
      const nextJobStart = machineSchedule.filter(e => e.startTime > startTime).sort((a, b) => a.startTime.getTime() - b.startTime.getTime())[0]?.startTime || new Date(startTime.getTime() + 24 * 60 * 60 * 1000);
      return new Date(Math.min(operatorWorkingHours.endTime.getTime(), nextJobStart.getTime()));
  }

  private getEarliestStartTimeForOperation = (op: RoutingOperation, time: Date) => (op.earliestStartDate && new Date(op.earliestStartDate) > time) ? new Date(op.earliestStartDate) : time;

  private async getCompatibleMachinesForOperation(operation: RoutingOperation): Promise<Machine[]> {
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
        operation.compatibleMachines.forEach(machineId => {
            const machine = allMachines.find(m => m.id === machineId);
            if (machine) potentialMachines.set(machine.id, machine);
        });
    }
    
    // 4. As a fallback, if no other options are found, add all machines of the correct type.
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