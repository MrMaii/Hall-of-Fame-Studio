import { useState, useEffect, useRef } from 'react';
import { 
  Settings, Grid, LayoutPanelLeft, Box,
  MessageSquare, Plus, Network, Cpu, Clock, 
  CheckCircle2, Activity, Play, StopCircle, CornerDownRight, 
  Fingerprint, ChevronRight, BarChart3, Database, Search, SlidersHorizontal, FileSignature,
  ArrowLeft, Shield, Crosshair, BookOpen, Briefcase, ScanLine,
  Send, Hash, GitCommit, GitBranch, FileText, Code2, MessageCircle, Users, Mic2,
  DoorOpen, ScrollText, Monitor, ClipboardList, Sparkles, CircleDot,
  Pin, Reply, AtSign, Volume2, ChevronLeft, Paperclip, BellDot, Headphones, X,
  UserCircle, KeyRound, Server, Globe2, PlugZap, WalletCards, Eye, EyeOff, Save
} from 'lucide-react';
import {
  PERSON_SKILL_COUNT,
  PERSON_SKILL_DOC_COUNT,
  buildDossierProfileFromSkill,
  createRoundtablePlan,
  getPersonSkill,
} from './skills/personSkillSystem.js';
import {
  advanceAutonomousProjectCycle,
  buildAgentChatReplies,
  createAutonomousCycleChatMessages,
  createAgentNetwork,
  createKickoffCharter,
  createKickoffRoleNegotiation,
  createLeaderAssignmentPackage,
  createLeaderElection,
  evaluateCollaborationState,
  handleLeaderChatAssignment,
  handlePeerHandoff,
  handleFeatureChangeRequest,
  isLeaderAssignmentRequest,
  isPeerHandoffRequest,
  isFeatureChangeRequest,
  MEETING_PROTOCOLS,
  routeDirectorDirective,
  runRoundtableExchange,
  startAgentSession,
} from './agents/agentRuntime.js';

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

  /* 彻底重写的连线数据流动画，取消透明度频闪，改为平滑的虚线流动 */
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

// --- Mock Architecture Data ---
const AGENTS = [
  { id: 'pm_1', name: 'Alan', role: 'Project Manager', skill: 'Agile' },
  { id: 'rd_1', name: 'Linus', role: 'Tech Lead', skill: 'Architecture' },
  { id: 'ds_1', name: 'Dieter', role: 'UX Designer', skill: 'Minimalism' },
  { id: 'mk_1', name: 'Don', role: 'Strategy', skill: 'Market' },
];

const INITIAL_PROJECTS = [
  {
    id: 'p_1001',
    name: 'Hall of Fame Studio V1',
    status: 'executing',
    progress: 68,
    autonomy: { enabled: true, cadence: 'hourly' },
    lastAutonomousRunAt: null,
    team: [AGENTS[0], AGENTS[1], AGENTS[2]],
    tasks: [
      { id: 1, text: 'Define minimalist color palette', assignee: 'Dieter', status: 'done' },
      { id: 2, text: 'Setup BYOK Auth Middleware', assignee: 'Linus', status: 'in-progress' },
    ],
    logs: [
      { time: '14:22 PM', agent: 'Dieter', log: 'Updated layout grid. Reduced margin by 4px globally.' },
      { time: '09:00 AM', agent: 'Alan', log: 'Initiated daily sprint. Assigned micro-tasks.' }
    ]
  },
  {
    id: 'p_1002',
    name: 'Apollo Neural API',
    status: 'drafting',
    progress: 12,
    autonomy: { enabled: false, cadence: 'daily' },
    lastAutonomousRunAt: null,
    team: [AGENTS[1], AGENTS[3]],
    tasks: [
      { id: 3, text: 'Analyze competitor pricing', assignee: 'Don', status: 'in-progress' },
      { id: 4, text: 'Design DB schema', assignee: 'Linus', status: 'pending' },
    ],
    logs: [
      { time: 'Yesterday', agent: 'Don', log: 'Market research document generated and attached.' }
    ]
  }
];

const STORAGE_KEYS = {
  projects: 'hall_of_fame_studio.projects.v1',
  chatMessages: 'hall_of_fame_studio.chat_messages.v1',
};

const hydrateProject = (project) => ({
  ...project,
  autonomy: project.autonomy || { enabled: false, cadence: 'hourly' },
  autonomousLedger: project.autonomousLedger || [],
  lastAutonomousRunAt: project.lastAutonomousRunAt || null,
});

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

const loadInitialProjects = () => {
  const stored = readStoredJson(STORAGE_KEYS.projects, null);
  return Array.isArray(stored) && stored.length
    ? stored.map(hydrateProject)
    : INITIAL_PROJECTS.map(hydrateProject);
};

const INITIATION_MEMBERS = [
  { id: 'founder', name: 'You', title: 'Founder', duty: '提出项目方向，裁定是否进入正式项目' },
  { id: 'jobs', name: 'Steve Jobs', title: 'Product Visionary', duty: '判断产品是否足够锋利，收敛体验与发布叙事' },
  { id: 'turing', name: 'Alan Turing', title: 'System Architect', duty: '拆解系统边界、技术路径、边界情况和可证明性' },
  { id: 'curie', name: 'Marie Curie', title: 'Evidence Reviewer', duty: '检查证据链、验证路径、实验设计与不确定性' },
  { id: 'confucius', name: 'Confucius', title: 'Consensus Steward', duty: '校准角色、共识、责任秩序和长期组织影响' },
  { id: 'musk', name: 'Elon Musk', title: 'Execution Driver', duty: '压缩复杂度，推动原型、成本、速度和发布节奏' },
];

const INITIATION_LOGS = [
  { who: 'You', tone: 'PROPOSAL', text: '我想做一个创作者名人堂工作台。它不是普通项目管理，而是让一个想法先经过圆桌会议，再变成真正的项目。' },
  { who: 'Steve Jobs', tone: 'PRODUCT', text: '先别急着堆功能。这个流程要让用户感觉项目是被认真批准的，不是又多了一个表单。' },
  { who: 'Alan Turing', tone: 'SYSTEM', text: '我会把它拆成状态机：brief、invite、lobby、meeting、result。每一步都要有明确出口。' },
  { who: 'Marie Curie', tone: 'EVIDENCE', text: '批准项目之前必须留下验证口径：为什么做、谁负责、第一份产出如何判定有效。' },
  { who: 'Elon Musk', tone: 'EXECUTION', text: '把会议压缩成能推进的机制。72 小时内必须能从一个意图生成可执行项目。' },
];

const INITIATION_CONSENSUS = [
  { label: 'Project', value: 'Hall of Fame Studio: Roundtable Initiation' },
  { label: 'First Lead', value: 'Steve Jobs' },
  { label: 'Reviewer', value: 'Marie Curie' },
  { label: 'Working Group', value: 'Turing / Confucius / Musk / You' },
  { label: 'Output', value: 'Clickable product mock + initiation record' },
  { label: 'Decision', value: 'Approved for dashboard entry' },
];

// knownName：默认 before + last（last 标红）；诸葛为姓在前，用 family + given（family 标红）
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
  const c = red.replace(/[^A-Za-zÀ-ÿ]/g, '').charAt(0) || agent.name.charAt(0);
  return c;
};

// 殿堂级人才库 (The Pantheon) — 与人物市场.md Top40 对齐；id 为平台 slug
// primaryIdentity：第一被认知身份（大众一眼能对上号的那张「名片」）
const LEGENDARY_AGENTS = [
  { id: 'einstein', name: 'Albert Einstein', knownName: { before: 'Albert ', last: 'Einstein' }, primaryIdentity: '相对论之父', role: 'Paradigm Shifter', category: 'Science', desc: '思想实验与相对论式直觉。从最高抽象层重构问题边界。', price: '$2.80/req' },
  { id: 'newton', name: 'Isaac Newton', knownName: { before: 'Isaac ', last: 'Newton' }, primaryIdentity: '经典力学与万有引力之父', role: 'Fundamentalist', category: 'Analytical', desc: '公理化与万有引力式底层洞察。建立不可动摇的逻辑与数学基础。', price: '$2.40/req' },
  { id: 'shakespeare', name: 'William Shakespeare', knownName: { before: 'William ', last: 'Shakespeare' }, primaryIdentity: '莎翁、《哈姆雷特》背后的名字', role: 'Dramaturg', category: 'Creative', desc: '人性冲突与多声部叙事。把复杂利害写成高密度、可执行的「剧本结构」。', price: '$2.00/req' },
  { id: 'musk', name: 'Elon Musk', knownName: { before: 'Elon ', last: 'Musk' }, primaryIdentity: 'Tesla / SpaceX 掌门人', role: 'Chief Disruptor', category: 'Visionary', desc: '第一性原理与极端目标。多线并行、工程降本、叙事融资；高风险高回报。', price: '$2.50/req' },
  { id: 'jobs', name: 'Steve Jobs', knownName: { before: 'Steve ', last: 'Jobs' }, primaryIdentity: '苹果灵魂人物、iPhone 之父', role: 'Product Visionary', category: 'Visionary', desc: '科技与人文交叉口。对细节偏执、极简至境；把产品做成文化符号。', price: '$2.80/req' },
  { id: 'disney', name: 'Walt Disney', knownName: { before: 'Walt ', last: 'Disney' }, primaryIdentity: '米老鼠之父、迪士尼乐园缔造者', role: 'Experience Creator', category: 'Visionary', desc: '世界观级体验。把功能交付升格为可沉浸的故事与情感旅程。', price: '$2.30/req' },
  { id: 'churchill', name: 'Winston Churchill', knownName: { before: 'Winston ', last: 'Churchill' }, primaryIdentity: '二战英国首相、「V」字演说', role: 'Morale Booster', category: 'Strategy', desc: '逆境叙事与绝不妥协的韧性。团队濒临崩溃时锚定方向与士气。', price: '$1.85/req' },
  { id: 'da_vinci', name: 'Leonardo da Vinci', knownName: { before: 'Leonardo ', last: 'da Vinci' }, primaryIdentity: '《蒙娜丽莎》、文艺复兴全才', role: 'Creative Polymath', category: 'Creative', desc: '艺术与工程一体。解剖级观察 + 系统草图，产出美且可落地的方案。', price: '$2.20/req' },
  { id: 'picasso', name: 'Pablo Picasso', knownName: { before: 'Pablo ', last: 'Picasso' }, primaryIdentity: '立体主义大师', role: 'Visual Disruptor', category: 'Creative', desc: '打破视觉规则。反常规的品牌与交互张力，一击即中的符号化表达。', price: '$2.00/req' },
  { id: 'marx', name: 'Karl Marx', knownName: { before: 'Karl ', last: 'Marx' }, primaryIdentity: '马克思主义、《资本论》作者', role: 'Structural Critic', category: 'Analytical', desc: '长程结构与剩余视角。看清权力与分配链条，适合根因级复盘。', price: '$1.75/req' },
  { id: 'freud', name: 'Sigmund Freud', knownName: { before: 'Sigmund ', last: 'Freud' }, primaryIdentity: '精神分析之父', role: 'User Psychologist', category: 'Psychology', desc: '无意识与防御机制。把用户「说不出口」的动机翻译成可设计触点。', price: '$1.55/req' },
  { id: 'turing', name: 'Alan Turing', knownName: { before: 'Alan ', last: 'Turing' }, primaryIdentity: '计算机科学之父、图灵机', role: 'System Architect', category: 'Science', desc: '计算与密码学式严密。最底层架构、边界情况与可证明的安全感。', price: '$2.05/req' },
  { id: 'buffett', name: 'Warren Buffett', knownName: { before: 'Warren ', last: 'Buffett' }, primaryIdentity: '股神、奥马哈先知', role: 'Capital Strategist', category: 'Finance', desc: '价值投资与护城河。少而精、复利思维，厌恶无谓复杂度。', price: '$3.00/req' },
  { id: 'confucius', name: 'Confucius', knownName: { before: '', last: 'Confucius' }, primaryIdentity: '孔子、至圣先师', role: 'Ethos Architect', category: 'Strategy', desc: '仁礼与正名。教化式对齐目标、角色与措辞，适合共识与规范起草。', price: '$1.70/req' },
  { id: 'napoleon', name: 'Napoleon', knownName: { before: '', last: 'Napoleon' }, primaryIdentity: '拿破仑皇帝、滑铁卢之前的欧洲主宰', role: 'Logistics Master', category: 'Operations', desc: '在硬约束下集中优势资源。精密调度、快迭代、赢局部再赢全局。', price: '$2.10/req' },
  { id: 'julius_caesar', name: 'Julius Caesar', knownName: { before: 'Julius ', last: 'Caesar' }, primaryIdentity: '凯撒大帝、儒略历', role: 'Field Commander', category: 'Operations', desc: '关键节点果断拍板。跨越卢比孔河式决策，执行不留退路。', price: '$2.00/req' },
  { id: 'alexander', name: 'Alexander the Great', knownName: { before: '', last: 'Alexander the Great' }, primaryIdentity: '亚历山大大帝', role: 'Expansion Lead', category: 'Strategy', desc: '高速扩张与纵深突破。把版图思维用于市场抢占与多区域 rollout。', price: '$2.20/req' },
  { id: 'genghis_khan', name: 'Genghis Khan', knownName: { before: 'Genghis ', last: 'Khan' }, primaryIdentity: '成吉思汗、蒙古帝国', role: 'Global Scaler', category: 'Strategy', desc: '扁平指挥链与极限机动。无视边界感，追求最短路径的规模化复制。', price: '$2.00/req' },
  { id: 'edison', name: 'Thomas Edison', knownName: { before: 'Thomas ', last: 'Edison' }, primaryIdentity: '发明大王、灯泡与留声机', role: 'Commercializer', category: 'Operations', desc: '试错量产与专利墙。实验室到货架的最短闭环，厌恶不可交付的炫技。', price: '$1.85/req' },
  { id: 'tesla', name: 'Nikola Tesla', knownName: { before: 'Nikola ', last: 'Tesla' }, primaryIdentity: '交流电天才、无线输电狂人', role: 'Innovation Engineer', category: 'Science', desc: '电气直觉与单点极致。敢押前沿，但需工程伙伴收口可制造性。', price: '$2.10/req' },
  { id: 'carnegie', name: 'Andrew Carnegie', knownName: { before: 'Andrew ', last: 'Carnegie' }, primaryIdentity: '钢铁大王、慈善散财范本', role: 'Supply Chain Lead', category: 'Operations', desc: '垂直整合与成本壁垒。从上游到下游控节奏，规模换利润。', price: '$1.90/req' },
  { id: 'oppenheimer', name: 'J. Robert Oppenheimer', knownName: { before: 'J. Robert ', last: 'Oppenheimer' }, primaryIdentity: '「原子弹之父」、曼哈顿计划', role: 'Program Director', category: 'Science', desc: '曼哈顿式大科学统筹。顶尖人才密度、风险与里程碑对齐。', price: '$2.60/req' },
  { id: 'curie', name: 'Marie Curie', knownName: { before: 'Marie ', last: 'Curie' }, primaryIdentity: '镭之母、两获诺贝尔奖的女科学家', role: 'Deep Researcher', category: 'Science', desc: '实验坚忍与双重严谨。枯燥数据里榨结论，适合底层验证与复现。', price: '$1.95/req' },
  { id: 'sun_tzu', name: 'Sun Tzu', knownName: { before: 'Sun ', last: 'Tzu' }, primaryIdentity: '《孙子兵法》、「知己知彼」', role: 'Market Tactician', category: 'Strategy', desc: '知己知彼与奇正。红海中的信息差与不战而屈人之兵的博弈结构。', price: '$1.90/req' },
  { id: 'darwin', name: 'Charles Darwin', knownName: { before: 'Charles ', last: 'Darwin' }, primaryIdentity: '演化论、《物种起源》', role: 'Evidence Synthesist', category: 'Science', desc: '长期证据链与自然选择式论证。审慎发表、大量例证、可证伪路径。', price: '$1.85/req' },
  { id: 'aristotle', name: 'Aristotle', knownName: { before: '', last: 'Aristotle' }, primaryIdentity: '古希腊百科全书式哲学家', role: 'Knowledge Architect', category: 'Analytical', desc: '分类学与三段论。把碎片信息变成本体清晰、可教学的体系。', price: '$1.75/req' },
  { id: 'plato', name: 'Plato', knownName: { before: '', last: 'Plato' }, primaryIdentity: '《理想国》、理念论', role: 'Dialectician', category: 'Analytical', desc: '理念论式层层追问。洞穴寓言般的定义战，直到「到底在解决什么」被说清。', price: '$1.72/req' },
  { id: 'nietzsche', name: 'Friedrich Nietzsche', knownName: { before: 'Friedrich ', last: 'Nietzsche' }, primaryIdentity: '「上帝已死」、超人哲学', role: 'Cultural Philosopher', category: 'Psychology', desc: '价值重估与警句强度。适合品牌叙事需要锋利立场与反偶像张力时。', price: '$1.62/req' },
  { id: 'machiavelli', name: 'Niccolò Machiavelli', knownName: { before: 'Niccolò ', last: 'Machiavelli' }, primaryIdentity: '《君主论》、权谋现实主义', role: 'Power Realist', category: 'Strategy', desc: '君主论式结构看权术。剥离道德修辞看激励与制衡，偏极限推演。', price: '$1.78/req' },
  { id: 'smith', name: 'Adam Smith', knownName: { before: 'Adam ', last: 'Smith' }, primaryIdentity: '古典经济学之父、《国富论》', role: 'Ecosystem Designer', category: 'Finance', desc: '分工与看不见的手。设计去中心化规则，让生态自发繁荣。', price: '$1.72/req' },
  { id: 'morgan', name: 'J. P. Morgan', knownName: { before: 'J. P. ', last: 'Morgan' }, primaryIdentity: '华尔街之王、摩根大通前身', role: 'M&A Specialist', category: 'Finance', desc: '危机重组与资本市场秩序。一言九鼎式协调资源与交易结构。', price: '$2.52/req' },
  { id: 'rockefeller', name: 'John D. Rockefeller', knownName: { before: 'John D. ', last: 'Rockefeller' }, primaryIdentity: '石油大王、标准石油', role: 'Integration Baron', category: 'Finance', desc: '产业垂直整合与成本纪律。规模壁垒 + 冷静谈判，崇尚效率。', price: '$2.35/req' },
  { id: 'henry_ford', name: 'Henry Ford', knownName: { before: 'Henry ', last: 'Ford' }, primaryIdentity: 'T 型车与流水线之父', role: 'Operations Optimizer', category: 'Operations', desc: '流水线思维。流程极限压缩、可重复节拍与良率文化。', price: '$1.65/req' },
  { id: 'zhuge_liang', name: 'Zhuge Liang', knownName: { family: 'Zhuge', given: 'Liang' }, primaryIdentity: '卧龙军师、三国丞相（文化符号）', role: 'Grand Strategist', category: 'Strategy', desc: '弱势开局下的结盟与借力。谨慎多谋，鞠躬尽瘁式责任压强。', price: '$2.22/req' },
  { id: 'li_bai', name: 'Li Bai', knownName: { family: 'Li', given: 'Bai' }, primaryIdentity: '诗仙', role: 'Poet Provocateur', category: 'Creative', desc: '乐府与歌行式浪漫意象。文案与品牌语调需要飘逸、即兴、记忆点时。', price: '$1.68/req' },
  { id: 'keynes', name: 'John Maynard Keynes', knownName: { before: 'John Maynard ', last: 'Keynes' }, primaryIdentity: '凯恩斯主义、《通论》', role: 'Macro Economist', category: 'Finance', desc: '总需求与逆周期杠杆。不确定性下的政策式叙事与预期管理。', price: '$1.92/req' },
  { id: 'soros', name: 'George Soros', knownName: { before: 'George ', last: 'Soros' }, primaryIdentity: '量子基金、狙击英镑的金融大鳄', role: 'Macro Contrarian', category: 'Finance', desc: '反身性与拐点猎手。趋势与叙事反转时敢于认错反手。', price: '$2.15/req' },
  { id: 'holmes', name: 'Sherlock Holmes', knownName: { before: 'Sherlock ', last: 'Holmes' }, primaryIdentity: '世界第一侦探（虚构）', role: 'Lead Investigator', category: 'Analytical', desc: '演绎与排除法（文学侧）。观察细节、还原链路漏洞；冷静毒舌式质询。', price: '$1.82/req' },
  { id: 'tony_stark', name: 'Tony Stark', knownName: { before: 'Tony ', last: 'Stark' }, primaryIdentity: '钢铁侠（漫威）', role: 'Iron Engineer', category: 'Visionary', desc: '尖端硬件迭代 + 演示叙事 + 危机临场拍板。上限想象，勿当现实对标。', price: '$2.55/req' },
  { id: 'light_yagami', name: 'Light Yagami', knownName: { before: 'Light ', last: 'Yagami' }, primaryIdentity: '《死亡笔记》基拉、智斗反派天花板', role: 'Red Team Strategist', category: 'Strategy', desc: '长期布局与规则漏洞。反派视角压力测试；勿默认作正面协作人格。', price: '$2.05/req' },
];

