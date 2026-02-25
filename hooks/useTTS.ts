import { useState, useCallback, useRef } from 'react';
import { supabase } from '../supabase';
import { useUserStore } from '../store/useUserStore';
import { useTTSStore } from '../store/useTTSStore';
import { VOICES, getAssetPath } from '../constants';

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

    // 音频分析相关 Refs
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
    const animationFrameRef = useRef<number | null>(null);

    // 优化：使用 getState 获取稳定的 Action 函数，避免每个 hook 实例都订阅 Store
    const setGlobalActiveVoice = useTTSStore.getState().setActiveVoice;
    const setGlobalStopCallback = useTTSStore.getState().setStopCallback;
    const setGlobalAmplitude = useTTSStore.getState().setAmplitude;

    // 清理音频分析资源
    const stopAnalysis = useCallback(() => {
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
        setGlobalAmplitude(0);
    }, [setGlobalAmplitude]);

    // 开始音量分析循环
    const startAnalysis = useCallback(() => {
        if (!analyserRef.current) return;

        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);

        const analyze = () => {
            if (!analyserRef.current) return;
            analyserRef.current.getByteTimeDomainData(dataArray);

            // 计算均方根 (RMS) 振幅
            let sumSquares = 0;
            for (let i = 0; i < dataArray.length; i++) {
                const normalized = (dataArray[i] - 128) / 128; // 归一化到 -1 到 1
                sumSquares += normalized * normalized;
            }
            const rms = Math.sqrt(sumSquares / dataArray.length);

            // 归一化并加一点灵敏度，方便 UI 表现
            const sensivity = 1.8;
            setGlobalAmplitude(Math.min(1, rms * sensivity));

            animationFrameRef.current = requestAnimationFrame(analyze);
        };

        analyze();
    }, [setGlobalAmplitude]);

    const stop = useCallback(async () => {
        stopAnalysis();
        if (audioRef.current) {
            if (playPromiseRef.current) {
                try { await playPromiseRef.current; } catch (e) { /* ignore */ }
            }
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            audioRef.current.src = "";
        }
        setState((prev) => ({ ...prev, isPlaying: false, currentId: null }));

        // 停止播放时清理全局状态
        setGlobalActiveVoice(null);
    }, [setGlobalActiveVoice]);

    const speak = useCallback(async (text: string, id: string, voice?: string, params?: { speech_rate?: number; pitch_rate?: number }) => {
        if (state.isPlaying && state.currentId === id) {
            stop();
            return;
        }

        try {
            /**
             * [关键修复] 在开始新的播放前，先获取并执行全局的停止回调。
             * 这确保了即便不同的组件实例拥有各自独立的 Audio 对象，也能在全局范围内“互斥”播放。
             */
            const currentGlobalStop = useTTSStore.getState().stopCallback;
            if (currentGlobalStop && currentGlobalStop !== stop) {
                try {
                    await currentGlobalStop();
                } catch (e) {
                    console.warn('Failed to stop previous audio:', e);
                }
            }

            // 彻底停止当前实例的残留
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

            /**
             * [关键修复] 仅在开始 speak 时注册当前实例的 stop 函数到全局 Store。
             * 这样避免了多个 useTTS 实例在 useEffect 中抢夺注册权导致的性能问题或白屏。
             */
            const isCloned = finalVoice === 'cloned' && (profile as any)?.cloned_voice_url;

            // 解析头像 URL 和 显示名称
            let finalAvatar: string | null = null;
            let finalName: string | null = null;

            if (isCloned) {
                finalAvatar = (profile as any)?.cloned_voice_avatar_url || null;
                finalName = (profile as any)?.cloned_voice_name || '您的专属音色';
            } else if (finalVoice !== 'System') {
                const fileName = finalVoice === 'Eldric Sage' ? 'Eldric' : finalVoice;
                finalAvatar = getAssetPath(`/avatars/${fileName}.png`);
                finalName = VOICES.find(v => v.id === finalVoice)?.label || finalVoice;
            }

            setGlobalActiveVoice(finalVoice, finalAvatar, finalName);
            setGlobalStopCallback(stop);

            let audioUrls: string[] = [];
            if (text.startsWith('/') && text.endsWith('.wav')) {
                audioUrls = [text];
            } else {
                const isCloned = finalVoice === 'cloned' && (profile as any)?.cloned_voice_url;
                const finalRate = params?.speech_rate ?? (profile?.tts_rate || 1.0);
                const finalPitch = params?.pitch_rate ?? (profile?.tts_pitch || 1.0);

                const cacheKey = `${text}_${finalVoice}_${isCloned ? (profile as any).cloned_voice_url : ''}_rate${finalRate}_pitch${finalPitch}`;
                const cached = cacheRef.current[cacheKey];

                if (cached) {
                    audioUrls = JSON.parse(cached);
                } else {
                    const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tts`;
                    const requestPayload: any = {
                        text,
                        voice: isCloned ? (profile as any).cloned_voice_url : finalVoice,
                        speech_rate: finalRate,
                        pitch_rate: finalPitch
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
                        const errorData = await response.json().catch(() => ({ error: 'Unknown API error' }));
                        throw new Error(`Edge Function Error (${response.status}): ${errorData.error || response.statusText}`);
                    }

                    const { url } = await response.json();
                    if (!url) throw new Error('No audio URL returned from server');

                    audioUrls = Array.isArray(url) ? url : [url];
                    cacheRef.current[cacheKey] = JSON.stringify(audioUrls);
                }
            }

            if (!audioRef.current) {
                audioRef.current = new Audio();
                audioRef.current.crossOrigin = "anonymous";
            }

            // 初始化 AudioContext 和 Analyser
            if (!audioContextRef.current) {
                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
                analyserRef.current = audioContextRef.current.createAnalyser();
                analyserRef.current.fftSize = 256;

                sourceRef.current = audioContextRef.current.createMediaElementSource(audioRef.current);
                sourceRef.current.connect(analyserRef.current);
                analyserRef.current.connect(audioContextRef.current.destination);
            }

            // iOS/Chrome 必须在用户交互后 resume
            if (audioContextRef.current.state === 'suspended') {
                await audioContextRef.current.resume();
            }

            const playQueue = async (index: number) => {
                if (index >= audioUrls.length) {
                    setState((prev) => ({ ...prev, isPlaying: false, currentId: null, isLoading: false }));
                    setGlobalActiveVoice(null); // 彻底播放完后再清空
                    playPromiseRef.current = null;
                    stopAnalysis();
                    return;
                }

                const currentUrl = audioUrls[index];
                const finalUrl = currentUrl.includes('?')
                    ? `${currentUrl}&t=${Date.now()}`
                    : `${currentUrl}?t=${Date.now()}`;

                audioRef.current!.src = finalUrl;
                const playPromise = audioRef.current!.play();
                playPromiseRef.current = playPromise;

                if (playPromise !== undefined) {
                    try {
                        await playPromise;
                        setState((prev) => ({ ...prev, isLoading: false, isPlaying: true }));
                        startAnalysis();
                    } catch (playErr: any) {
                        if (playErr.name === 'AbortError') return;
                        throw playErr;
                    }
                }

                audioRef.current!.onended = () => {
                    playQueue(index + 1);
                };
            };

            await playQueue(0);

        } catch (err: any) {
            console.error('TTS Error:', err);
            setState((prev) => ({
                ...prev,
                isLoading: false,
                isPlaying: false,
                currentId: null,
                error: err.message || 'Speech synthesis failed'
            }));
            setGlobalActiveVoice(null);

            if (!(text.startsWith('/') && text.endsWith('.wav')) && 'speechSynthesis' in window) {
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.lang = 'en-US';
                utterance.onstart = () => {
                    setState(p => ({ ...p, isPlaying: true }));
                    setGlobalActiveVoice('System');
                    setGlobalStopCallback(() => window.speechSynthesis.cancel()); // 降级方案也要支持全局停止
                };
                utterance.onend = () => {
                    setState(p => ({ ...p, isPlaying: false, currentId: null }));
                    setGlobalActiveVoice(null);
                };
                window.speechSynthesis.speak(utterance);
            }
        }
    }, [state.isPlaying, state.currentId, stop, setGlobalActiveVoice, setGlobalStopCallback]);

    return {
        ...state,
        speak,
        stop,
    };
}
