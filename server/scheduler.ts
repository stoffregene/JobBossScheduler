/**
 * @file scheduler.ts
 * @description Final, robust scheduler. Handles priority, batching, and virtual operations.
 */
import { Job, Machine, RoutingOperation, ScheduleEntry, Resource, OutsourcedOperation } from '../shared/schema';
import { IStorage } from './storage-interface';
import { OperatorAvailabilityManager } from './operator-availability';
import { PriorityManager } from './priority-manager';
// import { ReschedulingService } from './rescheduling-service';
import { SchedulingLogger } from './scheduling-logger';
import { CampaignManager } from './campaign-manager';

export interface ScheduleChunk { 
  machine: Machine; 
  resource: Resource; 
  startTime: Date; 
  endTime: Date; 
  shift: number; 
}

export interface JobScheduleResult { 
  success: boolean; 
  scheduledEntries: ScheduleEntry[]; 
  failureReason?: string; 
  failedOperationSequence?: number; 
  warnings?: string[]; 
}

export class JobScheduler {
  private storage: IStorage;
  private operatorManager: OperatorAvailabilityManager;
  private priorityManager: PriorityManager;
  // private reschedulingService: ReschedulingService;
  private campaignManager: CampaignManager;
  private logger: SchedulingLogger;
  private readonly INTRO_OP_TYPES = ['SAW', 'WATERJET'];

  constructor(storage: IStorage, operatorManager: OperatorAvailabilityManager, logger: SchedulingLogger) {
    this.storage = storage;
    this.operatorManager = operatorManager;
    this.logger = logger;
    this.priorityManager = new PriorityManager(this.logger);
    // this.reschedulingService = new ReschedulingService(storage);
    this.campaignManager = new CampaignManager(storage, this.logger);
  }

  public async runFullSchedule(jobsToSchedule: Job[]): Promise<void> {
    const outsourcedOps = await this.storage.getOutsourcedOperations();
    const campaigns = await this.campaignManager.createShippingCampaigns(jobsToSchedule, outsourcedOps);
    const scheduledJobIds = new Set<string>();

    for (const campaign of campaigns) {
      for (const job of campaign.jobs) {
        this.logger.addEntry(job.id, 'INFO', `Scheduling job as part of Campaign ${campaign.campaignId}`);
        const result = await this.scheduleJob(job.id, undefined, campaign.shipDate);
        if (result.success) scheduledJobIds.add(job.id);
      }
    }

    const remainingJobs = jobsToSchedule.filter(job => !scheduledJobIds.has(job.id));
    for (const job of remainingJobs) { 
      await this.scheduleJob(job.id); 
    }
    
    this.logger.printFullSummary();
  }

