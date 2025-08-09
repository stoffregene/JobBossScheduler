# Lean Scheduling System Documentation

## Overview

The JobBoss Scheduler implements a comprehensive lean scheduling system designed to minimize the 8 wastes of Lean manufacturing, with particular focus on preventing overproduction and optimizing external lead time management.

## Core Principles

### 1. Pull-Based Scheduling
- Jobs are scheduled based on **actual customer demand** (`promisedDate`)
- **External lead times** are the primary constraint, not internal capacity
- **Stock jobs** are scheduled last to prevent overproduction

### 2. External Lead Time Management
- **Lead time** = Time for outsourced operations to return (e.g., 21 days for Gerard)
- Jobs with longer external lead times get **higher priority**
- System calculates **required start dates** backwards from promise dates

### 3. Waste Prevention Strategies

#### Overproduction Prevention
- Stock priority jobs scheduled **last** and only when capacity available
- Maximum 10% of capacity allocated to stock jobs
- Promise date-driven scheduling, not due date-driven

#### Inventory/WIP Reduction
- Shorter jobs scheduled first to reduce work-in-process
- Internal operations prioritized over external dependencies
- Bottleneck (HMC) operations scheduled early

#### Waiting Time Reduction
- Jobs grouped by machine type to minimize setup time
- Vendor coordination for outsourced operations
- Material-based scheduling when possible

## Scheduling Algorithm

### Priority Order (Lowest Number = Highest Priority)

1. **Critical** - Customer emergencies
2. **High** - Rush orders  
3. **Normal** - Standard orders
4. **Stock** - Inventory (scheduled last to prevent overproduction)

### Sorting Criteria (in order of application)

1. **Priority** (Critical > High > Normal > Stock)
2. **External Lead Time** (longer lead times first)
3. **Promise Date** (earliest first)
4. **Internal vs External** (internal operations first)
5. **Customer Priority** (MAREL POUL > VERMEER > ACCU MOLD > NCS INC > STOCK)
6. **Bottleneck Operations** (HMC operations first)
7. **Total Hours** (shorter jobs first to reduce WIP)
8. **FIFO** (order date for tie-breaking)

## External Lead Time Management

### Lead Time Calculation
```typescript
// Calculate when job must start to meet promise date
const requiredStartDate = new Date(job.promisedDate);
requiredStartDate.setDate(requiredStartDate.getDate() - maxExternalLeadTime);

// Calculate buffer
const buffer = availableTime - totalRequiredTime;
const isAtRisk = availableTime < totalRequiredTime;
```

### Vendor Lead Times
- **GERARD**: 14 days
- **A-1 LAPPIN**: 20 days
- **ADV PLATIN**: 3-10 days
- **FITZGERALD**: 16 days

### Vendor Coordination
- Jobs grouped by vendor for optimal shipment batching
- Shipment sizes optimized based on vendor capacity and lead time
- Vendor-specific adjustments for shipment frequency

## Implementation Details

### Key Files

#### `server/lean-scheduler.ts`
Main lean scheduling implementation with:
- `comprehensiveLeanSchedule()` - Primary scheduling function
- `calculateLeadTimeBuffer()` - Lead time buffer calculations
- `optimizeVendorShipments()` - Vendor coordination
- `calculateLeanMetrics()` - Performance metrics

#### `server/auto-scheduler.ts`
Main scheduling system currently in use:
- Contains `scheduleJob()` and `scheduleJobsByPriority()` functions
- Integrates lean scheduling algorithm from `lean-scheduler.ts`
- Logs lean metrics and risk assessments
- Maintains backward compatibility

#### `server/legacy-scheduler.ts` (Unused)
Legacy `JobScheduler` class that's not currently used by the system

### Data Structures

#### `LeanSchedulingJob`
Extends base `Job` with lean-specific fields:
```typescript
interface LeanSchedulingJob extends Job {
  requiredStartDate?: Date;
  externalLeadTime?: number;
  leadTimeBuffer?: number;
  isAtRisk?: boolean;
  vendorGroups?: string[];
  totalInternalHours?: number;
  totalExternalHours?: number;
}
```

