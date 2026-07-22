import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProjectDashboardBriefing } from '../src/project/projectDashboardBriefing.js';

test('project briefing prioritizes current work, people, official updates, and quiet metrics', () => {
  const project = {
    id: 'project-1',
    name: '登录与权限系统',
    objective: '交付可以运行并通过测试的登录与权限系统。',
    status: 'executing',
    leaderWorkPlan: {
      schemaVersion: 'leader-managed-task-plan/v1',
      status: 'submitted',
      submittedAt: '2026-07-19T08:00:00.000Z',
      leaderId: 'lead',
      leaderName: 'Lead',
      taskIds: ['task-1', 'task-2'],
      tasks: [{ id: 'task-1' }, { id: 'task-2' }],
    },
    team: [
      { id: 'lead', name: 'Lead', role: 'Leader' },
      { id: 'reviewer', name: 'Reviewer', role: 'Reviewer' },
    ],
    tasks: [
      { id: 'task-1', text: '完成登录与权限系统首版', ownerId: 'lead', status: 'doing' },
      { id: 'task-2', text: '准备内部测试', ownerId: 'reviewer', status: 'pending' },
    ],
    submissionReviews: [],
  };
  const agentRows = [
    {
      agent: project.team[0],
      state: { status: 'working', currentPlan: { focus: '修复管理员权限验证', next: '补充回归测试' } },
      latestWorklog: { summary: '管理员权限校验已接入。' },
    },
    {
      agent: project.team[1],
      state: { status: 'reviewing', currentPlan: { focus: '复核权限测试用例', next: '发布质量结论' } },
    },
  ];
  const recentEvents = [
    { id: 'minor', title: 'scheduler tick', timestamp: '2026-07-19T09:00:00.000Z' },
    { id: 'release', title: '版本 16 已更新', timestamp: '2026-07-19T10:00:00.000Z' },
    { id: 'review', title: '首轮质量复核完成', timestamp: '2026-07-19T09:30:00.000Z' },
    { id: 'policy', title: '权限方案已修订', timestamp: '2026-07-19T09:15:00.000Z' },
  ];

  const briefing = buildProjectDashboardBriefing({ project, agentRows, recentEvents, language: 'zh' });

  assert.match(briefing.focusSummary, /最终要交付《登录与权限系统可运行版本》/);
  assert.match(briefing.focusSummary, /0\/2 份分工产物已经形成文件/);
  assert.equal(briefing.stage, '项目执行');
  assert.equal(briefing.nextMilestone, '登录与权限系统首版');
  assert.equal(briefing.teamRows.length, 2);
  assert.equal(briefing.teamRows[0].sentence, '正在完成《登录与权限系统首版》');
  assert.equal(briefing.teamRows[0].taskProgressPercent, 0);
  assert.equal(briefing.teamRows[1].status.label, '复核中');
  assert.deepEqual(briefing.updates.map(row => row.id), ['release', 'review', 'policy']);
  assert.deepEqual(briefing.metrics, {
    memberCount: 2,
    activeCount: 2,
    waitingCount: 0,
    blockedCount: 0,
  });
});
