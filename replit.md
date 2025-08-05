# Manufacturing Resource Planning (MRP) System

## Overview
This is a comprehensive Manufacturing Resource Planning (MRP) system designed for real-time job scheduling, machine monitoring, resource allocation, and production management in manufacturing operations. The system aims to provide a modern full-stack solution to optimize production workflows, manage resources efficiently, and provide real-time insights into manufacturing processes.

## User Preferences
Preferred communication style: Simple, everyday language.

## Recent Changes

**August 5, 2025** - MAJOR ANALYSIS: Created comprehensive resource-work center compatibility matrix revealing critical scheduling constraints:
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