#### `LeanMetrics`
Performance tracking metrics:
```typescript
interface LeanMetrics {
  taktTime: number;
  cycleTime: number;
  wip: number;
  bottleneckUtilization: number;
  onTimeDelivery: number;
  externalLeadTimeUtilization: number;
  vendorShipmentEfficiency: number;
  externalDependencyRisk: number;
  leadTimeBuffer: number;
  atRiskJobs: number;
  vendorOnTimeDelivery: number;
  vendorLeadTimeVariance: number;
}
```

## Lean Metrics Explained

### Takt Time
- **Definition**: Available time / Customer demand
- **Purpose**: Sets the pace of production to match customer demand
- **Calculation**: 40 hours per week / total jobs

### Cycle Time
- **Definition**: Average time to complete a job
- **Purpose**: Measures actual production efficiency
- **Calculation**: Total internal hours / number of jobs

### WIP (Work in Process)
- **Definition**: Number of jobs currently being processed
- **Purpose**: Monitors inventory levels in production
- **Target**: Minimize WIP to reduce waste

### Bottleneck Utilization
- **Definition**: Percentage of jobs requiring HMC operations
- **Purpose**: Identifies constraint utilization
- **Target**: Optimize bottleneck scheduling

### External Dependency Risk
- **Definition**: Percentage of jobs at risk due to insufficient lead time
- **Purpose**: Monitors external supply chain risk
- **Target**: Minimize at-risk jobs

## Usage Examples

### Basic Lean Scheduling
```typescript
import { comprehensiveLeanSchedule } from './lean-scheduler';

const jobs = await getJobs();
const leanScheduledJobs = comprehensiveLeanSchedule(jobs);
```

### Calculate Metrics
```typescript
import { calculateLeanMetrics } from './lean-scheduler';

const metrics = calculateLeanMetrics(leanScheduledJobs);
console.log('On-time delivery:', metrics.onTimeDelivery);
console.log('At-risk jobs:', metrics.atRiskJobs);
```

### Vendor Coordination
```typescript
import { optimizeVendorShipments } from './lean-scheduler';

const vendorBatches = optimizeVendorShipments(leanScheduledJobs);
console.log('Vendor batches:', Object.keys(vendorBatches));
```

## CSV Data Mapping

### Date Fields
- `due_date` → `dueDate` - When job is due (used for individual routing operations)
- `created_date` → `createdDate` - When job was created in system
- `order_date` → `orderDate` - When job was ordered (FIFO basis)
- `promised_date` → `promisedDate` - Customer commitment (primary scheduling driver for jobs)

### External Lead Time
- `lead_days` → `leadDays` - External vendor lead time in days
- Used to calculate required start dates
- Longer lead times get higher scheduling priority

### Priority Mapping
- `priority` → `priority` - Critical, High, Normal, Stock
- Stock jobs scheduled last to prevent overproduction

## Best Practices

### 1. Monitor Lead Time Buffers
- Regularly check `isAtRisk` jobs
- Adjust scheduling for jobs with negative buffers
- Consider expediting at-risk jobs

### 2. Vendor Performance Tracking
- Monitor vendor on-time delivery
- Track lead time variance
- Optimize shipment frequencies

### 3. Capacity Management
- Don't schedule beyond available capacity
- Reserve capacity for emergency jobs
- Limit stock job allocation to 10%

### 4. Continuous Improvement
- Track lean metrics over time
- Identify trends in external dependencies
- Optimize vendor relationships

## Troubleshooting

### Common Issues

#### High External Dependency Risk
- **Cause**: Too many jobs with insufficient lead time buffer
- **Solution**: Schedule jobs with longer lead times earlier

#### Low On-Time Delivery
- **Cause**: Jobs not starting early enough for external operations
- **Solution**: Review lead time calculations and vendor performance

#### High WIP
- **Cause**: Too many jobs in process simultaneously
- **Solution**: Schedule shorter jobs first, reduce batch sizes

#### Overproduction
- **Cause**: Stock jobs consuming too much capacity
- **Solution**: Reduce stock job allocation, prioritize customer orders

### Debugging

#### Enable Detailed Logging
```typescript
// Lean scheduling logs are automatically generated
console.log('📊 Lean Metrics:', leanMetrics);
console.log('📦 External lead time:', job.externalLeadTime);
console.log('⚠️ At risk job:', job.isAtRisk);
```

#### Check Lead Time Calculations
```typescript
const bufferInfo = calculateLeadTimeBuffer(job);
console.log('Buffer info:', bufferInfo);
```

## Recent Changes

