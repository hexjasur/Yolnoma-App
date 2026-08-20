import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { PluginLoader } from "./plugins";

// Phase 3: Load external local plugins from AppData (e.g. AppData/Local/Yolnoma/plugins)
PluginLoader.loadAllLocalPlugins().catch((err) => {
  console.error("[main] Failed to load external plugins:", err);
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
