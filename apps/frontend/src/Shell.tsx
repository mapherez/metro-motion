import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useShellContext } from "./shell-context";

const SHELL_HEIGHT_FALLBACK = "68px"; // rough fallback in case measurement fails

export function Shell() {
  const { theme, toggleTheme, snapshot, serviceOpen, sinceText, loading, error } = useShellContext();
  const headerRef = useRef<HTMLElement | null>(null);
  const footerRef = useRef<HTMLElement | null>(null);
  const tabBarRef = useRef<HTMLElement | null>(null);
  const [headerHeight, setHeaderHeight] = useState<number>(68);
  const [footerHeight, setFooterHeight] = useState<number>(0);
  const [tabBarHeight, setTabBarHeight] = useState<number>(48);

  useEffect(() => {
    const update = () => {
      setHeaderHeight(headerRef.current?.getBoundingClientRect().height ?? 68);
      setFooterHeight(footerRef.current?.getBoundingClientRect().height ?? 0);
      setTabBarHeight(tabBarRef.current?.getBoundingClientRect().height ?? 0);
    };

    update();

    const headerEl = headerRef.current;
    const footerEl = footerRef.current;
    const tabBarEl = tabBarRef.current;
    const observers: ResizeObserver[] = [];

    if (headerEl) {
      const headerObserver = new ResizeObserver(() => update());
      headerObserver.observe(headerEl);
      observers.push(headerObserver);
    }

    if (footerEl) {
      const footerObserver = new ResizeObserver(() => update());
      footerObserver.observe(footerEl);
      observers.push(footerObserver);
    }

    if (tabBarEl) {
      const navObserver = new ResizeObserver(() => update());
      navObserver.observe(tabBarEl);
      observers.push(navObserver);
    }

    const onResize = () => update();
    window.addEventListener("resize", onResize, { passive: true });

    return () => {
      observers.forEach((observer) => observer.disconnect());
      window.removeEventListener("resize", onResize);
    };
  }, []);

  const layoutVars = useMemo(() => {
    const headerValue = Number.isFinite(headerHeight) ? `${headerHeight}px` : SHELL_HEIGHT_FALLBACK;
    const footerValue = Number.isFinite(footerHeight) ? `${footerHeight}px` : "0px";
    const tabValue = Number.isFinite(tabBarHeight) ? `${tabBarHeight}px` : "0px";
    return {
      "--shell-header-height": headerValue,
      "--shell-footer-height": footerValue,
      "--shell-tabbar-height": tabValue,
    } as CSSProperties;
  }, [headerHeight, footerHeight, tabBarHeight]);

  const mainStyle = useMemo(() => {
    const safeHeader = Number.isFinite(headerHeight) ? headerHeight : 68;
    const safeFooter = Number.isFinite(footerHeight) ? footerHeight : 0;
    const safeTab = Number.isFinite(tabBarHeight) ? tabBarHeight : 0;
    const baseHeight = `calc(100dvh - ${safeHeader}px - ${safeFooter}px - ${safeTab}px)`;
    const style: CSSProperties = {
      minHeight: baseHeight,
      paddingBottom: `${safeTab}px`
    };
    return style;
  }, [headerHeight, footerHeight, tabBarHeight]);

  const isClosed = serviceOpen === false;
  const statusBits: string[] = [];
  if (isClosed) {
    statusBits.push("Metro fechado (servico 06:30-01:00)");
  } else {
    const lastUpdated = snapshot ? new Date(snapshot.t * 1000).toLocaleTimeString() : "--";
    statusBits.push(lastUpdated);
    if (sinceText) statusBits.push(`(${sinceText})`);
  }
  if (loading) statusBits.push("loading...");
  const statusText = statusBits.join(" ");

  const commonFocus =
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]";

  const desktopNavClass = ({ isActive }: { isActive: boolean }) =>
    [
      "transition-colors",
      commonFocus,
      isActive ? "text-[var(--fg)]" : "text-muted",
      "hover:text-[var(--fg)]",
    ].join(" ");

  const mobileNavClass = ({ isActive }: { isActive: boolean }) =>
    [
      "flex min-h-11 items-center justify-center text-sm font-medium",
      "transition-colors",
      commonFocus,
      isActive ? "text-[var(--fg)]" : "text-muted",
      "hover:text-[var(--fg)]",
    ].join(" ");

  const year = new Date().getFullYear();
  const themeLabel = "Toggle color theme";
  const themeText = theme === "dark" ? "Dark" : "Light";

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--bg)] text-[var(--fg)]" style={layoutVars}>
      <header
        ref={headerRef}
        className="sticky top-0 z-10 border-b border-white/10 bg-[var(--bg)]/80 backdrop-blur"
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <Link
            to="/"
            className={`flex items-center gap-2 text-base font-semibold ${commonFocus}`}
          >
            <span className="inline-flex h-6 w-6 rounded bg-gradient-to-br from-[var(--line-azul)] to-[var(--line-vermelha)]" />
            <span>Metro Lisboa Live</span>
          </Link>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={themeLabel}
              aria-pressed={theme === "light"}
              className={`cursor-pointer flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-[var(--bg-soft)] text-sm font-semibold ${commonFocus}`}
            >
              {themeText}
            </button>
            <div className="text-right text-sm text-muted" aria-live="polite">
              <div>{statusText}</div>
              {error ? (
                <div className="mt-1 text-xs text-[var(--alert)]">Warning: {error}</div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <main className="relative flex-1 min-h-0" style={mainStyle}>
        <Outlet />
      </main>

      <footer
        ref={footerRef}
        className="hidden md:block sticky bottom-0 border-t border-white/10 bg-[var(--bg)]/80 backdrop-blur"
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-6 text-sm text-muted">
          <div>{`Copyright (c) ${year} Mapherez - Metro Lisboa Live`}</div>
          <nav className="flex items-center gap-4">
            <a
              className={desktopNavClass({ isActive: false })}
              href="https://github.com/teu-username"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
            <a
              className={desktopNavClass({ isActive: false })}
              href="https://www.linkedin.com/in/teu-username"
              target="_blank"
              rel="noreferrer"
            >
              LinkedIn
            </a>
            <a
              className={desktopNavClass({ isActive: false })}
              href="https://twitter.com/teu-username"
              target="_blank"
              rel="noreferrer"
            >
              Twitter/X
            </a>
          </nav>
        </div>
      </footer>

      <nav ref={tabBarRef} className="fixed bottom-0 left-0 right-0 border-t border-white/10 bg-[var(--bg-soft)] md:hidden">
        <div className="grid grid-cols-2">
          <NavLink to="/" className={mobileNavClass} end>
            Home
          </NavLink>
          <NavLink to="/about" className={mobileNavClass}>
            About
          </NavLink>
        </div>
      </nav>
      <div className="md:hidden" style={{ height: "var(--shell-tabbar-height, 3rem)" }} />
    </div>
  );
}
