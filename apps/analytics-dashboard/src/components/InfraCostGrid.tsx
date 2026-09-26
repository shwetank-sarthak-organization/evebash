import React, { useState, useMemo, useEffect } from 'react';
import type { DashboardStats, UserProfile, Event, GuestLog, Photo } from '../lib/analytics';
import {
  DollarSign,
  HardDrive,
  ShieldCheck,
  Cloud,
  Sliders,
  TrendingUp,
  Activity,
  Info,
  Server,
  Sparkles,
  Search,
  Trash2,
  Cpu,
  ChevronLeft,
  ChevronRight,
  User,
  Video,
  Image as ImageIcon,
  Clock,
  Calendar,
  RefreshCw,
  IndianRupee,
  CheckCircle2,
  ArrowLeftRight
} from 'lucide-react';
import { getAccessToken, getApiBaseUrl, runAdminAction, type AdminActionResult } from '../lib/adminApi';
import { supabase } from '../lib/supabase';
import { ModalLogo } from './ModalLogo';
import { BackblazeLogo, BackblazeIcon } from './BackblazeLogo';
import { SupabaseLogo } from './SupabaseLogo';
import { CloudflareLogo } from './CloudflareLogo';
import { RailwayLogo } from './RailwayLogo';
import { useCurrency } from '../lib/currency';

interface Props {
  stats: DashboardStats | null;
  users: UserProfile[];
  events: Event[];
  guests: GuestLog[];
  photos: Photo[];
}

type BackblazeUsage = {
  bucketName?: string;
  fileCount?: number;
  totalBytes?: number;
  totalGb?: number;
  timestamp?: string;
  error?: string;
  code?: string;
};

type BackblazeOrphanScan = Pick<
  AdminActionResult,
  'totalFiles' | 'orphanFiles' | 'orphanBytes' | 'referencedFiles' | 'deletedFiles' | 'deletedBytes'
>;

const formatSize = (bytes: number | null | undefined) => {
  if (bytes === null || bytes === undefined || isNaN(bytes) || bytes < 0) return '0 B';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const sizeIndex = Math.min(Math.max(0, i), sizes.length - 1);
  return parseFloat((bytes / Math.pow(k, sizeIndex)).toFixed(2)) + ' ' + sizes[sizeIndex];
};

const formatDecimalSize = (bytes: number | null | undefined) => {
  if (bytes === null || bytes === undefined || isNaN(bytes) || bytes < 0) return '0 B';
  if (bytes === 0) return '0 B';
  const k = 1000;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const sizeIndex = Math.min(Math.max(0, i), sizes.length - 1);
  return parseFloat((bytes / Math.pow(k, sizeIndex)).toFixed(2)) + ' ' + sizes[sizeIndex];
};

const formatNumber = (num: number) => {
  return new Intl.NumberFormat().format(num);
};

const computeModalLogCostUsd = (log: any): number => {
  const duration = Number(log.execution_time_seconds) || 0;
  const cpu = Number(log.cpu_cores) || 1.0;
  const mem = Number(log.memory_gb) || 1.0;
  const fn = log.function_name || '';
  const gpuType = (log.gpu_type || '').toLowerCase();

  let gpuRateUsd = 0;
  if (gpuType === 'l4' || fn === 'process_video_gpu') {
    gpuRateUsd = 0.0002222; // $0.80 / hr = $0.0002222 / sec
  } else if (gpuType === 'a10g') {
    gpuRateUsd = 0.0002778; // $1.00 / hr
  } else if (gpuType === 't4') {
    gpuRateUsd = 0.0001639; // $0.59 / hr
  }

  return duration * ((cpu * 0.0000131) + (mem * 0.00000222) + gpuRateUsd);
};

const computeModalLogCostInr = (log: any, usdToInrRate: number): number => {
  if (typeof log.estimated_cost_inr === 'number' && !isNaN(log.estimated_cost_inr) && log.estimated_cost_inr > 0) {
    if (usdToInrRate === 100) return log.estimated_cost_inr;
    return (log.estimated_cost_inr / 100) * usdToInrRate;
  }
  return computeModalLogCostUsd(log) * usdToInrRate;
};

