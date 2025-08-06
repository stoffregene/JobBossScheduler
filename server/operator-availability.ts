import type { Resource, ResourceUnavailability } from '../shared/schema';

/**
 * Year-round operator availability system for scheduling algorithm
 * This module provides utilities to check operator availability for any date throughout the year
 */

interface WorkTime {
  type: 'working' | 'unavailable' | 'off';
  startTime?: string;
  endTime?: string;
  reason?: string;
  isPartialDay?: boolean;
}

interface OperatorScheduleEntry {
  operatorId: string;
  date: Date;
  workTime: WorkTime;
  shiftNumber?: number;
}

export class OperatorAvailabilityManager {
  private resources: Resource[] = [];
  private unavailabilityEntries: ResourceUnavailability[] = [];

  constructor(resources: Resource[], unavailabilityEntries: ResourceUnavailability[]) {
    console.log(`🔧 OperatorAvailabilityManager: Initializing with ${resources?.length || 0} resources and ${unavailabilityEntries?.length || 0} unavailability entries`);
    this.resources = resources || [];
    this.unavailabilityEntries = unavailabilityEntries || [];
    
    if (this.resources.length === 0) {
      console.warn('⚠️ Warning: OperatorAvailabilityManager initialized with no resources');
    }
  }

  /**
   * Check if an operator is available to work on a specific date and time
   * This is the main function used by the scheduling algorithm
   */
  isOperatorAvailable(operatorId: string, targetDate: Date, shift?: number): boolean {
    const operator = this.resources.find(r => r.id === operatorId);
    if (!operator || !operator.isActive) {
      return false;
    }

    const workTime = this.getOperatorWorkTime(operator, targetDate);
    
    // If operator is unavailable, they cannot work
    if (workTime.type === 'unavailable') {
      return false;
    }

    // If operator is off, they cannot work
    if (workTime.type === 'off') {
      return false;
    }

    // If shift is specified, check if operator works that shift
    if (shift && !operator.shiftSchedule?.includes(shift)) {
      return false;
    }

    return workTime.type === 'working';
  }

  /**
   * Get all available operators for a specific date, time, and shift
   * Used by scheduling algorithm to find qualified operators
   */
  getAvailableOperators(
    targetDate: Date, 
    shift: number, 
    requiredRole?: string,
    requiredWorkCenters?: string[]
  ): Resource[] {
    return this.resources.filter(operator => {
      // Basic checks
      if (!operator.isActive) return false;
      if (!operator.shiftSchedule?.includes(shift)) return false;

      // Role check
      if (requiredRole && operator.role !== requiredRole) return false;

      // Work center compatibility check
      if (requiredWorkCenters && requiredWorkCenters.length > 0) {
        const hasCompatibleWorkCenter = requiredWorkCenters.some(wc => 
          operator.workCenters?.includes(wc)
        );
        if (!hasCompatibleWorkCenter) return false;
      }

      // Availability check
      return this.isOperatorAvailable(operator.id, targetDate, shift);
    });
  }

