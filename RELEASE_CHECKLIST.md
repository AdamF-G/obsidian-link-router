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
- [x] Prerelease/stable workflow option and installable plugin ZIP
- [x] Local production build
- [x] Automated manifest, package version, versions map, description, and required-file checks

## Before public beta

- [ ] Install the `link-router` build in a dedicated test vault
- [ ] Test Chrome, Edge, Firefox, Brave, and custom executable behavior
- [x] Test Windows and iOS
- [ ] Obtain Android, macOS, and Linux community confirmation
- [ ] Test Reading View, Live Preview, Source mode, and pop-out windows
- [ ] Add screenshots to the README
- [ ] Review wording, accessibility, and privacy disclosure
- [x] Create a private GitHub repository after owner approval
- [x] Push the initial source after owner approval
- [x] Publish a prerelease for BRAT after owner approval

## Before Community Directory submission

- [ ] Collect beta feedback and fix confirmed defects
- [ ] Select and publish stable version 1.0.0
- [x] Verify `manifest.json` and `versions.json`
- [x] Publish matching beta release assets: `main.js`, `manifest.json`, `styles.css`
- [ ] Submit through community.obsidian.md only after owner approval
