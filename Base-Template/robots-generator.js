const fs = require('fs').promises;
const path = require('path');

class RobotsGenerator {
    constructor(config = {}) {
        const parentDir = path.basename(path.dirname(__dirname));
        const domain = this._processDomainName(parentDir);
        
        const defaultConfig = {
            baseUrl: `https://${domain}`,
            ignoreDirs: ['css', 'js', 'img', 'assets', 'Base-Template', 'node_modules', '.git'],
            robots: {
                crawlDelay: 10,
                disallowDirs: [
                    '/Base-Template/',
                    '/css/',
                    '/js/',
                    '/img/',
                    '/assets/',
                    '/node_modules/',
                    '/.git/'
                ]
            }
        };

        this.config = { ...defaultConfig, ...config };
        this.baseDir = path.join(__dirname, '..');
    }

    _processDomainName(dirName) {
        if (dirName.endsWith('-app')) {
            return dirName.replace(/-app$/, '.app');
        }
        if (/\.[a-z]{2,}$/.test(dirName)) {
            return dirName;
        }
        return `${dirName}.com`;
    }

    async scanDirectory() {
        try {
            const dirs = new Set();
            const files = await fs.readdir(this.baseDir);
            
            for (const file of files) {
                if (this.config.ignoreDirs.includes(file)) continue;
                
                const fullPath = path.join(this.baseDir, file);
                const stat = await fs.stat(fullPath);
                
                if (stat.isDirectory()) {
                    const indexPath = path.join(fullPath, 'index.html');
                    if (await this._checkFileExists(indexPath)) {
                        dirs.add(file);
                    }
                }
            }
            return Array.from(dirs);
        } catch (error) {
            console.error('扫描目录时发生错误:', error);
            return [];
        }
    }

    async _checkFileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    async generate() {
        try {
            const dirs = await this.scanDirectory();
            const entries = [
                `# robots.txt for ${this.config.baseUrl}`,
                'User-agent: *',
                'Allow: /',
                ...dirs.map(dir => `Allow: /${dir}/`),
                '',
                '# 站点地图',
                `Sitemap: ${this.config.baseUrl}/sitemap.xml`,
                '',
                '# 爬虫限制',
                `Crawl-delay: ${this.config.robots.crawlDelay}`,
                '',
                '# 禁止访问的目录',
                ...this.config.robots.disallowDirs.map(dir => `Disallow: ${dir}`)
            ];

            const robotsContent = entries.join('\n');
            await fs.writeFile(path.join(this.baseDir, 'robots.txt'), robotsContent, 'utf8');
            console.log('robots.txt 生成成功！');
            return robotsContent;
        } catch (error) {
            console.error('生成 robots.txt 时发生错误:', error);
            throw error;
        }
    }
}

if (require.main === module) {
    const generator = new RobotsGenerator();
    generator.generate();
}

module.exports = RobotsGenerator;