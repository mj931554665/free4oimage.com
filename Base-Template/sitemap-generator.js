const fs = require('fs').promises;
const path = require('path');

class SitemapGenerator {
    constructor(config = {}) {
        const parentDir = path.basename(path.dirname(__dirname));
        const domain = this._processDomainName(parentDir);
        
        const defaultConfig = {
            baseUrl: `https://${domain}`,
            ignoreDirs: ['css', 'js', 'img', 'assets', 'Base-Template', 'node_modules', '.git'],
            sitemap: {
                homepage: { priority: 1.0, changefreq: 'daily' },
                directory: { priority: 0.9, changefreq: 'daily' },
                page: { priority: 0.7, changefreq: 'weekly' }
            }
        };

        this.config = { ...defaultConfig, ...config };
        this.baseDir = path.join(__dirname, '..');
        this.pages = new Map();
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

    async scanDirectory(currentPath = this.baseDir, relativePath = '') {
        try {
            const files = await fs.readdir(currentPath);
            
            for (const file of files) {
                if (this.config.ignoreDirs.includes(file)) continue;
                
                const fullPath = path.join(currentPath, file);
                const stat = await fs.stat(fullPath);
                
                if (stat.isDirectory()) {
                    const indexPath = path.join(fullPath, 'index.html');
                    if (await this._checkFileExists(indexPath)) {
                        const urlPath = path.join(relativePath, file);
                        this.pages.set(urlPath, { ...this.config.sitemap.directory });
                    }
                    await this.scanDirectory(fullPath, path.join(relativePath, file));
                } else if (file.endsWith('.html') && file !== 'index.html') {
                    const urlPath = path.join(relativePath, file.replace('.html', ''));
                    this.pages.set(urlPath, { ...this.config.sitemap.page });
                }
            }
        } catch (error) {
            console.error('扫描目录时发生错误:', error);
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

    _generateUrlEntry(url, date, changefreq, priority) {
        url = url.replace(/\/+/g, '/');
        return `    <url>
        <loc>${this.config.baseUrl}${url}</loc>
        <lastmod>${date}</lastmod>
        <changefreq>${changefreq}</changefreq>
        <priority>${priority}</priority>
    </url>
`;
    }

    async generate() {
        try {
            await this.scanDirectory();
            const currentDate = new Date().toISOString().split('T')[0];
            const entries = [`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
                this._generateUrlEntry('/', currentDate, 
                    this.config.sitemap.homepage.changefreq,
                    this.config.sitemap.homepage.priority
                )
            ];

            for (const [urlPath, config] of this.pages) {
                entries.push(this._generateUrlEntry(
                    `/${urlPath}/`,
                    currentDate,
                    config.changefreq,
                    config.priority
                ));
            }

            entries.push('</urlset>');
            const sitemapContent = entries.join('\n');
            
            await fs.writeFile(path.join(this.baseDir, 'sitemap.xml'), sitemapContent, 'utf8');
            console.log('Sitemap 生成成功！');
            return sitemapContent;
        } catch (error) {
            console.error('生成 Sitemap 时发生错误:', error);
            throw error;
        }
    }
}

if (require.main === module) {
    const generator = new SitemapGenerator();
    generator.generate();
}

module.exports = SitemapGenerator;