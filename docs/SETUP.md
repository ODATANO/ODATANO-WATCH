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
    "requires": {
      "watch": {
        "network": "preprod",
        "blockfrostApiKey": "preprod_YOUR_KEY",
        "autoStart": true
      }
    }
  }
}
```

### Full Configuration Options

```typescript
interface CardanoWatcherConfig {
  network: "mainnet" | "preprod" | "preview";
  blockfrostApiKey?: string;
  autoStart?: boolean;  // default: true
  
  addressPolling?: {
    enabled: boolean;   // default: true
    interval: number;   // seconds, default: 60
  };
  
  transactionPolling?: {
    enabled: boolean;   // default: true
    interval: number;   // seconds, default: 60
  };
  
  maxRetries?: number;    // default: 3
  retryDelay?: number;    // ms, default: 5000
}
```

### Environment Variables

For **plugin development only**, you can use environment variables as fallback:

```bash
BLOCKFROST_KEY=mainnet_abc123
```

For **production use**, always configure via `cds.env.requires.watch.blockfrostApiKey`

## Database Setup

Entities are deployed automatically with `cds deploy`.

**Manual inspection**:
```bash
cds deploy --dry-run > migration.sql
```

**Created entities**: `WatchedAddress`, `TransactionSubmission`, `BlockchainEvent`, `WatcherConfig`

## Security

### API Key Management

**❌ Never hardcode in package.json**:
```json
"watch": {
  "blockfrostApiKey": "mainnet_hardcoded_key"
}
```

**✅ Use environment-based config**:
```json
"watch": {
  "blockfrostApiKey": "${BLOCKFROST_KEY}"
}
```

**✅ Kubernetes Secrets**:
```yaml
env:
  - name: BLOCKFROST_KEY
    valueFrom:
      secretKeyRef:
        name: cardano-secrets
        key: blockfrostKey
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
  -e BLOCKFROST_KEY=mainnet_abc123 \
  my-cap-app
```

**Note**: The environment variable is used via config: `"blockfrostApiKey": "${BLOCKFROST_KEY}"`

### Cloud Foundry

```yaml
applications:
  - name: cardano-watcher-app
    memory: 512M
    buildpack: nodejs_buildpack
```

Bind secret service:
```bash
cf create-user-provided-service cardano-secrets -p '{"BLOCKFROST_KEY":"mainnet_abc123"}'
cf bind-service my-app cardano-secrets
```

**Note**: Use `"blockfrostApiKey": "${BLOCKFROST_KEY}"` in your config
cf bind-service my-app cardano-config
```

## Performance Tuning

| Project Size | Address Interval | TX Interval |
|--------------|------------------|-------------|
| < 10 items   | 30s              | 60s         |
| 10-100 items | 60s              | 120s        |
| > 100 items  | 120s             | 180s        |

**Blockfrost free tier**: 50,000 requests/day, 10 req/s

## Troubleshooting

### Plugin Not Loading

```bash
# Check installation
npm ls @odatano/watch

# Verify config
cds env get requires.watch

# View logs
cds watch
```

### Events Not Firing

```typescript
// Check status
const status = await cardanoWatcher.getStatus();
console.log(status);

// Enable debug logs
cds.env.log.levels = { "ODATANO-WATCH": "debug", "CARDANO-WATCH": "debug" };
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
          BLOCKFROST_KEY: ${{ secrets.BLOCKFROST_KEY }}
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
