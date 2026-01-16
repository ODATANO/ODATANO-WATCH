# ODATANO-WATCH a CAP Based Cardano Watcher Plugin

A CAP (Cloud Application Programming Model) plugin for monitoring the Cardano blockchain. Build as plugin, this project can be integrated into other CAP projects to use its functionality like watch address changes and transactions submissions.

📚 **Documentation**: [Quick Start](docs/QUICKSTART.md) | [Setup](docs/SETUP.md) | [Architecture](docs/ARCHITECTURE.md) |

## Features

✅ **Plug & Play**: Automatically available as CDS plugin  
✅ **TypeScript**: Fully written in TypeScript with complete type definitions  
✅ **Address Monitoring**: Watch Cardano addresses for incoming/outgoing transactions  
✅ **Transaction Status Tracking**: Monitor submitted transactions for confirmations  
✅ **Mempool Monitoring**: Track pending transactions in the mempool  
✅ **Multi-Event System**: Different events for different blockchain activities  
✅ **Admin Service**: REST/OData API for managing watches  
✅ **Multi-Network**: Supports mainnet, testnet, preview, preprod  
✅ **Extensible**: Ready for smart contracts, NFTs, and custom events  

## Installation

```bash
npm add @odatano/cardano-watcher
```

## Usage as Plugin

### 1. Configure the Plugin

Add the following to your CAP project's `package.json`:

```json
{
  "cds": {
    "cardanoWatcher": {
      "network": "preview",
      "blockfrostApiKey": "...",
      "autoStart": true,
      
      "addressPolling": {
        "enabled": true,
        "interval": 30
      },
      "transactionPolling": {
        "enabled": true,
        "interval": 60
      },
      "mempoolPolling": {
        "enabled": false,
        "interval": 10
      }
    }
  }
}
```

### 2. Automatic Initialization

The plugin is automatically loaded as a CDS plugin. No manual initialization required!

```typescript
import type { 
  NewTransactionsEvent,
  TxConfirmedEvent,
  MempoolEvent 
} from "@odatano/cardano-watcher";

// Address monitoring
cds.on("cardano.newTransactions", async (data: NewTransactionsEvent) => {
  console.log(`${data.count} new transactions for ${data.address}`);
});

// Transaction confirmation tracking
cds.on("cardano.transactionConfirmed", async (data: TxConfirmedEvent) => {
  console.log(`TX ${data.txHash} confirmed in block ${data.blockHeight}`);
});

// Mempool monitoring  
cds.on("cardano.mempoolMatch", async (data: MempoolEvent) => {
  console.log(`Mempool match: ${data.count} transactions`);
});
```

## API Usage

### Admin Service

The watcher provides an OData/REST admin service with multiple entities and actions:

#### Entities

```http
GET /cardano-watcher-admin/WatchedAddresses
GET /cardano-watcher-admin/TransactionSubmissions
GET /cardano-watcher-admin/MempoolWatches
GET /cardano-watcher-admin/BlockchainEvents
GET /cardano-watcher-admin/Transactions
```

#### Actions

```http
# Watcher Control
POST /cardano-watcher-admin/startWatcher
POST /cardano-watcher-admin/stopWatcher
POST /cardano-watcher-admin/startAddressPolling
POST /cardano-watcher-admin/startTransactionPolling
POST /cardano-watcher-admin/startMempoolPolling
POST /cardano-watcher-admin/stopAddressPolling
POST /cardano-watcher-admin/stopTransactionPolling
POST /cardano-watcher-admin/stopMempoolPolling
GET  /cardano-watcher-admin/getWatcherStatus

# Address Monitoring
POST /cardano-watcher-admin/addWatchedAddress
{
  "address": "addr_test1qrgfq5jeznaehnf4zs02laas2juuuyzlz48tkue50luuws2nrznmesueg7drstsqaaenq6qpcnvqvn0kessd9fw2wxys6tv622",
  "description": "My Wallet",
  "network": "preview"
}

# Transaction Tracking
POST /cardano-watcher-admin/submitAndTrackTransaction
{
  "txHash": "cade0ed879a9ea5dd65f13be98581d476b0e77946c9c11123832225a7de55e28",
  "description": "Payment to supplier",
  "network": "preview"
}

# Mempool Monitoring
POST /cardano-watcher-admin/addMempoolWatch
{
  "watchType": "VALUE_THRESHOLD",
  "criteria": "{\"minAmount\": 1000000}",
  "description": "Large transactions",
  "network": "preview",
  "alertThreshold": 1
}

# Remove any watch
POST /cardano-watcher-admin/removeWatch
{
  "watchType": "address", // or "transaction", "mempool"
  "ID": "uuid-here"
}
```

### Programmatic Usage

```typescript
import cardanoWatcher from "@odatano/cardano-watcher";

// Start/stop all paths
await cardanoWatcher.start();
await cardanoWatcher.stop();

// Control individual paths
await cardanoWatcher.startAddressPolling();
await cardanoWatcher.startTransactionPolling();
await cardanoWatcher.stopMempoolPolling();

// Get status
const status = cardanoWatcher.getStatus();
const config = cardanoWatcher.config();
```

