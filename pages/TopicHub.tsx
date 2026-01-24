
import React, { useState, useRef } from 'react';
import { GROUP_CHATS } from '../constants';
import { Page, Post } from '../types';

interface TopicHubProps {
  onNavigate: (page: Page) => void;
  post: Post;
}

const TopicHub: React.FC<TopicHubProps> = ({ onNavigate, post }) => {
  const [roomIndex, setRoomIndex] = useState(0);
  const [animationClass, setAnimationClass] = useState('');
  const startPos = useRef({ x: 0, y: 0 });

  const activeChat = GROUP_CHATS[roomIndex];

  const handleTouchStart = (e: React.TouchEvent) => {
    startPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const diffX = e.changedTouches[0].clientX - startPos.current.x;
    const diffY = e.changedTouches[0].clientY - startPos.current.y;

    // Swipe Right -> Next Card
    if (diffX > 50 && Math.abs(diffY) < 50) {
      triggerNextCard();
    }
    // Swipe Up -> Expand to Full Chat
    else if (diffY < -50 && Math.abs(diffX) < 50) {
      onNavigate(Page.ChatRoom);
    }
  };

  const triggerNextCard = () => {
    setAnimationClass('slide-out-right');
    setTimeout(() => {
      setRoomIndex((prev) => (prev + 1) % GROUP_CHATS.length);
      setAnimationClass('slide-in-left');
      setTimeout(() => setAnimationClass(''), 400);
    }, 300);
  };

  return (
    <div className="h-full flex flex-col bg-background-light dark:bg-[#0B0A09] overflow-hidden select-none">
      {/* Refined Header: Floating Hero Card */}
      <div className="relative z-50 pt-12 px-4 pb-4">
        <div 
          className="h-56 w-full rounded-[2.5rem] bg-cover bg-center flex flex-col justify-end p-7 relative overflow-hidden transition-all duration-500 shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-white/10"
          style={{ backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.8) 100%), url("${post.image}")` }}
        >
          {/* Back Button with improved positioning and glass effect */}
          <button 
            onClick={() => onNavigate(Page.Home)}
            className="absolute top-5 left-5 text-white flex items-center justify-center h-11 w-11 bg-black/20 ios-blur rounded-2xl border border-white/20 active:scale-90 transition-transform shadow-lg"
          >
            <span className="material-symbols-outlined text-[26px]">arrow_back</span>
          </button>

          {/* Source Post Info */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="bg-primary/90 ios-blur text-white text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-[0.1em] shadow-lg">Current Topic</span>
              <div className="h-1 w-1 rounded-full bg-white/40" />
              <span className="text-white/60 text-[10px] font-bold uppercase tracking-widest">{post.user}</span>
            </div>
            <h1 className="text-white text-2xl font-black leading-tight drop-shadow-2xl">
              {post.titleEn}
            </h1>
            <div className="flex gap-2 mt-1">
               {post.hashtags.slice(0, 2).map(tag => (
                 <span key={tag} className="text-primary text-[10px] font-bold px-2 py-0.5 bg-white/10 ios-blur rounded-md border border-white/5">#{tag}</span>
               ))}
            </div>
          </div>
        </div>
      </div>

      {/* Act 2 Body: Previewing Threads Deck */}
      <main className="flex-1 flex flex-col items-center justify-start pt-2 bg-transparent">
        <div className="w-full px-8 flex justify-between items-center mb-5 text-gray-400 dark:text-gray-500 text-[11px] font-black uppercase tracking-[0.2em]">
          <span>Previewing Discussions</span>
          <div className="flex items-center gap-2">
             <div className="h-[2px] w-8 bg-primary/20 rounded-full overflow-hidden">
                <div className="h-full w-1/2 bg-primary animate-[loading_1.5s_infinite_linear]" />
             </div>
             <span className="animate-pulse">Next</span>
          </div>
        </div>

        <div className="relative w-full px-4 h-[52vh]" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
          {/* Active Card */}
          <div 
            className={`absolute inset-x-4 top-0 bottom-0 bg-white dark:bg-gray-800 rounded-[3rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] border border-primary/5 overflow-hidden flex flex-col transition-all ${animationClass}`}
          >
            {/* Card Header */}
            <div 
              className="h-20 border-b border-gray-50 dark:border-white/5 flex items-center justify-between px-7 bg-white dark:bg-gray-800 shrink-0 cursor-pointer"
              onClick={() => onNavigate(Page.ChatRoom)}
            >
              <div className="flex items-center gap-4">
                <div className="relative">
                  <img 
                    src={activeChat.avatar} 
                    className="w-12 h-12 rounded-2xl border-2 border-primary/10 object-cover shadow-sm" 
                    alt={activeChat.user}
                  />
                  {activeChat.isActive && (
                    <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-green-500 rounded-full border-4 border-white dark:border-gray-800" />
                  )}
                </div>
                <div>
                  <div className="font-black text-[15px] text-gray-900 dark:text-white tracking-tight">{activeChat.user}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] text-primary font-black tracking-widest uppercase">🔥 Hot Take</span>
                    <span className="text-[10px] text-gray-400 font-bold tracking-tight">• {activeChat.time}</span>
                  </div>
                </div>
              </div>
              <div className="text-[11px] font-black text-primary bg-primary/10 px-4 py-2 rounded-2xl flex items-center gap-2 hover:bg-primary/20 transition-colors">
                Dive ⬆
              </div>
            </div>

            {/* Preview Chat Bubbles */}
            <div className="flex-1 bg-background-light/30 dark:bg-black/20 p-6 space-y-5 overflow-hidden relative">
              <div className="absolute -right-10 -top-10 w-48 h-48 bg-primary/5 rounded-full blur-[80px]"></div>
              
              {activeChat.previewMessages?.map((msg, i) => (
                <div key={i} className={`flex gap-4 ${msg.isMe ? 'flex-row-reverse' : ''}`}>
                  <div 
                    className={`p-4 rounded-[1.5rem] shadow-sm text-[15px] leading-relaxed border transition-all hover:scale-[1.02] ${
                      msg.isMe 
                        ? 'bg-bubble-user dark:bg-primary/20 text-orange-950 dark:text-white border-primary/10 rounded-tr-none' 
                        : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-100 dark:border-white/5 rounded-tl-none'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}

              {/* Enhanced Swipe Hint */}
              <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-white dark:from-gray-800 via-white/80 dark:via-gray-800/80 to-transparent flex items-end justify-center pb-8 pointer-events-none">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-10 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full w-1/3 bg-primary animate-[loading_2s_infinite_ease-in-out]" />
                  </div>
                  <span className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.3em] animate-pulse">Swipe Up to Full Chat</span>
                </div>
              </div>
            </div>
          </div>

          {/* Visual Deck Effect (Stacked Cards) */}
          <div className="absolute inset-x-8 top-5 bottom-[-15px] bg-white/40 dark:bg-gray-800/40 rounded-[3rem] -z-10 scale-[0.97] border border-primary/5 shadow-inner" />
          <div className="absolute inset-x-12 top-10 bottom-[-30px] bg-white/20 dark:bg-gray-800/20 rounded-[3rem] -z-20 scale-[0.94] border border-primary/5" />
        </div>
      </main>

      <style>{`
        .slide-out-right {
          animation: slideOutRight 0.4s forwards cubic-bezier(0.2, 0.8, 0.2, 1);
        }
        .slide-in-left {
          animation: slideInLeft 0.4s forwards cubic-bezier(0.2, 0.8, 0.2, 1);
        }
        @keyframes slideOutRight {
          to { transform: translateX(120%) rotate(10deg); opacity: 0; }
        }
        @keyframes slideInLeft {
          from { transform: translateX(-50%) scale(0.9); opacity: 0; }
          to { transform: translateX(0) scale(1); opacity: 1; }
        }
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
      `}</style>
    </div>
  );
};

export default TopicHub;
