import { 
  ScheduleConflict, 
  RescheduleRequest, 
  RescheduleResult,
  Resource,
  ResourceUnavailability,
  RoutingOperation,
  Machine,
  Job,
  ScheduleEntry
} from "@shared/schema";
import { DatabaseStorage } from "./database-storage";

export class ReschedulingService {
  constructor(private storage: DatabaseStorage) {}

  /**
   * Main entry point for rescheduling jobs when resources become unavailable
   */
  async rescheduleForUnavailability(request: RescheduleRequest): Promise<RescheduleResult> {
    try {
      console.log(`Starting reschedule process: ${request.reason}`);
      
      // Step 1: Detect all schedule conflicts
      const conflicts = await this.detectScheduleConflicts(request);
      
      if (conflicts.length === 0) {
        return {
          success: true,
          conflictsResolved: 0,
          jobsRescheduled: 0,
          operationsRescheduled: 0,
          unresolvableConflicts: [],
          warnings: [],
          summary: "No scheduling conflicts detected."
        };
      }

      // Step 2: Categorize conflicts by severity and type
      const criticalConflicts = conflicts.filter(c => c.severity === 'critical');
      const highConflicts = conflicts.filter(c => c.severity === 'high');
      const mediumConflicts = conflicts.filter(c => c.severity === 'medium');
      
      console.log(`Found ${conflicts.length} conflicts: ${criticalConflicts.length} critical, ${highConflicts.length} high, ${mediumConflicts.length} medium`);

      // Step 3: Create reschedule plan prioritizing critical conflicts
      const rescheduleOperations = await this.createReschedulePlan(
        [...criticalConflicts, ...highConflicts, ...mediumConflicts],
        request
      );

      // Step 4: Execute the rescheduling plan
      const result = await this.executeReschedulePlan(rescheduleOperations, request);

      return result;

    } catch (error) {
      console.error('Rescheduling failed:', error);
      return {
        success: false,
        conflictsResolved: 0,
        jobsRescheduled: 0,
        operationsRescheduled: 0,
        unresolvableConflicts: [],
        warnings: [`Rescheduling failed: ${error.message}`],
        summary: "Rescheduling process encountered an error."
      };
    }
  }

  /**
   * Detect all schedule conflicts based on resource unavailability
   */
  private async detectScheduleConflicts(request: RescheduleRequest): Promise<ScheduleConflict[]> {
    const conflicts: ScheduleConflict[] = [];
    
    // Get all current schedule entries that fall within the unavailability period
    const affectedEntries = await this.storage.getScheduleEntriesInDateRange(
      request.unavailabilityStart,
      request.unavailabilityEnd
    );

    // Get all routing operations that might be affected
    const routingOps = await this.storage.getAllRoutingOperations();
    
    for (const entry of affectedEntries) {
      // Check if this schedule entry conflicts with resource unavailability
      if (await this.isScheduleEntryAffected(entry, request)) {
        const conflict: ScheduleConflict = {
          id: `conflict_${entry.id}`,
          type: 'resource_unavailable',
          severity: this.calculateConflictSeverity(entry),
          jobId: entry.jobId,
          resourceId: request.affectedResourceIds?.[0],
          machineId: entry.machineId,
          conflictStart: new Date(Math.max(entry.startTime.getTime(), request.unavailabilityStart.getTime())),
          conflictEnd: new Date(Math.min(entry.endTime.getTime(), request.unavailabilityEnd.getTime())),
          impact: `Operation cannot be completed due to resource unavailability`,
          suggestedActions: ['Reschedule to different time', 'Assign alternative resource', 'Use substitute machine']
        };
        
        conflicts.push(conflict);
      }
    }

    // Check for routing operation conflicts
    for (const routingOp of routingOps) {
      if (routingOp.scheduledStartTime && routingOp.scheduledEndTime) {
        const opStart = new Date(routingOp.scheduledStartTime);
        const opEnd = new Date(routingOp.scheduledEndTime);
        
        // Check if operation overlaps with unavailability period
        if (this.dateRangesOverlap(
          opStart, opEnd,
          request.unavailabilityStart, request.unavailabilityEnd
        )) {
          // Check if this operation requires an affected resource
          if (await this.isRoutingOperationAffected(routingOp, request)) {
            const conflict: ScheduleConflict = {
              id: `routing_conflict_${routingOp.id}`,
              type: 'resource_unavailable',
              severity: this.calculateOperationConflictSeverity(routingOp),
              jobId: routingOp.jobId,
              operationId: routingOp.id,
              resourceId: routingOp.assignedResourceId || undefined,
              machineId: routingOp.assignedMachineId || undefined,
              conflictStart: new Date(Math.max(opStart.getTime(), request.unavailabilityStart.getTime())),
              conflictEnd: new Date(Math.min(opEnd.getTime(), request.unavailabilityEnd.getTime())),
              impact: `Operation ${routingOp.operationName} cannot be completed`,
              suggestedActions: ['Reschedule operation', 'Find alternative resource', 'Use substitute machine']
            };
            
            conflicts.push(conflict);
          }
        }
      }
    }

    return conflicts;
  }

