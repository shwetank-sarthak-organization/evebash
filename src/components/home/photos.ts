// Homepage photos (public/home), all from Pexels (free to use, no credit needed; don't imply the people
// in them endorse EveBash). The couple, bride and groom shots are one wedding by Deepak Sharma, and the haldi
// shots one haldi by Nitin Prajapati, so the Find You demos show the same person in the selfie and the matches.
export const photos = {
    couple: { src: "/home/couple.jpg", alt: "A bride in a red lehenga and a groom in an ivory sherwani at their wedding" },
    mandap: { src: "/home/mandap.jpg", alt: "A floral wedding mandap with chandeliers" },
    haldi: { src: "/home/haldi.jpg", alt: "An elder applying haldi to a guest at a haldi ceremony" },
    celebration: { src: "/home/petals.jpg", alt: "Family in yellow celebrating the groom at his haldi ceremony" },
    selfie: { src: "/home/bride-selfie.jpg", alt: "The bride in her red wedding lehenga" },
    matched1: { src: "/home/bride-1.jpg", alt: "The bride and groom under string lights" },
    matched2: { src: "/home/bride-2.jpg", alt: "The bride smiling beside the groom" },
    matched3: { src: "/home/bride-3.jpg", alt: "The bride and groom standing together at night" },
    matched4: { src: "/home/bride-4.jpg", alt: "The bride and groom touching foreheads" },
    groomSelfie: { src: "/home/groom-selfie.jpg", alt: "The groom in his sherwani and safa" },
    groomSolo: { src: "/home/groom-solo.jpg", alt: "The groom standing at the venue at night" },
    haldiSelfie: { src: "/home/haldi-bride-selfie.jpg", alt: "A bride in sunglasses dancing at her haldi" },
    haldiFamily: { src: "/home/haldi-family.jpg", alt: "The haldi bride with her parents" },
    photographer: { src: "/home/audience-photographer.jpg", alt: "A photographer taking pictures of a bride" },
    organizers: { src: "/home/audience-organizer.jpg", alt: "Two event planners setting up a registration desk" },
    guests: { src: "/home/audience-guests.jpg", alt: "Wedding guests at night, one looking at photos on his phone" },
    fest: { src: "/home/fest.jpg", alt: "Confetti falling over the crowd at a night concert" },
    sports: { src: "/home/sports.jpg", alt: "A marathon runner celebrating during the race" },
    corporate: { src: "/home/corporate.jpg", alt: "Attendees listening at a business workshop" },
} as const;

export type Photo = (typeof photos)[keyof typeof photos];

export const matchedPhotos = [photos.matched1, photos.matched2, photos.matched3, photos.matched4];
