import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Machine } from "@shared/schema";

export default function MachineStatus() {
  const { data: machines, isLoading } = useQuery<Machine[]>({
    queryKey: ['/api/machines'],
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Machine Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!machines || machines.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Machine Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500 py-8">
            No machines configured
          </div>
        </CardContent>
      </Card>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Available':
        return 'bg-success-500';
      case 'Busy':
        return 'bg-warning-500';
      case 'Maintenance':
        return 'bg-error-500';
      case 'Offline':
        return 'bg-gray-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusText = (machine: Machine) => {
    if (machine.status === 'Offline' || machine.status === 'Maintenance') {
      return machine.status.toLowerCase();
    }
    return `${parseFloat(machine.utilization).toFixed(0)}%`;
  };

  const getStatusSubtext = (machine: Machine) => {
    if (machine.status === 'Offline' || machine.status === 'Maintenance') {
      return machine.status.toLowerCase();
    }
    
    if (machine.availableShifts.length === 1) {
      return '1st shift only';
    }
    
    return 'utilization';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Machine Status</CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {machines.map((machine) => (
          <div key={machine.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 ${getStatusColor(machine.status)} rounded-full`}></div>
              <div>
                <div className="text-sm font-medium text-gray-900">{machine.machineId}</div>
                <div className="text-xs text-gray-500">{machine.name}</div>
              </div>
            </div>
            <div className="text-right">
              <div className={`text-sm ${machine.status === 'Offline' || machine.status === 'Maintenance' ? 'text-error-600' : 'text-gray-900'}`}>
                {getStatusText(machine)}
              </div>
              <div className="text-xs text-gray-500">{getStatusSubtext(machine)}</div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
