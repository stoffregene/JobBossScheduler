import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Clock, AlertTriangle, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ResourceUnavailabilityProps {
  onClose?: () => void;
}

export default function ResourceUnavailability({ onClose }: ResourceUnavailabilityProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    resourceIds: [] as string[],
    startDate: "",
    endDate: "",
    reason: "",
    shifts: [1, 2] as number[],
    notes: "",
  });

  // Sample resources - in a real app, these would come from an API
  const availableResources = [
    { id: "emp_001", name: "John Smith", role: "CNC Operator", workCenters: ["HMC-001", "VMC-001"] },
    { id: "emp_002", name: "Sarah Johnson", role: "Setup Technician", workCenters: ["VMC-002", "VMC-003"] },
    { id: "emp_003", name: "Mike Chen", role: "Lathe Operator", workCenters: ["LATHE-001", "LATHE-002"] },
    { id: "emp_004", name: "Lisa Rodriguez", role: "Inspector", workCenters: ["INSPECT-001"] },
  ];

  const reasonOptions = [
    "Vacation",
    "Sick Leave", 
    "Training",
    "Meeting",
    "Personal Leave",
    "Emergency",
    "Other"
  ];

  const markUnavailableMutation = useMutation({
    mutationFn: async (data: any) => {
      if (data.resourceIds.length === 1) {
        return apiRequest(`/api/resources/${data.resourceIds[0]}/mark-unavailable`, "POST", {
          startDate: data.startDate,
          endDate: data.endDate,
          reason: data.reason,
          shifts: data.shifts,
          notes: data.notes,
        });
      } else {
        return apiRequest("/api/resources/bulk-unavailable", "POST", data);
      }
    },
    onSuccess: (result: any) => {
      toast({
        title: "Resources Marked Unavailable",
        description: result.message || "Rescheduling completed successfully",
      });
      
      // Show rescheduling results
      if (result.rescheduleResult) {
        const { conflictsResolved, jobsRescheduled, operationsRescheduled } = result.rescheduleResult;
        toast({
          title: "Automatic Rescheduling Completed",
          description: `${conflictsResolved} conflicts resolved, ${jobsRescheduled} jobs rescheduled, ${operationsRescheduled} operations moved`,
        });
      }

      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["/api/schedule"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      
      // Reset form
      setFormData({
        resourceIds: [],
        startDate: "",
        endDate: "",
        reason: "",
        shifts: [1, 2],
        notes: "",
      });

      if (onClose) onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to mark resources unavailable",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.resourceIds.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please select at least one resource",
        variant: "destructive",
      });
      return;
    }

    if (!formData.startDate || !formData.endDate) {
      toast({
        title: "Validation Error", 
        description: "Please select both start and end dates",
        variant: "destructive",
      });
      return;
    }

    if (!formData.reason) {
      toast({
        title: "Validation Error",
        description: "Please select a reason for unavailability",
        variant: "destructive",
      });
      return;
    }

    markUnavailableMutation.mutate(formData);
  };

  const toggleResource = (resourceId: string) => {
    setFormData(prev => ({
      ...prev,
      resourceIds: prev.resourceIds.includes(resourceId)
        ? prev.resourceIds.filter(id => id !== resourceId)
        : [...prev.resourceIds, resourceId]
    }));
  };

  const toggleShift = (shift: number) => {
    setFormData(prev => ({
      ...prev,
      shifts: prev.shifts.includes(shift)
        ? prev.shifts.filter(s => s !== shift)
        : [...prev.shifts, shift]
    }));
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Mark Resources Unavailable
        </CardTitle>
        <CardDescription>
          Mark operators or technicians as unavailable and automatically reschedule affected jobs within the 28-day lead time.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Resource Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Select Resources
            </Label>
            <div className="grid grid-cols-1 gap-2 max-h-32 overflow-y-auto border rounded-md p-2">
              {availableResources.map((resource) => (
                <div
                  key={resource.id}
                  className={`flex items-center space-x-3 p-2 rounded cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 ${
                    formData.resourceIds.includes(resource.id) ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800' : ''
                  }`}
                  onClick={() => toggleResource(resource.id)}
                >
                  <input
                    type="checkbox"
                    checked={formData.resourceIds.includes(resource.id)}
                    onChange={() => toggleResource(resource.id)}
                    className="rounded"
                  />
                  <div className="flex-1">
                    <div className="font-medium">{resource.name}</div>
                    <div className="text-sm text-gray-500">{resource.role}</div>
                    <div className="text-xs text-gray-400">
                      Work Centers: {resource.workCenters.join(", ")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Start Date
              </Label>
              <Input
                id="startDate"
                type="datetime-local"
                value={formData.startDate}
                onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                End Date
              </Label>
              <Input
                id="endDate"
                type="datetime-local"
                value={formData.endDate}
                onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                required
              />
            </div>
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">Reason for Unavailability</Label>
            <Select value={formData.reason} onValueChange={(value) => setFormData(prev => ({ ...prev, reason: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select reason" />
              </SelectTrigger>
              <SelectContent>
                {reasonOptions.map((reason) => (
                  <SelectItem key={reason} value={reason}>{reason}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Shifts */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Affected Shifts
            </Label>
            <div className="flex gap-4">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.shifts.includes(1)}
                  onChange={() => toggleShift(1)}
                  className="rounded"
                />
                <span>1st Shift</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.shifts.includes(2)}
                  onChange={() => toggleShift(2)}
                  className="rounded"
                />
                <span>2nd Shift</span>
              </label>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Additional Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Enter any additional details..."
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              rows={3}
            />
          </div>

          {/* Summary */}
          {formData.resourceIds.length > 0 && (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <h4 className="font-medium mb-2">Summary</h4>
              <div className="space-y-1 text-sm">
                <div>
                  <strong>Resources:</strong> {formData.resourceIds.length} selected
                </div>
                {formData.startDate && formData.endDate && (
                  <div>
                    <strong>Period:</strong> {new Date(formData.startDate).toLocaleDateString()} - {new Date(formData.endDate).toLocaleDateString()}
                  </div>
                )}
                <div>
                  <strong>Shifts:</strong> {formData.shifts.map(s => `${s}${s === 1 ? 'st' : 'nd'}`).join(', ')}
                </div>
              </div>
              <div className="mt-2 p-2 bg-yellow-100 dark:bg-yellow-900/20 rounded text-xs">
                <strong>Note:</strong> This will automatically reschedule all affected jobs and operations within the 28-day lead time constraint.
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3">
            {onClose && (
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
            )}
            <Button
              type="submit"
              disabled={markUnavailableMutation.isPending || formData.resourceIds.length === 0}
              className="flex items-center gap-2"
            >
              {markUnavailableMutation.isPending && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
              )}
              Mark Unavailable & Reschedule
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}