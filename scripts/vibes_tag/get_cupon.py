import os
from dotenv import load_dotenv
from openai import OpenAI

# 1. 加载 .env 文件
load_dotenv()

# 2. 获取 API Key
api_key = os.getenv("VITE_SILICONFLOW_API_KEY")

if not api_key:
    print("错误: 未在 .env 中找到 VITE_SILICONFLOW_API_KEY")
else:
    # 3. 初始化客户端 (指向硅基流动的 API 地址)
    client = OpenAI(
        api_key=api_key,
        base_url="https://api.siliconflow.cn/v1"
    )

    try:
        # 4. 发起对话请求 (使用图片中的 Pro 模型路径)
        response = client.chat.completions.create(
            model="Pro/deepseek-ai/DeepSeek-V3.2", # 也可以换成 Pro/moonshotai/Kimi-K2.5
            messages=[
                {"role": "system", "content": "你是一个精通代码的助手。"},
                {"role": "user", "content": "你好，请写一段简单的 Python 冒泡排序代码，用于测试 API 是否调用成功。"}
            ],
            stream=False # 如果需要打字机效果，可以改为 True 并循环读取
        )

        # 5. 打印返回结果
        print("--- 模型回复 ---")
        print(response.choices[0].message.content)
        print("\n--- 任务完成！ ---")

    except Exception as e:
        print(f"调用失败: {e}")