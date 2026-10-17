// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NewVideoDialog } from "../src/client/NewVideoDialog";
import { CardDetail } from "../src/client/CardDetail";
import { AssignmentDefaults } from "../src/client/AssignmentDefaults";
import { MyWork } from "../src/client/MyWork";
import { ReviewQueue } from "../src/client/ReviewQueue";
import { TeamPanel } from "../src/client/TeamPanel";
import { Board } from "../src/client/Board";
import { getReviewQueue, getTeam, testable_setChannels, type BoardRow, type ReviewItem, type TeamMember } from "../src/client/api";
import { sectionsForPipeline, STATUS_COLS } from "../src/client/CardDetailUtils";
import { getPipeline } from "../src/client/stages";
import type { Column } from "../src/shared/columns";
import type { Transition } from "../src/shared/engine/rbac";

type Route = { status?: number; body: unknown };
/** Longest-prefix URL stub that records every call (method + body). */
function stubFetch(routes: Record<string, Route>) {
  const calls: { url: string; method: string; body?: unknown }[] = [];
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    calls.push({ url: String(url), method, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const key = Object.keys(routes).sort((a, b) => b.length - a.length).find((k) => {
      const [m, path] = k.includes(" ") ? k.split(" ") : ["GET", k];
      return m === method && String(url).startsWith(path);
    });
    if (!key) return { ok: false, status: 404, json: async () => ({}) } as Response;
    const status = routes[key].status ?? 200;
    return { ok: status < 400, status, json: async () => routes[key].body } as Response;
  });
  global.fetch = fn as unknown as typeof fetch;
  return calls;
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); testable_setChannels(null); });

const CHANNELS = { channels: [{ id: "agrollo", name: "Agrollo", handle: "@a", link_domain: "go.agrolloo.com" }], default_channel_id: "agrollo" };
const optionValues = (el: HTMLElement) => Array.from((el as HTMLSelectElement).options).map((o) => o.value);

describe("NewVideoDialog: doer vs reviewer, no-reviewer warning", () => {
  const PIPES = [{ id: "standard", name: "Standard", stages: [] }];
  const names = { "alice@x.com": "Alice", "rob@x.com": "Rob" };
  function open(memberships: Record<string, Record<string, string[]>>) {
    testable_setChannels(CHANNELS);
    stubFetch({ "/api/defaults/resolve": { body: {} } });
    render(<NewVideoDialog open onOpenChange={() => {}} pipelines={PIPES} defaultPipeline="standard" names={names} memberRoles={{}} memberships={memberships} onCreated={() => {}} />);
  }

  it("drops the chosen doer from that stage's reviewer list, and vice versa", async () => {
    open({ "alice@x.com": { standard: ["Script Recorder", "Reviewer"] }, "rob@x.com": { standard: ["Script Recorder", "Reviewer"] } });
    await screen.findByText(/The people/);
    const doer = document.getElementById("nv-script_writer_email") as HTMLElement;
    fireEvent.change(doer, { target: { value: "alice@x.com" } });
    const reviewer = document.getElementById("nv-script_reviewer_email") as HTMLElement;
    expect(optionValues(reviewer)).not.toContain("alice@x.com");
    expect(optionValues(reviewer)).toContain("rob@x.com");
    fireEvent.change(reviewer, { target: { value: "rob@x.com" } });
    expect(optionValues(document.getElementById("nv-script_writer_email") as HTMLElement)).not.toContain("rob@x.com");
  });

  it("warns when the system has nobody holding Reviewer", async () => {
    open({ "alice@x.com": { standard: ["Script Recorder"] } });
    expect((await screen.findByTestId("no-reviewer-warning")).textContent).toContain("Nobody can review in Standard");
  });

  it("shows no warning when a Reviewer exists", async () => {
    open({ "rob@x.com": { standard: ["Reviewer"] } });
    await screen.findByText(/The video/);
    expect(screen.queryByTestId("no-reviewer-warning")).toBeNull();
  });
});