  /**
   * Get operator's work schedule for a specific date
   * This function handles the complex logic of checking unavailability, custom schedules, etc.
   */
  getOperatorWorkTime(operator: Resource, targetDate: Date): WorkTime {
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayNames[targetDate.getDay()] as keyof Resource['workSchedule'];
    
    // Check for unavailability on this date
    const dayStart = new Date(targetDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(targetDate);
    dayEnd.setHours(23, 59, 59, 999);

    const unavailable = this.unavailabilityEntries.find(entry => {
      const entryStart = new Date(entry.startDate);
      const entryEnd = new Date(entry.endDate);
      return entry.resourceId === operator.id && 
             entryStart <= dayEnd && 
             entryEnd >= dayStart;
    });

    if (unavailable) {
      return {
        type: 'unavailable',
        reason: unavailable.reason,
        isPartialDay: unavailable.isPartialDay,
        startTime: unavailable.startTime,
        endTime: unavailable.endTime,
      };
    }

    // Check custom schedule for this day of the week
    const schedule = operator.workSchedule?.[dayName];
    if (schedule?.enabled && schedule.startTime && schedule.endTime) {
      return {
        type: 'working',
        startTime: schedule.startTime,
        endTime: schedule.endTime,
      };
    }

    // If no custom schedule for this day, operator is off
    return { type: 'off' };
  }

  /**
   * Get operator's working hours for a specific date
   * Returns the actual start and end times when the operator works
   */
  getOperatorWorkingHours(operatorId: string, targetDate: Date): { startTime: Date; endTime: Date } | null {
    const operator = this.resources.find(r => r.id === operatorId);
    if (!operator) return null;

    const workTime = this.getOperatorWorkTime(operator, targetDate);
    
    if (workTime.type !== 'working' || !workTime.startTime || !workTime.endTime) {
      return null;
    }

    const startParts = workTime.startTime.split(':').map(Number);
    const endParts = workTime.endTime.split(':').map(Number);

    const startTime = new Date(targetDate);
    startTime.setHours(startParts[0], startParts[1], 0, 0);

    const endTime = new Date(targetDate);
    endTime.setHours(endParts[0], endParts[1], 0, 0);

    // Handle cross-day shifts (e.g., 3 PM to 3 AM next day)
    if (endTime <= startTime) {
      endTime.setDate(endTime.getDate() + 1);
    }

    return { startTime, endTime };
  }

  /**
   * Check if operator is available during a specific time window
   * Used by scheduling algorithm to prevent double-booking
   */
  isOperatorAvailableInTimeWindow(
    operatorId: string, 
    windowStart: Date, 
    windowEnd: Date
  ): boolean {
    const operator = this.resources.find(r => r.id === operatorId);
    if (!operator) return false;

    // Check each day in the time window
    const currentDate = new Date(windowStart);
    while (currentDate <= windowEnd) {
      // Reset time to start of day for availability check
      const checkDate = new Date(currentDate);
      checkDate.setHours(0, 0, 0, 0);
      
      const workingHours = this.getOperatorWorkingHours(operatorId, checkDate);
      
      if (workingHours) {
        // Check if the working hours overlap with the window
        const overlapStart = new Date(Math.max(windowStart.getTime(), workingHours.startTime.getTime()));
        const overlapEnd = new Date(Math.min(windowEnd.getTime(), workingHours.endTime.getTime()));
        
        // If there's an overlap, check if operator is available
        if (overlapStart < overlapEnd) {
          if (!this.isOperatorAvailable(operatorId, checkDate)) {
            return false;
          }
        }
      }

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return true;
  }

  /**
   * Get operator schedule for a date range
   * Used for advanced scheduling and UI display
   */
  getOperatorScheduleForRange(
    operatorId: string,
    startDate: Date,
    endDate: Date
  ): OperatorScheduleEntry[] {
    const operator = this.resources.find(r => r.id === operatorId);
    if (!operator) return [];

    const schedule: OperatorScheduleEntry[] = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const workTime = this.getOperatorWorkTime(operator, currentDate);
      
      schedule.push({
        operatorId: operator.id,
        date: new Date(currentDate),
        workTime,
        shiftNumber: operator.shiftSchedule?.[0] // Primary shift
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return schedule;
  }

  /**
   * Update the cached resources and unavailability data
   * Called when the data changes
   */
  updateData(resources: Resource[], unavailabilityEntries: ResourceUnavailability[]) {
    console.log(`🔄 OperatorAvailabilityManager: Updating data with ${resources?.length || 0} resources and ${unavailabilityEntries?.length || 0} unavailability entries`);
    this.resources = resources || [];
    this.unavailabilityEntries = unavailabilityEntries || [];
  }

  /**
   * Get next available working day for an operator after a given date
   * Used by scheduling algorithm to find the next possible start date
   */
  getNextAvailableWorkingDay(operatorId: string, afterDate: Date): Date | null {
    const maxDaysToCheck = 365; // Don't search more than a year ahead
    const currentDate = new Date(afterDate);
    currentDate.setDate(currentDate.getDate() + 1); // Start from day after

    for (let i = 0; i < maxDaysToCheck; i++) {
      if (this.isOperatorAvailable(operatorId, currentDate)) {
        return new Date(currentDate);
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return null; // No available day found within a year
  }

  /**
   * Calculate total available working hours for an operator in a date range
   * Used for capacity planning and workload analysis
   */
  calculateAvailableHours(operatorId: string, startDate: Date, endDate: Date): number {
    let totalHours = 0;
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const workingHours = this.getOperatorWorkingHours(operatorId, currentDate);
      
      if (workingHours && this.isOperatorAvailable(operatorId, currentDate)) {
        const hoursWorked = (workingHours.endTime.getTime() - workingHours.startTime.getTime()) / (1000 * 60 * 60);
        totalHours += hoursWorked;
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return totalHours;
  }
}

/**
 * Utility function to create an OperatorAvailabilityManager instance
 * This will be used throughout the scheduling algorithm
 */
export async function createOperatorAvailabilityManager(
  resources: Resource[],
  unavailabilityEntries: ResourceUnavailability[]
): Promise<OperatorAvailabilityManager> {
  console.log(`🏗️ Creating OperatorAvailabilityManager with ${resources?.length || 0} resources and ${unavailabilityEntries?.length || 0} unavailability entries`);
  return new OperatorAvailabilityManager(resources, unavailabilityEntries);
}