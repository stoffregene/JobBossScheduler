import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertMaterialOrderSchema } from "@shared/schema";
import { z } from "zod";
import { formatDistanceToNow, format } from "date-fns";
import { Package, AlertTriangle, CheckCircle, Clock, Plus, ArrowLeft, Users, Building2 } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

type MaterialOrder = {
  id: string;
  jobId: string;
  orderNumber: string;
  materialDescription: string;
  quantity: string;
  unit: string;
  supplier: string | null;
  orderDate: string;
  dueDate: string;
  receivedDate: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type JobWithMaterials = {
  id: string;
  jobNumber: string;
  description: string;
  priority: string;
  status: string;
  materialOrders: MaterialOrder[];
};

const formSchema = insertMaterialOrderSchema.extend({
  orderDate: z.string(),
  dueDate: z.string(),
});

export default function MaterialTrackingPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: materialOrders = [], isLoading: materialsLoading } = useQuery<MaterialOrder[]>({
    queryKey: ["/api/materials"],
  });

  const { data: jobsAwaitingMaterial = [], isLoading: jobsLoading } = useQuery<JobWithMaterials[]>({
    queryKey: ["/api/jobs/awaiting-material"],
  });

  const { data: jobs = [] } = useQuery<any[]>({
    queryKey: ["/api/jobs"],
  });

  const createMaterialMutation = useMutation({
    mutationFn: (data: z.infer<typeof formSchema>) => 
      apiRequest(`/api/materials`, "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/materials"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/awaiting-material"] });
      setIsDialogOpen(false);
      toast({ title: "Material order created", description: "The material order has been added successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create material order.", variant: "destructive" });
    },
  });

  const markReceivedMutation = useMutation({
    mutationFn: (orderId: string) => 
      apiRequest(`/api/materials/${orderId}/receive`, "POST"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/materials"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/awaiting-material"] });
      toast({ title: "Material received", description: "The material has been marked as received." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to mark material as received.", variant: "destructive" });
    },
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      jobId: "",
      orderNumber: "",
      materialDescription: "",
      quantity: "1",
      unit: "EA",
      supplier: "",
      orderDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days from now
      status: "Open",
      notes: "",
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    createMaterialMutation.mutate(values);
  };

  const getStatusBadge = (status: string, dueDate: string, receivedDate?: string | null) => {
    const isOverdue = new Date(dueDate) < new Date() && !receivedDate;
    
    if (status === "Closed") {
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"><CheckCircle className="w-3 h-3 mr-1" />Received</Badge>;
    }
    if (isOverdue) {
      return <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1" />Overdue</Badge>;
    }
    return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
  };

  const getDaysUntilDue = (dueDate: string) => {
    const days = Math.ceil((new Date(dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    if (days < 0) return `${Math.abs(days)} days overdue`;
    if (days === 0) return "Due today";
    if (days === 1) return "Due tomorrow";
    return `Due in ${days} days`;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Navigation Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="outline" size="sm" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Button>
          </Link>
          <Link href="/resources">
            <Button variant="outline" size="sm" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Resource Management
            </Button>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <Building2 className="text-primary-500 text-xl" />
          <span className="text-xl font-bold text-gray-900 dark:text-white">JobBoss Scheduler</span>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Material Tracking</h1>
          <p className="text-muted-foreground">Monitor material orders and job readiness</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Add Material Order</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Material Order</DialogTitle>
              <DialogDescription>Add a new material order to track for job completion.</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="jobId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Job</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a job" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {jobs.map((job: any) => (
                              <SelectItem key={job.id} value={job.id}>
                                {job.jobNumber} - {job.description}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="orderNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Order Number</FormLabel>
                        <FormControl>
                          <Input placeholder="PO-12345" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="materialDescription"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Material Description</FormLabel>
                      <FormControl>
                        <Input placeholder="6061-T6 Aluminum Round Bar" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quantity</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.001" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="unit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unit</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select unit" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="EA">Each</SelectItem>
                            <SelectItem value="LB">Pounds</SelectItem>
                            <SelectItem value="FT">Feet</SelectItem>
                            <SelectItem value="IN">Inches</SelectItem>
                            <SelectItem value="SQ FT">Square Feet</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="supplier"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Supplier</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Supplier name" 
                            value={field.value || ""} 
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            name={field.name}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="orderDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Order Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="dueDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Due Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Any additional notes about this material order..."
                          className="resize-none"
                          rows={3}
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMaterialMutation.isPending}>
                    {createMaterialMutation.isPending ? "Creating..." : "Create Material Order"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Jobs Awaiting Material
            </CardTitle>
            <CardDescription>
              Jobs that cannot be scheduled due to pending material orders
            </CardDescription>
          </CardHeader>
          <CardContent>
            {jobsLoading ? (
              <div className="text-center py-8">Loading jobs...</div>
            ) : jobsAwaitingMaterial.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No jobs are currently awaiting material
              </div>
            ) : (
              <div className="space-y-4">
                {jobsAwaitingMaterial.map((job: JobWithMaterials) => (
                  <Card key={job.id} className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-semibold">{job.jobNumber}</h4>
                        <p className="text-sm text-muted-foreground">{job.description}</p>
                        <Badge variant="outline" className="mt-1">{job.priority} Priority</Badge>
                      </div>
                      <Badge variant="secondary">
                        {job.materialOrders.length} pending order(s)
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      {job.materialOrders.map((order) => (
                        <div key={order.id} className="flex justify-between items-center p-2 bg-muted rounded">
                          <div className="flex-1">
                            <p className="text-sm font-medium">{order.materialDescription}</p>
                            <p className="text-xs text-muted-foreground">
                              {order.quantity} {order.unit} • {order.orderNumber}
                            </p>
                          </div>
                          <div className="text-right">
                            {getStatusBadge(order.status, order.dueDate, order.receivedDate)}
                            <p className="text-xs text-muted-foreground mt-1">
                              {getDaysUntilDue(order.dueDate)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Material Orders</CardTitle>
            <CardDescription>
              All material orders in the system
            </CardDescription>
          </CardHeader>
          <CardContent>
            {materialsLoading ? (
              <div className="text-center py-8">Loading materials...</div>
            ) : materialOrders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No material orders found
              </div>
            ) : (
              <div className="space-y-3">
                {materialOrders.slice(0, 10).map((order: MaterialOrder) => (
                  <div key={order.id} className="flex justify-between items-start p-3 border rounded">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{order.materialDescription}</p>
                      <p className="text-xs text-muted-foreground">
                        {order.orderNumber} • {order.quantity} {order.unit}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Due: {format(new Date(order.dueDate), "MMM d, yyyy")}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {getStatusBadge(order.status, order.dueDate, order.receivedDate)}
                      {order.status === "Open" && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => markReceivedMutation.mutate(order.id)}
                          disabled={markReceivedMutation.isPending}
                        >
                          Mark Received
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}