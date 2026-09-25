// Hard rule 3: under-18 → stop, hand off to NCMEC Take It Down, store nothing.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NCMEC_TAKE_IT_DOWN_URL } from "@/lib/config";

const mem = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    get length() {
      return m.size;
    },
  };
};

describe("age gate", () => {
  let localStorage: ReturnType<typeof mem>;
  let sessionStorage: ReturnType<typeof mem>;
  const fetchMock = vi.fn<(input: unknown, init?: RequestInit) => Promise<Response>>(async () => new Response(null, { status: 204 }));

  beforeEach(() => {
    vi.resetModules();
    localStorage = mem();
    sessionStorage = mem();
    vi.stubGlobal("window", { localStorage, sessionStorage });
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockClear();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("isAdult=false: routes to the NCMEC hand-off and stores nothing", async () => {
    const { chooseAge, UNDER_18_ROUTE } = await import("@/lib/ageGate");
    const { getCase } = await import("@/lib/useCase");
    sessionStorage.setItem("anything", "1");
    expect(chooseAge("minor")).toBe(UNDER_18_ROUTE);
    expect(getCase()).toBeNull();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    // no case was ever synced to the server
    expect(fetchMock.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === "PUT")).toBe(false);
  });

  it("a minor who already started a case: the case and its server copy are deleted", async () => {
    const { setCase } = await import("@/lib/useCase");
    const { createBlankCase } = await import("@/lib/seed");
    const { chooseAge } = await import("@/lib/ageGate");
    const c = createBlankCase();
    setCase(c);
    expect(localStorage.length).toBe(1);
    chooseAge("minor");
    expect(localStorage.length).toBe(0);
    const deletes = fetchMock.mock.calls.filter(([, init]) => String((init as RequestInit | undefined)?.body ?? "").includes('"delete":true'));
    expect(deletes.some(([, init]) => String((init as RequestInit).body).includes(c.id))).toBe(true);
  });

  it("adults get a case and go to step 01", async () => {
    const { chooseAge } = await import("@/lib/ageGate");
    const { getCase } = await import("@/lib/useCase");
    expect(chooseAge("adult")).toBe("/case");
    expect(getCase()?.isAdult).toBe(true);
  });

  it("the hand-off points to NCMEC Take It Down", () => {
    expect(NCMEC_TAKE_IT_DOWN_URL).toBe("https://takeitdown.ncmec.org");
  });
});

describe("server never stores an under-18 case", () => {
  it("PUT /api/case refuses isAdult=false", async () => {
    const { PUT } = await import("@/app/api/case/route");
    const { serverStore } = await import("@/lib/store");
    const res = await PUT(new Request("http://x/api/case", { method: "PUT", body: JSON.stringify({ id: "case_minor", isAdult: false, links: [] }) }));
    expect(res.status).toBe(400);
    expect(await serverStore.get("case_minor")).toBeNull();
  });
});
