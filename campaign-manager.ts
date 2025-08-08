/**
 * @file campaign-manager.ts
 * @description Handles the logic for batching outsourced operations into efficient shipping campaigns.
 */
import { Job, OutsourcedOperation } from "@shared/schema";
import { IStorage } from "./storage-interface";
import { SchedulingLogger } from "./scheduling-logger";
import { subDays } from 'date-fns';

export interface Campaign {
  campaignId: string;
  vendor: string;
  operationDescription: string;
  jobs: Job[];
  shipDate: Date;
}

export class CampaignManager {
  private storage: IStorage;
  private logger: SchedulingLogger;
  private readonly INTERNAL_SHIPPING_BUFFER_DAYS = 7;

  constructor(storage: IStorage, logger: SchedulingLogger) {
    this.storage = storage;
    this.logger = logger;
  }

  public async createShippingCampaigns(jobs: Job[], outsourcedOps: OutsourcedOperation[]): Promise<Campaign[]> {
    const campaigns: Campaign[] = [];
    const remainingCandidates = new Set(jobs.filter(job => this.isBatchCandidate(job, outsourcedOps)));

    for (const job of remainingCandidates) {
      if (!remainingCandidates.has(job)) continue;

      const finalOp = this.getFinalOutsourcedOp(job.id, outsourcedOps);
      if (!finalOp) continue;

      const lastSafeShipDate = this.calculateLastSafeShipDate(job, finalOp);
      if (!lastSafeShipDate) continue;

      const newCampaign: Campaign = {
        campaignId: `CAMP-${finalOp.vendor}-${Date.now()}`,
        vendor: finalOp.vendor,
        operationDescription: finalOp.operationDescription,
        jobs: [job],
        shipDate: lastSafeShipDate,
      };
      remainingCandidates.delete(job);

      for (const otherJob of remainingCandidates) {
        const otherFinalOp = this.getFinalOutsourcedOp(otherJob.id, outsourcedOps);
        if (otherFinalOp?.vendor === newCampaign.vendor && otherFinalOp?.operationDescription === newCampaign.operationDescription) {
          const otherLastSafeShipDate = this.calculateLastSafeShipDate(otherJob, otherFinalOp);
          if (otherLastSafeShipDate && otherLastSafeShipDate >= newCampaign.shipDate) {
            newCampaign.jobs.push(otherJob);
            remainingCandidates.delete(otherJob);
          }
        }
      }
      
      this.logger.addEntry(job.id, 'INFO', `Created campaign ${newCampaign.campaignId} with ${newCampaign.jobs.length} jobs.`, newCampaign);
      campaigns.push(newCampaign);
    }
    return campaigns;
  }

  private isBatchCandidate = (job: Job, ops: OutsourcedOperation[]) => !!this.getFinalOutsourcedOp(job.id, ops);
  private getFinalOutsourcedOp = (jobId: string, ops: OutsourcedOperation[]) => ops.filter(op => op.jobId === jobId).sort((a, b) => b.operationSequence - a.operationSequence)[0];

  private calculateLastSafeShipDate(job: Job, finalOp: OutsourcedOperation): Date | null {
    const promisedDate = new Date(job.promisedDate);
    const leadTimeDays = finalOp.dueDate ? Math.ceil((finalOp.dueDate.getTime() - finalOp.orderDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;
    if (leadTimeDays <= 0) return null;
    let shipDate = subDays(promisedDate, leadTimeDays);
    shipDate = subDays(shipDate, this.INTERNAL_SHIPPING_BUFFER_DAYS);
    return shipDate;
  }
}