import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Filter } from "lucide-react";
import { useState, useMemo } from "react";
import type { Machine, ScheduleEntry, Job, ResourceUnavailability, Resource } from "@shared/schema";

interface ResourceAllocationProps {
  scheduleView: {
    type: "week" | "month";
    date: Date;
  };
}

export default function ResourceAllocation({ scheduleView }: ResourceAllocationProps) {
  const [workCenterFilter, setWorkCenterFilter] = useState<string>("ALL");
  
  const { data: machines, isLoading: machinesLoading } = useQuery<Machine[]>({
    queryKey: ['/api/machines'],
  });

  const { data: resources, isLoading: resourcesLoading } = useQuery<Resource[]>({
    queryKey: ['/api/resources'],
  });

  const { data: scheduleEntries, isLoading: scheduleLoading } = useQuery<ScheduleEntry[]>({
    queryKey: ['/api/schedule'],
  });

  const { data: jobs, isLoading: jobsLoading } = useQuery<Job[]>({
    queryKey: ['/api/jobs'],
  });

  const { data: unavailabilityData, isLoading: unavailabilityLoading } = useQuery<ResourceUnavailability[]>({
    queryKey: ['/api/resource-unavailability'],
  });

  const isLoading = machinesLoading || resourcesLoading || scheduleLoading || jobsLoading || unavailabilityLoading;

  // Get work center types for filtering
  const workCenterTypes = Array.from(new Set(machines?.map(m => m.type) || [])).sort();

  // Calculate period date range
  const getDateRange = () => {
    const start = new Date(scheduleView.date);
    const end = new Date(scheduleView.date);
    
    if (scheduleView.type === "month") {
      start.setDate(1);
      end.setMonth(end.getMonth() + 1);
      end.setDate(0);
    } else {
      const startOfWeek = start.getDate() - start.getDay() + 1;
      start.setDate(startOfWeek);
      end.setDate(startOfWeek + 6);
    }
    
    return { start, end };
  };

  // Calculate resource allocation based on actual people/operators capacity, accounting for unavailability
  const calculations = useMemo(() => {
    if (!machines || !resources || !scheduleEntries || !jobs) {
      return {
        filteredMachines: [],
        totalOperatorCapacity: 0,
        usedOperatorCapacity: 0,
        utilizationPercent: 0,
        shift1OperatorCapacity: 0,
        shift2OperatorCapacity: 0,
        shift1OperatorUsed: 0,
        shift2OperatorUsed: 0
      };
    }

    const { start, end } = getDateRange();
    const daysInPeriod = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // Filter machines by work center type for display purposes
    const filteredMachines = machines.filter(machine => 
      workCenterFilter === "ALL" || machine.type === workCenterFilter
    );

    // Filter resources to those who can work the filtered machine types
    const activeResources = resources.filter(resource => resource.isActive);
    
    let filteredResources = activeResources;
    if (workCenterFilter !== "ALL") {
      // Filter resources to those who can operate machines of the selected type
      const filteredMachineIds = filteredMachines.map(m => m.id);
      filteredResources = activeResources.filter(resource => 
        resource.workCenters.some(workCenter => filteredMachineIds.includes(workCenter))
      );
    }

    // Calculate resource capacity based on actual operators
    const shift1Resources = filteredResources.filter(r => r.shiftSchedule.includes(1));
    const shift2Resources = filteredResources.filter(r => r.shiftSchedule.includes(2));
    
    // Each employee works 4 x 10-hour shifts = 40 hours/week
    // 1st shift: 85% efficiency, 2nd shift: 60% efficiency  
    const hoursPerWeek = 40;
    const shift1Efficiency = 0.85;
    const shift2Efficiency = 0.60;
    
    // Calculate unavailable hours for the period
    let shift1UnavailableHours = 0;
    let shift2UnavailableHours = 0;
    
    if (unavailabilityData) {
      unavailabilityData.forEach(unavailability => {
        const unavailStart = new Date(unavailability.startDate);
        const unavailEnd = new Date(unavailability.endDate);
        
        // Check if unavailability overlaps with our date range
        if (unavailStart <= end && unavailEnd >= start) {
          // Calculate overlapping weeks for 4x10 schedule
          const overlapStart = new Date(Math.max(unavailStart.getTime(), start.getTime()));
          const overlapEnd = new Date(Math.min(unavailEnd.getTime(), end.getTime()));
          const overlapWeeks = Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24 * 7));
          
          // Account for which shifts are affected - each employee works 40 hours/week
          const shifts = unavailability.shifts || [1, 2];
          if (shifts.includes(1)) {
            shift1UnavailableHours += overlapWeeks * hoursPerWeek;
          }
          if (shifts.includes(2)) {
            shift2UnavailableHours += overlapWeeks * hoursPerWeek;
          }
        }
      });
    }
    
    // Calculate available capacity based on RESOURCES (people), not machines
    // Convert period to weeks for calculation, then apply efficiency
    const weeksInPeriod = scheduleView.type === "month" ? 4 : 1;
    
    const shift1BaseCapacity = shift1Resources.length * hoursPerWeek * weeksInPeriod * shift1Efficiency;
    const shift2BaseCapacity = shift2Resources.length * hoursPerWeek * weeksInPeriod * shift2Efficiency;
    
    // For unavailability, we need to adjust this calculation to match the efficiency-adjusted hours
    const shift1UnavailableEffectiveHours = shift1UnavailableHours * shift1Efficiency;
    const shift2UnavailableEffectiveHours = shift2UnavailableHours * shift2Efficiency;
    
    const shift1OperatorCapacity = Math.max(0, shift1BaseCapacity - shift1UnavailableEffectiveHours);
    const shift2OperatorCapacity = Math.max(0, shift2BaseCapacity - shift2UnavailableEffectiveHours);
    const totalOperatorCapacity = shift1OperatorCapacity + shift2OperatorCapacity;

    // Calculate actual usage from schedule entries
    const relevantScheduleEntries = scheduleEntries.filter(entry => {
      const entryDate = new Date(entry.startTime);
      return entryDate >= start && entryDate <= end;
    });

    let shift1OperatorUsed = 0;
    let shift2OperatorUsed = 0;

    relevantScheduleEntries.forEach(entry => {
      const machine = machines.find(m => m.id === entry.machineId);
      const job = jobs.find(j => j.id === entry.jobId);
      
      if (machine && job && (workCenterFilter === "ALL" || machine.type === workCenterFilter)) {
        const hours = parseFloat(job.estimatedHours || "0");
        
        // Determine which shift based on time (simplified) - hours represent operator time
        const startHour = new Date(entry.startTime).getHours();
        if (startHour >= 6 && startHour < 14) {
          shift1OperatorUsed += hours;
        } else {
          shift2OperatorUsed += hours;
        }
      }
    });

    const usedOperatorCapacity = shift1OperatorUsed + shift2OperatorUsed;
    const utilizationPercent = totalOperatorCapacity > 0 ? Math.round((usedOperatorCapacity / totalOperatorCapacity) * 100) : 0;

    return {
      filteredMachines,
      totalOperatorCapacity,
      usedOperatorCapacity,
      utilizationPercent,
      shift1OperatorCapacity,
      shift2OperatorCapacity,
      shift1OperatorUsed,
      shift2OperatorUsed
    };
  }, [machines, resources, scheduleEntries, jobs, unavailabilityData, workCenterFilter, scheduleView]);

  const periodLabel = scheduleView.type === "month" ? "Month" : "Week";
  const {
    filteredMachines,
    totalOperatorCapacity,
    usedOperatorCapacity,
    utilizationPercent,
    shift1OperatorCapacity,
    shift2OperatorCapacity,
    shift1OperatorUsed,
    shift2OperatorUsed
  } = calculations;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Resource Allocation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded"></div>
            <div className="h-8 bg-muted rounded"></div>
            <div className="h-20 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!machines || !resources || !scheduleEntries || !jobs) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Resource Allocation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            Failed to load resource allocation data
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>
            Resource Allocation ({periodLabel})
          </CardTitle>
          <Select value={workCenterFilter} onValueChange={setWorkCenterFilter}>
            <SelectTrigger className="w-32">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Centers</SelectItem>
              {workCenterTypes.map(type => (
                <SelectItem key={type} value={type}>{type}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Period Summary */}
        <div className="bg-muted p-3 rounded-lg border">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium">
              Total {periodLabel} Capacity ({resources?.filter(r => r.isActive).length || 0} operators)
            </span>
            <span className="text-lg font-bold text-blue-600">
              {Math.round(totalOperatorCapacity)}h
            </span>
          </div>
          <div className="w-full bg-background rounded-full h-3">
            <div 
              className={`h-3 rounded-full transition-all duration-300 ${
                utilizationPercent > 90 ? 'bg-red-500' : 
                utilizationPercent > 80 ? 'bg-yellow-500' : 
                'bg-green-500'
              }`}
              style={{ width: `${Math.min(utilizationPercent, 100)}%` }}
            ></div>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>{utilizationPercent}% utilized</span>
            <span>{Math.round(usedOperatorCapacity)}h scheduled</span>
          </div>
        </div>

        {/* Shift Breakdown */}
        <div className="space-y-3">
          {/* 1st Shift */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">1st Shift (3AM - 3PM)</span>
              <span className="text-sm text-muted-foreground">
                {resources?.filter(r => r.isActive && r.shiftSchedule.includes(1)).length || 0} operators
              </span>
            </div>
            <div className="w-full bg-background rounded-full h-2">
              <div 
                className="bg-green-500 h-2 rounded-full transition-all duration-300" 
                style={{ width: `${shift1OperatorCapacity > 0 ? (shift1OperatorUsed / shift1OperatorCapacity) * 100 : 0}%` }}
              ></div>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {Math.round(shift1OperatorUsed)}h / {Math.round(shift1OperatorCapacity)}h capacity
            </div>
          </div>

          {/* 2nd Shift */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">2nd Shift (3PM - 3AM)</span>
              <span className="text-sm text-muted-foreground">
                {resources?.filter(r => r.isActive && r.shiftSchedule.includes(2)).length || 0} operators
              </span>
            </div>
            <div className="w-full bg-background rounded-full h-2">
              <div 
                className="bg-yellow-500 h-2 rounded-full transition-all duration-300" 
                style={{ width: `${shift2OperatorCapacity > 0 ? (shift2OperatorUsed / shift2OperatorCapacity) * 100 : 0}%` }}
              ></div>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {Math.round(shift2OperatorUsed)}h / {Math.round(shift2OperatorCapacity)}h capacity
            </div>
          </div>
        </div>

        {/* Work Center Breakdown */}
        {workCenterFilter !== "ALL" && (
          <div className="border-t border-border pt-4">
            <div className="text-sm font-medium mb-2">
              {workCenterFilter} Work Centers
            </div>
            <div className="space-y-2">
              {filteredMachines.slice(0, 5).map(machine => (
                <div key={machine.id} className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">{machine.machineId}</span>
                  <span className="text-muted-foreground">{machine.utilization}%</span>
                </div>
              ))}
              {filteredMachines.length > 5 && (
                <div className="text-xs text-muted-foreground text-center">
                  +{filteredMachines.length - 5} more machines
                </div>
              )}
            </div>
          </div>
        )}

        {/* Summary Stats */}
        <div className="border-t border-border pt-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">Available:</div>
              <div className="font-medium text-green-600">
                {Math.round(totalOperatorCapacity - usedOperatorCapacity)}h
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Utilization:</div>
              <div className={`font-medium ${
                utilizationPercent > 90 ? 'text-red-600' : 
                utilizationPercent > 80 ? 'text-yellow-600' : 
                'text-green-600'
              }`}>
                {utilizationPercent}%
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
