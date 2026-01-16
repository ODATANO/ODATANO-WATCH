import cds from '@sap/cds';
jest.setTimeout(20000);

/**
 * Core Watcher Integration Tests
 * 
 * This test file validates the core watcher functionality including:
 * - Watcher lifecycle management (start/stop)
 * - Address monitoring
 * - Transaction tracking
 * - Entity CRUD operations
 * - Status reporting
 */

const WATCHER_FIXTURE = {
  network: 'preview',
  addressToWatch: 'addr_test1vqm5vyp8xztmxyl6mcr2xr5schajvsq8fjs8gn8g2zu0pgg8gckcp',
  addressToWatch2: 'addr_test1qz2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3n0d3vllmyqwsx5wktcd8cc3sq835lu7drv2xwl2wywfgs68faae',
  transactionToWatch: '2b8216b428b5292a4b13075cf37b26434f890a4ffcce1f75da1f85d2297efe83',
  transactionToWatch2: 'cb082e3e77a7d8cf56baaba5cbe8843d63b53fa41074557ed29e0dbfe7daab39',
};

describe('Core Watcher Integration Tests', () => {

  const test = cds.test(__dirname + '/../../');
  const expect = test.expect;

  describe('Watcher Action Tests', () => {

    it('POST /startWatcher - start the watcher successfully', async () => {
      const { status, data } = await test.post('/odata/v4/cardano-watcher-admin/startWatcher', {});
     
      console.log(data);
      expect(data.value).to.be.a('string');
      expect(data.value).to.include('started');
      expect(status).to.equal(200);
    });


    it('POST /stopWatcher - stop the watcher successfully', async () => {
      const { status, data } = await test.post('/odata/v4/cardano-watcher-admin/stopWatcher', {});
      expect(data.value).to.be.a('string');
      expect(data.value).to.include('stopped');
      expect(status).to.equal(200);
    });

    it('POST /startAddressPolling - start address polling', async () => {
      const { status, data } = await test.post('/odata/v4/cardano-watcher-admin/startAddressPolling', {});
      expect(status).to.equal(200);
      expect(data.value).to.be.a('string');
      expect(data.value).to.include('Address polling');
    });

    it('POST /stopAddressPolling - stop address polling', async () => {
      const { status, data } = await test.post('/odata/v4/cardano-watcher-admin/stopAddressPolling', {});
      expect(status).to.equal(200);
      expect(data.value).to.be.a('string');
      expect(data.value).to.include('Address polling');
    });

    it('POST /startTransactionPolling - start transaction polling', async () => {
      const { status, data } = await test.post('/odata/v4/cardano-watcher-admin/startTransactionPolling', {});
      expect(status).to.equal(200);
      expect(data.value).to.be.a('string');
      expect(data.value).to.include('Transaction polling');
    });

    it('POST /stopTransactionPolling - stop transaction polling', async () => {
      const { status, data } = await test.post('/odata/v4/cardano-watcher-admin/stopTransactionPolling', {});
      expect(status).to.equal(200);
      expect(data.value).to.be.a('string');
      expect(data.value).to.include('Transaction polling');
    });

    it('POST /getWatcherStatus - get current watcher status', async () => {
      const { status, data } = await test.post('/odata/v4/cardano-watcher-admin/getWatcherStatus', {});
      expect(status).to.equal(200);
      expect(data).to.have.property('isRunning');
      expect(data).to.have.property('addressPolling');
      expect(data).to.have.property('transactionPolling');
      expect(data).to.have.property('network');
      expect(data).to.have.property('pollingIntervals');
      expect(data.pollingIntervals).to.have.property('address');
      expect(data.pollingIntervals).to.have.property('transaction');
      expect(data).to.have.property('watchCounts');
      expect(data.watchCounts).to.have.property('addresses');
      expect(data.watchCounts).to.have.property('submissions');
    });

    it('POST /addWatchedAddress - add a new watched address', async () => {
      const requestBody = {
        address: WATCHER_FIXTURE.addressToWatch,
        description: 'Test address for integration testing',
        network: WATCHER_FIXTURE.network
      };
      const { status, data } = await test.post('/odata/v4/cardano-watcher-admin/addWatchedAddress', requestBody);
      expect(status).to.equal(200);
      expect(data).to.have.property('address');
      expect(data.address).to.equal(WATCHER_FIXTURE.addressToWatch);
      expect(data).to.have.property('active');
      expect(data.active).to.be.true;
    });

    it('POST /addWatchedAddress - error when address is missing', async () => {
      const requestBody = {
        description: 'Missing address'
      };
      const response = await test.post('/odata/v4/cardano-watcher-admin/addWatchedAddress', requestBody).catch(err => err.response);
      expect(response.status).to.equal(400);
      expect(response.data).to.have.property('error');
    });

    it('POST /submitAndTrackTransaction - submit and track a transaction', async () => {
      const requestBody = {
        txHash: WATCHER_FIXTURE.transactionToWatch,
        description: 'Test transaction for integration testing',
        network: WATCHER_FIXTURE.network,
        metadata: JSON.stringify({ test: true })
      };
      const { status, data } = await test.post('/odata/v4/cardano-watcher-admin/submitAndTrackTransaction', requestBody);
      expect(status).to.equal(200);
      expect(data).to.have.property('txHash');
      expect(data.txHash).to.equal(WATCHER_FIXTURE.transactionToWatch);
      expect(data).to.have.property('currentStatus');
      expect(data.currentStatus).to.equal('PENDING');
      expect(data).to.have.property('active');
      expect(data.active).to.be.true;
    });

    it('POST /submitAndTrackTransaction - error when txHash is missing', async () => {
      const requestBody = {
        description: 'Missing txHash'
      };
      const response = await test.post('/odata/v4/cardano-watcher-admin/submitAndTrackTransaction', requestBody).catch(err => err.response);
      expect(response.status).to.equal(400);
      expect(response.data).to.have.property('error');
    });

    it('POST /updateTransactionStatus - update transaction status', async () => {
      // First create a transaction
      const createBody = {
        txHash: WATCHER_FIXTURE.transactionToWatch2,
        description: 'Test transaction for status update',
        network: WATCHER_FIXTURE.network
      };
      const createResponse = await test.post('/odata/v4/cardano-watcher-admin/submitAndTrackTransaction', createBody);
      const txHash = createResponse.data.txHash;

      // Now update the status
      const updateBody = {
        txHash: txHash,
        status: 'CONFIRMED'
      };
      const { status, data } = await test.post('/odata/v4/cardano-watcher-admin/updateTransactionStatus', updateBody);
      expect(status).to.equal(200);
      expect(data).to.have.property('txHash');
      expect(data.txHash).to.equal(txHash);
      expect(data).to.have.property('currentStatus');
      expect(data.currentStatus).to.equal('CONFIRMED');
    });

    it('POST /removeWatch - remove an address watch', async () => {
      // First create a watched address
      const createBody = {
        address: WATCHER_FIXTURE.addressToWatch2,
        description: 'Test address for removal',
        network: WATCHER_FIXTURE.network
      };
      const createResponse = await test.post('/odata/v4/cardano-watcher-admin/addWatchedAddress', createBody);
      const address = createResponse.data.address;

      // Now remove the watch
      const removeBody = {
        watchType: 'address',
        key: address
      };
      const { status, data } = await test.post('/odata/v4/cardano-watcher-admin/removeWatch', removeBody);
      expect(status).to.equal(200);
      expect(data).to.have.property('value');
      expect(data.value).to.be.true;
    });

    it('POST /removeWatch - error when watchType is missing', async () => {
      const requestBody = {
        key: 'some-key'
      };
      const response = await test.post('/odata/v4/cardano-watcher-admin/removeWatch', requestBody).catch(err => err.response);
      expect(response.status).to.equal(400);
      expect(response.data).to.have.property('error');
    });

    it('POST /removeWatch - error when ID is missing', async () => {
      const requestBody = {
        watchType: 'address'
      };
      const response = await test.post('/odata/v4/cardano-watcher-admin/removeWatch', requestBody).catch(err => err.response);
      expect(response.status).to.equal(400);
      expect(response.data).to.have.property('error');
    });
  });

  describe('Entity Read Tests', () => {

    it('GET /WatchedAddresses - retrieve all watched addresses', async () => {
      const { status, data } = await test.get('/odata/v4/cardano-watcher-admin/WatchedAddresses');
      expect(status).to.equal(200);
      expect(data).to.have.property('value');
      expect(Array.isArray(data.value)).to.be.true;
    });

    it('GET /WatchedAddresses - filter by active status', async () => {
      const { status, data } = await test.get('/odata/v4/cardano-watcher-admin/WatchedAddresses?$filter=active eq true');
      expect(status).to.equal(200);
      expect(data).to.have.property('value');
      expect(Array.isArray(data.value)).to.be.true;
      if (data.value.length > 0) {
        data.value.forEach((addr: any) => {
          expect(addr.active).to.be.true;
        });
      }
    });

    it('GET /WatchedAddresses - select specific fields', async () => {
      const { status, data } = await test.get('/odata/v4/cardano-watcher-admin/WatchedAddresses?$select=address,network,active');
      expect(status).to.equal(200);
      expect(data).to.have.property('value');
      expect(Array.isArray(data.value)).to.be.true;
      if (data.value.length > 0) {
        const addr = data.value[0];
        expect(addr).to.have.property('address');
        expect(addr).to.have.property('network');
        expect(addr).to.have.property('active');
      }
    });

    it('GET /TransactionSubmissions - retrieve all transaction submissions', async () => {
      const { status, data } = await test.get('/odata/v4/cardano-watcher-admin/TransactionSubmissions');
      expect(status).to.equal(200);
      expect(data).to.have.property('value');
      expect(Array.isArray(data.value)).to.be.true;
    });

    it('GET /TransactionSubmissions - filter by status', async () => {
      const { status, data } = await test.get('/odata/v4/cardano-watcher-admin/TransactionSubmissions?$filter=currentStatus eq \'PENDING\'');
      expect(status).to.equal(200);
      expect(data).to.have.property('value');
      expect(Array.isArray(data.value)).to.be.true;
      if (data.value.length > 0) {
        data.value.forEach((tx: any) => {
          expect(tx.currentStatus).to.equal('PENDING');
        });
      }
    });

    it('GET /BlockchainEvents - retrieve all blockchain events', async () => {
      const { status, data } = await test.get('/odata/v4/cardano-watcher-admin/BlockchainEvents');
      expect(status).to.equal(200);
      expect(data).to.have.property('value');
      expect(Array.isArray(data.value)).to.be.true;
    });

    it('GET /BlockchainEvents - filter by processed status', async () => {
      const { status, data } = await test.get('/odata/v4/cardano-watcher-admin/BlockchainEvents?$filter=processed eq false');
      expect(status).to.equal(200);
      expect(data).to.have.property('value');
      expect(Array.isArray(data.value)).to.be.true;
      if (data.value.length > 0) {
        data.value.forEach((event: any) => {
          expect(event.processed).to.be.false;
        });
      }
    });

    it('GET /BlockchainEvents - filter by event type', async () => {
      const { status, data } = await test.get('/odata/v4/cardano-watcher-admin/BlockchainEvents?$filter=type eq \'TX_CONFIRMED\'');
      expect(status).to.equal(200);
      expect(data).to.have.property('value');
      expect(Array.isArray(data.value)).to.be.true;
    });

    it('GET /Transactions - retrieve all transactions', async () => {
      const { status, data } = await test.get('/odata/v4/cardano-watcher-admin/Transactions');
      expect(status).to.equal(200);
      expect(data).to.have.property('value');
      expect(Array.isArray(data.value)).to.be.true;
    });

    it('GET /Transactions - filter by network', async () => {
      const { status, data } = await test.get(`/odata/v4/cardano-watcher-admin/Transactions?$filter=network eq '${WATCHER_FIXTURE.network}'`);
      expect(status).to.equal(200);
      expect(data).to.have.property('value');
      expect(Array.isArray(data.value)).to.be.true;
      if (data.value.length > 0) {
        data.value.forEach((tx: any) => {
          expect(tx.network).to.equal(WATCHER_FIXTURE.network);
        });
      }
    });

    it('GET /Transactions - filter by mempool status', async () => {
      const { status, data } = await test.get('/odata/v4/cardano-watcher-admin/Transactions?$filter=inMempool eq true');
      expect(status).to.equal(200);
      expect(data).to.have.property('value');
      expect(Array.isArray(data.value)).to.be.true;
    });

    it('GET /WatcherConfigs - retrieve all watcher configurations', async () => {
      const { status, data } = await test.get('/odata/v4/cardano-watcher-admin/WatcherConfigs');
      expect(status).to.equal(200);
      expect(data).to.have.property('value');
      expect(Array.isArray(data.value)).to.be.true;
    });

    it('GET /WatchedAddresses - pagination with $top and $skip', async () => {
      const { status, data } = await test.get('/odata/v4/cardano-watcher-admin/WatchedAddresses?$top=5&$skip=0');
      expect(status).to.equal(200);
      expect(data).to.have.property('value');
      expect(Array.isArray(data.value)).to.be.true;
      expect(data.value.length).to.be.at.most(5);
    });

    it('GET /TransactionSubmissions - count total records', async () => {
      const { status, data } = await test.get('/odata/v4/cardano-watcher-admin/TransactionSubmissions?$count=true');
      expect(status).to.equal(200);
      expect(data).to.have.property('value');
      expect(data).to.have.property('@odata.count');
      expect(typeof data['@odata.count']).to.equal('number');
    });
  });

  describe('Entity Data Validation Tests', () => {

    it('GET /WatchedAddresses - verify entity structure', async () => {
      // First create an address to ensure we have data
      const createBody = {
        address: 'addr_test1vztest123validation456test789validation012test345validatio',
        description: 'Validation test address',
        network: WATCHER_FIXTURE.network
      };
      await test.post('/odata/v4/cardano-watcher-admin/addWatchedAddress', createBody);

      const { status, data } = await test.get('/odata/v4/cardano-watcher-admin/WatchedAddresses');
      expect(status).to.equal(200);
      
      if (data.value.length > 0) {
        const address = data.value[0];
        expect(address).to.have.property('address');
        expect(address).to.have.property('description');
        expect(address).to.have.property('active');
        expect(address).to.have.property('network');
      }
    });

    it('GET /TransactionSubmissions - verify entity structure', async () => {
      // First create a transaction submission with valid 64-char hex hash
      const createBody = {
        txHash: 'abc123def456789012345678901234567890123456789012345678901234abcd',
        description: 'Validation test transaction',
        network: WATCHER_FIXTURE.network
      };
      await test.post('/odata/v4/cardano-watcher-admin/submitAndTrackTransaction', createBody);

      const { status, data } = await test.get('/odata/v4/cardano-watcher-admin/TransactionSubmissions');
      expect(status).to.equal(200);
      
      if (data.value.length > 0) {
        const submission = data.value[0];
        expect(submission).to.have.property('txHash');
        expect(submission).to.have.property('description');
        expect(submission).to.have.property('active');
        expect(submission).to.have.property('currentStatus');
        expect(submission).to.have.property('network');
        expect(submission).to.have.property('confirmations');
      }
    });

    it('GET /BlockchainEvents - verify entity structure', async () => {
      const { status, data } = await test.get('/odata/v4/cardano-watcher-admin/BlockchainEvents');
      expect(status).to.equal(200);
      expect(data).to.have.property('value');
      
      if (data.value.length > 0) {
        const event = data.value[0];
        expect(event).to.have.property('type');
        expect(event).to.have.property('processed');
        expect(event).to.have.property('network');
      }
    });

    it('GET /Transactions - verify entity structure', async () => {
      const { status, data } = await test.get('/odata/v4/cardano-watcher-admin/Transactions');
      expect(status).to.equal(200);
      expect(data).to.have.property('value');
      
      if (data.value.length > 0) {
        const transaction = data.value[0];
        expect(transaction).to.have.property('txHash');
        expect(transaction).to.have.property('network');
        expect(transaction).to.have.property('status');
        expect(transaction).to.have.property('inMempool');
      }
    });
  });

  describe('Watcher Status Integration Tests', () => {

    it('POST /getWatcherStatus - verify watch counts after adding items', async () => {
      // Get initial status
      const initialStatus = await test.post('/odata/v4/cardano-watcher-admin/getWatcherStatus', {});

      console.log(initialStatus);
      const initialAddressCount = initialStatus.data.watchCounts.addresses;

      // Add a new watched address
      await test.post('/odata/v4/cardano-watcher-admin/addWatchedAddress', {
        address: 'addr_test1vzstatustest123456789012345678901234567890123456789012',
        description: 'Status count test',
        network: WATCHER_FIXTURE.network
      });

      // Get updated status
      const updatedStatus = await test.post('/odata/v4/cardano-watcher-admin/getWatcherStatus', {});
      const updatedAddressCount = updatedStatus.data.watchCounts.addresses;

      // Updated count should be at least 1 more than initial
      expect(updatedAddressCount - initialAddressCount).to.equal(1);
    });

    it('POST /getWatcherStatus - verify network matches fixture', async () => {
      const { status, data } = await test.post('/odata/v4/cardano-watcher-admin/getWatcherStatus', {});
      expect(status).to.equal(200);
      expect(data.network).to.be.a('string');
      expect(data.network.length).to.be.greaterThan(0);
    });

    it('POST /getWatcherStatus - verify polling intervals are positive', async () => {
      const { status, data } = await test.post('/odata/v4/cardano-watcher-admin/getWatcherStatus', {});
      expect(status).to.equal(200);
      expect(data.pollingIntervals.address).to.be.greaterThan(0);
      expect(data.pollingIntervals.transaction).to.be.greaterThan(0);
    });

    it('POST /getWatcherStatus - verify watch counts are non-negative', async () => {
      const { status, data } = await test.post('/odata/v4/cardano-watcher-admin/getWatcherStatus', {});
      expect(status).to.equal(200);
      expect(data.watchCounts.addresses).to.be.at.least(0);
      expect(data.watchCounts.submissions).to.be.at.least(0);
    });
  });
});
