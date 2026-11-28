"use client";

import type { MouseEvent, ReactElement, ReactNode } from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "./button";
import { CloseIcon, MenuIcon, MoonIcon, SunIcon } from "./icons";

export interface ThemeShellProps {
  title: string;
  /** Navigation: the fixed rail on wide screens, a slide-over drawer below. */
  rail?: ReactNode;
  children: ReactNode;
}

/* Must match the xl: classes below, where the fixed rail takes over from the drawer. */
const RAIL_QUERY = "(min-width: 1280px)";

/* Keep in sync with the boot script in apps/web/src/app/layout.tsx. */
const THEME_STORAGE_KEY = "oku-theme";

const readStoredTheme = (): "light" | "dark" | null => {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "dark" || stored === "light" ? stored : null;
  } catch {
    return null;
  }
};

/*
 * xl and up: a fixed 260px cobalt rail closed by the 4px vermilion rule, with
 * a fluid workspace beside it. Below xl the workspace keeps the full width,
 * and the same navigation opens as a drawer from a compact top bar.
 */
export const ThemeShell = ({
  title,
  rail,
  children,
}: ThemeShellProps): ReactElement => {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawer = useRef<HTMLDialogElement | null>(null);
  const themeReady = useRef(false);

  // The boot script has already set data-theme. Copy it before paint, and
  // don't write storage until the person actually toggles.
  useLayoutEffect(() => {
    if (!themeReady.current) {
      themeReady.current = true;
      const stored = readStoredTheme();
      const attr = document.documentElement.getAttribute("data-theme");
      const next =
        stored ?? (attr === "dark" || attr === "light" ? attr : "light");
      if (next !== theme) {
        setTheme(next);
        return;
      }
    }
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const toggleTheme = (): void => {
    const next = theme === "light" ? "dark" : "light";
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Private mode can reject storage. The attribute still updates for this visit.
    }
    setTheme(next);
  };

  useEffect(() => {
    if (!drawerOpen) {
      return undefined;
    }
    // Hold the page still behind the drawer, and close it if the rail appears.
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    root.style.overflow = "hidden";
    const wide = window.matchMedia(RAIL_QUERY);
    const onWide = (): void => {
      if (wide.matches) {
        drawer.current?.close();
      }
    };
    wide.addEventListener("change", onWide);
    return () => {
      root.style.overflow = previousOverflow;
      wide.removeEventListener("change", onWide);
    };
  }, [drawerOpen]);

  const openDrawer = (): void => {
    const dialog = drawer.current;
    if (!dialog || dialog.open) {
      return;
    }
    dialog.showModal();
    setDrawerOpen(true);
  };

  const closeDrawer = (): void => {
    drawer.current?.close();
  };

  // A tap on the backdrop, a link, or a nav button closes the drawer.
  // Lesson Studio's rail is buttons, not links, so button taps must dismiss it too.
  const onDrawerClick = (event: MouseEvent<HTMLDialogElement>): void => {
    const target = event.target as HTMLElement;
    if (target === event.currentTarget || target.closest("a, button")) {
      closeDrawer();
    }
  };

  const themeToggle = (
    <Button
      variant="rail"
      className="shrink-0"
      onClick={toggleTheme}
    >
      {theme === "light" ? <MoonIcon /> : <SunIcon />}
      {theme === "light" ? "Night" : "Day"}
    </Button>
  );

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] xl:pl-[260px]">
      <header
        data-surface="rail"
        className="flex items-center gap-3 border-b-4 border-[var(--accent-primary)] bg-[var(--bg-rail)] px-4 py-3 text-[var(--text-on-rail)] sm:px-6 xl:hidden"
      >
        {rail ? (
          <Button
            variant="rail"
            size="icon"
            className="shrink-0"
            aria-label="Open navigation"
            aria-haspopup="dialog"
            onClick={openDrawer}
          >
            <MenuIcon />
          </Button>
        ) : null}
        <div className="flex min-w-0 flex-1 items-baseline gap-3">
          <span className="text-xl font-bold tracking-[-0.02em]">oku</span>
          <span
            aria-hidden="true"
            className="h-4 w-px shrink-0 self-center bg-[var(--rail-line)]"
          />
          <h1 className="truncate text-base font-medium">{title}</h1>
        </div>
        {themeToggle}
      </header>

      {rail ? (
        <dialog
          ref={drawer}
          data-surface="rail"
          aria-label="Navigation"
          onClose={() => setDrawerOpen(false)}
          onClick={onDrawerClick}
          onKeyDown={(event) => {
            // Native dialogs close on Escape; embedded webviews do not always pass it on.
            if (event.key === "Escape") {
              closeDrawer();
            }
          }}
          className="fixed inset-y-0 left-0 m-0 h-[100dvh] max-h-none w-[min(300px,86vw)] max-w-none flex-col border-0 border-r-4 border-[var(--accent-primary)] bg-[var(--bg-rail)] p-0 text-[var(--text-on-rail)] backdrop:bg-[rgb(18_22_28/0.6)] open:flex open:animate-[oku-drawer-in_180ms_cubic-bezier(0.16,1,0.3,1)] motion-reduce:open:animate-none"
        >
          <div className="flex items-center justify-between gap-3 px-5 pb-4 pt-4">
            <p className="text-2xl font-bold leading-none tracking-[-0.02em]">
              oku
            </p>
            <Button
              variant="rail"
              size="icon"
              aria-label="Close navigation"
              onClick={closeDrawer}
            >
              <CloseIcon />
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-1 [scrollbar-color:var(--rail-line)_transparent] [scrollbar-width:thin]">
            {drawerOpen ? rail : null}
          </div>
        </dialog>
      ) : null}

      <aside
        data-surface="rail"
        className="fixed inset-y-0 left-0 z-20 hidden w-[260px] flex-col border-r-4 border-[var(--accent-primary)] bg-[var(--bg-rail)] text-[var(--text-on-rail)] xl:flex"
      >
        <div className="px-5 pb-6 pt-7">
          <p className="text-2xl font-bold leading-none tracking-[-0.02em]">
            oku
          </p>
          <h1 className="mt-2 text-sm font-medium text-[var(--text-on-rail-muted)]">
            {title}
          </h1>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-1 [scrollbar-color:var(--rail-line)_transparent] [scrollbar-width:thin]">
          {rail}
        </div>
        <div className="border-t border-[var(--rail-hover)] px-5 py-4">
          {themeToggle}
        </div>
      </aside>

      <main className="px-4 py-6 sm:px-6 xl:px-11 xl:py-8">
        <div className="max-w-[1400px]">{children}</div>
      </main>
    </div>
  );
};
