import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Filter, Maximize2, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { Job, Machine, ScheduleEntry } from "@shared/schema";

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
      // Show current month - first Monday of the month or around today
      startOfWeek.setDate(1);
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + 1);
    } else {
      // This week (default)
      startOfWeek.setDate(scheduleView.date.getDate() - scheduleView.date.getDay() + 1); // Monday
    }

    const daysToShow = scheduleView.type === "month" ? 30 : 7;
    
    for (let i = 0; i < daysToShow; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
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
        return 'bg-error-500';
      case 'High':
        return 'bg-warning-500';
      default:
        return 'bg-primary-500';
    }
  };

  return (
    <Card className={`dark:bg-gray-800 dark:border-gray-700 ${isFullscreen ? 'fixed inset-4 z-50' : ''}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <CardTitle className="dark:text-white">Production Schedule ({displayMachines.length} machines)</CardTitle>
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigateWeek('prev')}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium dark:text-white min-w-[140px] text-center">
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
          <div className="flex items-center space-x-2">
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
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Week View</SelectItem>
                <SelectItem value="month">Month View</SelectItem>
              </SelectContent>
            </Select>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setIsFullscreen(!isFullscreen)}
            >
              <Maximize2 className="h-4 w-4 mr-1" />
              {isFullscreen ? 'Exit' : 'Fullscreen'}
            </Button>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-4">
          {/* Day Headers */}
          <div className="grid gap-2 text-sm font-medium text-gray-500 dark:text-gray-400" style={{ gridTemplateColumns: scheduleView.type === "month" ? "200px repeat(30, 1fr)" : "200px repeat(7, 1fr)" }}>
            <div className="text-right pr-4">Machine</div>
            {weekDays.map((day, index) => (
              <div key={index} className="text-center">
                {scheduleView.type === "month" ? 
                  `${day.getMonth() + 1}/${day.getDate()}` :
                  `${day.toLocaleDateString('en-US', { weekday: 'short' })} ${day.getMonth() + 1}/${day.getDate()}`
                }
              </div>
            ))}
          </div>

          {/* Machine Rows */}
          <div className="space-y-2">
            {displayMachines.map((machine) => {
              const machineJobs = getMachineJobs(machine.id);
              const isWeekendOnly = machine.availableShifts.length === 1 && machine.availableShifts[0] === 1;
              
              return (
                <div key={machine.id} className="grid gap-2 items-center" style={{ gridTemplateColumns: scheduleView.type === "month" ? "200px repeat(30, 1fr)" : "200px repeat(7, 1fr)" }}>
                  <div className="text-sm font-medium text-gray-900 dark:text-white text-right pr-4 min-w-0">
                    <div className="flex items-center justify-end gap-1 mb-1">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium flex-shrink-0 ${
                        machine.type === 'LATHE' 
                          ? 'bg-blue-100 text-blue-800' 
                          : machine.type === 'MILL'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {machine.type}
                      </span>
                      <span className="truncate">{machine.machineId}</span>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{machine.name}</div>
                  </div>
                  
                  {weekDays.map((day, dayIndex) => {
                    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                    const isUnavailable = (isWeekend && isWeekendOnly);
                    
                    // Find jobs scheduled for this day
                    const dayJobs = machineJobs.filter(entry => {
                      const entryDate = new Date(entry.startTime);
                      return entryDate.toDateString() === day.toDateString();
                    });

                    return (
                      <div 
                        key={dayIndex} 
                        className={`h-12 rounded relative flex items-center justify-center ${
                          isUnavailable ? 'bg-gray-100 opacity-50' : 'bg-gray-100'
                        }`}
                      >
                        {dayJobs.length > 0 && (
                          <div 
                            className={`absolute inset-1 rounded text-white text-xs px-2 flex items-center justify-center ${
                              getJobColor(dayJobs[0].job?.priority || 'Normal')
                            }`}
                          >
                            {dayJobs[0].job?.jobNumber} ({Math.round(parseFloat(dayJobs[0].job?.estimatedHours || '0'))}h)
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-6 flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center">
              <div className="w-4 h-4 bg-primary-500 rounded mr-2"></div>
              <span>Machining</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 bg-purple-500 rounded mr-2"></div>
              <span>Welding</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 bg-indigo-500 rounded mr-2"></div>
              <span>Finishing</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 bg-warning-500 rounded mr-2"></div>
              <span>Late Risk</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 bg-error-500 rounded mr-2"></div>
              <span>Critical</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 bg-gray-300 rounded mr-2 opacity-50"></div>
              <span>2nd Shift Unavailable</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
