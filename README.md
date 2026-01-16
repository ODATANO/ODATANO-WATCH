# ODATANO-WATCH - CAP-based Cardano Blockchain Monitoring Plugin

A CAP (Cloud Application Programming Model) plugin for monitoring the Cardano blockchain. Built as a fully integrated plugin, it can be seamlessly integrated into existing CAP projects to provide blockchain functionalities such as address monitoring, transaction tracking, and event management.

📚 **Documentation**: [Quick Start](docs/QUICKSTART.md) | [Setup Guide](docs/SETUP.md) | [Architecture](docs/ARCHITECTURE.md)

## Features

✅ **Plug & Play Integration**: Automatic CDS plugin registration  
✅ **TypeScript First**: Fully type-safe with complete type definitions  
✅ **Address Monitoring**: Monitor Cardano addresses for new transactions  
✅ **Transaction Tracking**: Track submitted transactions and their confirmations  
✅ **Multi-Path Polling**: Independent polling intervals for different monitoring types  
✅ **Event-based Architecture**: Different events for different blockchain activities  
✅ **OData Admin Service**: Complete REST/OData API for management and monitoring  
✅ **Multi-Network Support**: Support for mainnet, preview, and preprod  
✅ **Production Ready**: Comprehensive error handling, logging, and validation  
✅ **Extensible**: Ready for Smart Contracts, NFTs, and custom events

## Installation

```bash
npm add @odatano/cardano-watcher
```

## Quick Start

### 1. Configure the Plugin

Add the configuration to your CAP project's `package.json`:

```json
{
  "cds": {
    "requires": {
      "cardanoWatcher": {
        "network": "preview",
        "blockfrostApiKey": "previewABC123...",
        "autoStart": true,
        
        "addressPolling": {
          "enabled": true,
          "interval": 30
        },
        "transactionPolling": {
          "enabled": true,
          "interval": 60
        }
      }
    }
  }
}
```

### 2. Automatic Initialization

The plugin is automatically loaded as a CDS plugin. No manual initialization required!

### 3. Use Events

```typescript
import type { 
  NewTransactionsEvent,
  TxConfirmedEvent
} from "@odatano/cardano-watcher";

// Address Monitoring: React to new transactions
cds.on("cardano.newTransactions", async (data: NewTransactionsEvent) => {
  console.log(`${data.count} new transactions for ${data.address}`);
  for (const txHash of data.transactions) {
    await processPayment(txHash);
  }
});

// Transaction Tracking: React to transaction confirmations
cds.on("cardano.transactionConfirmed", async (data: TxConfirmedEvent) => {
  console.log(`TX ${data.txHash} confirmed in block ${data.blockHeight}`);
  await markOrderAsCompleted(data.txHash);
});
```

## Admin Service API

The plugin provides a complete OData/REST Admin Service:

### Entities

```http
GET /cardano-watcher-admin/WatchedAddresses
GET /cardano-watcher-admin/TransactionSubmissions
GET /cardano-watcher-admin/BlockchainEvents
GET /cardano-watcher-admin/Transactions
GET /cardano-watcher-admin/WatcherConfigs
```

### Control Actions

**Watcher Control**
```http
POST /cardano-watcher-admin/startWatcher          # Start all polling paths
POST /cardano-watcher-admin/stopWatcher           # Stop all polling paths
POST /cardano-watcher-admin/startAddressPolling   # Start address monitoring
POST /cardano-watcher-admin/startTransactionPolling # Start transaction tracking
POST /cardano-watcher-admin/stopAddressPolling    # Stop address monitoring
POST /cardano-watcher-admin/stopTransactionPolling # Stop transaction tracking
GET  /cardano-watcher-admin/getWatcherStatus      # Get status
POST /cardano-watcher-admin/manualPoll            # Trigger manual poll cycle
```

**Address Monitoring**
```http
POST /cardano-watcher-admin/addWatchedAddress
Content-Type: application/json

{
  "address": "addr_test1qrgfq5jeznaehnf4zs02laas2juuuyzlz48tkue50luuws2nrznmesueg7drstsqaaenq6qpcnvqvn0kessd9fw2wxys6tv622",
  "description": "My Wallet",
  "network": "preview"
}
```

**Transaction Tracking**
```http
POST /cardano-watcher-admin/submitAndTrackTransaction
Content-Type: application/json

{
  "txHash": "cade0ed879a9ea5dd65f13be98581d476b0e77946c9c11123832225a7de55e28",
  "description": "Payment to supplier",
  "network": "preview"
}
```

**Transaction Status Update**
```http
POST /cardano-watcher-admin/updateTransactionStatus
Content-Type: application/json

{
  "txHash": "cade0ed879a9ea5dd65f13be98581d476b0e77946c9c11123832225a7de55e28",
  "status": "CONFIRMED"
}
```

**Remove Watch**
```http
POST /cardano-watcher-admin/removeWatch
Content-Type: application/json

{
  "watchType": "address",  // or "transaction"
  "key": "addr_test1..."   // or txHash
}
```

## Programmatic Usage

```typescript
import cardanoWatcher from "@odatano/cardano-watcher";

// Start/stop all polling paths
await cardanoWatcher.start();
await cardanoWatcher.stop();

// Control individual paths
await cardanoWatcher.startAddressPolling();
await cardanoWatcher.startTransactionPolling();
await cardanoWatcher.stopAddressPolling();
await cardanoWatcher.stopTransactionPolling();

// Get status
const status = cardanoWatcher.getStatus();
const config = cardanoWatcher.config();
```

## Event Types

### Address Activity Event

