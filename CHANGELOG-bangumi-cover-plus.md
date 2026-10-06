# Bangumi 封面上传与切换增强版 · 更新日志

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

- 版本号：1.3.0
- 作用域：bgm.tv / chii.in / bangumi.tv 的 subject / character / person 页面
- 依赖：`GM_xmlhttpRequest`
- 许可：MIT
- 作者：minnmeichan（基于 Bios 原版修改）
