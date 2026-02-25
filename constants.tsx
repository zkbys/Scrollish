import { Post, GroupChat, ChatMessage } from './types'

export const IMAGES = {
  london:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuCYVOKo6FOv-iiTUpbmWnSsN22a0a1ia6KQqsbbXTefmIdNCVRoH09Hevm8b_rYAGXhqurPsd6FeFNyb8FVa_897s4f0zM4_RdEyVtL-WeMc3EYfXe4lWd0dhcLRtzmVJAlTuQHK1s3kxkC4a-b98C2bA2me-wwvLtNrLph7X4Q3zQqWk0M-ckWsF0IOpZ_NknegS55YLkR_wdgszZLE4Tg15lpUGBOYB9aEdvuPHGyGAgNDDUxRREmBbPdpkOShuBkP6WHI9z70Xju',
  grammar:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuCMAITFsRVWjQ13LHcM95bv4XBIxAc8SkT-DJRAX_fXV9i4WOfcLRH3GunlUzVrkM1V7kCwa-lEvcHxbKmTHyHmKu3sZFbE2QolDXNegnyqltzTpgq96FzA_PNJf_N9qnv0oBKbeSd7bXQF_flB6t_P2QMt2ssDacZjx3YHNoGpof32kQfgJGu7ZFcBePKl-eG_F8a-6FVxJcjKwSzvzc80-nQZw54VlTVV4F-87v872vMKzJrk9GfGSsoXoVdrZ-tlYPHRgg6zKfg',
  profile:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuDPXBzGoqOC4C8ICh63UFgeRIBCZx8bmgXULqg_6T5A9U1A-jNnBBnW8xh2NSXePQIw8of7cdY3aOFPNSCKAoD66puVQsODt9IRK59kdvLmUnEsUQtUTjldJzlOqiaRWZqz9LuJ0RgJafVrsSD-Gukie9qzaYTROJ8gIkkXj1VIx3KEZaL3idIhxxmfv8n-yiKOaG4BLOdt0oCxb7RsA6Kka56KDA-CRH-g67SlQo5jGOZOT1lwrIx3enSEFnL8TNAaAzjKwtXXBkg',
  casual:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuDV7Wvku6MFhxCvopuvrDPW21JTAO9DIkzp5CjRbxRxLe0mnDNUWGpDa0br5ktzIX6FlkefAzE_3g9_O2ZfasKEu7xuLc6AP-PxEsdFeNa_viP_KXJhQa4Suv_3ObJBKUfhwfKBhuezQhtUXDNzRmArs6O9vN1e24IOaOJOBoFK6WMLgeVztyFr7noDuKKFmJNNW5haSsIuj8oFfBNdwkQwsnHwPQ97hnvasAjwTlD26kfab7misSDZOC7mcJF3_x6o0VWElA2a-wo',
  cooking:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuAS7hpmUxZGfqtuxgucqKsF_UIDg8bfN0KCwuE44JAlFx2FexUCDoAlD05fRAUP4JC3QKOZG5DRNP4n1aSn8bPVB8snY90Q93-9ZqiMryZpOjH1pk0vuWD6YeWuhcHWFNtKMW6lYmRQpisr2sVFy6IXHCSJzeSeQvRfPIWsDcpW_lOXm3wJAHEWeCaMiSTAqeSLai3VclzmomsF5DZ1RNWD9YfTuAYKD-jfIAsJIRUtaEt9KwW1nwZSeo6Cbektx0yNHI9ZkRLZoFw',
  avatar1:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuCU611lCbMZL1OGcxE2dzlWl8gimJ-W5U0TgtrVCcLMzaoMuhas0kMWtJsU0BcnJNcELbFfQq-9la9q8DU96DaF_OJpPUueHTS2A1JUdGUJLJLO7O1QitauNI2ZZx4O9eA3Tlmrj6ovGcqlWMu90UPmRZO1p6GW_4tXurLEByjF2NQyh4kFsiiG3O3kmRRIulqA4lrYBZw-2eumOoM6BunB7rVaR90JnJan-SKhkcKuPOi6MNeKQF8xkLrcWAhOLFmtl2DlE8V7kFme',
  avatarAi:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuCU611lCbMZL1OGcxE2dzlWl8gimJ-W5U0TgtrVCcLMzaoMuhas0kMWtJsU0BcnJNcELbFfQq-9la9q8DU96DaF_OJpPUueHTS2A1JUdGUJLJLO7O1QitauNI2ZZx4O9eA3Tlmrj6ovGcqlWMu90UPmRZO1p6GW_4tXurLEByjF2NQyh4kFsiiG3O3kmRRIulqA4lrYBZw-2eumOoM6BunB7rVaR90JnJan-SKhkcKuPOi6MNeKQF8xkLrcWAhOLFmtl2DlE8V7kFme',
  avatarPro:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuCGg1-o29ZDuFJzsYzxjtrBig17Ehz1uuQzBIK-XFWuXc_ORfoYy4EPY4oqvnE1o8K7LeVzOSBqVGIbaNMnIyRVyxHI3amcrmD0ZjKk-6Ep0dG_ieNIOjsZrzGkQm2uEzb4qY7MIbEqz5q20EGfbKcou8JI_cDampvEk4IJ2z30cieUIEZDT_LvsULN4uj8j5JAApATyVvs8qsj5o6QlrYItNRd2RMaJmKw7TMfDlRECnygM0K21CytrHM6PJHVfzWyUVTuUoMjB_OX',
  avatarMe:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuASTleqh_PHC98OfDRB4sMamFWgNQxE1ka153bTUyAWQG45bqlgDhcNRT5zZEHEc71lzhPzOcnxGlosrZaGVBtJZdy2bbksIxozLgmbblB6wf75q7l2pip4lyDvfis2MlZT26TaxZnWKav1EWtGR7oOI2E2aw1rS1a2Jjd5NA_nBtL7OX8dWz-l9AuiXz3UkiMwQ7at5XyppzkJGzGgFObYo_zpxRda1eqAP5Y8c8T14ghQ5tmihUQ3NUAt5LeeNAi-JJIxqaZYRfg-',
  vinyl:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuCRj1icx8VPNxHntTvx58OGort1b-EY7PO3t-xJXZnjzVY25xjfumYlkbJjTvUx2_kcRPgnmRgqy9CiJzvXSsFJKmkj8boSSBXYRYyHQdL5pDrBTJkQqmvX_VZHgiOAA9ePy4YXkf3M7-VDqMORToWY9fkvOyJNoh9DnhBSfF09ehwQH1YH6E2gSN4DID-ZHDh4rBE-CbpSAI4SIsjOf_Kt5GPJ3Ii80tjrBANeDsZF3QNjy9KpBf9ED5EjD-LHGeJX-Om2ePNinGrf',
  onboarding1: '/onboarding_vision_1.png',
  onboarding2: '/onboarding_vision_2.jpg',
  onboarding3: '/dopa_logo.png',
  aiDopa: '/ai_dopa.png',
  avatarProfile: '/no_001.png',
}

