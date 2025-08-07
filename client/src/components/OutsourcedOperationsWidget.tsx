import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, Package } from "lucide-react";
import { format } from "date-fns";

interface OutsourcedOperationData {
  id: string;
  jobNumber: string;
  vendor: string;
  orderDate: string;
  dueDate: string;
  promisedDate: string;
  operationDescription: string;
  status: string;
  leadDays: number;
  daysUntilPromised: number;
  isHighRisk: boolean;
  riskLevel: 'critical' | 'high' | 'normal';
}

export function OutsourcedOperationsWidget() {
  const { data: operations = [], isLoading } = useQuery<OutsourcedOperationData[]>({
    queryKey: ['/api/outsourced-operations/dashboard'],
  });

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Outsourced Operations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const highRiskOperations = operations.filter(op => op.riskLevel === 'high' || op.riskLevel === 'critical');

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Outsourced Operations
          {highRiskOperations.length > 0 && (
            <Badge variant="destructive" className="ml-2">
              {highRiskOperations.length} High Risk
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Operations sent to external vendors with risk assessment
        </CardDescription>
      </CardHeader>
      <CardContent>
        {operations.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No outsourced operations found</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {operations.map((operation) => (
              <div
                key={operation.id}
                className={`p-4 rounded-lg border ${
                  operation.riskLevel === 'critical' 
                    ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950' 
                    : operation.riskLevel === 'high'
                    ? 'border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950'
                    : 'border-border'
                }`}
                data-testid={`outsourced-operation-${operation.id}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold" data-testid={`job-number-${operation.jobNumber}`}>
                      {operation.jobNumber}
                    </span>
                    {(operation.riskLevel === 'high' || operation.riskLevel === 'critical') && (
                      <AlertTriangle className="h-4 w-4 text-orange-500" />
                    )}
                  </div>
                  <Badge 
                    variant={
                      operation.riskLevel === 'critical' 
                        ? 'destructive' 
                        : operation.riskLevel === 'high' 
                        ? 'secondary' 
                        : 'outline'
                    }
                    data-testid={`risk-badge-${operation.id}`}
                  >
                    {operation.riskLevel === 'critical' ? 'Critical Risk' : 
                     operation.riskLevel === 'high' ? 'High Risk' : 'Normal'}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Vendor</div>
                    <div className="font-medium" data-testid={`vendor-${operation.id}`}>
                      {operation.vendor}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Operation</div>
                    <div className="font-medium truncate" title={operation.operationDescription}>
                      {operation.operationDescription}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 text-sm mt-3">
                  <div>
                    <div className="text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Send Date
                    </div>
                    <div className="font-medium" data-testid={`send-date-${operation.id}`}>
                      {format(new Date(operation.orderDate), 'MMM d')}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Lead Time</div>
                    <div className="font-medium" data-testid={`lead-time-${operation.id}`}>
                      {operation.leadDays} days
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Due Back</div>
                    <div className="font-medium" data-testid={`due-date-${operation.id}`}>
                      {format(new Date(operation.dueDate), 'MMM d')}
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-border/50">
                  <div className="flex items-center justify-between text-sm">
                    <div className="text-muted-foreground">Job Promise Date</div>
                    <div className="font-medium" data-testid={`promise-date-${operation.id}`}>
                      {format(new Date(operation.promisedDate), 'MMM d, yyyy')}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm mt-1">
                    <div className="text-muted-foreground">Days to Promise</div>
                    <div 
                      className={`font-medium ${
                        operation.daysUntilPromised < 0 ? 'text-red-600' : 
                        operation.daysUntilPromised < 7 ? 'text-orange-600' : 'text-green-600'
                      }`}
                      data-testid={`days-until-promised-${operation.id}`}
                    >
                      {operation.daysUntilPromised < 0 ? 
                        `${Math.abs(operation.daysUntilPromised)} days late` :
                        `${operation.daysUntilPromised} days`
                      }
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}