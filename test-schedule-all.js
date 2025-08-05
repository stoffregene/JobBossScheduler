async function scheduleAllJobs() {
  try {
    console.log("Scheduling ALL 73 jobs...\n");
    
    // First, clear any existing schedule
    const clearResponse = await fetch('http://localhost:5000/api/schedule/all', { 
      method: 'DELETE' 
    });
    const clearResult = await clearResponse.json();
    console.log("Cleared existing schedule:", clearResult.message);
    
    // Get current job count
    const jobsRes = await fetch('http://localhost:5000/api/jobs');
    const jobs = await jobsRes.json();
    console.log(`\nTotal jobs in system: ${jobs.length}`);
    console.log(`Jobs ready to schedule: ${jobs.filter(j => ['Open', 'Unscheduled', 'Planning'].includes(j.status)).length}`);
    
    // Schedule ALL jobs with increased limit
    console.log("\nScheduling with maxJobs=100...");
    const response = await fetch('http://localhost:5000/api/jobs/schedule-all?maxJobs=100', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const result = await response.json();
    console.log("\n✅ SCHEDULING COMPLETE!");
    console.log(`   Scheduled: ${result.scheduled} jobs`);
    console.log(`   Failed: ${result.failed} jobs`);
    console.log(`   Total: ${result.total} jobs attempted`);
    
    // Show summary of priorities
    if (result.results) {
      const priorities = {};
      result.results.forEach(r => {
        priorities[r.priority] = (priorities[r.priority] || 0) + 1;
      });
      console.log("\nJobs by priority:");
      Object.entries(priorities).forEach(([p, count]) => {
        console.log(`   ${p}: ${count} jobs`);
      });
    }
    
    // Verify schedule entries
    const scheduleRes = await fetch('http://localhost:5000/api/schedule');
    const schedule = await scheduleRes.json();
    console.log(`\nTotal schedule entries created: ${schedule.length}`);
    
  } catch (error) {
    console.error("Error:", error.message);
  }
}

scheduleAllJobs();