  /**
   * Create a comprehensive reschedule plan
   */
  private async createReschedulePlan(
    conflicts: ScheduleConflict[], 
    request: RescheduleRequest
  ): Promise<RescheduleOperation[]> {
    const operations: RescheduleOperation[] = [];
    
    // Group conflicts by job to handle routing dependencies
    const conflictsByJob = new Map<string, ScheduleConflict[]>();
    conflicts.forEach(conflict => {
      if (!conflictsByJob.has(conflict.jobId)) {
        conflictsByJob.set(conflict.jobId, []);
      }
      conflictsByJob.get(conflict.jobId)!.push(conflict);
    });

    // Process each affected job
    for (const [jobId, jobConflicts] of conflictsByJob) {
      const job = await this.storage.getJob(jobId);
      if (!job) continue;

      const jobOperations = await this.storage.getRoutingOperationsByJobId(jobId);
      
      // Create reschedule operations for this job
      const jobRescheduleOps = await this.createJobRescheduleOperations(
        job, 
        jobOperations, 
        jobConflicts, 
        request
      );
      
      operations.push(...jobRescheduleOps);
    }

    return operations;
  }

  /**
   * Execute the rescheduling plan
   */
  private async executeReschedulePlan(
    operations: RescheduleOperation[], 
    request: RescheduleRequest
  ): Promise<RescheduleResult> {
    let conflictsResolved = 0;
    let jobsRescheduled = 0;
    let operationsRescheduled = 0;
    const unresolvableConflicts: ScheduleConflict[] = [];
    const warnings: string[] = [];
    const rescheduledJobs = new Set<string>();

    for (const operation of operations) {
      try {
        switch (operation.type) {
          case 'reschedule_operation':
            await this.rescheduleOperation(operation);
            operationsRescheduled++;
            rescheduledJobs.add(operation.jobId);
            break;
            
          case 'reschedule_schedule_entry':
            await this.rescheduleScheduleEntry(operation);
            conflictsResolved++;
            rescheduledJobs.add(operation.jobId);
            break;
            
          case 'find_alternative_resource':
            const alternativeFound = await this.findAlternativeResource(operation);
            if (alternativeFound) {
              conflictsResolved++;
              rescheduledJobs.add(operation.jobId);
            } else {
              warnings.push(`Could not find alternative resource for ${operation.operationName}`);
            }
            break;
            
          case 'substitute_machine':
            const substituteFound = await this.substituteMachine(operation);
            if (substituteFound) {
              conflictsResolved++;
              rescheduledJobs.add(operation.jobId);
            } else {
              warnings.push(`Could not find substitute machine for ${operation.operationName}`);
            }
            break;
        }
      } catch (error) {
        warnings.push(`Failed to execute ${operation.type}: ${error.message}`);
        if (operation.conflict) {
          unresolvableConflicts.push(operation.conflict);
        }
      }
    }

    jobsRescheduled = rescheduledJobs.size;

    return {
      success: unresolvableConflicts.length === 0,
      conflictsResolved,
      jobsRescheduled,
      operationsRescheduled,
      unresolvableConflicts,
      warnings,
      summary: `Rescheduling completed: ${conflictsResolved} conflicts resolved, ${jobsRescheduled} jobs affected, ${operationsRescheduled} operations rescheduled.`
    };
  }

