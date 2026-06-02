"use client";

import { supabase } from "./supabase";

const eventData = {
    haldi: {
        title: "The Haldi",
        description: "Yellow & Bright",
        date: "2025-12-10",
        coverImage: "https://images.unsplash.com/photo-1596229569774-706327b9b1cc?w=1600&auto=format&fit=crop",
    },
    mehendi: {
        title: "Mehandi Madness",
        description: "Hands of Love",
        date: "2025-12-11",
        coverImage: "https://images.unsplash.com/photo-1621621667797-e06afc217fb0?w=1600&auto=format&fit=crop",
    },
    wedding: {
        title: "The Wedding",
        description: "A Tale of Forever",
        date: "2025-12-12",
        coverImage: "https://images.unsplash.com/photo-1583939003579-730e3918a45a?w=1600&auto=format&fit=crop",
    },
    reception: {
        title: "The Reception",
        description: "Party all Night",
        date: "2025-12-13",
        coverImage: "https://images.unsplash.com/photo-1520854221256-17451cc330e7?w=1600&auto=format&fit=crop",
    }
};

export async function seedDatabase() {
    console.log("Seeding started in Supabase...");

    try {
        for (const [key, data] of Object.entries(eventData)) {
            const { error } = await supabase.from("events").upsert({
                id: key,
                title: data.title,
                description: data.description,
                date: data.date,
                cover_image: data.coverImage,
                template_id: "hero",
                type: "main"
            });

            if (error) throw error;
        }
        console.log("Seeding completed in Supabase!");
        return "Success";
    } catch (error) {
        console.error("Error seeding database:", error);
        throw error;
    }
}
