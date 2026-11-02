"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import dynamic from "next/dynamic";

// The demos below the hero load their code only when the visitor scrolls near them, so phones don't have
// to download and run it before showing the page. A same-size placeholder holds the space meanwhile.
function whenNear(load: () => Promise<{ default: ComponentType }>, placeholder: string) {
    const Placeholder = () => <div aria-hidden className={placeholder} />;
    const Demo = dynamic(load, { ssr: false, loading: Placeholder });

    return function LazyDemo() {
        const ref = useRef<HTMLDivElement>(null);
        const [near, setNear] = useState(false);

        useEffect(() => {
            const element = ref.current;
            if (!element || typeof IntersectionObserver === "undefined") {
                setNear(true);
                return;
            }
            const observer = new IntersectionObserver(
                ([entry]) => {
                    if (entry.isIntersecting) {
                        setNear(true);
                        observer.disconnect();
                    }
                },
                { rootMargin: "600px 0px" }
            );
            observer.observe(element);
            return () => observer.disconnect();
        }, []);

        return <div ref={ref}>{near ? <Demo /> : <Placeholder />}</div>;
    };
}

// Placeholder sizes match each demo's own size, so nothing below jumps when it loads.
export const LazyFindYouVisual = whenNear(() => import("./FindYouVisual"), "aspect-[100/68] w-full");
export const LazyAlbumDemo = whenNear(() => import("./AlbumDemo"), "h-[700px] w-full md:h-[596px] lg:h-[636px]");
export const LazyFinalCtaDemo = whenNear(() => import("./FinalCtaDemo"), "h-[440px] w-full");
