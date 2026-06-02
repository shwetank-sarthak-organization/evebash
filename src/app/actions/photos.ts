"use server";

import { supabase } from "@/lib/supabase";

export interface SimplePhoto {
    id: string;
    src: string;
    eventId: string;
    width: number;
    height: number;
}

export async function getAllPhotos(): Promise<SimplePhoto[]> {
    const { data, error } = await supabase
        .from("photos")
        .select("id,event_id,url,width,height,media_type,resource_type")
        .neq("media_type", "video")
        .neq("resource_type", "video")
        .order("uploaded_at", { ascending: false });

    if (error) {
        console.error("[Photos] Failed to fetch photos:", error);
        return [];
    }

    return (data || [])
        .filter((photo) => !!photo.url)
        .map((photo) => ({
            id: photo.id,
            src: photo.url,
            eventId: photo.event_id,
            width: photo.width || 800,
            height: photo.height || 600,
        }));
}
