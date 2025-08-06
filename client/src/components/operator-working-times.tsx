import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, User, AlertTriangle, Calendar } from "lucide-react";

interface OperatorWorkingTimesProps {
  scheduleView: {
    type: "hour" | "day" | "week" | "month" | "operators";
    date: Date;
  };
  isFullscreen: boolean;
}

interface Resource {
  id: string;
  name: string;
  role: string;
  isActive: boolean;
  shiftSchedule: number[];
  workCenters: string[];
  workSchedule?: {
    monday?: { enabled: boolean; startTime: string; endTime: string; } | null;
    tuesday?: { enabled: boolean; startTime: string; endTime: string; } | null;
    wednesday?: { enabled: boolean; startTime: string; endTime: string; } | null;
    thursday?: { enabled: boolean; startTime: string; endTime: string; } | null;
    friday?: { enabled: boolean; startTime: string; endTime: string; } | null;
    saturday?: { enabled: boolean; startTime: string; endTime: string; } | null;
    sunday?: { enabled: boolean; startTime: string; endTime: string; } | null;
  };
}

interface ResourceUnavailability {
  id: string;
  resourceId: string;
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
  isPartialDay: boolean;
  reason: string;
  shifts: number[];
  notes?: string;
}

export default function OperatorWorkingTimes({ scheduleView, isFullscreen }: OperatorWorkingTimesProps) {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(scheduleView.date);

  // Query for resources
  const { data: resources = [], isLoading: resourcesLoading } = useQuery<Resource[]>({
    queryKey: ['/api/resources'],
  });

  // Query for resource unavailability
  const { data: unavailabilityEntries = [], isLoading: unavailabilityLoading } = useQuery<ResourceUnavailability[]>({
    queryKey: ['/api/resource-unavailability'],
  });

  // Get week view for the selected date
  const getWeekDays = () => {
    const startOfWeek = new Date(selectedDate);
    const dayOfWeek = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - dayOfWeek; // Start from Sunday
    startOfWeek.setDate(diff);
    
    const days = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const weekDays = getWeekDays();

  // Get working time for an operator on a specific day
  const getOperatorWorkTime = (resource: Resource, day: Date) => {
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayNames[day.getDay()] as keyof Resource['workSchedule'];
    
    // Check for unavailability on this date
    const dayStart = new Date(day);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setHours(23, 59, 59, 999);

    const unavailable = unavailabilityEntries.find(entry => {
      const entryStart = new Date(entry.startDate);
      const entryEnd = new Date(entry.endDate);
      return entry.resourceId === resource.id && 
             entryStart <= dayEnd && 
             entryEnd >= dayStart;
    });

    if (unavailable) {
      return {
        type: 'unavailable',
        reason: unavailable.reason,
        isPartialDay: unavailable.isPartialDay,
        startTime: unavailable.startTime,
        endTime: unavailable.endTime,
      };
    }

    // Check custom schedule - ONLY use individual day entries
    const schedule = resource.workSchedule?.[dayName];
    if (schedule && schedule.enabled && schedule.startTime && schedule.endTime) {
      return {
        type: 'working',
        startTime: schedule.startTime,
        endTime: schedule.endTime,
      };
    }

    // If no custom schedule for this day, operator is off
    return { type: 'off' };
  };

  // Calculate working hours percentage for visual bar
  const getWorkingHoursPercentage = (workTime: any) => {
    if (workTime.type !== 'working' || !workTime.startTime || !workTime.endTime) return 0;
    
    const start = workTime.startTime.split(':').map(Number);
    const end = workTime.endTime.split(':').map(Number);
    
    const startMinutes = start[0] * 60 + start[1];
    const endMinutes = end[0] * 60 + end[1];
    
    const workingMinutes = endMinutes - startMinutes;
    const maxWorkingMinutes = 12 * 60; // Assume 12 hour max working day
    
    return Math.min((workingMinutes / maxWorkingMinutes) * 100, 100);
  };

  // Get bar position for timeline
  const getTimelinePosition = (workTime: any) => {
    if (workTime.type !== 'working' || !workTime.startTime || !workTime.endTime) return { left: 0, width: 0 };
    
    const start = workTime.startTime.split(':').map(Number);
    const end = workTime.endTime.split(':').map(Number);
    
    const startMinutes = start[0] * 60 + start[1];
    const endMinutes = end[0] * 60 + end[1];
    
    const dayMinutes = 24 * 60;
    const leftPercent = (startMinutes / dayMinutes) * 100;
    const widthPercent = ((endMinutes - startMinutes) / dayMinutes) * 100;
    
    return { left: leftPercent, width: widthPercent };
  };

  const activeOperators = resources.filter(r => r.isActive && (r.role === 'Operator' || r.role === 'Shift Lead'));

  if (resourcesLoading || unavailabilityLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="text-sm text-muted-foreground">Loading operator schedules...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <User className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Operator Working Times</h3>
          <Badge variant="outline">{activeOperators.length} Active Operators</Badge>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>Week of {weekDays[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
        </div>
      </div>

      {/* Time Headers */}
      <div className="flex gap-0 text-sm font-medium text-muted-foreground">
        <div className="text-right pr-4 sticky left-0 bg-background z-10 w-48 flex-shrink-0">Operator</div>
        <div className="flex flex-1" style={{ minWidth: '600px' }}>
          {weekDays.map((day, index) => (
            <div 
              key={index} 
              className="text-center text-xs border-r border-gray-200 dark:border-gray-600 flex-1"
            >
              <div className="pb-1 border-b border-gray-100 dark:border-gray-700">
                {day.toLocaleDateString('en-US', { 
                  weekday: 'short', 
                  month: 'short',
                  day: 'numeric'
                })}
              </div>
              {/* 24-hour timeline markers */}
              <div className="flex h-4 text-[9px] text-gray-500 dark:text-gray-400">
                <div className="flex-1 text-left">12A</div>
                <div className="flex-1 text-center">6A</div>
                <div className="flex-1 text-center">12P</div>
                <div className="flex-1 text-center">6P</div>
                <div className="flex-1 text-right">12A</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Operator Rows */}
      <div className="space-y-2">
        {activeOperators.map((operator) => (
          <div key={operator.id} className="flex gap-0 items-center">
            <div className="text-sm font-medium text-right pr-4 min-w-0 sticky left-0 z-10 w-48 flex-shrink-0 bg-background">
              <div className="flex items-center justify-end gap-1 mb-1">
                <Badge 
                  variant={operator.role === 'Shift Lead' ? 'default' : 'secondary'}
                  className="text-xs"
                >
                  {operator.role}
                </Badge>
                <span className="truncate">{operator.name}</span>
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {operator.workCenters?.length || 0} work centers
              </div>
            </div>
            
            {/* Timeline container */}
            <div className="flex flex-1 relative h-12" style={{ minWidth: '600px' }}>
              {/* Background grid */}
              <div className="absolute inset-0 flex flex-1">
                {weekDays.map((day, dayIndex) => (
                  <div 
                    key={dayIndex} 
                    className="border-r border-gray-200 dark:border-gray-600 flex-1 bg-gray-50 dark:bg-gray-900"
                  >
                    {/* Hour markers */}
                    <div className="h-full flex">
                      {[0, 6, 12, 18, 24].map((hour, hourIndex) => (
                        <div 
                          key={hourIndex} 
                          className="flex-1 border-r border-gray-100 dark:border-gray-700 opacity-30"
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Working time bars */}
              <div className="absolute inset-0 p-0.5">
                {weekDays.map((day, dayIndex) => {
                  const workTime = getOperatorWorkTime(operator, day);
                  const position = getTimelinePosition(workTime);
                  
                  if (workTime.type === 'off') return null;
                  
                  return (
                    <div
                      key={dayIndex}
                      className="absolute h-11"
                      style={{
                        left: `${(dayIndex / 7) * 100 + (position.left / 7)}%`,
                        width: `${position.width / 7}%`,
                        top: '2px'
                      }}
                    >
                      <div 
                        className={`h-full rounded text-xs text-white font-medium flex items-center justify-center ${
                          workTime.type === 'unavailable' 
                            ? 'bg-red-500' 
                            : operator.shiftSchedule?.includes(1) 
                              ? 'bg-blue-500' 
                              : 'bg-green-500'
                        }`}
                        title={
                          workTime.type === 'unavailable' 
                            ? `Unavailable: ${workTime.reason}` 
                            : `Working: ${workTime.startTime} - ${workTime.endTime}`
                        }
                      >
                        {workTime.type === 'unavailable' ? (
                          <AlertTriangle className="h-3 w-3" />
                        ) : (
                          <Clock className="h-3 w-3" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-6 p-4 bg-muted/50 rounded-lg">
        <div className="text-sm font-medium mb-2">Legend</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div className="flex items-center">
            <div className="w-4 h-4 bg-blue-500 rounded mr-2"></div>
            <span>Shift 1 (3 AM - 3 PM)</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-green-500 rounded mr-2"></div>
            <span>Shift 2 (3 PM - 11 PM)</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-red-500 rounded mr-2"></div>
            <span>Unavailable</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-gray-100 dark:bg-gray-700 rounded mr-2"></div>
            <span>Day Off</span>
          </div>
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          Working times are based on custom schedules and resource management entries. 
          Unavailability includes vacation, sick time, training, and other time-off entries.
        </div>
      </div>
    </div>
  );
}