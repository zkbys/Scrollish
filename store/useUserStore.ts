import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { supabase } from '../supabase'
import { ProductionPost } from './useAppStore'
import { DictionaryResult } from './useDictionaryStore'

export interface ViewHistoryItem {
  postId: string
  viewedAt: string
  post: ProductionPost
}

interface UserState {
  likedPosts: ProductionPost[]
  starredWords: DictionaryResult[]
  followedCommunities: string[]
  viewedPostIds: string[]
  viewHistory: ViewHistoryItem[]

  currentUser: any | null
  profile: any | null
  isLoading: boolean
  _hasHydrated: boolean // [新增] 用于标识持久化存储是否已加载完成

  // Actions
  toggleLike: (post: ProductionPost) => void
  isLiked: (postId: string) => boolean
  toggleStarWord: (word: DictionaryResult) => Promise<void>
  isWordStarred: (wordName: string) => boolean
  toggleFollowCommunity: (communityId: string) => void
  isFollowing: (communityId: string) => boolean
  addViewHistory: (post: ProductionPost) => void
  isViewed: (postId: string) => boolean
  clearViewHistory: () => void
  login: (user: any) => void
  logout: () => void
  setLoading: (loading: boolean) => void
  fetchProfile: (force?: boolean) => Promise<void>
  fetchStarredWords: (force?: boolean) => Promise<void>
  fetchWordContext: (word: string) => Promise<any[]>
  syncLocalWordsToCloud: () => Promise<void>
  registerWordLookup: (word: DictionaryResult, context: string) => Promise<void>
  updateXP: (amount: number) => Promise<void>
  updateProfile: (updates: any) => Promise<void>
  setProfile: (profile: any) => void
  setHasHydrated: (state: boolean) => void

  // [新增] 用于 API 节流的状态
  hasFetchedProfile: boolean
  hasFetchedStarredWords: boolean
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      likedPosts: [],
      starredWords: [],
      followedCommunities: [],
      viewedPostIds: [],
      viewHistory: [],
      currentUser: null,
      profile: null,
      isLoading: true,
      _hasHydrated: false,
      hasFetchedProfile: false,
      hasFetchedStarredWords: false,

      toggleLike: (post: ProductionPost) => {
        const currentLikes = get().likedPosts
        const exists = currentLikes.find((p) => p.id === post.id)
        if (exists) {
          set({ likedPosts: currentLikes.filter((p) => p.id !== post.id) })
        } else {
          set({ likedPosts: [post, ...currentLikes] })
        }
      },

      isLiked: (postId: string) => {
        return get().likedPosts.some((p) => p.id === postId)
      },

      toggleStarWord: async (word: DictionaryResult) => {
        const user = get().currentUser
        const currentStarred = get().starredWords
        const exists = currentStarred.find((w) => w.word === word.word)

        // 1. 乐观更新本地 UI
        if (exists) {
          set({
            starredWords: currentStarred.filter((w) => w.word !== word.word),
          })
        } else {
          set({ starredWords: [word, ...currentStarred] })
        }

        // 2. 如果已登录，同步到数据库
        if (user) {
          // 先获取现有历史数据，防止 upsert 覆盖掉博物馆记录
          const { data: existing } = await supabase
            .from('user_vocabulary')
            .select('lookup_count, contexts')
            .eq('user_id', user.id)
            .eq('word', word.word)
            .maybeSingle()

          // 使用 upsert 更新 is_saved 状态，保留其他历史记录
          const { error } = await supabase.from('user_vocabulary').upsert({
            user_id: user.id,
            word: word.word,
            is_saved: !exists, // 切换收藏状态
            last_interacted_at: new Date().toISOString(),
            lookup_count: existing?.lookup_count || 1,
            contexts: existing?.contexts || [],
            // 补全基础信息
            ipa: word.ipa,
            definition_cn: word.definition_cn,
            definition_en: word.definition_en,
            roots: word.roots,
          }, { onConflict: 'user_id, word' })
          if (error) console.error('toggleStarWord Error:', error)
        }
      },

      isWordStarred: (wordName: string) => {
        return get().starredWords.some((w) => w.word === wordName)
      },

      toggleFollowCommunity: (communityId: string) => {
        const currentFollows = get().followedCommunities
        const isFollowing = currentFollows.includes(communityId)
        if (isFollowing) {
          set({
            followedCommunities: currentFollows.filter(
              (id) => id !== communityId,
            ),
          })
        } else {
          set({ followedCommunities: [...currentFollows, communityId] })
        }
      },

      isFollowing: (communityId: string) => {
        return get().followedCommunities.includes(communityId)
      },

      addViewHistory: (post: ProductionPost) => {
        const { viewedPostIds, viewHistory } = get()

        // 过滤掉旧的记录，保证唯一性且最近看的在最前面
        const filteredHistory = viewHistory.filter(h => h.postId !== post.id)

        const newHistoryItem: ViewHistoryItem = {
          postId: post.id,
          viewedAt: new Date().toISOString(),
          post: post,
        }

        set({
          viewedPostIds: viewedPostIds.includes(post.id)
            ? viewedPostIds
            : [...viewedPostIds, post.id],
          viewHistory: [newHistoryItem, ...filteredHistory],
        })
      },

      isViewed: (postId: string) => {
        return get().viewedPostIds.includes(postId)
      },

      clearViewHistory: () => {
        set({ viewedPostIds: [], viewHistory: [] })
      },

      login: (userData: any) => {
        set({ currentUser: userData, isLoading: false })
        // 登录后拉取数据库里的单词
        get().fetchStarredWords()
        get().syncLocalWordsToCloud()
      },

