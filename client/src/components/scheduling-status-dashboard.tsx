import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  PlayCircle, 
  Wrench, 
  Users, 
  TrendingUp,
  RefreshCw,
  AlertCircle,
  Info
} from 'lucide-react';
import { format } from 'date-fns';
import type { Job, Machine, Resource } from '@shared/schema';

interface SchedulingIssue {
  jobId: string;
  jobNumber: string;
  issueType: 'no_machines' | 'no_operators' | 'capacity_full' | 'routing_error' | 'resource_conflict';
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  operations: {
    sequence: number;
    name: string;
    machineType: string;
    compatibleMachines: string[];
    requiredHours: number;
    issues: string[];
  }[];
  suggestedActions: string[];
}

interface SchedulingMetrics {
  totalJobs: number;
  scheduledJobs: number;
  unscheduledJobs: number;
  schedulingSuccessRate: number;
  averageSchedulingTime: number;
  machineUtilization: number;
  operatorUtilization: number;
  bottleneckMachineTypes: string[];
  recentFailures: number;
}

export function SchedulingStatusDashboard() {
  const [issues, setIssues] = useState<SchedulingIssue[]>([]);
  const [metrics, setMetrics] = useState<SchedulingMetrics | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lastAnalyzed, setLastAnalyzed] = useState<Date | null>(null);

  const { data: jobs } = useQuery<Job[]>({
    queryKey: ['/api/jobs']
  });

  const { data: machines } = useQuery<Machine[]>({
    queryKey: ['/api/machines']
  });

  const { data: resources } = useQuery<Resource[]>({
    queryKey: ['/api/resources']
  });

  const analyzeSchedulingIssues = async () => {
    if (!jobs || !machines || !resources) return;

    setIsAnalyzing(true);
    const foundIssues: SchedulingIssue[] = [];
    
    const unscheduledJobs = jobs.filter(job => 
      job.status === 'Unscheduled' || job.status === 'Planning'
    );

    for (const job of unscheduledJobs) {
      if (!job.routing || job.routing.length === 0) {
        foundIssues.push({
          jobId: job.id,
          jobNumber: job.jobNumber,
          issueType: 'routing_error',
          severity: 'high',
          description: `Job ${job.jobNumber} has no routing operations defined`,
          operations: [],
          suggestedActions: [
            'Define routing operations for this job',
            'Check if job was imported correctly from CSV'
          ]
        });
        continue;
      }

      const jobIssues: SchedulingIssue['operations'] = [];
      let hasBlockingIssues = false;

      for (const operation of job.routing) {
        const operationIssues: string[] = [];
        
        // Check for compatible machines
        const compatibleMachines = machines.filter(machine => 
          operation.compatibleMachines.includes(machine.machineId) &&
          machine.status === 'Available'
        );

        if (compatibleMachines.length === 0) {
          operationIssues.push('No available compatible machines found');
          hasBlockingIssues = true;
        }

        // Check for qualified operators (skip for OUTSOURCE and INSPECT-001 operations)
        const isExternalOperation = operation.machineType === 'OUTSOURCE' || 
                                   operation.compatibleMachines.includes('OUTSOURCE-001') ||
                                   operation.compatibleMachines.includes('INSPECT-001');
        
        if (!isExternalOperation) {
          const qualifiedOperators = resources.filter(resource => 
            resource.isActive &&
            (resource.role === 'Operator' || resource.role === 'Shift Lead') &&
            compatibleMachines.some(machine => resource.workCenters?.includes(machine.id))
          );

          if (qualifiedOperators.length === 0 && compatibleMachines.length > 0) {
            operationIssues.push('No qualified operators available for compatible machines');
            hasBlockingIssues = true;
          }
        }

        // Check for extremely long operations that might cause capacity issues
        const estimatedHours = parseFloat(String(operation.estimatedHours || '0'));
        if (estimatedHours > 16) {
          operationIssues.push(`Very long operation (${estimatedHours}h) may require special scheduling`);
        }

        jobIssues.push({
          sequence: operation.sequence,
          name: operation.name || operation.operationType || 'Unknown',
          machineType: operation.machineType,
          compatibleMachines: operation.compatibleMachines,
          requiredHours: estimatedHours,
          issues: operationIssues
        });
      }

      if (hasBlockingIssues) {
        foundIssues.push({
          jobId: job.id,
          jobNumber: job.jobNumber,
          issueType: jobIssues.some(op => op.issues.some(issue => issue.includes('No available compatible machines'))) 
            ? 'no_machines' 
            : 'no_operators',
          severity: 'critical',
          description: `Job ${job.jobNumber} cannot be scheduled due to resource constraints`,
          operations: jobIssues,
          suggestedActions: [
            'Check machine availability and status',
            'Verify operator assignments and qualifications',
            'Consider machine substitution if available',
            'Review routing requirements for accuracy'
          ]
        });
      }
    }

    // Calculate metrics
    const scheduledJobs = jobs.filter(job => 
      job.status === 'Scheduled' || job.status === 'In Progress' || job.status === 'Complete'
    ).length;

    const newMetrics: SchedulingMetrics = {
      totalJobs: jobs.length,
      scheduledJobs,
      unscheduledJobs: unscheduledJobs.length,
      schedulingSuccessRate: jobs.length > 0 ? (scheduledJobs / jobs.length) * 100 : 0,
      averageSchedulingTime: 0, // Would need historical data
      machineUtilization: 0, // Would need capacity calculations
      operatorUtilization: 0, // Would need capacity calculations
      bottleneckMachineTypes: [], // Would need deeper analysis
      recentFailures: foundIssues.length
    };

    setIssues(foundIssues);
    setMetrics(newMetrics);
    setLastAnalyzed(new Date());
    setIsAnalyzing(false);
  };

  useEffect(() => {
    if (jobs && machines && resources) {
      analyzeSchedulingIssues();
    }
  }, [jobs, machines, resources]);

  const getIssueIcon = (issueType: SchedulingIssue['issueType']) => {
    switch (issueType) {
      case 'no_machines': return <Wrench className="h-4 w-4" />;
      case 'no_operators': return <Users className="h-4 w-4" />;
      case 'capacity_full': return <Clock className="h-4 w-4" />;
      case 'routing_error': return <AlertTriangle className="h-4 w-4" />;
      case 'resource_conflict': return <AlertCircle className="h-4 w-4" />;
      default: return <Info className="h-4 w-4" />;
    }
  };

  const getSeverityColor = (severity: SchedulingIssue['severity']) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'secondary';
    }
  };

  return (
    <div className="space-y-6" data-testid="scheduling-status-dashboard">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Scheduling Status Dashboard</h2>
          <p className="text-muted-foreground">
            Monitor job scheduling health and identify potential issues
          </p>
        </div>
        <Button 
          onClick={analyzeSchedulingIssues}
          disabled={isAnalyzing}
          data-testid="button-refresh-analysis"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isAnalyzing ? 'animate-spin' : ''}`} />
          {isAnalyzing ? 'Analyzing...' : 'Refresh Analysis'}
        </Button>
      </div>

      {/* Metrics Overview */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Jobs</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.totalJobs}</div>
              <p className="text-xs text-muted-foreground">
                {metrics.scheduledJobs} scheduled, {metrics.unscheduledJobs} pending
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.schedulingSuccessRate.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">
                Jobs successfully scheduled
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Issues</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{issues.length}</div>
              <p className="text-xs text-muted-foreground">
                {issues.filter(i => i.severity === 'critical').length} critical
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Last Analysis</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-sm font-bold">
                {lastAnalyzed ? format(lastAnalyzed, 'HH:mm:ss') : 'Never'}
              </div>
              <p className="text-xs text-muted-foreground">
                {lastAnalyzed ? format(lastAnalyzed, 'MMM d, yyyy') : 'Run analysis'}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Detailed Issues */}
      <Tabs defaultValue="issues" className="w-full">
        <TabsList>
          <TabsTrigger value="issues">Scheduling Issues</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
        </TabsList>

        <TabsContent value="issues" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Current Scheduling Issues</CardTitle>
              <p className="text-sm text-muted-foreground">
                Jobs that cannot be scheduled and require attention
              </p>
            </CardHeader>
            <CardContent>
              {issues.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold">No Scheduling Issues Found</h3>
                  <p className="text-muted-foreground">All jobs can be scheduled successfully</p>
                </div>
              ) : (
                <ScrollArea className="h-96">
                  <div className="space-y-4">
                    {issues.map((issue, index) => (
                      <div key={index} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {getIssueIcon(issue.issueType)}
                            <span className="font-semibold">Job {issue.jobNumber}</span>
                          </div>
                          <Badge variant={getSeverityColor(issue.severity) as any}>
                            {issue.severity}
                          </Badge>
                        </div>
                        
                        <p className="text-sm text-muted-foreground">
                          {issue.description}
                        </p>

                        {issue.operations.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-sm font-medium">Operation Details:</h4>
                            {issue.operations.map((op, opIndex) => (
                              <div key={opIndex} className="ml-4 text-sm">
                                <div className="font-medium">
                                  {op.sequence}. {op.name} - {op.machineType} ({op.requiredHours}h)
                                </div>
                                <div className="text-muted-foreground">
                                  Compatible: [{op.compatibleMachines.join(', ')}]
                                </div>
                                {op.issues.length > 0 && (
                                  <ul className="ml-4 text-red-600">
                                    {op.issues.map((issueText, issueIndex) => (
                                      <li key={issueIndex}>• {issueText}</li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="space-y-1">
                          <h4 className="text-sm font-medium">Suggested Actions:</h4>
                          <ul className="ml-4 text-sm text-muted-foreground">
                            {issue.suggestedActions.map((action, actionIndex) => (
                              <li key={actionIndex}>• {action}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Recommendations</CardTitle>
              <p className="text-sm text-muted-foreground">
                Actions to improve scheduling efficiency
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-2">General Health Check</h3>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>• Ensure all machine work centers are properly configured</li>
                    <li>• Verify operator qualifications match machine requirements</li>
                    <li>• Review job routing data for accuracy and completeness</li>
                    <li>• Check for adequate shift coverage across all work centers</li>
                  </ul>
                </div>

                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-2">Capacity Planning</h3>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>• Monitor machine utilization trends to identify bottlenecks</li>
                    <li>• Plan operator training for high-demand work centers</li>
                    <li>• Consider machine substitution options for overloaded types</li>
                    <li>• Review job priorities to optimize scheduling order</li>
                  </ul>
                </div>

                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-2">Data Quality</h3>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>• Validate CSV imports for correct routing information</li>
                    <li>• Ensure machine IDs in routing match available machines</li>
                    <li>• Check estimated hours for reasonableness</li>
                    <li>• Verify work center assignments for all resources</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}