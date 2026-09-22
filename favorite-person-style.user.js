// ==UserScript==
// @name         Bangumi收藏人物样式改5×2
// @namespace    via-script
// @version      2.0
// @description  修改 Bangumi 用户页面右侧栏收藏人物显示布局，调整为5×2布局，不满5个时合并为一行（仅右侧栏生效）
// @author       minnmeichan
// @license      MIT
// @match        https://bgm.tv/user/*
// @match        https://bangumi.tv/user/*
// @match        https://chii.in/user/*
// @match        https://bangumi.vip/user/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function(){
    'use strict';

    let user = location.pathname.split('/')[2];
    if (!user) return;

    async function getDoc(url){
        try {
            let html = await fetch(url).then(r => r.text());
            return new DOMParser().parseFromString(html, 'text/html');
        } catch(e) { return null; }
    }

    let charPromise = getDoc('/user/'+user+'/mono/character');
    let personPromise = getDoc('/user/'+user+'/mono/person');

    let panel = null;
    let hider = null;
    let guard = null;
    let favRows = [];   // 我们创建的 fav-row 元素
    let newDls = [];    // 所有新卡片
    let title = null;

    function hideOld(){
        if (!panel) return;
        try {
            panel.querySelectorAll('dl.side_port').forEach(dl => {
                if (!dl.closest('.fav-row')) dl.style.display = 'none';
            });
        } catch(_) {}
    }

    function guardRestore(){
        if (!panel || !title) return;
        favRows.forEach(row => {
            if (!row.parentNode) {
                try { title.insertAdjacentElement('afterend', row); } catch(_) {}
            } else if (row.children.length < newDls.length) {
                newDls.forEach(d => {
                    if (!d.parentNode) {
                        try { row.appendChild(d); } catch(_) {}
                    }
                });
            }
        });
    }

    function findTitle(){
        return [...document.querySelectorAll('#columnB h2')]
            .find(e => e.innerText.includes('收藏的人物'));
    }

    let titleHandled = false;
    function checkTitle(){
        if (titleHandled) return;
        let t = findTitle();
        if (!t) return;
        titleHandled = true;
        title = t;
        panel = t.parentElement;
        if (!panel) return;
        hideOld();
        hider = new MutationObserver(hideOld);
        hider.observe(panel, { childList: true, subtree: true });
        onTitle();
    }

    const watcher = new MutationObserver(checkTitle);
    watcher.observe(document.documentElement, { childList: true, subtree: true });
    checkTitle();

    async function onTitle(){
        watcher.disconnect();

        let [charDoc, personDoc] = await Promise.all([charPromise, personPromise]);

        function restore(){
            if (hider) { hider.disconnect(); hider = null; }
            if (guard) { guard.disconnect(); guard = null; }
            try {
                panel.querySelectorAll('dl.side_port').forEach(x => x.style.display = '');
            } catch(_) {}
        }
        if (!charDoc || !personDoc) { restore(); return; }

        function getData(doc, type){
            let result = [];
            let seen = new Set();
            try {
                doc.querySelectorAll('a[href*="'+type+'"]').forEach(a => {
                    let href = a.href;
                    if (!href || seen.has(href)) return;
                    let name = a.innerText.trim();
                    if (!name) return;
                    let box = a.closest('li,dl,div');
                    let avatar = box ? box.querySelector('img') : null;
                    let img = avatar ? avatar.src.replace('/m/', '/g/') : '';
                    seen.add(href);
                    result.push({ href, name, img });
                });
            } catch(_) {}
            return result;
        }

        let chars = getData(charDoc, '/character/').slice(0, 5);
        let persons = getData(personDoc, '/person/').slice(0, 5);
        let all = [...chars, ...persons];

        if (all.length === 0) { restore(); return; }

        function createCard(item){
            let dl = document.createElement('dl');
            dl.className = 'side_port';
            dl.style.float = 'none';
            dl.style.display = 'block';
            try {
                let dt = document.createElement('dt');
                let a1 = document.createElement('a');
                try { a1.href = String(item.href || ''); } catch(_) {}
                a1.className = 'avatar';
                let span = document.createElement('span');
                span.className = 'avatarNeue avatarSize48 ll';
                try {
                    if (item.img) span.style.backgroundImage = 'url("' + item.img + '")';
                } catch(_) {}
                a1.appendChild(span);
                dt.appendChild(a1);

                let dd = document.createElement('dd');
                let a2 = document.createElement('a');
                try { a2.href = String(item.href || ''); } catch(_) {}
                a2.className = 'l';
                try { a2.innerText = String(item.name || ''); } catch(_) {}
                dd.appendChild(a2);

                dl.appendChild(dt);
                dl.appendChild(dd);
            } catch(_) {}
            return dl;
        }

        function makeRow(list){
            let row = document.createElement('div');
            row.className = 'fav-row';
            row.style.display = 'flex';
            row.style.flexWrap = 'nowrap';
            try {
                list.forEach(item => {
                    try {
                        let d = createCard(item);
                        row.appendChild(d);
                        newDls.push(d);
                    } catch(_) {}
                });
            } catch(_) {}
            favRows.push(row);
            return row;
        }

        let insertRef = title;
        function insertRow(row){
            try {
                insertRef.insertAdjacentElement('afterend', row);
                insertRef = row;
            } catch(e) {
                try { panel.appendChild(row); } catch(_) {}
            }
        }

        if (all.length <= 5) {
            insertRow(makeRow(all));
        } else {
            if (chars.length) insertRow(makeRow(chars));
            if (persons.length) insertRow(makeRow(persons));
        }

        hideOld();

        // hydration 重写 DOM 后恢复
        guard = new MutationObserver(guardRestore);
        guard.observe(panel, { childList: true, subtree: true });

        // 10 秒后停止守护（hydration 一般几秒内完成）
        setTimeout(() => {
            guardRestore();
            if (hider) { hider.disconnect(); hider = null; }
            if (guard) { guard.disconnect(); guard = null; }
            hideOld();
        }, 10000);
    }

})();