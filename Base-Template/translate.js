const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

// DeepSeek API 配置
const DEEPSEEK_API_KEY = 'sk-e174179f4c354072912af01f17451553';
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

// 系统提示词
const SYSTEM_PROMPT = `
请将以下 JSON 内容翻译成中文，注意：
1. resource_path 和 page_path 这两个字段保持原样不要翻译
2. "lang": "en" 需要改为 "lang": "zh-CN"
3. 保持 JSON 格式和结构不变
4. 翻译要自然流畅，符合中文表达习惯
`;

async function translateWithDeepSeek(content) {
  try {
    const response = await axios.post(
      DEEPSEEK_API_URL,
      {
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: JSON.stringify(content, null, 2),
          },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 4000,
      },
      {
        headers: {
          Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return JSON.parse(response.data.choices[0].message.content);
  } catch (error) {
    console.error(`翻译失败: ${error.message}`);
    return null;
  }
}

async function processFiles() {
  try {
    const sourceDir = path.join(__dirname, 'generate/en');
    const targetDir = path.join(__dirname, 'generate/zh-CN');

    // 确保目标目录存在
    await fs.mkdir(targetDir, { recursive: true });

    // 读取所有 JSON 文件
    const files = await fs.readdir(sourceDir);
    const jsonFiles = files.filter(file => file.endsWith('.json'));

    for (const file of jsonFiles) {
      console.log(`正在处理: ${file}`);
      
      // 读取源文件
      const sourcePath = path.join(sourceDir, file);
      const content = JSON.parse(await fs.readFile(sourcePath, 'utf8'));

      // 翻译内容
      const translatedContent = await translateWithDeepSeek(content);
      
      if (translatedContent) {
        // 写入翻译后的文件
        const targetPath = path.join(targetDir, file);
        await fs.writeFile(
          targetPath, 
          JSON.stringify(translatedContent, null, 2),
          'utf8'
        );
        console.log(`已完成翻译: ${file}`);
      }
    }

    console.log('所有文件处理完成！');
  } catch (error) {
    console.error('处理文件时出错:', error);
  }
}

// 执行翻译
processFiles();