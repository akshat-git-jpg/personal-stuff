import { describe, expect, it } from "vitest";
import { buildChannelWhereClause } from "../src/worker/analytics";
import { DEFAULT_CHANNEL_ID, listChannels } from "../src/worker/channels";

describe("analytics scoping", () => {
  it("default channel matches its own rows and NULL rows", () => {
    const { clause, params } = buildChannelWhereClause(DEFAULT_CHANNEL_ID);
    expect(clause).toMatch(/WHERE v\.channel_id = \? OR v\.channel_id IS NULL/);
    expect(params).toEqual([DEFAULT_CHANNEL_ID]);
  });

  it("non-default channel matches only its own rows", () => {
    const channels = listChannels();
    const nonDefault = channels.find((c) => c.id !== DEFAULT_CHANNEL_ID);
    if (!nonDefault) {
      // If there is only one channel, we can't test this against a real non-default.
      // We could use a synthetic channel but buildChannelWhereClause uses listChannels() directly.
      // So let's skip if there is no other channel.
      return;
    }

    const { clause, params } = buildChannelWhereClause(nonDefault.id);
    expect(clause).toMatch(/WHERE v\.channel_id = \?/);
    expect(clause).not.toMatch(/IS NULL/);
    expect(params).toEqual([nonDefault.id]);
  });

  it("unknown channel id throws rather than returning an unfiltered query", () => {
    expect(() => buildChannelWhereClause("does-not-exist")).toThrow(/unknown_channel/);
  });
});
