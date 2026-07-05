import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ADHV",
    short_name: "ADHV",
    description:
      "Get started when your brain won't — an AI body double that sits with you until it's done.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: "#F5F0E6",
    theme_color: "#0F1F34",
    orientation: "portrait",
    icons: [
      {
        src: "/api/icon?size=192",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/api/icon?size=512",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/api/icon?size=512&maskable=1",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
