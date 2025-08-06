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
    type: "hour" | "day" | "week" | "month";
    date: Date;
  };
  onScheduleViewChange: (view: { type: "hour" | "day" | "week" | "month"; date: Date }) => void;
}

// Drag and drop functionality removed

// Drag and drop components removed

export default function ScheduleView({ scheduleView, onScheduleViewChange }: ScheduleViewProps) {
  const [machineTypeFilter, setMachineTypeFilter] = useState<string>("ALL");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [showUnscheduledJobs, setShowUnscheduledJobs] = useState(true);
  const [colorblindMode, setColorblindMode] = useState(false);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
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

  const getTimeSlots = () => {
    const timeSlots = [];
    let current = new Date(scheduleView.date);
    
    switch (scheduleView.type) {
      case "hour":
        // Show 24 hours of current day, broken into 1-hour slots
        current.setHours(0, 0, 0, 0);
        for (let i = 0; i < 24; i++) {
          timeSlots.push(new Date(current));
          current.setHours(current.getHours() + 1);
        }
        break;
        
      case "day":
        // Show current single day
        current.setHours(0, 0, 0, 0);
        timeSlots.push(new Date(current));
        break;
        
      case "week":
        // Show current week - start from Monday, only business days (Mon-Thu)
        const dayOfWeek = current.getDay();
        const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        current.setDate(current.getDate() - daysFromMonday);
        current.setHours(0, 0, 0, 0);
        
        for (let i = 0; i < 7; i++) {
          const dayNum = current.getDay();
          // Only add Monday (1), Tuesday (2), Wednesday (3), Thursday (4)
          if (dayNum >= 1 && dayNum <= 4) {
            timeSlots.push(new Date(current));
          }
          current.setDate(current.getDate() + 1);
        }
        break;
        
      case "month":
        // Show current month - first Sunday of display, filter to business days only
        current.setDate(1);
        current.setHours(0, 0, 0, 0);
        const firstDayOfMonth = current.getDay();
        current.setDate(current.getDate() - firstDayOfMonth);
        
        // Get 35 days (5 weeks) but only show business days (Mon-Thu)
        for (let i = 0; i < 35; i++) {
          const dayNum = current.getDay();
          // Only add Monday (1), Tuesday (2), Wednesday (3), Thursday (4)
          if (dayNum >= 1 && dayNum <= 4) {
            timeSlots.push(new Date(current));
          }
          current.setDate(current.getDate() + 1);
        }
        break;
    }
    
    return timeSlots;
  };

  const navigateTimeframe = (direction: 'prev' | 'next') => {
    const newDate = new Date(scheduleView.date);
    
    switch (scheduleView.type) {
      case "hour":
        if (direction === 'prev') {
          newDate.setDate(newDate.getDate() - 1);
        } else {
          newDate.setDate(newDate.getDate() + 1);
        }
        break;
      case "day":
        if (direction === 'prev') {
          newDate.setDate(newDate.getDate() - 1);
        } else {
          newDate.setDate(newDate.getDate() + 1);
        }
        break;
      case "week":
        if (direction === 'prev') {
          newDate.setDate(newDate.getDate() - 7);
        } else {
          newDate.setDate(newDate.getDate() + 7);
        }
        break;
      case "month":
        if (direction === 'prev') {
          newDate.setMonth(newDate.getMonth() - 1);
        } else {
          newDate.setMonth(newDate.getMonth() + 1);
        }
        break;
    }
    
    onScheduleViewChange({
      type: scheduleView.type,
      date: newDate
    });
  };

  const getDateRangeTitle = () => {
    const timeSlots = getTimeSlots();
    const start = timeSlots[0];
    const end = timeSlots[timeSlots.length - 1];
    
    switch (scheduleView.type) {
      case "hour":
        return start.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
      case "day":
        return start.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
      case "week":
        return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      case "month":
        return start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      default:
        return '';
    }
  };

  const weekDays = getTimeSlots();
  
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
    if (colorblindMode) {
      // Colorblind-friendly patterns and textures
      switch (priority) {
        case 'Critical':
          return shift === 1 
            ? 'bg-gray-800 border-4 border-white' 
            : 'bg-gray-600 border-4 border-white border-dashed';
        case 'High':
          return shift === 1 
            ? 'bg-gray-700 border-2 border-white' 
            : 'bg-gray-500 border-2 border-white border-dotted';
        default:
          return shift === 1 
            ? 'bg-gray-600 border border-white' 
            : 'bg-gray-400 border border-white border-dashed';
      }
    }
    
    // Distinct colors for better visibility
    switch (priority) {
      case 'Critical':
        return shift === 1 
          ? 'bg-red-600 text-white' 
          : 'bg-pink-500 text-white border-2 border-pink-300';
      case 'High':
        return shift === 1 
          ? 'bg-orange-600 text-white' 
          : 'bg-yellow-500 text-black border-2 border-yellow-300';
      default:
        return shift === 1 
          ? 'bg-blue-600 text-white' 
          : 'bg-green-500 text-white border-2 border-green-300';
    }
  };

  return (
    <div className={`${isFullscreen ? "fixed inset-4 z-50 bg-background" : ""}`}>
      {/* Production Schedule - Full Width */}
      <Card className={`w-full ${isFullscreen ? "h-full flex flex-col" : ""}`}>
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
                onClick={() => navigateTimeframe('prev')}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[140px] text-center">
                {getDateRangeTitle()}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigateTimeframe('next')}
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
            {/* View Type Selector */}
            <div className="flex items-center gap-1 border rounded-md p-1">
              {["hour", "day", "week", "month"].map((viewType) => (
                <Button
                  key={viewType}
                  variant={scheduleView.type === viewType ? "default" : "ghost"}
                  size="sm"
                  onClick={() => onScheduleViewChange({ ...scheduleView, type: viewType as any })}
                  className="text-xs px-2 py-1"
                  data-testid={`view-${viewType}`}
                >
                  {viewType.charAt(0).toUpperCase() + viewType.slice(1)}
                </Button>
              ))}
            </div>
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
              onClick={() => setColorblindMode(!colorblindMode)}
              className={colorblindMode ? 'bg-gray-100 dark:bg-gray-700' : ''}
            >
              <svg className="h-4 w-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M12 1v6M12 17v6M4.22 4.22l4.24 4.24M15.54 15.54l4.24 4.24M1 12h6M17 12h6M4.22 19.78l4.24-4.24M15.54 8.46l4.24-4.24"/>
              </svg>
              {colorblindMode ? 'Color' : 'Pattern'}
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
      
      <CardContent className={`${isFullscreen ? "flex-1 overflow-auto" : ""}`}>
        <div className="space-y-4">
          {/* Time Headers */}
          <div className={`flex gap-1 text-sm font-medium text-muted-foreground ${(scheduleView.type === "month" || scheduleView.type === "hour") || isFullscreen ? "overflow-x-auto" : ""}`}>
            <div className="text-right pr-4 sticky left-0 bg-background z-10 w-48 flex-shrink-0">Machine</div>
            <div className="flex gap-1 flex-1">
              {weekDays.map((day, index) => {
                let displayText = '';
                switch (scheduleView.type) {
                  case "hour":
                    displayText = day.toLocaleTimeString('en-US', { 
                      hour: 'numeric', 
                      hour12: true 
                    });
                    break;
                  case "day":
                    displayText = day.toLocaleDateString('en-US', { 
                      weekday: 'long', 
                      month: 'long', 
                      day: 'numeric' 
                    });
                    break;
                  case "week":
                    displayText = day.toLocaleDateString('en-US', { 
                      weekday: 'short', 
                      month: 'short',
                      day: 'numeric'
                    });
                    break;
                  case "month":
                    displayText = day.getDate().toString();
                    break;
                }
                
                const flexBasis = scheduleView.type === "hour" ? "60px" :
                                scheduleView.type === "day" ? "100%" :
                                scheduleView.type === "week" ? "1fr" :
                                "40px"; // month
                
                return (
                  <div key={index} className="text-center text-xs flex-shrink-0" style={{ flexBasis }}>
                    {scheduleView.type === "month" ? 
                      <div className="flex flex-col">
                        <span>{displayText}</span>
                        <span className="text-xs">{day.toLocaleDateString('en-US', { weekday: 'short' }).substring(0, 1)}</span>
                      </div> :
                      displayText
                    }
                  </div>
                );
              })}
            </div>
          </div>

          {/* Machine Rows */}
          <div className={`space-y-2 ${isFullscreen ? "min-h-0" : ""}`}>
            {displayMachines.map((machine) => {
              const machineJobs = getMachineJobs(machine.id);
              
              // Group jobs into continuous blocks across multiple days
              const jobBlocks = [];
              const processedJobs = new Set();
              
              machineJobs.forEach(entry => {
                const blockKey = `${entry.jobId}-${entry.operationSequence}`;
                if (processedJobs.has(blockKey)) return;
                
                processedJobs.add(blockKey);
                const startDate = new Date(entry.startTime);
                const endDate = new Date(entry.endTime);
                
                jobBlocks.push({
                  ...entry,
                  blockKey,
                  startDate,
                  endDate,
                  daySpan: Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
                });
              });
              
              return (
                <div key={machine.id} className={`flex gap-0 items-center ${(scheduleView.type === "month" || scheduleView.type === "hour") || isFullscreen ? "overflow-x-auto" : ""}`}>
                  <div className={`text-sm font-medium text-right pr-4 min-w-0 sticky left-0 z-10 w-48 flex-shrink-0 ${isFullscreen ? "bg-card" : "bg-background"}`}>
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
                  
                  {/* Continuous timeline container */}
                  <div className="flex flex-1 relative h-12" style={{ minWidth: '600px' }}>
                    {/* Shift background shading */}
                    <div className="absolute inset-0 flex flex-1">
                      {weekDays.map((day, dayIndex) => {
                        const isWeekView = scheduleView.type === "week";
                        
                        return (
                          <div 
                            key={dayIndex} 
                            className={`border-r border-gray-200 dark:border-gray-600 ${isWeekView ? 'flex-1' : 'flex-shrink-0'}`}
                            style={{ 
                              flexBasis: scheduleView.type === "hour" ? "60px" :
                                        scheduleView.type === "day" ? "100%" :
                                        scheduleView.type === "week" ? "0" :  // Let flex-1 handle the sizing
                                        "40px", // month
                              width: scheduleView.type === "week" ? "auto" : undefined
                            }}
                          >
                            {/* 1st shift background (lighter) */}
                            <div className="h-6 bg-blue-50 dark:bg-blue-950/30 border-b border-gray-100 dark:border-gray-700"></div>
                            {/* 2nd shift background (darker) */}
                            <div className="h-6 bg-blue-100 dark:bg-blue-900/50"></div>
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Continuous job blocks */}
                    <div className="absolute inset-0 p-0.5">
                      {jobBlocks.map((block, blockIndex) => {
                        const timelineStart = weekDays[0];
                        const timelineEnd = new Date(weekDays[weekDays.length - 1]);
                        timelineEnd.setHours(23, 59, 59, 999);
                        
                        const totalTimelineMs = timelineEnd.getTime() - timelineStart.getTime();
                        const blockStartMs = Math.max(0, block.startDate.getTime() - timelineStart.getTime());
                        const blockDurationMs = Math.min(
                          block.endDate.getTime() - block.startDate.getTime(),
                          timelineEnd.getTime() - Math.max(block.startDate.getTime(), timelineStart.getTime())
                        );
                        
                        const leftPercent = (blockStartMs / totalTimelineMs) * 100;
                        const widthPercent = (blockDurationMs / totalTimelineMs) * 100;
                        
                        if (widthPercent <= 0) return null;
                        
                        // Determine vertical position based on shift
                        const topOffset = block.shift === 1 ? '2px' : '50%';
                        const height = 'calc(50% - 4px)';
                        
                        return (
                          <button
                            key={blockIndex}
                            className={`absolute rounded text-xs px-2 flex items-center font-medium cursor-pointer hover:opacity-80 transition-opacity overflow-hidden border ${
                              getJobColor(block.job?.priority || 'Normal', block.shift)
                            } ${block.job?.routingModified ? 'border-2 border-dashed border-yellow-400 dark:border-yellow-300' : 'border-gray-300 dark:border-gray-600'}`}
                            style={{
                              left: `${leftPercent}%`,
                              width: `${widthPercent}%`,
                              top: topOffset,
                              height: height,
                              minWidth: '80px'
                            }}
                            onClick={() => setSelectedJobId(block.job?.id || null)}
                            data-testid={`schedule-job-${block.job?.jobNumber}`}
                            title={`Shift ${block.shift} - ${block.job?.jobNumber} (Op${block.operationSequence}) - ${block.startDate.toLocaleDateString()} to ${block.endDate.toLocaleDateString()}${block.job?.routingModified ? ' - Modified Routing' : ''}`}
                          >
                            <span className="truncate text-[10px] font-medium">
                              {block.job?.jobNumber} (Op{block.operationSequence}) S{block.shift}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-6 pt-4 border-t border-border flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            {colorblindMode ? (
              <>
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-gray-600 border border-white rounded mr-2"></div>
                  <span>Normal Priority (1st Shift)</span>
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-gray-400 border border-white border-dashed rounded mr-2"></div>
                  <span>Normal Priority (2nd Shift)</span>
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-gray-700 border-2 border-white rounded mr-2"></div>
                  <span>High Priority (1st Shift)</span>
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-gray-500 border-2 border-white border-dotted rounded mr-2"></div>
                  <span>High Priority (2nd Shift)</span>
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-gray-800 border-4 border-white rounded mr-2"></div>
                  <span>Critical (1st Shift)</span>
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-gray-600 border-4 border-white border-dashed rounded mr-2"></div>
                  <span>Critical (2nd Shift)</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-blue-600 rounded mr-2"></div>
                  <span>Normal Priority (1st Shift)</span>
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-green-500 border-2 border-green-300 rounded mr-2"></div>
                  <span>Normal Priority (2nd Shift)</span>
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-orange-600 rounded mr-2"></div>
                  <span>High Priority (1st Shift)</span>
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-yellow-500 border-2 border-yellow-300 rounded mr-2"></div>
                  <span>High Priority (2nd Shift)</span>
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-red-600 rounded mr-2"></div>
                  <span>Critical (1st Shift)</span>
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-pink-500 border-2 border-pink-300 rounded mr-2"></div>
                  <span>Critical (2nd Shift)</span>
                </div>
              </>
            )}
            <div className="flex items-center">
              <div className="w-4 h-4 bg-muted rounded mr-2 opacity-50"></div>
              <span>Unavailable (Fri-Sun)</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 bg-blue-600 border-2 border-dashed border-yellow-400 rounded mr-2"></div>
              <span>Modified Routing</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 bg-gradient-to-r from-blue-600 to-blue-400 rounded mr-2 relative">
                <div className="absolute inset-y-0 right-0 w-1 bg-black/20"></div>
              </div>
              <span>Multi-day Jobs (span multiple days)</span>
            </div>
            <div className="flex items-center text-xs">
              <span className="font-medium">Legend:</span>
              <span className="ml-2">Rounded edges = start/end of multi-day job</span>
              <span className="mx-2">|</span>
              <span>S1/S2 = Shift indicators</span>
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
