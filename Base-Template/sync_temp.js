const fs = require('fs').promises;
const path = require('path');

async function syncPages() {
    // 将 PageGenerator 的导入移到函数内部
    const { PageGenerator } = require('./generate');
    const generator = new PageGenerator(__dirname);
    const sourceDir = path.join(__dirname, 'generate');

    try {
        // 获取generate目录下的所有语言目录
        const langDirs = await fs.readdir(sourceDir);
        console.log('找到以下语言目录:', langDirs);

        // 处理每个语言目录
        for (const lang of langDirs) {
            const langDir = path.join(sourceDir, lang);
            
            // 确保是目录
            const stats = await fs.stat(langDir);
            if (!stats.isDirectory()) continue;

            console.log(`\n处理 ${lang} 语言...`);
            
            // 获取该语言目录下的所有JSON文件
            const files = (await fs.readdir(langDir))
                .filter(file => file.endsWith('.json'));
            
            // 处理该语言下的每个文件
            for (const file of files) {
                try {
                    const filePath = path.join(langDir, file);
                    const jsonData = require(filePath);
                    
                    console.log(`正在生成 ${lang}/${file} 的页面...`);
                    await generator.generatePage(jsonData);
                    
                } catch (error) {
                    console.error(`处理 ${lang}/${file} 时发生错误:`, error);
                }
            }
        }
        
        console.log('\n所有页面更新完成！');
    } catch (error) {
        console.error('同步过程中发生错误:', error);
        throw error; // 抛出错误以便调用方知道执行失败
    }
}

// 导出函数
module.exports = syncPages;

// 如果直接执行此文件则运行函数
if (require.main === module) {
    syncPages().catch(error => {
        console.error('执行失败:', error);
        process.exit(1);
    });
}