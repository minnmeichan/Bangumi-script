// ==UserScript==
// @name         Bangumi 封面上传与切换增强版（改）
// @namespace    https://github.com/minnmeichan
// @version      1.3.0
// @description  基于 Bios 的脚本修改。增强Bangumi的封面上传与切换功能，支持URL上传、本地上传、封面切换及透明投票按钮，多通道下载，自带暗黑模式
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
// @run-at       document-idle
// @license      MIT
// ==/UserScript==

(function() {
    "use strict";

    // ==================== 主题检测与监听 ====================
    function getCurrentBangumiTheme() {
        if (typeof document.cookie !== 'undefined') {
            const match = document.cookie.match(/(?:^|;)\s*chii_theme=([^;]+)/);
            if (match && match[1]) return match[1];
        }
        try {
            const localTheme = localStorage.getItem('chii_theme');
            if (localTheme) return localTheme;
        } catch (e) {}
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        }
        return 'light';
    }

    function isDarkTheme() {
        return getCurrentBangumiTheme() === 'dark';
    }

    function updateGlobalDarkModeClass() {
        if (isDarkTheme()) {
            document.body.classList.add('bgm-dark-mode');
        } else {
            document.body.classList.remove('bgm-dark-mode');
        }
    }

    let themeSyncTimer = null;
    function startThemeSync() {
        let lastTheme = getCurrentBangumiTheme();
        const checkTheme = () => {
            const newTheme = getCurrentBangumiTheme();
            if (newTheme !== lastTheme) {
                lastTheme = newTheme;
                updateGlobalDarkModeClass();
            }
        };
        if (themeSyncTimer) clearInterval(themeSyncTimer);
        themeSyncTimer = setInterval(checkTheme, 800);
        window.addEventListener('storage', (e) => {
            if (e.key === 'chii_theme') {
                const newTheme = e.newValue || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
                if (newTheme !== lastTheme) {
                    lastTheme = newTheme;
                    updateGlobalDarkModeClass();
                }
            }
        });
    }

    // ==================== 注入CSS样式（含暗黑模式） ====================
    function injectStyles() {
        if (document.querySelector('#bgm-cover-styles')) return;

        $('head').append(`
            <style id="bgm-cover-styles">
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

                #coverUploadForm {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }
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
                .cover-upload-modal:hover {
                    box-shadow: var(--shadow-hover);
                }

                .url-input-container {
                    display: flex;
                    margin-bottom: 10px;
                    height: 30px;
                }
                .image-url-input {
                    flex-grow: 1;
                    padding: 8px;
                    margin-right: 10px;
                    border: 1px solid var(--border-color);
                    border-radius: var(--border-radius);
                    outline: none;
                    transition: var(--transition-normal);
                    font-size: 14px;
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
                    background-color: color-mix(in srgb, var(--primary-color) 90%, black);
                    transform: translateY(-1px);
                    box-shadow: var(--shadow-hover);
                }

                .image-preview-container {
                    margin-top: 10px;
                    display: none;
                    text-align: center;
                }
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
                body.bgm-dark-mode .image-url-input:focus {
                    border-color: var(--primary-color) !important;
                }
                body.bgm-dark-mode .status-message {
                    color: #e0e0e0 !important;
                }
                body.bgm-dark-mode .status-message[style*="#ffeeee"] {
                    background-color: #3a1a1a !important;
                    color: #ffaaaa !important;
                }
                body.bgm-dark-mode .status-message[style*="#eeffee"] {
                    background-color: #1a3a1a !important;
                    color: #aaffaa !important;
                }
                body.bgm-dark-mode .image-preview {
                    border-color: #444 !important;
                }
                body.bgm-dark-mode .cover-arrow {
                    background: rgba(0, 0, 0, 0.85) !important;
                    color: #fff !important;
                }
                body.bgm-dark-mode .vote-button {
                    background: var(--primary-color) !important;
                }
                body.bgm-dark-mode .vote-button:hover {
                    background: var(--primary-hover) !important;
                }
            </style>
        `);
    }

    // ==================== 主逻辑 ====================
    async function initCoverUpload() {
        const pathname = location.pathname;
        const match = pathname.match(/^\/(subject|person|character)\/(\d+)$/);
        if (!match) return;

        const type = match[1];
        const id = match[2];
        const parsedInfo = { type, id };

        if (document.querySelector("#coverUploadButton")) return;

        const nav = document.querySelector(".subjectNav .navTabs") || document.querySelector(".navTabs");
        if (!nav) return;

        const isCharacterPage = (type === 'character');
        const uploadLi = document.createElement(isCharacterPage ? 'div' : 'li');
        uploadLi.id = "coverUploadButton";
        uploadLi.className = "upload-button";
        uploadLi.innerHTML = `<a href="javascript:void(0);" style="white-space: nowrap;">上传封面</a>`;

        if (!isCharacterPage) {
            uploadLi.style.float = "right";
            uploadLi.querySelector('a').style.padding = "10px 10px 9px";
        }

        const formContainer = document.createElement("div");
        formContainer.id = "coverUploadFormContainer";
        formContainer.classList.add("cover-upload-modal");
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
                <div id="statusMessage" class="status-message" style="display:none;"></div>
            </div>
        `;
        formContainer.style.position = "absolute";
        formContainer.style.zIndex = "9999";
        formContainer.style.display = "none";

        if (!isCharacterPage) {
            nav.appendChild(uploadLi);
        } else {
            uploadLi.style.float = "right";
            nav.appendChild(uploadLi);

            const loliHoverStyle = document.createElement('style');
            loliHoverStyle.id = 'bgm-cover-loli-hover';
            loliHoverStyle.textContent = `
                #coverUploadButton:hover,
                #coverUploadButton:hover a {
                    color: #f09199 !important;
                }
            `;
            document.head.appendChild(loliHoverStyle);

            // 角色页：把按钮搬进 luoli 评分容器，落在评分条左侧
            const moveIntoLuoli = () => {
                const loliBox = document.getElementById('lc-char-rating-container');
                if (!loliBox) return false;
                if (uploadLi.parentElement === loliBox) return true;

                const navRefLink = nav.querySelector('a');
                const navFontSize = navRefLink ? getComputedStyle(navRefLink).fontSize : '14px';
                const navFontFamily = navRefLink ? getComputedStyle(navRefLink).fontFamily : 'inherit';

                uploadLi.style.cssText = `
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

                const a = uploadLi.querySelector('a');
                if (a) {
                    a.style.cssText = `
                        color: inherit;
                        text-decoration: none;
                        padding: 0;
                        display: inline;
                        line-height: inherit;
                    `;
                }

                loliBox.insertBefore(uploadLi, loliBox.firstChild);
                return true;
            };

            // luoli.js 异步注入，轮询 + MutationObserver 双保险
            let loliAttempts = 0;
            const loliTimer = setInterval(() => {
                if (moveIntoLuoli() || ++loliAttempts > 20) clearInterval(loliTimer);
            }, 300);

            const loliMO = new MutationObserver(() => {
                if (moveIntoLuoli()) loliMO.disconnect();
            });
            loliMO.observe(document.body, { childList: true, subtree: true });
        }

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
                voteButton.style.background = 'color-mix(in srgb, var(--primary-color) 90%, black)';
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

        const updateImg = () => {
            const newImgSrc = imgList[imgIdx];
            imgEl.setAttribute('src', newImgSrc);
            coverLnk.setAttribute('href', newImgSrc.replace('/r/400/', '/'));
            const voteButton = coverDiv.querySelector('.vote-button');
            if (voteButton) voteButton.remove();
            if (newImgSrc !== currImgSrc && voteLinks[imgIdx]) {
                const voteBtn = createVoteButton();
                voteBtn.addEventListener('click', () => {
                    const voteUrl = voteLinks[imgIdx];
                    const fullVoteUrl = voteUrl.startsWith('http') ? voteUrl : `https://${window.location.host}${voteUrl.startsWith('/') ? '' : '/'}${voteUrl}`;
                    showStatus('正在提交投票...');
                    const xhr = new XMLHttpRequest();
                    xhr.open('GET', fullVoteUrl, true);
                    xhr.withCredentials = true;
                    xhr.setRequestHeader('Accept', 'text/html');
                    xhr.setRequestHeader('Referer', window.location.href);
                    xhr.onload = function() {
                        if (xhr.status >= 200 && xhr.status < 300) {
                            alert('投票成功！页面将在3秒后刷新...');
                            showBrowserNotification("投票成功", "封面投票成功，页面即将刷新。");
                            setTimeout(() => window.location.reload(), 3000);
                        } else {
                            showStatus(`投票失败(${xhr.status})，请手动投票`, true);
                            showBrowserNotification("投票失败", `投票遇到问题 (${xhr.status})，请尝试手动投票。`);
                        }
                    };
                    xhr.onerror = function() {
                        alert('网络错误，投票失败，请手动投票！');
                        showBrowserNotification("投票失败", "网络错误导致投票失败，请尝试手动投票。");
                    };
                    xhr.send();
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
                const imgs = Array.from($html.querySelectorAll('.photoList li a.grid img')).map(img => img.getAttribute('src'));
                voteLinks = Array.from($html.querySelectorAll('.photoList li a[href*="/vote/cover/"]')).map(a => a.getAttribute('href'));
                imgList = [...new Set(imgs)];
                imgIdx = Math.max(0, imgList.indexOf(currImgSrc));
                if (imgList.length > 1 && coverDiv && imgEl && coverLnk) {
                    updateImg();
                }
            });
        };
        fetchImgList();

        let formLoaded = false;
        let hideTimeout = null;
        let isFormPinned = false;
        let skipNextChange = false;    // 脚本自己触发的 change 跳过一遍监听

        function showStatus(message, isError = false) {
            const statusDiv = document.getElementById('statusMessage');
            statusDiv.textContent = message;
            statusDiv.style.display = 'block';
            statusDiv.style.backgroundColor = isError ? '#ffeeee' : '#eeffee';
            statusDiv.style.color = isError ? '#cc0000' : '#007700';
            statusDiv.style.border = `1px solid ${isError ? '#cc0000' : '#007700'}`;
            console.log(`[状态] ${message}`);
        }

        function showBrowserNotification(title, body) {
            if (Notification.permission === "granted") {
                new Notification(title, { body: body });
            } else if (Notification.permission !== "denied") {
                Notification.requestPermission().then(permission => {
                    if (permission === "granted") {
                        new Notification(title, { body: body });
                    } else {
                        showStatus(body || title, title.includes("失败"));
                    }
                });
            } else {
                showStatus(body || title, title.includes("失败"));
            }
        }

        function createHiddenIframe() {
            const existingIframe = document.getElementById('hiddenUploadFrame');
            if (existingIframe) return existingIframe;
            const iframe = document.createElement('iframe');
            iframe.id = 'hiddenUploadFrame';
            iframe.name = 'hiddenUploadFrame';
            iframe.style.display = 'none';
            document.body.appendChild(iframe);
            return iframe;
        }

        // 从 iframe 结果里找投票链接，找到则自动投票
        function processUploadResult(iframe) {
            return new Promise((resolve, reject) => {
                iframe.onload = function() {
                    try {
                        const iframeDocument = iframe.contentDocument || iframe.contentWindow.document;
                        const allVoteLinks = iframeDocument.querySelectorAll('a[href*="/vote/cover/"]');
                        const voteLink = allVoteLinks.length > 0 ? allVoteLinks[allVoteLinks.length - 1] : null;
                        if (voteLink) {
                            const href = voteLink.getAttribute('href');
                            const voteUrl = href.startsWith('http') ? href : `https://${window.location.host}${href.startsWith('/') ? '' : '/'}${href}`;
                            showStatus('封面上传成功，正在投票...');
                            const xhr = new XMLHttpRequest();
                            xhr.open('GET', voteUrl, true);
                            xhr.withCredentials = true;
                            xhr.setRequestHeader('Accept', 'text/html');
                            xhr.setRequestHeader('Referer', window.location.href);
                            xhr.onload = function() {
                                if (xhr.status >= 200 && xhr.status < 300) {
                                    showStatus('投票成功！页面将在3秒后刷新...');
                                    showBrowserNotification("投票成功", "封面上传后的自动投票已成功，页面即将刷新。");
                                    setTimeout(() => window.location.reload(), 3000);
                                    resolve(true);
                                } else {
                                    showStatus('封面上传成功，但投票失败。3秒后跳转到手动投票页面...', true);
                                    showBrowserNotification("投票失败", "封面上传成功，但自动投票失败。将跳转到手动投票页面。");
                                    setTimeout(() => window.location.href = `${window.location.href.split('?')[0]}/upload_img`, 3000);
                                    reject(new Error(`投票请求失败，状态 ${xhr.status}`));
                                }
                            };
                            xhr.onerror = function() {
                                showStatus('封面上传成功，但投票失败。3秒后跳转到手动投票页面...', true);
                                showBrowserNotification("投票失败", "封面上传成功，但网络错误导致自动投票失败。将跳转到手动投票页面。");
                                setTimeout(() => window.location.href = `${window.location.href.split('?')[0]}/upload_img`, 3000);
                                reject(new Error('XHR请求错误'));
                            };
                            xhr.send();
                        } else {
                            const errorMsgEl = iframeDocument.querySelector('.error, .errorMessage, [class*="error"]');
                            if (errorMsgEl) {
                                showStatus(`上传失败: ${errorMsgEl.textContent}，3秒后跳转到手动上传页面...`, true);
                                showBrowserNotification("上传失败", `${errorMsgEl.textContent} 将跳转到手动上传页面。`);
                                setTimeout(() => window.location.href = `${window.location.href.split('?')[0]}/upload_img`, 3000);
                                reject(new Error(errorMsgEl.textContent));
                            } else {
                                showStatus('封面似乎已上传成功，但未找到投票链接。3秒后跳转到手动处理页面...', true);
                                showBrowserNotification("操作提醒", "封面已上传，但未找到投票链接。将跳转到手动处理页面。");
                                setTimeout(() => window.location.href = `${window.location.href.split('?')[0]}/upload_img`, 3000);
                                reject(new Error('未找到投票链接'));
                            }
                        }
                    } catch (error) {
                        showStatus('处理上传结果时出错，3秒后跳转到手动上传页面...', true);
                        showBrowserNotification("处理错误", "处理上传结果时出错，将跳转到手动上传页面。");
                        setTimeout(() => window.location.href = `${window.location.href.split('?')[0]}/upload_img`, 3000);
                        reject(error);
                    }
                };
                iframe.onerror = function(error) {
                    showStatus('上传请求失败，3秒后跳转到手动上传页面...', true);
                    showBrowserNotification("上传失败", "上传请求失败，将跳转到手动上传页面。");
                    setTimeout(() => window.location.href = `${window.location.href.split('?')[0]}/upload_img`, 3000);
                    reject(new Error('上传请求失败'));
                };
            });
        }

        function setupFormForIframeSubmission(form) {
            const iframe = createHiddenIframe();
            form.target = 'hiddenUploadFrame';
            form.addEventListener('submit', function() {
                showStatus('正在上传封面...');
                processUploadResult(iframe).catch(error => console.error('处理上传结果失败:', error));
            });
        }

        // 压缩 + 转格式：透明保留 PNG，否则 JPEG 并逐级降质直到 < 3MB
        async function convertImageFormat(file) {
            const MAX_SIZE = 3 * 1024 * 1024;

            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const img = new Image();
                    img.onload = async () => {
                        const canvas = document.createElement('canvas');
                        canvas.width = img.width;
                        canvas.height = img.height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0);

                        let hasTransparency = false;
                        try {
                            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                            const pixels = imageData.data;
                            for (let i = 3; i < pixels.length; i += 4) {
                                if (pixels[i] < 255) {
                                    hasTransparency = true;
                                    break;
                                }
                            }
                        } catch (e) {
                            console.warn("无法检查透明度，默认视为无透明度", e);
                        }

                        const getBlob = (format, q) => {
                            return new Promise(r => canvas.toBlob(r, format, q));
                        };

                        let currentFormat = hasTransparency ? 'image/png' : 'image/jpeg';
                        let quality = 0.92;

                        if (currentFormat === 'image/jpeg') {
                            ctx.globalCompositeOperation = 'destination-over';
                            ctx.fillStyle = '#FFFFFF';
                            ctx.fillRect(0, 0, canvas.width, canvas.height);
                            ctx.globalCompositeOperation = 'source-over';
                        }

                        console.log(`[压缩] 初始格式: ${currentFormat}`);
                        let blob = await getBlob(currentFormat, quality);

                        while (blob.size > MAX_SIZE) {
                            console.log(`[压缩] 当前大小: ${(blob.size / 1024 / 1024).toFixed(2)}MB (超过限制 3MB)`);
                            if (currentFormat === 'image/png') {
                                console.log('[压缩] PNG 过大，切换为 JPEG 格式');
                                currentFormat = 'image/jpeg';
                                ctx.globalCompositeOperation = 'destination-over';
                                ctx.fillStyle = '#FFFFFF';
                                ctx.fillRect(0, 0, canvas.width, canvas.height);
                                ctx.globalCompositeOperation = 'source-over';
                                quality = 0.90;
                            } else {
                                quality -= 0.1;
                                console.log(`[压缩] 降低 JPEG 质量至: ${quality.toFixed(1)}`);
                                if (quality < 0.1) break;
                            }
                            blob = await getBlob(currentFormat, quality);
                        }

                        console.log(`[压缩] 最终大小: ${(blob.size / 1024 / 1024).toFixed(2)}MB, 格式: ${currentFormat}`);
                        if (!blob) return reject(new Error('转换图片失败'));
                        const ext = currentFormat === 'image/png' ? 'png' : 'jpg';
                        const newFileName = file.name.replace(/\.[^/.]+$/, "") + '.' + ext;
                        const convertedFile = new File([blob], newFileName, { type: currentFormat });

                        resolve({
                            file: convertedFile,
                            dataURL: canvas.toDataURL(currentFormat, quality),
                            format: ext
                        });
                    };
                    img.onerror = () => reject(new Error('加载图片失败'));
                    img.src = e.target.result;
                };
                reader.onerror = () => reject(new Error('读取文件失败'));
                reader.readAsDataURL(file);
            });
        }

        // ==================== 下载相关 ====================

        // Image + canvas 读成 File（需 CORS 通过）；返回 { file, elapsed }
        const loadImageAsFile = (url, timeoutMs = 12000) => {
            return new Promise((resolve, reject) => {
                const startedAt = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
                const img = new Image();
                img.crossOrigin = 'anonymous';
                const timer = setTimeout(() => { img.src = ''; reject(new Error('超时')); }, timeoutMs);
                img.onload = () => {
                    clearTimeout(timer);
                    try {
                        const canvas = document.createElement('canvas');
                        canvas.width = img.naturalWidth || img.width;
                        canvas.height = img.naturalHeight || img.height;
                        canvas.getContext('2d').drawImage(img, 0, 0);
                        canvas.toBlob((blob) => {
                            if (!blob) return reject(new Error('toBlob 失败'));
                            const fileName = url.split('/').pop()?.split('?')[0] || 'image.jpg';
                            const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
                            resolve({
                                file: new File([blob], fileName, { type: blob.type || 'image/jpeg' }),
                                elapsed: now - startedAt
                            });
                        }, 'image/jpeg', 0.92);
                    } catch (e) {
                        reject(new Error('canvas 读不了（CORS 被拦）'));
                    }
                };
                img.onerror = () => { clearTimeout(timer); reject(new Error('加载失败')); };
                img.src = url;
            });
        };

        // 多代理候选链；返回 { file, method, elapsed }
        const downloadViaImageObject = async (originalUrl) => {
            const noScheme = originalUrl.replace(/^https?:\/\//, '');
            const candidates = [
                { name: '直连', url: originalUrl },
                { name: 'yumus', url: `https://proxy.yumus.cn/${originalUrl}` },
                { name: 'wsrv', url: `https://wsrv.nl/?url=${encodeURIComponent(noScheme)}` },
                { name: 'weserv', url: `https://images.weserv.nl/?url=${encodeURIComponent(noScheme)}` },
                { name: 'allorigins', url: `https://api.allorigins.win/raw?url=${encodeURIComponent(originalUrl)}` },
                { name: 'corsproxy', url: `https://corsproxy.io/?url=${encodeURIComponent(originalUrl)}` },
            ];
            const results = [];
            for (const c of candidates) {
                try {
                    console.log(`[下载] 尝试 ${c.name}`);
                    const r = await loadImageAsFile(c.url);
                    console.log(`[下载] ${c.name} 成功，耗时 ${Math.round(r.elapsed)}ms`);
                    return { file: r.file, method: c.name, elapsed: r.elapsed };
                } catch (e) {
                    console.log(`[下载] ${c.name} 失败: ${e.message}`);
                    results.push(`${c.name}→${e.message}`);
                }
            }
            throw new Error('全部失败：' + results.join(' | '));
        };

        // GM 请求；返回 { file, method, elapsed }
        const downloadViaGM = (url) => {
            return new Promise((resolve, reject) => {
                if (typeof GM_xmlhttpRequest !== 'function') {
                    return reject(new Error('GM 不可用'));
                }
                const startedAt = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: url,
                    responseType: 'blob',
                    timeout: 12000,
                    onload: function(response) {
                        if (response.status >= 200 && response.status < 300) {
                            const blob = response.response;
                            const fileName = url.split('/').pop()?.split('?')[0] || 'image.jpg';
                            const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
                            resolve({
                                file: new File([blob], fileName, { type: blob.type || 'image/jpeg' }),
                                method: 'GM',
                                elapsed: now - startedAt
                            });
                        } else {
                            reject(new Error(`HTTP ${response.status}`));
                        }
                    },
                    onerror: function() { reject(new Error('GM 请求失败')); },
                    ontimeout: function() { reject(new Error('GM 超时')); }
                });
            });
        };

        const formatElapsed = (ms) => {
            if (ms < 1000) return `${Math.round(ms)}ms`;
            return `${(ms / 1000).toFixed(2)}s`;
        };

        async function downloadAndConvertImage(imageUrl) {
            try {
                let actualImageUrl = imageUrl;
                if (imageUrl.includes('google.com/imgres')) {
                    const urlParams = new URL(imageUrl).searchParams;
                    actualImageUrl = urlParams.get('imgurl') || imageUrl;
                }

                console.log('[下载] 开始下载图片:', actualImageUrl);
                showStatus('正在下载图片...');

                let tempFile = null;
                let downloadMethod = '';
                let downloadElapsed = 0;

                // 优先 GM
                try {
                    const r = await downloadViaGM(actualImageUrl);
                    tempFile = r.file;
                    downloadMethod = r.method;
                    downloadElapsed = r.elapsed;
                    console.log('[下载] GM 成功');
                } catch (e) {
                    console.log('[下载] GM 不可用/失败:', e.message);
                }

                // 兜底：Image + 多代理链
                if (!tempFile) {
                    try {
                        const r = await downloadViaImageObject(actualImageUrl);
                        tempFile = r.file;
                        downloadMethod = r.method;
                        downloadElapsed = r.elapsed;
                        console.log('[下载] Image+代理链 成功');
                    } catch (e) {
                        console.error('[下载] 全部失败:', e.message);
                        showStatus(`下载失败：${e.message}`, true);
                        return;
                    }
                }

                showStatus(`下载成功（${downloadMethod}，耗时 ${formatElapsed(downloadElapsed)}），正在处理...`);

                const convertedData = await convertImageFormat(tempFile);
                console.log('[转换] 图片格式转换完成:', convertedData.format);

                const previewContainer = document.getElementById("imagePreviewContainer");
                const previewImage = document.getElementById("imagePreview");
                if (previewContainer && previewImage) {
                    previewImage.src = convertedData.dataURL;
                    previewContainer.style.display = "block";
                    console.log('[预览] 图片预览已显示');
                } else {
                    console.error('[预览] 找不到预览容器元素');
                }

                const fileInput = document.querySelector("#coverUploadForm input[type='file']");
                if (fileInput) {
                    const dataTransfer = new DataTransfer();
                    dataTransfer.items.add(convertedData.file);
                    fileInput.files = dataTransfer.files;
                    // 标记：接下来这一下 change 是脚本自己触发的，别让监听器重复处理
                    skipNextChange = true;
                    const event = new Event('change', { bubbles: true });
                    fileInput.dispatchEvent(event);
                    const submitButton = document.querySelector("#coverUploadForm input[type='submit']");
                    if (submitButton) submitButton.style.display = 'block';
                    showStatus(`已优化为 ${convertedData.format.toUpperCase()} 格式（下载：${downloadMethod}，${formatElapsed(downloadElapsed)}），点击提交上传`);
                    console.log('[完成] 文件已设置到input，可以提交');
                } else {
                    console.error('[错误] 找不到文件上传输入框');
                    showStatus('未找到文件上传输入框', true);
                }
            } catch (error) {
                console.error('[错误] 下载或转换图片时发生错误:', error);
                showStatus(`下载图片失败：${error.message}`, true);
            }
        }

        function setupGlobalClickHandler(container, trigger) {
            document.addEventListener('click', function(event) {
                if (!container.contains(event.target) && !trigger.contains(event.target)) {
                    container.style.display = "none";
                    isFormPinned = false;
                }
            });
        }

        async function preloadLocalUpload() {
            if (formLoaded) return;
            const uploadFormContainer = formContainer.querySelector("#uploadFormContainer");
            uploadFormContainer.innerHTML = "加载中...";
            try {
                const uploadUrl = `https://${window.location.host}/${parsedInfo.type}/${parsedInfo.id}/upload_img`;
                const res = await fetch(uploadUrl);
                const doc = new DOMParser().parseFromString(await res.text(), "text/html");
                const form = doc.querySelector("form[enctype='multipart/form-data']");
                if (form) {
                    form.id = "coverUploadForm";
                    form.style.margin = "0";
                    form.style.padding = "0";
                    uploadFormContainer.innerHTML = form.outerHTML;
                    const insertedForm = document.getElementById("coverUploadForm");
                    setupFormForIframeSubmission(insertedForm);
                    const fileInput = document.querySelector("#coverUploadForm input[type='file']");
                    fileInput.addEventListener('change', async (e) => {
                        // 跳过脚本自己触发的 change（防止重复压缩、重复提示）
                        if (skipNextChange) {
                            skipNextChange = false;
                            return;
                        }
                        const file = e.target.files[0];
                        if (file) {
                            try {
                                showStatus('正在处理图片...');
                                const convertedData = await convertImageFormat(file);
                                const dataTransfer = new DataTransfer();
                                dataTransfer.items.add(convertedData.file);
                                fileInput.files = dataTransfer.files;
                                const previewContainer = formContainer.querySelector("#imagePreviewContainer");
                                const previewImage = formContainer.querySelector("#imagePreview");
                                previewImage.src = convertedData.dataURL;
                                previewContainer.style.display = "block";
                                const submitButton = document.querySelector("#coverUploadForm input[type='submit']");
                                if (submitButton) submitButton.style.display = 'block';
                                showStatus(`图片已优化为 ${convertedData.format.toUpperCase()} 格式，点击提交按钮上传`);
                            } catch (error) {
                                showStatus(`处理图片失败: ${error.message}`, true);
                                const reader = new FileReader();
                                reader.onload = (ev) => {
                                    const previewContainer = formContainer.querySelector("#imagePreviewContainer");
                                    const previewImage = formContainer.querySelector("#imagePreview");
                                    previewImage.src = ev.target.result;
                                    previewContainer.style.display = "block";
                                    showStatus('使用原始格式，点击提交按钮上传');
                                };
                                reader.readAsDataURL(file);
                            }
                        }
                    });
                    formLoaded = true;
                } else {
                    uploadFormContainer.innerHTML = "无法加载上传表单";
                    showStatus("无法加载上传表单", true);
                }
            } catch (e) {
                uploadFormContainer.innerHTML = "加载失败";
                showStatus("加载上传表单失败", true);
            }
        }

        const setupEventHandlers = () => {
            const urlInput = formContainer.querySelector("#imageUrlInput");
            const downloadButton = formContainer.querySelector("#downloadUrlButton");
            const showForm = () => {
                clearTimeout(hideTimeout);
                const buttonRect = uploadLi.getBoundingClientRect();
                formContainer.style.top = `${buttonRect.bottom + window.scrollY + 5}px`;
                formContainer.style.left = `${buttonRect.left + window.scrollX - 180}px`;
                formContainer.style.display = "block";
            };
            const hideForm = () => {
                if (isFormPinned) return;
                const previewContainer = formContainer.querySelector("#imagePreviewContainer");
                const statusMessage = formContainer.querySelector("#statusMessage");
                if (previewContainer.style.display === "block" || statusMessage.style.display === "block") return;
                hideTimeout = setTimeout(() => {
                    if (!formContainer.matches(":hover") && !isFormPinned) {
                        formContainer.style.display = "none";
                    }
                }, 200);
            };
            uploadLi.addEventListener("click", () => {
                showForm();
                isFormPinned = true;
            });
            uploadLi.addEventListener("mouseenter", showForm);
            uploadLi.addEventListener("mouseleave", () => {
                if (!isFormPinned) hideForm();
            });
            formContainer.addEventListener("mouseenter", () => clearTimeout(hideTimeout));
            formContainer.addEventListener("mouseleave", () => {
                if (!isFormPinned) hideForm();
            });
            urlInput.addEventListener('focus', () => {
                urlInput.style.borderColor = '#F4C7CC';
                urlInput.style.boxShadow = '0 0 5px rgba(244, 199, 204, 0.5)';
            });
            urlInput.addEventListener('blur', () => {
                urlInput.style.borderColor = '#ddd';
                urlInput.style.boxShadow = 'none';
            });
            downloadButton.addEventListener('click', () => {
                const imageUrl = urlInput.value.trim();
                if (imageUrl) {
                    console.log('[用户操作] 点击下载按钮，URL:', imageUrl);
                    downloadAndConvertImage(imageUrl);
                } else {
                    showStatus('请输入图片 URL', true);
                }
            });
            urlInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') downloadButton.click();
            });
        };

        setupGlobalClickHandler(formContainer, uploadLi);
        preloadLocalUpload();
        setupEventHandlers();
    }

    // ==================== 启动 ====================
    const observer = new MutationObserver(() => {
        if (!document.querySelector("#coverUploadButton")) {
            initCoverUpload();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    if (Notification.permission === "default") {
        Notification.requestPermission();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            updateGlobalDarkModeClass();
            startThemeSync();
            injectStyles();
            initCoverUpload();
        });
    } else {
        updateGlobalDarkModeClass();
        startThemeSync();
        injectStyles();
        initCoverUpload();
    }
})();