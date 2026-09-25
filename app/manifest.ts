import type { MetadataRoute } from "next";

// share_target lets Android "Share → Reclaim" open /share?url=…&text=…&title=…
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Reclaim",
    short_name: "Reclaim",
    description: "Enforce your 48-hour takedown right.",
    start_url: "/case/tracker",
    display: "standalone",
    background_color: "#F5F2EE",
    theme_color: "#F5F2EE",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
    share_target: {
      action: "/share",
      method: "GET",
      params: { url: "url", text: "text", title: "title" },
    },
  } as MetadataRoute.Manifest;
}
