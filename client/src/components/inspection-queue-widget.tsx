import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { CheckSquare, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface InspectionQueueItem {
  jobId: string;
  jobNumber: string;
  partNumber: string;
  readyForInspectionTime: string;
  previousOp: string;
}

export function InspectionQueueWidget() {
  const { data: queue, isLoading, isError } = useQuery({
    queryKey: ['inspectionQueue'],
    queryFn: async (): Promise<InspectionQueueItem[]> => {
      const response = await fetch('/api/jobs/awaiting-inspection');
      if (!response.ok) throw new Error('Network response was not ok');
      return response.json();
    },
    refetchInterval: 60000, // Refetch every minute
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading Inspection Queue...</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Error Loading Inspection Queue</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <CheckSquare className="h-5 w-5 mr-2" />
          Jobs Awaiting Inspection
        </CardTitle>
        <CardDescription>
          These jobs have completed their prior operation and are ready for quality control.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {queue && queue.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job Number</TableHead>
                <TableHead>Part Number</TableHead>
                <TableHead>Waiting Since</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {queue.map((item) => (
                <TableRow key={item.jobId}>
                  <TableCell className="font-medium">{item.jobNumber}</TableCell>
                  <TableCell>{item.partNumber}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="flex items-center w-fit">
                      <Clock className="h-3 w-3 mr-1.5" />
                      {formatDistanceToNow(new Date(item.readyForInspectionTime), { addSuffix: true })}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center text-gray-500 py-8">
            <p>No jobs are currently awaiting inspection.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}