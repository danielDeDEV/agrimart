/**
 * Screen-building helpers for the USSD state machine.
 *
 * A USSD screen is hard-limited to 182 characters by most Ghanaian aggregators
 * (MTN truncates around 160). Everything here exists to keep screens short,
 * numbered and paginated so a farmer on a Nokia can always reach every record.
 */

const CON = (text) => `CON ${text}`;
const END = (text) => `END ${text}`;

const PAGE_SIZE = 5;

/** Renders `1. Maize\n2. Rice` from a list of labels. */
function numberedList(items, { start = 1, labelKey = 'label' } = {}) {
  return items
    .map((item, i) => {
      const label = typeof item === 'string' ? item : item[labelKey] ?? item.name;
      return `${start + i}. ${label}`;
    })
    .join('\n');
}

/**
 * Builds one page of a long list plus navigation hints.
 * Returns the screen text and the slice shown, so the caller can map the
 * farmer's numeric choice back to a record id.
 */
function paginatedScreen(title, items, page = 0, { pageSize = PAGE_SIZE, backLabel = 'Back', labelKey = 'label' } = {}) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const slice = items.slice(safePage * pageSize, safePage * pageSize + pageSize);

  const lines = [title];
  if (!slice.length) {
    lines.push('No records found.');
  } else {
    lines.push(numberedList(slice, { labelKey }));
  }

  const nav = [];
  if (safePage < totalPages - 1) nav.push('99. Next');
  if (safePage > 0) nav.push('98. Prev');
  nav.push(`0. ${backLabel}`);
  lines.push(nav.join('  '));

  if (totalPages > 1) lines.push(`Page ${safePage + 1}/${totalPages}`);

  return { text: lines.join('\n'), items: slice, page: safePage, totalPages };
}

/** Interprets 99/98/0 navigation before a screen tries to read a selection. */
function readNavigation(input, page, totalPages) {
  if (input === '99' && page < totalPages - 1) return { type: 'next', page: page + 1 };
  if (input === '98' && page > 0) return { type: 'prev', page: page - 1 };
  if (input === '0') return { type: 'back', page };
  return { type: 'select' };
}

/** Maps a 1-based on-screen choice to the record it represents. */
function pick(items, input) {
  const index = parseInt(input, 10) - 1;
  if (Number.isNaN(index) || index < 0 || index >= items.length) return null;
  return items[index];
}

const isNumeric = (v) => /^\d+$/.test(String(v || '').trim());
const isDecimal = (v) => /^\d+(\.\d{1,2})?$/.test(String(v || '').trim());
const isPin = (v) => /^\d{4}$/.test(String(v || '').trim());

/** Trims a screen to the aggregator limit without cutting mid-word. */
function fit(text, limit = 180) {
  if (text.length <= limit) return text;
  const cut = text.substring(0, limit - 3);
  return `${cut.substring(0, cut.lastIndexOf(' ') > 0 ? cut.lastIndexOf(' ') : cut.length)}...`;
}

/**
 * Builds a screen that must keep its options visible. Body lines are dropped
 * from the bottom until it fits, so the farmer never loses the numbered choices
 * to truncation — the failure mode that makes a USSD service unusable.
 */
function fitWithFooter(header, bodyLines, footerLines, limit = 180) {
  const footer = footerLines.filter(Boolean).join('\n');
  const lines = [...bodyLines];

  const assemble = () => [header, ...lines, '', footer].filter((l) => l !== undefined).join('\n');

  while (lines.length > 1 && assemble().length > limit) lines.pop();
  return fit(assemble(), limit);
}

/** Shortens a market name for a 160-character screen. */
const shortName = (name = '') =>
  String(name).replace(/\s+Market$/i, '').replace(/\s*,\s*/g, ' ').substring(0, 18);

module.exports = {
  CON, END, PAGE_SIZE, numberedList, paginatedScreen,
  readNavigation, pick, isNumeric, isDecimal, isPin, fit, fitWithFooter, shortName,
};
