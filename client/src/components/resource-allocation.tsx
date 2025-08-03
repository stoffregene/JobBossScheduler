import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Filter } from "lucide-react";
import { useState } from "react";
import type { DashboardStats, Machine } from "@shared/schema";

interface ResourceAllocationProps {
  scheduleView: {
    type: "week" | "month";
    date: Date;
  };
}

export default function ResourceAllocation({ scheduleView }: ResourceAllocationProps) {
  const [workCenterFilter, setWorkCenterFilter] = useState<string>("ALL");
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ['/api/dashboard/stats'],
  });

  const { data: machines } = useQuery<Machine[]>({
    queryKey: ['/api/machines'],
  });

  // Get work center types for filtering
  const workCenterTypes = Array.from(new Set(machines?.map(m => m.type) || [])).sort();

  if (isLoading) {
    return (
      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="dark:text-white">Resource Allocation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded"></div>
            <div className="h-8 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return (
      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="dark:text-white">Resource Allocation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500 py-8">
            Failed to load resource allocation data
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate shift capacities
  const shift1Capacity = stats.shift1Resources * 7.5; // 7.5 hours per operator
  const shift2Capacity = stats.shift2Resources * 6.5; // 6.5 hours per operator
  const weeklyCapacity = (shift1Capacity + shift2Capacity) * 4; // 4 days per week
  const utilizationPercent = Math.round((stats.usedCapacity / stats.totalCapacity) * 100);

  // Calculate period-specific values
  const daysInPeriod = scheduleView.type === "month" ? 30 : 7;
  const periodicCapacity = (shift1Capacity + shift2Capacity) * (daysInPeriod / 7);
  const periodLabel = scheduleView.type === "month" ? "Month" : "Week";

  return (
    <Card className="dark:bg-gray-800 dark:border-gray-700">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="dark:text-white">
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
        <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
              Total {periodLabel} Capacity
            </span>
            <span className="text-lg font-bold text-primary-600 dark:text-primary-400">
              {Math.round(periodicCapacity)}h
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-3">
            <div 
              className="bg-success-500 h-3 rounded-full" 
              style={{ width: `${Math.min(utilizationPercent, 100)}%` }}
            ></div>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {utilizationPercent}% utilized
          </div>
        </div>

        {/* 1st Shift */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">1st Shift (3AM - 3PM)</span>
            <span className="text-sm text-gray-500 dark:text-gray-400">{stats.shift1Resources}/{stats.shift1Resources} operators</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
            <div className="bg-success-500 h-2 rounded-full" style={{ width: '100%' }}></div>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Capacity: {Math.round(shift1Capacity * (daysInPeriod / 7))}h ({stats.shift1Resources} × 7.5h × {Math.round(daysInPeriod / 7)} weeks)
          </div>
        </div>

        {/* 2nd Shift */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">2nd Shift (3PM - 3AM)</span>
            <span className="text-sm text-gray-500 dark:text-gray-400">{stats.shift2Resources}/{stats.shift2Resources} operators</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
            <div className="bg-warning-500 h-2 rounded-full" style={{ width: '100%' }}></div>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Capacity: {shift2Capacity} hours ({stats.shift2Resources} × 6.5h)
          </div>
        </div>

        {/* Weekly Capacity */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="text-sm font-medium text-gray-700 mb-2">Weekly Capacity Overview</div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-gray-600">Total Hours:</div>
              <div className="font-medium">{stats.totalCapacity} hours</div>
            </div>
            <div>
              <div className="text-gray-600">Scheduled:</div>
              <div className="font-medium">{stats.usedCapacity} hours</div>
            </div>
            <div>
              <div className="text-gray-600">Available:</div>
              <div className="font-medium text-success-600">{(stats.totalCapacity - stats.usedCapacity).toFixed(2)} hours</div>
            </div>
            <div>
              <div className="text-gray-600">Utilization:</div>
              <div className="font-medium">{utilizationPercent}%</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
