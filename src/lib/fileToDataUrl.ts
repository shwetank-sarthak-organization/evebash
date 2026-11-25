/** Reads a picked file as a data: link (for JSON uploads such as the profile picture). */
export function fileToDataUrl(file: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(reader.error || new Error("Could not read the file"));
        reader.readAsDataURL(file);
    });
}
