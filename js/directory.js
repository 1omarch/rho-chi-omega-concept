// Rho Chi Omega Member Portal — Directory search/render
// Expects DIRECTORY (array of {last, first, display, photo}) from directory-data.js
document.addEventListener('DOMContentLoaded', () => {
  const grid = document.getElementById('dir-grid');
  const search = document.getElementById('dir-search');
  const countEl = document.getElementById('dir-count');
  const emptyEl = document.getElementById('dir-empty');
  if (!grid || typeof DIRECTORY === 'undefined') return;

  const placeholder = 'images/single-ivy-leaf-tight.png';

  function cardHTML(person) {
    return `
      <div class="dir-card" data-name="${person.display.toLowerCase()}">
        <div class="dc-photo">
          <img src="${person.photo}" alt="${person.display}" loading="lazy"
               onerror="this.closest('.dc-photo').classList.add('no-photo'); this.src='${placeholder}'; this.alt='';">
        </div>
        <div class="dc-name">${person.display}</div>
      </div>`;
  }

  function render(list) {
    grid.innerHTML = list.map(cardHTML).join('');
    countEl.textContent = `${list.length} soror${list.length === 1 ? '' : 's'}`;
    emptyEl.classList.toggle('is-visible', list.length === 0);
  }

  render(DIRECTORY);

  if (search) {
    search.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase();
      const filtered = q ? DIRECTORY.filter(p => p.display.toLowerCase().includes(q)) : DIRECTORY;
      render(filtered);
    });
  }
});
