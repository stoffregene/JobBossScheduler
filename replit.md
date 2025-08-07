# Manufacturing Resource Planning (MRP) System

## Overview
This is a comprehensive Manufacturing Resource Planning (MRP) system designed for real-time job scheduling, machine monitoring, resource allocation, and production management in manufacturing operations. The system aims to provide a modern full-stack solution to optimize production workflows, manage resources efficiently, and provide real-time insights into manufacturing processes, ultimately enhancing operational efficiency and enabling data-driven decision-making in manufacturing.

## User Preferences
Preferred communication style: Simple, everyday language.

## AI Agent Instructions

### Prompt: Implement Shift Capacity Load Balancing
This update implements a new shift-based load balancing system to distribute work more evenly between the 1st and 2nd shifts based on their relative capacity and efficiency.

This update requires creating one new file, replacing one existing file, and updating one API endpoint.

## Recent Changes

**August 7, 2025** - OPERATOR HIERARCHY AND UI FIXES: Fixed critical scheduler bug and enhanced chunked operation display:

**🔧 OPERATOR SELECTION HIERARCHY**:
- **ROLE PRIORITIZATION**: Enhanced scheduler to prefer Operators > Shift Leads > Supervisors when assigning resources
- **FIXED SUPERVISOR OVERUSE**: Resolved issue where supervisors were assigned instead of available operators
- **SEQUENCE MAPPING BUG**: Fixed critical scheduler bug where operation sequence 0 was incorrectly converted to 10
- **CHUNKED OPERATION DISPLAY**: Enhanced job details modal to properly display multi-chunk operations with full timing breakdown
- **TIMEZONE CONSISTENCY**: All schedule times properly display in US Central timezone with correct chunking details

**August 7, 2025** - DATABASE FOREIGN KEY CONSTRAINT FIX: Resolved critical foreign key violation when deleting jobs by clearing dependent records in proper order:

**🔧 DATABASE INTEGRITY FIX**:
- **FOREIGN KEY HANDLING**: Fixed delete jobs functionality to properly handle material_orders, alerts, routing_operations, and outsourced_operations constraints  
- **TRANSACTION SAFETY**: Updated deleteAllJobs to clear all dependent records before removing jobs to prevent constraint violations
- **MANUAL CLEANUP**: Temporarily used direct SQL commands to clear database and verify system functionality
- **DELETE FUNCTIONALITY**: Frontend delete all jobs button now works correctly without foreign key constraint errors
- **CLEAN SLATE TESTING**: Database cleared successfully allowing fresh testing of shift-based load balancing system

**August 7, 2025** - SHIFT-BASED LOAD BALANCING IMPLEMENTATION: Enhanced scheduling system with intelligent shift capacity management and optimal resource distribution:

**🎯 INTELLIGENT SHIFT LOAD BALANCING**:
- **SHIFTCAPACITYMANAGER ENHANCEMENT**: Added `addEntries()` method to dynamically update capacity tracking during job scheduling
- **OPTIMAL SHIFT SELECTION**: Scheduler now uses ShiftCapacityManager to determine optimal shift assignment based on current load percentages
- **ENHANCED API INTEGRATION**: Schedule-all endpoint properly integrates with ShiftCapacityManager for real-time capacity tracking
- **AUTOMATIC LOAD DISTRIBUTION**: Jobs automatically assigned to shift with lower load percentage to balance manufacturing capacity
- **DYNAMIC CAPACITY UPDATES**: System updates shift capacity metrics as each job is scheduled, ensuring optimal distribution

**August 7, 2025** - ADVANCED SCHEDULING ALGORITHM IMPLEMENTATION: Completely rebuilt scheduling system with sophisticated priority management, campaign batching, and inspection queue handling:

**🚀 COMPREHENSIVE SCHEDULING OVERHAUL**:
- **SCHEDULING LOGGER**: New structured logging system with collapsible job-based log grouping for clear scheduling visibility
- **CAMPAIGN MANAGER**: Intelligent batching of outsourced operations into shipping campaigns with vendor consolidation and optimal timing
- **PRIORITY MANAGER**: Enhanced business logic for job priority scoring including late-to-customer, late-to-us, nearing-ship-date, and stock priorities
- **ROBUST JOB SCHEDULER**: Complete scheduling engine with operation chunking, resource locking, and boundary time management
- **INSPECTION QUEUE WIDGET**: New "Jobs Awaiting Inspection" component tracking quality control workflow with real-time updates
- **DEPENDENCY MANAGEMENT**: Smart handling of outsourced operation dependencies with promise date validation and warning systems

**August 6, 2025** - YEAR-ROUND OPERATOR AVAILABILITY SYSTEM COMPLETED: Implemented comprehensive year-round operator scheduling with full auto-scheduling algorithm integration:

