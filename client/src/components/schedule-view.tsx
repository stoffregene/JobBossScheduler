import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download } from "lucide-react";
import type { Job, Machine, ScheduleEntry } from "@shared/schema";

export default function ScheduleView() {
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
    const today = new Date();
    const currentWeek = [];
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + 1); // Monday

    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      currentWeek.push(day);
    }

    return currentWeek;
  };

  const weekDays = getWeekDays();
  
  // Show ALL 20 machines - user specifically wants to see everything
  const displayMachines = machines || [];

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
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Production Schedule</CardTitle>
          <div className="flex items-center space-x-2">
            <Select defaultValue="this-week">
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="this-week">This Week</SelectItem>
                <SelectItem value="next-week">Next Week</SelectItem>
                <SelectItem value="this-month">This Month</SelectItem>
              </SelectContent>
            </Select>
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
          <div className="grid grid-cols-8 gap-2 text-sm font-medium text-gray-500">
            <div className="text-right pr-4">Machine</div>
            {weekDays.map((day, index) => (
              <div key={index} className="text-center">
                {day.toLocaleDateString('en-US', { weekday: 'short' })} {day.getMonth() + 1}/{day.getDate()}
              </div>
            ))}
          </div>

          {/* Machine Rows */}
          <div className="space-y-2">
            {displayMachines.map((machine) => {
              const machineJobs = getMachineJobs(machine.id);
              const isWeekendOnly = machine.availableShifts.length === 1 && machine.availableShifts[0] === 1;
              
              return (
                <div key={machine.id} className="grid grid-cols-8 gap-2 items-center">
                  <div className="text-sm font-medium text-gray-900 text-right pr-4">
                    <div>{machine.machineId}</div>
                    <div className="text-xs text-gray-500">{machine.name}</div>
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
