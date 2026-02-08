import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Droplets, 
  Sun, 
  Zap, 
  Heart, 
  Bell, 
  Menu, 
  Home, 
  Calendar, 
  User, 
  Plus,
  ChevronRight,
  Sparkles,
  Book,
  Moon,
  Dumbbell,
  Smile,
  PenTool,
  Music,
  Coffee,
  Umbrella,
  CloudRain,
  Flame,
  Utensils
} from 'lucide-react';

// --- Types & Interfaces ---
interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  color: string;
  delay?: number;
}

// --- Components ---

import { ImageWithFallback } from './components/figma/ImageWithFallback';

const Header = () => (
  <div className="flex justify-between items-center p-6 pt-8">
    <div className="flex items-center gap-3">
      <div className="relative">
        <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-orange-300 p-0.5">
          <ImageWithFallback 
            src="https://images.unsplash.com/photo-1767716134849-5e5abb7bf59b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjdXRlJTIwYW5pbWUlMjBzdHlsZSUyMGF2YXRhciUyMG9yYW5nZSUyMHRoZW1lfGVufDF8fHx8MTc3MDMwMjA3OHww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral" 
            alt="User" 
            className="w-full h-full object-cover rounded-full"
          />
        </div>
        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-white"></div>
      </div>
      <div>
        <p className="text-orange-300 text-xs font-bold uppercase tracking-wider">Welcome Back</p>
        <h2 className="text-orange-900 font-bold text-lg">Little Citrus</h2>
      </div>
    </div>
    <button className="p-2 bg-white/50 backdrop-blur-sm rounded-full text-orange-400 hover:bg-white transition-colors shadow-sm">
      <Bell size={20} />
    </button>
  </div>
);

const BigDroplet = () => {
  const [isAnimating, setIsAnimating] = useState(false);

  const handleTap = () => {
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 1000);
  };

  return (
    <div className="flex flex-col items-center justify-center my-4 relative">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-orange-300/20 rounded-full blur-3xl" />
      
      {/* The Droplet Character */}
      <motion.div
        className="relative w-48 h-48 bg-gradient-to-br from-orange-300 via-orange-400 to-orange-500 rounded-[50%] shadow-xl shadow-orange-500/30 flex items-center justify-center cursor-pointer overflow-hidden z-10"
        style={{
          borderRadius: "50% 50% 50% 50% / 60% 60% 40% 40%" // Organic droplet shape
        }}
        animate={isAnimating ? {
          scale: [1, 0.9, 1.1, 0.95, 1],
          rotate: [0, -5, 5, -2, 0],
          borderRadius: [
            "50% 50% 50% 50% / 60% 60% 40% 40%",
            "40% 60% 30% 70% / 50% 50% 50% 50%",
            "50% 50% 50% 50% / 60% 60% 40% 40%"
          ]
        } : {
          y: [0, -10, 0],
        }}
        transition={isAnimating ? { duration: 0.6 } : { duration: 4, repeat: Infinity, ease: "easeInOut" }}
        onClick={handleTap}
        whileTap={{ scale: 0.9 }}
      >
        {/* Shine effect */}
        <div className="absolute top-8 right-10 w-8 h-4 bg-white/40 rounded-full rotate-[-20deg] blur-[2px]" />
        <div className="absolute top-6 right-8 w-3 h-3 bg-white/60 rounded-full blur-[1px]" />
        
        {/* Face */}
        <div className="relative flex flex-col items-center top-4">
          <div className="flex gap-6 mb-2">
            {/* Eyes */}
            <motion.div 
              className="w-3 h-4 bg-orange-900 rounded-full"
              animate={isAnimating ? { scaleY: [1, 0.1, 1] } : {}}
            />
            <motion.div 
              className="w-3 h-4 bg-orange-900 rounded-full"
              animate={isAnimating ? { scaleY: [1, 0.1, 1] } : {}}
            />
          </div>
          {/* Mouth */}
          <div className="w-4 h-2 bg-orange-900/50 rounded-b-full" />
          
          {/* Cheeks */}
          <div className="absolute top-2 -left-3 w-4 h-2 bg-pink-300/50 rounded-full blur-[1px]" />
          <div className="absolute top-2 -right-3 w-4 h-2 bg-pink-300/50 rounded-full blur-[1px]" />
        </div>
        
        {/* Liquid movement inside (simulated) */}
        <div className="absolute bottom-0 w-full h-1/3 bg-white/10 rounded-b-[40%]" />
      </motion.div>

      <div className="mt-6 text-center z-10">
        <h1 className="text-3xl font-black text-orange-900 tracking-tight">85%</h1>
        <p className="text-orange-600 font-medium text-sm bg-orange-100/50 px-3 py-1 rounded-full inline-block mt-1">
          Daily Energy
        </p>
      </div>
    </div>
  );
};

