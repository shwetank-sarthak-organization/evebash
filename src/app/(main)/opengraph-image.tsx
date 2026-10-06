import { ImageResponse } from "next/og";

export const alt = "EveBash: every guest finds their photos with a selfie";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
    return new ImageResponse(
        (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    padding: "80px",
                    background: "linear-gradient(135deg, #13191F 0%, #1B211F 60%, #2B2F2E 100%)",
                    color: "#FFF7EB",
                }}
            >
                <div style={{ display: "flex", fontSize: 28, fontWeight: 700, letterSpacing: 6, color: "#CA9C68", textTransform: "uppercase" }}>
                    EveBash
                </div>
                <div style={{ display: "flex", flexDirection: "column", marginTop: 28, fontSize: 76, fontWeight: 700, lineHeight: 1.1 }}>
                    <span>Every guest finds their photos.</span>
                    <span style={{ color: "#CA9C68" }}>Just a selfie.</span>
                </div>
                <div style={{ display: "flex", marginTop: 36, fontSize: 30, color: "#E2CFB7" }}>
                    Share one link or QR code · Free for your first event
                </div>
            </div>
        ),
        size,
    );
}
