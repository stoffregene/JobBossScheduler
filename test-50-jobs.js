// Test script to create 50 jobs with different routing stages
// Run with: node test-50-jobs.js

const jobs = [
  // Mills - 20 jobs
  ...Array.from({ length: 20 }, (_, i) => ({
    jobNumber: `M${String(i + 1).padStart(3, '0')}`,
    partNumber: `PN-MILL-${i + 1}`,
    description: `Machined component ${i + 1}`,
    customer: `Customer ${Math.floor(i / 5) + 1}`,
    dueDate: new Date(Date.now() + (7 + Math.floor(Math.random() * 30)) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    priority: ['Normal', 'High', 'Critical'][Math.floor(Math.random() * 3)],
    estimatedHours: (2 + Math.random() * 8).toFixed(1),
    quantity: Math.floor(1 + Math.random() * 100),
    routing: [
      { sequence: 1, name: "CNC Milling", machineType: "MILL", estimatedHours: parseFloat((1 + Math.random() * 4).toFixed(1)), compatibleMachines: ["VMC-001", "VMC-002", "VMC-003"] },
      { sequence: 2, name: "Inspection", machineType: "INSPECT", estimatedHours: 0.5, compatibleMachines: ["INSPECT-001"] }
    ]
  })),
  
  // Lathes - 15 jobs
  ...Array.from({ length: 15 }, (_, i) => ({
    jobNumber: `L${String(i + 1).padStart(3, '0')}`,
    partNumber: `PN-LATHE-${i + 1}`,
    description: `Turned component ${i + 1}`,
    customer: `Customer ${Math.floor(i / 4) + 1}`,
    dueDate: new Date(Date.now() + (7 + Math.floor(Math.random() * 30)) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    priority: ['Normal', 'High', 'Critical'][Math.floor(Math.random() * 3)],
    estimatedHours: (1.5 + Math.random() * 6).toFixed(1),
    quantity: Math.floor(1 + Math.random() * 50),
    routing: [
      { sequence: 1, name: "CNC Turning", machineType: "LATHE", estimatedHours: parseFloat((1 + Math.random() * 5).toFixed(1)), compatibleMachines: ["LATHE-001", "LATHE-002", "LATHE-003"] },
      { sequence: 2, name: "Inspection", machineType: "INSPECT", estimatedHours: 0.3, compatibleMachines: ["INSPECT-001"] }
    ]
  })),
  
  // Multi-operation jobs - 10 jobs
  ...Array.from({ length: 10 }, (_, i) => ({
    jobNumber: `MX${String(i + 1).padStart(2, '0')}`,
    partNumber: `PN-MULTI-${i + 1}`,
    description: `Complex multi-operation part ${i + 1}`,
    customer: `Customer ${Math.floor(i / 3) + 1}`,
    dueDate: new Date(Date.now() + (10 + Math.floor(Math.random() * 30)) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    priority: ['High', 'Critical'][Math.floor(Math.random() * 2)],
    estimatedHours: (5 + Math.random() * 15).toFixed(1),
    quantity: Math.floor(1 + Math.random() * 25),
    routing: [
      { sequence: 1, name: "CNC Milling", machineType: "MILL", estimatedHours: parseFloat((2 + Math.random() * 6).toFixed(1)), compatibleMachines: ["VMC-001", "VMC-002", "HMC-001"] },
      { sequence: 2, name: "CNC Turning", machineType: "LATHE", estimatedHours: parseFloat((1.5 + Math.random() * 4).toFixed(1)), compatibleMachines: ["LATHE-001", "LATHE-003"] },
      { sequence: 3, name: "Inspection", machineType: "INSPECT", estimatedHours: 0.5, compatibleMachines: ["INSPECT-001"] }
    ]
  })),
  
  // Inspection only - 5 jobs
  ...Array.from({ length: 5 }, (_, i) => ({
    jobNumber: `I${String(i + 1).padStart(3, '0')}`,
    partNumber: `PN-INSPECT-${i + 1}`,
    description: `Inspection job ${i + 1}`,
    customer: `Customer ${Math.floor(i / 2) + 1}`,
    dueDate: new Date(Date.now() + (3 + Math.floor(Math.random() * 14)) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    priority: 'Normal',
    estimatedHours: (0.5 + Math.random() * 2).toFixed(1),
    quantity: Math.floor(1 + Math.random() * 10),
    routing: [
      { sequence: 1, name: "Quality Inspection", machineType: "INSPECT", estimatedHours: parseFloat((0.5 + Math.random() * 1.5).toFixed(1)), compatibleMachines: ["INSPECT-001"] }
    ]
  }))
];

async function createJobs() {
  const BASE_URL = 'http://localhost:5000';
  
  console.log(`Creating ${jobs.length} test jobs...`);
  
  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    
    try {
      const response = await fetch(`${BASE_URL}/api/jobs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(job),
      });
      
      if (response.ok) {
        console.log(`✓ Created job ${job.jobNumber}`);
      } else {
        const error = await response.text();
        console.log(`✗ Failed to create job ${job.jobNumber}: ${error}`);
      }
      
      // Small delay to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 50));
      
    } catch (error) {
      console.log(`✗ Error creating job ${job.jobNumber}:`, error.message);
    }
  }
  
  console.log('\nJob creation complete!');
  console.log('You can now test the "Schedule All" button to see the intelligent scheduling in action.');
}

// Run the function
createJobs().catch(console.error);