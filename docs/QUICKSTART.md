# Cardano Watcher Plugin - Quick Start Guide

## Prerequisites

- Node.js >= 18
- SAP CAP SDK (`@sap/cds`)
- Blockfrost API Key (optional, but recommended)

## Step 1: Install Plugin

In your CAP project:

```bash
npm add @odatano/cardano-watcher
```

## Step 2: Configuration

Add to your project's `package.json`:

```json
{
  "cds": {
    "cardanoWatcher": {
      "network": "testnet",
      "pollingInterval": 60000,
      "autoStart": true,
      "blockfrostApiKey": "your-api-key-here"
    }
  }
}
```

## Step 3: Choose Your Monitoring Type

### Option A: Watch an Address

Monitor a specific Cardano address for transactions.

#### Via REST API

```bash
curl -X POST http://localhost:4004/cardano-watcher-admin/addWatchedAddress \
  -H "Content-Type: application/json" \
  -d '{
    "address": "addr_test1...",
    "description": "My Test Wallet",
    "network": "testnet"
  }'
```

### Option B: Track a Transaction

Monitor a submitted transaction for status changes.

```bash
curl -X POST http://localhost:4004/cardano-watcher-admin/submitAndTrackTransaction \
  -H "Content-Type: application/json" \
  -d '{
    "txHash": "abc123...",
    "description": "Payment to supplier",
    "network": "mainnet"
  }'
```

### Option C: Monitor Mempool

Watch for pending transactions matching specific criteria.

```bash
curl -X POST http://localhost:4004/cardano-watcher-admin/addMempoolWatch \
  -H "Content-Type: application/json" \
  -d '{
    "watchType": "VALUE_THRESHOLD",
    "criteria": "{\"minAmount\": 1000000}",
    "description": "Large transactions",
    "network": "mainnet",
    "alertThreshold": 1
  }'
```

## Step 4: React to Events

The plugin emits different events for different activities. Choose what you need:

### Address Monitoring Events

```javascript
module.exports = class PaymentService extends cds.ApplicationService {
  async init() {
    // React to new transactions on watched addresses
    cds.on("cardano.newTransactions", async (data) => {
      console.log(`New transactions on ${data.address}!`);
      console.log(`Count: ${data.count}`);
      
      for (const txHash of data.transactions) {
        await this.processPayment(txHash);
      }
    });

    await super.init();
  }
  
  async processPayment(txHash) {
    console.log(`Processing payment: ${txHash}`);
    // Your business logic
  }
};
```

### Transaction Status Events

```javascript
cds.on("cardano.txStatusChanged", async (data) => {
  console.log(`TX ${data.txHash}`);
  console.log(`Status: ${data.oldStatus} → ${data.newStatus}`);
  console.log(`Confirmations: ${data.confirmations}`);
  
  if (data.newStatus === "CONFIRMED") {
    await markOrderAsCompleted(data.txHash);
  }
});
```

### Mempool Events

```javascript
cds.on("cardano.mempoolEvent", async (data) => {
  if (data.eventType === "ENTERED") {
    console.log(`Pending TX: ${data.txHash}`);
    await notifyUser("Large transaction detected in mempool");
  }
});
```

## Step 5: Start Server

```bash
cds watch
```

The plugin will be automatically loaded and start monitoring!

## Useful Commands

### Check Status
```bash
curl http://localhost:4004/cardano-watcher-admin/getWatcherStatus
```

### Start/stop watcher manually
```bash
curl -X POST http://localhost:4004/cardano-watcher-admin/startWatcher
curl -X POST http://localhost:4004/cardano-watcher-admin/stopWatcher
```

### Trigger manual poll
```bash
curl -X POST http://localhost:4004/cardano-watcher-admin/manualPoll
```

## Use Database Entities

You can directly access the plugin entities:

```javascript
// Get all watched addresses
const addresses = await SELECT.from("odatano.cardano.WatchedAddress");

// All blockchain events
const events = await SELECT.from("odatano.cardano.BlockchainEvent")
  .where({ processed: false });

// Get transactions
const txs = await SELECT.from("odatano.cardano.Transaction")
  .where({ status: "CONFIRMED" });
```

## Get Blockfrost API Key

1. Go to https://blockfrost.io
2. Register for free
3. Create a new project (e.g., "Testnet")
4. Copy the API Key
5. Set it in configuration or as environment variable:

```bash
export BLOCKFROST_API_KEY=your-api-key
```

## Troubleshooting

### Plugin not loading
- Check if `cardanoWatcher` is configured in `cds.requires`
- Check if package is installed: `npm list @odatano/cardano-watcher`

### No transactions detected
- Check if address is correct
- Check if address is marked as `active: true`
- Check if `pollingInterval` is not too large
- Verify Blockfrost API Key

### View logs
```javascript
const logger = cds.log("cardanoWatcher");
logger.info("Status:", watcher.getStatus());
```

## Further Resources

- [README](./README.md)
- [Blockfrost Documentation](https://docs.blockfrost.io)
- [CAP Documentation](https://cap.cloud.sap)
