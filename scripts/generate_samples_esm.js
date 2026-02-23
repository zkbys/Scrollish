import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = 'https://zgteuwwhiwfglrvjcekq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpndGV1d3doaXdmZ2xydmpjZWtxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMzkzMzIsImV4cCI6MjA4NDcxNTMzMn0.P0gdezCsygv2UXWzy8Sm-WM8SCUDMWSdNv9j4q1-1Vw';
const VOICE_ENDPOINT = `${SUPABASE_URL}/functions/v1/tts`;

const scripts = [
    { id: 'cherry', text: "你好，我是芊悦！很高兴能陪你一起学习，让我们开启一段奇妙的语言旅程吧。" },
    { id: 'jennifer', text: "Hello, I'm Jennifer. Let's experience cinema-grade language learning together." },
    { id: 'ryan', text: "Hey, what's up? I'm Ryan. Let's dive into some real-talk and make your English sound sharp and natural." },
    { id: 'pip', text: "要记得按时吃饭哦？" },
    { id: 'sunny', text: "哈喽，我是晴儿，作为一个甜甜的川妹子，我会一直为你加油哒！" },
    { id: 'aiden', text: "Hey there, I'm Aiden. Besides helping you with your English, I can also show you how to cook some of my favorite recipes. Let's get started!" },
    { id: 'katerina', text: "Greetings, I am Katerina. Let us explore the beauty of language together, with elegance and grace." },
    { id: 'elias', text: "同学们好，我是墨讲师。今天，我们要把枯燥的语法变成最动听的故事。" },
    { id: 'bellona', text: "燕铮莺在此。金戈铁马，字正腔圆，且听我为你道来这万千江湖。" },
    { id: 'vincent', text: "我是田叔。这一嗓子沙哑，藏着江湖的酒，也藏着教你的词。" },
    { id: 'stella', text: "我是少女阿月！嘿嘿，代表月亮消灭你的语言障碍！爱与正义，出击！" },
    { id: 'roy', text: "哎呀，我是阿杰啦！台湾哥仔带你轻松学英语，保准你不会无趣哦。" },
    { id: 'Chelsie', text: "亲爱的，我是千雪。我会一直温柔地陪伴在你的左右哦。" },
    { id: 'Momo', text: "我是茉兔，快来跟我一起玩嘛，我会把你逗得开开心心的！" },
    { id: 'Vivian', text: "快系好安全带。这条路我罩着你。哼！还不快过来？" },
    { id: 'Moon', text: "你好，我是月白。让我们一起在文字的海洋里，寻找最快乐的自我吧。" },
    { id: 'Maia', text: "你好，我是四月。你怎么知道我挺会读英语的，我高中英语也不是特别好吧，大概也就是年级前十吧。" },
    { id: 'Eldric Sage', text: "老夫沧明子。沧桑如松，必当心明如镜。今日，且与小友共话这世间学问。" },
    { id: 'Mia', text: "哥哥姐姐好，我是乖小妹。学累的话就休息一下吧，我陪着你。" },
    { id: 'Mochi', text: "阿弥陀佛，我是沙小弥。早慧如禅，童真未泯。施主，今日可有慧根增进？" },
    { id: 'Bunny', text: "萌萌哒！我是萌小姬，萌属性爆棚的小萝莉就是我啦，欧尼酱要一直喜欢我哦！" },
    { id: 'Neil', text: "各位观众朋友大家好，我是阿闻。接下来为您播报今日的英语学习要点，请保持关注。" },
    { id: 'Nini', text: "哥哥~ 我是妮妮呀。这声哥哥叫得你心软了吗？那我们就开始今天的学习吧。" },
    { id: 'Ebona', text: "我是诡婆婆... 呵呵呵，别害怕，那角落里藏着的，不过是你不敢承认的恐惧罢了..." },
    { id: 'Seren', text: "嘘... 我是小婉。夜深了，让我陪你进入甜美的梦乡。晚安。" },
    { id: 'Ono Anna', text: "为！作为你的青梅竹马，我可不允许你在学习上偷懒哦！" },
];

const outputDir = path.join(__dirname, '../public/audio/samples');
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

async function generateSample(item) {
    console.log(`Generating sample for ${item.id}...`);

    try {
        const response = await fetch(VOICE_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({
                text: item.text,
                voice: item.id,
                format: 'wav'
            })
        });

        const data = await response.json();
        if (!response.ok) {
            console.error(`Error for ${item.id}:`, data);
            return;
        }

        const { url } = data;
        if (!url) {
            console.warn(`No URL for ${item.id}`);
            return;
        }

        console.log(`Downloading ${item.id} from ${url}...`);
        const audioRes = await fetch(url);
        if (!audioRes.ok) throw new Error(`Failed to download ${item.id}`);

        const buffer = Buffer.from(await audioRes.arrayBuffer());
        // 将空格替换为下划线，并将 ID 转为小写以保持文件名的一致性
        const safeId = item.id.toLowerCase().replace(/\s+/g, '_');
        fs.writeFileSync(path.join(outputDir, `${safeId}_v2.wav`), buffer);
        console.log(`Successfully saved ${safeId}_v2.wav`);
    } catch (error) {
        console.error(`Failed ${item.id}:`, error.message);
    }
}

(async () => {
    const targetId = process.argv[2];

    // 如果提供了参数，则只处理指定的音色（支持原始 ID 或文件名安全 ID）
    const itemsToProcess = targetId
        ? scripts.filter(s =>
            s.id.toLowerCase() === targetId.toLowerCase() ||
            s.id.toLowerCase().replace(/\s+/g, '_') === targetId.toLowerCase()
        )
        : scripts;

    if (targetId && itemsToProcess.length === 0) {
        console.log(`\nUsage: node scripts/generate_samples_esm.js [VoiceID]`);
        console.log(`Available IDs: ${scripts.map(s => s.id).join(', ')}`);
        console.error(`\nError: Voice ID "${targetId}" not found.`);
        process.exit(1);
    }

    console.log(targetId ? `Processing single voice: ${itemsToProcess[0].id}` : `Processing all ${scripts.length} voices...`);

    for (const item of itemsToProcess) {
        try {
            await generateSample(item);
        } catch (e) {
            console.error(`Error for ${item.id}:`, e.message);
        }
    }
    console.log('Done.');
})();
