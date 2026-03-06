import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Page } from '../types';

import { supabase } from '../supabase';
import { IMAGES, getAssetPath } from '../constants';
import { SPRING_GENTLE, BUTTON_SPRING } from '../motion';
import { preloadImages } from '../utils/media';
import { useAuthStore } from '../store/useAuthStore';

interface LoginProps {
    onNavigate: (page: Page) => void;
    onLoginSuccess: (user: any) => void | Promise<void>;
}

const Login: React.FC<LoginProps> = ({ onNavigate, onLoginSuccess }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [inviteCode, setInviteCode] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showSupportQR, setShowSupportQR] = useState(false);
    const [isPreloading, setIsPreloading] = useState(false);
    const { currentUser } = useAuthStore();

    // [新增] 路由守卫保底：如果 App.tsx 已经检测到登录但 Login 页还卡在 preloading，强行触发成功回调
    React.useEffect(() => {
        if (currentUser && isPreloading) {
            console.log('[Login] Auth detected in store, unblocking preloading screen');
            onLoginSuccess(currentUser);
        }
    }, [currentUser, isPreloading]);


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (isLogin) {
                // 使用官方 Supabase Auth 登录
                const { data: { user }, error: authError } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });

                if (authError) throw authError;

                if (user) {
                    // --- [新增] 资源预加载机制 ---
                    setIsPreloading(true);

                    // [修复] 移除提前的 login 调用，防止 App.tsx 抢跑
                    // useUserStore.getState().login(user);

                    try {
                        const preloadingTimeout = 5000; // 5秒强行跳过预加载，防止卡死
                        const minLoadingTime = new Promise(resolve => setTimeout(resolve, 2000));

                        // [优化] 增加超时保护，防止图片加载慢导致一直卡在 Loading 界面
                        const tasks = [
                            preloadImages([
                                IMAGES.london,
                                IMAGES.avatar1,
                                IMAGES.grammar,
                                getAssetPath('/dopa_logo.png')
                            ]).catch(err => console.warn('Images preloading failed:', err)),
                            minLoadingTime
                        ];

                        await Promise.race([
                            Promise.all(tasks),
                            new Promise(resolve => setTimeout(resolve, preloadingTimeout)) // [修复] 真正的 5s 超时兜底
                        ]);
                    } catch (e) {
                        console.warn('Preloading phase encountered an issue:', e);
                    }

                    console.log('[Login] Preloading done, triggering success navigation');
                    onLoginSuccess(user);
                }
            } else {
                // 邀请码验证逻辑 (数据库动态校验)
                if (!inviteCode) {
                    throw new Error('请输入内测邀请码');
                }

                // 1. 检查邀请码是否存在
                const { data: codeData, error: checkError } = await supabase
                    .from('invite_codes')
                    .select('*')
                    .eq('code', inviteCode.toUpperCase().trim())
                    .single();

                if (checkError || !codeData) {
                    throw new Error('内测邀请码不存在，请联系管理员获取');
                }

                if (codeData.used) {
                    throw new Error('该邀请码已被他人使用');
                }

                // 2. 使用官方 Supabase Auth 注册
                const { data: { user }, error: authError } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            username: username || email.split('@')[0],
                        }
                    }
                });

                if (authError) throw authError;

                if (user) {
                    // [修复] 标记邀请码为已使用
                    await supabase
                        .from('invite_codes')
                        .update({ used: true })
                        .eq('code', inviteCode.toUpperCase().trim());

                    // --- [新增] 资源预加载机制 ---
                    setIsPreloading(true);

                    // [修复] 移除提前的 login 调用
                    // useUserStore.getState().login(user);

                    try {
                        // 预加载 Onboarding 和首页核心资源
                        const minLoadingTime = new Promise(resolve => setTimeout(resolve, 2000)); // 至少持续 2 秒

                        // [优化] 减少冗余 Profile 拉取，只做最小必要的预加载
                        const tasks = [
                            preloadImages([
                                IMAGES.london,
                                IMAGES.avatar1,
                                IMAGES.grammar,
                                getAssetPath('/dopa_logo.png')
                            ]).catch(err => console.warn('Images preloading failed:', err)),
                            minLoadingTime
                        ];
                        await Promise.all(tasks);
                    } catch (e) {
                        console.warn('Preloading failed, proceeding anyway', e);
                        // 即使预加载失败，也要保证最小展示时间
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                    await onLoginSuccess(user);
                    // 提示用户：如果开启了邮箱验证，可能需要去邮箱点击确认
                    if (!user.identities || user.identities.length === 0) {
                        setError('账号已创建，但需要检查您的邮箱点击确认链接。');
                    }
                } else {
                    setError('请检查您的邮箱以完成验证');
                }
            }
        } catch (err: any) {
            console.error('Auth error:', err);

            // [优化] 提供更友好的错误提示
            if (err.message?.includes('Email not confirmed')) {
                setError('邮箱未验证。请查收验证邮件,或联系管理员关闭邮箱验证功能。');
            } else if (err.message?.includes('email rate limit exceeded')) {
                setError('操作过于频繁,请稍后再试(建议等待 5-10 分钟)。');
            } else if (err.message?.includes('Invalid login credentials')) {
                setError('邮箱或密码错误,请检查后重试。');
            } else if (err.message?.includes('User already registered')) {
                setError('该邮箱已被注册,请直接登录。');
            } else {
                setError(err.message || '登录过程中发生错误');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-screen h-[100vh] w-full bg-[#0B0A09] flex flex-col items-center justify-center p-6 overflow-hidden relative font-sans">
            {/* --- Preloading Overlay --- */}
            <AnimatePresence>
                {isPreloading && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[200] bg-[#0B0A09] flex flex-col items-center justify-center space-y-8"
                    >
                        <div className="relative">
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                className="w-24 h-24 rounded-full border-t-2 border-primary border-r-2 border-primary/20"
                            />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-primary font-black text-xs tracking-tighter italic">Loading</span>
                            </div>
                        </div>
                        <div className="text-center space-y-2">
                            <h2 className="text-white font-black text-xl tracking-tighter italic uppercase">请稍候，正在加载...</h2>
                            <p className="text-white/30 text-[10px] font-bold uppercase tracking-[0.3em] animate-pulse">正在加载请稍后...</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* --- Premium Background Layer --- */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-primary/20 blur-[120px] rounded-full animate-pulse-slow"></div>
                <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-orange-600/10 blur-[120px] rounded-full"></div>
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay"></div>
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={SPRING_GENTLE}
                className="w-full max-w-sm z-10"
            >
                {/* Brand Header */}
                <div className="mb-[clamp(0.75rem,3vh,1.5rem)] text-center">
                    <motion.div
                        {...BUTTON_SPRING}
                        className="inline-flex items-center justify-center w-[clamp(3.5rem,12vh,5.5rem)] h-[clamp(3.5rem,12vh,5.5rem)] bg-transparent rounded-full mb-[clamp(0.4rem,1.5vh,0.75rem)] shadow-2xl border border-white/10 overflow-hidden"
                    >
                        <img
                            src={getAssetPath('/dopa_logo.png')}
                            alt="Logo"
                            className="w-full h-full object-cover scale-110"
                        />
                    </motion.div>
                    <h1 className="text-[clamp(1.5rem,4vh,2.25rem)] font-black text-white mb-0.5 tracking-tighter italic leading-none">
                        Scrollish
                    </h1>
                    <p className="text-[clamp(9px,1.2vh,11px)] text-white/40 font-medium tracking-widest uppercase">
                        Insight Through <span className="text-primary">Scrolling</span>
                    </p>
                </div>

                {/* Main Glass Card */}
                <div className="bg-white/[0.03] backdrop-blur-2xl px-[clamp(1rem,3vh,1.75rem)] pt-[clamp(1.25rem,4vh,2rem)] pb-[clamp(0.75rem,2vh,1.25rem)] rounded-[2.5rem] border border-white/[0.08] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary/40 to-transparent"></div>

                    <form onSubmit={handleSubmit} className="flex flex-col gap-[clamp(0.5rem,2vh,1rem)]">
                        {!isLogin && (
                            <div key="username">
                                <label className="block text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-2 ml-3">
                                    用户名
                                </label>
                                <div className="group relative">
                                    <input
                                        type="text"
                                        required
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        className="w-full h-[clamp(2.5rem,7vh,3.5rem)] px-6 bg-white/[0.05] border border-white/[0.05] focus:border-primary/50 focus:bg-white/[0.08] rounded-2xl outline-none text-white font-medium placeholder:text-white/10 shadow-inner"
                                        placeholder="我们该如何称呼您？"
                                    />
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="block text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-2 ml-3">
                                电子邮件
                            </label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full h-[clamp(2.5rem,7vh,3.5rem)] px-6 bg-white/[0.05] border border-white/[0.05] focus:border-primary/50 focus:bg-white/[0.08] rounded-2xl outline-none transition-all text-white font-medium placeholder:text-white/10 shadow-inner"
                                placeholder="name@example.com"
                            />
                        </div>

                        {!isLogin && (
                            <div key="invite-code">
                                <label className="block text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-2 ml-3">
                                    邀请码
                                </label>
                                <div className="relative group">
                                    <input
                                        type="text"
                                        required
                                        value={inviteCode}
                                        onChange={(e) => setInviteCode(e.target.value)}
                                        className="w-full h-15 px-6 bg-white/[0.05] border border-white/[0.05] focus:border-primary/50 focus:bg-white/[0.08] rounded-2xl outline-none text-white font-medium placeholder:text-white/10 pr-14 shadow-inner"
                                        placeholder="输入内部邀请码"
                                    />
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-primary/40 p-2">
                                        <span className="material-symbols-outlined text-[20px]">vpn_key</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="block text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-2 ml-3">
                                密码
                            </label>
                            <div className="relative group">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full h-[clamp(2.5rem,7vh,3.5rem)] px-6 bg-white/[0.05] border border-white/[0.05] focus:border-primary/50 focus:bg-white/[0.08] rounded-2xl outline-none text-white font-medium placeholder:text-white/10 pr-14 shadow-inner"
                                    placeholder="••••••••"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 hover:text-primary transition-colors p-2"
                                >
                                    <span className="material-symbols-outlined text-[20px]">
                                        {showPassword ? 'visibility_off' : 'visibility'}
                                    </span>
                                </button>
                            </div>
                        </div>

                        <motion.button
                            {...BUTTON_SPRING}
                            type="submit"
                            disabled={loading}
                            className="w-full h-[clamp(3rem,8vh,4rem)] bg-primary text-white font-black rounded-[1.25rem] shadow-[0_10px_30px_-5px_rgba(255,107,0,0.4)] mt-1 flex items-center justify-center gap-3 group overflow-hidden relative"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/15 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                            {loading ? (
                                <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <span className="text-lg tracking-tight uppercase">
                                        {isLogin ? '登录' : '注册为新用户'}
                                    </span>
                                    <span className="material-symbols-outlined text-xl group-hover:translate-x-1 transition-transform">
                                        arrow_forward
                                    </span>
                                </>
                            )}
                        </motion.button>
                    </form>

                    {/* Support Button instead of social login */}
                    <div className="mt-[clamp(0.8rem,1vh,2rem)] flex flex-col items-center">
                        <div className="w-full border-t border-white/[0.05] mb-[clamp(0.75rem,1vh,1.5rem)]"></div>
                        <button
                            type="button"
                            onClick={() => setShowSupportQR(true)}
                            className="flex items-center gap-2 group transition-all"
                        >
                            <span className="material-symbols-outlined text-[18px] text-primary group-hover:scale-110 transition-transform">contact_support</span>
                            <span className="text-[11px] font-bold text-white/40 group-hover:text-white/70 uppercase tracking-widest">联系客服获取邀请码</span>
                        </button>
                    </div>
                </div>

                {/* Aesthetic Footer */}
                <div className="mt-[clamp(0.25rem,0.5vh,0.75rem)] text-center text-xs text-white/30 font-bold uppercase tracking-widest">
                    <span>{isLogin ? "新用户？" : "已有账号？"}</span>
                    <button
                        type="button"
                        onClick={() => {
                            setIsLogin(!isLogin);
                            setError(null);
                        }}
                        className="text-primary font-black hover:text-orange-400 hover:underline underline-offset-8 ml-2"
                    >
                        {isLogin ? "注册" : "登录"}
                    </button>
                </div>

                {/* Error Banner */}
                <AnimatePresence>
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="mt-[clamp(0.5rem,1.5vh,1rem)] p-5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-black text-center tracking-tight"
                        >
                            <div className="flex items-center justify-center gap-2">
                                <span className="material-symbols-outlined text-sm">error</span>
                                {error}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>

            {/* --- CUSTOMER SERVICE QR MODAL --- */}
            <AnimatePresence>
                {showSupportQR && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowSupportQR(false)}
                        className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full max-w-[280px] bg-white/[0.03] border border-white/10 rounded-[3rem] p-8 flex flex-col items-center gap-6 relative"
                        >
                            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary/40 to-transparent"></div>

                            <div className="text-center">
                                <h3 className="text-white font-black text-lg tracking-tight mb-1">联系客服</h3>
                                <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">获取内测邀请码</p>
                            </div>

                            <div className="w-full aspect-square bg-white p-2 rounded-3xl shadow-[0_20px_40px_rgba(0,0,0,0.3)] relative group">
                                <img
                                    src={getAssetPath('/support_qr.png')}
                                    alt="QR Code"
                                    style={{ WebkitTouchCallout: 'default' } as any}
                                    className="w-full h-full object-contain relative z-10"
                                />
                            </div>

                            <p className="text-[10px] text-white/30 text-center font-bold uppercase tracking-widest leading-relaxed">
                                长按上方图片保存<br />或点击下方按钮下载
                            </p>

                            <div className="flex gap-4 w-full">
                                <button
                                    onClick={() => {
                                        const link = document.createElement('a');
                                        link.href = getAssetPath('/support_qr.png');
                                        link.download = 'Scrollish_Support_QR.png';
                                        link.click();
                                    }}
                                    className="flex-1 h-14 rounded-2xl bg-primary text-white text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-primary/20"
                                >
                                    <span className="material-symbols-outlined text-[18px]">download</span>
                                    保存到相册
                                </button>

                                <button
                                    onClick={() => setShowSupportQR(false)}
                                    className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/40 hover:text-white active:scale-95 transition-all"
                                >
                                    <span className="material-symbols-outlined text-[20px]">close</span>
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <style>{`
                .drop-shadow-glow {
                    filter: drop-shadow(0 0 10px rgba(255, 107, 0, 0.4));
                }
                .h-15 { height: 3.75rem; }
                .w-22 { width: 5.5rem; }
                .h-22 { height: 5.5rem; }
            `}</style>
        </div>
    );
};

export default Login;
