// ==UserScript==
// @name         收藏人物样式改5×2
// @namespace    via-script
// @version      1.4
// @description  修改 Bangumi 用户页面收藏人物显示布局，调整为5×2布局（仅在右侧栏生效）
// @author       minnmeichan
// @license      MIT
// @match        https://bgm.tv/user/*
// @match        https://bangumi.tv/user/*
// @match        https://chii.in/user/*
// @match        https://bangumi.lol/user/*
// @grant        none
// ==/UserScript==

(function(){
    'use strict';

    setTimeout(async function(){
        let user = location.pathname.split('/')[2];
        if(!user) return;

        let title = [...document.querySelectorAll('h2')]
            .find(e => e.innerText.includes('收藏的人物'));
        if(!title) return;

        let panel = title.parentElement;

        // ===== 核心改动：判断位置，如果在左侧则直接失效退出 =====
        const rect = panel.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        if (centerX < window.innerWidth / 2) {
            return; // 在左侧，脚本静默退出，不动页面
        }
        // =====================================================

        // 以下是原有逻辑，只有右侧栏才会执行到这里
        let oldCards = [...panel.querySelectorAll('dl.side_port')];

        async function getDoc(url){
            let html = await fetch(url).then(r=>r.text());
            return new DOMParser().parseFromString(html,'text/html');
        }

        let charDoc = await getDoc('/user/'+user+'/mono/character');
        let personDoc = await getDoc('/user/'+user+'/mono/person');

        function getData(doc,type){
            let result=[];
            doc.querySelectorAll('a[href*="'+type+'"]').forEach(a=>{
                let href = a.href;
                let name = a.innerText.trim();
                if(!name) return;
                let box = a.closest('li,dl,div');
                let avatar = box ? box.querySelector('img') : null;
                let img='';
                if(avatar){
                    img = avatar.src.replace('/m/', '/g/');
                }
                if(!result.some(x=>x.href===href)){
                    result.push({ href, name, img });
                }
            });
            return result;
        }

        let chars = getData(charDoc,'/character/').slice(0,5);
        let persons = getData(personDoc,'/person/').slice(0,5);

        oldCards.forEach(x=>x.remove());

        function createCard(item){
            let dl = document.createElement('dl');
            dl.className = 'side_port';
            dl.style.float='none';

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
            row.style.display='flex';
            row.style.flexWrap='nowrap';
            list.forEach(item=>{
                row.appendChild(createCard(item));
            });
            return row;
        }

        panel.appendChild(createRow(chars));
        panel.appendChild(createRow(persons));

    }, 3000);

})();