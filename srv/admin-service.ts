import cds from "@sap/cds";
const { SELECT, INSERT, UPDATE } = cds.ql;
import * as watcher from "../src/watcher";

interface WatcherStatus {
  isRunning: boolean;
  addressPolling: boolean;
  transactionPolling: boolean;
  mempoolPolling: boolean;
  network: string;
  pollingIntervals: {
    address: number;
    transaction: number;
    mempool: number;
  };
  watchCounts: {
    addresses: number;
    newtransactions: number;
    submissions: number;
  };
}

export default class CardanoWatcherAdminService {
  entities: any;
  on: any;

  async init(): Promise<any> {
    const { WatchedAddresses, TransactionSubmissions, MempoolWatches } = this.entities;

    // Start watcher action (all paths)
    this.on("startWatcher", async (req: any) => {
      try {
        await watcher.start();
        return "Watcher started successfully";
      } catch (err) {
        const error = err as Error;
        req.error(500, `Failed to start watcher: ${error.message}`);
        return undefined;
      }
    });

    // Stop watcher action (all paths)
    this.on("stopWatcher", async (req: any) => {
      try {
        await watcher.stop();
        return "Watcher stopped successfully";
      } catch (err) {
        const error = err as Error;
        req.error(500, `Failed to stop watcher: ${error.message}`);
        return undefined;
      }
    });

    // Start individual polling paths
    this.on("startAddressPolling", async (req: any) => {
      try {
        await watcher.startAddressPolling();
        return "Address polling started successfully";
      } catch (err) {
        const error = err as Error;
        req.error(500, `Failed to start address polling: ${error.message}`);
        return undefined;
      }
    });

    this.on("startTransactionPolling", async (req: any) => {
      try {
        await watcher.startTransactionPolling();
        return "Transaction polling started successfully";
      } catch (err) {
        const error = err as Error;
        req.error(500, `Failed to start transaction polling: ${error.message}`);
        return undefined;
      }
    });

    // Stop individual polling paths
    this.on("stopAddressPolling", async (req: any) => {
      try {
        await watcher.stopAddressPolling();
        return "Address polling stopped successfully";
      } catch (err) {
        const error = err as Error;
        req.error(500, `Failed to stop address polling: ${error.message}`);
        return undefined;
      }
    });

    this.on("stopTransactionPolling", async (req: any) => {
      try {
        await watcher.stopTransactionPolling();
        return "Transaction polling stopped successfully";
      } catch (err) {
        const error = err as Error;
        req.error(500, `Failed to stop transaction polling: ${error.message}`);
        return undefined;
      }
    });

    // Get watcher status
    this.on("getWatcherStatus", async (req: any): Promise<WatcherStatus> => {
      const status = watcher.getStatus();
      
      // Count active watches
      const [addressCount, submissionCount, mempoolCount] = await Promise.all([
        cds.tx(req, (tx: any) => tx.run(SELECT.from(WatchedAddresses).where({ active: true }))),
        cds.tx(req, (tx: any) => tx.run(SELECT.from(TransactionSubmissions).where({ active: true }))),
        cds.tx(req, (tx: any) => tx.run(SELECT.from(MempoolWatches).where({ active: true }))),
      ]);

      return {
        isRunning: status.isRunning,
        addressPolling: status.addressPolling,
        transactionPolling: status.transactionPolling,
        mempoolPolling: status.mempoolPolling,
        network: status.config.network || "mainnet",
        pollingIntervals: {
          address: status.config.addressPolling?.interval || 30,
          transaction: status.config.transactionPolling?.interval || 60,
          mempool: status.config.mempoolPolling?.interval || 10,
        },
        watchCounts: {
          addresses: addressCount?.length || 0,
          submissions: submissionCount?.length || 0,
          newtransactions: mempoolCount?.length || 0,
        },
      };
    });

    // Add watched address
    this.on("addWatchedAddress", async (req: any) => {
      const { address, description, network } = req.data;
      
      if (!address) {
        req.error(400, "Address is required");
        return;
      }

      const result = await cds.tx(req, async (tx: any) => {
        // Check if address already exists
        const existing = await tx.run(
          SELECT.one.from(WatchedAddresses).where({ address })
        );

        if (existing) {
          req.error(409, `Address ${address} is already being watched`);
          return;
        }

        // Insert new watched address
        const inserted = await tx.run(
          INSERT.into(WatchedAddresses).entries({
            address,
            description: description || null,
            network: network || watcher.getStatus().config.network,
            active: true,
            lastCheckedBlock: null,
          })
        );

        return tx.run(SELECT.one.from(WatchedAddresses).where({ ID: inserted.ID }));
      });

      return result;
    });

    // Submit and track transaction
    this.on("submitAndTrackTransaction", async (req: any) => {
      const { txHash, description, network, metadata } = req.data;
      
      if (!txHash) {
        req.error(400, "txHash is required");
        return;
      }

      const result = await cds.tx(req, async (tx: any) => {
        // Check if already tracking
        const existing = await tx.run(
          SELECT.one.from(TransactionSubmissions).where({ txHash })
        );

        if (existing) {
          req.error(409, `Transaction ${txHash} is already being tracked`);
          return;
        }

        // Insert new submission
        const inserted = await tx.run(
          INSERT.into(TransactionSubmissions).entries({
            txHash,
            description: description || null,
            network: network || watcher.getStatus().config.network,
            active: true,
            currentStatus: "PENDING",
            confirmations: 0,
            metadata: metadata || null,
            submittedBy: req.user?.id || "system",
          })
        );

        return tx.run(SELECT.one.from(TransactionSubmissions).where({ ID: inserted.ID }));
      });

      return result;
    });

    // Update transaction status
    this.on("updateTransactionStatus", async (req: any) => {
      const { ID, status } = req.data;

      if (!ID || !status) {
        req.error(400, "ID and status are required");
        return;
      }

      const result = await cds.tx(req, async (tx: any) => {
        await tx.run(
          UPDATE.entity(TransactionSubmissions)
            .set({ currentStatus: status, lastChecked: new Date().toISOString() })
            .where({ ID })
        );

        return tx.run(SELECT.one.from(TransactionSubmissions).where({ ID }));
      });

      return result;
    });

    // Add mempool watch
    this.on("addMempoolWatch", async (req: any) => {
      const { watchType, criteria, description, network, alertThreshold } = req.data;
      
      if (!watchType || !criteria) {
        req.error(400, "watchType and criteria are required");
        return;
      }

      const result = await cds.tx(req, async (tx: any) => {
        const inserted = await tx.run(
          INSERT.into(MempoolWatches).entries({
            watchType,
            criteria,
            description: description || null,
            network: network || watcher.getStatus().config.network,
            active: true,
            alertThreshold: alertThreshold || 1,
          })
        );

        return tx.run(SELECT.one.from(MempoolWatches).where({ ID: inserted.ID }));
      });

      return result;
    });

    // Remove watch (generic)
    this.on("removeWatch", async (req: any) => {
      const { watchType, ID } = req.data;

      if (!watchType || !ID) {
        req.error(400, "watchType and ID are required");
        return false;
      }

      await cds.tx(req, async (tx: any) => {
        let entity;
        switch (watchType.toLowerCase()) {
          case "address":
            entity = WatchedAddresses;
            break;
          case "transaction":
            entity = TransactionSubmissions;
            break;
          case "mempool":
            entity = MempoolWatches;
            break;
          default:
            req.error(400, `Unknown watch type: ${watchType}`);
            return;
        }

        await tx.run(
          UPDATE.entity(entity)
            .set({ active: false })
            .where({ ID })
        );
      });

      return true;
    });
}
}
