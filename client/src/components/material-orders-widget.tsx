import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package, Clock, AlertTriangle, Plus, Trash2 } from "lucide-react";
import { Link } from "wouter";
import CollapsibleCard from "@/components/collapsible-card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { MaterialOrder } from "@shared/schema";

export default function MaterialOrdersWidget() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: materialOrders, isLoading } = useQuery<MaterialOrder[]>({
    queryKey: ['/api/material-orders'],
  });

  const deleteAllMutation = useMutation({
    mutationFn: () => apiRequest('/api/material-orders/all', 'DELETE'),
    onSuccess: (data: { deletedCount: number }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/material-orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs/awaiting-material'] });
      toast({
        title: "Material orders deleted",
        description: `Successfully deleted ${data.deletedCount} material orders.`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete material orders.",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <CollapsibleCard
        title="Material Orders"
        icon={<Package className="h-4 w-4 text-muted-foreground" />}
      >
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded"></div>
        </div>
      </CollapsibleCard>
    );
  }

  const openOrders = materialOrders?.filter(order => order.status !== 'Received') || [];
  const lateOrders = openOrders.filter(order => {
    const dueDate = new Date(order.dueDate);
    return dueDate < new Date();
  });

  const formatDate = (date: Date | string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const getDaysOverdue = (dueDate: Date | string) => {
    const dateObj = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
    const today = new Date();
    const diffTime = today.getTime() - dateObj.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <CollapsibleCard
      title="Material Orders"
      icon={<Package className="h-4 w-4 text-muted-foreground" />}
      headerActions={
        <div className="flex items-center space-x-1">
          {openOrders.length > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => deleteAllMutation.mutate()}
              disabled={deleteAllMutation.isPending}
              data-testid="delete-all-material-orders"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
          <Link href="/materials">
            <Button variant="ghost" size="sm">
              <Plus className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      }
    >
        <div className="space-y-3">
          {/* Summary Stats */}
          <div className="flex justify-between items-center">
            <div className="text-2xl font-bold">{openOrders.length}</div>
            <div className="text-xs text-muted-foreground">Open Orders</div>
          </div>

          {lateOrders.length > 0 && (
            <div className="flex items-center space-x-2 p-2 bg-red-50 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className="text-sm text-red-700">
                {lateOrders.length} order{lateOrders.length > 1 ? 's' : ''} overdue
              </span>
            </div>
          )}

          {/* Recent Orders */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Recent Orders</div>
            {openOrders.slice(0, 3).map((order) => {
              const isLate = new Date(order.dueDate) < new Date();
              const daysOverdue = isLate ? getDaysOverdue(order.dueDate) : 0;

              return (
                <div key={order.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {order.materialDescription}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Job {order.jobId} • {order.supplier || 'No supplier'}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 ml-2">
                    {isLate ? (
                      <Badge variant="destructive" className="text-xs">
                        {daysOverdue}d late
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        Due {formatDate(order.dueDate)}
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}

            {openOrders.length === 0 && (
              <div className="text-center py-4 text-sm text-muted-foreground">
                No open material orders
              </div>
            )}

            {openOrders.length > 3 && (
              <Link href="/materials">
                <Button variant="ghost" size="sm" className="w-full mt-2">
                  View all {openOrders.length} orders
                </Button>
              </Link>
            )}
          </div>
        </div>
    </CollapsibleCard>
  );
}