  // Helper methods for conflict detection and resolution
  private async isScheduleEntryAffected(entry: ScheduleEntry, request: RescheduleRequest): Promise<boolean> {
    // Check if the machine requires an affected resource
    if (request.affectedResourceIds && request.affectedResourceIds.length > 0) {
      const machine = await this.storage.getMachine(entry.machineId);
      if (machine) {
        // Check if any affected resource can operate this machine
        for (const resourceId of request.affectedResourceIds) {
          const resource = await this.storage.getResource(resourceId);
          if (resource && resource.workCenters.includes(machine.machineId)) {
            // Check if the shifts match
            if (request.shifts.includes(entry.shift)) {
              return true;
            }
          }
        }
      }
    }

    // Check if the machine itself is affected
    if (request.affectedMachineIds && request.affectedMachineIds.includes(entry.machineId)) {
      return request.shifts.includes(entry.shift);
    }

    return false;
  }

  private async isRoutingOperationAffected(operation: RoutingOperation, request: RescheduleRequest): Promise<boolean> {
    // Check if assigned resource is affected
    if (operation.assignedResourceId && request.affectedResourceIds?.includes(operation.assignedResourceId)) {
      return true;
    }

    // Check if assigned machine is affected
    if (operation.assignedMachineId && request.affectedMachineIds?.includes(operation.assignedMachineId)) {
      return true;
    }

    // Check if operation requires skills from affected resources
    if (request.affectedResourceIds && operation.requiredSkills.length > 0) {
      for (const resourceId of request.affectedResourceIds) {
        const resource = await this.storage.getResource(resourceId);
        if (resource && operation.requiredSkills.some(skill => resource.skills.includes(skill))) {
          return true;
        }
      }
    }

    return false;
  }

  private calculateConflictSeverity(entry: ScheduleEntry): 'low' | 'medium' | 'high' | 'critical' {
    const now = new Date();
    const entryStart = new Date(entry.startTime);
    const hoursUntilStart = (entryStart.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilStart <= 8) return 'critical';
    if (hoursUntilStart <= 24) return 'high';
    if (hoursUntilStart <= 72) return 'medium';
    return 'low';
  }

  private calculateOperationConflictSeverity(operation: RoutingOperation): 'low' | 'medium' | 'high' | 'critical' {
    const now = new Date();
    
    if (operation.scheduledStartTime) {
      const opStart = new Date(operation.scheduledStartTime);
      const hoursUntilStart = (opStart.getTime() - now.getTime()) / (1000 * 60 * 60);

      if (hoursUntilStart <= 8) return 'critical';
      if (hoursUntilStart <= 24) return 'high';
      if (hoursUntilStart <= 72) return 'medium';
    }

    // Check due date constraints
    if (operation.latestFinishDate) {
      const dueDate = new Date(operation.latestFinishDate);
      const hoursUntilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);
      
      if (hoursUntilDue <= 48) return 'critical';
      if (hoursUntilDue <= 168) return 'high'; // 1 week
    }

    return 'low';
  }

  private dateRangesOverlap(start1: Date, end1: Date, start2: Date, end2: Date): boolean {
    return start1 < end2 && start2 < end1;
  }

  // Placeholder methods for reschedule operations - to be implemented
  private async createJobRescheduleOperations(
    job: Job, 
    operations: RoutingOperation[], 
    conflicts: ScheduleConflict[], 
    request: RescheduleRequest
  ): Promise<RescheduleOperation[]> {
    // Implementation will create specific reschedule operations for the job
    return [];
  }

  private async rescheduleOperation(operation: RescheduleOperation): Promise<void> {
    // Implementation will reschedule the specific operation
  }

  private async rescheduleScheduleEntry(operation: RescheduleOperation): Promise<void> {
    // Implementation will reschedule the schedule entry
  }

  private async findAlternativeResource(operation: RescheduleOperation): Promise<boolean> {
    // Implementation will find alternative resources
    return false;
  }

  private async substituteMachine(operation: RescheduleOperation): Promise<boolean> {
    // Implementation will substitute machines
    return false;
  }
}

// Types for internal reschedule operations
interface RescheduleOperation {
  type: 'reschedule_operation' | 'reschedule_schedule_entry' | 'find_alternative_resource' | 'substitute_machine';
  jobId: string;
  operationId?: string;
  scheduleEntryId?: string;
  operationName?: string;
  conflict?: ScheduleConflict;
  newStartTime?: Date;
  newEndTime?: Date;
  newResourceId?: string;
  newMachineId?: string;
}