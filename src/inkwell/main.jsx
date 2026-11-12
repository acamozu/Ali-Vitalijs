// The live agenda, unchanged (same App.jsx: clock, intro animation, bar, splash) - only the skin differs (skin.css).
import React from "react";
import { createRoot } from "react-dom/client";
import App from "../App.jsx";
import "@fontsource/rubik/400.css";
import "@fontsource/rubik/500.css";
import "@fontsource/rubik/600.css";
import "@fontsource/rubik/700.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/montserrat/700.css";
import "@fontsource/montserrat/800.css";
import "@fontsource/montserrat/900.css";
import "../styles.css";
import "./skin.css";

createRoot(document.getElementById("root")).render(<App />);
