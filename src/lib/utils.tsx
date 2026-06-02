import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function formatEventDate(dateStr?: string): string {
    if (!dateStr) return "";

    try {
        // If it's already a nicely formatted verbal date (e.g. contains month name and a year),
        // we can return it directly to preserve user's custom formatting.
        const isVerbal = /jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i.test(dateStr) && !dateStr.includes("T");
        if (isVerbal) {
            return dateStr;
        }

        let dateObj: Date;
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) {
            // Standard YYYY-MM-DD. Replace dashes with slashes to force local time parsing
            // to avoid timezone offset shifts.
            dateObj = new Date(dateStr.replace(/-/g, "/"));
        } else {
            dateObj = new Date(dateStr);
        }

        if (isNaN(dateObj.getTime())) {
            return dateStr;
        }

        return dateObj.toLocaleDateString("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric"
        });
    } catch (e) {
        return dateStr;
    }
}
