import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { barFeederService } from "./bar-feeder-service";
import { ReschedulingService } from "./rescheduling-service";
import { insertJobSchema, insertMachineSchema, insertScheduleEntrySchema, insertAlertSchema, insertMaterialOrderSchema, insertOutsourcedOperationSchema, insertResourceSchema } from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import csv from "csv-parser";
import { Readable } from "stream";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // Configure multer for file uploads
  const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
  });

  // WebSocket server for real-time updates
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  const clients = new Set<WebSocket>();
  
  wss.on('connection', (ws) => {
    clients.add(ws);
    console.log('Client connected to WebSocket');
    
    ws.on('close', () => {
      clients.delete(ws);
      console.log('Client disconnected from WebSocket');
    });
  });
  
  function broadcast(data: any) {
    const message = JSON.stringify(data);
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  // Jobs endpoints
  app.get("/api/jobs", async (req, res) => {
    try {
      const jobs = await storage.getJobs();
      const includeCompleted = req.query.includeCompleted === 'true';
      
      // Filter out completed jobs unless specifically requested
      const filteredJobs = includeCompleted ? jobs : jobs.filter(job => job.status !== 'Complete');
      
      res.json(filteredJobs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch jobs" });
    }
  });

  // Get jobs for scheduling (excludes completed jobs)
  app.get("/api/jobs/for-scheduling", async (req, res) => {
    try {
      const jobs = await storage.getJobs();
      const schedulableJobs = jobs.filter(job => job.status !== 'Complete');
      res.json(schedulableJobs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch schedulable jobs" });
    }
  });

  // Get jobs awaiting material - must be before /:id route
  app.get("/api/jobs/awaiting-material", async (req, res) => {
    try {
      const jobsAwaitingMaterial = await storage.getJobsAwaitingMaterial();
      res.json(jobsAwaitingMaterial);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch jobs awaiting material" });
    }
  });

  app.get("/api/jobs/:id", async (req, res) => {
    try {
      const job = await storage.getJob(req.params.id);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }
      res.json(job);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch job" });
    }
  });

  app.post("/api/jobs", async (req, res) => {
    try {
      // Pre-process dates for validation
      const jobData = {
        ...req.body,
        dueDate: new Date(req.body.dueDate),
        createdDate: new Date()
      };
      
      const job = await storage.createJob(jobData);
      broadcast({ type: 'job_created', data: job });
      res.status(201).json(job);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid job data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create job", error: (error as Error).message });
    }
  });

  app.put("/api/jobs/:id", async (req, res) => {
    try {
      const updates = req.body;
      const job = await storage.updateJob(req.params.id, updates);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }
      broadcast({ type: 'job_updated', data: job });
      res.json(job);
    } catch (error) {
      res.status(500).json({ message: "Failed to update job" });
    }
  });

  app.delete("/api/jobs/:id", async (req, res) => {
    try {
      const success = await storage.deleteJob(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Job not found" });
      }
      broadcast({ type: 'job_deleted', data: { id: req.params.id } });
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete job" });
    }
  });

  app.delete("/api/jobs", async (req, res) => {
    try {
      // Note: deleteAllJobs method is not in interface, implementing basic version
      const jobs = await storage.getJobs();
      let deleteCount = 0;
      for (const job of jobs) {
        const deleted = await storage.deleteJob(job.id);
        if (deleted) deleteCount++;
      }
      broadcast({ type: 'all_jobs_deleted', data: { count: deleteCount } });
      res.json({ message: `Deleted ${deleteCount} jobs`, count: deleteCount });
    } catch (error) {
      console.error('Error deleting all jobs:', error);
      res.status(500).json({ message: "Failed to delete all jobs" });
    }
  });

  app.post("/api/jobs/schedule-all", async (req, res) => {
    try {
      // Note: scheduleAllJobs method is not in interface, implementing basic version
      const jobs = await storage.getJobs();
      const unscheduledJobs = jobs.filter(j => j.status === 'Unscheduled' || j.status === 'Scheduled').filter(j => j.status !== 'Complete');
      let scheduled = 0;
      
      for (const job of unscheduledJobs) {
        try {
          const scheduleEntries = await storage.autoScheduleJob(job.id);
          if (scheduleEntries && scheduleEntries.length > 0) {
            await storage.updateJob(job.id, { status: 'Scheduled' });
            scheduled++;
          }
        } catch (error) {
          console.warn(`Failed to schedule job ${job.jobNumber}:`, error);
        }
      }
      
      const result = { success: true, scheduled, total: unscheduledJobs.length };
      broadcast({ type: 'all_jobs_scheduled', data: result });
      res.json(result);
    } catch (error) {
      console.error('Error scheduling all jobs:', error);
      res.status(500).json({ message: "Failed to schedule all jobs" });
    }
  });

  // CSV Import endpoint for jobs
  app.post("/api/jobs/import", upload.single('csv'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No CSV file provided" });
      }

      const results: any[] = [];
      const errors: string[] = [];
      let processed = 0;
      let created = 0;
      let updated = 0;

      // Define standard work centers that are in-house
      const standardWorkCenters = ['SAW', 'MILL', 'LATHE', 'WATERJET', 'BEAD BLAST', 'WELD', 'INSPECT', 'ASSEMBLE'];
      
      const isStandardWorkCenter = (wcName: string): boolean => {
        return standardWorkCenters.some(wc => wcName.toUpperCase().includes(wc));
      };

      // Parse CSV data
      const readable = Readable.from(req.file.buffer);
      const csvData: any[] = [];

      await new Promise((resolve, reject) => {
        readable
          .pipe(csv())
          .on('data', (data) => csvData.push(data))
          .on('end', resolve)
          .on('error', reject);
      });

      // Debug: Log first few rows to understand structure
      if (csvData.length > 0) {
        console.log('📋 CSV Headers:', Object.keys(csvData[0]));
        console.log('📋 First row sample:', csvData[0]);
        console.log('📋 Second row sample:', csvData[1]);
        
        // Fix BOM issue: clean up headers
        const cleanData = csvData.map(row => {
          const cleanRow: any = {};
          Object.keys(row).forEach(key => {
            // Remove BOM and clean key name
            const cleanKey = key.replace(/^\uFEFF/, '').trim();
            cleanRow[cleanKey] = row[key];
          });
          return cleanRow;
        });
        
        // Replace original data with cleaned data
        csvData.length = 0;
        csvData.push(...cleanData);
        
        console.log('📋 Cleaned CSV Headers:', Object.keys(csvData[0]));
        console.log('📋 Cleaned First row:', csvData[0]);
      }

      // Group CSV rows by job number to handle multiple routing steps
      const jobGroups = new Map();
      
      for (const row of csvData) {
        if (!row.Job || !row.Customer) {
          continue; // Skip empty rows
        }
        
        const jobNumber = row.Job.trim();
        if (!jobGroups.has(jobNumber)) {
          jobGroups.set(jobNumber, []);
        }
        jobGroups.get(jobNumber).push(row);
      }

      // Process each job group
      for (const [jobNumber, jobRows] of jobGroups) {
        processed++;
        
        // Debug: Show job grouping for multi-step jobs
        if (jobRows.length > 1) {
          console.log(`🔍 Job ${jobNumber} has ${jobRows.length} rows:`, jobRows.map(r => `${r['AMT Workcenter & Vendor']}(${r['Est Total Hours']}h)`));
        }
        
        try {
          // Build routing entries from all rows for this job
          const routingEntries = [];
          let totalEstimatedHours = 0;
          let outsourcedVendor = null;
          let linkMaterial = false;
          let material = null;
          
          // Use the first row for job-level data, but collect routing from all rows
          const firstRow = jobRows[0];
          
          // Process each routing step
          jobRows.forEach((row, index) => {
            const amtWorkCenterVendor = row['AMT Workcenter & Vendor']?.trim();
            const vendor = row.Vendor?.trim();
            
            // Determine if this is outsourced work
            const isOutsourced = amtWorkCenterVendor && vendor && amtWorkCenterVendor === vendor;
            const workCenter = amtWorkCenterVendor;
            
            // Track unfound work centers for flagging
            if (!isOutsourced && workCenter && !isStandardWorkCenter(workCenter)) {
              errors.push(`⚠️ Unknown internal work center: "${workCenter}" for job ${jobNumber} - please add this work center to the system`);
            }
            
            // Create routing entry
            const routingEntry = {
              sequence: index + 1,
              name: isOutsourced ? 'OUTSOURCE' : (workCenter || 'GENERAL'),
              machineType: isOutsourced ? 'OUTSOURCE' : (workCenter || 'GENERAL'),
              compatibleMachines: isOutsourced ? ['OUTSOURCE-01'] : [workCenter || 'GENERAL'],
              estimatedHours: parseFloat(row['Est Total Hours']) || 0,
              notes: isOutsourced ? `Outsourced to: ${vendor}` : undefined,
              operationType: isOutsourced ? 'OUTSOURCE' : undefined
            };
            
            routingEntries.push(routingEntry);
            totalEstimatedHours += routingEntry.estimatedHours;
            
            // Capture job-level data
            if (isOutsourced && !outsourcedVendor) {
              outsourcedVendor = vendor;
            }
            
            // Material and linkMaterial logic: use first row or any populated value
            if (!material && row.Material?.trim()) {
              material = row.Material.trim();
            }
            if (!linkMaterial && row.Link_Material?.trim() !== '' && row.Link_Material?.trim() !== null) {
              linkMaterial = true;
            }
          });

          // Map CSV columns to job schema using first row for job data
          const jobData = {
            jobNumber: jobNumber,
            customer: firstRow.Customer?.trim() || 'Unknown',
            quantity: parseInt(firstRow.Est_Required_Qty) || 1,
            partNumber: `PART-${jobNumber}-${processed}`,
            description: `Job ${jobNumber} for ${firstRow.Customer?.trim() || 'Unknown'}`,
            orderDate: new Date(firstRow.Order_Date || Date.now()),
            promisedDate: new Date(firstRow.Promised_Date || Date.now()),
            dueDate: new Date(firstRow.Promised_Date || Date.now()),
            estimatedHours: String(totalEstimatedHours),
            outsourcedVendor: outsourcedVendor,
            leadDays: parseInt(firstRow.Lead_Days) || null,
            linkMaterial: linkMaterial,
            material: material,
            status: firstRow.Status?.trim() === 'Active' ? 'Unscheduled' : 
                   firstRow.Status?.trim() === 'Closed' ? 'Complete' :
                   firstRow.Status?.trim() === 'Canceled' ? 'Complete' : 'Unscheduled',
            priority: 'Normal',
            routing: routingEntries
          };

          // Create valid job data by bypassing schema validation for CSV import
          const validatedJob = {
            ...jobData,
            // Ensure all fields are properly typed
            quantity: jobData.quantity || 1,
            estimatedHours: jobData.estimatedHours, // Already converted to string
            leadDays: jobData.leadDays,
            linkMaterial: Boolean(jobData.linkMaterial)
          };
          
          console.log(`📋 Job ${validatedJob.jobNumber} - Routing Steps: ${validatedJob.routing.length}, Total Hours: ${validatedJob.estimatedHours}, Material: ${validatedJob.material}`);

          // Check if job already exists
          const existingJobs = await storage.getJobs();
          const existingJob = existingJobs.find(j => j.jobNumber === validatedJob.jobNumber);

          if (existingJob) {
            // Update existing job
            await storage.updateJob(existingJob.id, validatedJob);
            updated++;
            
            // If job status changed to Complete, update schedule entries
            if (validatedJob.status === 'Complete' && existingJob.status !== 'Complete') {
              const scheduleEntries = await storage.getScheduleEntries();
              for (const entry of scheduleEntries) {
                if (entry.jobId === existingJob.id && entry.status !== 'Complete') {
                  await storage.updateScheduleEntry(entry.id, { status: 'Complete' });
                }
              }
            }
          } else {
            // Create new job
            await storage.createJob(validatedJob);
            created++;
          }

          // Handle jobs awaiting material
          if (validatedJob.linkMaterial) {
            // Create or update material order if needed
            const materialOrders = await storage.getMaterialOrders();
            
            // Use the job ID from the recently created/updated job
            const targetJobId = existingJob?.id || (await storage.getJobs()).find(j => j.jobNumber === validatedJob.jobNumber)?.id;
            const existingOrder = materialOrders.find(order => order.jobId === targetJobId);
            
            if (!existingOrder && targetJobId) {
              const materialOrderData = {
                jobId: targetJobId,
                orderNumber: `MAT-${validatedJob.jobNumber}`,
                materialDescription: validatedJob.material || 'Material for job',
                quantity: validatedJob.quantity.toString(),
                unit: 'EA',
                supplier: validatedJob.outsourcedVendor || 'TBD',
                orderDate: validatedJob.orderDate,
                dueDate: new Date(validatedJob.orderDate.getTime() + (validatedJob.leadDays || 7) * 24 * 60 * 60 * 1000),
                status: 'Open'
              };
              
              await storage.createMaterialOrder(materialOrderData);
            }
          }

        } catch (error) {
          console.error(`Error processing row ${processed}:`, error);
          errors.push(`Row ${processed}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Broadcast updates
      broadcast({ type: 'jobs_imported', data: { processed, created, updated } });

      res.json({
        success: errors.length === 0,
        processed,
        created,
        updated,
        errors
      });

    } catch (error) {
      console.error('CSV import error:', error);
      res.status(500).json({ 
        message: "Failed to process CSV import",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Machines endpoints
  app.get("/api/machines", async (req, res) => {
    try {
      const machines = await storage.getMachines();
      res.json(machines);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch machines" });
    }
  });

  app.get("/api/machines/:id", async (req, res) => {
    try {
      const machine = await storage.getMachine(req.params.id);
      if (!machine) {
        return res.status(404).json({ message: "Machine not found" });
      }
      res.json(machine);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch machine" });
    }
  });

  app.post("/api/machines", async (req, res) => {
    try {
      const machineData = insertMachineSchema.parse(req.body);
      const machine = await storage.createMachine(machineData);
      broadcast({ type: 'machine_created', data: machine });
      res.status(201).json(machine);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid machine data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create machine" });
    }
  });

  app.put("/api/machines/:id", async (req, res) => {
    try {
      const updates = req.body;
      const machine = await storage.updateMachine(req.params.id, updates);
      if (!machine) {
        return res.status(404).json({ message: "Machine not found" });
      }
      broadcast({ type: 'machine_updated', data: machine });
      res.json(machine);
    } catch (error) {
      res.status(500).json({ message: "Failed to update machine" });
    }
  });

  app.delete("/api/machines/:id", async (req, res) => {
    try {
      await storage.deleteMachine(req.params.id);
      broadcast({ type: 'machine_deleted', data: { id: req.params.id } });
      res.json({ message: "Machine deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete machine" });
    }
  });

  // Schedule endpoints
  app.get("/api/schedule", async (req, res) => {
    try {
      const entries = await storage.getScheduleEntries();
      res.json(entries);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch schedule entries" });
    }
  });

  app.get("/api/schedule/job/:jobId", async (req, res) => {
    try {
      const entries = await storage.getScheduleEntriesForJob(req.params.jobId);
      res.json(entries);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch schedule entries for job" });
    }
  });

  app.get("/api/schedule/machine/:machineId", async (req, res) => {
    try {
      const entries = await storage.getScheduleEntriesForMachine(req.params.machineId);
      res.json(entries);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch schedule entries for machine" });
    }
  });

  app.post("/api/schedule", async (req, res) => {
    try {
      const entryData = insertScheduleEntrySchema.parse(req.body);
      const entry = await storage.createScheduleEntry(entryData);
      broadcast({ type: 'schedule_updated', data: entry });
      res.status(201).json(entry);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid schedule entry data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create schedule entry" });
    }
  });

  app.put("/api/schedule/:id", async (req, res) => {
    try {
      const updates = req.body;
      const entry = await storage.updateScheduleEntry(req.params.id, updates);
      if (!entry) {
        return res.status(404).json({ message: "Schedule entry not found" });
      }
      broadcast({ type: 'schedule_updated', data: entry });
      res.json(entry);
    } catch (error) {
      res.status(500).json({ message: "Failed to update schedule entry" });
    }
  });

  app.delete("/api/schedule/:id", async (req, res) => {
    try {
      const success = await storage.deleteScheduleEntry(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Schedule entry not found" });
      }
      broadcast({ type: 'schedule_entry_deleted', data: { id: req.params.id } });
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete schedule entry" });
    }
  });

  // Machine scheduling and substitution endpoints
  app.get("/api/machines/compatible/:capability", async (req, res) => {
    try {
      const { capability } = req.params;
      const { category, tier } = req.query;
      const machines = await storage.getCompatibleMachines(
        capability,
        category as string,
        (tier as "Tier 1" | "Standard" | "Budget") || "Tier 1"
      );
      res.json(machines);
    } catch (error) {
      res.status(500).json({ message: "Failed to find compatible machines" });
    }
  });

  app.post("/api/jobs/:id/optimize-assignment", async (req, res) => {
    try {
      const job = await storage.getJob(req.params.id);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }
      
      const assignments = await storage.findOptimalMachineAssignment(
        job.routing,
        job.priority as "Critical" | "High" | "Normal" | "Low"
      );
      res.json(assignments);
    } catch (error) {
      res.status(500).json({ message: "Failed to optimize machine assignment" });
    }
  });



  // Dashboard stats endpoint
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // Auto-scheduling endpoints
  app.post("/api/jobs/:id/auto-schedule", async (req, res) => {
    try {
      // Start progress tracking
      broadcast({ 
        type: 'schedule_progress', 
        data: { 
          jobId: req.params.id, 
          progress: 0, 
          status: 'Starting auto-schedule...',
          stage: 'initializing'
        } 
      });

      const scheduleEntries = await storage.autoScheduleJob(req.params.id, (progress) => {
        // Broadcast progress updates via WebSocket
        broadcast({ 
          type: 'schedule_progress', 
          data: { 
            jobId: req.params.id, 
            progress: Math.round(progress.percentage),
            status: progress.status,
            stage: progress.stage,
            operationName: progress.operationName,
            currentOperation: progress.currentOperation,
            totalOperations: progress.totalOperations
          } 
        });
      });

      if (!scheduleEntries) {
        broadcast({ 
          type: 'schedule_progress', 
          data: { 
            jobId: req.params.id, 
            progress: 100, 
            status: 'Failed to schedule job',
            stage: 'error'
          } 
        });
        return res.status(400).json({ message: "Unable to auto-schedule job" });
      }

      // Complete progress
      broadcast({ 
        type: 'schedule_progress', 
        data: { 
          jobId: req.params.id, 
          progress: 100, 
          status: 'Job successfully scheduled!',
          stage: 'completed'
        } 
      });

      broadcast({ type: 'job_auto_scheduled', data: { jobId: req.params.id, scheduleEntries } });
      res.json({ scheduleEntries, message: "Job successfully auto-scheduled" });
    } catch (error) {
      broadcast({ 
        type: 'schedule_progress', 
        data: { 
          jobId: req.params.id, 
          progress: 100, 
          status: 'Error occurred during scheduling',
          stage: 'error'
        } 
      });
      res.status(500).json({ message: "Failed to auto-schedule job" });
    }
  });

  app.get("/api/machines/substitution-groups/:group", async (req, res) => {
    try {
      const machines = await storage.getMachinesBySubstitutionGroup(req.params.group);
      res.json(machines);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch substitution group machines" });
    }
  });

  app.post("/api/operations/find-best-machine", async (req, res) => {
    try {
      const { operation, targetDate, shift } = req.body;
      const result = await storage.findBestMachineForOperation(
        operation, 
        new Date(targetDate), 
        shift
      );
      if (!result) {
        return res.status(404).json({ message: "No suitable machine found" });
      }
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to find best machine" });
    }
  });

  // Resource unavailability and rescheduling endpoints
  const rescheduleRequestSchema = z.object({
    reason: z.string(),
    affectedResourceIds: z.array(z.string()).optional(),
    affectedMachineIds: z.array(z.string()).optional(),
    unavailabilityStart: z.string().transform(str => new Date(str)),
    unavailabilityEnd: z.string().transform(str => new Date(str)),
    shifts: z.array(z.number()),
    forceReschedule: z.boolean(),
    prioritizeJobs: z.array(z.string()).optional(),
  });

  app.post("/api/reschedule/unavailability", async (req, res) => {
    try {
      const request = rescheduleRequestSchema.parse(req.body);
      
      // Create rescheduling service instance
      const reschedulingService = new ReschedulingService(storage);
      
      // Execute rescheduling
      const result = await reschedulingService.rescheduleForUnavailability(request);
      
      // Broadcast rescheduling results to all connected clients
      broadcast({ 
        type: 'reschedule_completed', 
        data: { 
          result,
          reason: request.reason,
          affectedPeriod: {
            start: request.unavailabilityStart,
            end: request.unavailabilityEnd
          }
        } 
      });
      
      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid reschedule request", errors: error.errors });
      }
      console.error('Rescheduling error:', error);
      res.status(500).json({ message: "Failed to process rescheduling request" });
    }
  });

  app.post("/api/resources/:id/mark-unavailable", async (req, res) => {
    try {
      const { startDate, endDate, reason, shifts, notes } = req.body;
      
      const unavailabilityData = {
        resourceId: req.params.id,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        reason,
        shifts: shifts || [1, 2],
        notes,
        createdBy: "system" // In a real app, this would be the current user
      };

      // Create the unavailability record
      const unavailability = await storage.createResourceUnavailability(unavailabilityData);
      
      // Trigger automatic rescheduling
      const rescheduleRequest = {
        reason: `Resource unavailable: ${reason}`,
        affectedResourceIds: [req.params.id],
        unavailabilityStart: new Date(startDate),
        unavailabilityEnd: new Date(endDate),
        shifts: shifts || [1, 2],
        forceReschedule: true
      };

      const reschedulingService = new ReschedulingService(storage);
      const rescheduleResult = await reschedulingService.rescheduleForUnavailability(rescheduleRequest);

      broadcast({ 
        type: 'resource_marked_unavailable', 
        data: { 
          unavailability, 
          rescheduleResult 
        } 
      });

      res.json({ 
        unavailability, 
        rescheduleResult,
        message: "Resource marked unavailable and rescheduling completed" 
      });
    } catch (error) {
      console.error('Mark unavailable error:', error);
      res.status(500).json({ message: "Failed to mark resource unavailable" });
    }
  });

  // Quick action for vacation/absence scenarios
  app.post("/api/resources/bulk-unavailable", async (req, res) => {
    try {
      const { resourceIds, startDate, endDate, reason, shifts, notes } = req.body;
      
      const results = [];
      const allAffectedResourceIds = [];

      // Create unavailability records for all resources
      for (const resourceId of resourceIds) {
        const unavailabilityData = {
          resourceId,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          reason,
          shifts: shifts || [1, 2],
          notes,
          createdBy: "system"
        };

        const unavailability = await storage.createResourceUnavailability(unavailabilityData);
        results.push(unavailability);
        allAffectedResourceIds.push(resourceId);
      }

      // Trigger single comprehensive rescheduling for all affected resources
      const rescheduleRequest = {
        reason: `Multiple resources unavailable: ${reason}`,
        affectedResourceIds: allAffectedResourceIds,
        unavailabilityStart: new Date(startDate),
        unavailabilityEnd: new Date(endDate),
        shifts: shifts || [1, 2],
        forceReschedule: true
      };

      const reschedulingService = new ReschedulingService(storage);
      const rescheduleResult = await reschedulingService.rescheduleForUnavailability(rescheduleRequest);

      broadcast({ 
        type: 'bulk_resources_unavailable', 
        data: { 
          unavailabilities: results, 
          rescheduleResult 
        } 
      });

      res.json({ 
        unavailabilities: results, 
        rescheduleResult,
        message: `${resourceIds.length} resources marked unavailable and rescheduling completed` 
      });
    } catch (error) {
      console.error('Bulk unavailable error:', error);
      res.status(500).json({ message: "Failed to mark resources unavailable" });
    }
  });

  // Resources (people) endpoints
  app.get("/api/resources", async (req, res) => {
    try {
      const resources = await storage.getResources();
      res.json(resources);
    } catch (error) {
      console.error('Failed to fetch resources:', error);
      res.status(500).json({ message: "Failed to fetch resources" });
    }
  });

  app.get("/api/resources/:id", async (req, res) => {
    try {
      const resource = await storage.getResource(req.params.id);
      if (!resource) {
        return res.status(404).json({ message: "Resource not found" });
      }
      res.json(resource);
    } catch (error) {
      console.error('Failed to fetch resource:', error);
      res.status(500).json({ message: "Failed to fetch resource" });
    }
  });

  app.post("/api/resources", async (req, res) => {
    try {
      const resourceData = insertResourceSchema.parse(req.body);
      const resource = await storage.createResource(resourceData);
      
      broadcast({ 
        type: 'resource_created', 
        data: resource 
      });
      
      res.status(201).json(resource);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid resource data", errors: error.errors });
      }
      console.error('Failed to create resource:', error);
      res.status(500).json({ message: "Failed to create resource" });
    }
  });

  app.patch("/api/resources/:id", async (req, res) => {
    try {
      const updates = req.body;
      const resource = await storage.updateResource(req.params.id, updates);
      
      if (!resource) {
        return res.status(404).json({ message: "Resource not found" });
      }
      
      broadcast({ 
        type: 'resource_updated', 
        data: resource 
      });
      
      res.json(resource);
    } catch (error) {
      console.error('Failed to update resource:', error);
      res.status(500).json({ message: "Failed to update resource" });
    }
  });

  app.delete("/api/resources/:id", async (req, res) => {
    try {
      const success = await storage.deleteResource(req.params.id);
      
      if (!success) {
        return res.status(404).json({ message: "Resource not found" });
      }
      
      broadcast({ 
        type: 'resource_deleted', 
        data: { id: req.params.id } 
      });
      
      res.status(204).send();
    } catch (error) {
      console.error('Failed to delete resource:', error);
      res.status(500).json({ message: "Failed to delete resource" });
    }
  });

  // Resource unavailability endpoints
  app.get("/api/resource-unavailability", async (req, res) => {
    try {
      const unavailabilityData = await storage.getResourceUnavailabilities();
      res.json(unavailabilityData);
    } catch (error) {
      console.error('Failed to fetch resource unavailability:', error);
      res.status(500).json({ message: "Failed to fetch resource unavailability data" });
    }
  });

  app.post("/api/resource-unavailability", async (req, res) => {
    try {
      const { resourceIds, startDate, endDate, startTime, endTime, isPartialDay, reason, shifts, notes } = req.body;
      
      // Validate required fields
      if (!resourceIds || resourceIds.length === 0) {
        return res.status(400).json({ message: "At least one resource must be selected" });
      }
      if (!startDate || !endDate) {
        return res.status(400).json({ message: "Start and end dates are required" });
      }
      if (!reason) {
        return res.status(400).json({ message: "Reason is required" });
      }

      // Fix timezone issues by parsing dates as Central Time
      const parseLocalDate = (dateStr: string) => {
        const [year, month, day] = dateStr.split('-').map(Number);
        // Create date in Central Time by using a specific time on that date
        const centralDate = new Date();
        centralDate.setFullYear(year, month - 1, day);
        centralDate.setHours(12, 0, 0, 0); // Set to noon Central to avoid DST edge cases
        return centralDate;
      };

      const parsedStartDate = parseLocalDate(startDate);
      const parsedEndDate = parseLocalDate(endDate);

      // Create unavailability record for each resource
      const createdUnavailabilities: any[] = [];
      for (const resourceId of resourceIds) {
        const unavailabilityData = {
          resourceId: resourceId,
          startDate: parsedStartDate,
          endDate: parsedEndDate,
          startTime: startTime || null,
          endTime: endTime || null,
          isPartialDay: isPartialDay || false,
          reason,
          shifts: shifts || [1, 2],
          notes: notes || "",
          createdBy: "system", // TODO: Replace with actual user ID when auth is implemented
        };
        const created = await storage.createResourceUnavailability(unavailabilityData);
        createdUnavailabilities.push(created);
      }
      
      // Check for affected jobs and reschedule if necessary
      const affectedJobs = await storage.getJobsRequiringRescheduling(
        resourceIds,
        parsedStartDate,
        parsedEndDate,
        shifts
      );

      if (affectedJobs.length > 0) {
        console.log(`Found ${affectedJobs.length} jobs that may need rescheduling due to resource unavailability`);
        // TODO: Implement automatic rescheduling logic here
      }

      // Broadcast changes via WebSocket
      const clients = (req as any).app.locals.wsClients || [];
      clients.forEach((client: any) => {
        if (client.readyState === 1) {
          client.send(JSON.stringify({
            type: 'resource_unavailability_added',
            data: createdUnavailabilities
          }));
        }
      });

      res.json({
        message: "Employee unavailability recorded successfully",
        unavailabilities: createdUnavailabilities,
        affectedJobsCount: affectedJobs.length
      });
    } catch (error) {
      console.error('Failed to create resource unavailability:', error);
      res.status(500).json({ message: "Failed to record employee unavailability" });
    }
  });

  app.delete("/api/resource-unavailability/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteResourceUnavailability(id);
      
      if (success) {
        // Broadcast changes via WebSocket
        const clients = (req as any).app.locals.wsClients || [];
        clients.forEach((client: any) => {
          if (client.readyState === 1) {
            client.send(JSON.stringify({
              type: 'resource_unavailability_removed',
              data: { id }
            }));
          }
        });

        res.json({ message: "Unavailability period removed successfully" });
      } else {
        res.status(404).json({ message: "Unavailability period not found" });
      }
    } catch (error) {
      console.error('Failed to delete resource unavailability:', error);
      res.status(500).json({ message: "Failed to remove unavailability period" });
    }
  });

  // Bar feeder constraint endpoints
  app.post("/api/bar-feeder/analyze-job", async (req, res) => {
    try {
      const { jobRouting, targetMachineId } = req.body;
      const machines = await storage.getMachines();
      const targetMachine = machines.find(m => m.id === targetMachineId);
      
      if (!targetMachine) {
        return res.status(404).json({ message: "Target machine not found" });
      }

      const constraints = barFeederService.analyzeJobRoutingForBarFeeder(
        jobRouting,
        targetMachine,
        machines
      );

      res.json(constraints);
    } catch (error) {
      res.status(500).json({ message: "Failed to analyze bar feeder constraints" });
    }
  });

  app.post("/api/bar-feeder/valid-machines", async (req, res) => {
    try {
      const { jobRouting } = req.body;
      const machines = await storage.getMachines();
      
      const validMachines = barFeederService.getValidBarFedMachines(jobRouting, machines);
      res.json(validMachines);
    } catch (error) {
      res.status(500).json({ message: "Failed to get valid bar fed machines" });
    }
  });

  app.post("/api/bar-feeder/validate-substitution", async (req, res) => {
    try {
      const { originalMachineId, substituteMachineId, jobRouting } = req.body;
      const machines = await storage.getMachines();
      
      const originalMachine = machines.find(m => m.id === originalMachineId);
      const substituteMachine = machines.find(m => m.id === substituteMachineId);
      
      if (!originalMachine || !substituteMachine) {
        return res.status(404).json({ message: "Machine not found" });
      }

      const validation = barFeederService.validateBarFedSubstitution(
        originalMachine,
        substituteMachine,
        jobRouting
      );

      res.json(validation);
    } catch (error) {
      res.status(500).json({ message: "Failed to validate bar feeder substitution" });
    }
  });

  app.get("/api/bar-feeder/machine-info/:machineId", async (req, res) => {
    try {
      const machines = await storage.getMachines();
      const machine = machines.find(m => m.id === req.params.machineId);
      
      if (!machine) {
        return res.status(404).json({ message: "Machine not found" });
      }

      const info = barFeederService.getMachineBarFeederInfo(machine);
      res.json(info);
    } catch (error) {
      res.status(500).json({ message: "Failed to get machine bar feeder info" });
    }
  });

  // Material tracking endpoints
  app.get("/api/materials", async (req, res) => {
    try {
      const materials = await storage.getMaterialOrders();
      res.json(materials);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch material orders" });
    }
  });

  app.get("/api/material-orders", async (req, res) => {
    try {
      const orders = await storage.getMaterialOrders();
      res.json(orders);
    } catch (error) {
      console.error('Error fetching material orders:', error);
      res.status(500).json({ error: 'Failed to fetch material orders' });
    }
  });

  app.post("/api/material-orders", async (req, res) => {
    try {
      // Pre-process dates for validation
      const materialData = {
        ...req.body,
        orderDate: new Date(req.body.orderDate),
        dueDate: new Date(req.body.dueDate),
      };

      const validatedData = insertMaterialOrderSchema.parse(materialData);
      const material = await storage.createMaterialOrder(validatedData);
      broadcast({ type: 'material_order_created', data: material });
      res.status(201).json(material);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid material order data", errors: error.errors });
      }
      console.error('Error creating material order:', error);
      res.status(500).json({ message: "Failed to create material order" });
    }
  });

  app.get("/api/materials/job/:jobId", async (req, res) => {
    try {
      const materials = await storage.getMaterialOrdersForJob(req.params.jobId);
      res.json(materials);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch material orders for job" });
    }
  });

  app.post("/api/materials", async (req, res) => {
    try {
      const materialData = insertMaterialOrderSchema.parse(req.body);
      const material = await storage.createMaterialOrder(materialData);
      broadcast({ type: 'material_order_created', data: material });
      res.status(201).json(material);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid material order data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create material order" });
    }
  });

  app.put("/api/materials/:id", async (req, res) => {
    try {
      const updates = req.body;
      const material = await storage.updateMaterialOrder(req.params.id, updates);
      if (!material) {
        return res.status(404).json({ message: "Material order not found" });
      }
      broadcast({ type: 'material_order_updated', data: material });
      res.json(material);
    } catch (error) {
      res.status(500).json({ message: "Failed to update material order" });
    }
  });

  app.post("/api/materials/:id/receive", async (req, res) => {
    try {
      const material = await storage.markMaterialReceived(req.params.id);
      if (!material) {
        return res.status(404).json({ message: "Material order not found" });
      }
      broadcast({ type: 'material_received', data: material });
      res.json(material);
    } catch (error) {
      res.status(500).json({ message: "Failed to mark material as received" });
    }
  });

  app.get("/api/jobs/:id/readiness", async (req, res) => {
    try {
      const readiness = await storage.isJobReadyForScheduling(req.params.id);
      res.json(readiness);
    } catch (error) {
      res.status(500).json({ message: "Failed to check job readiness" });
    }
  });

  app.post("/api/jobs/:id/schedule-with-material-check", async (req, res) => {
    try {
      const result = await storage.autoScheduleJobWithMaterialCheck(req.params.id);
      if (result.success && result.scheduleEntries) {
        broadcast({ type: 'job_scheduled', data: { jobId: req.params.id, scheduleEntries: result.scheduleEntries } });
      }
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to schedule job with material check" });
    }
  });

  // Efficiency impact endpoint
  app.get('/api/efficiency-impact', async (req, res) => {
    try {
      const efficiencyData = await storage.getEfficiencyImpactData();
      res.json(efficiencyData);
    } catch (error) {
      console.error('Error fetching efficiency data:', error);
      res.status(500).json({ error: 'Failed to fetch efficiency data' });
    }
  });

  return httpServer;
}
