// WCAG 2.4.1 (Bypass Blocks): lets keyboard users jump past the repeated
// header/nav straight to page content instead of tabbing through it on
// every single page. Visually hidden until focused.
export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-accent-sky focus:px-4 focus:py-2.5 focus:text-[14px] focus:font-semibold focus:text-text-on-accent-sky focus:shadow-lg"
    >
      Skip to main content
    </a>
  );
}
