"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import "./mobile-platform-nav.css";

/** One compact mobile shell for both platforms; each caller owns its allowed links. */
export function MobilePlatformNav({
  title,
  context,
  homeHref,
  navigationKey,
  children,
  footer,
}: {
  title: string;
  context: string;
  homeHref: string;
  navigationKey: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const unlockScroll = useRef<(() => void) | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const restorePage = useCallback(() => {
    unlockScroll.current?.();
    unlockScroll.current = null;
    const previous = previousFocus.current;
    previousFocus.current = null;
    if (
      previous?.isConnected &&
      previous.getClientRects().length > 0 &&
      !previous.closest("[hidden], [inert]") &&
      !document.querySelector("dialog[open]")
    ) {
      previous.focus({ preventScroll: true });
    }
  }, []);

  const close = useCallback(() => {
    dialog.current?.close();
    restorePage();
    setIsOpen(false);
  }, [restorePage]);

  function open() {
    const element = dialog.current;
    if (!element || element.open) return;
    previousFocus.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const elements = [document.documentElement, document.body];
    const previousOverflow = elements.map((node) => ({
      value: node.style.getPropertyValue("overflow"),
      priority: node.style.getPropertyPriority("overflow"),
    }));
    elements.forEach((node) => node.style.setProperty("overflow", "hidden"));
    unlockScroll.current = () => elements.forEach((node, index) => {
      const { value, priority } = previousOverflow[index];
      if (value) node.style.setProperty("overflow", value, priority);
      else node.style.removeProperty("overflow");
    });
    element.showModal();
    setIsOpen(true);
  }

  useEffect(() => {
    close();
  }, [navigationKey, close]);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 701px)");
    const onResize = () => { if (desktop.matches) close(); };
    desktop.addEventListener("change", onResize);
    return () => {
      desktop.removeEventListener("change", onResize);
      dialog.current?.close();
      restorePage();
    };
  }, [close, restorePage]);

  return (
    <div className="platform-mobile-nav">
      <header className="pmn-bar">
        <Link className="pmn-brand" href={homeHref} aria-label={`${title} home`}>
          <span className="pmn-mark" aria-hidden="true" />
          <span>
            <strong>Van der Tweel</strong>
            <span>{title}</span>
          </span>
        </Link>
        <button
          type="button"
          className="pmn-menu-button"
          aria-label={`Open ${title.toLowerCase()} menu`}
          aria-expanded={isOpen}
          aria-controls={id}
          aria-haspopup="dialog"
          onClick={open}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
          <span>Menu</span>
        </button>
      </header>
      <dialog
        id={id}
        ref={dialog}
        className="pmn-dialog"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-context`}
        onCancel={(event) => { event.preventDefault(); close(); }}
        onClose={() => { restorePage(); setIsOpen(false); }}
        onClick={(event) => {
          if (event.target instanceof Element && event.target.closest("a[href]")) {
            close();
            return;
          }
          if (event.target !== event.currentTarget) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close();
        }}
      >
        <div className="pmn-drawer-heading">
          <div>
            <span className="pmn-eyebrow">Van der Tweel</span>
            <h2 id={`${id}-title`}>{title}</h2>
          </div>
          <button type="button" className="pmn-close" onClick={close} aria-label="Close menu">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        <p id={`${id}-context`} className="pmn-context">{context}</p>
        <div className="pmn-content">
          {children}
        </div>
        {footer ? <div className="pmn-footer">{footer}</div> : null}
      </dialog>
    </div>
  );
}
