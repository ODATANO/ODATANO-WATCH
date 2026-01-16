# Setup Instructions

## Quick Start

Follow these steps to set up the project:

### 1. Install Dependencies

```bash
npm install
```

This will install:
- TypeScript and build tools
- `@types/node` for Node.js type definitions
- Testing framework (Jest with ts-jest)
- ESLint for code quality
- All required dependencies

### 2. Build the Project

```bash
npm run build
```

This compiles the TypeScript code to JavaScript in the `dist/` folder.

### 3. Run Tests (Optional)

```bash
npm test
```

### 4. Use in Your CAP Project

After successful build, you can publish the package:

```bash
npm publish
```

Or link it locally for testing:

```bash
# In this project
npm link

# In your CAP project
npm link @odatano/cardano-watcher
```

## Configuration Options

The plugin supports individual polling paths with separate intervals:

```json
{
  "cds": {
    "cardanoWatcher": {
      "network": "mainnet",
      "blockfrostProjectId": "your-project-id",
      "autoStart": true,
      
      "addressPolling": {
        "enabled": true,
        "interval": 30
      },
      "transactionPolling": {
        "enabled": true,
        "interval": 60
      },
    }
  }
}
```

### Polling Intervals

- **addressPolling**: Monitor watched addresses (default: 30s)
- **transactionPolling**: Check if submitted TXs are in network (default: 60s)

## TypeScript Notes

The project uses TypeScript with the following configuration:

- **Target**: ES2020
- **Module System**: CommonJS
- **Strict Mode**: Enabled (with `noImplicitAny: false` for flexibility)
- **Source Maps**: Generated for debugging
- **Declaration Files**: Generated (`.d.ts`)

## CDS Type Definitions

The project uses official `@cap-js/cds-types` package for TypeScript type definitions. Type declaration files (.d.ts) are automatically generated from the TypeScript source during build.

## Troubleshooting

###  "Cannot find type definition file for 'node'"

Run `npm install` to install `@types/node`.

### "Cannot find module '@sap/cds'"

This is expected during standalone development since `@sap/cds` is a peerDependency. The error will disappear when the package is used in a real CAP project with `@sap/cds` installed.

### Build Errors

Make sure all dependencies are installed:

```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```

## Development Workflow

1. Make changes to TypeScript files in `src/` or `srv/`
2. Run `npm run build` to compile
3. Run `npm test` to ensure tests pass
4. Commit your changes

For continuous development:

```bash
npm run build:watch
```

This will watch for file changes and recompile automatically.
