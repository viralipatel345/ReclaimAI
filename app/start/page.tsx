import { ChatOnboarding } from "@/components/chat/ChatOnboarding";

// Onboarding as one iMessage-style thread. The gate underneath is unchanged: adults only,
// links only, ID check and signed attestation before anything is drafted.
export default function StartPage() {
  return <ChatOnboarding />;
}
