/**
 * 主题管理器
 * 管理大纲视图的主题配色切换
 */

export interface Theme {
    id: string;
    name: string;
    description: string;
}

export const THEMES: Theme[] = [
    {
        id: 'default',
        name: '默认',
        description: '跟随 Obsidian 主题'
    },
    {
        id: 'classic-white',
        name: '经典白',
        description: '白色背景，深灰文字'
    },
    {
        id: 'dark-orange-green',
        name: '暗夜橙绿',
        description: '黑色背景，橙绿配色'
    },
    {
        id: 'warm-beige',
        name: '米白灰',
        description: '米白背景，温暖舒适'
    },
    {
        id: 'soft-purple',
        name: '淡紫',
        description: '淡紫背景，优雅柔和'
    },
    {
        id: 'deep-blue',
        name: '深蓝',
        description: '深蓝背景，专注沉稳'
    },
    {
        id: 'dark-gray',
        name: '深灰',
        description: '深灰背景，简约现代'
    },
    {
        id: 'forest-green',
        name: '森林绿',
        description: '护眼绿色，自然清新'
    },
    {
        id: 'ocean-blue',
        name: '海洋蓝',
        description: '蓝色背景，清爽宁静'
    },
    {
        id: 'sunset-orange',
        name: '日落橙',
        description: '橙色调，温暖活力'
    },
    {
        id: 'cherry-pink',
        name: '樱花粉',
        description: '粉色背景，柔和浪漫'
    },
    {
        id: 'midnight-black',
        name: '午夜黑',
        description: '纯黑背景，极致暗色'
    },
    {
        id: 'element-dark',
        name: 'Space',
        description: '深灰背景，黄色高亮'
    },
    {
        id: 'matrix-green',
        name: 'Hacker',
        description: '黑客风格，荧光绿'
    }
];

export class ThemeManager {
    private currentTheme: string;
    private container: HTMLElement | null = null;
    private onThemeChange?: (themeId: string) => void;

    constructor(defaultTheme: string = 'default') {
        this.currentTheme = defaultTheme;
    }

    /**
     * 设置主题容器
     */
    setContainer(container: HTMLElement): void {
        this.container = container;
        this.applyTheme(this.currentTheme);
    }

    /**
     * 设置主题变化回调
     */
    setOnThemeChange(callback: (themeId: string) => void): void {
        this.onThemeChange = callback;
    }

    /**
     * 获取当前主题
     */
    getCurrentTheme(): string {
        return this.currentTheme;
    }

    /**
     * 应用主题
     */
    applyTheme(themeId: string): void {
        if (!this.container) {
            console.warn('[ThemeManager] Container not set');
            return;
        }

        // 移除所有主题类
        THEMES.forEach(theme => {
            this.container?.classList.remove(`workflowy-theme-${theme.id}`);
        });

        // 添加新主题类
        this.container.classList.add(`workflowy-theme-${themeId}`);
        this.currentTheme = themeId;


        // 触发回调
        if (this.onThemeChange) {
            this.onThemeChange(themeId);
        }
    }

    /**
     * 切换到下一个主题
     */
    nextTheme(): void {
        const currentIndex = THEMES.findIndex(t => t.id === this.currentTheme);
        const nextIndex = (currentIndex + 1) % THEMES.length;
        this.applyTheme(THEMES[nextIndex].id);
    }

    /**
     * 获取所有主题
     */
    getThemes(): Theme[] {
        return THEMES;
    }
}
