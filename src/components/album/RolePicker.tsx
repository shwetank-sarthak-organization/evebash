"use client";

import { useEffect, useState } from "react";
import { Camera, Check, Heart, Loader2 } from "lucide-react";
import { albumApi, type AlbumRoleCandidate, type AlbumRoles } from "@/lib/albumApi";
import { ModalHeader, modalStyles } from "@/components/ui/Modal";
import { cn } from "@/lib/utils";
import { albumButton } from "./albumUi";

const cache = new Map<string, AlbumRoleCandidate[]>();

export const rolesComplete = (roles: Partial<AlbumRoles>): roles is AlbumRoles =>
    Boolean(roles.photographerId) && Boolean(roles.clientIds?.length);

function Person({ person, selected, disabled, multi, onClick }: {
    person: AlbumRoleCandidate;
    selected: boolean;
    disabled?: boolean;
    multi?: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-pressed={selected}
            className={cn(
                "flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-colors",
                selected ? "border-[#CA9C68] bg-[#CA9C68]/10" : "border-white/10 hover:border-white/25",
                disabled && "cursor-not-allowed opacity-40 hover:border-white/10"
            )}
        >
            <span className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center border-2",
                multi ? "rounded-md" : "rounded-full",
                selected ? "border-[#CA9C68] bg-[#CA9C68] text-[#13191F]" : "border-slate-600"
            )}>
                {selected && <Check className="h-3 w-3" strokeWidth={4} />}
            </span>
            <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-white">{person.name}</span>
                {person.email && <span className="block truncate text-[11px] font-semibold text-slate-500">{person.email}</span>}
            </span>
            <span className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider",
                person.isHost ? "bg-[#CA9C68]/15 text-[#E8C9A0]" : "bg-white/10 text-slate-300"
            )}>{person.isHost ? "Host" : "Admin"}</span>
        </button>
    );
}

/**
 * Picks the album's photographer (one) and clients (one or more) from the event host and guests with Admin Access.
 * Nobody can hold both roles.
 */
export function RolePicker({ eventId, value, onChange }: {
    eventId: string;
    value: Partial<AlbumRoles>;
    onChange: (roles: Partial<AlbumRoles>) => void;
}) {
    const [candidates, setCandidates] = useState<AlbumRoleCandidate[] | null>(cache.get(eventId) ?? null);
    const [error, setError] = useState("");

    useEffect(() => {
        if (cache.has(eventId)) return;
        albumApi.candidates(eventId)
            .then(({ candidates }) => { cache.set(eventId, candidates); setCandidates(candidates); })
            .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load the guest list."));
    }, [eventId]);

    if (error) return <p className={modalStyles.error}>{error}</p>;
    if (!candidates) return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-[#CA9C68]" /></div>;

    const clients = value.clientIds ?? [];
    // Picking someone for one role takes them out of the other, so roles can be swapped in one go
    const toggleClient = (id: string) =>
        onChange(clients.includes(id)
            ? { ...value, clientIds: clients.filter((c) => c !== id) }
            : { photographerId: value.photographerId === id ? undefined : value.photographerId, clientIds: [...clients, id] });
    const pickPhotographer = (id: string) => onChange({ photographerId: id, clientIds: clients.filter((c) => c !== id) });

    return (
        <div className="space-y-5">
            <div>
                <p className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
                    <Camera className="h-3.5 w-3.5 text-[#CA9C68]" /> Photographer
                    <span className="normal-case tracking-normal text-slate-500">· uploads pages and sends them for review</span>
                </p>
                <div className="space-y-2">
                    {candidates.map((person) => (
                        <Person
                            key={person.id}
                            person={person}
                            selected={value.photographerId === person.id}
                            onClick={() => pickPhotographer(person.id)}
                        />
                    ))}
                </div>
            </div>
            <div>
                <p className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
                    <Heart className="h-3.5 w-3.5 text-[#CA9C68]" /> Client
                    <span className="normal-case tracking-normal text-slate-500">· comment, approve and send feedback (one or more)</span>
                </p>
                <div className="space-y-2">
                    {candidates.map((person) => (
                        <Person
                            key={person.id}
                            person={person}
                            multi
                            selected={clients.includes(person.id)}
                            onClick={() => toggleClient(person.id)}
                        />
                    ))}
                </div>
            </div>
            {(!value.photographerId || !clients.length) && (
                <p className="text-xs font-bold text-[#E8C9A0]">{!value.photographerId ? "Choose the photographer." : "Choose at least one client."}</p>
            )}
            {candidates.length < 2 && (
                <p className="rounded-2xl border border-[#CA9C68]/25 bg-[#CA9C68]/[0.06] p-3 text-xs font-semibold leading-5 text-[#E8C9A0]">
                    Only the host can be picked right now. Add the photographer or the client as guests and turn on
                    <span className="font-black"> Admin Access</span> in Permissions, then come back.
                </p>
            )}
        </div>
    );
}

/** "Assign roles" for albums made before roles existed, and "Change roles" from the album menu. */
export function RolesDialog({ eventId, albumId, initial, title, onClose, onSaved }: {
    eventId: string;
    albumId: string;
    initial: Partial<AlbumRoles>;
    title: string;
    onClose: () => void;
    onSaved: (album: Awaited<ReturnType<typeof albumApi.setRoles>>["album"]) => void;
}) {
    const [roles, setRoles] = useState<Partial<AlbumRoles>>(initial);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => { if (event.key === "Escape" && !saving) onClose(); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose, saving]);

    const save = async () => {
        if (!rolesComplete(roles)) return;
        setSaving(true);
        setError("");
        try {
            onSaved((await albumApi.setRoles(albumId, roles)).album);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Couldn't save the roles.");
            setSaving(false);
        }
    };

    return (
        <div className={modalStyles.overlay} onClick={() => !saving && onClose()}>
            <div className={cn(modalStyles.panel, "max-w-lg")} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="album-roles-title">
                <ModalHeader titleId="album-roles-title" eyebrow="Album roles" title={title} subtitle="Pick from the event host and guests with Admin Access." onClose={onClose} closeDisabled={saving} />
                <div className="max-h-[60vh] overflow-y-auto pr-1">
                    <RolePicker eventId={eventId} value={roles} onChange={setRoles} />
                </div>
                {error && <p className={cn(modalStyles.error, "mt-4")}>{error}</p>}
                <div className={modalStyles.actions}>
                    <button type="button" className={albumButton.secondary} onClick={onClose} disabled={saving}>Cancel</button>
                    <button type="button" className={albumButton.primary} onClick={save} disabled={saving || !rolesComplete(roles)}>
                        {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save roles
                    </button>
                </div>
            </div>
        </div>
    );
}
