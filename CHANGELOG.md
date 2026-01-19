# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - 2026-01-19

### Changed
- Migrated to native CDS logger (`cds.log()`) instead of custom logger implementation
- Simplified API key configuration: `blockfrostApiKey` in config, `BLOCKFROST_KEY` env variable as fallback for development
- Updated all documentation (README, QUICKSTART, SETUP, ARCHITECTURE) to reflect new configuration approach

### Removed
- Custom `logger.ts` utility (replaced by CDS logger)
- Unused configuration options: `blockfrostProjectId`, `batchSize`, `enableWebhooks`, `webhookEndpoint`

### Fixed
- **BREAKING**: Config key inconsistency - now consistently uses `cds.env.requires.watch` (previously mixed usage)
- Important: Configuration priority - CDS config always takes precedence over environment variables
- Consistent logger naming: unified to `ODATANO-WATCH`

## [0.1.0] - 2026-01-17

### Added
- Initial release of @odatano/watch CAP plugin
- Cardano blockchain monitoring via Blockfrost API
- Address monitoring with configurable polling intervals
- Transaction tracking and confirmation detection
- Independent polling paths for addresses (30s) and transactions (60s)
- Event-based architecture with CAP event bus integration
- OData Admin Service for management and monitoring
- Multi-network support (mainnet, preview, preprod)
- TypeScript-first implementation with full type definitions
- Comprehensive error handling and logging
- Complete documentation (README, QUICKSTART, SETUP, ARCHITECTURE)
- Unit and integration tests
- CAP plugin auto-registration
- Environment variable configuration support

### Features
- **Events**: `cardano.newTransactions` and `cardano.transactionConfirmed`
- **Admin Actions**: Start/stop watcher, add addresses, track transactions
- **Data Models**: WatchedAddress, TransactionSubmission, BlockchainEvent, Transaction
- **API Integration**: Blockfrost API client with retry logic
- **Configuration**: Flexible configuration via package.json or environment variables

[0.1.0]: https://github.com/ODATANO/ODATANO-WATCH/releases/tag/v0.1.0
