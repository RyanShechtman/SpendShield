import React from "react";
import ReactDOM from "react-dom/client";
import { SessionGate } from "./SessionGate";
import "./style.css";
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <SessionGate />
  </React.StrictMode>,
);
