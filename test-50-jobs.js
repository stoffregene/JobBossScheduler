// Test scheduling ALL jobs without 50 limit

async function testScheduleAllJobs() {
  try {
    console.log("Testing scheduling ALL jobs...");
    
    // Get total job count
    const jobsRes = await fetch('http://localhost:5000/api/jobs');
    const jobs = await jobsRes.json();
    const unscheduledJobs = jobs.filter(j => j.status === 'Open' || j.status === 'Unscheduled' || j.status === 'Planning');
    
    console.log(`Total jobs: ${jobs.length}`);
    console.log(`Unscheduled jobs: ${unscheduledJobs.length}`);
    
    // Schedule ALL jobs by increasing the limit in query parameter
    console.log("\nScheduling ALL jobs with increased limit...");
    const response = await fetch('http://localhost:5000/api/jobs/schedule-all?maxJobs=100', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const result = await response.json();
    console.log("\nScheduling result:");
    console.log(`  Success: ${result.success}`);
    console.log(`  Scheduled: ${result.scheduled}`);
    console.log(`  Failed: ${result.failed}`);
    console.log(`  Total attempted: ${result.total}`);
    
    // Verify schedule entries
    const scheduleRes = await fetch('http://localhost:5000/api/schedule');
    const schedule = await scheduleRes.json();
    console.log(`\nTotal schedule entries created: ${schedule.length}`);
    
    // Show first few results
    if (result.results && result.results.length > 0) {
      console.log("\nFirst few job results:");
      result.results.slice(0, 5).forEach(r => {
        console.log(`  ${r.jobNumber}: ${r.status} (${r.priority}) - ${r.reason || r.operations + ' operations'}`);
      });
    }
    
  } catch (error) {
    console.log("Error:", error.message);
  }
}

testScheduleAllJobs();