// 辅助函数：确保在生产环境（子路径部署）下路径正确
export const getAssetPath = (path: string) => {
  if (path.startsWith('http')) return path
  // 在当前 CentOS 部署环境下，强制使用 /scrollish 前缀
  const base = '/scrollish'
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  return `${base}${cleanPath}`.replace(/\/+/g, '/')
}

export const POSTS: Post[] = [
  {
    id: 'post-1',
    user: '@RedEnglish_London',
    avatar: IMAGES.vinyl,
    titleEn: 'Traveling in London',
    titleZh: '伦敦旅行必备口语：如何优雅地乘坐红色巴士？🚌',
    hashtags: ['EnglishLearning', 'LondonTravel'],
    image: IMAGES.london,
    videoUrl: null,
    likes: '12.4k',
    stars: '4.2k',
    comments: 856,
  },
  {
    id: 'post-2',
    user: '@EnglishRules',
    avatar: IMAGES.casual,
    titleEn: 'Master English Rules',
    titleZh: '掌握英语规则，告别中式翻译。',
    hashtags: ['Grammar', 'StudyTips'],
    image: IMAGES.grammar,
    videoUrl: null,
    likes: '8.1k',
    stars: '2.5k',
    comments: 432,
  },
  {
    id: 'post-3',
    user: '@ChefTalk',
    avatar: IMAGES.avatarPro,
    titleEn: 'Kitchen Essentials',
    titleZh: '厨房常用英文：这些厨具你都叫得出名字吗？🍳',
    hashtags: ['Cooking', 'Vocabulary'],
    image: IMAGES.cooking,
    videoUrl: null,
    likes: '5.2k',
    stars: '1.8k',
    comments: 241,
  },
  {
    id: 'post-4',
    user: '@SlangMaster',
    avatar: IMAGES.avatar1,
    titleEn: 'Daily Slang 101',
    titleZh: '地道美国俚语：别再说 "Very happy" 了！',
    hashtags: ['Slang', 'Speaking'],
    image: IMAGES.casual,
    videoUrl: null,
    likes: '19.8k',
    stars: '9.3k',
    comments: 1502,
  },
]

