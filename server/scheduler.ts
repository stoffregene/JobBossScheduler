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
        return { success: false, scheduledEntries: allScheduledEntries, failureReason: `Failed on Op ${op.sequence}` };
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
  
  private async scheduleOperationInChunks(job, operation, searchFromDate) {
    let remainingDurationMs = (parseFloat(operation.estimatedHours) + (parseFloat(operation.setupHours) || 0)) * 3600000;
    let currentTime = new Date(searchFromDate);
    const scheduledChunks: ScheduleChunk[] = [];
    let lockedMachine: Machine | null = null, lockedResource: Resource | null = null;

    while (remainingDurationMs > 0) {
      const nextChunk = await this.findNextAvailableChunk(job, operation, currentTime, lockedMachine, lockedResource);
      if (!nextChunk) return { success: false, chunks: [] };
      
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

  private async findNextAvailableChunk(incomingJob, operation, searchFrom, lockedMachine, lockedResource) {
    const compatibleMachines = lockedMachine ? [lockedMachine] : await this.getCompatibleMachinesForOperation(operation);
    if (compatibleMachines.length === 0) return null;
    
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

  private async findAvailableResourceForTime(operation, machine, time, lockedResource, shiftsToTry) {
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

  private async calculateContinuousWorkBlock(startTime, machine, resource, machineSchedule) {
      const operatorWorkingHours = this.operatorManager.getOperatorWorkingHours(resource.id, startTime);
      if (!operatorWorkingHours) return startTime;
      const nextJobStart = machineSchedule.filter(e => e.startTime > startTime).sort((a, b) => a.startTime.getTime() - b.startTime.getTime())[0]?.startTime || new Date(startTime.getTime() + 24 * 60 * 60 * 1000);
      return new Date(Math.min(operatorWorkingHours.endTime.getTime(), nextJobStart.getTime()));
  }

  private getEarliestStartTimeForOperation = (op, time) => (op.earliestStartDate && new Date(op.earliestStartDate) > time) ? new Date(op.earliestStartDate) : time;

  private async getCompatibleMachinesForOperation(operation) {
    const allMachines = await this.storage.getMachines();
    const potentialMachines = new Map();
    if (operation.originalQuotedMachineId) {
        const quotedMachine = allMachines.find(m => m.id === operation.originalQuotedMachineId);
        if (quotedMachine) potentialMachines.set(quotedMachine.id, quotedMachine);
    }
    if (operation.compatibleMachines?.length > 0) {
        operation.compatibleMachines.forEach(id => {
            const machine = allMachines.find(m => m.id === id);
            if (machine) potentialMachines.set(machine.id, machine);
        });
    } else {
        allMachines.forEach(m => {
            if (m.type === operation.machineType) potentialMachines.set(m.id, m);
        });
    }
    return Array.from(potentialMachines.values());
  }
}