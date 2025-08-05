import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Filter, Maximize2, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { Job, Machine, ScheduleEntry } from "@shared/schema";
import JobDetailsModal from "./job-details-modal";
// Removed drag and drop imports
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ScheduleViewProps {
  scheduleView: {
    type: "week" | "month";
    date: Date;
  };
  onScheduleViewChange: (view: { type: "week" | "month"; date: Date }) => void;
}

// Drag and drop functionality removed

// Drag and drop components removed

export default function ScheduleView({ scheduleView, onScheduleViewChange }: ScheduleViewProps) {
  const [machineTypeFilter, setMachineTypeFilter] = useState<string>("ALL");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [showUnscheduledJobs, setShowUnscheduledJobs] = useState(true);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: jobs } = useQuery<Job[]>({
    queryKey: ['/api/jobs'],
  });

  const { data: machines } = useQuery<Machine[]>({
    queryKey: ['/api/machines'],
  });

  const { data: scheduleEntries } = useQuery<ScheduleEntry[]>({
    queryKey: ['/api/schedule'],
  });

  // Get unscheduled jobs (status = "Open")
  const unscheduledJobs = jobs?.filter(job => job.status === "Open") || [];

  // Drag and drop functionality removed

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

  const getJobColor = (priority: string, shift: number = 1) => {
    // Base colors by priority, with shift pattern variations
    switch (priority) {
      case 'Critical':
        return shift === 1 ? 'bg-red-600' : 'bg-red-600 bg-opacity-80 border-2 border-red-400';
      case 'High':
        return shift === 1 ? 'bg-orange-500' : 'bg-orange-500 bg-opacity-80 border-2 border-orange-300';
      default:
        return shift === 1 ? 'bg-blue-600' : 'bg-blue-600 bg-opacity-80 border-2 border-blue-400';
    }
  };

  return (
    <div className={`${isFullscreen ? "fixed inset-4 z-50" : ""}`}>
      {/* Production Schedule - Full Width */}
      <Card className="w-full">
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
                    
                    // Check if any job is multi-day (spans multiple days)
                    const hasMultiDayJob = dayJobs.some(entry => {
                      const startDate = new Date(entry.startTime);
                      const endDate = new Date(entry.endTime);
                      const duration = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60); // hours
                      return duration > 8 || startDate.toDateString() !== endDate.toDateString();
                    });
                    
                    // Check position of multi-day job
                    const multiDayPosition = dayJobs.length > 0 ? (() => {
                      const entry = dayJobs[0];
                      const startDate = new Date(entry.startTime);
                      const endDate = new Date(entry.endTime);
                      const isStart = startDate.toDateString() === day.toDateString();
                      const isEnd = endDate.toDateString() === day.toDateString();
                      const isContinuation = !isStart && !isEnd;
                      return { isStart, isEnd, isContinuation };
                    })() : null;

                  return (
                    <div key={dayIndex}>
                      <div 
                        className={`h-12 rounded relative flex items-center justify-center ${
                          isUnavailable 
                            ? 'bg-gray-200 dark:bg-gray-700 opacity-60' 
                            : 'bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600'
                        }`}
                      >
                        {dayJobs.length > 0 && (
                          <div className="absolute inset-0 flex flex-col gap-0.5 p-0.5">
                            {dayJobs.slice(0, 2).map((entry, idx) => (
                              <button
                                key={idx}
                                className={`flex-1 rounded text-white text-xs px-1 flex items-center justify-center font-medium cursor-pointer hover:opacity-80 transition-opacity relative overflow-hidden ${
                                  getJobColor(entry.job?.priority || 'Normal', entry.shift)
                                } ${hasMultiDayJob && multiDayPosition ? (
                                  multiDayPosition.isStart ? 'rounded-l-md rounded-r-none' :
                                  multiDayPosition.isEnd ? 'rounded-r-md rounded-l-none' :
                                  multiDayPosition.isContinuation ? 'rounded-none' : ''
                                ) : ''} ${entry.job?.routingModified ? 'border-2 border-dashed border-yellow-400 dark:border-yellow-300' : ''}`}
                                onClick={() => setSelectedJobId(entry.job?.id || null)}
                                data-testid={`schedule-job-${entry.job?.jobNumber}`}
                                title={`Shift ${entry.shift} - ${entry.job?.jobNumber} (Op${entry.operationSequence})${hasMultiDayJob ? ' - Multi-day job' : ''}${entry.job?.routingModified ? ' - Modified Routing' : ''}`}
                              >
                                {/* Multi-day indicator */}
                                {hasMultiDayJob && (
                                  <div className={`absolute inset-y-0 ${
                                    multiDayPosition?.isStart ? 'right-0' :
                                    multiDayPosition?.isEnd ? 'left-0' :
                                    'left-0 right-0'
                                  } w-full bg-black/10 dark:bg-white/10`} />
                                )}
                                <span className="truncate relative z-10 text-[10px]">
                                  {entry.job?.jobNumber} (Op{entry.operationSequence})
                                  {dayJobs.length > 1 && ` S${entry.shift}`}
                                </span>
                              </button>
                            ))}
                            {dayJobs.length > 2 && (
                              <div className="text-[9px] text-center text-gray-600 dark:text-gray-400">
                                +{dayJobs.length - 2} more
                              </div>
                            )}
                          </div>
                        )}
                      </div>
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
              <span>Normal Priority (1st Shift)</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 bg-blue-600 bg-opacity-80 border-2 border-blue-400 rounded mr-2"></div>
              <span>Normal Priority (2nd Shift)</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 bg-orange-500 rounded mr-2"></div>
              <span>High Priority (1st Shift)</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 bg-orange-500 bg-opacity-80 border-2 border-orange-300 rounded mr-2"></div>
              <span>High Priority (2nd Shift)</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 bg-red-600 rounded mr-2"></div>
              <span>Critical (1st Shift)</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 bg-red-600 bg-opacity-80 border-2 border-red-400 rounded mr-2"></div>
              <span>Critical (2nd Shift)</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 bg-muted rounded mr-2 opacity-50"></div>
              <span>Unavailable</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 bg-blue-600 border-2 border-dashed border-yellow-400 rounded mr-2"></div>
              <span>Modified Routing</span>
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
    </div>
  );
}
