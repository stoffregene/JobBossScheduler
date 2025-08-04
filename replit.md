# Manufacturing Resource Planning (MRP) System

## Overview

This is a comprehensive Manufacturing Resource Planning (MRP) system built with a modern full-stack architecture. The application provides real-time job scheduling, machine monitoring, resource allocation, and production management capabilities for manufacturing operations. It features a React-based frontend with shadcn/ui components and an Express.js backend with PostgreSQL database integration.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

**August 4, 2025** - Fixed critical "unschedule all" function bug:
- Identified route matching issue where `/api/schedule/:id` was intercepting `/api/schedule/all` requests
- Moved specific route above parameterized route to ensure proper matching
- Function now successfully clears all schedule entries and resets job statuses
- Application running stably with all core features operational

**August 4, 2025** - Dashboard reorganization for improved workflow:
- Restructured main grid from 4-column to 5-column layout for better space allocation
- Production schedule calendar now gets dedicated 2-column space for enhanced visibility
- Job queue enhanced with dedicated 2-column space for better accessibility
- Work center status component moved to sidebar and starts minimized with lower visual priority
- Dashboard overview simplified to show only active jobs and at-risk jobs tiles
- **RESTORED**: Resource capacity tile added back below production schedule calendar, synchronized with week/month view selection

**August 4, 2025** - Fixed job scheduling functionality and UI improvements:
- Fixed job details modal "Schedule Job" button - now uses correct `/api/jobs/:id/auto-schedule` endpoint
- Replaced "Schedule Job" with "Auto Schedule" button using lightning bolt icon for consistency
- Added proper error handling with detailed failure messages from backend
- Fixed weekend shading in production schedule to properly show Friday-Sunday as unavailable
- Improved job queue button layout with flex-wrap to prevent buttons from running off tile edges
- Enhanced month view in production schedule with sticky machine labels and better column sizing
- **CRITICAL FIX**: Fixed backend scheduling logic to properly skip Friday-Sunday (days 5,6,0) - jobs will no longer be scheduled on weekends
- **VISUAL FIX**: Fixed schedule view week calendar to start from Sunday (standard calendar layout) - jobs now display in correct day columns
- **MULTI-DAY FIX**: Fixed schedule view to properly display multi-day jobs across multiple columns - long operations (like 44+ hour HMC jobs) now span correctly across days
- **DISPLAY FIX**: Updated job display to show operation sequence instead of total hours for better clarity in multi-operation jobs
- **TIMEZONE FIX**: Fixed UTC date comparison in schedule view to prevent jobs from appearing on wrong days due to timezone differences
- **SHIFT PRIORITY FIX**: Changed scheduler to always prioritize shift 1 first instead of load balancing - ensures machines that only run on shift 1 get scheduled properly
- **RESOURCE AVAILABILITY FIX**: Enhanced scheduler to check if machines have qualified resources (operators) available on the specific shift - prevents scheduling jobs on machines when no operators are available
- **SHIFT DISPLAY FIX**: Fixed resource allocation component to use database shift values instead of recalculating from time - eliminates incorrect "shift 2" display for 3 AM jobs that are correctly scheduled on shift 1

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized production builds
- **UI Framework**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom manufacturing-themed color variables
- **State Management**: TanStack Query (React Query) for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Real-time Updates**: WebSocket integration for live data synchronization

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **API Pattern**: RESTful API with WebSocket support for real-time features
- **Data Storage**: In-memory storage implementation with interface for future database integration
- **Session Management**: Express sessions with PostgreSQL session store support
- **Development**: Hot module replacement via Vite middleware integration

### Data Storage Solutions
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Schema**: Comprehensive manufacturing schema including jobs, machines, schedule entries, material orders, and alerts with machine tier system
- **Machine Tiers**: Premium, Standard, and Budget tiers with efficiency factors and substitution groups
- **Auto-Scheduling**: Day 0 scheduling with day 7 optimal start policy for material buffer time
- **Material Tracking**: Material orders tracked separately from scheduling decisions - materials flag for review rather than block scheduling
- **Scheduling Logic**: Jobs schedule immediately (day 0) but optimal start is day 7 to allow material ordering/receiving window
- **Review System**: Missing materials create alerts for review rather than auto-reschedule to handle JobBoss sync issues
- **Resource Capacity Tracking**: Resource allocation component now properly accounts for resource unavailability when calculating capacity - integrates with resource unavailability data to provide accurate operator capacity calculations based on the selected date range
- **Migrations**: Drizzle Kit for database schema migrations
- **Connection**: Neon Database serverless PostgreSQL integration
- **Current Implementation**: In-memory storage with full CRUD operations, designed for easy migration to persistent storage

### Real-time Communication
- **WebSocket Server**: Integrated WebSocket server for real-time updates
- **Event Broadcasting**: Automatic client notification for job updates, machine status changes, and schedule modifications
- **Connection Management**: Automatic connection handling with reconnection support

### Authentication and Authorization
- **Session-based**: Express sessions with secure cookie configuration
- **Future-ready**: Architecture supports easy integration of authentication middleware
- **Security**: CORS configuration and secure session handling

## External Dependencies

### Database Services
- **Neon Database**: Serverless PostgreSQL hosting for production data storage
- **Drizzle ORM**: Type-safe database toolkit for PostgreSQL operations
- **Connection Pooling**: Built-in connection management through Neon serverless driver

### UI and Styling Dependencies
- **shadcn/ui**: Comprehensive component library with accessibility features
- **Radix UI**: Headless UI primitives for complex interactive components
- **Tailwind CSS**: Utility-first CSS framework with custom design system
- **Lucide React**: Icon library for consistent iconography

### Development and Build Tools
- **Vite**: Fast build tool with HMR and optimized production builds
- **TypeScript**: Type safety across frontend and backend
- **Replit Integration**: Native Replit development environment support with cartographer plugin
- **ESBuild**: Fast JavaScript bundler for backend production builds

### Third-party Integrations
- **React Hook Form**: Form state management with validation
- **React Query**: Server state synchronization and caching
- **Date-fns**: Date manipulation and formatting utilities
- **Zod**: Runtime type validation and schema definition
- **Class Variance Authority**: Type-safe component variant management