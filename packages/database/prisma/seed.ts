const { PrismaClient } = require('../generated/client');

const prisma = new PrismaClient();

const SYSTEM_ORGANIZATION = {
  name: 'System Organization',
  slug: 'system',
  description: 'Default organization for platform bootstrap data.',
};

const PERMISSIONS = [
  ['organization:read', 'Organization Read', 'organization', 'read'],
  ['organization:manage', 'Organization Manage', 'organization', 'manage'],
  ['project:read', 'Project Read', 'project', 'read'],
  ['project:manage', 'Project Manage', 'project', 'manage'],
  ['repository:read', 'Repository Read', 'repository', 'read'],
  ['repository:manage', 'Repository Manage', 'repository', 'manage'],
  ['work-item:read', 'Work Item Read', 'work_item', 'read'],
  ['work-item:manage', 'Work Item Manage', 'work_item', 'manage'],
  ['documentation:read', 'Documentation Read', 'documentation', 'read'],
  ['documentation:approve', 'Documentation Approve', 'documentation', 'approve'],
  ['development:execute', 'Development Execute', 'development', 'execute'],
  ['validation:execute', 'Validation Execute', 'validation', 'execute'],
  ['testing:execute', 'Testing Execute', 'testing', 'execute'],
  ['delivery:manage', 'Delivery Manage', 'delivery', 'manage'],
  ['ai-platform:manage', 'AI Platform Manage', 'ai_platform', 'manage'],
  ['audit:read', 'Audit Read', 'audit', 'read'],
];

const ROLES = [
  {
    name: 'Platform Administrator',
    description: 'Full administrative access to the platform.',
    permissionCodes: PERMISSIONS.map(([code]) => code),
    isDefault: false,
  },
  {
    name: 'Engineering Manager',
    description: 'Manages projects, repositories, delivery, and approvals.',
    permissionCodes: [
      'organization:read',
      'project:manage',
      'repository:manage',
      'work-item:manage',
      'documentation:approve',
      'delivery:manage',
      'audit:read',
    ],
    isDefault: false,
  },
  {
    name: 'Developer',
    description: 'Executes planning, development, validation, and testing workflows.',
    permissionCodes: [
      'organization:read',
      'project:read',
      'repository:read',
      'work-item:manage',
      'documentation:read',
      'development:execute',
      'validation:execute',
      'testing:execute',
    ],
    isDefault: true,
  },
  {
    name: 'Reviewer',
    description: 'Reviews and approves generated artifacts.',
    permissionCodes: [
      'organization:read',
      'project:read',
      'repository:read',
      'work-item:read',
      'documentation:approve',
      'audit:read',
    ],
    isDefault: false,
  },
];

const CAPABILITIES = [
  {
    key: 'repository.analysis',
    name: 'Repository Analysis',
    description: 'Analyze repositories and produce repository intelligence profiles.',
    graphType: 'REPOSITORY',
  },
  {
    key: 'documentation.generation',
    name: 'Documentation Generation',
    description: 'Generate and update BRDs, TSDs, LLDs, ADRs, and diagrams.',
    graphType: 'DOCUMENTATION',
  },
  {
    key: 'planning.impact-analysis',
    name: 'Planning Impact Analysis',
    description: 'Classify work items, assess impact, and produce implementation plans.',
    graphType: 'PLANNING',
  },
  {
    key: 'development.code-generation',
    name: 'Code Generation',
    description: 'Generate implementation code from approved designs and context.',
    graphType: 'DEVELOPMENT',
  },
  {
    key: 'validation.review',
    name: 'Validation Review',
    description: 'Run architecture, security, performance, cost, and compliance validation.',
    graphType: 'VALIDATION',
  },
  {
    key: 'testing.automation',
    name: 'Testing Automation',
    description: 'Generate, execute, and auto-fix test suites.',
    graphType: 'TESTING',
  },
  {
    key: 'delivery.pull-request',
    name: 'Pull Request Delivery',
    description: 'Create branches, commits, pull requests, and delivery evidence.',
    graphType: 'DELIVERY',
  },
  {
    key: 'learning.organization',
    name: 'Organizational Learning',
    description: 'Extract and preserve organization-specific engineering preferences.',
    graphType: 'LEARNING',
  },
];

