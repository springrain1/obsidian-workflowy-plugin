import { Plugin, TFile, TAbstractFile, Menu, MarkdownView, WorkspaceLeaf, Platform } from 'obsidian';
import { WORKFLOWY_VIEW_TYPE } from './constants';
import { WorkflowyView } from './workflowy-view';
import {
    initializeIsolationSystem,
    cleanupIsolationSystem,
    ViewStateManager,
    IsolationLayer,
    CommandProxy,
    EventDelegator,
    RuntimeValidator,
    ViewType,
    performIsolationHealthCheck
} from './isolation';
import { WorkflowyPluginSettings, DEFAULT_SETTINGS } from './settings';
import { WorkflowySettingTab } from './settings-tab';

export default class WorkflowyPlugin extends Plugin {
    settings: WorkflowyPluginSettings;

    // 隔离系统组件
    private viewStateManager!: ViewStateManager;
    private isolationLayer!: IsolationLayer;
    private commandProxy!: CommandProxy;
    private eventDelegator!: EventDelegator;
    private runtimeValidator!: RuntimeValidator;

    // 平台信息
    private isMobile: boolean = false;
    private isDesktop: boolean = false;

    async onload() {
        // 检测平台
        this.detectPlatform();

        // 加载设置
        await this.loadSettings();

        // 初始化隔离系统
        this.initializeIsolation();

        // 注册自定义视图
        this.registerView(
            WORKFLOWY_VIEW_TYPE,
            (leaf) => new WorkflowyView(leaf, this)
        );

        // 注册命令（通过命令代理）
        this.registerCommands();

        // 注册事件监听器
        this.registerEventListeners();

        // 添加设置标签页
        this.addSettingTab(new WorkflowySettingTab(this.app, this));

        // 执行初始健康检查
        this.scheduleHealthChecks();
    }

    onunload() {
        // 执行最终健康检查
        const healthCheck = performIsolationHealthCheck();
        if (!healthCheck.healthy) {
            console.warn('[WorkflowyPlugin] Final health check failed:', healthCheck);
        }

        // 清理隔离系统
        cleanupIsolationSystem();
    }

    /**
     * 检测平台
     */
    private detectPlatform(): void {
        this.isMobile = Platform.isMobile;
        this.isDesktop = Platform.isDesktop;
    }

    /**
     * 初始化隔离系统
     */
    private initializeIsolation(): void {
        const isolationSystem = initializeIsolationSystem({
            strictMode: this.settings.isolation.strictMode,
            enableAssertions: this.settings.isolation.enableAssertions,
            debugMode: this.settings.isolation.debugMode
        });

        this.viewStateManager = isolationSystem.viewStateManager;
        this.isolationLayer = isolationSystem.isolationLayer;
        this.commandProxy = isolationSystem.commandProxy;
        this.eventDelegator = isolationSystem.eventDelegator;
        this.runtimeValidator = isolationSystem.runtimeValidator;
    }
    
