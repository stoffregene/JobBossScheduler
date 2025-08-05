// Test endpoint to verify compatibility matrix application

async function testCompatibilityEndpoint() {
  try {
    // Get job 58303 details
    const jobRes = await fetch('http://localhost:5000/api/jobs');
    const jobs = await jobRes.json();
    const job = jobs.find(j => j.jobNumber === '58303');
    
    if (!job) {
      console.log("Job 58303 not found");
      return;
    }
    
    console.log("Job 58303 routing:", job.routing);
    
    // Get all resources and machines
    const [resourcesRes, machinesRes] = await Promise.all([
      fetch('http://localhost:5000/api/resources'),
      fetch('http://localhost:5000/api/machines')
    ]);
    
    const resources = await resourcesRes.json();
    const machines = await machinesRes.json();
    
    // For each operation, show compatible resources
    for (const operation of job.routing) {
      console.log(`\nOperation: ${operation.name} (${operation.machineType})`);
      console.log(`Compatible machines: ${operation.compatibleMachines.join(', ')}`);
      
      // Find machine IDs for compatible machines
      const compatibleMachineIds = machines
        .filter(m => operation.compatibleMachines.includes(m.machineId))
        .map(m => m.id);
      
      console.log(`Machine IDs: ${compatibleMachineIds.join(', ')}`);
      
      // Find compatible resources
      const compatibleResources = resources.filter(resource => {
        if (!resource.isActive) return false;
        
        // Check if resource can operate any compatible machine
        const canOperate = resource.workCenters?.some(wcId => 
          compatibleMachineIds.includes(wcId)
        );
        
        // Apply role filtering
        if (operation.machineType === 'OUTSOURCE') {
          return false;
        } else if (operation.machineType.includes('INSPECT')) {
          return resource.role === 'Quality Inspector' && canOperate;
        } else {
          return (resource.role === 'Operator' || resource.role === 'Shift Lead') && canOperate;
        }
      });
      
      console.log(`Compatible resources (${compatibleResources.length}):`);
      compatibleResources.forEach(r => {
        console.log(`  - ${r.name} (${r.role})`);
      });
    }
    
  } catch (error) {
    console.log("Error:", error.message);
  }
}

testCompatibilityEndpoint();
