"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { domAnimation, LazyMotion, m, useInView, useReducedMotion, type Easing } from "framer-motion";

interface ScrollRevealProps {
    children: React.ReactNode;
    width?: "fit-content" | "100%";
    className?: string;
    delay?: number;
    direction?: "up" | "down" | "left" | "right" | "none";
    duration?: number;
    distance?: number;
    ease?: Easing;
}

// Content renders visible (server HTML, no JavaScript, background tabs). Only elements still below the
// screen in a visible tab are hidden after load (armed), so they can animate in when scrolled to.
export function useRevealArmed(ref: RefObject<HTMLElement | null>) {
    const reducedMotion = useReducedMotion();
    const inView = useInView(ref, { once: true, margin: "-10%" });
    const [armed, setArmed] = useState(false);

    useEffect(() => {
        if (reducedMotion || document.visibilityState !== "visible" || !ref.current) return;
        if (ref.current.getBoundingClientRect().top < window.innerHeight) return;
        setArmed(true);
    }, [reducedMotion, ref]);

    return { armed, inView, show: !armed || inView };
}

export const ScrollReveal = ({
    children,
    width = "100%",
    className = "",
    delay = 0,
    direction = "up",
    duration = 0.8,
    distance = 50,
    ease
}: ScrollRevealProps) => {
    const ref = useRef<HTMLDivElement>(null);
    const { show } = useRevealArmed(ref);

    const getVariants = () => {
        let initial = {};

        switch (direction) {
            case "up": initial = { y: distance, opacity: 0 }; break;
            case "down": initial = { y: -distance, opacity: 0 }; break;
            case "left": initial = { x: distance, opacity: 0 }; break;
            case "right": initial = { x: -distance, opacity: 0 }; break;
            case "none": initial = { opacity: 0 }; break;
        }

        return {
            hidden: { ...initial, transition: { duration: 0 } },
            visible: {
                x: 0,
                y: 0,
                opacity: 1,
                transition: {
                    duration: duration,
                    ...(ease ? { ease } : {}),
                    delay: delay
                }
            }
        };
    };

    return (
        <div ref={ref} style={{ width, overflow: "hidden" }} className={className}>
            {/* Slim framer-motion: loads only the animation features this needs, on any page. */}
            <LazyMotion features={domAnimation}>
                <m.div
                    className="h-full"
                    variants={getVariants()}
                    initial={false}
                    animate={show ? "visible" : "hidden"}
                >
                    {children}
                </m.div>
            </LazyMotion>
        </div>
    );
};