### Events

The plugin emits multiple event types that you can react to:

#### Address Activity

```typescript
import type { NewTransactionsEvent } from "@odatano/cardano-watcher";

cds.on("cardano.newTransactions", async (event: NewTransactionsEvent) => {
  console.log(`Address: ${event.address}`);
  console.log(`Count: ${event.count}`);
  console.log(`TxHashes: ${event.transactions.join(", ")}`);
  
  for (const txHash of event.transactions) {
    await processPayment(txHash);
  }
});
```

#### Transaction Confirmation

```typescript
import type { TxConfirmedEvent } from "@odatano/cardano-watcher";

cds.on("cardano.transactionConfirmed", async (event: TxConfirmedEvent) => {
  console.log(`TX ${event.txHash} confirmed!`);
  console.log(`Block: ${event.blockHeight}`);
  console.log(`Confirmations: ${event.confirmations}`);
  
  await markOrderAsCompleted(event.txHash);
});
```

#### Mempool Events

```typescript
import type { MempoolEvent } from "@odatano/cardano-watcher";

cds.on("cardano.mempoolMatch", async (event: MempoolEvent) => {
  console.log(`${event.count} mempool matches for ${event.watchType}`);
  console.log(`Transactions: ${event.transactions.join(', ')}`);
  await notifyUser("Large transaction detected in mempool");
});
```

## Data Model

The plugin provides the following entities:

### WatchedAddress
Stores addresses to monitor for transactions.
```cds
entity WatchedAddress {
  key ID: UUID;
  address: String(100);
  description: String(500);
  active: Boolean;
  lastCheckedBlock: Integer64;
  network: String(20);
}
```

### TransactionSubmission
Tracks submitted transactions for status updates.
```cds
entity TransactionSubmission {
  key ID: UUID;
  txHash: String(100);
  description: String(500);
  active: Boolean;
  currentStatus: String(20); // PENDING, CONFIRMED
  confirmations: Integer;
  network: String(20);
}
```

### MempoolWatch
Monitors mempool for specific criteria.
```cds
entity MempoolWatch {
  key ID: UUID;
  watchType: String(50); // ADDRESS, ASSET, VALUE_THRESHOLD, etc.
  criteria: LargeString; // JSON criteria
  description: String(500);
  active: Boolean;
  network: String(20);
}
```

### BlockchainEvent
Stores all detected blockchain events.
```cds
entity BlockchainEvent {
  key ID: UUID;
  type: String(50); // TRANSACTION, TX_CONFIRMED, MEMPOOL, etc.
  blockNumber: Integer64;
  txHash: String(100);
  payload: LargeString;
  processed: Boolean;
  network: String(20);
}
```

### Transaction
Detailed transaction information.
```cds
entity Transaction {
  key ID: UUID;
  txHash: String(100);
  blockNumber: Integer64;
  sender: String(100);
  receiver: String(100);
  amount: Decimal(20,6);
  status: String(20);
}
```

## Example Integration

### Simple Payment Service Example

```typescript
import cds from "@sap/cds";
import type { NewTransactionsEvent } from "@odatano/cardano-watcher";

export default class PaymentService extends cds.ApplicationService {
  async init(): Promise<void> {
    // React to blockchain events
    cds.on("cardano.newTransactions", async (data: NewTransactionsEvent) => {
      for (const txHash of data.transactions) {
        await this.createPayment(txHash);
      }
    });

    await super.init();
  }
  
  async createPayment(txHash: string): Promise<void> {
    const { Payments } = this.entities;
    await INSERT.into(Payments).entries({
      txHash,
      status: "PENDING"
    });
  }
}
```

## Blockfrost API Setup

1. Register at [Blockfrost](https://blockfrost.io/)
2. Create a project for the desired network
3. Copy the API Key
4. Set the key in configuration file

## Development

### Build

```bash
npm run build
```

### Structure

```
.
├── src/
│   ├── index.ts          # Main module
│   ├── config.ts         # Configuration management
│   ├── watcher.ts        # Blockchain Watcher
│   └── blockfrost.ts     # Blockfrost API integration
├── db/
│   └── schema.cds        # Data model
├── srv/
│   ├── admin-service.cds # Admin Service Definition
│   └── admin-service.ts  # Admin Service Implementation
├── docs/                 # Documentation
│   ├── QUICKSTART.md     # Quick start guide
│   ├── SETUP.md          # Setup instructions
│   ├── ARCHITECTURE.md   # Architecture overview
│   └── TYPES.md          # TypeScript types reference
├── cds-plugin.ts         # CDS Plugin Entry Point
└── tsconfig.json         # TypeScript configuration
```

### Run Tests

```bash
npm test
```

### Linting

```bash
npm run lint
```

## License

Apache-2.0

## Support

For questions or problems, please create an [Issue](https://github.com/yourusername/cardano-watcher/issues).
