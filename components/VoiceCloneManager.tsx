import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../supabase'
import { useUserStore } from '../store/useUserStore'
import { useAuthStore } from '../store/useAuthStore'
import { getAssetPath } from '../constants'

interface VoiceCloneManagerProps {
    onClose: () => void
    onSuccess: (url: string, text: string) => void
}

/**
 * WAV 编码辅助函数
 * 将 Float32Array PCM 数据转换为 16-bit WAV 格式
 */
const encodeWAV = (samples: Float32Array, sampleRate: number) => {
    const buffer = new ArrayBuffer(44 + samples.length * 2)
    const view = new DataView(buffer)

    const writeString = (view: DataView, offset: number, string: string) => {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i))
        }
    }

    writeString(view, 0, 'RIFF')
    view.setUint32(4, 36 + samples.length * 2, true)
    writeString(view, 8, 'WAVE')
    writeString(view, 12, 'fmt ')
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true)
    view.setUint16(22, 1, true)
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, sampleRate * 2, true)
    view.setUint16(32, 2, true)
    view.setUint16(34, 16, true)
    writeString(view, 36, 'data')
    view.setUint32(40, samples.length * 2, true)

    // Float to 16-bit PCM
    let offset = 44
    for (let i = 0; i < samples.length; i++, offset += 2) {
        const s = Math.max(-1, Math.min(1, samples[i]))
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true)
    }

    return new Blob([buffer], { type: 'audio/wav' })
}

