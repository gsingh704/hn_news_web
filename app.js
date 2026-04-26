const state = {
    currentType: 'front',
    currentPage: 0,
    searchQuery: '',
    sortBy: 'relevance',
    timeRange: 'all',
    storyIds: [],
    storiesPerPage: 30,
    activeStory: null,
    activeStoryId: null
};

const elements = {
    modeSelect: document.getElementById('modeSelect'),
    themeBtn: document.getElementById('themeBtn'),
    toggleSearchBtn: document.getElementById('toggleSearchBtn'),
    searchPanel: document.getElementById('searchPanel'),
    searchBtn: document.getElementById('searchBtn'),
    searchInput: document.getElementById('searchInput'),
    sortSelect: document.getElementById('sortSelect'),
    timeSelect: document.getElementById('timeSelect'),
    storiesList: document.getElementById('storiesList'),
    pageIndicator: document.getElementById('pageIndicator'),
    prevPageBtn: document.getElementById('prevPageBtn'),
    nextPageBtn: document.getElementById('nextPageBtn'),
    commentsPanel: document.getElementById('commentsPanel'),
    commentsScrollArea: document.querySelector('.comments-scroll-area'),
    commentsTitle: document.getElementById('commentsTitle'),
    commentsUrl: document.getElementById('commentsUrl'),
    commentsMeta: document.getElementById('commentsMeta'),
    commentsStats: document.getElementById('commentsStats'),
    commentsContent: document.getElementById('commentsContent'),
    closeCommentsBtn: document.getElementById('closeCommentsBtn'),
    filtersRow: document.getElementById('filtersRow'),
    commentNav: document.getElementById('commentNav'),
    prevCommentBtn: document.getElementById('prevCommentBtn'),
    nextCommentBtn: document.getElementById('nextCommentBtn')
};

async function init() {
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('resize', updateResponsiveView);
    setupResizer();
    setupTheme();

    elements.modeSelect.addEventListener('change', (e) => changeType(e.target.value));

    elements.toggleSearchBtn.addEventListener('click', () => {
        const isHidden = elements.searchPanel.style.display === 'none';
        elements.searchPanel.style.display = isHidden ? 'block' : 'none';
        elements.toggleSearchBtn.classList.toggle('active', !isHidden || state.currentType === 'search');
        if (isHidden) elements.searchInput.focus();
    });

    elements.searchBtn.addEventListener('click', startSearch);
    elements.searchInput.addEventListener('keydown', event => {
        if (event.key === 'Enter') startSearch();
    });
    elements.sortSelect.addEventListener('change', event => {
        state.sortBy = event.target.value;
        if (state.currentType === 'search') {
            state.currentPage = 0;
            reloadStories();
            syncUrl();
        }
    });
    elements.timeSelect.addEventListener('change', event => {
        state.timeRange = event.target.value;
        if (state.currentType === 'search') {
            state.currentPage = 0;
            reloadStories();
            syncUrl();
        }
    });
    elements.prevPageBtn.addEventListener('click', () => changePage(-1));
    elements.nextPageBtn.addEventListener('click', () => changePage(1));
    elements.closeCommentsBtn.addEventListener('click', closeCommentsPanel);

    if (elements.prevCommentBtn && elements.nextCommentBtn) {
        elements.prevCommentBtn.addEventListener('click', () => scrollToAdjacentTopLevelComment(-1));
        elements.nextCommentBtn.addEventListener('click', () => scrollToAdjacentTopLevelComment(1));
    }

    if (elements.commentsScrollArea) {
        let raf = null;
        const debouncedUpdateCommentNavUi = debounce(() => {
            if (raf) cancelAnimationFrame(raf);
            raf = requestAnimationFrame(updateCommentNavUi);
        }, 100); // Debounce by 100ms
        elements.commentsScrollArea.addEventListener('scroll', debouncedUpdateCommentNavUi, { passive: true });
    }

    // Utility function for debouncing
    function debounce(func, delay) {
        let timeout;
        return function(...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), delay);
        };
    }

    parseStateFromUrl();
    applyStateToUi();
    await reloadStories(true);
    updateResponsiveView();
    updateCommentNavUi();
}

