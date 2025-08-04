import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, Edit, Trash2, Settings, ArrowLeft, Home, Users, Package, Upload, ChevronDown, ChevronRight, Eye, EyeOff } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import type { Machine } from "@shared/schema";

// Work center configuration schema
const workCenterSchema = z.object({
  machineId: z.string().min(1, "Machine ID is required"),
  name: z.string().min(1, "Name is required"),
  type: z.string().min(1, "Type is required"),
  category: z.string().optional(),
  subcategory: z.string().optional(),
  tier: z.string().min(1, "Tier is required"),
  capabilities: z.array(z.string()).default([]),
  status: z.string().default("Available"),
  utilization: z.string().default("0"),
  availableShifts: z.array(z.number()).min(1, "At least one shift must be selected"),
  efficiencyFactor: z.string().default("1.0"),
  substitutionGroup: z.string().optional(),
  spindles: z.string().optional(),
  liveTooling: z.boolean().default(false),
  barFeeder: z.boolean().default(false),
  barLength: z.number().optional(),
  fourthAxis: z.boolean().default(false),
});

type WorkCenterFormData = z.infer<typeof workCenterSchema>;

// Predefined work center hierarchies
const WORK_CENTER_HIERARCHY = {
  MILL: {
    label: "Milling Centers",
    categories: {
      "Horizontal Milling Centers": {
        subcategories: ["Heavy Duty HMC", "Production HMC", "Flexible HMC"]
      },
      "3-Axis Vertical Milling Centers": {
        subcategories: ["Standard VMC", "High-Speed VMC", "Large Envelope VMC"]
      },
      "3-Axis VMCs with pseudo 4th axis": {
        subcategories: ["Rotary Table VMC", "Trunion VMC"]
      },
      "Large envelope VMCs": {
        subcategories: ["Gantry Mills", "Bridge Mills", "Portal Mills"]
      }
    },
    capabilities: ["vertical_milling", "horizontal_milling", "drilling", "tapping", "boring", "face_milling", "contouring"]
  },
  LATHE: {
    label: "Turning Centers",
    categories: {
      "Live Tooling Lathes": {
        subcategories: ["Twin Spindle", "Multi-Axis", "Y-Axis Capable"]
      },
      "Bar Fed Lathes": {
        subcategories: ["Swiss Type", "Gang Tool", "Turret Type"]
      },
      "Chuck Lathes": {
        subcategories: ["Standard Chuck", "Large Diameter", "Heavy Duty"]
      }
    },
    capabilities: ["turning", "facing", "grooving", "threading", "drilling", "milling", "boring"]
  },
  WATERJET: {
    label: "Waterjet Cutting",
    categories: {
      "Abrasive Waterjet": {
        subcategories: ["High Pressure", "Ultra High Pressure", "Multi-Head"]
      },
      "Pure Waterjet": {
        subcategories: ["Food Grade", "Textile", "Gasket Cutting"]
      }
    },
    capabilities: ["waterjet_cutting", "precision_cutting", "thick_material", "complex_shapes"]
  },
  SAW: {
    label: "Cutting & Sawing",
    categories: {
      "Band Saws": {
        subcategories: ["Horizontal Band", "Vertical Band", "Automatic Feed"]
      },
      "Circular Saws": {
        subcategories: ["Cold Cut", "Abrasive", "Carbide"]
      }
    },
    capabilities: ["cutting", "sawing", "material_prep", "stock_cutting"]
  },
  WELD: {
    label: "Welding & Fabrication",
    categories: {
      "TIG Welding": {
        subcategories: ["Manual TIG", "Automated TIG", "Orbital TIG"]
      },
      "MIG Welding": {
        subcategories: ["Manual MIG", "Robotic MIG", "Heavy Fabrication"]
      },
      "Specialty Welding": {
        subcategories: ["Plasma", "Laser", "Electron Beam"]
      },
      "Tapping": {
        subcategories: ["Manual Tapping", "CNC Tapping", "Power Tapping"]
      },
      "Broaching": {
        subcategories: ["Vertical Broaching", "Horizontal Broaching", "Surface Broaching"]
      },
      "Bending": {
        subcategories: ["Press Brake", "Roll Forming", "Tube Bending"]
      }
    },
    capabilities: ["welding", "fabrication", "joining", "repair", "tapping", "broaching", "bending"]
  },
  INSPECT: {
    label: "Quality & Inspection",
    categories: {
      "CMM Inspection": {
        subcategories: ["Contact CMM", "Non-Contact CMM", "Portable CMM"]
      },
      "Manual Inspection": {
        subcategories: ["Dimensional", "Surface", "Functional"]
      }
    },
    capabilities: ["inspection", "measurement", "quality_control", "certification"]
  },
  ASSEMBLE: {
    label: "Assembly & Packaging",
    categories: {
      "Manual Assembly": {
        subcategories: ["Bench Assembly", "Floor Assembly", "Clean Room"]
      },
      "Automated Assembly": {
        subcategories: ["Robotic", "Conveyor", "Pick and Place"]
      }
    },
    capabilities: ["assembly", "packaging", "testing", "final_inspection"]
  },
  "BEAD BLAST": {
    label: "Surface Finishing",
    categories: {
      "Blast Finishing": {
        subcategories: ["Bead Blast", "Sand Blast", "Glass Bead"]
      },
      "Chemical Finishing": {
        subcategories: ["Anodizing", "Passivation", "Chemical Polish"]
      },
      "Deburr": {
        subcategories: ["Manual Deburr", "Vibratory Deburr", "Tumble Deburr"]
      },
      "Tumble": {
        subcategories: ["Vibratory Tumble", "Rotary Tumble", "Centrifugal Tumble"]
      }
    },
    capabilities: ["finishing", "surface_prep", "deburring", "cleaning", "tumbling", "polishing"]
  },
  OUTSOURCE: {
    label: "Outsourced Operations",
    categories: {
      "Third Party": {
        subcategories: ["External Vendor", "Specialized Service", "Emergency Backup"]
      }
    },
    capabilities: ["plating", "coating", "heat_treat", "finishing", "specialty_machining"]
  }
};

