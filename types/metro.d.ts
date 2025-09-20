export {};

declare module "@metro/shared-types" {
  export type LineName = "verde" | "azul" | "amarela" | "vermelha";

  export type Train = {
    id: string;
    line: LineName;
    from: string;
    to: string;
    etaNext: number;
    progress01: number;
    dest: string;
  };

  export type Line = {
    trains: Train[];
  };

  export type Snapshot = {
    t: number;
    lines: Record<string, Line>;
    serviceOpen?: boolean;
  };

  export const Train: import("zod").ZodType<Train>;
  export const Line: import("zod").ZodType<Line>;
  export const Snapshot: import("zod").ZodType<Snapshot>;
}

declare module "@metro/shared-utils" {
  export type ThemeTokens = Record<string, string>;

  export type LocaleBundle = Record<string, Record<string, unknown>>;

  export type Translator = (key: string, values?: Record<string, unknown>) => string;

  export type AppSettings = {
    defaultLocale: string;
    supportedLocales: string[];
    theme?: string;
    featureFlags?: Record<string, boolean>;
    routes?: Record<string, string>;
    [key: string]: unknown;
  };

  export type ThemeConfig = {
    theme: string;
    overrides?: Record<string, unknown>;
  };

  export type TempoEsperaResponse = {
    resposta: Array<{
      stop_id: string;
      hora: string;
      comboio?: string;
      tempoChegada1?: string;
      comboio2?: string;
      tempoChegada2?: string;
      comboio3?: string;
      tempoChegada3?: string;
      destino?: string;
    }>;
  };

  export type TrainState = {
    to: string;
    segmentStartEta: number;
    t: number;
  };

  export type InferredTrain = {
    id: string;
    line: import("@metro/shared-types").LineName;
    from: string;
    to: string;
    etaNext: number;
    progress01: number;
    dest: string;
  };

  export function loadSettings(appId: string): AppSettings;
  export function loadThemeConfig(appId: string): ThemeConfig;
  export function buildThemeTokens(themeName: string, overrides?: Record<string, unknown>): ThemeTokens;
  export function buildThemeTokensForApp(appId: string, themeName?: string): ThemeTokens;
  export function applyTheme(
    themeName: string,
    root?: HTMLElement | null,
    overrides?: Record<string, unknown>
  ): ThemeTokens;

  export function loadLocaleBundle(appId: string, locale: string): LocaleBundle;
  export function createTranslator(options: {
    locale: string;
    bundles: LocaleBundle;
    fallback?: { locale: string; bundles: LocaleBundle };
  }): Translator;

  export function normalizeTempoEspera(
    data: TempoEsperaResponse,
    prev: Map<string, TrainState>,
    dwellSeconds: number
  ): InferredTrain[];
  export function toSnapshot(
    trains: InferredTrain[],
    overrides?: Partial<import("@metro/shared-types").Snapshot>
  ): import("@metro/shared-types").Snapshot;
}

declare module "@metro/station-data" {
  export type LineName = import("@metro/shared-types").LineName;

  export const lineNames: LineName[];
  export const lineOrder: Record<LineName, string[]>;
  export const destinos: Record<string, { name: string; line: LineName; terminal: string } | undefined>;
  export function neighborForDirection(
    line: LineName,
    fromStop: string,
    towardsTerminal: string
  ): { next?: string; prev?: string };
}

declare module "@metro/station-data/stations" {
  export type LineName = import("@metro/shared-types").LineName;

  export type StationInfo = {
    id: string;
    name: string;
    lines: LineName[];
    lat?: number;
    lon?: number;
    cx?: number;
    cy?: number;
    labelX?: number;
    labelY?: number;
  };

  export const stationById: Record<string, StationInfo>;
}

declare module "@metro/station-data/geometry" {
  export type LineName = import("@metro/shared-types").LineName;

  export const viewBox: { width: number; height: number };
  export const linePaths: Record<LineName, { id: string; d: string; kind: "stroke" | "fill" }>;
}

declare global {
  interface ImportMeta {
    glob<T = unknown>(pattern: string, options: { eager: true; import: "default" }): Record<string, T>;
    glob(pattern: string, options?: { eager?: boolean; import?: string }): Record<string, unknown>;
  }
}
