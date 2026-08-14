// Rho Chi Omega Member Portal — Directory search/render + pop-out
// Expects DIRECTORY (array of {last, first, display, photo, hasPhoto}) from directory-data.js
document.addEventListener('DOMContentLoaded', () => {
  const grid = document.getElementById('dir-grid');
  const search = document.getElementById('dir-search');
  const countEl = document.getElementById('dir-count');
  const emptyEl = document.getElementById('dir-empty');
  if (!grid || typeof DIRECTORY === 'undefined') return;

  const placeholder = 'images/single-ivy-leaf-tight.png';

  function cardHTML(person, idx) {
    const noPhoto = person.hasPhoto === false;
    return `
      <button type="button" class="dir-card" data-idx="${idx}" data-name="${person.display.toLowerCase()}">
        <div class="dc-photo${noPhoto ? ' no-photo' : ''}">
          <img src="${person.photo}" alt="" loading="lazy"
               onerror="this.closest('.dc-photo').classList.add('no-photo'); this.src='${placeholder}';">
        </div>
        <div class="dc-name">${person.display}</div>
      </button>`;
  }

  let currentList = DIRECTORY;

  function render(list) {
    currentList = list;
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

  /* ---------- soror pop-out ---------- */
  const modal = document.getElementById('modal-soror');
  const modalPhoto = document.getElementById('soror-photo');
  const modalPhotoWrap = document.getElementById('soror-photo-wrap');
  const modalName = document.getElementById('soror-name');

  function openSoror(person, trigger) {
    if (!modal) return;
    modalPhoto.src = person.photo;
    modalPhoto.alt = person.display;
    modalPhoto.style.objectFit = person.hasPhoto === false ? 'contain' : 'cover';
    modalPhotoWrap.style.padding = person.hasPhoto === false ? '2.2rem' : '0';
    modalName.textContent = person.display;
    modal.classList.add('is-open');
    document.body.classList.add('modal-open');
    const closeBtn = modal.querySelector('.modal-close');
    if (closeBtn) closeBtn.focus();
    modal.dataset.lastTrigger = '';
    if (trigger) trigger.setAttribute('data-was-trigger', '1');
  }

  grid.addEventListener('click', (e) => {
    const card = e.target.closest('.dir-card');
    if (!card) return;
    const idx = Number(card.dataset.idx);
    const person = currentList[idx];
    if (person) openSoror(person, card);
  });
});
