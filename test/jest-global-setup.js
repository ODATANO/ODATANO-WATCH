/**
 * Jest Global Setup
 *
 * Creates a self-referencing symlink so that '@odatano/watch/srv/admin-service'
 * resolves to the project root during local testing.
 *
 * CAP's factory.js uses require.resolve() to load @impl paths.
 * Package-qualified paths like '@odatano/watch/srv/...' need the package
 * to exist in node_modules. This junction makes that work locally.
 */
const fs = require('fs');
const path = require('path');

module.exports = async function () {
  const root = path.resolve(__dirname, '..');
  const scopeDir = path.join(root, 'node_modules', '@odatano');
  const linkPath = path.join(scopeDir, 'watch');

  if (!fs.existsSync(linkPath)) {
    fs.mkdirSync(scopeDir, { recursive: true });
    fs.symlinkSync(root, linkPath, 'junction');
  }
};
