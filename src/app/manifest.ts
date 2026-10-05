import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ADOLF v3.0",
    short_name: "ADOLF v3.0",
    description: "Personal WhatsApp CRM",
    start_url: "/inbox",
    display: "standalone",
    background_color: "#050506",
    theme_color: "#050506",
    icons: [
      { src: "/icon.svg", sizes: "1024x1024", type: "image/svg+xml", purpose: "any" },
      { src: "/apple-icon.svg", sizes: "180x180", type: "image/svg+xml", purpose: "any" },
    ],
  };
}