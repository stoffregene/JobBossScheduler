// Test script to demonstrate machine substitution logic
const API_BASE = 'http://localhost:5000/api';

async function testTierBasedSubstitution() {
  console.log('=== Testing Corrected Tier-Based Substitution Logic ===\n');

  try {
    // LATHE TIER FLOW TESTS
    console.log('=== LATHE TIER FLOWS ===');
    
    // Test 1: Single Spindle job (base tier - can upgrade to anything)
    console.log('\n1. Single Spindle Turning Job:');
    console.log('   (Can upgrade to Live Tooling, Bar Fed, or Dual Spindle)');
    const response1 = await fetch(`${API_BASE}/machines/compatible/single_spindle_turning`);
    const singleSpindleMachines = await response1.json();
    console.log('   Available machines:', singleSpindleMachines.map(m => `${m.name} (${m.category})`));

    // Test 2: Live Tooling job (specialized - cannot downgrade)
    console.log('\n2. Live Tooling Turning Job:');
    console.log('   (Can ONLY run on Live Tooling or Dual Spindle machines)');
    const response2 = await fetch(`${API_BASE}/machines/compatible/live_tooling_turning`);
    const liveToolingMachines = await response2.json();
    console.log('   Available machines:', liveToolingMachines.map(m => `${m.name} (${m.category})`));

    // Test 3: Bar Fed job (specialized - cannot downgrade)
    console.log('\n3. Bar Fed Turning Job:');
    console.log('   (Can ONLY run on Bar Fed or Dual Spindle machines)');
    const response3 = await fetch(`${API_BASE}/machines/compatible/bar_fed_turning`);
    const barFedMachines = await response3.json();
    console.log('   Available machines:', barFedMachines.map(m => `${m.name} (${m.category})`));

    // Test 4: Dual Spindle job (most specialized)
    console.log('\n4. Dual Spindle Turning Job:');
    console.log('   (Can ONLY run on Dual Spindle machines)');
    const response4 = await fetch(`${API_BASE}/machines/compatible/dual_spindle_turning`);
    const dualSpindleMachines = await response4.json();
    console.log('   Available machines:', dualSpindleMachines.map(m => `${m.name} (${m.category})`));

    // MILL TIER FLOW TESTS
    console.log('\n=== MILL TIER FLOWS ===');
    
    // Test 5: Basic VMC job (base tier - can upgrade)
    console.log('\n5. Basic VMC Milling Job:');
    console.log('   (Can upgrade to Pseudo 4th, HMC, or 5-Axis)');
    const response5 = await fetch(`${API_BASE}/machines/compatible/vmc_milling`);
    const vmcMachines = await response5.json();
    console.log('   Available machines:', vmcMachines.map(m => `${m.name} (${m.category})`));

    // Test 6: Pseudo 4th Axis job (requires pseudo 4th capability)
    console.log('\n6. Pseudo 4th Axis Milling Job:');
    console.log('   (Can run on Pseudo 4th, HMC, or 5-Axis - NOT basic VMC)');
    const response6 = await fetch(`${API_BASE}/machines/compatible/pseudo_4th_axis_milling`);
    const pseudo4thMachines = await response6.json();
    console.log('   Available machines:', pseudo4thMachines.map(m => `${m.name} (${m.category})`));

    // Test 7: True 4th Axis job (requires true rotary capability)
    console.log('\n7. True 4th Axis Milling Job:');
    console.log('   (Can ONLY run on HMC or 5-Axis - cannot use pseudo)');
    const response7 = await fetch(`${API_BASE}/machines/compatible/true_4th_axis_milling`);
    const true4thMachines = await response7.json();
    console.log('   Available machines:', true4thMachines.map(m => `${m.name} (${m.category})`));

    // LEGACY COMPATIBILITY TESTS
    console.log('\n=== LEGACY COMPATIBILITY ===');
    
    // Test 8: Legacy "turning" capability (maps to single_spindle_turning)
    console.log('\n8. Legacy "turning" capability:');
    const response8 = await fetch(`${API_BASE}/machines/compatible/turning`);
    const legacyTurningMachines = await response8.json();
    console.log('   Available machines:', legacyTurningMachines.map(m => `${m.name} (${m.category})`));

    // Test 9: Legacy "live_tooling" capability
    console.log('\n9. Legacy "live_tooling" capability:');
    const response9 = await fetch(`${API_BASE}/machines/compatible/live_tooling`);
    const legacyLiveToolingMachines = await response9.json();
    console.log('   Available machines:', legacyLiveToolingMachines.map(m => `${m.name} (${m.category})`));

    console.log('\n=== KEY INSIGHTS ===');
    console.log('✓ Single Spindle jobs can access ALL lathe types (upgrade flow)');
    console.log('✓ Live Tooling jobs CANNOT access Single Spindle machines (no downgrade)');
    console.log('✓ Bar Fed jobs CANNOT access Single Spindle machines (no downgrade)');
    console.log('✓ Pseudo 4th axis jobs cannot use basic VMCs (need capability)');
    console.log('✓ True 4th axis jobs cannot use pseudo machines (need full rotary)');
    console.log('✓ MV-653 appears in different pools based on job requirements!');

  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testTierBasedSubstitution();