const PROMPTS = [
  {
    capabilityKey: 'repository.analysis',
    name: 'Repository Analysis Default',
    systemPrompt:
      'Analyze the repository using the provided files, metadata, and standards. Return structured repository intelligence only.',
    userTemplate: 'Repository context: {{repositoryContext}}',
  },
  {
    capabilityKey: 'documentation.generation',
    name: 'Documentation Generation Default',
    systemPrompt:
      'Generate enterprise SDLC documentation that is traceable, reviewable, and aligned to approved architecture standards.',
    userTemplate:
      'Work item: {{workItem}}\nRepository context: {{repositoryContext}}\nExisting documentation: {{documentationContext}}',
  },
  {
    capabilityKey: 'planning.impact-analysis',
    name: 'Impact Analysis Default',
    systemPrompt:
      'Assess implementation impact across architecture, APIs, database, tests, security, and delivery.',
    userTemplate: 'Work item: {{workItem}}\nRepository profile: {{repositoryProfile}}',
  },
  {
    capabilityKey: 'development.code-generation',
    name: 'Code Generation Default',
    systemPrompt:
      'Generate production-grade code that follows repository architecture, coding standards, security rules, and approved design.',
    userTemplate: 'Approved LLD: {{lld}}\nContext package: {{contextPackage}}',
  },
  {
    capabilityKey: 'validation.review',
    name: 'Validation Review Default',
    systemPrompt:
      'Validate generated changes for architecture, security, performance, cost, compliance, and maintainability.',
    userTemplate: 'Generated code: {{generatedCode}}\nValidation policy: {{validationPolicy}}',
  },
  {
    capabilityKey: 'testing.automation',
    name: 'Testing Automation Default',
    systemPrompt:
      'Generate and evaluate tests that prove the requested behavior and protect against regressions.',
    userTemplate: 'Implementation plan: {{implementationPlan}}\nGenerated code: {{generatedCode}}',
  },
  {
    capabilityKey: 'delivery.pull-request',
    name: 'Pull Request Delivery Default',
    systemPrompt:
      'Prepare delivery metadata, pull request content, and synchronization details for human review.',
    userTemplate:
      'Approved artifacts: {{approvedArtifacts}}\nValidation summary: {{validationSummary}}\nTest summary: {{testSummary}}',
  },
  {
    capabilityKey: 'learning.organization',
    name: 'Organizational Learning Default',
    systemPrompt:
      'Extract durable engineering preferences, review patterns, and architectural conventions from completed work.',
    userTemplate: 'Completed workflow evidence: {{workflowEvidence}}',
  },
];

