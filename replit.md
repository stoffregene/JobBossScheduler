# Manufacturing Resource Planning (MRP) System

## Overview
This is a comprehensive Manufacturing Resource Planning (MRP) system designed for real-time job scheduling, machine monitoring, resource allocation, and production management in manufacturing operations. The system aims to provide a modern full-stack solution to optimize production workflows, manage resources efficiently, and provide real-time insights into manufacturing processes, ultimately enhancing operational efficiency and enabling data-driven decision-making in manufacturing.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript and Vite.
- **UI Framework**: shadcn/ui built on Radix UI.
- **Styling**: Tailwind CSS with custom manufacturing themes.
- **State Management**: TanStack Query for server state.
- **Routing**: Wouter.
- **Real-time Updates**: WebSocket integration for live data synchronization.
- **UI/UX Decisions**: Clear visual indicators for scheduling, multi-day jobs, and capacity constraints. Color coding for shifts and accessibility. Fullscreen support with proper scrolling and sticky headers.

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