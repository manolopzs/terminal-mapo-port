export type AgentStatus = 'idle' | 'running' | 'complete' | 'error';
export type AgentLayer = 'intelligence' | 'agi' | 'broad' | 'risk';
export type LogType = 'info' | 'success' | 'warning' | 'error' | 'data';

export interface AgentDef {
  id: string;
  name: string;
  layer: AgentLayer;
  hint: string;
}

export interface AgentState extends AgentDef {
  status: AgentStatus;
  lastRun: string | null;
  lastResult: string | null;
}

export interface PipelineStage {
  id: string;
  label: string;
  sublabel: string;
  status: 'queued' | 'running' | 'complete' | 'error';
  elapsed: number | null;
  data: string | null;
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  agentName: string;
  message: string;
  type: LogType;
}

export interface BusState {
  agents: AgentState[];
  pipeline: PipelineStage[];
  log: LogEntry[];
  lastOperation: string | null;
  isAnyRunning: boolean;
}

// ─── Initial agent definitions ───────────────────────────────────────────────

const INITIAL_AGENTS: AgentState[] = [
  // screening pipeline
  { id: 'discovery',           name: 'DISCOVERY',           layer: 'intelligence', hint: '1,700+ stock screener',    status: 'idle', lastRun: null, lastResult: null },
  { id: 'exclusion-guard',    name: 'EXCLUSION GUARD',    layer: 'risk',         hint: 'Blacklist + cooldown',      status: 'idle', lastRun: null, lastResult: null },
  { id: 'composite-scorer',   name: 'COMPOSITE SCORER',   layer: 'intelligence', hint: 'Claude AI 6-factor score', status: 'idle', lastRun: null, lastResult: null },
  // intelligence
  { id: 'macro-sentinel',     name: 'MACRO SENTINEL',     layer: 'intelligence', hint: 'Macro regime + rates',     status: 'idle', lastRun: null, lastResult: null },
  { id: 'situational-awareness', name: 'SITUATIONAL AWARENESS', layer: 'agi', hint: 'AGI thesis pulse',        status: 'idle', lastRun: null, lastResult: null },
  { id: 'earnings-monitor',   name: 'EARNINGS MONITOR',   layer: 'intelligence', hint: 'Earnings surprises',       status: 'idle', lastRun: null, lastResult: null },
  // risk
  { id: 'drawdown-monitor',   name: 'DRAWDOWN MONITOR',   layer: 'risk', hint: 'Max drawdown tracking',           status: 'idle', lastRun: null, lastResult: null },
  { id: 'portfolio-validator', name: 'PORTFOLIO VALIDATOR', layer: 'risk', hint: 'Constraint checking',            status: 'idle', lastRun: null, lastResult: null },
];

// ─── Internal store ───────────────────────────────────────────────────────────

let state: BusState = {
  agents: INITIAL_AGENTS,
  pipeline: [],
  log: [],
  lastOperation: null,
  isAnyRunning: false,
};

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function getState(): BusState {
  return state;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function startAgent(id: string): void {
  const now = new Date().toISOString();
  state = {
    ...state,
    agents: state.agents.map((a) =>
      a.id === id ? { ...a, status: 'running', lastRun: now } : a
    ),
    isAnyRunning: true,
  };
  notify();
}

export function completeAgent(id: string, result?: string): void {
  const now = new Date().toISOString();
  const agents = state.agents.map((a) =>
    a.id === id ? { ...a, status: 'complete' as AgentStatus, lastRun: now, lastResult: result ?? null } : a
  );
  state = {
    ...state,
    agents,
    isAnyRunning: agents.some((a) => a.status === 'running'),
  };
  notify();
}

export function errorAgent(id: string, error: string): void {
  const agents = state.agents.map((a) =>
    a.id === id ? { ...a, status: 'error' as AgentStatus, lastResult: error } : a
  );
  state = {
    ...state,
    agents,
    isAnyRunning: agents.some((a) => a.status === 'running'),
  };
  notify();
}

export function resetPipeline(
  stages: Pick<PipelineStage, 'id' | 'label' | 'sublabel'>[]
): void {
  state = {
    ...state,
    pipeline: stages.map((s) => ({
      ...s,
      status: 'queued',
      elapsed: null,
      data: null,
    })),
  };
  notify();
}

export function advancePipeline(
  stageId: string,
  status: 'running' | 'complete' | 'error',
  data?: string,
  elapsed?: number
): void {
  state = {
    ...state,
    pipeline: state.pipeline.map((s) =>
      s.id === stageId
        ? {
            ...s,
            status,
            data: data ?? s.data,
            elapsed: elapsed !== undefined ? elapsed : s.elapsed,
          }
        : s
    ),
  };
  notify();
}

export function addLog(entry: Omit<LogEntry, 'id' | 'timestamp'>): void {
  const newEntry: LogEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date(),
  };
  const log = [newEntry, ...state.log].slice(0, 200);
  state = { ...state, log };
  notify();
}

export function setLastOperation(op: string): void {
  state = { ...state, lastOperation: op };
  notify();
}
