# Setup Guide

Installation, configuration, and deployment for the Cardano Watcher Plugin.

## Installation

### For Plugin Users

```bash
npm add @odatano/watch
```

### For Plugin Developers

```bash
git clone https://github.com/odatano/cardano-watcher.git
npm install
npm run build
```

## Configuration

### Basic Configuration

```json
{
  "cds": {
    "cardanoWatcher": {
      "network": "preprod",
      "blockfrostProjectId": "preprod_YOUR_KEY",
      "autoStart": true
    }
  }
}
```

### Full Configuration Options

```typescript
interface CardanoWatcherConfig {
  network: "mainnet" | "preprod" | "preview";
  blockfrostProjectId: string;
  autoStart?: boolean;  // default: false
  
  addressPolling?: {
    enabled: boolean;   // default: true
    interval: number;   // seconds, default: 30
  };
  
  transactionPolling?: {
    enabled: boolean;   // default: true
    interval: number;   // seconds, default: 60
  };
  
  maxRetries?: number;    // default: 3
  retryDelay?: number;    // ms, default: 1000
  batchSize?: number;     // default: 50
}
```

### Environment Variables

```bash
CDS_CARDANO_WATCHER_NETWORK=mainnet
CDS_CARDANO_WATCHER_BLOCKFROST_PROJECT_ID=mainnet_abc123
CDS_CARDANO_WATCHER_AUTO_START=true
```

## Database Setup

Entities are deployed automatically with `cds deploy`.

**Manual inspection**:
```bash
cds deploy --dry-run > migration.sql
```

**Created entities**: `WatchedAddress`, `TransactionSubmission`, `BlockchainEvent`, `Transaction`

## Security

### API Key Management

**❌ Never hardcode**:
```json
"blockfrostProjectId": "mainnet_hardcoded_key"
```

**✅ Use environment variables**:
```json
"blockfrostProjectId": "${CDS_CARDANO_WATCHER_BLOCKFROST_PROJECT_ID}"
```

**✅ Kubernetes Secrets**:
```yaml
env:
  - name: CDS_CARDANO_WATCHER_BLOCKFROST_PROJECT_ID
    valueFrom:
      secretKeyRef:
        name: cardano-secrets
        key: blockfrostProjectId
```

### Authorization

Restrict admin service:

```cds
using { CardanoWatcherAdminService } from '@odatano/watch';
extend service CardanoWatcherAdminService with @(requires: 'admin');
```

## Deployment

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 4004
CMD ["npx", "cds", "serve"]
```

```bash
docker run -p 4004:4004 \
  -e CDS_CARDANO_WATCHER_NETWORK=mainnet \
  -e CDS_CARDANO_WATCHER_BLOCKFROST_PROJECT_ID=mainnet_... \
  my-cap-app
```

### Cloud Foundry

```yaml
applications:
  - name: cardano-watcher-app
    memory: 512M
    buildpack: nodejs_buildpack
    env:
      CDS_CARDANO_WATCHER_NETWORK: mainnet
```

Bind secret service:
```bash
cf create-user-provided-service cardano-config -p '{"blockfrostProjectId":"..."}'
cf bind-service my-app cardano-config
```

## Performance Tuning

| Project Size | Address Interval | TX Interval | Batch Size |
|--------------|------------------|-------------|------------|
| < 10 items   | 30s              | 60s         | 50         |
| 10-100 items | 60s              | 120s        | 50         |
| > 100 items  | 120s             | 180s        | 100        |

**Blockfrost free tier**: 50,000 requests/day, 10 req/s

## Troubleshooting

### Plugin Not Loading

```bash
# Check installation
npm ls @odatano/watch

# Verify config
cds env get cardanoWatcher

# View logs
cds watch
```

### Events Not Firing

```typescript
// Check status
const status = await cardanoWatcher.getStatus();
console.log(status);

// Manual poll
await cardanoWatcher.manualPoll();

// Enable debug logs
cds.env.log.levels = { cardanoWatcher: "debug" };
```

### API Rate Limits

- Increase polling intervals
- Reduce watched items
- Upgrade Blockfrost plan

## CI/CD

### GitHub Actions

```yaml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run build
      - run: npm test
        env:
          CDS_CARDANO_WATCHER_BLOCKFROST_PROJECT_ID: ${{ secrets.BLOCKFROST_KEY }}
```

## Resources


      "batchSize": 100,
      "maxRetries": 5
    }
  }
}
```

Consider upgrading to Blockfrost paid tier for higher rate limits!

---

## Support & Resources

- **Documentation**: [GitHub Repo](https://github.com/odatano/cardano-watcher)
- **Issues**: [GitHub Issues](https://github.com/odatano/cardano-watcher/issues)
- **Discussions**: [GitHub Discussions](https://github.com/odatano/cardano-watcher/discussions)
- **CAP Documentation**: [cap.cloud.sap](https://cap.cloud.sap)
- **Blockfrost API**: [docs.blockfrost.io](https://docs.blockfrost.io)

---

**Setup complete!** Your plugin is now ready for development or production use.
