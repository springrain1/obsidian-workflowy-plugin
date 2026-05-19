import { App, PluginSettingTab, Setting } from 'obsidian';
import WorkflowyPlugin from './main';
import { WorkflowyPluginSettings } from './settings';

export class WorkflowySettingTab extends PluginSettingTab {
    plugin: WorkflowyPlugin;

    constructor(app: App, plugin: WorkflowyPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h1', { text: 'Workflowy插件设置' });

        // ==================== 快捷键提示 ====================
        containerEl.createEl('h2', { text: '快捷键设置' });

        const hotkeyInfo = containerEl.createEl('div', {
            cls: 'setting-item-description',
        });
        hotkeyInfo.createEl('p', {
            text: '快捷键可以在 Obsidian 的"设置 > 快捷键"中配置。'
        });
        hotkeyInfo.createEl('p', {
            text: '搜索"Workflowy"即可找到所有可用的快捷键命令。'
        });

        const openHotkeysButton = new Setting(containerEl)
            .setName('打开快捷键设置')
            .setDesc('跳转到Obsidian的快捷键设置页面')
            .addButton(button => button
                .setButtonText('打开快捷键设置')
                .setCta()
                .onClick(() => {
                    // @ts-ignore - 访问Obsidian内部API
                    (this.app as any).setting.open();
                    // @ts-ignore
                    (this.app as any).setting.openTabById('hotkeys');
                }));

        // ==================== UI设置 ====================
        containerEl.createEl('h2', { text: 'UI设置' });

        new Setting(containerEl)
            .setName('缩进大小')
            .setDesc('每级缩进的像素大小（默认：30px）')
            .addSlider(slider => slider
                .setLimits(10, 60, 5)
                .setValue(this.plugin.settings.ui.indentSize)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.ui.indentSize = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('显示圆点标记')
            .setDesc('在每个块前显示圆点标记')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.ui.showBullets)
                .onChange(async (value) => {
                    this.plugin.settings.ui.showBullets = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('显示折叠指示器')
            .setDesc('在有子块的块前显示折叠/展开指示器')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.ui.showCollapseIndicators)
                .onChange(async (value) => {
                    this.plugin.settings.ui.showCollapseIndicators = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('启用动画')
            .setDesc('启用界面动画效果（可能影响性能）')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.ui.animationsEnabled)
                .onChange(async (value) => {
                    this.plugin.settings.ui.animationsEnabled = value;
                    await this.plugin.saveSettings();
                }));

        // ==================== 编辑器设置 ====================
        containerEl.createEl('h2', { text: '编辑器设置' });

        new Setting(containerEl)
            .setName('自动保存')
            .setDesc('编辑时自动保存更改')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.editor.autoSave)
                .onChange(async (value) => {
                    this.plugin.settings.editor.autoSave = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('自动保存延迟')
            .setDesc('自动保存的延迟时间（毫秒）')
            .addSlider(slider => slider
                .setLimits(500, 5000, 500)
                .setValue(this.plugin.settings.editor.autoSaveDelay)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.editor.autoSaveDelay = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('占位符文本')
            .setDesc('空块显示的占位符文本')
            .addText(text => text
                .setPlaceholder('输入内容...')
                .setValue(this.plugin.settings.editor.placeholder)
                .onChange(async (value) => {
                    this.plugin.settings.editor.placeholder = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('渲染模式')
            .setDesc('选择块内容的显示方式')
            .addDropdown(dropdown => dropdown
                .addOption('source', '源码模式 - 显示原始 Markdown 语法（当前默认）')
                .addOption('live-preview', 'Live Preview - 编辑时显示源码，非编辑时显示渲染效果')
                .setValue(this.plugin.settings.editor.renderMode)
                .onChange(async (value: 'source' | 'live-preview') => {
                    this.plugin.settings.editor.renderMode = value;
                    await this.plugin.saveSettings();
                    // 刷新所有 Workflowy 视图
                    this.plugin.refreshAllViews();
                }));

        // ==================== 搜索设置 ====================
        containerEl.createEl('h2', { text: '搜索设置' });

        new Setting(containerEl)
            .setName('搜索模式')
            .setDesc('选择搜索时的显示方式')
            .addDropdown(dropdown => dropdown
                .addOption('highlight', '显示高亮 - 高亮匹配的节点，显示所有内容')
                .addOption('filter', '过滤节点 - 只显示匹配的节点及其父节点')
                .setValue(this.plugin.settings.search.mode)
                .onChange(async (value: 'highlight' | 'filter') => {
                    this.plugin.settings.search.mode = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('区分大小写')
            .setDesc('搜索时是否区分大小写')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.search.caseSensitive)
                .onChange(async (value) => {
                    this.plugin.settings.search.caseSensitive = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('自动展开匹配节点')
            .setDesc('搜索时自动展开包含匹配内容的折叠节点')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.search.autoExpandMatches)
                .onChange(async (value) => {
                    this.plugin.settings.search.autoExpandMatches = value;
                    await this.plugin.saveSettings();
                }));

        // ==================== 拖拽设置 ====================
        containerEl.createEl('h2', { text: '拖拽设置' });

        new Setting(containerEl)
            .setName('启用拖拽')
            .setDesc('允许通过拖拽重新排列块')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.dragDrop.enabled)
                .onChange(async (value) => {
                    this.plugin.settings.dragDrop.enabled = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('显示放置指示器')
            .setDesc('拖拽时显示放置位置的视觉指示器')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.dragDrop.showDropIndicators)
                .onChange(async (value) => {
                    this.plugin.settings.dragDrop.showDropIndicators = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('允许嵌套放置')
            .setDesc('允许将块放置为其他块的子块')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.dragDrop.allowNestedDrop)
                .onChange(async (value) => {
                    this.plugin.settings.dragDrop.allowNestedDrop = value;
                    await this.plugin.saveSettings();
                }));

        // ==================== 高级设置 ====================
        containerEl.createEl('h2', { text: '高级设置' });

        new Setting(containerEl)
            .setName('严格模式')
            .setDesc('启用严格的功能隔离（推荐）')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.isolation.strictMode)
                .onChange(async (value) => {
                    this.plugin.settings.isolation.strictMode = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('启用断言')
            .setDesc('启用运行时断言检查（用于调试）')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.isolation.enableAssertions)
                .onChange(async (value) => {
                    this.plugin.settings.isolation.enableAssertions = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('调试模式')
            .setDesc('启用调试日志（可能产生大量日志）')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.isolation.debugMode)
                .onChange(async (value) => {
                    this.plugin.settings.isolation.debugMode = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('健康检查间隔')
            .setDesc('系统健康检查的间隔时间（毫秒）')
            .addSlider(slider => slider
                .setLimits(10000, 120000, 10000)
                .setValue(this.plugin.settings.isolation.healthCheckInterval)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.isolation.healthCheckInterval = value;
                    await this.plugin.saveSettings();
                }));

        // ==================== 重置按钮 ====================
        new Setting(containerEl)
            .setName('重置所有设置')
            .setDesc('将所有设置恢复为默认值')
            .addButton(button => button
                .setButtonText('重置')
                .setWarning()
                .onClick(async () => {
                    if (confirm('确定要重置所有设置吗？此操作不可撤销。')) {
                        await this.plugin.resetSettings();
                        this.display(); // 重新显示设置页面
                    }
                }));
    }
}
