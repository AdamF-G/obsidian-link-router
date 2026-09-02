# Release checklist

## Completed locally

- [x] Unique plugin ID and name: `link-router` / Link Router
- [x] TypeScript source and reproducible esbuild bundle
- [x] Configurable opening and closing delimiters, defaulting to `{` and `}`
- [x] Configurable desktop and mobile link routes
- [x] README, MIT license, changelog, contribution guide, manifest, and versions map
- [x] Parser and URL-scheme tests
- [x] TypeScript strict checking
- [x] Official Obsidian ESLint rules
- [x] CI and release-asset workflows
- [x] Local production build

## Before public beta

- [ ] Install the `link-router` build in a dedicated test vault
- [ ] Test Chrome, Edge, Firefox, Brave, and custom executable behavior
- [ ] Test Windows, macOS, Linux, Android, and iOS where available
- [ ] Test Reading View, Live Preview, Source mode, and pop-out windows
- [ ] Add screenshots to the README
- [ ] Review wording, accessibility, and privacy disclosure
- [x] Create a private GitHub repository after owner approval
- [x] Push the initial source after owner approval
- [ ] Publish a prerelease for BRAT only after owner approval

## Before Community Directory submission

- [ ] Collect beta feedback and fix confirmed defects
- [ ] Select the first stable semantic version
- [ ] Verify `manifest.json` and `versions.json`
- [ ] Publish matching GitHub release assets: `main.js`, `manifest.json`, `styles.css`
- [ ] Submit through community.obsidian.md only after owner approval
