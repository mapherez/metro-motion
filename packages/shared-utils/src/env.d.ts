export {};

type GlobResult<T = unknown> = Record<string, T>;

declare global {
  interface ImportGlobOptions {
    eager?: boolean;
    import?: string;
  }

  interface ImportMeta {
    glob<T = unknown>(pattern: string, options: ImportGlobOptions & { eager: true; import: "default" }): GlobResult<T>;
    glob(pattern: string, options?: ImportGlobOptions): Record<string, unknown>;
  }
}
