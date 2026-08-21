import { searchRecords, type SearchRecord } from './search';

const MIN_QUERY_LENGTH = 2;
const MAX_ROWS = 5;

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[char] as string));
}

const KIND_LABEL: Record<SearchRecord['kind'], string> = {
  product: 'Product',
  guide: 'Guide',
  tool: 'Tool',
};

export function attachSearchDropdown(input: HTMLInputElement, form: HTMLFormElement) {
  const listbox = document.createElement('ul');
  listbox.id = 'headerSearchListbox';
  listbox.className = 'nav-search-listbox';
  listbox.setAttribute('role', 'listbox');
  listbox.setAttribute('data-testid', 'header-search-listbox');
  listbox.hidden = true;

  const status = document.createElement('p');
  status.className = 'visually-hidden';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('data-testid', 'header-search-status');

  form.append(listbox, status);

  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-controls', listbox.id);

  let records: SearchRecord[] | null = null;
  let rows: HTMLLIElement[] = [];
  let highlighted = -1;

  async function loadRecords() {
    if (records) return records;
    const response = await fetch('/search-index.json');
    records = ((await response.json()) as { records: SearchRecord[] }).records;
    return records;
  }

  function close() {
    listbox.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    highlighted = -1;
  }

  function highlight(index: number) {
    if (rows.length === 0) return;
    const next = (index + rows.length) % rows.length;
    rows.forEach((row, position) => row.setAttribute('aria-selected', String(position === next)));
    input.setAttribute('aria-activedescendant', rows[next].id);
    highlighted = next;
  }

  function open(query: string, matches: SearchRecord[]) {
    const seeAllHref = `/search/?q=${encodeURIComponent(query)}`;
    const resultRows = matches.length === 0
      ? `<li id="headerSearchEmpty" class="nav-search-row" role="option" aria-selected="false"
             data-testid="header-search-no-match" data-href="/inquiry-form/">
           <a href="/inquiry-form/">Nothing matched. Send an enquiry instead.</a>
         </li>`
      : matches.map((record, index) => `
          <li id="headerSearchOption${index}" class="nav-search-row" role="option" aria-selected="false"
              data-testid="header-search-option" data-href="${escapeHtml(record.url)}">
            <a href="${escapeHtml(record.url)}">
              <span>${escapeHtml(record.title)}</span>
              <span class="nav-search-kind">${KIND_LABEL[record.kind]}</span>
            </a>
          </li>`).join('');

    listbox.innerHTML = resultRows
      + `<li id="headerSearchSeeAll" class="nav-search-row" role="option" aria-selected="false"
             data-testid="header-search-see-all" data-href="${escapeHtml(seeAllHref)}">
           <a href="${escapeHtml(seeAllHref)}">See all results for &ldquo;${escapeHtml(query)}&rdquo;</a>
         </li>`;

    rows = Array.from(listbox.querySelectorAll('li'));
    listbox.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    highlighted = -1;
    status.textContent = `${matches.length} result${matches.length === 1 ? '' : 's'}`;
  }

  input.addEventListener('input', async () => {
    const query = input.value.trim();
    if (query.length < MIN_QUERY_LENGTH) {
      close();
      return;
    }
    const loaded = await loadRecords();
    open(query, searchRecords(loaded, query, { limit: MAX_ROWS }));
  });

  input.addEventListener('focus', () => { void loadRecords(); });

  input.addEventListener('keydown', (event) => {
    if (listbox.hidden) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      highlight(highlighted + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      highlight(highlighted - 1);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      close();
      input.focus();
    } else if (event.key === 'Enter' && highlighted >= 0) {
      event.preventDefault();
      const href = rows[highlighted].dataset.href;
      if (href) window.location.href = href;
    }
  });

  // Select on mousedown: blur fires before click, and closing on blur would
  // remove the row before the click could land on it.
  listbox.addEventListener('mousedown', (event) => {
    const row = (event.target as HTMLElement).closest('li');
    const href = row?.dataset.href;
    if (!href) return;
    event.preventDefault();
    window.location.href = href;
  });

  document.addEventListener('click', (event) => {
    if (!form.contains(event.target as Node)) close();
  });
}