function getPathSegments(pathname) {
    const raw = (pathname || '').split('/').filter(Boolean);
    if (raw.length > 0 && raw[raw.length - 1].toLowerCase() === 'index.html') {
        raw.pop();
    }
    return raw;
}

function getBaseSegments(pathname) {
    const segments = getPathSegments(pathname);
    if (segments.length === 0) return [];

    const last = segments[segments.length - 1];
    const secondLast = segments[segments.length - 2];

    if (last === 'new' || last === 'search') {
        return segments.slice(0, -1);
    }

    if (last === 'top') {
        return segments.slice(0, -1);
    }

    if (secondLast === 'top' && ['w', 'm', 'y', 'all'].includes(last)) {
        return segments.slice(0, -2);
    }

    return segments;
}

function parseTypeFromPathname(pathname) {
    const segments = getPathSegments(pathname);
    const last = segments[segments.length - 1];
    const secondLast = segments[segments.length - 2];

    if (last === 'new') return 'new';
    if (last === 'search') return 'search';

    if (last === 'top') return 'top_d';
    if (secondLast === 'top') {
        if (last === 'w') return 'top_w';
        if (last === 'm') return 'top_m';
        if (last === 'y') return 'top_y';
        if (last === 'all') return 'top_all';
    }

    return 'front';
}

function buildPathForType(type) {
    if (type === 'new') return ['new'];
    if (type === 'search') return ['search'];
    if (type === 'top_d') return ['top'];
    if (type === 'top_w') return ['top', 'w'];
    if (type === 'top_m') return ['top', 'm'];
    if (type === 'top_y') return ['top', 'y'];
    if (type === 'top_all') return ['top', 'all'];
    return [];
}

const themes = ['system', 'light', 'dark'];
let currentThemeIndex = 0;

function setupTheme() {
    const savedTheme = localStorage.getItem('hn-theme') || 'system';
    currentThemeIndex = themes.indexOf(savedTheme) > -1 ? themes.indexOf(savedTheme) : 0;
    applyTheme(themes[currentThemeIndex]);

    elements.themeBtn.addEventListener('click', () => {
        currentThemeIndex = (currentThemeIndex + 1) % themes.length;
        const theme = themes[currentThemeIndex];
        localStorage.setItem('hn-theme', theme);
        applyTheme(theme);
    });

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (themes[currentThemeIndex] === 'system') applyTheme('system');
    });
}

function applyTheme(theme) {
    if (theme === 'system') {
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
        elements.themeBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>';
        elements.themeBtn.title = 'Theme: System';
    } else if (theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        elements.themeBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';
        elements.themeBtn.title = 'Theme: Dark';
    } else {
        document.documentElement.setAttribute('data-theme', 'light');
        elements.themeBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="17.36" y1="17.36" x2="18.78" y2="18.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="17.36" y1="5.64" x2="18.78" y2="4.22"></line></svg>';
        elements.themeBtn.title = 'Theme: Light';
    }
}

function setupResizer() {
    const resizer = document.getElementById('resizer');
    const storiesPanel = document.querySelector('.stories-panel');
    const mainGrid = document.querySelector('.main-grid');

    if (!resizer || !storiesPanel || !mainGrid) return;

    let isResizing = false;

    resizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        resizer.classList.add('active');
    });

    window.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        const containerRect = mainGrid.getBoundingClientRect();
        // Calculate width relative to the container
        let newWidth = e.clientX - containerRect.left;
        
        const minWidth = 250;
        const maxWidth = containerRect.width - 300; // Leave space for comments
        
        if (newWidth < minWidth) newWidth = minWidth;
        if (newWidth > maxWidth) newWidth = maxWidth;

        storiesPanel.style.flexBasis = `${newWidth}px`;
        storiesPanel.style.width = `${newWidth}px`;
        storiesPanel.style.flexGrow = '0';
    });

    window.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            resizer.classList.remove('active');
        }
    });
}