const TIER_OPTIONS = [
  { value: "Premium", label: "Premium (Highest Quality/Speed)", color: "bg-green-100 text-green-800" },
  { value: "Standard", label: "Standard (Balanced Performance)", color: "bg-blue-100 text-blue-800" },
  { value: "Budget", label: "Budget (Cost Effective)", color: "bg-yellow-100 text-yellow-800" },
  { value: "External", label: "External (Outsourced)", color: "bg-purple-100 text-purple-800" },
  { value: "Tier 1", label: "Tier 1 (Legacy)", color: "bg-gray-100 text-gray-800" }
];

const STATUS_OPTIONS = [
  { value: "Available", label: "Available", color: "bg-green-100 text-green-800" },
  { value: "Busy", label: "Busy", color: "bg-yellow-100 text-yellow-800" },
  { value: "Maintenance", label: "Maintenance", color: "bg-red-100 text-red-800" },
  { value: "Offline", label: "Offline", color: "bg-gray-100 text-gray-800" }
];

export default function WorkCenterManagement() {
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [isFormCollapsed, setIsFormCollapsed] = useState(false);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const { toast } = useToast();

  const { data: machines = [], isLoading } = useQuery<Machine[]>({
    queryKey: ["/api/machines"],
    queryFn: async () => {
      const response = await fetch("/api/machines");
      if (!response.ok) throw new Error("Failed to fetch machines");
      return response.json();
    },
  });

  // Get unique substitution groups from existing machines
  const existingSubstitutionGroups = Array.from(new Set(
    machines
      .map(m => m.substitutionGroup)
      .filter(Boolean)
      .sort()
  )) as string[];

  const form = useForm<WorkCenterFormData>({
    resolver: zodResolver(workCenterSchema),
    defaultValues: {
      machineId: "",
      name: "",
      type: "",
      category: "",
      subcategory: "",
      tier: "Standard",
      capabilities: [],
      status: "Available",
      utilization: "0",
      availableShifts: [1],
      efficiencyFactor: "1.0",
      substitutionGroup: "",
      spindles: "",
      liveTooling: false,
      barFeeder: false,
      fourthAxis: false,
    },
  });

  const createMachine = useMutation({
    mutationFn: async (data: WorkCenterFormData) => {
      const response = await fetch("/api/machines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create machine");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/machines"] });
      toast({ title: "Work center created successfully" });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({ title: "Failed to create work center", description: error.message, variant: "destructive" });
    },
  });

  const updateMachine = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<WorkCenterFormData> }) => {
      const response = await fetch(`/api/machines/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update machine");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/machines"] });
      toast({ title: "Work center updated successfully" });
      setIsDialogOpen(false);
      setIsEditing(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({ title: "Failed to update work center", description: error.message, variant: "destructive" });
    },
  });

  const deleteMachine = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/machines/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete machine");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/machines"] });
      toast({ title: "Work center deleted successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete work center", description: error.message, variant: "destructive" });
    },
  });

  const handleEdit = (machine: Machine) => {
    setSelectedMachine(machine);
    setIsEditing(true);
    setIsDialogOpen(true);
    
    form.reset({
      machineId: machine.machineId,
      name: machine.name,
      type: machine.type,
      category: machine.category || "",
      subcategory: machine.subcategory || "",
      tier: machine.tier,
      capabilities: machine.capabilities || [],
      status: machine.status,
      utilization: machine.utilization,
      availableShifts: machine.availableShifts || [1],
      efficiencyFactor: machine.efficiencyFactor,
      substitutionGroup: machine.substitutionGroup || "",
      spindles: machine.spindles || "",
      liveTooling: machine.liveTooling || false,
      barFeeder: machine.barFeeder || false,
      barLength: machine.barLength || undefined,
      fourthAxis: machine.fourthAxis || false,
    });
  };

  const handleCreate = () => {
    setSelectedMachine(null);
    setIsEditing(false);
    setIsDialogOpen(true);
    form.reset();
  };

  const onSubmit = (data: WorkCenterFormData) => {
    if (isEditing && selectedMachine) {
      updateMachine.mutate({ id: selectedMachine.id, data });
    } else {
      createMachine.mutate(data);
    }
  };

  const selectedType = form.watch("type");
  const selectedCategory = form.watch("category");
  const capabilities = form.watch("capabilities");

  const getStatusBadge = (status: string) => {
    const statusOption = STATUS_OPTIONS.find(s => s.value === status);
    return statusOption ? (
      <Badge className={statusOption.color}>{statusOption.label}</Badge>
    ) : (
      <Badge variant="outline">{status}</Badge>
    );
  };

  const getTierBadge = (tier: string) => {
    const tierOption = TIER_OPTIONS.find(t => t.value === tier);
    return tierOption ? (
      <Badge className={tierOption.color}>{tierOption.label}</Badge>
    ) : (
      <Badge variant="outline">{tier}</Badge>
    );
  };

  if (isLoading) {
    return <div className="p-6">Loading work centers...</div>;
  }

  const groupedMachines = machines.reduce((acc: Record<string, Machine[]>, machine: Machine) => {
    const key = machine.type;
    if (!acc[key]) acc[key] = [];
    acc[key].push(machine);
    return acc;
  }, {});

  // Sort machines within each group alphabetically by machineId
  Object.keys(groupedMachines).forEach(type => {
    groupedMachines[type].sort((a, b) => a.machineId.localeCompare(b.machineId));
  });

  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupName]: !prev[groupName]
    }));
  };

  const toggleAllGroups = () => {
    const allExpanded = Object.keys(groupedMachines).every(key => expandedGroups[key]);
    const newState = Object.keys(groupedMachines).reduce((acc, key) => ({
      ...acc,
      [key]: !allExpanded
    }), {});
    setExpandedGroups(newState);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header with Navigation */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Link href="/">
                <button className="flex items-center space-x-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
                  <ArrowLeft className="h-5 w-5" />
                  <span>Back to Dashboard</span>
                </button>
              </Link>
              <div className="h-6 border-l border-gray-300 dark:border-gray-600"></div>
              <div className="flex items-center space-x-2">
                <Settings className="text-primary-500 text-xl" />
                <span className="text-xl font-bold text-gray-900 dark:text-white">Work Center Management</span>
              </div>
            </div>
            
            <nav className="flex items-center space-x-4">
              <Link href="/">
                <button className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md">
                  <Home className="w-4 h-4" />
                  Dashboard
                </button>
              </Link>
              <Link href="/resources">
                <button className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md">
                  <Users className="w-4 h-4" />
                  Resources
                </button>
              </Link>
              <Link href="/materials">
                <button className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md">
                  <Package className="w-4 h-4" />
                  Materials
                </button>
              </Link>
              <Link href="/job-import">
                <button className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md">
                  <Upload className="w-4 h-4" />
                  Import Jobs
                </button>
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* Compact Header */}
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Work Centers</h1>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {machines.length} total work centers
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={toggleAllGroups}
                className="flex items-center gap-2"
              >
                {Object.keys(groupedMachines).every(key => expandedGroups[key]) ? (
                  <>
                    <EyeOff className="h-4 w-4" />
                    Collapse All
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4" />
                    Expand All
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3">
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  onClick={handleCreate}
                  size="sm"
                  className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700"
                  data-testid="button-add-work-center"
                >
                  <Plus className="h-4 w-4" />
                  Add Work Center
                </Button>
              </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby="work-center-form-description">
            <DialogHeader>
              <DialogTitle>
                {isEditing ? "Edit Work Center" : "Add New Work Center"}
              </DialogTitle>
              <div id="work-center-form-description" className="sr-only">
                Configure work center details including type, category, capabilities, and machine-specific settings
              </div>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="machineId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Machine ID*</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="VMC-001" data-testid="input-machine-id" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Machine Name*</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="HAAS VF-4SS" data-testid="input-machine-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Work Center Type*</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-type">
                            <SelectValue placeholder="Select work center type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(WORK_CENTER_HIERARCHY).map(([type, config]) => (
                            <SelectItem key={type} value={type}>
                              {config.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {selectedType && (
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-category">
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.keys(WORK_CENTER_HIERARCHY[selectedType as keyof typeof WORK_CENTER_HIERARCHY]?.categories || {}).map((category) => (
                              <SelectItem key={category} value={category}>
                                {category}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {selectedType && selectedCategory && (
                  <FormField
                    control={form.control}
                    name="subcategory"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Subcategory</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-subcategory">
                              <SelectValue placeholder="Select subcategory" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {(WORK_CENTER_HIERARCHY[selectedType as keyof typeof WORK_CENTER_HIERARCHY]?.categories as any)?.[selectedCategory]?.subcategories?.map((subcategory: string) => (
                              <SelectItem key={subcategory} value={subcategory}>
                                {subcategory}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="tier"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Performance Tier*</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-tier">
                              <SelectValue placeholder="Select tier" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {TIER_OPTIONS.map((tier) => (
                              <SelectItem key={tier.value} value={tier.value}>
                                {tier.label}
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
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-status">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {STATUS_OPTIONS.map((status) => (
                              <SelectItem key={status.value} value={status.value}>
                                {status.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="efficiencyFactor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Efficiency Factor</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="1.0" type="number" step="0.1" data-testid="input-efficiency" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="substitutionGroup"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Substitution Group</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-substitution-group">
                              <SelectValue placeholder="Select or create substitution group" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {existingSubstitutionGroups.map((group) => (
                              <SelectItem key={group} value={group}>
                                {group}
                              </SelectItem>
                            ))}
                            <SelectItem value="new_group">+ Create New Group</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                        {field.value === "new_group" && (
                          <FormControl>
                            <Input 
                              placeholder="Enter new group name (e.g., my_machine_group)" 
                              onChange={(e) => field.onChange(e.target.value)}
                              data-testid="input-new-substitution-group"
                            />
                          </FormControl>
                        )}
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="availableShifts"
                  render={() => (
                    <FormItem>
                      <FormLabel>Available Shifts*</FormLabel>
                      <div className="flex space-x-4">
                        {[1, 2, 3].map((shift) => (
                          <FormField
                            key={shift}
                            control={form.control}
                            name="availableShifts"
                            render={({ field }) => {
                              return (
                                <FormItem
                                  key={shift}
                                  className="flex flex-row items-start space-x-3 space-y-0"
                                >
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value?.includes(shift)}
                                      onCheckedChange={(checked) => {
                                        return checked
                                          ? field.onChange([...field.value, shift])
                                          : field.onChange(
                                              field.value?.filter(
                                                (value) => value !== shift
                                              )
                                            )
                                      }}
                                      data-testid={`checkbox-shift-${shift}`}
                                    />
                                  </FormControl>
                                  <FormLabel className="font-normal">
                                    Shift {shift}
                                  </FormLabel>
                                </FormItem>
                              )
                            }}
                          />
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {selectedType && (
                  <FormField
                    control={form.control}
                    name="capabilities"
                    render={() => (
                      <FormItem>
                        <FormLabel>Capabilities</FormLabel>
                        <div className="grid grid-cols-3 gap-2">
                          {WORK_CENTER_HIERARCHY[selectedType as keyof typeof WORK_CENTER_HIERARCHY]?.capabilities.map((capability: string) => (
                            <FormField
                              key={capability}
                              control={form.control}
                              name="capabilities"
                              render={({ field }) => {
                                return (
                                  <FormItem
                                    key={capability}
                                    className="flex flex-row items-start space-x-3 space-y-0"
                                  >
                                    <FormControl>
                                      <Checkbox
                                        checked={field.value?.includes(capability)}
                                        onCheckedChange={(checked) => {
                                          return checked
                                            ? field.onChange([...field.value, capability])
                                            : field.onChange(
                                                field.value?.filter(
                                                  (value) => value !== capability
                                                )
                                              )
                                        }}
                                        data-testid={`checkbox-capability-${capability}`}
                                      />
                                    </FormControl>
                                    <FormLabel className="text-sm font-normal">
                                      {capability.replace(/_/g, ' ')}
                                    </FormLabel>
                                  </FormItem>
                                )
                              }}
                            />
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Machine-specific fields for lathes */}
                {selectedType === "LATHE" && (
                  <div className="space-y-4 border-t pt-4">
                    <h4 className="font-medium">Lathe-Specific Settings</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="spindles"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Spindle Configuration</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-spindles">
                                  <SelectValue placeholder="Select spindle type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="Single">Single Spindle</SelectItem>
                                <SelectItem value="Dual">Dual Spindle</SelectItem>
                                <SelectItem value="Multi">Multi Spindle</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="barLength"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Bar Length (feet)</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="12" type="number" onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)} data-testid="input-bar-length" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="flex space-x-6">
                      <FormField
                        control={form.control}
                        name="liveTooling"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="checkbox-live-tooling"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>Live Tooling</FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="barFeeder"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="checkbox-bar-feeder"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>Bar Feeder</FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                )}

                {/* Mill-specific fields */}
                {selectedType === "MILL" && (
                  <div className="space-y-4 border-t pt-4">
                    <h4 className="font-medium">Mill-Specific Settings</h4>
                    <FormField
                      control={form.control}
                      name="fourthAxis"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="checkbox-fourth-axis"
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>4th Axis Capability</FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                <div className="flex justify-end space-x-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} data-testid="button-cancel">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMachine.isPending || updateMachine.isPending} data-testid="button-save">
                    {isEditing ? "Update" : "Create"} Work Center
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
          </div>
          
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <span>{Object.keys(groupedMachines).length} work center types</span>
          </div>
        </div>

        {/* Collapsible Work Center Groups */}
        <div className="space-y-3">
          {Object.entries(groupedMachines).map(([type, machinesInType]) => (
            <Collapsible
              key={type}
              open={expandedGroups[type]}
              onOpenChange={() => toggleGroup(type)}
            >
              <Card className="overflow-hidden">
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {expandedGroups[type] ? (
                          <ChevronDown className="h-4 w-4 text-gray-500" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-gray-500" />
                        )}
                        <CardTitle className="text-lg">
                          {WORK_CENTER_HIERARCHY[type as keyof typeof WORK_CENTER_HIERARCHY]?.label || type}
                        </CardTitle>
                        <Badge variant="outline" className="text-xs">
                          {machinesInType.length}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-sm text-gray-500">
                          {machinesInType.filter(m => m.status === 'Available').length} available
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <div className="grid gap-3 sm:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
                      {machinesInType.map((machine) => (
                        <div
                          key={machine.id}
                          className="flex items-start justify-between p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        >
                          <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium text-sm truncate" data-testid={`text-machine-${machine.machineId}`}>{machine.machineId}</h4>
                              {getStatusBadge(machine.status)}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">{machine.name}</p>
                            
                            {machine.category && (
                              <div className="text-xs text-muted-foreground">
                                <span>{machine.category}</span>
                                {machine.subcategory && <span> → {machine.subcategory}</span>}
                              </div>
                            )}
                            
                            <div className="flex flex-wrap gap-1">
                              {machine.capabilities?.slice(0, 3).map((capability) => (
                                <Badge key={capability} variant="secondary" className="text-xs px-1 py-0">
                                  {capability.replace(/_/g, ' ')}
                                </Badge>
                              ))}
                              {machine.capabilities && machine.capabilities.length > 3 && (
                                <Badge variant="outline" className="text-xs px-1 py-0">
                                  +{machine.capabilities.length - 3}
                                </Badge>
                              )}
                            </div>
                            
                            <div className="text-xs text-muted-foreground">
                              {getTierBadge(machine.tier)} • 
                              Util: {machine.utilization}% • 
                              Shifts: {machine.availableShifts?.join(",")}
                            </div>
                          </div>
                          
                          <div className="flex flex-col gap-1 ml-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => handleEdit(machine)}
                              data-testid={`button-edit-${machine.machineId}`}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => {
                                if (confirm(`Are you sure you want to delete ${machine.machineId}?`)) {
                                  deleteMachine.mutate(machine.id);
                                }
                              }}
                              data-testid={`button-delete-${machine.machineId}`}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))}
        </div>
      </div>
    </div>
  );
}