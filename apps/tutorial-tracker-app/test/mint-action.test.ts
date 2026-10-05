import { describe, it, expect } from "vitest";
import { mintAction } from "../src/worker/clickstore";

describe("mintAction", () => {
  it("inserts a link that does not exist yet", () => {
    expect(mintAction(undefined, "affiliate")).toBe("insert");
    expect(mintAction(undefined, "external")).toBe("insert");
  });
  it("upgrades an old external link once the programme has an affiliate URL", () => {
    expect(mintAction({ kind: "external" }, "affiliate")).toBe("upgrade");
    expect(mintAction({ kind: null }, "affiliate")).toBe("upgrade");
  });
  it("never touches an existing affiliate link or downgrades to external", () => {
    expect(mintAction({ kind: "affiliate" }, "affiliate")).toBe("skip");
    expect(mintAction({ kind: "affiliate" }, "external")).toBe("skip");
    expect(mintAction({ kind: "external" }, "external")).toBe("skip");
  });
});
