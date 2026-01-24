
import React, { useState, useEffect } from 'react';
import { MESSAGES, IMAGES } from '../constants';
import { ChatMessage } from '../types';

interface ChatRoomProps {
  onBack: () => void;
}

const ChatRoom: React.FC<ChatRoomProps> = ({ onBack }) => {
  const [quotedMessage, setQuotedMessage] = useState<ChatMessage | null>(null);
  const [activeAnalysis, setActiveAnalysis] = useState<ChatMessage['analysis'] | null>(null);

  // Helper to handle highlights in text
  const renderContentWithGlow = (msg: ChatMessage) => {
    if (!msg.analysis) return msg.contentEn;
    const parts = msg.contentEn.split(msg.analysis.keyword);
    return (
      <>
        {parts[0]}
        <span 
          onClick={() => setActiveAnalysis(msg.analysis!)}
          className="text-primary font-black relative animate-glow cursor-help px-1 rounded-sm bg-primary/5 border-b border-primary/20"
        >
          {msg.analysis.keyword}
        </span>
        {parts[1]}
      </>
    );
  };

  return (
    <div className="h-full flex flex-col bg-background-light dark:bg-[#0B0A09] animate-in fade-in slide-in-from-right duration-300 relative">
      {/* Smart Glow Analysis Modal (Subtle Overlay) */}
      {activeAnalysis && (
        <div className="absolute inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-end animate-in fade-in duration-200">
          <div className="w-full bg-white dark:bg-gray-900 rounded-t-3xl p-6 shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary fill-[1]">auto_awesome</span>
                <h3 className="text-lg font-black dark:text-white capitalize">{activeAnalysis.keyword}</h3>
                <span className="bg-primary/10 text-primary text-[10px] px-2 py-0.5 rounded font-bold uppercase">{activeAnalysis.type}</span>
              </div>
              <button onClick={() => setActiveAnalysis(null)} className="text-gray-400">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed text-[15px]">
              {activeAnalysis.explanation}
            </p>
            <div className="mt-6 flex gap-2">
              <button className="flex-1 bg-primary text-white font-bold py-3 rounded-xl">Save to Study</button>
              <button className="flex-1 border border-gray-200 dark:border-gray-700 dark:text-white font-bold py-3 rounded-xl">Ask AI More</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl dark:bg-[#0B0A09]/90 border-b border-orange-100 dark:border-white/5 h-16 flex items-center px-4">
        <button 
          onClick={onBack}
          className="text-primary h-10 w-10 flex items-center justify-center -ml-2 active:scale-90 transition-transform"
        >
          <span className="material-symbols-outlined text-3xl">chevron_left</span>
        </button>
        <div className="flex items-center gap-3 flex-1 px-1">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
             <span className="material-symbols-outlined text-[20px] font-black">forum</span>
          </div>
          <div className="flex flex-col">
            <h2 className="text-[#1b0e0e] dark:text-white text-[15px] font-black leading-none">r/GenZ</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              <span className="text-[10px] text-orange-600 dark:text-orange-400 font-bold uppercase tracking-wider">Linearized Thread</span>
            </div>
          </div>
        </div>
        <button className="text-[#1b0e0e] dark:text-white h-10 w-10 flex items-center justify-center hover:opacity-60 transition-opacity">
          <span className="material-symbols-outlined text-[28px]">more_horiz</span>
        </button>
      </header>

      {/* Linearized Chat Main */}
      <main className="flex-1 overflow-y-auto px-4 py-6 space-y-6 no-scrollbar pb-32">
        <div className="flex justify-center pb-4">
          <div className="px-4 py-1.5 rounded-full bg-orange-100 dark:bg-white/5 text-orange-900/50 dark:text-white/40 text-[10px] font-black uppercase tracking-[0.2em]">
            Linearized Reddit Thread
          </div>
        </div>

        {MESSAGES.map((msg) => (
          <div 
            key={msg.id} 
            className="flex items-start gap-3.5 group"
            onContextMenu={(e) => {
              e.preventDefault();
              setQuotedMessage(msg);
            }}
          >
            <div className="shrink-0 pt-0.5">
              <div 
                className={`bg-center bg-no-repeat aspect-square bg-cover rounded-[1rem] w-10 h-10 shadow-sm border border-gray-200 dark:border-white/10`} 
                style={{ backgroundImage: `url("${msg.avatar}")` }}
              />
              {msg.isAi && (
                <div className="absolute -bottom-1 -right-1 bg-accent text-white p-0.5 rounded-md flex items-center justify-center border-2 border-background-light shadow-lg">
                  <span className="material-symbols-outlined text-[10px] font-black">auto_awesome</span>
                </div>
              )}
            </div>
            
            <div className="flex flex-1 flex-col gap-1.5 items-start">
              <div className="flex items-baseline gap-2 px-1">
                <p className="text-orange-950/40 dark:text-white/30 text-[11px] font-black uppercase tracking-wider">
                  {msg.user}
                </p>
              </div>

              <div 
                className={`relative rounded-2xl px-5 py-4 shadow-sm max-w-[95%] border transition-all bg-white dark:bg-white/5 text-[#1b0e0e] dark:text-white border-orange-100 dark:border-white/10 rounded-tl-none cursor-pointer hover:border-primary/30`}
                onClick={() => setQuotedMessage(msg)}
              >
                {/* Level 3+ Reference Bar */}
                {msg.level >= 3 && msg.replyContent && (
                  <div className="rounded-xl p-3 mb-3 border-l-4 bg-orange-50 dark:bg-white/5 border-primary/40">
                    <p className="text-[10px] font-black uppercase mb-0.5 text-primary">
                      Replying to {msg.replyTo}
                    </p>
                    <p className="text-xs italic line-clamp-2 leading-relaxed text-gray-500 dark:text-gray-400">
                      "{msg.replyContent}"
                    </p>
                  </div>
                )}
                
                {/* Main Content with Glow */}
                <p className="text-[16px] leading-relaxed font-bold tracking-tight">
                  {renderContentWithGlow(msg)}
                </p>
                
                {msg.contentZh && (
                  <>
                    <div className="h-[1px] my-3 w-full opacity-10 bg-current" />
                    <p className="text-[14px] font-medium leading-relaxed text-orange-900/50 dark:text-white/40">
                      {msg.contentZh}
                    </p>
                  </>
                )}

                {/* AI Snippet Indicator */}
                {msg.analysis && (
                  <div className="mt-4 flex items-center gap-1.5 px-2 py-1 bg-primary text-white rounded-lg w-fit shadow-md shadow-primary/20">
                    <span className="material-symbols-outlined text-[12px] font-black">lightbulb</span>
                    <span className="text-[10px] font-black uppercase tracking-tighter">AI Analyzed</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </main>

      {/* Input Section with Ask AI Quote Strip */}
      <div className="fixed bottom-20 left-0 right-0 z-[60] px-4 safe-area-bottom">
        <div className="max-w-md mx-auto relative">
          
          {/* Reference Bar (Ask AI) */}
          {quotedMessage && (
            <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border border-orange-200 dark:border-primary/20 p-3 rounded-t-2xl mb-[-1px] flex justify-between items-center shadow-lg animate-in slide-in-from-bottom duration-300">
              <div className="flex gap-3 items-center min-w-0">
                <img src={quotedMessage.avatar} className="w-6 h-6 rounded-lg opacity-80" alt="" />
                <div className="min-w-0">
                  <p className="text-[10px] font-black text-primary uppercase">Ask AI about {quotedMessage.user}'s take</p>
                  <p className="text-xs text-gray-500 truncate italic">"{quotedMessage.contentEn}"</p>
                </div>
              </div>
              <button onClick={() => setQuotedMessage(null)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
          )}

          {/* Input Bar */}
          <div className={`bg-white dark:bg-gray-900 p-3 flex items-center gap-3 shadow-[0_-10px_30px_rgba(0,0,0,0.08)] ${quotedMessage ? 'rounded-b-2xl border-x border-b border-orange-200 dark:border-primary/20' : 'rounded-3xl border border-orange-100 dark:border-white/10'}`}>
            <button className="text-gray-400 hover:text-primary">
              <span className="material-symbols-outlined text-[30px]">image</span>
            </button>
            <div className="flex-1 relative">
              <input 
                className="w-full bg-orange-50/50 dark:bg-white/5 border-none focus:ring-0 rounded-2xl py-3 px-4 text-[15px] dark:text-white placeholder-orange-300" 
                placeholder={quotedMessage ? "Type query for AI..." : "Message in English..."}
                type="text"
              />
            </div>
            <button className="bg-primary text-white h-11 w-11 rounded-full flex items-center justify-center shadow-xl shadow-primary/30 active:scale-90 transition-all">
              <span className="material-symbols-outlined text-[24px] font-black fill-[1]">send</span>
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes glow {
          0%, 100% { box-shadow: 0 0 5px rgba(255, 149, 0, 0.2); border-color: rgba(255, 149, 0, 0.4); }
          50% { box-shadow: 0 0 15px rgba(255, 149, 0, 0.5); border-color: rgba(255, 149, 0, 0.8); }
        }
        .animate-glow {
          animation: glow 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default ChatRoom;
