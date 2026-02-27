
import { MasonryGrid } from "@/components/ui/MasonryGrid";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { notFound } from "next/navigation";
import { getEventById, getEventPhotos } from "@/lib/firestore";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import React from "react";

// Import templates
import { TemplateBohemian } from "@/components/TemplateBohemian";
import { TemplateBrutalist } from "@/components/TemplateBrutalist";
import { TemplateCinematic } from "@/components/TemplateCinematic";
import { TemplateClassic } from "@/components/TemplateClassic";
import { TemplateEditorial } from "@/components/TemplateEditorial";
import { TemplateHero } from "@/components/TemplateHero";
import { TemplateMuseum } from "@/components/TemplateMuseum";
import { TemplatePolaroid } from "@/components/TemplatePolaroid";
import { TemplateRoyal } from "@/components/TemplateRoyal";
import { TemplateScrapbook } from "@/components/TemplateScrapbook";

import EventHome from "@/components/templates/template_1/src/components/EventHome";
import TemplateEditorial_2 from "@/components/templates/template_2/src/app/EventHome";

export default async function SubEventPage({ params }: { params: Promise<{ slug: string; eventId: string }> }) {
    const { slug, eventId } = await params;

    // 1. Get Events
    const mainEvent = await getEventById(slug);
    const subEvent = await getEventById(eventId);

    if (!mainEvent || !subEvent) return notFound();

    // 2. Get LIVE Photos for this sub-event
    const firestorePhotos = await getEventPhotos(eventId);

    // 3. Transform for the Grid
    const photos = firestorePhotos.map(p => {
        return {
            id: p.id,
            src: p.url || "",
            cloudinaryPublicId: p.cloudinaryPublicId,
            width: p.width || 800,
            height: p.height || 600,
            filename: p.cloudinaryPublicId.split('/').pop()
        };
    });

    const plainSubEvent = JSON.parse(JSON.stringify(subEvent));
    const templateId = mainEvent.templateId || 'hero';
    const basePath = `/tenant/${slug}`;

    // Common Gallery Block
    const galleryBlock = (
        <section className="py-20 px-4 w-full">
            {/* Back Button specifically for gallery view to make nav easier on mobile */}
            <div className="mb-12 flex justify-center">
                <Link href={basePath} className="inline-flex items-center gap-2 px-6 py-3 bg-stone-900 text-white rounded-full shadow-lg hover:bg-stone-800 hover:scale-105 transition-all text-sm font-medium tracking-widest uppercase">
                    <ArrowLeft className="w-4 h-4" />
                    Back to Event
                </Link>
            </div>

            <SectionHeader title="Gallery" subtitle={`${photos.length} Photos`} />

            {photos.length > 0 ? (
                <MasonryGrid photos={photos} eventSlug={slug} />
            ) : (
                <div className="text-center py-20 bg-black/5 rounded-2xl mx-4 border border-dashed border-black/20">
                    <p className="text-stone-500 mb-2 font-serif italic text-xl">No photos found in database.</p>
                    <p className="text-sm text-stone-400 font-mono uppercase tracking-widest">
                        Wait for photos to be uploaded.
                    </p>
                </div>
            )}
        </section>
    );

    // Render using the selected Template Wrapper
    switch (templateId) {
        case 'bohemian': return <TemplateBohemian event={plainSubEvent}>{galleryBlock}</TemplateBohemian>;
        case 'brutalist': return <TemplateBrutalist event={plainSubEvent}>{galleryBlock}</TemplateBrutalist>;
        case 'cinematic': return <TemplateCinematic event={plainSubEvent}>{galleryBlock}</TemplateCinematic>;
        case 'classic': return <TemplateClassic event={plainSubEvent}>{galleryBlock}</TemplateClassic>;
        case 'editorial': return <TemplateEditorial event={plainSubEvent}>{galleryBlock}</TemplateEditorial>;
        case 'hero': return <TemplateHero event={plainSubEvent}>{galleryBlock}</TemplateHero>;
        case 'museum': return <TemplateMuseum event={plainSubEvent}>{galleryBlock}</TemplateMuseum>;
        case 'polaroid': return <TemplatePolaroid event={plainSubEvent}>{galleryBlock}</TemplatePolaroid>;
        case 'royal': return <TemplateRoyal event={plainSubEvent}>{galleryBlock}</TemplateRoyal>;
        case 'scrapbook': return <TemplateScrapbook event={plainSubEvent}>{galleryBlock}</TemplateScrapbook>;

        // Legacy components without {children} support need the legacy layout
        case 'template_1':
        case 'template_2':
        case 'template_3':
        case 'template_4':
        case 'template_5':
        case 'template_6':
        case 'template_7':
        case 'template_8':
        case 'template_9':
        case 'template_10':
            return (
                <>
                    {/* Event Hero */}
                    <div className="relative h-[60vh] w-full overflow-hidden flex items-end justify-center pb-20">
                        <div className="absolute inset-0">
                            {subEvent.coverImage && (
                                <img
                                    src={subEvent.coverImage}
                                    alt={subEvent.title}
                                    className="w-full h-full object-cover"
                                />
                            )}
                            <div className="absolute inset-0 bg-black/40" />
                        </div>
                        <div className="relative z-10 text-center text-white p-4">
                            <p className="text-gold-400 tracking-[0.3em] text-sm uppercase font-semibold mb-2">
                                {subEvent.description || "A Beautiful Celebration"}
                            </p>
                            <h1 className="font-serif text-5xl md:text-7xl font-bold tracking-tight">
                                {subEvent.title}
                            </h1>
                        </div>
                    </div>
                    {galleryBlock}
                    <footer className="bg-stone-900 text-stone-400 py-12 text-center text-sm border-t border-stone-800">
                        <p>© {new Date().getFullYear()} Wedding Album.</p>
                    </footer>
                </>
            );

        default: return <TemplateHero event={plainSubEvent}>{galleryBlock}</TemplateHero>;
    }
}
