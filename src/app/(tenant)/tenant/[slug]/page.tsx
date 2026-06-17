
import { notFound } from "next/navigation";
import { getSubEvents, getEventById } from "@/lib/database";
import { SubEventsGrid } from "@/components/SubEventsGrid";

import { getWebTemplateComponent } from "@/components/templateRegistry";

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

    const TemplateComponent = getWebTemplateComponent(templateId);
    return <TemplateComponent event={plainEvent}>{grid}</TemplateComponent>;
}
