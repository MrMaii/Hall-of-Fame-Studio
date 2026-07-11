export function createProviderRuntimeCoordinator({ run = async (operation) => operation() } = {}) {
  const scopes = new Map();

  const stateFor = (scope) => {
    const key = String(scope || 'default');
    if (!scopes.has(key)) {
      scopes.set(key, { generation: 0, tail: Promise.resolve() });
    }
    return scopes.get(key);
  };

  return {
    invalidate(scope) {
      const state = stateFor(scope);
      state.generation += 1;
      return state.generation;
    },

    request({ scope, operation } = {}) {
      if (typeof operation !== 'function') throw new TypeError('provider runtime operation is required');
      const state = stateFor(scope);
      const generation = state.generation;
      const result = state.tail.then(async () => {
        const value = await run(operation);
        return { stale: state.generation !== generation, value };
      });
      state.tail = result.then(() => undefined, () => undefined);
      return result;
    },
  };
}
