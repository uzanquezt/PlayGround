import { Game } from './game.js';
import { bindTouchControls } from './input.js';

const canvas = document.getElementById('stage');
const game = new Game(canvas);
window.game = game;
bindTouchControls();

if (
  window.matchMedia('(pointer: coarse)').matches ||
  navigator.maxTouchPoints > 0 ||
  window.innerWidth < 760
) {
  document.body.classList.add('touch');
  const hints = [
    '<span><kbd>◀</kbd><kbd>▶</kbd> move</span>',
    '<span><kbd>↑</kbd> jump</span>',
    '<span><kbd>⚔</kbd> strike</span>',
    '<span><kbd>»</kbd> dash</span>',
    '<span><kbd>E</kbd> forge</span>'
  ].join('');
  document.querySelectorAll('.controls-card').forEach((card) => {
    card.innerHTML = hints;
  });
}
