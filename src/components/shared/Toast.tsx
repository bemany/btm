// Imperative Toast — wie im Prototyp. Erzeugt ein Element direkt am body, fadet selbst.
// In React 18 kein Portal nötig, da der Lebenszyklus rein DOM-getrieben ist.

export function showToast(text: string): void {
  const el = document.createElement('div');
  el.className = 'toast';
  el.style.display = 'inline-flex';
  el.style.alignItems = 'center';
  el.style.gap = '8px';

  const icon = document.createElement('span');
  icon.style.color = 'var(--accent-500)';
  icon.style.display = 'inline-flex';
  icon.innerHTML =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>';

  const label = document.createElement('span');
  label.textContent = text;

  el.appendChild(icon);
  el.appendChild(label);
  document.body.appendChild(el);

  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity 200ms';
  }, 2400);
  setTimeout(() => el.remove(), 2700);
}
