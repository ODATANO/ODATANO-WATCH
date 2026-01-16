# Architecture of the Cardano Watcher Plugin

## Overview

The Cardano Watcher Plugin is designed as a CAP plugin that can be seamlessly integrated into existing CAP applications. It monitors the Cardano blockchain for various events including:

- **Address Monitoring**: Watch specific addresses for incoming/outgoing transactions
- **Transaction Status Tracking**: Monitor submitted transactions for confirmation status
- **Mempool Monitoring**: Track pending transactions in the mempool
- **Smart Contract Events**: Monitor script executions and contract interactions
- **Custom Blockchain Events**: Extensible for any blockchain-related events

All detected events are emitted via the CAP event bus and can be consumed by other services within the CAP application.

## Component Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                       CAP Application                          │
│                                                                │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │                 Your Business Services                     │ │
│ │                                                            │ │
│ │        TransactionService:                                 │ │
│ │       ┌─────────────────────────────────────────────┐      │ │
│ │       │ cds.on("cardano.submitTransaction", ...)    │      │ │
│ │       │   → Transaction submission                  │      │ │
│ │       │   → Update Records                          │      │ │
│ │       │   → Subscribe to events                     │      │ │
│ │       │   → Handle event receipts                   │      │ │
│ │       └─────────────────────────────────────────────┘      │ │
│ │                             ↑                              │ │
│ │                             │ Event Listener               │ │
│ └─────────────────────────────┼──────────────────────────────┘ │
│                               │                                │
│ ╔═════════════════════════════╧══════════════════════════════╗ │
│ ║             CAP Event Bus (cds.emit / cds.on)              ║ │
│ ╚═════════════════════════════╤══════════════════════════════╝ │
│                               │ Event Emitter                  │
│                               ↓                                │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │            Cardano Watcher Plugin                         │ │
│  │                                                           │ │
│  │   ┌────────────────────────────────────────────┐          │ │
│  │   │ Watcher (watcher.ts)                       │          │ │
│  │   │                                            │          │ │
│  │   │ pollBlockchain() {                         │          │ │
│  │   │   1. Check watched Submission TX           │          │ │
│  │   │   2. try to fetch new transaction          │ ──┐      │ │
│  │   │   3. store result in watcher DB            │   │      │ │
│  │   │   4. cds.emit("cardano.newTransactions", { │   │      │ │
│  │   │        address, count, transactions        │   │      │ │
│  │   │      })                                    │   │      │ │
│  │   │ }                                          │   │      │ │
│  │   └────────────────────────────────────────────┘   │      │ │
│  │              │                   │                 │      │ │
│  │   ┌──────────┴───────┐   ┌───────┴────────┐        │      │ │
│  │   │ Config Manager   │   │   Blockfrost   │        │      │ │
│  │   │ (config.ts)      │   │                │ ───────┘      │ │
│  │   │                  │   │                │               │ │
│  │   └──────────────────┘   └────────────────┘               │ │
│  └───────────────────────────────────────────────────────────┘ │
│                              ↓                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              CDS Database Layer                         │   │
│  │   • WatchedAddress (active addresses to monitor)        │   │
│  │   • BlockchainEvent (detected events)                   │   │
│  │   • Transaction (transaction details)                   │   │
│  └─────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────┘
                               ↓
                    ┌────────────────────────┐
                    │  Cardano Blockchain    │
                    │   (via Blockfrost API) │
                    └────────────────────────┘

Event Flow:
──────────
1. Watcher polls blockchain every X seconds
2. Finds new transactions → Stores in DB
3. Emits: cds.emit("cardano.newTransactions", {...})
4. CAP Event Bus distributes to all listeners
5. Your services: cds.on("cardano.newTransactions", handler)
6. Business logic executes asynchronously
```

## Core Modules

### 1. cds-plugin.ts (Entry Point)

- **Purpose**: Automatic entry point for CAP
- **Function**: 
  - Checks if `cds.env.cardanoWatcher` is configured
  - Initializes plugin automatically on server start
  - Prevents loading during build/compile operations

```typescript
// Automatically loaded by CAP
if (Object.keys(cds.env.cardanoWatcher ?? {}).length) {
  module.exports = cardanoWatcher.initialize();
}
```

### 2. src/index.ts (Main Module)

- **Purpose**: Main logic of the plugin
- **Responsibilities**:
  - Plugin initialization
  - Coordination between Config and Watcher
  - Providing the Public API
  - Event orchestration
  - Type exports

**Lifecycle**:
```
initialize() → config.initialize() → watcher.setup() → ready
```

### 3. src/config.ts (Configuration Manager)

- **Purpose**: Central configuration management with TypeScript types
- **Sources** (descending priority):
  1. `cds.env.cardanoWatcher` (from package.json)
  2. Direct options in `initialize()`
  3. Defaults

**Type-safe configuration**:
```typescript
interface CardanoWatcherConfig {
  network?: "mainnet" | "testnet" | "preview" | "preprod";
  pollingInterval?: number;
  blockfrostApiKey?: string;
  // ...
}
```

**Configuration flow**:
```
cds.env.cardanoWatcher (package.json)
        ↓
  initialize(options)
        ↓
    Validated Config
