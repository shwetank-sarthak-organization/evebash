"use client";

import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CldImage } from "next-cloudinary";
import { onPhotoInteractions, toggleLike, addComment, deletePhotoComment } from "@/lib/firestore";
import { useAuth } from "@/context/AuthContext";
import { Heart, MessageCircle, Send, X, Download, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LightboxProps {
    isOpen: boolean;
    onClose: () => void;
    photo: {
        id: string;
        src: string;
        cloudinaryPublicId?: string;
        alt?: string;
        width?: number;
        height?: number;
        filename?: string;
    } | null;
    onNext?: () => void;
    onPrev?: () => void;
    disableDownload?: boolean;
}

export function Lightbox({ isOpen, onClose, photo, onNext, onPrev, disableDownload = false }: LightboxProps) {
    const { user } = useAuth();
    const [likes, setLikes] = useState<any[]>([]);
    const [comments, setComments] = useState<any[]>([]);
    const [showComments, setShowComments] = useState(false);
    const [newComment, setNewComment] = useState("");
    const [replyingTo, setReplyingTo] = useState<any | null>(null);
    const [isLiking, setIsLiking] = useState(false);
    const [isCommenting, setIsCommenting] = useState(false);
    const commentsEndRef = useRef<HTMLDivElement>(null);
    const commentInputRef = useRef<HTMLInputElement>(null);

    // Get identifier and name
    const getIdentity = () => {
        if (user) {
            return {
                id: user.uid,
                name: user.name || user.email?.split('@')[0] || "User"
            };
        }
        if (typeof window !== "undefined") {
            const saved = sessionStorage.getItem("wedding_guest_details");
            if (saved) {
                const { name, phone } = JSON.parse(saved);
                return { id: phone, name };
            }
        }
        return { id: "anonymous", name: "Guest" };
    };

    const identity = getIdentity();
    const isLiked = likes.some(l => l.userId === identity.id);

    useEffect(() => {
        if (photo?.id && isOpen) {
            const unsubscribe = onPhotoInteractions(photo.id, (data) => {
                setLikes(data.likes);
                setComments(data.comments);
            });
            return () => unsubscribe();
        }
    }, [photo?.id, isOpen]);

    useEffect(() => {
        if (showComments && comments.length > 0) {
            commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [comments.length, showComments]);

    const handleToggleLike = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!photo || isLiking) return;
        setIsLiking(true);
        try {
            await toggleLike(photo.id, identity.id, identity.name);
        } catch (err) {
            console.error("Like failed", err);
        } finally {
            setIsLiking(false);
        }
    };

    const handleAddComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!photo || !newComment.trim() || isCommenting) return;
        setIsCommenting(true);
        try {
            await addComment(
                photo.id,
                identity.id,
                identity.name,
                newComment.trim(),
                replyingTo?.id
            );
            setNewComment("");
            setReplyingTo(null);
        } catch (err) {
            console.error("Comment failed", err);
        } finally {
            setIsCommenting(false);
        }
    };

    const handleDeleteComment = async (commentId: string) => {
        if (!confirm("Are you sure you want to delete this comment?")) return;
        try {
            await deletePhotoComment(commentId);
        } catch (err) {
            console.error("Delete failed", err);
        }
    };

    const handleDownload = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!photo || disableDownload) return;
        try {
            let downloadUrl = photo.src;
            if (downloadUrl.includes("cloudinary.com") && downloadUrl.includes("/upload/")) {
                downloadUrl = downloadUrl.replace("/upload/", "/upload/fl_attachment/");
            }
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.setAttribute('download', photo.filename || 'wedding-photo');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error("Download failed", error);
        }
    };

    // Handle Keyboard events
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
            if (e.key === "ArrowRight" && !showComments) onNext?.();
            if (e.key === "ArrowLeft" && !showComments) onPrev?.();
        };

        if (isOpen) {
            window.addEventListener("keydown", handleKeyDown);
            document.body.style.overflow = "hidden";
            document.body.setAttribute("data-lightbox-open", "true");
        }

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            document.body.style.overflow = "unset";
            document.body.removeAttribute("data-lightbox-open");
        };
    }, [isOpen, onClose, onNext, onPrev, showComments]);

    if (!photo) return null;

    const useCloudinary = !!photo.cloudinaryPublicId || !photo.src.startsWith("http");

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md p-0 md:p-4 overflow-hidden"
                >
                    {/* Background overlay */}
                    <div className="absolute inset-0 z-0 cursor-zoom-out" onClick={onClose} />

                    {/* TOP ACTION BAR */}
                    <div className="absolute top-0 inset-x-0 h-20 bg-gradient-to-b from-black/60 to-transparent z-[60] flex items-center justify-between px-6 pointer-events-none">
                        <div className="flex items-center space-x-2 pointer-events-auto">
                            <span className="text-white/80 text-sm font-medium tracking-wide drop-shadow-md">
                                {photo.filename || "Photo"}
                            </span>
                        </div>

                        <div className="flex items-center space-x-1 pointer-events-auto">
                            {!disableDownload && (
                                <button
                                    onClick={handleDownload}
                                    className="p-2.5 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-all"
                                    title="Download"
                                >
                                    <Download size={20} />
                                </button>
                            )}
                            <button
                                onClick={onClose}
                                className="p-2.5 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-all"
                            >
                                <X size={24} />
                            </button>
                        </div>
                    </div>

                    <div className="relative w-full h-full flex flex-col md:flex-row items-center justify-center z-20 overflow-hidden">
                        {/* Main Image Area */}
                        <div className={cn(
                            "relative flex-grow h-full flex items-center justify-center transition-all duration-500",
                            showComments ? "md:mr-[380px]" : "mr-0"
                        )}>
                            {/* Navigation Buttons */}
                            {onPrev && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); onPrev(); }}
                                    className="absolute left-6 top-1/2 -translate-y-1/2 p-4 text-white/40 hover:text-white hover:bg-white/10 rounded-full transition-all z-50 hidden md:block"
                                >
                                    <ChevronLeft size={44} />
                                </button>
                            )}

                            {onNext && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); onNext(); }}
                                    className="absolute right-6 top-1/2 -translate-y-1/2 p-4 text-white/40 hover:text-white hover:bg-white/10 rounded-full transition-all z-50 hidden md:block"
                                >
                                    <ChevronRight size={44} />
                                </button>
                            )}

                            <motion.div
                                key={photo.src}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 1.05 }}
                                transition={{ duration: 0.3 }}
                                className="relative max-w-full max-h-[85vh] flex items-center justify-center pointer-events-none"
                            >
                                {useCloudinary ? (
                                    <CldImage
                                        src={photo.cloudinaryPublicId || photo.src}
                                        width={photo.width || 1200}
                                        height={photo.height || 1200}
                                        alt={photo.alt || "Event Photo"}
                                        preserveTransformations
                                        className="max-w-[95vw] md:max-w-full max-h-[70vh] md:max-h-[85vh] w-auto h-auto object-contain rounded-lg shadow-2xl pointer-events-auto"
                                    />
                                ) : (
                                    <img
                                        src={photo.src}
                                        alt={photo.alt || "Event Photo"}
                                        className="max-w-[95vw] md:max-w-full max-h-[70vh] md:max-h-[85vh] w-auto h-auto object-contain rounded-lg shadow-2xl pointer-events-auto"
                                    />
                                )}
                            </motion.div>

                            {/* MOBILE BOTTOM ACTIONS */}
                            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center space-x-10 z-[60] md:hidden">
                                <button
                                    onClick={handleToggleLike}
                                    className="flex flex-col items-center space-y-1"
                                >
                                    <Heart
                                        size={32}
                                        className={cn("transition-all duration-300", isLiked ? "fill-rose-500 text-rose-500 scale-125" : "text-white drop-shadow-lg")}
                                    />
                                    <span className="text-[10px] font-bold text-white drop-shadow-md">{likes.length}</span>
                                </button>
                                <button
                                    onClick={() => setShowComments(!showComments)}
                                    className="flex flex-col items-center space-y-1"
                                >
                                    <MessageCircle size={32} className={cn("text-white drop-shadow-lg transition-colors", showComments && "text-royal-gold")} />
                                    <span className="text-[10px] font-bold text-white drop-shadow-md">{comments.length}</span>
                                </button>
                            </div>
                        </div>

                        {/* DESKTOP SIDEBAR ACTIONS */}
                        <div className="hidden md:flex flex-col items-center space-y-10 absolute right-12 top-1/2 -translate-y-1/2 z-[60]">
                            <button
                                onClick={handleToggleLike}
                                className="group flex flex-col items-center space-y-2 pointer-events-auto"
                            >
                                <div className={cn(
                                    "p-5 rounded-3xl border transition-all duration-400 ease-out transform group-active:scale-90",
                                    isLiked ? "bg-rose-500/20 border-rose-500/50 text-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.3)]" : "bg-white/5 border-white/10 text-white/50 group-hover:bg-white/10 group-hover:text-white"
                                )}>
                                    <Heart size={28} className={cn(isLiked && "fill-current")} />
                                </div>
                                <span className="text-[10px] font-bold text-white/40 tracking-[0.2em]">{likes.length} LIKES</span>
                            </button>

                            <button
                                onClick={() => setShowComments(!showComments)}
                                className="group flex flex-col items-center space-y-2 pointer-events-auto"
                            >
                                <div className={cn(
                                    "p-5 rounded-3xl border transition-all duration-400 ease-out transform group-active:scale-90",
                                    showComments ? "bg-royal-gold/20 border-royal-gold/50 text-royal-gold shadow-[0_0_20px_rgba(212,175,55,0.3)]" : "bg-white/5 border-white/10 text-white/50 group-hover:bg-white/10 group-hover:text-white"
                                )}>
                                    <MessageCircle size={28} />
                                </div>
                                <span className="text-[10px] font-bold text-white/40 tracking-[0.2em]">{comments.length} COMMENTS</span>
                            </button>
                        </div>

                        {/* COMMENTS PANEL */}
                        <AnimatePresence>
                            {showComments && (
                                <motion.div
                                    initial={{ x: "100%", opacity: 0 }}
                                    animate={{ x: 0, opacity: 1 }}
                                    exit={{ x: "100%", opacity: 0 }}
                                    transition={{ type: "spring", damping: 28, stiffness: 220 }}
                                    className="absolute bottom-0 md:top-0 right-0 w-full md:w-[380px] h-[70vh] md:h-full bg-white/95 md:bg-stone-50/98 backdrop-blur-2xl z-[70] flex flex-col shadow-[-20px_0_60px_rgba(0,0,0,0.4)] rounded-t-[3rem] md:rounded-l-[3.5rem] md:rounded-tr-none overflow-hidden"
                                >
                                    <div className="p-8 pb-6 flex items-center justify-between border-b border-stone-200/50">
                                        <div>
                                            <h3 className="text-2xl font-serif font-bold text-slate-900 italic">Guestbook</h3>
                                            <div className="text-[10px] font-bold text-stone-400 uppercase tracking-[0.2em] mt-1.5 flex items-center">
                                                <div className="w-1 h-1 rounded-full bg-royal-gold mr-2 animate-pulse" />
                                                {comments.length} Shared Thoughts
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setShowComments(false)}
                                            className="p-3 bg-stone-100 rounded-2xl text-stone-400 hover:text-stone-600 transition-all active:scale-95"
                                        >
                                            <X size={20} />
                                        </button>
                                    </div>

                                    <div className="flex-grow overflow-y-auto p-8 space-y-8 scroll-smooth">
                                        {comments.length === 0 ? (
                                            <div className="h-full flex flex-col items-center justify-center opacity-30 py-20 text-center">
                                                <div className="w-20 h-20 bg-stone-100 rounded-full flex items-center justify-center mb-6">
                                                    <MessageCircle size={32} className="text-stone-400" />
                                                </div>
                                                <p className="font-serif italic text-lg text-slate-800">No whispers yet...</p>
                                                <p className="text-sm text-stone-400 mt-2">Write the first beautiful word.</p>
                                            </div>
                                        ) : (
                                            (() => {
                                                const mainComments = comments.filter(c => !c.parentId);
                                                const replies = comments.filter(c => c.parentId);

                                                return mainComments.map((comment, i) => (
                                                    <div key={comment.id} className="space-y-6">
                                                        {/* Main Comment */}
                                                        <motion.div
                                                            initial={{ opacity: 0, y: 10 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            transition={{ delay: i * 0.05 }}
                                                            className="flex space-x-4"
                                                        >
                                                            <div className="flex-shrink-0 w-10 h-10 rounded-2xl bg-slate-900 border border-slate-800 text-white flex items-center justify-center text-xs font-bold shadow-lg shadow-slate-200">
                                                                {comment.userName.charAt(0)}
                                                            </div>
                                                            <div className="flex-grow space-y-1.5 min-w-0">
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-xs font-bold text-slate-900 truncate pr-2">{comment.userName}</span>
                                                                    <span className="text-[10px] text-stone-400 font-medium whitespace-nowrap">
                                                                        {comment.createdAt ? new Date(comment.createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now'}
                                                                    </span>
                                                                </div>
                                                                <div className="bg-white p-4 rounded-2xl rounded-tl-none border border-stone-100 shadow-sm group">
                                                                    <p className="text-[13px] text-stone-600 leading-relaxed font-sans">{comment.text}</p>
                                                                    <div className="mt-2 flex items-center space-x-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                        <button
                                                                            onClick={() => {
                                                                                setReplyingTo(comment);
                                                                                commentInputRef.current?.focus();
                                                                            }}
                                                                            className="text-[10px] font-bold text-royal-gold uppercase tracking-widest hover:text-amber-600"
                                                                        >
                                                                            Reply
                                                                        </button>
                                                                        {comment.userId === identity.id && (
                                                                            <button
                                                                                onClick={() => handleDeleteComment(comment.id)}
                                                                                className="text-[10px] font-bold text-rose-400 uppercase tracking-widest hover:text-rose-600 flex items-center"
                                                                            >
                                                                                <Trash2 size={10} className="mr-1" />
                                                                                Delete
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </motion.div>

                                                        {/* Replies */}
                                                        {replies.filter(r => r.parentId === comment.id).map((reply, ri) => (
                                                            <motion.div
                                                                key={reply.id}
                                                                initial={{ opacity: 0, x: 10 }}
                                                                animate={{ opacity: 1, x: 0 }}
                                                                transition={{ delay: ri * 0.05 }}
                                                                className="flex space-x-3 ml-12"
                                                            >
                                                                <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-slate-700 border border-slate-600 text-white flex items-center justify-center text-[10px] font-bold shadow-md">
                                                                    {reply.userName.charAt(0)}
                                                                </div>
                                                                <div className="flex-grow space-y-1 min-w-0">
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-[11px] font-bold text-slate-800 truncate pr-2">{reply.userName}</span>
                                                                        <span className="text-[9px] text-stone-400 font-medium whitespace-nowrap">
                                                                            {reply.createdAt ? new Date(reply.createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now'}
                                                                        </span>
                                                                    </div>
                                                                    <div className="bg-stone-50/50 p-3 rounded-xl rounded-tl-none border border-stone-100 shadow-sm group">
                                                                        <p className="text-[12px] text-stone-500 leading-relaxed font-sans italic">{reply.text}</p>
                                                                        {reply.userId === identity.id && (
                                                                            <button
                                                                                onClick={() => handleDeleteComment(reply.id)}
                                                                                className="mt-1 text-[8px] font-bold text-rose-400 uppercase tracking-widest hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity flex items-center"
                                                                            >
                                                                                <Trash2 size={8} className="mr-1" />
                                                                                Delete
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </motion.div>
                                                        ))}
                                                    </div>
                                                ));
                                            })()
                                        )}
                                        <div ref={commentsEndRef} />
                                    </div>

                                    <div className="p-8 bg-white border-t border-stone-100/50 shadow-[0_-10px_30px_rgba(0,0,0,0.02)]">
                                        <form onSubmit={handleAddComment} className="space-y-4">
                                            {replyingTo && (
                                                <motion.div
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: 'auto' }}
                                                    className="flex items-center justify-between bg-stone-50 px-4 py-2 rounded-xl border border-stone-100"
                                                >
                                                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                                                        Replying to <span className="text-royal-gold">{replyingTo.userName}</span>
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setReplyingTo(null)}
                                                        className="text-stone-400 hover:text-rose-500 transition-colors"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </motion.div>
                                            )}

                                            <div className="relative group">
                                                <input
                                                    ref={commentInputRef}
                                                    type="text"
                                                    placeholder={replyingTo ? "Write a reply..." : "Share a wish..."}
                                                    value={newComment}
                                                    onChange={(e) => setNewComment(e.target.value)}
                                                    className="w-full pl-6 pr-14 py-5 bg-stone-50 border border-stone-100 rounded-[1.5rem] text-sm focus:outline-none focus:ring-4 focus:ring-royal-gold/5 focus:border-royal-gold/30 transition-all font-sans"
                                                />
                                                <button
                                                    type="submit"
                                                    disabled={!newComment.trim() || isCommenting}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-3 bg-slate-900 text-white rounded-xl disabled:opacity-20 transition-all hover:bg-slate-800 active:scale-90 shadow-xl shadow-slate-200"
                                                >
                                                    <Send size={18} />
                                                </button>
                                            </div>
                                        </form>
                                        <div className="mt-4 flex items-center justify-center space-x-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                            <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest leading-none">Posting as {identity.name}</p>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