const MODEL_BY_CAPABILITY = {
  'repository.analysis': {
    provider: 'OPENAI',
    modelId: 'gpt-4.1-mini-repository',
    name: 'gpt-4.1-mini',
    displayName: 'GPT-4.1 Mini - Repository Analysis',
    maxTokens: 8192,
    temperature: 0.1,
  },
  'documentation.generation': {
    provider: 'OPENAI',
    modelId: 'gpt-4.1-documentation',
    name: 'gpt-4.1',
    displayName: 'GPT-4.1 - Documentation',
    maxTokens: 16384,
    temperature: 0.2,
  },
  'planning.impact-analysis': {
    provider: 'OPENAI',
    modelId: 'gpt-4.1-mini-planning',
    name: 'gpt-4.1-mini',
    displayName: 'GPT-4.1 Mini - Planning',
    maxTokens: 8192,
    temperature: 0.1,
  },
  'development.code-generation': {
    provider: 'ANTHROPIC',
    modelId: 'claude-3-5-sonnet-development',
    name: 'claude-3-5-sonnet',
    displayName: 'Claude 3.5 Sonnet - Development',
    maxTokens: 16384,
    temperature: 0.1,
  },
  'validation.review': {
    provider: 'OPENAI',
    modelId: 'gpt-4.1-validation',
    name: 'gpt-4.1',
    displayName: 'GPT-4.1 - Validation',
    maxTokens: 8192,
    temperature: 0,
  },
  'testing.automation': {
    provider: 'OPENAI',
    modelId: 'gpt-4.1-mini-testing',
    name: 'gpt-4.1-mini',
    displayName: 'GPT-4.1 Mini - Testing',
    maxTokens: 8192,
    temperature: 0.1,
  },
  'delivery.pull-request': {
    provider: 'OPENAI',
    modelId: 'gpt-4.1-mini-delivery',
    name: 'gpt-4.1-mini',
    displayName: 'GPT-4.1 Mini - Delivery',
    maxTokens: 4096,
    temperature: 0.1,
  },
  'learning.organization': {
    provider: 'OPENAI',
    modelId: 'gpt-4.1-mini-learning',
    name: 'gpt-4.1-mini',
    displayName: 'GPT-4.1 Mini - Learning',
    maxTokens: 8192,
    temperature: 0.1,
  },
};

const CONFIGURATIONS = [
  ['ai.maxRetryCount', 3, 'Default retry limit for AI executions.'],
  ['ai.defaultTimeoutMs', 120000, 'Default timeout for AI execution requests.'],
  ['workflow.requireHumanApproval', true, 'Require human approval at documented checkpoints.'],
  ['workflow.checkpointEnabled', true, 'Persist workflow checkpoints for recovery.'],
  ['validation.minimumPassScore', 0.85, 'Minimum score required for validation pass.'],
  ['testing.autoFixMaxAttempts', 3, 'Maximum auto-fix attempts for failed test runs.'],
  [
    'delivery.requirePrApproval',
    true,
    'Require pull request approval before merge synchronization.',
  ],
];

async function upsertConfiguration(organizationId, key, value, description) {
  const existing = await prisma.configuration.findFirst({
    where: { organizationId, key },
  });

  if (existing) {
    return prisma.configuration.update({
      where: { id: existing.id },
      data: { value, description, isSystem: true },
    });
  }

  return prisma.configuration.create({
    data: {
      organizationId,
      key,
      value,
      description,
      isSystem: true,
    },
  });
}

