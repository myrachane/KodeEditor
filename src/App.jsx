import React from "react";
import StudioIDE from "./ide/StudioIDE";

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || "Unknown renderer error" };
  }

  componentDidCatch(error) {
    // Keep this log so Electron terminal shows real crash reason.
    console.error("[studio] renderer boundary caught:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#000308",
          color: "#e8f0fc",
          fontFamily: "'JetBrains Mono', monospace",
          padding: 20,
        }}>
          <div style={{
            width: "min(720px, 96vw)",
            background: "#000000",
            border: "1px solid #2a3f5e",
            borderRadius: 10,
            padding: 16,
          }}>
            <div style={{ fontSize: 12, letterSpacing: ".14em", color: "#9eb3d3", marginBottom: 8 }}>VISRODECK RECOVERY PROTOCOL</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Renderer recovered from crash</div>
            <div style={{ fontSize: 12, color: "#b8cbe7", marginBottom: 10 }}>{this.state.message}</div>
            <button
              onClick={() => window.location.reload()}
              style={{
                height: 32,
                padding: "0 12px",
                borderRadius: 8,
                border: "1px solid #a5c0e4",
                background: "linear-gradient(180deg,#d4e4fb,#aec8ea)",
                color: "#00040a",
                cursor: "pointer",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              Reload IDE
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <AppErrorBoundary>
      <StudioIDE />
    </AppErrorBoundary>
  );
}
