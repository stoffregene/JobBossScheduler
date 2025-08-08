/**
 * @file shift-capacity-manager.ts
 * @description Calculates shift capacity and load to enable intelligent load balancing.
 */
import { Resource, ScheduleEntry } from "@shared/schema";

interface ShiftMetrics {
  totalEffectiveCapacity: number;
  currentLoad: number;
  loadPercentage: number;
}

export class ShiftCapacityManager {
  private resources: Resource[];
  private scheduleEntries: ScheduleEntry[];
  private readonly SHIFT_1_EFFICIENCY = 0.825;
  private readonly SHIFT_2_EFFICIENCY = 0.605;
  private readonly HOURS_PER_WEEK = 40;

  constructor(resources: Resource[], scheduleEntries: ScheduleEntry[]) {
    this.resources = resources;
    this.scheduleEntries = scheduleEntries;
  }

  private getShiftMetrics(): { shift1: ShiftMetrics, shift2: ShiftMetrics } {
    const shift1Resources = this.resources.filter(r => r.shiftSchedule.includes(1));
    const shift2Resources = this.resources.filter(r => r.shiftSchedule.includes(2));

    const totalCapacity1 = shift1Resources.length * this.HOURS_PER_WEEK * this.SHIFT_1_EFFICIENCY;
    const totalCapacity2 = shift2Resources.length * this.HOURS_PER_WEEK * this.SHIFT_2_EFFICIENCY;

    const load1 = this.scheduleEntries
      .filter(e => e.shift === 1)
      .reduce((sum, e) => sum + (e.endTime.getTime() - e.startTime.getTime()) / 3600000, 0);

    const load2 = this.scheduleEntries
      .filter(e => e.shift === 2)
      .reduce((sum, e) => sum + (e.endTime.getTime() - e.startTime.getTime()) / 3600000, 0);

    return {
      shift1: {
        totalEffectiveCapacity: totalCapacity1,
        currentLoad: load1,
        loadPercentage: totalCapacity1 > 0 ? (load1 / totalCapacity1) * 100 : 100,
      },
      shift2: {
        totalEffectiveCapacity: totalCapacity2,
        currentLoad: load2,
        loadPercentage: totalCapacity2 > 0 ? (load2 / totalCapacity2) * 100 : 100,
      }
    };
  }

  public getOptimalShift(): 1 | 2 {
    const metrics = this.getShiftMetrics();
    if (metrics.shift1.loadPercentage <= metrics.shift2.loadPercentage) {
      return 1;
    }
    return 2;
  }

  public addEntries(newEntries: ScheduleEntry[]) {
    this.scheduleEntries.push(...newEntries);
  }
}