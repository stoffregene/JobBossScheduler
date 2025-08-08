# JobBossScheduler

A comprehensive manufacturing job scheduling system built with React, TypeScript, Express.js, and PostgreSQL.

## 🏗️ Architecture Overview

This is a full-stack manufacturing scheduling application with the following structure:

### Frontend (React + TypeScript)
- **Location**: `client/` directory
- **Framework**: React 18 with TypeScript
- **UI Library**: shadcn/ui components with Tailwind CSS
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack Query for server state
- **Real-time**: WebSocket connections for live updates

### Backend (Express.js + TypeScript)
- **Location**: `server/` directory
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Real-time**: WebSocket server for live updates
- **API**: RESTful endpoints for all operations

### Database Schema
- **Location**: `shared/schema.ts`
- **ORM**: Drizzle ORM with Zod validation
- **Key Tables**: jobs, machines, resources, schedule_entries, alerts

## 📁 Project Structure

```
JobBossScheduler/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── pages/         # Route pages
│   │   ├── hooks/         # Custom React hooks
│   │   └── lib/           # Utilities and configurations
├── server/                 # Express.js backend
│   ├── routes.ts          # API route definitions
│   ├── scheduler.ts       # Core scheduling logic
│   ├── auto-scheduler.ts  # Automated scheduling
│   └── utils/             # Server utilities
├── shared/                 # Shared types and schemas
│   └── schema.ts          # Database schema definitions
├── tests/                  # Test files and data
├── attached_assets/        # Sample data files
└── drizzle/               # Database migrations
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL database
- npm or yarn

### Installation
```bash
npm install
```

### Development
```bash
npm run dev
```

### Production Build
```bash
npm run build
npm start
```

## 🗄️ Database Setup

### Schema Overview

The system manages complex manufacturing data with these key entities:

#### Jobs
- Manufacturing orders with routing operations
- Due dates, priorities, and status tracking
- Material requirements and vendor information

#### Machines
- Different types: MILL, LATHE, WATERJET, BEAD BLAST, SAW, WELD, INSPECT, ASSEMBLE, OUTSOURCE
- Capabilities and substitution groups
- Efficiency factors and shift availability

#### Resources (Operators)
- Employee information and skills
- Work schedules and machine qualifications
- Hourly rates and availability tracking

#### Schedule Entries
- Actual scheduled operations
- Start/end times, assigned resources
- Shift assignments and status tracking

### Database Commands
```bash
# Push schema changes to database
npm run db:push

