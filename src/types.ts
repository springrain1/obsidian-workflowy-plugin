// 块类型定义
export type BlockType =
    | 'list'          // 列表项（WorkFlowy 风格交互）
    | 'heading'       // 标题 (# - ######)
    | 'paragraph'     // 普通段落
    | 'code'          // 代码块
    | 'quote'         // 引用块
    | 'horizontal'    // 分割线
    | 'blank';        // 空行

export interface OutlineBlock {
    id: string;
    type: BlockType;                  // 块类型
    content: string;                  // 块内容
    children: OutlineBlock[];         // 子块（仅列表项支持）
    level: number;                    // 缩进层级
    collapsed: boolean;               // 是否折叠
    parent?: OutlineBlock;            // 父块引用

    // 列表项特有属性
    isTodo?: boolean;                 // 是否是待办事项
    todoCompleted?: boolean;          // 待办事项是否完成

    // 标题特有属性
    headingLevel?: number;            // 标题级别 1-6

    // 代码块特有属性
    codeLanguage?: string;            // 代码语言标识

    // 引用块特有属性
    quoteLevel?: number;              // 引用嵌套层级

    // 渲染控制
    editable?: boolean;               // 是否可编辑（默认 true）
    useObsidianRenderer?: boolean;    // 是否使用 Obsidian 渲染器
}

export interface BlockPosition {
    blockId: string;
    offset: number;
}

export interface WorkflowyState {
    blocks: OutlineBlock[];
    focusedBlockId: string | null;
    collapsedBlocks: Set<string>;
    selectedBlocks: Set<string>;
}

// 搜索模式
export type SearchMode = 'highlight' | 'filter';

export interface SearchState {
    query: string;
    mode: SearchMode;
    matchedBlockIds: Set<string>;
    visibleBlockIds: Set<string>;  // 在过滤模式下可见的节点（包括父节点）
}

export type WorkflowyOperation = 
    | 'createNewBlock'
    | 'deleteBlock'
    | 'indentBlock'
    | 'outdentBlock'
    | 'moveBlockUp'
    | 'moveBlockDown'
    | 'toggleCollapse'
    | 'navigateUp'
    | 'navigateDown'
    | 'navigateLeft'
    | 'navigateRight'
    | 'handleBackspace'
    | 'handleDelete'
    | 'undo'
    | 'redo'
    | 'toggleTodo';

export interface MarkdownParseResult {
    blocks: OutlineBlock[];
    metadata: {
        totalBlocks: number;
        maxLevel: number;
    };
}