describe("CardDetail: reviewer select", () => {
  const p = getPipeline("standard");
  const columns = [...sectionsForPipeline(p.stages).assigneeSeq, ...STATUS_COLS, "video_title"] as Column[];
  const names = { "alice@x.com": "Alice", "rob@x.com": "Rob", "cat@x.com": "Cat" };
  const memberships = {
    "alice@x.com": { standard: ["Script Recorder", "Reviewer"] },
    "rob@x.com": { standard: ["Script Recorder", "Reviewer"] },
    "cat@x.com": { standard: ["Script Recorder", "Reviewer"] },
  };
  function show(scriptStatus: string) {
    const row = {
      row_id: "r1", pipeline: "standard", channel_id: "", video_title: "Vid", topic_status: "Done",
      script_status: scriptStatus, script_writer_email: "alice@x.com", script_reviewer_email: "rob@x.com",
    } as unknown as BoardRow;
    render(<CardDetail row={row} columns={columns} roles={["Admin"]} names={names} memberships={memberships} contextStageId="topic" onClose={() => {}} onSaved={() => {}} />);
  }

  it("excludes the stage's doer from its reviewer options and the reviewer from its doer options", () => {
    show("In Progress");
    const rev = document.getElementById("f-script_reviewer_email") as HTMLElement;
    const doer = document.getElementById("f-script_writer_email") as HTMLElement;
    expect(optionValues(rev)).not.toContain("alice@x.com");
    expect(optionValues(rev)).toContain("cat@x.com");
    expect(optionValues(doer)).not.toContain("rob@x.com");
  });

  it("offers 'No review' outside In Review", () => {
    show("In Progress");
    const empty = (document.getElementById("f-script_reviewer_email") as HTMLSelectElement).options[0];
    expect(empty.textContent).toContain("No review");
    expect(empty.disabled).toBe(false);
  });

  it("won't let the reviewer be cleared while In Review", () => {
    show("In Review");
    const empty = (document.getElementById("f-script_reviewer_email") as HTMLSelectElement).options[0];
    expect(empty.textContent).not.toContain("No review");
    expect(empty.disabled).toBe(true);
  });
});

describe("AssignmentDefaults", () => {
  const TEAM: TeamMember[] = [
    { name: "Alice", email: "alice@x.com", role: "", memberships: { standard: ["Script Recorder", "Reviewer"] } },
    { name: "Rob", email: "rob@x.com", role: "", memberships: { standard: ["Reviewer"] } },
  ];
  it("shows a saved default nobody eligible holds as invalid, not as nobody", async () => {
    stubFetch({
      "/api/defaults/cols": { body: ["script_writer_email"] },
      "/api/defaults": { body: [{ col: "script_writer_email", email: "ghost@x.com" }] },
      "/api/team": { body: TEAM },
    });
    render(<AssignmentDefaults system="standard" />);
    expect(await screen.findByTestId("default-invalid-script_writer_email")).toBeTruthy();
    const sel = screen.getByLabelText(/^Default/) as HTMLSelectElement;
    expect(sel.value).toBe("ghost@x.com");
    expect(sel.selectedOptions[0].textContent).toContain("not eligible");
  });

  it("keeps the stage's doer out of its reviewer options", async () => {
    stubFetch({
      "/api/defaults/cols": { body: ["script_writer_email", "script_reviewer_email"] },
      "/api/defaults": { body: [{ col: "script_writer_email", email: "alice@x.com" }] },
      "/api/team": { body: TEAM },
    });
    render(<AssignmentDefaults system="standard" />);
    const row = await screen.findByTestId("default-row-script_reviewer_email");
    const values = optionValues(within(row).getByRole("combobox"));
    expect(values).toContain("rob@x.com");
    expect(values).not.toContain("alice@x.com");
  });
});