export const InfraCostGrid: React.FC<Props> = ({ stats, users, events, guests, photos }) => {
  const [activeSubTab, setActiveSubTab] = useState<'total' | 'supabase' | 'backblaze' | 'cloudflare' | 'modal' | 'railway'>('total');
  const [costChartMode, setCostChartMode] = useState<'actual' | 'simulated'>('actual');
  const [modalLogs, setModalLogs] = useState<any[]>([]);
  
  // Interactive Simulator States
  const [supabaseTier, setSupabaseTier] = useState<'free' | 'pro'>('free');
  
  // Live API Sync States
  const [liveBillingTier, setLiveBillingTier] = useState<string | null>(null);
  const [loadingBilling, setLoadingBilling] = useState<boolean>(false);

  // Cloudflare Live API States
  const [liveCfPlan, setLiveCfPlan] = useState<string | null>(null);
  const [liveCfTransformations, setLiveCfTransformations] = useState<number | null>(null);
  const [liveCfStoredImages, setLiveCfStoredImages] = useState<number | null>(null);
  const [liveCfSubscriptions, setLiveCfSubscriptions] = useState<any[]>([]);
  const [liveB2Usage, setLiveB2Usage] = useState<BackblazeUsage | null>(null);
  const [orphanScan, setOrphanScan] = useState<BackblazeOrphanScan | null>(null);
  const [orphanActionLoading, setOrphanActionLoading] = useState<'scan' | 'delete' | null>(null);
  const [orphanActionError, setOrphanActionError] = useState('');
  const [billingRefreshKey, setBillingRefreshKey] = useState(0);

  // Railway Live API States
  const [liveRailwayData, setLiveRailwayData] = useState<{
    projectName: string;
    cpuDollars: number;
    memoryDollars: number;
    networkDollars: number;
    totalEstimatedDollars: number;
    invoiceDollars: number | null;
    error?: string;
  } | null>(null);

  // Shared Currency Engine (USD/INR Mode & Live Forex Rate)
  const {
    currency,
    setCurrency,
    rate: usdToInrRate,
    rateInput: usdToInrRateInput,
    handleRateInputChange,
    syncLiveRate,
    isSyncing: isSyncingRate,
    marketRate,
  } = useCurrency();

  const fmtCost = (valUsd: number, decimals: number = 2): string => {
    if (valUsd == null || isNaN(valUsd)) return currency === 'USD' ? '$0.00' : '₹0.00';
    if (currency === 'USD') return `$${valUsd.toFixed(decimals)}`;
    return `₹${(valUsd * usdToInrRate).toFixed(decimals)}`;
  };

  const fmtSub = (valUsd: number, suffix: string = ''): string => {
    if (valUsd == null || isNaN(valUsd)) return '';
    const cleanSuffix = suffix ? ` ${suffix}` : '';
    if (currency === 'USD') {
      return `₹${(valUsd * usdToInrRate).toFixed(2)} INR${cleanSuffix}`;
    }
    const d = valUsd < 0.01 && valUsd > 0 ? 4 : 2;
    return `$${valUsd.toFixed(d)} USD${cleanSuffix}`;
  };

  // Timeframe Filter States
  const [timeFilter, setTimeFilter] = useState<'1d' | '1w' | '1m' | '30d' | '1y' | 'all' | 'custom'>('1m');

  // Modal Search & Filter States
  const [modalSearchTerm, setModalSearchTerm] = useState<string>('');
  const [modalUserFilter, setModalUserFilter] = useState<string>('all');
  const [modalWorkerFilter, setModalWorkerFilter] = useState<string>('all');
  const [loadingModalLogs, setLoadingModalLogs] = useState<boolean>(false);

  // Fast entity lookup maps for dynamic metadata resolution
  const usersMap = useMemo(() => new Map(users.map(u => [u.id, u])), [users]);
  const eventsMap = useMemo(() => new Map(events.map(e => [e.id, e])), [events]);
  const photosMap = useMemo(() => new Map(photos.map(p => [p.id, p])), [photos]);

  // Helper to resolve user, event, media, and worker metadata for any log row
  const resolveLogDetails = useMemo(() => {
    return (log: any) => {
      const photo = log.photo_id ? photosMap.get(log.photo_id) : undefined;
      const eventId = log.event_id || photo?.eventId || '';
      const event = eventId ? eventsMap.get(eventId) : undefined;

      const resolvedUserId = log.user_id || photo?.userId || event?.createdById || event?.createdBy || '';
      const resolvedUser = resolvedUserId ? usersMap.get(resolvedUserId) : undefined;

      const fn = log.function_name || 'process_single_photo';
      let mediaType: 'photo' | 'video' | 'selfie' | 'batch' = 'photo';
      if (log.media_type) {
        mediaType = log.media_type;
      } else if (fn.includes('video') || photo?.mediaType === 'video' || photo?.resourceType === 'video') {
        mediaType = 'video';
      } else if (fn === 'find_matching_photos') {
        mediaType = 'selfie';
      } else if (fn === 'process_media_batch') {
        mediaType = 'batch';
      }

      const mediaSize: number | null = log.media_size != null ? Number(log.media_size) : (photo?.size ? Number(photo.size) : null);

      const videoDuration: number | null = log.video_duration_seconds != null
        ? Number(log.video_duration_seconds)
        : (photo?.duration != null ? Number(photo.duration) : null);

      let workerTitle = 'Modal Photo Worker';
      let workerSpecs = '1 vCPU • 1GB RAM';
      let workerBadge = 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
      let workerTextColor = 'text-emerald-400';
      let isGpu = false;

      if (log.worker_type) {
        workerTitle = log.worker_type;
        if (log.worker_type.includes('GPU') || log.gpu_type === 'l4') {
          workerSpecs = 'NVIDIA L4 • 4 vCPU • 8GB RAM';
          workerBadge = 'bg-amber-500/10 border-amber-500/20 text-amber-400';
          workerTextColor = 'text-amber-400';
          isGpu = true;
        } else if (log.worker_type.includes('Batch')) {
          workerSpecs = '0.125 vCPU • 1GB RAM';
          workerBadge = 'bg-blue-500/10 border-blue-500/20 text-blue-400';
          workerTextColor = 'text-blue-400';
        } else if (log.worker_type.includes('Selfie')) {
          workerSpecs = '0.125 vCPU • 1GB RAM';
          workerBadge = 'bg-purple-500/10 border-purple-500/20 text-purple-400';
          workerTextColor = 'text-purple-400';
        } else if (log.worker_type.includes('CPU') && fn.includes('video')) {
          workerSpecs = '4 vCPU • 4GB RAM';
          workerBadge = 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400';
          workerTextColor = 'text-cyan-400';
        }
      } else if (fn === 'process_video_gpu' || log.gpu_type === 'l4') {
        workerTitle = 'Modal GPU Worker';
        workerSpecs = 'NVIDIA L4 • 4 vCPU • 8GB RAM';
        workerBadge = 'bg-amber-500/10 border-amber-500/20 text-amber-400';
        workerTextColor = 'text-amber-400';
        isGpu = true;
      } else if (fn === 'process_video_cpu' || fn.includes('video')) {
        workerTitle = 'Modal CPU Worker';
        workerSpecs = '4 vCPU • 4GB RAM';
        workerBadge = 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400';
        workerTextColor = 'text-cyan-400';
      } else if (fn === 'find_matching_photos') {
        workerTitle = 'Modal Selfie Worker';
        workerSpecs = '0.125 vCPU • 1GB RAM';
        workerBadge = 'bg-purple-500/10 border-purple-500/20 text-purple-400';
        workerTextColor = 'text-purple-400';
      } else if (fn === 'process_media_batch') {
        workerTitle = 'Modal Batch Dispatcher';
        workerSpecs = '0.125 vCPU • 1GB RAM';
        workerBadge = 'bg-blue-500/10 border-blue-500/20 text-blue-400';
        workerTextColor = 'text-blue-400';
      }

      const isSubGallery = Boolean(event?.parentId) || event?.type === 'sub';
      const parentEvent = event?.parentId ? eventsMap.get(event.parentId) : undefined;
      const workerName = workerTitle.replace(/\s*\(.*?\)\s*/g, '').trim();

      return {
        photo,
        event,
        eventId,
        isSubGallery,
        parentEvent,
        resolvedUserId,
        resolvedUser,
        mediaType,
        mediaSize,
        videoDuration,
        workerTitle,
        workerName,
        workerSpecs,
        workerBadge,
        workerTextColor,
        isGpu,
      };
    };
  }, [photosMap, eventsMap, usersMap]);

  // Filtered Modal logs based on user, worker, and search query
  const filteredModalLogs = useMemo(() => {
    return modalLogs.filter(log => {
      const details = resolveLogDetails(log);

      if (modalUserFilter !== 'all') {
        if (details.resolvedUserId !== modalUserFilter) return false;
      }

      if (modalWorkerFilter !== 'all') {
        if (modalWorkerFilter === 'gpu' && !details.isGpu) return false;
        if (modalWorkerFilter === 'cpu' && (details.isGpu || !log.function_name?.includes('video'))) return false;
        if (modalWorkerFilter === 'photo' && log.function_name !== 'process_single_photo') return false;
        if (modalWorkerFilter === 'selfie' && log.function_name !== 'find_matching_photos') return false;
        if (modalWorkerFilter === 'batch' && log.function_name !== 'process_media_batch') return false;
      }

      if (modalSearchTerm.trim()) {
        const query = modalSearchTerm.toLowerCase();
        const userName = (details.resolvedUser?.name || '').toLowerCase();
        const userEmail = (details.resolvedUser?.email || '').toLowerCase();
        const eventTitle = (details.event?.title || '').toLowerCase();
        const parentTitle = (details.parentEvent?.title || '').toLowerCase();
        const eventId = (details.eventId || '').toLowerCase();
        const photoId = (log.photo_id || '').toLowerCase();
        const fn = (log.function_name || '').toLowerCase();
        const worker = (details.workerTitle || '').toLowerCase();

        return (
          userName.includes(query) ||
          userEmail.includes(query) ||
          eventTitle.includes(query) ||
          parentTitle.includes(query) ||
          eventId.includes(query) ||
          photoId.includes(query) ||
          fn.includes(query) ||
          worker.includes(query)
        );
      }

      return true;
    });
  }, [modalLogs, modalSearchTerm, modalUserFilter, modalWorkerFilter, resolveLogDetails]);

  // Pagination States
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [filteredModalLogs.length, modalSearchTerm, modalUserFilter, modalWorkerFilter]);

  const paginatedLogs = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredModalLogs.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredModalLogs, currentPage]);

  const totalPages = Math.ceil(filteredModalLogs.length / itemsPerPage);

  const pageNumbers = useMemo(() => {
    const range: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - 2);
    let end = Math.min(totalPages, start + maxVisible - 1);
    
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    
    for (let i = start; i <= end; i++) {
      range.push(i);
    }
    return range;
  }, [currentPage, totalPages]);

  // Format local timestamps (YYYY-MM-DDTHH:MM)
  const defaultCustomStart = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 3);
    const tzOffset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
  }, []);

  const defaultCustomEnd = useMemo(() => {
    const d = new Date();
    const tzOffset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
  }, []);

  const [customStart, setCustomStart] = useState<string>(defaultCustomStart);
  const [customEnd, setCustomEnd] = useState<string>(defaultCustomEnd);

  // Dynamic Timeframe Scaling Factor & Label
  const { timeframeFactor, timeframeSuffix, timeframeLabel } = useMemo(() => {
    if (timeFilter === '1d') {
      return { timeframeFactor: 1 / 30, timeframeSuffix: '/ day', timeframeLabel: 'Running Day (24h)' };
    }
    if (timeFilter === '1w') {
      return { timeframeFactor: 7 / 30, timeframeSuffix: '/ wk', timeframeLabel: 'Running Week (7d)' };
    }
    if (timeFilter === '1m') {
      return { timeframeFactor: 1, timeframeSuffix: '/ mo', timeframeLabel: 'Month to Date (30d)' };
    }
    if (timeFilter === '30d') {
      return { timeframeFactor: 1, timeframeSuffix: '/ 30d', timeframeLabel: 'Last 30 Days' };
    }
    if (timeFilter === '1y') {
      const now = new Date();
      const startOfYear = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      const diffDays = Math.max(1, (now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
      const factor = diffDays / 30;
      return { timeframeFactor: factor, timeframeSuffix: '/ running yr', timeframeLabel: 'Running Year Endured' };
    }
    if (timeFilter === 'all') {
      return { timeframeFactor: 1, timeframeSuffix: '', timeframeLabel: 'All Time' };
    }
    if (timeFilter === 'custom') {
      const s = new Date(customStart).getTime();
      const e = new Date(customEnd).getTime();
      const diffDays = Math.max(0.0416, (e - s) / (1000 * 60 * 60 * 24));
      const factor = diffDays / 30;
      const suffix = diffDays < 1 ? `/ ${Math.round(diffDays * 24)}h` : `/ ${Math.round(diffDays)}d`;
      return { timeframeFactor: factor, timeframeSuffix: suffix, timeframeLabel: 'Custom Period' };
    }
    return { timeframeFactor: 1, timeframeSuffix: '/ mo', timeframeLabel: 'Month to Date (30d)' };
  }, [timeFilter, customStart, customEnd]);

  const dateRange = useMemo(() => {
    const now = new Date();
    let start: Date;
    let end: Date = now;
    
    if (timeFilter === '1d') {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      start = startOfDay;
    } else if (timeFilter === '1w') {
      const startOfWeek = new Date();
      startOfWeek.setHours(0, 0, 0, 0);
      const day = startOfWeek.getDay();
      const diff = startOfWeek.getDate() - (day === 0 ? 6 : day - 1);
      startOfWeek.setDate(diff);
      start = startOfWeek;
    } else if (timeFilter === '1m') {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      start = startOfMonth;
    } else if (timeFilter === '30d') {
      start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    } else if (timeFilter === '1y') {
      const startOfYear = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      start = startOfYear;
      end = now;
    } else if (timeFilter === 'all') {
      start = new Date(0);
    } else {
      start = customStart ? new Date(customStart) : new Date(now.getFullYear(), now.getMonth(), 1);
      end = customEnd ? new Date(customEnd) : now;
    }
    
    return { start, end };
  }, [timeFilter, customStart, customEnd]);

  useEffect(() => {
    const fetchBilling = async () => {
      setLoadingBilling(true);
      try {
        const apiBase = getApiBaseUrl();
        const token = await getAccessToken();
        if (!token) {
          throw new Error('Please sign in again to load infrastructure data.');
        }
        const requestOptions = {
          headers: { Authorization: `Bearer ${token}` },
        };
        
        try {
          const res = await fetch(`${apiBase}/api/admin/supabase-billing`, requestOptions);
          if (res.ok) {
            const data = await res.json();
            if (data?.billing_tier?.id) {
              setLiveBillingTier(data.billing_tier.id);
              if (data.billing_tier.id === 'pro' || data.billing_tier.id === 'free') {
                setSupabaseTier(data.billing_tier.id);
              }
            }
          }
        } catch (err) {
          console.warn('[InfraCost] Supabase billing API unavailable:', err);
        }

        try {
          const cfRes = await fetch(`${apiBase}/api/admin/cloudflare-billing`, requestOptions);
          if (cfRes.ok) {
            const cfData = await cfRes.json();
            if (cfData.zonePlan) {
              setLiveCfPlan(cfData.zonePlan);
            }
            if (typeof cfData.uniqueTransformations === 'number') {
              setLiveCfTransformations(cfData.uniqueTransformations);
            }
            if (typeof cfData.storedImages === 'number') {
              setLiveCfStoredImages(cfData.storedImages);
            }
            if (Array.isArray(cfData.subscriptions)) {
              setLiveCfSubscriptions(cfData.subscriptions);
            }
          }
        } catch (err) {
          console.warn('[InfraCost] Cloudflare billing API unavailable:', err);
        }

        try {
          const b2Res = await fetch(`${apiBase}/api/admin/backblaze-usage`, requestOptions);
          const b2Data = await b2Res.json().catch(() => null);
          if (b2Res.ok && b2Data) {
            setLiveB2Usage(b2Data);
            if (typeof b2Data.totalGb === 'number') {
              setSimulatedStorageGB(Math.max(50, Math.ceil(b2Data.totalGb)));
            }
          } else {
            setLiveB2Usage({
              bucketName: b2Data?.bucketName || 'EveBash',
              error: b2Data?.error || `Backblaze usage API returned status ${b2Res.status}`,
              code: b2Data?.code,
            });
          }
        } catch (err) {
          console.warn('[InfraCost] Backblaze usage API unavailable:', err);
        }

        try {
          const params = new URLSearchParams({
            startDate: dateRange.start.toISOString(),
            endDate: dateRange.end.toISOString(),
          });
          const railwayRes = await fetch(
            `${apiBase}/api/admin/railway-billing?${params.toString()}`,
            requestOptions,
          );
          const railwayData = await railwayRes.json().catch(() => null);
          if (railwayRes.ok && railwayData) {
            setLiveRailwayData(railwayData);
          } else {
            setLiveRailwayData({
              projectName: 'EveBash',
              cpuDollars: 0, memoryDollars: 0, networkDollars: 0,
              totalEstimatedDollars: 0, invoiceDollars: null,
              error: railwayData?.error || `Railway billing API returned status ${railwayRes.status}`,
            });
          }
        } catch (err) {
          console.warn('[InfraCost] Railway billing API unavailable:', err);
        }
      } catch (err: any) {
        console.error('Failed to fetch live billing data:', err);
      } finally {
        setLoadingBilling(false);
      }
    };

    fetchBilling();
  }, [photos.length, billingRefreshKey, dateRange]);

  useEffect(() => {
    let isCancelled = false;
    const fetchModalLogs = async () => {
      setLoadingModalLogs(true);
      try {
        let allLogs: any[] = [];
        let from = 0;
        const batchSize = 1000;

        while (true) {
          let query = supabase.from('modal_cost_logs').select('*');
          if (timeFilter !== 'all') {
            query = query
              .gte('created_at', dateRange.start.toISOString())
              .lte('created_at', dateRange.end.toISOString());
          }
          query = query
            .order('created_at', { ascending: false })
            .range(from, from + batchSize - 1);

          const { data: pageLogs, error: logsErr } = await query;
          if (logsErr) {
            console.error('[Modal] modal_cost_logs fetch error:', logsErr);
            break;
          }
          if (!pageLogs || pageLogs.length === 0) break;
          allLogs = allLogs.concat(pageLogs);
          if (pageLogs.length < batchSize || allLogs.length >= 20000) break;
          from += batchSize;
        }

        if (!isCancelled) {
          setModalLogs(allLogs);
        }
      } catch (err) {
        console.error('Failed to fetch modal logs:', err);
      } finally {
        if (!isCancelled) {
          setLoadingModalLogs(false);
        }
      }
    };

    fetchModalLogs();
    return () => {
      isCancelled = true;
    };
  }, [timeFilter, dateRange.start.toISOString(), dateRange.end.toISOString(), billingRefreshKey]);
  
  // Storage Footprint calculations
  const totalStorage = useMemo(() => {
    return photos.reduce((sum, p) => sum + (Number(p.size) || 0), 0);
  }, [photos]);
  const totalStorageGB = totalStorage / (1024 * 1024 * 1024);
  const liveB2Bytes = typeof liveB2Usage?.totalBytes === 'number' ? liveB2Usage.totalBytes : null;
  const actualB2StorageBytes = liveB2Bytes ?? totalStorage;
  const actualB2StorageGB = actualB2StorageBytes / (1024 * 1024 * 1024);
  const actualB2StorageDecimalGB = actualB2StorageBytes / 1000000000;
  const b2StorageSource = liveB2Bytes !== null ? 'Backblaze live bucket' : 'Database media fallback';
  const defaultSimStorage = Math.max(50, Math.ceil(totalStorageGB));
  const [simulatedStorageGB, setSimulatedStorageGB] = useState<number>(defaultSimStorage);
  
  // Simulated request rate for Cloudflare Workers
  const [simulatedDailyRequests, setSimulatedDailyRequests] = useState<number>(50000);

  // Simulated Railway Usage
  const [simulatedRailwayRAM, setSimulatedRailwayRAM] = useState<number>(0.5); // GB
  const [simulatedRailwayCPU, setSimulatedRailwayCPU] = useState<number>(0.05); // vCPU
  const [simulatedRailwayEgress, setSimulatedRailwayEgress] = useState<number>(5); // GB

  // --- Cost Calculations ---

  // Database Footprint Stats
  const dbStats = useMemo(() => {
    const profilesCount = stats?.totalUsers ?? users.length;
    const eventsCount = stats?.totalEvents ?? events.length;
    const guestsCount = stats?.totalGuests ?? guests.length;
    const photosCount = photos.length;
    const totalRows = profilesCount + eventsCount + guestsCount + photosCount;
    const estimatedSizeBytes = totalRows * 1228.8; 
    return { profilesCount, eventsCount, guestsCount, photosCount, totalRows, estimatedSizeBytes };
  }, [stats, users, events, guests, photos]);

  // Supabase Table overage calculations
  const supabaseDbCostMonth = useMemo(() => {
    const dbSizeGB = dbStats.estimatedSizeBytes / (1024 * 1024 * 1024);
    const limitGB = supabaseTier === 'free' ? 0.5 : 8.0;
    const dbOverageGB = Math.max(0, dbSizeGB - limitGB);
    return dbOverageGB * 0.125;
  }, [dbStats, supabaseTier]);
  
  const supabaseDbCostYear = supabaseDbCostMonth * 12;

  const supabaseMauCostMonth = useMemo(() => {
    const actualMAUs = stats?.mau || users.length;
    const limitMAUs = supabaseTier === 'free' ? 50000 : 100000;
    const mauOverage = Math.max(0, actualMAUs - limitMAUs);
    return mauOverage * 0.00325;
  }, [stats, users, supabaseTier]);

  const supabaseMauCostYear = supabaseMauCostMonth * 12;

  const supabaseEgressCostMonth = useMemo(() => {
    const limitEgressGB = supabaseTier === 'free' ? 2 : 50;
    const actualEgressGB = 0.05;
    const egressOverageGB = Math.max(0, actualEgressGB - limitEgressGB);
    return egressOverageGB * 0.09;
  }, [supabaseTier]);

  const supabaseEgressCostYear = supabaseEgressCostMonth * 12;

  const supabaseComputeCostMonth = supabaseTier === 'pro' ? 25.00 : 0.00;
  const supabaseComputeCostYear = supabaseComputeCostMonth * 12;

  const supabaseTierCost = supabaseDbCostMonth + supabaseMauCostMonth + supabaseEgressCostMonth + supabaseComputeCostMonth;

  // Backblaze B2 Costs (Storage, Class B, Class C, Egress)
  const b2StorageCostMonth = Math.max(0, actualB2StorageDecimalGB - 10) * 0.006;
  const b2StorageCostYear = b2StorageCostMonth * 12;

  const b2ClassBCallsMonth = photos.length * 20;
  const b2ClassBOverage = Math.max(0, b2ClassBCallsMonth - 75000);
  const b2ClassBCostMonth = (b2ClassBOverage / 10000) * 0.004;
  const b2ClassBCostYear = b2ClassBCostMonth * 12;

  const b2ClassCCallsMonth = Math.ceil(photos.length * 1.5);
  const b2ClassCOverage = Math.max(0, b2ClassCCallsMonth - 75000);
  const b2ClassCCostMonth = (b2ClassCOverage / 1000) * 0.004;
  const b2ClassCCostYear = b2ClassCCostMonth * 12;

  const b2EgressCostMonth = 0.00;
  const actualB2Cost = b2StorageCostMonth + b2ClassBCostMonth + b2ClassCCostMonth + b2EgressCostMonth;

  // B2 Simulated Costs
  const simStorageCostMonth = Math.max(0, simulatedStorageGB - 10) * 0.006;
  const simMediaCount = Math.ceil(photos.length * (simulatedStorageGB / Math.max(1, actualB2StorageGB || 1)));
  const simClassBCallsMonth = simMediaCount * 20;
  const simClassBOverage = Math.max(0, simClassBCallsMonth - 75000);
  const simClassBCostMonth = (simClassBOverage / 10000) * 0.004;
  const simClassCCallsMonth = Math.ceil(simMediaCount * 1.5);
  const simClassCOverage = Math.max(0, simClassCCallsMonth - 75000);
  const simClassCCostMonth = (simClassCOverage / 1000) * 0.004;
  const simulatedB2Cost = simStorageCostMonth + simClassBCostMonth + simClassCCostMonth;

  // Cloudflare Costs
  const registrarCost = 0.00;
  const monthlyRequests = simulatedDailyRequests * 30;

  const actualCfImageCostMonth = useMemo(() => {
    let cost = 0;
    if (liveCfTransformations !== null) {
      const overageTransformations = Math.max(0, liveCfTransformations - 5000);
      cost += (overageTransformations / 1000) * 0.50;
    }
    if (liveCfStoredImages !== null && liveCfStoredImages > 0) {
      cost += 5.00;
      const overageImages = Math.max(0, liveCfStoredImages - 10000);
      cost += (overageImages / 10000) * 1.00;
    }
    return cost;
  }, [liveCfTransformations, liveCfStoredImages]);

  const simCfImageCostMonth = 0;
  
  const workersCost = useMemo(() => {
    if (monthlyRequests <= 3000000) {
      return 0.00;
    }
    if (monthlyRequests <= 10000000) {
      return 5.00;
    }
    const extraRequests = monthlyRequests - 10000000;
    const extraMillions = Math.ceil(extraRequests / 1000000);
    return 5.00 + (extraMillions * 0.50);
  }, [monthlyRequests]);

  const liveCfSubscriptionCost = useMemo(() => {
    let subscriptionSum = 0;
    let hasZonePlanInSubscriptions = false;

    if (Array.isArray(liveCfSubscriptions) && liveCfSubscriptions.length > 0) {
      subscriptionSum = liveCfSubscriptions.reduce((sum, sub) => {
        if (sub.state === 'active' || sub.state === 'paid') {
          const freqMultiplier = sub.frequency === 'yearly' ? 1 / 12 : 1;
          const ratePlanId = (sub.rate_plan?.id || '').toLowerCase();
          if (ratePlanId.includes('pro') || ratePlanId.includes('business')) {
            hasZonePlanInSubscriptions = true;
          }
          return sum + ((sub.price || 0) * freqMultiplier);
        }
        return sum;
      }, 0);
    }

    if (!hasZonePlanInSubscriptions) {
      const normalizedPlan = (liveCfPlan || '').toLowerCase();
      if (normalizedPlan.includes('pro')) {
        subscriptionSum += 25.00;
      } else if (normalizedPlan.includes('business')) {
        subscriptionSum += 200.00;
      }
    }

    return subscriptionSum;
  }, [liveCfSubscriptions, liveCfPlan]);

  const actualCloudflareCost = registrarCost + actualCfImageCostMonth + liveCfSubscriptionCost;
  const simulatedCloudflareCost = registrarCost + workersCost + simCfImageCostMonth;

  // Modal.com actual costs
  const actualModalCostInfo = useMemo(() => {
    let totalUsd = 0;
    let totalInr = 0;
    modalLogs.forEach(log => {
      const usd = computeModalLogCostUsd(log);
      const inr = computeModalLogCostInr(log, usdToInrRate);
      totalUsd += usd;
      totalInr += inr;
    });
    return {
      usd: totalUsd,
      inr: totalInr
    };
  }, [modalLogs, usdToInrRate]);

  const actualModalCost = actualModalCostInfo.usd;

  // Modal.com metrics breakdown
  const modalStats = useMemo(() => {
    let photosCount = 0;
    let videosCount = 0;
    let videoGpuCount = 0;
    let videoCpuCount = 0;
    let selfiesCount = 0;
    let batchesCount = 0;
    let totalFaces = 0;
    let totalDuration = 0;
    let totalMediaBytes = 0;

    modalLogs.forEach(log => {
      const fn = log.function_name || 'process_single_photo';
      const isVideo = fn.includes('video') || log.media_type === 'video';
      if (fn === 'process_single_photo') {
        photosCount++;
      } else if (fn === 'find_matching_photos') {
        selfiesCount++;
      } else if (fn === 'process_media_batch') {
        batchesCount++;
      } else if (isVideo) {
        videosCount++;
        if (fn === 'process_video_gpu' || log.gpu_type === 'l4') {
          videoGpuCount++;
        } else {
          videoCpuCount++;
        }
      }

      totalFaces += Number(log.faces_detected) || 0;
      totalDuration += Number(log.execution_time_seconds) || 0;

      const photo = log.photo_id ? photosMap.get(log.photo_id) : undefined;
      const size = Number(log.media_size) || Number(photo?.size) || 0;
      totalMediaBytes += size;
    });

    return {
      photosCount,
      videosCount,
      videoGpuCount,
      videoCpuCount,
      selfiesCount,
      batchesCount,
      totalFaces,
      totalMediaBytes,
      avgDuration: modalLogs.length > 0 ? totalDuration / modalLogs.length : 0,
    };
  }, [modalLogs, photosMap]);

  // Aggregated worker fleet performance & compute billing breakdown
  const modalWorkerBreakdown = useMemo(() => {
    const fleetTemplates = [
      {
        key: 'photo',
        name: 'Modal Photo Worker',
        workerTypeDescription: 'Photo Face Vector Indexer',
        specs: '1 vCPU • 1GB RAM',
        textColor: 'text-emerald-400',
        badgeStyle: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
        costPerSecUsd: (1.0 * 0.0000131) + (1.0 * 0.00000222), // $0.00001532/s
        runs: 0,
        totalDurationSeconds: 0,
        dataSizeBytes: 0,
        totalCostUsd: 0,
        totalCostInr: 0,
      },
      {
        key: 'video_gpu',
        name: 'Modal GPU Worker',
        workerTypeDescription: 'NVIDIA L4 Video Transcoder',
        specs: 'NVIDIA L4 • 4 vCPU • 8GB RAM',
        textColor: 'text-amber-400',
        badgeStyle: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
        costPerSecUsd: (4.0 * 0.0000131) + (8.0 * 0.00000222) + 0.0002222, // $0.00029236/s
        runs: 0,
        totalDurationSeconds: 0,
        dataSizeBytes: 0,
        totalCostUsd: 0,
        totalCostInr: 0,
      },
      {
        key: 'video_cpu',
        name: 'Modal CPU Worker',
        workerTypeDescription: 'CPU Video Transcoder (Fallback)',
        specs: '4 vCPU • 4GB RAM',
        textColor: 'text-cyan-400',
        badgeStyle: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400',
        costPerSecUsd: (4.0 * 0.0000131) + (4.0 * 0.00000222), // $0.00006128/s
        runs: 0,
        totalDurationSeconds: 0,
        dataSizeBytes: 0,
        totalCostUsd: 0,
        totalCostInr: 0,
      },
      {
        key: 'selfie',
        name: 'Modal Selfie Worker',
        workerTypeDescription: 'Guest Face Matcher',
        specs: '0.125 vCPU • 1GB RAM',
        textColor: 'text-purple-400',
        badgeStyle: 'bg-purple-500/10 border-purple-500/30 text-purple-400',
        costPerSecUsd: (0.125 * 0.0000131) + (1.0 * 0.00000222), // $0.00000386/s
        runs: 0,
        totalDurationSeconds: 0,
        dataSizeBytes: 0,
        totalCostUsd: 0,
        totalCostInr: 0,
      },
      {
        key: 'batch',
        name: 'Modal Batch Dispatcher',
        workerTypeDescription: 'Serverless Batch Dispatcher',
        specs: '0.125 vCPU • 1GB RAM',
        textColor: 'text-blue-400',
        badgeStyle: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
        costPerSecUsd: (0.125 * 0.0000131) + (1.0 * 0.00000222), // $0.00000386/s
        runs: 0,
        totalDurationSeconds: 0,
        dataSizeBytes: 0,
        totalCostUsd: 0,
        totalCostInr: 0,
      },
    ];

    modalLogs.forEach(log => {
      const fn = log.function_name || 'process_single_photo';
      const isVideo = fn.includes('video') || log.media_type === 'video';
      const isGpu = fn === 'process_video_gpu' || log.gpu_type === 'l4' || log.worker_type?.includes('GPU');

      let targetKey = 'photo';
      if (fn === 'process_video_gpu' || isGpu) {
        targetKey = 'video_gpu';
      } else if (fn === 'process_video_cpu' || (isVideo && !isGpu)) {
        targetKey = 'video_cpu';
      } else if (fn === 'find_matching_photos' || log.worker_type?.includes('Selfie')) {
        targetKey = 'selfie';
      } else if (fn === 'process_media_batch' || log.worker_type?.includes('Batch')) {
        targetKey = 'batch';
      } else {
        targetKey = 'photo';
      }

      const target = fleetTemplates.find(f => f.key === targetKey);
      if (target) {
        target.runs++;
        const duration = Number(log.execution_time_seconds) || 0;
        target.totalDurationSeconds += duration;

        const photo = log.photo_id ? photosMap.get(log.photo_id) : undefined;
        const size = Number(log.media_size) || Number(photo?.size) || 0;
        target.dataSizeBytes += size;

        target.totalCostUsd += computeModalLogCostUsd(log);
        target.totalCostInr += computeModalLogCostInr(log, usdToInrRate);
      }
    });

    return fleetTemplates.map(f => ({
      ...f,
      costPerSecInr: f.costPerSecUsd * usdToInrRate,
      avgDurationSeconds: f.runs > 0 ? f.totalDurationSeconds / f.runs : 0,
    }));
  }, [modalLogs, photosMap, usdToInrRate]);

  const modalWorkerTotals = useMemo(() => {
    let totalRuns = 0;
    let totalDuration = 0;
    let totalBytes = 0;
    let totalCostUsd = 0;
    let totalCostInr = 0;

    modalWorkerBreakdown.forEach(f => {
      totalRuns += f.runs;
      totalDuration += f.totalDurationSeconds;
      totalBytes += f.dataSizeBytes;
      totalCostUsd += f.totalCostUsd;
      totalCostInr += f.totalCostInr;
    });

    return {
      totalRuns,
      totalDuration,
      totalBytes,
      totalCostUsd,
      totalCostInr,
    };
  }, [modalWorkerBreakdown]);

  // Railway.app actual/simulated costs
  const railwaySecondsPerMonth = 2592000;
  const railwayRamCostMonth = simulatedRailwayRAM * 0.00000386 * railwaySecondsPerMonth;
  const railwayCpuCostMonth = simulatedRailwayCPU * 0.00000772 * railwaySecondsPerMonth;
  const railwayEgressCostMonth = simulatedRailwayEgress * 0.05;
  const simulatedRailwayCost = railwayRamCostMonth + railwayCpuCostMonth + railwayEgressCostMonth;

  const hasLiveRailway = liveRailwayData && !liveRailwayData.error && liveRailwayData.totalEstimatedDollars > 0;
  const actualRailwayCost = hasLiveRailway
    ? (liveRailwayData.invoiceDollars ?? liveRailwayData.totalEstimatedDollars)
    : simulatedRailwayCost;

  // Timeframe-adjusted operational costs (endured for the selected timeframe)
  const timeframeSupabaseCost = supabaseTierCost * timeframeFactor;
  const timeframeActualB2Cost = actualB2Cost * timeframeFactor;
  const timeframeSimulatedB2Cost = simulatedB2Cost * timeframeFactor;
  const timeframeActualCloudflareCost = actualCloudflareCost * timeframeFactor;
  const timeframeSimulatedCloudflareCost = simulatedCloudflareCost * timeframeFactor;
  const timeframeActualRailwayCost = actualRailwayCost * timeframeFactor;
  const timeframeSimulatedRailwayCost = simulatedRailwayCost * timeframeFactor;
  const timeframeActualModalCostUsd = actualModalCost;
  const timeframeActualModalCostInr = actualModalCostInfo.inr;

  // Actual & simulated consolidated upkeep for active timeframe
  const timeframeTotalActualCostUsd = timeframeSupabaseCost + timeframeActualB2Cost + timeframeActualCloudflareCost + timeframeActualRailwayCost + timeframeActualModalCostUsd;
  const timeframeTotalActualCostInr = (timeframeSupabaseCost + timeframeActualB2Cost + timeframeActualCloudflareCost + timeframeActualRailwayCost) * usdToInrRate + timeframeActualModalCostInr;

  const timeframeTotalSimulatedCostUsd = timeframeSupabaseCost + timeframeSimulatedB2Cost + timeframeSimulatedCloudflareCost + timeframeSimulatedRailwayCost + timeframeActualModalCostUsd;
  const timeframeTotalSimulatedCostInr = (timeframeSupabaseCost + timeframeSimulatedB2Cost + timeframeSimulatedCloudflareCost + timeframeSimulatedRailwayCost) * usdToInrRate + timeframeActualModalCostInr;

  // Full-year (12-month) projected annualized estimates
  const nowForProjection = new Date();
  const daysInRunningYear = Math.max(1, (nowForProjection.getTime() - new Date(nowForProjection.getFullYear(), 0, 1, 0, 0, 0, 0).getTime()) / (1000 * 60 * 60 * 24));
  const projectedYearModalInr = timeFilter === '1y'
    ? (actualModalCostInfo.inr / daysInRunningYear) * 365
    : (timeFilter === '1d' ? actualModalCostInfo.inr * 365 : (timeFilter === '1w' ? (actualModalCostInfo.inr / 7) * 365 : actualModalCostInfo.inr * 12));
  const projectedYearModalUsd = timeFilter === '1y'
    ? (actualModalCostInfo.usd / daysInRunningYear) * 365
    : (timeFilter === '1d' ? actualModalCostInfo.usd * 365 : (timeFilter === '1w' ? (actualModalCostInfo.usd / 7) * 365 : actualModalCostInfo.usd * 12));

  const projectedYearTotalUsd = (supabaseTierCost * 12) + (actualB2Cost * 12) + (actualCloudflareCost * 12) + (actualRailwayCost * 12) + projectedYearModalUsd;
  const projectedYearTotalInr = (projectedYearTotalUsd - projectedYearModalUsd) * usdToInrRate + projectedYearModalInr;

  // Media breakdown stats
  const mediaBreakdown = useMemo(() => {
    let photoCount = 0;
    let photoSize = 0;
    let videoCount = 0;
    let videoSize = 0;

    photos.forEach(p => {
      if (p.mediaType === 'video') {
        videoCount++;
        videoSize += p.size;
      } else {
        photoCount++;
        photoSize += p.size;
      }
    });

    return { photoCount, photoSize, videoCount, videoSize };
  }, [photos]);

  const handleScanBackblazeOrphans = async () => {
    setOrphanActionLoading('scan');
    setOrphanActionError('');
    try {
      const result = await runAdminAction('scanBackblazeOrphans');
      if (!result.success) {
        setOrphanActionError(result.error || 'Could not scan Backblaze orphan files.');
        return;
      }
      setOrphanScan(result);
    } catch (error: any) {
      setOrphanActionError(error?.message || 'Could not scan Backblaze orphan files.');
    } finally {
      setOrphanActionLoading(null);
    }
  };

  const handleDeleteBackblazeOrphans = async () => {
    const typed = window.prompt('This deletes Backblaze files not referenced by the database. Type DELETE to continue.');
    if (typed !== 'DELETE') return;

    setOrphanActionLoading('delete');
    setOrphanActionError('');
    try {
      const result = await runAdminAction('deleteBackblazeOrphans', {
        confirm: 'DELETE_ORPHAN_B2_FILES',
      });
      if (!result.success) {
        setOrphanActionError(result.error || 'Could not delete Backblaze orphan files.');
        return;
      }
      setOrphanScan(result);
      setBillingRefreshKey(key => key + 1);
    } catch (error: any) {
      setOrphanActionError(error?.message || 'Could not delete Backblaze orphan files.');
    } finally {
      setOrphanActionLoading(null);
    }
  };

  // Shared Helper: Render Timeframe & Exchange Rate Toolbar (referenced from Economics subpage in UserDetailPage)
  const renderFilterBar = (activeBgClass: string, textThemeClass: string, borderThemeClass: string) => {
    return (
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Dollar - INR Conversion Widget (Shifted to Left Side on Top) */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800/90 rounded-2xl p-1.5 shadow-sm">
              {/* Badge Label */}
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-800/60 border ${borderThemeClass} ${textThemeClass}`}>
                <ArrowLeftRight className="w-3.5 h-3.5 shrink-0" />
                <span className="text-[11px] font-bold tracking-tight whitespace-nowrap">Dollar – INR Conversion</span>
              </div>

              {/* Currency Toggle (INR / USD) */}
              <div className="flex items-center bg-slate-950/80 p-0.5 rounded-xl border border-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={() => setCurrency('INR')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    currency === 'INR'
                      ? `${activeBgClass} text-white shadow-md`
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Display all costs in Indian Rupees (INR)"
                >
                  ₹ INR
                </button>
                <button
                  type="button"
                  onClick={() => setCurrency('USD')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    currency === 'USD'
                      ? `${activeBgClass} text-white shadow-md`
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Display all costs in US Dollars (USD)"
                >
                  $ USD
                </button>
              </div>

              {/* Conversion Rate Setter ($1 = ₹Rate) */}
              <div className="flex items-center space-x-1.5 bg-slate-950/80 border border-slate-800 rounded-xl px-2.5 py-1 shrink-0">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  Rate:
                </span>
                <span className="font-mono font-bold text-xs text-sky-400">$1</span>
                <span className="text-slate-500 text-xs font-bold">=</span>
                <div className="flex items-center font-mono font-bold text-white text-xs">
                  <span className="text-emerald-400 mr-0.5">₹</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={usdToInrRateInput}
                    onChange={e => handleRateInputChange(e.target.value)}
                    className="bg-transparent text-white text-xs border-0 outline-none w-11 text-center font-bold font-mono focus:ring-0"
                    title="Edit USD to INR exchange rate"
                  />
                </div>
                <button
                  type="button"
                  onClick={syncLiveRate}
                  disabled={isSyncingRate}
                  className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-emerald-400 transition-colors disabled:opacity-50 cursor-pointer"
                  title={marketRate ? `Market rate: ₹${marketRate}. Click to re-sync.` : "Sync live USD/INR exchange rate"}
                >
                  <RefreshCw className={`w-3 h-3 ${isSyncingRate ? 'animate-spin text-emerald-400' : ''}`} />
                </button>
              </div>

              {/* Live Forex sync status pill */}
              {marketRate && (
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono text-emerald-400/90 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-lg shrink-0">
                  Live: ₹{marketRate}
                </span>
              )}
            </div>
          </div>

          {/* Right Side: Quick Filters / Timeframe Presets & Refresh */}
          <div className="flex items-center gap-2 flex-wrap self-end sm:self-auto">
            {/* Quick Filters / Timeframe Presets */}
            <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800 shadow-sm shrink-0">
              {(['1d', '1w', '1m', '30d', '1y', 'all', 'custom'] as const).map(preset => {
                const labelMap: Record<string, string> = {
                  '1d': '1D',
                  '1w': '1W',
                  '1m': '1M',
                  '30d': '30D',
                  '1y': '1Y',
                  'all': 'All',
                  'custom': 'Custom'
                };
                const titleMap: Record<string, string> = {
                  '1d': 'Running Day (24h)',
                  '1w': 'Running Week (7d)',
                  '1m': 'Month to Date (30d)',
                  '30d': 'Last 30 Days',
                  '1y': 'Running Year Endured',
                  'all': 'All Time',
                  'custom': 'Custom Period'
                };
                const isActive = timeFilter === preset;
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setTimeFilter(preset)}
                    title={titleMap[preset]}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      isActive
                        ? `${activeBgClass} text-white shadow-md shadow-slate-950/50`
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    {labelMap[preset]}
                  </button>
                );
              })}
            </div>

            {/* Refresh billing trigger */}
            <button
              type="button"
              onClick={() => setBillingRefreshKey(k => k + 1)}
              disabled={loadingBilling || loadingModalLogs}
              className="p-2 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer disabled:opacity-50 shrink-0"
              title="Refresh Live API Billing Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingBilling || loadingModalLogs ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Custom Date Pickers */}
        {timeFilter === 'custom' && (
          <div className="flex flex-wrap items-center justify-end gap-2 bg-slate-900/90 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 shadow-lg animate-fadeIn self-end">
            <div className="flex items-center gap-1 text-slate-400">
              <Calendar className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span className="text-[10px] font-semibold uppercase tracking-wider">Custom Range:</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-500 uppercase font-bold">From</span>
              <input
                type="datetime-local"
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
                onClick={e => (e.target as any).showPicker?.()}
                style={{ colorScheme: 'dark' }}
                className="bg-slate-950 border border-slate-700/80 hover:border-sky-500 rounded-lg px-2 py-1 text-white text-[11px] outline-none focus:border-sky-500 cursor-pointer font-mono"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-500 uppercase font-bold">To</span>
              <input
                type="datetime-local"
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
                onClick={e => (e.target as any).showPicker?.()}
                style={{ colorScheme: 'dark' }}
                className="bg-slate-950 border border-slate-700/80 hover:border-sky-500 rounded-lg px-2 py-1 text-white text-[11px] outline-none focus:border-sky-500 cursor-pointer font-mono"
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  // Navigation Subtabs with dedicated SVGs
  const tabs = [
    {
      id: 'total',
      label: 'Consolidated Upkeep',
      type: 'icon',
      icon: DollarSign,
      activeColor: 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 border-indigo-500/40',
      tagColor: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20'
    },
    {
      id: 'supabase',
      label: 'Supabase DB',
      type: 'supabase',
      activeColor: 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 border-emerald-500/40',
      tagColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
    },
    {
      id: 'backblaze',
      label: 'Backblaze B2',
      type: 'backblaze',
      activeColor: 'bg-sky-600 text-white shadow-lg shadow-sky-600/20 border-sky-500/40',
      tagColor: 'text-sky-400 bg-sky-500/10 border-sky-500/20'
    },
    {
      id: 'cloudflare',
      label: 'Cloudflare Edge',
      type: 'cloudflare',
      activeColor: 'bg-amber-600 text-white shadow-lg shadow-amber-600/20 border-amber-500/40',
      tagColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20'
    },
    {
      id: 'modal',
      label: 'Modal.com AI',
      type: 'modal',
      activeColor: 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 border-emerald-500/40',
      tagColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
    },
    {
      id: 'railway',
      label: 'Railway App',
      type: 'railway',
      activeColor: 'bg-fuchsia-600 text-white shadow-lg shadow-fuchsia-600/20 border-fuchsia-500/40',
      tagColor: 'text-fuchsia-400 bg-fuchsia-500/10 border-fuchsia-500/20'
    },
  ];

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Page Title & Status Banner */}
      <div className="rounded-3xl border border-slate-800/80 bg-gradient-to-b from-[#111827] to-[#0c1322] p-6 sm:p-7 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 shadow-inner">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white tracking-tight">Infrastructure Cost Hub</h2>
            <p className="text-slate-400 text-xs mt-1">
              Enterprise financial ledger, live API billing sync, unit economics, and simulated scaling models.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs font-mono text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-3.5 py-1.5 rounded-xl shadow-sm">
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
            <span>{timeframeLabel}</span>
          </div>
        </div>
      </div>

      {/* Modern Capsule Navigation Switcher with Dedicated SVGs */}
      <div className="flex items-center gap-1.5 bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800 shadow-lg overflow-x-auto max-w-full">
        {tabs.map(tab => {
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer whitespace-nowrap border ${
                isActive
                  ? `${tab.activeColor} border-transparent`
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60 border-transparent'
              }`}
            >
              {tab.type === 'supabase' ? (
                <SupabaseLogo className="h-4 w-4 shrink-0" />
              ) : tab.type === 'backblaze' ? (
                <BackblazeIcon className="h-4 w-auto shrink-0" />
              ) : tab.type === 'cloudflare' ? (
                <CloudflareLogo className="h-3.5 w-auto shrink-0" />
              ) : tab.type === 'modal' ? (
                <ModalLogo className="h-3.5 w-auto shrink-0" />
              ) : tab.type === 'railway' ? (
                <RailwayLogo className={`h-3.5 w-auto shrink-0 ${isActive ? 'text-white' : 'text-fuchsia-400'}`} />
              ) : (
                <DollarSign className="w-4 h-4 shrink-0" />
              )}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── TAB PANEL 1: CONSOLIDATED TOTAL COST OVERVIEW ── */}
      {activeSubTab === 'total' && (
        <div className="space-y-6">
          {renderFilterBar('bg-indigo-600', 'text-indigo-400', 'border-indigo-500/20')}

          {/* 4 Executive KPI Metric Cards (UserDetailPage Aesthetics) */}
          <div className="rounded-3xl border border-slate-800/80 bg-gradient-to-b from-[#111827] to-[#0c1322] p-6 sm:p-7 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                  <IndianRupee className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Consolidated Upkeep Ledger</h3>
                  <p className="text-[11px] text-slate-500">Global cloud bill across object storage, serverless AI, edge CDN, and app nodes</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-xs font-mono text-sky-300 bg-sky-500/10 border border-sky-500/20 px-3.5 py-1.5 rounded-xl shrink-0 shadow-sm self-start sm:self-auto">
                <Clock className="w-3.5 h-3.5 text-sky-400" />
                <span>
                  {timeframeLabel} {timeframeSuffix ? `(${timeframeSuffix})` : ''}
                </span>
              </div>
            </div>

            {/* 4 Executive KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-1">
              {/* Card 1: Actual Consolidated Upkeep */}
              <div className="rounded-2xl border border-indigo-500/30 bg-indigo-950/20 p-4 transition-all hover:border-indigo-500/50 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block mb-1">
                    Actual Consolidated Upkeep
                  </span>
                  <div className="text-2xl font-black text-indigo-200 font-mono">
                    {fmtCost(timeframeTotalActualCostUsd)}
                  </div>
                  <span className="text-xs font-mono text-slate-400 mt-0.5 block">
                    {fmtSub(timeframeTotalActualCostUsd, timeframeSuffix)}
                  </span>
                </div>

                <div className="mt-3 pt-2.5 border-t border-indigo-500/20 space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <BackblazeIcon className="h-3 w-auto" />
                      Backblaze B2:
                    </span>
                    <span className="font-mono text-slate-200 font-medium">{fmtCost(timeframeActualB2Cost)}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <ModalLogo className="h-2.5 w-auto" />
                      Modal AI Compute:
                    </span>
                    <span className="font-mono text-slate-200 font-medium">
                      {currency === 'USD' ? `$${timeframeActualModalCostUsd.toFixed(2)}` : `₹${timeframeActualModalCostInr.toFixed(2)}`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <SupabaseLogo className="h-3 w-auto" />
                      Supabase DB:
                    </span>
                    <span className="font-mono text-slate-200 font-medium">{fmtCost(timeframeSupabaseCost)}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <RailwayLogo className="h-2.5 w-auto text-fuchsia-400" />
                      Railway + Cloudflare:
                    </span>
                    <span className="font-mono text-slate-200 font-medium">{fmtCost(timeframeActualRailwayCost + timeframeActualCloudflareCost)}</span>
                  </div>
                </div>
              </div>

              {/* Card 2: Object Storage Footprint */}
              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 transition-all hover:border-slate-700/80 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wider block mb-1">
                    Object Storage Footprint
                  </span>
                  <div className="text-2xl font-black text-white font-mono">
                    {actualB2StorageDecimalGB >= 1000
                      ? `${(actualB2StorageDecimalGB / 1000).toFixed(2)} TB`
                      : `${actualB2StorageDecimalGB.toFixed(2)} GB`}
                  </div>
                  <span className="text-xs font-mono text-slate-400 mt-0.5 block">
                    {formatDecimalSize(actualB2StorageBytes)} in B2 Bucket
                  </span>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-800 space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <HardDrive className="w-3 h-3 text-sky-400 shrink-0" />
                      Active Files:
                    </span>
                    <span className="font-mono text-slate-200 font-medium">{formatNumber(typeof liveB2Usage?.fileCount === 'number' ? liveB2Usage.fileCount : photos.length)}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                      Free Tier:
                    </span>
                    <span className="font-mono text-emerald-300 font-medium">First 10 GB Free</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <Cloud className="w-3 h-3 text-sky-400 shrink-0" />
                      Egress Fee:
                    </span>
                    <span className="font-mono text-emerald-400 font-medium">₹0.00 (Free Alliance)</span>
                  </div>
                </div>
              </div>

              {/* Card 3: Modal AI Execution Compute */}
              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 transition-all hover:border-slate-700/80 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block mb-1">
                    Modal.com AI Compute
                  </span>
                  <div className="text-2xl font-black text-white font-mono">
                    ₹{timeframeActualModalCostInr.toFixed(2)}
                  </div>
                  <span className="text-xs font-mono text-slate-400 mt-0.5 block">
                    ${timeframeActualModalCostUsd.toFixed(4)} USD ({modalLogs.length} runs)
                  </span>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-800 space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <ImageIcon className="w-3 h-3 text-emerald-400 shrink-0" />
                      Photos Processed:
                    </span>
                    <span className="font-mono text-slate-200 font-medium">{modalStats.photosCount}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <Video className="w-3 h-3 text-purple-400 shrink-0" />
                      Videos Transcoded:
                    </span>
                    <span className="font-mono text-slate-200 font-medium">{modalStats.videosCount} ({modalStats.videoGpuCount} L4 GPU)</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <Sparkles className="w-3 h-3 text-pink-400 shrink-0" />
                      Faces Indexed:
                    </span>
                    <span className="font-mono text-slate-200 font-medium">{modalStats.totalFaces} vectors</span>
                  </div>
                </div>
              </div>

              {/* Card 4: App Server & Edge CDN */}
              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 transition-all hover:border-slate-700/80 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-fuchsia-400 uppercase tracking-wider block mb-1">
                    App Server & Edge CDN
                  </span>
                  <div className="text-2xl font-black text-white font-mono">
                    {fmtCost((actualRailwayCost + actualCloudflareCost) * timeframeFactor)}
                  </div>
                  <span className="text-xs font-mono text-slate-400 mt-0.5 block">
                    {fmtSub((actualRailwayCost + actualCloudflareCost) * timeframeFactor, timeframeSuffix)}
                  </span>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-800 space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <RailwayLogo className="h-2.5 w-auto text-fuchsia-400" />
                      Railway Server:
                    </span>
                    <span className="font-mono text-slate-200 font-medium">{fmtCost(actualRailwayCost * timeframeFactor)}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <CloudflareLogo className="h-2.5 w-auto" />
                      Cloudflare Edge:
                    </span>
                    <span className="font-mono text-slate-200 font-medium">{fmtCost(actualCloudflareCost * timeframeFactor)}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <Activity className="w-3 h-3 text-emerald-400 shrink-0" />
                      Infrastructure Health:
                    </span>
                    <span className="font-mono text-emerald-400 font-medium">100% Online</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Cost Allocation Donut Chart & Provider Matrix Cards */}
          <div className="rounded-3xl border border-slate-800/80 bg-gradient-to-b from-[#111827] to-[#0c1322] p-6 sm:p-7 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
              <div>
                <h4 className="text-base font-bold text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-indigo-400" />
                  <span>Cost Allocation Distribution</span>
                </h4>
                <p className="text-slate-400 text-xs mt-0.5">
                  Visual breakdown of operational expenses across cloud nodes for {timeframeLabel.toLowerCase()}.
                </p>
              </div>

              {/* View Mode Toggle: Actual vs Simulated */}
              <div className="flex bg-slate-900/90 border border-slate-800 rounded-xl p-1 text-xs shrink-0 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setCostChartMode('actual')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                    costChartMode === 'actual'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Actual Live (${timeframeTotalActualCostUsd.toFixed(4)})
                </button>
                <button
                  type="button"
                  onClick={() => setCostChartMode('simulated')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                    costChartMode === 'simulated'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Simulated Scaling (${timeframeTotalSimulatedCostUsd.toFixed(4)})
                </button>
              </div>
            </div>

            {(() => {
              const currentTotal = costChartMode === 'actual' ? timeframeTotalActualCostUsd : timeframeTotalSimulatedCostUsd;
              const currentB2Cost = costChartMode === 'actual' ? timeframeActualB2Cost : timeframeSimulatedB2Cost;
              const currentCloudflareCost = costChartMode === 'actual' ? timeframeActualCloudflareCost : timeframeSimulatedCloudflareCost;
              const currentSupabaseCost = timeframeSupabaseCost;
              const currentModalCost = timeframeActualModalCostUsd;
              const currentRailwayCost = costChartMode === 'actual' ? timeframeActualRailwayCost : timeframeSimulatedRailwayCost;

              return currentTotal > 0 ? (
                <div className="flex flex-col lg:flex-row items-center justify-between gap-8 pt-2">
                  {/* Donut Chart SVG */}
                  <div className="relative flex items-center justify-center shrink-0 w-64 h-64">
                    <svg className="w-full h-full transform -rotate-90 drop-shadow-lg" viewBox="0 0 180 180">
                      <circle
                        cx="90"
                        cy="90"
                        r="70"
                        fill="transparent"
                        stroke="#1e293b"
                        strokeWidth="18"
                      />
                      {(() => {
                        const items = [
                          { label: 'Supabase DB', cost: currentSupabaseCost, color: '#10b981' },
                          { label: 'Backblaze B2', cost: currentB2Cost, color: '#0ea5e9' },
                          { label: 'Cloudflare Edge', cost: currentCloudflareCost, color: '#f59e0b' },
                          { label: 'Modal.com AI', cost: currentModalCost, color: '#6366f1' },
                          { label: 'Railway App', cost: currentRailwayCost, color: '#d946ef' },
                        ];
                        const circumference = 2 * Math.PI * 70;
                        let accumulatedPercent = 0;

                        return items.map((item, idx) => {
                          if (item.cost <= 0) return null;
                          const percentage = (item.cost / currentTotal) * 100;
                          const strokeDasharray = `${(percentage / 100) * circumference} ${circumference}`;
                          const strokeDashoffset = -((accumulatedPercent / 100) * circumference);
                          accumulatedPercent += percentage;

                          return (
                            <circle
                              key={idx}
                              cx="90"
                              cy="90"
                              r="70"
                              fill="transparent"
                              stroke={item.color}
                              strokeWidth="20"
                              strokeDasharray={strokeDasharray}
                              strokeDashoffset={strokeDashoffset}
                              className="transition-all duration-300 hover:opacity-80 cursor-pointer"
                            >
                              <title>{`${item.label}: $${item.cost.toFixed(4)} (${percentage.toFixed(1)}%)`}</title>
                            </circle>
                          );
                        });
                      })()}
                    </svg>

                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {costChartMode === 'actual' ? 'Actual Upkeep' : 'Simulated Upkeep'}
                      </span>
                      <span className="text-2xl font-black text-white mt-0.5 font-mono">
                        {fmtCost(currentTotal, 4)}
                      </span>
                      <span className="text-xs font-black text-emerald-400 mt-0.5 font-mono">
                        {fmtSub(currentTotal, timeframeSuffix)}
                      </span>
                    </div>
                  </div>

                  {/* Provider Breakdown Cards Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 flex-1 w-full">
                    {/* Supabase DB */}
                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/10 p-4 transition-all hover:border-emerald-500/40">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <SupabaseLogo className="h-4 w-4 shrink-0" />
                          <p className="text-xs font-bold text-white truncate">Supabase DB</p>
                        </div>
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                          {((currentSupabaseCost / currentTotal) * 100).toFixed(1)}%
                        </span>
                      </div>
                      <p className="text-xl font-black text-white mt-2 font-mono">
                        {fmtCost(currentSupabaseCost, 2)}
                      </p>
                      <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                        {fmtSub(currentSupabaseCost, timeframeSuffix)}
                      </p>
                      <button
                        onClick={() => setActiveSubTab('supabase')}
                        className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold mt-2 inline-flex items-center gap-1 cursor-pointer"
                      >
                        Inspect DB limits &rarr;
                      </button>
                    </div>

                    {/* Backblaze B2 */}
                    <div className="rounded-2xl border border-sky-500/20 bg-sky-950/10 p-4 transition-all hover:border-sky-500/40">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <BackblazeIcon className="h-4 w-auto shrink-0" />
                          <p className="text-xs font-bold text-white truncate">Backblaze B2</p>
                        </div>
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400">
                          {((currentB2Cost / currentTotal) * 100).toFixed(1)}%
                        </span>
                      </div>
                      <p className="text-xl font-black text-white mt-2 font-mono">
                        {fmtCost(currentB2Cost, 2)}
                      </p>
                      <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                        {fmtSub(currentB2Cost, `${timeframeSuffix} (10GB Free)`)}
                      </p>
                      <button
                        onClick={() => setActiveSubTab('backblaze')}
                        className="text-[10px] text-sky-400 hover:text-sky-300 font-bold mt-2 inline-flex items-center gap-1 cursor-pointer"
                      >
                        Storage simulation &rarr;
                      </button>
                    </div>

                    {/* Cloudflare Edge */}
                    <div className="rounded-2xl border border-amber-500/20 bg-amber-950/10 p-4 transition-all hover:border-amber-500/40">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <CloudflareLogo className="h-3 w-auto shrink-0" />
                          <p className="text-xs font-bold text-white truncate">Cloudflare Edge</p>
                        </div>
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400">
                          {((currentCloudflareCost / currentTotal) * 100).toFixed(1)}%
                        </span>
                      </div>
                      <p className="text-xl font-black text-white mt-2 font-mono">
                        {fmtCost(currentCloudflareCost, 2)}
                      </p>
                      <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                        {fmtSub(currentCloudflareCost, `${timeframeSuffix} (Free Egress)`)}
                      </p>
                      <button
                        onClick={() => setActiveSubTab('cloudflare')}
                        className="text-[10px] text-amber-400 hover:text-amber-300 font-bold mt-2 inline-flex items-center gap-1 cursor-pointer"
                      >
                        Workers simulation &rarr;
                      </button>
                    </div>

                    {/* Modal.com AI */}
                    <div className="rounded-2xl border border-indigo-500/20 bg-indigo-950/10 p-4 transition-all hover:border-indigo-500/40">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <ModalLogo className="h-3.5 w-auto shrink-0" />
                          <p className="text-xs font-bold text-white truncate">Modal.com AI</p>
                        </div>
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                          {((currentModalCost / currentTotal) * 100).toFixed(1)}%
                        </span>
                      </div>
                      <p className="text-xl font-black text-white mt-2 font-mono">
                        {fmtCost(currentModalCost, 2)}
                      </p>
                      <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                        {fmtSub(currentModalCost, `(${modalLogs.length} runs)`)}
                      </p>
                      <button
                        onClick={() => setActiveSubTab('modal')}
                        className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold mt-2 inline-flex items-center gap-1 cursor-pointer"
                      >
                        Compute logs &rarr;
                      </button>
                    </div>

                    {/* Railway App */}
                    <div className="rounded-2xl border border-fuchsia-500/20 bg-fuchsia-950/10 p-4 transition-all hover:border-fuchsia-500/40">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <RailwayLogo className="h-3 w-auto text-fuchsia-400" />
                          <p className="text-xs font-bold text-white truncate">Railway App</p>
                        </div>
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-400">
                          {((currentRailwayCost / currentTotal) * 100).toFixed(1)}%
                        </span>
                      </div>
                      <p className="text-xl font-black text-white mt-2 font-mono">
                        {fmtCost(currentRailwayCost, 2)}
                      </p>
                      <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                        {fmtSub(currentRailwayCost, timeframeSuffix)}
                      </p>
                      <button
                        onClick={() => setActiveSubTab('railway')}
                        className="text-[10px] text-fuchsia-400 hover:text-fuchsia-300 font-bold mt-2 inline-flex items-center gap-1 cursor-pointer"
                      >
                        Server allocation &rarr;
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500 text-xs">
                  No active platform expenses recorded in this period.
                </div>
              );
            })()}
          </div>

          {/* Consolidated Infrastructure Ledger Matrix (UserDetailPage Style) */}
          <div className="rounded-3xl border border-slate-800/80 bg-gradient-to-b from-[#111827] to-[#0c1322] p-6 sm:p-7 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
              <div>
                <h4 className="text-base font-bold text-white flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-indigo-400" />
                  <span>Consolidated Infrastructure Ledger Matrix</span>
                </h4>
                <p className="text-slate-400 text-xs mt-0.5">
                  Detailed comparative matrix across cloud tiers, active utilization, and annual upkeep projections.
                </p>
              </div>

              <span className="text-xs font-mono font-bold text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1.5 rounded-full self-start sm:self-auto">
                Total Upkeep: ₹{timeframeTotalActualCostInr.toFixed(2)}
              </span>
            </div>

            <div className="rounded-2xl border border-slate-800/80 overflow-hidden bg-slate-950/40">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-400">
                  <thead className="bg-slate-950/90 text-slate-400 uppercase tracking-wider border-b border-slate-800 text-[10px]">
                    <tr className="divide-x divide-slate-800">
                      <th className="py-3 px-4 font-bold whitespace-nowrap">Cloud Node Provider</th>
                      <th className="py-3 px-4 font-bold whitespace-nowrap">Included Baseline & Quota</th>
                      <th className="py-3 px-4 text-right font-bold whitespace-nowrap">Cost ({timeframeLabel})</th>
                      <th className="py-3 px-4 text-right font-bold whitespace-nowrap">Simulated Cost</th>
                      <th className="py-3 px-4 text-right font-bold whitespace-nowrap">Projected Year</th>
                      <th className="py-3 px-4 font-bold whitespace-nowrap">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {/* Supabase Row */}
                    <tr className="divide-x divide-slate-800 hover:bg-slate-900/40 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-white whitespace-nowrap flex items-center gap-2.5">
                        <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                          <SupabaseLogo className="h-4 w-4" />
                        </div>
                        <div>
                          <span>Supabase</span>
                          <span className="block text-[10px] text-slate-500 font-normal">Postgres 15 & Auth GoTrue</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="text-slate-300 font-medium">
                          {liveBillingTier ? `Live: ${liveBillingTier.toUpperCase()}` : `Config: ${supabaseTier.toUpperCase()}`} Plan
                        </span>
                        <span className="block text-[10px] text-slate-500 mt-0.5">{supabaseTier === 'free' ? '500MB DB · 50k MAUs' : '8GB DB · 100k MAUs'}</span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                        <span className="text-emerald-400 font-bold block">₹{(timeframeSupabaseCost * usdToInrRate).toFixed(2)}</span>
                        <span className="text-[10px] text-slate-500 block">${timeframeSupabaseCost.toFixed(2)}</span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums whitespace-nowrap text-slate-400">
                        ₹{(timeframeSupabaseCost * usdToInrRate).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums whitespace-nowrap text-slate-350">
                        ₹{((supabaseTierCost * 12) * usdToInrRate).toFixed(2)} / yr
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {liveBillingTier ? (
                          <span className="px-2 py-0.5 text-[9px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full inline-flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" /> Live Sync
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-[9px] font-semibold bg-slate-800 text-slate-400 rounded-full">
                            Configured
                          </span>
                        )}
                      </td>
                    </tr>

                    {/* Backblaze B2 Row */}
                    <tr className="divide-x divide-slate-800 hover:bg-slate-900/40 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-white whitespace-nowrap flex items-center gap-2.5">
                        <div className="p-1.5 rounded-lg bg-sky-500/10 border border-sky-500/20">
                          <BackblazeIcon className="h-4 w-auto" />
                        </div>
                        <div>
                          <span>Backblaze B2</span>
                          <span className="block text-[10px] text-slate-500 font-normal">S3 Cloud Object Storage</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="text-slate-300 font-medium">10 GB Free Storage</span>
                        <span className="block text-[10px] text-slate-500 mt-0.5">75k Class B/C APIs free/mo</span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                        <span className="text-sky-300 font-bold block">₹{(timeframeActualB2Cost * usdToInrRate).toFixed(2)}</span>
                        <span className="text-[10px] text-slate-500 block">${timeframeActualB2Cost.toFixed(4)}</span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums whitespace-nowrap text-slate-400">
                        ₹{(timeframeSimulatedB2Cost * usdToInrRate).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums whitespace-nowrap text-slate-350">
                        ₹{(b2StorageCostYear * usdToInrRate).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {liveB2Bytes !== null ? (
                          <span className="px-2 py-0.5 text-[9px] font-bold bg-sky-500/10 border border-sky-500/20 text-sky-400 rounded-full inline-flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" /> Live Bucket
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-[9px] font-semibold bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full">
                            DB Fallback
                          </span>
                        )}
                      </td>
                    </tr>

                    {/* Cloudflare Edge Row */}
                    <tr className="divide-x divide-slate-800 hover:bg-slate-900/40 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-white whitespace-nowrap flex items-center gap-2.5">
                        <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                          <CloudflareLogo className="h-3 w-auto" />
                        </div>
                        <div>
                          <span>Cloudflare Edge</span>
                          <span className="block text-[10px] text-slate-500 font-normal">CDN, DNS & Serverless</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="text-slate-300 font-medium">Free DNS & Bandwidth Alliance</span>
                        <span className="block text-[10px] text-slate-500 mt-0.5">100k Workers req/day Free</span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                        <span className="text-amber-300 font-bold block">₹{(timeframeActualCloudflareCost * usdToInrRate).toFixed(2)}</span>
                        <span className="text-[10px] text-slate-500 block">${timeframeActualCloudflareCost.toFixed(2)}</span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums whitespace-nowrap text-slate-400">
                        ₹{(timeframeSimulatedCloudflareCost * usdToInrRate).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums whitespace-nowrap text-slate-350">
                        ₹{((actualCloudflareCost * 12) * usdToInrRate).toFixed(2)} / yr
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {liveCfPlan ? (
                          <span className="px-2 py-0.5 text-[9px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full inline-flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" /> Live API
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-[9px] font-semibold bg-slate-800 text-slate-400 rounded-full">
                            Free Zone
                          </span>
                        )}
                      </td>
                    </tr>

                    {/* Modal.com AI Row */}
                    <tr className="divide-x divide-slate-800 hover:bg-slate-900/40 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-white whitespace-nowrap flex items-center gap-2.5">
                        <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                          <ModalLogo className="h-3.5 w-auto" />
                        </div>
                        <div>
                          <span>Modal.com AI</span>
                          <span className="block text-[10px] text-slate-500 font-normal">Face Vectors & Video GPU</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="text-slate-300 font-medium">$30 (₹3,000)/mo Free Tier</span>
                        <span className="block text-[10px] text-slate-500 mt-0.5">Per-second compute metering</span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                        <span className="text-indigo-300 font-bold block">₹{timeframeActualModalCostInr.toFixed(2)}</span>
                        <span className="text-[10px] text-slate-500 block">${timeframeActualModalCostUsd.toFixed(4)}</span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums whitespace-nowrap text-slate-400">
                        ₹{timeframeActualModalCostInr.toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums whitespace-nowrap text-slate-350">
                        ₹{projectedYearModalInr.toFixed(2)} / yr
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="px-2 py-0.5 text-[9px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full inline-flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" /> Live Compute
                        </span>
                      </td>
                    </tr>

                    {/* Railway App Row */}
                    <tr className="divide-x divide-slate-800 hover:bg-slate-900/40 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-white whitespace-nowrap flex items-center gap-2.5">
                        <div className="p-1.5 rounded-lg bg-fuchsia-500/10 border border-fuchsia-500/20">
                          <RailwayLogo className="h-3.5 w-auto text-fuchsia-400" />
                        </div>
                        <div>
                          <span>Railway App Server</span>
                          <span className="block text-[10px] text-slate-500 font-normal">Next.js Edge Runtime Container</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="text-slate-300 font-medium">Billed per second (CPU/RAM)</span>
                        <span className="block text-[10px] text-slate-500 mt-0.5">{simulatedRailwayRAM}GB RAM · {simulatedRailwayCPU}vCPU</span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                        <span className="text-fuchsia-300 font-bold block">₹{(timeframeActualRailwayCost * usdToInrRate).toFixed(2)}</span>
                        <span className="text-[10px] text-slate-500 block">${timeframeActualRailwayCost.toFixed(2)}</span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums whitespace-nowrap text-slate-400">
                        ₹{(timeframeSimulatedRailwayCost * usdToInrRate).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums whitespace-nowrap text-slate-350">
                        ₹{((actualRailwayCost * 12) * usdToInrRate).toFixed(2)} / yr
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {hasLiveRailway ? (
                          <span className="px-2 py-0.5 text-[9px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full inline-flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" /> Live GraphQL
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-[9px] font-semibold bg-slate-800 text-slate-400 rounded-full">
                            Simulated
                          </span>
                        )}
                      </td>
                    </tr>

                    {/* Consolidated Row */}
                    <tr className="divide-x divide-slate-800 bg-indigo-950/20 font-black border-t-2 border-indigo-500/30">
                      <td className="py-4 px-4 text-white uppercase tracking-wider text-xs whitespace-nowrap">
                        Consolidated Platform Upkeep
                      </td>
                      <td className="py-4 px-4 text-indigo-300 whitespace-nowrap font-medium text-xs">
                        All Cloud Nodes Aggregated
                      </td>
                      <td className="py-4 px-4 text-right font-mono tabular-nums whitespace-nowrap bg-indigo-950/40">
                        <span className="text-base font-black text-indigo-200 block">₹{timeframeTotalActualCostInr.toFixed(2)}</span>
                        <span className="text-[11px] font-medium text-slate-400 block">${timeframeTotalActualCostUsd.toFixed(4)}</span>
                      </td>
                      <td className="py-4 px-4 text-right font-mono tabular-nums whitespace-nowrap text-slate-200 font-bold text-xs">
                        ₹{timeframeTotalSimulatedCostInr.toFixed(2)}
                      </td>
                      <td className="py-4 px-4 text-right font-mono tabular-nums whitespace-nowrap text-indigo-300 font-black text-xs">
                        ₹{projectedYearTotalInr.toFixed(2)} / yr
                      </td>
                      <td className="py-4 px-4 whitespace-nowrap">
                        <span className="px-2.5 py-1 text-[10px] font-black bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 rounded-full">
                          Aggregated
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB PANEL 2: SUPABASE DETAIL ── */}
      {activeSubTab === 'supabase' && (
        <div className="space-y-6">
          {renderFilterBar('bg-emerald-600', 'text-emerald-400', 'border-emerald-500/20')}

          {/* Header & Executive Cards Container */}
          <div className="rounded-3xl border border-slate-800/80 bg-gradient-to-b from-[#111827] to-[#0c1322] p-6 sm:p-7 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <SupabaseLogo className="h-5 w-auto" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Supabase PostgreSQL & Auth Matrix</h3>
                  <p className="text-[11px] text-slate-500">Database rows, active sessions, index footprint, and storage allocations</p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                <span className="text-xs font-mono font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl">
                  {liveBillingTier ? `Live API: ${liveBillingTier.toUpperCase()}` : `Config: ${supabaseTier.toUpperCase()} Plan`}
                </span>
              </div>
            </div>

            {/* 4 Executive KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-1">
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-4 transition-all hover:border-emerald-500/50 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block mb-1">
                    Supabase Cost ({timeframeLabel})
                  </span>
                  <div className="text-2xl font-black text-emerald-200 font-mono">
                    ₹{((supabaseTierCost * timeframeFactor) * usdToInrRate).toFixed(2)}
                  </div>
                  <span className="text-xs font-mono text-slate-400 mt-0.5 block">
                    ${(supabaseTierCost * timeframeFactor).toFixed(2)} USD {timeframeSuffix}
                  </span>
                </div>
                <div className="mt-3 pt-2.5 border-t border-emerald-500/20 space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="text-slate-400">Compute Base:</span>
                    <span className="font-mono text-slate-200 font-medium">${supabaseComputeCostMonth.toFixed(2)}/mo</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="text-slate-400">Storage Overage:</span>
                    <span className="font-mono text-slate-200 font-medium">${supabaseDbCostMonth.toFixed(2)}/mo</span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 transition-all hover:border-slate-700/80 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Database Storage Size
                  </span>
                  <div className="text-2xl font-black text-white font-mono">
                    {formatSize(dbStats.estimatedSizeBytes)}
                  </div>
                  <span className="text-xs font-mono text-slate-400 mt-0.5 block">
                    Quota: {supabaseTier === 'free' ? '500 MB Free' : '8 GB Included'}
                  </span>
                </div>
                <div className="mt-3 pt-2.5 border-t border-slate-800 space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="text-slate-400">Aggregate DB Rows:</span>
                    <span className="font-mono text-slate-200 font-medium">{formatNumber(dbStats.totalRows)}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="text-slate-400">Capacity Utilized:</span>
                    <span className="font-mono text-emerald-400 font-medium">
                      {((dbStats.estimatedSizeBytes / ((supabaseTier === 'free' ? 500 : 8192) * 1024 * 1024)) * 100).toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 transition-all hover:border-slate-700/80 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Monthly Active Users (MAU)
                  </span>
                  <div className="text-2xl font-black text-white font-mono">
                    {formatNumber(stats?.mau || users.length)}
                  </div>
                  <span className="text-xs font-mono text-slate-400 mt-0.5 block">
                    Allowance: {supabaseTier === 'free' ? '50,000 MAUs' : '100,000 MAUs'}
                  </span>
                </div>
                <div className="mt-3 pt-2.5 border-t border-slate-800 space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="text-slate-400">Total Users Registered:</span>
                    <span className="font-mono text-slate-200 font-medium">{formatNumber(users.length)}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="text-slate-400">MAU Overage:</span>
                    <span className="font-mono text-slate-200 font-medium">${supabaseMauCostMonth.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 transition-all hover:border-slate-700/80 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Data Bandwidth Egress
                  </span>
                  <div className="text-2xl font-black text-emerald-400 font-mono">
                    $0.00
                  </div>
                  <span className="text-xs font-mono text-slate-400 mt-0.5 block">
                    Cloudflare Bandwidth Alliance Bypass
                  </span>
                </div>
                <div className="mt-3 pt-2.5 border-t border-slate-800 space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="text-slate-400">Media Downloads:</span>
                    <span className="font-mono text-emerald-300 font-medium">100% Routed via CF</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="text-slate-400">API Egress Overage:</span>
                    <span className="font-mono text-slate-200 font-medium">$0.00</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Database rows breakdown */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
              <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-3 text-center">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">User Profiles</p>
                <h4 className="text-lg font-black text-white mt-1 font-mono">{formatNumber(dbStats.profilesCount)}</h4>
              </div>
              <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-3 text-center">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Events Catalog</p>
                <h4 className="text-lg font-black text-white mt-1 font-mono">{formatNumber(dbStats.eventsCount)}</h4>
              </div>
              <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-3 text-center">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Guest Logs</p>
                <h4 className="text-lg font-black text-white mt-1 font-mono">{formatNumber(dbStats.guestsCount)}</h4>
              </div>
              <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-3 text-center">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Media Metadata</p>
                <h4 className="text-lg font-black text-white mt-1 font-mono">{formatNumber(dbStats.photosCount)}</h4>
              </div>
              <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-2xl p-3 text-center col-span-2 sm:col-span-1">
                <p className="text-[10px] text-emerald-400 uppercase tracking-wider font-black">Total DB Rows</p>
                <h4 className="text-lg font-black text-emerald-400 mt-1 font-mono">{formatNumber(dbStats.totalRows)}</h4>
              </div>
            </div>
          </div>

          {/* Database Footprint & Plan Configuration */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="rounded-3xl border border-slate-800/80 bg-gradient-to-b from-[#111827] to-[#0c1322] p-6 shadow-xl lg:col-span-2 space-y-6">
              <div>
                <h4 className="text-base font-bold text-white flex items-center gap-2">
                  <Activity className="w-5 h-5 text-emerald-400" />
                  <span>Estimated Database Storage Footprint</span>
                </h4>
                <p className="text-slate-400 text-xs mt-1">
                  Database storage allocation derived from active table rows and PostgreSQL indexing overhead.
                </p>
              </div>

              <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 space-y-4">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Calculated Footprint:</span>
                  <span className="text-white font-mono font-bold">{formatSize(dbStats.estimatedSizeBytes)}</span>
                </div>

                <div>
                  <div className="flex justify-between items-center text-[10px] mb-1.5 text-slate-400">
                    <span>Free Plan Limit: 500 MB</span>
                    <span className="text-emerald-400 font-mono font-bold">
                      {((dbStats.estimatedSizeBytes / (500 * 1024 * 1024)) * 100).toFixed(2)}% consumed
                    </span>
                  </div>
                  <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${Math.min(100, Math.max(1, (dbStats.estimatedSizeBytes / (500 * 1024 * 1024)) * 100))}%` }}
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
                    />
                  </div>
                </div>

                <div className="flex items-start space-x-2 text-[11px] text-slate-400 bg-slate-950/60 p-3 rounded-xl border border-slate-800/60">
                  <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    Calculation assumes 1.2 KB average row overhead including B-tree indexing. Project comfortably operates on Free Tier ($0/mo) up to 500,000 total rows.
                  </p>
                </div>
              </div>

              {/* Tier Toggle Buttons */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                  Select Supabase Tier Plan
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button
                    onClick={() => setSupabaseTier('free')}
                    className={`p-4 rounded-2xl border text-left cursor-pointer transition-all duration-200 ${
                      supabaseTier === 'free'
                        ? 'bg-emerald-500/10 border-emerald-500 text-white shadow-lg shadow-emerald-500/10'
                        : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <p className="text-xs font-black uppercase text-emerald-400">Free Tier</p>
                      {supabaseTier === 'free' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                    </div>
                    <p className="text-xl font-black mt-1 font-mono text-white">$0.00 <span className="text-xs font-medium text-slate-500">/ mo</span></p>
                    <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">Up to 500 MB DB storage & 50,000 MAUs. Automatically pauses after 1 week inactivity.</p>
                  </button>

                  <button
                    onClick={() => setSupabaseTier('pro')}
                    className={`p-4 rounded-2xl border text-left cursor-pointer transition-all duration-200 ${
                      supabaseTier === 'pro'
                        ? 'bg-emerald-500/10 border-emerald-500 text-white shadow-lg shadow-emerald-500/10'
                        : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <p className="text-xs font-black uppercase text-emerald-400">Pro Tier</p>
                      {supabaseTier === 'pro' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                    </div>
                    <p className="text-xl font-black mt-1 font-mono text-white">$25.00 <span className="text-xs font-medium text-slate-500">/ mo</span></p>
                    <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">Up to 8 GB DB, 100,000 MAUs. Daily automated backups, never pauses, dedicated compute.</p>
                  </button>
                </div>
              </div>
            </div>

            {/* Architecture Details Card */}
            <div className="rounded-3xl border border-slate-800/80 bg-gradient-to-b from-[#111827] to-[#0c1322] p-6 shadow-xl flex flex-col justify-between space-y-6">
              <div>
                <h4 className="text-base font-bold text-white mb-1.5 flex items-center gap-2">
                  <Server className="w-5 h-5 text-emerald-400" />
                  <span>PostgreSQL Stack</span>
                </h4>
                <p className="text-slate-400 text-xs mb-6">
                  Supabase hosts PostgreSQL and provides backend GoTrue and PostgREST API endpoints.
                </p>

                <div className="space-y-3 text-xs">
                  <div className="flex justify-between py-2 border-b border-slate-800/40">
                    <span className="text-slate-400">Database Engine</span>
                    <span className="text-white font-mono font-semibold">PostgreSQL 15</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-800/40">
                    <span className="text-slate-400">Connection Pooling</span>
                    <span className="text-emerald-400 font-mono font-semibold">PgBouncer Active</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-800/40">
                    <span className="text-slate-400">Auth Engine</span>
                    <span className="text-white font-mono font-semibold">Supabase GoTrue</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-800/40">
                    <span className="text-slate-400">REST API Endpoint</span>
                    <span className="text-white font-mono font-semibold">PostgREST v12</span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-emerald-500/5 border border-emerald-500/15 rounded-2xl">
                <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  Cost Recommendation
                </p>
                <p className="text-[11px] text-slate-300 mt-1.5 leading-relaxed">
                  With {formatNumber(dbStats.totalRows)} rows under {formatSize(dbStats.estimatedSizeBytes)}, the platform operates at $0.00/mo cost. Upgrading to Pro ($25/mo or ₹2,500/mo) is only needed once storage exceeds 500 MB or to bypass dormant auto-pausing.
                </p>
              </div>
            </div>
          </div>

          {/* Supabase Billing Units Matrix Table */}
          <div className="rounded-3xl border border-slate-800/80 bg-gradient-to-b from-[#111827] to-[#0c1322] p-6 sm:p-7 shadow-xl space-y-4">
            <h4 className="text-base font-bold text-white flex items-center gap-2">
              <SupabaseLogo className="h-4 w-4" />
              <span>Supabase Billing Units Cost Breakdown</span>
            </h4>
            <p className="text-slate-400 text-xs">
              Detailed tracking of active database utilization versus plan allowances, including actual monthly and yearly projections.
            </p>

            <div className="rounded-2xl border border-slate-800/80 overflow-hidden bg-slate-950/40">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-400">
                  <thead className="bg-slate-950/90 text-slate-400 uppercase tracking-wider border-b border-slate-800 text-[10px]">
                    <tr className="divide-x divide-slate-800">
                      <th className="py-3 px-4 font-bold whitespace-nowrap">Billing Unit</th>
                      <th className="py-3 px-4 font-bold whitespace-nowrap">Plan Limit / Allowance</th>
                      <th className="py-3 px-4 font-bold whitespace-nowrap">Actual Usage "Till Now"</th>
                      <th className="py-3 px-4 text-right font-bold whitespace-nowrap">Cost ({timeframeLabel})</th>
                      <th className="py-3 px-4 text-right font-bold whitespace-nowrap">Cost (Projected Year)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    <tr className="divide-x divide-slate-800 hover:bg-slate-900/40 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-white whitespace-nowrap">Database Storage (Size)</td>
                      <td className="py-3.5 px-4 whitespace-nowrap">{supabaseTier === 'free' ? '500 MB' : '8 GB'}</td>
                      <td className="py-3.5 px-4 font-mono whitespace-nowrap">{formatSize(dbStats.estimatedSizeBytes)}</td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-400 whitespace-nowrap">${(supabaseDbCostMonth * timeframeFactor).toFixed(2)}</td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-350 whitespace-nowrap">${supabaseDbCostYear.toFixed(2)}</td>
                    </tr>
                    <tr className="divide-x divide-slate-800 hover:bg-slate-900/40 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-white whitespace-nowrap">Monthly Active Users (MAU)</td>
                      <td className="py-3.5 px-4 whitespace-nowrap">{supabaseTier === 'free' ? '50,000 MAUs' : '100,000 MAUs'}</td>
                      <td className="py-3.5 px-4 font-mono whitespace-nowrap">{formatNumber(stats?.mau || users.length)} MAUs</td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-400 whitespace-nowrap">${(supabaseMauCostMonth * timeframeFactor).toFixed(2)}</td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-350 whitespace-nowrap">${supabaseMauCostYear.toFixed(2)}</td>
                    </tr>
                    <tr className="divide-x divide-slate-800 hover:bg-slate-900/40 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-white whitespace-nowrap">Data Egress Bandwidth</td>
                      <td className="py-3.5 px-4 whitespace-nowrap">{supabaseTier === 'free' ? '2 GB' : '50 GB'}</td>
                      <td className="py-3.5 px-4 font-mono whitespace-nowrap">~0.05 GB (CF Alliance Bypass)</td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-400 whitespace-nowrap">${(supabaseEgressCostMonth * timeframeFactor).toFixed(2)}</td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-350 whitespace-nowrap">${supabaseEgressCostYear.toFixed(2)}</td>
                    </tr>
                    <tr className="divide-x divide-slate-800 hover:bg-slate-900/40 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-white whitespace-nowrap">Compute Instance Tier</td>
                      <td className="py-3.5 px-4 whitespace-nowrap">{supabaseTier === 'free' ? 'Shared (Pauses)' : 'Dedicated Micro (Always-on)'}</td>
                      <td className="py-3.5 px-4 font-mono whitespace-nowrap">Active</td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-400 whitespace-nowrap">${(supabaseComputeCostMonth * timeframeFactor).toFixed(2)}</td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-350 whitespace-nowrap">${supabaseComputeCostYear.toFixed(2)}</td>
                    </tr>
                    <tr className="divide-x divide-slate-800 bg-emerald-950/20 font-bold border-t border-slate-800">
                      <td className="py-4 px-4 text-white uppercase text-xs whitespace-nowrap">Total Supabase Upkeep</td>
                      <td className="py-4 px-4 text-emerald-300 whitespace-nowrap">-</td>
                      <td className="py-4 px-4 whitespace-nowrap">-</td>
                      <td className="py-4 px-4 text-right font-mono text-emerald-300 font-black text-sm whitespace-nowrap">
                        ${(supabaseTierCost * timeframeFactor).toFixed(2)} {timeframeSuffix}
                      </td>
                      <td className="py-4 px-4 text-right font-mono text-slate-200 font-bold whitespace-nowrap">
                        ${(supabaseTierCost * 12).toFixed(2)} / yr
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB PANEL 3: BACKBLAZE B2 STORAGE DETAIL ── */}
      {activeSubTab === 'backblaze' && (
        <div className="space-y-6">
          {renderFilterBar('bg-sky-600', 'text-sky-400', 'border-sky-500/20')}

          {/* Header & 4 Executive Cards */}
          <div className="rounded-3xl border border-slate-800/80 bg-gradient-to-b from-[#111827] to-[#0c1322] p-6 sm:p-7 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
              <div className="flex items-center gap-3">
                <div className="p-2 px-3 rounded-2xl bg-slate-900/80 border border-slate-800/80 flex items-center justify-center">
                  <BackblazeLogo className="h-5 w-auto text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Backblaze B2 Metering Matrix</h3>
                  <p className="text-[11px] text-slate-500">Object storage, Class B/C API transactions, and Bandwidth Alliance egress</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-xs font-mono text-sky-300 bg-sky-500/10 border border-sky-500/20 px-3.5 py-1.5 rounded-xl shrink-0 self-start sm:self-auto">
                <Clock className="w-3.5 h-3.5 text-sky-400" />
                <span>Synced: {timeframeLabel}</span>
              </div>
            </div>

            {/* 4 Executive B2 Cards (matching UserDetailPage) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-1">
              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 transition-all hover:border-slate-700/80 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wider block mb-1">
                    Data Metered
                  </span>
                  <div className="text-xl font-black text-white font-mono flex items-baseline gap-2">
                    <span>{actualB2StorageDecimalGB.toFixed(2)} GB</span>
                    <span className="text-xs text-slate-500 font-sans font-normal">active</span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 mt-1 block">
                    Source: {b2StorageSource}
                  </span>
                </div>
                <div className="mt-3 pt-2.5 border-t border-slate-800 space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="text-slate-400">Total Files:</span>
                    <span className="font-mono text-slate-200 font-medium">
                      {formatNumber(typeof liveB2Usage?.fileCount === 'number' ? liveB2Usage.fileCount : photos.length)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="text-slate-400">Photos / Videos:</span>
                    <span className="font-mono text-slate-200 font-medium">
                      {formatNumber(mediaBreakdown.photoCount)} / {formatNumber(mediaBreakdown.videoCount)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 transition-all hover:border-slate-700/80 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Storage Cost ({timeframeLabel})
                  </span>
                  <div className="text-xl font-black text-sky-300 font-mono">
                    ₹{((b2StorageCostMonth * timeframeFactor) * usdToInrRate).toFixed(2)}
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 mt-1 block">
                    ${(b2StorageCostMonth * timeframeFactor).toFixed(4)} USD (@ ₹0.60/GB-mo)
                  </span>
                </div>
                <div className="mt-3 pt-2.5 border-t border-slate-800 space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="text-slate-400">Free Baseline:</span>
                    <span className="font-mono text-emerald-400 font-medium">10 GB Free</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="text-slate-400">Projected Year:</span>
                    <span className="font-mono text-slate-200 font-medium">₹{(b2StorageCostYear * usdToInrRate).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 transition-all hover:border-slate-700/80 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block mb-1">
                    API Transactions
                  </span>
                  <div className="text-xl font-black text-amber-300 font-mono">
                    ₹{(((b2ClassBCostMonth + b2ClassCCostMonth) * timeframeFactor) * usdToInrRate).toFixed(2)}
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 mt-1 block">
                    {formatNumber(b2ClassCCallsMonth)} Class C &bull; {formatNumber(b2ClassBCallsMonth)} Class B
                  </span>
                </div>
                <div className="mt-3 pt-2.5 border-t border-slate-800 space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="text-slate-400">Free Daily Quota:</span>
                    <span className="font-mono text-emerald-400 font-medium">2,500/day Free</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="text-slate-400">Overage Rate:</span>
                    <span className="font-mono text-slate-200 font-medium">₹0.40/10k B, ₹0.40/1k C</span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-sky-500/30 bg-sky-950/20 p-4 transition-all hover:border-sky-500/50 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wider block mb-1">
                    Total B2 Incurred
                  </span>
                  <div className="text-xl font-black text-sky-200 font-mono">
                    ₹{((actualB2Cost * timeframeFactor) * usdToInrRate).toFixed(2)}
                  </div>
                  <span className="text-[11px] font-mono text-slate-300 mt-1 block">
                    ${(actualB2Cost * timeframeFactor).toFixed(4)} USD {timeframeSuffix}
                  </span>
                </div>
                <div className="mt-3 pt-2.5 border-t border-sky-500/30 space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="text-slate-400">Download Egress:</span>
                    <span className="font-mono text-emerald-400 font-bold">₹0.00 (Free Alliance)</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="text-slate-400">Annual Run-rate:</span>
                    <span className="font-mono text-sky-300 font-medium">₹{(actualB2Cost * 12 * usdToInrRate).toFixed(2)}/yr</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Backblaze B2 Billing Units Matrix Table */}
          <div className="rounded-3xl border border-slate-800/80 bg-gradient-to-b from-[#111827] to-[#0c1322] p-6 sm:p-7 shadow-xl space-y-4">
            <h4 className="text-base font-bold text-white flex items-center gap-2">
              <BackblazeIcon className="h-4 w-auto" />
              <span>Backblaze B2 Billing Units Breakdown</span>
            </h4>
            <p className="text-slate-400 text-xs">
              Storage capacity tiers, Bandwidth Alliance zero-egress routing, and S3-compatible API transactions.
            </p>

            <div className="rounded-2xl border border-slate-800/80 overflow-hidden bg-slate-950/40">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-400">
                  <thead className="bg-slate-950/90 text-slate-400 uppercase tracking-wider border-b border-slate-800 text-[10px]">
                    <tr className="divide-x divide-slate-800">
                      <th className="py-3 px-4 font-bold whitespace-nowrap">Billing Unit</th>
                      <th className="py-3 px-4 font-bold whitespace-nowrap">Plan Allowance</th>
                      <th className="py-3 px-4 font-bold whitespace-nowrap">Active Usage</th>
                      <th className="py-3 px-4 text-right font-bold whitespace-nowrap">Cost ({timeframeLabel})</th>
                      <th className="py-3 px-4 text-right font-bold whitespace-nowrap">Cost (Projected Year)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    <tr className="divide-x divide-slate-800 hover:bg-slate-900/40 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-white whitespace-nowrap">Object Storage Size (GB)</td>
                      <td className="py-3.5 px-4 whitespace-nowrap">10 GB Free baseline</td>
                      <td className="py-3.5 px-4 font-mono whitespace-nowrap">{actualB2StorageDecimalGB.toFixed(3)} GB</td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-sky-400 whitespace-nowrap">
                        ₹{((b2StorageCostMonth * timeframeFactor) * usdToInrRate).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-350 whitespace-nowrap">
                        ₹{(b2StorageCostYear * usdToInrRate).toFixed(2)}
                      </td>
                    </tr>
                    <tr className="divide-x divide-slate-800 hover:bg-slate-900/40 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-white whitespace-nowrap">Egress Bandwidth (Downloads)</td>
                      <td className="py-3.5 px-4 whitespace-nowrap">Unlimited Free (Bandwidth Alliance)</td>
                      <td className="py-3.5 px-4 font-mono whitespace-nowrap">Active Edge Routing</td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-400 whitespace-nowrap">₹0.00</td>
                      <td className="py-3.5 px-4 text-right font-mono text-emerald-400 whitespace-nowrap">₹0.00</td>
                    </tr>
                    <tr className="divide-x divide-slate-800 hover:bg-slate-900/40 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-white whitespace-nowrap">Class B API Calls (Downloads)</td>
                      <td className="py-3.5 px-4 whitespace-nowrap">2,500/day Free (75,000/mo)</td>
                      <td className="py-3.5 px-4 font-mono whitespace-nowrap">{formatNumber(b2ClassBCallsMonth)} calls/mo</td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-sky-400 whitespace-nowrap">
                        ₹{((b2ClassBCostMonth * timeframeFactor) * usdToInrRate).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-350 whitespace-nowrap">
                        ₹{(b2ClassBCostYear * usdToInrRate).toFixed(2)}
                      </td>
                    </tr>
                    <tr className="divide-x divide-slate-800 hover:bg-slate-900/40 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-white whitespace-nowrap">Class C API Calls (Uploads)</td>
                      <td className="py-3.5 px-4 whitespace-nowrap">2,500/day Free (75,000/mo)</td>
                      <td className="py-3.5 px-4 font-mono whitespace-nowrap">{formatNumber(b2ClassCCallsMonth)} calls/mo</td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-sky-400 whitespace-nowrap">
                        ₹{((b2ClassCCostMonth * timeframeFactor) * usdToInrRate).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-350 whitespace-nowrap">
                        ₹{(b2ClassCCostYear * usdToInrRate).toFixed(2)}
                      </td>
                    </tr>
                    <tr className="divide-x divide-slate-800 bg-sky-950/20 font-bold border-t border-slate-800">
                      <td className="py-4 px-4 text-white uppercase text-xs whitespace-nowrap">Total Backblaze Upkeep</td>
                      <td className="py-4 px-4 text-sky-300 whitespace-nowrap">-</td>
                      <td className="py-4 px-4 whitespace-nowrap">-</td>
                      <td className="py-4 px-4 text-right font-mono text-sky-300 font-black text-sm whitespace-nowrap">
                        ₹{((actualB2Cost * timeframeFactor) * usdToInrRate).toFixed(2)}
                      </td>
                      <td className="py-4 px-4 text-right font-mono text-slate-200 font-bold whitespace-nowrap">
                        ₹{((actualB2Cost * 12) * usdToInrRate).toFixed(2)} / yr
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Backblaze Orphan Cleanup Toolkit */}
          <div className="rounded-3xl border border-slate-800/80 bg-gradient-to-b from-[#111827] to-[#0c1322] p-6 shadow-xl space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h4 className="text-base font-bold text-white flex items-center gap-2">
                  <Search className="w-5 h-5 text-sky-400" />
                  <span>Backblaze Orphan File Scanner & Garbage Collector</span>
                </h4>
                <p className="text-slate-400 text-xs mt-1 max-w-3xl leading-relaxed">
                  Safely scan the EveBash bucket for media files under <span className="font-mono text-slate-300">events/</span> and <span className="font-mono text-slate-300">profiles/</span> that no longer belong to active database rows.
                </p>
              </div>

              <div className="flex flex-wrap gap-2.5">
                <button
                  onClick={handleScanBackblazeOrphans}
                  disabled={orphanActionLoading !== null}
                  className="inline-flex items-center justify-center px-4 py-2 rounded-xl border border-sky-500/30 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20 disabled:opacity-60 disabled:cursor-not-allowed text-xs font-bold transition-all cursor-pointer"
                >
                  <Search className="w-3.5 h-3.5 mr-1.5" />
                  {orphanActionLoading === 'scan' ? 'Scanning...' : 'Scan Orphans'}
                </button>
                <button
                  onClick={handleDeleteBackblazeOrphans}
                  disabled={orphanActionLoading !== null || !orphanScan?.orphanFiles}
                  className="inline-flex items-center justify-center px-4 py-2 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold transition-all cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                  {orphanActionLoading === 'delete' ? 'Deleting...' : 'Delete Orphans'}
                </button>
              </div>
            </div>

            {orphanActionError && (
              <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-300">
                {orphanActionError}
              </div>
            )}

            {orphanScan && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-3.5">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Managed B2 Files</p>
                  <p className="mt-1 text-xl font-black text-white font-mono">{formatNumber(orphanScan.totalFiles || 0)}</p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-3.5">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Referenced Files</p>
                  <p className="mt-1 text-xl font-black text-emerald-400 font-mono">{formatNumber(orphanScan.referencedFiles || 0)}</p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-3.5">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Orphan Files</p>
                  <p className="mt-1 text-xl font-black text-amber-400 font-mono">{formatNumber(orphanScan.orphanFiles || 0)}</p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-3.5">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Orphan Size</p>
                  <p className="mt-1 text-xl font-black text-sky-400 font-mono">{formatDecimalSize(orphanScan.orphanBytes || 0)}</p>
                </div>
              </div>
            )}
          </div>

          {/* Interactive B2 Storage Growth Simulator */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="rounded-3xl border border-slate-800/80 bg-gradient-to-b from-[#111827] to-[#0c1322] p-6 shadow-xl lg:col-span-2 space-y-6">
              <div>
                <h4 className="text-base font-bold text-white flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-sky-400" />
                  <span>Storage Growth & Scaling Simulator ({timeframeLabel})</span>
                </h4>
                <p className="text-slate-400 text-xs mt-1">
                  Model infrastructure storage upkeep growth scaling from 10 GB up to 10 Terabytes.
                </p>
              </div>

              <div className="space-y-4 bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-medium">Simulated Capacity:</span>
                  <span className="text-sky-300 font-mono font-bold text-base">
                    {simulatedStorageGB >= 1000
                      ? `${(simulatedStorageGB / 1000).toFixed(1)} TB`
                      : `${simulatedStorageGB} GB`}
                  </span>
                </div>
                
                <input
                  type="range"
                  min="10"
                  max="10000"
                  step="10"
                  value={simulatedStorageGB}
                  onChange={e => setSimulatedStorageGB(Number(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
                />
                
                <div className="flex justify-between text-[10px] text-slate-500 font-semibold uppercase">
                  <span>10 GB (Min)</span>
                  <span>2.5 TB</span>
                  <span>5 TB</span>
                  <span>7.5 TB</span>
                  <span>10 TB (Max)</span>
                </div>
              </div>

              <div className="p-5 rounded-2xl border border-sky-500/20 bg-sky-950/20 text-left relative overflow-hidden">
                <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wider block">
                  Simulated Monthly Storage Upkeep
                </span>
                <div className="text-2xl font-black text-white font-mono mt-1">
                  ₹{((simulatedB2Cost * timeframeFactor) * usdToInrRate).toFixed(2)}
                  <span className="text-xs font-normal text-slate-400 ml-2">
                    (${(simulatedB2Cost * timeframeFactor).toFixed(4)} USD)
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-2">
                  At <strong>₹600 per TB/month</strong> ($0.006/GB/mo) with <strong>₹0.00 download egress fees</strong>.
                </p>
              </div>
            </div>

            {/* Rules card */}
            <div className="rounded-3xl border border-slate-800/80 bg-gradient-to-b from-[#111827] to-[#0c1322] p-6 shadow-xl flex flex-col justify-between space-y-6">
              <div>
                <h4 className="text-base font-bold text-white mb-2 flex items-center gap-2">
                  <Info className="w-5 h-5 text-sky-400" />
                  <span>Bandwidth Alliance</span>
                </h4>
                <p className="text-slate-400 text-xs mb-4">
                  Backblaze B2 and Cloudflare partner in the Bandwidth Alliance to waive standard cloud egress fees.
                </p>

                <div className="space-y-3 text-xs">
                  <div className="flex justify-between py-2 border-b border-slate-800/40">
                    <span className="text-slate-400">AWS S3 Standard Egress</span>
                    <span className="text-rose-400 font-mono font-semibold">$0.09 / GB</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-800/40">
                    <span className="text-slate-400">B2 Standard Egress</span>
                    <span className="text-amber-400 font-mono font-semibold">$0.01 / GB</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-800/40">
                    <span className="text-slate-400">EveBash Cloudflare Egress</span>
                    <span className="text-emerald-400 font-mono font-bold">$0.00 (FREE)</span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-sky-500/5 border border-sky-500/15 rounded-2xl">
                <p className="text-[10px] text-sky-400 font-bold uppercase tracking-wider flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Financial Impact
                </p>
                <p className="text-[11px] text-slate-300 mt-1.5 leading-relaxed">
                  Serving 50 TB of wedding photos monthly on AWS would cost ~$4,500 (~₹4.5 Lakhs) in egress alone. With our architecture, that fee is ₹0.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB PANEL 4: CLOUDFLARE DETAIL ── */}
      {activeSubTab === 'cloudflare' && (
        <div className="space-y-6">
          {renderFilterBar('bg-amber-600', 'text-amber-400', 'border-amber-500/20')}

          {/* Live Cloudflare Billing Banner */}
          <div className="rounded-3xl border border-amber-500/30 bg-gradient-to-b from-[#111827] to-[#151208] p-6 sm:p-7 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                  <CloudflareLogo className="h-4 w-auto" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Live Cloudflare Account Billing</h3>
                  <p className="text-[11px] text-slate-500">Real-time edge zone plan, domain registry, and Workers serverless queries</p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <span className="text-xs font-mono font-bold text-amber-300 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-xl">
                  {liveCfPlan ? `Zone: ${liveCfPlan.toUpperCase()}` : 'Free Global CDN Active'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 pt-1">
              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4">
                <p className="text-[10px] text-amber-400 font-bold uppercase tracking-wider mb-1">Zone Plan</p>
                <p className="text-xl font-black text-white font-mono">{liveCfPlan ? liveCfPlan.toUpperCase() : 'FREE'}</p>
                <p className="text-[11px] text-slate-500 mt-1">DDoS & WAF Protection</p>
              </div>

              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4">
                <p className="text-[10px] text-amber-400 font-bold uppercase tracking-wider mb-1">Domain Registrar</p>
                <p className="text-xl font-black text-white font-mono">$0.00</p>
                <p className="text-[11px] text-slate-500 mt-1">External via Hostinger</p>
              </div>

              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4">
                <p className="text-[10px] text-amber-400 font-bold uppercase tracking-wider mb-1">Active Subscriptions</p>
                <p className="text-xl font-black text-white font-mono">
                  {liveCfSubscriptionCost > 0 ? `$${liveCfSubscriptionCost.toFixed(2)}` : 'None'}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">{liveCfSubscriptions.length} active addon(s)</p>
              </div>

              <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-4">
                <p className="text-[10px] text-amber-400 font-bold uppercase tracking-wider mb-1">Total Monthly Cost</p>
                <p className="text-xl font-black text-amber-300 font-mono">${actualCloudflareCost.toFixed(2)}</p>
                <p className="text-[11px] font-mono text-slate-400 mt-1">
                  ₹{(actualCloudflareCost * usdToInrRate).toFixed(0)} @ ₹{usdToInrRate}/USD
                </p>
              </div>
            </div>
          </div>

          {/* Cloudflare Billing Units Breakdown Table */}
          <div className="rounded-3xl border border-slate-800/80 bg-gradient-to-b from-[#111827] to-[#0c1322] p-6 sm:p-7 shadow-xl space-y-4">
            <h4 className="text-base font-bold text-white flex items-center gap-2">
              <CloudflareLogo className="h-4 w-auto" />
              <span>Cloudflare Billing Units Breakdown</span>
            </h4>
            <p className="text-slate-400 text-xs">
              Edge routing, DDoS defense, SSL termination, and serverless Workers request tiers.
            </p>

            <div className="rounded-2xl border border-slate-800/80 overflow-hidden bg-slate-950/40">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-400">
                  <thead className="bg-slate-950/90 text-slate-400 uppercase tracking-wider border-b border-slate-800 text-[10px]">
                    <tr className="divide-x divide-slate-800">
                      <th className="py-3 px-4 font-bold whitespace-nowrap">Billing Unit</th>
                      <th className="py-3 px-4 font-bold whitespace-nowrap">Plan Allowance</th>
                      <th className="py-3 px-4 font-bold whitespace-nowrap">Active Status</th>
                      <th className="py-3 px-4 text-right font-bold whitespace-nowrap">Cost ({timeframeLabel})</th>
                      <th className="py-3 px-4 text-right font-bold whitespace-nowrap">Cost (Projected Year)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    <tr className="divide-x divide-slate-800 hover:bg-slate-900/40 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-white whitespace-nowrap">Domain Registrar (Hostinger)</td>
                      <td className="py-3.5 px-4 whitespace-nowrap">External DNS CNAME delegation</td>
                      <td className="py-3.5 px-4 font-mono whitespace-nowrap">1 Domain Active</td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-amber-400 whitespace-nowrap">$0.00</td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-350 whitespace-nowrap">$0.00</td>
                    </tr>
                    {liveCfSubscriptionCost > 0 && (
                      <tr className="divide-x divide-slate-800 hover:bg-slate-900/40 transition-colors bg-amber-500/5">
                        <td className="py-3.5 px-4 font-semibold text-white whitespace-nowrap">Zone Plan & Subscriptions</td>
                        <td className="py-3.5 px-4 whitespace-nowrap">Active Paid Upgrades</td>
                        <td className="py-3.5 px-4 font-mono whitespace-nowrap">{liveCfPlan?.toUpperCase() || 'Paid'}</td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-amber-400 whitespace-nowrap">${(liveCfSubscriptionCost * timeframeFactor).toFixed(2)}</td>
                        <td className="py-3.5 px-4 text-right font-mono text-slate-350 whitespace-nowrap">${(liveCfSubscriptionCost * 12).toFixed(2)}</td>
                      </tr>
                    )}
                    <tr className="divide-x divide-slate-800 hover:bg-slate-900/40 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-white whitespace-nowrap">Workers Serverless Requests</td>
                      <td className="py-3.5 px-4 whitespace-nowrap">100k requests / day Free</td>
                      <td className="py-3.5 px-4 font-mono whitespace-nowrap">{formatNumber(monthlyRequests)} req/mo (sim)</td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-amber-400 whitespace-nowrap">${(workersCost * timeframeFactor).toFixed(2)}</td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-350 whitespace-nowrap">${(workersCost * 12).toFixed(2)}</td>
                    </tr>
                    <tr className="divide-x divide-slate-800 hover:bg-slate-900/40 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-white whitespace-nowrap">CDN Caching & Bandwidth</td>
                      <td className="py-3.5 px-4 whitespace-nowrap">Unlimited Edge Bandwidth</td>
                      <td className="py-3.5 px-4 font-mono whitespace-nowrap">Global Edge Pop Network</td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-amber-400 whitespace-nowrap">$0.00</td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-350 whitespace-nowrap">$0.00</td>
                    </tr>
                    <tr className="divide-x divide-slate-800 bg-amber-950/20 font-bold border-t border-slate-800">
                      <td className="py-4 px-4 text-white uppercase text-xs whitespace-nowrap">Total Cloudflare Upkeep</td>
                      <td className="py-4 px-4 text-amber-300 whitespace-nowrap">-</td>
                      <td className="py-4 px-4 whitespace-nowrap">-</td>
                      <td className="py-4 px-4 text-right font-mono text-amber-300 font-black text-sm whitespace-nowrap">
                        ${(actualCloudflareCost * timeframeFactor).toFixed(2)} {timeframeSuffix}
                      </td>
                      <td className="py-4 px-4 text-right font-mono text-slate-200 font-bold whitespace-nowrap">
                        ${(actualCloudflareCost * 12).toFixed(2)} / yr
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Interactive Workers Simulator */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="rounded-3xl border border-slate-800/80 bg-gradient-to-b from-[#111827] to-[#0c1322] p-6 shadow-xl lg:col-span-2 space-y-6">
              <div>
                <h4 className="text-base font-bold text-white flex items-center gap-2">
                  <Activity className="w-5 h-5 text-amber-400" />
                  <span>Cloudflare Workers Serverless API Simulator</span>
                </h4>
                <p className="text-slate-400 text-xs mt-1">
                  Simulate daily edge queries and determine when Workers Paid plan is triggered.
                </p>
              </div>

              <div className="space-y-4 bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Simulated Daily Traffic:</span>
                  <span className="text-amber-400 font-mono font-bold text-base">
                    {formatNumber(simulatedDailyRequests)} req / day
                  </span>
                </div>

                <input
                  type="range"
                  min="10000"
                  max="2000000"
                  step="10000"
                  value={simulatedDailyRequests}
                  onChange={e => setSimulatedDailyRequests(Number(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />

                <div className="flex justify-between text-[10px] text-slate-500 font-semibold uppercase">
                  <span>10k req/day</span>
                  <span>500k req/day</span>
                  <span>1M req/day</span>
                  <span>2M req/day</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/40">
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Monthly Volume</p>
                  <h4 className="text-lg font-black text-white font-mono mt-1">
                    {formatNumber(monthlyRequests)}
                  </h4>
                </div>

                <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/40">
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Plan Required</p>
                  <h4 className="text-lg font-black text-amber-400 font-mono mt-1">
                    {monthlyRequests <= 3000000 ? 'Workers Free' : 'Workers Paid'}
                  </h4>
                </div>

                <div className="p-4 rounded-2xl border border-amber-500/20 bg-amber-950/20">
                  <p className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">Estimated Monthly Cost</p>
                  <h4 className="text-lg font-black text-amber-300 font-mono mt-1">
                    ${workersCost.toFixed(2)} / mo
                  </h4>
                </div>
              </div>
            </div>

            {/* Terms card */}
            <div className="rounded-3xl border border-slate-800/80 bg-gradient-to-b from-[#111827] to-[#0c1322] p-6 shadow-xl flex flex-col justify-between space-y-6">
              <div>
                <h4 className="text-base font-bold text-white mb-2 flex items-center gap-2">
                  <Info className="w-5 h-5 text-amber-400" />
                  <span>Workers Edge Isolation</span>
                </h4>
                <p className="text-slate-400 text-xs mb-4">
                  Workers run V8 JavaScript isolates directly inside Cloudflare edge datacenters without cold starts.
                </p>

                <div className="space-y-3 text-xs">
                  <div className="flex justify-between py-2 border-b border-slate-800/40">
                    <span className="text-slate-400">Free Tier Limit</span>
                    <span className="text-white font-mono font-semibold">100k requests / day</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-800/40">
                    <span className="text-slate-400">Paid Plan Base</span>
                    <span className="text-white font-mono font-semibold">$5.00 / month</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-800/40">
                    <span className="text-slate-400">Included Requests</span>
                    <span className="text-white font-mono font-semibold">10 Million / month</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-800/40">
                    <span className="text-slate-400">Overage Rate</span>
                    <span className="text-white font-mono font-semibold">$0.50 / Million req</span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-amber-500/5 border border-amber-500/15 rounded-2xl">
                <p className="text-[10px] text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  Zero Cold Starts
                </p>
                <p className="text-[11px] text-slate-300 mt-1.5 leading-relaxed">
                  Unlike AWS Lambda or GCP Functions that take seconds to spin up containers, V8 isolates initiate in under 5 milliseconds globally.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB PANEL 5: MODAL.COM (AI) DETAIL ── */}
      {activeSubTab === 'modal' && (
        <div className="space-y-6">
          {renderFilterBar('bg-emerald-600', 'text-emerald-400', 'border-emerald-500/20')}

          {/* Header & 4 Executive Cards */}
          <div className="rounded-3xl border border-slate-800/80 bg-gradient-to-b from-[#111827] to-[#0c1322] p-6 sm:p-7 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <ModalLogo className="h-5 w-auto" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Modal Matrix</h3>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <span className="text-xs font-mono font-bold text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1.5 rounded-xl">
                  {modalLogs.length} Executions Endured
                </span>
              </div>
            </div>

            {/* 4 Executive Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-1">
              <div className="rounded-2xl border border-indigo-500/30 bg-indigo-950/20 p-4 transition-all hover:border-indigo-500/50 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block mb-1">
                    Total Compute Cost
                  </span>
                  <div className="text-2xl font-black text-indigo-200 font-mono">
                    ₹{actualModalCostInfo.inr.toFixed(2)}
                  </div>
                  <span className="text-xs font-mono text-slate-400 mt-0.5 block">
                    ${actualModalCostInfo.usd.toFixed(4)} USD ({modalLogs.length} invocations)
                  </span>
                </div>
                <div className="mt-3 pt-2.5 border-t border-indigo-500/20 space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="text-slate-400">Avg Cost / Run:</span>
                    <span className="font-mono text-slate-200 font-medium">
                      ₹{modalLogs.length > 0 ? (actualModalCostInfo.inr / modalLogs.length).toFixed(4) : '0.0000'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="text-slate-400">Total Compute Time:</span>
                    <span className="font-mono text-indigo-300 font-bold">
                      {(() => {
                        const totalSec = modalLogs.reduce((acc, l) => acc + (Number(l.execution_time_seconds) || 0), 0);
                        if (totalSec < 60) return `${totalSec.toFixed(1)}s`;
                        const mins = Math.floor(totalSec / 60);
                        const secs = Math.round(totalSec % 60);
                        return `${mins}m ${secs}s`;
                      })()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 transition-all hover:border-slate-700/80 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Media Volume Processed
                  </span>
                  <div className="text-2xl font-black text-white font-mono">
                    {formatSize(modalStats.totalMediaBytes)}
                  </div>
                  <span className="text-xs font-mono text-slate-400 mt-0.5 block">
                    Across {modalStats.photosCount + modalStats.videosCount} media uploads
                  </span>
                </div>
                <div className="mt-3 pt-2.5 border-t border-slate-800 space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="text-slate-400">Photos:</span>
                    <span className="font-mono text-slate-200 font-medium">{modalStats.photosCount} files</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="text-slate-400">Videos:</span>
                    <span className="font-mono text-slate-200 font-medium">{modalStats.videosCount} files</span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 transition-all hover:border-slate-700/80 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Face Embeddings Indexed
                  </span>
                  <div className="text-2xl font-black text-white font-mono">
                    {formatNumber(modalStats.totalFaces)}
                  </div>
                  <span className="text-xs font-mono text-slate-400 mt-0.5 block">
                    512-D vector embeddings
                  </span>
                </div>
                <div className="mt-3 pt-2.5 border-t border-slate-800 space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="text-slate-400">Selfie Searches:</span>
                    <span className="font-mono text-slate-200 font-medium">{modalStats.selfiesCount} lookups</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="text-slate-400">Batch Dispatchers:</span>
                    <span className="font-mono text-slate-200 font-medium">{modalStats.batchesCount} batches</span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 transition-all hover:border-slate-700/80 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Average Execution Duration
                  </span>
                  <div className="text-2xl font-black text-white font-mono">
                    {modalStats.avgDuration.toFixed(2)}s
                  </div>
                  <span className="text-xs font-mono text-slate-400 mt-0.5 block">
                    NVIDIA L4 GPU + High-Core CPU
                  </span>
                </div>
                <div className="mt-3 pt-2.5 border-t border-slate-800 space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="text-slate-400">L4 GPU Video Runs:</span>
                    <span className="font-mono text-amber-400 font-medium">{modalStats.videoGpuCount} runs</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="text-slate-400">CPU Video Transcoding:</span>
                    <span className="font-mono text-cyan-400 font-medium">{modalStats.videoCpuCount} runs</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Worker Fleet Performance & Cost Breakdown Table */}
            <div className="pt-2 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-slate-800/80 pt-5">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <ModalLogo className="h-4 w-auto" />
                    <span>Worker Breakdown</span>
                  </h4>
                </div>
                <div className="text-xs font-mono text-slate-400">
                  <span className="font-semibold text-slate-200">{modalLogs.length}</span> total runs analyzed
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800/80 overflow-hidden bg-slate-950/40">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-400">
                    <thead className="bg-slate-950/90 text-slate-400 uppercase tracking-wider border-b border-slate-800 text-[10px]">
                      <tr className="divide-x divide-slate-800">
                        <th className="py-3 px-4 font-bold whitespace-nowrap">Worker Name</th>
                        <th className="py-3 px-4 font-bold whitespace-nowrap">Cost Per Sec</th>
                        <th className="py-3 px-4 font-bold whitespace-nowrap">Run time</th>
                        <th className="py-3 px-4 font-bold whitespace-nowrap">Data</th>
                        <th className="py-3 px-4 text-center font-bold whitespace-nowrap">Runs</th>
                        <th className="py-3 px-4 text-right font-bold whitespace-nowrap">Costs</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80">
                      {modalWorkerBreakdown.map(worker => (
                        <tr key={worker.key} className="divide-x divide-slate-800 hover:bg-slate-900/40 transition-colors">
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className={`text-xs font-bold ${worker.textColor}`}>
                              {worker.name}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap font-mono tabular-nums">
                            <div className="space-y-0.5">
                              <span className="text-xs font-semibold text-slate-200 block">
                                {currency === 'USD'
                                  ? `$${worker.costPerSecUsd.toFixed(6)}/s`
                                  : `₹${worker.costPerSecInr.toFixed(5)}/s`}
                              </span>
                              <span className="text-[10px] text-slate-500 block">
                                {currency === 'USD'
                                  ? `(₹${worker.costPerSecInr.toFixed(5)}/s)`
                                  : `($${worker.costPerSecUsd.toFixed(6)}/s)`}
                              </span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap font-mono tabular-nums">
                            <div className="space-y-0.5">
                              <span className="text-xs font-bold text-white block">
                                {(worker.totalDurationSeconds / 60).toFixed(2)} min
                              </span>
                              <span className="text-[10px] text-slate-400 font-medium block">
                                {worker.totalDurationSeconds.toFixed(2)} sec
                              </span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap font-mono tabular-nums">
                            {worker.dataSizeBytes > 0 ? (
                              <span className="text-xs font-semibold text-slate-200">
                                {formatSize(worker.dataSizeBytes)}
                              </span>
                            ) : (
                              <span className="text-slate-600">-</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-center whitespace-nowrap font-mono tabular-nums">
                            <span className="text-xs font-bold text-slate-200">
                              {formatNumber(worker.runs)}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                            <span className="text-sm font-black text-indigo-300 block">
                              {currency === 'USD'
                                ? `$${worker.totalCostUsd.toFixed(4)}`
                                : `₹${worker.totalCostInr.toFixed(2)}`}
                            </span>
                            <span className="text-[10px] font-medium text-slate-500 block">
                              {currency === 'USD'
                                ? `(₹${worker.totalCostInr.toFixed(2)})`
                                : `($${worker.totalCostUsd.toFixed(4)})`}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-950/90 border-t-2 border-slate-800 font-bold text-white text-xs divide-x divide-slate-800">
                      <tr>
                        <td className="py-3.5 px-4">
                          <span>Total Fleet Utilization</span>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-400 text-[11px]">
                          Blended Compute
                        </td>
                        <td className="py-3.5 px-4 font-mono tabular-nums">
                          <span className="text-white block">
                            {(modalWorkerTotals.totalDuration / 60).toFixed(2)} min
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium block">
                            {modalWorkerTotals.totalDuration.toFixed(2)} sec
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono tabular-nums text-slate-200">
                          {formatSize(modalWorkerTotals.totalBytes)}
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono tabular-nums">
                          <span className="text-emerald-400 font-bold">
                            {formatNumber(modalWorkerTotals.totalRuns)}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                          <span className="text-sm font-black text-indigo-300 block">
                            {currency === 'USD'
                              ? `$${actualModalCostInfo.usd.toFixed(4)}`
                              : `₹${actualModalCostInfo.inr.toFixed(2)}`}
                          </span>
                          <span className="text-[10px] font-medium text-slate-500 block">
                            {currency === 'USD'
                              ? `(₹${actualModalCostInfo.inr.toFixed(2)})`
                              : `($${actualModalCostInfo.usd.toFixed(4)})`}
                          </span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* Execution & Cost Logs Table */}
          <div className="rounded-3xl border border-slate-800/80 bg-gradient-to-b from-[#111827] to-[#0c1322] p-6 sm:p-7 shadow-xl space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h4 className="text-base font-bold text-white flex items-center gap-2">
                  <ModalLogo className="h-4 w-auto" />
                  <span>Modal Logs</span>
                </h4>
              </div>

              {loadingModalLogs && (
                <div className="flex items-center text-xs text-indigo-400 space-x-2 animate-pulse bg-indigo-500/10 border border-indigo-500/20 px-3 py-1.5 rounded-xl">
                  <Activity className="w-3.5 h-3.5 animate-spin" />
                  <span>Loading compute logs...</span>
                </div>
              )}
            </div>

            {/* Filter & Search Toolbar */}
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3.5 flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search user, event, photo ID, worker..."
                  value={modalSearchTerm}
                  onChange={e => setModalSearchTerm(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500 font-medium"
                />
              </div>

              <div className="flex items-center space-x-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1">
                <User className="w-3.5 h-3.5 text-slate-500" />
                <select
                  value={modalUserFilter}
                  onChange={e => setModalUserFilter(e.target.value)}
                  className="bg-transparent text-white text-xs border-0 outline-none cursor-pointer pr-1"
                >
                  <option value="all" className="bg-slate-900 text-white">All Photographers ({users.length})</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id} className="bg-slate-900 text-white">
                      {u.name || u.email || u.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center space-x-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1">
                <Cpu className="w-3.5 h-3.5 text-slate-500" />
                <select
                  value={modalWorkerFilter}
                  onChange={e => setModalWorkerFilter(e.target.value)}
                  className="bg-transparent text-white text-xs border-0 outline-none cursor-pointer pr-1"
                >
                  <option value="all" className="bg-slate-900 text-white">All Worker Fleets</option>
                  <option value="gpu" className="bg-slate-900 text-white">GPU Fleet (NVIDIA L4)</option>
                  <option value="cpu" className="bg-slate-900 text-white">CPU Video Transcoders</option>
                  <option value="photo" className="bg-slate-900 text-white">Photo Face Indexers</option>
                  <option value="selfie" className="bg-slate-900 text-white">Selfie Matchers</option>
                  <option value="batch" className="bg-slate-900 text-white">Batch Dispatchers</option>
                </select>
              </div>

              {(modalSearchTerm || modalUserFilter !== 'all' || modalWorkerFilter !== 'all') && (
                <button
                  onClick={() => {
                    setModalSearchTerm('');
                    setModalUserFilter('all');
                    setModalWorkerFilter('all');
                  }}
                  className="text-xs text-indigo-400 hover:text-indigo-300 px-2 py-1 rounded cursor-pointer font-semibold"
                >
                  Clear Filters
                </button>
              )}
            </div>

            {/* Matrix Table */}
            <div className="rounded-2xl border border-slate-800/80 overflow-hidden bg-slate-950/40">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-400">
                  <thead className="bg-slate-950/90 text-slate-400 uppercase tracking-wider border-b border-slate-800 text-[10px]">
                    <tr className="divide-x divide-slate-800">
                      <th className="py-3 px-4 font-bold whitespace-nowrap">Timestamp</th>
                      <th className="py-3 px-4 font-bold whitespace-nowrap">User</th>
                      <th className="py-3 px-4 font-bold whitespace-nowrap">Size</th>
                      <th className="py-3 px-4 font-bold whitespace-nowrap">Event Gallery</th>
                      <th className="py-3 px-4 font-bold whitespace-nowrap">Worker</th>
                      <th className="py-3 px-4 text-right font-bold whitespace-nowrap">Runtime</th>
                      <th className="py-3 px-4 text-center font-bold whitespace-nowrap">Faces</th>
                      <th className="py-3 px-4 text-right font-bold whitespace-nowrap">Actual Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {paginatedLogs.length > 0 ? (
                      paginatedLogs.map(log => {
                        const details = resolveLogDetails(log);
                        const costUsd = computeModalLogCostUsd(log);
                        const costInr = computeModalLogCostInr(log, usdToInrRate);
                        const duration = Number(log.execution_time_seconds) || 0;

                        return (
                          <tr key={log.id} className="divide-x divide-slate-800 hover:bg-slate-900/40 transition-colors">
                            <td className="py-3.5 px-4 text-[11px] font-mono whitespace-nowrap">
                              <span className="font-semibold text-white block">{new Date(log.created_at).toLocaleDateString()}</span>
                              <span className="text-[10px] text-slate-500 block">{new Date(log.created_at).toLocaleTimeString()}</span>
                            </td>

                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <div className="min-w-0 max-w-[200px]">
                                <p className="text-xs font-semibold text-white truncate" title={details.resolvedUser?.name || details.resolvedUser?.email || 'Guest / Attendee'}>
                                  {details.resolvedUser?.name || details.resolvedUser?.username || (details.resolvedUserId ? 'User' : 'Guest / Attendee')}
                                </p>
                                <p className="text-[10px] text-slate-400 truncate">
                                  {details.resolvedUser?.email || (details.resolvedUserId ? `ID: ${details.resolvedUserId.slice(0, 8)}…` : 'Guest')}
                                </p>
                              </div>
                            </td>

                            <td className="py-3.5 px-4 font-mono text-slate-200 whitespace-nowrap text-xs">
                              {details.mediaSize != null && details.mediaSize > 0 ? (
                                formatSize(details.mediaSize)
                              ) : (
                                <span className="text-slate-600">-</span>
                              )}
                            </td>

                            <td className="py-3.5 px-4 whitespace-nowrap">
                              {details.event ? (
                                <div className="max-w-[180px]">
                                  <p className="text-xs font-medium text-slate-200 truncate" title={details.event.title}>
                                    {details.event.title}
                                  </p>
                                  {details.parentEvent ? (
                                    <p className="text-[10px] text-purple-400 truncate" title={`Sub-gallery of ${details.parentEvent.title}`}>
                                      Sub-gallery of {details.parentEvent.title}
                                    </p>
                                  ) : details.isSubGallery ? (
                                    <span className="inline-block text-[10px] text-purple-400 font-medium">
                                      Sub-gallery
                                    </span>
                                  ) : null}
                                </div>
                              ) : (
                                <span className="text-slate-600">-</span>
                              )}
                            </td>

                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <span className={`text-xs font-semibold ${details.workerTextColor}`}>
                                {details.workerName}
                              </span>
                            </td>

                            <td className="py-3.5 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                              <span className="font-bold text-white">{duration.toFixed(2)}s</span>
                            </td>

                            <td className="py-3.5 px-4 text-center font-mono tabular-nums text-slate-200 whitespace-nowrap">
                              {log.faces_detected ?? 0}
                            </td>

                            <td className="py-3.5 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                              <span className="text-sm font-black text-indigo-300 block">
                                {currency === 'USD' ? `$${costUsd.toFixed(5)}` : `₹${costInr.toFixed(4)}`}
                              </span>
                              <span className="text-[10px] font-medium text-slate-500 block">
                                {currency === 'USD' ? `(₹${costInr.toFixed(4)})` : `($${costUsd.toFixed(5)})`}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-500">
                          No Modal compute logs found for the selected timeframe.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-slate-800 px-4 py-3 sm:px-6 bg-slate-950/60">
                  <div className="flex flex-1 justify-between sm:hidden">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900 text-xs font-semibold text-slate-300 disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900 text-xs font-semibold text-slate-300 disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                  <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                    <p className="text-xs text-slate-400">
                      Showing <span className="font-bold text-white">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
                      <span className="font-bold text-white">{Math.min(filteredModalLogs.length, currentPage * itemsPerPage)}</span> of{' '}
                      <span className="font-bold text-white">{filteredModalLogs.length}</span> logs
                    </p>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="p-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      {pageNumbers.map(page => (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold font-mono transition-all cursor-pointer ${
                            page === currentPage
                              ? 'bg-indigo-600 text-white'
                              : 'text-slate-400 hover:bg-slate-850 hover:text-white'
                          }`}
                        >
                          {page}
                        </button>
                      ))}
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="p-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB PANEL 6: RAILWAY (APP SERVER) DETAIL ── */}
      {activeSubTab === 'railway' && (
        <div className="space-y-6">
          {renderFilterBar('bg-fuchsia-600', 'text-fuchsia-400', 'border-fuchsia-500/20')}

          {/* Live Railway Account Billing Banner */}
          {hasLiveRailway && liveRailwayData && (
            <div className="rounded-3xl border border-emerald-500/30 bg-gradient-to-b from-[#111827] to-[#071a12] p-6 sm:p-7 shadow-xl space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                    <RailwayLogo className="h-4 w-auto text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">Live Railway GraphQL Billing — {liveRailwayData.projectName}</h3>
                    <p className="text-[11px] text-slate-500">Real-time edge container CPU, RAM memory, and network egress metrics</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <span className="text-xs font-mono font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Live Sync Active
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 pt-1">
                <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4">
                  <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider mb-1">CPU Compute</p>
                  <p className="text-xl font-black text-white font-mono">${liveRailwayData.cpuDollars.toFixed(2)}</p>
                  <p className="text-[11px] text-slate-500 mt-1">This month</p>
                </div>

                <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4">
                  <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider mb-1">RAM Memory</p>
                  <p className="text-xl font-black text-white font-mono">${liveRailwayData.memoryDollars.toFixed(2)}</p>
                  <p className="text-[11px] text-slate-500 mt-1">This month</p>
                </div>

                <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4">
                  <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider mb-1">Network Egress</p>
                  <p className="text-xl font-black text-white font-mono">${liveRailwayData.networkDollars.toFixed(2)}</p>
                  <p className="text-[11px] text-slate-500 mt-1">This month</p>
                </div>

                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-4">
                  <p className="text-[10px] text-emerald-300 font-bold uppercase tracking-wider mb-1">
                    {liveRailwayData.invoiceDollars !== null ? 'Current Invoice' : 'Estimated Total'}
                  </p>
                  <p className="text-xl font-black text-emerald-300 font-mono">${actualRailwayCost.toFixed(2)}</p>
                  <p className="text-[11px] font-mono text-slate-400 mt-1">
                    ₹{(actualRailwayCost * usdToInrRate).toFixed(0)} @ ₹{usdToInrRate}/USD
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Interactive Server Simulator */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-3xl border border-slate-800/80 bg-gradient-to-b from-[#111827] to-[#0c1322] p-6 shadow-xl space-y-6">
              <div>
                <h4 className="text-base font-bold text-white flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-fuchsia-400" />
                  <span>Railway Node.js Server Allocation Simulator</span>
                </h4>
                <p className="text-slate-400 text-xs mt-1">
                  Railway bills per second for CPU, Memory, and Egress. Test container scaling profiles.
                </p>
              </div>

              <div className="space-y-6 bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-bold text-slate-300 uppercase">Container RAM Allocation</label>
                    <span className="font-mono font-bold text-fuchsia-400 text-xs">{simulatedRailwayRAM.toFixed(1)} GB</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="8"
                    step="0.1"
                    value={simulatedRailwayRAM}
                    onChange={e => setSimulatedRailwayRAM(Number(e.target.value))}
                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-fuchsia-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
                    <span>0.5 GB</span>
                    <span>8.0 GB</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-bold text-slate-300 uppercase">Container vCPU Allocation</label>
                    <span className="font-mono font-bold text-fuchsia-400 text-xs">{simulatedRailwayCPU.toFixed(2)} vCPU</span>
                  </div>
                  <input
                    type="range"
                    min="0.05"
                    max="4"
                    step="0.05"
                    value={simulatedRailwayCPU}
                    onChange={e => setSimulatedRailwayCPU(Number(e.target.value))}
                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-fuchsia-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
                    <span>0.05 vCPU</span>
                    <span>4.0 vCPU</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-bold text-slate-300 uppercase">Monthly Network Egress</label>
                    <span className="font-mono font-bold text-fuchsia-400 text-xs">{simulatedRailwayEgress} GB</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="500"
                    step="1"
                    value={simulatedRailwayEgress}
                    onChange={e => setSimulatedRailwayEgress(Number(e.target.value))}
                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-fuchsia-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
                    <span>1 GB</span>
                    <span>500 GB</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Simulated Impact card */}
            <div className="space-y-6">
              <div className="rounded-3xl border border-slate-800/80 bg-gradient-to-b from-[#111827] to-[#0c1322] p-6 shadow-xl space-y-4">
                <h4 className="text-base font-bold text-white flex items-center gap-2">
                  <RailwayLogo className="h-4 w-auto text-fuchsia-400" />
                  <span>Simulated Monthly Upkeep Impact</span>
                </h4>
                
                <div className="space-y-3 text-xs pt-1">
                  <div className="flex justify-between items-center py-2 border-b border-slate-800/50">
                    <span className="text-slate-400">RAM Compute ($0.00000386/GB/s)</span>
                    <span className="font-mono font-bold text-white">${railwayRamCostMonth.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-800/50">
                    <span className="text-slate-400">vCPU Compute ($0.00000772/vCPU/s)</span>
                    <span className="font-mono font-bold text-white">${railwayCpuCostMonth.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-800/50">
                    <span className="text-slate-400">Network Egress ($0.05/GB)</span>
                    <span className="font-mono font-bold text-white">${railwayEgressCostMonth.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-3">
                    <span className="font-bold text-slate-200">Total Railway Upkeep</span>
                    <span className="font-mono font-black text-fuchsia-400 text-lg">
                      ${simulatedRailwayCost.toFixed(2)} / mo (₹{(simulatedRailwayCost * usdToInrRate).toFixed(0)})
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-5 rounded-3xl border border-fuchsia-500/20 bg-fuchsia-950/15 space-y-2">
                <h5 className="text-xs font-bold text-fuchsia-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5" />
                  Container Server Profile
                </h5>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Next.js containers naturally idle around 0.005 vCPU and ~300MB RAM. Because heavy photos and videos are stored in Backblaze B2 and cached on Cloudflare, Railway egress remains near zero.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
