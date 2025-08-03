import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { barFeederService } from "./bar-feeder-service";
import { ReschedulingService } from "./rescheduling-service";
import { insertJobSchema, insertMachineSchema, insertScheduleEntrySchema, insertAlertSchema, insertMaterialOrderSchema, insertOutsourcedOperationSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

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
      res.json(jobs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch jobs" });
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
      const result = await storage.scheduleAllJobs();
      broadcast({ type: 'all_jobs_scheduled', data: result });
      res.json(result);
    } catch (error) {
      console.error('Error scheduling all jobs:', error);
      res.status(500).json({ message: "Failed to schedule all jobs" });
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
      const scheduleEntries = await storage.autoScheduleJob(req.params.id);
      if (!scheduleEntries) {
        return res.status(400).json({ message: "Unable to auto-schedule job" });
      }
      broadcast({ type: 'job_auto_scheduled', data: { jobId: req.params.id, scheduleEntries } });
      res.json({ scheduleEntries, message: "Job successfully auto-scheduled" });
    } catch (error) {
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

  return httpServer;
}
