import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardStats } from "@shared/schema";

export default function ResourceAllocation() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ['/api/dashboard/stats'],
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Resource Allocation</CardTitle>
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
      <Card>
        <CardHeader>
          <CardTitle>Resource Allocation</CardTitle>
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Resource Allocation</CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* 1st Shift */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">1st Shift (3AM - 3PM)</span>
            <span className="text-sm text-gray-500">{stats.shift1Resources}/{stats.shift1Resources} operators</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-success-500 h-2 rounded-full" style={{ width: '100%' }}></div>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Capacity: {shift1Capacity} hours ({stats.shift1Resources} × 7.5h)
          </div>
        </div>

        {/* 2nd Shift */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">2nd Shift (3PM - 3AM)</span>
            <span className="text-sm text-gray-500">{stats.shift2Resources}/{stats.shift2Resources} operators</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
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
              <div className="font-medium text-success-600">{stats.totalCapacity - stats.usedCapacity} hours</div>
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
