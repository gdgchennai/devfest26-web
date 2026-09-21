"use client";

import { Fragment, useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { creators as c } from "@/lib/creators";

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText);

/** Renders `**bold**` spans from lib/creators.ts as <strong>. */
function Inline({ text }: { text: string }) {
  return (
    <>
      {text.split("**").map((part, i) =>
        i % 2 === 1 ? (
          <strong key={i} className="text-paper font-semibold">
            {part}
          </strong>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

export function CreatorsContent() {
  const containerRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useGSAP(
    () => {
      // 1. Kinetic Typography: Split and animate the main page title
      if (titleRef.current) {
        const split = new SplitText(titleRef.current, { type: "words,chars" });
        gsap.from(split.chars, {
          opacity: 0,
          y: 40,
          scale: 0.8,
          rotationX: -30,
          stagger: 0.03,
          duration: 1.2,
          ease: "back.out(1.7)",
        });
      }

      // 2. Parallax Glass Cards and Staggered Lists on Scroll
      const cards = gsap.utils.toArray<HTMLElement>(".creator-card");
      cards.forEach((card) => {
        // Animate the card container rising up
        gsap.fromTo(
          card,
          { opacity: 0, y: 50 },
          {
            opacity: 1,
            y: 0,
            duration: 0.85,
            ease: "power2.out",
            scrollTrigger: {
              trigger: card,
              start: "top 85%",
              toggleActions: "play none none none",
            },
          }
        );

        // Stagger reveal the bullet list items inside the card
        const listItems = card.querySelectorAll("li");
        if (listItems.length > 0) {
          gsap.fromTo(
            listItems,
            { opacity: 0, x: -15 },
            {
              opacity: 1,
              x: 0,
              stagger: 0.1,
              duration: 0.6,
              ease: "power2.out",
              scrollTrigger: {
                trigger: card,
                start: "top 80%",
                toggleActions: "play none none none",
              },
            }
          );
        }
      });
    },
    { scope: containerRef }
  );

  return (
    <div
      ref={containerRef}
      className="relative min-h-screen overflow-hidden bg-ink py-16 px-4 sm:py-24 sm:px-8"
    >
      {/* Decorative background ambient neon glows */}
      <div className="pointer-events-none absolute left-[-10%] top-[15%] h-[30vw] w-[30vw] rounded-full bg-blue/10 blur-[120px]" />
      <div className="pointer-events-none absolute right-[-5%] top-[45%] h-[25vw] w-[25vw] rounded-full bg-red/10 blur-[100px]" />
      <div className="pointer-events-none absolute left-[15%] bottom-[10%] h-[35vw] w-[35vw] rounded-full bg-yellow/5 blur-[150px]" />

      {/* Main Core Content Container */}
      <div className="mx-auto max-w-4xl relative z-10">

        {/* Verification Check: Raw verbatim Header layout */}
        <div className="text-center mb-16 sm:mb-24">
          <span className="text-xs font-bold uppercase tracking-[0.25em] text-blue mb-3 block">
            {c.eyebrow}
          </span>
          <h1 className="text-3xl font-extrabold tracking-wider text-paper mb-2 uppercase sm:text-5xl">
            {c.title}
          </h1>
          <p className="text-lg font-semibold tracking-[0.15em] text-red uppercase mb-6 sm:text-2xl">
            {c.tagline}
          </p>
          <div className="h-[1px] w-12 bg-paper/20 mx-auto mb-6" />
          <p className="text-base text-paper/80 font-medium sm:text-lg">
            {c.dateLine}
          </p>
        </div>

        {/* Section 1: An Invitation to Creators */}
        <header ref={titleRef} className="text-center mb-12 sm:mb-16">
          <h2 className="text-2xl font-bold tracking-tight text-paper uppercase sm:text-4xl">
            {c.heading}
          </h2>
        </header>

        <section className="creator-card bg-paper/[0.03] border border-paper/10 backdrop-blur-md rounded-3xl p-6 sm:p-10 mb-10 shadow-2xl relative transition-all duration-300 hover:border-paper/20">
          <div className="space-y-6 text-base text-paper/80 leading-relaxed sm:text-lg">
            {c.intro.paragraphs.map((paragraph) => (
              <p key={paragraph}>
                <Inline text={paragraph} />
              </p>
            ))}
            <p className="font-semibold text-blue text-center pt-2 sm:text-xl">
              {c.intro.highlight}
            </p>
          </div>
        </section>

        {/* Section 2: Why Join us? */}
        <section className="creator-card bg-paper/[0.03] border border-paper/10 backdrop-blur-md rounded-3xl p-6 sm:p-10 mb-10 shadow-2xl transition-all duration-300 hover:border-paper/20">
          <h3 className="text-xl font-bold text-paper mb-6 uppercase tracking-wide sm:text-2xl border-b border-paper/10 pb-3">
            {c.why.heading}
          </h3>
          <p className="text-base text-paper/85 leading-relaxed mb-6 sm:text-lg">
            {c.why.lede}
          </p>
          <ul className="space-y-4 mb-8">
            {c.why.questions.map((question) => (
              <li key={question} className="flex items-start gap-3 text-base text-paper/80 leading-relaxed sm:text-lg">
                <span className="text-blue font-bold select-none shrink-0 mt-0.5">&rarr;</span>
                <span>{question}</span>
              </li>
            ))}
          </ul>
          <p className="text-base text-paper/85 leading-relaxed font-medium sm:text-lg border-t border-paper/5 pt-4">
            {c.why.closing}
          </p>
        </section>

        {/* Section 3: What You Can Do at DevFest? */}
        <section className="creator-card bg-paper/[0.03] border border-paper/10 backdrop-blur-md rounded-3xl p-6 sm:p-10 mb-10 shadow-2xl transition-all duration-300 hover:border-paper/20">
          <h3 className="text-xl font-bold text-paper mb-8 uppercase tracking-wide sm:text-2xl border-b border-paper/10 pb-3">
            {c.join.heading}
          </h3>

          <div className="grid gap-8 sm:grid-cols-2">
            <div>
              <h4 className="text-lg font-bold text-blue uppercase mb-3">{c.join.joinUs.title}</h4>
              <p className="text-base text-paper/80 leading-relaxed">
                {c.join.joinUs.body}
              </p>
            </div>
            <div>
              <h4 className="text-lg font-bold text-blue uppercase mb-3">{c.join.lounge.title}</h4>
              <p className="text-base text-paper/80 leading-relaxed mb-4">
                <Inline text={c.join.lounge.body} />
              </p>
              <p className="text-sm font-semibold text-paper/60 uppercase tracking-wider mb-2">{c.join.lounge.listLabel}</p>
              <ul className="space-y-2">
                {c.join.lounge.items.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-paper/75">
                    <span className="text-red select-none shrink-0">&rarr;</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Section 4: Create Something Together */}
        <section className="creator-card bg-paper/[0.03] border border-paper/10 backdrop-blur-md rounded-3xl p-6 sm:p-10 mb-10 shadow-2xl transition-all duration-300 hover:border-paper/20">
          <h3 className="text-xl font-bold text-paper mb-4 uppercase tracking-wide sm:text-2xl">
            {c.together.heading}
          </h3>
          <p className="text-base font-semibold text-yellow mb-6 sm:text-lg">
            {c.together.highlight}
          </p>
          <p className="text-base text-paper/80 leading-relaxed sm:text-lg">
            {c.together.body}
          </p>
        </section>

        {/* Section 5: The Bigger Idea */}
        <section className="creator-card bg-paper/[0.03] border border-paper/10 backdrop-blur-md rounded-3xl p-6 sm:p-10 mb-10 shadow-2xl transition-all duration-300 hover:border-paper/20">
          <h3 className="text-xl font-bold text-paper mb-4 uppercase tracking-wide sm:text-2xl">
            {c.bigger.heading}
          </h3>
          <p className="text-base font-semibold text-red mb-6 sm:text-lg">
            {c.bigger.highlight}
          </p>
          <div className="space-y-4 text-base text-paper/80 leading-relaxed sm:text-lg">
            <p>
              {c.bigger.body}
            </p>
            <p className="font-extrabold text-paper text-center pt-2 sm:text-xl tracking-wide uppercase">
              {c.bigger.closer}
            </p>
          </div>
        </section>

        {/* Section 6: Summary and Closing Invitation Verbatim */}
        <div className="creator-card bg-gradient-to-br from-blue/10 via-paper/5 to-transparent border border-blue/20 rounded-3xl p-8 sm:p-12 text-center shadow-[0_0_50px_rgba(66,133,244,0.08)] mb-12">
          <p className="text-base text-paper/85 leading-relaxed mb-8 sm:text-lg max-w-2xl mx-auto">
            {c.closing.body}
          </p>

          <h3 className="text-2xl font-extrabold text-paper mb-8 sm:text-3xl uppercase tracking-wide">
            {c.closing.heading}
          </h3>

          <div className="inline-flex flex-col gap-2 border-t border-paper/10 pt-6 px-4">
            <p className="text-sm font-semibold tracking-wider text-blue uppercase">{c.closing.date}</p>
            <p className="text-xs text-paper/60 uppercase">{c.closing.venue}</p>
          </div>

          <div className="mt-8 flex flex-col items-center justify-center gap-4 text-xs font-semibold uppercase tracking-wider sm:flex-row sm:gap-8">
            {c.closing.links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-paper/60 hover:text-paper transition-colors underline underline-offset-4"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