function parseStateFromUrl() {
    const params = new URLSearchParams(window.location.search);

    const typeParam = params.get('type');
    const validTypes = ['front', 'new', 'search', 'top_d', 'top_w', 'top_m', 'top_y', 'top_all'];
    const typeFromPath = parseTypeFromPathname(window.location.pathname);
    state.currentType = validTypes.includes(typeParam) ? typeParam : typeFromPath;

    const page = parseInt(params.get('page') || '0', 10);
    state.currentPage = Number.isFinite(page) && page >= 0 ? page : 0;

    state.searchQuery = params.get('q') || '';
    state.sortBy = params.get('sort') === 'date' ? 'date' : 'relevance';
    const time = params.get('time');
    state.timeRange = ['all', 'past_24h', 'past_week', 'past_month', 'past_year'].includes(time) ? time : 'all';

    const storyId = Number(params.get('story'));
    state.activeStoryId = Number.isFinite(storyId) && storyId > 0 ? storyId : null;

    if (state.currentType === 'search' && !state.searchQuery) {
        state.currentType = 'front';
    }
}

function applyStateToUi() {
    setActiveButton(state.currentType);
    elements.modeSelect.value = state.currentType;
    
    elements.searchInput.value = state.searchQuery;
    elements.sortSelect.value = state.sortBy;
    elements.timeSelect.value = state.timeRange;
    // Show/hide search filters and panel based on currentType
    if (elements.filtersRow) {
        elements.filtersRow.style.display = state.currentType === 'search' ? 'grid' : 'none';
        elements.searchPanel.style.display = state.currentType === 'search' ? 'block' : 'none';
        elements.toggleSearchBtn.classList.toggle('active', state.currentType === 'search');
    }
    
    elements.commentsPanel.style.display = state.activeStoryId ? 'flex' : 'none';
    updateResponsiveView();
}

function isCompactScreen() {
    return window.innerWidth <= 980;
}

function updateResponsiveView() {
    const isCompact = isCompactScreen();
    const toolbar = document.querySelector('.sidebar-toolbar');
    
    if (state.activeStoryId && isCompact) {
        document.body.classList.add('compact-comments');
        if (toolbar && toolbar.parentElement !== elements.commentsPanel) {
            elements.commentsPanel.insertBefore(toolbar, elements.commentsPanel.firstChild);
        }
    } else {
        document.body.classList.remove('compact-comments');
        const storiesPanel = document.querySelector('.stories-panel');
        if (toolbar && toolbar.parentElement !== storiesPanel) {
            storiesPanel.insertBefore(toolbar, storiesPanel.firstChild);
        }
    }
}

function syncUrl(replace = false) {
    const params = new URLSearchParams();
    if (state.currentPage > 0) params.set('page', String(state.currentPage));
    if (state.currentType === 'search' && state.searchQuery) {
        params.set('q', state.searchQuery);
        if (state.sortBy !== 'relevance') params.set('sort', state.sortBy);
        if (state.timeRange !== 'all') params.set('time', state.timeRange);
    }
    if (state.activeStoryId) {
        params.set('story', String(state.activeStoryId));
    }

    const baseSegments = getBaseSegments(window.location.pathname);
    const routeSegments = buildPathForType(state.currentType);
    const fullSegments = baseSegments.concat(routeSegments);

    let path;
    if (fullSegments.length === 0) {
        path = '/';
    } else if (state.currentType === 'front') {
        path = `/${fullSegments.join('/')}/`;
    } else {
        path = `/${fullSegments.join('/')}`;
    }

    const url = params.toString() ? `${path}?${params.toString()}` : path;
    if (replace) {
        history.replaceState(null, '', url);
    } else {
        history.pushState(null, '', url);
    }
}

function handlePopState() {
    parseStateFromUrl();
    applyStateToUi();
    reloadStories(true);
}

function setActiveButton(type) {
    elements.toggleSearchBtn.classList.toggle('active', type === 'search');
}

function changeType(type) {
    state.currentType = type;
    state.currentPage = 0;
    state.searchQuery = '';
    state.sortBy = 'relevance';
    state.timeRange = 'all';
    state.activeStoryId = null;
    state.activeStory = null;
    applyStateToUi();
    closeCommentsPanel();
    reloadStories();
    syncUrl();
}

function startSearch() {
    const query = elements.searchInput.value.trim();
    if (!query) return;
    state.currentType = 'search';
    state.currentPage = 0;
    state.searchQuery = query;
    state.activeStoryId = null;
    state.activeStory = null;
    applyStateToUi();
    closeCommentsPanel();
    reloadStories();
    syncUrl();
}

