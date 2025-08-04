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