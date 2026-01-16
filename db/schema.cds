namespace odatano.watch;

using { cuid, managed } from '@sap/cds/common';

/**
 * Stores information about watched blockchain addresses
 */
entity WatchedAddress : cuid, managed {
  address          : String(100) not null;
  description      : String(500);
  active           : Boolean default true;
  lastCheckedBlock : Integer64;
  network          : String(20) default 'mainnet'; // mainnet, preview, preprod
}

/**
 * Stores submitted transactions to track their status
 */
entity TransactionSubmission : cuid, managed {
  txHash           : String(100) not null;
  description      : String(500);
  active           : Boolean default true;
  currentStatus    : String(20); // PENDING, CONFIRMED, FAILED
  lastChecked      : Timestamp;
  confirmations    : Integer;
  network          : String(20);
  submittedBy      : String(100); // User/Service that submitted
  metadata         : LargeString; // Additional tracking info
}

/**
 * Stores mempool watch configurations
 */
entity MempoolWatch : cuid, managed {
  watchType        : String(50) not null; // ADDRESS, ASSET, VALUE_THRESHOLD, etc.
  criteria         : LargeString not null; // JSON with watch criteria
  description      : String(500);
  active           : Boolean default true;
  lastChecked      : Timestamp;
  network          : String(20);
  alertThreshold   : Integer; // How many matching txs before alert
}

/**
 * Stores detected blockchain events
 */
entity BlockchainEvent : cuid, managed {
  type             : String(50) not null;  // TRANSACTION, TX_STATUS_CHANGE, MEMPOOL, CONTRACT, ASSET_TRANSFER, etc.
  blockNumber      : Integer64;
  blockHash        : String(100);
  txHash           : String(100);
  address          : Association to WatchedAddress;
  submission       : Association to TransactionSubmission;
  mempoolWatch     : Association to MempoolWatch;
  payload          : LargeString;
  processed        : Boolean default false;
  processedAt      : Timestamp;
  error            : LargeString;
  network          : String(20);
}

/**
 * Stores transaction details
 */
entity Transaction : cuid, managed {
  txHash           : String(100) not null;
  blockNumber      : Integer64;
  blockHash        : String(100);
  sender           : String(100);
  receiver         : String(100);
  amount           : Decimal(20,6);
  fee              : Decimal(20,6);
  metadata         : LargeString;
  assets           : LargeString; // JSON array of native assets
  status           : String(20);  // CONFIRMED, PENDING, FAILED
  network          : String(20);
  inMempool        : Boolean default false;
  mempoolEnteredAt : Timestamp;
  confirmedAt      : Timestamp;
}

/**
 * Configuration for watcher behavior
 */
entity WatcherConfig : cuid, managed {
  key configKey    : String(100) not null;
  value            : LargeString;
  description      : String(500);
}
