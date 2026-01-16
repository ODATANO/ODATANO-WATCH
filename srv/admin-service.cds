using { odatano.watch as db } from '../db/schema';

/**
 * Cardano Watcher Admin Service
 * Manages blockchain address monitoring and transaction tracking
 */
service CardanoWatcherAdminService @(impl: 'srv/admin-service') {
  
  // ---------------------------------------------------------------------------
  // Entity Projections
  // ---------------------------------------------------------------------------

  @title      : 'Watched Addresses'
  @description: 'Projection for Watched Addresses'
  entity WatchedAddresses         as projection on db.WatchedAddress;

  @title      : 'Transaction Submissions'
  @description: 'Projection for Transaction Submissions'
  entity TransactionSubmissions   as projection on db.TransactionSubmission;

  @title      : 'Blockchain Events'
  @description: 'Projection for Blockchain Events'
  entity BlockchainEvents         as projection on db.BlockchainEvent;

  @title      : 'Transactions'
  @description: 'Projection for Transactions'
  entity Transactions             as projection on db.Transaction;

  @title      : 'Watcher Configurations'
  @description: 'Projection for Watcher Configurations'
  entity WatcherConfigs           as projection on db.WatcherConfig;

  // ---------------------------------------------------------------------------
  // Watcher Control Actions
  // ---------------------------------------------------------------------------

  @title      : 'Start Watcher'
  @description: 'Start all watcher polling paths'
  action startWatcher()                                            returns String;

  @title      : 'Stop Watcher'
  @description: 'Stop all watcher polling paths'
  action stopWatcher()                                             returns String;

  @title      : 'Start Address Polling'
  @description: 'Start the address monitoring polling path'
  action startAddressPolling()                                     returns String;

  @title      : 'Start Transaction Polling'
  @description: 'Start the transaction status polling path'
  action startTransactionPolling()                                 returns String;

  @title      : 'Start Mempool Polling'
  @description: 'Start the mempool monitoring polling path'
  action startMempoolPolling()                                     returns String;

  @title      : 'Stop Address Polling'
  @description: 'Stop the address monitoring polling path'
  action stopAddressPolling()                                      returns String;

  @title      : 'Stop Transaction Polling'
  @description: 'Stop the transaction status polling path'
  action stopTransactionPolling()                                  returns String;

  @title      : 'Stop Mempool Polling'
  @description: 'Stop the mempool monitoring polling path'
  action stopMempoolPolling()                                      returns String;

  @title      : 'Get Watcher Status'
  @description: 'Retrieve current status and configuration of the watcher'
  action getWatcherStatus()                                        returns {
    isRunning          : Boolean;
    addressPolling     : Boolean;
    transactionPolling : Boolean;
    mempoolPolling     : Boolean;
    network            : String;
    pollingIntervals   : {
      address     : Integer;
      transaction : Integer;
      mempool     : Integer;
    };
    watchCounts        : {
      addresses       : Integer;
      submissions     : Integer;
      newTransactions : Integer;
    };
  };

  // ---------------------------------------------------------------------------
  // Address Monitoring Actions
  // ---------------------------------------------------------------------------

  @title      : 'Add Watched Address'
  @description: 'Add a new address to monitor for blockchain activity'
  action addWatchedAddress(
                           @title: 'Address'
                           @description: 'The Bech32 encoded address to watch'
                           address: db.Bech32,

                           @title: 'Description'
                           @description: 'Optional description of the address'
                           description: String,

                           @title: 'Network'
                           @description: 'The Cardano network (mainnet, preview, preprod)'
                           network: String)                      returns WatchedAddresses;

  // ---------------------------------------------------------------------------
  // Transaction Tracking Actions
  // ---------------------------------------------------------------------------

  @title      : 'Submit and Track Transaction'
  @description: 'Submit a transaction hash for status tracking'
  action submitAndTrackTransaction(
                                   @title: 'Transaction Hash'
                                   @description: 'The transaction hash to track'
                                   txHash: db.Blake2b256,

                                   @title: 'Description'
                                   @description: 'Optional description'
                                   description: String,

                                   @title: 'Network'
                                   @description: 'The Cardano network'
                                   network: String,

                                   @title: 'Metadata'
                                   @description: 'Additional metadata as JSON'
                                   metadata: String)             returns TransactionSubmissions;

  @title      : 'Update Transaction Status'
  @description: 'Manually update the status of a tracked transaction'
  action updateTransactionStatus(
                                 @title: 'Transaction Hash'
                                 @description: 'The transaction hash to update'
                                 txHash: db.Blake2b256,

                                 @title: 'Status'
                                 @description: 'New status (PENDING, CONFIRMED, FAILED)'
                                 status: String)                 returns TransactionSubmissions;

  // ---------------------------------------------------------------------------
  // Watch Management Actions
  // ---------------------------------------------------------------------------

  @title      : 'Remove Watch'
  @description: 'Remove an address or transaction from monitoring'
  action removeWatch(
                     @title: 'Watch Type'
                     @description: 'Type of watch to remove (address, transaction)'
                     watchType: String,

                     @title: 'Key'
                     @description: 'The address or transaction hash to remove'
                     key: String)                                returns {
    value : Boolean;
  };

  @title      : 'Manual Poll'
  @description: 'Trigger a manual polling cycle for all active watches'
  action manualPoll()                                              returns {
    success        : Boolean;
    message        : String;
    eventsDetected : Integer;
  };
}
