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
};

export const stationById: Record<string, StationInfo> = {
  // Azul
  RB: { id: "RB", name: "Reboleira", lines: ["azul"] },
  AS: { id: "AS", name: "Amadora Este", lines: ["azul"] },
  AF: { id: "AF", name: "Alfornelos", lines: ["azul"] },
  PO: { id: "PO", name: "Pontinha", lines: ["azul"] },
  CA: { id: "CA", name: "Carnide", lines: ["azul"] },
  CM: { id: "CM", name: "Colégio Militar/Luz", lines: ["azul"] },
  AH: { id: "AH", name: "Alto dos Moinhos", lines: ["azul"] },
  LA: { id: "LA", name: "Laranjeiras", lines: ["azul"] },
  JZ: { id: "JZ", name: "Jardim Zoológico", lines: ["azul"] },
  PE: { id: "PE", name: "Praça de Espanha", lines: ["azul"] },
  SS: { id: "SS", name: "São Sebastião", lines: ["azul", "vermelha"] },
  PA: { id: "PA", name: "Parque", lines: ["azul"] },
  MP: { id: "MP", name: "Marquês de Pombal", lines: ["azul", "amarela"] },
  AV: { id: "AV", name: "Avenida", lines: ["azul"] },
  RE: { id: "RE", name: "Restauradores", lines: ["azul"] },
  BC: { id: "BC", name: "Baixa/Chiado", lines: ["azul", "verde"] },
  TP: { id: "TP", name: "Terreiro do Paço", lines: ["azul"] },
  SP: { id: "SP", name: "Santa Apolónia", lines: ["azul"] },

  // Verde
  TE: { id: "TE", name: "Telheiras", lines: ["verde"] },
  CG: { id: "CG", name: "Campo Grande", lines: ["verde", "amarela"] },
  AL: { id: "AL", name: "Alvalade", lines: ["verde"] },
  RM: { id: "RM", name: "Roma", lines: ["verde"] },
  AE: { id: "AE", name: "Areeiro", lines: ["verde"] },
  AM: { id: "AM", name: "Alameda", lines: ["verde", "vermelha"] },
  AR: { id: "AR", name: "Arroios", lines: ["verde"] },
  AN: { id: "AN", name: "Anjos", lines: ["verde"] },
  IN: { id: "IN", name: "Intendente", lines: ["verde"] },
  MM: { id: "MM", name: "Martim Moniz", lines: ["verde"] },
  RO: { id: "RO", name: "Rossio", lines: ["verde"] },
  CS: { id: "CS", name: "Cais do Sodré", lines: ["verde"] },

  // Amarela
  OD: { id: "OD", name: "Odivelas", lines: ["amarela"] },
  SR: { id: "SR", name: "Senhor Roubado", lines: ["amarela"] },
  AX: { id: "AX", name: "Ameixoeira", lines: ["amarela"] },
  LU: { id: "LU", name: "Lumiar", lines: ["amarela"] },
  QC: { id: "QC", name: "Quinta das Conchas", lines: ["amarela"] },
  CU: { id: "CU", name: "Cidade Universitária", lines: ["amarela"] },
  EC: { id: "EC", name: "Entre Campos", lines: ["amarela"] },
  CP: { id: "CP", name: "Campo Pequeno", lines: ["amarela"] },
  SA: { id: "SA", name: "Saldanha", lines: ["amarela", "vermelha"] },
  PI: { id: "PI", name: "Picoas", lines: ["amarela"] },
  RA: { id: "RA", name: "Rato", lines: ["amarela"] },

  // Vermelha
  AP: { id: "AP", name: "Aeroporto", lines: ["vermelha"] },
  EN: { id: "EN", name: "Encarnação", lines: ["vermelha"] },
  MO: { id: "MO", name: "Moscavide", lines: ["vermelha"] },
  OR: { id: "OR", name: "Oriente", lines: ["vermelha"] },
  CR: { id: "CR", name: "Cabo Ruivo", lines: ["vermelha"] },
  OS: { id: "OS", name: "Olivais", lines: ["vermelha"] },
  CH: { id: "CH", name: "Chelas", lines: ["vermelha"] },
  BV: { id: "BV", name: "Bela Vista", lines: ["vermelha"] },
  OL: { id: "OL", name: "Olaias", lines: ["vermelha"] }
};

// Merge generated screen-space positions if available
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - generated file present at dev time
import { stationPositions } from './station-positions';
for (const id in stationPositions) {
  if (stationById[id]) {
    Object.assign(stationById[id], stationPositions[id]);
  }
}
