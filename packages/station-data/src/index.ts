// Minimal station data to support direction & neighbors.
// NOTE: Can be refined with full metadata later.

export type LineName = "verde" | "azul" | "amarela" | "vermelha";

export const lineNames: LineName[] = ["verde", "azul", "amarela", "vermelha"];

// Ordered stop_ids by line (canonical order along the line)
export const lineOrder: Record<LineName, string[]> = {
  // Telheiras -> Cais do Sodré
  verde: [
    "TE", // Telheiras
    "CG", // Campo Grande
    "AL", // Alvalade
    "RM", // Roma
    "AE", // Areeiro
    "AM", // Alameda
    "AR", // Arroios
    "AN", // Anjos
    "IN", // Intendente
    "MM", // Martim Moniz
    "RO", // Rossio
    "BC", // Baixa/Chiado
    "CS"  // Cais do Sodré
  ],
  // Reboleira -> Santa Apolónia
  azul: [
    "RB", // Reboleira
    "AS", // Amadora Este
    "AF", // Alfornelos
    "PO", // Pontinha
    "CA", // Carnide
    "CM", // Colégio Militar/Luz
    "AH", // Alto dos Moinhos
    "LA", // Laranjeiras
    "JZ", // Jardim Zoológico
    "PE", // Praça de Espanha
    "SS", // São Sebastião
    "PA", // Parque
    "MP", // Marquês de Pombal
    "AV", // Avenida
    "RE", // Restauradores
    "BC", // Baixa/Chiado
    "TP", // Terreiro do Paço
    "SP"  // Santa Apolónia
  ],
  // Odivelas -> Rato
  amarela: [
    "OD", // Odivelas
    "SR", // Senhor Roubado
    "AX", // Ameixoeira
    "LU", // Lumiar
    "QC", // Quinta das Conchas
    "CG", // Campo Grande
    "CU", // Cidade Universitária
    "EC", // Entre Campos
    "CP", // Campo Pequeno
    "SA", // Saldanha
    "PI", // Picoas
    "MP", // Marquês de Pombal
    "RA"  // Rato
  ],
  // Aeroporto -> São Sebastião
  vermelha: [
    "AP", // Aeroporto
    "EN", // Encarnação
    "MO", // Moscavide
    "OR", // Oriente
    "CR", // Cabo Ruivo
    "OS", // Olivais
    "CH", // Chelas
    "BV", // Bela Vista
    "OL", // Olaias
    "AM", // Alameda
    "SA", // Saldanha
    "SS"  // São Sebastião
  ]
};

// Map destino IDs to human names and inferred line + terminal stop_id
export const destinos: Record<string, { name: string; line?: LineName; terminal?: string } | undefined> = {
  "33": { name: "Reboleira", line: "azul", terminal: "RB" },
  "34": { name: "Amadora Este", line: "azul" },
  "35": { name: "Pontinha", line: "azul" },
  "36": { name: "Colégio Militar/Luz", line: "azul" },
  "37": { name: "Laranjeiras", line: "azul" },
  "38": { name: "São Sebastião", line: "vermelha", terminal: "SS" },
  "39": { name: "Avenida", line: "azul" },
  "40": { name: "Baixa-Chiado", line: "azul" },
  "41": { name: "Terreiro do Paço", line: "azul", terminal: "TP" },
  "42": { name: "Santa Apolónia", line: "azul", terminal: "SP" },
  "43": { name: "Odivelas", line: "amarela", terminal: "OD" },
  "44": { name: "Lumiar", line: "amarela" },
  "45": { name: "Campo Grande", line: "amarela" },
  "46": { name: "Campo Pequeno", line: "amarela" },
  "48": { name: "Rato", line: "amarela", terminal: "RA" },
  "50": { name: "Telheiras", line: "verde", terminal: "TE" },
  "51": { name: "Alvalade", line: "verde" },
  "52": { name: "Alameda", line: "verde" },
  "53": { name: "Martim Moniz", line: "verde" },
  "54": { name: "Cais do Sodré", line: "verde", terminal: "CS" },
  "56": { name: "Bela Vista", line: "vermelha" },
  "57": { name: "Chelas", line: "vermelha" },
  "59": { name: "Moscavide", line: "vermelha" },
  "60": { name: "Aeroporto", line: "vermelha", terminal: "AP" }
};

export function neighborForDirection(
  line: LineName,
  fromStop: string,
  towardsTerminal: string
): { next?: string; prev?: string } {
  const order = lineOrder[line];
  const i = order.indexOf(fromStop);
  if (i < 0) return {};
  const ti = order.indexOf(towardsTerminal);
  if (ti < 0) return { next: order[i + 1], prev: order[i - 1] };
  if (ti > i) {
    // moving forward in array
    return { next: order[i + 1], prev: order[i - 1] };
  } else if (ti < i) {
    // moving backward in array
    return { next: order[i - 1], prev: order[i + 1] };
  } else {
    // already at terminal
    return { next: order[i], prev: order[i - 1] };
  }
}

