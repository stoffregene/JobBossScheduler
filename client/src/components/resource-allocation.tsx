import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Filter } from "lucide-react";
import { useState, useMemo } from "react";
import type { Machine, ScheduleEntry, Job } from "@shared/schema";

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

  const { data: scheduleEntries, isLoading: scheduleLoading } = useQuery<ScheduleEntry[]>({
    queryKey: ['/api/schedule'],
  });

  const { data: jobs, isLoading: jobsLoading } = useQuery<Job[]>({
    queryKey: ['/api/jobs'],
  });

  const isLoading = machinesLoading || scheduleLoading || jobsLoading;

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

  // Calculate real resource allocation based on schedule entries
  const calculations = useMemo(() => {
    if (!machines || !scheduleEntries || !jobs) {
      return {
        filteredMachines: [],
        totalCapacity: 0,
        usedCapacity: 0,
        utilizationPercent: 0,
        shift1Capacity: 0,
        shift2Capacity: 0,
        shift1Used: 0,
        shift2Used: 0
      };
    }

    const { start, end } = getDateRange();
    const daysInPeriod = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // Filter machines by work center type
    const filteredMachines = machines.filter(machine => 
      workCenterFilter === "ALL" || machine.type === workCenterFilter
    );

    // Calculate capacity for filtered machines
    const shift1Resources = filteredMachines.filter(m => m.availableShifts.includes(1)).length;
    const shift2Resources = filteredMachines.filter(m => m.availableShifts.includes(2)).length;
    
    const hoursPerDay = 8; // Standard working day
    const daysPerWeek = 4; // As per the original calculation
    const weeksInPeriod = daysInPeriod / 7;
    
    const shift1Capacity = shift1Resources * hoursPerDay * daysPerWeek * weeksInPeriod;
    const shift2Capacity = shift2Resources * hoursPerDay * daysPerWeek * weeksInPeriod;
    const totalCapacity = shift1Capacity + shift2Capacity;

    // Calculate actual usage from schedule entries
    const relevantScheduleEntries = scheduleEntries.filter(entry => {
      const entryDate = new Date(entry.startTime);
      return entryDate >= start && entryDate <= end;
    });

    let shift1Used = 0;
    let shift2Used = 0;

    relevantScheduleEntries.forEach(entry => {
      const machine = machines.find(m => m.id === entry.machineId);
      const job = jobs.find(j => j.id === entry.jobId);
      
      if (machine && job && (workCenterFilter === "ALL" || machine.type === workCenterFilter)) {
        const hours = parseFloat(job.estimatedHours || "0");
        
        // Determine which shift based on time (simplified)
        const startHour = new Date(entry.startTime).getHours();
        if (startHour >= 3 && startHour < 15) {
          shift1Used += hours;
        } else {
          shift2Used += hours;
        }
      }
    });

    const usedCapacity = shift1Used + shift2Used;
    const utilizationPercent = totalCapacity > 0 ? Math.round((usedCapacity / totalCapacity) * 100) : 0;

    return {
      filteredMachines,
      totalCapacity,
      usedCapacity,
      utilizationPercent,
      shift1Capacity,
      shift2Capacity,
      shift1Used,
      shift2Used
    };
  }, [machines, scheduleEntries, jobs, workCenterFilter, scheduleView]);

  const periodLabel = scheduleView.type === "month" ? "Month" : "Week";
  const {
    filteredMachines,
    totalCapacity,
    usedCapacity,
    utilizationPercent,
    shift1Capacity,
    shift2Capacity,
    shift1Used,
    shift2Used
  } = calculations;

  if (isLoading) {
    return (
      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="text-gray-900 dark:text-white">Resource Allocation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!machines || !scheduleEntries || !jobs) {
    return (
      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="text-gray-900 dark:text-white">Resource Allocation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500 dark:text-gray-400 py-8">
            Failed to load resource allocation data
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-gray-900 dark:text-white">
            Resource Allocation ({periodLabel})
          </CardTitle>
          <Select value={workCenterFilter} onValueChange={setWorkCenterFilter}>
            <SelectTrigger className="w-32 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <SelectItem value="ALL" className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700">All Centers</SelectItem>
              {workCenterTypes.map(type => (
                <SelectItem key={type} value={type} className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700">{type}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Period Summary */}
        <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg border border-gray-200 dark:border-gray-600">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
              Total {periodLabel} Capacity ({filteredMachines.length} machines)
            </span>
            <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
              {Math.round(totalCapacity)}h
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-3">
            <div 
              className={`h-3 rounded-full transition-all duration-300 ${
                utilizationPercent > 90 ? 'bg-red-500' : 
                utilizationPercent > 80 ? 'bg-yellow-500' : 
                'bg-green-500'
              }`}
              style={{ width: `${Math.min(utilizationPercent, 100)}%` }}
            ></div>
          </div>
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
            <span>{utilizationPercent}% utilized</span>
            <span>{Math.round(usedCapacity)}h scheduled</span>
          </div>
        </div>

        {/* Shift Breakdown */}
        <div className="space-y-3">
          {/* 1st Shift */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200">1st Shift (3AM - 3PM)</span>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {filteredMachines.filter(m => m.availableShifts.includes(1)).length} machines
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
              <div 
                className="bg-green-500 h-2 rounded-full transition-all duration-300" 
                style={{ width: `${shift1Capacity > 0 ? (shift1Used / shift1Capacity) * 100 : 0}%` }}
              ></div>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {Math.round(shift1Used)}h / {Math.round(shift1Capacity)}h capacity
            </div>
          </div>

          {/* 2nd Shift */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200">2nd Shift (3PM - 3AM)</span>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {filteredMachines.filter(m => m.availableShifts.includes(2)).length} machines
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
              <div 
                className="bg-yellow-500 h-2 rounded-full transition-all duration-300" 
                style={{ width: `${shift2Capacity > 0 ? (shift2Used / shift2Capacity) * 100 : 0}%` }}
              ></div>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {Math.round(shift2Used)}h / {Math.round(shift2Capacity)}h capacity
            </div>
          </div>
        </div>

        {/* Work Center Breakdown */}
        {workCenterFilter !== "ALL" && (
          <div className="border-t border-gray-200 dark:border-gray-600 pt-4">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              {workCenterFilter} Work Centers
            </div>
            <div className="space-y-2">
              {filteredMachines.slice(0, 5).map(machine => (
                <div key={machine.id} className="flex justify-between items-center text-xs">
                  <span className="text-gray-600 dark:text-gray-300">{machine.machineId}</span>
                  <span className="text-gray-500 dark:text-gray-400">{machine.utilization}%</span>
                </div>
              ))}
              {filteredMachines.length > 5 && (
                <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                  +{filteredMachines.length - 5} more machines
                </div>
              )}
            </div>
          </div>
        )}

        {/* Summary Stats */}
        <div className="border-t border-gray-200 dark:border-gray-600 pt-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-gray-600 dark:text-gray-400">Available:</div>
              <div className="font-medium text-green-600 dark:text-green-400">
                {Math.round(totalCapacity - usedCapacity)}h
              </div>
            </div>
            <div>
              <div className="text-gray-600 dark:text-gray-400">Utilization:</div>
              <div className={`font-medium ${
                utilizationPercent > 90 ? 'text-red-600 dark:text-red-400' : 
                utilizationPercent > 80 ? 'text-yellow-600 dark:text-yellow-400' : 
                'text-green-600 dark:text-green-400'
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
