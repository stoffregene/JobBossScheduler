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
import { getWorkCenterPrefixes } from "./utils/workCenterPrefixes";
import { db } from "./db";
import { machines } from "@shared/schema";
import path from "path";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // Health check endpoints
  app.get("/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Root route removed to allow static file serving to handle frontend

  // Database connection test endpoint
  app.get("/api/test-db", async (req, res) => {
    console.log('Test DB endpoint called');
    try {
      // Simple database query to test connection
      const result = await db.select().from(machines).limit(1);
      res.json({ 
        status: "ok", 
        message: "Database connection successful",
        machineCount: result.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Database connection test failed:', error);
      res.status(500).json({ 
        status: "error", 
        message: "Database connection failed",
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Database migration endpoint (POST)
  app.post("/api/migrate-db", async (req, res) => {
    console.log('Migration endpoint called (POST)');
    try {
      console.log('Starting database migration...');
      
      // Execute migration SQL directly
      const fs = await import('fs');
      const migrationPath = path.resolve(process.cwd(), 'drizzle', '0000_initial.sql');
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
      
      // Execute the SQL directly
      await db.execute(migrationSQL);
      
      console.log('Database migration completed successfully');
      res.json({ 
        status: "ok", 
        message: "Database migration completed successfully",
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Database migration failed:', error);
      res.status(500).json({ 
        status: "error", 
        message: "Database migration failed",
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Database migration endpoint (GET) - for easier testing
  app.get("/api/migrate-db", async (req, res) => {
    console.log('Migration endpoint called (GET)');
    try {
      console.log('Starting database migration...');
      
      // Execute migration SQL directly
      const fs = await import('fs');
      const migrationPath = path.resolve(process.cwd(), 'drizzle', '0000_initial.sql');
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
      
      // Execute the SQL directly
      await db.execute(migrationSQL);
      
      console.log('Database migration completed successfully');
      res.json({ 
        status: "ok", 
        message: "Database migration completed successfully",
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Database migration failed:', error);
      res.status(500).json({ 
        status: "error", 
        message: "Database migration failed",
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
  
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
      console.error('Error fetching jobs:', error);
      // Return empty array instead of error to prevent frontend crashes
      res.json([]);
    }
  });

  // Get jobs for scheduling (excludes completed jobs)
  app.get("/api/jobs/for-scheduling", async (req, res) => {
    try {
      const jobs = await storage.getJobs();
      const schedulableJobs = jobs.filter(job => job.status !== 'Complete');
      res.json(schedulableJobs);
    } catch (error) {
      console.error('Error fetching schedulable jobs:', error);
      res.json([]);
    }
  });

  // Jobs awaiting inspection endpoint
  app.get('/api/jobs/awaiting-inspection', async (req, res) => {
    try {
      const allJobs = await storage.getJobs();
      const allOps = await storage.getAllRoutingOperations();
      const allEntries = await storage.getScheduleEntries();

      const inspectionQueue = [];

      for (const job of allJobs) {
        if (job.status !== 'Scheduled' && job.status !== 'In Progress') {
          continue;
        }

        const jobOps = allOps
          .filter(op => op.jobId === job.id)
          .sort((a, b) => a.sequence - b.sequence);
        
        const jobEntries = allEntries
          .filter(e => e.jobId === job.id)
          .sort((a, b) => b.endTime.getTime() - a.endTime.getTime());

        if (jobOps.length === 0) continue;

        const lastCompletedEntry = jobEntries[0];
        if (!lastCompletedEntry) { // Job is scheduled but no ops have started
          const firstOp = jobOps[0];
          if (firstOp.machineType.toUpperCase().includes('INSPECT')) {
            inspectionQueue.push({
              jobId: job.id,
              jobNumber: job.jobNumber,
              partNumber: job.partNumber,
              readyForInspectionTime: new Date(), // Ready now
              previousOp: 'N/A',
            });
          }
          continue;
        }

        const lastCompletedOpSequence = lastCompletedEntry.operationSequence;
        const nextOpIndex = jobOps.findIndex(op => op.sequence > lastCompletedOpSequence);
        
        if (nextOpIndex !== -1) {
          const nextOp = jobOps[nextOpIndex];
          if (nextOp.machineType.toUpperCase().includes('INSPECT')) {
            inspectionQueue.push({
              jobId: job.id,
              jobNumber: job.jobNumber,
              partNumber: job.partNumber,
              readyForInspectionTime: lastCompletedEntry.endTime,
              previousOp: jobOps.find(op => op.sequence === lastCompletedOpSequence)?.operationName || 'Unknown',
            });
          }
        }
      }
      
      res.json(inspectionQueue);
    } catch (error) {
      console.error('Failed to get inspection queue:', error);
      res.status(500).json({ error: 'Failed to fetch data for inspection queue' });
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
      // Use the efficient deleteAllJobs method from database storage
      const deleteCount = await storage.deleteAllJobs();
      broadcast({ type: 'all_jobs_deleted', data: { count: deleteCount } });
      res.json({ message: `Deleted ${deleteCount} jobs`, count: deleteCount });
    } catch (error) {
      console.error('Error deleting all jobs:', error);
      res.status(500).json({ message: "Failed to delete all jobs" });
    }
  });

  app.post("/api/jobs/schedule-all", async (req, res) => {
    try {
      // Get unscheduled jobs
      const jobsToSchedule = (await storage.getJobs()).filter(j => j.status === 'Open' || j.status === 'Unscheduled');

      if (jobsToSchedule.length === 0) {
        return res.json({ success: true, scheduled: 0, failed: 0, message: "No unscheduled jobs to process." });
      }

      // Use the new auto-scheduler system
      const result = await storage.scheduleJobsByPriority(jobsToSchedule.length);
      
      broadcast({ type: 'schedule_updated', data: { scheduled: result.scheduled, failed: result.failed } });
      res.json({
        success: true,
        scheduled: result.scheduled,
        failed: result.failed,
        message: result.scheduled > 0 ? `Successfully scheduled ${result.scheduled} jobs, ${result.failed} failed.` : "No jobs were scheduled."
      });
    } catch (error) {
      console.error('❌ Error in schedule-all:', error);
      res.status(500).json({ success: false, message: "Internal server error during scheduling" });
    }
  });

  // Update job priorities endpoint
  app.post("/api/jobs/update-priorities", async (req, res) => {
    try {
      console.log("📊 Updating priorities for all unscheduled jobs...");
      await storage.updateAllJobPriorities();
      
      const jobs = await storage.getJobs();
      const priorityCounts = jobs.reduce((acc, job) => {
        acc[job.priority] = (acc[job.priority] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      broadcast({ type: 'priorities_updated', data: priorityCounts });
      res.json({ 
        success: true, 
        message: "Job priorities updated",
        priorityCounts 
      });
    } catch (error) {
      console.error('Error updating job priorities:', error);
      res.status(500).json({ message: "Failed to update job priorities" });
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

      // Dynamic list derived from machine_matrix.csv
      const standardWorkCenters = getWorkCenterPrefixes();

      const isStandardWorkCenter = (wc: string) => {
        if (!wc) return false;
        const val = wc.toUpperCase();
        return standardWorkCenters.some(prefix => val.includes(prefix));
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

      // Filter for Active jobs only and group CSV rows by job number
      const jobGroups = new Map<string, any[]>();
      let skippedJobs = 0;
      
      for (const row of csvData) {
        if (!row.Job || !row.Customer) {
          continue; // Skip empty rows
        }
        
        // Skip non-Active jobs for performance
        const status = row.Status?.trim();
        if (status !== 'Active') {
          skippedJobs++;
          continue;
        }
        
        const jobNumber = row.Job.trim();
        if (!jobGroups.has(jobNumber)) {
          jobGroups.set(jobNumber, []);
        }
        jobGroups.get(jobNumber)!.push(row);
      }
      
      console.log(`📋 CSV Processing: Found ${jobGroups.size} Active jobs, skipped ${skippedJobs} non-Active jobs`);

      // Batch process jobs for better performance  
      const jobsToCreate: any[] = [];
      const materialOrdersToCreate: any[] = [];
      
      // Process each job group
      for (const [jobNumber, jobRows] of jobGroups) {
        processed++;
        
        // Debug: Show job grouping for multi-step jobs
        if (jobRows.length > 1) {
          console.log(`🔍 Job ${jobNumber} has ${jobRows.length} rows:`, jobRows.map((r: any) => `${r['AMT Workcenter & Vendor']}(${r['Est Total Hours']}h)`));
        }
        
        try {
          // Build routing entries from all rows for this job
          const routingEntries: any[] = [];
          let totalEstimatedHours = 0;
          let outsourcedVendor: string | null = null;
          let linkMaterial = false;
          let material: string | null = null;
          
          // Use the first row for job-level data, but collect routing from all rows
          const firstRow = jobRows[0];
          
          // Sort rows by Sequence column if available (0-10 order), otherwise use row order
          const sortedRows = jobRows.sort((a, b) => {
            const seqA = parseInt(a.Sequence) || parseInt(a.sequence) || 0;
            const seqB = parseInt(b.Sequence) || parseInt(b.sequence) || 0;
            return seqA - seqB;
          });
          
          // Log sequence sorting for multi-operation jobs
          if (jobRows.length > 1) {
            const hasSequenceColumn = jobRows.some(row => row.Sequence !== undefined || row.sequence !== undefined);
            console.log(`🔄 Job ${jobNumber} - ${hasSequenceColumn ? 'Using CSV Sequence column' : 'Using row order'} for operation ordering`);
          }
          
          // Remove duplicate rows based on unique combinations of sequence, work center, and hours
          const uniqueRows = new Map<string, any>();
          sortedRows.forEach((row: any) => {
            const csvSequence = parseInt(row.Sequence) || parseInt(row.sequence) || 0;
            const workCenter = row['AMT Workcenter & Vendor']?.trim();
            const hours = parseFloat(row['Est Total Hours']) || 0;
            const uniqueKey = `${csvSequence}-${workCenter}-${hours}`;
            
            if (!uniqueRows.has(uniqueKey)) {
              uniqueRows.set(uniqueKey, row);
            }
          });
          
          // Process each unique routing step in proper sequence order
          Array.from(uniqueRows.values()).forEach((row: any, index: number) => {
            const amtWorkCenterVendor = row['AMT Workcenter & Vendor']?.trim();
            const vendor = row.Vendor?.trim();
            
            // Get sequence from CSV (0-10) or use processed index
            const csvSequence = parseInt(row.Sequence) || parseInt(row.sequence);
            const finalSequence = csvSequence !== undefined && !isNaN(csvSequence) ? csvSequence : index;
            
            // Determine if this is outsourced work - only outsourced if vendor exists and work center is NOT a standard work center
            const isOutsourced = vendor && amtWorkCenterVendor && amtWorkCenterVendor === vendor && !isStandardWorkCenter(amtWorkCenterVendor);
            const workCenter = amtWorkCenterVendor;
            
            // Track unfound work centers for flagging
            if (!isOutsourced && workCenter && !isStandardWorkCenter(workCenter)) {
              errors.push(`⚠️ Unknown internal work center: "${workCenter}" for job ${jobNumber} - please add this work center to the system`);
            }
            
            // Create routing entry with proper sequence
            const routingEntry = {
              sequence: finalSequence,
              name: isOutsourced ? 'OUTSOURCE' : (workCenter || 'GENERAL'),
              machineType: isOutsourced ? 'OUTSOURCE' : (workCenter || 'GENERAL'),
              compatibleMachines: isOutsourced ? ['OUTSOURCE-01'] : [workCenter || 'GENERAL'],
              estimatedHours: parseFloat(row['Est Total Hours']) || 0,
              notes: isOutsourced ? `Outsourced to: ${vendor}` : undefined,
              operationType: isOutsourced ? 'OUTSOURCE' : undefined
            };
            
            routingEntries.push(routingEntry);
            totalEstimatedHours += routingEntry.estimatedHours;
            
            // Log sequence information for debugging (only for multi-operation jobs)
            if (uniqueRows.size > 1) {
              console.log(`📋 Job ${jobNumber} - Operation sequence ${finalSequence}: ${workCenter} (${routingEntry.estimatedHours}h)`);
            }
            
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
            description: firstRow['Part Description']?.trim() || `Job ${jobNumber} for ${firstRow.Customer?.trim() || 'Unknown'}`,
            orderDate: new Date(firstRow.Order_Date || Date.now()),
            promisedDate: new Date(firstRow.Promised_Date || Date.now()),
            dueDate: new Date(firstRow.Promised_Date || Date.now()),
            createdDate: new Date(firstRow.Order_Date || Date.now()),
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
            linkMaterial: Boolean(jobData.linkMaterial),
            createdDate: jobData.createdDate // Use Order_Date as created date
          };
          
          // Only log details for jobs with multiple operations or issues
          if (validatedJob.routing.length > 1 || validatedJob.material) {
            console.log(`📋 Job ${validatedJob.jobNumber} - Routing Steps: ${validatedJob.routing.length}, Total Hours: ${validatedJob.estimatedHours}, Material: ${validatedJob.material}`);
          }

          // Add to batch for bulk creation
          jobsToCreate.push(validatedJob);
          created++;

          // Prepare material order if needed
          if (validatedJob.linkMaterial) {
            const materialOrderData = {
              jobNumber: validatedJob.jobNumber, // We'll update jobId after job creation
              orderNumber: `MAT-${validatedJob.jobNumber}`,
              materialDescription: validatedJob.material || 'Material for job',
              quantity: validatedJob.quantity.toString(),
              unit: 'EA',
              supplier: validatedJob.outsourcedVendor || 'TBD',
              orderDate: validatedJob.orderDate,
              dueDate: new Date(validatedJob.orderDate.getTime() + (validatedJob.leadDays || 7) * 24 * 60 * 60 * 1000),
              status: 'Open'
            };
            
            materialOrdersToCreate.push(materialOrderData);
          }

        } catch (error) {
          console.error(`Error processing row ${processed}:`, error);
          errors.push(`Row ${processed}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Bulk create jobs for better performance
      console.log(`📋 Creating ${jobsToCreate.length} jobs in batch...`);
      const startTime = Date.now();
      
      for (const jobData of jobsToCreate) {
        await storage.createJob(jobData);
      }
      
      // Create material orders with correct job IDs
      if (materialOrdersToCreate.length > 0) {
        console.log(`📋 Creating ${materialOrdersToCreate.length} material orders...`);
        const allJobs = await storage.getJobs();
        
        for (const materialOrder of materialOrdersToCreate) {
          const job = allJobs.find(j => j.jobNumber === materialOrder.jobNumber);
          if (job) {
            const { jobNumber, ...orderData } = materialOrder;
            await storage.createMaterialOrder({ ...orderData, jobId: job.id });
          }
        }
      }
      
      const duration = Date.now() - startTime;
      console.log(`📋 Import completed in ${duration}ms: ${created} jobs created, ${skippedJobs} non-Active jobs skipped`);

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
      console.error('Error fetching machines:', error);
      res.json([]);
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

  // Unschedule all jobs - must come BEFORE the parameterized route
  app.delete("/api/schedule/all", async (req, res) => {
    console.log("🔄 ROUTE HIT: DELETE /api/schedule/all");
    try {
      console.log("🗑️ Unscheduling all jobs...");
      
      // Get all schedule entries to know which jobs were affected
      const allSchedules = await storage.getScheduleEntries();
      console.log(`📊 Found ${allSchedules.length} schedule entries to clear`);
      const affectedJobIds = new Set(allSchedules.map(entry => entry.jobId));
      
      // Clear all schedule entries
      console.log("🗑️ Clearing all schedule entries...");
      await storage.clearAllScheduleEntries();
      
      // Verify entries were cleared
      const remainingSchedules = await storage.getScheduleEntries();
      console.log(`📊 Remaining schedule entries after clear: ${remainingSchedules.length}`);
      
      // Reset all job statuses back to "Open" 
      console.log(`🔄 Resetting ${affectedJobIds.size} job statuses to Open...`);
      for (const jobId of Array.from(affectedJobIds)) {
        await storage.updateJob(jobId, { status: "Open" });
      }
      
      // Reset machine utilization to 0
      const machines = await storage.getMachines();
      console.log(`🔄 Resetting ${machines.length} machine utilizations...`);
      for (const machine of machines) {
        await storage.updateMachine(machine.id, { utilization: "0" });
      }
      
      console.log(`✅ Unscheduled ${allSchedules.length} schedule entries for ${affectedJobIds.size} jobs`);
      
      // Broadcast updates
      broadcast({ type: 'schedule_cleared', data: { 
        clearedEntries: allSchedules.length,
        affectedJobs: affectedJobIds.size 
      } });
      
      return res.status(200).json({ 
        message: `Successfully unscheduled ${allSchedules.length} entries for ${affectedJobIds.size} jobs`,
        clearedEntries: allSchedules.length,
        affectedJobs: affectedJobIds.size,
        remainingEntries: remainingSchedules.length
      });
    } catch (error) {
      console.error("❌ Failed to unschedule all jobs:", error);
      return res.status(500).json({ message: "Failed to unschedule all jobs", error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.delete("/api/schedule/:id", async (req, res) => {
    console.log(`🔄 ROUTE HIT: DELETE /api/schedule/${req.params.id}`);
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

      const result = await storage.autoScheduleJob(req.params.id, (progress) => {
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

      if (!result.success) {
        broadcast({ 
          type: 'schedule_progress', 
          data: { 
            jobId: req.params.id, 
            progress: 100, 
            status: `Failed: ${result.failureReason}`,
            stage: 'error',
            failureDetails: result.failureDetails
          } 
        });
        return res.status(400).json({ 
          message: result.failureReason || "Unable to auto-schedule job",
          failureDetails: result.failureDetails 
        });
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

      broadcast({ type: 'job_auto_scheduled', data: { jobId: req.params.id, scheduleEntries: result.scheduleEntries } });
      res.json({ scheduleEntries: result.scheduleEntries, message: "Job successfully auto-scheduled" });
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
      console.error('❌ Critical Error auto-scheduling job:', error);
      console.error('❌ Error details:', error instanceof Error ? error.message : 'Unknown error');
      console.error('❌ Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
      res.status(500).json({ message: "Failed to auto-schedule job", error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Manual schedule job - specific start date for first operation
  app.post("/api/jobs/:id/manual-schedule", async (req, res) => {
    try {
      const { startDate } = req.body;
      
      if (!startDate) {
        return res.status(400).json({ message: "Start date is required for manual scheduling" });
      }

      // Validate that the start date is not in the past
      const startDateTime = new Date(startDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (startDateTime < today) {
        return res.status(400).json({ message: "Cannot schedule jobs in the past" });
      }

      console.log(`📅 Manual scheduling job ${req.params.id} starting ${startDate}`);
      
      const result = await storage.manualScheduleJob(req.params.id, startDate);
      
      if (!result.success) {
        return res.status(400).json({ 
          message: result.failureReason || "Unable to manually schedule job"
        });
      }

      broadcast({ type: 'job_manually_scheduled', data: { jobId: req.params.id, scheduleEntries: result.scheduleEntries } });
      res.json({ scheduleEntries: result.scheduleEntries, message: "Job successfully manually scheduled" });
    } catch (error) {
      console.error('Error manually scheduling job:', error);
      res.status(500).json({ message: "Failed to manually schedule job" });
    }
  });

  // Drag and drop schedule job - specific machine and date
  app.post("/api/jobs/:id/drag-schedule", async (req, res) => {
    try {
      const { machineId, startDate, shift } = req.body;
      
      if (!machineId || !startDate || !shift) {
        return res.status(400).json({ message: "Machine ID, start date, and shift are required for drag scheduling" });
      }

      // Validate that the start date is not in the past
      const startDateTime = new Date(startDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (startDateTime < today) {
        return res.status(400).json({ message: "Cannot schedule jobs in the past" });
      }

      console.log(`🎯 Drag scheduling job ${req.params.id} on machine ${machineId} starting ${startDate} shift ${shift}`);
      
      const result = await storage.dragScheduleJob(req.params.id, machineId, startDate, shift);
      
      if (!result.success) {
        return res.status(400).json({ 
          message: result.failureReason || "Unable to drag schedule job"
        });
      }

      broadcast({ type: 'job_drag_scheduled', data: { jobId: req.params.id, scheduleEntries: result.scheduleEntries } });
      res.json({ scheduleEntries: result.scheduleEntries, message: "Job successfully drag scheduled" });
    } catch (error) {
      console.error('Error drag scheduling job:', error);
      res.status(500).json({ message: "Failed to drag schedule job" });
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
      console.log(`🔧 UPDATING RESOURCE ${req.params.id}:`, JSON.stringify(updates, null, 2));
      const resource = await storage.updateResource(req.params.id, updates);
      
      if (!resource) {
        return res.status(404).json({ message: "Resource not found" });
      }
      
      console.log(`✅ RESOURCE UPDATED:`, JSON.stringify(resource.workSchedule, null, 2));
      
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




  // Operator Availability API routes - Year-round scheduling integration
  app.get("/api/operator-availability/:operatorId/check", async (req, res) => {
    try {
      const { operatorId } = req.params;
      const targetDate = new Date(req.query.date as string);
      const shift = req.query.shift ? parseInt(req.query.shift as string) : undefined;
      
      const isAvailable = await storage.checkOperatorAvailability(operatorId, targetDate, shift);
      res.json({ isAvailable, operatorId, targetDate, shift });
    } catch (error) {
      console.error('Error checking operator availability:', error);
      res.status(500).json({ message: "Failed to check operator availability" });
    }
  });

  app.get("/api/operators/available", async (req, res) => {
    try {
      const targetDate = new Date(req.query.date as string);
      const shift = parseInt(req.query.shift as string);
      const requiredRole = req.query.role as string | undefined;
      const requiredWorkCenters = req.query.workCenters ? 
        (req.query.workCenters as string).split(',') : undefined;
      
      const availableOperators = await storage.getAvailableOperatorsForDate(
        targetDate, 
        shift, 
        requiredRole, 
        requiredWorkCenters
      );
      
      res.json(availableOperators);
    } catch (error) {
      console.error('Error getting available operators:', error);
      res.status(500).json({ message: "Failed to get available operators" });
    }
  });

  app.get("/api/operator-availability/:operatorId/working-hours", async (req, res) => {
    try {
      const { operatorId } = req.params;
      const targetDate = new Date(req.query.date as string);
      
      const workingHours = await storage.getOperatorWorkingHours(operatorId, targetDate);
      res.json(workingHours);
    } catch (error) {
      console.error('Error getting operator working hours:', error);
      res.status(500).json({ message: "Failed to get operator working hours" });
    }
  });

  app.get("/api/operator-availability/:operatorId/next-available", async (req, res) => {
    try {
      const { operatorId } = req.params;
      const afterDate = new Date(req.query.afterDate as string);
      
      const nextAvailableDay = await storage.getOperatorNextAvailableDay(operatorId, afterDate);
      res.json({ nextAvailableDay });
    } catch (error) {
      console.error('Error getting operator next available day:', error);
      res.status(500).json({ message: "Failed to get operator next available day" });
    }
  });

  app.get("/api/operator-availability/:operatorId/schedule", async (req, res) => {
    try {
      const { operatorId } = req.params;
      const startDate = new Date(req.query.startDate as string);
      const endDate = new Date(req.query.endDate as string);
      
      const schedule = await storage.getOperatorScheduleForDateRange(operatorId, startDate, endDate);
      res.json(schedule);
    } catch (error) {
      console.error('Error getting operator schedule:', error);
      res.status(500).json({ message: "Failed to get operator schedule" });
    }
  });

  app.get("/api/operator-availability/:operatorId/available-hours", async (req, res) => {
    try {
      const { operatorId } = req.params;
      const startDate = new Date(req.query.startDate as string);
      const endDate = new Date(req.query.endDate as string);
      
      const availableHours = await storage.calculateOperatorAvailableHours(operatorId, startDate, endDate);
      res.json({ availableHours, operatorId, startDate, endDate });
    } catch (error) {
      console.error('Error calculating operator available hours:', error);
      res.status(500).json({ message: "Failed to calculate operator available hours" });
    }
  });

  // Outsourced Operations endpoints
  app.get("/api/outsourced-operations", async (req, res) => {
    try {
      const operations = await storage.getOutsourcedOperations();
      res.json(operations);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch outsourced operations" });
    }
  });

  // Get outsourced operations with job details and risk assessment for dashboard
  app.get("/api/outsourced-operations/dashboard", async (req, res) => {
    try {
      const operations = await storage.getOutsourcedOperationsForDashboard();
      res.json(operations);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch outsourced operations for dashboard" });
    }
  });

  // Update outsourced operation dates
  app.put("/api/outsourced-operations/:id", async (req, res) => {
    try {
      const { orderDate, dueDate } = req.body;
      
      if (!orderDate || !dueDate) {
        return res.status(400).json({ message: "Order date and due date are required" });
      }

      const updated = await storage.updateOutsourcedOperation(req.params.id, {
        orderDate: new Date(orderDate),
        dueDate: new Date(dueDate)
      });
      
      if (!updated) {
        return res.status(404).json({ message: "Outsourced operation not found" });
      }

      res.json({ message: "Outsourced operation updated successfully", operation: updated });
    } catch (error) {
      console.error('Error updating outsourced operation:', error);
      res.status(500).json({ message: "Failed to update outsourced operation" });
    }
  });

  // Delete outsourced operation
  app.delete("/api/outsourced-operations/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteOutsourcedOperation(req.params.id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Outsourced operation not found" });
      }

      res.json({ message: "Outsourced operation deleted successfully" });
    } catch (error) {
      console.error('Error deleting outsourced operation:', error);
      res.status(500).json({ message: "Failed to delete outsourced operation" });
    }
  });

  return httpServer;
}