**🎯 COMPREHENSIVE AVAILABILITY SYSTEM**:
- **OPERATORAVAILABILITYMANAGER**: New service class providing year-round operator scheduling logic with real-time availability checking
- **AUTO-SCHEDULING INTEGRATION**: Scheduling algorithm now uses comprehensive operator availability instead of basic weekly patterns
- **INTELLIGENT RESOURCE ASSIGNMENT**: Enhanced resource assignment with unavailability checking, custom work schedules, and shift compatibility
- **API ENDPOINTS**: Complete RESTful API coverage for operator availability queries and schedule analysis
- **DATABASE AUTO-REFRESH**: Automatic refresh of availability manager when resource or unavailability data changes

**August 6, 2025** - OPERATOR UNAVAILABILITY VISUALIZATION FIXED: Operators marked as unavailable now display red "Unavailable" blocks during their scheduled work times instead of disappearing from the view:

**🔴 UNAVAILABILITY DISPLAY ENHANCEMENT**:
- **RED UNAVAILABLE BLOCKS**: When operators are marked out (vacation/sick), their normally scheduled work time now displays as red "Unavailable" blocks
- **PROPER SCHEDULE PRESERVATION**: System shows operator's actual work schedule times in red rather than removing them completely
- **CROSS-DAY SHIFT SUPPORT**: Unavailable blocks properly handle 2nd shift spans (3 PM to 3 AM next day) with correct multi-day visualization
- **PARTIAL/FULL DAY HANDLING**: Supports both partial day unavailability (specific hours) and full day unavailability (entire scheduled shift)
- **VISUAL CONSISTENCY**: Red blocks match legend and provide clear distinction from working time blocks (blue/green)

**August 6, 2025** - CRITICAL INFINITE LOOP RESOLUTION: Completely eliminated all infinite loops in resource scheduling with comprehensive protection systems:

**🛡️ COMPREHENSIVE LOOP PROTECTION**:
- **MULTI-SHIFT LIMITS**: Added 50-attempt maximum for multi-day job scheduling to prevent infinite resource assignment loops
- **DAY-SKIPPING LIMITS**: Limited resource availability checking to 10-day maximum to prevent endless date searching  
- **OUTER LOOP LIMITS**: Added 30-attempt maximum for main date-iteration loop to prevent scheduling deadlocks
- **PROPER BREAK CONDITIONS**: Multi-shift failures now properly exit loops and advance to next available dates/shifts
- **LOG SPAM PREVENTION**: Added intelligent log caching to prevent infinite console flooding while maintaining diagnostic visibility

**August 6, 2025** - CRITICAL SCHEDULING ALGORITHM FIXES: Fixed status filtering and implemented custom work schedule support to eliminate incorrect job times:

