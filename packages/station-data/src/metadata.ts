import { stationById } from "./stations.js";
import { officialStations } from "./catalog.js";
import type { LineName } from "./index.js";

const source = "https://www.metrolisboa.pt/viajar/horarios-e-frequencias/";
// Verified against the operator's opening-hours table, not inferred from ETAs.
const secondary: Record<string, string> = {
  JZ: "Norte (acesso 1)",
  PE: "Sul",
  MP: "Sul",
  AV: "Sul",
  SR: "Sul",
  QC: "Norte",
  PI: "Sul",
  AL: "Sul",
  AE: "Sul",
  AR: "Sul",
  AN: "Norte",
  RO: "Nascente",
};
export const stationMetadata = Object.values(stationById).map((station) => {
  const official = officialStations.find((s) => s.id === station.id);
  return {
    id: station.id,
    name: station.name,
    lines: station.lines as LineName[],
    lat: official?.lat,
    lon: official?.lon,
    urls: official?.urls ?? [],
    hours: {
      opens: "06:30",
      closes: "01:00",
      source,
      verifiedAt: "2026-10-14",
      secondaryEntrances: secondary[station.id]
        ? [{ name: secondary[station.id], opens: "06:30", closes: "21:30" }]
        : [],
    },
  };
});
