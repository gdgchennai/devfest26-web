import gsap from "gsap";
import { CustomEase } from "gsap/CustomEase";

gsap.registerPlugin(CustomEase);

CustomEase.create("devfestSettle", "0.16, 1, 0.3, 1");
CustomEase.create("devfestCurtain", "0.76, 0, 0.24, 1");
CustomEase.create("devfestFacts", "0.22, 1, 0.36, 1");

/** Fast-out-slow-in settle — frame opening, image scale, headline mask-in, pile settle. */
export const EASE_SETTLE = "devfestSettle";
/** Sharp sweep — the ink curtain, both intro and route-transition modes. */
export const EASE_CURTAIN = "devfestCurtain";
/** Gentle fade-up — nav, facts, CTAs. */
export const EASE_FACTS = "devfestFacts";
