
import React from 'react';
import { POSTS } from '../constants';
import { Page } from '../types';

interface HomeProps {
  onNavigate: (page: Page) => void;
  onPostSelect: (postId: string) => void;
}

const Home: React.FC<HomeProps> = ({ onNavigate, onPostSelect }) => {
  return (
    <div className="h-full overflow-y-auto snap-y snap-mandatory no-scrollbar bg-black">
      {POSTS.map((post) => (
        <div
          key={post.id}
          className="relative h-full w-full snap-start overflow-hidden flex flex-col group"
        >
          {/* Background Image / Video Mock */}
          <div
            className="absolute inset-0 bg-cover bg-center transition-all duration-700 group-active:scale-105 group-active:brightness-50"
            style={{
              backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.7) 100%), url("${post.image}")`
            }}
          />

          {/* Central Interactive Zone for "Fold" Transition */}
          <div
            className="absolute inset-40 z-30 cursor-pointer flex items-center justify-center"
            onClick={() => onPostSelect(post.id)}
          >
            <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity border border-white/20">
              <span className="material-symbols-outlined text-white text-3xl animate-pulse">keyboard_double_arrow_up</span>
            </div>
          </div>

          {/* Top Header */}
          <header
            className="relative z-20 flex items-center justify-between px-6 pt-14"
          >
            <button className="text-white h-10 w-10 flex items-center justify-center bg-black/10 rounded-full backdrop-blur-sm">
              <span className="material-symbols-outlined text-[26px]">menu</span>
            </button>
            <div className="flex gap-6">
              <span className="text-white/60 text-[15px] font-bold cursor-pointer hover:text-white transition-colors">Following</span>
              <span className="text-white text-[15px] font-black border-b-[3px] border-primary pb-1 cursor-pointer">For You</span>
            </div>
            <button className="text-white h-10 w-10 flex items-center justify-center bg-black/10 rounded-full backdrop-blur-sm">
              <span className="material-symbols-outlined text-[26px]">search</span>
            </button>
          </header>

          {/* Bottom Overlay Content */}
          <div
            className="mt-auto relative z-20 p-6 pb-10 flex flex-col gap-3 pointer-events-none"
          >
            <div className="flex items-center gap-2 mb-1 pointer-events-auto">
              <div className="w-10 h-10 rounded-2xl border-2 border-white/50 overflow-hidden cursor-pointer shadow-lg">
                <img alt="Avatar" className="w-full h-full object-cover" src={post.avatar} />
              </div>
              <div className="flex flex-col">
                <span className="text-white font-black text-[15px] drop-shadow-lg cursor-pointer">{post.user}</span>
                <span className="text-white/70 text-[10px] font-bold uppercase tracking-widest">Active Now</span>
              </div>
              <button className="bg-primary text-white text-[11px] font-black px-4 py-1.5 rounded-full ml-2 shadow-lg hover:scale-105 active:scale-95 transition-all">Follow</button>
            </div>

            <h1 className="text-white text-[34px] font-black leading-[1.1] text-shadow-md pointer-events-auto">
              {post.titleEn}
            </h1>
            <p className="text-white/90 text-[16px] font-bold leading-snug text-shadow-md pointer-events-auto max-w-[85%]">
              {post.titleZh}
            </p>

            <div className="flex gap-2 mt-1 pointer-events-auto">
              {post.hashtags.map(tag => (
                <span key={tag} className="bg-black/20 backdrop-blur-md text-primary text-[11px] font-bold px-3 py-1 rounded-full border border-white/10">#{tag}</span>
              ))}
            </div>

            <div className="flex items-center gap-2 mt-3 pointer-events-auto">
              <div className="w-6 h-6 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <span className="material-symbols-outlined text-white text-[14px] animate-spin-slow">music_note</span>
              </div>
              <p className="text-white/80 text-xs font-bold tracking-tight">
                Original Audio - {post.user}
              </p>
            </div>
          </div>

          {/* Side Actions */}
          <div
            className="absolute bottom-32 right-4 flex flex-col items-center gap-7 z-20 pointer-events-auto"
          >
            <div className="flex flex-col items-center gap-1.5">
              <button className="w-13 h-13 bg-black/20 backdrop-blur-xl border border-white/10 rounded-full flex items-center justify-center text-white hover:scale-110 active:scale-90 transition-all shadow-xl">
                <span className="material-symbols-outlined text-[32px] text-accent fill-[1]">favorite</span>
              </button>
              <span className="text-white text-[12px] font-black tracking-tighter drop-shadow-md">{post.likes}</span>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <button className="w-13 h-13 bg-black/20 backdrop-blur-xl border border-white/10 rounded-full flex items-center justify-center text-white hover:scale-110 active:scale-90 transition-all shadow-xl">
                <span className="material-symbols-outlined text-[30px] text-primary fill-[1]">star</span>
              </button>
              <span className="text-white text-[12px] font-black tracking-tighter drop-shadow-md">{post.stars}</span>
            </div>
            <div className="flex flex-col items-center gap-1.5" onClick={() => onPostSelect(post.id)}>
              <button className="w-13 h-13 bg-primary/20 backdrop-blur-xl border border-primary/30 rounded-full flex items-center justify-center text-primary animate-bounce-subtle hover:scale-110 active:scale-90 transition-all shadow-xl shadow-primary/20">
                <span className="material-symbols-outlined text-[30px] fill-[1]">chat</span>
              </button>
              <span className="text-white text-[12px] font-black tracking-tighter drop-shadow-md">{post.comments}</span>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <button className="w-13 h-13 bg-black/20 backdrop-blur-xl border border-white/10 rounded-full flex items-center justify-center text-white hover:scale-110 active:scale-90 transition-all shadow-xl">
                <span className="material-symbols-outlined text-[30px] fill-[1]">share</span>
              </button>
              <span className="text-white text-[12px] font-black tracking-tighter drop-shadow-md">Share</span>
            </div>
          </div>
        </div>
      ))}

      <style>{`
        .animate-spin-slow {
          animation: spin 6s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes bounce-subtle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        .animate-bounce-subtle {
          animation: bounce-subtle 2s ease-in-out infinite;
        }
        .w-13 { width: 3.25rem; }
        .h-13 { height: 3.25rem; }
      `}</style>
    </div>
  );
};

export default Home;
