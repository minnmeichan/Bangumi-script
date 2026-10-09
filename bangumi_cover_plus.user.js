// ==UserScript==
// @name         Bangumi 封面上传与切换增强版（改）
// @namespace    https://github.com/minnmeichan
// @version      1.4.0
// @description  增强Bangumi封面上传与切换，支持URL/本地上传、封面切换、投票、多通道下载、暗黑模式
// @author       minnmeichan（基于Bios原版修改）
// @match        *://bgm.tv/subject/*
// @match        *://chii.in/subject/*
// @match        *://bangumi.tv/subject/*
// @match        *://bgm.tv/character/*
// @match        *://chii.in/character/*
// @match        *://bangumi.tv/character/*
// @match        *://bgm.tv/person/*
// @match        *://chii.in/person/*
// @match        *://bangumi.tv/person/*
// @connect      images.weserv.nl
// @connect      *
// @grant        GM_xmlhttpRequest
// @run-at       document-start
// @noframes
// @license      MIT
// ==/UserScript==

(function () {
    "use strict";

    // 可调参数
    const MAX_UPLOAD_SIZE = 4 * 1024 * 1024;   // 4MB
    // 只有这两种格式允许"已达标就跳过压缩"（避免 GIF/WebP 直传异常）
    const PASS_THROUGH_TYPES = ['image/jpeg', 'image/png'];
    const THEME_SYNC_INTERVAL = 800;
    const LOLI_WATCH_TIMEOUT_MS = 10000;
    const GM_TIMEOUT_MS = 10000;
    const DOWNLOAD_PER_TRY_TIMEOUT_MS = 30000;

    // 工具
    const now = () => (typeof performance !== 'undefined' && performance.now)
        ? performance.now() : Date.now();
    const log = (...args) => console.log('[bgm-cover+]', ...args);
    const warn = (...args) => console.warn('[bgm-cover+]', ...args);

    // 是否可以直接跳过压缩
    const canPassThrough = (file) =>
        file && file.size <= MAX_UPLOAD_SIZE && PASS_THROUGH_TYPES.includes(file.type);

    function normalizeCoverUrl(url) {
        if (!url) return url;
        return url.split('#')[0].split('?')[0].replace(/\/r\/[^/]+\//, '/');
    }

    // 主题检测
    function getCurrentBangumiTheme() {
        if (typeof document.cookie !== 'undefined') {
            const m = document.cookie.match(/(?:^|;)\s*chii_theme=([^;]+)/);
            if (m && m[1]) return m[1];
        }
        try {
            const t = localStorage.getItem('chii_theme');
            if (t) return t;
        } catch (e) { /* ignore */ }
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
        return 'light';
    }

    const isDarkTheme = () => getCurrentBangumiTheme() === 'dark';

    function updateGlobalDarkModeClass() {
        if (!document.body) return;
        document.body.classList.toggle('bgm-dark-mode', isDarkTheme());
    }

    let themeSyncTimer = null;
    function startThemeSync() {
        let last = getCurrentBangumiTheme();
        const check = () => {
            const t = getCurrentBangumiTheme();
            if (t !== last) { last = t; updateGlobalDarkModeClass(); }
        };
        if (themeSyncTimer) clearInterval(themeSyncTimer);
        themeSyncTimer = setInterval(check, THEME_SYNC_INTERVAL);
        window.addEventListener('storage', (e) => {
            if (e.key !== 'chii_theme') return;
            const t = e.newValue
                || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
            if (t !== last) { last = t; updateGlobalDarkModeClass(); }
        });
    }

    // 注入样式
    function injectStyles() {
        if (document.querySelector('#bgm-cover-styles')) return;
        if (!document.head) return;

        const style = document.createElement('style');
        style.id = 'bgm-cover-styles';
        style.textContent = `
            :root {
                --primary-color: #369CF8;
                --primary-light: rgba(74, 144, 226, 0.1);
                --primary-hover: #3A80D2;
                --border-color: #E0E0E0;
                --background-light: #F9F9F9;
                --shadow-soft: 0 4px 10px rgba(0, 0, 0, 0.05);
                --shadow-hover: 0 6px 14px rgba(0, 0, 0, 0.1);
                --border-radius: 8px;
                --transition-normal: all 0.1s cubic-bezier(0.4, 0, 0.2, 1);
            }
            #coverUploadForm { display: flex; flex-direction: column; align-items: center; }
            #coverUploadForm input[type="file"] {
                border: 2px dashed var(--border-color);
                border-radius: var(--border-radius);
                padding: 10px;
                width: 100%;
                background: var(--background-light);
                box-sizing: border-box;
                cursor: pointer;
                transition: var(--transition-normal);
            }
            #coverUploadForm input[type="file"]:hover {
                border-color: var(--primary-color);
                background: var(--primary-light);
            }
            #coverUploadForm input[type="submit"] {
                background: var(--primary-color);
                color: white;
                border: none;
                border-radius: 20px;
                padding: 8px 16px;
                margin-top: 8px;
                cursor: pointer;
                font-weight: 600;
                transition: var(--transition-normal);
                box-shadow: var(--shadow-soft);
                position: relative;
                top: -15px;
            }
            #coverUploadForm input[type="submit"]:hover {
                background: var(--primary-hover);
                transform: translateY(-1px);
                box-shadow: var(--shadow-hover);
            }
            .cover-upload-modal {
                display: none;
                position: fixed;
                z-index: 1000;
                background-color: white;
                border: 1px solid var(--border-color);
                border-radius: var(--border-radius);
                padding: 15px;
                box-shadow: var(--shadow-soft);
                width: 240px;
                max-width: 100%;
                transition: var(--transition-normal);
            }
            .cover-upload-modal:hover { box-shadow: var(--shadow-hover); }
            .url-input-container { display: flex; margin-bottom: 10px; height: 30px; }
            .image-url-input {
                flex-grow: 1;
                padding: 8px;
                margin-right: 10px;
                border: 1px solid var(--border-color);
                border-radius: var(--border-radius);
                outline: none;
                transition: var(--transition-normal);
                font-size: 14px;
                background: #fff;
                color: #333;
            }
            .download-url-button {
                padding: 8px 16px;
                background-color: var(--primary-color);
                color: white;
                border: none;
                border-radius: var(--border-radius);
                cursor: pointer;
                font-weight: 600;
                transition: var(--transition-normal);
                box-shadow: var(--shadow-soft);
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100%;
            }
            .download-url-button:hover {
                background-color: var(--primary-hover);
                transform: translateY(-1px);
                box-shadow: var(--shadow-hover);
            }
            .image-preview-container { margin-top: 10px; display: none; text-align: center; }
            .image-preview {
                max-width: 100%;
                max-height: 300px;
                object-fit: contain;
                border: 1px solid var(--border-color);
                border-radius: var(--border-radius);
            }
            .status-message {
                text-align: center;
                margin-top: 10px;
                padding: 8px;
                border-radius: var(--border-radius);
                display: none;
                font-size: 13px;
            }
            .status-message.is-ok {
                background-color: #eeffee;
                color: #007700;
                border: 1px solid #007700;
            }
            .status-message.is-error {
                background-color: #ffeeee;
                color: #cc0000;
                border: 1px solid #cc0000;
            }
            body.bgm-dark-mode {
                --border-color: #444444;
                --background-light: #2a2a2a;
                --shadow-soft: 0 4px 10px rgba(255, 255, 255, 0.05);
                --shadow-hover: 0 6px 14px rgba(255, 255, 255, 0.1);
            }
            body.bgm-dark-mode .cover-upload-modal {
                background-color: #1a1a1a !important;
                border-color: #444444 !important;
                color: #e0e0e0 !important;
            }
            body.bgm-dark-mode .image-url-input {
                background: #2a2a2a !important;
                color: #e0e0e0 !important;
                border-color: #444444 !important;
            }
            body.bgm-dark-mode .image-url-input:focus { border-color: var(--primary-color) !important; }
            body.bgm-dark-mode .status-message.is-ok {
                background-color: #1a3a1a !important;
                color: #aaffaa !important;
                border-color: #aaffaa !important;
            }
            body.bgm-dark-mode .status-message.is-error {
                background-color: #3a1a1a !important;
                color: #ffaaaa !important;
                border-color: #ffaaaa !important;
            }
            body.bgm-dark-mode .image-preview { border-color: #444 !important; }
            body.bgm-dark-mode .cover-arrow { background: rgba(0, 0, 0, 0.85) !important; color: #fff !important; }
            body.bgm-dark-mode .vote-button { background: var(--primary-color) !important; }
            body.bgm-dark-mode .vote-button:hover { background: var(--primary-hover) !important; }
        `;
        document.head.appendChild(style);
    }

    // 预览管理
    let currentPreviewObjectUrl = null;
    function setPreviewImage(src, isObjectUrl) {
        const previewContainer = document.getElementById('imagePreviewContainer');
        const previewImage = document.getElementById('imagePreview');
        if (!previewContainer || !previewImage) return;
        if (currentPreviewObjectUrl && currentPreviewObjectUrl !== src) {
            try { URL.revokeObjectURL(currentPreviewObjectUrl); } catch (e) { /* ignore */ }
            currentPreviewObjectUrl = null;
        }
        if (isObjectUrl) currentPreviewObjectUrl = src;
        previewImage.src = src;
        previewContainer.style.display = 'block';
    }

    // 主逻辑
    let isFormPinned = false;

    async function initCoverUpload() {
        const pathname = location.pathname;
        const match = pathname.match(/^\/(subject|person|character)\/(\d+)$/);
        if (!match) return;

        const type = match[1];
        const id = match[2];
        const parsedInfo = { type, id };

        if (document.querySelector('#coverUploadButton')) return;

        const nav = document.querySelector('.subjectNav .navTabs') || document.querySelector('.navTabs');
        if (!nav) return;

        const isCharacterPage = (type === 'character');

        // 按钮：两种模式严格互斥
        function createDefaultButton() {
            const li = document.createElement('li');
            li.id = 'coverUploadButton';
            li.className = 'upload-button';
            li.style.float = 'right';
            li.innerHTML = `<a href="javascript:void(0);" style="padding: 10px 10px 9px; white-space: nowrap;">上传封面</a>`;
            return li;
        }

        function createLuoliButton(nav) {
            const div = document.createElement('div');
            div.id = 'coverUploadButton';
            div.className = 'upload-button';
            div.dataset.bgmCoverMode = 'luoli';
            div.innerHTML = `<a href="javascript:void(0);" style="white-space: nowrap;">上传封面</a>`;

            const navRefLink = nav.querySelector('a');
            const navFontSize = navRefLink ? getComputedStyle(navRefLink).fontSize : '14px';
            const navFontFamily = navRefLink ? getComputedStyle(navRefLink).fontFamily : 'inherit';

            div.style.cssText = `
                white-space: nowrap;
                color: #999;
                cursor: pointer;
                padding: 0 8px;
                margin: 0;
                position: relative;
                top: 1px;
                font-size: ${navFontSize};
                font-family: ${navFontFamily};
                transition: color 0.2s ease;
            `;
            const a = div.querySelector('a');
            if (a) {
                a.style.cssText = `
                    color: inherit;
                    text-decoration: none;
                    padding: 0;
                    display: inline;
                    line-height: inherit;
                `;
            }
            return div;
        }

        let uploadBtn = createDefaultButton();
        nav.appendChild(uploadBtn);

        // 角色页：luoli 出现后整体替换成模式 B
        if (isCharacterPage) {
            if (!document.getElementById('bgm-cover-loli-hover')) {
                const s = document.createElement('style');
                s.id = 'bgm-cover-loli-hover';
                s.textContent = `
                    #lc-char-rating-container #coverUploadButton:hover,
                    #lc-char-rating-container #coverUploadButton:hover > a {
                        color: #f09199 !important;
                    }
                `;
                document.head.appendChild(s);
            }

            const tryUpgradeToLuoli = () => {
                const loliBox = document.getElementById('lc-char-rating-container');
                if (!loliBox) return false;
                const current = document.getElementById('coverUploadButton');
                if (!current) return false;
                if (current.dataset.bgmCoverMode === 'luoli') return true;

                const newBtn = createLuoliButton(nav);
                current.replaceWith(newBtn);
                loliBox.insertBefore(newBtn, loliBox.firstChild);
                uploadBtn = newBtn;
                return true;
            };

            if (!tryUpgradeToLuoli()) {
                let attempts = 0;
                let loliTimer = null;
                let loliMO = null;
                let stopped = false;

                const stop = () => {
                    if (stopped) return;
                    stopped = true;
                    if (loliTimer) { clearInterval(loliTimer); loliTimer = null; }
                    if (loliMO) { loliMO.disconnect(); loliMO = null; }
                };

                loliTimer = setInterval(() => {
                    if (tryUpgradeToLuoli()) stop();
                    else if (++attempts * 250 >= LOLI_WATCH_TIMEOUT_MS) {
                        stop();
                        log('[角色页] 未发现 luoli 区块，按钮保持默认导航栏样式');
                    }
                }, 250);

                loliMO = new MutationObserver(() => {
                    if (tryUpgradeToLuoli()) stop();
                });
                loliMO.observe(document.documentElement || document, { childList: true, subtree: true });
            }
        }

        // 上传表单弹窗
        const formContainer = document.createElement('div');
        formContainer.id = 'coverUploadFormContainer';
        formContainer.classList.add('cover-upload-modal');
        formContainer.innerHTML = `
            <div class="upload-section">
                <div class="url-input-container">
                    <input type="text" id="imageUrlInput" class="image-url-input" placeholder="输入图片 URL">
                    <button id="downloadUrlButton" class="download-url-button">下载</button>
                </div>
                <div id="uploadFormContainer" class="upload-form-container"></div>
                <div id="imagePreviewContainer" class="image-preview-container">
                    <img id="imagePreview" class="image-preview" alt="图片预览">
                </div>
                <div id="statusMessage" class="status-message"></div>
            </div>
        `;
        formContainer.style.position = 'absolute';
        formContainer.style.zIndex = '9999';
        formContainer.style.display = 'none';
        document.body.appendChild(formContainer);

        let imgIdx = 0, imgList = [], voteLinks = [];
        let imgEl = null, coverLnk = null, coverDiv = null, currImgSrc = null;

        coverDiv = document.querySelector('#bangumiInfo .infobox div[align="center"]');
        if (coverDiv) {
            imgEl = coverDiv.querySelector('a.cover img');
            coverLnk = coverDiv.querySelector('a.cover');
            currImgSrc = imgEl ? imgEl.getAttribute('src') : null;
        }

        const createArrow = (cls) => {
            const arrow = document.createElement('div');
            arrow.className = `cover-arrow ${cls}`;
            Object.assign(arrow.style, {
                position: 'absolute',
                top: '50%',
                transform: 'translateY(-50%)',
                [cls.includes('left') ? 'left' : 'right']: '10px',
                opacity: '0.8',
                cursor: 'pointer',
                background: 'rgba(0, 0, 0, 0.7)',
                color: '#fff',
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                fontWeight: 'bold',
                zIndex: '1000',
                boxShadow: '0 0 5px rgba(0, 0, 0, 0.5)',
                transition: 'background 0.2s ease, opacity 0.2s ease'
            });
            arrow.innerHTML = cls.includes('left') ? '◄' : '►';
            arrow.addEventListener('mouseenter', () => {
                arrow.style.background = 'rgba(0, 0, 0, 0.9)';
                arrow.style.opacity = '1';
            });
            arrow.addEventListener('mouseleave', () => {
                arrow.style.background = 'rgba(0, 0, 0, 0.7)';
                arrow.style.opacity = '0.8';
            });
            return arrow;
        };

        const createVoteButton = () => {
            const voteButton = document.createElement('div');
            voteButton.className = 'vote-button';
            Object.assign(voteButton.style, {
                position: 'absolute',
                bottom: '15px',
                left: '50%',
                transform: 'translateX(-50%)',
                opacity: '0.9',
                cursor: 'pointer',
                background: 'var(--primary-color)',
                color: '#fff',
                padding: '8px 20px',
                borderRadius: '20px',
                fontSize: '14px',
                fontWeight: 'bold',
                zIndex: '1000',
                boxShadow: '0 2px 5px rgba(0, 0, 0, 0.3)',
                transition: 'background 0.2s ease, transform 0.1s ease, box-shadow 0.2s ease',
            });
            voteButton.textContent = '投票';
            voteButton.addEventListener('mouseenter', () => {
                voteButton.style.background = 'var(--primary-hover)';
                voteButton.style.transform = 'translateX(-50%) scale(1.05)';
                voteButton.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.4)';
            });
            voteButton.addEventListener('mouseleave', () => {
                voteButton.style.background = 'var(--primary-color)';
                voteButton.style.transform = 'translateX(-50%) scale(1)';
                voteButton.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.3)';
            });
            return voteButton;
        };

        async function submitVote(voteUrl) {
            const fullVoteUrl = voteUrl.startsWith('http')
                ? voteUrl
                : `${location.origin}${voteUrl.startsWith('/') ? '' : '/'}${voteUrl}`;
            try {
                const resp = await fetch(fullVoteUrl, {
                    method: 'GET',
                    headers: { 'Accept': 'text/html' }
                });
                return resp.ok;
            } catch (e) {
                warn('投票请求失败:', e);
                return false;
            }
        }

        const updateImg = () => {
            const newImgSrc = imgList[imgIdx];
            imgEl.setAttribute('src', newImgSrc);
            coverLnk.setAttribute('href', newImgSrc.replace(/\/r\/[^/]+\//, '/'));
            const oldVoteBtn = coverDiv.querySelector('.vote-button');
            if (oldVoteBtn) oldVoteBtn.remove();

            const isDifferent = normalizeCoverUrl(newImgSrc) !== normalizeCoverUrl(currImgSrc);
            if (isDifferent && voteLinks[imgIdx]) {
                const voteBtn = createVoteButton();
                voteBtn.addEventListener('click', async () => {
                    showStatus('正在提交投票...');
                    const ok = await submitVote(voteLinks[imgIdx]);
                    if (ok) {
                        alert('投票成功！页面将在3秒后刷新...');
                        showBrowserNotification('投票成功', '封面投票成功，页面即将刷新。');
                        setTimeout(() => window.location.reload(), 3000);
                    } else {
                        showStatus('投票失败，请手动投票', true);
                        showBrowserNotification('投票失败', '投票遇到问题，请尝试手动投票。');
                    }
                });
                coverDiv.appendChild(voteBtn);
            }
        };

        const changeImg = (dir) => {
            if (imgList.length) {
                imgIdx = (imgIdx + dir + imgList.length) % imgList.length;
                updateImg();
            }
        };

        if (coverDiv && imgEl && coverLnk) {
            const arrows = [
                createArrow('cover-arrow-left'),
                createArrow('cover-arrow-right')
            ];
            coverDiv.style.position = 'relative';
            coverDiv.append(...arrows);
            arrows.forEach(arrow => arrow.style.display = 'none');
            coverDiv.addEventListener('mouseenter', () => {
                arrows.forEach(arrow => arrow.style.display = 'flex');
                const voteBtn = coverDiv.querySelector('.vote-button');
                if (voteBtn) voteBtn.style.display = 'block';
            });
            coverDiv.addEventListener('mouseleave', () => {
                arrows.forEach(arrow => arrow.style.display = 'none');
                const voteBtn = coverDiv.querySelector('.vote-button');
                if (voteBtn) voteBtn.style.display = 'none';
            });
            coverDiv.addEventListener('click', (e) => {
                if (e.target.classList.contains('cover-arrow-left')) changeImg(-1);
                if (e.target.classList.contains('cover-arrow-right')) changeImg(1);
            });
        }

        const fetchImgList = () => {
            fetch(`${window.location.pathname}/upload_img`)
                .then(res => res.text())
                .then(html => {
                    const $html = new DOMParser().parseFromString(html, 'text/html');
                    const imgs = Array.from($html.querySelectorAll('.photoList li a.grid img'))
                        .map(img => img.getAttribute('src'));
                    voteLinks = Array.from($html.querySelectorAll('.photoList li a[href*="/vote/cover/"]'))
                        .map(a => a.getAttribute('href'));
                    imgList = [...new Set(imgs)];
                    const normalizedCurr = normalizeCoverUrl(currImgSrc);
                    imgIdx = Math.max(0, imgList.findIndex(u => normalizeCoverUrl(u) === normalizedCurr));
                    if (imgList.length > 1 && coverDiv && imgEl && coverLnk) {
                        updateImg();
                    }
                })
                .catch(err => warn('拉取封面列表失败:', err));
        };
        fetchImgList();

        let formLoaded = false;
        let hideTimeout = null;
        let skipChangeUntil = 0;

        function showStatus(message, isError = false) {
            const statusDiv = document.getElementById('statusMessage');
            if (!statusDiv) return;
            statusDiv.textContent = message;
            statusDiv.style.display = 'block';
            statusDiv.classList.toggle('is-error', !!isError);
            statusDiv.classList.toggle('is-ok', !isError);
            log(`[状态] ${message}`);
        }

        function showBrowserNotification(title, body) {
            if (typeof Notification === 'undefined') {
                showStatus(body || title, title.includes('失败'));
                return;
            }
            if (Notification.permission === 'granted') {
                new Notification(title, { body });
            } else if (Notification.permission !== 'denied') {
                Notification.requestPermission().then(permission => {
                    if (permission === 'granted') new Notification(title, { body });
                    else showStatus(body || title, title.includes('失败'));
                });
            } else {
                showStatus(body || title, title.includes('失败'));
            }
        }

        function createHiddenIframe() {
            const existing = document.getElementById('hiddenUploadFrame');
            if (existing) return existing;
            const iframe = document.createElement('iframe');
            iframe.id = 'hiddenUploadFrame';
            iframe.name = 'hiddenUploadFrame';
            iframe.style.display = 'none';
            document.body.appendChild(iframe);
            return iframe;
        }

        function processUploadResult(iframe) {
            return new Promise((resolve, reject) => {
                iframe.onload = function () {
                    try {
                        const doc = iframe.contentDocument || iframe.contentWindow.document;
                        const allVoteLinks = doc.querySelectorAll('a[href*="/vote/cover/"]');
                        const voteLink = allVoteLinks.length > 0 ? allVoteLinks[allVoteLinks.length - 1] : null;
                        if (voteLink) {
                            const href = voteLink.getAttribute('href');
                            showStatus('封面上传成功，正在投票...');
                            submitVote(href).then(ok => {
                                if (ok) {
                                    showStatus('投票成功！页面将在3秒后刷新...');
                                    showBrowserNotification('投票成功', '封面上传后的自动投票已成功，页面即将刷新。');
                                    setTimeout(() => window.location.reload(), 3000);
                                    resolve(true);
                                } else {
                                    showStatus('封面上传成功，但投票失败。3秒后跳转到手动投票页面...', true);
                                    showBrowserNotification('投票失败', '封面上传成功，但自动投票失败。将跳转到手动投票页面。');
                                    setTimeout(() => window.location.href = `${window.location.href.split('?')[0]}/upload_img`, 3000);
                                    reject(new Error('投票请求失败'));
                                }
                            });
                        } else {
                            const errorMsgEl = doc.querySelector('.error, .errorMessage, [class*="error"]');
                            const msg = errorMsgEl ? errorMsgEl.textContent : '未找到投票链接';
                            showStatus(errorMsgEl ? `上传失败: ${msg}，3秒后跳转到手动上传页面...` : '封面似乎已上传成功，但未找到投票链接。3秒后跳转到手动处理页面...', true);
                            showBrowserNotification(errorMsgEl ? '上传失败' : '操作提醒', errorMsgEl ? `${msg} 将跳转到手动上传页面。` : '封面已上传，但未找到投票链接。将跳转到手动处理页面。');
                            setTimeout(() => window.location.href = `${window.location.href.split('?')[0]}/upload_img`, 3000);
                            reject(new Error(msg));
                        }
                    } catch (error) {
                        showStatus('处理上传结果时出错，3秒后跳转到手动上传页面...', true);
                        showBrowserNotification('处理错误', '处理上传结果时出错，将跳转到手动上传页面。');
                        setTimeout(() => window.location.href = `${window.location.href.split('?')[0]}/upload_img`, 3000);
                        reject(error);
                    }
                };
                iframe.onerror = function () {
                    showStatus('上传请求失败，3秒后跳转到手动上传页面...', true);
                    showBrowserNotification('上传失败', '上传请求失败，将跳转到手动上传页面。');
                    setTimeout(() => window.location.href = `${window.location.href.split('?')[0]}/upload_img`, 3000);
                    reject(new Error('上传请求失败'));
                };
            });
        }

        function setupFormForIframeSubmission(form) {
            const iframe = createHiddenIframe();
            form.target = 'hiddenUploadFrame';
            form.addEventListener('submit', function () {
                showStatus('正在上传封面...');
                processUploadResult(iframe).catch(error => warn('处理上传结果失败:', error));
            });
        }

        // 抽样检测透明度
        function hasTransparency(ctx, w, h) {
            try {
                const data = ctx.getImageData(0, 0, w, h).data;
                const len = data.length;
                const step = Math.max(4, Math.floor(len / 80000 / 4) * 4);
                for (let i = 3; i < len; i += step) {
                    if (data[i] < 255) return true;
                }
            } catch (e) {
                warn('无法检查透明度，默认视为无透明度', e);
            }
            return false;
        }

        // 压缩：透明保留 PNG，否则 JPEG 逐级降质到 < MAX_UPLOAD_SIZE
        // 【保持原分辨率】不缩尺寸
        async function convertImageFormat(file) {
            return new Promise((resolve, reject) => {
                const objectUrl = URL.createObjectURL(file);
                const img = new Image();

                const cleanup = () => {
                    try { URL.revokeObjectURL(objectUrl); } catch (e) { /* ignore */ }
                };

                img.onload = async () => {
                    try {
                        const width = img.naturalWidth || img.width;
                        const height = img.naturalHeight || img.height;
                        const canvas = document.createElement('canvas');
                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, width, height);
                        cleanup();

                        const transparent = hasTransparency(ctx, width, height);
                        const getBlob = (format, q) => new Promise((res, rej) => {
                            canvas.toBlob(b => b ? res(b) : rej(new Error('canvas.toBlob 返回空')), format, q);
                        });

                        let currentFormat = transparent ? 'image/png' : 'image/jpeg';
                        let quality = 0.92;

                        if (currentFormat === 'image/jpeg') {
                            ctx.globalCompositeOperation = 'destination-over';
                            ctx.fillStyle = '#FFFFFF';
                            ctx.fillRect(0, 0, width, height);
                            ctx.globalCompositeOperation = 'source-over';
                        }

                        log(`[压缩] 初始格式: ${currentFormat}，尺寸: ${width}×${height}`);
                        let blob = await getBlob(currentFormat, quality);

                        while (blob.size > MAX_UPLOAD_SIZE) {
                            log(`[压缩] 当前大小: ${(blob.size / 1024 / 1024).toFixed(2)}MB (超过限制)`);
                            if (currentFormat === 'image/png') {
                                log('[压缩] PNG 过大，切换为 JPEG 格式');
                                currentFormat = 'image/jpeg';
                                ctx.globalCompositeOperation = 'destination-over';
                                ctx.fillStyle = '#FFFFFF';
                                ctx.fillRect(0, 0, width, height);
                                ctx.globalCompositeOperation = 'source-over';
                                quality = 0.90;
                            } else {
                                quality -= 0.1;
                                log(`[压缩] 降低 JPEG 质量至: ${quality.toFixed(1)}`);
                                if (quality < 0.1) {
                                    log('[压缩] 已达最低质量，直接使用当前结果');
                                    break;
                                }
                            }
                            blob = await getBlob(currentFormat, quality);
                        }

                        log(`[压缩] 最终大小: ${(blob.size / 1024 / 1024).toFixed(2)}MB, 格式: ${currentFormat}`);

                        const ext = currentFormat === 'image/png' ? 'png' : 'jpg';
                        const newFileName = file.name.replace(/\.[^/.]+$/, '') + '.' + ext;
                        const convertedFile = new File([blob], newFileName, { type: currentFormat });

                        resolve({ file: convertedFile, blob, format: ext });
                    } catch (err) {
                        cleanup();
                        reject(err);
                    }
                };
                img.onerror = () => {
                    cleanup();
                    reject(new Error('加载图片失败'));
                };
                img.src = objectUrl;
            });
        }

        // 从 URL 下载并按原尺寸转成 File
        const loadImageAsFile = (url, timeoutMs) => new Promise((resolve, reject) => {
            const startedAt = now();
            const img = new Image();
            img.crossOrigin = 'anonymous';
            const timer = setTimeout(() => {
                img.src = '';
                reject(new Error('超时'));
            }, timeoutMs);

            img.onload = () => {
                clearTimeout(timer);
                try {
                    const width = img.naturalWidth || img.width;
                    const height = img.naturalHeight || img.height;
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    const transparent = hasTransparency(ctx, width, height);
                    const format = transparent ? 'image/png' : 'image/jpeg';
                    const quality = transparent ? undefined : 0.92;

                    canvas.toBlob((blob) => {
                        if (!blob) return reject(new Error('toBlob 失败'));
                        const baseName = url.split('/').pop()?.split('?')[0] || 'image';
                        const ext = transparent ? 'png' : 'jpg';
                        const fileName = baseName.replace(/\.[^/.]+$/, '') + '.' + ext;
                        resolve({
                            file: new File([blob], fileName, { type: format }),
                            elapsed: now() - startedAt
                        });
                    }, format, quality);
                } catch (e) {
                    reject(new Error('canvas 读不了（CORS 被拦）'));
                }
            };
            img.onerror = () => { clearTimeout(timer); reject(new Error('加载失败')); };
            img.src = url;
        });

        // 6 个代理并行，谁先成功用谁
        const downloadViaImageObject = (originalUrl) => {
            const noScheme = originalUrl.replace(/^https?:\/\//, '');
            const candidates = [
                { name: '直连', url: originalUrl },
                { name: 'yumus', url: `https://proxy.yumus.cn/${originalUrl}` },
                { name: 'wsrv', url: `https://wsrv.nl/?url=${encodeURIComponent(noScheme)}` },
                { name: 'weserv', url: `https://images.weserv.nl/?url=${encodeURIComponent(noScheme)}` },
                { name: 'allorigins', url: `https://api.allorigins.win/raw?url=${encodeURIComponent(originalUrl)}` },
                { name: 'corsproxy', url: `https://corsproxy.io/?url=${encodeURIComponent(originalUrl)}` },
            ];
            const startedAt = now();

            return new Promise((resolve, reject) => {
                let settled = false;
                let pending = candidates.length;
                const errors = [];

                candidates.forEach((c) => {
                    loadImageAsFile(c.url, DOWNLOAD_PER_TRY_TIMEOUT_MS)
                        .then(r => {
                            if (settled) return;
                            settled = true;
                            const elapsed = now() - startedAt;
                            log(`[下载] ${c.name} 成功，耗时 ${Math.round(elapsed)}ms`);
                            resolve({ file: r.file, method: c.name, elapsed });
                        })
                        .catch(e => {
                            log(`[下载] ${c.name} 失败: ${e.message}`);
                            errors.push(`${c.name}→${e.message}`);
                            if (--pending === 0 && !settled) {
                                settled = true;
                                reject(new Error('全部失败：' + errors.join(' | ')));
                            }
                        });
                });
            });
        };

        const downloadViaGM = (url) => new Promise((resolve, reject) => {
            if (typeof GM_xmlhttpRequest !== 'function') return reject(new Error('GM 不可用'));
            const startedAt = now();
            GM_xmlhttpRequest({
                method: 'GET',
                url,
                responseType: 'blob',
                timeout: GM_TIMEOUT_MS,
                onload: function (response) {
                    if (response.status >= 200 && response.status < 300) {
                        const blob = response.response;
                        if (!blob) return reject(new Error('响应为空'));
                        const fileName = url.split('/').pop()?.split('?')[0] || 'image.jpg';
                        resolve({
                            file: new File([blob], fileName, { type: blob.type || 'image/jpeg' }),
                            method: 'GM',
                            elapsed: now() - startedAt
                        });
                    } else {
                        reject(new Error(`HTTP ${response.status}`));
                    }
                },
                onerror: () => reject(new Error('GM 请求失败')),
                ontimeout: () => reject(new Error('GM 超时'))
            });
        });

        const formatElapsed = (ms) => ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(2)}s`;

        // 把最终文件塞进 input，显示预览和提交按钮
        function pushFileToInput(finalFile, previewBlob, formatTag, methodLabel) {
            const previewUrl = URL.createObjectURL(previewBlob);
            setPreviewImage(previewUrl, true);

            const fileInput = document.querySelector("#coverUploadForm input[type='file']");
            if (!fileInput) {
                warn('[错误] 找不到文件上传输入框');
                showStatus('未找到文件上传输入框', true);
                return;
            }
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(finalFile);
            fileInput.files = dataTransfer.files;
            skipChangeUntil = now() + 300;
            fileInput.dispatchEvent(new Event('change', { bubbles: true }));
            const submitButton = document.querySelector("#coverUploadForm input[type='submit']");
            if (submitButton) submitButton.style.display = 'block';
            showStatus(`已就绪（${formatTag}${methodLabel}），点击提交上传`);
        }

        async function downloadAndConvertImage(imageUrl) {
            try {
                let actualImageUrl = imageUrl;
                if (imageUrl.includes('google.com/imgres')) {
                    const urlParams = new URL(imageUrl).searchParams;
                    actualImageUrl = urlParams.get('imgurl') || imageUrl;
                }

                log('[下载] 开始下载图片:', actualImageUrl);
                showStatus('正在下载图片...');

                let tempFile = null;
                let downloadMethod = '';
                let downloadElapsed = 0;

                try {
                    const r = await downloadViaGM(actualImageUrl);
                    tempFile = r.file;
                    downloadMethod = r.method;
                    downloadElapsed = r.elapsed;
                    log('[下载] GM 成功');
                } catch (e) {
                    log('[下载] GM 不可用/失败:', e.message);
                }

                if (!tempFile) {
                    try {
                        const r = await downloadViaImageObject(actualImageUrl);
                        tempFile = r.file;
                        downloadMethod = r.method;
                        downloadElapsed = r.elapsed;
                        log('[下载] 并行代理链 成功');
                    } catch (e) {
                        warn('[下载] 全部失败:', e.message);
                        showStatus(`下载失败：${e.message}`, true);
                        return;
                    }
                }

                // 【关键优化】下载结果已达标 → 跳过二次编码
                if (canPassThrough(tempFile)) {
                    log(`[处理] 下载结果 ${(tempFile.size / 1024 / 1024).toFixed(2)}MB，已达标，跳过压缩`);
                    showStatus(`下载成功（${downloadMethod}，${formatElapsed(downloadElapsed)}），无需压缩`);
                    pushFileToInput(tempFile, tempFile, '原图', `，下载：${downloadMethod}，${formatElapsed(downloadElapsed)}`);
                    return;
                }

                showStatus(`下载成功（${downloadMethod}，耗时 ${formatElapsed(downloadElapsed)}），正在压缩...`);
                const convertedData = await convertImageFormat(tempFile);
                log('[转换] 图片格式转换完成:', convertedData.format);
                pushFileToInput(convertedData.file, convertedData.blob, convertedData.format.toUpperCase(),
                    `，下载：${downloadMethod}，${formatElapsed(downloadElapsed)}`);
            } catch (error) {
                warn('[错误] 下载或转换图片时发生错误:', error);
                showStatus(`下载图片失败：${error.message}`, true);
            }
        }

        function setupGlobalClickHandler(container) {
            document.addEventListener('click', function (event) {
                if (container.contains(event.target)) return;
                const btn = document.getElementById('coverUploadButton');
                if (btn && btn.contains(event.target)) return;
                container.style.display = 'none';
                isFormPinned = false;
            });
        }

        async function preloadLocalUpload() {
            if (formLoaded) return;
            const uploadFormContainer = formContainer.querySelector('#uploadFormContainer');
            uploadFormContainer.innerHTML = '加载中...';
            const uploadUrl = `${location.origin}/${parsedInfo.type}/${parsedInfo.id}/upload_img`;
            try {
                const res = await fetch(uploadUrl);
                const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
                const form = doc.querySelector("form[enctype='multipart/form-data']");
                if (form) {
                    form.id = 'coverUploadForm';
                    form.style.margin = '0';
                    form.style.padding = '0';
                    uploadFormContainer.innerHTML = form.outerHTML;
                    const insertedForm = document.getElementById('coverUploadForm');
                    setupFormForIframeSubmission(insertedForm);
                    const fileInput = document.querySelector("#coverUploadForm input[type='file']");
                    if (!fileInput) {
                        uploadFormContainer.innerHTML = `加载表单失败，<a href="${uploadUrl}" target="_blank">点此前往手动上传页</a>`;
                        return;
                    }
                    fileInput.addEventListener('change', async (e) => {
                        if (now() < skipChangeUntil) return;
                        const file = e.target.files[0];
                        if (!file) return;

                        // 【关键优化】本地文件已达标 → 跳过二次编码
                        if (canPassThrough(file)) {
                            log(`[处理] 本地文件 ${(file.size / 1024 / 1024).toFixed(2)}MB，已达标，跳过压缩`);
                            showStatus(`文件 ${(file.size / 1024 / 1024).toFixed(2)}MB，无需压缩`);
                            const previewUrl = URL.createObjectURL(file);
                            setPreviewImage(previewUrl, true);
                            const submitButton = document.querySelector("#coverUploadForm input[type='submit']");
                            if (submitButton) submitButton.style.display = 'block';
                            return;
                        }

                        try {
                            showStatus('正在处理图片...');
                            const convertedData = await convertImageFormat(file);
                            const dataTransfer = new DataTransfer();
                            dataTransfer.items.add(convertedData.file);
                            fileInput.files = dataTransfer.files;
                            const previewUrl = URL.createObjectURL(convertedData.blob);
                            setPreviewImage(previewUrl, true);
                            const submitButton = document.querySelector("#coverUploadForm input[type='submit']");
                            if (submitButton) submitButton.style.display = 'block';
                            showStatus(`图片已优化为 ${convertedData.format.toUpperCase()} 格式，点击提交按钮上传`);
                        } catch (error) {
                            showStatus(`处理图片失败: ${error.message}`, true);
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                                setPreviewImage(ev.target.result, false);
                                showStatus('使用原始格式，点击提交按钮上传');
                            };
                            reader.readAsDataURL(file);
                        }
                    });
                    formLoaded = true;
                } else {
                    uploadFormContainer.innerHTML = `无法加载上传表单，<a href="${uploadUrl}" target="_blank">点此前往手动上传页</a>`;
                    showStatus('无法加载上传表单', true);
                }
            } catch (e) {
                warn('加载上传表单失败:', e);
                uploadFormContainer.innerHTML = `加载失败，<a href="${uploadUrl}" target="_blank">点此前往手动上传页</a>`;
                showStatus('加载上传表单失败', true);
            }
        }

        const setupEventHandlers = () => {
            const urlInput = formContainer.querySelector('#imageUrlInput');
            const downloadButton = formContainer.querySelector('#downloadUrlButton');

            const showForm = () => {
                clearTimeout(hideTimeout);
                const btn = document.getElementById('coverUploadButton');
                if (!btn) return;
                const buttonRect = btn.getBoundingClientRect();
                const formWidth = formContainer.offsetWidth || 240;
                let left = buttonRect.left + window.scrollX - 180;
                left = Math.max(window.scrollX + 8, Math.min(left, window.scrollX + window.innerWidth - formWidth - 8));
                formContainer.style.top = `${buttonRect.bottom + window.scrollY + 5}px`;
                formContainer.style.left = `${left}px`;
                formContainer.style.display = 'block';
            };
            const hideForm = () => {
                if (isFormPinned) return;
                const previewContainer = formContainer.querySelector('#imagePreviewContainer');
                const statusMessage = formContainer.querySelector('#statusMessage');
                if (previewContainer.style.display === 'block' || statusMessage.style.display === 'block') return;
                hideTimeout = setTimeout(() => {
                    if (!formContainer.matches(':hover') && !isFormPinned) {
                        formContainer.style.display = 'none';
                    }
                }, 200);
            };

            let btnHovered = false;
            document.addEventListener('mouseover', (e) => {
                const btn = e.target.closest && e.target.closest('#coverUploadButton');
                if (btn && !btnHovered) {
                    btnHovered = true;
                    showForm();
                }
            });
            document.addEventListener('mouseout', (e) => {
                const btn = e.target.closest && e.target.closest('#coverUploadButton');
                if (!btn || !btnHovered) return;
                const next = e.relatedTarget;
                if (next && btn.contains(next)) return;
                btnHovered = false;
                if (!isFormPinned) hideForm();
            });
            document.addEventListener('click', (e) => {
                const btn = e.target.closest && e.target.closest('#coverUploadButton');
                if (btn) {
                    showForm();
                    isFormPinned = true;
                }
            });

            formContainer.addEventListener('mouseenter', () => clearTimeout(hideTimeout));
            formContainer.addEventListener('mouseleave', () => {
                if (!isFormPinned) hideForm();
            });

            urlInput.addEventListener('focus', () => {
                urlInput.style.borderColor = '#F4C7CC';
                urlInput.style.boxShadow = '0 0 5px rgba(244, 199, 204, 0.5)';
            });
            urlInput.addEventListener('blur', () => {
                urlInput.style.borderColor = '';
                urlInput.style.boxShadow = 'none';
            });

            downloadButton.addEventListener('click', () => {
                const imageUrl = urlInput.value.trim();
                if (imageUrl) {
                    log('[用户操作] 点击下载按钮，URL:', imageUrl);
                    downloadAndConvertImage(imageUrl);
                } else {
                    showStatus('请输入图片 URL', true);
                }
            });
            urlInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') downloadButton.click();
            });
        };

        setupGlobalClickHandler(formContainer);
        preloadLocalUpload();
        setupEventHandlers();
    }

    // 启动
    let styleInitialized = false;
    function tryInit() {
        if (!document.body || !document.head) return false;
        if (!styleInitialized) {
            updateGlobalDarkModeClass();
            startThemeSync();
            injectStyles();
            styleInitialized = true;
        }
        if (document.querySelector('#coverUploadButton')) return true;
        initCoverUpload();
        return !!document.querySelector('#coverUploadButton');
    }

    tryInit();
    const bootstrapMO = new MutationObserver(() => {
        if (tryInit()) {
            bootstrapMO.disconnect();
            log('[启动] 按钮已插入，观察者已断开');
        }
    });
    bootstrapMO.observe(document.documentElement || document, { childList: true, subtree: true });
    document.addEventListener('DOMContentLoaded', () => {
        if (tryInit()) bootstrapMO.disconnect();
    });

    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        Notification.requestPermission();
    }
})();