function changePage(delta) {
    state.currentPage = Math.max(0, state.currentPage + delta);
    state.activeStoryId = null;
    state.activeStory = null;
    closeCommentsPanel();
    reloadStories();
    syncUrl();
}

function updatePagination(totalItems, currentListLength) {
    elements.pageIndicator.textContent = `Page ${state.currentPage + 1}`;
    elements.prevPageBtn.disabled = state.currentPage === 0;
    if (state.currentType === 'search') {
        elements.nextPageBtn.disabled = currentListLength < state.storiesPerPage;
    } else {
        elements.nextPageBtn.disabled = totalItems <= (state.currentPage + 1) * state.storiesPerPage;
    }
}

async function reloadStories(replaceUrl = false) {
    renderStatus('Loading stories...');
    try {
        if (state.currentType === 'search') {
            state.storyIds = await fetchSearchResults(state.searchQuery, state.sortBy, state.timeRange, state.currentPage);
        } else if (state.currentType.startsWith('top_')) {
            const timeRangeMap = {
                top_d: 'past_24h',
                top_w: 'past_week',
                top_m: 'past_month',
                top_y: 'past_year',
                top_all: 'all'
            };
            const range = timeRangeMap[state.currentType] || 'all';
            state.storyIds = await fetchSearchResults('', 'relevance', range, state.currentPage);
        } else {
            state.storyIds = await fetchStories(state.currentType);
        }

        renderStories();
        if (replaceUrl) syncUrl(true);
    } catch (error) {
        renderError('Unable to load stories. Please try again.');
        console.error(error);
    }
}

function renderStatus(message) {
    elements.storiesList.innerHTML = `<div class="status-message">${message}</div>`;
}

function renderError(message) {
    elements.storiesList.innerHTML = `<div class="error-message">${message}</div>`;
}

async function renderStories() {
    const ids = state.currentType === 'search'
        ? state.storyIds
        : state.storyIds.slice(state.currentPage * state.storiesPerPage, (state.currentPage + 1) * state.storiesPerPage);

    if (!ids || ids.length === 0) {
        elements.storiesList.innerHTML = '<div class="no-results">No stories found.</div>';
        updatePagination(0, 0);
        return;
    }

    const items = await Promise.all(ids.map(id => fetchItem(id).catch(() => null)));
    const stories = items.filter(item => item && item.type === 'story' && !item.deleted && !item.dead);

    if (stories.length === 0) {
        elements.storiesList.innerHTML = '<div class="no-results">No stories found.</div>';
        updatePagination(state.storyIds.length, 0);
        return;
    }

    updatePagination(state.storyIds.length, stories.length);

    elements.storiesList.innerHTML = '';
    stories.forEach(story => {
        const card = document.createElement('article');
        card.className = 'story-card';
        if (state.activeStoryId === story.id) {
            card.classList.add('active');
        }
        card.dataset.id = story.id;
        card.tabIndex = 0;
        card.addEventListener('click', () => openStory(story));
        card.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') openStory(story);
        });

        const statsBox = document.createElement('div');
        statsBox.className = 'story-stats';
        statsBox.innerHTML = `
            <div class="stat" title="Points">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
                <span class="stat-val">${story.score || 0}</span>
            </div>
            <div class="stat" title="Comments">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                <span class="stat-val">${story.descendants || 0}</span>
            </div>
        `;

        const contentBox = document.createElement('div');
        contentBox.className = 'story-content';

        const title = document.createElement('h3');
        title.className = 'story-title';
        title.textContent = story.title || 'Untitled story';

        const fullUrl = story.url || `https://news.ycombinator.com/item?id=${story.id}`;

        const urlBlock = document.createElement('a');
        urlBlock.className = 'story-url';
        urlBlock.href = fullUrl;
        urlBlock.target = '_blank';
        urlBlock.rel = 'noopener';
        urlBlock.title = fullUrl;
        urlBlock.innerHTML = `&#128279; ${fullUrl}`;
        urlBlock.addEventListener('click', (event) => {
            event.stopPropagation();
        });

        const meta = document.createElement('div');
        meta.className = 'story-meta';
        meta.innerHTML = `
            <span>by <a href="https://news.ycombinator.com/user?id=${story.by}" class="author-link" target="_blank" onclick="event.stopPropagation()">${story.by || 'unknown'}</a></span>
            <span>${formatTime(story.time)}</span>
        `;

        contentBox.append(title, meta, urlBlock);
        card.append(contentBox, statsBox);
        elements.storiesList.appendChild(card);
    });

    if (state.activeStoryId) {
        openStoryById(state.activeStoryId, true);
    }
}

