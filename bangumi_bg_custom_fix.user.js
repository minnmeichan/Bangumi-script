// ==UserScript==
// @name         bangumi_bg_custom_fix.user
// @name:zh-CN   Bangumi 自定义背景与毛玻璃（修复版）
// @namespace    https://bgm.tv/
// @version      1.1.0
// @description  对 qbh 的bangumi_bg_custom.user脚本进行bug修复。自定义 bgm.tv 全站背景图片/颜色/渐变，可调透明度实现毛玻璃效果。适配油猴和超合金组件
// @description:zh-CN 自定义 bgm.tv 全站背景+毛玻璃，支持油猴和超合金组件
// @author       minnmeichan (fixed on qbh's bangumi_bg_custom.user)
// @match      https://bgm.tv/*
// @match      https://bangumi.tv/*
// @match      https://chii.in/*
// @match      https://bangumi.pro/*
// @run-at       document-end
// ==/UserScript==

(() => {
  'use strict';

  // ==================== 配置持久化 ====================
  const STORAGE_KEY_BG = 'bangumi-bg-custom';
  const STORAGE_KEY_OPACITY = 'bangumi-bg-opacity';
  const STORAGE_KEY_MODE = 'bangumi-bg-mode';
  const STORAGE_KEY_RANDOM_CAT = 'bangumi-bg-random-cat';
  const STORAGE_KEY_HISTORY = 'bangumi-bg-history';
  const DEFAULT_BG = 'linear-gradient(to right, rgb(250, 187, 187), rgb(238, 130, 146))';
  const DEFAULT_OPACITY = 1;
  const MAX_HISTORY = 20;

  function getBg() { return localStorage.getItem(STORAGE_KEY_BG) || DEFAULT_BG; }
  function getOpacity() { const v = parseFloat(localStorage.getItem(STORAGE_KEY_OPACITY)); return isNaN(v) || v < 0 ? DEFAULT_OPACITY : v; }
  function setBg(v) { localStorage.setItem(STORAGE_KEY_BG, v); }
  function setOpacity(v) { localStorage.setItem(STORAGE_KEY_OPACITY, String(v)); }
  function getMode() { return localStorage.getItem(STORAGE_KEY_MODE) || ''; }
  function setMode(v) { localStorage.setItem(STORAGE_KEY_MODE, v); }
  function getRandomCat() { return localStorage.getItem(STORAGE_KEY_RANDOM_CAT) || 'pc'; }
  function setRandomCat(v) { localStorage.setItem(STORAGE_KEY_RANDOM_CAT, v); }
  function getHistory() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY_HISTORY) || '[]'); } catch(e) { return []; } }
  function setHistory(arr) { localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(arr)); }
  function addHistory(url, cat) {
    const h = getHistory();
    const filtered = h.filter(item => item.url !== url);
    filtered.unshift({ url, cat, time: Date.now() });
    if (filtered.length > MAX_HISTORY) filtered.length = MAX_HISTORY;
    setHistory(filtered);
  }
  function removeHistory(url) {
    setHistory(getHistory().filter(item => item.url !== url));
  }

  async function fetchRandomUrl(cat) {
    try {
      const resp = await fetch(`https://t.alcy.cc/json?${cat}`);
      if (!resp.ok) return null;
      const json = await resp.json();
      return (json && json.data && json.data.link) || null;
    } catch (e) {
      return null;
    }
  }

  let currentBg = getBg();
  let currentOpacity = getOpacity();

  // ==================== CSS 生成 ====================
  function generateCSS(bg, opacity) {
    const a = (level) => {
      const l = level * 0.1;
      return `calc((${opacity} * ${l}) / (1 + ${opacity} * ${l} - ${l}))`;
    };
    return `
/* ==== CSS 变量 ==== */
:root {
  --bg-custom: ${bg};
  --bg-opacity: ${opacity};
  --0: 0;
  --1: ${a(1)}; --2: ${a(2)}; --3: ${a(3)}; --4: ${a(4)}; --5: ${a(5)};
  --6: ${a(6)}; --7: ${a(7)}; --8: ${a(8)}; --9: ${a(9)}; --10: ${a(10)};
  --35: ${a(3.5)}; --45: ${a(4.5)}; --65: ${a(6.5)}; --77: ${a(7.7)}; --85: ${a(8.5)};
}

/* ==== 背景图片（全站） ==== */
html::after {
  content: '';
  height: 100%; width: 100%;
  position: fixed; top: 0; left: 0;
  opacity: 0.75;
  background: var(--bg-custom);
  background-size: cover;
  z-index: -1;
}

/* ===== 新增：关灯专用 ===== */
/* 关灯模式下隐藏 html::after，由 #blur-bg 替代 */
[data-theme="dark"] html::after {
  display: none !important;
}

/* ==== 固定模糊背景层（仅关灯模式） ==== */
[data-theme="dark"] #blur-bg {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: -1;
  background: var(--bg-custom);
  background-size: cover;
  background-position: center;
  filter: blur(5px);
  transform: scale(1.05);
}
/* ===== 新增结束 ===== */

/* ==== 光标操作：黑条展开 ==== */
span[style*="background-color:#555"][style*="color:#555"] {
  box-shadow: #555 1px 1px 2px; border-radius: 2px;
}
span:hover[style*="background-color:#555"][style*="color:#555"] {
  position: relative; color: #fff !important; transition: all .5s;
}
span:hover[style*="background-color:#555"][style*="color:#555"]::after {
  content: "人家的秘密都被你看光了>人<";
  position: absolute; right: 0; color: #555; background-color: #fff;
  box-shadow: #555 1px 1px 2px; display: block; white-space: nowrap;
}

/* ==== 进度管理：条目悬停弹起 ==== */
ul.prg_list li:hover { margin-bottom: 8px !important; display: block; transition: .5s; margin-top: -5px; padding-top: 0; }
ul.prg_list li { margin-bottom: 3px !important; display: block; transition: .5s; margin-top: 0; }
.tinyMode a.epBtnWatched:hover, a.sepBtnWatched:hover { border: 1px solid #00A8FF !important; padding-top: 2px !important; background-color: #407fd3; transition: .5s; }
.tinyMode a.epBtnUnknown:hover, .tinyMode a.epBtnAir:hover, a.sepBtnUnknown:hover, a.sepBtnAir:hover { border: 1px solid #00A8FF !important; padding-top: 2px !important; background-color: #cddaed; transition: .5s; }
.tinyMode a.epBtnToday:hover { padding-top: 2px !important; background-color: #a8e398; border: #28674e 1px solid; transition: .5s; }
.tinyMode a.epBtnNA:hover { padding-top: 2px !important; background-color: #cac9c9; border: #28674e 1px solid; transition: .5s; }
div.subject_tag_section a.l:hover { margin-left: 5px; margin-right: 5px; background: rgba(255,255,255,.7) !important; color: #003d54; transition: .5s; }
.load-epinfo.epBtnToday { background: #b0eba0; border: #28674e 1px solid; }
a.epBtnWatched:hover { border: 1px solid #00A8FF !important; padding-top: 5px !important; background-color: #407fd3; transition: .5s; }
a.epBtnUnknown:hover, a.epBtnAir:hover { border: 1px solid #00A8FF !important; padding-top: 5px !important; background-color: #cddaed; transition: .5s; }
a.epBtnToday:hover { padding-top: 5px !important; background-color: #a8e398; border: #28674e 1px solid; transition: .5s; }
a.epBtnNA:hover { padding-top: 5px !important; background-color: #cac9c9; border: #28674e 1px solid; transition: .5s; }
.epv_popu_default { width: 90%; }

/* ==== 404 / 通用头部 ==== */
#headerNeue2 { background: rgba(255,255,255,.7); border: none; box-shadow: none; }
#footer #footerLinks { border-radius: 10px; background: rgba(255,255,255,.6); }
#navNeue2 #navMenuNeue li a.chl { background: rgba(255,255,255,.5); }

/* ========== 首页样式优化 ========== */
#headerNeue2 { background: rgba(255,255,255,var(--7)); border: none; box-shadow: none; }
a.chl:hover, a.chl { transition: 0.5s; }
.halfPage.sort.ui-draggable { background: rgba(255,255,255,var(--9)); }
.sidePanelHome { background: rgba(255,255,255,var(--0)); }
#home_calendar { background: rgba(255,255,255,var(--6)); }
.clearit.week { border: none; }
#prgManagerMain, input.inputtext { background: rgba(255,255,255,var(--7)); }
#cloumnSubjectInfo a.prgCheckIn, ul#prgSubjectList li a.prgCheckIn { background: rgba(255,255,255,var(--0)); }
#prgManagerHeader { background: rgba(255,255,255,var(--7)); border: none; }
#cloumnSubjectInfo div.header, #cloumnSubjectInfo div.moreEp, ul#prgSubjectList.list li.sep, ul#prgSubjectList.full li.sep { background: rgba(255,255,255,var(--0)); border: none; }
ul#prgSubjectList.full { background: rgba(255,255,255,var(--0)); }
ul#prgSubjectList.full li p.listProgress span { background: rgba(65,180,218,var(--4)); border: none; }
ul#prgSubjectList.full li, div.sidePanelHome h2 { border: none; }
#home_calendar, ul.calendarMini div.coverList { border: none; }
ul.calendarMini div.coverList { background: rgba(255,255,255,var(--0)); }
small.grey { color: #a3a3a3; }
ul.calendarMini li, ul.calendarMini li.Sat, ul.calendarMini li.Mon, ul.calendarMini li.Tue, ul.calendarMini li.Wed, ul.calendarMini li.Thu, ul.calendarMini li.Fri, ul.calendarMini li.Sun { background: rgba(255,255,255,var(--0)); color: grey; border: none; }
.halfPage.sort.ui-draggable, textarea.quick { padding-top: 5px; background: rgba(255,255,255,var(--6)); border-radius: 10px; }
.line_odd, .line_even { background: rgba(255,255,255,var(--0)); border: none; }
#footer #footerLinks { background: rgba(255,255,255,var(--6)); border-radius: 10px; }
#columnTimelineInnerWrapper, #columnTimelineInnerWrapper ul.timelineTabs { background: rgba(255,255,255,var(--4)); }
div.SidePanelMini.clearit { background: rgba(255,255,255,var(--6)) !important; }
div.SidePanelMini.clearit.award2022 { background: rgba(255,255,255,var(--10)) !important; opacity: var(--6); }
#columnTimelineInnerB { background-color: rgba(255,255,255,var(--4)); }
#columnTimelineInnerB div.TsukkmiBox { background: rgba(255,255,255,var(--0)); }
#cloumnSubjectInfo div.infoWrapper_book div.header { background: rgba(255,255,255,var(--0)); border: none; }
hr.board { height: 0; }
#introWrapper { background: none; box-shadow: none; }
#timeline ul.subReply { background: rgba(255,255,255,var(--0)); }
input.inputBtn, a.fancyBtn { background: rgba(56,176,207,var(--6)); border-radius: 10px; border: none; }
li.doujin { z-index: -1; position: fixed; opacity: 0; }
#columnHomeA div.sort h2.subtitle:hover, #columnHomeB div.sort h2.subtitle:hover { border-radius: 10px 10px 0px 0px; background: rgba(255,255,255,var(--4)); }
.ui-draggable { padding-top: 5px; background: rgba(255,255,255,var(--6)); border-radius: 10px; }
.sort { background: rgba(255,255,255,var(--0)); }
#header > small.grey { color: white; }
#timeline h4.Header { border: none; }
#timeline ul li.tml_item .card:not(.card_tiny) { background: rgba(255,255,255,var(--4)); }
#timeline ul li.tml_item .card.card_tiny { background: rgba(255,255,255,var(--0)); }
#timeline ul li.tml_item .card.card_tiny .container { background: rgba(255,255,255,var(--4)); }
#timeline ul li.tml_item .card.card_tiny .container:hover { background: rgba(255,255,255,var(--6)); }
ul.sideTpcList .row:nth-child(2n+1), ul.sideTpcList .row:nth-child(2n) { background: rgba(255,255,255,var(--0)); }
#timeline ul li.tml_item .comment { background: rgba(255,255,255,var(--5)); border: none; }
#columnIntroB div.loginPanel { background: rgba(255,255,255,var(--5)); }
#columnIntroB div.loginPanel dt { background: rgba(255,255,255,var(--0)); border: none; }
#columnIntroB div.loginPanel dt input { background: rgba(255,255,255,var(--5)); }
textarea.quick:focus, textarea.reply:focus, textarea.reply { background: rgba(255,255,255,var(--5)) !important; }
#navNeue2 #navMenuNeue li a.chl { background: rgba(255,255,255,var(--5)); }
#anime-schedule-container { background: rgba(255,255,255,var(--5)); color: #343434; }
ul.sideTpcList .row:nth-child(2n+1), ul.sideTpcList .row:nth-child(2n), ul.timeline li, #prgManager { border: none; }
#prgManager, #home_calendar, .sort, #anime-schedule-container { backdrop-filter: blur(5px); }
#prgManagerMain div.cloumnSubjects { border-right: #bfbfbf94 2px solid; }
#timeline ul li span.info { border: none; }

/* ========== 内页透明化 ========== */
div#main { background: rgba(255,255,255,var(--4)); }

/* 修复目录页面“全部”选项的方角背景和边框 */
#indexCatBox .selected,
#indexCatBox .focus {
    background: none !important;
    border-radius: 0 !important;
    border: none !important;
    box-shadow: none !important;
}

.indexCatBox ul.cat li a.add, .indexCatBox ul.cat li a.add:hover { background: rgba(255,255,255,var(--0)); }
#user_home div.userSynchronize { background: rgba(255,255,255,var(--6)); }
ul.sideEpList li.even { background: rgba(255,255,255,var(--4)); }
ul.sideEpList li.cur { background: rgba(98,114,178,var(--77)) !important; }
#columnTimelineA #SayInput { background: rgba(255,255,255,var(--6)); }
ul#crtRelateSubjects li.old { background: rgba(255,255,255,var(--0)); }
div.SidePanel, div.SidePanelLow { background: rgba(255,255,255,var(--4)); backdrop-filter: blur(5px); }
#eden_tpc_list ul li.line_odd:hover, #eden_tpc_list ul li.line_even:hover { background: rgba(255,255,255,var(--7)); }
div.subject_tag_section a.l { background: rgba(255,255,255,var(--7)); }
table.forumtable { background: rgba(255,255,255,var(--4)); }
table.forumtable tr.alt td { background: rgba(255,255,255,var(--0)); }
.subjectListWrapper { background: rgba(255,255,255,var(--5)); }
#columnSearchA ul, #columnSearchA ul li.root { background: rgba(255,255,255,var(--4)); }
#columnSearch { background: rgba(255,255,255,var(--4)); }
.magiHeader { background: rgba(255,255,255,var(--35)); }
.panelProgress.book { background: rgba(255,255,255,var(--35)); border-radius: 7px; border-color: rgba(153,153,153,.59); }
div#ChartWarpper { background: rgba(255,255,255,var(--0)); }
#columnSearchA ul li a:hover, #columnSearchA ul li a.selected { background: #f09199ad; }
.columnsApp.clearit { background: rgba(255,255,255,var(--5)); }
div.eden_rec_box { background: rgba(255,255,255,var(--5)); }
ul#browserItemList { background: rgba(255,255,255,var(--0)); }
div.infobox .modifyTool { background: rgba(255,255,255,var(--5)); }
#columnNotifyA div.even { background: rgba(255,255,255,var(--4)); }
#main.png_bg { background: rgba(255,255,255,var(--35)); }
ul.timelineTabs li a.focus, ul.timelineTabs li a.top_focus { background: rgba(255,255,255,var(--7)); }
.grp_box.clearit { background: rgba(255,255,255,var(--35)); }
#columnB, #pageHeader { background: rgba(255,255,255,var(--0)); }
ul.browserFull li.item.even { background: rgba(255,255,255,var(--0)); }
#columnSubjectBrowserB .sideInner { background: rgba(255,255,255,var(--5)); }
#columnSubjectBrowserB .sideInner h2 { background: rgba(255,255,255,var(--0)); }
select.form { background: rgba(255,255,255,var(--5)); }
input.btnPink, input.btnGray { background: #ff4a5952; }
#comment_list { background: rgba(255,255,255,var(--0)); }
#header { background: rgba(255,255,255,var(--35)); }
.mainWrapper { background: rgba(255,255,255,var(--3)); }
.mainWrapper, #comment_box .text, #comment_box .text_pm, .line_odd, .line_even, ul.line_list_music li.cat, ul.line_list li.cat { background: rgba(255,255,255,var(--4)); }
#grailBox2, ul.timelineTabs { background: rgba(255,255,255,var(--65)); }
#footer { background: rgba(255,255,255,var(--4)); }
.temples.tab_page_item.tab_page_item_0 { background: rgba(255,255,255,var(--65)); }
#headerSubject { background: rgba(255,255,255,var(--6)); }
.subject_section.clearit { background: rgba(255,255,255,var(--65)); }
tbody { background: rgba(255,255,255,var(--0)); }
hr.board, div#collect_title, #ChartWarpper .chart_desc { background: rgba(255,255,255,var(--0)); }
a.btnGreenSmall.rr { background: rgba(30,181,176,var(--45)); }
a.btnRedSmall.rr { background: rgba(200,106,106,var(--45)); }
#subject_inner_info, div.menu_inner { background: rgba(255,255,255,var(--5)); }
#headerNeue2 { background: rgba(255,255,255,var(--7)); }
div.grp_box { background: rgba(255,255,255,var(--5)); }
table.topic_list tr.header { background: rgba(255,255,255,var(--2)); }
#headerProfile div.subjectNav { background: rgba(255,255,255,var(--35)); }
#headerProfile .headerContainer { background: rgba(255,255,255,var(--5)); }
blockquote.intro { background: rgba(255,255,255,var(--4)); }
div.row_reply { background: rgba(255,255,255,var(--5)); }
a.chiiBtn { background: rgba(255,255,255,var(--5)); }
/* a.chiiBtn:hover { background: rgba(245,107,155,var(--4)); } */
table.topic_list { border-radius: 15px; }
div.collectBlock p.collectModify { background: #ffffffba url(/img/ico/ico_list_love.gif) no-repeat 5px 50%; }
table.topic_list tr.even { background-color: #fff0; }
tr.odd { background-color: #f9f9f900; }
div.subject_section { background-color: #f9f9f900; border-radius: 10px; margin-bottom: 30px; }
/* ul.browserFull li.item span.rank, a.selected { background: #ff99bf4f !important; } */

/* 修复目录页所有排名标签为蓝色 */
.browserFull .item span.rank,
.browserFull .item span.rank.vibrank {
    background: #02A3FB !important;
    opacity: 1 !important;
    color: #fff !important;
    padding: 2px 6px !important;
}
/* 保留 a.selected 的样式（如果有其他需求） */
a.selected {
    background: #ff99bf4f !important;
}

textarea#content { background: rgba(255,255,255,var(--5)) !important; }
.modifyTool { opacity: var(--9); }
div#footer ul#footerLinks { opacity: var(--9); }
#cluetip { opacity: var(--85); }
#timeline ul li.tml_item .card { background: rgba(255,255,255,var(--6)); }
#timeline ul li.tml_item .card.card_tiny .container { background: rgba(255,255,255,var(--0)); }
ul.sideTpcList .row:nth-child(2n+1) { background: rgba(255,255,255,var(--0)); }
#comment_list .row:nth-child(2n+1), #comment_list .row:nth-child(2n) { background: rgba(255,255,255,var(--5)); }
.codeHighlight pre { background-color: rgba(255,255,255,var(--5)) !important; }
.infobox_container .infobox_expand { background: rgba(255,255,255,var(--4)); }
.infobox_container .infobox_expand a:hover { background: rgba(245,107,155,var(--4)); }
#comment_list div.row_state { background: rgba(255,255,255,var(--5)); }
div.reply_highlight { background: rgba(255,255,255,var(--4)) !important; }
#aboutTimeline ul.Events li.detail ul.column li, #aboutTimeline ul.Events li.intro p { background: rgba(255,255,255,var(--0)); }
#aboutTimeline { background: rgba(255,255,255,var(--4)); }
input.inputtext, textarea.reply { background: rgba(255,255,255,var(--5)) !important; }
input.inputBtn, a.fancyBtn { background: #ff7a947a; }
#columnCrtBrowserA { background: rgba(255,255,255,var(--5)); }
#columnCrtBrowserA h3 { background: none; }
#columnTimelineInnerB div.TsukkmiBox, #columnTimelineInnerWrapper { background: none; }
#columnTimelineInnerWrapper ul.timelineTabs, #columnTimelineInnerB { background: rgba(255,255,255,var(--3)); }
#timeline ul li.tml_item .comment { background: rgba(255,255,255,var(--5)); }
#columnIntroB div.loginPanel { background: rgba(255,255,255,var(--5)); }
#columnIntroB div.loginPanel dt { background: rgba(255,255,255,var(--0)); }
#timeline ul li.tml_item .card:not(.card_tiny) { background: rgba(255,255,255,var(--4)); }
#timeline ul li.tml_item .card.card_tiny { background: rgba(255,255,255,var(--0)); }
#timeline ul li.tml_item .card.card_tiny .container { background: rgba(255,255,255,var(--4)); }
#timeline ul li.tml_item .card.card_tiny .container:hover { background: rgba(255,255,255,var(--6)); }
rect[data-count="0"] { fill: rgb(255,255,255); }
ul.secTab li a { background: rgba(255,255,255,var(--5)); }
ul.secTab li a:hover { background: rgba(255,164,189,.14); }
#navNeue2 #navMenuNeue li a.chl { background: rgba(255,255,255,var(--5)); }
a.btnBlue, a.btnBlueSmall { background: rgba(255,255,255,var(--7)); }
a.btnBlue:hover, a.btnBlueSmall:hover { background: rgba(255,114,114,var(--4)); }
input.inputBtn:hover, a.fancyBtn:hover { background: rgba(255,98,130,var(--6)); }
.likes_grid .item { background: rgba(255,255,255,var(--6)); }
textarea.quick { background: rgba(255,255,255,var(--6)); }
textarea.quick:focus, textarea.reply:focus { background: rgba(255,255,255,var(--8)); }
#show-diff-view-side-by-side { background: rgba(255,255,255,var(--6)); }
.d2h-file-header, .d2h-code-side-linenumber { background: rgba(255,255,255,var(--6)); }
ul#infobox li.group_section { background: rgba(255,255,255,var(--4)); }
table.settings .tag_list li a { background: rgba(255,255,255,var(--8)); }
#sliderContainer { background: rgba(229,229,229,var(--5)); }
div.ui-widget-content { background: rgba(255,255,255,var(--7)); }

/* 角色介绍板块 - 去掉白色遮罩，保留文字和图片 */
.bg-role-section,
.bg-role-section .content_inner,
.bg-role-section .crtList,
.bg-role-section .crtList .crt_field {
    background: transparent !important;
    background-color: transparent !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
}

/* 确保缩略图背景正常显示（防止变透明） */
.bg-role-section .crt_field .avatarNeue {
    background: #f0f0f0 !important;
}

/* 确保文字颜色正常（防止被覆盖） */
.bg-role-section .crt_field .title a,
.bg-role-section .crt_field .info .jobs {
    color: #333 !important;
}

/* ========== 边框处理 ========== */
#timeline h4.Header, ul.timeline li, ul.tagList li, #headerNeue2, .line_odd, .line_even, .user_list.line_list li,
#columnSearch, a.cover:hover img.cover, img.cover, table.settings td, #columnSearchA ul li a,
#columnSearchA ul li a:hover, #columnSearchA ul li a.selected, #wrapperNeue #columnSubjectBrowserA #browserTools,
ul.browserFull li.item.even, div.light_odd, div.light_even, .borderNeue, #headerSubject div.subjectNav,
div.navSubTabsWrapper, div.section_line, ul.browserList li.even, div#footer ul#footerLinks, ul.browserList li.item,
ul#infobox li, ul.groupsLine li, div.subject_tag_section, table td.even, ul.browserCoverMedium li.sep,
div.subjectFilter, div.subjectFilter ul.grouped, #browserTools, ul.browserFull li.even, ul.browserFull li.item,
.cell.name.medium.ll, div.cell.ll, .line_list.user_list, input.inputtext, div.subject_section, table.topic_list tr.header,
ul.collect li.item, ul.collect li.cat, div.sub_reply_bg, #entry_list div.item, #columnSearchA ul,
div.SimpleSidePanel h2, div.user_box, ul#crtRelateSubjects li.old, ul.ajaxSubjectList li, #columnCrtBrowserB .crtTools
{ border: none; background: rgba(0,0,0,0); }
#headerSubject h1 { margin-top: 0; padding-top: 10px; }
.panelProgress.book { border-radius: 7px; border-color: rgba(153,153,153,.59); }
#eden_tpc_list ul li.line_odd:hover, #eden_tpc_list ul li.line_odd, #eden_tpc_list ul li.line_even:hover,
#eden_tpc_list ul li.line_even { transition: 0.8s; }
a.chl:hover, a.chl { transition: 0.5s; }
img.cover, img.cover:hover { padding: 0; border: 0; }
#headerNeue2, div.codeHighlight { backdrop-filter: blur(3px); z-index: 9; box-shadow: none; }
a.tip_i, a.tip_i:link, a.tip_i:visited, a.tip_i:active, a.reply-plus-one { color: #686868; }
a.reply-plus-one { border: 1px solid #686868; }
div.re_info, div.re_info a, .tip_j { color: #686868; }
div.SimpleSidePanel { border-radius: 8px; }
#searchHomeBox ul.cat li a, .indexCatBox ul.cat li a { color: #7d7d7d !important; border-radius: 7px; box-shadow: none; }
img.cover { border-radius: 6px; }
#headerProfile div.subjectNav { border: none; margin-bottom: 0; }
.tab_button { color: #000; }
span.count { filter: saturate(0); }
span.description, small.alarm { color: #000000f5; }
q { color: #909090; }
span.tip_i { color: rgb(83,79,104); }
ul { z-index: 99; }
span.userInfo { z-index: 99; }
table.forumtable { border: 2px; border-color: white; }
.columns.clearit { margin: auto; }
div[style*="width:800px; margin:0 auto; overflow:hidden"] { transform: translate(0,10%); }
.columnsApp.clearit { margin-top: 5px; margin-bottom: 100px; }
div.SidePanel h2, div.SidePanelLow h2 { text-shadow: none; }
#slider { width: 95%; margin-right: 2.5%; }
#sliderContainer { border: none; }
div.ui-widget-content { border: 1px solid #b4b4b4; }
.ui-state-default, .ui-widget-content .ui-state-default { border-radius: 40%; background: white; border: 1px solid #666; }
#eden_tpc_list { margin-top: -1px; }
.indexCatBox ul.cat li a.add { color: grey; }
.indexCatBox ul.cat li a.add:hover { color: #F09199; }
div.row_reply { margin-bottom: 7px; border-radius: 10px; }
#comment_list { box-shadow: none; }
input.inputBtn, a.fancyBtn { border-radius: 5px; border: none; }
table.topic_list { font-size: 13px !important; }
div.grp_box { border: 1px solid #F0F0F0; }
table.topic_list td.subject, table.topic_list th.subject { padding: 10px; }
.shareBtn { opacity: 0; position: fixed; z-index: -1000; }
div.eden_rec_box { border-radius: 20px; }
a.selected { border: 1px solid #c4c4c4bd !important; }
/* a.chiiBtn { box-shadow: none; border-radius: 4px; padding: 5px 10px; text-shadow: none; border: none; } */
div.collectBlock p.collectModify { box-shadow: none; }
#comment_list div.row_reply:first-child, #comment_list div.row_reply:last-child { border-radius: 10px; border: 1px solid #F0F0F0; }
blockquote.intro { border-radius: 15px; border: 1px solid #F0F0F0; }
table.forumtable th { padding: 8px; }
div.subject_tag_section a.l { margin: 2px; transition: .5s; }
div.subject_tag_section a.l:hover small { color: #484848; }
div.subject_tag_section div.inner { padding-right: 5px; }
li.doujin { z-index: -1; position: fixed; opacity: 0; }
ul.navTabs { background: rgba(255,255,255,0) !important; border: none; }
.subjectNav .navTabs { width: 100%; }
.infobox_container .infobox_expand { border: none; border-radius: 4px; }
.infobox_container .infobox_expand a { border-radius: 4px; }
#comment_list div.row_state { border-radius: 4px !important; }
div.reply_highlight { border-color: #88c5ff82 !important; }
ul.secTab li a.selected, ul.secTab li a.focus, ul.secTab li a:hover { color: black; }
#columnCrtBrowserA { border-radius: 10px; }
#timeline ul li span.info, #columnTimelineInnerWrapper ul.timelineTabs, #columnTimelineInnerWrapper, #columnTimelineInnerB { border: none; }
#timeline ul li.tml_item .comment { border: none; }
.mosaic-tile { padding: 5px; border-radius: 10px; }
ul.secTab li a, ul.secTab li:first-child a { padding: 5px 10px; text-shadow: none; box-shadow: none; border: none; }
a.selected { box-shadow: none; padding: 4px 9px 4.5px !important; }
ul.secTab li a:hover { box-shadow: none; }
div.menu_inner { box-shadow: none; }
#navMenuNeue li a.focus { color: rgb(204,129,146); }
a.btnBlue, a.btnBlueSmall { color: black; padding: 10px 20px; border-radius: 5px; }
#rakuen_infobox { width: 200px; }
#headerProfile h1 span { color: black; }
a.chiiBtn:hover { box-shadow: none; }
#show-diff-view-side-by-side { width: 90%; }
ul#infobox li.sub, ul#infobox li.sub_section, ul#infobox li.sub_group { border: none; }
#headerSubject span.collect a { line-height: 20px; }
ul#infobox li .tag { border: 1px solid #0084B4; }
a.cover:hover img.cover { padding: 0; }

/* ========== 小组标题居中 ========== */
.columns.clearit { background: rgba(255,255,255,.3); }

/* ========== 封面 hover 放大（条目页） ========== */
img.cover:hover { height: 95%; width: 95%; box-shadow: 0 0 12px black; transition: all .5s; }
img.cover { margin: auto; height: 68%; width: 68%; box-shadow: none; transition: all .5s; }

/* ========== 封面放大（搜索/排行榜） ========== */
ul.browserFull li.item img.cover { max-width: 100px; }
.columns.clearit { display: -webkit-box; -webkit-box-pack: center; }
img.cover:hover { box-shadow: 0 0 12px black; height: 100%; width: 100%; transition: all .5s; }
#columnSearchA { margin-right: 0; }

/* 角色页封面 bug 排除 */
img.cover[src*="//lain.bgm.tv/pic/crt"] { box-shadow: none; transition: all .5s; }
img.cover[src*="//lain.bgm.tv/pic/crt"]:hover { box-shadow: 0 0 12px black; transition: all .5s; }

/* ========== Wiki 界面 ========== */
input.multiKeyAdd {
  background: #a7db9c url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='white'%3E%3Cpath d='M19 11H13V5h-2v6H5v2h6v6h2v-6h6z'/%3E%3C/svg%3E") no-repeat center center;
  border-radius: 50%; border: 1.5px solid #85bf79; box-shadow: rgba(0,0,0,.2) 0px 4px 8px;
}

/* Wiki 统计 */
ul.wikiStats li { background: rgba(255,255,255,.5); border: none; box-shadow: none; margin: 3.5px; }
ul.wikiScrollBlock { border-radius: 10px; }
.user_list .cell.name { background: none; }
#comment_box .text, #comment_box .text_pm, .comment_box { background: rgba(255,255,255,.5); }

/* ========== 个人主页 ========== */
#columnA { margin: 5px 0px 0px 0px; }
#columnTimelineInnerWrapper, #columnTimelineInnerWrapper ul.timelineTabs, div.SidePanelMini { background: rgba(255,255,255,.3); }
.line_odd, .line_even { background: rgba(255,255,255,0); border: none; }
#columnTimelineInnerB { background-color: rgba(255,255,255,0); }
#columnTimelineInnerB div.TsukkmiBox { background: rgba(255,255,255,0); }
ul.navTabs { background: rgba(255,255,255,.5) !important; border: none; }

/* ========== 图片优化 ========== */
.pictureFrameGroup .overlay { background: none; }

/* ========== BRRS 关联 ========== */
.brrs-editor-item, .brrs-editor-item:hover {
  border-radius: 15px; background: rgba(255,255,255,0);
  padding: 15px 10px; margin: 10px 0; border: none;
}
.brrs-previewer-item { background: rgba(255,255,255,.4); border-radius: 15px; margin-bottom: 80px; }

/* ========== 制作人员页 ========== */
ul.line_list li.cat { border: none; position: relative; }
ul.line_list li.cat::after {
  content: ""; position: absolute; bottom: 0; left: 1%;
  width: 98%; height: 1.2px; background-color: #00000036;
}
ul.sideEpList li.odd { background: rgba(255,255,255,.4); margin: 4px 0; }

/* ========== 用户页封面比例 ========== */
ul.coversSmall li { height: 140px; }
.pictureFrameGroup { height: 103px; }
.pictureFrameGroup .image { height: 100px; border-radius: 5px; }
.pictureFrameGroup .overlay { height: 103px; }
.pictureFrameGroup .image img { height: 100% !important; }

/* ========== 文章/帖子/条目讨论页增强遮罩 ========== */
.bangumi-article-topic div#main,
.bangumi-article-topic .mainWrapper,
.bangumi-article-topic #main.png_bg {
  background: rgba(255,255,255,var(--4)) !important;
  backdrop-filter: blur(3px) !important;
}

/* ========== 维基编辑页面 - 恢复边框（用ID直接定位） ========== */
[data-theme="light"] #columnInSubjectA input.inputtext,
[data-theme="light"] #columnInSubjectA textarea.quick,
[data-theme="light"] #columnInSubjectA select.form,
[data-theme="light"] #columnInSubjectA input[type="text"],
[data-theme="light"] #columnInSubjectA input[type="number"],
[data-theme="light"] #columnInSubjectA textarea,
[data-theme="light"] #columnInSubjectA select {
  border: 1px solid #d9d9d9 !important;
  border-radius: 4px !important;
  background: rgba(255,255,255,0.65) !important;
}

/* ===== 相册图片修复（重置 z-index） ===== */
.bangumi-cover-page .photoList img.grid {
  z-index: auto !important;
  position: relative !important;
  isolation: isolate !important;
}
.bangumi-cover-page .photoList li,
.bangumi-cover-page .photoList a.grid,
.bangumi-cover-page .photoList {
  opacity: 1 !important;
  filter: none !important;
  backdrop-filter: none !important;
  mix-blend-mode: normal !important;
}
.bangumi-cover-page .columns.clearit {
  background: none !important;
}

/* ===== 条目页“大家将...标注为”区块边框 ===== */
div.subject_tag_section {
    background: rgba(255,255,255,0.25) !important;
    backdrop-filter: blur(4px) !important;
    border-radius: 8px !important;
    padding: 6px 12px !important;
}

/* ===== 开发者平台蓝色按钮修复（直接针对官方类） ===== */
a.btnBlue.full {
    background-color: #369CF8 !important;
    border-radius: 50px !important;
    -webkit-border-radius: 50px !important;
    color: #fff !important;
    border: 1px solid #369CF8 !important;
    padding: 5px 25px !important;
    box-shadow: none !important;
}
a.btnBlue.full:hover {
    background-color: #F09199 !important;
    border-color: #F09199 !important;
    border-radius: 50px !important;
}

/* ===== 修复组件启用/停用按钮颜色（精准匹配实际类名） ===== */
/* 启用按钮 - 绿色 (#4CAF50) */
a.btnGreenSmall.rr {
    background-color: #4CAF50 !important;
    border-color: #4CAF50 !important;
    color: #fff !important;
}

/* 停用按钮 - 红色/粉色 (#F09199) */
a.btnRedSmall.rr {
    background-color: #F09199 !important;
    border-color: #F09199 !important;
    color: #fff !important;
}

/* ===== 关灯模式适配：统一毛玻璃颜色 ===== */

/* 确保自定义背景图可见 */
[data-theme="dark"] html,
[data-theme="dark"] body {
    background: transparent !important;
}

/* ===== 主容器：半透明背景（所有容器） ===== */
[data-theme="dark"] #main,
[data-theme="dark"] .mainWrapper,
[data-theme="dark"] #headerNeue2,
[data-theme="dark"] #headerSubject,
[data-theme="dark"] #header,
[data-theme="dark"] #headerProfile,
[data-theme="dark"] .subject_section.clearit,
[data-theme="dark"] .grp_box.clearit,
[data-theme="dark"] div.SidePanel,
[data-theme="dark"] div.SidePanelLow,
[data-theme="dark"] #columnB,
[data-theme="dark"] #columnA,
[data-theme="dark"] .columnsApp.clearit,
[data-theme="dark"] #comment_list,
[data-theme="dark"] .row_reply,
[data-theme="dark"] .shoutBox,
[data-theme="dark"] .subjectCommentList,
[data-theme="dark"] #reply_wrapper,
[data-theme="dark"] .bg-role-section,
[data-theme="dark"] .bg-role-section .content_inner,
[data-theme="dark"] .bg-role-section .crtList,
[data-theme="dark"] .bg-role-section .crtList .crt_field,
[data-theme="dark"] .infobox_container .infobox_expand,
[data-theme="dark"] .likes_grid .item,
[data-theme="dark"] ul.sideTpcList .row:nth-child(2n+1),
[data-theme="dark"] .codeHighlight pre,
[data-theme="dark"] .reply_content,
[data-theme="dark"] .comment-content,
[data-theme="dark"] .subject_section,
[data-theme="dark"] .tagCloud.clearit,
[data-theme="dark"] .shareTools.clearit,
[data-theme="dark"] .clubsSmall.clearit,
[data-theme="dark"] .SimpleSidePanel,
[data-theme="dark"] #infobox li,
[data-theme="dark"] #infobox .sub_container,
[data-theme="dark"] .section_line.clear,
[data-theme="dark"] .reply_title,
[data-theme="dark"] .reply_avatar,
[data-theme="dark"] #home_calendar,
[data-theme="dark"] #prgManager,
[data-theme="dark"] .sort,
[data-theme="dark"] #anime-schedule-container,
[data-theme="dark"] #columnTimelineInnerWrapper,
[data-theme="dark"] #columnTimelineInnerB,
[data-theme="dark"] #timeline ul li.tml_item .card,
[data-theme="dark"] #timeline ul li.tml_item .comment,
[data-theme="dark"] #columnIntroB div.loginPanel,
[data-theme="dark"] #columnCrtBrowserA,
[data-theme="dark"] ul.secTab li a,
[data-theme="dark"] #show-diff-view-side-by-side,
[data-theme="dark"] .d2h-file-header,
[data-theme="dark"] .d2h-code-side-linenumber,
[data-theme="dark"] ul#infobox li.group_section,
[data-theme="dark"] table.settings .tag_list li a,
[data-theme="dark"] div.ui-widget-content,
[data-theme="dark"] .menu_inner,
[data-theme="dark"] .userStats,
[data-theme="dark"] .userStatsBlock,
[data-theme="dark"] .gridStats,
[data-theme="dark"] .chartWrapper,
[data-theme="dark"] #userStatsContainers,
[data-theme="dark"] .columns.clearit {
    background: rgba(45, 46, 47, 0.53) !important;
    /* 注意：这里没有 backdrop-filter，性能更好 */
}

/* ===== 只有这几个大容器保留毛玻璃模糊效果 ===== */
/* 此段已废弃 - 模糊由 #blur-bg 统一提供（5px），容器无需再单独模糊 */

/* ===== 个人主页专用：内部容器保留极低透明度（卡片质感），去掉模糊 ===== */
[data-theme="dark"] .userPage .mainWrapper,
[data-theme="dark"] .userPage .columns.clearit,
[data-theme="dark"] .userPage #columnA,
[data-theme="dark"] .userPage #columnB,
[data-theme="dark"] .userPage .SidePanel,
[data-theme="dark"] .userPage .SidePanelLow,
[data-theme="dark"] .userPage .SidePanelMini,
[data-theme="dark"] .userPage .SidePanelMini.clearit {
    background: rgba(45, 46, 47, 0.08) !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
}

/* ===== 关灯模式底栏专用（保持原有关灯颜色 #3D3D3D） ===== */
[data-theme="dark"] #footer,
[data-theme="dark"] #footerLinks,
[data-theme="dark"] .copyright {
    background: #3D3D3D !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
}

/* ===== 关灯模式个人介绍板块背景及边框 ===== */
[data-theme="dark"] blockquote.intro {
    background: #444444 !important;
    border: none !important;
}

/* ===== 关灯模式导航栏整体修复（选项卡背景 = #262728） ===== */
[data-theme="dark"] .navTabs,
[data-theme="dark"] .navTabsWrapper,
[data-theme="dark"] #headerProfile .navTabs,
[data-theme="dark"] #headerSubject .navTabs {
    background: #262728 !important;
    border: none !important;
    box-shadow: none !important;
}
[data-theme="dark"] .navTabs li,
[data-theme="dark"] #headerProfile .navTabs li,
[data-theme="dark"] #headerSubject .navTabs li {
    background: #262728 !important;
    border: none !important;
    margin: 0 !important;
}
[data-theme="dark"] .navTabs a,
[data-theme="dark"] .navTabs a.focus,
[data-theme="dark"] .navTabs a.selected,
[data-theme="dark"] #headerProfile .navTabs a,
[data-theme="dark"] #headerProfile .navTabs a.focus,
[data-theme="dark"] #headerProfile .navTabs a.selected,
[data-theme="dark"] #headerSubject .navTabs a,
[data-theme="dark"] #headerSubject .navTabs a.focus,
[data-theme="dark"] #headerSubject .navTabs a.selected {
    background: #262728 !important;
    border-radius: 0 !important;
}

/* ===== 关灯模式：条目页工具条（修改/关联）强制保持原色 ===== */
[data-theme="dark"] div.infobox .modifyTool,
[data-theme="dark"] div.infobox .modifyTool span,
[data-theme="dark"] div.infobox .modifyTool p,
[data-theme="dark"] div.infobox .modifyTool a {
    background: #5C5C5C !important;
    background-color: #5C5C5C !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
    opacity: 1 !important;
}

/* ===== 关灯模式：吐槽箱每条评论背景 ===== */
[data-theme="dark"] #comment_box .text,
[data-theme="dark"] #comment_box .text_container {
    background: #303030 !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
}

/* ===== 关灯模式：条目页标签区域（大家将...标注为） ===== */
[data-theme="dark"] .subject_tag_section {
    background: #353535 !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
}

/* ===== 关灯模式：开发者平台组件介绍框（背景 #3D3D3D + 去边框） ===== */
[data-theme="dark"] .grp_box,
[data-theme="dark"] .grp_box.clearit {
    background: #3D3D3D !important;
    border: none !important;
    box-shadow: none !important;
}

/* ===== 关灯模式：首页“参与讨论”按钮圆角修复 ===== */
a.btnBlueSmall {
    border-radius: 50px !important;
    padding: 2px 10px !important;
    font-size: 12px !important;
    height: auto !important;
    line-height: normal !important;
    background: #369CF8 !important;
    color: #fff !important;
}

/* ===== 关灯模式：维基编辑页面 ===== */

/* 内容区域右栏 - 完全透明 */
[data-theme="dark"] #wrapperNeue .mainWrapper #columnInSubjectB {
    background: transparent !important;
    background-color: transparent !important;
    background-image: none !important;
    border-radius: 0 8px 8px 0 !important;
}

/* 父容器透明（让左栏和右栏的背景透出来） */
[data-theme="dark"] .columns.clearit {
    background: transparent !important;
}

/* 输入框 */
[data-theme="dark"] #columnInSubjectA input.inputtext,
[data-theme="dark"] #columnInSubjectA textarea.quick,
[data-theme="dark"] #columnInSubjectA select.form,
[data-theme="dark"] #columnInSubjectA input[type="text"],
[data-theme="dark"] #columnInSubjectA input[type="number"],
[data-theme="dark"] #columnInSubjectA textarea,
[data-theme="dark"] #columnInSubjectA select {
    background: #303132 !important;
    color: #e8e8e8 !important;
    border: 1px solid #555 !important;
    border-radius: 4px !important;
}

/* 标签 */
[data-theme="dark"] .tag_list .inner input.inputtext {
    background: #303132 !important;
    color: #e8e8e8 !important;
    border: 1px solid #555 !important;
    border-radius: 4px !important;
}

/* 编辑摘要 */
[data-theme="dark"] #editSummary {
    background: #303132 !important;
    color: #e8e8e8 !important;
    border: 1px solid #555 !important;
    border-radius: 4px !important;
}

/* 表格透明 */
[data-theme="dark"] #columnInSubjectA table.settings {
    background: transparent !important;
}

/* 表格文字 */
[data-theme="dark"] #columnInSubjectA table.settings td {
    color: #e8e8e8 !important;
}

/* 点击添加输入框（绿色） */
#columnInSubjectA input.inputtext.prop.multiVal {
    background: #D4EDDA !important;
    color: #333 !important;
    border: 1px solid #a8d5b8 !important;
}

/* 维基左栏信息输入框背景 */
[data-theme="dark"] #infobox_normal input.inputtext.id {
    background-color: #3D3D3F !important;
}

/* 关灯模式下文字颜色保持亮色 */
[data-theme="dark"] body,
[data-theme="dark"] .subject_section.clearit,
[data-theme="dark"] div.subject_section,
[data-theme="dark"] #main,
[data-theme="dark"] .mainWrapper,
[data-theme="dark"] #columnB,
[data-theme="dark"] .columnsApp.clearit,
[data-theme="dark"] #comment_list,
[data-theme="dark"] .row_reply,
[data-theme="dark"] blockquote.intro,
[data-theme="dark"] div.row_reply,
[data-theme="dark"] .reply_content,
[data-theme="dark"] .comment-content,
[data-theme="dark"] .shoutBox,
[data-theme="dark"] .subjectCommentList,
[data-theme="dark"] .reply_title,
[data-theme="dark"] .tip_i,
[data-theme="dark"] .tip_j {
    color: #e8e8e8 !important;
}
`;
  }

  // ==================== 工具函数 ====================
  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  // ==================== CSS 注入 ====================
  function injectCSS() {
    const old = document.getElementById('bangumi-bg-custom-style');
    if (old) old.remove();
    const style = document.createElement('style');
    style.id = 'bangumi-bg-custom-style';
    style.textContent = generateCSS(currentBg, currentOpacity);
    document.head.appendChild(style);
  }

  // ==================== JS 修复函数（重置 z-index） ====================
  function fixImageTransparency() {
  if (!document.documentElement.classList.contains('bangumi-cover-page')) return;

  const container = document.querySelector('.bangumi-cover-page .photoList');
  if (!container) return;

  container.querySelectorAll('img.grid').forEach(img => {
    if (img.dataset.fixed) return;
    img.dataset.fixed = 'true';
    img.style.setProperty('z-index', 'auto', 'important');
    img.style.setProperty('position', 'relative', 'important');
    img.style.setProperty('isolation', 'isolate', 'important');
    img.style.setProperty('opacity', '1', 'important');
    img.style.setProperty('filter', 'none', 'important');
    img.style.setProperty('backdrop-filter', 'none', 'important');
    img.style.setProperty('mix-blend-mode', 'normal', 'important');
    img.style.setProperty('display', 'block', 'important');
    img.style.setProperty('visibility', 'visible', 'important');
    img.style.transform = 'translateZ(0)';
    img.offsetHeight;
    img.style.transform = '';
  });

  container.querySelectorAll('li, a.grid, .photoList').forEach(el => {
    if (el.dataset.fixed) return;
    el.dataset.fixed = 'true';
    el.style.setProperty('opacity', '1', 'important');
    el.style.setProperty('filter', 'none', 'important');
    el.style.setProperty('backdrop-filter', 'none', 'important');
    el.style.setProperty('mix-blend-mode', 'normal', 'important');
  });

  document.querySelectorAll('.bangumi-cover-page .columns.clearit').forEach(el => {
    if (el.dataset.fixed) return;
    el.dataset.fixed = 'true';
    el.style.setProperty('background', 'none', 'important');
  });
}

  function startFixing() {
  const isCoverPage = document.documentElement.classList.contains('bangumi-cover-page');
  if (!isCoverPage) return;

  const fix = () => fixImageTransparency();

  setTimeout(fix, 300);
  setTimeout(fix, 800);
  setTimeout(fix, 1500);

  const photoList = document.querySelector('.photoList');
  if (photoList) {
    const observer = new MutationObserver(() => {
      clearTimeout(window._fixTimer);
      window._fixTimer = setTimeout(fix, 100);
    });
    observer.observe(photoList, { childList: true, subtree: true });
    window._fixObserver = observer;
  }

  window.addEventListener('load', fix);

  window.addEventListener('beforeunload', () => {
    if (window._fixObserver) {
      window._fixObserver.disconnect();
      delete window._fixObserver;
    }
    if (window._fixTimer) {
      clearTimeout(window._fixTimer);
      delete window._fixTimer;
    }
  });
}

  // ==================== 交互式配置面板 UI（完整） ====================
  function createConfigUI() {
    const btn = document.createElement('div');
    btn.id = 'bg-custom-btn';
    btn.innerHTML = '⚙';
    btn.title = 'Bangumi 背景设置';
    Object.assign(btn.style, {
      position: 'fixed', bottom: '20px', right: '20px', zIndex: '99999',
      width: '40px', height: '40px', borderRadius: '50%',
      background: 'rgba(255,255,255,.85)', boxShadow: '0 2px 8px rgba(0,0,0,.15)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer', fontSize: '20px', color: '#666',
      transition: 'transform .2s, box-shadow .2s', userSelect: 'none',
      border: '1px solid #e0e0e0',
    });
    btn.onmouseenter = () => { btn.style.transform = 'scale(1.1)'; btn.style.boxShadow = '0 4px 12px rgba(0,0,0,.2)'; };
    btn.onmouseleave = () => { btn.style.transform = 'scale(1)'; btn.style.boxShadow = '0 2px 8px rgba(0,0,0,.15)'; };

    const panel = document.createElement('div');
    panel.id = 'bg-custom-panel';
    Object.assign(panel.style, {
      position: 'fixed', bottom: '70px', right: '20px', zIndex: '99998',
      width: '420px', background: '#fff', borderRadius: '12px',
      boxShadow: '0 8px 32px rgba(0,0,0,.2)', padding: '20px',
      display: 'none', fontFamily: '-apple-system,"PingFang SC","Microsoft YaHei",sans-serif',
      color: '#444', fontSize: '14px', lineHeight: '1.6',
    });

    function detectMode(val) {
      const sm = getMode();
      if (sm === 'random') return 'random';
      if (sm === 'gradient' || val.includes('gradient')) return 'gradient';
      if (sm === 'image' || val.includes('url(')) return 'image';
      if (sm === 'color') return 'color';
      if (val.includes('#')) return 'color';
      return 'color';
    }
    function parseGradient(val) {
      const dirMatch = val.match(/(to\s+\w+(\s+\w+)?)/);
      const colors = [...val.matchAll(/(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))/g)].map(m => m[1]);
      return {
        direction: dirMatch ? dirMatch[1] : 'to right',
        c1: colors[0] || '#fabbbb',
        c2: colors[1] || '#ee8292',
      };
    }
    function extractColor(val) {
      const hex = val.match(/(#[0-9a-fA-F]{3,8})/);
      if (hex) return hex[1];
      const rgb = val.match(/rgba?\(([^)]+)\)/);
      if (rgb) {
        const parts = rgb[1].split(/[\s,]+/).filter(Boolean);
        const r = parseInt(parts[0]), g = parseInt(parts[1]), b = parseInt(parts[2]);
        return '#' + [r,g,b].map(v => v.toString(16).padStart(2,'0')).join('');
      }
      return '#fabbbb';
    }
    function buildBg() {
      const mode = panel.querySelector('input[name="bg-mode"]:checked').value;
      if (mode === 'color') {
        return panel.querySelector('#bg-color-solid').value;
      }
      if (mode === 'gradient') {
        const dir = panel.querySelector('#bg-grad-dir').value;
        const c1 = panel.querySelector('#bg-grad-c1').value;
        const c2 = panel.querySelector('#bg-grad-c2').value;
        return `linear-gradient(${dir}, ${c1}, ${c2})`;
      }
      if (mode === 'image') {
        const u = panel.querySelector('#bg-img-url').value.trim();
        return u ? `url("${u}")` : DEFAULT_BG;
      }
      if (mode === 'preset') {
        const sel = panel.querySelector('#bg-preset-select').value;
        return sel || DEFAULT_BG;
      }
      if (mode === 'random') {
        const cat = panel.querySelector('#bg-random-cat').value;
        if (currentBg.includes('tc.alcy.cc') || currentBg.includes('lain.bgm.tv')) {
          return currentBg;
        }
        return `url("https://t.alcy.cc/${cat}")`;
      }
      return DEFAULT_BG;
    }

    const initialMode = detectMode(currentBg);
    let gc = { direction: 'to right', c1: '#fabbbb', c2: '#ee8292' };
    if (initialMode === 'gradient') gc = parseGradient(currentBg);
    const solidColor = initialMode === 'color' ? extractColor(currentBg) : '#fabbbb';
    const imgUrl = initialMode === 'image' ? (currentBg.match(/url\(["']?([^"')]+)["']?\)/) || ['',''])[1] : '';
    const randomCat = initialMode === 'random' ? (currentBg.match(/t\.alcy\.cc\/([^"')\s]+)/) || ['','pc'])[1] : 'pc';

    panel.innerHTML = `
      <div class="bg-popup" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <span style="font-size:16px;font-weight:600;color:#333;">Bangumi 背景设置</span>
        <span id="bg-panel-close" style="cursor:pointer;font-size:18px;color:#aaa;line-height:1;" title="关闭">✕</span>
      </div>

      <!-- 实时预览 -->
      <div id="bg-live-preview" style="width:100%;height:60px;border-radius:8px;margin-bottom:14px;border:1px solid #eee;background:${currentBg};background-size:cover;background-position:center;transition:background .3s;"></div>

      <!-- 模式切换 -->
      <div style="display:flex;gap:6px;margin-bottom:14px;">
        <label class="bg-mode-btn" style="flex:1;text-align:center;padding:6px 0;border-radius:6px;cursor:pointer;font-size:13px;border:1px solid #ddd;background:${initialMode==='color'?'#f0911e':'#fff'};color:${initialMode==='color'?'#fff':'#666'};transition:.15s;">
          <input type="radio" name="bg-mode" value="color" style="display:none;" ${initialMode==='color'?'checked':''}> 纯色
        </label>
        <label class="bg-mode-btn" style="flex:1;text-align:center;padding:6px 0;border-radius:6px;cursor:pointer;font-size:13px;border:1px solid #ddd;background:${initialMode==='gradient'?'#f0911e':'#fff'};color:${initialMode==='gradient'?'#fff':'#666'};transition:.15s;">
          <input type="radio" name="bg-mode" value="gradient" style="display:none;" ${initialMode==='gradient'?'checked':''}> 渐变
        </label>
        <label class="bg-mode-btn" style="flex:1;text-align:center;padding:6px 0;border-radius:6px;cursor:pointer;font-size:13px;border:1px solid #ddd;background:${initialMode==='image'?'#f0911e':'#fff'};color:${initialMode==='image'?'#fff':'#666'};transition:.15s;">
          <input type="radio" name="bg-mode" value="image" style="display:none;" ${initialMode==='image'?'checked':''}> 图片
        </label>
        <label class="bg-mode-btn" style="flex:1;text-align:center;padding:6px 0;border-radius:6px;cursor:pointer;font-size:13px;border:1px solid #ddd;background:#fff;color:#666;transition:.15s;">
          <input type="radio" name="bg-mode" value="preset" style="display:none;"> 预设
        </label>
        <label class="bg-mode-btn" style="flex:1;text-align:center;padding:6px 0;border-radius:6px;cursor:pointer;font-size:13px;border:1px solid #ddd;background:${initialMode==='random'?'#f0911e':'#fff'};color:${initialMode==='random'?'#fff':'#666'};transition:.15s;">
          <input type="radio" name="bg-mode" value="random" style="display:none;" ${initialMode==='random'?'checked':''}> 随机
        </label>
      </div>

      <!-- 纯色模式 -->
      <div class="bg-mode-panel" id="bg-mode-color" style="display:${initialMode==='color'?'block':'none'};margin-bottom:14px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <input type="color" id="bg-color-solid" value="${solidColor}" style="width:44px;height:44px;border:none;border-radius:6px;cursor:pointer;padding:0;background:none;">
          <input type="text" id="bg-color-hex" value="${solidColor}" style="flex:1;padding:8px 10px;border:1px solid #ddd;border-radius:6px;font-size:14px;font-family:monospace;box-sizing:border-box;" placeholder="#afc9f0">
        </div>
      </div>

      <!-- 渐变模式 -->
      <div class="bg-mode-panel" id="bg-mode-gradient" style="display:${initialMode==='gradient'?'block':'none'};margin-bottom:14px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
          <span style="font-size:13px;color:#888;white-space:nowrap;">方向</span>
          <select id="bg-grad-dir" style="flex:1;padding:8px;border:1px solid #ddd;border-radius:6px;font-size:13px;background:#fff;box-sizing:border-box;">
            <option value="to right" ${gc.direction==='to right'?'selected':''}>→ 右</option>
            <option value="to left" ${gc.direction==='to left'?'selected':''}>← 左</option>
            <option value="to bottom" ${gc.direction==='to bottom'?'selected':''}>↓ 下</option>
            <option value="to top" ${gc.direction==='to top'?'selected':''}>↑ 上</option>
            <option value="to right bottom" ${gc.direction==='to right bottom'?'selected':''}>↘ 右下</option>
            <option value="to right top" ${gc.direction==='to right top'?'selected':''}>↗ 右上</option>
            <option value="to left bottom" ${gc.direction==='to left bottom'?'selected':''}>↙ 左下</option>
            <option value="to left top" ${gc.direction==='to left top'?'selected':''}>↖ 左上</option>
          </select>
        </div>
        <div style="display:flex;gap:10px;align-items:center;">
          <div style="display:flex;align-items:center;gap:6px;">
            <input type="color" id="bg-grad-c1" value="${gc.c1}" style="width:36px;height:36px;border:none;border-radius:6px;cursor:pointer;padding:0;background:none;">
            <input type="text" class="bg-grad-hex" value="${gc.c1}" style="width:72px;padding:6px 8px;border:1px solid #ddd;border-radius:6px;font-size:13px;font-family:monospace;box-sizing:border-box;" placeholder="#fabbbb">
          </div>
          <span style="color:#ccc;font-size:18px;">→</span>
          <div style="display:flex;align-items:center;gap:6px;">
            <input type="color" id="bg-grad-c2" value="${gc.c2}" style="width:36px;height:36px;border:none;border-radius:6px;cursor:pointer;padding:0;background:none;">
            <input type="text" class="bg-grad-hex" value="${gc.c2}" style="width:72px;padding:6px 8px;border:1px solid #ddd;border-radius:6px;font-size:13px;font-family:monospace;box-sizing:border-box;" placeholder="#ee8292">
          </div>
        </div>
      </div>

      <!-- 图片模式 -->
      <div class="bg-mode-panel" id="bg-mode-image" style="display:${initialMode==='image'?'block':'none'};margin-bottom:14px;">
        <input type="text" id="bg-img-url" value="${escapeHtml(imgUrl)}" style="width:100%;padding:8px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;box-sizing:border-box;" placeholder="https://lain.bgm.tv/pic/photo/l/...">
        <div style="font-size:11px;color:#999;margin-top:4px;">支持 lain.bgm.tv 图片直链，也可用其他图床 URL</div>
      </div>

      <!-- 预设模式 -->
      <div class="bg-mode-panel" id="bg-mode-preset" style="display:none;margin-bottom:14px;">
        <div id="bg-preset-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">
          ${[
            {label:'樱花粉', val:'linear-gradient(to right, rgb(250,187,187), rgb(238,130,146))', bg:'linear-gradient(to right, #fabbbb, #ee8292)'},
            {label:'海洋蓝', val:'linear-gradient(to right, rgb(56,189,248), rgb(59,130,246))', bg:'linear-gradient(to right, #38bdf8, #3b82f6)'},
            {label:'紫罗兰', val:'linear-gradient(to right, rgb(168,140,255), rgb(100,149,237))', bg:'linear-gradient(to right, #a88cff, #6495ed)'},
            {label:'深空蓝', val:'linear-gradient(to bottom, rgb(10,25,47), rgb(22,58,89))', bg:'linear-gradient(to bottom, #0a192f, #163a59)'},
            {label:'黄昏橙', val:'linear-gradient(to right, rgb(251,146,60), rgb(251,113,133))', bg:'linear-gradient(to right, #fb923c, #fb7185)'},
            {label:'薄荷绿', val:'linear-gradient(to right, rgb(110,231,183), rgb(52,211,153))', bg:'linear-gradient(to right, #6ee7b7, #34d399)'},
            {label:'暗夜黑', val:'#1a1a2e', bg:'#1a1a2e'},
            {label:'暖米白', val:'#f5f0eb', bg:'#f5f0eb'},
            {label:'星空紫', val:'linear-gradient(to bottom, rgb(67,56,202), rgb(124,58,237))', bg:'linear-gradient(to bottom, #4338ca, #7c3aed)'},
          ].map(p => `
            <div class="bg-preset-item" style="height:56px;border-radius:6px;cursor:pointer;overflow:hidden;position:relative;background:${p.bg};background-size:cover;"
                 data-val="${escapeHtml(p.val)}" title="${p.label}">
              <span style="position:absolute;bottom:0;left:0;right:0;padding:2px 0;text-align:center;font-size:11px;color:#fff;background:rgba(0,0,0,.35);">${p.label}</span>
            </div>
          `).join('')}
        </div>
        <input type="hidden" id="bg-preset-select" value="">
      </div>

      <!-- 随机图片模式 -->
      <div class="bg-mode-panel" id="bg-mode-random" style="display:${initialMode==='random'?'block':'none'};margin-bottom:14px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
          <span style="font-size:13px;color:#888;white-space:nowrap;">分类</span>
          <select id="bg-random-cat" style="flex:1;padding:8px;border:1px solid #ddd;border-radius:6px;font-size:13px;background:#fff;box-sizing:border-box;">
            <option value="pc" ${randomCat==='pc'?'selected':''}>PC 横图 · 通用</option>
            <option value="ycy" ${randomCat==='ycy'?'selected':''}>二次元 · 自适应</option>
            <option value="moez" ${randomCat==='moez'?'selected':''}>萌版 · 自适应</option>
            <option value="moe" ${randomCat==='moe'?'selected':''}>萌版 · 横图</option>
            <option value="ai" ${randomCat==='ai'?'selected':''}>AI · 自适应</option>
            <option value="fj" ${randomCat==='fj'?'selected':''}>风景 · 横图</option>
            <option value="bd" ${randomCat==='bd'?'selected':''}>白底 · 横图</option>
            <option value="ysz" ${randomCat==='ysz'?'selected':''}>原神 · 自适应</option>
            <option value="ys" ${randomCat==='ys'?'selected':''}>原神 · 横图</option>
            <option value="mp" ${randomCat==='mp'?'selected':''}>萌版 · 竖图</option>
            <option value="moemp" ${randomCat==='moemp'?'selected':''}>通用 · 竖图</option>
            <option value="aimp" ${randomCat==='aimp'?'selected':''}>AI · 竖图</option>
            <option value="ysmp" ${randomCat==='ysmp'?'selected':''}>原神 · 竖图</option>
            <option value="tx" ${randomCat==='tx'?'selected':''}>头像 · 方图</option>
            <option value="acg" ${randomCat==='acg'?'selected':''}>ACG · 动图</option>
            <option value="lai" ${randomCat==='lai'?'selected':''}>七濑胡桃</option>
            <option value="xhl" ${randomCat==='xhl'?'selected':''}>小狐狸</option>
          </select>
        </div>
        <div style="font-size:11px;color:#999;">
          图片由 <a href="https://t.alcy.cc" target="_blank" style="color:#f0911e;">t.alcy.cc（栗次元）</a> 提供 · 每次打开/刷新页面自动切换
        </div>
        <div id="bg-random-history" style="margin-top:10px;">
          ${(() => {
            const hist = getHistory();
            if (!hist.length) return '<div style="font-size:11px;color:#ccc;text-align:center;padding:8px 0;">暂无历史记录</div>';
            return `<div style="font-size:12px;color:#888;margin-bottom:6px;">历史记录（点击可直接设为背景）</div>
              <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;max-height:160px;overflow-y:auto;">
                ${hist.map(h => `
                <div class="bg-hist-item" data-url="${escapeHtml(h.url)}" data-cat="${escapeHtml(h.cat)}"
                     style="height:56px;border-radius:4px;cursor:pointer;overflow:hidden;position:relative;background-image:url(${escapeHtml(h.url)});background-size:cover;background-position:center;background-color:#eee;"
                     title="${escapeHtml(h.cat)} · ${new Date(h.time).toLocaleDateString()}">
                  <span style="position:absolute;top:2px;right:2px;background:rgba(0,0,0,.5);color:#fff;font-size:9px;padding:1px 4px;border-radius:2px;cursor:pointer;"
                        class="bg-hist-del">✕</span>
                </div>`).join('')}
              </div>
              <div style="text-align:right;margin-top:4px;"><a href="#" id="bg-hist-clear" style="font-size:10px;color:#ccc;text-decoration:none;">清空历史</a></div>`;
          })()}
        </div>
      </div>

      <!-- 不透明度 -->
      <div style="margin-bottom:14px;">
        <label style="display:block;font-weight:600;margin-bottom:6px;color:#555;">
          不透明度 <span id="bg-opacity-val" style="font-weight:400;color:#f0911e;">${currentOpacity}</span>
        </label>
        <input id="bg-input-opacity" type="range" min="0" max="3" step="0.05" value="${currentOpacity}"
          style="width:100%;accent-color:#f0911e;">
        <div style="display:flex;justify-content:space-between;font-size:11px;color:#bbb;">
          <span>全透明</span><span>默认</span><span>最不透明</span>
        </div>
      </div>

      <div style="display:flex;gap:8px;">
        <button id="bg-btn-apply" style="flex:1;padding:8px;background:#f0911e;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px;font-weight:600;">应用</button>
        <button id="bg-btn-reset" style="padding:8px 16px;background:#f5f5f5;color:#666;border:1px solid #ddd;border-radius:6px;cursor:pointer;font-size:13px;">重置默认</button>
      </div>
      <div style="margin-top:10px;font-size:11px;color:#aaa;text-align:center;">
        基于 rabbitohh 的 bangumi-css | 设置保存在浏览器本地
      </div>
    `;

    document.body.appendChild(btn);
    document.body.appendChild(panel);

    // ===== 事件绑定 =====
    btn.onclick = () => { panel.style.display = panel.style.display === 'none' ? 'block' : 'none'; };
    panel.querySelector('#bg-panel-close').onclick = () => { panel.style.display = 'none'; };

    const opacityInput = panel.querySelector('#bg-input-opacity');
    const opacityValEl = panel.querySelector('#bg-opacity-val');
    opacityInput.oninput = () => { opacityValEl.textContent = parseFloat(opacityInput.value).toFixed(2); };

    const preview = panel.querySelector('#bg-live-preview');

    panel.querySelectorAll('input[name="bg-mode"]').forEach(radio => {
      radio.addEventListener('change', () => {
        const mode = radio.value;
        panel.querySelectorAll('.bg-mode-panel').forEach(p => p.style.display = 'none');
        panel.querySelectorAll('.bg-mode-btn').forEach(l => { l.style.background = '#fff'; l.style.color = '#666'; });
        const panelEl = document.getElementById('bg-mode-' + mode);
        if (panelEl) panelEl.style.display = 'block';
        radio.closest('.bg-mode-btn').style.background = '#f0911e';
        radio.closest('.bg-mode-btn').style.color = '#fff';
        preview.style.background = buildBg();
        preview.style.backgroundSize = 'cover';
      });
    });

    const solidColorPicker = panel.querySelector('#bg-color-solid');
    const solidHexInput = panel.querySelector('#bg-color-hex');
    solidColorPicker.oninput = () => {
      solidHexInput.value = solidColorPicker.value;
      preview.style.background = solidColorPicker.value;
    };
    solidHexInput.oninput = () => {
      const v = solidHexInput.value.trim();
      if (/^#[0-9a-fA-F]{3,8}$/.test(v)) {
        solidColorPicker.value = v;
        preview.style.background = v;
      }
    };

    function updateGradPreview() {
      preview.style.background = buildBg();
      preview.style.backgroundSize = 'cover';
    }
    panel.querySelector('#bg-grad-dir').onchange = updateGradPreview;
    const gradC1 = panel.querySelector('#bg-grad-c1');
    const gradC2 = panel.querySelector('#bg-grad-c2');
    const gradHexes = panel.querySelectorAll('.bg-grad-hex');
    gradC1.oninput = () => { gradHexes[0].value = gradC1.value; updateGradPreview(); };
    gradC2.oninput = () => { gradHexes[1].value = gradC2.value; updateGradPreview(); };
    gradHexes[0].oninput = () => { const v=gradHexes[0].value.trim(); if(/^#[0-9a-fA-F]{3,8}$/.test(v)){gradC1.value=v;updateGradPreview();} };
    gradHexes[1].oninput = () => { const v=gradHexes[1].value.trim(); if(/^#[0-9a-fA-F]{3,8}$/.test(v)){gradC2.value=v;updateGradPreview();} };

    const imgUrlInput = panel.querySelector('#bg-img-url');
    imgUrlInput.oninput = () => {
      const v = imgUrlInput.value.trim();
      preview.style.background = v ? `url("${v}")` : '#ddd';
      preview.style.backgroundSize = 'cover';
    };

    const presetSelect = panel.querySelector('#bg-preset-select');
    panel.querySelectorAll('.bg-preset-item').forEach(item => {
      item.onclick = () => {
        presetSelect.value = item.dataset.val;
        preview.style.background = item.dataset.val;
        preview.style.backgroundSize = 'cover';
        panel.querySelectorAll('.bg-preset-item').forEach(x => x.style.outline = 'none');
        item.style.outline = '2px solid #f0911e';
      };
    });

    const randomCatSelect = panel.querySelector('#bg-random-cat');
    randomCatSelect.onchange = () => {
      preview.style.background = `url("https://t.alcy.cc/${randomCatSelect.value}")`;
      preview.style.backgroundSize = 'cover';
    };
    if (initialMode === 'random') {
      const hist = getHistory();
      if (hist.length && currentBg.includes('url(')) {
        preview.style.background = currentBg;
      } else {
        preview.style.background = `url("https://t.alcy.cc/${randomCat}")`;
      }
      preview.style.backgroundSize = 'cover';
    }

    panel.querySelector('#bg-random-history').addEventListener('click', (e) => {
      const delBtn = e.target.closest('.bg-hist-del');
      const item = e.target.closest('.bg-hist-item');
      const clearBtn = e.target.closest('#bg-hist-clear');
      if (delBtn) {
        e.stopPropagation();
        const url = item.dataset.url;
        removeHistory(url);
        item.remove();
        if (!panel.querySelector('.bg-hist-item')) {
          panel.querySelector('#bg-random-history').innerHTML = '<div style="font-size:11px;color:#ccc;text-align:center;padding:8px 0;">暂无历史记录</div>';
        }
        return;
      }
      if (clearBtn) {
        e.preventDefault();
        setHistory([]);
        panel.querySelector('#bg-random-history').innerHTML = '<div style="font-size:11px;color:#ccc;text-align:center;padding:8px 0;">暂无历史记录</div>';
        return;
      }
      if (item) {
        const url = item.dataset.url;
        currentBg = `url("${url}")`;
        setBg(currentBg);
        setMode('image');
        injectCSS();
        preview.style.background = currentBg;
        preview.style.backgroundSize = 'cover';
        const imgModeRadio = panel.querySelector('input[name="bg-mode"][value="image"]');
        if (imgModeRadio) {
          imgModeRadio.checked = true;
          imgModeRadio.dispatchEvent(new Event('change'));
        }
        panel.querySelector('#bg-img-url').value = url;
        panel.style.display = 'none';
      }
    });

    panel.querySelector('#bg-btn-apply').onclick = async () => {
      const mode = panel.querySelector('input[name="bg-mode"]:checked').value;
      currentBg = buildBg();
      currentOpacity = parseFloat(opacityInput.value);
      if (isNaN(currentOpacity) || currentOpacity < 0) currentOpacity = DEFAULT_OPACITY;

      if (mode === 'random') {
        const cat = panel.querySelector('#bg-random-cat').value;
        const realUrl = await fetchRandomUrl(cat);
        if (realUrl) {
          currentBg = `url("${realUrl}")`;
          addHistory(realUrl, cat);
        }
        setMode('random');
        setRandomCat(cat);
      } else {
        setMode(mode);
      }

      setBg(currentBg);
      setOpacity(currentOpacity);
      injectCSS();
      panel.style.display = 'none';
    };

    panel.querySelector('#bg-btn-reset').onclick = () => {
      currentBg = DEFAULT_BG;
      currentOpacity = DEFAULT_OPACITY;
      opacityInput.value = String(DEFAULT_OPACITY);
      opacityValEl.textContent = String(DEFAULT_OPACITY);
      setBg(DEFAULT_BG);
      setOpacity(DEFAULT_OPACITY);
      setMode('gradient');
      injectCSS();
      panel.style.display = 'none';
    };

    document.addEventListener('click', (e) => {
      if (panel.style.display === 'block' && !panel.contains(e.target) && e.target !== btn) {
        panel.style.display = 'none';
      }
    });
  }

  // ==================== 初始化 ====================
  (async function init() {
    const path = window.location.pathname;
    if (path.includes('/blog/') || path.includes('/group/topic/') || path.includes('/rakuen/topic/') || path.includes('/subject/topic/')) {
      document.documentElement.classList.add('bangumi-article-topic');
    }
    if (path.includes('/character/') || path.includes('/person/')) {
      document.documentElement.classList.add('bangumi-cover-page');
    }
    // ===== 新增：上传封面页面也添加 bangumi-cover-page 类 =====
    if (path.includes('/upload_img')) {
      document.documentElement.classList.add('bangumi-cover-page');
    }
    // ========================================================

    if (getMode() === 'random') {
      const cat = getRandomCat();
      const realUrl = await fetchRandomUrl(cat);
      if (realUrl) {
        currentBg = `url("${realUrl}")`;
        addHistory(realUrl, cat);
        setBg(currentBg);
      }
    }
    injectCSS();

    // ===== 新增：创建固定模糊背景层（仅关灯模式） =====
    if (document.documentElement.getAttribute('data-theme') === 'dark') {
        let blurBg = document.getElementById('blur-bg');
        if (!blurBg) {
            blurBg = document.createElement('div');
            blurBg.id = 'blur-bg';
            document.body.prepend(blurBg);
        }
        blurBg.style.background = currentBg;
        blurBg.style.backgroundSize = 'cover';
        blurBg.style.backgroundPosition = 'center';
    }
    // ===== 新增结束 =====

    createConfigUI();

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', startFixing);
    } else {
      startFixing();
    }
    
    // ===== 给角色介绍板块添加专属 class（不依赖 bangumi-cover-page） =====
setTimeout(function() {
    document.querySelectorAll('.subject_section.clearit').forEach(function(section) {
        var title = section.querySelector('h2.subtitle');
        if (title && title.textContent.indexOf('角色介绍') !== -1) {
            section.classList.add('bg-role-section');
        }
    });
}, 500);

// ===== 终极遮罩方案：给两个按钮加圆角遮罩 =====
(function() {
    function addMask(btn) {
        if (!btn) return;
        // 如果已经有遮罩了就不重复加
        if (btn.dataset.masked === '1') return;
        
        // 获取按钮的位置和大小
        var rect = btn.getBoundingClientRect();
        // 创建遮罩层
        var mask = document.createElement('div');
        mask.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            border-radius: 4px;
            overflow: hidden;
            pointer-events: none;
            background: transparent;
            box-shadow: 0 0 0 0px #F1979E;
            z-index: 1;
        `;
        // 让按钮变成相对定位，以便遮罩定位
        btn.style.position = 'relative';
        btn.style.zIndex = '0';
        btn.appendChild(mask);
        btn.dataset.masked = '1';
    }

    function fixButtons() {
        var addBtn = document.querySelector('a.add.thickbox:not(#addRelateBatch)');
        var batchBtn = document.querySelector('#addRelateBatch');
        if (addBtn) addMask(addBtn);
        if (batchBtn) addMask(batchBtn);
    }

    fixButtons();
    setTimeout(fixButtons, 200);
    var observer = new MutationObserver(fixButtons);
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(function() { observer.disconnect(); }, 3000);
})();

  })();
})();