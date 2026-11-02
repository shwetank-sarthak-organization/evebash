"use client";

import { domAnimation, LazyMotion } from "framer-motion";

// Homepage animations use framer-motion's slim `m` components; this loads only the animation features they
// need instead of the full library.
export default function HomeMotion({ children }: { children: React.ReactNode }) {
    return <LazyMotion features={domAnimation}>{children}</LazyMotion>;
}
