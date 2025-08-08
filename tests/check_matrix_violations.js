// Check for compatibility matrix violations in scheduled entries

async function checkMatrixViolations() {
  try {
    // Get all data
    const [scheduleRes, machinesRes, resourcesRes] = await Promise.all([
      fetch('http://localhost:5000/api/schedule'),
      fetch('http://localhost:5000/api/machines'),
      fetch('http://localhost:5000/api/resources')
    ]);
    
    const schedule = await scheduleRes.json();
    const machines = await machinesRes.json();
    const resources = await resourcesRes.json();
    
    // Create lookup maps
    const machineMap = new Map(machines.map(m => [m.id, m]));
    const resourceMap = new Map(resources.map(r => [r.id, r]));
    
    console.log(`\n🔍 CHECKING ${schedule.length} SCHEDULED ENTRIES FOR MATRIX VIOLATIONS:\n`);
    
    let violations = 0;
    let correct = 0;
    
    for (const entry of schedule) {
      const machine = machineMap.get(entry.machineId);
      const resource = entry.assignedResourceId ? resourceMap.get(entry.assignedResourceId) : null;
      
      if (!machine) continue;
      
      console.log(`Entry: Machine ${machine.machineId} (${machine.type})`);
      
      // Check OUTSOURCE operations
      if (machine.type === 'OUTSOURCE') {
        if (entry.assignedResourceId !== null) {
          console.log(`  ❌ VIOLATION: OUTSOURCE has resource ${resource?.name}`);
          violations++;
        } else {
          console.log(`  ✅ CORRECT: OUTSOURCE has no resource`);
          correct++;
        }
        continue;
      }
      
      // Check INSPECT operations
      if (machine.type === 'INSPECT') {
        if (!resource) {
          console.log(`  ⚠️ WARNING: INSPECT has no resource`);
        } else if (resource.role !== 'Quality Inspector') {
          console.log(`  ❌ VIOLATION: INSPECT has ${resource.role} ${resource.name} (should be Quality Inspector)`);
          violations++;
        } else if (!resource.workCenters?.includes(machine.id)) {
          console.log(`  ❌ VIOLATION: ${resource.name} not qualified for ${machine.machineId}`);
          violations++;
        } else {
          console.log(`  ✅ CORRECT: Quality Inspector ${resource.name} qualified for INSPECT`);
          correct++;
        }
        continue;
      }
      
      // Check PRODUCTION operations
      if (!resource) {
        console.log(`  ⚠️ WARNING: Production operation has no resource`);
      } else {
        const validRole = resource.role === 'Operator' || resource.role === 'Shift Lead';
        const qualified = resource.workCenters?.includes(machine.id);
        
        if (!validRole) {
          console.log(`  ❌ VIOLATION: ${machine.machineId} has ${resource.role} ${resource.name} (should be Operator/Shift Lead)`);
          violations++;
        } else if (!qualified) {
          console.log(`  ❌ VIOLATION: ${resource.name} NOT qualified for ${machine.machineId}`);
          console.log(`    Resource work centers: ${resource.workCenters?.join(', ') || 'NONE'}`);
          console.log(`    Required machine ID: ${machine.id}`);
          violations++;
        } else {
          console.log(`  ✅ CORRECT: ${resource.role} ${resource.name} qualified for ${machine.machineId}`);
          correct++;
        }
      }
    }
    
    console.log(`\n📊 SUMMARY: ${violations} violations, ${correct} correct assignments`);
    
  } catch (error) {
    console.log(`Error: ${error.message}`);
  }
}

checkMatrixViolations();
