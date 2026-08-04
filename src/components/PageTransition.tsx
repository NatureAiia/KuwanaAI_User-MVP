"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";

const EXIT_DURATION = 120;

/** Crossfades page content on route change — plain CSS, no animation library. */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [displayChildren, setDisplayChildren] = useState(children);
  const [phase, setPhase] = useState<"enter" | "exit">("enter");
  const prevPathname = useRef(pathname);

  useEffect(() => {
    if (prevPathname.current === pathname) {
      setDisplayChildren(children);
      return;
    }
    prevPathname.current = pathname;
    setPhase("exit");

    const timeout = setTimeout(() => {
      setDisplayChildren(children);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setPhase("enter"));
      });
    }, EXIT_DURATION);

    return () => clearTimeout(timeout);
  }, [pathname, children]);

  return (
    <div className={clsx("flex flex-1 flex-col", phase === "exit" ? "page-transition--exit" : "page-transition--enter")}>
      {displayChildren}
    </div>
  );
}
