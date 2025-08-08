/**
 * @file scheduling-logger.ts
 * @description A structured logger to provide clear, collapsible, and context-aware
 * logs for the job scheduling process, grouped by Job ID.
 */
import { Job } from "@shared/schema";

type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  details?: any;
}

export class SchedulingLogger {
  private logs = new Map<string, LogEntry[]>();
  private enabled: boolean;

  constructor(enabled = true) { this.enabled = enabled; }

  public startJobLog(jobId: string, jobNumber: string) {
    if (!this.enabled) return;
    this.logs.set(jobId, []);
    this.addEntry(jobId, 'INFO', `--- Starting schedule for Job: ${jobNumber} (ID: ${jobId}) ---`);
  }

  public addEntry(jobId: string, level: LogLevel, message: string, details?: any) {
    if (!this.enabled || !this.logs.has(jobId)) return;
    this.logs.get(jobId)!.push({ level, message, details, timestamp: new Date() });
  }

  public printJobSummary(jobId: string) {
    if (!this.enabled || !this.logs.has(jobId)) return;
    const jobLogs = this.logs.get(jobId)!;
    const jobHeader = jobLogs.find(log => log.message.includes('--- Starting schedule'))?.message || `Summary for Job ID: ${jobId}`;
    console.groupCollapsed(jobHeader);
    jobLogs.forEach(log => {
      console.log(`[${log.level}] ${log.message}`, log.details || '');
    });
    console.groupEnd();
  }
  
  public printFullSummary() {
    if (!this.enabled) return;
    console.log(`\n--- Full Scheduling Run Summary ---`);
    for (const jobId of this.logs.keys()) { this.printJobSummary(jobId); }
  }
}