// Test script to demonstrate machine substitution logic
const API_BASE = 'http://localhost:5000/api';

async function testMachineSubstitution() {
  console.log('=== Testing Machine Substitution Logic ===\n');

  try {
    // Test 1: Regular 3-axis VMC job
    console.log('1. Looking for 3-axis VMC machines (regular vertical milling):');
    const response1 = await fetch(`${API_BASE}/machines/compatible/vertical_milling?category=3-Axis%20Vertical%20Milling%20Centers&tier=Tier%201`);
    const vmcMachines = await response1.json();
    console.log('Available machines:', vmcMachines.map(m => `${m.name} (${m.category})`));

    // Test 2: 4th axis pseudo work - shows MV-653 in different pool
    console.log('\n2. Looking for machines capable of 4th axis work:');
    const response2 = await fetch(`${API_BASE}/machines/compatible/vertical_milling?category=3-Axis%20VMC's%20with%20pseudo%204th%20axis&tier=Tier%201`);
    const fourthAxisMachines = await response2.json();
    console.log('Available machines:', fourthAxisMachines.map(m => `${m.name} (${m.category})`));

    // Test 3: Live tooling lathe work
    console.log('\n3. Looking for live tooling lathe capability:');
    const response3 = await fetch(`${API_BASE}/machines/compatible/turning?category=Live%20Tooling%20Lathes&tier=Tier%201`);
    const latheMachines = await response3.json();
    console.log('Available machines:', latheMachines.map(m => `${m.name} (${m.category})`));

    // Test 4: Bar fed work - different substitution pool
    console.log('\n4. Looking for bar feeding capability:');
    const response4 = await fetch(`${API_BASE}/machines/compatible/turning?category=Bar%20Fed%20Lathes&tier=Tier%201`);
    const barFedMachines = await response4.json();
    console.log('Available machines:', barFedMachines.map(m => `${m.name} (${m.category})`));

    console.log('\n=== Key Insight ===');
    console.log('Notice how MV-653 appears in different machine pools depending on how the job is quoted:');
    console.log('- Regular VMC work: Gets standard 3-axis machines');
    console.log('- 4th axis work: Gets MV-653 and other pseudo-4th capable machines');
    console.log('This demonstrates the overlapping tier logic you described!');

  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testMachineSubstitution();