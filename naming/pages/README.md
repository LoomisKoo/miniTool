# DeerNames Pages（GitHub Pages）

App Store Connect 的 Privacy / Support URL，以及 App 内 `LegalDocumentView` 加载的同一组地址。

部署到公开仓库 **[LoomisKoo/DeerNames-pages](https://github.com/LoomisKoo/DeerNames-pages)**（与 `BeadPattern-pages` 相同做法）：

1. 将本目录下 `privacy.html`、`support.html` 推到仓库根目录。
2. Settings → Pages → Source: `main` / root。
3. 确认可访问：
   - https://loomiskoo.github.io/DeerNames-pages/privacy.html
   - https://loomiskoo.github.io/DeerNames-pages/support.html

**注意：** 若 Pages 仓库改名，`.github.io/<repo>/` 旧地址会 404（GitHub 不会对 io 域名做跳转）。改仓库名后请同步改 `LegalDocumentView.swift` 与 `ios/APPSTORE.md`。

正文以本目录 HTML 为准；`naming/docs/*.md` 可作长文备份，大改时请两边一起更新。
