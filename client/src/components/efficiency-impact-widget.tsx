import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingDown, TrendingUp, AlertTriangle, CheckCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface EfficiencyData {
  totalOperations: number;
  substitutedOperations: number;
  averageEfficiencyImpact: number;
  worstImpacts: Array<{
    jobNumber: string;
    operationName: string;
    originalMachine: string;
    assignedMachine: string;
    efficiencyImpact: number;
  }>;
}

export function EfficiencyImpactWidget() {
  const { data: efficiencyData, isLoading } = useQuery<EfficiencyData>({
    queryKey: ['/api/efficiency-impact'],
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5" />
            Efficiency Impact
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Loading efficiency data...</div>
        </CardContent>
      </Card>
    );
  }

  if (!efficiencyData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5" />
            Efficiency Impact
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">No efficiency data available</div>
        </CardContent>
      </Card>
    );
  }

  const substitutionRate = efficiencyData.totalOperations > 0 
    ? (efficiencyData.substitutedOperations / efficiencyData.totalOperations) * 100 
    : 0;

  const getImpactColor = (impact: number) => {
    if (impact > 20) return "bg-red-100 text-red-800";
    if (impact > 10) return "bg-orange-100 text-orange-800";
    if (impact > 0) return "bg-yellow-100 text-yellow-800";
    if (impact < -10) return "bg-green-100 text-green-800";
    return "bg-gray-100 text-gray-800";
  };

  const getImpactIcon = (impact: number) => {
    if (impact > 10) return <AlertTriangle className="h-4 w-4" />;
    if (impact > 0) return <TrendingUp className="h-4 w-4" />;
    if (impact < 0) return <TrendingDown className="h-4 w-4" />;
    return <CheckCircle className="h-4 w-4" />;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingDown className="h-5 w-5" />
          Efficiency Impact
        </CardTitle>
        <CardDescription>
          Impact from machine substitutions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold">{substitutionRate.toFixed(1)}%</div>
            <div className="text-sm text-muted-foreground">Substitution Rate</div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-bold ${efficiencyData.averageEfficiencyImpact > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {efficiencyData.averageEfficiencyImpact > 0 ? '+' : ''}{efficiencyData.averageEfficiencyImpact.toFixed(1)}%
            </div>
            <div className="text-sm text-muted-foreground">Avg Impact</div>
          </div>
        </div>

        {/* Worst Impacts */}
        {efficiencyData.worstImpacts.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Significant Impacts</h4>
            <div className="space-y-2">
              {efficiencyData.worstImpacts.slice(0, 3).map((impact, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {impact.jobNumber} - {impact.operationName}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {impact.originalMachine} → {impact.assignedMachine}
                    </div>
                  </div>
                  <Badge 
                    variant="outline" 
                    className={`flex items-center gap-1 ${getImpactColor(impact.efficiencyImpact)}`}
                  >
                    {getImpactIcon(impact.efficiencyImpact)}
                    +{impact.efficiencyImpact.toFixed(1)}%
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Status Summary */}
        <div className="text-xs text-muted-foreground">
          {efficiencyData.substitutedOperations} of {efficiencyData.totalOperations} scheduled operations use substitute machines
        </div>
      </CardContent>
    </Card>
  );
}