import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

const rootEl = document.getElementById("root");
createRoot(rootEl).render(
  <StrictMode><App /></StrictMode>
);

// Hide custom boot splash once app has mounted
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    const splash = document.getElementById("splash");
    if (splash) {
      splash.classList.add("hide");
      setTimeout(() => { splash.remove(); }, 400);
    }
  });
});
