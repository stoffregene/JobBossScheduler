// Test direct scheduling to see operator filtering

async function testDirectSchedule() {
  try {
    // Clear schedule first
    await fetch('http://localhost:5000/api/schedule/clear-all', { method: 'DELETE' });
    
    // Schedule job 58303 directly
    console.log("Scheduling job 58303 (INSPECT operation)...");
    const response = await fetch('http://localhost:5000/api/jobs/03dc4378-7635-4edb-a4bb-183046f5b7f8/auto-schedule', {
      method: 'POST'
    });
    
    const result = await response.json();
    console.log("Schedule result:", result.success ? "SUCCESS" : "FAILED");
    
    if (result.scheduleEntries) {
      // Get details about the scheduled entry
      const scheduleRes = await fetch('http://localhost:5000/api/schedule');
      const schedule = await scheduleRes.json();
      const entry = schedule.find(e => e.jobId === '03dc4378-7635-4edb-a4bb-183046f5b7f8');
      
      if (entry) {
        const resourcesRes = await fetch('http://localhost:5000/api/resources');
        const resources = await resourcesRes.json();
        const assignedResource = resources.find(r => r.id === entry.assignedResourceId);
        
        console.log("\nScheduled Entry Details:");
        console.log(`  Machine: ${entry.machineId}`);
        console.log(`  Assigned Resource: ${assignedResource?.name || 'NONE'}`);
        console.log(`  Resource Role: ${assignedResource?.role || 'N/A'}`);
        console.log(`  Is Quality Inspector: ${assignedResource?.role === 'Quality Inspector' ? 'YES' : 'NO'}`);
      }
    }
    
  } catch (error) {
    console.log("Error:", error.message);
  }
}

testDirectSchedule();
