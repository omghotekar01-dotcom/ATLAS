import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "./router.js";
import "./styles.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Studio root element was not found.");
}

createRoot(rootElement).render(
  <StrictMode>
    <RouterProvider router={getRouter()} />
  </StrictMode>,
);
