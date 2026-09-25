import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";
import { AppErrorBoundary } from "./app/components/AppErrorBoundary";
import { AppProviders } from "./app/providers/AppProviders";
import "./index.css";
import { PluginLoader } from "./plugins";
import YolnomaTurbo from "./app/components/YolnomaTurbo";
import { setupTurboInterceptors } from "./app/turbo/turboInterceptors";

// Setup DevTools layer in DEV mode before anything else runs
if (import.meta.env.DEV) {
  setupTurboInterceptors();

  const turboContainer = document.createElement("div");
  turboContainer.id = "yolnoma-turbo-root";
  document.body.appendChild(turboContainer);

  ReactDOM.createRoot(turboContainer).render(<YolnomaTurbo />);
}

// Phase 3: Load external local plugins from AppData (e.g. AppData/Local/Yolnoma/plugins)
PluginLoader.loadAllLocalPlugins().catch((err) => {
  console.error("[main] Failed to load external plugins:", err);
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <AppProviders>
        <App />
      </AppProviders>
    </AppErrorBoundary>
  </React.StrictMode>,
);