    /**
     * 注册命令（通过命令代理）
     */
    private registerCommands(): void {
        // 注册统一的切换命令
        // 移动端不设置默认快捷键，避免冲突
        this.addCommand({
            id: 'toggle-view-mode',
            name: '切换大纲/Markdown视图',
            hotkeys: this.isMobile ? [] : [{ modifiers: ['Mod', 'Shift'], key: 'o' }],
            checkCallback: (checking: boolean) => {
                const activeLeaf = this.app.workspace.activeLeaf;
                const activeFile = this.app.workspace.getActiveFile();
                
                // 检查是否在 Workflowy 视图中
                const workflowyView = this.app.workspace.getActiveViewOfType(WorkflowyView);
                const isInWorkflowy = workflowyView && this.viewStateManager.isInWorkflowyView(activeLeaf);
                
                // 检查是否在 Markdown 视图中
                const isInMarkdown = activeFile && 
                    activeFile.extension === 'md' && 
                    this.viewStateManager.isInMarkdownView(activeLeaf);
                
                const canExecute = isInWorkflowy || isInMarkdown;

                if (checking) {
                    return canExecute || false;
                }

                if (canExecute) {
                    if (isInWorkflowy && workflowyView) {
                        // 从 Workflowy 切换到 Markdown
                        const file = workflowyView.getCurrentFile();
                        if (file) {
                            this.openAsMarkdown(file);
                        }
                    } else if (isInMarkdown && activeFile) {
                        // 从 Markdown 切换到 Workflowy
                        this.openAsWorkflowy(activeFile);
                    }
                }
                return true;
            }
        });

        // 保留原有的单独命令（用于右键菜单等）
        const openAsWorkflowyCmd = this.commandProxy.registerCommand({
            id: 'open-as-workflowy',
            name: '打开为大纲笔记',
            requiredViewType: ViewType.MARKDOWN,
            checkCallback: (checking: boolean) => {
                const activeFile = this.app.workspace.getActiveFile();
                const activeLeaf = this.app.workspace.activeLeaf;

                const canExecute = activeFile &&
                    activeFile.extension === 'md' &&
                    this.viewStateManager.isInMarkdownView(activeLeaf);

                if (checking) {
                    return canExecute || false;
                }

                if (canExecute) {
                    this.openAsWorkflowy(activeFile);
                }
                return true;
            }
        });

        this.addCommand(openAsWorkflowyCmd);

        const openAsMarkdownCmd = this.commandProxy.registerCommand({
            id: 'open-as-markdown',
            name: '打开为Markdown',
            requiredViewType: ViewType.WORKFLOWY,
            checkCallback: (checking: boolean) => {
                const activeView = this.app.workspace.getActiveViewOfType(WorkflowyView);
                const activeLeaf = this.app.workspace.activeLeaf;

                const canExecute = activeView &&
                    activeView.getCurrentFile() &&
                    this.viewStateManager.isInWorkflowyView(activeLeaf);

                if (checking) {
                    return canExecute || false;
                }

                if (canExecute && activeView) {
                    const file = activeView.getCurrentFile();
                    if (file) {
                        this.openAsMarkdown(file);
                    }
                }
                return true;
            }
        });

        this.addCommand(openAsMarkdownCmd);

        // 注册编辑器命令
        this.registerEditorCommands();
    }

