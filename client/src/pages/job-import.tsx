import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, CheckCircle, AlertCircle, FileText, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Link } from "wouter";

export default function JobImport() {
  const { toast } = useToast();
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    processed: number;
    created: number;  
    updated: number;
    message: string;
  } | null>(null);

  const handleCSVImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append('csv', file);

      const response = await fetch('/api/jobs/import', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        // Invalidate queries to refresh the UI
        queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
        queryClient.invalidateQueries({ queryKey: ['/api/material-orders'] });
        queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
        
        setImportResult({
          success: true,
          processed: result.processed,
          created: result.created,
          updated: result.updated,
          message: `Successfully processed ${result.processed} rows. Created ${result.created} jobs, updated ${result.updated} jobs.`
        });

        toast({
          title: "CSV Import Complete",
          description: `Successfully processed ${result.processed} rows. Created ${result.created} jobs, updated ${result.updated} jobs.`,
        });
      } else {
        setImportResult({
          success: false,
          processed: 0,
          created: 0,
          updated: 0,
          message: result.message || "Failed to import CSV file."
        });

        toast({
          title: "Import Failed",
          description: result.message || "Failed to import CSV file.",
          variant: "destructive",
        });
      }
    } catch (error) {
      setImportResult({
        success: false,
        processed: 0,
        created: 0,
        updated: 0,
        message: "An error occurred while importing the CSV file."
      });

      toast({
        title: "Import Error",
        description: "An error occurred while importing the CSV file.",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
      event.target.value = ''; // Reset file input
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <Link href="/">
              <Button variant="ghost" size="sm" className="flex items-center gap-2 mr-4">
                <ArrowLeft className="w-4 h-4" />
                Back to Dashboard
              </Button>
            </Link>
            <div className="flex items-center space-x-2">
              <Upload className="text-primary-500 text-xl" />
              <span className="text-xl font-bold text-gray-900 dark:text-white">Job Import</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Import Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Import Jobs from CSV
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Instructions */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2">File Format Requirements</h3>
                <div className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
                  <p>Upload a JobBoss scheduling report CSV file with the following requirements:</p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>JobBoss Scheduling Report format</li>
                    <li>Contains Job Number, Customer, Work Center, Hours, Materials columns</li>
                    <li>Multi-step routing supported (multiple rows per job)</li>
                    <li>System will automatically parse and group routing steps</li>
                  </ul>
                </div>
              </div>

              {/* File Upload */}
              <div className="space-y-4">
                <div className="grid w-full max-w-sm items-center gap-1.5">
                  <Label htmlFor="csvImport">CSV File</Label>
                  <Input
                    id="csvImport"
                    type="file"
                    accept=".csv,text/csv,application/csv,text/plain"
                    onChange={handleCSVImport}
                    disabled={isImporting}
                    data-testid="input-csv-import"
                  />
                </div>
                
                {isImporting && (
                  <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                    <span className="text-sm">Processing CSV file...</span>
                  </div>
                )}
              </div>

              {/* Results */}
              {importResult && (
                <div className={`border rounded-lg p-4 ${
                  importResult.success 
                    ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20' 
                    : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
                }`}>
                  <div className="flex items-start gap-3">
                    {importResult.success ? (
                      <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <h4 className={`font-medium ${
                        importResult.success 
                          ? 'text-green-900 dark:text-green-100' 
                          : 'text-red-900 dark:text-red-100'
                      }`}>
                        {importResult.success ? 'Import Successful' : 'Import Failed'}
                      </h4>
                      <p className={`text-sm mt-1 ${
                        importResult.success 
                          ? 'text-green-800 dark:text-green-200' 
                          : 'text-red-800 dark:text-red-200'
                      }`}>
                        {importResult.message}
                      </p>
                      {importResult.success && (
                        <div className="mt-2 text-sm text-green-700 dark:text-green-300">
                          <div className="grid grid-cols-3 gap-4">
                            <div>
                              <span className="font-medium">Processed:</span> {importResult.processed} rows
                            </div>
                            <div>
                              <span className="font-medium">Created:</span> {importResult.created} jobs
                            </div>
                            <div>
                              <span className="font-medium">Updated:</span> {importResult.updated} jobs
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              {importResult?.success && (
                <div className="flex gap-2 pt-4">
                  <Link href="/">
                    <Button>
                      View Dashboard
                    </Button>
                  </Link>
                  <Button 
                    variant="outline" 
                    onClick={() => setImportResult(null)}
                  >
                    Import Another File
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tips Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Import Tips</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Jobs with identical job numbers will be updated with new routing information</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Multi-step routing is automatically parsed and combined by job number</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Material orders are created automatically for jobs requiring materials</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Work center assignments are validated against available machines</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}