function handleStoryListKeyboardNavigation(event) {
    const activeElement = document.activeElement;
    const isStoryCard = activeElement && activeElement.classList.contains('story-card');
    const storyCards = Array.from(elements.storiesList.querySelectorAll('.story-card'));

    if (storyCards.length === 0) return;

    let currentIndex = -1;
    if (isStoryCard) {
        currentIndex = storyCards.indexOf(activeElement);
    }

    if (event.key === 'ArrowDown') {
        event.preventDefault();
        const nextIndex = Math.min(currentIndex + 1, storyCards.length - 1);
        storyCards[nextIndex].focus();
    } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        const prevIndex = Math.max(currentIndex - 1, 0);
        storyCards[prevIndex].focus();
    }
    // Could add Home/End/PageUp/PageDown for more comprehensive navigation
}

function openStory(story, replaceUrl = false) {
    state.activeStory = story;
    state.activeStoryId = story.id;
    
    // Highlight selected story in the list
    document.querySelectorAll('.story-card').forEach(card => {
        if (Number(card.dataset.id) === story.id) {
            card.classList.add('active');
        } else {
            card.classList.remove('active');
        }
    });

    elements.commentsTitle.textContent = story.title || 'Story comments';
    
    const fullUrl = story.url || `https://news.ycombinator.com/item?id=${story.id}`;
    elements.commentsUrl.href = fullUrl;
    elements.commentsUrl.innerHTML = `&#128279; ${fullUrl}`;
    
    elements.commentsMeta.innerHTML = `by <a href="https://news.ycombinator.com/user?id=${story.by}" class="author-link" target="_blank">${story.by || 'unknown'}</a> • ${formatTime(story.time)}`;
    
    elements.commentsStats.innerHTML = `
        <div class="stat" title="Points">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
            <span class="stat-val">${story.score || 0}</span>
        </div>
        <div class="stat" title="Comments">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
            <span class="stat-val">${story.descendants || 0}</span>
        </div>
    `;
    
    // elements.storyActions.hidden = false;
    // elements.storyLink.href = story.url || `https://news.ycombinator.com/item?id=${story.id}`;
    // elements.storyLink.textContent = story.url ? 'Open story' : 'View discussion';
    
    elements.commentsContent.innerHTML = '<div class="status-message">Loading comments...</div>';
    elements.commentsPanel.style.display = 'flex';
    updateResponsiveView();
    updateCommentNavUi();
    loadComments(story.id);

    if (replaceUrl) {
        syncUrl(true);
    } else {
        syncUrl();
    }
}

async function openStoryById(id, replaceUrl = false) {
    try {
        const story = await fetchItem(id);
        if (!story || story.type !== 'story' || story.deleted || story.dead) {
            elements.commentsContent.innerHTML = '<div class="error-message">Unable to load this story.</div>';
            return;
        }
        openStory(story, replaceUrl);
    } catch (error) {
        elements.commentsContent.innerHTML = '<div class="error-message">Unable to load this story.</div>';
        console.error(error);
    }
}

function closeCommentsPanel() {
    elements.commentsPanel.style.display = 'none';
    state.activeStory = null;
    state.activeStoryId = null;
    elements.commentsContent.innerHTML = '';
    // elements.storyActions.hidden = true;
    updateResponsiveView();
    updateCommentNavUi();
    syncUrl();
}

