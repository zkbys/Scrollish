
import React from 'react';
import { IMAGES } from '../constants';

const Explore: React.FC = () => {
  const categories = ['Daily Life', 'Science & Tech', 'Business', 'Culture'];
  
  return (
    <div className="h-full flex flex-col bg-white dark:bg-[#1b0d0d] overflow-y-auto no-scrollbar">
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-[#1b0d0d]/80 backdrop-blur-md">
        <div className="flex items-center p-4 pb-2 justify-between">
          <div className="text-[#1b0d0d] dark:text-white flex size-10 shrink-0 items-center justify-center">
            <span className="material-symbols-outlined">menu</span>
          </div>
          <h1 className="text-[#1b0d0d] dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center">Discovery</h1>
          <div className="flex w-10 items-center justify-end">
            <button className="flex cursor-pointer items-center justify-center rounded-full h-10 w-10 text-[#1b0d0d] dark:text-white">
              <span className="material-symbols-outlined">notifications</span>
            </button>
          </div>
        </div>
        <div className="px-4 py-2">
          <div className="flex w-full items-stretch rounded-xl h-11 bg-[#f3e7e7] dark:bg-[#3d2424]">
            <div className="text-[#9a4c4c] dark:text-[#cc8e8e] flex items-center justify-center pl-4">
              <span className="material-symbols-outlined">search</span>
            </div>
            <input className="form-input flex w-full border-none bg-transparent focus:ring-0 text-[#1b0d0d] dark:text-white placeholder:text-[#9a4c4c] px-3 text-sm" placeholder="Search subreddits or topics"/>
          </div>
        </div>
      </header>

      <section className="mt-2">
        <div className="flex items-center justify-between px-4 pb-3 pt-4">
          <h2 className="text-[#1b0d0d] dark:text-white text-xl font-bold tracking-tight">Trending Subreddits</h2>
          <span className="text-primary text-xs font-semibold">View All</span>
        </div>
        <div className="flex overflow-x-auto no-scrollbar snap-x snap-mandatory px-4 gap-4 pb-4">
          <div className="flex flex-col gap-3 shrink-0 w-64 snap-start">
            <div 
              className="relative w-full aspect-[16/10] rounded-xl overflow-hidden shadow-sm group"
              style={{ backgroundImage: `url("${IMAGES.grammar}")`, backgroundSize: 'cover' }}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-3 left-3 text-white">
                <span className="bg-primary px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Hot</span>
                <p className="text-sm font-bold mt-1">r/grammar</p>
              </div>
            </div>
            <div>
              <p className="text-[#1b0d0d] dark:text-white text-sm font-medium">Master English Rules</p>
              <p className="text-[#9a4c4c] dark:text-[#cc8e8e] text-[11px]">852k members • 4.2k online</p>
            </div>
          </div>
          <div className="flex flex-col gap-3 shrink-0 w-64 snap-start">
            <div 
              className="relative w-full aspect-[16/10] rounded-xl overflow-hidden shadow-sm group"
              style={{ backgroundImage: `url("${IMAGES.casual}")`, backgroundSize: 'cover' }}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-3 left-3 text-white">
                <span className="bg-blue-500 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Active</span>
                <p className="text-sm font-bold mt-1">r/CasualConversation</p>
              </div>
            </div>
            <div>
              <p className="text-[#1b0d0d] dark:text-white text-sm font-medium">Practice Daily Speaking</p>
              <p className="text-[#9a4c4c] dark:text-[#cc8e8e] text-[11px]">1.2m members • 12k online</p>
            </div>
          </div>
        </div>
      </section>

      <nav className="sticky top-[108px] z-40 bg-white dark:bg-[#1b0d0d] border-b border-[#f3e7e7] dark:border-[#3d2424]">
        <div className="flex overflow-x-auto no-scrollbar px-4 gap-6">
          {categories.map((cat, i) => (
            <button 
              key={cat} 
              className={`flex flex-col items-center justify-center pb-3 pt-4 shrink-0 transition-colors ${
                i === 0 ? 'border-b-[2px] border-primary text-primary' : 'border-b-[2px] border-transparent text-[#9a4c4c] dark:text-[#cc8e8e]'
              }`}
            >
              <span className="text-sm font-bold">{cat}</span>
            </button>
          ))}
        </div>
      </nav>

      <main className="flex-1 p-4 space-y-4 mb-2">
        {[
          { name: 'r/Cooking', img: IMAGES.cooking, diff: 'Easy', desc: 'Learn culinary terms and recipes.' },
          { name: 'r/Travel', img: IMAGES.london, diff: 'Intermediate', desc: 'Explore the world with English.' },
        ].map((sub) => (
          <div key={sub.name} className="flex items-center gap-4 bg-[#fcf8f8] dark:bg-[#2d1a1a] p-3 rounded-xl shadow-sm border border-transparent hover:border-primary/20 transition-all cursor-pointer">
            <div className="size-16 rounded-lg bg-cover bg-center shrink-0" style={{ backgroundImage: `url("${sub.img}")` }} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[#1b0d0d] dark:text-white truncate">{sub.name}</h3>
                <span className="bg-[#f3e7e7] dark:bg-[#3d2424] text-[#9a4c4c] dark:text-[#cc8e8e] text-[9px] px-1.5 py-0.5 rounded font-semibold">{sub.diff}</span>
              </div>
              <p className="text-xs text-[#9a4c4c] dark:text-[#cc8e8e] line-clamp-1 mt-0.5">{sub.desc}</p>
              <div className="flex items-center gap-2 mt-2">
                <button className="bg-primary text-white text-[11px] font-bold px-4 py-1.5 rounded-full transition-transform active:scale-95">Join</button>
                <span className="text-[10px] text-[#9a4c4c] dark:text-[#cc8e8e]">3.2M subscribers</span>
              </div>
            </div>
          </div>
        ))}
      </main>
    </div>
  );
};

export default Explore;
