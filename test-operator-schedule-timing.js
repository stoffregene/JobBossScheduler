#!/usr/bin/env node

/**
 * Test operator scheduling timing to verify jobs are scheduled during actual work hours
 */

import { DatabaseStorage } from './server/database-storage.js';

async function testOperatorScheduleTiming() {
  console.log('🕐 TESTING OPERATOR SCHEDULE TIMING');
  console.log('=' .repeat(60));
  
  const storage = new DatabaseStorage();
  
  try {
    // Create a simple test job
    const testJob = {
      jobNumber: `TIMING-TEST-${Date.now()}`,
      partNumber: 'TIMING-001',
      customer: 'Test Customer',
      description: 'Test job for operator timing verification',
      quantity: 1,
      dueDate: new Date('2025-08-15'),
      orderDate: new Date(),
      promisedDate: new Date('2025-08-15'),
      priority: 'Normal',
      status: 'Open',
      routing: [
        {
          sequence: 10,
          operation: 'PRODUCTION',
          machineType: 'LATHE',
          name: 'LATHE',
          standardTime: 2.0,
          setupTime: 0.5,
          estimatedHours: 2.5,
          compatibleMachines: ['LATHE-001'],
          outsource: false
        }
      ]
    };

    console.log('\n📋 Creating test job...');
    const createdJob = await storage.createJob(testJob);
    console.log(`✅ Created job: ${createdJob.jobNumber} (ID: ${createdJob.id})`);

    console.log('\n🚀 Auto-scheduling job...');
    const schedulingResult = await storage.autoScheduleJob(createdJob.id);
    
    if (schedulingResult.success && schedulingResult.scheduleEntries) {
      console.log(`✅ Job scheduled successfully: ${schedulingResult.scheduleEntries.length} operations`);
      
      // Check the schedule entries
      for (const entry of schedulingResult.scheduleEntries) {
        console.log('\n📅 Schedule Entry Details:');
        console.log(`   Operation: ${entry.operationSequence}`);
        console.log(`   Machine: ${entry.machineId}`);
        console.log(`   Resource: ${entry.assignedResourceId}`);
        console.log(`   Start Time: ${new Date(entry.startTime).toLocaleString('en-US', {timeZone: 'America/Chicago'})}`);
        console.log(`   End Time: ${new Date(entry.endTime).toLocaleString('en-US', {timeZone: 'America/Chicago'})}`);
        console.log(`   Shift: ${entry.shift}`);
        
        // Get resource details to verify work hours
        if (entry.assignedResourceId) {
          const resource = await storage.getResource(entry.assignedResourceId);
          if (resource) {
            console.log(`   🧑‍💼 Assigned to: ${resource.name} (${resource.role})`);
            
            // Check if this is during the resource's work hours
            const startDate = new Date(entry.startTime);
            const workTimes = await storage.getResourceWorkTimes(resource, startDate);
            
            if (workTimes) {
              const startHour = startDate.getHours();
              const workStartHour = workTimes.startTime.getHours();
              const workEndHour = workTimes.endTime.getHours();
              
              console.log(`   ⏰ Resource work hours: ${workTimes.startTime.toLocaleTimeString()} - ${workTimes.endTime.toLocaleTimeString()}`);
              
              if (startHour >= workStartHour && startHour < workEndHour) {
                console.log(`   ✅ TIMING CORRECT: Job scheduled during ${resource.name}'s work hours`);
              } else {
                console.log(`   ❌ TIMING ERROR: Job scheduled outside ${resource.name}'s work hours!`);
                console.log(`       Job starts at ${startHour}:00, but ${resource.name} works ${workStartHour}:00-${workEndHour}:00`);
              }
            } else {
              console.log(`   ⚠️ Resource ${resource.name} not scheduled to work on this date`);
            }
          }
        }
      }
    } else {
      console.log('❌ Scheduling failed:', schedulingResult.failureReason);
      if (schedulingResult.failureDetails) {
        console.log('   Details:', schedulingResult.failureDetails);
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error(error.stack);
  }
}

testOperatorScheduleTiming().catch(console.error);