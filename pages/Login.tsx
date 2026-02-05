import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Page } from '../types';

import { supabase } from '../supabase';
import { IMAGES } from '../constants';
import { SPRING_GENTLE, BUTTON_SPRING } from '../motion';

interface LoginProps {
    onNavigate: (page: Page) => void;
    onLoginSuccess: (user: any) => void;
}

const Login: React.FC<LoginProps> = ({ onNavigate, onLoginSuccess }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

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
                    onLoginSuccess(user);
                }
            } else {
                // 使用官方 Supabase Auth 注册
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
                    onLoginSuccess(user);
                    // 提示用户：如果开启了邮箱验证，可能需要去邮箱点击确认
                    if (!user.identities || user.identities.length === 0) {
                        setError('Account exists but needs confirmation. Please check your email.');
                    }
                } else {
                    setError('Please check your email for confirmation');
                }
            }
        } catch (err: any) {
            setError(err.message || 'An error occurred during authentication');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-full w-full bg-[#0B0A09] flex flex-col items-center justify-center p-6 overflow-hidden relative font-sans">
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
                <div className="mb-10 text-center">
                    <motion.div
                        {...BUTTON_SPRING}
                        className="inline-flex items-center justify-center w-16 h-16 bg-transparent rounded-[1.25rem] mb-4 shadow-xl border border-white/5 overflow-hidden"
                    >
                        <img
                            src="/汽橙.jpg"
                            alt="Logo"
                            className="w-full h-full object-cover scale-150"
                        />
                    </motion.div>
                    <h1 className="text-3xl font-black text-white mb-1 tracking-tighter italic">
                        Scrollish
                    </h1>
                    <p className="text-xs text-white/40 font-medium tracking-widest uppercase">
                        Insight Through <span className="text-primary">Scrolling</span>
                    </p>
                </div>

                {/* Main Glass Card */}
                <div className="bg-white/[0.03] backdrop-blur-2xl p-7 pt-9 rounded-[2.5rem] border border-white/[0.08] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary/40 to-transparent"></div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {!isLogin && (
                            <div key="username">
                                <label className="block text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-2 ml-3">
                                    Username
                                </label>
                                <div className="group relative">
                                    <input
                                        type="text"
                                        required
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        className="w-full h-14 px-6 bg-white/[0.05] border border-white/[0.05] focus:border-primary/50 focus:bg-white/[0.08] rounded-2xl outline-none text-white font-medium placeholder:text-white/10 shadow-inner"
                                        placeholder="What should we call you?"
                                    />
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="block text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-2 ml-3">
                                Email Address
                            </label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full h-15 px-6 bg-white/[0.05] border border-white/[0.05] focus:border-primary/50 focus:bg-white/[0.08] rounded-2xl outline-none transition-all text-white font-medium placeholder:text-white/10 shadow-inner"
                                placeholder="name@example.com"
                            />
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-2 ml-3">
                                Password
                            </label>
                            <div className="relative group">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full h-15 px-6 bg-white/[0.05] border border-white/[0.05] focus:border-primary/50 focus:bg-white/[0.08] rounded-2xl outline-none text-white font-medium placeholder:text-white/10 pr-14 shadow-inner"
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
                            className="w-full h-16 bg-primary text-white font-black rounded-[1.25rem] shadow-[0_10px_30px_-5px_rgba(255,107,0,0.4)] mt-4 flex items-center justify-center gap-3 group overflow-hidden relative"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/15 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                            {loading ? (
                                <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <span className="text-lg tracking-tight uppercase">
                                        {isLogin ? 'Enter Laboratory' : 'Create Identity'}
                                    </span>
                                    <span className="material-symbols-outlined text-xl group-hover:translate-x-1 transition-transform">
                                        arrow_forward
                                    </span>
                                </>
                            )}
                        </motion.button>
                    </form>

                    {/* Social Login Separator */}
                    <div className="relative py-8">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-white/[0.05]"></div>
                        </div>
                        <div className="relative flex justify-center text-[9px] font-black uppercase text-white/20 tracking-[0.3em]">
                            <span className="bg-[#121214] px-4 rounded-full">Secure Verification</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <motion.button {...BUTTON_SPRING} className="h-14 border border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.05] rounded-2xl flex items-center justify-center gap-2 group">
                            <span className="material-symbols-outlined text-[20px] text-[#07C160]/70 group-hover:text-[#07C160]">chat</span>
                            <span className="text-[10px] font-black text-white/30 group-hover:text-white/60 uppercase tracking-wider">WeChat</span>
                        </motion.button>
                        <motion.button {...BUTTON_SPRING} className="h-14 border border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.05] rounded-2xl flex items-center justify-center gap-2 group">
                            <span className="material-symbols-outlined text-[20px] text-[#12B7F5]/70 group-hover:text-[#12B7F5]">chat_bubble</span>
                            <span className="text-[10px] font-black text-white/30 group-hover:text-white/60 uppercase tracking-wider">Connect QQ</span>
                        </motion.button>
                    </div>
                </div>

                {/* Aesthetic Footer */}
                <div className="mt-10 text-center">
                    <p className="text-xs text-white/30 font-bold uppercase tracking-widest">
                        {isLogin ? "New Subect?" : "Known Participant?"}
                        <button
                            type="button"
                            onClick={() => {
                                setIsLogin(!isLogin);
                                setError(null);
                            }}
                            className="text-primary font-black hover:text-orange-400 hover:underline underline-offset-8 ml-2"
                        >
                            {isLogin ? "INITIALIZE" : "IDENTIFY"}
                        </button>
                    </p>
                </div>

                {/* Error Banner */}
                <AnimatePresence>
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="mt-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-black text-center tracking-tight"
                        >
                            <div className="flex items-center justify-center gap-2">
                                <span className="material-symbols-outlined text-sm">error</span>
                                {error}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>

            <style>{`
                .drop-shadow-glow {
                    filter: drop-shadow(0 0 10px rgba(255, 107, 0, 0.4));
                }
                .h-15 { height: 3.75rem; }
            `}</style>
        </div>
    );
};

export default Login;
