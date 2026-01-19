import cds from '@sap/cds';

const logger = cds.log('ODATANO-WATCH');

let initialized = false;

/**
 * CAP Plugin registration for @odatano/watch
 * This is executed when the plugin is loaded
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

logger.debug('Plugin registered');

/**
 * Initialize the watcher when services are served
 */
cds.on('served', async () => {
  if (initialized) return;
  
  logger.debug('Plugin activation triggered');
  
  try {
    // Import the watcher module
    const watcher = await import('./index.js');
    
    // Initialize the watcher with the application's database
    await watcher.initialize();
    
    logger.info('Plugin initialized successfully');
    initialized = true;
  } catch (err) {
     // Don't throw a erro, just log it - plugin failure shouldn't crash the main app
    logger.error('Failed to initialize plugin:', err);
  }
});

/**
 * Graceful shutdown handler
 */
cds.on('shutdown', async () => {
  if (!initialized) return;
  
  try {
    logger.debug('Shutting down...');
    const watcher = await import('./index.js');
    await watcher.stop();
    logger.info('stopped');
  } catch (err) {
    logger.error('Error during shutdown:', err);
  }
});

export {};
