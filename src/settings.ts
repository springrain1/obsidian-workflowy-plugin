/**
 * 插件设置定义
 */

export interface WorkflowyPluginSettings {
    // UI设置
    ui: {
        indentSize: number;
        showBullets: boolean;
        showCollapseIndicators: boolean;
        animationsEnabled: boolean;
        theme: string; // 主题ID
    };

    // 编辑器设置
    editor: {
        autoSave: boolean;
        autoSaveDelay: number;
        placeholder: string;
        renderMode: 'source' | 'live-preview';  // 渲染模式：源码模式或实时预览
    };

    // 搜索设置
    search: {
        mode: 'highlight' | 'filter';  // 搜索模式：高亮或过滤
        caseSensitive: boolean;         // 是否区分大小写
        autoExpandMatches: boolean;     // 自动展开匹配的折叠节点
    };

    // 拖拽设置
    dragDrop: {
        enabled: boolean;
        showDropIndicators: boolean;
        allowNestedDrop: boolean;
    };

    // 隔离系统设置
    isolation: {
        strictMode: boolean;
        enableAssertions: boolean;
        debugMode: boolean;
        healthCheckInterval: number;
    };
}

export const DEFAULT_SETTINGS: WorkflowyPluginSettings = {
    ui: {
        indentSize: 30,
        showBullets: true,
        showCollapseIndicators: true,
        animationsEnabled: false,
        theme: 'default' // 默认主题
    },

    editor: {
        autoSave: true,
        autoSaveDelay: 1000,
        placeholder: '输入内容...',
        renderMode: 'source'  // 默认源码模式（向后兼容）
    },

    search: {
        mode: 'highlight',           // 默认使用高亮模式
        caseSensitive: false,        // 默认不区分大小写
        autoExpandMatches: true      // 默认自动展开匹配节点
    },

    dragDrop: {
        enabled: true,
        showDropIndicators: true,
        allowNestedDrop: true
    },

    isolation: {
        strictMode: true,
        enableAssertions: true,
        debugMode: false,
        healthCheckInterval: 30000
    }
};
