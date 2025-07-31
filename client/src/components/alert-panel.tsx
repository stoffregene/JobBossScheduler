import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Clock, Info, CheckCircle, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import type { Alert } from "@shared/schema";

export default function AlertPanel() {
  const { data: alerts, isLoading } = useQuery<Alert[]>({
    queryKey: ['/api/alerts'],
  });

  const markAsRead = async (alertId: string) => {
    try {
      await apiRequest('PUT', `/api/alerts/${alertId}/read`);
      queryClient.invalidateQueries({ queryKey: ['/api/alerts'] });
    } catch (error) {
      console.error('Failed to mark alert as read:', error);
    }
  };

  const deleteAlert = async (alertId: string) => {
    try {
      await apiRequest('DELETE', `/api/alerts/${alertId}`);
      queryClient.invalidateQueries({ queryKey: ['/api/alerts'] });
    } catch (error) {
      console.error('Failed to delete alert:', error);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Alerts & Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!alerts || alerts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Alerts & Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500 py-8">
            <CheckCircle className="h-12 w-12 mx-auto mb-2 text-success-500" />
            <p>No active alerts</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'error':
        return <AlertCircle className="text-error-500 mt-0.5" />;
      case 'warning':
        return <Clock className="text-warning-500 mt-0.5" />;
      case 'info':
        return <Info className="text-primary-500 mt-0.5" />;
      case 'success':
        return <CheckCircle className="text-success-500 mt-0.5" />;
      default:
        return <Info className="text-gray-500 mt-0.5" />;
    }
  };

  const getAlertColors = (type: string) => {
    switch (type) {
      case 'error':
        return 'bg-error-50 border-error-200';
      case 'warning':
        return 'bg-warning-50 border-warning-200';
      case 'info':
        return 'bg-primary-50 border-primary-200';
      case 'success':
        return 'bg-success-50 border-success-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const getTitleColor = (type: string) => {
    switch (type) {
      case 'error':
        return 'text-error-800';
      case 'warning':
        return 'text-warning-800';
      case 'info':
        return 'text-primary-800';
      case 'success':
        return 'text-success-800';
      default:
        return 'text-gray-800';
    }
  };

  const getMessageColor = (type: string) => {
    switch (type) {
      case 'error':
        return 'text-error-700';
      case 'warning':
        return 'text-warning-700';
      case 'info':
        return 'text-primary-700';
      case 'success':
        return 'text-success-700';
      default:
        return 'text-gray-700';
    }
  };

  const getTimeColor = (type: string) => {
    switch (type) {
      case 'error':
        return 'text-error-600';
      case 'warning':
        return 'text-warning-600';
      case 'info':
        return 'text-primary-600';
      case 'success':
        return 'text-success-600';
      default:
        return 'text-gray-600';
    }
  };

  const formatTimeAgo = (date: Date | string) => {
    const now = new Date();
    const alertDate = new Date(date);
    const diffMs = now.getTime() - alertDate.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else {
      return 'Just now';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Alerts & Notifications</CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {alerts.map((alert) => (
          <div 
            key={alert.id} 
            className={`flex items-start space-x-3 p-3 border rounded-lg ${getAlertColors(alert.type)}`}
          >
            {getAlertIcon(alert.type)}
            <div className="flex-1">
              <div className={`text-sm font-medium ${getTitleColor(alert.type)}`}>
                {alert.title}
              </div>
              <div className={`text-sm mt-1 ${getMessageColor(alert.type)}`}>
                {alert.message}
              </div>
              <div className={`text-xs mt-2 ${getTimeColor(alert.type)}`}>
                {formatTimeAgo(alert.createdAt)}
              </div>
            </div>
            <div className="flex space-x-1">
              {!alert.isRead && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => markAsRead(alert.id)}
                  className="h-6 w-6 p-0"
                >
                  <CheckCircle className="h-3 w-3" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => deleteAlert(alert.id)}
                className="h-6 w-6 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
