// Keyword fallback for classifying a platform reply. Pure: usable on client and server.
import type { ParsedReply } from "./followups";

const IMAGE_REQUEST = /\b(send|upload|attach|provide|share)\b[^.]{0,60}\b(image|images|photo|photos|picture|pictures|video|videos|screenshot|screenshots|copy of the (?:image|photo|video))\b/i;

/** Keyword fallback when Gemini is unavailable. Order matters: rejections often mention "removed". */
export function classifyReplyByRules(text: string): Omit<ParsedReply, "source"> {
  const t = text.toLowerCase();
  const asksForImages = IMAGE_REQUEST.test(text);
  if (/(does not|doesn't|did not|didn't) (violate|go against)|not (in )?violation|(unable|not able) to (take action|remove)|we (won't|will not|cannot|can't) remove|declin(e|ed) to|no action (will be|was) taken/.test(t))
    return { status: "rejected", summary: "The platform says it won't remove the content.", asksForImages };
  if (/(has|have) (been )?(removed|taken down|disabled)|was (removed|taken down|disabled)|we (removed|took down|disabled)|no longer (available|accessible)/.test(t))
    return { status: "removed", summary: "The platform says the content was removed.", asksForImages };
  if (/(received|we('re| are) (reviewing|looking)|under review|ticket|case (number|id|#)|thank you for (your )?report|will (review|get back))/.test(t))
    return { status: "acknowledged", summary: "The platform confirmed it received the request and is reviewing it.", asksForImages };
  return { status: "unclear", summary: "The reply doesn't clearly say what the platform decided.", asksForImages };
}

