export const agentCatalog = [
  {
    id: 'planner',
    name: 'Planner Agent',
    role: 'planning',
    responsibilities: ['decompose tasks', 'define milestones', 'keep execution on track']
  },
  {
    id: 'coder',
    name: 'Coding Agent',
    role: 'coding',
    responsibilities: ['implement features', 'edit files', 'write scripts']
  },
  {
    id: 'reviewer',
    name: 'Code Review Agent',
    role: 'review',
    responsibilities: ['find bugs', 'check correctness', 'validate quality']
  },
  {
    id: 'security',
    name: 'Security Agent',
    role: 'security',
    responsibilities: ['inspect risks', 'check secrets', 'review attack paths']
  },
  {
    id: 'ops',
    name: 'Ops Agent',
    role: 'operations',
    responsibilities: ['manage build', 'run tests', 'watch deployment health']
  }
];

export function getDefaultAgents() {
  return agentCatalog;
}

export function pickBestAgent(taskText) {
  const normalized = taskText.toLowerCase();

  if (/(fix|bug|error|review|quality|lint|test)/.test(normalized)) {
    return 'reviewer';
  }

  if (/(security|secret|auth|risk|vuln)/.test(normalized)) {
    return 'security';
  }

  if (/(build|deploy|run|docker|ci|ops)/.test(normalized)) {
    return 'ops';
  }

  if (/(plan|roadmap|spec|architecture|strategy)/.test(normalized)) {
    return 'planner';
  }

  return 'coder';
}

export function getKeywordMatches(taskText) {
  const normalized = taskText.toLowerCase();
  const matches = [];

  if (/(fix|bug|error|review|quality|lint|test)/.test(normalized)) matches.push('reviewer');
  if (/(security|secret|auth|risk|vuln)/.test(normalized)) matches.push('security');
  if (/(build|deploy|run|docker|ci|ops)/.test(normalized)) matches.push('ops');
  if (/(plan|roadmap|spec|architecture|strategy)/.test(normalized)) matches.push('planner');

  return matches;
}
