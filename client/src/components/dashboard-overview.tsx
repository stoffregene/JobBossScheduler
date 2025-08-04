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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Active Jobs Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Active Jobs</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.activeJobs}</p>
            </div>
            <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900 rounded-lg flex items-center justify-center">
              <Briefcase className="text-primary-500 text-xl" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <TrendingUp className="text-success-600 h-4 w-4 mr-1" />
            <span className="text-success-600 font-medium">Active</span>
            <span className="text-gray-500 dark:text-gray-400 ml-1">in production</span>
          </div>
        </CardContent>
      </Card>

      {/* Late Jobs Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">At Risk Jobs</p>
              <p className="text-3xl font-bold text-error-500">{stats.lateJobs}</p>
            </div>
            <div className="w-12 h-12 bg-error-100 dark:bg-error-900 rounded-lg flex items-center justify-center">
              <AlertTriangle className="text-error-500 text-xl" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="text-error-600 font-medium">{stats.customerLateJobs} customer late</span>
            <span className="text-gray-500 dark:text-gray-400 ml-1">• {stats.companyLateJobs} company late</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
