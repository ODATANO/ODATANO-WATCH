# Architecture

Technical internals of the Cardano Watcher Plugin.

## Overview

CAP plugin that monitors Cardano blockchain via Blockfrost API. Uses two independent polling paths: address monitoring (30s) and transaction tracking (60s). Events are emitted via CAP event bus.

## Component Diagram

```
┌───────────────────────────────────────────┐
│          Your CAP Services                │
│  cds.on("cardano.newTransactions")        │
│  cds.on("cardano.transactionConfirmed")   │
└──────────────┬────────────────────────────┘
               │ Events
         ╔═════╧══════════╗
         ║  CAP Event Bus ║
         ╚═════╤══════════╝
               │
┌──────────────┴────────────────────────────┐
│     Cardano Watcher Plugin                │
│                                           │
│  Watcher (watcher.ts)                     │
│  ├─ pollWatchedAddresses() [30s]          │
│  └─ pollTransactionSubmissions() [60s]    │
│                                           │
│  Blockfrost API (blockfrost.ts)           │
│  Config Manager (config.ts)               │
└───────────────┬───────────────────────────┘
                │
         ┌──────┴──────┐
         │  Database   │
         └─────────────┘
```

## Core Modules

### cds-plugin.ts

Entry point. Auto-loaded by CAP if `cds.env.requires.watch` exists.

```typescript
const isServe = (cds as any).cli?.command === "serve";
const isBuild = (cds as any).build?.register;

if (isBuild && !isServe) {
  module.exports = {};
} else if (Object.keys(cds.env.requires.watch ?? {}).length) {
  module.exports = cardanoWatcher.initialize();
}
```

### src/index.ts

Main module. Orchestrates config, watcher, and API.

**Lifecycle**: `initialize()` → `config.initialize()` → `watcher.setup()` → `ready`

**Exports**:
```typescript
export default {
  initialize,
  start, stop,
  startAddressPolling, stopAddressPolling,
  startTransactionPolling, stopTransactionPolling,
  getStatus,
  config: getConfig,
};
```

### src/watcher.ts

Two independent polling loops:

**Address Polling (30s)**:
1. `SELECT` active `WatchedAddress`
2. `fetchAddressTransactions(address, lastCheckedBlock)`
3. New TXs? → `INSERT BlockchainEvent` + `Transaction` + `emit("cardano.newTransactions")`

**Transaction Polling (60s)**:
1. `SELECT` active `TransactionSubmission` WHERE `status = "PENDING"`
2. `getTransaction(txHash)`
3. Found? → `UPDATE status` + `INSERT BlockchainEvent` + `emit("cardano.transactionConfirmed")`

### src/blockfrost.ts

Blockfrost API integration.

```typescript
export function initializeClient(config: any): any
export async function fetchAddressTransactions(
  address: string,
  fromBlock: number | null
): Promise<TransactionData[]>
export async function getTransaction(txHash: string): Promise<any>
```

## Data Flow

### Address Event Detection

```
Timer (30s) → pollWatchedAddresses()
  → SELECT WatchedAddress
  → fetchAddressTransactions()
  → INSERT BlockchainEvent + Transaction
  → UPDATE lastCheckedBlock
  → cds.emit("cardano.newTransactions")
```

### Transaction Confirmation

```
Timer (60s) → pollTransactionSubmissions()
  → SELECT TransactionSubmission WHERE status="PENDING"
  → getTransaction(txHash)
  → UPDATE status="CONFIRMED"
  → INSERT BlockchainEvent
  → cds.emit("cardano.transactionConfirmed")
```

## Database Entities

```cds
entity WatchedAddress {
  key ID: UUID;
  address: String(120);
  lastCheckedBlock: Integer64;
  isActive: Boolean;
}

entity TransactionSubmission {
  key ID: UUID;
  txHash: String(64);
  currentStatus: String(20);  // PENDING, CONFIRMED
  isActive: Boolean;
}

entity BlockchainEvent {
  key ID: UUID;
  type: String(30);  // TRANSACTION, TX_CONFIRMED
  txHash: String(64);
  blockNumber: Integer64;
  payload: String;
}

entity Transaction {
  key ID: UUID;
  txHash: String(64);
  amount: Integer64;
  fee: Integer64;
  sender: String(120);
  receiver: String(120);
}
```

## Event Payloads

### cardano.newTransactions

```typescript
{
  address: string;
  count: number;
  transactions: Array<{
    txHash: string;
    blockNumber: number;
    amount: number;
    sender: string | null;
    receiver: string | null;
  }>;
}
```

### cardano.transactionConfirmed

```typescript
{
  txHash: string;
  blockHeight: number;
  confirmations: number;
}
```

## Admin Service

OData service with actions:

- `startWatcher()`, `stopWatcher()`
- `startAddressPolling()`, `stopAddressPolling()`
- `startTransactionPolling()`, `stopTransactionPolling()`
- `getWatcherStatus()`
- `addWatchedAddress(address, description)`
- `submitAndTrackTransaction(txHash, description)`
- `manualPoll()`

## Performance

**Recommended Indexes**:
```sql
CREATE INDEX idx_watched_address ON WatchedAddress(address);
CREATE INDEX idx_tx_submission ON TransactionSubmission(txHash);
CREATE INDEX idx_event_type ON BlockchainEvent(type);
```

**Polling Optimization**:
- Separate timers per path (address 30s, TX 60s)
- Batch processing (default: 50 items)
- Parallel queries for independent items

## Extensibility

### Custom Event Handlers

```typescript
cds.on("cardano.newTransactions", async (data) => {
  // Process payment
});
```

### Custom API Provider

Replace `src/blockfrost.ts` with custom implementation matching interface:

```typescript
export async function fetchAddressTransactions(
  address: string, 
  fromBlock: number | null
): Promise<TransactionData[]>
```
