import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { Page, Post } from './types';
import { POSTS, IMAGES } from './constants';
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
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAllPosts = async () => {
      try {
        const { data, error } = await supabase
          .from('production_posts')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;

        if (data && data.length > 0) {
          const mappedPosts: Post[] = data.map((item: any) => ({
            id: item.id,
            user: item.author_name || item.subreddit || 'Anonymous',
            avatar: item.author_avatar || IMAGES.avatar1,
            titleEn: item.title_en,
            titleZh: item.title_cn || '',
            hashtags: item.hashtags || [],
            image: item.image_url || IMAGES.london,
            likes: item.upvotes?.toString() || '0',
            stars: item.stars?.toString() || '0',
            comments: 0,
          }));
          setAllPosts(mappedPosts);
        } else {
          setAllPosts(POSTS);
        }
      } catch (err) {
        console.error('Error fetching posts:', err);
        setAllPosts(POSTS);
      } finally {
        setLoading(false);
      }
    };

    fetchAllPosts();
  }, []);

  const handlePostClick = (postId: string) => {
    setSelectedPostId(postId);
    setCurrentPage(Page.TopicHub);
  };

  const renderPage = () => {
    const selectedPost = allPosts.find(p => p.id === selectedPostId) || allPosts[0] || POSTS[0];

    switch (currentPage) {
      case Page.Home:
        return <Home posts={allPosts} loading={loading} onNavigate={setCurrentPage} onPostSelect={handlePostClick} />;
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
        return <ChatRoom postId={selectedPostId || ''} onBack={() => setCurrentPage(Page.TopicHub)} />;
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

  // Determine if the bottom navigation bar should be hidden
  const hideBottomNav = currentPage === Page.TopicHub || currentPage === Page.ChatRoom;

  return (
    <div className="flex justify-center bg-black min-h-screen">
      <div className="relative w-full max-w-md h-screen overflow-hidden bg-background-light dark:bg-background-dark shadow-2xl flex flex-col">
        <main className="flex-1 overflow-hidden relative">
          {renderPage()}
        </main>

        {!hideBottomNav && (
          <BottomNav activePage={currentPage} onNavigate={setCurrentPage} />
        )}
      </div>
    </div>
  );
};

export default App;
