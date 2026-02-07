# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.3] - 2026-02-07

### Fixed
- **CDS Model Auto-Discovery**: Plugin's CDS models (schema, admin service) were not loaded by consumer apps. CAP's `_link_required_services()` runs during env construction before `cds-plugin.js` loads, so the `model` array set on `cds.env.requires.kinds` was never merged into the requires entry. Fixed by setting `model` directly on `cds.env.requires['cardano-watcher']` in addition to the kind registration.
- **@impl Path Resolution**: `CardanoWatcherAdminService` used a relative `@impl` path (`srv/admin-service`) which CAP resolved against the consumer app root instead of the plugin package root, causing `Cannot find module` errors. Fixed by using the package-qualified path `@odatano/watch/srv/admin-service`.

## [0.1.2] - 2026-01-22

### Added
- GitHub Actions CI workflow for automated testing on Node.js 20.x and 22.x
- Test coverage reporting with Codecov integration
- `test:coverage` npm script for generating coverage reports
- `cds:types` npm script for CDS type generation
- Test and coverage badges in README

### Changed
- Renamed `eslint.config.js` to `eslint.config.mjs` to eliminate Node.js module type warning
- Updated `prepare` script to include CDS type generation before build
- Enhanced README with test workflow and coverage badges

### Fixed
- **Type Safety**: Replaced all `any` types with proper TypeScript types across the codebase
  - Added `BlockfrostAmount` interface for Blockfrost API responses
  - Changed `Function` type to proper function signatures in tests
  - Used `unknown` type for error handling with proper type guards
  - Used `Service` type from `@sap/cds` for database operations
  - Fixed optional parameter handling in `initializeClient`
- Fixed ESLint warnings about unsafe function types
- Fixed TypeScript strict mode compliance in error handling
- Added CDS type generation step to CI workflow

### Infrastructure
- GitHub Actions workflow with matrix testing (Node 20.x, 22.x)
- Automated type checking, linting, and testing in CI
- Coverage reporting pipeline

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
