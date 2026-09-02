import {
  Notice,
  Platform,
  Plugin,
  PluginSettingTab,
  Setting,
  setIcon,
  type App
} from "obsidian";
import { StateEffect, Transaction } from "@codemirror/state";
import { Decoration, type DecorationSet, type EditorView, type ViewUpdate, ViewPlugin, WidgetType } from "@codemirror/view";
import { findRoutedLinks, isHttpUrl, validateSyntax, type LinkSyntax } from "./syntax";

type BrowserId = "chrome" | "edge" | "firefox" | "brave";
type IconId = "external-link" | "arrow-up-right" | "link" | "copy" | "none";
type DesktopRoute = "private" | "browser" | "system" | "copy" | "custom";
type MobileRoute = "open" | "copy";

interface LinkRouterSettings extends LinkSyntax {
  browser: BrowserId;
  desktopRoute: DesktopRoute;
  mobileRoute: MobileRoute;
  linkIcon: IconId;
  customExecutable: string;
  customArguments: string;
}

interface BrowserDefinition {
  name: string;
  privateArguments: string[];
  windows: Array<[string, string]>;
  mac: string[];
  linux: string[];
}

interface LaunchConfiguration {
  executable: string;
  args: string[];
  hasUrlPlaceholder: boolean;
}

interface ElectronWindow extends Window {
  require?: (id: string) => unknown;
  process?: NodeJS.Process;
}

const DEFAULT_SETTINGS: LinkRouterSettings = {
  openingDelimiter: "{",
  closingDelimiter: "}",
  browser: "chrome",
  desktopRoute: "private",
  mobileRoute: "copy",
  linkIcon: "external-link",
  customExecutable: "",
  customArguments: "--incognito {url}"
};

const BROWSERS: Record<BrowserId, BrowserDefinition> = {
  chrome: {
    name: "Google Chrome",
    privateArguments: ["--incognito"],
    windows: [
      ["LOCALAPPDATA", "Google\\Chrome\\Application\\chrome.exe"],
      ["PROGRAMFILES", "Google\\Chrome\\Application\\chrome.exe"],
      ["PROGRAMFILES(X86)", "Google\\Chrome\\Application\\chrome.exe"]
    ],
    mac: ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"],
    linux: ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"]
  },
  edge: {
    name: "Microsoft Edge",
    privateArguments: ["--inprivate"],
    windows: [
      ["PROGRAMFILES(X86)", "Microsoft\\Edge\\Application\\msedge.exe"],
      ["PROGRAMFILES", "Microsoft\\Edge\\Application\\msedge.exe"],
      ["LOCALAPPDATA", "Microsoft\\Edge\\Application\\msedge.exe"]
    ],
    mac: ["/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"],
    linux: ["microsoft-edge", "microsoft-edge-stable"]
  },
  firefox: {
    name: "Mozilla Firefox",
    privateArguments: ["-private-window"],
    windows: [
      ["PROGRAMFILES", "Mozilla Firefox\\firefox.exe"],
      ["PROGRAMFILES(X86)", "Mozilla Firefox\\firefox.exe"]
    ],
    mac: ["/Applications/Firefox.app/Contents/MacOS/firefox"],
    linux: ["firefox"]
  },
  brave: {
    name: "Brave",
    privateArguments: ["--incognito"],
    windows: [
      ["LOCALAPPDATA", "BraveSoftware\\Brave-Browser\\Application\\brave.exe"],
      ["PROGRAMFILES", "BraveSoftware\\Brave-Browser\\Application\\brave.exe"],
      ["PROGRAMFILES(X86)", "BraveSoftware\\Brave-Browser\\Application\\brave.exe"]
    ],
    mac: ["/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"],
    linux: ["brave-browser", "brave"]
  }
};

const refreshEditorEffect = StateEffect.define<void>();

function splitArguments(value: string): string[] {
  const result: string[] = [];
  const pattern = /"([^"]*)"|'([^']*)'|([^\s]+)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(value)) !== null) {
    result.push(match[1] ?? match[2] ?? match[3]);
  }
  return result;
}

