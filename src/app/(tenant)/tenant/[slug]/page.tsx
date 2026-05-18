
import EventHome from "@/components/templates/template_1/src/components/EventHome";
import TemplateEditorial_2 from "@/components/templates/template_2/src/app/EventHome";
import Template_3 from "@/components/templates/template_3/src/components/EventHome";
import Template_4 from "@/components/templates/template_4/src/components/EventHome";
import Template_5 from "@/components/templates/template_5/src/components/EventHome";
import Template_6 from "@/components/templates/template_6/src/components/EventHome";
import Template_7 from "@/components/templates/template_7/src/components/EventHome";
import Template_8 from "@/components/templates/template_8/src/components/EventHome";
import Template_9 from "@/components/templates/template_9/src/components/EventHome";
import Template_10 from "@/components/templates/template_10/src/components/EventHome";
import { notFound } from "next/navigation";
import { getSubEvents, getEventById } from "@/lib/firestore";
import { SubEventsGrid } from "@/components/SubEventsGrid";

// Import all the new templates from src/components
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

        // Keep legacy references just in case they are used in db
        case 'template_1': return <EventHome event={plainEvent} subEvents={plainSubEvents} basePath={basePath} />;
        case 'template_2': return <TemplateEditorial_2 event={plainEvent} subEvents={plainSubEvents} basePath={basePath} />;
        case 'template_3': return <Template_3 event={plainEvent} subEvents={plainSubEvents} basePath={basePath} />;
        case 'template_4': return <Template_4 event={plainEvent} subEvents={plainSubEvents} basePath={basePath} />;
        case 'template_5': return <Template_5 event={plainEvent} subEvents={plainSubEvents} basePath={basePath} />;
        case 'template_6': return <Template_6 event={plainEvent} subEvents={plainSubEvents} basePath={basePath} />;
        case 'template_7': return <Template_7 event={plainEvent} subEvents={plainSubEvents} basePath={basePath} />;
        case 'template_8': return <Template_8 event={plainEvent} subEvents={plainSubEvents} basePath={basePath} />;
        case 'template_9': return <Template_9 event={plainEvent} subEvents={plainSubEvents} basePath={basePath} />;
        case 'template_10': return <Template_10 event={plainEvent} subEvents={plainSubEvents} basePath={basePath} />;

        default: return <TemplateHero event={plainEvent}>{grid}</TemplateHero>;
    }
}
