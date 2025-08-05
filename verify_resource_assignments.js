// Test all resource assignment rules systematically
const jobs = [
  // Job with OUTSOURCE operation
  "eefdbee8-12ce-44b8-a923-4052d9704ba6", // Job 59902 - has OUTSOURCE + DEBURR
  
  // Job with INSPECT operation  
  "7f8a9b0c-1d2e-3f4a-5b6c-7d8e9f0a1b2c", // Any job with inspect operations
  
  // Job with mixed operations
  "3f5a7b1d-2c4e-5a6b-7c8d-9e0f1a2b3c4d"  // Job with different operation types
];

async function verifyResourceAssignments() {
  console.log("🔍 SYSTEMATIC RESOURCE ASSIGNMENT VERIFICATION");
  
  for (const jobId of jobs) {
    try {
      console.log(`\n📋 Testing job: ${jobId}`);
      
      // Clear schedule and test this job
      const clearRes = await fetch('http://localhost:5000/api/schedule/clear-all', {
        method: 'DELETE'
      });
      
      // Schedule the job
      const scheduleRes = await fetch(`http://localhost:5000/api/jobs/${jobId}/auto-schedule`, {
        method: 'POST'
      });
      
      const result = await scheduleRes.json();
      
      if (result.scheduleEntries) {
        for (const entry of result.scheduleEntries) {
          // Get machine details
          const machineRes = await fetch(`http://localhost:5000/api/machines`);
          const machines = await machineRes.json();
          const machine = machines.find(m => m.id === entry.machineId);
          
          // Get resource details if assigned
          let resource = null;
          if (entry.assignedResourceId) {
            const resourceRes = await fetch(`http://localhost:5000/api/resources`);
            const resources = await resourceRes.json();
            resource = resources.find(r => r.id === entry.assignedResourceId);
          }
          
          console.log(`   Operation ${entry.operationSequence}: ${machine?.machineId || 'UNKNOWN'} (${machine?.type || 'UNKNOWN'})`);
          console.log(`   Resource: ${resource?.name || 'NONE'} (${resource?.role || 'NONE'})`);
          
          // VERIFY RULES
          if (machine?.type === 'OUTSOURCE') {
            if (entry.assignedResourceId !== null) {
              console.log(`   ❌ RULE VIOLATION: OUTSOURCE operation has internal resource!`);
            } else {
              console.log(`   ✅ RULE CORRECT: OUTSOURCE has no internal resource`);
            }
          } else if (machine?.type === 'INSPECT') {
            if (resource?.role !== 'Quality Inspector') {
              console.log(`   ❌ RULE VIOLATION: INSPECT operation has non-inspector resource!`);
            } else {
              console.log(`   ✅ RULE CORRECT: INSPECT has Quality Inspector`);
            }
          } else {
            // Production operation
            if (resource && resource.role !== 'Operator' && resource.role !== 'Shift Lead') {
              console.log(`   ❌ RULE VIOLATION: PRODUCTION operation has wrong resource type!`);
            } else if (resource) {
              console.log(`   ✅ RULE CORRECT: PRODUCTION has Operator/Shift Lead`);
            } else {
              console.log(`   ⚠️ WARNING: PRODUCTION operation has no resource assigned`);
            }
          }
        }
      } else {
        console.log(`   ⚠️ Scheduling failed: ${result.failureReason || 'Unknown'}`);
      }
      
    } catch (error) {
      console.log(`   ❌ Error testing job ${jobId}: ${error.message}`);
    }
  }
}

verifyResourceAssignments();