async function main() {
  const organization = await prisma.organization.upsert({
    where: { slug: SYSTEM_ORGANIZATION.slug },
    update: {
      name: SYSTEM_ORGANIZATION.name,
      description: SYSTEM_ORGANIZATION.description,
      status: 'ACTIVE',
      isActive: true,
    },
    create: {
      ...SYSTEM_ORGANIZATION,
      status: 'ACTIVE',
      isActive: true,
    },
  });

  const permissionByCode = new Map();

  for (const [code, name, resource, action] of PERMISSIONS) {
    const permission = await prisma.permission.upsert({
      where: {
        organizationId_code: {
          organizationId: organization.id,
          code,
        },
      },
      update: {
        name,
        resource,
        action,
        isSystem: true,
      },
      create: {
        organizationId: organization.id,
        code,
        name,
        resource,
        action,
        isSystem: true,
      },
    });

    permissionByCode.set(code, permission);
  }

  for (const roleSeed of ROLES) {
    const role = await prisma.role.upsert({
      where: {
        organizationId_name: {
          organizationId: organization.id,
          name: roleSeed.name,
        },
      },
      update: {
        description: roleSeed.description,
        isDefault: roleSeed.isDefault,
        isSystem: true,
      },
      create: {
        organizationId: organization.id,
        name: roleSeed.name,
        description: roleSeed.description,
        isDefault: roleSeed.isDefault,
        isSystem: true,
      },
    });

    for (const permissionCode of roleSeed.permissionCodes) {
      const permission = permissionByCode.get(permissionCode);
      if (!permission) {
        throw new Error(`Missing permission for role seed: ${permissionCode}`);
      }

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: permission.id,
        },
      });
    }
  }

  const capabilityByKey = new Map();

  for (const capabilitySeed of CAPABILITIES) {
    const capability = await prisma.capability.upsert({
      where: {
        organizationId_key: {
          organizationId: organization.id,
          key: capabilitySeed.key,
        },
      },
      update: {
        name: capabilitySeed.name,
        description: capabilitySeed.description,
        isEnabled: true,
        version: '1.0.0',
      },
      create: {
        organizationId: organization.id,
        key: capabilitySeed.key,
        name: capabilitySeed.name,
        description: capabilitySeed.description,
        isEnabled: true,
        version: '1.0.0',
      },
    });

    capabilityByKey.set(capabilitySeed.key, capability);

    await prisma.graph.upsert({
      where: {
        capabilityId_name_version: {
          capabilityId: capability.id,
          name: `${capabilitySeed.name} Workflow`,
          version: '1.0.0',
        },
      },
      update: {
        type: capabilitySeed.graphType,
        entryNode: 'start',
        isActive: true,
        definition: {
          nodes: ['start', 'execute', 'approval', 'complete'],
          edges: [
            ['start', 'execute'],
            ['execute', 'approval'],
            ['approval', 'complete'],
          ],
        },
      },
      create: {
        organizationId: organization.id,
        capabilityId: capability.id,
        name: `${capabilitySeed.name} Workflow`,
        version: '1.0.0',
        type: capabilitySeed.graphType,
        entryNode: 'start',
        definition: {
          nodes: ['start', 'execute', 'approval', 'complete'],
          edges: [
            ['start', 'execute'],
            ['execute', 'approval'],
            ['approval', 'complete'],
          ],
        },
        isActive: true,
      },
    });
  }

  for (const promptSeed of PROMPTS) {
    const capability = capabilityByKey.get(promptSeed.capabilityKey);
    if (!capability) {
      throw new Error(`Missing capability for prompt seed: ${promptSeed.capabilityKey}`);
    }

    await prisma.prompt.upsert({
      where: {
        capabilityId_name_version: {
          capabilityId: capability.id,
          name: promptSeed.name,
          version: '1.0.0',
        },
      },
      update: {
        systemPrompt: promptSeed.systemPrompt,
        userTemplate: promptSeed.userTemplate,
        variables: {},
        isActive: true,
      },
      create: {
        organizationId: organization.id,
        capabilityId: capability.id,
        name: promptSeed.name,
        version: '1.0.0',
        systemPrompt: promptSeed.systemPrompt,
        userTemplate: promptSeed.userTemplate,
        variables: {},
        isActive: true,
      },
    });
  }

  for (const [capabilityKey, modelSeed] of Object.entries(MODEL_BY_CAPABILITY)) {
    const capability = capabilityByKey.get(capabilityKey);
    if (!capability) {
      throw new Error(`Missing capability for model seed: ${capabilityKey}`);
    }

    await prisma.aiModel.upsert({
      where: {
        organizationId_provider_modelId: {
          organizationId: organization.id,
          provider: modelSeed.provider,
          modelId: modelSeed.modelId,
        },
      },
      update: {
        capabilityId: capability.id,
        name: modelSeed.name,
        displayName: modelSeed.displayName,
        isDefault: true,
        isEnabled: true,
        maxTokens: modelSeed.maxTokens,
        temperature: modelSeed.temperature,
        topP: 1,
      },
      create: {
        organizationId: organization.id,
        capabilityId: capability.id,
        provider: modelSeed.provider,
        modelId: modelSeed.modelId,
        name: modelSeed.name,
        displayName: modelSeed.displayName,
        isDefault: true,
        isEnabled: true,
        maxTokens: modelSeed.maxTokens,
        temperature: modelSeed.temperature,
        topP: 1,
      },
    });
  }

  for (const [key, value, description] of CONFIGURATIONS) {
    await upsertConfiguration(organization.id, key, value, description);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