function boardRow(fields: Record<string, unknown>): BoardRow {
  return { row_id: "r", pipeline: "standard", channel_id: "", ...fields } as unknown as BoardRow;
}
const noop = () => {};
function myWork(rows: BoardRow[], opts: { queueItems?: ReviewItem[]; readOnly?: boolean; transitions?: (r: BoardRow, c: string) => Transition[] } = {}) {
  render(<MyWork queueItems={opts.queueItems ?? []} onOpenQueueItem={noop} onQueueAction={noop} rows={rows} readOnly={opts.readOnly}
    handleDelete={noop} openDetail={noop} doAction={noop} transitionsForStageCol={opts.transitions ?? (() => [])} onSaveField={noop} />);
}

describe("MyWork", () => {
  it("files an Uploaded upload stage under Done", () => {
    myWork([boardRow({ row_id: "u1", video_title: "Shipped", yt_upload_status: "Uploaded", _stages: ["yt_upload_status"] })]);
    expect(screen.getByText("Done")).toBeTruthy();
    expect(screen.queryByText("Your turn")).toBeNull();
  });

  it("puts an In Review stage with no reviewer under Your turn", () => {
    const complete: Transition = { stageId: "script", statusCol: "script_status", to: "Done", label: "Complete", kind: "advance", by: "doer" };
    myWork([boardRow({ row_id: "s1", video_title: "Stuck", script_status: "In Review", _stages: ["script_status"] })],
      { transitions: () => [complete] });
    expect(screen.getByText("Your turn")).toBeTruthy();
    expect(screen.queryByText("Waiting on reviewer")).toBeNull();
    expect(screen.getByRole("button", { name: "Complete" })).toBeTruthy();
  });

  it("keeps an In Review stage with a reviewer under Waiting on reviewer", () => {
    myWork([boardRow({ row_id: "s2", video_title: "Waiting", script_status: "In Review", _stages: ["script_status"] })]);
    expect(screen.getByText("Waiting on reviewer")).toBeTruthy();
  });

  it("shows the empty state when only upcoming stages exist", () => {
    myWork([boardRow({ row_id: "x", video_title: "Later", thumbnail_status: "To Do", _upcoming: ["thumbnail_status"] })]);
    expect(screen.getByText(/Nothing needs you right now/)).toBeTruthy();
  });

  it("sorts by each stage's own ETA column", () => {
    myWork([
      boardRow({ row_id: "a", video_title: "Late one", tutorial_status: "To Do", tutorial_eta: "2026-12-01", _stages: ["tutorial_status"] }),
      boardRow({ row_id: "b", video_title: "Soon one", video_editor_status: "To Do", video_editor_eta: "2026-10-20", _stages: ["video_editor_status"] }),
    ]);
    expect(screen.getByTestId("quiet-job").textContent).toContain("Late one");
  });

  it("hides queue actions in view-as (readOnly)", () => {
    const approve: Transition = { stageId: "script", statusCol: "script_status", to: "Done", label: "Approve", kind: "approve", by: "reviewer" };
    const row = boardRow({ row_id: "q", video_title: "Q", script_status: "In Review", _actions: [{ stageId: "script", statusCol: "script_status", transitions: [approve] }] });
    const item: ReviewItem = { row_id: "q", video_title: "Q", stageId: "script", stage: "Script", statusCol: "script_status", submittedBy: "", submittedByName: "", row };
    myWork([], { queueItems: [item], readOnly: true });
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
  });
});

describe("ReviewQueue readOnly", () => {
  const approve: Transition = { stageId: "script", statusCol: "script_status", to: "Done", label: "Approve", kind: "approve", by: "reviewer" };
  const row = boardRow({ row_id: "q", video_title: "Q", _actions: [{ stageId: "script", statusCol: "script_status", transitions: [approve] }] });
  const item: ReviewItem = { row_id: "q", video_title: "Q", stageId: "script", stage: "Script", statusCol: "script_status", submittedBy: "", submittedByName: "", row };
  it("shows Approve normally", () => {
    render(<ReviewQueue items={[item]} onOpen={noop} />);
    expect(screen.getByRole("button", { name: "Approve" })).toBeTruthy();
  });
  it("hides the action row when readOnly", () => {
    render(<ReviewQueue items={[item]} onOpen={noop} readOnly />);
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
  });
});

