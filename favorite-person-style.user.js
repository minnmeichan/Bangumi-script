// ==UserScript==
// @name         收藏人物样式改5×2
// @namespace    via-script
// @version      1.2
// @description  修改 Bangumi 用户页面收藏人物显示布局，调整为 5×2 布局
// @author       minnmeichan
// @license      MIT
// @match        https://bgm.tv/user/*
// @match        https://bangumi.tv/user/*
// @match        https://chii.in/user/*
// @match        https://bgmmi.anibt.net/user/*
// @match        https://bangumi.lol/user/*
// @match        https://bangumi.rdd.moe/user/*
// @grant        none
// ==/UserScript==

(function(){

'use strict';


setTimeout(async function(){


let user =
location.pathname.split('/')[2];

if(!user)return;


let title =
[...document.querySelectorAll('h2')]
.find(e =>
e.innerText.includes('我收藏的人物')
);


if(!title)return;


let panel =
title.parentElement;



let oldCards =
[...panel.querySelectorAll('dl.side_port')];



async function getDoc(url){

let html =
await fetch(url)
.then(r=>r.text());

return new DOMParser()
.parseFromString(html,'text/html');

}



let charDoc =
await getDoc(
'/user/'+user+'/mono/character'
);



let personDoc =
await getDoc(
'/user/'+user+'/mono/person'
);



// 读取数据

function getData(doc,type){


let result=[];


doc.querySelectorAll(
'a[href*="'+type+'"]'
)
.forEach(a=>{


let href =
a.href;


let name =
a.innerText.trim();


if(!name)return;



let box =
a.closest('li,dl,div');



let avatar =
box.querySelector('img');



let img='';


if(avatar){

// 使用 Bangumi 原收藏页面的 g 图
img =
avatar.src.replace('/m/', '/g/');

}



// 去重

if(
!result.some(x=>x.href===href)
){

result.push({

href,
name,
img

});

}


});


return result;

}



let chars =
getData(charDoc,'/character/')
.slice(0,5);



let persons =
getData(personDoc,'/person/')
.slice(0,5);



// 删除原内容

oldCards.forEach(x=>x.remove());



// 创建卡片

function createCard(item){


let dl =
document.createElement('dl');


dl.className =
'side_port';



let dt =
document.createElement('dt');


let a1 =
document.createElement('a');


a1.href =
item.href;


a1.className =
'avatar';



let span =
document.createElement('span');


span.className =
'avatarNeue avatarSize48 ll';



if(item.img){

span.style.backgroundImage =
'url("'+item.img+'")';

}



a1.appendChild(span);

dt.appendChild(a1);



let dd =
document.createElement('dd');


let a2 =
document.createElement('a');


a2.href =
item.href;


a2.className =
'l';


a2.innerText =
item.name;



dd.appendChild(a2);



dl.appendChild(dt);

dl.appendChild(dd);



return dl;

}



// 创建行

function createRow(list){


let row =
document.createElement('div');


list.forEach(item=>{


row.appendChild(
createCard(item)
);


});


return row;

}



panel.appendChild(
createRow(chars)
);



panel.appendChild(
createRow(persons)
);



},3000);


})();