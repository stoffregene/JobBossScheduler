import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Users, UserPlus, Edit, Trash2, Settings, Wrench, X, Plus, ArrowLeft, Package, Building2, Calendar, Clock, AlertTriangle } from "lucide-react";
import { Link } from "wouter";
import type { Resource, Machine, ResourceUnavailability } from "@shared/schema";

export default function ResourceManagement() {
  const [activeTab, setActiveTab] = useState("directory");
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  const [deletingResource, setDeletingResource] = useState<Resource | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showUnavailabilityDialog, setShowUnavailabilityDialog] = useState(false);
  const [unavailabilityForm, setUnavailabilityForm] = useState({
    resourceIds: [] as string[],
    startDate: "",
    endDate: "",
    startTime: "",
    endTime: "",
    isPartialDay: false,
    reason: "",
    shifts: [1, 2] as number[],
    notes: "",
  });
  const [editForm, setEditForm] = useState({
    name: "",
    employeeId: "",
    email: "",
    role: "",
    isActive: true,
    shiftSchedule: [] as number[],
    workCenters: [] as string[],
    skills: [] as string[]
  });
  const { toast } = useToast();

  // Fetch data
  const { data: resources, isLoading: resourcesLoading } = useQuery<Resource[]>({
    queryKey: ['/api/resources'],
  });

  const { data: machines, isLoading: machinesLoading } = useQuery<Machine[]>({
    queryKey: ['/api/machines'],
  });

  const { data: unavailabilityData, isLoading: unavailabilityLoading } = useQuery<ResourceUnavailability[]>({
    queryKey: ['/api/resource-unavailability'],
  });

  // Mutations
  const updateResourceMutation = useMutation({
    mutationFn: (data: { id: string; resource: Partial<Resource> }) =>
      apiRequest(`/api/resources/${data.id}`, 'PATCH', data.resource),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/resources'] });
      setEditingResource(null);
      toast({ title: "Resource updated successfully" });
    },
    onError: (error) => {
      toast({ 
        title: "Error updating resource", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  const deleteResourceMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/resources/${id}`, 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/resources'] });
      setDeletingResource(null);
      toast({ title: "Resource deleted successfully" });
    },
    onError: (error) => {
      toast({ 
        title: "Error deleting resource", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  const createResourceMutation = useMutation({
    mutationFn: (resource: Partial<Resource>) => {
      console.log('Making API request with:', resource);
      return apiRequest('/api/resources', 'POST', resource);
    },
    onSuccess: (data) => {
      console.log('Resource created successfully:', data);
      queryClient.invalidateQueries({ queryKey: ['/api/resources'] });
      setShowAddDialog(false);
      setEditForm({
        name: "",
        employeeId: "",
        email: "",
        role: "",
        isActive: true,
        shiftSchedule: [],
        workCenters: [],
        skills: []
      });
      toast({ title: "Resource created successfully" });
    },
    onError: (error) => {
      console.error('Error creating resource:', error);
      let errorMessage = error.message;
      
      // Handle specific duplicate employee ID error
      if (error.message.includes('duplicate key') && error.message.includes('employee_id')) {
        errorMessage = `Employee ID "${editForm.employeeId}" already exists. Please use a different Employee ID.`;
      }
      
      toast({ 
        title: "Error creating resource", 
        description: errorMessage,
        variant: "destructive" 
      });
    }
  });

  // Helper functions
  const openEditDialog = (resource: Resource) => {
    setEditingResource(resource);
    setEditForm({
      name: resource.name,
      employeeId: resource.employeeId,
      email: resource.email || "",
      role: resource.role,
      isActive: resource.isActive,
      shiftSchedule: [...resource.shiftSchedule],
      workCenters: [...resource.workCenters],
      skills: [...resource.skills]
    });
  };

  const handleSaveResource = () => {
    if (!editingResource) return;
    
    updateResourceMutation.mutate({
      id: editingResource.id,
      resource: editForm
    });
  };

  const handleDeleteResource = () => {
    if (!deletingResource?.id) return;
    deleteResourceMutation.mutate(deletingResource.id);
  };

  const openAddDialog = () => {
    // Generate a unique employee ID suggestion
    const existingIds = resources?.map(r => r.employeeId) || [];
    let suggestedId = "";
    for (let i = 1; i <= 999; i++) {
      const testId = `EMP${i.toString().padStart(3, '0')}`;
      if (!existingIds.includes(testId)) {
        suggestedId = testId;
        break;
      }
    }
    
    setEditForm({
      name: "",
      employeeId: suggestedId,
      email: "",
      role: "",
      isActive: true,
      shiftSchedule: [1],
      workCenters: [],
      skills: []
    });
    setShowAddDialog(true);
  };

  const handleCreateResource = () => {
    console.log('Creating resource with data:', editForm);
    createResourceMutation.mutate(editForm);
  };

  const markUnavailableMutation = useMutation({
    mutationFn: (data: typeof unavailabilityForm) =>
      apiRequest('/api/resource-unavailability', 'POST', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/resource-unavailability'] });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/schedule'] });
      setShowUnavailabilityDialog(false);
      setUnavailabilityForm({
        resourceIds: [],
        startDate: "",
        endDate: "",
        startTime: "",
        endTime: "",
        isPartialDay: false,
        reason: "",
        shifts: [1, 2],
        notes: "",
      });
      toast({ title: "Employee unavailability recorded", description: "Jobs have been automatically rescheduled if needed." });
    },
    onError: (error) => {
      toast({ 
        title: "Error recording unavailability", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  const deleteUnavailabilityMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/resource-unavailability/${id}`, 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/resource-unavailability'] });
      toast({ title: "Unavailability period removed" });
    },
    onError: (error) => {
      toast({ 
        title: "Error removing unavailability", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  const handleMarkUnavailable = () => {
    if (unavailabilityForm.resourceIds.length === 0) {
      toast({ title: "Please select at least one employee", variant: "destructive" });
      return;
    }
    if (!unavailabilityForm.startDate || !unavailabilityForm.endDate) {
      toast({ title: "Please select start and end dates", variant: "destructive" });
      return;
    }
    markUnavailableMutation.mutate(unavailabilityForm);
  };

  const toggleUnavailabilityResource = (resourceId: string) => {
    setUnavailabilityForm(prev => ({
      ...prev,
      resourceIds: prev.resourceIds.includes(resourceId)
        ? prev.resourceIds.filter(id => id !== resourceId)
        : [...prev.resourceIds, resourceId]
    }));
  };

  const toggleUnavailabilityShift = (shift: number) => {
    setUnavailabilityForm(prev => ({
      ...prev,
      shifts: prev.shifts.includes(shift)
        ? prev.shifts.filter(s => s !== shift)
        : [...prev.shifts, shift]
    }));
  };

  const toggleShift = (shift: number) => {
    setEditForm(prev => ({
      ...prev,
      shiftSchedule: prev.shiftSchedule.includes(shift)
        ? prev.shiftSchedule.filter(s => s !== shift)
        : [...prev.shiftSchedule, shift]
    }));
  };

  const toggleWorkCenter = (workCenterId: string) => {
    setEditForm(prev => ({
      ...prev,
      workCenters: prev.workCenters.includes(workCenterId)
        ? prev.workCenters.filter(wc => wc !== workCenterId)
        : [...prev.workCenters, workCenterId]
    }));
  };

  const addSkill = (skill: string) => {
    if (skill && !editForm.skills.includes(skill)) {
      setEditForm(prev => ({
        ...prev,
        skills: [...prev.skills, skill]
      }));
    }
  };

  const removeSkill = (skill: string) => {
    setEditForm(prev => ({
      ...prev,
      skills: prev.skills.filter(s => s !== skill)
    }));
  };

  if (resourcesLoading || machinesLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-64"></div>
          <div className="h-4 bg-muted rounded w-96"></div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-64 bg-muted rounded"></div>
            <div className="h-64 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Navigation Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="outline" size="sm" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Button>
          </Link>
          <Link href="/materials">
            <Button variant="outline" size="sm" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Material Tracking
            </Button>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <Building2 className="text-primary-500 text-xl" />
          <span className="text-xl font-bold text-gray-900 dark:text-white">JobBoss Scheduler</span>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Resource Management</h1>
          <p className="text-muted-foreground">
            Manage people, work center assignments, and availability tracking
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={openAddDialog}
            className="flex items-center gap-2"
            data-testid="button-add-resource"
          >
            <UserPlus className="h-4 w-4" />
            Add Resource
          </Button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-muted p-1 rounded-lg">
        <button
          onClick={() => setActiveTab("directory")}
          className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === "directory"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Resource Directory
        </button>
        <button
          onClick={() => setActiveTab("assignments")}
          className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === "assignments"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Work Center Assignments
        </button>
        <button
          onClick={() => setActiveTab("availability")}
          className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === "availability"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Availability Tracking
        </button>
        <button
          onClick={() => setActiveTab("unavailability")}
          className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === "unavailability"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Manage Unavailability
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "directory" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Team Members
            </CardTitle>
            <CardDescription>
              {resources?.length || 0} active resources in the system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {resources?.map(resource => (
                <div key={resource.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="font-semibold">{resource.name}</div>
                        <div className="text-sm text-muted-foreground">{resource.employeeId} • {resource.role}</div>
                        <div className="text-xs text-muted-foreground">{resource.email}</div>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <Badge variant="outline">
                        {resource.shiftSchedule.map(s => `Shift ${s}`).join(', ')}
                      </Badge>
                      <Badge variant="outline">
                        {resource.workCenters.length} work centers
                      </Badge>
                      <Badge variant="outline">
                        {resource.skills.length} skills
                      </Badge>
                      <Badge variant={resource.isActive ? "default" : "secondary"}>
                        {resource.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => openEditDialog(resource)}
                      data-testid={`button-edit-${resource.employeeId}`}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-red-600 hover:text-red-700"
                      onClick={() => setDeletingResource(resource)}
                      data-testid={`button-delete-${resource.employeeId}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {(!resources || resources.length === 0) && (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No resources found. Add your first team member to get started.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "assignments" && (
        <div className="grid gap-6">
          {machines?.map(machine => {
            const assignedResources = resources?.filter(r => 
              r.isActive && r.workCenters.includes(machine.id)
            ) || [];
            
            return (
              <Card key={machine.id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wrench className="h-5 w-5" />
                    {machine.machineId} - {machine.name}
                  </CardTitle>
                  <CardDescription>
                    {machine.type} • {assignedResources.length} qualified operators
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {assignedResources.length > 0 ? (
                    <div className="grid gap-2">
                      {assignedResources.map(resource => (
                        <div key={resource.id} className="flex items-center justify-between p-2 border rounded">
                          <div>
                            <div className="font-medium">{resource.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {resource.role} • Shifts: {resource.shiftSchedule.join(', ')}
                            </div>
                          </div>
                          <div className="flex gap-1">
                            {resource.skills.filter(skill => 
                              skill.includes(machine.type.toLowerCase()) || 
                              skill.includes('operation') || 
                              skill.includes('setup')
                            ).map(skill => (
                              <Badge key={skill} variant="outline" className="text-xs">
                                {skill.replace(/_/g, ' ')}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-muted-foreground">
                      <Settings className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No qualified operators assigned to this machine</p>
                      <p className="text-sm">Edit resources to assign operators to this work center</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {activeTab === "availability" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Resource Summary
              </CardTitle>
              <CardDescription>
                Current resource allocation and capacity
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{resources?.filter(r => r.isActive).length || 0}</div>
                    <div className="text-sm text-muted-foreground">Active Resources</div>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{machines?.length || 0}</div>
                    <div className="text-sm text-muted-foreground">Work Centers</div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>1st Shift Coverage (3 AM-3 PM):</span>
                    <span>{resources?.filter(r => r.isActive && r.shiftSchedule.includes(1)).length || 0} operators</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>2nd Shift Coverage (3 PM-3 AM):</span>
                    <span>{resources?.filter(r => r.isActive && r.shiftSchedule.includes(2)).length || 0} operators</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Working Days:</span>
                    <span>Monday - Thursday</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Unavailability Management Tab */}
      {activeTab === "unavailability" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Mark Employee Unavailable */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Mark Employee Unavailable
              </CardTitle>
              <CardDescription>
                Schedule employee time off and automatically reschedule affected jobs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => setShowUnavailabilityDialog(true)}
                className="w-full"
                data-testid="button-mark-unavailable"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Unavailability Period
              </Button>
            </CardContent>
          </Card>

          {/* Current Unavailability Periods */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Current Unavailability
              </CardTitle>
              <CardDescription>
                Active and scheduled employee unavailability periods
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {unavailabilityLoading ? (
                  <div className="text-sm text-muted-foreground">Loading...</div>
                ) : unavailabilityData && unavailabilityData.length > 0 ? (
                  unavailabilityData.map(item => {
                    const resource = resources?.find(r => r.id === item.resourceId);
                    // Use Central Time for proper comparison
                    const now = new Date();
                    const today = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
                    today.setHours(0, 0, 0, 0);
                    
                    const startDate = new Date(item.startDate);
                    const endDate = new Date(item.endDate);
                    endDate.setHours(23, 59, 59, 999); // End of day for comparison
                    
                    const isActive = startDate <= now && endDate >= now;
                    const isUpcoming = startDate > now;
                    
                    return (
                      <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{resource?.name || 'Multiple Employees'}</span>
                            <Badge variant={isActive ? "destructive" : isUpcoming ? "secondary" : "outline"}>
                              {isActive ? "Active" : isUpcoming ? "Scheduled" : "Past"}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {item.reason} • {new Date(item.startDate).toLocaleDateString('en-US', { timeZone: 'UTC' })} - {new Date(item.endDate).toLocaleDateString('en-US', { timeZone: 'UTC' })}
                          </div>
                          {item.shifts && (
                            <div className="text-xs text-muted-foreground">
                              Shifts: {item.shifts.map(s => s === 1 ? "1st" : "2nd").join(", ")}
                            </div>
                          )}
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => deleteUnavailabilityMutation.mutate(item.id)}
                          data-testid={`button-remove-unavailability-${item.id}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-sm text-muted-foreground">No unavailability periods scheduled</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit Resource Dialog */}
      <Dialog open={!!editingResource} onOpenChange={() => setEditingResource(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Resource: {editingResource?.name}</DialogTitle>
            <DialogDescription>
              Update employee details, work center assignments, shifts, and skills
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-6">
            {/* Basic Information */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={editForm.name}
                  onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                  data-testid="input-edit-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="employeeId">Employee ID</Label>
                <Input
                  id="employeeId"
                  value={editForm.employeeId}
                  onChange={(e) => setEditForm(prev => ({ ...prev, employeeId: e.target.value }))}
                  data-testid="input-edit-employee-id"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                  data-testid="input-edit-email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select 
                  value={editForm.role} 
                  onValueChange={(value) => setEditForm(prev => ({ ...prev, role: value }))}
                >
                  <SelectTrigger data-testid="select-edit-role">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Operator">Operator</SelectItem>
                    <SelectItem value="Setup Technician">Setup Technician</SelectItem>
                    <SelectItem value="Quality Inspector">Quality Inspector</SelectItem>
                    <SelectItem value="Maintenance">Maintenance</SelectItem>
                    <SelectItem value="Supervisor">Supervisor</SelectItem>
                    <SelectItem value="Lead Operator">Lead Operator</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="isActive"
                checked={editForm.isActive}
                onCheckedChange={(checked) => setEditForm(prev => ({ ...prev, isActive: !!checked }))}
                data-testid="checkbox-edit-active"
              />
              <Label htmlFor="isActive">Active Employee</Label>
            </div>

            <Separator />

            {/* Shift Schedule */}
            <div className="space-y-4">
              <div>
                <Label className="text-base font-medium">Shift Schedule</Label>
                <p className="text-sm text-muted-foreground">Select which shifts this employee works</p>
              </div>
              <div className="flex gap-4">
                {[1, 2].map(shift => (
                  <div key={shift} className="flex items-center space-x-2">
                    <Checkbox
                      id={`shift-${shift}`}
                      checked={editForm.shiftSchedule.includes(shift)}
                      onCheckedChange={() => toggleShift(shift)}
                      data-testid={`checkbox-edit-shift-${shift}`}
                    />
                    <Label htmlFor={`shift-${shift}`}>
                      {shift === 1 ? "1st Shift (3 AM - 3 PM) Mon-Thu" : 
                       "2nd Shift (3 PM - 3 AM) Mon-Thu"}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Work Center Assignments */}
            <div className="space-y-4">
              <div>
                <Label className="text-base font-medium">Work Center Assignments</Label>
                <p className="text-sm text-muted-foreground">Select which machines this employee can operate</p>
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                {machines?.map(machine => (
                  <div key={machine.id} className="flex items-center space-x-2 p-2 border rounded">
                    <Checkbox
                      id={`machine-${machine.id}`}
                      checked={editForm.workCenters.includes(machine.id)}
                      onCheckedChange={() => toggleWorkCenter(machine.id)}
                      data-testid={`checkbox-edit-machine-${machine.machineId}`}
                    />
                    <div className="flex-1 min-w-0">
                      <Label htmlFor={`machine-${machine.id}`} className="text-sm font-medium">
                        {machine.machineId}
                      </Label>
                      <div className="text-xs text-muted-foreground truncate">
                        {machine.name} • {machine.type}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Skills Management */}
            <div className="space-y-4">
              <div>
                <Label className="text-base font-medium">Skills & Certifications</Label>
                <p className="text-sm text-muted-foreground">Manage employee skills and certifications</p>
              </div>
              
              <div className="flex gap-2">
                <Select onValueChange={addSkill}>
                  <SelectTrigger className="flex-1" data-testid="select-add-skill">
                    <SelectValue placeholder="Add a skill..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cnc_operation">CNC Operation</SelectItem>
                    <SelectItem value="manual_operation">Manual Operation</SelectItem>
                    <SelectItem value="setup_certification">Setup Certification</SelectItem>
                    <SelectItem value="quality_inspection">Quality Inspection</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="crane_operation">Crane Operation</SelectItem>
                    <SelectItem value="forklift_operation">Forklift Operation</SelectItem>
                    <SelectItem value="programming">Programming</SelectItem>
                    <SelectItem value="tooling">Tooling</SelectItem>
                    <SelectItem value="blueprint_reading">Blueprint Reading</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-wrap gap-2">
                {editForm.skills.map(skill => (
                  <Badge key={skill} variant="secondary" className="gap-1">
                    {skill.replace(/_/g, ' ')}
                    <X 
                      className="h-3 w-3 cursor-pointer" 
                      onClick={() => removeSkill(skill)}
                      data-testid={`button-remove-skill-${skill}`}
                    />
                  </Badge>
                ))}
                {editForm.skills.length === 0 && (
                  <p className="text-sm text-muted-foreground">No skills assigned yet</p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setEditingResource(null)}
              data-testid="button-cancel-edit"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSaveResource}
              disabled={updateResourceMutation.isPending}
              data-testid="button-save-edit"
            >
              {updateResourceMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingResource} onOpenChange={() => setDeletingResource(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Resource</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deletingResource?.name}</strong>? 
              This action cannot be undone and will remove all work center assignments and scheduling data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteResource}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-confirm-delete"
            >
              {deleteResourceMutation.isPending ? "Deleting..." : "Delete Resource"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Mark Unavailable Dialog */}
      <Dialog open={showUnavailabilityDialog} onOpenChange={setShowUnavailabilityDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Mark Employee Unavailable</DialogTitle>
            <DialogDescription>
              Select employees, dates, and shifts for unavailability. Jobs will be automatically rescheduled.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Employee Selection */}
            <div>
              <Label className="text-sm font-medium">Select Employees</Label>
              <div className="grid grid-cols-2 gap-2 mt-2 max-h-32 overflow-y-auto border rounded p-2">
                {resources?.map(resource => (
                  <div key={resource.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`resource-${resource.id}`}
                      checked={unavailabilityForm.resourceIds.includes(resource.id)}
                      onCheckedChange={() => toggleUnavailabilityResource(resource.id)}
                      data-testid={`checkbox-employee-${resource.employeeId}`}
                    />
                    <Label htmlFor={`resource-${resource.id}`} className="text-sm">
                      {resource.name} ({resource.employeeId})
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="start-date">Start Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={unavailabilityForm.startDate}
                  onChange={(e) => setUnavailabilityForm(prev => ({ ...prev, startDate: e.target.value }))}
                  data-testid="input-start-date"
                />
              </div>
              <div>
                <Label htmlFor="end-date">End Date</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={unavailabilityForm.endDate}
                  onChange={(e) => setUnavailabilityForm(prev => ({ ...prev, endDate: e.target.value }))}
                  data-testid="input-end-date"
                />
              </div>
            </div>

            {/* Partial Day Toggle */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="isPartialDay"
                checked={unavailabilityForm.isPartialDay}
                onCheckedChange={(checked) => 
                  setUnavailabilityForm(prev => ({ 
                    ...prev, 
                    isPartialDay: !!checked,
                    startTime: checked ? "08:00" : "",
                    endTime: checked ? "17:00" : ""
                  }))
                }
                data-testid="checkbox-partial-day"
              />
              <Label htmlFor="isPartialDay">Partial Day (specify hours)</Label>
            </div>

            {/* Time Range - only shown for partial day */}
            {unavailabilityForm.isPartialDay && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startTime">Start Time</Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={unavailabilityForm.startTime}
                    onChange={(e) => setUnavailabilityForm(prev => ({ ...prev, startTime: e.target.value }))}
                    data-testid="input-start-time"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endTime">End Time</Label>
                  <Input
                    id="endTime"
                    type="time"
                    value={unavailabilityForm.endTime}
                    onChange={(e) => setUnavailabilityForm(prev => ({ ...prev, endTime: e.target.value }))}
                    data-testid="input-end-time"
                  />
                </div>
              </div>
            )}

            {/* Reason */}
            <div>
              <Label htmlFor="reason">Reason</Label>
              <Select 
                value={unavailabilityForm.reason} 
                onValueChange={(value) => setUnavailabilityForm(prev => ({ ...prev, reason: value }))}
              >
                <SelectTrigger data-testid="select-reason">
                  <SelectValue placeholder="Select reason for unavailability" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Vacation">Vacation</SelectItem>
                  <SelectItem value="Sick Leave">Sick Leave</SelectItem>
                  <SelectItem value="Training">Training</SelectItem>
                  <SelectItem value="Meeting">Meeting</SelectItem>
                  <SelectItem value="Personal Leave">Personal Leave</SelectItem>
                  <SelectItem value="Emergency">Emergency</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Shift Selection */}
            <div>
              <Label className="text-sm font-medium">Affected Shifts</Label>
              <div className="flex gap-4 mt-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="shift-1"
                    checked={unavailabilityForm.shifts.includes(1)}
                    onCheckedChange={() => toggleUnavailabilityShift(1)}
                    data-testid="checkbox-shift-1"
                  />
                  <Label htmlFor="shift-1">1st Shift (3am-3pm)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="shift-2"
                    checked={unavailabilityForm.shifts.includes(2)}
                    onCheckedChange={() => toggleUnavailabilityShift(2)}
                    data-testid="checkbox-shift-2"
                  />
                  <Label htmlFor="shift-2">2nd Shift (3pm-3am)</Label>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <Label htmlFor="notes">Additional Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Any additional details about this unavailability..."
                value={unavailabilityForm.notes}
                onChange={(e) => setUnavailabilityForm(prev => ({ ...prev, notes: e.target.value }))}
                data-testid="textarea-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowUnavailabilityDialog(false)}
              data-testid="button-cancel-unavailability"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleMarkUnavailable}
              disabled={markUnavailableMutation.isPending}
              data-testid="button-confirm-unavailability"
            >
              {markUnavailableMutation.isPending ? "Processing..." : "Mark Unavailable"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Resource Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Resource</DialogTitle>
            <DialogDescription>
              Create a new employee with work center assignments, shifts, and skills
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-6">
            {/* Basic Information */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="add-name">Full Name</Label>
                <Input
                  id="add-name"
                  value={editForm.name}
                  onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                  data-testid="input-add-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-employeeId">Employee ID</Label>
                <Input
                  id="add-employeeId"
                  value={editForm.employeeId}
                  onChange={(e) => setEditForm(prev => ({ ...prev, employeeId: e.target.value }))}
                  data-testid="input-add-employee-id"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-email">Email</Label>
                <Input
                  id="add-email"
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                  data-testid="input-add-email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-role">Role</Label>
                <Select 
                  value={editForm.role} 
                  onValueChange={(value) => setEditForm(prev => ({ ...prev, role: value }))}
                >
                  <SelectTrigger data-testid="select-add-role">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Operator">Operator</SelectItem>
                    <SelectItem value="Setup Technician">Setup Technician</SelectItem>
                    <SelectItem value="Quality Inspector">Quality Inspector</SelectItem>
                    <SelectItem value="Maintenance">Maintenance</SelectItem>
                    <SelectItem value="Supervisor">Supervisor</SelectItem>
                    <SelectItem value="Lead Operator">Lead Operator</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="add-isActive"
                checked={editForm.isActive}
                onCheckedChange={(checked) => setEditForm(prev => ({ ...prev, isActive: !!checked }))}
                data-testid="checkbox-add-active"
              />
              <Label htmlFor="add-isActive">Active Employee</Label>
            </div>

            <Separator />

            {/* Shift Schedule */}
            <div className="space-y-4">
              <div>
                <Label className="text-base font-medium">Shift Schedule</Label>
                <p className="text-sm text-muted-foreground">Select which shifts this employee works</p>
              </div>
              <div className="flex gap-4">
                {[1, 2].map(shift => (
                  <div key={shift} className="flex items-center space-x-2">
                    <Checkbox
                      id={`add-shift-${shift}`}
                      checked={editForm.shiftSchedule.includes(shift)}
                      onCheckedChange={() => toggleShift(shift)}
                      data-testid={`checkbox-add-shift-${shift}`}
                    />
                    <Label htmlFor={`add-shift-${shift}`}>
                      {shift === 1 ? "1st Shift (3 AM - 3 PM) Mon-Thu" : 
                       "2nd Shift (3 PM - 3 AM) Mon-Thu"}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Work Center Assignments */}
            <div className="space-y-4">
              <div>
                <Label className="text-base font-medium">Work Center Assignments</Label>
                <p className="text-sm text-muted-foreground">Select which machines this employee can operate</p>
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                {machines?.map(machine => (
                  <div key={machine.id} className="flex items-center space-x-2 p-2 border rounded">
                    <Checkbox
                      id={`add-machine-${machine.id}`}
                      checked={editForm.workCenters.includes(machine.id)}
                      onCheckedChange={() => toggleWorkCenter(machine.id)}
                      data-testid={`checkbox-add-machine-${machine.machineId}`}
                    />
                    <div className="flex-1 min-w-0">
                      <Label htmlFor={`add-machine-${machine.id}`} className="text-sm font-medium">
                        {machine.machineId}
                      </Label>
                      <div className="text-xs text-muted-foreground truncate">
                        {machine.name} • {machine.type}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Skills Management */}
            <div className="space-y-4">
              <div>
                <Label className="text-base font-medium">Skills & Certifications</Label>
                <p className="text-sm text-muted-foreground">Manage employee skills and certifications</p>
              </div>
              
              <div className="flex gap-2">
                <Select onValueChange={addSkill}>
                  <SelectTrigger className="flex-1" data-testid="select-add-skill-new">
                    <SelectValue placeholder="Add a skill..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cnc_operation">CNC Operation</SelectItem>
                    <SelectItem value="manual_operation">Manual Operation</SelectItem>
                    <SelectItem value="setup_certification">Setup Certification</SelectItem>
                    <SelectItem value="quality_inspection">Quality Inspection</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="crane_operation">Crane Operation</SelectItem>
                    <SelectItem value="forklift_operation">Forklift Operation</SelectItem>
                    <SelectItem value="programming">Programming</SelectItem>
                    <SelectItem value="tooling">Tooling</SelectItem>
                    <SelectItem value="blueprint_reading">Blueprint Reading</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-wrap gap-2">
                {editForm.skills.map(skill => (
                  <Badge key={skill} variant="secondary" className="gap-1">
                    {skill.replace(/_/g, ' ')}
                    <X 
                      className="h-3 w-3 cursor-pointer" 
                      onClick={() => removeSkill(skill)}
                      data-testid={`button-remove-skill-new-${skill}`}
                    />
                  </Badge>
                ))}
                {editForm.skills.length === 0 && (
                  <p className="text-sm text-muted-foreground">No skills assigned yet</p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowAddDialog(false)}
              data-testid="button-cancel-add"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleCreateResource}
              disabled={createResourceMutation.isPending}
              data-testid="button-save-add"
            >
              {createResourceMutation.isPending ? "Creating..." : "Create Resource"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}