import { ImageResponse } from "next/og";

export const size = { height: 32, width: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background: "#00A868",
        borderRadius: 7,
        color: "white",
        display: "flex",
        fontSize: 22,
        fontWeight: 700,
        height: "100%",
        justifyContent: "center",
        width: "100%",
      }}
    >
      B
    </div>,
    size
  );
}
