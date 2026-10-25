/** Buyable buildings in progression order. */
export const JOBS = [
  { id: 'dunmore-pike', number: 1, name: 'Dunmore & Pike Tax Services', tagline: 'STRIP-MALL TAX OFFICE', levelUrl: 'src/data/levels/dunmore-pike.json', cost: 0, requires: [] },
  { id: 'fairfax-credit-union', number: 2, name: 'Fairfax Regional Credit Union', tagline: 'BANK BRANCH WITH A VAULT', levelUrl: 'src/data/levels/fairfax-credit-union.json', cost: 2500, requires: ['dunmore-pike'] },
  { id: 'gilded-trust-tower', number: 3, name: 'Gilded Trust Bank Tower', tagline: 'HQ PENTHOUSE FLOOR', levelUrl: 'src/data/levels/gilded-trust-tower.json', cost: 9000, requires: ['fairfax-credit-union'] },
];

/** @returns {object|undefined} */
export const jobById = (id) => JOBS.find((j) => j.id === id);
