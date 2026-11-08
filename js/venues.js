// Venue catalog. Each build() returns { group, background, fog, exposure, board, pieces, update }.
import { buildOval } from './venue-oval.js';
import { buildTitanic } from './venue-titanic.js';
import { buildLiberty } from './venue-liberty.js';

export const VENUES = {
  oval: { name: 'The Oval Office', short: 'Oval Office', blurb: 'Ivory & ebony on the coffee table, flags by the desk.', icon: '🏛️', build: buildOval, card: 'linear-gradient(135deg,#1b2f5e,#c9a24a)' },
  titanic: { name: 'Titanic Wreck', short: 'Titanic', blurb: 'Pearl vs bronze on the sunken deck, 12,500 ft down.', icon: '🌊', build: buildTitanic, card: 'linear-gradient(135deg,#02131f,#1d7fa6)' },
  liberty: { name: 'Lady Liberty’s Torch', short: 'Liberty', blurb: 'Gold vs copper on the torch balcony at sunset.', icon: '🗽', build: buildLiberty, card: 'linear-gradient(135deg,#f0a35e,#3f8f79)' },
};
