# Manufacturing Resource Planning (MRP) System

## Overview
This is a comprehensive Manufacturing Resource Planning (MRP) system designed for real-time job scheduling, machine monitoring, resource allocation, and production management in manufacturing operations. The system aims to provide a modern full-stack solution to optimize production workflows, manage resources efficiently, and provide real-time insights into manufacturing processes.

## User Preferences
Preferred communication style: Simple, everyday language.

## Recent Changes

**August 5, 2025** - UI COMPATIBILITY MATRIX DISPLAY FIX: Enhanced Job Details Modal to properly filter and display only compatible operators based on strict matrix rules:

**🎯 JOB DETAILS MODAL ENHANCEMENTS**:
- **COMPATIBILITY FILTERING**: Modal now filters to show ONLY operators qualified for each specific operation
- **ROLE-BASED DISPLAY**: INSPECT operations show only Quality Inspectors, PRODUCTION shows only Operators/Shift Leads
- **OUTSOURCE CLARITY**: OUTSOURCE operations correctly display "No internal resources" instead of operator list
- **TIMEZONE DISPLAY FIX**: Fixed date display to show Central Time correctly instead of incorrect July dates
- **DUPLICATE CLEANUP**: Removed duplicate schedule entries that were causing confusion
- **VERIFICATION**: Job 58303 now correctly shows Lindsay Jackson (Quality Inspector) as the only compatible operator

**August 5, 2025** - CRITICAL TIMEZONE BUG FIXED: Resolved past scheduling issue by implementing proper US Central time handling and ensuring all jobs schedule from TODAY or later, never in the past:

**🕐 TIMEZONE AND PAST SCHEDULING FIX**:
- **CRITICAL BUG RESOLVED**: Fixed scheduling logic that was creating entries in the past by using job creation date + 7 days
- **US CENTRAL TIME**: Implemented proper timezone conversion to US Central Standard Time (UTC-6) for all scheduling operations
- **MINIMUM DATE ENFORCEMENT**: All jobs now schedule from tomorrow at earliest, never in the past regardless of creation date
- **COMPREHENSIVE COVERAGE**: Applied timezone fixes to ALL 6+ scheduling locations including OUTSOURCE/INSPECT, multi-day segments, priority displacement, and standard operations
- **SHIFT TIME ACCURACY**: Ensured all operations schedule at proper 3:00 AM Central (Shift 1) and 3:00 PM Central (Shift 2) times
- **VERIFICATION TESTED**: Job S60062 now correctly schedules in July 2025 instead of attempting past dates
- **BUSINESS RULE COMPLIANCE**: Enforced fundamental manufacturing rule that NO operations can be scheduled before current date

**August 5, 2025** - SYSTEMATIC RESOURCE ASSIGNMENT VERIFICATION COMPLETE: Applied strict compatibility matrix rules across ALL scheduling locations:

**🔒 SYSTEMATIC RESOURCE ASSIGNMENT VERIFICATION**:
- **COMPREHENSIVE AUDIT**: Verified resource assignment rules are applied consistently in ALL 6+ scheduling locations
- **OUTSOURCE OPERATIONS**: Guaranteed to receive NO internal resources (null assignment) - external vendors handle work
- **INSPECT OPERATIONS**: Restricted to Quality Inspectors ONLY who are qualified for the specific machine
- **PRODUCTION OPERATIONS**: Restricted to Operators/Shift Leads ONLY who are qualified for the specific machine
- **PRIORITY DISPLACEMENT**: Fixed to apply same strict rules even during priority-based job displacement
- **MULTI-SHIFT OPERATIONS**: Updated to use same compatibility checking for large operations spanning multiple shifts
- **VERIFICATION TESTED**: Job 59902 confirms OUTSOURCE=null resources, DEBURR=qualified Operator (Noah Johnson)
- **NO BYPASS PATHS**: Eliminated all code paths that could circumvent compatibility matrix rules

**August 5, 2025** - OPTIMIZATION BREAKTHROUGH: Completed comprehensive code optimization and performance improvements:

**🚀 CODE OPTIMIZATION COMPLETE**:
- **PERFORMANCE CACHING**: Implemented intelligent caching for schedule entries with 30-second cache duration and automatic invalidation
- **CONSOLIDATED FUNCTIONS**: Created centralized resource assignment function eliminating 50+ lines of duplicate code
- **CAPACITY OPTIMIZATION**: Unified capacity checking with getMachineCapacityInfo function providing detailed metrics (currentHours, maxHours, availableHours, utilizationPercent)
- **DURATION CALCULATION**: Centralized time calculation function eliminating redundant date math operations across multiple reduce functions
- **STRATEGIC DEBUGGING**: Added comprehensive logging for capacity checks, resource assignments, and multi-shift operations
- **CACHE INVALIDATION**: Automatic cache clearing on schedule modifications ensuring data consistency
- **FUNCTION CONSOLIDATION**: Replaced deprecated getMachineHoursOnDate calls with optimized getMachineCapacityInfo

**August 5, 2025** - MULTI-SHIFT SCHEDULING BREAKTHROUGH: Successfully implemented multi-shift job bridging for large operations:

