# Link Router

Link Router is an Obsidian plugin that gives specially delimited web links an alternate action while leaving ordinary links unchanged. Route marked links to a selected browser, a private browser window, the system browser, a custom launch command, or the clipboard.

By default, write a URL between curly braces:

```markdown
{https://example.com}
```

Add display text before the URL with a pipe:

```markdown
{Example site|https://example.com}
```

Ordinary bare URLs and Markdown links remain unchanged. The opening and closing delimiters are configurable.

## Behavior

- Desktop routes: selected browser normally, selected browser privately, system browser, custom launch arguments, or copy.
- Mobile routes: open normally or copy; optionally long-press to choose either action.
- Reading View and Live Preview are supported.
- Moving the editor cursor into a routed link reveals its source for editing.
- Chrome is the default browser. Edge, Firefox, Brave, and a custom executable are supported.
- The trailing icon is configurable.

## Privacy and system access

On desktop, browser-specific routes start the selected browser executable with the configured arguments and clicked HTTP or HTTPS URL. The plugin does not use a shell. The system-browser route asks Electron to open the URL normally. Custom executable paths and arguments are stored in the vault's plugin settings.

The plugin does not make network requests, collect analytics, or transmit vault contents. It accesses the clipboard only when a copy route is activated.

## Development

```bash
pnpm install
pnpm run check
```

The production build creates `main.js` at the repository root.

## License

MIT