const generateBarcode = (id) => {
  const widths = [1, 2, 1, 3, 1, 1, 2, 1, 2, 3, 1, 1, 2, 1, 2];
  return widths.map((w, i) => <div key={i} className="barcode-line" style={{ width: `${w * 2}px` }} />);
};

const commonsFilePath = (file, width = 180) =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=${width}`;

const commonsFilePage = (file) =>
  `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file).replace(/%20/g, '_')}`;

// Open-source safe avatar policy:
// - Prefer Wikimedia Commons files with public-domain or free-culture licenses.
// - Keep source/license metadata visible from the market cards.
// - Do not use copyrighted character stills for protected fictional characters.
const PANTHEON_AVATARS = {
  einstein: { file: 'Einstein 1921 by F Schmutzer - restoration.jpg', license: 'PD', credit: 'Ferdinand Schmutzer / Wikimedia Commons' },
  newton: { file: 'GodfreyKneller-IsaacNewton-1689.jpg', license: 'PD', credit: 'Godfrey Kneller / Wikimedia Commons' },
  shakespeare: { file: 'Chandos portrait of William Shakespeare.jpg', license: 'PD', credit: 'National Portrait Gallery / Wikimedia Commons' },
  musk: { file: 'Elon Musk Royal Society (crop2).jpg', license: 'CC BY-SA', credit: 'Duncan.Hull / Wikimedia Commons' },
  jobs: { file: 'Steve Jobs Headshot 2010-CROP.jpg', license: 'CC BY-SA 3.0', credit: 'Matthew Yohe / Wikimedia Commons' },
  disney: { file: 'Walt Disney 1946.JPG', license: 'PD', credit: 'NASA / Wikimedia Commons' },
  churchill: { file: 'Winston Churchill 1941 photo by Yousuf Karsh.jpg', license: 'PD/Commons', credit: 'Yousuf Karsh / Wikimedia Commons' },
  da_vinci: { file: 'Leonardo da Vinci - presumed self-portrait - WGA12798.jpg', license: 'PD', credit: 'Wikimedia Commons' },
  picasso: { file: 'Portrait de Picasso, 1908.jpg', license: 'PD', credit: 'Wikimedia Commons' },
  marx: { file: 'Karl Marx 001.jpg', license: 'PD', credit: 'John Jabez Edwin Mayall / Wikimedia Commons' },
  freud: { file: 'Sigmund Freud, by Max Halberstadt (cropped).jpg', license: 'PD', credit: 'Max Halberstadt / Wikimedia Commons' },
  turing: { file: 'Alan Turing Aged 16.jpg', license: 'PD/Commons', credit: 'Wikimedia Commons' },
  buffett: { file: 'Warren Buffett at the 2015 SelectUSA Investment Summit (cropped).jpg', license: 'PD-USGov', credit: 'U.S. Department of Commerce / Wikimedia Commons' },
  confucius: { file: 'Confucius Tang Dynasty.jpg', license: 'PD', credit: 'Wikimedia Commons' },
  napoleon: { file: 'Jacques-Louis David - The Emperor Napoleon in His Study at the Tuileries - Google Art Project.jpg', license: 'PD', credit: 'Jacques-Louis David / Wikimedia Commons' },
  julius_caesar: { file: 'Gaius Julius Caesar (100-44 BC).JPG', license: 'CC/Commons', credit: 'Wikimedia Commons' },
  alexander: { file: 'Alexander the Great mosaic.jpg', license: 'PD', credit: 'Wikimedia Commons' },
  genghis_khan: { file: 'YuanEmperorAlbumGenghisPortrait.jpg', license: 'PD', credit: 'National Palace Museum / Wikimedia Commons' },
  edison: { file: 'Thomas Edison2.jpg', license: 'PD', credit: 'Wikimedia Commons' },
  tesla: { file: 'Tesla circa 1890.jpeg', license: 'PD', credit: 'Wikimedia Commons' },
  carnegie: { file: 'Andrew Carnegie, three-quarter length portrait, seated, facing slightly left, 1913.jpg', license: 'PD', credit: 'Library of Congress / Wikimedia Commons' },
  oppenheimer: { file: 'J Robert Oppenheimer (cropped).jpg', license: 'PD-USGov', credit: 'U.S. Department of Energy / Wikimedia Commons' },
  curie: { file: 'Marie Curie c1920.jpg', license: 'PD', credit: 'Wikimedia Commons' },
  sun_tzu: { file: 'Sun Tzu portrait.jpg', license: 'PD', credit: 'Wikimedia Commons' },
  darwin: { file: 'Charles Darwin aged 51.jpg', license: 'PD', credit: 'Wikimedia Commons' },
  aristotle: { file: 'Aristotle Altemps Inv8575.jpg', license: 'CC/Commons', credit: 'Jastrow / Wikimedia Commons' },
  plato: { file: 'Plato Silanion Musei Capitolini MC1377.jpg', license: 'CC/Commons', credit: 'Marie-Lan Nguyen / Wikimedia Commons' },
  nietzsche: { file: 'Nietzsche187a.jpg', license: 'PD', credit: 'Gustav Schultze / Wikimedia Commons' },
  machiavelli: { file: 'Portrait of Niccolò Machiavelli by Santi di Tito.jpg', license: 'PD', credit: 'Santi di Tito / Wikimedia Commons' },
  smith: { file: 'Adam Smith The Muir portrait.jpg', license: 'PD', credit: 'Wikimedia Commons' },
  morgan: { file: 'J. P. Morgan, 1902.jpg', license: 'PD', credit: 'Edward Steichen / Wikimedia Commons' },
  rockefeller: { file: 'John D. Rockefeller 1885.jpg', license: 'PD', credit: 'Wikimedia Commons' },
  henry_ford: { file: 'Henry ford 1919.jpg', license: 'PD', credit: 'Hartsook / Wikimedia Commons' },
  zhuge_liang: { file: 'Zhuge Liang (Chinese portrait).jpg', license: 'PD', credit: 'Wikimedia Commons' },
  li_bai: { file: 'Li Bai.jpg', license: 'PD', credit: 'Wikimedia Commons' },
  keynes: { file: 'John Maynard Keynes.jpg', license: 'PD', credit: 'Wikimedia Commons' },
  soros: { file: 'George Soros - Festival Economia 2012.jpg', license: 'CC BY-SA', credit: 'Niccolo Caranti / Wikimedia Commons' },
  holmes: { file: 'Sherlock Holmes Portrait Paget.jpg', license: 'PD', credit: 'Sidney Paget / Wikimedia Commons' },
  tony_stark: { symbolic: true, mark: 'TS', license: 'NO STILLS', credit: 'Protected character: no Marvel artwork used' },
  light_yagami: { symbolic: true, mark: 'LY', license: 'NO STILLS', credit: 'Protected character: no Death Note artwork used' },
};

const pantheonAvatarMeta = (agentId) => PANTHEON_AVATARS[agentId];

const pantheonAvatarSrc = (agentId) => {
  const avatar = pantheonAvatarMeta(agentId);
  return avatar?.file ? commonsFilePath(avatar.file) : null;
};

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
    advice: 'Use for pricing, capital allocation, business model critique, and strategic trade-offs.',
  },
  Operations: {
    strength: 'Converts intention into repeatable process, tempo, logistics, and measurable delivery.',
    advice: 'Use for execution planning, delivery systems, scaling constraints, and bottleneck removal.',
  },
};

const getDossierProfile = (agent) => {
  const skillProfile = buildDossierProfileFromSkill(agent);
  if (skillProfile) return skillProfile;

  const scores = AGENT_SCORE_OVERRIDES[agent.id] || CATEGORY_PROFILE[agent.category] || [76, 76, 76, 76, 50];
  const notes = DOSSIER_FIELD_NOTES[agent.category] || DOSSIER_FIELD_NOTES.Analytical;
  return {
    scores: DOSSIER_DIMENSIONS.map((label, index) => ({ label, value: scores[index] })),
    strength: notes.strength,
    advice: notes.advice,
    summary: agent.desc,
    codename: `${agent.category.toUpperCase()} / ${agent.role.toUpperCase()}`,
  };
};

function RadarChart({ points }) {
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
              {p.label.toUpperCase()}
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
  { id: 'main', name: 'Main', description: '项目默认公开频道，所有成员固定可见。', category: 'text', unread: 3 },
  { id: 'google_chat', name: 'Google Chat', description: 'External @mention bridge; change requests stay visible to the full project team.', category: 'text', unread: 0 },
  { id: 'decisions', name: 'Decisions', description: '关键决策、确认事项与变更记录。', category: 'decisions', unread: 1 },
  { id: 'design', name: 'Design', description: '设计讨论与资产共享。', category: 'text', unread: 0 },
  { id: 'standup', name: 'Standup', description: '语音站会频道。', category: 'voice', unread: 0 },
];

const PROJECT_CHAT_MESSAGES = [
  { id: 'c1', channelId: 'main', type: 'system', author: 'System', time: '09:00', text: '项目频道已开放。所有成员默认在 Main 频道。' },
  { id: 'c2', channelId: 'main', type: 'progress', author: 'Alan', role: 'Project Manager', time: '09:18', text: '今日目标已拆成 3 个执行块，优先处理 BYOK Auth Middleware。' },
  { id: 'c3', channelId: 'main', type: 'question', author: 'Linus', role: 'Tech Lead', time: '09:34', text: '需要确认是否优先支持本地密钥缓存，否则认证层会多一个异步边界。' },
  { id: 'c4', channelId: 'main', type: 'mention', author: 'Director', time: '09:41', text: '@all 先按安全优先处理，体验问题留到第二轮。', targets: ['all'], weight: 'High' },
  { id: 'c5', channelId: 'main', type: 'file', author: 'Dieter', role: 'UX Designer', time: '10:12', text: '上传了信息架构草图 v0.2。', meta: 'fig-mint-ia-v02.md', fileId: 'FILE-014' },
  { id: 'c6', channelId: 'decisions', type: 'decision', author: 'Alan', role: 'Project Manager', time: '11:05', text: '决策确认：认证中间件优先支持 BYOK，OAuth 作为后续兼容层。', decisionId: 'DEC-001' },
  { id: 'c7', channelId: 'main', type: 'text', author: 'Alan', role: 'Project Manager', time: '10:45', text: '各位注意，中间件骨架 PR 已经 ready，Linus 会 review。' },
  { id: 'c8', channelId: 'main', type: 'text', author: 'Alan', role: 'Project Manager', time: '10:46', text: 'Review 完成后我们对齐一次下午的工作。' },
];

const DEFAULT_CHAT_PROJECT_ID = 'p_1001';
const hydrateChatMessage = (message) => ({
  ...message,
  projectId: message.projectId || DEFAULT_CHAT_PROJECT_ID,
});

const loadInitialChatMessages = () => {
  const stored = readStoredJson(STORAGE_KEYS.chatMessages, null);
  return (Array.isArray(stored) && stored.length ? stored : PROJECT_CHAT_MESSAGES).map(hydrateChatMessage);
};

const PROJECT_TIMELINE_EVENTS = [
  { id: 't1',  eventId: 'T-01', t: 0,     type: '创建',     contributor: 'Alan',     title: '项目立项',               detail: '初始化项目目标、成员与第一批任务。',               priority: 'core',   branch: 'Main',
    attachments: [{ type: 'doc', name: 'project-charter.md', summary: '项目章程：目标、范围、成员与里程碑' }],
    comments: [{ author: 'Director', time: 0.5, text: '目标清晰，批准立项。注意控制第一冲刺范围。' }],
    history: [{ time: 0, action: '项目创建' }, { time: 0.3, action: 'Director 批准立项' }] },
  { id: 't2',  eventId: 'T-02', t: 2.5,   type: '分析',     contributor: 'Don',      title: '竞品定价分析',            detail: '读取用户指令并整理三类定价假设。',                 priority: 'normal', branch: 'Market',       dependsOn: ['t1'],
    attachments: [{ type: 'doc', name: 'pricing-analysis-v0.xlsx', summary: '三类定价假设对比表' }, { type: 'link', name: '竞品 A 公开定价页', summary: 'https://competitor-a.com/pricing' }],
    comments: [{ author: 'Alan', time: 3, text: '免费版和企业版的差异化还需要更多数据支撑。' }],
    history: [{ time: 2.5, action: '创建分析草稿' }, { time: 4, action: '补充竞品 B 数据' }] },
  { id: 't8',  eventId: 'T-08', t: 3,     type: '内部沟通', contributor: 'Alan',     title: '频道初始化通知',           detail: '在 Main 频道发布项目 kick-off 通知。',            priority: 'low',    branch: 'Main' },
  { id: 't9',  eventId: 'T-09', t: 5,     type: '内部沟通', contributor: 'Dieter',   title: '设计方向讨论',             detail: '和 Alan 讨论了信息架构偏好和竞品视觉参考。',       priority: 'low',    branch: 'Design' },
  { id: 't10', eventId: 'T-10', t: 7,     type: '内部沟通', contributor: 'Linus',    title: '技术栈确认',               detail: '确认 Vite + React + Tailwind 技术选型。',        priority: 'low',    branch: 'Engineering' },
  { id: 't3',  eventId: 'T-03', t: 25.3,  type: '文档更新', contributor: 'Dieter',   title: '体验原则草案',             detail: '补充界面密度、留白和控件优先级。',                 priority: 'normal', branch: 'Design',       dependsOn: ['t1'],
    attachments: [{ type: 'doc', name: 'ux-principles-v0.md', summary: '界面密度、留白策略、控件优先级文档' }, { type: 'design', name: 'wireframe-density.fig', summary: 'Figma 线框：三种密度对比' }],
    comments: [{ author: 'Alan', time: 26, text: '留白策略很好，但移动端适配还需要考虑。' }, { author: 'Dieter', time: 26.5, text: '会在 v1 补充响应式断点规则。' }],
    history: [{ time: 25.3, action: '创建草案' }, { time: 26.5, action: '根据反馈标记待补充项' }] },
  { id: 't11', eventId: 'T-11', t: 27,    type: '内部沟通', contributor: 'Don',      title: '定价模型 review',          detail: '在 Market 频道贴出定价对比表，请求反馈。',         priority: 'low',    branch: 'Market' },
  { id: 't4',  eventId: 'T-04', t: 30.7,  type: '代码上传', contributor: 'Linus',    title: 'Auth Middleware Skeleton', detail: '提交认证中间件骨架和错误处理边界。',               priority: 'core',   branch: 'Engineering',  dependsOn: ['t1'],
    attachments: [{ type: 'code', name: 'auth-middleware.ts', diff: '+142 -23', hash: 'a3f2c91' }, { type: 'code', name: 'error-boundary.ts', diff: '+67 -0', hash: 'a3f2c91' }],
    comments: [{ author: 'Alan', time: 31, text: '骨架结构清晰，请补充 token 过期场景的边界处理。' }, { author: 'Linus', time: 31.5, text: '已在 T-13 中补充，JWT 三件套一并提交。' }],
    history: [{ time: 30.7, action: '创建 PR #12' }, { time: 31.2, action: 'Alan 完成 Code Review' }, { time: 32, action: 'PR 合并到 main' }] },
  { id: 't12', eventId: 'T-12', t: 32,    type: '内部沟通', contributor: 'Dieter',   title: '设计稿 v0.1 预览',         detail: '上传了首版 Figma 链接供团队评审。',                priority: 'low',    branch: 'Design',
    attachments: [{ type: 'design', name: 'ui-v0.1.fig', summary: 'Figma 首版全局布局' }] },
  { id: 't13', eventId: 'T-13', t: 34,    type: '代码上传', contributor: 'Linus',    title: 'JWT Token 工具函数',       detail: '补充了 token 签发/验证/刷新三件套。',              priority: 'normal', branch: 'Engineering',
    attachments: [{ type: 'code', name: 'jwt-utils.ts', diff: '+98 -4', hash: 'b7e1d03' }],
    comments: [{ author: 'Alan', time: 35, text: '刷新逻辑需要考虑并发请求场景。' }],
    history: [{ time: 34, action: '创建 PR #14' }, { time: 35.5, action: 'PR 合并' }] },
  { id: 't5',  eventId: 'T-05', t: 48.8,  type: '内部沟通', contributor: 'All',      title: '风险同步',                 detail: '团队同步了密钥存储、日志脱敏和调试体验的冲突。',   priority: 'low',    branch: 'Main' },
  { id: 't14', eventId: 'T-14', t: 50,    type: '内部沟通', contributor: 'Alan',     title: '站会记录 Day3',            detail: '各成员简要汇报昨日进展和今日计划。',               priority: 'low',    branch: 'Main' },
  { id: 't6',  eventId: 'T-06', t: 53.2,  type: '重要决策', contributor: 'Director', title: 'BYOK 优先级确认',          detail: '会议纪要归档：先安全，再体验，再兼容。',           priority: 'core',   branch: 'Main',         dependsOn: ['t4', 't5'],
    attachments: [{ type: 'doc', name: 'meeting-minutes-day3.md', summary: '会议纪要：BYOK 优先级决策全文' }, { type: 'link', name: '决策投票记录', summary: '4/4 一致通过安全优先' }],
    comments: [{ author: 'Linus', time: 54, text: '收到，密钥存储模块今天开工。' }, { author: 'Don', time: 54.2, text: '定价方案会配合安全卖点调整。' }, { author: 'Dieter', time: 54.5, text: '体验层可以延后但需要预留接口。' }],
    history: [{ time: 53.2, action: '会议召开' }, { time: 53.5, action: '投票通过决策' }, { time: 54, action: '归档纪要文档' }] },
  { id: 't15', eventId: 'T-15', t: 55,    type: '文档更新', contributor: 'Don',      title: '市场分析报告 v1',           detail: '整合竞品数据、用户调研和定价建议。',               priority: 'normal', branch: 'Market',       dependsOn: ['t2'],
    attachments: [{ type: 'doc', name: 'market-report-v1.pdf', summary: '28 页完整市场分析报告' }],
    comments: [{ author: 'Director', time: 56, text: '定价建议部分很扎实，可以作为投资人材料的附件。' }],
    history: [{ time: 55, action: '发布 v1' }, { time: 56, action: 'Director 审阅通过' }] },
  { id: 't16', eventId: 'T-16', t: 56,    type: '代码上传', contributor: 'Linus',    title: 'BYOK 密钥存储模块',         detail: '本地加密密钥缓存 + 异步同步边界。',               priority: 'core',   branch: 'Engineering',  dependsOn: ['t6'],
    attachments: [{ type: 'code', name: 'keystore.ts', diff: '+234 -12', hash: 'c9d4e56' }, { type: 'code', name: 'keystore.test.ts', diff: '+187 -0', hash: 'c9d4e56' }],
    comments: [{ author: 'Alan', time: 57, text: '测试覆盖率不错，加密算法选型是否需要安全审计？' }, { author: 'Linus', time: 57.5, text: '用的 AES-256-GCM，业界标准，审计可以后续安排。' }],
    history: [{ time: 56, action: '创建 PR #18' }, { time: 57, action: 'Code Review 通过' }, { time: 58, action: 'PR 合并' }] },
  { id: 't17', eventId: 'T-17', t: 58,    type: '内部沟通', contributor: 'Dieter',   title: 'UI 细节微调讨论',           detail: '字号、行高、卡片圆角等细节对齐。',                 priority: 'low',    branch: 'Design' },
  { id: 't18', eventId: 'T-18', t: 70,    type: '文档更新', contributor: 'Dieter',   title: '设计规范 v1.0',             detail: '完成色板、字体、间距、组件库基础文档。',           priority: 'normal', branch: 'Design',       dependsOn: ['t3'],
    attachments: [{ type: 'doc', name: 'design-system-v1.md', summary: '色板、字体、间距、组件库规范' }, { type: 'design', name: 'component-library.fig', summary: 'Figma 组件库文件' }],
    comments: [{ author: 'Alan', time: 71, text: '规范很完整，建议补充暗色模式变量。' }],
    history: [{ time: 70, action: '发布 v1.0' }, { time: 71, action: '标记暗色模式为待办' }] },
  { id: 't7',  eventId: 'T-07', t: 75.6,  type: '汇报记录', contributor: 'Alan',     title: '阶段汇报 v0.1',            detail: '汇总进度、风险、下一步和需要用户决策的事项。',     priority: 'core',   branch: 'Main',         dependsOn: ['t6', 't16'],
    attachments: [{ type: 'doc', name: 'sprint-report-v0.1.md', summary: '阶段汇报：进度 72%、3 项风险、5 项待决策' }, { type: 'link', name: '进度仪表盘', summary: '实时项目进度看板链接' }],
    comments: [{ author: 'Director', time: 76, text: '报告清晰。风险 #2 密钥轮换需要在下个冲刺优先处理。' }, { author: 'Alan', time: 76.5, text: '已标记为下阶段 P0，Linus 会跟进。' }],
    history: [{ time: 75.6, action: '提交汇报' }, { time: 76, action: 'Director 审阅' }, { time: 76.5, action: '标记后续行动项' }] },
  { id: 't19', eventId: 'T-19', t: 78,    type: '内部沟通', contributor: 'All',      title: '项目回顾 & 庆祝',           detail: '全员频道分享阶段成果，规划下一冲刺。',             priority: 'low',    branch: 'Main' },
];

const PROJECT_BRANCHES = [
  { id: 'Design', owner: 'Dieter', top: 34, color: '#b9782b', progress: 64 },
  { id: 'Engineering', owner: 'Linus', top: 58, color: '#8f1e18', progress: 72 },
  { id: 'Market', owner: 'Don', top: 82, color: '#59684b', progress: 46 },
];

const EVENT_TYPE_STYLES = {
  创建: 'bg-[#251b13] text-[#efe2bd]',
  分析: 'bg-[#59684b] text-white',
  代码上传: 'bg-[#1b3341] text-white',
  文档更新: 'bg-[#b9782b] text-white',
  重要决策: 'bg-[#8f1e18] text-white',
  汇报记录: 'bg-[#6b4f87] text-white',
  内部沟通: 'bg-[#d8c99f] text-[#251b13]',
};

Object.assign(EVENT_TYPE_STYLES, {
  'Project Approved': 'bg-[#251b13] text-[#efe2bd]',
  'Leader Confirmed': 'bg-[#8f1e18] text-white',
  'Leader Assignment': 'bg-[#1b3341] text-white',
  'Assignment Ack': 'bg-[#59684b] text-white',
  'Peer Handoff': 'bg-[#b9782b] text-white',
  'Peer Handoff Ack': 'bg-[#59684b] text-white',
  'Change Discussion': 'bg-[#d8c99f] text-[#251b13]',
  'Change Confirmed': 'bg-[#8f1e18] text-white',
  'Change Sync': 'bg-[#59684b] text-white',
  'Work Pulse': 'bg-[#6b4f87] text-white',
  'Daily Report': 'bg-[#6b4f87] text-white',
  'Task Completed': 'bg-green-700 text-white',
});

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

  const [marketSearch, setMarketSearch] = useState('');
  const [marketCategory, setMarketCategory] = useState('All');
  const [selectedMarketAgentId, setSelectedMarketAgentId] = useState(null);
  const [recruitedIds, setRecruitedIds] = useState([]);
  const [signingAgentId, setSigningAgentId] = useState(null);
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
  const [selectedLeaderCandidateId, setSelectedLeaderCandidateId] = useState(null);
  const [initiationDraft, setInitiationDraft] = useState({
    name: 'Roundtable Initiation System',
    summary: '让项目必须经过立项圆桌，讨论清楚人、事、产出之后才进入 dashboard。',
    intent: '做一个真实的项目发起流程：先描述项目，再邀请参会人，然后召开强制立项会议。',
    output: 'Clickable product mock + initiation record',
    reason: '现在 dashboard 的加号需要有真正的立项路径，而不是直接生成项目。',
    visibility: 'invite',
  });
  const [initiationInviteIds, setInitiationInviteIds] = useState(['jobs', 'turing', 'curie', 'confucius']);
  const transcriptEndRef = useRef(null);

  // --- Project Workspace State ---
  const [roomInput, setRoomInput] = useState('');
  const [roomIntentions, setRoomIntentions] = useState([]);
  const [roomSpeaker, setRoomSpeaker] = useState(null);
  const [roomTranscript, setRoomTranscript] = useState([
    { id: 'r0', speaker: 'System', role: 'System', text: '会议室已准备好。当前议题：确认下一轮项目推进方式。', score: 0 },
  ]);
  const [meetingStartTime, setMeetingStartTime] = useState(null);
  const [meetingElapsed, setMeetingElapsed] = useState(0);
  const [activeChannelId, setActiveChannelId] = useState('main');
  const [chatChannels, setChatChannels] = useState(PROJECT_CHANNELS);
  const [chatMessages, setChatMessages] = useState(loadInitialChatMessages);
  const [chatInput, setChatInput] = useState('');
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);
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
  const sceneTransitionTimerRef = useRef(null);
  const roomSimulationTimersRef = useRef([]);
  const meetingTimerRef = useRef(null);
  const lastTimelineWheelRef = useRef(0);
  const tlPreviewTimerRef = useRef(null);
  const tlDragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const tlNodeDragRef = useRef({ id: null, scale: 'day', startClientX: 0, startX: 0, moved: false });
  const tlSuppressNodeClickRef = useRef(false);
  const tlContainerRef = useRef(null);
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

    const eventTypes = ['创建', '分析', '内部沟通', '文档更新', '代码上传', '重要决策', '汇报记录'];
    const scaleProfiles = {
      hour:  { priorities: ['core', 'normal', 'low'], types: eventTypes },
      day:   { priorities: ['core', 'normal'], types: ['创建', '分析', '文档更新', '代码上传', '重要决策', '汇报记录'] },
      week:  { priorities: ['core', 'normal'], types: ['创建', '文档更新', '代码上传', '重要决策', '汇报记录'] },
      month: { priorities: ['core'], types: ['创建', '重要决策', '汇报记录'] },
    };
    const scaleProfile = scaleProfiles[timelineScale] || scaleProfiles.day;
    const visible = PROJECT_TIMELINE_EVENTS.filter(e => scaleProfile.priorities.includes(e.priority) && scaleProfile.types.includes(e.type));
    const eMap = {};
    PROJECT_TIMELINE_EVENTS.forEach(e => { eMap[e.id] = e; });

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
  const selectedMarketAgent = LEGENDARY_AGENTS.find(agent => agent.id === selectedMarketAgentId);

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
    });
    const cycleMessages = createAutonomousCycleChatMessages({
      project: result.project,
      cycle: result.cycle,
      cadence,
      projectId,
    });

    setProjects(prev => prev.map(item => item.id === projectId ? result.project : item));

    if (cycleMessages.length) {
      setChatMessages(prev => [...prev, ...cycleMessages].slice(-240));
    }
  };

  useEffect(() => {
    const intervalFor = (cadence) => cadence === 'daily' ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000;
    const runDueCycles = () => {
      const now = Date.now();
      const generatedChatMessages = [];
      setProjects(prev => prev.map(project => {
        if (!project.autonomy?.enabled) return project;
        const lastRun = project.lastAutonomousRunAt ? new Date(project.lastAutonomousRunAt).getTime() : 0;
        const cadence = project.autonomy.cadence || 'hourly';
        if (lastRun && now - lastRun < intervalFor(cadence)) return project;
        const result = advanceAutonomousProjectCycle({
          project,
          team: project.team,
          cadence,
          messages: [],
          now: new Date(now).toISOString(),
        });
        generatedChatMessages.push(...createAutonomousCycleChatMessages({
          project: result.project,
          cycle: result.cycle,
          cadence,
          projectId: project.id,
        }));
        return result.project;
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
    setSelectedProjectId(null);
    setInitiationStep('brief');
    setInitiationPhase('discussion');
    setSelectedInitiationMemberId('jobs');
    setSelectedLeaderCandidateId(null);
    setInitiationInviteIds(['jobs', 'turing', 'curie', 'confucius']);
    setActiveRoute('project_initiation');
  };
  const navToWarRoom = () => { setActiveRoute('war_room'); setMeetingState('idle'); setMeetingLogs([]); setTargetNodeIds([]); };
  const launchManagerDemoProject = () => {
    const projectId = 'p_manager_demo_001';
    const projectName = 'Manager Demo: Autonomous Agent Studio';
    const invitedMembers = INITIATION_MEMBERS.filter(member => ['jobs', 'turing', 'curie', 'musk', 'confucius'].includes(member.id));
    const brief = [
      projectName,
      'A manager-ready demo where agents clarify roles, campaign for leadership, assign work in chat, run continuously, and accept mid-project changes from Google Chat.',
      'Output: polished end-to-end manager walkthrough with timeline evidence.',
    ].join(' ');
    const demoNow = new Date();
    const atOffset = (minutes) => new Date(demoNow.getTime() + minutes * 60 * 1000).toISOString();
    const roleNegotiation = createKickoffRoleNegotiation(invitedMembers, brief, { projectId, projectName });
    const leaderElection = createLeaderElection(invitedMembers, brief, { projectId, projectName });
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
        roleNegotiation,
        leaderElection,
        reporter: reporter.name,
        output: 'Polished end-to-end manager walkthrough with timeline evidence.',
        summary: 'Seeded scenario for the first requested manager use case.',
        reason: 'Managers need a direct, complete, low-friction demo path.',
      },
    };
    const assignmentPackage = createLeaderAssignmentPackage({
      project: baseProject,
      leaderId: firstLead.id,
      now: atOffset(3),
    });
    const assignedProject = {
      ...baseProject,
      tasks: assignmentPackage.tasks,
      logs: [...assignmentPackage.acknowledgementLogs, ...assignmentPackage.assignmentLogs, ...baseProject.logs],
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
    const changeText = '@all add Google Chat export summary feature before the manager review';
    const changeResponse = handleFeatureChangeRequest({
      project: { ...assignedProject, kickoffCharter },
      text: changeText,
      author: 'director',
      now: atOffset(8),
      channelId: 'google_chat',
      source: 'google-chat-mention-change-request',
    });
    const changedProject = {
      ...changeResponse.project,
      kickoffCharter,
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
    const hourlyCycle = advanceAutonomousProjectCycle({
      project: peerHandoffResponse.project,
      team: peerHandoffResponse.project.team,
      cadence: 'hourly',
      messages: [],
      now: atOffset(60),
    });
    const dailyCycle = advanceAutonomousProjectCycle({
      project: hourlyCycle.project,
      team: hourlyCycle.project.team,
      cadence: 'daily',
      messages: [],
      now: atOffset(24 * 60),
    });
    const demoProject = {
      ...dailyCycle.project,
      progress: Math.max(dailyCycle.project.progress || 0, 52),
      managerDemoReady: true,
    };
    const cycleMessages = [
      ...createAutonomousCycleChatMessages({
        project: hourlyCycle.project,
        cycle: hourlyCycle.cycle,
        cadence: 'hourly',
        projectId,
      }),
      ...createAutonomousCycleChatMessages({
        project: demoProject,
        cycle: dailyCycle.cycle,
        cadence: 'daily',
        projectId,
      }),
    ].map((message, index) => ({
      ...message,
      id: `manager_demo_cycle_${index}`,
      time: message.time === 'Completed' ? 'Completed' : '24/7',
    }));
    const demoMessages = [
      {
        id: 'manager_demo_system',
        channelId: 'main',
        type: 'system',
        author: 'System',
        time: 'Kickoff',
        text: 'Manager demo scenario loaded: kickoff, election, assignments, Google Chat change, 24/7 work, and timeline evidence.',
      },
      ...roleNegotiation.transcript.map((item, index) => ({
        id: `manager_demo_role_${index}`,
        channelId: 'main',
        type: item.type === 'role-question' ? 'question' : 'text',
        author: item.speaker,
        role: item.role,
        time: 'Kickoff',
        text: item.text,
      })),
      ...leaderElection.transcript.map((item, index) => ({
        id: `manager_demo_election_${index}`,
        channelId: 'main',
        type: 'text',
        author: item.speaker,
        role: item.role,
        time: 'Election',
        text: item.text,
      })),
      {
        id: 'manager_demo_leader_confirm',
        channelId: 'decisions',
        type: 'decision',
        author: 'Director',
        time: 'Kickoff',
        text: `${firstLead.name} is confirmed as Leader for ${projectName}.`,
        decisionId: 'LEAD-DEMO',
      },
      ...assignmentPackage.assignmentMessages.map((message, index) => ({
        ...message,
        id: `manager_demo_assign_${index}`,
        time: 'Kickoff',
      })),
      ...assignmentPackage.acknowledgementMessages.map((message, index) => ({
        ...message,
        id: `manager_demo_ack_${index}`,
        time: 'Kickoff',
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
        id: `manager_demo_change_${index}`,
        time: 'Google Chat',
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
        id: 'manager_demo_peer_request',
        time: 'Peer Handoff',
      },
      {
        ...peerHandoffResponse.acknowledgementMessage,
        id: 'manager_demo_peer_ack',
        time: 'Peer Handoff',
      },
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
  const approveInitiationProject = () => {
    const projectId = 'p_roundtable_001';
    const invitedMembers = INITIATION_MEMBERS.filter(member => initiationInviteIds.includes(member.id));
    const taskText = `${initiationDraft.name} ${initiationDraft.summary} ${initiationDraft.intent} ${initiationDraft.output} ${initiationDraft.reason}`;
    const roleNegotiation = createKickoffRoleNegotiation(invitedMembers, taskText, { projectId, projectName: initiationDraft.name });
    const leaderElection = createLeaderElection(invitedMembers, taskText, { projectId, projectName: initiationDraft.name });
    const firstLead = invitedMembers.find(member => member.id === (selectedLeaderCandidateId || leaderElection.recommendedLeaderId))
      || invitedMembers[0]
      || INITIATION_MEMBERS[1];
    const skillPlan = createRoundtablePlan(invitedMembers.map(member => member.id), taskText);
    const reporter = invitedMembers.find(member => member.id === skillPlan.reviewer?.slug && member.id !== firstLead.id)
      || invitedMembers.find(member => member.id !== firstLead.id)
      || firstLead;
    const workingMembers = invitedMembers.filter(member => member.id !== firstLead.id && member.id !== reporter.id);
    const initiatedProject = {
      id: projectId,
      name: initiationDraft.name || 'Untitled Initiation',
      status: 'initiated',
      progress: 8,
      autonomy: { enabled: true, cadence: 'hourly' },
      lastAutonomousRunAt: null,
      team: invitedMembers.map(member => ({
        id: member.id,
        name: member.name,
        role: member.id === firstLead.id ? 'Leader' : member.id === reporter.id ? 'Reporter' : member.title,
        skill: member.title,
        isLeader: member.id === firstLead.id,
      })),
      tasks: [
        { id: 101, text: 'Convert initiation consensus into dashboard project shell', assignee: firstLead.name, status: 'done' },
        { id: 102, text: initiationDraft.output, assignee: workingMembers[0]?.name || firstLead.name, status: 'in-progress' },
        { id: 103, text: 'Prepare first project report format', assignee: reporter.name, status: 'pending' },
      ],
      logs: [
        { time: 'Just now', agent: 'Roundtable', log: `${initiationDraft.name} approved from mandatory initiation meeting.` },
        { time: 'Just now', agent: firstLead.name, log: `${firstLead.name} won the leader election and was confirmed by the Director.` },
        { time: 'Just now', agent: reporter.name, log: 'Reporter accepted responsibility for weekly status and meeting record.' },
      ],
      initiation: {
        source: 'mandatory_roundtable',
        firstLead: firstLead.name,
        leaderId: firstLead.id,
        roleNegotiation,
        leaderElection,
        reporter: reporter.name,
        output: initiationDraft.output,
        summary: initiationDraft.summary,
        reason: initiationDraft.reason,
      },
    };
    const assignmentPackage = createLeaderAssignmentPackage({
      project: initiatedProject,
      leaderId: firstLead.id,
      now: new Date().toISOString(),
    });
    const kickoffCharter = createKickoffCharter({
      project: initiatedProject,
      leaderId: firstLead.id,
      reviewerId: reporter.id,
      roleNegotiation,
      leaderElection,
      assignmentPackage,
      now: new Date().toISOString(),
    });
    const projectWithAssignments = {
      ...initiatedProject,
      tasks: assignmentPackage.tasks,
      kickoffCharter,
      logs: [...assignmentPackage.acknowledgementLogs, ...assignmentPackage.assignmentLogs, ...initiatedProject.logs],
    };

    setProjects(prev => {
      const exists = prev.some(p => p.id === projectId);
      return exists
        ? prev.map(p => (p.id === projectId ? projectWithAssignments : p))
        : [projectWithAssignments, ...prev];
    });
    setChatMessages(prev => [
      ...prev,
      ...roleNegotiation.transcript.map((item, index) => ({
        id: `role_negotiation_${Date.now()}_${index}`,
        projectId,
        channelId: 'main',
        type: item.type === 'role-question' ? 'question' : 'text',
        author: item.speaker,
        role: item.role,
        time: 'Kickoff',
        text: item.text,
      })),
      ...leaderElection.transcript.map((item, index) => ({
        id: `election_${Date.now()}_${index}`,
        projectId,
        channelId: 'main',
        type: 'text',
        author: item.speaker,
        role: item.role,
        time: 'Kickoff',
        text: item.text,
      })),
      {
        id: `leader_confirm_${Date.now()}`,
        projectId,
        channelId: 'decisions',
        type: 'decision',
        author: 'Director',
        time: 'Kickoff',
        text: `${firstLead.name} is confirmed as Leader for ${initiatedProject.name}.`,
        decisionId: `LEAD-${Date.now().toString().slice(-4)}`,
      },
      ...assignmentPackage.assignmentMessages.map(message => ({ ...message, projectId })),
      ...assignmentPackage.acknowledgementMessages.map(message => ({ ...message, projectId })),
    ]);

    setInitiationPhase('approved');
    setSelectedProjectId(projectId);
    setProjectMode('dashboard');
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

  const startContractStamp = (id) => {
    if (recruitedIds.includes(id) || signingAgentId) return;
    setSigningAgentId(id);
    setTimeout(() => {
      setRecruitedIds(prev => prev.includes(id) ? prev : [...prev, id]);
    }, 1180);
    setTimeout(() => {
      setSigningAgentId(null);
    }, 3600);
  };

  const runRoomSimulation = (text, projectOverride = activeProject) => {
    const team = projectOverride?.team || [];
    roomSimulationTimersRef.current.forEach(timer => clearTimeout(timer));
    roomSimulationTimersRef.current = [];
    const exchange = runRoundtableExchange(team, text, {
      projectId: projectOverride?.id,
      projectName: projectOverride?.name,
      meetingType: projectOverride?.lastAutonomousRunAt ? 'sync' : 'kickoff',
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
        target: skill ? describeSkillIntent(agent.id, text, skillPlan) : (index === 0 ? '项目推进' : index === 1 ? '技术风险' : '体验判断'),
        origin: text.slice(0, 28) || '用户会议发言',
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
        const replyBody = speakerSkill?.principles?.[0] || '先把问题拆成可验证的事实，再谈方案。';
        setRoomTranscript(prev => [...prev, {
          id: `${intent.id}_${Date.now()}_${index}`,
          speaker: intent.name,
          role: intent.role,
          score: intent.score,
          text: skillReply || `「${replyLead}」——${intent.target}已到发言阈值。针对「${intent.origin}」：${replyBody}`,
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

  const submitRoomInput = (projectOverride = activeProject) => {
    const text = roomInput.trim();
    if (!text) return;
    setRoomInput('');
    runRoomSimulation(text, projectOverride);
  };

  const insertMention = (name) => {
    setChatInput(prev => `${prev}${prev.endsWith(' ') || !prev ? '' : ' '}@${name} `);
    setShowMentionPicker(false);
    setMentionFilter('');
    setMentionIndex(0);
  };

  const submitChatInput = () => {
    const text = chatInput.trim();
    if (!text) return;
    const targets = [...text.matchAll(/@([A-Za-z0-9_]+)/g)].map(match => match[1]);
    const isFeatureChange = isFeatureChangeRequest(text);
    const isLeaderAssignment = !isFeatureChange && isLeaderAssignmentRequest(text);
    const isPeerHandoff = !isFeatureChange && !isLeaderAssignment && isPeerHandoffRequest(text);
    const userMessage = {
      id: `m_${Date.now()}`,
      projectId: activeProject.id,
      channelId: activeChannelId,
      type: targets.length ? 'mention' : 'text',
      author: 'Director',
      time: 'Now',
      text,
      targets,
      weight: targets.length ? 'Raised' : null,
    };
    const leaderAssignmentResponse = isLeaderAssignment ? handleLeaderChatAssignment({
      project: activeProject,
      text,
      leaderId: activeProject.kickoffCharter?.governance?.leaderId || activeProject.team.find(agent => agent.isLeader)?.id,
      now: new Date().toISOString(),
      channelId: activeChannelId,
    }) : null;
    const peerHandoffResponse = isPeerHandoff ? handlePeerHandoff({
      project: activeProject,
      text,
      now: new Date().toISOString(),
      channelId: activeChannelId,
    }) : null;
    const agentReplies = leaderAssignmentResponse || peerHandoffResponse ? [] : buildAgentChatReplies({
      team: activeProject.team,
      text,
      targets,
      channelId: activeChannelId,
      context: {
        projectId: activeProject.id,
        projectName: activeProject.name,
      },
    });
    const changeResponse = isFeatureChange ? handleFeatureChangeRequest({
      project: activeProject,
      text,
      author: 'director',
      now: new Date().toISOString(),
      channelId: activeChannelId,
      source: activeChannelId === 'google_chat' ? 'google-chat-mention-change-request' : 'group-chat-change-request',
    }) : null;
    if (changeResponse) {
      setProjects(prev => prev.map(project => (
        project.id === activeProject.id ? changeResponse.project : project
      )));
    }
    if (leaderAssignmentResponse) {
      setProjects(prev => prev.map(project => (
        project.id === activeProject.id ? leaderAssignmentResponse.project : project
      )));
    }
    if (peerHandoffResponse) {
      setProjects(prev => prev.map(project => (
        project.id === activeProject.id ? peerHandoffResponse.project : project
      )));
    }
    setChatMessages(prev => [
      ...prev,
      userMessage,
      ...(leaderAssignmentResponse ? [
        leaderAssignmentResponse.assignmentMessage,
        leaderAssignmentResponse.acknowledgementMessage,
      ].map(message => ({ ...message, projectId: activeProject.id })) : []),
      ...(peerHandoffResponse ? [
        peerHandoffResponse.requestMessage,
        peerHandoffResponse.acknowledgementMessage,
      ].map(message => ({ ...message, projectId: activeProject.id })) : []),
      ...agentReplies.map(message => ({ ...message, projectId: activeProject.id })),
      ...(changeResponse?.discussionMessages || []).map(message => ({ ...message, projectId: activeProject.id })),
    ]);
    setChatInput('');
    setShowMentionPicker(false);
    setMentionFilter('');
  };

  const createMockChannel = () => {
    const nextIndex = chatChannels.length + 1;
    const id = `room_${nextIndex}`;
    setChatChannels(prev => [...prev, { id, name: `Room ${nextIndex}`, description: '公开频道，项目成员固定可见。', category: 'text', unread: 0 }]);
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
      setTerminalInput('');
      setSpeakingAgent('user');
      const isFeatureChange = isFeatureChangeRequest(val);
      const routed = routeDirectorDirective({
        team: activeProject.team,
        directive: val,
        targetIds: targetNodeIds,
        context: {
          projectId: activeProject.id,
          projectName: activeProject.name,
          meetingType: activeProject.lastAutonomousRunAt ? 'sync' : 'kickoff',
        },
      });
      const changeResponse = isFeatureChange ? handleFeatureChangeRequest({
        project: activeProject,
        text: val,
        author: 'director',
        now: new Date().toISOString(),
        channelId: 'main',
        source: 'war-room-meeting-change-request',
      }) : null;
      if (changeResponse) {
        setProjects(prev => prev.map(project => (
          project.id === activeProject.id ? changeResponse.project : project
        )));
        setChatMessages(prev => [
          ...prev,
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

  const renderSettingsModal = () => {
    const navItems = [
      { id: 'deployment', label: 'API 整体部署', icon: Server },
      { id: 'keys', label: 'Key 与凭证', icon: KeyRound },
      { id: 'models', label: '模型与路由', icon: Cpu },
      { id: 'privacy', label: '隐私与安全', icon: Shield },
      { id: 'workspace', label: '工作区偏好', icon: SlidersHorizontal },
      { id: 'integrations', label: '集成与账单', icon: PlugZap },
    ];

    const fieldClass = 'w-full border border-[#d1d0c9] bg-[#f8f6ee] px-3 py-2 font-mono text-xs text-[#1a1a1a] outline-none transition-colors focus:border-[#1a1a1a]';
    const labelClass = 'font-mono text-[10px] uppercase tracking-[0.16em] text-[#7d786b]';

    const SettingField = ({ label, hint, children }) => (
      <div className="space-y-2">
        <div className={labelClass}>{label}</div>
        {children}
        {hint && <p className="font-mono text-[10px] leading-relaxed text-[#8b8678]">{hint}</p>}
      </div>
    );

    const ToggleField = ({ label, hint, defaultChecked = false }) => (
      <label className="flex items-start justify-between gap-4 border border-[#d1d0c9] bg-[#f5f4f0] px-4 py-3">
        <span className="min-w-0">
          <span className="block font-mono text-xs text-[#1a1a1a]">{label}</span>
          {hint && <span className="mt-1 block font-mono text-[10px] leading-relaxed text-[#7d786b]">{hint}</span>}
        </span>
        <input type="checkbox" defaultChecked={defaultChecked} className="mt-0.5 h-4 w-4 accent-[#1a1a1a]" />
      </label>
    );

    const SmallButton = ({ children }) => (
      <button className="border border-[#1a1a1a] bg-[#1a1a1a] px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-[#f5f4f0] hover:bg-[#3a3429] transition-colors">
        {children}
      </button>
    );

    const tabTitle = navItems.find(item => item.id === settingsTab)?.label;

    return (
      <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 px-6 py-6">
        <button aria-label="Close settings overlay" onClick={() => setSettingsOpen(false)} className="absolute inset-0 cursor-default" />
        <section className="relative z-10 flex h-[min(760px,92vh)] w-[min(1040px,94vw)] overflow-hidden border border-[#1a1a1a] bg-[#ebe9e0] shadow-[18px_18px_0_rgba(0,0,0,0.22)]">
          <aside className="w-64 shrink-0 border-r border-[#d1d0c9] bg-[#dfdccf] p-5">
            <div className="mb-7 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center border border-[#1a1a1a] bg-[#1a1a1a] font-serif text-2xl text-[#f5f4f0]">D</div>
              <div className="min-w-0">
                <div className="truncate font-serif text-xl leading-none">Studio Director</div>
                <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.16em] text-[#7d786b]">@director</div>
              </div>
            </div>

            <nav className="flex flex-col gap-1">
              {navItems.map(item => {
                const Icon = item.icon;
                const active = settingsTab === item.id;
                return (
                  <button
                    key={item.id}
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
                <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-[#8b8678]">Hall of Fame Studio Settings</div>
                <h2 className="font-serif text-3xl leading-none">{tabTitle}</h2>
              </div>
              <button onClick={() => setSettingsOpen(false)} className="p-2 text-[#555047] hover:bg-[#d1d0c9] hover:text-black transition-colors" aria-label="Close settings">
                <X size={18} />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-7 py-6">
              {settingsTab === 'deployment' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-5">
                    <SettingField label="部署模式" hint="用于切换云端 API、企业网关、本地模型服务或混合回退。">
                      <select className={fieldClass} defaultValue="gateway">
                        <option value="gateway">统一 API Gateway</option>
                        <option value="openai-compatible">OpenAI Compatible Endpoint</option>
                        <option value="azure">Azure OpenAI</option>
                        <option value="gemini">Google Gemini API</option>
                        <option value="local">Local Runtime / Ollama</option>
                      </select>
                    </SettingField>
                    <SettingField label="环境" hint="Mock 阶段先预留开发、预发和生产环境切换。">
                      <select className={fieldClass} defaultValue="dev">
                        <option value="dev">Development</option>
                        <option value="staging">Staging</option>
                        <option value="prod">Production</option>
                      </select>
                    </SettingField>
                  </div>
                  <SettingField label="API Base URL" hint="可填写自建网关、反向代理或云厂商 endpoint。">
                    <input className={fieldClass} defaultValue="https://api.halloffame.studio/v1" />
                  </SettingField>
                  <div className="grid grid-cols-3 gap-5">
                    <SettingField label="请求超时">
                      <input className={fieldClass} defaultValue="60s" />
                    </SettingField>
                    <SettingField label="并发上限">
                      <input className={fieldClass} defaultValue="8" />
                    </SettingField>
                    <SettingField label="失败重试">
                      <input className={fieldClass} defaultValue="2" />
                    </SettingField>
                  </div>
                  <ToggleField label="启用健康检查" hint="在进入会议室、市场检索、长任务运行前检查 API 可用性。" defaultChecked />
                  <ToggleField label="启用流式输出" hint="Roundtable、Chat 与 Agent 回复按 token 流式展示。" defaultChecked />
                </div>
              )}

              {settingsTab === 'keys' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-[1fr_auto] gap-3">
                    <SettingField label="Primary API Key" hint="用于默认模型请求。真实版本应写入安全存储，不进入前端 bundle。">
                      <input className={fieldClass} type={showPrimaryKey ? 'text' : 'password'} defaultValue="sk-hofs_live_demo_xxxxxxxxxxxx" />
                    </SettingField>
                    <button onClick={() => setShowPrimaryKey(!showPrimaryKey)} className="mt-6 h-[34px] border border-[#d1d0c9] bg-[#f8f6ee] px-3 text-[#555047] hover:border-[#1a1a1a] hover:text-black" aria-label="Toggle API key visibility">
                      {showPrimaryKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-5">
                    <SettingField label="Gemini API Key">
                      <input className={fieldClass} type="password" defaultValue="AIzaSy_demo_xxxxxxxxxxxxx" />
                    </SettingField>
                    <SettingField label="Azure / Enterprise Token">
                      <input className={fieldClass} type="password" placeholder="Paste token..." />
                    </SettingField>
                  </div>
                  <div className="grid grid-cols-2 gap-5">
                    <SettingField label="Key 作用域">
                      <select className={fieldClass} defaultValue="workspace">
                        <option value="personal">Personal</option>
                        <option value="workspace">Workspace</option>
                        <option value="project">Project Only</option>
                      </select>
                    </SettingField>
                    <SettingField label="轮换提醒">
                      <select className={fieldClass} defaultValue="30">
                        <option value="14">Every 14 days</option>
                        <option value="30">Every 30 days</option>
                        <option value="90">Every 90 days</option>
                      </select>
                    </SettingField>
                  </div>
                  <ToggleField label="从环境变量读取 Key" hint="支持 HOF_API_KEY、GEMINI_API_KEY、AZURE_OPENAI_API_KEY。" defaultChecked />
                  <ToggleField label="保存前验证凭证" hint="保存 Key 前自动发起轻量 ping 请求。" defaultChecked />
                </div>
              )}

              {settingsTab === 'models' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-5">
                    <SettingField label="默认对话模型">
                      <select className={fieldClass} defaultValue="gpt-4.1">
                        <option value="gpt-4.1">GPT-4.1</option>
                        <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                        <option value="claude-sonnet">Claude Sonnet</option>
                        <option value="local">Local Model</option>
                      </select>
                    </SettingField>
                    <SettingField label="深度推理模型">
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
                  <SettingField label="模型路由规则" hint="借鉴 Cursor 的模型选择、Gemini 的长上下文入口，按任务类型自动选择模型。">
                    <textarea className={`${fieldClass} min-h-[96px] resize-none`} defaultValue={'agent_market: fast\nroundtable: reasoning\nproject_chat: default\ntimeline_analysis: long-context'} />
                  </SettingField>
                  <ToggleField label="成本优先回退" hint="高峰或余额不足时优先切换到更低成本模型。" />
                  <ToggleField label="为 Agent 保留独立系统提示词" hint="每个历史人物 Agent 可拥有独立 persona、rules、memory。" defaultChecked />
                </div>
              )}

              {settingsTab === 'privacy' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-5">
                    <SettingField label="数据保留">
                      <select className={fieldClass} defaultValue="30">
                        <option value="session">Session Only</option>
                        <option value="30">30 Days</option>
                        <option value="forever">Until Manual Delete</option>
                      </select>
                    </SettingField>
                    <SettingField label="日志级别">
                      <select className={fieldClass} defaultValue="metadata">
                        <option value="off">Off</option>
                        <option value="metadata">Metadata Only</option>
                        <option value="full">Full Debug</option>
                      </select>
                    </SettingField>
                  </div>
                  <ToggleField label="关闭训练数据共享" hint="企业部署默认不把用户内容用于第三方模型训练。" defaultChecked />
                  <ToggleField label="敏感信息自动遮罩" hint="自动遮罩 Key、邮箱、手机号、财务编号等内容。" defaultChecked />
                  <ToggleField label="项目级访问控制" hint="项目、会议记录、Timeline 节点按成员权限隔离。" defaultChecked />
                  <ToggleField label="导出前二次确认" hint="导出聊天记录、Agent dossier 或项目材料前确认权限。" defaultChecked />
                </div>
              )}

              {settingsTab === 'workspace' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-5">
                    <SettingField label="默认语言">
                      <select className={fieldClass} defaultValue="zh">
                        <option value="zh">中文</option>
                        <option value="en">English</option>
                        <option value="auto">Auto</option>
                      </select>
                    </SettingField>
                    <SettingField label="界面密度">
                      <select className={fieldClass} defaultValue="compact">
                        <option value="compact">Compact</option>
                        <option value="comfortable">Comfortable</option>
                      </select>
                    </SettingField>
                  </div>
                  <div className="grid grid-cols-2 gap-5">
                    <SettingField label="默认项目可见性">
                      <select className={fieldClass} defaultValue="invite">
                        <option value="private">Private</option>
                        <option value="invite">Invite Only</option>
                        <option value="workspace">Workspace</option>
                      </select>
                    </SettingField>
                    <SettingField label="自动保存间隔">
                      <select className={fieldClass} defaultValue="15">
                        <option value="5">5 seconds</option>
                        <option value="15">15 seconds</option>
                        <option value="60">1 minute</option>
                      </select>
                    </SettingField>
                  </div>
                  <ToggleField label="启用项目 Rules" hint="类似 Cursor rules，为每个项目保存写作口径、品牌约束、输出格式。" defaultChecked />
                  <ToggleField label="启用长期记忆" hint="类似 Gemini saved info，用于记住用户偏好、常用人设和项目背景。" />
                  <ToggleField label="会议结束自动生成纪要" hint="Roundtable 结束后生成决策、待办、风险和分歧记录。" defaultChecked />
                </div>
              )}

              {settingsTab === 'integrations' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-5">
                    <SettingField label="代理 / 网络">
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
                  <ToggleField label="启用 MCP / 外部工具调用" hint="为后续文件系统、浏览器、数据库、设计工具接入预留。" defaultChecked />
                  <ToggleField label="预算接近上限时提醒" hint="到达 80% 预算时在侧边栏和项目页提醒。" defaultChecked />
                  <ToggleField label="错误自动上报" hint="只上报错误类型、请求 ID 和运行环境，不上报正文内容。" />
                </div>
              )}
            </div>

            <footer className="flex h-16 shrink-0 items-center justify-between border-t border-[#d1d0c9] px-7">
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-green-700">
                <CheckCircle2 size={14} />
                Mock configuration ready
              </div>
              <div className="flex items-center gap-2">
                <button className="border border-[#d1d0c9] px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-[#555047] hover:border-[#1a1a1a] hover:text-black transition-colors">Test Connection</button>
                <SmallButton><Save size={12} className="inline-block mr-2" />Save Settings</SmallButton>
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
              <span className="block font-mono text-[8px] uppercase tracking-[0.18em] text-gray-500 mt-1">名人堂工作室</span>
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
              onClick={() => setSettingsOpen(true)}
              className="flex h-9 w-9 shrink-0 items-center justify-center border border-[#1a1a1a] bg-[#1a1a1a] font-serif text-lg text-[#f5f4f0] transition-colors hover:bg-[#3a3429]"
              title="Open user settings"
            >
              D
            </button>
            <button onClick={() => setSettingsOpen(true)} className="min-w-0 flex-1 text-left">
              <span className="block truncate font-serif text-base leading-none text-[#1a1a1a]">Studio Director</span>
              <span className="mt-1 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-green-700">
                <UserCircle size={11} />
                @director
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
              title="Studio Director"
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
            const isRecruited = recruitedIds.includes(agent.id);
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
                      <span className="font-mono text-[8px] uppercase tracking-widest text-gray-400 block mb-0.5">第一被认知身份</span>
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
                  <span className="font-mono text-[10px] text-gray-600 font-bold bg-gray-100 px-2 py-1">{agent.price}</span>
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
    const isRecruited = recruitedIds.includes(agent.id);
    const isStamping = signingAgentId === agent.id;
    const profile = getDossierProfile(agent);
    const skill = profile.skill || null;
    const avatar = pantheonAvatarMeta(agent.id);
    const imageSrc = pantheonAvatarSrc(agent.id);
    const evidenceStrips = [
      { label: 'Primary Identity', value: agent.primaryIdentity },
      { label: 'Operational Class', value: agent.category },
      { label: 'Current Rate', value: agent.price },
      ...(skill ? [
        { label: 'Skill Runtime', value: profile.skillStats || `Registered / ${skill.defaultFormat.length} steps` },
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
          Refile Archive
        </button>

        <div className="absolute top-7 right-7 z-50 flex items-center gap-3 text-[#e8ddbf] font-mono text-[10px] uppercase tracking-widest">
          <span className="border border-[#8d7a58] px-3 py-2 bg-black/20">Skills: {PERSON_SKILL_COUNT} · Docs: {PERSON_SKILL_DOC_COUNT}</span>
          <span className="border border-[#8d7a58] px-3 py-2 bg-black/20">Clearance: Director</span>
          <span className="border border-red-900/70 text-red-200 px-3 py-2 bg-red-950/25">Live Dossier</span>
        </div>

        <div className="absolute left-[5vw] top-[17vh] w-52 h-72 bg-[#d9caa4] border border-[#7c6847] shadow-2xl desk-prop hidden lg:block" style={{ '--from-rot': '-18deg', '--to-rot': '-11deg' }}>
          <div className="h-10 bg-[#4c1110] text-[#eadfbd] font-mono text-[9px] tracking-widest uppercase flex items-center px-4">Recovered Memo</div>
          <div className="p-5 space-y-3">
            <div className="h-2 bg-[#6b5a3d]/50 w-3/4" />
            <div className="h-2 bg-[#6b5a3d]/35 w-full" />
            <div className="h-2 bg-[#6b5a3d]/35 w-5/6" />
            <div className="mt-8 border-2 border-[#7f211c] text-[#7f211c] font-mono text-xs inline-block px-3 py-1 rotate-[-8deg]">VETTED</div>
          </div>
        </div>

        <div className="absolute right-[4vw] bottom-[9vh] w-64 h-44 bg-[#161412] border border-[#7b6542] shadow-2xl desk-prop hidden xl:block" style={{ '--from-rot': '16deg', '--to-rot': '8deg' }}>
          <div className="absolute inset-4 border border-[#9e885d]/50 scan-sweep overflow-hidden">
            <div className="p-4 text-[#e8ddbf] font-mono text-[9px] uppercase tracking-widest">
              <ScanLine size={18} className="mb-4 text-red-300" />
              Signal desk<br />paper trail<br />identity match
            </div>
          </div>
        </div>

        <div className="relative z-30 h-full flex items-center justify-center px-5 py-20">
          <div className={`archive-dossier relative w-full max-w-6xl min-h-[680px] max-h-[calc(100vh-120px)] overflow-hidden border border-[#765f3e] grid grid-cols-12 ${isStamping ? 'dossier-impact' : ''}`}>
            <div className="absolute -top-4 left-10 right-24 h-12 bg-[#c8b688] border border-[#755f3f] -rotate-1 shadow-lg" />
            <div className="absolute top-8 right-10 border-[5px] border-[#8f1e18] text-[#8f1e18] font-mono text-2xl font-bold uppercase tracking-[0.22em] px-5 py-2 rotate-[10deg] opacity-80 mix-blend-multiply pointer-events-none">
              {isRecruited ? 'Contracted' : 'Pending'}
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
                      APPROVED
                    </div>
                  </div>
                </div>
                <div className="absolute left-[76%] top-[16%] z-[75] pointer-events-none fresh-contract-seal border-[7px] border-[#8f1e18] text-[#8f1e18] font-mono text-3xl font-black uppercase tracking-[0.22em] px-7 py-3 mix-blend-multiply">
                  Contracted
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

            <section className="col-span-12 lg:col-span-4 border-r border-[#b8a57d] p-8 bg-[#d9c797]/45 relative overflow-hidden">
              <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: 'repeating-linear-gradient(135deg, #2b2118 0, #2b2118 1px, transparent 1px, transparent 10px)' }} />
              <div className="relative z-10">
                <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#6b241e] mb-4 ink-reveal">Personnel Visual Record</div>
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
                    <span>{agent.id}</span>
                    <span>{avatar?.license || 'Symbolic'}</span>
                  </div>
                </div>

                <h1 className="font-serif text-5xl leading-none tracking-tight text-[#201610] mb-3 ink-reveal">
                  {agent.name}
                </h1>
                <div className="font-mono text-[10px] uppercase tracking-widest text-[#6d5a3d] mb-6 ink-reveal">
                  {profile.codename}
                </div>

                <div className="space-y-3">
                  {evidenceStrips.map((item, index) => (
                    <div key={item.label} className="border-l-4 border-[#8f1e18] bg-[#f5ebcc]/65 p-3 shadow-sm ink-reveal" style={{ animationDelay: `${0.1 + index * 0.08}s` }}>
                      <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18] mb-1">{item.label}</div>
                      <div className="font-serif text-base leading-snug">{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="col-span-12 lg:col-span-5 p-8 border-r border-[#b8a57d] relative overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.26em] text-[#6b241e]">Five-Axis Capability Map</div>
                  <div className="font-serif text-3xl text-[#201610]">Operational Shape</div>
                </div>
                <Crosshair size={26} className="text-[#8f1e18]" />
              </div>

              <div className="grid md:grid-cols-[280px_1fr] gap-6 items-center">
                <RadarChart points={profile.scores} />
                <div className="space-y-3">
                  {profile.scores.map((item, index) => (
                    <div key={item.label} className="ink-reveal" style={{ animationDelay: `${0.12 + index * 0.06}s` }}>
                      <div className="flex justify-between font-mono text-[9px] uppercase tracking-widest mb-1">
                        <span>{item.label}</span>
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
                    <Shield size={14} /> 擅长什么
                  </div>
                  <p className="font-serif text-lg leading-relaxed text-[#2a1e15]">{profile.strength}</p>
                </div>
                <div className="bg-[#f6ebca]/70 border border-[#b8a57d] p-5 shadow-sm">
                  <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-widest text-[#8f1e18] mb-3">
                    <Briefcase size={14} /> 使用建议
                  </div>
                  <p className="font-serif text-lg leading-relaxed text-[#2a1e15]">{profile.advice}</p>
                </div>
              </div>

              <div className="mt-6 bg-[#211812] text-[#eadfbd] border border-[#5c4933] p-5 shadow-lg">
                <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-widest text-red-200 mb-3">
                  <BookOpen size={14} /> 简介
                </div>
                <p className="font-serif text-xl leading-relaxed">{profile.summary}</p>
                {profile.motto && (
                  <p className="mt-4 border-l-4 border-[#8f1e18] pl-4 font-serif text-lg leading-relaxed text-[#f3dfad]">
                    {profile.motto}
                  </p>
                )}
              </div>
            </section>

            <aside className="col-span-12 lg:col-span-3 p-8 bg-[#251b13] text-[#eadfbd] relative overflow-hidden">
              <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: 'linear-gradient(#eadfbd 1px, transparent 1px), linear-gradient(90deg, #eadfbd 1px, transparent 1px)', backgroundSize: '22px 22px' }} />
              <div className="relative z-10 flex flex-col h-full">
                <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-red-200 mb-4">Director Decision</div>
                <div className="border border-[#7b6542] p-5 mb-6 bg-black/18">
                  <div className="font-serif text-3xl mb-2">{agent.price}</div>
                  <div className="font-mono text-[9px] uppercase tracking-widest text-[#bcae86]">per request authorization</div>
                </div>

                <div className="space-y-4 font-mono text-[10px] uppercase tracking-widest text-[#cdbf98] mb-8">
                  <div className="flex justify-between border-b border-[#59472e] pb-2"><span>Archive Chain</span><span>Clean</span></div>
                  <div className="flex justify-between border-b border-[#59472e] pb-2"><span>Identity Use</span><span>Style Agent</span></div>
                  <div className="flex justify-between border-b border-[#59472e] pb-2"><span>Status</span><span>{isRecruited ? 'Secured' : 'Awaiting'}</span></div>
                </div>

                <div className="mt-auto space-y-3">
                  <button
                    onClick={() => startContractStamp(agent.id)}
                    disabled={isRecruited || isStamping}
                    className={`w-full flex items-center justify-center gap-3 px-5 py-4 font-mono text-[10px] uppercase tracking-widest border transition-all
                      ${isRecruited ? 'border-[#7b6542] text-[#9f916e] cursor-not-allowed bg-[#1a130e]' : isStamping ? 'border-[#8f1e18] text-red-100 bg-[#8f1e18] cursor-wait' : 'border-[#e8ddbf] bg-[#e8ddbf] text-[#251b13] hover:-translate-y-0.5 hover:shadow-[7px_7px_0_rgba(143,30,24,0.55)]'}
                    `}
                  >
                    {isRecruited ? <CheckCircle2 size={15} /> : <FileSignature size={15} />}
                    {isRecruited ? 'Contract Secured' : isStamping ? 'Stamping Contract' : 'Authorize Contract'}
                  </button>
                  <button
                    onClick={closeMarketDossier}
                    className="w-full flex items-center justify-center gap-3 px-5 py-4 font-mono text-[10px] uppercase tracking-widest border border-[#7b6542] text-[#e8ddbf] hover:bg-[#34271b] transition-colors"
                  >
                    <ArrowLeft size={15} />
                    Return to Market
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
      briefing: '发起人说明项目意图',
      discussion: '圆桌正在确认组织方式',
      decision: '等待会议结论',
      approved: '已批准进入 dashboard',
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
                  发起人先讲清楚想做什么。项目成员在圆桌中自然商讨领导、汇报、执行、产出形式。通过后才生成正式项目。
                </p>
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
                    先描述想法，再由圆桌商讨谁推进、谁汇报、谁执行、最终交付什么。通过后进入 dashboard。
                  </p>
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
                      这不是表单。控制台只记录会议阶段和最终结论，结构由讨论自然产生。
                    </p>
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
            <h2 className="font-serif text-4xl leading-none mb-6">立项共识</h2>
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
                只有这场立项圆桌通过，项目才会进入 dashboard。否则它只是一场会议记录。
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
    const invitedMembers = INITIATION_MEMBERS.filter(member => initiationInviteIds.includes(member.id));
    const selectedMember = INITIATION_MEMBERS.find(member => member.id === selectedInitiationMemberId) || invitedMembers[0] || INITIATION_MEMBERS[1];
    const taskText = `${initiationDraft.name} ${initiationDraft.summary} ${initiationDraft.intent} ${initiationDraft.output} ${initiationDraft.reason}`;
    const roleNegotiation = createKickoffRoleNegotiation(invitedMembers, taskText, {
      projectId: 'initiation_roundtable_draft',
      projectName: initiationDraft.name,
    });
    const leaderElection = createLeaderElection(invitedMembers, taskText, {
      projectId: 'initiation_roundtable_draft',
      projectName: initiationDraft.name,
    });
    const confirmedLeaderId = selectedLeaderCandidateId || leaderElection.recommendedLeaderId;
    const skillPlan = createRoundtablePlan(invitedMembers.map(member => member.id), taskText);
    const firstLead = invitedMembers.find(member => member.id === confirmedLeaderId)
      || invitedMembers.find(member => member.id === skillPlan.lead?.slug)
      || invitedMembers[0]
      || INITIATION_MEMBERS[1];
    const reporter = invitedMembers.find(member => member.id === skillPlan.reviewer?.slug && member.id !== firstLead.id)
      || invitedMembers.find(member => member.id !== firstLead.id)
      || firstLead;
    const workingGroup = invitedMembers.filter(member => member.id !== firstLead.id && member.id !== reporter.id);
    const initiationMeetingProject = {
      id: 'initiation_roundtable_draft',
      name: initiationDraft.name || 'Untitled Initiation',
      team: [INITIATION_MEMBERS[0], ...invitedMembers].map(member => ({
        id: member.id,
        name: member.name,
        role: member.id === 'founder' ? 'Founder' : member.title,
      })),
    };
    const steps = [
      { id: 'brief', label: '项目意图' },
      { id: 'invite', label: '选择参会人' },
      { id: 'lobby', label: '会议准备' },
      { id: 'meeting', label: '立项圆桌' },
      { id: 'result', label: '生成项目' },
    ];
    const stepIndex = Math.max(0, steps.findIndex(step => step.id === initiationStep));
    const meetingTranscript = [
      {
        who: 'Director',
        speakerId: 'founder',
        tone: 'brief',
        text: `${initiationDraft.name}: ${initiationDraft.intent || initiationDraft.summary}`,
      },
      ...roleNegotiation.transcript.map(item => ({
        who: item.speaker,
        speakerId: item.speakerId,
        tone: item.type === 'role-question' ? 'role question' : 'self nomination',
        text: item.text,
      })),
      ...leaderElection.transcript.map(item => ({
        who: item.speaker,
        speakerId: item.agentId,
        tone: 'leader campaign',
        text: item.text,
      })),
    ];
    const updateDraft = (key, value) => setInitiationDraft(prev => ({ ...prev, [key]: value }));
    const toggleInvite = (id) => {
      setInitiationInviteIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
      setSelectedInitiationMemberId(id);
    };
    const goStep = (id) => setInitiationStep(id);

    return (
      <div className="flex-1 overflow-hidden bg-[#0d0c0b] text-[#efe2bd] fade-in">
        <div className="h-full">
          <section className="relative overflow-y-auto">
            <div className="absolute inset-0 project-room" />
            <div className="absolute inset-0 opacity-45" style={{ backgroundImage: 'radial-gradient(circle at 48% 35%, transparent 0, rgba(0,0,0,0.78) 70%)' }} />

            <header className="sticky top-0 z-30 bg-[#0d0c0b]/72 backdrop-blur border-b border-[#3a2a1c]/70 px-8 py-4">
              <div className="flex items-start justify-between gap-6 mb-4">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-[#bcae86] mb-3 flex items-center gap-3">
                    <FileSignature size={15} className="text-[#8f1e18]" />
                    Project Initiation Flow
                  </div>
                  <h1 className="font-serif text-5xl leading-none">发起立项</h1>
                </div>
                <button onClick={navToDashboard} className="font-mono text-[10px] uppercase tracking-widest border border-[#3a2a1c] px-4 py-2 text-[#bcae86] hover:text-[#efe2bd] hover:border-[#7b6542] transition-colors">
                  Back
                </button>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {steps.map((step, index) => (
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
            </header>

            <div className="relative z-10 p-8 xl:p-10">
              {initiationStep === 'brief' && (
                <div className="max-w-3xl mx-auto">
                  <div className="bg-[#efe2bd] text-[#251b13] border border-[#7b6542] p-7 shadow-[16px_16px_0_rgba(0,0,0,0.25)]">
                    <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#8f1e18] mb-5">Step 01 / Project Brief</div>
                    <div className="space-y-5">
                      <label className="block">
                        <span className="font-mono text-[9px] uppercase tracking-widest text-[#7d6a49]">项目名</span>
                        <input value={initiationDraft.name} onChange={(e) => updateDraft('name', e.target.value)} className="mt-2 w-full bg-[#f7edcf] border border-[#b8a57d] px-4 py-3 font-serif text-3xl outline-none focus:border-[#8f1e18]" />
                      </label>
                      <label className="block">
                        <span className="font-mono text-[9px] uppercase tracking-widest text-[#7d6a49]">一句话描述</span>
                        <input value={initiationDraft.summary} onChange={(e) => updateDraft('summary', e.target.value)} className="mt-2 w-full bg-[#f7edcf] border border-[#b8a57d] px-4 py-3 font-serif text-xl outline-none focus:border-[#8f1e18]" />
                      </label>
                      <label className="block">
                        <span className="font-mono text-[9px] uppercase tracking-widest text-[#7d6a49]">你想做什么</span>
                        <textarea value={initiationDraft.intent} onChange={(e) => updateDraft('intent', e.target.value)} className="mt-2 w-full min-h-[92px] resize-none bg-[#f7edcf] border border-[#b8a57d] px-4 py-3 font-serif text-xl leading-relaxed outline-none focus:border-[#8f1e18]" />
                      </label>
                      <div className="hidden">
                        <label className="block">
                          <span className="font-mono text-[9px] uppercase tracking-widest text-[#7d6a49]">预期产出</span>
                          <input value={initiationDraft.output} onChange={(e) => updateDraft('output', e.target.value)} className="mt-2 w-full bg-[#f7edcf] border border-[#b8a57d] px-4 py-3 font-serif text-lg outline-none focus:border-[#8f1e18]" />
                        </label>
                        <label className="block">
                          <span className="font-mono text-[9px] uppercase tracking-widest text-[#7d6a49]">为什么现在做</span>
                          <input value={initiationDraft.reason} onChange={(e) => updateDraft('reason', e.target.value)} className="mt-2 w-full bg-[#f7edcf] border border-[#b8a57d] px-4 py-3 font-serif text-lg outline-none focus:border-[#8f1e18]" />
                        </label>
                      </div>
                    </div>
                    <button onClick={() => goStep('invite')} className="mt-7 w-full bg-[#8f1e18] hover:bg-[#a62a22] text-white px-5 py-4 flex items-center justify-center gap-3 font-mono text-[10px] uppercase tracking-widest transition-colors">
                      选择参会人 <ChevronRight size={15} />
                    </button>
                  </div>

                  <aside className="hidden">
                    <div className="font-mono text-[10px] uppercase tracking-[0.26em] text-[#8f1e18] mb-5">Draft Status</div>
                    <h2 className="font-serif text-4xl leading-none mb-4">{initiationDraft.name || '未命名项目'}</h2>
                    <p className="font-serif text-xl leading-relaxed text-[#d8c99f] mb-6">{initiationDraft.summary}</p>
                    <div className="border-t border-[#3a2a1c] pt-5 font-serif text-lg leading-relaxed text-[#bcae86]">
                      当前只是在创建立项草案，还不会进入 dashboard。下一步才是邀请参会人。
                    </div>
                    <button onClick={() => goStep('invite')} className="mt-7 w-full bg-[#8f1e18] hover:bg-[#a62a22] text-white px-5 py-4 flex items-center justify-center gap-3 font-mono text-[10px] uppercase tracking-widest transition-colors">
                      选择参会人 <ChevronRight size={15} />
                    </button>
                  </aside>
                </div>
              )}

              {initiationStep === 'invite' && (
                <div className="max-w-5xl mx-auto">
                  <section>
                    <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#bcae86] mb-4">Step 02 / Invite People</div>
                    <h2 className="font-serif text-5xl leading-none mb-6">邀请谁参加这次立项圆桌？</h2>
                    <div className="grid md:grid-cols-2 gap-4">
                      {INITIATION_MEMBERS.slice(1).map(member => {
                        const selected = initiationInviteIds.includes(member.id);
                        return (
                          <button key={member.id} onClick={() => toggleInvite(member.id)} className={`text-left border p-5 transition-all ${selected ? 'bg-[#efe2bd] text-[#251b13] border-[#efe2bd] shadow-[8px_8px_0_rgba(143,30,24,0.25)]' : 'bg-[#1a130e]/88 border-[#3a2a1c] text-[#efe2bd] hover:border-[#7b6542]'}`}>
                            <div className="flex items-start justify-between gap-4 mb-4">
                              <div className="h-14 w-14 rounded-full border border-current flex items-center justify-center font-serif text-2xl">{member.name.charAt(0)}</div>
                              <div className={`font-mono text-[8px] uppercase tracking-widest px-2 py-1 ${selected ? 'bg-[#251b13] text-[#efe2bd]' : 'bg-[#3a2a1c] text-[#bcae86]'}`}>{selected ? 'Invited' : 'Invite'}</div>
                            </div>
                            <div className="font-serif text-3xl leading-none mb-2">{member.name}</div>
                            <div className="font-mono text-[9px] uppercase tracking-widest opacity-70 mb-3">{member.title}</div>
                            <p className="font-serif text-lg leading-relaxed opacity-80">{member.duty}</p>
                          </button>
                        );
                      })}
                    </div>
                    <button onClick={() => goStep('lobby')} disabled={invitedMembers.length === 0} className="mt-7 w-full bg-[#8f1e18] disabled:bg-[#3a2a1c] disabled:text-[#7d6a49] hover:bg-[#a62a22] text-white px-5 py-4 flex items-center justify-center gap-3 font-mono text-[10px] uppercase tracking-widest transition-colors">
                      进入会议准备页 <ChevronRight size={15} />
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
                      进入会议准备页 <ChevronRight size={15} />
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
                        ['会议目标', '确认是否立项，以及谁负责什么'],
                        ['参会人数', `${invitedMembers.length + 1} people`],
                        ['进入条件', '必须开完立项圆桌'],
                      ].map(([label, value]) => (
                        <div key={label} className="border border-[#b8a57d] p-4 bg-[#f7edcf]">
                          <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] mb-2">{label}</div>
                          <div className="font-serif text-xl">{value}</div>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => { setInitiationPhase('discussion'); goStep('meeting'); }} className="mt-7 w-full bg-[#8f1e18] hover:bg-[#a62a22] text-white px-5 py-4 flex items-center justify-center gap-3 font-mono text-[10px] uppercase tracking-widest transition-colors">
                      开始立项圆桌 <Users size={15} />
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
                    <button onClick={() => { setInitiationPhase('discussion'); goStep('meeting'); }} className="w-full bg-[#8f1e18] hover:bg-[#a62a22] text-white px-5 py-4 flex items-center justify-center gap-3 font-mono text-[10px] uppercase tracking-widest transition-colors">
                      开始立项圆桌 <Users size={15} />
                    </button>
                  </aside>
                </div>
              )}

              {initiationStep === 'meeting' && (
                <div className="max-w-6xl mx-auto">
                  <section className="relative min-h-[520px] border border-[#3a2a1c] bg-[#1a130e]/82 overflow-hidden">
                    <div className="absolute inset-0 dotgrid-bg--dark opacity-80" />
                    <div className="absolute left-1/2 top-[45%] h-[260px] w-[min(660px,86%)] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border border-[#7b6542]/50 bg-[#251b13]/70" />
                    <div className="absolute left-1/2 top-[45%] -translate-x-1/2 -translate-y-1/2 w-[320px] border border-[#7b6542] bg-[#efe2bd] text-[#251b13] p-5 shadow-[14px_14px_0_rgba(0,0,0,0.28)]">
                      <div className="font-mono text-[8px] uppercase tracking-[0.22em] text-[#8f1e18] mb-2">Founder Brief</div>
                      <h2 className="font-serif text-2xl leading-none mb-3">{initiationDraft.name}</h2>
                      <p className="font-serif text-base leading-relaxed text-[#4d3c28]">{initiationDraft.summary}</p>
                    </div>
                    {[INITIATION_MEMBERS[0], ...invitedMembers].map((member, index) => {
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
                    <div className="absolute inset-x-6 bottom-24 grid max-h-[260px] overflow-y-auto pr-2 md:grid-cols-2 gap-3">
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
                        </button>
                      ))}
                    </div>
                    <button onClick={() => { setInitiationPhase('decision'); goStep('result'); }} className="absolute right-6 bottom-6 z-30 bg-[#8f1e18] hover:bg-[#a62a22] text-white px-5 py-4 flex items-center justify-center gap-3 font-mono text-[10px] uppercase tracking-widest transition-colors">
                      结束会议，查看结论 <ChevronRight size={15} />
                    </button>
                  </section>
                  <aside className="hidden">
                    <div>
                      <div className="font-mono text-[9px] uppercase tracking-[0.24em] text-[#bcae86] mb-4">会议沉淀</div>
                      <div className="border border-[#3a2a1c] bg-[#0d0c0b] p-4 mb-4">
                        <div className="font-serif text-2xl mb-1">{selectedMember.name}</div>
                        <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] mb-3">{selectedMember.title}</div>
                        <p className="font-serif text-lg leading-relaxed text-[#d8c99f]">{selectedMember.duty}</p>
                      </div>
                      <div className="space-y-2">
                        {['描述项目', '确认第一领导人', '确认汇报人', '确认执行成员', '确认产出形式'].map((item, index) => (
                          <div key={item} className="flex items-center gap-3 font-serif text-lg text-[#d8c99f]">
                            <CheckCircle2 size={15} className={index < 4 ? 'text-[#59684b]' : 'text-[#8f1e18]'} />
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>
                    <button onClick={() => { setInitiationPhase('decision'); goStep('result'); }} className="mt-5 w-full bg-[#8f1e18] hover:bg-[#a62a22] text-white px-4 py-4 flex items-center justify-center gap-3 font-mono text-[10px] uppercase tracking-widest transition-colors">
                      结束会议，查看结论 <ChevronRight size={15} />
                    </button>
                  </aside>
                </div>
              )}

              {initiationStep === 'result' && (
                <div className="max-w-5xl mx-auto">
                  <section className="bg-[#efe2bd] text-[#251b13] border border-[#7b6542] p-8">
                    <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#8f1e18] mb-5">Step 05 / Initiation Result</div>
                    <h2 className="font-serif text-5xl leading-none mb-7">立项结论：通过</h2>
                    <div className="grid md:grid-cols-2 gap-4">
                      {[
                        ['项目名', initiationDraft.name],
                        ['第一领导人', firstLead.name],
                        ['汇报负责人', reporter.name],
                        ['执行成员', workingGroup.map(member => member.name).join(' / ') || firstLead.name],
                        ['产出形式', initiationDraft.output],
                        ['来源会议', 'Mandatory initiation roundtable'],
                      ].map(([label, value]) => (
                        <div key={label} className="border border-[#b8a57d] bg-[#f7edcf] p-4">
                          <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] mb-2">{label}</div>
                          <div className="font-serif text-2xl leading-tight">{value}</div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-6 border border-[#b8a57d] bg-[#f7edcf] p-5">
                      <div className="font-mono text-[10px] uppercase tracking-widest text-[#8f1e18] mb-4">Leader Election</div>
                      <div className="grid md:grid-cols-2 gap-3">
                        {leaderElection.candidates.slice(0, 4).map(candidate => {
                          const selected = firstLead.id === candidate.agentId;
                          return (
                            <button
                              key={candidate.agentId}
                              type="button"
                              onClick={() => setSelectedLeaderCandidateId(candidate.agentId)}
                              className={`text-left border p-4 transition-colors ${selected ? 'border-[#8f1e18] bg-[#251b13] text-[#efe2bd]' : 'border-[#b8a57d] bg-[#efe2bd] text-[#251b13] hover:border-[#8f1e18]'}`}
                            >
                              <div className="flex items-center justify-between gap-3 mb-2">
                                <span className="font-serif text-2xl leading-none">{candidate.name}</span>
                                <span className="font-mono text-[8px] uppercase tracking-widest">{candidate.score} pts</span>
                              </div>
                              <div className="font-mono text-[8px] uppercase tracking-widest opacity-70 mb-2">{candidate.role}</div>
                              <p className="font-serif text-base leading-relaxed">{candidate.claim}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <button onClick={approveInitiationProject} className="mt-7 w-full bg-[#8f1e18] hover:bg-[#a62a22] text-white px-4 py-4 flex items-center justify-center gap-3 font-mono text-[10px] uppercase tracking-widest transition-colors">
                      <CheckCircle2 size={16} />
                      生成项目并进入 dashboard
                    </button>
                  </section>
                  <aside className="hidden">
                    <div className="font-mono text-[10px] uppercase tracking-[0.26em] text-[#8f1e18] mb-5">Project Gate</div>
                    <p className="font-serif text-2xl leading-relaxed text-[#d8c99f]">
                      现在才可以生成项目。通过后，这个项目会出现在 dashboard，并带上本次会议的第一领导人、汇报人和产出形式。
                    </p>
                    <button onClick={approveInitiationProject} className="mt-7 w-full bg-[#8f1e18] hover:bg-[#a62a22] text-white px-4 py-4 flex items-center justify-center gap-3 font-mono text-[10px] uppercase tracking-widest transition-colors">
                      <CheckCircle2 size={16} />
                      生成项目并进入 dashboard
                    </button>
                  </aside>
                </div>
              )}
            </div>
          </section>

          <aside className="border-l border-[#3a2a1c] bg-[#efe2bd] text-[#251b13] p-7 overflow-y-auto">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#8f1e18] mb-4">Initiation Summary</div>
            <h2 className="font-serif text-4xl leading-none mb-5">{initiationDraft.name || '未命名项目'}</h2>
            <p className="font-serif text-xl leading-relaxed text-[#4d3c28] mb-6">{initiationDraft.summary}</p>
            <div className="space-y-3 mb-8">
              {[
                ['当前阶段', steps[stepIndex]?.label],
                ['参会人', invitedMembers.map(member => member.name).join(' / ') || '未选择'],
                ['预期产出', initiationDraft.output],
                ['进入 dashboard', initiationStep === 'result' ? '等待确认生成' : '会议通过后'],
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
                项目必须完成立项圆桌后才会进入 dashboard。
              </p>
            </div>
          </aside>
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
            onClick={launchManagerDemoProject}
            className="group bg-[#8f1e18] text-[#f5f4f0] border border-[#8f1e18] px-5 py-4 flex items-center gap-4 shadow-[8px_8px_0_rgba(37,27,19,0.18)] hover:shadow-[4px_4px_0_rgba(37,27,19,0.28)] hover:-translate-y-0.5 transition-all"
          >
            <span className="w-9 h-9 border border-[#f5f4f0]/30 flex items-center justify-center group-hover:border-[#f5f4f0] transition-colors">
              <Play size={17} />
            </span>
            <span className="text-left">
              <span className="block font-serif text-xl leading-none">Run Manager Demo</span>
              <span className="block font-mono text-[9px] uppercase tracking-widest text-red-100 mt-1">Full scenario seed</span>
            </span>
          </button>
          <button
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

      <section className="mb-10 border border-[#251b13] bg-[#171411] text-[#efe2bd] overflow-hidden">
        <div className="grid lg:grid-cols-[1.2fr_0.8fr]">
          <div className="p-8">
            <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.28em] text-[#bcae86] mb-6">
              <DoorOpen size={16} className="text-[#8f1e18]" />
              Initiation Pipeline
            </div>
            <h2 className="font-serif text-4xl leading-tight mb-4">输入项目名，选择参会人，然后召开强制立项圆桌。</h2>
            <p className="font-serif text-xl leading-relaxed text-[#d8c99f] max-w-3xl">
              加号不会直接生成项目。它会先创建立项草案，再邀请成员进入会议准备页，会议通过后才把项目写入 dashboard。
            </p>
          </div>
          <div className="border-l border-[#3a2a1c] p-6 bg-[#0f0d0b]">
            <div className="grid grid-cols-2 gap-3 h-full">
              {[
                { label: 'Step 01', value: '输入项目名' },
                { label: 'Step 02', value: '选择参会人' },
                { label: 'Step 03', value: '开始圆桌会议' },
                { label: 'Step 04', value: '通过后生成项目' },
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
            <h2 className="font-serif text-4xl leading-tight mb-4">项目不是从表单里创建，而是从圆桌会议里被批准出来。</h2>
            <p className="font-serif text-xl leading-relaxed text-[#d8c99f] max-w-3xl">
              发起人先说明要做什么，团队在立项圆桌里商讨领导、汇报、执行与产出形式。会议结论通过后，项目才进入 dashboard。
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

      <div className="grid grid-cols-3 gap-6 mb-12">
        {[
          { icon: Database, label: 'Compute Used', val: '$24.50' },
          { icon: Cpu, label: 'Active Projects', val: projects.length },
          { icon: Activity, label: 'Task Throughput', val: '92%' }
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
    const isInitiatedProject = Boolean(activeProject.initiation);
    const dashboardStats = [
      { label: '今日重点', value: isInitiatedProject ? '立项共识' : 'Auth Middleware', icon: Crosshair },
      { label: '活跃频道', value: chatChannels.length, icon: Hash },
      { label: '时间线事件', value: isInitiatedProject ? activeProject.logs.length : PROJECT_TIMELINE_EVENTS.length, icon: GitCommit },
      { label: '自主循环', value: activeProject.autonomousLedger?.length || 0, icon: Activity },
    ];
    const nextSuggestion = isInitiatedProject
      ? `先由 ${activeProject.initiation.firstLead} 接管日常推进，${activeProject.initiation.reporter} 产出第一份汇报模板。工作组本轮交付：${activeProject.initiation.output}。`
      : '先进入圆桌会议室确认 BYOK 认证优先级，再让工程与设计频道同步执行边界。若需要看全貌，使用贡献时间线检查分叉进度。';
    const recentLine = isInitiatedProject
      ? activeProject.logs.map((log, index) => ({
          id: `init-log-${index}`,
          type: index === 0 ? 'approved' : 'record',
          day: 'Just now',
          hour: log.time,
          title: log.log,
          contributor: log.agent,
        }))
      : PROJECT_TIMELINE_EVENTS.slice(0, 5);
    const launchers = [
      { id: 'meeting', label: '圆桌会议室', sub: 'War Room', icon: ClipboardList, desc: '高权重会议发言与 Agent 意图调度。' },
      { id: 'chat', label: '小组频道', sub: 'Chat', icon: Monitor, desc: '项目组日常沟通、@ 提醒和任务卡片。' },
      { id: 'timeline', label: '贡献时间线', sub: 'Timeline', icon: ScrollText, desc: '横向提交线、分叉工作流和事件详情。' },
    ];
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
    const channelNameById = Object.fromEntries(chatChannels.map(channel => [channel.id, channel.name]));
    const agentStates = activeProject.agentStates || {};
    const kickoffCharter = activeProject.kickoffCharter || null;
    const changeLedger = activeProject.changeLedger || [];
    const peerHandoffs = activeProject.peerHandoffs || [];
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
                  <span className="bg-[#251b13] text-[#efe2bd] px-3 py-1">{activeProject.status}</span>
                  <span>ID: {activeProject.id}</span>
                  <span>{activeProject.team.length} Members</span>
                </div>
              </div>
              <div className="text-right">
                <div className="font-serif text-6xl">{activeProject.progress}%</div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-[#6b5a3d]">Project Progress</div>
              </div>
            </header>

            <section className="col-span-12 lg:col-span-7">
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
                {dashboardStats.map(item => (
                  <div key={item.label} className="bg-[#f7edcf]/70 border border-[#b8a57d] p-5">
                    <item.icon size={18} className="text-[#8f1e18] mb-4" />
                    <div className="font-mono text-[9px] uppercase tracking-widest text-[#7d6a49] mb-2">{item.label}</div>
                    <div className="font-serif text-2xl">{item.value}</div>
                  </div>
                ))}
              </div>

              <div className="bg-[#251b13] text-[#efe2bd] border border-[#5c4933] p-6 mb-6">
                <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-red-200 mb-4">
                  <Sparkles size={15} /> 下一步建议
                </div>
                {isInitiatedProject && (
                  <p className="font-serif text-2xl leading-relaxed">
                    {nextSuggestion}
                  </p>
                )}
                <p className={`font-serif text-2xl leading-relaxed ${isInitiatedProject ? 'hidden' : ''}`}>
                  先进入圆桌会议室确认 BYOK 认证优先级，再让工程与设计频道同步执行边界。若需要看全貌，使用贡献时间线检查分叉进度。
                </p>
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
                          <span>{cycle.cadence} / {cycle.publishedEventCount} published</span>
                          <span>{new Date(cycle.ranAt).toLocaleString()}</span>
                        </div>
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
                    <span className="node-status-tag bg-green-700 text-white">{kickoffCharter.status}</span>
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
                        <div className="min-w-0">
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

              {changeLedger.length > 0 && (
                <div className="bg-[#f7edcf]/70 border border-[#b8a57d] p-5 mb-6">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-[#8f1e18] mb-4">Change Ledger</div>
                  <div className="space-y-3">
                    {changeLedger.slice(0, 3).map(change => (
                      <div key={change.id} className="border border-[#d8c99f] bg-[#efe2bd]/55 p-4">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="font-serif text-lg leading-tight">{change.requestText}</div>
                          <span className="node-status-tag bg-green-700 text-white">{change.status}</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">Owner {change.ownerName || change.ownerId}</span>
                          <span className="node-status-tag bg-[#d8c99f] text-[#251b13]">From {channelNameById[change.sourceChannelId] || change.sourceChannelId || change.source}</span>
                          {change.reviewerName && <span className="node-status-tag bg-[#59684b] text-white">Reviewed by {change.reviewerName}</span>}
                        </div>
                        <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed">
                          {change.planUpdate || 'Plan sync pending'}
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
                      </div>
                    ))}
                  </div>
                </div>
              )}

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
                            {task.workPulseCount > 0 && <span className="node-status-tag bg-[#59684b] text-white">{task.workPulseCount} pulse{task.workPulseCount === 1 ? '' : 's'}</span>}
                            {task.completedAt && <span className="node-status-tag bg-green-700 text-white">Timeline published</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-[#f7edcf]/70 border border-[#b8a57d] p-5">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-[#8f1e18] mb-4">Team</div>
                  <div className="space-y-3">
                    {activeProject.team.map(agent => (
                      <div key={agent.id} className="flex items-center justify-between border-b border-[#d8c99f] pb-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="font-serif text-lg">{agent.name}</div>
                            {agent.isLeader && <span className="node-status-tag bg-[#8f1e18] text-white">Leader</span>}
                          </div>
                          <div className="font-mono text-[9px] uppercase tracking-widest text-[#7d6a49]">{agent.role}</div>
                          {agentStates[agent.id] && (
                            <div className="mt-2 space-y-1">
                              <div className="flex flex-wrap gap-1.5">
                                <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">{agentStates[agent.id].status}</span>
                                {agentStates[agent.id].managerId && <span className="node-status-tag bg-[#d8c99f] text-[#251b13]">Managed by {activeProject.team.find(item => item.id === agentStates[agent.id].managerId)?.name || agentStates[agent.id].managerId}</span>}
                                {agentStates[agent.id].managedIds?.length > 0 && <span className="node-status-tag bg-[#59684b] text-white">Manages {agentStates[agent.id].managedIds.length}</span>}
                                {agentStates[agent.id].peerManagedIds?.length > 0 && <span className="node-status-tag bg-[#b9782b] text-white">Peer manages {agentStates[agent.id].peerManagedIds.length}</span>}
                                {agentStates[agent.id].peerManagerIds?.length > 0 && <span className="node-status-tag bg-[#efe2bd] text-[#251b13]">Peer managed</span>}
                              </div>
                              <div className="font-mono text-[8px] uppercase tracking-widest text-[#9b875c] leading-relaxed">
                                Plan: {agentStates[agent.id].currentPlan?.focus || 'monitor'} / inbox {agentStates[agent.id].inbox?.length || 0} / worklog {agentStates[agent.id].worklog?.length || 0}
                              </div>
                              {agentStates[agent.id].currentPlan?.routine && (
                                <div className="font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] leading-relaxed">
                                  Routine: {agentStates[agent.id].currentPlan.routine.label} / {agentStates[agent.id].currentPlan.routine.artifact}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <div className={`w-2 h-2 rounded-full ${agentStates[agent.id]?.status === 'blocked' ? 'bg-[#8f1e18]' : 'bg-green-700'}`} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
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
            {launchers.map(item => (
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
              <button onClick={closeMeeting}
                className="text-[#bcae86] hover:text-[#efe2bd] transition-colors"><ChevronLeft size={18} /></button>
              <div className="breadcrumb-bar text-[#bcae86]">
                <span>{meetingProject.name}</span>
                <span className="sep">/</span>
                <span className="text-[#efe2bd]">{meetingTitle}</span>
                <span className="sep">/</span>
                <span className={isAnySpeaking ? 'text-[#8f1e18]' : 'text-[#59684b]'}>{isAnySpeaking ? '会议进行中' : '待命'}</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {completeMeeting && (
                <button
                  onClick={completeMeeting}
                  className="font-mono text-[10px] uppercase tracking-widest border border-[#8f1e18] bg-[#8f1e18] px-3 py-1.5 text-white hover:bg-[#a62a22] transition-colors"
                >
                  结束会议
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

              {/* Central Speaker Card — 3 states */}
              <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                {!roomSpeaker && roomTranscript.length <= 1 ? (
                  /* IDLE state */
                  <div className="w-[min(480px,42%)] bg-[#1a130e] border border-[#3a2a1c] p-6 text-center pointer-events-auto">
                    <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#7d6a49] mb-3">Roundtable Standby</div>
                    <div className="font-serif text-2xl leading-relaxed text-[#bcae86] mb-3">输入发言以开始会议讨论</div>
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

              {/* Agent Avatars — dynamic arc positioning */}
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
              {/* Intent Queue */}
              <div className="bg-[#1a130e]/80 border border-[#3a2a1c] rounded p-4 max-h-[35%] overflow-y-auto shrink-0">
                <div className="flex items-center gap-2 mb-3">
                  <span className="node-id-tag bg-[#8f1e18]">INT</span>
                  <span className="font-mono text-[9px] uppercase tracking-widest text-[#7d6a49]">发言意图队列</span>
                </div>
                {roomIntentions.length === 0 ? (
                  <p className="font-serif text-sm text-[#7d6a49]">等待用户发言后生成 Agent 意图分数。</p>
                ) : roomIntentions.map((intent, idx) => {
                  const statusColor = intent.status === 'speaking' ? '#8f1e18' : intent.status === 'yielded' ? '#59684b' : '#b9782b';
                  const statusLabel = intent.status === 'speaking' ? '发言中' : intent.status === 'yielded' ? '已让出' : '排队中';
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
                  <span className="font-mono text-[9px] uppercase tracking-widest text-[#7d6a49]">会议速记</span>
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
              <div className="bg-[#251b13] border border-[#3a2a1c] rounded-lg p-2 flex items-center gap-2 shrink-0">
                <div className={`p-2 rounded ${isAnySpeaking ? 'bg-[#8f1e18]/20' : 'bg-[#3a2a1c]'}`}>
                  <Mic2 size={16} className={`${isAnySpeaking ? 'text-[#8f1e18] animate-pulse' : 'text-[#7d6a49]'}`} />
                </div>
                <input
                  value={roomInput}
                  onChange={(e) => setRoomInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') submitRoomInput(meetingProject); }}
                  placeholder="输入会议发言..."
                  className="flex-1 bg-transparent outline-none text-[#efe2bd] font-serif text-base placeholder-[#7d6a49]/60"
                />
                <button onClick={() => submitRoomInput(meetingProject)}
                  className="bg-[#8f1e18] hover:bg-[#a62a22] text-white px-4 py-1.5 rounded flex items-center gap-2 font-mono text-[9px] uppercase tracking-widest transition-colors">
                  发言
                </button>
                <span className="font-mono text-[8px] text-[#7d6a49] px-1">⏎</span>
              </div>
            </aside>
          </div>
        </div>
      </div>
    );
  };

  const renderProjectChat = () => {
    const visibleMessages = chatMessages.filter(message => (
      (message.projectId || DEFAULT_CHAT_PROJECT_ID) === activeProject.id
      && message.channelId === activeChannelId
    ));
    const activeChannel = chatChannels.find(channel => channel.id === activeChannelId);

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

    const mentionCandidates = [{ id: '_all', name: 'all', label: '所有人', role: '' }, ...activeProject.team.map(a => ({ ...a, label: a.name }))];
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
                <button onClick={exitProjectScene} className="text-[#bcae86] hover:text-[#efe2bd] transition-colors"><ChevronLeft size={16} /></button>
                <span className="font-serif text-lg truncate">{activeProject.name}</span>
              </div>
              <button onClick={createMockChannel} className="text-[#7d6a49] hover:text-[#efe2bd] transition-colors"><Plus size={15} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-4">
              {Object.entries(channelsByCategory).map(([cat, channels]) => channels.length > 0 && (
                <div key={cat}>
                  <div className="flex items-center gap-2 px-2 mb-1">
                    <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#7d6a49]">
                      {cat === 'text' ? 'Text Channels' : cat === 'decisions' ? 'Decisions' : 'Voice'}
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
                <div className="font-serif text-sm truncate">Director</div>
                <div className="font-mono text-[8px] uppercase tracking-widest text-[#59684b]">Online</div>
              </div>
            </div>
          </aside>

          {/* CENTER: Message Stream */}
          <main className="flex flex-col overflow-hidden bg-[#171411]/90">
            <header className="border-b border-[#3a2a1c] px-5 py-3 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <Hash size={18} className="text-[#7d6a49]" />
                <span className="font-serif text-2xl">{activeChannel?.name}</span>
                <span className="font-mono text-[9px] uppercase tracking-widest text-[#7d6a49] hidden sm:block">{activeChannel?.description}</span>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2 text-[#7d6a49] hover:text-[#efe2bd] transition-colors"><Pin size={15} /></button>
                <button className="p-2 text-[#7d6a49] hover:text-[#efe2bd] transition-colors"><Search size={15} /></button>
                <button className="p-2 text-[#7d6a49] hover:text-[#efe2bd] transition-colors"><Users size={15} /></button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {visibleMessages.map((message, idx) => {
                const prev = idx > 0 ? visibleMessages[idx - 1] : null;
                const merged = shouldMerge(prev, message);

                if (message.type === 'system') {
                  return (
                    <div key={message.id} className="flex items-center gap-3 my-4 chat-msg-enter">
                      <div className="flex-1 h-px bg-[#3a2a1c]" />
                      <span className="font-mono text-[9px] uppercase tracking-widest text-[#7d6a49] px-3 shrink-0">{message.text}</span>
                      <div className="flex-1 h-px bg-[#3a2a1c]" />
                    </div>
                  );
                }

                if (message.type === 'decision') {
                  return (
                    <div key={message.id} className="node-card--dark my-3 p-4 border-l-4 border-l-[#59684b] chat-msg-enter">
                      <div className="flex items-center justify-between mb-2">
                        <span className="node-id-tag">{message.decisionId || 'DEC-000'}</span>
                        <span className="node-status-tag bg-[#59684b] text-white">Confirmed</span>
                      </div>
                      <p className="font-serif text-lg leading-relaxed text-[#efe2bd]">{message.text}</p>
                      <div className="flex items-center gap-2 mt-2 font-mono text-[9px] uppercase tracking-widest text-[#7d6a49]">
                        <span>{message.author}</span>
                        {message.role && <><span className="opacity-40">/</span><span>{message.role}</span></>}
                        <span className="ml-auto">{message.time}</span>
                      </div>
                    </div>
                  );
                }

                const isMention = message.type === 'mention';
                const isFile = message.type === 'file';

                return (
                  <div key={message.id}
                    className={`relative group chat-msg-enter ${isMention ? 'mention-pulse' : ''} ${merged ? 'mt-0.5' : 'mt-4'}`}>
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
                        <p className="font-serif text-[17px] leading-relaxed text-[#d8c99f]">{message.text}</p>
                        {isMention && message.weight && (
                          <span className="inline-flex mt-1.5 bg-[#8f1e18] text-white font-mono text-[8px] uppercase tracking-widest px-2 py-0.5">权重: {message.weight}</span>
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
                  placeholder={`Message #${activeChannel?.name || 'channel'}...`}
                  className="flex-1 bg-transparent outline-none font-serif text-base text-[#efe2bd] placeholder-[#7d6a49]/60" />
                <button onClick={submitChatInput}
                  className="bg-[#8f1e18] hover:bg-[#a62a22] text-white px-4 py-1.5 rounded flex items-center gap-2 font-mono text-[9px] uppercase tracking-widest transition-colors">
                  <Send size={13} /> 发送
                </button>
              </div>
            </div>
          </main>

          {/* RIGHT: Members Panel */}
          <aside className="bg-[#1a130e]/95 border-l border-[#3a2a1c] flex flex-col h-full overflow-hidden">
            <div className="p-4 border-b border-[#3a2a1c]">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#7d6a49]">Members — {activeProject.team.length + 1}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-4">
              <div>
                <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#59684b] mb-2 px-2">Online — {onlineMembers.length + 1}</div>
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
                  <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#b9782b] mb-2 px-2">Idle — {idleMembers.length}</div>
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

  const renderProjectTimeline = () => {
    const BRANCH_COLOR = { Main: '#8f1e18', Design: '#b9782b', Engineering: '#1b3341', Market: '#59684b' };
    const BRANCHES = ['Main', 'Design', 'Engineering', 'Market'];
    const LANE_H = 140;
    const WORLD_X_OFFSET = 96;
    const UNIT_PX = { hour: 120, day: 280, week: 400, month: 200 };
    const UNIT_HOURS = { hour: 1, day: 24, week: 168, month: 720 };
    const RUNTIME_EVENT_TYPES = ['Project Approved', 'Leader Confirmed', 'Leader Assignment', 'Assignment Ack', 'Peer Handoff', 'Peer Handoff Ack', 'Change Discussion', 'Change Confirmed', 'Change Sync', 'Work Pulse', 'Daily Report', 'Task Completed'];
    const EVENT_TYPES = ['创建', '分析', '内部沟通', '文档更新', '代码上传', '重要决策', '汇报记录'];
    const SCALE_PROFILES = {
      hour:  { priorities: ['core', 'normal', 'low'], types: EVENT_TYPES },
      day:   { priorities: ['core', 'normal'], types: ['创建', '分析', '文档更新', '代码上传', '重要决策', '汇报记录'] },
      week:  { priorities: ['core', 'normal'], types: ['创建', '文档更新', '代码上传', '重要决策', '汇报记录'] },
      month: { priorities: ['core'], types: ['创建', '重要决策', '汇报记录'] },
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
      const type = log.eventType === 'leader-assignment'
        ? '内部沟通'
        : log.eventType === 'change-confirmed'
          ? '重要决策'
          : log.eventType === 'change-discussion' || log.eventType === 'change-sync'
            ? '内部沟通'
            : log.eventType === 'work-pulse'
              ? '汇报记录'
              : '汇报记录';
      const branch = /design|体验|界面|Dieter/i.test(`${log.agent} ${log.log}`)
        ? 'Design'
        : /code|api|backend|Linus|工程|技术/i.test(`${log.agent} ${log.log}`)
          ? 'Engineering'
          : /market|strategy|Don|市场|策略/i.test(`${log.agent} ${log.log}`)
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
        attachments: [],
      };
    });
    const timelineEvents = projectTimelineEvents.length ? projectTimelineEvents : PROJECT_TIMELINE_EVENTS;

    const maxT = Math.max(...timelineEvents.map(e => e.t));
    const getBaseNodeX = (t) => WORLD_X_OFFSET + (t / UNIT_HOURS[timelineScale]) * UNIT_PX[timelineScale];
    const getNodeY = (branch) => 70 + BRANCHES.indexOf(branch) * LANE_H;
    const canvasH = 70 + BRANCHES.length * LANE_H + 60;

    const scaleProfile = SCALE_PROFILES[timelineScale] || SCALE_PROFILES.day;
    const visibleEvents = timelineEvents.filter(e => (
      scaleProfile.priorities.includes(e.priority)
      && (scaleProfile.types.includes(e.type) || RUNTIME_EVENT_TYPES.includes(e.type))
    ));
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

    const ATTACH_ICONS = { code: '{ }', doc: '📄', design: '🎨', link: '🔗' };
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
            <button onClick={exitProjectScene} className="hover:text-[#efe2bd] transition-colors">{activeProject.name}</button>
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
            onWheel={handleCanvasWheel}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
            onDoubleClick={handleCanvasDoubleClick}
          >
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
                const branchColor = BRANCH_COLOR[event.branch] || '#7d6a49';
                const isHovNeighbor = neighborIds.has(event.id);
                const isDimmed = tlHoveredNode && tlHoveredNode !== event.id && !isHovNeighbor;
                const isLow = event.priority === 'low';
                const isCore = event.priority === 'core';
                const isCoreMain = isCore && event.branch === 'Main';
                const isDecision = event.type === '重要决策';
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
                          {event.contributor} · {formatTime(event.t)}
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
                            {artifactCount > 0 && <span>{artifactCount} files</span>}
                            {commentCount > 0 && <span>{commentCount} notes</span>}
                            {event.dependsOn?.length > 0 && <span>{event.dependsOn.length} deps</span>}
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
                    <div className="tl-detail-section">
                      <div className="tl-detail-section-title">元数据</div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                        {[
                          ['贡献者', selected.contributor],
                          ['时间', formatTime(selected.t)],
                          ['分支', selected.branch],
                          ['优先级', selected.priority],
                          ['类型', selected.type],
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
                        <div className="tl-detail-section-title">关联产物 ({selected.attachments.length})</div>
                        {selected.attachments.map((att, i) => (
                          <div key={i} className="tl-attach-item">
                            <span className="text-sm flex-shrink-0 w-5 text-center">{ATTACH_ICONS[att.type] || '📎'}</span>
                            <div className="flex-1 min-w-0">
                              <div className="font-mono text-[10px] text-[#d8c99f] truncate">{att.name}</div>
                              <div className="font-mono text-[8px] text-[#7d6a49] truncate">{att.diff || att.summary}</div>
                            </div>
                            {att.hash && <span className="font-mono text-[8px] text-[#5a4a32] flex-shrink-0">{att.hash}</span>}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 5. Discussion thread */}
                    {selected.comments && selected.comments.length > 0 && (
                      <div className="tl-detail-section">
                        <div className="tl-detail-section-title">讨论 ({selected.comments.length})</div>
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
                            添加评论...
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 6. Mini dependency graph */}
                    {miniGraphNodes.length > 1 && (
                      <div className="tl-detail-section">
                        <div className="tl-detail-section-title">依赖关系</div>
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
                                      <text x={p.cx} y={p.cy + (isCurrent ? 28 : 24)} textAnchor="middle" fill="#7d6a49" fontSize="7" fontFamily="monospace">{n.title.length > 8 ? n.title.slice(0, 8) + '…' : n.title}</text>
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
                        <div className="tl-detail-section-title">变更历史</div>
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
                        <div className="tl-detail-section-title">相邻节点</div>
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

                  {/* 8. Action bar — fixed at bottom */}
                  <div className="flex-shrink-0 px-5 py-3 border-t border-[#2a2118] flex items-center gap-2">
                    <button className="flex-1 font-mono text-[9px] uppercase tracking-widest border border-[#3a2a1c] text-[#7d6a49] hover:text-[#efe2bd] hover:border-[#7b6542] px-3 py-2 transition-colors rounded-sm">
                      跳转聊天
                    </button>
                    <button className="flex-1 font-mono text-[9px] uppercase tracking-widest border border-[#3a2a1c] text-[#7d6a49] hover:text-[#efe2bd] hover:border-[#7b6542] px-3 py-2 transition-colors rounded-sm">
                      标记完成
                    </button>
                    <button className="flex-1 font-mono text-[9px] uppercase tracking-widest border border-[#3a2a1c] text-[#7d6a49] hover:text-[#efe2bd] hover:border-[#7b6542] px-3 py-2 transition-colors rounded-sm">
                      编辑
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
              
              // 连线特效：如果自己说话或者用户说话且该员工被定向/全体，则激活数据流
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
              
              // 切换定向对象开关
              const toggleTarget = () => {
                if (targetNodeIds.includes(ai.id)) {
                  setTargetNodeIds(targetNodeIds.filter(id => id !== ai.id));
                } else {
                  setTargetNodeIds([...targetNodeIds, ai.id]);
                }
              };

              return (
                <g key={`node-${ai.id}`} transform={`translate(${pos.x}, ${pos.y})`} onClick={toggleTarget} className="cursor-pointer group">
                  {/* 定向虚线框更加克制沉稳 */}
                  {isTargeted && <circle r="26" fill="none" stroke="#888" strokeWidth="1" strokeDasharray="3 3" />}
                  
                  {/* 移除了极其刺眼的纯白实心背景，改用黑色背景+加粗白色边框来优雅地指示发言状态 */}
                  <circle r="20" fill={isTargeted ? '#222' : '#111'} stroke={isSpeaking ? '#fff' : (isTargeted ? '#aaa' : '#444')} strokeWidth={isSpeaking ? "3" : "2"} className="transition-all duration-300 group-hover:stroke-[#888]" />
                  <text y="-35" fill={isSpeaking || isTargeted ? '#fff' : '#888'} fontSize="12" fontFamily="Space Mono" textAnchor="middle" className="tracking-widest transition-colors">{ai.name.toUpperCase()}</text>
                  <text y="-50" fill={isTargeted ? '#888' : '#555'} fontSize="8" fontFamily="Space Mono" textAnchor="middle" className="tracking-widest transition-colors">{ai.role.toUpperCase()}</text>
                </g>
              );
            })}

            {/* User/Director Node at Bottom Center */}
            <g transform={`translate(${cx}, ${cy})`}>
               {/* 同样移除了用户的实心高光，仅用线条变化 */}
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
                         
                         {/* 增加剧本速记里的发文目标显示 */}
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
               
               {/* 独立开辟的 Directive Target 指示栏 */}
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

               {/* 主输入区域 */}
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
        {settingsOpen && renderSettingsModal()}
      </div>
    </div>
  );
}
