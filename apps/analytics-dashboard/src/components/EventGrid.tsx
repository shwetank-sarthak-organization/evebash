import React, { useState, useMemo } from 'react';
import type { Event, UserProfile, GuestLog, Photo } from '../lib/analytics';
import { Search, Calendar, Folder, Mail, Database, Image, Video, Users, ShieldAlert, Award, AlertTriangle, CheckCircle2, Ghost } from 'lucide-react';

interface Props {
  events: Event[];
  users: UserProfile[];
  guests: GuestLog[];
  photos: Photo[];
}

const formatSize = (bytes: number | null | undefined) => {
  if (bytes === null || bytes === undefined || isNaN(bytes) || bytes < 0) return '0 B';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const sizeIndex = Math.min(Math.max(0, i), sizes.length - 1);
  return parseFloat((bytes / Math.pow(k, sizeIndex)).toFixed(2)) + ' ' + sizes[sizeIndex];
};

export const EventGrid: React.FC<Props> = ({ events, users, guests, photos }) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'deleted'>('all');

  // 1. Aggregate detailed metrics per gallery/event + detect ghost galleries (deleted by user but files remain)
  const galleriesDetails = useMemo(() => {
    const knownEventIds = new Set(events.map(e => e.id));
    
    // Process active/known database events
    const activeList = events.map(event => {
      const creator = users.find(u => u.id === event.createdById);
      const creatorName = creator ? creator.name : 'Unknown Owner';
      const creatorEmail = creator ? creator.email : 'N/A';

      const eventPhotos = photos.filter(p => p.eventId === event.id);
      const totalPhotos = eventPhotos.filter(p => p.mediaType !== 'video').length;
      const totalVideos = eventPhotos.filter(p => p.mediaType === 'video').length;
      const dataUsed = eventPhotos.reduce((sum, p) => sum + (Number(p.size) || 0), 0);

      const eventGuests = guests.filter(g => g.eventId === event.id);
      const guestsCount = eventGuests.length;
      const guestAdminsCount = eventGuests.filter(g => g.canAdmin).length;
      const totalAdmins = 1 + guestAdminsCount;
      const vendorsLinked = event.vendors ? event.vendors.length : 0;

      const isDeleted = Boolean(event.isDeleted) || event.status === 'deleted';

      return {
        ...event,
        creatorName,
        creatorEmail,
        totalPhotos,
        totalVideos,
        dataUsed,
        guestsCount,
        totalAdmins,
        vendorsLinked,
        isDeleted,
        statusLabel: isDeleted ? 'Deleted' : 'Active'
      };
    });

    // Detect Ghost Galleries (event_id exists in photos/guests but row was deleted from events table)
    const ghostEventIds = new Set<string>();
    photos.forEach(p => {
      if (p.eventId && !knownEventIds.has(p.eventId)) {
        ghostEventIds.add(p.eventId);
      }
    });
    guests.forEach(g => {
      if (g.eventId && !knownEventIds.has(g.eventId)) {
        ghostEventIds.add(g.eventId);
      }
    });

    const ghostList = Array.from(ghostEventIds).map(eventId => {
      const eventPhotos = photos.filter(p => p.eventId === eventId);
      const totalPhotos = eventPhotos.filter(p => p.mediaType !== 'video').length;
      const totalVideos = eventPhotos.filter(p => p.mediaType === 'video').length;
      const dataUsed = eventPhotos.reduce((sum, p) => sum + (Number(p.size) || 0), 0);

      // Try finding creator from photos' user_id
      const firstPhoto = eventPhotos.find(p => p.userId);
      const creator = firstPhoto ? users.find(u => u.id === firstPhoto.userId) : null;
      const creatorName = creator ? creator.name : 'Unknown (Deleted Gallery)';
      const creatorEmail = creator ? creator.email : 'N/A';

      const eventGuests = guests.filter(g => g.eventId === eventId);
      const guestsCount = eventGuests.length;
      const totalAdmins = eventGuests.filter(g => g.canAdmin).length;

      return {
        id: eventId,
        title: `[Ghost Gallery] ID: ${eventId.slice(0, 12)}...`,
        createdAt: eventPhotos[0]?.id ? undefined : undefined,
        createdById: creator?.id || '',
        createdBy: creator?.id || '',
        creatorName,
        creatorEmail,
        totalPhotos,
        totalVideos,
        dataUsed,
        guestsCount,
        totalAdmins,
        vendorsLinked: 0,
        isDeleted: true,
        statusLabel: 'Deleted (Ghost Gallery)'
      };
    });

    return [...activeList, ...ghostList];
  }, [events, users, guests, photos]);

  // 2. Calculate overall stats for quick analytics header
  const stats = useMemo(() => {
    const totalGalleries = galleriesDetails.length;
    const activeGalleries = galleriesDetails.filter(g => !g.isDeleted).length;
    const ghostGalleries = galleriesDetails.filter(g => g.isDeleted).length;
    const ghostDataUsed = galleriesDetails.filter(g => g.isDeleted).reduce((sum, g) => sum + g.dataUsed, 0);

    const totalPhotos = photos.filter(p => p.mediaType !== 'video').length;
    const totalVideos = photos.filter(p => p.mediaType === 'video').length;
    const totalData = photos.reduce((sum, p) => sum + p.size, 0);
    const totalVendors = events.reduce((sum, e) => sum + (e.vendors ? e.vendors.length : 0), 0);

    return { totalGalleries, activeGalleries, ghostGalleries, ghostDataUsed, totalPhotos, totalVideos, totalData, totalVendors };
  }, [galleriesDetails, events, photos]);

  // 3. Search and status filter
  const filteredGalleries = useMemo(() => {
    return galleriesDetails.filter(g => {
      const matchesSearch =
        g.title.toLowerCase().includes(search.toLowerCase()) ||
        g.id.toLowerCase().includes(search.toLowerCase()) ||
        g.creatorName.toLowerCase().includes(search.toLowerCase()) ||
        g.creatorEmail.toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === 'all' ? true :
        statusFilter === 'active' ? !g.isDeleted :
        g.isDeleted;

      return matchesSearch && matchesStatus;
    });
  }, [galleriesDetails, search, statusFilter]);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Quick Analytics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card 1: Total Events & Status */}
        <div className="bg-[#111827]/80 border border-slate-800 rounded-2xl p-5 hover:border-indigo-500/50 transition-all duration-300 shadow-lg group">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Total Galleries</p>
              <h3 className="text-2xl font-black text-white mt-1 group-hover:text-indigo-400 transition-colors">
                {stats.totalGalleries}
              </h3>
            </div>
            <div className="p-2.5 bg-indigo-500/10 rounded-xl text-indigo-400">
              <Folder className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[10px] text-slate-500 mt-2">
            <span className="text-emerald-400 font-semibold">{stats.activeGalleries} Active</span> •{' '}
            <span className="text-rose-400 font-semibold">{stats.ghostGalleries} Ghost/Deleted</span>
          </p>
        </div>

        {/* Card 2: Media Files */}
        <div className="bg-[#111827]/80 border border-slate-800 rounded-2xl p-5 hover:border-emerald-500/50 transition-all duration-300 shadow-lg group">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Total Media Files</p>
              <h3 className="text-2xl font-black text-white mt-1 group-hover:text-emerald-400 transition-colors">
                {stats.totalPhotos + stats.totalVideos}
              </h3>
            </div>
            <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-400">
              <div className="flex space-x-0.5 text-emerald-400">
                <Image className="w-4 h-4" />
                <span className="text-[10px] self-end font-bold">/</span>
                <Video className="w-4 h-4" />
              </div>
            </div>
          </div>
          <p className="text-[10px] text-slate-500 mt-2">
            {stats.totalPhotos} Photos • {stats.totalVideos} Videos
          </p>
        </div>

        {/* Card 3: Storage Occupied */}
        <div className="bg-[#111827]/80 border border-slate-800 rounded-2xl p-5 hover:border-sky-500/50 transition-all duration-300 shadow-lg group">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Storage Occupied</p>
              <h3 className="text-2xl font-black text-white mt-1 group-hover:text-sky-400 transition-colors">
                {formatSize(stats.totalData)}
              </h3>
            </div>
            <div className="p-2.5 bg-sky-500/10 rounded-xl text-sky-400">
              <Database className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[10px] text-slate-500 mt-2">
            {stats.ghostDataUsed > 0 ? `${formatSize(stats.ghostDataUsed)} in ghost galleries` : 'Data stored on Backblaze B2'}
          </p>
        </div>

        {/* Card 4: Ghost / Deleted Warning */}
        <div className="bg-[#111827]/80 border border-slate-800 rounded-2xl p-5 hover:border-rose-500/50 transition-all duration-300 shadow-lg group">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Ghost Galleries</p>
              <h3 className="text-2xl font-black text-rose-400 mt-1">
                {stats.ghostGalleries}
              </h3>
            </div>
            <div className="p-2.5 bg-rose-500/10 rounded-xl text-rose-400">
              <Ghost className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[10px] text-rose-300/80 mt-2">
            {stats.ghostGalleries > 0 ? `Deleted by user but storage left` : 'No leftover ghost galleries'}
          </p>
        </div>
      </div>

      {/* Main Table Box */}
      <div className="bg-[#111827]/80 border border-slate-800 rounded-3xl p-6 shadow-xl">
        {/* Search & Filter Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h4 className="text-lg font-bold text-white">Events & Galleries Catalog</h4>
            <p className="text-slate-400 text-xs mt-0.5">
              Showing {filteredGalleries.length} of {galleriesDetails.length} total entries
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Status Filter Tabs */}
            <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  statusFilter === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('active')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  statusFilter === 'active' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Active
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('deleted')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  statusFilter === 'deleted' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Ghost / Deleted
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search title, owner, ID..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-sky-500/50 w-full sm:w-56 placeholder-slate-600 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Galleries Table */}
        <div className="overflow-x-auto border border-slate-800/60 rounded-2xl">
          <table className="w-full text-left text-sm text-slate-400">
            <thead className="text-xs text-slate-500 uppercase bg-slate-900/30 border-b border-slate-800">
              <tr>
                <th scope="col" className="py-3.5 px-4">Gallery Details</th>
                <th scope="col" className="py-3.5 px-4">Gallery Status</th>
                <th scope="col" className="py-3.5 px-4">Created By</th>
                <th scope="col" className="py-3.5 px-4">Data Used</th>
                <th scope="col" className="py-3.5 px-4">Photos / Videos</th>
                <th scope="col" className="py-3.5 px-4">Guests</th>
                <th scope="col" className="py-3.5 px-4">Admins</th>
                <th scope="col" className="py-3.5 px-4">Vendors</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {filteredGalleries.map((gallery, idx) => {
                const regDate = gallery.createdAt
                  ? new Date(gallery.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
                  : 'N/A';

                return (
                  <tr key={gallery.id || idx} className="hover:bg-slate-800/10 transition-colors text-slate-300">
                    {/* Gallery Name & ID */}
                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                          gallery.isDeleted
                            ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                            : 'bg-indigo-500/5 border-indigo-500/10 text-indigo-400'
                        }`}>
                          {gallery.isDeleted ? <Ghost className="w-5 h-5" /> : <Folder className="w-5 h-5" />}
                        </div>
                        <div>
                          <p className={`font-semibold leading-tight whitespace-pre-line ${gallery.isDeleted ? 'text-rose-200' : 'text-white'}`}>
                            {gallery.title}
                          </p>
                          <div className="flex items-center space-x-2 mt-1.5">
                            <span className="font-mono text-[10px] text-slate-500 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                              {gallery.id}
                            </span>
                            <span className="text-[10px] text-slate-500 flex items-center">
                              <Calendar className="w-3.5 h-3.5 mr-1 text-slate-650" />
                              {regDate}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Gallery Status Column */}
                    <td className="py-4 px-4 text-xs font-semibold">
                      {gallery.isDeleted ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-rose-500/20 bg-rose-500/10 text-rose-300 text-[11px] font-bold">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                          Deleted / Ghost
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 text-[11px] font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          Active
                        </span>
                      )}
                    </td>

                    {/* Created By Owner */}
                    <td className="py-4 px-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-200 text-xs">{gallery.creatorName}</span>
                        <span className="text-[10px] text-slate-500 mt-0.5 flex items-center">
                          <Mail className="w-3 h-3 mr-1 text-slate-600" />
                          {gallery.creatorEmail}
                        </span>
                      </div>
                    </td>

                    {/* Data Used */}
                    <td className="py-4 px-4 text-xs font-semibold text-sky-400">
                      <div className="flex items-center space-x-1.5">
                        <Database className="w-3.5 h-3.5 text-slate-650" />
                        <span>{formatSize(gallery.dataUsed)}</span>
                      </div>
                    </td>

                    {/* Photos / Videos Count */}
                    <td className="py-4 px-4 text-xs">
                      <div className="flex flex-col space-y-1">
                        <span className="flex items-center text-slate-300">
                          <Image className="w-3.5 h-3.5 mr-1.5 text-slate-600" />
                          {gallery.totalPhotos} Photos
                        </span>
                        <span className="flex items-center text-slate-400">
                          <Video className="w-3.5 h-3.5 mr-1.5 text-slate-600" />
                          {gallery.totalVideos} Videos
                        </span>
                      </div>
                    </td>

                    {/* Guest Count */}
                    <td className="py-4 px-4 text-xs font-semibold text-slate-300">
                      <div className="flex items-center space-x-1.5">
                        <Users className="w-4 h-4 text-slate-600" />
                        <span>{gallery.guestsCount} {gallery.guestsCount === 1 ? 'Guest' : 'Guests'}</span>
                      </div>
                    </td>

                    {/* Admins */}
                    <td className="py-4 px-4 text-xs font-semibold text-slate-300">
                      <div className="flex items-center space-x-1.5">
                        <ShieldAlert className="w-4 h-4 text-slate-600" />
                        <span>{gallery.totalAdmins} {gallery.totalAdmins === 1 ? 'Admin' : 'Admins'}</span>
                      </div>
                    </td>

                    {/* Vendors */}
                    <td className="py-4 px-4 text-xs font-semibold text-slate-300">
                      <div className="flex items-center space-x-1.5">
                        <Award className="w-4 h-4 text-slate-600" />
                        <span>{gallery.vendorsLinked} {gallery.vendorsLinked === 1 ? 'Vendor' : 'Vendors'}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredGalleries.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 bg-slate-900/10">
                    <p className="text-base font-semibold">No galleries found</p>
                    <p className="text-xs text-slate-600 mt-1">Try adjusting your search query or status filter.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
