// This is a backup of the current scheduler before reverting
import { Job, Resource, Machine, ScheduleEntry } from "@shared/schema";
import { IStorage } from "./storage";
import { OperatorAvailabilityManager } from "./operator-availability";
import { ShiftCapacityManager } from "./shift-capacity-manager";

export interface JobScheduleResult {
  success: boolean;
  scheduledEntries: ScheduleEntry[];
  failureReason?: string;
}

export interface ScheduleChunk {
  machine: Machine;
  resource: Resource;
  startTime: Date;
  endTime: Date;
  shift: 1 | 2;
}

export interface ChunkResult {
  success: boolean;
  chunks: ScheduleChunk[];
  failureReason?: string;
}

export class JobScheduler {
  constructor(
    private storage: IStorage,
    private operatorManager: OperatorAvailabilityManager,
    private shiftCapacityManager: ShiftCapacityManager
  ) {}

  async scheduleJob(jobId: string): Promise<JobScheduleResult> {
    const jobs = await this.storage.getJobs();
    const job = jobs.find(j => j.id === jobId);
    if (!job) return { success: false, scheduledEntries: [], failureReason: 'Job not found.' };

    const allScheduledEntries: ScheduleEntry[] = [];
    let boundaryTime = new Date();

    for (const op of job.routing) {
      
      const earliestStartTime = this.getEarliestStartTimeForOperation(op, boundaryTime);
      const chunkResult = await this.scheduleOperationInChunks(job, op, earliestStartTime);

      if (!chunkResult.success) {
        return { success: false, scheduledEntries: allScheduledEntries, failureReason: chunkResult.failureReason || `Failed on Op ${op.sequence}: Could not find a suitable machine/operator.` };
      }
      
      const entriesForOperation = chunkResult.chunks.map(chunk => ({
        id: `${jobId}-${op.sequence}-${chunk.startTime.getTime()}`,
        jobId, operationSequence: op.sequence, operationName: op.name,
        assignedMachineId: chunk.machine.id, assignedResourceId: chunk.resource.id,
        startTime: chunk.startTime, endTime: chunk.endTime, shift: chunk.shift
      }));

      allScheduledEntries.push(...entriesForOperation);
      boundaryTime = new Date(Math.max(...chunkResult.chunks.map(c => c.endTime.getTime())));
    }
    
    return { success: true, scheduledEntries: allScheduledEntries };
  }
  
  private async scheduleOperationInChunks(job: Job, operation: RoutingOperation, searchFromDate: Date) {
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

  // ... rest of implementation
}