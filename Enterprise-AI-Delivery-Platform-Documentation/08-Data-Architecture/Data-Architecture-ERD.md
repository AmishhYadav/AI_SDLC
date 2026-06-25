Enterprise AI Delivery Platform

Data Architecture & ERD Specification

Version 1.0

Status: Draft

1. Purpose

This document defines the logical data architecture of the Enterprise AI Delivery Platform, including relational data, vector data, cache, workflow state, and relationships between major entities.

The platform follows a polyglot persistence approach:

PostgreSQL → System of Record
Qdrant → Semantic Knowledge Store
Redis → Cache & Workflow State
2. Database Strategy

PostgreSQL

Purpose:

Transactional data
Business entities
Workflow metadata
Documentation
Audit
Configuration
Qdrant

Purpose:

Repository embeddings
Documentation embeddings
Context retrieval
Semantic search
Redis

Purpose:

Sessions
Context cache
Workflow checkpoints
Queue state
Temporary execution state
3. Database Domains

The relational database is divided into logical domains.

Identity

Organization

Integration

Repository

Knowledge

Documentation

Planning

Development

Validation

Testing

Delivery

Learning

AI Platform

Operations
4. Core Entity Groups

Identity

Tables

users
roles
permissions
user_roles
role_permissions
sessions
Organization

Tables

organizations
projects
teams
project_members
repositories
Integration

Tables

integrations
azure_connections
github_connections
stitch_connections
webhook_events
Repository

Tables

repository_profiles
repository_services
dependency_graphs
api_catalog
database_catalog
architecture_profiles
repository_indexes
Knowledge

Tables

knowledge_sources
context_packages
embedding_metadata
adr_index
Documentation

Tables

brds
tsds
llds
adrs
mermaid_diagrams
documentation_versions
Planning

Tables

work_items
planning_sessions
impact_reports
implementation_plans
Development

Tables

generated_code
developer_reviews
code_generations
consensus_results
Validation

Tables

validation_reports
security_reports
performance_reports
cost_reports
compliance_reports
Testing

Tables

test_suites
test_cases
test_runs
coverage_reports
autofix_history
Delivery

Tables

branches
pull_requests
commits
deployment_reports
Learning

Tables

learning_profiles
coding_preferences
architecture_preferences
review_patterns
AI Platform

Tables

capabilities
prompts
models
graphs
workflow_runs
workflow_state
Platform Operations

Tables

audit_logs
notifications
configurations
metrics
alerts
5. High-Level Entity Relationships

Organization
      │
      ▼
Project
      │
      ▼
Repository
      │
      ▼
Repository Profile
      │
      ▼
Knowledge Hub
      │
      ▼
Documentation
      │
      ▼
Planning Session
      │
      ▼
Generated Code
      │
      ▼
Validation
      │
      ▼
Testing
      │
      ▼
Pull Request
      │
      ▼
Learning Profile
6. Primary Relationships

Organization

Organization

1 → N Projects

Organization

1 → N Users

Project

Project

1 → N Repositories

Project

1 → N Work Items

Repository

Repository

1 → 1 Repository Profile

Repository

1 → N Context Packages

Repository

1 → N Documentation

Repository

1 → N Pull Requests

Documentation

BRD

1 → N TSD

TSD

1 → N LLD

LLD

1 → N Generated Code

Development

Generated Code

1 → N Validation Reports

Generated Code

1 → N Test Runs

Generated Code

1 → N Pull Requests

Validation

Validation Report

1 → N Findings

Testing

Test Suite

1 → N Test Cases

Test Run

1 → N Coverage Reports

Delivery

Pull Request

1 → N Reviews

Pull Request

1 → 1 Merge Result

7. AI Relationships

Capability

1 → N Prompts

Capability

1 → N Models

Capability

1 → N Graphs

Workflow

1 → N Workflow States

Workflow

1 → N Audit Events

Workflow

1 → N Generated Artifacts

8. Vector Database Design

Each vector document stores:

Document ID
Repository ID
Source Type
Source Identifier
Embedding
Metadata
Chunk Index
Version
Indexed document types:

Source Code
BRD
TSD
LLD
ADR
API Docs
Architecture Docs
PR Discussions
Engineering Standards
9. Redis Data Model

Redis stores:

Sessions

User sessions

Workflow Cache

Graph execution state

Context Cache

Recently generated context packages

Queue State

Workflow queues

Distributed Locks

Long-running workflows

10. Audit Model

Every important action generates an audit record.

Includes:

User
Workflow
Model
Prompt Version
Repository
Work Item
Timestamp
Status
Cost
Approval
11. Versioning Strategy

The following entities are versioned:

BRD
TSD
LLD
ADR
Prompt
Workflow
Graph
Repository Profile
Previous versions remain immutable.

12. Soft Delete Strategy

Entities support:

Created At
Updated At
Deleted At
Deleted By
No business entities are permanently deleted.

13. Indexing Strategy

Indexes include:

Organization
Repository
Project
Work Item
Workflow
Pull Request
User
Graph
Capability
Prompt Version
Composite indexes applied to frequently queried combinations.

14. Security

Sensitive data includes:

OAuth Tokens
API Keys
Secrets
Prompt Variables
Credentials
Security controls:

Encryption at rest
Encryption in transit
Secret vault integration
RBAC
Audit logging
15. Backup Strategy

PostgreSQL

Daily full backup
Incremental backups
Point-in-time recovery
Qdrant

Snapshot backups
Redis

Snapshot persistence
Workflow checkpoint recovery
16. Data Lifecycle

Repository

↓

Repository Profile

↓

Knowledge

↓

Documentation

↓

Planning

↓

Development

↓

Validation

↓

Testing

↓

Delivery

↓

Learning

↓

Archive
17. ERD Deliverables

The detailed ERD will contain:

Identity

6 tables

Organization

5 tables

Integration

5 tables

Repository

7 tables

Knowledge

4 tables

Documentation

6 tables

Planning

4 tables

Development

4 tables

Validation

5 tables

Testing

5 tables

Delivery

4 tables

Learning

4 tables

AI Platform

6 tables

Operations

4 tables

Total Estimated Tables: ~69

18. Deliverables

This document defines:

Logical database architecture
Entity groups
Table ownership
Entity relationships
Vector database design
Cache design
Versioning
Security
Backup strategy
Data lifecycle
This specification becomes the implementation reference for the detailed ERD, Prisma schema, PostgreSQL database design, Qdrant collections, Redis cache structure, and persistence layer.