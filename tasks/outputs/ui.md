# RebalanceTab UI Styles — Applied

## Page Layout
- Root container: full-height flex column, `background: #080C14`, `overflow: hidden`
- Content area split: left 60% (positions table), right 40% (cash + alerts), each with independent `overflowY: auto`

## Header Bar
- `background: #0D1117`, `borderBottom: 1px solid #1A2332`, `padding: 8px 14px`
- Title "Rebalancing Planner": 9px monospace, `#C9D1D9`, uppercase, `letterSpacing: 2`, `fontWeight: 700`
- "MAPO v4.0" badge: `background: rgba(0,217,255,0.08)`, `border: 1px solid rgba(0,217,255,0.25)`, `color: #00D9FF`, 7px uppercase monospace, `borderRadius: 2`, `padding: 2px 7px`
- Portfolio value: 11px monospace, `#8B949E`
- Equal Weight + Recalculate buttons: `background: transparent`, `border: 1px solid #1A2332`, `color: #8B949E`, 8px uppercase monospace, `padding: 5px 14px`, `borderRadius: 2`, icon inline

## Section Headers (Positions, Alerts, Cash)
- `background: #0D1117`, `borderBottom: 1px solid #1A2332`, `padding: 8px 14px`
- 9px bold uppercase monospace, `#C9D1D9`, `letterSpacing: 2`

## Positions Table
- Header row: `background: #0D1117`, `position: sticky top`, 8px uppercase, `#484F58`, `letterSpacing: 1.5`, `fontFamily: monospace`
- Body rows: `borderBottom: 1px solid #0D1117`, hover `background: rgba(0,217,255,0.03)`
- TICKER column: 11px, `fontWeight: 700`, `#C9D1D9`, monospace
- Name column: 10px, `#8B949E`, monospace
- % columns (Current, Target): 10px monospace, `#C9D1D9`
- Target input: `background: transparent`, `border: 1px solid #1A2332`, `color: #C9D1D9`, `borderRadius: 2`
- DIFF column: green `#00C853` if positive (overweight/SELL), red `#FF4D4D` if negative (underweight/BUY), neutral `#8B949E` if zero. Decorative bar behind the value using absolute-positioned span with matching color at 20% opacity, width scaled to diff magnitude (capped at 40px)
- ACTION badges (BUY/SELL/HOLD): 7px uppercase monospace, `borderRadius: 2`, `padding: 2px 7px`, `letterSpacing: 1`, with icon inline
  - BUY: `background: rgba(0,200,83,0.1)`, `border: 1px solid rgba(0,200,83,0.3)`, `color: #00C853`
  - SELL: `background: rgba(255,77,77,0.1)`, `border: 1px solid rgba(255,77,77,0.3)`, `color: #FF4D4D`
  - HOLD: `background: rgba(139,148,158,0.1)`, `border: 1px solid rgba(139,148,158,0.2)`, `color: #8B949E`
- AMOUNT column: 10px monospace, `#C9D1D9`; shares count: 9px `#484F58`

## Cash Section
- Outer card: `background: #0D1117`, `border: 1px solid #1A2332`, `borderRadius: 4`, `padding: 14`
- Label "Cash Allocation": `#00D9FF`, 8px uppercase, `letterSpacing: 1.5`
- Current cash %: large 18px `fontWeight: 700` `#C9D1D9` monospace
- Target % value: 14px `#8B949E` monospace; range label `#484F58`
- Cash action badges (DEPLOY/RAISE/OK): same badge pattern as ACTION column
  - DEPLOY: yellow `#FFB300`
  - RAISE: red `#FF4D4D`
  - OK: green `#00C853`
- Cash action amount: 10px `#8B949E` `fontWeight: 700` monospace

## Alerts Section
- Each concentration alert row: `borderLeft: 3px solid #FFB300`, `background: rgba(255,179,0,0.05)`, `padding: 8px 12px`, `borderRadius: 3`, `marginBottom: 6`
- Drawdown alert row: `borderLeft: 3px solid #FF4D4D`, `background: rgba(255,77,77,0.05)` (red instead of yellow)
- Alert text: 9px `#FFB300` or `#FF4D4D` monospace, `letterSpacing: 0.5`
- Alert icon: matching color, `size={12}`

## Loading / Error States
- Loading: `background: #080C14`, `#8B949E` text, monospace, spinner `#00D9FF`
- Error: `#FF4D4D` text, Retry button styled same as header buttons
