import cds from "@sap/cds";

// Require the compiled main plugin code (available after build/publish)
const watcher = require("./dist/index.js");

const COMPONENT_NAME = "/watch/plugin";

/**
 * CAP plugin bootstrap – auto-discovered via cds-plugin.js in package root
 * 
 * Only initialize during runtime (serve/watch/run), not during cds build
 */
if ((cds as any).build) {
  // Export nothing during build to avoid side effects
  module.exports = {};
} else {
  /**
   * Async factory exported for CAP – called automatically on boot
   */
  module.exports = async () => {
    try {
      await watcher.default.initialize();
      cds.log(COMPONENT_NAME).info("ODATANO Watch plugin loaded and initialized successfully");
    } catch (err) {
      cds.log(COMPONENT_NAME).error("Failed to initialize ODATANO Watch plugin:", err);
      throw err;
    }
  };
}