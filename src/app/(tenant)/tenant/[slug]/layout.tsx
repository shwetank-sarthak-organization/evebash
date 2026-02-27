import { RoyalNavbar } from "@/components/RoyalNavbar";
import EditorialNavbar from "@/components/templates/template_2/src/components/Navbar";
import { EventNavbar } from "@/components/EventNavbar";
import { getEventById, getSubEvents, serializeFirestoreData } from "@/lib/firestore";
import { notFound } from "next/navigation";

export default async function TenantLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;

    // Fetch Event Data for Navbar
    const event = await getEventById(slug);

    if (!event) {
        return notFound();
    }

    const subEvents = await getSubEvents(event.id, event.legacyId);

    // Filter out circular references just in case
    const validSubEvents = subEvents.filter(e => e.id !== event.id);

    // Serialize data to avoid "Only plain objects" error with Firestore Timestamps
    const serializedEvent = serializeFirestoreData(event);
    const serializedSubEvents = serializeFirestoreData(validSubEvents);

    const templateId = event.templateId || 'hero';

    let NavbarComponent;
    let wrapperClass = "min-h-screen font-sans";

    if (templateId === 'editorial' || templateId === 'template_2') {
        NavbarComponent = (
            <EditorialNavbar
                event={event} // Pass raw event if compatible, or specialized serialized if needed
                subEvents={validSubEvents}
                basePath={`/tenant/${slug}`}
            />
        );
        wrapperClass = "bg-editorial-white text-editorial-black font-sans min-h-screen";
    } else if (templateId === 'royal') {
        NavbarComponent = (
            <RoyalNavbar
                event={serializedEvent}
                subEvents={serializedSubEvents}
                basePath={`/tenant/${slug}`}
            />
        );
        wrapperClass = "bg-royal-cream text-royal-maroon font-sans min-h-screen disable-scroll-x";
    } else {
        NavbarComponent = (
            <EventNavbar
                mainEventTitle={event.title}
                mainEventId={event.id}
                subEvents={serializedSubEvents}
                isShared={false}
                basePath={`/tenant/${slug}`}
            />
        );
    }

    return (
        <div className={wrapperClass}>
            {NavbarComponent}
            {/* Main Content Area */}
            {children}
        </div>
    );
}
