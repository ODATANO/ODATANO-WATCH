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

  @title      : 'Watcher Configurations'
  @description: 'Projection for Watcher Configurations'
  entity WatcherConfigs           as projection on db.WatcherConfig;

  // ---------------------------------------------------------------------------
  // Watcher Control Actions
  // ---------------------------------------------------------------------------

  @title      : 'Start Watcher'
  @description: 'Start all watcher polling paths'
  action startWatcher()                                            returns db.WatcherActionResult;

  @title      : 'Stop Watcher'
  @description: 'Stop all watcher polling paths'
  action stopWatcher()                                             returns db.WatcherActionResult;

  @title      : 'Get Watcher Status'
  @description: 'Retrieve current status and configuration of the watcher'
  action getWatcherStatus()                                        returns {
    isRunning          : Boolean;
    addressPolling     : Boolean;
    transactionPolling : Boolean;
    network            : String;
    pollingIntervals   : {
      address     : Integer;
      transaction : Integer;
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

  @title      : 'Remove Watched Address'
  @description: 'Remove an address from monitoring'
  action removeWatchedAddress(
                           @title: 'Address'
                           @description: 'The Bech32 encoded address to stop watching'
                           address: db.Bech32)                   returns db.WatcherActionResult;                         

  

  
  // ---------------------------------------------------------------------------
  // Transaction Tracking Actions
  // ---------------------------------------------------------------------------

  @title      : 'Track Submitted Transaction'
  @description: 'Submit a transaction hash for status tracking'
  action addWatchedTransaction(
                                   @title: 'Transaction Hash'
                                   @description: 'The transaction hash to track'
                                   txHash: db.Blake2b256,

                                   @title: 'Description'
                                   @description: 'Optional description'
                                   description: String,

                                   @title: 'Network'
                                   @description: 'The Cardano network'
                                   network: String)             returns TransactionSubmissions;

                                   
  @title      : 'Remove Watched Transaction'
  @description: 'Stop tracking a transaction'
  action removeWatchedTransaction(
                                   @title: 'Transaction Hash'
                                   @description: 'The transaction hash to stop tracking'
                                   txHash: db.Blake2b256)        returns db.WatcherActionResult;
}
