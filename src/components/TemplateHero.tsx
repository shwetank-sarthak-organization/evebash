"use client";

import Image from "next/image";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { ArrowRight, Check, Share2 } from "lucide-react";
import { Event } from "@/lib/database";
import { cn } from "@/lib/utils";
import { coverImageStyle } from "@/lib/coverStyle";
import { midnightDisplay, midnightSans } from "@/components/midnight/midnightFonts";
import { displayCoupleTitle, splitCoupleNames } from "../../shared/text/coupleNames";

interface TemplateHeroProps {
  event: Event;
  /** The main event's title (albums show it above their own name) */
  mainTitle?: string;
  mainCategory?: string;
  hasParent?: boolean;
  onShare?: () => void;
  copied?: boolean;
  children?: React.ReactNode;
}

/** "weds" between a wedding couple's names, "&" for any other couple */
function coupleJoiner(category?: string) {
  return (category || "").toLowerCase().includes("wedding") ? "weds" : "&";
}

export function TemplateHero({ event, mainTitle, mainCategory, hasParent = false, onShare, copied = false, children }: TemplateHeroProps) {
  const heroRef = useRef<HTMLElement>(null);
  const reducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  // The photo drifts down a little slower than the page; off for reduced motion
  const photoY = useTransform(scrollYProgress, [0, 1], ["0%", "12%"]);

  const title = (event.title || "").trim();
  const parentTitle = (mainTitle || "").trim();
  // Albums show their own name, with the main event above it; the couple line belongs to the main gallery
  const couple = hasParent ? null : splitCoupleNames(title);
  const isFit = event.coverMode === "fit";

  const scrollToContent = () => {
    document.getElementById("event-content")?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" });
  };

  const handleShare = () => {
    if (onShare) {
      onShare();
      return;
    }
    void navigator.clipboard?.writeText(window.location.href);
  };

  return (
    <div className={cn("midnight", midnightDisplay.variable, midnightSans.variable)}>
      <section ref={heroRef} className="midnight-hero" aria-label="Gallery cover">
        <motion.div className="midnight-hero__media" style={reducedMotion ? undefined : { y: photoY }}>
          {event.coverImage ? (
            <>
              {/* "Fit" covers keep the whole photo; a blurred copy fills the sides */}
              {isFit && <Image src={event.coverImage} alt="" fill sizes="100vw" className="midnight-hero__fill" aria-hidden="true" />}
              <Image
                src={event.coverImage}
                alt={title ? `Cover photo of ${title}` : "Cover photo"}
                fill
                priority
                sizes="100vw"
                className="midnight-hero__photo"
                style={coverImageStyle(event)}
              />
            </>
          ) : (
            <div className="midnight-hero__empty" />
          )}
        </motion.div>
        <div className="midnight-hero__shade" aria-hidden="true" />

        {/* A printed invitation: square card, thin double gold border */}
        <div className="midnight-card">
          <div className="midnight-card__inner">
            {hasParent && parentTitle && <p className="midnight-card__eyebrow">{displayCoupleTitle(parentTitle)}</p>}
            <h1 className="midnight-card__title">
              {couple ? (
                <>
                  {couple[0]} <em>{coupleJoiner(mainCategory || event.category)}</em> {couple[1]}
                </>
              ) : (
                title
              )}
            </h1>
            {event.date && <p className="midnight-card__date">{event.date}</p>}

            <div className="midnight-card__actions">
            <button type="button" onClick={scrollToContent} className="midnight-enter">
              Enter Gallery
              <ArrowRight className="midnight-enter__arrow" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={handleShare}
              className={cn("midnight-share", copied && "midnight-share--done")}
              aria-label={copied ? "Gallery link copied" : "Copy gallery link"}
              title={copied ? "Link copied" : "Share"}
            >
              {copied ? <Check aria-hidden="true" /> : <Share2 aria-hidden="true" />}
            </button>
            <span className="sr-only" aria-live="polite">{copied ? "Gallery link copied" : ""}</span>
            </div>
          </div>
        </div>
      </section>

      {children && (
        <section id="event-content" className="midnight-content">
          {/* Full width with the page's side padding, like Classic White, so the photo rows run edge to edge */}
          <div className="w-full px-4 sm:px-6 lg:px-8">{children}</div>
        </section>
      )}
    </div>
  );
}
