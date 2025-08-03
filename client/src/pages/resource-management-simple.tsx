import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, UserPlus, Edit, Trash2, Settings, Wrench } from "lucide-react";
import type { Resource, Machine } from "@shared/schema";

export default function ResourceManagement() {
  const [activeTab, setActiveTab] = useState("directory");

  // Fetch data
  const { data: resources, isLoading: resourcesLoading } = useQuery<Resource[]>({
    queryKey: ['/api/resources'],
  });

  const { data: machines, isLoading: machinesLoading } = useQuery<Machine[]>({
    queryKey: ['/api/machines'],
  });

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
          <Button className="flex items-center gap-2">
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
                    <Button variant="outline" size="sm">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
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
                    <span>1st Shift Coverage:</span>
                    <span>{resources?.filter(r => r.isActive && r.shiftSchedule.includes(1)).length || 0} operators</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>2nd Shift Coverage:</span>
                    <span>{resources?.filter(r => r.isActive && r.shiftSchedule.includes(2)).length || 0} operators</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}