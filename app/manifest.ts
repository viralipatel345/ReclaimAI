import type { MetadataRoute } from "next";

// Installable PWA. share_target lets Android "Share → Reclaim" open
// /share?url=…&text=…&title=… — text params only, so images can never be shared in.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Reclaim",
    short_name: "Reclaim",
    description: "Enforce your 48-hour takedown right. Links only.",
    start_url: "/case/tracker",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F5F2EE",
    theme_color: "#F5F2EE",
    categories: ["utilities", "productivity"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    share_target: {
      action: "/share",
      method: "GET",
      params: { url: "url", text: "text", title: "title" },
    },
  } as MetadataRoute.Manifest;
}
