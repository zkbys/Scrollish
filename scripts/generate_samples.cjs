const fs = require('fs');
const https = require('https');
const path = require('path');

const SUPABASE_URL = 'https://zgteuwwhiwfglrvjcekq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpndGV1d3doaXdmZ2xydmpjZWtxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMzkzMzIsImV4cCI6MjA4NDcxNTMzMn0.P0gdezCsygv2UXWzy8Sm-WM8SCUDMWSdNv9j4q1-1Vw';
const VOICE_ENDPOINT = `${SUPABASE_URL}/functions/v1/tts`;

const scripts = [
    { id: 'cherry', text: "Hi, 我是芊悦！很高兴能陪你一起学习，让我们开启一段奇妙的语言旅程吧。" },
    { id: 'jennifer', text: "Hello, I'm Jennifer. Let's experience cinema-grade language learning together." },
    { id: 'ryan', text: "Ready to rock? 我是甜茶，带你感受最有张力的台词魅力！" },
    { id: 'pip', text: "嘿嘿，大象大象，你的鼻子为什么那么长~ 我是小新，快来陪我玩呀！" },
    { id: 'sunny', text: "哈喽，我是晴儿，作为一个甜甜的川妹子，我会一直为你加油哒！" },
    { id: 'aiden', text: "Hey there, I'm Aiden. 除了教你英语，我还能教你做几道拿手好菜哦。" },
    { id: 'katerina', text: "我是卡捷琳娜，让语言在韵律中流淌，感受每一个音节的优雅。" },
    { id: 'elias', text: "同学们好，我是墨讲师。今天，我们要把枯燥的语法变成最动听的故事。" },
    { id: 'bellona', text: "燕铮莺在此。金戈铁马，字正腔圆，且听我为你道来这万千江湖。" },
    { id: 'vincent', text: "我是田叔。这一嗓子沙哑，藏着江湖的酒，也藏着教你的词。" },
    { id: 'stella', text: "我是少女阿月！嘿嘿，代表月亮消灭你的语言障碍！爱与正义，出击！" },
    { id: 'roy', text: "哎呀，我是阿杰啦！台湾哥仔带你轻松学英语，保准你不会无趣哦。" },
];

const outputDir = path.join(__dirname, '../public/audio/samples');
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

async function generateSample(item) {
    console.log(`Generating sample for ${item.id}...`);
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({
            text: item.text,
            voice: item.id,
            format: 'wav'
        });

        const req = https.request(VOICE_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'apikey': SUPABASE_ANON_KEY
            }
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', async () => {
                if (res.statusCode !== 200) {
                    return reject(new Error(`Failed to generate ${item.id}: ${data}`));
                }

                try {
                    const { url } = JSON.parse(data);
                    if (!url) return reject(new Error(`No URL for ${item.id}`));

                    // Download the file
                    const file = fs.createWriteStream(path.join(outputDir, `${item.id}.wav`));
                    const downloader = url.startsWith('https') ? https : require('http');
                    downloader.get(url, (res) => {
                        res.pipe(file);
                        file.on('finish', () => {
                            file.close();
                            console.log(`Saved ${item.id}.wav`);
                            resolve();
                        });
                    }).on('error', reject);
                } catch (e) {
                    reject(new Error(`Parse error for ${item.id}: ${e.message}`));
                }
            });
        });

        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

(async () => {
    for (const item of scripts) {
        try {
            await generateSample(item);
        } catch (e) {
            console.error(`Error for ${item.id}:`, e.message);
        }
    }
    console.log('All samples generation process finished.');
})();