      logout: () => {
        set({
          currentUser: null,
          likedPosts: [],
          followedCommunities: [],
          starredWords: [],
          hasFetchedProfile: false,
          hasFetchedStarredWords: false,
        })
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading })
      },

      fetchProfile: async (force = false) => {
        const user = get().currentUser
        if (!user) return

        // [卫兵逻辑] 如果已有数据且不是强制刷新，直接跳过
        if (get().profile && !force && get().hasFetchedProfile) return

        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()
        if (data) {
          set({ profile: data, hasFetchedProfile: true })
        }
      },

      fetchStarredWords: async (force = false) => {
        const user = get().currentUser
        if (!user) return

        // [卫兵逻辑] 单词加载保护
        if (get().starredWords.length > 0 && !force && get().hasFetchedStarredWords) return

        // [优化] 1. 增加 .limit(100) 防止一次拉取过多数据
        // [优化] 2. 精确指定字段，排除掉体积巨大的 'contexts' (AI语境详情)
        // 只有当用户点开某个单词查词时，我们才去拉取那个单词的完整 context
        const { data } = await supabase
          .from('user_vocabulary')
          .select('word, ipa, definition_cn, definition_en, roots')
          .eq('user_id', user.id)
          .eq('is_saved', true)
          .order('last_interacted_at', { ascending: false })
          .limit(100)

        if (data) {
          const cloudWords: DictionaryResult[] = data.map((item) => ({
            word: item.word,
            ipa: item.ipa || '',
            context_meaning_cn: item.definition_cn || '',
            context_meaning_en: item.definition_en || '',
            definition_cn: item.definition_cn || '',
            definition_en: item.definition_en || '',
            roots: item.roots || '',
            contexts: [] // 列表页暂时给空，点击详情时再动态加载
          }))
          set({ starredWords: cloudWords, hasFetchedStarredWords: true })
        }
      },

      fetchWordContext: async (word: string) => {
        const user = get().currentUser
        if (!user) return

        const { data, error } = await supabase
          .from('user_vocabulary')
          .select('contexts')
          .eq('user_id', user.id)
          .eq('word', word)
          .single()

        if (data && data.contexts) {
          set((state) => ({
            starredWords: state.starredWords.map((item) =>
              item.word === word ? { ...item, contexts: data.contexts } : item
            )
          }))
          return data.contexts
        }
        return []
      },

      syncLocalWordsToCloud: async () => {
        const { currentUser, starredWords } = get()
        if (!currentUser || starredWords.length === 0) return

        const { count } = await supabase
          .from('user_vocabulary')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', currentUser.id)

        if (count === 0) {
          const toSync = starredWords.map((w) => ({
            user_id: currentUser.id,
            word: w.word,
            ipa: w.ipa,
            definition_cn: w.definition_cn,
            definition_en: w.definition_en,
            roots: w.roots,
            is_saved: true,
          }))
          await supabase.from('user_vocabulary').insert(toSync)
        }
      },

      registerWordLookup: async (word: DictionaryResult, context: string) => {
        const user = get().currentUser
        if (!user) return

        // 1. 获取现有记录，重点是 contexts 数组
        const { data: existing } = await supabase
          .from('user_vocabulary')
          .select('lookup_count, contexts')
          .eq('user_id', user.id)
          .eq('word', word.word)
          .maybeSingle()

        const newCount = (existing?.lookup_count || 0) + 1
        const currentContexts = Array.isArray(existing?.contexts) ? existing.contexts : []

        // 2. 检查是否已存在相同的语境句子，避免重复
        const isDuplicate = currentContexts.some((c: any) => c.text === context)
        const newContexts = isDuplicate
          ? currentContexts
          : [
            {
              text: context,
              meaning: word.context_meaning_cn,
              created_at: new Date().toISOString()
            },
            ...currentContexts
          ].slice(0, 10) // 最多保留最近 10 个语境，防止字段过大

        // 3. Upsert 全量信息
        const { error } = await supabase.from('user_vocabulary').upsert({
          user_id: user.id,
          word: word.word,
          lookup_count: newCount,
          contexts: newContexts,
          last_interacted_at: new Date().toISOString(),
          ipa: word.ipa,
          definition_cn: word.definition_cn,
          definition_en: word.definition_en,
          roots: word.roots,
        }, { onConflict: 'user_id, word' })
        if (error) console.error('registerWordLookup Error:', error)
      },

      updateXP: async (amount: number) => {
        const user = get().currentUser
        const currentProfile = get().profile
        if (!user || !currentProfile) return
        const newXP = (currentProfile.total_xp || 0) + amount
        const { error } = await supabase
          .from('profiles')
          .update({
            total_xp: newXP,
            study_days: (currentProfile.study_days || 0) + (amount > 0 ? 1 : 0),
          })
          .eq('id', user.id)
        if (!error) {
          set({ profile: { ...currentProfile, total_xp: newXP } })
        }
      },

      updateProfile: async (updates: any) => {
        const user = get().currentUser
        const currentProfile = get().profile
        if (!user) return
        const { error } = await supabase
          .from('profiles')
          .update(updates)
          .eq('id', user.id)
        if (!error) {
          set({ profile: { ...(currentProfile || {}), ...updates } })
        } else {
          throw error
        }
      },

      setProfile: (profile: any) => {
        set({ profile })
      },

      setHasHydrated: (state) => {
        set({ _hasHydrated: state })
      },
    }),
    {
      name: 'scrollish-user-storage',
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.setHasHydrated(true)
        }
      },
    },
  ),
)
