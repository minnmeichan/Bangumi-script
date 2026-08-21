// ==UserScript==
// @name         收藏人物样式改5×2
// @namespace    via-script
// @version      1.7
// @description  修改 Bangumi 用户页面右侧栏收藏人物显示布局，调整为5×2布局（仅右侧栏生效）
// @author       minnmeichan
// @license      MIT
// @match        https://bgm.tv/user/*
// @match        https://bangumi.tv/user/*
// @match        https://chii.in/user/*
// @match        https://bangumi.pro/user/*
// @grant        none
// ==/UserScript==

(function(){
    'use strict';

    let user = location.pathname.split('/')[2];
    if(!user) return;

    // ===== 提前发起请求（不等标题） =====
    async function getDoc(url){
        try {
            let html = await fetch(url).then(r => r.text());
            return new DOMParser().parseFromString(html, 'text/html');
        } catch(e) {
            console.error('fetch失败:', url, e);
            return null;
        }
    }

    let charPromise = getDoc('/user/'+user+'/mono/character');
    let personPromise = getDoc('/user/'+user+'/mono/person');

    // ===== 等待右侧栏标题出现 =====
    function waitForTitle(callback) {
        // 只匹配右侧栏 #columnB 内的 h2
        let title = [...document.querySelectorAll('h2')]
            .find(e => e.innerText.includes('收藏的人物') && e.closest('#columnB'));
        if (title) {
            callback(title);
            return;
        }
        const observer = new MutationObserver(() => {
            let title = [...document.querySelectorAll('h2')]
                .find(e => e.innerText.includes('收藏的人物') && e.closest('#columnB'));
            if (title) {
                observer.disconnect();
                callback(title);
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    waitForTitle(async function(title) {
        let panel = title.parentElement;
        if (panel.offsetParent === null) return;

        // 保留旧卡片（先不删）
        let oldCards = [...panel.querySelectorAll('dl.side_port')];

        // ===== 等待两个请求完成（可能已经完成） =====
        let [charDoc, personDoc] = await Promise.all([charPromise, personPromise]);
        if (!charDoc || !personDoc) return;

        // 提取数据（同之前）
        function getData(doc, type){
            let result = [];
            doc.querySelectorAll('a[href*="'+type+'"]').forEach(a => {
                let href = a.href;
                let name = a.innerText.trim();
                if(!name) return;
                let box = a.closest('li,dl,div');
                let avatar = box ? box.querySelector('img') : null;
                let img = '';
                if(avatar){
                    img = avatar.src.replace('/m/', '/g/');
                }
                if(!result.some(x => x.href === href)){
                    result.push({ href, name, img });
                }
            });
            return result;
        }

        let chars = getData(charDoc, '/character/').slice(0, 5);
        let persons = getData(personDoc, '/person/').slice(0, 5);

        function createCard(item){
            let dl = document.createElement('dl');
            dl.className = 'side_port';
            dl.style.float = 'none';

            let dt = document.createElement('dt');
            let a1 = document.createElement('a');
            a1.href = item.href;
            a1.className = 'avatar';
            let span = document.createElement('span');
            span.className = 'avatarNeue avatarSize48 ll';
            if(item.img){
                span.style.backgroundImage = 'url("'+item.img+'")';
            }
            a1.appendChild(span);
            dt.appendChild(a1);

            let dd = document.createElement('dd');
            let a2 = document.createElement('a');
            a2.href = item.href;
            a2.className = 'l';
            a2.innerText = item.name;
            dd.appendChild(a2);

            dl.appendChild(dt);
            dl.appendChild(dd);
            return dl;
        }

        function createRow(list){
            let row = document.createElement('div');
            row.style.display = 'flex';
            row.style.flexWrap = 'nowrap';
            list.forEach(item => {
                row.appendChild(createCard(item));
            });
            return row;
        }

        // 先构建新卡片
        let newRow1 = createRow(chars);
        let newRow2 = createRow(persons);

        // 再一次性替换（无闪烁）
        oldCards.forEach(x => x.remove());
        panel.appendChild(newRow1);
        panel.appendChild(newRow2);
    });

})();