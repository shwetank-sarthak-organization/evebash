import type { Metadata } from "next";
import { getSampleGallerySummary } from "@/lib/seo";
import SampleGalleryView from "./SampleGalleryView";

type Props = { params: Promise<{ client: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { client } = await params;
    const id = decodeURIComponent(client);
    const gallery = await getSampleGallerySummary(id);

    // Not in the sample list (an old link or another reference): the view still opens it, but it isn't indexed.
    if (!gallery) {
        return { title: { absolute: "Sample gallery · EveBash" }, robots: { index: false }, alternates: { canonical: null } };
    }

    const name = gallery.title || "Sample gallery";
    const title = `${name} sample gallery · EveBash`;
    const description = `Browse the ${name} sample gallery the way guests do: view the photos, find yours with a selfie and download them.`;
    const url = `/sample-galleries/${encodeURIComponent(gallery.id)}`;
    const images = gallery.cover_image ? [{ url: gallery.cover_image, alt: name }] : undefined;

    return {
        title: { absolute: title },
        description,
        alternates: { canonical: url },
        openGraph: { title, description, url, ...(images && { images }) },
        twitter: { card: "summary_large_image", title, description, ...(images && { images }) },
    };
}

export default async function SampleGalleryPage({ params }: Props) {
    const { client } = await params;
    const initial = await getSampleGallerySummary(decodeURIComponent(client));
    return <SampleGalleryView client={client} initial={initial} />;
}
