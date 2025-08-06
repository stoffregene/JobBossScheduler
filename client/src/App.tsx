import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import Dashboard from "./pages/dashboard";
import ResourceManagement from "./pages/resource-management-simple";
import MaterialTracking from "./pages/material-tracking";
import JobImport from "./pages/job-import";
import WorkCenterManagement from "./pages/work-center-management";
import SchedulingStatusPage from "./pages/scheduling-status";
import NotFound from "./pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/resources" component={ResourceManagement} />
      <Route path="/materials" component={MaterialTracking} />
      <Route path="/job-import" component={JobImport} />
      <Route path="/import" component={JobImport} />
      <Route path="/work-centers" component={WorkCenterManagement} />
      <Route path="/scheduling-status" component={SchedulingStatusPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