const FeatureCard = ({ icon, title, subtitle, color, delay = 0 }: FeatureCardProps) => (
  <motion.div 
    className="bg-white p-4 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col items-start gap-3 hover:shadow-lg transition-shadow cursor-pointer border border-orange-50"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.5 }}
    whileHover={{ y: -2 }}
    whileTap={{ scale: 0.98 }}
  >
    <div className={`p-3 rounded-2xl ${color} text-white shadow-sm`}>
      {icon}
    </div>
    <div>
      <h3 className="font-bold text-gray-800">{title}</h3>
      <p className="text-xs text-gray-400 font-medium">{subtitle}</p>
    </div>
  </motion.div>
);

const ToolsGrid = () => {
  const tools = [
    { name: "Reading", icon: <Book size={20} />, color: "bg-indigo-400" },
    { name: "Sleep", icon: <Moon size={20} />, color: "bg-indigo-600" },
    { name: "Sport", icon: <Dumbbell size={20} />, color: "bg-emerald-400" },
    { name: "Mood", icon: <Smile size={20} />, color: "bg-amber-400" },
    { name: "Journal", icon: <PenTool size={20} />, color: "bg-rose-400" },
    { name: "Music", icon: <Music size={20} />, color: "bg-pink-400" },
    { name: "Coffee", icon: <Coffee size={20} />, color: "bg-orange-800" },
    { name: "Diet", icon: <Utensils size={20} />, color: "bg-lime-500" },
  ];

  return (
    <div className="px-6 py-2">
      <div className="flex justify-between items-end mb-4">
        <h3 className="text-xl font-bold text-orange-900">Quick Habits</h3>
      </div>
      <div className="grid grid-cols-4 gap-3">
        {tools.map((tool, idx) => (
          <motion.div
            key={idx}
            className="flex flex-col items-center gap-2"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1 * idx }}
            whileTap={{ scale: 0.9 }}
          >
            <div className={`w-14 h-14 rounded-2xl ${tool.color} flex items-center justify-center text-white shadow-md shadow-orange-100/50 cursor-pointer hover:brightness-110 transition-all`}>
              {tool.icon}
            </div>
            <span className="text-xs font-medium text-gray-500">{tool.name}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

const DailyList = () => (
  <div className="px-6 py-4">
    <div className="flex justify-between items-end mb-4">
      <h3 className="text-xl font-bold text-orange-900">Today's Focus</h3>
      <button className="text-xs font-bold text-orange-400 hover:text-orange-600">See All</button>
    </div>
    
    <div className="space-y-3">
      {[
        { title: "Drink Water", time: "Every 2 hours", icon: <Droplets size={18} />, color: "bg-blue-400", bg: "bg-blue-50" },
        { title: "Morning Sun", time: "15 mins", icon: <Sun size={18} />, color: "bg-orange-400", bg: "bg-orange-50" },
        { title: "Mindfulness", time: "Before sleep", icon: <Sparkles size={18} />, color: "bg-purple-400", bg: "bg-purple-50" },
      ].map((item, idx) => (
        <motion.div 
          key={idx}
          className={`flex items-center gap-4 p-4 rounded-3xl ${item.bg} border border-white/50 cursor-pointer`}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 + (idx * 0.1) }}
          whileTap={{ scale: 0.98 }}
        >
          <div className={`w-10 h-10 rounded-full ${item.color} flex items-center justify-center text-white shadow-sm`}>
            {item.icon}
          </div>
          <div className="flex-1">
            <h4 className="font-bold text-gray-800">{item.title}</h4>
            <p className="text-xs text-gray-500 font-medium">{item.time}</p>
          </div>
          <div className="w-8 h-8 rounded-full border-2 border-orange-200 flex items-center justify-center text-orange-200">
            <ChevronRight size={16} />
          </div>
        </motion.div>
      ))}
    </div>
  </div>
);

const NavBar = () => {
  const [active, setActive] = useState('home');
  
  const navItems = [
    { id: 'home', icon: <Home size={22} />, label: 'Home' },
    { id: 'calendar', icon: <Calendar size={22} />, label: 'Plan' },
    { id: 'add', icon: <Plus size={28} />, label: 'Add', isFab: true },
    { id: 'stats', icon: <Zap size={22} />, label: 'Stats' },
    { id: 'profile', icon: <User size={22} />, label: 'Me' },
  ];

  return (
    <div className="fixed bottom-6 left-6 right-6 h-20 bg-white/90 backdrop-blur-md rounded-[32px] shadow-[0_8px_30px_rgb(251,146,60,0.15)] flex items-center justify-between px-2 border border-orange-100 z-50">
      {navItems.map((item) => {
        if (item.isFab) {
          return (
            <div key={item.id} className="relative -top-6">
              <motion.button 
                className="w-16 h-16 bg-gradient-to-tr from-orange-400 to-amber-400 rounded-full flex items-center justify-center text-white shadow-lg shadow-orange-400/40 border-4 border-white"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                {item.icon}
              </motion.button>
            </div>
          );
        }
        
        const isActive = active === item.id;
        return (
          <button 
            key={item.id}
            onClick={() => setActive(item.id)}
            className={`flex flex-col items-center gap-1 p-3 rounded-2xl w-16 transition-all ${isActive ? 'text-orange-500' : 'text-gray-300 hover:text-gray-400'}`}
          >
            {item.icon}
            {isActive && (
              <motion.div 
                layoutId="nav-dot"
                className="w-1.5 h-1.5 bg-orange-500 rounded-full absolute bottom-3"
              />
            )}
          </button>
        );
      })}
    </div>
  );
};

// --- Main App ---

export default function App() {
  return (
    <div className="min-h-screen bg-[#FFF8F0] font-sans pb-28 relative overflow-hidden selection:bg-orange-200">
      {/* Decorative Background Blobs */}
      <div className="absolute top-[-10%] right-[-20%] w-[500px] h-[500px] bg-orange-100/50 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[10%] left-[-10%] w-[300px] h-[300px] bg-yellow-100/50 rounded-full blur-3xl pointer-events-none" />
      
      <div className="max-w-md mx-auto relative z-10">
        <Header />
        
        <BigDroplet />
        
        <div className="px-6 grid grid-cols-2 gap-4 my-6">
          <FeatureCard 
            icon={<Heart size={20} />} 
            title="Health" 
            subtitle="Keep it up!" 
            color="bg-red-400"
            delay={0.1}
          />
          <FeatureCard 
            icon={<Droplets size={20} />} 
            title="Hydration" 
            subtitle="1.2L / 2L" 
            color="bg-cyan-400"
            delay={0.2}
          />
        </div>

        <ToolsGrid />

        <DailyList />
        
        <NavBar />
      </div>
    </div>
  );
}
