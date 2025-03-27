const fs = require('fs').promises;
const path = require('path');
const RobotsGenerator = require('./robots-generator');
const SitemapGenerator = require('./sitemap-generator');

class PageGenerator {
    constructor(baseDir = __dirname) {
        this.baseDir = baseDir;
        this.i18nData = require('./i18n.json');  // 修正拼写错误
        this.sourceDir = path.join(this.baseDir, 'generate');
        this.outputDir = path.join(this.baseDir, 'public');
    }

    async generatePage(jsonData) {
        try {
            this.validateData(jsonData);
            const template = await this.prepareTemplate(jsonData);
            await this.writeFiles(template, jsonData);
            await this.saveSourceJson(jsonData);
        } catch (error) {
            console.error('生成页面时发生错误:', error);
            throw error;
        }
    }

    validateData(jsonData) {
        // 兼容旧版本数据格式
        if (jsonData.path) {
            // 如果存在 path，转换为新格式
            jsonData.resource_path = jsonData.path;
            jsonData.page_path = `${jsonData.path}/`;
            delete jsonData.path;  // 删除旧的 path 字段
        }

        // 设置默认语言
        if (!jsonData.lang) {
            jsonData.lang = 'en';
        }

        // page_path 为空表示首页
        jsonData.page_path = jsonData.page_path || '';

        // resource_path 必须存在
        if (!jsonData.resource_path) {
            throw new Error('JSON数据缺少必要的resource_path属性');
        }
    }

    getRootPath(jsonData) {
        if (jsonData.lang === 'en') {
            // 英文版：首页用 ./ ，内页用 ../
            return jsonData.page_path ? '../' : './';
        }
        // 其他语言：首页用 ../ ，内页用 ../../
        return jsonData.page_path ? '../../' : '../';
    }

    getTargetDir(jsonData) {
        // 首页直接放在语言目录下
        return jsonData.lang === 'en'
            ? path.join(this.baseDir, '..', jsonData.page_path)
            : path.join(this.baseDir, '..', jsonData.lang, jsonData.page_path);
    }

    async prepareTemplate(jsonData) {
        const langData = this.i18nData[jsonData.lang] || this.i18nData['en'];
        const template = await this.readTemplate();

        return this.processTemplate(template, jsonData, langData);
    }

    async readTemplate() {
        const templatePath = path.join(this.baseDir, 'index.html');
        if (!await this.fileExists(templatePath)) {
            throw new Error('模板文件不存在');
        }
        return await fs.readFile(templatePath, 'utf8');
    }

    processTemplate(template, jsonData, langData) {
        // 1. 首先处理多语言内容
        template = this.replaceI18nContent(template, langData);
        
        // 2. 处理特殊路径变量
        template = this.replaceRootPath(template, jsonData);
        
        // 3. 处理资源路径和页面路径
        template = template.replace(/{{path}}/g, jsonData.resource_path);
        template = template.replace(/{{resource_path}}/g, jsonData.resource_path);
        template = template.replace(/{{page_path}}/g, jsonData.page_path || '');
        
        // 4. 处理循环内容
        template = this.handleRepeatingContent(template, jsonData);
        
        // 5. 处理其余JSON数据，包括section标题等
        template = this.replaceJsonData(template, jsonData);
        
        // 6. 处理任何剩余的变量
        template = this.replaceRemainingVariables(template, jsonData);
        
        return template;
    }

    replaceRootPath(template, jsonData) {
        const rootPath = this.getRootPath(jsonData);
        return template.replace(/{{\/}}/g, rootPath);
    }

    replaceI18nContent(template, langData) {
        // 递归获取嵌套对象的值
        const getNestedValue = (obj, path) => {
            return path.split('.').reduce((current, key) => {
                return current && current[key];
            }, obj);
        };

        // 替换所有 i18n 变量，增加调试信息
        template = template.replace(/{{i18n\.([\w\.]+)}}/g, (match, path) => {
            const value = getNestedValue(langData, path);
            if (value === undefined) {
                console.warn(`Warning: Missing i18n value for path: ${path} in language ${langData.lang || 'unknown'}`);
                return match;
            }
            return value;
        });

        return template;
    }

    replaceRemainingVariables(template, jsonData) {
        // 处理特殊的section标题
        const sections = ['how-to-play', 'how to play'];
        sections.forEach(section => {
            const sectionData = jsonData[section];
            if (sectionData) {
                // 替换section的h2
                template = template.replace(
                    new RegExp(`{{${section.replace(/ /g, '-')}\\.h2}}`, 'g'),
                    sectionData.h2
                );
            }
        });
        return template;
    }

    handleRepeatingContent(template, jsonData) {
        const sections = [
            { key: 'features', marker: '{{features-loop}}' },
            { key: 'how-to-play', altKey: 'how to play', marker: '{{how-to-play-loop}}' },
            { key: 'tips', marker: '{{tips-loop}}' },
            { key: 'faq', marker: '{{faq-loop}}' }
        ];

        sections.forEach(section => {
            // 尝试使用主键或替代键获取内容
            const content = jsonData[section.key] || 
                          (section.altKey && jsonData[section.altKey]);
            
            if (content && content.content) {
                const html = this.generateSectionHtml(content.content);
                template = template.replace(section.marker, html);
            } else {
                console.warn(`Warning: Missing content for section: ${section.key}`);
            }
        });

        return template;
    }