const VoiceCloneManager: React.FC<VoiceCloneManagerProps> = ({ onClose, onSuccess }) => {
    const [status, setStatus] = useState<'idle' | 'recording' | 'preview' | 'processing' | 'uploading' | 'identity_setup' | 'success'>('idle')
    const [recordingTime, setRecordingTime] = useState(0)
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
    const [audioUrl, setAudioUrl] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    // 新增身份设置状态
    const [setupName, setSetupName] = useState('')
    const [setupDesc, setSetupDesc] = useState('')
    const [setupAvatar, setSetupAvatar] = useState<string | null>(null)
    const [clonedVoiceUrl, setClonedVoiceUrl] = useState<string | null>(null)
    const [isSavingIdentity, setIsSavingIdentity] = useState(false)
    const setupAvatarRef = useRef<HTMLInputElement>(null)

    // 录音相关引用
    const audioContextRef = useRef<AudioContext | null>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const processorRef = useRef<ScriptProcessorNode | null>(null)
    const samplesRef = useRef<Float32Array[]>([])

    const timerRef = useRef<number | null>(null)

    const { profile, updateProfile, deductCoins } = useUserStore()
    const { currentUser: user } = useAuthStore()

    const referenceText = "你好！很高兴能通过声音和你交流。让我们一起开启这段奇妙的语言旅程，探索更广阔的世界吧。"
    const CLONE_COST = 100 // 复刻消耗的金币

    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current)
            if (audioUrl) URL.revokeObjectURL(audioUrl)
            cleanupRecording()
        }
    }, [audioUrl])

    const cleanupRecording = () => {
        try {
            if (processorRef.current) {
                processorRef.current.disconnect()
                processorRef.current = null
            }
            if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
                audioContextRef.current.close().catch(e => console.warn('AudioContext close error:', e))
            }
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(t => t.stop())
                streamRef.current = null
            }
        } catch (e) {
            console.warn('Cleanup error:', e)
        }
    }

    const startRecording = async () => {
        try {
            setError(null)
            samplesRef.current = []

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            streamRef.current = stream

            const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext
            const audioContext = new AudioContextClass()
            audioContextRef.current = audioContext

            const source = audioContext.createMediaStreamSource(stream)
            const processor = audioContext.createScriptProcessor(4096, 1, 1)
            processorRef.current = processor

            processor.onaudioprocess = (e: any) => {
                const inputData = e.inputBuffer.getChannelData(0)
                samplesRef.current.push(new Float32Array(inputData))
            }

            source.connect(processor)
            processor.connect(audioContext.destination)

            setStatus('recording')
            setRecordingTime(0)
            timerRef.current = window.setInterval(() => {
                setRecordingTime(prev => prev + 1)
            }, 1000)

            // 最多录制 15 秒
            setTimeout(() => {
                if (status === 'recording') stopRecording()
            }, 15000)

        } catch (err: any) {
            console.error('Failed to start recording:', err)
            setError('无法访问麦克风，请检查权限设置。')
        }
    }

    const processAudioBuffer = (audioBuffer: AudioBuffer) => {
        // 阿里云要求录制/上传时长在 10s 到 60s 之间以保证质量
        if (audioBuffer.duration < 10) {
            setError('音频太短啦 (建议至少 10 秒)，请录制或上传稍长一点的内容。')
            setStatus('idle')
            return Promise.reject(new Error('Audio too short'))
        }

        const MAX_DURATION = 20 // 自动截取前 20 秒作为最佳样本
        const finalDuration = Math.min(audioBuffer.duration, MAX_DURATION)

        const targetSampleRate = 24000
        const offlineCtx = new OfflineAudioContext(1, Math.round(finalDuration * targetSampleRate), targetSampleRate)
        const source = offlineCtx.createBufferSource()
        source.buffer = audioBuffer
        source.connect(offlineCtx.destination)
        source.start()

        return offlineCtx.startRendering().then(renderedBuffer => {
            const finalSamples = renderedBuffer.getChannelData(0)
            const blob = encodeWAV(finalSamples, targetSampleRate)
            const url = URL.createObjectURL(blob)
            setAudioBlob(blob)
            setAudioUrl(url)
            setStatus('preview')
            // 如果发生了截取，记录一下
            if (audioBuffer.duration > MAX_DURATION) {
                console.log('Audio truncated from', audioBuffer.duration.toFixed(1), 's to', MAX_DURATION, 's')
            }
        })
    }

    const stopRecording = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current)
            timerRef.current = null
        }

        if (status !== 'recording') return

        if (samplesRef.current.length === 0) {
            setError('未采集到任何音频数据，请再试一次。')
            setStatus('idle')
            cleanupRecording()
            return
        }

        const audioContext = audioContextRef.current!
        const totalLength = samplesRef.current.reduce((acc, s) => acc + s.length, 0)
        const combined = new Float32Array(totalLength)
        let offset = 0
        for (const s of samplesRef.current) {
            combined.set(s, offset)
            offset += s.length
        }

        const audioBuffer = audioContext.createBuffer(1, totalLength, audioContext.sampleRate)
        audioBuffer.copyToChannel(combined, 0)

        processAudioBuffer(audioBuffer).catch(e => {
            console.error('Processing error:', e)
            setError('音频处理失败，请重试。')
        })

        cleanupRecording()
    }

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        // 限制输入文件大小为 50MB，防止 decodeAudioData 导致浏览器崩溃
        const MAX_INPUT_SIZE = 50 * 1024 * 1024
        if (file.size > MAX_INPUT_SIZE) {
            setError('文件太大啦 (超过 50MB)。请选择一个小一点的文件。')
            return
        }

        setStatus('processing') // 使用专用处理状态
        setError(null)

        try {
            const arrayBuffer = await file.arrayBuffer()
            const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext
            const tempCtx = new AudioContextClass()
            const audioBuffer = await tempCtx.decodeAudioData(arrayBuffer)

            await processAudioBuffer(audioBuffer)
            await tempCtx.close()

            console.log('File processed successfully:', file.name)
        } catch (err: any) {
            console.error('File processing failed:', err)
            setError('无法处理该文件。请确保是有效的音频或视频格式。')
            setStatus('idle')
        }
    }

    const handleUpload = async () => {
        if (!audioBlob || !user) return

        // 检查处理后的 Blob 大小是否超过 10MB (阿里云 API 限制)
        if (audioBlob.size > 10 * 1024 * 1024) {
            setError('处理后的音频文件依然过大 (超过 10MB)。请尝试缩短录音时长或上传更短的文件。')
            return
        }

        setStatus('uploading')
        setError(null)

        try {
            // 1. 先同步上传到 Storage 获取公网 URL (比 Base64 传输更稳定)
            const fileName = `clones/${user.id}/${Date.now()}.wav`
            const BUCKET_NAME = 'voice-clones'

            const { error: uploadError } = await supabase.storage
                .from(BUCKET_NAME)
                .upload(fileName, audioBlob, {
                    contentType: 'audio/wav',
                    upsert: true
                });

            if (uploadError) throw new Error(`素材上传失败: ${uploadError.message}`);

            // 2. 获取公网访问 URL (使用签名链接确保私有存储桶也能被阿里云访问)
            const { data, error: signedUrlError } = await supabase.storage
                .from(BUCKET_NAME)
                .createSignedUrl(fileName, 3600); // 1小时有效期

            if (signedUrlError) throw new Error(`获取授权链接失败: ${signedUrlError.message}`);
            const publicUrl = data.signedUrl;
            console.log('Audio uploaded to storage. Signed URL obtained.');

            // 3. 调用 Edge Function 进行语音复刻 (Enrollment)
            // 阿里云大约需要 3-8 秒进行 AI 特征提取
            const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tts`;
            const enrollResponse = await fetch(functionUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                },
                body: JSON.stringify({
                    action: 'enroll',
                    reference_audio: publicUrl, // 现在传递的是稳定的 URL
                    preferred_name: `user_${user.id.substring(0, 8)}`
                }),
            });

            const enrollResult = await enrollResponse.json();
            if (!enrollResponse.ok) {
                throw new Error(enrollResult.error || '语音复刻注册失败');
            }

            const voiceId = enrollResult.output.voice;
            console.log('Enrollment successful. Voice ID:', voiceId);

            // 4. 更新用户 Profile，保存永久 Voice ID
            await updateProfile({
                cloned_voice_url: voiceId, // 这里存的是 ID
                cloned_voice_text: referenceText,
                tts_voice: 'cloned'
            })

            // 5. Deduct Coins
            const success = await deductCoins(CLONE_COST)
            if (!success) {
                // If coin deduction fails, revert status and show error
                setError('哆吧币余额不足，无法完成复刻。')
                setStatus('preview') // Or 'idle' depending on desired flow
                return
            }

            setClonedVoiceUrl(voiceId)
            setStatus('identity_setup')

        } catch (err: any) {
            console.error('Cloning failed:', err)
            setError(err.message || '操作失败，请重试。')
            setStatus('preview')
        }
    }

    /**
     * 处理设置页面的头像上传
     */
    const handleSetupAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !user) return

        try {
            setIsSavingIdentity(true)
            const fileExt = file.name.split('.').pop()
            const fileName = `${user.id}_cloned_avatar_${Math.random()}.${fileExt}`
            const filePath = `${user.id}/${fileName}`

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file)

            if (uploadError) throw uploadError

            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath)

            setSetupAvatar(publicUrl)
        } catch (err: any) {
            console.error('Avatar upload failed:', err)
            alert('头像上传失败，请重试。')
        } finally {
            setIsSavingIdentity(false)
        }
    }

    /**
     * 最终保存所有身份信息
     */
    const finishSetup = async () => {
        if (!user || !clonedVoiceUrl) return

        try {
            setIsSavingIdentity(true)

            // 使用默认值
            const finalName = setupName.trim() || '自定义音色'
            const finalDesc = setupDesc.trim() || '你的专属 AI 声线'

            const { error: updateError } = await supabase
                .from('profiles')
                .update({
                    cloned_voice_url: clonedVoiceUrl,
                    cloned_voice_text: referenceText,
                    cloned_voice_name: finalName,
                    cloned_voice_desc: finalDesc,
                    cloned_voice_avatar_url: setupAvatar,
                    updated_at: new Date().toISOString()
                })
                .eq('id', user.id)

            if (updateError) throw updateError

            // 更新本地 store
            updateProfile({
                cloned_voice_url: clonedVoiceUrl,
                cloned_voice_text: referenceText,
                cloned_voice_name: finalName,
                cloned_voice_desc: finalDesc,
                cloned_voice_avatar_url: setupAvatar
            })

            setStatus('success')
            setTimeout(() => {
                onSuccess(clonedVoiceUrl, referenceText)
            }, 1000)

        } catch (err: any) {
            console.error('Save identity failed:', err)
            setError('保存身份信息失败，请重试。')
        } finally {
            setIsSavingIdentity(false)
        }
    }

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-white dark:bg-[#1C1C1E] p-6 sm:p-8 rounded-[32px] shadow-2xl border border-gray-100 dark:border-white/5 w-full max-w-[min(90vw,420px)] mx-auto max-h-[90vh] overflow-y-auto no-scrollbar"
            onClick={e => e.stopPropagation()}
        >
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black dark:text-white">自定义声色</h3>
                <button
                    onClick={onClose}
                    className="w-8 h-8 flex items-center justify-center bg-gray-100 dark:bg-white/5 rounded-full text-gray-400"
                >
                    <span className="material-symbols-outlined text-sm">close</span>
                </button>
            </div>

            <div className="space-y-6">
                {status === 'idle' && (
                    <div className="text-center space-y-4">
                        <div className="w-20 h-20 bg-orange-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="material-symbols-outlined text-3xl text-orange-500">record_voice_over</span>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                            可以选择直接录音，也可以上传现有的音频或视频文件（如：包含人声的 MP4）。
                        </p>
                        <div className="p-4 bg-gray-50 dark:bg-white/5 rounded-2xl border border-dashed border-gray-200 dark:border-white/10">
                            <p className="text-xs text-gray-400 mb-2 uppercase font-bold tracking-wider">建议时长</p>
                            <p className="text-sm font-medium dark:text-white italic">"10 到 20 秒的高质量原声"</p>
                        </div>
                        <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-2xl flex items-start gap-3 text-left">
                            <span className="material-symbols-outlined text-orange-500 mt-0.5">lightbulb</span>
                            <div>
                                <p className="text-[13px] font-black text-orange-950 dark:text-orange-200">复刻小贴士</p>
                                <p className="text-[11px] font-bold text-orange-800/80 dark:text-orange-300/80 mt-0.5 leading-relaxed">
                                    录制时像真正阅读一样**带有感情地朗读**，生成的音色会更自然、更有表现力哦！
                                </p>
                            </div>
                        </div>

                        <div className="p-3 bg-orange-500/5 dark:bg-orange-500/10 rounded-2xl border border-orange-500/10 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <img src={getAssetPath('/dopa_coin.png')} className="w-5 h-5 object-contain" alt="Dopa Coin" />
                                <span className="text-xs font-bold text-gray-600 dark:text-white/60">本次复刻消耗</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <span className={`text-sm font-black ${profile?.coins < CLONE_COST ? 'text-red-500' : 'text-orange-500'}`}>{CLONE_COST}</span>
                                <span className="text-[10px] font-bold text-gray-400">哆吧币</span>
                            </div>
                        </div>

                        {profile?.coins < CLONE_COST && (
                            <div className="px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2">
                                <span className="material-symbols-outlined text-red-500 text-sm">error</span>
                                <p className="text-[11px] font-bold text-red-600 dark:text-red-400">哆吧币不足，快去学习赚取吧！</p>
                            </div>
                        )}

                        <div className="grid grid-cols-1 gap-3">
                            <button
                                onClick={startRecording}
                                disabled={profile?.coins < CLONE_COST}
                                className={`w-full py-4 rounded-2xl font-black transition-all flex items-center justify-center gap-2 ${profile?.coins < CLONE_COST
                                    ? 'bg-gray-200 dark:bg-white/5 text-gray-400 cursor-not-allowed opacity-50'
                                    : 'bg-orange-500 text-white shadow-lg active:scale-95'}`}
                            >
                                <span className="material-symbols-outlined">mic</span>
                                立即录制
                            </button>
                            <label className="w-full py-4 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 rounded-2xl font-bold transition-all cursor-pointer flex items-center justify-center gap-2">
                                <span className="material-symbols-outlined">upload_file</span>
                                上传文件 (MP4/MP3)
                                <input
                                    type="file"
                                    className="hidden"
                                    accept="audio/*,video/*"
                                    onChange={handleFileSelect}
                                />
                            </label>
                        </div>
                    </div>
                )}

                {status === 'recording' && (
                    <div className="text-center space-y-6 py-8">
                        <div className="relative inline-block">
                            <motion.div
                                animate={{ scale: [1, 1.2, 1] }}
                                transition={{ repeat: Infinity, duration: 1 }}
                                className="w-24 h-24 bg-red-500/20 rounded-full flex items-center justify-center mx-auto"
                            >
                                <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center shadow-lg shadow-red-500/30">
                                    <span className="material-symbols-outlined text-3xl text-white">mic</span>
                                </div>
                            </motion.div>
                            <div className="mt-4 font-mono text-2xl font-bold text-red-500">
                                00:{recordingTime.toString().padStart(2, '0')}
                            </div>
                        </div>
                        <p className="text-sm font-medium dark:text-white px-4">
                            正在录制音频...<br />
                            <span className="text-orange-500 italic mt-2 block font-black">"{referenceText}"</span>
                        </p>
                        <div className="flex items-center justify-center gap-2 text-orange-500/80 animate-pulse">
                            <span className="material-symbols-outlined text-sm">auto_awesome</span>
                            <span className="text-[11px] font-black tracking-tight">记得带有感情的朗读哦！</span>
                        </div>
                        <button
                            onClick={stopRecording}
                            className="w-full py-4 bg-gray-900 dark:bg-white text-white dark:text-black rounded-2xl font-black transition-all"
                        >
                            点击停止
                        </button>
                    </div>
                )}

                {status === 'preview' && (
                    <div className="text-center space-y-4">
                        <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="material-symbols-outlined text-3xl text-green-500">audio_file</span>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            样本已处理完成。请确认音质是否清晰。
                            {audioBlob && audioBlob.size > 0 && (
                                <span className="block text-[10px] text-orange-500 mt-1">
                                    * 已自动为您截取前 20 秒作为样本
                                </span>
                            )}
                        </p>
                        <audio controls src={audioUrl!} className="w-full mb-4" />
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setStatus('idle')}
                                className="py-3 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 rounded-2xl font-bold transition-all"
                            >
                                重置
                            </button>
                            <button
                                onClick={handleUpload}
                                className="py-3 bg-orange-500 text-white rounded-2xl font-bold transition-all shadow-lg shadow-orange-500/20"
                            >
                                开始同步
                            </button>
                        </div>
                    </div>
                )}

                {status === 'processing' && (
                    <div className="text-center py-10 space-y-4">
                        <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-gray-500 dark:text-gray-400 font-bold">正在提取音频轨道...</p>
                        <p className="text-[10px] text-gray-400">正在进行下采样及多媒体解码</p>
                    </div>
                )}

                {status === 'uploading' && (
                    <div className="text-center py-10 space-y-4">
                        <div className="w-16 h-16 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-gray-500 dark:text-gray-400 font-bold">正在提取您的声音信息...</p>
                        <p className="text-[10px] text-gray-400">Dopa正在提取声纹特征，请不要关闭页面...</p>
                    </div>
                )}

                {status === 'identity_setup' && (
                    <div className="space-y-6">
                        <div className="text-center">
                            <h4 className="text-lg font-black dark:text-white">赋予它一个身份</h4>
                            <p className="text-xs text-gray-500 mt-1 text-balance">你的专属声线生成成功，现在为它起个名字吧。</p>
                        </div>

                        <div className="flex flex-col items-center gap-4">
                            <div
                                onClick={() => setupAvatarRef.current?.click()}
                                className="w-24 h-24 rounded-[28px] bg-gray-100 dark:bg-white/5 border-2 border-dashed border-gray-200 dark:border-white/10 flex items-center justify-center overflow-hidden cursor-pointer hover:border-orange-500/50 transition-colors relative group"
                            >
                                {setupAvatar ? (
                                    <img src={setupAvatar} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="text-center">
                                        <span className="material-symbols-outlined text-gray-400">add_a_photo</span>
                                        <p className="text-[10px] text-gray-400 font-bold mt-1">上传头像</p>
                                    </div>
                                )}
                                {isSavingIdentity && (
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                        <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    </div>
                                )}
                                <input type="file" ref={setupAvatarRef} className="hidden" accept="image/*" onChange={handleSetupAvatarUpload} />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest px-1">音色名称</label>
                                <input
                                    value={setupName}
                                    onChange={e => setSetupName(e.target.value)}
                                    placeholder="例如：超级教师、我的分身..."
                                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-2xl px-4 py-3 text-sm font-bold dark:text-white outline-none focus:ring-2 ring-orange-500/20"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest px-1">个性简介</label>
                                <textarea
                                    value={setupDesc}
                                    onChange={e => setSetupDesc(e.target.value)}
                                    placeholder="简单描述一下这个声音的性格..."
                                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-2xl px-4 py-3 text-sm font-bold dark:text-white outline-none focus:ring-2 ring-orange-500/20 h-24 resize-none"
                                />
                            </div>
                        </div>

                        <button
                            onClick={finishSetup}
                            disabled={isSavingIdentity}
                            className="w-full py-4 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-2xl font-black transition-all shadow-lg shadow-orange-500/20"
                        >
                            {isSavingIdentity ? '正在保存...' : '完成设置'}
                        </button>
                    </div>
                )}

                {status === 'success' && (
                    <div className="text-center py-8 space-y-4">
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4"
                        >
                            <span className="material-symbols-outlined text-4xl text-white">check</span>
                        </motion.div>
                        <h4 className="text-lg font-black dark:text-white">成功！</h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            WAV 样本已就绪，享受您的专属音色吧。
                        </p>
                    </div>
                )}

                {error && (
                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl">
                        <p className="text-xs text-red-500 text-center font-medium leading-relaxed">{error}</p>
                    </div>
                )}
            </div>
        </motion.div>
    )
}

export default VoiceCloneManager
