import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Machine } from "@shared/schema";

export default function MachineStatus() {
  const { data: machines, isLoading, error } = useQuery<Machine[]>({
    queryKey: ['/api/machines'],
  });

  console.log('MachineStatus - machines data:', machines);
  console.log('MachineStatus - loading state:', isLoading);
  console.log('MachineStatus - error:', error);

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

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'Premium':
        return 'text-blue-600 bg-blue-100';
      case 'Standard':
        return 'text-green-600 bg-green-100';
      case 'Budget':
        return 'text-orange-600 bg-orange-100';
      default:
        return 'text-gray-600 bg-gray-100';
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
    
    const efficiency = parseFloat(machine.efficiencyFactor);
    const efficiencyText = efficiency > 1.0 ? `+${((efficiency - 1) * 100).toFixed(0)}% faster` :
                          efficiency < 1.0 ? `${((1 - efficiency) * 100).toFixed(0)}% slower` :
                          'baseline speed';
    
    return efficiencyText;
  };

  // Group machines by type for better organization
  const groupedMachines = machines?.reduce((groups, machine) => {
    const key = machine.type;
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(machine);
    return groups;
  }, {} as Record<string, Machine[]>) || {};

  return (
    <Card>
      <CardHeader>
        <CardTitle>Machine Status ({machines?.length || 0} machines)</CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {Object.entries(groupedMachines).map(([type, typeMachines]) => (
          <div key={type} className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-800 border-b border-gray-200 pb-1">
              {type} ({typeMachines.length})
            </h3>
            <div className="space-y-2">
              {typeMachines.map((machine) => (
                <div key={machine.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 ${getStatusColor(machine.status)} rounded-full`}></div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-medium text-gray-900">{machine.machineId}</div>
                        <span className={`px-2 py-1 text-xs rounded-full font-medium ${getTierColor(machine.tier)}`}>
                          {machine.tier}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">{machine.name}</div>
                      {machine.category && (
                        <div className="text-xs text-blue-600">{machine.category}</div>
                      )}
                      {machine.substitutionGroup && (
                        <div className="text-xs text-purple-600">Group: {machine.substitutionGroup}</div>
                      )}
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
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
