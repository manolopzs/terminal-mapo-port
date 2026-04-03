import { useSyncExternalStore } from 'react';
import { getState, subscribe, type BusState } from '@/lib/agent-bus';

export function useAgentBus(): BusState {
  return useSyncExternalStore(subscribe, getState, getState);
}
