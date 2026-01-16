import cds from "@sap/cds";
import cardanoWatcher from "./src/index";

const COMPONENT_NAME = "/cardanoWatcher/plugin";

const isServe = (cds as any).cli?.command === "serve";
const isBuild = (cds as any).build?.register;

// Only run during serve, not during build/compile
if (isBuild && !isServe) {
  module.exports = {};
} else if (Object.keys(cds.env.cardanoWatcher ?? {}).length) {
  module.exports = cardanoWatcher.initialize().catch((err: Error) => {
    cds.log(COMPONENT_NAME).error("Failed to initialize Cardano Watcher plugin:", err);
    throw err;
  });
} else {
  module.exports = {};
}
