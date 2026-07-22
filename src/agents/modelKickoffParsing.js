// Kickoff meeting model I/O: prompts, line/JSON parsing, topic matching (TD-004).
// Extracted verbatim from agentProjectService.js — behavior must stay identical.

import { modelOutputLanguageInstruction, modelOutputMatchesLanguage } from './modelLanguagePolicy.js';
import { buildMeetingContextPacket } from './meetingInteractionProtocol.js';

const nowIso = () => new Date().toISOString();

export function buildModelKickoffMeetingMessages({
  projectId = '',
  meetingId = '',
  name = 'Untitled Agent Project',
  brief = '',
  team = [],
  tasks = [],
  language = 'en',
  now = nowIso(),
  strictTopic = false,
} = {}) {
  const roster = team.map((agent) => `${agent.id}: ${agent.name} / ${agent.role || agent.title || 'Agent'} / ${agent.duty || agent.skill || ''}`).join('\n');
  const requestedActions = (tasks || []).map((task, index) => `${task.id || `task_${index + 1}`}: ${typeof task === 'string' ? task : task.text || ''}`).join('\n');
  return [
    {
      role: 'system',
      content: [
        'You are the real kickoff meeting engine for Hall of Fame Studio.',
        modelOutputLanguageInstruction(language),
        'Return the final JSON immediately. Do not reason step by step.',
        'Generate the opening clarification stage of a project-initiation meeting and make the expected final deliverables explicit.',
        'The project topic is fixed. Never replace it with another research topic or generic AI/model-performance work.',
        'Every text field must mention or clearly refer to the project topic.',
        'Use 2 to 4 roleTurns. Do not generate leaderCampaigns or nextActions in the opening stage.',
        'At least one roleTurn must be a deliverable-question or deliverable-proposal so the team proactively raises what final files will be handed to the user.',
        'Keep each text under 32 Chinese characters or 24 English words.',
        'Required JSON keys: roleTurns, deliverables, decisionSummary, risks.',
        'roleTurns item: {agentId,type,text,hears}. Use type "role-question", "role-volunteer", "deliverable-question", or "deliverable-proposal".',
        'deliverables item: {title,fileName,format,ownerId,purpose,acceptanceCriteria}. File names must include an extension.',
        strictTopic ? 'Strict topic retry: every agent turn, leader claim, next action, and risk must explicitly concern the exact project name and brief.' : '',
        'Return JSON only. No markdown.',
      ].filter(Boolean).join('\n'),
    },
    {
      role: 'user',
      content: [
        `PROJECT NAME: ${name}`,
        `PROJECT BRIEF: ${brief || name}`,
        `PROJECT LANGUAGE: ${language}`,
        `MEETING ID: ${meetingId}`,
        `NOW: ${now}`,
        `AGENTS:\n${roster}`,
        requestedActions ? `REQUESTED ACTIONS:\n${requestedActions}` : '',
        'You must keep all meeting content on this project topic.',
      ].filter(Boolean).join('\n\n'),
    },
  ];
}

