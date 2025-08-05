// Debug tool to understand why jobs are failing to schedule
import fetch from 'node-fetch';

const API_BASE = 'http://localhost:5000';

async function debugJobScheduling() {
  try {
    console.log('🔍 Debugging Job Scheduling Issues...\n');

    // 1. Get unscheduled jobs
    const jobsResponse = await fetch(`${API_BASE}/api/jobs`);
    const jobs = await jobsResponse.json();
    
    const unscheduledJobs = jobs.filter(job => 
      job.status === 'Unscheduled' || job.status === 'Planning'
    );
    
    console.log(`📋 Found ${unscheduledJobs.length} unscheduled jobs out of ${jobs.length} total jobs\n`);
    
    if (unscheduledJobs.length === 0) {
      console.log('✅ No unscheduled jobs found!');
      return;
    }

    // 2. Get machines and resources info
    const machinesResponse = await fetch(`${API_BASE}/api/machines`);
    const machines = await machinesResponse.json();
    
    const resourcesResponse = await fetch(`${API_BASE}/api/resources`);
    const resources = await resourcesResponse.json();
    
    console.log(`🏭 Available machines: ${machines.length}`);
    console.log(`👥 Available resources: ${resources.length}`);
    
    const activeMachines = machines.filter(m => m.status === 'Available');
    const activeResources = resources.filter(r => r.isActive);
    
    console.log(`🏭 Active machines: ${activeMachines.length}`);
    console.log(`👥 Active resources: ${activeResources.length}\n`);

    // 3. Try to schedule the first few unscheduled jobs and capture detailed errors
    const testJobs = unscheduledJobs.slice(0, 3);
    
    for (const job of testJobs) {
      console.log(`\n🎯 Testing Job ${job.jobNumber} (${job.id.slice(0, 8)})`);
      console.log(`   Description: ${job.description}`);
      console.log(`   Due Date: ${new Date(job.dueDate).toLocaleDateString()}`);
      console.log(`   Estimated Hours: ${job.estimatedHours}`);
      console.log(`   Priority: ${job.priority}`);
      console.log(`   Operations: ${job.routing?.length || 0}`);
      
      if (job.routing && job.routing.length > 0) {
        console.log(`   Routing Details:`);
        job.routing.forEach((op, index) => {
          console.log(`     ${index + 1}. ${op.name || op.operationName || 'Unknown'} - ${op.machineType}`);
          console.log(`        Compatible: [${op.compatibleMachines?.join(', ') || 'None'}]`);
          console.log(`        Hours: ${op.estimatedHours}`);
        });
      }
      
      // Try to auto-schedule and capture the response
      try {
        console.log(`\n🚀 Attempting to auto-schedule job ${job.jobNumber}...`);
        
        const scheduleResponse = await fetch(`${API_BASE}/api/jobs/${job.id}/auto-schedule`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        const scheduleResult = await scheduleResponse.json();
        
        if (scheduleResponse.ok) {
          console.log(`✅ Job ${job.jobNumber} scheduled successfully!`);
          console.log(`   Schedule entries created: ${scheduleResult.scheduleEntries?.length || 0}`);
        } else {
          console.log(`❌ Job ${job.jobNumber} failed to schedule`);
          console.log(`   Status: ${scheduleResponse.status}`);
          console.log(`   Error: ${scheduleResult.message || 'Unknown error'}`);
          
          if (scheduleResult.failureDetails) {
            console.log(`   Failure Details:`);
            scheduleResult.failureDetails.forEach((detail, index) => {
              console.log(`     Operation ${detail.operationSequence}: ${detail.operationName}`);
              console.log(`       Machine Type: ${detail.machineType}`);
              console.log(`       Compatible: [${detail.compatibleMachines?.join(', ') || 'None'}]`);
              console.log(`       Attempted Dates: ${detail.attemptedDates || 0}`);
              console.log(`       Reasons: ${detail.reasons?.join(', ') || 'No reasons provided'}`);
            });
          }
        }
      } catch (scheduleError) {
        console.log(`💥 Exception during scheduling: ${scheduleError.message}`);
      }
      
      console.log(`\n${'='.repeat(80)}`);
    }

    // 4. Check for common issues
    console.log(`\n🔧 System Health Check:`);
    
    // Check machine types vs job requirements
    const machineTypes = [...new Set(machines.map(m => m.type))];
    const requiredMachineTypes = [...new Set(
      unscheduledJobs.flatMap(job => 
        job.routing?.map(op => op.machineType) || []
      )
    )];
    
    console.log(`   Machine types available: ${machineTypes.join(', ')}`);
    console.log(`   Machine types required: ${requiredMachineTypes.join(', ')}`);
    
    const missingTypes = requiredMachineTypes.filter(type => 
      !machineTypes.includes(type) && type !== 'OUTSOURCE'
    );
    
    if (missingTypes.length > 0) {
      console.log(`   ⚠️  Missing machine types: ${missingTypes.join(', ')}`);
    } else {
      console.log(`   ✅ All required machine types are available`);
    }
    
    // Check resources
    const resourceRoles = [...new Set(resources.map(r => r.role))];
    console.log(`   Resource roles available: ${resourceRoles.join(', ')}`);
    
    const operatorsCount = resources.filter(r => 
      r.isActive && (r.role === 'Operator' || r.role === 'Shift Lead')
    ).length;
    
    console.log(`   Active operators/leads: ${operatorsCount}`);
    
    if (operatorsCount === 0) {
      console.log(`   ⚠️  No active operators found! This could block scheduling.`);
    }

  } catch (error) {
    console.error('❌ Error debugging scheduling:', error);
  }
}

// Run the debug tool
debugJobScheduling();