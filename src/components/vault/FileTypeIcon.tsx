import { File, FileArchive, FileAudio, FileImage, FileSpreadsheet, FileText, FileVideo } from "lucide-react";
import { fileTypeKey } from "./format";

export function FileTypeIcon({ mimeType, extension, className }: { mimeType: string; extension: string; className?: string }) {
    const props = { className, "aria-hidden": true } as const;
    switch (fileTypeKey(mimeType, extension)) {
        case "image": return <FileImage {...props} />;
        case "video": return <FileVideo {...props} />;
        case "audio": return <FileAudio {...props} />;
        case "sheet": return <FileSpreadsheet {...props} />;
        case "archive": return <FileArchive {...props} />;
        case "document": return <FileText {...props} />;
        default: return <File {...props} />;
    }
}
