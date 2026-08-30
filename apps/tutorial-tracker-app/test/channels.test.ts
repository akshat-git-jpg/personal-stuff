import { describe, expect, it } from "vitest";
import registry from "../../../config/channels.json";
import { DEFAULT_CHANNEL_ID, channelIdOf, getChannel, linkDomainFor, listChannels } from "../src/worker/channels";

describe("channel resolution", () => {
  it("lists at least the default channel", () => {
    expect(listChannels().length).toBeGreaterThan(0);
  });

  it("hides archived channels from the picker but still resolves them", () => {
    const archived = registry.channels.filter((c) => c.archived).map((c) => c.id);
    for (const id of archived) {
      expect(listChannels().map((c) => c.id)).not.toContain(id);
      expect(getChannel(id).id).toBe(id);
    }
  });

  it("throws on an unknown channel id", () => {
    expect(() => getChannel("does-not-exist")).toThrow(/CHANNEL_UNKNOWN/);
  });

  it("treats a card with no channel_id as the default channel", () => {
    expect(channelIdOf({})).toBe(DEFAULT_CHANNEL_ID);
    expect(channelIdOf({ channel_id: null })).toBe(DEFAULT_CHANNEL_ID);
    expect(channelIdOf({ channel_id: "  " })).toBe(DEFAULT_CHANNEL_ID);
    expect(channelIdOf({ channel_id: "agrollo" })).toBe("agrollo");
  });

  // GATE. linkDomainFor must READ the registry, not return a constant.
  //
  // Asserting only against the shipped file would be VACUOUS while one channel is
  // seeded: a hardcoded "go.agrolloo.com" is the one right answer. So the gate
  // resolves a SYNTHETIC channel that is not in the file and cannot be guessed.
  it("resolves each channel's own link domain from the registry", () => {
    for (const c of registry.channels) {
      expect(
        linkDomainFor(c.id),
        `CHANNEL_DOMAIN_NOT_RESOLVED: linkDomainFor(${c.id}) must return ${c.link_domain}`,
      ).toBe(c.link_domain);
    }

    const probe = { ...registry.channels[0], id: "__probe__", link_domain: "go.probe.test" };
    const synthetic = [...registry.channels, probe];
    expect(
      linkDomainFor("__probe__", synthetic),
      "CHANNEL_DOMAIN_NOT_RESOLVED: linkDomainFor must read the channel it is given, not a constant",
    ).toBe("go.probe.test");
    expect(
      linkDomainFor(registry.channels[0].id, synthetic),
      "CHANNEL_DOMAIN_NOT_RESOLVED: resolution must stay per-channel",
    ).toBe(registry.channels[0].link_domain);
  });
});
