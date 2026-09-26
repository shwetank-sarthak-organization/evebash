import React, { useState, useMemo, useEffect } from 'react';
import type { Event, Photo, UserProfile, DeletedEventArchive } from '../lib/analytics';
import { isProtectedSuperAdmin, fetchDeletedEvents } from '../lib/analytics';
import { supabase } from '../lib/supabase';
import { GalleryViewer } from './GalleryViewer';
import {
  ArrowLeft,
  User,
  HardDrive,
  CreditCard,
  IndianRupee,
  Calendar,
  Clock,
  ShieldCheck,
  Copy,
  Check,
  FolderTree,
  Image as ImageIcon,
  Video as VideoIcon,
  Sparkles,
  Zap,
  Server,
  Layers,
  Eye,
  Star,
  Trash2,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Search,
  Filter,
  RefreshCw,
} from 'lucide-react';

export type UserDetailTabType = 'info' | 'events' | 'storage' | 'plan' | 'cost';

interface UserDetailPageProps {
  user: UserProfile;
  events?: Event[];
  photos?: Photo[];
  onBack: () => void;
  initialTab?: UserDetailTabType;
  onPlanChange?: (userId: string, role: string) => Promise<void> | void;
  onDurationChange?: (userId: string, duration: string) => Promise<void> | void;
  onPlanDatesChange?: (userId: string, planStartDate: string, planEndDate: string) => Promise<void> | void;
  onDeleteEvent?: (eventId: string) => Promise<void> | void;
  onToggleSampleGallery?: (eventId: string, isSample: boolean) => Promise<void> | void;
}

const planTiers = [
  { role: 'free', label: 'Free Plan', storage: '1 GB', storageBytes: 1 * 1024 * 1024 * 1024, monthlyPriceInr: 0 },
  { role: 'starter', label: 'Starter Plan', storage: '10 GB', storageBytes: 10 * 1024 * 1024 * 1024, monthlyPriceInr: 150 },
  { role: 'basic', label: 'Basic Plan', storage: '25 GB', storageBytes: 25 * 1024 * 1024 * 1024, monthlyPriceInr: 300 },
  { role: 'standard', label: 'Standard Plan', storage: '50 GB', storageBytes: 50 * 1024 * 1024 * 1024, monthlyPriceInr: 450 },
  { role: 'premium', label: 'Premium Plan', storage: '100 GB', storageBytes: 100 * 1024 * 1024 * 1024, monthlyPriceInr: 750 },
  { role: 'pro', label: 'Pro Plan', storage: '200 GB', storageBytes: 200 * 1024 * 1024 * 1024, monthlyPriceInr: 1500 },
  { role: 'elite', label: 'Elite Plan', storage: '500 GB', storageBytes: 500 * 1024 * 1024 * 1024, monthlyPriceInr: 3200 },
  { role: 'ultimate', label: 'Ultimate Plan', storage: '1 TB', storageBytes: 1024 * 1024 * 1024 * 1024, monthlyPriceInr: 5500 },
  { role: 'admin', label: 'Super Admin', storage: 'Unlimited', storageBytes: Infinity, monthlyPriceInr: 0 },
];

export interface BackblazeRow {
  id: string;
  galId: string;
  title: string;
  type: 'active' | 'deleted';
  isSample?: boolean;
  photoCount: number;
  videoCount: number;
  totalMediaCount: number;
  bytes: number;
  gb: number;
  windowDurationHours: number;
  gbHours: number;
  billableGbMonths: number;
  storageCostInr: number;
  storageCostUsd: number;
  classCUploads: number;
  classCDeletions: number;
  classCTotal: number;
  classCCostInr: number;
  classBReads: number;
  classBCostInr: number;
  totalTransactionsCount: number;
  totalTransactionsCostInr: number;
  bandwidthCostInr: number;
  totalCostInr: number;
  totalCostUsd: number;
  searchableText: string;
}

const durationOptions = [
  { value: 'monthly', label: '1 Month', months: 1 },
  { value: 'quarterly', label: '3 Months (Quarterly)', months: 3 },
  { value: 'half_yearly', label: '6 Months (Half-Yearly)', months: 6 },
  { value: 'yearly', label: '1 Year (Annual)', months: 12 },
];

export { ModalLogo } from './ModalLogo';
import { ModalLogo } from './ModalLogo';
export { BackblazeLogo } from './BackblazeLogo';
import { BackblazeLogo } from './BackblazeLogo';

