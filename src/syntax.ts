export interface LinkSyntax {
  openingDelimiter: string;
  closingDelimiter: string;
}

export interface RoutedLinkMatch {
  from: number;
  to: number;
  url: string;
  displayText: string;
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function validateSyntax(syntax: LinkSyntax): string | null {
  if (!syntax.openingDelimiter) return "Opening delimiter cannot be empty.";
  if (!syntax.closingDelimiter) return "Closing delimiter cannot be empty.";
  if (/\s/.test(syntax.openingDelimiter) || /\s/.test(syntax.closingDelimiter)) {
    return "Delimiters cannot contain whitespace.";
  }
  return null;
}

export function createRoutedLinkRegExp(syntax: LinkSyntax, global = true): RegExp {
  const error = validateSyntax(syntax);
  if (error) throw new Error(error);
  const opening = escapeRegExp(syntax.openingDelimiter);
  const closing = escapeRegExp(syntax.closingDelimiter);
  const label = `((?:(?!${closing})[^\\r\\n])+?)\\|`;
  return new RegExp(`${opening}(?:${label})?(https?:\\/\\/[^\\s]+?)${closing}`, global ? "giu" : "iu");
}

export function findRoutedLinks(text: string, syntax: LinkSyntax): RoutedLinkMatch[] {
  const matches: RoutedLinkMatch[] = [];
  const regex = createRoutedLinkRegExp(syntax);
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const url = match[2];
    matches.push({
      from: match.index,
      to: match.index + match[0].length,
      url,
      displayText: match[1]?.trim() || url
    });
  }
  return matches;
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
