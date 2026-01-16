using { odatano.watch } from '../db/schema';

/**
 * Admin service for managing the Cardano Watcher
 */
service CardanoWatcherAdminService {
  
  // Entities
  entity WatchedAddresses as projection on watch.WatchedAddress;
  entity TransactionSubmissions as projection on watch.TransactionSubmission;
  entity BlockchainEvents as projection on watch.BlockchainEvent;
  entity Transactions as projection on watch.Transaction;
  entity WatcherConfigs as projection on watch.WatcherConfig;

  // Actions
  action startWatcher() returns String;
  action stopWatcher() returns String;
  
  // Individual polling path controls
  action startAddressPolling() returns String;
  action startTransactionPolling() returns String;
  action startMempoolPolling() returns String;
  action stopAddressPolling() returns String;
  action stopTransactionPolling() returns String;
  action stopMempoolPolling() returns String;
  
  action getWatcherStatus() returns {
    isRunning: Boolean;
    addressPolling: Boolean;
    transactionPolling: Boolean;
    mempoolPolling: Boolean;
    network: String;
    pollingIntervals: {
      address: Integer;
      transaction: Integer;
      mempool: Integer;
    };
    watchCounts: {
      addresses: Integer;
      submissions: Integer;
      newtransactions: Integer;
    };
  };
  
  // Address Monitoring
  action addWatchedAddress(
    address: String, 
    description: String, 
    network: String
  ) returns WatchedAddresses;
  
  // Transaction Status Tracking
  action submitAndTrackTransaction(
    txHash: String,
    description: String,
    network: String,
    metadata: String
  ) returns TransactionSubmissions;
  
  action updateTransactionStatus(
    ID: UUID,
    status: String
  ) returns TransactionSubmissions;
  
  // Generic Watch Removal
  action removeWatch(
    watchType: String, // 'address', 'transaction', 'mempool'
    ID: UUID
  ) returns Boolean;
  
  action manualPoll() returns {
    success: Boolean;
    message: String;
    eventsDetected: Integer;
  };
}
