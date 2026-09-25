import { isDemoMode } from "@/lib/config";

// Gmail send stub. Real sending would use the Gmail API with the user's OAuth grant, and
// only for requests covered by her one-time auto-send consent. It is intentionally not
// implemented: until it is, the client falls back to opening a draft for her to send.
export async function POST() {
  if (isDemoMode()) return Response.json({ sent: true, simulated: true });
  return Response.json({ sent: false, reason: "Gmail sending isn't connected yet — open the draft to send it yourself." }, { status: 501 });
}
