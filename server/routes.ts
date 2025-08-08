import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { DatabaseStorage } from "./database-storage";

const storage = new DatabaseStorage();
import { barFeederService } from "./bar-feeder-service";
import { ReschedulingService } from "./rescheduling-service";
import { insertJobSchema, insertMachineSchema, insertScheduleEntrySchema, insertAlertSchema, insertMaterialOrderSchema, insertOutsourcedOperationSchema, insertResourceSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // Health check endpoint
  app.get("/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // WebSocket setup
  const wss = new WebSocketServer({ server: httpServer });
  const clients = new Set<WebSocket>();

  function broadcast(message: any) {
    const messageStr = JSON.stringify(message);
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    });
  }

  wss.on('connection', (ws) => {
    console.log('Client connected to WebSocket');
    clients.add(ws);
    
    ws.on('close', () => {
      console.log('Client disconnected from WebSocket');
      clients.delete(ws);
    });
    
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      clients.delete(ws);
    });
  });

  // Jobs endpoints
  app.get("/api/jobs", async (req, res) => {
    try {
      const includeCompleted = req.query.includeCompleted !== 'false';
      const jobs = await storage.getJobs();
      const filteredJobs = includeCompleted ? jobs : jobs.filter(job => job.status !== 'Complete');
      res.json(filteredJobs);
    } catch (error) {
      console.error('Failed to fetch jobs:', error);
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
      console.error('Failed to fetch job:', error);
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
      console.error('Failed to create job:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid job data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create job" });
    }
  });

  app.patch("/api/jobs/:id", async (req, res) => {
    try {
      const job = await storage.updateJob(req.params.id, req.body);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }
      broadcast({ type: 'job_updated', data: job });
      res.json(job);
    } catch (error) {
      console.error('Failed to update job:', error);
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
      console.error('Failed to delete job:', error);
      res.status(500).json({ message: "Failed to delete job" });
    }
  });

  app.delete("/api/jobs", async (req, res) => {
    try {
      await storage.deleteAllJobs();
      broadcast({ type: 'jobs_cleared' });
      res.status(204).send();
    } catch (error) {
      console.error('Failed to delete all jobs:', error);
      res.status(500).json({ message: "Failed to delete all jobs" });
    }
  });

  app.post("/api/jobs/:id/auto-schedule", async (req, res) => {
    try {
      const result = await storage.autoScheduleJob(req.params.id);
      broadcast({ type: 'job_scheduled', data: result });
      res.json(result);
    } catch (error) {
      console.error('Failed to auto-schedule job:', error);
      res.status(500).json({ message: "Failed to auto-schedule job" });
    }
  });

  app.post("/api/jobs/schedule-all", async (req, res) => {
    try {
      const result = await storage.scheduleJobsByPriority();
      broadcast({ type: 'jobs_scheduled', data: result });
      res.json(result);
    } catch (error) {
      console.error('Failed to schedule all jobs:', error);
      res.status(500).json({ message: "Failed to schedule all jobs" });
    }
  });

  app.post("/api/jobs/update-priorities", async (req, res) => {
    try {
      await storage.updateAllJobPriorities();
      broadcast({ type: 'priorities_updated' });
      res.json({ message: "Job priorities updated successfully" });
    } catch (error) {
      console.error('Failed to update job priorities:', error);
      res.status(500).json({ message: "Failed to update job priorities" });
    }
  });

  app.get("/api/jobs/awaiting-material", async (req, res) => {
    try {
      // Get jobs that have material requirements but no material orders
      const jobs = await storage.getJobs();
      const awaitingMaterial = jobs.filter(job => 
        job.linkMaterial && job.material && 
        job.status !== 'Complete' && job.status !== 'Cancelled'
      );
      res.json(awaitingMaterial);
    } catch (error) {
      console.error('Failed to fetch jobs awaiting material:', error);
      res.status(500).json({ message: "Failed to fetch jobs awaiting material" });
    }
  });

  app.delete("/api/jobs/awaiting-material/all", async (req, res) => {
    try {
      // This would be implemented as needed
      res.status(204).send();
    } catch (error) {
      console.error('Failed to delete jobs awaiting material:', error);
      res.status(500).json({ message: "Failed to delete jobs awaiting material" });
    }
  });

  app.get("/api/jobs/awaiting-inspection", async (req, res) => {
    try {
      // Get routing operations that are ready for inspection
      const operations = await storage.getAllRoutingOperations();
      const inspectionOperations = operations.filter(op => 
        op.status === 'Complete' && 
        op.operationName?.toLowerCase().includes('inspect')
      );
      res.json(inspectionOperations);
    } catch (error) {
      console.error('Failed to fetch jobs awaiting inspection:', error);
      res.status(500).json({ error: "Failed to fetch data" });
    }
  });

  app.post("/api/jobs/import", async (req, res) => {
    try {
      // Implement job import logic here
      const importedJobs = [];
      for (const jobData of req.body) {
        try {
          const job = await storage.createJob(jobData);
          importedJobs.push(job);
        } catch (error) {
          console.error('Failed to import job:', jobData, error);
        }
      }
      broadcast({ type: 'jobs_imported', data: { imported: importedJobs.length } });
      res.json({ imported: importedJobs.length, jobs: importedJobs });
    } catch (error) {
      console.error('Failed to import jobs:', error);
      res.status(500).json({ message: "Failed to import jobs" });
    }
  });

  // Machines endpoints
  app.get("/api/machines", async (req, res) => {
    try {
      const machines = await storage.getMachines();
      res.json(machines);
    } catch (error) {
      console.error('Failed to fetch machines:', error);
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
      console.error('Failed to fetch machine:', error);
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
      console.error('Failed to create machine:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid machine data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create machine" });
    }
  });

  app.patch("/api/machines/:id", async (req, res) => {
    try {
      const machine = await storage.updateMachine(req.params.id, req.body);
      if (!machine) {
        return res.status(404).json({ message: "Machine not found" });
      }
      broadcast({ type: 'machine_updated', data: machine });
      res.json(machine);
    } catch (error) {
      console.error('Failed to update machine:', error);
      res.status(500).json({ message: "Failed to update machine" });
    }
  });

  app.delete("/api/machines/:id", async (req, res) => {
    try {
      const success = await storage.deleteMachine(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Machine not found" });
      }
      broadcast({ type: 'machine_deleted', data: { id: req.params.id } });
      res.status(204).send();
    } catch (error) {
      console.error('Failed to delete machine:', error);
      res.status(500).json({ message: "Failed to delete machine" });
    }
  });

  // Schedule endpoints
  app.get("/api/schedule", async (req, res) => {
    try {
      const scheduleEntries = await storage.getScheduleEntries();
      res.json(scheduleEntries);
    } catch (error) {
      console.error('Failed to fetch schedule entries:', error);
      res.status(500).json({ message: "Failed to fetch schedule entries" });
    }
  });

  app.post("/api/schedule", async (req, res) => {
    try {
      const entryData = insertScheduleEntrySchema.parse(req.body);
      const entry = await storage.createScheduleEntry(entryData);
      broadcast({ type: 'schedule_entry_created', data: entry });
      res.status(201).json(entry);
    } catch (error) {
      console.error('Failed to create schedule entry:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid schedule entry data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create schedule entry" });
    }
  });

  app.patch("/api/schedule/:id", async (req, res) => {
    try {
      const entry = await storage.updateScheduleEntry(req.params.id, req.body);
      if (!entry) {
        return res.status(404).json({ message: "Schedule entry not found" });
      }
      broadcast({ type: 'schedule_entry_updated', data: entry });
      res.json(entry);
    } catch (error) {
      console.error('Failed to update schedule entry:', error);
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
      console.error('Failed to delete schedule entry:', error);
      res.status(500).json({ message: "Failed to delete schedule entry" });
    }
  });

  app.delete("/api/schedule/all", async (req, res) => {
    try {
      await storage.clearAllScheduleEntries();
      broadcast({ type: 'schedule_cleared' });
      res.status(204).send();
    } catch (error) {
      console.error('Failed to delete all schedule entries:', error);
      res.status(500).json({ message: "Failed to delete all schedule entries" });
    }
  });

  // Resources endpoints
  app.get("/api/resources", async (req, res) => {
    try {
      const resources = await storage.getResources();
      // Convert status to isActive for frontend compatibility
      const frontendResources = resources.map(resource => ({
        ...resource,
        isActive: resource.status === 'Active'
      }));
      res.json(frontendResources);
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
      // Convert status to isActive for frontend compatibility
      const frontendResource = {
        ...resource,
        isActive: resource.status === 'Active'
      };
      res.json(frontendResource);
    } catch (error) {
      console.error('Failed to fetch resource:', error);
      res.status(500).json({ message: "Failed to fetch resource" });
    }
  });

  app.post("/api/resources", async (req, res) => {
    try {
      const resourceData = insertResourceSchema.parse(req.body);
      // Convert frontend isActive to database status field
      if ('isActive' in resourceData) {
        (resourceData as any).status = resourceData.isActive ? 'Active' : 'Inactive';
        delete (resourceData as any).isActive;
      }
      const resource = await storage.createResource(resourceData);
      broadcast({ type: 'resource_created', data: resource });
      res.status(201).json(resource);
    } catch (error) {
      console.error('Failed to create resource:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid resource data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create resource" });
    }
  });

  app.post("/api/resources/import", async (req, res) => {
    try {
      let resourcesData: any[] = [];
      
      // Check if this is a file upload or JSON data
      if (req.headers['content-type']?.includes('multipart/form-data')) {
        // Handle file upload
        const multer = require('multer');
        const upload = multer().single('file');
        
        upload(req as any, res, async (err: any) => {
          if (err) {
            return res.status(400).json({ message: "File upload error" });
          }
          
          const file = (req as any).file;
          if (!file) {
            return res.status(400).json({ message: "No file provided" });
          }

          try {
            let fileData: any[] = [];
            
            if (file.mimetype === 'application/json' || file.originalname.endsWith('.json')) {
              // Parse JSON file
              const jsonContent = file.buffer.toString('utf8');
              fileData = JSON.parse(jsonContent);
            } else if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
              // Parse CSV file
              const csvContent = file.buffer.toString('utf8');
              const lines = csvContent.split('\n');
              const headers = lines[0].split(',').map((h: string) => h.trim().replace(/"/g, ''));
              
              for (let i = 1; i < lines.length; i++) {
                if (lines[i].trim()) {
                  const values = lines[i].split(',').map((v: string) => v.trim().replace(/"/g, ''));
                  const row: any = {};
                  headers.forEach((header: string, index: number) => {
                    row[header] = values[index] || '';
                  });
                  fileData.push(row);
                }
              }
            } else {
              return res.status(400).json({ message: "Unsupported file type. Please upload JSON or CSV." });
            }
            
            resourcesData = fileData;
          } catch (parseError) {
            return res.status(400).json({ message: "Failed to parse file content" });
          }
        });
      } else {
        // Handle JSON data - load from attached_assets if empty array provided
        if (Array.isArray(req.body) && req.body.length === 0) {
          // Load from attached_assets/resources.json
          const fs = require('fs');
          const path = require('path');
          
          try {
            const resourcesPath = path.join(__dirname, '../attached_assets/resources.json');
            const resourcesContent = fs.readFileSync(resourcesPath, 'utf8');
            resourcesData = JSON.parse(resourcesContent);
          } catch (fileError) {
            return res.status(500).json({ message: "Failed to load resources.json file" });
          }
        } else {
          resourcesData = req.body;
        }
      }

      let processed = 0;
      let created = 0;
      let updated = 0;
      const errors: string[] = [];

      for (const resourceData of resourcesData) {
        try {
          // Transform the data from snake_case to camelCase and handle field mappings
          const transformedData = {
            employeeId: resourceData.employee_id,
            name: resourceData.name,
            email: resourceData.email || "",
            role: resourceData.role,
            workCenters: resourceData.work_centers || [],
            skills: resourceData.skills || [],
            shiftSchedule: resourceData.shift_schedule || [1],
            workSchedule: resourceData.work_schedule || {},
            status: resourceData.is_active ? 'Active' : 'Inactive'
          };

          // Check if resource already exists by employeeId
          const existingResource = await storage.getResourceByEmployeeId(transformedData.employeeId);
          
          if (existingResource) {
            // Update existing resource
            const updatedResource = await storage.updateResource(existingResource.id, transformedData);
            if (updatedResource) {
              updated++;
              broadcast({ type: 'resource_updated', data: updatedResource });
            }
          } else {
            // Create new resource
            const newResource = await storage.createResource(transformedData);
            if (newResource) {
              created++;
              broadcast({ type: 'resource_created', data: newResource });
            }
          }
          processed++;
        } catch (error) {
          console.error('Failed to import resource:', resourceData, error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Failed to import ${resourceData.name || resourceData.employee_id}: ${errorMessage}`);
        }
      }

      broadcast({ type: 'resources_imported', data: { processed, created, updated } });
      
      res.json({
        success: true,
        processed,
        created,
        updated,
        errors: errors.length > 0 ? errors : undefined,
        message: `Successfully processed ${processed} resources. Created ${created}, updated ${updated}.`
      });
    } catch (error) {
      console.error('Failed to import resources:', error);
      res.status(500).json({ message: "Failed to import resources" });
    }
  });

  app.patch("/api/resources/:id", async (req, res) => {
    try {
      const updates = req.body;
      console.log(`🔧 UPDATING RESOURCE ${req.params.id}:`, JSON.stringify(updates, null, 2));
      
      // Convert frontend isActive to database status field
      if ('isActive' in updates) {
        updates.status = updates.isActive ? 'Active' : 'Inactive';
        delete updates.isActive;
        console.log(`🔄 Converted isActive to status: ${updates.status}`);
      }
      
      const resource = await storage.updateResource(req.params.id, updates);
      
      if (!resource) {
        return res.status(404).json({ message: "Resource not found" });
      }
      
      console.log(`✅ RESOURCE UPDATED:`, JSON.stringify(resource.workSchedule, null, 2));
      
      // Convert status back to isActive for frontend compatibility
      const responseResource = {
        ...resource,
        isActive: resource.status === 'Active'
      };
      
      broadcast({ 
        type: 'resource_updated', 
        data: responseResource 
      });
      
      res.json(responseResource);
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
      broadcast({ type: 'resource_deleted', data: { id: req.params.id } });
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
      const unavailabilityData = req.body;
      const result = await storage.createResourceUnavailability(unavailabilityData);
      broadcast({ type: 'resource_unavailability_created', data: result });
      res.status(201).json(result);
    } catch (error) {
      console.error('Failed to create resource unavailability:', error);
      res.status(500).json({ message: "Failed to create resource unavailability" });
    }
  });

  app.delete("/api/resource-unavailability/:id", async (req, res) => {
    try {
      const success = await storage.deleteResourceUnavailability(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Resource unavailability not found" });
      }
      broadcast({ type: 'resource_unavailability_deleted', data: { id: req.params.id } });
      res.status(204).send();
    } catch (error) {
      console.error('Failed to delete resource unavailability:', error);
      res.status(500).json({ message: "Failed to delete resource unavailability" });
    }
  });

  // Alerts endpoints
  app.get("/api/alerts", async (req, res) => {
    try {
      const alerts = await storage.getAlerts();
      res.json(alerts);
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
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
      console.error('Failed to create alert:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid alert data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create alert" });
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
      console.error('Failed to delete alert:', error);
      res.status(500).json({ message: "Failed to delete alert" });
    }
  });

  // Material orders endpoints
  app.get("/api/materials", async (req, res) => {
    try {
      // Return empty array for now - material orders not yet implemented
      res.json([]);
    } catch (error) {
      console.error('Failed to fetch material orders:', error);
      res.status(500).json({ message: "Failed to fetch material orders" });
    }
  });

  app.get("/api/material-orders", async (req, res) => {
    try {
      // Return empty array for now - material orders not yet implemented
      res.json([]);
    } catch (error) {
      console.error('Failed to fetch material orders:', error);
      res.status(500).json({ message: "Failed to fetch material orders" });
    }
  });

  app.post("/api/materials", async (req, res) => {
    try {
      // Stub implementation for material order creation
      const materialData = insertMaterialOrderSchema.parse(req.body);
      const material = { id: 'temp-id', ...materialData, createdAt: new Date() };
      broadcast({ type: 'material_created', data: material });
      res.status(201).json(material);
    } catch (error) {
      console.error('Failed to create material order:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid material order data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create material order" });
    }
  });

  app.post("/api/materials/:id/receive", async (req, res) => {
    try {
      // Stub implementation for marking material as received
      const result = { id: req.params.id, received: true };
      broadcast({ type: 'material_received', data: result });
      res.json(result);
    } catch (error) {
      console.error('Failed to mark material as received:', error);
      res.status(500).json({ message: "Failed to mark material as received" });
    }
  });

  app.delete("/api/material-orders/all", async (req, res) => {
    try {
      // This would be implemented as needed
      res.status(204).send();
    } catch (error) {
      console.error('Failed to delete all material orders:', error);
      res.status(500).json({ message: "Failed to delete all material orders" });
    }
  });

  // Dashboard endpoints
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  app.get("/api/efficiency-impact", async (req, res) => {
    try {
      // Return basic efficiency impact data
      res.json({ impact: 0, message: "Efficiency tracking not yet implemented" });
    } catch (error) {
      console.error('Failed to fetch efficiency impact:', error);
      res.status(500).json({ message: "Failed to fetch efficiency impact" });
    }
  });

  // Outsourced operations endpoints
  app.get("/api/outsourced-operations/dashboard", async (req, res) => {
    try {
      const operations = await storage.getOutsourcedOperations();
      res.json(operations);
    } catch (error) {
      console.error('Failed to fetch outsourced operations dashboard:', error);
      res.status(500).json({ message: "Failed to fetch outsourced operations dashboard" });
    }
  });

  app.post("/api/outsourced-operations/:id/complete", async (req, res) => {
    try {
      const result = await storage.markOutsourcedOperationComplete(req.params.id);
      broadcast({ type: 'outsourced_operation_completed', data: result });
      res.json(result);
    } catch (error) {
      console.error('Failed to complete outsourced operation:', error);
      res.status(500).json({ message: "Failed to complete outsourced operation" });
    }
  });

  app.delete("/api/outsourced-operations/:id", async (req, res) => {
    try {
      // This would need to be implemented in storage interface
      res.status(204).send();
    } catch (error) {
      console.error('Failed to delete outsourced operation:', error);
      res.status(500).json({ message: "Failed to delete outsourced operation" });
    }
  });

  return httpServer;
}