### Comprehensive Job Creation Modal (Latest)
- **Enhanced Add Job Interface**: Completely redesigned the job creation modal with comprehensive fields
- **Promised Date Focus**: Changed from "Due Date" to "Promised Date" as the primary scheduling driver (aligns with lean principles)
- **Complete Job Information**:
  - Basic Information: Job Number, Part Number, Description, Customer, Quantity
  - Scheduling Information: Promised Date, Priority (including Stock), Total Estimated Hours, External Lead Days
  - Material & Vendor Information: Material type, Outsourced Vendor selection with lead times
  - Routing Operations: Full routing definition with operation names, machine types, hours, setup time, and notes
- **Routing Operations Management**:
  - Add/remove individual operations
  - Specify machine types (Mill, Lathe, Saw, Weld, Inspect, Outsource)
  - Set estimated hours and setup time per operation
  - Add operation-specific notes
  - Automatic operation sequencing
- **Vendor Integration**: Pre-configured vendor options with lead times (GERARD: 14 days, A-1 LAPPIN: 20 days, etc.)
- **Lean Compliance**: Maintains focus on promised dates and external lead time management

### Visual Management for Overdue Stock Jobs
- **Enhanced Visual Indicators**: Added special visual treatment for overdue stock jobs in the job queue
- **Stock Job Overdue Levels**:
  - **>30 days overdue**: Red background with "CRITICAL STOCK" label
  - **>7 days overdue**: Orange background with "Stock Overdue" label  
  - **<7 days overdue**: Yellow background with "Stock" label
- **Job Type Badges**: Added visual badges to identify STOCK and REWORK jobs in the priority column
- **Color-Coded Priority System**: Stock jobs maintain "Low" priority but get visual escalation for overdue status
- **Lean Compliance**: Maintains pull-based scheduling while providing visual management for inventory planning

### Priority Calculation Fix
- **Fixed PriorityManager Integration**: Updated `updateAllJobPriorities()` to use the `PriorityManager` class instead of simple date-based calculation
- **Stock Job Recognition**: Jobs starting with "S" are now correctly identified as stock jobs and assigned "Low" priority (score 100)
- **Rework Job Support**: Added support for jobs starting with "R" to be identified as rework jobs with priority score 150
- **Priority Score Mapping**: 
  - 500+ = Critical (LATE_TO_CUSTOMER)
  - 400+ = High (LATE_TO_US) 
  - 300+ = High (NEARING_SHIP_DATE)
  - 200+ = Normal (NORMAL)
  - 150+ = Low (REWORK)
  - 100+ = Low (STOCK)
- **All Jobs Updated**: Priority updates now apply to all jobs regardless of scheduling status

### Frontend Date Display Updates
- **Job Queue**: Now displays "Promised Date" instead of "Due Date" for jobs
- **Job Details**: Shows promised date as the primary customer commitment
- **Material Tracking**: Uses promised dates for job-level scheduling
- **Due Dates**: Reserved for individual routing operations (e.g., "op 20 - mill has a due date of 8/10/25")
- **Priority Calculation**: Based on promised dates, not due dates
- **CSV Import**: Validates promised_date as required field

These changes align with lean manufacturing principles by focusing on customer commitments rather than internal deadlines and properly prioritizing stock jobs last to prevent overproduction.

## Future Enhancements

### Planned Features
1. **Dynamic Lead Time Updates** - Real-time vendor lead time adjustments
2. **Material Flow Optimization** - Group jobs by material type
3. **Setup Time Reduction** - Machine-specific setup time calculations
4. **Advanced Vendor Coordination** - Automated shipment scheduling
5. **Predictive Analytics** - Forecast lead time risks

### Integration Points
1. **ERP Integration** - Real-time job status updates
2. **Vendor Portal** - Direct vendor communication
3. **Customer Portal** - Real-time delivery updates
4. **Mobile App** - Field operator access

## Conclusion

The lean scheduling system prioritizes **external lead time management** and **waste prevention** over traditional capacity optimization. By focusing on **pull-based scheduling** and **external dependency management**, the system aligns with lean manufacturing principles while addressing the real constraints of outsourced operations.

The key insight is that **external lead time is the real bottleneck**, not internal machine capacity. The system schedules backwards from promise dates to ensure external operations start early enough, preventing the waste of waiting and ensuring on-time delivery to customers.