```

### 4. src/watcher.ts (Blockchain Watcher)

- **Purpose**: Monitors the blockchain with full type safety
- **Monitoring Types**:
  - **Address Watching**: Monitors addresses for new transactions
  - **Transaction Status**: Tracks transaction confirmations and status changes
  - **Mempool Events**: Detects transactions entering/leaving mempool
  - **Custom Events**: Extensible for smart contracts, NFTs, stake pool changes, etc.

- **How it works**:
  1. Polling interval starts timer
  2. Fetches active watched items from DB (addresses, submitted txs, etc.)
  3. For each item: Query blockchain for status/updates
  4. Stores events and changes in DB
  5. Emits corresponding events (e.g., `cardano.newTransactions`, `cardano.txStatusChanged`, `cardano.mempoolEvent`)

**Polling cycle**:
```
Timer (Interval)
    ↓
pollBlockchain()
    ↓
Fetch Watched Items (addresses, txs, etc.)
    ↓
For each item:
  Query Blockchain API
    ↓
  Detect Changes/Events
    ↓
  Store in DB
    ↓
  Emit Event (cardano.*)
```

### 5. src/blockfrost.ts (API Integration)

- **Purpose**: Integration with Blockfrost API
- **Features**:
  - Lazy initialization
  - Error handling
  - Transaction parsing with TypeScript types
  - Metadata extraction
  - Asset handling

## Data Flow

### 1. Adding a Watch Target

```
User/API Call
    ↓
addWatchedAddress() / submitTransaction() / addMempoolWatch()
    ↓
DB Insert → WatchedAddress / TransactionSubmission / MempoolWatch
    ↓
Considered in next poll
```

### 2. Event Detection (Generic)

```
Poll Timer
    ↓
watcher.pollBlockchain()
    ↓
SELECT active WatchedAddresses
    ↓
For each address:
  blockfrost.fetchAddressTransactions()
    ↓
  Parse transaction data
    ↓
  INSERT BlockchainEvent
  INSERT Transaction
    ↓
  UPDATE WatchedAddress.lastCheckedBlock
    ↓
cds.emit("cardano.newTransactions")
    ↓
Consumer Services handle event
```

### 3. Event Consumption (Examples)

```
Consumer Service
    ↓
cds.on("cardano.newTransactions", handler)        // Address activity
cds.on("cardano.txStatusChanged", handler)        // TX status updates  
cds.on("cardano.mempoolEvent", handler)           // Mempool changes
cds.on("cardano.contractEvent", handler)          // Smart contract events
    ↓
Receive event data with type-specific payload
    ↓
Business Logic
    ↓
Mark BlockchainEvent as processed
```

## Service Layer

### CardanoWatcherAdminService

OData/REST Service for administration:

**Entities**:
- `WatchedAddresses` - CRUD for watched addresses
- `TransactionSubmissions` - CRUD for submitted transactions to track
- `MempoolWatches` - CRUD for mempool monitoring
- `BlockchainEvents` - Read access to all detected events
- `Transactions` - Read access to transaction details

**Actions**:
- `startWatcher()` - Start watcher
- `stopWatcher()` - Stop watcher
- `getWatcherStatus()` - Get status
- `addWatchedAddress()` - Add address to monitor
- `submitAndTrackTransaction()` - Submit transaction and track its status
- `addMempoolWatch()` - Monitor mempool for specific criteria
- `removeWatch()` - Deactivate any watch item
- `manualPoll()` - Trigger manual poll

## Plugin Integration Pattern

The plugin uses the CAP plugin system:

1. **Automatic Registration**: Via `cds-plugin.js`
2. **Database Integration**: Entities are automatically deployed
3. **Service Exposure**: Admin service becomes automatically available
4. **Event System**: Uses CDS event bus

## Extensibility

### Custom API Provider

Instead of Blockfrost you can implement custom providers:

```typescript
// src/providers/koios.ts
import type { TransactionData } from "../blockfrost";

export async function fetchAddressTransactions(
  address: string,
  fromBlock: number | null
): Promise<TransactionData[]> {
  // Koios API implementation
  return [];
}

// In watcher.ts
import * as koios from "./providers/koios";
```

### Custom Event Handlers

Consumers can register handlers for all event types with full type safety:

```typescript
import type { 
  NewTransactionsEvent,
  TxStatusChangedEvent,
  MempoolEvent,
  ContractEvent 
} from "@odatano/cardano-watcher";