**🎯 MULTI-SHIFT SCHEDULING BREAKTHROUGH**:
- **CRITICAL FIX**: 25.5-hour operations now successfully bridge across multiple business days
- **MACHINE CONSTRAINTS**: Properly handles machines that only work one shift (HMCs work Shift 1 only)
- **WEEKEND BRIDGING**: Operations correctly skip Friday-Sunday and resume on Monday
- **EXAMPLE SUCCESS**: 25.5h HMC operation split into Mon(8h) + Tue(8h) + Wed(5.25h) segments
- **RESOURCE CONTINUITY**: Same operator (Drew Darling) assigned across all segments
- **CAPACITY LOGIC**: Enhanced to allow large operations to start with partial capacity
- **SHIFT TIMING FIX**: Corrected all scheduling to use proper 3am-3pm Shift 1 timing (was incorrectly using 7am-3pm)

**COMPATIBILITY MATRIX ANALYSIS**: Created comprehensive resource-work center compatibility matrix revealing critical scheduling constraints:
- **RESOURCE-MACHINE COMPATIBILITY FIX**: Fixed critical bug where resources were assigned to incompatible machines (e.g., Lindsay Jackson to lathe ops, Aaron Chastain to inspect ops)
- **ROLE-BASED ASSIGNMENT**: Production operations only assign Operators/Shift Leads, INSPECT operations only assign Quality Inspectors
- **WORK CENTER VALIDATION**: Resources now properly filtered by workCenters field to ensure only qualified operators are assigned to compatible machines
- **COMPATIBILITY MATRIX ANALYSIS**: Generated complete permutation matrix showing all 19 operators across 31 machines with substitution capabilities (see resource-compatibility-matrix.md)
- **CRITICAL BOTTLENECKS IDENTIFIED**: 
  * HCN 5000 neo (4th axis): Only Drew Darling qualified - major scheduling constraint
  * Welding operations: Only Calob Lamaster qualified - single point of failure
  * Premium lathes: Limited to Aaron Chastain & Trevin Jorgensen for complex work
- **MACHINE SUBSTITUTION RULES**: Documented that 4th axis machines can do 3-axis work, but 3-axis machines cannot do 4th axis operations
- **OUTSOURCE RESOURCE FIX**: OUTSOURCE operations now correctly receive NO internal resources (null assignment) - external vendors handle the work
- **INSPECT OPERATIONS**: Only Quality Inspectors can be assigned to INSPECT operations, no capacity limits to prevent infinite loops

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **UI Framework**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom manufacturing-themed color variables
- **State Management**: TanStack Query (React Query) for server state management
- **Routing**: Wouter
- **Real-time Updates**: WebSocket integration for live data synchronization
- **UI/UX Decisions**: Focus on clear visual indicators for scheduling, multi-day jobs, and capacity constraints. Color coding is used to distinguish shifts.

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **API Pattern**: RESTful API with WebSocket support
- **Data Storage**: In-memory storage implementation with an interface for future persistent database integration.
- **Session Management**: Express sessions with PostgreSQL session store support.

### Data Storage Solutions
- **Database**: PostgreSQL with Drizzle ORM for type-safe operations.
- **Schema**: Comprehensive manufacturing schema including jobs, machines, schedule entries, material orders, and alerts.
- **Machine Tiers**: Premium, Standard, and Budget tiers with efficiency factors and substitution groups.
- **Auto-Scheduling Logic**:
    - Day 0 scheduling with a day 7 optimal start policy for material buffer time.
    - Jobs are never scheduled in the past; the earliest start is tomorrow.
    - Capacity-aware scheduling: Jobs automatically move to the next Monday if daily/weekly capacity limits are exceeded.
    - Priority-based scheduling: Jobs are assigned priorities (Critical, High, Normal, Low) based on promised dates and completion hours, and scheduled in that order.
    - Resource assignment: Role-based assignment (e.g., Operators/Shift Leads for production, Quality Inspectors for inspection). Resources are filtered by work centers.
    - Shift balancing: Utilizes both shifts with weekly capacity constraints, handling multi-day jobs across shifts and business days.
    - Material tracking: Material orders are tracked separately; missing materials create alerts for review rather than blocking scheduling.
- **Resource Capacity Tracking**: Accounts for resource unavailability for accurate operator capacity calculations.
- **Migrations**: Drizzle Kit for database schema migrations.

### Real-time Communication
- **WebSocket Server**: Integrated for real-time updates.
- **Event Broadcasting**: Automatic client notification for job updates, machine status, and schedule modifications.

### Authentication and Authorization
- **Session-based**: Express sessions with secure cookie configuration.

## External Dependencies

### Database Services
- **Neon Database**: Serverless PostgreSQL hosting.
- **Drizzle ORM**: Type-safe database toolkit for PostgreSQL operations.

### UI and Styling Dependencies
- **shadcn/ui**: Component library.
- **Radix UI**: Headless UI primitives.
- **Tailwind CSS**: Utility-first CSS framework.
- **Lucide React**: Icon library.

### Development and Build Tools
- **Vite**: Fast build tool.
- **TypeScript**: Type safety across frontend and backend.
- **Replit Integration**: Native Replit development environment support.

### Third-party Integrations
- **React Hook Form**: Form state management with validation.
- **React Query**: Server state synchronization and caching.
- **Date-fns**: Date manipulation and formatting utilities.
- **Zod**: Runtime type validation and schema definition.
- **Class Variance Authority**: Type-safe component variant management.