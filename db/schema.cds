namespace odatano.watch;

// -----------------------------------------------------
// Basic Cardano Types
// -----------------------------------------------------
@title      : 'Blake2b256'
@description: '32 bytes Blake2b hash as hex string'
type Blake2b256    : String(64);

@title      : 'Bech32 Address'
@description: 'Bech32 encoded address string'
type Bech32        : String(120);

@title      : 'Lovelace'
@description: 'Amount of ADA in lovelace (1 ADA = 1_000_000 lovelace)'
type Lovelace      : Decimal(20, 0);

@title : 'Watcher Event results'
@description: 'Possible results from watcher event processing start / stop etc.'
type WatcherActionResult {
    success        : Boolean;
    message        : String;
  };
// -----------------------------------------------------
// Entities
// -----------------------------------------------------

@title      : 'Watched Address Entity'
@description: 'Stores information about watched blockchain addresses for monitoring'
entity WatchedAddress {

    @title      : 'Address (Key)'
    @description: 'The Bech32 encoded address to watch'
    key address          : Bech32 not null;

    @title      : 'Description'
    @description: 'Optional description of what this address is for'
        description      : String(500);

    @title      : 'Active Status'
    @description: 'Whether this address is currently being watched'
        active           : Boolean default true;

    @title      : 'Last Checked Block'
    @description: 'Block number of the last time this address was checked'
        lastCheckedBlock : Integer64;

    @title      : 'Network'
    @description: 'The Cardano network (mainnet, preview, preprod)'
        network          : String(20) default 'preview';

    @title      : 'Events'
    @description: 'Blockchain events related to this address'
        events           : Composition of many BlockchainEvent
                               on events.address = $self;

    @title      : 'Has Events'
    @description: 'Indicates if address has associated events'
        hasEvents        : Boolean default false;
}

@title      : 'Transaction Submission Entity'
@description: 'Stores submitted transactions to track their confirmation status'
entity TransactionSubmission {

    @title      : 'Transaction Hash (Key)'
    @description: 'The unique transaction hash as hex string'
    key txHash           : Blake2b256 not null;

    @title      : 'Description'
    @description: 'Optional description of this transaction submission'
        description      : String(500);

    @title      : 'Active Status'
    @description: 'Whether this submission is currently being tracked'
        active           : Boolean default true;

    @title      : 'Current Status'
    @description: 'Current status of the transaction (PENDING, CONFIRMED, FAILED)'
        currentStatus    : String(20) default 'PENDING';

    @title      : 'Confirmations'
    @description: 'Number of block confirmations'
        confirmations    : Integer default 0;

    @title      : 'Network'
    @description: 'The Cardano network (mainnet, preview, preprod)'
        network          : String(20) default 'preview';

    @title      : 'Events'
    @description: 'Blockchain events related to this submission'
        events           : Composition of many BlockchainEvent
                               on events.submission = $self;

    @title      : 'Has Events'
    @description: 'Indicates if submission has associated events'
        hasEvents        : Boolean default false;
}

@title      : 'Blockchain Event Entity'
@description: 'Stores detected blockchain events from watched addresses and submissions'
entity BlockchainEvent {

    @title      : 'Event ID (Key)'
    @description: 'Unique identifier for the event'
    key id               : UUID not null;

    @title      : 'Event Type'
    @description: 'Type of event (TX_CONFIRMED, ADDRESS_ACTIVITY, etc.)'
        type             : String(50) not null;

    @title      : 'Description'
    @description: 'Human-readable description of the event'
        description      : String(500);

    @title      : 'Block Height'
    @description: 'Block height where the event occurred'
        blockHeight      : Integer64;

    @title      : 'Block Hash'
    @description: 'Block hash where the event occurred'
        blockHash        : Blake2b256;

    @title      : 'Transaction Hash'
    @description: 'Transaction hash associated with the event'
        txHash           : Blake2b256;

    @title      : 'Address Association'
    @description: 'The watched address this event is related to'
        address          : Association to WatchedAddress
                               on address.address = $self.address_address;

    @title      : 'Address Key'
    @description: 'Foreign key to watched address'
        address_address  : Bech32;

    @title      : 'Submission Association'
    @description: 'The transaction submission this event is related to'
        submission       : Association to TransactionSubmission
                               on submission.txHash = $self.submission_txHash;

    @title      : 'Submission Key'
    @description: 'Foreign key to transaction submission'
        submission_txHash: Blake2b256;

    @title      : 'Event Payload'
    @description: 'Event payload data as JSON'
        payload          : LargeString;

    @title      : 'Processed Status'
    @description: 'Whether this event has been processed'
        processed        : Boolean default false;

    @title      : 'Processed At'
    @description: 'Timestamp when the event was processed'
        processedAt      : Timestamp;

    @title      : 'Error'
    @description: 'Error message if event processing failed'
        error            : LargeString;

    @title      : 'Network'
    @description: 'The Cardano network (mainnet, preview, preprod)'
        network          : String(20) default 'preview';

    @title      : 'Created At'
    @description: 'Timestamp when event was detected'
        createdAt        : Timestamp @cds.on.insert: $now;
}

@title      : 'Watcher Configuration Entity'
@description: 'Configuration settings for watcher behavior'
entity WatcherConfig {

    @title      : 'Config Key (Key)'
    @description: 'Configuration key identifier'
    key configKey        : String(100) not null;

    @title      : 'Value'
    @description: 'Configuration value as JSON'
        value            : LargeString;

    @title      : 'Description'
    @description: 'Human-readable description of this setting'
        description      : String(500);

    @title      : 'Updated At'
    @description: 'Timestamp of last update'
        updatedAt        : Timestamp @cds.on.insert: $now @cds.on.update: $now;
}
