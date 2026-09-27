import React from "react";
import ReactDOM from "react-dom/client";
import { SessionGate } from "./SessionGate";
import "./style.css";
import { restoreAppearance } from "./Appearance";
restoreAppearance();
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <SessionGate />
  </React.StrictMode>,
);
