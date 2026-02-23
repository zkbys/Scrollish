import { useState, useCallback, useRef } from 'react';
import { supabase } from '../supabase';
import { useUserStore } from '../store/useUserStore';

interface TTSState {
    isPlaying: boolean;
    isLoading: boolean;
    currentId: string | null;
    error: string | null;
}

/**
 * useTTS Hook
 * 提供高质量语音合成功能，对接 Supabase Edge Function 'tts' (Qwen3-TTS)
 */
export function useTTS() {
    const [state, setState] = useState<TTSState>({
        isPlaying: false,
        isLoading: false,
        currentId: null,
        error: null,
    });

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const playPromiseRef = useRef<Promise<void> | null>(null);
    const cacheRef = useRef<Record<string, string>>({});

    const stop = useCallback(async () => {
        if (audioRef.current) {
            // 如果正在加载/播放，先等待 promise 完成以避免 AbortError
            if (playPromiseRef.current) {
                try { await playPromiseRef.current; } catch (e) { /* ignore */ }
            }
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            audioRef.current.src = ""; // 清空 src 停止加载
        }
        setState((prev) => ({ ...prev, isPlaying: false, currentId: null }));
    }, []);

    const speak = useCallback(async (text: string, id: string, voice?: string) => {
        // 如果正在播放同一条，则停止
        if (state.isPlaying && state.currentId === id) {
            stop();
            return;
        }

        try {
            // 1. 彻底停止当前的
            await stop();

            setState((prev) => ({
                ...prev,
                isLoading: true,
                currentId: id,
                error: null
            }));

            const profile = useUserStore.getState().profile;
            const defaultVoice = profile?.tts_voice || 'Cherry';
            const finalVoice = voice || defaultVoice;

            // 特殊逻辑：如果是预览本地文件 (形如 /.../*.wav)
            let audioUrl = "";
            if (text.startsWith('/') && text.endsWith('.wav')) {
                audioUrl = text;
            } else {
                const isCloned = finalVoice === 'cloned' && (profile as any)?.cloned_voice_url;
                const cacheKey = `${text}_${finalVoice}_${isCloned ? (profile as any).cloned_voice_url : ''}`;
                audioUrl = cacheRef.current[cacheKey];

                if (!audioUrl) {
                    const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tts`;
                    const requestPayload: any = {
                        text,
                        voice: isCloned ? (profile as any).cloned_voice_url : finalVoice
                    };

                    const response = await fetch(functionUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                        },
                        body: JSON.stringify(requestPayload),
                    });

                    if (!response.ok) {
                        const errorMsg = await response.text();
                        throw new Error(`Edge Function Error (${response.status}): ${errorMsg}`);
                    }

                    const { url } = await response.json();
                    if (!url) throw new Error('No audio URL returned from server');
                    audioUrl = url;
                    cacheRef.current[cacheKey] = audioUrl;
                }
            }

            // 2. 播放音频
            if (!audioRef.current) {
                audioRef.current = new Audio();
            }

            // 增加时间戳防止缓存
            const finalUrl = audioUrl.includes('?')
                ? `${audioUrl}&t=${Date.now()}`
                : `${audioUrl}?t=${Date.now()}`;

            audioRef.current.src = finalUrl;

            // 追踪播放 Promise
            const playPromise = audioRef.current.play();
            playPromiseRef.current = playPromise;

            if (playPromise !== undefined) {
                try {
                    await playPromise;
                    setState((prev) => ({ ...prev, isLoading: false, isPlaying: true }));
                } catch (playErr: any) {
                    if (playErr.name === 'AbortError') {
                        console.log('Playback was intentionally aborted.');
                        return; // 被手动停止了，忽略报错
                    }
                    throw playErr;
                }
            }

            audioRef.current.onended = () => {
                setState((prev) => ({ ...prev, isPlaying: false, currentId: null }));
                playPromiseRef.current = null;
            };

        } catch (err: any) {
            console.error('TTS Error:', err);
            setState((prev) => ({
                ...prev,
                isLoading: false,
                isPlaying: false,
                currentId: null,
                error: err.message || 'Speech synthesis failed'
            }));

            // 降级 (仅限普通文字)
            if (!(text.startsWith('/') && text.endsWith('.wav')) && 'speechSynthesis' in window) {
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.lang = 'en-US';
                utterance.onstart = () => setState(p => ({ ...p, isPlaying: true }));
                utterance.onend = () => setState(p => ({ ...p, isPlaying: false, currentId: null }));
                window.speechSynthesis.speak(utterance);
            }
        }
    }, [state.isPlaying, state.currentId, stop]);

    return {
        ...state,
        speak,
        stop,
    };
}
