import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
 fetchNotifications,
 markAsRead,
 markAllAsRead,
 deleteNotification,
} from '../../slices/notificationSlice';
import { getNotificationIcon, getRouteForNotification, formatNotifDate } from '../../utils/notificationUtils';
import PageContainer from '../../components/ui/PageContainer';

export default function NotificationsPage() {
 const dispatch = useDispatch();
 const navigate = useNavigate();
 const { items = [], pagination = {}, unreadCount = 0, loading = false } = useSelector((s) => s.notifications || {});

 const [searchParams, setSearchParams] = useSearchParams();
 
 const notifId = searchParams.get('id');
 
 const [page, setPage] = useState(1);
 const [selectedNotif, setSelectedNotif] = useState(null);
 const limit = 20;

 // Sync selectedNotif with URL 'id'
 useEffect(() => {
 if (notifId && items && items.length > 0) {
 const found = items.find(n => n._id === notifId);
 if (found) setSelectedNotif(found);
 } else if (!notifId) {
 setSelectedNotif(null);
 }
 }, [notifId, items]);

 useEffect(() => {
 dispatch(fetchNotifications({ page, limit }));
 }, [page, dispatch]);



 const handleClick = (notif) => {
 setSearchParams({ id: notif._id });
 if (!notif.isRead) dispatch(markAsRead(notif._id));
 };

 const handleBackToList = () => {
 setSearchParams({});
 };

 const handleDelete = (e, id) => {
 e.stopPropagation();
 dispatch(deleteNotification(id));
 };

 const totalPages = Math.ceil((pagination?.total || 0) / limit);

 return (
 <PageContainer
 title="Notifications"
 subtitle="View your alerts and updates"
 isCard={false}
 headerActions={
 unreadCount > 0 && (
 <button
 onClick={() => dispatch(markAllAsRead())}
 className="text-[10px] sm:text-xs text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:text-amber-400 font-bold uppercase tracking-widest px-3 py-1.5 bg-amber-50 dark:bg-amber-900/30 rounded-lg transition-colors"
 >
 Mark all read
 </button>
 )
 }
 >
 <div className="flex h-[calc(100vh-180px)] min-h-[600px] w-full bg-surface rounded-2xl shadow-[inset_0_2px_10px_rgba(255,255,255,0.3)] border border-white/60 overflow-hidden">
  {/* --- MASTER LIST SIDEBAR --- */}
  <div className={`w-full md:w-[350px] lg:w-[400px] border-r border-border-subtle flex flex-col transition-all bg-surface ${selectedNotif ? 'hidden md:flex' : 'flex'}`}>
  
  {/* Sidebar Header */}
  <div className="p-3 border-b border-border-subtle bg-surface">
  <button
  onClick={() => navigate('/')}
  className="px-3 py-1.5 text-xs font-bold text-muted hover:text-main hover:bg-surface rounded-lg transition-all flex items-center gap-2"
  >
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
  Go Back
  </button>
  </div>

 {/* Notification List Content */}
 <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200">
 {loading && (
 <div className="py-12 text-center">
 <div className="inline-block w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
 </div>
 )}

 {!loading && items.length === 0 && (
 <div className="py-20 px-8 text-center">
 <p className="text-sm text-muted">No notifications.</p>
 </div>
 )}

{items.map((notif) => (
  <div
  key={notif._id}
  onClick={() => handleClick(notif)}
  style={selectedNotif?._id === notif._id ? { backgroundColor: 'rgb(204 251 241)' } : {}}
  className={`relative p-4 border-b border-gray-50 cursor-pointer transition-all group border-l-4 ${
  selectedNotif?._id === notif._id 
  ? 'hover:bg-teal-100 dark:hover:bg-teal-900/40 border-l-teal-600' 
  : 'bg-surface hover:bg-app border-l-transparent'
  }`}
  >
 <div className="flex items-start gap-3">
 <span className="text-xl shrink-0 select-none">
 {getNotificationIcon(notif.type)}
 </span>
 <div className="flex-1 min-w-0">
 <div className="flex justify-between items-start gap-2 mb-0.5">
 <h3 className={`text-xs font-bold truncate ${!notif.isRead ? 'text-heading' : 'text-muted'}`}>
 {notif.title}
 </h3>
 <span className="text-[10px] text-muted whitespace-nowrap mt-0.5 font-medium">
 {formatNotifDate(notif.createdAt)}
 </span>
 </div>
 <p className="text-[11px] text-muted line-clamp-2 leading-relaxed">
 {notif.message}
 </p>
 </div>
 {!notif.isRead && (
 <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-2 shrink-0" />
 )}
 </div>
 
 {/* Delete on hover */}
 <button
 onClick={(e) => handleDelete(e, notif._id)}
 className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 text-muted hover:text-red-400 transition-opacity"
 >
 <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
 </svg>
 </button>
 </div>
 ))}

 {/* Pagination in Sidebar */}
 {totalPages > 1 && (
 <div className="p-3 border-t border-border-subtle flex items-center justify-between bg-app/50">
 <button
 onClick={() => setPage((p) => Math.max(1, p - 1))}
 disabled={page === 1}
 className="text-[10px] font-bold text-muted disabled:opacity-30 hover:text-teal-600 dark:text-teal-400 uppercase tracking-tighter"
 >
 ← Prev
 </button>
 <span className="text-[10px] text-muted uppercase tracking-widest font-bold">
 {page} / {totalPages}
 </span>
 <button
 onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
 disabled={page === totalPages}
 className="text-[10px] font-bold text-muted disabled:opacity-30 hover:text-teal-600 dark:text-teal-400 uppercase tracking-tighter"
 >
 Next →
 </button>
 </div>
 )}
 </div>
 </div>

 {/* --- DETAIL VIEW PANE --- */}
 <div className={`flex-1 flex flex-col bg-app ${!selectedNotif ? 'hidden md:flex' : 'flex'}`}>
 {selectedNotif ? (
 <div className="flex-1 flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
 {/* Detail Header */}
 <div className="bg-surface p-4 md:p-6 border-b border-border-subtle flex items-center gap-4">
 <button 
 onClick={handleBackToList}
 className="btn-ghost p-2 text-muted"
 >
 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
 </svg>
 </button>
 <div className="flex-1">
 <div className="flex items-center gap-4 mb-1">
 <span className="text-4xl p-3 bg-app rounded-2xl">{getNotificationIcon(selectedNotif.type)}</span>
 <div className="flex-1">
  <h2 className="text-xl font-extrabold text-heading leading-tight">{selectedNotif.title}</h2>
 <p className="text-xs font-semibold text-muted uppercase tracking-wider mt-1">{formatNotifDate(selectedNotif.createdAt)}</p>
 </div>
 </div>
 </div>
 {/* View Module button removed per user request */}

 </div>

 {/* Detail Body */}
 <div className="flex-1 p-6 md:p-12 overflow-y-auto bg-app/50">
 <div className="max-w-3xl mx-auto bg-surface p-10 md:p-14 rounded-[32px] shadow-sm border border-border-subtle relative overflow-hidden">
 {/* Subtle background decoration */}
 <div className="absolute top-0 right-0 w-32 h-32 bg-teal-50 dark:bg-teal-900/30 rounded-full -mr-16 -mt-16 opacity-50" />
 
 <h3 className="text-xs font-bold text-teal-600 dark:text-teal-400 uppercase tracking-[0.2em] mb-6">Notification Details</h3>
 <p className="text-main leading-relaxed text-lg whitespace-pre-wrap font-medium">
 {selectedNotif.message}
 </p>
 
 {/* Specific Action Buttons for Leave/Tickets etc. - REMOVED per user request */}
 
 {/* Reference to Deep Link button hidden as well
 <div className="mt-12 pt-10 border-t border-border-subtle italic text-sm text-muted font-medium leading-relaxed">
 Use the "Deep Link" button above to view full context and take actions in the relevant module.
 </div>
 */}
 </div>
 </div>
 </div>
 ) : (
 /* Empty State */
 <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
 <div className="w-24 h-24 bg-surface rounded-[30%] rotate-12 flex items-center justify-center mb-8 shadow-2xl shadow-gray-200 border border-gray-50">
 <svg className="w-10 h-10 text-teal-400 -rotate-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
 </svg>
 </div>
 <h3 className="text-xl font-black text-heading mb-2">Select a notification</h3>
 <p className="text-sm text-muted max-w-xs font-medium leading-relaxed">Choose an item from the list to view its full content and available actions.</p>
 </div>
 )}
 </div>
 </div>
 </PageContainer>
 );
}