export const UserDetailPage: React.FC<UserDetailPageProps> = ({
  user,
  events = [],
  photos = [],
  onBack,
  initialTab = 'info',
  onPlanChange,
  onDurationChange,
  onPlanDatesChange,
  onDeleteEvent,
  onToggleSampleGallery,
}) => {
  const [activeTab, setActiveTab] = useState<UserDetailTabType>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (activeTab === 'cost') {
      setCostRefreshKey(k => k + 1);
    }
  }, [activeTab]);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Gallery viewer state for inspecting user uploads
  const [viewingGallery, setViewingGallery] = useState<Event | null>(null);

  // Events subpage search, filters, and expanded states
  const [eventSearch, setEventSearch] = useState('');
  const [eventFilter, setEventFilter] = useState<'all' | 'with-subs' | 'with-media'>('all');
  const [expandedEventIds, setExpandedEventIds] = useState<Set<string>>(new Set());
  const [costTablePage, setCostTablePage] = useState<number>(1);
  const [costTablePerPage, setCostTablePerPage] = useState<number>(10);
  const [costTableSearch, setCostTableSearch] = useState<string>('');
  const [costTableFilter, setCostTableFilter] = useState<'all' | 'active' | 'deleted'>('all');
  const [sampleUpdatingEventId, setSampleUpdatingEventId] = useState<string | null>(null);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);

  // Backblaze B2 Cost Matrix & Metering state
  const [b2TimeFilter, setB2TimeFilter] = useState<'1d' | '1w' | '1m' | 'custom' | 'all'>('all');
  const [b2CustomStartDate, setB2CustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [b2CustomEndDate, setB2CustomEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Editable form state for Plan Data
  const [savingPlan, setSavingPlan] = useState(false);
  const [savingDates, setSavingDates] = useState(false);
  const [editStartDate, setEditStartDate] = useState(user.planStartDate || '');
  const [editEndDate, setEditEndDate] = useState(user.planEndDate || '');

  const isProtected = isProtectedSuperAdmin(user);
  const cleanRole = (user.role || 'free').toLowerCase();
  const currentPlan = planTiers.find(p => p.role === cleanRole) || planTiers[0];

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const toggleExpandEvent = (eventId: string) => {
    setExpandedEventIds(prev => {
      const next = new Set(prev);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
  };

  const expandAllEvents = (ids: string[]) => {
    setExpandedEventIds(new Set(ids));
  };

  const collapseAllEvents = () => {
    setExpandedEventIds(new Set());
  };

  const handleDeleteEvent = async (evt: Event & { subGalleriesCount?: number }) => {
    if (!onDeleteEvent || deletingEventId) return;
    const title = evt.title || 'Untitled Event';
    const subCount = evt.subGalleriesCount || 0;
    const cascadeNote = subCount > 0
      ? `\n\nThis will also delete ${subCount} sub-event${subCount === 1 ? '' : 's'} inside this event.`
      : '';
    const confirmed = window.confirm(
      `Delete "${title}"?\n\nThis will permanently delete the event, its media, guest records, and uploaded files.${cascadeNote}`
    );
    if (!confirmed) return;

    const typed = window.prompt(`Type DELETE to confirm deletion of "${title}".`);
    if (typed !== 'DELETE') return;

    setDeletingEventId(evt.id);
    try {
      await onDeleteEvent(evt.id);
    } finally {
      setDeletingEventId(null);
    }
  };

  const handleToggleSampleGallery = async (evt: Event) => {
    if (!onToggleSampleGallery || sampleUpdatingEventId) return;
    const nextStatus = !evt.isSampleGallery;
    const title = evt.title || 'Untitled Event';
    const confirmed = window.confirm(
      nextStatus
        ? `Add "${title}" to Sample Galleries?`
        : `Remove "${title}" from Sample Galleries?`
    );
    if (!confirmed) return;

    setSampleUpdatingEventId(evt.id);
    try {
      await onToggleSampleGallery(evt.id, nextStatus);
    } finally {
      setSampleUpdatingEventId(null);
    }
  };

  // Compute storage and events for this specific user
  const userEventMetrics = useMemo(() => {
    // Pre-index all user identifiers with variations
    const userIdentifiers = new Set<string>();
    if (user.id) userIdentifiers.add(user.id.toLowerCase());
    if (user.email) userIdentifiers.add(user.email.toLowerCase());
    if (user.username) userIdentifiers.add(user.username.toLowerCase());
    if (user.phone) {
      const rawPhone = user.phone.toLowerCase();
      userIdentifiers.add(rawPhone);
      const digits = rawPhone.replace(/\D/g, '');
      if (digits) {
        userIdentifiers.add(digits);
        if (digits.length === 10) {
          userIdentifiers.add(`+91${digits}`);
          userIdentifiers.add(`91${digits}`);
        } else if (digits.length === 12 && digits.startsWith('91')) {
          userIdentifiers.add(digits.slice(2));
          userIdentifiers.add(`+${digits}`);
        }
      }
    }

    // 1. Direct events owned by user or assigned to user
    const directUserEvents = events.filter(e => {
      const owner = (e.createdBy || e.createdById || '').toLowerCase();
      const isOwner = Boolean(owner && userIdentifiers.has(owner));
      const isAssigned = Boolean(user.assignedEvents && user.assignedEvents.includes(e.id));
      return isOwner || isAssigned;
    });

    // 2. Map all events related to user (including nested sub-events under their events)
    const allUserEventsMap = new Map<string, Event>();
    directUserEvents.forEach(e => allUserEventsMap.set(e.id, e));

    let addedMore = true;
    while (addedMore) {
      addedMore = false;
      events.forEach(e => {
        if (e.parentId && allUserEventsMap.has(e.parentId) && !allUserEventsMap.has(e.id)) {
          allUserEventsMap.set(e.id, e);
          addedMore = true;
        }
      });
    }

    const allUserEvents = Array.from(allUserEventsMap.values());
    const allUserEventIds = new Set(allUserEvents.map(e => (e.id || '').toLowerCase()));

    // 3. User photos belonging to any of their events OR uploaded directly by the user
    const userPhotos = photos.filter(p => {
      const pUploader = (p.userId || '').toLowerCase();
      const pEventId = (p.eventId || '').toLowerCase();
      const belongsByEvent = Boolean(pEventId && allUserEventIds.has(pEventId));
      const belongsByUser = Boolean(pUploader && userIdentifiers.has(pUploader));
      return belongsByEvent || belongsByUser;
    });

    interface EventStats {
      imageCount: number;
      imageBytes: number;
      videoCount: number;
      videoBytes: number;
      totalCount: number;
      totalBytes: number;
    }

    const statsByEventId = new Map<string, EventStats>();

    userPhotos.forEach(p => {
      const size = Number(p.size) || 0;
      const mediaType = String(p.mediaType || '').toLowerCase();
      const resourceType = String(p.resourceType || '').toLowerCase();
      const rawFormat = String((p as any).format || '').toLowerCase();
      const rawPath = String((p as any).storageKey || (p as any).url || '').toLowerCase();
      const hasDuration = p.duration != null && Number(p.duration) > 0;
      const isVideoByExtension = 
        ['mp4', 'mov', 'webm', 'mkv', 'm4v', 'avi'].includes(rawFormat) ||
        /\.(mp4|mov|webm|mkv|m4v|avi)(\?.*)?$/i.test(rawPath);
      const isVideo = mediaType === 'video' || resourceType === 'video' || hasDuration || isVideoByExtension;

      const eventKey = (p.eventId || '').toLowerCase();
      const current = statsByEventId.get(eventKey) || statsByEventId.get(p.eventId) || {
        imageCount: 0,
        imageBytes: 0,
        videoCount: 0,
        videoBytes: 0,
        totalCount: 0,
        totalBytes: 0,
      };

      if (isVideo) {
        current.videoBytes += size;
        current.videoCount += 1;
      } else {
        current.imageBytes += size;
        current.imageCount += 1;
      }
      current.totalCount = current.imageCount + current.videoCount;
      current.totalBytes = current.imageBytes + current.videoBytes;

      statsByEventId.set(eventKey, current);
      if (p.eventId) statsByEventId.set(p.eventId, current);
    });

    let totalImageBytes = 0;
    let totalVideoBytes = 0;
    let totalImageCount = 0;
    let totalVideoCount = 0;

    userPhotos.forEach(p => {
      const size = Number(p.size) || 0;
      const mediaType = String(p.mediaType || '').toLowerCase();
      const resourceType = String(p.resourceType || '').toLowerCase();
      const rawFormat = String((p as any).format || '').toLowerCase();
      const rawPath = String((p as any).storageKey || (p as any).url || '').toLowerCase();
      const hasDuration = p.duration != null && Number(p.duration) > 0;
      const isVideoByExtension = 
        ['mp4', 'mov', 'webm', 'mkv', 'm4v', 'avi'].includes(rawFormat) ||
        /\.(mp4|mov|webm|mkv|m4v|avi)(\?.*)?$/i.test(rawPath);
      const isVideo = mediaType === 'video' || resourceType === 'video' || hasDuration || isVideoByExtension;
      if (isVideo) {
        totalVideoBytes += size;
        totalVideoCount += 1;
      } else {
        totalImageBytes += size;
        totalImageCount += 1;
      }
    });

    const totalBytes = totalImageBytes + totalVideoBytes;

    const mainEvents = allUserEvents.filter(e => !e.parentId && e.type !== 'sub');
    const subGalleries = allUserEvents.filter(e => Boolean(e.parentId) || e.type === 'sub');

    const subEventsByParent = new Map<string, Event[]>();
    subGalleries.forEach(s => {
      const pid = s.parentId || '';
      if (pid) {
        const list = subEventsByParent.get(pid) || [];
        list.push(s);
        subEventsByParent.set(pid, list);
      }
    });

    const sortByDateDesc = (a: Event, b: Event) => {
      const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bDate - aDate;
    };

    const mainEventBreakdown = mainEvents.sort(sortByDateDesc).map(evt => {
      const directStats = statsByEventId.get((evt.id || '').toLowerCase()) || statsByEventId.get(evt.id) || {
        imageCount: 0,
        imageBytes: 0,
        videoCount: 0,
        videoBytes: 0,
        totalCount: 0,
        totalBytes: 0,
      };

      const children = (subEventsByParent.get(evt.id) || []).sort(sortByDateDesc).map(child => {
        const childStats = statsByEventId.get((child.id || '').toLowerCase()) || statsByEventId.get(child.id) || {
          imageCount: 0,
          imageBytes: 0,
          videoCount: 0,
          videoBytes: 0,
          totalCount: 0,
          totalBytes: 0,
        };
        return {
          event: child,
          stats: childStats,
        };
      });

      const combinedImageCount = directStats.imageCount + children.reduce((s, c) => s + c.stats.imageCount, 0);
      const combinedImageBytes = directStats.imageBytes + children.reduce((s, c) => s + c.stats.imageBytes, 0);
      const combinedVideoCount = directStats.videoCount + children.reduce((s, c) => s + c.stats.videoCount, 0);
      const combinedVideoBytes = directStats.videoBytes + children.reduce((s, c) => s + c.stats.videoBytes, 0);
      const combinedTotalCount = combinedImageCount + combinedVideoCount;
      const combinedTotalBytes = combinedImageBytes + combinedVideoBytes;

      return {
        event: evt,
        directStats,
        children,
        combined: {
          imageCount: combinedImageCount,
          imageBytes: combinedImageBytes,
          videoCount: combinedVideoCount,
          videoBytes: combinedVideoBytes,
          totalCount: combinedTotalCount,
          totalBytes: combinedTotalBytes,
        },
      };
    });

    const knownMainIds = new Set(mainEvents.map(m => m.id));
    const orphanSubEvents = subGalleries.filter(s => !s.parentId || !knownMainIds.has(s.parentId)).map(child => {
      const childStats = statsByEventId.get(child.id) || {
        imageCount: 0,
        imageBytes: 0,
        videoCount: 0,
        videoBytes: 0,
        totalCount: 0,
        totalBytes: 0,
      };
      return {
        event: child,
        stats: childStats,
      };
    });

    // Backwards-compatible eventBreakdown for existing Storage tab table
    const eventBreakdown = mainEventBreakdown.map(item => ({
      event: item.event,
      subGalleriesCount: item.children.length,
      photoCount: item.combined.imageCount,
      videoCount: item.combined.videoCount,
      totalBytes: item.combined.totalBytes,
    }));

    return {
      allUserEvents,
      allUserEventIds,
      userIdentifiers,
      userPhotos,
      mainEventsCount: mainEvents.length,
      subGalleriesCount: subGalleries.length,
      imageBytes: totalImageBytes,
      videoBytes: totalVideoBytes,
      totalBytes,
      imageCount: totalImageCount,
      videoCount: totalVideoCount,
      totalMediaCount: userPhotos.length,
      mainEventBreakdown,
      orphanSubEvents,
      statsByEventId,
      eventBreakdown,
    };
  }, [user, events, photos]);

  // ── Historical Compute & Deleted Media State ─────────────────────────────
  const [deletedEvents, setDeletedEvents] = useState<DeletedEventArchive[]>([]);
  const [modalLogs, setModalLogs] = useState<any[]>([]);
  const [loadingCostLogs, setLoadingCostLogs] = useState(false);
  const [costRefreshKey, setCostRefreshKey] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const loadHistoricalCostData = async () => {
      setLoadingCostLogs(true);
      try {
        // 1. Fetch deleted events archive
        const allDeleted = await fetchDeletedEvents();
        const userDeleted = allDeleted.filter(d =>
          d.userId === user.id ||
          (user.email && d.userId?.toLowerCase() === user.email.toLowerCase()) ||
          (user.phone && d.userId === user.phone)
        );
        if (isMounted) {
          setDeletedEvents(userDeleted);
        }

        // 2. Collect all valid user identifiers & event IDs
        const validUserIds = Array.from(new Set([
          user.id,
          user.email,
          user.phone,
        ].filter(Boolean))) as string[];

        const activeIds = userEventMetrics.allUserEvents.map(e => e.id);
        const deletedIds = userDeleted.map(d => d.eventId);
        const allEventIds = Array.from(new Set([...activeIds, ...deletedIds])).filter(Boolean);

        // Deduplication map by unique log id / signature
        const logsById = new Map<string, any>();

        // A. Query logs attributed directly to user's identifiers
        if (validUserIds.length > 0) {
          let from = 0;
          const batchSize = 1000;
          while (true) {
            const { data: pageLogs, error: logsErr } = await supabase
              .from('modal_cost_logs')
              .select('*')
              .in('user_id', validUserIds)
              .order('created_at', { ascending: false })
              .range(from, from + batchSize - 1);

            if (logsErr || !pageLogs || pageLogs.length === 0) break;
            pageLogs.forEach(log => {
              const logKey = log.id || `${log.photo_id || ''}-${log.created_at || ''}-${log.function_name || ''}`;
              logsById.set(logKey, log);
            });
            if (pageLogs.length < batchSize || logsById.size >= 20000) break;
            from += batchSize;
          }
        }

        // B. Query logs by associated event IDs in batches of 50 to avoid URL query limits
        const chunkSize = 50;
        for (let i = 0; i < allEventIds.length; i += chunkSize) {
          const chunk = allEventIds.slice(i, i + chunkSize);
          let from = 0;
          const batchSize = 1000;
          while (true) {
            const { data: pageLogs, error: logsErr } = await supabase
              .from('modal_cost_logs')
              .select('*')
              .in('event_id', chunk)
              .order('created_at', { ascending: false })
              .range(from, from + batchSize - 1);

            if (logsErr || !pageLogs || pageLogs.length === 0) break;
            pageLogs.forEach(log => {
              const logKey = log.id || `${log.photo_id || ''}-${log.created_at || ''}-${log.function_name || ''}`;
              logsById.set(logKey, log);
            });
            if (pageLogs.length < batchSize || logsById.size >= 20000) break;
            from += batchSize;
          }
        }

        if (isMounted) {
          setModalLogs(Array.from(logsById.values()));
        }
      } catch (err) {
        console.warn('Failed to load historical cost data:', err);
      } finally {
        if (isMounted) setLoadingCostLogs(false);
      }
    };

    loadHistoricalCostData();
    return () => {
      isMounted = false;
    };
  }, [user.id, user.email, user.phone, userEventMetrics.allUserEvents, costRefreshKey]);

  // ── High-Precision Actual Compute Metrics from modal_cost_logs ────────────
  const actualComputeMetrics = useMemo(() => {
    let totalPhotoActualInr = 0;
    let totalPhotoSeconds = 0;
    let totalPhotoRuns = 0;

    let totalVideoCpuActualInr = 0;
    let totalVideoCpuSeconds = 0;
    let totalVideoCpuRuns = 0;

    let totalVideoGpuActualInr = 0;
    let totalVideoGpuSeconds = 0;
    let totalVideoGpuRuns = 0;

    let totalSelfieActualInr = 0;
    let totalSelfieSeconds = 0;
    let totalSelfieRuns = 0;

    // Per-event compute details
    const eventComputeMap = new Map<string, {
      photoInr: number;
      photoSeconds: number;
      photoRuns: number;
      videoCpuInr: number;
      videoCpuSeconds: number;
      videoCpuRuns: number;
      videoGpuInr: number;
      videoGpuSeconds: number;
      videoGpuRuns: number;
      totalInr: number;
      totalSeconds: number;
    }>();

    const getOrCreateEventStats = (eventId: string) => {
      const key = (eventId || '').toLowerCase().trim();
      let stats = eventComputeMap.get(key);
      if (!stats) {
        stats = {
          photoInr: 0,
          photoSeconds: 0,
          photoRuns: 0,
          videoCpuInr: 0,
          videoCpuSeconds: 0,
          videoCpuRuns: 0,
          videoGpuInr: 0,
          videoGpuSeconds: 0,
          videoGpuRuns: 0,
          totalInr: 0,
          totalSeconds: 0,
        };
        eventComputeMap.set(key, stats);
      }
      return stats;
    };

    modalLogs.forEach(log => {
      const dur = Number(log.execution_time_seconds) || 0;
      const cpu = Number(log.cpu_cores) || 1.0;
      const mem = Number(log.memory_gb) || 1.0;
      const gpuType = String(log.gpu_type || 'None');
      const fn = String(log.function_name || 'process_single_photo').toLowerCase();
      const mediaType = String(log.media_type || '').toLowerCase();
      const workerType = String(log.worker_type || '').toLowerCase();

      const isGpu = 
        gpuType.toLowerCase().includes('l4') || 
        fn.includes('video_gpu') || 
        fn.includes('gpu') || 
        workerType.includes('gpu') || 
        workerType.includes('l4');

      const isVideo = 
        mediaType === 'video' || 
        fn.includes('video') || 
        workerType.includes('video') || 
        isGpu;

      const isSelfie = 
        fn === 'find_matching_photos' || 
        fn.includes('selfie') || 
        fn.includes('face_match') || 
        workerType.includes('selfie');

      const gpuRate = isGpu ? 0.0222 : 0;

      // Exact per-second compute rate from COST_ANALYSIS.md ($1 = ₹100):
      // CPU: $0.0000131/vCPU/s (~₹0.00131/vCPU/s)
      // RAM: $0.00000222/GB/s (~₹0.000222/GB/s)
      // L4 GPU: $0.000222/s (~₹0.0222/s)
      const calculatedCost = dur * ((cpu * 0.00131) + (mem * 0.000222) + gpuRate);
      const cost = (typeof log.estimated_cost_inr === 'number' && !isNaN(log.estimated_cost_inr) && log.estimated_cost_inr > 0)
        ? log.estimated_cost_inr
        : calculatedCost;

      const eventId = log.event_id || '';
      const eventStats = eventId ? getOrCreateEventStats(eventId) : null;

      if (isSelfie) {
        totalSelfieActualInr += cost;
        totalSelfieSeconds += dur;
        totalSelfieRuns += 1;
      } else if (isGpu) {
        totalVideoGpuActualInr += cost;
        totalVideoGpuSeconds += dur;
        totalVideoGpuRuns += 1;
        if (eventStats) {
          eventStats.videoGpuInr += cost;
          eventStats.videoGpuSeconds += dur;
          eventStats.videoGpuRuns += 1;
          eventStats.totalInr += cost;
          eventStats.totalSeconds += dur;
        }
      } else if (isVideo) {
        totalVideoCpuActualInr += cost;
        totalVideoCpuSeconds += dur;
        totalVideoCpuRuns += 1;
        if (eventStats) {
          eventStats.videoCpuInr += cost;
          eventStats.videoCpuSeconds += dur;
          eventStats.videoCpuRuns += 1;
          eventStats.totalInr += cost;
          eventStats.totalSeconds += dur;
        }
      } else {
        totalPhotoActualInr += cost;
        totalPhotoSeconds += dur;
        totalPhotoRuns += 1;
        if (eventStats) {
          eventStats.photoInr += cost;
          eventStats.photoSeconds += dur;
          eventStats.photoRuns += 1;
          eventStats.totalInr += cost;
          eventStats.totalSeconds += dur;
        }
      }
    });

    const totalVideoActualInr = totalVideoCpuActualInr + totalVideoGpuActualInr;
    const totalVideoSeconds = totalVideoCpuSeconds + totalVideoGpuSeconds;
    const totalVideoRuns = totalVideoCpuRuns + totalVideoGpuRuns;

    const activePhotos = userEventMetrics.imageCount;
    const activeVideos = userEventMetrics.videoCount;

    // Remaining unlogged media gets added at observed user average (or COST_ANALYSIS benchmark if 0 runs)
    const avgObservedPhotoCost = totalPhotoRuns > 0 ? (totalPhotoActualInr / totalPhotoRuns) : 0.0082;
    const avgObservedVideoCpuCost = totalVideoCpuRuns > 0 ? (totalVideoCpuActualInr / totalVideoCpuRuns) : 0.35;
    const avgObservedVideoGpuCost = totalVideoGpuRuns > 0 ? (totalVideoGpuActualInr / totalVideoGpuRuns) : 1.75;
    const avgObservedVideoCost = totalVideoRuns > 0 ? (totalVideoActualInr / totalVideoRuns) : 0.35;

    const deletedArchivePhotoCount = deletedEvents.reduce((s, d) => s + (Number(d.photosCount) || 0), 0);
    const deletedArchiveVideoCount = deletedEvents.reduce((s, d) => s + (Number(d.videosCount) || 0), 0);

    const lifetimePhotosCount = Math.max(activePhotos + deletedArchivePhotoCount, totalPhotoRuns);
    const lifetimeVideosCount = Math.max(activeVideos + deletedArchiveVideoCount, totalVideoRuns);

    const unloggedPhotos = Math.max(0, lifetimePhotosCount - totalPhotoRuns);
    const unloggedVideos = Math.max(0, lifetimeVideosCount - totalVideoRuns);

    // Inspect user's actual videos to see how many qualify as GPU candidates (>10m or >350MB)
    let activeGpuVideosCandidateCount = 0;
    userEventMetrics.userPhotos.forEach(p => {
      const size = Number(p.size) || 0;
      const mediaType = String(p.mediaType || '').toLowerCase();
      const resourceType = String(p.resourceType || '').toLowerCase();
      const rawFormat = String((p as any).format || '').toLowerCase();
      const rawPath = String((p as any).storageKey || (p as any).url || '').toLowerCase();
      const hasDuration = p.duration != null && Number(p.duration) > 0;
      const isVideoByExtension = 
        ['mp4', 'mov', 'webm', 'mkv', 'm4v', 'avi'].includes(rawFormat) ||
        /\.(mp4|mov|webm|mkv|m4v|avi)(\?.*)?$/i.test(rawPath);
      const isVideo = mediaType === 'video' || resourceType === 'video' || hasDuration || isVideoByExtension;
      if (isVideo) {
        const isLong = (hasDuration && Number(p.duration) > 600) || size > 350 * 1024 * 1024;
        if (isLong) activeGpuVideosCandidateCount++;
      }
    });

    const unloggedGpuVideos = Math.min(unloggedVideos, Math.max(0, activeGpuVideosCandidateCount - totalVideoGpuRuns));
    const unloggedCpuVideos = Math.max(0, unloggedVideos - unloggedGpuVideos);

    const effectivePhotoInr = totalPhotoActualInr + (unloggedPhotos * avgObservedPhotoCost);
    const effectiveVideoCpuInr = totalVideoCpuActualInr + (unloggedCpuVideos * avgObservedVideoCpuCost);
    const effectiveVideoGpuInr = totalVideoGpuActualInr + (unloggedGpuVideos * avgObservedVideoGpuCost);
    const effectiveVideoInr = effectiveVideoCpuInr + effectiveVideoGpuInr;
    const effectiveSelfieInr = totalSelfieActualInr;

    const totalModalInr = effectivePhotoInr + effectiveVideoInr + effectiveSelfieInr;
    const totalComputeSeconds = totalPhotoSeconds + totalVideoSeconds + totalSelfieSeconds;

    return {
      totalPhotoActualInr,
      totalPhotoSeconds,
      totalPhotoRuns,
      totalVideoCpuActualInr,
      totalVideoCpuSeconds,
      totalVideoCpuRuns,
      totalVideoGpuActualInr,
      totalVideoGpuSeconds,
      totalVideoGpuRuns,
      totalVideoActualInr,
      totalVideoSeconds,
      totalVideoRuns,
      totalSelfieActualInr,
      totalSelfieSeconds,
      totalSelfieRuns,
      totalComputeSeconds,
      effectivePhotoInr,
      effectiveVideoCpuInr,
      effectiveVideoGpuInr,
      effectiveVideoInr,
      effectiveSelfieInr,
      totalModalInr,
      lifetimePhotosCount,
      lifetimeVideosCount,
      activePhotos,
      activeVideos,
      unloggedCpuVideos,
      unloggedGpuVideos,
      deletedPhotosCount: Math.max(0, lifetimePhotosCount - activePhotos),
      deletedVideosCount: Math.max(0, lifetimeVideosCount - activeVideos),
      totalLifetimeMedia: lifetimePhotosCount + lifetimeVideosCount,
      eventComputeMap,
      avgObservedPhotoCost,
      avgObservedVideoCost,
      avgObservedVideoCpuCost,
      avgObservedVideoGpuCost,
    };
  }, [modalLogs, userEventMetrics.imageCount, userEventMetrics.videoCount, userEventMetrics.userPhotos, deletedEvents]);

  // Formatted helpers
  const formatBytes = (bytes: number | null | undefined): string => {
    if (!bytes || bytes <= 0 || isNaN(bytes)) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const sizeIndex = Math.min(Math.max(0, i), sizes.length - 1);
    return `${parseFloat((bytes / Math.pow(k, sizeIndex)).toFixed(2))} ${sizes[sizeIndex]}`;
  };

  const usedGb = userEventMetrics.totalBytes / (1024 * 1024 * 1024);
  const quotaBytes = currentPlan.storageBytes;
  const storagePercentage = quotaBytes === Infinity ? 0 : Math.min(100, Math.round((userEventMetrics.totalBytes / quotaBytes) * 100));

  // Compute Days Remaining in Plan
  const planDaysRemaining = useMemo(() => {
    if (!user.planEndDate) return null;
    const end = new Date(`${user.planEndDate}T23:59:59Z`).getTime();
    const now = Date.now();
    const diffDays = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
    return diffDays;
  }, [user.planEndDate]);

  // Cost calculations strictly adhering to COST_ANALYSIS.md ($1 = ₹100)
  // Actual per-second hardware billing for Compute; State-based for B2 Storage
  const costBreakdown = useMemo(() => {
    // 1. Backblaze B2 Storage (State-Based / Monthly Recurring):
    // Only ACTIVE media currently occupying B2 disk space is billed recurringly monthly.
    // Rate: ₹600 / TB / month ($0.006 / GB / month = ₹0.60 / GB / month)
    const b2MonthlyInr = usedGb * 0.60;
    const b2YearlyInr = b2MonthlyInr * 12;

    // 2. Modal.com Serverless Compute Workers (Actual Per-Second Hardware Consumption):
    const modalPhotoInr = actualComputeMetrics.effectivePhotoInr;
    const modalVideoCpuInr = actualComputeMetrics.effectiveVideoCpuInr;
    const modalVideoGpuInr = actualComputeMetrics.effectiveVideoGpuInr;
    const modalVideoInr = actualComputeMetrics.effectiveVideoInr;
    const modalSelfieInr = actualComputeMetrics.effectiveSelfieInr;
    const modalTotalInr = actualComputeMetrics.totalModalInr;

    // 3. Upstash QStash (Historical Queue Ingestion):
    // Rate: ₹100 / 100,000 messages (~₹0.001 / photo or video message dispatched)
    const qstashInr = actualComputeMetrics.totalLifetimeMedia * 0.001;

    // 4. Supabase DB: Metadata & Auth share (~₹0.003 / active media row)
    const totalActiveMedia = userEventMetrics.imageCount + userEventMetrics.videoCount;
    const supabaseMonthlyInr = totalActiveMedia > 0 ? Math.max(0.5, totalActiveMedia * 0.003) : 0;
    const supabaseYearlyInr = supabaseMonthlyInr * 12;

    // Calculate duration user has been registered (in fractional months)
    let monthsActive = 1;
    if (user.createdAt) {
      const createdTime = new Date(user.createdAt).getTime();
      if (!isNaN(createdTime) && createdTime > 0) {
        const now = Date.now();
        const diffDays = Math.max(0, (now - createdTime) / (1000 * 60 * 60 * 24));
        monthsActive = Math.max(0.01, diffDays / 30.4375);
      }
    }

    // High-Precision Continuous Byte-Hour Integration for Lifetime B2 Storage Endured:
    const now = Date.now();
    const allUserEventIds = new Set(userEventMetrics.allUserEvents.map(e => e.id));
    const userPhotos = photos.filter(p => p.eventId && allUserEventIds.has(p.eventId));
    let lifetimeGbHours = 0;

    userPhotos.forEach(p => {
      const pBytes = Number(p.size) || 0;
      const pGb = pBytes / (1024 * 1024 * 1024);
      const rawTime = p.uploadedAt ? new Date(p.uploadedAt).getTime() : (user.createdAt ? new Date(user.createdAt).getTime() : now);
      const pStart = !isNaN(rawTime) && rawTime > 0 ? rawTime : (now - 30 * 86400000);
      const hours = Math.max(1, (now - pStart) / 3600000);
      lifetimeGbHours += pGb * hours;
    });

    deletedEvents.forEach(del => {
      const delBytes = Number(del.totalBytes) || 0;
      const delGb = delBytes / (1024 * 1024 * 1024);
      const delAtMs = new Date(del.deletedAt).getTime();
      const cLogs = modalLogs.filter(l => l.event_id === del.eventId);
      const earliestLogMs = cLogs.length > 0 
        ? Math.min(...cLogs.map(l => new Date(l.created_at).getTime()).filter(t => !isNaN(t) && t > 0))
        : (delAtMs - 14 * 86400000);
      const delStartMs = !isNaN(earliestLogMs) && earliestLogMs > 0 ? earliestLogMs : (delAtMs - 14 * 86400000);
      const hours = Math.max(1, (delAtMs - delStartMs) / 3600000);
      lifetimeGbHours += delGb * hours;
    });

    // Also include historical orphaned deleted events from modal_cost_logs
    const allDeletedEventIds = new Set(deletedEvents.map(d => d.eventId));
    Array.from(actualComputeMetrics.eventComputeMap.keys()).forEach(orphanedId => {
      if (!orphanedId || allUserEventIds.has(orphanedId) || allDeletedEventIds.has(orphanedId)) return;
      const oStats = actualComputeMetrics.eventComputeMap.get(orphanedId);
      if (!oStats || (oStats.photoRuns === 0 && oStats.videoCpuRuns === 0 && oStats.videoGpuRuns === 0)) return;

      const orphanedLogs = modalLogs.filter(l => l.event_id === orphanedId);
      const knownBytes = orphanedLogs.reduce((s, l) => s + (Number(l.media_size) || 0), 0);
      const totalPhotos = oStats.photoRuns;
      const totalVideos = oStats.videoCpuRuns + oStats.videoGpuRuns;
      const estimatedBytes = (totalPhotos * 4.5 * 1024 * 1024) + (totalVideos * 45 * 1024 * 1024);
      const delBytes = knownBytes > 0 ? knownBytes : estimatedBytes;
      const delGb = delBytes / (1024 * 1024 * 1024);

      // Assume standard 30-day (720h) gallery existence before deletion
      lifetimeGbHours += delGb * 720;
    });

    const lifetimeStorageCostInr = (lifetimeGbHours / 720) * 0.60;
    const lifetimeTxCostInr = ((actualComputeMetrics.totalLifetimeMedia + deletedEvents.reduce((s, d) => s + (Number(d.photosCount) || 0) + (Number(d.videosCount) || 0), 0)) / 1000) * 0.40;
    const b2CostTillNowInr = Math.max(b2MonthlyInr * monthsActive, lifetimeStorageCostInr + lifetimeTxCostInr);
    const supabaseCostTillNowInr = supabaseMonthlyInr * monthsActive;

    // Total Monthly Cost to EveBash (Active recurring only: B2 Storage + Supabase)
    const totalMonthlyCostInr = b2MonthlyInr + supabaseMonthlyInr;

    // Cumulative Cost to EveBash ENDURED TILL NOW (Historical compute + actual storage endured to date)
    const totalLifetimeCostInr = modalTotalInr + qstashInr + b2CostTillNowInr + supabaseCostTillNowInr;

    // User Subscription Revenue
    const monthlyRevenueInr = currentPlan.monthlyPriceInr;
    const yearlyRevenueInr = monthlyRevenueInr * 12;

    const monthlyGrossMarginInr = monthlyRevenueInr - totalMonthlyCostInr;
    const monthlyMarginPercentage = monthlyRevenueInr > 0
      ? Math.round((monthlyGrossMarginInr / monthlyRevenueInr) * 100)
      : null;

    return {
      b2MonthlyInr,
      b2YearlyInr,
      b2CostTillNowInr,
      b2MonthlyCostInr: b2MonthlyInr,
      b2YearlyCostInr: b2YearlyInr,
      modalPhotoInr,
      modalVideoCpuInr,
      modalVideoGpuInr,
      modalVideoInr,
      modalSelfieInr,
      modalTotalInr,
      modalInr: modalTotalInr, // backwards-compatible alias
      qstashInr,
      supabaseMonthlyInr,
      supabaseYearlyInr,
      supabaseCostTillNowInr,
      totalMonthlyCostInr,
      totalLifetimeCostInr,
      totalCostTillNowInr: totalLifetimeCostInr,
      totalYearlyCostInr: totalLifetimeCostInr, // backwards-compatible alias
      monthsActive,
      monthlyRevenueInr,
      yearlyRevenueInr,
      monthlyGrossMarginInr,
      monthlyMarginPercentage,
    };
  }, [usedGb, actualComputeMetrics, userEventMetrics, photos, deletedEvents, modalLogs, currentPlan, user.createdAt]);

  // Unified cost table gallery row representation
  interface CostGalleryRowActive {
    type: 'active';
    id: string;
    title: string;
    searchableText: string;
    event: Event;
    children: Array<{
      event: Event;
      stats: {
        imageCount: number;
        imageBytes: number;
        videoCount: number;
        videoBytes: number;
        totalCount: number;
        totalBytes: number;
      };
    }>;
    combined: {
      imageCount: number;
      imageBytes: number;
      videoCount: number;
      videoBytes: number;
      totalCount: number;
      totalBytes: number;
    };
  }

  interface CostGalleryRowDeleted {
    type: 'deleted';
    id: string;
    title: string;
    searchableText: string;
    deleted: DeletedEventArchive;
  }

  interface CostGalleryRowOrphanedLog {
    type: 'orphaned_log';
    id: string;
    title: string;
    searchableText: string;
    orphanedId: string;
    stats: {
      photoInr: number;
      photoSeconds: number;
      photoRuns: number;
      videoCpuInr: number;
      videoCpuSeconds: number;
      videoCpuRuns: number;
      videoGpuInr: number;
      videoGpuSeconds: number;
      videoGpuRuns: number;
      totalInr: number;
      totalSeconds: number;
    };
  }

  type CostGalleryRow = CostGalleryRowActive | CostGalleryRowDeleted | CostGalleryRowOrphanedLog;

  const allCostRows = useMemo<CostGalleryRow[]>(() => {
    const rows: CostGalleryRow[] = [];

    // 1. Active Main Events (with children sub-galleries)
    userEventMetrics.mainEventBreakdown.forEach(({ event, children, combined }) => {
      const title = event.title || 'Untitled Event';
      const searchTerms = [
        title,
        event.id,
        event.type || '',
        ...children.map(c => `${c.event.title || ''} ${c.event.id}`),
      ].join(' ').toLowerCase();

      rows.push({
        type: 'active',
        id: event.id,
        title,
        searchableText: searchTerms,
        event,
        children,
        combined,
      });
    });

    // 2. Orphan Sub-events (if any exist without parent)
    userEventMetrics.orphanSubEvents.forEach(({ event, stats }) => {
      const title = event.title || 'Untitled Sub-Gallery';
      rows.push({
        type: 'active',
        id: event.id,
        title,
        searchableText: `${title} ${event.id}`.toLowerCase(),
        event,
        children: [],
        combined: stats,
      });
    });

    // 3. Deleted / Archived Events from Audit Ledger
    deletedEvents.forEach(del => {
      const title = del.eventTitle || 'Untitled Gallery';
      rows.push({
        type: 'deleted',
        id: `deleted-${del.id}`,
        title,
        searchableText: `${title} ${del.eventId} ${del.id}`.toLowerCase(),
        deleted: del,
      });
    });

    // 4. Orphaned historical deleted event logs in modal_cost_logs
    const allUserEventIds = new Set(userEventMetrics.allUserEvents.map(e => e.id));
    const allDeletedEventIds = new Set(deletedEvents.map(d => d.eventId));

    Array.from(actualComputeMetrics.eventComputeMap.keys()).forEach(orphanedId => {
      if (!orphanedId || allUserEventIds.has(orphanedId) || allDeletedEventIds.has(orphanedId)) return;
      const oStats = actualComputeMetrics.eventComputeMap.get(orphanedId);
      if (!oStats || (oStats.photoRuns === 0 && oStats.videoCpuRuns === 0 && oStats.videoGpuRuns === 0)) return;

      rows.push({
        type: 'orphaned_log',
        id: `orphaned-${orphanedId}`,
        title: 'Historical Gallery',
        searchableText: `historical gallery ${orphanedId}`.toLowerCase(),
        orphanedId,
        stats: oStats,
      });
    });

    return rows;
  }, [userEventMetrics, deletedEvents, actualComputeMetrics]);

  const filteredCostRows = useMemo(() => {
    const query = costTableSearch.toLowerCase().trim();
    return allCostRows.filter(row => {
      if (costTableFilter === 'active' && row.type !== 'active') return false;
      if (costTableFilter === 'deleted' && row.type !== 'deleted' && row.type !== 'orphaned_log') return false;
      if (query && !row.searchableText.includes(query)) return false;
      return true;
    });
  }, [allCostRows, costTableFilter, costTableSearch]);

  const totalCostPages = Math.max(1, Math.ceil(filteredCostRows.length / costTablePerPage));

  // Reset to page 1 whenever search, filter, or perPage changes
  useEffect(() => {
    setCostTablePage(1);
  }, [costTableSearch, costTableFilter, costTablePerPage]);

  const paginatedCostRows = useMemo(() => {
    const start = (costTablePage - 1) * costTablePerPage;
    return filteredCostRows.slice(start, start + costTablePerPage);
  }, [filteredCostRows, costTablePage, costTablePerPage]);

  const costPageNumbers = useMemo(() => {
    const range: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, costTablePage - 2);
    let end = Math.min(totalCostPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    for (let i = start; i <= end; i++) {
      range.push(i);
    }
    return range;
  }, [costTablePage, totalCostPages]);

  // ── Backblaze B2 Metering Helper Functions ────────────────────────────────
  const formatDurationHours = (hours: number | null | undefined): string => {
    if (!hours || hours <= 0 || isNaN(hours)) return '0h';
    if (hours < 24) return `${hours.toFixed(1)}h`;
    const days = hours / 24;
    return `${days.toFixed(1)}d (${hours.toFixed(0)}h)`;
  };

  const b2MeteringData = useMemo(() => {
    const now = Date.now();
    let windowStartMs = now - 30 * 24 * 3600 * 1000;
    let windowEndMs = now;

    if (b2TimeFilter === '1d') {
      windowStartMs = now - 24 * 3600 * 1000;
      windowEndMs = now;
    } else if (b2TimeFilter === '1w') {
      windowStartMs = now - 7 * 24 * 3600 * 1000;
      windowEndMs = now;
    } else if (b2TimeFilter === '1m') {
      windowStartMs = now - 30 * 24 * 3600 * 1000;
      windowEndMs = now;
    } else if (b2TimeFilter === 'custom') {
      const s = new Date(b2CustomStartDate + 'T00:00:00Z').getTime();
      const e = new Date(b2CustomEndDate + 'T23:59:59Z').getTime();
      windowStartMs = !isNaN(s) ? s : (now - 30 * 86400000);
      windowEndMs = !isNaN(e) ? e : now;
      if (windowStartMs > windowEndMs) {
        const t = windowStartMs;
        windowStartMs = windowEndMs;
        windowEndMs = t;
      }
    } else if (b2TimeFilter === 'all') {
      const uCreated = user.createdAt ? new Date(user.createdAt).getTime() : 0;
      windowStartMs = (uCreated > 0 && uCreated <= now) ? uCreated : (now - 365 * 86400000);
      windowEndMs = now;
    }

    const windowDurationHours = Math.max(0.1, (windowEndMs - windowStartMs) / 3600000);
    const windowDurationDays = windowDurationHours / 24;

    const startDateObj = new Date(windowStartMs);
    const endDateObj = new Date(windowEndMs);
    const formattedRange = `${startDateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} – ${endDateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    const durationLabel = formatDurationHours(windowDurationHours);

    const rows: BackblazeRow[] = [];
    const meteredPhotoIds = new Set<string>();

    // 1. Active Main Events (with their children sub-galleries)
    userEventMetrics.mainEventBreakdown.forEach(({ event, children, combined }) => {
      const relatedIds = new Set([event.id, ...children.map(c => c.event.id)].map(id => (id || '').toLowerCase()));
      const galleryPhotos = photos.filter(p => p.eventId && relatedIds.has(p.eventId.toLowerCase()));

      let totalGbHours = 0;
      let maxOverlapHours = 0;
      let uploadsInWindow = 0;

      galleryPhotos.forEach(p => {
        meteredPhotoIds.add(p.id);
        const pBytes = Number(p.size) || 0;
        const pGb = pBytes / (1024 * 1024 * 1024);
        const rawTime = p.uploadedAt ? new Date(p.uploadedAt).getTime() : (event.createdAt ? new Date(event.createdAt).getTime() : windowStartMs);
        const pStart = !isNaN(rawTime) && rawTime > 0 ? rawTime : windowStartMs;
        const pEnd = now;

        const oStart = Math.max(pStart, windowStartMs);
        const oEnd = Math.min(pEnd, windowEndMs);
        let oHours = Math.max(0, (oEnd - oStart) / 3600000);
        if (oHours > 0 && oHours < 1) oHours = 1;

        if (oHours > maxOverlapHours) maxOverlapHours = oHours;
        totalGbHours += pGb * oHours;

        if (pStart >= windowStartMs && pStart <= windowEndMs) {
          uploadsInWindow += 1;
        }
      });

      if (galleryPhotos.length === 0 && combined.totalBytes > 0) {
        const cGb = combined.totalBytes / (1024 * 1024 * 1024);
        const evCreated = event.createdAt ? new Date(event.createdAt).getTime() : windowStartMs;
        const oStart = Math.max(evCreated, windowStartMs);
        const oEnd = Math.min(now, windowEndMs);
        let oHours = Math.max(0, (oEnd - oStart) / 3600000);
        if (oHours > 0 && oHours < 1) oHours = 1;
        maxOverlapHours = oHours;
        totalGbHours = cGb * oHours;
      }

      const billableGbMonths = totalGbHours / 720;
      const storageCostInr = billableGbMonths * 0.60;
      const classCUploads = uploadsInWindow;
      const classCDeletions = 0;
      const classCTotal = classCUploads + classCDeletions;
      const classCCostInr = (classCTotal / 1000) * 0.40;

      const classBReads = combined.totalCount > 0 ? Math.min(1000, combined.totalCount * 2 + 10) : 0;
      const classBCostInr = (classBReads / 10000) * 0.40;

      const totalCostInr = storageCostInr + classCCostInr + classBCostInr;
      const title = event.title || 'Untitled Event';

      rows.push({
        id: `b2-active-${event.id}`,
        galId: event.id,
        title,
        type: 'active',
        isSample: !!event.isSampleGallery,
        photoCount: combined.imageCount,
        videoCount: combined.videoCount,
        totalMediaCount: combined.totalCount,
        bytes: combined.totalBytes,
        gb: combined.totalBytes / (1024 * 1024 * 1024),
        windowDurationHours: maxOverlapHours,
        gbHours: totalGbHours,
        billableGbMonths,
        storageCostInr,
        storageCostUsd: storageCostInr / 100,
        classCUploads,
        classCDeletions,
        classCTotal,
        classCCostInr,
        classBReads,
        classBCostInr,
        totalTransactionsCount: classCTotal + classBReads,
        totalTransactionsCostInr: classCCostInr + classBCostInr,
        bandwidthCostInr: 0,
        totalCostInr,
        totalCostUsd: totalCostInr / 100,
        searchableText: `${title} ${event.id} active`.toLowerCase(),
      });
    });

    // 2. Orphan Sub-events
    userEventMetrics.orphanSubEvents.forEach(({ event, stats }) => {
      const galleryPhotos = photos.filter(p => p.eventId === event.id);
      let totalGbHours = 0;
      let maxOverlapHours = 0;
      let uploadsInWindow = 0;

      galleryPhotos.forEach(p => {
        meteredPhotoIds.add(p.id);
        const pBytes = Number(p.size) || 0;
        const pGb = pBytes / (1024 * 1024 * 1024);
        const rawTime = p.uploadedAt ? new Date(p.uploadedAt).getTime() : (event.createdAt ? new Date(event.createdAt).getTime() : windowStartMs);
        const pStart = !isNaN(rawTime) && rawTime > 0 ? rawTime : windowStartMs;
        const pEnd = now;

        const oStart = Math.max(pStart, windowStartMs);
        const oEnd = Math.min(pEnd, windowEndMs);
        let oHours = Math.max(0, (oEnd - oStart) / 3600000);
        if (oHours > 0 && oHours < 1) oHours = 1;

        if (oHours > maxOverlapHours) maxOverlapHours = oHours;
        totalGbHours += pGb * oHours;

        if (pStart >= windowStartMs && pStart <= windowEndMs) {
          uploadsInWindow += 1;
        }
      });

      if (galleryPhotos.length === 0 && stats.totalBytes > 0) {
        const cGb = stats.totalBytes / (1024 * 1024 * 1024);
        const evCreated = event.createdAt ? new Date(event.createdAt).getTime() : windowStartMs;
        const oStart = Math.max(evCreated, windowStartMs);
        const oEnd = Math.min(now, windowEndMs);
        let oHours = Math.max(0, (oEnd - oStart) / 3600000);
        if (oHours > 0 && oHours < 1) oHours = 1;
        maxOverlapHours = oHours;
        totalGbHours = cGb * oHours;
      }

      const billableGbMonths = totalGbHours / 720;
      const storageCostInr = billableGbMonths * 0.60;
      const classCUploads = uploadsInWindow;
      const classCDeletions = 0;
      const classCTotal = classCUploads + classCDeletions;
      const classCCostInr = (classCTotal / 1000) * 0.40;
      const classBReads = stats.totalCount > 0 ? Math.min(500, stats.totalCount * 2 + 5) : 0;
      const classBCostInr = (classBReads / 10000) * 0.40;
      const totalCostInr = storageCostInr + classCCostInr + classBCostInr;
      const title = event.title || 'Untitled Sub-Gallery';

      rows.push({
        id: `b2-orphan-${event.id}`,
        galId: event.id,
        title,
        type: 'active',
        isSample: !!event.isSampleGallery,
        photoCount: stats.imageCount,
        videoCount: stats.videoCount,
        totalMediaCount: stats.totalCount,
        bytes: stats.totalBytes,
        gb: stats.totalBytes / (1024 * 1024 * 1024),
        windowDurationHours: maxOverlapHours,
        gbHours: totalGbHours,
        billableGbMonths,
        storageCostInr,
        storageCostUsd: storageCostInr / 100,
        classCUploads,
        classCDeletions,
        classCTotal,
        classCCostInr,
        classBReads,
        classBCostInr,
        totalTransactionsCount: classCTotal + classBReads,
        totalTransactionsCostInr: classCCostInr + classBCostInr,
        bandwidthCostInr: 0,
        totalCostInr,
        totalCostUsd: totalCostInr / 100,
        searchableText: `${title} ${event.id} active sub`.toLowerCase(),
      });
    });

    // 2b. Standalone / Direct Active User Photos (media uploaded by user not grouped under above events)
    const standalonePhotos = photos.filter(p => {
      if (meteredPhotoIds.has(p.id)) return false;
      const pUploader = (p.userId || '').toLowerCase();
      const belongsByUser = Boolean(pUploader && userEventMetrics.userIdentifiers.has(pUploader));
      const belongsByEvent = Boolean(p.eventId && userEventMetrics.allUserEventIds.has(p.eventId));
      return belongsByUser || belongsByEvent;
    });

    if (standalonePhotos.length > 0) {
      let totalGbHours = 0;
      let maxOverlapHours = 0;
      let uploadsInWindow = 0;
      let totalBytes = 0;
      let photoCount = 0;
      let videoCount = 0;

      standalonePhotos.forEach(p => {
        meteredPhotoIds.add(p.id);
        const pBytes = Number(p.size) || 0;
        totalBytes += pBytes;
        const pGb = pBytes / (1024 * 1024 * 1024);
        const rawTime = p.uploadedAt ? new Date(p.uploadedAt).getTime() : windowStartMs;
        const pStart = !isNaN(rawTime) && rawTime > 0 ? rawTime : windowStartMs;
        const pEnd = now;

        const oStart = Math.max(pStart, windowStartMs);
        const oEnd = Math.min(pEnd, windowEndMs);
        let oHours = Math.max(0, (oEnd - oStart) / 3600000);
        if (oHours > 0 && oHours < 1) oHours = 1;

        if (oHours > maxOverlapHours) maxOverlapHours = oHours;
        totalGbHours += pGb * oHours;

        if (pStart >= windowStartMs && pStart <= windowEndMs) {
          uploadsInWindow += 1;
        }

        const isVideo = p.mediaType === 'video' || p.resourceType === 'video';
        if (isVideo) videoCount++;
        else photoCount++;
      });

      const billableGbMonths = totalGbHours / 720;
      const storageCostInr = billableGbMonths * 0.60;
      const classCUploads = uploadsInWindow;
      const classCDeletions = 0;
      const classCTotal = classCUploads + classCDeletions;
      const classCCostInr = (classCTotal / 1000) * 0.40;
      const classBReads = standalonePhotos.length > 0 ? Math.min(500, standalonePhotos.length * 2 + 5) : 0;
      const classBCostInr = (classBReads / 10000) * 0.40;
      const totalCostInr = storageCostInr + classCCostInr + classBCostInr;

      rows.push({
        id: `b2-standalone-${user.id}`,
        galId: user.id,
        title: 'Direct / Standalone Media',
        type: 'active',
        isSample: false,
        photoCount,
        videoCount,
        totalMediaCount: photoCount + videoCount,
        bytes: totalBytes,
        gb: totalBytes / (1024 * 1024 * 1024),
        windowDurationHours: maxOverlapHours,
        gbHours: totalGbHours,
        billableGbMonths,
        storageCostInr,
        storageCostUsd: storageCostInr / 100,
        classCUploads,
        classCDeletions,
        classCTotal,
        classCCostInr,
        classBReads,
        classBCostInr,
        totalTransactionsCount: classCTotal + classBReads,
        totalTransactionsCostInr: classCCostInr + classBCostInr,
        bandwidthCostInr: 0,
        totalCostInr,
        totalCostUsd: totalCostInr / 100,
        searchableText: `direct standalone media ${user.id} active`.toLowerCase(),
      });
    }

    // 3. Deleted / Archived Events
    deletedEvents.forEach(del => {
      const delBytes = Number(del.totalBytes) || 0;
      const delGb = delBytes / (1024 * 1024 * 1024);
      const delAtMs = new Date(del.deletedAt).getTime();

      const cLogs = modalLogs.filter(l => l.event_id === del.eventId);
      const earliestLogMs = cLogs.length > 0
        ? Math.min(...cLogs.map(l => new Date(l.created_at).getTime()).filter(t => !isNaN(t) && t > 0))
        : NaN;
      const parsedCreatedAtMs = del.eventCreatedAt ? new Date(del.eventCreatedAt).getTime() : NaN;
      const validCreatedAtMs = !isNaN(parsedCreatedAtMs) && parsedCreatedAtMs > 0 ? parsedCreatedAtMs : NaN;

      const delStartMs = !isNaN(validCreatedAtMs)
        ? validCreatedAtMs
        : (!isNaN(earliestLogMs) && earliestLogMs > 0 ? earliestLogMs : (delAtMs - 14 * 86400000));

      const oStart = Math.max(delStartMs, windowStartMs);
      const oEnd = Math.min(delAtMs, windowEndMs);
      const oHours = Math.max(0, (oEnd - oStart) / 3600000);

      const gbHours = delGb * oHours;
      const billableGbMonths = gbHours / 720;
      const storageCostInr = billableGbMonths * 0.60;

      const wasUploadedInWindow = delStartMs >= windowStartMs && delStartMs <= windowEndMs;
      const wasDeletedInWindow = delAtMs >= windowStartMs && delAtMs <= windowEndMs;

      const mediaCount = (Number(del.photosCount) || 0) + (Number(del.videosCount) || 0);
      const classCUploads = wasUploadedInWindow ? mediaCount : 0;
      const classCDeletions = wasDeletedInWindow ? mediaCount : 0;
      const classCTotal = classCUploads + classCDeletions;
      const classCCostInr = (classCTotal / 1000) * 0.40;
      const classBReads = oHours > 0 ? Math.min(30, mediaCount) : 0;
      const classBCostInr = (classBReads / 10000) * 0.40;

      const totalCostInr = storageCostInr + classCCostInr + classBCostInr;
      const title = del.eventTitle || 'Untitled Gallery';

      rows.push({
        id: `b2-deleted-${del.id}`,
        galId: del.eventId,
        title,
        type: 'deleted',
        photoCount: Number(del.photosCount) || 0,
        videoCount: Number(del.videosCount) || 0,
        totalMediaCount: mediaCount,
        bytes: delBytes,
        gb: delGb,
        windowDurationHours: oHours,
        gbHours,
        billableGbMonths,
        storageCostInr,
        storageCostUsd: storageCostInr / 100,
        classCUploads,
        classCDeletions,
        classCTotal,
        classCCostInr,
        classBReads,
        classBCostInr,
        totalTransactionsCount: classCTotal + classBReads,
        totalTransactionsCostInr: classCCostInr + classBCostInr,
        bandwidthCostInr: 0,
        totalCostInr,
        totalCostUsd: totalCostInr / 100,
        searchableText: `${title} ${del.eventId} deleted`.toLowerCase(),
      });
    });

    // 4. Orphaned historical deleted event logs in modal_cost_logs
    const allUserEventIds = new Set(userEventMetrics.allUserEvents.map(e => e.id));
    const allDeletedEventIds = new Set(deletedEvents.map(d => d.eventId));

    Array.from(actualComputeMetrics.eventComputeMap.keys()).forEach(orphanedId => {
      if (!orphanedId || allUserEventIds.has(orphanedId) || allDeletedEventIds.has(orphanedId)) return;
      const oStats = actualComputeMetrics.eventComputeMap.get(orphanedId);
      if (!oStats || (oStats.photoRuns === 0 && oStats.videoCpuRuns === 0 && oStats.videoGpuRuns === 0)) return;

      const orphanedLogs = modalLogs.filter(l => l.event_id === orphanedId);
      const knownBytes = orphanedLogs.reduce((s, l) => s + (Number(l.media_size) || 0), 0);
      const totalPhotos = oStats.photoRuns;
      const totalVideos = oStats.videoCpuRuns + oStats.videoGpuRuns;
      const totalMedia = totalPhotos + totalVideos;
      
      const estimatedBytes = (totalPhotos * 4.5 * 1024 * 1024) + (totalVideos * 45 * 1024 * 1024);
      const delBytes = knownBytes > 0 ? knownBytes : estimatedBytes;
      const delGb = delBytes / (1024 * 1024 * 1024);

      const timestamps = orphanedLogs
        .map(l => new Date(l.created_at).getTime())
        .filter(t => !isNaN(t) && t > 0);
      
      const firstUploadMs = timestamps.length > 0 ? Math.min(...timestamps) : (now - 30 * 86400000);
      const lastUploadMs = timestamps.length > 0 ? Math.max(...timestamps) : firstUploadMs;
      const estimatedDeletedAtMs = Math.min(now, lastUploadMs + (30 * 86400000));

      const oStart = Math.max(firstUploadMs, windowStartMs);
      const oEnd = Math.min(estimatedDeletedAtMs, windowEndMs);
      let oHours = Math.max(0, (oEnd - oStart) / 3600000);
      if (oHours > 0 && oHours < 1) oHours = 1;

      const gbHours = delGb * oHours;
      const billableGbMonths = gbHours / 720;
      const storageCostInr = billableGbMonths * 0.60;

      const wasUploadedInWindow = firstUploadMs >= windowStartMs && firstUploadMs <= windowEndMs;
      const wasDeletedInWindow = estimatedDeletedAtMs >= windowStartMs && estimatedDeletedAtMs <= windowEndMs;

      const classCUploads = wasUploadedInWindow ? totalMedia : 0;
      const classCDeletions = wasDeletedInWindow ? totalMedia : 0;
      const classCTotal = classCUploads + classCDeletions;
      const classCCostInr = (classCTotal / 1000) * 0.40;
      const classBReads = oHours > 0 ? Math.min(30, totalMedia) : 0;
      const classBCostInr = (classBReads / 10000) * 0.40;

      const totalCostInr = storageCostInr + classCCostInr + classBCostInr;
      const title = `Historical Gallery (${orphanedId.slice(0, 8)}...)`;

      rows.push({
        id: `b2-orphaned-${orphanedId}`,
        galId: orphanedId,
        title,
        type: 'deleted',
        photoCount: totalPhotos,
        videoCount: totalVideos,
        totalMediaCount: totalMedia,
        bytes: delBytes,
        gb: delGb,
        windowDurationHours: oHours,
        gbHours,
        billableGbMonths,
        storageCostInr,
        storageCostUsd: storageCostInr / 100,
        classCUploads,
        classCDeletions,
        classCTotal,
        classCCostInr,
        classBReads,
        classBCostInr,
        totalTransactionsCount: classCTotal + classBReads,
        totalTransactionsCostInr: classCCostInr + classBCostInr,
        bandwidthCostInr: 0,
        totalCostInr,
        totalCostUsd: totalCostInr / 100,
        searchableText: `historical gallery ${orphanedId} deleted`.toLowerCase(),
      });
    });

    // Filter to rows that actually existed or had activity within the active timeframe window
    const rowsInWindow = rows.filter(r => r.windowDurationHours > 0 || r.classCTotal > 0);

    const activeRows = rows.filter(r => r.type === 'active');
    const totalGbStored = activeRows.reduce((s, r) => s + r.gb, 0);

    const totalGbHours = rows.reduce((s, r) => s + r.gbHours, 0);
    const totalBillableGbMonths = totalGbHours / 720;
    const totalStorageCostInr = totalBillableGbMonths * 0.60;
    const totalStorageCostUsd = totalStorageCostInr / 100;

    const totalClassCUploads = rows.reduce((s, r) => s + r.classCUploads, 0);
    const totalClassCDeletions = rows.reduce((s, r) => s + r.classCDeletions, 0);
    const totalClassC = totalClassCUploads + totalClassCDeletions;
    const totalClassCCostInr = (totalClassC / 1000) * 0.40;

    const totalClassB = rows.reduce((s, r) => s + r.classBReads, 0);
    const totalClassBCostInr = (totalClassB / 10000) * 0.40;

    const totalTransactionCostInr = totalClassCCostInr + totalClassBCostInr;
    const grandTotalB2CostInr = totalStorageCostInr + totalTransactionCostInr;
    const grandTotalB2CostUsd = grandTotalB2CostInr / 100;

    const freeTierStorageCreditInr = 0;
    const netBilledB2CostInr = grandTotalB2CostInr;

    // Window-specific metrics (only events active or present during this selected timeframe):
    const windowPhotos = rowsInWindow.reduce((s, r) => s + r.photoCount, 0);
    const windowVideos = rowsInWindow.reduce((s, r) => s + r.videoCount, 0);
    const windowMediaCount = windowPhotos + windowVideos;
    const windowBytes = rowsInWindow.reduce((s, r) => s + r.bytes, 0);
    const windowPeakGb = rowsInWindow.reduce((s, r) => s + r.gb, 0);
    const windowAvgGb = windowDurationHours > 0 ? (totalGbHours / windowDurationHours) : 0;

    // Lifetime/all-time totals for reference
    const lifetimePeakGb = rows.reduce((s, r) => s + r.gb, 0);
    const lifetimeTotalBytes = rows.reduce((s, r) => s + r.bytes, 0);

    return {
      rows,
      rowsInWindow,
      windowStartMs,
      windowEndMs,
      windowDurationHours,
      windowDurationDays,
      formattedRange,
      durationLabel,
      totalPhotos: windowPhotos,
      totalVideos: windowVideos,
      totalMediaCount: windowMediaCount,
      totalBytes: windowBytes,
      windowBytes,
      windowPeakGb,
      windowAvgGb,
      lifetimePeakGb,
      lifetimeTotalBytes,
      totalGbStored,
      totalPeakGb: windowPeakGb,
      totalGbHours,
      totalBillableGbMonths,
      totalStorageCostInr,
      totalStorageCostUsd,
      totalClassCUploads,
      totalClassCDeletions,
      totalClassC,
      totalClassCCostInr,
      totalClassB,
      totalClassBCostInr,
      totalTransactionCostInr,
      grandTotalB2CostInr,
      grandTotalB2CostUsd,
      freeTierStorageCreditInr,
      netBilledB2CostInr,
    };
  }, [
    b2TimeFilter,
    b2CustomStartDate,
    b2CustomEndDate,
    userEventMetrics,
    actualComputeMetrics,
    photos,
    deletedEvents,
    modalLogs,
    user.createdAt
  ]);

  const initials = (user.name || user.email || 'U')
    .trim()
    .split(' ')
    .map(n => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const handleUpdatePlanTier = async (newRole: string) => {
    if (!onPlanChange) return;
    if (isProtected && newRole !== 'admin') {
      alert('This Super Admin account is permanently protected and cannot be changed.');
      return;
    }
    setSavingPlan(true);
    try {
      await onPlanChange(user.id, newRole);
    } finally {
      setSavingPlan(false);
    }
  };

  const handleUpdateDuration = async (newDuration: string) => {
    if (!onDurationChange) return;
    setSavingPlan(true);
    try {
      await onDurationChange(user.id, newDuration);
    } finally {
      setSavingPlan(false);
    }
  };

  const handleSaveDates = async () => {
    if (!onPlanDatesChange) return;
    if (!editStartDate || !editEndDate) {
      alert('Both Start Date and End Date are required.');
      return;
    }
    setSavingDates(true);
    try {
      await onPlanDatesChange(user.id, editStartDate, editEndDate);
      alert('Plan dates updated successfully.');
    } finally {
      setSavingDates(false);
    }
  };

  if (viewingGallery) {
    return (
      <div className="space-y-6 animate-fadeIn">
        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <button
              type="button"
              onClick={() => setViewingGallery(null)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-200 text-xs font-semibold transition-colors cursor-pointer w-fit shadow-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to {user.name || user.email || 'User'}&apos;s Detail Page
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Viewing Gallery:</span>
              <span className="text-xs font-bold text-white bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-lg">
                {viewingGallery.title || 'Untitled Event'}
              </span>
            </div>
          </div>
        </div>
        <GalleryViewer
          initialGallery={viewingGallery}
          events={events}
          onClose={() => setViewingGallery(null)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb Navigation & Super Admin Badges */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBack}
          className="group inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-800/80 bg-slate-900/60 hover:bg-slate-800/80 hover:border-slate-700 text-slate-400 hover:text-white text-xs font-medium transition-all shadow-sm cursor-pointer w-fit"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
          <span>Registered Accounts</span>
          <span className="text-slate-600">/</span>
          <span className="text-slate-300 font-semibold">{user.name || user.email || 'User Profile'}</span>
        </button>

        {/* Protection / Status Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          {isProtected && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs font-semibold shadow-sm">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              Protected Super Admin
            </span>
          )}
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border shadow-sm ${
            cleanRole === 'admin' ? 'bg-amber-500/10 text-amber-300 border-amber-500/25' :
            cleanRole === 'ultimate' ? 'bg-rose-500/10 text-rose-300 border-rose-500/25' :
            cleanRole === 'pro' || cleanRole === 'premium' ? 'bg-purple-500/10 text-purple-300 border-purple-500/25' :
            cleanRole === 'standard' || cleanRole === 'basic' ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/25' :
            cleanRole === 'starter' ? 'bg-orange-500/10 text-orange-300 border-orange-500/25' :
            'bg-emerald-500/10 text-emerald-300 border-emerald-500/25'
          }`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            {currentPlan.label}
          </span>
        </div>
      </div>

      {/* User Hero Profile Banner Card */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-800/80 bg-gradient-to-b from-slate-900/90 via-[#0e1626]/90 to-[#0a0f1d]/90 p-6 md:p-8 shadow-2xl backdrop-blur-md">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 -bottom-16 h-64 w-64 rounded-full bg-purple-500/10 blur-3xl" />

        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Avatar & User Details */}
          <div className="flex items-start sm:items-center gap-4 sm:gap-5 min-w-0">
            <div className="relative group shrink-0">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-700 to-purple-600 p-0.5 shadow-xl shadow-indigo-500/15">
                <div className="w-full h-full rounded-[14px] bg-[#0c1322] flex items-center justify-center text-white font-black text-xl sm:text-2xl tracking-tight">
                  {initials || 'U'}
                </div>
              </div>
            </div>

            <div className="min-w-0 space-y-1.5">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight truncate">
                  {user.name || 'Anonymous User'}
                </h1>
                {user.username && (
                  <span className="font-mono text-xs font-semibold text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-0.5 rounded-lg">
                    @{user.username}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 flex-wrap text-xs text-slate-400">
                {user.email ? (
                  <button
                    type="button"
                    onClick={() => copyToClipboard(user.email, 'email')}
                    className="inline-flex items-center gap-1.5 hover:text-white transition-colors group cursor-pointer font-mono"
                    title="Click to copy email"
                  >
                    <span>{user.email}</span>
                    {copiedField === 'email' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300 shrink-0" />
                    )}
                  </button>
                ) : (
                  <span className="italic text-slate-500">No email registered</span>
                )}

                {user.phone && (
                  <>
                    <span className="text-slate-700">&bull;</span>
                    <span className="font-mono text-slate-300">{user.phone}</span>
                  </>
                )}

                <span className="text-slate-700">&bull;</span>
                <span className="text-slate-400">
                  Joined {user.createdAt ? new Date(user.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Metrics Cluster */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 shrink-0">
            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-3 sm:px-4 sm:py-3 text-center backdrop-blur-sm">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block mb-0.5">
                Storage
              </span>
              <span className="text-sm sm:text-base font-extrabold text-white font-mono">
                {formatBytes(userEventMetrics.totalBytes)}
              </span>
            </div>

            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-3 sm:px-4 sm:py-3 text-center backdrop-blur-sm">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block mb-0.5">
                Events
              </span>
              <span className="text-sm sm:text-base font-extrabold text-white">
                {userEventMetrics.mainEventsCount}
              </span>
            </div>

            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-3 sm:px-4 sm:py-3 text-center backdrop-blur-sm">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block mb-0.5">
                Media Files
              </span>
              <span className="text-sm sm:text-base font-extrabold text-white">
                {userEventMetrics.totalMediaCount.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* 5 Subpage Navigation Tabs (Segmented Floating Pill Design) */}
        <div className="mt-8 pt-6 border-t border-slate-800/80">
          <div className="inline-flex p-1.5 rounded-2xl bg-slate-950/70 border border-slate-800/90 shadow-inner gap-1.5 flex-wrap">
            {/* Tab 1: User Info */}
            <button
              type="button"
              onClick={() => setActiveTab('info')}
              className={`h-9 shrink-0 inline-flex items-center gap-2 px-3.5 rounded-xl text-xs font-bold transition-colors cursor-pointer select-none ${
                activeTab === 'info'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <User className="w-3.5 h-3.5 shrink-0" />
              <span>User Info</span>
            </button>

            {/* Tab 2: Events & Sub-events */}
            <button
              type="button"
              onClick={() => setActiveTab('events')}
              className={`h-9 shrink-0 inline-flex items-center gap-2 px-3.5 rounded-xl text-xs font-bold transition-colors cursor-pointer select-none ${
                activeTab === 'events'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              <span>Events</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono leading-none ${
                activeTab === 'events' ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-300'
              }`}>
                {userEventMetrics.mainEventsCount}
              </span>
            </button>

            {/* Tab 3: Storage Data */}
            <button
              type="button"
              onClick={() => setActiveTab('storage')}
              className={`h-9 shrink-0 inline-flex items-center gap-2 px-3.5 rounded-xl text-xs font-bold transition-colors cursor-pointer select-none ${
                activeTab === 'storage'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <HardDrive className="w-3.5 h-3.5 shrink-0" />
              <span>Storage Data</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono leading-none ${
                activeTab === 'storage' ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-300'
              }`}>
                {formatBytes(userEventMetrics.totalBytes)}
              </span>
            </button>

            {/* Tab 4: Plan Data */}
            <button
              type="button"
              onClick={() => setActiveTab('plan')}
              className={`h-9 shrink-0 inline-flex items-center gap-2 px-3.5 rounded-xl text-xs font-bold transition-colors cursor-pointer select-none ${
                activeTab === 'plan'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5 shrink-0" />
              <span>Plan Data</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-md uppercase leading-none ${
                activeTab === 'plan' ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-300'
              }`}>
                {user.role || 'free'}
              </span>
            </button>

            {/* Tab 5: Economics */}
            <button
              type="button"
              onClick={() => setActiveTab('cost')}
              className={`h-9 shrink-0 inline-flex items-center gap-2 px-3.5 rounded-xl text-xs font-bold transition-colors cursor-pointer select-none ${
                activeTab === 'cost'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/25'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <IndianRupee className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
              <span>Economics</span>
            </button>
          </div>
        </div>
      </div>

      {/* SUBPAGE 1: USER INFO */}
      {activeTab === 'info' && (
        <div className="grid md:grid-cols-2 gap-6 animate-fadeIn">
          {/* Card: Profile & Contact Details */}
          <div className="relative overflow-hidden rounded-3xl border border-slate-800/80 bg-gradient-to-b from-[#111827] to-[#0c1322] p-6 sm:p-7 shadow-xl space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
              <h2 className="text-base font-bold text-white flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                  <User className="w-4 h-4" />
                </div>
                <span>Profile & Contact Details</span>
              </h2>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Identity</span>
            </div>

            <div className="space-y-4 text-xs">
              <div className="flex items-center justify-between py-2 border-b border-slate-800/60">
                <span className="text-slate-400 font-medium">Full Name</span>
                <span className="font-semibold text-white text-sm">{user.name || 'Not provided'}</span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-slate-800/60">
                <span className="text-slate-400 font-medium">Email Address</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-slate-200 select-all">{user.email || 'No email'}</span>
                  {user.email && (
                    <button
                      type="button"
                      onClick={() => copyToClipboard(user.email, 'email')}
                      className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Copy email"
                    >
                      {copiedField === 'email' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-slate-800/60">
                <span className="text-slate-400 font-medium">Username</span>
                <span className="font-mono font-semibold text-indigo-300">
                  {user.username ? `@${user.username}` : <span className="text-slate-600 font-normal italic">None</span>}
                </span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-slate-800/60">
                <span className="text-slate-400 font-medium">Phone Number</span>
                <span className="font-mono text-slate-200">
                  {user.phone || <span className="text-slate-600 font-normal italic">No phone registered</span>}
                </span>
              </div>

              <div className="flex items-center justify-between py-2">
                <span className="text-slate-400 font-medium">Supabase User ID</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] text-slate-400 bg-slate-900/80 border border-slate-800 px-2 py-0.5 rounded-lg select-all max-w-[200px] truncate">
                    {user.id}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(user.id, 'id')}
                    className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Copy User ID"
                  >
                    {copiedField === 'id' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Card: Account Security & Timestamps */}
          <div className="relative overflow-hidden rounded-3xl border border-slate-800/80 bg-gradient-to-b from-[#111827] to-[#0c1322] p-6 sm:p-7 shadow-xl space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
              <h2 className="text-base font-bold text-white flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                  <Clock className="w-4 h-4" />
                </div>
                <span>Activity & Role Classification</span>
              </h2>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Security</span>
            </div>

            <div className="space-y-4 text-xs">
              <div className="flex items-center justify-between py-2 border-b border-slate-800/60">
                <span className="text-slate-400 font-medium">Account Role</span>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 font-bold uppercase tracking-wider text-[11px]">
                    {user.role || 'free'}
                  </span>
                  {user.roleType && (
                    <span className="px-2 py-0.5 rounded-md border border-slate-700 bg-slate-800 text-slate-400 text-[10px] font-semibold">
                      {user.roleType}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-slate-800/60">
                <span className="text-slate-400 font-medium">Account Created Date</span>
                <div className="flex items-center gap-1.5 text-slate-200 font-medium">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span>{user.createdAt ? new Date(user.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown'}</span>
                </div>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-slate-800/60">
                <span className="text-slate-400 font-medium">Last Active Date</span>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${user.lastLogin ? 'bg-sky-400 animate-pulse' : 'bg-slate-600'}`} />
                  <span className={user.lastLogin ? 'text-sky-300 font-medium' : 'text-slate-500'}>
                    {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'Never recorded'}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-slate-800/60">
                <span className="text-slate-400 font-medium">Delegated Administration</span>
                <span className="text-slate-300">
                  {user.delegatedBy ? (
                    <span className="text-amber-400 font-medium">Delegated by: <strong className="font-mono text-[11px]">{user.delegatedBy}</strong></span>
                  ) : (
                    <span className="text-slate-500">None (Primary account holder)</span>
                  )}
                </span>
              </div>

              {user.assignedEvents && user.assignedEvents.length > 0 && (
                <div className="pt-2 space-y-2">
                  <span className="text-slate-400 font-medium block">Assigned Events</span>
                  <div className="flex flex-wrap gap-1.5">
                    {user.assignedEvents.map(eventId => (
                      <span key={eventId} className="font-mono text-[11px] px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
                        {eventId}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUBPAGE: EVENTS & SUB-EVENTS */}
      {activeTab === 'events' && (() => {
        const query = eventSearch.trim().toLowerCase();
        const filteredEvents = userEventMetrics.mainEventBreakdown.filter(({ event, children, combined }) => {
          if (query) {
            const matchesTitle = (event.title || '').toLowerCase().includes(query);
            const matchesId = (event.id || '').toLowerCase().includes(query);
            const matchesChild = children.some(c => (c.event.title || '').toLowerCase().includes(query) || (c.event.id || '').toLowerCase().includes(query));
            if (!matchesTitle && !matchesId && !matchesChild) return false;
          }

          if (eventFilter === 'with-subs') {
            return children.length > 0;
          }
          if (eventFilter === 'with-media') {
            return combined.totalCount > 0;
          }
          return true;
        });

        const allExpandableIds = userEventMetrics.mainEventBreakdown.filter(m => m.children.length > 0).map(m => m.event.id);

        return (
          <div className="space-y-6 animate-fadeIn">
            {/* Top KPI Cards (Sleek Glassmorphic Tiles) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
              <div className="rounded-2xl border border-slate-800/80 bg-gradient-to-b from-slate-900/90 to-[#0c1322] p-4 shadow-lg backdrop-blur-sm transition-all hover:border-emerald-500/30">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Main Events</span>
                  <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <FolderTree className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="text-2xl font-black text-white">{userEventMetrics.mainEventsCount}</div>
                <span className="text-[11px] text-slate-500">Primary galleries</span>
              </div>

              <div className="rounded-2xl border border-slate-800/80 bg-gradient-to-b from-slate-900/90 to-[#0c1322] p-4 shadow-lg backdrop-blur-sm transition-all hover:border-indigo-500/30">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Sub-Events</span>
                  <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    <Layers className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="text-2xl font-black text-white">{userEventMetrics.subGalleriesCount}</div>
                <span className="text-[11px] text-slate-500">Sub-galleries created</span>
              </div>

              <div className="rounded-2xl border border-slate-800/80 bg-gradient-to-b from-slate-900/90 to-[#0c1322] p-4 shadow-lg backdrop-blur-sm transition-all hover:border-sky-500/30">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Photos</span>
                  <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
                    <ImageIcon className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="text-2xl font-black text-white">{userEventMetrics.imageCount.toLocaleString()}</div>
                <span className="text-[11px] text-sky-400 font-mono font-semibold">{formatBytes(userEventMetrics.imageBytes)}</span>
              </div>

              <div className="rounded-2xl border border-slate-800/80 bg-gradient-to-b from-slate-900/90 to-[#0c1322] p-4 shadow-lg backdrop-blur-sm transition-all hover:border-violet-500/30">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Videos</span>
                  <div className="p-1.5 rounded-lg bg-violet-500/10 text-violet-400 border border-violet-500/20">
                    <VideoIcon className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="text-2xl font-black text-white">{userEventMetrics.videoCount.toLocaleString()}</div>
                <span className="text-[11px] text-violet-400 font-mono font-semibold">{formatBytes(userEventMetrics.videoBytes)}</span>
              </div>

              <div className="rounded-2xl border border-slate-800/80 bg-gradient-to-b from-slate-900/90 to-[#0c1322] p-4 shadow-lg backdrop-blur-sm transition-all hover:border-purple-500/30 col-span-2 sm:col-span-1">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Storage</span>
                  <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    <HardDrive className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="text-2xl font-black text-white font-mono">{formatBytes(userEventMetrics.totalBytes)}</div>
                <span className="text-[11px] text-slate-500">{userEventMetrics.totalMediaCount.toLocaleString()} total files</span>
              </div>
            </div>

            {/* Search & Filter Toolbar */}
            <div className="rounded-2xl border border-slate-800/80 bg-[#111827]/90 p-3.5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-3.5 backdrop-blur-sm">
              {/* Search Bar */}
              <div className="relative flex-1 max-w-md">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search events by title or ID..."
                  value={eventSearch}
                  onChange={e => setEventSearch(e.target.value)}
                  className="w-full bg-slate-900/90 border border-slate-800 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 transition-colors"
                />
                {eventSearch && (
                  <button
                    type="button"
                    onClick={() => setEventSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-white"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Filter Pills & Expand Toggles */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center rounded-xl bg-slate-900 border border-slate-800/90 p-1">
                  <Filter className="w-3 h-3 text-slate-500 ml-2 mr-1 shrink-0" />
                  <button
                    type="button"
                    onClick={() => setEventFilter('all')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      eventFilter === 'all'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    All ({userEventMetrics.mainEventsCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setEventFilter('with-subs')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      eventFilter === 'with-subs'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    With Sub-events ({userEventMetrics.mainEventBreakdown.filter(m => m.children.length > 0).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setEventFilter('with-media')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      eventFilter === 'with-media'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    With Media ({userEventMetrics.mainEventBreakdown.filter(m => m.combined.totalCount > 0).length})
                  </button>
                </div>

                {allExpandableIds.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => expandAllEvents(allExpandableIds)}
                      className="px-2.5 py-1.5 rounded-xl border border-slate-800 bg-slate-900/80 hover:bg-slate-800 text-[11px] font-semibold text-slate-300 transition-colors cursor-pointer shadow-sm"
                    >
                      Expand All
                    </button>
                    <button
                      type="button"
                      onClick={collapseAllEvents}
                      className="px-2.5 py-1.5 rounded-xl border border-slate-800 bg-slate-900/80 hover:bg-slate-800 text-[11px] font-semibold text-slate-300 transition-colors cursor-pointer shadow-sm"
                    >
                      Collapse All
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Events List */}
            {filteredEvents.length === 0 ? (
              <div className="rounded-3xl border border-slate-800/80 bg-[#111827]/90 p-12 text-center shadow-xl space-y-3">
                <FolderTree className="w-10 h-10 text-slate-600 mx-auto" />
                <h3 className="text-base font-bold text-white">No Events Found</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  {userEventMetrics.mainEventsCount === 0
                    ? 'This user has not created any events or galleries yet.'
                    : 'No events match your current search or filter criteria.'}
                </p>
                {eventSearch && (
                  <button
                    type="button"
                    onClick={() => setEventSearch('')}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-colors cursor-pointer"
                  >
                    Clear Search
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredEvents.map(({ event, directStats, children, combined }) => {
                  const isExpanded = expandedEventIds.has(event.id);
                  const hasSubs = children.length > 0;

                  return (
                    <div
                      key={event.id}
                      className="rounded-3xl border border-slate-800/80 hover:border-slate-700/80 bg-gradient-to-b from-[#111827] to-[#0c1322] shadow-xl transition-all overflow-hidden"
                    >
                      {/* Event Header Card */}
                      <div className="p-5 sm:p-6 space-y-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          {/* Title & Badges */}
                          <div className="min-w-0 space-y-1.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-base font-bold text-white truncate">
                                {event.title || 'Untitled Event'}
                              </h3>

                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                                Main Event
                              </span>

                              {event.isSampleGallery && (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 border border-amber-500/30 text-amber-300">
                                  Sample Gallery
                                </span>
                              )}
                            </div>

                            {/* Event ID with copy */}
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              <span className="font-semibold uppercase tracking-wider text-[10px] text-slate-600">Event ID:</span>
                              <code className="font-mono text-[11px] text-slate-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-lg select-all">
                                {event.id}
                              </code>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(event.id, `evt-${event.id}`)}
                                className="text-slate-500 hover:text-white transition-colors cursor-pointer"
                                title="Copy Event ID"
                              >
                                {copiedField === `evt-${event.id}` ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-2 flex-wrap shrink-0">
                            {/* View Gallery Button */}
                            <button
                              type="button"
                              onClick={() => setViewingGallery(event)}
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-sky-500/10 border border-sky-500/25 text-sky-300 hover:bg-sky-500/20 hover:border-sky-400/50 text-xs font-bold transition-all shadow-sm cursor-pointer"
                              title="Inspect photos and videos uploaded to this event"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              View Uploads
                            </button>

                            {/* Sample Gallery Toggle */}
                            {onToggleSampleGallery && (
                              <button
                                type="button"
                                disabled={sampleUpdatingEventId === event.id}
                                onClick={() => handleToggleSampleGallery(event)}
                                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border text-xs font-bold transition-colors cursor-pointer disabled:cursor-wait disabled:opacity-50 ${
                                  event.isSampleGallery
                                    ? 'border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
                                    : 'border-slate-800 bg-slate-900/80 text-slate-400 hover:text-white hover:border-slate-700'
                                }`}
                                title={event.isSampleGallery ? 'Remove from Sample Galleries' : 'Mark as Sample Gallery'}
                              >
                                <Star className={`w-3.5 h-3.5 ${event.isSampleGallery ? 'fill-current' : ''}`} />
                                {sampleUpdatingEventId === event.id ? 'Saving' : event.isSampleGallery ? 'Sample' : 'Add Sample'}
                              </button>
                            )}

                            {/* Delete Event Button */}
                            {onDeleteEvent && (
                              <button
                                type="button"
                                disabled={deletingEventId === event.id}
                                onClick={() => handleDeleteEvent({ ...event, subGalleriesCount: children.length })}
                                className="inline-flex items-center justify-center h-8 w-8 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 hover:border-red-400 hover:bg-red-500/20 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-45"
                                title="Permanently delete this event and its media"
                                aria-label="Delete event"
                              >
                                <Trash2 className={`w-3.5 h-3.5 ${deletingEventId === event.id ? 'animate-pulse' : ''}`} />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Event-Wise Storage & Media Stats Ribbon */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2.5 pt-3 border-t border-slate-800/80">
                          {/* 1. Direct Photos */}
                          <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-2.5">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block mb-0.5">
                              Main Photos
                            </span>
                            <div className="flex items-baseline justify-between">
                              <span className="font-bold text-xs text-white">
                                {directStats.imageCount}
                              </span>
                              <span className="text-[11px] font-mono text-sky-400 font-semibold">
                                {formatBytes(directStats.imageBytes)}
                              </span>
                            </div>
                          </div>

                          {/* 2. Direct Videos */}
                          <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-2.5">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block mb-0.5">
                              Main Videos
                            </span>
                            <div className="flex items-baseline justify-between">
                              <span className="font-bold text-xs text-white">
                                {directStats.videoCount}
                              </span>
                              <span className="text-[11px] font-mono text-violet-400 font-semibold">
                                {formatBytes(directStats.videoBytes)}
                              </span>
                            </div>
                          </div>

                          {/* 3. Direct Total */}
                          <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-2.5">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block mb-0.5">
                              Direct Media Size
                            </span>
                            <div className="flex items-baseline justify-between">
                              <span className="font-bold text-xs text-slate-300">
                                {directStats.totalCount} items
                              </span>
                              <span className="text-[11px] font-mono font-bold text-slate-200">
                                {formatBytes(directStats.totalBytes)}
                              </span>
                            </div>
                          </div>

                          {/* 4. Sub-events count */}
                          <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-2.5">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block mb-0.5">
                              Sub-Events
                            </span>
                            <div className="flex items-baseline justify-between">
                              <span className="font-bold text-xs text-indigo-300">
                                {children.length} sub
                              </span>
                              <span className="text-[11px] font-mono text-indigo-400 font-semibold">
                                {formatBytes(combined.totalBytes - directStats.totalBytes)}
                              </span>
                            </div>
                          </div>

                          {/* 5. Combined Grand Total */}
                          <div className="bg-indigo-950/20 border border-indigo-500/20 rounded-xl p-2.5 col-span-2 sm:col-span-1">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-400 block mb-0.5">
                              Combined Total
                            </span>
                            <div className="flex items-baseline justify-between">
                              <span className="font-bold text-xs text-white">
                                {combined.totalCount} items
                              </span>
                              <span className="text-[11px] font-mono font-bold text-emerald-400">
                                {formatBytes(combined.totalBytes)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Sub-Events Toggle Bar */}
                        {hasSubs && (
                          <button
                            type="button"
                            onClick={() => toggleExpandEvent(event.id)}
                            className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-900/80 hover:bg-slate-900 border border-slate-800 rounded-xl text-xs font-semibold text-slate-300 transition-colors cursor-pointer shadow-sm"
                          >
                            <div className="flex items-center gap-2">
                              <Layers className="w-3.5 h-3.5 text-indigo-400" />
                              <span>
                                {isExpanded ? 'Hide' : 'Show'} Sub-Events / Sub-Galleries ({children.length})
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-slate-500 font-mono">
                                {children.reduce((sum, c) => sum + c.stats.totalCount, 0)} items &bull; {formatBytes(combined.totalBytes - directStats.totalBytes)}
                              </span>
                              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                            </div>
                          </button>
                        )}
                      </div>

                      {/* Nested Sub-Events Tree Content */}
                      {hasSubs && isExpanded && (
                        <div className="border-t border-slate-800/80 bg-slate-950/60 p-5 space-y-3">
                          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                            <Layers className="w-3 h-3 text-indigo-400" />
                            Sub-Events Inside “{event.title || 'Untitled'}”
                          </div>

                          <div className="space-y-2.5 border-l-2 border-indigo-500/20 pl-3 sm:pl-4 ml-1">
                            {children.map(child => (
                              <div
                                key={child.event.id}
                                className="rounded-2xl border border-slate-800/80 hover:border-slate-700/80 bg-slate-900/60 p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 transition-colors"
                              >
                                {/* Sub-event Info */}
                                <div className="min-w-0 space-y-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className="text-xs font-bold text-white truncate">
                                      {child.event.title || 'Untitled Sub-gallery'}
                                    </h4>
                                    <span className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">
                                      Sub-Gallery
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2 text-[10px] text-slate-500">
                                    <span>ID:</span>
                                    <code className="font-mono text-[10px] text-slate-400 bg-slate-950 border border-slate-800 px-1.5 py-0.5 rounded select-all">
                                      {child.event.id}
                                    </code>
                                    <button
                                      type="button"
                                      onClick={() => copyToClipboard(child.event.id, `evt-${child.event.id}`)}
                                      className="text-slate-500 hover:text-white transition-colors cursor-pointer"
                                      title="Copy Sub-event ID"
                                    >
                                      {copiedField === `evt-${child.event.id}` ? (
                                        <Check className="w-3 h-3 text-emerald-400" />
                                      ) : (
                                        <Copy className="w-3 h-3" />
                                      )}
                                    </button>
                                  </div>
                                </div>

                                {/* Sub-event Metrics & Actions */}
                                <div className="flex items-center gap-2.5 flex-wrap shrink-0">
                                  <div className="flex items-center gap-2.5 text-xs bg-slate-950/80 border border-slate-800/80 px-3 py-1.5 rounded-xl">
                                    <span className="text-slate-400">
                                      Photos: <strong className="text-white font-mono">{child.stats.imageCount}</strong> <span className="text-sky-400 text-[10px]">({formatBytes(child.stats.imageBytes)})</span>
                                    </span>
                                    <span className="text-slate-700">|</span>
                                    <span className="text-slate-400">
                                      Videos: <strong className="text-white font-mono">{child.stats.videoCount}</strong> <span className="text-violet-400 text-[10px]">({formatBytes(child.stats.videoBytes)})</span>
                                    </span>
                                    <span className="text-slate-700">|</span>
                                    <span className="font-bold text-slate-200 font-mono">
                                      {formatBytes(child.stats.totalBytes)}
                                    </span>
                                  </div>

                                  {/* View Sub-Gallery Button */}
                                  <button
                                    type="button"
                                    onClick={() => setViewingGallery(child.event)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500/10 border border-sky-500/25 text-sky-300 hover:bg-sky-500/20 text-xs font-semibold transition-colors cursor-pointer shadow-sm"
                                    title="View media uploaded to this sub-event"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    View Uploads
                                  </button>

                                  {/* Delete Sub-event Button */}
                                  {onDeleteEvent && (
                                    <button
                                      type="button"
                                      disabled={deletingEventId === child.event.id}
                                      onClick={() => handleDeleteEvent(child.event)}
                                      className="inline-flex items-center justify-center h-7 w-7 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 hover:border-red-400 hover:bg-red-500/20 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-45"
                                      title="Delete this sub-event"
                                      aria-label="Delete sub-event"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Orphan/Standalone Sub-events (if any exist) */}
            {userEventMetrics.orphanSubEvents.length > 0 && (
              <div className="rounded-3xl border border-slate-800/80 bg-[#111827] p-6 shadow-xl space-y-3">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-bold text-white">
                    Additional Sub-Galleries ({userEventMetrics.orphanSubEvents.length})
                  </h3>
                  <span className="text-xs text-slate-500">
                    Sub-galleries with parent event outside the main events list
                  </span>
                </div>

                <div className="space-y-2">
                  {userEventMetrics.orphanSubEvents.map(child => (
                    <div
                      key={child.event.id}
                      className="rounded-2xl bg-slate-900/70 border border-slate-800 p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3"
                    >
                      <div>
                        <h4 className="text-xs font-bold text-white">{child.event.title || 'Untitled Sub-gallery'}</h4>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                          <span>ID:</span>
                          <code className="font-mono text-slate-400 bg-slate-950 px-1 rounded">{child.event.id}</code>
                          {child.event.parentId && <span>(Parent: <code className="font-mono text-slate-400">{child.event.parentId}</code>)</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-xs text-slate-300 font-mono">
                          {child.stats.imageCount} photos ({formatBytes(child.stats.imageBytes)}) &bull; {child.stats.videoCount} videos ({formatBytes(child.stats.videoBytes)}) &bull; <strong className="text-white">{formatBytes(child.stats.totalBytes)}</strong>
                        </div>
                        <button
                          type="button"
                          onClick={() => setViewingGallery(child.event)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500/10 border border-sky-500/25 text-sky-300 hover:bg-sky-500/20 text-xs font-semibold transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View Uploads
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* SUBPAGE 3: STORAGE DATA */}
      {activeTab === 'storage' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Storage Quota & Visual Progress Bar Card */}
          <div className="rounded-3xl border border-slate-800/80 bg-gradient-to-b from-[#111827] to-[#0c1322] p-6 sm:p-7 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                  <HardDrive className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Storage Allocation & Quota</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Active cloud object storage usage against allotted tier limits
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-400">Allotted Quota:</span>
                <span className="px-3 py-1 rounded-xl bg-indigo-500/10 border border-indigo-500/25 text-indigo-300 font-extrabold text-xs tracking-wide">
                  {currentPlan.storage}
                </span>
              </div>
            </div>

            {/* Quota Progress Meter */}
            <div className="space-y-2.5 pt-1">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-200">
                  <strong className="text-white font-mono">{formatBytes(userEventMetrics.totalBytes)}</strong> used of <span className="font-mono text-slate-400">{currentPlan.storage}</span>
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                  storagePercentage > 90 ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                  storagePercentage > 70 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                  'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                }`}>
                  {quotaBytes === Infinity ? 'Unlimited' : `${storagePercentage}% consumed`}
                </span>
              </div>

              <div className="w-full h-3 rounded-full bg-slate-900 border border-slate-800 overflow-hidden p-0.5 shadow-inner">
                <div
                  className={`h-full rounded-full transition-all duration-700 shadow-sm ${
                    storagePercentage > 90
                      ? 'bg-gradient-to-r from-rose-500 to-red-400'
                      : storagePercentage > 70
                      ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
                      : 'bg-gradient-to-r from-indigo-500 via-sky-400 to-emerald-400'
                  }`}
                  style={{ width: `${quotaBytes === Infinity ? 5 : Math.max(2, storagePercentage)}%` }}
                />
              </div>
            </div>

            {/* Storage Metric Cards Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 pt-2">
              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 transition-colors hover:border-slate-700/80">
                <div className="flex items-center gap-2 text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-sky-400" />
                  Photos Storage
                </div>
                <div className="text-xl font-black text-white font-mono">{formatBytes(userEventMetrics.imageBytes)}</div>
                <span className="text-xs text-slate-500 mt-0.5 block">{userEventMetrics.imageCount.toLocaleString()} total photos</span>
              </div>

              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 transition-colors hover:border-slate-700/80">
                <div className="flex items-center gap-2 text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1.5">
                  <VideoIcon className="w-3.5 h-3.5 text-violet-400" />
                  Videos Storage
                </div>
                <div className="text-xl font-black text-white font-mono">{formatBytes(userEventMetrics.videoBytes)}</div>
                <span className="text-xs text-slate-500 mt-0.5 block">{userEventMetrics.videoCount.toLocaleString()} total videos</span>
              </div>

              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 transition-colors hover:border-slate-700/80">
                <div className="flex items-center gap-2 text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1.5">
                  <FolderTree className="w-3.5 h-3.5 text-emerald-400" />
                  Primary Events
                </div>
                <div className="text-xl font-black text-white">{userEventMetrics.mainEventsCount}</div>
                <span className="text-xs text-slate-500 mt-0.5 block">Main event galleries</span>
              </div>

              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 transition-colors hover:border-slate-700/80">
                <div className="flex items-center gap-2 text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1.5">
                  <Layers className="w-3.5 h-3.5 text-amber-400" />
                  Sub-Galleries
                </div>
                <div className="text-xl font-black text-white">{userEventMetrics.subGalleriesCount}</div>
                <span className="text-xs text-slate-500 mt-0.5 block">Nested wedding functions</span>
              </div>
            </div>
          </div>

          {/* User's Events Breakdown Table Card */}
          <div className="rounded-3xl border border-slate-800/80 bg-gradient-to-b from-[#111827] to-[#0c1322] p-6 sm:p-7 shadow-xl space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
              <h2 className="text-base font-bold text-white flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
                  <FolderTree className="w-4 h-4" />
                </div>
                <span>Events & Media Storage Distribution</span>
              </h2>
              <span className="text-xs text-slate-500 font-medium">
                {userEventMetrics.mainEventsCount} active events
              </span>
            </div>

            {userEventMetrics.eventBreakdown.length === 0 ? (
              <p className="text-sm text-slate-500 py-8 text-center">No events created by this user yet.</p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-800/80">
                <table className="w-full text-left text-xs text-slate-400">
                  <thead className="bg-slate-950/80 text-slate-500 uppercase tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4 font-bold">Event Title</th>
                      <th className="py-3 px-4 font-bold">Sub-Galleries</th>
                      <th className="py-3 px-4 font-bold">Photos</th>
                      <th className="py-3 px-4 font-bold">Videos</th>
                      <th className="py-3 px-4 font-bold">Total Storage</th>
                      <th className="py-3 px-4 font-bold">Created Date</th>
                      <th className="py-3 px-4 text-right font-bold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {userEventMetrics.mainEventBreakdown.map(({ event, children, combined }) => (
                      <tr key={event.id} className="hover:bg-slate-900/50 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-white">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span>{event.title || 'Untitled Event'}</span>
                            {event.isSampleGallery && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/10 text-amber-300 border border-amber-500/20 font-bold">
                                Sample
                              </span>
                            )}
                          </div>
                          <div className="font-mono text-[10px] text-slate-500 mt-0.5">{event.id}</div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-300">{children.length} sub</td>
                        <td className="py-3.5 px-4 font-mono text-sky-400 font-semibold">{combined.imageCount} photos ({formatBytes(combined.imageBytes)})</td>
                        <td className="py-3.5 px-4 font-mono text-violet-400 font-semibold">{combined.videoCount} videos ({formatBytes(combined.videoBytes)})</td>
                        <td className="py-3.5 px-4 font-bold text-white font-mono">{formatBytes(combined.totalBytes)}</td>
                        <td className="py-3.5 px-4 text-slate-400">
                          {event.createdAt ? new Date(event.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => setViewingGallery(event)}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-sky-500/10 border border-sky-500/25 text-sky-300 hover:bg-sky-500/20 text-xs font-semibold transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBPAGE 4: PLAN DATA */}
      {activeTab === 'plan' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Current Plan Overview Card */}
          <div className="rounded-3xl border border-slate-800/80 bg-gradient-to-b from-[#111827] to-[#0c1322] p-6 sm:p-7 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Active Plan & Subscription</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Subscription plan tier, validity period, and renewal schedule
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 font-extrabold text-xs uppercase tracking-wider">
                  {currentPlan.label}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-1">
              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Billing Duration</span>
                <span className="text-base font-bold text-white capitalize flex items-center gap-2">
                  <Clock className="w-4 h-4 text-sky-400" />
                  {user.subscriptionDuration || 'Monthly'}
                </span>
              </div>

              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Start Date</span>
                <span className="text-base font-bold text-slate-200 flex items-center gap-2 font-mono">
                  <Calendar className="w-4 h-4 text-slate-500" />
                  {user.planStartDate ? new Date(user.planStartDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not set'}
                </span>
              </div>

              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">End Date & Validity</span>
                <div className="flex items-center justify-between">
                  <span className="text-base font-bold text-slate-200 flex items-center gap-2 font-mono">
                    <Calendar className="w-4 h-4 text-slate-500" />
                    {user.planEndDate ? new Date(user.planEndDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not set'}
                  </span>
                  {planDaysRemaining !== null && (
                    <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                      planDaysRemaining > 7 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                      planDaysRemaining > 0 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                      'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}>
                      {planDaysRemaining > 0 ? `${planDaysRemaining}d left` : 'Expired'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Admin Plan Modification Controls Card */}
          <div className="rounded-3xl border border-slate-800/80 bg-gradient-to-b from-[#111827] to-[#0c1322] p-6 sm:p-7 shadow-xl space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
              <h2 className="text-base font-bold text-white flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <Zap className="w-4 h-4" />
                </div>
                <span>Manage Plan & Validity</span>
              </h2>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Administration</span>
            </div>

            {isProtected ? (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 shrink-0 text-amber-400" />
                <span>
                  This account (<strong>{user.email || user.username}</strong>) is permanently protected as a Global Super Admin. The plan and admin role cannot be demoted.
                </span>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-6">
                {/* Plan Tier Selector */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300 block">
                    Change Subscription Plan Tier
                  </label>
                  <select
                    value={cleanRole === 'user' ? 'free' : cleanRole}
                    disabled={savingPlan || !onPlanChange}
                    onChange={e => handleUpdatePlanTier(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 outline-none focus:border-indigo-500/60 transition-colors cursor-pointer"
                  >
                    {planTiers.map(tier => (
                      <option key={tier.role} value={tier.role}>
                        {tier.label} ({tier.storage}) · ₹{tier.monthlyPriceInr}/mo
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-500">
                    Switching to a paid tier will automatically calculate storage limits and billing dates.
                  </p>
                </div>

                {/* Duration Selector */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300 block">
                    Change Billing Duration
                  </label>
                  <select
                    value={user.subscriptionDuration || 'monthly'}
                    disabled={savingPlan || !onDurationChange}
                    onChange={e => handleUpdateDuration(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 outline-none focus:border-indigo-500/60 transition-colors cursor-pointer"
                  >
                    {durationOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-500">
                    Updates the billing renewal interval and recalculates the end date.
                  </p>
                </div>

                {/* Custom Plan Dates Editor */}
                <div className="md:col-span-2 pt-5 border-t border-slate-800/80 space-y-4">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">Manual Validity Dates</h3>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-400">Plan Start Date</label>
                      <input
                        type="date"
                        value={editStartDate}
                        onChange={e => setEditStartDate(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-200 outline-none focus:border-emerald-500 transition-colors"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-400">Plan End Date</label>
                      <input
                        type="date"
                        value={editEndDate}
                        onChange={e => setEditEndDate(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-200 outline-none focus:border-rose-500 transition-colors"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveDates}
                    disabled={savingDates || !onPlanDatesChange}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
                  >
                    {savingDates ? 'Saving Dates...' : 'Update Validity Dates'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBPAGE 5: ECONOMICS */}
      {activeTab === 'cost' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Header & Financial Model Summary Card */}
          <div className="rounded-3xl border border-slate-800/80 bg-gradient-to-b from-[#111827] to-[#0c1322] p-6 sm:p-7 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                  <IndianRupee className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Economics</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Calculated using approved financial models from COST_ANALYSIS.md ($1 = ₹100)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono font-bold text-xs">
                  Monthly Recurring Cost: ₹{costBreakdown.totalMonthlyCostInr.toFixed(2)}/mo
                </span>
              </div>
            </div>

            {/* 4 Executive Financial Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-1">
              {/* Card 1: Total Cost Endured */}
              <div className="rounded-2xl border border-purple-500/20 bg-purple-950/10 p-4 transition-all hover:border-purple-500/40">
                <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider block mb-1">
                  Cost Endured Till Now
                </span>
                <div className="text-2xl font-black text-purple-200 font-mono">
                  ₹{costBreakdown.totalLifetimeCostInr.toFixed(2)}
                </div>
                <span className="text-xs font-mono text-slate-400 mt-1 block">
                  ${(costBreakdown.totalLifetimeCostInr / 100).toFixed(2)} USD (Compute + Storage)
                </span>
              </div>

              {/* Card 2: Monthly Recurring Cost */}
              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 transition-all hover:border-slate-700/80">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Monthly Recurring
                </span>
                <div className="text-2xl font-black text-white font-mono">
                  ₹{costBreakdown.totalMonthlyCostInr.toFixed(2)}
                </div>
                <span className="text-xs font-mono text-slate-400 mt-1 block">
                  ${(costBreakdown.totalMonthlyCostInr / 100).toFixed(4)} USD/mo (B2 + DB)
                </span>
              </div>

              {/* Card 3: One-Time Compute Endured */}
              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 transition-all hover:border-slate-700/80">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Compute Incurred
                </span>
                <div className="text-2xl font-black text-white font-mono">
                  ₹{(costBreakdown.modalTotalInr + costBreakdown.qstashInr).toFixed(2)}
                </div>
                <span className="text-xs text-slate-400 mt-1 block">
                  Modal GPU/CPU + QStash triggers
                </span>
              </div>

              {/* Card 4: Gross Margin from User */}
              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 transition-all hover:border-slate-700/80">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Gross Margin
                </span>
                <div className="text-2xl font-black text-emerald-400">
                  {costBreakdown.monthlyMarginPercentage !== null
                    ? `${costBreakdown.monthlyMarginPercentage}%`
                    : 'Free Tier'}
                </div>
                <span className="text-xs text-slate-400 mt-1 block">
                  {costBreakdown.monthlyRevenueInr > 0
                    ? `₹${costBreakdown.monthlyGrossMarginInr.toFixed(2)} profit / month`
                    : 'Non-paying user account'}
                </span>
              </div>
            </div>
          </div>

          {/* 1. Backblaze B2 Storage & Metering Cost Matrix */}
          <div className="rounded-3xl border border-slate-800/80 bg-gradient-to-b from-[#111827] to-[#0c1322] p-6 sm:p-7 shadow-xl space-y-6">
            {/* Header & Controls Bar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
              <div className="flex items-center gap-3">
                <div className="p-2 px-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                  <BackblazeLogo className="h-5 w-auto text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">B2 Matrix</h3>
                </div>
              </div>

              {/* Time Window Selector & Date Filters */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Quick Filters */}
                <div className="flex items-center gap-1 bg-slate-950/90 p-1 rounded-xl border border-slate-800 shrink-0">
                  {(['1d', '1w', '1m', 'custom', 'all'] as const).map((filterKey) => {
                    const labels: Record<typeof filterKey, string> = {
                      '1d': '1 Day',
                      '1w': '1 Week',
                      '1m': '1 Month',
                      'custom': 'Custom',
                      'all': 'All Time',
                    };
                    const isActive = b2TimeFilter === filterKey;
                    return (
                      <button
                        key={filterKey}
                        type="button"
                        onClick={() => setB2TimeFilter(filterKey)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          isActive
                            ? 'bg-sky-600 text-white shadow-md shadow-sky-900/30'
                            : 'text-slate-400 hover:text-white hover:bg-slate-900'
                        }`}
                      >
                        {labels[filterKey]}
                      </button>
                    );
                  })}
                </div>

                {/* Custom Date Pickers */}
                {b2TimeFilter === 'custom' && (
                  <div className="flex items-center gap-1.5 bg-slate-950/90 border border-slate-800 rounded-xl px-2.5 py-1 text-xs text-slate-300">
                    <span className="text-[10px] text-slate-500 uppercase font-bold">From</span>
                    <input
                      type="date"
                      value={b2CustomStartDate}
                      onChange={e => setB2CustomStartDate(e.target.value)}
                      className="bg-slate-900 border border-slate-700/80 rounded px-1.5 py-0.5 text-white text-xs outline-none focus:border-sky-500"
                    />
                    <span className="text-[10px] text-slate-500 uppercase font-bold">To</span>
                    <input
                      type="date"
                      value={b2CustomEndDate}
                      onChange={e => setB2CustomEndDate(e.target.value)}
                      className="bg-slate-900 border border-slate-700/80 rounded px-1.5 py-0.5 text-white text-xs outline-none focus:border-sky-500"
                    />
                  </div>
                )}

                {/* Formatted Date Range Badge */}
                <div className="flex items-center gap-1.5 text-xs font-mono text-sky-300 bg-sky-500/10 border border-sky-500/20 px-3 py-1.5 rounded-xl shrink-0">
                  <Clock className="w-3.5 h-3.5 text-sky-400" />
                  <span>
                    {b2MeteringData.formattedRange} ({b2MeteringData.durationLabel})
                  </span>
                </div>
              </div>
            </div>

            {/* 4 Executive B2 Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-1">
              {/* Card 1: Data Metered */}
              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 transition-all hover:border-slate-700/80">
                <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wider block mb-1">
                  Data Metered
                </span>
                <div className="text-xl font-black text-white font-mono flex items-baseline gap-2">
                  <span>{b2MeteringData.totalGbStored.toFixed(2)} GB</span>
                  {b2MeteringData.totalGbStored === 0 && b2MeteringData.totalPeakGb > 0 ? (
                    <span className="text-xs text-rose-400/90 font-sans font-medium">
                      (Peak in window: {b2MeteringData.totalPeakGb.toFixed(2)} GB)
                    </span>
                  ) : (
                    <span className="text-xs text-slate-500 font-sans font-normal">
                      active
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-mono text-slate-400 mt-1 block">
                  {b2MeteringData.totalGbHours.toFixed(1)} GB-h ({b2MeteringData.totalBillableGbMonths.toFixed(3)} GB-mo)
                </span>
              </div>

              {/* Card 2: Storage Cost */}
              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 transition-all hover:border-slate-700/80">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Storage Cost
                </span>
                <div className="text-xl font-black text-sky-300 font-mono">
                  ₹{b2MeteringData.totalStorageCostInr.toFixed(2)}
                </div>
                <span className="text-[11px] font-mono text-slate-400 mt-1 block">
                  ${b2MeteringData.totalStorageCostUsd.toFixed(4)} USD (@ ₹0.60/GB-mo)
                </span>
              </div>

              {/* Card 3: API Transactions */}
              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 transition-all hover:border-slate-700/80">
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block mb-1">
                  API Transactions
                </span>
                <div className="text-xl font-black text-amber-300 font-mono">
                  ₹{b2MeteringData.totalTransactionCostInr.toFixed(2)}
                </div>
                <span className="text-[11px] font-mono text-slate-400 mt-1 block">
                  {b2MeteringData.totalClassC} Class C &bull; {b2MeteringData.totalClassB} Class B
                </span>
              </div>

              {/* Card 4: Total B2 Incurred */}
              <div className="rounded-2xl border border-sky-500/30 bg-sky-950/20 p-4 transition-all hover:border-sky-500/50">
                <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wider block mb-1">
                  Total BB Incurred
                </span>
                <div className="text-xl font-black text-sky-200 font-mono">
                  ₹{b2MeteringData.grandTotalB2CostInr.toFixed(2)}
                </div>
                <span className="text-[11px] font-mono text-slate-300 mt-1 block">
                  ${b2MeteringData.grandTotalB2CostUsd.toFixed(4)} USD
                </span>
              </div>
            </div>

            {/* Consolidated Backblaze B2 Metering Table (Single Row for Selected Timeframe) */}
            <div className="space-y-4 pt-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <BackblazeLogo className="h-4 w-auto text-white" />
                    <span>Consolidated B2 Matrix</span>
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Single-ledger metering for selected timeframe ({b2MeteringData.formattedRange} &bull; {b2MeteringData.durationLabel})
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                  <span className="text-xs font-mono font-bold text-sky-400 bg-sky-500/10 border border-sky-500/20 px-3 py-1.5 rounded-full">
                    Total B2 Cost: ₹{b2MeteringData.grandTotalB2CostInr.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Single Consolidated Row Table */}
              <div className="rounded-2xl border border-slate-800/80 overflow-hidden bg-slate-950/40">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-400">
                    <thead className="bg-slate-950/90 text-slate-400 uppercase tracking-wider border-b border-slate-800 text-[10px]">
                      <tr className="divide-x divide-slate-800">
                        <th className="py-3 px-3.5 font-bold whitespace-nowrap">Media Metered</th>
                        <th className="py-3 px-3 text-right font-bold whitespace-nowrap">Byte-Hours (GB-h)</th>
                        <th className="py-3 px-3 text-right font-bold whitespace-nowrap">Storage Cost</th>
                        <th className="py-3 px-3 text-right font-bold whitespace-nowrap">Class C</th>
                        <th className="py-3 px-3 text-right font-bold whitespace-nowrap">Class B</th>
                        <th className="py-3 px-3.5 text-right font-bold whitespace-nowrap">Total B2 Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80">
                      <tr className="divide-x divide-slate-800 hover:bg-slate-900/40 transition-colors">
                        {/* 1. Media Metered */}
                        <td className="py-3.5 px-3.5 font-mono tabular-nums whitespace-nowrap">
                          <span className="text-white font-bold">{b2MeteringData.totalMediaCount} files</span>
                        </td>

                        {/* 2. Byte-Hours (GB-h) */}
                        <td className="py-3.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                          <span className="text-slate-200 font-bold">{b2MeteringData.totalGbHours.toFixed(2)} GB-h</span>
                        </td>

                        {/* 4. Storage Cost */}
                        <td className="py-3.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                          <span className="text-sky-300 font-bold">₹{b2MeteringData.totalStorageCostInr.toFixed(2)}</span>
                        </td>

                        {/* 5. Class C (Uploads & Deletions) */}
                        <td className="py-3.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                          <span className="text-amber-300 font-bold">₹{b2MeteringData.totalClassCCostInr.toFixed(2)}</span>
                        </td>

                        {/* 6. Class B (Reads) */}
                        <td className="py-3.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                          <span className="text-amber-200 font-bold">₹{b2MeteringData.totalClassBCostInr.toFixed(2)}</span>
                        </td>

                        {/* 7. Total B2 Cost */}
                        <td className="py-3.5 px-3.5 text-right font-mono tabular-nums whitespace-nowrap bg-sky-950/20">
                          <span className="text-sky-200 font-black text-sm">₹{b2MeteringData.grandTotalB2CostInr.toFixed(2)}</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Modal.com Serverless Workers (Full Width Container Taking Whole Row) */}
          <div className="rounded-3xl border border-slate-800/80 bg-gradient-to-b from-[#111827] to-[#0c1322] p-6 sm:p-7 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Modal.com Serverless Workers (Actual Incurred Compute)</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Billed per exact second of container hardware. Auto-routes between CPU and Nvidia L4 GPU based on media type and length.
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-purple-300 bg-purple-500/10 border border-purple-500/20 px-3.5 py-1.5 rounded-full shrink-0 self-start sm:self-auto">
                ₹{costBreakdown.modalTotalInr.toFixed(2)} billed
              </span>
            </div>

            {/* Modular Worker Breakdown (3 Cards across full row) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Photo AI Worker */}
              <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800/80 space-y-2 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between font-semibold text-slate-200">
                    <span className="flex items-center gap-1.5 text-sm">
                      <ImageIcon className="w-4 h-4 text-sky-400" />
                      Photo AI Worker
                    </span>
                    <span className="font-mono text-white font-bold text-sm">₹{costBreakdown.modalPhotoInr.toFixed(2)}</span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 mt-1">
                    <code>process_single_photo</code>
                  </div>
                  <div className="text-xs text-slate-400 mt-2 space-y-1">
                    <div className="flex justify-between">
                      <span>Hardware:</span>
                      <span className="font-mono text-slate-300">1.0 vCPU + 1GB RAM (₹0.00153/s)</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Execution:</span>
                      <span className="font-mono text-slate-300">{actualComputeMetrics.totalPhotoSeconds.toFixed(1)}s</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Media Processed:</span>
                      <span className="font-mono text-slate-300">{actualComputeMetrics.lifetimePhotosCount} photos</span>
                    </div>
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-800/60 text-[11px] text-slate-400 flex items-center justify-between">
                  <span>Avg ~₹{(costBreakdown.modalPhotoInr / Math.max(1, actualComputeMetrics.lifetimePhotosCount)).toFixed(4)}/photo</span>
                  {actualComputeMetrics.deletedPhotosCount > 0 && (
                    <span className="text-amber-400/90 text-[10px] font-medium">({actualComputeMetrics.deletedPhotosCount} deleted retained)</span>
                  )}
                </div>
              </div>

              {/* Standard Video Worker (CPU) */}
              <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800/80 space-y-2 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between font-semibold text-slate-200">
                    <span className="flex items-center gap-1.5 text-sm">
                      <VideoIcon className="w-4 h-4 text-violet-400" />
                      Standard Video Worker
                    </span>
                    <span className="font-mono text-white font-bold text-sm">₹{costBreakdown.modalVideoCpuInr.toFixed(2)}</span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 mt-1">
                    <code>process_video_cpu (&le; 10 min)</code>
                  </div>
                  <div className="text-xs text-slate-400 mt-2 space-y-1">
                    <div className="flex justify-between">
                      <span>Hardware:</span>
                      <span className="font-mono text-slate-300">4.0 vCPU + 4GB RAM (₹0.00613/s)</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Execution:</span>
                      <span className="font-mono text-slate-300">{actualComputeMetrics.totalVideoCpuSeconds.toFixed(1)}s</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Videos Processed:</span>
                      <span className="font-mono text-slate-300">{actualComputeMetrics.totalVideoCpuRuns} short clips</span>
                    </div>
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-800/60 text-[11px] text-slate-400">
                  HLS multi-pass encoding (1080p, 720p, 480p)
                </div>
              </div>

              {/* High-Capacity Video Worker (GPU) */}
              <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800/80 space-y-2 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between font-semibold text-slate-200">
                    <span className="flex items-center gap-1.5 text-sm">
                      <VideoIcon className="w-4 h-4 text-fuchsia-400" />
                      High-Capacity Video Worker
                    </span>
                    <span className="font-mono text-white font-bold text-sm">₹{costBreakdown.modalVideoGpuInr.toFixed(2)}</span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 mt-1">
                    <code>process_video_gpu (&gt; 10 min)</code>
                  </div>
                  <div className="text-xs text-slate-400 mt-2 space-y-1">
                    <div className="flex justify-between">
                      <span>Hardware:</span>
                      <span className="font-mono text-slate-300">Nvidia L4 GPU + 4.0 vCPU (₹0.02922/s)</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Execution:</span>
                      <span className="font-mono text-slate-300">{actualComputeMetrics.totalVideoGpuSeconds.toFixed(1)}s</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Videos Processed:</span>
                      <span className="font-mono text-slate-300">{actualComputeMetrics.totalVideoGpuRuns} long videos</span>
                    </div>
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-800/60 text-[11px] text-slate-400">
                  Hardware NVENC accelerated full ceremony highlights
                </div>
              </div>
            </div>

            {/* Guest Face Match Worker (if any runs) */}
            {actualComputeMetrics.totalSelfieRuns > 0 && (
              <div className="bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80 flex items-center justify-between text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span className="font-semibold text-white">Guest Face Match Worker (<code>find_matching_photos</code>)</span>
                  <span className="text-slate-400">&bull; 0.125 vCPU + 1GB RAM &bull; {actualComputeMetrics.totalSelfieSeconds.toFixed(1)}s ({actualComputeMetrics.totalSelfieRuns} searches)</span>
                </div>
                <span className="font-mono text-white font-bold">₹{costBreakdown.modalSelfieInr.toFixed(3)}</span>
              </div>
            )}

            {/* Modal Bottom Summary Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-800/80">
              <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl text-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-emerald-300 font-medium">Free Tier Credit:</span>
                <span className="font-mono text-emerald-400 font-bold">$30/mo credit (~360,000 photos / 100hrs CPU)</span>
              </div>
              <div className="flex items-center gap-4 text-xs font-mono">
                <span className="text-slate-400">
                  Execution: <strong className="text-slate-200">{actualComputeMetrics.totalComputeSeconds.toFixed(1)}s</strong>
                </span>
                <span className="text-slate-400">
                  Total Modal Compute: <strong className="text-purple-300 text-sm">₹{costBreakdown.modalTotalInr.toFixed(2)}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* 2. Platform Storage, Queue & Database (3-Column Grid) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Backblaze B2 Storage */}
            <div className="rounded-3xl border border-slate-800/80 bg-gradient-to-b from-[#111827] to-[#0c1322] p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
                    <HardDrive className="w-4 h-4" />
                  </div>
                  <h3 className="font-bold text-white text-sm">Backblaze B2 Storage</h3>
                </div>
                <span className="text-xs font-mono font-bold text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2.5 py-0.5 rounded-full">
                  ₹{costBreakdown.b2MonthlyInr.toFixed(2)} / mo
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Rate: ₹600 per TB/month ($0.006 / GB / mo). Adjusts dynamically when files are deleted.
              </p>
              <div className="space-y-2 text-xs text-slate-300 bg-slate-900/60 p-4 rounded-2xl border border-slate-800/80">
                <div className="flex justify-between">
                  <span className="text-slate-400">Active Storage:</span>
                  <span className="font-mono text-white font-semibold">{usedGb.toFixed(2)} GB</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Active Media:</span>
                  <span className="font-mono text-slate-300">
                    {userEventMetrics.imageCount} photos &bull; {userEventMetrics.videoCount} videos
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Bandwidth / Egress:</span>
                  <span className="font-mono text-emerald-400 font-semibold">₹0 (Free via Cloudflare)</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-800 font-bold">
                  <span className="text-white">Storage Endured:</span>
                  <span className="font-mono text-white">₹{costBreakdown.b2CostTillNowInr.toFixed(2)} ({costBreakdown.monthsActive.toFixed(1)} mo)</span>
                </div>
              </div>
            </div>

            {/* Upstash QStash Queue */}
            <div className="rounded-3xl border border-slate-800/80 bg-gradient-to-b from-[#111827] to-[#0c1322] p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                    <Zap className="w-4 h-4" />
                  </div>
                  <h3 className="font-bold text-white text-sm">Upstash QStash Queue</h3>
                </div>
                <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full">
                  ₹{costBreakdown.qstashInr.toFixed(2)} total
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Rate: ₹100 per 100,000 messages (~₹0.001 per photo/video queued at upload time).
              </p>
              <div className="space-y-2 text-xs text-slate-300 bg-slate-900/60 p-4 rounded-2xl border border-slate-800/80">
                <div className="flex justify-between">
                  <span className="text-slate-400">Lifetime Messages:</span>
                  <span className="font-mono text-white font-semibold">{actualComputeMetrics.totalLifetimeMedia} msgs</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Deleted Media msgs:</span>
                  <span className="font-mono text-slate-400">
                    {actualComputeMetrics.deletedPhotosCount + actualComputeMetrics.deletedVideosCount} msgs
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-800 font-bold">
                  <span className="text-white">Total QStash Cost:</span>
                  <span className="font-mono text-white">₹{costBreakdown.qstashInr.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Supabase DB & Auth */}
            <div className="rounded-3xl border border-slate-800/80 bg-gradient-to-b from-[#111827] to-[#0c1322] p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                    <Server className="w-4 h-4" />
                  </div>
                  <h3 className="font-bold text-white text-sm">Supabase Database & Auth</h3>
                </div>
                <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                  ₹{costBreakdown.supabaseMonthlyInr.toFixed(2)} / mo
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Pro Plan base ₹2,500/mo ($25). Holds ~4M photos' metadata + 100k MAU.
              </p>
              <div className="space-y-2 text-xs text-slate-300 bg-slate-900/60 p-4 rounded-2xl border border-slate-800/80">
                <div className="flex justify-between">
                  <span className="text-slate-400">Metadata Row Share:</span>
                  <span className="font-mono text-white font-semibold">{userEventMetrics.imageCount + userEventMetrics.videoCount} active rows</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-800 font-bold">
                  <span className="text-white">Allocated DB Cost:</span>
                  <span className="font-mono text-white">₹{costBreakdown.supabaseMonthlyInr.toFixed(2)} / mo</span>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Event-Wise Modal.com Processing Expenditure Table */}
          <div className="rounded-3xl border border-slate-800/80 bg-gradient-to-b from-[#111827] to-[#0c1322] p-5 sm:p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2.5">
                  <div className="p-1.5 px-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                    <ModalLogo className="h-4 w-auto" />
                  </div>
                  <span>Modal Matrix</span>
                </h3>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setCostRefreshKey(k => k + 1)}
                  disabled={loadingCostLogs}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700/80 hover:border-slate-500 text-slate-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                  title="Reload latest compute logs from database"
                >
                  <RefreshCw className={`w-3 h-3 ${loadingCostLogs ? 'animate-spin text-purple-400' : 'text-slate-400'}`} />
                  <span>Refresh</span>
                </button>
                <span className="text-xs font-mono font-bold text-purple-400 bg-purple-500/10 border border-purple-500/20 px-3.5 py-1.5 rounded-full flex items-center gap-1.5 shrink-0">
                  {loadingCostLogs && <Clock className="w-3 h-3 animate-spin text-purple-400" />}
                  Total Compute: ₹{costBreakdown.modalTotalInr.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Filter and Search Toolbar */}
            {allCostRows.length > 0 && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-0.5">
                {/* Search */}
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={costTableSearch}
                    onChange={e => setCostTableSearch(e.target.value)}
                    placeholder="Search gallery title or ID..."
                    className="w-full pl-9 pr-7 py-1.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50 transition-colors"
                  />
                  {costTableSearch && (
                    <button
                      onClick={() => setCostTableSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs"
                      title="Clear search"
                    >
                      &times;
                    </button>
                  )}
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1.5 bg-slate-950/80 p-1 rounded-xl border border-slate-800 shrink-0 self-start sm:self-auto">
                  <button
                    onClick={() => setCostTableFilter('all')}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                      costTableFilter === 'all'
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white hover:bg-slate-900'
                    }`}
                  >
                    All ({allCostRows.length})
                  </button>
                  <button
                    onClick={() => setCostTableFilter('active')}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                      costTableFilter === 'active'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white hover:bg-slate-900'
                    }`}
                  >
                    Active ({allCostRows.filter(r => r.type === 'active').length})
                  </button>
                  <button
                    onClick={() => setCostTableFilter('deleted')}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                      costTableFilter === 'deleted'
                        ? 'bg-rose-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white hover:bg-slate-900'
                    }`}
                  >
                    Deleted ({allCostRows.filter(r => r.type === 'deleted' || r.type === 'orphaned_log').length})
                  </button>
                </div>
              </div>
            )}

            {allCostRows.length === 0 ? (
              <p className="text-sm text-slate-500 py-8 text-center">No events created by this user yet.</p>
            ) : (
              <div className="rounded-2xl border border-slate-800/80 overflow-hidden bg-slate-950/30">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-400">
                    <thead className="bg-slate-950/80 text-slate-500 uppercase tracking-wider border-b border-slate-800 text-[10px]">
                      <tr className="divide-x divide-slate-700/80">
                        <th className="py-2.5 px-3 font-bold">Gallery</th>
                        <th className="py-2.5 px-2.5 font-bold whitespace-nowrap">gal_ID</th>
                        <th className="py-2.5 px-2.5 text-right font-bold whitespace-nowrap">Photos</th>
                        <th className="py-2.5 px-2.5 text-right font-bold whitespace-nowrap">P_cost</th>
                        <th className="py-2.5 px-2.5 text-right font-bold whitespace-nowrap">Videos CPU</th>
                        <th className="py-2.5 px-2.5 text-right font-bold whitespace-nowrap">V_C_cost</th>
                        <th className="py-2.5 px-2.5 text-right font-bold whitespace-nowrap">Videos GPU</th>
                        <th className="py-2.5 px-2.5 text-right font-bold whitespace-nowrap">V_G_cost</th>
                        <th className="py-2.5 px-3 text-right font-bold whitespace-nowrap">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {paginatedCostRows.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-8 text-center text-slate-500">
                            No galleries match the current filter or search criteria.
                          </td>
                        </tr>
                      ) : (
                        paginatedCostRows.map(row => {
                          if (row.type === 'active') {
                            const { event, children, combined } = row;

                            // Aggregate compute stats across main event AND all child sub-events
                            const allRelatedIds = [event.id, ...children.map(c => c.event.id)];
                            const allStats = allRelatedIds
                              .map(id => actualComputeMetrics.eventComputeMap.get((id || '').toLowerCase().trim()))
                              .filter(Boolean);

                            const eventPhotoRuns = allStats.reduce((s, st) => s + (st?.photoRuns || 0), 0);
                            const eventPhotoActualInr = allStats.reduce((s, st) => s + (st?.photoInr || 0), 0);

                            const eventVideoCpuRuns = allStats.reduce((s, st) => s + (st?.videoCpuRuns || 0), 0);
                            const eventVideoGpuRuns = allStats.reduce((s, st) => s + (st?.videoGpuRuns || 0), 0);
                            const eventVideoRuns = eventVideoCpuRuns + eventVideoGpuRuns;

                            // Accurate photo counts & cost
                            const galleryPhotoCount = Math.max(combined.imageCount, eventPhotoRuns);
                            const unloggedPhotos = Math.max(0, galleryPhotoCount - eventPhotoRuns);
                            const eventPhotoCost = eventPhotoActualInr + (unloggedPhotos * actualComputeMetrics.avgObservedPhotoCost);

                            // Accurate video counts & cost split by CPU and GPU
                            const galleryVideoCount = Math.max(combined.videoCount, eventVideoRuns);
                            const unloggedVideos = Math.max(0, galleryVideoCount - eventVideoRuns);

                            // Identify GPU candidates in this gallery
                            let galleryGpuCandidates = 0;
                            const galleryRelatedEventIds = new Set(allRelatedIds.map(id => (id || '').toLowerCase().trim()));
                            userEventMetrics.userPhotos.forEach(p => {
                              const pid = (p.eventId || '').toLowerCase().trim();
                              if (!galleryRelatedEventIds.has(pid)) return;
                              const size = Number(p.size) || 0;
                              const mediaType = String(p.mediaType || '').toLowerCase();
                              const resourceType = String(p.resourceType || '').toLowerCase();
                              const rawFormat = String((p as any).format || '').toLowerCase();
                              const rawPath = String((p as any).storageKey || (p as any).url || '').toLowerCase();
                              const hasDuration = p.duration != null && Number(p.duration) > 0;
                              const isVideoByExtension = 
                                ['mp4', 'mov', 'webm', 'mkv', 'm4v', 'avi'].includes(rawFormat) ||
                                /\.(mp4|mov|webm|mkv|m4v|avi)(\?.*)?$/i.test(rawPath);
                              const isVideo = mediaType === 'video' || resourceType === 'video' || hasDuration || isVideoByExtension;
                              if (isVideo) {
                                const isLong = (hasDuration && Number(p.duration) > 600) || size > 350 * 1024 * 1024;
                                if (isLong) galleryGpuCandidates++;
                              }
                            });

                            const unloggedGpuVideos = Math.min(unloggedVideos, Math.max(0, galleryGpuCandidates - eventVideoGpuRuns));
                            const unloggedCpuVideos = Math.max(0, unloggedVideos - unloggedGpuVideos);

                            const eventVideoCpuActualInr = allStats.reduce((s, st) => s + (st?.videoCpuInr || 0), 0);
                            const eventVideoGpuActualInr = allStats.reduce((s, st) => s + (st?.videoGpuInr || 0), 0);
                            const eventVideoCpuCost = eventVideoCpuActualInr + (unloggedCpuVideos * actualComputeMetrics.avgObservedVideoCpuCost);
                            const eventVideoGpuCost = eventVideoGpuActualInr + (unloggedGpuVideos * actualComputeMetrics.avgObservedVideoGpuCost);

                            const eventTotalModalCost = eventPhotoCost + eventVideoCpuCost + eventVideoGpuCost;

                            return (
                              <tr key={row.id} className="divide-x divide-slate-700/60 hover:bg-slate-900/50 transition-colors">
                                {/* 1. Gallery (Green text indicates active / exists) */}
                                <td className="py-2 px-3 font-semibold">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="truncate max-w-[200px] text-emerald-400 font-semibold" title={event.title || 'Untitled Event'}>
                                      {event.title || 'Untitled Event'}
                                    </span>
                                    {event.isSampleGallery && (
                                      <span className="px-1.5 py-0.2 rounded text-[9px] bg-amber-500/10 text-amber-300 border border-amber-500/20 font-bold">
                                        Sample
                                      </span>
                                    )}
                                  </div>
                                </td>

                                {/* 2. Gallery ID with easy copy */}
                                <td className="py-2 px-2.5 whitespace-nowrap">
                                  <button
                                    type="button"
                                    onClick={() => copyToClipboard(event.id, `cost-gal-${event.id}`)}
                                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-900/80 hover:bg-slate-800 border border-slate-700/60 hover:border-slate-500 text-slate-300 hover:text-white font-mono text-[11px] transition-all cursor-pointer group"
                                    title="Click to copy gallery ID"
                                  >
                                    <span className="truncate max-w-[130px] select-all">{event.id}</span>
                                    {copiedField === `cost-gal-${event.id}` ? (
                                      <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-400 font-semibold font-sans">
                                        <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                                        Copied
                                      </span>
                                    ) : (
                                      <Copy className="w-3 h-3 text-slate-500 group-hover:text-slate-300 shrink-0 transition-colors" />
                                    )}
                                  </button>
                                </td>

                                {/* 3. Photos (Clean count only, no running time) */}
                                <td className="py-2 px-2.5 text-right font-mono tabular-nums whitespace-nowrap text-sky-400 font-semibold">
                                  {galleryPhotoCount} {galleryPhotoCount === 1 ? 'photo' : 'photos'}
                                </td>

                                {/* 4. Photo Cost */}
                                <td className="py-2 px-2.5 text-right font-mono tabular-nums whitespace-nowrap text-slate-300 font-semibold">
                                  ₹{eventPhotoCost.toFixed(3)}
                                </td>

                                {/* 5. Videos CPU (Clean count only, no running time) */}
                                <td className="py-2 px-2.5 text-right font-mono tabular-nums whitespace-nowrap text-violet-400 font-semibold">
                                  {eventVideoCpuRuns > 0
                                    ? `${eventVideoCpuRuns} ${eventVideoCpuRuns === 1 ? 'run' : 'runs'}`
                                    : unloggedCpuVideos > 0
                                    ? `${unloggedCpuVideos} ${unloggedCpuVideos === 1 ? 'vid' : 'vids'}`
                                    : '0 runs'}
                                </td>

                                {/* 6. CPU Cost */}
                                <td className="py-2 px-2.5 text-right font-mono tabular-nums whitespace-nowrap text-slate-300 font-semibold">
                                  ₹{eventVideoCpuCost.toFixed(2)}
                                </td>

                                {/* 7. Videos GPU (Clean count only, no running time) */}
                                <td className="py-2 px-2.5 text-right font-mono tabular-nums whitespace-nowrap text-fuchsia-400 font-semibold">
                                  {eventVideoGpuRuns > 0
                                    ? `${eventVideoGpuRuns} ${eventVideoGpuRuns === 1 ? 'run' : 'runs'}`
                                    : unloggedGpuVideos > 0
                                    ? `${unloggedGpuVideos} ${unloggedGpuVideos === 1 ? 'vid' : 'vids'}`
                                    : '0 runs'}
                                </td>

                                {/* 8. GPU Cost */}
                                <td className="py-2 px-2.5 text-right font-mono tabular-nums whitespace-nowrap text-slate-300 font-semibold">
                                  ₹{eventVideoGpuCost.toFixed(2)}
                                </td>

                                {/* 9. Total Cost */}
                                <td className="py-2 px-3 text-right font-mono tabular-nums whitespace-nowrap font-bold text-white">
                                  ₹{eventTotalModalCost.toFixed(2)}
                                </td>
                              </tr>
                            );
                          }

                          if (row.type === 'deleted') {
                            const del = row.deleted;
                            const delStats = actualComputeMetrics.eventComputeMap.get((del.eventId || '').toLowerCase().trim());
                            const delPhotoCost = delStats ? delStats.photoInr : (del.photosCount * 0.0082);

                            const delVideoCpuRuns = delStats?.videoCpuRuns || 0;
                            const delVideoGpuRuns = delStats?.videoGpuRuns || 0;

                            const delVideoCpuCost = delStats ? delStats.videoCpuInr : (del.videosCount * 0.35);
                            const delVideoGpuCost = delStats ? delStats.videoGpuInr : 0;
                            const delTotalCost = delStats ? (delPhotoCost + delVideoCpuCost + delVideoGpuCost) : (del.estimatedModalCostInr || (delPhotoCost + delVideoCpuCost + delVideoGpuCost));
                            const delPhotoCount = Math.max(del.photosCount, delStats?.photoRuns || 0);

                            return (
                              <tr key={row.id} className="divide-x divide-slate-700/60 hover:bg-slate-900/50 transition-colors bg-rose-950/10">
                                {/* 1. Gallery (Red text indicates deleted / does not exist) */}
                                <td className="py-2 px-3 font-semibold">
                                  <div className="truncate max-w-[200px] text-rose-400 font-semibold" title={del.eventTitle || 'Untitled Gallery'}>
                                    {del.eventTitle || 'Untitled Gallery'}
                                  </div>
                                </td>

                                {/* 2. Gallery ID with easy copy */}
                                <td className="py-2 px-2.5 whitespace-nowrap">
                                  <button
                                    type="button"
                                    onClick={() => copyToClipboard(del.eventId, `cost-gal-${del.eventId}`)}
                                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-900/80 hover:bg-slate-800 border border-slate-700/60 hover:border-slate-500 text-slate-400 hover:text-slate-200 font-mono text-[11px] transition-all cursor-pointer group"
                                    title="Click to copy deleted gallery ID"
                                  >
                                    <span className="truncate max-w-[130px] select-all">{del.eventId}</span>
                                    {copiedField === `cost-gal-${del.eventId}` ? (
                                      <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-400 font-semibold font-sans">
                                        <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                                        Copied
                                      </span>
                                    ) : (
                                      <Copy className="w-3 h-3 text-slate-500 group-hover:text-slate-300 shrink-0 transition-colors" />
                                    )}
                                  </button>
                                </td>

                                {/* 3. Photos (Clean count only, no running time) */}
                                <td className="py-2 px-2.5 text-right font-mono tabular-nums whitespace-nowrap text-slate-400">
                                  {delPhotoCount} {delPhotoCount === 1 ? 'photo' : 'photos'}
                                </td>

                                {/* 4. Photo Cost */}
                                <td className="py-2 px-2.5 text-right font-mono tabular-nums whitespace-nowrap text-slate-400 font-semibold">
                                  ₹{delPhotoCost.toFixed(3)}
                                </td>

                                {/* 5. Videos CPU (Clean count only, no running time) */}
                                <td className="py-2 px-2.5 text-right font-mono tabular-nums whitespace-nowrap text-slate-400">
                                  {delVideoCpuRuns > 0
                                    ? `${delVideoCpuRuns} ${delVideoCpuRuns === 1 ? 'run' : 'runs'}`
                                    : del.videosCount > 0
                                    ? `${del.videosCount} ${del.videosCount === 1 ? 'vid' : 'vids'}`
                                    : '0 runs'}
                                </td>

                                {/* 6. CPU Cost */}
                                <td className="py-2 px-2.5 text-right font-mono tabular-nums whitespace-nowrap text-slate-400 font-semibold">
                                  ₹{delVideoCpuCost.toFixed(2)}
                                </td>

                                {/* 7. Videos GPU (Clean count only, no running time) */}
                                <td className="py-2 px-2.5 text-right font-mono tabular-nums whitespace-nowrap text-slate-400">
                                  {delVideoGpuRuns > 0 ? `${delVideoGpuRuns} ${delVideoGpuRuns === 1 ? 'run' : 'runs'}` : '0 runs'}
                                </td>

                                {/* 8. GPU Cost */}
                                <td className="py-2 px-2.5 text-right font-mono tabular-nums whitespace-nowrap text-slate-400 font-semibold">
                                  ₹{delVideoGpuCost.toFixed(2)}
                                </td>

                                {/* 9. Total Cost */}
                                <td className="py-2 px-3 text-right font-mono tabular-nums whitespace-nowrap font-bold text-amber-300">
                                  ₹{delTotalCost.toFixed(2)}
                                </td>
                              </tr>
                            );
                          }

                          if (row.type === 'orphaned_log') {
                            const { orphanedId, stats: oStats } = row;

                            return (
                              <tr key={row.id} className="divide-x divide-slate-700/60 hover:bg-slate-900/50 transition-colors bg-rose-950/10">
                                {/* 1. Gallery (Red text indicates archived / does not exist) */}
                                <td className="py-2 px-3 font-semibold">
                                  <div className="text-rose-400 font-semibold">Historical Gallery</div>
                                </td>

                                {/* 2. Gallery ID with easy copy */}
                                <td className="py-2 px-2.5 whitespace-nowrap">
                                  <button
                                    type="button"
                                    onClick={() => copyToClipboard(orphanedId, `cost-gal-${orphanedId}`)}
                                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-900/80 hover:bg-slate-800 border border-slate-700/60 hover:border-slate-500 text-slate-400 hover:text-slate-200 font-mono text-[11px] transition-all cursor-pointer group"
                                    title="Click to copy historical gallery ID"
                                  >
                                    <span className="truncate max-w-[130px] select-all">{orphanedId}</span>
                                    {copiedField === `cost-gal-${orphanedId}` ? (
                                      <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-400 font-semibold font-sans">
                                        <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                                        Copied
                                      </span>
                                    ) : (
                                      <Copy className="w-3 h-3 text-slate-500 group-hover:text-slate-300 shrink-0 transition-colors" />
                                    )}
                                  </button>
                                </td>

                                {/* 3. Photos (Clean count only, no running time) */}
                                <td className="py-2 px-2.5 text-right font-mono tabular-nums whitespace-nowrap text-slate-400">
                                  {oStats.photoRuns} {oStats.photoRuns === 1 ? 'photo' : 'photos'}
                                </td>

                                {/* 4. Photo Cost */}
                                <td className="py-2 px-2.5 text-right font-mono tabular-nums whitespace-nowrap text-slate-400 font-semibold">
                                  ₹{oStats.photoInr.toFixed(3)}
                                </td>

                                {/* 5. Videos CPU (Clean count only, no running time) */}
                                <td className="py-2 px-2.5 text-right font-mono tabular-nums whitespace-nowrap text-slate-400">
                                  {oStats.videoCpuRuns} {oStats.videoCpuRuns === 1 ? 'run' : 'runs'}
                                </td>

                                {/* 6. CPU Cost */}
                                <td className="py-2 px-2.5 text-right font-mono tabular-nums whitespace-nowrap text-slate-400 font-semibold">
                                  ₹{oStats.videoCpuInr.toFixed(2)}
                                </td>

                                {/* 7. Videos GPU (Clean count only, no running time) */}
                                <td className="py-2 px-2.5 text-right font-mono tabular-nums whitespace-nowrap text-slate-400">
                                  {oStats.videoGpuRuns} {oStats.videoGpuRuns === 1 ? 'run' : 'runs'}
                                </td>

                                {/* 8. GPU Cost */}
                                <td className="py-2 px-2.5 text-right font-mono tabular-nums whitespace-nowrap text-slate-400 font-semibold">
                                  ₹{oStats.videoGpuInr.toFixed(2)}
                                </td>

                                {/* 9. Total Cost */}
                                <td className="py-2 px-3 text-right font-mono tabular-nums whitespace-nowrap font-bold text-amber-300">
                                  ₹{oStats.totalInr.toFixed(2)}
                                </td>
                              </tr>
                            );
                          }

                          return null;
                        })
                      )}
                    </tbody>
                    <tfoot className="border-t-2 border-slate-800 font-bold bg-slate-950/70 text-slate-200">
                      <tr className="divide-x divide-slate-700/80">
                        <td className="py-2.5 px-3">
                          Grand Total
                        </td>
                        <td className="py-2.5 px-2.5 text-slate-600 font-mono text-[11px]">
                          —
                        </td>
                        <td className="py-2.5 px-2.5 text-right font-mono tabular-nums whitespace-nowrap text-sky-400 font-semibold">
                          {actualComputeMetrics.lifetimePhotosCount} photos
                        </td>
                        <td className="py-2.5 px-2.5 text-right font-mono tabular-nums whitespace-nowrap text-white">
                          ₹{costBreakdown.modalPhotoInr.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-2.5 text-right font-mono tabular-nums whitespace-nowrap text-violet-400 font-semibold">
                          {actualComputeMetrics.totalVideoCpuRuns} runs
                        </td>
                        <td className="py-2.5 px-2.5 text-right font-mono tabular-nums whitespace-nowrap text-white">
                          ₹{costBreakdown.modalVideoCpuInr.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-2.5 text-right font-mono tabular-nums whitespace-nowrap text-fuchsia-400 font-semibold">
                          {actualComputeMetrics.totalVideoGpuRuns} runs
                        </td>
                        <td className="py-2.5 px-2.5 text-right font-mono tabular-nums whitespace-nowrap text-white">
                          ₹{costBreakdown.modalVideoGpuInr.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap text-purple-400 text-sm">
                          ₹{costBreakdown.modalTotalInr.toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Pagination Controls Footer */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-800/80 px-3.5 py-2.5 bg-slate-950/80">
                  <div className="flex items-center gap-3 flex-wrap">
                    <p className="text-xs text-slate-400">
                      Showing <span className="font-semibold text-white">{filteredCostRows.length === 0 ? 0 : (costTablePage - 1) * costTablePerPage + 1}</span> to{' '}
                      <span className="font-semibold text-white">{Math.min(filteredCostRows.length, costTablePage * costTablePerPage)}</span> of{' '}
                      <span className="font-semibold text-white">{filteredCostRows.length}</span> {filteredCostRows.length === 1 ? 'gallery' : 'galleries'}
                      {filteredCostRows.length !== allCostRows.length && (
                        <span className="text-slate-500 ml-1">(filtered from {allCostRows.length})</span>
                      )}
                    </p>

                    <div className="flex items-center gap-1.5 pl-3 border-l border-slate-800">
                      <span className="text-[11px] text-slate-500">Per page:</span>
                      {[5, 10, 20].map(sz => (
                        <button
                          key={sz}
                          onClick={() => setCostTablePerPage(sz)}
                          className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                            costTablePerPage === sz
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                              : 'text-slate-400 hover:text-white hover:bg-slate-800'
                          }`}
                        >
                          {sz}
                        </button>
                      ))}
                    </div>
                  </div>

                  {totalCostPages > 1 && (
                    <div className="flex items-center gap-2">
                      <div className="flex sm:hidden items-center gap-2">
                        <button
                          onClick={() => setCostTablePage(prev => Math.max(prev - 1, 1))}
                          disabled={costTablePage === 1}
                          className="px-3 py-1 rounded-lg border border-slate-800 bg-slate-950 text-xs font-medium text-slate-400 hover:bg-slate-900 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Previous
                        </button>
                        <span className="text-xs text-slate-400">
                          {costTablePage} / {totalCostPages}
                        </span>
                        <button
                          onClick={() => setCostTablePage(prev => Math.min(prev + 1, totalCostPages))}
                          disabled={costTablePage === totalCostPages}
                          className="px-3 py-1 rounded-lg border border-slate-800 bg-slate-950 text-xs font-medium text-slate-400 hover:bg-slate-900 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Next
                        </button>
                      </div>

                      <nav className="hidden sm:inline-flex isolate -space-x-px rounded-xl border border-slate-800/80 bg-slate-950 p-1 gap-1" aria-label="Cost Table Pagination">
                        <button
                          onClick={() => setCostTablePage(prev => Math.max(prev - 1, 1))}
                          disabled={costTablePage === 1}
                          className="relative inline-flex items-center rounded-lg p-1.5 text-slate-400 hover:bg-slate-900 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                          title="Previous page"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>

                        {costPageNumbers.map(page => {
                          const isActive = page === costTablePage;
                          return (
                            <button
                              key={page}
                              onClick={() => setCostTablePage(page)}
                              className={`relative inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                                isActive
                                  ? 'bg-purple-600 text-white shadow-sm'
                                  : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                              }`}
                            >
                              {page}
                            </button>
                          );
                        })}

                        <button
                          onClick={() => setCostTablePage(prev => Math.min(prev + 1, totalCostPages))}
                          disabled={costTablePage === totalCostPages}
                          className="relative inline-flex items-center rounded-lg p-1.5 text-slate-400 hover:bg-slate-900 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                          title="Next page"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </nav>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
