import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, Clock, Wrench, Users } from 'lucide-react';
import { format } from 'date-fns';

interface SchedulingFailure {
  jobId: string;
  jobNumber?: string;
  failureReason: string;
  failureDetails: Array<{
    operationSequence: number;
    operationName: string;
    machineType: string;
    compatibleMachines: string[];
    attemptedDates: number;
    reasons: string[];
  }>;
  timestamp: Date;
}

export function SchedulingFailuresWidget() {
  const [failures, setFailures] = useState<SchedulingFailure[]>([]);

  useEffect(() => {
    // Listen for scheduling failures via WebSocket
    const handleMessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'schedule_progress' && message.data.stage === 'error' && message.data.failureDetails) {
          const newFailure: SchedulingFailure = {
            jobId: message.data.jobId,
            failureReason: message.data.status,
            failureDetails: message.data.failureDetails || [],
            timestamp: new Date()
          };
          
          setFailures(prev => [newFailure, ...prev].slice(0, 10)); // Keep last 10 failures
        }
      } catch (error) {
        // Ignore non-JSON messages
      }
    };

    let ws: WebSocket | null = null;
    
    try {
      // Use appropriate protocol based on current location
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}`;
      
      ws = new WebSocket(wsUrl);
      
      ws.addEventListener('message', handleMessage);
      ws.addEventListener('error', (error) => {
        console.log('WebSocket error:', error);
      });
      ws.addEventListener('open', () => {
        console.log('WebSocket connected');
      });
      ws.addEventListener('close', () => {
        console.log('WebSocket disconnected');
      });
    } catch (error) {
      console.log('Failed to create WebSocket connection:', error);
    }

    return () => {
      if (ws) {
        ws.removeEventListener('message', handleMessage);
        ws.close();
      }
    };
  }, []);

  const getFailureIcon = (reason: string) => {
    if (reason.includes('shift')) return <Users className="h-4 w-4" />;
    if (reason.includes('compatible')) return <Wrench className="h-4 w-4" />;
    if (reason.includes('booked') || reason.includes('conflict')) return <Clock className="h-4 w-4" />;
    return <AlertTriangle className="h-4 w-4" />;
  };

  const getFailureSeverity = (details: SchedulingFailure['failureDetails']) => {
    if (details.some(d => d.reasons.some(r => r.includes('No compatible machines')))) return 'critical';
    if (details.some(d => d.reasons.some(r => r.includes('not available on shift')))) return 'high';
    return 'medium';
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      default: return 'secondary';
    }
  };

  if (failures.length === 0) {
    return (
      <Card data-testid="scheduling-failures-widget">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            Recent Scheduling Failures
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No recent scheduling failures
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="scheduling-failures-widget">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          Recent Scheduling Failures ({failures.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-96">
          <div className="space-y-4">
            {failures.map((failure, index) => {
              const severity = getFailureSeverity(failure.failureDetails);
              return (
                <div key={index} className="border rounded-lg p-3 space-y-2" data-testid={`failure-${index}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getFailureIcon(failure.failureReason)}
                      <span className="font-medium text-sm">Job {failure.jobNumber || failure.jobId.slice(0, 8)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={getSeverityColor(severity) as any} className="text-xs">
                        {severity}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(failure.timestamp, 'MMM d, HH:mm')}
                      </span>
                    </div>
                  </div>
                  
                  <p className="text-sm text-muted-foreground">{failure.failureReason}</p>
                  
                  {failure.failureDetails.map((detail, detailIndex) => (
                    <div key={detailIndex} className="bg-muted/50 rounded p-2 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium">Operation {detail.operationSequence}: {detail.operationName}</span>
                        <span className="text-muted-foreground">Tried {detail.attemptedDates} days</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <strong>Machine Type:</strong> {detail.machineType}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <strong>Compatible Machines:</strong> {detail.compatibleMachines.join(', ') || 'None'}
                      </div>
                      <div className="space-y-1">
                        {detail.reasons.map((reason, reasonIndex) => (
                          <div key={reasonIndex} className="text-xs text-muted-foreground flex items-start gap-1">
                            <span className="text-red-500 mt-0.5">•</span>
                            <span>{reason}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}