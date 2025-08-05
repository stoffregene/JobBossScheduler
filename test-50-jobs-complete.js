// Test scheduling ALL jobs without 50 limit

async function testScheduleAllJobs() {
  try {
    console.log("Testing scheduling ALL jobs...");
    
    // First clear existing schedule
    await fetch('http://localhost:5000/api/schedule/all', { method: 'DELETE' });
    console.log("Cleared existing schedule");
    
    // Get total job count
    const jobsRes = await fetch('http://localhost:5000/api/jobs');
    const jobs = await jobsRes.json();
    const unscheduledJobs = jobs.filter(j => j.status === 'Open' || j.status === 'Unscheduled' || j.status === 'Planning');
    
    console.log(`Total jobs: ${jobs.length}`);
    console.log(`Unscheduled jobs: ${unscheduledJobs.length}`);
    
    // Schedule ALL jobs by increasing the limit
    console.log("\nScheduling with increased limit...");
    const response = await fetch('http://localhost:5000/api/schedule/priority-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ maxJobs: 100 }) // Increase limit to 100
    });
    
    const result = await response.json();
    console.log("\nScheduling result:");
    console.log(`  Scheduled: ${result.scheduled}`);
    console.log(`  Failed: ${result.failed}`);
    console.log(`  Total attempted: ${result.scheduled + result.failed}`);
    
    // Verify schedule entries
    const scheduleRes = await fetch('http://localhost:5000/api/schedule');
    const schedule = await scheduleRes.json();
    console.log(`\nTotal schedule entries created: ${schedule.length}`);
    
  } catch (error) {
    console.log("Error:", error.message);
  }
}

testScheduleAllJobs();
