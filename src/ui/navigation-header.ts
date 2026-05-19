import { Breadcrumb } from '../features/zoom';
import { ThemeManager, THEMES } from '../features/theme-manager';

/**
 * 导航头部渲染器
 * 负责渲染面包屑导航、搜索框和主题切换按钮
 */
export class NavigationHeader {
    private headerElement: HTMLElement | null = null;
    private searchInput: HTMLInputElement | null = null;
    private searchClearButton: HTMLElement | null = null;
    private searchContainer: HTMLElement | null = null;
    private breadcrumbsContainer: HTMLElement | null = null;
    private themeButton: HTMLElement | null = null;
    private themeMenu: HTMLElement | null = null;
    private onBreadcrumbClick?: (blockId: string | null) => void;
    private onSearch?: (query: string) => void;
    private themeManager?: ThemeManager;

    /**
     * 创建导航头部DOM
     */
    create(container: HTMLElement): void {
        // 清除旧的头部
        if (this.headerElement) {
            this.headerElement.remove();
        }

        // 创建头部容器
        this.headerElement = container.createDiv('workflowy-navigation-header');

        // 创建面包屑容器
        this.breadcrumbsContainer = this.headerElement.createDiv('workflowy-breadcrumbs');

        // 创建搜索容器
        this.searchContainer = this.headerElement.createDiv('workflowy-search-container');

        // 创建搜索框
        this.searchInput = this.searchContainer.createEl('input', {
            type: 'text',
            placeholder: '搜索...',
            cls: 'workflowy-search'
        });

        // 创建清除按钮
        this.searchClearButton = this.searchContainer.createDiv('workflowy-search-clear');
        this.searchClearButton.innerHTML = `
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
        `;
        this.searchClearButton.style.display = 'none';  // 初始隐藏

        // 绑定搜索事件
        this.searchInput.oninput = (e) => {
            const query = (e.target as HTMLInputElement).value;
            
            // 根据输入内容显示/隐藏清除按钮
            if (this.searchClearButton) {
                this.searchClearButton.style.display = query ? 'flex' : 'none';
            }
            
            if (this.onSearch) {
                this.onSearch(query);
            }
        };

        // 绑定搜索框焦点事件
        this.searchInput.addEventListener('focus', () => {
            // 移除所有节点的焦点状态
            document.querySelectorAll('.workflowy-item.focused').forEach(el => {
                el.classList.remove('focused');
            });
        });

        // 绑定清除按钮事件
        this.searchClearButton.addEventListener('click', () => {
            if (this.searchInput) {
                this.searchInput.value = '';
                this.searchClearButton!.style.display = 'none';
                
                // 触发搜索清除
                if (this.onSearch) {
                    this.onSearch('');
                }
                
                // 聚焦回搜索框
                this.searchInput.focus();
            }
        });

        // 创建主题切换按钮
        this.createThemeButton();
    }