    /**
     * 注册编辑器命令
     */
    private registerEditorCommands(): void {
        // 移动端不设置默认快捷键，用户可以通过命令面板访问
        const desktopHotkeys = !this.isMobile;

        // 增加缩进
        this.addCommand({
            id: 'workflowy-indent',
            name: 'Workflowy: 增加缩进',
            hotkeys: desktopHotkeys ? [{ modifiers: ['Mod'], key: ']' }] : [],
            checkCallback: (checking: boolean) => {
                const view = this.app.workspace.getActiveViewOfType(WorkflowyView);
                if (!view) return false;

                if (!checking) {
                    view.executeIndent();
                }
                return true;
            }
        });

        // 减少缩进
        this.addCommand({
            id: 'workflowy-outdent',
            name: 'Workflowy: 减少缩进',
            hotkeys: desktopHotkeys ? [{ modifiers: ['Mod'], key: '[' }] : [],
            checkCallback: (checking: boolean) => {
                const view = this.app.workspace.getActiveViewOfType(WorkflowyView);
                if (!view) return false;

                if (!checking) {
                    view.executeOutdent();
                }
                return true;
            }
        });

        // 向上移动块
        this.addCommand({
            id: 'workflowy-move-up',
            name: 'Workflowy: 向上移动块',
            hotkeys: desktopHotkeys ? [{ modifiers: ['Mod', 'Shift'], key: 'ArrowUp' }] : [],
            checkCallback: (checking: boolean) => {
                const view = this.app.workspace.getActiveViewOfType(WorkflowyView);
                if (!view) return false;

                if (!checking) {
                    view.executeMoveUp();
                }
                return true;
            }
        });

        // 向下移动块
        this.addCommand({
            id: 'workflowy-move-down',
            name: 'Workflowy: 向下移动块',
            hotkeys: desktopHotkeys ? [{ modifiers: ['Mod', 'Shift'], key: 'ArrowDown' }] : [],
            checkCallback: (checking: boolean) => {
                const view = this.app.workspace.getActiveViewOfType(WorkflowyView);
                if (!view) return false;

                if (!checking) {
                    view.executeMoveDown();
                }
                return true;
            }
        });

        // 折叠/展开块
        this.addCommand({
            id: 'workflowy-toggle-collapse',
            name: 'Workflowy: 折叠/展开块',
            hotkeys: desktopHotkeys ? [{ modifiers: ['Mod'], key: 'Enter' }] : [],
            checkCallback: (checking: boolean) => {
                const view = this.app.workspace.getActiveViewOfType(WorkflowyView);
                if (!view) return false;

                if (!checking) {
                    view.executeToggleCollapse();
                }
                return true;
            }
        });

        // 撤销
        this.addCommand({
            id: 'workflowy-undo',
            name: 'Workflowy: 撤销',
            hotkeys: desktopHotkeys ? [{ modifiers: ['Mod'], key: 'z' }] : [],
            checkCallback: (checking: boolean) => {
                const view = this.app.workspace.getActiveViewOfType(WorkflowyView);
                if (!view) return false;

                if (!checking) {
                    view.executeUndo();
                }
                return true;
            }
        });

        // 重做
        this.addCommand({
            id: 'workflowy-redo',
            name: 'Workflowy: 重做',
            hotkeys: desktopHotkeys ? [
                { modifiers: ['Mod', 'Shift'], key: 'z' },
                { modifiers: ['Mod'], key: 'y' }
            ] : [],
            checkCallback: (checking: boolean) => {
                const view = this.app.workspace.getActiveViewOfType(WorkflowyView);
                if (!view) return false;

                if (!checking) {
                    view.executeRedo();
                }
                return true;
            }
        });

        // 删除块
        this.addCommand({
            id: 'workflowy-delete-block',
            name: 'Workflowy: 删除当前块',
            hotkeys: desktopHotkeys ? [{ modifiers: ['Mod', 'Shift'], key: 'Backspace' }] : [],
            checkCallback: (checking: boolean) => {
                const view = this.app.workspace.getActiveViewOfType(WorkflowyView);
                if (!view) return false;

                if (!checking) {
                    view.executeDeleteBlock();
                }
                return true;
            }
        });

        // 全部折叠
        this.addCommand({
            id: 'workflowy-collapse-all',
            name: 'Workflowy: 折叠所有块',
            checkCallback: (checking: boolean) => {
                const view = this.app.workspace.getActiveViewOfType(WorkflowyView);
                if (!view) return false;

                if (!checking) {
                    view.collapseAll();
                }
                return true;
            }
        });

        // 全部展开
        this.addCommand({
            id: 'workflowy-expand-all',
            name: 'Workflowy: 展开所有块',
            checkCallback: (checking: boolean) => {
                const view = this.app.workspace.getActiveViewOfType(WorkflowyView);
                if (!view) return false;

                if (!checking) {
                    view.expandAll();
                }
                return true;
            }
        });
    }

    /**
     * 注册事件监听器
     */
    private registerEventListeners(): void {
        // 监听文件菜单事件
        this.registerEvent(
            this.app.workspace.on('file-menu', (menu, file) => {
                this.addFileMenuItems(menu, file);
            })
        );

        // 监听编辑器菜单事件
        this.registerEvent(
            this.app.workspace.on('editor-menu', (menu, editor, view) => {
                this.addEditorMenuItems(menu, view);
            })
        );
    }

