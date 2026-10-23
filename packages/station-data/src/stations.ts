export type LineName = "verde" | "azul" | "amarela" | "vermelha";

export type StationInfo = {
  id: string;
  name: string;
  lines: LineName[];
  lat?: number;
  lon?: number;
  // Optional screen-space positions (SVG 800x600 coordinates)
  cx?: number;
  cy?: number;
  labelX?: number;
  labelY?: number;
  labelAnchor?: "start" | "middle" | "end";
  labelLines?: string[];
};

export const stationById: Record<string, StationInfo> = {
  // Azul
  RB: { id: "RB", name: "Reboleira", lines: ["azul"] , cx: 47, cy: 136, labelX: 47, labelY: 122.5, labelAnchor: "middle" },
  AS: { id: "AS", name: "Amadora Este", lines: ["azul"] , cx: 85, cy: 136, labelX: 85, labelY: 158.5, labelAnchor: "middle" },
  AF: { id: "AF", name: "Alfornelos", lines: ["azul"] , cx: 123, cy: 136, labelX: 123, labelY: 121.5, labelAnchor: "middle" },
  PO: { id: "PO", name: "Pontinha", lines: ["azul"] , cx: 161, cy: 136, labelX: 172.457, labelY: 138.5 },
  CA: { id: "CA", name: "Carnide", lines: ["azul"] , cx: 193, cy: 168, labelX: 205, labelY: 170.5 },
  CM: { id: "CM", name: "Colégio Militar/Luz", lines: ["azul"] , cx: 225, cy: 200, labelX: 237, labelY: 190.5, labelLines: ["Colégio", "Militar/Luz"] },
  AH: { id: "AH", name: "Alto dos Moinhos", lines: ["azul"] , cx: 257, cy: 232, labelX: 269, labelY: 234.5 },
  LA: { id: "LA", name: "Laranjeiras", lines: ["azul"] , cx: 289, cy: 264, labelX: 301, labelY: 266.5 },
  JZ: { id: "JZ", name: "Jardim Zoológico", lines: ["azul"] , cx: 321, cy: 296, labelX: 333, labelY: 297.5 },
  PE: { id: "PE", name: "Praça de Espanha", lines: ["azul"] , cx: 353, cy: 328, labelX: 339, labelY: 331.5, labelAnchor: "end", labelLines: ["Praça de", "Espanha"] },
  SS: { id: "SS", name: "São Sebastião", lines: ["azul", "vermelha"] , cx: 385, cy: 361, labelX: 371, labelY: 364.5, labelAnchor: "end", labelLines: ["São", "Sebastião"] },
  PA: { id: "PA", name: "Parque", lines: ["azul"] , cx: 426, cy: 401, labelX: 412, labelY: 405.5, labelAnchor: "end" },
  MP: { id: "MP", name: "Marquês de Pombal", lines: ["azul", "amarela"] , cx: 462, cy: 437, labelX: 448, labelY: 440.5, labelAnchor: "end", labelLines: ["Marquês de", "Pombal"] },
  AV: { id: "AV", name: "Avenida", lines: ["azul"] , cx: 498, cy: 473, labelX: 495, labelY: 459.5 },
  RE: { id: "RE", name: "Restauradores", lines: ["azul"] , cx: 529, cy: 504, labelX: 515, labelY: 509.5, labelAnchor: "end" },
  BC: { id: "BC", name: "Baixa/Chiado", lines: ["azul", "verde"] , cx: 562, cy: 536, labelX: 571, labelY: 536.5 },
  TP: { id: "TP", name: "Terreiro do Paço", lines: ["azul"] , cx: 635, cy: 553, labelX: 635, labelY: 575.5, labelAnchor: "middle" },
  SP: { id: "SP", name: "Santa Apolónia", lines: ["azul"] , cx: 693, cy: 553, labelX: 705, labelY: 555.5 },

  // Verde
  TE: { id: "TE", name: "Telheiras", lines: ["verde"] , cx: 414, cy: 178, labelX: 400, labelY: 181.5, labelAnchor: "end" },
  CG: { id: "CG", name: "Campo Grande", lines: ["verde", "amarela"] , cx: 462, cy: 178, labelX: 471, labelY: 168.5 },
  AL: { id: "AL", name: "Alvalade", lines: ["verde"] , cx: 562, cy: 217, labelX: 574, labelY: 221.5 },
  RM: { id: "RM", name: "Roma", lines: ["verde"] , cx: 562, cy: 265, labelX: 574, labelY: 268.5 },
  AE: { id: "AE", name: "Areeiro", lines: ["verde"] , cx: 562, cy: 313, labelX: 574, labelY: 316.5 },
  AM: { id: "AM", name: "Alameda", lines: ["verde", "vermelha"] , cx: 562, cy: 361, labelX: 548, labelY: 377.5, labelAnchor: "end" },
  AR: { id: "AR", name: "Arroios", lines: ["verde"] , cx: 562, cy: 390, labelX: 574, labelY: 393.5 },
  AN: { id: "AN", name: "Anjos", lines: ["verde"] , cx: 562, cy: 419, labelX: 574, labelY: 423.5 },
  IN: { id: "IN", name: "Intendente", lines: ["verde"] , cx: 562, cy: 447, labelX: 574, labelY: 450.5 },
  MM: { id: "MM", name: "Martim Moniz", lines: ["verde"] , cx: 562, cy: 475, labelX: 574, labelY: 479.5 },
  RO: { id: "RO", name: "Rossio", lines: ["verde"] , cx: 562, cy: 503, labelX: 574, labelY: 506.5 },
  CS: { id: "CS", name: "Cais do Sodré", lines: ["verde"] , cx: 493, cy: 558, labelX: 479, labelY: 561.5, labelAnchor: "end" },

  // Amarela
  OD: { id: "OD", name: "Odivelas", lines: ["amarela"] , cx: 462, cy: 18, labelX: 448, labelY: 22.5, labelAnchor: "end" },
  SR: { id: "SR", name: "Senhor Roubado", lines: ["amarela"] , cx: 462, cy: 50, labelX: 448, labelY: 54.5, labelAnchor: "end" },
  AX: { id: "AX", name: "Ameixoeira", lines: ["amarela"] , cx: 462, cy: 82, labelX: 448, labelY: 86.5, labelAnchor: "end" },
  LU: { id: "LU", name: "Lumiar", lines: ["amarela"] , cx: 462, cy: 114, labelX: 448, labelY: 117.5, labelAnchor: "end" },
  QC: { id: "QC", name: "Quinta das Conchas", lines: ["amarela"] , cx: 462, cy: 146, labelX: 448, labelY: 143.5, labelAnchor: "end", labelLines: ["Quinta das", "Conchas"] },
  CU: { id: "CU", name: "Cidade Universitária", lines: ["amarela"] , cx: 462, cy: 226, labelX: 474, labelY: 222.5, labelLines: ["Cidade", "Universitária"] },
  EC: { id: "EC", name: "Entre Campos", lines: ["amarela"] , cx: 462, cy: 274, labelX: 474, labelY: 277.5 },
  CP: { id: "CP", name: "Campo Pequeno", lines: ["amarela"] , cx: 462, cy: 322, labelX: 474, labelY: 318.5, labelLines: ["Campo", "Pequeno"] },
  SA: { id: "SA", name: "Saldanha", lines: ["amarela", "vermelha"] , cx: 462, cy: 361, labelX: 470, labelY: 352.5 },
  PI: { id: "PI", name: "Picoas", lines: ["amarela"] , cx: 462, cy: 399, labelX: 474, labelY: 402.5 },
  RA: { id: "RA", name: "Rato", lines: ["amarela"] , cx: 452, cy: 479, labelX: 438, labelY: 483.5, labelAnchor: "end" },

  // Vermelha
  AP: { id: "AP", name: "Aeroporto", lines: ["vermelha"] , cx: 636, cy: 115, labelX: 622, labelY: 118.5, labelAnchor: "end" },
  EN: { id: "EN", name: "Encarnação", lines: ["vermelha"] , cx: 684, cy: 115, labelX: 684, labelY: 137.5, labelAnchor: "middle" },
  MO: { id: "MO", name: "Moscavide", lines: ["vermelha"] , cx: 732, cy: 114, labelX: 732, labelY: 100.5, labelAnchor: "middle" },
  OR: { id: "OR", name: "Oriente", lines: ["vermelha"] , cx: 754, cy: 162, labelX: 740, labelY: 165.5, labelAnchor: "end" },
  CR: { id: "CR", name: "Cabo Ruivo", lines: ["vermelha"] , cx: 736, cy: 222, labelX: 722, labelY: 224.5, labelAnchor: "end" },
  OS: { id: "OS", name: "Olivais", lines: ["vermelha"] , cx: 704, cy: 254, labelX: 716, labelY: 259.5 },
  CH: { id: "CH", name: "Chelas", lines: ["vermelha"] , cx: 672, cy: 286, labelX: 684, labelY: 291.5 },
  BV: { id: "BV", name: "Bela Vista", lines: ["vermelha"] , cx: 640, cy: 318, labelX: 652, labelY: 323.5 },
  OL: { id: "OL", name: "Olaias", lines: ["vermelha"] , cx: 608, cy: 352, labelX: 620, labelY: 356.5 }
};

// BEGIN: GENERATED_POSITIONS (do not edit manually)
// This block is replaced by tools/extract-stations.mjs
export const __generatedPositions: Record<string, { cx: number; cy: number; labelX: number; labelY: number }> = {};
// END: GENERATED_POSITIONS

// Merge generated positions into stationById at module load
for (const id in __generatedPositions) {
  if (stationById[id]) {
    Object.assign(stationById[id], __generatedPositions[id]);
  }
}
