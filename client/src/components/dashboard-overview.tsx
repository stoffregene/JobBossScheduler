import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Briefcase, ServerCog, AlertTriangle, Users, TrendingUp } from "lucide-react";
import type { DashboardStats } from "@shared/schema";

export default function DashboardOverview() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ['/api/dashboard/stats'],
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-20 bg-gray-200 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center text-gray-500 py-8">
        Failed to load dashboard statistics
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* Active Jobs Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Jobs</p>
              <p className="text-3xl font-bold text-gray-900">{stats.activeJobs}</p>
            </div>
            <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
              <Briefcase className="text-primary-500 text-xl" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <TrendingUp className="text-success-600 h-4 w-4 mr-1" />
            <span className="text-success-600 font-medium">Active</span>
            <span className="text-gray-500 ml-1">in production</span>
          </div>
        </CardContent>
      </Card>

      {/* Machine Utilization Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Machine Utilization</p>
              <p className="text-3xl font-bold text-gray-900">{stats.utilization}%</p>
            </div>
            <div className="w-12 h-12 bg-success-100 rounded-lg flex items-center justify-center">
              <ServerCog className="text-success-500 text-xl" />
            </div>
          </div>
          <div className="mt-4">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-success-500 h-2 rounded-full" 
                style={{ width: `${stats.utilization}%` }}
              ></div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Late Jobs Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">At Risk Jobs</p>
              <p className="text-3xl font-bold text-error-500">{stats.lateJobs}</p>
            </div>
            <div className="w-12 h-12 bg-error-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="text-error-500 text-xl" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="text-error-600 font-medium">{stats.customerLateJobs} customer late</span>
            <span className="text-gray-500 ml-1">• {stats.companyLateJobs} company late</span>
          </div>
        </CardContent>
      </Card>

      {/* Resource Capacity Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Resource Capacity</p>
              <p className="text-3xl font-bold text-gray-900">{stats.shift1Resources + stats.shift2Resources}/16</p>
            </div>
            <div className="w-12 h-12 bg-warning-100 rounded-lg flex items-center justify-center">
              <Users className="text-warning-500 text-xl" />
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-500">
            <span>1st Shift: {stats.shift1Resources} operators</span><br />
            <span>2nd Shift: {stats.shift2Resources} operators</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
