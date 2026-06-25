import React, { useState, useMemo } from 'react';
import type { Event, UserProfile, GuestLog, Photo } from '../lib/analytics';
import { Search, Calendar, Folder, Mail, Database, Image, Video, Users, ShieldAlert, Award } from 'lucide-react';

interface Props {
  events: Event[];
  users: UserProfile[];
  guests: GuestLog[];
  photos: Photo[];
}

const formatSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const EventGrid: React.FC<Props> = ({ events, users, guests, photos }) => {
  const [search, setSearch] = useState('');

  // 1. Calculate overall stats for the quick analytics header
  const stats = useMemo(() => {
    const totalGalleries = events.length;
    const totalPhotos = photos.filter(p => p.mediaType !== 'video').length;
    const totalVideos = photos.filter(p => p.mediaType === 'video').length;
    const totalData = photos.reduce((sum, p) => sum + p.size, 0);
    const totalVendors = events.reduce((sum, e) => sum + (e.vendors ? e.vendors.length : 0), 0);

    return { totalGalleries, totalPhotos, totalVideos, totalData, totalVendors };
  }, [events, photos]);

  // 2. Aggregate detailed metrics per gallery/event
  const galleriesDetails = useMemo(() => {
    return events.map(event => {
      // Match creator profile
      const creator = users.find(u => u.id === event.createdById);
      const creatorName = creator ? creator.name : 'Unknown Owner';
      const creatorEmail = creator ? creator.email : 'N/A';

      // Filter event photos/media
      const eventPhotos = photos.filter(p => p.eventId === event.id);
      const totalPhotos = eventPhotos.filter(p => p.mediaType !== 'video').length;
      const totalVideos = eventPhotos.filter(p => p.mediaType === 'video').length;
      const dataUsed = eventPhotos.reduce((sum, p) => sum + p.size, 0);

      // Filter event guests
      const eventGuests = guests.filter(g => g.eventId === event.id);
      const guestsCount = eventGuests.length;
      
      // Calculate total admins (1 creator + guests with canAdmin = true)
      const guestAdminsCount = eventGuests.filter(g => g.canAdmin).length;
      const totalAdmins = 1 + guestAdminsCount;

      // Vendors count
      const vendorsLinked = event.vendors ? event.vendors.length : 0;

      return {
        ...event,
        creatorName,
        creatorEmail,
        totalPhotos,
        totalVideos,
        dataUsed,
        guestsCount,
        totalAdmins,
        vendorsLinked
      };
    });
  }, [events, users, guests, photos]);

  // 3. Search filter
  const filteredGalleries = useMemo(() => {
    return galleriesDetails.filter(g => {
      return (
        g.title.toLowerCase().includes(search.toLowerCase()) ||
        g.id.toLowerCase().includes(search.toLowerCase()) ||
        g.creatorName.toLowerCase().includes(search.toLowerCase()) ||
        g.creatorEmail.toLowerCase().includes(search.toLowerCase())
      );
    });
  }, [galleriesDetails, search]);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Quick Analytics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card 1: Total Events */}
        <div className="bg-[#111827]/80 border border-slate-800 rounded-2xl p-5 hover:border-indigo-500/50 transition-all duration-300 shadow-lg group">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Total Events</p>
              <h3 className="text-2xl font-black text-white mt-1 group-hover:text-indigo-400 transition-colors">
                {stats.totalGalleries}
              </h3>
            </div>
            <div className="p-2.5 bg-indigo-500/10 rounded-xl text-indigo-400">
              <Folder className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[10px] text-slate-500 mt-2">All events created by all users</p>
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
          <p className="text-[10px] text-slate-500 mt-2">Data stored on Cloudflare B2</p>
        </div>

        {/* Card 4: Linked Vendors */}
        <div className="bg-[#111827]/80 border border-slate-800 rounded-2xl p-5 hover:border-amber-500/50 transition-all duration-300 shadow-lg group">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Linked Vendors</p>
              <h3 className="text-2xl font-black text-white mt-1 group-hover:text-amber-400 transition-colors">
                {stats.totalVendors}
              </h3>
            </div>
            <div className="p-2.5 bg-amber-500/10 rounded-xl text-amber-400">
              <Award className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[10px] text-slate-500 mt-2">Professional vendors connected</p>
        </div>
      </div>

      {/* Main Table Box */}
      <div className="bg-[#111827]/80 border border-slate-800 rounded-3xl p-6 shadow-xl">
        {/* Search Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h4 className="text-lg font-bold text-white">Events & Galleries Catalog</h4>
            <p className="text-slate-400 text-xs mt-0.5">
              Showing {filteredGalleries.length} of {events.length} events
            </p>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by title, owner, ID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-sky-500/50 w-full sm:w-64 placeholder-slate-600 transition-colors"
            />
          </div>
        </div>

        {/* Galleries Table */}
        <div className="overflow-x-auto border border-slate-800/60 rounded-2xl">
          <table className="w-full text-left text-sm text-slate-400">
            <thead className="text-xs text-slate-500 uppercase bg-slate-900/30 border-b border-slate-800">
              <tr>
                <th scope="col" className="py-3.5 px-4">Gallery Details</th>
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
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/5 border border-indigo-500/10 flex items-center justify-center text-indigo-400 shrink-0">
                          <Folder className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-semibold text-white leading-tight whitespace-pre-line">{gallery.title}</p>
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
                  <td colSpan={7} className="py-12 text-center text-slate-500 bg-slate-900/10">
                    <p className="text-base font-semibold">No galleries found</p>
                    <p className="text-xs text-slate-600 mt-1">Try adjusting your search query.</p>
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
