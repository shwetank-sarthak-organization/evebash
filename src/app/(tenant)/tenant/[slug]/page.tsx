
import { notFound } from "next/navigation";
import { getSubEvents, getEventById } from "@/lib/database";
import { SubEventsGrid } from "@/components/SubEventsGrid";

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
import { TemplatePop } from "@/components/TemplatePop";

export default async function TenantPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;

    const event = await getEventById(slug);

    if (!event) {
        return notFound();
    }

    const templateId = event.templateId || 'hero';

    const subEventsData = await getSubEvents(event.id, event.legacyId);

    // Filter out edge case circular main event
    const validSubEvents = subEventsData.filter(e => e.id !== event.id);

    // Serialize for Client Component
    const plainEvent = JSON.parse(JSON.stringify(event));
    const plainSubEvents = JSON.parse(JSON.stringify(validSubEvents));

    const basePath = `/tenant/${slug}`;

    const grid = <SubEventsGrid subEvents={plainSubEvents} basePath={basePath} />;

    switch (templateId) {
        case 'bohemian': return <TemplateBohemian event={plainEvent}>{grid}</TemplateBohemian>;
        case 'brutalist': return <TemplateBrutalist event={plainEvent}>{grid}</TemplateBrutalist>;
        case 'cinematic': return <TemplateCinematic event={plainEvent}>{grid}</TemplateCinematic>;
        case 'classic': return <TemplateClassic event={plainEvent}>{grid}</TemplateClassic>;
        case 'editorial': return <TemplateEditorial event={plainEvent}>{grid}</TemplateEditorial>;
        case 'hero': return <TemplateHero event={plainEvent}>{grid}</TemplateHero>;
        case 'museum': return <TemplateMuseum event={plainEvent}>{grid}</TemplateMuseum>;
        case 'polaroid': return <TemplatePolaroid event={plainEvent}>{grid}</TemplatePolaroid>;
        case 'royal': return <TemplateRoyal event={plainEvent}>{grid}</TemplateRoyal>;
        case 'scrapbook': return <TemplateScrapbook event={plainEvent}>{grid}</TemplateScrapbook>;
        case 'pop': return <TemplatePop event={plainEvent}>{grid}</TemplatePop>;

        default: return <TemplateHero event={plainEvent}>{grid}</TemplateHero>;
    }
}
