/**
 * @odatano/watch - Cardano Blockchain Watcher Plugin for CAP
 * 
 * This file exposes the plugin's CDS models to consuming applications.
 * Applications can use these models by importing:
 * 
 * using { odatano.watch as watch } from '@odatano/watch';
 */

// Export the base schema
using from './db/schema';

// Export the admin service
using from './srv/admin-service';
