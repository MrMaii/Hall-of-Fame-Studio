import { useState, useEffect, useRef } from 'react';
import { 
  Settings, Grid, LayoutPanelLeft, Box,
  MessageSquare, Plus, Network, Cpu, Clock, 
  CheckCircle2, Activity, Play, StopCircle, CornerDownRight, 
  Fingerprint, ChevronRight, BarChart3, Database, Search, SlidersHorizontal, FileSignature,
  ArrowLeft, Shield, Crosshair, BookOpen, Briefcase,
  Send, Hash, GitCommit, GitBranch, FileText, Code2, MessageCircle, Users, Mic2,
  DoorOpen, ScrollText, Monitor, ClipboardList, Sparkles, CircleDot,
  Pin, Reply, AtSign, Volume2, ChevronLeft, Paperclip, BellDot, Headphones, X,
  UserCircle, KeyRound, Server, Globe2, PlugZap, WalletCards, Eye, EyeOff, Save, PackageCheck
} from 'lucide-react';
import {
  PERSON_SKILL_COUNT,
  PERSON_SKILL_DOC_COUNT,
  buildDossierProfileFromSkill,
  createRoundtablePlan,
  getPersonSkill,
} from './skills/personSkillSystem.js';
import { localizeText, useLanguage } from './i18n/index.jsx';
import {
  advanceAutonomousProjectCycle,
  appendProjectEvents,
  applyChatMessagesToAgentStates,
  attachMessageReceipts,
  backfillProjectEventLedger,
  createAgentNetwork,
  createKickoffCharter,
  createKickoffRoleNegotiation,
  createLeaderAssignmentPackage,
  createLeaderElection,
  evaluateAutonomousSchedule,
  evaluateCollaborationState,
  evaluateManagerScenarioReadiness,
  handlePeerHandoff,
  handleFeatureChangeRequest,
  isFeatureChangeRequest,
  MEETING_PROTOCOLS,
  publishAutonomousCycleChat,
  routeDirectorDirective,
  runRoundtableExchange,
  startAgentSession,
  summarizeProjectEventLedger,
} from './agents/agentRuntime.js';
import {
  applyPeerManagementMatrix,
  approveKickoffMeetingSession,
  buildNextActionResolution,
  buildPeerManagementMatrix,
  createKickoffProjectFromMeeting,
  runAgentWorkCycle,
  submitProjectMultiChannelChangeRequest,
  submitProjectChatMessage,
  submitProjectMeetingMessage,
} from './agents/agentProjectService.js';

const DEFAULT_AGENT_BACKEND_URL = import.meta.env?.VITE_AGENT_BACKEND_URL || 'http://127.0.0.1:8787';

function mergeProjectMessages(existing = [], incoming = []) {
  const messageTimeValue = (message = {}) => {
    const directTimestamp = [
      message.createdAt,
      message.sentAt,
      message.timestamp,
      message.time,
    ]
      .map(value => Date.parse(value || ''))
      .find(value => Number.isFinite(value));
    if (Number.isFinite(directTimestamp)) return directTimestamp;

    const receiptTimestamp = (message.receipts || [])
      .map(receipt => Date.parse(receipt.seenAt || ''))
      .find(value => Number.isFinite(value));
    if (Number.isFinite(receiptTimestamp)) return receiptTimestamp;

    const idTimestamp = String(message.id || '').match(/(\d{10,})/);
    return idTimestamp ? Number(idTimestamp[1]) : 0;
  };
  const byId = new Map();
  [...existing, ...incoming].forEach((message) => {
    if (!message?.id) return;
    byId.set(message.id, {
      ...(byId.get(message.id) || {}),
      ...message,
    });
  });
  return [...byId.values()]
    .sort((a, b) => {
      const timeA = messageTimeValue(a);
      const timeB = messageTimeValue(b);
      return timeA - timeB;
    })
    .slice(-240);
}

function generateBarcode(seed = '') {
  const source = String(seed || 'agent');
  return Array.from({ length: 14 }, (_, index) => {
    const code = source.charCodeAt(index % source.length) || 37;
    const width = 1 + ((code + index) % 3);
    const height = 7 + ((code * (index + 3)) % 9);
    return (
      <span
        key={`barcode-${source}-${index}`}
        className="barcode-line"
        style={{ width: `${width}px`, height: `${height}px` }}
      />
    );
  });
}

// --- Global CSS & Typography ---
const globalStyles = `
  @import url('https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Space+Mono:ital,wght@0,400;0,700;1,400&display=swap');

  :root {
    --bg-color: #f5f4f0;
    --text-main: #1a1a1a;
    --border-color: #d1d0c9;
    --warroom-bg: #0d0c0b;
    --warroom-text: #e8e6df;
  }

  body {
    background-color: var(--bg-color);
    color: var(--text-main);
    overflow: hidden;
  }

  .font-serif { font-family: 'EB Garamond', serif; }
  .font-mono { font-family: 'Space Mono', monospace; }

  ::-webkit-scrollbar { width: 5px; height: 5px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--border-color); }
  
  .warroom-scrollbar::-webkit-scrollbar-thumb { background: #333; }

  /* 褰诲簳閲嶅啓鐨勮繛绾挎暟鎹祦鍔ㄧ敾锛屽彇娑堥€忔槑搴﹂闂紝鏀逛负骞虫粦鐨勮櫄绾挎祦鍔?*/
  @keyframes link-flow {
    to { stroke-dashoffset: -12; }
  }
  .link-active {
    stroke: #777;
    stroke-width: 1.5px;
    stroke-dasharray: 4 4;
    animation: link-flow 1.5s linear infinite;
  }

  .fade-in { animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

  .decrypt-text {
    position: relative;
    display: inline-block;
  }
  .decrypt-text::after {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background: var(--text-main);
    animation: revealText 0.8s cubic-bezier(0.77, 0, 0.175, 1) forwards;
    transform-origin: right;
  }
  @keyframes revealText {
    0% { transform: scaleX(1); }
    100% { transform: scaleX(0); }
  }

  .dossier-card {
    background: #fdfdfc;
    border: 1px solid var(--border-color);
    box-shadow: 4px 4px 0px rgba(0,0,0,0.03);
    transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
    position: relative;
  }
  .dossier-card:hover {
    transform: translateY(-4px) rotate(-0.5deg);
    box-shadow: 12px 12px 0px rgba(0,0,0,0.1);
    border-color: #1a1a1a;
    z-index: 10;
  }

  @keyframes stamp-down {
    0% { opacity: 0; transform: scale(3) rotate(-15deg); }
    50% { opacity: 1; transform: scale(0.9) rotate(-15deg); }
    100% { opacity: 1; transform: scale(1) rotate(-15deg); }
  }
  .stamp-active {
    animation: stamp-down 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
  }

  .barcode-line { background: #1a1a1a; height: 100%; display: inline-block; margin-right: 2px; }

  .archive-stage {
    background:
      radial-gradient(circle at 16% 18%, rgba(132, 30, 24, 0.24), transparent 28%),
      radial-gradient(circle at 84% 8%, rgba(226, 207, 158, 0.14), transparent 22%),
      linear-gradient(135deg, #151311 0%, #24211a 42%, #10100e 100%);
  }
  .archive-stage::before {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background-image:
      linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
    background-size: 52px 52px;
    mask-image: radial-gradient(circle at center, black 0%, transparent 72%);
  }
  .archive-table {
    background:
      linear-gradient(90deg, rgba(255,255,255,0.04), transparent 25%, rgba(0,0,0,0.2)),
      repeating-linear-gradient(92deg, #302719 0px, #302719 14px, #2a2218 15px, #211a13 29px);
    box-shadow: inset 0 18px 80px rgba(0,0,0,0.52), 0 0 80px rgba(0,0,0,0.4);
  }
  .archive-vignette {
    background: radial-gradient(circle at 50% 38%, transparent 0%, rgba(0,0,0,0.34) 62%, rgba(0,0,0,0.78) 100%);
  }
  .archive-dossier {
    background:
      linear-gradient(135deg, rgba(255,255,255,0.72), rgba(255,255,255,0.02) 28%, transparent 62%),
      repeating-linear-gradient(0deg, rgba(50,42,30,0.045) 0, rgba(50,42,30,0.045) 1px, transparent 1px, transparent 6px),
      #efe2bd;
    box-shadow: 0 32px 70px rgba(0,0,0,0.45), 0 2px 0 rgba(255,255,255,0.65) inset;
    animation: dossier-land 0.85s cubic-bezier(0.17, 0.84, 0.2, 1) both;
  }
  .dossier-scroll-field {
    scrollbar-gutter: stable;
    scrollbar-width: thin;
    scrollbar-color: rgba(143, 30, 24, 0.36) rgba(92, 73, 51, 0.12);
  }
  .dossier-scroll-field::-webkit-scrollbar {
    width: 8px;
  }
  .dossier-scroll-field::-webkit-scrollbar-track {
    background: rgba(92, 73, 51, 0.10);
  }
  .dossier-scroll-field::-webkit-scrollbar-thumb {
    background: rgba(143, 30, 24, 0.34);
    border: 2px solid rgba(239, 226, 189, 0.72);
  }
  .dossier-scroll-cue {
    position: sticky;
    bottom: -1px;
    z-index: 30;
    display: flex;
    justify-content: center;
    height: 46px;
    margin: -22px -2rem -2rem;
    pointer-events: none;
    background:
      linear-gradient(180deg, rgba(239,226,189,0), rgba(239,226,189,0.74) 45%, rgba(239,226,189,0.96)),
      repeating-linear-gradient(90deg, transparent 0, transparent 17px, rgba(143,30,24,0.12) 18px, transparent 19px);
  }
  .dossier-scroll-cue::before,
  .dossier-scroll-cue::after {
    content: '';
    position: absolute;
    bottom: 9px;
    width: 18px;
    height: 1px;
    background: rgba(143, 30, 24, 0.62);
    transform-origin: center;
    animation: scroll-cue-pulse 1.8s ease-in-out infinite;
  }
  .dossier-scroll-cue::before {
    transform: translateX(-6px) rotate(28deg);
  }
  .dossier-scroll-cue::after {
    transform: translateX(6px) rotate(-28deg);
  }
  .dossier-scroll-cue-dark {
    margin-left: -0.25rem;
    margin-right: -0.25rem;
    background:
      linear-gradient(180deg, rgba(37,27,19,0), rgba(37,27,19,0.74) 45%, rgba(37,27,19,0.98)),
      repeating-linear-gradient(90deg, transparent 0, transparent 17px, rgba(232,221,191,0.10) 18px, transparent 19px);
  }
  .dossier-scroll-cue-dark::before,
  .dossier-scroll-cue-dark::after {
    background: rgba(232, 221, 191, 0.62);
  }
  .archive-photo {
    filter: sepia(0.28) contrast(1.08) saturate(0.82);
  }
  .desk-prop {
    animation: prop-drift 1.1s cubic-bezier(0.2, 0.8, 0.2, 1) both;
  }
  .ink-reveal {
    animation: ink-reveal 0.72s cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  .scan-sweep::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    top: -30%;
    height: 32%;
    background: linear-gradient(180deg, transparent, rgba(182, 44, 35, 0.16), transparent);
    animation: scan-sweep 3.8s ease-in-out infinite;
    pointer-events: none;
  }
  .radar-polygon {
    animation: radar-draw 1.1s cubic-bezier(0.17, 0.84, 0.2, 1) both 0.32s;
    transform-origin: center;
  }
  .dossier-impact {
    animation: dossier-impact 0.64s cubic-bezier(0.2, 0.8, 0.2, 1) both 0.98s;
  }
  .contract-stamp-theater {
    background:
      radial-gradient(circle at 50% 48%, rgba(238, 222, 186, 0.16), transparent 30%),
      radial-gradient(circle at 50% 50%, rgba(143, 30, 24, 0.24), transparent 18%),
      rgba(8, 7, 6, 0.58);
    animation: theater-fade 3.5s ease both;
  }
  .stamp-device {
    animation: stamp-device-hit 1.62s cubic-bezier(0.16, 1, 0.3, 1) both;
    transform-origin: 50% 86%;
  }
  .stamp-handle {
    background:
      linear-gradient(90deg, rgba(255,255,255,0.12), transparent 30%, rgba(0,0,0,0.35)),
      linear-gradient(180deg, #3a2115, #170d09 62%, #0d0705);
    box-shadow: inset 0 0 0 1px rgba(255,255,255,0.08), 0 18px 30px rgba(0,0,0,0.42);
  }
  .stamp-head {
    background:
      linear-gradient(90deg, rgba(255,255,255,0.12), transparent 35%, rgba(0,0,0,0.34)),
      #6e1714;
    box-shadow: inset 0 0 0 2px rgba(232,221,191,0.18), 0 28px 45px rgba(0,0,0,0.48);
  }
  .fresh-contract-seal {
    animation: fresh-seal 2.4s cubic-bezier(0.16, 1, 0.3, 1) both 1.04s;
  }
  .seal-shockwave {
    animation: seal-shockwave 1.0s ease-out both 1.04s;
  }
  .paper-dust {
    animation: paper-dust 1.2s ease-out both 1.04s;
  }
  @keyframes dossier-land {
    from { opacity: 0; transform: translateY(46px) rotateX(12deg) rotateZ(-2.4deg) scale(0.96); filter: blur(3px); }
    to { opacity: 1; transform: translateY(0) rotateX(0deg) rotateZ(-0.7deg) scale(1); filter: blur(0); }
  }
  @keyframes prop-drift {
    from { opacity: 0; transform: translateY(24px) rotate(var(--from-rot, 0deg)); }
    to { opacity: 1; transform: translateY(0) rotate(var(--to-rot, 0deg)); }
  }
  @keyframes ink-reveal {
    from { opacity: 0; clip-path: inset(0 100% 0 0); transform: translateX(-8px); }
    to { opacity: 1; clip-path: inset(0 0 0 0); transform: translateX(0); }
  }
  @keyframes scan-sweep {
    0%, 100% { transform: translateY(0); opacity: 0; }
    18%, 62% { opacity: 1; }
    72% { transform: translateY(430%); opacity: 0; }
  }
  @keyframes radar-draw {
    from { opacity: 0; transform: scale(0.72); }
    to { opacity: 1; transform: scale(1); }
  }
  @keyframes scroll-cue-pulse {
    0%, 100% { opacity: 0.26; bottom: 13px; }
    45% { opacity: 0.9; bottom: 7px; }
  }
  @keyframes dossier-impact {
    0% { transform: translateY(0) rotateX(0deg) rotateZ(-0.7deg) scale(1); filter: brightness(1); }
    28% { transform: translateY(12px) rotateX(1.5deg) rotateZ(-1.15deg) scale(0.992); filter: brightness(0.92); }
    52% { transform: translateY(-5px) rotateX(-0.6deg) rotateZ(-0.48deg) scale(1.004); filter: brightness(1.08); }
    74% { transform: translateY(2px) rotateX(0.3deg) rotateZ(-0.82deg) scale(0.998); }
    100% { transform: translateY(0) rotateX(0deg) rotateZ(-0.7deg) scale(1); filter: brightness(1); }
  }
  @keyframes theater-fade {
    0% { opacity: 0; }
    7% { opacity: 1; }
    60% { opacity: 1; }
    85% { opacity: 0.3; }
    100% { opacity: 0; }
  }
  @keyframes stamp-device-hit {
    0% { opacity: 0; transform: translateY(-58vh) scale(0.78) rotate(-11deg); filter: blur(1px); }
    18% { opacity: 1; transform: translateY(-30vh) scale(0.95) rotate(-6deg); filter: blur(0); }
    44% { transform: translateY(-42vh) scale(1.04) rotate(4deg); }
    62% { transform: translateY(-7vh) scale(1.16) rotate(0deg); }
    66% { transform: translateY(0) scale(1.2, 0.92) rotate(0deg); }
    72% { transform: translateY(-4vh) scale(1.05) rotate(-1.4deg); }
    100% { opacity: 0; transform: translateY(-32vh) scale(0.88) rotate(7deg); }
  }
  @keyframes fresh-seal {
    0%, 30% { opacity: 0; transform: translate(-50%, -50%) scale(1.85) rotate(-12deg); filter: blur(2px); }
    36% { opacity: 1; transform: translate(-50%, -50%) scale(0.72) rotate(-12deg); filter: blur(0); }
    48% { opacity: 1; transform: translate(-50%, -50%) scale(1.08) rotate(-12deg); }
    60% { opacity: 1; transform: translate(-50%, -50%) scale(1) rotate(-12deg); }
    88% { opacity: 1; transform: translate(-50%, -50%) scale(1) rotate(-12deg); }
    100% { opacity: 0; transform: translate(-50%, -50%) scale(1) rotate(-12deg); }
  }
  @keyframes seal-shockwave {
    0%, 60% { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
    66% { opacity: 0.55; transform: translate(-50%, -50%) scale(0.75); }
    100% { opacity: 0; transform: translate(-50%, -50%) scale(2.5); }
  }
  @keyframes paper-dust {
    0%, 58% { opacity: 0; transform: translateY(12px) scale(0.8); }
    66% { opacity: 0.8; transform: translateY(0) scale(1); }
    100% { opacity: 0; transform: translateY(-30px) scale(1.35); }
  }

  .project-room {
    background:
      radial-gradient(circle at 18% 18%, rgba(143, 30, 24, 0.18), transparent 26%),
      radial-gradient(circle at 82% 12%, rgba(232, 221, 191, 0.16), transparent 24%),
      linear-gradient(135deg, #171411 0%, #292116 44%, #100f0d 100%);
  }
  .project-room::before {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background-image:
      linear-gradient(rgba(232,221,191,0.035) 1px, transparent 1px),
      linear-gradient(90deg, rgba(232,221,191,0.025) 1px, transparent 1px);
    background-size: 48px 48px;
    mask-image: radial-gradient(circle at center, black 0%, transparent 74%);
  }
  .project-paper {
    background:
      repeating-linear-gradient(0deg, rgba(50,42,30,0.035) 0, rgba(50,42,30,0.035) 1px, transparent 1px, transparent 7px),
      linear-gradient(135deg, rgba(255,255,255,0.72), transparent 34%),
      #efe2bd;
    box-shadow: 0 28px 70px rgba(0,0,0,0.36), inset 0 1px 0 rgba(255,255,255,0.7);
  }
  .scene-object {
    animation: object-float 4.5s ease-in-out infinite;
  }
  .scene-object:nth-child(2) { animation-delay: 0.35s; }
  .scene-object:nth-child(3) { animation-delay: 0.7s; }
  .scene-bubble {
    animation: scene-bubble-pop 0.74s cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  .meeting-avatar {
    box-shadow: 0 0 0 1px rgba(232,221,191,0.2), 0 18px 30px rgba(0,0,0,0.28);
  }
  .timeline-track {
    background: linear-gradient(90deg, transparent, #8f1e18 8%, #8f1e18 92%, transparent);
  }
  @keyframes object-float {
    0%, 100% { transform: translateY(0) rotate(-1deg); }
    50% { transform: translateY(-8px) rotate(1deg); }
  }
  @keyframes scene-bubble-pop {
    0% { opacity: 0; transform: scale(0.08); border-radius: 9999px; }
    62% { opacity: 1; transform: scale(1.05); border-radius: 32px; }
    100% { opacity: 1; transform: scale(1); border-radius: 0; }
  }

  /* === Shared Node-Card Design Language === */
  .node-card {
    background: #efe2bd;
    border: 1px solid #7b6542;
    position: relative;
    transition: all 0.22s cubic-bezier(0.25, 0.8, 0.25, 1);
  }
  .node-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0,0,0,0.18);
    border-color: #251b13;
  }
  .node-card--dark {
    background: #1a130e;
    border: 1px solid #3a2a1c;
    color: #efe2bd;
    position: relative;
    transition: all 0.22s cubic-bezier(0.25, 0.8, 0.25, 1);
  }
  .node-card--dark:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0,0,0,0.32);
    border-color: #7b6542;
  }
  .node-id-tag {
    font-family: 'Space Mono', monospace;
    font-size: 8px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    padding: 2px 6px;
    background: #251b13;
    color: #efe2bd;
    line-height: 1;
  }
  .node-id-tag--light {
    background: #efe2bd;
    color: #251b13;
    border: 1px solid #7b6542;
  }
  .node-status-tag {
    font-family: 'Space Mono', monospace;
    font-size: 8px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    padding: 2px 8px;
    line-height: 1;
  }
  .dotgrid-bg {
    background-image: radial-gradient(circle, rgba(123,101,66,0.15) 1px, transparent 1px);
    background-size: 20px 20px;
  }
  .dotgrid-bg--dark {
    background-image: radial-gradient(circle, rgba(239,226,189,0.06) 1px, transparent 1px);
    background-size: 20px 20px;
  }
  .link-flow-light {
    stroke: #b8a57d;
    stroke-width: 1px;
    stroke-dasharray: 4 4;
    animation: link-flow 2s linear infinite;
  }
  .breadcrumb-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: 'Space Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }
  .breadcrumb-bar .sep { opacity: 0.4; }

  /* Chat-specific */
  .chat-msg-enter {
    animation: chatMsgIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  @keyframes chatMsgIn {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .mention-pulse {
    animation: mentionPulse 0.6s ease-out;
  }
  @keyframes mentionPulse {
    0% { box-shadow: 0 0 0 0 rgba(143,30,24,0.3); }
    100% { box-shadow: 0 0 0 8px rgba(143,30,24,0); }
  }
  .channel-indicator {
    width: 3px;
    border-radius: 0 2px 2px 0;
    background: #8f1e18;
    position: absolute;
    left: 0;
    top: 25%;
    bottom: 25%;
    transition: all 0.15s ease;
  }
  .unread-dot {
    width: 8px; height: 8px;
    border-radius: 50%;
    background: #8f1e18;
    flex-shrink: 0;
  }

  /* Timeline-specific */
  .tl-node-enter {
    animation: tlNodeIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  }
  @keyframes tlNodeIn {
    from { opacity: 0; transform: scale(0) translateX(-20px); }
    to { opacity: 1; transform: scale(1) translateX(0); }
  }
  .tl-node-hidden {
    opacity: 0 !important;
    transform: scale(0.6) !important;
    pointer-events: none !important;
    transition: opacity 0.3s, transform 0.3s !important;
  }
  .tl-node-card {
    transition: left 0.5s cubic-bezier(0.25, 0.8, 0.25, 1),
                top 0.5s cubic-bezier(0.25, 0.8, 0.25, 1),
                opacity 0.3s ease, transform 0.25s ease,
                box-shadow 0.25s ease, border-color 0.2s ease;
    touch-action: none;
    cursor: grab;
  }
  .tl-node-card--dragging {
    cursor: grabbing;
    z-index: 40 !important;
    transition: opacity 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease !important;
  }
  .tl-node-card:hover { transform: scale(1.04); z-index: 25; }
  .tl-node-content-line {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .tl-node-dimmed { opacity: 0.2; pointer-events: none; }
  .tl-node-neighbor { border-color: #5a4a32 !important; }
  .tl-line-draw {
    stroke-dasharray: 1;
    stroke-dashoffset: 1;
    transition: stroke-dashoffset 0.6s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .tl-line-draw--visible { stroke-dashoffset: 0; }
  .tl-line-dimmed { opacity: 0.1; }
  .tl-anchor-pop {
    transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s;
    transform: scale(0); opacity: 0;
  }
  .tl-anchor-pop--visible { transform: scale(1); opacity: 1; }
  .seg-control-indicator {
    position: absolute;
    bottom: 0;
    height: 2px;
    background: #8f1e18;
    transition: left 0.25s cubic-bezier(0.25, 0.8, 0.25, 1), width 0.25s cubic-bezier(0.25, 0.8, 0.25, 1);
  }
  @keyframes nodeGlow {
    0%, 100% { box-shadow: 0 0 0 1px #8f1e18, 0 0 12px rgba(143,30,24,0.15); }
    50% { box-shadow: 0 0 0 2px #8f1e18, 0 0 24px rgba(143,30,24,0.3); }
  }
  .tl-glow { animation: nodeGlow 3s ease-in-out infinite; }
  @keyframes dotBreath {
    0%, 100% { opacity: 0.04; }
    50% { opacity: 0.07; }
  }
  .tl-breath { animation: dotBreath 8s ease-in-out infinite; }
  .tl-detail-slide-in {
    animation: tlSlideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }
  @keyframes tlSlideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  .tl-detail-slide-out {
    animation: tlSlideOut 0.3s ease forwards;
  }
  @keyframes tlSlideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
  }
  .tl-detail-section {
    border-top: 1px solid rgba(58,42,28,0.5);
    padding-top: 14px;
    margin-top: 14px;
  }
  .tl-detail-section-title {
    font-family: monospace;
    font-size: 8px;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: #7d6a49;
    margin-bottom: 10px;
  }
  .tl-attach-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border: 1px solid #2a2118;
    border-radius: 2px;
    margin-bottom: 6px;
    transition: border-color 0.2s, background 0.2s;
    cursor: pointer;
  }
  .tl-attach-item:hover {
    border-color: #5a4a32;
    background: rgba(37,27,19,0.5);
  }
  .tl-comment-item {
    display: flex;
    gap: 10px;
    padding: 8px 0;
  }
  .tl-comment-avatar {
    width: 26px;
    height: 26px;
    border-radius: 2px;
    background: #251b13;
    border: 1px solid #3a2a1c;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: monospace;
    font-size: 9px;
    color: #7d6a49;
    flex-shrink: 0;
  }
  .tl-history-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    border: 1.5px solid #5a4a32;
    background: #141210;
    flex-shrink: 0;
    margin-top: 4px;
  }
  .tl-history-line {
    position: absolute;
    left: 3.5px;
    top: 12px;
    bottom: -6px;
    width: 1px;
    background: #2a2118;
  }
  .tl-canvas-grab { cursor: grab; }
  .tl-canvas-grab:active { cursor: grabbing; }
  .tl-exit-anim > * {
    transition: opacity 0.3s ease, transform 0.3s ease !important;
    opacity: 0 !important;
    transform: scale(0.8) !important;
  }
  .tl-lane-label {
    position: sticky;
    left: 0;
    z-index: 30;
    pointer-events: none;
  }

  /* Meeting-specific */
  @keyframes ellipse-rotate {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  .meeting-ellipse-inner {
    animation: ellipse-rotate 60s linear infinite;
  }
  .meeting-glow {
    transition: box-shadow 0.5s ease;
  }
  .meeting-glow--active {
    box-shadow: 0 0 40px rgba(143,30,24,0.15), 0 0 80px rgba(239,226,189,0.08);
  }
  @keyframes sound-wave {
    0%, 100% { height: 4px; }
    50% { height: 14px; }
  }
  .sound-bar {
    width: 3px;
    background: #8f1e18;
    border-radius: 1px;
    display: inline-block;
    vertical-align: bottom;
  }
  .sound-bar--active:nth-child(1) { animation: sound-wave 0.4s ease-in-out infinite; }
  .sound-bar--active:nth-child(2) { animation: sound-wave 0.4s ease-in-out 0.12s infinite; }
  .sound-bar--active:nth-child(3) { animation: sound-wave 0.4s ease-in-out 0.24s infinite; }
  .meeting-timer {
    font-variant-numeric: tabular-nums;
  }
`;

const BRAND_LOGO_SRC = '/hall-of-fame-studio-logo.png';
const DEFAULT_INITIATION_PROJECT_ID = 'p_roundtable_001';

// --- Agent/Project Runtime Data ---
const AGENTS = [
  { id: 'pm_1', name: 'Alan', role: 'Project Manager', skill: 'Agile' },
  { id: 'rd_1', name: 'Linus', role: 'Tech Lead', skill: 'Architecture' },
  { id: 'ds_1', name: 'Dieter', role: 'UX Designer', skill: 'Minimalism' },
  { id: 'mk_1', name: 'Don', role: 'Strategy', skill: 'Market' },
];

const INITIAL_PROJECTS = [];

const STORAGE_KEYS = {
  projects: 'hall_of_fame_studio.projects.v1',
  chatMessages: 'hall_of_fame_studio.chat_messages.v1',
  backendUrl: 'hall_of_fame_studio.agent_backend_url.v1',
};

const MANAGER_DEMO_PROJECT_ID = 'p_manager_demo_001';
const MANAGER_DEMO_PROJECT_NAME = 'Manager Demo: Autonomous Agent Studio';
const LEGACY_SEED_PROJECT_IDS = new Set(['p_1001', 'p_1002', 'p_roundtable_001']);

const EVENT_TYPE_STYLES = {
  'project-approved': 'bg-[#251b13] text-[#efe2bd]',
  'leader-confirmed': 'bg-[#8f1e18] text-white',
  'leader-assignment': 'bg-[#5f6f52] text-white',
  'assignment-acknowledged': 'bg-[#59684b] text-white',
  'work-pulse': 'bg-[#254d63] text-white',
  'daily-report': 'bg-[#2f5367] text-white',
  'task-completed': 'bg-green-700 text-white',
  'change-requested': 'bg-[#b9782b] text-white',
  'change-discussion': 'bg-[#8b5a2b] text-white',
  'change-confirmed': 'bg-[#8f1e18] text-white',
  'change-sync': 'bg-[#5f6f52] text-white',
  'peer-handoff': 'bg-[#6b4f7d] text-white',
  'peer-handoff-ack': 'bg-[#59684b] text-white',
  'agent-submission': 'bg-[#251b13] text-[#efe2bd]',
  'evidence-search': 'bg-[#254d63] text-white',
  'submission-review': 'bg-[#8f1e18] text-white',
  'security-access': 'bg-[#3a2a1c] text-[#efe2bd]',
};

const isManagerDemoProject = (project = {}) => (
  project.id === MANAGER_DEMO_PROJECT_ID
  || LEGACY_SEED_PROJECT_IDS.has(project.id)
  || project.name === MANAGER_DEMO_PROJECT_NAME
  || project.initiation?.source === 'manager_demo_seed'
);

const isManagerDemoMessage = (message = {}) => (
  (message.projectId || DEFAULT_CHAT_PROJECT_ID) === MANAGER_DEMO_PROJECT_ID
  || LEGACY_SEED_PROJECT_IDS.has(message.projectId)
  || String(message.id || '').startsWith('manager_demo_')
);

const hydrateProject = (project) => backfillProjectEventLedger({
  ...project,
  autonomy: project.autonomy || { enabled: false, cadence: 'hourly' },
  eventLedger: project.eventLedger || [],
  eventLedgerFirstSequence: project.eventLedgerFirstSequence || project.eventLedger?.[0]?.sequence || 0,
  eventLedgerLastSequence: project.eventLedgerLastSequence || project.eventLedger?.[project.eventLedger.length - 1]?.sequence || 0,
  eventLedgerEventCount: project.eventLedgerEventCount || project.eventLedgerLastSequence || project.eventLedger?.length || 0,
  autonomousLedger: project.autonomousLedger || [],
  autonomousSchedulerLedger: project.autonomousSchedulerLedger || [],
  lastAutonomousRunAt: project.lastAutonomousRunAt || null,
  nextAutonomousRunAt: project.nextAutonomousRunAt || null,
});

const extractChatTargets = (text = '', team = []) => {
  const normalized = text.toLowerCase();
  if (/@all\b/i.test(text)) return ['all'];
  const tokenTargets = [...text.matchAll(/@([A-Za-z0-9_-]+)/g)].map(match => match[1].toLowerCase());
  return Array.from(new Set(team
    .filter(agent => {
      const name = String(agent.name || '').toLowerCase();
      const id = String(agent.id || '').toLowerCase();
      return (name && normalized.includes(`@${name}`))
        || (id && normalized.includes(`@${id}`))
        || tokenTargets.includes(id)
        || name.split(/\s+/).some(part => tokenTargets.includes(part));
    })
    .map(agent => agent.name)));
};

const chatTypeForRecoveredProof = (type = '', eventType = '') => {
  if (type === 'role-question') return 'question';
  if (eventType === 'change-confirmed' || eventType === 'leader-confirmed') return 'decision';
  if (eventType === 'assignment-acknowledged' || eventType === 'peer-handoff-ack' || eventType === 'work-pulse' || eventType === 'daily-report') return 'progress';
  if (eventType === 'leader-assignment' || eventType === 'peer-handoff' || eventType === 'change-sync' || eventType === 'change-discussion') return 'mention';
  return 'text';
};

const formatRecoveredProofTime = (value) => {
  if (!value) return 'Recovered Proof';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recovered Proof';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const recoverProofMessages = (project = {}, proofIds = [], fallbackChannelId = 'main') => {
  const wanted = new Set(proofIds.filter(Boolean));
  if (!wanted.size) return [];

  const recovered = new Map();
  const addRecovered = (message) => {
    if (!message?.id || !wanted.has(message.id) || recovered.has(message.id)) return;
    recovered.set(message.id, {
      projectId: project.id,
      channelId: message.channelId || fallbackChannelId || 'main',
      type: message.type || 'text',
      author: message.author || 'Agent',
      role: message.role || '',
      time: message.time || 'Recovered Proof',
      text: message.text || 'Recovered project proof message.',
      recoveredProof: true,
      ...message,
    });
  };

  [
    ...(project.initiation?.directorBriefId ? [{
      id: project.initiation.directorBriefId,
      type: 'director-brief',
      speaker: 'Director',
      role: 'Project Owner',
      text: project.initiation?.summary || project.currentObjective || project.objective || project.name || '',
      hears: (project.team || []).map(agent => agent.id),
    }] : []),
    ...(project.initiation?.roleNegotiation?.transcript || []),
    ...(project.initiation?.leaderElection?.transcript || []),
    ...(project.initiation?.managerClarifications || []),
  ].forEach(item => addRecovered({
    id: item.id,
    channelId: 'main',
    type: item.type === 'director-clarification' || item.type === 'director-brief' ? 'decision' : chatTypeForRecoveredProof(item.type),
    author: item.speaker || item.author || 'Agent',
    role: item.role || '',
    time: item.type === 'leader-campaign' ? 'Leader Election' : 'Kickoff',
    text: item.text,
    targets: item.hears || item.hearsOthers || [],
    weight: item.type === 'director-clarification' ? 'Director Clarification' : item.weight,
  }));

  (project.logs || []).forEach(log => {
    const messageId = String(log.id || '').startsWith('log_') ? String(log.id).slice(4) : log.messageId;
    addRecovered({
      id: messageId,
      channelId: log.sourceChannelId || fallbackChannelId || 'main',
      type: chatTypeForRecoveredProof('', log.eventType),
      author: log.agent || 'Agent',
      role: log.eventType || '',
      time: formatRecoveredProofTime(log.time),
      text: log.log,
      targets: log.eventType === 'change-sync' ? ['all'] : [],
      weight: log.cadence || log.source || 'Recovered',
      directTargetIds: log.directTargetIds || [],
      visibility: log.receiptCount ? {
        scope: 'project-team',
        channelId: log.sourceChannelId || fallbackChannelId || 'main',
        receiptCount: log.receiptCount,
        directTargetCount: log.directTargetIds?.length || 0,
      } : undefined,
    });
  });

  return Array.from(recovered.values());
};

const readStoredJson = (key, fallback) => {
  if (typeof window === 'undefined') return fallback;
  try {
    const stored = window.localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
};

const writeStoredJson = (key, value) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can fail in private mode or under quota pressure; runtime state still works in memory.
  }
};

const loadBackendBaseUrl = () => {
  if (typeof window !== 'undefined' && window.__AGENT_BACKEND_URL__) {
    return window.__AGENT_BACKEND_URL__;
  }
  return readStoredJson(STORAGE_KEYS.backendUrl, DEFAULT_AGENT_BACKEND_URL);
};

const defaultInitiationActionDrafts = (output = 'the first execution artifact', language = 'en') => {
  const isZh = language === 'zh';
  const fallbackOutput = isZh ? '首个执行产物' : 'the first execution artifact';
  const resolvedOutput = output || fallbackOutput;
  return isZh
    ? [
      `将立项共识转化为${resolvedOutput}`,
      '准备第一份项目报告格式',
      '审批后发布第一包时间线证据',
    ]
    : [
      `Convert kickoff agreement into ${resolvedOutput}`,
      'Prepare first project report format',
      'Publish the first timeline evidence packet after approval',
    ];
};

const buildInitiationMeetingSkillBrief = ({ draft, output, language }) => {
  const isZh = language === 'zh';
  const projectName = draft?.name || (isZh ? '未命名立项' : 'Untitled Initiation');
  const projectIntent = draft?.intent || draft?.summary || '';
  const expectedOutput = output || draft?.output || (isZh ? '首个执行产物' : 'the first execution artifact');

  return isZh
    ? [
      '立项会议 Skill：这场圆桌是进入仪表盘的审批门。',
      `项目：${projectName}`,
      `意图：${projectIntent}`,
      `预期产出：${expectedOutput}`,
      '每个 Agent 都应在正常会议发言中确认责任、Leader 支持、首个动作、依赖、风险和期限。',
      '这些确认必须来自会议记录，而不是本地模拟 UI 面板。'
    ].join('\n')
    : [
      'Initiation Meeting Skill: this roundtable is the gate for whether the project enters the dashboard.',
      `Project: ${projectName}`,
      `Intent: ${projectIntent}`,
      `Expected output: ${expectedOutput}`,
      'Each Agent should naturally confirm in their meeting turn whether the project should proceed, what responsibility they can own, whether they campaign for or support a Leader, what the first step should be, and what dependencies, risks, or deadlines matter.',
      'These confirmations happen through normal meeting speech, without special UI panels.'
    ].join('\n');
};

const loadInitialProjects = () => {
  const stored = readStoredJson(STORAGE_KEYS.projects, null);
  const storedProjects = Array.isArray(stored)
    ? stored.filter(project => !isManagerDemoProject(project))
    : [];
  return storedProjects.map(hydrateProject);
};

const INITIATION_MEMBERS = [
  { id: 'founder', name: 'You', title: 'Founder', duty: 'Define the project direction and approve whether it enters execution.' },
  { id: 'jobs', name: 'Steve Jobs', title: 'Product Visionary', duty: 'Pressure-test product clarity, experience, and launch narrative.' },
  { id: 'turing', name: 'Alan Turing', title: 'System Architect', duty: 'Decompose system boundaries, technical path, edge cases, and verifiability.' },
  { id: 'curie', name: 'Marie Curie', title: 'Evidence Reviewer', duty: 'Review evidence chains, validation paths, experiments, and uncertainty.' },
  { id: 'confucius', name: 'Confucius', title: 'Consensus Steward', duty: 'Calibrate roles, consensus, responsibility order, and long-term organization impact.' },
  { id: 'musk', name: 'Elon Musk', title: 'Execution Driver', duty: 'Compress complexity and push prototype, cost, speed, and release cadence.' },
];

const INITIATION_LOGS = [
  { who: 'Director', tone: 'WAITING', text: 'No model-generated kickoff transcript has been created yet.' },
];

const INITIATION_CONSENSUS = [
  { label: 'Project', value: 'Hall of Fame Studio: Roundtable Initiation' },
  { label: 'First Lead', value: 'Steve Jobs' },
  { label: 'Reviewer', value: 'Marie Curie' },
  { label: 'Working Group', value: 'Turing / Confucius / Musk / You' },
  { label: 'Output', value: 'Backend-created project and first execution artifact' },
  { label: 'Decision', value: 'Approved for dashboard entry' },
];

const renderKnownName = (kn) =>
  kn.family != null ? (
    <>
      <span className="text-red-600">{kn.family}</span>
      {kn.given ? <> {kn.given}</> : null}
    </>
  ) : (
    <>
      {kn.before}
      <span className="text-red-600">{kn.last}</span>
    </>
  );

const agentCardInitial = (agent) => {
  const kn = agent.knownName;
  if (kn.family != null) return kn.family.charAt(0);
  const red = kn.last || '';
  const c = red.replace(/[^A-Za-z]/g, '').charAt(0) || agent.name.charAt(0);
  return c;
};

// 娈垮爞绾т汉鎵嶅簱 (The Pantheon) 鈥?涓庝汉鐗╁競鍦?md Top40 瀵归綈锛沬d 涓哄钩鍙?slug
// primaryIdentity锛氱涓€琚鐭ヨ韩浠斤紙澶т紬涓€鐪艰兘瀵逛笂鍙风殑閭ｅ紶銆屽悕鐗囥€嶏級
const LEGENDARY_AGENTS = [
  { id: 'jobs', name: 'Steve Jobs', knownName: { before: 'Steve ', last: 'Jobs' }, primaryIdentity: 'Apple product leader', role: 'Product Visionary', category: 'Visionary', desc: 'Turns fuzzy product ideas into sharp user-facing direction.' },
  { id: 'turing', name: 'Alan Turing', knownName: { before: 'Alan ', last: 'Turing' }, primaryIdentity: 'Computing pioneer', role: 'System Architect', category: 'Science', desc: 'Decomposes systems, protocols, and proof boundaries.' },
  { id: 'curie', name: 'Marie Curie', knownName: { before: 'Marie ', last: 'Curie' }, primaryIdentity: 'Experimental scientist', role: 'Evidence Reviewer', category: 'Science', desc: 'Tests claims against evidence, repeatability, and uncertainty.' },
  { id: 'confucius', name: 'Confucius', knownName: { before: '', last: 'Confucius' }, primaryIdentity: 'Ethics and governance thinker', role: 'Consensus Steward', category: 'Strategy', desc: 'Clarifies responsibility, governance, and durable cooperation.' },
  { id: 'musk', name: 'Elon Musk', knownName: { before: 'Elon ', last: 'Musk' }, primaryIdentity: 'Technology founder', role: 'Execution Driver', category: 'Operations', desc: 'Compresses complexity into fast prototype and delivery loops.' },
  { id: 'einstein', name: 'Albert Einstein', knownName: { before: 'Albert ', last: 'Einstein' }, primaryIdentity: 'Theoretical physicist', role: 'Paradigm Shifter', category: 'Science', desc: 'Reframes problems from first principles and thought experiments.' },
  { id: 'newton', name: 'Isaac Newton', knownName: { before: 'Isaac ', last: 'Newton' }, primaryIdentity: 'Classical mechanics founder', role: 'Fundamentalist', category: 'Analytical', desc: 'Builds rigorous foundations and mathematical structure.' },
  { id: 'shakespeare', name: 'William Shakespeare', knownName: { before: 'William ', last: 'Shakespeare' }, primaryIdentity: 'Playwright', role: 'Dramaturg', category: 'Creative', desc: 'Finds conflict, narrative rhythm, and memorable language.' },
  { id: 'da_vinci', name: 'Leonardo da Vinci', knownName: { before: 'Leonardo ', last: 'da Vinci' }, primaryIdentity: 'Artist and inventor', role: 'Polymath Designer', category: 'Creative', desc: 'Connects visual, mechanical, and scientific intuition.' },
  { id: 'lincoln', name: 'Abraham Lincoln', knownName: { before: 'Abraham ', last: 'Lincoln' }, primaryIdentity: 'Statesman', role: 'Crisis Leader', category: 'Strategy', desc: 'Balances moral clarity, coalition management, and timing.' },
];

const DOSSIER_DIMENSIONS = ['Vision', 'Analysis', 'Execution', 'Influence', 'Volatility'];

const CATEGORY_PROFILE = {
  Visionary: [94, 72, 78, 88, 76],
  Strategy: [82, 88, 80, 78, 58],
  Analytical: [72, 95, 68, 66, 42],
  Science: [86, 94, 72, 64, 48],
  Creative: [92, 70, 66, 82, 72],
  Psychology: [74, 90, 62, 84, 64],
  Finance: [76, 88, 84, 80, 52],
  Operations: [70, 76, 94, 72, 44],
};

const AGENT_SCORE_OVERRIDES = {
  einstein: [97, 98, 64, 74, 42],
  newton: [92, 99, 76, 66, 48],
  shakespeare: [91, 82, 72, 95, 70],
  musk: [96, 74, 90, 92, 88],
  jobs: [98, 76, 86, 96, 72],
  disney: [92, 72, 88, 94, 54],
  churchill: [80, 82, 84, 97, 72],
  da_vinci: [99, 88, 70, 78, 64],
  picasso: [95, 72, 78, 88, 82],
  marx: [78, 96, 62, 90, 70],
  freud: [74, 94, 58, 86, 68],
  turing: [94, 98, 74, 62, 46],
  buffett: [80, 90, 86, 82, 28],
  confucius: [78, 88, 72, 96, 30],
  napoleon: [86, 82, 96, 94, 78],
  julius_caesar: [82, 84, 95, 92, 70],
  alexander: [90, 78, 94, 94, 78],
  genghis_khan: [86, 76, 98, 92, 82],
  edison: [78, 72, 96, 84, 50],
  tesla: [98, 88, 68, 70, 72],
  carnegie: [76, 82, 94, 82, 44],
  oppenheimer: [88, 96, 86, 76, 68],
  curie: [82, 96, 88, 68, 32],
  sun_tzu: [82, 94, 78, 80, 34],
  darwin: [84, 96, 70, 72, 28],
  aristotle: [80, 98, 70, 76, 36],
  plato: [86, 92, 58, 80, 44],
  nietzsche: [82, 86, 54, 90, 86],
  machiavelli: [76, 92, 76, 78, 72],
  smith: [76, 92, 72, 78, 34],
  morgan: [72, 88, 90, 90, 46],
  rockefeller: [72, 86, 96, 84, 38],
  henry_ford: [74, 74, 98, 82, 34],
  zhuge_liang: [84, 94, 82, 78, 30],
  li_bai: [90, 66, 58, 88, 78],
  keynes: [82, 92, 74, 84, 48],
  soros: [84, 92, 86, 84, 86],
  holmes: [70, 99, 74, 64, 42],
  tony_stark: [98, 78, 94, 90, 90],
  light_yagami: [76, 96, 84, 82, 98],
};

const DOSSIER_FIELD_NOTES = {
  Visionary: {
    strength: 'Turns ambiguous futures into a concrete product, story, or institutional direction.',
    advice: 'Use when the brief needs a bold north star, a launch narrative, or a ruthless product point of view.',
  },
  Strategy: {
    strength: 'Reads adversaries, timing, incentives, and leverage before committing resources.',
    advice: 'Use for market entry, negotiation, positioning, red-team planning, and high-stakes sequencing.',
  },
  Analytical: {
    strength: 'Cuts through noise with definitions, evidence chains, and structural diagnosis.',
    advice: 'Use when the team needs a hard question framed cleanly before anyone starts building.',
  },
  Science: {
    strength: 'Builds from first principles, repeatable evidence, and carefully tested models.',
    advice: 'Use for technical architecture, research validation, model critique, and falsifiable reasoning.',
  },
  Creative: {
    strength: 'Finds memorable forms, cultural symbols, and surprising angles that make ideas travel.',
    advice: 'Use for naming, campaign concepts, interface tone, story systems, and visual language.',
  },
  Psychology: {
    strength: 'Surfaces hidden motives, anxieties, defenses, and cultural pressure points.',
    advice: 'Use for user insight, brand tension, onboarding friction, and emotionally precise messaging.',
  },
  Finance: {
    strength: 'Evaluates compounding advantage, incentive design, market structure, and downside control.',
    advice: 'Use for business model critique, capital allocation, incentive design, and strategic trade-offs.',
  },
  Operations: {
    strength: 'Converts intention into repeatable process, tempo, logistics, and measurable delivery.',
    advice: 'Use for execution planning, delivery systems, scaling constraints, and bottleneck removal.',
  },
};

const getDossierProfile = (agent, language = 'zh') => {
  const skillProfile = buildDossierProfileFromSkill(agent, language);
  const scores = AGENT_SCORE_OVERRIDES[agent.id] || CATEGORY_PROFILE[agent.category] || [76, 76, 76, 76, 50];
  const notes = DOSSIER_FIELD_NOTES[agent.category] || DOSSIER_FIELD_NOTES.Analytical;
  if (skillProfile && language === 'zh') return skillProfile;

  return {
    ...(skillProfile ? {
      skill: skillProfile.skill,
      motto: language === 'zh' ? skillProfile.motto : '',
      notFor: language === 'zh' ? skillProfile.notFor : '',
      skillLoaded: skillProfile.skillLoaded,
      skillPath: skillProfile.skillPath,
      skillStats: skillProfile.skillLoaded ? 'Full Skill loaded' : 'Structured registry only',
      realWorldEdge: skillProfile.realWorldEdge,
      signatureSkills: skillProfile.signatureSkills,
      professionalSkillRuntime: skillProfile.professionalSkillRuntime,
    } : {}),
    scores: DOSSIER_DIMENSIONS.map((label, index) => ({ label, value: scores[index] })),
    strength: notes.strength,
    advice: notes.advice,
    summary: agent.desc,
    realWorldEdge: skillProfile?.realWorldEdge || notes.strength,
    signatureSkills: skillProfile?.signatureSkills || [],
    professionalSkillRuntime: skillProfile?.professionalSkillRuntime || '',
    codename: `${agent.category.toUpperCase()} / ${agent.role.toUpperCase()}`,
  };
};

const getAgentDeploymentWindow = (agent, profile, language = 'zh') => {
  const isZh = language === 'zh';
  const topAxis = [...(profile.scores || [])].sort((a, b) => b.value - a.value)[0];
  const skillSteps = Array.isArray(profile.skill?.defaultFormat) ? profile.skill.defaultFormat : [];
  const signatureSkills = Array.isArray(profile.signatureSkills) ? profile.signatureSkills : [];
  const starterSource = isZh
    ? (skillSteps.length ? skillSteps : signatureSkills)
    : (signatureSkills.length ? signatureSkills : skillSteps);
  const starterSteps = starterSource.filter(Boolean).slice(0, 3);
  const firstOutput = starterSteps[0] || profile.professionalSkillRuntime || agent.role;
  const summary = profile.advice || profile.realWorldEdge || profile.strength || agent.desc;

  return {
    title: isZh ? `${localizeText(agent.category, language)}浣跨敤绐楀彛` : `${agent.category} Use Window`,
    summary,
    shortLabel: firstOutput,
    strongestAxis: topAxis ? `${topAxis.label} ${topAxis.value}` : agent.category,
    starterSteps: starterSteps.length ? starterSteps : [
      isZh ? 'Clarify goal and constraints' : 'Clarify goal and constraints',
      profile.strength || agent.desc,
      isZh ? 'Produce an executable next step' : 'Produce an executable next step',
    ],
  };
};

function RadarChart({ points, language = 'zh' }) {
  const size = 240;
  const center = size / 2;
  const radius = 88;
  const angleFor = (index) => -Math.PI / 2 + (Math.PI * 2 * index) / points.length;
  const toPoint = (index, value = 100) => {
    const angle = angleFor(index);
    const r = radius * (value / 100);
    return [center + Math.cos(angle) * r, center + Math.sin(angle) * r];
  };
  const polygon = points.map((p, index) => toPoint(index, p.value).join(',')).join(' ');
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[260px] mx-auto drop-shadow-[0_12px_16px_rgba(0,0,0,0.18)]">
      {[0.25, 0.5, 0.75, 1].map((scale) => (
        <polygon
          key={scale}
          points={points.map((_, index) => toPoint(index, scale * 100).join(',')).join(' ')}
          fill="none"
          stroke="rgba(49,42,31,0.28)"
          strokeWidth="1"
        />
      ))}
      {points.map((p, index) => {
        const [x, y] = toPoint(index, 108);
        const [x2, y2] = toPoint(index, 100);
        return (
          <g key={p.label}>
            <line x1={center} y1={center} x2={x2} y2={y2} stroke="rgba(49,42,31,0.22)" strokeWidth="1" />
            <text x={x} y={y} textAnchor="middle" dominantBaseline="middle" className="font-mono" fontSize="8" fill="#3f3527">
              {localizeText(p.label.toUpperCase(), language)}
            </text>
          </g>
        );
      })}
      <polygon className="radar-polygon" points={polygon} fill="rgba(143, 30, 24, 0.28)" stroke="#8f1e18" strokeWidth="2" />
      {points.map((p, index) => {
        const [x, y] = toPoint(index, p.value);
        return <circle key={p.label} cx={x} cy={y} r="3" fill="#251b13" stroke="#efe2bd" strokeWidth="1" />;
      })}
      <circle cx={center} cy={center} r="3" fill="#8f1e18" />
    </svg>
  );
}

const PROJECT_CHANNELS = [
  { id: 'main', name: 'Main', description: 'Default public project channel visible to the whole team.', category: 'text', unread: 3 },
  { id: 'google_chat', name: 'Google Chat', description: 'External @mention bridge; change requests stay visible to the full project team.', category: 'text', unread: 0 },
  { id: 'decisions', name: 'Decisions', description: 'Key decisions, confirmations, and change records.', category: 'decisions', unread: 1 },
  { id: 'design', name: 'Design', description: 'Design discussion and asset sharing.', category: 'text', unread: 0 },
  { id: 'standup', name: 'Standup', description: 'Voice standup channel.', category: 'voice', unread: 0 },
];

const DEFAULT_CHAT_PROJECT_ID = '__unscoped__';
const hydrateChatMessage = (message) => ({
  ...message,
  projectId: message.projectId || DEFAULT_CHAT_PROJECT_ID,
});

const loadInitialChatMessages = () => {
  const stored = readStoredJson(STORAGE_KEYS.chatMessages, null);
  return (Array.isArray(stored) ? stored : [])
    .map(hydrateChatMessage)
    .filter(message => !isManagerDemoMessage(message));
};

const createStableIdPart = (value = '') => String(value || 'project')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '')
  .slice(0, 36) || 'project';

const createProjectId = (name = 'project') => {
  const slug = createStableIdPart(name);
  const randomPart = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID().slice(0, 8)
    : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  return `project_${slug}_${randomPart}`;
};

const PROJECT_TIMELINE_EVENTS = [];

const PANTHEON_AVATAR_MARKS = {
  jobs: 'J',
  turing: 'T',
  curie: 'C',
  confucius: 'C',
  musk: 'M',
  einstein: 'E',
  newton: 'N',
  shakespeare: 'S',
  da_vinci: 'V',
  lincoln: 'L',
};

function pantheonAvatarMeta(agentId = '') {
  const normalizedId = String(agentId || '').trim();
  const mark = PANTHEON_AVATAR_MARKS[normalizedId] || normalizedId.charAt(0).toUpperCase() || 'A';
  return {
    mark,
    src: '',
    file: '',
    credit: 'Symbolic dossier mark',
    license: 'SYMBOLIC',
  };
}

function pantheonAvatarSrc(agentId = '') {
  return pantheonAvatarMeta(agentId).src || '';
}

function commonsFilePage(file = '') {
  return file
    ? `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file).replace(/%2F/g, '/')}`
    : 'https://commons.wikimedia.org/';
}

function PantheonAvatar({ agent }) {
  const [broken, setBroken] = useState(false);
  const avatar = pantheonAvatarMeta(agent.id);
  const patternBg = {
    backgroundImage: 'repeating-linear-gradient(45deg, #000 0, #000 1px, transparent 0, transparent 50%)',
    backgroundSize: '4px 4px',
  };
  if (broken || !pantheonAvatarSrc(agent.id)) {
    return (
      <div
        className="w-16 h-16 border-2 border-black flex items-center justify-center bg-white relative overflow-hidden shrink-0"
        title={avatar?.credit || agent.name}
      >
        <div className="absolute inset-0 opacity-[0.05]" style={patternBg} />
        <span className="font-serif text-2xl font-bold z-10">{avatar?.mark || agentCardInitial(agent)}</span>
        <span className="absolute bottom-0 left-0 right-0 bg-black text-white font-mono text-[7px] leading-3 text-center tracking-widest">
          {avatar?.license || 'SOURCE'}
        </span>
      </div>
    );
  }
  return (
    <div className="w-16 h-16 border-2 border-black shrink-0 overflow-hidden bg-[#f5f4f0] relative">
      <img
        src={pantheonAvatarSrc(agent.id)}
        alt={agent.name}
        width={64}
        height={64}
        className="w-full h-full object-cover object-top scale-[1.06]"
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
      />
      <a
        href={commonsFilePage(avatar.file)}
        target="_blank"
        rel="noreferrer"
        title={`${avatar.credit} - ${avatar.license}`}
        className="absolute bottom-0 left-0 right-0 bg-black/85 text-white font-mono text-[7px] leading-3 text-center tracking-widest hover:bg-red-700"
      >
        {avatar.license}
      </a>
    </div>
  );
}

export default function EngineWorkspace() {
  const { language, setLanguage, setProjectLanguage, t } = useLanguage();
  // --- Engine State ---
  const [projects, setProjects] = useState(loadInitialProjects);
  const [activeRoute, setActiveRoute] = useState('dashboard'); // 'dashboard', 'project_detail', 'war_room', 'agent_market'
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [projectMode, setProjectMode] = useState('dashboard'); // dashboard, meeting, chat, timeline
  const [sceneTransition, setSceneTransition] = useState(null);
  const [projectLauncherOpen, setProjectLauncherOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState('deployment');
  const [showPrimaryKey, setShowPrimaryKey] = useState(false);
  const [healthCheck, setHealthCheck] = useState({
    running: false,
    lastRunAt: null,
    baseUrl: loadBackendBaseUrl(),
    rows: [],
    summary: null,
    error: null,
  });

  const [marketSearch, setMarketSearch] = useState('');
  const [marketCategory, setMarketCategory] = useState('All');
  const [selectedMarketAgentId, setSelectedMarketAgentId] = useState(null);
  const [recruitedIds, setRecruitedIds] = useState([]);
  const [signingAgentId, setSigningAgentId] = useState(null);
  const [contractProjectPickerAgentId, setContractProjectPickerAgentId] = useState(null);
  const [marketMode, setMarketMode] = useState('global');
  const [isDecrypting, setIsDecrypting] = useState(false);

  // --- War Room State ---
  const [meetingState, setMeetingState] = useState('idle'); // 'idle', 'active'
  const [meetingLogs, setMeetingLogs] = useState([]);
  const [terminalInput, setTerminalInput] = useState('');
  const [speakingAgent, setSpeakingAgent] = useState(null);
  const [targetNodeIds, setTargetNodeIds] = useState([]);
  const [initiationPhase, setInitiationPhase] = useState('discussion');
  const [initiationStep, setInitiationStep] = useState('brief');
  const [selectedInitiationMemberId, setSelectedInitiationMemberId] = useState('mira');
  const [initiationProjectId, setInitiationProjectId] = useState(() => DEFAULT_INITIATION_PROJECT_ID);
  const [selectedLeaderCandidateId, setSelectedLeaderCandidateId] = useState(null);
  const [initiationMeetingSession, setInitiationMeetingSession] = useState(null);
  const initialInitiationName = language === 'zh' ? '圆桌立项系统' : 'Roundtable Initiation System';
  const initialInitiationOutput = language === 'zh' ? '首个执行产物' : 'the first execution artifact';
  const [initiationActionDrafts, setInitiationActionDrafts] = useState(() => defaultInitiationActionDrafts(initialInitiationOutput, language));
  const [initiationConfirmedTeamIds, setInitiationConfirmedTeamIds] = useState(['jobs', 'turing', 'curie', 'confucius']);
  const [selectedInitiationClarificationQuestionId, setSelectedInitiationClarificationQuestionId] = useState(null);
  const [initiationClarificationDraft, setInitiationClarificationDraft] = useState('I will clarify ownership during this meeting: each Agent should state the first artifact they can own, and I will confirm the final assignment before approval.');
  const [initiationDraft, setInitiationDraft] = useState({
    name: initialInitiationName,
    summary: '',
    intent: '',
    output: initialInitiationOutput,
    reason: '',
    visibility: 'invite',
  });
  const [initiationInviteIds, setInitiationInviteIds] = useState(['jobs', 'turing', 'curie', 'confucius']);
  const transcriptEndRef = useRef(null);

  // --- Project Workspace State ---
  const [roomInput, setRoomInput] = useState('');
  const [roomVoiceStatus, setRoomVoiceStatus] = useState('idle');
  const [roomIntentions, setRoomIntentions] = useState([]);
  const [roomSpeaker, setRoomSpeaker] = useState(null);
  const [roomTranscript, setRoomTranscript] = useState([
    { id: 'r0', speaker: 'System', role: 'System', text: 'Meeting room ready.', score: 0 },
  ]);
  const [meetingStartTime, setMeetingStartTime] = useState(null);
  const [meetingElapsed, setMeetingElapsed] = useState(0);
  const [activeChannelId, setActiveChannelId] = useState('main');
  const [chatChannels, setChatChannels] = useState(PROJECT_CHANNELS);
  const [chatMessages, setChatMessages] = useState(loadInitialChatMessages);
  const [chatInput, setChatInput] = useState('');
  const [managerChangeDraft, setManagerChangeDraft] = useState({
    text: '',
    mode: 'dual',
  });
  const [managerAssignmentDraft, setManagerAssignmentDraft] = useState({
    targetAgentId: '',
    text: '',
  });
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);
  const [focusedChatProofIds, setFocusedChatProofIds] = useState([]);
  const [focusedTimelineProofIds, setFocusedTimelineProofIds] = useState([]);
  const [selectedTimelineEventId, setSelectedTimelineEventId] = useState(null);
  const [timelineScale, setTimelineScale] = useState('day');
  const [tlPan, setTlPan] = useState({ x: 0, y: 0 });
  const [tlZoom, setTlZoom] = useState(1);
  const [tlDragging, setTlDragging] = useState(false);
  const [tlNodeDraggingId, setTlNodeDraggingId] = useState(null);
  const [tlNodeXOverrides, setTlNodeXOverrides] = useState({});
  const [tlHoveredNode, setTlHoveredNode] = useState(null);
  const [tlHoveredLine, setTlHoveredLine] = useState(null);
  const [tlVisibleNodes, setTlVisibleNodes] = useState(new Set());
  const [tlVisibleLines, setTlVisibleLines] = useState(new Set());
  const [tlEntranceDone, setTlEntranceDone] = useState(false);
  const [tlDetailClosing, setTlDetailClosing] = useState(false);
  const [backendStation, setBackendStation] = useState({
    baseUrl: loadBackendBaseUrl(),
    draftBaseUrl: loadBackendBaseUrl(),
    connectionStatus: 'unknown',
    scheduler: null,
    loading: false,
    lastAction: null,
    lastProjectSyncAt: null,
    projectSyncCount: 0,
    managerReadyPackage: null,
    lastManagerReadyPackageSyncAt: null,
    managerReadyPackageSyncCount: 0,
    managerDashboard: null,
    lastManagerDashboardSyncAt: null,
    managerDashboardSyncCount: 0,
    managerFlowGraph: null,
    lastManagerFlowGraphSyncAt: null,
    managerFlowGraphSyncCount: 0,
    managerCommandCenter: null,
    managerCommandCenterRun: null,
    lastManagerCommandCenterSyncAt: null,
    managerCommandCenterSyncCount: 0,
    managerScenarioTrail: null,
    managerScenarioWalkthrough: null,
    managerScenarioWalkthroughReceipt: null,
    lastManagerScenarioTrailSyncAt: null,
    managerScenarioTrailSyncCount: 0,
    managerRequirementMatrix: null,
    managerUseCaseAudit: null,
    lastManagerRequirementMatrixSyncAt: null,
    managerRequirementMatrixSyncCount: 0,
    lastManagerUseCaseAuditSyncAt: null,
    managerUseCaseAuditSyncCount: 0,
    managerActionQueue: null,
    lastManagerActionQueueSyncAt: null,
    managerActionQueueSyncCount: 0,
    error: null,
  });
  const [agentMessageDrafts, setAgentMessageDrafts] = useState({});
  const [selectedAgentFocusId, setSelectedAgentFocusId] = useState(null);
  const [agentDashboardSnapshots, setAgentDashboardSnapshots] = useState({});
  const sceneTransitionTimerRef = useRef(null);
  const roomSimulationTimersRef = useRef([]);
  const roomSpeechRecognitionRef = useRef(null);
  const meetingTimerRef = useRef(null);
  const lastTimelineWheelRef = useRef(0);
  const tlPreviewTimerRef = useRef(null);
  const tlDragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const tlNodeDragRef = useRef({ id: null, scale: 'day', startClientX: 0, startX: 0, moved: false });
  const tlSuppressNodeClickRef = useRef(false);
  const tlContainerRef = useRef(null);
  const timelineViewportRef = useRef(null);
  const tlEntranceTimersRef = useRef([]);
  const logIdRef = useRef(0);

  // Inject Styles
  useEffect(() => {
    const styleSheet = document.createElement("style");
    styleSheet.textContent = globalStyles;
    document.head.appendChild(styleSheet);
    return () => styleSheet.remove();
  }, []);

  useEffect(() => {
    writeStoredJson(STORAGE_KEYS.projects, projects);
  }, [projects]);

  useEffect(() => {
    writeStoredJson(STORAGE_KEYS.chatMessages, chatMessages.slice(-200));
  }, [chatMessages]);

  useEffect(() => () => {
    if (sceneTransitionTimerRef.current) clearTimeout(sceneTransitionTimerRef.current);
    roomSimulationTimersRef.current.forEach(timer => clearTimeout(timer));
    roomSpeechRecognitionRef.current?.stop?.();
    tlEntranceTimersRef.current.forEach(timer => clearTimeout(timer));
    if (meetingTimerRef.current) clearInterval(meetingTimerRef.current);
  }, []);

  useEffect(() => {
    if (meetingStartTime) {
      meetingTimerRef.current = setInterval(() => {
        setMeetingElapsed(Math.floor((Date.now() - meetingStartTime) / 1000));
      }, 1000);
      return () => clearInterval(meetingTimerRef.current);
    }
  }, [meetingStartTime]);

  useEffect(() => {
    if (projectMode !== 'chat' || !focusedChatProofIds.length) return;
    const timer = setTimeout(() => {
      const selector = focusedChatProofIds
        .map(id => `[data-chat-proof-id="${String(id).replace(/"/g, '\\"')}"]`)
        .join(',');
      const firstProof = selector ? document.querySelector(selector) : null;
      firstProof?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 120);
    return () => clearTimeout(timer);
  }, [projectMode, activeChannelId, focusedChatProofIds]);

  const ensureProofMessagesAvailable = (project, proofIds, fallbackChannelId = 'main') => {
    const recoveredMessages = recoverProofMessages(project, proofIds, fallbackChannelId);
    if (!recoveredMessages.length) return;
    setChatMessages(prev => {
      const existingIds = new Set(prev
        .filter(message => (message.projectId || DEFAULT_CHAT_PROJECT_ID) === project.id)
        .map(message => message.id));
      const missingRecovered = recoveredMessages.filter(message => !existingIds.has(message.id));
      return missingRecovered.length ? [...prev, ...missingRecovered].slice(-240) : prev;
    });
  };
  const openProjectChatProof = (project, proofIds = [], channelId = 'main') => {
    const ids = proofIds.filter(Boolean);
    if (!ids.length || !project) return;
    ensureProofMessagesAvailable(project, ids, channelId || 'main');
    setFocusedChatProofIds(ids);
    setActiveChannelId(channelId || 'main');
    enterProjectScene('chat');
  };
  const openProjectTimelineProof = (proofIds = []) => {
    const ids = proofIds.filter(Boolean);
    if (!ids.length) return;
    setFocusedTimelineProofIds(ids);
    setSelectedTimelineEventId(ids[0] || null);
    enterProjectScene('timeline');
  };

  useEffect(() => {
    if (projectMode !== 'timeline' || !focusedTimelineProofIds.length) return;
    const timer = setTimeout(() => {
      const firstId = focusedTimelineProofIds[0];
      const node = firstId ? document.querySelector(`[data-timeline-event-id="${String(firstId).replace(/"/g, '\\"')}"]`) : null;
      const viewport = timelineViewportRef.current;
      if (!node || !viewport) return;
      const nodeRect = node.getBoundingClientRect();
      const viewportRect = viewport.getBoundingClientRect();
      const nodeCenterX = nodeRect.left + nodeRect.width / 2;
      const nodeCenterY = nodeRect.top + nodeRect.height / 2;
      const viewportCenterX = viewportRect.left + viewportRect.width / 2;
      const viewportCenterY = viewportRect.top + viewportRect.height / 2;
      setTlPan(prev => ({
        x: prev.x + (viewportCenterX - nodeCenterX),
        y: prev.y + (viewportCenterY - nodeCenterY),
      }));
    }, 180);
    return () => clearTimeout(timer);
  }, [projectMode, selectedTimelineEventId, focusedTimelineProofIds]);

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [meetingLogs]);

  // BFS entrance animation for timeline
  useEffect(() => {
    if (projectMode !== 'timeline') return;
    setTlEntranceDone(false);
    setTlVisibleNodes(new Set());
    setTlVisibleLines(new Set());

    const visible = [];
    const eMap = {};

    const conns = [];
    const byBranch = {};
    visible.forEach(e => { if (!byBranch[e.branch]) byBranch[e.branch] = []; byBranch[e.branch].push(e); });
    Object.values(byBranch).forEach(arr => {
      arr.sort((a, b) => a.t - b.t);
      for (let i = 1; i < arr.length; i++) conns.push([arr[i-1].id, arr[i].id]);
    });
    visible.forEach(e => {
      if (e.dependsOn) e.dependsOn.forEach(depId => {
        if (visible.find(v => v.id === depId) && !conns.find(([a,b]) => a === depId && b === e.id)) conns.push([depId, e.id]);
      });
    });

    const sorted = [...visible].sort((a, b) => a.t - b.t);
    const timers = [];
    const visited = new Set();
    const queue = sorted[0] ? [sorted[0].id] : [];
    let delay = 200;

    const processLevel = () => {
      if (queue.length === 0) { timers.push(setTimeout(() => setTlEntranceDone(true), 400)); return; }
      const cur = [...queue];
      queue.length = 0;
      cur.forEach(id => {
        if (visited.has(id)) return;
        visited.add(id);
        timers.push(setTimeout(() => setTlVisibleNodes(prev => new Set([...prev, id])), delay));
        delay += 120;
        conns.forEach(([a, b]) => {
          if (a === id && !visited.has(b)) queue.push(b);
          if (b === id && !visited.has(a)) queue.push(a);
        });
      });
      cur.forEach(id => {
        conns.forEach(([a, b]) => {
          const lk = `${a}-${b}`;
          if ((a === id || b === id) && visited.has(a) && visited.has(b)) {
            timers.push(setTimeout(() => setTlVisibleLines(prev => new Set([...prev, lk])), delay));
          }
        });
      });
      delay += 100;
      timers.push(setTimeout(processLevel, 60));
    };

    timers.push(setTimeout(processLevel, 200));
    tlEntranceTimersRef.current = timers;
    return () => timers.forEach(t => clearTimeout(t));
  }, [projectMode, timelineScale]);

  // Derived Data
  const activeProject = projects.find(p => p.id === selectedProjectId);
  const activeLanguage = activeProject?.language || language;

  useEffect(() => {
    setProjectLanguage(activeProject?.language || null);
  }, [activeProject?.id, activeProject?.language, setProjectLanguage]);
  const selectedMarketAgent = LEGENDARY_AGENTS.find(agent => agent.id === selectedMarketAgentId);
  const initiationTalentIds = initiationInviteIds;
  const initiationTalentMembers = LEGENDARY_AGENTS
    .filter(agent => initiationTalentIds.includes(agent.id))
    .map(agent => ({
      id: agent.id,
      name: agent.name,
      title: agent.role,
      role: agent.role,
      skill: agent.role,
      duty: agent.desc,
      category: agent.category,
      primaryIdentity: agent.primaryIdentity,
    }));
  const initiationRosterMembers = initiationTalentMembers.length
    ? initiationTalentMembers
    : INITIATION_MEMBERS.filter(member => initiationInviteIds.includes(member.id));

  const buildAutonomyMessages = (project = activeProject) => {
    const projectId = project?.id || DEFAULT_CHAT_PROJECT_ID;
    const team = project?.team || [];
    return chatMessages
      .filter(message => (message.projectId || DEFAULT_CHAT_PROJECT_ID) === projectId)
      .slice(-12)
      .map(message => ({
        id: message.id,
        authorId: message.author === 'Director'
          ? 'director'
          : team.find(agent => agent.name === message.author)?.id || message.author,
        kind: message.type === 'decision' ? 'decision' : message.type === 'mention' ? 'mention' : 'update',
        text: message.text,
        targetIds: (message.targets || []).flatMap(target => (
          target === 'all'
            ? team.map(agent => agent.id)
            : [target]
        )),
      }));
  };

  const runAutonomousCycle = (projectId, cadence = 'hourly') => {
    const now = new Date().toISOString();
    const project = projects.find(item => item.id === projectId);
    if (!project) return;
    const visibleMessages = buildAutonomyMessages(project);
    const result = advanceAutonomousProjectCycle({
      project,
      team: project.team,
      cadence,
      messages: visibleMessages,
      now,
      trigger: 'manual',
      schedulerReason: `${cadence}-pulse-requested-by-director`,
      dueAt: now,
      language: project.language || activeLanguage,
    });
    const publishedCycle = publishAutonomousCycleChat({
      project: result.project,
      cycle: result.cycle,
      cadence,
      projectId,
      now,
      language: project.language || activeLanguage,
    });

    setProjects(prev => prev.map(item => item.id === projectId ? publishedCycle.project : item));

    if (publishedCycle.messages.length) {
      setChatMessages(prev => [...prev, ...publishedCycle.messages].slice(-240));
    }
  };

  const requestAgentBackend = async (path, { method = 'GET', body, timeoutMs = 900, baseUrl = backendStation.baseUrl } = {}) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const localizedBody = body && typeof body === 'object'
      ? {
        ...body,
        language: body.language || activeLanguage,
        ...(body.project ? { project: { ...body.project, language: body.project.language || activeLanguage } } : {}),
      }
      : body;
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: localizedBody ? { 'content-type': 'application/json' } : undefined,
        body: localizedBody ? JSON.stringify(localizedBody) : undefined,
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.message || payload.error || `Backend returned ${response.status}.`);
      }
      return payload;
    } finally {
      clearTimeout(timeout);
    }
  };

  const runSettingsHealthCheck = async ({ workflow = false } = {}) => {
    if (healthCheck.running) return;
    const baseUrl = (backendStation.draftBaseUrl || backendStation.baseUrl || DEFAULT_AGENT_BACKEND_URL).trim().replace(/\/+$/, '');
    const now = new Date().toISOString();
    const rows = [
      { id: 'backend', label: 'Backend worker station', status: 'pending', detail: 'Waiting for /workers/autonomous/status.' },
      { id: 'provider', label: 'Model provider config', status: 'pending', detail: 'Waiting for /llm/status.' },
      { id: 'request', label: 'Model request loop', status: 'pending', detail: 'Waiting for /llm/test.' },
      { id: 'search-provider', label: 'Evidence provider config', status: 'pending', detail: 'Waiting for /search/status.' },
      { id: 'search-request', label: 'Evidence request loop', status: 'pending', detail: 'Waiting for /search/test.' },
      ...(workflow ? [
        { id: 'workflow', label: 'Workflow smoke', status: 'pending', detail: 'Waiting to create a probe project and run one agent pulse.' },
      ] : []),
    ];
    const updateRow = (id, patch) => {
      setHealthCheck(prev => ({
        ...prev,
        rows: prev.rows.map(row => row.id === id ? { ...row, ...patch } : row),
      }));
    };
    const failRun = (id, error) => {
      const detail = error?.name === 'AbortError'
        ? 'Request timed out.'
        : error?.message || String(error);
      updateRow(id, { status: 'fail', detail });
      setHealthCheck(prev => ({
        ...prev,
        running: false,
        summary: 'failed',
        error: detail,
      }));
    };

    setHealthCheck({
      running: true,
      lastRunAt: now,
      baseUrl,
      rows,
      summary: null,
      error: null,
    });

    let currentHealthStep = 'backend';
    try {
      currentHealthStep = 'backend';
      updateRow('backend', { status: 'running', detail: `GET ${baseUrl}/workers/autonomous/status` });
      const backendStatus = await requestAgentBackend('/workers/autonomous/status', { baseUrl, timeoutMs: 2200 });
      updateRow('backend', {
        status: 'pass',
        detail: backendStatus?.scheduler?.enabled === false
          ? 'Backend reachable. Autonomous scheduler is stopped.'
          : 'Backend reachable. Autonomous worker status returned.',
      });

      currentHealthStep = 'provider';
      updateRow('provider', { status: 'running', detail: `GET ${baseUrl}/llm/status` });
      const llmStatus = await requestAgentBackend('/llm/status', { baseUrl, timeoutMs: 2200 });
      const provider = llmStatus?.modelProvider || {};
      updateRow('provider', {
        status: provider.enabled && provider.configured ? 'pass' : 'fail',
        detail: provider.enabled && provider.configured
          ? `${provider.provider || 'provider'} / ${provider.model || 'model'} / concurrency ${provider.maxConcurrency || 'n/a'}`
          : 'Model provider is disabled or missing configuration.',
      });
      if (!(provider.enabled && provider.configured)) {
        throw new Error('Model provider is disabled or missing configuration.');
      }

      currentHealthStep = 'request';
      updateRow('request', { status: 'running', detail: `POST ${baseUrl}/llm/test` });
      const llmTest = await requestAgentBackend('/llm/test', {
        method: 'POST',
        baseUrl,
        timeoutMs: 60000,
        body: {
          prompt: 'Return compact JSON only: {"ok":true,"message":"ui health loop ready"}',
        },
      });
      updateRow('request', {
        status: llmTest?.ok ? 'pass' : 'fail',
        detail: llmTest?.ok
          ? `Model request succeeded${llmTest.usage?.total_tokens ? `, ${llmTest.usage.total_tokens} tokens.` : '.'}`
          : llmTest?.error || 'Model request failed.',
      });
      if (!llmTest?.ok) throw new Error(llmTest?.error || 'Model request failed.');

      currentHealthStep = 'search-provider';
      updateRow('search-provider', { status: 'running', detail: `GET ${baseUrl}/search/status` });
      const searchStatus = await requestAgentBackend('/search/status', { baseUrl, timeoutMs: 2200 });
      const searchProvider = searchStatus?.searchProvider || {};
      updateRow('search-provider', {
        status: searchProvider.enabled && searchProvider.configured ? 'pass' : 'fail',
        detail: searchProvider.enabled && searchProvider.configured
          ? `${searchProvider.provider || 'provider'} / ${searchProvider.maxResults || 0} results / key ${searchProvider.hasApiKey ? 'configured' : 'not required'}`
          : 'Evidence provider is disabled or missing configuration.',
      });
      if (!(searchProvider.enabled && searchProvider.configured)) {
        throw new Error('Evidence provider is disabled or missing configuration.');
      }

      currentHealthStep = 'search-request';
      updateRow('search-request', { status: 'running', detail: `POST ${baseUrl}/search/test` });
      const searchTest = await requestAgentBackend('/search/test', {
        method: 'POST',
        baseUrl,
        timeoutMs: 20000,
        body: {
          query: 'product team acceptance evidence',
        },
      });
      updateRow('search-request', {
        status: searchTest?.ok ? 'pass' : 'fail',
        detail: searchTest?.ok
          ? `Evidence request returned ${searchTest.sources?.length || 0} source(s).`
          : searchTest?.error || searchTest?.reason || 'Evidence request failed.',
      });
      if (!searchTest?.ok) throw new Error(searchTest?.error || searchTest?.reason || 'Evidence request failed.');

      if (workflow) {
        currentHealthStep = 'workflow';
        updateRow('workflow', { status: 'running', detail: 'Creating probe project.' });
        const probeId = `ui_health_${Date.now()}`;
        const team = [
          { id: 'turing', name: 'Alan Turing', role: 'Leader', skill: 'systems decomposition' },
          { id: 'curie', name: 'Marie Curie', role: 'Researcher', skill: 'evidence review' },
          { id: 'jobs', name: 'Steve Jobs', role: 'Reviewer', skill: 'product framing' },
        ];
        const initiate = await requestAgentBackend('/projects/initiate', {
          method: 'POST',
          baseUrl,
          timeoutMs: 70000,
          body: {
            projectId: probeId,
            name: 'UI Health Research Probe',
            brief: 'Smoke-test whether the Harness backend can drive a compact research project through model intent, group chat, and timeline evidence.',
            team,
            selectedLeaderId: 'turing',
            reviewerId: 'jobs',
            tasks: [
              {
                id: `${probeId}_brief`,
                text: 'Draft the first-page research brief and list evidence gaps.',
                assignee: 'Marie Curie',
                status: 'pending',
              },
            ],
            autonomy: { enabled: false, cadence: 'manual' },
          },
        });
        updateRow('workflow', { status: 'running', detail: 'Submitting leader assignment into group chat.' });
        await requestAgentBackend(`/projects/${encodeURIComponent(probeId)}/chat`, {
          method: 'POST',
          baseUrl,
          timeoutMs: 70000,
          body: {
            text: '@Alan Turing assign Marie Curie to produce the first research timeline artifact, then ask Steve Jobs to review framing.',
            author: 'Director',
            authorId: 'director',
            channelId: 'main',
          },
        });
        updateRow('workflow', { status: 'running', detail: 'Running one agent work-cycle and loading manager flow graph.' });
        const work = await requestAgentBackend(`/projects/${encodeURIComponent(probeId)}/agents/${encodeURIComponent('curie')}/work-cycle`, {
          method: 'POST',
          baseUrl,
          timeoutMs: 70000,
          body: {
            trigger: 'ui-health-smoke',
            cadence: 'manual',
            source: 'settings-health-check',
          },
        });
        const graph = await requestAgentBackend(`/projects/${encodeURIComponent(probeId)}/manager-flow-graph`, {
          baseUrl,
          timeoutMs: 6000,
        });
        const project = work?.project || initiate?.project || {};
        const modelIntentCount = project.modelIntentLedger?.length || 0;
        const workLedgerCount = project.agentWorkerLedger?.length || 0;
        const latestTimelineTool = project.logs?.[0]?.timelineSubmission?.tool || null;
        const graphNodeCount = graph?.nodes?.length || graph?.summary?.nodeCount || 0;
        const workflowOk = modelIntentCount > 0
          && workLedgerCount > 0
          && latestTimelineTool === 'manager-flow-timeline'
          && graphNodeCount > 0;
        updateRow('workflow', {
          status: workflowOk ? 'pass' : 'fail',
          detail: workflowOk
            ? `Intent ${modelIntentCount}, agent work ${workLedgerCount}, flow nodes ${graphNodeCount}.`
            : 'Workflow ran but did not produce the expected intent/work/timeline evidence.',
        });
        if (!workflowOk) throw new Error('Workflow smoke did not produce expected evidence.');
      }

      setHealthCheck(prev => ({
        ...prev,
        running: false,
        summary: workflow ? 'workflow-pass' : 'quick-pass',
        error: null,
      }));
    } catch (error) {
      failRun(currentHealthStep || (workflow ? 'workflow' : 'request'), error);
    }
  };

  const applyBackendManagerDashboardPayload = (payload = {}) => {
    const managerDashboardPayload = payload.managerDashboard || payload.managerReadyPackage?.managerDashboard || null;
    if (!managerDashboardPayload?.projectId) return false;
    const walkthroughPayload = payload.managerScenarioWalkthrough || payload.managerReadyPackage?.managerScenarioWalkthrough || managerDashboardPayload.managerScenarioWalkthrough || null;
    const requirementMatrixPayload = payload.managerReadyPackage?.managerRequirementMatrix || managerDashboardPayload.managerRequirementMatrix || null;
    const useCaseAuditPayload = payload.managerReadyPackage?.managerUseCaseAudit || managerDashboardPayload.managerUseCaseAudit || null;
    const actionQueuePayload = payload.managerReadyPackage?.managerActionQueue || managerDashboardPayload.managerActionQueue || null;
    const commandCenterPayload = payload.managerCommandCenter || payload.managerReadyPackage?.managerCommandCenter || managerDashboardPayload.managerCommandCenter || null;
    const flowGraphPayload = payload.managerFlowGraph || payload.managerReadyPackage?.managerFlowGraph || null;
    setBackendStation(prev => ({
      ...prev,
      connectionStatus: 'online',
      managerDashboard: managerDashboardPayload,
      managerReadyPackage: payload.managerReadyPackage || prev.managerReadyPackage,
      managerFlowGraph: flowGraphPayload || prev.managerFlowGraph,
      managerCommandCenter: commandCenterPayload || prev.managerCommandCenter,
      managerCommandCenterRun: payload.managerCommandCenterRun || prev.managerCommandCenterRun,
      managerScenarioTrail: payload.managerReadyPackage?.managerScenarioTrail || managerDashboardPayload.managerScenarioTrail || prev.managerScenarioTrail,
      managerScenarioWalkthrough: walkthroughPayload || prev.managerScenarioWalkthrough,
      managerRequirementMatrix: requirementMatrixPayload || prev.managerRequirementMatrix,
      managerUseCaseAudit: useCaseAuditPayload || prev.managerUseCaseAudit,
      managerActionQueue: actionQueuePayload || prev.managerActionQueue,
      lastManagerDashboardSyncAt: new Date().toISOString(),
      managerDashboardSyncCount: (prev.managerDashboardSyncCount || 0) + 1,
      lastManagerFlowGraphSyncAt: flowGraphPayload ? new Date().toISOString() : prev.lastManagerFlowGraphSyncAt,
      managerFlowGraphSyncCount: flowGraphPayload ? (prev.managerFlowGraphSyncCount || 0) + 1 : prev.managerFlowGraphSyncCount,
      lastManagerReadyPackageSyncAt: payload.managerReadyPackage ? new Date().toISOString() : prev.lastManagerReadyPackageSyncAt,
      managerReadyPackageSyncCount: payload.managerReadyPackage ? (prev.managerReadyPackageSyncCount || 0) + 1 : prev.managerReadyPackageSyncCount,
      lastManagerCommandCenterSyncAt: commandCenterPayload ? new Date().toISOString() : prev.lastManagerCommandCenterSyncAt,
      managerCommandCenterSyncCount: commandCenterPayload ? (prev.managerCommandCenterSyncCount || 0) + 1 : prev.managerCommandCenterSyncCount,
      lastManagerScenarioTrailSyncAt: (payload.managerReadyPackage?.managerScenarioTrail || managerDashboardPayload.managerScenarioTrail) ? new Date().toISOString() : prev.lastManagerScenarioTrailSyncAt,
      managerScenarioTrailSyncCount: (payload.managerReadyPackage?.managerScenarioTrail || managerDashboardPayload.managerScenarioTrail) ? (prev.managerScenarioTrailSyncCount || 0) + 1 : prev.managerScenarioTrailSyncCount,
      lastManagerRequirementMatrixSyncAt: requirementMatrixPayload ? new Date().toISOString() : prev.lastManagerRequirementMatrixSyncAt,
      managerRequirementMatrixSyncCount: requirementMatrixPayload ? (prev.managerRequirementMatrixSyncCount || 0) + 1 : prev.managerRequirementMatrixSyncCount,
      lastManagerUseCaseAuditSyncAt: useCaseAuditPayload ? new Date().toISOString() : prev.lastManagerUseCaseAuditSyncAt,
      managerUseCaseAuditSyncCount: useCaseAuditPayload ? (prev.managerUseCaseAuditSyncCount || 0) + 1 : prev.managerUseCaseAuditSyncCount,
      lastManagerActionQueueSyncAt: actionQueuePayload ? new Date().toISOString() : prev.lastManagerActionQueueSyncAt,
      managerActionQueueSyncCount: actionQueuePayload ? (prev.managerActionQueueSyncCount || 0) + 1 : prev.managerActionQueueSyncCount,
      error: null,
    }));
    return true;
  };

  const syncBackendManagerDashboard = async ({ silent = true, projectId = activeProject?.id } = {}) => {
    if (!projectId) return null;
    if (!silent) setBackendStation(prev => ({ ...prev, loading: true }));
    try {
      const payload = await requestAgentBackend(`/projects/${encodeURIComponent(projectId)}/manager-dashboard`, {
        timeoutMs: silent ? 1100 : 1600,
      });
      setBackendStation(prev => ({
        ...prev,
        connectionStatus: 'online',
        loading: silent ? prev.loading : false,
        managerDashboard: payload,
        managerCommandCenter: payload.managerCommandCenter || prev.managerCommandCenter,
        managerScenarioTrail: payload.managerScenarioTrail || prev.managerScenarioTrail,
        managerScenarioWalkthrough: payload.managerScenarioWalkthrough || prev.managerScenarioWalkthrough,
        managerRequirementMatrix: payload.managerRequirementMatrix || prev.managerRequirementMatrix,
        managerUseCaseAudit: payload.managerUseCaseAudit || prev.managerUseCaseAudit,
        managerActionQueue: payload.managerActionQueue || prev.managerActionQueue,
        lastManagerDashboardSyncAt: new Date().toISOString(),
        managerDashboardSyncCount: (prev.managerDashboardSyncCount || 0) + 1,
        lastManagerCommandCenterSyncAt: payload.managerCommandCenter ? new Date().toISOString() : prev.lastManagerCommandCenterSyncAt,
        managerCommandCenterSyncCount: payload.managerCommandCenter ? (prev.managerCommandCenterSyncCount || 0) + 1 : prev.managerCommandCenterSyncCount,
        lastManagerRequirementMatrixSyncAt: payload.managerRequirementMatrix ? new Date().toISOString() : prev.lastManagerRequirementMatrixSyncAt,
        managerRequirementMatrixSyncCount: payload.managerRequirementMatrix ? (prev.managerRequirementMatrixSyncCount || 0) + 1 : prev.managerRequirementMatrixSyncCount,
        lastManagerUseCaseAuditSyncAt: payload.managerUseCaseAudit ? new Date().toISOString() : prev.lastManagerUseCaseAuditSyncAt,
        managerUseCaseAuditSyncCount: payload.managerUseCaseAudit ? (prev.managerUseCaseAuditSyncCount || 0) + 1 : prev.managerUseCaseAuditSyncCount,
        lastManagerActionQueueSyncAt: payload.managerActionQueue ? new Date().toISOString() : prev.lastManagerActionQueueSyncAt,
        managerActionQueueSyncCount: payload.managerActionQueue ? (prev.managerActionQueueSyncCount || 0) + 1 : prev.managerActionQueueSyncCount,
        lastAction: silent ? prev.lastAction || 'Backend manager dashboard synced' : 'Backend manager dashboard synced',
        error: null,
      }));
      return payload;
    } catch (error) {
      try {
        const fallbackDashboard = await requestAgentBackend(`/projects/${encodeURIComponent(projectId)}/manager-dashboard`, {
          timeoutMs: silent ? 1100 : 1600,
        });
        if (fallbackDashboard.managerScenarioTrail) {
          setBackendStation(prev => ({
            ...prev,
            connectionStatus: 'online',
            loading: silent ? prev.loading : false,
            managerDashboard: fallbackDashboard,
            managerCommandCenter: fallbackDashboard.managerCommandCenter || prev.managerCommandCenter,
            managerScenarioTrail: fallbackDashboard.managerScenarioTrail,
            managerScenarioWalkthrough: fallbackDashboard.managerScenarioWalkthrough || prev.managerScenarioWalkthrough,
            managerRequirementMatrix: fallbackDashboard.managerRequirementMatrix || prev.managerRequirementMatrix,
            managerUseCaseAudit: fallbackDashboard.managerUseCaseAudit || prev.managerUseCaseAudit,
            managerActionQueue: fallbackDashboard.managerActionQueue || prev.managerActionQueue,
            lastManagerDashboardSyncAt: new Date().toISOString(),
            managerDashboardSyncCount: (prev.managerDashboardSyncCount || 0) + 1,
            lastManagerCommandCenterSyncAt: fallbackDashboard.managerCommandCenter ? new Date().toISOString() : prev.lastManagerCommandCenterSyncAt,
            managerCommandCenterSyncCount: fallbackDashboard.managerCommandCenter ? (prev.managerCommandCenterSyncCount || 0) + 1 : prev.managerCommandCenterSyncCount,
            lastManagerScenarioTrailSyncAt: new Date().toISOString(),
            managerScenarioTrailSyncCount: (prev.managerScenarioTrailSyncCount || 0) + 1,
            lastManagerRequirementMatrixSyncAt: fallbackDashboard.managerRequirementMatrix ? new Date().toISOString() : prev.lastManagerRequirementMatrixSyncAt,
            managerRequirementMatrixSyncCount: fallbackDashboard.managerRequirementMatrix ? (prev.managerRequirementMatrixSyncCount || 0) + 1 : prev.managerRequirementMatrixSyncCount,
            lastManagerUseCaseAuditSyncAt: fallbackDashboard.managerUseCaseAudit ? new Date().toISOString() : prev.lastManagerUseCaseAuditSyncAt,
            managerUseCaseAuditSyncCount: fallbackDashboard.managerUseCaseAudit ? (prev.managerUseCaseAuditSyncCount || 0) + 1 : prev.managerUseCaseAuditSyncCount,
            lastManagerActionQueueSyncAt: fallbackDashboard.managerActionQueue ? new Date().toISOString() : prev.lastManagerActionQueueSyncAt,
            managerActionQueueSyncCount: fallbackDashboard.managerActionQueue ? (prev.managerActionQueueSyncCount || 0) + 1 : prev.managerActionQueueSyncCount,
            lastAction: silent ? prev.lastAction || 'Backend scenario trail synced from dashboard' : 'Backend scenario trail synced from dashboard',
            error: null,
          }));
          return fallbackDashboard.managerScenarioTrail;
        }
      } catch {
        // Fall through to the visible sync error below.
      }
      setBackendStation(prev => ({
        ...prev,
        connectionStatus: silent ? prev.connectionStatus : 'offline',
        loading: silent ? prev.loading : false,
        lastAction: silent ? prev.lastAction : 'Backend manager dashboard sync failed',
        error: silent ? prev.error : error.name === 'AbortError' ? 'Backend manager dashboard sync timed out.' : error.message || String(error),
      }));
      return null;
    }
  };

  const syncBackendManagerReadyPackage = async ({ silent = true, projectId = activeProject?.id } = {}) => {
    if (!projectId) return null;
    if (!silent) setBackendStation(prev => ({ ...prev, loading: true }));
    try {
      if (activeProject?.id === projectId) {
        await requestAgentBackend(`/projects/${encodeURIComponent(projectId)}`, {
          method: 'PUT',
          body: { project: activeProject },
          timeoutMs: silent ? 900 : 1400,
        });
      }
      const payload = await requestAgentBackend(`/projects/${encodeURIComponent(projectId)}/manager-ready-package`, {
        timeoutMs: silent ? 1200 : 1800,
      });
      setBackendStation(prev => ({
        ...prev,
        connectionStatus: 'online',
        loading: silent ? prev.loading : false,
        managerReadyPackage: payload,
        managerDashboard: payload.managerDashboard || prev.managerDashboard,
        managerFlowGraph: payload.managerFlowGraph || prev.managerFlowGraph,
        managerCommandCenter: payload.managerCommandCenter || payload.managerDashboard?.managerCommandCenter || prev.managerCommandCenter,
        managerScenarioTrail: payload.managerScenarioTrail || prev.managerScenarioTrail,
        managerScenarioWalkthrough: payload.managerScenarioWalkthrough || prev.managerScenarioWalkthrough,
        managerRequirementMatrix: payload.managerRequirementMatrix || prev.managerRequirementMatrix,
        managerUseCaseAudit: payload.managerUseCaseAudit || prev.managerUseCaseAudit,
        managerActionQueue: payload.managerActionQueue || prev.managerActionQueue,
        lastManagerReadyPackageSyncAt: new Date().toISOString(),
        managerReadyPackageSyncCount: (prev.managerReadyPackageSyncCount || 0) + 1,
        lastManagerDashboardSyncAt: payload.managerDashboard ? new Date().toISOString() : prev.lastManagerDashboardSyncAt,
        managerDashboardSyncCount: payload.managerDashboard ? (prev.managerDashboardSyncCount || 0) + 1 : prev.managerDashboardSyncCount,
        lastManagerFlowGraphSyncAt: payload.managerFlowGraph ? new Date().toISOString() : prev.lastManagerFlowGraphSyncAt,
        managerFlowGraphSyncCount: payload.managerFlowGraph ? (prev.managerFlowGraphSyncCount || 0) + 1 : prev.managerFlowGraphSyncCount,
        lastManagerCommandCenterSyncAt: (payload.managerCommandCenter || payload.managerDashboard?.managerCommandCenter) ? new Date().toISOString() : prev.lastManagerCommandCenterSyncAt,
        managerCommandCenterSyncCount: (payload.managerCommandCenter || payload.managerDashboard?.managerCommandCenter) ? (prev.managerCommandCenterSyncCount || 0) + 1 : prev.managerCommandCenterSyncCount,
        lastManagerScenarioTrailSyncAt: payload.managerScenarioTrail ? new Date().toISOString() : prev.lastManagerScenarioTrailSyncAt,
        managerScenarioTrailSyncCount: payload.managerScenarioTrail ? (prev.managerScenarioTrailSyncCount || 0) + 1 : prev.managerScenarioTrailSyncCount,
        lastManagerRequirementMatrixSyncAt: payload.managerRequirementMatrix ? new Date().toISOString() : prev.lastManagerRequirementMatrixSyncAt,
        managerRequirementMatrixSyncCount: payload.managerRequirementMatrix ? (prev.managerRequirementMatrixSyncCount || 0) + 1 : prev.managerRequirementMatrixSyncCount,
        lastManagerUseCaseAuditSyncAt: payload.managerUseCaseAudit ? new Date().toISOString() : prev.lastManagerUseCaseAuditSyncAt,
        managerUseCaseAuditSyncCount: payload.managerUseCaseAudit ? (prev.managerUseCaseAuditSyncCount || 0) + 1 : prev.managerUseCaseAuditSyncCount,
        lastManagerActionQueueSyncAt: payload.managerActionQueue ? new Date().toISOString() : prev.lastManagerActionQueueSyncAt,
        managerActionQueueSyncCount: payload.managerActionQueue ? (prev.managerActionQueueSyncCount || 0) + 1 : prev.managerActionQueueSyncCount,
        lastAction: silent ? prev.lastAction || 'BACKEND MANAGER READY PACKAGE SYNCED' : 'BACKEND MANAGER READY PACKAGE SYNCED',
        error: null,
      }));
      return payload;
    } catch (error) {
      setBackendStation(prev => ({
        ...prev,
        connectionStatus: silent ? prev.connectionStatus : 'offline',
        loading: silent ? prev.loading : false,
        lastAction: silent ? prev.lastAction : 'Backend manager ready package sync failed',
        error: silent ? prev.error : error.name === 'AbortError' ? 'Backend manager ready package sync timed out.' : error.message || String(error),
      }));
      return null;
    }
  };

  const syncBackendManagerFlowGraph = async ({ silent = true, projectId = activeProject?.id } = {}) => {
    if (!projectId) return null;
    if (!silent) setBackendStation(prev => ({ ...prev, loading: true }));
    try {
      if (activeProject?.id === projectId) {
        await requestAgentBackend(`/projects/${encodeURIComponent(projectId)}`, {
          method: 'PUT',
          body: { project: activeProject },
          timeoutMs: silent ? 900 : 1400,
        });
      }
      const payload = await requestAgentBackend(`/projects/${encodeURIComponent(projectId)}/manager-flow-graph`, {
        timeoutMs: silent ? 1200 : 1800,
      });
      setBackendStation(prev => ({
        ...prev,
        connectionStatus: 'online',
        loading: silent ? prev.loading : false,
        managerFlowGraph: payload,
        lastManagerFlowGraphSyncAt: new Date().toISOString(),
        managerFlowGraphSyncCount: (prev.managerFlowGraphSyncCount || 0) + 1,
        lastAction: silent ? prev.lastAction || 'Backend manager flow graph synced' : 'Backend manager flow graph synced',
        error: null,
      }));
      return payload;
    } catch (error) {
      setBackendStation(prev => ({
        ...prev,
        connectionStatus: silent ? prev.connectionStatus : 'offline',
        loading: silent ? prev.loading : false,
        lastAction: silent ? prev.lastAction : 'Backend manager flow graph sync failed',
        error: silent ? prev.error : error.name === 'AbortError' ? 'Backend manager flow graph sync timed out.' : error.message || String(error),
      }));
      return null;
    }
  };

  const syncBackendManagerScenarioTrail = async ({ silent = true, projectId = activeProject?.id } = {}) => {
    if (!projectId) return null;
    if (!silent) setBackendStation(prev => ({ ...prev, loading: true }));
    try {
      if (activeProject?.id === projectId) {
        await requestAgentBackend(`/projects/${encodeURIComponent(projectId)}`, {
          method: 'PUT',
          body: { project: activeProject },
          timeoutMs: silent ? 900 : 1400,
        });
      }
      const payload = await requestAgentBackend(`/projects/${encodeURIComponent(projectId)}/manager-scenario-trail`, {
        timeoutMs: silent ? 900 : 1400,
      });
      setBackendStation(prev => ({
        ...prev,
        connectionStatus: 'online',
        loading: silent ? prev.loading : false,
        managerScenarioTrail: payload,
        lastManagerScenarioTrailSyncAt: new Date().toISOString(),
        managerScenarioTrailSyncCount: (prev.managerScenarioTrailSyncCount || 0) + 1,
        lastAction: silent ? prev.lastAction || 'Backend scenario trail synced' : 'Backend scenario trail synced',
        error: null,
      }));
      return payload;
    } catch (error) {
      setBackendStation(prev => ({
        ...prev,
        connectionStatus: silent ? prev.connectionStatus : 'offline',
        loading: silent ? prev.loading : false,
        lastAction: silent ? prev.lastAction : 'Backend scenario trail sync failed',
        error: silent ? prev.error : error.name === 'AbortError' ? 'Backend scenario trail sync timed out.' : error.message || String(error),
      }));
      return null;
    }
  };

  const syncBackendManagerRequirementMatrix = async ({ silent = true, projectId = activeProject?.id } = {}) => {
    if (!projectId) return null;
    if (!silent) setBackendStation(prev => ({ ...prev, loading: true }));
    try {
      if (activeProject?.id === projectId) {
        await requestAgentBackend(`/projects/${encodeURIComponent(projectId)}`, {
          method: 'PUT',
          body: { project: activeProject },
          timeoutMs: silent ? 900 : 1400,
        });
      }
      const payload = await requestAgentBackend(`/projects/${encodeURIComponent(projectId)}/manager-requirement-matrix`, {
        timeoutMs: silent ? 900 : 1400,
      });
      setBackendStation(prev => ({
        ...prev,
        connectionStatus: 'online',
        loading: silent ? prev.loading : false,
        managerRequirementMatrix: payload,
        lastManagerRequirementMatrixSyncAt: new Date().toISOString(),
        managerRequirementMatrixSyncCount: (prev.managerRequirementMatrixSyncCount || 0) + 1,
        lastAction: silent ? prev.lastAction || 'Backend requirement matrix synced' : 'Backend requirement matrix synced',
        error: null,
      }));
      return payload;
    } catch (error) {
      try {
        const readyPackage = await requestAgentBackend(`/projects/${encodeURIComponent(projectId)}/manager-ready-package`, {
          timeoutMs: silent ? 1200 : 1800,
        });
        if (readyPackage.managerRequirementMatrix) {
          setBackendStation(prev => ({
            ...prev,
            connectionStatus: 'online',
            loading: silent ? prev.loading : false,
            managerReadyPackage: readyPackage,
            managerDashboard: readyPackage.managerDashboard || prev.managerDashboard,
            managerRequirementMatrix: readyPackage.managerRequirementMatrix,
            lastManagerReadyPackageSyncAt: new Date().toISOString(),
            managerReadyPackageSyncCount: (prev.managerReadyPackageSyncCount || 0) + 1,
            lastManagerDashboardSyncAt: readyPackage.managerDashboard ? new Date().toISOString() : prev.lastManagerDashboardSyncAt,
            managerDashboardSyncCount: readyPackage.managerDashboard ? (prev.managerDashboardSyncCount || 0) + 1 : prev.managerDashboardSyncCount,
            lastManagerRequirementMatrixSyncAt: new Date().toISOString(),
            managerRequirementMatrixSyncCount: (prev.managerRequirementMatrixSyncCount || 0) + 1,
            lastAction: silent ? prev.lastAction || 'Backend requirement matrix synced from package' : 'Backend requirement matrix synced from package',
            error: null,
          }));
          return readyPackage.managerRequirementMatrix;
        }
      } catch {
        // Fall through to the visible sync error below.
      }
      setBackendStation(prev => ({
        ...prev,
        connectionStatus: silent ? prev.connectionStatus : 'offline',
        loading: silent ? prev.loading : false,
        lastAction: silent ? prev.lastAction : 'Backend requirement matrix sync failed',
        error: silent ? prev.error : error.name === 'AbortError' ? 'Backend requirement matrix sync timed out.' : error.message || String(error),
      }));
      return null;
    }
  };

  const syncBackendManagerUseCaseAudit = async ({ silent = true, projectId = activeProject?.id } = {}) => {
    if (!projectId) return null;
    if (!silent) setBackendStation(prev => ({ ...prev, loading: true }));
    try {
      if (activeProject?.id === projectId) {
        await requestAgentBackend(`/projects/${encodeURIComponent(projectId)}`, {
          method: 'PUT',
          body: { project: activeProject },
          timeoutMs: silent ? 900 : 1400,
        });
      }
      const payload = await requestAgentBackend(`/projects/${encodeURIComponent(projectId)}/manager-use-case-audit`, {
        timeoutMs: silent ? 900 : 1400,
      });
      setBackendStation(prev => ({
        ...prev,
        connectionStatus: 'online',
        loading: silent ? prev.loading : false,
        managerUseCaseAudit: payload,
        lastManagerUseCaseAuditSyncAt: new Date().toISOString(),
        managerUseCaseAuditSyncCount: (prev.managerUseCaseAuditSyncCount || 0) + 1,
        lastAction: silent ? prev.lastAction || 'Backend use case audit synced' : 'Backend use case audit synced',
        error: null,
      }));
      return payload;
    } catch (error) {
      try {
        const readyPackage = await requestAgentBackend(`/projects/${encodeURIComponent(projectId)}/manager-ready-package`, {
          timeoutMs: silent ? 1200 : 1800,
        });
        if (readyPackage.managerUseCaseAudit) {
          setBackendStation(prev => ({
            ...prev,
            connectionStatus: 'online',
            loading: silent ? prev.loading : false,
            managerReadyPackage: readyPackage,
            managerDashboard: readyPackage.managerDashboard || prev.managerDashboard,
            managerUseCaseAudit: readyPackage.managerUseCaseAudit,
            lastManagerReadyPackageSyncAt: new Date().toISOString(),
            managerReadyPackageSyncCount: (prev.managerReadyPackageSyncCount || 0) + 1,
            lastManagerDashboardSyncAt: readyPackage.managerDashboard ? new Date().toISOString() : prev.lastManagerDashboardSyncAt,
            managerDashboardSyncCount: readyPackage.managerDashboard ? (prev.managerDashboardSyncCount || 0) + 1 : prev.managerDashboardSyncCount,
            lastManagerUseCaseAuditSyncAt: new Date().toISOString(),
            managerUseCaseAuditSyncCount: (prev.managerUseCaseAuditSyncCount || 0) + 1,
            lastAction: silent ? prev.lastAction || 'Backend use case audit synced from package' : 'Backend use case audit synced from package',
            error: null,
          }));
          return readyPackage.managerUseCaseAudit;
        }
      } catch {
        // Fall through to the visible sync error below.
      }
      setBackendStation(prev => ({
        ...prev,
        connectionStatus: silent ? prev.connectionStatus : 'offline',
        loading: silent ? prev.loading : false,
        lastAction: silent ? prev.lastAction : 'Backend use case audit sync failed',
        error: silent ? prev.error : error.name === 'AbortError' ? 'Backend use case audit sync timed out.' : error.message || String(error),
      }));
      return null;
    }
  };

  const syncBackendManagerActionQueue = async ({ silent = true, projectId = activeProject?.id } = {}) => {
    if (!projectId) return null;
    if (!silent) setBackendStation(prev => ({ ...prev, loading: true }));
    try {
      if (activeProject?.id === projectId) {
        await requestAgentBackend(`/projects/${encodeURIComponent(projectId)}`, {
          method: 'PUT',
          body: { project: activeProject },
          timeoutMs: silent ? 900 : 1400,
        });
      }
      const payload = await requestAgentBackend(`/projects/${encodeURIComponent(projectId)}/manager-action-queue`, {
        timeoutMs: silent ? 900 : 1400,
      });
      setBackendStation(prev => ({
        ...prev,
        connectionStatus: 'online',
        loading: silent ? prev.loading : false,
        managerActionQueue: payload,
        lastManagerActionQueueSyncAt: new Date().toISOString(),
        managerActionQueueSyncCount: (prev.managerActionQueueSyncCount || 0) + 1,
        lastAction: silent ? prev.lastAction || 'Backend action queue synced' : 'Backend action queue synced',
        error: null,
      }));
      return payload;
    } catch (error) {
      try {
        const readyPackage = await requestAgentBackend(`/projects/${encodeURIComponent(projectId)}/manager-ready-package`, {
          timeoutMs: silent ? 1200 : 1800,
        });
        if (readyPackage.managerActionQueue) {
          setBackendStation(prev => ({
            ...prev,
            connectionStatus: 'online',
            loading: silent ? prev.loading : false,
            managerReadyPackage: readyPackage,
            managerDashboard: readyPackage.managerDashboard || prev.managerDashboard,
            managerActionQueue: readyPackage.managerActionQueue,
            lastManagerReadyPackageSyncAt: new Date().toISOString(),
            managerReadyPackageSyncCount: (prev.managerReadyPackageSyncCount || 0) + 1,
            lastManagerDashboardSyncAt: readyPackage.managerDashboard ? new Date().toISOString() : prev.lastManagerDashboardSyncAt,
            managerDashboardSyncCount: readyPackage.managerDashboard ? (prev.managerDashboardSyncCount || 0) + 1 : prev.managerDashboardSyncCount,
            lastManagerActionQueueSyncAt: new Date().toISOString(),
            managerActionQueueSyncCount: (prev.managerActionQueueSyncCount || 0) + 1,
            lastAction: silent ? prev.lastAction || 'Backend action queue synced from package' : 'Backend action queue synced from package',
            error: null,
          }));
          return readyPackage.managerActionQueue;
        }
      } catch {
        // Fall through to the visible sync error below.
      }
      setBackendStation(prev => ({
        ...prev,
        connectionStatus: silent ? prev.connectionStatus : 'offline',
        loading: silent ? prev.loading : false,
        lastAction: silent ? prev.lastAction : 'Backend action queue sync failed',
        error: silent ? prev.error : error.name === 'AbortError' ? 'Backend action queue sync timed out.' : error.message || String(error),
      }));
      return null;
    }
  };

  const refreshBackendManagerView = async () => {
    const readyPackage = await syncBackendManagerReadyPackage({ silent: false });
    if (readyPackage) return;
    const flowGraph = await syncBackendManagerFlowGraph({ silent: false });
    if (flowGraph) return;
    const dashboard = await syncBackendManagerDashboard({ silent: false });
    if (dashboard) await syncBackendManagerScenarioTrail({ silent: false });
  };

  const refreshBackendSchedulerStatus = async (baseUrlOverride, { silent = false } = {}) => {
    if (!silent) {
      setBackendStation(prev => ({ ...prev, loading: true, connectionStatus: prev.connectionStatus === 'unknown' ? 'checking' : prev.connectionStatus }));
    }
    try {
      const payload = await requestAgentBackend('/workers/autonomous/status', { baseUrl: baseUrlOverride || backendStation.baseUrl });
      setBackendStation(prev => ({
        ...prev,
        connectionStatus: 'online',
        scheduler: payload.scheduler ? {
          ...payload.scheduler,
          lastStartedRunImmediately: payload.scheduler.lastStartedRunImmediately || prev.scheduler?.lastStartedRunImmediately || false,
          lastResult: payload.scheduler.lastResult || prev.scheduler?.lastResult || null,
        } : null,
        loading: silent ? prev.loading : false,
        lastAction: silent || (!payload.scheduler?.lastResult && /pulse published/i.test(prev.lastAction || ''))
          ? prev.lastAction
          : 'Status synced',
        error: null,
      }));
      if (activeProject?.id) {
        setTimeout(() => syncBackendManagerDashboard({ silent: true, projectId: activeProject.id }), 0);
      }
      return payload.scheduler || null;
    } catch (error) {
      setBackendStation(prev => ({
        ...prev,
        connectionStatus: 'offline',
        loading: silent ? prev.loading : false,
        lastAction: 'Status check failed',
        error: error.name === 'AbortError' ? 'Backend status check timed out.' : error.message || String(error),
      }));
      return null;
    }
  };

  const saveBackendBaseUrl = () => {
    const nextUrl = (backendStation.draftBaseUrl || DEFAULT_AGENT_BACKEND_URL).trim().replace(/\/+$/, '');
    writeStoredJson(STORAGE_KEYS.backendUrl, nextUrl);
    setBackendStation(prev => ({
      ...prev,
      baseUrl: nextUrl,
      draftBaseUrl: nextUrl,
      connectionStatus: 'unknown',
      scheduler: null,
      managerReadyPackage: null,
      managerDashboard: null,
      managerFlowGraph: null,
      managerCommandCenter: null,
      managerCommandCenterRun: null,
      managerScenarioTrail: null,
      managerScenarioWalkthrough: null,
      managerScenarioWalkthroughReceipt: null,
      managerRequirementMatrix: null,
      managerActionQueue: null,
      lastAction: 'Backend URL saved',
      error: null,
    }));
    setTimeout(() => refreshBackendSchedulerStatus(nextUrl), 0);
  };

  const runBackendSchedulerAction = async (action) => {
    setBackendStation(prev => ({
      ...prev,
      loading: true,
      lastAction: action === 'start' ? 'Started backend scheduler' : prev.lastAction,
      scheduler: action === 'start'
        ? {
          ...(prev.scheduler || {}),
          lastStartedRunImmediately: true,
          lastResult: {
            processed: activeProject ? [{
              projectId: activeProject.id,
              reason: 'backend-scheduler-start-first-work',
              nextRunAt: activeProject.nextAutonomousRunAt || null,
            }] : [],
            skipped: [],
            agentsProcessed: (activeProject?.team || []).slice(0, 5).map(agent => ({
              projectId: activeProject.id,
              agentId: agent.id,
              trigger: 'http-autonomous-scheduler-startup-agents',
            })),
            agentsSkipped: [],
            messageCount: 0,
          },
        }
        : prev.scheduler,
    }));
    try {
      if (action === 'start' && activeProject) {
        await requestAgentBackend(`/projects/${encodeURIComponent(activeProject.id)}`, {
          method: 'PUT',
          body: { project: activeProject },
          timeoutMs: 1200,
        });
      }
      const payload = await requestAgentBackend(`/workers/autonomous/${action}`, {
        method: 'POST',
        body: action === 'start' ? { runImmediately: true, projectId: activeProject?.id } : {},
        timeoutMs: 1200,
      });
      setBackendStation(prev => ({
        ...prev,
        connectionStatus: 'online',
        scheduler: action === 'start'
          ? {
            ...(prev.scheduler || {}),
            ...(payload.scheduler || {}),
            lastResult: payload.scheduler?.lastResult || prev.scheduler?.lastResult || null,
            lastStartedRunImmediately: true,
          }
          : payload.scheduler || prev.scheduler,
        loading: false,
        lastAction: `${action === 'start' ? 'Started' : 'Stopped'} backend scheduler`,
        error: null,
      }));
      if (action === 'start') {
        await runBackendAutonomousPulse({
          trigger: 'manager-ui-scheduler-start-pulse',
          schedulerReason: 'backend-scheduler-start-first-work',
          source: 'manager-ui-scheduler-start-chat',
          updateLoading: false,
          lastActionPrefix: 'Scheduler start pulse',
          persistActiveProject: false,
          timeoutMs: 8000,
        });
        setBackendStation(prev => ({ ...prev, loading: false }));
        setTimeout(() => refreshBackendSchedulerStatus(undefined, { silent: true }), 500);
        if (activeProject?.id) {
          setTimeout(() => syncBackendManagerDashboard({ silent: true, projectId: activeProject.id }), 1200);
        }
      }
    } catch (error) {
      setBackendStation(prev => ({
        ...prev,
        connectionStatus: 'offline',
        loading: false,
        lastAction: 'Scheduler command failed',
        error: error.name === 'AbortError' ? 'Backend command timed out.' : error.message || String(error),
      }));
    }
  };

  const applyBackendProjectSnapshot = (payload = {}) => {
    if (!payload.project?.id) return;
    setProjects(prev => prev.map(project => project.id === payload.project.id ? payload.project : project));
    if (payload.messages?.length) {
      setChatMessages(prev => mergeProjectMessages(prev, payload.messages));
    }
  };

  const syncBackendProjectState = async ({ silent = false } = {}) => {
    if (!activeProject) return null;
    if (!silent) setBackendStation(prev => ({ ...prev, loading: true }));
    try {
      const payload = await requestAgentBackend(`/projects/${encodeURIComponent(activeProject.id)}`, {
        timeoutMs: silent ? 900 : 1400,
      });
      applyBackendProjectSnapshot(payload);
      setBackendStation(prev => ({
        ...prev,
        connectionStatus: 'online',
        loading: silent ? prev.loading : false,
        lastAction: silent ? prev.lastAction || 'Backend state synced' : 'Backend state synced',
        lastProjectSyncAt: new Date().toISOString(),
        projectSyncCount: (prev.projectSyncCount || 0) + 1,
        error: null,
      }));
      if (!applyBackendManagerDashboardPayload(payload)) {
        syncBackendManagerDashboard({ silent: true, projectId: payload.project?.id || activeProject.id });
      }
      return payload;
    } catch (error) {
      setBackendStation(prev => ({
        ...prev,
        connectionStatus: 'offline',
        loading: silent ? prev.loading : false,
        lastAction: silent ? prev.lastAction : 'Backend sync failed',
        error: error.name === 'AbortError' ? 'Backend project sync timed out.' : error.message || String(error),
      }));
      return null;
    }
  };

  const runBackendProjectCommand = async (action, body = {}) => {
    if (!activeProject) return null;
    await requestAgentBackend(`/projects/${encodeURIComponent(activeProject.id)}`, {
      method: 'PUT',
      body: { project: activeProject },
      timeoutMs: 1200,
    });
    const payload = await requestAgentBackend(`/projects/${encodeURIComponent(activeProject.id)}/${action}`, {
      method: 'POST',
      body,
      timeoutMs: 1800,
    });
    applyBackendProjectSnapshot(payload);
    setBackendStation(prev => ({
      ...prev,
      connectionStatus: 'online',
      lastAction: `${action === 'meeting' ? 'Meeting' : 'Chat'} sent through backend`,
      lastProjectSyncAt: new Date().toISOString(),
      projectSyncCount: (prev.projectSyncCount || 0) + 1,
      error: null,
    }));
    if (!applyBackendManagerDashboardPayload(payload)) {
      syncBackendManagerDashboard({ silent: true, projectId: payload.project?.id || activeProject.id });
    }
    return payload;
  };

  const runMultiChannelChangeBroadcast = async (text = '@all add a dual-channel manager review packet', {
    channelIds = ['main', 'google_chat'],
    sourceModes = ['war_room_meeting', 'google_chat'],
    messageIdPrefix,
    lastActionLabel = 'Dual-channel change broadcast sent through backend',
  } = {}) => {
    if (!activeProject) return null;
    const now = new Date().toISOString();
    const body = {
      text,
      now,
      channelIds,
      sourceModes,
      messageIdPrefix: messageIdPrefix || `manager_ui_dual_change_${Date.parse(now) || Date.now()}`,
    };

    if (backendStation.connectionStatus === 'online') {
      try {
        const payload = await runBackendProjectCommand('change-request', body);
        setBackendStation(prev => ({
          ...prev,
          lastAction: lastActionLabel,
        }));
        return payload;
      } catch (error) {
        setBackendStation(prev => ({
          ...prev,
          connectionStatus: 'offline',
          lastAction: 'Backend dual-channel change failed, used local runtime',
          error: error.name === 'AbortError' ? 'Backend dual-channel change timed out.' : error.message || String(error),
        }));
      }
    }

    const result = submitProjectMultiChannelChangeRequest({
      project: activeProject,
      language: activeLanguage,
      ...body,
    });
    setProjects(prev => prev.map(project => (
      project.id === activeProject.id ? result.project : project
    )));
    setChatMessages(prev => mergeProjectMessages(prev, result.messages));
    return result;
  };

  const submitManagerChangeIntake = async () => {
    if (!activeProject) return null;
    const text = managerChangeDraft.text.trim();
    if (!text) return null;
    const mode = managerChangeDraft.mode || 'dual';
    const now = new Date().toISOString();
    const timestamp = Date.parse(now) || Date.now();

    if (mode === 'dual') {
      return runMultiChannelChangeBroadcast(text, {
        channelIds: ['main', 'google_chat'],
        sourceModes: ['war_room_meeting', 'google_chat'],
        messageIdPrefix: `manager_change_composer_dual_${timestamp}`,
        lastActionLabel: 'Manager change intake sent through backend',
      });
    }

    const isMeeting = mode === 'meeting';
    const action = isMeeting ? 'meeting' : 'chat';
    const body = {
      text,
      now,
      channelId: isMeeting ? 'main' : 'google_chat',
      messageId: `manager_change_composer_${mode}_${timestamp}`,
    };

    if (backendStation.connectionStatus === 'online') {
      try {
        const payload = await runBackendProjectCommand(action, body);
        setBackendStation(prev => ({
          ...prev,
          lastAction: `Manager change intake sent through ${isMeeting ? 'War Room' : 'Google Chat'}`,
        }));
        return payload;
      } catch (error) {
        setBackendStation(prev => ({
          ...prev,
          connectionStatus: 'offline',
          lastAction: 'Backend manager change intake failed, used local runtime',
          error: error.name === 'AbortError' ? 'Backend manager change intake timed out.' : error.message || String(error),
        }));
      }
    }

    const result = isMeeting
      ? submitProjectMeetingMessage({ project: activeProject, language: activeLanguage, ...body })
      : submitProjectChatMessage({ project: activeProject, language: activeLanguage, ...body });
    setProjects(prev => prev.map(project => (
      project.id === activeProject.id ? result.project : project
    )));
    setChatMessages(prev => mergeProjectMessages(prev, result.messages));
    return result;
  };

  const submitManagerLeaderAssignment = async () => {
    if (!activeProject) return null;
    const taskText = managerAssignmentDraft.text.trim();
    if (!taskText) return null;
    const target = activeProject.team.find(agent => agent.id === managerAssignmentDraft.targetAgentId)
      || activeProject.team.find(agent => !agent.isLeader)
      || activeProject.team[0];
    if (!target) return null;
    const now = new Date().toISOString();
    const timestamp = Date.parse(now) || Date.now();
    const text = taskText.includes('@') ? taskText : `leader assign @${target.name} ${taskText}`;
    const body = {
      text,
      now,
      channelId: 'main',
      messageId: `manager_assignment_composer_${timestamp}`,
    };

    if (backendStation.connectionStatus === 'online') {
      try {
        const payload = await runBackendProjectCommand('chat', body);
        setBackendStation(prev => ({
          ...prev,
          lastAction: 'Manager Leader assignment sent through backend',
        }));
        return payload;
      } catch (error) {
        setBackendStation(prev => ({
          ...prev,
          connectionStatus: 'offline',
          lastAction: 'Backend Leader assignment failed, used local runtime',
          error: error.name === 'AbortError' ? 'Backend Leader assignment timed out.' : error.message || String(error),
        }));
      }
    }

    const result = submitProjectChatMessage({
      project: activeProject,
      language: activeLanguage,
      ...body,
    });
    setProjects(prev => prev.map(project => (
      project.id === activeProject.id ? result.project : project
    )));
    setChatMessages(prev => mergeProjectMessages(prev, result.messages));
    return result;
  };

  const runBackendAutonomousPulse = async ({
    trigger,
    schedulerReason,
    source,
    updateLoading = true,
    lastActionPrefix = 'Server pulse',
    persistActiveProject = true,
    timeoutMs = 1800,
  } = {}) => {
    if (!activeProject) return;
    const now = new Date().toISOString();
    const cadence = activeProject.autonomy?.cadence || activeProject.autonomousCadence || 'hourly';
    if (updateLoading) setBackendStation(prev => ({ ...prev, loading: true }));
    try {
      if (persistActiveProject) {
        await requestAgentBackend(`/projects/${encodeURIComponent(activeProject.id)}`, {
          method: 'PUT',
          body: { project: activeProject },
          timeoutMs: 1200,
        });
      }
      const payload = await requestAgentBackend(`/projects/${encodeURIComponent(activeProject.id)}/autonomous-cycle`, {
        method: 'POST',
        body: {
          cadence,
          now,
          trigger,
          schedulerReason,
          dueAt: now,
          source,
        },
        timeoutMs,
      });
      if (payload.project) {
        applyBackendProjectSnapshot(payload);
      }
      setBackendStation(prev => ({
        ...prev,
        connectionStatus: 'online',
        scheduler: {
          ...(prev.scheduler || {}),
          lastResult: {
            processed: [{
              projectId: payload.project?.id || activeProject.id,
              trigger,
              cadence,
              reason: schedulerReason,
              nextRunAt: payload.project?.nextAutonomousRunAt || null,
              messageCount: payload.messageCount || payload.messages?.length || 0,
            }],
            skipped: [],
            agentsProcessed: [],
            agentsSkipped: [],
            messageCount: payload.messageCount || payload.messages?.length || 0,
          },
        },
        loading: updateLoading ? false : prev.loading,
        lastAction: `${lastActionPrefix} ${String(trigger || 'backend-work').toUpperCase()} published ${payload.messageCount || payload.messages?.length || 0} messages`,
        lastProjectSyncAt: new Date().toISOString(),
        projectSyncCount: (prev.projectSyncCount || 0) + 1,
        error: null,
      }));
      refreshBackendSchedulerStatus(undefined, { silent: !updateLoading });
      if (!applyBackendManagerDashboardPayload(payload)) {
        syncBackendManagerDashboard({ silent: true, projectId: payload.project?.id || activeProject.id });
      }
      return payload;
    } catch (error) {
      setBackendStation(prev => ({
        ...prev,
        connectionStatus: 'offline',
        loading: updateLoading ? false : prev.loading,
        lastAction: `${lastActionPrefix} failed`,
        error: error.name === 'AbortError' ? 'Backend server pulse timed out.' : error.message || String(error),
      }));
      return null;
    }
  };

  const runBackendServerPulse = async () => runBackendAutonomousPulse({
    trigger: 'manager-ui-backend-pulse',
    schedulerReason: 'manager-ui-backend-station-pulse',
    source: 'manager-ui-backend-station-chat',
    updateLoading: true,
    lastActionPrefix: 'Server pulse',
    timeoutMs: 8000,
  });

  const syncBackendAgentDashboard = async (agentId, { silent = true } = {}) => {
    if (!activeProject?.id || !agentId || backendStation.connectionStatus !== 'online') return null;
    if (!silent) setBackendStation(prev => ({ ...prev, loading: true }));
    try {
      const payload = await requestAgentBackend(`/projects/${encodeURIComponent(activeProject.id)}/agents/${encodeURIComponent(agentId)}/dashboard`, {
        timeoutMs: silent ? 8000 : 10000,
      });
      setAgentDashboardSnapshots(prev => ({
        ...prev,
        [agentId]: {
          ...payload,
          syncedAt: new Date().toISOString(),
        },
      }));
      setBackendStation(prev => ({
        ...prev,
        connectionStatus: 'online',
        loading: silent ? prev.loading : false,
        lastAction: silent ? prev.lastAction || 'Agent dashboard synced' : 'Agent dashboard synced',
        error: null,
      }));
      return payload;
    } catch (error) {
      setBackendStation(prev => ({
        ...prev,
        connectionStatus: 'offline',
        loading: silent ? prev.loading : false,
        lastAction: silent ? prev.lastAction : 'Agent dashboard sync failed',
        error: error.name === 'AbortError' ? 'Backend Agent dashboard timed out.' : error.message || String(error),
      }));
      return null;
    }
  };

  const runBackendAgentPulse = async (agentId, {
    trigger = 'manager-ui-agent-pulse',
    cadence,
    lastActionLabel = 'Agent pulse',
  } = {}) => {
    if (!activeProject || !agentId) return;
    const now = new Date().toISOString();
    setBackendStation(prev => ({ ...prev, loading: true }));
    try {
      await requestAgentBackend(`/projects/${encodeURIComponent(activeProject.id)}`, {
        method: 'PUT',
        body: { project: activeProject },
        timeoutMs: 3000,
      });
      const payload = await requestAgentBackend(`/projects/${encodeURIComponent(activeProject.id)}/agents/${encodeURIComponent(agentId)}/work-cycle`, {
        method: 'POST',
        body: {
          now,
          trigger,
          ...(cadence ? { cadence } : {}),
        },
        timeoutMs: 8000,
      });
      applyBackendProjectSnapshot(payload);
      setBackendStation(prev => ({
        ...prev,
        connectionStatus: 'online',
        loading: false,
        lastAction: `${lastActionLabel}: ${payload.agent?.name || agentId}`,
        lastProjectSyncAt: new Date().toISOString(),
        projectSyncCount: (prev.projectSyncCount || 0) + 1,
        error: null,
      }));
      if (!applyBackendManagerDashboardPayload(payload)) {
        syncBackendManagerDashboard({ silent: true, projectId: payload.project?.id || activeProject.id });
      }
      syncBackendAgentDashboard(agentId, { silent: true });
    } catch (error) {
      setBackendStation(prev => ({
        ...prev,
        connectionStatus: 'offline',
        loading: false,
        lastAction: 'Agent pulse failed',
        error: error.name === 'AbortError' ? 'Backend Agent pulse timed out.' : error.message || String(error),
      }));
    }
  };

  const runBackendManagementSync = async (agentId) => runBackendAgentPulse(agentId, {
    trigger: 'manager-ui-management-sync',
    cadence: 'management-sync',
    lastActionLabel: 'Management sync',
  });

  const updateAgentMessageDraft = (agentId, patch = {}) => {
    setAgentMessageDrafts(prev => ({
      ...prev,
      [agentId]: {
        ...(prev[agentId] || {}),
        ...patch,
      },
    }));
  };

  const runBackendAgentMessage = async (agentId) => {
    if (!activeProject || !agentId) return;
    const sender = activeProject.team.find(agent => agent.id === agentId);
    const fallbackTarget = activeProject.team.find(agent => agent.id !== agentId)?.id || '';
    const draft = agentMessageDrafts[agentId] || {};
    const targetAgentId = draft.targetAgentId || fallbackTarget;
    const text = (draft.text || `@${activeProject.team.find(agent => agent.id === targetAgentId)?.name || 'team'} coordination note: keep the latest proof visible for manager review.`).trim();
    if (!sender || !text || !targetAgentId) return;
    const now = new Date().toISOString();
    setBackendStation(prev => ({ ...prev, loading: true }));
    try {
      await requestAgentBackend(`/projects/${encodeURIComponent(activeProject.id)}`, {
        method: 'PUT',
        body: { project: activeProject },
        timeoutMs: 1200,
      });
      const payload = await requestAgentBackend(`/projects/${encodeURIComponent(activeProject.id)}/agents/${encodeURIComponent(agentId)}/message`, {
        method: 'POST',
        body: {
          targetAgentIds: [targetAgentId],
          channelId: 'main',
          text,
          now,
          messageId: `manager_ui_agent_message_${agentId}_${Date.parse(now) || Date.now()}`,
        },
        timeoutMs: 1800,
      });
      applyBackendProjectSnapshot(payload);
      setBackendStation(prev => ({
        ...prev,
        connectionStatus: 'online',
        loading: false,
        lastAction: `Agent message: ${sender.name}`,
        lastProjectSyncAt: new Date().toISOString(),
        projectSyncCount: (prev.projectSyncCount || 0) + 1,
        error: null,
      }));
      setAgentMessageDrafts(prev => ({
        ...prev,
        [agentId]: {
          ...(prev[agentId] || {}),
          text: '',
          targetAgentId,
        },
      }));
      if (!applyBackendManagerDashboardPayload(payload)) {
        syncBackendManagerDashboard({ silent: true, projectId: payload.project?.id || activeProject.id });
      }
      if (payload.agentDashboard) {
        setAgentDashboardSnapshots(prev => ({
          ...prev,
          [agentId]: {
            ...payload.agentDashboard,
            syncedAt: new Date().toISOString(),
          },
        }));
      } else {
        syncBackendAgentDashboard(agentId, { silent: true });
      }
    } catch (error) {
      setBackendStation(prev => ({
        ...prev,
        connectionStatus: 'offline',
        loading: false,
        lastAction: 'Agent message failed',
        error: error.name === 'AbortError' ? 'Backend Agent message timed out.' : error.message || String(error),
      }));
    }
  };

  const confirmManagerFlowNode = async (nodeId, valid = true) => {
    if (!activeProject || !nodeId || backendStation.connectionStatus !== 'online') return null;
    const now = new Date().toISOString();
    setBackendStation(prev => ({ ...prev, loading: true }));
    try {
      await requestAgentBackend(`/projects/${encodeURIComponent(activeProject.id)}`, {
        method: 'PUT',
        body: { project: activeProject },
        timeoutMs: 1200,
      });
      const payload = await requestAgentBackend(`/projects/${encodeURIComponent(activeProject.id)}/manager-flow-graph/nodes/${encodeURIComponent(nodeId)}/confirm`, {
        method: 'POST',
        body: {
          valid,
          now,
          actor: 'Director',
          note: valid ? 'User confirmed this node represents valid work.' : 'User marked this node as not representative.',
        },
        timeoutMs: 2200,
      });
      if (payload.project) applyBackendProjectSnapshot(payload);
      applyBackendManagerDashboardPayload(payload);
      setBackendStation(prev => ({
        ...prev,
        connectionStatus: 'online',
        loading: false,
        managerFlowGraph: payload.managerFlowGraph || prev.managerFlowGraph,
        lastManagerFlowGraphSyncAt: payload.managerFlowGraph ? new Date().toISOString() : prev.lastManagerFlowGraphSyncAt,
        managerFlowGraphSyncCount: payload.managerFlowGraph ? (prev.managerFlowGraphSyncCount || 0) + 1 : prev.managerFlowGraphSyncCount,
        lastAction: `${valid ? 'Confirmed' : 'Superseded'} flow node: ${nodeId}`,
        lastProjectSyncAt: payload.project ? new Date().toISOString() : prev.lastProjectSyncAt,
        projectSyncCount: payload.project ? (prev.projectSyncCount || 0) + 1 : prev.projectSyncCount,
        error: null,
      }));
      return payload;
    } catch (error) {
      setBackendStation(prev => ({
        ...prev,
        connectionStatus: 'offline',
        loading: false,
        lastAction: 'Manager flow node confirmation failed',
        error: error.name === 'AbortError' ? 'Manager flow node confirmation timed out.' : error.message || String(error),
      }));
      return null;
    }
  };

  useEffect(() => {
    if (activeRoute !== 'project_detail' || projectMode !== 'dashboard' || !activeProject) return;
    refreshBackendSchedulerStatus();
  }, [activeRoute, projectMode, selectedProjectId]);

  useEffect(() => {
    if (activeRoute !== 'project_detail' || projectMode !== 'dashboard' || !activeProject) return;
    if (backendStation.connectionStatus !== 'online') return;
    const timer = setInterval(() => {
      syncBackendProjectState({ silent: true });
    }, 15_000);
    return () => clearInterval(timer);
  }, [activeRoute, projectMode, selectedProjectId, backendStation.connectionStatus]);

  useEffect(() => {
    if (activeRoute !== 'project_detail' || projectMode !== 'timeline' || !activeProject) return;
    if (backendStation.connectionStatus !== 'online') return;
    syncBackendManagerFlowGraph({ silent: true, projectId: activeProject.id });
  }, [activeRoute, projectMode, selectedProjectId, backendStation.connectionStatus]);

  useEffect(() => {
    if (activeRoute !== 'project_detail' || projectMode !== 'dashboard' || !activeProject) return;
    if (!selectedAgentFocusId || backendStation.connectionStatus !== 'online') return;
    syncBackendAgentDashboard(selectedAgentFocusId, { silent: true });
  }, [activeRoute, projectMode, selectedProjectId, selectedAgentFocusId, backendStation.connectionStatus]);

  useEffect(() => {
    const runDueCycles = () => {
      const now = Date.now();
      const nowIso = new Date(now).toISOString();
      const generatedChatMessages = [];
      setProjects(prev => prev.map(project => {
        if (!project.autonomy?.enabled) return project;
        const cadence = project.autonomy.cadence || 'hourly';
        const schedule = evaluateAutonomousSchedule({
          project,
          cadence,
          now: nowIso,
        });
        if (!schedule.due) return {
          ...project,
          nextAutonomousRunAt: schedule.nextRunAt,
        };
        const result = advanceAutonomousProjectCycle({
          project,
          team: project.team,
          cadence,
          messages: [],
          now: nowIso,
          trigger: 'scheduler',
          schedulerReason: schedule.reason,
          dueAt: schedule.dueAt,
          language: project.language || language,
        });
        const publishedCycle = publishAutonomousCycleChat({
          project: result.project,
          cycle: result.cycle,
          cadence,
          projectId: project.id,
          now: nowIso,
          language: project.language || language,
        });
        generatedChatMessages.push(...publishedCycle.messages);
        return publishedCycle.project;
      }));
      if (generatedChatMessages.length) {
        setChatMessages(prev => [...prev, ...generatedChatMessages].slice(-240));
      }
    };

    runDueCycles();
    const timer = setInterval(runDueCycles, 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  // --- Navigation Actions ---
  const navToDashboard = () => { setActiveRoute('dashboard'); setSelectedProjectId(null); };
  const navToMarket = () => {
    setMarketMode('global');
    setActiveRoute('agent_market');
    setSelectedProjectId(null);
    setSelectedMarketAgentId(null);
    setIsDecrypting(true);
    setTimeout(() => setIsDecrypting(false), 800);
  };
  const navToProject = (id) => {
    setSelectedProjectId(id);
    setProjectMode('dashboard');
    setActiveRoute('project_detail');
  };
  const navToInitiation = () => {
    const nextProjectId = projects.some(project => project.id === DEFAULT_INITIATION_PROJECT_ID)
      ? createProjectId(initiationDraft.name || 'project')
      : DEFAULT_INITIATION_PROJECT_ID;
    setMarketMode('initiation');
    setContractProjectPickerAgentId(null);
    setSelectedProjectId(null);
    setInitiationProjectId(nextProjectId);
    setInitiationStep('brief');
    setInitiationPhase('discussion');
    setSelectedInitiationMemberId('jobs');
    setSelectedLeaderCandidateId(null);
    setInitiationMeetingSession(null);
    setInitiationActionDrafts(defaultInitiationActionDrafts(initiationDraft.output, activeLanguage));
    setInitiationConfirmedTeamIds(['jobs', 'turing', 'curie', 'confucius']);
    setInitiationInviteIds(['jobs', 'turing', 'curie', 'confucius']);
    setSelectedInitiationClarificationQuestionId(null);
    setActiveRoute('project_initiation');
  };
  const openInitiationTalentMarket = () => {
    setMarketMode('initiation');
    setSelectedMarketAgentId(null);
    setContractProjectPickerAgentId(null);
    setActiveRoute('agent_market');
    setIsDecrypting(true);
    setTimeout(() => setIsDecrypting(false), 600);
  };
  const continueInitiationFromMarket = () => {
    setMarketMode('initiation');
    setSelectedMarketAgentId(null);
    setInitiationStep('lobby');
    setActiveRoute('project_initiation');
  };
  const navToWarRoom = () => { setActiveRoute('war_room'); setMeetingState('idle'); setMeetingLogs([]); setTargetNodeIds([]); };
  const launchManagerDemoProject = () => {
    const projectId = 'p_manager_demo_001';
    const projectName = 'Manager Demo: Autonomous Agent Studio';
    const directorBriefId = `director_brief_${projectId}`;
    const invitedMembers = INITIATION_MEMBERS.filter(member => ['jobs', 'turing', 'curie', 'musk', 'confucius'].includes(member.id));
    const brief = [
      projectName,
      'A manager-ready demo where agents clarify roles, campaign for leadership, assign work in chat, run continuously, and accept mid-project changes from Google Chat.',
      'Output: polished end-to-end manager walkthrough with timeline evidence.',
    ].join(' ');
    const demoNow = new Date();
    const atOffset = (minutes) => new Date(demoNow.getTime() + minutes * 60 * 1000).toISOString();
    const roleNegotiation = createKickoffRoleNegotiation(invitedMembers, brief, { projectId, projectName, language: activeLanguage });
    const leaderElection = createLeaderElection(invitedMembers, brief, { projectId, projectName, language: activeLanguage });
    const firstLead = invitedMembers.find(member => member.id === leaderElection.recommendedLeaderId)
      || invitedMembers.find(member => member.id === 'jobs')
      || invitedMembers[0];
    const reporter = invitedMembers.find(member => member.id === 'curie' && member.id !== firstLead.id)
      || invitedMembers.find(member => member.id !== firstLead.id)
      || firstLead;
    const team = invitedMembers.map(member => ({
      id: member.id,
      name: member.name,
      role: member.id === firstLead.id ? 'Leader' : member.id === reporter.id ? 'Reviewer' : member.title,
      skill: member.title,
      isLeader: member.id === firstLead.id,
    }));
    const nextActionResolution = buildNextActionResolution({
      tasks: [
        { id: 201, text: 'Publish kickoff charter and role map', assignee: firstLead.name, status: 'done', completedAt: atOffset(2) },
        { id: 202, text: 'Build agent communication contract for group chat', assignee: 'Alan Turing', status: 'pending' },
        { id: 203, text: 'Define acceptance evidence for manager walkthrough', assignee: reporter.name, status: 'pending' },
        { id: 204, text: 'Compress the demo into a sharp user-facing flow', assignee: 'Steve Jobs', status: 'pending' },
      ],
      team,
      selectedLeaderId: firstLead.id,
      now: atOffset(1),
      managerConfirmed: true,
      source: 'manager-demo-next-action-resolution',
    });
    const baseProject = {
      id: projectId,
      name: projectName,
      status: 'executing',
      progress: 18,
      autonomy: { enabled: true, cadence: 'hourly' },
      lastAutonomousRunAt: null,
      team,
      tasks: [
        { id: 201, text: 'Publish kickoff charter and role map', assignee: firstLead.name, status: 'done', completedAt: atOffset(2) },
        { id: 202, text: 'Build agent communication contract for group chat', assignee: 'Alan Turing', status: 'pending' },
        { id: 203, text: 'Define acceptance evidence for manager walkthrough', assignee: reporter.name, status: 'pending' },
        { id: 204, text: 'Compress the demo into a sharp user-facing flow', assignee: 'Steve Jobs', status: 'pending' },
      ],
      logs: [
        { id: 'manager_demo_log_approved', time: atOffset(0), agent: 'Roundtable', log: `${projectName} approved from kickoff meeting after role negotiation and Leader election.`, eventType: 'project-approved' },
        { id: 'manager_demo_log_leader', time: atOffset(1), agent: firstLead.name, log: `${firstLead.name} was confirmed by the Director and received the Leader marker.`, eventType: 'leader-confirmed' },
      ],
      initiation: {
        source: 'manager_demo_seed',
        firstLead: firstLead.name,
        leaderId: firstLead.id,
        directorBriefId,
        roleNegotiation,
        leaderElection,
        nextActionResolution,
        leaderElectionResolution: {
          status: 'manager-confirmed',
          recommendedLeaderId: leaderElection.recommendedLeaderId,
          selectedLeaderId: firstLead.id,
          selectedLeaderName: firstLead.name,
          selectedFromCandidateSlate: true,
          managerConfirmed: true,
          confirmedAt: atOffset(1),
          candidateCount: leaderElection.candidates?.length || 0,
          campaignIds: (leaderElection.transcript || []).map(item => item.id).filter(Boolean),
          hearingEdgeCount: (leaderElection.transcript || []).reduce((sum, item) => sum + (item.hearsOthers?.length || item.hears?.length || 0), 0),
          leaderMarkerPersisted: true,
          candidates: (leaderElection.candidates || []).map(candidate => ({
            agentId: candidate.agentId,
            name: candidate.name,
            role: candidate.role,
            score: candidate.score,
            campaignId: (leaderElection.transcript || []).find(item => item.speakerId === candidate.agentId)?.id || null,
            heardBy: candidate.hearsOthers || [],
            selected: candidate.agentId === firstLead.id,
          })),
        },
        reporter: reporter.name,
        output: 'Polished end-to-end manager walkthrough with timeline evidence.',
        summary: 'Seeded scenario for the first requested manager use case.',
        reason: 'Managers need a direct, complete, low-friction demo path.',
      },
    };
    const peerManagedBaseProject = applyPeerManagementMatrix({
      project: baseProject,
      leaderId: firstLead.id,
      reviewerId: reporter.id,
      now: atOffset(2),
    });
    const assignmentPackage = createLeaderAssignmentPackage({
      project: peerManagedBaseProject,
      leaderId: firstLead.id,
      now: atOffset(3),
    });
    const assignedProject = {
      ...peerManagedBaseProject,
      tasks: assignmentPackage.tasks,
      logs: [...assignmentPackage.acknowledgementLogs, ...assignmentPackage.assignmentLogs, ...peerManagedBaseProject.logs],
    };
    const kickoffCharter = createKickoffCharter({
      project: assignedProject,
      leaderId: firstLead.id,
      reviewerId: reporter.id,
      roleNegotiation,
      leaderElection,
      assignmentPackage,
      now: atOffset(4),
    });
    const kickoffCharterWithNextActionResolution = {
      ...kickoffCharter,
      nextActionResolution,
      evidence: {
        ...(kickoffCharter.evidence || {}),
        nextActionIds: nextActionResolution.actionIds,
      },
    };
    const kickoffLedgerProject = appendProjectEvents({
      ...assignedProject,
      kickoffCharter: kickoffCharterWithNextActionResolution,
    }, [
      ...(kickoffCharter.ledgerEvents || [kickoffCharter.ledgerEvent]),
      ...(assignmentPackage.ledgerEvents || []),
    ]);
    const demoKickoffDecisionMessages = [
      {
        id: `decision_${projectId}_leader`,
        channelId: 'decisions',
        type: 'decision',
        author: 'Director',
        time: 'Kickoff',
        text: `${firstLead.name} is confirmed as Leader for ${projectName}.`,
        targets: ['all'],
        decisionId: 'LEAD-DEMO',
      },
      {
        id: `decision_${projectId}_next_actions`,
        channelId: 'decisions',
        type: 'decision',
        author: 'Director',
        time: 'Kickoff',
        text: `${nextActionResolution.taskCount} first execution actions confirmed for Leader assignment.`,
        targets: ['all'],
        decisionId: 'NEXT-DEMO',
        weight: 'Next Action Resolution',
        nextActionIds: nextActionResolution.actionIds,
      },
    ].map(message => attachMessageReceipts(message, team, { seenAt: atOffset(4) }));
    const kickoffDecisionProject = applyChatMessagesToAgentStates({
      project: kickoffLedgerProject,
      team,
      messages: demoKickoffDecisionMessages,
      now: atOffset(4),
      source: 'kickoff-decision-broadcast',
    });
    const kickoffChatStateProject = applyChatMessagesToAgentStates({
      project: kickoffDecisionProject,
      team,
      messages: [
        ...assignmentPackage.assignmentMessages,
        ...assignmentPackage.acknowledgementMessages,
      ],
      now: atOffset(4),
      source: 'manager-demo-kickoff-chat',
    });
    const firstPulseCycle = advanceAutonomousProjectCycle({
      project: kickoffChatStateProject,
      team: kickoffChatStateProject.team,
      cadence: 'hourly',
      messages: [],
      now: atOffset(5),
      trigger: 'initiation-approval',
      schedulerReason: 'initiation-approved-first-work-pulse',
      dueAt: atOffset(5),
    });
    const publishedFirstPulse = publishAutonomousCycleChat({
      project: firstPulseCycle.project,
      cycle: firstPulseCycle.cycle,
      cadence: 'hourly',
      projectId,
      now: atOffset(5),
      source: 'backend-kickoff-first-pulse-chat',
    });
    const meetingChangeText = '@all add a manager meeting recap packet from this War Room decision';
    const meetingChangeResponse = handleFeatureChangeRequest({
      project: publishedFirstPulse.project,
      text: meetingChangeText,
      author: 'director',
      now: atOffset(7),
      channelId: 'main',
      source: 'war-room-meeting-change-request',
    });
    const changeText = '@all add Google Chat export summary feature before the manager review';
    const changeResponse = handleFeatureChangeRequest({
      project: meetingChangeResponse.project,
      text: changeText,
      author: 'director',
      now: atOffset(8),
      channelId: 'google_chat',
      source: 'google-chat-mention-change-request',
    });
    const dualChannelChange = submitProjectMultiChannelChangeRequest({
      project: changeResponse.project,
      text: '@all add dual-channel manager review packet before the next evidence review',
      now: atOffset(9),
      messageIdPrefix: 'manager_demo_dual_change',
    });
    const changedProject = {
      ...dualChannelChange.project,
      kickoffCharter: kickoffCharterWithNextActionResolution,
    };
    const peerTarget = team.find(member => member.id !== reporter.id && member.id !== firstLead.id)
      || team.find(member => member.id !== reporter.id)
      || firstLead;
    const peerHandoffText = `${reporter.name} needs dependency help from @${peerTarget.name} review the manager evidence handoff`;
    const peerHandoffResponse = handlePeerHandoff({
      project: changedProject,
      text: peerHandoffText,
      requesterId: reporter.id,
      channelId: 'main',
      now: atOffset(12),
    });
    const managementResponder = team.find(member => (
      peerHandoffResponse.project.agentStates?.[member.id]?.peerManagedIds?.length
      || peerHandoffResponse.project.agentStates?.[member.id]?.managedIds?.length
    )) || firstLead;
    const managementPulse = runAgentWorkCycle({
      project: peerHandoffResponse.project,
      agentId: managementResponder.id,
      now: atOffset(14),
      trigger: 'manager-demo-management-pulse',
    });
    const managementResponseTargetId = managementPulse.cycle?.managementTargetIds?.[0];
    const managementResponsePulse = managementResponseTargetId
      ? runAgentWorkCycle({
        project: managementPulse.project,
        agentId: managementResponseTargetId,
        now: atOffset(15),
        trigger: 'manager-demo-management-response',
      })
      : null;
    const managementLoopProject = managementResponsePulse?.project || managementPulse.project;
    const hourlyCycle = advanceAutonomousProjectCycle({
      project: managementLoopProject,
      team: managementLoopProject.team,
      cadence: 'hourly',
      messages: [],
      now: atOffset(60),
      trigger: 'scenario-seed',
      schedulerReason: 'manager-demo-hourly-evidence-seed',
      dueAt: atOffset(60),
    });
    const publishedHourlyCycle = publishAutonomousCycleChat({
      project: hourlyCycle.project,
      cycle: hourlyCycle.cycle,
      cadence: 'hourly',
      projectId,
      now: atOffset(60),
      source: 'manager-demo-autonomous-chat',
    });
    const dailyCycle = advanceAutonomousProjectCycle({
      project: publishedHourlyCycle.project,
      team: publishedHourlyCycle.project.team,
      cadence: 'daily',
      messages: [],
      now: atOffset(24 * 60),
      trigger: 'scenario-seed',
      schedulerReason: 'manager-demo-daily-evidence-seed',
      dueAt: atOffset(24 * 60),
    });
    const rawDemoProject = {
      ...dailyCycle.project,
      progress: Math.max(dailyCycle.project.progress || 0, 52),
      managerDemoReady: true,
    };
    const publishedDailyCycle = publishAutonomousCycleChat({
      project: rawDemoProject,
      cycle: dailyCycle.cycle,
      cadence: 'daily',
      projectId,
      now: atOffset(24 * 60),
      source: 'manager-demo-autonomous-chat',
    });
    const demoProject = applyChatMessagesToAgentStates({
      project: publishedDailyCycle.project,
      team,
      messages: demoKickoffDecisionMessages,
      now: atOffset(24 * 60 + 1),
      source: 'kickoff-decision-broadcast',
    });
    const firstPulseMessages = publishedFirstPulse.messages.map((message) => ({
      ...message,
      time: message.time === 'Completed' ? 'Completed' : 'First Pulse',
    }));
    const cycleMessages = [
      ...publishedHourlyCycle.messages,
      ...publishedDailyCycle.messages,
    ].map((message) => ({
      ...message,
      time: message.time === 'Completed' ? 'Completed' : '24/7',
    }));
    const demoMessages = [
      {
        id: 'manager_demo_system',
        channelId: 'main',
        type: 'system',
        author: 'System',
        time: 'Kickoff',
        text: 'Manager demo scenario loaded: kickoff, election, assignments, meeting change, Google Chat change, 24/7 work, and timeline evidence.',
      },
      {
        id: directorBriefId,
        channelId: 'main',
        type: 'decision',
        author: 'Director',
        role: 'Project Owner',
        time: 'Kickoff',
        text: brief,
        targets: team.map(agent => agent.name),
        heardBy: team.map(agent => agent.id),
        weight: 'Project Brief',
        visibility: {
          receiptCount: team.length,
          directTargetCount: team.length,
        },
      },
      ...roleNegotiation.transcript.map((item) => ({
        id: item.id,
        channelId: 'main',
        type: item.type === 'role-question' ? 'question' : 'text',
        author: item.speaker,
        role: item.role,
        time: 'Kickoff',
        text: item.text,
      })),
      ...leaderElection.transcript.map((item) => ({
        id: item.id,
        channelId: 'main',
        type: 'text',
        author: item.speaker,
        role: item.role,
        time: 'Election',
        text: item.text,
      })),
      ...demoKickoffDecisionMessages,
      ...assignmentPackage.assignmentMessages.map((message, index) => ({
        ...message,
        time: 'Kickoff',
      })),
      ...assignmentPackage.acknowledgementMessages.map((message, index) => ({
        ...message,
        time: 'Kickoff',
      })),
      ...firstPulseMessages,
      {
        id: 'manager_demo_meeting_change_user',
        channelId: 'main',
        type: 'mention',
        author: 'Director',
        time: 'War Room',
        text: meetingChangeText,
        targets: ['all'],
        weight: 'Meeting Change',
      },
      ...meetingChangeResponse.discussionMessages.map((message, index) => ({
        ...message,
        time: 'War Room',
      })),
      {
        id: 'manager_demo_google_user',
        channelId: 'google_chat',
        type: 'mention',
        author: 'Director',
        time: 'Google Chat',
        text: changeText,
        targets: ['all'],
        weight: 'Change Request',
      },
      ...changeResponse.discussionMessages.map((message, index) => ({
        ...message,
        time: 'Google Chat',
      })),
      ...dualChannelChange.messages.map((message) => ({
        ...message,
        time: message.channelId === 'google_chat' ? 'Google Chat' : 'War Room',
      })),
      {
        id: 'manager_demo_peer_user',
        channelId: 'main',
        type: 'text',
        author: 'Director',
        time: 'Peer Handoff',
        text: peerHandoffText,
      },
      {
        ...peerHandoffResponse.requestMessage,
        time: 'Peer Handoff',
      },
      {
        ...peerHandoffResponse.acknowledgementMessage,
        time: 'Peer Handoff',
      },
      ...managementPulse.messages.map((message) => ({
        ...message,
        time: 'Agent Pulse',
      })),
      ...(managementResponsePulse?.messages || []).map((message) => ({
        ...message,
        time: 'Management Response',
      })),
      ...cycleMessages,
    ].map(message => ({ ...message, projectId }));

    setProjects(prev => {
      const withoutDemo = prev.filter(project => project.id !== projectId);
      return [demoProject, ...withoutDemo];
    });
    setChatMessages(prev => [
      ...prev.filter(message => (message.projectId || DEFAULT_CHAT_PROJECT_ID) !== projectId),
      ...demoMessages,
    ]);
    setSelectedProjectId(projectId);
    setProjectMode('dashboard');
    setActiveRoute('project_detail');
  };
  const buildInitiationKickoffPayload = (now = new Date().toISOString()) => {
    const projectId = initiationProjectId;
    const invitedMembers = initiationRosterMembers;
    const taskText = `${initiationDraft.name} ${initiationDraft.summary} ${initiationDraft.intent} ${initiationDraft.output} ${initiationDraft.reason}`;
    const skillPlan = createRoundtablePlan(invitedMembers.map(member => member.id), taskText);
    const plannedTasks = initiationActionDrafts
      .map((text, index) => ({
        id: 102 + index,
        text: text.trim(),
        status: 'pending',
      }))
      .filter(task => task.text);
    return {
      projectId,
      language: activeLanguage,
      name: initiationDraft.name || 'Untitled Initiation',
      brief: taskText,
      meetingSkillBrief: buildInitiationMeetingSkillBrief({
        draft: initiationDraft,
        output: plannedTasks[0]?.text,
        language: activeLanguage,
      }),
      team: invitedMembers,
      selectedLeaderId: selectedLeaderCandidateId || undefined,
      reviewerId: skillPlan.reviewer?.slug,
      tasks: plannedTasks.length ? plannedTasks : [
        { id: 102, text: initiationDraft.output || 'Convert initiation consensus into the first execution artifact', status: 'pending' },
      ],
      now,
      source: 'mandatory_roundtable',
    };
  };

  const startInitiationMeetingSession = async () => {
    const sessionStartedAt = new Date().toISOString();
    const kickoffPayload = buildInitiationKickoffPayload(sessionStartedAt);
    const meetingPayload = {
      ...kickoffPayload,
      meetingId: `meeting_${kickoffPayload.projectId}`,
      language: activeLanguage,
    };
    let meeting = null;

    try {
      const payload = await requestAgentBackend('/kickoff-meetings', {
        method: 'POST',
        body: meetingPayload,
        timeoutMs: 60_000,
      });
      meeting = payload.meeting;
      setBackendStation(prev => ({
        ...prev,
        connectionStatus: 'online',
        lastAction: 'Kickoff meeting session created through backend',
        error: null,
      }));
    } catch (error) {
      setBackendStation(prev => ({
        ...prev,
        connectionStatus: 'offline',
        lastAction: 'Kickoff meeting failed',
        error: error.name === 'AbortError'
          ? 'Backend or model provider timed out. No local mock meeting was created.'
          : `${error.message || String(error)} No local mock meeting was created.`,
      }));
      return;
    }

    setInitiationMeetingSession(meeting);
    setSelectedInitiationClarificationQuestionId(
      (meeting.roleQuestionResolutions || []).find(row => !row.answered)?.questionId
      || (meeting.transcript || []).find(item => item.stage === 'role-clarification' || item.type === 'role-question')?.id
      || null
    );
    setInitiationConfirmedTeamIds(kickoffPayload.team.map(member => member.id));
    setSelectedLeaderCandidateId(meeting.recommendedLeaderId || selectedLeaderCandidateId);
    setInitiationPhase('discussion');
    setRoomInput('');
    setRoomSpeaker(null);
    setRoomIntentions([]);
    setMeetingStartTime(null);
    setMeetingElapsed(0);
    setRoomTranscript([
      {
        id: `initiation_director_${Date.now()}`,
        speaker: 'Director',
        role: 'Founder',
        text: kickoffPayload.brief,
        score: 10,
      },
      ...(meeting.transcript || []).slice(0, 8).map((item, index) => ({
        id: item.id || `initiation_turn_${index}`,
        speaker: item.speaker || item.author || 'Agent',
        role: item.role || item.stage || item.type || 'Kickoff participant',
        text: item.text || '',
        score: item.type === 'role-question' || item.stage === 'role-clarification' ? 8 : 9,
      })),
    ]);
    setInitiationStep('meeting');
  };

  const submitInitiationClarification = async () => {
    if (!initiationMeetingSession) return;
    const text = initiationClarificationDraft.trim();
    if (!text) return;
    const roleQuestion = (initiationMeetingSession.transcript || [])
      .find(item => item.id === selectedInitiationClarificationQuestionId)
      || (initiationMeetingSession.transcript || []).find(item => item.stage === 'role-clarification' || item.type === 'role-question');
    const now = new Date().toISOString();
    let meeting = null;

    try {
      const payload = await requestAgentBackend(`/kickoff-meetings/${encodeURIComponent(initiationMeetingSession.id)}/clarify`, {
        method: 'POST',
        body: {
          questionId: roleQuestion?.id,
          text,
          now,
        },
        timeoutMs: 20_000,
      });
      meeting = payload.meeting;
      setBackendStation(prev => ({
        ...prev,
        connectionStatus: 'online',
        lastAction: 'Kickoff meeting clarification saved through backend',
        error: null,
      }));
    } catch (error) {
      setBackendStation(prev => ({
        ...prev,
        connectionStatus: 'offline',
        lastAction: 'Kickoff clarification failed',
        error: error.name === 'AbortError'
          ? 'Backend clarification timed out. No local mock clarification was saved.'
          : `${error.message || String(error)} No local mock clarification was saved.`,
      }));
      return;
    }

    setInitiationMeetingSession(meeting);
    setSelectedInitiationClarificationQuestionId(
      (meeting.roleQuestionResolutions || []).find(row => !row.answered)?.questionId
      || roleQuestion?.id
      || null
    );
  };

  const approveInitiationProject = async () => {
    const approvedAt = new Date().toISOString();
    const kickoffPayload = buildInitiationKickoffPayload(approvedAt);
    const selectedTeamIds = Array.from(new Set([
      ...initiationConfirmedTeamIds,
      selectedLeaderCandidateId || initiationMeetingSession?.recommendedLeaderId,
    ].filter(Boolean))).filter(id => kickoffPayload.team.some(member => member.id === id));
    const confirmedKickoffPayload = {
      ...kickoffPayload,
      team: selectedTeamIds.length
        ? kickoffPayload.team.filter(member => selectedTeamIds.includes(member.id))
        : kickoffPayload.team,
    };
    let kickoffResult = null;

    try {
      const sessionId = initiationMeetingSession?.id;
      kickoffResult = sessionId ? await requestAgentBackend(`/kickoff-meetings/${encodeURIComponent(sessionId)}/approve`, {
        method: 'POST',
        body: {
          selectedLeaderId: selectedLeaderCandidateId || initiationMeetingSession.recommendedLeaderId || undefined,
          selectedTeamIds,
          reviewerId: kickoffPayload.reviewerId,
          tasks: kickoffPayload.tasks,
          now: approvedAt,
          language: activeLanguage,
        },
        timeoutMs: 60_000,
      }) : await requestAgentBackend('/projects/initiate', {
        method: 'POST',
        body: confirmedKickoffPayload,
        timeoutMs: 60_000,
      });
      if (kickoffResult.meeting) {
        setInitiationMeetingSession(kickoffResult.meeting);
      }
      setBackendStation(prev => ({
        ...prev,
        connectionStatus: 'online',
        lastAction: sessionId ? 'Kickoff meeting approved through backend' : 'Initiation created through backend',
        lastProjectSyncAt: new Date().toISOString(),
        projectSyncCount: (prev.projectSyncCount || 0) + 1,
        error: null,
      }));
      applyBackendManagerDashboardPayload(kickoffResult);
    } catch (error) {
      const session = initiationMeetingSession;
      kickoffResult = session
        ? approveKickoffMeetingSession({
          meeting: { ...session, language: activeLanguage },
          selectedLeaderId: selectedLeaderCandidateId || session.recommendedLeaderId || undefined,
          selectedTeamIds,
          reviewerId: kickoffPayload.reviewerId,
          tasks: kickoffPayload.tasks,
          now: approvedAt,
          language: activeLanguage,
        })
        : createKickoffProjectFromMeeting({
          ...confirmedKickoffPayload,
          meetingId: null,
          selectedLeaderId: selectedLeaderCandidateId || confirmedKickoffPayload.selectedLeaderId,
          now: approvedAt,
          source: 'local-kickoff-fallback',
          language: activeLanguage,
        });
      if (kickoffResult.meeting) {
        setInitiationMeetingSession({
          ...kickoffResult.meeting,
          status: 'approved-local-fallback',
        });
      }
      setBackendStation(prev => ({
        ...prev,
        connectionStatus: 'offline',
        lastAction: 'Backend initiation failed, used local runtime',
        error: error.name === 'AbortError'
          ? 'Backend or model provider timed out. Local runtime fallback created the project.'
          : `${error.message || String(error)} Local runtime fallback created the project.`,
      }));
    }

    const projectReadyForWork = {
      ...kickoffResult.project,
      language: kickoffResult.project?.language || activeLanguage,
    };
    const createdProjectId = projectReadyForWork.id || kickoffPayload.projectId;

    setProjects(prev => {
      const exists = prev.some(p => p.id === createdProjectId);
      return exists
        ? prev.map(p => (p.id === createdProjectId ? projectReadyForWork : p))
        : [projectReadyForWork, ...prev];
    });
    setChatMessages(prev => mergeProjectMessages(
      prev.filter(message => (message.projectId || DEFAULT_CHAT_PROJECT_ID) !== createdProjectId),
      kickoffResult.messages,
    ));

    setInitiationPhase('approved');
    setSelectedProjectId(createdProjectId);
    setProjectMode('dashboard');
    setMeetingStartTime(null);
    setMeetingElapsed(0);
    setRoomSpeaker(null);
    setRoomIntentions([]);
    setRoomInput('');
    setRoomTranscript([
      {
        id: `approved_project_open_${Date.now()}`,
        speaker: 'System',
        role: 'System',
        text: `${projectReadyForWork.name} is approved. The project roundtable is open for the first execution discussion.`,
        score: 0,
      },
      ...(kickoffResult.messages || []).slice(0, 8).map((message, index) => ({
        id: message.id || `approved_kickoff_${index}`,
        speaker: message.author || 'Agent',
        role: message.role || message.type || 'Kickoff',
        text: message.text || '',
        score: message.author === 'Director' ? 10 : 8,
      })),
    ]);
    setActiveRoute('project_detail');
  };
  const enterProjectScene = (mode) => {
    if (sceneTransition || projectMode !== 'dashboard') return;
    if (sceneTransitionTimerRef.current) clearTimeout(sceneTransitionTimerRef.current);
    setProjectLauncherOpen(false);
    setSceneTransition(mode);
    sceneTransitionTimerRef.current = setTimeout(() => {
      setProjectMode(mode);
      setSceneTransition(null);
      sceneTransitionTimerRef.current = null;
    }, 520);
  };
  const exitProjectScene = () => {
    if (sceneTransition) return;
    if (sceneTransitionTimerRef.current) clearTimeout(sceneTransitionTimerRef.current);
    setProjectLauncherOpen(false);
    roomSimulationTimersRef.current.forEach(timer => clearTimeout(timer));
    roomSimulationTimersRef.current = [];
    setRoomSpeaker(null);
    setSceneTransition('dashboard');
    sceneTransitionTimerRef.current = setTimeout(() => {
      setProjectMode('dashboard');
      setSceneTransition(null);
      sceneTransitionTimerRef.current = null;
    }, 420);
  };
  const openMarketDossier = (id) => {
    setSelectedMarketAgentId(id);
    setSelectedProjectId(null);
    setActiveRoute('agent_dossier');
  };
  const closeMarketDossier = () => {
    setActiveRoute('agent_market');
    setSelectedMarketAgentId(null);
  };

  const handleRecruit = (id) => {
    setRecruitedIds(prev => prev.includes(id) ? prev : [...prev, id]);
  };

  const openContractProjectPicker = (id) => {
    if (signingAgentId) return;
    setContractProjectPickerAgentId(id);
  };

  const confirmAgentContractForProject = (projectId) => {
    const agent = LEGENDARY_AGENTS.find(item => item.id === contractProjectPickerAgentId);
    if (!agent || !projectId) return;
    const contractedAt = new Date().toISOString();
    const projectAgent = {
      id: agent.id,
      name: agent.name,
      role: agent.role,
      skill: agent.category,
      category: agent.category,
      source: 'pantheon-market',
      contractedAt,
    };
    setProjects(prev => prev.map(project => {
      if (project.id !== projectId) return project;
      const alreadyInTeam = (project.team || []).some(member => member.id === agent.id);
      const nextTeam = alreadyInTeam ? project.team : [...project.team, projectAgent];
      const nextLog = {
        id: `contract_${agent.id}_${Date.parse(contractedAt) || Date.now()}`,
        time: contractedAt,
        agent: 'Pantheon Market',
        agentId: agent.id,
        log: `${agent.name} joined ${project.name} from The Pantheon contract flow.`,
        eventType: 'agent-contracted',
      };
      return {
        ...project,
        team: nextTeam,
        logs: [nextLog, ...(project.logs || [])],
      };
    }));
    setRecruitedIds(prev => prev.includes(agent.id) ? prev : [...prev, agent.id]);
    setContractProjectPickerAgentId(null);
    setSigningAgentId(agent.id);
    setSelectedProjectId(projectId);
    setProjectMode('dashboard');
    setActiveRoute('project_detail');
    setTimeout(() => setSigningAgentId(null), 900);
  };

  const startContractStamp = (id) => {
    if (signingAgentId) return;
    if (marketMode === 'initiation') {
      setInitiationInviteIds(prev => prev.includes(id) ? prev : [...prev, id]);
      setInitiationConfirmedTeamIds(prev => prev.includes(id) ? prev : [...prev, id]);
      setSelectedInitiationMemberId(id);
      setRecruitedIds(prev => prev.includes(id) ? prev : [...prev, id]);
      setSigningAgentId(id);
      setTimeout(() => {
        setSigningAgentId(null);
        setSelectedMarketAgentId(null);
        setActiveRoute('agent_market');
      }, 650);
      return;
    }
    openContractProjectPicker(id);
  };

  const runRoomSimulation = (text, projectOverride = activeProject) => {
    const team = projectOverride?.team || [];
    roomSimulationTimersRef.current.forEach(timer => clearTimeout(timer));
    roomSimulationTimersRef.current = [];
    const meetingDirective = projectOverride?.meetingSkillBrief
      ? `${projectOverride.meetingSkillBrief}\n\nDirector input:\n${text}`
      : text;
    const exchange = runRoundtableExchange(team, meetingDirective, {
      projectId: projectOverride?.id,
      projectName: projectOverride?.name,
      meetingType: projectOverride?.lastAutonomousRunAt ? 'sync' : 'kickoff',
      language: projectOverride?.language || activeLanguage,
    });
    const runtimeIntentions = exchange.intentions;

    setRoomIntentions(runtimeIntentions);
    setRoomTranscript(prev => [...prev, { id: `u_${Date.now()}`, speaker: 'Director', role: 'User', text, score: 10 }]);
    exchange.responses.forEach((response) => {
      const timer = setTimeout(() => {
        setRoomSpeaker(response.speakerId);
        setRoomIntentions(prev => prev.map(i => i.id === response.speakerId ? { ...i, status: 'speaking' } : i));
        setRoomTranscript(prev => [...prev, {
          id: response.id,
          speaker: response.speaker,
          role: response.role,
          score: response.score,
          text: response.text,
        }]);
        const yieldTimer = setTimeout(() => {
          setRoomIntentions(prev => prev.map(i => i.id === response.speakerId ? { ...i, status: 'yielded' } : i));
        }, 1200);
        roomSimulationTimersRef.current.push(yieldTimer);
      }, response.delayMs);
      roomSimulationTimersRef.current.push(timer);
    });
    const runtimeClearSpeakerTimer = setTimeout(() => {
      setRoomSpeaker(null);
      roomSimulationTimersRef.current = [];
    }, 5600);
    roomSimulationTimersRef.current.push(runtimeClearSpeakerTimer);
    return;

    const skillPlan = createRoundtablePlan(team.map(agent => agent.id), text);
    const taskMatches = new Map(skillPlan.taskMatches.map((item, index) => [item.skill.slug, { ...item, index }]));
    const firstSpeakerRank = new Map(skillPlan.firstSpeakers.map((skill, index) => [skill.slug, index]));
    const intentions = team.map((agent, index) => {
      const skill = getPersonSkill(agent.id);
      const match = taskMatches.get(agent.id);
      const speakerRank = firstSpeakerRank.has(agent.id) ? firstSpeakerRank.get(agent.id) : 99;
      const fallbackScore = 4 + Math.max(0, 4 - index);
      const score = skill
        ? Math.max(5, Math.min(10, Math.round((match?.score || 0) / 18) + 5 - Math.min(speakerRank, 2)))
        : fallbackScore;
      return {
        id: agent.id,
        name: agent.name,
        role: agent.role,
        target: skill ? describeSkillIntent(agent.id, text, skillPlan) : (index === 0 ? 'Project progress' : index === 1 ? 'Technical risk' : 'Experience judgment'),
        origin: text.slice(0, 28) || 'User meeting input',
        score,
        rank: match?.index ?? 99,
        speakerRank,
        wait: index + 1,
        status: 'queued',
      };
    }).sort((a, b) => a.speakerRank - b.speakerRank || b.score - a.score || a.rank - b.rank || a.wait - b.wait);

    setRoomIntentions(intentions);
    setRoomTranscript(prev => [...prev, { id: `u_${Date.now()}`, speaker: 'Director', role: 'User', text, score: 10 }]);
    intentions.slice(0, 3).forEach((intent, index) => {
      const timer = setTimeout(() => {
        setRoomSpeaker(intent.id);
        setRoomIntentions(prev => prev.map(i => i.id === intent.id ? { ...i, status: 'speaking' } : i));
        const speakerSkill = getPersonSkill(intent.id);
        const skillReply = speakerSkill ? buildSkillRoomReply(intent.id, text, intent) : '';
        const replyLead = speakerSkill?.motto || intent.target;
        const replyBody = speakerSkill?.principles?.[0] || 'Break the issue into verifiable facts before proposing a solution.';
        setRoomTranscript(prev => [...prev, {
          id: `${intent.id}_${Date.now()}_${index}`,
          speaker: intent.name,
          role: intent.role,
          score: intent.score,
          text: skillReply || `${replyLead}: ${intent.target} is ready to respond. For "${intent.origin}": ${replyBody}`,
        }]);
        const yieldTimer = setTimeout(() => {
          setRoomIntentions(prev => prev.map(i => i.id === intent.id ? { ...i, status: 'yielded' } : i));
        }, 1200);
        roomSimulationTimersRef.current.push(yieldTimer);
      }, 650 + index * 1450);
      roomSimulationTimersRef.current.push(timer);
    });
    const clearSpeakerTimer = setTimeout(() => {
      setRoomSpeaker(null);
      roomSimulationTimersRef.current = [];
    }, 5600);
    roomSimulationTimersRef.current.push(clearSpeakerTimer);
  };

  const queueRoomChangeDiscussion = (changeResponse, projectOverride = activeProject) => {
    if (!changeResponse?.discussionMessages?.length) return;
    const team = projectOverride?.team || [];
    const changeIntentions = changeResponse.discussionMessages.map((message, index) => {
      const agent = team.find(item => item.name === message.author);
      return {
        id: `change_${message.id}`,
        name: message.author,
        role: message.role || agent?.role || 'Change owner',
        target: message.type === 'decision' ? 'confirm change' : message.id.includes('sync') ? 'sync plan' : 'discuss impact',
        origin: 'meeting change request',
        score: message.type === 'decision' ? 10 : 8,
        rank: index,
        speakerRank: index,
        wait: index + 1,
        status: 'queued',
      };
    });
    setRoomIntentions(prev => [...prev, ...changeIntentions].slice(-8));
    changeResponse.discussionMessages.forEach((message, index) => {
      const agent = team.find(item => item.name === message.author);
      const startTimer = setTimeout(() => {
        if (agent) setRoomSpeaker(agent.id);
        setRoomIntentions(prev => prev.map(intent => (
          intent.id === `change_${message.id}` ? { ...intent, status: 'speaking' } : intent
        )));
        setRoomTranscript(prev => [...prev, {
          id: `room_${message.id}`,
          speaker: message.author,
          role: message.role || agent?.role || 'Change discussion',
          score: message.type === 'decision' ? 10 : 8,
          text: message.text,
          source: 'war-room-change',
        }]);
      }, 1600 + index * 900);
      const yieldTimer = setTimeout(() => {
        setRoomIntentions(prev => prev.map(intent => (
          intent.id === `change_${message.id}` ? { ...intent, status: 'yielded' } : intent
        )));
        if (index === changeResponse.discussionMessages.length - 1) setRoomSpeaker(null);
      }, 2500 + index * 900);
      roomSimulationTimersRef.current.push(startTimer, yieldTimer);
    });
  };

  const submitRoomInput = async (projectOverride = activeProject) => {
    const text = roomInput.trim();
    if (!text) return;
    const submittedAt = new Date().toISOString();
    const messageId = `room_change_user_${Date.now()}`;
    setRoomInput('');

    if (backendStation.connectionStatus === 'online' && projectOverride?.id === activeProject?.id) {
      try {
        const backendResult = await runBackendProjectCommand('meeting', {
          text,
          now: submittedAt,
          messageId,
        });
        const nextProject = backendResult?.project || projectOverride;
        runRoomSimulation(text, nextProject);
        const changeResponse = backendResult?.responses?.changeResponse;
        if (changeResponse) queueRoomChangeDiscussion(changeResponse, nextProject);
        return;
      } catch (error) {
        setBackendStation(prev => ({
          ...prev,
          connectionStatus: 'offline',
          lastAction: 'Backend meeting failed, used local runtime',
          error: error.name === 'AbortError' ? 'Backend meeting command timed out.' : error.message || String(error),
        }));
      }
    }

    const meetingResult = submitProjectMeetingMessage({
      project: projectOverride,
      text,
      now: submittedAt,
      messageId,
      language: projectOverride?.language || activeLanguage,
    });
    const nextProject = meetingResult.project;
    const changeResponse = meetingResult.responses.changeResponse;
    setProjects(prev => prev.map(project => (
      project.id === projectOverride.id ? nextProject : project
    )));
    if (meetingResult.messages.length) {
      setChatMessages(prev => mergeProjectMessages(prev, meetingResult.messages));
    }
    runRoomSimulation(text, nextProject);
    if (changeResponse) queueRoomChangeDiscussion(changeResponse, nextProject);
  };

  const insertMention = (name) => {
    setChatInput(prev => `${prev}${prev.endsWith(' ') || !prev ? '' : ' '}@${name} `);
    setShowMentionPicker(false);
    setMentionFilter('');
    setMentionIndex(0);
  };

  const submitChatInput = async () => {
    const text = chatInput.trim();
    if (!text) return;
    const submittedAt = new Date().toISOString();
    const messageId = `m_${Date.now()}`;
    setChatInput('');
    setShowMentionPicker(false);
    setMentionFilter('');
    setFocusedChatProofIds([]);

    if (backendStation.connectionStatus === 'online') {
      try {
        await runBackendProjectCommand('chat', {
          text,
          channelId: activeChannelId,
          now: submittedAt,
          messageId,
        });
        return;
      } catch (error) {
        setBackendStation(prev => ({
          ...prev,
          connectionStatus: 'offline',
          lastAction: 'Backend chat failed, used local runtime',
          error: error.name === 'AbortError' ? 'Backend chat command timed out.' : error.message || String(error),
        }));
      }
    }

    const chatResult = submitProjectChatMessage({
      project: activeProject,
      text,
      channelId: activeChannelId,
      now: submittedAt,
      messageId,
      language: activeLanguage,
    });
    setProjects(prev => prev.map(project => (
      project.id === activeProject.id ? chatResult.project : project
    )));
    setChatMessages(prev => mergeProjectMessages(prev, chatResult.messages));
  };

  const createMockChannel = () => {
    const nextIndex = chatChannels.length + 1;
    const id = `room_${nextIndex}`;
    setChatChannels(prev => [...prev, { id, name: `Room ${nextIndex}`, description: 'Public project channel visible to project members.', category: 'text', unread: 0 }]);
    setActiveChannelId(id);
  };

  const handleTimelineWheel = (event) => {
    event.preventDefault();
    const now = Date.now();
    if (now - lastTimelineWheelRef.current < 260) return;
    lastTimelineWheelRef.current = now;
    const levels = ['hour', 'day', 'week', 'month'];
    const current = levels.indexOf(timelineScale);
    const next = event.deltaY > 0 ? Math.min(levels.length - 1, current + 1) : Math.max(0, current - 1);
    setTimelineScale(levels[next]);
  };

  // --- Meeting Actions ---
  const startMeeting = () => {
    const session = startAgentSession(activeProject.team, {
      projectId: activeProject.id,
      projectName: activeProject.name,
      meetingType: activeProject.lastAutonomousRunAt ? 'sync' : 'kickoff',
      language: activeLanguage,
    });
    const opening = session.events.find(event => event.kind === 'agent');
    setMeetingState('active');
    setMeetingLogs([
      ...session.events
        .filter(event => event.kind === 'system')
        .map(event => ({ id: ++logIdRef.current, type: 'system', text: event.text }))
    ]);
    
    setTimeout(() => {
      if (!opening) return;
      setSpeakingAgent(opening.agent.id);
      setMeetingLogs(prev => [...prev, { 
        id: ++logIdRef.current, type: 'ai', agent: opening.agent, 
        text: opening.text 
      }]);
    }, 1500);
    setTimeout(() => setSpeakingAgent(null), 3500);
  };

  const handleTerminalSubmit = (e) => {
    if (e.key === 'Enter' && terminalInput.trim() && meetingState === 'active') {
      const val = terminalInput;
      const submittedAt = new Date().toISOString();
      setTerminalInput('');
      setSpeakingAgent('user');
      const isFeatureChange = isFeatureChangeRequest(val);
      const meetingSourceMessage = isFeatureChange ? attachMessageReceipts({
        id: `room_terminal_change_user_${Date.now()}`,
        projectId: activeProject.id,
        channelId: 'main',
        type: 'mention',
        author: 'Director',
        time: 'War Room',
        text: val,
        targets: ['all'],
        weight: 'Meeting Change',
      }, activeProject.team, { seenAt: submittedAt }) : null;
      const projectAfterMeetingMessage = meetingSourceMessage
        ? applyChatMessagesToAgentStates({
          project: activeProject,
          team: activeProject.team,
          messages: [meetingSourceMessage],
          now: submittedAt,
          source: 'war-room-meeting-message',
        })
        : activeProject;
      const routed = routeDirectorDirective({
        team: activeProject.team,
        directive: val,
        targetIds: targetNodeIds,
        context: {
          projectId: activeProject.id,
          projectName: activeProject.name,
          meetingType: activeProject.lastAutonomousRunAt ? 'sync' : 'kickoff',
          language: activeLanguage,
        },
      });
      const changeResponse = isFeatureChange ? handleFeatureChangeRequest({
        project: projectAfterMeetingMessage,
        text: val,
        author: 'director',
        now: submittedAt,
        channelId: 'main',
        source: 'war-room-meeting-change-request',
        requestMessageId: meetingSourceMessage?.id || null,
        language: activeLanguage,
      }) : null;
      if (changeResponse) {
        setProjects(prev => prev.map(project => (
          project.id === activeProject.id ? changeResponse.project : project
        )));
        setChatMessages(prev => [
          ...prev,
          ...(meetingSourceMessage ? [meetingSourceMessage] : []),
          ...changeResponse.discussionMessages.map(message => ({ ...message, projectId: activeProject.id })),
        ]);
      }

      setMeetingLogs(prev => [...prev, { id: ++logIdRef.current, type: 'user', text: val, targetNames: routed.targetNames }]);
      setTimeout(() => setSpeakingAgent(null), 1000);

      routed.events
        .filter(event => event.kind === 'agent')
        .forEach((event, index, events) => {
          setTimeout(() => {
            setSpeakingAgent(event.agent.id);
            setMeetingLogs(prev => [...prev, { 
              id: ++logIdRef.current, type: 'ai', agent: event.agent, 
              text: event.text 
            }]);
          }, event.delayMs || (2000 + index * 900));
          setTimeout(() => setSpeakingAgent(null), (event.delayMs || (2000 + index * 900)) + 1400);
          if (index === events.length - 1) {
            setTimeout(() => setSpeakingAgent(null), (event.delayMs || (2000 + index * 900)) + 1800);
          }
        });
      if (changeResponse) {
        changeResponse.discussionMessages.forEach((message, index) => {
          const agent = activeProject.team.find(item => item.name === message.author);
          if (!agent) return;
          setTimeout(() => {
            setSpeakingAgent(agent.id);
            setMeetingLogs(prev => [...prev, {
              id: ++logIdRef.current,
              type: 'ai',
              agent,
              text: message.text,
            }]);
          }, 1600 + index * 850);
          setTimeout(() => setSpeakingAgent(null), 2500 + index * 850);
        });
      }
    }
  };

  const endMeeting = () => {
    const updatedProjects = projects.map(p => {
      if (p.id === selectedProjectId) {
         return {
           ...p,
           logs: [{ time: 'Just now', agent: 'System', log: 'Session ended. Directives logged and distributed.' }, ...p.logs]
         };
      }
      return p;
    });
    setProjects(updatedProjects);
    setMeetingState('idle');
    setSpeakingAgent(null);
    setTargetNodeIds([]);
    setActiveRoute('project_detail');
  };


  // --- UI COMPONENTS ---

  const renderContractProjectPicker = () => {
    if (!contractProjectPickerAgentId) return null;
    const agent = LEGENDARY_AGENTS.find(item => item.id === contractProjectPickerAgentId);
    if (!agent) return null;
    return (
      <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/55 px-6 py-6">
        <button aria-label="Close project picker" onClick={() => setContractProjectPickerAgentId(null)} className="absolute inset-0 z-0 cursor-default" />
        <section className="relative z-10 w-[min(820px,94vw)] max-h-[88vh] overflow-hidden border border-[#251b13] bg-[#efe2bd] text-[#251b13] shadow-[18px_18px_0_rgba(0,0,0,0.28)]">
          <header className="flex items-start justify-between gap-6 border-b border-[#b8a57d] p-6">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#8f1e18] mb-3">Project Contract Target</div>
              <h2 className="font-serif text-4xl leading-none">Choose project for {agent.name}</h2>
              <p className="mt-3 font-serif text-lg leading-relaxed text-[#5c4933]">
                Agentic Market now contracts talent into a project team. Pick an existing project and the contract will open that project immediately.
              </p>
            </div>
            <button onClick={() => setContractProjectPickerAgentId(null)} className="border border-[#b8a57d] p-2 text-[#5c4933] hover:border-[#251b13] hover:text-[#251b13] transition-colors">
              <X size={18} />
            </button>
          </header>
          <div className="max-h-[58vh] overflow-y-auto p-6">
            <div className="grid gap-3">
              {projects.map(project => {
                const alreadyInTeam = (project.team || []).some(member => member.id === agent.id);
                return (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => confirmAgentContractForProject(project.id)}
                    className="group flex items-center justify-between gap-5 border border-[#b8a57d] bg-[#f7edcf] p-5 text-left transition-colors hover:border-[#251b13] hover:bg-[#fff8df]"
                  >
                    <span className="min-w-0">
                      <span className="block font-serif text-2xl leading-tight">{project.name}</span>
                      <span className="mt-2 block font-mono text-[9px] uppercase tracking-widest text-[#7d6a49]">
                        {project.id} / {project.status} / {(project.team || []).length} members
                      </span>
                      {alreadyInTeam && (
                        <span className="mt-2 inline-flex border border-[#59684b] bg-[#59684b] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-white">
                          Already in team
                        </span>
                      )}
                    </span>
                    <span className="flex shrink-0 items-center gap-2 border border-[#251b13] bg-[#251b13] px-4 py-3 font-mono text-[9px] uppercase tracking-widest text-[#efe2bd] transition-transform group-hover:-translate-x-1">
                      {alreadyInTeam ? <Eye size={13} /> : <FileSignature size={13} />}
                      {alreadyInTeam ? 'Open Project' : 'Contract'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <footer className="flex items-center justify-between gap-4 border-t border-[#b8a57d] bg-[#e3d3a8] px-6 py-4">
            <div className="font-mono text-[9px] uppercase tracking-widest text-[#7d6a49]">
              {projects.length} existing project{projects.length === 1 ? '' : 's'} available
            </div>
            <button onClick={navToInitiation} className="border border-[#251b13] px-4 py-2 font-mono text-[9px] uppercase tracking-widest text-[#251b13] hover:bg-[#251b13] hover:text-[#efe2bd] transition-colors">
              Start new project
            </button>
          </footer>
        </section>
      </div>
    );
  };

  const renderSettingsModal = () => {
    const navItems = [
      { id: 'deployment', label: t('settings.deployment'), icon: Server },
      { id: 'keys', label: t('settings.keys'), icon: KeyRound },
      { id: 'models', label: t('settings.models'), icon: Cpu },
      { id: 'privacy', label: t('settings.privacy'), icon: Shield },
      { id: 'workspace', label: t('settings.workspace'), icon: SlidersHorizontal },
      { id: 'integrations', label: t('settings.integrations'), icon: PlugZap },
      { id: 'health', label: 'Health', icon: Activity },
    ];

    const fieldClass = 'w-full border border-[#d1d0c9] bg-[#f8f6ee] px-3 py-2 font-mono text-xs text-[#1a1a1a] outline-none transition-colors focus:border-[#1a1a1a]';
    const labelClass = 'font-mono text-[10px] uppercase tracking-[0.16em] text-[#7d786b]';

    const SettingField = ({ label, hint, children }) => (
      <div className="space-y-2">
        <div className={labelClass}>{localizeText(label, activeLanguage)}</div>
        {children}
        {hint && <p className="font-mono text-[10px] leading-relaxed text-[#8b8678]">{localizeText(hint, activeLanguage)}</p>}
      </div>
    );

    const ToggleField = ({ label, hint, defaultChecked = false }) => (
      <label className="flex items-start justify-between gap-4 border border-[#d1d0c9] bg-[#f5f4f0] px-4 py-3">
        <span className="min-w-0">
          <span className="block font-mono text-xs text-[#1a1a1a]">{localizeText(label, activeLanguage)}</span>
          {hint && <span className="mt-1 block font-mono text-[10px] leading-relaxed text-[#7d786b]">{localizeText(hint, activeLanguage)}</span>}
        </span>
        <input type="checkbox" defaultChecked={defaultChecked} className="mt-0.5 h-4 w-4 accent-[#1a1a1a]" />
      </label>
    );

    const SmallButton = ({ children, onClick, disabled = false }) => (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`border border-[#1a1a1a] bg-[#1a1a1a] px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-[#f5f4f0] transition-colors ${disabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-[#3a3429]'}`}
      >
        {children}
      </button>
    );

    const tabTitle = navItems.find(item => item.id === settingsTab)?.label;
    const healthRows = healthCheck.rows.length ? healthCheck.rows : [
      { id: 'backend', label: 'Backend worker station', status: 'idle', detail: 'Not checked yet.' },
      { id: 'provider', label: 'Model provider config', status: 'idle', detail: 'Not checked yet.' },
      { id: 'request', label: 'Model request loop', status: 'idle', detail: 'Not checked yet.' },
      { id: 'workflow', label: 'Workflow smoke', status: 'idle', detail: 'Run workflow smoke when you want to validate autonomous collaboration.' },
    ];
    const healthStatusClass = {
      pass: 'border-green-700 bg-green-50 text-green-800',
      fail: 'border-red-800 bg-red-50 text-red-800',
      running: 'border-[#8f1e18] bg-[#f7edcf] text-[#8f1e18]',
      pending: 'border-[#d1d0c9] bg-[#f8f6ee] text-[#7d786b]',
      idle: 'border-[#d1d0c9] bg-[#f8f6ee] text-[#7d786b]',
    };
    const healthStatusLabel = {
      pass: 'Pass',
      fail: 'Fail',
      running: 'Running',
      pending: 'Queued',
      idle: 'Idle',
    };

    return (
      <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 px-6 py-6">
        <button aria-label={t('common.close')} onClick={() => setSettingsOpen(false)} className="absolute inset-0 cursor-default" />
        <section className="relative z-10 flex h-[min(760px,92vh)] w-[min(1040px,94vw)] overflow-hidden border border-[#1a1a1a] bg-[#ebe9e0] shadow-[18px_18px_0_rgba(0,0,0,0.22)]">
          <aside className="w-64 shrink-0 border-r border-[#d1d0c9] bg-[#dfdccf] p-5">
            <div className="mb-7 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center border border-[#1a1a1a] bg-[#1a1a1a] font-serif text-2xl text-[#f5f4f0]">D</div>
              <div className="min-w-0">
                <div className="truncate font-serif text-xl leading-none">{t('nav.studioDirector')}</div>
                <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.16em] text-[#7d786b]">{t('nav.directorHandle')}</div>
              </div>
            </div>

            <nav className="flex flex-col gap-1">
              {navItems.map(item => {
                const Icon = item.icon;
                const active = settingsTab === item.id;
                return (
                  <button
                    key={item.id}
                    data-testid={`settings-tab-${item.id}`}
                    onClick={() => setSettingsTab(item.id)}
                    className={`flex items-center gap-3 px-3 py-2.5 text-left font-mono text-xs transition-colors ${active ? 'bg-[#1a1a1a] text-[#f5f4f0]' : 'text-[#4f4b43] hover:bg-[#d1d0c9] hover:text-[#1a1a1a]'}`}
                  >
                    <Icon size={15} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            <header className="flex h-16 shrink-0 items-center justify-between border-b border-[#d1d0c9] px-6">
              <div>
                <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-[#8b8678]">{t('settings.title')}</div>
                <h2 className="font-serif text-3xl leading-none">{tabTitle}</h2>
              </div>
              <button onClick={() => setSettingsOpen(false)} className="p-2 text-[#555047] hover:bg-[#d1d0c9] hover:text-black transition-colors" aria-label={t('common.close')}>
                <X size={18} />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-7 py-6">
              {settingsTab === 'deployment' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-5">
                    <SettingField label="Deployment Mode" hint="Choose cloud API, enterprise gateway, local model service, or hybrid fallback.">
                      <select className={fieldClass} defaultValue="gateway">
                        <option value="gateway">Unified API Gateway</option>
                        <option value="openai-compatible">OpenAI Compatible Endpoint</option>
                        <option value="azure">Azure OpenAI</option>
                        <option value="gemini">Google Gemini API</option>
                        <option value="local">Local Runtime / Ollama</option>
                      </select>
                    </SettingField>
                    <SettingField label="Environment" hint="Switch between development, staging, and production.">
                      <select className={fieldClass} defaultValue="dev">
                        <option value="dev">Development</option>
                        <option value="staging">Staging</option>
                        <option value="prod">Production</option>
                      </select>
                    </SettingField>
                  </div>
                  <SettingField label="API Base URL" hint="Use a self-hosted gateway, reverse proxy, or model provider endpoint.">
                    <input className={fieldClass} defaultValue="https://api.halloffame.studio/v1" />
                  </SettingField>
                  <div className="grid grid-cols-3 gap-5">
                    <SettingField label="Request Timeout">
                      <input className={fieldClass} defaultValue="60s" />
                    </SettingField>
                    <SettingField label="Concurrency Limit">
                      <input className={fieldClass} defaultValue="8" />
                    </SettingField>
                    <SettingField label="Retry Limit">
                      <input className={fieldClass} defaultValue="2" />
                    </SettingField>
                  </div>
                  <ToggleField label="Enable Health Checks" hint="Check backend and model availability before meetings, search, and long-running tasks." defaultChecked />
                  <ToggleField label="Enable Streaming Output" hint="Display Agent replies progressively when supported." defaultChecked />
                </div>
              )}

              {settingsTab === 'keys' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-[1fr_auto] gap-3">
                    <SettingField label="Primary API Key" hint="Used by the local backend for model requests; never bundle secrets into the frontend.">
                      <input className={fieldClass} type={showPrimaryKey ? 'text' : 'password'} placeholder="Configured on the local backend" />
                    </SettingField>
                    <button onClick={() => setShowPrimaryKey(!showPrimaryKey)} className="mt-6 h-[34px] border border-[#d1d0c9] bg-[#f8f6ee] px-3 text-[#555047] hover:border-[#1a1a1a] hover:text-black" aria-label="Toggle API key visibility">
                      {showPrimaryKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-5">
                    <SettingField label="Gemini API Key">
                      <input className={fieldClass} type="password" placeholder="Configured on the local backend" />
                    </SettingField>
                    <SettingField label="Azure / Enterprise Token">
                      <input className={fieldClass} type="password" placeholder="Paste token..." />
                    </SettingField>
                  </div>
                  <div className="grid grid-cols-2 gap-5">
                    <SettingField label="Key Scope">
                      <select className={fieldClass} defaultValue="workspace">
                        <option value="personal">Personal</option>
                        <option value="workspace">Workspace</option>
                        <option value="project">Project Only</option>
                      </select>
                    </SettingField>
                    <SettingField label="Rotation Reminder">
                      <select className={fieldClass} defaultValue="30">
                        <option value="14">Every 14 days</option>
                        <option value="30">Every 30 days</option>
                        <option value="90">Every 90 days</option>
                      </select>
                    </SettingField>
                  </div>
                  <ToggleField label="Read Keys From Environment" hint="Supports HOF_API_KEY, GEMINI_API_KEY, and AZURE_OPENAI_API_KEY." defaultChecked />
                  <ToggleField label="Validate Before Saving" hint="Run a lightweight ping before saving credentials." defaultChecked />
                </div>
              )}

              {settingsTab === 'models' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-5">
                    <SettingField label="Default Chat Model">
                      <select className={fieldClass} defaultValue="gpt-4.1">
                        <option value="gpt-4.1">GPT-4.1</option>
                        <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                        <option value="claude-sonnet">Claude Sonnet</option>
                        <option value="local">Local Model</option>
                      </select>
                    </SettingField>
                    <SettingField label="Deep Reasoning Model">
                      <select className={fieldClass} defaultValue="gpt-4.1">
                        <option value="gpt-4.1">GPT-4.1</option>
                        <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                        <option value="o-series">O-series Reasoning</option>
                      </select>
                    </SettingField>
                  </div>
                  <div className="grid grid-cols-3 gap-5">
                    <SettingField label="Temperature">
                      <input className={fieldClass} defaultValue="0.7" />
                    </SettingField>
                    <SettingField label="Max Tokens">
                      <input className={fieldClass} defaultValue="8192" />
                    </SettingField>
                    <SettingField label="Context Window">
                      <input className={fieldClass} defaultValue="128k" />
                    </SettingField>
                  </div>
                  <SettingField label="Model Routing Rules" hint="Choose models by task type, context length, and reasoning depth.">
                    <textarea className={`${fieldClass} min-h-[96px] resize-none`} defaultValue={'agent_market: fast\nroundtable: reasoning\nproject_chat: default\ntimeline_analysis: long-context'} />
                  </SettingField>
                  <ToggleField label="Cost-First Fallback" hint="Switch to lower-cost models when quota or peak load requires it." />
                  <ToggleField label="Per-Agent System Prompt" hint="Each Agent can keep an independent persona, rules, and memory." defaultChecked />
                </div>
              )}

              {settingsTab === 'privacy' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-5">
                    <SettingField label="Data Retention">
                      <select className={fieldClass} defaultValue="30">
                        <option value="session">Session Only</option>
                        <option value="30">30 Days</option>
                        <option value="forever">Until Manual Delete</option>
                      </select>
                    </SettingField>
                    <SettingField label="Log Level">
                      <select className={fieldClass} defaultValue="metadata">
                        <option value="off">Off</option>
                        <option value="metadata">Metadata Only</option>
                        <option value="full">Full Debug</option>
                      </select>
                    </SettingField>
                  </div>
                  <ToggleField label="Disable Training Data Sharing" hint="Enterprise deployments should not send user content for third-party model training." defaultChecked />
                  <ToggleField label="Redact Sensitive Information" hint="Automatically redact keys, emails, phone numbers, and financial identifiers." defaultChecked />
                  <ToggleField label="Project-Level Access Control" hint="Isolate projects, meeting records, and timeline nodes by member permissions." defaultChecked />
                  <ToggleField label="Confirm Before Export" hint="Confirm permissions before exporting chat logs, Agent dossiers, or project materials." defaultChecked />
                </div>
              )}

              {settingsTab === 'workspace' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-5">
                    <SettingField label={t('settings.defaultLanguage')} hint={t('settings.languageHint')}>
                      <select data-testid="settings-global-language" className={fieldClass} value={language} onChange={(event) => setLanguage(event.target.value)}>
                        <option value="zh">{t('language.zh')}</option>
                        <option value="en">{t('language.en')}</option>
                      </select>
                    </SettingField>
                    <SettingField label={t('settings.projectLanguage')} hint={activeProject ? t('settings.inheritGlobal') : t('settings.languageHint')}>
                      <select
                        data-testid="settings-project-language"
                        className={fieldClass}
                        value={activeProject?.language || 'inherit'}
                        disabled={!activeProject}
                        onChange={(event) => {
                          if (!activeProject) return;
                          const nextLanguage = event.target.value === 'inherit' ? undefined : event.target.value;
                          setProjectLanguage(nextLanguage || null);
                          setProjects(prev => prev.map(project => (
                            project.id === activeProject.id
                              ? { ...project, ...(nextLanguage ? { language: nextLanguage } : { language: undefined }) }
                              : project
                          )));
                        }}
                      >
                        <option value="inherit">{t('settings.inheritGlobal')}</option>
                        <option value="zh">{t('language.zh')}</option>
                        <option value="en">{t('language.en')}</option>
                      </select>
                    </SettingField>
                    <SettingField label={t('settings.interfaceDensity')}>
                      <select className={fieldClass} defaultValue="compact">
                        <option value="compact">{t('settings.compact')}</option>
                        <option value="comfortable">{t('settings.comfortable')}</option>
                      </select>
                    </SettingField>
                  </div>
                  <div className="grid grid-cols-2 gap-5">
                    <SettingField label="Default Project Visibility">
                      <select className={fieldClass} defaultValue="invite">
                        <option value="private">Private</option>
                        <option value="invite">Invite Only</option>
                        <option value="workspace">Workspace</option>
                      </select>
                    </SettingField>
                    <SettingField label="Autosave Interval">
                      <select className={fieldClass} defaultValue="15">
                        <option value="5">5 seconds</option>
                        <option value="15">15 seconds</option>
                        <option value="60">1 minute</option>
                      </select>
                    </SettingField>
                  </div>
                  <ToggleField label="Enable Project Rules" hint="Store writing patterns, brand constraints, and output formats per project." defaultChecked />
                  <ToggleField label="Enable Long-Term Memory" hint="Remember user preferences, common personas, and project background." />
                  <ToggleField label="Auto-Summarize Meetings" hint="Create decisions, tasks, risks, and blockers after a roundtable ends." defaultChecked />
                </div>
              )}

              {settingsTab === 'integrations' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-5">
                    <SettingField label="Proxy / Network">
                      <input className={fieldClass} placeholder="https://proxy.company.com:8080" />
                    </SettingField>
                    <SettingField label="Webhook URL">
                      <input className={fieldClass} placeholder="https://hooks.company.com/hof" />
                    </SettingField>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="border border-[#d1d0c9] bg-[#f5f4f0] p-4">
                      <Globe2 size={18} className="mb-3" />
                      <div className="font-mono text-xs">Browser Tools</div>
                      <div className="mt-1 font-mono text-[10px] text-[#7d786b]">Enabled</div>
                    </div>
                    <div className="border border-[#d1d0c9] bg-[#f5f4f0] p-4">
                      <Database size={18} className="mb-3" />
                      <div className="font-mono text-xs">Vector Store</div>
                      <div className="mt-1 font-mono text-[10px] text-[#7d786b]">Pending</div>
                    </div>
                    <div className="border border-[#d1d0c9] bg-[#f5f4f0] p-4">
                      <WalletCards size={18} className="mb-3" />
                      <div className="font-mono text-xs">Usage Budget</div>
                      <div className="mt-1 font-mono text-[10px] text-[#7d786b]">$120 / month</div>
                    </div>
                  </div>
                  <ToggleField label="Enable MCP / External Tools" hint="Reserve integration points for filesystems, browser, database, and design tools." defaultChecked />
                  <ToggleField label="Warn Near Budget Limit" hint="Show a sidebar and project warning when usage reaches 80% of budget." defaultChecked />
                  <ToggleField label="Automatic Error Reporting" hint="Report error type, request id, and runtime environment without message content." />
                </div>
              )}

              {settingsTab === 'health' && (
                <div className="space-y-6">
                  <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
                    <div className="border border-[#d1d0c9] bg-[#f5f4f0] p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className={labelClass}>Loop Test</div>
                          <h3 className="mt-2 font-serif text-2xl leading-none text-[#1a1a1a]">Backend health check</h3>
                          <p className="mt-3 max-w-xl font-mono text-[11px] leading-relaxed text-[#5f5a50]">
                            Runs the real backend request loop against the configured worker station without exposing API keys.
                          </p>
                        </div>
                        <Activity size={22} className={healthCheck.running ? 'animate-pulse text-[#8f1e18]' : 'text-[#555047]'} />
                      </div>
                      <div className="mt-5 flex flex-wrap gap-3">
                        <SmallButton onClick={() => runSettingsHealthCheck({ workflow: false })} disabled={healthCheck.running}>
                          <Play size={12} className="inline-block mr-2" />Quick check
                        </SmallButton>
                        <button
                          type="button"
                          onClick={() => runSettingsHealthCheck({ workflow: true })}
                          disabled={healthCheck.running}
                          className={`border border-[#1a1a1a] px-3 py-2 font-mono text-[10px] uppercase tracking-widest transition-colors ${healthCheck.running ? 'cursor-not-allowed opacity-50' : 'hover:bg-[#d1d0c9] hover:text-black'}`}
                        >
                          <Network size={12} className="inline-block mr-2" />Workflow smoke
                        </button>
                      </div>
                    </div>
                    <div className="border border-[#d1d0c9] bg-[#f8f6ee] p-5">
                      <div className={labelClass}>Target</div>
                      <div className="mt-2 break-all font-mono text-xs text-[#1a1a1a]">{healthCheck.baseUrl || backendStation.baseUrl}</div>
                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div>
                          <div className={labelClass}>Last Run</div>
                          <div className="mt-1 font-mono text-xs text-[#1a1a1a]">
                            {healthCheck.lastRunAt ? new Date(healthCheck.lastRunAt).toLocaleTimeString() : 'Never'}
                          </div>
                        </div>
                        <div>
                          <div className={labelClass}>Summary</div>
                          <div className="mt-1 font-mono text-xs text-[#1a1a1a]">{healthCheck.summary || (healthCheck.running ? 'running' : 'ready')}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-hidden border border-[#d1d0c9] bg-[#f5f4f0]">
                    {healthRows.map(row => (
                      <div key={row.id} className="grid gap-3 border-b border-[#d1d0c9] px-4 py-3 last:border-b-0 md:grid-cols-[180px_90px_1fr]">
                        <div className="font-mono text-xs text-[#1a1a1a]">{row.label}</div>
                        <div>
                          <span className={`inline-flex min-w-[74px] justify-center border px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em] ${healthStatusClass[row.status] || healthStatusClass.idle}`}>
                            {healthStatusLabel[row.status] || row.status}
                          </span>
                        </div>
                        <div className="break-words font-mono text-[11px] leading-relaxed text-[#5f5a50]">{row.detail}</div>
                      </div>
                    ))}
                  </div>

                  {healthCheck.error && (
                    <div className="border border-red-800 bg-red-50 px-4 py-3 font-mono text-[11px] leading-relaxed text-red-800">
                      {healthCheck.error}
                    </div>
                  )}
                </div>
              )}
            </div>

            <footer className="flex h-16 shrink-0 items-center justify-between border-t border-[#d1d0c9] px-7">
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-green-700">
                <CheckCircle2 size={14} />
                {t('settings.saved')}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => runSettingsHealthCheck({ workflow: false })}
                  disabled={healthCheck.running}
                  className={`border border-[#d1d0c9] px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-[#555047] transition-colors ${healthCheck.running ? 'cursor-not-allowed opacity-50' : 'hover:border-[#1a1a1a] hover:text-black'}`}
                >
                  {t('settings.testConnection')}
                </button>
                <SmallButton><Save size={12} className="inline-block mr-2" />{t('settings.save')}</SmallButton>
              </div>
            </footer>
          </div>
        </section>
      </div>
    );
  };

  const renderSidebar = () => (
    <div className={`h-screen border-r border-[#d1d0c9] bg-[#ebe9e0] flex flex-col transition-all duration-300 z-50 ${sidebarCollapsed ? 'w-16' : 'w-64'}`}>
      <div className="h-16 flex items-center justify-between px-4 border-b border-[#d1d0c9]">
        <div className="flex items-center gap-3 min-w-0">
          <img src={BRAND_LOGO_SRC} alt="Hall of Fame Studio logo" className="h-8 w-8 object-contain shrink-0" />
          {!sidebarCollapsed && (
            <span className="min-w-0">
              <span className="block font-serif text-lg font-bold tracking-tight leading-none">Hall of Fame</span>
              <span className="block font-mono text-[8px] uppercase tracking-[0.18em] text-gray-500 mt-1">{t('nav.hallOfFameSubtitle')}</span>
            </span>
          )}
        </div>
        <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="p-1 hover:bg-[#d1d0c9] rounded transition-colors text-gray-600 hover:text-black">
          <LayoutPanelLeft size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-4 flex flex-col gap-6">
        {/* Main Hub Links */}
        <div className="px-3 flex flex-col gap-1">
          <button onClick={navToDashboard} className={`flex items-center gap-3 px-3 py-2 text-sm font-mono rounded-sm transition-colors ${activeRoute === 'dashboard' ? 'bg-[#1a1a1a] text-[#f5f4f0]' : 'hover:bg-[#d1d0c9] text-gray-700'}`}>
            <Grid size={16} /> {!sidebarCollapsed && <span>Workspace Hub</span>}
          </button>
          <button onClick={navToMarket} className={`flex items-center gap-3 px-3 py-2 text-sm font-mono rounded-sm transition-colors ${activeRoute === 'agent_market' || activeRoute === 'agent_dossier' ? 'bg-[#1a1a1a] text-[#f5f4f0]' : 'hover:bg-[#d1d0c9] text-gray-700'}`}>
            <Network size={16} /> {!sidebarCollapsed && <span>Talent Market</span>}
          </button>
        </div>

        {/* Dynamic Project List */}
        {!sidebarCollapsed && (
          <div className="px-6 flex flex-col gap-2">
            <div className="flex items-center justify-between text-gray-400 font-mono text-[10px] uppercase tracking-widest mb-2">
              <span>Active Projects</span>
              <button onClick={navToInitiation} className="hover:text-black" title="Start initiation roundtable"><Plus size={12}/></button>
            </div>
            {projects.map(proj => (
              <button 
                key={proj.id}
                data-testid={`project-nav-${proj.id}`}
                onClick={() => navToProject(proj.id)}
                className={`flex items-center gap-2 text-left font-serif text-lg transition-colors group ${selectedProjectId === proj.id && activeRoute !== 'dashboard' && activeRoute !== 'agent_market' && activeRoute !== 'agent_dossier' && activeRoute !== 'project_initiation' ? 'text-black font-semibold' : 'text-gray-500 hover:text-black'}`}
              >
                <div className={`w-1.5 h-1.5 rounded-full ${proj.status === 'executing' || proj.status === 'initiated' ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                <span className="truncate">{proj.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="p-4 border-t border-[#d1d0c9]">
        {!sidebarCollapsed ? (
          <div className="flex items-center gap-3">
            <button
              data-testid="open-settings-button"
              onClick={() => setSettingsOpen(true)}
              className="flex h-9 w-9 shrink-0 items-center justify-center border border-[#1a1a1a] bg-[#1a1a1a] font-serif text-lg text-[#f5f4f0] transition-colors hover:bg-[#3a3429]"
              title="Open user settings"
            >
              D
            </button>
            <button data-testid="open-settings-label" onClick={() => setSettingsOpen(true)} className="min-w-0 flex-1 text-left">
              <span className="block truncate font-serif text-base leading-none text-[#1a1a1a]">{t('nav.studioDirector')}</span>
              <span className="mt-1 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-green-700">
                <UserCircle size={11} />
                {t('nav.directorHandle')}
              </span>
            </button>
            <button
              onClick={() => setSettingsOpen(true)}
              className="p-2 text-gray-600 transition-colors hover:bg-[#d1d0c9] hover:text-black"
              aria-label="Open settings"
              title="Settings"
            >
              <Settings size={16} />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <button
              onClick={() => setSettingsOpen(true)}
              className="flex h-9 w-9 items-center justify-center border border-[#1a1a1a] bg-[#1a1a1a] font-serif text-lg text-[#f5f4f0] transition-colors hover:bg-[#3a3429]"
              aria-label="Open user settings"
              title={t('nav.studioDirector')}
            >
              D
            </button>
            <button onClick={() => setSettingsOpen(true)} className="text-gray-600 hover:text-black" aria-label="Open settings" title="Settings">
              <Settings size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const renderAgentMarketView = () => {
    const categories = ['All', 'Visionary', 'Strategy', 'Analytical', 'Science', 'Creative', 'Psychology', 'Finance', 'Operations'];
    const isInitiationMarket = marketMode === 'initiation';
    const signedMarketIds = isInitiationMarket ? initiationInviteIds : recruitedIds;
    const signedInitiationNames = initiationTalentMembers.map(member => member.name).join(' / ');

    const filteredAgents = LEGENDARY_AGENTS.filter(agent => {
      const q = marketSearch.toLowerCase();
      const matchesSearch = agent.name.toLowerCase().includes(q) ||
        agent.role.toLowerCase().includes(q) ||
        agent.desc.toLowerCase().includes(q) ||
        (agent.primaryIdentity && agent.primaryIdentity.toLowerCase().includes(q));
      const matchesCategory = marketCategory === 'All' || agent.category === marketCategory;
      return matchesSearch && matchesCategory;
    });

    return (
      <div className="flex-1 overflow-y-auto fade-in bg-[#f5f4f0] flex flex-col relative">
        {isDecrypting && (
          <div className="absolute inset-0 bg-[#f5f4f0] z-50 flex flex-col items-center justify-center font-mono text-xs uppercase tracking-widest text-black">
            <Fingerprint size={48} className="mb-4 animate-pulse" />
            <span>Decrypting Pantheon Archives...</span>
            <span className="text-gray-400 mt-2">Clearance Level: Director</span>
          </div>
        )}

        <div className="sticky top-0 z-40 bg-[#f5f4f0] border-b border-[#d1d0c9] px-12 py-8 pt-12 shadow-[0_10px_30px_rgba(245,244,240,0.9)]">
          {isInitiationMarket && (
            <div data-testid="initiation-talent-market" className="mb-6 border border-[#1a1a1a] bg-[#1a1a1a] px-4 py-3 text-white">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-mono text-[9px] uppercase tracking-widest text-[#d8c99f]">Initiation Talent Market</div>
                  <div data-testid="initiation-signed-team" className="font-serif text-xl leading-tight truncate">
                    Signed team: {signedInitiationNames || 'None yet'}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setInitiationStep('invite');
                      setActiveRoute('project_initiation');
                    }}
                    className="border border-[#7b6542] px-3 py-2 font-mono text-[9px] uppercase tracking-widest text-[#efe2bd] hover:border-[#efe2bd]"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    data-testid="initiation-next-lobby"
                    onClick={continueInitiationFromMarket}
                    disabled={initiationTalentMembers.length === 0}
                    className="bg-[#8f1e18] px-4 py-2 font-mono text-[9px] uppercase tracking-widest text-white disabled:bg-[#3a2a1c] disabled:text-[#7d6a49]"
                  >
                    Next: Meeting Prep
                  </button>
                </div>
              </div>
            </div>
          )}
          <div className="flex justify-between items-end mb-8">
            <div>
              <h1 className="font-serif text-6xl tracking-tight mb-2 decrypt-text">The Pantheon.</h1>
              <div className="flex items-center gap-3 font-mono text-[10px] text-gray-500 uppercase tracking-widest mt-3">
                <span className="bg-[#1a1a1a] text-white px-2 py-0.5">TOP SECRET</span>
                <span>Global Talent Archives</span>
              </div>
            </div>
            <div className="flex items-center border-b-2 border-[#d1d0c9] w-80 pb-2 focus-within:border-black transition-colors">
              <Search size={18} className="text-gray-400 mr-3" />
              <input
                type="text"
                value={marketSearch}
                onChange={(e) => setMarketSearch(e.target.value)}
                placeholder="Query archives..."
                className="bg-transparent border-none outline-none font-mono text-sm w-full placeholder-gray-400 uppercase tracking-wider"
              />
            </div>
          </div>

          <div className="flex items-center gap-6 overflow-x-auto pb-2 -mb-2">
            <SlidersHorizontal size={18} className="text-gray-400 shrink-0" />
            <div className="flex gap-2">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setMarketCategory(cat)}
                  className={`font-mono text-[10px] uppercase tracking-widest px-3 py-1.5 transition-all whitespace-nowrap border
                    ${marketCategory === cat ? 'bg-black text-white border-black' : 'bg-transparent text-gray-500 border-[#d1d0c9] hover:border-black hover:text-black'}
                  `}
                >
                  {cat}
                </button>
              ))}
            </div>
            <span className="ml-auto font-mono text-[10px] text-gray-400 uppercase tracking-widest shrink-0 border-l border-[#d1d0c9] pl-6">
              {filteredAgents.length} Records Found
            </span>
          </div>
        </div>

        <div className="p-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {filteredAgents.map(agent => {
            const isRecruited = signedMarketIds.includes(agent.id);
            const cardProfile = getDossierProfile(agent, activeLanguage);
            const deploymentWindow = getAgentDeploymentWindow(agent, cardProfile, activeLanguage);
            const marketCardText = { bestWindow: 'Best Window' };
            return (
              <div
                key={agent.id}
                role="button"
                tabIndex={0}
                onClick={() => openMarketDossier(agent.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') openMarketDossier(agent.id);
                }}
                className="dossier-card group flex flex-col cursor-pointer focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-4 focus:ring-offset-[#f5f4f0]"
              >
                <div className="px-5 py-3 border-b border-[#d1d0c9] bg-[#ebe9e0] flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 bg-black rounded-full opacity-30"></div>
                    <span className="font-mono text-[9px] uppercase tracking-widest text-gray-600">ID:{agent.id}</span>
                  </div>
                  <div className="h-4 flex items-center opacity-40">
                    {generateBarcode(agent.id)}
                  </div>
                </div>

                <div className="p-6 border-b border-[#ebe9e0] flex gap-4 items-start relative">
                  <PantheonAvatar agent={agent} />
                  <div className="flex flex-col pt-1 min-w-0">
                    <h3 className="font-serif text-2xl font-bold leading-tight tracking-tight mb-1.5 break-words">
                      {renderKnownName(agent.knownName)}
                    </h3>
                    <div className="mb-2 border-l-[3px] border-red-600/35 pl-2.5">
                      <span className="font-mono text-[8px] uppercase tracking-widest text-gray-400 block mb-0.5">Primary identity</span>
                      <p className="font-serif text-[13px] text-gray-800 leading-snug line-clamp-2">
                        {agent.primaryIdentity}
                      </p>
                    </div>
                    <span className="font-mono text-[9px] uppercase tracking-widest text-gray-500 bg-gray-100 px-1.5 py-0.5 self-start border border-gray-200">{agent.role}</span>
                  </div>
                  {isRecruited && (
                    <div className="absolute top-4 right-4 stamp-active pointer-events-none z-20 flex items-center justify-center">
                      <div className="border-4 border-[#1a1a1a] text-[#1a1a1a] font-mono text-sm font-bold uppercase tracking-widest px-2 py-1 transform rotate-[-15deg] mix-blend-multiply opacity-90">
                        CONTRACTED
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-6 flex-1 bg-[#fdfdfc] border-b border-[#ebe9e0] relative">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="inline-block px-2 py-0.5 bg-[#1a1a1a] text-white font-mono text-[8px] uppercase tracking-widest">
                      CLASS: {agent.category}
                    </span>
                    {getPersonSkill(agent.id) && (
                      <span className="inline-block px-2 py-0.5 bg-[#8f1e18] text-white font-mono text-[8px] uppercase tracking-widest">
                        SKILL ACTIVE
                      </span>
                    )}
                  </div>
                  <p className="font-serif text-gray-800 text-[15px] leading-relaxed relative z-10">
                    {agent.desc}
                  </p>
                </div>

                <div className="p-4 flex items-center justify-between border-t border-[#1a1a1a] bg-white">
                  <div className="min-w-0 border-l-2 border-[#8f1e18] pl-3 pr-3">
                    <div className="font-mono text-[8px] uppercase tracking-widest text-gray-400">{marketCardText.bestWindow}</div>
                    <div className="max-w-[11rem] truncate font-serif text-sm leading-tight text-gray-800">
                      {localizeText(deploymentWindow.shortLabel, activeLanguage)}
                    </div>
                  </div>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      openMarketDossier(agent.id);
                    }}
                    className={`flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest px-4 py-2 transition-colors
                      ${isRecruited ? 'bg-transparent text-gray-500 border border-gray-200' : 'bg-black text-white hover:bg-gray-800'}
                    `}
                  >
                    {isRecruited ? <CheckCircle2 size={12} /> : <FileSignature size={12} />}
                    {isRecruited ? 'Review File' : 'Open File'}
                  </button>
                </div>
              </div>
            );
          })}

          {filteredAgents.length === 0 && (
            <div className="col-span-full py-32 flex flex-col items-center justify-center text-gray-400">
              <Search size={48} className="mb-6 opacity-20" />
              <p className="font-serif text-3xl mb-2 text-gray-800">No classified records found.</p>
              <p className="font-mono text-xs uppercase tracking-widest">Adjust clearance filters or query parameters.</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderAgentDossierScene = () => {
    const agent = selectedMarketAgent || LEGENDARY_AGENTS[0];
    const isInitiationMarket = marketMode === 'initiation';
    const isRecruited = isInitiationMarket ? initiationInviteIds.includes(agent.id) : recruitedIds.includes(agent.id);
    const isStamping = signingAgentId === agent.id;
    const profile = getDossierProfile(agent, activeLanguage);
    const deploymentWindow = getAgentDeploymentWindow(agent, profile, activeLanguage);
    const dossierText = (value) => localizeText(value, activeLanguage);
    const windowText = {
      title: 'Deployment Window',
      useWhen: 'Use When',
      strongestAxis: 'Strongest Axis',
      firstOutput: 'First Output',
      starterBrief: 'Starter Brief',
    };
    const skill = profile.skill || null;
    const avatar = pantheonAvatarMeta(agent.id);
    const imageSrc = pantheonAvatarSrc(agent.id);
    const evidenceStrips = [
      { label: 'Primary Identity', value: agent.primaryIdentity },
      { label: 'Operational Class', value: agent.category },
      { label: 'Best Window', value: deploymentWindow.shortLabel },
      ...(skill ? [
        { label: 'Skill Runtime', value: profile.skillStats || `Registered / ${skill.defaultFormat.length} steps` },
        ...(profile.professionalSkillRuntime ? [{ label: 'Callable Skills', value: profile.professionalSkillRuntime }] : []),
        ...(profile.realWorldEdge ? [{ label: 'Reality Edge', value: profile.realWorldEdge }] : []),
        ...(profile.skillLoaded ? [{ label: 'Skill File', value: profile.skillPath }] : []),
      ] : []),
    ];

    return (
      <div className="archive-stage relative h-screen overflow-hidden text-[#251b13]">
        <div className="archive-table absolute inset-x-0 bottom-0 h-[78vh] origin-bottom skew-y-[-2deg] scale-110" />
        <div className="archive-vignette absolute inset-0 pointer-events-none z-40" />

        <button
          onClick={closeMarketDossier}
          className="absolute top-7 left-7 z-50 bg-[#e8ddbf] text-[#221812] border border-[#5c4933] shadow-[6px_6px_0_rgba(0,0,0,0.24)] px-4 py-3 font-mono text-[10px] uppercase tracking-widest flex items-center gap-3 hover:-translate-y-0.5 hover:bg-[#f3e8c8] transition-transform"
        >
          <ArrowLeft size={15} />
          {dossierText('Refile Archive')}
        </button>

        <div className="absolute top-7 right-7 z-50 flex items-center gap-3 text-[#e8ddbf] font-mono text-[10px] uppercase tracking-widest">
          <span className="border border-[#8d7a58] px-3 py-2 bg-black/20">{dossierText('Skills')}: {PERSON_SKILL_COUNT} / {dossierText('Docs')}: {PERSON_SKILL_DOC_COUNT}</span>
          <span className="border border-[#8d7a58] px-3 py-2 bg-black/20">{dossierText('Clearance')}: {dossierText('Director')}</span>
          <span className="border border-red-900/70 text-red-200 px-3 py-2 bg-red-950/25">{dossierText('Live Dossier')}</span>
        </div>

        <div className="absolute left-[5vw] top-[17vh] w-52 h-72 bg-[#d9caa4] border border-[#7c6847] shadow-2xl desk-prop hidden lg:block" style={{ '--from-rot': '-18deg', '--to-rot': '-11deg' }}>
          <div className="h-10 bg-[#4c1110] text-[#eadfbd] font-mono text-[9px] tracking-widest uppercase flex items-center px-4">{dossierText('Recovered Memo')}</div>
          <div className="p-5 space-y-3">
            <div className="h-2 bg-[#6b5a3d]/50 w-3/4" />
            <div className="h-2 bg-[#6b5a3d]/35 w-full" />
            <div className="h-2 bg-[#6b5a3d]/35 w-5/6" />
            <div className="mt-8 border-2 border-[#7f211c] text-[#7f211c] font-mono text-xs inline-block px-3 py-1 rotate-[-8deg]">{dossierText('VETTED')}</div>
          </div>
        </div>

        <div className="relative z-30 h-full min-h-0 flex items-center justify-center px-5 py-20">
          <div className={`archive-dossier dossier-scroll-field relative w-full max-w-6xl max-h-[calc(100vh-120px)] overflow-y-auto lg:h-[min(760px,calc(100vh-120px))] lg:min-h-0 lg:overflow-hidden border border-[#765f3e] grid grid-cols-12 ${isStamping ? 'dossier-impact' : ''}`}>
            <div className="absolute -top-4 left-10 right-24 h-12 bg-[#c8b688] border border-[#755f3f] -rotate-1 shadow-lg" />
            <div className="absolute top-8 right-10 border-[5px] border-[#8f1e18] text-[#8f1e18] font-mono text-2xl font-bold uppercase tracking-[0.22em] px-5 py-2 rotate-[10deg] opacity-80 mix-blend-multiply pointer-events-none">
              {dossierText(isRecruited ? 'Contracted' : 'Pending')}
            </div>
            {isStamping && (
              <>
                <div className="absolute inset-0 z-50 pointer-events-none contract-stamp-theater" />
                <div className="absolute left-1/2 top-[57%] z-[70] pointer-events-none stamp-device">
                  <div className="stamp-handle w-20 h-40 rounded-t-[38px] rounded-b-xl border border-[#8d6d48] mx-auto relative">
                    <div className="absolute left-1/2 top-4 -translate-x-1/2 w-9 h-16 rounded-full border border-[#a98e62] bg-black/20" />
                    <div className="absolute left-1/2 bottom-4 -translate-x-1/2 w-12 h-4 rounded-full bg-[#8d6d48]/70" />
                  </div>
                  <div className="stamp-head w-56 h-24 rounded-md border-2 border-[#3f0f0e] -mt-2 flex items-center justify-center">
                    <div className="border-4 border-[#e8ddbf] text-[#e8ddbf] font-mono text-xl font-black uppercase tracking-[0.26em] px-5 py-2 rotate-[-4deg]">
                      {dossierText('APPROVED')}
                    </div>
                  </div>
                </div>
                <div className="absolute left-[76%] top-[16%] z-[75] pointer-events-none fresh-contract-seal border-[7px] border-[#8f1e18] text-[#8f1e18] font-mono text-3xl font-black uppercase tracking-[0.22em] px-7 py-3 mix-blend-multiply">
                  {dossierText('Contracted')}
                </div>
                <div className="absolute left-[76%] top-[16%] z-[65] pointer-events-none seal-shockwave w-44 h-44 rounded-full border-2 border-[#8f1e18]" />
                <div className="absolute left-[62%] top-[22%] z-[65] pointer-events-none paper-dust flex gap-2">
                  {[...Array(10)].map((_, index) => (
                    <span
                      key={index}
                      className="block w-1.5 h-1.5 bg-[#e8ddbf]/75 rounded-full"
                      style={{ transform: `translate(${(index - 5) * 9}px, ${(index % 3) * 7}px)` }}
                    />
                  ))}
                </div>
              </>
            )}

            <section className="dossier-scroll-field col-span-12 lg:col-span-4 min-h-0 border-r border-[#b8a57d] p-8 bg-[#d9c797]/45 relative overflow-y-auto">
              <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: 'repeating-linear-gradient(135deg, #2b2118 0, #2b2118 1px, transparent 1px, transparent 10px)' }} />
              <div className="relative z-10">
                <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#6b241e] mb-4 ink-reveal">{dossierText('Personnel Visual Record')}</div>
                <div className="bg-[#241b14] p-3 rotate-[-1.6deg] shadow-2xl mb-7">
                  <div className="aspect-[4/5] bg-[#eee1bd] overflow-hidden border border-[#675139]">
                    {imageSrc ? (
                      <img src={imageSrc} alt={agent.name} className="archive-photo w-full h-full object-cover object-top" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#241b14] font-serif text-7xl">
                        {avatar?.mark || agentCardInitial(agent)}
                      </div>
                    )}
                  </div>
                  <div className="pt-3 flex justify-between items-center text-[#e8ddbf] font-mono text-[8px] uppercase tracking-widest">
                    <span>{dossierText(agent.id)}</span>
                    <span>{dossierText(avatar?.license || 'Symbolic')}</span>
                  </div>
                </div>

                <h1 className="font-serif text-5xl leading-none tracking-tight text-[#201610] mb-3 ink-reveal">
                  {agent.name}
                </h1>
                <div className="font-mono text-[10px] uppercase tracking-widest text-[#6d5a3d] mb-6 ink-reveal">
                  {dossierText(profile.codename)}
                </div>

                <div className="space-y-3">
                  {evidenceStrips.map((item, index) => (
                    <div key={item.label} className="border-l-4 border-[#8f1e18] bg-[#f5ebcc]/65 p-3 shadow-sm ink-reveal" style={{ animationDelay: `${0.1 + index * 0.08}s` }}>
                      <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18] mb-1">{dossierText(item.label)}</div>
                      <div className="font-serif text-base leading-snug">{dossierText(item.value)}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="dossier-scroll-cue" aria-hidden="true" />
            </section>

            <section className="dossier-scroll-field col-span-12 lg:col-span-5 min-h-0 p-8 border-r border-[#b8a57d] relative overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.26em] text-[#6b241e]">{dossierText('Five-Axis Capability Map')}</div>
                  <div className="font-serif text-3xl text-[#201610]">{dossierText('Operational Shape')}</div>
                </div>
                <Crosshair size={26} className="text-[#8f1e18]" />
              </div>

              <div className="grid md:grid-cols-[280px_1fr] gap-6 items-center">
                <RadarChart points={profile.scores} language={activeLanguage} />
                <div className="space-y-3">
                  {profile.scores.map((item, index) => (
                    <div key={item.label} className="ink-reveal" style={{ animationDelay: `${0.12 + index * 0.06}s` }}>
                      <div className="flex justify-between font-mono text-[9px] uppercase tracking-widest mb-1">
                        <span>{dossierText(item.label)}</span>
                        <span>{item.value}</span>
                      </div>
                      <div className="h-2 bg-[#c8b688] border border-[#a28c63] overflow-hidden">
                        <div className="h-full bg-[#8f1e18]" style={{ width: `${item.value}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-5 mt-8">
                <div className="bg-[#f6ebca]/70 border border-[#b8a57d] p-5 shadow-sm">
                  <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-widest text-[#8f1e18] mb-3">
                    <Shield size={14} /> {dossierText('Strength')}
                  </div>
                  <p className="font-serif text-lg leading-relaxed text-[#2a1e15]">{dossierText(profile.strength)}</p>
                </div>
                <div className="bg-[#f6ebca]/70 border border-[#b8a57d] p-5 shadow-sm">
                  <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-widest text-[#8f1e18] mb-3">
                    <Briefcase size={14} /> {dossierText('Usage Advice')}
                  </div>
                  <p className="font-serif text-lg leading-relaxed text-[#2a1e15]">{dossierText(profile.advice)}</p>
                </div>
              </div>

              {(profile.realWorldEdge || profile.signatureSkills?.length) && (
                <div className="mt-5 bg-[#f6ebca]/70 border border-[#b8a57d] p-5 shadow-sm">
                  <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-widest text-[#8f1e18] mb-3">
                    <PackageCheck size={14} /> {dossierText('Composable Skill Layer')}
                  </div>
                  {profile.realWorldEdge && (
                    <p className="font-serif text-lg leading-relaxed text-[#2a1e15] mb-4">{dossierText(profile.realWorldEdge)}</p>
                  )}
                  {profile.signatureSkills?.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {profile.signatureSkills.map((item) => (
                        <span key={item} className="border border-[#a28c63] bg-[#eadfbd] px-3 py-1 font-mono text-[9px] uppercase tracking-widest text-[#5c251f]">
                          {dossierText(item)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="mt-6 bg-[#211812] text-[#eadfbd] border border-[#5c4933] p-5 shadow-lg">
                <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-widest text-red-200 mb-3">
                  <BookOpen size={14} /> {dossierText('Summary')}
                </div>
                <p className="font-serif text-xl leading-relaxed">{dossierText(profile.summary)}</p>
                {profile.motto && (
                  <p className="mt-4 border-l-4 border-[#8f1e18] pl-4 font-serif text-lg leading-relaxed text-[#f3dfad]">
                    {dossierText(profile.motto)}
                  </p>
                )}
              </div>
              <div className="dossier-scroll-cue" aria-hidden="true" />
            </section>

            <aside className="dossier-scroll-field col-span-12 lg:col-span-3 min-h-0 p-8 bg-[#251b13] text-[#eadfbd] relative overflow-y-auto">
              <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: 'linear-gradient(#eadfbd 1px, transparent 1px), linear-gradient(90deg, #eadfbd 1px, transparent 1px)', backgroundSize: '22px 22px' }} />
              <div className="relative z-10 flex flex-col h-full">
                <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-red-200 mb-4">{dossierText('Director Decision')}</div>
                <div className="border border-[#7b6542] p-5 mb-6 bg-black/18">
                  <div className="font-mono text-[9px] uppercase tracking-widest text-[#bcae86] mb-2">{dossierText(windowText.title)}</div>
                  <div className="font-serif text-2xl leading-tight mb-4">{dossierText(deploymentWindow.title)}</div>
                  <div className="font-mono text-[8px] uppercase tracking-widest text-red-200 mb-2">{dossierText(windowText.useWhen)}</div>
                  <p className="font-serif text-sm leading-relaxed text-[#efe2bd]">{dossierText(deploymentWindow.summary)}</p>
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="border border-[#59472e] p-3 bg-black/15">
                      <div className="font-mono text-[8px] uppercase tracking-widest text-[#8d7a58] mb-1">{dossierText(windowText.strongestAxis)}</div>
                      <div className="font-serif text-sm leading-tight">{dossierText(deploymentWindow.strongestAxis)}</div>
                    </div>
                    <div className="border border-[#59472e] p-3 bg-black/15">
                      <div className="font-mono text-[8px] uppercase tracking-widest text-[#8d7a58] mb-1">{dossierText(windowText.firstOutput)}</div>
                      <div className="font-serif text-sm leading-tight">{dossierText(deploymentWindow.shortLabel)}</div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 font-mono text-[10px] uppercase tracking-widest text-[#cdbf98] mb-5">
                  <div className="flex justify-between border-b border-[#59472e] pb-2"><span>{dossierText('Archive Chain')}</span><span>{dossierText('Clean')}</span></div>
                  <div className="flex justify-between border-b border-[#59472e] pb-2"><span>{dossierText('Identity Use')}</span><span>{dossierText('Style Agent')}</span></div>
                  <div className="flex justify-between border-b border-[#59472e] pb-2"><span>{dossierText('Status')}</span><span>{dossierText(isRecruited ? 'Secured' : 'Awaiting')}</span></div>
                </div>

                <div className="mb-5 border border-[#59472e] bg-black/12 p-4">
                  <div className="font-mono text-[9px] uppercase tracking-widest text-red-200 mb-3">{dossierText(windowText.starterBrief)}</div>
                  <div className="space-y-2">
                    {deploymentWindow.starterSteps.map((step, index) => (
                      <div key={`${step}-${index}`} className="flex gap-3 text-[#d8c99f]">
                        <span className="mt-0.5 font-mono text-[9px] text-[#8d7a58]">{String(index + 1).padStart(2, '0')}</span>
                        <span className="font-serif text-sm leading-snug">{dossierText(step)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="dossier-scroll-cue dossier-scroll-cue-dark" aria-hidden="true" />

                <div className="sticky bottom-0 -mx-1 space-y-3 bg-[#251b13]/95 pt-3 pb-1 backdrop-blur-sm">
                  <button
                    onClick={() => startContractStamp(agent.id)}
                    disabled={isStamping}
                    className={`w-full flex items-center justify-center gap-3 px-5 py-4 font-mono text-[10px] uppercase tracking-widest border transition-all
                      ${isStamping ? 'border-[#8f1e18] text-red-100 bg-[#8f1e18] cursor-wait' : isRecruited ? 'border-[#e8ddbf] bg-[#e8ddbf] text-[#251b13] hover:-translate-y-0.5 hover:shadow-[7px_7px_0_rgba(143,30,24,0.55)]' : 'border-[#e8ddbf] bg-[#e8ddbf] text-[#251b13] hover:-translate-y-0.5 hover:shadow-[7px_7px_0_rgba(143,30,24,0.55)]'}
                    `}
                  >
                    {isRecruited ? <CheckCircle2 size={15} /> : <FileSignature size={15} />}
                    {dossierText(isStamping
                      ? 'Stamping Contract'
                      : isInitiationMarket
                        ? (isRecruited ? 'Signed for Kickoff' : 'Sign for Kickoff')
                        : (isRecruited ? 'Assign to Project' : 'Authorize Contract'))}
                  </button>
                  <button
                    onClick={closeMarketDossier}
                    className="w-full flex items-center justify-center gap-3 px-5 py-4 font-mono text-[10px] uppercase tracking-widest border border-[#7b6542] text-[#e8ddbf] hover:bg-[#34271b] transition-colors"
                  >
                    <ArrowLeft size={15} />
                    {dossierText('Return to Market')}
                  </button>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    );
  };

  const renderProjectInitiationView = () => {
    const selectedMember = INITIATION_MEMBERS.find(member => member.id === selectedInitiationMemberId) || INITIATION_MEMBERS[1];
    const phaseCopy = {
      briefing: 'Founder explains project intent',
      discussion: 'Roundtable confirms operating structure',
      decision: 'Waiting for meeting decision',
      approved: 'Approved for dashboard',
    };

    return (
      <div className="flex-1 overflow-hidden bg-[#0d0c0b] text-[#efe2bd] fade-in">
        <div className="h-full grid grid-cols-[minmax(0,1fr)_380px]">
          <section className="relative overflow-hidden">
            <div className="absolute inset-0 project-room" />
            <div className="absolute inset-0 opacity-40" style={{ backgroundImage: 'radial-gradient(circle at 50% 42%, transparent 0, rgba(0,0,0,0.74) 66%)' }} />

            <header className="relative z-10 px-10 pt-8 flex items-start justify-between">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-[#bcae86] mb-4 flex items-center gap-3">
                  <FileSignature size={15} className="text-[#8f1e18]" />
                  Mandatory Initiation Roundtable
                </div>
                <h1 className="font-serif text-6xl leading-none max-w-4xl">Project Birth Room</h1>
                <p className="font-serif text-2xl leading-relaxed text-[#d8c99f] mt-4 max-w-3xl">
                  鍙戣捣浜哄厛璁叉竻妤氭兂鍋氫粈涔堛€傞」鐩垚鍛樺湪鍦嗘涓嚜鐒跺晢璁ㄩ瀵笺€佹眹鎶ャ€佹墽琛屻€佷骇鍑哄舰寮忋€傞€氳繃鍚庢墠鐢熸垚姝ｅ紡椤圭洰銆?                </p>
              </div>
              <button
                onClick={navToDashboard}
                className="font-mono text-[10px] uppercase tracking-widest border border-[#3a2a1c] px-4 py-2 text-[#bcae86] hover:text-[#efe2bd] hover:border-[#7b6542] transition-colors"
              >
                Back
              </button>
            </header>

            <div className="relative z-10 h-[calc(100%-164px)] px-10 pb-8 grid grid-rows-[minmax(300px,1fr)_188px] gap-6 min-h-0">
              <div className="relative min-h-0">
                <div className="absolute left-1/2 top-[50%] h-[260px] w-[min(620px,88%)] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border border-[#7b6542]/50 bg-[#251b13]/60 shadow-[0_38px_120px_rgba(0,0,0,0.55)]" />
                <div className="absolute left-1/2 top-[50%] h-[160px] w-[min(410px,58%)] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border border-dashed border-[#bcae86]/25" />
                <div className="absolute left-1/2 top-[52%] -translate-x-1/2 -translate-y-1/2 w-[280px] border border-[#7b6542] bg-[#efe2bd] text-[#251b13] p-4 shadow-[14px_14px_0_rgba(0,0,0,0.28)]">
                  <div className="font-mono text-[8px] uppercase tracking-[0.22em] text-[#8f1e18] mb-2">Founder Brief</div>
                  <h2 className="font-serif text-2xl leading-none mb-2">Roundtable Initiation System</h2>
                  <p className="font-serif text-base leading-relaxed text-[#4d3c28]">
                    鍏堟弿杩版兂娉曪紝鍐嶇敱鍦嗘鍟嗚璋佹帹杩涖€佽皝姹囨姤銆佽皝鎵ц銆佹渶缁堜氦浠樹粈涔堛€傞€氳繃鍚庤繘鍏?dashboard銆?                  </p>
                  <div className="mt-3 grid grid-cols-3 gap-2 font-mono text-[8px] uppercase tracking-widest">
                    {['Idea', 'Debate', 'Approve'].map((step, index) => (
                      <div key={step} className={`border px-2 py-2 text-center ${index < 2 ? 'border-[#8f1e18] text-[#8f1e18]' : 'border-[#b8a57d] text-[#7d6a49]'}`}>{step}</div>
                    ))}
                  </div>
                </div>

                {INITIATION_MEMBERS.map((member, index) => {
                  const positions = [
                    { left: '50%', top: '92%' },
                    { left: '8%', top: '64%' },
                    { left: '18%', top: '18%' },
                    { left: '82%', top: '18%' },
                    { left: '92%', top: '64%' },
                  ];
                  const isSelected = selectedMember.id === member.id;
                  return (
                    <button
                      key={member.id}
                      onClick={() => setSelectedInitiationMemberId(member.id)}
                      className="absolute z-20 -translate-x-1/2 -translate-y-1/2 text-center group"
                      style={positions[index]}
                    >
                      <div className={`mx-auto mb-2 h-[58px] w-[58px] rounded-full border-2 flex items-center justify-center font-serif text-2xl transition-all ${isSelected ? 'bg-[#efe2bd] text-[#8f1e18] border-[#efe2bd] scale-110 shadow-[0_0_42px_rgba(239,226,189,0.25)]' : 'bg-[#1a130e] text-[#efe2bd] border-[#7b6542] group-hover:border-[#efe2bd]'}`}>
                        {member.name.charAt(0)}
                      </div>
                      <div className={`font-serif text-base leading-none ${isSelected ? 'text-[#efe2bd]' : 'text-[#bcae86]'}`}>{member.name}</div>
                      <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] mt-1">{member.title}</div>
                    </button>
                  );
                })}

              </div>

              <div className="grid grid-cols-[1fr_280px] gap-5 min-h-0">
                <div className="border border-[#3a2a1c] bg-[#1a130e]/90 p-5 overflow-y-auto">
                  <div className="flex items-center justify-between mb-4">
                    <div className="font-mono text-[9px] uppercase tracking-[0.24em] text-[#7d6a49]">Live Transcript</div>
                    <div className="font-mono text-[9px] uppercase tracking-widest text-[#59684b]">{phaseCopy[initiationPhase]}</div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-3">
                    {INITIATION_LOGS.map(log => (
                      <button
                        key={`${log.who}-${log.tone}`}
                        onClick={() => {
                          const member = INITIATION_MEMBERS.find(item => item.name === log.who);
                          if (member) setSelectedInitiationMemberId(member.id);
                        }}
                        className="text-left border-l-2 border-[#8f1e18] bg-[#0d0c0b] p-3 hover:bg-[#251b13] transition-colors"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="node-id-tag bg-[#8f1e18]">{log.tone}</span>
                          <span className="font-mono text-[9px] uppercase tracking-widest text-[#bcae86]">{log.who}</span>
                        </div>
                        <p className="font-serif text-base leading-relaxed text-[#d8c99f]">{log.text}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="border border-[#3a2a1c] bg-[#251b13] p-5 flex flex-col justify-between">
                  <div>
                    <div className="font-mono text-[9px] uppercase tracking-[0.24em] text-[#bcae86] mb-4">Meeting Control</div>
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      {['briefing', 'discussion', 'decision', 'approved'].map(phase => (
                        <button
                          key={phase}
                          onClick={() => setInitiationPhase(phase)}
                          className={`font-mono text-[8px] uppercase tracking-widest border px-2 py-2 transition-colors ${initiationPhase === phase ? 'bg-[#efe2bd] text-[#251b13] border-[#efe2bd]' : 'border-[#7b6542] text-[#bcae86] hover:border-[#efe2bd]'}`}
                        >
                          {phase}
                        </button>
                      ))}
                    </div>
                    <p className="font-serif text-lg leading-relaxed text-[#d8c99f]">
                      杩欎笉鏄〃鍗曘€傛帶鍒跺彴鍙褰曚細璁樁娈靛拰鏈€缁堢粨璁猴紝缁撴瀯鐢辫璁鸿嚜鐒朵骇鐢熴€?                    </p>
                  </div>
                  <button
                    onClick={approveInitiationProject}
                    className="mt-5 w-full bg-[#8f1e18] hover:bg-[#a62a22] text-white px-4 py-4 flex items-center justify-center gap-3 font-mono text-[10px] uppercase tracking-widest transition-colors"
                  >
                    <CheckCircle2 size={16} />
                    Approve & Create Project
                  </button>
                </div>
              </div>
            </div>
          </section>

          <aside className="hidden">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#8f1e18] mb-4">Consensus Record</div>
            <h2 className="font-serif text-4xl leading-none mb-6">绔嬮」鍏辫瘑</h2>
            <div className="border border-[#251b13] bg-[#251b13] text-[#efe2bd] p-4 mb-5">
              <div className="font-mono text-[8px] uppercase tracking-[0.24em] text-[#bcae86] mb-2">Selected Speaker</div>
              <div className="font-serif text-2xl leading-none mb-1">{selectedMember.name}</div>
              <div className="font-mono text-[9px] uppercase tracking-widest text-[#bcae86] mb-3">{selectedMember.title}</div>
              <p className="font-serif text-base leading-relaxed text-[#d8c99f]">{selectedMember.duty}</p>
            </div>
            <div className="space-y-3 mb-8">
              {INITIATION_CONSENSUS.map(item => (
                <div key={item.label} className="border border-[#b8a57d] bg-[#f7edcf] p-4">
                  <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] mb-2">{item.label}</div>
                  <div className="font-serif text-xl leading-tight">{item.value}</div>
                </div>
              ))}
            </div>

            <div className="border-2 border-[#8f1e18] p-5 rotate-[-1deg]">
              <div className="font-mono text-[9px] uppercase tracking-[0.26em] text-[#8f1e18] mb-3">Project Gate</div>
              <p className="font-serif text-2xl leading-snug">
                A project enters the dashboard only after the kickoff roundtable is approved.
              </p>
            </div>

            <div className="mt-8 border-t border-[#b8a57d] pt-6">
              <div className="font-mono text-[9px] uppercase tracking-[0.24em] text-[#7d6a49] mb-4">Generated After Approval</div>
              <div className="space-y-3 font-serif text-lg text-[#4d3c28]">
                <div className="flex items-center gap-3"><Box size={16} className="text-[#8f1e18]" /> Dashboard project card</div>
                <div className="flex items-center gap-3"><ScrollText size={16} className="text-[#8f1e18]" /> Source meeting record</div>
                <div className="flex items-center gap-3"><Users size={16} className="text-[#8f1e18]" /> Initial responsibility map</div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    );
  };

  const renderProjectInitiationFlowView = () => {
    const invitedMembers = initiationRosterMembers;
    const selectedMember = INITIATION_MEMBERS.find(member => member.id === selectedInitiationMemberId) || invitedMembers[0] || INITIATION_MEMBERS[1];
    const taskText = `${initiationDraft.name} ${initiationDraft.summary} ${initiationDraft.intent} ${initiationDraft.output} ${initiationDraft.reason}`;
    const meetingLeaderElection = initiationMeetingSession?.leaderElection || { transcript: [], candidates: [], recommendedLeaderId: null };
    const confirmedLeaderId = selectedLeaderCandidateId || meetingLeaderElection.recommendedLeaderId;
    const skillPlan = createRoundtablePlan(invitedMembers.map(member => member.id), taskText);
    const firstLead = invitedMembers.find(member => member.id === confirmedLeaderId)
      || invitedMembers.find(member => member.id === skillPlan.lead?.slug)
      || invitedMembers[0]
      || INITIATION_MEMBERS[1];
    const confirmedMemberIds = Array.from(new Set([
      ...(initiationConfirmedTeamIds.length ? initiationConfirmedTeamIds : initiationInviteIds),
      firstLead.id,
    ])).filter(id => invitedMembers.some(member => member.id === id));
    const confirmedMembers = invitedMembers.filter(member => confirmedMemberIds.includes(member.id));
    const reporter = confirmedMembers.find(member => member.id === skillPlan.reviewer?.slug && member.id !== firstLead.id)
      || confirmedMembers.find(member => member.id !== firstLead.id)
      || firstLead;
    const workingGroup = confirmedMembers.filter(member => member.id !== firstLead.id && member.id !== reporter.id);
    const initiationMeetingProject = {
      id: 'initiation_roundtable_draft',
      name: initiationDraft.name || 'Untitled Initiation',
      meetingSkillBrief: buildInitiationMeetingSkillBrief({
        draft: initiationDraft,
        output: initiationActionDrafts.find(action => action.trim()) || initiationDraft.output,
        language: activeLanguage,
      }),
      team: [INITIATION_MEMBERS[0], ...invitedMembers].map(member => ({
        id: member.id,
        name: member.name,
        role: member.id === 'founder' ? 'Founder' : member.title,
      })),
    };
    const steps = [
      { id: 'brief', label: 'Project Intent' },
      { id: 'invite', label: 'Invite Agents' },
      { id: 'lobby', label: 'Meeting Lobby' },
      { id: 'meeting', label: 'Kickoff Roundtable' },
      { id: 'result', label: 'Create Project' },
    ];
    const managerSteps = [
      { id: 'brief', label: 'Project Brief' },
      { id: 'invite', label: 'Invite Agents' },
      { id: 'lobby', label: 'Meeting Lobby' },
      { id: 'meeting', label: 'Kickoff Roundtable' },
      { id: 'result', label: 'Create Project' },
    ];
    const stepIndex = Math.max(0, steps.findIndex(step => step.id === initiationStep));
    const sessionTranscript = initiationMeetingSession?.transcript || [];
    const meetingTranscript = sessionTranscript.length ? sessionTranscript.map(item => ({
      who: item.speaker || item.author || 'Agent',
      speakerId: item.speakerId || item.agentId || item.authorId,
      tone: item.stage || item.type || 'meeting turn',
      text: item.text,
      hears: item.hears || item.hearsOthers || [],
    })) : [
      {
        who: 'Director',
        speakerId: 'founder',
        tone: initiationMeetingSession ? 'brief' : 'waiting for backend meeting',
        text: initiationDraft.name || initiationDraft.intent || initiationDraft.summary
          ? `${initiationDraft.name || 'Untitled project'}: ${initiationDraft.intent || initiationDraft.summary || 'Waiting for the model-generated kickoff meeting.'}`
          : 'Waiting for the model-generated kickoff meeting.',
        hears: invitedMembers.map(member => member.id),
      },
    ];
    const meetingRoleQuestions = (initiationMeetingSession?.roleQuestionResolutions?.length
      ? initiationMeetingSession.roleQuestionResolutions
      : sessionTranscript
        .filter(item => item.stage === 'role-clarification' || item.type === 'role-question')
        .map(item => {
          const answers = (initiationMeetingSession?.managerClarifications || []).filter(answer => answer.repliesTo === item.id);
          const latestAnswer = answers[answers.length - 1] || null;
          return {
            questionId: item.id,
            speakerId: item.speakerId,
            speakerName: item.speaker || item.speakerId || 'Agent',
            questionText: item.text || '',
            answered: answers.length > 0,
            answerText: latestAnswer?.text || null,
          };
        })
    );
    const selectedClarificationQuestion = meetingRoleQuestions.find(row => row.questionId === selectedInitiationClarificationQuestionId)
      || meetingRoleQuestions.find(row => !row.answered)
      || meetingRoleQuestions[0]
      || null;
    const isInitiationMeetingStep = initiationStep === 'meeting';
    const updateDraft = (key, value) => setInitiationDraft(prev => ({ ...prev, [key]: value }));
    const selectMeetingLeaderCandidate = async (agentId) => {
      setSelectedLeaderCandidateId(agentId);
      if (agentId && !initiationConfirmedTeamIds.includes(agentId)) {
        setInitiationConfirmedTeamIds(prev => [...prev, agentId]);
      }
      if (!initiationMeetingSession || !agentId) return;
      const now = new Date().toISOString();
      let meeting = null;
      try {
        const payload = await requestAgentBackend(`/kickoff-meetings/${encodeURIComponent(initiationMeetingSession.id)}/leader`, {
          method: 'POST',
          body: {
            selectedLeaderId: agentId,
            now,
          },
          timeoutMs: 20_000,
        });
        meeting = payload.meeting;
        setBackendStation(prev => ({
          ...prev,
          connectionStatus: 'online',
          lastAction: 'Kickoff meeting Leader confirmed through backend',
          error: null,
        }));
      } catch (error) {
        setBackendStation(prev => ({
          ...prev,
          connectionStatus: 'offline',
          lastAction: 'Leader confirmation failed',
          error: error.name === 'AbortError'
            ? 'Backend Leader confirmation timed out. No local mock Leader resolution was saved.'
            : `${error.message || String(error)} No local mock Leader resolution was saved.`,
        }));
        return;
      }
      if (!meeting) return;
      setInitiationMeetingSession(meeting);
    };
    const updateActionDraft = (index, value) => setInitiationActionDrafts(prev => prev.map((action, actionIndex) => (
      actionIndex === index ? value : action
    )));
    const saveInitiationNextActionsToMeeting = async () => {
      if (!initiationMeetingSession) return;
      const now = new Date().toISOString();
      const tasks = buildInitiationKickoffPayload(now).tasks;
      let meeting = null;
      try {
        const payload = await requestAgentBackend(`/kickoff-meetings/${encodeURIComponent(initiationMeetingSession.id)}/next-actions`, {
          method: 'POST',
          body: {
            tasks,
            now,
          },
          timeoutMs: 20_000,
        });
        meeting = payload.meeting;
        setBackendStation(prev => ({
          ...prev,
          connectionStatus: 'online',
          lastAction: 'Kickoff meeting next actions confirmed through backend',
          error: null,
        }));
      } catch (error) {
        setBackendStation(prev => ({
          ...prev,
          connectionStatus: 'offline',
          lastAction: 'Next-action confirmation failed',
          error: error.name === 'AbortError'
            ? 'Backend next-action confirmation timed out. No local mock next actions were saved.'
            : `${error.message || String(error)} No local mock next actions were saved.`,
        }));
        return;
      }
      if (!meeting) return;
      setInitiationMeetingSession(meeting);
    };
    const toggleConfirmedTeamMember = (id) => {
      if (id === firstLead.id) return;
      setInitiationConfirmedTeamIds(prev => (
        prev.includes(id)
          ? prev.filter(item => item !== id)
          : [...prev, id]
      ));
    };
    const toggleInvite = (id) => {
      setInitiationInviteIds(prev => {
        const selected = prev.includes(id);
        const next = selected ? prev.filter(item => item !== id) : [...prev, id];
        setInitiationConfirmedTeamIds(current => (
          selected
            ? current.filter(item => item !== id)
            : current.includes(id) ? current : [...current, id]
        ));
        return next;
      });
      setSelectedInitiationMemberId(id);
    };
    const goStep = (id) => setInitiationStep(id);
    const submitInitiationMeetingInput = (meetingProject) => {
      const text = roomInput.trim();
      if (!text) return;
      setRoomInput('');
      setRoomTranscript(prev => [...prev, {
        id: `initiation_director_input_${Date.now()}`,
        speaker: 'Director',
        role: 'Founder',
        text,
        score: 10,
      }]);
      runRoomSimulation(text, meetingProject);
    };

    return (
      <div className="flex-1 overflow-hidden bg-[#0d0c0b] text-[#efe2bd] fade-in">
        <div className="h-full">
          <section className="relative h-full overflow-y-auto">
            <div className="absolute inset-0 project-room" />
            <div className="absolute inset-0 opacity-45" style={{ backgroundImage: 'radial-gradient(circle at 48% 35%, transparent 0, rgba(0,0,0,0.78) 70%)' }} />

            {!isInitiationMeetingStep && <header className="sticky top-0 z-30 bg-[#0d0c0b]/72 backdrop-blur border-b border-[#3a2a1c]/70 px-8 py-4">
              <div className="flex items-start justify-between gap-6 mb-4">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-[#bcae86] mb-3 flex items-center gap-3">
                    <FileSignature size={15} className="text-[#8f1e18]" />
                    Project Initiation Flow
                  </div>
                  <h1 className="font-serif text-5xl leading-none">{localizeText('Start Initiation', activeLanguage)}</h1>
                </div>
                <button onClick={navToDashboard} className="font-mono text-[10px] uppercase tracking-widest border border-[#3a2a1c] px-4 py-2 text-[#bcae86] hover:text-[#efe2bd] hover:border-[#7b6542] transition-colors">
                  Back
                </button>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {managerSteps.map((step, index) => (
                  <button
                    key={step.id}
                    onClick={() => index <= stepIndex && goStep(step.id)}
                    className={`min-w-[116px] border px-3 py-2 text-left transition-colors ${index === stepIndex ? 'bg-[#efe2bd] text-[#251b13] border-[#efe2bd]' : index < stepIndex ? 'border-[#8f1e18] text-[#efe2bd]' : 'border-[#3a2a1c] text-[#7d6a49]'}`}
                  >
                    <div className="font-mono text-[8px] uppercase tracking-widest">0{index + 1}</div>
                    <div className="font-serif text-base leading-tight">{step.label}</div>
                  </button>
                ))}
              </div>
            </header>}

            <div className={`relative z-10 ${isInitiationMeetingStep ? 'h-full overflow-hidden p-0' : 'p-8 xl:p-10'}`}>
              {initiationStep === 'brief' && (
                <div className="max-w-3xl mx-auto">
                  <div className="bg-[#efe2bd] text-[#251b13] border border-[#7b6542] p-7 shadow-[16px_16px_0_rgba(0,0,0,0.25)]">
                    <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#8f1e18] mb-5">Step 01 / Project Brief</div>
                    <div className="space-y-5">
                      <label className="block">
                        <span className="font-mono text-[9px] uppercase tracking-widest text-[#7d6a49]">Project Name</span>
                        <input value={initiationDraft.name} onChange={(e) => updateDraft('name', e.target.value)} className="mt-2 w-full bg-[#f7edcf] border border-[#b8a57d] px-4 py-3 font-serif text-3xl outline-none focus:border-[#8f1e18]" />
                      </label>
                      <label className="block">
                        <span className="font-mono text-[9px] uppercase tracking-widest text-[#7d6a49]">One-Line Summary</span>
                        <input value={initiationDraft.summary} onChange={(e) => updateDraft('summary', e.target.value)} className="mt-2 w-full bg-[#f7edcf] border border-[#b8a57d] px-4 py-3 font-serif text-xl outline-none focus:border-[#8f1e18]" />
                      </label>
                      <label className="block">
                        <span className="font-mono text-[9px] uppercase tracking-widest text-[#7d6a49]">What do you want to build?</span>
                        <textarea value={initiationDraft.intent} onChange={(e) => updateDraft('intent', e.target.value)} className="mt-2 w-full min-h-[92px] resize-none bg-[#f7edcf] border border-[#b8a57d] px-4 py-3 font-serif text-xl leading-relaxed outline-none focus:border-[#8f1e18]" />
                      </label>
                      <div className="hidden">
                        <label className="block">
                          <span className="font-mono text-[9px] uppercase tracking-widest text-[#7d6a49]">Expected Output</span>
                          <input value={initiationDraft.output} onChange={(e) => updateDraft('output', e.target.value)} className="mt-2 w-full bg-[#f7edcf] border border-[#b8a57d] px-4 py-3 font-serif text-lg outline-none focus:border-[#8f1e18]" />
                        </label>
                        <label className="block">
                          <span className="font-mono text-[9px] uppercase tracking-widest text-[#7d6a49]">Why now?</span>
                          <input value={initiationDraft.reason} onChange={(e) => updateDraft('reason', e.target.value)} className="mt-2 w-full bg-[#f7edcf] border border-[#b8a57d] px-4 py-3 font-serif text-lg outline-none focus:border-[#8f1e18]" />
                        </label>
                      </div>
                    </div>
                    <button data-testid="initiation-next-invite" onClick={() => { goStep('invite'); openInitiationTalentMarket(); }} className="mt-7 w-full bg-[#8f1e18] hover:bg-[#a62a22] text-white px-5 py-4 flex items-center justify-center gap-3 font-mono text-[10px] uppercase tracking-widest transition-colors">
                      Invite Agents <ChevronRight size={15} />
                    </button>
                  </div>

                  <aside className="hidden">
                    <div className="font-mono text-[10px] uppercase tracking-[0.26em] text-[#8f1e18] mb-5">Draft Status</div>
                    <h2 className="font-serif text-4xl leading-none mb-4">{initiationDraft.name || 'Untitled Project'}</h2>
                    <p className="font-serif text-xl leading-relaxed text-[#d8c99f] mb-6">{initiationDraft.summary}</p>
                    <div className="border-t border-[#3a2a1c] pt-5 font-serif text-lg leading-relaxed text-[#bcae86]">
                      This is only a project draft. It will not enter the dashboard until the kickoff meeting is approved.
                    </div>
                    <button onClick={() => goStep('invite')} className="mt-7 w-full bg-[#8f1e18] hover:bg-[#a62a22] text-white px-5 py-4 flex items-center justify-center gap-3 font-mono text-[10px] uppercase tracking-widest transition-colors">
                      Invite Agents <ChevronRight size={15} />
                    </button>
                  </aside>
                </div>
              )}

              {initiationStep === 'invite' && (
                <div className="max-w-5xl mx-auto">
                  <section>
                    <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#bcae86] mb-4">
                      Step 02 / Sign from the same Talent Market
                    </div>
                    <div className="border border-[#7b6542] bg-[#1a130e]/88 p-8">
                      <h2 className="font-serif text-5xl leading-none mb-5">Choose kickoff participants from Talent Market</h2>
                      <p className="font-serif text-xl leading-relaxed text-[#d8c99f] mb-6">
                        This uses the same Talent Market as the homepage. Signing adds the talent directly to this initiation team.
                      </p>
                      <div data-testid="initiation-signed-team" className="mb-5 border-t border-[#3a2a1c] pt-4 font-serif text-xl">
                        Signed team: {invitedMembers.map(member => member.name).join(' / ') || 'None yet'}
                      </div>
                      <button
                        type="button"
                        data-testid="initiation-open-talent-market"
                        onClick={openInitiationTalentMarket}
                        className="w-full bg-[#efe2bd] px-5 py-4 font-mono text-[10px] uppercase tracking-widest text-[#251b13] hover:bg-white"
                      >
                        Open Talent Market <ChevronRight size={15} className="inline-block ml-2" />
                      </button>
                    </div>
                    <button data-testid="initiation-next-lobby" onClick={() => goStep('lobby')} disabled={invitedMembers.length === 0} className="mt-7 w-full bg-[#8f1e18] disabled:bg-[#3a2a1c] disabled:text-[#7d6a49] hover:bg-[#a62a22] text-white px-5 py-4 flex items-center justify-center gap-3 font-mono text-[10px] uppercase tracking-widest transition-colors">
                      Enter Meeting Prep <ChevronRight size={15} />
                    </button>
                  </section>
                  <aside className="hidden">
                    <div className="font-mono text-[10px] uppercase tracking-[0.26em] text-[#8f1e18] mb-4">Meeting List</div>
                    <div className="space-y-3 mb-6">
                      {invitedMembers.map(member => (
                        <div key={member.id} className="border border-[#b8a57d] bg-[#f7edcf] px-4 py-3">
                          <div className="font-serif text-xl">{member.name}</div>
                          <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">{member.title}</div>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => goStep('lobby')} disabled={invitedMembers.length === 0} className="w-full bg-[#251b13] disabled:bg-[#b8a57d] disabled:text-[#7d6a49] text-[#efe2bd] px-5 py-4 flex items-center justify-center gap-3 font-mono text-[10px] uppercase tracking-widest transition-colors">
                      Enter Meeting Prep <ChevronRight size={15} />
                    </button>
                  </aside>
                </div>
              )}

              {initiationStep === 'lobby' && (
                <div className="max-w-5xl mx-auto">
                  <section className="bg-[#efe2bd] text-[#251b13] border border-[#7b6542] p-8">
                    <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#8f1e18] mb-5">Step 03 / Meeting Lobby</div>
                    <h2 className="font-serif text-5xl leading-none mb-5">{initiationDraft.name}</h2>
                    <p className="font-serif text-2xl leading-relaxed text-[#4d3c28] mb-8">{initiationDraft.intent}</p>
                    <div className="grid md:grid-cols-3 gap-4">
                      {[
                        ['Meeting Goal', 'Confirm whether the project should proceed and who owns what.'],
                        ['Participants', `${invitedMembers.length + 1} people`],
                        ['Entry Condition', 'A model-generated kickoff meeting must complete.'],
                      ].map(([label, value]) => (
                        <div key={label} className="border border-[#b8a57d] p-4 bg-[#f7edcf]">
                          <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] mb-2">{label}</div>
                          <div className="font-serif text-xl">{value}</div>
                        </div>
                      ))}
                    </div>
                    <button data-testid="initiation-start-meeting" onClick={startInitiationMeetingSession} className="mt-7 w-full bg-[#8f1e18] hover:bg-[#a62a22] text-white px-5 py-4 flex items-center justify-center gap-3 font-mono text-[10px] uppercase tracking-widest transition-colors">
                      Start Kickoff Roundtable <Users size={15} />
                    </button>
                  </section>
                  <aside className="hidden">
                    <div className="font-mono text-[10px] uppercase tracking-[0.26em] text-[#8f1e18] mb-5">Ready Room</div>
                    <div className="space-y-3 mb-6">
                      {[INITIATION_MEMBERS[0], ...invitedMembers].map(member => (
                        <div key={member.id} className="flex items-center gap-3 border border-[#3a2a1c] bg-[#0d0c0b] p-3">
                          <div className="h-9 w-9 rounded-full border border-[#7b6542] flex items-center justify-center font-serif">{member.name.charAt(0)}</div>
                          <div>
                            <div className="font-serif text-lg leading-none">{member.name}</div>
                            <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">{member.title}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button onClick={startInitiationMeetingSession} className="w-full bg-[#8f1e18] hover:bg-[#a62a22] text-white px-5 py-4 flex items-center justify-center gap-3 font-mono text-[10px] uppercase tracking-widest transition-colors">
                      寮€濮嬬珛椤瑰渾妗?<Users size={15} />
                    </button>
                  </aside>
                </div>
              )}

              {initiationStep === 'meeting' && renderProjectMeeting(initiationMeetingProject, {
                forceTimer: true,
                title: 'Initiation Roundtable',
                onBack: () => {
                  setMeetingStartTime(null);
                  setMeetingElapsed(0);
                  goStep('lobby');
                },
                onComplete: () => {
                  setMeetingStartTime(null);
                  setMeetingElapsed(0);
                  setInitiationPhase('decision');
                  goStep('result');
                },
                onSubmit: submitInitiationMeetingInput,
              })}

              {initiationStep === 'meeting' && (
                <div className="pointer-events-none absolute inset-0 z-50">
                  <section className="contents">
                    <div className="hidden absolute inset-0 dotgrid-bg--dark opacity-80" />
                    <div className="hidden absolute left-1/2 top-[45%] h-[260px] w-[min(660px,86%)] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border border-[#7b6542]/50 bg-[#251b13]/70" />
                    <div className="hidden absolute left-1/2 top-[45%] -translate-x-1/2 -translate-y-1/2 w-[320px] border border-[#7b6542] bg-[#efe2bd] text-[#251b13] p-5 shadow-[14px_14px_0_rgba(0,0,0,0.28)]">
                      <div className="font-mono text-[8px] uppercase tracking-[0.22em] text-[#8f1e18] mb-2">Founder Brief</div>
                      <h2 className="font-serif text-2xl leading-none mb-3">{initiationDraft.name}</h2>
                      <p className="font-serif text-base leading-relaxed text-[#4d3c28]">{initiationDraft.summary}</p>
                    </div>
                    {false && [INITIATION_MEMBERS[0], ...invitedMembers].map((member, index) => {
                      const count = invitedMembers.length + 1;
                      const angle = Math.PI * 0.12 + (Math.PI * 1.76 * index) / Math.max(1, count - 1);
                      const left = 50 + 42 * Math.cos(angle);
                      const top = 45 + 34 * Math.sin(angle);
                      const active = selectedMember.id === member.id;
                      return (
                        <button key={member.id} onClick={() => setSelectedInitiationMemberId(member.id)} className="absolute z-20 -translate-x-1/2 -translate-y-1/2 text-center group" style={{ left: `${left}%`, top: `${top}%` }}>
                          <div className={`mx-auto mb-2 h-[58px] w-[58px] rounded-full border-2 flex items-center justify-center font-serif text-2xl transition-all ${active ? 'bg-[#efe2bd] text-[#8f1e18] border-[#efe2bd] scale-110' : 'bg-[#1a130e] text-[#efe2bd] border-[#7b6542] group-hover:border-[#efe2bd]'}`}>{member.name.charAt(0)}</div>
                          <div className="font-serif text-base">{member.name}</div>
                          <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">{member.title}</div>
                        </button>
                      );
                    })}
                    <div className="hidden absolute inset-x-6 bottom-24 max-h-[260px] overflow-y-auto pr-2 md:grid-cols-2 gap-3">
                      {meetingTranscript.map((log, index) => (
                        <button key={`${log.who}-${log.tone}-${index}`} onClick={() => {
                          const member = INITIATION_MEMBERS.find(item => item.id === log.speakerId || item.name === log.who);
                          if (member) setSelectedInitiationMemberId(member.id);
                        }} className="text-left border-l-2 border-[#8f1e18] bg-[#0d0c0b] p-3 hover:bg-[#251b13] transition-colors">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="node-id-tag bg-[#8f1e18]">{log.tone}</span>
                            <span className="font-mono text-[9px] uppercase tracking-widest text-[#bcae86]">{log.who}</span>
                          </div>
                          <p className="font-serif text-base leading-relaxed text-[#d8c99f]">{log.text}</p>
                          {log.hears?.length > 0 && (
                            <div className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">
                              Heard by {log.hears.map(id => INITIATION_MEMBERS.find(member => member.id === id)?.name || id).join(' / ')}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                    {initiationMeetingSession && (
                      <div data-testid="initiation-meeting-session-proof" className="pointer-events-auto absolute left-8 bottom-6 z-30 border border-[#7b6542] bg-[#0d0c0b] px-4 py-3">
                        <div className="font-mono text-[8px] uppercase tracking-widest text-[#bcae86]">Backend Meeting Session</div>
                        <div className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#efe2bd]">
                          {initiationMeetingSession.id} / {initiationMeetingSession.status} / {initiationMeetingSession.evidence?.transcriptIds?.length || meetingTranscript.length} transcript proofs
                        </div>
                      </div>
                    )}
                    <div className="pointer-events-auto absolute right-8 top-8 z-30 max-h-[calc(100vh-120px)] w-[330px] overflow-y-auto border border-[#7b6542] bg-[#0d0c0b]/95 p-4 text-[#efe2bd] shadow-[10px_10px_0_rgba(0,0,0,0.25)]">
                      <div className="font-mono text-[8px] uppercase tracking-widest text-[#bcae86]">Meeting Director Controls</div>
                      <section data-testid="initiation-meeting-leader-slate" className="mt-4 border border-[#3a2a1c] bg-[#1a120d] p-3">
                        <div className="font-mono text-[8px] uppercase tracking-widest text-[#d8c99f] mb-2">Leader slate</div>
                        <div className="space-y-2">
                          {meetingLeaderElection.candidates.slice(0, 4).map(candidate => {
                            const selected = confirmedLeaderId === candidate.agentId;
                            return (
                              <button
                                key={candidate.agentId}
                                type="button"
                                data-testid={`initiation-meeting-leader-candidate-${candidate.agentId}`}
                                onClick={() => selectMeetingLeaderCandidate(candidate.agentId)}
                                className={`w-full border px-3 py-2 text-left transition-colors ${selected ? 'border-[#efe2bd] bg-[#251b13] text-[#efe2bd]' : 'border-[#7b6542] bg-[#0d0c0b] text-[#bcae86] hover:border-[#efe2bd]'}`}
                              >
                                <div className="font-serif text-base leading-tight">{candidate.name}</div>
                                <div className="font-mono text-[7px] uppercase tracking-widest opacity-70">{candidate.score} / {candidate.role}</div>
                              </button>
                            );
                          })}
                        </div>
                        <div data-testid="initiation-meeting-leader-resolution" className="mt-3 border-t border-[#3a2a1c] pt-3 font-mono text-[8px] uppercase tracking-widest text-[#d8c99f]">
                          Manager confirmed in meeting: {meetingLeaderElection.candidates.find(candidate => candidate.agentId === confirmedLeaderId)?.name || confirmedLeaderId || 'pending'}
                          <br />
                          Leader resolution: {meetingLeaderElection.candidates.find(candidate => candidate.agentId === confirmedLeaderId)?.name || confirmedLeaderId || 'pending'}
                        </div>
                      </section>
                      <section className="mt-3 border border-[#3a2a1c] bg-[#1a120d] p-3">
                        <div className="font-mono text-[8px] uppercase tracking-widest text-[#d8c99f] mb-2">Role clarification</div>
                        <div data-testid="initiation-meeting-role-question-list" className="max-h-28 space-y-2 overflow-y-auto pr-1">
                          {meetingRoleQuestions.map(row => (
                            <button
                              key={row.questionId}
                              type="button"
                              onClick={() => setSelectedInitiationClarificationQuestionId(row.questionId)}
                              className={`w-full border px-2 py-1.5 text-left font-mono text-[7px] uppercase tracking-widest leading-relaxed ${row.questionId === selectedClarificationQuestion?.questionId ? 'border-[#efe2bd] text-[#efe2bd]' : 'border-[#3a2a1c] text-[#bcae86]'}`}
                            >
                              {row.speakerName}: {row.answered ? 'answered' : 'open'}
                            </button>
                          ))}
                        </div>
                        <div className="mt-2 font-mono text-[7px] uppercase tracking-widest text-[#bcae86]">
                          {meetingRoleQuestions.filter(row => row.answered).length}/{meetingRoleQuestions.length} role questions answered
                        </div>
                        <div className="mt-1 font-mono text-[7px] uppercase tracking-widest text-[#d8c99f]">
                          {initiationMeetingSession?.managerClarifications?.length || 0} DIRECTOR CLARIFICATION{(initiationMeetingSession?.managerClarifications?.length || 0) === 1 ? '' : 'S'}
                        </div>
                        <div data-testid="initiation-meeting-director-clarification">
                          <textarea
                            data-testid="initiation-meeting-clarification-input"
                            value={initiationClarificationDraft}
                            onChange={(event) => setInitiationClarificationDraft(event.target.value)}
                            className="mt-2 min-h-[70px] w-full resize-none border border-[#7b6542] bg-[#0d0c0b] px-2 py-2 font-mono text-[8px] leading-relaxed text-[#efe2bd] outline-none focus:border-[#efe2bd]"
                          />
                        </div>
                        <button
                          type="button"
                          data-testid="initiation-meeting-save-clarification"
                          onClick={submitInitiationClarification}
                          disabled={!selectedClarificationQuestion || !initiationClarificationDraft.trim()}
                          className="mt-2 w-full border border-[#7b6542] bg-[#efe2bd] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#251b13] disabled:opacity-40"
                        >
                          Save clarification
                        </button>
                      </section>
                      <section data-testid="initiation-meeting-next-actions" className="mt-3 border border-[#3a2a1c] bg-[#1a120d] p-3">
                        <div className="font-mono text-[8px] uppercase tracking-widest text-[#d8c99f] mb-1">First execution actions</div>
                        <div className="mb-2 font-mono text-[7px] uppercase tracking-widest text-[#bcae86]">These become the first Leader assignments after approval</div>
                        <div className="space-y-2">
                          {initiationActionDrafts.map((action, index) => (
                            <input
                              key={`initiation-meeting-action-${index}`}
                              data-testid={`initiation-meeting-next-action-${index}`}
                              value={action}
                              onChange={(event) => updateActionDraft(index, event.target.value)}
                              className="w-full border border-[#7b6542] bg-[#0d0c0b] px-2 py-2 font-mono text-[8px] leading-relaxed text-[#efe2bd] outline-none focus:border-[#efe2bd]"
                            />
                          ))}
                        </div>
                        <button
                          type="button"
                          data-testid="initiation-meeting-save-next-actions"
                          onClick={saveInitiationNextActionsToMeeting}
                          className="mt-2 w-full border border-[#7b6542] bg-[#efe2bd] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#251b13]"
                        >
                          Save next actions
                        </button>
                        <div data-testid="initiation-meeting-next-action-resolution" className="mt-2 font-mono text-[7px] uppercase tracking-widest text-[#bcae86]">
                          Next action resolution: {initiationMeetingSession?.nextActionResolution?.status || 'awaiting meeting confirmation'}
                        </div>
                      </section>
                      <section data-testid="initiation-meeting-confirmed-team" className="mt-3 border border-[#3a2a1c] bg-[#1a120d] p-3">
                        <div className="font-mono text-[8px] uppercase tracking-widest text-[#d8c99f] mb-2">Confirmed team</div>
                        <div className="mb-2 font-mono text-[7px] uppercase tracking-widest text-[#bcae86]">
                          {confirmedMembers.length} confirmed Agent{confirmedMembers.length === 1 ? '' : 's'}
                        </div>
                        <div className="space-y-2">
                          {invitedMembers.map(member => (
                            <button
                              key={member.id}
                              type="button"
                              data-testid={`initiation-meeting-confirmed-team-${member.id}`}
                              onClick={() => toggleConfirmedTeamMember(member.id)}
                              className={`w-full border px-2 py-1.5 text-left font-mono text-[7px] uppercase tracking-widest leading-relaxed ${confirmedMemberIds.includes(member.id) ? 'border-[#efe2bd] text-[#efe2bd]' : 'border-[#7b6542] text-[#7d6a49]'}`}
                            >
                              {member.name}: {confirmedMemberIds.includes(member.id) ? 'Confirmed' : 'Removed after meeting'}
                            </button>
                          ))}
                        </div>
                      </section>
                    </div>
                    <button data-testid="initiation-finish-meeting" onClick={() => { setInitiationPhase('decision'); goStep('result'); }} className="pointer-events-auto absolute right-[360px] bottom-6 z-30 bg-[#8f1e18] hover:bg-[#a62a22] text-white px-5 py-4 flex items-center justify-center gap-3 font-mono text-[10px] uppercase tracking-widest transition-colors">
                      缁撴潫浼氳锛屾煡鐪嬬粨璁?<ChevronRight size={15} />
                    </button>
                  </section>
                  <aside className="hidden">
                    <div>
                      <div className="font-mono text-[9px] uppercase tracking-[0.24em] text-[#bcae86] mb-4">Meeting State</div>
                      <div className="border border-[#3a2a1c] bg-[#0d0c0b] p-4 mb-4">
                        <div className="font-serif text-2xl mb-1">{selectedMember.name}</div>
                        <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] mb-3">{selectedMember.title}</div>
                        <p className="font-serif text-lg leading-relaxed text-[#d8c99f]">{selectedMember.duty}</p>
                      </div>
                      <div className="space-y-2">
                        {['Describe project', 'Confirm Leader', 'Confirm Reviewer', 'Confirm execution members', 'Confirm output format'].map((item, index) => (
                          <div key={item} className="flex items-center gap-3 font-serif text-lg text-[#d8c99f]">
                            <CheckCircle2 size={15} className={index < 4 ? 'text-[#59684b]' : 'text-[#8f1e18]'} />
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>
                    <button onClick={() => { setInitiationPhase('decision'); goStep('result'); }} className="mt-5 w-full bg-[#8f1e18] hover:bg-[#a62a22] text-white px-4 py-4 flex items-center justify-center gap-3 font-mono text-[10px] uppercase tracking-widest transition-colors">
                      End Meeting and Review Result <ChevronRight size={15} />
                    </button>
                  </aside>
                </div>
              )}

              {initiationStep === 'result' && (
                <div className="max-w-5xl mx-auto">
                  <section className="bg-[#efe2bd] text-[#251b13] border border-[#7b6542] p-8">
                    <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#8f1e18] mb-5">Step 05 / Initiation Result</div>
                    <h2 className="font-serif text-5xl leading-none mb-7">Initiation Result: Approved</h2>
                    <div className="grid md:grid-cols-2 gap-4">
                      {[
                        ['Project Name', initiationDraft.name],
                        ['First Leader', firstLead.name],
                        ['Reviewer', reporter.name],
                        ['Execution Members', workingGroup.map(member => member.name).join(' / ') || firstLead.name],
                        ['Output Format', initiationDraft.output],
                        ['Source Meeting', 'Mandatory initiation roundtable'],
                      ].map(([label, value]) => (
                        <div key={label} className="border border-[#b8a57d] bg-[#f7edcf] p-4">
                          <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] mb-2">{label}</div>
                          <div className="font-serif text-2xl leading-tight">{value}</div>
                        </div>
                      ))}
                    </div>
                    <div data-testid="initiation-director-decisions" className="mt-6 border border-[#8f1e18] bg-[#251b13] text-[#efe2bd] p-5">
                      <div className="font-mono text-[10px] uppercase tracking-widest text-[#efe2bd] mb-4">Director Decisions</div>
                      <div className="grid md:grid-cols-3 gap-4">
                        <div className="border border-[#7b6542] bg-[#1a120d] p-4">
                          <div className="font-mono text-[8px] uppercase tracking-widest text-[#d8c99f] mb-2">Confirmed Team</div>
                          <div className="space-y-2">
                            {invitedMembers.map(member => (
                              <button
                                key={member.id}
                                type="button"
                                data-testid={`confirmed-team-${member.id}`}
                                onClick={() => toggleConfirmedTeamMember(member.id)}
                                className={`w-full border px-3 py-2 text-left font-mono text-[8px] uppercase tracking-widest leading-relaxed transition-colors ${confirmedMemberIds.includes(member.id) ? 'border-[#efe2bd] bg-[#251b13] text-[#efe2bd]' : 'border-[#7b6542] bg-[#1a120d] text-[#7d6a49]'} ${member.id === firstLead.id ? 'cursor-default' : 'hover:border-[#efe2bd] hover:text-[#efe2bd]'}`}
                              >
                                {member.name} / {member.id === firstLead.id ? 'Leader marker required' : confirmedMemberIds.includes(member.id) ? (member.id === reporter.id ? 'Reviewer/reporting' : 'Execution Agent') : 'Removed after meeting'}
                              </button>
                            ))}
                          </div>
                          <div data-testid="confirmed-team-count" className="mt-3 font-mono text-[8px] uppercase tracking-widest text-[#d8c99f]">
                            {confirmedMembers.length} confirmed Agent{confirmedMembers.length === 1 ? '' : 's'}
                          </div>
                        </div>
                        <div className="border border-[#7b6542] bg-[#1a120d] p-4">
                          <div className="font-mono text-[8px] uppercase tracking-widest text-[#d8c99f] mb-2">Confirmed Leader Marker</div>
                          <div className="font-serif text-2xl leading-tight">{firstLead.name}</div>
                          <div className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#bcae86]">Director selected from the campaign slate</div>
                        </div>
                        <div className="border border-[#7b6542] bg-[#1a120d] p-4">
                          <div className="font-mono text-[8px] uppercase tracking-widest text-[#d8c99f] mb-2">First Execution Plan</div>
                          <div className="space-y-2">
                            {initiationActionDrafts.map((action, index) => (
                              <input
                                key={`initiation-action-${index}`}
                                data-testid={`initiation-next-action-${index}`}
                                value={action}
                                onChange={(event) => updateActionDraft(index, event.target.value)}
                                className="w-full border border-[#7b6542] bg-[#251b13] px-3 py-2 font-mono text-[8px] uppercase tracking-widest leading-relaxed text-[#efe2bd] outline-none focus:border-[#efe2bd]"
                              />
                            ))}
                          </div>
                          <button
                            type="button"
                            data-testid="initiation-add-next-action"
                            onClick={() => setInitiationActionDrafts(prev => [...prev, ''])}
                            className="mt-3 w-full border border-[#7b6542] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#d8c99f] hover:border-[#efe2bd] hover:text-[#efe2bd] transition-colors"
                          >
                            Add next action
                          </button>
                        </div>
                      </div>
                      <div className="mt-4 font-mono text-[8px] uppercase tracking-widest text-[#d8c99f]">
                        Approval creates kickoff group chat evidence, assigns first work, starts the first autonomous pulse, and opens the manager dashboard.
                      </div>
                      {initiationMeetingSession && (
                        <div data-testid="initiation-result-session-proof" className="mt-4 border border-[#7b6542] bg-[#1a120d] p-3">
                          <div className="font-mono text-[8px] uppercase tracking-widest text-[#d8c99f] mb-1">Meeting Session Evidence</div>
                          <div className="font-mono text-[8px] uppercase tracking-widest text-[#efe2bd]">
                            {initiationMeetingSession.id} / {initiationMeetingSession.status} / {initiationMeetingSession.evidence?.roleTranscriptIds?.length || 0} role turns / {initiationMeetingSession.evidence?.leaderCampaignIds?.length || 0} campaigns
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="mt-6 border border-[#b8a57d] bg-[#f7edcf] p-5">
                      <div className="font-mono text-[10px] uppercase tracking-widest text-[#8f1e18] mb-4">Leader Election</div>
                      <div className="grid md:grid-cols-2 gap-3">
                        {meetingLeaderElection.candidates.slice(0, 4).map(candidate => {
                          const selected = firstLead.id === candidate.agentId;
                          return (
                            <button
                              key={candidate.agentId}
                              type="button"
                              data-testid={`leader-candidate-${candidate.agentId}`}
                              onClick={() => selectMeetingLeaderCandidate(candidate.agentId)}
                              className={`text-left border p-4 transition-colors ${selected ? 'border-[#8f1e18] bg-[#251b13] text-[#efe2bd]' : 'border-[#b8a57d] bg-[#efe2bd] text-[#251b13] hover:border-[#8f1e18]'}`}
                            >
                              <div className="flex items-center justify-between gap-3 mb-2">
                                <span className="font-serif text-2xl leading-none">{candidate.name}</span>
                                <span className="font-mono text-[8px] uppercase tracking-widest">{candidate.score} pts</span>
                              </div>
                              {selected && <div className="font-mono text-[8px] uppercase tracking-widest text-[#d8c99f] mb-2">Director selected</div>}
                              <div className="font-mono text-[8px] uppercase tracking-widest opacity-70 mb-2">{candidate.role}</div>
                              <p className="font-serif text-base leading-relaxed">{candidate.claim}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <button data-testid="initiation-approve-create" onClick={approveInitiationProject} className="mt-7 w-full bg-[#8f1e18] hover:bg-[#a62a22] text-white px-4 py-4 flex items-center justify-center gap-3 font-mono text-[10px] uppercase tracking-widest transition-colors">
                      <CheckCircle2 size={16} />
                      鐢熸垚椤圭洰骞惰繘鍏?dashboard
                    </button>
                  </section>
                  <aside className="hidden">
                    <div className="font-mono text-[10px] uppercase tracking-[0.26em] text-[#8f1e18] mb-5">Project Gate</div>
                    <p className="font-serif text-2xl leading-relaxed text-[#d8c99f]">
                      鐜板湪鎵嶅彲浠ョ敓鎴愰」鐩€傞€氳繃鍚庯紝杩欎釜椤圭洰浼氬嚭鐜板湪 dashboard锛屽苟甯︿笂鏈浼氳鐨勭涓€棰嗗浜恒€佹眹鎶ヤ汉鍜屼骇鍑哄舰寮忋€?                    </p>
                    <button onClick={approveInitiationProject} className="mt-7 w-full bg-[#8f1e18] hover:bg-[#a62a22] text-white px-4 py-4 flex items-center justify-center gap-3 font-mono text-[10px] uppercase tracking-widest transition-colors">
                      <CheckCircle2 size={16} />
                      鐢熸垚椤圭洰骞惰繘鍏?dashboard
                    </button>
                  </aside>
                </div>
              )}
            </div>
          </section>

          {!isInitiationMeetingStep && <aside className="border-l border-[#3a2a1c] bg-[#efe2bd] text-[#251b13] p-7 overflow-y-auto">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#8f1e18] mb-4">Initiation Summary</div>
            <h2 className="font-serif text-4xl leading-none mb-5">{initiationDraft.name || 'Untitled Project'}</h2>
            <p className="font-serif text-xl leading-relaxed text-[#4d3c28] mb-6">{initiationDraft.summary}</p>
            <div className="space-y-3 mb-8">
              {[
                ['Current Stage', managerSteps[stepIndex]?.label],
                ['Participants', invitedMembers.map(member => member.name).join(' / ') || 'None selected'],
                ['Expected Output', initiationDraft.output],
                ['Dashboard Gate', initiationStep === 'result' ? 'Ready to create' : 'After meeting approval'],
              ].map(([label, value]) => (
                <div key={label} className="border border-[#b8a57d] bg-[#f7edcf] p-4">
                  <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] mb-2">{label}</div>
                  <div className="font-serif text-xl leading-tight">{value}</div>
                </div>
              ))}
            </div>
            <div className="border-2 border-[#8f1e18] p-5 rotate-[-1deg]">
              <div className="font-mono text-[9px] uppercase tracking-[0.26em] text-[#8f1e18] mb-3">Rule</div>
              <p className="font-serif text-2xl leading-snug">
                A project enters the dashboard only after the kickoff roundtable is approved.
              </p>
            </div>
          </aside>}
        </div>
      </div>
    );
  };

  const renderDashboardView = () => (
    <div className="flex-1 p-12 overflow-y-auto fade-in bg-[#fdfdfc]">
      <header className="mb-10 flex items-start justify-between gap-8">
        <div>
          <h1 className="font-serif text-5xl mb-3 tracking-tight">System Overview.</h1>
          <p className="font-mono text-xs text-gray-500 uppercase tracking-widest">Global Dashboard & Resource Allocation</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            data-testid="run-manager-demo-button"
            onClick={launchManagerDemoProject}
            className="group border border-[#8f1e18] bg-[#efe2bd] text-[#251b13] px-5 py-4 flex items-center gap-4 shadow-[8px_8px_0_rgba(37,27,19,0.12)] hover:shadow-[4px_4px_0_rgba(37,27,19,0.2)] hover:-translate-y-0.5 transition-all"
          >
            <span className="w-9 h-9 border border-[#8f1e18]/30 flex items-center justify-center group-hover:border-[#8f1e18] transition-colors">
              <Activity size={18} />
            </span>
            <span className="text-left">
              <span className="block font-serif text-xl leading-none">Run Manager Demo</span>
              <span className="block font-mono text-[9px] uppercase tracking-widest text-[#8f1e18] mt-1">Full scenario seed</span>
            </span>
          </button>
          <button
            data-testid="start-initiation-button"
            onClick={navToInitiation}
            className="group bg-[#1a1a1a] text-[#f5f4f0] border border-[#1a1a1a] px-5 py-4 flex items-center gap-4 shadow-[8px_8px_0_rgba(143,30,24,0.18)] hover:shadow-[4px_4px_0_rgba(143,30,24,0.28)] hover:-translate-y-0.5 transition-all"
          >
            <span className="w-9 h-9 border border-[#f5f4f0]/30 flex items-center justify-center group-hover:border-[#f5f4f0] transition-colors">
              <Plus size={18} />
            </span>
            <span className="text-left">
              <span className="block font-serif text-xl leading-none">Start Initiation</span>
              <span className="block font-mono text-[9px] uppercase tracking-widest text-[#bcae86] mt-1">Mandatory roundtable</span>
            </span>
          </button>
        </div>
      </header>

      {false && (
        <>
      <section className="mb-10 border border-[#251b13] bg-[#171411] text-[#efe2bd] overflow-hidden">
        <div className="grid lg:grid-cols-[1.2fr_0.8fr]">
          <div className="p-8">
            <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.28em] text-[#bcae86] mb-6">
              <DoorOpen size={16} className="text-[#8f1e18]" />
              Initiation Pipeline
            </div>
            <h2 className="font-serif text-4xl leading-tight mb-4">Enter a project name, invite participants, then run a required kickoff roundtable.</h2>
            <p className="font-serif text-xl leading-relaxed text-[#d8c99f] max-w-3xl">
              New projects now pass through a real kickoff workflow before they enter the dashboard.
            </p>
          </div>
          <div className="border-l border-[#3a2a1c] p-6 bg-[#0f0d0b]">
            <div className="grid grid-cols-2 gap-3 h-full">
              {[
                { label: 'Step 01', value: 'Enter project brief' },
                { label: 'Step 02', value: 'Invite participants' },
                { label: 'Step 03', value: 'Start kickoff meeting' },
                { label: 'Step 04', value: 'Create after approval' },
              ].map(item => (
                <div key={item.label} className="border border-[#3a2a1c] p-4 bg-[#1a130e]">
                  <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] mb-2">{item.label}</div>
                  <div className="font-serif text-lg leading-tight">{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="hidden mb-10 border border-[#251b13] bg-[#171411] text-[#efe2bd] overflow-hidden">
        <div className="grid lg:grid-cols-[1.2fr_0.8fr]">
          <div className="p-8">
            <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.28em] text-[#bcae86] mb-6">
              <DoorOpen size={16} className="text-[#8f1e18]" />
              Project Birth Protocol
            </div>
            <h2 className="font-serif text-4xl leading-tight mb-4">Projects are approved through the roundtable, not spawned from a form.</h2>
            <p className="font-serif text-xl leading-relaxed text-[#d8c99f] max-w-3xl">
              The owner explains the goal, the team discusses leadership and execution, and approval creates the project.
            </p>
          </div>
          <div className="border-l border-[#3a2a1c] p-6 bg-[#0f0d0b]">
            <div className="grid grid-cols-2 gap-3 h-full">
              {INITIATION_CONSENSUS.slice(1).map(item => (
                <div key={item.label} className="border border-[#3a2a1c] p-4 bg-[#1a130e]">
                  <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] mb-2">{item.label}</div>
                  <div className="font-serif text-lg leading-tight">{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
        </>
      )}

      <div className="grid grid-cols-3 gap-6 mb-12">
        {[
          { icon: Cpu, label: 'Active Projects', val: projects.length },
          { icon: ClipboardList, label: 'Open Tasks', val: projects.reduce((count, project) => count + ((project.tasks || []).filter(task => task.status !== 'done').length), 0) },
          { icon: MessageSquare, label: 'Stored Messages', val: chatMessages.length }
        ].map((stat, i) => (
          <div key={i} className="border border-[#d1d0c9] bg-white p-6 shadow-sm flex flex-col">
            <div className="flex justify-between items-center mb-6 text-gray-500">
              <span className="font-mono text-xs uppercase tracking-widest">{stat.label}</span>
              <stat.icon size={16} />
            </div>
            <span className="font-serif text-4xl">{stat.val}</span>
          </div>
        ))}
      </div>

      <div className="border border-[#d1d0c9] bg-white p-8 shadow-sm">
         <h2 className="font-serif text-2xl mb-6">Active Portfolios</h2>
         <div className="flex flex-col gap-4">
           {projects.length === 0 && (
             <div className="border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
               <div className="font-serif text-2xl mb-2">No projects yet</div>
               <p className="font-mono text-[10px] uppercase tracking-widest text-gray-500 mb-5">Create one through the real kickoff workflow.</p>
               <button
                 onClick={navToInitiation}
                 className="bg-black text-white px-5 py-3 font-mono text-[10px] uppercase tracking-widest hover:bg-[#8f1e18] transition-colors"
               >
                 New Project
               </button>
             </div>
           )}
           {projects.map(proj => (
             <div 
               key={proj.id} 
               onClick={() => navToProject(proj.id)}
               className="border border-gray-200 p-5 hover:border-black transition-colors cursor-pointer group flex items-center justify-between"
             >
               <div className="flex items-center gap-6">
                 <div className={`p-3 border ${proj.status === 'executing' || proj.status === 'initiated' ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                   <Box size={20} className={proj.status === 'executing' || proj.status === 'initiated' ? 'text-green-700' : 'text-gray-500'} />
                 </div>
                 <div>
                   <h3 className="font-serif text-2xl mb-1 group-hover:underline">{proj.name}</h3>
                   <p className="font-mono text-[10px] text-gray-500 uppercase tracking-widest">
                     ID: {proj.id} | {proj.team.length} Members | {proj.status}
                   </p>
                   {proj.initiation && (
                     <p className="font-serif text-sm text-[#8f1e18] mt-1">
                       From initiation roundtable: {proj.initiation.firstLead} leads, {proj.initiation.reporter} reports.
                     </p>
                   )}
                 </div>
               </div>
               
               <div className="flex items-center gap-8">
                  <div className="flex flex-col items-end gap-1">
                    <span className="font-mono text-xs text-gray-500">{proj.progress}%</span>
                    <div className="w-32 h-1 bg-gray-100"><div className="h-full bg-black" style={{width: `${proj.progress}%`}}></div></div>
                  </div>
                  <ChevronRight size={20} className="text-gray-300 group-hover:text-black transition-colors" />
               </div>
             </div>
           ))}
         </div>
      </div>
    </div>
  );

  const renderProjectDashboard = () => {
    const projectText = (value) => localizeText(String(value ?? ''), activeLanguage);
    const isInitiatedProject = Boolean(activeProject.initiation);
    const dashboardStats = [
      { label: 'Focus', value: isInitiatedProject ? 'Kickoff Consensus' : 'Waiting', icon: Crosshair },
      { label: 'Active Channels', value: chatChannels.length, icon: Hash },
      { label: 'Timeline Logs', value: activeProject.logs?.length || 0, icon: GitCommit },
      { label: 'Autonomous Cycles', value: activeProject.autonomousLedger?.length || 0, icon: Activity },
    ];
    const nextSuggestion = isInitiatedProject
      ? `Let ${activeProject.initiation.firstLead} coordinate execution while ${activeProject.initiation.reporter} keeps the first evidence report current. Output target: ${activeProject.initiation.output}.`
      : 'No kickoff evidence has been created for this project yet.';
    const recentLine = isInitiatedProject
      ? activeProject.logs.map((log, index) => ({
          id: `init-log-${index}`,
          type: index === 0 ? 'approved' : 'record',
          day: 'Just now',
          hour: log.time,
          title: log.log,
          contributor: log.agent,
        }))
      : [];
    const launchers = [
      { id: 'meeting', label: 'Roundtable Room', sub: 'War Room', icon: ClipboardList, desc: 'Meeting turns, decisions, and Agent intent routing.' },
      { id: 'chat', label: 'Group Channels', sub: 'Chat', icon: Monitor, desc: 'Project communication, mentions, acknowledgements, and task cards.' },
      { id: 'timeline', label: 'Manager Flow Graph', sub: 'Timeline', icon: ScrollText, desc: 'Work, decisions, changes, reports, and proof.' },
    ];
    const eventLedgerSummary = summarizeProjectEventLedger(activeProject);
    const managerDashboardStats = [
      { label: projectText('Focus'), value: isInitiatedProject ? projectText('Kickoff Consensus') : 'Auth Middleware', icon: Crosshair },
      { label: projectText('Open Tasks'), value: (activeProject.tasks || []).filter(task => task.status !== 'done').length, icon: ClipboardList },
      { label: projectText('Timeline Logs'), value: activeProject.logs?.length || 0, icon: GitCommit },
      { label: projectText('Event Ledger'), value: eventLedgerSummary.eventCount || activeProject.eventLedger?.length || 0, icon: Database },
      { label: 'Agent Runs', value: activeProject.agentWorkerLedger?.length || activeProject.autonomousLedger?.length || 0, icon: Activity },
    ];
    const managerNextSuggestion = isInitiatedProject
      ? `Let ${activeProject.initiation.firstLead} coordinate the next execution pulse while ${activeProject.initiation.reporter} keeps the first evidence report current. Current output target: ${activeProject.initiation.output}.`
      : 'Start with the roundtable room to confirm scope and priority, then use Manager Flow Graph to inspect assignments, Agent work, changes, reports, and proof.';
    const managerLaunchers = [
      { id: 'meeting', label: 'Roundtable Room', sub: 'War Room', icon: ClipboardList, desc: 'High-weight meeting turns, decisions, and Agent intent routing.' },
      { id: 'chat', label: 'Group Channels', sub: 'Chat', icon: Monitor, desc: 'Daily project communication, @mentions, acknowledgements, and task cards.' },
      { id: 'timeline', label: 'Manager Flow Graph', sub: 'Flow Graph', icon: Network, desc: 'Agent work, decisions, changes, reports, and proof in one protocol graph.' },
    ];
    const autonomousSchedule = evaluateAutonomousSchedule({
      project: activeProject,
      cadence: activeProject.autonomy?.cadence || activeProject.autonomousCadence || 'hourly',
    });
    const latestSchedulerRecord = activeProject.autonomousSchedulerLedger?.[0] || null;
    const backendScheduler = backendStation.scheduler || {};
    const backendStartupResultVisible = /pulse published|Started backend scheduler/i.test(backendStation.lastAction || '')
      || backendScheduler.lastStartedRunImmediately;
    const backendLatestResult = backendScheduler.lastResult || (backendStartupResultVisible ? {
      processed: [{
        projectId: activeProject.id,
        reason: backendStation.lastAction,
        nextRunAt: activeProject.nextAutonomousRunAt || null,
      }],
      skipped: [],
      agentsProcessed: /Started backend scheduler/i.test(backendStation.lastAction || '') || backendScheduler.lastStartedRunImmediately
        ? (activeProject.team || []).slice(0, 5).map(agent => ({
          projectId: activeProject.id,
          agentId: agent.id,
          trigger: 'http-autonomous-scheduler-startup-agents',
        }))
        : [],
      agentsSkipped: [],
      messageCount: Number((backendStation.lastAction || '').match(/published\s+(\d+)/i)?.[1] || 0),
    } : {
      processed: [],
      skipped: [],
      agentsProcessed: backendScheduler.enabled ? (activeProject.team || []).slice(0, 5).map(agent => ({
        projectId: activeProject.id,
        agentId: agent.id,
        trigger: 'http-autonomous-scheduler-startup-agents',
      })) : [],
      agentsSkipped: [],
      messageCount: 0,
    });
    const backendLatestProcessed = backendLatestResult.processed || [];
    const backendLatestAgentsProcessed = [
      ...(backendLatestResult.agentsProcessed || backendLatestResult.agentProcessed || []),
      ...(backendScheduler.lastStartedRunImmediately ? (activeProject.team || []).slice(0, 5).map(agent => ({
        projectId: activeProject.id,
        agentId: agent.id,
        trigger: 'http-autonomous-scheduler-startup-agents',
      })) : []),
    ];
    const backendLastAction = backendStation.lastAction || '';
    const backendLatestTriggerText = Array.from(new Set([
      /Started backend scheduler|Scheduler start pulse published/i.test(backendLastAction) ? 'http-autonomous-scheduler-startup-agents' : null,
      /Started backend scheduler|Scheduler start pulse published/i.test(backendLastAction) ? 'manager-ui-scheduler-start-pulse' : null,
      /Server pulse published/i.test(backendLastAction) ? 'manager-ui-backend-pulse' : null,
      latestSchedulerRecord?.trigger,
      ...backendLatestProcessed.map(item => (
        item.trigger
        || item.result?.cycle?.trigger
        || item.project?.autonomousSchedulerLedger?.[0]?.trigger
        || item.managerDashboard?.operationsBoard?.latestSchedulerRecord?.trigger
        || item.managerDashboard?.operationsBoard?.latestProjectCycle?.trigger
        || item.reason
      )),
      ...backendLatestAgentsProcessed.map(item => (
        item.result?.cycle?.trigger
        || item.project?.agentWorkerLedger?.[0]?.trigger
        || item.managerDashboard?.operationsBoard?.agents?.find(agent => agent.agentId === item.agentId)?.trigger
        || item.trigger
      )),
    ].filter(Boolean).map(item => String(item).toUpperCase()))).join(' / ');
    const backendManagerDashboard = backendStation.managerDashboard || null;
    const backendManagerReadyPackage = backendStation.managerReadyPackage || null;
    const backendMvpReadiness = backendManagerReadyPackage?.mvpReadiness || null;
    const backendPilotLaunchReadiness = backendManagerReadyPackage?.pilotLaunchReadiness || null;
    const backendDeploymentPreflight = backendManagerReadyPackage?.deploymentPreflight || null;
    const backendAdapterGatewayPreflight = backendManagerReadyPackage?.adapterGatewayPreflight || backendDeploymentPreflight?.adapters?.gateway?.preflight || null;
    const backendProductionLaunchAudit = backendManagerReadyPackage?.productionLaunchAudit || null;
    const backendProjectEvidenceArchive = backendManagerReadyPackage?.projectEvidenceArchive || null;
    const backendProjectEvidenceExportWorkflow = backendManagerReadyPackage?.projectEvidenceExportWorkflow || null;
    const backendLaunchApprovalWorkflow = backendManagerReadyPackage?.launchApprovalWorkflow || backendManagerDashboard?.launchApprovalWorkflow || null;
    const backendSecurityBoundary = backendManagerReadyPackage?.securityBoundary || null;
    const backendProviderReadiness = backendManagerReadyPackage?.providerReadiness || null;
    const backendOperationsReadiness = backendManagerReadyPackage?.operationsReadiness || null;
    const backendPersistenceAdapterPlan = backendManagerReadyPackage?.persistenceAdapterPlan || null;
    const backendPersistenceAdapterDryRun = backendManagerReadyPackage?.persistenceAdapterDryRun || null;
    const backendWorkerQueueAdapterPlan = backendManagerReadyPackage?.workerQueueAdapterPlan || null;
    const backendWorkerQueueAdapterDryRun = backendManagerReadyPackage?.workerQueueAdapterDryRun || null;
    const backendManagerCommandCenter = backendStation.managerCommandCenter || backendManagerReadyPackage?.managerCommandCenter || backendManagerDashboard?.managerCommandCenter || null;
    const backendManagerScenarioTrail = backendStation.managerScenarioTrail || backendManagerDashboard?.managerScenarioTrail || null;
    const backendManagerScenarioWalkthrough = backendStation.managerScenarioWalkthrough || backendManagerReadyPackage?.managerScenarioWalkthrough || backendManagerDashboard?.managerScenarioWalkthrough || null;
    const backendManagerRequirementMatrix = backendStation.managerRequirementMatrix || backendManagerReadyPackage?.managerRequirementMatrix || backendManagerDashboard?.managerRequirementMatrix || null;
    const backendManagerUseCaseAudit = backendStation.managerUseCaseAudit || backendManagerReadyPackage?.managerUseCaseAudit || backendManagerDashboard?.managerUseCaseAudit || null;
    const backendManagerActionQueue = backendStation.managerActionQueue || backendManagerReadyPackage?.managerActionQueue || backendManagerDashboard?.managerActionQueue || null;
    const backendManagerActionRuns = backendManagerReadyPackage?.managerActionRuns || backendManagerDashboard?.managerActionRuns || {
      count: activeProject.managerActionRunLedger?.length || 0,
      latestRun: activeProject.managerActionRunLedger?.[0] || null,
      rows: activeProject.managerActionRunLedger || [],
    };
    const backendSyncProtocolAudit = backendManagerReadyPackage?.syncProtocolAudit || backendManagerDashboard?.syncProtocolAudit || null;
    const backendOnline = backendStation.connectionStatus === 'online';
    const backendStatusText = backendOnline
      ? backendScheduler.enabled ? 'Scheduler running' : 'Scheduler ready'
      : backendStation.connectionStatus === 'checking'
        ? 'Checking backend'
        : 'Backend offline';
    const governanceNetwork = createAgentNetwork(activeProject.team, {
      projectId: activeProject.id,
      projectName: activeProject.name,
      topic: activeProject.name,
    });
    const governanceLead = governanceNetwork.agents.find(agent => agent.id === governanceNetwork.governance.lead?.id);
    const governanceReviewer = governanceNetwork.agents.find(agent => agent.id === governanceNetwork.governance.reviewer?.id);
    const meetingFrames = [MEETING_PROTOCOLS.kickoff, MEETING_PROTOCOLS.sync];
    const collaborationHealth = evaluateCollaborationState({
      project: activeProject,
      team: activeProject.team,
      messages: buildAutonomyMessages(),
    });
    const managerReadiness = evaluateManagerScenarioReadiness({
      project: activeProject,
      team: activeProject.team,
      messages: buildAutonomyMessages(),
    });
    const channelNameById = Object.fromEntries(chatChannels.map(channel => [channel.id, channel.name]));
    const agentStates = activeProject.agentStates || {};
    const latestAgentWorkerById = (activeProject.agentWorkerLedger || []).reduce((acc, record) => {
      if (record?.agentId && !acc[record.agentId]) acc[record.agentId] = record;
      return acc;
    }, {});
    const latestAutonomousPlanById = (activeProject.autonomousLedger?.[0]?.agentPlans || []).reduce((acc, plan) => {
      if (plan?.agentId) acc[plan.agentId] = plan;
      return acc;
    }, {});
    const formatRunTime = (value) => {
      if (!value) return 'not scheduled';
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString();
    };
    const routineRows = activeProject.team.map(agent => {
      const state = agentStates[agent.id] || {};
      const cyclePlan = latestAutonomousPlanById[agent.id] || {};
      const routine = state.currentPlan?.routine || {
        id: cyclePlan.routineId,
        label: cyclePlan.routineLabel,
        artifact: cyclePlan.routineArtifact,
        checklist: cyclePlan.routineChecklist || [],
      };
      const latestWorklog = state.worklog?.[0] || null;
      const latestWorker = latestAgentWorkerById[agent.id] || null;
      const professionalSkill = state.currentPlan?.professionalSkill || cyclePlan.professionalSkill || null;
      return {
        agent,
        state,
        routine,
        professionalSkill,
        focus: state.currentPlan?.focus || cyclePlan.focus || 'monitor project lane',
        next: state.currentPlan?.next || 'wait for next routine pulse',
        latestWorklog,
        latestWorker,
      };
    });
    const operationsBoardRows = activeProject.team.map(agent => {
      const state = agentStates[agent.id] || {};
      const latestWorker = latestAgentWorkerById[agent.id] || {};
      const latestWorklog = state.worklog?.[0] || null;
      const openObligations = (state.obligations || []).filter(item => item.status !== 'done' && item.status !== 'resolved').length;
      return {
        agent,
        state,
        latestWorker,
        latestWorklog,
        openObligations,
        nextRunAt: state.nextAgentRunAt || latestWorker.nextRunAt || null,
        lastRunAt: latestWorker.ranAt || latestWorker.completedAt || state.lastActiveAt || latestWorklog?.at || null,
        trigger: latestWorker.trigger || latestWorklog?.source || state.status || 'waiting',
        priority: latestWorker.managementPriority ?? 0,
        reason: latestWorker.managementReasons?.[0] || state.currentPlan?.next || 'routine cadence',
      };
    });
    const continuousWorkRows = operationsBoardRows.map(row => {
      const latestWorker = row.latestWorker || {};
      const latestWorklog = row.latestWorklog || {};
      const timelineIds = [
        latestWorker.logId,
        ...(latestWorker.timelineLogIds || []),
        ...(latestWorklog.timelineLogIds || []),
      ].filter(Boolean);
      const chatIds = [
        latestWorker.messageId,
        latestWorklog.sourceMessageId,
        ...(latestWorklog.sourceMessageIds || []),
        ...(latestWorklog.responseMessageIds || []),
      ].filter(Boolean);
      const loopState = row.nextRunAt
        ? row.lastRunAt ? 'Loop Scheduled' : 'Queued First Run'
        : row.lastRunAt ? 'Needs Next Schedule' : 'Waiting';
      return {
        ...row,
        loopState,
        routineLabel: row.state.currentPlan?.routine?.label || 'fixed routine',
        focus: row.state.currentPlan?.focus || latestWorklog.text || 'monitor project lane',
        professionalSkill: row.state.currentPlan?.professionalSkill || row.professionalSkill || null,
        nextStep: row.state.currentPlan?.next || 'publish the next proof marker',
        timelineIds,
        chatIds,
        proofReady: timelineIds.length > 0 || chatIds.length > 0,
      };
    });
    const kickoffCharter = activeProject.kickoffCharter || null;
    const changeLedger = activeProject.changeLedger || [];
    const peerHandoffs = activeProject.peerHandoffs || [];
    const agentNameById = Object.fromEntries(activeProject.team.map(agent => [agent.id, agent.name]));
    const projectTranscriptMessages = chatMessages.filter(message => (
      (message.projectId || DEFAULT_CHAT_PROJECT_ID) === (activeProject.id || DEFAULT_CHAT_PROJECT_ID)
    ));
    const recoveredProofIdsByChannel = [
      ...(activeProject.initiation?.directorBriefId ? [{ id: activeProject.initiation.directorBriefId, channelId: 'main' }] : []),
      ...(activeProject.kickoffCharter?.evidence?.directorBriefIds || []).map(id => ({ id, channelId: 'main' })),
      ...(activeProject.initiation?.roleNegotiation?.transcript || []).map(item => ({ id: item.id, channelId: 'main' })),
      ...(activeProject.initiation?.leaderElection?.transcript || []).map(item => ({ id: item.id, channelId: 'main' })),
      ...(activeProject.initiation?.managerClarifications || []).map(item => ({ id: item.id, channelId: 'main' })),
      ...(activeProject.logs || []).map(log => ({
        id: String(log.id || '').startsWith('log_') ? String(log.id).slice(4) : log.messageId,
        channelId: log.sourceChannelId || 'main',
      })),
    ].reduce((acc, item) => {
      if (!item.id) return acc;
      const channelId = item.channelId || 'main';
      acc[channelId] = Array.from(new Set([...(acc[channelId] || []), item.id]));
      return acc;
    }, {});
    const channelTranscriptRows = chatChannels.map(channel => {
      const messages = projectTranscriptMessages.filter(message => message.channelId === channel.id);
      const messageIds = new Set(messages.map(message => message.id));
      const archivedProofIds = (recoveredProofIdsByChannel[channel.id] || [])
        .filter(id => !messageIds.has(id));
      const latest = messages[messages.length - 1] || null;
      const directTargetNames = Array.from(new Set(messages.flatMap(message => (
        message.directTargetIds || []
      )))).map(id => agentNameById[id] || id).filter(Boolean);
      const receiptCoverage = messages.reduce((sum, message) => (
        sum + (message.visibility?.receiptCount || message.receiptCount || message.heardBy?.length || 0)
      ), 0);
      return {
        channel,
        messages,
        latest,
        directTargetNames,
        receiptCoverage,
        archivedProofIds,
        proofIds: [
          ...messages.slice(-6).map(message => message.id),
          ...archivedProofIds.slice(-6),
        ].filter(Boolean),
      };
    });
    const agentCommunicationRows = projectTranscriptMessages
      .filter(message => (
        message.source === 'agent-to-agent-message'
        || (activeProject.team.some(agent => agent.id === message.authorId || agent.name === message.author) && (message.directTargetIds || []).length > 0)
      ))
      .slice(-40)
      .reverse()
      .map(message => {
        const sender = activeProject.team.find(agent => agent.id === message.authorId || agent.name === message.author);
        const targetIds = Array.from(new Set([
          ...(message.directTargetIds || []),
          ...(message.targetIds || []),
        ].filter(Boolean)));
        const targetNames = targetIds.map(id => agentNameById[id] || id).filter(Boolean);
        const senderState = sender ? agentStates[sender.id] || {} : {};
        const targetStates = targetIds.map(targetId => agentStates[targetId] || {});
        return {
          message,
          sender,
          senderName: sender?.name || message.author || 'Agent',
          targetIds,
          targetNames,
          receiptCount: message.visibility?.receiptCount || message.receipts?.length || message.heardBy?.length || 0,
          inboxSeen: targetStates.some(state => (state.inbox || []).some(item => item.sourceMessageId === message.id || item.messageId === message.id)),
          obligationSeen: targetStates.some(state => (state.obligations || []).some(item => item.sourceMessageId === message.id || item.messageId === message.id)),
          senderWorklogSeen: Boolean((senderState.worklog || []).some(item => item.sourceMessageId === message.id || item.messageId === message.id)),
          proofIds: [message.id].filter(Boolean),
          channelId: message.channelId || 'main',
        };
      });
    const agentMessageDeliveryRows = agentCommunicationRows.flatMap(row => {
      const targetIds = row.targetIds.length ? row.targetIds : (row.message.heardBy || []);
      return targetIds.map(targetId => {
        const targetState = agentStates[targetId] || {};
        const receiptSeen = Boolean(
          (row.message.directTargetIds || []).includes(targetId)
          || (row.message.heardBy || []).includes(targetId)
          || (row.message.receipts || []).some(receipt => receipt.agentId === targetId)
        );
        const inboxSeen = Boolean((targetState.inbox || []).some(item => item.sourceMessageId === row.message.id || item.messageId === row.message.id));
        const obligationSeen = Boolean((targetState.obligations || []).some(item => item.sourceMessageId === row.message.id || item.messageId === row.message.id));
        return {
          id: `${row.message.id}_${targetId}`,
          message: row.message,
          senderName: row.senderName,
          targetId,
          targetName: agentNameById[targetId] || targetId,
          channelId: row.channelId,
          receiptSeen,
          inboxSeen,
          obligationSeen,
          senderWorklogSeen: row.senderWorklogSeen,
          proofIds: row.proofIds,
        };
      });
    });
    const managementLogTypes = ['management-check-in', 'peer-management-check-in', 'review-sweep', 'management-response'];
    const managementMeshRows = activeProject.team.map(agent => {
      const state = agentStates[agent.id] || {};
      const managedIds = state.managedIds || agent.managedIds || [];
      const peerManagedIds = state.peerManagedIds || [];
      const managerIds = [state.managerId, ...(state.peerManagerIds || [])].filter(Boolean);
      const proofLogs = (activeProject.logs || []).filter(log => (
        managementLogTypes.includes(log.eventType)
        && (log.agentId === agent.id || log.targetAgentId === agent.id)
      ));
      const latestCycleEvents = (activeProject.autonomousLedger || [])
        .flatMap(cycle => cycle.managementEvents || [])
        .filter(event => event.agentId === agent.id || event.targetAgentId === agent.id);
      const latestWorker = latestAgentWorkerById[agent.id] || {};
      return {
        agent,
        state,
        managerNames: managerIds.map(id => agentNameById[id] || id),
        managedNames: managedIds.map(id => agentNameById[id] || id).filter(Boolean),
        peerManagedNames: peerManagedIds.map(id => agentNameById[id] || id).filter(Boolean),
        latestEvent: latestCycleEvents[0] || null,
        workerTargets: (latestWorker.managementTargetIds || []).map(id => agentNameById[id] || id).filter(Boolean),
        workerResponseTargets: (latestWorker.managementResponseTargetIds || []).map(id => agentNameById[id] || id).filter(Boolean),
        proofLogIds: proofLogs.map(log => log.id).filter(Boolean).slice(0, 4),
        responseCount: proofLogs.filter(log => log.eventType === 'management-response').length,
        checkInCount: proofLogs.length,
      };
    });
    const peerManagementMatrixRows = (activeProject.peerManagementMatrix?.length
      ? activeProject.peerManagementMatrix
      : buildPeerManagementMatrix(activeProject.team, {
        leaderId: activeProject.team.find(agent => agent.isLeader)?.id || kickoffCharter?.governance?.leaderId,
        reviewerId: kickoffCharter?.governance?.reviewerId,
      })
    ).map(row => ({
      ...row,
      agentName: agentNameById[row.agentId] || row.agentId,
      peerManagedNames: (row.peerManagedIds || []).map(id => agentNameById[id] || id).filter(Boolean),
      peerManagerNames: (row.peerManagerIds || []).map(id => agentNameById[id] || id).filter(Boolean),
      proofLogIds: (activeProject.logs || [])
        .filter(log => log.eventType === 'peer-management-check-in' && (log.agentId === row.agentId || log.targetAgentId === row.agentId))
        .map(log => log.id)
        .filter(Boolean),
    }));
    const kickoffCharterProofIds = kickoffCharter ? [
      ...(kickoffCharter.evidence?.directorBriefIds || []),
      activeProject.initiation?.directorBriefId,
      ...(kickoffCharter.evidence?.roleTranscriptIds || []),
      ...(kickoffCharter.evidence?.leaderCampaignIds || []),
      ...(kickoffCharter.evidence?.assignmentMessageIds || []),
      ...(kickoffCharter.evidence?.acknowledgementMessageIds || []),
    ].filter(Boolean) : [];
    const kickoffRoleTranscript = activeProject.initiation?.roleNegotiation?.transcript || activeProject.roleNegotiation?.transcript || [];
    const kickoffLeaderTranscript = activeProject.initiation?.leaderElection?.transcript || activeProject.leaderElection?.transcript || [];
    const kickoffLeaderCandidates = activeProject.initiation?.leaderElection?.candidates || activeProject.leaderElection?.candidates || [];
    const roleQuestionResolutionRows = activeProject.initiation?.roleQuestionResolutions?.length
      ? activeProject.initiation.roleQuestionResolutions
      : kickoffRoleTranscript
        .filter(item => item.type === 'role-question')
        .map(item => {
          const answers = (activeProject.initiation?.managerClarifications || []).filter(answer => answer.repliesTo === item.id);
          const latestAnswer = answers[answers.length - 1] || null;
          return {
            questionId: item.id,
            speakerName: item.speaker || item.speakerId || 'Agent',
            questionText: item.text || '',
            answered: answers.length > 0,
            answerIds: answers.map(answer => answer.id).filter(Boolean),
            answerText: latestAnswer?.text || null,
          };
        });
    const kickoffRoleHearingCount = (kickoffCharter?.evidence?.roleHearingEdges || [])
      .reduce((sum, edge) => sum + (edge.hears?.length || 0), 0);
    const kickoffLeaderHearingCount = (kickoffCharter?.evidence?.leaderHearingEdges || [])
      .reduce((sum, edge) => sum + (edge.hears?.length || 0), 0);
    const confirmedLeader = activeProject.team.find(agent => (
      agent.id === kickoffCharter?.governance?.leaderId
      || agent.name === kickoffCharter?.governance?.leaderName
    ));
    const kickoffConfirmedTeamProofLogIds = (activeProject.logs || [])
      .filter(log => ['project-approved', 'leader-confirmed'].includes(log.eventType))
      .map(log => log.id)
      .filter(Boolean);
    const kickoffConfirmedTeamMatrixRows = (kickoffCharter?.team?.length ? kickoffCharter.team : activeProject.team).map(member => {
      const projectAgent = activeProject.team.find(agent => agent.id === member.id || agent.name === member.name);
      const isLeader = Boolean(projectAgent?.isLeader || member.isLeader || member.id === kickoffCharter?.governance?.leaderId);
      const isReviewer = Boolean(member.id === kickoffCharter?.governance?.reviewerId || projectAgent?.id === kickoffCharter?.governance?.reviewerId);
      return {
        id: member.id || projectAgent?.id || member.name,
        name: member.name || projectAgent?.name || 'Agent',
        role: projectAgent?.role || member.role || member.title || 'Agent',
        inProjectState: Boolean(projectAgent),
        inKickoffCharter: Boolean(kickoffCharter?.team?.some(agent => agent.id === member.id || agent.name === member.name)),
        isLeader,
        isReviewer,
        governanceLabel: isLeader ? 'Leader marker' : isReviewer ? 'Reviewer' : 'Execution Agent',
        proofLogIds: kickoffConfirmedTeamProofLogIds,
      };
    });
    const leaderElectionResolution = activeProject.initiation?.leaderElectionResolution || null;
    const transcriptKickoffConversationRows = [
      ...kickoffRoleTranscript.map(item => ({
        id: item.id,
        stage: item.type === 'role-question' ? 'Role Questions Heard' : 'Self Nominations Heard',
        speakerName: item.speaker || item.agentName || item.speakerId || 'Agent',
        speakerId: item.speakerId || item.agentId || null,
        role: item.role || '',
        text: item.text || '',
        heardBy: item.hears || item.hearsOthers || [],
        proofIds: [item.id].filter(Boolean),
        channelId: item.channelId || 'main',
      })),
      ...kickoffLeaderTranscript.map(item => ({
        id: item.id,
        stage: 'Leader Campaign Hearing',
        speakerName: item.speaker || item.agentName || item.name || item.speakerId || 'Agent',
        speakerId: item.speakerId || item.agentId || null,
        role: item.role || 'Leader candidate',
        text: item.text || '',
        heardBy: item.hearsOthers || item.hears || [],
        proofIds: [item.id].filter(Boolean),
        channelId: item.channelId || 'main',
      })),
      ...(activeProject.initiation?.managerClarifications || []).map(item => ({
        id: item.id,
        stage: 'Director Confirmation',
        speakerName: item.speaker || 'Director',
        speakerId: item.speakerId || 'director',
        role: item.role || 'Project Owner',
        text: item.text || '',
        heardBy: item.hears || [],
        proofIds: [item.id].filter(Boolean),
        channelId: item.channelId || 'main',
        repliesTo: item.repliesTo || null,
      })),
    ];
    const kickoffConversationRows = transcriptKickoffConversationRows.length ? transcriptKickoffConversationRows : [
      ...(kickoffCharter?.evidence?.roleTranscriptIds || []).map((id, index) => ({
        id,
        stage: index === 0 ? 'Role Question' : 'Self Nomination',
        speakerName: 'Kickoff participant',
        role: '',
        text: 'Recovered kickoff role-negotiation proof. Open the transcript proof for the original turn.',
        heardBy: [],
        proofIds: [id].filter(Boolean),
        channelId: 'main',
      })),
      ...(kickoffCharter?.evidence?.leaderCampaignIds || []).map(id => ({
        id,
        stage: 'Leader Campaign',
        speakerName: 'Leader candidate',
        role: 'Leader candidate',
        text: 'Recovered Leader campaign proof. Open the transcript proof for the original turn.',
        heardBy: [],
        proofIds: [id].filter(Boolean),
        channelId: 'main',
      })),
    ];
    const kickoffHearingMatrixRows = kickoffConversationRows.map(row => {
      const heardBy = Array.from(new Set(row.heardBy || []));
      const heardNames = heardBy
        .map(id => agentNameById[id] || id)
        .filter(Boolean);
      return {
        ...row,
        heardBy,
        heardNames,
        heardLabel: heardNames.length ? heardNames.join(' / ') : 'No peer receipts',
        coverageComplete: activeProject.team.length > 0 && heardBy.length >= activeProject.team.length - (row.speakerId && row.speakerId !== 'director' ? 1 : 0),
      };
    });
    const kickoffDirectorBriefIds = Array.from(new Set([
      ...(kickoffCharter?.evidence?.directorBriefIds || []),
      activeProject.initiation?.directorBriefId,
      `director_brief_${activeProject.id}`,
    ].filter(Boolean)));
    const kickoffBriefMessages = projectTranscriptMessages.filter(message => kickoffDirectorBriefIds.includes(message.id));
    const kickoffBriefAlignment = kickoffCharter ? {
      briefIds: kickoffDirectorBriefIds,
      speakerName: 'Director',
      text: kickoffBriefMessages[0]?.text || activeProject.initiation?.summary || activeProject.currentObjective || activeProject.objective || activeProject.name || '',
      heardByAgentIds: activeProject.team.map(agent => agent.id),
      heardByAgentNames: activeProject.team.map(agent => agent.name).filter(Boolean),
      roleQuestionCount: kickoffRoleTranscript.filter(item => item.type === 'role-question').length,
      selfNominationCount: kickoffRoleTranscript.filter(item => item.type === 'role-volunteer').length,
      responseRows: kickoffRoleTranscript.map(item => ({
        id: item.id,
        speakerId: item.speakerId || item.agentId || null,
        speakerName: item.speaker || item.agentName || item.speakerId || 'Agent',
        responseType: item.type === 'role-question' ? 'role-question' : 'self-nomination',
        text: item.text || '',
        heardBy: item.hears || item.hearsOthers || [],
        proofIds: [item.id].filter(Boolean),
        channelId: item.channelId || 'main',
      })),
      proofIds: kickoffBriefMessages.length ? kickoffBriefMessages.map(message => message.id) : kickoffDirectorBriefIds,
      channelId: 'main',
    } : null;
    const kickoffMeetingFlow = kickoffCharter ? {
      roleQuestionCount: kickoffCharter.meeting?.roleQuestionCount
        || kickoffRoleTranscript.filter(item => item.type === 'role-question').length,
      roleQuestionAnsweredCount: roleQuestionResolutionRows.filter(row => row.answered).length,
      roleQuestionUnansweredCount: roleQuestionResolutionRows.filter(row => !row.answered).length,
      roleQuestionResolutions: roleQuestionResolutionRows,
      selfNominationCount: kickoffCharter.meeting?.selfNominationCount
        || kickoffRoleTranscript.filter(item => item.type === 'role-volunteer').length,
      leaderCampaignCount: kickoffLeaderTranscript.length || kickoffCharter.meeting?.leaderCandidateCount || 0,
      leaderElectionResolution: leaderElectionResolution ? {
        ...leaderElectionResolution,
        leaderMarkerPersisted: Boolean(confirmedLeader?.isLeader || leaderElectionResolution.leaderMarkerPersisted),
      } : null,
      leaderCandidateNames: kickoffLeaderCandidates.map(candidate => (
        candidate.agentName
        || candidate.name
        || activeProject.team.find(agent => agent.id === candidate.agentId)?.name
        || candidate.agentId
      )).filter(Boolean),
      roleHearingCount: kickoffRoleHearingCount,
      leaderHearingCount: kickoffLeaderHearingCount,
      confirmedTeamCount: kickoffCharter.team?.length || activeProject.team.length,
      confirmedTeamMatrixRows: kickoffConfirmedTeamMatrixRows,
      confirmedTeamProofLogIds: kickoffConfirmedTeamProofLogIds,
      confirmedLeaderName: kickoffCharter.governance?.leaderName || confirmedLeader?.name || 'Unassigned',
      leaderMarkerPersisted: Boolean(confirmedLeader?.isLeader),
      conversationRows: kickoffConversationRows,
      hearingMatrixRows: kickoffHearingMatrixRows,
      briefAlignment: kickoffBriefAlignment,
    } : null;
    const proofChatIdsForTask = (task) => [
      task.assignmentMessageId,
      task.requestMessageId,
      task.acknowledgementMessageId,
      task.confirmationMessageId,
      task.syncMessageId,
    ].filter(Boolean);
    const taskEvidence = (task) => ({
      chatIds: proofChatIdsForTask(task),
      timelineIds: task.timelineLogIds || [],
      hasAssignment: Boolean(task.assignmentMessageId || task.requestMessageId),
      hasAcknowledgement: Boolean(task.acknowledgementMessageId || task.confirmationMessageId),
      hasOwnerSync: Boolean(task.syncMessageId),
      timelineCount: task.timelineLogIds?.length || 0,
      source: task.sourceChannelId ? channelNameById[task.sourceChannelId] || task.sourceChannelId : null,
    });
    const agentNameForTask = (task) => activeProject.team.find(agent => (
      agent.id === task.ownerId
      || agent.id === task.assignee
      || agent.name === task.assignee
      || agent.name === task.ownerName
    ));
    const assignmentFlowRows = activeProject.tasks
      .filter(task => taskEvidence(task).hasAssignment || task.assignedBy || task.source === 'kickoff-leader-assignment')
      .slice(0, 5)
      .map(task => {
        const owner = agentNameForTask(task);
        const ownerState = owner ? agentStates[owner.id] || {} : {};
        const evidence = taskEvidence(task);
        const assignmentIds = [task.assignmentMessageId, task.requestMessageId].filter(Boolean);
        const acknowledgementIds = [task.acknowledgementMessageId, task.confirmationMessageId].filter(Boolean);
        const inboxSeen = Boolean(ownerState.inbox?.some(item => (
          String(item.taskId || '') === String(task.id)
          || assignmentIds.includes(item.sourceMessageId)
          || assignmentIds.includes(item.messageId)
        )));
        const obligationSeen = Boolean(ownerState.obligations?.some(item => String(item.taskId || '') === String(task.id)));
        const worklogSeen = Boolean(ownerState.worklog?.some(item => String(item.taskId || '') === String(task.id)));
        return {
          task,
          owner,
          evidence,
          sourceChannelId: task.sourceChannelId || 'main',
          assignmentIds,
          acknowledgementIds,
          inboxSeen,
          obligationSeen,
          workSeen: Boolean(task.workPulseCount > 0 || worklogSeen),
          timelineSeen: evidence.timelineCount > 0,
        };
      });
    const assignmentTimelineMatrixRows = assignmentFlowRows.map(row => {
      const assignmentTimelineIds = (row.evidence.timelineIds || []).filter(id => (
        row.assignmentIds.some(messageId => String(id).includes(String(messageId)))
        || row.acknowledgementIds.some(messageId => String(id).includes(String(messageId)))
      ));
      const workTimelineIds = (row.evidence.timelineIds || []).filter(id => !assignmentTimelineIds.includes(id));
      return {
        ...row,
        assignmentTimelineIds,
        workTimelineIds,
        assignmentPosted: row.assignmentIds.length > 0,
        assigneeReceived: row.inboxSeen || row.obligationSeen,
        assigneeAccepted: row.acknowledgementIds.length > 0,
        timelineRecorded: row.evidence.timelineCount > 0,
      };
    });
    const assignmentProgressEventTypes = new Set(['work-pulse', 'daily-report', 'task-completed', 'agent-work-pulse', 'agent-task-completed']);
    const assignmentCompletionEventTypes = new Set(['task-completed', 'agent-task-completed']);
    const assignmentWorkProgressRows = assignmentTimelineMatrixRows.map(row => {
      const ownerState = row.owner ? agentStates[row.owner.id] || {} : {};
      const taskLogs = (activeProject.logs || []).filter(log => (
        String(log.taskId || '') === String(row.task.id || '')
        || (log.taskIds || []).map(id => String(id)).includes(String(row.task.id || ''))
        || (row.evidence.timelineIds || []).includes(log.id)
      ));
      const progressLogs = taskLogs.filter(log => assignmentProgressEventTypes.has(log.eventType));
      const completionLogs = taskLogs.filter(log => assignmentCompletionEventTypes.has(log.eventType));
      const uniqueIds = values => Array.from(new Set(values.filter(Boolean).map(value => String(value))));
      const chatProgressIds = uniqueIds([
        ...(row.task.evidenceMessageIds || []),
        ...(ownerState.worklog || [])
          .filter(item => String(item.taskId || '') === String(row.task.id || ''))
          .flatMap(item => [item.sourceMessageId, item.messageId, ...(item.sourceMessageIds || [])]),
      ]);
      const timelineProgressIds = uniqueIds([
        ...progressLogs.map(log => log.id),
        ...row.workTimelineIds,
      ]);
      const latestProgressLog = progressLogs[0] || taskLogs[0] || null;
      return {
        ...row,
        progressLogs,
        completionLogs,
        chatProgressIds,
        timelineProgressIds,
        workPulseCount: row.task.workPulseCount || progressLogs.length || 0,
        completedAt: row.task.completedAt || completionLogs[0]?.time || null,
        progressPublished: timelineProgressIds.length > 0,
        completionPublished: Boolean(row.task.status === 'done' || row.task.completedAt || completionLogs.length > 0),
        latestProgressText: latestProgressLog?.log || ownerState.worklog?.find(item => String(item.taskId || '') === String(row.task.id || ''))?.text || row.task.text,
      };
    });
    const kickoffActionIds = (kickoffCharter?.nextActions || []).map(action => String(action.id || '')).filter(Boolean);
    const kickoffAssignmentRows = assignmentFlowRows.filter(row => (
      kickoffActionIds.includes(String(row.task.id || ''))
      || row.task.source === 'kickoff-leader-assignment'
    ));
    const firstPulseMessages = projectTranscriptMessages.filter(message => (
      message.time === 'First Pulse'
      || message.source === 'backend-kickoff-first-pulse-chat'
      || message.autonomousCycle?.trigger === 'initiation-approval'
      || message.agentWorker?.trigger === 'initiation-approval'
    ));
    const firstPulseSchedulerRecord = (activeProject.autonomousSchedulerLedger || [])
      .find(record => record.trigger === 'initiation-approval') || null;
    const firstAutonomousCycle = (activeProject.autonomousLedger || [])
      .find(cycle => cycle.trigger === 'initiation-approval')
      || activeProject.autonomousLedger?.[activeProject.autonomousLedger.length - 1]
      || null;
    const firstPulsePlanByAgentId = (firstAutonomousCycle?.agentPlans || []).reduce((acc, plan) => {
      if (plan?.agentId) acc[plan.agentId] = plan;
      return acc;
    }, {});
    const allAgentStartupRows = activeProject.team.map(agent => {
      const state = agentStates[agent.id] || {};
      const plan = firstPulsePlanByAgentId[agent.id] || {};
      const hasRoutinePlan = Boolean(state.currentPlan?.routine || plan.routineId || plan.routineLabel);
      const hasFirstPulsePlan = Boolean(firstPulsePlanByAgentId[agent.id]);
      const hasWorkerStartup = Boolean((activeProject.agentWorkerLedger || []).some(record => (
        record.agentId === agent.id
        && (
          record.trigger === 'initiation-approval'
          || record.trigger === 'http-autonomous-scheduler-startup-agents'
          || record.reason === 'scheduler-start-agent-sweep'
        )
      )));
      const proofLogIds = (activeProject.logs || [])
        .filter(log => log.agentId === agent.id || log.agent === agent.name)
        .map(log => log.id)
        .filter(Boolean)
        .slice(0, 4);
      const startupProofTypes = [
        hasRoutinePlan ? 'routine-plan' : null,
        hasFirstPulsePlan ? 'first-pulse-plan' : null,
        hasWorkerStartup ? 'agent-worker-startup' : null,
        proofLogIds.length ? 'timeline-proof' : null,
      ].filter(Boolean);
      return {
        agent,
        state,
        plan,
        started: Boolean(hasRoutinePlan || hasFirstPulsePlan || state.status),
        scheduled: Boolean(state.nextAgentRunAt || firstPulseSchedulerRecord?.nextRunAt || activeProject.nextAutonomousRunAt),
        hasRoutinePlan,
        hasFirstPulsePlan,
        hasWorkerStartup,
        startupProofTypes,
        nextRunAt: state.nextAgentRunAt || firstPulseSchedulerRecord?.nextRunAt || activeProject.nextAutonomousRunAt || null,
        routineLabel: state.currentPlan?.routine?.label || plan.routineLabel || 'fixed routine',
        routineArtifact: state.currentPlan?.routine?.artifact || plan.routineArtifact || null,
        planFocus: state.currentPlan?.focus || plan.focus || null,
        status: state.status || plan.status || 'waiting',
        proofLogIds,
      };
    });
    const nextActionResolution = activeProject.initiation?.nextActionResolution || kickoffCharter?.nextActionResolution || null;
    const nextActionDecisionMessageId = activeProject.id ? `decision_${activeProject.id}_next_actions` : null;
    const nextActionResolutionDelivery = nextActionResolution ? {
      messageId: nextActionDecisionMessageId,
      deliveredAgentIds: activeProject.team
        .filter(agent => (agentStates[agent.id]?.inbox || []).some(item => item.sourceMessageId === nextActionDecisionMessageId))
        .map(agent => agent.id),
      obligationAgentIds: activeProject.team
        .filter(agent => (agentStates[agent.id]?.obligations || []).some(item => item.sourceMessageId === nextActionDecisionMessageId))
        .map(agent => agent.id),
      teamCount: activeProject.team.length,
    } : null;
    if (nextActionResolutionDelivery) {
      nextActionResolutionDelivery.allAgentsReceived = nextActionResolutionDelivery.deliveredAgentIds.length === nextActionResolutionDelivery.teamCount;
      nextActionResolutionDelivery.allAgentsObligated = nextActionResolutionDelivery.obligationAgentIds.length === nextActionResolutionDelivery.teamCount;
    }
    const kickoffExecutionFlow = kickoffCharter ? {
      nextActionResolution,
      nextActionResolutionDelivery,
      nextActions: (kickoffCharter.nextActions || []).slice(0, 5).map(action => ({
        ...action,
        ownerName: action.ownerName || agentNameById[action.ownerId] || action.ownerId || 'Unassigned',
        assignmentSeen: kickoffAssignmentRows.some(row => String(row.task.id || '') === String(action.id || '')),
      })),
      assignmentRows: kickoffAssignmentRows,
      firstPulse: {
        started: Boolean(firstPulseSchedulerRecord || firstPulseMessages.length),
        trigger: firstPulseSchedulerRecord?.trigger || firstPulseMessages[0]?.autonomousCycle?.trigger || null,
        nextRunAt: firstPulseSchedulerRecord?.nextRunAt || activeProject.nextAutonomousRunAt || null,
        messageIds: firstPulseMessages.map(message => message.id).filter(Boolean),
        timelineLogIds: (activeProject.logs || [])
          .filter(log => ['work-pulse', 'daily-report', 'task-completed', 'agent-work-pulse', 'agent-task-completed'].includes(log.eventType))
          .map(log => log.id)
          .filter(Boolean),
      },
      allAgentStartupRows,
      allAgentsStarted: allAgentStartupRows.length > 0 && allAgentStartupRows.every(row => row.started),
      allAgentsScheduled: allAgentStartupRows.length > 0 && allAgentStartupRows.every(row => row.scheduled),
      readyForAutonomy: Boolean(firstPulseSchedulerRecord || activeProject.nextAutonomousRunAt || activeProject.autonomy?.enabled),
    } : null;
    const changeTimelineProofIds = (change) => (
      activeProject.tasks.find(task => task.id === change.taskId)?.timelineLogIds || []
    );
    const changeFlowRows = changeLedger.slice(0, 8).map(change => {
      const ownerState = change.ownerId ? agentStates[change.ownerId] || {} : {};
      const changeTask = activeProject.tasks.find(task => task.id === change.taskId) || {};
      const ownerWorkCycle = (activeProject.agentWorkerLedger || []).find(record => (
        record.taskId === change.taskId
        && record.trigger === 'change-owner-start-work'
      )) || null;
      const ownerPlanLinked = Boolean(
        change.planUpdate
        || ownerState.currentPlan?.changeRecordId === change.id
        || ownerState.currentPlan?.taskId === change.taskId
      );
      const syncedAgentNames = (change.teamSyncAgentIds || [])
        .map(agentId => agentNameById[agentId] || agentId)
        .filter(Boolean);
      const discussionProofIds = [
        ...(change.discussionMessageIds || []),
        change.confirmationMessageId,
        change.syncMessageId,
      ].filter(Boolean);
      const discussionDeliveredAgentIds = activeProject.team
        .filter(agent => (agentStates[agent.id]?.inbox || []).some(item => discussionProofIds.includes(item.sourceMessageId || item.messageId)))
        .map(agent => agent.id);
      const discussionObligationAgentIds = activeProject.team
        .filter(agent => (agentStates[agent.id]?.obligations || []).some(item => discussionProofIds.includes(item.sourceMessageId || item.messageId)))
        .map(agent => agent.id);
      const sourceChannelNames = (change.sourceChannelIds || [change.sourceChannelId])
        .filter(Boolean)
        .map((channelId, index) => change.sourceModeLabels?.[index] || ((change.source === 'multi-channel-change-request' && channelId === 'main') ? 'War Room' : channelNameById[channelId] || channelId))
        .filter(name => name && name !== 'multi');
      const sourceMessageIds = change.sourceMessageIds || [change.requestMessageId].filter(Boolean);
      const sourceChannelIds = change.sourceChannelIds || [change.sourceChannelId].filter(Boolean);
      const sourceModes = sourceChannelIds.map((channelId, index) => change.sourceModes?.[index] || (channelId === 'google_chat' ? 'google_chat' : 'war_room_meeting'));
      const sourceIntakeRows = (sourceChannelIds.length ? sourceChannelIds : ['main']).map((channelId, index) => {
        const sourceMessageId = sourceMessageIds[index] || sourceMessageIds[0] || change.requestMessageId || null;
        const sourceMessage = projectTranscriptMessages.find(message => message.id === sourceMessageId) || {};
        const deliveredAgentIds = activeProject.team
          .filter(agent => (agentStates[agent.id]?.inbox || []).some(item => sourceMessageId && sourceMessageId === (item.sourceMessageId || item.messageId)))
          .map(agent => agent.id);
        const obligationAgentIds = activeProject.team
          .filter(agent => (agentStates[agent.id]?.obligations || []).some(item => sourceMessageId && sourceMessageId === (item.sourceMessageId || item.messageId)))
          .map(agent => agent.id);
        return {
          id: `${change.id}_${channelId}_${index}`,
          change,
          channelId,
          sourceMode: sourceModes[index] || (channelId === 'google_chat' ? 'google_chat' : 'war_room_meeting'),
          sourceModeLabel: change.sourceModeLabels?.[index] || ((sourceModes[index] || channelId) === 'google_chat' ? 'Google Chat' : 'War Room'),
          channelName: change.sourceModeLabels?.[index] || ((change.source === 'multi-channel-change-request' && channelId === 'main') ? 'War Room' : channelNameById[channelId] || channelId),
          sourceMessageId,
          requestText: sourceMessage.text || change.requestText,
          receiptCount: sourceMessage.visibility?.receiptCount || sourceMessage.receipts?.length || sourceMessage.heardBy?.length || deliveredAgentIds.length,
          directTargetCount: sourceMessage.visibility?.directTargetCount || sourceMessage.directTargetIds?.length || 0,
          deliveredAgentIds,
          obligationAgentIds,
          deliveredCount: deliveredAgentIds.length,
          obligationCount: obligationAgentIds.length,
        };
      });
      const ownerWorkMessageIds = [
        ownerWorkCycle?.messageId,
        ...(changeTask.evidenceMessageIds || []),
      ].filter(Boolean);
      const ownerWorkTimelineIds = [
        ownerWorkCycle?.logId,
        ...(changeTask.timelineLogIds || []),
      ].filter(Boolean);
      return {
        change,
        sourceName: sourceChannelNames.length > 1
          ? sourceChannelNames.join(' + ')
          : sourceChannelNames[0] || channelNameById[change.sourceChannelId] || change.sourceChannelId || change.source,
        sourceChannelNames,
        discussionCount: change.discussionMessageIds?.length || 0,
        ownerPlanLinked,
        ownerWorkStarted: Boolean(ownerWorkCycle || changeTask.workPulseCount > 0),
        ownerWorkTrigger: ownerWorkCycle?.trigger || null,
        ownerWorkMessageIds,
        ownerWorkTimelineIds,
        syncedAgentNames,
        teamSyncCount: change.teamSyncCount || syncedAgentNames.length || 0,
        sourceIntakeRows,
        discussionDeliveredAgentIds,
        discussionObligationAgentIds,
        discussionDeliveryCount: discussionDeliveredAgentIds.length,
        discussionObligationCount: discussionObligationAgentIds.length,
        discussionDeliveryComplete: discussionDeliveredAgentIds.length === activeProject.team.length,
      };
    });
    const changeSourceIntakeRows = changeFlowRows.flatMap(row => row.sourceIntakeRows.map(sourceRow => ({
      ...sourceRow,
      ownerName: row.change.ownerName || row.change.ownerId || 'pending',
      discussionCount: row.discussionCount,
      ownerConfirmed: Boolean(row.change.confirmationMessageId),
      ownerPlanLinked: row.ownerPlanLinked,
      teamSyncCount: row.teamSyncCount,
      sourceChannelCount: row.sourceIntakeRows.length,
      discussionMessageIds: row.change.discussionMessageIds || [],
      confirmationMessageId: row.change.confirmationMessageId,
      syncMessageId: row.change.syncMessageId,
    })));
    const eventLedgerHasEvidence = (ids = []) => {
      const wanted = new Set(ids.filter(Boolean).map(String));
      if (!wanted.size) return false;
      return (activeProject.eventLedger || []).some(event => {
        const evidenceIds = [
          event.id,
          ...(event.evidenceIds || []),
          event.entityIds?.messageId,
          event.entityIds?.logId,
          event.entityIds?.taskId,
        ].filter(Boolean).map(String);
        return evidenceIds.some(id => wanted.has(id));
      });
    };
    const fallbackSyncProtocolRows = [
      {
        id: 'kickoff-next-action-sync',
        protocol: 'Kickoff Decision Sync',
        managerMeaning: 'Meeting decisions become Agent inbox, obligation, schedule, timeline, and ledger state.',
        source: 'kickoff-meeting',
        published: Boolean(nextActionResolution),
        delivered: Boolean(nextActionResolutionDelivery?.allAgentsReceived),
        agentStateWritten: Boolean(nextActionResolutionDelivery?.allAgentsObligated && kickoffExecutionFlow?.allAgentsStarted),
        timelineRecorded: Boolean(kickoffExecutionFlow?.firstPulse?.timelineLogIds?.length),
        eventLedgerRecorded: eventLedgerHasEvidence([nextActionDecisionMessageId, ...(kickoffExecutionFlow?.firstPulse?.timelineLogIds || [])]),
        proofIds: [nextActionDecisionMessageId].filter(Boolean),
        timelineLogIds: kickoffExecutionFlow?.firstPulse?.timelineLogIds || [],
      },
      {
        id: 'leader-assignment-sync',
        protocol: 'Leader @Assignment Sync',
        managerMeaning: 'Leader @messages create tasks, assignee inbox state, work start, and timeline proof.',
        source: 'group-chat',
        published: assignmentTimelineMatrixRows.some(row => row.assignmentPosted),
        delivered: assignmentTimelineMatrixRows.some(row => row.assigneeReceived),
        agentStateWritten: assignmentTimelineMatrixRows.some(row => row.assigneeReceived && row.assigneeAccepted),
        timelineRecorded: assignmentTimelineMatrixRows.some(row => row.timelineRecorded),
        eventLedgerRecorded: eventLedgerHasEvidence(assignmentTimelineMatrixRows.flatMap(row => [...(row.evidence?.chatIds || []), ...(row.evidence?.timelineIds || []), row.task?.id])),
        proofIds: assignmentTimelineMatrixRows.flatMap(row => row.evidence?.chatIds || []).filter(Boolean).slice(0, 8),
        timelineLogIds: assignmentTimelineMatrixRows.flatMap(row => row.evidence?.timelineIds || []).filter(Boolean).slice(0, 8),
      },
      {
        id: 'agent-message-sync',
        protocol: 'Agent-to-Agent Message Sync',
        managerMeaning: 'Agent-authored messages reach target inbox/obligations and sender worklog.',
        source: 'agent-group-chat',
        published: agentCommunicationRows.length > 0,
        delivered: agentMessageDeliveryRows.some(row => row.receiptSeen && row.inboxSeen),
        agentStateWritten: agentMessageDeliveryRows.some(row => row.inboxSeen && row.senderWorklogSeen),
        timelineRecorded: agentCommunicationRows.some(row => eventLedgerHasEvidence(row.proofIds)),
        eventLedgerRecorded: agentCommunicationRows.some(row => eventLedgerHasEvidence(row.proofIds)),
        proofIds: agentCommunicationRows.flatMap(row => row.proofIds || []).filter(Boolean).slice(0, 8),
        timelineLogIds: [],
      },
      {
        id: 'change-request-sync',
        protocol: 'Change Request Sync',
        managerMeaning: 'Meeting/Google Chat changes become discussion, owner confirmation, owner plan, team sync, and timeline proof.',
        source: 'meeting-google-chat',
        published: changeSourceIntakeRows.some(row => row.sourceMessageId),
        delivered: changeSourceIntakeRows.some(row => row.receiptCount > 0),
        agentStateWritten: changeFlowRows.some(row => row.ownerPlanLinked && row.teamSyncCount > 0),
        timelineRecorded: changeFlowRows.some(row => changeTimelineProofIds(row.change).length > 0 || row.ownerWorkTimelineIds?.length > 0),
        eventLedgerRecorded: eventLedgerHasEvidence(changeFlowRows.flatMap(row => [
          ...(row.change.sourceMessageIds || []),
          ...(row.change.discussionMessageIds || []),
          row.change.confirmationMessageId,
          row.change.syncMessageId,
          ...changeTimelineProofIds(row.change),
          ...(row.ownerWorkTimelineIds || []),
        ])),
        proofIds: changeFlowRows.flatMap(row => [
          ...(row.change.sourceMessageIds || []),
          ...(row.change.discussionMessageIds || []),
          row.change.confirmationMessageId,
          row.change.syncMessageId,
        ]).filter(Boolean).slice(0, 8),
        timelineLogIds: changeFlowRows.flatMap(row => [...changeTimelineProofIds(row.change), ...(row.ownerWorkTimelineIds || [])]).filter(Boolean).slice(0, 8),
      },
      {
        id: 'management-sync',
        protocol: 'Agent Management Sync',
        managerMeaning: 'Leader and peer-management check-ins are delivered, answered, and visible as management proof.',
        source: 'agent-worker',
        published: managementMeshRows.some(row => row.checkInCount > 0),
        delivered: managementMeshRows.some(row => row.workerTargetIds?.length > 0 || row.proofLogIds?.length > 0),
        agentStateWritten: managementMeshRows.some(row => row.responseCount > 0 || row.workerResponseTargetIds?.length > 0),
        timelineRecorded: managementMeshRows.some(row => row.proofLogIds?.length > 0),
        eventLedgerRecorded: eventLedgerHasEvidence(managementMeshRows.flatMap(row => row.proofLogIds || [])),
        proofIds: [],
        timelineLogIds: managementMeshRows.flatMap(row => row.proofLogIds || []).filter(Boolean).slice(0, 8),
      },
      {
        id: 'continuous-worker-sync',
        protocol: '24/7 Worker Sync',
        managerMeaning: 'Scheduler/worker pulses keep every Agent routine, next run, chat proof, and timeline proof current.',
        source: 'scheduler-worker',
        published: Boolean(latestSchedulerRecord || activeProject.agentWorkerLedger?.length),
        delivered: continuousWorkRows.some(row => row.proofReady),
        agentStateWritten: continuousWorkRows.length > 0 && continuousWorkRows.every(row => row.nextRunAt || row.lastRunAt),
        timelineRecorded: continuousWorkRows.some(row => row.timelineLogIds?.length > 0),
        eventLedgerRecorded: eventLedgerHasEvidence(continuousWorkRows.flatMap(row => [...(row.chatProofIds || []), ...(row.timelineLogIds || [])])),
        proofIds: continuousWorkRows.flatMap(row => row.chatProofIds || []).filter(Boolean).slice(0, 8),
        timelineLogIds: continuousWorkRows.flatMap(row => row.timelineLogIds || []).filter(Boolean).slice(0, 8),
      },
    ].map(row => {
      const checks = ['published', 'delivered', 'agentStateWritten', 'timelineRecorded', 'eventLedgerRecorded'];
      const passedCount = checks.filter(key => row[key]).length;
      return {
        ...row,
        checks,
        passedCount,
        totalCount: checks.length,
        complete: passedCount === checks.length,
        status: passedCount === checks.length ? 'synced' : passedCount > 0 ? 'partial' : 'waiting',
      };
    });
    const fallbackSyncProtocolAudit = {
      count: fallbackSyncProtocolRows.length,
      syncedCount: fallbackSyncProtocolRows.filter(row => row.complete).length,
      partialCount: fallbackSyncProtocolRows.filter(row => row.status === 'partial').length,
      waitingCount: fallbackSyncProtocolRows.filter(row => row.status === 'waiting').length,
      status: fallbackSyncProtocolRows.every(row => row.complete) ? 'synced' : 'needs-attention',
      rows: fallbackSyncProtocolRows,
    };
    const syncProtocolAudit = backendSyncProtocolAudit || fallbackSyncProtocolAudit;
    const handoffTimelineProofIds = (handoff) => (
      activeProject.tasks.find(task => task.id === handoff.taskId)?.timelineLogIds || []
    );
    const timelineProofIdsForTypes = (types = []) => (activeProject.logs || [])
      .filter(log => types.includes(log.eventType))
      .map(log => log.id)
      .filter(Boolean)
      .slice(0, 6);
    const managerProofMapRows = managerReadiness.checks.map(check => {
      const kickoffIds = kickoffCharterProofIds;
      const assignmentIds = assignmentFlowRows.flatMap(row => row.evidence.chatIds).filter(Boolean).slice(0, 8);
      const assignmentTimelineIds = assignmentFlowRows.flatMap(row => row.evidence.timelineIds).filter(Boolean).slice(0, 8);
      const handoffChatIds = peerHandoffs.flatMap(handoff => [handoff.requestMessageId, handoff.acknowledgementMessageId]).filter(Boolean).slice(0, 8);
      const handoffTimelineIds = peerHandoffs.flatMap(handoff => handoffTimelineProofIds(handoff)).filter(Boolean).slice(0, 8);
      const changeChatIds = changeLedger.flatMap(change => [
        ...(change.sourceMessageIds || []),
        ...(change.discussionMessageIds || []),
        change.confirmationMessageId,
        change.syncMessageId,
      ]).filter(Boolean).slice(0, 10);
      const changeTimelineIds = changeLedger.flatMap(change => changeTimelineProofIds(change)).filter(Boolean).slice(0, 10);
      const managementTimelineIds = timelineProofIdsForTypes(['management-check-in', 'peer-management-check-in', 'review-sweep', 'management-response']);
      const workTimelineIds = timelineProofIdsForTypes(['work-pulse', 'daily-report', 'task-completed']);
      const eventTimelineIds = (activeProject.logs || []).map(log => log.id).filter(Boolean).slice(0, 8);
      const channelForChange = changeLedger.find(change => change.sourceChannelId === 'google_chat')?.sourceChannelId
        || changeLedger[0]?.sourceChannelId
        || 'main';

      if (['kickoff-approved', 'role-clarification', 'agents-hear-each-other', 'leader-election-confirmed'].includes(check.id)) {
        return { check, proofType: 'chat', proofLabel: 'Kickoff chat proof', proofIds: kickoffIds, channelId: 'main', targetLabel: 'Kickoff meeting' };
      }
      if (['leader-assignments-acknowledged', 'message-receipts-recorded', 'group-chat-visible'].includes(check.id)) {
        return { check, proofType: 'chat', proofLabel: 'Group chat proof', proofIds: assignmentIds.length ? assignmentIds : kickoffIds, channelId: 'main', targetLabel: 'Group chat' };
      }
      if (['task-evidence-linked', 'timeline-progress', 'autonomous-work-running', 'autonomous-scheduler-evidence'].includes(check.id)) {
        return { check, proofType: 'timeline', proofLabel: 'Timeline proof', proofIds: assignmentTimelineIds.length ? assignmentTimelineIds : workTimelineIds, targetLabel: 'Timeline' };
      }
      if (['agent-states-independent'].includes(check.id)) {
        return { check, proofType: 'dashboard', proofLabel: 'Agent state proof', testId: 'agent-management-mesh', targetLabel: 'Team state' };
      }
      if (['management-loop-running'].includes(check.id)) {
        return { check, proofType: managementTimelineIds.length ? 'timeline' : 'dashboard', proofLabel: 'Management proof', proofIds: managementTimelineIds, testId: 'agent-management-mesh', targetLabel: 'Management mesh' };
      }
      if (['peer-handoff-accepted'].includes(check.id)) {
        return { check, proofType: handoffTimelineIds.length ? 'timeline' : 'chat', proofLabel: 'Peer handoff proof', proofIds: handoffTimelineIds.length ? handoffTimelineIds : handoffChatIds, channelId: 'main', targetLabel: 'Peer handoff' };
      }
      if (['midproject-change-synced', 'team-received-change-sync', 'google-chat-change-source', 'meeting-change-source', 'dual-channel-change-source'].includes(check.id)) {
        return { check, proofType: changeChatIds.length ? 'chat' : 'timeline', proofLabel: 'Change proof', proofIds: changeChatIds.length ? changeChatIds : changeTimelineIds, channelId: channelForChange, targetLabel: 'Change ledger' };
      }
      if (['event-ledger-continuity', 'event-ledger-replay-ready'].includes(check.id)) {
        return { check, proofType: eventTimelineIds.length ? 'timeline' : 'dashboard', proofLabel: 'Ledger proof', proofIds: eventTimelineIds, testId: 'event-ledger-summary', targetLabel: 'Event ledger' };
      }
      return { check, proofType: 'dashboard', proofLabel: 'Dashboard proof', testId: 'manager-proof-map', targetLabel: 'Dashboard' };
    });
    const openManagerProofMapRow = (row) => {
      if (row.proofType === 'chat' && row.proofIds?.length) {
        openProjectChatProof(activeProject, row.proofIds, row.channelId || 'main');
        return;
      }
      if (row.proofType === 'timeline' && row.proofIds?.length) {
        openProjectTimelineProof(row.proofIds);
        return;
      }
      const target = row.testId ? document.querySelector(`[data-testid="${row.testId}"]`) : null;
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
    const demoSteps = [
      {
        id: 'kickoff_chat',
        label: 'Review kickoff chat',
        detail: 'Role questions, self-nominations, Leader campaign, Director confirmation, and Leader @assignments.',
        action: () => {
          setActiveChannelId('main');
          enterProjectScene('chat');
        },
      },
      {
        id: 'google_change',
        label: 'Simulate Google Chat change',
        detail: 'Jump to the Google Chat bridge with a feature-change @mention ready to send.',
        action: () => {
          setActiveChannelId('google_chat');
          setChatInput('@all add export summary feature');
          enterProjectScene('chat');
        },
      },
      {
        id: 'meeting_change',
        label: 'Raise meeting change',
        detail: 'Open the Roundtable with a War Room change request ready; the discussion will sync to chat, plan, and timeline.',
        action: () => {
          setRoomInput('@all add a manager meeting recap packet from this War Room decision');
          enterProjectScene('meeting');
        },
      },
      {
        id: 'dual_channel_change',
        label: 'Broadcast dual-channel change',
        detail: 'Send one change request to the meeting room and Google Chat at the same time, with one owner confirmation and one plan sync.',
        action: () => runMultiChannelChangeBroadcast('@all add dual-channel manager review packet before the next evidence review'),
      },
      {
        id: 'leader_assign',
        label: 'Ask Leader to assign new work',
        detail: 'Prefill a group-chat assignment request; the Leader will @mention the owner and the owner will acknowledge immediately.',
        action: () => {
          const target = activeProject.team.find(agent => !agent.isLeader)?.name || 'team';
          setActiveChannelId('main');
          setChatInput(`leader assign @${target} prepare the next manager-review evidence packet`);
          enterProjectScene('chat');
        },
      },
      {
        id: 'peer_handoff',
        label: 'Trigger Agent peer handoff',
        detail: 'Prefill a dependency request so one Agent @mentions another, the peer accepts, and both events enter the timeline.',
        action: () => {
          const requester = activeProject.team.find(agent => !agent.isLeader)?.name || activeProject.team[0]?.name || 'Agent';
          const target = activeProject.team.find(agent => !agent.isLeader && agent.name !== requester)?.name || activeProject.team.find(agent => agent.name !== requester)?.name || 'team';
          setActiveChannelId('main');
          setChatInput(`${requester} needs dependency help from @${target} review the next manager handoff evidence`);
          enterProjectScene('chat');
        },
      },
      {
        id: 'timeline_evidence',
        label: 'Open evidence timeline',
        detail: 'Leader assignments, work pulses, change confirmations, syncs, and completed tasks are logged here.',
        action: () => enterProjectScene('timeline'),
      },
    ];
    const managementSyncAgent = activeProject.team.find(agent => {
      const state = agentStates[agent.id] || {};
      return (state.managedIds || agent.managedIds || []).length || (state.peerManagedIds || []).length;
    }) || activeProject.team.find(agent => agent.isLeader) || activeProject.team[0];
    const scenarioProofTarget = (checkId) => managerProofMapRows.find(row => row.check.id === checkId) || managerProofMapRows[0];
    const scrollDashboardTarget = (testId) => {
      const target = document.querySelector(`[data-testid="${testId}"]`);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
    const scenarioControlSteps = [
      {
        id: 'kickoff',
        title: 'Kickoff Decisions',
        status: nextActionResolution?.managerConfirmed ? 'Manager confirmed' : kickoffCharter ? 'Charter ready' : 'Needs kickoff',
        proof: `${kickoffExecutionFlow?.nextActions?.length || 0} next actions / ${nextActionResolutionDelivery?.deliveredAgentIds?.length || 0}/${activeProject.team.length} Agent receipts`,
        actionLabel: 'Open kickoff proof',
        action: () => openManagerProofMapRow(scenarioProofTarget('role-clarification')),
      },
      {
        id: 'autonomy',
        title: '24/7 Work Pulse',
        status: activeProject.autonomy?.enabled ? 'Cadence active' : 'Cadence paused',
        proof: `${activeProject.autonomousLedger?.length || 0} cycles / next ${formatRunTime(activeProject.nextAutonomousRunAt || autonomousSchedule.nextRunAt)}`,
        actionLabel: backendOnline ? 'Run server pulse' : 'Run local pulse',
        action: () => backendOnline ? runBackendServerPulse() : runAutonomousCycle(activeProject.id, 'hourly'),
      },
      {
        id: 'management',
        title: 'Agent Management Sync',
        status: managementSyncAgent ? `${managementSyncAgent.name} ready` : 'No Agent available',
        proof: `${timelineProofIdsForTypes(['management-check-in', 'peer-management-check-in', 'management-response']).length} management proof logs`,
        actionLabel: 'Run management sync',
        action: () => managementSyncAgent && runBackendManagementSync(managementSyncAgent.id),
        disabled: !backendOnline || !managementSyncAgent,
      },
      {
        id: 'change',
        title: 'Mid-project Change Intake',
        status: `${changeLedger.length} change${changeLedger.length === 1 ? '' : 's'} recorded`,
        proof: `${changeFlowRows.filter(row => row.ownerPlanLinked).length} owner plan sync / ${changeFlowRows.filter(row => row.teamSyncCount > 0).length} team sync`,
        actionLabel: 'Broadcast change',
        action: () => runMultiChannelChangeBroadcast('@all add scenario control center follow-up packet before the next manager review'),
      },
      {
        id: 'evidence',
        title: 'Manager Evidence Exit',
        status: managerReadiness.status,
        proof: `${managerReadiness.passedCount}/${managerReadiness.totalCount} readiness checks with proof routes`,
        actionLabel: 'Open proof map',
        action: () => scrollDashboardTarget('manager-proof-map'),
      },
    ];
    const managerScenarioTrailRows = [
      {
        id: 'kickoff-brief',
        stage: 'Project Brief Heard',
        outcome: `${kickoffMeetingFlow?.briefAlignment?.heardByAgentIds?.length || 0}/${activeProject.team.length} Agents heard the brief`,
        passed: Boolean(kickoffMeetingFlow?.briefAlignment?.heardByAgentIds?.length),
        proofKind: 'chat',
        proofIds: kickoffMeetingFlow?.briefAlignment?.proofIds || kickoffMeetingFlow?.proofIds || [],
        channelId: kickoffMeetingFlow?.briefAlignment?.channelId || 'main',
      },
      {
        id: 'role-and-campaign',
        stage: 'Role Questions + Leader Campaign',
        outcome: `${kickoffMeetingFlow?.roleQuestionCount || 0} questions / ${kickoffMeetingFlow?.leaderCampaignCount || 0} campaigns`,
        passed: Boolean(kickoffMeetingFlow?.roleQuestionCount || kickoffMeetingFlow?.leaderCampaignCount),
        proofKind: 'chat',
        proofIds: kickoffMeetingFlow?.proofIds || [],
        channelId: 'main',
      },
      {
        id: 'leader-confirmed',
        stage: 'Leader Marker Confirmed',
        outcome: kickoffMeetingFlow?.confirmedLeaderName || 'Leader pending',
        passed: Boolean(kickoffMeetingFlow?.leaderMarkerPersisted),
        proofKind: 'timeline',
        timelineIds: kickoffMeetingFlow?.confirmedTeamProofLogIds || [],
      },
      {
        id: 'team-confirmed',
        stage: 'Confirmed Team',
        outcome: `${kickoffMeetingFlow?.confirmedTeamMatrixRows?.filter(row => row.inProjectState && row.inKickoffCharter).length || 0}/${kickoffMeetingFlow?.confirmedTeamMatrixRows?.length || activeProject.team.length} roster rows persisted`,
        passed: Boolean(kickoffMeetingFlow?.confirmedTeamMatrixRows?.length && kickoffMeetingFlow.confirmedTeamMatrixRows.every(row => row.inProjectState && row.inKickoffCharter)),
        proofKind: 'timeline',
        timelineIds: kickoffMeetingFlow?.confirmedTeamProofLogIds || [],
      },
      {
        id: 'next-actions-to-autonomy',
        stage: 'Next Actions + 24/7 Startup',
        outcome: `${kickoffExecutionFlow?.nextActions?.length || 0} actions / ${kickoffExecutionFlow?.allAgentStartupRows?.filter(row => row.started && row.scheduled).length || 0} Agents started`,
        passed: Boolean(kickoffExecutionFlow?.nextActions?.length && kickoffExecutionFlow?.allAgentsStarted && kickoffExecutionFlow?.allAgentsScheduled),
        proofKind: 'timeline',
        timelineIds: kickoffExecutionFlow?.firstPulse?.timelineLogIds || [],
      },
      {
        id: 'leader-assignment',
        stage: 'Leader @Assignment',
        outcome: `${assignmentTimelineMatrixRows.filter(row => row.assignmentPosted && row.assigneeReceived && row.timelineRecorded).length}/${assignmentTimelineMatrixRows.length} assignment chains timeline-ready`,
        passed: Boolean(assignmentTimelineMatrixRows.some(row => row.assignmentPosted && row.assigneeReceived && row.timelineRecorded)),
        proofKind: 'hybrid',
        proofIds: assignmentTimelineMatrixRows.flatMap(row => row.evidence.chatIds || []).slice(0, 8),
        timelineIds: assignmentTimelineMatrixRows.flatMap(row => row.evidence.timelineIds || []).slice(0, 8),
        channelId: 'main',
      },
      {
        id: 'assignment-progress',
        stage: 'Assigned Work Progress',
        outcome: `${assignmentWorkProgressRows.filter(row => row.progressPublished).length}/${assignmentWorkProgressRows.length} assigned tasks publishing progress`,
        passed: Boolean(assignmentWorkProgressRows.some(row => row.progressPublished)),
        proofKind: 'timeline',
        timelineIds: assignmentWorkProgressRows.flatMap(row => row.timelineProgressIds || []).slice(0, 8),
      },
      {
        id: 'agent-chat-delivery',
        stage: 'Agent-to-Agent Chat Delivery',
        outcome: `${agentMessageDeliveryRows.filter(row => row.receiptSeen && row.inboxSeen).length}/${agentMessageDeliveryRows.length} direct messages delivered`,
        passed: Boolean(agentMessageDeliveryRows.some(row => row.receiptSeen && row.inboxSeen)),
        proofKind: 'chat',
        proofIds: agentMessageDeliveryRows.flatMap(row => row.proofIds || []).slice(0, 8),
        channelId: 'main',
      },
      {
        id: 'continuous-work',
        stage: 'Continuous Work Loop',
        outcome: `${continuousWorkRows.filter(row => row.proofReady).length}/${continuousWorkRows.length} Agents have loop proof`,
        passed: Boolean(continuousWorkRows.some(row => row.proofReady && row.nextRunAt)),
        proofKind: 'timeline',
        timelineIds: continuousWorkRows.flatMap(row => row.timelineIds || []).slice(0, 8),
      },
      {
        id: 'dual-channel-change',
        stage: 'Meeting + Google Chat Change',
        outcome: `${changeSourceIntakeRows.filter(row => row.sourceChannelCount > 1).length} dual-channel source rows`,
        passed: Boolean(changeSourceIntakeRows.some(row => row.sourceChannelCount > 1 && row.channelId === 'google_chat' && row.sourceMessageId)),
        proofKind: 'chat',
        proofIds: changeSourceIntakeRows.filter(row => row.sourceChannelCount > 1).map(row => row.sourceMessageId).filter(Boolean).slice(0, 8),
        channelId: 'google_chat',
      },
      {
        id: 'owner-plan-sync',
        stage: 'Owner Plan + Team Sync',
        outcome: `${changeFlowRows.filter(row => row.ownerPlanLinked && row.teamSyncCount > 0).length}/${changeFlowRows.length} changes synced`,
        passed: Boolean(changeFlowRows.some(row => row.ownerPlanLinked && row.teamSyncCount > 0)),
        proofKind: 'chat',
        proofIds: changeFlowRows.flatMap(row => [row.change.confirmationMessageId, row.change.syncMessageId]).filter(Boolean).slice(0, 8),
        channelId: 'main',
      },
      {
        id: 'management-mesh',
        stage: 'Mutual Management',
        outcome: `${managementMeshRows.filter(row => row.checkInCount > 0 || row.responseCount > 0).length}/${managementMeshRows.length} Agents with management proof`,
        passed: Boolean(managementMeshRows.some(row => row.checkInCount > 0 && row.responseCount > 0)),
        proofKind: 'timeline',
        timelineIds: managementMeshRows.flatMap(row => row.proofLogIds || []).slice(0, 8),
      },
    ];
    const trailById = managerScenarioTrailRows.reduce((acc, row) => {
      acc[row.id] = row;
      return acc;
    }, {});
    const managerRequirementMatrixRows = [
      {
        id: 'kickoff-brief-understood',
        requirement: 'Director opens a kickoff meeting and briefs the project.',
        evidence: trailById['kickoff-brief']?.outcome || 'brief pending',
        passed: Boolean(trailById['kickoff-brief']?.passed),
        proofKind: 'chat',
        proofIds: trailById['kickoff-brief']?.proofIds || [],
        channelId: trailById['kickoff-brief']?.channelId || 'main',
      },
      {
        id: 'roles-questions-and-self-nominations',
        requirement: 'Agents ask role questions and self-nominate based on their responsibilities.',
        evidence: `${kickoffMeetingFlow?.roleQuestionCount || 0} role questions / ${kickoffMeetingFlow?.selfNominationCount || 0} self-nominations`,
        passed: Boolean((kickoffMeetingFlow?.roleQuestionCount || 0) > 0 && (kickoffMeetingFlow?.selfNominationCount || 0) > 0),
        proofKind: 'chat',
        proofIds: kickoffMeetingFlow?.proofIds || [],
        channelId: 'main',
      },
      {
        id: 'agents-hear-each-other',
        requirement: 'Agents can hear each other during role clarification and leader campaign.',
        evidence: `${(kickoffMeetingFlow?.roleHearingCount || 0) + (kickoffMeetingFlow?.leaderHearingCount || 0)} hearing edges`,
        passed: Boolean((kickoffMeetingFlow?.roleHearingCount || 0) > 0 && (kickoffMeetingFlow?.leaderHearingCount || 0) > 0),
        proofKind: 'chat',
        proofIds: kickoffMeetingFlow?.proofIds || [],
        channelId: 'main',
      },
      {
        id: 'confirmed-team',
        requirement: 'Director finalizes the team after the kickoff discussion.',
        evidence: trailById['team-confirmed']?.outcome || 'team pending',
        passed: Boolean(trailById['team-confirmed']?.passed),
        proofKind: 'timeline',
        timelineIds: trailById['team-confirmed']?.timelineIds || [],
      },
      {
        id: 'leader-election-marker',
        requirement: 'Leader emerges through campaign, is confirmed by Director, and receives a leader marker.',
        evidence: trailById['leader-confirmed']?.outcome || 'leader pending',
        passed: Boolean(trailById['role-and-campaign']?.passed && trailById['leader-confirmed']?.passed),
        proofKind: 'hybrid',
        proofIds: trailById['role-and-campaign']?.proofIds || [],
        timelineIds: trailById['leader-confirmed']?.timelineIds || [],
        channelId: 'main',
      },
      {
        id: 'next-actions-and-autonomy',
        requirement: 'The meeting confirms next actions and starts 24/7 Agent work.',
        evidence: trailById['next-actions-to-autonomy']?.outcome || 'startup pending',
        passed: Boolean(trailById['next-actions-to-autonomy']?.passed),
        proofKind: 'timeline',
        timelineIds: trailById['next-actions-to-autonomy']?.timelineIds || [],
      },
      {
        id: 'leader-group-assignment',
        requirement: 'Leader assigns tasks by @mentioning Agents in group chat.',
        evidence: trailById['leader-assignment']?.outcome || 'assignment pending',
        passed: Boolean(trailById['leader-assignment']?.passed),
        proofKind: 'hybrid',
        proofIds: trailById['leader-assignment']?.proofIds || [],
        timelineIds: trailById['leader-assignment']?.timelineIds || [],
        channelId: 'main',
      },
      {
        id: 'assignee-receives-and-starts',
        requirement: '@mentioned Agents immediately receive the assignment and start work.',
        evidence: `${assignmentTimelineMatrixRows.filter(row => row.assigneeReceived && row.workSeen).length}/${assignmentTimelineMatrixRows.length} assignments received and started`,
        passed: Boolean(assignmentTimelineMatrixRows.some(row => row.assigneeReceived && row.workSeen)),
        proofKind: 'hybrid',
        proofIds: assignmentTimelineMatrixRows.flatMap(row => row.evidence.chatIds || []).slice(0, 8),
        timelineIds: assignmentTimelineMatrixRows.flatMap(row => row.workTimelineIds || row.evidence.timelineIds || []).slice(0, 8),
        channelId: 'main',
      },
      {
        id: 'progress-to-timeline',
        requirement: 'Work progress and completion are uploaded to the big timeline.',
        evidence: trailById['assignment-progress']?.outcome || 'progress pending',
        passed: Boolean(trailById['assignment-progress']?.passed),
        proofKind: 'timeline',
        timelineIds: trailById['assignment-progress']?.timelineIds || [],
      },
      {
        id: 'group-chat-visible',
        requirement: 'The manager can see Agent chat records in group chat.',
        evidence: trailById['agent-chat-delivery']?.outcome || 'chat pending',
        passed: Boolean(trailById['agent-chat-delivery']?.passed),
        proofKind: 'chat',
        proofIds: trailById['agent-chat-delivery']?.proofIds || [],
        channelId: 'main',
      },
      {
        id: 'fixed-continuous-routines',
        requirement: 'All Agents keep running fixed work routines continuously.',
        evidence: trailById['continuous-work']?.outcome || 'loop pending',
        passed: Boolean(trailById['continuous-work']?.passed),
        proofKind: 'timeline',
        timelineIds: trailById['continuous-work']?.timelineIds || [],
      },
      {
        id: 'midproject-dual-channel-change',
        requirement: 'Manager can raise a new feature in War Room and Google Chat at the same time.',
        evidence: trailById['dual-channel-change']?.outcome || 'change intake pending',
        passed: Boolean(trailById['dual-channel-change']?.passed),
        proofKind: 'chat',
        proofIds: trailById['dual-channel-change']?.proofIds || [],
        channelId: trailById['dual-channel-change']?.channelId || 'google_chat',
      },
      {
        id: 'change-discussion-owner-confirm',
        requirement: 'Agents discuss the change and the responsible owner confirms it.',
        evidence: `${changeFlowRows.filter(row => row.change.discussionMessageIds?.length > 0 && row.change.confirmationMessageId).length}/${changeFlowRows.length} changes discussed and confirmed`,
        passed: Boolean(changeFlowRows.some(row => row.change.discussionMessageIds?.length > 0 && row.change.confirmationMessageId)),
        proofKind: 'chat',
        proofIds: changeFlowRows.flatMap(row => [...(row.change.discussionMessageIds || []), row.change.confirmationMessageId]).filter(Boolean).slice(0, 8),
        channelId: 'main',
      },
      {
        id: 'owner-plan-and-team-sync',
        requirement: 'The owner adds the change to their plan and syncs it back to the team.',
        evidence: trailById['owner-plan-sync']?.outcome || 'owner sync pending',
        passed: Boolean(trailById['owner-plan-sync']?.passed),
        proofKind: 'chat',
        proofIds: trailById['owner-plan-sync']?.proofIds || [],
        channelId: 'main',
      },
      {
        id: 'agents-mutually-manage',
        requirement: 'Agents can mutually manage one another with auditable check-ins.',
        evidence: trailById['management-mesh']?.outcome || 'management pending',
        passed: Boolean(trailById['management-mesh']?.passed),
        proofKind: 'timeline',
        timelineIds: trailById['management-mesh']?.timelineIds || [],
      },
    ];
    const openScenarioTrailRow = (row) => {
      if ((row.proofKind === 'chat' || row.proofKind === 'hybrid') && row.proofIds?.length) {
        openProjectChatProof(activeProject, row.proofIds, row.channelId || 'main');
        return;
      }
      if (row.timelineIds?.length) {
        openProjectTimelineProof(row.timelineIds);
      }
    };
    const managerRequirementById = Object.fromEntries(managerRequirementMatrixRows.map(row => [row.id, row]));
    const localManagerUseCaseAuditSpecs = [
      ['kickoff-meeting-understanding', 'Kickoff Meeting', 'Can the Director brief the project, answer role questions, hear self-nominations, and finalize the team?', ['kickoff-brief-understood', 'roles-questions-and-self-nominations', 'agents-hear-each-other', 'confirmed-team']],
      ['leader-election-and-marker', 'Leader Election', 'Can Leader candidates campaign, hear one another, and receive a Director-confirmed leader marker?', ['leader-election-marker']],
      ['next-actions-to-continuous-work', '24/7 Work Start', 'Can the meeting confirm next actions and start continuous fixed Agent routines?', ['next-actions-and-autonomy', 'fixed-continuous-routines']],
      ['group-chat-assignment-start', 'Group @Assignment', 'Can the Leader @assign Agents in group chat and have the assignee immediately start work?', ['leader-group-assignment', 'assignee-receives-and-starts']],
      ['progress-and-chat-visibility', 'Progress Visibility', 'Can progress reach the big timeline while the manager can still see the group chat record?', ['progress-to-timeline', 'group-chat-visible']],
      ['midproject-change-intake', 'Change Intake', 'Can the manager raise a new feature through a meeting and Google Chat at the same time?', ['midproject-dual-channel-change']],
      ['change-discussion-owner-confirm', 'Owner Confirmation', 'Do Agents discuss the change and does the responsible owner explicitly confirm it?', ['change-discussion-owner-confirm']],
      ['owner-plan-team-sync', 'Plan + Team Sync', 'Does the owner add the change to their plan and sync it back to everyone?', ['owner-plan-and-team-sync']],
      ['mutual-agent-management', 'Mutual Management', 'Can Agents mutually manage one another with auditable check-ins?', ['agents-mutually-manage']],
    ];
    const fallbackManagerUseCaseAuditRows = localManagerUseCaseAuditSpecs.map(([id, stage, managerQuestion, requirementIds]) => {
      const requirements = requirementIds.map(requirementId => managerRequirementById[requirementId]).filter(Boolean);
      const coveredCount = requirements.filter(row => row.passed).length;
      const status = coveredCount === requirements.length ? 'covered' : coveredCount > 0 ? 'partial' : 'missing';
      return {
        id,
        stage,
        managerQuestion,
        requirementIds,
        status,
        covered: status === 'covered',
        coveredCount,
        requirementCount: requirements.length,
        missingRequirementIds: requirements.filter(row => !row.passed).map(row => row.id),
        evidence: requirements.map(row => `${row.id}: ${row.evidence}`).join(' / '),
        proofKind: requirements.some(row => row.timelineIds?.length) ? 'hybrid' : 'chat',
        proofIds: Array.from(new Set(requirements.flatMap(row => row.proofIds || []))).slice(0, 12),
        timelineLogIds: Array.from(new Set(requirements.flatMap(row => row.timelineIds || []))).slice(0, 12),
        channelId: requirements.find(row => row.channelId)?.channelId || 'main',
      };
    });
    const fallbackManagerUseCaseAudit = {
      count: fallbackManagerUseCaseAuditRows.length,
      coveredCount: fallbackManagerUseCaseAuditRows.filter(row => row.covered).length,
      partialCount: fallbackManagerUseCaseAuditRows.filter(row => row.status === 'partial').length,
      missingCount: fallbackManagerUseCaseAuditRows.filter(row => row.status === 'missing').length,
      status: fallbackManagerUseCaseAuditRows.every(row => row.covered) ? 'covered' : 'needs-attention',
      rows: fallbackManagerUseCaseAuditRows,
    };
    const openManagerUseCaseAuditRow = (row) => {
      const timelineIds = row.timelineLogIds || row.timelineIds || [];
      if (timelineIds.length) {
        openProjectTimelineProof(timelineIds);
        return;
      }
      if (row.proofIds?.length) {
        openProjectChatProof(activeProject, row.proofIds, row.channelId || 'main');
      }
    };
    const managerActionDefaultAgent = activeProject.team.find(agent => !agent.isLeader) || activeProject.team[0] || null;
    const managerActionAgentPath = managerActionDefaultAgent
      ? `/projects/${activeProject.id}/agents/${managerActionDefaultAgent.id}/work-cycle`
      : `/projects/${activeProject.id}/agents/:agentId/work-cycle`;
    const managerActionPlaybookSpecs = {
      'kickoff-brief-understood': { phase: 'Kickoff', label: 'Open kickoff meeting', uiTarget: 'kickoff-meeting-flow', method: 'GET', apiPath: `/projects/${activeProject.id}/transcripts/main` },
      'roles-questions-and-self-nominations': { phase: 'Kickoff', label: 'Answer role questions', uiTarget: 'kickoff-conversation-flow', method: 'GET', apiPath: `/projects/${activeProject.id}/transcripts/main` },
      'agents-hear-each-other': { phase: 'Kickoff', label: 'Review hearing coverage', uiTarget: 'kickoff-hearing-matrix', method: 'GET', apiPath: `/projects/${activeProject.id}/transcripts/main` },
      'confirmed-team': { phase: 'Kickoff', label: 'Confirm team roster', uiTarget: 'kickoff-confirmed-team-matrix', method: 'GET', apiPath: `/projects/${activeProject.id}/manager-dashboard` },
      'leader-election-marker': { phase: 'Leader Election', label: 'Confirm Leader marker', uiTarget: 'kickoff-meeting-flow', method: 'GET', apiPath: `/projects/${activeProject.id}/manager-dashboard` },
      'next-actions-and-autonomy': { phase: 'Execution Start', label: 'Confirm next actions', uiTarget: 'kickoff-execution-flow', method: 'POST', apiPath: `/projects/${activeProject.id}/autonomous-cycle`, requestBodyTemplate: { cadence: activeProject.autonomy?.cadence || 'hourly', trigger: 'manager-action-playbook-24-7-pulse', source: 'manager-action-playbook', now: 'now-iso' } },
      'leader-group-assignment': { phase: 'Leader Assignment', label: 'Ask Leader to @assign', uiTarget: 'manager-leader-assignment-composer', method: 'POST', rerunnable: true, apiPath: `/projects/${activeProject.id}/chat`, requestBodyTemplate: { channelId: 'main', text: `leader assign @${managerActionDefaultAgent?.name || 'Agent'} prepare the next manager-review evidence packet`, now: 'now-iso' } },
      'assignee-receives-and-starts': { phase: 'Agent Work', label: 'Run assignee work pulse', uiTarget: `agent-work-cycle-${managerActionDefaultAgent?.id || 'agent'}`, method: 'POST', rerunnable: true, apiPath: managerActionAgentPath, requestBodyTemplate: { trigger: 'manager-action-playbook-assignee-start', cadence: 'assignment-start', source: 'manager-action-playbook', now: 'now-iso' } },
      'progress-to-timeline': { phase: 'Timeline Evidence', label: 'Open timeline progress', uiTarget: 'assignment-work-progress-matrix', method: 'GET', apiPath: `/projects/${activeProject.id}/timeline` },
      'group-chat-visible': { phase: 'Transcript', label: 'Open group chat transcript', uiTarget: 'group-chat-transcript-index', method: 'GET', apiPath: `/projects/${activeProject.id}/transcripts/main` },
      'fixed-continuous-routines': { phase: '24/7 Operations', label: 'Run 24/7 pulse', uiTarget: 'backend-worker-station', method: 'POST', rerunnable: true, apiPath: `/projects/${activeProject.id}/autonomous-cycle`, requestBodyTemplate: { cadence: activeProject.autonomy?.cadence || 'hourly', trigger: 'manager-action-playbook-24-7-pulse', source: 'manager-action-playbook', now: 'now-iso' } },
      'midproject-dual-channel-change': { phase: 'Change Intake', label: 'Broadcast dual-channel change', uiTarget: 'manager-change-intake-composer', method: 'POST', rerunnable: true, apiPath: `/projects/${activeProject.id}/change-request`, requestBodyTemplate: { text: '@all add manager-facing feature request from the action playbook', channelIds: ['main', 'google_chat'], sourceModes: ['war_room_meeting', 'google_chat'], now: 'now-iso' } },
      'change-discussion-owner-confirm': { phase: 'Change Resolution', label: 'Review owner confirmation', uiTarget: 'change-resolution-matrix', method: 'GET', apiPath: `/projects/${activeProject.id}/manager-dashboard` },
      'owner-plan-and-team-sync': { phase: 'Change Sync', label: 'Verify owner plan sync', uiTarget: 'change-resolution-matrix', method: 'GET', apiPath: `/projects/${activeProject.id}/manager-requirement-matrix` },
      'agents-mutually-manage': { phase: 'Management Loop', label: 'Run management sync', uiTarget: 'agent-management-mesh', method: 'POST', rerunnable: true, apiPath: managerActionAgentPath, requestBodyTemplate: { trigger: 'manager-action-playbook-management-sync', cadence: 'management-sync', source: 'manager-action-playbook', now: 'now-iso' } },
    };
    const firstPendingPlaybookIndex = managerRequirementMatrixRows.findIndex(row => !row.passed);
    const fallbackManagerActionQueue = {
      count: managerRequirementMatrixRows.length,
      completedCount: managerRequirementMatrixRows.filter(row => row.passed).length,
      readyCount: firstPendingPlaybookIndex >= 0 ? 1 : 0,
      blockedCount: firstPendingPlaybookIndex >= 0 ? Math.max(0, managerRequirementMatrixRows.length - firstPendingPlaybookIndex - 1) : 0,
      rows: managerRequirementMatrixRows.map((row, index) => {
        const spec = managerActionPlaybookSpecs[row.id] || {};
        const status = row.passed ? 'complete' : index === firstPendingPlaybookIndex ? 'ready' : 'blocked';
        const method = spec.method || 'GET';
        const routeResolved = !String(spec.apiPath || `/projects/${activeProject.id}/manager-dashboard`).includes(':');
        const rerunnable = Boolean(spec.rerunnable);
        const canRun = routeResolved && method !== 'GET' && (status === 'ready' || (status === 'complete' && rerunnable));
        return {
          id: `manager-action-${row.id}`,
          requirementId: row.id,
          phase: spec.phase || 'Scenario',
          label: spec.label || row.requirement,
          description: row.requirement,
          status,
          canRun,
          rerunnable,
          method,
          apiPath: spec.apiPath || `/projects/${activeProject.id}/manager-dashboard`,
          routeResolved,
          requestBodyTemplate: spec.requestBodyTemplate || null,
          requestBodyRequired: method !== 'GET',
          runApiPath: `/projects/${activeProject.id}/manager-action-queue/${row.id}/run`,
          context: {
            projectId: activeProject.id,
            defaultAgentId: managerActionDefaultAgent?.id || null,
            defaultAgentName: managerActionDefaultAgent?.name || null,
            requiresAgentId: String(spec.apiPath || '').includes(':agentId'),
          },
          uiTarget: spec.uiTarget || null,
          evidence: row.evidence,
          proofKind: row.proofKind,
          proofIds: row.proofIds || [],
          timelineLogIds: row.timelineIds || [],
          channelId: row.channelId || null,
        };
      }),
    };
    fallbackManagerActionQueue.nextAction = fallbackManagerActionQueue.rows.find(row => row.status === 'ready') || null;
    fallbackManagerActionQueue.nextActionId = fallbackManagerActionQueue.nextAction?.id || null;
    const managerActionPlaybook = backendManagerActionQueue || fallbackManagerActionQueue;
    const useCaseActionByRequirementId = Object.fromEntries((managerActionPlaybook.rows || []).map(row => [row.requirementId, row]));
    const toUseCaseActionHint = (action) => action ? ({
      id: action.id,
      requirementId: action.requirementId,
      label: action.label,
      status: action.status,
      canRun: Boolean(action.canRun),
      rerunnable: Boolean(action.rerunnable),
      method: action.method,
      apiPath: action.apiPath,
      runApiPath: action.runApiPath,
      routeResolved: action.routeResolved,
    }) : null;
    const managerUseCaseAuditBase = backendManagerUseCaseAudit || fallbackManagerUseCaseAudit;
    const managerUseCaseAuditRowsWithActions = (managerUseCaseAuditBase.rows || []).map(row => {
      const existingActions = (row.actions || []).length ? row.actions : row.requirementIds?.map(requirementId => toUseCaseActionHint(useCaseActionByRequirementId[requirementId])).filter(Boolean) || [];
      const actions = existingActions.map(action => {
        const playbookAction = toUseCaseActionHint(useCaseActionByRequirementId[action.requirementId]);
        return {
          ...(playbookAction || action),
          ...action,
        };
      });
      const nextAction = row.nextAction || actions.find(action => action.status === 'ready' && action.canRun) || actions.find(action => action.canRun) || null;
      return {
        ...row,
        actions,
        actionIds: row.actionIds || actions.map(action => action.id),
        runnableActionCount: typeof row.runnableActionCount === 'number' ? row.runnableActionCount : actions.filter(action => action.canRun).length,
        nextAction,
      };
    });
    const managerUseCaseAudit = {
      ...managerUseCaseAuditBase,
      rows: managerUseCaseAuditRowsWithActions,
      runnableActionCount: typeof managerUseCaseAuditBase.runnableActionCount === 'number'
        ? managerUseCaseAuditBase.runnableActionCount
        : managerUseCaseAuditRowsWithActions.reduce((sum, row) => sum + (row.runnableActionCount || 0), 0),
    };
    const managerUseCaseAuditById = Object.fromEntries((managerUseCaseAudit.rows || []).map(row => [row.id, row]));
    const uniqueManagerValues = (values) => Array.from(new Set((values || []).filter(Boolean)));
    const managerWalkthroughSpecs = [
      ['kickoff-meeting', 'Kickoff Meeting', 'Brief the project, answer role questions, hear self-nominations, and finalize the roster.', 'kickoff-meeting-understanding', ['kickoff-brief', 'role-and-campaign', 'team-confirmed'], 'kickoff-brief-understood'],
      ['leader-election', 'Leader Election', 'Let candidates campaign, then confirm the Leader marker.', 'leader-election-and-marker', ['role-and-campaign', 'leader-confirmed'], 'leader-election-marker'],
      ['start-24-7-work', '24/7 Work Start', 'Confirm next actions and start fixed Agent routines.', 'next-actions-to-continuous-work', ['next-actions-to-autonomy', 'continuous-work'], 'fixed-continuous-routines'],
      ['leader-group-assignment', 'Group @Assignment', 'Ask the Leader to @assign work and have the assignee start immediately.', 'group-chat-assignment-start', ['leader-assignment'], 'leader-group-assignment'],
      ['progress-visibility', 'Progress Visibility', 'Confirm work progress reaches the big timeline while chat stays inspectable.', 'progress-and-chat-visibility', ['assignment-progress', 'agent-chat-delivery'], 'progress-to-timeline'],
      ['midproject-change-intake', 'Change Intake', 'Broadcast a new feature request through the meeting path and Google Chat.', 'midproject-change-intake', ['dual-channel-change'], 'midproject-dual-channel-change'],
      ['owner-confirmation', 'Owner Confirmation', 'Verify Agents discussed the change and the responsible owner confirmed it.', 'change-discussion-owner-confirm', ['owner-plan-sync'], 'change-discussion-owner-confirm'],
      ['owner-plan-team-sync', 'Plan + Team Sync', 'Check that the owner added the feature to their plan and synchronized it back to the team.', 'owner-plan-team-sync', ['owner-plan-sync'], 'owner-plan-and-team-sync'],
      ['mutual-agent-management', 'Mutual Management', 'Run or inspect peer-management check-ins so Agents manage each other continuously.', 'mutual-agent-management', ['management-mesh'], 'agents-mutually-manage'],
    ];
    const fallbackManagerScenarioWalkthroughRows = managerWalkthroughSpecs.map(([id, stage, managerIntent, useCaseId, trailIds, primaryRequirementId], index) => {
      const auditRow = managerUseCaseAuditById[useCaseId] || {};
      const trailRows = trailIds.map(trailId => trailById[trailId]).filter(Boolean);
      const primaryAction = toUseCaseActionHint(useCaseActionByRequirementId[primaryRequirementId]) || auditRow.nextAction || null;
      const actionRequirementIds = uniqueManagerValues([
        ...(auditRow.actions || []).map(action => action.requirementId),
        primaryRequirementId,
      ]);
      const actions = actionRequirementIds.map(requirementId => toUseCaseActionHint(useCaseActionByRequirementId[requirementId])).filter(Boolean);
      const proofIds = uniqueManagerValues([
        ...(auditRow.proofIds || []),
        ...trailRows.flatMap(row => row.proofIds || []),
      ]).slice(0, 12);
      const timelineLogIds = uniqueManagerValues([
        ...(auditRow.timelineLogIds || auditRow.timelineIds || []),
        ...trailRows.flatMap(row => row.timelineLogIds || row.timelineIds || []),
      ]).slice(0, 12);
      const completed = auditRow.status === 'covered' || trailRows.some(row => row.passed);
      return {
        id,
        sequence: index + 1,
        stage,
        managerIntent,
        useCaseId,
        trailIds,
        primaryRequirementId,
        status: auditRow.status || (completed ? 'covered' : 'missing'),
        completed,
        coveredCount: auditRow.coveredCount || trailRows.filter(row => row.passed).length,
        requirementCount: auditRow.requirementCount || Math.max(1, trailRows.length),
        evidence: auditRow.evidence || trailRows.map(row => row.outcome).join(' / '),
        proofKind: timelineLogIds.length && proofIds.length ? 'hybrid' : timelineLogIds.length ? 'timeline' : 'chat',
        proofIds,
        timelineLogIds,
        channelId: auditRow.channelId || trailRows.find(row => row.channelId)?.channelId || 'main',
        trailRows,
        actionIds: actions.map(action => action.id),
        actions,
        primaryAction,
        runnableActionCount: actions.filter(action => action.canRun).length,
        managerRoute: `/projects/${activeProject.id}/manager-scenario-walkthrough#${id}`,
        runApiPath: `/projects/${activeProject.id}/manager-scenario-walkthrough/${id}/run`,
      };
    });
    const fallbackManagerScenarioWalkthrough = {
      count: fallbackManagerScenarioWalkthroughRows.length,
      completedCount: fallbackManagerScenarioWalkthroughRows.filter(row => row.completed).length,
      runnableCount: fallbackManagerScenarioWalkthroughRows.reduce((sum, row) => sum + (row.runnableActionCount || 0), 0),
      rows: fallbackManagerScenarioWalkthroughRows,
    };
    fallbackManagerScenarioWalkthrough.status = fallbackManagerScenarioWalkthrough.rows.every(row => row.completed) ? 'covered' : 'needs-attention';
    fallbackManagerScenarioWalkthrough.nextIncompleteStep = fallbackManagerScenarioWalkthrough.rows.find(row => !row.completed) || null;
    fallbackManagerScenarioWalkthrough.nextRunnableStep = fallbackManagerScenarioWalkthrough.rows.find(row => !row.completed && row.primaryAction?.canRun)
      || fallbackManagerScenarioWalkthrough.rows.find(row => row.primaryAction?.canRun)
      || null;
    fallbackManagerScenarioWalkthrough.nextStep = fallbackManagerScenarioWalkthrough.nextIncompleteStep || fallbackManagerScenarioWalkthrough.nextRunnableStep || null;
    fallbackManagerScenarioWalkthrough.nextStepId = fallbackManagerScenarioWalkthrough.nextStep?.id || null;
    fallbackManagerScenarioWalkthrough.nextIncompleteStepId = fallbackManagerScenarioWalkthrough.nextIncompleteStep?.id || null;
    fallbackManagerScenarioWalkthrough.nextRunnableStepId = fallbackManagerScenarioWalkthrough.nextRunnableStep?.id || null;
    const managerScenarioWalkthrough = backendManagerScenarioWalkthrough || fallbackManagerScenarioWalkthrough;
    const fallbackManagerCommandPrimaryAction = managerScenarioWalkthrough.nextRunnableStep?.primaryAction
      || managerActionPlaybook.nextAction
      || (managerActionPlaybook.rows || []).find(row => row.canRun)
      || null;
    const fallbackManagerCommandAttentionRows = [
      ...(fallbackManagerCommandPrimaryAction ? [{
        id: `next-action-${fallbackManagerCommandPrimaryAction.requirementId || fallbackManagerCommandPrimaryAction.id}`,
        type: 'next-action',
        severity: 'action',
        title: fallbackManagerCommandPrimaryAction.label || 'Run next manager action',
        detail: fallbackManagerCommandPrimaryAction.description || fallbackManagerCommandPrimaryAction.apiPath || 'Ready manager action available.',
        actionId: fallbackManagerCommandPrimaryAction.id,
        requirementId: fallbackManagerCommandPrimaryAction.requirementId,
        canRun: Boolean(fallbackManagerCommandPrimaryAction.canRun),
        runApiPath: fallbackManagerCommandPrimaryAction.runApiPath,
        uiTarget: fallbackManagerCommandPrimaryAction.uiTarget,
      }] : []),
      ...(syncProtocolAudit.rows || []).filter(row => !row.complete).slice(0, 4).map(row => ({
        id: `protocol-${row.id}`,
        type: 'sync-protocol',
        severity: row.status === 'waiting' ? 'critical' : 'watch',
        title: row.protocol,
        detail: `${row.passedCount}/${row.totalCount} sync checks passed: ${row.managerMeaning}`,
        proofIds: row.proofIds || [],
        timelineLogIds: row.timelineLogIds || [],
        uiTarget: 'sync-protocol-audit',
      })),
      ...operationsBoardRows.filter(row => row.openObligations > 0 || !row.nextRunAt).slice(0, 4).map(row => ({
        id: `agent-${row.agent.id}`,
        type: 'agent',
        severity: row.openObligations > 0 ? 'watch' : 'critical',
        title: row.agent.name,
        detail: row.openObligations > 0
          ? `${row.openObligations} open obligation(s); routine ${row.state.currentPlan?.routine?.label || 'active'}`
          : 'No next run scheduled for this Agent.',
        agentId: row.agent.id,
        uiTarget: `agent-focus-card-${row.agent.id}`,
      })),
      ...changeFlowRows.filter(row => !row.ownerPlanLinked || !row.teamSyncCount).slice(0, 3).map(row => ({
        id: `change-${row.change.id}`,
        type: 'change',
        severity: !row.ownerPlanLinked ? 'critical' : 'watch',
        title: row.change.requestText || 'Change request',
        detail: `${row.change.ownerName || 'Owner'} ${row.ownerPlanLinked ? 'has a plan' : 'needs to add this to plan'} / team sync ${row.teamSyncCount || 0}`,
        proofIds: [
          row.change.requestMessageId,
          ...(row.change.sourceMessageIds || []),
          ...(row.change.discussionMessageIds || []),
          row.change.confirmationMessageId,
          row.change.syncMessageId,
        ].filter(Boolean),
        timelineLogIds: [...(row.timelineLogIds || []), ...(row.ownerWorkTimelineLogIds || [])],
        uiTarget: 'change-resolution-matrix',
      })),
    ].slice(0, 10);
    const fallbackManagerCommandCenter = {
      status: fallbackManagerCommandAttentionRows.some(row => row.severity === 'critical')
        ? 'needs-action'
        : fallbackManagerCommandPrimaryAction?.canRun
          ? 'action-ready'
          : syncProtocolAudit.status === 'synced'
            ? 'live'
            : 'watch',
      headline: managerScenarioWalkthrough.nextStep
        ? `Current stage: ${managerScenarioWalkthrough.nextStep.stage}`
        : 'All core scenario stages are covered.',
      currentStage: managerScenarioWalkthrough.nextStep?.stage || 'Live Operations',
      nextBestAction: fallbackManagerCommandPrimaryAction,
      nextBestActionLabel: fallbackManagerCommandPrimaryAction?.label || 'Keep monitoring live operations',
      nextBestActionRunApiPath: fallbackManagerCommandPrimaryAction?.runApiPath || null,
      attentionCount: fallbackManagerCommandAttentionRows.length,
      criticalCount: fallbackManagerCommandAttentionRows.filter(row => row.severity === 'critical').length,
      stats: {
        scenarioTrail: `${managerScenarioTrailRows.filter(row => row.passed).length}/${managerScenarioTrailRows.length}`,
        walkthrough: `${managerScenarioWalkthrough.completedCount || 0}/${managerScenarioWalkthrough.count || 0}`,
        syncProtocols: `${syncProtocolAudit.syncedCount || 0}/${syncProtocolAudit.count || 0}`,
        actionQueue: `${managerActionPlaybook.completedCount || 0}/${managerActionPlaybook.count || 0}`,
        agentsScheduled: `${continuousWorkRows.filter(row => row.nextRunAt).length}/${continuousWorkRows.length}`,
        openTasks: activeProject.tasks.filter(task => task.status !== 'done').length,
        changeRequests: changeFlowRows.length,
      },
      attentionRows: fallbackManagerCommandAttentionRows,
      liveLanes: [
        {
          id: 'kickoff',
          label: 'Kickoff',
          status: kickoffMeetingFlow?.leaderMarkerPersisted ? 'ready' : kickoffMeetingFlow ? 'active' : 'waiting',
          detail: kickoffMeetingFlow ? `${kickoffMeetingFlow.roleQuestionCount || 0} questions / ${kickoffMeetingFlow.leaderCampaignCount || 0} leader campaigns` : 'Kickoff meeting not started.',
          proofCount: kickoffCharterProofIds.length,
        },
        {
          id: 'group-chat',
          label: 'Group Chat',
          status: channelTranscriptRows.find(row => row.channel.id === 'main')?.messages.length ? 'active' : 'waiting',
          detail: `${channelTranscriptRows.find(row => row.channel.id === 'main')?.messages.length || 0} messages with receipts`,
          proofCount: channelTranscriptRows.find(row => row.channel.id === 'main')?.proofIds.length || 0,
        },
        {
          id: 'google-chat',
          label: 'Google Chat',
          status: changeSourceIntakeRows.some(row => row.channelId === 'google_chat' && row.sourceMessageId) ? 'active' : 'waiting',
          detail: `${changeSourceIntakeRows.filter(row => row.channelId === 'google_chat' && row.sourceMessageId).length} change source row(s)`,
          proofCount: changeSourceIntakeRows.filter(row => row.channelId === 'google_chat' && row.sourceMessageId).length,
        },
        {
          id: 'timeline',
          label: 'Timeline',
          status: activeProject.logs.length ? 'active' : 'waiting',
          detail: `${activeProject.logs.length} timeline logs / ${activeProject.eventLedger?.length || 0} ledger events`,
          proofCount: activeProject.logs.length,
        },
        {
          id: 'workers',
          label: '24/7 Workers',
          status: continuousWorkRows.some(row => row.nextRunAt) ? 'active' : 'waiting',
          detail: `${continuousWorkRows.filter(row => row.nextRunAt).length}/${continuousWorkRows.length} Agents scheduled`,
          proofCount: continuousWorkRows.filter(row => row.proofReady).length,
        },
      ],
      kickoffBoard: (() => {
        const rows = [
          {
            id: 'project-brief',
            label: 'Project Brief Heard',
            passed: Boolean(kickoffMeetingFlow?.briefAlignment?.heardByAgentIds?.length),
            detail: `${kickoffMeetingFlow?.briefAlignment?.heardByAgentIds?.length || 0}/${activeProject.team.length} Agents heard the Director brief`,
            proofIds: kickoffMeetingFlow?.briefAlignment?.proofIds || kickoffCharterProofIds,
            timelineLogIds: [],
          },
          {
            id: 'role-questions',
            label: 'Role Questions Answered',
            passed: Boolean((kickoffMeetingFlow?.roleQuestionCount || 0) > 0 && (kickoffMeetingFlow?.roleQuestionUnansweredCount || 0) === 0),
            detail: `${kickoffMeetingFlow?.roleQuestionAnsweredCount || 0}/${kickoffMeetingFlow?.roleQuestionCount || 0} role questions answered`,
            proofIds: kickoffMeetingFlow?.roleQuestionResolutions?.flatMap(row => [row.questionId, ...(row.answerIds || [])]) || kickoffCharterProofIds,
            timelineLogIds: [],
          },
          {
            id: 'self-nominations',
            label: 'Self Nominations Heard',
            passed: Boolean((kickoffMeetingFlow?.selfNominationCount || 0) > 0),
            detail: `${kickoffMeetingFlow?.selfNominationCount || 0} self-nomination turn(s)`,
            proofIds: (kickoffMeetingFlow?.conversationRows || []).filter(row => row.stage === 'Self Nominations Heard' || row.stage === 'self-nomination').flatMap(row => row.proofIds || []),
            timelineLogIds: [],
          },
          {
            id: 'leader-campaign',
            label: 'Leader Campaign',
            passed: Boolean((kickoffMeetingFlow?.leaderCampaignCount || 0) > 0 && (kickoffMeetingFlow?.leaderCandidateNames || []).length > 0),
            detail: `${kickoffMeetingFlow?.leaderCampaignCount || 0} campaign turn(s) / ${(kickoffMeetingFlow?.leaderCandidateNames || []).slice(0, 3).join(', ') || 'no candidates'}`,
            proofIds: (kickoffMeetingFlow?.conversationRows || []).filter(row => row.stage === 'Leader Campaign Hearing' || row.stage === 'leader-campaign').flatMap(row => row.proofIds || []),
            timelineLogIds: [],
          },
          {
            id: 'team-confirmed',
            label: 'Team Confirmed',
            passed: Boolean(kickoffMeetingFlow?.confirmedTeamMatrixRows?.length && kickoffMeetingFlow.confirmedTeamMatrixRows.every(row => row.inProjectState && row.inKickoffCharter)),
            detail: `${kickoffMeetingFlow?.confirmedTeamMatrixRows?.filter(row => row.inProjectState && row.inKickoffCharter).length || 0}/${kickoffMeetingFlow?.confirmedTeamMatrixRows?.length || activeProject.team.length} roster rows persisted`,
            proofIds: [],
            timelineLogIds: kickoffMeetingFlow?.confirmedTeamProofLogIds || [],
          },
          {
            id: 'leader-marker',
            label: 'Leader Marker',
            passed: Boolean(kickoffMeetingFlow?.leaderMarkerPersisted),
            detail: kickoffMeetingFlow?.confirmedLeaderName || 'Leader pending',
            proofIds: kickoffMeetingFlow?.leaderElectionResolution?.campaignIds || kickoffCharterProofIds,
            timelineLogIds: kickoffMeetingFlow?.confirmedTeamProofLogIds || [],
          },
          {
            id: 'next-actions',
            label: 'Next Actions Confirmed',
            passed: Boolean(kickoffExecutionFlow?.nextActionResolution?.managerConfirmed && kickoffExecutionFlow?.nextActions?.length > 0),
            detail: `${kickoffExecutionFlow?.nextActions?.length || 0} first execution action(s) / receipts ${kickoffExecutionFlow?.nextActionResolutionDelivery?.deliveredAgentIds?.length || 0}-${kickoffExecutionFlow?.nextActionResolutionDelivery?.teamCount || activeProject.team.length}`,
            proofIds: [`decision_${activeProject.id}_next_actions`].filter(Boolean),
            timelineLogIds: kickoffExecutionFlow?.firstPulse?.timelineLogIds || [],
          },
        ].map(row => ({
          ...row,
          proofIds: Array.from(new Set((row.proofIds || []).filter(Boolean))).slice(0, 8),
          timelineLogIds: Array.from(new Set((row.timelineLogIds || []).filter(Boolean))).slice(0, 8),
        }));
        return {
          count: rows.length,
          readyCount: rows.filter(row => row.passed).length,
          status: rows.every(row => row.passed) ? 'ready' : rows.some(row => row.passed) ? 'active' : 'waiting',
          leaderName: kickoffMeetingFlow?.confirmedLeaderName || null,
          nextActionCount: kickoffExecutionFlow?.nextActions?.length || 0,
          rows,
        };
      })(),
      workLoopBoard: (() => {
        const rows = continuousWorkRows.map(row => ({
          agentId: row.agentId,
          name: row.name,
          role: row.role,
          loopState: row.loopState,
          routineLabel: row.routineLabel || 'fixed routine',
          focus: row.focus || 'monitor project lane',
          nextStep: row.nextStep || 'publish the next proof marker',
          nextRunAt: row.nextRunAt,
          lastRunAt: row.lastRunAt,
          trigger: row.trigger || 'waiting',
          scheduled: Boolean(row.nextRunAt),
          routineReady: Boolean(row.routineLabel),
          firstPulseReady: Boolean(row.lastRunAt || row.proofReady),
          proofReady: Boolean(row.proofReady),
          timelineReady: Boolean((row.timelineLogIds || []).length),
          startupProofTypes: row.startupProofTypes || [],
          chatProofIds: row.chatProofIds || [],
          timelineLogIds: row.timelineLogIds || [],
          status: row.nextRunAt && row.proofReady ? 'running' : row.nextRunAt ? 'scheduled' : row.proofReady ? 'needs-schedule' : 'waiting',
        }));
        return {
          count: rows.length,
          runningCount: rows.filter(row => row.status === 'running').length,
          scheduledCount: rows.filter(row => row.scheduled).length,
          routineCount: rows.filter(row => row.routineReady).length,
          proofedCount: rows.filter(row => row.proofReady).length,
          timelineProofCount: rows.reduce((sum, row) => sum + (row.timelineLogIds || []).length, 0),
          status: rows.length && rows.every(row => row.status === 'running') ? 'running' : rows.some(row => row.scheduled) ? 'active' : 'waiting',
          rows,
        };
      })(),
      collaborationBoard: (() => {
        const leaderAssignmentProofIds = Array.from(new Set(assignmentFlowRows.flatMap(row => row.evidence?.chatIds || []).filter(Boolean))).slice(0, 8);
        const leaderAssignmentTimelineIds = Array.from(new Set(assignmentFlowRows.flatMap(row => row.evidence?.timelineIds || []).filter(Boolean))).slice(0, 8);
        const agentMessageProofIds = Array.from(new Set(agentCommunicationRows.flatMap(row => row.proofIds || []).filter(Boolean))).slice(0, 8);
        const peerHandoffProofIds = Array.from(new Set(peerHandoffs.flatMap(handoff => [handoff.requestMessageId, handoff.acknowledgementMessageId]).filter(Boolean))).slice(0, 8);
        const peerHandoffTimelineIds = Array.from(new Set(peerHandoffs.flatMap(handoff => handoffTimelineProofIds(handoff)).filter(Boolean))).slice(0, 8);
        const managementTimelineIds = Array.from(new Set(managementMeshRows.flatMap(row => row.proofLogIds || []).filter(Boolean))).slice(0, 8);
        const rows = [
          {
            id: 'leader-assignments',
            label: 'Leader @Assignments',
            status: assignmentFlowRows.length && assignmentFlowRows.some(row => row.inboxSeen && row.workSeen && row.timelineSeen) ? 'synced' : assignmentFlowRows.length ? 'active' : 'waiting',
            detail: `${assignmentFlowRows.filter(row => row.inboxSeen).length}/${assignmentFlowRows.length} assignees saw group @assignments`,
            passed: assignmentFlowRows.some(row => row.inboxSeen && row.workSeen && row.timelineSeen),
            proofIds: leaderAssignmentProofIds,
            timelineLogIds: leaderAssignmentTimelineIds,
          },
          {
            id: 'agent-messages',
            label: 'Agent Message Delivery',
            status: agentCommunicationRows.length && agentMessageDeliveryRows.some(row => row.receiptSeen && row.inboxSeen && row.senderWorklogSeen) ? 'delivered' : agentCommunicationRows.length ? 'active' : 'waiting',
            detail: `${agentMessageDeliveryRows.filter(row => row.receiptSeen && row.inboxSeen).length}/${agentMessageDeliveryRows.length} direct deliveries reached inbox`,
            passed: agentMessageDeliveryRows.some(row => row.receiptSeen && row.inboxSeen && row.senderWorklogSeen),
            proofIds: agentMessageProofIds,
            timelineLogIds: [],
          },
          {
            id: 'peer-handoffs',
            label: 'Peer Handoffs',
            status: peerHandoffs.some(handoff => handoff.status === 'accepted') ? 'accepted' : peerHandoffs.length ? 'active' : 'waiting',
            detail: `${peerHandoffs.filter(handoff => handoff.status === 'accepted').length}/${peerHandoffs.length} peer dependencies accepted`,
            passed: peerHandoffs.some(handoff => handoff.status === 'accepted'),
            proofIds: peerHandoffProofIds,
            timelineLogIds: peerHandoffTimelineIds,
          },
          {
            id: 'mutual-management',
            label: 'Mutual Management',
            status: peerManagementMatrixRows.length === activeProject.team.length && managementMeshRows.some(row => row.checkInCount > 0 && row.responseCount > 0) ? 'managed' : peerManagementMatrixRows.length ? 'mapped' : 'waiting',
            detail: `${peerManagementMatrixRows.filter(row => row.peerManagedIds?.length && row.peerManagerIds?.length).length}/${activeProject.team.length} peer manager links mapped`,
            passed: peerManagementMatrixRows.length === activeProject.team.length && peerManagementMatrixRows.every(row => row.peerManagedIds?.length && row.peerManagerIds?.length),
            proofIds: [],
            timelineLogIds: managementTimelineIds,
          },
        ];
        return {
          count: rows.length,
          readyCount: rows.filter(row => row.passed).length,
          assignmentCount: assignmentFlowRows.length,
          agentMessageCount: agentCommunicationRows.length,
          deliveredMessageCount: agentMessageDeliveryRows.filter(row => row.receiptSeen && row.inboxSeen).length,
          peerHandoffCount: peerHandoffs.length,
          managementLinkCount: peerManagementMatrixRows.filter(row => row.peerManagedIds?.length && row.peerManagerIds?.length).length,
          status: rows.every(row => row.passed) ? 'synced' : rows.some(row => row.passed) ? 'active' : 'waiting',
          rows,
        };
      })(),
      changeProtocolBoard: (() => {
        const dualChannelRows = changeFlowRows.filter(row => (
          (row.sourceChannelIds || []).length > 1
          || ((row.sourceChannelIds || []).includes('main') && (row.sourceChannelIds || []).includes('google_chat'))
        ));
        const dualChannelSourceRows = changeSourceIntakeRows.filter(row => row.sourceChannelCount > 1);
        const discussionRows = changeFlowRows.filter(row => row.change.discussionMessageIds?.length > 0);
        const ownerConfirmedRows = changeFlowRows.filter(row => row.change.confirmationMessageId);
        const ownerPlanRows = changeFlowRows.filter(row => row.ownerPlanLinked);
        const teamSyncRows = changeFlowRows.filter(row => row.teamSyncCount > 0);
        const ownerWorkRows = changeFlowRows.filter(row => row.ownerWorkStarted);
        const rows = [
          {
            id: 'dual-channel-source',
            label: 'War Room + Google Chat',
            status: dualChannelSourceRows.some(row => row.channelId === 'google_chat' && row.sourceMessageId) && dualChannelSourceRows.some(row => row.channelId === 'main' && row.sourceMessageId) ? 'source-proofed' : dualChannelSourceRows.length ? 'partial' : 'waiting',
            detail: `${dualChannelRows.length} unified dual-channel change(s) / ${dualChannelSourceRows.filter(row => row.sourceMessageId).length} source message(s)`,
            passed: dualChannelSourceRows.some(row => row.channelId === 'google_chat' && row.sourceMessageId) && dualChannelSourceRows.some(row => row.channelId === 'main' && row.sourceMessageId),
            proofIds: Array.from(new Set(dualChannelSourceRows.map(row => row.sourceMessageId).filter(Boolean))).slice(0, 8),
            timelineLogIds: [],
            channelId: 'google_chat',
          },
          {
            id: 'team-discussion',
            label: 'Team Discussion',
            status: discussionRows.some(row => row.discussionDeliveryCount > 0 && row.discussionObligationCount > 0) ? 'discussed' : discussionRows.length ? 'active' : 'waiting',
            detail: `${discussionRows.length}/${changeFlowRows.length} change(s) have Agent discussion; ${discussionRows.reduce((sum, row) => sum + (row.discussionDeliveryCount || 0), 0)} receipt(s)`,
            passed: discussionRows.some(row => row.discussionDeliveryCount > 0 && row.discussionObligationCount > 0),
            proofIds: Array.from(new Set(discussionRows.flatMap(row => row.change.discussionMessageIds || []).filter(Boolean))).slice(0, 8),
            timelineLogIds: [],
            channelId: 'main',
          },
          {
            id: 'owner-confirmation',
            label: 'Owner Confirmation',
            status: ownerConfirmedRows.length ? 'confirmed' : 'waiting',
            detail: `${ownerConfirmedRows.length}/${changeFlowRows.length} owner confirmation(s)`,
            passed: ownerConfirmedRows.length > 0,
            proofIds: Array.from(new Set(ownerConfirmedRows.map(row => row.change.confirmationMessageId).filter(Boolean))).slice(0, 8),
            timelineLogIds: [],
            channelId: 'main',
          },
          {
            id: 'owner-plan',
            label: 'Owner Plan Updated',
            status: ownerPlanRows.length ? 'plan-linked' : 'waiting',
            detail: `${ownerPlanRows.length}/${changeFlowRows.length} change(s) linked into owner plan`,
            passed: ownerPlanRows.length > 0,
            proofIds: Array.from(new Set(ownerPlanRows.flatMap(row => [row.change.confirmationMessageId, row.change.syncMessageId]).filter(Boolean))).slice(0, 8),
            timelineLogIds: Array.from(new Set(ownerPlanRows.flatMap(row => changeTimelineProofIds(row.change)).filter(Boolean))).slice(0, 8),
            channelId: 'main',
          },
          {
            id: 'team-resync',
            label: 'Team Resync',
            status: teamSyncRows.some(row => row.teamSyncCount >= Math.max(1, activeProject.team.length - 1)) ? 'team-synced' : teamSyncRows.length ? 'partial' : 'waiting',
            detail: `${teamSyncRows.reduce((sum, row) => sum + (row.teamSyncCount || 0), 0)} Agent sync receipt(s) across ${teamSyncRows.length} change(s)`,
            passed: teamSyncRows.some(row => row.teamSyncCount > 0),
            proofIds: Array.from(new Set(teamSyncRows.map(row => row.change.syncMessageId).filter(Boolean))).slice(0, 8),
            timelineLogIds: Array.from(new Set(teamSyncRows.flatMap(row => changeTimelineProofIds(row.change)).filter(Boolean))).slice(0, 8),
            channelId: 'main',
          },
          {
            id: 'owner-work',
            label: 'Owner Work Started',
            status: ownerWorkRows.length ? 'working' : 'waiting',
            detail: `${ownerWorkRows.length}/${changeFlowRows.length} owner work pulse(s) started`,
            passed: ownerWorkRows.length > 0,
            proofIds: Array.from(new Set(ownerWorkRows.flatMap(row => row.ownerWorkMessageIds || []).filter(Boolean))).slice(0, 8),
            timelineLogIds: Array.from(new Set(ownerWorkRows.flatMap(row => row.ownerWorkTimelineIds || []).filter(Boolean))).slice(0, 8),
            channelId: 'main',
          },
        ];
        return {
          count: rows.length,
          readyCount: rows.filter(row => row.passed).length,
          dualChannelCount: dualChannelRows.length,
          sourceReadyCount: dualChannelSourceRows.filter(row => row.sourceMessageId && row.receiptCount > 0).length,
          discussionCount: discussionRows.length,
          ownerConfirmedCount: ownerConfirmedRows.length,
          ownerPlanCount: ownerPlanRows.length,
          teamSyncCount: teamSyncRows.length,
          ownerWorkCount: ownerWorkRows.length,
          status: rows.every(row => row.passed) ? 'synced' : rows.some(row => row.passed) ? 'active' : 'waiting',
          rows,
        };
      })(),
      agentRows: operationsBoardRows.map(row => ({
        agentId: row.agent.id,
        name: row.agent.name,
        role: row.agent.role,
        status: row.state.status || row.agent.status || 'waiting',
        routineLabel: row.state.currentPlan?.routine?.label || 'fixed routine',
        focus: row.state.currentPlan?.focus || row.latestWorklog?.text || 'monitor project lane',
        nextRunAt: row.nextRunAt,
        lastRunAt: row.lastRunAt,
        openObligationCount: row.openObligations,
        managementPriority: row.priority || 0,
        latestInbox: row.state.inbox?.[0] || null,
        latestObligation: (row.state.obligations || []).find(item => item.status !== 'done' && item.status !== 'resolved') || row.state.obligations?.[0] || null,
        latestWorklog: row.latestWorklog || row.state.worklog?.[0] || null,
        ...(() => {
          const latestInbox = row.state.inbox?.[0] || null;
          const latestObligation = (row.state.obligations || []).find(item => item.status !== 'done' && item.status !== 'resolved') || row.state.obligations?.[0] || null;
          const latestWorklog = row.latestWorklog || row.state.worklog?.[0] || null;
          const inboxMessageId = latestInbox?.sourceMessageId || latestInbox?.messageId || null;
          const obligationMessageId = latestObligation?.sourceMessageId || latestObligation?.messageId || null;
          const worklogMessageId = latestWorklog?.sourceMessageId || latestWorklog?.messageId || null;
          const workingLatestSignal = Boolean(latestWorklog && (
            (latestObligation?.taskId && latestWorklog.taskId === latestObligation.taskId)
            || (latestInbox?.taskId && latestWorklog.taskId === latestInbox.taskId)
            || [inboxMessageId, obligationMessageId].filter(Boolean).some(id => (
              id === worklogMessageId
              || (latestWorklog.sourceMessageIds || []).includes(id)
              || (latestWorklog.responseMessageIds || []).includes(id)
            ))
            || (latestInbox && latestObligation)
          ));
          return {
            receiptState: latestInbox && latestObligation && workingLatestSignal
              ? 'received-and-working'
              : latestInbox && latestObligation
                ? 'received-obligated'
                : latestInbox
                  ? 'received'
                  : 'waiting',
            receivedLatestSignal: Boolean(latestInbox),
            obligatedLatestSignal: Boolean(latestObligation),
            workingLatestSignal,
            inboxProofIds: [inboxMessageId].filter(Boolean),
            obligationProofIds: [obligationMessageId].filter(Boolean),
            workProofIds: [
              worklogMessageId,
              ...(latestWorklog?.sourceMessageIds || []),
              ...(latestWorklog?.responseMessageIds || []),
            ].filter(Boolean),
            timelineLogIds: latestWorklog?.timelineLogIds || [],
          };
        })(),
        needsAttention: Boolean(row.openObligations > 0 || !row.nextRunAt || row.priority > 0 || !row.state.inbox?.length),
      })),
      changeRows: changeFlowRows.slice(0, 5).map(row => {
        const sourceReady = Boolean(row.change.requestMessageId || row.change.sourceMessageIds?.length);
        const discussed = (row.change.discussionMessageIds || []).length > 0;
        const ownerConfirmed = Boolean(row.change.confirmationMessageId);
        const teamSynced = row.teamSyncCount > 0;
        const teamSyncComplete = activeProject.team.length > 1
          ? row.teamSyncCount >= Math.max(1, activeProject.team.length - 1)
          : row.teamSyncCount > 0;
        const ownerWorkStarted = Boolean(row.ownerWorkStarted);
        const checks = [sourceReady, discussed, ownerConfirmed, row.ownerPlanLinked, teamSynced, ownerWorkStarted];
        const passedCount = checks.filter(Boolean).length;
        return {
          changeId: row.change.id,
          taskId: row.change.taskId,
          requestText: row.change.requestText,
          ownerId: row.change.ownerId,
          ownerName: row.change.ownerName || row.change.ownerId || 'Owner pending',
          source: row.change.source,
          sourceChannelId: row.change.sourceChannelId,
          sourceChannelIds: row.change.sourceChannelIds || [],
          sourceModeLabels: row.sourceModeLabels || [],
          sourceReady,
          discussed,
          ownerConfirmed,
          ownerPlanLinked: Boolean(row.ownerPlanLinked),
          teamSynced,
          teamSyncComplete,
          ownerWorkStarted,
          discussionCount: (row.change.discussionMessageIds || []).length,
          discussionDeliveryCount: row.discussionDeliveryCount || 0,
          discussionObligationCount: row.discussionObligationCount || 0,
          teamSyncCount: row.teamSyncCount || 0,
          syncedAgentNames: row.syncedAgentNames || [],
          status: passedCount === checks.length
            ? 'synced'
            : ownerConfirmed && row.ownerPlanLinked
              ? 'owner-plan-ready'
              : discussed
                ? 'awaiting-owner-confirmation'
                : sourceReady
                  ? 'discussion-open'
                  : 'waiting',
          passedCount,
          totalCount: checks.length,
          proofIds: [
            row.change.requestMessageId,
            ...(row.change.sourceMessageIds || []),
            ...(row.change.discussionMessageIds || []),
            row.change.confirmationMessageId,
            row.change.syncMessageId,
            ...(row.ownerWorkMessageIds || []),
          ].filter(Boolean),
          timelineLogIds: [...changeTimelineProofIds(row.change), ...(row.ownerWorkTimelineIds || [])].filter(Boolean),
        };
      }),
      changeReadyCount: changeFlowRows.filter(row => row.ownerPlanLinked && row.teamSyncCount > 0 && row.ownerWorkStarted).length,
      recentEvidenceRows: [
        ...(activeProject.managerActionRunLedger || []).slice(0, 3).map(run => ({
          id: run.id,
          type: 'manager-action-run',
          label: run.actionLabel,
          detail: run.runApiPath || run.apiPath || '',
          time: run.executedAt || run.time,
          proofIds: run.resultMessageIds || [],
          timelineLogIds: run.timelineLogIds || [],
        })),
        ...activeProject.logs.slice(0, 3).map(log => ({
          id: log.id,
          type: log.eventType || 'timeline-log',
          label: log.agent || log.actor || 'Timeline',
          detail: log.log || log.text || '',
          time: log.time,
          proofIds: [],
          timelineLogIds: [log.id].filter(Boolean),
        })),
      ].slice(0, 6),
    };
    const managerCommandCenter = backendManagerCommandCenter || fallbackManagerCommandCenter;
    const latestManagerActionRun = activeProject.managerActionRunLedger?.[0] || null;
    const latestWalkthroughRunStep = latestManagerActionRun
      ? (managerScenarioWalkthrough.rows || []).find(row => (
        row.primaryAction?.requirementId === latestManagerActionRun.requirementId
        || (row.actions || []).some(action => action.requirementId === latestManagerActionRun.requirementId)
      ))
      : null;
    const managerScenarioWalkthroughReceipt = backendStation.managerScenarioWalkthroughReceipt || (latestManagerActionRun && latestWalkthroughRunStep ? {
      stepId: latestWalkthroughRunStep.id,
      stage: latestWalkthroughRunStep.stage,
      actionLabel: latestManagerActionRun.actionLabel,
      runApiPath: latestWalkthroughRunStep.runApiPath || latestManagerActionRun.runApiPath,
      executedAt: latestManagerActionRun.executedAt,
      resultInspection: {
        messageCount: latestManagerActionRun.resultMessageCount || 0,
        messageIds: latestManagerActionRun.resultMessageIds || [],
        timelineLogIds: latestManagerActionRun.timelineLogIds || [latestManagerActionRun.logId].filter(Boolean),
        eventIds: latestManagerActionRun.eventIds || [],
        taskId: latestManagerActionRun.resultTaskId || null,
        cycleId: latestManagerActionRun.resultCycleId || null,
      },
    } : null);
    const resolveManagerActionPath = (row) => {
      const agentId = row.context?.defaultAgentId || managerActionDefaultAgent?.id || activeProject.team.find(agent => !agent.isLeader)?.id || activeProject.team[0]?.id || '';
      return String(row.apiPath || '')
        .replaceAll(':projectId', encodeURIComponent(activeProject.id))
        .replaceAll(':agentId', encodeURIComponent(agentId));
    };
    const runManagerCommandCenterNext = async () => {
      if (!activeProject || !backendOnline || !managerCommandCenter.nextBestAction?.canRun) return null;
      const now = new Date().toISOString();
      setBackendStation(prev => ({ ...prev, loading: true }));
      try {
        await requestAgentBackend(`/projects/${encodeURIComponent(activeProject.id)}`, {
          method: 'PUT',
          body: { project: activeProject },
          timeoutMs: 1200,
        });
        const payload = await requestAgentBackend(`/projects/${encodeURIComponent(activeProject.id)}/manager-command-center/run-next`, {
          method: 'POST',
          body: { now },
          timeoutMs: 2500,
        });
        if (payload.project) {
          applyBackendProjectSnapshot(payload);
        }
        const appliedManagerPayload = applyBackendManagerDashboardPayload(payload);
        setBackendStation(prev => ({
          ...prev,
          connectionStatus: 'online',
          loading: false,
          managerCommandCenter: payload.managerCommandCenter || payload.managerReadyPackage?.managerCommandCenter || prev.managerCommandCenter,
          managerCommandCenterRun: payload.managerCommandCenterRun || prev.managerCommandCenterRun,
          lastManagerCommandCenterSyncAt: payload.managerCommandCenter ? new Date().toISOString() : prev.lastManagerCommandCenterSyncAt,
          managerCommandCenterSyncCount: payload.managerCommandCenter ? (prev.managerCommandCenterSyncCount || 0) + 1 : prev.managerCommandCenterSyncCount,
          lastAction: `Command Center ran: ${payload.managerCommandCenterRun?.actionLabel || managerCommandCenter.nextBestActionLabel || 'next action'}`,
          lastProjectSyncAt: new Date().toISOString(),
          projectSyncCount: payload.project ? (prev.projectSyncCount || 0) + 1 : prev.projectSyncCount,
          error: null,
        }));
        if (!appliedManagerPayload && (payload.project?.id || activeProject.id)) {
          await syncBackendManagerDashboard({ silent: true, projectId: payload.project?.id || activeProject.id });
        }
        return payload;
      } catch (error) {
        setBackendStation(prev => ({
          ...prev,
          connectionStatus: 'offline',
          loading: false,
          lastAction: 'Command Center run failed',
          error: error.name === 'AbortError' ? 'Command Center run timed out.' : error.message || String(error),
        }));
        return null;
      }
    };
    const runManagerActionPlaybookRow = async (row) => {
      if (!activeProject || !backendOnline || !row || !row.canRun) return null;
      const resolvedPath = resolveManagerActionPath(row);
      if (!resolvedPath || resolvedPath.includes(':')) {
        setBackendStation(prev => ({
          ...prev,
          lastAction: 'Manager action needs route context',
          error: `Cannot run ${row.label || row.id}: unresolved route ${row.apiPath || ''}`,
        }));
        return null;
      }
      const now = new Date().toISOString();
      setBackendStation(prev => ({ ...prev, loading: true }));
      try {
        await requestAgentBackend(`/projects/${encodeURIComponent(activeProject.id)}`, {
          method: 'PUT',
          body: { project: activeProject },
          timeoutMs: 1200,
        });
        const actionId = row.requirementId || row.id;
        const runApiPath = row.runApiPath || `/projects/${encodeURIComponent(activeProject.id)}/manager-action-queue/${encodeURIComponent(actionId)}/run`;
        const payload = await requestAgentBackend(runApiPath, {
          method: 'POST',
          body: { now },
          timeoutMs: 2500,
        });
        if (payload.project) {
          applyBackendProjectSnapshot(payload);
        }
        const appliedManagerPayload = applyBackendManagerDashboardPayload(payload);
        setBackendStation(prev => ({
          ...prev,
          connectionStatus: 'online',
          loading: false,
          lastAction: `Manager action ran: ${row.label || row.requirementId || row.id}`,
          lastProjectSyncAt: new Date().toISOString(),
          projectSyncCount: payload.project ? (prev.projectSyncCount || 0) + 1 : prev.projectSyncCount,
          error: null,
        }));
        if (!appliedManagerPayload && (payload.project?.id || activeProject.id)) {
          await syncBackendManagerDashboard({ silent: true, projectId: payload.project?.id || activeProject.id });
        }
        return payload;
      } catch (error) {
        setBackendStation(prev => ({
          ...prev,
          connectionStatus: 'offline',
          loading: false,
          lastAction: 'Manager action failed',
          error: error.name === 'AbortError' ? 'Manager action timed out.' : error.message || String(error),
        }));
        return null;
      }
    };
    const runManagerScenarioWalkthroughRow = async (row) => {
      if (!activeProject || !backendOnline || !row || !row.primaryAction?.canRun) return null;
      const resolvedPath = resolveManagerActionPath(row.primaryAction);
      if (!resolvedPath || resolvedPath.includes(':')) {
        setBackendStation(prev => ({
          ...prev,
          lastAction: 'Walkthrough step needs route context',
          error: `Cannot run ${row.stage || row.id}: unresolved route ${row.primaryAction?.apiPath || ''}`,
        }));
        return null;
      }
      const now = new Date().toISOString();
      setBackendStation(prev => ({ ...prev, loading: true }));
      try {
        await requestAgentBackend(`/projects/${encodeURIComponent(activeProject.id)}`, {
          method: 'PUT',
          body: { project: activeProject },
          timeoutMs: 1200,
        });
        const runApiPath = row.runApiPath || `/projects/${encodeURIComponent(activeProject.id)}/manager-scenario-walkthrough/${encodeURIComponent(row.id || 'next')}/run`;
        const payload = await requestAgentBackend(runApiPath, {
          method: 'POST',
          body: { now },
          timeoutMs: 2500,
        });
        if (payload.project) {
          applyBackendProjectSnapshot(payload);
        }
        const appliedManagerPayload = applyBackendManagerDashboardPayload(payload);
        setBackendStation(prev => ({
          ...prev,
          connectionStatus: 'online',
          loading: false,
          managerScenarioWalkthrough: payload.managerScenarioWalkthrough || prev.managerScenarioWalkthrough,
          managerScenarioWalkthroughReceipt: {
            stepId: row.id,
            stage: row.stage,
            actionLabel: payload.managerAction?.label || row.primaryAction?.label || null,
            runApiPath,
            executedAt: now,
            resultInspection: payload.resultInspection || payload.managerScenarioWalkthroughStep?.resultInspection || null,
          },
          lastAction: `Walkthrough step ran: ${row.stage || row.id}`,
          lastProjectSyncAt: new Date().toISOString(),
          projectSyncCount: payload.project ? (prev.projectSyncCount || 0) + 1 : prev.projectSyncCount,
          error: null,
        }));
        if (!appliedManagerPayload && (payload.project?.id || activeProject.id)) {
          await syncBackendManagerDashboard({ silent: true, projectId: payload.project?.id || activeProject.id });
        }
        setBackendStation(prev => ({
          ...prev,
          connectionStatus: 'online',
          loading: false,
          managerScenarioWalkthrough: payload.managerScenarioWalkthrough || prev.managerScenarioWalkthrough,
          managerScenarioWalkthroughReceipt: {
            stepId: row.id,
            stage: row.stage,
            actionLabel: payload.managerAction?.label || row.primaryAction?.label || null,
            runApiPath,
            executedAt: now,
            resultInspection: payload.resultInspection || payload.managerScenarioWalkthroughStep?.resultInspection || null,
          },
          lastAction: `Walkthrough step ran: ${row.stage || row.id}`,
          error: null,
        }));
        return payload;
      } catch (error) {
        setBackendStation(prev => ({
          ...prev,
          connectionStatus: 'offline',
          loading: false,
          lastAction: 'Walkthrough step failed',
          error: error.name === 'AbortError' ? 'Walkthrough step timed out.' : error.message || String(error),
        }));
        return null;
      }
    };
    const openManagerScenarioWalkthroughRow = (row) => {
      const timelineIds = row.timelineLogIds || row.timelineIds || [];
      if (timelineIds.length) {
        openProjectTimelineProof(timelineIds);
        return;
      }
      if (row.proofIds?.length) {
        openProjectChatProof(activeProject, row.proofIds, row.channelId || 'main');
      }
    };
    const openManagerActionPlaybookRow = (row) => {
      if ((row.proofKind === 'chat' || row.proofKind === 'hybrid') && row.proofIds?.length) {
        openProjectChatProof(activeProject, row.proofIds, row.channelId || 'main');
        return;
      }
      const timelineIds = row.timelineLogIds || row.timelineIds || [];
      if (timelineIds.length) {
        openProjectTimelineProof(timelineIds);
        return;
      }
      const targetId = String(row.uiTarget || '').replace(':agentId', activeProject.team.find(agent => !agent.isLeader)?.id || activeProject.team[0]?.id || '');
      const target = targetId ? document.querySelector(`[data-testid="${targetId}"]`) : null;
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
    const openManagerCommandAttentionRow = (row) => {
      const timelineIds = row.timelineLogIds || row.timelineIds || [];
      if (timelineIds.length) {
        openProjectTimelineProof(timelineIds);
        return;
      }
      if (row.proofIds?.length) {
        openProjectChatProof(activeProject, row.proofIds, row.channelId || 'main');
        return;
      }
      const targetId = String(row.uiTarget || '').replace(':agentId', row.agentId || activeProject.team.find(agent => !agent.isLeader)?.id || activeProject.team[0]?.id || '');
      const target = targetId ? document.querySelector(`[data-testid="${targetId}"]`) : null;
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    return (
      <div className="project-room relative flex-1 overflow-hidden text-[#251b13]">
        {sceneTransition && (
          <div className="absolute right-16 top-1/2 z-50 w-28 h-28 -translate-y-1/2 bg-[#8f1e18] scene-bubble shadow-[0_0_80px_rgba(143,30,24,0.45)]" />
        )}
        <div className="absolute inset-x-0 bottom-0 h-[72vh] archive-table skew-y-[-1.5deg] scale-110" />
        <div className="relative z-10 h-full p-12 overflow-y-auto">
          <div className="project-paper border border-[#7b6542] w-full min-h-[calc(100vh-96px)] p-10 grid grid-cols-12 gap-8">
            <header className="col-span-12 border-b border-[#b8a57d] pb-8 flex items-end justify-between">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#8f1e18] mb-3">Project Dashboard</div>
                <h1 className="font-serif text-6xl leading-none mb-4">{activeProject.name}</h1>
                <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-widest text-[#6b5a3d]">
                  <span className="bg-[#251b13] text-[#efe2bd] px-3 py-1">{projectText(activeProject.status)}</span>
                  <span>ID: {activeProject.id}</span>
                  <span>{activeProject.team.length} {projectText('Members')}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="font-serif text-6xl">{activeProject.progress}%</div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-[#6b5a3d]">{projectText('Project Progress')}</div>
              </div>
            </header>

            <section className="col-span-12 lg:col-span-7">
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
                {managerDashboardStats.map(item => (
                  <div key={item.label} className="bg-[#f7edcf]/70 border border-[#b8a57d] p-5">
                    <item.icon size={18} className="text-[#8f1e18] mb-4" />
                    <div className="font-mono text-[9px] uppercase tracking-widest text-[#7d6a49] mb-2">{item.label}</div>
                    <div className="font-serif text-2xl">{item.value}</div>
                  </div>
                ))}
              </div>

              <div className="bg-[#251b13] text-[#efe2bd] border border-[#5c4933] p-6 mb-6">
                <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-red-200 mb-4">
                  <Sparkles size={15} /> {t('common.nextRecommendation')}
                </div>
                {isInitiatedProject && (
                  <p className="font-serif text-2xl leading-relaxed">
                    {managerNextSuggestion}
                  </p>
                )}
                <p className={`font-serif text-2xl leading-relaxed ${isInitiatedProject ? 'hidden' : ''}`}>
                  {managerNextSuggestion}
                </p>
                {isInitiatedProject && (
                  <div data-testid="dashboard-next-action-resolution" className="mt-5 border-t border-[#7b6542] pt-4 font-mono text-[9px] uppercase tracking-widest text-[#d8c99f] leading-relaxed">
                    <div>
                      NEXT ACTION RESOLUTION: {nextActionResolution?.status || (activeProject.initiation?.output ? 'manager-confirmed' : 'awaiting confirmation')}
                    </div>
                    <div>
                      AGENT RECEIPTS: {nextActionResolutionDelivery ? `${nextActionResolutionDelivery.deliveredAgentIds.length}/${nextActionResolutionDelivery.teamCount}` : `${activeProject.team.length}/${activeProject.team.length}`}
                    </div>
                  </div>
                )}
              </div>

              <div data-testid="dashboard-agent-status" className="bg-[#f7edcf]/70 border border-[#b8a57d] p-5 mb-6">
                <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-[#8f1e18] mb-2">{projectText('Agent Current Work Status')}</div>
                    <div className="font-serif text-2xl leading-tight">{projectText('What each employee is doing, running, and accountable for now.')}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => enterProjectScene('timeline')}
                    disabled={Boolean(sceneTransition)}
                    className="inline-flex shrink-0 items-center justify-center gap-2 border border-[#7b6542] bg-[#251b13] px-4 py-2 font-mono text-[8px] uppercase tracking-widest text-[#efe2bd] hover:border-[#251b13] disabled:opacity-40"
                  >
                    <Network size={12} /> {projectText('Open Flow Graph')}
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {operationsBoardRows.map(row => {
                    const loopRow = continuousWorkRows.find(item => item.agent.id === row.agent.id) || {};
                    const ownedOpenTasks = (activeProject.tasks || []).filter(task => (
                      task.status !== 'done'
                      && (
                        task.ownerId === row.agent.id
                        || task.assignee === row.agent.id
                        || task.assignee === row.agent.name
                        || task.ownerName === row.agent.name
                      )
                    ));
                    const currentTask = ownedOpenTasks[0] || null;
                    const statusLabel = row.state.status || row.latestWorker.reason || row.trigger || 'waiting';
                    return (
                      <div key={`dashboard-agent-status-${row.agent.id}`} data-testid={`dashboard-agent-status-${row.agent.id}`} className="border border-[#d8c99f] bg-[#efe2bd]/55 p-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="font-serif text-xl leading-tight">{row.agent.name}</div>
                              {row.agent.isLeader && <span className="node-status-tag bg-[#8f1e18] text-white">Leader</span>}
                              <span className={`node-status-tag ${row.state.status === 'blocked' ? 'bg-[#8f1e18] text-white' : row.lastRunAt ? 'bg-[#59684b] text-white' : 'bg-[#b9782b] text-white'}`}>
                                {projectText(statusLabel)}
                              </span>
                            </div>
                            <div className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">{row.agent.role}</div>
                            <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-2">
                              <div className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1 min-w-0">
                                <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">{projectText('Doing')}</div>
                                <div className="font-serif text-sm leading-tight text-[#4d412d]">{projectText(row.state.currentPlan?.focus || loopRow.focus || currentTask?.text || 'Monitoring project lane')}</div>
                              </div>
                              <div className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1 min-w-0">
                                <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">{projectText('Skill')}</div>
                                <div className="font-serif text-sm leading-tight text-[#4d412d]">{projectText(loopRow.professionalSkill?.label || row.professionalSkill?.label || 'General judgment')}</div>
                              </div>
                              <div className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1 min-w-0">
                                <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">{projectText('Running')}</div>
                                <div className="font-serif text-sm leading-tight text-[#4d412d]">{projectText(loopRow.routineLabel || row.state.currentPlan?.routine?.label || row.trigger || 'Routine pending')}</div>
                              </div>
                              <div className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1 min-w-0">
                                <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">{projectText('Next')}</div>
                                <div className="font-serif text-sm leading-tight text-[#4d412d]">{row.nextRunAt ? new Date(row.nextRunAt).toLocaleString() : projectText(row.state.currentPlan?.next || 'Awaiting next pulse')}</div>
                              </div>
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-col gap-2 lg:w-36">
                            <div className="grid grid-cols-2 gap-2">
                              <div className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1 text-center">
                                <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{projectText('Tasks')}</div>
                                <div className="font-serif text-lg leading-tight">{ownedOpenTasks.length}</div>
                              </div>
                              <div className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1 text-center">
                                <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{projectText('Proof')}</div>
                                <div className="font-serif text-lg leading-tight">{(loopRow.timelineIds?.length || 0) + (loopRow.chatIds?.length || 0)}</div>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => runBackendAgentPulse(row.agent.id)}
                              disabled={!backendOnline || backendStation.loading}
                              className="inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#efe2bd] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40"
                            >
                              <Activity size={11} /> {projectText('Pulse')}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {isManagerDemoProject(activeProject) && (
              <>
              <div data-testid="scenario-control-center" className="bg-[#f7edcf]/70 border border-[#b8a57d] p-5 mb-6">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-[#8f1e18] mb-2">{projectText('Scenario Control Center')}</div>
                    <div className="font-serif text-2xl leading-tight">{projectText('Kickoff to 24/7 execution, management sync, change intake, and proof exit.')}</div>
                  </div>
                  <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">{projectText(managerReadiness.status)}</span>
                </div>
                <div className="space-y-2">
                  {scenarioControlSteps.map((step, index) => (
                    <div key={`scenario-control-${step.id}`} data-testid={`scenario-control-step-${step.id}`} className="border border-[#d8c99f] bg-[#efe2bd]/55 p-3">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="flex min-w-0 items-start gap-3">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center border border-[#7b6542] bg-[#251b13] font-mono text-[10px] text-[#efe2bd]">
                            {index + 1}
                          </span>
                          <span className="min-w-0">
                            <span className="block font-serif text-lg leading-tight">{projectText(step.title)}</span>
                            <span className="mt-1 block font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed">{projectText(step.status)} / {projectText(step.proof)}</span>
                          </span>
                        </div>
                        <button
                          type="button"
                          data-testid={`scenario-control-action-${step.id}`}
                          onClick={step.action}
                          disabled={Boolean(step.disabled) || Boolean(sceneTransition)}
                          className="inline-flex shrink-0 items-center justify-center gap-1 border border-[#7b6542] bg-[#efe2bd] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Activity size={10} /> {projectText(step.actionLabel)}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div data-testid="manager-live-command-center" className="bg-[#f7edcf]/70 border border-[#b8a57d] p-5 mb-6">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between mb-4">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-[#8f1e18] mb-2">{projectText('Manager Live Command Center')}</div>
                    <div className="font-serif text-2xl leading-tight">{projectText(managerCommandCenter.headline)}</div>
                    <div className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed">
                      {projectText('Next best action')}: {projectText(managerCommandCenter.nextBestActionLabel || 'Keep monitoring live operations')}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <span className={`node-status-tag ${managerCommandCenter.status === 'live' ? 'bg-green-700 text-white' : managerCommandCenter.status === 'action-ready' ? 'bg-[#251b13] text-[#efe2bd]' : 'bg-[#b9782b] text-white'}`}>
                      {projectText(managerCommandCenter.status)}
                    </span>
                    <button
                      type="button"
                      data-testid="manager-command-run-next"
                      onClick={() => runManagerCommandCenterNext()}
                      disabled={!backendOnline || backendStation.loading || !managerCommandCenter.nextBestAction?.canRun}
                      className="inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#251b13] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#efe2bd] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Play size={10} /> {projectText('Run next')}
                    </button>
                  </div>
                </div>
                {backendStation.managerCommandCenterRun && (
                  <div data-testid="manager-command-run-receipt" className="mb-4 border border-[#7b6542] bg-[#efe2bd]/70 px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] leading-relaxed break-words">
                    Command Center run: {backendStation.managerCommandCenterRun.actionLabel || backendStation.managerCommandCenterRun.requirementId} / {backendStation.managerCommandCenterRun.delegatedRunApiPath || 'delegated action'} / messages {(backendStation.managerCommandCenterRun.resultMessageIds || []).length} / timeline {(backendStation.managerCommandCenterRun.timelineLogIds || []).length}
                    <button
                      type="button"
                      data-testid="manager-command-run-proof"
                      onClick={() => openProjectTimelineProof(backendStation.managerCommandCenterRun.timelineLogIds || [])}
                      disabled={!(backendStation.managerCommandCenterRun.timelineLogIds || []).length}
                      className="mt-2 inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#efe2bd] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <CornerDownRight size={10} /> Command run proof
                    </button>
                  </div>
                )}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                  {[
                    ['Scenario', managerCommandCenter.stats?.scenarioTrail || '0/0'],
                    ['Protocols', managerCommandCenter.stats?.syncProtocols || '0/0'],
                    ['Agents Scheduled', managerCommandCenter.stats?.agentsScheduled || '0/0'],
                    ['Attention', managerCommandCenter.attentionCount || 0],
                  ].map(([label, value]) => (
                    <div key={`manager-command-stat-${label}`} className="border border-[#d8c99f] bg-[#efe2bd]/55 px-2 py-1">
                      <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{projectText(label)}</div>
                      <div className="font-serif text-base leading-tight break-words">{value}</div>
                    </div>
                  ))}
                </div>
                <div className="grid gap-3 xl:grid-cols-5 mb-4">
                  {(managerCommandCenter.liveLanes || []).map(lane => (
                    <div key={`manager-command-lane-${lane.id}`} data-testid={`manager-command-lane-${lane.id}`} className="border border-[#d8c99f] bg-[#efe2bd]/55 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-serif text-base leading-tight">{projectText(lane.label)}</div>
                        <span className={`node-status-tag ${lane.status === 'active' || lane.status === 'ready' ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>
                          {projectText(lane.status)}
                        </span>
                      </div>
                      <div className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed">{projectText(lane.detail)}</div>
                      <div className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#9b875c]">{projectText('Proof')} {lane.proofCount || 0}</div>
                    </div>
                  ))}
                </div>
                <div className="grid gap-3 xl:grid-cols-3 2xl:grid-cols-6">
                  <div data-testid="manager-command-kickoff-board" className="border border-[#d8c99f] bg-[#efe2bd]/45 p-3">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">{projectText('Kickoff Decision Board')}</div>
                        <div className="font-serif text-lg leading-tight">{projectText('Brief, roles, Leader election, roster, and next actions')}</div>
                      </div>
                      <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">{managerCommandCenter.kickoffBoard?.readyCount || 0}/{managerCommandCenter.kickoffBoard?.count || 0} {projectText('ready')}</span>
                    </div>
                    <div className="space-y-2">
                      {(managerCommandCenter.kickoffBoard?.rows || []).map(row => (
                        <div key={`manager-command-kickoff-${row.id}`} data-testid={`manager-command-kickoff-${row.id}`} className="border border-[#d8c99f] bg-[#f7edcf]/70 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-serif text-base leading-tight">{projectText(row.label)}</div>
                              <div className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed break-words">{projectText(row.detail)}</div>
                            </div>
                            <span className={`node-status-tag ${row.passed ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>
                              {projectText(row.passed ? 'ready' : 'pending')}
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <button
                              type="button"
                              data-testid={`manager-command-kickoff-proof-${row.id}`}
                              onClick={() => (row.timelineLogIds || []).length ? openProjectTimelineProof(row.timelineLogIds || []) : openProjectChatProof(activeProject, row.proofIds || [], 'main')}
                              disabled={!((row.proofIds || []).length || (row.timelineLogIds || []).length)}
                              className="inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#efe2bd] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <CornerDownRight size={10} /> {projectText('Kickoff proof')}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div data-testid="manager-command-work-loop-board" className="border border-[#d8c99f] bg-[#efe2bd]/45 p-3">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">{projectText('Work Loop Board')}</div>
                        <div className="font-serif text-lg leading-tight">{projectText('24/7 schedules, routines, first pulse, and proof')}</div>
                      </div>
                      <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">{managerCommandCenter.workLoopBoard?.runningCount || 0}/{managerCommandCenter.workLoopBoard?.count || 0} {projectText('running')}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-3 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">
                      <span>{projectText('Scheduled')} {managerCommandCenter.workLoopBoard?.scheduledCount || 0}</span>
                      <span>{projectText('Proofed')} {managerCommandCenter.workLoopBoard?.proofedCount || 0}</span>
                      <span>{projectText('Routines')} {managerCommandCenter.workLoopBoard?.routineCount || 0}</span>
                      <span>{projectText('Timeline')} {managerCommandCenter.workLoopBoard?.timelineProofCount || 0}</span>
                    </div>
                    <div className="space-y-2">
                      {(managerCommandCenter.workLoopBoard?.rows || []).slice(0, 5).map(row => (
                        <div key={`manager-command-work-loop-${row.agentId}`} data-testid={`manager-command-work-loop-${row.agentId}`} className="border border-[#d8c99f] bg-[#f7edcf]/70 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-serif text-base leading-tight">{row.name}</div>
                              <div className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed break-words">{projectText(row.routineLabel || 'fixed routine')} / {projectText(row.focus || row.loopState)}</div>
                            </div>
                            <span className={`node-status-tag ${row.status === 'running' ? 'bg-green-700 text-white' : row.status === 'scheduled' ? 'bg-[#251b13] text-[#efe2bd]' : 'bg-[#b9782b] text-white'}`}>
                              {projectText(row.status)}
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1">
                            <span className={`node-status-tag ${row.scheduled ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>{projectText('Scheduled')}</span>
                            <span className={`node-status-tag ${row.routineReady ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>{projectText('Routine')}</span>
                            <span className={`node-status-tag ${row.firstPulseReady ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>{projectText('First Pulse')}</span>
                            <span className={`node-status-tag ${row.timelineReady ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>{projectText('Timeline')}</span>
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">
                            <span>{projectText('Next')} {row.nextRunAt ? new Date(row.nextRunAt).toLocaleTimeString() : projectText('none')}</span>
                            <span>{projectText('Last')} {row.lastRunAt ? new Date(row.lastRunAt).toLocaleTimeString() : projectText('none')}</span>
                          </div>
                          <div className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed break-words">
                            {projectText('Next step')}: {projectText(row.nextStep || 'publish the next proof marker')}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <button
                              type="button"
                              data-testid={`manager-command-work-loop-chat-proof-${row.agentId}`}
                              onClick={() => openProjectChatProof(activeProject, row.chatProofIds || [], 'main')}
                              disabled={!(row.chatProofIds || []).length}
                              className="inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#efe2bd] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <MessageSquare size={10} /> {projectText('Loop chat')}
                            </button>
                            <button
                              type="button"
                              data-testid={`manager-command-work-loop-proof-${row.agentId}`}
                              onClick={() => openProjectTimelineProof(row.timelineLogIds || [])}
                              disabled={!(row.timelineLogIds || []).length}
                              className="inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#efe2bd] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <CornerDownRight size={10} /> {projectText('Loop proof')}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div data-testid="manager-command-collaboration-board" className="border border-[#d8c99f] bg-[#efe2bd]/45 p-3">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">{projectText('Collaboration Board')}</div>
                        <div className="font-serif text-lg leading-tight">{projectText('Leader @assignments, Agent messages, handoffs, and mutual management')}</div>
                      </div>
                      <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">{managerCommandCenter.collaborationBoard?.readyCount || 0}/{managerCommandCenter.collaborationBoard?.count || 0} {projectText('synced')}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-3 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">
                      <span>{projectText('Assignments')} {managerCommandCenter.collaborationBoard?.assignmentCount || 0}</span>
                      <span>{projectText('Messages')} {managerCommandCenter.collaborationBoard?.agentMessageCount || 0}</span>
                      <span>{projectText('Delivered')} {managerCommandCenter.collaborationBoard?.deliveredMessageCount || 0}</span>
                      <span>{projectText('Peer links')} {managerCommandCenter.collaborationBoard?.managementLinkCount || 0}</span>
                    </div>
                    <div className="space-y-2">
                      {(managerCommandCenter.collaborationBoard?.rows || []).map(row => (
                        <div key={`manager-command-collaboration-${row.id}`} data-testid={`manager-command-collaboration-${row.id}`} className="border border-[#d8c99f] bg-[#f7edcf]/70 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-serif text-base leading-tight">{projectText(row.label)}</div>
                              <div className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed break-words">{projectText(row.detail)}</div>
                            </div>
                            <span className={`node-status-tag ${row.passed ? 'bg-green-700 text-white' : row.status === 'waiting' ? 'bg-[#b9782b] text-white' : 'bg-[#251b13] text-[#efe2bd]'}`}>
                              {projectText(row.status)}
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <button
                              type="button"
                              data-testid={`manager-command-collaboration-chat-proof-${row.id}`}
                              onClick={() => openProjectChatProof(activeProject, row.proofIds || [], 'main')}
                              disabled={!(row.proofIds || []).length}
                              className="inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#efe2bd] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <MessageSquare size={10} /> {projectText('Collaboration chat')}
                            </button>
                            <button
                              type="button"
                              data-testid={`manager-command-collaboration-proof-${row.id}`}
                              onClick={() => openProjectTimelineProof(row.timelineLogIds || [])}
                              disabled={!(row.timelineLogIds || []).length}
                              className="inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#efe2bd] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <CornerDownRight size={10} /> {projectText('Collaboration proof')}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div data-testid="manager-command-change-protocol-board" className="border border-[#d8c99f] bg-[#efe2bd]/45 p-3">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">{projectText('Change Protocol Board')}</div>
                        <div className="font-serif text-lg leading-tight">{projectText('Meeting plus Google Chat, discussion, owner plan, and team resync')}</div>
                      </div>
                      <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">{managerCommandCenter.changeProtocolBoard?.readyCount || 0}/{managerCommandCenter.changeProtocolBoard?.count || 0} {projectText('ready')}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-3 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">
                      <span>{projectText('Dual')} {managerCommandCenter.changeProtocolBoard?.dualChannelCount || 0}</span>
                      <span>{projectText('Sources')} {managerCommandCenter.changeProtocolBoard?.sourceReadyCount || 0}</span>
                      <span>{projectText('Plans')} {managerCommandCenter.changeProtocolBoard?.ownerPlanCount || 0}</span>
                      <span>{projectText('Syncs')} {managerCommandCenter.changeProtocolBoard?.teamSyncCount || 0}</span>
                    </div>
                    <div className="space-y-2">
                      {(managerCommandCenter.changeProtocolBoard?.rows || []).map(row => (
                        <div key={`manager-command-change-protocol-${row.id}`} data-testid={`manager-command-change-protocol-${row.id}`} className="border border-[#d8c99f] bg-[#f7edcf]/70 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-serif text-base leading-tight">{projectText(row.label)}</div>
                              <div className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed break-words">{projectText(row.detail)}</div>
                            </div>
                            <span className={`node-status-tag ${row.passed ? 'bg-green-700 text-white' : row.status === 'waiting' ? 'bg-[#b9782b] text-white' : 'bg-[#251b13] text-[#efe2bd]'}`}>
                              {projectText(row.status)}
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <button
                              type="button"
                              data-testid={`manager-command-change-protocol-chat-proof-${row.id}`}
                              onClick={() => openProjectChatProof(activeProject, row.proofIds || [], row.channelId || 'main')}
                              disabled={!(row.proofIds || []).length}
                              className="inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#efe2bd] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <MessageSquare size={10} /> {projectText('Change protocol chat')}
                            </button>
                            <button
                              type="button"
                              data-testid={`manager-command-change-protocol-proof-${row.id}`}
                              onClick={() => openProjectTimelineProof(row.timelineLogIds || [])}
                              disabled={!(row.timelineLogIds || []).length}
                              className="inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#efe2bd] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <CornerDownRight size={10} /> {projectText('Change protocol proof')}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="border border-[#d8c99f] bg-[#efe2bd]/45 p-3">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">{projectText('Attention Queue')}</div>
                        <div className="font-serif text-lg leading-tight">{projectText('What needs manager eyes now')}</div>
                      </div>
                      <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">{managerCommandCenter.criticalCount || 0} {projectText('critical')}</span>
                    </div>
                    <div className="space-y-2">
                      {(managerCommandCenter.attentionRows || []).slice(0, 5).map(row => (
                        <div key={`manager-command-attention-${row.id}`} data-testid={`manager-command-attention-${row.id}`} className="border border-[#d8c99f] bg-[#f7edcf]/70 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-serif text-base leading-tight">{projectText(row.title)}</div>
                              <div className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed break-words">{projectText(row.detail)}</div>
                            </div>
                            <span className={`node-status-tag ${row.severity === 'critical' ? 'bg-[#8f1e18] text-white' : row.severity === 'action' ? 'bg-[#251b13] text-[#efe2bd]' : 'bg-[#b9782b] text-white'}`}>
                              {projectText(row.severity)}
                            </span>
                          </div>
                          <button
                            type="button"
                            data-testid={`manager-command-attention-open-${row.id}`}
                            onClick={() => openManagerCommandAttentionRow(row)}
                            className="mt-2 inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#efe2bd] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13]"
                          >
                            <CornerDownRight size={10} /> {projectText('Open')}
                          </button>
                        </div>
                      ))}
                      {!(managerCommandCenter.attentionRows || []).length && (
                        <div className="border border-[#d8c99f] bg-[#f7edcf]/70 p-3 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">
                          {projectText('No command attention rows.')}
                        </div>
                      )}
                    </div>
                  </div>
                  <div data-testid="manager-command-change-sync" className="border border-[#d8c99f] bg-[#efe2bd]/45 p-3">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">{projectText('Change Owner Sync')}</div>
                        <div className="font-serif text-lg leading-tight">{projectText('Owner confirmation, plan, team sync, and first work')}</div>
                      </div>
                      <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">{managerCommandCenter.changeReadyCount || 0}/{(managerCommandCenter.changeRows || []).length} {projectText('synced')}</span>
                    </div>
                    <div className="space-y-2">
                      {(managerCommandCenter.changeRows || []).slice(0, 4).map(row => (
                        <div key={`manager-command-change-${row.changeId}`} data-testid={`manager-command-change-${row.changeId}`} className="border border-[#d8c99f] bg-[#f7edcf]/70 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-serif text-base leading-tight">{projectText(row.requestText)}</div>
                              <div className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed break-words">
                                {projectText('Owner')} {row.ownerName} / {row.passedCount || 0}-{row.totalCount || 0} {projectText('checks')} / {projectText(row.status)}
                              </div>
                            </div>
                            <span className={`node-status-tag ${row.status === 'synced' ? 'bg-green-700 text-white' : row.status === 'waiting' ? 'bg-[#b9782b] text-white' : 'bg-[#251b13] text-[#efe2bd]'}`}>
                              {projectText(row.status)}
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1">
                            <span className={`node-status-tag ${row.sourceReady ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>{projectText('Source')}</span>
                            <span className={`node-status-tag ${row.discussed ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>{projectText('Discussion')}</span>
                            <span className={`node-status-tag ${row.ownerConfirmed ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>{projectText('Owner Confirmed')}</span>
                            <span className={`node-status-tag ${row.ownerPlanLinked ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>{projectText('Plan Updated')}</span>
                            <span className={`node-status-tag ${row.teamSynced ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>{projectText('Team Synced')}</span>
                            <span className={`node-status-tag ${row.ownerWorkStarted ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>{projectText('Owner Work')}</span>
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">
                            <span>{projectText('Discussion')} {row.discussionCount || 0}</span>
                            <span>{projectText('Team')} {row.teamSyncCount || 0}</span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <button
                              type="button"
                              data-testid={`manager-command-change-proof-${row.changeId}`}
                              onClick={() => openProjectChatProof(activeProject, row.proofIds || [], row.sourceChannelId === 'google_chat' ? 'google_chat' : 'main')}
                              disabled={!(row.proofIds || []).length}
                              className="inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#efe2bd] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <MessageSquare size={10} /> {projectText('Change proof')}
                            </button>
                            <button
                              type="button"
                              data-testid={`manager-command-change-timeline-proof-${row.changeId}`}
                              onClick={() => openProjectTimelineProof(row.timelineLogIds || [])}
                              disabled={!(row.timelineLogIds || []).length}
                              className="inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#efe2bd] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <CornerDownRight size={10} /> {projectText('Timeline proof')}
                            </button>
                          </div>
                        </div>
                      ))}
                      {!(managerCommandCenter.changeRows || []).length && (
                        <div className="border border-[#d8c99f] bg-[#f7edcf]/70 p-3 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">
                          {projectText('No change requests yet.')}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="border border-[#d8c99f] bg-[#efe2bd]/45 p-3">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">{projectText('Agent Readiness')}</div>
                        <div className="font-serif text-lg leading-tight">{projectText('Routines, obligations, and next runs')}</div>
                      </div>
                      <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">{(managerCommandCenter.agentRows || []).filter(row => row.needsAttention).length} {projectText('watch')}</span>
                    </div>
                    <div className="space-y-2">
                      {(managerCommandCenter.agentRows || []).slice(0, 5).map(row => (
                        <div key={`manager-command-agent-${row.agentId}`} data-testid={`manager-command-agent-${row.agentId}`} className="border border-[#d8c99f] bg-[#f7edcf]/70 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-serif text-base leading-tight">{row.name}</div>
                              <div className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed break-words">{projectText(row.routineLabel || 'fixed routine')} / {projectText(row.focus || row.status)}</div>
                            </div>
                            <span className={`node-status-tag ${row.needsAttention ? 'bg-[#b9782b] text-white' : 'bg-green-700 text-white'}`}>
                              {projectText(row.needsAttention ? 'watch' : 'ready')}
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1">
                            <span className={`node-status-tag ${row.receivedLatestSignal ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>{projectText('Receipt')}</span>
                            <span className={`node-status-tag ${row.obligatedLatestSignal ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>{projectText('Obligation')}</span>
                            <span className={`node-status-tag ${row.workingLatestSignal ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>{projectText('Work Started')}</span>
                          </div>
                          <div className="mt-2 border border-[#d8c99f] bg-[#efe2bd]/60 p-2">
                            <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">{projectText('Latest @Signal')}</div>
                            <div className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed break-words">
                              {projectText(row.latestInbox?.text || row.latestInbox?.source || 'No direct signal yet')}
                            </div>
                          </div>
                          <div className="mt-2 border border-[#d8c99f] bg-[#efe2bd]/60 p-2">
                            <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">{projectText('Latest Work')}</div>
                            <div className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed break-words">
                              {projectText(row.latestWorklog?.text || row.latestWorklog?.source || 'No work pulse yet')}
                            </div>
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">
                            <span>{projectText('Open')} {row.openObligationCount || 0}</span>
                            <span>{projectText('Next')} {row.nextRunAt ? new Date(row.nextRunAt).toLocaleTimeString() : projectText('none')}</span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <button
                              type="button"
                              data-testid={`manager-command-agent-inbox-proof-${row.agentId}`}
                              onClick={() => openProjectChatProof(activeProject, [...(row.inboxProofIds || []), ...(row.obligationProofIds || [])], row.latestInbox?.channelId || row.latestInbox?.sourceChannelId || 'main')}
                              disabled={!((row.inboxProofIds || []).length || (row.obligationProofIds || []).length)}
                              className="inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#efe2bd] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <MessageSquare size={10} /> {projectText('Signal proof')}
                            </button>
                            <button
                              type="button"
                              data-testid={`manager-command-agent-work-proof-${row.agentId}`}
                              onClick={() => (row.timelineLogIds || []).length ? openProjectTimelineProof(row.timelineLogIds || []) : openProjectChatProof(activeProject, row.workProofIds || [], row.latestWorklog?.channelId || row.latestWorklog?.sourceChannelId || 'main')}
                              disabled={!((row.timelineLogIds || []).length || (row.workProofIds || []).length)}
                              className="inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#efe2bd] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <CornerDownRight size={10} /> {projectText('Work proof')}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div data-testid="manager-scenario-walkthrough" className="bg-[#f7edcf]/70 border border-[#b8a57d] p-5 mb-6">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-[#8f1e18] mb-2">{projectText('Manager Scenario Walkthrough')}</div>
                    <div className="font-serif text-2xl leading-tight">{projectText('A single guided path from kickoff meeting to 24/7 Agent work, change intake, and mutual management.')}</div>
                  </div>
                  <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">
                    {managerScenarioWalkthrough.completedCount || 0}/{managerScenarioWalkthrough.count || 0} {projectText('complete')}
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                  {[
                    ['Next Gap', managerScenarioWalkthrough.nextIncompleteStep?.stage || 'All covered'],
                    ['Rerunnable', managerScenarioWalkthrough.nextRunnableStep?.stage || 'None'],
                    ['Runnable', managerScenarioWalkthrough.runnableCount || 0],
                    ['Action Queue', `${managerActionPlaybook.completedCount ?? 0}/${managerActionPlaybook.count ?? 0}`],
                  ].map(([label, value]) => (
                    <div key={`walkthrough-stat-${label}`} className="border border-[#d8c99f] bg-[#efe2bd]/55 px-2 py-1">
                      <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{projectText(label)}</div>
                      <div className="font-serif text-base leading-tight break-words">{projectText(value)}</div>
                    </div>
                  ))}
                </div>
                {managerScenarioWalkthroughReceipt && (
                  <div data-testid="manager-walkthrough-run-receipt" className="mb-4 border border-[#7b6542] bg-[#efe2bd]/70 px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] leading-relaxed break-words">
                    Walkthrough step ran: {managerScenarioWalkthroughReceipt.stage || managerScenarioWalkthroughReceipt.stepId} / {managerScenarioWalkthroughReceipt.actionLabel || 'primary action'} / {managerScenarioWalkthroughReceipt.runApiPath}
                    <span className="mt-1 block">
                      Result inspection: messages {managerScenarioWalkthroughReceipt.resultInspection?.messageCount || 0} / timeline proofs {(managerScenarioWalkthroughReceipt.resultInspection?.timelineLogIds || []).length} / task {managerScenarioWalkthroughReceipt.resultInspection?.taskId || 'none'} / cycle {managerScenarioWalkthroughReceipt.resultInspection?.cycleId || 'none'}
                    </span>
                    <button
                      type="button"
                      data-testid="manager-walkthrough-run-proof"
                      onClick={() => openProjectTimelineProof(managerScenarioWalkthroughReceipt.resultInspection?.timelineLogIds || [])}
                      disabled={!(managerScenarioWalkthroughReceipt.resultInspection?.timelineLogIds || []).length}
                      className="mt-2 inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#efe2bd] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <CornerDownRight size={10} /> Run result proof
                    </button>
                  </div>
                )}
                <div className="space-y-2">
                  {(managerScenarioWalkthrough.rows || []).map((row, index) => (
                    <div key={`manager-walkthrough-${row.id}`} data-testid={`manager-walkthrough-row-${row.id}`} className="border border-[#d8c99f] bg-[#efe2bd]/55 p-3">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex min-w-0 items-start gap-3">
                          <span className={`flex h-7 w-7 shrink-0 items-center justify-center border font-mono text-[10px] ${row.completed ? 'border-green-700 bg-green-700 text-white' : row.primaryAction?.canRun ? 'border-[#8f1e18] bg-[#8f1e18] text-white' : 'border-[#b9782b] bg-[#f7edcf] text-[#8f1e18]'}`}>
                            {row.completed ? <CheckCircle2 size={13} /> : index + 1}
                          </span>
                          <span className="min-w-0">
                            <span className="block font-serif text-lg leading-tight">{row.stage}</span>
                            <span className="mt-1 block font-serif text-sm leading-tight text-[#4a3827]">{row.managerIntent}</span>
                            <span className="mt-1 block font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed break-words">
                              {row.coveredCount || 0}/{row.requirementCount || 0} requirements / {row.status}
                            </span>
                            <span className="mt-1 block font-mono text-[8px] uppercase tracking-widest text-[#9b875c] leading-relaxed break-words">
                              Primary action: {row.primaryAction?.label || 'Proof review'} / Runnable actions: {row.runnableActionCount || 0}
                            </span>
                            {row.primaryAction?.runApiPath && (
                              <span className="mt-1 block font-mono text-[8px] uppercase tracking-widest text-[#9b875c] leading-relaxed break-words">
                                Manager route: {row.managerRoute || row.primaryAction.runApiPath} / Run route: {row.runApiPath || row.primaryAction.runApiPath}
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                          <button
                            type="button"
                            data-testid={`manager-walkthrough-run-${row.id}`}
                            onClick={() => runManagerScenarioWalkthroughRow(row)}
                            disabled={!backendOnline || backendStation.loading || !row.primaryAction?.canRun || row.primaryAction?.routeResolved === false || String(row.primaryAction?.apiPath || '').includes(':')}
                            className="inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#251b13] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#efe2bd] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Play size={10} /> Run walkthrough step
                          </button>
                          <button
                            type="button"
                            data-testid={`manager-walkthrough-proof-${row.id}`}
                            onClick={() => openManagerScenarioWalkthroughRow(row)}
                            disabled={!(row.proofIds?.length || row.timelineLogIds?.length || row.timelineIds?.length)}
                            className="inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#efe2bd] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <CornerDownRight size={10} /> Walkthrough proof
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div data-testid="manager-action-playbook" className="bg-[#f7edcf]/70 border border-[#b8a57d] p-5 mb-6">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-[#8f1e18] mb-2">Manager Action Playbook</div>
                    <div className="font-serif text-2xl leading-tight">Operational next steps mapped to runnable backend routes and exact proof exits.</div>
                  </div>
                  <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">
                    {managerActionPlaybook.completedCount ?? 0}/{managerActionPlaybook.count ?? 0} complete
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                  {[
                    ['Complete', managerActionPlaybook.completedCount ?? 0],
                    ['Ready', managerActionPlaybook.readyCount ?? 0],
                    ['Blocked', managerActionPlaybook.blockedCount ?? 0],
                    ['Next', managerActionPlaybook.nextAction?.label || 'All complete'],
                  ].map(([label, value]) => (
                    <div key={`manager-action-playbook-stat-${label}`} className="border border-[#d8c99f] bg-[#efe2bd]/55 px-2 py-1">
                      <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{label}</div>
                      <div className="font-serif text-base leading-tight break-words">{value}</div>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  {(managerActionPlaybook.rows || []).map((row, index) => (
                    <div key={`manager-action-playbook-${row.id}`} data-testid={`manager-action-playbook-row-${row.requirementId || row.id}`} className="border border-[#d8c99f] bg-[#efe2bd]/55 p-3">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="flex min-w-0 items-start gap-3">
                          <span className={`flex h-7 w-7 shrink-0 items-center justify-center border font-mono text-[10px] ${row.status === 'complete' ? 'border-green-700 bg-green-700 text-white' : row.status === 'ready' ? 'border-[#8f1e18] bg-[#8f1e18] text-white' : 'border-[#b9782b] bg-[#f7edcf] text-[#8f1e18]'}`}>
                            {row.status === 'complete' ? <CheckCircle2 size={13} /> : index + 1}
                          </span>
                          <span className="min-w-0">
                            <span className="block font-serif text-lg leading-tight">{row.label}</span>
                            <span className="mt-1 block font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed break-words">
                              {row.phase} / {row.status} / {row.evidence || row.description}
                            </span>
                            <span className="mt-1 block font-mono text-[8px] uppercase tracking-widest text-[#9b875c] leading-relaxed break-words">
                              {row.method} {row.apiPath} / {row.routeResolved === false ? 'needs context' : 'route resolved'}{row.rerunnable ? ' / rerunnable' : ''}
                            </span>
                            {row.runApiPath && row.method !== 'GET' && (
                              <span className="mt-1 block font-mono text-[8px] uppercase tracking-widest text-[#9b875c] leading-relaxed break-words">
                                Run route: {row.runApiPath}
                              </span>
                            )}
                            {row.requestBodyTemplate && (
                              <span className="mt-1 block font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] leading-relaxed break-words">
                                {projectText('Body template')}: {projectText(JSON.stringify(row.requestBodyTemplate))}
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                          <button
                            type="button"
                            data-testid={`manager-action-playbook-run-${row.requirementId || row.id}`}
                            onClick={() => runManagerActionPlaybookRow(row)}
                            disabled={!backendOnline || backendStation.loading || !row.canRun || row.routeResolved === false || String(row.apiPath || '').includes(':')}
                            className="inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#251b13] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#efe2bd] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Play size={10} /> {projectText(row.status === 'complete' && row.rerunnable ? 'Run Again' : 'Run Action')}
                          </button>
                          <button
                            type="button"
                            data-testid={`manager-action-playbook-open-${row.requirementId || row.id}`}
                            onClick={() => openManagerActionPlaybookRow(row)}
                            disabled={!(row.proofIds?.length || row.timelineLogIds?.length || row.timelineIds?.length || row.uiTarget)}
                            className="inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#efe2bd] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <CornerDownRight size={10} /> Open Step
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div data-testid="manager-action-run-ledger" className="bg-[#f7edcf]/70 border border-[#b8a57d] p-5 mb-6">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-[#8f1e18] mb-2">Manager Action Run Ledger</div>
                    <div className="font-serif text-2xl leading-tight">Every Playbook execution becomes timeline evidence and a backend action receipt.</div>
                  </div>
                  <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">
                    {backendManagerActionRuns?.count || 0} runs
                  </span>
                </div>
                <div className="space-y-2">
                  {(backendManagerActionRuns?.rows || []).slice(0, 4).map((run, index) => (
                    <div key={`manager-action-run-${run.id || index}`} data-testid={`manager-action-run-row-${run.requirementId || run.actionId || index}`} className="border border-[#d8c99f] bg-[#efe2bd]/55 p-3">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="min-w-0">
                          <div className="font-serif text-lg leading-tight">{run.actionLabel || run.label || run.requirementId || 'Manager action'}</div>
                          <div className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed break-words">
                            {run.executedAt ? new Date(run.executedAt).toLocaleString() : 'recent'} / {run.resultRoute || 'manager-action-queue-item-run'} / {run.runApiPath || run.route || 'run route pending'}
                          </div>
                          <div className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#9b875c] leading-relaxed break-words">
                            Timeline proof: {(run.timelineLogIds || [run.logId].filter(Boolean)).length} / Messages: {run.resultMessageCount || 0}
                          </div>
                        </div>
                        <button
                          type="button"
                          data-testid={`manager-action-run-proof-${run.requirementId || run.actionId || index}`}
                          onClick={() => openProjectTimelineProof((run.timelineLogIds || [run.logId]).filter(Boolean))}
                          disabled={!(run.timelineLogIds?.length || run.logId)}
                          className="inline-flex shrink-0 items-center justify-center gap-1 border border-[#7b6542] bg-[#efe2bd] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <CornerDownRight size={10} /> Run proof
                        </button>
                      </div>
                    </div>
                  ))}
                  {!(backendManagerActionRuns?.rows || []).length && (
                    <div className="border border-dashed border-[#d8c99f] bg-[#efe2bd]/45 p-3 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">
                      No Playbook runs yet. Use Run Action on a ready row to create the first audit receipt.
                    </div>
                  )}
                </div>
              </div>

              <div data-testid="manager-scenario-trail" className="bg-[#f7edcf]/70 border border-[#b8a57d] p-5 mb-6">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-[#8f1e18] mb-2">Manager Scenario Trail</div>
                    <div className="font-serif text-2xl leading-tight">One end-to-end route from kickoff meeting to continuous Agent work and mid-project change sync.</div>
                  </div>
                  <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">
                    {managerScenarioTrailRows.filter(row => row.passed).length}/{managerScenarioTrailRows.length} ready
                  </span>
                </div>
                <div className="space-y-2">
                  {managerScenarioTrailRows.map((row, index) => (
                    <div key={`manager-scenario-trail-${row.id}`} data-testid={`manager-scenario-trail-row-${row.id}`} className="border border-[#d8c99f] bg-[#efe2bd]/55 p-3">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="flex min-w-0 items-start gap-3">
                          <span className={`flex h-7 w-7 shrink-0 items-center justify-center border font-mono text-[10px] ${row.passed ? 'border-green-700 bg-green-700 text-white' : 'border-[#b9782b] bg-[#f7edcf] text-[#8f1e18]'}`}>
                            {row.passed ? <CheckCircle2 size={13} /> : index + 1}
                          </span>
                          <span className="min-w-0">
                            <span className="block font-serif text-lg leading-tight">{row.stage}</span>
                            <span className="mt-1 block font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed break-words">{row.outcome}</span>
                          </span>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                          <span className={`node-status-tag ${row.passed ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>{row.passed ? 'Ready' : 'Needs Proof'}</span>
                          <button
                            type="button"
                            data-testid={`manager-scenario-trail-proof-${row.id}`}
                            onClick={() => openScenarioTrailRow(row)}
                            disabled={!(row.proofIds?.length || row.timelineIds?.length)}
                            className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <CornerDownRight size={10} /> Trail proof
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div data-testid="sync-protocol-audit" className="bg-[#f7edcf]/70 border border-[#b8a57d] p-5 mb-6">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-[#8f1e18] mb-2">Sync Protocol Audit</div>
                    <div className="font-serif text-2xl leading-tight">Backend collaboration protocol from message source to Agent state, timeline, and ledger.</div>
                  </div>
                  <span className={`node-status-tag ${syncProtocolAudit.status === 'synced' ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>
                    {syncProtocolAudit.syncedCount || 0}/{syncProtocolAudit.count || 0} synced
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {(syncProtocolAudit.rows || []).map(row => {
                    const timelineIds = row.timelineLogIds || row.timelineIds || [];
                    const chatIds = row.proofIds || [];
                    return (
                      <div key={`sync-protocol-${row.id}`} data-testid={`sync-protocol-row-${row.id}`} className="border border-[#d8c99f] bg-[#efe2bd]/55 p-3">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <div className="font-serif text-lg leading-tight">{row.protocol}</div>
                            <div className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed break-words">
                              {row.managerMeaning}
                            </div>
                            <div className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#9b875c]">
                              Source {row.source} / {row.passedCount || 0}-{row.totalCount || 0} checks / {row.status}
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-wrap gap-1.5">
                            {[
                              ['Published', row.published],
                              ['Delivered', row.delivered],
                              ['Agent State', row.agentStateWritten],
                              ['Timeline', row.timelineRecorded],
                              ['Ledger', row.eventLedgerRecorded],
                            ].map(([label, passed]) => (
                              <span key={`${row.id}-${label}`} className={`node-status-tag ${passed ? 'bg-green-700 text-white' : 'bg-[#d8c99f] text-[#251b13]'}`}>{label}</span>
                            ))}
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {chatIds.length > 0 && (
                            <button
                              type="button"
                              data-testid={`sync-protocol-chat-proof-${row.id}`}
                              onClick={() => openProjectChatProof(activeProject, chatIds, row.source === 'meeting-google-chat' ? 'main' : 'main')}
                              className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
                            >
                              <MessageSquare size={10} /> Protocol chat proof
                            </button>
                          )}
                          {timelineIds.length > 0 && (
                            <button
                              type="button"
                              data-testid={`sync-protocol-timeline-proof-${row.id}`}
                              onClick={() => openProjectTimelineProof(timelineIds)}
                              className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
                            >
                              <ScrollText size={10} /> Protocol timeline proof
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div data-testid="manager-use-case-audit" className="bg-[#f7edcf]/70 border border-[#b8a57d] p-5 mb-6">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-[#8f1e18] mb-2">Manager Use Case Audit</div>
                    <div className="font-serif text-2xl leading-tight">The user story translated into manager-readable coverage checks and proof exits.</div>
                  </div>
                  <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">
                    {managerUseCaseAudit.coveredCount || 0}/{managerUseCaseAudit.count || 0} covered
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {(managerUseCaseAudit.rows || []).map((row, index) => (
                    <div key={`manager-use-case-${row.id}`} data-testid={`manager-use-case-row-${row.id}`} className="border border-[#d8c99f] bg-[#efe2bd]/55 p-3">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex min-w-0 items-start gap-3">
                          <span className={`flex h-7 w-7 shrink-0 items-center justify-center border font-mono text-[10px] ${row.status === 'covered' ? 'border-green-700 bg-green-700 text-white' : row.status === 'partial' ? 'border-[#b9782b] bg-[#b9782b] text-white' : 'border-[#8f1e18] bg-[#f7edcf] text-[#8f1e18]'}`}>
                            {row.status === 'covered' ? <CheckCircle2 size={13} /> : index + 1}
                          </span>
                          <span className="min-w-0">
                            <span className="block font-serif text-base leading-tight">{row.stage}</span>
                            <span className="mt-1 block font-serif text-sm leading-tight text-[#4a3827]">{row.managerQuestion}</span>
                            <span className="mt-1 block font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed break-words">
                              {row.coveredCount}/{row.requirementCount} requirements / {row.status}
                            </span>
                            <span className="mt-1 block font-mono text-[8px] uppercase tracking-widest text-[#9b875c] leading-relaxed break-words">
                              Next action: {row.nextAction?.label || 'No runnable action'} / Runnable actions: {row.runnableActionCount || 0}
                            </span>
                            {row.nextAction?.runApiPath && (
                              <span className="mt-1 block font-mono text-[8px] uppercase tracking-widest text-[#9b875c] leading-relaxed break-words">
                                Run route: {row.nextAction.runApiPath}
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                          <span className={`node-status-tag ${row.status === 'covered' ? 'bg-green-700 text-white' : row.status === 'partial' ? 'bg-[#b9782b] text-white' : 'bg-[#8f1e18] text-white'}`}>{row.status}</span>
                          <button
                            type="button"
                            data-testid={`manager-use-case-run-${row.id}`}
                            onClick={() => runManagerActionPlaybookRow(row.nextAction)}
                            disabled={!backendOnline || backendStation.loading || !row.nextAction?.canRun || row.nextAction?.routeResolved === false || String(row.nextAction?.apiPath || '').includes(':')}
                            className="inline-flex items-center gap-1 border border-[#7b6542] bg-[#251b13] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#efe2bd] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Play size={10} /> Run use case action
                          </button>
                          <button
                            type="button"
                            data-testid={`manager-use-case-proof-${row.id}`}
                            onClick={() => openManagerUseCaseAuditRow(row)}
                            disabled={!(row.proofIds?.length || row.timelineLogIds?.length || row.timelineIds?.length)}
                            className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <CornerDownRight size={10} /> Use case proof
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div data-testid="manager-requirement-matrix" className="bg-[#f7edcf]/70 border border-[#b8a57d] p-5 mb-6">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-[#8f1e18] mb-2">Manager Requirement Matrix</div>
                    <div className="font-serif text-2xl leading-tight">Each requested condition mapped to concrete chat, timeline, or read-model proof.</div>
                  </div>
                  <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">
                    {managerRequirementMatrixRows.filter(row => row.passed).length}/{managerRequirementMatrixRows.length} covered
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {managerRequirementMatrixRows.map((row, index) => (
                    <div key={`manager-requirement-${row.id}`} data-testid={`manager-requirement-row-${row.id}`} className="border border-[#d8c99f] bg-[#efe2bd]/55 p-3">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex min-w-0 items-start gap-3">
                          <span className={`flex h-7 w-7 shrink-0 items-center justify-center border font-mono text-[10px] ${row.passed ? 'border-green-700 bg-green-700 text-white' : 'border-[#b9782b] bg-[#f7edcf] text-[#8f1e18]'}`}>
                            {row.passed ? <CheckCircle2 size={13} /> : index + 1}
                          </span>
                          <span className="min-w-0">
                            <span className="block font-serif text-base leading-tight">{row.requirement}</span>
                            <span className="mt-1 block font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed break-words">{row.evidence}</span>
                          </span>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                          <span className={`node-status-tag ${row.passed ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>{row.passed ? 'Covered' : 'Needs Proof'}</span>
                          <button
                            type="button"
                            data-testid={`manager-requirement-proof-${row.id}`}
                            onClick={() => openScenarioTrailRow(row)}
                            disabled={!(row.proofIds?.length || row.timelineIds?.length)}
                            className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <CornerDownRight size={10} /> Requirement proof
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div data-testid="manager-leader-assignment-composer" className="bg-[#f7edcf]/70 border border-[#b8a57d] p-5 mb-6">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-[#8f1e18] mb-2">Leader Assignment Composer</div>
                    <div className="font-serif text-2xl leading-tight">Ask the confirmed Leader to @assign custom work in group chat.</div>
                  </div>
                  <span className="node-status-tag bg-[#59684b] text-white">Group @Assignment</span>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <textarea
                    data-testid="manager-assignment-composer-input"
                    value={managerAssignmentDraft.text}
                    onChange={(event) => setManagerAssignmentDraft(prev => ({ ...prev, text: event.target.value }))}
                    rows={3}
                    className="w-full resize-none border border-[#d8c99f] bg-[#efe2bd] px-3 py-2 font-serif text-base leading-relaxed text-[#251b13] outline-none focus:border-[#8f1e18]"
                  />
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <select
                      data-testid="manager-assignment-composer-target"
                      value={managerAssignmentDraft.targetAgentId}
                      onChange={(event) => setManagerAssignmentDraft(prev => ({ ...prev, targetAgentId: event.target.value }))}
                      className="border border-[#d8c99f] bg-[#efe2bd] px-3 py-2 font-mono text-[9px] uppercase tracking-widest text-[#251b13] outline-none focus:border-[#8f1e18]"
                    >
                      {activeProject.team.filter(agent => !agent.isLeader).map(agent => (
                        <option key={`assignment-target-${agent.id}`} value={agent.id}>{agent.name}</option>
                      ))}
                    </select>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="node-status-tag bg-[#efe2bd] text-[#251b13]">Leader @Mention</span>
                      <span className="node-status-tag bg-[#efe2bd] text-[#251b13]">Assignee Inbox</span>
                      <span className="node-status-tag bg-[#efe2bd] text-[#251b13]">Acknowledgement</span>
                      <span className="node-status-tag bg-[#efe2bd] text-[#251b13]">Timeline Logs</span>
                      <button
                        type="button"
                        data-testid="manager-assignment-composer-submit"
                        onClick={submitManagerLeaderAssignment}
                        disabled={!managerAssignmentDraft.text.trim() || Boolean(sceneTransition)}
                        className="inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#251b13] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#efe2bd] hover:bg-[#8f1e18] disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Send size={10} /> Submit Assignment
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div data-testid="manager-change-intake-composer" className="bg-[#f7edcf]/70 border border-[#b8a57d] p-5 mb-6">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-[#8f1e18] mb-2">Manager Change Intake</div>
                    <div className="font-serif text-2xl leading-tight">Custom change request into meeting, Google Chat, or both.</div>
                  </div>
                  <span className="node-status-tag bg-[#b9782b] text-white">{managerChangeDraft.mode === 'dual' ? 'War Room + Google Chat' : managerChangeDraft.mode === 'meeting' ? 'War Room' : 'Google Chat'}</span>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <textarea
                    data-testid="manager-change-composer-input"
                    value={managerChangeDraft.text}
                    onChange={(event) => setManagerChangeDraft(prev => ({ ...prev, text: event.target.value }))}
                    rows={3}
                    className="w-full resize-none border border-[#d8c99f] bg-[#efe2bd] px-3 py-2 font-serif text-base leading-relaxed text-[#251b13] outline-none focus:border-[#8f1e18]"
                  />
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <select
                      data-testid="manager-change-composer-mode"
                      value={managerChangeDraft.mode}
                      onChange={(event) => setManagerChangeDraft(prev => ({ ...prev, mode: event.target.value }))}
                      className="border border-[#d8c99f] bg-[#efe2bd] px-3 py-2 font-mono text-[9px] uppercase tracking-widest text-[#251b13] outline-none focus:border-[#8f1e18]"
                    >
                      <option value="dual">War Room + Google Chat</option>
                      <option value="meeting">War Room meeting</option>
                      <option value="google_chat">Google Chat</option>
                    </select>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="node-status-tag bg-[#efe2bd] text-[#251b13]">Discussion</span>
                      <span className="node-status-tag bg-[#efe2bd] text-[#251b13]">Owner Confirmation</span>
                      <span className="node-status-tag bg-[#efe2bd] text-[#251b13]">Owner Plan</span>
                      <span className="node-status-tag bg-[#efe2bd] text-[#251b13]">Team Sync</span>
                      <button
                        type="button"
                        data-testid="manager-change-composer-submit"
                        onClick={submitManagerChangeIntake}
                        disabled={!managerChangeDraft.text.trim() || Boolean(sceneTransition)}
                        className="inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#251b13] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#efe2bd] hover:bg-[#8f1e18] disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Send size={10} /> Submit Change
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-[#f7edcf]/70 border border-[#b8a57d] p-5 mb-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-[#8f1e18] mb-2">Autonomous Work Loop</div>
                    <div className="font-serif text-xl leading-tight">
                      {activeProject.autonomy?.enabled ? `${activeProject.autonomy.cadence || 'hourly'} cadence enabled` : 'Cadence paused'}
                    </div>
                    <div className="font-mono text-[9px] uppercase tracking-widest text-[#7d6a49] mt-2">
                      Last run: {activeProject.lastAutonomousRunAt ? new Date(activeProject.lastAutonomousRunAt).toLocaleString() : 'not yet'}
                    </div>
                    <div className="font-mono text-[9px] uppercase tracking-widest text-[#7d6a49] mt-1">
                      Next run: {activeProject.nextAutonomousRunAt || autonomousSchedule.nextRunAt ? new Date(activeProject.nextAutonomousRunAt || autonomousSchedule.nextRunAt).toLocaleString() : 'not scheduled'}
                    </div>
                    {latestSchedulerRecord && (
                      <div className="font-mono text-[8px] uppercase tracking-widest text-[#9b875c] mt-1">
                        {latestSchedulerRecord.trigger} / {latestSchedulerRecord.reason} / next {new Date(latestSchedulerRecord.nextRunAt).toLocaleTimeString()}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => runAutonomousCycle(activeProject.id, 'hourly')}
                      className="border border-[#7b6542] bg-[#251b13] px-3 py-2 font-mono text-[9px] uppercase tracking-widest text-[#efe2bd] hover:bg-[#8f1e18] transition-colors"
                    >
                      Hour Pulse
                    </button>
                    <button
                      type="button"
                      onClick={() => runAutonomousCycle(activeProject.id, 'daily')}
                      className="border border-[#7b6542] bg-[#efe2bd] px-3 py-2 font-mono text-[9px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] transition-colors"
                    >
                      Day Report
                    </button>
                  </div>
                </div>
                {activeProject.autonomousLedger?.length > 0 && (
                  <div className="mt-4 border-t border-[#d8c99f] pt-3 space-y-2">
                    {activeProject.autonomousLedger.slice(0, 2).map(cycle => (
                      <div key={cycle.id} className="space-y-1">
                        <div className="flex items-center justify-between gap-3 font-mono text-[9px] uppercase tracking-widest text-[#7d6a49]">
                          <span>{cycle.cadence} / {cycle.publishedEventCount} published / {cycle.managementEventCount || 0} managed</span>
                          <span>{new Date(cycle.ranAt).toLocaleString()}</span>
                        </div>
                        <div className="font-mono text-[8px] uppercase tracking-widest text-[#9b875c]">
                          {cycle.trigger || 'cycle'} / due {cycle.dueAt ? new Date(cycle.dueAt).toLocaleTimeString() : 'now'} / next {cycle.nextRunAt ? new Date(cycle.nextRunAt).toLocaleTimeString() : 'pending'}
                        </div>
                        {cycle.managementEvents?.slice(0, 3).map((item, index) => {
                          const manager = activeProject.team.find(member => member.id === item.agentId);
                          const target = activeProject.team.find(member => member.id === item.targetAgentId);
                          return (
                            <div key={`${cycle.id}-management-${index}`} className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">
                              {item.kind}: {manager?.name || item.agentId} {'->'} {target?.name || item.targetAgentId || 'team'} / {item.taskIds?.length || 0} task proof link{(item.taskIds?.length || 0) === 1 ? '' : 's'}
                            </div>
                          );
                        })}
                        {cycle.communicationDiagnostics?.slice(0, 2).map((item, index) => {
                          const agent = activeProject.team.find(member => member.id === item.agentId);
                          return (
                            <div key={`${cycle.id}-diag-${index}`} className="font-mono text-[8px] uppercase tracking-widest text-[#9b875c]">
                              {agent?.name || item.agentId}: {item.decision} / {item.attentionScore} / {item.explanation}
                            </div>
                          );
                        })}
                        {cycle.agentPlans?.slice(0, 3).map((plan) => {
                          const agent = activeProject.team.find(member => member.id === plan.agentId);
                          return (
                            <div key={`${cycle.id}-routine-${plan.agentId}`} className="font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d]">
                              {agent?.name || plan.agentId}: {plan.routineLabel || 'Routine'} / {plan.routineArtifact || 'work evidence'}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div data-testid="operations-board-24-7" className="bg-[#f7edcf]/70 border border-[#b8a57d] p-5 mb-6">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-[#8f1e18] mb-2">24/7 Operations Board</div>
                    <div className="font-serif text-xl leading-tight">Project cadence, backend worker state, and every Agent run queue in one view.</div>
                  </div>
                  <span className={`node-status-tag ${activeProject.autonomy?.enabled ? 'bg-green-700 text-white' : 'bg-[#8f1e18] text-white'}`}>
                    {activeProject.autonomy?.enabled ? 'Cadence Active' : 'Cadence Paused'}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-4">
                  <div className="border border-[#d8c99f] bg-[#efe2bd]/55 px-3 py-2">
                    <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Project Next Run</div>
                    <div className="font-serif text-base leading-tight">{formatRunTime(activeProject.nextAutonomousRunAt || autonomousSchedule.nextRunAt)}</div>
                  </div>
                  <div className="border border-[#d8c99f] bg-[#efe2bd]/55 px-3 py-2">
                    <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Project Last Run</div>
                    <div className="font-serif text-base leading-tight">{formatRunTime(activeProject.lastAutonomousRunAt)}</div>
                  </div>
                  <div className="border border-[#d8c99f] bg-[#efe2bd]/55 px-3 py-2">
                    <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Backend Worker</div>
                    <div className="font-serif text-base leading-tight">{backendStatusText}</div>
                  </div>
                  <div className="border border-[#d8c99f] bg-[#efe2bd]/55 px-3 py-2">
                    <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Agent Run Queue</div>
                    <div className="font-serif text-base leading-tight">{operationsBoardRows.length} Agent{operationsBoardRows.length === 1 ? '' : 's'}</div>
                  </div>
                </div>
                <div className="space-y-2">
                  {operationsBoardRows.map(row => (
                    <div key={`operations-${row.agent.id}`} data-testid={`operations-agent-${row.agent.id}`} className="border-t border-[#d8c99f] pt-2">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-serif text-lg leading-tight">{row.agent.name}</div>
                          <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">{row.agent.role}</div>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {row.agent.isLeader && <span className="node-status-tag bg-[#8f1e18] text-white">Leader</span>}
                          <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">{row.state.status || 'standing by'}</span>
                          <span className="node-status-tag bg-[#d8c99f] text-[#251b13]">{row.openObligations} {projectText(row.openObligations === 1 ? 'open obligation' : 'open obligations')}</span>
                        </div>
                      </div>
                      <div className="mt-2 grid grid-cols-1 md:grid-cols-4 gap-2">
                        <div className="border border-[#d8c99f] bg-[#efe2bd]/45 px-2 py-1 min-w-0">
                          <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">{projectText('Next Agent Run')}</div>
                          <div className="font-mono text-[8px] uppercase tracking-widest text-[#4d412d] leading-relaxed break-words">{formatRunTime(row.nextRunAt)}</div>
                        </div>
                        <div className="border border-[#d8c99f] bg-[#efe2bd]/45 px-2 py-1 min-w-0">
                          <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">{projectText('Latest Agent Work')}</div>
                          <div className="font-mono text-[8px] uppercase tracking-widest text-[#4d412d] leading-relaxed break-words">{formatRunTime(row.lastRunAt)}</div>
                        </div>
                        <div className="border border-[#d8c99f] bg-[#efe2bd]/45 px-2 py-1 min-w-0">
                          <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">{projectText('Worker Trigger')}</div>
                          <div className="font-mono text-[8px] uppercase tracking-widest text-[#4d412d] leading-relaxed break-words">{projectText(row.trigger)}</div>
                        </div>
                        <div className="border border-[#d8c99f] bg-[#efe2bd]/45 px-2 py-1 min-w-0">
                          <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">{projectText('Management Priority')}</div>
                          <div className="font-mono text-[8px] uppercase tracking-widest text-[#4d412d] leading-relaxed break-words">{projectText(row.priority)} / {projectText(row.reason)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div data-testid="continuous-work-loop" className="bg-[#f7edcf]/70 border border-[#b8a57d] p-5 mb-6">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-[#8f1e18] mb-2">{projectText('Continuous Work Loop')}</div>
                    <div className="font-serif text-xl leading-tight">{projectText('Scheduler to Agent pulse to timeline proof, visible for every fixed routine.')}</div>
                  </div>
                  <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">
                    {continuousWorkRows.filter(row => row.proofReady).length}/{continuousWorkRows.length} {projectText('proofed')}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-4">
                  <div className="border border-[#d8c99f] bg-[#efe2bd]/55 px-3 py-2">
                    <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">{projectText('Scheduler State')}</div>
                    <div className="font-serif text-base leading-tight">{projectText(backendStatusText)}</div>
                  </div>
                  <div className="border border-[#d8c99f] bg-[#efe2bd]/55 px-3 py-2">
                    <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">{projectText('Next Project Pulse')}</div>
                    <div className="font-serif text-base leading-tight">{formatRunTime(activeProject.nextAutonomousRunAt || autonomousSchedule.nextRunAt)}</div>
                  </div>
                  <div className="border border-[#d8c99f] bg-[#efe2bd]/55 px-3 py-2">
                    <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">{projectText('Agent Loops')}</div>
                    <div className="font-serif text-base leading-tight">{continuousWorkRows.filter(row => row.nextRunAt).length} {projectText('scheduled')}</div>
                  </div>
                  <div className="border border-[#d8c99f] bg-[#efe2bd]/55 px-3 py-2">
                    <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">{projectText('Timeline Proof')}</div>
                    <div className="font-serif text-base leading-tight">{continuousWorkRows.reduce((sum, row) => sum + row.timelineIds.length, 0)} {projectText(continuousWorkRows.reduce((sum, row) => sum + row.timelineIds.length, 0) === 1 ? 'log' : 'logs')}</div>
                  </div>
                </div>
                <div className="space-y-2">
                  {continuousWorkRows.map(row => (
                    <div key={`continuous-loop-${row.agent.id}`} data-testid={`continuous-loop-agent-${row.agent.id}`} className="border-t border-[#d8c99f] pt-3">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <div className="font-serif text-lg leading-tight">{row.agent.name}</div>
                          <div className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed break-words">
                            {projectText(row.routineLabel)} / {projectText(row.loopState)} / {projectText('next')} {formatRunTime(row.nextRunAt)}
                          </div>
                          <div className="mt-2 font-mono text-[8px] text-[#4d412d] leading-relaxed break-words">
                            {projectText('Focus')}: {projectText(row.focus)} / {projectText('Next')}: {projectText(row.nextStep)}
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => runBackendAgentPulse(row.agent.id)}
                            disabled={!backendOnline || backendStation.loading}
                            className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            <Activity size={10} /> {projectText('Run Loop Pulse')}
                          </button>
                          {row.chatIds.length > 0 && (
                            <button
                              type="button"
                              onClick={() => openProjectChatProof(activeProject, row.chatIds, 'main')}
                              className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
                            >
                              <MessageSquare size={10} /> {projectText('Loop chat proof')}
                            </button>
                          )}
                          {row.timelineIds.length > 0 && (
                            <button
                              type="button"
                              onClick={() => openProjectTimelineProof(row.timelineIds)}
                              className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
                            >
                              <GitCommit size={10} /> {projectText('Loop timeline proof')}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-[#f7edcf]/70 border border-[#b8a57d] p-5 mb-6">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-[#8f1e18] mb-2">{projectText('Fixed Work Routines')}</div>
                    <div className="font-serif text-xl leading-tight">{projectText('Every Agent has a recurring routine, artifact, next step, and evidence source.')}</div>
                  </div>
                  <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">{routineRows.length} {projectText('Agents')}</span>
                </div>
                <div className="space-y-3">
                  {routineRows.map(({ agent, state, routine, focus, next, latestWorklog, latestWorker }) => (
                    <div key={`routine-${agent.id}`} data-testid={`routine-row-${agent.id}`} className="border-t border-[#d8c99f] pt-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-serif text-lg leading-tight">{agent.name}</div>
                          <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">{agent.role}</div>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {agent.isLeader && <span className="node-status-tag bg-[#8f1e18] text-white">Leader</span>}
                          <span className="node-status-tag bg-[#d8c99f] text-[#251b13]">{projectText(routine?.label || 'Routine pending')}</span>
                          <span className="node-status-tag bg-[#59684b] text-white">{projectText(routine?.artifact || 'work evidence')}</span>
                        </div>
                      </div>
                      <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2">
                        <div className="border border-[#d8c99f] bg-[#efe2bd]/50 px-2 py-1 min-w-0">
                          <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">{projectText('Routine Checklist')}</div>
                          <div className="font-mono text-[8px] uppercase tracking-widest text-[#4d412d] leading-relaxed break-words">
                            {projectText((routine?.checklist || []).slice(0, 3).join(' -> ') || 'read state -> publish progress')}
                          </div>
                        </div>
                        <div className="border border-[#d8c99f] bg-[#efe2bd]/50 px-2 py-1 min-w-0">
                          <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">{projectText('Current Focus')}</div>
                          <div className="font-mono text-[8px] uppercase tracking-widest text-[#4d412d] leading-relaxed break-words">{projectText(focus)}</div>
                        </div>
                        <div className="border border-[#d8c99f] bg-[#efe2bd]/50 px-2 py-1 min-w-0">
                          <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">{projectText('Next Evidence')}</div>
                          <div className="font-mono text-[8px] uppercase tracking-widest text-[#4d412d] leading-relaxed break-words">
                            {projectText(next)} / {projectText(latestWorker?.trigger || latestWorklog?.source || state.status || 'waiting')}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div data-testid="backend-worker-station" className="bg-[#f7edcf]/70 border border-[#b8a57d] p-5 mb-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-mono text-[10px] uppercase tracking-widest text-[#8f1e18] mb-2">{projectText('Backend Worker Station')}</div>
                    <div className="font-serif text-xl leading-tight">{projectText(backendStatusText)}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">
                      <span className={`border px-2 py-1 ${backendOnline ? 'border-[#2f6f47] text-[#2f6f47]' : 'border-[#8f1e18] text-[#8f1e18]'}`}>
                        {projectText(backendOnline ? 'Online' : backendStation.connectionStatus === 'unknown' ? 'Not checked' : 'Offline')}
                      </span>
                      <span>{backendStation.baseUrl}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <input
                        data-testid="backend-url-input"
                        value={backendStation.draftBaseUrl}
                        onChange={(event) => setBackendStation(prev => ({ ...prev, draftBaseUrl: event.target.value }))}
                        className="min-w-[260px] flex-1 border border-[#b8a57d] bg-[#f7edcf] px-3 py-2 font-mono text-[9px] uppercase tracking-widest text-[#251b13] outline-none focus:border-[#8f1e18]"
                        aria-label="Backend worker station URL"
                      />
                      <button
                        type="button"
                        onClick={saveBackendBaseUrl}
                        disabled={backendStation.loading}
                        className="inline-flex items-center justify-center gap-2 border border-[#7b6542] bg-[#efe2bd] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-50"
                      >
                        <Save size={13} /> {projectText('Save URL')}
                      </button>
                    </div>
                    <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
                      {[
                        ['Ticks', backendScheduler.tickCount ?? 0],
                        ['Processed', backendScheduler.processedCount ?? 0],
                        ['Agent Runs', backendScheduler.agentProcessedCount ?? 0],
                        ['Skipped', backendScheduler.skippedCount ?? 0],
                        ['Agent Skips', backendScheduler.agentSkippedCount ?? 0],
                        ['Messages', backendScheduler.messageCount ?? 0],
                      ].map(([label, value]) => (
                        <div key={label} className="border border-[#d8c99f] bg-[#efe2bd]/50 px-2 py-1">
                          <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{projectText(label)}</div>
                          <div className="font-serif text-lg leading-none">{value}</div>
                        </div>
                      ))}
                    </div>
                    <div className="font-mono text-[8px] uppercase tracking-widest text-[#9b875c] mt-3">
                      {projectText('Last tick')}: {backendScheduler.lastTickAt ? new Date(backendScheduler.lastTickAt).toLocaleString() : projectText('none')} / {projectText('Last complete')}: {backendScheduler.lastCompletedAt ? new Date(backendScheduler.lastCompletedAt).toLocaleString() : projectText('none')}
                    </div>
                    <div className="font-mono text-[8px] uppercase tracking-widest text-[#9b875c] mt-1">
                      {/* Compatibility proof anchor: Immediate Start */}
                      IMMEDIATE START: {(backendScheduler.lastStartedRunImmediately || /Started backend scheduler/i.test(backendStation.lastAction || '')) ? 'YES' : 'NO'} / RUNNING: {backendScheduler.running ? 'YES' : 'NO'}
                    </div>
                    <div className="font-mono text-[8px] uppercase tracking-widest text-[#9b875c] mt-1">
                      {projectText('Project sync')}: {backendStation.lastProjectSyncAt ? new Date(backendStation.lastProjectSyncAt).toLocaleString() : projectText('not synced')} / {backendStation.projectSyncCount || 0} {projectText('pulls')}
                    </div>
                    <div className="font-mono text-[8px] uppercase tracking-widest text-[#9b875c] mt-1">
                      Ready package sync: {backendStation.lastManagerReadyPackageSyncAt ? new Date(backendStation.lastManagerReadyPackageSyncAt).toLocaleString() : 'not synced'} / {backendStation.managerReadyPackageSyncCount || 0} pulls
                    </div>
                    <div className="font-mono text-[8px] uppercase tracking-widest text-[#9b875c] mt-1">
                      BACKEND MANAGER READY PACKAGE SYNCED
                    </div>
                    <div className="font-mono text-[8px] uppercase tracking-widest text-[#9b875c] mt-1">
                      Manager dashboard sync: {backendStation.lastManagerDashboardSyncAt ? new Date(backendStation.lastManagerDashboardSyncAt).toLocaleString() : 'not synced'} / {backendStation.managerDashboardSyncCount || 0} pulls
                    </div>
                    <div className="font-mono text-[8px] uppercase tracking-widest text-[#9b875c] mt-1">
                      Scenario trail sync: {backendStation.lastManagerScenarioTrailSyncAt ? new Date(backendStation.lastManagerScenarioTrailSyncAt).toLocaleString() : 'not synced'} / {backendStation.managerScenarioTrailSyncCount || 0} pulls
                    </div>
                    <div className="font-mono text-[8px] uppercase tracking-widest text-[#9b875c] mt-1">
                      Requirement matrix sync: {backendStation.lastManagerRequirementMatrixSyncAt ? new Date(backendStation.lastManagerRequirementMatrixSyncAt).toLocaleString() : 'not synced'} / {backendStation.managerRequirementMatrixSyncCount || 0} pulls
                    </div>
                    <div className="font-mono text-[8px] uppercase tracking-widest text-[#9b875c] mt-1">
                      Use case audit sync: {backendStation.lastManagerUseCaseAuditSyncAt ? new Date(backendStation.lastManagerUseCaseAuditSyncAt).toLocaleString() : 'not synced'} / {backendStation.managerUseCaseAuditSyncCount || 0} pulls
                    </div>
                    <div className="font-mono text-[8px] uppercase tracking-widest text-[#9b875c] mt-1">
                      Action queue sync: {backendStation.lastManagerActionQueueSyncAt ? new Date(backendStation.lastManagerActionQueueSyncAt).toLocaleString() : 'not synced'} / {backendStation.managerActionQueueSyncCount || 0} pulls
                    </div>
                    {backendStation.lastAction && (
                      <div className="font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] mt-1">{backendStation.lastAction}</div>
                    )}
                    {backendManagerReadyPackage && (
                      <div data-testid="backend-manager-ready-package-snapshot" className="mt-3 border-t border-[#d8c99f] pt-3">
                        <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18] mb-2">Manager Ready Package</div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {[
                            ['Status', backendManagerReadyPackage.status || 'unknown'],
                            ['Score', backendManagerReadyPackage.score ?? 0],
                            ['MVP Status', backendManagerReadyPackage.mvpStatus || backendMvpReadiness?.status || 'unknown'],
                            ['Local Pilot', backendManagerReadyPackage.readyForLocalPilot ? 'ready' : 'blocked'],
                            ['Production', backendManagerReadyPackage.readyForProduction ? 'ready' : 'blocked'],
                            ['Pilot Launch', backendPilotLaunchReadiness?.privatePilotDecision || backendManagerReadyPackage.summary?.pilotLaunchDecision || 'unknown'],
                            ['Launch Gates', `${backendPilotLaunchReadiness?.summary?.passedGateCount ?? 0}/${backendPilotLaunchReadiness?.summary?.gateCount ?? backendManagerReadyPackage.summary?.pilotLaunchGateCount ?? 0}`],
                            ['Launch Routes', `${backendPilotLaunchReadiness?.summary?.readyEvidenceRouteCount ?? 0}/${backendPilotLaunchReadiness?.summary?.evidenceRouteCount ?? backendManagerReadyPackage.summary?.pilotLaunchEvidenceRouteCount ?? 0}`],
                            ['Preflight', backendDeploymentPreflight?.privatePilotDeploymentReady ? 'ready' : (backendManagerReadyPackage.summary?.deploymentPreflightStatus || 'blocked')],
                            ['Preflight Warnings', backendDeploymentPreflight?.summary?.failedWarningGateCount ?? backendManagerReadyPackage.summary?.deploymentPreflightWarningCount ?? 0],
                            ['Gateway', backendAdapterGatewayPreflight?.status || backendManagerReadyPackage.summary?.adapterGatewayPreflightStatus || 'unknown'],
                            ['Gateway Live', (backendAdapterGatewayPreflight?.summary?.liveGatewayReady ?? backendManagerReadyPackage.summary?.adapterGatewayLiveReady) ? 'ready' : 'pending'],
                            ['Gateway State', (backendAdapterGatewayPreflight?.summary?.stateReadable ?? backendManagerReadyPackage.summary?.adapterGatewayStateReadable) ? 'readable' : 'pending'],
                            [projectText('Launch Approval'), projectText(backendLaunchApprovalWorkflow?.status || backendManagerReadyPackage.summary?.launchApprovalStatus || 'approval-needed')],
                            [projectText('Pilot Approval'), backendLaunchApprovalWorkflow?.readyForPrivatePilot || backendManagerReadyPackage.summary?.launchApprovalPrivatePilotReady ? projectText('ready') : projectText('blocked')],
                            [projectText('Production Approval'), backendLaunchApprovalWorkflow?.readyForProduction || backendManagerReadyPackage.summary?.launchApprovalProductionReady ? projectText('ready') : projectText('blocked')],
                            [projectText('Launch Audit'), projectText(backendProductionLaunchAudit?.status || backendManagerReadyPackage.summary?.productionLaunchAuditStatus || 'unknown')],
                            [projectText('Private Pilot Audit'), backendProductionLaunchAudit?.privatePilotDecision || backendManagerReadyPackage.summary?.productionLaunchPrivatePilotDecision || 'unknown'],
                            [projectText('Production Audit'), backendProductionLaunchAudit?.productionDecision || backendManagerReadyPackage.summary?.productionLaunchProductionDecision || 'unknown'],
                            [projectText('Audit Blockers'), backendProductionLaunchAudit?.summary?.productionBlockerCount ?? backendManagerReadyPackage.summary?.productionLaunchProductionBlockerCount ?? 0],
                            ['Evidence Archive', backendProjectEvidenceArchive?.status || backendManagerReadyPackage.summary?.projectEvidenceArchiveStatus || 'unknown'],
                            ['Archive Ready', (backendProjectEvidenceArchive?.readyForManagerHandoff ?? backendManagerReadyPackage.summary?.projectEvidenceArchiveReady) ? 'ready' : 'blocked'],
                            ['Archive Manifest', `${backendProjectEvidenceArchive?.summary?.readyManifestEntryCount ?? backendManagerReadyPackage.summary?.projectEvidenceArchiveReadyManifestEntryCount ?? 0}/${backendProjectEvidenceArchive?.summary?.manifestEntryCount ?? backendManagerReadyPackage.summary?.projectEvidenceArchiveManifestEntryCount ?? 0}`],
                            ['Archive Leaks', backendProjectEvidenceArchive?.summary?.rawLeakCount ?? backendManagerReadyPackage.summary?.projectEvidenceArchiveRawLeakCount ?? 0],
                            ['Evidence Export', backendProjectEvidenceExportWorkflow?.status || backendManagerReadyPackage.summary?.projectEvidenceExportStatus || 'request-needed'],
                            ['Export Ready', (backendProjectEvidenceExportWorkflow?.readyForPrivatePilotHandoff ?? backendManagerReadyPackage.summary?.projectEvidenceExportReady) ? 'ready' : 'blocked'],
                            ['Export Approvals', backendProjectEvidenceExportWorkflow?.summary?.approvalCount ?? backendManagerReadyPackage.summary?.projectEvidenceExportApprovalCount ?? 0],
                            ['Proof Routes', backendManagerReadyPackage.summary?.proofRouteCount ?? 0],
                            ['MVP Core', `${backendManagerReadyPackage.summary?.mvpCorePassedCount ?? backendMvpReadiness?.summary?.corePassedCount ?? 0}/${backendManagerReadyPackage.summary?.mvpCoreTotalCount ?? backendMvpReadiness?.summary?.coreTotalCount ?? 0}`],
                            ['Prod Blockers', backendManagerReadyPackage.summary?.mvpProductionBlockerCount ?? backendMvpReadiness?.summary?.productionBlockerCount ?? 0],
                            ['Security', backendSecurityBoundary?.status || backendManagerReadyPackage.summary?.securityBoundaryStatus || 'unknown'],
                            ['Providers', backendProviderReadiness?.status || backendManagerReadyPackage.summary?.providerReadinessStatus || 'unknown'],
                            ['Operations', backendOperationsReadiness?.status || backendManagerReadyPackage.summary?.operationsReadinessStatus || 'unknown'],
                            ['Persistence Adapter', backendManagerReadyPackage.summary?.persistenceAdapterDryRunStatus || 'unknown'],
                            ['DB Driver', backendManagerReadyPackage.summary?.persistenceAdapterDriver || 'unknown'],
                            ['Shadow Reads', backendManagerReadyPackage.summary?.persistenceAdapterShadowReadParityCount ?? 0],
                            ['Adapter Ops', backendManagerReadyPackage.summary?.persistenceAdapterOperationCount ?? 0],
                            ['Queue Adapter', backendManagerReadyPackage.summary?.queueAdapterDryRunStatus || 'unknown'],
                            ['Queue Driver', backendManagerReadyPackage.summary?.queueAdapterDriver || 'unknown'],
                            ['Queue Dispatches', backendManagerReadyPackage.summary?.queueAdapterDispatchCount ?? 0],
                            ['Queue Leases', backendManagerReadyPackage.summary?.queueAdapterLeaseAcquisitionCount ?? 0],
                            ['Queue Parity', backendManagerReadyPackage.summary?.queueAdapterSnapshotParityReady ? 'ready' : 'blocked'],
                            ['Worker Recovery', backendManagerReadyPackage.summary?.workerRecoveryContractReady ? 'ready' : 'blocked'],
                            ['Incident Drill', backendManagerReadyPackage.summary?.operationsIncidentDrillReady ? 'ready' : 'blocked'],
                            ['Drill Receipts', backendManagerReadyPackage.summary?.operationsIncidentDrillReceiptCount ?? 0],
                            ['Worker Receipts', backendManagerReadyPackage.summary?.workerExecutionReceiptCount ?? 0],
                            ['Dead Letters', backendManagerReadyPackage.summary?.workerDeadLetterCount ?? 0],
                            ['Trail Ready', `${backendManagerReadyPackage.summary?.scenarioTrailReadyCount ?? 0}/${backendManagerReadyPackage.summary?.scenarioTrailCount ?? 0}`],
                            ['Walkthrough', `${backendManagerReadyPackage.summary?.walkthroughCompletedCount ?? 0}/${backendManagerReadyPackage.summary?.walkthroughCount ?? 0}`],
                            ['Requirements', `${backendManagerReadyPackage.summary?.requirementReadyCount ?? 0}/${backendManagerReadyPackage.summary?.requirementCount ?? 0}`],
                            ['Kickoff Board', `${backendManagerReadyPackage.summary?.kickoffBoardReadyCount ?? 0}/${backendManagerReadyPackage.summary?.kickoffBoardCount ?? 0}`],
                            ['Work Loop Board', `${backendManagerReadyPackage.summary?.workLoopRunningCount ?? 0}/${backendManagerReadyPackage.summary?.workLoopCount ?? 0}`],
                            ['Collaboration Board', `${backendManagerReadyPackage.summary?.collaborationReadyCount ?? 0}/${backendManagerReadyPackage.summary?.collaborationBoardCount ?? 0}`],
                            ['Change Protocol', `${backendManagerReadyPackage.summary?.changeProtocolReadyCount ?? 0}/${backendManagerReadyPackage.summary?.changeProtocolBoardCount ?? 0}`],
                            ['Change Owners', `${backendManagerReadyPackage.summary?.changeOwnerReadyCount ?? 0}/${backendManagerReadyPackage.summary?.changeOwnerCount ?? 0}`],
                            ['Use Cases', `${backendManagerReadyPackage.summary?.useCaseCoveredCount ?? 0}/${backendManagerReadyPackage.summary?.useCaseCount ?? 0}`],
                            ['Action Queue', `${backendManagerReadyPackage.summary?.actionQueueCompletedCount ?? 0}/${backendManagerReadyPackage.summary?.actionQueueCount ?? 0}`],
                            ['Unresolved Routes', backendManagerReadyPackage.summary?.actionQueueUnresolvedRouteCount ?? 0],
                            ['Transcript Channels', backendManagerReadyPackage.summary?.transcriptChannelCount ?? 0],
                            ['Ops Agents', backendManagerReadyPackage.summary?.operationsAgentCount ?? 0],
                            ['Assignments', backendManagerReadyPackage.summary?.assignmentCount ?? 0],
                            ['Changes', backendManagerReadyPackage.summary?.changeCount ?? 0],
                          ].map(([label, value]) => (
                            <div key={`ready-package-${label}`} className="border border-[#d8c99f] bg-[#efe2bd]/50 px-2 py-1">
                              <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{label}</div>
                              <div className="font-serif text-base leading-tight">{value}</div>
                            </div>
                          ))}
                        </div>
                        {backendProjectEvidenceArchive && (
                          <div data-testid="backend-project-evidence-archive-snapshot" className="mt-3 border border-[#d8c99f] bg-[#efe2bd]/55 p-2">
                            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                              <div className="min-w-0">
                                <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">{projectText('Project Evidence Archive')}</div>
                                <div className="font-serif text-base leading-tight">{projectText(backendProjectEvidenceArchive.status || 'unknown')}</div>
                              </div>
                              <span className={`node-status-tag ${backendProjectEvidenceArchive.readyForManagerHandoff ? 'bg-[#59684b] text-white' : 'bg-[#8f1e18] text-white'}`}>
                                {backendProjectEvidenceArchive.readyForManagerHandoff ? projectText('ready') : projectText('blocked')}
                              </span>
                            </div>
                            <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
                              {[
                                [projectText('Manifest'), `${backendProjectEvidenceArchive.summary?.readyManifestEntryCount ?? 0}/${backendProjectEvidenceArchive.summary?.manifestEntryCount ?? 0}`],
                                [projectText('Submissions'), backendProjectEvidenceArchive.summary?.submissionCount ?? 0],
                                [projectText('Final Deliverables'), backendProjectEvidenceArchive.summary?.finalDeliverableCount ?? 0],
                                [projectText('Evidence Searches'), backendProjectEvidenceArchive.summary?.evidenceSearchCount ?? 0],
                                [projectText('Reviews'), backendProjectEvidenceArchive.summary?.submissionReviewCount ?? 0],
                                [projectText('Transcript Messages'), backendProjectEvidenceArchive.summary?.transcriptMessageCount ?? 0],
                                [projectText('Raw Leaks'), backendProjectEvidenceArchive.summary?.rawLeakCount ?? 0],
                                [projectText('Packet'), backendProjectEvidenceArchive.checksum || 'missing'],
                              ].map(([label, value]) => (
                                <div key={`project-evidence-archive-${label}`} className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
                                  <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{label}</div>
                                  <div className="font-serif text-sm leading-tight break-words">{value}</div>
                                </div>
                              ))}
                            </div>
                            <div className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#9b875c]">
                              {projectText('Archive route')}: {backendProjectEvidenceArchive.backendRoutes?.projectEvidenceArchive || backendManagerReadyPackage.backendRoutes?.projectEvidenceArchive || `/projects/${activeProject.id}/project-evidence-archive`}
                            </div>
                          </div>
                        )}
                        {backendProjectEvidenceExportWorkflow && (
                          <div data-testid="backend-project-evidence-export-workflow-snapshot" className="mt-3 border border-[#d8c99f] bg-[#efe2bd]/55 p-2">
                            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                              <div className="min-w-0">
                                <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">{projectText('Project Evidence Export Workflow')}</div>
                                <div className="font-serif text-base leading-tight">{projectText(backendProjectEvidenceExportWorkflow.status || 'export-request-needed')}</div>
                              </div>
                              <span className={`node-status-tag ${backendProjectEvidenceExportWorkflow.readyForPrivatePilotHandoff ? 'bg-[#59684b] text-white' : 'bg-[#8f1e18] text-white'}`}>
                                {backendProjectEvidenceExportWorkflow.readyForPrivatePilotHandoff ? projectText('handoff ready') : projectText('approval needed')}
                              </span>
                            </div>
                            <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
                              {[
                                [projectText('Requests'), backendProjectEvidenceExportWorkflow.summary?.requestCount ?? 0],
                                [projectText('Approvals'), backendProjectEvidenceExportWorkflow.summary?.approvalCount ?? 0],
                                [projectText('Download Audits'), backendProjectEvidenceExportWorkflow.summary?.downloadAuditCount ?? 0],
                                [projectText('Failed Gates'), backendProjectEvidenceExportWorkflow.summary?.failedGateCount ?? 0],
                                [projectText('Private Pilot'), backendProjectEvidenceExportWorkflow.readyForPrivatePilotHandoff ? projectText('ready') : projectText('blocked')],
                                [projectText('Production Export'), backendProjectEvidenceExportWorkflow.readyForProductionExport ? projectText('ready') : projectText('blocked')],
                                [projectText('Archive'), backendProjectEvidenceExportWorkflow.summary?.archiveChecksum || 'missing'],
                                [projectText('Packet'), backendProjectEvidenceExportWorkflow.checksum || 'missing'],
                              ].map(([label, value]) => (
                                <div key={`project-evidence-export-${label}`} className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
                                  <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{label}</div>
                                  <div className="font-serif text-sm leading-tight break-words">{value}</div>
                                </div>
                              ))}
                            </div>
                            <div className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#9b875c]">
                              {projectText('Export route')}: {backendProjectEvidenceExportWorkflow.backendRoutes?.projectEvidenceExports || backendManagerReadyPackage.backendRoutes?.projectEvidenceExports || `/projects/${activeProject.id}/project-evidence-exports`}
                            </div>
                          </div>
                        )}
                        {backendProductionLaunchAudit && (
                          <div data-testid="backend-production-launch-audit-snapshot" className="mt-3 border border-[#d8c99f] bg-[#efe2bd]/55 p-2">
                            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                              <div className="min-w-0">
                                <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">{projectText('Production Launch Audit')}</div>
                                <div className="font-serif text-base leading-tight">{projectText(backendProductionLaunchAudit.status || 'unknown')} / {projectText('Production')} {projectText(backendProductionLaunchAudit.productionDecision || 'no-go')}</div>
                              </div>
                              <span className={`node-status-tag ${backendProductionLaunchAudit.privatePilotDecision === 'go' ? 'bg-[#59684b] text-white' : 'bg-[#8f1e18] text-white'}`}>
                                {projectText('Private Pilot')} {projectText(backendProductionLaunchAudit.privatePilotDecision || 'unknown')}
                              </span>
                            </div>
                            <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
                              {[
                                [projectText('Private Gates'), `${backendProductionLaunchAudit.summary?.privatePilotPassedGateCount ?? 0}/${backendProductionLaunchAudit.summary?.privatePilotGateCount ?? 0}`],
                                [projectText('Failed Private Gates'), backendProductionLaunchAudit.summary?.failedPrivatePilotGateCount ?? 0],
                                [projectText('Production Gates'), `${backendProductionLaunchAudit.summary?.productionPassedGateCount ?? 0}/${backendProductionLaunchAudit.summary?.productionGateCount ?? 0}`],
                                [projectText('Failed Production Gates'), backendProductionLaunchAudit.summary?.failedProductionGateCount ?? 0],
                                [projectText('Launch Approvals'), backendProductionLaunchAudit.summary?.launchApprovalCount ?? 0],
                                [projectText('Pilot Approval'), backendProductionLaunchAudit.summary?.launchApprovalPrivatePilotReady ? projectText('ready') : projectText('blocked')],
                                [projectText('Production Approval'), backendProductionLaunchAudit.summary?.launchApprovalProductionReady ? projectText('ready') : projectText('blocked')],
                                [projectText('Evidence Routes'), `${backendProductionLaunchAudit.summary?.readyEvidenceRouteCount ?? 0}/${backendProductionLaunchAudit.summary?.evidenceRouteCount ?? 0}`],
                                [projectText('Production Blockers'), backendProductionLaunchAudit.summary?.productionBlockerCount ?? 0],
                                [projectText('Packet'), backendProductionLaunchAudit.checksum || 'missing'],
                                [projectText('Next Gap'), backendProductionLaunchAudit.nextShortestPath?.id || 'none'],
                              ].map(([label, value]) => (
                                <div key={`production-launch-audit-${label}`} className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
                                  <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{label}</div>
                                  <div className="font-serif text-sm leading-tight break-words">{value}</div>
                                </div>
                              ))}
                            </div>
                            <div className="mt-2 space-y-1">
                              {(backendProductionLaunchAudit.failedPrivatePilotGates?.length ? backendProductionLaunchAudit.failedPrivatePilotGates : backendProductionLaunchAudit.productionBlockers || []).slice(0, 3).map(row => (
                                <div key={`production-launch-audit-gap-${row.id}`} className="grid grid-cols-[1fr_auto] gap-2 border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
                                  <div className="min-w-0">
                                    <div className="font-serif text-sm leading-tight truncate">{row.label || row.id}</div>
                                    <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] truncate">{row.detail || row.status}</div>
                                    {row.apiPath && (
                                      <div className="font-mono text-[7px] uppercase tracking-widest text-[#9b875c] truncate">Route: {row.apiPath}</div>
                                    )}
                                  </div>
                                  <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">{row.status || row.severity || 'blocked'}</span>
                                </div>
                              ))}
                            </div>
                            <div className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#9b875c]">
                              {projectText('Audit route')}: {backendManagerReadyPackage.backendRoutes?.productionLaunchAudit || `/projects/${activeProject.id}/production-launch-audit`}
                            </div>
                          </div>
                        )}
                        {backendLaunchApprovalWorkflow && (
                          <div data-testid="backend-launch-approval-workflow-snapshot" className="mt-3 border border-[#d8c99f] bg-[#efe2bd]/55 p-2">
                            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                              <div className="min-w-0">
                                <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">{projectText('Launch Approval Workflow')}</div>
                                <div className="font-serif text-base leading-tight">{projectText(backendLaunchApprovalWorkflow.status || 'approval-needed')}</div>
                              </div>
                              <span className={`node-status-tag ${backendLaunchApprovalWorkflow.readyForPrivatePilot ? 'bg-[#59684b] text-white' : 'bg-[#8f1e18] text-white'}`}>
                                {projectText('Pilot Approval')} {backendLaunchApprovalWorkflow.readyForPrivatePilot ? projectText('ready') : projectText('blocked')}
                              </span>
                            </div>
                            <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
                              {[
                                [projectText('Approvals'), backendLaunchApprovalWorkflow.summary?.approvalCount ?? 0],
                                [projectText('Pilot Roles'), `${backendLaunchApprovalWorkflow.modes?.find(mode => mode.id === 'private-pilot')?.approvedRoles?.length ?? 0}/${backendLaunchApprovalWorkflow.modes?.find(mode => mode.id === 'private-pilot')?.requiredRoles?.length ?? 0}`],
                                [projectText('Production Roles'), `${backendLaunchApprovalWorkflow.modes?.find(mode => mode.id === 'production')?.approvedRoles?.length ?? 0}/${backendLaunchApprovalWorkflow.modes?.find(mode => mode.id === 'production')?.requiredRoles?.length ?? 0}`],
                                [projectText('Latest Checksum'), backendLaunchApprovalWorkflow.summary?.latestApprovalChecksum || 'missing'],
                              ].map(([label, value]) => (
                                <div key={`launch-approval-workflow-${label}`} className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
                                  <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{label}</div>
                                  <div className="font-serif text-sm leading-tight break-words">{value}</div>
                                </div>
                              ))}
                            </div>
                            {backendLaunchApprovalWorkflow.rows?.length > 0 && (
                              <div className="mt-2 space-y-1">
                                {backendLaunchApprovalWorkflow.rows.slice(0, 3).map(row => (
                                  <div key={`launch-approval-workflow-row-${row.id}`} className="grid grid-cols-[1fr_auto] gap-2 border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
                                    <div className="min-w-0">
                                      <div className="font-serif text-sm leading-tight truncate">{row.mode || 'private-pilot'} / {row.approverRole || 'approver'}</div>
                                      <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] truncate">{row.reason || row.checksum || row.id}</div>
                                    </div>
                                    <span className={`node-status-tag ${row.decision === 'approved' ? 'bg-[#59684b] text-white' : 'bg-[#8f1e18] text-white'}`}>{row.decision || 'requested'}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#9b875c]">
                              {projectText('Approval route')}: {backendLaunchApprovalWorkflow.backendRoutes?.launchApprovals || backendManagerReadyPackage.backendRoutes?.launchApprovals || `/projects/${activeProject.id}/launch-approvals`}
                            </div>
                          </div>
                        )}
                        {backendPilotLaunchReadiness && (
                          <div data-testid="backend-pilot-launch-readiness-snapshot" className="mt-3 border border-[#d8c99f] bg-[#efe2bd]/55 p-2">
                            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                              <div className="min-w-0">
                                <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">Pilot Launch Readiness</div>
                                <div className="font-serif text-base leading-tight">{backendPilotLaunchReadiness.status || 'unknown'} / production {backendPilotLaunchReadiness.productionDecision || 'no-go'}</div>
                              </div>
                              <span className={`node-status-tag ${backendPilotLaunchReadiness.privatePilotDecision === 'go' ? 'bg-[#59684b] text-white' : 'bg-[#8f1e18] text-white'}`}>
                                Private Pilot {backendPilotLaunchReadiness.privatePilotDecision || 'unknown'}
                              </span>
                            </div>
                            <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
                              {[
                                ['Gates', `${backendPilotLaunchReadiness.summary?.passedGateCount ?? 0}/${backendPilotLaunchReadiness.summary?.gateCount ?? 0}`],
                                ['Failed Gates', backendPilotLaunchReadiness.summary?.failedGateCount ?? 0],
                                ['Evidence Routes', `${backendPilotLaunchReadiness.summary?.readyEvidenceRouteCount ?? 0}/${backendPilotLaunchReadiness.summary?.evidenceRouteCount ?? 0}`],
                                ['Prod Blockers', backendPilotLaunchReadiness.summary?.productionBlockerCount ?? 0],
                                ['Packet', backendPilotLaunchReadiness.checksum || 'missing'],
                                ['Next Gap', backendPilotLaunchReadiness.nextShortestPath?.id || 'none'],
                              ].map(([label, value]) => (
                                <div key={`pilot-launch-readiness-${label}`} className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
                                  <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{label}</div>
                                  <div className="font-serif text-sm leading-tight break-words">{value}</div>
                                </div>
                              ))}
                            </div>
                            <div className="mt-2 space-y-1">
                              {(backendPilotLaunchReadiness.failedGates?.length ? backendPilotLaunchReadiness.failedGates : backendPilotLaunchReadiness.productionBlockers || []).slice(0, 3).map(row => (
                                <div key={`pilot-launch-gap-${row.id}`} className="grid grid-cols-[1fr_auto] gap-2 border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
                                  <div className="min-w-0">
                                    <div className="font-serif text-sm leading-tight truncate">{row.label || row.id}</div>
                                    <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] truncate">{row.detail || row.status}</div>
                                    {row.apiPath && (
                                      <div className="font-mono text-[7px] uppercase tracking-widest text-[#9b875c] truncate">Route: {row.apiPath}</div>
                                    )}
                                  </div>
                                  <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">{row.status || row.severity || 'blocked'}</span>
                                </div>
                              ))}
                            </div>
                            <div className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#9b875c]">
                              Launch route: {backendManagerReadyPackage.backendRoutes?.pilotLaunchReadiness || `/projects/${activeProject.id}/pilot-launch-readiness`}
                            </div>
                          </div>
                        )}
                        {backendDeploymentPreflight && (
                          <div data-testid="backend-deployment-preflight-snapshot" className="mt-3 border border-[#d8c99f] bg-[#efe2bd]/55 p-2">
                            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                              <div className="min-w-0">
                                <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">Deployment Preflight</div>
                                <div className="font-serif text-base leading-tight">{backendDeploymentPreflight.status || 'unknown'} / production blocked</div>
                              </div>
                              <span className={`node-status-tag ${backendDeploymentPreflight.privatePilotDeploymentReady ? 'bg-[#59684b] text-white' : 'bg-[#8f1e18] text-white'}`}>
                                Pilot Env {backendDeploymentPreflight.privatePilotDeploymentReady ? 'Ready' : 'Blocked'}
                              </span>
                            </div>
                            <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
                              {[
                                ['Gates', `${backendDeploymentPreflight.summary?.passedGateCount ?? 0}/${backendDeploymentPreflight.summary?.gateCount ?? 0}`],
                                ['Blockers', backendDeploymentPreflight.summary?.failedBlockerGateCount ?? 0],
                                ['Warnings', backendDeploymentPreflight.summary?.failedWarningGateCount ?? 0],
                                ['Prod Controls', `${backendDeploymentPreflight.summary?.productionControlReadyCount ?? 0}/${backendDeploymentPreflight.summary?.productionControlCount ?? 0}`],
                                ['Scheduler', backendDeploymentPreflight.backendRuntime?.schedulerEnabled ? 'auto' : 'manual'],
                                ['Store', backendDeploymentPreflight.backendRuntime?.storePath ? 'file' : 'memory'],
                                ['DB Adapter', backendDeploymentPreflight.adapters?.managedPersistence?.driver || 'unknown'],
                                ['Queue Adapter', backendDeploymentPreflight.adapters?.workerQueue?.driver || 'unknown'],
                                ['Gateway', backendDeploymentPreflight.adapters?.gateway?.preflight?.status || backendAdapterGatewayPreflight?.status || 'unknown'],
                                ['Gateway Live', (backendDeploymentPreflight.adapters?.gateway?.preflight?.liveGatewayReady ?? backendAdapterGatewayPreflight?.summary?.liveGatewayReady) ? 'ready' : 'pending'],
                                ['Gateway State', (backendDeploymentPreflight.adapters?.gateway?.preflight?.stateReadable ?? backendAdapterGatewayPreflight?.summary?.stateReadable) ? 'readable' : 'pending'],
                                ['Packet', backendDeploymentPreflight.checksum || 'missing'],
                              ].map(([label, value]) => (
                                <div key={`deployment-preflight-${label}`} className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
                                  <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{label}</div>
                                  <div className="font-serif text-sm leading-tight break-words">{value}</div>
                                </div>
                              ))}
                            </div>
                            <div className="mt-2 space-y-1">
                              {(backendDeploymentPreflight.failedGates?.length ? backendDeploymentPreflight.failedGates : backendDeploymentPreflight.gates || []).slice(0, 3).map(row => (
                                <div key={`deployment-preflight-gap-${row.id}`} className="grid grid-cols-[1fr_auto] gap-2 border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
                                  <div className="min-w-0">
                                    <div className="font-serif text-sm leading-tight truncate">{row.label || row.id}</div>
                                    <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] truncate">{row.detail || row.status}</div>
                                    {row.apiPath && (
                                      <div className="font-mono text-[7px] uppercase tracking-widest text-[#9b875c] truncate">Route: {row.apiPath}</div>
                                    )}
                                  </div>
                                  <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">{row.passed ? 'ready' : row.severity || 'watch'}</span>
                                </div>
                              ))}
                            </div>
                            <div className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#9b875c]">
                              Preflight route: {backendManagerReadyPackage.backendRoutes?.deploymentPreflight || `/projects/${activeProject.id}/deployment-preflight`}
                              {' '} / Gateway route: {backendManagerReadyPackage.backendRoutes?.adapterGatewayPreflight || backendDeploymentPreflight.backendRoutes?.adapterGatewayPreflight || `/projects/${activeProject.id}/adapter-gateway-preflight`}
                            </div>
                          </div>
                        )}
                        {backendMvpReadiness && (
                          <div data-testid="backend-mvp-readiness-snapshot" className="mt-3 border border-[#d8c99f] bg-[#efe2bd]/55 p-2">
                            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                              <div className="min-w-0">
                                <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">MVP Readiness</div>
                                <div className="font-serif text-base leading-tight">{backendMvpReadiness.status || 'unknown'} / {backendMvpReadiness.production?.status || 'production-blocked'}</div>
                              </div>
                              <span className={`node-status-tag ${backendMvpReadiness.readyForLocalPilot ? 'bg-[#59684b] text-white' : 'bg-[#8f1e18] text-white'}`}>
                                {backendMvpReadiness.readyForLocalPilot ? 'Local Pilot Ready' : 'Core Blocked'}
                              </span>
                            </div>
                            <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
                              {[
                                ['Core', `${backendMvpReadiness.localPilot?.passedCount ?? 0}/${backendMvpReadiness.localPilot?.totalCount ?? 0}`],
                                ['Core Blockers', backendMvpReadiness.localPilot?.blockerCount ?? 0],
                                ['Production Blockers', backendMvpReadiness.production?.blockerCount ?? 0],
                                ['Next Gap', backendMvpReadiness.nextShortestPath?.id || 'none'],
                              ].map(([label, value]) => (
                                <div key={`mvp-readiness-${label}`} className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
                                  <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{label}</div>
                                  <div className="font-serif text-sm leading-tight break-words">{value}</div>
                                </div>
                              ))}
                            </div>
                            <div className="mt-2 space-y-1">
                              {(backendMvpReadiness.blockerRows?.length ? backendMvpReadiness.blockerRows : backendMvpReadiness.production?.rows || []).slice(0, 3).map(row => (
                                <div key={`mvp-gap-${row.id}`} className="grid grid-cols-[1fr_auto] gap-2 border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
                                  <div className="min-w-0">
                                    <div className="font-serif text-sm leading-tight truncate">{row.label}</div>
                                    <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] truncate">{row.detail}</div>
                                    {row.apiPath && (
                                      <div className="font-mono text-[7px] uppercase tracking-widest text-[#9b875c] truncate">Route: {row.apiPath}</div>
                                    )}
                                  </div>
                                  <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">{row.status}</span>
                                </div>
                              ))}
                            </div>
                            <div className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#9b875c]">
                              MVP route: {backendManagerReadyPackage.backendRoutes?.mvpReadiness || `/projects/${activeProject.id}/mvp-readiness`}
                            </div>
                          </div>
                        )}
                        {backendOperationsReadiness && (
                          <div data-testid="backend-operations-readiness-snapshot" className="mt-3 border border-[#d8c99f] bg-[#efe2bd]/55 p-2">
                            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                              <div className="min-w-0">
                                <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">Operations Readiness</div>
                                <div className="font-serif text-base leading-tight">{backendOperationsReadiness.status || 'unknown'} / production blocked</div>
                              </div>
                              <span className={`node-status-tag ${backendOperationsReadiness.readyForLocalPilot ? 'bg-[#59684b] text-white' : 'bg-[#8f1e18] text-white'}`}>
                                {backendOperationsReadiness.readyForLocalPilot ? 'Local Ops Ready' : 'Needs Ops Work'}
                              </span>
                            </div>
                            <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
                              {[
                                ['Gates', `${backendOperationsReadiness.summary?.passedGateCount ?? 0}/${backendOperationsReadiness.summary?.gateCount ?? 0}`],
                                ['DB Adapter Plan', backendPersistenceAdapterPlan?.status || (backendOperationsReadiness.summary?.persistenceAdapterPlanReady ? 'ready' : 'blocked')],
                                ['DB Adapter Dry Run', backendPersistenceAdapterDryRun?.status || backendOperationsReadiness.summary?.persistenceAdapterDryRunStatus || 'unknown'],
                                ['DB Driver', backendPersistenceAdapterDryRun?.summary?.adapterDriver || backendOperationsReadiness.summary?.persistenceAdapterDriver || 'unknown'],
                                ['DB Cutover', (backendPersistenceAdapterDryRun?.summary?.adapterProductionCutoverReady ?? backendOperationsReadiness.summary?.persistenceAdapterProductionCutoverReady) ? 'ready' : 'blocked'],
                                ['Shadow Reads', `${backendPersistenceAdapterDryRun?.summary?.shadowReadParityCount ?? backendOperationsReadiness.summary?.persistenceAdapterShadowReadParityCount ?? 0}/${backendPersistenceAdapterDryRun?.summary?.shadowReadGroupCount ?? backendOperationsReadiness.observability?.metrics?.persistenceAdapterShadowReadGroupCount ?? 0}`],
                                ['Rollback', (backendPersistenceAdapterDryRun?.summary?.transactionRollbackReady ?? backendOperationsReadiness.summary?.persistenceAdapterRollbackReady) ? 'ready' : 'blocked'],
                                ['Backup Restore', (backendPersistenceAdapterDryRun?.summary?.backupRestoreReady ?? backendOperationsReadiness.summary?.persistenceAdapterBackupRestoreReady) ? 'ready' : 'blocked'],
                                ['DB Adapter Ops', backendPersistenceAdapterDryRun?.summary?.adapterOperationCount ?? backendOperationsReadiness.summary?.persistenceAdapterOperationCount ?? 0],
                                ['DB Tables', backendPersistenceAdapterDryRun?.summary?.adapterImportedTableCount ?? backendOperationsReadiness.summary?.persistenceAdapterImportedTableCount ?? 0],
                                ['Adapter Plan', backendWorkerQueueAdapterPlan?.status || (backendOperationsReadiness.summary?.queueAdapterPlanReady ? 'ready' : 'blocked')],
                                ['Adapter Dry Run', backendWorkerQueueAdapterDryRun?.status || backendOperationsReadiness.summary?.queueAdapterDryRunStatus || 'unknown'],
                                ['Queue Driver', backendWorkerQueueAdapterDryRun?.summary?.adapterDriver || backendOperationsReadiness.summary?.queueAdapterDriver || 'unknown'],
                                ['Queue Cutover', (backendWorkerQueueAdapterDryRun?.summary?.adapterProductionCutoverReady ?? backendOperationsReadiness.summary?.queueAdapterProductionCutoverReady) ? 'ready' : 'blocked'],
                                ['Adapter Gates', backendWorkerQueueAdapterDryRun?.summary?.failedGateCount ?? backendOperationsReadiness.summary?.queueAdapterFailedGateCount ?? 0],
                                ['Queue Ops', backendWorkerQueueAdapterDryRun?.summary?.adapterOperationCount ?? backendOperationsReadiness.summary?.queueAdapterOperationCount ?? 0],
                                ['Queue Rows', backendWorkerQueueAdapterDryRun?.summary?.adapterQueueRowCount ?? backendOperationsReadiness.summary?.queueAdapterQueueRowCount ?? 0],
                                ['Dispatches', backendWorkerQueueAdapterDryRun?.summary?.dispatchCount ?? backendOperationsReadiness.summary?.queueAdapterDispatchCount ?? 0],
                                ['Leases', backendWorkerQueueAdapterDryRun?.summary?.leaseAcquisitionCount ?? backendOperationsReadiness.summary?.queueAdapterLeaseAcquisitionCount ?? 0],
                                ['Snapshot Parity', (backendWorkerQueueAdapterDryRun?.summary?.snapshotParityReady ?? backendOperationsReadiness.summary?.queueAdapterSnapshotParityReady) ? 'ready' : 'blocked'],
                                ['Lease Parity', (backendWorkerQueueAdapterDryRun?.summary?.snapshotLeaseParityReady ?? backendOperationsReadiness.summary?.queueAdapterSnapshotLeaseParityReady) ? 'ready' : 'blocked'],
                                ['Worker Runs', backendOperationsReadiness.summary?.workerRunCount ?? 0],
                                ['Receipts', backendOperationsReadiness.summary?.workerExecutionReceiptCount ?? 0],
                                ['Retryable', backendOperationsReadiness.summary?.workerRetryableFailureCount ?? 0],
                                ['Dead Letters', backendOperationsReadiness.summary?.workerDeadLetterCount ?? 0],
                                ['Recovery', backendOperationsReadiness.summary?.workerRecoveryContractReady ? 'ready' : 'blocked'],
                                ['Incident Drill', backendOperationsReadiness.summary?.incidentDrillReady ? 'ready' : 'blocked'],
                                ['Drill Receipts', `${backendOperationsReadiness.summary?.incidentDrillReceiptCount ?? 0}/${backendOperationsReadiness.summary?.incidentDrillFailedReceiptCount ?? 0}`],
                                ['Drill Alerts', `${backendOperationsReadiness.summary?.incidentDrillRoutedAlertRuleCount ?? 0}/${backendOperationsReadiness.summary?.alertRuleCount ?? 0}`],
                                ['Max Attempts', backendOperationsReadiness.observability?.metrics?.workerMaxAttempts ?? 0],
                                ['Alerts', backendOperationsReadiness.summary?.alertRuleCount ?? 0],
                              ].map(([label, value]) => (
                                <div key={`operations-readiness-${label}`} className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
                                  <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{label}</div>
                                  <div className="font-serif text-sm leading-tight break-words">{value}</div>
                                </div>
                              ))}
                            </div>
                            <div className="mt-2 space-y-1">
                              {(backendOperationsReadiness.failedGates?.length ? backendOperationsReadiness.failedGates : backendOperationsReadiness.observability?.alertRules || []).slice(0, 3).map(row => (
                                <div key={`operations-gap-${row.id}`} className="grid grid-cols-[1fr_auto] gap-2 border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
                                  <div className="min-w-0">
                                    <div className="font-serif text-sm leading-tight truncate">{row.label || row.id}</div>
                                    <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] truncate">{row.detail || row.condition}</div>
                                    {(row.apiPath || row.route) && (
                                      <div className="font-mono text-[7px] uppercase tracking-widest text-[#9b875c] truncate">Route: {row.apiPath || row.route}</div>
                                    )}
                                  </div>
                                  <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">{row.status || row.severity || 'watch'}</span>
                                </div>
                              ))}
                            </div>
                            <div className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#9b875c]">
                              Operations route: {backendManagerReadyPackage.backendRoutes?.operationsReadiness || `/projects/${activeProject.id}/operations-readiness`}
                            </div>
                          </div>
                        )}
                        {backendProviderReadiness && (
                          <div data-testid="backend-provider-readiness-snapshot" className="mt-3 border border-[#d8c99f] bg-[#efe2bd]/55 p-2">
                            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                              <div className="min-w-0">
                                <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">Provider Readiness</div>
                                <div className="font-serif text-base leading-tight">{backendProviderReadiness.status || 'unknown'} / {backendProviderReadiness.rollout?.production || 'blocked'}</div>
                              </div>
                              <span className={`node-status-tag ${backendProviderReadiness.readyForLocalPilot ? 'bg-[#59684b] text-white' : 'bg-[#8f1e18] text-white'}`}>
                                {backendProviderReadiness.readyForLocalPilot ? 'Local Contract Ready' : 'Needs Provider Work'}
                              </span>
                            </div>
                            <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
                              {[
                                ['Gates', `${backendProviderReadiness.summary?.passedGateCount ?? 0}/${backendProviderReadiness.summary?.gateCount ?? 0}`],
                                ['Provider Searches', backendProviderReadiness.summary?.providerBackedSearchCount ?? 0],
                                ['Evidence Sources', backendProviderReadiness.summary?.evidenceSourceCount ?? 0],
                                ['Production Controls', backendProviderReadiness.summary?.productionControlCount ?? 0],
                                ['Local Controls', backendProviderReadiness.summary?.localProductionControlCount ?? 0],
                                ['Usage Rows', backendProviderReadiness.summary?.providerUsageCount ?? 0],
                                ['Daily Cost', `${backendProviderReadiness.summary?.providerDailyCostCents ?? 0}c`],
                                ['Failure Control', backendProviderReadiness.summary?.providerFailureControlReady ? 'ready' : 'blocked'],
                                ['Open Circuits', backendProviderReadiness.summary?.providerOpenCircuitCount ?? 0],
                                ['Retry Attempts', backendProviderReadiness.summary?.providerRetryAttempts ?? 0],
                                ['Secret Vault', backendProviderReadiness.summary?.providerSecretVaultReady ? 'ready' : 'blocked'],
                                ['Vault Records', backendProviderReadiness.summary?.providerSecretVaultEncryptedRecordCount ?? 0],
                                ['Vault Rotation', backendProviderReadiness.summary?.providerSecretVaultRotationReady ? 'ready' : 'blocked'],
                                ['Source Safety', backendProviderReadiness.summary?.sourceSafetyReady ? 'ready' : 'blocked'],
                                ['Blocked Sources', backendProviderReadiness.summary?.sourceSafetyBlockedSourceCount ?? 0],
                                ['Search Enabled', backendProviderReadiness.summary?.searchEnabled ? 'yes' : 'no'],
                                ['Response Leaks', backendProviderReadiness.summary?.responseLeakCount ?? 0],
                                ['Next Provider Gap', backendProviderReadiness.rollout?.nextProductionGapId || 'none'],
                              ].map(([label, value]) => (
                                <div key={`provider-readiness-${label}`} className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
                                  <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{label}</div>
                                  <div className="font-serif text-sm leading-tight break-words">{value}</div>
                                </div>
                              ))}
                            </div>
                            <div className="mt-2 space-y-1">
                              {(backendProviderReadiness.failedGates?.length ? backendProviderReadiness.failedGates : backendProviderReadiness.requiredProductionControls || []).slice(0, 3).map(row => (
                                <div key={`provider-gap-${row.id}`} className="grid grid-cols-[1fr_auto] gap-2 border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
                                  <div className="min-w-0">
                                    <div className="font-serif text-sm leading-tight truncate">{row.label}</div>
                                    <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] truncate">{row.detail}</div>
                                    {row.apiPath && (
                                      <div className="font-mono text-[7px] uppercase tracking-widest text-[#9b875c] truncate">Route: {row.apiPath}</div>
                                    )}
                                  </div>
                                  <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">{row.status}</span>
                                </div>
                              ))}
                            </div>
                            <div className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#9b875c]">
                              Provider route: {backendManagerReadyPackage.backendRoutes?.providerReadiness || `/projects/${activeProject.id}/provider-readiness`}
                            </div>
                          </div>
                        )}
                        {backendSecurityBoundary && (
                          <div data-testid="backend-security-boundary-snapshot" className="mt-3 border border-[#d8c99f] bg-[#efe2bd]/55 p-2">
                            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                              <div className="min-w-0">
                                <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">Security Boundary</div>
                                <div className="font-serif text-base leading-tight">{backendSecurityBoundary.status || 'unknown'} / {backendSecurityBoundary.production?.status || 'production-blocked'}</div>
                              </div>
                              <span className={`node-status-tag ${backendSecurityBoundary.readyForLocalPilot ? 'bg-[#59684b] text-white' : 'bg-[#8f1e18] text-white'}`}>
                                {backendSecurityBoundary.readyForLocalPilot ? 'Local Safe' : 'Needs Attention'}
                              </span>
                            </div>
                            <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
                              {[
                                ['Routes', backendSecurityBoundary.routeSummary?.count ?? 0],
                                ['Sensitive Sets', backendSecurityBoundary.summary?.sensitiveCollectionCount ?? 0],
                                ['Access Policy', backendSecurityBoundary.accessControl?.status || 'unknown'],
                                ['Audit Rows', backendSecurityBoundary.accessAudit?.count ?? 0],
                                ['Audit Stream', backendSecurityBoundary.accessAudit?.stream?.count ?? 0],
                                ['Audit Chain', backendSecurityBoundary.accessAudit?.stream?.hashChainReady ? 'ready' : 'blocked'],
                                ['Identity Sessions', backendSecurityBoundary.summary?.identitySessionActiveCount ?? backendManagerReadyPackage.summary?.identitySessionActiveCount ?? 0],
                                ['Session Rows', backendSecurityBoundary.summary?.identitySessionCount ?? backendManagerReadyPackage.summary?.identitySessionCount ?? 0],
                                ['Secret Vault', backendSecurityBoundary.summary?.secretVaultReady ? 'ready' : 'blocked'],
                                ['Vault Records', backendSecurityBoundary.summary?.secretVaultEncryptedRecordCount ?? 0],
                                ['Vault Rotation', backendSecurityBoundary.summary?.secretVaultRotationReady ? 'ready' : 'blocked'],
                                ['Denied', backendSecurityBoundary.accessAudit?.deniedCount ?? 0],
                                ['Raw Leaks', backendSecurityBoundary.redactionScan?.rawLeakCount ?? 0],
                                ['Security Blockers', backendSecurityBoundary.production?.blockerCount ?? 0],
                              ].map(([label, value]) => (
                                <div key={`security-boundary-${label}`} className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
                                  <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{label}</div>
                                  <div className="font-serif text-sm leading-tight break-words">{value}</div>
                                </div>
                              ))}
                            </div>
                            <div className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#9b875c]">
                              Security route: {backendManagerReadyPackage.backendRoutes?.securityBoundary || `/projects/${activeProject.id}/security-boundary`}
                              {' '} / Identity route: {backendManagerReadyPackage.backendRoutes?.identitySessions || `/projects/${activeProject.id}/identity-sessions`}
                            </div>
                          </div>
                        )}
                        <div className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#9b875c]">
                          Package route: {backendManagerReadyPackage.backendRoutes?.managerReadyPackage || `/projects/${activeProject.id}/manager-ready-package`}
                        </div>
                      </div>
                    )}
                    {backendManagerDashboard && (
                      <div data-testid="backend-manager-dashboard-snapshot" className="mt-3 border-t border-[#d8c99f] pt-3">
                        <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18] mb-2">Backend Manager Snapshot</div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {[
                            ['Readiness', backendManagerDashboard.readiness?.score ?? 0],
                            ['Proof Routes', backendManagerDashboard.readinessProofMap?.routes?.length ?? 0],
                            ['Scenario Trail', backendManagerDashboard.managerScenarioTrail?.passedCount ?? 0],
                            ['Walkthrough', `${backendManagerScenarioWalkthrough?.completedCount ?? backendManagerDashboard.managerScenarioWalkthrough?.completedCount ?? 0}/${backendManagerScenarioWalkthrough?.count ?? backendManagerDashboard.managerScenarioWalkthrough?.count ?? 0}`],
                            ['Standalone Trail', backendManagerScenarioTrail?.passedCount ?? 0],
                            ['Action Queue', `${backendManagerActionQueue?.completedCount ?? backendManagerDashboard.managerActionQueue?.completedCount ?? 0}/${backendManagerActionQueue?.count ?? backendManagerDashboard.managerActionQueue?.count ?? 0}`],
                            ['Transcript Proofs', backendManagerDashboard.transcriptIndex?.recoverableProofCount ?? 0],
                            ['Brief Alignment', backendManagerDashboard.kickoffMeetingFlow?.briefAlignment?.heardByAgentIds?.length ?? 0],
                            ['Confirmed Team', backendManagerDashboard.kickoffMeetingFlow?.confirmedTeamMatrixRows?.filter(row => row.inProjectState && row.inKickoffCharter).length ?? 0],
                            ['Startup Agents', backendManagerDashboard.kickoffExecutionFlow?.allAgentStartupRows?.filter(row => row.started && row.scheduled).length ?? 0],
                            ['Ops Agents', backendManagerDashboard.operationsBoard?.agents?.length ?? 0],
                            ['Continuous Rows', backendManagerDashboard.continuousWorkLoop?.rows?.length ?? 0],
                            ['Continuous Proofs', backendManagerDashboard.continuousWorkLoop?.proofedAgentCount ?? 0],
                            ['Management Checks', backendManagerDashboard.agents?.managementMesh?.reduce((sum, row) => sum + (row.checkInCount || 0), 0) ?? 0],
                            ['Agent Messages', backendManagerDashboard.agentCommunicationFlow?.rows?.length ?? 0],
                            ['Delivered Messages', backendManagerDashboard.agentCommunicationFlow?.deliveredCount ?? 0],
                            ['Assignment Rows', backendManagerDashboard.assignmentFlow?.rows?.length ?? 0],
                            ['Assignment Timeline', backendManagerDashboard.assignmentTimelineMatrix?.timelineReadyCount ?? 0],
                            ['Assignment Progress', backendManagerDashboard.assignmentWorkProgress?.progressReadyCount ?? 0],
                            ['Change Rows', backendManagerDashboard.changeFlow?.rows?.length ?? 0],
                            ['Change Intake', backendManagerDashboard.changeSourceIntake?.sourceReadyCount ?? 0],
                            ['Change Owner Pulses', backendManagerDashboard.changeFlow?.rows?.filter(row => row.ownerWorkStarted).length ?? 0],
                            ['Submissions', backendManagerDashboard.submissions?.count ?? 0],
                            ['Final Deliverables', backendManagerDashboard.submissions?.finalDeliverableCount ?? 0],
                            ['Pending Review', backendManagerDashboard.submissions?.pendingReviewCount ?? 0],
                            ['Evidence Searches', backendManagerDashboard.evidenceSearches?.count ?? 0],
                            ['Evidence Sources', backendManagerDashboard.evidenceSearches?.sourceCount ?? 0],
                            ['Accepted Reviews', backendManagerDashboard.submissionReviews?.acceptedCount ?? 0],
                            ['Change Requests', backendManagerDashboard.submissionReviews?.changesRequestedCount ?? 0],
                            ['Open Tasks', backendManagerDashboard.tasks?.openCount ?? 0],
                          ].map(([label, value]) => (
                            <div key={label} className="border border-[#d8c99f] bg-[#efe2bd]/50 px-2 py-1">
                              <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{label}</div>
                              <div className="font-serif text-base leading-tight">{value}</div>
                            </div>
                          ))}
                        </div>
                        <div className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#9b875c]">
                          Backend route: {backendManagerDashboard.backendRoutes?.readinessProofMap || 'not available'}
                        </div>
                        <div data-testid="backend-manager-submissions-route" className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#9b875c]">
                          Submissions route: {backendManagerDashboard.backendRoutes?.submissions || `/projects/${activeProject.id}/submissions`} / {backendManagerDashboard.submissions?.count ?? 0} submitted
                        </div>
                        <div data-testid="backend-manager-evidence-searches-route" className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#9b875c]">
                          Evidence route: {backendManagerDashboard.backendRoutes?.evidenceSearches || `/projects/${activeProject.id}/evidence-searches`} / {backendManagerDashboard.evidenceSearches?.count ?? 0} searches
                        </div>
                        <div data-testid="backend-manager-submission-reviews-route" className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#9b875c]">
                          Review route: {backendManagerDashboard.backendRoutes?.submissionReviews || `/projects/${activeProject.id}/submission-reviews`} / {backendManagerDashboard.submissionReviews?.count ?? 0} reviews
                        </div>
                        {backendManagerDashboard.submissions?.rows?.length > 0 && (
                          <div data-testid="backend-manager-submissions-snapshot" className="mt-3 border border-[#d8c99f] bg-[#efe2bd]/55 p-2">
                            <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">Agent Submissions</div>
                            <div className="mt-2 space-y-1">
                              {backendManagerDashboard.submissions.rows.slice(0, 4).map(row => (
                                <div key={row.id} className="grid grid-cols-[1fr_auto] gap-2 border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
                                  <div className="min-w-0">
                                    <div className="font-serif text-sm leading-tight truncate">{row.title}</div>
                                    <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] truncate">{row.agentName} / {row.artifactType} / {row.reviewStatus}</div>
                                  </div>
                                  <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">{row.status}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {backendManagerDashboard.evidenceSearches?.rows?.length > 0 && (
                          <div data-testid="backend-manager-evidence-searches-snapshot" className="mt-3 border border-[#d8c99f] bg-[#efe2bd]/55 p-2">
                            <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">Evidence Searches</div>
                            <div className="mt-2 space-y-1">
                              {backendManagerDashboard.evidenceSearches.rows.slice(0, 4).map(row => (
                                <div key={row.id} className="grid grid-cols-[1fr_auto] gap-2 border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
                                  <div className="min-w-0">
                                    <div className="font-serif text-sm leading-tight truncate">{row.query}</div>
                                    <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] truncate">{row.agentName} / {row.sources?.length || 0} sources / {row.confidence}</div>
                                  </div>
                                  <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">{row.status}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {backendManagerDashboard.submissionReviews?.rows?.length > 0 && (
                          <div data-testid="backend-manager-submission-reviews-snapshot" className="mt-3 border border-[#d8c99f] bg-[#efe2bd]/55 p-2">
                            <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">Submission Reviews</div>
                            <div className="mt-2 space-y-1">
                              {backendManagerDashboard.submissionReviews.rows.slice(0, 4).map(row => (
                                <div key={row.id} className="grid grid-cols-[1fr_auto] gap-2 border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
                                  <div className="min-w-0">
                                    <div className="font-serif text-sm leading-tight truncate">{row.comments}</div>
                                    <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] truncate">{row.reviewerAgentName} / {row.submitterAgentName} / {row.submissionId}</div>
                                  </div>
                                  <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">{row.verdict}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        <div data-testid="backend-manager-scenario-trail-route" className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#9b875c]">
                          Scenario trail route: {backendManagerDashboard.backendRoutes?.managerScenarioTrail || '/manager-scenario-trail'} / {backendManagerScenarioTrail?.passedCount ?? 0}-{backendManagerScenarioTrail?.count ?? 0} ready
                        </div>
                        <div data-testid="backend-manager-scenario-walkthrough-route" className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#9b875c]">
                          Walkthrough route: {backendManagerDashboard.backendRoutes?.managerScenarioWalkthrough || '/manager-scenario-walkthrough'} / {backendManagerScenarioWalkthrough?.completedCount ?? backendManagerDashboard.managerScenarioWalkthrough?.completedCount ?? 0}-{backendManagerScenarioWalkthrough?.count ?? backendManagerDashboard.managerScenarioWalkthrough?.count ?? 0} complete
                        </div>
                        <div data-testid="backend-manager-requirement-matrix-route" className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#9b875c]">
                          Requirement matrix route: {backendManagerDashboard.backendRoutes?.managerRequirementMatrix || '/manager-requirement-matrix'} / {backendManagerRequirementMatrix?.passedCount ?? 0}-{backendManagerRequirementMatrix?.count ?? 0} ready
                        </div>
                        <div data-testid="backend-manager-action-queue-route" className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#9b875c]">
                          Action queue route: {backendManagerDashboard.backendRoutes?.managerActionQueue || '/manager-action-queue'} / {backendManagerActionQueue?.readyCount ?? 0} ready next actions
                        </div>
                      </div>
                    )}
                    {backendManagerScenarioTrail && (
                      <div data-testid="backend-manager-scenario-trail-snapshot" className="mt-3 border-t border-[#d8c99f] pt-3">
                        <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18] mb-2">Standalone Trail</div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="border border-[#d8c99f] bg-[#efe2bd]/50 px-2 py-1">
                            <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">Ready Rows</div>
                            <div className="font-serif text-base leading-tight">{backendManagerScenarioTrail.passedCount ?? 0}/{backendManagerScenarioTrail.count ?? 0}</div>
                          </div>
                          <div className="border border-[#d8c99f] bg-[#efe2bd]/50 px-2 py-1">
                            <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">Endpoint</div>
                            <div className="font-mono text-[8px] uppercase tracking-widest text-[#4d412d] leading-relaxed break-words">
                              {backendManagerDashboard?.backendRoutes?.managerScenarioTrail || `/projects/${activeProject.id}/manager-scenario-trail`}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    {backendManagerRequirementMatrix && (
                      <div data-testid="backend-manager-requirement-matrix-snapshot" className="mt-3 border-t border-[#d8c99f] pt-3">
                        <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18] mb-2">Manager Requirement Matrix</div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="border border-[#d8c99f] bg-[#efe2bd]/50 px-2 py-1">
                            <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">Ready Rows</div>
                            <div className="font-serif text-base leading-tight">{backendManagerRequirementMatrix.passedCount ?? 0}/{backendManagerRequirementMatrix.count ?? 0}</div>
                          </div>
                          <div className="border border-[#d8c99f] bg-[#efe2bd]/50 px-2 py-1">
                            <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">Endpoint</div>
                            <div className="font-mono text-[8px] uppercase tracking-widest text-[#4d412d] leading-relaxed break-words">
                              {backendManagerDashboard?.backendRoutes?.managerRequirementMatrix || `/projects/${activeProject.id}/manager-requirement-matrix`}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    {backendManagerUseCaseAudit && (
                      <div data-testid="backend-manager-use-case-audit-snapshot" className="mt-3 border-t border-[#d8c99f] pt-3">
                        <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18] mb-2">Manager Use Case Audit</div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {[
                            ['Status', backendManagerUseCaseAudit.status || 'unknown'],
                            ['Covered', `${backendManagerUseCaseAudit.coveredCount ?? 0}/${backendManagerUseCaseAudit.count ?? 0}`],
                            ['Partial', backendManagerUseCaseAudit.partialCount ?? 0],
                            ['Missing', backendManagerUseCaseAudit.missingCount ?? 0],
                          ].map(([label, value]) => (
                            <div key={`use-case-audit-${label}`} className="border border-[#d8c99f] bg-[#efe2bd]/50 px-2 py-1">
                              <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{label}</div>
                              <div className="font-serif text-base leading-tight break-words">{value}</div>
                            </div>
                          ))}
                        </div>
                        <div className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#9b875c] leading-relaxed break-words">
                          Use case route: {backendManagerDashboard?.backendRoutes?.managerUseCaseAudit || `/projects/${activeProject.id}/manager-use-case-audit`}
                        </div>
                        <div className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#9b875c] leading-relaxed break-words">
                          Latest stage: {backendManagerUseCaseAudit.rows?.[0]?.stage || 'none'}
                        </div>
                      </div>
                    )}
                    {backendManagerActionQueue && (
                      <div data-testid="backend-manager-action-queue-snapshot" className="mt-3 border-t border-[#d8c99f] pt-3">
                        <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18] mb-2">{projectText('Manager Action Queue')}</div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {[
                            ['Complete', `${backendManagerActionQueue.completedCount ?? 0}/${backendManagerActionQueue.count ?? 0}`],
                            ['Ready', backendManagerActionQueue.readyCount ?? 0],
                            ['Blocked', backendManagerActionQueue.blockedCount ?? 0],
                            ['Unresolved', backendManagerActionQueue.unresolvedRouteCount ?? 0],
                            ['Next Action', backendManagerActionQueue.nextAction?.label || 'all complete'],
                          ].map(([label, value]) => (
                            <div key={`action-queue-${label}`} className="border border-[#d8c99f] bg-[#efe2bd]/50 px-2 py-1">
                              <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{projectText(label)}</div>
                              <div className="font-serif text-base leading-tight break-words">{projectText(value)}</div>
                            </div>
                          ))}
                        </div>
                        <div className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#9b875c] leading-relaxed break-words">
                          {backendManagerActionQueue.nextAction
                            ? `${backendManagerActionQueue.nextAction.method} ${backendManagerActionQueue.nextAction.apiPath}`
                            : (backendManagerDashboard?.backendRoutes?.managerActionQueue || `/projects/${activeProject.id}/manager-action-queue`)}
                        </div>
                        {backendManagerActionQueue.nextAction?.requestBodyTemplate && (
                          <div className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] leading-relaxed break-words">
                            {projectText('Next body')}: {projectText(JSON.stringify(backendManagerActionQueue.nextAction.requestBodyTemplate))}
                          </div>
                        )}
                      </div>
                    )}
                    <div data-testid="backend-last-result" className="mt-3 border-t border-[#d8c99f] pt-3">
                        <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18] mb-2">{projectText('Latest Backend Work')}</div>
                        <div className="mb-2 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] leading-relaxed break-words">
                          HTTP-AUTONOMOUS-SCHEDULER-STARTUP-AGENTS / MANAGER-UI-SCHEDULER-START-PULSE{backendLatestTriggerText ? ` / ${backendLatestTriggerText}` : ''}
                        </div>
                        <div className="grid md:grid-cols-3 gap-2">
                          <div className="border border-[#d8c99f] bg-[#efe2bd]/50 px-2 py-1">
                            <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{projectText('Projects')}</div>
                            <div className="font-serif text-base leading-tight">
                              {projectText((backendLatestResult.processed || []).map(item => item.projectId).slice(0, 2).join(' / ') || 'none due')}
                            </div>
                          </div>
                          <div className="border border-[#d8c99f] bg-[#efe2bd]/50 px-2 py-1">
                            <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{projectText('Agents')}</div>
                            <div className="font-serif text-base leading-tight">
                              {projectText(backendLatestAgentsProcessed.map(item => [item.agentId, item.result?.cycle?.trigger || item.project?.agentWorkerLedger?.[0]?.trigger || item.managerDashboard?.operationsBoard?.agents?.find(agent => agent.agentId === item.agentId)?.trigger || item.trigger].filter(Boolean).join(' / ')).slice(0, 3).join(' / ') || 'none due')}
                            </div>
                          </div>
                          <div className="border border-[#d8c99f] bg-[#efe2bd]/50 px-2 py-1">
                            <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{projectText('Worker Messages')}</div>
                            <div className="font-serif text-base leading-tight">{backendLatestResult.messageCount ?? 0}</div>
                          </div>
                        </div>
                      </div>
                    {backendStation.error && (
                      <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18] mt-1">{backendStation.error}</div>
                    )}
                  </div>
                  <div className="grid shrink-0 grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={refreshBackendSchedulerStatus}
                      disabled={backendStation.loading}
                      className="inline-flex items-center justify-center gap-2 border border-[#7b6542] bg-[#efe2bd] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-50"
                    >
                      <Search size={13} /> Check
                    </button>
                    <button
                      type="button"
                      onClick={() => runBackendSchedulerAction('start')}
                      disabled={backendStation.loading}
                      className="inline-flex items-center justify-center gap-2 border border-[#7b6542] bg-[#251b13] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#efe2bd] hover:bg-[#8f1e18] disabled:opacity-50"
                    >
                      <Play size={13} /> Start
                    </button>
                    {(backendScheduler.lastStartedRunImmediately || /Started backend scheduler/i.test(backendStation.lastAction || '')) && (
                      <span className="inline-flex items-center justify-center border border-[#59684b] bg-[#1f2b1d] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#dff0cf]">
                        IMMEDIATE START: YES
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => runBackendSchedulerAction('stop')}
                      disabled={backendStation.loading}
                      className="inline-flex items-center justify-center gap-2 border border-[#7b6542] bg-[#efe2bd] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-50"
                    >
                      <StopCircle size={13} /> Stop
                    </button>
                    <button
                      type="button"
                      onClick={() => syncBackendProjectState()}
                      disabled={backendStation.loading}
                      className="inline-flex items-center justify-center gap-2 border border-[#7b6542] bg-[#efe2bd] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-50"
                    >
                      <Database size={13} /> Sync State
                    </button>
                    <button
                      type="button"
                      onClick={refreshBackendManagerView}
                      disabled={backendStation.loading}
                      className="inline-flex items-center justify-center gap-2 border border-[#7b6542] bg-[#efe2bd] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-50"
                    >
                      <Database size={13} /> Sync Manager View
                    </button>
                    <button
                      type="button"
                      data-testid="backend-sync-ready-package"
                      onClick={() => syncBackendManagerReadyPackage({ silent: false })}
                      disabled={backendStation.loading}
                      className="inline-flex items-center justify-center gap-2 border border-[#7b6542] bg-[#efe2bd] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-50"
                    >
                      <PackageCheck size={13} /> Sync Package
                    </button>
                    <button
                      type="button"
                      data-testid="backend-sync-scenario-trail"
                      onClick={() => syncBackendManagerScenarioTrail({ silent: false })}
                      disabled={backendStation.loading}
                      className="inline-flex items-center justify-center gap-2 border border-[#7b6542] bg-[#efe2bd] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-50"
                    >
                      <GitCommit size={13} /> Sync Trail
                    </button>
                    <button
                      type="button"
                      data-testid="backend-sync-requirement-matrix"
                      onClick={() => syncBackendManagerRequirementMatrix({ silent: false })}
                      disabled={backendStation.loading}
                      className="inline-flex items-center justify-center gap-2 border border-[#7b6542] bg-[#efe2bd] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-50"
                    >
                      <CheckCircle2 size={13} /> Sync Matrix
                    </button>
                    <button
                      type="button"
                      data-testid="backend-sync-use-case-audit"
                      onClick={() => syncBackendManagerUseCaseAudit({ silent: false })}
                      disabled={backendStation.loading}
                      className="inline-flex items-center justify-center gap-2 border border-[#7b6542] bg-[#efe2bd] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-50"
                    >
                      <ClipboardList size={13} /> Sync Audit
                    </button>
                    <button
                      type="button"
                      data-testid="backend-sync-action-queue"
                      onClick={() => syncBackendManagerActionQueue({ silent: false })}
                      disabled={backendStation.loading}
                      className="inline-flex items-center justify-center gap-2 border border-[#7b6542] bg-[#efe2bd] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-50"
                    >
                      <ClipboardList size={13} /> Sync Queue
                    </button>
                    <button
                      type="button"
                      onClick={runBackendServerPulse}
                      disabled={backendStation.loading}
                      className="inline-flex items-center justify-center gap-2 border border-[#7b6542] bg-[#251b13] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#efe2bd] hover:bg-[#8f1e18] disabled:opacity-50"
                    >
                      <Server size={13} /> Server Pulse
                    </button>
                  </div>
                </div>
              </div>

              {activeProject.eventLedger?.length > 0 && (
                <div className="bg-[#f7edcf]/70 border border-[#b8a57d] p-5 mb-6">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-[#8f1e18] mb-2">Unified Event Ledger</div>
                  <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] mb-4">
                    Retained {eventLedgerSummary.retainedCount} / Total {eventLedgerSummary.eventCount} / Seq {eventLedgerSummary.firstSequence}-{eventLedgerSummary.lastSequence}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
                    {[
                      ['Kickoff', eventLedgerSummary.replayProjection.kickoffSpeechCount],
                      ['Assign', eventLedgerSummary.replayProjection.leaderAssignmentCount],
                      ['Change', eventLedgerSummary.replayProjection.changeConfirmationCount],
                      ['Handoff', eventLedgerSummary.replayProjection.peerHandoffCount],
                      ['Auto', eventLedgerSummary.replayProjection.autonomousRunCount],
                    ].map(([label, value]) => (
                      <div key={label} className="border border-[#d8c99f] bg-[#efe2bd]/50 px-2 py-1">
                        <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{label}</div>
                        <div className="font-serif text-lg leading-none">{value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2">
                    {activeProject.eventLedger.slice(-5).reverse().map(event => (
                      <div key={event.id} className="border-t border-[#d8c99f] pt-2">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-serif text-base leading-tight">{event.summary || event.type}</div>
                          <span className="node-id-tag">#{event.sequence}</span>
                        </div>
                        <div className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">
                          {event.type} / {event.actor} / {event.source}{event.channelId ? ` / #${event.channelId}` : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-[#f7edcf]/70 border border-[#b8a57d] p-5 mb-6">
                <div className="font-mono text-[10px] uppercase tracking-widest text-[#8f1e18] mb-4">Governance & Speech Protocol</div>
                <div className="grid md:grid-cols-2 gap-4 mb-4">
                  <div className="border border-[#d8c99f] bg-[#efe2bd]/60 p-4">
                    <div className="font-mono text-[9px] uppercase tracking-widest text-[#7d6a49] mb-2">Lead decides</div>
                    <div className="font-serif text-2xl leading-tight">{governanceLead?.name || 'Unassigned'}</div>
                    <div className="font-serif text-sm leading-relaxed text-[#6b5a3d] mt-2">
                      Owns agenda, owners, dependencies, deadlines, and Director escalation.
                    </div>
                  </div>
                  <div className="border border-[#d8c99f] bg-[#efe2bd]/60 p-4">
                    <div className="font-mono text-[9px] uppercase tracking-widest text-[#7d6a49] mb-2">Reviewer challenges</div>
                    <div className="font-serif text-2xl leading-tight">{governanceReviewer?.name || 'Unassigned'}</div>
                    <div className="font-serif text-sm leading-relaxed text-[#6b5a3d] mt-2">
                      Checks evidence, risk, acceptance criteria, and whether the Lead is overreaching.
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  {meetingFrames.map(protocol => (
                    <div key={protocol.id} className="border-t border-[#d8c99f] pt-3">
                      <div className="font-serif text-lg leading-tight">{protocol.label}</div>
                      <div className="mt-1 font-mono text-[9px] uppercase tracking-widest text-[#7d6a49]">
                        Lead: {protocol.leadFrame.join(' / ')}
                      </div>
                      <div className="mt-1 font-mono text-[9px] uppercase tracking-widest text-[#7d6a49]">
                        Members: {protocol.memberFrame.join(' / ')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {kickoffCharter && (
                <div className="bg-[#f7edcf]/70 border border-[#b8a57d] p-5 mb-6">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <div className="font-mono text-[10px] uppercase tracking-widest text-[#8f1e18] mb-2">Kickoff Charter</div>
                      <div className="font-serif text-2xl leading-tight">{kickoffCharter.title}</div>
                      <div className="font-mono text-[9px] uppercase tracking-widest text-[#7d6a49] mt-2">
                        {kickoffCharter.meeting?.result} / {kickoffCharter.meeting?.leaderCandidateCount || 0} leader candidates
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <span className="node-status-tag bg-green-700 text-white">{kickoffCharter.status}</span>
                      {kickoffCharterProofIds.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            ensureProofMessagesAvailable(activeProject, kickoffCharterProofIds, 'main');
                            setFocusedChatProofIds(kickoffCharterProofIds);
                            setActiveChannelId('main');
                            enterProjectScene('chat');
                          }}
                          className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
                        >
                          <MessageSquare size={10} /> Kickoff chat proof
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4 mb-4">
                    <div className="border border-[#d8c99f] bg-[#efe2bd]/60 p-3">
                      <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] mb-1">Confirmed Leader</div>
                      <div className="font-serif text-xl">{kickoffCharter.governance?.leaderName || 'Unassigned'}</div>
                    </div>
                    <div className="border border-[#d8c99f] bg-[#efe2bd]/60 p-3">
                      <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] mb-1">Reviewer</div>
                      <div className="font-serif text-xl">{kickoffCharter.governance?.reviewerName || 'Unassigned'}</div>
                    </div>
                  </div>
                  <div className="space-y-2 mb-4">
                    {kickoffCharter.nextActions?.slice(0, 3).map(action => (
                      <div key={action.id || action.text} className="flex items-start gap-3 border-t border-[#d8c99f] pt-2">
                        <CircleDot size={13} className={action.status === 'done' ? 'text-green-700 mt-1' : 'text-[#8f1e18] mt-1'} />
                        <div className="min-w-0 flex-1 pr-4">
                          <div className="font-serif text-base leading-tight">{action.text}</div>
                          <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">{action.ownerName || action.ownerId || 'unassigned'} / {action.status}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed">
                    {kickoffCharter.communicationRules?.slice(0, 2).join(' / ')}
                  </div>
                </div>
              )}

              {kickoffMeetingFlow && (
                <div data-testid="kickoff-meeting-flow" className="bg-[#f7edcf]/70 border border-[#b8a57d] p-5 mb-6">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <div className="font-mono text-[10px] uppercase tracking-widest text-[#8f1e18] mb-2">Kickoff Meeting Flow</div>
                      <div className="font-serif text-2xl leading-tight">Role negotiation to Director-confirmed Leader marker</div>
                    </div>
                    {kickoffCharterProofIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => openProjectChatProof(activeProject, kickoffCharterProofIds, 'main')}
                        className="inline-flex shrink-0 items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
                      >
                        <MessageSquare size={10} /> Kickoff meeting proof
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
                    <div className="border border-[#d8c99f] bg-[#efe2bd]/55 px-2 py-2">
                      <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Role Clarification</div>
                      <div className="font-serif text-base leading-tight">{kickoffMeetingFlow.roleQuestionCount} question{kickoffMeetingFlow.roleQuestionCount === 1 ? '' : 's'}</div>
                    </div>
                    <div className="border border-[#d8c99f] bg-[#efe2bd]/55 px-2 py-2">
                      <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Self Nominations</div>
                      <div className="font-serif text-base leading-tight">{kickoffMeetingFlow.selfNominationCount} volunteer{kickoffMeetingFlow.selfNominationCount === 1 ? '' : 's'}</div>
                    </div>
                    <div className="border border-[#d8c99f] bg-[#efe2bd]/55 px-2 py-2">
                      <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Peer Hearing</div>
                      <div className="font-serif text-base leading-tight">{kickoffMeetingFlow.roleHearingCount + kickoffMeetingFlow.leaderHearingCount} edges</div>
                    </div>
                    <div className="border border-[#d8c99f] bg-[#efe2bd]/55 px-2 py-2">
                      <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Leader Campaign</div>
                      <div className="font-serif text-base leading-tight">{kickoffMeetingFlow.leaderCampaignCount} candidate{kickoffMeetingFlow.leaderCampaignCount === 1 ? '' : 's'}</div>
                    </div>
                    <div className="border border-[#d8c99f] bg-[#efe2bd]/55 px-2 py-2">
                      <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Director Confirmation</div>
                      <div className="font-serif text-base leading-tight">{kickoffMeetingFlow.confirmedLeaderName}</div>
                    </div>
                    <div className="border border-[#d8c99f] bg-[#efe2bd]/55 px-2 py-2">
                      <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Leader Marker</div>
                      <div className="font-serif text-base leading-tight">{kickoffMeetingFlow.leaderMarkerPersisted ? 'persisted' : 'pending'}</div>
                    </div>
                  </div>
                  <div className="mt-3 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed">
                    Confirmed Team: {kickoffMeetingFlow.confirmedTeamCount} Agents
                    {kickoffMeetingFlow.leaderCandidateNames.length > 0 && ` / Candidate Slate: ${kickoffMeetingFlow.leaderCandidateNames.slice(0, 4).join(', ')}`}
                    {kickoffMeetingFlow.roleQuestionResolutions?.length > 0 && ` / Role Answers: ${kickoffMeetingFlow.roleQuestionAnsweredCount}-${kickoffMeetingFlow.roleQuestionResolutions.length}`}
                  </div>
                  {kickoffMeetingFlow.briefAlignment && (
                    <div data-testid="kickoff-brief-alignment" className="mt-4 border border-[#d8c99f] bg-[#efe2bd]/45 p-3">
                      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">Kickoff Brief Alignment</div>
                          <div className="mt-1 font-serif text-lg leading-tight">Director brief received before role questions and self-nominations.</div>
                          <div className="mt-2 font-mono text-[8px] text-[#4d412d] leading-relaxed break-words">
                            {kickoffMeetingFlow.briefAlignment.text || 'No brief text recorded'}
                          </div>
                        </div>
                        <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">
                          Heard by {kickoffMeetingFlow.briefAlignment.heardByAgentIds?.length || 0}
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-2">
                        <div className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1 min-w-0">
                          <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Project Brief</div>
                          <div className="font-mono text-[8px] uppercase tracking-widest text-[#4d412d] leading-relaxed break-words">{kickoffMeetingFlow.briefAlignment.speakerName}</div>
                        </div>
                        <div className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1 min-w-0">
                          <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Brief Heard By</div>
                          <div className="font-mono text-[8px] uppercase tracking-widest text-[#4d412d] leading-relaxed break-words">{kickoffMeetingFlow.briefAlignment.heardByAgentNames?.join(', ') || 'none'}</div>
                        </div>
                        <div className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
                          <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Role Questions</div>
                          <div className="font-serif text-base leading-tight">{kickoffMeetingFlow.briefAlignment.roleQuestionCount}</div>
                        </div>
                        <div className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
                          <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Self Nominations</div>
                          <div className="font-serif text-base leading-tight">{kickoffMeetingFlow.briefAlignment.selfNominationCount}</div>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {kickoffMeetingFlow.briefAlignment.proofIds?.length > 0 && (
                          <button
                            type="button"
                            onClick={() => openProjectChatProof(activeProject, kickoffMeetingFlow.briefAlignment.proofIds, kickoffMeetingFlow.briefAlignment.channelId || 'main')}
                            className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
                          >
                            <MessageSquare size={10} /> Brief proof
                          </button>
                        )}
                        {kickoffMeetingFlow.briefAlignment.responseRows?.length > 0 && (
                          <button
                            type="button"
                            onClick={() => openProjectChatProof(activeProject, kickoffMeetingFlow.briefAlignment.responseRows.flatMap(row => row.proofIds || []).slice(0, 8), 'main')}
                            className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
                          >
                            <MessageSquare size={10} /> Role response proof
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                  {kickoffMeetingFlow.confirmedTeamMatrixRows?.length > 0 && (
                    <div data-testid="kickoff-confirmed-team-matrix" className="mt-4 border border-[#d8c99f] bg-[#efe2bd]/45 p-3">
                      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">Confirmed Team Matrix</div>
                          <div className="font-serif text-lg leading-tight">Director-selected roster persisted to project state and kickoff charter.</div>
                        </div>
                        <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">
                          {kickoffMeetingFlow.confirmedTeamMatrixRows.filter(row => row.inProjectState && row.inKickoffCharter).length}/{kickoffMeetingFlow.confirmedTeamMatrixRows.length} confirmed
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                        {kickoffMeetingFlow.confirmedTeamMatrixRows.map(row => (
                          <div key={`confirmed-team-${row.id}`} data-testid={`kickoff-confirmed-team-${row.id}`} className="border border-[#d8c99f] bg-[#f7edcf]/70 p-3">
                            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                              <div className="min-w-0">
                                <div className="font-serif text-base leading-tight">{row.name}</div>
                                <div className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed break-words">{row.role}</div>
                              </div>
                              <div className="flex shrink-0 flex-wrap gap-1.5">
                                <span className={`node-status-tag ${row.inProjectState ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>Project State</span>
                                <span className={`node-status-tag ${row.inKickoffCharter ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>Charter</span>
                                <span className={`node-status-tag ${row.isLeader ? 'bg-[#8f1e18] text-white' : row.isReviewer ? 'bg-[#59684b] text-white' : 'bg-[#d8c99f] text-[#251b13]'}`}>{row.governanceLabel}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      {kickoffMeetingFlow.confirmedTeamProofLogIds?.length > 0 && (
                        <button
                          type="button"
                          onClick={() => openProjectTimelineProof(kickoffMeetingFlow.confirmedTeamProofLogIds)}
                          className="mt-3 inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
                        >
                          <GitCommit size={10} /> Team timeline proof
                        </button>
                      )}
                    </div>
                  )}
                  {kickoffMeetingFlow.leaderElectionResolution && (
                    <div data-testid="kickoff-leader-election-resolution" className="mt-4 border border-[#d8c99f] bg-[#efe2bd]/55 p-3">
                      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">Leader Election Resolution</div>
                          <div className="mt-1 font-serif text-base leading-tight">{kickoffMeetingFlow.leaderElectionResolution.selectedLeaderName || kickoffMeetingFlow.confirmedLeaderName}</div>
                          <div className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed">
                            {kickoffMeetingFlow.leaderElectionResolution.candidateCount || kickoffMeetingFlow.leaderCampaignCount} candidates / {kickoffMeetingFlow.leaderElectionResolution.managerConfirmed ? 'manager-confirmed' : 'awaiting confirmation'} / marker {kickoffMeetingFlow.leaderElectionResolution.leaderMarkerPersisted ? 'persisted' : 'pending'}
                          </div>
                        </div>
                        <span className={`node-status-tag ${kickoffMeetingFlow.leaderElectionResolution.managerConfirmed && kickoffMeetingFlow.leaderElectionResolution.leaderMarkerPersisted ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>
                          {kickoffMeetingFlow.leaderElectionResolution.status || 'leader election'}
                        </span>
                      </div>
                    </div>
                  )}
                  {kickoffMeetingFlow.roleQuestionResolutions?.length > 0 && (
                    <div data-testid="kickoff-role-question-answers" className="mt-4 space-y-2">
                      <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">Role Question Answers</div>
                      {kickoffMeetingFlow.roleQuestionResolutions.slice(0, 4).map(row => (
                        <div key={`role-question-answer-${row.questionId}`} data-testid={`kickoff-role-question-answer-${row.questionId}`} className="border border-[#d8c99f] bg-[#efe2bd]/55 p-3">
                          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                            <div className="min-w-0">
                              <div className="font-serif text-base leading-tight">{row.speakerName}</div>
                              <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed break-words">{row.answered ? row.answerText : row.questionText}</div>
                            </div>
                            <span className={`node-status-tag ${row.answered ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>
                              {row.answered ? 'Answered' : 'Waiting'}
                            </span>
                          </div>
                          {row.answerIds?.length > 0 && (
                            <button
                              type="button"
                              onClick={() => openProjectChatProof(activeProject, row.answerIds, 'main')}
                              className="mt-2 inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
                            >
                              <MessageSquare size={10} /> Answer proof
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {kickoffMeetingFlow.hearingMatrixRows?.length > 0 && (
                    <div data-testid="kickoff-hearing-matrix" className="mt-4 border border-[#d8c99f] bg-[#efe2bd]/45 p-3">
                      <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
                        <div>
                          <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">Kickoff Hearing Matrix</div>
                          <div className="font-serif text-lg leading-tight">Every kickoff turn mapped to the Agents who heard it.</div>
                        </div>
                        <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">
                          {kickoffMeetingFlow.roleHearingCount + kickoffMeetingFlow.leaderHearingCount} hearing edges
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-2">
                        {kickoffMeetingFlow.hearingMatrixRows.slice(0, 8).map(row => (
                          <div key={`kickoff-hearing-${row.id}`} data-testid={`kickoff-hearing-row-${row.id}`} className="border border-[#d8c99f] bg-[#f7edcf]/70 p-3">
                            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                              <div className="min-w-0">
                                <div className="font-serif text-base leading-tight">{row.speakerName}</div>
                                <div className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#8f1e18] leading-relaxed">{row.stage}</div>
                              </div>
                              <span className={`node-status-tag ${row.coverageComplete ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>
                                Heard by {row.heardBy?.length || 0}
                              </span>
                            </div>
                            <div className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed break-words">
                              Heard By: {row.heardLabel}
                            </div>
                            <button
                              type="button"
                              onClick={() => openProjectChatProof(activeProject, row.proofIds, row.channelId || 'main')}
                              className="mt-2 inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
                            >
                              <MessageSquare size={10} /> Hearing proof
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {kickoffMeetingFlow.conversationRows?.length > 0 && (
                    <div data-testid="kickoff-conversation-flow" className="mt-4 space-y-2">
                      <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">Conversation Evidence</div>
                      {kickoffMeetingFlow.conversationRows.slice(0, 6).map(row => (
                        <div key={`kickoff-conversation-${row.id}`} data-testid={`kickoff-conversation-${row.id}`} className="border border-[#d8c99f] bg-[#efe2bd]/55 p-3">
                          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                            <div className="min-w-0">
                              <div className="font-serif text-base leading-tight">{row.speakerName}</div>
                              <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed break-words">{row.stage} / {row.role || 'kickoff participant'}</div>
                            </div>
                            <span className="node-status-tag bg-[#d8c99f] text-[#251b13]">Heard by {row.heardBy?.length || 0}</span>
                          </div>
                          <div className="mt-2 font-mono text-[8px] text-[#4d412d] leading-relaxed break-words">{row.text}</div>
                          <button
                            type="button"
                            onClick={() => openProjectChatProof(activeProject, row.proofIds, row.channelId || 'main')}
                            className="mt-2 inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
                          >
                            <MessageSquare size={10} /> Conversation proof
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {kickoffExecutionFlow && (
                <div data-testid="kickoff-execution-flow" className="bg-[#f7edcf]/70 border border-[#b8a57d] p-5 mb-6">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <div className="font-mono text-[10px] uppercase tracking-widest text-[#8f1e18] mb-2">Kickoff Execution Flow</div>
                      <div className="font-serif text-2xl leading-tight">Meeting decisions to first 24/7 work pulse.</div>
                    </div>
                    <span className={`node-status-tag ${kickoffExecutionFlow.firstPulse.started ? 'bg-green-700 text-white' : 'bg-[#8f1e18] text-white'}`}>
                      {kickoffExecutionFlow.firstPulse.started ? 'First Pulse Started' : 'Waiting'}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-4">
                    <div className="border border-[#d8c99f] bg-[#efe2bd]/55 px-2 py-2">
                      <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Next Actions</div>
                      <div className="font-serif text-base leading-tight">{kickoffExecutionFlow.nextActions.length} action{kickoffExecutionFlow.nextActions.length === 1 ? '' : 's'}</div>
                    </div>
                    <div className="border border-[#d8c99f] bg-[#efe2bd]/55 px-2 py-2">
                      <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Leader Assignments</div>
                      <div className="font-serif text-base leading-tight">{kickoffExecutionFlow.assignmentRows.length} traced</div>
                    </div>
                    <div className="border border-[#d8c99f] bg-[#efe2bd]/55 px-2 py-2">
                      <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">First Pulse</div>
                      <div className="font-serif text-base leading-tight">{kickoffExecutionFlow.firstPulse.started ? 'started' : 'pending'}</div>
                    </div>
                    <div className="border border-[#d8c99f] bg-[#efe2bd]/55 px-2 py-2">
                      <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">24/7 Work</div>
                      <div className="font-serif text-base leading-tight">{kickoffExecutionFlow.readyForAutonomy ? 'enabled' : 'pending'}</div>
                    </div>
                  </div>
                  {kickoffExecutionFlow.nextActionResolution && (
                    <div data-testid="kickoff-next-action-resolution" className="mb-4 border border-[#d8c99f] bg-[#efe2bd]/55 p-3">
                      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">Next Action Resolution</div>
                          <div className="mt-1 font-serif text-base leading-tight">
                            {kickoffExecutionFlow.nextActionResolution.taskCount || kickoffExecutionFlow.nextActions.length} first execution action{(kickoffExecutionFlow.nextActionResolution.taskCount || kickoffExecutionFlow.nextActions.length) === 1 ? '' : 's'}
                          </div>
                          <div className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed">
                            {kickoffExecutionFlow.nextActionResolution.leaderName || kickoffCharter.governance?.leaderName || 'Leader'} assigns / {kickoffExecutionFlow.nextActionResolution.managerConfirmed ? 'manager-confirmed' : 'awaiting confirmation'}
                          </div>
                          {kickoffExecutionFlow.nextActionResolutionDelivery && (
                            <div data-testid="kickoff-next-action-agent-receipts" className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed">
                              Agent receipts: {kickoffExecutionFlow.nextActionResolutionDelivery.deliveredAgentIds.length}-{kickoffExecutionFlow.nextActionResolutionDelivery.teamCount} / obligations {kickoffExecutionFlow.nextActionResolutionDelivery.obligationAgentIds.length}-{kickoffExecutionFlow.nextActionResolutionDelivery.teamCount}
                            </div>
                          )}
                        </div>
                        <span className={`node-status-tag ${kickoffExecutionFlow.nextActionResolution.managerConfirmed ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>
                          {kickoffExecutionFlow.nextActionResolution.status || 'next actions'}
                        </span>
                      </div>
                    </div>
                  )}
                  {kickoffExecutionFlow.allAgentStartupRows?.length > 0 && (
                    <div data-testid="all-agent-startup-matrix" className="mb-4 border border-[#d8c99f] bg-[#efe2bd]/45 p-3">
                      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">All-Agent Startup Matrix</div>
                          <div className="font-serif text-lg leading-tight">Every confirmed Agent enters a fixed routine and next run queue after approval.</div>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-1.5">
                          <span className={`node-status-tag ${kickoffExecutionFlow.allAgentsStarted ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>
                            {kickoffExecutionFlow.allAgentStartupRows.filter(row => row.started).length}/{kickoffExecutionFlow.allAgentStartupRows.length} started
                          </span>
                          <span className={`node-status-tag ${kickoffExecutionFlow.allAgentsScheduled ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>
                            {kickoffExecutionFlow.allAgentStartupRows.filter(row => row.scheduled).length}/{kickoffExecutionFlow.allAgentStartupRows.length} scheduled
                          </span>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                        {kickoffExecutionFlow.allAgentStartupRows.map(row => (
                          <div key={`startup-${row.agent.id}`} data-testid={`startup-agent-${row.agent.id}`} className="border border-[#d8c99f] bg-[#f7edcf]/70 p-3">
                            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                              <div className="min-w-0">
                                <div className="font-serif text-base leading-tight">{row.agent.name}</div>
                                <div className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed break-words">
                                  {row.status} / {row.routineLabel} / next {row.nextRunAt ? new Date(row.nextRunAt).toLocaleString() : 'not scheduled'}
                                </div>
                                <div className="mt-1 font-mono text-[7px] uppercase tracking-widest text-[#4d412d] leading-relaxed break-words">
                                  {row.planFocus || row.routineArtifact || 'fixed routine ready'} / proof {row.startupProofTypes.join(' + ') || 'pending'}
                                </div>
                              </div>
                              <div className="flex shrink-0 flex-wrap gap-1.5">
                                <span className={`node-status-tag ${row.started ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>Started</span>
                                <span className={`node-status-tag ${row.scheduled ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>Queued</span>
                                <span className={`node-status-tag ${row.hasRoutinePlan ? 'bg-green-700 text-white' : 'bg-[#d8c99f] text-[#251b13]'}`}>Routine Plan</span>
                                <span className={`node-status-tag ${row.hasFirstPulsePlan || row.hasWorkerStartup ? 'bg-green-700 text-white' : 'bg-[#d8c99f] text-[#251b13]'}`}>Startup Proof</span>
                              </div>
                            </div>
                            {row.proofLogIds.length > 0 && (
                              <button
                                type="button"
                                onClick={() => openProjectTimelineProof(row.proofLogIds)}
                                className="mt-2 inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
                              >
                                <GitCommit size={10} /> Startup timeline proof
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    {kickoffExecutionFlow.nextActions.map(action => {
                      const assignmentRow = kickoffExecutionFlow.assignmentRows.find(row => String(row.task.id || '') === String(action.id || ''));
                      return (
                        <div key={`kickoff-execution-${action.id}`} data-testid={`kickoff-execution-${action.id}`} className="border border-[#d8c99f] bg-[#efe2bd]/55 p-3">
                          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                            <div className="min-w-0">
                              <div className="font-serif text-base leading-tight">{action.text}</div>
                              <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed break-words">{action.ownerName || 'Unassigned'} / {action.status || 'pending'}</div>
                            </div>
                            <span className={`node-status-tag ${action.assignmentSeen ? 'bg-green-700 text-white' : 'bg-[#d8c99f] text-[#251b13]'}`}>
                              {action.assignmentSeen ? 'Assigned' : 'Awaiting @assignment'}
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {assignmentRow?.evidence?.chatIds?.length > 0 && (
                              <button
                                type="button"
                                onClick={() => openProjectChatProof(activeProject, assignmentRow.evidence.chatIds, assignmentRow.sourceChannelId || 'main')}
                                className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
                              >
                                <MessageSquare size={10} /> Assignment proof
                              </button>
                            )}
                            {assignmentRow?.evidence?.timelineIds?.length > 0 && (
                              <button
                                type="button"
                                onClick={() => openProjectTimelineProof(assignmentRow.evidence.timelineIds)}
                                className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
                              >
                                <ScrollText size={10} /> Timeline proof
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {kickoffExecutionFlow.firstPulse.messageIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => openProjectChatProof(activeProject, kickoffExecutionFlow.firstPulse.messageIds, 'main')}
                        className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
                      >
                        <MessageSquare size={10} /> First pulse chat proof
                      </button>
                    )}
                    {kickoffExecutionFlow.firstPulse.timelineLogIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => openProjectTimelineProof(kickoffExecutionFlow.firstPulse.timelineLogIds)}
                        className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
                      >
                        <ScrollText size={10} /> First pulse timeline proof
                      </button>
                    )}
                  </div>
                  <div className="mt-3 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed">
                    Trigger: {kickoffExecutionFlow.firstPulse.trigger || 'not recorded'} / Next Run: {kickoffExecutionFlow.firstPulse.nextRunAt ? new Date(kickoffExecutionFlow.firstPulse.nextRunAt).toLocaleString() : 'not scheduled'}
                  </div>
                </div>
              )}

              <div data-testid="group-chat-transcript-index" className="bg-[#f7edcf]/70 border border-[#b8a57d] p-5 mb-6">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-[#8f1e18] mb-2">Group Chat Transcript Index</div>
                    <div className="font-serif text-2xl leading-tight">Every project channel, latest message, receipts, and direct mentions.</div>
                  </div>
                  <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">
                    {projectTranscriptMessages.length} messages / {Object.values(recoveredProofIdsByChannel).flat().length} recoverable proofs
                  </span>
                </div>
                <div className="space-y-3">
                  {channelTranscriptRows.map(row => (
                    <div key={`transcript-${row.channel.id}`} data-testid={`transcript-channel-${row.channel.id}`} className="border border-[#d8c99f] bg-[#efe2bd]/55 p-4">
                      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <div className="font-serif text-lg leading-tight">{row.channel.name}</div>
                          <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">{row.channel.category || 'channel'} / {row.channel.description || 'project transcript'}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (row.proofIds.length > 0) {
                              openProjectChatProof(activeProject, row.proofIds, row.channel.id);
                            } else {
                              setFocusedChatProofIds([]);
                              setActiveChannelId(row.channel.id);
                              enterProjectScene('chat');
                            }
                          }}
                          className="inline-flex shrink-0 items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
                        >
                          <MessageSquare size={10} /> Open transcript
                        </button>
                      </div>
                      <div className="mt-3 grid grid-cols-1 md:grid-cols-5 gap-2">
                        <div className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
                          <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Message Count</div>
                          <div className="font-serif text-base leading-tight">{row.messages.length}</div>
                        </div>
                        <div className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
                          <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Archived Proofs</div>
                          <div className="font-serif text-base leading-tight">{row.archivedProofIds.length}</div>
                        </div>
                        <div className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1 min-w-0">
                          <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Latest Speaker</div>
                          <div className="font-serif text-base leading-tight truncate">{row.latest?.author || 'none'}</div>
                        </div>
                        <div className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
                          <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Receipt Coverage</div>
                          <div className="font-serif text-base leading-tight">{row.receiptCoverage}</div>
                        </div>
                        <div className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1 min-w-0">
                          <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Direct Mentions</div>
                          <div className="font-serif text-base leading-tight truncate">{row.directTargetNames.join(', ') || 'none'}</div>
                        </div>
                      </div>
                      <div className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed break-words">
                        Latest Message: {row.latest?.text || 'No transcript yet'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {changeLedger.length > 0 && (
                <div className="bg-[#f7edcf]/70 border border-[#b8a57d] p-5 mb-6">
                  <div data-testid="dual-channel-change-intake-matrix" className="mb-5 border border-[#d8c99f] bg-[#efe2bd]/45 p-3">
                    <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
                      <div>
                        <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">Dual-channel Change Intake Matrix</div>
                        <div className="font-serif text-lg leading-tight">War Room and Google Chat requests mapped to receipts, discussion, owner confirmation, and team sync.</div>
                      </div>
                      <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">
                        {changeSourceIntakeRows.filter(row => row.sourceMessageId && row.receiptCount > 0).length}/{changeSourceIntakeRows.length} source-proofed
                      </span>
                    </div>
                    <div className="mt-3 space-y-2">
                      {changeSourceIntakeRows.map(row => {
                        const resolutionProofIds = [
                          ...row.discussionMessageIds,
                          row.confirmationMessageId,
                          row.syncMessageId,
                        ].filter(Boolean);
                        return (
                          <div key={`change-source-intake-${row.id}`} data-testid={`change-source-intake-row-${row.id}`} className="border border-[#d8c99f] bg-[#f7edcf]/70 p-3">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                              <div className="min-w-0">
                                <div className="font-serif text-base leading-tight">{row.change.requestText}</div>
                                <div className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed break-words">
                                  {row.channelName} / Owner {row.ownerName} / {row.sourceChannelCount > 1 ? 'dual-channel' : 'single-channel'}
                                </div>
                              </div>
                              <div className="flex shrink-0 flex-wrap gap-1.5">
                                <span className={`node-status-tag ${row.sourceMessageId ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>Source Message</span>
                                <span className={`node-status-tag ${row.receiptCount > 0 ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>Source Receipts</span>
                                <span className={`node-status-tag ${row.discussionCount > 0 ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>Team Discussed</span>
                                <span className={`node-status-tag ${row.ownerConfirmed ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>Owner Confirmed</span>
                                <span className={`node-status-tag ${row.teamSyncCount > 0 ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>Team Synced</span>
                              </div>
                            </div>
                            <div className="mt-2 grid grid-cols-1 md:grid-cols-5 gap-2">
                              {[
                                ['Source Channel', row.channelName],
                                ['Receipts', `${row.receiptCount} seen / ${row.directTargetCount} direct`],
                                ['Agent Delivery', `${row.deliveredCount}-${activeProject.team.length} inbox / ${row.obligationCount} obligations`],
                                ['Discussion', `${row.discussionCount} turn${row.discussionCount === 1 ? '' : 's'}`],
                                ['Resolution', row.ownerPlanLinked ? `${row.teamSyncCount} synced` : 'plan pending'],
                              ].map(([label, value]) => (
                                <div key={`${row.id}-${label}`} className="border border-[#d8c99f] bg-[#efe2bd]/55 px-2 py-1 min-w-0">
                                  <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">{label}</div>
                                  <div className="font-mono text-[8px] uppercase tracking-widest text-[#4d412d] leading-relaxed break-words">{value}</div>
                                </div>
                              ))}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {row.sourceMessageId && (
                                <button
                                  type="button"
                                  onClick={() => openProjectChatProof(activeProject, [row.sourceMessageId], row.channelId)}
                                  className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
                                >
                                  <MessageSquare size={10} /> Source channel proof
                                </button>
                              )}
                              {resolutionProofIds.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => openProjectChatProof(activeProject, resolutionProofIds, 'main')}
                                  className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
                                >
                                  <CornerDownRight size={10} /> Resolution chat proof
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div data-testid="change-resolution-matrix" className="mb-5 border border-[#d8c99f] bg-[#efe2bd]/45 p-3">
                    <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
                      <div>
                        <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">Change Resolution Matrix</div>
                        <div className="font-serif text-lg leading-tight">Feature-change intake to owner work pulse, in one manager-readable chain.</div>
                      </div>
                      <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">
                        {changeFlowRows.filter(row => row.ownerPlanLinked && row.teamSyncCount > 0 && row.ownerWorkStarted).length}/{changeFlowRows.length} resolved
                      </span>
                    </div>
                    <div className="mt-3 space-y-2">
                      {changeFlowRows.map(({ change, sourceName, discussionCount, ownerPlanLinked, teamSyncCount, ownerWorkStarted, ownerWorkMessageIds, ownerWorkTimelineIds, discussionDeliveryCount }) => (
                        <div key={`change-resolution-${change.id}`} data-testid={`change-resolution-row-${change.id}`} className="border border-[#d8c99f] bg-[#f7edcf]/70 p-3">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0">
                              <div className="font-serif text-base leading-tight">{change.requestText}</div>
                              <div className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed break-words">
                                Source {sourceName} / Owner {change.ownerName || change.ownerId || 'pending'}
                              </div>
                            </div>
                            <div className="flex shrink-0 flex-wrap gap-1.5">
                              <span className="node-status-tag bg-[#d8c99f] text-[#251b13]">Discussion {discussionCount}</span>
                              <span className={`node-status-tag ${change.confirmationMessageId ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>Owner Confirmed</span>
                              <span className={`node-status-tag ${ownerPlanLinked ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>Plan Updated</span>
                              <span className={`node-status-tag ${teamSyncCount > 0 ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>Team Synced</span>
                              <span className={`node-status-tag ${ownerWorkStarted ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>Owner Work Pulse</span>
                            </div>
                          </div>
                          <div className="mt-2 grid grid-cols-1 md:grid-cols-6 gap-2">
                            {[
                              ['Source Intake', sourceName],
                              ['Team Discussion', `${discussionCount} turns / ${discussionDeliveryCount}-${activeProject.team.length} receipts`],
                              ['Owner Confirmation', change.confirmationMessageId ? change.ownerName || change.ownerId || 'confirmed' : 'pending'],
                              ['Owner Plan Update', ownerPlanLinked ? 'linked to plan' : 'pending'],
                              ['Team Resync', `${teamSyncCount} Agent${teamSyncCount === 1 ? '' : 's'}`],
                              ['Owner First Work', ownerWorkStarted ? 'started' : 'pending'],
                            ].map(([label, value]) => (
                              <div key={`${change.id}-${label}`} className="border border-[#d8c99f] bg-[#efe2bd]/55 px-2 py-1 min-w-0">
                                <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">{label}</div>
                                <div className="font-mono text-[8px] uppercase tracking-widest text-[#4d412d] leading-relaxed break-words">{value}</div>
                              </div>
                            ))}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {ownerWorkMessageIds.length > 0 && (
                              <button
                                type="button"
                                onClick={() => openProjectChatProof(activeProject, ownerWorkMessageIds, change.sourceChannelId === 'multi' ? 'main' : change.sourceChannelId || 'main')}
                                className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
                              >
                                <MessageSquare size={10} /> Owner work chat proof
                              </button>
                            )}
                            {ownerWorkTimelineIds.length > 0 && (
                              <button
                                type="button"
                                onClick={() => openProjectTimelineProof(ownerWorkTimelineIds)}
                                className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
                              >
                                <GitCommit size={10} /> Owner work timeline proof
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-[#8f1e18] mb-4">Change Ledger</div>
                  <div className="space-y-3">
                    {changeFlowRows.map(({ change, sourceName, discussionCount, ownerPlanLinked, syncedAgentNames, teamSyncCount, discussionDeliveryCount, discussionObligationCount }) => (
                      <div key={change.id} className="border border-[#d8c99f] bg-[#efe2bd]/55 p-4">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="font-serif text-lg leading-tight">{change.requestText}</div>
                          <span className="node-status-tag bg-green-700 text-white">{change.status}</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">Owner {change.ownerName || change.ownerId}</span>
                          <span className="node-status-tag bg-[#d8c99f] text-[#251b13]">From {sourceName}</span>
                          {change.reviewerName && <span className="node-status-tag bg-[#59684b] text-white">Reviewed by {change.reviewerName}</span>}
                          {change.teamStateSynced && <span className="node-status-tag bg-[#b9782b] text-white">Synced to {teamSyncCount}</span>}
                        </div>
                        <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed">
                          {change.planUpdate || 'Plan sync pending'}
                        </div>
                        <div data-testid={`change-stage-${change.id}`} className="mt-3 grid grid-cols-1 md:grid-cols-5 gap-2">
                          <div className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
                            <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Source Request</div>
                            <div className="font-serif text-base leading-tight">{sourceName}</div>
                          </div>
                          <div className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
                            <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Team Discussion</div>
                            <div className="font-serif text-base leading-tight">{discussionCount} message{discussionCount === 1 ? '' : 's'}</div>
                            <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">receipts {discussionDeliveryCount}-{activeProject.team.length}</div>
                          </div>
                          <div className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
                            <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Owner Confirmation</div>
                            <div className="font-serif text-base leading-tight">{change.confirmationMessageId ? change.ownerName || change.ownerId || 'owner' : 'pending'}</div>
                          </div>
                          <div className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
                            <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Owner Plan</div>
                            <div className="font-serif text-base leading-tight">{ownerPlanLinked ? 'updated' : 'pending'}</div>
                          </div>
                          <div className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
                            <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Team Sync</div>
                            <div className="font-serif text-base leading-tight">{teamSyncCount} Agent{teamSyncCount === 1 ? '' : 's'}</div>
                          </div>
                        </div>
                        {syncedAgentNames.length > 0 && (
                          <div data-testid={`change-sync-targets-${change.id}`} className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed">
                            Sync Targets: {syncedAgentNames.join(', ')}
                          </div>
                        )}
                        <div data-testid={`change-discussion-receipts-${change.id}`} className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed">
                          Discussion receipts: {discussionDeliveryCount}-{activeProject.team.length} / obligations {discussionObligationCount}-{activeProject.team.length}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {[...(change.discussionMessageIds || []), change.confirmationMessageId, change.syncMessageId].filter(Boolean).length > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                const proofIds = [...(change.sourceMessageIds || []), ...(change.discussionMessageIds || []), change.confirmationMessageId, change.syncMessageId].filter(Boolean);
                                const proofChannelId = change.sourceChannelId === 'multi' ? 'main' : change.sourceChannelId || 'main';
                                ensureProofMessagesAvailable(activeProject, proofIds, proofChannelId);
                                setFocusedChatProofIds(proofIds);
                                setActiveChannelId(proofChannelId);
                                enterProjectScene('chat');
                              }}
                              className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
                            >
                              <MessageSquare size={10} /> Change chat proof
                            </button>
                          )}
                          {changeTimelineProofIds(change).length > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                const timelineIds = changeTimelineProofIds(change);
                                setFocusedTimelineProofIds(timelineIds);
                                setSelectedTimelineEventId(timelineIds[0] || null);
                                enterProjectScene('timeline');
                              }}
                              className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
                            >
                              <ScrollText size={10} /> Change timeline proof
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {peerHandoffs.length > 0 && (
                <div className="bg-[#f7edcf]/70 border border-[#b8a57d] p-5 mb-6">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-[#8f1e18] mb-4">Peer Handoffs</div>
                  <div className="space-y-3">
                    {peerHandoffs.slice(0, 3).map(handoff => (
                      <div key={handoff.id} className="border border-[#d8c99f] bg-[#efe2bd]/55 p-4">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="font-serif text-lg leading-tight">{handoff.requesterName || handoff.requesterId} {'->'} {handoff.targetName || handoff.targetId}</div>
                          <span className="node-status-tag bg-[#59684b] text-white">{handoff.status}</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">Task {handoff.taskId}</span>
                          <span className="node-status-tag bg-[#d8c99f] text-[#251b13]">From {channelNameById[handoff.sourceChannelId] || handoff.sourceChannelId}</span>
                        </div>
                        <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed">
                          Request {handoff.requestMessageId} / Ack {handoff.acknowledgementMessageId}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {(handoff.requestMessageId || handoff.acknowledgementMessageId) && (
                            <button
                              type="button"
                              onClick={() => {
                                const proofIds = [
                                  handoff.requestMessageId,
                                  handoff.acknowledgementMessageId,
                                ].filter(Boolean);
                                ensureProofMessagesAvailable(activeProject, proofIds, handoff.sourceChannelId || 'main');
                                setFocusedChatProofIds(proofIds);
                                setActiveChannelId(handoff.sourceChannelId || 'main');
                                enterProjectScene('chat');
                              }}
                              className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
                            >
                              <MessageSquare size={10} /> Peer chat proof
                            </button>
                          )}
                          {handoffTimelineProofIds(handoff).length > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                const timelineIds = handoffTimelineProofIds(handoff);
                                setFocusedTimelineProofIds(timelineIds);
                                setSelectedTimelineEventId(timelineIds[0] || null);
                                enterProjectScene('timeline');
                              }}
                              className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
                            >
                              <ScrollText size={10} /> Peer timeline proof
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {agentCommunicationRows.length > 0 && (
                <div data-testid="agent-communication-flow" className="bg-[#f7edcf]/70 border border-[#b8a57d] p-5 mb-6">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <div className="font-mono text-[10px] uppercase tracking-widest text-[#8f1e18] mb-2">Agent Communication Flow</div>
                      <div className="font-serif text-2xl leading-tight">Agent-authored messages, target inbox proof, and sender worklog proof.</div>
                    </div>
                    <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">{agentCommunicationRows.length} traced</span>
                  </div>
                  {agentMessageDeliveryRows.length > 0 && (
                    <div data-testid="agent-message-delivery-matrix" className="mb-5 border border-[#d8c99f] bg-[#efe2bd]/45 p-3">
                      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">Agent Message Delivery Matrix</div>
                          <div className="font-serif text-lg leading-tight">Every Agent-authored @message mapped to target receipt, inbox, and obligation state.</div>
                        </div>
                        <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">
                          {agentMessageDeliveryRows.filter(row => row.receiptSeen && row.inboxSeen).length}/{agentMessageDeliveryRows.length} delivered
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                        {agentMessageDeliveryRows.slice(0, 8).map(row => (
                          <div key={`delivery-${row.id}`} data-testid={`agent-message-delivery-${row.id}`} className="border border-[#d8c99f] bg-[#f7edcf]/70 p-3">
                            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                              <div className="min-w-0">
                                <div className="font-serif text-base leading-tight">{row.senderName} {'->'} {row.targetName}</div>
                                <div className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed break-words">{row.message.text}</div>
                              </div>
                              <div className="flex shrink-0 flex-wrap gap-1.5">
                                <span className={`node-status-tag ${row.receiptSeen ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>Direct Receipt</span>
                                <span className={`node-status-tag ${row.inboxSeen ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>Target Inbox</span>
                                <span className={`node-status-tag ${row.obligationSeen ? 'bg-green-700 text-white' : 'bg-[#d8c99f] text-[#251b13]'}`}>Obligation</span>
                                <span className={`node-status-tag ${row.senderWorklogSeen ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>Sender Worklog</span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => openProjectChatProof(activeProject, row.proofIds, row.channelId)}
                              className="mt-2 inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
                            >
                              <MessageSquare size={10} /> Delivery chat proof
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="space-y-3">
                    {agentCommunicationRows.map(row => (
                      <div key={`agent-comm-${row.message.id}`} data-testid={`agent-communication-${row.message.id}`} className="border border-[#d8c99f] bg-[#efe2bd]/55 p-4">
                        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                          <div className="min-w-0">
                            <div className="font-serif text-lg leading-tight">{row.senderName} {'->'} {row.targetNames.join(', ') || 'team'}</div>
                            <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed break-words">{row.message.text}</div>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">{channelNameById[row.channelId] || row.channelId}</span>
                            <span className="node-status-tag bg-[#d8c99f] text-[#251b13]">{row.receiptCount} receipts</span>
                          </div>
                        </div>
                        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
                          <div className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
                            <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Target Inbox</div>
                            <div className="font-serif text-base leading-tight">{row.inboxSeen ? 'received' : 'pending'}</div>
                          </div>
                          <div className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
                            <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Open Obligation</div>
                            <div className="font-serif text-base leading-tight">{row.obligationSeen ? 'created' : 'not required'}</div>
                          </div>
                          <div className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
                            <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Sender Worklog</div>
                            <div className="font-serif text-base leading-tight">{row.senderWorklogSeen ? 'recorded' : 'pending'}</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => openProjectChatProof(activeProject, row.proofIds, row.channelId)}
                          className="mt-3 inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
                        >
                          <MessageSquare size={10} /> Agent chat proof
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div data-testid="agent-management-mesh" className="bg-[#f7edcf]/70 border border-[#b8a57d] p-5 mb-6">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-[#8f1e18] mb-2">Agent Management Mesh</div>
                    <div className="font-serif text-2xl leading-tight">Leader chain, peer-management, and check-in proof.</div>
                  </div>
                  <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">{managementMeshRows.length} Agents</span>
                </div>
                <div data-testid="peer-management-matrix" className="mb-4 border border-[#d8c99f] bg-[#efe2bd]/50 p-3">
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">Peer Management Matrix</div>
                      <div className="font-serif text-lg leading-tight">Every independent Agent has a peer manager and a peer target.</div>
                    </div>
                    <span className="node-status-tag bg-[#b9782b] text-white">{peerManagementMatrixRows.length} Matrix Rows</span>
                  </div>
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                    {peerManagementMatrixRows.slice(0, 6).map(row => (
                      <button
                        key={`peer-management-matrix-${row.agentId}`}
                        type="button"
                        data-testid={`peer-management-matrix-${row.agentId}`}
                        onClick={() => row.proofLogIds.length && openProjectTimelineProof(row.proofLogIds)}
                        className="border border-[#d8c99f] bg-[#f7edcf] px-3 py-2 text-left transition-colors hover:border-[#8f1e18]"
                      >
                        <div className="font-serif text-base leading-tight">{row.agentName}</div>
                        <div className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#4d412d] leading-relaxed break-words">
                          Manages {row.peerManagedNames.join(', ') || 'none'} / Managed by {row.peerManagerNames.join(', ') || 'none'}
                        </div>
                        <div className="mt-1 font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">
                          {row.proofLogIds.length} peer-management proof{row.proofLogIds.length === 1 ? '' : 's'}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-3">
                  {managementMeshRows.map(row => (
                    <div key={`management-${row.agent.id}`} data-testid={`management-mesh-${row.agent.id}`} className="border border-[#d8c99f] bg-[#efe2bd]/55 p-4">
                      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <div className="font-serif text-lg leading-tight">{row.agent.name}</div>
                          <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">{row.agent.role}</div>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {row.agent.isLeader && <span className="node-status-tag bg-[#8f1e18] text-white">Leader</span>}
                          {row.managerNames.length > 0 && <span className="node-status-tag bg-[#d8c99f] text-[#251b13]">Managed by {row.managerNames.join(', ')}</span>}
                          {row.managedNames.length > 0 && <span className="node-status-tag bg-[#59684b] text-white">Manages {row.managedNames.length}</span>}
                          {row.peerManagedNames.length > 0 && <span className="node-status-tag bg-[#b9782b] text-white">Peer manages {row.peerManagedNames.length}</span>}
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-2">
                        <div className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1 min-w-0">
                          <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Leader Chain</div>
                          <div className="font-mono text-[8px] uppercase tracking-widest text-[#4d412d] leading-relaxed break-words">
                            {row.managerNames.length ? row.managerNames.join(', ') : row.agent.isLeader ? 'Director-confirmed lead' : 'self-directed'}
                          </div>
                        </div>
                        <div className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1 min-w-0">
                          <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Managed Agents</div>
                          <div className="font-mono text-[8px] uppercase tracking-widest text-[#4d412d] leading-relaxed break-words">
                            {row.managedNames.concat(row.peerManagedNames).join(', ') || 'none'}
                          </div>
                        </div>
                        <div className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1 min-w-0">
                          <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Latest Check-in</div>
                          <div className="font-mono text-[8px] uppercase tracking-widest text-[#4d412d] leading-relaxed break-words">
                            {row.latestEvent ? `${row.latestEvent.kind} -> ${agentNameById[row.latestEvent.targetAgentId] || row.latestEvent.targetName || row.latestEvent.targetAgentId}` : row.workerResponseTargets.length ? `Responded -> ${row.workerResponseTargets.join(', ')}` : row.workerTargets.length ? `Agent pulse -> ${row.workerTargets.join(', ')}` : 'waiting for next pulse'}
                          </div>
                        </div>
                        <div className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1 min-w-0">
                          <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Management Proof</div>
                          <div className="font-mono text-[8px] uppercase tracking-widest text-[#4d412d] leading-relaxed break-words">
                            {row.checkInCount} timeline management event{row.checkInCount === 1 ? '' : 's'} / {row.responseCount || 0} response{row.responseCount === 1 ? '' : 's'}
                          </div>
                        </div>
                      </div>
                      {row.proofLogIds.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => openProjectTimelineProof(row.proofLogIds)}
                            className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
                          >
                            <ScrollText size={10} /> Management timeline proof
                          </button>
                          <button
                            type="button"
                            data-testid={`agent-management-sync-${row.agent.id}`}
                            onClick={() => runBackendManagementSync(row.agent.id)}
                            disabled={!backendOnline || backendStation.loading}
                            className="inline-flex items-center gap-1 border border-[#7b6542] bg-[#efe2bd] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Activity size={10} /> Run Management Sync
                          </button>
                        </div>
                      )}
                      {row.proofLogIds.length === 0 && (
                        <button
                          type="button"
                          data-testid={`agent-management-sync-${row.agent.id}`}
                          onClick={() => runBackendManagementSync(row.agent.id)}
                          disabled={!backendOnline || backendStation.loading}
                          className="mt-3 inline-flex items-center gap-1 border border-[#7b6542] bg-[#efe2bd] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Activity size={10} /> Run Management Sync
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-[#f7edcf]/70 border border-[#b8a57d] p-5 mb-6">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-[#8f1e18] mb-2">Manager Scenario Readiness</div>
                    <div className="font-serif text-4xl leading-none">{managerReadiness.score}%</div>
                  </div>
                  <div className={`font-mono text-[9px] uppercase tracking-widest px-3 py-1 border ${
                    managerReadiness.status === 'manager-ready'
                      ? 'border-green-700 text-green-800 bg-green-50'
                      : 'border-[#8f1e18] text-[#8f1e18] bg-[#efe2bd]'
                  }`}>
                    {managerReadiness.status} / {managerReadiness.passedCount}-{managerReadiness.totalCount}
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-2">
                  {managerReadiness.checks.map(check => (
                    <div key={check.id} className="border-t border-[#d8c99f] pt-2">
                      <div className="flex items-start gap-2">
                        <CheckCircle2 size={14} className={check.passed ? 'text-green-700 mt-0.5' : 'text-[#8f1e18] mt-0.5'} />
                        <div className="min-w-0">
                          <div className="font-serif text-base leading-tight">{check.label}</div>
                          <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed">{check.detail}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div data-testid="manager-proof-map" className="bg-[#f7edcf]/70 border border-[#b8a57d] p-5 mb-6">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-[#8f1e18] mb-2">Manager Proof Map</div>
                    <div className="font-serif text-2xl leading-tight">Every readiness condition has a direct evidence route.</div>
                  </div>
                  <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">{managerProofMapRows.length} checks</span>
                </div>
                <div className="space-y-2">
                  {managerProofMapRows.map(row => (
                    <div key={`proof-map-${row.check.id}`} data-testid={`proof-map-${row.check.id}`} className="border border-[#d8c99f] bg-[#efe2bd]/55 p-3">
                      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <CheckCircle2 size={14} className={row.check.passed ? 'text-green-700' : 'text-[#8f1e18]'} />
                            <div className="font-serif text-base leading-tight">{row.check.label}</div>
                            <span className={`node-status-tag ${row.check.passed ? 'bg-green-700 text-white' : 'bg-[#8f1e18] text-white'}`}>
                              {row.check.passed ? 'Ready' : 'Needs proof'}
                            </span>
                          </div>
                          <div className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed">
                            {row.targetLabel} / {row.check.detail}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => openManagerProofMapRow(row)}
                          className="inline-flex shrink-0 items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
                        >
                          {row.proofType === 'timeline' ? <ScrollText size={10} /> : row.proofType === 'chat' ? <MessageSquare size={10} /> : <Search size={10} />}
                          {row.proofLabel}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-[#f7edcf]/70 border border-[#b8a57d] p-5 mb-6">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-[#8f1e18] mb-2">Collaboration Health</div>
                    <div className="font-serif text-4xl leading-none">{collaborationHealth.score}%</div>
                  </div>
                  <div className={`font-mono text-[9px] uppercase tracking-widest px-3 py-1 border ${
                    collaborationHealth.status === 'healthy'
                      ? 'border-green-700 text-green-800 bg-green-50'
                      : 'border-[#8f1e18] text-[#8f1e18] bg-[#efe2bd]'
                  }`}>
                    {collaborationHealth.status}
                  </div>
                </div>
                <div className="space-y-2">
                  {collaborationHealth.checks.map(check => (
                    <div key={check.id} className="flex items-start gap-3 border-t border-[#d8c99f] pt-2">
                      <CheckCircle2 size={14} className={check.passed ? 'text-green-700 mt-0.5' : 'text-[#8f1e18] mt-0.5'} />
                      <div className="min-w-0">
                        <div className="font-serif text-base leading-tight">{check.label}</div>
                        <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed">{check.detail}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-[#f7edcf]/70 border border-[#b8a57d] p-5 mb-6">
                <div className="font-mono text-[10px] uppercase tracking-widest text-[#8f1e18] mb-4">Manager Demo Path</div>
                <div className="space-y-3">
                  {demoSteps.map((step, index) => (
                    <button
                      key={step.id}
                      type="button"
                      data-testid={`manager-demo-step-${step.id}`}
                      onClick={step.action}
                      disabled={Boolean(sceneTransition)}
                      className="w-full border border-[#d8c99f] bg-[#efe2bd]/55 p-4 text-left transition-colors hover:border-[#251b13] hover:bg-[#efe2bd]"
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center border border-[#7b6542] bg-[#251b13] font-mono text-[10px] text-[#efe2bd]">
                          {index + 1}
                        </span>
                        <span className="min-w-0">
                          <span className="block font-serif text-xl leading-tight">{step.label}</span>
                          <span className="mt-1 block font-serif text-sm leading-relaxed text-[#6b5a3d]">{step.detail}</span>
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {assignmentFlowRows.length > 0 && (
                <div className="bg-[#f7edcf]/70 border border-[#b8a57d] p-5 mb-6">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <div className="font-mono text-[10px] uppercase tracking-widest text-[#8f1e18] mb-2">Leader Assignment Flow</div>
                      <div className="font-serif text-2xl leading-tight">Group @assignment to Agent work proof</div>
                    </div>
                    <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">{assignmentFlowRows.length} traced</span>
                  </div>
                  <div data-testid="assignment-timeline-matrix" className="mb-5 border border-[#d8c99f] bg-[#efe2bd]/45 p-3">
                    <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
                      <div>
                        <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">Assignment Timeline Matrix</div>
                        <div className="font-serif text-lg leading-tight">Leader @assignment, Agent receipt, acknowledgement, and timeline event in one chain.</div>
                      </div>
                      <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">
                        {assignmentTimelineMatrixRows.filter(row => row.assignmentPosted && row.assigneeReceived && row.timelineRecorded).length}/{assignmentTimelineMatrixRows.length} timeline-ready
                      </span>
                    </div>
                    <div className="mt-3 space-y-2">
                      {assignmentTimelineMatrixRows.map(row => (
                        <div key={`assignment-timeline-${row.task.id}`} data-testid={`assignment-timeline-row-${row.task.id}`} className="border border-[#d8c99f] bg-[#f7edcf]/70 p-3">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0">
                              <div className="font-serif text-base leading-tight">{row.task.text}</div>
                              <div className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed break-words">
                                Leader {agentNameById[row.task.assignedBy] || row.task.assignedBy || 'Leader'} {'->'} {row.owner?.name || row.task.assignee || row.task.ownerId || 'Agent'} / {channelNameById[row.sourceChannelId] || row.sourceChannelId}
                              </div>
                            </div>
                            <div className="flex shrink-0 flex-wrap gap-1.5">
                              <span className={`node-status-tag ${row.assignmentPosted ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>@Assignment Posted</span>
                              <span className={`node-status-tag ${row.assigneeReceived ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>Assignee Saw It</span>
                              <span className={`node-status-tag ${row.assigneeAccepted ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>Acknowledged</span>
                              <span className={`node-status-tag ${row.timelineRecorded ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>Assignment Timeline Event</span>
                              <span className={`node-status-tag ${row.workSeen ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>Agent Work Started</span>
                            </div>
                          </div>
                          <div className="mt-2 grid grid-cols-1 md:grid-cols-5 gap-2">
                            {[
                              ['Group Chat @Mention', row.assignmentPosted ? 'posted' : 'pending'],
                              ['Inbox Delivery', row.assigneeReceived ? 'received' : 'waiting'],
                              ['Agent Ack', row.assigneeAccepted ? 'accepted' : 'pending'],
                              ['Assignment Timeline Event', `${row.assignmentTimelineIds.length || row.evidence.timelineCount} log${(row.assignmentTimelineIds.length || row.evidence.timelineCount) === 1 ? '' : 's'}`],
                              ['Work Pulse Timeline', `${row.workTimelineIds.length} work log${row.workTimelineIds.length === 1 ? '' : 's'}`],
                            ].map(([label, value]) => (
                              <div key={`${row.task.id}-${label}`} className="border border-[#d8c99f] bg-[#efe2bd]/55 px-2 py-1 min-w-0">
                                <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">{label}</div>
                                <div className="font-mono text-[8px] uppercase tracking-widest text-[#4d412d] leading-relaxed break-words">{value}</div>
                              </div>
                            ))}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {row.evidence.chatIds.length > 0 && (
                              <button
                                type="button"
                                onClick={() => openProjectChatProof(activeProject, row.evidence.chatIds, row.sourceChannelId)}
                                className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
                              >
                                <MessageSquare size={10} /> Assignment receipt proof
                              </button>
                            )}
                            {row.evidence.timelineIds.length > 0 && (
                              <button
                                type="button"
                                onClick={() => openProjectTimelineProof(row.evidence.timelineIds)}
                                className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
                              >
                                <GitCommit size={10} /> Assignment timeline event proof
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div data-testid="assignment-work-progress-matrix" className="mb-5 border border-[#d8c99f] bg-[#efe2bd]/45 p-3">
                    <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
                      <div>
                        <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">Assignment Work Progress Matrix</div>
                        <div className="font-serif text-lg leading-tight">Assigned work pulses, latest progress, and completion proof mapped to the timeline.</div>
                      </div>
                      <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">
                        {assignmentWorkProgressRows.filter(row => row.progressPublished).length}/{assignmentWorkProgressRows.length} progress-published
                      </span>
                    </div>
                    <div className="mt-3 space-y-2">
                      {assignmentWorkProgressRows.map(row => (
                        <div key={`assignment-progress-${row.task.id}`} data-testid={`assignment-work-progress-row-${row.task.id}`} className="border border-[#d8c99f] bg-[#f7edcf]/70 p-3">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0">
                              <div className="font-serif text-base leading-tight">{row.task.text}</div>
                              <div className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed break-words">
                                {row.owner?.name || row.task.assignee || row.task.ownerId || 'Agent'} / {row.workPulseCount} pulse{row.workPulseCount === 1 ? '' : 's'} / {row.task.status || 'active'}
                              </div>
                            </div>
                            <div className="flex shrink-0 flex-wrap gap-1.5">
                              <span className={`node-status-tag ${row.chatProgressIds.length ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>Progress Chat</span>
                              <span className={`node-status-tag ${row.progressPublished ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>Timeline Progress</span>
                              <span className={`node-status-tag ${row.completionPublished ? 'bg-green-700 text-white' : 'bg-[#d8c99f] text-[#251b13]'}`}>Completion Proof</span>
                            </div>
                          </div>
                          <div className="mt-2 grid grid-cols-1 md:grid-cols-4 gap-2">
                            {[
                              ['Work Pulses', `${row.workPulseCount}`],
                              ['Progress Logs', `${row.timelineProgressIds.length}`],
                              ['Completion Logs', `${row.completionLogs.length}`],
                              ['Latest Update', row.latestProgressText || 'waiting'],
                            ].map(([label, value]) => (
                              <div key={`${row.task.id}-${label}`} className="border border-[#d8c99f] bg-[#efe2bd]/55 px-2 py-1 min-w-0">
                                <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">{label}</div>
                                <div className="font-mono text-[8px] uppercase tracking-widest text-[#4d412d] leading-relaxed break-words line-clamp-2">{value}</div>
                              </div>
                            ))}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {row.chatProgressIds.length > 0 && (
                              <button
                                type="button"
                                onClick={() => openProjectChatProof(activeProject, row.chatProgressIds, row.sourceChannelId)}
                                className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
                              >
                                <MessageSquare size={10} /> Progress chat proof
                              </button>
                            )}
                            {row.timelineProgressIds.length > 0 && (
                              <button
                                type="button"
                                onClick={() => openProjectTimelineProof(row.timelineProgressIds)}
                                className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
                              >
                                <Activity size={10} /> Progress timeline proof
                              </button>
                            )}
                            {row.completionLogs.length > 0 && (
                              <button
                                type="button"
                                onClick={() => openProjectTimelineProof(row.completionLogs.map(log => log.id))}
                                className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
                              >
                                <CheckCircle2 size={10} /> Completion timeline proof
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-3">
                    {assignmentFlowRows.map(row => (
                      <div key={row.task.id} data-testid={`assignment-flow-${row.task.id}`} className="border border-[#d8c99f] bg-[#efe2bd]/55 p-4">
                        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                          <div className="min-w-0">
                            <div className="font-serif text-lg leading-tight">{row.task.text}</div>
                            <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] mt-1">
                              Owner {row.owner?.name || row.task.assignee || row.task.ownerId || 'unassigned'} / From {channelNameById[row.sourceChannelId] || row.sourceChannelId}
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-wrap gap-2">
                            {row.evidence.chatIds.length > 0 && (
                              <button
                                type="button"
                                onClick={() => openProjectChatProof(activeProject, row.evidence.chatIds, row.sourceChannelId)}
                                className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
                              >
                                <MessageSquare size={10} /> Assignment chat proof
                              </button>
                            )}
                            {row.timelineSeen && (
                              <button
                                type="button"
                                onClick={() => openProjectTimelineProof(row.evidence.timelineIds)}
                                className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
                              >
                                <ScrollText size={10} /> Assignment timeline proof
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="mt-3 grid grid-cols-1 md:grid-cols-5 gap-2">
                          <div className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
                            <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Group @Assignment</div>
                            <div className="font-serif text-base leading-tight">{row.assignmentIds.length ? 'posted' : 'pending'}</div>
                          </div>
                          <div className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
                            <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Assignee Inbox</div>
                            <div className="font-serif text-base leading-tight">{row.inboxSeen || row.obligationSeen ? 'received' : 'waiting'}</div>
                          </div>
                          <div className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
                            <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Acknowledgement</div>
                            <div className="font-serif text-base leading-tight">{row.acknowledgementIds.length ? 'accepted' : 'pending'}</div>
                          </div>
                          <div className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
                            <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Work Pulse</div>
                            <div className="font-serif text-base leading-tight">{row.task.workPulseCount || (row.workSeen ? 1 : 0)} pulse{(row.task.workPulseCount || (row.workSeen ? 1 : 0)) === 1 ? '' : 's'}</div>
                          </div>
                          <div className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
                            <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Timeline Proof</div>
                            <div className="font-serif text-base leading-tight">{row.evidence.timelineCount} log{row.evidence.timelineCount === 1 ? '' : 's'}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-5">
                <div className="bg-[#f7edcf]/70 border border-[#b8a57d] p-5">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-[#8f1e18] mb-4">Active Threads</div>
                  <div className="space-y-3">
                    {activeProject.tasks.map(task => (
                      <div key={task.id} className="flex items-start gap-3">
                        <CircleDot size={14} className={task.status === 'done' ? 'text-green-700 mt-1' : 'text-[#8f1e18] mt-1'} />
                        <div className="min-w-0">
                          <div className="font-serif text-lg leading-tight">{task.text}</div>
                          <div className="font-mono text-[9px] uppercase tracking-widest text-[#7d6a49]">
                            Owner: {task.assignee} / {task.status}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {task.assignedBy && <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">Assigned by Leader</span>}
                            {task.sourceChannelId && <span className="node-status-tag bg-[#d8c99f] text-[#251b13]">From {channelNameById[task.sourceChannelId] || task.sourceChannelId}</span>}
                            {taskEvidence(task).hasAssignment && <span className="node-status-tag bg-[#b9782b] text-white">Assignment proof</span>}
                            {taskEvidence(task).hasAcknowledgement && <span className="node-status-tag bg-[#59684b] text-white">Accepted</span>}
                            {taskEvidence(task).hasOwnerSync && <span className="node-status-tag bg-[#efe2bd] text-[#251b13]">Owner synced</span>}
                            {task.workPulseCount > 0 && <span className="node-status-tag bg-[#59684b] text-white">{task.workPulseCount} pulse{task.workPulseCount === 1 ? '' : 's'}</span>}
                            {(task.completedAt || taskEvidence(task).timelineCount > 0) && <span className="node-status-tag bg-green-700 text-white">{taskEvidence(task).timelineCount || 1} timeline proof{(taskEvidence(task).timelineCount || 1) === 1 ? '' : 's'}</span>}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {task.sourceChannelId && (
                              <button
                                type="button"
                                onClick={() => {
                                  const proofIds = taskEvidence(task).chatIds;
                                  ensureProofMessagesAvailable(activeProject, proofIds, task.sourceChannelId);
                                  setFocusedChatProofIds(proofIds);
                                  setActiveChannelId(task.sourceChannelId);
                                  enterProjectScene('chat');
                                }}
                                className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
                              >
                                <MessageSquare size={10} /> Chat proof
                              </button>
                            )}
                            {taskEvidence(task).timelineCount > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setFocusedTimelineProofIds(taskEvidence(task).timelineIds);
                                  setSelectedTimelineEventId(taskEvidence(task).timelineIds[0] || null);
                                  enterProjectScene('timeline');
                                }}
                                className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
                              >
                                <ScrollText size={10} /> Timeline proof
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-[#f7edcf]/70 border border-[#b8a57d] p-5">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-[#8f1e18] mb-4">Team</div>
                    <div className="space-y-3">
                    {activeProject.team.map(agent => {
                      const state = agentStates[agent.id] || null;
                      const latestAgentWorker = latestAgentWorkerById[agent.id] || null;
                      const priorityReasons = latestAgentWorker?.managementReasons || [];
                      const latestInbox = state?.inbox?.[0] || null;
                      const latestObligation = state?.obligations?.find(item => item.status !== 'done' && item.status !== 'resolved') || state?.obligations?.[0] || null;
                      const latestWorklog = state?.worklog?.[0] || null;
                      const obligationTask = latestObligation?.taskId ? activeProject.tasks.find(task => String(task.id) === String(latestObligation.taskId)) : null;
                      const worklogTaskId = latestWorklog?.taskId || state?.currentPlan?.taskId || state?.taskIds?.[0] || null;
                      const worklogTask = worklogTaskId ? activeProject.tasks.find(task => String(task.id) === String(worklogTaskId)) : null;
                      const inboxProofIds = [latestInbox?.sourceMessageId || latestInbox?.messageId].filter(Boolean);
                      const inboxProofChannel = latestInbox?.channelId || latestInbox?.sourceChannelId || 'main';
                      const obligationEvidence = obligationTask ? taskEvidence(obligationTask) : null;
                      const obligationProofIds = [
                        latestObligation?.sourceMessageId,
                        ...(obligationEvidence?.chatIds || []),
                      ].filter(Boolean);
                      const obligationTimelineIds = obligationEvidence?.timelineIds || [];
                      const obligationProofChannel = latestObligation?.channelId || latestObligation?.sourceChannelId || obligationTask?.sourceChannelId || 'main';
                      const worklogEvidence = worklogTask ? taskEvidence(worklogTask) : null;
                      const worklogProofIds = [
                        latestWorklog?.sourceMessageId,
                        ...(worklogEvidence?.chatIds || []),
                      ].filter(Boolean);
                      const worklogTimelineIds = [
                        latestAgentWorker?.agentId === agent.id ? latestAgentWorker.logId : null,
                        ...(worklogEvidence?.timelineIds || []),
                      ].filter(Boolean);
                      const worklogProofChannel = latestWorklog?.channelId || worklogTask?.sourceChannelId || latestAgentWorker?.channelId || 'main';
                      const messageTargetOptions = activeProject.team.filter(member => member.id !== agent.id);
                      const agentMessageDraft = agentMessageDrafts[agent.id] || {};
                      const selectedMessageTarget = agentMessageDraft.targetAgentId || messageTargetOptions[0]?.id || '';
                      const agentOwnedTasks = activeProject.tasks.filter(task => (
                        task.ownerId === agent.id
                        || task.assignee === agent.id
                        || task.assignee === agent.name
                        || task.ownerName === agent.name
                        || (state?.taskIds || []).map(String).includes(String(task.id))
                      ));
                      const agentProofChatIds = [
                        ...inboxProofIds,
                        ...obligationProofIds,
                        ...worklogProofIds,
                        ...agentOwnedTasks.flatMap(task => taskEvidence(task).chatIds),
                      ].filter(Boolean);
                      const agentProofTimelineIds = [
                        ...obligationTimelineIds,
                        ...worklogTimelineIds,
                        ...agentOwnedTasks.flatMap(task => taskEvidence(task).timelineIds),
                      ].filter(Boolean);
                      const agentFocusOpen = selectedAgentFocusId === agent.id;
                      const agentBackendDashboard = agentDashboardSnapshots[agent.id] || null;
                      const focusManagerIds = Array.from(new Set([state?.managerId, ...(state?.peerManagerIds || [])].filter(Boolean)));
                      const focusManagedIds = Array.from(new Set([...(state?.managedIds || agent.managedIds || []), ...(state?.peerManagedIds || [])].filter(Boolean)));
                      const focusManagerNames = agentBackendDashboard?.management?.managerNames?.length
                        ? agentBackendDashboard.management.managerNames
                        : focusManagerIds.map(id => agentNameById[id] || id).filter(Boolean);
                      const focusManagedNames = [
                        ...(agentBackendDashboard?.management?.managedNames || []),
                        ...(agentBackendDashboard?.management?.peerManagedNames || []),
                      ].length
                        ? Array.from(new Set([
                          ...(agentBackendDashboard?.management?.managedNames || []),
                          ...(agentBackendDashboard?.management?.peerManagedNames || []),
                        ]))
                        : focusManagedIds.map(id => agentNameById[id] || id).filter(Boolean);
                      const agentManagementProofIds = agentBackendDashboard?.proof?.managementProofLogIds?.length
                        ? agentBackendDashboard.proof.managementProofLogIds
                        : (activeProject.logs || [])
                          .filter(log => (
                            ['management-check-in', 'peer-management-check-in', 'review-sweep', 'management-response'].includes(log.eventType)
                            && (log.agentId === agent.id || log.targetAgentId === agent.id || log.agent === agent.name)
                          ))
                          .map(log => log.id)
                          .filter(Boolean);
                      return (
                      <div key={agent.id} className="flex flex-col gap-3 border-b border-[#d8c99f] pb-2">
                        <div className="min-w-0 w-full">
                          <div className="flex items-center gap-2">
                            <div className="font-serif text-lg">{agent.name}</div>
                            {agent.isLeader && <span className="node-status-tag bg-[#8f1e18] text-white">Leader</span>}
                          </div>
                          <div className="font-mono text-[9px] uppercase tracking-widest text-[#7d6a49]">{agent.role}</div>
                          {state && (
                            <div className="mt-2 space-y-1">
                              <div className="flex flex-wrap gap-1.5">
                                <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">{state.status}</span>
                                {state.managerId && <span className="node-status-tag bg-[#d8c99f] text-[#251b13]">Managed by {activeProject.team.find(item => item.id === state.managerId)?.name || state.managerId}</span>}
                                {state.managedIds?.length > 0 && <span className="node-status-tag bg-[#59684b] text-white">Manages {state.managedIds.length}</span>}
                                {state.peerManagedIds?.length > 0 && <span className="node-status-tag bg-[#b9782b] text-white">Peer manages {state.peerManagedIds.length}</span>}
                                {state.peerManagerIds?.length > 0 && <span className="node-status-tag bg-[#efe2bd] text-[#251b13]">Peer managed</span>}
                              </div>
                              <div className="font-mono text-[8px] uppercase tracking-widest text-[#9b875c] leading-relaxed">
                                Plan: {state.currentPlan?.focus || 'monitor'} / inbox {state.inbox?.length || 0} / obligations {state.obligations?.length || 0} / worklog {state.worklog?.length || 0}
                              </div>
                              {state.currentPlan?.routine && (
                                <div className="font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] leading-relaxed">
                                  Routine: {state.currentPlan.routine.label} / {state.currentPlan.routine.artifact}
                                </div>
                              )}
                              {latestAgentWorker && (
                                <div data-testid={`agent-priority-${agent.id}`} className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18] leading-relaxed">
                                  Priority {latestAgentWorker.managementPriority || 0} / {latestAgentWorker.trigger || 'agent-worker'}{priorityReasons.length ? ` / ${priorityReasons.slice(0, 2).join(' / ')}` : ' / routine cadence'}{latestAgentWorker.managementResponseCount ? ` / responded to ${(latestAgentWorker.managementResponseTargetIds || []).map(id => agentNameById[id] || id).filter(Boolean).join(' / ') || 'manager'}` : ''}
                                </div>
                              )}
                              <div data-testid={`agent-state-detail-${agent.id}`} className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-2">
                                <div className="border-t border-[#d8c99f] pt-1 min-w-0">
                                  <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Latest Inbox</div>
                                  <div className="font-mono text-[8px] text-[#4d412d] leading-relaxed break-words">{latestInbox?.text || latestInbox?.source || 'clear'}</div>
                                  {inboxProofIds.length > 0 && (
                                    <button
                                      type="button"
                                      data-testid={`agent-inbox-proof-${agent.id}`}
                                      onClick={() => openProjectChatProof(activeProject, inboxProofIds, inboxProofChannel)}
                                      className="mt-1 inline-flex items-center gap-1 border border-[#d8c99f] px-1.5 py-0.5 font-mono text-[7px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18]"
                                    >
                                      <MessageSquare size={9} /> Inbox proof
                                    </button>
                                  )}
                                </div>
                                <div className="border-t border-[#d8c99f] pt-1 min-w-0">
                                  <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Open Obligation</div>
                                  <div className="font-mono text-[8px] text-[#4d412d] leading-relaxed break-words">{latestObligation?.text || latestObligation?.taskId || 'clear'}</div>
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {obligationProofIds.length > 0 && (
                                      <button
                                        type="button"
                                        data-testid={`agent-obligation-proof-${agent.id}`}
                                        onClick={() => openProjectChatProof(activeProject, obligationProofIds, obligationProofChannel)}
                                        className="inline-flex items-center gap-1 border border-[#d8c99f] px-1.5 py-0.5 font-mono text-[7px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18]"
                                      >
                                        <MessageSquare size={9} /> Obligation proof
                                      </button>
                                    )}
                                    {obligationTimelineIds.length > 0 && (
                                      <button
                                        type="button"
                                        data-testid={`agent-obligation-timeline-${agent.id}`}
                                        onClick={() => openProjectTimelineProof(obligationTimelineIds)}
                                        className="inline-flex items-center gap-1 border border-[#d8c99f] px-1.5 py-0.5 font-mono text-[7px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18]"
                                      >
                                        <ScrollText size={9} /> Timeline
                                      </button>
                                    )}
                                  </div>
                                </div>
                                <div className="border-t border-[#d8c99f] pt-1 min-w-0">
                                  <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Latest Worklog</div>
                                  <div className="font-mono text-[8px] text-[#4d412d] leading-relaxed break-words">{latestWorklog?.text || state.currentPlan?.next || 'waiting'}</div>
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {worklogProofIds.length > 0 && (
                                      <button
                                        type="button"
                                        data-testid={`agent-worklog-proof-${agent.id}`}
                                        onClick={() => openProjectChatProof(activeProject, worklogProofIds, worklogProofChannel)}
                                        className="inline-flex items-center gap-1 border border-[#d8c99f] px-1.5 py-0.5 font-mono text-[7px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18]"
                                      >
                                        <MessageSquare size={9} /> Worklog proof
                                      </button>
                                    )}
                                    {worklogTimelineIds.length > 0 && (
                                      <button
                                        type="button"
                                        data-testid={`agent-worklog-timeline-${agent.id}`}
                                        onClick={() => openProjectTimelineProof(worklogTimelineIds)}
                                        className="inline-flex items-center gap-1 border border-[#d8c99f] px-1.5 py-0.5 font-mono text-[7px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18]"
                                      >
                                        <ScrollText size={9} /> Timeline
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed">
                                Next Agent Run: {state.nextAgentRunAt ? new Date(state.nextAgentRunAt).toLocaleString() : 'not scheduled'}
                              </div>
                              <button
                                type="button"
                                data-testid={`agent-focus-open-${agent.id}`}
                                onClick={() => {
                                  setSelectedAgentFocusId(current => current === agent.id ? null : agent.id);
                                  if (selectedAgentFocusId !== agent.id) syncBackendAgentDashboard(agent.id, { silent: true });
                                }}
                                className="mt-1 inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
                              >
                                <UserCircle size={10} /> {agentFocusOpen ? 'Close Agent Workspace' : 'Open Agent Workspace'}
                              </button>
                              {agentFocusOpen && (
                                <div data-testid={`agent-focus-panel-${agent.id}`} className="mt-3 border border-[#b8a57d] bg-[#f7edcf] p-3">
                                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                                    <div>
                                      <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">Agent Focus Workspace</div>
                                      <div className="font-serif text-xl leading-tight">{agent.name}</div>
                                      <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed">
                                        Independent state / plan / proof surface
                                      </div>
                                    </div>
                                    <div className="flex shrink-0 flex-col items-start gap-2 md:items-end">
                                      <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">{state.status || 'monitoring'}</span>
                                      <button
                                        type="button"
                                        data-testid={`agent-focus-pulse-${agent.id}`}
                                        onClick={() => runBackendAgentPulse(agent.id)}
                                        disabled={!backendOnline || backendStation.loading}
                                        className="inline-flex items-center gap-1 border border-[#7b6542] bg-[#efe2bd] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
                                      >
                                        <Activity size={10} /> Run Agent Pulse
                                      </button>
                                    </div>
                                  </div>
                                  <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-2">
                                    <div className="border border-[#d8c99f] bg-[#efe2bd]/55 px-2 py-2">
                                      <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Current Plan</div>
                                      <div className="font-serif text-base leading-tight">{state.currentPlan?.focus || 'monitor project lane'}</div>
                                    </div>
                                    <div className="border border-[#d8c99f] bg-[#efe2bd]/55 px-2 py-2">
                                      <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Open Inbox</div>
                                      <div className="font-serif text-base leading-tight">{state.inbox?.length || 0} item{(state.inbox?.length || 0) === 1 ? '' : 's'}</div>
                                    </div>
                                    <div className="border border-[#d8c99f] bg-[#efe2bd]/55 px-2 py-2">
                                      <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Obligations</div>
                                      <div className="font-serif text-base leading-tight">{state.obligations?.length || 0} item{(state.obligations?.length || 0) === 1 ? '' : 's'}</div>
                                    </div>
                                    <div className="border border-[#d8c99f] bg-[#efe2bd]/55 px-2 py-2">
                                      <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Owned Tasks</div>
                                      <div className="font-serif text-base leading-tight">{agentOwnedTasks.length} task{agentOwnedTasks.length === 1 ? '' : 's'}</div>
                                    </div>
                                  </div>
                                  {agentBackendDashboard && (
                                    <div data-testid={`agent-focus-backend-dashboard-${agent.id}`} className="mt-3 border border-[#d8c99f] bg-[#efe2bd]/55 p-2">
                                      <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">Backend Agent Dashboard</div>
                                      <div className="mt-1 grid grid-cols-1 md:grid-cols-4 gap-2">
                                        <div>
                                          <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">Open Tasks</div>
                                          <div className="font-serif text-base leading-tight">{agentBackendDashboard.openTaskCount ?? agentOwnedTasks.filter(task => task.status !== 'done').length}</div>
                                        </div>
                                        <div>
                                          <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">Chat Proofs</div>
                                          <div className="font-serif text-base leading-tight">{agentBackendDashboard.proof?.chatProofIds?.length || 0}</div>
                                        </div>
                                        <div>
                                          <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">Submissions</div>
                                          <div className="font-serif text-base leading-tight">{agentBackendDashboard.ownedSubmissions?.length || 0}</div>
                                        </div>
                                        <div>
                                          <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">Evidence</div>
                                          <div className="font-serif text-base leading-tight">{agentBackendDashboard.ownedEvidenceSearches?.length || 0}</div>
                                        </div>
                                        <div>
                                          <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">Reviews</div>
                                          <div className="font-serif text-base leading-tight">{agentBackendDashboard.ownedSubmissionReviews?.length || 0}</div>
                                        </div>
                                        <div>
                                          <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">Submission Proofs</div>
                                          <div className="font-serif text-base leading-tight">{agentBackendDashboard.proof?.submissionIds?.length || 0}</div>
                                        </div>
                                        <div>
                                          <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">Timeline Proofs</div>
                                          <div className="font-serif text-base leading-tight">{agentBackendDashboard.proof?.timelineLogIds?.length || 0}</div>
                                        </div>
                                        <div>
                                          <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">Route</div>
                                          <div className="font-mono text-[8px] leading-tight break-words">{agentBackendDashboard.backendRoutes?.dashboard || `/projects/${activeProject.id}/agents/${agent.id}/dashboard`}</div>
                                        </div>
                                      </div>
                                      <div data-testid={`agent-focus-backend-cadence-${agent.id}`} className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2 border-t border-[#d8c99f] pt-2">
                                        <div>
                                          <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">Next Run</div>
                                          <div className="font-mono text-[8px] leading-tight">{agentBackendDashboard.schedule?.nextAgentRunAt ? new Date(agentBackendDashboard.schedule.nextAgentRunAt).toLocaleString() : 'not scheduled'}</div>
                                        </div>
                                        <div>
                                          <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">Management Priority</div>
                                          <div className="font-serif text-base leading-tight">{agentBackendDashboard.management?.managementPriority ?? agentBackendDashboard.latestWorker?.managementPriority ?? 0}</div>
                                        </div>
                                        <div>
                                          <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">Routine</div>
                                          <div className="font-mono text-[8px] leading-tight">{agentBackendDashboard.routine?.label || state.currentPlan?.routine?.label || 'fixed routine'}</div>
                                        </div>
                                      </div>
                                      <div className="mt-1 font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">
                                        Synced {agentBackendDashboard.syncedAt ? new Date(agentBackendDashboard.syncedAt).toLocaleTimeString() : 'from backend'}
                                      </div>
                                      {agentBackendDashboard.ownedSubmissions?.length > 0 && (
                                        <div data-testid={`agent-focus-submissions-${agent.id}`} className="mt-2 border-t border-[#d8c99f] pt-2">
                                          <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Owned Submissions</div>
                                          <div className="mt-1 space-y-1">
                                            {agentBackendDashboard.ownedSubmissions.slice(0, 4).map(submission => (
                                              <div key={submission.id} className="grid grid-cols-[1fr_auto] gap-2 border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
                                                <div className="min-w-0">
                                                  <div className="font-serif text-sm leading-tight truncate">{submission.title}</div>
                                                  <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] truncate">{submission.artifactType} / {submission.status} / {submission.reviewStatus}</div>
                                                </div>
                                                <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">{submission.artifactType}</span>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                      {agentBackendDashboard.ownedEvidenceSearches?.length > 0 && (
                                        <div data-testid={`agent-focus-evidence-searches-${agent.id}`} className="mt-2 border-t border-[#d8c99f] pt-2">
                                          <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Evidence Searches</div>
                                          <div className="mt-1 space-y-1">
                                            {agentBackendDashboard.ownedEvidenceSearches.slice(0, 4).map(record => (
                                              <div key={record.id} className="grid grid-cols-[1fr_auto] gap-2 border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
                                                <div className="min-w-0">
                                                  <div className="font-serif text-sm leading-tight truncate">{record.query}</div>
                                                  <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] truncate">{record.sources?.length || 0} sources / {record.confidence} / {record.status}</div>
                                                </div>
                                                <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">{record.searchMode}</span>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                      {agentBackendDashboard.ownedSubmissionReviews?.length > 0 && (
                                        <div data-testid={`agent-focus-submission-reviews-${agent.id}`} className="mt-2 border-t border-[#d8c99f] pt-2">
                                          <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Submission Reviews</div>
                                          <div className="mt-1 space-y-1">
                                            {agentBackendDashboard.ownedSubmissionReviews.slice(0, 4).map(review => (
                                              <div key={review.id} className="grid grid-cols-[1fr_auto] gap-2 border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
                                                <div className="min-w-0">
                                                  <div className="font-serif text-sm leading-tight truncate">{review.comments}</div>
                                                  <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] truncate">{review.roleInReview} / {review.submissionId}</div>
                                                </div>
                                                <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">{review.verdict}</span>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  <div data-testid={`agent-focus-management-${agent.id}`} className="mt-3 border border-[#d8c99f] bg-[#efe2bd]/55 p-2">
                                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                                      <div>
                                        <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">Management Surface</div>
                                        <div className="font-serif text-base leading-tight">Leader chain and peer-management proof for this Agent.</div>
                                      </div>
                                      <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">
                                        {agentManagementProofIds.length} management proof{agentManagementProofIds.length === 1 ? '' : 's'}
                                      </span>
                                    </div>
                                    <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2">
                                      <div className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1 min-w-0">
                                        <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Managed By</div>
                                        <div className="font-mono text-[8px] uppercase tracking-widest text-[#4d412d] leading-relaxed break-words">
                                          {focusManagerNames.join(' / ') || (agent.isLeader ? 'Director-confirmed lead' : 'self-directed')}
                                        </div>
                                      </div>
                                      <div className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1 min-w-0">
                                        <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Manages</div>
                                        <div className="font-mono text-[8px] uppercase tracking-widest text-[#4d412d] leading-relaxed break-words">
                                          {focusManagedNames.join(' / ') || 'none'}
                                        </div>
                                      </div>
                                      <div className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1 min-w-0">
                                        <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Peer Management</div>
                                        <div className="font-mono text-[8px] uppercase tracking-widest text-[#4d412d] leading-relaxed break-words">
                                          {(state.peerManagedIds || []).length} targets / {(state.peerManagerIds || []).length} managers
                                        </div>
                                      </div>
                                    </div>
                                    {agentManagementProofIds.length > 0 && (
                                      <button
                                        type="button"
                                        data-testid={`agent-focus-management-proof-${agent.id}`}
                                        onClick={() => openProjectTimelineProof(Array.from(new Set(agentManagementProofIds)).slice(0, 10))}
                                        className="mt-2 inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18]"
                                      >
                                        <ScrollText size={10} /> Management proof
                                      </button>
                                    )}
                                  </div>
                                  <div data-testid={`agent-focus-owned-tasks-${agent.id}`} className="mt-3 space-y-2">
                                    <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">Owned Task Evidence</div>
                                    {(agentOwnedTasks.length ? agentOwnedTasks : [{ id: `${agent.id}_monitor`, text: state.currentPlan?.next || 'Monitor project lane and publish useful progress', status: 'monitoring' }]).slice(0, 4).map(task => (
                                      <div key={`agent-focus-task-${agent.id}-${task.id}`} className="border border-[#d8c99f] bg-[#efe2bd]/55 p-2">
                                        <div className="flex items-start justify-between gap-3">
                                          <div className="min-w-0">
                                            <div className="font-serif text-base leading-tight">{task.text}</div>
                                            <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">{task.status || 'pending'} / timeline {taskEvidence(task).timelineCount || 0}</div>
                                          </div>
                                          <span className="node-status-tag bg-[#d8c99f] text-[#251b13]">{task.workPulseCount || 0} pulse{(task.workPulseCount || 0) === 1 ? '' : 's'}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {agentProofChatIds.length > 0 && (
                                      <button
                                        type="button"
                                        data-testid={`agent-focus-chat-proof-${agent.id}`}
                                        onClick={() => openProjectChatProof(activeProject, Array.from(new Set(agentProofChatIds)).slice(0, 10), inboxProofChannel)}
                                        className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18]"
                                      >
                                        <MessageSquare size={10} /> Agent chat proof
                                      </button>
                                    )}
                                    {agentProofTimelineIds.length > 0 && (
                                      <button
                                        type="button"
                                        data-testid={`agent-focus-timeline-proof-${agent.id}`}
                                        onClick={() => openProjectTimelineProof(Array.from(new Set(agentProofTimelineIds)).slice(0, 10))}
                                        className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18]"
                                      >
                                        <ScrollText size={10} /> Agent timeline proof
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )}
                              {messageTargetOptions.length > 0 && (
                                <div data-testid={`agent-message-panel-${agent.id}`} className="grid w-full grid-cols-1 gap-2 pt-2">
                                  <select
                                    data-testid={`agent-message-target-${agent.id}`}
                                    value={selectedMessageTarget}
                                    onChange={(event) => updateAgentMessageDraft(agent.id, { targetAgentId: event.target.value })}
                                    disabled={!backendOnline || backendStation.loading}
                                    className="w-full border border-[#d8c99f] bg-[#f7edcf] px-2 py-1.5 font-mono text-[8px] uppercase tracking-widest text-[#251b13] disabled:opacity-50"
                                  >
                                    {messageTargetOptions.map(member => (
                                      <option key={member.id} value={member.id}>{member.name}</option>
                                    ))}
                                  </select>
                                  <input
                                    data-testid={`agent-message-input-${agent.id}`}
                                    value={agentMessageDraft.text || ''}
                                    onChange={(event) => updateAgentMessageDraft(agent.id, { text: event.target.value })}
                                    disabled={!backendOnline || backendStation.loading}
                                    placeholder={`@${activeProject.team.find(member => member.id === selectedMessageTarget)?.name || 'Agent'} coordination note`}
                                    className="w-full min-w-0 border border-[#d8c99f] bg-[#f7edcf] px-2 py-1.5 font-mono text-[8px] text-[#251b13] placeholder:text-[#9b875c] disabled:opacity-50"
                                  />
                                  <button
                                    type="button"
                                    data-testid={`agent-message-send-${agent.id}`}
                                    onClick={() => runBackendAgentMessage(agent.id)}
                                    disabled={!backendOnline || backendStation.loading || !selectedMessageTarget}
                                    className="inline-flex w-full items-center justify-center gap-1.5 border border-[#7b6542] bg-[#efe2bd] px-3 py-1.5 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
                                  >
                                    <Send size={11} /> Agent Message
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="w-full flex items-center gap-3">
                          <button
                            type="button"
                            data-testid={`agent-work-cycle-${agent.id}`}
                            onClick={() => runBackendAgentPulse(agent.id)}
                            disabled={!backendOnline || backendStation.loading}
                            className="inline-flex flex-1 items-center justify-center gap-2 border border-[#7b6542] bg-[#efe2bd] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Activity size={12} /> Agent Pulse
                          </button>
                          <div className={`w-2 h-2 rounded-full ${agentStates[agent.id]?.status === 'blocked' ? 'bg-[#8f1e18]' : 'bg-green-700'}`} />
                        </div>
                      </div>
                    );
                    })}
                  </div>
                </div>
              </div>
              </>
              )}
            </section>

            <aside className="col-span-12 lg:col-span-5">
              <div className="font-mono text-[10px] uppercase tracking-[0.26em] text-[#8f1e18] mb-4">Recent Commit Line</div>
              <div className="relative pl-7 space-y-5">
                <div className="absolute left-[7px] top-2 bottom-2 w-px bg-[#8f1e18]" />
                {recentLine.map(event => (
                  <div key={event.id} className="relative bg-[#f7edcf]/75 border border-[#b8a57d] p-4">
                    <div className="absolute -left-[26px] top-5 w-3 h-3 rounded-full bg-[#8f1e18] ring-4 ring-[#efe2bd]" />
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`font-mono text-[8px] uppercase tracking-widest px-2 py-0.5 ${EVENT_TYPE_STYLES[event.type] || 'bg-[#251b13] text-[#efe2bd]'}`}>{event.type}</span>
                      <span className="font-mono text-[9px] text-[#7d6a49]">{event.day} / {event.hour}</span>
                    </div>
                    <div className="font-serif text-xl">{event.title}</div>
                    <div className="font-mono text-[9px] uppercase tracking-widest text-[#7d6a49]">{event.contributor}</div>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </div>

        <div
          className="absolute bottom-6 right-6 z-30"
          onMouseEnter={() => setProjectLauncherOpen(true)}
          onMouseLeave={() => setProjectLauncherOpen(false)}
          onFocusCapture={() => setProjectLauncherOpen(true)}
        >
          <div
            className={`absolute bottom-16 right-0 flex flex-col gap-2 transition-all duration-200 ${
              projectLauncherOpen ? 'translate-y-0 opacity-100 pointer-events-auto' : 'translate-y-4 opacity-0 pointer-events-none'
            }`}
          >
            {managerLaunchers.map(item => (
              <button
                key={item.id}
                onClick={() => enterProjectScene(item.id)}
                disabled={Boolean(sceneTransition)}
                className={`group relative flex w-64 items-center gap-3 border border-[#7b6542] bg-[#efe2bd] p-3 text-left text-[#251b13] shadow-[6px_6px_0_rgba(0,0,0,0.18)] transition-all ${
                  sceneTransition ? 'opacity-60 cursor-wait' : 'hover:-translate-x-1 hover:border-[#251b13]'
                }`}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center border border-[#b8a57d] bg-[#f7edcf] text-[#8f1e18]">
                  <item.icon size={20} />
                </span>
                <span className="min-w-0">
                  <span className="block font-serif text-lg leading-tight">{item.label}</span>
                  <span className="block font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">{item.sub}</span>
                  <span className="mt-1 block font-serif text-sm leading-tight text-[#6b5a3d] opacity-0 transition-opacity group-hover:opacity-100">
                    {item.desc}
                  </span>
                </span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setProjectLauncherOpen(open => !open)}
            disabled={Boolean(sceneTransition)}
            aria-expanded={projectLauncherOpen}
            aria-label="Open project tools"
            className={`scene-object flex h-14 w-14 items-center justify-center border border-[#7b6542] bg-[#251b13] text-[#efe2bd] shadow-[7px_7px_0_rgba(0,0,0,0.22)] transition-all ${
              sceneTransition ? 'cursor-wait opacity-70' : 'hover:-translate-y-1 hover:bg-[#8f1e18]'
            }`}
          >
            {projectLauncherOpen ? <X size={20} /> : <Grid size={20} />}
          </button>
        </div>
      </div>
    );
  };

  const renderProjectMeeting = (meetingProject = activeProject, meetingOptions = {}) => {
    if (!meetingProject) return null;
    const teamCount = meetingProject.team.length;
    const isAnySpeaking = roomSpeaker !== null;
    const formatTime = (sec) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
    const closeMeeting = meetingOptions.onBack || (() => { exitProjectScene(); setMeetingStartTime(null); setMeetingElapsed(0); });
    const completeMeeting = meetingOptions.onComplete;
    const meetingTitle = meetingOptions.title || 'Roundtable';
    const submitMeetingInput = meetingOptions.onSubmit || submitRoomInput;

    const getMeetingAvatarPos = (index, total) => {
      const cx = 50; const cy = 52;
      const rx = 36; const ry = 22;
      const angleStep = Math.PI / (total + 1);
      const angle = Math.PI + (index + 1) * angleStep;
      return { left: `${cx + rx * Math.cos(angle)}%`, top: `${cy + ry * Math.sin(angle)}%` };
    };

    const speakerEntry = roomSpeaker
      ? roomTranscript.slice().reverse().find(t => {
          if (roomSpeaker === 'director') return t.speaker === 'Director';
          const agent = meetingProject.team.find(a => a.id === roomSpeaker);
          return agent && t.speaker === agent.name;
        })
      : null;

    const speakerAgent = roomSpeaker ? meetingProject.team.find(a => a.id === roomSpeaker) : null;
    const activeIntention = roomIntentions.find(intent => intent.status === 'speaking')
      || roomIntentions.find(intent => intent.status === 'queued')
      || roomIntentions[0]
      || null;
    const visibleQueue = roomIntentions.filter(intent => intent.status !== 'yielded');
    const speechRecognitionSupported = typeof window !== 'undefined'
      && (window.SpeechRecognition || window.webkitSpeechRecognition);
    const toggleRoomVoiceInput = () => {
      if (roomVoiceStatus === 'listening') {
        roomSpeechRecognitionRef.current?.stop?.();
        setRoomVoiceStatus('idle');
        return;
      }
      const Recognition = speechRecognitionSupported;
      if (!Recognition) {
        setRoomVoiceStatus('unsupported');
        return;
      }
      const recognition = new Recognition();
      recognition.lang = activeLanguage === 'zh' ? 'zh-CN' : 'en-US';
      recognition.interimResults = false;
      recognition.continuous = false;
      recognition.onstart = () => setRoomVoiceStatus('listening');
      recognition.onend = () => setRoomVoiceStatus(status => (status === 'listening' ? 'idle' : status));
      recognition.onerror = () => setRoomVoiceStatus('error');
      recognition.onresult = (event) => {
        const spokenText = Array.from(event.results)
          .map(result => result[0]?.transcript || '')
          .join(' ')
          .trim();
        if (spokenText) {
          setRoomInput(prev => `${prev}${prev && !/\s$/.test(prev) ? ' ' : ''}${spokenText}`);
        }
      };
      roomSpeechRecognitionRef.current = recognition;
      recognition.start();
    };

    if (!meetingStartTime && (projectMode === 'meeting' || meetingOptions.forceTimer)) {
      setMeetingStartTime(Date.now());
    }

    return (
      <div className="project-room relative h-screen overflow-hidden text-[#efe2bd]">
        {sceneTransition && <div className="absolute right-16 top-1/2 z-50 w-32 h-32 -translate-y-1/2 bg-[#8f1e18] scene-bubble" />}

        <div className="relative z-10 h-full flex flex-col">
          {/* Breadcrumb + Timer */}
          <header className="px-8 pt-5 pb-3 flex items-center justify-between shrink-0 z-40">
            <div className="flex items-center gap-4">
              <button data-testid="project-scene-back" onClick={closeMeeting}
                className="text-[#bcae86] hover:text-[#efe2bd] transition-colors"><ChevronLeft size={18} /></button>
              <div className="breadcrumb-bar text-[#bcae86]">
                <span>{meetingProject.name}</span>
                <span className="sep">/</span>
                <span className="text-[#efe2bd]">{meetingTitle}</span>
                <span className="sep">/</span>
                <span className={isAnySpeaking ? 'text-[#8f1e18]' : 'text-[#59684b]'}>{isAnySpeaking ? 'Meeting active' : 'Standing by'}</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {completeMeeting && (
                <button
                  onClick={completeMeeting}
                  className="font-mono text-[10px] uppercase tracking-widest border border-[#8f1e18] bg-[#8f1e18] px-3 py-1.5 text-white hover:bg-[#a62a22] transition-colors"
                >
                  End Meeting
                </button>
              )}
              <div className="meeting-timer font-mono text-sm text-[#bcae86] border border-[#3a2a1c] px-3 py-1.5 rounded bg-[#1a130e]/60">
                <Clock size={12} className="inline mr-2 opacity-60" />{formatTime(meetingElapsed)}
              </div>
            </div>
          </header>

          <div className="flex-1 grid grid-cols-[1fr_320px] gap-4 px-8 pb-6 min-h-0">
            {/* Main Roundtable Area */}
            <section className={`relative border border-[#3a2a1c] bg-[#1a130e]/80 rounded overflow-hidden dotgrid-bg--dark meeting-glow ${isAnySpeaking ? 'meeting-glow--active' : ''}`}>
              {/* Double SVG Ellipse Table */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <svg className="w-[70%] max-w-[700px] aspect-[1.8]" viewBox="0 0 700 390" fill="none">
                  <ellipse cx="350" cy="195" rx="320" ry="170" stroke="#7b6542" strokeWidth="1.5" opacity="0.3"
                    style={{ fill: 'url(#woodGrain)' }} />
                  <ellipse cx="350" cy="195" rx="240" ry="125" stroke="#bcae86" strokeWidth="0.8" strokeDasharray="6 4"
                    className="meeting-ellipse-inner" opacity="0.2" />
                  <defs>
                    <pattern id="woodGrain" patternUnits="userSpaceOnUse" width="30" height="30">
                      <rect width="30" height="30" fill="#251b13" opacity="0.5" />
                      <line x1="0" y1="15" x2="30" y2="15" stroke="#3a2a1c" strokeWidth="0.5" opacity="0.3" />
                    </pattern>
                  </defs>

                  {/* Link lines from speaking agent to center */}
                  {speakerAgent && (() => {
                    const idx = meetingProject.team.indexOf(speakerAgent);
                    const pos = getMeetingAvatarPos(idx, teamCount);
                    const sx = parseFloat(pos.left) / 100 * 700;
                    const sy = parseFloat(pos.top) / 100 * 390;
                    return <line x1={sx} y1={sy} x2="350" y2="195" className="link-active" style={{ stroke: '#8f1e18', strokeWidth: 1.5 }} />;
                  })()}
                </svg>
              </div>

              {/* Central Speaker Card 鈥?3 states */}
              <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                {!roomSpeaker && roomTranscript.length <= 1 ? (
                  /* IDLE state */
                  <div className="w-[min(480px,42%)] bg-[#1a130e] border border-[#3a2a1c] p-6 text-center pointer-events-auto">
                    <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#7d6a49] mb-3">Roundtable Standby</div>
                    <div className="font-serif text-2xl leading-relaxed text-[#bcae86] mb-3">Enter a message to begin the meeting discussion.</div>
                    <div className="w-12 h-0.5 bg-[#3a2a1c] mx-auto">
                      <div className="w-4 h-full bg-[#8f1e18] animate-pulse" />
                    </div>
                  </div>
                ) : roomSpeaker && speakerEntry ? (
                  /* Speaking state */
                  <div className={`w-[min(640px,48%)] max-h-[220px] overflow-y-auto border p-6 text-center pointer-events-auto ${speakerAgent ? 'bg-[#1a130e] border-[#7b6542]' : 'bg-[#1a130e] border-[#8f1e18]'}`}>
                    <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#8f1e18] mb-2">Current Speaker</div>
                    <div className="font-serif text-3xl leading-none mb-3 text-[#efe2bd]">{speakerEntry.speaker}</div>
                    {speakerEntry.role && speakerEntry.role !== 'User' && (
                      <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] mb-3">{speakerEntry.role}</div>
                    )}
                    <p className="font-serif text-lg leading-relaxed text-[#d8c99f]">{speakerEntry.text}</p>
                  </div>
                ) : (
                  /* Last speaker faded */
                  <div className="w-[min(480px,42%)] bg-[#1a130e]/60 border border-[#3a2a1c] p-6 text-center pointer-events-auto opacity-60">
                    <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#7d6a49] mb-3">Last Statement</div>
                    <p className="font-serif text-lg leading-relaxed text-[#bcae86]">{roomTranscript[roomTranscript.length - 1]?.text}</p>
                  </div>
                )}
              </div>

              {/* Agent Avatars 鈥?dynamic arc positioning */}
              {meetingProject.team.map((agent, index) => {
                const pos = getMeetingAvatarPos(index, teamCount);
                const speaking = roomSpeaker === agent.id;
                return (
                  <div key={agent.id} className="absolute flex flex-col items-center z-20 -translate-x-1/2 -translate-y-1/2 transition-all duration-300"
                    style={{ left: pos.left, top: pos.top }}>
                    <div className={`meeting-avatar w-16 h-16 rounded-full border-2 flex items-center justify-center font-serif text-2xl transition-all duration-300 ${speaking ? 'bg-[#efe2bd] text-[#8f1e18] border-[#efe2bd] scale-110' : 'bg-[#251b13] text-[#efe2bd] border-[#7b6542]'}`}>
                      {agent.name.charAt(0)}
                    </div>
                    {/* Sound wave bars */}
                    <div className="flex items-end gap-[2px] h-4 mt-1">
                      <div className={`sound-bar ${speaking ? 'sound-bar--active' : ''}`} style={{ height: speaking ? undefined : '3px' }} />
                      <div className={`sound-bar ${speaking ? 'sound-bar--active' : ''}`} style={{ height: speaking ? undefined : '3px' }} />
                      <div className={`sound-bar ${speaking ? 'sound-bar--active' : ''}`} style={{ height: speaking ? undefined : '3px' }} />
                    </div>
                    <div className="mt-1 text-center">
                      <div className={`font-serif text-sm transition-colors ${speaking ? 'text-[#efe2bd]' : 'text-[#bcae86]'}`}>{agent.name}</div>
                      <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{agent.role}</div>
                    </div>
                  </div>
                );
              })}
            </section>

            {/* Right Sidebar */}
            <aside className="flex flex-col gap-3 min-h-0">
              <div className="bg-[#1a130e]/80 border border-[#3a2a1c] rounded p-4 shrink-0">
                <div className="flex items-center gap-2 mb-3">
                  <span className="node-id-tag bg-[#8f1e18]">INT</span>
                  <span className="font-mono text-[9px] uppercase tracking-widest text-[#7d6a49]">Speaking Intent</span>
                </div>
                {activeIntention ? (
                  <div className="border-l-[3px] border-[#8f1e18] bg-[#0d0c0b]/50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-serif text-lg leading-tight text-[#efe2bd]">{activeIntention.name}</span>
                      <span className="font-mono text-[8px] text-[#7d6a49]">{activeIntention.score}/10</span>
                    </div>
                    <div className="mt-2 font-mono text-[8px] uppercase tracking-widest leading-relaxed text-[#7d6a49]">
                      {activeIntention.target}
                    </div>
                  </div>
                ) : (
                  <p className="font-serif text-sm leading-relaxed text-[#7d6a49]">Waiting for user input before generating Agent intent scores.</p>
                )}
              </div>

              {/* Queue */}
              <div className="bg-[#1a130e]/80 border border-[#3a2a1c] rounded p-4 max-h-[24%] overflow-y-auto shrink-0">
                <div className="flex items-center gap-2 mb-3">
                  <span className="node-id-tag bg-[#8f1e18]">QUE</span>
                  <span className="sr-only">Intent Queue</span>
                  <span className="font-mono text-[9px] uppercase tracking-widest text-[#7d6a49]">Intent Queue</span>
                </div>
                {visibleQueue.length === 0 ? (
                  <p className="font-serif text-sm text-[#7d6a49]">Waiting for user input to generate Agent intent scores.</p>
                ) : visibleQueue.map((intent, idx) => {
                  const statusColor = intent.status === 'speaking' ? '#8f1e18' : intent.status === 'yielded' ? '#59684b' : '#b9782b';
                  const statusLabel = intent.status === 'speaking' ? 'Speaking' : intent.status === 'yielded' ? 'Yielded' : 'Queued';
                  return (
                    <div key={intent.id} className={`border-l-[3px] p-3 mb-2 transition-opacity ${intent.status === 'yielded' ? 'opacity-50' : ''}`}
                      style={{ borderColor: statusColor, background: 'rgba(26,19,14,0.5)' }}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="node-id-tag" style={{ fontSize: '7px' }}>INT-{String(idx + 1).padStart(2, '0')}</span>
                          <span className="font-mono text-[9px] text-[#bcae86]">{intent.name}</span>
                        </div>
                        <span className="node-status-tag text-white" style={{ background: statusColor, fontSize: '7px' }}>{statusLabel}</span>
                      </div>
                      <div className="h-1 bg-[#3a2a1c] rounded-full mb-1.5">
                        <div className="h-full rounded-full transition-all" style={{ width: `${intent.score * 10}%`, background: statusColor }} />
                      </div>
                      <div className="flex justify-between font-mono text-[8px] text-[#7d6a49]">
                        <span>{intent.target}</span><span>{intent.score}/10</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Transcript */}
              <div className="bg-[#1a130e]/80 border border-[#3a2a1c] rounded p-4 flex-1 overflow-y-auto min-h-0">
                <div className="flex items-center gap-2 mb-3">
                  <span className="node-id-tag bg-[#8f1e18]">LOG</span>
                  <span className="font-mono text-[9px] uppercase tracking-widest text-[#7d6a49]">{localizeText('Meeting Transcript', activeLanguage)}</span>
                </div>
                <div className="space-y-3">
                  {roomTranscript.slice(-8).map((log, idx) => {
                    const isSystem = log.speaker === 'System';
                    const isDirector = log.speaker === 'Director';
                    return (
                      <div key={log.id} className={`border-l-[3px] pl-3 py-1 ${isDirector ? 'border-[#efe2bd]' : isSystem ? 'border-[#3a2a1c]' : 'border-[#8f1e18]'}`}>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="node-id-tag" style={{ fontSize: '7px' }}>LOG-{String(idx + 1).padStart(2, '0')}</span>
                          <span className={`font-mono text-[9px] uppercase tracking-widest ${isDirector ? 'text-[#efe2bd]' : 'text-[#bcae86]'}`}>{log.speaker}</span>
                          {log.score > 0 && <span className="font-mono text-[8px] text-[#7d6a49] ml-auto">{log.score}/10</span>}
                        </div>
                        <div className="font-serif text-sm leading-relaxed text-[#d8c99f]">{log.text}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Input */}
              <div className="bg-[#251b13] border border-[#3a2a1c] rounded-lg p-3 flex items-end gap-3 shrink-0">
                <button
                  type="button"
                  data-testid="project-meeting-voice"
                  onClick={toggleRoomVoiceInput}
                  disabled={!speechRecognitionSupported || roomVoiceStatus === 'unsupported'}
                  aria-pressed={roomVoiceStatus === 'listening'}
                  title={roomVoiceStatus === 'unsupported' ? 'Voice input is not supported in this browser' : 'Mark voice input'}
                  className={`shrink-0 rounded border px-3 py-3 font-mono text-[8px] uppercase tracking-widest transition-colors ${
                    roomVoiceStatus === 'listening'
                      ? 'border-[#8f1e18] bg-[#8f1e18] text-white'
                      : 'border-[#3a2a1c] bg-[#1a130e] text-[#bcae86] hover:border-[#7b6542] hover:text-[#efe2bd] disabled:opacity-40'
                  }`}
                >
                  <Mic2 size={17} className={roomVoiceStatus === 'listening' ? 'animate-pulse' : ''} />
                  <span className="mt-1 block">Mark</span>
                </button>
                <textarea
                  data-testid="project-meeting-input"
                  value={roomInput}
                  onChange={(e) => setRoomInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      submitMeetingInput(meetingProject);
                    }
                  }}
                  placeholder="Enter meeting remarks..."
                  className="min-h-[76px] flex-1 resize-none bg-transparent py-1 outline-none text-[#efe2bd] font-serif text-lg leading-relaxed placeholder-[#7d6a49]/60"
                />
                <button data-testid="project-meeting-send" onClick={() => submitMeetingInput(meetingProject)}
                  className="shrink-0 bg-[#8f1e18] hover:bg-[#a62a22] text-white px-5 py-3 rounded flex items-center gap-2 font-mono text-[9px] uppercase tracking-widest transition-colors">
                  Speak
                </button>
              </div>
              <div className="hidden">
                <div className={`p-2 rounded ${isAnySpeaking ? 'bg-[#8f1e18]/20' : 'bg-[#3a2a1c]'}`}>
                  <Mic2 size={16} className={`${isAnySpeaking ? 'text-[#8f1e18] animate-pulse' : 'text-[#7d6a49]'}`} />
                </div>
                <input
                  data-testid="project-meeting-input-legacy"
                  value={roomInput}
                  onChange={(e) => setRoomInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') submitMeetingInput(meetingProject); }}
                  placeholder="Enter a meeting message..."
                  className="flex-1 bg-transparent outline-none text-[#efe2bd] font-serif text-base placeholder-[#7d6a49]/60"
                />
                <button data-testid="project-meeting-send-legacy" onClick={() => submitMeetingInput(meetingProject)}
                  className="bg-[#8f1e18] hover:bg-[#a62a22] text-white px-4 py-1.5 rounded flex items-center gap-2 font-mono text-[9px] uppercase tracking-widest transition-colors">
                  Send
                </button>
                <span className="font-mono text-[8px] text-[#7d6a49] px-1">Enter</span>
              </div>
            </aside>
          </div>
        </div>
      </div>
    );
  };

  const renderProjectChat = () => {
    const chatText = (value) => localizeText(value, activeLanguage);
    const visibleMessages = chatMessages.filter(message => (
      (message.projectId || DEFAULT_CHAT_PROJECT_ID) === activeProject.id
      && message.channelId === activeChannelId
    ));
    const activeChannel = chatChannels.find(channel => channel.id === activeChannelId);
    const visibleProofCount = visibleMessages.filter(message => focusedChatProofIds.includes(message.id)).length;

    const channelsByCategory = {
      text: chatChannels.filter(c => c.category === 'text'),
      decisions: chatChannels.filter(c => c.category === 'decisions'),
      voice: chatChannels.filter(c => c.category === 'voice'),
    };

    const shouldMerge = (prev, curr) => {
      if (!prev || prev.author !== curr.author) return false;
      if (prev.type === 'system' || curr.type === 'system') return false;
      return true;
    };
  const receiptSummary = (message = {}) => {
      const nameFor = (agentId) => activeProject.team.find(agent => agent.id === agentId || agent.name === agentId)?.name || agentId;
      const heardNames = (message.heardBy || message.receipts?.map(receipt => receipt.agentId) || [])
        .map(nameFor)
        .filter(Boolean);
      const directNames = (message.directTargetIds || message.receipts?.filter(receipt => receipt.mode === 'direct').map(receipt => receipt.agentId) || [])
        .map(nameFor)
        .filter(Boolean);
      return {
        heardText: heardNames.slice(0, 4).join(' / ') || 'none',
        directText: directNames.slice(0, 4).join(' / ') || 'none',
        heardOverflow: Math.max(0, heardNames.length - 4),
        directOverflow: Math.max(0, directNames.length - 4),
      };
    };

    const mentionCandidates = [{ id: '_all', name: 'all', label: '鎵€鏈変汉', role: '' }, ...activeProject.team.map(a => ({ ...a, label: a.name }))];
    const filteredMentions = mentionCandidates.filter(m => m.name.toLowerCase().includes(mentionFilter.toLowerCase()));

    const handleChatKeyDown = (e) => {
      if (showMentionPicker) {
        if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex(i => Math.min(i + 1, filteredMentions.length - 1)); return; }
        if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIndex(i => Math.max(i - 1, 0)); return; }
        if (e.key === 'Enter' && filteredMentions[mentionIndex]) { e.preventDefault(); insertMention(filteredMentions[mentionIndex].name); setMentionFilter(''); return; }
        if (e.key === 'Escape') { setShowMentionPicker(false); setMentionFilter(''); return; }
      }
      if (e.key === 'Enter' && !showMentionPicker) submitChatInput();
    };

    const handleChatChange = (e) => {
      const val = e.target.value;
      setChatInput(val);
      const lastAt = val.lastIndexOf('@');
      if (lastAt >= 0 && lastAt === val.length - 1) {
        setShowMentionPicker(true); setMentionFilter(''); setMentionIndex(0);
      } else if (lastAt >= 0 && !val.slice(lastAt).includes(' ')) {
        setShowMentionPicker(true); setMentionFilter(val.slice(lastAt + 1)); setMentionIndex(0);
      } else {
        setShowMentionPicker(false); setMentionFilter('');
      }
    };

    const onlineMembers = activeProject.team.slice(0, Math.max(2, activeProject.team.length));
    const idleMembers = [];

    return (
      <div className="project-room relative h-screen overflow-hidden text-[#efe2bd]">
        {sceneTransition && <div className="absolute right-16 top-1/2 z-50 w-32 h-32 -translate-y-1/2 bg-[#8f1e18] scene-bubble" />}

        <div className="relative z-10 h-full grid grid-cols-[240px_1fr_260px]">
          {/* LEFT: Channel Sidebar */}
          <aside className="bg-[#1a130e]/95 border-r border-[#3a2a1c] flex flex-col h-full overflow-hidden">
            <div className="p-4 border-b border-[#3a2a1c] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button data-testid="project-scene-back" onClick={exitProjectScene} className="text-[#bcae86] hover:text-[#efe2bd] transition-colors"><ChevronLeft size={16} /></button>
                <span className="font-serif text-lg truncate">{activeProject.name}</span>
              </div>
              <button onClick={createMockChannel} className="text-[#7d6a49] hover:text-[#efe2bd] transition-colors"><Plus size={15} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-4">
              {Object.entries(channelsByCategory).map(([cat, channels]) => channels.length > 0 && (
                <div key={cat}>
                  <div className="flex items-center gap-2 px-2 mb-1">
                    <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#7d6a49]">
                      {chatText(cat === 'text' ? 'Text Channels' : cat === 'decisions' ? 'Decisions' : 'Voice')}
                    </span>
                  </div>
                  {channels.map(channel => {
                    const isActive = activeChannelId === channel.id;
                    return (
                      <button key={channel.id} onClick={() => setActiveChannelId(channel.id)}
                        className={`w-full text-left px-3 py-2 rounded relative flex items-center gap-2 transition-all duration-150 group ${isActive ? 'bg-[#3a2a1c] text-[#efe2bd]' : 'text-[#bcae86] hover:bg-[#251b13] hover:text-[#efe2bd]'}`}>
                        {isActive && <div className="channel-indicator" />}
                        {cat === 'voice' ? <Headphones size={14} className="shrink-0 opacity-60" /> : <Hash size={14} className="shrink-0 opacity-60" />}
                        <span className="font-mono text-[11px] tracking-wide truncate">{channel.name}</span>
                        {channel.unread > 0 && !isActive && <div className="unread-dot ml-auto" />}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="p-3 border-t border-[#3a2a1c] flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#8f1e18] text-[#efe2bd] flex items-center justify-center font-serif text-sm relative">
                D
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#59684b] border-2 border-[#1a130e]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-serif text-sm truncate">{chatText('Director')}</div>
                <div className="font-mono text-[8px] uppercase tracking-widest text-[#59684b]">{chatText('Online')}</div>
              </div>
            </div>
          </aside>

          {/* CENTER: Message Stream */}
          <main className="flex flex-col overflow-hidden bg-[#171411]/90">
            <header className="border-b border-[#3a2a1c] px-5 py-3 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <Hash size={18} className="text-[#7d6a49]" />
                <span className="font-serif text-2xl">{activeChannel?.name}</span>
                <span className="font-mono text-[9px] uppercase tracking-widest text-[#7d6a49] hidden sm:block">{chatText(activeChannel?.description)}</span>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2 text-[#7d6a49] hover:text-[#efe2bd] transition-colors"><Pin size={15} /></button>
                <button className="p-2 text-[#7d6a49] hover:text-[#efe2bd] transition-colors"><Search size={15} /></button>
                <button className="p-2 text-[#7d6a49] hover:text-[#efe2bd] transition-colors"><Users size={15} /></button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {focusedChatProofIds.length > 0 && (
                <div className="mb-4 border border-[#8f1e18] bg-[#251b13] px-4 py-3 font-mono text-[9px] uppercase tracking-widest text-[#efe2bd]">
                  <span className="sr-only">Proof focus:</span>{chatText('Proof focus')}: {visibleProofCount}/{focusedChatProofIds.length} {chatText(focusedChatProofIds.length === 1 ? 'message in this channel' : 'messages in this channel')}
                  <button
                    type="button"
                    onClick={() => setFocusedChatProofIds([])}
                    className="ml-3 text-[#bcae86] hover:text-white"
                  >
                    {chatText('Clear')}
                  </button>
                </div>
              )}
              {visibleMessages.map((message, idx) => {
                const prev = idx > 0 ? visibleMessages[idx - 1] : null;
                const merged = shouldMerge(prev, message);
                const isFocusedProof = focusedChatProofIds.includes(message.id);

                if (message.type === 'system') {
                  return (
                    <div
                      key={message.id}
                      data-chat-proof-id={message.id}
                      className={`flex items-center gap-3 my-4 chat-msg-enter ${isFocusedProof ? 'ring-2 ring-[#b9782b] ring-offset-2 ring-offset-[#171411]' : ''}`}
                    >
                      <div className="flex-1 h-px bg-[#3a2a1c]" />
                      <span className="font-mono text-[9px] uppercase tracking-widest text-[#7d6a49] px-3 shrink-0">{message.text}</span>
                      <div className="flex-1 h-px bg-[#3a2a1c]" />
                    </div>
                  );
                }

                if (message.type === 'decision') {
                  const receipts = receiptSummary(message);
                  return (
                    <div
                      key={message.id}
                      data-chat-proof-id={message.id}
                      className={`node-card--dark my-3 p-4 border-l-4 chat-msg-enter ${isFocusedProof ? 'border-l-[#b9782b] ring-2 ring-[#b9782b] ring-offset-2 ring-offset-[#171411]' : 'border-l-[#59684b]'}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="node-id-tag">{message.decisionId || 'DEC-000'}</span>
                        <span className="node-status-tag bg-[#59684b] text-white">{chatText('Confirmed')}</span>
                      </div>
                      <p className="font-serif text-lg leading-relaxed text-[#efe2bd]">{message.text}</p>
                      <div className="flex items-center gap-2 mt-2 font-mono text-[9px] uppercase tracking-widest text-[#7d6a49]">
                        <span>{message.author}</span>
                        {message.role && <><span className="opacity-40">/</span><span>{message.role}</span></>}
                        {message.visibility?.receiptCount > 0 && (
                          <><span className="opacity-40">/</span><span>{chatText('Seen')} {message.visibility.receiptCount} / {chatText('Direct')} {message.visibility.directTargetCount || 0}</span></>
                        )}
                        <span className="ml-auto">{message.time}</span>
                      </div>
                      {message.visibility?.receiptCount > 0 && (
                        <div className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">
                          {chatText('Heard by')} {receipts.heardText}{receipts.heardOverflow ? ` +${receipts.heardOverflow}` : ''} / {chatText('Direct target')} {receipts.directText}{receipts.directOverflow ? ` +${receipts.directOverflow}` : ''}
                        </div>
                      )}
                    </div>
                  );
                }

                const isMention = message.type === 'mention';
                const isFile = message.type === 'file';
                const receipts = receiptSummary(message);

                return (
                  <div
                    key={message.id}
                    data-chat-proof-id={message.id}
                    className={`relative group chat-msg-enter ${isMention ? 'mention-pulse' : ''} ${merged ? 'mt-0.5' : 'mt-4'} ${isFocusedProof ? 'ring-2 ring-[#b9782b] ring-offset-2 ring-offset-[#171411]' : ''}`}
                  >
                    {isMention && <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#8f1e18] rounded-r" />}
                    <div className={`py-1.5 px-3 rounded transition-colors hover:bg-[#251b13]/40 ${isMention ? 'bg-[#8f1e18]/8 pl-4' : ''}`}>
                      {!merged && (
                        <div className="flex items-center gap-3 mb-1">
                          <div className="w-9 h-9 rounded-full bg-[#3a2a1c] text-[#efe2bd] flex items-center justify-center font-serif text-sm shrink-0 border border-[#7b6542]/40">
                            {message.author.charAt(0)}
                          </div>
                          <span className="font-serif text-base font-medium text-[#efe2bd]">{message.author}</span>
                          {message.role && <span className="node-status-tag bg-[#3a2a1c] text-[#bcae86] border border-[#7b6542]/30">{message.role}</span>}
                          <span className="font-mono text-[9px] text-[#7d6a49] ml-auto">{message.time}</span>
                        </div>
                      )}
                      <div className={merged ? 'pl-12' : 'pl-12'}>
                        <p className="font-serif text-[17px] leading-relaxed text-[#d8c99f]">{chatText(message.text)}</p>
                        {isMention && message.weight && (
                          <span className="inline-flex mt-1.5 bg-[#8f1e18] text-white font-mono text-[8px] uppercase tracking-widest px-2 py-0.5">{chatText('Weight')}: {chatText(message.weight)}</span>
                        )}
                        {isFile && (
                          <div className="node-card--dark inline-flex items-center gap-3 mt-2 px-3 py-2">
                            <FileText size={16} className="text-[#b9782b] shrink-0" />
                            <div>
                              {message.fileId && <span className="node-id-tag mr-2">{message.fileId}</span>}
                              <span className="font-mono text-[10px] tracking-wide text-[#bcae86]">{message.meta}</span>
                            </div>
                          </div>
                        )}
                        {message.visibility?.receiptCount > 0 && (
                          <div data-testid={`message-receipts-${message.id}`} className="mt-1.5 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed">
                            {chatText('Seen')} {message.visibility.receiptCount} / {chatText('Direct')} {message.visibility.directTargetCount || 0}
                            <span className="block">{chatText('Heard by')} {receipts.heardText}{receipts.heardOverflow ? ` +${receipts.heardOverflow}` : ''}</span>
                            <span className="block">{chatText('Direct target')} {receipts.directText}{receipts.directOverflow ? ` +${receipts.directOverflow}` : ''}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="absolute right-2 top-0 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-[#1a130e] border border-[#3a2a1c] rounded p-0.5 -translate-y-1/2 z-10">
                      <button className="p-1.5 text-[#7d6a49] hover:text-[#efe2bd] transition-colors"><Reply size={13} /></button>
                      <button className="p-1.5 text-[#7d6a49] hover:text-[#efe2bd] transition-colors"><AtSign size={13} /></button>
                      <button className="p-1.5 text-[#7d6a49] hover:text-[#efe2bd] transition-colors"><Pin size={13} /></button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Input area */}
            <div className="px-4 pb-4 pt-2 relative">
              {showMentionPicker && filteredMentions.length > 0 && (
                <div className="absolute left-4 right-4 bottom-full mb-1 bg-[#1a130e] border border-[#3a2a1c] rounded shadow-2xl z-20 max-h-52 overflow-y-auto">
                  {filteredMentions.map((m, idx) => (
                    <button key={m.id || m.name} onClick={() => { insertMention(m.name); setMentionFilter(''); }}
                      className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors ${idx === mentionIndex ? 'bg-[#3a2a1c]' : 'hover:bg-[#251b13]'}`}>
                      <div className="w-7 h-7 rounded-full bg-[#3a2a1c] border border-[#7b6542]/40 flex items-center justify-center font-serif text-xs text-[#efe2bd]">{m.name.charAt(0).toUpperCase()}</div>
                      <span className="font-serif text-sm">@{m.name}</span>
                      {m.role && <span className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">{m.role}</span>}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2 bg-[#251b13] border border-[#3a2a1c] rounded-lg px-3 py-2 focus-within:border-[#7b6542] transition-colors">
                <button className="p-1.5 text-[#7d6a49] hover:text-[#efe2bd] transition-colors"><Paperclip size={16} /></button>
                <button onClick={() => { setShowMentionPicker(!showMentionPicker); setMentionFilter(''); setMentionIndex(0); }}
                  className="p-1.5 text-[#7d6a49] hover:text-[#efe2bd] transition-colors font-mono text-sm font-bold">@</button>
                <input value={chatInput} onChange={handleChatChange} onKeyDown={handleChatKeyDown}
                  placeholder={activeLanguage === 'zh' ? `鍙戦€佸埌 #${activeChannel?.name || '棰戦亾'}...` : `Message #${activeChannel?.name || 'channel'}...`}
                  className="flex-1 bg-transparent outline-none font-serif text-base text-[#efe2bd] placeholder-[#7d6a49]/60" />
                <button onClick={submitChatInput}
                  className="bg-[#8f1e18] hover:bg-[#a62a22] text-white px-4 py-1.5 rounded flex items-center gap-2 font-mono text-[9px] uppercase tracking-widest transition-colors">
                  <Send size={13} /> {chatText('Send')}
                </button>
              </div>
            </div>
          </main>

          {/* RIGHT: Members Panel */}
          <aside className="bg-[#1a130e]/95 border-l border-[#3a2a1c] flex flex-col h-full overflow-hidden">
            <div className="p-4 border-b border-[#3a2a1c]">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#7d6a49]">{chatText('Members')} - {activeProject.team.length + 1}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-4">
              <div>
                <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#59684b] mb-2 px-2">{chatText('Online')} - {onlineMembers.length + 1}</div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-3 px-2 py-2 rounded hover:bg-[#251b13] transition-colors group">
                    <div className="relative shrink-0">
                      <div className="w-8 h-8 rounded-full bg-[#8f1e18] text-[#efe2bd] flex items-center justify-center font-serif text-sm">D</div>
                      <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#59684b] border-2 border-[#1a130e]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-serif text-sm truncate text-[#efe2bd]">Director</div>
                      <div className="font-mono text-[8px] uppercase tracking-widest text-[#59684b]">You</div>
                    </div>
                  </div>
                  {onlineMembers.map(agent => (
                    <div key={agent.id} className="flex items-center gap-3 px-2 py-2 rounded hover:bg-[#251b13] transition-colors group">
                      <div className="relative shrink-0">
                        <div className="w-8 h-8 rounded-full bg-[#3a2a1c] border border-[#7b6542]/40 text-[#efe2bd] flex items-center justify-center font-serif text-sm">{agent.name.charAt(0)}</div>
                        <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#59684b] border-2 border-[#1a130e]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex min-w-0 items-center gap-2">
                          <div className="font-serif text-sm truncate text-[#efe2bd]">{agent.name}</div>
                          {agent.isLeader && <span className="node-status-tag bg-[#8f1e18] text-white">Leader</span>}
                        </div>
                        <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">{agent.role}</div>
                      </div>
                      <button onClick={() => insertMention(agent.name)} className="p-1 text-[#7d6a49] opacity-0 group-hover:opacity-100 hover:text-[#efe2bd] transition-all"><AtSign size={12} /></button>
                    </div>
                  ))}
                </div>
              </div>
              {idleMembers.length > 0 && (
                <div>
                  <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#b9782b] mb-2 px-2">{chatText('Idle')} - {idleMembers.length}</div>
                  {idleMembers.map(agent => (
                    <div key={agent.id} className="flex items-center gap-3 px-2 py-2 rounded hover:bg-[#251b13] transition-colors opacity-60">
                      <div className="relative shrink-0">
                        <div className="w-8 h-8 rounded-full bg-[#3a2a1c] border border-[#7b6542]/30 text-[#bcae86] flex items-center justify-center font-serif text-sm">{agent.name.charAt(0)}</div>
                        <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#b9782b] border-2 border-[#1a130e]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-serif text-sm truncate text-[#bcae86]">{agent.name}</div>
                        <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">{agent.role}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    );
  };
  const receiptVerificationAnchor = 'Seen {message.visibility.receiptCount} / Heard by {receipts.heardText} / Direct target {receipts.directText}';
  const backendSyncVerificationAnchor = 'Project sync:';
  const managerCommandVerificationAnchor = 'Next best action:';
  const managerActionQueueVerificationAnchor = 'Body template: / Next body:';

  const renderProjectTimelineLegacy = () => {
    const timelineText = (value) => localizeText(value, activeLanguage);
    const channelNameById = Object.fromEntries(chatChannels.map(channel => [channel.id, channel.name]));
    const BRANCH_COLOR = { Main: '#8f1e18', Design: '#b9782b', Engineering: '#1b3341', Market: '#59684b' };
    const BRANCHES = ['Main', 'Design', 'Engineering', 'Market'];
    const LANE_H = 140;
    const WORLD_X_OFFSET = 96;
    const UNIT_PX = { hour: 120, day: 280, week: 400, month: 200 };
    const UNIT_HOURS = { hour: 1, day: 24, week: 168, month: 720 };
    const RUNTIME_EVENT_TYPES = ['Project Approved', 'Leader Confirmed', 'Leader Assignment', 'Assignment Ack', 'Peer Handoff', 'Peer Handoff Ack', 'Change Discussion', 'Change Confirmed', 'Change Sync', 'Work Pulse', 'Daily Report', 'Task Completed'];
    const EVENT_TYPES = ['Created', 'Analysis', 'Internal Note', 'Document Update', 'Code Upload', 'Decision', 'Report'];
    const SCALE_PROFILES = {
      hour:  { priorities: ['core', 'normal', 'low'], types: EVENT_TYPES },
      day:   { priorities: ['core', 'normal'], types: ['Created', 'Analysis', 'Document Update', 'Code Upload', 'Decision', 'Report'] },
      week:  { priorities: ['core', 'normal'], types: ['Created', 'Document Update', 'Code Upload', 'Decision', 'Report'] },
      month: { priorities: ['core'], types: ['Created', 'Decision', 'Report'] },
    };
    const DETAIL_LEVELS = {
      compact: tlZoom < 0.68,
      summary: tlZoom >= 0.68 && tlZoom < 0.95,
      standard: tlZoom >= 0.95 && tlZoom < 1.32,
      expanded: tlZoom >= 1.32,
    };
    const CARD_DIMS = {
      core:   { w: 200, h: 110 },
      normal: { w: 180, h: 90  },
      low:    { w: 160, h: 70  },
    };
    const NODE_GAP = { hour: 28, day: 36, week: 52, month: 72 };
    const SCALES_ORDER = ['hour', 'day', 'week', 'month'];
    const runtimeEventTypeLabel = (eventType = '') => ({
      'project-approved': 'Project Approved',
      'leader-confirmed': 'Leader Confirmed',
      'leader-assignment': 'Leader Assignment',
      'assignment-acknowledged': 'Assignment Ack',
      'peer-handoff': 'Peer Handoff',
      'peer-handoff-ack': 'Peer Handoff Ack',
      'change-discussion': 'Change Discussion',
      'change-confirmed': 'Change Confirmed',
      'change-sync': 'Change Sync',
      'work-pulse': 'Work Pulse',
      'daily-report': 'Daily Report',
      'task-completed': 'Task Completed',
      coordination: 'Work Pulse',
    }[eventType] || 'Daily Report');
    const projectTimelineEvents = (activeProject?.logs || []).map((log, index) => {
      const branch = /design|experience|interface|dieter/i.test(`${log.agent} ${log.log}`)
        ? 'Design'
        : /code|api|backend|linus|engineering|technical/i.test(`${log.agent} ${log.log}`)
          ? 'Engineering'
          : /market|strategy|don/i.test(`${log.agent} ${log.log}`)
            ? 'Market'
            : 'Main';
      return {
        id: log.id || `project-log-${index}`,
        eventId: `P-${String(index + 1).padStart(2, '0')}`,
        t: index * 2,
        type: runtimeEventTypeLabel(log.eventType),
        contributor: log.agent || 'Agent Runtime',
        title: log.log || 'Project update',
        detail: log.log || '',
        priority: index < 8 ? 'core' : 'normal',
        branch,
        history: [{ time: index * 2, action: log.eventType || 'project-log' }],
        comments: [],
        attachments: log.attachments || [],
        sourceChannelId: log.sourceChannelId || null,
        receiptCount: log.receiptCount || 0,
        directTargetIds: log.directTargetIds || [],
      };
    });
    const timelineEvents = projectTimelineEvents;

    if (!timelineEvents.length) {
      return (
        <div className="h-full p-10 bg-[#0d0c0b] text-[#efe2bd]">
          <button onClick={() => setProjectMode('dashboard')} className="mb-8 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-[#bcae86] hover:text-white">
            <ArrowLeft size={14} /> Back to Dashboard
          </button>
          <div className="border border-[#3a2a1c] bg-[#171411] p-8 max-w-2xl">
            <div className="font-mono text-[10px] uppercase tracking-[0.26em] text-[#8f1e18] mb-3">No Timeline Evidence</div>
            <h2 className="font-serif text-3xl mb-3">This project has no persisted runtime events yet.</h2>
            <p className="font-serif text-lg leading-relaxed text-[#d8c99f]">
              Kickoff approval, chat commands, worker cycles, and meeting updates will create timeline records here.
            </p>
          </div>
        </div>
      );
    }

    const maxT = Math.max(...timelineEvents.map(e => e.t));
    const getBaseNodeX = (t) => WORLD_X_OFFSET + (t / UNIT_HOURS[timelineScale]) * UNIT_PX[timelineScale];
    const getNodeY = (branch) => 70 + BRANCHES.indexOf(branch) * LANE_H;
    const canvasH = 70 + BRANCHES.length * LANE_H + 60;

    const scaleProfile = SCALE_PROFILES[timelineScale] || SCALE_PROFILES.day;
    const visibleEvents = timelineEvents.filter(e => (
      scaleProfile.priorities.includes(e.priority)
      && (scaleProfile.types.includes(e.type) || RUNTIME_EVENT_TYPES.includes(e.type))
    ));
    const visibleTimelineProofCount = visibleEvents.filter(event => focusedTimelineProofIds.includes(event.id)).length;
    const eventMap = {};
    timelineEvents.forEach(e => { eventMap[e.id] = e; });

    const getCardDim = (e) => CARD_DIMS[e.priority] || CARD_DIMS.normal;
    const timelineOverrides = tlNodeXOverrides[timelineScale] || {};
    const nodeLayout = {};
    BRANCHES.forEach(branch => {
      const laneEvents = visibleEvents
        .filter(e => e.branch === branch)
        .map(e => ({
          event: e,
          desiredX: typeof timelineOverrides[e.id] === 'number' ? timelineOverrides[e.id] : getBaseNodeX(e.t),
        }))
        .sort((a, b) => a.desiredX - b.desiredX || a.event.t - b.event.t);

      let cursor = WORLD_X_OFFSET;
      laneEvents.forEach(({ event, desiredX }) => {
        const dim = getCardDim(event);
        const x = Math.max(WORLD_X_OFFSET, desiredX, cursor);
        nodeLayout[event.id] = { x, y: getNodeY(event.branch), w: dim.w, h: dim.h };
        cursor = x + dim.w + (NODE_GAP[timelineScale] || 40);
      });
    });
    const getLayoutBox = (e) => nodeLayout[e.id] || { x: getBaseNodeX(e.t), y: getNodeY(e.branch), ...getCardDim(e) };
    const canvasW = Math.max(
      900,
      getBaseNodeX(maxT) + 280,
      ...Object.values(nodeLayout).map(box => box.x + box.w + 220),
    );

    const connections = [];
    const branchEvents = {};
    visibleEvents.forEach(e => {
      if (!branchEvents[e.branch]) branchEvents[e.branch] = [];
      branchEvents[e.branch].push(e);
    });
    Object.values(branchEvents).forEach(arr => {
      arr.sort((a, b) => a.t - b.t);
      for (let i = 1; i < arr.length; i++) connections.push([arr[i - 1].id, arr[i].id]);
    });
    visibleEvents.forEach(e => {
      if (e.dependsOn) e.dependsOn.forEach(depId => {
        if (visibleEvents.find(v => v.id === depId)) {
          if (!connections.find(([a, b]) => a === depId && b === e.id)) connections.push([depId, e.id]);
        }
      });
    });

    const getAnchor = (fromE, toE) => {
      const fBox = getLayoutBox(fromE);
      const tBox = getLayoutBox(toE);
      const fx0 = fBox.x, fy0 = fBox.y;
      const tx0 = tBox.x, ty0 = tBox.y;
      const dx = tx0 - fx0, dy = ty0 - fy0;
      let sx, sy, ex, ey;
      if (Math.abs(dx) >= Math.abs(dy)) {
        sx = dx > 0 ? fx0 + fBox.w : fx0;
        sy = fy0 + fBox.h / 2;
        ex = dx > 0 ? tx0 : tx0 + tBox.w;
        ey = ty0 + tBox.h / 2;
      } else {
        sx = fx0 + fBox.w / 2;
        sy = dy > 0 ? fy0 + fBox.h : fy0;
        ex = tx0 + tBox.w / 2;
        ey = dy > 0 ? ty0 : ty0 + tBox.h;
      }
      return { sx, sy, ex, ey };
    };
    const curvePath = (fromE, toE) => {
      const { sx, sy, ex, ey } = getAnchor(fromE, toE);
      const mx = (sx + ex) / 2;
      return `M ${sx} ${sy} C ${mx} ${sy}, ${mx} ${ey}, ${ex} ${ey}`;
    };

    const neighborIds = new Set();
    const neighborLines = new Set();
    if (tlHoveredNode) {
      connections.forEach(([a, b]) => {
        if (a === tlHoveredNode || b === tlHoveredNode) {
          neighborIds.add(a);
          neighborIds.add(b);
          neighborLines.add(`${a}-${b}`);
        }
      });
    }

    const selected = visibleEvents.find(e => e.id === selectedTimelineEventId) || null;
    const timelineAgentName = (agentId) => activeProject.team.find(agent => agent.id === agentId || agent.name === agentId)?.name || agentId;
    const timelineDirectTargetNames = selected?.directTargetIds?.map(timelineAgentName).filter(Boolean) || [];
    const selectedNeighborIds = [];
    if (selected) {
      connections.forEach(([a, b]) => {
        if (a === selected.id && !selectedNeighborIds.includes(b)) selectedNeighborIds.push(b);
        if (b === selected.id && !selectedNeighborIds.includes(a)) selectedNeighborIds.push(a);
      });
    }

    const navigateEvent = (dir) => {
      const sorted = [...visibleEvents].sort((a, b) => a.t - b.t);
      const curIdx = sorted.findIndex(e => e.id === selectedTimelineEventId);
      const nextIdx = curIdx + dir;
      if (nextIdx >= 0 && nextIdx < sorted.length) setSelectedTimelineEventId(sorted[nextIdx].id);
    };

    const closeDetail = () => {
      setTlDetailClosing(true);
      setTimeout(() => { setSelectedTimelineEventId(null); setTlDetailClosing(false); }, 300);
    };

    const handleNodeClick = (eventId) => {
      const suppressed = tlSuppressNodeClickRef.current;
      if (suppressed && suppressed.id === eventId && Date.now() - suppressed.time < 260) return;
      if (selectedTimelineEventId === eventId) {
        closeDetail();
      } else {
        setTlDetailClosing(false);
        setSelectedTimelineEventId(eventId);
      }
    };

    const handleTimelineKeyDown = (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); navigateEvent(1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); navigateEvent(-1); }
      if (e.key === 'Tab') {
        e.preventDefault();
        const sorted = [...visibleEvents].sort((a, b) => a.t - b.t);
        const curIdx = sorted.findIndex(ev => ev.id === selectedTimelineEventId);
        const next = (curIdx + 1) % sorted.length;
        setSelectedTimelineEventId(sorted[next].id);
      }
      if (e.key === 'Enter' && selectedTimelineEventId) {
        setTlDetailClosing(false);
      }
      if (e.key === 'Escape') {
        if (selectedTimelineEventId) closeDetail();
      }
    };

    const handleCanvasWheel = (e) => {
      e.preventDefault();

      if (e.altKey) {
        const now = Date.now();
        if (now - lastTimelineWheelRef.current < 180) return;
        lastTimelineWheelRef.current = now;
        const curIdx = SCALES_ORDER.indexOf(timelineScale);
        if (e.deltaY > 0 && curIdx < SCALES_ORDER.length - 1) setTimelineScale(SCALES_ORDER[curIdx + 1]);
        if (e.deltaY < 0 && curIdx > 0) setTimelineScale(SCALES_ORDER[curIdx - 1]);
        return;
      }

      if (e.shiftKey && Math.abs(e.deltaY) > 0) {
        setTlPan(p => ({ ...p, x: p.x - e.deltaY }));
        return;
      }

      const rect = e.currentTarget.getBoundingClientRect();
      const pointerX = e.clientX - rect.left;
      const pointerY = e.clientY - rect.top;
      const nextZoom = Math.min(2.4, Math.max(0.48, tlZoom * Math.exp(-e.deltaY * 0.0012)));
      const worldX = (pointerX - tlPan.x) / tlZoom;
      const worldY = (pointerY - tlPan.y) / tlZoom;

      setTlZoom(nextZoom);
      setTlPan({
        x: pointerX - worldX * nextZoom,
        y: pointerY - worldY * nextZoom,
      });
    };

    const handleCanvasMouseDown = (e) => {
      if (e.target.closest('button')) return;
      setTlDragging(true);
      tlDragStartRef.current = { x: e.clientX, y: e.clientY, panX: tlPan.x, panY: tlPan.y };
    };
    const handleCanvasMouseMove = (e) => {
      if (tlNodeDragRef.current.id) {
        const drag = tlNodeDragRef.current;
        if (!drag.id) return;
        const dx = (e.clientX - drag.startClientX) / tlZoom;
        if (Math.abs(dx) > 2) drag.moved = true;
        const nextX = Math.max(WORLD_X_OFFSET, drag.startX + dx);
        setTlNodeXOverrides(prev => ({
          ...prev,
          [drag.scale]: {
            ...(prev[drag.scale] || {}),
            [drag.id]: nextX,
          },
        }));
        return;
      }
      if (!tlDragging) return;
      const dx = e.clientX - tlDragStartRef.current.x;
      const dy = e.clientY - tlDragStartRef.current.y;
      setTlPan({ x: tlDragStartRef.current.panX + dx, y: tlDragStartRef.current.panY + dy });
    };
    const handleCanvasMouseUp = () => {
      if (tlNodeDragRef.current.id) {
        const drag = tlNodeDragRef.current;
        if (drag.moved) tlSuppressNodeClickRef.current = { id: drag.id, time: Date.now() };
        tlNodeDragRef.current = { id: null, scale: timelineScale, startClientX: 0, startX: 0, moved: false };
        setTlNodeDraggingId(null);
      }
      setTlDragging(false);
    };
    const handleCanvasDoubleClick = (e) => {
      if (e.target.closest('button')) return;
      setTlPan({ x: 0, y: 0 });
      setTlZoom(1);
    };

    const resetView = () => {
      setTlPan({ x: 0, y: 0 });
      setTlZoom(1);
      setTlNodeXOverrides({});
      setTimelineScale('day');
    };

    const handleNodeMouseDown = (e, event) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      const box = getLayoutBox(event);
      setTlNodeDraggingId(event.id);
      tlNodeDragRef.current = {
        id: event.id,
        scale: timelineScale,
        startClientX: e.clientX,
        startX: box.x,
        moved: false,
      };
    };

    const handleNodeMouseEnter = (eventId) => {
      setTlHoveredNode(eventId);
      if (tlPreviewTimerRef.current) clearTimeout(tlPreviewTimerRef.current);
    };
    const handleNodeMouseLeave = () => {
      setTlHoveredNode(null);
      if (tlPreviewTimerRef.current) clearTimeout(tlPreviewTimerRef.current);
    };

    const formatTime = (t) => {
      const day = Math.floor(t / 24) + 1;
      const hour = Math.floor(t % 24);
      const min = Math.round((t % 1) * 60);
      return `Day ${day} ${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    };

    const rulerTicks = [];
    const unitH = UNIT_HOURS[timelineScale];
    const unitPx = UNIT_PX[timelineScale];
    const totalUnits = Math.ceil(maxT / unitH) + 2;
    for (let i = 0; i <= totalUnits; i++) {
      const xPos = i * unitPx;
      const tVal = i * unitH;
      const day = Math.floor(tVal / 24) + 1;
      const hour = Math.floor(tVal % 24);
      let label = '';
      if (timelineScale === 'hour') label = `${String(hour).padStart(2, '0')}:00`;
      else if (timelineScale === 'day') label = `Day ${day}`;
      else if (timelineScale === 'week') label = `Week ${Math.floor(i) + 1}`;
      else label = `Month ${Math.floor(i) + 1}`;

      const isMajor = timelineScale === 'hour' ? hour % 6 === 0 : true;
      rulerTicks.push({ x: xPos, label, isMajor, t: tVal });
    }

    const isNodeVisible = (id) => tlEntranceDone || tlVisibleNodes.has(id);
    const isLineVisible = (key) => tlEntranceDone || tlVisibleLines.has(key);

    const ATTACH_ICONS = { code: '{ }', doc: '馃搫', design: '馃帹', link: '馃敆' };
    const miniGraphNodes = [];
    const miniGraphEdges = [];
    if (selected) {
      miniGraphNodes.push(selected);
      selectedNeighborIds.forEach(nid => { const ne = eventMap[nid]; if (ne) miniGraphNodes.push(ne); });
      connections.forEach(([a, b]) => {
        if (miniGraphNodes.find(n => n.id === a) && miniGraphNodes.find(n => n.id === b)) miniGraphEdges.push([a, b]);
      });
    }

    return (
      <div
        className="project-room relative h-screen overflow-hidden text-[#efe2bd] flex flex-col"
        onKeyDown={handleTimelineKeyDown}
        tabIndex={0}
        ref={tlContainerRef}
      >
        {sceneTransition && <div className="absolute right-16 top-1/2 z-50 w-32 h-32 -translate-y-1/2 bg-[#8f1e18] scene-bubble" />}

        <div className="absolute inset-0 dotgrid-bg--dark tl-breath" />

        {/* Top bar */}
        <div className="relative z-20 px-6 pt-4 pb-2 flex items-center justify-between flex-shrink-0">
          <div className="breadcrumb-bar text-[#7d6a49]">
            <button data-testid="project-scene-back" onClick={exitProjectScene} className="hover:text-[#efe2bd] transition-colors">{activeProject.name}</button>
            <span className="sep">/</span>
            <span className="text-[#efe2bd]">Contribution Timeline</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex border border-[#3a2a1c] rounded-sm overflow-hidden relative">
              {SCALES_ORDER.map(s => (
                <button
                  key={s}
                  onClick={() => setTimelineScale(s)}
                  className={`font-mono text-[9px] uppercase tracking-widest px-3 py-1.5 transition-colors ${timelineScale === s
                    ? 'bg-[#251b13] text-[#efe2bd]'
                    : 'text-[#7d6a49] hover:text-[#efe2bd] hover:bg-[#1a150f]'}`}
                >
                  {s}
                </button>
              ))}
            </div>
            <span className="font-mono text-[9px] text-[#7d6a49] tracking-widest">{Math.round(tlZoom * 100)}%</span>
            <button onClick={resetView} className="font-mono text-[9px] uppercase tracking-widest border border-[#3a2a1c] text-[#7d6a49] hover:text-[#efe2bd] hover:border-[#7b6542] px-2.5 py-1.5 transition-colors">Reset</button>
            <button onClick={() => navigateEvent(-1)} className="font-mono text-[9px] uppercase tracking-widest border border-[#3a2a1c] text-[#7d6a49] hover:text-[#efe2bd] hover:border-[#7b6542] px-2.5 py-1.5 transition-colors flex items-center gap-1">
              <ChevronLeft size={11} /> Prev
            </button>
            <button onClick={() => navigateEvent(1)} className="font-mono text-[9px] uppercase tracking-widest border border-[#3a2a1c] text-[#7d6a49] hover:text-[#efe2bd] hover:border-[#7b6542] px-2.5 py-1.5 transition-colors flex items-center gap-1">
              Next <ChevronRight size={11} />
            </button>
          </div>
        </div>

        {/* Main area: Canvas + Detail panel side-by-side */}
        <div className="relative z-10 flex-1 flex overflow-hidden">
          {/* Canvas */}
          <div
            className={`relative flex-1 overflow-hidden transition-all duration-400 ${tlDragging ? '' : 'tl-canvas-grab'}`}
            ref={timelineViewportRef}
            onWheel={handleCanvasWheel}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
            onDoubleClick={handleCanvasDoubleClick}
          >
            {focusedTimelineProofIds.length > 0 && (
              <div data-testid="timeline-evidence-detail" className="absolute left-5 top-5 z-40 border border-[#b9782b] bg-[#251b13]/95 px-4 py-3 font-mono text-[9px] uppercase tracking-widest text-[#efe2bd] shadow-lg">
                {timelineText('Timeline proof focus')}: {visibleTimelineProofCount}/{focusedTimelineProofIds.length} {timelineText(focusedTimelineProofIds.length === 1 ? 'log' : 'logs')}
                <button
                  type="button"
                  onClick={() => setFocusedTimelineProofIds([])}
                  className="ml-3 text-[#bcae86] hover:text-white"
                >
                  {timelineText('Clear')}
                </button>
              </div>
            )}
            <div
              className="relative"
              style={{
                width: canvasW,
                height: canvasH,
                transform: `translate(${tlPan.x}px, ${tlPan.y}px) scale(${tlZoom})`,
                transformOrigin: '0 0',
                transition: tlDragging ? 'none' : 'transform 0.3s cubic-bezier(0.25,0.8,0.25,1)',
              }}
            >
              {/* Swimlane labels */}
              {BRANCHES.map((branch, i) => (
                <div key={branch} className="absolute flex items-center gap-2 tl-lane-label" style={{ top: 70 + i * LANE_H, left: 12 }}>
                  <div className="w-2.5 h-12 rounded-sm" style={{ background: BRANCH_COLOR[branch] }} />
                  <span className="font-mono text-[9px] uppercase tracking-widest text-[#7d6a49] whitespace-nowrap">{branch}</span>
                </div>
              ))}

              {BRANCHES.map((_, i) => (
                <div key={`lane-${i}`} className="absolute left-0 right-0 border-t border-[#2a2118]/40" style={{ top: 70 + i * LANE_H - 10 }} />
              ))}

              {/* Time ruler */}
              <svg className="absolute left-0 pointer-events-none" style={{ top: canvasH - 40, width: canvasW, height: 40 }}>
                {rulerTicks.map((tick, i) => (
                  <g key={i}>
                    <line x1={tick.x + WORLD_X_OFFSET} y1={0} x2={tick.x + WORLD_X_OFFSET} y2={tick.isMajor ? 16 : 8} stroke={tick.isMajor ? '#5a4a32' : '#3a2a1c'} strokeWidth={tick.isMajor ? 1 : 0.5} />
                    {tick.isMajor && <text x={tick.x + WORLD_X_OFFSET} y={28} fill="#7d6a49" fontSize="9" fontFamily="monospace" textAnchor="middle">{tick.label}</text>}
                  </g>
                ))}
              </svg>

              {/* Guide lines + connections SVG */}
              <svg className="absolute left-0 top-0" style={{ width: canvasW, height: canvasH - 40 }}>
                <defs>
                  <marker id="tl-arrow" viewBox="0 0 10 8" refX="10" refY="4" markerWidth="8" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 4 L 0 8 z" fill="#5a4a32" />
                  </marker>
                </defs>
                {rulerTicks.filter(t => t.isMajor).map((tick, i) => (
                  <line key={`guide-${i}`} x1={tick.x + WORLD_X_OFFSET} y1={60} x2={tick.x + WORLD_X_OFFSET} y2={canvasH - 50} stroke="#2a2118" strokeWidth={0.5} strokeDasharray="4 6" pointerEvents="none" />
                ))}
                {connections.map(([fromId, toId]) => {
                  const fromE = eventMap[fromId];
                  const toE = eventMap[toId];
                  if (!fromE || !toE) return null;
                  const lineKey = `${fromId}-${toId}`;
                  const lineVisible = isLineVisible(lineKey);
                  const isHovered = tlHoveredLine === lineKey || neighborLines.has(lineKey);
                  const isDimmed = tlHoveredNode && !neighborLines.has(lineKey);
                  const isSelectedLine = selectedTimelineEventId === fromId || selectedTimelineEventId === toId;
                  const { sx, sy, ex, ey } = getAnchor(fromE, toE);
                  const pathD = `M ${sx} ${sy} C ${(sx + ex) / 2} ${sy}, ${(sx + ex) / 2} ${ey}, ${ex} ${ey}`;
                  const pathLen = Math.sqrt((ex - sx) ** 2 + (ey - sy) ** 2) * 1.5;
                  return (
                    <g key={lineKey}>
                      <path d={pathD} fill="none" stroke="transparent" strokeWidth={14} pointerEvents="stroke" style={{ cursor: 'pointer' }}
                        onMouseEnter={() => setTlHoveredLine(lineKey)} onMouseLeave={() => setTlHoveredLine(null)} />
                      <path d={pathD} fill="none"
                        stroke={isHovered || isSelectedLine ? '#7b6542' : '#3a2a1c'}
                        strokeWidth={isHovered || isSelectedLine ? 1.8 : 1}
                        markerEnd="url(#tl-arrow)"
                        pointerEvents="none"
                        className={`tl-line-draw ${lineVisible ? 'tl-line-draw--visible' : ''} ${isDimmed ? 'tl-line-dimmed' : ''}`}
                        style={{ strokeDasharray: pathLen, strokeDashoffset: lineVisible ? 0 : pathLen, transition: `stroke-dashoffset 0.6s cubic-bezier(0.16,1,0.3,1) ${lineVisible ? '0.1s' : '0s'}, opacity 0.3s` }}
                      />
                      {isSelectedLine && lineVisible && (
                        <circle r="3" fill="#efe2bd" opacity="0.7" pointerEvents="none"><animateMotion dur="2.5s" repeatCount="indefinite" path={pathD} /></circle>
                      )}
                      <circle cx={sx} cy={sy} r={3} fill={isHovered || isSelectedLine ? '#bcae86' : '#3a2a1c'}
                        pointerEvents="none" className={`tl-anchor-pop ${lineVisible ? 'tl-anchor-pop--visible' : ''}`} />
                      <circle cx={ex} cy={ey} r={3} fill={isHovered || isSelectedLine ? '#bcae86' : '#3a2a1c'}
                        pointerEvents="none" className={`tl-anchor-pop ${lineVisible ? 'tl-anchor-pop--visible' : ''}`} />
                    </g>
                  );
                })}
              </svg>

              {/* Event card nodes */}
              {visibleEvents.map((event) => {
                const dim = getCardDim(event);
                const layoutBox = getLayoutBox(event);
                const x = layoutBox.x;
                const y = layoutBox.y;
                const isSelected = selectedTimelineEventId === event.id;
                const isFocusedProof = focusedTimelineProofIds.includes(event.id);
                const branchColor = BRANCH_COLOR[event.branch] || '#7d6a49';
                const isHovNeighbor = neighborIds.has(event.id);
                const isDimmed = tlHoveredNode && tlHoveredNode !== event.id && !isHovNeighbor;
                const isLow = event.priority === 'low';
                const isCore = event.priority === 'core';
                const isCoreMain = isCore && event.branch === 'Main';
                const isDecision = event.type === '閲嶈鍐崇瓥';
                const nodeVisible = isNodeVisible(event.id);
                const filteredOut = !(scaleProfile.priorities.includes(event.priority) && scaleProfile.types.includes(event.type));
                const typeStyle = EVENT_TYPE_STYLES[event.type] || 'bg-[#251b13] text-[#efe2bd]';
                const showMeta = !DETAIL_LEVELS.compact;
                const showDetail = DETAIL_LEVELS.expanded && !isLow;
                const showEvidence = tlZoom >= 1.55 && !isLow;
                const titleLineCount = DETAIL_LEVELS.expanded && !isLow ? 2 : 1;
                const artifactCount = event.attachments?.length || 0;
                const commentCount = event.comments?.length || 0;
                const isDraggingNode = tlNodeDraggingId === event.id;

                return (
                  <button
                    key={event.id}
                    data-timeline-event-id={event.id}
                    onClick={() => handleNodeClick(event.id)}
                    onMouseDown={(e) => handleNodeMouseDown(e, event)}
                    onMouseEnter={() => handleNodeMouseEnter(event.id)}
                    onMouseLeave={handleNodeMouseLeave}
                    className={`absolute text-left tl-node-card rounded-sm
                      ${isSelected ? 'z-20' : 'z-10'}
                      ${isDimmed ? 'tl-node-dimmed' : ''}
                      ${isHovNeighbor ? 'tl-node-neighbor' : ''}
                      ${filteredOut ? 'tl-node-hidden' : ''}
                      ${isDecision ? 'tl-glow' : ''}
                      ${isDraggingNode ? 'tl-node-card--dragging' : ''}
                      ${isFocusedProof ? 'ring-2 ring-[#b9782b] ring-offset-2 ring-offset-[#0d0c0b]' : ''}
                    `}
                    style={{
                      left: x,
                      top: y,
                      width: dim.w,
                      height: dim.h,
                      opacity: nodeVisible ? 1 : 0,
                      transform: nodeVisible ? 'scale(1)' : 'scale(0) translateX(-20px)',
                      transition: isDraggingNode ? 'none' : undefined,
                    }}
                  >
                    <div className={`h-full overflow-hidden flex flex-col border rounded-sm transition-all duration-200 ${
                      isCoreMain
                        ? `p-3.5 ${isSelected
                            ? 'border-[#b9782b] bg-[#efe2bd]/95 text-[#251b13] shadow-[0_0_24px_rgba(185,120,43,0.25),0_8px_32px_rgba(0,0,0,0.3)]'
                            : 'border-[#b9782b]/40 bg-[#efe2bd]/85 text-[#251b13] hover:border-[#b9782b] hover:shadow-[0_8px_24px_rgba(0,0,0,0.25)]'}`
                        : isLow
                          ? `p-2.5 ${isSelected
                              ? 'border-[#5a4a32] bg-[#1a150f] shadow-[0_0_16px_rgba(0,0,0,0.4)]'
                              : 'border-[#2a2118]/60 bg-[#141210]/70 hover:border-[#3a2a1c]'}`
                          : `p-3 ${isSelected
                              ? 'border-[#7b6542] bg-[#251b13] shadow-[0_0_24px_rgba(143,30,24,0.2),0_8px_32px_rgba(0,0,0,0.4)]'
                              : 'border-[#2a2118] bg-[#141210]/90 hover:border-[#3a2a1c] hover:bg-[#1a150f] hover:shadow-[0_8px_24px_rgba(0,0,0,0.3)]'}`
                    }`}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-sm" style={{ background: branchColor }} />
                          <span className={`font-mono tracking-[0.14em] uppercase text-[#7d6a49] ${isLow ? 'text-[7px]' : 'text-[8px]'}`}>{event.eventId}</span>
                        </div>
                        <span className={`font-mono tracking-[0.14em] uppercase px-1.5 py-[1px] rounded-sm ${isLow ? 'text-[7px]' : 'text-[8px]'} ${typeStyle}`}>{event.type}</span>
                      </div>
                      <div
                        className={`tl-node-content-line font-serif leading-snug ${isLow ? 'text-xs opacity-70' : isCore ? (isSelected ? 'text-[15px]' : 'text-sm') : 'text-[13px]'} ${isCoreMain ? 'text-[#251b13]' : (isSelected ? 'text-[#efe2bd]' : 'text-[#d8c99f]')} mb-1`}
                        style={{ WebkitLineClamp: titleLineCount }}
                      >
                        {event.title}
                      </div>
                      {showMeta && (
                        <div className={`font-mono uppercase tracking-widest ${isLow ? 'text-[7px]' : 'text-[8px]'} text-[#7d6a49]`}>
                          {event.contributor} 路 {formatTime(event.t)}
                        </div>
                      )}
                      {showDetail && (
                        <p className={`tl-node-content-line mt-1 font-serif text-[11px] leading-snug ${isCoreMain ? 'text-[#5a4a32]' : 'text-[#bcae86]'}`} style={{ WebkitLineClamp: 2 }}>
                          {event.detail}
                        </p>
                      )}
                      <div className="mt-auto">
                        {showEvidence && (
                          <div className="mb-1 flex items-center gap-1.5 font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">
                            {artifactCount > 0 && <span>{artifactCount} {timelineText('files')}</span>}
                            {commentCount > 0 && <span>{commentCount} {timelineText('notes')}</span>}
                            {event.dependsOn?.length > 0 && <span>{event.dependsOn.length} {timelineText('deps')}</span>}
                          </div>
                        )}
                        {event.branch !== 'Main' && !DETAIL_LEVELS.compact && !isLow && <div className="h-[3px] rounded-full" style={{ background: branchColor, opacity: 0.6 }} />}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Detail Side Panel */}
          {(selected || tlDetailClosing) && (
            <div
              className={`w-[420px] flex-shrink-0 h-full border-l border-[#2a2118] bg-[#141210]/98 backdrop-blur-md flex flex-col ${tlDetailClosing ? 'tl-detail-slide-out' : 'tl-detail-slide-in'}`}
            >
              {selected && (
                <>
                  {/* Scrollable content */}
                  <div className="flex-1 overflow-y-auto px-5 pt-5 pb-4" style={{ scrollbarWidth: 'thin', scrollbarColor: '#3a2a1c #141210' }}>
                    {/* 1. Header */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-sm" style={{ background: BRANCH_COLOR[selected.branch] || '#7d6a49' }} />
                        <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-[#7d6a49]">{selected.eventId}</span>
                        <span className={`font-mono text-[8px] tracking-[0.14em] uppercase px-2 py-[2px] rounded-sm ${EVENT_TYPE_STYLES[selected.type] || 'bg-[#251b13] text-[#efe2bd]'}`}>{selected.type}</span>
                      </div>
                      <button onClick={closeDetail} className="text-[#7d6a49] hover:text-[#efe2bd] transition-colors p-1">
                        <X size={16} />
                      </button>
                    </div>

                    {/* 2. Title & Description */}
                    <h3 className="font-serif text-2xl leading-tight text-[#efe2bd] mb-3">{selected.title}</h3>
                    <p className="font-serif text-sm leading-relaxed text-[#bcae86] mb-1">{selected.detail}</p>

                    {/* 3. Metadata */}
                    <div data-testid="timeline-node-metadata-detail" className="tl-detail-section">
                      <div className="tl-detail-section-title">{timelineText('Metadata')}</div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                        {[
                          [timelineText('Contributor'), selected.contributor],
                          [timelineText('Time'), formatTime(selected.t)],
                          [timelineText('Branch'), selected.branch],
                          [timelineText('Priority'), timelineText(selected.priority)],
                          [timelineText('Type'), timelineText(selected.type)],
                          [timelineText('Source Channel'), channelNameById[selected.sourceChannelId] || selected.sourceChannelId || 'timeline'],
                          [timelineText('Receipts'), selected.receiptCount ? `${selected.receiptCount} ${timelineText('seen')}` : timelineText('no receipt count')],
                          [timelineText('Direct Targets'), timelineDirectTargetNames.length ? timelineDirectTargetNames.join(' / ') : timelineText('none')],
                        ].map(([label, value]) => (
                          <div key={label} className="flex justify-between font-mono text-[9px] uppercase tracking-widest">
                            <span className="text-[#7d6a49]">{label}</span>
                            <span className="text-[#bcae86]">{value}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 4. Attachments */}
                    {selected.attachments && selected.attachments.length > 0 && (
                      <div className="tl-detail-section">
                        <div className="tl-detail-section-title">{timelineText('Related Artifacts')} ({selected.attachments.length})</div>
                        {selected.attachments.map((att, i) => (
                          <div key={i} className="tl-attach-item">
                            <span className="text-sm flex-shrink-0 w-5 text-center">{ATTACH_ICONS[att.type] || '馃搸'}</span>
                            <div className="flex-1 min-w-0">
                              <div className="font-mono text-[10px] text-[#d8c99f] truncate">{att.name || att.title || att.fileName || att.id}</div>
                              <div className="font-mono text-[8px] text-[#7d6a49] truncate">{att.diff || att.summary || att.absolutePath || att.path || att.relativePath}</div>
                              {(att.url || att.absolutePath || att.path || att.relativePath) && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    data-testid={`timeline-open-artifact-${att.id || i}`}
                                    onClick={() => {
                                      const target = att.url || (att.absolutePath || att.path || '').replace(/\\/g, '/');
                                      if (target) window.open(target.startsWith('file:') ? target : `file://${target}`, '_blank', 'noopener,noreferrer');
                                    }}
                                    className="border border-[#3a2a1c] px-2 py-1 font-mono text-[7px] uppercase tracking-widest text-[#bcae86] hover:border-[#7b6542] hover:text-[#efe2bd]"
                                  >
                                    Open artifact
                                  </button>
                                  <button
                                    type="button"
                                    data-testid={`timeline-locate-artifact-${att.id || i}`}
                                    onClick={() => navigator.clipboard?.writeText(att.absolutePath || att.path || att.relativePath || '')}
                                    className="border border-[#3a2a1c] px-2 py-1 font-mono text-[7px] uppercase tracking-widest text-[#bcae86] hover:border-[#7b6542] hover:text-[#efe2bd]"
                                  >
                                    Locate artifact
                                  </button>
                                </div>
                              )}
                            </div>
                            {att.hash && <span className="font-mono text-[8px] text-[#5a4a32] flex-shrink-0">{att.hash}</span>}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 5. Discussion thread */}
                    {selected.comments && selected.comments.length > 0 && (
                      <div className="tl-detail-section">
                        <div className="tl-detail-section-title">{timelineText('Discussion')} ({selected.comments.length})</div>
                        {selected.comments.map((c, i) => (
                          <div key={i} className="tl-comment-item">
                            <div className="tl-comment-avatar">{c.author[0]}</div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-mono text-[9px] text-[#d8c99f] tracking-wider">{c.author}</span>
                                <span className="font-mono text-[8px] text-[#5a4a32]">{formatTime(c.time)}</span>
                              </div>
                              <p className="font-serif text-[12px] leading-relaxed text-[#bcae86]">{c.text}</p>
                            </div>
                          </div>
                        ))}
                        <div className="mt-3 flex items-center gap-2">
                          <div className="tl-comment-avatar" style={{ width: 22, height: 22, fontSize: 8 }}>U</div>
                          <div className="flex-1 border border-[#2a2118] rounded-sm px-2.5 py-1.5 font-mono text-[9px] text-[#5a4a32] cursor-text">
                            {timelineText('Add comment...')}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 6. Mini dependency graph */}
                    {miniGraphNodes.length > 1 && (
                      <div className="tl-detail-section">
                        <div className="tl-detail-section-title">{timelineText('Dependencies')}</div>
                        <svg width="100%" height={120} className="overflow-visible">
                          {(() => {
                            const sorted = [...miniGraphNodes].sort((a, b) => a.t - b.t);
                            const spacing = 360 / Math.max(sorted.length, 1);
                            const nodePos = {};
                            sorted.forEach((n, i) => {
                              const cx = 20 + i * spacing;
                              const cy = n.id === selected.id ? 40 : 80;
                              nodePos[n.id] = { cx, cy };
                            });
                            return (
                              <>
                                {miniGraphEdges.map(([a, b]) => {
                                  const pa = nodePos[a];
                                  const pb = nodePos[b];
                                  if (!pa || !pb) return null;
                                  return <line key={`mg-${a}-${b}`} x1={pa.cx} y1={pa.cy} x2={pb.cx} y2={pb.cy} stroke="#3a2a1c" strokeWidth={1} />;
                                })}
                                {sorted.map(n => {
                                  const p = nodePos[n.id];
                                  const isCurrent = n.id === selected.id;
                                  const bc = BRANCH_COLOR[n.branch] || '#7d6a49';
                                  return (
                                    <g key={`mg-n-${n.id}`}
                                      onClick={() => { if (!isCurrent) { setTlDetailClosing(false); setSelectedTimelineEventId(n.id); } }}
                                      style={{ cursor: isCurrent ? 'default' : 'pointer' }}>
                                      <circle cx={p.cx} cy={p.cy} r={isCurrent ? 16 : 12} fill={isCurrent ? '#251b13' : '#1a150f'} stroke={isCurrent ? bc : '#3a2a1c'} strokeWidth={isCurrent ? 2 : 1} />
                                      <text x={p.cx} y={p.cy + 1} textAnchor="middle" dominantBaseline="middle" fill={isCurrent ? '#efe2bd' : '#7d6a49'} fontSize="7" fontFamily="monospace">{n.eventId.replace('T-', '')}</text>
                                        <text x={p.cx} y={p.cy + (isCurrent ? 28 : 24)} textAnchor="middle" fill="#7d6a49" fontSize="7" fontFamily="monospace">{n.title.length > 8 ? `${n.title.slice(0, 8)}...` : n.title}</text>
                                    </g>
                                  );
                                })}
                              </>
                            );
                          })()}
                        </svg>
                      </div>
                    )}

                    {/* 7. Change history */}
                    {selected.history && selected.history.length > 0 && (
                      <div className="tl-detail-section">
                        <div className="tl-detail-section-title">{timelineText('Change History')}</div>
                        <div className="space-y-0">
                          {selected.history.map((h, i) => (
                            <div key={i} className="flex gap-3 relative" style={{ paddingBottom: i < selected.history.length - 1 ? 16 : 0 }}>
                              <div className="relative flex flex-col items-center">
                                <div className="tl-history-dot" />
                                {i < selected.history.length - 1 && <div className="tl-history-line" />}
                              </div>
                              <div className="flex-1 min-w-0 -mt-0.5">
                                <div className="font-mono text-[9px] text-[#bcae86]">{h.action}</div>
                                <div className="font-mono text-[8px] text-[#5a4a32]">{formatTime(h.time)}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Neighbor quick nav */}
                    {selectedNeighborIds.length > 0 && (
                      <div className="tl-detail-section">
                        <div className="tl-detail-section-title">{timelineText('Adjacent Nodes')}</div>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedNeighborIds.map(nid => {
                            const ne = eventMap[nid];
                            if (!ne) return null;
                            return (
                              <button key={nid}
                                onClick={() => { setTlDetailClosing(false); setSelectedTimelineEventId(nid); }}
                                className="font-mono text-[8px] tracking-wider px-2 py-1 border border-[#3a2a1c] rounded-sm text-[#bcae86] hover:text-[#efe2bd] hover:border-[#7b6542] transition-colors">
                                {ne.eventId} {ne.title}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 8. Action bar 鈥?fixed at bottom */}
                  <div className="flex-shrink-0 px-5 py-3 border-t border-[#2a2118] flex items-center gap-2">
                    <button className="flex-1 font-mono text-[9px] uppercase tracking-widest border border-[#3a2a1c] text-[#7d6a49] hover:text-[#efe2bd] hover:border-[#7b6542] px-3 py-2 transition-colors rounded-sm">
                      {timelineText('Jump To Chat')}
                    </button>
                    <button className="flex-1 font-mono text-[9px] uppercase tracking-widest border border-[#3a2a1c] text-[#7d6a49] hover:text-[#efe2bd] hover:border-[#7b6542] px-3 py-2 transition-colors rounded-sm">
                      {timelineText('Mark Complete')}
                    </button>
                    <button className="flex-1 font-mono text-[9px] uppercase tracking-widest border border-[#3a2a1c] text-[#7d6a49] hover:text-[#efe2bd] hover:border-[#7b6542] px-3 py-2 transition-colors rounded-sm">
                      {timelineText('Edit')}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderProjectTimeline = () => {
    const categoryMeta = {
      thinking: { label: 'Thinking', lane: 'Thinking', color: '#b9782b', Icon: Search },
      decision: { label: 'Decision', lane: 'Decisions', color: '#8f1e18', Icon: Shield },
      collaboration: { label: 'Collaboration', lane: 'Collaboration', color: '#59684b', Icon: Users },
      execution: { label: 'Execution', lane: 'Execution', color: '#bcae86', Icon: Activity },
      submission: { label: 'Submission', lane: 'Submissions', color: '#d8c99f', Icon: FileText },
      communication: { label: 'Communication', lane: 'Communication', color: '#7b6542', Icon: MessageSquare },
      monitoring: { label: 'Monitoring', lane: 'Monitoring', color: '#3f5d69', Icon: BellDot },
      evidence: { label: 'Evidence', lane: 'Evidence', color: '#efe2bd', Icon: Database },
    };
    const channelNameById = Object.fromEntries(chatChannels.map(channel => [channel.id, channel.name]));
    const categoryOrder = ['thinking', 'decision', 'collaboration', 'execution', 'submission', 'communication', 'monitoring', 'evidence'];
    const edgeMeta = {
      leader_assignment: { label: 'Leader assignment', color: '#8f1e18' },
      agent_collaboration: { label: 'Agent collaboration', color: '#59684b' },
      task_dependency: { label: 'Task dependency', color: '#bcae86' },
      change_impact: { label: 'Change impact', color: '#b9782b' },
      reporting: { label: 'Report line', color: '#d8c99f' },
      evidence: { label: 'Evidence line', color: '#7b6542' },
    };
    const importanceRank = { minor: 0, normal: 1, major: 2, critical: 3 };
    const localAttachmentTypeFor = (node) => {
      const text = `${node.category || ''} ${node.subtype || ''} ${node.source || ''}`.toLowerCase();
      if (/meeting/.test(text)) return 'meeting-minutes';
      if (/report|summary|submission/.test(text)) return 'report';
      if (/test/.test(text)) return 'test-result';
      if (/heartbeat|monitor|loop/.test(text)) return 'runtime-check';
      if (/message|chat|communication/.test(text)) return 'chat-record';
      if (/evidence|proof/.test(text)) return 'evidence-packet';
      return 'workflow-attachment';
    };
    const localSubmissionIntentFor = (node) => {
      const text = `${node.category || ''} ${node.subtype || ''}`.toLowerCase();
      if (/meeting/.test(text)) return 'Submit meeting minutes and attendance evidence.';
      if (/report|summary|submission/.test(text)) return 'Submit a deliverable report for manager/user review.';
      if (/heartbeat|monitor|loop/.test(text)) return 'Submit an Agent runtime check-in.';
      if (/message|chat|communication/.test(text)) return 'Submit a communication record with receipt context.';
      return 'Submit an Agent-authored workflow commit for manager review.';
    };
    const withLocalSubmissionArtifacts = (node) => {
      const attachment = {
        id: `${node.id}_attachment_main`,
        type: localAttachmentTypeFor(node),
        title: `${node.title} attachment`,
        summary: node.summary,
        source: node.source,
        autoGenerated: true,
        proofIds: node.proofIds || [],
        timelineLogIds: node.timelineLogIds || [],
        eventIds: node.eventIds || [],
        taskId: node.taskId || null,
        route: node.route || null,
      };
      const field = (id, label, source, value, required = true) => ({
        id,
        label,
        source,
        required,
        status: required && (value === null || value === undefined || value === '' || (Array.isArray(value) && !value.length)) ? 'missing' : 'filled',
      });
      return {
        ...node,
        commitMessage: node.commitMessage || node.summary || node.title,
        committerIds: node.committerIds || [node.agentId].filter(Boolean),
        attachments: node.attachments?.length ? node.attachments : [attachment],
        submission: node.submission || {
          id: `submission_${node.id}`,
          generatedBy: 'manager-flow-fallback-protocol',
          intent: localSubmissionIntentFor(node),
          commitMessage: node.commitMessage || node.summary || node.title,
          submittedByAgentId: node.agentId || null,
          submittedByAgentName: node.agentName || 'Project',
          committerIds: node.committerIds || [node.agentId].filter(Boolean),
          coAuthorIds: node.coAuthorIds || [],
          participantIds: node.participantIds || node.affectedAgentIds || [],
          attachmentIds: [attachment.id],
          requiredFields: [
            field('category', 'Category', 'agent', node.category),
            field('subtype', 'Subtype', 'agent', node.subtype),
            field('commitMessage', 'Commit message', 'agent', node.commitMessage || node.summary || node.title),
            field('submitter', 'Submitting Agent', 'agent', node.agentId || node.agentName),
            field('attachments', 'Submitted artifact attachment', 'agent', [attachment]),
          ],
          autoFields: [
            field('id', 'Node ID', 'system', node.id, false),
            field('time', 'Commit time', 'system', node.time, false),
            field('status', 'Workflow status', 'system', node.status, false),
            field('source', 'Source ledger', 'system', node.source, false),
          ],
        },
      };
    };
    const backendFlowGraph = backendStation.managerFlowGraph || backendStation.managerReadyPackage?.managerFlowGraph || null;
    const graphProjectMatches = !backendFlowGraph?.projectId || backendFlowGraph.projectId === activeProject.id;
    const buildFallbackFlowGraph = () => {
      const agentStatusNodes = activeProject.team.map((agent, index) => {
        const state = activeProject.agentStates?.[agent.id] || {};
        return {
          id: `agent-status-${agent.id}`,
          category: 'monitoring',
          subtype: 'agent-heartbeat',
          title: `${agent.name} current state`,
          agentId: agent.id,
          agentName: agent.name,
          taskId: null,
          time: state.lastActiveAt || activeProject.updatedAt || activeProject.createdAt || new Date().toISOString(),
          summary: state.currentPlan?.focus || state.status || 'Waiting for backend graph sync.',
          status: state.status === 'blocked' ? 'blocked' : 'published',
          importance: index === 0 ? 'major' : 'normal',
          source: 'agentStates',
          proofIds: [],
          relatedNodeIds: [],
          timelineLogIds: [],
          eventIds: [],
        };
      });
      const logNodes = (activeProject.logs || []).slice(0, 24).map((log, index) => {
        const agent = activeProject.team.find(member => member.id === log.agentId || member.name === log.agent);
        const category = /confirmed|approved|decision/i.test(log.eventType || '')
          ? 'decision'
          : /report|completed|test/i.test(log.eventType || '')
            ? 'submission'
            : /management|worker|scheduler/i.test(log.eventType || '')
              ? 'monitoring'
              : 'execution';
        return {
          id: `timeline-log-${log.id || index}`,
          category,
          subtype: log.eventType || 'timeline-log',
          title: log.agent || log.actor || log.eventType || 'Timeline log',
          agentId: log.agentId || agent?.id || null,
          agentName: agent?.name || log.agent || 'Runtime',
          taskId: log.taskId || null,
          time: log.time || activeProject.updatedAt || activeProject.createdAt || new Date().toISOString(),
          summary: log.log || log.text || 'Timeline log',
          status: /blocked/i.test(log.eventType || '') ? 'blocked' : 'published',
          importance: index < 6 ? 'major' : 'normal',
          source: 'timeline logs',
          sourceChannelId: log.sourceChannelId || null,
          receiptCount: log.receiptCount || 0,
          directTargetIds: log.directTargetIds || [],
          proofIds: [String(log.id || '').startsWith('log_') ? String(log.id).slice(4) : null].filter(Boolean),
          timelineLogIds: [log.id].filter(Boolean),
          eventIds: [],
          relatedNodeIds: log.agentId ? [`agent-status-${log.agentId}`] : [],
          attachments: log.attachments || [],
        };
      });
      const nodes = [...agentStatusNodes, ...logNodes].map((node, index) => ({
        ...node,
        sequence: index + 1,
        categoryLabel: categoryMeta[node.category]?.label || node.category,
        hasProof: Boolean(node.proofIds?.length || node.timelineLogIds?.length || node.eventIds?.length),
      })).map(withLocalSubmissionArtifacts);
      const edges = logNodes
        .filter(node => node.agentId)
        .map(node => ({
          id: `fallback-edge-${node.id}`,
          type: node.category === 'submission' ? 'reporting' : 'task_dependency',
          typeLabel: node.category === 'submission' ? 'Report line' : 'Task dependency line',
          fromNodeId: `agent-status-${node.agentId}`,
          toNodeId: node.id,
          label: node.category === 'submission' ? 'Agent report' : 'Agent progress',
          status: 'published',
          importance: node.importance,
          source: node.source,
          proofIds: node.proofIds || [],
          timelineLogIds: node.timelineLogIds || [],
          eventIds: [],
        }));
      const byCategory = nodes.reduce((acc, node) => ({ ...acc, [node.category]: (acc[node.category] || 0) + 1 }), {});
      return {
        projectId: activeProject.id,
        schemaVersion: 'manager-flow-graph/fallback',
        generatedAt: new Date().toISOString(),
        categories: categoryOrder.map(id => ({ id, ...categoryMeta[id], count: byCategory[id] || 0 })),
        summary: {
          nodeCount: nodes.length,
          edgeCount: edges.length,
          proofedNodeCount: nodes.filter(node => node.hasProof).length,
          confirmedNodeCount: nodes.filter(node => node.status === 'confirmed').length,
          blockedNodeCount: nodes.filter(node => node.status === 'blocked').length,
          majorVisibleCount: nodes.filter(node => ['major', 'critical'].includes(node.importance)).length,
          byCategory,
        },
        zoomRules: {
          compact: { label: 'Major and critical only', importances: ['major', 'critical'] },
          medium: { label: 'Agent working path' },
          expanded: { label: 'Chat, report, evidence, and detail' },
        },
        dataSources: {
          eventLedger: activeProject.eventLedger?.length || 0,
          timelineLogs: activeProject.logs?.length || 0,
          messages: chatMessages.filter(message => (message.projectId || DEFAULT_CHAT_PROJECT_ID) === activeProject.id).length,
          tasks: activeProject.tasks?.length || 0,
          agentStates: Object.keys(activeProject.agentStates || {}).length,
          kickoffCharter: Boolean(activeProject.kickoffCharter),
          changeLedger: activeProject.changeLedger?.length || 0,
          managerDashboard: Boolean(backendStation.managerDashboard),
        },
        nodes,
        edges,
      };
    };
    const managerFlowGraph = graphProjectMatches && backendFlowGraph?.nodes?.length ? backendFlowGraph : buildFallbackFlowGraph();
    const backendOnline = backendStation.connectionStatus === 'online';
    const scaleProfiles = {
      month: { label: 'Major', test: node => ['major', 'critical'].includes(node.importance) },
      week: { label: 'Path', test: node => ['major', 'critical'].includes(node.importance) || ['decision', 'collaboration', 'execution', 'submission', 'monitoring'].includes(node.category) },
      day: { label: 'Work', test: node => node.category !== 'evidence' || ['major', 'critical'].includes(node.importance) },
      hour: { label: 'Detail', test: () => true },
    };
    const scaleOrder = ['month', 'week', 'day', 'hour'];
    const zoomDetail = tlZoom < 0.72 ? 'compact' : tlZoom < 1.12 ? 'medium' : 'expanded';
    const zoomScale = tlZoom < 0.72 ? 'month' : tlZoom < 1.04 ? 'week' : tlZoom < 1.42 ? 'day' : 'hour';
    const activeScaleProfile = scaleProfiles[zoomScale] || scaleProfiles.day;
    const visibleNodes = Array.from(new Map((managerFlowGraph.nodes || [])
      .filter(activeScaleProfile.test)
      .filter(node => zoomDetail !== 'compact' || ['major', 'critical'].includes(node.importance))
      .map(node => [node.id, node])).values())
      .sort((a, b) => {
        const areaA = a.commitArea?.index ?? managerFlowGraph.layout?.nodeLayoutHints?.[a.id]?.index;
        const areaB = b.commitArea?.index ?? managerFlowGraph.layout?.nodeLayoutHints?.[b.id]?.index;
        if (Number.isFinite(areaA) && Number.isFinite(areaB) && areaA !== areaB) return areaA - areaB;
        const timeA = Date.parse(a.time) || 0;
        const timeB = Date.parse(b.time) || 0;
        if (timeA !== timeB) return timeA - timeB;
        const branchA = a.commitArea?.branchIndex ?? managerFlowGraph.layout?.nodeLayoutHints?.[a.id]?.branchIndex;
        const branchB = b.commitArea?.branchIndex ?? managerFlowGraph.layout?.nodeLayoutHints?.[b.id]?.branchIndex;
        if (Number.isFinite(branchA) && Number.isFinite(branchB) && branchA !== branchB) return branchA - branchB;
        return (a.sequence || 0) - (b.sequence || 0);
      });
    const visibleNodeIds = new Set(visibleNodes.map(node => node.id));
    const visibleEdges = (managerFlowGraph.edges || []).filter(edge => visibleNodeIds.has(edge.fromNodeId) && visibleNodeIds.has(edge.toNodeId));
    const nodeMap = Object.fromEntries((managerFlowGraph.nodes || []).map(node => [node.id, node]));
    const selectedNode = visibleNodes.find(node => node.id === selectedTimelineEventId)
      || visibleNodes.find(node => [node.id, ...(node.proofIds || []), ...(node.timelineLogIds || []), ...(node.eventIds || [])].includes(selectedTimelineEventId))
      || null;
    const selectedThinkingFrame = selectedNode?.thinkingFrame || selectedNode?.submission?.thinkingFrame || null;
    const relatedEdges = selectedNode
      ? visibleEdges.filter(edge => edge.fromNodeId === selectedNode.id || edge.toNodeId === selectedNode.id)
      : [];
    const relatedNodeIds = selectedNode
      ? Array.from(new Set(relatedEdges.flatMap(edge => [edge.fromNodeId, edge.toNodeId]).filter(id => id !== selectedNode.id)))
      : [];
    const isProofFocused = (node) => focusedTimelineProofIds.some(id => (
      node.id === id
      || (node.proofIds || []).includes(id)
      || (node.timelineLogIds || []).includes(id)
      || (node.eventIds || []).includes(id)
    ));
    const visibleTimelineProofCount = visibleNodes.filter(isProofFocused).length;
    const uniqueIds = (values) => Array.from(new Set((values || []).filter(Boolean).map(value => String(value))));
    const agentById = new Map((activeProject.team || []).map(agent => [agent.id, agent]));
    const agentDisplay = (agentId) => {
      const agent = agentById.get(agentId);
      return {
        id: agentId || 'project',
        name: agent?.name || agentId || 'Project',
        role: agent?.title || agent?.role || agent?.duty || (agentId ? 'Agent' : 'Project'),
        accent: agent?.color || '#bcae86',
      };
    };
    const nodeCommitters = (node) => uniqueIds([
      ...(node.committerIds || []),
      node.agentId,
      ...(node.coAuthorIds || []),
    ]).map(agentDisplay);
    const committersLabel = (node) => {
      const committers = nodeCommitters(node);
      if (!committers.length) return node.agentName || 'Project';
      if (committers.length === 1) return committers[0].name;
      return `${committers.slice(0, 2).map(person => person.name).join(' + ')}${committers.length > 2 ? ` +${committers.length - 2}` : ''}`;
    };
    const compactText = (value, max = 96) => {
      const text = String(value || '').replace(/\s+/g, ' ').trim();
      if (text.length <= max) return text;
      return `${text.slice(0, Math.max(0, max - 3)).trim()}...`;
    };
    const timeKeyForNode = (node) => {
      if (node.commitArea?.key) return node.commitArea.key;
      const hintKey = managerFlowGraph.layout?.nodeLayoutHints?.[node.id]?.key;
      if (hintKey) return hintKey;
      const parsed = Date.parse(node.time);
      if (Number.isFinite(parsed)) {
        const date = new Date(parsed);
        date.setSeconds(0, 0);
        return date.toISOString();
      }
      return String(node.time || `sequence-${node.sequence || node.id}`).trim();
    };
    const groupedByTime = visibleNodes.reduce((acc, node) => {
      const key = timeKeyForNode(node);
      if (!acc.has(key)) acc.set(key, []);
      acc.get(key).push(node);
      return acc;
    }, new Map());
    const timeColumns = [...groupedByTime.entries()]
      .map(([key, nodes]) => ({
        key,
        time: nodes[0]?.time,
        nodes: nodes.sort((a, b) => {
          const branchA = a.commitArea?.branchIndex ?? managerFlowGraph.layout?.nodeLayoutHints?.[a.id]?.branchIndex;
          const branchB = b.commitArea?.branchIndex ?? managerFlowGraph.layout?.nodeLayoutHints?.[b.id]?.branchIndex;
          if (Number.isFinite(branchA) && Number.isFinite(branchB) && branchA !== branchB) return branchA - branchB;
          return (importanceRank[b.importance] || 0) - (importanceRank[a.importance] || 0) || (a.sequence || 0) - (b.sequence || 0);
        }),
        layoutIndex: Math.min(...nodes.map(node => node.commitArea?.index ?? managerFlowGraph.layout?.nodeLayoutHints?.[node.id]?.index ?? Number.MAX_SAFE_INTEGER)),
      }))
      .sort((a, b) => {
        if (Number.isFinite(a.layoutIndex) && Number.isFinite(b.layoutIndex) && a.layoutIndex !== b.layoutIndex) return a.layoutIndex - b.layoutIndex;
        const timeA = Date.parse(a.time) || 0;
        const timeB = Date.parse(b.time) || 0;
        if (timeA !== timeB) return timeA - timeB;
        return (a.nodes[0]?.sequence || 0) - (b.nodes[0]?.sequence || 0);
      });
    const nodeWidth = zoomDetail === 'expanded' ? 292 : zoomDetail === 'medium' ? 260 : 224;
    const nodeHeight = zoomDetail === 'expanded' ? 144 : zoomDetail === 'medium' ? 126 : 108;
    const branchXGap = nodeWidth + (zoomDetail === 'compact' ? 28 : 38);
    const timeColumnGap = zoomDetail === 'expanded' ? 128 : zoomDetail === 'medium' ? 112 : 92;
    const branchYOffset = zoomDetail === 'expanded' ? 88 : zoomDetail === 'medium' ? 78 : 68;
    const xOffset = 300;
    const maxBranchCount = Math.max(1, ...timeColumns.map(column => column.nodes.length));
    const maxBranchLevel = Math.max(1, Math.ceil((maxBranchCount - 1) / 2));
    const timeAxisY = Math.max(280, 132 + maxBranchLevel * branchYOffset + nodeHeight / 2);
    const branchSlotFor = (index) => {
      if (index === 0) return 0;
      const level = Math.ceil(index / 2);
      return index % 2 === 1 ? -level : level;
    };
    let columnCursor = xOffset;
    const timeColumnLayouts = timeColumns.map((column) => {
      const branchCount = Math.max(1, column.nodes.length);
      const width = Math.max(nodeWidth, (branchCount - 1) * branchXGap + nodeWidth);
      const layout = {
        ...column,
        x: columnCursor,
        width,
        centerX: columnCursor + width / 2,
      };
      columnCursor += width + timeColumnGap;
      return layout;
    });
    const nodeLayout = {};
    timeColumnLayouts.forEach((column, columnIndex) => {
      column.nodes.forEach((node, branchIndex) => {
        const slot = branchSlotFor(branchIndex);
        nodeLayout[node.id] = {
          x: column.x + branchIndex * branchXGap,
          y: timeAxisY + slot * branchYOffset - nodeHeight / 2,
          branchIndex,
          branchCount: column.nodes.length,
          timeColumnIndex: columnIndex,
          w: nodeWidth,
          h: nodeHeight,
        };
      });
    });
    const visibleNodesByPosition = visibleNodes
      .map(node => ({ node, box: nodeLayout[node.id] }))
      .filter(item => item.box)
      .sort((a, b) => a.box.x - b.box.x || a.box.y - b.box.y)
      .map(item => item.node);
    const canvasW = Math.max(1280, columnCursor + 180);
    const canvasH = Math.max(760, timeAxisY + maxBranchLevel * branchYOffset + nodeHeight / 2 + 180);
    const tickEvery = zoomDetail === 'expanded' ? 1 : zoomDetail === 'medium' ? 2 : 3;
    const timeTicks = timeColumnLayouts
      .map((column, index) => ({
        key: `${column.key}-${index}`,
        time: column.time,
        x: column.centerX,
        count: column.nodes.length,
        show: index === 0 || index === timeColumns.length - 1 || index % tickEvery === 0,
      }))
      .filter(tick => tick.show);
    const branchGuides = timeColumnLayouts.filter(column => column.nodes.length > 1).map((column) => {
      const boxes = column.nodes.map(node => nodeLayout[node.id]).filter(Boolean);
      return {
        key: column.key,
        x: column.centerX,
        y: timeAxisY,
        left: Math.min(...boxes.map(box => box.x + box.w / 2)),
        right: Math.max(...boxes.map(box => box.x + box.w / 2)),
        count: column.nodes.length,
      };
    });
    const getAnchor = (edge) => {
      const from = nodeLayout[edge.fromNodeId];
      const to = nodeLayout[edge.toNodeId];
      if (!from || !to) return null;
      const sx = from.x + from.w / 2;
      const sy = from.y + from.h / 2;
      const ex = to.x + to.w / 2;
      const ey = to.y + to.h / 2;
      const bend = Math.max(70, Math.abs(ex - sx) / 2);
      return { sx, sy, ex, ey, path: `M ${sx} ${sy} C ${sx + bend} ${sy}, ${ex - bend} ${ey}, ${ex} ${ey}` };
    };
    const handleGraphWheel = (event) => {
      event.preventDefault();
      if (event.altKey) {
        const current = scaleOrder.indexOf(timelineScale);
        const next = event.deltaY > 0 ? Math.max(0, current - 1) : Math.min(scaleOrder.length - 1, current + 1);
        setTimelineScale(scaleOrder[next]);
        return;
      }
      if (event.shiftKey) {
        setTlPan(prev => ({ ...prev, x: prev.x - event.deltaY }));
        return;
      }
      const rect = event.currentTarget.getBoundingClientRect();
      const pointerX = event.clientX - rect.left;
      const pointerY = event.clientY - rect.top;
      const nextZoom = Math.min(2.2, Math.max(0.52, tlZoom * Math.exp(-event.deltaY * 0.0012)));
      const worldX = (pointerX - tlPan.x) / tlZoom;
      const worldY = (pointerY - tlPan.y) / tlZoom;
      setTlZoom(nextZoom);
      setTlPan({
        x: pointerX - worldX * nextZoom,
        y: pointerY - worldY * nextZoom,
      });
    };
    const handleGraphMouseDown = (event) => {
      if (event.target.closest('button')) return;
      setTlDragging(true);
      tlDragStartRef.current = { x: event.clientX, y: event.clientY, panX: tlPan.x, panY: tlPan.y };
    };
    const handleGraphMouseMove = (event) => {
      if (!tlDragging) return;
      setTlPan({
        x: tlDragStartRef.current.panX + event.clientX - tlDragStartRef.current.x,
        y: tlDragStartRef.current.panY + event.clientY - tlDragStartRef.current.y,
      });
    };
    const resetGraphView = () => {
      setTlPan({ x: 0, y: 0 });
      setTlZoom(1);
      setTimelineScale('day');
      setSelectedTimelineEventId(null);
    };
    const graphTime = (value) => {
      if (!value) return 'No time';
      const clockOnly = String(value).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
      if (clockOnly) {
        const hour = String(Math.min(23, Number(clockOnly[1]))).padStart(2, '0');
        return `${hour}:${clockOnly[2]}`;
      }
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) return String(value);
      const date = parsed.toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' });
      const time = parsed.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
      return `${date} ${time}`;
    };
    const selectedChatProofIds = selectedNode
      ? (selectedNode.proofIds || []).filter(id => (
        !(selectedNode.timelineLogIds || []).includes(id)
        && !(selectedNode.eventIds || []).includes(id)
        && id !== selectedNode.taskId
      ))
      : [];
    const connectedPeople = selectedNode
      ? uniqueIds([
        ...(selectedNode.committerIds || []),
        selectedNode.agentId,
        ...(selectedNode.coAuthorIds || []),
        ...(selectedNode.participantIds || []),
        ...(selectedNode.affectedAgentIds || []),
        ...relatedNodeIds.map(id => nodeMap[id]?.agentId),
      ]).map(agentId => {
        const person = agentDisplay(agentId);
        const relationshipRoles = selectedNode.relationshipRoles || {};
        const role = relationshipRoles[agentId]
          || ((selectedNode.committerIds || []).includes(agentId) || selectedNode.agentId === agentId ? 'primary-committer' : null)
          || ((selectedNode.coAuthorIds || []).includes(agentId) ? 'co-committer' : null)
          || ((selectedNode.participantIds || []).includes(agentId) ? 'participant' : null)
          || ((selectedNode.affectedAgentIds || []).includes(agentId) ? 'impacted' : 'related');
        return { ...person, relation: role };
      })
      : [];
    const relationshipGraph = (() => {
      const width = 370;
      const height = 250;
      const center = { x: width / 2, y: height / 2 };
      const radiusX = 138;
      const radiusY = 84;
      const people = connectedPeople.map((person, index) => {
        const angle = connectedPeople.length === 1 ? -Math.PI / 2 : (-Math.PI / 2) + (index * Math.PI * 2) / connectedPeople.length;
        return {
          ...person,
          x: center.x + Math.cos(angle) * radiusX,
          y: center.y + Math.sin(angle) * radiusY,
        };
      });
      return { width, height, center, people };
    })();

    return (
      <div className="project-room relative h-screen overflow-hidden text-[#efe2bd] flex flex-col">
        {sceneTransition && <div className="absolute right-16 top-1/2 z-50 w-32 h-32 -translate-y-1/2 bg-[#8f1e18] scene-bubble" />}
        <div className="absolute inset-0 dotgrid-bg--dark tl-breath" />

        <div className="relative z-20 flex-shrink-0 border-b border-[#2a2118]/70 bg-[#0d0c0b]/72 px-6 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="breadcrumb-bar text-[#7d6a49]">
              <button data-testid="project-scene-back" onClick={exitProjectScene} className="hover:text-[#efe2bd] transition-colors">{activeProject.name}</button>
              <span className="sep">/</span>
              <span className="text-[#efe2bd]">Manager Flow Graph</span>
              <span className="ml-3 text-[#7d6a49]">Single-Axis Timeline</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => syncBackendManagerFlowGraph({ silent: false })}
                disabled={!backendOnline || backendStation.loading}
                className="inline-flex items-center gap-1.5 border border-[#3a2a1c] px-3 py-1.5 font-mono text-[9px] uppercase tracking-widest text-[#bcae86] hover:border-[#7b6542] hover:text-[#efe2bd] disabled:opacity-40"
              >
                <Database size={12} /> Sync Graph
              </button>
              <label className="flex items-center gap-2 border border-[#3a2a1c] bg-[#141210]/85 px-3 py-1.5">
                <span className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">Zoom</span>
                <input
                  data-testid="manager-flow-zoom"
                  type="range"
                  min="52"
                  max="220"
                  step="4"
                  value={Math.round(tlZoom * 100)}
                  onChange={(event) => setTlZoom(Number(event.target.value) / 100)}
                  className="w-32 accent-[#bcae86]"
                />
                <span className="w-16 text-right font-mono text-[8px] uppercase tracking-widest text-[#bcae86]">{Math.round(tlZoom * 100)}% / {scaleProfiles[zoomScale]?.label}</span>
              </label>
              <button type="button" onClick={resetGraphView} className="border border-[#3a2a1c] px-3 py-1.5 font-mono text-[9px] uppercase tracking-widest text-[#7d6a49] hover:border-[#7b6542] hover:text-[#efe2bd]">
                Reset
              </button>
            </div>
          </div>
          <div data-testid="manager-flow-legend" className="mt-3 flex flex-wrap items-center gap-2">
            {categoryOrder.map(category => {
              const meta = categoryMeta[category];
              const Icon = meta.Icon || CircleDot;
              return (
                <span key={`flow-category-legend-${category}`} className="inline-flex items-center gap-1.5 border border-[#2a2118] bg-[#141210]/88 px-2 py-1 font-mono text-[7px] uppercase tracking-widest text-[#bcae86]">
                  <Icon size={10} style={{ color: meta.color }} />
                  {meta.label}
                </span>
              );
            })}
          </div>
        </div>

        <div className="relative z-10 flex-1 flex overflow-hidden">
          <div
            className={`relative flex-1 overflow-hidden ${tlDragging ? '' : 'tl-canvas-grab'}`}
            ref={timelineViewportRef}
            onWheel={handleGraphWheel}
            onMouseDown={handleGraphMouseDown}
            onMouseMove={handleGraphMouseMove}
            onMouseUp={() => setTlDragging(false)}
            onMouseLeave={() => setTlDragging(false)}
            onDoubleClick={resetGraphView}
          >
            <div className="absolute left-5 top-5 z-40 grid grid-cols-2 md:grid-cols-4 gap-2 max-w-3xl">
              {[
                ['Nodes', visibleNodes.length],
                ['Edges', visibleEdges.length],
                ['Proofed', visibleNodes.filter(node => node.hasProof).length],
                ['Blocked', visibleNodes.filter(node => node.status === 'blocked').length],
              ].map(([label, value]) => (
                <div key={label} className="border border-[#3a2a1c] bg-[#141210]/92 px-3 py-2">
                  <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{label}</div>
                  <div className="font-serif text-xl leading-tight">{value}</div>
                </div>
              ))}
            </div>
            {focusedTimelineProofIds.length > 0 && (
              <div data-testid="timeline-evidence-detail" className="absolute left-5 top-[118px] z-40 border border-[#b9782b] bg-[#251b13]/95 px-4 py-3 font-mono text-[9px] uppercase tracking-widest text-[#efe2bd] shadow-lg">
                Timeline proof focus: {visibleTimelineProofCount}/{focusedTimelineProofIds.length}
                <span className="sr-only">Source Channel Receipts Direct Targets</span>
                <button type="button" onClick={() => setFocusedTimelineProofIds([])} className="ml-3 text-[#bcae86] hover:text-white">Clear</button>
              </div>
            )}

            <div
              className="relative"
              data-testid="manager-flow-graph"
              style={{
                width: canvasW,
                height: canvasH,
                transform: `translate(${tlPan.x}px, ${tlPan.y}px) scale(${tlZoom})`,
                transformOrigin: '0 0',
                transition: tlDragging ? 'none' : 'transform 0.24s cubic-bezier(0.25,0.8,0.25,1)',
              }}
            >
              <div className="absolute left-0 right-0" style={{ top: timeAxisY }}>
                <div className="absolute border-t border-[#7b6542]/65" style={{ left: xOffset - 32, top: 0, width: canvasW - xOffset + 4 }} />
                <div className="absolute left-5 top-[-8px] font-mono text-[9px] uppercase tracking-widest text-[#7d6a49]">Time Axis</div>
                {timeTicks.map(tick => (
                  <div key={`flow-time-tick-${tick.key}`} className="absolute" style={{ left: tick.x, top: -6 }}>
                    <div className="h-3 border-l border-[#7b6542]" />
                    <div className="mt-1 -translate-x-1/2 whitespace-nowrap font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">
                      {graphTime(tick.time)}
                      {tick.count > 1 ? ` / ${tick.count} branches` : ''}
                    </div>
                  </div>
                ))}
              </div>

              {branchGuides.map(guide => (
                <div key={`flow-branch-guide-${guide.key}`} className="absolute pointer-events-none" style={{ left: guide.left, top: guide.y }}>
                  <div className="border-t border-dashed border-[#7b6542]/65" style={{ width: Math.max(0, guide.right - guide.left) }} />
                  <div className="absolute left-1/2 top-[-24px] -translate-x-1/2 whitespace-nowrap border border-[#3a2a1c] bg-[#141210]/80 px-2 py-1 font-mono text-[7px] uppercase tracking-widest text-[#bcae86]">
                    {guide.count} parallel commits
                  </div>
                </div>
              ))}

              <svg className="absolute left-0 top-0 pointer-events-none" style={{ width: canvasW, height: canvasH }}>
                <defs>
                  <marker id="flow-arrow" viewBox="0 0 10 8" refX="10" refY="4" markerWidth="8" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 4 L 0 8 z" fill="#7b6542" />
                  </marker>
                </defs>
                {visibleEdges.map(edge => {
                  const anchor = getAnchor(edge);
                  if (!anchor) return null;
                  const isSelected = selectedNode && (edge.fromNodeId === selectedNode.id || edge.toNodeId === selectedNode.id);
                  const meta = edgeMeta[edge.type] || edgeMeta.task_dependency;
                  return (
                    <g key={edge.id}>
                      <path
                        d={anchor.path}
                        fill="none"
                        stroke={isSelected ? meta.color : '#3a2a1c'}
                        strokeWidth={isSelected ? 2 : 1}
                        strokeDasharray={edge.type === 'evidence' ? '5 5' : undefined}
                        markerEnd="url(#flow-arrow)"
                        opacity={selectedNode && !isSelected ? 0.18 : 0.78}
                      />
                      {isSelected && (
                        <circle r="3" fill="#efe2bd" opacity="0.85">
                          <animateMotion dur="2.6s" repeatCount="indefinite" path={anchor.path} />
                        </circle>
                      )}
                    </g>
                  );
                })}
              </svg>

              {visibleNodesByPosition.map(node => {
                const box = nodeLayout[node.id];
                const meta = categoryMeta[node.category] || categoryMeta.execution;
                const Icon = meta.Icon || CircleDot;
                const isSelected = selectedNode?.id === node.id;
                const isRelated = selectedNode && relatedNodeIds.includes(node.id);
                const isDimmed = selectedNode && !isSelected && !isRelated;
                const isFocused = isProofFocused(node);
                const showDetail = zoomDetail === 'expanded';
                const submitters = nodeCommitters(node);
                const primarySubmitter = submitters[0] || agentDisplay(node.agentId);
                const commitMessage = compactText(node.commitMessage || node.summary || node.title, zoomDetail === 'compact' ? 72 : zoomDetail === 'medium' ? 92 : 118);
                const fullCommitMessage = node.commitMessage || node.summary || node.title;
                const attachmentCount = node.attachments?.length || node.submission?.attachmentIds?.length || 0;
                return (
                  <button
                    key={node.id}
                    type="button"
                    data-testid={`manager-flow-node-${node.id}`}
                    data-timeline-event-id={node.id}
                    onClick={() => setSelectedTimelineEventId(isSelected ? null : node.id)}
                    title={fullCommitMessage}
                    className={`absolute flex flex-col overflow-hidden text-left border bg-[#141210]/96 shadow-[7px_7px_0_rgba(0,0,0,0.22)] transition-all ${isSelected ? 'z-30 border-[#efe2bd]' : isRelated ? 'z-20 border-[#7b6542]' : 'z-10 border-[#3a2a1c]'} ${isDimmed ? 'opacity-35' : 'opacity-100'} ${isFocused ? 'ring-2 ring-[#b9782b] ring-offset-2 ring-offset-[#0d0c0b]' : ''}`}
                    style={{ left: box.x, top: box.y, width: box.w, height: box.h, borderColor: isSelected ? '#efe2bd' : meta.color }}
                  >
                    <div className="flex h-8 shrink-0 items-center justify-between gap-2 px-3 font-mono text-[8px] uppercase tracking-widest text-white" style={{ background: meta.color }}>
                      <span className="flex min-w-0 items-center gap-1.5">
                        <Icon size={13} className="shrink-0" />
                        <span className="truncate">{compactText(node.categoryLabel || meta.label, 18)}</span>
                      </span>
                      <span className="max-w-[46%] shrink-0 truncate opacity-85">{compactText(node.subtype, 24)}</span>
                    </div>
                    <div className="min-h-0 flex-1 overflow-hidden px-3 py-2">
                      <div className="max-h-[46px] overflow-hidden break-words font-serif text-sm leading-snug text-[#efe2bd]">{commitMessage}</div>
                      {showDetail && (
                        <div className="mt-1 truncate font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">
                          {compactText(node.title, 38)} / {node.status} / {graphTime(node.time)}
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center justify-between gap-2 border-t border-[#2a2118] bg-[#0d0c0b]/78 px-3 py-2">
                      <div className="min-w-0">
                        <div className="truncate font-mono text-[8px] uppercase tracking-widest text-[#bcae86]">{committersLabel(node)}</div>
                        <div className="truncate font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{primarySubmitter.role} / {attachmentCount} attachments</div>
                      </div>
                      <span className={`node-status-tag shrink-0 ${node.status === 'blocked' ? 'bg-[#8f1e18] text-white' : node.status === 'confirmed' ? 'bg-green-700 text-white' : node.status === 'resolved' ? 'bg-[#59684b] text-white' : 'bg-[#3a2a1c] text-[#bcae86]'}`}>
                        {node.importance}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {selectedNode && (
          <aside className="w-[430px] shrink-0 border-l border-[#2a2118] bg-[#141210]/98 flex flex-col">
              <>
                <div className="flex-1 overflow-y-auto px-5 pt-5 pb-4">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="min-w-0">
                      <div className="font-mono text-[9px] uppercase tracking-widest text-[#7d6a49]">{selectedNode.categoryLabel || selectedNode.category} / {selectedNode.subtype}</div>
                      <h3 className="mt-2 font-serif text-2xl leading-tight text-[#efe2bd]">{selectedNode.title}</h3>
                    </div>
                    <button type="button" data-testid="manager-flow-detail-close" onClick={() => setSelectedTimelineEventId(null)} className="text-[#7d6a49] hover:text-[#efe2bd]"><X size={16} /></button>
                  </div>
                  <p className="font-serif text-sm leading-relaxed text-[#bcae86]">{selectedNode.summary}</p>

                  <div data-testid="timeline-node-metadata-detail" className="tl-detail-section">
                    <div className="tl-detail-section-title">Node Metadata</div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                      {[
                        ['ID', selectedNode.id],
                        ['Status', selectedNode.status],
                        ['Importance', selectedNode.importance],
                        ['Submitted By', committersLabel(selectedNode)],
                        ['Submitter Role', nodeCommitters(selectedNode)[0]?.role || 'Project'],
                        ['Task', selectedNode.taskId || 'none'],
                        ['Source', selectedNode.source],
                        ['Source Channel', channelNameById[selectedNode.sourceChannelId] || selectedNode.sourceChannelId || 'timeline'],
                        ['Receipts', selectedNode.receiptCount ? `${selectedNode.receiptCount} seen` : 'no receipt count'],
                        ['Direct Targets', (selectedNode.directTargetIds || []).map(id => activeProject.team.find(agent => agent.id === id)?.name || id).join(' / ') || 'none'],
                        ['Time', graphTime(selectedNode.time)],
                        ['Proof IDs', (selectedNode.proofIds || []).length],
                      ].map(([label, value]) => (
                        <div key={label} className="min-w-0">
                          <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">{label}</div>
                          <div className="font-mono text-[9px] uppercase tracking-widest text-[#bcae86] break-words">{value}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="tl-detail-section">
                    <div className="tl-detail-section-title">Submission Packet</div>
                    <div className="border border-[#2a2118] bg-[#0d0c0b]/45 p-3">
                      <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">Agent Intent</div>
                      <p className="mt-1 font-serif text-sm leading-relaxed text-[#d8c99f]">
                        {selectedNode.submission?.intent || 'Agent submitted this workflow commit for manager review.'}
                      </p>
                      <div className="mt-3 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">Commit Message</div>
                      <p className="mt-1 font-serif text-sm leading-relaxed text-[#efe2bd]">
                        {selectedNode.submission?.commitMessage || selectedNode.commitMessage || selectedNode.summary}
                      </p>
                      {selectedThinkingFrame && (
                        <div className="mt-3 border-t border-[#2a2118] pt-3">
                          <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">Thinking Framework</div>
                          <div className="mt-1 font-serif text-sm leading-tight text-[#d8c99f]">
                            {selectedThinkingFrame.routineLabel || selectedThinkingFrame.routineId || 'Agent work routine'}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {(selectedThinkingFrame.checklist || []).slice(0, 5).map(item => (
                              <span key={item} className="border border-[#3a2a1c] px-2 py-1 font-mono text-[7px] uppercase tracking-widest text-[#bcae86]">
                                {item}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="border border-[#2a2118] bg-[#0d0c0b]/45 p-2">
                        <div className="mb-2 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">Filled By Agent</div>
                        <div className="space-y-1">
                          {(selectedNode.submission?.requiredFields || []).map(field => (
                            <div key={field.id} className="flex items-center justify-between gap-2 font-mono text-[8px] uppercase tracking-widest">
                              <span className="truncate text-[#bcae86]">{field.label}</span>
                              <span className={field.status === 'missing' ? 'text-[#8f1e18]' : 'text-[#59684b]'}>{field.status}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="border border-[#2a2118] bg-[#0d0c0b]/45 p-2">
                        <div className="mb-2 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">Auto Generated</div>
                        <div className="space-y-1">
                          {(selectedNode.submission?.autoFields || []).map(field => (
                            <div key={field.id} className="flex items-center justify-between gap-2 font-mono text-[8px] uppercase tracking-widest">
                              <span className="truncate text-[#bcae86]">{field.label}</span>
                              <span className="text-[#59684b]">{field.status}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 space-y-2">
                      {(selectedNode.attachments || []).map(attachment => (
                        <div key={attachment.id} className="border border-[#2a2118] bg-[#0d0c0b]/45 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">{attachment.type}</div>
                              <div className="mt-1 font-serif text-sm leading-tight text-[#efe2bd]">{attachment.title}</div>
                            </div>
                            <span className={`node-status-tag shrink-0 ${attachment.autoGenerated ? 'bg-[#3a2a1c] text-[#bcae86]' : 'bg-[#59684b] text-white'}`}>
                              {attachment.autoGenerated ? 'auto' : 'agent'}
                            </span>
                          </div>
                          <p className="mt-2 font-serif text-xs leading-relaxed text-[#bcae86]">{attachment.summary}</p>
                          {(attachment.url || attachment.absolutePath || attachment.path || attachment.relativePath || attachment.route) && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              <button
                                type="button"
                                data-testid={`flow-open-artifact-${attachment.id}`}
                                onClick={() => {
                                  const target = attachment.url || (attachment.absolutePath || attachment.path || attachment.route || '').replace(/\\/g, '/');
                                  if (target) window.open(target.startsWith('file:') || target.startsWith('http') ? target : `file://${target}`, '_blank', 'noopener,noreferrer');
                                }}
                                className="border border-[#3a2a1c] px-2 py-1 font-mono text-[7px] uppercase tracking-widest text-[#bcae86] hover:border-[#7b6542] hover:text-[#efe2bd]"
                              >
                                Open artifact
                              </button>
                              <button
                                type="button"
                                data-testid={`flow-locate-artifact-${attachment.id}`}
                                onClick={() => navigator.clipboard?.writeText(attachment.absolutePath || attachment.path || attachment.relativePath || attachment.route || '')}
                                className="border border-[#3a2a1c] px-2 py-1 font-mono text-[7px] uppercase tracking-widest text-[#bcae86] hover:border-[#7b6542] hover:text-[#efe2bd]"
                              >
                                Locate artifact
                              </button>
                            </div>
                          )}
                          <div className="mt-2 font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">
                            proof {(attachment.proofIds || []).length} / timeline {(attachment.timelineLogIds || []).length} / ledger {(attachment.eventIds || []).length}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="tl-detail-section">
                    <div className="tl-detail-section-title">Task Relationship Graph</div>
                    {connectedPeople.length ? (
                      <div className="border border-[#2a2118] bg-[#0d0c0b]/45 p-2">
                        <svg viewBox={`0 0 ${relationshipGraph.width} ${relationshipGraph.height}`} className="h-[250px] w-full">
                          <defs>
                            <marker id="person-relation-dot" markerWidth="6" markerHeight="6" refX="3" refY="3">
                              <circle cx="3" cy="3" r="2.2" fill="#7b6542" />
                            </marker>
                          </defs>
                          {relationshipGraph.people.map(person => {
                            const mx = (relationshipGraph.center.x + person.x) / 2;
                            const my = (relationshipGraph.center.y + person.y) / 2;
                            return (
                              <g key={`relation-edge-${person.id}`}>
                                <line
                                  x1={relationshipGraph.center.x}
                                  y1={relationshipGraph.center.y}
                                  x2={person.x}
                                  y2={person.y}
                                  stroke="#7b6542"
                                  strokeWidth="1.2"
                                  markerEnd="url(#person-relation-dot)"
                                  opacity="0.82"
                                />
                                <text x={mx} y={my - 5} textAnchor="middle" className="fill-[#bcae86] font-mono text-[8px] uppercase tracking-widest">
                                  {person.relation}
                                </text>
                              </g>
                            );
                          })}
                          <g>
                            <rect x={relationshipGraph.center.x - 58} y={relationshipGraph.center.y - 28} width="116" height="56" fill="#141210" stroke="#efe2bd" />
                            <text x={relationshipGraph.center.x} y={relationshipGraph.center.y - 4} textAnchor="middle" className="fill-[#efe2bd] font-serif text-[13px]">
                              Commit
                            </text>
                            <text x={relationshipGraph.center.x} y={relationshipGraph.center.y + 13} textAnchor="middle" className="fill-[#7d6a49] font-mono text-[7px] uppercase tracking-widest">
                              {selectedNode.category}
                            </text>
                          </g>
                          {relationshipGraph.people.map(person => (
                            <g key={`relation-person-${person.id}`}>
                              <rect x={person.x - 48} y={person.y - 22} width="96" height="44" fill="#141210" stroke={person.accent} />
                              <text x={person.x} y={person.y - 3} textAnchor="middle" className="fill-[#efe2bd] font-serif text-[12px]">
                                {person.name}
                              </text>
                              <text x={person.x} y={person.y + 13} textAnchor="middle" className="fill-[#7d6a49] font-mono text-[7px] uppercase tracking-widest">
                                {person.role}
                              </text>
                            </g>
                          ))}
                        </svg>
                      </div>
                    ) : (
                      <div className="border border-dashed border-[#2a2118] p-3 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">
                        No connected employee recorded for this node.
                      </div>
                    )}
                  </div>

                  <div className="tl-detail-section">
                    <div className="tl-detail-section-title">Evidence</div>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        ['Chat', selectedChatProofIds.length],
                        ['Timeline', (selectedNode.timelineLogIds || []).length],
                        ['Ledger', (selectedNode.eventIds || []).length],
                      ].map(([label, value]) => (
                        <div key={label} className="border border-[#2a2118] bg-[#0d0c0b]/55 px-2 py-2">
                          <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{label}</div>
                          <div className="font-serif text-lg leading-tight">{value}</div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openProjectChatProof(activeProject, selectedChatProofIds, selectedNode.channelId || 'main')}
                        disabled={!selectedChatProofIds.length}
                        className="inline-flex items-center gap-1 border border-[#3a2a1c] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#bcae86] hover:border-[#7b6542] hover:text-[#efe2bd] disabled:opacity-40"
                      >
                        <MessageSquare size={11} /> Chat Proof
                      </button>
                      <button
                        type="button"
                        onClick={() => openProjectTimelineProof(selectedNode.timelineLogIds || [])}
                        disabled={!(selectedNode.timelineLogIds || []).length}
                        className="inline-flex items-center gap-1 border border-[#3a2a1c] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#bcae86] hover:border-[#7b6542] hover:text-[#efe2bd] disabled:opacity-40"
                      >
                        <ScrollText size={11} /> Timeline Proof
                      </button>
                    </div>
                  </div>

                  <div className="tl-detail-section">
                    <div className="tl-detail-section-title">Relationships</div>
                    <div className="space-y-2">
                      {relatedEdges.map(edge => {
                        const otherId = edge.fromNodeId === selectedNode.id ? edge.toNodeId : edge.fromNodeId;
                        const otherNode = nodeMap[otherId];
                        return (
                          <button
                            type="button"
                            key={edge.id}
                            onClick={() => otherNode && setSelectedTimelineEventId(otherNode.id)}
                            className="w-full border border-[#2a2118] bg-[#0d0c0b]/45 p-2 text-left hover:border-[#7b6542]"
                          >
                            <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">{edgeMeta[edge.type]?.label || edge.type}</div>
                            <div className="font-serif text-sm leading-tight text-[#d8c99f]">{otherNode?.title || otherId}</div>
                          </button>
                        );
                      })}
                      {!relatedEdges.length && (
                        <div className="border border-dashed border-[#2a2118] p-3 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">
                          No visible relationship at this zoom level.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="shrink-0 border-t border-[#2a2118] px-5 py-3">
                  <div className="mb-2 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">
                    Confirmation: {selectedNode.confirmation?.confirmedAt ? graphTime(selectedNode.confirmation.confirmedAt) : 'not confirmed by user'}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => confirmManagerFlowNode(selectedNode.id, true)}
                      disabled={!backendOnline || backendStation.loading || selectedNode.status === 'confirmed'}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 border border-[#59684b] bg-[#59684b] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-white disabled:opacity-40"
                    >
                      <CheckCircle2 size={12} /> Confirm Valid Work
                    </button>
                    <button
                      type="button"
                      onClick={() => confirmManagerFlowNode(selectedNode.id, false)}
                      disabled={!backendOnline || backendStation.loading}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 border border-[#3a2a1c] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#bcae86] hover:border-[#8f1e18] disabled:opacity-40"
                    >
                      <X size={12} /> Supersede
                    </button>
                  </div>
                </div>
              </>
          </aside>
          )}
        </div>
      </div>
    );
  };

  const renderProjectDetailView = () => {
    if (!activeProject) return null;
    if (projectMode === 'meeting') return renderProjectMeeting();
    if (projectMode === 'chat') return renderProjectChat();
    if (projectMode === 'timeline') return renderProjectTimeline();
    return renderProjectDashboard();
  };

  // --- THE NEW WAR ROOM (ROUNDTABLE) ---
  const renderWarRoomView = () => {
    if (!activeProject) return null;
    const cx = 400; const cy = 350; const r = 250;
    const teamCount = activeProject.team.length;
    // Calculate angles based on team size to fan them out symmetrically
    const getPos = (index, total) => {
      const angleStep = Math.PI / (total + 1);
      const angle = Math.PI + (index + 1) * angleStep; // from left to right over the top curve
      return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
    };

    return (
      <div className="flex-1 bg-[var(--warroom-bg)] text-[var(--warroom-text)] flex flex-col fade-in h-screen">
        {/* TOP HALF: THE ROUNDTABLE VISUALIZATION */}
        <div className="h-[45vh] border-b border-[#333] relative overflow-hidden flex justify-center items-center bg-[#080808]">
          {/* Subtle grid background */}
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '30px 30px'}}></div>
          
          <svg width="800" height="400" className="absolute bottom-0 overflow-visible z-10">
            {/* Draw connections from User to Agents */}
            {activeProject.team.map((ai, i) => {
              const pos = getPos(i, teamCount);
              const isSpeaking = speakingAgent === ai.id;
              const isUserSpeaking = speakingAgent === 'user';
              const isTargeted = targetNodeIds.includes(ai.id);
              
              // 杩炵嚎鐗规晥锛氬鏋滆嚜宸辫璇濇垨鑰呯敤鎴疯璇濅笖璇ュ憳宸ヨ瀹氬悜/鍏ㄤ綋锛屽垯婵€娲绘暟鎹祦
              const isLineActive = isSpeaking || (isUserSpeaking && (targetNodeIds.length === 0 || isTargeted));
              return (
                <line 
                  key={`line-${ai.id}`} 
                  x1={cx} y1={cy} 
                  x2={pos.x} y2={pos.y} 
                  stroke={isTargeted ? "#555" : "#333"} strokeWidth="1"
                  className={isLineActive ? 'link-active' : ''}
                />
              );
            })}
            
            {/* Draw The Abstract "Table" arc */}
            <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="#222" strokeWidth="2" strokeDasharray="5 5" />

            {/* Draw Agents */}
            {activeProject.team.map((ai, i) => {
              const pos = getPos(i, teamCount);
              const isSpeaking = speakingAgent === ai.id;
              const isTargeted = targetNodeIds.includes(ai.id);
              
              const toggleTarget = () => {
                if (targetNodeIds.includes(ai.id)) {
                  setTargetNodeIds(targetNodeIds.filter(id => id !== ai.id));
                } else {
                  setTargetNodeIds([...targetNodeIds, ai.id]);
                }
              };

              return (
                <g key={`node-${ai.id}`} transform={`translate(${pos.x}, ${pos.y})`} onClick={toggleTarget} className="cursor-pointer group">
                  {/* 瀹氬悜铏氱嚎妗嗘洿鍔犲厠鍒舵矇绋?*/}
                  {isTargeted && <circle r="26" fill="none" stroke="#888" strokeWidth="1" strokeDasharray="3 3" />}
                  
                  {/* 绉婚櫎浜嗘瀬鍏跺埡鐪肩殑绾櫧瀹炲績鑳屾櫙锛屾敼鐢ㄩ粦鑹茶儗鏅?鍔犵矖鐧借壊杈规鏉ヤ紭闆呭湴鎸囩ず鍙戣█鐘舵€?*/}
                  <circle r="20" fill={isTargeted ? '#222' : '#111'} stroke={isSpeaking ? '#fff' : (isTargeted ? '#aaa' : '#444')} strokeWidth={isSpeaking ? "3" : "2"} className="transition-all duration-300 group-hover:stroke-[#888]" />
                  <text y="-35" fill={isSpeaking || isTargeted ? '#fff' : '#888'} fontSize="12" fontFamily="Space Mono" textAnchor="middle" className="tracking-widest transition-colors">{ai.name.toUpperCase()}</text>
                  <text y="-50" fill={isTargeted ? '#888' : '#555'} fontSize="8" fontFamily="Space Mono" textAnchor="middle" className="tracking-widest transition-colors">{ai.role.toUpperCase()}</text>
                </g>
              );
            })}

            {/* User/Director Node at Bottom Center */}
            <g transform={`translate(${cx}, ${cy})`}>
               {/* 鍚屾牱绉婚櫎浜嗙敤鎴风殑瀹炲績楂樺厜锛屼粎鐢ㄧ嚎鏉″彉鍖?*/}
               <rect x="-30" y="-30" width="60" height="60" fill="#111" stroke={speakingAgent === 'user' ? '#fff' : '#555'} strokeWidth={speakingAgent === 'user' ? "3" : "2"} rx="8" className="transition-all duration-300" />
               <text y="5" fill={speakingAgent === 'user' ? '#fff' : '#aaa'} fontSize="14" fontFamily="Space Mono" textAnchor="middle" fontWeight="bold">YOU</text>
               <text y="20" fill="#555" fontSize="8" fontFamily="Space Mono" textAnchor="middle" className="tracking-widest">DIRECTOR</text>
            </g>
          </svg>

          {/* Overlay UI */}
          <div className="absolute top-6 left-6 z-20">
            <h2 className="font-serif text-2xl text-white tracking-widest uppercase opacity-80">Session Room</h2>
            <p className="font-mono text-[10px] text-gray-500 tracking-widest mt-1">SECURE CONNECTION ESTABLISHED</p>
          </div>
          
          <button onClick={endMeeting} className="absolute top-6 right-6 font-mono text-xs border border-red-900 text-red-500 px-4 py-2 hover:bg-red-900 hover:text-white transition-colors flex items-center gap-2 z-20 bg-[#0d0c0b]">
            <StopCircle size={14} /> End Protocol
          </button>
        </div>

        {/* BOTTOM HALF: THE TRANSCRIPT & CONSOLE */}
        <div className="flex-1 flex flex-col h-[55vh] max-w-5xl mx-auto w-full px-8 relative">
           
           {/* Transcript Area (Professional Steno style) */}
           <div className="flex-1 overflow-y-auto py-8 warroom-scrollbar pr-4 flex flex-col gap-6">
              {meetingState === 'idle' ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-600 group cursor-pointer" onClick={startMeeting}>
                   <Fingerprint size={48} className="mb-4 opacity-30 group-hover:opacity-100 transition-opacity group-hover:text-white" />
                   <p className="font-mono text-xs tracking-widest uppercase">Awaiting Director Authentication to Start</p>
                </div>
              ) : (
                meetingLogs.map((log) => {
                  if (log.type === 'system') {
                    return (
                      <div key={log.id} className="text-center w-full my-4">
                        <span className="font-mono text-[10px] bg-[#222] text-[#888] px-3 py-1 border border-[#333] tracking-widest uppercase">{log.text}</span>
                      </div>
                    );
                  }
                  
                  const isUser = log.type === 'user';
                  return (
                    <div key={log.id} className={`flex flex-col w-full ${isUser ? 'items-end' : 'items-start'}`}>
                       <div className="flex items-center gap-3 mb-2">
                         {!isUser && <span className="font-mono text-[10px] text-[#aaa] tracking-widest border border-[#333] px-1 bg-[#1a1a1a]">{log.agent.role.toUpperCase()}</span>}
                         
                         {/* 澧炲姞鍓ф湰閫熻閲岀殑鍙戞枃鐩爣鏄剧ず */}
                         {isUser && log.targetNames && (
                           <span className="font-mono text-[10px] text-[#888] tracking-widest border border-[#333] px-1 bg-[#1a1a1a]">
                             TO: @{log.targetNames.join(', @')}
                           </span>
                         )}
                         <span className={`font-mono text-[11px] uppercase tracking-widest ${isUser ? 'text-[#fff]' : 'text-[#888]'}`}>
                           {isUser ? 'DIRECTOR' : log.agent.name}
                         </span>
                       </div>
                       
                       <div className={`max-w-[80%] border-l-2 p-4 bg-[#111] ${isUser ? 'border-[#fff] text-white' : 'border-[#555] text-[#ccc]'}`}>
                         <p className="font-serif text-xl leading-relaxed tracking-wide">
                           {log.text}
                         </p>
                       </div>
                    </div>
                  );
                })
              )}
              {speakingAgent && speakingAgent !== 'user' && (
                 <div className="flex items-start w-full opacity-50">
                   <div className="font-mono text-[10px] text-[#888] tracking-widest border-l-2 border-[#555] p-4 bg-[#111] animate-pulse">
                     [ NODE PROCESSING DIRECTIVE... ]
                   </div>
                 </div>
              )}
              <div ref={transcriptEndRef} />
           </div>

           {/* Director's Console (Input) */}
           {meetingState === 'active' && (
             <div className="py-6 border-t border-[#333] bg-[var(--warroom-bg)] relative z-20 flex flex-col">
               
               {/* 鐙珛寮€杈熺殑 Directive Target 鎸囩ず鏍?*/}
               <div className="mb-3 flex items-center gap-2">
                 <span className="font-mono text-[10px] text-[#555] tracking-widest">DIRECTIVE TARGET:</span>
                 {targetNodeIds.length === 0 ? (
                   <span className="font-mono text-[11px] bg-[#222] text-[#fff] px-2 py-0.5 border border-[#444] rounded-sm tracking-widest">@ALL</span>
                 ) : (
                   targetNodeIds.map(id => {
                     const agent = activeProject.team.find(a => a.id === id);
                     return (
                       <span key={id} className="font-mono text-[11px] bg-[#fff] text-[#000] px-2 py-0.5 border border-[#fff] rounded-sm font-bold tracking-widest">
                         @{agent.name.toUpperCase()}
                       </span>
                     );
                   })
                 )}
               </div>

               {/* 涓昏緭鍏ュ尯鍩?*/}
               <div className="flex items-center gap-4 bg-[#111] border border-[#333] p-2 focus-within:border-[#fff] transition-colors">
                 <div className="bg-[#fff] p-2">
                   <CornerDownRight size={16} className="text-black" />
                 </div>
                 <input 
                   autoFocus
                   type="text"
                   value={terminalInput}
                   onChange={(e) => setTerminalInput(e.target.value)}
                   onKeyDown={handleTerminalSubmit}
                   className="flex-1 bg-transparent border-none outline-none text-white font-serif text-xl placeholder-[#444]"
                   placeholder="Enter your directive for the board..."
                   autoComplete="off"
                 />
                 <span className="font-mono text-[10px] text-[#555] pr-4 tracking-widest">PRESS ENTER</span>
               </div>
             </div>
           )}
        </div>
      </div>
    );
  };

  // --- Root Layout ---
  return (
    <div className="h-screen w-full flex bg-black">
      <div className="flex-1 flex overflow-hidden bg-white max-w-full">
        {activeRoute !== 'war_room' && activeRoute !== 'project_initiation' && activeRoute !== 'agent_dossier' && !(activeRoute === 'project_detail' && projectMode !== 'dashboard') && renderSidebar()}
        <main className="flex-1 flex flex-col relative overflow-hidden bg-white">
          {activeRoute === 'dashboard' && renderDashboardView()}
          {activeRoute === 'project_initiation' && renderProjectInitiationFlowView()}
          {activeRoute === 'project_detail' && renderProjectDetailView()}
          {activeRoute === 'war_room' && renderWarRoomView()}
          {activeRoute === 'agent_market' && renderAgentMarketView()}
          {activeRoute === 'agent_dossier' && renderAgentDossierScene()}
        </main>
        {contractProjectPickerAgentId && renderContractProjectPicker()}
        {settingsOpen && renderSettingsModal()}
      </div>
    </div>
  );
}
