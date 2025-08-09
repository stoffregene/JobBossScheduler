import { useState } from "react";
import React from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Filter, Plus, Calendar, Edit, Zap, Trash2, Settings, Upload, PlayCircle, AlertTriangle, ChevronDown, ChevronUp, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Job } from "@shared/schema";
import ScheduleProgressToast from "./schedule-progress-toast";

interface JobQueueProps {
  onJobSelect: (jobId: string) => void;
}

type SortField = 'jobNumber' | 'partNumber' | 'promisedDate' | 'status' | 'priority' | 'customer' | 'estimatedHours';
type SortDirection = 'asc' | 'desc';

export default function JobQueue({ onJobSelect }: JobQueueProps) {
  const { toast } = useToast();
  const [isAddJobOpen, setIsAddJobOpen] = useState(false);
  const [isEditJobOpen, setIsEditJobOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isRoutingDialogOpen, setIsRoutingDialogOpen] = useState(false);
  const [selectedJobForRouting, setSelectedJobForRouting] = useState<Job | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [sortField, setSortField] = useState<SortField>('promisedDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [filters, setFilters] = useState({
    status: 'all',
    priority: 'all',
    customer: '',
    search: ''
  });
  const [newJob, setNewJob] = useState({
    jobNumber: '',
    partNumber: '',
    description: '',
    promisedDate: '',
    priority: 'Normal' as const,
    estimatedHours: '',
    customer: '',
    quantity: 1,
    material: '',
    leadDays: 0,
    outsourcedVendor: '',
    routing: [] as any[]
  });
  const [isScheduleProgressVisible, setIsScheduleProgressVisible] = useState(false);
  const [isManualScheduleOpen, setIsManualScheduleOpen] = useState(false);
  const [manualScheduleJob, setManualScheduleJob] = useState<Job | null>(null);
  const [manualStartDate, setManualStartDate] = useState('');

  const { data: rawJobs, isLoading } = useQuery<Job[]>({
    queryKey: ['/api/jobs'],
    queryFn: () => fetch('/api/jobs?includeCompleted=false').then(res => res.json()),
  });

  // Sort and filter jobs
  const jobs = React.useMemo(() => {
    if (!rawJobs) return [];
    
    let filteredJobs = rawJobs.filter(job => {
      // Hide scheduled jobs from queue unless specifically filtered for them
      if (filters.status === 'all' && job.status === 'Scheduled') return false;
      if (filters.status && filters.status !== 'all' && job.status !== filters.status) return false;
      if (filters.priority && filters.priority !== 'all' && job.priority !== filters.priority) return false;
      if (filters.customer && !job.customer?.toLowerCase().includes(filters.customer.toLowerCase())) return false;
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        return job.jobNumber.toLowerCase().includes(searchLower) ||
               job.partNumber.toLowerCase().includes(searchLower) ||
               job.description?.toLowerCase().includes(searchLower) ||
               job.customer?.toLowerCase().includes(searchLower);
      }
      return true;
    });

    // Sort jobs
    filteredJobs.sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      if (sortField === 'promisedDate') {
        aValue = new Date(a.promisedDate).getTime();
        bValue = new Date(b.promisedDate).getTime();
      } else if (sortField === 'estimatedHours') {
        aValue = parseFloat(a.estimatedHours || '0');
        bValue = parseFloat(b.estimatedHours || '0');
      } else if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue?.toLowerCase() || '';
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filteredJobs;
  }, [rawJobs, sortField, sortDirection, filters]);

  const { data: machines } = useQuery<any[]>({
    queryKey: ['/api/machines'],
  });

  const createJobMutation = useMutation({
    mutationFn: async (jobData: typeof newJob) => {
      const estimatedHours = parseFloat(jobData.estimatedHours) || 2; // Default to 2 hours if not specified
      
      // Use provided routing or create basic routing operations for scheduling
      const routing = jobData.routing.length > 0 ? jobData.routing : [
        {
          sequence: 1,
          operationName: "Machining",
          machineType: "MILL",
          compatibleMachines: ["HMC-001", "HMC-002", "VMC-001", "VMC-002"],
          requiredSkills: ["CNC Programming", "Setup"],
          estimatedHours: estimatedHours * 0.8, // 80% machining
          setupHours: 0.5,
          dependencies: [],
          notes: "Primary machining operation"
        },
        {
          sequence: 2,
          operationName: "Inspection",
          machineType: "INSPECT",
          compatibleMachines: ["CMM-001"],
          requiredSkills: ["Quality Control"],
          estimatedHours: estimatedHours * 0.2, // 20% inspection
          setupHours: 0.25,
          dependencies: [1],
          notes: "Final inspection"
        }
      ];

      const payload = {
        jobNumber: jobData.jobNumber,
        partNumber: jobData.partNumber,
        description: jobData.description,
        customer: jobData.customer,
        promisedDate: jobData.promisedDate, // Use promised date as primary scheduling driver
        dueDate: jobData.promisedDate, // Set due date same as promised for now
        estimatedHours: estimatedHours.toString(),
        quantity: jobData.quantity,
        status: 'Unscheduled' as const,
        priority: jobData.priority,
        material: jobData.material,
        leadDays: jobData.leadDays,
        outsourcedVendor: jobData.outsourcedVendor,
        routing
      };
      return apiRequest('/api/jobs', 'POST', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      setIsAddJobOpen(false);
      setNewJob({
        jobNumber: '',
        partNumber: '',
        description: '',
        promisedDate: '',
        priority: 'Normal',
        estimatedHours: '',
        customer: '',
        quantity: 1,
        material: '',
        leadDays: 0,
        outsourcedVendor: '',
        routing: []
      });
      toast({
        title: "Job Created",
        description: "New job has been added to the queue successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Creation Failed",
        description: "Unable to create the job. Please check all fields and try again.",
        variant: "destructive",
      });
    },
  });

  const autoScheduleMutation = useMutation({
    mutationFn: async (jobId: string) => {
      setIsScheduleProgressVisible(true);
      return apiRequest(`/api/jobs/${jobId}/auto-schedule`, 'POST');
    },
    onSuccess: (data, jobId) => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/schedule'] });
      queryClient.invalidateQueries({ queryKey: ['/api/machines'] });
      toast({
        title: "Auto-Schedule Success",
        description: `Job has been automatically scheduled successfully.`,
      });
    },
    onError: () => {
      setIsScheduleProgressVisible(false);
      toast({
        title: "Auto-Schedule Failed",
        description: "Unable to automatically schedule this job. Please try manual scheduling.",
        variant: "destructive",
      });
    },
  });

  const deleteJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      return apiRequest(`/api/jobs/${jobId}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/schedule'] });
      toast({
        title: "Job Deleted",
        description: "Job has been removed from the queue.",
      });
    },
    onError: () => {
      toast({
        title: "Delete Failed",
        description: "Unable to delete the job. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateJobMutation = useMutation({
    mutationFn: async ({ jobId, updates }: { jobId: string; updates: Partial<Job> }) => {
      return apiRequest(`/api/jobs/${jobId}`, 'PUT', updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      setIsEditJobOpen(false);
      setEditingJob(null);
      toast({
        title: "Job Updated",
        description: "Job details have been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Unable to update the job. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteAllJobsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/jobs', 'DELETE');
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/schedule'] });
      toast({
        title: "All Jobs Deleted",
        description: `Successfully deleted ${data.count} jobs.`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete all jobs. Please try again.",
        variant: "destructive",
      });
    }
  });

  const scheduleAllJobsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/jobs/schedule-all', 'POST');
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/schedule'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      
      // Show priority breakdown if available
      const priorityBreakdown = data.results ? data.results.reduce((acc: any, r: any) => {
        if (r.status === 'scheduled') {
          acc[r.priority] = (acc[r.priority] || 0) + 1;
        }
        return acc;
      }, {}) : {};
      
      const breakdown = Object.keys(priorityBreakdown).length > 0 
        ? ` (${Object.entries(priorityBreakdown).map(([p, c]) => `${p}: ${c}`).join(', ')})`
        : '';
      
      toast({
        title: "Priority-Based Scheduling Complete",
        description: `Scheduled ${data.scheduled} jobs, ${data.failed} failed${breakdown}`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to schedule all jobs. Please try again.",
        variant: "destructive",
      });
    }
  });

  const updatePrioritiesMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/jobs/update-priorities', 'POST');
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      const counts = data.priorityCounts;
      toast({
        title: "Job Priorities Updated",
        description: `Critical: ${counts.Critical || 0}, High: ${counts.High || 0}, Normal: ${counts.Normal || 0}, Low: ${counts.Low || 0}`,
      });
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Failed to update job priorities. Please try again.",
        variant: "destructive",
      });
    }
  });

  const manualScheduleMutation = useMutation({
    mutationFn: async ({ jobId, startDate }: { jobId: string; startDate: string }) => {
      return apiRequest(`/api/jobs/${jobId}/manual-schedule`, 'POST', { startDate });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/schedule'] });
      queryClient.invalidateQueries({ queryKey: ['/api/machines'] });
      setIsManualScheduleOpen(false);
      setManualScheduleJob(null);
      setManualStartDate('');
      toast({
        title: "Manual Scheduling Success",
        description: `Job has been manually scheduled successfully.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Manual Scheduling Failed",
        description: error instanceof Error ? error.message : "Unable to manually schedule this job.",
        variant: "destructive",
      });
    },
  });

  const unscheduleAllMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/schedule/all', 'DELETE');
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/schedule'] });
      queryClient.invalidateQueries({ queryKey: ['/api/machines'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      toast({
        title: "All Schedules Cleared",
        description: `Successfully unscheduled ${data.clearedEntries} entries for ${data.affectedJobs} jobs.`,
      });
    },
    onError: () => {
      toast({
        title: "Unschedule Failed",
        description: "Unable to clear all schedules. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleCreateJob = () => {
    if (!newJob.jobNumber || !newJob.partNumber || !newJob.promisedDate) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields (Job Number, Part Number, Promised Date).",
        variant: "destructive",
      });
      return;
    }
    createJobMutation.mutate(newJob);
  };

  const handleEditJob = (job: Job) => {
    setEditingJob(job);
    setIsEditJobOpen(true);
  };

  const handleUpdateJob = () => {
    if (!editingJob) return;
    
    updateJobMutation.mutate({
      jobId: editingJob.id,
      updates: editingJob
    });
  };

  const handleDeleteJob = (jobId: string) => {
    if (confirm('Are you sure you want to delete this job? This action cannot be undone.')) {
      deleteJobMutation.mutate(jobId);
    }
  };

  const handleDeleteAllJobs = () => {
    const jobCount = rawJobs?.length || 0;
    if (jobCount === 0) {
      toast({
        title: "No Jobs",
        description: "There are no jobs to delete.",
      });
      return;
    }
    
    if (confirm(`Are you sure you want to delete ALL ${jobCount} jobs? This action cannot be undone and will remove all associated scheduling and material orders.`)) {
      deleteAllJobsMutation.mutate();
    }
  };

  const handleUnscheduleAll = () => {
    if (confirm('Are you sure you want to unschedule ALL jobs? This will clear all schedule entries and reset job statuses to "Open".')) {
      unscheduleAllMutation.mutate();
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3 w-3 opacity-50" />;
    }
    return sortDirection === 'asc' ? 
      <ArrowUp className="h-3 w-3" /> : 
      <ArrowDown className="h-3 w-3" />;
  };

  const clearFilters = () => {
    setFilters({
      status: 'all',
      priority: 'all',
      customer: '',
      search: ''
    });
  };

  const handleOpenRoutingDialog = (job: Job) => {
    setSelectedJobForRouting(job);
    setIsRoutingDialogOpen(true);
  };

  // Get machine substitution groups for routing options
  const getRoutingOptions = () => {
    if (!machines) return {};
    
    const substitutionGroups: Record<string, any[]> = {};
    machines.forEach(machine => {
      const group = machine.substitutionGroup;
      if (!substitutionGroups[group]) {
        substitutionGroups[group] = [];
      }
      substitutionGroups[group].push(machine);
    });
    
    return substitutionGroups;
  };

  const handleScheduleAllJobs = () => {
    const unscheduledJobs = jobs?.filter(job => job.status === 'Unscheduled' || job.status === 'Planning') || [];
    if (unscheduledJobs.length === 0) {
      toast({
        title: "No Unscheduled Jobs",
        description: "All jobs are already scheduled or in progress.",
      });
      return;
    }
    
    if (confirm(`Schedule all ${unscheduledJobs.length} unscheduled jobs? This will automatically assign machines and create schedule entries.`)) {
      scheduleAllJobsMutation.mutate();
    }
  };

  const handleCSVImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const formData = new FormData();
      formData.append('csv', file);

      const response = await fetch('/api/jobs/import', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        // Invalidate queries to refresh the UI
        queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
        queryClient.invalidateQueries({ queryKey: ['/api/material-orders'] });
        queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
        
        toast({
          title: "CSV Import Complete",
          description: `Successfully processed ${result.processed} rows. Created ${result.created} jobs, updated ${result.updated} jobs.`,
        });
      } else {
        toast({
          title: "Import Failed",
          description: result.message || "Failed to import CSV file.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Import Error",
        description: "An error occurred while importing the CSV file.",
        variant: "destructive",
      });
    }

    setIsImportOpen(false);
    event.target.value = ''; // Reset file input
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Job Queue</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!jobs || jobs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Job Queue</CardTitle>
            <div className="flex items-center space-x-2">
              <Dialog open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" data-testid="button-filter-empty">
                    <Filter className="h-4 w-4 mr-1" />
                    Filter
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Filter Jobs</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="text-sm text-gray-600">No jobs available to filter.</div>
                    <div className="flex justify-end pt-4">
                      <Button onClick={() => setIsFilterOpen(false)} data-testid="button-close-filter-empty">
                        Close
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Upload className="h-4 w-4 mr-1" />
                    Import CSV
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Import Jobs from CSV</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="text-sm text-gray-600">
                      Upload a JobBoss scheduling report CSV file. The system will automatically parse multi-step routing and create jobs with proper work center assignments.
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="csvFile">CSV File</Label>
                      <Input
                        id="csvFile"
                        type="file"
                        accept=".csv,text/csv,application/csv,text/plain"
                        onChange={handleCSVImport}
                      />
                    </div>
                    <div className="text-xs text-gray-500">
                      Expected format: JobBoss Scheduling Report with Job Number, Customer, Work Center, Hours, Materials, etc.
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              <Dialog open={isAddJobOpen} onOpenChange={setIsAddJobOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-1" />
                    Add Job
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Add New Job</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="jobNumber">Job Number *</Label>
                      <Input
                        id="jobNumber"
                        value={newJob.jobNumber}
                        onChange={(e) => setNewJob(prev => ({ ...prev, jobNumber: e.target.value }))}
                        placeholder="J0001"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="partNumber">Part Number *</Label>
                      <Input
                        id="partNumber"
                        value={newJob.partNumber}
                        onChange={(e) => setNewJob(prev => ({ ...prev, partNumber: e.target.value }))}
                        placeholder="PN-12345"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={newJob.description}
                        onChange={(e) => setNewJob(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Brief description of the part"
                        rows={2}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="promisedDate">Promised Date *</Label>
                        <Input
                          id="promisedDate"
                          type="date"
                          value={newJob.promisedDate}
                          onChange={(e) => setNewJob(prev => ({ ...prev, promisedDate: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="priority">Priority</Label>
                        <Select value={newJob.priority} onValueChange={(value) => setNewJob(prev => ({ ...prev, priority: value as any }))}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Normal">Normal</SelectItem>
                            <SelectItem value="High">High</SelectItem>
                            <SelectItem value="Critical">Critical</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="estimatedHours">Est. Hours</Label>
                        <Input
                          id="estimatedHours"
                          type="number"
                          value={newJob.estimatedHours}
                          onChange={(e) => setNewJob(prev => ({ ...prev, estimatedHours: e.target.value }))}
                          placeholder="8.5"
                          step="0.5"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="customer">Customer</Label>
                        <Input
                          id="customer"
                          value={newJob.customer}
                          onChange={(e) => setNewJob(prev => ({ ...prev, customer: e.target.value }))}
                          placeholder="Customer name"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end space-x-2 pt-4">
                      <Button variant="outline" onClick={() => setIsAddJobOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleCreateJob} disabled={createJobMutation.isPending}>
                        {createJobMutation.isPending ? 'Creating...' : 'Create Job'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500 py-8">
            No jobs found. Add a new job to get started.
          </div>
        </CardContent>
      </Card>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Customer Late':
        return 'bg-error-100 text-error-800';
      case 'Company Late':
        return 'bg-warning-100 text-warning-800';
      case 'Scheduled':
        return 'bg-success-100 text-success-800';
      case 'In Progress':
        return 'bg-primary-100 text-primary-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Critical':
        return 'bg-error-500';
      case 'High':
        return 'bg-error-500';
      case 'Normal':
        return 'bg-success-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getDaysRemaining = (promisedDate: Date, jobNumber: string) => {
    const today = new Date();
    const promised = new Date(promisedDate);
    const diffTime = promised.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const isStockJob = jobNumber.toUpperCase().startsWith('S');
    
    if (diffDays < 0) {
      if (isStockJob) {
        // Stock job overdue - special visual treatment
        if (diffDays < -30) {
          return { 
            text: `${Math.abs(diffDays)} days overdue (CRITICAL STOCK)`, 
            className: 'text-red-700 font-bold bg-red-100 px-2 py-1 rounded' 
          };
        } else if (diffDays < -7) {
          return { 
            text: `${Math.abs(diffDays)} days overdue (Stock Overdue)`, 
            className: 'text-orange-600 font-medium bg-orange-50 px-2 py-1 rounded' 
          };
        } else {
          return { 
            text: `${Math.abs(diffDays)} days overdue (Stock)`, 
            className: 'text-yellow-600 font-medium bg-yellow-50 px-2 py-1 rounded' 
          };
        }
      } else {
        return { text: `${Math.abs(diffDays)} days overdue`, className: 'text-error-600 font-medium' };
      }
    } else if (diffDays < 4) {
      return { text: `${diffDays} days (Customer Late)`, className: 'text-error-600 font-medium' };
    } else {
      return { text: `${diffDays} days`, className: 'text-gray-500' };
    }
  };

  return (
    <Collapsible open={!isCollapsed} onOpenChange={(open) => setIsCollapsed(!open)}>
      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
            <div className="flex items-center justify-between">
              <CardTitle className="dark:text-white">Job Queue ({jobs.length} jobs)</CardTitle>
              <div className="flex items-center space-x-2">
                {isCollapsed && (
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {jobs.filter(j => j.status === 'Unscheduled' || j.status === 'Planning').length} unscheduled
                  </span>
                )}
                {isCollapsed ? (
                  <ChevronDown className="h-4 w-4 text-gray-500" />
                ) : (
                  <ChevronUp className="h-4 w-4 text-gray-500" />
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardHeader className="pt-0">
            <div className="flex flex-col space-y-3">
              {/* Action Buttons Row */}
              <div className="flex flex-wrap items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleScheduleAllJobs}
                  disabled={scheduleAllJobsMutation.isPending}
                >
                  <PlayCircle className="h-4 w-4 mr-1" />
                  Schedule All
                </Button>
                <Button 
                  variant="secondary" 
                  size="sm"
                  onClick={() => updatePrioritiesMutation.mutate()}
                  disabled={updatePrioritiesMutation.isPending}
                  data-testid="button-update-priorities"
                >
                  <ArrowUpDown className="h-4 w-4 mr-1" />
                  {updatePrioritiesMutation.isPending ? 'Updating...' : 'Update Priorities'}
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleUnscheduleAll}
                  disabled={unscheduleAllMutation.isPending}
                  data-testid="button-unschedule-all"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  {unscheduleAllMutation.isPending ? 'Unscheduling...' : 'Unschedule All'}
                </Button>
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={handleDeleteAllJobs}
                  disabled={deleteAllJobsMutation.isPending || !jobs || jobs.length === 0}
                >
                  <AlertTriangle className="h-4 w-4 mr-1" />
                  Delete All
                </Button>
              </div>
              
              {/* Filter and Controls Row */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Dialog open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" data-testid="button-filter">
                        <Filter className="h-4 w-4 mr-1" />
                        Filter
                        {(filters.status !== 'all' || filters.priority !== 'all' || filters.customer || filters.search) && (
                          <span className="ml-1 bg-blue-500 text-white text-xs rounded-full px-1.5 py-0.5">•</span>
                        )}
                      </Button>
                    </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Filter Jobs</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="searchFilter">Search</Label>
                    <Input
                      id="searchFilter"
                      placeholder="Search job number, part, or description..."
                      value={filters.search}
                      onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                      data-testid="input-search-filter"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="statusFilter">Status</Label>
                    <Select value={filters.status} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}>
                      <SelectTrigger data-testid="select-status-filter">
                        <SelectValue placeholder="All statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        <SelectItem value="Unscheduled">Unscheduled</SelectItem>
                        <SelectItem value="Scheduled">Scheduled</SelectItem>
                        <SelectItem value="In Progress">In Progress</SelectItem>
                        <SelectItem value="Complete">Complete</SelectItem>
                        <SelectItem value="On Hold">On Hold</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="priorityFilter">Priority</Label>
                    <Select value={filters.priority} onValueChange={(value) => setFilters(prev => ({ ...prev, priority: value }))}>
                      <SelectTrigger data-testid="select-priority-filter">
                        <SelectValue placeholder="All priorities" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All priorities</SelectItem>
                        <SelectItem value="Normal">Normal</SelectItem>
                        <SelectItem value="High">High</SelectItem>
                        <SelectItem value="Critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="customerFilter">Customer</Label>
                    <Input
                      id="customerFilter"
                      placeholder="Filter by customer name..."
                      value={filters.customer}
                      onChange={(e) => setFilters(prev => ({ ...prev, customer: e.target.value }))}
                      data-testid="input-customer-filter"
                    />
                  </div>
                  <div className="flex justify-between pt-4">
                    <Button variant="outline" onClick={clearFilters} data-testid="button-clear-filters">
                      Clear All
                    </Button>
                    <Button onClick={() => setIsFilterOpen(false)} data-testid="button-apply-filters">
                      Apply
                    </Button>
                  </div>
                </div>
              </DialogContent>
                  </Dialog>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Upload className="h-4 w-4 mr-1" />
                        Import CSV
                      </Button>
                    </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Import Jobs from CSV</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="text-sm text-gray-600">
                    Upload a JobBoss scheduling report CSV file. The system will automatically parse multi-step routing and create jobs with proper work center assignments.
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="csvFileMain2">CSV File</Label>
                    <Input
                      id="csvFileMain2"
                      type="file"
                      accept=".csv,text/csv,application/csv,text/plain"
                      onChange={handleCSVImport}
                    />
                  </div>
                  <div className="text-xs text-gray-500">
                    Expected format: JobBoss Scheduling Report with Job Number, Customer, Work Center, Hours, Materials, etc.
                  </div>
                </div>
              </DialogContent>
                  </Dialog>
                  <Dialog open={isAddJobOpen} onOpenChange={setIsAddJobOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus className="h-4 w-4 mr-1" />
                        Add Job
                      </Button>
                    </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add New Job</DialogTitle>
                </DialogHeader>
                <div className="space-y-6 py-4">
                  {/* Basic Job Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-gray-900">Basic Information</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="jobNumber">Job Number *</Label>
                        <Input
                          id="jobNumber"
                          value={newJob.jobNumber}
                          onChange={(e) => setNewJob(prev => ({ ...prev, jobNumber: e.target.value }))}
                          placeholder="J0001"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="partNumber">Part Number *</Label>
                        <Input
                          id="partNumber"
                          value={newJob.partNumber}
                          onChange={(e) => setNewJob(prev => ({ ...prev, partNumber: e.target.value }))}
                          placeholder="PN-12345"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={newJob.description}
                        onChange={(e) => setNewJob(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Brief description of the part"
                        rows={2}
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="customer">Customer</Label>
                        <Input
                          id="customer"
                          value={newJob.customer}
                          onChange={(e) => setNewJob(prev => ({ ...prev, customer: e.target.value }))}
                          placeholder="Customer name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="quantity">Quantity</Label>
                        <Input
                          id="quantity"
                          type="number"
                          value={newJob.quantity}
                          onChange={(e) => setNewJob(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                          placeholder="1"
                          min="1"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Scheduling Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-gray-900">Scheduling Information</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="promisedDate">Promised Date *</Label>
                        <Input
                          id="promisedDate"
                          type="date"
                          value={newJob.promisedDate}
                          onChange={(e) => setNewJob(prev => ({ ...prev, promisedDate: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="priority">Priority</Label>
                        <Select value={newJob.priority} onValueChange={(value) => setNewJob(prev => ({ ...prev, priority: value as any }))}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Normal">Normal</SelectItem>
                            <SelectItem value="High">High</SelectItem>
                            <SelectItem value="Critical">Critical</SelectItem>
                            <SelectItem value="Stock">Stock</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="estimatedHours">Total Est. Hours</Label>
                        <Input
                          id="estimatedHours"
                          type="number"
                          value={newJob.estimatedHours}
                          onChange={(e) => setNewJob(prev => ({ ...prev, estimatedHours: e.target.value }))}
                          placeholder="8.5"
                          step="0.5"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="leadDays">External Lead Days</Label>
                        <Input
                          id="leadDays"
                          type="number"
                          value={newJob.leadDays}
                          onChange={(e) => setNewJob(prev => ({ ...prev, leadDays: parseInt(e.target.value) || 0 }))}
                          placeholder="21"
                          min="0"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Material and Vendor Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-gray-900">Material & Vendor Information</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="material">Material</Label>
                        <Input
                          id="material"
                          value={newJob.material}
                          onChange={(e) => setNewJob(prev => ({ ...prev, material: e.target.value }))}
                          placeholder="Aluminum, Steel, etc."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="outsourcedVendor">Outsourced Vendor</Label>
                        <Select value={newJob.outsourcedVendor} onValueChange={(value) => setNewJob(prev => ({ ...prev, outsourcedVendor: value }))}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select vendor" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">None</SelectItem>
                            <SelectItem value="GERARD">GERARD (14 days)</SelectItem>
                            <SelectItem value="A-1 LAPPIN">A-1 LAPPIN (20 days)</SelectItem>
                            <SelectItem value="ADV PLATIN">ADV PLATIN (3-10 days)</SelectItem>
                            <SelectItem value="FITZGERALD">FITZGERALD (16 days)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Routing Operations */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium text-gray-900">Routing Operations</h3>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const newOperation = {
                            sequence: newJob.routing.length + 1,
                            operationName: `Operation ${newJob.routing.length + 1}`,
                            machineType: "MILL",
                            compatibleMachines: ["HMC-001", "VMC-001"],
                            estimatedHours: 1,
                            setupHours: 0.5,
                            dependencies: [],
                            notes: ""
                          };
                          setNewJob(prev => ({ ...prev, routing: [...prev.routing, newOperation] }));
                        }}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Operation
                      </Button>
                    </div>
                    
                    {newJob.routing.length === 0 ? (
                      <div className="text-center text-gray-500 py-4 border-2 border-dashed border-gray-300 rounded-lg">
                        <p>No routing operations defined</p>
                        <p className="text-sm">Click "Add Operation" to define the manufacturing steps</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {newJob.routing.map((operation, index) => (
                          <div key={index} className="border border-gray-200 rounded-lg p-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Operation Name</Label>
                                <Input
                                  value={operation.operationName}
                                  onChange={(e) => {
                                    const updatedRouting = [...newJob.routing];
                                    updatedRouting[index].operationName = e.target.value;
                                    setNewJob(prev => ({ ...prev, routing: updatedRouting }));
                                  }}
                                  placeholder="e.g., Rough Mill"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Machine Type</Label>
                                <Select 
                                  value={operation.machineType} 
                                  onValueChange={(value) => {
                                    const updatedRouting = [...newJob.routing];
                                    updatedRouting[index].machineType = value;
                                    setNewJob(prev => ({ ...prev, routing: updatedRouting }));
                                  }}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="MILL">Mill</SelectItem>
                                    <SelectItem value="LATHE">Lathe</SelectItem>
                                    <SelectItem value="SAW">Saw</SelectItem>
                                    <SelectItem value="WELD">Weld</SelectItem>
                                    <SelectItem value="INSPECT">Inspect</SelectItem>
                                    <SelectItem value="OUTSOURCE">Outsource</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4 mt-4">
                              <div className="space-y-2">
                                <Label>Estimated Hours</Label>
                                <Input
                                  type="number"
                                  value={operation.estimatedHours}
                                  onChange={(e) => {
                                    const updatedRouting = [...newJob.routing];
                                    updatedRouting[index].estimatedHours = parseFloat(e.target.value) || 0;
                                    setNewJob(prev => ({ ...prev, routing: updatedRouting }));
                                  }}
                                  placeholder="2.5"
                                  step="0.5"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Setup Hours</Label>
                                <Input
                                  type="number"
                                  value={operation.setupHours || 0}
                                  onChange={(e) => {
                                    const updatedRouting = [...newJob.routing];
                                    updatedRouting[index].setupHours = parseFloat(e.target.value) || 0;
                                    setNewJob(prev => ({ ...prev, routing: updatedRouting }));
                                  }}
                                  placeholder="0.5"
                                  step="0.25"
                                />
                              </div>
                            </div>
                            
                            <div className="mt-4">
                              <Label>Notes</Label>
                              <Textarea
                                value={operation.notes || ""}
                                onChange={(e) => {
                                  const updatedRouting = [...newJob.routing];
                                  updatedRouting[index].notes = e.target.value;
                                  setNewJob(prev => ({ ...prev, routing: updatedRouting }));
                                }}
                                placeholder="Additional notes for this operation"
                                rows={2}
                              />
                            </div>
                            
                            <div className="mt-4 flex justify-end">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const updatedRouting = newJob.routing.filter((_, i) => i !== index);
                                  // Re-sequence operations
                                  updatedRouting.forEach((op, i) => {
                                    op.sequence = i + 1;
                                  });
                                  setNewJob(prev => ({ ...prev, routing: updatedRouting }));
                                }}
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Remove
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end space-x-2 pt-4">
                    <Button variant="outline" onClick={() => setIsAddJobOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreateJob} disabled={createJobMutation.isPending}>
                      {createJobMutation.isPending ? 'Creating...' : 'Create Job'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
                  </Dialog>
                </div>
              </div>
            </div>
          </CardHeader>
      
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      <button 
                        className="flex items-center space-x-1 hover:text-gray-700 dark:hover:text-gray-200"
                        onClick={() => handleSort('jobNumber')}
                        data-testid="sort-job-number"
                      >
                        <span>Job #</span>
                        {getSortIcon('jobNumber')}
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      <button 
                        className="flex items-center space-x-1 hover:text-gray-700 dark:hover:text-gray-200"
                        onClick={() => handleSort('partNumber')}
                        data-testid="sort-part-number"
                      >
                        <span>Part</span>
                        {getSortIcon('partNumber')}
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      <button 
                        className="flex items-center space-x-1 hover:text-gray-700 dark:hover:text-gray-200"
                        onClick={() => handleSort('promisedDate')}
                        data-testid="sort-promised-date"
                      >
                        <span>Promised Date</span>
                        {getSortIcon('promisedDate')}
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      <button 
                        className="flex items-center space-x-1 hover:text-gray-700 dark:hover:text-gray-200"
                        onClick={() => handleSort('status')}
                        data-testid="sort-status"
                      >
                        <span>Status</span>
                        {getSortIcon('status')}
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      <button 
                        className="flex items-center space-x-1 hover:text-gray-700 dark:hover:text-gray-200"
                        onClick={() => handleSort('priority')}
                        data-testid="sort-priority"
                      >
                        <span>Priority</span>
                        {getSortIcon('priority')}
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {jobs.map((job) => {
                const daysRemaining = getDaysRemaining(job.promisedDate, job.jobNumber);
                
                return (
                  <tr 
                    key={job.id} 
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer border-l-4 border-transparent"
                    onClick={() => onJobSelect(job.id)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-mono text-gray-900 dark:text-white">{job.jobNumber}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Created: {new Date(job.createdDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">{job.partNumber}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{job.description}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {new Date(job.promisedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                      <div className={`text-xs ${daysRemaining.className}`}>
                        {daysRemaining.text}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge className={getStatusColor(job.status)}>
                        {job.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <div className="flex items-center">
                          <div className={`w-2 h-2 ${getPriorityColor(job.priority)} rounded-full mr-2`}></div>
                          <span className="text-sm text-gray-900 dark:text-white">{job.priority}</span>
                        </div>
                        {job.jobNumber.toUpperCase().startsWith('S') && (
                          <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                            STOCK
                          </Badge>
                        )}
                        {job.jobNumber.toUpperCase().startsWith('R') && (
                          <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                            REWORK
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center space-x-1">
                        {job.scheduledStatus === 'Unscheduled' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              autoScheduleMutation.mutate(job.id);
                            }}
                            disabled={autoScheduleMutation.isPending}
                            title="Auto Schedule with Best Fit Machines"
                          >
                            <Zap className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setManualScheduleJob(job);
                            setManualStartDate('');
                            setIsManualScheduleOpen(true);
                          }}
                          title="Manual Schedule"
                        >
                          <Calendar className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditJob(job);
                          }}
                          title="Edit Job"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenRoutingDialog(job);
                          }}
                          title="Adjust Routing"
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteJob(job.id);
                          }}
                          title="Delete Job"
                          disabled={deleteJobMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>

      {/* Edit Job Dialog */}
      <Dialog open={isEditJobOpen} onOpenChange={setIsEditJobOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Job</DialogTitle>
          </DialogHeader>
          {editingJob && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="editJobNumber">Job Number *</Label>
                <Input
                  id="editJobNumber"
                  value={editingJob.jobNumber}
                  onChange={(e) => setEditingJob(prev => prev ? { ...prev, jobNumber: e.target.value } : null)}
                  placeholder="J0001"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editPartNumber">Part Number *</Label>
                <Input
                  id="editPartNumber"
                  value={editingJob.partNumber}
                  onChange={(e) => setEditingJob(prev => prev ? { ...prev, partNumber: e.target.value } : null)}
                  placeholder="PN-12345"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editDescription">Description</Label>
                <Textarea
                  id="editDescription"
                  value={editingJob.description || ''}
                  onChange={(e) => setEditingJob(prev => prev ? { ...prev, description: e.target.value } : null)}
                  placeholder="Brief description of the part"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="editPromisedDate">Promised Date *</Label>
                  <Input
                    id="editPromisedDate"
                    type="date"
                    value={new Date(editingJob.promisedDate).toISOString().split('T')[0]}
                    onChange={(e) => setEditingJob(prev => prev ? { ...prev, promisedDate: new Date(e.target.value) } : null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editPriority">Priority</Label>
                  <Select 
                    value={editingJob.priority} 
                    onValueChange={(value) => setEditingJob(prev => prev ? { ...prev, priority: value as any } : null)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Normal">Normal</SelectItem>
                      <SelectItem value="High">High</SelectItem>
                      <SelectItem value="Critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="editEstimatedHours">Est. Hours</Label>
                  <Input
                    id="editEstimatedHours"
                    type="number"
                    value={editingJob.estimatedHours}
                    onChange={(e) => setEditingJob(prev => prev ? { ...prev, estimatedHours: e.target.value } : null)}
                    placeholder="8.5"
                    step="0.5"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editCustomer">Customer</Label>
                  <Input
                    id="editCustomer"
                    value={(editingJob as any).customer || ''}
                    onChange={(e) => setEditingJob(prev => prev ? { ...prev, customer: e.target.value } as any : null)}
                    placeholder="Customer name"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline" onClick={() => setIsEditJobOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleUpdateJob} disabled={updateJobMutation.isPending}>
                  {updateJobMutation.isPending ? 'Updating...' : 'Update Job'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Routing Adjustment Dialog */}
      <Dialog open={isRoutingDialogOpen} onOpenChange={setIsRoutingDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Adjust Routing - {selectedJobForRouting?.jobNumber}</DialogTitle>
          </DialogHeader>
          {selectedJobForRouting && (
            <div className="space-y-4 py-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Part: {selectedJobForRouting.partNumber} | Due: {new Date(selectedJobForRouting.dueDate).toLocaleDateString()}
              </div>
              
              <div className="space-y-4">
                <h4 className="font-medium">Available Machine Groups:</h4>
                {Object.entries(getRoutingOptions()).map(([groupName, groupMachines]) => (
                  <div key={groupName} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                    <h5 className="font-medium mb-2 capitalize">{groupName.replace(/_/g, ' ')}</h5>
                    <div className="grid grid-cols-2 gap-2">
                      {groupMachines.map((machine: any) => (
                        <div key={machine.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded">
                          <span className="text-sm">{machine.machineId} - {machine.name}</span>
                          <Badge variant={machine.status === 'Available' ? 'default' : 'secondary'}>
                            {machine.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline" onClick={() => setIsRoutingDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={() => {
                  toast({
                    title: "Routing Updated",
                    description: "Job routing has been adjusted based on selected machine groups.",
                  });
                  setIsRoutingDialogOpen(false);
                }}>
                  Apply Routing Changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
        </CollapsibleContent>
      </Card>
      
      {/* Manual Scheduling Dialog */}
      <Dialog open={isManualScheduleOpen} onOpenChange={setIsManualScheduleOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manual Schedule Job</DialogTitle>
          </DialogHeader>
          {manualScheduleJob && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <p className="text-sm text-gray-600">
                  <strong>Job:</strong> {manualScheduleJob.jobNumber} - {manualScheduleJob.partNumber}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Description:</strong> {manualScheduleJob.description}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Due Date:</strong> {new Date(manualScheduleJob.dueDate).toLocaleDateString()}
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="manualStartDate">Start Date for First Operation</Label>
                <Input
                  id="manualStartDate"
                  type="date"
                  value={manualStartDate}
                  onChange={(e) => setManualStartDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  data-testid="input-manual-start-date"
                />
                <p className="text-xs text-gray-500">
                  Following operations will be scheduled automatically based on this start date.
                </p>
              </div>
              
              <div className="flex justify-between pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => setIsManualScheduleOpen(false)}
                  data-testid="button-cancel-manual-schedule"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={() => {
                    if (!manualStartDate) {
                      toast({
                        title: "Missing Start Date",
                        description: "Please select a start date for the first operation.",
                        variant: "destructive",
                      });
                      return;
                    }
                    manualScheduleMutation.mutate({
                      jobId: manualScheduleJob.id,
                      startDate: manualStartDate
                    });
                  }}
                  disabled={manualScheduleMutation.isPending || !manualStartDate}
                  data-testid="button-confirm-manual-schedule"
                >
                  {manualScheduleMutation.isPending ? 'Scheduling...' : 'Schedule Job'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Progress tracking for auto-scheduling */}
      <ScheduleProgressToast
        isVisible={isScheduleProgressVisible}
        onClose={() => setIsScheduleProgressVisible(false)}
      />
    </Collapsible>
  );
}
