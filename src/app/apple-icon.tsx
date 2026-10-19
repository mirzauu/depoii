import { ImageResponse } from "next/og";
import { spiralSvg } from "@/components/depoii-logo";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  const src = `data:image/svg+xml;base64,${Buffer.from(spiralSvg("#ffffff", "#0a0a0f")).toString("base64")}`;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#0a0a0f" }}>
        <img src={src} width={180} height={180} alt="" />
      </div>
    ),
    size,
  );
}
