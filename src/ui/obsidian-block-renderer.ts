import { App, Component, MarkdownRenderer } from 'obsidian';
import { OutlineBlock } from '../types';

/**
 * 使用 Obsidian 原生渲染器渲染块内容
 * 完全复用 Obsidian 的 Live Preview 和编辑体验
 */
export class ObsidianBlockRenderer extends Component {
    private app: App;
    private block: OutlineBlock;
    private containerEl: HTMLElement;
    private sourcePath: string;
    private onContentChange: (newContent: string) => void;
    private contentEl: HTMLElement | null = null;

    constructor(
        app: App,
        block: OutlineBlock,
        containerEl: HTMLElement,
        sourcePath: string,
        onContentChange: (newContent: string) => void
    ) {
        super();
        this.app = app;
        this.block = block;
        this.containerEl = containerEl;
        this.sourcePath = sourcePath;
        this.onContentChange = onContentChange;
    }

    /**
     * 渲染块内容
     */
    async render(): Promise<void> {
        this.containerEl.empty();
        this.containerEl.addClass('obsidian-block-renderer');
        this.containerEl.setAttribute('data-block-type', this.block.type);
        this.containerEl.setAttribute('data-block-id', this.block.id);

        switch (this.block.type) {
            case 'heading':
                await this.renderHeading();
                break;
            case 'code':
                await this.renderCode();
                break;
            case 'paragraph':
                await this.renderParagraph();
                break;
            case 'quote':
                await this.renderQuote();
                break;
            case 'horizontal':
                this.renderHorizontalRule();
                break;
            default:
                console.warn(`未知块类型: ${this.block.type}`);
        }
    }

    /**
     * 渲染标题
     */
    private async renderHeading(): Promise<void> {
        const level = this.block.headingLevel || 1;
        const markdown = `${'#'.repeat(level)} ${this.block.content}`;

        const wrapper = this.containerEl.createDiv({
            cls: `obsidian-heading obsidian-heading-${level}`
        });

        // 使用 Obsidian 的 MarkdownRenderer 渲染
        await MarkdownRenderer.render(
            this.app,
            markdown,
            wrapper,
            this.sourcePath,
            this
        );

        // 标题设为只读，避免格式丢失
        wrapper.addClass('obsidian-readonly');
        wrapper.setAttribute('title', '请在 Markdown 视图中编辑标题');
        
        const readonlyBadge = wrapper.createDiv({
            cls: 'obsidian-readonly-badge',
            text: '只读'
        });

        // 启用链接点击
        this.enableLinkClicks(wrapper);
    }

    /**
     * 渲染代码块
     */
    private async renderCode(): Promise<void> {
        const language = this.block.codeLanguage || '';
        const markdown = '```' + language + '\n' + this.block.content + '\n```';

        const wrapper = this.containerEl.createDiv({
            cls: 'obsidian-code-block'
        });

        // 使用 Obsidian 的 MarkdownRenderer 渲染（支持语法高亮）
        await MarkdownRenderer.render(
            this.app,
            markdown,
            wrapper,
            this.sourcePath,
            this
        );

        // 代码块设为只读
        wrapper.addClass('obsidian-readonly');
        wrapper.setAttribute('title', '请在 Markdown 视图中编辑代码');
        
        const readonlyBadge = wrapper.createDiv({
            cls: 'obsidian-readonly-badge',
            text: '只读'
        });
    }

    /**
     * 渲染段落
     */
    private async renderParagraph(): Promise<void> {
        const wrapper = this.containerEl.createDiv({
            cls: 'obsidian-paragraph'
        });

        // 使用 Obsidian 的 MarkdownRenderer 渲染
        await MarkdownRenderer.render(
            this.app,
            this.block.content,
            wrapper,
            this.sourcePath,
            this
        );

        // 所有非列表内容都设为只读，避免格式丢失
        // 用户需要在 Markdown 视图中编辑这些内容
        wrapper.addClass('obsidian-readonly');
        wrapper.setAttribute('title', '请在 Markdown 视图中编辑此内容以保留格式');
        
        // 添加只读标识
        const readonlyBadge = wrapper.createDiv({
            cls: 'obsidian-readonly-badge',
            text: '只读'
        });

        // 启用链接点击
        this.enableLinkClicks(wrapper);
    }

    /**
     * 启用 Obsidian 链接的点击功能
     */
    private enableLinkClicks(container: HTMLElement): void {
        // 处理所有链接点击
        this.registerDomEvent(container, 'click', async (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            
            // 查找最近的链接元素
            const link = target.closest('a');
            if (!link) return;

            // 内部链接 [[link]]
            if (link.classList.contains('internal-link')) {
                e.preventDefault();
                e.stopPropagation();
                
                const href = link.getAttribute('data-href');
                
                if (href) {
                    // 获取目标文件
                    const file = this.app.metadataCache.getFirstLinkpathDest(href, this.sourcePath);
                    
                    if (file) {
                        const leaf = this.app.workspace.activeLeaf;
                        
                        if (leaf) {
                            const currentViewType = leaf.view.getViewType();
                            
                            // 使用 setViewState 而不是 openFile，明确指定视图类型
                            // 这样可以确保导航历史正确记录视图类型
                            await leaf.setViewState({
                                type: currentViewType,  // 保持当前视图类型
                                state: {
                                    file: file.path
                                }
                            });
                        } else {
                            this.app.workspace.openLinkText(href, this.sourcePath, false);
                        }
                    } else {
                        this.app.workspace.openLinkText(href, this.sourcePath, false);
                    }
                }
                return;
            }

            // 标签 #tag
            if (link.classList.contains('tag')) {
                e.preventDefault();
                e.stopPropagation();
                
                const tagName = link.getAttribute('href');
                if (tagName) {
                    // 打开标签搜索
                    const searchPlugin = (this.app as any).internalPlugins?.getPluginById?.('global-search');
                    if (searchPlugin?.instance) {
                        searchPlugin.instance.openGlobalSearch(`tag:${tagName.replace('#', '')}`);
                    }
                }
                return;
            }

            // 外部链接 - 允许默认行为
            if (link.classList.contains('external-link')) {
                e.stopPropagation();
                // 不阻止默认行为，让浏览器打开链接
                return;
            }
        }, true); // 使用捕获阶段
    }



    /**
     * 渲染引用块
     */
    private async renderQuote(): Promise<void> {
        const level = this.block.quoteLevel || 1;
        const markdown = '>'.repeat(level) + ' ' + this.block.content;

        const wrapper = this.containerEl.createDiv({
            cls: 'obsidian-quote'
        });

        // 使用 Obsidian 的 MarkdownRenderer 渲染
        await MarkdownRenderer.render(
            this.app,
            markdown,
            wrapper,
            this.sourcePath,
            this
        );

        // 引用设为只读，避免格式丢失
        wrapper.addClass('obsidian-readonly');
        wrapper.setAttribute('title', '请在 Markdown 视图中编辑引用');
        
        const readonlyBadge = wrapper.createDiv({
            cls: 'obsidian-readonly-badge',
            text: '只读'
        });

        // 启用链接点击
        this.enableLinkClicks(wrapper);
    }

    /**
     * 渲染分割线
     */
    private renderHorizontalRule(): void {
        const hr = this.containerEl.createEl('hr', {
            cls: 'obsidian-horizontal-rule'
        });
    }



    /**
     * 更新块内容
     */
    async updateContent(newContent: string): Promise<void> {
        this.block.content = newContent;
        await this.render();
    }

    /**
     * 清理资源
     */
    onunload(): void {
        if (this.contentEl) {
            this.contentEl.empty();
        }
    }
}
