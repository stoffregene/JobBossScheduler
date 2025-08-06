# Manufacturing Resource Planning (MRP) System

## Overview
This is a comprehensive Manufacturing Resource Planning (MRP) system designed for real-time job scheduling, machine monitoring, resource allocation, and production management in manufacturing operations. The system aims to provide a modern full-stack solution to optimize production workflows, manage resources efficiently, and provide real-time insights into manufacturing processes, ultimately enhancing operational efficiency and enabling data-driven decision-making in manufacturing.

## User Preferences
Preferred communication style: Simple, everyday language.

## Recent Changes

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
- **Auto-Scheduling Logic**:
    - Jobs schedule from today or later (never in the past), with a 7-day material buffer policy.
    - Capacity-aware scheduling: Jobs move to next Monday if daily/weekly capacity is exceeded.
    - Priority-based scheduling (Critical, High, Normal, Low) based on due dates.
    - Resource assignment: Role-based and machine-specific compatibility matrix enforcement (e.g., Quality Inspectors for INSPECT operations, Operators/Shift Leads for PRODUCTION). Outsource operations receive no internal resources.
    - Shift balancing: Utilizes both shifts with weekly capacity constraints, handling multi-day jobs across shifts and weekends.
    - Material tracking: Missing materials generate alerts but do not block scheduling.
- **Resource Capacity Tracking**: Accounts for unavailability.
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