function appendLinkIcon(link: HTMLAnchorElement, iconName: IconId): void {
  if (iconName === "none" || link.querySelector(":scope > .link-router-icon")) return;
  const icon = link.ownerDocument.createElement("span");
  icon.className = "link-router-icon";
  icon.setAttribute("aria-hidden", "true");
  setIcon(icon, iconName);
  link.append(icon);
}

class RoutedLinkWidget extends WidgetType {
  constructor(
    private readonly plugin: LinkRouterPlugin,
    private readonly url: string,
    private readonly displayText: string,
    private readonly from: number,
    private readonly to: number
  ) {
    super();
  }

  eq(other: RoutedLinkWidget): boolean {
    return other.url === this.url && other.displayText === this.displayText &&
      other.from === this.from && other.to === this.to;
  }

  toDOM(view: EditorView): HTMLElement {
    const document = view.dom.ownerDocument;
    const wrapper = document.createElement("span");
    wrapper.className = "link-router-widget";

    const makeEditEdge = (position: number, side: "left" | "right"): HTMLSpanElement => {
      const edge = document.createElement("span");
      edge.className = `link-router-edit-edge link-router-edit-edge-${side}`;
      edge.setAttribute("aria-label", "Edit routed link");
      edge.addEventListener("mousedown", (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        view.dispatch({
          selection: { anchor: position },
          annotations: Transaction.userEvent.of("select.pointer")
        });
        view.focus();
      });
      return edge;
    };

    wrapper.append(makeEditEdge(this.from, "left"));
    wrapper.append(this.plugin.createLinkElement(document, this.url, this.displayText));
    wrapper.append(makeEditEdge(this.to, "right"));
    return wrapper;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

function buildEditorDecorations(
  view: EditorView,
  plugin: LinkRouterPlugin,
  honorSelection: boolean
): DecorationSet {
  const decorations = [];
  const selections = view.state.selection.ranges;

  for (const range of view.visibleRanges) {
    const text = view.state.doc.sliceString(range.from, range.to);
    for (const match of findRoutedLinks(text, plugin.settings)) {
      const from = range.from + match.from;
      const to = range.from + match.to;
      const isBeingEdited = selections.some((selection) =>
        (selection.from >= from && selection.from <= to) ||
        (selection.to >= from && selection.to <= to)
      );
      if (honorSelection && isBeingEdited) continue;

      decorations.push(Decoration.replace({
        widget: new RoutedLinkWidget(plugin, match.url, match.displayText, from, to)
      }).range(from, to));
    }
  }

  return Decoration.set(decorations, true);
}

function createEditorExtension(plugin: LinkRouterPlugin) {
  return ViewPlugin.fromClass(class {
    decorations: DecorationSet;
    private honorSelection = false;

    constructor(private readonly view: EditorView) {
      plugin.editorViews.add(view);
      this.decorations = buildEditorDecorations(view, plugin, false);
    }

    update(update: ViewUpdate): void {
      const explicitSelection = update.transactions.some((transaction) =>
        transaction.isUserEvent("select") || transaction.isUserEvent("select.pointer")
      );
      const forcedRefresh = update.transactions.some((transaction) =>
        transaction.effects.some((effect) => effect.is(refreshEditorEffect))
      );
      if (explicitSelection) this.honorSelection = true;

      if (update.docChanged || update.viewportChanged || explicitSelection || forcedRefresh) {
        this.decorations = buildEditorDecorations(update.view, plugin, this.honorSelection);
      }
    }

    destroy(): void {
      plugin.editorViews.delete(this.view);
    }
  }, {
    decorations: (value) => value.decorations
  });
}

export default class LinkRouterPlugin extends Plugin {
  settings: LinkRouterSettings = DEFAULT_SETTINGS;
  readonly editorViews = new Set<EditorView>();

  async onload(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<LinkRouterSettings> | null);
    this.registerMarkdownPostProcessor((element) => this.renderRoutedLinks(element));
    this.registerEditorExtension(createEditorExtension(this));
    this.addSettingTab(new LinkRouterSettingTab(this.app, this));
  }

  createLinkElement(document: Document, url: string, displayText = url): HTMLAnchorElement {
    const link = document.createElement("a");
    link.className = "link-router-anchor";
    link.href = url;
    link.dataset.privateUrl = url;
    link.textContent = displayText;
    link.title = this.getActionLabel();
    appendLinkIcon(link, this.settings.linkIcon);
    link.addEventListener("mousedown", (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
    });
    link.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      void this.activateUrl(url);
    });
    return link;
  }

  private renderRoutedLinks(element: HTMLElement): void {
    this.upgradeAutoLinkedUrls(element);
    const document = element.ownerDocument;
    const walker = document.createTreeWalker(element, 4);
    const nodes: Text[] = [];
    let node: Node | null;

    while ((node = walker.nextNode()) !== null) {
      const textNode = node as Text;
      const parent = textNode.parentElement;
      if (!parent || parent.closest("a, code, pre, script, style")) continue;
      if (findRoutedLinks(textNode.nodeValue ?? "", this.settings).length > 0) nodes.push(textNode);
    }

    for (const textNode of nodes) {
      const text = textNode.nodeValue ?? "";
      const fragment = document.createDocumentFragment();
      let cursor = 0;
      for (const match of findRoutedLinks(text, this.settings)) {
        fragment.append(text.slice(cursor, match.from));
        fragment.append(this.createLinkElement(document, match.url, match.displayText));
        cursor = match.to;
      }
      fragment.append(text.slice(cursor));
      textNode.replaceWith(fragment);
    }
  }

  private upgradeAutoLinkedUrls(element: HTMLElement): void {
    const { openingDelimiter, closingDelimiter } = this.settings;
    for (const candidate of element.querySelectorAll<HTMLAnchorElement>("a[href^='http://'], a[href^='https://']")) {
      if (candidate.classList.contains("link-router-anchor")) continue;
      const previous = candidate.previousSibling;
      const next = candidate.nextSibling;
      if (previous?.nodeType !== 3 || next?.nodeType !== 3) continue;
      const previousText = previous as Text;
      const nextText = next as Text;
      if (!nextText.nodeValue?.startsWith(closingDelimiter)) continue;

      const previousValue = previousText.nodeValue ?? "";
      const aliasStart = previousValue.lastIndexOf(openingDelimiter);
      if (aliasStart < 0) continue;
      const prefix = previousValue.slice(0, aliasStart);
      const marker = previousValue.slice(aliasStart + openingDelimiter.length);
      const hasAlias = marker.endsWith("|");
      if (marker && !hasAlias) continue;
      const displayText = hasAlias ? marker.slice(0, -1).trim() : candidate.textContent ?? candidate.href;
      if (hasAlias && !displayText) continue;

      previousText.nodeValue = prefix;
      nextText.nodeValue = nextText.nodeValue.slice(closingDelimiter.length);
      candidate.classList.remove("external-link");
      candidate.classList.add("link-router-anchor");
      candidate.dataset.privateUrl = candidate.href;
      candidate.textContent = displayText;
      candidate.title = this.getActionLabel();
      appendLinkIcon(candidate, this.settings.linkIcon);
      candidate.addEventListener("mousedown", (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
      });
      candidate.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        void this.activateUrl(candidate.href);
      });
    }
  }

  private async activateUrl(url: string): Promise<void> {
    if (!isHttpUrl(url)) {
      new Notice("Link Router: blocked an invalid URL.", 8000);
      return;
    }
    if (Platform.isMobile) {
      if (this.settings.mobileRoute === "copy") await this.copyUrl(url);
      else await this.openSystem(url);
      return;
    }

    switch (this.settings.desktopRoute) {
      case "private":
        this.launchUrl(this.resolveSelectedBrowser(true), url);
        break;
      case "browser":
        this.launchUrl(this.resolveSelectedBrowser(false), url);
        break;
      case "system":
        await this.openSystem(url);
        break;
      case "copy":
        await this.copyUrl(url);
        break;
      case "custom":
        this.launchUrl(this.resolveCustomBrowser(), url);
        break;
    }
  }

  private async copyUrl(url: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(url);
      new Notice("Link copied");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      new Notice(`Link Router: could not copy link (${message})`, 8000);
    }
  }

  private getActionLabel(): string {
    if (Platform.isMobile) return this.settings.mobileRoute === "copy" ? "Copy URL" : "Open URL";
    switch (this.settings.desktopRoute) {
      case "private": return `Open privately in ${BROWSERS[this.settings.browser].name}`;
      case "browser": return `Open in ${BROWSERS[this.settings.browser].name}`;
      case "system": return "Open in system browser";
      case "copy": return "Copy URL";
      case "custom": return "Open with custom route";
    }
  }

  private resolveSelectedBrowser(privateMode: boolean): LaunchConfiguration {
    const runtimeWindow = window as ElectronWindow;
    const nodeRequire = runtimeWindow.require;
    if (!nodeRequire) throw new Error("Desktop runtime access is unavailable.");
    const { existsSync } = nodeRequire("node:fs") as typeof import("node:fs");

    const definition = BROWSERS[this.settings.browser];
    const platform = runtimeWindow.process?.platform;
    const environment = runtimeWindow.process?.env ?? {};

    if (platform === "win32") {
      for (const [environmentName, suffix] of definition.windows) {
        const root = environment[environmentName];
        if (!root) continue;
        const candidate = `${root}\\${suffix}`;
        if (existsSync(candidate)) return {
          executable: candidate,
          args: privateMode ? definition.privateArguments : [],
          hasUrlPlaceholder: false
        };
      }
    } else if (platform === "darwin") {
      const candidate = definition.mac.find((path) => existsSync(path));
      if (candidate) return {
        executable: candidate,
        args: privateMode ? definition.privateArguments : [],
        hasUrlPlaceholder: false
      };
    } else {
      return {
        executable: definition.linux[0],
        args: privateMode ? definition.privateArguments : [],
        hasUrlPlaceholder: false
      };
    }

    throw new Error(`${definition.name} was not found. Choose another browser or configure Custom.`);
  }

  private resolveCustomBrowser(): LaunchConfiguration {
    const executable = this.settings.customExecutable.trim();
    if (!executable) throw new Error("Set a custom browser executable in plugin settings.");
    const args = splitArguments(this.settings.customArguments);
    return { executable, args, hasUrlPlaceholder: args.some((argument) => argument.includes("{url}")) };
  }

  private async openSystem(url: string): Promise<void> {
    if (Platform.isMobile) {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }

    try {
      const nodeRequire = (window as ElectronWindow).require;
      if (!nodeRequire) throw new Error("Desktop runtime access is unavailable.");
      const electron = nodeRequire("electron") as { shell: { openExternal(value: string): Promise<void> } };
      await electron.shell.openExternal(url);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      new Notice(`Link Router: ${message}`, 8000);
    }
  }

  private launchUrl(launch: LaunchConfiguration, url: string): void {
    try {
      const runtimeWindow = window as ElectronWindow;
      const nodeRequire = runtimeWindow.require;
      if (!nodeRequire) throw new Error("Desktop runtime access is unavailable.");
      const { spawn } = nodeRequire("node:child_process") as typeof import("node:child_process");
      const args = launch.args.map((argument) => argument.replaceAll("{url}", url));
      if (!launch.hasUrlPlaceholder) args.push(url);

      const child = spawn(launch.executable, args, {
        detached: true,
        stdio: "ignore",
        shell: false,
        windowsHide: true
      });
      child.on("error", (error) => new Notice(`Link Router: ${error.message}`, 8000));
      child.unref();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      new Notice(`Link Router: ${message}`, 8000);
    }
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  refreshEditors(): void {
    for (const view of this.editorViews) {
      view.dispatch({ effects: refreshEditorEffect.of() });
    }
  }

  refreshIcons(): void {
    for (const view of this.editorViews) {
      for (const link of view.dom.querySelectorAll<HTMLAnchorElement>("a.link-router-anchor")) {
        link.querySelector(":scope > .link-router-icon")?.remove();
        appendLinkIcon(link, this.settings.linkIcon);
      }
    }
  }
}

class LinkRouterSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: LinkRouterPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Link Router" });
    containerEl.createEl("p", {
      text: "Delimited HTTP and HTTPS links use a configurable route. Ordinary links are unaffected."
    });

    const addDelimiterSetting = (name: string, key: "openingDelimiter" | "closingDelimiter"): void => {
      new Setting(containerEl)
        .setName(name)
        .setDesc("One non-whitespace character is recommended.")
        .addText((text) => {
          text.inputEl.maxLength = 4;
          text.setValue(this.plugin.settings[key]);
          text.onChange(async (value) => {
            const candidate = { ...this.plugin.settings, [key]: value };
            const error = validateSyntax(candidate);
            if (error) {
              text.inputEl.setCustomValidity(error);
              return;
            }
            text.inputEl.setCustomValidity("");
            this.plugin.settings[key] = value;
            await this.plugin.saveSettings();
            this.plugin.refreshEditors();
          });
        });
    };

    addDelimiterSetting("Opening delimiter", "openingDelimiter");
    addDelimiterSetting("Closing delimiter", "closingDelimiter");

    new Setting(containerEl)
      .setName("Link icon")
      .setDesc("Icon displayed at the end of routed links.")
      .addDropdown((dropdown) => dropdown
        .addOption("external-link", "External link (boxed arrow)")
        .addOption("arrow-up-right", "Arrow up-right")
        .addOption("link", "Link")
        .addOption("copy", "Copy")
        .addOption("none", "None")
        .setValue(this.plugin.settings.linkIcon)
        .onChange(async (value) => {
          this.plugin.settings.linkIcon = value as IconId;
          await this.plugin.saveSettings();
          this.plugin.refreshIcons();
        }));

    new Setting(containerEl)
      .setName("Mobile route")
      .setDesc("Action used when a routed link is activated on mobile.")
      .addDropdown((dropdown) => dropdown
        .addOption("copy", "Copy URL")
        .addOption("open", "Open normally")
        .setValue(this.plugin.settings.mobileRoute)
        .onChange(async (value) => {
          this.plugin.settings.mobileRoute = value as MobileRoute;
          await this.plugin.saveSettings();
        }));

    if (Platform.isMobile) return;

    new Setting(containerEl)
      .setName("Desktop route")
      .setDesc("Action used when a routed link is activated on desktop.")
      .addDropdown((dropdown) => dropdown
        .addOption("private", "Open selected browser privately")
        .addOption("browser", "Open selected browser normally")
        .addOption("system", "Open system default browser")
        .addOption("copy", "Copy URL")
        .addOption("custom", "Custom executable and arguments")
        .setValue(this.plugin.settings.desktopRoute)
        .onChange(async (value) => {
          this.plugin.settings.desktopRoute = value as DesktopRoute;
          await this.plugin.saveSettings();
          this.display();
        }));

    if (this.plugin.settings.desktopRoute === "private" || this.plugin.settings.desktopRoute === "browser") {
      new Setting(containerEl)
        .setName("Browser")
        .setDesc("Chrome is used by default.")
        .addDropdown((dropdown) => dropdown
        .addOption("chrome", "Google Chrome")
        .addOption("edge", "Microsoft Edge")
        .addOption("firefox", "Mozilla Firefox")
        .addOption("brave", "Brave")
        .setValue(this.plugin.settings.browser)
        .onChange(async (value) => {
          this.plugin.settings.browser = value as BrowserId;
          await this.plugin.saveSettings();
        }));
    }

    if (this.plugin.settings.desktopRoute === "custom") {
      new Setting(containerEl)
        .setName("Browser executable")
        .setDesc("Full path to the browser executable.")
        .addText((text) => text
          .setPlaceholder("C:\\Path\\To\\browser.exe")
          .setValue(this.plugin.settings.customExecutable)
          .onChange(async (value) => {
            this.plugin.settings.customExecutable = value;
            await this.plugin.saveSettings();
          }));

      new Setting(containerEl)
        .setName("Launch arguments")
        .setDesc("Use {url} where the URL should be inserted. If omitted, the URL is appended.")
        .addText((text) => text
          .setPlaceholder("--incognito {url}")
          .setValue(this.plugin.settings.customArguments)
          .onChange(async (value) => {
            this.plugin.settings.customArguments = value;
            await this.plugin.saveSettings();
          }));
    }
  }
}
