
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import { MESSAGES, IMAGES } from '../constants';
import { ChatMessage } from '../types';

interface ChatRoomProps {
  postId: string;
  onBack: () => void;
}

const ChatRoom: React.FC<ChatRoomProps> = ({ postId, onBack }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [quotedMessage, setQuotedMessage] = useState<ChatMessage | null>(null);
  const [activeAnalysis, setActiveAnalysis] = useState<ChatMessage['analysis'] | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchComments = async () => {
      try {
        const { data, error } = await supabase
          .from('comments')
          .select('*')
          .eq('post_id', postId)
          .order('depth', { ascending: true })
          .order('upvotes', { ascending: false });

        if (error) throw error;

        if (data && data.length > 0) {
          const mappedMessages: ChatMessage[] = data.map((item: any) => ({
            id: item.id,
            user: item.author,
            avatar: item.author_avatar || IMAGES.avatar1,
            contentEn: item.content,
            contentZh: item.content_zh,
            level: item.depth + 1,
            isAi: item.is_ai,
            analysis: item.analysis,
          }));
          setMessages(mappedMessages);
        } else {
          // Fallback to constants if no data in DB for this post
          setMessages(MESSAGES);
        }
      } catch (err) {
        console.error('Error fetching comments:', err);
        setMessages(MESSAGES);
      } finally {
        setLoading(false);
      }
    };

    fetchComments();
  }, [postId]);

  // Auto-scroll to bottom on load
  useEffect(() => {
    if (scrollRef.current && !loading) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [loading, messages]);

  // Helper to handle highlights in text
  const renderContentWithGlow = (msg: ChatMessage) => {
    if (!msg.analysis) return msg.contentEn;
    const parts = msg.contentEn.split(msg.analysis.keyword);
    return (
      <>
        {parts[0]}
        <span
          onClick={(e) => {
            e.stopPropagation();
            setActiveAnalysis(msg.analysis!);
          }}
          className="text-primary font-black relative animate-glow cursor-help px-1 rounded-sm bg-primary/5 border-b-2 border-primary/40"
        >
          {msg.analysis.keyword}
        </span>
        {parts[1]}
      </>
    );
  };

  return (
    <div className="h-full flex flex-col bg-background-light dark:bg-[#0B0A09] animate-in fade-in slide-in-from-right duration-300 relative">
      {/* Smart Glow Analysis Modal */}
      {activeAnalysis && (
        <div className="absolute inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-end animate-in fade-in duration-200">
          <div className="w-full bg-white dark:bg-gray-900 rounded-t-[2.5rem] p-8 shadow-2xl animate-in slide-in-from-bottom duration-300 border-t border-white/10">
            <div className="flex justify-between items-start mb-6">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary fill-[1]">auto_awesome</span>
                  <span className="bg-primary/10 text-primary text-[10px] px-2 py-0.5 rounded font-black uppercase tracking-widest">{activeAnalysis.type}</span>
                </div>
                <h3 className="text-2xl font-black dark:text-white capitalize tracking-tight">{activeAnalysis.keyword}</h3>
              </div>
              <button onClick={() => setActiveAnalysis(null)} className="text-gray-400 bg-gray-100 dark:bg-white/5 p-2 rounded-full">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed text-[16px] font-medium">
              {activeAnalysis.explanation}
            </p>
            <div className="mt-8 flex gap-3">
              <button className="flex-1 bg-primary text-white font-black py-4 rounded-2xl shadow-lg shadow-primary/20 active:scale-95 transition-transform">Save to Study</button>
              <button className="flex-1 border-2 border-gray-100 dark:border-gray-800 dark:text-white font-black py-4 rounded-2xl active:scale-95 transition-transform">Ask AI More</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl dark:bg-[#0B0A09]/90 border-b border-gray-100 dark:border-white/5 h-20 flex items-center px-4 shrink-0">
        <button
          onClick={onBack}
          className="text-primary h-12 w-12 flex items-center justify-center -ml-2 active:scale-90 transition-transform"
        >
          <span className="material-symbols-outlined text-4xl">chevron_left</span>
        </button>
        <div className="flex items-center gap-3 flex-1 px-2">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
            <span className="material-symbols-outlined text-[24px] font-black">forum</span>
          </div>
          <div className="flex flex-col">
            <h2 className="text-[#1b0e0e] dark:text-white text-[16px] font-black leading-none tracking-tight">Discussion Hub</h2>
            <div className="flex items-center gap-1.5 mt-1">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              <span className="text-[10px] text-orange-600 dark:text-orange-400 font-black uppercase tracking-[0.1em]">Linearized r/GenZ</span>
            </div>
          </div>
        </div>
        <button className="text-gray-400 h-10 w-10 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-white/5 rounded-full transition-colors">
          <span className="material-symbols-outlined text-[28px]">more_horiz</span>
        </button>
      </header>

      {/* Linearized Chat Main */}
      <main
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-6 space-y-8 no-scrollbar pb-48"
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
            <p className="text-primary/50 text-[10px] font-black tracking-widest uppercase">Linearizing Thread...</p>
          </div>
        ) : (
          <>
            <div className="flex justify-center pb-2">
              <div className="px-5 py-2 rounded-full bg-orange-50 dark:bg-white/5 border border-orange-100 dark:border-white/5 text-orange-900/40 dark:text-white/30 text-[10px] font-black uppercase tracking-[0.25em]">
                Beginning of Thread
              </div>
            </div>

            {messages.map((msg) => (
              <div
                key={msg.id}
                className="flex items-start gap-4 group animate-in slide-in-from-bottom-2 duration-500"
              >
                <div className="shrink-0 pt-1 relative">
                  <div
                    className={`bg-center bg-no-repeat aspect-square bg-cover rounded-2xl w-11 h-11 shadow-sm border border-gray-100 dark:border-white/10`}
                    style={{ backgroundImage: `url("${msg.avatar}")` }}
                  />
                  {msg.isAi && (
                    <div className="absolute -bottom-1 -right-1 bg-primary text-white p-0.5 rounded-lg flex items-center justify-center border-2 border-white dark:border-[#0B0A09] shadow-lg">
                      <span className="material-symbols-outlined text-[10px] font-black">auto_awesome</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-1 flex-col gap-2 items-start">
                  <div className="flex items-baseline gap-2 px-1">
                    <p className="text-orange-950/40 dark:text-white/30 text-[11px] font-black uppercase tracking-widest">
                      {msg.user}
                    </p>
                  </div>

                  <div
                    className={`relative rounded-[1.5rem] px-5 py-4 shadow-sm max-w-[92%] border transition-all bg-white dark:bg-white/5 text-[#1b0e0e] dark:text-white border-orange-50 dark:border-white/5 rounded-tl-none cursor-pointer hover:border-primary/40 active:scale-[0.98]`}
                    onClick={() => setQuotedMessage(msg)}
                  >
                    {/* Level 3+ Reference Bar */}
                    {msg.level >= 3 && msg.replyContent && (
                      <div className="rounded-xl p-3 mb-3 border-l-4 bg-orange-50/50 dark:bg-white/5 border-primary/30">
                        <p className="text-[10px] font-black uppercase mb-1 text-primary/60 tracking-tighter">
                          Replying to {msg.replyTo}
                        </p>
                        <p className="text-[13px] italic line-clamp-2 leading-snug text-gray-500 dark:text-gray-400 font-medium">
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
                        <div className="h-[1px] my-4 w-full opacity-5 bg-current" />
                        <p className="text-[14px] font-medium leading-relaxed text-orange-900/60 dark:text-white/40 italic">
                          {msg.contentZh}
                        </p>
                      </>
                    )}

                    {/* Interaction Overlay (on hover/click indicator) */}
                    <div className="absolute -right-2 -bottom-2 opacity-0 group-hover:opacity-100 transition-opacity bg-primary text-white text-[10px] font-black px-2 py-1 rounded-lg shadow-xl">
                      TAP TO ASK
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </main>

      {/* Modern Fixed Bottom Dock */}
      <div className="fixed bottom-0 left-0 right-0 z-[60] safe-area-bottom pointer-events-none">
        <div className="max-w-md mx-auto relative pointer-events-auto">

          {/* Reference Strip (Roleplay / Ask AI) */}
          {quotedMessage && (
            <div className="mx-4 mb-[-12px] bg-white/95 dark:bg-gray-900/95 ios-blur border border-orange-200 dark:border-primary/20 p-4 rounded-t-3xl flex justify-between items-center shadow-2xl animate-in slide-in-from-bottom duration-300">
              <div className="flex gap-4 items-center min-w-0">
                <div className="relative shrink-0">
                  <img src={quotedMessage.avatar} className="w-8 h-8 rounded-xl shadow-sm" alt="" />
                  <div className="absolute -top-1 -right-1 bg-primary text-white p-0.5 rounded-full scale-75">
                    <span className="material-symbols-outlined text-[10px] font-black">psychology</span>
                  </div>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black text-primary uppercase tracking-widest">Roleplay AI Mode</p>
                  <p className="text-[13px] text-gray-500 dark:text-gray-400 truncate font-bold italic">Asking about "{quotedMessage.contentEn}"</p>
                </div>
              </div>
              <button
                onClick={() => setQuotedMessage(null)}
                className="h-8 w-8 flex items-center justify-center bg-gray-100 dark:bg-white/5 rounded-full hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
          )}

          {/* Input Container */}
          <div className="bg-white/80 dark:bg-[#0B0A09]/80 ios-blur p-4 pt-3 pb-8 border-t border-gray-100 dark:border-white/5 shadow-[0_-20px_40px_rgba(0,0,0,0.05)]">
            <div className="flex items-center gap-3">
              <button className="text-gray-400 hover:text-primary h-12 w-12 flex items-center justify-center bg-gray-50 dark:bg-white/5 rounded-2xl transition-colors shrink-0">
                <span className="material-symbols-outlined text-[28px]">add_circle</span>
              </button>

              <div className="flex-1 relative">
                <input
                  className={`w-full bg-gray-50 dark:bg-white/5 border-none focus:ring-2 focus:ring-primary/20 rounded-[1.25rem] py-4 px-5 text-[15px] font-bold dark:text-white placeholder-gray-400 transition-all ${quotedMessage ? 'ring-2 ring-primary/20' : ''}`}
                  placeholder={quotedMessage ? "Ask AI about this take..." : "Message this thread..."}
                  type="text"
                />
              </div>

              <button className={`h-12 w-12 rounded-2xl flex items-center justify-center shadow-lg transition-all active:scale-90 shrink-0 ${quotedMessage ? 'bg-primary text-white shadow-primary/30' : 'bg-gray-100 dark:bg-white/10 text-gray-400'}`}>
                <span className={`material-symbols-outlined text-[24px] font-black ${quotedMessage ? 'fill-[1]' : ''}`}>
                  {quotedMessage ? 'auto_awesome' : 'send'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes glow {
          0%, 100% { 
            box-shadow: 0 0 5px rgba(255, 149, 0, 0.2); 
            background-color: rgba(255, 149, 0, 0.05);
            border-bottom-color: rgba(255, 149, 0, 0.4); 
          }
          50% { 
            box-shadow: 0 0 15px rgba(255, 149, 0, 0.4); 
            background-color: rgba(255, 149, 0, 0.1);
            border-bottom-color: rgba(255, 149, 0, 1); 
          }
        }
        .animate-glow {
          animation: glow 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default ChatRoom;
