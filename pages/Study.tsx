
import React from 'react';

const Study: React.FC = () => {
  return (
    <div className="relative h-full flex flex-col bg-background-light dark:bg-background-dark overflow-hidden pb-10 transition-all duration-500 overscroll-x-none select-none">
      {/* 锁定层：极致简约磨砂玻璃 */}
      <div className="absolute inset-0 z-[55] backdrop-blur-[15px] bg-white/5 dark:bg-black/10 flex flex-col items-center justify-center pointer-events-auto select-none border-0">
        <div className="flex flex-col items-center gap-4">
          <div className="w-20 h-20 bg-white/10 backdrop-blur-3xl rounded-[2rem] border-2 border-orange-400/20 flex items-center justify-center shadow-2xl shadow-orange-500/5 transition-transform duration-300">
            <span className="material-symbols-outlined text-4xl text-orange-500 fill-[1] drop-shadow-[0_0_15px_rgba(249,115,22,0.6)]">lock</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <h3 className="text-[#1b0d0e] dark:text-white text-xl font-black tracking-tight">Locked</h3>
            <p className="text-gray-500 dark:text-white/40 font-black tracking-[0.2em] uppercase text-[10px]">Study Space Coming Soon</p>
          </div>
        </div>
      </div>
      <header className="sticky top-0 z-[50] flex items-center bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md p-4 pb-2 justify-between">
        <div className="flex size-12 shrink-0 items-center">
          <div
            className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10 border-2 border-primary/20"
            style={{ backgroundImage: `url("https://lh3.googleusercontent.com/aida-public/AB6AXuDgxbURKIeampluH7fuXi7Lee6li_vJfw_n2humWogQ9tp-lhI09xUOFDtf5CqBOKKSxAzdhtfazQKqZkIxZshvgJd3M8J5m3a7YCk4ATAR3yVRBwZgv3gug8e74jcmP1BGPeAzgf3ufv2znkr8b0LR0StR8pDHlQZib0dRez_agylTh94Kyir6CGGBw1MH6npSVIk_UjrFuGQ9Ctqjcb_6Fa9N3lDfY1PQrDlIMHuKWcUTK43lHf_RmbUqJJfL26IlbQ0bVlhzANE")` }}
          />
        </div>
        <h2 className="text-[#1b0d0e] dark:text-[#fcf8f8] text-lg font-bold flex-1 text-center">Study Room</h2>
        <div className="flex w-12 items-center justify-end">
          <button className="flex size-10 items-center justify-center rounded-full bg-white dark:bg-[#3d1a1b] shadow-sm text-[#1b0d0e] dark:text-[#fcf8f8]">
            <span className="material-symbols-outlined text-xl">settings</span>
          </button>
        </div>
      </header>

      <div className="px-4 pt-4 flex gap-3">
        <div className="flex-1 rounded-xl p-5 bg-white dark:bg-[#3d1a1b] shadow-sm border border-black/5">
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-primary text-xl">menu_book</span>
            <p className="text-[#1b0d0e] dark:text-[#fcf8f8] text-sm font-medium">Words Learned</p>
          </div>
          <p className="text-[#1b0d0e] dark:text-white tracking-tight text-3xl font-extrabold">1,284</p>
        </div>
        <div className="flex-1 rounded-xl p-5 bg-primary shadow-lg shadow-primary/20">
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-white text-xl">local_fire_department</span>
            <p className="text-white text-sm font-medium">Daily Streak</p>
          </div>
          <p className="text-white tracking-tight text-3xl font-extrabold">15 Days</p>
        </div>
      </div>

      <div className="px-4 mt-6">
        <div className="bg-white dark:bg-[#3d1a1b] rounded-xl p-5 shadow-sm border border-black/5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[#1b0d0e] dark:text-[#fcf8f8] text-lg font-bold">Weekly Momentum</h3>
            <div className="flex gap-1 items-center">
              <p className="text-[#07885d] text-sm font-semibold">+12%</p>
              <span className="material-symbols-outlined text-[#07885d] text-sm">trending_up</span>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-2 items-end h-32">
            {[40, 85, 30, 50, 70, 95, 60].map((h, i) => (
              <div key={i} className="flex flex-col items-center gap-2 h-full">
                <div className="bg-primary/10 dark:bg-primary/20 rounded-t-full w-full h-full relative overflow-hidden">
                  <div className="absolute bottom-0 w-full bg-primary rounded-t-full transition-all duration-1000" style={{ height: `${h}%` }} />
                </div>
                <p className="text-gray-500 text-[10px] font-bold">{'MTWTFSS'[i]}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 mt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[#1b0d0e] dark:text-[#fcf8f8] text-lg font-bold">Recently Saved Phrases</h3>
          <button className="text-primary text-sm font-bold">View All</button>
        </div>
        <div className="space-y-3">
          {[
            { tag: 'showerthoughts', phrase: '"Out of the blue"', def: 'Happening suddenly and unexpectedly.' },
            { tag: 'explainlikeimfive', phrase: '"Nitty-gritty"', def: 'The most important aspects or practical details.' }
          ].map((item, i) => (
            <div key={i} className="bg-white dark:bg-[#3d1a1b] rounded-xl p-4 shadow-sm border border-black/5 hover:border-primary/20 transition-all cursor-pointer">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <div className="size-6 rounded-full bg-orange-100 flex items-center justify-center text-[10px] font-bold text-orange-600">r/</div>
                  <span className="text-xs font-medium text-gray-500">r/{item.tag}</span>
                </div>
                <span className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">AI Review</span>
              </div>
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="text-lg font-bold text-gray-900 dark:text-white">{item.phrase}</h4>
                  <p className="text-sm text-gray-500 mt-1 italic">{item.def}</p>
                </div>
                <button className="size-10 flex items-center justify-center bg-primary/5 rounded-full text-primary hover:bg-primary/10">
                  <span className="material-symbols-outlined">volume_up</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 mt-8 flex gap-3">
        <button className="flex-1 bg-white dark:bg-[#3d1a1b] text-primary border-2 border-primary py-3.5 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-transform">
          <span className="material-symbols-outlined">quiz</span> Start Quiz
        </button>
        <button className="flex-[1.2] bg-primary text-white py-3.5 rounded-xl font-bold shadow-xl shadow-primary/30 flex items-center justify-center gap-2 active:scale-95 transition-transform">
          <span className="material-symbols-outlined">psychology</span> Review Now
        </button>
      </div>
    </div>
  );
};

export default Study;
