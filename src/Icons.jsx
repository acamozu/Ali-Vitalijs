import React from "react";
import {
  Bus,
  ChartColumn,
  Coffee,
  Coins,
  Cpu,
  Gauge,
  Handshake,
  MapPin,
  MessagesSquare,
  PartyPopper,
  Utensils,
} from "lucide-react";

// Lucide icons (MIT) - names are used in agenda.js
const ICONS = {
  coffee: Coffee,
  hand: Handshake,
  chart: ChartColumn,
  gauge: Gauge,
  chat: MessagesSquare,
  food: Utensils,
  chip: Cpu,
  coin: Coins,
  star: PartyPopper,
  pin: MapPin,
  bus: Bus,
};

export default function Icon({ name, size = 20 }) {
  const Cmp = ICONS[name] || PartyPopper;
  return <Cmp size={size} strokeWidth={1.75} aria-hidden="true" />;
}