Emitted when new transactions are detected for a watched address.

```typescript
import type { NewTransactionsEvent } from "@odatano/cardano-watcher";

cds.on("cardano.newTransactions", async (event: NewTransactionsEvent) => {
  console.log(`Address: ${event.address}`);
  console.log(`Count: ${event.count}`);
  console.log(`TxHashes: ${event.transactions.join(", ")}`);
  
  // Process each transaction
  for (const txHash of event.transactions) {
    await processPayment(txHash);
  }
});
```

### Transaction Confirmation Event

Emitted when a submitted transaction is confirmed in the blockchain.

```typescript
import type { TxConfirmedEvent } from "@odatano/cardano-watcher";

cds.on("cardano.transactionConfirmed", async (event: TxConfirmedEvent) => {
  console.log(`TX ${event.txHash} confirmed!`);
  console.log(`Block: ${event.blockHeight}`);
  console.log(`Confirmations: ${event.confirmations}`);
  
  // Mark order as completed
  await markOrderAsCompleted(event.txHash);
});
```

## Data Model

The plugin provides the following entities:

### WatchedAddress
Stores addresses to monitor.

```cds
entity WatchedAddress {
  key address: Bech32;
  description: String(500);
  active: Boolean;
  lastCheckedBlock: Integer64;
  network: String(20);
  events: Composition of many BlockchainEvent;
  hasEvents: Boolean;
}
```

### TransactionSubmission
Tracks submitted transactions.

```cds
entity TransactionSubmission {
  key txHash: Blake2b256;
  description: String(500);
  active: Boolean;
  currentStatus: String(20);  // PENDING, CONFIRMED, FAILED
  lastChecked: Timestamp;
  confirmations: Integer;
  network: String(20);
  submittedBy: String(100);
  metadata: LargeString;
  events: Composition of many BlockchainEvent;
  hasEvents: Boolean;
}
```

### BlockchainEvent
Stores all detected blockchain events.

```cds
entity BlockchainEvent {
  key id: UUID;
  type: String(50);  // TX_CONFIRMED, ADDRESS_ACTIVITY, etc.
  description: String(500);
  blockNumber: Integer64;
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
```

### Transaction
Detailed transaction information.

```cds
entity Transaction {
  key ID: UUID;
  txHash: Blake2b256;
  blockNumber: Integer64;
  blockHash: Blake2b256;
  sender: Bech32;
  receiver: Bech32;
  amount: Lovelace;
  fee: Lovelace;
  metadata: LargeString;
  assets: LargeString;
  status: String(20);
  network: String(20);
  inMempool: Boolean;
  mempoolEnteredAt: Timestamp;
  confirmedAt: Timestamp;
  createdAt: Timestamp;
}
```

## Polling Mechanism

The plugin uses two independent polling paths:

### Address Polling (Default: 30s)
- Monitors all active `WatchedAddress` entries
- Fetches new transactions from the blockchain
- Stores detected transactions in `Transaction` and `BlockchainEvent`
- Emits `cardano.newTransactions` event

### Transaction Polling (Default: 60s)
- Monitors all active `TransactionSubmission` entries
- Checks if submitted transactions are in the blockchain
- Updates status from PENDING to CONFIRMED
- Emits `cardano.transactionConfirmed` event

Both paths can be controlled independently:
```typescript
await cardanoWatcher.startAddressPolling();
await cardanoWatcher.stopTransactionPolling();
```

## Development

### Project Structure

```

├── src/                      # TypeScript source code
│   ├── index.ts             # Main Plugin Module
│   ├── config.ts            # Configuration Management
│   ├── watcher.ts           # Blockchain Watcher Logic
│   ├── blockfrost.ts        # Blockfrost API Integration
│   └── mappers.ts           # Data Mapping Utilities
├── srv/                      # Service Definitions & Implementations
│   ├── admin-service.cds    # Admin Service Definition
│   ├── admin-service.ts     # Admin Service Implementation
│   └── utils/               # Service Utilities
│       ├── backend-request-handler.ts
│       ├── error-codes.ts
│       ├── errors.ts
│       ├── logger.ts
│       └── validators.ts
├── db/                       # CDS Data Model
│   └── schema.cds           # Entity Definitions
├── @cds-models/              # Generated Type Definitions
│   ├── index.ts
│   └── CardanoWatcherAdminService/
├── docs/                     # Documentation
│   ├── QUICKSTART.md
│   ├── SETUP.md
│   └── ARCHITECTURE.md
├── test/                     # Tests
│   ├── unit/
│   └── integration/
├── cds-plugin.ts            # CDS Plugin Entry Point
├── package.json
└── tsconfig.json
```

### Build

```bash
npm run build        # Compile TypeScript
npm run build:watch  # Watch mode for development
```

### Tests

```bash
npm test            # Run all tests
npm run test:watch  # Watch mode for tests
```

### Code Quality

```bash
npm run lint        # Run ESLint
npm run format      # Prettier code formatting
```

## Configuration Options

```typescript
interface CardanoWatcherConfig {
  network?: "mainnet" | "preview" | "preprod";
  blockfrostApiKey?: string;
  blockfrostProjectId?: string;
  autoStart?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  batchSize?: number;
  enableWebhooks?: boolean;
  webhookEndpoint?: string;
  
  addressPolling?: {
    enabled: boolean;
    interval: number; // in seconds
  };
  transactionPolling?: {
    enabled: boolean;
    interval: number; // in seconds
  };
}
```

## License

Apache-2.0

## Support

For questions or issues, please create an [Issue](https://github.com/yourusername/cardano-watcher/issues).