**🔧 CUSTOM WORK SCHEDULE IMPLEMENTATION**:
- **STATUS FILTERING**: Fixed schedule view to only display jobs with "Scheduled" status (eliminated "Open" jobs appearing on calendar)
- **CUSTOM WORK TIMES**: Added `getResourceWorkTimes()` function to extract individual resource work schedules (e.g., Mike's 5:00 AM - 4:00 PM)
- **ENHANCED SCHEDULING**: Updated algorithm to use custom work schedule times instead of generic 3:00 AM - 3:00 PM shift times
- **MULTI-DAY JOBS**: Enhanced multi-day job logic to span consecutive days within custom work windows (26.7-hour jobs use daily 11-hour segments)
- **WEEKEND SKIPPING**: Updated day-skipping logic to respect individual resource availability (Mike works Monday-Thursday only)

**August 5, 2025** - CRITICAL RESOURCE ALLOCATION BUG FIXED: Eliminated resource double-booking in auto-scheduler to enforce fundamental manufacturing constraint:

**🔧 RESOURCE CONFLICT RESOLUTION**:
- **ONE RESOURCE = ONE MACHINE**: Fixed critical bug where same employee was assigned to multiple machines simultaneously
- **TIME-BASED AVAILABILITY**: Added `isResourceAvailableAtTime()` method to check for scheduling conflicts before resource assignment
- **ENHANCED ASSIGNOPTIMALRESOURCE**: Updated resource assignment logic to validate availability during target time periods
- **SCHEDULE REBUILD**: Cleared existing conflicted schedule and rebuilt with new conflict checking logic
- **ZERO CONFLICTS VERIFIED**: Confirmed no resource double-booking exists in current schedule

**August 5, 2025** - CALENDAR VIEWS ENHANCED: Added hourly, daily, weekly, and monthly calendar perspectives for comprehensive schedule management:

**📅 MULTIPLE CALENDAR VIEWS**:
- **HOURLY VIEW**: 24-hour breakdown of single day with precise job timing
- **DAILY VIEW**: Single day focus with detailed job information  
- **WEEKLY VIEW**: Traditional 7-day view with optimized layout
- **MONTHLY VIEW**: 35-day calendar grid for long-term planning
- **SMART NAVIGATION**: View-specific time navigation (hour→day, day→day, week→week, month→month)
- **ADAPTIVE HEADERS**: Time displays adjust per view type (12 AM/PM for hourly, full dates for daily)

**August 5, 2025** - MULTI-DAY JOB VISUALIZATION ENHANCED: Improved schedule display with staggered job blocks, US Central timezone, and expandable day functionality:

**📅 ADVANCED SCHEDULE VISUALIZATION**:
- **MULTI-DAY BLOCKS**: Jobs spanning multiple days now show blocks on ALL affected days with visual start/continuation/end indicators (▶ ◆ ◀)
- **STAGGERED POSITIONING**: Job blocks show actual start/end times within each day using calculated positioning and partial widths
- **EXPANDABLE DAYS**: Added clickable "+X more" functionality to expand crowded days and view all scheduled jobs
- **US CENTRAL TIMEZONE**: Fixed job details modal to display all dates/times in America/Chicago timezone consistently
- **VISUAL INDICATORS**: Clear border styles distinguish multi-day job segments (rounded start, straight continuation, rounded end)

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript and Vite.
- **UI Framework**: shadcn/ui built on Radix UI.
- **Styling**: Tailwind CSS with custom manufacturing themes.
- **State Management**: TanStack Query for server state.
- **Routing**: Wouter.
- **Real-time Updates**: WebSocket integration for live data synchronization.
- **UI/UX Decisions**: Clear visual indicators for scheduling, multi-day jobs, and capacity constraints. Color coding for shifts and accessibility. Fullscreen support with proper scrolling and sticky headers. Multiple calendar views (hourly, daily, weekly, monthly) for comprehensive schedule perspectives.

### Backend Architecture
- **Runtime**: Node.js with Express.js.
- **Language**: TypeScript with ES modules.
- **API Pattern**: RESTful API with WebSocket support.
- **Data Storage**: In-memory storage with an interface for future persistent database integration.
- **Session Management**: Express sessions.

### Data Storage Solutions
- **Database**: PostgreSQL with Drizzle ORM.
- **Schema**: Comprehensive manufacturing schema (jobs, machines, schedule entries, material orders, alerts).
- **Machine Tiers**: Premium, Standard, Budget with efficiency and substitution.
- **Advanced Scheduling Logic**:
    - **Priority Scoring System**: Jobs prioritized by business rules (Late to Customer: 500pts, Late to Us: 400pts, Nearing Ship: 300pts, Normal: 200pts, Stock: 100pts)
    - **Campaign Batching**: Outsourced operations automatically grouped into vendor-specific shipping campaigns with optimal timing
    - **Dependency Management**: Smart handling of outsourced operation dependencies with return date validation and promise date checking
    - **Operation Chunking**: Complex operations split across multiple time slots with resource continuity and availability checking
    - **Inspection Queue**: Automatic detection of jobs ready for quality control with real-time dashboard widget
    - **Structured Logging**: Comprehensive job-based logging with collapsible console groups for debugging scheduling decisions
    - **Boundary Time Management**: Forward and backward scheduling with configurable start dates and dependency constraints
    - **Year-Round Availability**: OperatorAvailabilityManager provides comprehensive operator scheduling with custom work schedules, unavailability periods, and real-time availability checks
- **Resource Capacity Tracking**: Accounts for unavailability with year-round scheduling precision.
- **Migrations**: Drizzle Kit.

### Real-time Communication
- **WebSocket Server**: For real-time updates.
- **Event Broadcasting**: Automatic client notification for updates.

### Authentication and Authorization
- **Session-based**: Express sessions with secure cookies.

## External Dependencies

### Database Services
- **Neon Database**: Serverless PostgreSQL hosting.
- **Drizzle ORM**: Type-safe database toolkit.

### UI and Styling Dependencies
- **shadcn/ui**: Component library.
- **Radix UI**: Headless UI primitives.
- **Tailwind CSS**: Utility-first CSS framework.
- **Lucide React**: Icon library.

### Development and Build Tools
- **Vite**: Fast build tool.
- **TypeScript**: Type safety.
- **Replit Integration**: Native development environment support.

### Third-party Integrations
- **React Hook Form**: Form state management.
- **React Query**: Server state synchronization and caching.
- **Date-fns**: Date manipulation.
- **Zod**: Runtime type validation.
- **Class Variance Authority**: Type-safe component variants.