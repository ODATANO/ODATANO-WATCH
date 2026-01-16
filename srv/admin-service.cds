using { odatano.watch } from '../db/schema';

/**
 * Admin service for managing the Cardano Watcher
 */
service CardanoWatcherAdminService {
  
  // Entities
  entity WatchedAddresses as projection on watch.WatchedAddress;
  entity TransactionSubmissions as projection on watch.TransactionSubmission;
  entity MempoolWatches as projection on watch.MempoolWatch;
  entity BlockchainEvents as projection on watch.BlockchainEvent;
  entity Transactions as projection on watch.Transaction;
  entity WatcherConfigs as projection on watch.WatcherConfig;

  // Actions
  action startWatcher() returns String;
  action stopWatcher() returns String;
  action getWatcherStatus() returns {
    isRunning: Boolean;
    network: String;
    pollingInterval: Integer;
    watchCounts: {
      addresses: Integer;
      submissions: Integer;
      mempoolWatches: Integer;
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
  
  // Mempool Monitoring
  action addMempoolWatch(
    watchType: String,
    criteria: String,
    description: String,
    network: String,
    alertThreshold: Integer
  ) returns MempoolWatches;
  
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
