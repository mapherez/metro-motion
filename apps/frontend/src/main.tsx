import React from "react";
import ReactDOM from "react-dom/client";

import { App } from "./App";
import { ThemeProvider, I18nProvider } from "./app/providers";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <I18nProvider>
        <App />
      </I18nProvider>
    </ThemeProvider>
  </React.StrictMode>
);
