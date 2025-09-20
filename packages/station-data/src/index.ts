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
export const destinos: Record<string, { name: string; line: LineName; terminal: string } | undefined> = {
  // Verde terminals
  "50": { name: "Telheiras", line: "verde", terminal: "TE" },
  "54": { name: "Cais do Sodré", line: "verde", terminal: "CS" },

  // Azul terminals
  "33": { name: "Reboleira", line: "azul", terminal: "RB" },
  "42": { name: "Santa Apolónia", line: "azul", terminal: "SP" },

  // Amarela terminals
  "43": { name: "Odivelas", line: "amarela", terminal: "OD" },
  "48": { name: "Rato", line: "amarela", terminal: "RA" },

  // Vermelha terminals
  "60": { name: "Aeroporto", line: "vermelha", terminal: "AP" },
  "38": { name: "São Sebastião", line: "vermelha", terminal: "SS" }
};

export function neighborForDirection(
  line: LineName,
  fromStop: string,
  towardsTerminal: string
): { next?: string; prev?: string } {
  const order = lineOrder[line];
  const i = order.indexOf(fromStop);
  if (i < 0) {return {};}
  const ti = order.indexOf(towardsTerminal);
  if (ti < 0) {return { next: order[i + 1], prev: order[i - 1] };}
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

