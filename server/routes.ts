import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertJobSchema, insertMachineSchema, insertScheduleEntrySchema, insertAlertSchema } from "@shared/schema";
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
      const jobData = insertJobSchema.parse(req.body);
      const job = await storage.createJob(jobData);
      broadcast({ type: 'job_created', data: job });
      res.status(201).json(job);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid job data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create job" });
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

  // Alerts endpoints
  app.get("/api/alerts", async (req, res) => {
    try {
      const alerts = await storage.getAlerts();
      res.json(alerts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch alerts" });
    }
  });

  app.post("/api/alerts", async (req, res) => {
    try {
      const alertData = insertAlertSchema.parse(req.body);
      const alert = await storage.createAlert(alertData);
      broadcast({ type: 'alert_created', data: alert });
      res.status(201).json(alert);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid alert data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create alert" });
    }
  });

  app.put("/api/alerts/:id/read", async (req, res) => {
    try {
      const success = await storage.markAlertAsRead(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Alert not found" });
      }
      broadcast({ type: 'alert_read', data: { id: req.params.id } });
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to mark alert as read" });
    }
  });

  app.delete("/api/alerts/:id", async (req, res) => {
    try {
      const success = await storage.deleteAlert(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Alert not found" });
      }
      broadcast({ type: 'alert_deleted', data: { id: req.params.id } });
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete alert" });
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

  return httpServer;
}