function buildCommentTreeHtml(kids, depth) {
    if (!kids || kids.length === 0) {
        return '';
    }

    const childHtmls = kids.map((child) => {
        if (!child.text) {
            return '';
        }

        const textHtml = sanitizeHtml(child.text);
        const by = child.author || 'unknown';
        const time = child.created_at_i ? formatTime(child.created_at_i) : '';
        const descendantCount = child.children ? countDescendants(child.children) : 0;

        const depthAttr = Number.isFinite(depth) ? depth : 0;
        const topLevelClass = depthAttr === 0 ? ' top-level-comment' : '';

        let html = `
            <div class="comment-thread${topLevelClass}" data-depth="${depthAttr}" id="thread-${child.id}">
                <div class="thread-line" onclick="toggleComment(${child.id})"></div>
                <div class="comment">
                    <div class="comment-meta" onclick="toggleComment(${child.id})" style="cursor: pointer;">
                        <span class="collapse-icon">[-]</span>
                        <strong>${by}</strong> &nbsp; <span class="time">${time}</span>
                        <span class="collapsed-info" style="display: none; padding-left: 10px; font-style: italic;">(${descendantCount + 1} child${descendantCount + 1 === 1 ? '' : 'ren'} hidden)</span>
                    </div>
                    <div class="comment-body" id="body-${child.id}">
                        <div class="comment-text">${textHtml}</div>
                    </div>
                </div>
        `;

        if (child.children && child.children.length > 0) {
            html += `<div class="comment-children" id="children-${child.id}">` + buildCommentTreeHtml(child.children, depth + 1) + `</div>`;
        }

        html += `</div>`;

        if (depth === 0) {
            html += `<hr class="top-level-divider" />`;
        }

        return html;
    });

    return childHtmls.join('');
}

window.toggleComment = function(id) {
    const thread = document.getElementById('thread-' + id);
    if (!thread) return;
    const body = document.getElementById('body-' + id);
    const children = document.getElementById('children-' + id);
    const icon = thread.querySelector('.collapse-icon');
    const info = thread.querySelector('.collapsed-info');

    if (body.style.display === 'none') {
        body.style.display = 'block';
        if (children) children.style.display = 'block';
        icon.textContent = '[-]';
        info.style.display = 'none';
    } else {
        body.style.display = 'none';
        if (children) children.style.display = 'none';
        icon.textContent = '[+]';
        info.style.display = 'inline';
    }
};

async function loadComments(id) {
    try {
        const item = await fetchItemWithComments(id);
        elements.commentsContent.innerHTML = '';

        if (!item.children || item.children.length === 0) {
            elements.commentsContent.innerHTML = '<div class="status-message">No comments available.</div>';
            updateCommentNavUi();
            return;
        }

        elements.commentsContent.innerHTML = buildCommentTreeHtml(item.children, 0);
        updateCommentNavUi();

    } catch (error) {
        elements.commentsContent.innerHTML = '<div class="error-message">Unable to load comments.</div>';
        console.error(error);
        updateCommentNavUi();
    }
}

function getTopLevelCommentThreads() {
    if (!elements.commentsContent) return [];
    return Array.from(elements.commentsContent.querySelectorAll('.comment-thread[data-depth="0"]'));
}

function getThreadTopInScrollArea(threadEl) {
    if (!elements.commentsScrollArea) return 0;
    const containerRect = elements.commentsScrollArea.getBoundingClientRect();
    const rect = threadEl.getBoundingClientRect();
    return elements.commentsScrollArea.scrollTop + (rect.top - containerRect.top);
}

function getCurrentTopLevelIndex(threads) {
    if (!elements.commentsScrollArea) return 0;
    const anchor = elements.commentsScrollArea.scrollTop + 20;

    let currentIndex = 0;
    for (let i = 0; i < threads.length; i++) {
        const top = getThreadTopInScrollArea(threads[i]);
        if (top <= anchor) currentIndex = i;
        else break;
    }
    return currentIndex;
}

