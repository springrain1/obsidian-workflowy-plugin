import { OutlineBlock } from './types';

export function generateId(): string {
    return Math.random().toString(36).substr(2, 9);
}

export function getKeyCombo(event: KeyboardEvent): string {
    // 忽略单独的修饰键按下（Control、Shift、Alt、Meta）
    const modifierKeys = ['Control', 'Shift', 'Alt', 'Meta'];
    if (modifierKeys.includes(event.key)) {
        return ''; // 返回空字符串，不处理单独的修饰键
    }

    const parts: string[] = [];

    if (event.ctrlKey || event.metaKey) parts.push('Ctrl');
    if (event.altKey) parts.push('Alt');
    if (event.shiftKey) parts.push('Shift');

    // 使用 event.code 来处理特殊键（更可靠）
    const codeToKey: Record<string, string> = {
        'ArrowUp': 'ArrowUp',
        'ArrowDown': 'ArrowDown',
        'ArrowLeft': 'ArrowLeft',
        'ArrowRight': 'ArrowRight',
        'Enter': 'Enter',
        'NumpadEnter': 'Enter',
        'Tab': 'Tab',
        'Backspace': 'Backspace',
        'Delete': 'Delete'
    };

    // 处理特殊键 - 优先使用 event.code
    const specialKeys: Record<string, string> = {
        'ArrowUp': 'ArrowUp',
        'ArrowDown': 'ArrowDown',
        'ArrowLeft': 'ArrowLeft',
        'ArrowRight': 'ArrowRight',
        'Enter': 'Enter',
        'Tab': 'Tab',
        'Backspace': 'Backspace',
        'Delete': 'Delete'
    };

    // 优先使用 event.code 映射，如果没有则使用 event.key
    let key: string;
    if (codeToKey[event.code]) {
        key = codeToKey[event.code];
    } else if (specialKeys[event.key]) {
        key = specialKeys[event.key];
    } else {
        key = event.key.toUpperCase();
    }

    parts.push(key);

    return parts.join('+');
}

export function findBlockById(blocks: OutlineBlock[], id: string): OutlineBlock | null {
    for (const block of blocks) {
        if (block.id === id) return block;
        const found = findBlockById(block.children, id);
        if (found) return found;
    }
    return null;
}

export function findParentBlock(blocks: OutlineBlock[], childId: string): OutlineBlock | null {
    for (const block of blocks) {
        if (block.children.some(child => child.id === childId)) {
            return block;
        }
        const found = findParentBlock(block.children, childId);
        if (found) return found;
    }
    return null;
}

export function getAllBlocks(blocks: OutlineBlock[]): OutlineBlock[] {
    const result: OutlineBlock[] = [];
    
    function traverse(blockList: OutlineBlock[]) {
        for (const block of blockList) {
            result.push(block);
            traverse(block.children);
        }
    }
    
    traverse(blocks);
    return result;
}

export function getBlockDepth(block: OutlineBlock): number {
    let depth = 0;
    let current = block.parent;
    while (current) {
        depth++;
        current = current.parent;
    }
    return depth;
}

export function cloneBlock(block: OutlineBlock): OutlineBlock {
    return {
        id: generateId(),
        type: block.type || 'list', // 保持原有类型
        content: block.content,
        level: block.level,
        collapsed: false,
        children: block.children.map(cloneBlock),
        // 复制所有属性
        isTodo: block.isTodo,
        todoCompleted: block.todoCompleted,
        headingLevel: block.headingLevel,
        codeLanguage: block.codeLanguage,
        quoteLevel: block.quoteLevel,
        editable: block.editable,
        useObsidianRenderer: block.useObsidianRenderer
    };
}