describe("api: failed loads throw instead of returning empty", () => {
  it("getTeam rejects on non-OK", async () => {
    stubFetch({ "/api/team": { status: 500, body: {} } });
    await expect(getTeam()).rejects.toThrow();
  });
  it("getReviewQueue rejects on non-OK", async () => {
    stubFetch({ "/api/review-queue": { status: 500, body: {} } });
    await expect(getReviewQueue()).rejects.toThrow();
  });
});

describe("Board review queue refresh", () => {
  it("toasts instead of blanking when the queue fails to load", async () => {
    testable_setChannels(CHANNELS);
    stubFetch({ "/api/review-queue": { status: 500, body: {} } });
    render(<Board roles={["Reviewer"]} stages={[]} pipelines={[]} columns={[]} rows={[]} names={{}} reload={noop} />);
    expect(await screen.findByText("Couldn't refresh your review queue")).toBeTruthy();
  });
});

describe("TeamPanel", () => {
  const PIPES = [{ id: "standard", name: "Standard", stages: [] }];
  const base = { "/api/roles": { body: ["Video Editor", "Reviewer"] }, "/api/defaults/cols": { body: [] }, "/api/defaults": { body: [] } };

  async function addPerson(email: string) {
    fireEvent.click(await screen.findByRole("button", { name: /Add to Standard/ }));
    fireEvent.change(screen.getByPlaceholderText("Full name"), { target: { value: "Bob" } });
    fireEvent.change(screen.getByPlaceholderText("name@email.com"), { target: { value: email } });
    fireEvent.click(await screen.findByRole("button", { name: "Video Editor" }));
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
  }

  it("refuses to save when the team failed to load", async () => {
    const calls = stubFetch({ ...base, "/api/team": { status: 500, body: {} } });
    render(<TeamPanel pipelines={PIPES} />);
    await waitFor(() => expect(screen.queryByText("Loading…")).toBeNull());
    await addPerson("bob@x.com");
    expect(await screen.findByText(/team didn't load/)).toBeTruthy();
    expect(calls.some((c) => c.method === "POST" && c.url === "/api/team")).toBe(false);
  });

  it("matches an existing member case-insensitively, keeping their other systems", async () => {
    const team: TeamMember[] = [
      { name: "Bob", email: "Bob@X.com", role: "", memberships: { "tut-2": ["Reviewer"] } },
      { name: "Rev", email: "rev@x.com", role: "", memberships: { standard: ["Reviewer"] } },
    ];
    const calls = stubFetch({ ...base, "/api/team": { body: team }, "POST /api/team": { body: {} } });
    render(<TeamPanel pipelines={PIPES} />);
    await screen.findByText("Rev");
    await addPerson("bob@x.com");
    await waitFor(() => expect(calls.some((c) => c.method === "POST" && c.url === "/api/team")).toBe(true));
    const post = calls.find((c) => c.method === "POST" && c.url === "/api/team")!;
    expect((post.body as { memberships: Record<string, string[]> }).memberships["tut-2"]).toEqual(["Reviewer"]);
  });

  it("warns when the system has no Reviewer", async () => {
    stubFetch({ ...base, "/api/team": { body: [{ name: "Ed", email: "ed@x.com", role: "", memberships: { standard: ["Video Editor"] } }] } });
    render(<TeamPanel pipelines={PIPES} />);
    expect((await screen.findByTestId("no-reviewer-warning")).textContent).toContain("Nobody can review in Standard");
  });

  it("shows no warning when someone reviews there", async () => {
    stubFetch({ ...base, "/api/team": { body: [{ name: "Rev", email: "rev@x.com", role: "", memberships: { standard: ["Reviewer"] } }] } });
    render(<TeamPanel pipelines={PIPES} />);
    await screen.findByText("Rev");
    expect(screen.queryByTestId("no-reviewer-warning")).toBeNull();
  });
});
