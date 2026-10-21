import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false, message: "" };
  }

  static getDerivedStateFromError(error) {
    return { failed: true, message: error?.message || "Unknown rendering error" };
  }

  componentDidCatch(error) {
    console.error("FindVia Provider render error:", error);
  }

  render() {
    if (this.state.failed) {
      return (
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#f5f7f5", color: "#1d2d29", fontFamily: "system-ui, sans-serif" }}>
          <section style={{ width: "min(100%, 520px)", background: "#fff", border: "1px solid #e1e8e3", borderRadius: 20, padding: 24, boxShadow: "0 12px 36px #102f2712" }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 2, color: "#176b50" }}>FINDVIA · PROVIDER</div>
            <h1 style={{ fontSize: 25, margin: "12px 0" }}>We couldn't open this preview</h1>
            <p style={{ lineHeight: 1.6, color: "#56645d" }}>The page encountered a display error. Reload once; if it happens again, share a screenshot of this message with the app team.</p>
            <details style={{ margin: "16px 0", color: "#56645d" }}><summary>Error details</summary><pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: 12 }}>{this.state.message}</pre></details>
            <button onClick={() => window.location.reload()} style={{ border: 0, borderRadius: 12, padding: "12px 18px", background: "#176b50", color: "#fff", fontWeight: 700 }}>Reload preview</button>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById("root");
if (rootElement) {
  try {
    createRoot(rootElement).render(
      <React.StrictMode>
        <AppErrorBoundary>
          <App />
        </AppErrorBoundary>
      </React.StrictMode>
    );
  } catch (error) {
    console.error("FindVia Provider startup error:", error);
    rootElement.innerHTML = '<main style="font-family:system-ui,sans-serif;padding:24px;color:#1d2d29"><h1>FindVia Provider could not start</h1><p>Reload this preview. If it continues, send a screenshot to the app team.</p></main>';
  }
}
