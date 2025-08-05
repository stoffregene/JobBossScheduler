import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, Clock, Users, Wrench, Info } from 'lucide-react';
import type { Job, Machine, Resource } from '@shared/schema';

interface SchedulingFailure {
  jobNumber: string;
  operationName: string;
  machineType: string;
  issue: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  recommendation: string;
}

export function SchedulingFailuresWidget() {
  const { data: jobs } = useQuery<Job[]>({
    queryKey: ['/api/jobs']
  });

  const { data: machines } = useQuery<Machine[]>({
    queryKey: ['/api/machines']
  });

  const { data: resources } = useQuery<Resource[]>({
    queryKey: ['/api/resources']
  });

  const analyzeSchedulingFailures = (): SchedulingFailure[] => {
    if (!jobs || !machines || !resources) return [];

    const failures: SchedulingFailure[] = [];
    const unscheduledJobs = jobs.filter(job => 
      job.status === 'Unscheduled' || job.status === 'Planning'
    );

    // Count resources by shift
    const shift1Operators = resources.filter(r => 
      r.isActive && r.shiftSchedule?.includes(1) && 
      (r.role === 'Operator' || r.role === 'Lead Operator' || r.role === 'Shift Lead')
    ).length;
    
    const shift2Operators = resources.filter(r => 
      r.isActive && r.shiftSchedule?.includes(2) && 
      (r.role === 'Operator' || r.role === 'Lead Operator' || r.role === 'Shift Lead')
    ).length;

    // Analyze shift coverage issues
    if (shift2Operators < shift1Operators * 0.3) {
      failures.push({
        jobNumber: 'SYSTEM',
        operationName: 'Shift Coverage',
        machineType: 'ALL',
        issue: `Critical shift imbalance: Shift 1 has ${shift1Operators} operators, Shift 2 has only ${shift2Operators}`,
        severity: 'critical',
        recommendation: 'Add more operators to Shift 2 or enable more machines for single-shift operation'
      });
    }

    // Analyze specific job failures
    for (const job of unscheduledJobs.slice(0, 10)) { // Limit to first 10 for performance
      if (!job.routing || job.routing.length === 0) {
        failures.push({
          jobNumber: job.jobNumber,
          operationName: 'No Routing',
          machineType: 'N/A',
          issue: 'Job has no routing operations defined',
          severity: 'high',
          recommendation: 'Define routing operations for this job in the system'
        });
        continue;
      }

      for (const operation of job.routing) {
        const compatibleMachines = machines.filter(machine => 
          operation.compatibleMachines.includes(machine.machineId) &&
          machine.status === 'Available'
        );

        if (compatibleMachines.length === 0) {
          failures.push({
            jobNumber: job.jobNumber,
            operationName: operation.name || operation.operationType || 'Unknown',
            machineType: operation.machineType,
            issue: `No available machines found for ${operation.machineType}`,
            severity: 'critical',
            recommendation: `Check machine status for ${operation.compatibleMachines.join(', ')}`
          });
          continue;
        }

        // Check for shift coverage issues
        const shift1Machines = compatibleMachines.filter(m => 
          m.availableShifts?.includes(1)
        ).length;
        
        const shift2Machines = compatibleMachines.filter(m => 
          m.availableShifts?.includes(2)
        ).length;

        if (shift2Machines === 0 && shift1Machines > 0) {
          failures.push({
            jobNumber: job.jobNumber,
            operationName: operation.name || operation.operationType || 'Unknown',
            machineType: operation.machineType,
            issue: `${operation.machineType} only available on Shift 1, causing bottleneck`,
            severity: 'medium',
            recommendation: `Enable ${operation.machineType} machines for Shift 2 operation`
          });
        }

        // Skip resource checks for OUTSOURCE and INSPECT-001
        const isExternalOperation = operation.machineType === 'OUTSOURCE' || 
                                   operation.compatibleMachines.includes('OUTSOURCE-001') ||
                                   operation.compatibleMachines.includes('INSPECT-001');
        
        if (!isExternalOperation) {
          // Check qualified operators for each shift
          for (let shift = 1; shift <= 2; shift++) {
            const shiftMachines = compatibleMachines.filter(m => 
              m.availableShifts?.includes(shift)
            );
            
            if (shiftMachines.length > 0) {
              const qualifiedOperators = resources.filter(resource => 
                resource.isActive &&
                resource.shiftSchedule?.includes(shift) &&
                (resource.role === 'Operator' || resource.role === 'Lead Operator' || resource.role === 'Shift Lead') &&
                shiftMachines.some(machine => resource.workCenters?.includes(machine.id))
              );

              if (qualifiedOperators.length === 0) {
                failures.push({
                  jobNumber: job.jobNumber,
                  operationName: operation.name || operation.operationType || 'Unknown',
                  machineType: operation.machineType,
                  issue: `No qualified operators on Shift ${shift} for ${operation.machineType}`,
                  severity: 'critical',
                  recommendation: `Train operators for ${operation.machineType} on Shift ${shift} or reassign existing operators`
                });
              }
            }
          }
        }
      }
    }

    return failures.slice(0, 15); // Limit to most critical issues
  };

  const failures = analyzeSchedulingFailures();
  const criticalFailures = failures.filter(f => f.severity === 'critical').length;
  const highFailures = failures.filter(f => f.severity === 'high').length;

  const getIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'high': return <Clock className="h-4 w-4 text-orange-500" />;
      case 'medium': return <Users className="h-4 w-4 text-yellow-500" />;
      default: return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <Card data-testid="scheduling-failures-widget">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-orange-500" />
          Scheduling Issues ({failures.length})
        </CardTitle>
        <div className="text-sm text-muted-foreground">
          {criticalFailures} critical, {highFailures} high priority
        </div>
      </CardHeader>
      <CardContent>
        {failures.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground">
            No scheduling issues detected
          </div>
        ) : (
          <ScrollArea className="h-64">
            <div className="space-y-3">
              {failures.map((failure, index) => (
                <div key={index} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getIcon(failure.severity)}
                      <span className="font-medium text-sm">
                        {failure.jobNumber === 'SYSTEM' ? 'System Issue' : `Job ${failure.jobNumber}`}
                      </span>
                    </div>
                    <Badge variant={getSeverityColor(failure.severity) as any} className="text-xs">
                      {failure.severity}
                    </Badge>
                  </div>
                  
                  <div className="text-sm">
                    <div className="font-medium">{failure.operationName} - {failure.machineType}</div>
                    <div className="text-muted-foreground">{failure.issue}</div>
                  </div>
                  
                  <div className="text-xs text-blue-600 dark:text-blue-400">
                    💡 {failure.recommendation}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}