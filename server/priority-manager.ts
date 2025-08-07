/**
 * @file priority-manager.ts
 * @description Centralizes the business logic for calculating a job's scheduling priority.
 */
import { Job } from "@shared/schema";
import { addDays, differenceInDays } from 'date-fns';
import { SchedulingLogger } from "./scheduling-logger";

enum PriorityScore {
  LATE_TO_CUSTOMER = 500,
  LATE_TO_US = 400,
  NEARING_SHIP_DATE = 300,
  NORMAL = 200,
  STOCK = 100,
}

export class PriorityManager {
  private logger: SchedulingLogger;

  constructor(logger: SchedulingLogger) { this.logger = logger; }

  public getJobPriorityScore(job: Job): number {
    const now = new Date();
    const promisedDate = new Date(job.promisedDate);

    if (job.jobNumber.toUpperCase().startsWith('S')) {
      this.logger.addEntry(job.id, 'DEBUG', `Priority determined by rule: STOCK`);
      return PriorityScore.STOCK;
    }
    if (now > promisedDate) {
      this.logger.addEntry(job.id, 'DEBUG', `Priority determined by rule: LATE_TO_CUSTOMER`);
      return PriorityScore.LATE_TO_CUSTOMER;
    }
    const internalDueDate = new Date(job.dueDate);
    if (now > internalDueDate) {
        this.logger.addEntry(job.id, 'DEBUG', `Priority determined by rule: LATE_TO_US`);
        return PriorityScore.LATE_TO_US;
    }
    const orderDate = new Date(job.orderDate);
    const optimalShipDate = addDays(orderDate, 21);
    if (differenceInDays(optimalShipDate, now) <= 7) {
        this.logger.addEntry(job.id, 'DEBUG', `Priority determined by rule: NEARING_SHIP_DATE`);
        return PriorityScore.NEARING_SHIP_DATE;
    }
    this.logger.addEntry(job.id, 'DEBUG', `Priority determined by rule: NORMAL (default)`);
    return PriorityScore.NORMAL;
  }

  public getHigherPriorityJob(jobA: Job, jobB: Job): Job | null {
    const scoreA = this.getJobPriorityScore(jobA);
    const scoreB = this.getJobPriorityScore(jobB);
    this.logger.addEntry(jobA.id, 'DEBUG', `Comparing priorities: ${jobA.jobNumber} (Score: ${scoreA}) vs ${jobB.jobNumber} (Score: ${scoreB})`);
    if (scoreA > scoreB) return jobA;
    if (scoreB > scoreA) return jobB;
    const promisedA = new Date(jobA.promisedDate).getTime();
    const promisedB = new Date(jobB.promisedDate).getTime();
    if (promisedA < promisedB) return jobA;
    if (promisedB < promisedA) return jobB;
    return null;
  }
}