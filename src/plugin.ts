import cds from '@sap/cds';

const LOG = cds.log('@odatano/watch');
const DEBUG = cds.debug('@odatano/watch');

let initialized = false;

/**
 * CAP Plugin registration for @odatano/watch
 * This is executed when the plugin is loaded (not at 'served' event)
 */

// Register watcher service kind
if (!cds.env.requires) {
  (cds.env as any).requires = {};
}

if (!cds.env.requires.kinds) {
  (cds.env.requires as any).kinds = {};
}

// Register cardano-watcher service kind
(cds.env.requires as any).kinds['cardano-watcher'] = {
  impl: '@odatano/watch',
};

DEBUG?.('Plugin registered: cardano-watcher service kind');

/**
 * Initialize the watcher when services are served
 */
cds.on('served', async () => {
  if (initialized) return;
  
  DEBUG?.('Plugin activation: cds.on("served") triggered');
  
  try {
    // Import the watcher module
    const watcher = await import('./index.js');
    
    // Initialize the watcher with the application's database
    await watcher.initialize();
    
    LOG.info('ODATANO Watch plugin initialized successfully');
    initialized = true;
  } catch (err) {
    LOG.error('Failed to initialize ODATANO Watch plugin:', err);
    // Don't throw - plugin failure shouldn't crash the app
    LOG.warn('Cardano Watcher functionality will not be available');
  }
});

/**
 * Graceful shutdown handler
 */
cds.on('shutdown', async () => {
  if (!initialized) return;
  
  try {
    LOG.info('Shutting down Cardano Watcher...');
    const watcher = await import('./index.js');
    await watcher.stop();
    LOG.info('Cardano Watcher stopped');
  } catch (err) {
    LOG.error('Error during shutdown:', err);
  }
});

export {};
