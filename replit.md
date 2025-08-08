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
- **UI/UX Decisions**: Clear visual indicators for scheduling, multi-day jobs, and capacity constraints. Color coding for shifts and accessibility. Fullscreen support with proper scrolling and sticky headers. Multiple calendar views (hourly, daily, weekly, monthly) for comprehensive schedule perspectives. Enhanced display for multi-day jobs with staggered blocks and US Central timezone.

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
    - **Priority Scoring System**: Jobs prioritized by business rules (Late to Customer, Late to Us, Nearing Ship, Normal, Stock).
    - **Campaign Batching**: Outsourced operations automatically grouped into vendor-specific shipping campaigns.
    - **Dependency Management**: Smart handling of outsourced operation dependencies with return date validation and promise date checking.
    - **Operation Chunking**: Complex operations split across multiple time slots with resource continuity and availability checking.
    - **Inspection Queue**: Automatic detection of jobs ready for quality control with real-time dashboard widget.
    - **Structured Logging**: Comprehensive job-based logging with collapsible console groups for debugging scheduling decisions.
    - **Boundary Time Management**: Forward and backward scheduling with configurable start dates and dependency constraints.
    - **Year-Round Availability**: Comprehensive operator scheduling with custom work schedules, unavailability periods, and real-time availability checks.
    - **Shift Capacity Load Balancing**: Distributes work evenly between shifts based on capacity.
    - **Resource Conflict Resolution**: Prevents resource double-booking, ensuring one resource per machine.
    - **Loop Protection**: Comprehensive limits to prevent infinite loops during scheduling.
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