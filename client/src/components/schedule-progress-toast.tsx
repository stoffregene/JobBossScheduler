import { useState, useEffect } from "react";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { X, CheckCircle, AlertCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ScheduleProgressToastProps {
  isVisible: boolean;
  onClose: () => void;
}

interface ProgressData {
  jobId: string;
  progress: number;
  status: string;
  stage: string;
  operationName?: string;
  currentOperation?: number;
  totalOperations?: number;
}

export default function ScheduleProgressToast({ isVisible, onClose }: ScheduleProgressToastProps) {
  const [progressData, setProgressData] = useState<ProgressData | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!isVisible) return;

    const ws = new WebSocket(`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`);
    
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        if (message.type === 'schedule_progress') {
          const data = message.data as ProgressData;
          setProgressData(data);
          
          if (data.stage === 'completed') {
            setIsComplete(true);
            setTimeout(() => {
              onClose();
            }, 3000); // Auto-close after 3 seconds when complete
          } else if (data.stage === 'error') {
            setHasError(true);
            setTimeout(() => {
              onClose();
            }, 5000); // Auto-close after 5 seconds on error
          }
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    return () => {
      ws.close();
    };
  }, [isVisible, onClose]);

  if (!isVisible || !progressData) {
    return null;
  }

  const getStageIcon = () => {
    if (hasError) return <AlertCircle className="h-5 w-5 text-red-500" />;
    if (isComplete) return <CheckCircle className="h-5 w-5 text-green-500" />;
    return <Clock className="h-5 w-5 text-blue-500 animate-spin" />;
  };

  const getStageColor = () => {
    if (hasError) return "border-red-200 bg-red-50";
    if (isComplete) return "border-green-200 bg-green-50";
    return "border-blue-200 bg-blue-50";
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md">
      <Card className={`shadow-lg ${getStageColor()}`}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center space-x-2">
              {getStageIcon()}
              <h3 className="font-semibold text-sm">Auto-Schedule Progress</h3>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={onClose}
              data-testid="button-close-progress"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                {progressData.currentOperation && progressData.totalOperations
                  ? `Operation ${progressData.currentOperation} of ${progressData.totalOperations}`
                  : 'Processing...'
                }
              </span>
              <span>{progressData.progress}%</span>
            </div>
            
            <Progress 
              value={progressData.progress} 
              className="h-2"
              data-testid="progress-bar"
            />
            
            <div className="text-sm">
              <p className="font-medium">{progressData.status}</p>
              {progressData.operationName && (
                <p className="text-xs text-muted-foreground mt-1">
                  Current: {progressData.operationName}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}