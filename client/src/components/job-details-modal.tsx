import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Edit, Calendar } from "lucide-react";
import type { Job } from "@shared/schema";

interface JobDetailsModalProps {
  jobId: string;
  onClose: () => void;
}

export default function JobDetailsModal({ jobId, onClose }: JobDetailsModalProps) {
  const { data: job, isLoading } = useQuery<Job>({
    queryKey: ['/api/jobs', jobId],
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
          <div className="flex items-center justify-between">
            <DialogTitle>Job Details - {job.jobNumber}</DialogTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
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
                    year: 'numeric'
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
              <div className="mt-1 text-sm text-gray-900">{parseFloat(job.estimatedHours).toFixed(1)} hours</div>
            </div>
          </div>

          {/* Routing Information */}
          <div className="space-y-4">
            <h4 className="text-md font-semibold text-gray-900">Routing Operations</h4>
            
            {job.routing && job.routing.length > 0 ? (
              <div className="space-y-3">
                {job.routing.map((operation, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          OP-{operation.sequence.toString().padStart(3, '0')}: {operation.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {operation.machineType} ({operation.compatibleMachines.join(', ')})
                        </div>
                      </div>
                      <div className="text-sm text-gray-700">{operation.estimatedHours.toFixed(1)} hours</div>
                    </div>
                    {operation.notes && (
                      <div className="mt-2 text-xs text-gray-600">
                        {operation.notes}
                      </div>
                    )}
                  </div>
                ))}
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
          <Button>
            <Calendar className="h-4 w-4 mr-1" />
            Schedule Job
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
