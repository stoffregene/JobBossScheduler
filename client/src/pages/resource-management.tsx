import { useState } from "react";
import ResourceUnavailability from "../components/resource-unavailability";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Users, AlertTriangle, CheckCircle, XCircle } from "lucide-react";

export default function ResourceManagement() {
  const [showUnavailabilityForm, setShowUnavailabilityForm] = useState(false);

  // Sample data - in a real app, this would come from APIs
  const upcomingUnavailabilities = [
    {
      id: "1",
      resourceName: "John Smith",
      reason: "Vacation",
      startDate: "2025-02-15",
      endDate: "2025-02-22",
      shifts: [1, 2],
      status: "scheduled"
    },
    {
      id: "2", 
      resourceName: "Sarah Johnson",
      reason: "Training",
      startDate: "2025-02-10",
      endDate: "2025-02-10",
      shifts: [1],
      status: "active"
    }
  ];

  const recentRescheduleResults = [
    {
      id: "1",
      timestamp: "2025-02-01T10:30:00Z",
      reason: "Mike Chen - Sick Leave",
      conflictsResolved: 5,
      jobsRescheduled: 3,
      operationsRescheduled: 8,
      success: true
    },
    {
      id: "2",
      timestamp: "2025-01-28T14:15:00Z", 
      reason: "Equipment Maintenance - VMC-001",
      conflictsResolved: 12,
      jobsRescheduled: 7,
      operationsRescheduled: 15,
      success: true
    }
  ];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Resource Management</h1>
          <p className="text-gray-600 dark:text-gray-300">
            Manage resource availability and automatic job rescheduling
          </p>
        </div>
        <Button
          onClick={() => setShowUnavailabilityForm(true)}
          className="flex items-center gap-2"
        >
          <AlertTriangle className="h-4 w-4" />
          Mark Resources Unavailable
        </Button>
      </div>

      {showUnavailabilityForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <ResourceUnavailability onClose={() => setShowUnavailabilityForm(false)} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Unavailabilities */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Upcoming Unavailabilities
            </CardTitle>
            <CardDescription>
              Scheduled resource unavailability periods
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {upcomingUnavailabilities.map((unavailability) => (
                <div
                  key={unavailability.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="font-medium">{unavailability.resourceName}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">
                      {unavailability.reason}
                    </div>
                    <div className="text-xs text-gray-500 flex items-center gap-4 mt-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(unavailability.startDate).toLocaleDateString()} - {new Date(unavailability.endDate).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Shifts: {unavailability.shifts.map(s => `${s}${s === 1 ? 'st' : 'nd'}`).join(', ')}
                      </span>
                    </div>
                  </div>
                  <Badge variant={unavailability.status === 'active' ? 'destructive' : 'secondary'}>
                    {unavailability.status}
                  </Badge>
                </div>
              ))}
              {upcomingUnavailabilities.length === 0 && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No upcoming unavailabilities scheduled</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Rescheduling Results */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Recent Rescheduling Results
            </CardTitle>
            <CardDescription>
              Automatic rescheduling activity and results
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentRescheduleResults.map((result) => (
                <div
                  key={result.id}
                  className="p-3 border rounded-lg"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="font-medium text-sm">{result.reason}</div>
                    <div className="flex items-center gap-1">
                      {result.success ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      <span className="text-xs text-gray-500">
                        {new Date(result.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="text-center p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
                      <div className="font-semibold text-blue-600 dark:text-blue-400">
                        {result.conflictsResolved}
                      </div>
                      <div className="text-gray-600 dark:text-gray-300">Conflicts</div>
                    </div>
                    <div className="text-center p-2 bg-green-50 dark:bg-green-900/20 rounded">
                      <div className="font-semibold text-green-600 dark:text-green-400">
                        {result.jobsRescheduled}
                      </div>
                      <div className="text-gray-600 dark:text-gray-300">Jobs</div>
                    </div>
                    <div className="text-center p-2 bg-purple-50 dark:bg-purple-900/20 rounded">
                      <div className="font-semibold text-purple-600 dark:text-purple-400">
                        {result.operationsRescheduled}
                      </div>
                      <div className="text-gray-600 dark:text-gray-300">Operations</div>
                    </div>
                  </div>
                </div>
              ))}
              {recentRescheduleResults.length === 0 && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <CheckCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No recent rescheduling activity</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Key Features */}
      <Card>
        <CardHeader>
          <CardTitle>28-Day Lead Time Rescheduling</CardTitle>
          <CardDescription>
            How the automatic rescheduling system works
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                <h3 className="font-medium">Conflict Detection</h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Automatically identifies scheduling conflicts when resources become unavailable
              </p>
            </div>
            
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-5 w-5 text-blue-500" />
                <h3 className="font-medium">Intelligent Substitution</h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Uses tier-based machine substitution and resource skills to find alternatives
              </p>
            </div>
            
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <h3 className="font-medium">Route Dependencies</h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Maintains routing sequence dependencies while rescheduling operations
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}