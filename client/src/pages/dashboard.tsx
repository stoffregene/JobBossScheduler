import { useQuery } from "@tanstack/react-query";
import { useWebSocket } from "@/hooks/use-websocket";
import { queryClient } from "@/lib/queryClient";
import DashboardOverview from "../components/dashboard-overview";
import JobQueue from "../components/job-queue";
import ScheduleView from "../components/schedule-view";
import MachineStatus from "../components/machine-status";
import AlertPanel from "../components/alert-panel";
import ResourceAllocation from "../components/resource-allocation";
import JobDetailsModal from "../components/job-details-modal";
import { Building2, Clock } from "lucide-react";
import { useState, useEffect } from "react";
import type { Job } from "@shared/schema";

export default function Dashboard() {
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Real-time updates via WebSocket
  useWebSocket((message) => {
    switch (message.type) {
      case 'job_created':
      case 'job_updated':
      case 'job_deleted':
        queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
        queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
        break;
      case 'machine_updated':
        queryClient.invalidateQueries({ queryKey: ['/api/machines'] });
        queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
        break;
      case 'schedule_updated':
      case 'schedule_entry_deleted':
        queryClient.invalidateQueries({ queryKey: ['/api/schedule'] });
        break;
      case 'alert_created':
      case 'alert_read':
      case 'alert_deleted':
        queryClient.invalidateQueries({ queryKey: ['/api/alerts'] });
        break;
    }
  });

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  const formatCurrentTime = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }) + ' - ' + date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Building2 className="text-primary-500 text-xl" />
                <span className="text-xl font-bold text-gray-900">JobBoss Scheduler</span>
              </div>
              <div className="hidden md:flex items-center text-sm text-gray-500">
                <Clock className="mr-1 h-4 w-4" />
                <span>{formatCurrentTime(currentTime)}</span>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Database Status */}
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-success-500 rounded-full"></div>
                <span className="text-sm text-gray-600">JobBoss Connected</span>
              </div>
              
              {/* User Menu */}
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-gray-700">Production Manager</span>
                <button className="w-8 h-8 bg-primary-500 text-white rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium">PM</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Dashboard Overview */}
        <div className="mb-8">
          <DashboardOverview />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Job Queue & Schedule */}
          <div className="lg:col-span-2 space-y-6">
            <JobQueue onJobSelect={setSelectedJobId} />
            <ScheduleView />
          </div>

          {/* Right Column: Machine Status & Alerts */}
          <div className="space-y-6">
            <MachineStatus />
            <AlertPanel />
            <ResourceAllocation />
          </div>
        </div>
      </div>

      {/* Job Details Modal */}
      {selectedJobId && (
        <JobDetailsModal
          jobId={selectedJobId}
          onClose={() => setSelectedJobId(null)}
        />
      )}
    </div>
  );
}
