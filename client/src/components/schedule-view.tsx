import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Filter, Maximize2, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { Job, Machine, ScheduleEntry } from "@shared/schema";
import JobDetailsModal from "./job-details-modal";

interface ScheduleViewProps {
  scheduleView: {
    type: "week" | "month";
    date: Date;
  };
  onScheduleViewChange: (view: { type: "week" | "month"; date: Date }) => void;
}

export default function ScheduleView({ scheduleView, onScheduleViewChange }: ScheduleViewProps) {
  const [machineTypeFilter, setMachineTypeFilter] = useState<string>("ALL");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const { data: jobs } = useQuery<Job[]>({
    queryKey: ['/api/jobs'],
  });

  const { data: machines } = useQuery<Machine[]>({
    queryKey: ['/api/machines'],
  });

  const { data: scheduleEntries } = useQuery<ScheduleEntry[]>({
    queryKey: ['/api/schedule'],
  });

  const getWeekDays = () => {
    const currentWeek = [];
    let startOfWeek = new Date(scheduleView.date);
    
    if (scheduleView.type === "month") {
      // Show current month - first Sunday of display
      startOfWeek.setDate(1);
      const firstDayOfMonth = startOfWeek.getDay();
      // Go back to the Sunday that starts the calendar view
      startOfWeek.setDate(startOfWeek.getDate() - firstDayOfMonth);
    } else {
      // Start from Sunday of current week (standard calendar week)
      const currentDay = startOfWeek.getDay();
      // Go back to Sunday (day 0)
      startOfWeek.setDate(startOfWeek.getDate() - currentDay);
    }

    const daysToShow = scheduleView.type === "month" ? 30 : 7;
    
    for (let i = 0; i < daysToShow; i++) {
      const day = new Date(startOfWeek.getTime() + (i * 24 * 60 * 60 * 1000));
      currentWeek.push(day);
    }

    return currentWeek;
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(scheduleView.date);
    const daysToMove = scheduleView.type === "month" ? 30 : 7;
    
    if (direction === 'prev') {
      newDate.setDate(newDate.getDate() - daysToMove);
    } else {
      newDate.setDate(newDate.getDate() + daysToMove);
    }
    
    onScheduleViewChange({
      type: scheduleView.type,
      date: newDate
    });
  };

  const getDateRangeTitle = () => {
    const weekDays = getWeekDays();
    const start = weekDays[0];
    const end = weekDays[weekDays.length - 1];
    
    if (scheduleView.type === "month") {
      return start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } else {
      return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
  };

  const weekDays = getWeekDays();
  
  // Get unique machine types for filter dropdown
  const machineTypes = Array.from(new Set(machines?.map(m => m.type) || [])).sort();
  
  // Filter and sort machines by type and alphanumerically
  const filteredMachines = machines ? 
    machines.filter(machine => machineTypeFilter === "ALL" || machine.type === machineTypeFilter)
      .sort((a, b) => {
        // First sort by type, then by machineId
        if (a.type !== b.type) {
          return a.type.localeCompare(b.type);
        }
        return a.machineId.localeCompare(b.machineId);
      }) : [];
  
  const displayMachines = filteredMachines;

  const getMachineJobs = (machineId: string) => {
    if (!scheduleEntries || !jobs) return [];
    
    return scheduleEntries
      .filter(entry => entry.machineId === machineId)
      .map(entry => {
        const job = jobs.find(j => j.id === entry.jobId);
        return { ...entry, job };
      })
      .filter(entry => entry.job);
  };

  const getJobColor = (priority: string) => {
    switch (priority) {
      case 'Critical':
        return 'bg-red-600';
      case 'High':
        return 'bg-orange-500';
      default:
        return 'bg-blue-600';
    }
  };

  return (
    <Card className={isFullscreen ? 'fixed inset-4 z-50' : ''}>
      <CardHeader className="pb-4">
        <div className="flex flex-col space-y-3">
          {/* Title and Navigation Row */}
          <div className="flex items-center justify-between">
            <CardTitle>
              Production Schedule ({displayMachines.length} machines)
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigateWeek('prev')}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[140px] text-center">
                {getDateRangeTitle()}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigateWeek('next')}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* Controls Row */}
          <div className="flex items-center justify-end space-x-2">
            <Select value={machineTypeFilter} onValueChange={setMachineTypeFilter}>
              <SelectTrigger className="w-32">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Types</SelectItem>
                {machineTypes.map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select 
              value={scheduleView.type} 
              onValueChange={(value) => onScheduleViewChange({
                type: value as "week" | "month",
                date: scheduleView.date
              })}
            >
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Week</SelectItem>
                <SelectItem value="month">Month</SelectItem>
              </SelectContent>
            </Select>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setIsFullscreen(!isFullscreen)}
            >
              <Maximize2 className="h-4 w-4 mr-1" />
              {isFullscreen ? 'Exit' : 'Full'}
            </Button>
            <Button 
              variant="outline" 
              size="sm"
            >
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-4">
          {/* Day Headers */}
          <div className={`grid gap-1 text-sm font-medium text-muted-foreground ${scheduleView.type === "month" ? "overflow-x-auto" : ""}`} style={{ gridTemplateColumns: scheduleView.type === "month" ? "200px repeat(30, minmax(40px, 1fr))" : "200px repeat(7, 1fr)" }}>
            <div className="text-right pr-4 sticky left-0 bg-background z-10">Machine</div>
            {weekDays.map((day, index) => {
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;
              const isFriday = day.getDay() === 5;
              const isUnavailable = isWeekend || isFriday;
              
              return (
                <div key={index} className={`text-center text-xs ${isUnavailable ? 'text-gray-400' : ''}`}>
                  {scheduleView.type === "month" ? 
                    <div className="flex flex-col">
                      <span>{day.getDate()}</span>
                      <span className="text-xs">{day.toLocaleDateString('en-US', { weekday: 'short' }).substring(0, 1)}</span>
                    </div> :
                    `${day.toLocaleDateString('en-US', { weekday: 'short' })} ${day.getMonth() + 1}/${day.getDate()}`
                  }
                </div>
              );
            })}
          </div>

          {/* Machine Rows */}
          <div className="space-y-2">
            {displayMachines.map((machine) => {
              const machineJobs = getMachineJobs(machine.id);
              const isWeekendOnly = machine.availableShifts.length === 1 && machine.availableShifts[0] === 1;
              
              return (
                <div key={machine.id} className={`grid gap-1 items-center ${scheduleView.type === "month" ? "overflow-x-auto" : ""}`} style={{ gridTemplateColumns: scheduleView.type === "month" ? "200px repeat(30, minmax(40px, 1fr))" : "200px repeat(7, 1fr)" }}>
                  <div className="text-sm font-medium text-right pr-4 min-w-0 sticky left-0 bg-background z-10">
                    <div className="flex items-center justify-end gap-1 mb-1">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium flex-shrink-0 ${
                        machine.type === 'LATHE' 
                          ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200' 
                          : machine.type === 'MILL'
                          ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                          : machine.type === 'OUTSOURCE'
                          ? 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                      }`}>
                        {machine.type}
                      </span>
                      <span className="truncate">{machine.machineId}</span>
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{machine.name}</div>
                  </div>
                  
                  {weekDays.map((day, dayIndex) => {
                    const isWeekend = day.getDay() === 0 || day.getDay() === 6; // Saturday = 6, Sunday = 0
                    const isFriday = day.getDay() === 5; // Friday = 5
                    const isWeekendOrFriday = isWeekend || isFriday;
                    const isUnavailable = isWeekendOrFriday; // All machines should be unavailable on Fri-Sun
                    
                    // Find jobs scheduled for this day (including multi-day jobs)
                    const dayJobs = machineJobs.filter(entry => {
                      const startDate = new Date(entry.startTime);
                      const endDate = new Date(entry.endTime);
                      
                      // Use UTC dates for consistent comparison across timezones
                      const dayStartUTC = new Date(Date.UTC(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0));
                      const dayEndUTC = new Date(Date.UTC(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59));
                      
                      // Convert schedule times to UTC midnight boundaries for comparison
                      const scheduleStartDay = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
                      const scheduleEndDay = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()));
                      
                      // Job spans this day if it overlaps with the day's UTC range
                      return scheduleStartDay <= dayEndUTC && scheduleEndDay >= dayStartUTC;
                    });

                    return (
                      <div 
                        key={dayIndex} 
                        className={`h-12 rounded relative flex items-center justify-center ${
                          isUnavailable 
                            ? 'bg-gray-200 dark:bg-gray-700 opacity-60' 
                            : 'bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600'
                        }`}
                      >
                        {dayJobs.length > 0 && (
                          <button
                            className={`absolute inset-1 rounded text-white text-xs px-2 flex items-center justify-center font-medium cursor-pointer hover:opacity-80 transition-opacity ${
                              getJobColor(dayJobs[0].job?.priority || 'Normal')
                            }`}
                            onClick={() => setSelectedJobId(dayJobs[0].job?.id || null)}
                            data-testid={`schedule-job-${dayJobs[0].job?.jobNumber}`}
                          >
                            <span className="truncate">
                              {dayJobs[0].job?.jobNumber} (Op{dayJobs[0].operationSequence})
                            </span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-6 pt-4 border-t border-border flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center">
              <div className="w-4 h-4 bg-blue-600 rounded mr-2"></div>
              <span>Normal Priority</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 bg-orange-500 rounded mr-2"></div>
              <span>High Priority</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 bg-red-600 rounded mr-2"></div>
              <span>Critical</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 bg-muted rounded mr-2 opacity-50"></div>
              <span>Unavailable</span>
            </div>
          </div>
        </div>
      </CardContent>
      
      {/* Job Details Modal */}
      {selectedJobId && (
        <JobDetailsModal
          jobId={selectedJobId}
          onClose={() => setSelectedJobId(null)}
        />
      )}
    </Card>
  );
}
