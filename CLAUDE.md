# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
zebraApp is a photography studio reservation management application with a dual architecture:
- **Development**: Traditional architecture (Go backend + PostgreSQL + Redis)
- **Production**: AWS serverless (Lambda + DynamoDB + Cognito)

## Key Documentation References
- タスク分解: `Doc/implementation-tasks.md`
- 要件定義: `Doc/requirements-specification.md`
- 基本設計: `Doc/basic-design-specification.md`
- システムアーキテクチャ: `Doc/system-architecture.md`
- デザインルール: `Doc/design-specification.md`
- 詳細設計書: `Doc/serverless/` 配下

## Development Commands

### Frontend (Next.js)
```bash
cd frontend
npm run dev      # Development server (http://localhost:3000)
npm run build    # Production build
npm run lint     # Run ESLint
```

### Backend (Go)
```bash
cd backend
# Development uses Air for hot-reloading (configured in .air.toml)
air              # Start with hot-reload
go build -o ./tmp/main ./cmd/api  # Manual build
```

### Full Stack Development
```bash
docker-compose up    # Start all services (frontend, backend, postgres, redis)
```

## Architecture Patterns

### Database Strategy
- **Development**: PostgreSQL with migrations (`backend/migrations/`)
- **Production**: DynamoDB single-table design
  - Composite keys (PK/SK pattern)
  - GSI for access patterns (USER#userId, STATUS#status, etc.)
  - See `Doc/serverless/dynamodb-table-design.md` for details

### Authentication Flow
- **Development**: JWT with Redis session storage
- **Production**: AWS Cognito + Lambda authorizer
- Frontend uses React Context (`contexts/auth-context.tsx`)
- Auth routes grouped under `(auth)` in Next.js App Router

### API Design
- RESTful endpoints under `/api` prefix
- Health check: `/health`
- Backend structure:
  - `cmd/api/` - Entry point
  - `internal/controllers/` - HTTP handlers
  - `internal/services/` - Business logic
  - `internal/repositories/` - Data access
  - `internal/models/` - Domain models

### Serverless Lambda Structure
```
terraform/lambda_src/
├── auth/           # Authentication functions
├── user/           # User management
└── lib/            # Shared utilities
```

## Critical Business Logic

### Booking System
1. **Two booking types**:
   - 仮予約 (Temporary): Max 2 days, no cancellation fee, 7-day confirmation deadline
   - 本予約 (Confirmed): Subject to cancellation fees

2. **Cancellation Policy**:
   - 6-4 days before: 50%
   - 3-1 days before: 80%
   - Same day: 100%

3. **Automatic Processing**:
   - EventBridge schedules for deadline notifications
   - Auto-cancellation of unconfirmed temporary bookings

### Infrastructure as Code
- Terraform manages all AWS resources
- Separate backend state setup in `terraform_backend_setup/`
- Lambda functions deployed as zip files
- Run `terraform plan` before any infrastructure changes

## Development Workflow

1. **Task Tracking**: Update `Doc/implementation-tasks.md` after completing tasks
2. **Database Changes**: Create migrations in `backend/migrations/`
3. **Environment Variables**: Set in `docker-compose.yml` for development
4. **CORS**: Already configured for cross-origin requests

## Important Conventions
- Japanese comments in SQL and Go code are intentional
- Use UTC timestamps with timezone awareness
- Implement soft deletes (status fields) rather than hard deletes
- All user actions should be logged with status change history

## Current Implementation Status
- ✅ Infrastructure and authentication complete
- ⏳ Core booking system in development (Task 2.2)
- 📋 Notification system pending