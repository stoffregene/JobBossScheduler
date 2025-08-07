import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertTriangle, Clock, Package, Edit, Trash2, Save, X } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";

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
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDates, setEditDates] = useState<{ orderDate: string; dueDate: string }>({
    orderDate: '',
    dueDate: ''
  });

  const { data: operations = [], isLoading } = useQuery<OutsourcedOperationData[]>({
    queryKey: ['/api/outsourced-operations/dashboard'],
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, orderDate, dueDate }: { id: string; orderDate: string; dueDate: string }) => {
      const response = await fetch(`/api/outsourced-operations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderDate, dueDate })
      });
      if (!response.ok) throw new Error('Failed to update operation');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/outsourced-operations/dashboard'] });
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/outsourced-operations/${id}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to delete operation');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/outsourced-operations/dashboard'] });
    },
  });

  const handleEdit = (operation: OutsourcedOperationData) => {
    setEditingId(operation.id);
    setEditDates({
      orderDate: format(new Date(operation.orderDate), 'yyyy-MM-dd'),
      dueDate: format(new Date(operation.dueDate), 'yyyy-MM-dd')
    });
  };

  const handleSave = () => {
    if (editingId) {
      updateMutation.mutate({
        id: editingId,
        orderDate: editDates.orderDate,
        dueDate: editDates.dueDate
      });
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this outsourced operation?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditDates({ orderDate: '', dueDate: '' });
  };

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
                  <div className="flex items-center gap-2">
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
                    <div className="flex gap-1">
                      {editingId === operation.id ? (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={handleSave}
                            disabled={updateMutation.isPending}
                            data-testid={`save-operation-${operation.id}`}
                          >
                            <Save className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={handleCancel}
                            data-testid={`cancel-operation-${operation.id}`}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(operation)}
                            data-testid={`edit-operation-${operation.id}`}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(operation.id)}
                            disabled={deleteMutation.isPending}
                            data-testid={`delete-operation-${operation.id}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
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
                    {editingId === operation.id ? (
                      <Input
                        type="date"
                        value={editDates.orderDate}
                        onChange={(e) => setEditDates(prev => ({ ...prev, orderDate: e.target.value }))}
                        className="h-8 text-sm"
                        data-testid={`edit-send-date-${operation.id}`}
                      />
                    ) : (
                      <div className="font-medium" data-testid={`send-date-${operation.id}`}>
                        {format(new Date(operation.orderDate), 'MMM d')}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-muted-foreground">Lead Time</div>
                    <div className="font-medium" data-testid={`lead-time-${operation.id}`}>
                      {operation.leadDays} days
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Due Back</div>
                    {editingId === operation.id ? (
                      <Input
                        type="date"
                        value={editDates.dueDate}
                        onChange={(e) => setEditDates(prev => ({ ...prev, dueDate: e.target.value }))}
                        className="h-8 text-sm"
                        data-testid={`edit-due-date-${operation.id}`}
                      />
                    ) : (
                      <div className="font-medium" data-testid={`due-date-${operation.id}`}>
                        {format(new Date(operation.dueDate), 'MMM d')}
                      </div>
                    )}
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