    /**
     * 添加文件菜单项（带隔离检查）
     */
    private addFileMenuItems(menu: Menu, file: TAbstractFile): void {
        if (!(file instanceof TFile)) return;
        if (file.extension !== 'md') return;

        const activeLeaf = this.app.workspace.activeLeaf;
        if (!activeLeaf) return;

        // 使用隔离层检查是否应该显示菜单项
        if (this.isolationLayer.shouldShowMenuItem(activeLeaf, 'workflowy')) {
            menu.addItem((item) => {
                item.setTitle('打开为大纲笔记')
                    .setIcon('list-tree')
                    .onClick(() => {
                        this.openAsWorkflowy(file);
                    });
            });
        }

        if (this.isolationLayer.shouldShowMenuItem(activeLeaf, 'markdown')) {
            menu.addItem((item) => {
                item.setTitle('打开为Markdown')
                    .setIcon('edit')
                    .onClick(() => {
                        this.openAsMarkdown(file);
                    });
            });
        }
    }

    /**
     * 添加编辑器菜单项（带隔离检查）
     */
    private addEditorMenuItems(menu: Menu, view: any): void {
        // 只在 Workflowy 视图中添加编辑器菜单项
        if (view instanceof WorkflowyView) {
            const file = view.getCurrentFile();
            if (file) {
                menu.addItem((item) => {
                    item.setTitle('打开为Markdown')
                        .setIcon('edit')
                        .onClick(() => {
                            this.openAsMarkdown(file);
                        });
                });
            }
        }
        // 不在其他视图中添加任何菜单项，保持原生体验
    }
    
    /**
     * 打开文件为 Workflowy 视图（带验证）
     */
    async openAsWorkflowy(file: TFile): Promise<void> {
        const leaf = this.app.workspace.activeLeaf;
        if (!leaf) {
            console.error('[WorkflowyPlugin] No active leaf found');
            return;
        }

        // 验证当前是否在 Markdown 视图中
        if (!this.viewStateManager.isInMarkdownView(leaf)) {
            console.warn('[WorkflowyPlugin] Can only open as Workflowy from Markdown view');
            return;
        }

        await leaf.setViewState({
            type: WORKFLOWY_VIEW_TYPE,
            state: { file: file.path }
        });

        // 更新视图状态
        this.viewStateManager.updateViewState(leaf, {
            filePath: file.path,
            isActive: true
        });
    }

    /**
     * 打开文件为 Markdown 视图（带验证）
     */
    async openAsMarkdown(file: TFile): Promise<void> {
        const leaf = this.app.workspace.activeLeaf;
        if (!leaf) {
            console.error('[WorkflowyPlugin] No active leaf found');
            return;
        }

        // 验证当前是否在 Workflowy 视图中
        if (!this.viewStateManager.isInWorkflowyView(leaf)) {
            console.warn('[WorkflowyPlugin] Can only open as Markdown from Workflowy view');
            return;
        }

        await leaf.setViewState({
            type: 'markdown',
            state: {
                file: file.path,
                mode: 'source'
            }
        });

        // 更新视图状态
        this.viewStateManager.updateViewState(leaf, {
            filePath: file.path,
            isActive: true
        });
    }

    /**
     * 定期健康检查
     */
    private scheduleHealthChecks(): void {
        // 立即执行一次
        this.performHealthCheck();

        // 使用配置的间隔执行健康检查
        this.registerInterval(
            window.setInterval(() => {
                this.performHealthCheck();
            }, this.settings.isolation.healthCheckInterval)
        );
    }

    /**
     * 执行健康检查
     */
    private performHealthCheck(): void {
        const healthCheck = performIsolationHealthCheck();

        if (!healthCheck.healthy) {
            console.warn('[WorkflowyPlugin] Health check failed:', healthCheck.issues);
        }
    }

    /**
     * 加载设置
     */
    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    /**
     * 保存设置
     */
    async saveSettings() {
        await this.saveData(this.settings);
    }

    /**
     * 重置设置
     */
    async resetSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS);
        await this.saveSettings();
    }

    /**
     * 刷新所有 Workflowy 视图
     */
    refreshAllViews() {
        this.app.workspace.getLeavesOfType(WORKFLOWY_VIEW_TYPE).forEach(leaf => {
            const view = leaf.view;
            if (view instanceof WorkflowyView) {
                view.refresh();
            }
        });
    }
}