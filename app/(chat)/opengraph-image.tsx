import { ImageResponse } from "next/og";
import { messages as ui } from "@/lib/i18n/messages";

export const size = { height: 630, width: 1200 };
export const contentType = "image/png";
export const alt = ui.brand.name;

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        background: "#0A0A0A",
        color: "white",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        justifyContent: "center",
        padding: 80,
        width: "100%",
      }}
    >
      <div
        style={{
          alignItems: "center",
          background: "#00A868",
          borderRadius: 24,
          color: "white",
          display: "flex",
          fontSize: 64,
          fontWeight: 700,
          height: 96,
          justifyContent: "center",
          marginBottom: 40,
          width: 96,
        }}
      >
        B
      </div>
      <div style={{ display: "flex", fontSize: 84, fontWeight: 700 }}>
        {ui.brand.name}
      </div>
      <div
        style={{
          color: "#A1A1A1",
          display: "flex",
          fontSize: 36,
          marginTop: 16,
        }}
      >
        {ui.brand.tagline}
      </div>
    </div>,
    size
  );
}
