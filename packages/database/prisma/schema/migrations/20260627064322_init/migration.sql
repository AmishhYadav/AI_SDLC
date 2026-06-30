-- CreateEnum
CREATE TYPE "ModelProvider" AS ENUM ('OPENAI', 'ANTHROPIC', 'GOOGLE', 'AWS_BEDROCK', 'AZURE_OPENAI');

-- CreateEnum
CREATE TYPE "GraphType" AS ENUM ('REPOSITORY', 'DOCUMENTATION', 'PLANNING', 'DEVELOPMENT', 'VALIDATION', 'TESTING', 'DELIVERY', 'LEARNING');

-- CreateEnum
CREATE TYPE "WorkflowStatus" AS ENUM ('PENDING', 'RUNNING', 'WAITING_FOR_APPROVAL', 'FAILED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WorkflowEventType" AS ENUM ('STARTED', 'NODE_STARTED', 'NODE_COMPLETED', 'CHECKPOINT_CREATED', 'APPROVAL_REQUESTED', 'APPROVAL_COMPLETED', 'RETRY_SCHEDULED', 'FAILED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "HumanApprovalStage" AS ENUM ('BRD', 'TSD', 'LLD', 'GENERATED_CODE', 'PULL_REQUEST');

-- CreateEnum
CREATE TYPE "HumanApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AiExecutionStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'RETRIED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PullRequestStatus" AS ENUM ('OPEN', 'APPROVED', 'MERGED', 'CLOSED');

-- CreateEnum
CREATE TYPE "PullRequestReviewStatus" AS ENUM ('COMMENTED', 'APPROVED', 'CHANGES_REQUESTED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "PullRequestMergeStatus" AS ENUM ('PENDING', 'MERGED', 'FAILED', 'REVERTED');

-- CreateEnum
CREATE TYPE "Environment" AS ENUM ('DEVELOPMENT', 'QA', 'STAGING', 'PRODUCTION');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'CHANGES_REQUESTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DocumentationStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "DiagramType" AS ENUM ('MERMAID', 'ERD', 'SEQUENCE', 'COMPONENT', 'CLASS', 'FLOWCHART', 'STATE', 'DEPLOYMENT');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'INVITED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "IntegrationProvider" AS ENUM ('AZURE_DEVOPS', 'GITHUB', 'STITCH', 'SONARQUBE', 'CONFLUENCE', 'SLACK', 'MICROSOFT_TEAMS');

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('ACTIVE', 'DISCONNECTED', 'ERROR', 'DISABLED');

-- CreateEnum
CREATE TYPE "SyncJobStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "KnowledgeSourceType" AS ENUM ('SOURCE_CODE', 'BRD', 'TSD', 'LLD', 'ADR', 'API_DOCUMENTATION', 'ARCHITECTURE_DOCUMENTATION', 'ENGINEERING_STANDARD', 'SECURITY_POLICY', 'RUNBOOK', 'PULL_REQUEST', 'OTHER');

-- CreateEnum
CREATE TYPE "EmbeddingSourceType" AS ENUM ('BRD', 'TSD', 'LLD', 'ADR', 'CODE', 'API', 'DATABASE', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "VectorStoreProvider" AS ENUM ('QDRANT', 'PGVECTOR', 'PINECONE', 'WEAVIATE');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'EXECUTE', 'APPROVE', 'REJECT');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('INFO', 'SUCCESS', 'WARNING', 'ERROR');

-- CreateEnum
CREATE TYPE "MetricType" AS ENUM ('COUNTER', 'GAUGE', 'HISTOGRAM', 'TIMER');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ProjectMemberStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'REMOVED');

-- CreateEnum
CREATE TYPE "RepositoryStatus" AS ENUM ('ACTIVE', 'INDEXING', 'FAILED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RepositoryProvider" AS ENUM ('GITHUB', 'AZURE_DEVOPS', 'GITLAB', 'BITBUCKET');

-- CreateEnum
CREATE TYPE "TeamType" AS ENUM ('ENGINEERING', 'QA', 'DEVOPS', 'PLATFORM', 'PRODUCT', 'ARCHITECTURE', 'SECURITY', 'BUSINESS', 'CUSTOM');

-- CreateEnum
CREATE TYPE "OrganizationMemberStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'REMOVED');

-- CreateEnum
CREATE TYPE "WorkItemType" AS ENUM ('BACKEND_EPIC', 'FRONTEND_EPIC', 'FEATURE', 'ISSUE');

-- CreateEnum
CREATE TYPE "WorkItemStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'REVIEW', 'DONE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "RepositoryProfileStatus" AS ENUM ('PENDING', 'SCANNING', 'INDEXING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "RepositoryIndexStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "TestStatus" AS ENUM ('PENDING', 'RUNNING', 'PASSED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "ValidationStatus" AS ENUM ('PASSED', 'FAILED', 'WARNING');

-- CreateEnum
CREATE TYPE "ValidationFindingSeverity" AS ENUM ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ValidationFindingStatus" AS ENUM ('OPEN', 'RESOLVED', 'ACCEPTED_RISK', 'FALSE_POSITIVE');

-- CreateTable
CREATE TABLE "capabilities" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "version" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "capabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prompts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "capabilityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "description" TEXT,
    "systemPrompt" TEXT NOT NULL,
    "userTemplate" TEXT,
    "variables" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "prompts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "models" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "capabilityId" TEXT NOT NULL,
    "provider" "ModelProvider" NOT NULL,
    "name" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "displayName" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "maxTokens" INTEGER,
    "temperature" DOUBLE PRECISION,
    "topP" DOUBLE PRECISION,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "graphs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "capabilityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "type" "GraphType" NOT NULL,
    "description" TEXT,
    "entryNode" TEXT,
    "definition" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "graphs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_runs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "graphId" TEXT NOT NULL,
    "status" "WorkflowStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "triggeredBy" TEXT,
    "executionTimeMs" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "workflow_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_states" (
    "id" TEXT NOT NULL,
    "workflowRunId" TEXT NOT NULL,
    "nodeName" TEXT NOT NULL,
    "state" JSONB NOT NULL,
    "checkpoint" INTEGER NOT NULL DEFAULT 0,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "workflow_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_checkpoints" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "workflowRunId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "nodeName" TEXT NOT NULL,
    "stateSnapshot" JSONB NOT NULL,
    "contextSnapshot" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "workflow_checkpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_events" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "workflowRunId" TEXT NOT NULL,
    "type" "WorkflowEventType" NOT NULL,
    "nodeName" TEXT,
    "status" "WorkflowStatus",
    "message" TEXT,
    "payload" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "workflow_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "human_approvals" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "workflowRunId" TEXT,
    "requestedById" TEXT,
    "reviewerId" TEXT,
    "stage" "HumanApprovalStage" NOT NULL,
    "status" "HumanApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "comments" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "human_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_executions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "workflowRunId" TEXT,
    "promptId" TEXT,
    "modelId" TEXT,
    "userId" TEXT,
    "generatedCodeId" TEXT,
    "capabilityKey" TEXT,
    "status" "AiExecutionStatus" NOT NULL DEFAULT 'PENDING',
    "modelProvider" "ModelProvider" NOT NULL,
    "modelName" TEXT NOT NULL,
    "promptVersion" TEXT,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "totalTokens" INTEGER,
    "cost" DECIMAL(10,4),
    "latencyMs" INTEGER,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "requestMetadata" JSONB,
    "responseMetadata" JSONB,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "ai_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branches" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseBranch" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commits" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "commitSha" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "authorName" TEXT,
    "authorEmail" TEXT,
    "committedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "commits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pull_requests" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "commitId" TEXT,
    "generatedCodeId" TEXT NOT NULL,
    "providerPrId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "PullRequestStatus" NOT NULL DEFAULT 'OPEN',
    "sourceBranch" TEXT NOT NULL,
    "targetBranch" TEXT NOT NULL,
    "url" TEXT,
    "openedAt" TIMESTAMP(3),
    "mergedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "pull_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pull_request_reviews" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "pullRequestId" TEXT NOT NULL,
    "reviewerId" TEXT,
    "status" "PullRequestReviewStatus" NOT NULL,
    "comment" TEXT,
    "providerReviewId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "pull_request_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pull_request_merge_results" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "pullRequestId" TEXT NOT NULL,
    "commitSha" TEXT,
    "status" "PullRequestMergeStatus" NOT NULL DEFAULT 'PENDING',
    "mergedById" TEXT,
    "mergedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "pull_request_merge_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deployment_reports" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "pullRequestId" TEXT NOT NULL,
    "environment" "Environment" NOT NULL,
    "status" TEXT NOT NULL,
    "deploymentId" TEXT,
    "deployedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "logsUrl" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "deployment_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generated_code" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "workItemId" TEXT NOT NULL,
    "lldId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "generatedBy" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "generated_code_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "code_generations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "generatedCodeId" TEXT NOT NULL,
    "modelProvider" "ModelProvider" NOT NULL,
    "modelName" TEXT NOT NULL,
    "promptVersion" TEXT,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "totalTokens" INTEGER,
    "cost" DECIMAL(10,4),
    "latency" INTEGER,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "code_generations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "developer_reviews" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "generatedCodeId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "comments" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "developer_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consensus_results" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "generatedCodeId" TEXT NOT NULL,
    "primaryModel" TEXT NOT NULL,
    "secondaryModel" TEXT NOT NULL,
    "selectedModel" TEXT,
    "rationale" TEXT,
    "confidence" DOUBLE PRECISION,
    "differences" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "consensus_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "code_chats" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "generatedCodeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "modelProvider" "ModelProvider" NOT NULL,
    "modelName" TEXT NOT NULL,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "totalTokens" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "code_chats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "code_refactors" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "generatedCodeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT,
    "originalContent" TEXT NOT NULL,
    "refactoredContent" TEXT NOT NULL,
    "modelProvider" "ModelProvider" NOT NULL,
    "modelName" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "code_refactors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brds" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "repositoryId" TEXT,
    "workItemId" TEXT,
    "title" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "status" "DocumentationStatus" NOT NULL DEFAULT 'DRAFT',
    "content" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "brds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tsds" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "repositoryId" TEXT,
    "brdId" TEXT NOT NULL,
    "workItemId" TEXT,
    "title" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "status" "DocumentationStatus" NOT NULL DEFAULT 'DRAFT',
    "content" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "tsds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "llds" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "repositoryId" TEXT,
    "tsdId" TEXT NOT NULL,
    "workItemId" TEXT,
    "title" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "status" "DocumentationStatus" NOT NULL DEFAULT 'DRAFT',
    "content" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "llds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adrs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "repositoryId" TEXT,
    "workItemId" TEXT,
    "title" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "status" "DocumentationStatus" NOT NULL DEFAULT 'DRAFT',
    "decision" TEXT NOT NULL,
    "context" TEXT,
    "rationale" TEXT,
    "consequences" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "adrs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagrams" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "repositoryId" TEXT,
    "workItemId" TEXT,
    "type" "DiagramType" NOT NULL,
    "title" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sourceFormat" TEXT,
    "renderedSvg" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "diagrams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documentation_versions" (
    "id" TEXT NOT NULL,
    "brdId" TEXT,
    "tsdId" TEXT,
    "lldId" TEXT,
    "adrId" TEXT,
    "diagramId" TEXT,
    "organizationId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "changeSummary" TEXT,
    "content" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "changeType" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "documentation_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "avatarUrl" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "organizationMemberId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "hashedRefreshToken" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "theme" TEXT,
    "language" TEXT,
    "timezone" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integrations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "externalOrganizationId" TEXT,
    "externalProjectId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'ACTIVE',
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credentials" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "isEncrypted" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "lastRotatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhooks" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "events" JSONB NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "lastDeliveryAt" TIMESTAMP(3),
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "secret" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastTriggeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "webhooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_jobs" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "status" "SyncJobStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "metadata" JSONB,
    "itemsProcessed" INTEGER,
    "itemsFailed" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "sync_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_sources" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "repositoryId" TEXT,
    "name" TEXT NOT NULL,
    "type" "KnowledgeSourceType" NOT NULL,
    "sourcePath" TEXT,
    "relativePath" TEXT,
    "version" TEXT,
    "checksum" TEXT,
    "isIndexed" BOOLEAN NOT NULL DEFAULT false,
    "lastIndexedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "knowledge_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "context_packages" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "repositoryId" TEXT,
    "knowledgeSourceId" TEXT,
    "name" TEXT NOT NULL,
    "capability" TEXT NOT NULL,
    "version" TEXT,
    "contextData" JSONB NOT NULL,
    "tokenCount" INTEGER,
    "chunkCount" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "context_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "embedding_metadata" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "repositoryId" TEXT,
    "sourceType" "EmbeddingSourceType" NOT NULL,
    "sourceId" TEXT,
    "chunkIndex" INTEGER NOT NULL,
    "chunkId" TEXT NOT NULL,
    "vectorId" TEXT,
    "vectorStore" "VectorStoreProvider" NOT NULL,
    "checksum" TEXT,
    "embeddingModel" TEXT,
    "tokenCount" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "embedding_metadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adr_indexes" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "repositoryId" TEXT,
    "adrId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "summary" TEXT,
    "vectorId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "adr_indexes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_profiles" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "learning_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coding_preferences" (
    "id" TEXT NOT NULL,
    "learningProfileId" TEXT NOT NULL,
    "language" TEXT,
    "framework" TEXT,
    "namingConvention" TEXT,
    "formattingStyle" TEXT,
    "testingFramework" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "coding_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "architecture_preferences" (
    "id" TEXT NOT NULL,
    "learningProfileId" TEXT NOT NULL,
    "architectureStyle" TEXT,
    "designPatterns" JSONB,
    "layeringStrategy" TEXT,
    "apiStyle" TEXT,
    "databasePreference" TEXT,
    "messagingPreference" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "architecture_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_patterns" (
    "id" TEXT NOT NULL,
    "learningProfileId" TEXT NOT NULL,
    "patternName" TEXT NOT NULL,
    "category" TEXT,
    "frequency" INTEGER NOT NULL DEFAULT 1,
    "recommendation" TEXT,
    "examples" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "review_patterns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "action" "AuditAction" NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "workflowRunId" TEXT,
    "details" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configurations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metrics" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "name" TEXT NOT NULL,
    "type" "MetricType" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT,
    "tags" JSONB,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "name" TEXT NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "source" TEXT,
    "message" TEXT NOT NULL,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "logoUrl" TEXT,
    "status" "OrganizationStatus" NOT NULL DEFAULT 'ACTIVE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_members" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "organizationMemberId" TEXT NOT NULL,
    "status" "ProjectMemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "roleName" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "project_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repositories" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" "RepositoryProvider" NOT NULL,
    "remoteUrl" TEXT NOT NULL,
    "defaultBranch" TEXT NOT NULL DEFAULT 'main',
    "status" "RepositoryStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "repositories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "TeamType" NOT NULL DEFAULT 'ENGINEERING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_members" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "OrganizationMemberStatus" NOT NULL DEFAULT 'INVITED',
    "joinedAt" TIMESTAMP(3),
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_members" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "organizationMemberId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_items" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "azureWorkItemId" INTEGER,
    "type" "WorkItemType" NOT NULL,
    "status" "WorkItemStatus" NOT NULL DEFAULT 'TODO',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "work_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planning_sessions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "workItemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "WorkflowStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "planning_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "impact_reports" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "planningSessionId" TEXT NOT NULL,
    "summary" TEXT,
    "architectureImpact" TEXT,
    "dependencyImpact" TEXT,
    "databaseImpact" TEXT,
    "apiImpact" TEXT,
    "uiImpact" TEXT,
    "riskLevel" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "impact_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "implementation_plans" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "planningSessionId" TEXT NOT NULL,
    "workItemId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "implementationStrategy" TEXT,
    "estimatedEffort" TEXT,
    "complexity" TEXT,
    "tasks" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "implementation_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repository_profiles" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "lastCommitSha" TEXT,
    "name" TEXT,
    "description" TEXT,
    "status" "RepositoryProfileStatus" NOT NULL DEFAULT 'PENDING',
    "scannedAt" TIMESTAMP(3),
    "indexedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "repository_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dependency_graphs" (
    "id" TEXT NOT NULL,
    "repositoryProfileId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "dependencyType" TEXT,
    "version" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "dependency_graphs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "architecture_profiles" (
    "id" TEXT NOT NULL,
    "repositoryProfileId" TEXT NOT NULL,
    "architectureStyle" TEXT,
    "layeringStrategy" TEXT,
    "serviceCount" INTEGER,
    "moduleCount" INTEGER,
    "packageManager" TEXT,
    "buildTool" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "architecture_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_catalog" (
    "id" TEXT NOT NULL,
    "repositoryProfileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "controller" TEXT,
    "service" TEXT,
    "filePath" TEXT NOT NULL,
    "lineNumber" INTEGER,
    "requestSchema" JSONB,
    "responseSchema" JSONB,
    "authenticated" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "api_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "database_catalogs" (
    "id" TEXT NOT NULL,
    "repositoryProfileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "engine" TEXT,
    "schema" TEXT,
    "tableCount" INTEGER,
    "migrationTool" TEXT,
    "viewCount" INTEGER,
    "functionCount" INTEGER,
    "triggerCount" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "database_catalogs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repository_services" (
    "id" TEXT NOT NULL,
    "repositoryProfileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "language" TEXT,
    "framework" TEXT,
    "rootPath" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "repository_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repository_indexes" (
    "id" TEXT NOT NULL,
    "repositoryProfileId" TEXT NOT NULL,
    "indexVersion" TEXT NOT NULL,
    "commitSha" TEXT,
    "branch" TEXT,
    "status" "RepositoryIndexStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "filesIndexed" INTEGER NOT NULL DEFAULT 0,
    "chunksIndexed" INTEGER NOT NULL DEFAULT 0,
    "embeddingsGenerated" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "repository_indexes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_suites" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "test_suites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_cases" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "testSuiteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "status" "TestStatus" NOT NULL DEFAULT 'PENDING',
    "expectedResult" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "test_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_runs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "testSuiteId" TEXT NOT NULL,
    "generatedCodeId" TEXT NOT NULL,
    "status" "TestStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "passedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "test_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coverage_reports" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "testRunId" TEXT NOT NULL,
    "overallCoverage" DOUBLE PRECISION,
    "lineCoverage" DOUBLE PRECISION,
    "branchCoverage" DOUBLE PRECISION,
    "functionCoverage" DOUBLE PRECISION,
    "statementCoverage" DOUBLE PRECISION,
    "uncoveredFiles" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "coverage_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "autofix_history" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "testRunId" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "reason" TEXT,
    "fixSummary" TEXT,
    "modelProvider" "ModelProvider" NOT NULL,
    "modelName" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "autofix_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "validation_reports" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "generatedCodeId" TEXT NOT NULL,
    "overallStatus" "ValidationStatus" NOT NULL DEFAULT 'PASSED',
    "overallScore" DOUBLE PRECISION,
    "summary" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "validation_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "validation_findings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "validationReportId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "ruleId" TEXT,
    "severity" "ValidationFindingSeverity" NOT NULL,
    "status" "ValidationFindingStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "filePath" TEXT,
    "lineNumber" INTEGER,
    "remediation" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "validation_findings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_reports" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "validationReportId" TEXT NOT NULL,
    "status" "ValidationStatus" NOT NULL DEFAULT 'PASSED',
    "score" DOUBLE PRECISION,
    "summary" TEXT,
    "findings" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "security_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_reports" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "validationReportId" TEXT NOT NULL,
    "status" "ValidationStatus" NOT NULL DEFAULT 'PASSED',
    "score" DOUBLE PRECISION,
    "summary" TEXT,
    "metrics" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "performance_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_reports" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "validationReportId" TEXT NOT NULL,
    "status" "ValidationStatus" NOT NULL DEFAULT 'PASSED',
    "estimatedCost" DECIMAL(10,4),
    "estimatedTokens" INTEGER,
    "summary" TEXT,
    "recommendations" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "cost_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_reports" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "validationReportId" TEXT NOT NULL,
    "status" "ValidationStatus" NOT NULL DEFAULT 'PASSED',
    "complianceFramework" TEXT,
    "score" DOUBLE PRECISION,
    "summary" TEXT,
    "violations" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "compliance_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "capabilities_organizationId_idx" ON "capabilities"("organizationId");

-- CreateIndex
CREATE INDEX "capabilities_isEnabled_idx" ON "capabilities"("isEnabled");

-- CreateIndex
CREATE INDEX "capabilities_createdAt_idx" ON "capabilities"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "capabilities_organizationId_key_key" ON "capabilities"("organizationId", "key");

-- CreateIndex
CREATE INDEX "prompts_organizationId_idx" ON "prompts"("organizationId");

-- CreateIndex
CREATE INDEX "prompts_capabilityId_idx" ON "prompts"("capabilityId");

-- CreateIndex
CREATE INDEX "prompts_isActive_idx" ON "prompts"("isActive");

-- CreateIndex
CREATE INDEX "prompts_createdAt_idx" ON "prompts"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "prompts_capabilityId_name_version_key" ON "prompts"("capabilityId", "name", "version");

-- CreateIndex
CREATE INDEX "models_organizationId_idx" ON "models"("organizationId");

-- CreateIndex
CREATE INDEX "models_capabilityId_idx" ON "models"("capabilityId");

-- CreateIndex
CREATE INDEX "models_provider_idx" ON "models"("provider");

-- CreateIndex
CREATE INDEX "models_isEnabled_idx" ON "models"("isEnabled");

-- CreateIndex
CREATE INDEX "models_createdAt_idx" ON "models"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "models_organizationId_provider_modelId_key" ON "models"("organizationId", "provider", "modelId");

-- CreateIndex
CREATE INDEX "graphs_organizationId_idx" ON "graphs"("organizationId");

-- CreateIndex
CREATE INDEX "graphs_capabilityId_idx" ON "graphs"("capabilityId");

-- CreateIndex
CREATE INDEX "graphs_type_idx" ON "graphs"("type");

-- CreateIndex
CREATE INDEX "graphs_isActive_idx" ON "graphs"("isActive");

-- CreateIndex
CREATE INDEX "graphs_createdAt_idx" ON "graphs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "graphs_capabilityId_name_version_key" ON "graphs"("capabilityId", "name", "version");

-- CreateIndex
CREATE INDEX "workflow_runs_organizationId_idx" ON "workflow_runs"("organizationId");

-- CreateIndex
CREATE INDEX "workflow_runs_graphId_idx" ON "workflow_runs"("graphId");

-- CreateIndex
CREATE INDEX "workflow_runs_status_idx" ON "workflow_runs"("status");

-- CreateIndex
CREATE INDEX "workflow_runs_createdAt_idx" ON "workflow_runs"("createdAt");

-- CreateIndex
CREATE INDEX "workflow_states_workflowRunId_idx" ON "workflow_states"("workflowRunId");

-- CreateIndex
CREATE INDEX "workflow_states_nodeName_idx" ON "workflow_states"("nodeName");

-- CreateIndex
CREATE INDEX "workflow_states_isCurrent_idx" ON "workflow_states"("isCurrent");

-- CreateIndex
CREATE INDEX "workflow_states_createdAt_idx" ON "workflow_states"("createdAt");

-- CreateIndex
CREATE INDEX "workflow_checkpoints_organizationId_idx" ON "workflow_checkpoints"("organizationId");

-- CreateIndex
CREATE INDEX "workflow_checkpoints_workflowRunId_idx" ON "workflow_checkpoints"("workflowRunId");

-- CreateIndex
CREATE INDEX "workflow_checkpoints_nodeName_idx" ON "workflow_checkpoints"("nodeName");

-- CreateIndex
CREATE INDEX "workflow_checkpoints_createdAt_idx" ON "workflow_checkpoints"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_checkpoints_workflowRunId_sequence_key" ON "workflow_checkpoints"("workflowRunId", "sequence");

-- CreateIndex
CREATE INDEX "workflow_events_organizationId_idx" ON "workflow_events"("organizationId");

-- CreateIndex
CREATE INDEX "workflow_events_workflowRunId_idx" ON "workflow_events"("workflowRunId");

-- CreateIndex
CREATE INDEX "workflow_events_type_idx" ON "workflow_events"("type");

-- CreateIndex
CREATE INDEX "workflow_events_occurredAt_idx" ON "workflow_events"("occurredAt");

-- CreateIndex
CREATE INDEX "workflow_events_createdAt_idx" ON "workflow_events"("createdAt");

-- CreateIndex
CREATE INDEX "human_approvals_organizationId_idx" ON "human_approvals"("organizationId");

-- CreateIndex
CREATE INDEX "human_approvals_workflowRunId_idx" ON "human_approvals"("workflowRunId");

-- CreateIndex
CREATE INDEX "human_approvals_requestedById_idx" ON "human_approvals"("requestedById");

-- CreateIndex
CREATE INDEX "human_approvals_reviewerId_idx" ON "human_approvals"("reviewerId");

-- CreateIndex
CREATE INDEX "human_approvals_stage_idx" ON "human_approvals"("stage");

-- CreateIndex
CREATE INDEX "human_approvals_status_idx" ON "human_approvals"("status");

-- CreateIndex
CREATE INDEX "human_approvals_resourceType_resourceId_idx" ON "human_approvals"("resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "human_approvals_createdAt_idx" ON "human_approvals"("createdAt");

-- CreateIndex
CREATE INDEX "ai_executions_organizationId_idx" ON "ai_executions"("organizationId");

-- CreateIndex
CREATE INDEX "ai_executions_workflowRunId_idx" ON "ai_executions"("workflowRunId");

-- CreateIndex
CREATE INDEX "ai_executions_promptId_idx" ON "ai_executions"("promptId");

-- CreateIndex
CREATE INDEX "ai_executions_modelId_idx" ON "ai_executions"("modelId");

-- CreateIndex
CREATE INDEX "ai_executions_userId_idx" ON "ai_executions"("userId");

-- CreateIndex
CREATE INDEX "ai_executions_generatedCodeId_idx" ON "ai_executions"("generatedCodeId");

-- CreateIndex
CREATE INDEX "ai_executions_modelProvider_idx" ON "ai_executions"("modelProvider");

-- CreateIndex
CREATE INDEX "ai_executions_status_idx" ON "ai_executions"("status");

-- CreateIndex
CREATE INDEX "ai_executions_createdAt_idx" ON "ai_executions"("createdAt");

-- CreateIndex
CREATE INDEX "branches_organizationId_idx" ON "branches"("organizationId");

-- CreateIndex
CREATE INDEX "branches_repositoryId_idx" ON "branches"("repositoryId");

-- CreateIndex
CREATE INDEX "branches_createdAt_idx" ON "branches"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "branches_repositoryId_name_key" ON "branches"("repositoryId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "commits_commitSha_key" ON "commits"("commitSha");

-- CreateIndex
CREATE INDEX "commits_organizationId_idx" ON "commits"("organizationId");

-- CreateIndex
CREATE INDEX "commits_repositoryId_idx" ON "commits"("repositoryId");

-- CreateIndex
CREATE INDEX "commits_branchId_idx" ON "commits"("branchId");

-- CreateIndex
CREATE INDEX "commits_committedAt_idx" ON "commits"("committedAt");

-- CreateIndex
CREATE INDEX "commits_createdAt_idx" ON "commits"("createdAt");

-- CreateIndex
CREATE INDEX "pull_requests_organizationId_idx" ON "pull_requests"("organizationId");

-- CreateIndex
CREATE INDEX "pull_requests_repositoryId_idx" ON "pull_requests"("repositoryId");

-- CreateIndex
CREATE INDEX "pull_requests_branchId_idx" ON "pull_requests"("branchId");

-- CreateIndex
CREATE INDEX "pull_requests_commitId_idx" ON "pull_requests"("commitId");

-- CreateIndex
CREATE INDEX "pull_requests_generatedCodeId_idx" ON "pull_requests"("generatedCodeId");

-- CreateIndex
CREATE INDEX "pull_requests_status_idx" ON "pull_requests"("status");

-- CreateIndex
CREATE INDEX "pull_requests_createdAt_idx" ON "pull_requests"("createdAt");

-- CreateIndex
CREATE INDEX "pull_request_reviews_organizationId_idx" ON "pull_request_reviews"("organizationId");

-- CreateIndex
CREATE INDEX "pull_request_reviews_pullRequestId_idx" ON "pull_request_reviews"("pullRequestId");

-- CreateIndex
CREATE INDEX "pull_request_reviews_reviewerId_idx" ON "pull_request_reviews"("reviewerId");

-- CreateIndex
CREATE INDEX "pull_request_reviews_status_idx" ON "pull_request_reviews"("status");

-- CreateIndex
CREATE INDEX "pull_request_reviews_createdAt_idx" ON "pull_request_reviews"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "pull_request_merge_results_pullRequestId_key" ON "pull_request_merge_results"("pullRequestId");

-- CreateIndex
CREATE INDEX "pull_request_merge_results_organizationId_idx" ON "pull_request_merge_results"("organizationId");

-- CreateIndex
CREATE INDEX "pull_request_merge_results_pullRequestId_idx" ON "pull_request_merge_results"("pullRequestId");

-- CreateIndex
CREATE INDEX "pull_request_merge_results_mergedById_idx" ON "pull_request_merge_results"("mergedById");

-- CreateIndex
CREATE INDEX "pull_request_merge_results_status_idx" ON "pull_request_merge_results"("status");

-- CreateIndex
CREATE INDEX "pull_request_merge_results_createdAt_idx" ON "pull_request_merge_results"("createdAt");

-- CreateIndex
CREATE INDEX "deployment_reports_organizationId_idx" ON "deployment_reports"("organizationId");

-- CreateIndex
CREATE INDEX "deployment_reports_pullRequestId_idx" ON "deployment_reports"("pullRequestId");

-- CreateIndex
CREATE INDEX "deployment_reports_environment_idx" ON "deployment_reports"("environment");

-- CreateIndex
CREATE INDEX "deployment_reports_createdAt_idx" ON "deployment_reports"("createdAt");

-- CreateIndex
CREATE INDEX "generated_code_organizationId_idx" ON "generated_code"("organizationId");

-- CreateIndex
CREATE INDEX "generated_code_workItemId_idx" ON "generated_code"("workItemId");

-- CreateIndex
CREATE INDEX "generated_code_lldId_idx" ON "generated_code"("lldId");

-- CreateIndex
CREATE INDEX "generated_code_language_idx" ON "generated_code"("language");

-- CreateIndex
CREATE INDEX "generated_code_createdAt_idx" ON "generated_code"("createdAt");

-- CreateIndex
CREATE INDEX "code_generations_organizationId_idx" ON "code_generations"("organizationId");

-- CreateIndex
CREATE INDEX "code_generations_generatedCodeId_idx" ON "code_generations"("generatedCodeId");

-- CreateIndex
CREATE INDEX "code_generations_modelProvider_idx" ON "code_generations"("modelProvider");

-- CreateIndex
CREATE INDEX "code_generations_createdAt_idx" ON "code_generations"("createdAt");

-- CreateIndex
CREATE INDEX "developer_reviews_organizationId_idx" ON "developer_reviews"("organizationId");

-- CreateIndex
CREATE INDEX "developer_reviews_generatedCodeId_idx" ON "developer_reviews"("generatedCodeId");

-- CreateIndex
CREATE INDEX "developer_reviews_reviewerId_idx" ON "developer_reviews"("reviewerId");

-- CreateIndex
CREATE INDEX "developer_reviews_status_idx" ON "developer_reviews"("status");

-- CreateIndex
CREATE INDEX "developer_reviews_createdAt_idx" ON "developer_reviews"("createdAt");

-- CreateIndex
CREATE INDEX "consensus_results_organizationId_idx" ON "consensus_results"("organizationId");

-- CreateIndex
CREATE INDEX "consensus_results_generatedCodeId_idx" ON "consensus_results"("generatedCodeId");

-- CreateIndex
CREATE INDEX "consensus_results_createdAt_idx" ON "consensus_results"("createdAt");

-- CreateIndex
CREATE INDEX "code_chats_organizationId_idx" ON "code_chats"("organizationId");

-- CreateIndex
CREATE INDEX "code_chats_generatedCodeId_idx" ON "code_chats"("generatedCodeId");

-- CreateIndex
CREATE INDEX "code_chats_userId_idx" ON "code_chats"("userId");

-- CreateIndex
CREATE INDEX "code_chats_createdAt_idx" ON "code_chats"("createdAt");

-- CreateIndex
CREATE INDEX "code_refactors_organizationId_idx" ON "code_refactors"("organizationId");

-- CreateIndex
CREATE INDEX "code_refactors_generatedCodeId_idx" ON "code_refactors"("generatedCodeId");

-- CreateIndex
CREATE INDEX "code_refactors_userId_idx" ON "code_refactors"("userId");

-- CreateIndex
CREATE INDEX "code_refactors_createdAt_idx" ON "code_refactors"("createdAt");

-- CreateIndex
CREATE INDEX "brds_organizationId_idx" ON "brds"("organizationId");

-- CreateIndex
CREATE INDEX "brds_repositoryId_idx" ON "brds"("repositoryId");

-- CreateIndex
CREATE INDEX "brds_workItemId_idx" ON "brds"("workItemId");

-- CreateIndex
CREATE INDEX "brds_status_idx" ON "brds"("status");

-- CreateIndex
CREATE INDEX "brds_createdAt_idx" ON "brds"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "brds_organizationId_title_version_key" ON "brds"("organizationId", "title", "version");

-- CreateIndex
CREATE INDEX "tsds_organizationId_idx" ON "tsds"("organizationId");

-- CreateIndex
CREATE INDEX "tsds_repositoryId_idx" ON "tsds"("repositoryId");

-- CreateIndex
CREATE INDEX "tsds_brdId_idx" ON "tsds"("brdId");

-- CreateIndex
CREATE INDEX "tsds_workItemId_idx" ON "tsds"("workItemId");

-- CreateIndex
CREATE INDEX "tsds_status_idx" ON "tsds"("status");

-- CreateIndex
CREATE INDEX "tsds_createdAt_idx" ON "tsds"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "tsds_organizationId_title_version_key" ON "tsds"("organizationId", "title", "version");

-- CreateIndex
CREATE INDEX "llds_organizationId_idx" ON "llds"("organizationId");

-- CreateIndex
CREATE INDEX "llds_repositoryId_idx" ON "llds"("repositoryId");

-- CreateIndex
CREATE INDEX "llds_tsdId_idx" ON "llds"("tsdId");

-- CreateIndex
CREATE INDEX "llds_workItemId_idx" ON "llds"("workItemId");

-- CreateIndex
CREATE INDEX "llds_status_idx" ON "llds"("status");

-- CreateIndex
CREATE INDEX "llds_createdAt_idx" ON "llds"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "llds_organizationId_title_version_key" ON "llds"("organizationId", "title", "version");

-- CreateIndex
CREATE INDEX "adrs_organizationId_idx" ON "adrs"("organizationId");

-- CreateIndex
CREATE INDEX "adrs_repositoryId_idx" ON "adrs"("repositoryId");

-- CreateIndex
CREATE INDEX "adrs_workItemId_idx" ON "adrs"("workItemId");

-- CreateIndex
CREATE INDEX "adrs_status_idx" ON "adrs"("status");

-- CreateIndex
CREATE INDEX "adrs_createdAt_idx" ON "adrs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "adrs_organizationId_title_version_key" ON "adrs"("organizationId", "title", "version");

-- CreateIndex
CREATE INDEX "diagrams_organizationId_idx" ON "diagrams"("organizationId");

-- CreateIndex
CREATE INDEX "diagrams_repositoryId_idx" ON "diagrams"("repositoryId");

-- CreateIndex
CREATE INDEX "diagrams_workItemId_idx" ON "diagrams"("workItemId");

-- CreateIndex
CREATE INDEX "diagrams_type_idx" ON "diagrams"("type");

-- CreateIndex
CREATE INDEX "diagrams_createdAt_idx" ON "diagrams"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "diagrams_organizationId_title_version_type_key" ON "diagrams"("organizationId", "title", "version", "type");

-- CreateIndex
CREATE INDEX "documentation_versions_brdId_idx" ON "documentation_versions"("brdId");

-- CreateIndex
CREATE INDEX "documentation_versions_tsdId_idx" ON "documentation_versions"("tsdId");

-- CreateIndex
CREATE INDEX "documentation_versions_lldId_idx" ON "documentation_versions"("lldId");

-- CreateIndex
CREATE INDEX "documentation_versions_adrId_idx" ON "documentation_versions"("adrId");

-- CreateIndex
CREATE INDEX "documentation_versions_diagramId_idx" ON "documentation_versions"("diagramId");

-- CreateIndex
CREATE INDEX "documentation_versions_version_idx" ON "documentation_versions"("version");

-- CreateIndex
CREATE INDEX "documentation_versions_organizationId_idx" ON "documentation_versions"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "documentation_versions_brdId_versionNumber_key" ON "documentation_versions"("brdId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "documentation_versions_tsdId_versionNumber_key" ON "documentation_versions"("tsdId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "documentation_versions_lldId_versionNumber_key" ON "documentation_versions"("lldId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "documentation_versions_adrId_versionNumber_key" ON "documentation_versions"("adrId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "documentation_versions_diagramId_versionNumber_key" ON "documentation_versions"("diagramId", "versionNumber");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX "users_createdAt_idx" ON "users"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "roles_organizationId_idx" ON "roles"("organizationId");

-- CreateIndex
CREATE INDEX "roles_isSystem_idx" ON "roles"("isSystem");

-- CreateIndex
CREATE INDEX "roles_createdAt_idx" ON "roles"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "roles_organizationId_name_key" ON "roles"("organizationId", "name");

-- CreateIndex
CREATE INDEX "permissions_organizationId_idx" ON "permissions"("organizationId");

-- CreateIndex
CREATE INDEX "permissions_resource_idx" ON "permissions"("resource");

-- CreateIndex
CREATE INDEX "permissions_action_idx" ON "permissions"("action");

-- CreateIndex
CREATE INDEX "permissions_createdAt_idx" ON "permissions"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_organizationId_code_key" ON "permissions"("organizationId", "code");

-- CreateIndex
CREATE INDEX "user_roles_userId_idx" ON "user_roles"("userId");

-- CreateIndex
CREATE INDEX "user_roles_roleId_idx" ON "user_roles"("roleId");

-- CreateIndex
CREATE INDEX "user_roles_organizationMemberId_idx" ON "user_roles"("organizationMemberId");

-- CreateIndex
CREATE INDEX "user_roles_createdAt_idx" ON "user_roles"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_organizationMemberId_roleId_key" ON "user_roles"("organizationMemberId", "roleId");

-- CreateIndex
CREATE INDEX "role_permissions_roleId_idx" ON "role_permissions"("roleId");

-- CreateIndex
CREATE INDEX "role_permissions_permissionId_idx" ON "role_permissions"("permissionId");

-- CreateIndex
CREATE INDEX "role_permissions_createdAt_idx" ON "role_permissions"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_roleId_permissionId_key" ON "role_permissions"("roleId", "permissionId");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "sessions_expiresAt_idx" ON "sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "sessions_revokedAt_idx" ON "sessions"("revokedAt");

-- CreateIndex
CREATE INDEX "sessions_createdAt_idx" ON "sessions"("createdAt");

-- CreateIndex
CREATE INDEX "user_preferences_createdAt_idx" ON "user_preferences"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_preferences_userId_key" ON "user_preferences"("userId");

-- CreateIndex
CREATE INDEX "integrations_organizationId_idx" ON "integrations"("organizationId");

-- CreateIndex
CREATE INDEX "integrations_provider_idx" ON "integrations"("provider");

-- CreateIndex
CREATE INDEX "integrations_status_idx" ON "integrations"("status");

-- CreateIndex
CREATE INDEX "integrations_createdAt_idx" ON "integrations"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "integrations_organizationId_provider_key" ON "integrations"("organizationId", "provider");

-- CreateIndex
CREATE INDEX "credentials_integrationId_idx" ON "credentials"("integrationId");

-- CreateIndex
CREATE INDEX "credentials_key_idx" ON "credentials"("key");

-- CreateIndex
CREATE INDEX "credentials_createdAt_idx" ON "credentials"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "credentials_integrationId_key_key" ON "credentials"("integrationId", "key");

-- CreateIndex
CREATE INDEX "webhooks_integrationId_idx" ON "webhooks"("integrationId");

-- CreateIndex
CREATE INDEX "webhooks_isActive_idx" ON "webhooks"("isActive");

-- CreateIndex
CREATE INDEX "webhooks_createdAt_idx" ON "webhooks"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "webhooks_integrationId_name_key" ON "webhooks"("integrationId", "name");

-- CreateIndex
CREATE INDEX "sync_jobs_integrationId_idx" ON "sync_jobs"("integrationId");

-- CreateIndex
CREATE INDEX "sync_jobs_status_idx" ON "sync_jobs"("status");

-- CreateIndex
CREATE INDEX "sync_jobs_jobType_idx" ON "sync_jobs"("jobType");

-- CreateIndex
CREATE INDEX "sync_jobs_lastRunAt_idx" ON "sync_jobs"("lastRunAt");

-- CreateIndex
CREATE INDEX "sync_jobs_createdAt_idx" ON "sync_jobs"("createdAt");

-- CreateIndex
CREATE INDEX "knowledge_sources_organizationId_idx" ON "knowledge_sources"("organizationId");

-- CreateIndex
CREATE INDEX "knowledge_sources_repositoryId_idx" ON "knowledge_sources"("repositoryId");

-- CreateIndex
CREATE INDEX "knowledge_sources_type_idx" ON "knowledge_sources"("type");

-- CreateIndex
CREATE INDEX "knowledge_sources_isIndexed_idx" ON "knowledge_sources"("isIndexed");

-- CreateIndex
CREATE INDEX "knowledge_sources_createdAt_idx" ON "knowledge_sources"("createdAt");

-- CreateIndex
CREATE INDEX "knowledge_sources_organizationId_type_idx" ON "knowledge_sources"("organizationId", "type");

-- CreateIndex
CREATE INDEX "context_packages_organizationId_idx" ON "context_packages"("organizationId");

-- CreateIndex
CREATE INDEX "context_packages_repositoryId_idx" ON "context_packages"("repositoryId");

-- CreateIndex
CREATE INDEX "context_packages_knowledgeSourceId_idx" ON "context_packages"("knowledgeSourceId");

-- CreateIndex
CREATE INDEX "context_packages_capability_idx" ON "context_packages"("capability");

-- CreateIndex
CREATE INDEX "context_packages_createdAt_idx" ON "context_packages"("createdAt");

-- CreateIndex
CREATE INDEX "context_packages_organizationId_capability_idx" ON "context_packages"("organizationId", "capability");

-- CreateIndex
CREATE INDEX "embedding_metadata_organizationId_idx" ON "embedding_metadata"("organizationId");

-- CreateIndex
CREATE INDEX "embedding_metadata_repositoryId_idx" ON "embedding_metadata"("repositoryId");

-- CreateIndex
CREATE INDEX "embedding_metadata_sourceType_idx" ON "embedding_metadata"("sourceType");

-- CreateIndex
CREATE INDEX "embedding_metadata_sourceId_idx" ON "embedding_metadata"("sourceId");

-- CreateIndex
CREATE INDEX "embedding_metadata_vectorId_idx" ON "embedding_metadata"("vectorId");

-- CreateIndex
CREATE INDEX "embedding_metadata_createdAt_idx" ON "embedding_metadata"("createdAt");

-- CreateIndex
CREATE INDEX "embedding_metadata_vectorStore_idx" ON "embedding_metadata"("vectorStore");

-- CreateIndex
CREATE INDEX "adr_indexes_organizationId_idx" ON "adr_indexes"("organizationId");

-- CreateIndex
CREATE INDEX "adr_indexes_repositoryId_idx" ON "adr_indexes"("repositoryId");

-- CreateIndex
CREATE INDEX "adr_indexes_status_idx" ON "adr_indexes"("status");

-- CreateIndex
CREATE INDEX "adr_indexes_vectorId_idx" ON "adr_indexes"("vectorId");

-- CreateIndex
CREATE INDEX "adr_indexes_createdAt_idx" ON "adr_indexes"("createdAt");

-- CreateIndex
CREATE INDEX "adr_indexes_organizationId_status_idx" ON "adr_indexes"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "adr_indexes_organizationId_adrId_version_key" ON "adr_indexes"("organizationId", "adrId", "version");

-- CreateIndex
CREATE INDEX "learning_profiles_organizationId_idx" ON "learning_profiles"("organizationId");

-- CreateIndex
CREATE INDEX "learning_profiles_isActive_idx" ON "learning_profiles"("isActive");

-- CreateIndex
CREATE INDEX "learning_profiles_createdAt_idx" ON "learning_profiles"("createdAt");

-- CreateIndex
CREATE INDEX "coding_preferences_learningProfileId_idx" ON "coding_preferences"("learningProfileId");

-- CreateIndex
CREATE INDEX "coding_preferences_language_idx" ON "coding_preferences"("language");

-- CreateIndex
CREATE INDEX "coding_preferences_createdAt_idx" ON "coding_preferences"("createdAt");

-- CreateIndex
CREATE INDEX "architecture_preferences_learningProfileId_idx" ON "architecture_preferences"("learningProfileId");

-- CreateIndex
CREATE INDEX "architecture_preferences_architectureStyle_idx" ON "architecture_preferences"("architectureStyle");

-- CreateIndex
CREATE INDEX "architecture_preferences_createdAt_idx" ON "architecture_preferences"("createdAt");

-- CreateIndex
CREATE INDEX "review_patterns_learningProfileId_idx" ON "review_patterns"("learningProfileId");

-- CreateIndex
CREATE INDEX "review_patterns_category_idx" ON "review_patterns"("category");

-- CreateIndex
CREATE INDEX "review_patterns_createdAt_idx" ON "review_patterns"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "review_patterns_learningProfileId_patternName_key" ON "review_patterns"("learningProfileId", "patternName");

-- CreateIndex
CREATE INDEX "audit_logs_organizationId_idx" ON "audit_logs"("organizationId");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_resource_idx" ON "audit_logs"("resource");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "notifications_organizationId_idx" ON "notifications"("organizationId");

-- CreateIndex
CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");

-- CreateIndex
CREATE INDEX "notifications_type_idx" ON "notifications"("type");

-- CreateIndex
CREATE INDEX "notifications_isRead_idx" ON "notifications"("isRead");

-- CreateIndex
CREATE INDEX "notifications_createdAt_idx" ON "notifications"("createdAt");

-- CreateIndex
CREATE INDEX "configurations_organizationId_idx" ON "configurations"("organizationId");

-- CreateIndex
CREATE INDEX "configurations_key_idx" ON "configurations"("key");

-- CreateIndex
CREATE INDEX "configurations_isSystem_idx" ON "configurations"("isSystem");

-- CreateIndex
CREATE INDEX "configurations_createdAt_idx" ON "configurations"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "configurations_organizationId_key_key" ON "configurations"("organizationId", "key");

-- CreateIndex
CREATE INDEX "metrics_organizationId_idx" ON "metrics"("organizationId");

-- CreateIndex
CREATE INDEX "metrics_name_idx" ON "metrics"("name");

-- CreateIndex
CREATE INDEX "metrics_type_idx" ON "metrics"("type");

-- CreateIndex
CREATE INDEX "metrics_recordedAt_idx" ON "metrics"("recordedAt");

-- CreateIndex
CREATE INDEX "metrics_createdAt_idx" ON "metrics"("createdAt");

-- CreateIndex
CREATE INDEX "alerts_organizationId_idx" ON "alerts"("organizationId");

-- CreateIndex
CREATE INDEX "alerts_severity_idx" ON "alerts"("severity");

-- CreateIndex
CREATE INDEX "alerts_isResolved_idx" ON "alerts"("isResolved");

-- CreateIndex
CREATE INDEX "alerts_createdAt_idx" ON "alerts"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "organizations_status_idx" ON "organizations"("status");

-- CreateIndex
CREATE INDEX "organizations_isActive_idx" ON "organizations"("isActive");

-- CreateIndex
CREATE INDEX "organizations_createdAt_idx" ON "organizations"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_name_key" ON "organizations"("name");

-- CreateIndex
CREATE INDEX "projects_organizationId_idx" ON "projects"("organizationId");

-- CreateIndex
CREATE INDEX "projects_status_idx" ON "projects"("status");

-- CreateIndex
CREATE INDEX "projects_createdAt_idx" ON "projects"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "projects_organizationId_key_key" ON "projects"("organizationId", "key");

-- CreateIndex
CREATE INDEX "project_members_organizationId_idx" ON "project_members"("organizationId");

-- CreateIndex
CREATE INDEX "project_members_projectId_idx" ON "project_members"("projectId");

-- CreateIndex
CREATE INDEX "project_members_organizationMemberId_idx" ON "project_members"("organizationMemberId");

-- CreateIndex
CREATE INDEX "project_members_status_idx" ON "project_members"("status");

-- CreateIndex
CREATE INDEX "project_members_createdAt_idx" ON "project_members"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "project_members_projectId_organizationMemberId_key" ON "project_members"("projectId", "organizationMemberId");

-- CreateIndex
CREATE INDEX "repositories_organizationId_idx" ON "repositories"("organizationId");

-- CreateIndex
CREATE INDEX "repositories_projectId_idx" ON "repositories"("projectId");

-- CreateIndex
CREATE INDEX "repositories_status_idx" ON "repositories"("status");

-- CreateIndex
CREATE INDEX "repositories_provider_idx" ON "repositories"("provider");

-- CreateIndex
CREATE INDEX "repositories_createdAt_idx" ON "repositories"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "repositories_organizationId_projectId_name_key" ON "repositories"("organizationId", "projectId", "name");

-- CreateIndex
CREATE INDEX "teams_organizationId_idx" ON "teams"("organizationId");

-- CreateIndex
CREATE INDEX "teams_type_idx" ON "teams"("type");

-- CreateIndex
CREATE INDEX "teams_createdAt_idx" ON "teams"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "teams_organizationId_name_key" ON "teams"("organizationId", "name");

-- CreateIndex
CREATE INDEX "organization_members_organizationId_idx" ON "organization_members"("organizationId");

-- CreateIndex
CREATE INDEX "organization_members_userId_idx" ON "organization_members"("userId");

-- CreateIndex
CREATE INDEX "organization_members_status_idx" ON "organization_members"("status");

-- CreateIndex
CREATE INDEX "organization_members_createdAt_idx" ON "organization_members"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "organization_members_organizationId_userId_key" ON "organization_members"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "team_members_teamId_idx" ON "team_members"("teamId");

-- CreateIndex
CREATE INDEX "team_members_organizationMemberId_idx" ON "team_members"("organizationMemberId");

-- CreateIndex
CREATE INDEX "team_members_createdAt_idx" ON "team_members"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "team_members_teamId_organizationMemberId_key" ON "team_members"("teamId", "organizationMemberId");

-- CreateIndex
CREATE INDEX "work_items_organizationId_idx" ON "work_items"("organizationId");

-- CreateIndex
CREATE INDEX "work_items_projectId_idx" ON "work_items"("projectId");

-- CreateIndex
CREATE INDEX "work_items_type_idx" ON "work_items"("type");

-- CreateIndex
CREATE INDEX "work_items_status_idx" ON "work_items"("status");

-- CreateIndex
CREATE INDEX "work_items_azureWorkItemId_idx" ON "work_items"("azureWorkItemId");

-- CreateIndex
CREATE INDEX "work_items_createdAt_idx" ON "work_items"("createdAt");

-- CreateIndex
CREATE INDEX "planning_sessions_organizationId_idx" ON "planning_sessions"("organizationId");

-- CreateIndex
CREATE INDEX "planning_sessions_workItemId_idx" ON "planning_sessions"("workItemId");

-- CreateIndex
CREATE INDEX "planning_sessions_status_idx" ON "planning_sessions"("status");

-- CreateIndex
CREATE INDEX "planning_sessions_createdAt_idx" ON "planning_sessions"("createdAt");

-- CreateIndex
CREATE INDEX "impact_reports_organizationId_idx" ON "impact_reports"("organizationId");

-- CreateIndex
CREATE INDEX "impact_reports_planningSessionId_idx" ON "impact_reports"("planningSessionId");

-- CreateIndex
CREATE INDEX "impact_reports_createdAt_idx" ON "impact_reports"("createdAt");

-- CreateIndex
CREATE INDEX "implementation_plans_organizationId_idx" ON "implementation_plans"("organizationId");

-- CreateIndex
CREATE INDEX "implementation_plans_planningSessionId_idx" ON "implementation_plans"("planningSessionId");

-- CreateIndex
CREATE INDEX "implementation_plans_workItemId_idx" ON "implementation_plans"("workItemId");

-- CreateIndex
CREATE INDEX "implementation_plans_createdAt_idx" ON "implementation_plans"("createdAt");

-- CreateIndex
CREATE INDEX "repository_profiles_status_idx" ON "repository_profiles"("status");

-- CreateIndex
CREATE INDEX "repository_profiles_createdAt_idx" ON "repository_profiles"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "repository_profiles_repositoryId_key" ON "repository_profiles"("repositoryId");

-- CreateIndex
CREATE INDEX "dependency_graphs_repositoryProfileId_idx" ON "dependency_graphs"("repositoryProfileId");

-- CreateIndex
CREATE INDEX "dependency_graphs_source_idx" ON "dependency_graphs"("source");

-- CreateIndex
CREATE INDEX "dependency_graphs_target_idx" ON "dependency_graphs"("target");

-- CreateIndex
CREATE INDEX "dependency_graphs_createdAt_idx" ON "dependency_graphs"("createdAt");

-- CreateIndex
CREATE INDEX "dependency_graphs_dependencyType_idx" ON "dependency_graphs"("dependencyType");

-- CreateIndex
CREATE INDEX "architecture_profiles_repositoryProfileId_idx" ON "architecture_profiles"("repositoryProfileId");

-- CreateIndex
CREATE INDEX "architecture_profiles_architectureStyle_idx" ON "architecture_profiles"("architectureStyle");

-- CreateIndex
CREATE INDEX "architecture_profiles_createdAt_idx" ON "architecture_profiles"("createdAt");

-- CreateIndex
CREATE INDEX "api_catalog_repositoryProfileId_idx" ON "api_catalog"("repositoryProfileId");

-- CreateIndex
CREATE INDEX "api_catalog_method_idx" ON "api_catalog"("method");

-- CreateIndex
CREATE INDEX "api_catalog_path_idx" ON "api_catalog"("path");

-- CreateIndex
CREATE INDEX "api_catalog_createdAt_idx" ON "api_catalog"("createdAt");

-- CreateIndex
CREATE INDEX "api_catalog_filePath_idx" ON "api_catalog"("filePath");

-- CreateIndex
CREATE UNIQUE INDEX "api_catalog_repositoryProfileId_method_path_key" ON "api_catalog"("repositoryProfileId", "method", "path");

-- CreateIndex
CREATE INDEX "database_catalogs_repositoryProfileId_idx" ON "database_catalogs"("repositoryProfileId");

-- CreateIndex
CREATE INDEX "database_catalogs_engine_idx" ON "database_catalogs"("engine");

-- CreateIndex
CREATE INDEX "database_catalogs_createdAt_idx" ON "database_catalogs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "database_catalogs_repositoryProfileId_name_key" ON "database_catalogs"("repositoryProfileId", "name");

-- CreateIndex
CREATE INDEX "repository_services_repositoryProfileId_idx" ON "repository_services"("repositoryProfileId");

-- CreateIndex
CREATE INDEX "repository_services_type_idx" ON "repository_services"("type");

-- CreateIndex
CREATE INDEX "repository_services_createdAt_idx" ON "repository_services"("createdAt");

-- CreateIndex
CREATE INDEX "repository_services_rootPath_idx" ON "repository_services"("rootPath");

-- CreateIndex
CREATE UNIQUE INDEX "repository_services_repositoryProfileId_name_key" ON "repository_services"("repositoryProfileId", "name");

-- CreateIndex
CREATE INDEX "repository_indexes_repositoryProfileId_idx" ON "repository_indexes"("repositoryProfileId");

-- CreateIndex
CREATE INDEX "repository_indexes_status_idx" ON "repository_indexes"("status");

-- CreateIndex
CREATE INDEX "repository_indexes_branch_idx" ON "repository_indexes"("branch");

-- CreateIndex
CREATE INDEX "repository_indexes_createdAt_idx" ON "repository_indexes"("createdAt");

-- CreateIndex
CREATE INDEX "repository_indexes_commitSha_idx" ON "repository_indexes"("commitSha");

-- CreateIndex
CREATE INDEX "test_suites_organizationId_idx" ON "test_suites"("organizationId");

-- CreateIndex
CREATE INDEX "test_suites_type_idx" ON "test_suites"("type");

-- CreateIndex
CREATE INDEX "test_suites_createdAt_idx" ON "test_suites"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "test_suites_organizationId_name_key" ON "test_suites"("organizationId", "name");

-- CreateIndex
CREATE INDEX "test_cases_organizationId_idx" ON "test_cases"("organizationId");

-- CreateIndex
CREATE INDEX "test_cases_testSuiteId_idx" ON "test_cases"("testSuiteId");

-- CreateIndex
CREATE INDEX "test_cases_status_idx" ON "test_cases"("status");

-- CreateIndex
CREATE INDEX "test_cases_createdAt_idx" ON "test_cases"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "test_cases_testSuiteId_name_key" ON "test_cases"("testSuiteId", "name");

-- CreateIndex
CREATE INDEX "test_runs_organizationId_idx" ON "test_runs"("organizationId");

-- CreateIndex
CREATE INDEX "test_runs_testSuiteId_idx" ON "test_runs"("testSuiteId");

-- CreateIndex
CREATE INDEX "test_runs_generatedCodeId_idx" ON "test_runs"("generatedCodeId");

-- CreateIndex
CREATE INDEX "test_runs_status_idx" ON "test_runs"("status");

-- CreateIndex
CREATE INDEX "test_runs_createdAt_idx" ON "test_runs"("createdAt");

-- CreateIndex
CREATE INDEX "coverage_reports_organizationId_idx" ON "coverage_reports"("organizationId");

-- CreateIndex
CREATE INDEX "coverage_reports_testRunId_idx" ON "coverage_reports"("testRunId");

-- CreateIndex
CREATE INDEX "coverage_reports_createdAt_idx" ON "coverage_reports"("createdAt");

-- CreateIndex
CREATE INDEX "autofix_history_organizationId_idx" ON "autofix_history"("organizationId");

-- CreateIndex
CREATE INDEX "autofix_history_testRunId_idx" ON "autofix_history"("testRunId");

-- CreateIndex
CREATE INDEX "autofix_history_success_idx" ON "autofix_history"("success");

-- CreateIndex
CREATE INDEX "autofix_history_createdAt_idx" ON "autofix_history"("createdAt");

-- CreateIndex
CREATE INDEX "validation_reports_organizationId_idx" ON "validation_reports"("organizationId");

-- CreateIndex
CREATE INDEX "validation_reports_generatedCodeId_idx" ON "validation_reports"("generatedCodeId");

-- CreateIndex
CREATE INDEX "validation_reports_overallStatus_idx" ON "validation_reports"("overallStatus");

-- CreateIndex
CREATE INDEX "validation_reports_createdAt_idx" ON "validation_reports"("createdAt");

-- CreateIndex
CREATE INDEX "validation_findings_organizationId_idx" ON "validation_findings"("organizationId");

-- CreateIndex
CREATE INDEX "validation_findings_validationReportId_idx" ON "validation_findings"("validationReportId");

-- CreateIndex
CREATE INDEX "validation_findings_category_idx" ON "validation_findings"("category");

-- CreateIndex
CREATE INDEX "validation_findings_severity_idx" ON "validation_findings"("severity");

-- CreateIndex
CREATE INDEX "validation_findings_status_idx" ON "validation_findings"("status");

-- CreateIndex
CREATE INDEX "validation_findings_createdAt_idx" ON "validation_findings"("createdAt");

-- CreateIndex
CREATE INDEX "security_reports_organizationId_idx" ON "security_reports"("organizationId");

-- CreateIndex
CREATE INDEX "security_reports_validationReportId_idx" ON "security_reports"("validationReportId");

-- CreateIndex
CREATE INDEX "security_reports_status_idx" ON "security_reports"("status");

-- CreateIndex
CREATE INDEX "security_reports_createdAt_idx" ON "security_reports"("createdAt");

-- CreateIndex
CREATE INDEX "performance_reports_organizationId_idx" ON "performance_reports"("organizationId");

-- CreateIndex
CREATE INDEX "performance_reports_validationReportId_idx" ON "performance_reports"("validationReportId");

-- CreateIndex
CREATE INDEX "performance_reports_status_idx" ON "performance_reports"("status");

-- CreateIndex
CREATE INDEX "performance_reports_createdAt_idx" ON "performance_reports"("createdAt");

-- CreateIndex
CREATE INDEX "cost_reports_organizationId_idx" ON "cost_reports"("organizationId");

-- CreateIndex
CREATE INDEX "cost_reports_validationReportId_idx" ON "cost_reports"("validationReportId");

-- CreateIndex
CREATE INDEX "cost_reports_status_idx" ON "cost_reports"("status");

-- CreateIndex
CREATE INDEX "cost_reports_createdAt_idx" ON "cost_reports"("createdAt");

-- CreateIndex
CREATE INDEX "compliance_reports_organizationId_idx" ON "compliance_reports"("organizationId");

-- CreateIndex
CREATE INDEX "compliance_reports_validationReportId_idx" ON "compliance_reports"("validationReportId");

-- CreateIndex
CREATE INDEX "compliance_reports_status_idx" ON "compliance_reports"("status");

-- CreateIndex
CREATE INDEX "compliance_reports_createdAt_idx" ON "compliance_reports"("createdAt");

-- AddForeignKey
ALTER TABLE "capabilities" ADD CONSTRAINT "capabilities_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prompts" ADD CONSTRAINT "prompts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prompts" ADD CONSTRAINT "prompts_capabilityId_fkey" FOREIGN KEY ("capabilityId") REFERENCES "capabilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "models" ADD CONSTRAINT "models_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "models" ADD CONSTRAINT "models_capabilityId_fkey" FOREIGN KEY ("capabilityId") REFERENCES "capabilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "graphs" ADD CONSTRAINT "graphs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "graphs" ADD CONSTRAINT "graphs_capabilityId_fkey" FOREIGN KEY ("capabilityId") REFERENCES "capabilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_graphId_fkey" FOREIGN KEY ("graphId") REFERENCES "graphs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_states" ADD CONSTRAINT "workflow_states_workflowRunId_fkey" FOREIGN KEY ("workflowRunId") REFERENCES "workflow_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_checkpoints" ADD CONSTRAINT "workflow_checkpoints_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_checkpoints" ADD CONSTRAINT "workflow_checkpoints_workflowRunId_fkey" FOREIGN KEY ("workflowRunId") REFERENCES "workflow_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_events" ADD CONSTRAINT "workflow_events_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_events" ADD CONSTRAINT "workflow_events_workflowRunId_fkey" FOREIGN KEY ("workflowRunId") REFERENCES "workflow_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "human_approvals" ADD CONSTRAINT "human_approvals_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "human_approvals" ADD CONSTRAINT "human_approvals_workflowRunId_fkey" FOREIGN KEY ("workflowRunId") REFERENCES "workflow_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "human_approvals" ADD CONSTRAINT "human_approvals_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "human_approvals" ADD CONSTRAINT "human_approvals_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_executions" ADD CONSTRAINT "ai_executions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_executions" ADD CONSTRAINT "ai_executions_workflowRunId_fkey" FOREIGN KEY ("workflowRunId") REFERENCES "workflow_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_executions" ADD CONSTRAINT "ai_executions_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "prompts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_executions" ADD CONSTRAINT "ai_executions_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "models"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_executions" ADD CONSTRAINT "ai_executions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_executions" ADD CONSTRAINT "ai_executions_generatedCodeId_fkey" FOREIGN KEY ("generatedCodeId") REFERENCES "generated_code"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "repositories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commits" ADD CONSTRAINT "commits_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commits" ADD CONSTRAINT "commits_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "repositories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commits" ADD CONSTRAINT "commits_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pull_requests" ADD CONSTRAINT "pull_requests_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pull_requests" ADD CONSTRAINT "pull_requests_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "repositories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pull_requests" ADD CONSTRAINT "pull_requests_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pull_requests" ADD CONSTRAINT "pull_requests_commitId_fkey" FOREIGN KEY ("commitId") REFERENCES "commits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pull_requests" ADD CONSTRAINT "pull_requests_generatedCodeId_fkey" FOREIGN KEY ("generatedCodeId") REFERENCES "generated_code"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pull_request_reviews" ADD CONSTRAINT "pull_request_reviews_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pull_request_reviews" ADD CONSTRAINT "pull_request_reviews_pullRequestId_fkey" FOREIGN KEY ("pullRequestId") REFERENCES "pull_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pull_request_reviews" ADD CONSTRAINT "pull_request_reviews_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pull_request_merge_results" ADD CONSTRAINT "pull_request_merge_results_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pull_request_merge_results" ADD CONSTRAINT "pull_request_merge_results_pullRequestId_fkey" FOREIGN KEY ("pullRequestId") REFERENCES "pull_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pull_request_merge_results" ADD CONSTRAINT "pull_request_merge_results_mergedById_fkey" FOREIGN KEY ("mergedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deployment_reports" ADD CONSTRAINT "deployment_reports_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deployment_reports" ADD CONSTRAINT "deployment_reports_pullRequestId_fkey" FOREIGN KEY ("pullRequestId") REFERENCES "pull_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_code" ADD CONSTRAINT "generated_code_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_code" ADD CONSTRAINT "generated_code_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "work_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_code" ADD CONSTRAINT "generated_code_lldId_fkey" FOREIGN KEY ("lldId") REFERENCES "llds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "code_generations" ADD CONSTRAINT "code_generations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "code_generations" ADD CONSTRAINT "code_generations_generatedCodeId_fkey" FOREIGN KEY ("generatedCodeId") REFERENCES "generated_code"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "developer_reviews" ADD CONSTRAINT "developer_reviews_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "developer_reviews" ADD CONSTRAINT "developer_reviews_generatedCodeId_fkey" FOREIGN KEY ("generatedCodeId") REFERENCES "generated_code"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "developer_reviews" ADD CONSTRAINT "developer_reviews_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consensus_results" ADD CONSTRAINT "consensus_results_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consensus_results" ADD CONSTRAINT "consensus_results_generatedCodeId_fkey" FOREIGN KEY ("generatedCodeId") REFERENCES "generated_code"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "code_chats" ADD CONSTRAINT "code_chats_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "code_chats" ADD CONSTRAINT "code_chats_generatedCodeId_fkey" FOREIGN KEY ("generatedCodeId") REFERENCES "generated_code"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "code_chats" ADD CONSTRAINT "code_chats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "code_refactors" ADD CONSTRAINT "code_refactors_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "code_refactors" ADD CONSTRAINT "code_refactors_generatedCodeId_fkey" FOREIGN KEY ("generatedCodeId") REFERENCES "generated_code"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "code_refactors" ADD CONSTRAINT "code_refactors_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brds" ADD CONSTRAINT "brds_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brds" ADD CONSTRAINT "brds_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "repositories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brds" ADD CONSTRAINT "brds_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "work_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tsds" ADD CONSTRAINT "tsds_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tsds" ADD CONSTRAINT "tsds_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "repositories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tsds" ADD CONSTRAINT "tsds_brdId_fkey" FOREIGN KEY ("brdId") REFERENCES "brds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tsds" ADD CONSTRAINT "tsds_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "work_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llds" ADD CONSTRAINT "llds_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llds" ADD CONSTRAINT "llds_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "repositories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llds" ADD CONSTRAINT "llds_tsdId_fkey" FOREIGN KEY ("tsdId") REFERENCES "tsds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llds" ADD CONSTRAINT "llds_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "work_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adrs" ADD CONSTRAINT "adrs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adrs" ADD CONSTRAINT "adrs_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "repositories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adrs" ADD CONSTRAINT "adrs_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "work_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagrams" ADD CONSTRAINT "diagrams_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagrams" ADD CONSTRAINT "diagrams_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "repositories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagrams" ADD CONSTRAINT "diagrams_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "work_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentation_versions" ADD CONSTRAINT "documentation_versions_brdId_fkey" FOREIGN KEY ("brdId") REFERENCES "brds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentation_versions" ADD CONSTRAINT "documentation_versions_tsdId_fkey" FOREIGN KEY ("tsdId") REFERENCES "tsds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentation_versions" ADD CONSTRAINT "documentation_versions_lldId_fkey" FOREIGN KEY ("lldId") REFERENCES "llds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentation_versions" ADD CONSTRAINT "documentation_versions_adrId_fkey" FOREIGN KEY ("adrId") REFERENCES "adrs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentation_versions" ADD CONSTRAINT "documentation_versions_diagramId_fkey" FOREIGN KEY ("diagramId") REFERENCES "diagrams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentation_versions" ADD CONSTRAINT "documentation_versions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_organizationMemberId_fkey" FOREIGN KEY ("organizationMemberId") REFERENCES "organization_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "integrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "integrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_jobs" ADD CONSTRAINT "sync_jobs_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "integrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_sources" ADD CONSTRAINT "knowledge_sources_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_sources" ADD CONSTRAINT "knowledge_sources_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "repositories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "context_packages" ADD CONSTRAINT "context_packages_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "context_packages" ADD CONSTRAINT "context_packages_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "repositories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "context_packages" ADD CONSTRAINT "context_packages_knowledgeSourceId_fkey" FOREIGN KEY ("knowledgeSourceId") REFERENCES "knowledge_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "embedding_metadata" ADD CONSTRAINT "embedding_metadata_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "embedding_metadata" ADD CONSTRAINT "embedding_metadata_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "repositories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adr_indexes" ADD CONSTRAINT "adr_indexes_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adr_indexes" ADD CONSTRAINT "adr_indexes_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "repositories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_profiles" ADD CONSTRAINT "learning_profiles_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coding_preferences" ADD CONSTRAINT "coding_preferences_learningProfileId_fkey" FOREIGN KEY ("learningProfileId") REFERENCES "learning_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "architecture_preferences" ADD CONSTRAINT "architecture_preferences_learningProfileId_fkey" FOREIGN KEY ("learningProfileId") REFERENCES "learning_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_patterns" ADD CONSTRAINT "review_patterns_learningProfileId_fkey" FOREIGN KEY ("learningProfileId") REFERENCES "learning_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_workflowRunId_fkey" FOREIGN KEY ("workflowRunId") REFERENCES "workflow_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "configurations" ADD CONSTRAINT "configurations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metrics" ADD CONSTRAINT "metrics_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_organizationMemberId_fkey" FOREIGN KEY ("organizationMemberId") REFERENCES "organization_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repositories" ADD CONSTRAINT "repositories_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repositories" ADD CONSTRAINT "repositories_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_organizationMemberId_fkey" FOREIGN KEY ("organizationMemberId") REFERENCES "organization_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planning_sessions" ADD CONSTRAINT "planning_sessions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planning_sessions" ADD CONSTRAINT "planning_sessions_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "work_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "impact_reports" ADD CONSTRAINT "impact_reports_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "impact_reports" ADD CONSTRAINT "impact_reports_planningSessionId_fkey" FOREIGN KEY ("planningSessionId") REFERENCES "planning_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "implementation_plans" ADD CONSTRAINT "implementation_plans_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "implementation_plans" ADD CONSTRAINT "implementation_plans_planningSessionId_fkey" FOREIGN KEY ("planningSessionId") REFERENCES "planning_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "implementation_plans" ADD CONSTRAINT "implementation_plans_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "work_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repository_profiles" ADD CONSTRAINT "repository_profiles_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "repositories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dependency_graphs" ADD CONSTRAINT "dependency_graphs_repositoryProfileId_fkey" FOREIGN KEY ("repositoryProfileId") REFERENCES "repository_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "architecture_profiles" ADD CONSTRAINT "architecture_profiles_repositoryProfileId_fkey" FOREIGN KEY ("repositoryProfileId") REFERENCES "repository_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_catalog" ADD CONSTRAINT "api_catalog_repositoryProfileId_fkey" FOREIGN KEY ("repositoryProfileId") REFERENCES "repository_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "database_catalogs" ADD CONSTRAINT "database_catalogs_repositoryProfileId_fkey" FOREIGN KEY ("repositoryProfileId") REFERENCES "repository_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repository_services" ADD CONSTRAINT "repository_services_repositoryProfileId_fkey" FOREIGN KEY ("repositoryProfileId") REFERENCES "repository_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repository_indexes" ADD CONSTRAINT "repository_indexes_repositoryProfileId_fkey" FOREIGN KEY ("repositoryProfileId") REFERENCES "repository_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_suites" ADD CONSTRAINT "test_suites_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_cases" ADD CONSTRAINT "test_cases_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_cases" ADD CONSTRAINT "test_cases_testSuiteId_fkey" FOREIGN KEY ("testSuiteId") REFERENCES "test_suites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_runs" ADD CONSTRAINT "test_runs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_runs" ADD CONSTRAINT "test_runs_testSuiteId_fkey" FOREIGN KEY ("testSuiteId") REFERENCES "test_suites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_runs" ADD CONSTRAINT "test_runs_generatedCodeId_fkey" FOREIGN KEY ("generatedCodeId") REFERENCES "generated_code"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coverage_reports" ADD CONSTRAINT "coverage_reports_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coverage_reports" ADD CONSTRAINT "coverage_reports_testRunId_fkey" FOREIGN KEY ("testRunId") REFERENCES "test_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "autofix_history" ADD CONSTRAINT "autofix_history_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "autofix_history" ADD CONSTRAINT "autofix_history_testRunId_fkey" FOREIGN KEY ("testRunId") REFERENCES "test_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validation_reports" ADD CONSTRAINT "validation_reports_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validation_reports" ADD CONSTRAINT "validation_reports_generatedCodeId_fkey" FOREIGN KEY ("generatedCodeId") REFERENCES "generated_code"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validation_findings" ADD CONSTRAINT "validation_findings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validation_findings" ADD CONSTRAINT "validation_findings_validationReportId_fkey" FOREIGN KEY ("validationReportId") REFERENCES "validation_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_reports" ADD CONSTRAINT "security_reports_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_reports" ADD CONSTRAINT "security_reports_validationReportId_fkey" FOREIGN KEY ("validationReportId") REFERENCES "validation_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_reports" ADD CONSTRAINT "performance_reports_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_reports" ADD CONSTRAINT "performance_reports_validationReportId_fkey" FOREIGN KEY ("validationReportId") REFERENCES "validation_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_reports" ADD CONSTRAINT "cost_reports_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_reports" ADD CONSTRAINT "cost_reports_validationReportId_fkey" FOREIGN KEY ("validationReportId") REFERENCES "validation_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_reports" ADD CONSTRAINT "compliance_reports_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_reports" ADD CONSTRAINT "compliance_reports_validationReportId_fkey" FOREIGN KEY ("validationReportId") REFERENCES "validation_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
