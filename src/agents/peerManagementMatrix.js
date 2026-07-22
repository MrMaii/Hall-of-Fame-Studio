const uniqueStrings = (values = []) => Array.from(new Set(values.filter(Boolean).map(value => String(value))));

export function buildPeerManagementMatrix(team = [], { leaderId, reviewerId } = {}) {
  const agents = team.filter(agent => agent?.id);
  if (agents.length <= 1) {
    return agents.map(agent => ({
      agentId: agent.id,
      peerManagedIds: [],
      peerManagerIds: [],
      peerIds: [],
    }));
  }

  const orderedAgents = [
    ...agents.filter(agent => agent.id === leaderId),
    ...agents.filter(agent => agent.id === reviewerId && agent.id !== leaderId),
    ...agents.filter(agent => agent.id !== leaderId && agent.id !== reviewerId),
  ];
  const peerManagedByAgent = new Map(orderedAgents.map(agent => [agent.id, []]));
  const peerManagersByAgent = new Map(orderedAgents.map(agent => [agent.id, []]));

  orderedAgents.forEach((agent, index) => {
    const target = orderedAgents[(index + 1) % orderedAgents.length];
    if (!target || target.id === agent.id) return;
    peerManagedByAgent.set(agent.id, uniqueStrings([...(peerManagedByAgent.get(agent.id) || []), target.id]));
    peerManagersByAgent.set(target.id, uniqueStrings([...(peerManagersByAgent.get(target.id) || []), agent.id]));
  });

  return agents.map(agent => ({
    agentId: agent.id,
    peerManagedIds: peerManagedByAgent.get(agent.id) || [],
    peerManagerIds: peerManagersByAgent.get(agent.id) || [],
    peerIds: agents.filter(peer => peer.id !== agent.id).map(peer => peer.id),
  }));
}
