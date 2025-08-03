import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import ResourceUnavailability from "../components/resource-unavailability";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Calendar, Clock, Users, AlertTriangle, CheckCircle, XCircle, Plus, Edit, Trash2, UserPlus, Settings, Wrench } from "lucide-react";
import type { Resource, Machine, ResourceUnavailability as ResourceUnavailabilityType } from "@shared/schema";
import { insertResourceSchema } from "@shared/schema";
import { z } from "zod";

const resourceFormSchema = insertResourceSchema.extend({
  workCenters: z.array(z.string()).default([]),
  skills: z.array(z.string()).default([]),
  shiftSchedule: z.array(z.number()).min(1, "At least one shift must be selected")
});

type ResourceFormData = z.infer<typeof resourceFormSchema>;

export default function ResourceManagement() {
  const [showUnavailabilityForm, setShowUnavailabilityForm] = useState(false);
  const [showResourceForm, setShowResourceForm] = useState(false);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  const [activeTab, setActiveTab] = useState("directory");

  // Fetch data
  const { data: resources, isLoading: resourcesLoading } = useQuery<Resource[]>({
    queryKey: ['/api/resources'],
  });

  const { data: machines, isLoading: machinesLoading } = useQuery<Machine[]>({
    queryKey: ['/api/machines'],
  });

  const { data: unavailabilities, isLoading: unavailabilitiesLoading } = useQuery<ResourceUnavailabilityType[]>({
    queryKey: ['/api/resource-unavailability'],
  });

  // Form setup
  const form = useForm<ResourceFormData>({
    resolver: zodResolver(resourceFormSchema),
    defaultValues: {
      employeeId: "",
      name: "",
      email: "",
      role: "Operator",
      workCenters: [],
      skills: [],
      shiftSchedule: [1],
      isActive: true
    }
  });

  // Mutations
  const createResourceMutation = useMutation({
    mutationFn: (data: ResourceFormData) => apiRequest('/api/resources', { method: 'POST', body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/resources'] });
      setShowResourceForm(false);
      form.reset();
    }
  });

  const updateResourceMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ResourceFormData> }) => 
      apiRequest(`/api/resources/${id}`, { method: 'PATCH', body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/resources'] });
      setShowResourceForm(false);
      setEditingResource(null);
      form.reset();
    }
  });

  const deleteResourceMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/resources/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/resources'] });
    }
  });

  const handleEditResource = (resource: Resource) => {
    setEditingResource(resource);
    form.reset({
      employeeId: resource.employeeId,
      name: resource.name,
      email: resource.email || "",
      role: resource.role,
      workCenters: resource.workCenters,
      skills: resource.skills,
      shiftSchedule: resource.shiftSchedule,
      isActive: resource.isActive
    });
    setShowResourceForm(true);
  };

  const onSubmit = (data: ResourceFormData) => {
    if (editingResource) {
      updateResourceMutation.mutate({ id: editingResource.id, data });
    } else {
      createResourceMutation.mutate(data);
    }
  };

  const skillOptions = ["lathe_operation", "milling", "vmc_operation", "cnc_programming", "setup", "quality_control", "maintenance", "troubleshooting", "bar_feeding", "quality_inspection", "measurement"];
  const roleOptions = ["Operator", "Technician", "Inspector", "Supervisor", "Setup Technician"];

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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Resource Management</h1>
          <p className="text-muted-foreground">
            Manage people, work center assignments, and availability tracking
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => {
              setEditingResource(null);
              form.reset();
              setShowResourceForm(true);
            }}
            className="flex items-center gap-2"
          >
            <UserPlus className="h-4 w-4" />
            Add Resource
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowUnavailabilityForm(true)}
            className="flex items-center gap-2"
          >
            <AlertTriangle className="h-4 w-4" />
            Mark Unavailable
          </Button>
        </div>
      </div>

      {/* Resource Form Dialog */}
      <Dialog open={showResourceForm} onOpenChange={setShowResourceForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingResource ? "Edit Resource" : "Add New Resource"}
            </DialogTitle>
            <DialogDescription>
              {editingResource ? "Update resource information and assignments." : "Add a new person to the manufacturing team."}
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="employeeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Employee ID</FormLabel>
                      <FormControl>
                        <Input placeholder="EMP001" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input placeholder="John Smith" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="john.smith@company.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {roleOptions.map(role => (
                            <SelectItem key={role} value={role}>{role}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="workCenters"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Work Centers</FormLabel>
                    <FormDescription>
                      Select machines this person can operate
                    </FormDescription>
                    <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto border rounded p-2">
                      {machines?.map(machine => (
                        <div key={machine.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`machine-${machine.id}`}
                            checked={field.value.includes(machine.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                field.onChange([...field.value, machine.id]);
                              } else {
                                field.onChange(field.value.filter(id => id !== machine.id));
                              }
                            }}
                          />
                          <Label htmlFor={`machine-${machine.id}`} className="text-sm">
                            {machine.machineId}
                          </Label>
                        </div>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="skills"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Skills</FormLabel>
                    <FormDescription>
                      Select skills and capabilities
                    </FormDescription>
                    <div className="grid grid-cols-3 gap-2 max-h-32 overflow-y-auto border rounded p-2">
                      {skillOptions.map(skill => (
                        <div key={skill} className="flex items-center space-x-2">
                          <Checkbox
                            id={`skill-${skill}`}
                            checked={field.value.includes(skill)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                field.onChange([...field.value, skill]);
                              } else {
                                field.onChange(field.value.filter(s => s !== skill));
                              }
                            }}
                          />
                          <Label htmlFor={`skill-${skill}`} className="text-sm">
                            {skill.replace(/_/g, ' ')}
                          </Label>
                        </div>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="shiftSchedule"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Shift Schedule</FormLabel>
                    <FormDescription>
                      Select normal working shifts
                    </FormDescription>
                    <div className="flex gap-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="shift-1"
                          checked={field.value.includes(1)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              field.onChange([...field.value, 1]);
                            } else {
                              field.onChange(field.value.filter(s => s !== 1));
                            }
                          }}
                        />
                        <Label htmlFor="shift-1">1st Shift (3AM - 3PM)</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="shift-2"
                          checked={field.value.includes(2)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              field.onChange([...field.value, 2]);
                            } else {
                              field.onChange(field.value.filter(s => s !== 2));
                            }
                          }}
                        />
                        <Label htmlFor="shift-2">2nd Shift (3PM - 3AM)</Label>
                      </div>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Active Status</FormLabel>
                      <FormDescription>
                        Active resources can be scheduled for work
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowResourceForm(false)}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createResourceMutation.isPending || updateResourceMutation.isPending}
                >
                  {editingResource ? "Update Resource" : "Add Resource"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Unavailability Form Dialog */}
      {showUnavailabilityForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <ResourceUnavailability onClose={() => setShowUnavailabilityForm(false)} />
          </div>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="directory">Resource Directory</TabsTrigger>
          <TabsTrigger value="assignments">Work Center Assignments</TabsTrigger>
          <TabsTrigger value="availability">Availability Tracking</TabsTrigger>
        </TabsList>

        <TabsContent value="directory" className="space-y-4">
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
                        onClick={() => handleEditResource(resource)}
                        data-testid={`edit-resource-${resource.employeeId}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteResourceMutation.mutate(resource.id)}
                        className="text-red-600 hover:text-red-700"
                        data-testid={`delete-resource-${resource.employeeId}`}
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
        </TabsContent>

        <TabsContent value="assignments" className="space-y-4">
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
                        <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No qualified operators assigned to this machine</p>
                        <p className="text-sm">Edit resources to assign operators to this work center</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="availability" className="space-y-4">

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Upcoming Unavailabilities */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Upcoming Unavailabilities
                </CardTitle>
                <CardDescription>
                  Scheduled resource unavailability periods
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {unavailabilities?.filter(u => new Date(u.endDate) >= new Date()).map(unavailability => {
                    const resource = resources?.find(r => r.id === unavailability.resourceId);
                    const isActive = new Date(unavailability.startDate) <= new Date() && new Date(unavailability.endDate) >= new Date();
                    
                    return (
                      <div key={unavailability.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1">
                          <div className="font-medium">{resource?.name || 'Unknown Resource'}</div>
                          <div className="text-sm text-muted-foreground">{unavailability.reason}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-4 mt-1">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(unavailability.startDate).toLocaleDateString()} - {new Date(unavailability.endDate).toLocaleDateString()}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Shifts: {unavailability.shifts.map(s => `${s}${s === 1 ? 'st' : 'nd'}`).join(', ')}
                            </span>
                          </div>
                        </div>
                        <Badge variant={isActive ? 'destructive' : 'secondary'}>
                          {isActive ? 'active' : 'scheduled'}
                        </Badge>
                      </div>
                    );
                  })}
                  {(!unavailabilities || unavailabilities.filter(u => new Date(u.endDate) >= new Date()).length === 0) && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No upcoming unavailabilities scheduled</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Resource Summary */}
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
                      <span>1st Shift Coverage:</span>
                      <span>{resources?.filter(r => r.isActive && r.shiftSchedule.includes(1)).length || 0} operators</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>2nd Shift Coverage:</span>
                      <span>{resources?.filter(r => r.isActive && r.shiftSchedule.includes(2)).length || 0} operators</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Currently Unavailable:</span>
                      <span>{unavailabilities?.filter(u => {
                        const now = new Date();
                        return new Date(u.startDate) <= now && new Date(u.endDate) >= now;
                      }).length || 0} resources</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Key Features */}
      <Card>
        <CardHeader>
          <CardTitle>28-Day Lead Time Rescheduling</CardTitle>
          <CardDescription>
            How the automatic rescheduling system works
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                <h3 className="font-medium">Conflict Detection</h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Automatically identifies scheduling conflicts when resources become unavailable
              </p>
            </div>
            
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-5 w-5 text-blue-500" />
                <h3 className="font-medium">Intelligent Substitution</h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Uses tier-based machine substitution and resource skills to find alternatives
              </p>
            </div>
            
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <h3 className="font-medium">Route Dependencies</h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Maintains routing sequence dependencies while rescheduling operations
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}