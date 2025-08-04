import { useQuery } from "@tanstack/react-query";
import { useWebSocket } from "@/hooks/use-websocket";
import { queryClient } from "@/lib/queryClient";
import DashboardOverview from "../components/dashboard-overview";
import JobQueue from "../components/job-queue";
import ScheduleView from "../components/schedule-view";
import MachineStatus from "../components/machine-status";


import JobDetailsModal from "../components/job-details-modal";
import MaterialOrdersWidget from "../components/material-orders-widget";
import JobsAwaitingMaterialWidget from "../components/jobs-awaiting-material-widget";
import { EfficiencyImpactWidget } from "../components/efficiency-impact-widget";
import { SchedulingFailuresWidget } from "../components/scheduling-failures-widget";
import { Building2, Clock, Users, Package, Upload, Moon, Sun } from "lucide-react";
import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";
import type { Job } from "@shared/schema";

export default function Dashboard() {
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [scheduleView, setScheduleView] = useState<{ type: 'week' | 'month', date: Date }>({ 
    type: 'week', 
    date: new Date() 
  });
  const { theme, toggleTheme } = useTheme();

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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Building2 className="text-primary-500 text-xl" />
                <span className="text-xl font-bold text-gray-900 dark:text-white">JobBoss Scheduler</span>
              </div>
              <nav className="flex items-center space-x-4">
                <Link href="/resources">
                  <Button variant="outline" size="sm" className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Resource Management
                  </Button>
                </Link>
                <Link href="/materials">
                  <Button variant="outline" size="sm" className="flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Material Tracking
                  </Button>
                </Link>
                <Link href="/job-import">
                  <Button variant="outline" size="sm" className="flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    Import Jobs
                  </Button>
                </Link>
                <Link href="/work-centers">
                  <Button variant="outline" size="sm" className="flex items-center gap-2" data-testid="link-work-centers">
                    <Building2 className="w-4 h-4" />
                    Work Centers
                  </Button>
                </Link>
              </nav>
              <div className="hidden md:flex items-center text-sm text-gray-500 dark:text-gray-400">
                <Clock className="mr-1 h-4 w-4" />
                <span>{formatCurrentTime(currentTime)}</span>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Theme Toggle */}
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                className="w-9 h-9"
              >
                {theme === "light" ? (
                  <Moon className="h-4 w-4" />
                ) : (
                  <Sun className="h-4 w-4" />
                )}
                <span className="sr-only">Toggle theme</span>
              </Button>
              
              {/* Database Status */}
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-success-500 rounded-full"></div>
                <span className="text-sm text-gray-600 dark:text-gray-300">JobBoss Connected</span>
              </div>
              
              {/* User Menu */}
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Production Manager</span>
                <button className="w-8 h-8 bg-primary-500 text-white rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium">PM</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Dashboard Overview */}
        <div className="mb-8">
          <DashboardOverview />
        </div>

        {/* Main Content Grid - Reorganized for better visibility */}
        <div className="grid grid-cols-1 xl:grid-cols-5 lg:grid-cols-4 gap-6">
          {/* Left Column: Job Queue - Enhanced visibility */}
          <div className="xl:col-span-2 lg:col-span-2 space-y-6">
            <JobQueue onJobSelect={setSelectedJobId} />
          </div>

          {/* Center Column: Production Schedule Calendar - More real estate */}
          <div className="xl:col-span-2 lg:col-span-2 space-y-6">
            <ScheduleView 
              scheduleView={scheduleView}
              onScheduleViewChange={setScheduleView}
            />
          </div>

          {/* Right Column: Alerts, Materials & Work Center Status */}
          <div className="xl:col-span-1 lg:col-span-1 space-y-6">
            <SchedulingFailuresWidget />
            <MaterialOrdersWidget />
            <JobsAwaitingMaterialWidget />
            <EfficiencyImpactWidget />
            
            {/* Work Center Status - Minimized and lower priority */}
            <div className="mt-8">
              <MachineStatus minimized={true} />
            </div>            
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
