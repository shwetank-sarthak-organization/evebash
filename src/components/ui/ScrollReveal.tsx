"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";

interface ScrollRevealProps {
    children: React.ReactNode;
    width?: "fit-content" | "100%";
    className?: string;
    delay?: number;
    direction?: "up" | "down" | "left" | "right" | "none";
    duration?: number;
}

export const ScrollReveal = ({
    children,
    width = "100%",
    className = "",
    delay = 0,
    direction = "up",
    duration = 0.8
}: ScrollRevealProps) => {
    const ref = useRef(null);
    const reducedMotion = useReducedMotion();
    const isInView = useInView(ref, { once: true, margin: "-10%" });
    // Content renders visible (server HTML, no JavaScript, background tabs). Only sections still below the
    // screen in a visible tab are hidden after load, so they can animate in when scrolled to.
    const [armed, setArmed] = useState(false);

    useEffect(() => {
        if (reducedMotion || document.visibilityState !== "visible" || !ref.current) return;
        if ((ref.current as HTMLElement).getBoundingClientRect().top < window.innerHeight) return;
        setArmed(true);
    }, [reducedMotion]);

    const getVariants = () => {
        const distance = 50;
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
                    // ease: "easeOut", // Removed to fix build error
                    delay: delay
                }
            }
        };
    };

    return (
        <div ref={ref} style={{ width, overflow: "hidden" }} className={className}>
            <motion.div
                variants={getVariants()}
                initial={false}
                animate={!armed || isInView ? "visible" : "hidden"}
            >
                {children}
            </motion.div>
        </div>
    );
};
