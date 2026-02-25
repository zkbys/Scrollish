import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNotificationStore } from '../../store/useNotificationStore';

export const NotificationCenter: React.FC = () => {
    const { notifications, markAsRead, markAllAsRead } = useNotificationStore();
    const [showNotifications, setShowNotifications] = useState(false);
    const [selectedNotification, setSelectedNotification] = useState<any | null>(null);

    const unreadCount = notifications.filter(n => !n.is_read).length;

    return (
        <div className="relative">
            <button
                onClick={() => setShowNotifications(!showNotifications)}
                className={`h-[clamp(2.2rem,5.5vh,2.75rem)] w-[clamp(2.2rem,5.5vh,2.75rem)] flex items-center justify-center backdrop-blur-xl rounded-[clamp(0.8rem,1.8vh,1.2rem)] border-2 active:scale-90 transition-all shadow-lg group relative
          ${showNotifications ? 'bg-orange-500 border-orange-600 text-white' : 'bg-gray-100 dark:bg-white/10 border-orange-400/20 text-gray-800 dark:text-white/90'}
        `}>
                <span className="material-symbols-outlined text-[clamp(18px,2.2vh,22px)] group-hover:text-white transition-colors">notifications</span>
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 border-2 border-white dark:border-[#0B0A09] rounded-full flex items-center justify-center text-[8px] font-black text-white">
                        {unreadCount}
                    </span>
                )}
            </button>

            {/* 通知下拉列表 */}
            <AnimatePresence>
                {showNotifications && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowNotifications(false)}
                            className="fixed inset-0 z-[95] bg-transparent"
                        />
                        <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95, transformOrigin: 'top left' }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="absolute top-full left-0 mt-3 w-72 max-h-[400px] z-[100] bg-white/90 dark:bg-[#1C1C1E]/90 backdrop-blur-2xl overflow-hidden flex flex-col shadow-2xl border border-gray-100 dark:border-white/10 rounded-[1.25rem]"
                        >
                            <div className="p-4 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
                                <span className="text-xs font-black uppercase tracking-widest opacity-40">消息中心</span>
                                <button
                                    onClick={() => markAllAsRead()}
                                    className="text-[10px] font-bold text-orange-500 hover:underline">全部已读</button>
                            </div>
                            <div className="overflow-y-auto no-scrollbar py-2">
                                {notifications.length > 0 ? (
                                    notifications.map((n) => (
                                        <div
                                            key={n.id}
                                            onClick={() => {
                                                if (!n.is_read) markAsRead(n.id);
                                                setSelectedNotification(n);
                                                setShowNotifications(false);
                                            }}
                                            className={`px-4 py-3 hover:bg-orange-500/5 transition-all border-b border-gray-50 dark:border-white/5 cursor-pointer relative group ${n.is_read ? 'opacity-70' : ''}`}
                                        >
                                            <div className="flex items-start justify-between mb-1 gap-2">
                                                <div className="flex items-center gap-2">
                                                    {!n.is_read && (
                                                        <span className="w-2 h-2 bg-red-500 rounded-full shrink-0 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                                                    )}
                                                    <span className="text-[11px] font-black tracking-tight leading-none truncate max-w-[150px]">{n.title}</span>
                                                </div>
                                                <span className="text-[9px] font-medium opacity-40 shrink-0">
                                                    {new Date(n.created_at).toLocaleDateString()}
                                                </span>
                                            </div>
                                            <p className="text-[10px] font-bold opacity-60 leading-relaxed line-clamp-1">
                                                {n.content}
                                            </p>
                                        </div>
                                    ))
                                ) : (
                                    <div className="p-8 text-center">
                                        <span className="material-symbols-outlined text-gray-300 text-4xl block mb-2">notifications_off</span>
                                        <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest">暂无消息</p>
                                    </div>
                                )}
                            </div>
                            <div className="p-3 border-t border-gray-50 dark:border-white/5 bg-white dark:bg-[#1C1C1E] text-center">
                                <button className="text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-orange-500 transition-colors">查看全部</button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Notification Detail Overlay */}
            <AnimatePresence>
                {selectedNotification && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[110] bg-black/40 backdrop-blur-md flex items-center justify-center p-6"
                        onClick={() => setSelectedNotification(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            className="w-full max-w-sm bg-white dark:bg-[#1C1C1E] overflow-hidden shadow-2xl border border-gray-100 dark:border-white/10 rounded-[2rem]"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="p-6 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500">
                                        <span className="material-symbols-outlined text-2xl">
                                            {selectedNotification.type === 'award' ? 'redeem' :
                                                selectedNotification.type === 'social' ? 'group' : 'notifications'}
                                        </span>
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-black tracking-tight">{selectedNotification.title}</h3>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                            {new Date(selectedNotification.created_at).toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSelectedNotification(null)}
                                    className="size-8 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-500 dark:text-white/60 active:scale-90 transition-transform"
                                >
                                    <span className="material-symbols-outlined text-[18px]">close</span>
                                </button>
                            </div>
                            <div className="p-6 max-h-[60vh] overflow-y-auto no-scrollbar">
                                <p className="text-[13px] font-bold text-gray-700 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
                                    {selectedNotification.content}
                                </p>
                                {selectedNotification.metadata && Object.keys(selectedNotification.metadata).length > 0 && (
                                    <div className="mt-4 p-3 bg-gray-100 dark:bg-white/5 rounded-xl text-[10px] font-medium opacity-50 italic font-mono break-all">
                                        {JSON.stringify(selectedNotification.metadata, null, 2)}
                                    </div>
                                )}
                            </div>
                            <div className="p-4 bg-white dark:bg-[#1C1C1E] border-t border-gray-100 dark:border-white/5">
                                <button
                                    onClick={() => setSelectedNotification(null)}
                                    className="w-full py-3 rounded-xl bg-orange-500 text-white text-[11px] font-black uppercase tracking-widest shadow-lg shadow-orange-500/20 active:scale-95 transition-all"
                                >
                                    我知道了
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