export function buildModelKickoffMeetingTurnMessages({
  meeting = {},
  latestDirectorInput = '',
  language = 'en',
  now = nowIso(),
} = {}) {
  const contextPacket = buildMeetingContextPacket({
    meeting,
    latestDirectorInput,
  });
  return [
    {
      role: 'system',
      content: [
        'You are the live kickoff meeting engine for Hall of Fame Studio.',
        modelOutputLanguageInstruction(language),
        'Return the final JSON immediately. Do not reason step by step.',
        'Continue the meeting as a natural multi-agent conversation. Do not turn leader selection, role split, next actions, or deliverables into dashboard controls.',
        'Agents should ask clarifying questions, decompose the work, volunteer for responsibility areas, self-nominate for leader only when the conversation is ready, and explicitly propose the final files the project must deliver.',
        'Before the team says it is ready to close, at least one Agent must raise the final deliverables. If they are unclear, ask the Director to confirm their names, file formats, owners, purposes, and acceptance criteria.',
        'Make later agents respond to an earlier turn, not independently repeat an answer to the Director.',
        'Use 2 or 3 causal peer exchanges. The final exchange must synthesize or escalate the remaining question to the Director.',
        'Every peer response requires replyToTurnId, targetSpeakerId, and interactionIntent.',
        'interactionIntent must be support, challenge, clarify, compete, synthesize, escalate, or yield.',
        'Do not continue an A/B argument after three peer exchanges.',
        'The user is the final decision maker. Do not claim the leader is confirmed unless the user explicitly confirms it.',
        'If the team has no more useful agenda, agents may say they are ready to close, but only the user can end the meeting.',
        'Use 2 to 4 short agentTurns. Keep each text under 36 Chinese characters or 28 English words.',
        'Return JSON only. No markdown.',
      ].join('\n'),
    },
    {
      role: 'user',
      content: JSON.stringify({
        now,
        language,
        contextPacket,
        requiredShape: {
          agentTurns: [
            {
              agentId: 'agent id from team',
              type: 'clarifying-question, role-volunteer, task-decomposition, leader-campaign, adjustment, next-action, deliverable-question, or deliverable-proposal',
              text: 'one natural meeting turn in the project language',
              score: 8,
              replyToTurnId: 'id of an earlier context or agent turn',
              targetSpeakerId: 'agent id being answered, or director for the opening response',
              interactionIntent: 'support, challenge, clarify, compete, synthesize, escalate, or yield',
            },
          ],
          recommendedLeaderId: 'optional agent id from team, only if a recommendation is emerging',
          nextActions: [
            {
              text: 'optional concrete first action if the meeting has reached planning',
              ownerId: 'agent id from team',
            },
          ],
          deliverables: [
            {
              title: 'human-readable final file name without an extension',
              fileName: 'the exact file name including extension',
              format: 'Markdown, PDF, Word, Excel, PowerPoint, or another explicit format',
              ownerId: 'agent id from team',
              purpose: 'what this file lets the user do',
              acceptanceCriteria: ['one observable completion condition'],
            },
          ],
          decisionSummary: 'optional one sentence summary of the current meeting state',
          risks: ['optional unresolved ambiguity or risk'],
        },
      }),
    },
  ];
}

export function buildModelKickoffOpeningLineMessages({
  name = 'Untitled Agent Project',
  brief = '',
  team = [],
  language = 'en',
} = {}) {
  return [
    {
      role: 'system',
      content: [
        'You open a project kickoff meeting.',
        modelOutputLanguageInstruction(language),
        'Return only 2 to 4 lines. No markdown. No JSON.',
        'Each line format: agentId | type | text',
        'type must be role-question, role-volunteer, deliverable-question, or deliverable-proposal.',
        'At least one Agent must proactively ask about or propose the final files, their formats, owners, and acceptance conditions.',
        'Every line must be about the exact project topic.',
        'Keep each text under 32 Chinese characters or 24 English words.',
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        `PROJECT: ${name}`,
        `BRIEF: ${brief || name}`,
        `LANGUAGE: ${language}`,
        'AGENTS:',
        team.map((agent) => `${agent.id}: ${agent.name} / ${agent.role || agent.title || 'Agent'} / ${agent.duty || agent.skill || ''}`).join('\n'),
      ].join('\n'),
    },
  ];
}

export function buildModelKickoffTurnLineMessages({
  meeting = {},
  latestDirectorInput = '',
  language = 'en',
} = {}) {
  const team = meeting.team || [];
  return [
    {
      role: 'system',
      content: [
        'Continue a live project kickoff meeting.',
        modelOutputLanguageInstruction(language),
        'Return only 1 to 3 lines. No markdown. No JSON.',
        'Each line format: agentId | type | text',
        'type must be clarifying-question, role-volunteer, task-decomposition, leader-campaign, adjustment, next-action, deliverable-question, or deliverable-proposal.',
        'Every line must respond to the latest Director input and stay on the project topic.',
        'Keep each text under 36 Chinese characters or 28 English words.',
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        `PROJECT: ${meeting.name || 'Untitled Agent Project'}`,
        `BRIEF: ${meeting.brief || meeting.name || ''}`,
        `LANGUAGE: ${language}`,
        `LATEST DIRECTOR INPUT: ${latestDirectorInput}`,
        'AGENTS:',
        team.map((agent) => `${agent.id}: ${agent.name} / ${agent.role || agent.title || 'Agent'} / ${agent.duty || agent.skill || ''}`).join('\n'),
      ].join('\n'),
    },
  ];
}

export function findMeetingAgent(team = [], value = '') {
  const normalized = String(value || '').toLowerCase();
  if (!normalized) return null;
  return team.find((agent) => String(agent.id || '').toLowerCase() === normalized)
    || team.find((agent) => String(agent.name || '').toLowerCase() === normalized)
    || null;
}

