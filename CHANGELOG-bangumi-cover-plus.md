# Bangumi 封面上传与切换增强版 · 更新日志

## v1.4.0

### 修复

- 修复暗黑模式下状态消息配色失效。此前 CSS 用 `[style*="#ffeeee"]` 匹配内联样式，浏览器会规范化成 `rgb(...)` 导致永不命中；改用 `.is-ok` / `.is-error` class。
- 修复 `$('head')` 依赖 jQuery，改为原生 DOM。
- 修复 `canvas.toBlob` 返回 null 时崩溃。
- 修复 `coverLnk.href` 只替换 `/r/400/`，改用 `/\/r\/[^/]+\//` 正则，兼容其他尺寸段。
- 修复压缩到极限（`quality < 0.1`）时报错不上传的问题，改为 `break` 用当前结果上传。
- 修复角色页按钮样式混用。检测到 luoli 区块时旧 `<li>` 被移除、新建 `<div>` 插入 luoli 左侧；找不到 luoli 就保持 `<li>` + `float:right` 原版样式。两种模式严格互斥。
- 修复按钮被替换后事件丢失，改用 document 委托。
- 修复下载路径强制转 JPEG 丢失透明度，改为检测透明度后决定格式。
- 修复投票按钮显示条件误判，改用 `normalizeCoverUrl()` 规范化比较。
- 修复封面列表 `indexOf` 匹配失败，改用规范化 URL 比较。
- 修复 `Referer` 请求头无效（浏览器静默忽略），投票改用 `fetch`。
- 修复上传表单加载失败无兜底，现在提供「点此前往手动上传页」链接。

### 新增

- 小图跳过压缩：本地文件或下载结果若 ≤ 4MB 且为 JPEG/PNG，直接原样上传，不再经过 canvas 二次编码。小图从 ~0.8s 降到瞬间完成，且少一次画质损失。
- 新增 `PASS_THROUGH_TYPES` 白名单，GIF / WebP 等格式仍走压缩，避免直传异常。
- 新增 `pushFileToInput()` 辅助函数，合并「预览 + 塞文件 + 显示提交」三段重复逻辑。
- 新增 `@noframes` 声明，防止脚本在 Bangumi 内嵌 iframe 中重复执行。
- 下载加入 `GM_TIMEOUT_MS`、`DOWNLOAD_PER_TRY_TIMEOUT_MS` 可调超时。

### 优化

- **压缩上限从 3MB 提到 4MB**。3MB 是 1.3.0 的硬编码保守值，与 Bangumi 实际服务器上限不符；4MB 是官网表单声明的值，稳定成功。
- **代理链从串行改为并行**：6 个通道同时发起，谁先成功用谁。最坏情况耗时从 ~72s 降至 ~30s。
- **`readAsDataURL` → `createObjectURL`**，省掉 base64 转换开销（约 100-300ms），替换时 `revokeObjectURL` 避免内存泄漏。
- **`@run-at` 从 `document-idle` 改为 `document-start`** + `MutationObserver`，按钮提前几秒出现。
- 预览从 `dataURL` 改为 `blob URL`，4K 图不再占用 10+MB 内存。
- 透明度检测改抽样（约 2 万像素），耗时降至 1/100。
- 弹窗定位加入边界收敛（`Math.max(8, ...)`），不会跑出屏幕左侧。
- `Notification` 存在性检查。
- 删除死代码与冗余注释，代码行数从 ~1290 精简至 ~1030。

### 变更细节

| 项目 | v1.3.0 | v1.4.0 |
|---|---|---|
| 压缩上限 | 3MB（硬编码） | 4MB（可配置） |
| 小图处理 | 走一次 canvas 编码 | 已达标直传，0 次编码 |
| 读文件方式 | `readAsDataURL` | `createObjectURL` |
| 预览方式 | `dataURL` | `blob URL` |
| 下载通道 | 串行 6 路 | **并行** 6 路 |
| 代理超时 | 12s / 通道 | GM 10s / 代理 30s |
| 下载透明 PNG | 强制 JPEG | 保留 PNG |
| 按钮注入时机 | `document-idle` | `document-start` + MutationObserver |
| 角色页按钮 | `<div>` 单一模式 | `<li>` / `<div>` 严格互斥 |
| 暗黑状态消息 | 属性选择器，从不命中 | class 切换，正常生效 |
| 投票提交 | XHR + 无效 Referer | fetch，自动带 referrer |
| 代码行数 | ~1290 | ~1030 |

## v1.3.0

### 修复

- 修复角色页按钮与 luoli commons 脚本按钮重叠。角色页的「上传封面」按钮改为搬进 luoli 的评分容器，显示在评分条左侧，不再挤走页面原有区块；subject / person 页保持原样。字号、字体、颜色自动对齐 luoli 评分按钮。
- 修复图片 URL 下载后出现两条重复提示。此前下载完成会先显示「已优化为 JPG 格式（下载：GM，xxx毫秒）」，随后被本地上传逻辑覆盖成「图片已优化为 JPG 格式」。现在 URL 下载只显示一条提示，不再重复压缩。

### 新增

- 下载状态显示走了哪条通道以及耗时，例如：`下载成功（GM，耗时 542ms），正在处理...`
- 下载多通道容错链。此前为 GM → Image 直连 → 荷兰 weserv 代理（三级 fallback）；现改为 GM 优先，失败时依次尝试直连 / yumus / wsrv / weserv / allorigins / corsproxy。解决国内无梯子环境下无法下载图片的问题。
- GM 请求超时与错误处理。此前 GM 请求无超时、无错误处理，失败时静默 fallback；现在有 12 秒超时和环境检查。

### 优化

- 删除无效 CSS 与未使用变量
- 精简冗余注释

### 变更细节

| 项目 | 旧版 | 新版 |
|---|---|---|
| 角色页按钮元素 | `<li>` + `float:right` | `<div>` + 搬进 luoli 容器 |
| 下载通道 | GM → Image → weserv | GM → 直连 → yumus → wsrv → weserv → allorigins → corsproxy |
| 下载耗时显示 | 无 | 有 |
| 下载路径显示 | 笼统名称 | 实际使用通道 |
| GM 超时 | 无 | 12 秒 |
| GM 环境检查 | 无 | 有 |
| URL 下载后 change 触发 | 重复压缩 + 覆盖提示 | `skipNextChange` 跳过 |
| 死代码 | `.btnCustom`、未使用 `url` 变量 | 已删 |

## 文件信息

- 当前版本：1.4.0
- 作用域：bgm.tv / chii.in / bangumi.tv 的 subject / character / person 页面
- 依赖：`GM_xmlhttpRequest`
- 许可：MIT
- 作者：minnmeichan（基于 Bios 原版修改）
- 上传上限：4MB（Bangumi 服务器稳定值）
- 下载通道：GM + 6 路并行代理