    generateSectionHtml(content) {
        return content
            .map(item => `
                <div>
                    <h3>${item.h3}</h3>
                    <p>${item.content}</p>
                </div>`)
            .join('');
    }

    replaceJsonData(template, jsonData) {
        // 递归处理对象，生成扁平化的键值对
        const flattenObject = (obj, prefix = '') => {
            return Object.keys(obj).reduce((acc, key) => {
                // 跳过已经特殊处理的字段
                if (['resource_path', 'page_path', 'path', 'i18n'].includes(key)) {
                    return acc;
                }
                
                // 处理键名，支持空格和连字符
                const processedKey = prefix.length ? `${prefix}.${key}` : key;
                const alternativeKey = processedKey.replace(/ /g, '-');
                
                if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
                    Object.assign(acc, flattenObject(obj[key], processedKey));
                } else if (!Array.isArray(obj[key])) {
                    // 同时存储原始键和转换后的键
                    acc[processedKey] = obj[key];
                    if (processedKey !== alternativeKey) {
                        acc[alternativeKey] = obj[key];
                    }
                }
                return acc;
            }, {});
        };

        // 获取所有扁平化的键值对
        const flattenedData = flattenObject(jsonData);

        // 替换模板中的所有变量
        let processedTemplate = template;
        Object.entries(flattenedData).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                const regex = new RegExp(`{{${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}}}`, 'g');
                processedTemplate = processedTemplate.replace(regex, value);
            }
        });

        return processedTemplate;
    }

    async writeFiles(template, jsonData) {
        // 只写入 HTML 文件到输出目录
        const targetDir = this.getTargetDir(jsonData);
        await fs.mkdir(targetDir, { recursive: true });
        await this.writeHtmlFile(targetDir, template);

        // 删除原始的 data.json 文件
        const dataJsonPath = path.join(targetDir, 'data.json');
        try {
            await fs.unlink(dataJsonPath);
            console.log(`成功删除文件: ${dataJsonPath}`);
        } catch (error) {
            // 如果文件不存在，忽略错误
            if (error.code !== 'ENOENT') {
                console.warn(`删除文件失败: ${dataJsonPath}`, error);
            }
        }
    }

    // 新增：保存源 JSON 文件
    async saveSourceJson(jsonData) {
        const sourceDir = this.getSourceDir(jsonData);
        await fs.mkdir(sourceDir, { recursive: true });
        
        const fileName = jsonData.page_path 
            ? `${jsonData.resource_path}.json`
            : 'home.json';
            
        // 创建新的 JSON 对象，确保格式统一
        const normalizedData = {
            ...jsonData,
            lang: jsonData.lang || 'en',
            page_path: jsonData.page_path || '',
            resource_path: jsonData.resource_path
        };

        // 确保删除旧的 path 字段
        delete normalizedData.path;
            
        const jsonPath = path.join(sourceDir, fileName);
        await fs.writeFile(jsonPath, JSON.stringify(normalizedData, null, 2));
        console.log(`成功保存源文件: ${jsonPath}`);
    }

    // 新增：获取源文件目录
    getSourceDir(jsonData) {
        return path.join(this.sourceDir, jsonData.lang);
    }

    async writeHtmlFile(targetDir, template) {
        const targetPath = path.join(targetDir, 'index.html');
        await fs.writeFile(targetPath, template);
        console.log(`成功生成页面: ${targetPath}`);
    }

    async writeJsonFile(targetDir, jsonData) {
        const jsonPath = path.join(targetDir, 'data.json');
        await fs.writeFile(jsonPath, JSON.stringify(jsonData, null, 2));
        console.log(`成功生成数据文件: ${jsonPath}`);
    }

    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }
}

// 修改工具函数
async function addRecommendedGamesAndSync() {
    try {
        // 将导入移到函数内部
        // const addRecommendedGames = require('./addRecommendedGames');
        // const syncTemp = require('./sync_temp');

        // 1. 先添加推荐游戏到模板
        // await addRecommendedGames();
        // console.log('已添加推荐游戏到模板');

        // 2. 同步到所有页面
        // await syncTemp();
        // console.log('已同步推荐游戏到所有页面');
    } catch (error) {
        console.error('处理推荐游戏时发生错误:', error);
        throw error;
    }
}

async function generateSitemapAndRobots() {
    try {
        // 生成 sitemap.xml
        const sitemapGenerator = new SitemapGenerator();
        await sitemapGenerator.generate();

        // 生成 robots.txt
        const robotsGenerator = new RobotsGenerator();
        await robotsGenerator.generate();
    } catch (error) {
        console.error('生成 sitemap 和 robots 时发生错误:', error);
        throw error;
    }
}

// 修改主函数
async function main() {
    try {
        // 1. 添加推荐游戏并同步到所有页面
        await addRecommendedGamesAndSync();

        // 2. 生成当前页面
        const generator = new PageGenerator();
        const jsonData = require('./siteData.json');
        await generator.generatePage(jsonData);

        // 3. 生成 sitemap 和 robots
        await generateSitemapAndRobots();

        console.log('所有任务完成！');
    } catch (error) {
        console.error('执行过程中发生错误:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = {
    PageGenerator
};