import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createFileBackedAgentProjectApi } from '../src/agents/agentProjectApi.js';

test('local project creators are seeded into membership and can grant a manager access', () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-local-membership-'));
  try {
    const api = createFileBackedAgentProjectApi({
      filePath: join(directory, 'projects.json'),
      localAuthFilePath: join(directory, 'auth.json'),
      localAuthRequired: true,
      accessControl: { requireProjectMembership: true },
    });
    const bootstrap = api.handle({
      method: 'POST',
      path: '/local-auth/bootstrap',
      body: { username: 'owner', password: 'correct horse battery staple1' },
    });
    const ownerHeaders = { 'x-hofs-local-auth-token': bootstrap.body.localAuth.token };
    const created = api.handle({
      method: 'POST',
      path: '/projects/initiate',
      headers: ownerHeaders,
      body: {
        includeReadModels: false,
        projectId: 'local_membership_project',
        name: 'Local Membership Project',
        brief: 'Verify a local account is bound to the project it creates.',
        team: [
          { id: 'jobs', name: 'Steve Jobs', title: 'Product Lead' },
          { id: 'curie', name: 'Marie Curie', title: 'Evidence Reviewer' },
        ],
        selectedLeaderId: 'jobs',
        reviewerId: 'curie',
      },
    });
    assert.equal(created.status, 200);
    assert.equal(created.body.project.projectMembershipPolicy.securityAdminUserIds.includes(bootstrap.body.localAuth.user.id), true);
    assert.equal(api.handle({ method: 'GET', path: '/projects/local_membership_project', headers: ownerHeaders }).status, 200);

    const manager = api.handle({
      method: 'POST',
      path: '/local-auth/users',
      headers: ownerHeaders,
      body: { username: 'manager', password: 'another correct horse battery staple1', role: 'manager' },
    });
    const managerLogin = api.handle({
      method: 'POST',
      path: '/local-auth/login',
      body: { username: 'manager', password: 'another correct horse battery staple1' },
    });
    const managerHeaders = { 'x-hofs-local-auth-token': managerLogin.body.localAuth.token };
    assert.equal(api.handle({ method: 'GET', path: '/projects/local_membership_project', headers: managerHeaders }).status, 403);

    const granted = api.handle({
      method: 'PUT',
      path: '/projects/local_membership_project/membership-policy',
      headers: ownerHeaders,
      body: { policy: { managerUserIds: [manager.body.localAuth.user.id] } },
    });
    assert.equal(granted.status, 200);
    assert.equal(api.handle({ method: 'GET', path: '/projects/local_membership_project', headers: managerHeaders }).status, 200);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('an authenticated local admin can create a project through the direct project save route', () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-local-project-save-'));
  try {
    const api = createFileBackedAgentProjectApi({
      filePath: join(directory, 'projects.json'),
      localAuthFilePath: join(directory, 'auth.json'),
      localAuthRequired: true,
    });
    const bootstrap = api.handle({
      method: 'POST',
      path: '/local-auth/bootstrap',
      body: { username: 'owner', password: 'owner1' },
    });
    const headers = { 'x-hofs-local-auth-token': bootstrap.body.localAuth.token };
    const created = api.handle({
      method: 'PUT',
      path: '/projects/direct_local_project',
      headers,
      body: {
        project: {
          id: 'direct_local_project',
          name: 'Direct Local Project',
          status: 'planning',
          team: [],
          tasks: [],
          logs: [],
        },
      },
    });

    assert.equal(created.status, 200);
    assert.equal(created.body.project.id, 'direct_local_project');
    assert.equal(api.handle({ method: 'GET', path: '/projects/direct_local_project', headers }).status, 200);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