export const GROUP_CHATS: GroupChat[] = [
  {
    id: 'group-1',
    user: 'u/party_animal',
    avatar: IMAGES.avatar1,
    lastMessage:
      'I think the underground is the fastest way to get to Big Ben from here.',
    time: '2m ago',
    isActive: true,
    previewMessages: [
      {
        text: 'Honestly, the vibe is just off. Everyone is merely content farming.',
        isMe: false,
      },
      { text: 'Yeah, it feels like a simulacrum...', isMe: true },
    ],
  },
  {
    id: 'group-2',
    user: 'u/english_buff',
    avatar: IMAGES.avatarPro,
    lastMessage: '"Has anyone tried the fish and chips at the Borough Market?"',
    time: '15m ago',
    isAi: true,
    previewMessages: [
      { text: "I'm heading to Borough Market soon.", isMe: false },
      { text: 'The fish and chips there are legendary!', isMe: false },
    ],
  },
  {
    id: 'group-3',
    user: 'u/global_traveler',
    avatar: IMAGES.avatarMe,
    lastMessage:
      'The museums are free, which is great for students on a budget.',
    time: '1h ago',
    previewMessages: [
      { text: 'Best budget tips for London?', isMe: true },
      { text: 'Free museums are definitely a win.', isMe: false },
    ],
  },
]

