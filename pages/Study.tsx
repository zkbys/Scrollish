import React, { useState } from 'react'
import { useDictionaryStore } from '../store/useDictionaryStore'

const Study: React.FC = () => {
  const { dictionaries, activeDictionaryId, setActiveDictionary, isLoading } = useDictionaryStore()
  const [showDictionarySelector, setShowDictionarySelector] = useState(false)

  const activeDictionary = dictionaries.find(d => d.id === activeDictionaryId)

  return (
    <div className="h-full flex flex-col bg-[#0F0F0F] overflow-y-auto no-scrollbar pb-20">
      {/* Header */}
      <header className="sticky top-0 z-20 flex items-center bg-[#0F0F0F]/80 backdrop-blur-xl border-b border-white/5 p-4 justify-between">
        <div className="flex items-center gap-3">
          <div
            className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10 border-2 border-orange-500/30"
            style={{ backgroundImage: `url("https://lh3.googleusercontent.com/aida-public/AB6AXuDgxbURKIeampluH7fuXi7Lee6li_vJfw_n2humWogQ9tp-lhI09xUOFDtf5CqBOKKSxAzdhtfazQKqZkIxZshvgJd3M8J5m3a7YCk4ATAR3yVRBwZgv3gug8e74jcmP1BGPeAzgf3ufv2znkr8b0LR0StR8pDHlQZib0dRez_agylTh94Kyir6CGGBw1MH6npSVIk_UjrFuGQ9Ctqjcb_6Fa9N3lDfY1PQrDlIMHuKWcUTK43lHf_RmbUqJJfL26IlbQ0bVlhzANE")` }}
          />
          <div>
            <h2 className="text-white text-lg font-bold">Study Room</h2>
            <p className="text-white/40 text-xs font-medium">Keep learning every day</p>
          </div>
        </div>
        <button className="flex size-10 items-center justify-center rounded-full bg-white/5 text-white hover:bg-white/10 transition-colors">
          <span className="material-symbols-outlined text-xl">settings</span>
        </button>
      </header>

      {/* Active Dictionary Card */}
      <div className="px-4 pt-6">
        <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl p-6 shadow-2xl shadow-orange-500/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-white text-2xl">menu_book</span>
                <span className="bg-white/20 text-white text-[10px] px-2 py-1 rounded-full font-black uppercase tracking-wider">
                  Active
                </span>
              </div>
              <button
                onClick={() => setShowDictionarySelector(true)}
                className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-full text-xs font-bold transition-colors flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">swap_horiz</span>
                Switch
              </button>
            </div>
            <h3 className="text-white text-2xl font-black mb-2">
              {activeDictionary?.name || 'No Dictionary Selected'}
            </h3>
            <p className="text-white/80 text-sm">
              {activeDictionary?.description || 'Select a dictionary to start learning'}
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="px-4 pt-4 flex gap-3">
        <div className="flex-1 rounded-xl p-5 bg-[#1A1A1A] border border-white/5">
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-orange-500 text-xl">psychology</span>
            <p className="text-white/60 text-sm font-medium">Words Learned</p>
          </div>
          <p className="text-white tracking-tight text-3xl font-extrabold">1,284</p>
        </div>
        <div className="flex-1 rounded-xl p-5 bg-gradient-to-br from-orange-500 to-red-600 shadow-lg shadow-orange-500/20">
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-white text-xl">local_fire_department</span>
            <p className="text-white text-sm font-medium">Daily Streak</p>
          </div>
          <p className="text-white tracking-tight text-3xl font-extrabold">15 Days</p>
        </div>
      </div>

      {/* Weekly Progress */}
      <div className="px-4 mt-6">
        <div className="bg-[#1A1A1A] border border-white/5 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white text-lg font-bold">Weekly Progress</h3>
            <div className="flex gap-1 items-center">
              <p className="text-green-400 text-sm font-semibold">+12%</p>
              <span className="material-symbols-outlined text-green-400 text-sm">trending_up</span>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-2 items-end h-32">
            {[40, 85, 30, 50, 70, 95, 60].map((h, i) => (
              <div key={i} className="flex flex-col items-center gap-2 h-full">
                <div className="bg-white/5 rounded-t-full w-full h-full relative overflow-hidden">
                  <div
                    className="absolute bottom-0 w-full bg-gradient-to-t from-orange-500 to-red-500 rounded-t-full transition-all duration-1000"
                    style={{ height: `${h}%` }}
                  />
                </div>
                <p className="text-white/40 text-[10px] font-bold">{'MTWTFSS'[i]}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recently Saved Words */}
      <div className="px-4 mt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white text-lg font-bold">Recently Saved</h3>
          <button className="text-orange-500 text-sm font-bold">View All</button>
        </div>
        <div className="space-y-3">
          {[
            { word: 'community', def: 'n. 社区；团体；共同体', source: 'r/AskReddit' },
            { word: 'discussion', def: 'n. 讨论；商讨', source: 'r/todayilearned' }
          ].map((item, i) => (
            <div key={i} className="bg-[#1A1A1A] border border-white/5 rounded-xl p-4 hover:border-orange-500/30 transition-all cursor-pointer">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <div className="size-6 rounded-full bg-orange-500/20 flex items-center justify-center text-[10px] font-bold text-orange-500">r/</div>
                  <span className="text-xs font-medium text-white/40">{item.source}</span>
                </div>
                <span className="bg-orange-500/10 text-orange-500 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">VIP</span>
              </div>
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="text-lg font-bold text-white">{item.word}</h4>
                  <p className="text-sm text-white/60 mt-1">{item.def}</p>
                </div>
                <button className="size-10 flex items-center justify-center bg-orange-500/10 rounded-full text-orange-500 hover:bg-orange-500/20 transition-colors">
                  <span className="material-symbols-outlined">volume_up</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="px-4 mt-8 flex gap-3">
        <button className="flex-1 bg-white/10 text-white border border-white/10 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform hover:bg-white/15">
          <span className="material-symbols-outlined">quiz</span> Start Quiz
        </button>
        <button className="flex-[1.2] bg-gradient-to-r from-orange-500 to-red-600 text-white py-3.5 rounded-xl font-bold shadow-xl shadow-orange-500/30 flex items-center justify-center gap-2 active:scale-95 transition-transform">
          <span className="material-symbols-outlined">psychology</span> Review Now
        </button>
      </div>

      {/* Dictionary Selector Modal */}
      {showDictionarySelector && (
        <div
          className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-md flex items-end animate-in fade-in duration-200"
          onClick={() => setShowDictionarySelector(false)}>
          <div
            className="w-full bg-gradient-to-b from-[#1A1A1A] to-[#0B0A09] rounded-t-[2.5rem] p-6 pb-12 shadow-2xl animate-in slide-in-from-bottom duration-300 border-t border-white/10 max-h-[70vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-white text-xl font-black">Select Dictionary</h3>
              <button
                onClick={() => setShowDictionarySelector(false)}
                className="text-white/40 bg-white/5 p-2 rounded-full hover:bg-white/10 transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-4">
                <div className="w-8 h-8 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin"></div>
                <p className="text-orange-500/50 text-[10px] font-black tracking-widest uppercase animate-pulse">
                  Loading Dictionaries...
                </p>
              </div>
            ) : dictionaries.length === 0 ? (
              <div className="text-center py-12">
                <span className="material-symbols-outlined text-white/20 text-6xl mb-4">menu_book</span>
                <p className="text-white/40 text-sm">No dictionaries available</p>
                <p className="text-white/20 text-xs mt-2">Use the dev tools to seed sample data</p>
              </div>
            ) : (
              <div className="space-y-3">
                {dictionaries.map((dict) => (
                  <button
                    key={dict.id}
                    onClick={() => {
                      setActiveDictionary(dict.id)
                      setShowDictionarySelector(false)
                    }}
                    className={`w-full text-left p-4 rounded-xl border transition-all ${dict.id === activeDictionaryId
                        ? 'bg-orange-500/10 border-orange-500/50'
                        : 'bg-white/5 border-white/5 hover:border-white/20'
                      }`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-white font-bold">{dict.name}</h4>
                          {dict.type === 'system' && (
                            <span className="bg-blue-500/20 text-blue-400 text-[9px] px-2 py-0.5 rounded-full font-black uppercase">
                              System
                            </span>
                          )}
                        </div>
                        {dict.description && (
                          <p className="text-white/50 text-xs">{dict.description}</p>
                        )}
                      </div>
                      {dict.id === activeDictionaryId && (
                        <span className="material-symbols-outlined text-orange-500">check_circle</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default Study
