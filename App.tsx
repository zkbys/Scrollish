
import React, { useState } from 'react';
import { Page, Post } from './types';
import { POSTS } from './constants';
import Home from './pages/Home';
import TopicHub from './pages/TopicHub';
import ChatRoom from './pages/ChatRoom';
import Explore from './pages/Explore';
import Study from './pages/Study';
import Profile from './pages/Profile';
import BottomNav from './components/BottomNav';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>(Page.Home);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  const handlePostClick = (postId: string) => {
    setSelectedPostId(postId);
    setCurrentPage(Page.TopicHub);
  };

  const renderPage = () => {
    const selectedPost = POSTS.find(p => p.id === selectedPostId) || POSTS[0];

    switch (currentPage) {
      case Page.Home:
        return <Home onNavigate={setCurrentPage} onPostSelect={handlePostClick} />;
      case Page.TopicHub:
        return (
          <TopicHub 
            post={selectedPost} 
            onNavigate={(p) => {
              if (p === Page.Home) setSelectedPostId(null);
              setCurrentPage(p);
            }} 
          />
        );
      case Page.ChatRoom:
        return <ChatRoom onBack={() => setCurrentPage(Page.TopicHub)} />;
      case Page.Explore:
        return <Explore />;
      case Page.Study:
        return <Study />;
      case Page.Profile:
        return <Profile />;
      default:
        return <Home onNavigate={setCurrentPage} onPostSelect={handlePostClick} />;
    }
  };

  return (
    <div className="flex justify-center bg-black min-h-screen">
      <div className="relative w-full max-w-md h-screen overflow-hidden bg-background-light dark:bg-background-dark shadow-2xl flex flex-col">
        <main className="flex-1 overflow-hidden relative">
          {renderPage()}
        </main>
        
        <BottomNav activePage={currentPage} onNavigate={setCurrentPage} />
      </div>
    </div>
  );
};

export default App;
