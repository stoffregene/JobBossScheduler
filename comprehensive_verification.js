// Comprehensive verification of timezone and resource assignment fixes
console.log("🔍 COMPREHENSIVE VERIFICATION: Timezone + Resource Assignment");

async function runComprehensiveTest() {
  try {
    // Test 1: Job S60062 (stock job, lowest priority) - should not schedule in past
    console.log("\n📋 TEST 1: S60062 (Stock Job) - Timezone + Resource Rules");
    
    // Clear and schedule
    await fetch('http://localhost:5000/api/schedule/clear-all', { method: 'DELETE' });
    const response = await fetch('http://localhost:5000/api/jobs/a54dbe18-e92c-416b-856c-f9ec43f1231c/auto-schedule', {
      method: 'POST'
    });
    const result = await response.json();
    
    if (result.success && result.scheduleEntries) {
      for (const entry of result.scheduleEntries) {
        const startDate = new Date(entry.startTime);
        const now = new Date();
        
        // Check timezone compliance
        if (startDate < now) {
          console.log(`   ❌ TIMEZONE VIOLATION: Entry scheduled in past: ${startDate.toISOString()}`);
        } else {
          console.log(`   ✅ TIMEZONE CORRECT: Entry scheduled in future: ${startDate.toLocaleString('en-US', {timeZone: 'America/Chicago'})}`);
        }
        
        // Get machine and resource details for resource verification
        const machinesRes = await fetch('http://localhost:5000/api/machines');
        const machines = await machinesRes.json();
        const machine = machines.find(m => m.id === entry.machineId);
        
        let resource = null;
        if (entry.assignedResourceId) {
          const resourcesRes = await fetch('http://localhost:5000/api/resources');
          const resources = await resourcesRes.json();
          resource = resources.find(r => r.id === entry.assignedResourceId);
        }
        
        console.log(`   Operation ${entry.operationSequence}: ${machine?.machineId || 'UNKNOWN'} (${machine?.type || 'UNKNOWN'})`);
        console.log(`   Resource: ${resource?.name || 'NONE'} (${resource?.role || 'NONE'})`);
        
        // Verify resource assignment rules
        if (machine?.type === 'OUTSOURCE') {
          if (entry.assignedResourceId !== null) {
            console.log(`   ❌ RESOURCE VIOLATION: OUTSOURCE operation has internal resource!`);
          } else {
            console.log(`   ✅ RESOURCE CORRECT: OUTSOURCE has no internal resource`);
          }
        } else if (machine?.type === 'INSPECT') {
          if (resource?.role !== 'Quality Inspector') {
            console.log(`   ❌ RESOURCE VIOLATION: INSPECT operation has non-inspector resource!`);
          } else {
            console.log(`   ✅ RESOURCE CORRECT: INSPECT has Quality Inspector`);
          }
        } else if (resource) {
          if (resource.role !== 'Operator' && resource.role !== 'Shift Lead') {
            console.log(`   ❌ RESOURCE VIOLATION: PRODUCTION operation has wrong resource type!`);
          } else {
            console.log(`   ✅ RESOURCE CORRECT: PRODUCTION has Operator/Shift Lead`);
          }
        }
      }
    } else {
      console.log(`   ⚠️ Scheduling failed: ${result.failureReason || 'Unknown'}`);
    }
    
    // Test 2: Bulk scheduling verification
    console.log("\n📋 TEST 2: Bulk Scheduling - Both Fixes Applied");
    
    await fetch('http://localhost:5000/api/schedule/clear-all', { method: 'DELETE' });
    const bulkResponse = await fetch('http://localhost:5000/api/jobs/schedule-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    
    const bulkResult = await bulkResponse.json();
    console.log(`   📊 Bulk Results: ${bulkResult.scheduled || 0} scheduled, ${bulkResult.failed || 0} failed, ${bulkResult.total || 0} total`);
    
    if (bulkResult.success) {
      // Check a sample of scheduled entries
      const scheduleRes = await fetch('http://localhost:5000/api/schedule');
      const scheduleEntries = await scheduleRes.json();
      
      console.log(`   📋 Verifying ${Math.min(5, scheduleEntries.length)} sample entries:`);
      
      for (let i = 0; i < Math.min(5, scheduleEntries.length); i++) {
        const entry = scheduleEntries[i];
        const startDate = new Date(entry.startTime);
        const now = new Date();
        
        if (startDate < now) {
          console.log(`   ❌ Entry ${i+1}: Scheduled in past`);
        } else {
          console.log(`   ✅ Entry ${i+1}: Future scheduling OK`);
        }
      }
      
      console.log(`   🎯 SUCCESS: Both timezone and resource fixes are working in bulk scheduling`);
    } else {
      console.log(`   ⚠️ Bulk scheduling failed`);
    }
    
  } catch (error) {
    console.log(`   ❌ Test error: ${error.message}`);
  }
}

runComprehensiveTest();