export function parseModelLineTurns(content = '', team = [], { mode = 'opening' } = {}) {
  const lines = String(content || '')
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*\d.\s]+/, '').trim())
    .filter(Boolean)
    .slice(0, 4);
  return lines.map((line) => {
    const parts = line.split('|').map((part) => part.trim()).filter(Boolean);
    const agent = findMeetingAgent(team, parts[0]) || findMeetingAgent(team, line);
    if (!agent) return null;
    const type = parts.length >= 3 ? parts[1] : 'role-question';
    const text = parts.length >= 3
      ? parts.slice(2).join(' | ')
      : line.replace(new RegExp(`^${agent.id}\\s*[:：-]?\\s*`, 'i'), '').replace(new RegExp(`^${agent.name}\\s*[:：-]?\\s*`, 'i'), '').trim();
    if (!text) return null;
    return {
      agentId: agent.id,
      type,
      text,
      hears: team.filter((peer) => peer.id !== agent.id).map((peer) => peer.id),
    };
  }).filter(Boolean);
}

export function normalizeModelArray(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return [value];
  return [];
}

export function normalizeJsonLikeText(value = '') {
  return String(value || '')
    .trim()
    .replace(/^\uFEFF/, '')
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/([{,]\s*)'([^']+?)'\s*:/g, '$1"$2":')
    .replace(/:\s*'([^']*?)'(?=\s*[,}])/g, ':"$1"')
    .replace(/,\s*([}\]])/g, '$1');
}

export function safeParseModelJson(value = '') {
  const raw = String(value || '');
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    try {
      const parsed = JSON.parse(normalizeJsonLikeText(raw));
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }
}

export function extractBalancedJsonObject(value = '') {
  const text = String(value || '').trim();
  if (!text) return null;
  const direct = safeParseModelJson(text);
  if (direct) return direct;

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    const parsed = safeParseModelJson(fenced[1].trim());
    if (parsed) return parsed;
  }

  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (start < 0) {
      if (char === '{') {
        start = index;
        depth = 1;
      }
      continue;
    }
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    if (depth === 0) {
      const parsed = safeParseModelJson(text.slice(start, index + 1));
      if (parsed) return parsed;
      start = -1;
    }
  }
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const parsed = safeParseModelJson(text.slice(firstBrace, lastBrace + 1));
    if (parsed) return parsed;
  }
  return null;
}

export function parseModelCompletionJson(completion = {}) {
  if (completion.json && typeof completion.json === 'object') return completion.json;
  return extractBalancedJsonObject(completion.content || '');
}

export function parseModelOpeningLinePayload(content = '', input = {}) {
  const jsonPayload = parseModelCompletionJson({ content });
  if (jsonPayload && normalizeModelArray(jsonPayload.roleTurns).length) return jsonPayload;
  const roleTurns = parseModelLineTurns(content, input.team || [], { mode: 'opening' });
  if (!roleTurns.length) return null;
  return {
    roleTurns,
    leaderCampaigns: [],
    nextActions: [],
    decisionSummary: String(input.language || '').toLowerCase().startsWith('zh') ? '已开始启动澄清。' : 'Opening clarification started.',
    risks: [],
  };
}

export function parseModelTurnLinePayload(content = '', meeting = {}) {
  const jsonPayload = parseModelCompletionJson({ content });
  if (jsonPayload && (
    normalizeModelArray(jsonPayload.agentTurns).length
    || normalizeModelArray(jsonPayload.roleTurns).length
    || normalizeModelArray(jsonPayload.turns).length
  )) return jsonPayload;
  const agentTurns = parseModelLineTurns(content, meeting.team || [], { mode: 'turn' });
  if (!agentTurns.length) return null;
  return {
    agentTurns,
    nextActions: [],
    risks: [],
  };
}

export function normalizeModelMeetingTurnType(value = '') {
  const raw = String(value || '').toLowerCase();
  if (/deliverable|artifact|output|file|交付|文件|产出/.test(raw)) return { type: 'deliverable-proposal', stage: 'deliverable-confirmation' };
  if (/leader|campaign|nominate|candidate/.test(raw)) return { type: 'leader-campaign', stage: 'leader-campaign' };
  if (/next|action|plan|execution/.test(raw)) return { type: 'next-action', stage: 'execution-planning' };
  if (/question|clarif|ask/.test(raw)) return { type: 'role-question', stage: 'role-clarification' };
  if (/decompos|split|adjust/.test(raw)) return { type: 'role-volunteer', stage: 'task-decomposition' };
  return { type: 'role-volunteer', stage: 'self-nomination' };
}

