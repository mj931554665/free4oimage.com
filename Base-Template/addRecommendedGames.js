const fs = require('fs').promises;
const path = require('path');

async function addRecommendedGames() {
    try {
        // 读取游戏数据
        const exploreData = await fs.readFile(path.join(__dirname, 'https://sprunkigame.com/js/explore.json'), 'utf8');
        const { games } = JSON.parse(exploreData);

        // 只取前20个游戏
        const limitedGames = games.slice(0, 20);

        // 生成 HTML
        const html = limitedGames.map(game => {
            const gameUrl = game.redirectTo || `https://sprunkigame.com${game.gamePath}`;
            return `
            <a href="${gameUrl}" class="block bg-gray-800 rounded-lg overflow-hidden hover:scale-105 transition-transform duration-300 md:hidden h-[280px]">
                <div class="relative">
                    <img src="${game.imgSrc}" class="w-full h-36 object-cover" alt="${game.alt}">
                    <p class="absolute bottom-2 right-2 text-white text-xs flex items-center bg-black/50 px-2 py-1 rounded">
                        <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        ${game.onlineDate || 'Coming Soon'}
                    </p>
                </div>
                <div class="p-4 flex flex-col h-[calc(280px-144px)]">
                    <div class="font-bold text-white" title="${game.title}">${game.title}</div>
                    <p class="text-gray-400 text-sm mb-2" title="${game.description}">${game.description}</p>
                </div>
            </a>
            
            <a href="${gameUrl}" class="hidden md:block bg-white rounded-lg overflow-hidden shadow-md transition duration-300 hover:shadow-xl hover:-translate-y-1 h-[180px]">
                <div class="relative">
                    <img src="${game.imgSrc}" alt="${game.alt}" class="w-full h-24 object-cover">
                    <p class="absolute bottom-2 right-2 text-white text-xs flex items-center bg-black/50 px-2 py-1 rounded">
                        <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        ${game.onlineDate || 'Coming Soon'}
                    </p>
                </div>
                <div class="p-2 flex flex-col h-[calc(180px-96px)]">
                    <div class="text-sm font-semibold mb-1 text-red-700" title="${game.title}">${game.title}</div>
                    <p class="text-xs text-gray-600 mb-1" title="${game.description}">${game.description}</p>
                </div>
            </a>`;
        }).join('\n');

        // 读取模板文件
        const templatePath = path.join(__dirname, 'index.html');
        let template = await fs.readFile(templatePath, 'utf8');

        // 使用正则表达式在标记之间替换内容
        template = template.replace(
            /(<!-- #region recommended-games -->)[\s\S]*?(<!-- #endregion recommended-games -->)/,
            `$1\n${html}\n        $2`
        );

        // 移除原来的 renderRecommendedGames.js 引用
        template = template.replace(
            '<script src="{{/}}js/renderRecommendedGames.js"></script>',
            ''
        );

        // 写回文件
        await fs.writeFile(templatePath, template);
        console.log('成功添加前20个推荐游戏到模板');

    } catch (error) {
        console.error('处理推荐游戏时发生错误:', error);
        throw error; // 抛出错误以便调用方知道执行失败
    }
}

// 导出函数
module.exports = addRecommendedGames;

// 如果直接执行此文件则运行函数
if (require.main === module) {
    addRecommendedGames().catch(error => {
        console.error('执行失败:', error);
        process.exit(1);
    });
}