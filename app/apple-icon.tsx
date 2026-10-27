import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";
export const alt = "HoopCheck basketball and check mark app icon";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0A0A0A",
          position: "relative",
        }}
      >
        <svg width="156" height="156" viewBox="0 0 512 512" fill="none">
          <path d="M256 28 448 140v208L256 484 64 348V140Z" stroke="#F7F7F5" strokeWidth="18" strokeLinejoin="miter" />
          <circle cx="250" cy="250" r="122" stroke="#F7F7F5" strokeWidth="12" />
          <path d="M128 250h244M250 128c-48 50-48 194 0 244M250 128c48 50 48 194 0 244M163 162c60 35 112 119 174 176M337 162c-60 35-112 119-174 176" stroke="#F7F7F5" strokeWidth="10" />
          <path d="m250 298 45 40 165-194-56 6-112 129-32-28Z" fill="#FF5A1F" stroke="#0A0A0A" strokeWidth="5" strokeLinejoin="miter" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
