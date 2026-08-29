/** DOM test setup. Node-environment worker suites remain unaffected. */
import { afterEach } from "vitest";

afterEach(() => {
  if (typeof document !== "undefined") document.body.innerHTML = "";
});
