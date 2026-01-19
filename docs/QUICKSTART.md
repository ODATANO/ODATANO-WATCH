# Quickstart - Cardano Watcher Plugin

Get up and running in 5 minutes.

## Install

```bash
npm add @odatano/watch
```

**Important**: Use `npm add` (not `npm install`) for CAP plugins!

## Configure

Add to `package.json`:

```json
{
  "cds": {
    "requires": {
      "watch": {
        "network": "preview",
        "blockfrostApiKey": "preview_your_api_key_here",
        "autoStart": true
      }
    }
  }
}
```

Get your free API key at [blockfrost.io](https://blockfrost.io/)

## Use Events

Create `srv/my-service.ts`:

```typescript
import cds from "@sap/cds";

export default cds.service.impl(async function () {
  cds.on("cardano.newTransactions", async (data) => {
    console.log("New TX:", data.address, data.count);
    // Your business logic
  });

  cds.on("cardano.transactionConfirmed", async (data) => {
    console.log("Confirmed:", data.txHash);
    // Update order status, etc.
  });
});
```

## Start

```bash
cds watch
```

You should see:
```
[ODATANO-WATCH] - Plugin initialized
[ODATANO-WATCH] - Address polling started (60s)
[ODATANO-WATCH] - Transaction polling started (60s)
```

## Watch Address

```bash
POST http://localhost:4004/odata/v4/cardano-watcher-admin/addWatchedAddress

{
  "address": "addr_test1qz...",
  "description": "My Wallet"
}
```

## Track Transaction

```typescript
import cardanoWatcher from "@odatano/watch";

const txHash = await submitToBlockchain(tx);
await cardanoWatcher.submitAndTrackTransaction({ txHash });
```

## Next Steps

- [Setup Guide](./SETUP.md) - Detailed configuration, deployment, security
- [Architecture](./ARCHITECTURE.md) - Technical internals