function scrollToAdjacentTopLevelComment(direction) {
    if (!state.activeStoryId || !elements.commentsScrollArea) return;

    const threads = getTopLevelCommentThreads();
    if (threads.length === 0) return;

    const anchor = elements.commentsScrollArea.scrollTop + 20;

    if (direction > 0) {
        const next = threads.find((thread) => getThreadTopInScrollArea(thread) > anchor + 10);
        const target = next || threads[Math.min(threads.length - 1, getCurrentTopLevelIndex(threads) + 1)];
        const targetTop = Math.max(0, Math.round(getThreadTopInScrollArea(target)));
        elements.commentsScrollArea.scrollTo({ top: targetTop, behavior: 'smooth' });
        return;
    }

    let previous = null;
    for (let i = threads.length - 1; i >= 0; i--) {
        if (getThreadTopInScrollArea(threads[i]) < anchor - 10) {
            previous = threads[i];
            break;
        }
    }

    const target = previous || threads[Math.max(0, getCurrentTopLevelIndex(threads) - 1)];
    const targetTop = Math.max(0, Math.round(getThreadTopInScrollArea(target)));
    elements.commentsScrollArea.scrollTo({ top: targetTop, behavior: 'smooth' });
}

function updateCommentNavUi() {
    if (!elements.commentNav || !elements.prevCommentBtn || !elements.nextCommentBtn) return;

    const shouldShow = Boolean(state.activeStoryId);
    if (!shouldShow) {
        elements.commentNav.style.display = 'none';
        return;
    }

    const threads = getTopLevelCommentThreads();
    if (threads.length === 0) {
        elements.commentNav.style.display = 'none';
        return;
    }

    elements.commentNav.style.display = 'flex';

    const currentIndex = getCurrentTopLevelIndex(threads);
    elements.prevCommentBtn.disabled = currentIndex <= 0;
    elements.nextCommentBtn.disabled = currentIndex >= threads.length - 1;
}

function countDescendants(children) {
    if (!children || children.length === 0) return 0;
    return children.reduce((count, child) => count + 1 + countDescendants(child.children || []), 0);
}

function sanitizeHtml(html) {
    const template = document.createElement('template');
    template.innerHTML = html;
    template.content.querySelectorAll('script,style,iframe').forEach(node => node.remove());
    return template.innerHTML;
}

function formatTime(timestamp) {
    if (!timestamp) return 'unknown time';
    const date = new Date(timestamp * 1000);
    const now = Date.now();
    const diff = Math.floor((now - date.getTime()) / 1000);

    if (diff < 60) return `${Math.max(1, diff)} seconds ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)} minute${Math.floor(diff / 60) === 1 ? '' : 's'} ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hour${Math.floor(diff / 3600) === 1 ? '' : 's'} ago`;
    if (diff < 2592000) return `${Math.floor(diff / 86400)} day${Math.floor(diff / 86400) === 1 ? '' : 's'} ago`;
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

async function fetchStories(type) {
    const endpoint = (type === 'top' || type === 'front') ? 'topstories.json' : 'newstories.json';
    const response = await fetch(`https://hacker-news.firebaseio.com/v0/${endpoint}`);
    if (!response.ok) throw new Error('Failed to fetch story IDs');
    const data = await response.json();
    return Array.isArray(data) ? data : [];
}

async function fetchSearchResults(query, sortBy, timeRange, page) {
    const endpoint = sortBy === 'date' ? 'search_by_date' : 'search';
    let url = `https://hn.algolia.com/api/v1/${endpoint}?query=${encodeURIComponent(query)}&tags=story&page=${page}&hitsPerPage=30`;

    if (timeRange !== 'all') {
        const nowSeconds = Math.floor(Date.now() / 1000);
        let seconds = 0;
        if (timeRange === 'past_24h') seconds = 24 * 60 * 60;
        if (timeRange === 'past_week') seconds = 7 * 24 * 60 * 60;
        if (timeRange === 'past_month') seconds = 30 * 24 * 60 * 60;
        if (timeRange === 'past_year') seconds = 365 * 24 * 60 * 60;
        url += `&numericFilters=created_at_i>${nowSeconds - seconds}`;
    }

    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch search results');
    const data = await response.json();
    return Array.isArray(data.hits) ? data.hits.map(hit => Number(hit.objectID)).filter(Boolean) : [];
}

async function fetchItem(id) {
    const response = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
    if (!response.ok) throw new Error('Failed to fetch story item');
    return await response.json();
}

async function fetchItemWithComments(id) {
    const response = await fetch(`https://hn.algolia.com/api/v1/items/${id}`);
    if (!response.ok) throw new Error('Failed to fetch story comments');
    return await response.json();
}

init();
