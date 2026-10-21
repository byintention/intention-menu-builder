/**
 * Intention Menu Builder — Admin Next page.
 * Tag: window.__GRAV_PAGE_TAG → grav-intention-menu-builder--page
 */
const TAG = window.__GRAV_PAGE_TAG || 'grav-intention-menu-builder--page';
const ID_RE = /^[a-z][a-z0-9-]{0,62}$/;

function apiBase() {
    return (window.__GRAV_API_SERVER_URL || '') + (window.__GRAV_API_PREFIX || '/api/v1');
}

function apiHeaders(extra = {}) {
    const headers = { Accept: 'application/json', ...extra };
    const token = window.__GRAV_API_TOKEN;
    if (token) headers['X-API-Token'] = token;
    return headers;
}

async function api(path, options = {}) {
    const res = await fetch(apiBase() + path, {
        ...options,
        headers: apiHeaders(options.headers || {}),
    });
    if (res.status === 204) return null;
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
        const msg = json?.error?.detail || json?.error?.message || `Request failed (${res.status})`;
        throw new Error(msg);
    }
    return json.data;
}

function uid() {
    if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
    return 'i' + Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function emptyItem() {
    return {
        id: uid(),
        type: 'internal',
        page: '',
        url: '',
        title: '',
        classes: '',
        new_tab: false,
        children: [],
    };
}

function trashIcon() {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M3 6h18"></path>
        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
        <line x1="10" x2="10" y1="11" y2="17"></line>
        <line x1="14" x2="14" y1="11" y2="17"></line>
    </svg>`;
}

class IntentionMenuBuilderPage extends HTMLElement {
    constructor() {
        super();
        this._loading = true;
        this._saving = false;
        this._creating = false;
        this._error = '';
        this._status = '';
        this._menus = [];
        this._pages = [];
        this._menu = null;
        this._selectedId = null;
        this._dirty = false;
        this._showCreate = false;
        this._expanded = new Set();
        this._dragIndex = null;
        this._childDrag = null;
    }

    connectedCallback() {
        this._ensureStyles();
        this._boot();
    }

    _ensureStyles() {
        if (document.getElementById('imb-admin-css')) return;
        const link = document.createElement('link');
        link.id = 'imb-admin-css';
        link.rel = 'stylesheet';
        link.href = (window.__GRAV_API_SERVER_URL || '') + '/user/plugins/intention-menu-builder/assets/css/intention-menu-builder-admin.css';
        document.head.appendChild(link);
    }

    async _boot() {
        this._loading = true;
        this._error = '';
        this._render();
        try {
            const [menus, pages] = await Promise.all([
                api('/intention-menu-builder/menus'),
                api('/intention-menu-builder/pages'),
            ]);
            this._menus = Array.isArray(menus) ? menus : [];
            this._pages = Array.isArray(pages) ? pages : [];
            const first = this._menus[0]?.id;
            if (first) {
                await this._loadMenu(first, { skipConfirm: true });
            } else {
                this._loading = false;
                this._render();
            }
        } catch (err) {
            this._error = err.message || String(err);
            this._loading = false;
            this._render();
        }
    }

    async _loadMenu(id, { skipConfirm = false } = {}) {
        if (!skipConfirm && this._dirty) {
            const ok = await window.__GRAV_DIALOGS?.confirm({
                title: 'Unsaved changes?',
                message: 'Switching menus will discard unsaved changes to the current menu.',
                confirmLabel: 'Discard',
                variant: 'destructive',
            });
            if (!ok) return;
        }

        this._loading = true;
        this._error = '';
        this._status = '';
        this._render();
        try {
            const menu = await api(`/intention-menu-builder/menus/${encodeURIComponent(id)}`);
            this._menu = this._normalizeMenu(menu);
            this._selectedId = id;
            this._dirty = false;
            this._expanded = new Set();
        } catch (err) {
            this._error = err.message || String(err);
            this._menu = null;
            this._selectedId = null;
        } finally {
            this._loading = false;
            this._render();
        }
    }

    _normalizeMenu(menu) {
        const items = Array.isArray(menu?.items) ? menu.items.map((item) => this._normalizeItem(item, true)) : [];
        return {
            id: menu?.id || '',
            label: menu?.label || menu?.id || '',
            items,
        };
    }

    _normalizeItem(item, allowChildren) {
        return {
            id: item?.id || uid(),
            type: item?.type === 'external' ? 'external' : 'internal',
            page: item?.page || '',
            url: item?.url || '',
            title: item?.title || '',
            classes: item?.classes || '',
            new_tab: !!item?.new_tab,
            children: allowChildren && Array.isArray(item?.children)
                ? item.children.map((child) => this._normalizeItem(child, false))
                : [],
        };
    }

    _escape(s) {
        return String(s ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    _pageByRoute(route) {
        return this._pages.find((p) => p.route === route) || null;
    }

    _itemMissing(item) {
        return item.type === 'internal' && item.page && !this._pageByRoute(item.page);
    }

    _markDirty() {
        this._dirty = true;
        const save = this.querySelector('[data-action="save"]');
        if (save) save.disabled = this._saving;
        const dirty = this.querySelector('[data-dirty]');
        if (dirty) dirty.hidden = false;
    }

    async _save() {
        if (!this._menu || this._saving) return;
        this._saving = true;
        this._error = '';
        this._status = 'Saving…';
        this._render();
        try {
            const saved = await api(`/intention-menu-builder/menus/${encodeURIComponent(this._menu.id)}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    label: this._menu.label,
                    items: this._menu.items,
                }),
            });
            this._menu = this._normalizeMenu(saved);
            this._dirty = false;
            this._status = 'Saved.';
            this._menus = await api('/intention-menu-builder/menus');
        } catch (err) {
            this._error = err.message || String(err);
            this._status = '';
        } finally {
            this._saving = false;
            this._render();
        }
    }

    async _createMenu() {
        const idInput = this.querySelector('[data-create="id"]');
        const labelInput = this.querySelector('[data-create="label"]');
        const id = String(idInput?.value || '').trim().toLowerCase();
        const label = String(labelInput?.value || '').trim() || id;
        if (!ID_RE.test(id)) {
            this._error = 'Menu ID must start with a letter and use only lowercase letters, numbers, and hyphens.';
            this._render();
            return;
        }
        if (this._dirty) {
            const ok = await window.__GRAV_DIALOGS?.confirm({
                title: 'Unsaved changes?',
                message: 'Creating a menu will discard unsaved changes to the current menu.',
                confirmLabel: 'Discard',
                variant: 'destructive',
            });
            if (!ok) return;
        }
        this._creating = true;
        this._error = '';
        this._status = '';
        this._render();
        try {
            const menu = await api('/intention-menu-builder/menus', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, label, items: [] }),
            });
            this._menus = await api('/intention-menu-builder/menus');
            this._showCreate = false;
            this._menu = this._normalizeMenu(menu);
            this._selectedId = menu.id;
            this._dirty = false;
            this._expanded = new Set();
            this._status = 'Menu created.';
        } catch (err) {
            this._error = err.message || String(err);
        } finally {
            this._creating = false;
            this._render();
        }
    }

    async _deleteMenu() {
        if (!this._menu) return;
        const ok = await window.__GRAV_DIALOGS?.confirm({
            title: `Delete menu “${this._menu.id}”?`,
            message: 'Templates that call this ID will render an empty menu. This cannot be undone.',
            confirmLabel: 'Delete menu',
            variant: 'destructive',
        });
        if (!ok) return;
        try {
            await api(`/intention-menu-builder/menus/${encodeURIComponent(this._menu.id)}`, { method: 'DELETE' });
            this._menus = await api('/intention-menu-builder/menus');
            this._dirty = false;
            const next = this._menus[0]?.id;
            if (next) {
                await this._loadMenu(next, { skipConfirm: true });
            } else {
                this._menu = null;
                this._selectedId = null;
                this._render();
            }
        } catch (err) {
            this._error = err.message || String(err);
            this._render();
        }
    }

    _list(parentIndex) {
        if (parentIndex == null) return this._menu.items;
        return this._menu.items[parentIndex].children;
    }

    _moveItem(parentIndex, from, to) {
        const list = this._list(parentIndex);
        if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return;
        const [item] = list.splice(from, 1);
        list.splice(to, 0, item);
        this._dirty = true;
        this._render();
    }

    _addItem(parentIndex) {
        const item = emptyItem();
        if (parentIndex == null) {
            this._menu.items.push(item);
        } else {
            item.children = [];
            this._menu.items[parentIndex].children.push(item);
            const parent = this._menu.items[parentIndex];
            if (parent?.id) this._expanded.add(parent.id);
        }
        this._expanded.add(item.id);
        this._dirty = true;
        this._render();
    }

    _toggleExpanded(itemId) {
        if (!itemId) return;
        if (this._expanded.has(itemId)) {
            this._expanded.delete(itemId);
        } else {
            this._expanded.add(itemId);
        }
        this._render();
    }

    async _removeItem(parentIndex, index) {
        const list = this._list(parentIndex);
        const item = list[index];
        const ok = await window.__GRAV_DIALOGS?.confirm({
            title: 'Remove menu item?',
            message: item?.title ? `Remove “${item.title}” from this menu.` : 'Remove this item from the menu.',
            confirmLabel: 'Remove',
            variant: 'destructive',
        });
        if (!ok) return;
        list.splice(index, 1);
        this._dirty = true;
        this._render();
    }

    _nest(index) {
        if (index < 1) return;
        const items = this._menu.items;
        const item = items[index];
        if ((item.children || []).length) return;
        items.splice(index, 1);
        const parent = items[index - 1];
        parent.children = parent.children || [];
        parent.children.push(item);
        this._expanded.add(parent.id);
        this._dirty = true;
        this._render();
    }

    _unnest(parentIndex, childIndex) {
        const parent = this._menu.items[parentIndex];
        const [item] = parent.children.splice(childIndex, 1);
        item.children = [];
        this._menu.items.splice(parentIndex + 1, 0, item);
        this._dirty = true;
        this._render();
    }

    _setItemField(parentIndex, index, name, value, { render = false } = {}) {
        const item = this._list(parentIndex)[index];
        item[name] = value;
        if (name === 'type') {
            if (value === 'external') {
                item.page = '';
                item.new_tab = true;
            } else {
                item.url = '';
                item.new_tab = false;
            }
            this._dirty = true;
            this._render();
            return;
        }
        if (name === 'page') {
            const page = this._pageByRoute(value);
            if (page && !item.title) item.title = page.menu || page.title;
            this._dirty = true;
            this._render();
            return;
        }
        this._markDirty();
        if (render) this._render();
    }

    _pageOptions(selected) {
        const opts = [`<option value="">Choose a page…</option>`];
        for (const page of this._pages) {
            const label = `${page.menu || page.title} (${page.route})`;
            const sel = page.route === selected ? ' selected' : '';
            opts.push(`<option value="${this._escape(page.route)}"${sel}>${this._escape(label)}</option>`);
        }
        return opts.join('');
    }

    _itemSummary(item) {
        if (item.type === 'external') {
            return item.url || 'No URL';
        }
        return item.page || 'No page';
    }

    _renderItem(item, index, parentIndex) {
        const isChild = parentIndex != null;
        const missing = this._itemMissing(item);
        const expanded = this._expanded.has(item.id);
        const title = item.title || (item.type === 'internal' ? item.page : item.url) || `Item ${index + 1}`;
        const summary = this._itemSummary(item);
        const canNest = !isChild && index > 0 && !(item.children || []).length;
        const parentAttr = isChild ? `data-parent="${parentIndex}"` : '';
        const typeToggle = `
            <div class="imb-admin-field">
                <span class="imb-admin-label">Type</span>
                <div class="imb-admin-type">
                    <button type="button" class="imb-admin-btn ${item.type !== 'external' ? 'is-active' : ''}" data-action="type" data-type="internal" data-index="${index}" ${parentAttr}>Internal</button>
                    <button type="button" class="imb-admin-btn ${item.type === 'external' ? 'is-active' : ''}" data-action="type" data-type="external" data-index="${index}" ${parentAttr}>External</button>
                    <label class="imb-admin-check">
                        <input type="checkbox" data-action="field" data-name="new_tab" data-index="${index}" ${parentAttr} ${item.new_tab ? 'checked' : ''}>
                        Open in a new tab
                    </label>
                </div>
            </div>`;
        const target = item.type === 'internal'
            ? `<div class="imb-admin-field">
                    <label class="imb-admin-label">Page</label>
                    <input type="search" class="imb-admin-input" data-action="page-filter" placeholder="Filter pages…" ${parentAttr} data-index="${index}">
                    <select class="imb-admin-select" data-action="field" data-name="page" data-index="${index}" ${parentAttr}>${this._pageOptions(item.page)}</select>
                    ${missing ? '<span class="imb-admin-warn">This page is missing.</span>' : ''}
               </div>`
            : `<div class="imb-admin-field">
                    <label class="imb-admin-label">URL</label>
                    <input type="text" class="imb-admin-input" data-action="field" data-name="url" data-index="${index}" ${parentAttr} value="${this._escape(item.url)}" placeholder="https:// or /path">
               </div>`;

        const childrenHtml = !isChild
            ? `<div class="imb-admin-children" data-parent-list="${index}">
                    ${(item.children || []).map((child, ci) => this._renderItem(child, ci, index)).join('')}
                    <div class="imb-admin-list-foot">
                        <button type="button" class="imb-admin-btn" data-action="add-child" data-parent="${index}">Add child</button>
                    </div>
               </div>`
            : '';

        return `
            <div class="imb-admin-list-item${missing ? ' is-missing' : ''}${expanded ? ' is-open' : ''}" data-index="${index}" data-item-id="${this._escape(item.id)}" ${isChild ? `data-parent="${parentIndex}"` : 'data-top="1"'}>
                <div class="imb-admin-list-item-head">
                    <button type="button" class="imb-admin-list-drag" draggable="true" title="Drag to reorder" aria-label="Drag handle">⋮⋮</button>
                    <button type="button" class="imb-admin-item-toggle" data-action="toggle" data-item-id="${this._escape(item.id)}" aria-expanded="${expanded ? 'true' : 'false'}">
                        <span class="imb-admin-item-title">${this._escape(title)}</span>
                        <span class="imb-admin-item-summary">${this._escape(summary)}</span>
                    </button>
                    <span class="imb-admin-badge">${item.type === 'external' ? 'external' : 'internal'}</span>
                    ${canNest ? `<button type="button" class="imb-admin-btn" data-action="nest" data-index="${index}">Nest</button>` : ''}
                    ${isChild ? `<button type="button" class="imb-admin-btn" data-action="unnest" data-parent="${parentIndex}" data-index="${index}">Un-nest</button>` : ''}
                    <button type="button" class="imb-admin-icon-btn imb-admin-icon-btn-delete" data-action="remove" data-index="${index}" ${parentAttr} title="Remove" aria-label="Remove item">${trashIcon()}</button>
                </div>
                ${expanded ? `
                <div class="imb-admin-list-item-body">
                    <div class="imb-admin-row">
                        ${typeToggle}
                        ${target}
                    </div>
                    <div class="imb-admin-row">
                        <div class="imb-admin-field">
                            <label class="imb-admin-label">Display name</label>
                            <input type="text" class="imb-admin-input" data-action="field" data-name="title" data-index="${index}" ${parentAttr} value="${this._escape(item.title)}" placeholder="Menu label">
                        </div>
                        <div class="imb-admin-field">
                            <label class="imb-admin-label">Classes</label>
                            <input type="text" class="imb-admin-input" data-action="field" data-name="classes" data-index="${index}" ${parentAttr} value="${this._escape(item.classes)}" placeholder="extra-class">
                        </div>
                    </div>
                </div>
                ${childrenHtml}
                ` : ''}
            </div>
        `;
    }

    _render() {
        const menus = this._menus;
        const menu = this._menu;
        const sidebar = menus.length
            ? menus.map((m) => `
                <button type="button" class="imb-admin-menu-btn${m.id === this._selectedId ? ' is-active' : ''}" data-action="select" data-id="${this._escape(m.id)}">
                    <span class="imb-admin-menu-id">${this._escape(m.label || m.id)}</span>
                    <span class="imb-admin-menu-meta"><code>${this._escape(m.id)}</code> · ${m.item_count || 0} items</span>
                </button>
              `).join('')
            : '<p class="imb-admin-empty">No menus yet.</p>';

        const createHtml = this._showCreate
            ? `<div class="imb-admin-create">
                    <div class="imb-admin-create-row">
                        <div class="imb-admin-field">
                            <label class="imb-admin-label">ID</label>
                            <input type="text" class="imb-admin-input" data-create="id" placeholder="header" ${this._creating ? 'disabled' : ''}>
                        </div>
                        <div class="imb-admin-field">
                            <label class="imb-admin-label">Label</label>
                            <input type="text" class="imb-admin-input" data-create="label" placeholder="Header" ${this._creating ? 'disabled' : ''}>
                        </div>
                        <button type="button" class="imb-admin-btn imb-admin-btn-primary" data-action="create-save" ${this._creating ? 'disabled' : ''}>Create</button>
                        <button type="button" class="imb-admin-btn" data-action="create-cancel">Cancel</button>
                    </div>
                    <p class="imb-admin-help">ID is used in templates: <code class="imb-admin-code">{{ menu_render('id') }}</code></p>
               </div>`
            : '';

        let main = '<p class="imb-admin-empty">Select a menu, or create one.</p>';
        if (this._loading && !menu) {
            main = '<p class="imb-admin-empty">Loading…</p>';
        } else if (menu) {
            const itemsHtml = (menu.items || []).map((item, i) => this._renderItem(item, i, null)).join('');
            main = `
                <div class="imb-admin-meta">
                    <div class="imb-admin-field">
                        <span class="imb-admin-label">ID</span>
                        <input type="text" class="imb-admin-input" value="${this._escape(menu.id)}" disabled>
                        <span class="imb-admin-help">Used in Twig. Cannot be changed after create.</span>
                    </div>
                    <div class="imb-admin-field">
                        <label class="imb-admin-label">Label</label>
                        <input type="text" class="imb-admin-input" data-action="menu-label" value="${this._escape(menu.label)}">
                    </div>
                </div>
                <div class="imb-admin-list" data-top-list="1">
                    ${itemsHtml || '<p class="imb-admin-empty">No items yet.</p>'}
                </div>
                <div class="imb-admin-list-foot">
                    <button type="button" class="imb-admin-btn imb-admin-btn-primary" data-action="add">Add item</button>
                </div>
            `;
        }

        this.innerHTML = `
            <div class="imb-admin">
                <header class="imb-admin-head">
                    <div>
                        <h2 class="imb-admin-title">Menus</h2>
                        <p class="imb-admin-lede">Create named menus and insert them with <code class="imb-admin-code">{{ menu_render('header') }}</code>.</p>
                    </div>
                    <div class="imb-admin-actions">
                        <span data-dirty ${this._dirty ? '' : 'hidden'}>Unsaved</span>
                        <button type="button" class="imb-admin-btn" data-action="new">New menu</button>
                        <button type="button" class="imb-admin-btn imb-admin-btn-danger" data-action="delete-menu" ${!menu || this._loading ? 'disabled' : ''}>Delete</button>
                        <button type="button" class="imb-admin-btn imb-admin-btn-primary" data-action="save" ${!menu || this._saving ? 'disabled' : ''}>Save</button>
                    </div>
                </header>
                ${this._error ? `<div class="imb-admin-error" role="alert">${this._escape(this._error)}</div>` : ''}
                ${this._status ? `<div class="imb-admin-status">${this._escape(this._status)}</div>` : ''}
                <div class="imb-admin-layout">
                    <aside class="imb-admin-sidebar">
                        ${createHtml}
                        ${sidebar}
                    </aside>
                    <section class="imb-admin-main">
                        ${main}
                    </section>
                </div>
            </div>
        `;

        this._bind();
    }

    _bind() {
        this.querySelector('[data-action="new"]')?.addEventListener('click', () => {
            this._showCreate = true;
            this._error = '';
            this._render();
        });
        this.querySelector('[data-action="create-cancel"]')?.addEventListener('click', () => {
            this._showCreate = false;
            this._render();
        });
        this.querySelector('[data-action="create-save"]')?.addEventListener('click', () => this._createMenu());
        this.querySelector('[data-action="save"]')?.addEventListener('click', () => this._save());
        this.querySelector('[data-action="delete-menu"]')?.addEventListener('click', () => this._deleteMenu());

        this.querySelectorAll('[data-action="select"]').forEach((btn) => {
            btn.addEventListener('click', () => this._loadMenu(btn.dataset.id));
        });

        this.querySelector('[data-action="menu-label"]')?.addEventListener('input', (e) => {
            if (!this._menu) return;
            this._menu.label = e.target.value;
            this._markDirty();
        });

        this.querySelectorAll('[data-action="toggle"]').forEach((btn) => {
            btn.addEventListener('click', () => this._toggleExpanded(btn.dataset.itemId));
        });

        this.querySelector('[data-action="add"]')?.addEventListener('click', () => this._addItem(null));
        this.querySelectorAll('[data-action="add-child"]').forEach((btn) => {
            btn.addEventListener('click', () => this._addItem(parseInt(btn.dataset.parent, 10)));
        });
        this.querySelectorAll('[data-action="remove"]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const parent = btn.dataset.parent !== undefined ? parseInt(btn.dataset.parent, 10) : null;
                this._removeItem(parent, parseInt(btn.dataset.index, 10));
            });
        });
        this.querySelectorAll('[data-action="nest"]').forEach((btn) => {
            btn.addEventListener('click', () => this._nest(parseInt(btn.dataset.index, 10)));
        });
        this.querySelectorAll('[data-action="unnest"]').forEach((btn) => {
            btn.addEventListener('click', () => {
                this._unnest(parseInt(btn.dataset.parent, 10), parseInt(btn.dataset.index, 10));
            });
        });
        this.querySelectorAll('[data-action="type"]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const parent = btn.dataset.parent !== undefined ? parseInt(btn.dataset.parent, 10) : null;
                this._setItemField(parent, parseInt(btn.dataset.index, 10), 'type', btn.dataset.type);
            });
        });
        this.querySelectorAll('[data-action="field"]').forEach((el) => {
            const parent = el.dataset.parent !== undefined ? parseInt(el.dataset.parent, 10) : null;
            const index = parseInt(el.dataset.index, 10);
            const name = el.dataset.name;
            if (el.type === 'checkbox') {
                el.addEventListener('change', () => {
                    this._setItemField(parent, index, name, el.checked);
                });
                return;
            }
            if (el.tagName === 'SELECT') {
                el.addEventListener('change', () => {
                    this._setItemField(parent, index, name, el.value);
                });
                return;
            }
            el.addEventListener('input', () => {
                this._setItemField(parent, index, name, el.value);
            });
        });
        this.querySelectorAll('[data-action="page-filter"]').forEach((input) => {
            input.addEventListener('input', () => {
                const select = input.parentElement?.querySelector('select');
                if (!select) return;
                const q = input.value.toLowerCase();
                select.querySelectorAll('option').forEach((opt) => {
                    if (!opt.value) {
                        opt.hidden = false;
                        return;
                    }
                    opt.hidden = q !== '' && !opt.textContent.toLowerCase().includes(q);
                });
            });
        });

        this._bindDrag(this.querySelector('[data-top-list]'), null);
        this.querySelectorAll('[data-parent-list]').forEach((list) => {
            this._bindDrag(list, parseInt(list.dataset.parentList, 10));
        });
    }

    _bindDrag(root, parentIndex) {
        if (!root) return;
        const items = [...root.querySelectorAll(':scope > .imb-admin-list-item')];

        items.forEach((itemEl) => {
            const handle = itemEl.querySelector(':scope > .imb-admin-list-item-head > .imb-admin-list-drag');
            if (!handle) return;
            handle.addEventListener('dragstart', (e) => {
                e.stopPropagation();
                if (parentIndex == null) {
                    this._childDrag = null;
                    this._dragIndex = parseInt(itemEl.dataset.index, 10);
                } else {
                    this._dragIndex = null;
                    this._childDrag = {
                        parentIndex,
                        fromLi: parseInt(itemEl.dataset.index, 10),
                    };
                }
                itemEl.classList.add('is-dragging');
                e.dataTransfer.effectAllowed = 'move';
            });
            handle.addEventListener('dragend', () => {
                itemEl.classList.remove('is-dragging');
                this._dragIndex = null;
                this._childDrag = null;
            });

            itemEl.addEventListener('dragover', (e) => {
                if (parentIndex == null) {
                    if (this._childDrag || this._dragIndex === null) return;
                } else if (!this._childDrag || this._childDrag.parentIndex !== parentIndex) {
                    return;
                }
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = 'move';
            });
            itemEl.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const to = parseInt(itemEl.dataset.index, 10);
                if (parentIndex == null) {
                    if (this._dragIndex !== null && this._dragIndex !== to) {
                        this._moveItem(null, this._dragIndex, to);
                    }
                } else if (this._childDrag && this._childDrag.parentIndex === parentIndex && this._childDrag.fromLi !== to) {
                    this._moveItem(parentIndex, this._childDrag.fromLi, to);
                }
                this._dragIndex = null;
                this._childDrag = null;
            });
        });
    }
}

if (!customElements.get(TAG)) {
    customElements.define(TAG, IntentionMenuBuilderPage);
}
