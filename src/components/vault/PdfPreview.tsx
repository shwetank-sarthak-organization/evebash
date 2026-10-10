"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

const PAGE_BATCH = 10;

// Renders PDFs with pdf.js onto canvases. Browser PDF viewers can't be relied on (Android Chrome
// downloads instead of showing them), so this works the same on every browser.
export function PdfPreview({ url, onError }: { url: string; onError: (message: string) => void }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [pageCount, setPageCount] = useState(0);
    const [rendered, setRendered] = useState(0);
    const [limit, setLimit] = useState(PAGE_BATCH);
    const docRef = useRef<import("pdfjs-dist").PDFDocumentProxy | null>(null);
    const taskRef = useRef<import("pdfjs-dist").PDFDocumentLoadingTask | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const pdfjs = await import("pdfjs-dist");
                pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
                const task = pdfjs.getDocument({ url });
                taskRef.current = task;
                const doc = await task.promise;
                if (cancelled) return;
                docRef.current = doc;
                setPageCount(doc.numPages);
            } catch {
                if (!cancelled) onError("This PDF couldn't be displayed. You can still download it.");
            }
        })();
        return () => {
            cancelled = true;
            void taskRef.current?.destroy();
            taskRef.current = null;
            docRef.current = null;
        };
    }, [url, onError]);

    useEffect(() => {
        const doc = docRef.current;
        const container = containerRef.current;
        if (!doc || !container) return;
        let cancelled = false;
        (async () => {
            const width = container.clientWidth || 600;
            for (let number = rendered + 1; number <= Math.min(limit, pageCount); number += 1) {
                const page = await doc.getPage(number);
                if (cancelled) return;
                const base = page.getViewport({ scale: 1 });
                const scale = width / base.width;
                const ratio = window.devicePixelRatio || 1;
                const viewport = page.getViewport({ scale: scale * ratio });
                const canvas = document.createElement("canvas");
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                canvas.style.width = "100%";
                canvas.setAttribute("aria-label", `Page ${number} of ${pageCount}`);
                canvas.className = "mb-3 rounded-lg bg-white shadow";
                await page.render({ canvas, viewport }).promise;
                if (cancelled) return;
                container.appendChild(canvas);
                setRendered(number);
            }
        })().catch(() => !cancelled && onError("This PDF couldn't be displayed. You can still download it."));
        return () => {
            cancelled = true;
        };
        // Pages are appended incrementally; re-run only when more pages are requested.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pageCount, limit]);

    return (
        <div>
            <div ref={containerRef} />
            {rendered < Math.min(limit, pageCount) || pageCount === 0 ? (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-400">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading PDF…
                </div>
            ) : rendered < pageCount ? (
                <button
                    type="button"
                    onClick={() => setLimit((current) => current + PAGE_BATCH)}
                    className="mx-auto mb-4 block rounded-full border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-slate-400"
                >
                    Show more pages ({rendered} of {pageCount})
                </button>
            ) : null}
        </div>
    );
}
