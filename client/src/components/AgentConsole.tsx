import { useState, useRef, useEffect } from 'react';
import { useAgentBus } from '@/hooks/useAgentBus';
import type { AgentState, PipelineStage, LogEntry } from '@/lib/agent-bus';

type LayerKey = 'intelligence' | 'agi' | 'risk';

const CYCLING_TEXTS: string[] = [
  'Scanning market...',
  'Filtering candidates...',
  'Scoring stocks...',
  'Evaluating signals...',
  'Analyzing fundamentals...',
  'Cross-referencing data...',
  'Ranking results...',
];

const LAYER_ORDER: LayerKey[] = ['intelligence', 'agi', 'risk'];

const LAYER_LABELS: Record<LayerKey, string> = {
  intelligence: 'SCREENING & INTELLIGENCE',
  agi: 'AGI THESIS',
  risk: 'RISK & VALIDATION',
};

const LAYER_ACCENT: Record<LayerKey, string> = {
  intelligence: 'var(--color-primary)',
  agi: '#A371F7',
  risk: 'var(--color-red)',
};

function formatTime(date: Date | string | number | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (isToday) {
    let hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${hours}:${minutes} ${ampm}`;
  } else {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[d.getMonth()]} ${d.getDate()}`;
  }
}

function formatLogTime(date: Date | string | number | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  const ss = d.getSeconds().toString().padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function getLogEntryColor(type: string | undefined): string {
  switch (type) {
    case 'success': return 'var(--color-green)';
    case 'error': return 'var(--color-red)';
    case 'warning': return 'var(--color-orange)';
    case 'data': return 'var(--color-primary)';
    case 'info':
    default: return '#7A8A9E';
  }
}

function getStatusDotStyle(status: string | undefined): React.CSSProperties {
  const base: React.CSSProperties = {
    width: 5,
    height: 5,
    borderRadius: '50%',
    flexShrink: 0,
  };
  switch (status) {
    case 'running':
      return { ...base, background: 'var(--color-green)', animation: 'pulse-dot 2s infinite' };
    case 'complete':
      return { ...base, background: 'var(--color-green)', opacity: 0.4 };
    case 'error':
      return { ...base, background: 'var(--color-red)' };
    case 'idle':
    default:
      return { ...base, background: '#2E3E52' };
  }
}

function getPipelineStageStyles(status: string | undefined): {
  container: React.CSSProperties;
  label: React.CSSProperties;
  statusText: React.CSSProperties;
} {
  switch (status) {
    case 'running':
      return {
        container: {
          background: 'var(--color-primary-a05)',
          border: '1px solid var(--color-primary-a25)',
          borderTop: '2px solid #D4A853',
        },
        label: { color: 'var(--color-primary)' },
        statusText: { color: 'var(--color-orange)', animation: 'pulse-text 1.5s infinite' },
      };
    case 'complete':
      return {
        container: {
          background: 'rgba(0,230,168,0.04)',
          border: '1px solid rgba(0,230,168,0.2)',
          borderTop: '2px solid #00E6A8',
        },
        label: { color: '#7A8A9E' },
        statusText: { color: 'var(--color-green)' },
      };
    case 'error':
      return {
        container: {
          background: 'rgba(255,68,88,0.04)',
          border: '1px solid var(--color-red-a20)',
          borderTop: '2px solid #FF4458',
        },
        label: { color: '#3A4A5C' },
        statusText: { color: 'var(--color-red)' },
      };
    case 'queued':
    default:
      return {
        container: {
          background: '#0B0F1A',
          border: '1px solid #1C2840',
          borderTop: '2px solid #1C2840',
        },
        label: { color: '#3A4A5C' },
        statusText: { color: '#2E3E52' },
      };
  }
}

function getStatusText(stage: PipelineStage): string {
  switch (stage.status) {
    case 'queued': return 'queued';
    case 'running': return 'running...';
    case 'complete':
      return `✓ ${stage.elapsed != null ? stage.elapsed : ''}ms`;
    case 'error': return 'error';
    default: return stage.status ?? '';
  }
}

export function AgentConsole() {
  const [expanded, setExpanded] = useState(false);
  const busState = useAgentBus?.();
  const logRef = useRef<HTMLDivElement>(null);
  const [cycleIdx, setCycleIdx] = useState(0);
  const [prevLogLen, setPrevLogLen] = useState(0);

  const agents: AgentState[] = busState?.agents ?? [];
  const pipeline: PipelineStage[] = busState?.pipeline ?? [];
  const log: LogEntry[] = busState?.log ?? [];
  const lastOperation: string | null = busState?.lastOperation ?? null;
  const isAnyRunning: boolean = busState?.isAnyRunning ?? false;

  const runningCount = agents.filter(a => a.status === 'running').length;

  // Cycle through status texts when agents are running
  useEffect(() => {
    if (!isAnyRunning) return;
    const interval = setInterval(() => {
      setCycleIdx(prev => (prev + 1) % CYCLING_TEXTS.length);
    }, 2200);
    return () => clearInterval(interval);
  }, [isAnyRunning]);

  // Auto-scroll log to bottom when new entries arrive
  useEffect(() => {
    if (logRef.current && log.length > 0) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
    setPrevLogLen(log.length);
  }, [log.length]);

  const groupedAgents: Partial<Record<LayerKey, AgentState[]>> = {};
  for (const agent of agents) {
    const layer = agent.layer as LayerKey;
    if (!groupedAgents[layer]) groupedAgents[layer] = [];
    groupedAgents[layer]!.push(agent);
  }

  const hasPipeline = pipeline.length > 0;

  return (
    <>
      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.3; transform: scale(1.3); }
        }
        @keyframes pulse-text {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes agent-fade-in {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes glow-border {
          0%, 100% { box-shadow: 0 0 4px rgba(212,168,83,0.3); }
          50% { box-shadow: 0 0 12px rgba(212,168,83,0.6); }
        }
        @keyframes cycle-text-in {
          0% { opacity: 0; transform: translateY(6px); }
          15% { opacity: 1; transform: translateY(0); }
          85% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-6px); }
        }
        @keyframes running-stripe {
          0% { background-position: 0% 0%; }
          100% { background-position: 200% 0%; }
        }
      `}</style>

      {/* COLLAPSED STRIP — always visible */}
      <div
        onClick={() => setExpanded(prev => !prev)}
        style={{
          width: '100%',
          borderTop: '1px solid #1C2840',
          background: '#070B14',
          height: 32,
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          gap: 12,
          cursor: 'pointer',
          boxSizing: 'border-box',
          flexShrink: 0,
          userSelect: 'none',
        }}
      >
        {/* LEFT: system indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <div
            style={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              background: isAnyRunning ? 'var(--color-primary)' : 'var(--color-green)',
              animation: 'pulse-dot 2s infinite',
              boxShadow: isAnyRunning ? '0 0 6px rgba(212,168,83,0.6)' : '0 0 4px rgba(0,230,168,0.4)',
              transition: 'background 0.3s ease, box-shadow 0.3s ease',
            }}
          />
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 9,
              color: 'var(--color-primary)',
              textTransform: 'uppercase',
              letterSpacing: 2,
            }}
          >
            MAPO SYSTEM
          </span>
        </div>

        {/* CENTER: last operation */}
        <div
          style={{
            flex: 1,
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
          }}
        >
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 9,
              color: isAnyRunning ? 'var(--color-primary)' : '#7A8A9E',
              transition: 'color 0.3s ease',
            }}
          >
            {isAnyRunning
              ? CYCLING_TEXTS[cycleIdx]
              : (lastOperation ?? 'SYSTEM MONITORING \u00b7 ALL AGENTS IDLE')}
          </span>
        </div>

        {/* RIGHT: agent count + arrow */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 9,
              color: runningCount > 0 ? 'var(--color-green)' : '#4A5A6E',
              transition: 'color 0.3s ease',
            }}
          >
            {runningCount > 0 ? `${runningCount} RUNNING` : `${agents.length} AGENTS`}
          </span>
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 9,
              color: '#4A5A6E',
            }}
          >
            {expanded ? '▼' : '▲'}
          </span>
        </div>
      </div>

      {/* EXPANDED PANEL */}
      <div
        style={{
          width: '100%',
          maxHeight: expanded ? '248px' : '0px',
          overflow: 'hidden',
          transition: 'max-height 0.2s ease',
          background: '#070B14',
          borderTop: expanded ? '1px solid #1C2840' : 'none',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            height: 248,
            width: '100%',
            boxSizing: 'border-box',
          }}
        >
          {/* COLUMN 1: AGENT STATUS */}
          <div
            style={{
              flex: '0 0 30%',
              borderRight: '1px solid #1C2840',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div
              style={{
                height: 28,
                display: 'flex',
                alignItems: 'center',
                padding: '0 8px',
                borderBottom: '1px solid #1C2840',
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 8,
                  color: '#3A4A5C',
                  textTransform: 'uppercase',
                  letterSpacing: 1.5,
                }}
              >
                AGENT STATUS
              </span>
            </div>

            {/* Scrollable agent list */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {LAYER_ORDER.map(layer => {
                const layerAgents = groupedAgents[layer];
                if (!layerAgents || layerAgents.length === 0) return null;
                return (
                  <div key={layer}>
                    {/* Group label */}
                    <div
                      style={{
                        padding: '6px 8px',
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 8,
                        color: '#3A4A5C',
                        textTransform: 'uppercase',
                        letterSpacing: 1,
                        background: '#080C14',
                        borderBottom: '1px solid rgba(28,40,64,0.4)',
                      }}
                    >
                      {LAYER_LABELS[layer]}
                    </div>
                    {layerAgents.map((agent, idx) => (
                      <div
                        key={agent.id ?? idx}
                        style={{
                          height: 22,
                          display: 'flex',
                          alignItems: 'center',
                          padding: '0 8px 0 12px',
                          gap: 6,
                          borderBottom: '1px solid rgba(28,40,64,0.2)',
                          background:
                            agent.status === 'running'
                              ? 'rgba(0,230,168,0.03)'
                              : 'transparent',
                          borderLeft: `2px solid ${LAYER_ACCENT[layer]}`,
                          boxSizing: 'border-box',
                          transition: 'background 0.3s ease',
                        }}
                      >
                        <div style={getStatusDotStyle(agent.status)} />
                        <span
                          style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 9,
                            color:
                              agent.status === 'running' ? '#C9D1D9' : '#5A6B80',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            transition: 'color 0.3s ease',
                          }}
                        >
                          {agent.name ?? agent.id}
                        </span>
                        <div style={{ flex: 1 }} />
                        {agent.status === 'running' ? (
                          <span
                            style={{
                              fontFamily: "'JetBrains Mono', monospace",
                              fontSize: 8,
                              color: 'var(--color-green)',
                              flexShrink: 0,
                              animation: 'pulse-text 1.5s infinite',
                            }}
                          >
                            {CYCLING_TEXTS[(cycleIdx + idx) % CYCLING_TEXTS.length]}
                          </span>
                        ) : (
                          <span
                            style={{
                              fontFamily: "'JetBrains Mono', monospace",
                              fontSize: 8,
                              color: '#2E3E52',
                              flexShrink: 0,
                            }}
                          >
                            {formatTime(agent.lastRun)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
              {agents.length === 0 && (
                <div
                  style={{
                    padding: '16px 8px',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 9,
                    color: '#2E3E52',
                    textAlign: 'center',
                  }}
                >
                  NO AGENTS REGISTERED
                </div>
              )}
            </div>
          </div>

          {/* COLUMN 2: PIPELINE */}
          <div
            style={{
              flex: '0 0 40%',
              borderRight: '1px solid #1C2840',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div
              style={{
                height: 28,
                display: 'flex',
                alignItems: 'center',
                padding: '0 8px',
                borderBottom: '1px solid #1C2840',
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 8,
                  color: '#3A4A5C',
                  textTransform: 'uppercase',
                  letterSpacing: 1.5,
                }}
              >
                PIPELINE
              </span>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowX: 'auto', overflowY: 'auto' }}>
              {!hasPipeline ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    gap: 4,
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 9,
                      color: '#2E3E52',
                      textTransform: 'uppercase',
                      letterSpacing: 1,
                    }}
                  >
                    last operation
                  </span>
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 9,
                      color: '#2E3E52',
                    }}
                  >
                    {lastOperation ?? 'No recent operations'}
                  </span>
                </div>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    padding: '8px 6px',
                    gap: 0,
                  }}
                >
                  {pipeline.map((stage, idx) => {
                    const styles = getPipelineStageStyles(stage.status);
                    return (
                      <div
                        key={stage.id ?? idx}
                        style={{ display: 'flex', alignItems: 'center' }}
                      >
                        <div
                          style={{
                            width: 120,
                            height: 68,
                            padding: 8,
                            margin: 6,
                            borderRadius: 3,
                            boxSizing: 'border-box',
                            display: 'flex',
                            flexDirection: 'column',
                            transition: 'box-shadow 0.3s ease, border-color 0.3s ease, background 0.3s ease',
                            animation: stage.status === 'running' ? 'glow-border 2s ease-in-out infinite' : 'none',
                            ...styles.container,
                          }}
                        >
                          <span
                            style={{
                              fontFamily: "'JetBrains Mono', monospace",
                              fontSize: 8,
                              letterSpacing: 1,
                              textTransform: 'uppercase',
                              ...styles.label,
                            }}
                          >
                            {stage.label ?? stage.id}
                          </span>
                          {stage.sublabel && (
                            <span
                              style={{
                                fontFamily: "'JetBrains Mono', monospace",
                                fontSize: 7,
                                color: '#2E3E52',
                                marginTop: 2,
                              }}
                            >
                              {stage.sublabel}
                            </span>
                          )}
                          <span
                            style={{
                              fontFamily: "'JetBrains Mono', monospace",
                              fontSize: 8,
                              marginTop: 4,
                              ...styles.statusText,
                            }}
                          >
                            {getStatusText(stage)}
                          </span>
                        </div>
                        {idx < pipeline.length - 1 && (
                          <span
                            style={{
                              fontFamily: "'JetBrains Mono', monospace",
                              fontSize: 8,
                              color: stage.status === 'complete' ? 'var(--color-green)' : stage.status === 'running' ? 'var(--color-primary)' : '#2E3E52',
                              alignSelf: 'center',
                              transition: 'color 0.3s ease',
                              animation: stage.status === 'running' ? 'pulse-text 1.5s infinite' : 'none',
                            }}
                          >
                            {'\u2192'}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* COLUMN 3: ACTIVITY LOG */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div
              style={{
                height: 28,
                display: 'flex',
                alignItems: 'center',
                padding: '0 8px',
                borderBottom: '1px solid #1C2840',
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 8,
                  color: '#3A4A5C',
                  textTransform: 'uppercase',
                  letterSpacing: 1.5,
                }}
              >
                ACTIVITY LOG
              </span>
            </div>

            {/* Scrollable log */}
            <div
              ref={logRef}
              style={{
                flex: 1,
                overflowY: 'auto',
              }}
            >
              {log.length === 0 ? (
                <div
                  style={{
                    padding: '16px 8px',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 9,
                    color: '#2E3E52',
                    textAlign: 'center',
                  }}
                >
                  NO LOG ENTRIES
                </div>
              ) : (
                log.map((entry, idx) => (
                  <div
                    key={entry.id ?? idx}
                    style={{
                      padding: '4px 8px',
                      borderBottom: '1px solid rgba(28,40,64,0.2)',
                      display: 'flex',
                      gap: 8,
                      alignItems: 'flex-start',
                      animation: idx >= prevLogLen - 1 ? 'agent-fade-in 0.4s ease-out' : 'none',
                    }}
                  >
                    {/* Time */}
                    <span
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 8,
                        color: '#2E3E52',
                        flexShrink: 0,
                        width: 54,
                      }}
                    >
                      {formatLogTime(entry.timestamp)}
                    </span>
                    {/* Agent name */}
                    <span
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 8,
                        color: getLogEntryColor(entry.type),
                        flexShrink: 0,
                        width: 120,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {entry.agentName ?? '—'}
                    </span>
                    {/* Message */}
                    <span
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 8,
                        color: '#5A6B80',
                        flex: 1,
                        lineHeight: 1.4,
                        wordBreak: 'break-word',
                      }}
                    >
                      {entry.message}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
