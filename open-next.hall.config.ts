import config from "./open-next.config";
// Keep the isolated preview reproducible on hosts where Turbopack's subprocess
// listener is restricted; production retains the repository's default bundler.
const hallConfig = {
  ...config,
  buildCommand: "node node_modules/next/dist/bin/next build --webpack",
};
export default hallConfig;