export const MESSAGES: ChatMessage[] = [
  {
    id: 'msg-1',
    user: 'u/party_animal',
    avatar: IMAGES.avatar1,
    contentEn: 'Clubbing feels like a simulacrum of fun.',
    contentZh: '去夜店感觉就像是某种快乐的模拟物。',
    level: 1,
    analysis: {
      keyword: 'simulacrum',
      type: 'culture',
      explanation:
        '俚语/哲学词汇：指代一种虚假的、没有原型的模拟物。在Gen Z语境下，常指为了社交媒体摆拍而存在的‘伪快乐’。',
    },
  },
  {
    id: 'msg-2',
    user: 'u/Sarah_Learner',
    avatar: IMAGES.avatarPro,
    contentEn: 'Exactly! Everyone is just content farming.',
    contentZh: '没错！大家只是在‘内容耕作’（指为了发动态而发动态）。',
    level: 2,
    analysis: {
      keyword: 'content farming',
      type: 'slang',
      explanation:
        '互联网俚语：指代没有灵魂地大量生产社交媒体内容，目的仅仅是为了流量或展示生活。',
    },
  },
  {
    id: 'msg-3',
    user: 'u/GenZ_Refugee',
    avatar: IMAGES.avatarMe,
    contentEn: "Wait, I don't get it. Why not just enjoy the music?",
    contentZh: '等等，我不明白。为什么不直接享受音乐呢？',
    level: 3,
    replyTo: 'u/party_animal',
    replyContent: 'Clubbing feels like a simulacrum of fun.',
  },
  {
    id: 'msg-4',
    user: 'Tutor_AI',
    avatar: IMAGES.avatarAi,
    contentEn:
      "Good point! But in Gen Z culture, the 'vibe' is often curated for the screen.",
    contentZh: '好问题！但在Z世代文化中，‘氛围’往往是为屏幕精心策划的。',
    level: 1,
    isAi: true,
  },
]
export const VOICES = [
  { id: 'cherry', label: '芊悦 (Cherry)', desc: '阳光积极、亲切自然小姐姐，精通多国语言。' },
  { id: 'jennifer', label: '詹妮弗 (Jennifer)', desc: '品牌级、电影感美式女声，声音富有磁性。' },
  { id: 'ryan', label: '甜茶 (Ryan)', desc: '节奏拉满，戏感炸裂，真实与张力共舞。' },
  { id: 'pip', label: '小新 (Pip)', desc: '那个调皮捣蛋又充满童真的小家伙，带着熟悉的笑声回来了。' },
  { id: 'sunny', label: '晴儿 (Sunny)', desc: '甜到你心里的川妹子。' },
  { id: 'aiden', label: '艾登 (Aiden)', desc: '精通厨艺的美语大男孩。' },
  { id: 'katerina', label: '卡捷琳娜 (Katerina)', desc: '御姐音色，韵律回味十足。' },
  { id: 'elias', label: '墨讲师 (Elias)', desc: '博学多才的导师感，能把复杂知识讲成动人故事。' },
  { id: 'bellona', label: '燕铮莺 (Bellona)', desc: '金戈铁马入梦来，字正腔圆间尽显千面人声的江湖。' },
  { id: 'vincent', label: '田叔 (Vincent)', desc: '一口独特的沙哑烟嗓，一开口便道尽了千军万马与江湖豪情。' },
  { id: 'stella', label: '少女阿月 (Stella)', desc: '平时是甜到发腻的迷糊少女音，但在喊出“代表月亮消灭你”时，瞬间充满不容置疑的爱与正义。' },
  { id: 'roy', label: '阿杰 (Roy)', desc: '诙谐直爽的台湾哥仔。' },
  { id: 'Chelsie', label: '千雪 (Chelsie)', desc: '二次元虚拟女友。' },
  { id: 'Momo', label: '茉兔 (Momo)', desc: '撒娇搞怪，逗你开心。' },
  { id: 'Vivian', label: '十三 (Vivian)', desc: '拽拽的、可爱的小暴躁。' },
  { id: 'Moon', label: '月白 (Moon)', desc: '率性帅气的月白。' },
  { id: 'Maia', label: '四月 (Maia)', desc: '知性与温柔的碰撞。' },
  { id: 'Eldric Sage', label: '沧明子 (Eldric)', desc: '沉稳睿智的老者，沧桑如松。' },
  { id: 'Mia', label: '乖小妹 (Mia)', desc: '温顺如春水，乖巧如初雪。' },
  { id: 'Mochi', label: '沙小弥 (Mochi)', desc: '聪明伶俐的小大人，早慧如禅。' },
  { id: 'Bunny', label: '萌小姬 (Bunny)', desc: '“萌属性”爆棚的小萝卜莉。' },
  { id: 'Neil', label: '阿闻 (Neil)', desc: '字正腔圆的最专业新闻主持人。' },
  { id: 'Nini', label: '妮妮 (Nini)', desc: '糯米糍一样又软又黏的嗓音。' },
  { id: 'Ebona', label: '智婆婆 (Ebona)', desc: '慈祥的老奶奶，声音里满是岁月的故事。' },
  { id: 'Seren', label: '小婉 (Seren)', desc: '温和舒缓的声线，助眠晚安。' },
  { id: 'Ono Anna', label: '小野杏 (Ono Anna)', desc: '鬼灵精怪的青梅竹马。' },
]
