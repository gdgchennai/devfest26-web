"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { currentInternalPath } from "@/lib/safe-redirect";

/**
 * The account control that sits next to the hamburger (full-mode nav only).
 * Signed in → the Google avatar, links to /profile. Signed out → a generic
 * user glyph that goes straight to /signin, carrying the current page as the
 * post-sign-in return target.
 *
 * `hidden` fades it out while the hamburger panel is open (it would otherwise
 * poke through the overlay).
 */
export function AvatarButton({ hidden = false }: { hidden?: boolean }) {
  const router = useRouter();
  const { data, status } = useSession();
  const authed = status === "authenticated";
  const image = authed ? data.user?.image ?? null : null;

  function go() {
    if (authed) {
      router.push("/profile");
    } else {
      router.push(`/signin?callbackUrl=${encodeURIComponent(currentInternalPath("/"))}`);
    }
  }

  return (
    <div
      className={`pointer-events-none fixed right-[calc(1rem_+_3.25rem)] top-7 z-50 transition-opacity duration-200 sm:right-[calc(2rem_+_3.25rem)] ${
        hidden ? "opacity-0 [&_button]:pointer-events-none" : "opacity-100"
      }`}
    >
      {/* Same glow-btn box shell the home / hamburger buttons use. */}
      <span className="glow-btn h-11 w-11 rounded-2xl" data-shape="box">
        <span className="glow-btn__corners" aria-hidden="true" />
        <button
          type="button"
          onClick={go}
          aria-label={authed ? "Your profile" : "Sign in"}
          className="glow-btn__surface pointer-events-auto flex h-11 w-11 items-center justify-center rounded-2xl"
        >
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element -- Google-hosted avatar, outside the ImageKit loader
            <img
              src={image}
              alt=""
              referrerPolicy="no-referrer"
              className="h-7 w-7 rounded-full object-cover"
            />
          ) : (
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true" className="text-paper">
              <circle cx="12" cy="8.5" r="3.5" stroke="currentColor" strokeWidth="2" />
              <path
                d="M5 20c1.4-3.6 4-5.2 7-5.2S17.6 16.4 19 20"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          )}
        </button>
      </span>
    </div>
  );
}
