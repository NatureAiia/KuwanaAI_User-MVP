import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kuwana — Compare smarter, gain more",
    short_name: "Kuwana",
    description:
      "AI-assisted, explainable comparisons across telecom, banking, insurance, and education in Zimbabwe.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#1e3a8a",
    icons: [
      {
        // Real dimensions of the only brand mark shipped so far — declaring
        // a fabricated 192x192/512x512 set here would just be lying to the
        // manifest about a file that doesn't exist at those sizes.
        src: "/kuwana-mark.png",
        sizes: "655x655",
        type: "image/png",
      },
    ],
  };
}
