#!/usr/bin/env node

// Complete test script to create 50 jobs with realistic, varied routings
// Run with: node test-50-jobs-complete.js

const jobs = [
  // Simple Mill Jobs - 15 jobs
  ...Array.from({ length: 15 }, (_, i) => ({
    jobNumber: `M${String(i + 1).padStart(3, '0')}`,
    partNumber: `PN-MILL-${i + 1}`,
    description: `CNC Milled Part ${i + 1}`,
    customer: `Customer ${Math.floor(i / 3) + 1}`,
    dueDate: new Date(Date.now() + (7 + Math.floor(Math.random() * 30)) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    priority: ['Normal', 'High', 'Critical'][Math.floor(Math.random() * 3)],
    estimatedHours: (2 + Math.random() * 8).toFixed(1),
    quantity: Math.floor(1 + Math.random() * 100),
    routing: [
      { 
        sequence: 1, 
        name: "CNC Milling", 
        machineType: "MILL", 
        estimatedHours: parseFloat((1 + Math.random() * 4).toFixed(1)), 
        compatibleMachines: i % 3 === 0 ? ["VMC-001", "VMC-002"] : i % 3 === 1 ? ["HMC-001", "VMC-003"] : ["VMC-001", "VMC-002", "VMC-003"]
      },
      { 
        sequence: 2, 
        name: "Quality Inspection", 
        machineType: "INSPECT", 
        estimatedHours: 0.5, 
        compatibleMachines: ["INSPECT-001"] 
      }
    ]
  })),

  // Simple Lathe Jobs - 12 jobs
  ...Array.from({ length: 12 }, (_, i) => ({
    jobNumber: `L${String(i + 1).padStart(3, '0')}`,
    partNumber: `PN-LATHE-${i + 1}`,
    description: `CNC Turned Shaft ${i + 1}`,
    customer: `Customer ${Math.floor(i / 3) + 1}`,
    dueDate: new Date(Date.now() + (5 + Math.floor(Math.random() * 25)) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    priority: ['Normal', 'High'][Math.floor(Math.random() * 2)],
    estimatedHours: (1.5 + Math.random() * 6).toFixed(1),
    quantity: Math.floor(1 + Math.random() * 50),
    routing: [
      { 
        sequence: 1, 
        name: "CNC Turning", 
        machineType: "LATHE", 
        estimatedHours: parseFloat((1 + Math.random() * 5).toFixed(1)), 
        compatibleMachines: i % 4 === 0 ? ["LATHE-001"] : i % 4 === 1 ? ["LATHE-002"] : i % 4 === 2 ? ["LATHE-003"] : ["LATHE-001", "LATHE-002"]
      },
      { 
        sequence: 2, 
        name: "Final Inspection", 
        machineType: "INSPECT", 
        estimatedHours: 0.3, 
        compatibleMachines: ["INSPECT-001"] 
      }
    ]
  })),

  // Bar Fed Lathe Jobs - 8 jobs
  ...Array.from({ length: 8 }, (_, i) => ({
    jobNumber: `BF${String(i + 1).padStart(2, '0')}`,
    partNumber: `PN-BARFED-${i + 1}`,
    description: `Bar Fed Component ${i + 1}`,
    customer: `Customer ${Math.floor(i / 2) + 1}`,
    dueDate: new Date(Date.now() + (4 + Math.floor(Math.random() * 20)) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    priority: ['Normal', 'High', 'Critical'][Math.floor(Math.random() * 3)],
    estimatedHours: (0.5 + Math.random() * 3).toFixed(1),
    quantity: Math.floor(50 + Math.random() * 200),
    routing: [
      { 
        sequence: 1, 
        name: "Bar Fed Turning", 
        machineType: "LATHE", 
        estimatedHours: parseFloat((0.5 + Math.random() * 2.5).toFixed(1)), 
        compatibleMachines: ["LATHE-003", "LATHE-004"] // Bar fed capable machines
      },
      { 
        sequence: 2, 
        name: "Deburring", 
        machineType: "INSPECT", 
        estimatedHours: 0.2, 
        compatibleMachines: ["INSPECT-001"] 
      }
    ]
  })),

  // Multi-Operation Complex Jobs - 10 jobs
  ...Array.from({ length: 10 }, (_, i) => ({
    jobNumber: `CX${String(i + 1).padStart(2, '0')}`,
    partNumber: `PN-COMPLEX-${i + 1}`,
    description: `Complex Multi-Op Part ${i + 1}`,
    customer: `Customer ${Math.floor(i / 2) + 1}`,
    dueDate: new Date(Date.now() + (14 + Math.floor(Math.random() * 45)) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    priority: ['High', 'Critical'][Math.floor(Math.random() * 2)],
    estimatedHours: (8 + Math.random() * 20).toFixed(1),
    quantity: Math.floor(1 + Math.random() * 25),
    routing: i % 3 === 0 ? [
      // Mill -> Lathe -> Mill -> Inspect
      { sequence: 1, name: "Rough Milling", machineType: "MILL", estimatedHours: parseFloat((2 + Math.random() * 4).toFixed(1)), compatibleMachines: ["HMC-001", "VMC-001"] },
      { sequence: 2, name: "CNC Turning", machineType: "LATHE", estimatedHours: parseFloat((1.5 + Math.random() * 3).toFixed(1)), compatibleMachines: ["LATHE-001", "LATHE-002"] },
      { sequence: 3, name: "Finish Milling", machineType: "MILL", estimatedHours: parseFloat((1 + Math.random() * 2).toFixed(1)), compatibleMachines: ["VMC-002", "VMC-003"] },
      { sequence: 4, name: "Final Inspection", machineType: "INSPECT", estimatedHours: 0.75, compatibleMachines: ["INSPECT-001"] }
    ] : i % 3 === 1 ? [
      // Lathe -> Mill -> Inspect
      { sequence: 1, name: "Primary Turning", machineType: "LATHE", estimatedHours: parseFloat((2 + Math.random() * 5).toFixed(1)), compatibleMachines: ["LATHE-001", "LATHE-003"] },
      { sequence: 2, name: "Secondary Milling", machineType: "MILL", estimatedHours: parseFloat((1.5 + Math.random() * 3).toFixed(1)), compatibleMachines: ["VMC-001", "VMC-002", "HMC-001"] },
      { sequence: 3, name: "Quality Check", machineType: "INSPECT", estimatedHours: 0.5, compatibleMachines: ["INSPECT-001"] }
    ] : [
      // Mill -> Mill -> Lathe -> Inspect
      { sequence: 1, name: "1st Op Milling", machineType: "MILL", estimatedHours: parseFloat((1.5 + Math.random() * 3).toFixed(1)), compatibleMachines: ["VMC-001"] },
      { sequence: 2, name: "2nd Op Milling", machineType: "MILL", estimatedHours: parseFloat((2 + Math.random() * 4).toFixed(1)), compatibleMachines: ["HMC-001", "VMC-003"] },
      { sequence: 3, name: "Threading", machineType: "LATHE", estimatedHours: parseFloat((0.5 + Math.random() * 1.5).toFixed(1)), compatibleMachines: ["LATHE-002"] },
      { sequence: 4, name: "Final Inspection", machineType: "INSPECT", estimatedHours: 0.6, compatibleMachines: ["INSPECT-001"] }
    ]
  })),

  // Inspection Only Jobs - 3 jobs
  ...Array.from({ length: 3 }, (_, i) => ({
    jobNumber: `QC${String(i + 1).padStart(2, '0')}`,
    partNumber: `PN-QC-${i + 1}`,
    description: `Quality Control Job ${i + 1}`,
    customer: `Customer ${Math.floor(i / 2) + 1}`,
    dueDate: new Date(Date.now() + (2 + Math.floor(Math.random() * 10)) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    priority: 'Normal',
    estimatedHours: (0.5 + Math.random() * 2).toFixed(1),
    quantity: Math.floor(1 + Math.random() * 10),
    routing: [
      { 
        sequence: 1, 
        name: "Dimensional Inspection", 
        machineType: "INSPECT", 
        estimatedHours: parseFloat((0.5 + Math.random() * 1.5).toFixed(1)), 
        compatibleMachines: ["INSPECT-001"] 
      }
    ]
  })),

  // Wire EDM Jobs - 2 jobs (if system supports EDM)
  ...Array.from({ length: 2 }, (_, i) => ({
    jobNumber: `EDM${String(i + 1).padStart(1, '0')}`,
    partNumber: `PN-EDM-${i + 1}`,
    description: `Wire EDM Part ${i + 1}`,
    customer: `Precision Customer ${i + 1}`,
    dueDate: new Date(Date.now() + (21 + Math.floor(Math.random() * 14)) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    priority: 'Critical',
    estimatedHours: (12 + Math.random() * 24).toFixed(1),
    quantity: Math.floor(1 + Math.random() * 5),
    routing: [
      { sequence: 1, name: "Rough Milling", machineType: "MILL", estimatedHours: parseFloat((2 + Math.random() * 3).toFixed(1)), compatibleMachines: ["VMC-001", "VMC-002"] },
      { sequence: 2, name: "Wire EDM", machineType: "EDM", estimatedHours: parseFloat((8 + Math.random() * 16).toFixed(1)), compatibleMachines: ["EDM-001"] },
      { sequence: 3, name: "Final Inspection", machineType: "INSPECT", estimatedHours: 1.0, compatibleMachines: ["INSPECT-001"] }
    ]
  }))
];

async function createJobs() {
  console.log('Creating 50 test jobs with varied routings...');
  
  const results = {
    created: 0,
    failed: 0,
    errors: []
  };

  for (const job of jobs) {
    try {
      const response = await fetch('http://localhost:5000/api/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(job),
      });

      if (response.ok) {
        console.log(`✓ Created job ${job.jobNumber}: ${job.description}`);
        results.created++;
      } else {
        const error = await response.json();
        console.log(`✗ Failed to create job ${job.jobNumber}: ${JSON.stringify(error)}`);
        results.failed++;
        results.errors.push(`${job.jobNumber}: ${error.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.log(`✗ Error creating job ${job.jobNumber}: ${error.message}`);
      results.failed++;
      results.errors.push(`${job.jobNumber}: ${error.message}`);
    }
  }

  console.log('\n=== Job Creation Summary ===');
  console.log(`✓ Successfully created: ${results.created} jobs`);
  console.log(`✗ Failed to create: ${results.failed} jobs`);
  
  if (results.errors.length > 0) {
    console.log('\nErrors encountered:');
    results.errors.forEach(error => console.log(`  - ${error}`));
  }
  
  console.log('\n=== Routing Variety Summary ===');
  console.log('- 15 Simple Mill jobs (1-2 operations)');
  console.log('- 12 Simple Lathe jobs (1-2 operations)');
  console.log('- 8 Bar Fed Lathe jobs (specialized routing)');
  console.log('- 10 Complex Multi-Op jobs (3-4 operations each)');
  console.log('- 3 Inspection Only jobs');
  console.log('- 2 Wire EDM jobs (if EDM machines exist)');
  console.log('\nYou can now test the "Schedule All" button to see intelligent scheduling in action!');
  console.log('Each job has realistic routing with proper machine compatibility.');
}

createJobs().catch(console.error);