
import React from 'react';
import { Page } from '../types';

interface BottomNavProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
}

const BottomNav: React.FC<BottomNavProps> = ({ activePage, onNavigate }) => {
  // Hide bottom nav on full-screen home or chat to match TikTok/Chat style if preferred
  // But prompt says nav is there in screenshots.
  
  const navItems = [
    { id: Page.Home, label: 'Home', icon: 'home' },
    { id: Page.Explore, label: 'Explore', icon: 'explore' },
    { id: Page.Study, label: 'Study', icon: 'school' },
    { id: Page.Profile, label: 'Profile', icon: 'person' },
  ];

  return (
    <nav className="bg-white/95 dark:bg-[#1C1510]/95 backdrop-blur-md border-t border-gray-100 dark:border-white/10 px-6 pb-8 pt-3 flex justify-between items-center z-50">
      {navItems.map((item) => (
        <button
          key={item.id}
          onClick={() => onNavigate(item.id)}
          className={`flex flex-col items-center gap-1 group w-16 transition-colors ${
            activePage === item.id ? 'text-primary' : 'text-gray-400 dark:text-gray-500'
          }`}
        >
          <span 
            className={`material-symbols-outlined text-[26px] ${activePage === item.id ? 'fill-[1]' : ''}`}
          >
            {item.icon}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider">{item.label}</span>
          {activePage === item.id && (
            <div className="absolute -bottom-1 w-1 h-1 bg-primary rounded-full" />
          )}
        </button>
      ))}
      <div className="fixed bottom-1 left-0 right-0 flex justify-center pointer-events-none">
        <div className="h-1.5 w-32 bg-gray-300 dark:bg-gray-700 rounded-full"></div>
      </div>
    </nav>
  );
};

export default BottomNav;
