import { describe, expect, it, vi } from "vitest";
import type { GenerateContentResponse } from "@google/genai";
import { UNRESOLVED_MESSAGE } from "@/lib/platforms";
import { resolvePlatform, type Generator } from "@/lib/resolve";

function fakeGen(text: string, sources = [{ web: { uri: "https://help.example.org/report", title: "Report abuse" } }]): Generator {
  return vi.fn(async () => ({
    model: "test",
    response: { text, candidates: [{ groundingMetadata: { groundingChunks: sources } }] } as unknown as GenerateContentResponse,
  }));
}

describe("resolve_platform", () => {
  it("uses the directory without calling Gemini", async () => {
    const gen = fakeGen("{}");
    const p = await resolvePlatform("https://www.reddit.com/r/x/comments/1", gen);
    expect(p.name).toBe("Reddit");
    expect(p.source).toBe("directory");
    expect(gen).not.toHaveBeenCalled();
  });

  it("sends only the base domain — never the path or subdomain — to Gemini", async () => {
    const gen = fakeGen('{"platform":"Site A","channel":"form","target":"https://site-a.example/report","confidence":0.9}');
    await resolvePlatform("https://someuser.site-a.example/u/jordan-ellis/private-album-77", gen);
    const prompt = JSON.stringify((gen as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(prompt).toContain("site-a.example");
    expect(prompt).not.toContain("jordan-ellis");
    expect(prompt).not.toContain("private-album-77");
    expect(prompt).not.toContain("someuser");
    expect(prompt).toContain("googleSearch");
  });

  it("accepts a confident, grounded answer", async () => {
    const p = await resolvePlatform("https://site-b.example/v/1", fakeGen('Sure: {"platform":"Site B","channel":"email","target":"abuse@site-b.example","confidence":0.85}'));
    expect(p).toMatchObject({ name: "Site B", channel: "email", target: "abuse@site-b.example", source: "search" });
    expect(p.sources?.[0].uri).toBe("https://help.example.org/report");
  });

  it.each([
    ["confidence below 0.7", '{"platform":"C","channel":"form","target":"https://c.example/r","confidence":0.6}', undefined],
    ["no grounding sources", '{"platform":"C","channel":"form","target":"https://c.example/r","confidence":0.95}', []],
    ["malformed email", '{"platform":"C","channel":"email","target":"abuse at c","confidence":0.9}', undefined],
    ["non-https form", '{"platform":"C","channel":"form","target":"http://c.example/r","confidence":0.9}', undefined],
    ["unparseable reply", "I think you should email them", undefined],
    ["target on an unrelated domain", '{"platform":"C","channel":"form","target":"https://report-portal.example-phish.com/c","confidence":0.95}', undefined],
  ])("never guesses: %s → Couldn't confirm", async (_label, text, sources) => {
    const host = `site-${Math.random().toString(36).slice(2)}.example`;
    const p = await resolvePlatform(`https://${host}/x`, fakeGen(text, sources as never));
    expect(p.source).toBe("unresolved");
    expect(p.channel).toBeNull();
    expect(p.message).toBe(UNRESOLVED_MESSAGE);
  });

  it("accepts a sister domain of the site, and takes the last JSON block after prose", async () => {
    const p = await resolvePlatform(
      "https://www.site-d.com/v/1",
      fakeGen('Found it {see below}. Details: {"note": 1}\n{"platform":"Site D","channel":"form","target":"https://info.site-d.net/takedown","confidence":0.9}'),
    );
    expect(p).toMatchObject({ source: "search", target: "https://info.site-d.net/takedown" });
  });

  it("returns unresolved when Gemini errors", async () => {
    const p = await resolvePlatform("https://site-err.example/x", vi.fn(async () => { throw new Error("503"); }));
    expect(p.source).toBe("unresolved");
  });
});

describe("resolve_platform retries an ungrounded answer once", () => {
  it("asks again when the model skipped the search", async () => {
    const answer = '{"platform":"Site R","channel":"form","target":"https://site-r.example/abuse","confidence":0.9}';
    let calls = 0;
    const gen: Generator = async () => {
      calls++;
      const chunks = calls === 1 ? [] : [{ web: { uri: "https://site-r.example/help", title: "site-r.example" } }];
      return { model: "t", response: { text: answer, candidates: [{ groundingMetadata: { groundingChunks: chunks } }] } as unknown as GenerateContentResponse };
    };
    const p = await resolvePlatform("https://blog.site-r.example/post/1", gen);
    expect(calls).toBe(2);
    expect(p).toMatchObject({ source: "search", target: "https://site-r.example/abuse" });
  });
});
