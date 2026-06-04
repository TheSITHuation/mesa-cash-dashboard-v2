# Multi-Day Tournament Snapshots & Accumulated Dashboard

## Problem

Some tournaments span multiple days (clasificatorios/qualifiers). Each day runs as a
separate TD3 instance sending to the same Firestore document ID, overwriting the
previous day's data. There is no way to accumulate economic data across days or
see a consolidated view of the entire tournament series.

## Solution Overview

Add a manual "Finalizar Día" button that saves a snapshot of the current tournament
economic data to a Firestore subcollection. The dashboard gains an accumulated mode
that sums all snapshots + live data. Google Sheets export gets per-tournament tabs
and a monthly consolidated tab.

## Data Model

### Tournament Config (td3/tournamentConfig_{id})

New fields:

```js
{
  multiDay: true,           // flag to enable multi-day mode
  dayLabels: ["Día 1A"],    // ordered list of completed day snapshots
  guarantee: 10000,
  rakePct: 10,
  tournamentId: "torneo-x",
  updatedAt: Timestamp
}
```

### Day Snapshot (td3/{id}/snapshots/{dayLabel})

Created on-demand when user clicks "Finalizar Día":

```js
{
  dayLabel: "Día 1A",
  savedAt: Timestamp,
  tournamentName: "Torneo Skampa Premium",
  econ: {
    buyinsCount: 100,
    totalBuyinsAmount: 25000,
    totalBuyinsRake: 2500,
    totalRebuysAmount: 20000,
    totalRebuysRake: 2000,
    totalAddonsAmount: 5000,
    totalAddonsRake: 500,
    // ... all other econ fields from tmNormalize
  },
  raw: { /* snapshot of raw TD3 data */ }
}
```

No changes to the existing `td3/{id}` document or the publisher/cloud function.

## Dashboard UI

### Config Section (collapsible)

New toggle in the config panel:

```
☐ Torneo multi-día / Clasificatorio
```

When enabled, additional fields appear below the guarantee/rake inputs.

### "Finalizar Día" Button

Appears in the action bar (next to "Reset Torneo") when `multiDay` is enabled:

```
[📋 Subir CSV] [📊 Ver Estructura] [🏁 Finalizar Día] [🗑️ Reset Torneo]
```

Clicking opens a modal asking for the day label (pre-filled with the next sequential
number like "Día 2" based on existing snapshots) and a confirm button.

### Saved Days List

Below the economic dashboard cards, a section showing existing snapshots:

```
Días guardados:
  Día 1A — 15/05/2026 — $25,000 — 🗑️
  Día 1B — 16/05/2026 — $24,000 — 🗑️
```

Each has a delete button (with confirmation) to remove a mistakenly saved snapshot.

### Accumulated Mode Toggle

A toggle below the dashboard title:

```
[ Individual ] [ Acumulado ]
```

- **Individual** (default): shows live TD3 data as today
- **Acumulado**: sums all snapshots + current live data, displays accumulated totals
  in the economics cards and distribution table. The table also gains a per-day
  breakdown section showing each snapshot's contribution.

## Google Sheets

### New Tab: Per-Tournament

Each tournament gets its own tab named after the tournament (sanitized).
Columns:

| Día | Fecha | Entradas | Recompras | Addons | Total Buy-in | Rake | Premios | Ganancia Casa |
|---|---|---|---|---|---|---|---|---|
| Día 1A | 2026-05-15 | 100 | 100 | 25 | $25,000 | $2,500 | $22,500 | $2,500 |
| Día 1B | 2026-05-16 | 100 | 100 | 20 | $24,000 | $2,400 | $21,600 | $2,400 |
| Acumulado | — | 200 | 200 | 45 | $49,000 | $4,900 | $44,100 | $4,900 |

Single-day tournaments get a single row without the Acumulado row.

### New Tab: Resumen Mensual

One row per tournament, summarized:

| Torneo | Fecha(s) | Tipo | Entradas | Recompras | Addons | Total Acumulado | Rake | Premios |
|---|---|---|---|---|---|---|---|---|
| Skampa Premium | May 2026 | Multi-día | 200 | 200 | 45 | $49,000 | $4,900 | $44,100 |
| Turbo Viernes | 17/05/2026 | Un día | 50 | 30 | 10 | $9,000 | $900 | $8,100 |

### Export Mechanism

New export type `tournament_export` sent to the existing Google Apps Script webhook.
The Apps Script code is extended with `writeTournamentTab` and `writeMonthlySummary`
functions.

## No-Go Scope

- No changes to the TD3 publisher or cloud function
- No automatic snapshots (manual only)
- No per-player data in tournament export (TD3 doesn't expose this)
- No changes to the existing cash game closure mechanism

## Implementation Order

1. Tournament snapshot service (Firestore read/write)
2. Tables manager: multiDay config toggle
3. Tables manager: "Finalizar Día" button + modal
4. Tables manager: saved days list
5. Tables manager: accumulated dashboard mode
6. Google Sheets export: tournament types
7. Google Sheets Apps Script guide update
