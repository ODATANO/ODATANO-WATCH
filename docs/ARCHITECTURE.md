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

### cds-plugin.js / src/plugin.ts

Entry point. Auto-loaded by CAP when the package contains `cds-plugin.js`.

Registers the `cardano-watcher` kind with CDS model paths, and critically also sets `model` directly on the requires entry (since CAP's `_link_required_services()` runs before plugins load and won't merge kind properties into existing requires entries).

```typescript
// Register kind (for standalone use)
cds.env.requires.kinds['cardano-watcher'] = {
  impl: '@odatano/watch',
  model: ['@odatano/watch/db/schema', '@odatano/watch/srv/admin-service'],
};

// Set model directly on requires entry (kind merge already happened)
if (cds.env.requires['cardano-watcher']) {
  cds.env.requires['cardano-watcher'].model = [
    '@odatano/watch/db/schema',
    '@odatano/watch/srv/admin-service',
  ];
}
```

On `cds.on('served')`, initializes the watcher. On `cds.on('shutdown')`, stops it gracefully.

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
  key address: Bech32;  // String(120)
  description: String(500);
  active: Boolean;
  lastCheckedBlock: Integer64;
  network: String(20);
  events: Composition of many BlockchainEvent;
  hasEvents: Boolean;
}

entity TransactionSubmission {
  key txHash: Blake2b256;  // String(64)
  description: String(500);
  active: Boolean;
  currentStatus: String(20);  // PENDING, CONFIRMED, FAILED
  confirmations: Integer;
  network: String(20);
  events: Composition of many BlockchainEvent;
  hasEvents: Boolean;
}

entity BlockchainEvent {
  key id: UUID;
  type: String(50);  // TX_CONFIRMED, ADDRESS_ACTIVITY, etc.
  description: String(500);
  blockHeight: Integer64;
  blockHash: Blake2b256;
  txHash: Blake2b256;
  address: Association to WatchedAddress;
  submission: Association to TransactionSubmission;
  payload: LargeString;
  processed: Boolean;
  processedAt: Timestamp;
  error: LargeString;
  network: String(20);
  createdAt: Timestamp;
}

entity WatcherConfig {
  key configKey: String(100);
  value: LargeString;
  description: String(500);
  updatedAt: Timestamp;
}
```

## Event Payloads

### cardano.newTransactions

```typescript
{
  address: string;
  count: number;
  transactions: string[];  // Array of transaction hashes
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