export function normalizeModelText(value = '') {
  if (value && typeof value === 'object') {
    return String(value.text || value.summary || value.risk || value.title || value.claim || value.content || '').trim();
  }
  return String(value || '').trim();
}

export function topicTermsForMeeting({ name = '', brief = '', tasks = [] } = {}) {
  const text = [
    name,
    brief,
    ...(tasks || []).map((task) => (typeof task === 'string' ? task : task?.text || '')),
  ].join(' ');
  const terms = new Set();
  const latinStop = new Set(['research', 'project', 'agent', 'task', 'study']);
  for (const match of text.matchAll(/[A-Za-z][A-Za-z0-9_-]{3,}/g)) {
    const term = match[0].toLowerCase();
    if (!latinStop.has(term)) terms.add(term);
  }
  for (const match of text.matchAll(/[\u3400-\u9fff]{2,}/g)) {
    const segment = match[0];
    for (let index = 0; index < segment.length - 1; index += 1) {
      const term = segment.slice(index, index + 2);
      if (!['项目', '研究', '问题', '范围', '方法', '最终', '交付', '之间', '关系', '明确'].includes(term)) {
        terms.add(term);
      }
    }
  }
  return [...terms].slice(0, 24);
}

export function modelKickoffPayloadText(modelPayload = {}) {
  const parts = [
    ...normalizeModelArray(modelPayload.roleTurns).flatMap((turn) => [turn.text, turn.question, turn.statement, turn.claim, turn.content]),
    ...normalizeModelArray(modelPayload.leaderCampaigns).flatMap((turn) => [turn.claim, turn.text, turn.statement, turn.content]),
    ...normalizeModelArray(modelPayload.nextActions).flatMap((action) => [action.text, action.title, action.action]),
    ...normalizeModelArray(modelPayload.agentTurns).flatMap((turn) => [turn.text, turn.question, turn.statement, turn.claim, turn.content]),
    ...normalizeModelArray(modelPayload.deliverables).flatMap((deliverable) => [
      deliverable.title,
      deliverable.fileName,
      deliverable.format,
      deliverable.purpose,
      ...normalizeModelArray(deliverable.acceptanceCriteria),
    ]),
    modelPayload.decisionSummary,
    ...normalizeModelArray(modelPayload.risks),
  ];
  return parts.map((part) => String(part || '')).filter(Boolean).join('\n').toLowerCase();
}

export function modelKickoffPayloadMatchesTopic(input = {}, modelPayload = {}) {
  const terms = topicTermsForMeeting(input);
  if (!terms.length) return true;
  const payloadText = modelKickoffPayloadText(modelPayload);
  const projectName = String(input.name || '').trim().toLowerCase();
  if (projectName && payloadText.includes(projectName)) return true;
  const hits = terms.filter((term) => payloadText.includes(term.toLowerCase()));
  return hits.length >= Math.min(2, terms.length);
}

export function modelKickoffPayloadMatchesLanguage(input = {}, modelPayload = {}) {
  return modelOutputMatchesLanguage({
    text: modelKickoffPayloadText(modelPayload),
    language: input.language || 'en',
    allowedTerms: [
      input.name,
      ...(input.team || []).flatMap((agent) => [agent.id, agent.name]),
      'Agent',
      'Hall of Fame Studio',
    ],
  });
}

export async function repairModelCompletionJson({
  llmProvider,
  completion = {},
  expectedShape = {},
  purpose = 'kickoff meeting',
  language = 'en',
  timeoutMs = 20_000,
  maxTokens = 1200,
} = {}) {
  const rawOutput = String(completion.content || '').trim();
  if (!rawOutput || typeof llmProvider?.createChatCompletion !== 'function') return null;
  const repair = await llmProvider.createChatCompletion({
    messages: [
      {
        role: 'system',
        content: [
          'You repair malformed model output into strict JSON.',
          modelOutputLanguageInstruction(language),
          'Return exactly one valid JSON object and no markdown.',
          'Do not add facts that are not present in the raw output unless needed to satisfy required keys.',
        ].join('\n'),
      },
      {
        role: 'user',
        content: JSON.stringify({
          purpose,
          expectedShape,
          rawOutput: rawOutput.slice(0, 12000),
        }),
      },
    ],
    json: true,
    maxTokens,
    timeoutMs,
  });
  if (!repair.ok) return null;
  return parseModelCompletionJson(repair);
}
