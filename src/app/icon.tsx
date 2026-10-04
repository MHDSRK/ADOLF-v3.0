import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/** Adolf-V3.0 personal mark: a neutral A3 monogram, not a historical/political symbol. */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0b1020",
          borderRadius: 7,
          color: "#ffffff",
          fontSize: 15,
          fontWeight: 800,
          letterSpacing: -1,
          border: "1px solid #334155",
        }}
      >
        <span>A3</span>
      </div>
    ),
    { ...size },
  );
}
