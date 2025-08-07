import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Edit, Calendar, Zap } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { Job } from "@shared/schema";

interface JobDetailsModalProps {
  jobId: string;
  onClose: () => void;
}

export default function JobDetailsModal({ jobId, onClose }: JobDetailsModalProps) {
  const { toast } = useToast();
  
  const { data: job, isLoading } = useQuery<Job>({
    queryKey: ['/api/jobs', jobId],
  });

  // Fetch all schedule entries and filter for this job
  const { data: allScheduleEntries } = useQuery<any[]>({
    queryKey: ['/api/schedule'],
  });
  
  // Filter schedule entries for this specific job
  const scheduleEntries = allScheduleEntries?.filter(entry => entry.jobId === jobId) || [];

  // Fetch resources to get resource names
  const { data: resources } = useQuery<any[]>({
    queryKey: ['/api/resources'],
  });
  
  // Fetch machines to get compatibility info
  const { data: machines } = useQuery<any[]>({
    queryKey: ['/api/machines'],
  });

  const autoScheduleJobMutation = useMutation({
    mutationFn: () => apiRequest(`/api/jobs/${jobId}/auto-schedule`, 'POST'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/schedule'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      toast({
        title: "Job Auto-Scheduled",
        description: `Job ${job?.jobNumber} has been auto-scheduled successfully.`,
      });
      onClose(); // Close modal after successful scheduling
    },
    onError: (error: any) => {
      const errorMessage = error?.failureDetails || error?.message || "Failed to auto-schedule the job. Please check the routing and try again.";
      toast({
        title: "Auto-Scheduling Failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
  });

  if (isLoading) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-screen overflow-y-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded"></div>
            <div className="h-40 bg-gray-200 rounded"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!job) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent>
          <div className="text-center text-gray-500 py-8">
            Job not found
          </div>
        </DialogContent>
      </Dialog>
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
        return 'bg-error-100 text-error-800';
      case 'High':
        return 'bg-error-100 text-error-800';
      case 'Normal':
        return 'bg-success-100 text-success-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-screen overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Job Details - {job.jobNumber}</DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Job Information */}
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Part Number</label>
              <div className="mt-1 text-sm text-gray-900">{job.partNumber}</div>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-700">Description</label>
              <div className="mt-1 text-sm text-gray-900">{job.description}</div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Quantity</label>
                <div className="mt-1 text-sm text-gray-900">{job.quantity} pieces</div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Due Date</label>
                <div className="mt-1 text-sm text-gray-900">
                  {new Date(job.dueDate).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    timeZone: 'America/Chicago'
                  })}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Priority</label>
                <div className="mt-1">
                  <Badge className={getPriorityColor(job.priority)}>
                    {job.priority}
                  </Badge>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Status</label>
                <div className="mt-1">
                  <Badge className={getStatusColor(job.status)}>
                    {job.status}
                  </Badge>
                </div>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">Estimated Hours</label>
              <div className="mt-1 text-sm text-gray-900">
                {job.estimatedHours ? parseFloat(job.estimatedHours).toFixed(1) : 'Not calculated'} hours
              </div>
            </div>
          </div>

          {/* Routing Information */}
          <div className="space-y-4">
            <h4 className="text-md font-semibold text-gray-900">Routing Operations</h4>
            
            {job.routing && job.routing.length > 0 ? (
              <div className="space-y-3">
                {job.routing.map((operation, index) => {
                  // Find ALL scheduled entries for this operation (may be chunked)
                  const scheduledEntries = scheduleEntries?.filter((entry: any) => 
                    entry.operationSequence === operation.sequence
                  ) || [];
                  const scheduledEntry = scheduledEntries[0]; // For compatibility with existing code
                  const assignedResource = scheduledEntry?.assignedResourceId && resources ? 
                    resources.find((r: any) => r.id === scheduledEntry.assignedResourceId) : null;
                  
                  // Debug logging for troubleshooting
                  if (job?.jobNumber === '59902' || job?.jobNumber === '58905') {
                    console.log(`${job.jobNumber} Debug - Operation ${operation.sequence}:`, {
                      jobId: job.id,
                      operationName: operation.name,
                      machineType: operation.machineType,
                      scheduledEntry: scheduledEntry ? {
                        id: scheduledEntry.id,
                        jobId: scheduledEntry.jobId,
                        operationSequence: scheduledEntry.operationSequence,
                        assignedResourceId: scheduledEntry.assignedResourceId
                      } : null,
                      assignedResource: assignedResource ? {name: assignedResource.name, role: assignedResource.role} : null,
                      allScheduleEntriesForJob: scheduleEntries.length
                    });
                  }
                  
                  // Find compatible resources for this operation
                  const compatibleResources = resources?.filter((resource: any) => {
                    if (!resource.isActive) return false;
                    
                    // Find machines that can handle this operation
                    const compatibleMachineIds = machines?.filter((machine: any) => 
                      operation.compatibleMachines.includes(machine.machineId)
                    ).map((m: any) => m.id) || [];
                    
                    // Check if resource can operate any of the compatible machines
                    const canOperateMachine = resource.workCenters?.some((wcId: string) => 
                      compatibleMachineIds.includes(wcId)
                    );
                    
                    // Apply role-based filtering
                    if (operation.machineType === 'OUTSOURCE') {
                      return false; // No internal resources for outsource
                    } else if (operation.machineType.includes('INSPECT')) {
                      return resource.role === 'Quality Inspector' && canOperateMachine;
                    } else {
                      return (resource.role === 'Operator' || resource.role === 'Shift Lead') && canOperateMachine;
                    }
                  }) || [];

                  return (
                    <div key={index} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            OP-{operation.sequence.toString().padStart(3, '0')}: {operation.name}
                          </div>
                          <div className="text-xs text-gray-500">
                            {operation.machineType} ({operation.compatibleMachines.join(', ')})
                          </div>
                          {scheduledEntries.length > 0 && (
                            <div className="mt-1 space-y-1">
                              <div className="flex items-center space-x-2">
                                <Badge variant="outline" className="text-xs">
                                  {scheduledEntry.status}
                                </Badge>
                                {operation.machineType === 'OUTSOURCE' ? (
                                  <div className="text-xs text-orange-600 font-medium">
                                    🏭 External vendor (no internal resources)
                                  </div>
                                ) : assignedResource ? (
                                  <div className="text-xs text-blue-600 font-medium">
                                    👤 {assignedResource.name} ({assignedResource.role})
                                  </div>
                                ) : (
                                  <div className="text-xs text-gray-500">
                                    Compatible operators: {compatibleResources.length > 0 
                                      ? compatibleResources.map((r: any) => r.name).join(', ')
                                      : 'None available'}
                                  </div>
                                )}
                                {scheduledEntries.length > 1 && (
                                  <Badge variant="secondary" className="text-xs">
                                    {scheduledEntries.length} chunks
                                  </Badge>
                                )}
                              </div>
                              {scheduledEntries.length > 0 && (
                                <div className="text-xs text-gray-600">
                                  Scheduled: {format(new Date(scheduledEntries[0].startTime), 'M/d/yyyy, h:mm a')} - {format(new Date(scheduledEntries[scheduledEntries.length - 1].endTime), 'M/d/yyyy, h:mm a')}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="text-sm text-gray-700">
                          {operation.estimatedHours ? Number(operation.estimatedHours).toFixed(1) : 'Not set'} hours
                        </div>
                      </div>
                      {operation.notes && (
                        <div className="mt-2 text-xs text-gray-600">
                          {operation.notes}
                        </div>
                      )}
                      {scheduledEntry && (
                        <div className="mt-2 text-xs text-gray-500">
                          Scheduled: {new Date(scheduledEntry.startTime).toLocaleString('en-US', {
                            year: 'numeric',
                            month: 'numeric', 
                            day: 'numeric',
                            hour: 'numeric',
                            minute: 'numeric',
                            timeZone: 'America/Chicago'
                          })} - {new Date(scheduledEntry.endTime).toLocaleString('en-US', {
                            year: 'numeric',
                            month: 'numeric',
                            day: 'numeric', 
                            hour: 'numeric',
                            minute: 'numeric',
                            timeZone: 'America/Chicago'
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-4">
                No routing operations defined
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex justify-end space-x-3">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button variant="outline">
            <Edit className="h-4 w-4 mr-1" />
            Edit Job
          </Button>
          <Button 
            onClick={() => autoScheduleJobMutation.mutate()}
            disabled={autoScheduleJobMutation.isPending || job?.status === 'Scheduled' || job?.status === 'Complete'}
            className="bg-primary-500 hover:bg-primary-600 text-white"
          >
            <Zap className="h-4 w-4 mr-1" />
            {autoScheduleJobMutation.isPending ? 'Auto-Scheduling...' : 'Auto Schedule'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