    /**
     * 创建主题切换按钮
     */
    private createThemeButton(): void {
        if (!this.headerElement) return;

        // 创建按钮
        this.themeButton = this.headerElement.createDiv('workflowy-theme-button');
        this.themeButton.innerHTML = `
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="7" height="7" rx="1"/>
                <rect x="14" y="3" width="7" height="7" rx="1"/>
                <rect x="14" y="14" width="7" height="7" rx="1"/>
                <rect x="3" y="14" width="7" height="7" rx="1"/>
            </svg>
        `;
        this.themeButton.setAttribute('aria-label', '切换主题');
        this.themeButton.setAttribute('title', '切换主题');

        // 创建主题菜单（初始隐藏）
        this.themeMenu = this.headerElement.createDiv('workflowy-theme-menu');
        this.themeMenu.style.display = 'none';

        // 渲染主题选项
        this.renderThemeOptions();

        // 绑定按钮点击事件
        this.themeButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleThemeMenu();
        });

        // 点击外部关闭菜单
        document.addEventListener('click', (e) => {
            if (this.themeMenu && 
                this.themeMenu.style.display !== 'none' &&
                !this.themeMenu.contains(e.target as Node) &&
                !this.themeButton?.contains(e.target as Node)) {
                this.hideThemeMenu();
            }
        });
    }

    /**
     * 渲染主题选项
     */
    private renderThemeOptions(): void {
        if (!this.themeMenu) return;

        this.themeMenu.empty();

        THEMES.forEach(theme => {
            const option = this.themeMenu!.createDiv('workflowy-theme-option');
            option.setAttribute('data-theme-id', theme.id);

            // 主题预览缩略图
            const preview = option.createDiv('workflowy-theme-preview');
            preview.classList.add(`workflowy-theme-${theme.id}`);
            
            // 添加示例内容
            preview.innerHTML = `
                <div class="theme-preview-content">
                    <div class="theme-preview-bullet"></div>
                    <div class="theme-preview-text">${theme.name}</div>
                </div>
            `;

            // 主题信息
            const info = option.createDiv('workflowy-theme-info');
            const name = info.createDiv('workflowy-theme-name');
            name.textContent = theme.name;
            const desc = info.createDiv('workflowy-theme-desc');
            desc.textContent = theme.description;

            // 当前主题标记
            if (this.themeManager && this.themeManager.getCurrentTheme() === theme.id) {
                option.classList.add('active');
            }

            // 点击切换主题
            option.addEventListener('click', () => {
                this.selectTheme(theme.id);
            });
        });
    }

    /**
     * 切换主题菜单显示/隐藏
     */
    private toggleThemeMenu(): void {
        if (!this.themeMenu) {
            console.warn('[NavigationHeader] Theme menu not found');
            return;
        }

        if (this.themeMenu.style.display === 'none') {
            this.showThemeMenu();
        } else {
            this.hideThemeMenu();
        }
    }

    /**
     * 显示主题菜单
     */
    private showThemeMenu(): void {
        if (!this.themeMenu) return;
        this.themeMenu.style.display = 'block';
    }

    /**
     * 隐藏主题菜单
     */
    private hideThemeMenu(): void {
        if (!this.themeMenu) return;
        this.themeMenu.style.display = 'none';
    }

    /**
     * 选择主题
     */
    private selectTheme(themeId: string): void {
        if (this.themeManager) {
            this.themeManager.applyTheme(themeId);
            
            // 更新菜单中的活动状态
            this.themeMenu?.querySelectorAll('.workflowy-theme-option').forEach(option => {
                if (option.getAttribute('data-theme-id') === themeId) {
                    option.classList.add('active');
                } else {
                    option.classList.remove('active');
                }
            });
        }
        
        this.hideThemeMenu();
    }

    /**
     * 设置主题管理器
     */
    setThemeManager(themeManager: ThemeManager): void {
        this.themeManager = themeManager;
        // 重新渲染主题选项以更新当前主题标记
        if (this.themeMenu) {
            this.renderThemeOptions();
        }
    }

    /**
     * 更新面包屑导航
     */
    updateBreadcrumbs(breadcrumbs: Breadcrumb[]): void {
        if (!this.breadcrumbsContainer) {
            console.warn('[NavigationHeader] Breadcrumbs container not initialized');
            return;
        }

        // 清空容器
        this.breadcrumbsContainer.empty();

        // 渲染面包屑
        for (let i = 0; i < breadcrumbs.length; i++) {
            // 添加分隔符（第一个之后）
            if (i > 0) {
                const delimiter = this.breadcrumbsContainer.createSpan('workflowy-breadcrumb-delimiter');
                delimiter.textContent = '›';
            }

            // 添加面包屑项
            const breadcrumb = breadcrumbs[i];
            const item = this.breadcrumbsContainer.createEl('a', {
                cls: 'workflowy-breadcrumb-item',
                attr: {
                    'data-block-id': breadcrumb.blockId || 'root'
                }
            });
            item.textContent = breadcrumb.title;

            // 绑定点击事件
            item.addEventListener('click', (e) => {
                e.preventDefault();
                if (this.onBreadcrumbClick) {
                    this.onBreadcrumbClick(breadcrumb.blockId);
                }
            });

            // 最后一项添加当前样式
            if (i === breadcrumbs.length - 1) {
                item.classList.add('current');
            }
        }
    }

    /**
     * 显示头部
     */
    show(): void {
        if (this.headerElement) {
            this.headerElement.style.display = '';
        }
    }

    /**
     * 隐藏头部
     */
    hide(): void {
        if (this.headerElement) {
            this.headerElement.style.display = 'none';
        }
    }

    /**
     * 显示搜索框
     */
    showSearch(): void {
        if (this.searchContainer) {
            this.searchContainer.style.display = '';
        }
        // 移除 zoom 模式类名
        if (this.headerElement) {
            this.headerElement.classList.remove('zoom-mode');
        }
    }

    /**
     * 隐藏搜索框
     */
    hideSearch(): void {
        if (this.searchContainer) {
            this.searchContainer.style.display = 'none';
        }
        // 添加 zoom 模式类名，让面包屑扩展
        if (this.headerElement) {
            this.headerElement.classList.add('zoom-mode');
        }
    }

    /**
     * 设置面包屑点击回调
     */
    setOnBreadcrumbClick(callback: (blockId: string | null) => void): void {
        this.onBreadcrumbClick = callback;
    }

    /**
     * 设置搜索回调
     */
    setOnSearch(callback: (query: string) => void): void {
        this.onSearch = callback;
    }

    /**
     * 获取搜索框的值
     */
    getSearchQuery(): string {
        return this.searchInput?.value || '';
    }

    /**
     * 清空搜索框
     */
    clearSearch(): void {
        if (this.searchInput) {
            this.searchInput.value = '';
            if (this.searchClearButton) {
                this.searchClearButton.style.display = 'none';
            }
        }
    }

    /**
     * 设置搜索框的值
     */
    setSearchQuery(query: string): void {
        if (this.searchInput) {
            this.searchInput.value = query;
            if (this.searchClearButton) {
                this.searchClearButton.style.display = query ? 'flex' : 'none';
            }
        }
    }

    /**
     * 销毁头部
     */
    destroy(): void {
        if (this.headerElement) {
            this.headerElement.remove();
            this.headerElement = null;
        }
        this.searchInput = null;
        this.breadcrumbsContainer = null;
    }
}
