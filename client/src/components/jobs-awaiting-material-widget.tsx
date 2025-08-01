import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, AlertTriangle, Package2 } from "lucide-react";
import { Link } from "wouter";
import type { Job, MaterialOrder } from "@shared/schema";

interface JobWithMaterials extends Job {
  materialOrders: MaterialOrder[];
}

export default function JobsAwaitingMaterialWidget() {
  const { data: jobsAwaitingMaterial, isLoading } = useQuery<JobWithMaterials[]>({
    queryKey: ['/api/jobs/awaiting-material'],
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Jobs Awaiting Material</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const awaitingJobs = jobsAwaitingMaterial || [];
  const criticalJobs = awaitingJobs.filter(job => {
    const dueDate = new Date(job.dueDate);
    const today = new Date();
    const daysDiff = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysDiff <= 7; // Jobs due within a week
  });

  const formatDate = (date: Date | string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const getDaysToDue = (dueDate: Date | string) => {
    const dateObj = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
    const today = new Date();
    const diffTime = dateObj.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Jobs Awaiting Material</CardTitle>
        <div className="flex items-center space-x-2">
          <Package2 className="h-4 w-4 text-muted-foreground" />
          <Link href="/materials">
            <Button variant="ghost" size="sm" className="text-xs">
              Manage
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Summary Stats */}
          <div className="flex justify-between items-center">
            <div className="text-2xl font-bold">{awaitingJobs.length}</div>
            <div className="text-xs text-muted-foreground">Jobs Blocked</div>
          </div>

          {criticalJobs.length > 0 && (
            <div className="flex items-center space-x-2 p-2 bg-orange-50 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              <span className="text-sm text-orange-700">
                {criticalJobs.length} job{criticalJobs.length > 1 ? 's' : ''} due soon
              </span>
            </div>
          )}

          {/* Job List */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Recent Jobs</div>
            {awaitingJobs.slice(0, 3).map((job) => {
              const daysToDue = getDaysToDue(job.dueDate);
              const isCritical = daysToDue <= 7;
              const pendingMaterials = job.materialOrders.filter(order => order.status !== 'Received').length;

              return (
                <div key={job.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      Job {job.jobId}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {pendingMaterials} material{pendingMaterials > 1 ? 's' : ''} pending
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 ml-2">
                    {isCritical ? (
                      <Badge variant="destructive" className="text-xs">
                        {daysToDue > 0 ? `${daysToDue}d left` : 'Overdue'}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        Due {formatDate(job.dueDate)}
                      </Badge>
                    )}
                    <Clock className="h-3 w-3 text-muted-foreground" />
                  </div>
                </div>
              );
            })}

            {awaitingJobs.length === 0 && (
              <div className="text-center py-4 text-sm text-muted-foreground">
                All jobs ready for scheduling
              </div>
            )}

            {awaitingJobs.length > 3 && (
              <Link href="/materials">
                <Button variant="ghost" size="sm" className="w-full mt-2">
                  View all {awaitingJobs.length} blocked jobs
                </Button>
              </Link>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}