# Generate new migration
npx drizzle-kit generate
```

## 🔧 Key Features

### 1. Job Management
- **Import**: CSV job import with validation
- **Routing**: Complex operation sequences with machine compatibility
- **Tracking**: Real-time status updates and progress monitoring
- **Priorities**: Multi-level priority system (Normal, High, Critical)

### 2. Resource Management
- **Operator Skills**: Detailed skill mapping to machines
- **Work Schedules**: Custom shift schedules and availability
- **Substitution**: Machine substitution capabilities
- **Compatibility Matrix**: Sophisticated resource-to-machine assignment

### 3. Scheduling Engine
- **Auto-Scheduling**: Automated job scheduling with conflict resolution
- **Rescheduling**: Dynamic rescheduling when conflicts arise
- **Bar Feeder Service**: Specialized handling for bar-fed operations
- **Campaign Manager**: Batch job processing

### 4. Real-time Dashboard
- **Live Updates**: WebSocket-powered real-time updates
- **Status Monitoring**: Job, machine, and resource status
- **Alerts**: System notifications for issues and conflicts
- **Material Tracking**: Material orders and availability

## 🎯 API Endpoints

### Jobs
- `GET /api/jobs` - List all jobs
- `POST /api/jobs` - Create new job
- `PATCH /api/jobs/:id` - Update job
- `DELETE /api/jobs/:id` - Delete job

### Machines
- `GET /api/machines` - List all machines
- `POST /api/machines` - Create new machine
- `PATCH /api/machines/:id` - Update machine

### Resources
- `GET /api/resources` - List all resources
- `POST /api/resources` - Create new resource
- `PATCH /api/resources/:id` - Update resource

### Schedule
- `GET /api/schedule` - Get schedule data
- `POST /api/schedule/auto-schedule` - Run auto-scheduling
- `POST /api/schedule/reschedule` - Reschedule operations

### Dashboard
- `GET /api/dashboard/stats` - Get dashboard statistics
- `GET /api/dashboard/alerts` - Get system alerts

## 🔄 Real-time Features

### WebSocket Events
- `job_created`, `job_updated`, `job_deleted`
- `machine_updated`
- `schedule_updated`, `schedule_entry_deleted`
- `alert_created`, `alert_read`, `alert_deleted`

### Live Updates
- Real-time job status changes
- Machine utilization updates
- Resource availability changes
- Alert notifications

## 🏭 Manufacturing-Specific Features

### Machine Types & Capabilities
- **MILL**: Vertical and horizontal milling centers
- **LATHE**: Various lathe types with live tooling
- **WATERJET**: Cutting operations
- **SAW**: Sawing operations
- **WELD**: Welding and fabrication
- **INSPECT**: Quality inspection
- **ASSEMBLE**: Assembly operations
- **OUTSOURCE**: External vendor operations

### Resource Compatibility
- **High-Value Operators**: 6+ machine qualifications
- **Specialized Operators**: 3-5 machine qualifications
- **Machine Substitution**: Compatible machine groups
- **Skill Mapping**: Detailed operator-to-machine assignments

### Scheduling Constraints
- **Machine Availability**: Shift schedules and maintenance
- **Resource Availability**: Operator schedules and skills
- **Material Requirements**: Material availability tracking
- **Due Date Management**: Priority-based scheduling

## 🧪 Testing

### Test Files Location
- `tests/` directory contains various test scenarios
- Sample CSV files for job import testing
- Verification scripts for scheduling logic

### Running Tests
```bash
# Test specific scenarios
node tests/test-50-jobs.js
node tests/test-schedule-all.js
```

## 📊 Data Import

### Supported Formats
- CSV files for job import
- JSON configuration files
- Sample data in `attached_assets/`

### Import Process
1. Upload CSV file via web interface
2. Validate data against schema
3. Process routing operations
4. Create jobs in database
5. Trigger auto-scheduling if enabled

## 🚀 Deployment

### Railway Configuration
- `railway.toml` for Railway deployment
- Environment variables for database connection
- Production build configuration

### Environment Variables
- `DATABASE_URL`: PostgreSQL connection string
- `PORT`: Server port (default: 5000)
- `NODE_ENV`: Environment (development/production)

## 🔍 Development Guidelines

### Code Organization
- **Frontend**: Component-based architecture with custom hooks
- **Backend**: Service-oriented architecture with clear separation
- **Shared**: Type definitions and schemas shared between frontend/backend

### Type Safety
- Full TypeScript implementation
- Zod validation for API requests
- Drizzle ORM for type-safe database operations

### State Management
- **Server State**: TanStack Query for API data
- **Client State**: React hooks for local state
- **Real-time**: WebSocket for live updates

## 📚 Additional Resources

- `resource-compatibility-matrix.md`: Detailed operator-to-machine mapping
- `attached_assets/`: Sample data files for testing
- `tests/`: Various test scenarios and verification scripts

## 🤝 Contributing

When working with this repository:

1. **Understand the manufacturing context**: This is a real manufacturing scheduling system
2. **Respect the data model**: Jobs, machines, and resources have complex relationships
3. **Consider scheduling constraints**: Machine availability, operator skills, material requirements
4. **Test thoroughly**: Use the provided test files and sample data
5. **Maintain type safety**: All changes should be type-safe with proper validation

## 🔧 Common Development Tasks

### Adding New Features
1. Update schema in `shared/schema.ts` if needed
2. Add API endpoints in `server/routes.ts`
3. Create frontend components in `client/src/components/`
4. Add pages in `client/src/pages/` if needed
5. Update types and validation

### Database Changes
1. Modify schema in `shared/schema.ts`
2. Run `npm run db:push` to apply changes
3. Update related API endpoints and frontend code

### UI Components
1. Use shadcn/ui components in `client/src/components/ui/`
2. Follow existing patterns for styling and layout
3. Implement proper TypeScript types

This README provides a comprehensive overview for any Cursor agent working with this manufacturing scheduling system.
