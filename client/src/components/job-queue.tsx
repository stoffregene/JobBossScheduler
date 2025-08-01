import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Filter, Plus, Calendar, Edit, Zap } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Job } from "@shared/schema";

interface JobQueueProps {
  onJobSelect: (jobId: string) => void;
}

export default function JobQueue({ onJobSelect }: JobQueueProps) {
  const { toast } = useToast();
  const [isAddJobOpen, setIsAddJobOpen] = useState(false);
  const [newJob, setNewJob] = useState({
    jobNumber: '',
    partNumber: '',
    description: '',
    dueDate: '',
    priority: 'Normal' as const,
    estimatedHours: '',
    customer: '',
    operations: [] as string[]
  });

  const { data: jobs, isLoading } = useQuery<Job[]>({
    queryKey: ['/api/jobs'],
  });

  const createJobMutation = useMutation({
    mutationFn: async (jobData: typeof newJob) => {
      const estimatedHours = parseFloat(jobData.estimatedHours) || 2; // Default to 2 hours if not specified
      
      // Create basic routing operations for scheduling
      const routing = [
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
        ...jobData,
        dueDate: new Date(jobData.dueDate),
        estimatedHours,
        quantity: 1,
        createdDate: new Date(),
        status: 'Unscheduled' as const,
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
        dueDate: '',
        priority: 'Normal',
        estimatedHours: '',
        customer: '',
        operations: []
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
      toast({
        title: "Auto-Schedule Failed",
        description: "Unable to automatically schedule this job. Please try manual scheduling.",
        variant: "destructive",
      });
    },
  });

  const handleCreateJob = () => {
    if (!newJob.jobNumber || !newJob.partNumber || !newJob.dueDate) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields (Job Number, Part Number, Due Date).",
        variant: "destructive",
      });
      return;
    }
    createJobMutation.mutate(newJob);
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
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-1" />
                Filter
              </Button>
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
                        <Label htmlFor="dueDate">Due Date *</Label>
                        <Input
                          id="dueDate"
                          type="date"
                          value={newJob.dueDate}
                          onChange={(e) => setNewJob(prev => ({ ...prev, dueDate: e.target.value }))}
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

  const getDaysRemaining = (dueDate: Date) => {
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return { text: `${Math.abs(diffDays)} days overdue`, className: 'text-error-600 font-medium' };
    } else if (diffDays < 4) {
      return { text: `${diffDays} days (Customer Late)`, className: 'text-error-600 font-medium' };
    } else {
      return { text: `${diffDays} days`, className: 'text-gray-500' };
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Job Queue</CardTitle>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-1" />
              Filter
            </Button>
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
                      <Label htmlFor="dueDate">Due Date *</Label>
                      <Input
                        id="dueDate"
                        type="date"
                        value={newJob.dueDate}
                        onChange={(e) => setNewJob(prev => ({ ...prev, dueDate: e.target.value }))}
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
      
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Job #</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Part</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {jobs.map((job) => {
                const daysRemaining = getDaysRemaining(job.dueDate);
                
                return (
                  <tr 
                    key={job.id} 
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => onJobSelect(job.id)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-mono text-gray-900">{job.jobNumber}</div>
                      <div className="text-xs text-gray-500">
                        Created: {new Date(job.createdDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{job.partNumber}</div>
                      <div className="text-xs text-gray-500">{job.description}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {new Date(job.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
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
                      <div className="flex items-center">
                        <div className={`w-2 h-2 ${getPriorityColor(job.priority)} rounded-full mr-2`}></div>
                        <span className="text-sm text-gray-900">{job.priority}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {job.status === 'Unscheduled' && (
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
                          // Manual scheduling logic
                        }}
                      >
                        <Calendar className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          // Edit logic
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