// Address monitoring
cds.on("cardano.newTransactions", async (data: NewTransactionsEvent) => {
  // Process new transactions for watched addresses
});

// Transaction status tracking
cds.on("cardano.txStatusChanged", async (data: TxStatusChangedEvent) => {
  // Handle confirmation, failure, or status updates
});

// Mempool monitoring
cds.on("cardano.mempoolEvent", async (data: MempoolEvent) => {
  // Track pending transactions
});

// Smart contract events
cds.on("cardano.contractEvent", async (data: ContractEvent) => {
  // Handle script executions
});
```

### Webhook Integration (planned)

```typescript
config.webhookEndpoint = "https://my-app.com/webhook";
// Plugin sends POST requests to endpoint
```

## Performance Considerations

### Database Queries

- Index on `WatchedAddress.address`
- Index on `TransactionSubmission.txHash`
- Index on `MempoolWatch.criteria`
- Index on `BlockchainEvent.txHash`
- Index on `BlockchainEvent.type`
- Index on `Transaction.txHash`
- Batch inserts for transactions and events

### Polling Optimization

- Configurable `pollingInterval`
- Batch processing of watch items (addresses, txs, mempool)
- Priority-based polling (mempool more frequent than confirmed txs)
- Rate limiting for API calls
- Caching of block data and transaction status
- Parallel querying for independent watch items

### Memory Management

- Limit on number of parallel requests
- Cleanup of old events via retention policy
- Streaming for large datasets

## Security

### API Key Management

- Never hardcode in code
- Use environment variables
- CAP Service Manager for production

### Database Access

- Use CAP Authorization
- Read/Write permissions per entity
- Tenant isolation for multi-tenancy

## Monitoring & Logging

### Log Levels

```typescript
cds.log("cardanoWatcher").info("Status");
cds.log("cardanoWatcher/watcher").debug("Details");
cds.log("cardanoWatcher/blockfrost").error("Error");
```

### Metrics

- Number of watched items (addresses, txs, mempool watches)
- Events detected per minute (by type)
- Transaction confirmations tracked
- Mempool activity
- API call rate and response times
- Error rate by event type

## Testing Strategy

### Unit Tests

- Config validation
- Transaction parsing
- Event emission for all event types
- Mempool detection logic
- Status change detection
- Smart contract event parsing

### Integration Tests

- Database operations
- Service actions
- Event flow

### E2E Tests (with Mock)

- Complete workflow
- Error scenarios
- Recovery behavior

## Deployment

### As npm Package

```bash
npm publish @odatano/cardano-watcher
```

### In Consumer Projects

```bash
npm add @odatano/cardano-watcher
```

CAP loads the plugin automatically!

## Current Features & Roadmap

### Implemented
- ✅ **Address Monitoring**: Track address transactions
- ✅ **Transaction Status Tracking**: Monitor submitted transaction confirmations
- ✅ **Mempool Monitoring**: Track pending transactions
- ✅ **Multiple Event Types**: Different events for different scenarios
- ✅ **Type-safe Event System**: Full TypeScript support

### Planned Enhancements
- [ ] **Smart Contract Events**: Monitor Plutus script executions in detail
- [ ] **NFT Tracking**: Detect NFT minting and transfers
- [ ] **Stake Pool Events**: Monitor delegation changes
- [ ] **Multi-Tenant**: Support for multiple tenants
- [ ] **Webhook Support**: Push notifications to external endpoints
- [ ] **Redis Caching**: For better performance
- [ ] **GraphQL API**: In addition to OData
- [ ] **Custom Query Language**: For flexible event filtering

## Similarities to event-queue

This plugin follows the best practices of event-queue:

✅ CDS Plugin Pattern  
✅ Configuration via `cds.env`  
✅ Automatic initialization  
✅ Event-based architecture  
✅ Admin service for management  
✅ Extensible design  
✅ Database-first approach  

## Differences from event-queue

- **Domain**: Blockchain instead of generic event processing
- **External Integration**: Blockfrost API
- **Polling**: Active polling instead of push
- **Use Case**: Specific to Cardano

## Summary

The Cardano Watcher Plugin is a production-ready CAP plugin that:

1. **Easy Integration**: npm install + config
2. **Automatic Initialization**: Loads via CAP plugin system
3. **Multi-Event Support**: Addresses, transaction status, mempool, contracts
4. **Type-Safe Events**: Full TypeScript support for all event types
5. **Extensible**: Custom providers, event handlers, and watch types
6. **Scalable**: Optimized polling, caching, and batch processing
4. Is scalable and extensible
5. Follows best practices from the CAP ecosystem
