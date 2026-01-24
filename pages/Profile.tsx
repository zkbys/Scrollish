
import React from 'react';
import { IMAGES, POSTS } from '../constants';

const Profile: React.FC = () => {
  return (
    <div className="h-full flex flex-col bg-background-light dark:bg-background-dark overflow-y-auto no-scrollbar">
      <header className="sticky top-0 z-50 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md px-4 py-3 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary font-bold">explore</span>
          <h2 className="text-lg font-bold tracking-tight">Global Explorer</h2>
        </div>
        <div className="flex items-center gap-4">
          <button className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full">
            <span className="material-symbols-outlined">share</span>
          </button>
          <button className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full">
            <span className="material-symbols-outlined">settings</span>
          </button>
        </div>
      </header>

      <main className="px-4 pt-6 pb-20">
        <div className="flex items-center gap-5 mb-6">
          <div className="relative">
            <div className="w-24 h-24 rounded-full border-2 border-primary p-1">
              <div 
                className="w-full h-full rounded-full bg-cover bg-center" 
                style={{ backgroundImage: `url("${IMAGES.profile}")` }}
              />
            </div>
            <div className="absolute bottom-0 right-0 bg-primary text-white rounded-full p-1 border-2 border-background-dark">
              <span className="material-symbols-outlined text-xs">verified</span>
            </div>
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold leading-none mb-1">LanguageBuff</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-3">Exploring the world through English</p>
            <button className="bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white px-5 py-1.5 rounded-full text-sm font-semibold hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors">
              Edit Profile
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { val: '1,240', label: 'Words' },
            { val: '45', label: 'Days' },
            { val: '328', label: 'Saves' }
          ].map((stat) => (
            <div key={stat.label} className="bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 text-center">
              <p className="text-xl font-bold text-primary">{stat.val}</p>
              <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="sticky top-0 z-40 bg-background-light dark:bg-background-dark -mx-4 px-4 mb-4">
          <div className="flex border-b border-slate-200 dark:border-slate-800">
            <button className="flex-1 py-4 text-sm font-bold border-b-2 border-primary text-slate-900 dark:text-white">My Saves</button>
            <button className="flex-1 py-4 text-sm font-bold text-slate-400 dark:text-slate-500">My Notes</button>
            <button className="flex-1 py-4 text-sm font-bold text-slate-400 dark:text-slate-500">History</button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {POSTS.map((post) => (
            <div key={post.id} className="flex flex-col gap-2 group cursor-pointer">
              <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-slate-200 dark:bg-slate-800">
                <div 
                  className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105" 
                  style={{ backgroundImage: `url("${post.image}")` }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute top-2 left-2 bg-black/40 backdrop-blur-md rounded-full px-2 py-0.5 flex items-center gap-1">
                  <span className="text-[10px] text-white font-bold">r/{post.hashtags[0]}</span>
                </div>
              </div>
              <div className="px-1">
                <p className="text-sm font-semibold leading-snug line-clamp-2">{post.titleEn}</p>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="material-symbols-outlined text-[10px] text-primary">menu_book</span>
                    </div>
                    <span className="text-[10px] text-slate-500">12 new words</span>
                  </div>
                  <span className="material-symbols-outlined text-slate-400 text-lg hover:text-red-500 transition-colors">favorite</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default Profile;
