export interface EventData {
    id: string;
    title: string;
    description: string;
    date: string;
    coverImage: string;
}

export const events: Record<string, EventData> = {
    haldi: {
        id: "haldi",
        title: "The Haldi",
        description: "Yellow & Bright",
        date: "2025-12-10",
        coverImage: "https://images.unsplash.com/photo-1606800052052-a08af7148866?q=80&w=1400&auto=format&fit=crop",
    },
    mehendi: {
        id: "mehendi",
        title: "Mehandi Madness",
        description: "Hands of Love",
        date: "2025-12-11",
        coverImage: "https://images.unsplash.com/photo-1610173827043-62c0f1f05d04?q=80&w=1400&auto=format&fit=crop",
    },
    wedding: {
        id: "wedding",
        title: "The Wedding",
        description: "A Tale of Forever",
        date: "2025-12-12",
        coverImage: "https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=1400&auto=format&fit=crop",
    },
    reception: {
        id: "reception",
        title: "The Reception",
        description: "Party all Night",
        date: "2025-12-13",
        coverImage: "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?q=80&w=1400&auto=format&fit=crop",
    }
};

export function getEvent(slug: string): EventData | null {
    return events[slug] || null;
}

export function getAllEvents(): EventData[] {
    return Object.values(events);
}
