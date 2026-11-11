import React from "react";
import { createRoot } from "react-dom/client";
import CarpoolApp from "./CarpoolApp.jsx";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/montserrat/700.css";
import "@fontsource/montserrat/800.css";
import "@fontsource/montserrat/900.css";
import "./carpool.css";

createRoot(document.getElementById("root")).render(<CarpoolApp />);