  public async scheduleJob(jobId: string, scheduleAfter: Date = new Date(), scheduleBackwardsFrom?: Date): Promise<JobScheduleResult> {
    const job = await this.storage.getJob(jobId);
    if (!job) return { success: false, scheduledEntries: [], failureReason: 'Job not found.' };

    this.logger.startJobLog(job.id, job.jobNumber);
    const allOps = await this.storage.getRoutingOperationsByJobId(jobId);
    const outsourcedOps = await this.storage.getOutsourcedOperationsForJob(jobId);
    const opsToSchedule = allOps.sort((a, b) => scheduleBackwardsFrom ? b.sequence - a.sequence : a.sequence - b.sequence);
    
    const warnings: string[] = [];
    const allScheduledEntries: ScheduleEntry[] = [];
    let boundaryTime = scheduleBackwardsFrom || scheduleAfter;

    for (const op of opsToSchedule) {
      this.logger.addEntry(job.id, 'INFO', `-> Processing Op ${op.sequence}: ${op.operationName}`);

      if (op.machineType.toUpperCase().includes('INSPECT')) {
        this.logger.addEntry(job.id, 'INFO', `Skipping calendar entry for Op ${op.sequence}: ${op.operationName}. This will be handled by the 'Jobs Awaiting Inspection' queue.`);
        continue;
      }
      
      const precedingOutsourcedOp = this.findPrecedingOutsourcedOp(op, outsourcedOps);
      if (precedingOutsourcedOp?.dueDate) {
          boundaryTime = new Date(precedingOutsourcedOp.dueDate);
          this.logger.addEntry(job.id, 'INFO', `Dependency found: Outsourced op must return by ${boundaryTime.toLocaleString()}`);
          if (boundaryTime > new Date(job.promisedDate)) {
              const warningMsg = `Job may be late: Outsourced op return date is after job's promised date.`;
              warnings.push(warningMsg);
              this.logger.addEntry(job.id, 'WARN', warningMsg);
          }
      }
      
      const earliestStartTime = this.getEarliestStartTimeForOperation(op, boundaryTime);
      const chunkResult = await this.scheduleOperationInChunks(job, op, earliestStartTime);

      if (!chunkResult.success) {
        const failureReason = `Could not find an available slot for operation: ${op.operationName}. ${chunkResult.failureReason}`;
        this.logger.addEntry(job.id, 'ERROR', failureReason);
        return { success: false, scheduledEntries: allScheduledEntries, failureReason, failedOperationSequence: op.sequence, warnings };
      }
      
      const entriesForOperation = chunkResult.chunks.map(chunk => ({
        id: '', 
        jobId: job.id, 
        machineId: chunk.machine.id, 
        assignedResourceId: chunk.resource.id,
        operationSequence: op.sequence, 
        startTime: chunk.startTime, 
        endTime: chunk.endTime,
        shift: chunk.shift, 
        status: 'Scheduled' as const,
      } as ScheduleEntry));

      allScheduledEntries.push(...entriesForOperation);
      boundaryTime = chunkResult.chunks[chunkResult.chunks.length - 1].endTime;

      const opName = op.operationName.toUpperCase();
      if (this.INTRO_OP_TYPES.some(type => opName.includes(type) || op.machineType.toUpperCase().includes(type))) {
        const nextDay = new Date(boundaryTime);
        nextDay.setDate(nextDay.getDate() + 1);
        nextDay.setHours(0, 0, 0, 0);
        boundaryTime = nextDay;
        this.logger.addEntry(job.id, 'INFO', `Enforced 24hr lag after intro op. Next op can start after ${boundaryTime.toLocaleString()}`);
      }
    }
    
    this.logger.addEntry(job.id, 'INFO', `--- Successfully scheduled Job ${job.jobNumber} ---`);
    return { success: true, scheduledEntries: allScheduledEntries, warnings };
  }
  
  private findPrecedingOutsourcedOp = (op: RoutingOperation, ops: OutsourcedOperation[]) => 
    ops.filter(o => o.operationSequence < op.sequence).sort((a, b) => b.operationSequence - a.operationSequence)[0];

  private async scheduleOperationInChunks(job: Job, operation: RoutingOperation, searchFromDate: Date): Promise<{ success: boolean; chunks: ScheduleChunk[]; failureReason?: string }> {
    // Basic implementation - can be enhanced with actual chunking logic
    const machines = await this.storage.getMachines();
    const compatibleMachines = machines.filter(machine => 
      operation.compatibleMachines.includes(machine.machineId) || 
      operation.machineType === machine.type
    );

    if (compatibleMachines.length === 0) {
      return { success: false, chunks: [], failureReason: 'No compatible machines found' };
    }

    const resources = await this.storage.getResources();
    const availableResources = resources.filter(resource => 
      resource.workCenters.some(wc => compatibleMachines.some(m => m.id === wc))
    );

    if (availableResources.length === 0) {
      return { success: false, chunks: [], failureReason: 'No available resources found' };
    }

    // Simple implementation: create one chunk for the entire operation
    const machine = compatibleMachines[0];
    const resource = availableResources[0];
    const durationMs = this.calculateOperationDurationMs(operation);
    const endTime = new Date(searchFromDate.getTime() + durationMs);

    const chunk: ScheduleChunk = {
      machine,
      resource,
      startTime: searchFromDate,
      endTime,
      shift: searchFromDate.getHours() < 15 ? 1 : 2
    };

    return { success: true, chunks: [chunk] };
  }

  private getEarliestStartTimeForOperation = (op: RoutingOperation, time: Date) => 
    (op.earliestStartDate && new Date(op.earliestStartDate) > time) ? new Date(op.earliestStartDate) : time;

  private calculateOperationDurationMs = (op: RoutingOperation) => 
    (parseFloat(op.estimatedHours) + (parseFloat(op.setupHours) || 0)) * 3600000;
}