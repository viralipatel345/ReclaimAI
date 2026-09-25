// Server: Gemini reads ONE post's text and calls flag_post. Rules stay authoritative
// (see combineLevels); Gemini explains, and can only ask her to look at an unflagged post.
import { runAgent } from "./agent";
import { MODELS } from "./config";
import { combineLevels, ruleLevel, ruleSignals, type DetectContext, type Detection, type MatchLevel, type PostText } from "./detect";

export type PostClassifier = (post: PostText, ctx: DetectContext) => Promise<{ level?: string; explanation?: string }>;

const SYSTEM = `You help a survivor of non-consensual intimate imagery find more posts of her content on an account she already reported.
You see ONLY text from one post: caption/title and comments. You never see images and must not guess or describe what an image shows.
likely = the text names or tags her, links to content she already reported, or says it re-posts removed content.
possible = weaker hints (first name only, initials, "is that…?" comments).
unrelated = nothing in the text connects the post to her.
Be conservative. Call flag_post exactly once.`;

const defaultClassifier: PostClassifier = async (post, ctx) => {
  const run = await runAgent<{ level?: string; explanation?: string }>({
    model: MODELS.primary, // Gemini 3.1 Pro: judgment call
    systemInstruction: SYSTEM,
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `Her name: ${ctx.legalName}\nContent she already reported: ${ctx.knownUrls.join(", ")}\nPlatforms she reported to: ${ctx.platformNames.join(", ")}\n\nPost caption: ${post.caption}\nComments:\n${post.comments.map((c) => `- @${c.user}: ${c.text}`).join("\n") || "(none)"}`,
          },
        ],
      },
    ],
    tools: ["flag_post"],
    finalTool: "flag_post",
    maxSteps: 2,
  });
  return run.output;
};

const LEVELS: MatchLevel[] = ["likely", "possible", "unrelated"];

export async function detectPost(post: PostText, ctx: DetectContext, classifier: PostClassifier = defaultClassifier): Promise<Detection> {
  const signals = ruleSignals(post, ctx);
  const rule = ruleLevel(signals);
  try {
    const out = await classifier(post, ctx);
    const model = LEVELS.includes(out.level as MatchLevel) ? (out.level as MatchLevel) : undefined;
    const explanation = String(out.explanation ?? "").replace(/https?:\/\/\S+/g, "").trim().slice(0, 220);
    return {
      postId: post.id,
      url: post.url,
      level: combineLevels(rule, model),
      signals: signals.map((s) => s.text),
      explanation: explanation || signals[0]?.text || "Nothing in the text connects this post to you.",
      source: "gemini",
    };
  } catch {
    return {
      postId: post.id,
      url: post.url,
      level: rule,
      signals: signals.map((s) => s.text),
      explanation: signals[0]?.text ?? "Nothing in the text connects this post to you.",
      source: "rules",
    };
  }
}
