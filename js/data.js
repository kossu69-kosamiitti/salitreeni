// Siemendata: liikelista suomeksi, esimerkkiohjelma ja oletusasetukset

export const GROUPS = ['Rinta', 'Selkä', 'Jalat', 'Olkapäät', 'Hauis', 'Ojentajat', 'Vatsa', 'Muu'];

const E = (id, name, group) => ({ id, name, group, custom: false });

export const SEED_EXERCISES = [
  E('penkki', 'Penkkipunnerrus', 'Rinta'),
  E('vinopenkki', 'Vinopenkkipunnerrus', 'Rinta'),
  E('kh-penkki', 'Käsipainopenkkipunnerrus', 'Rinta'),
  E('rintaprassi', 'Rintaprässi', 'Rinta'),
  E('rintarist', 'Rintarist. taljassa', 'Rinta'),
  E('dippi', 'Dippi', 'Rinta'),
  E('maastaveto', 'Maastaveto', 'Selkä'),
  E('leuanveto', 'Leuanveto', 'Selkä'),
  E('ylatalja', 'Ylätalja', 'Selkä'),
  E('alatalja', 'Alatalja', 'Selkä'),
  E('tangosoutu', 'Tangolla soutu', 'Selkä'),
  E('kh-soutu', 'Käsipainosoutu', 'Selkä'),
  E('soutulaite', 'Soutulaite', 'Selkä'),
  E('takakyykky', 'Takakyykky', 'Jalat'),
  E('etukyykky', 'Etukyykky', 'Jalat'),
  E('jalkaprassi', 'Jalkaprässi', 'Jalat'),
  E('rmv', 'Romanialainen maastaveto', 'Jalat'),
  E('askelkyykky', 'Askelkyykky', 'Jalat'),
  E('bulg', 'Bulgarialainen askelkyykky', 'Jalat'),
  E('jalanojennus', 'Jalanojennus', 'Jalat'),
  E('reisikoukistus', 'Reisikoukistus', 'Jalat'),
  E('lantionnosto', 'Lantionnosto', 'Jalat'),
  E('pohje', 'Pohkeennosto', 'Jalat'),
  E('pystypunnerrus', 'Pystypunnerrus', 'Olkapäät'),
  E('kh-olkapaa', 'Käsipainopunnerrus (olkapäät)', 'Olkapäät'),
  E('sivunosto', 'Sivunosto', 'Olkapäät'),
  E('takaolkapaa', 'Takaolkapäänosto', 'Olkapäät'),
  E('facepull', 'Face pull', 'Olkapäät'),
  E('hauiskaanto', 'Hauiskääntö tangolla', 'Hauis'),
  E('kh-hauis', 'Hauiskääntö käsipainoilla', 'Hauis'),
  E('vasara', 'Vasarakääntö', 'Hauis'),
  E('ojentaja-talja', 'Ojentajapunnerrus taljassa', 'Ojentajat'),
  E('ranskalainen', 'Ranskalainen punnerrus', 'Ojentajat'),
  E('ojentaja-paa', 'Ojentajapunnerrus pään yli', 'Ojentajat'),
  E('vatsarutistus', 'Vatsarutistus', 'Vatsa'),
  E('roikkuva', 'Roikkuva jalannosto', 'Vatsa'),
  E('ab-wheel', 'Vatsarulla', 'Vatsa'),
];

const T = (id, name, order, items) => ({
  id,
  name,
  order,
  items: items.map(([exId, sets, reps]) => ({ exId, sets, reps })),
});

// Esimerkkiohjelma – muokattavissa Asetukset-välilehdellä
export const SEED_TEMPLATES = [
  T('tpl-a', 'Treeni A', 0, [
    ['takakyykky', 3, '5'],
    ['penkki', 3, '5'],
    ['tangosoutu', 3, '8'],
    ['pystypunnerrus', 3, '8'],
    ['vatsarutistus', 3, '12'],
  ]),
  T('tpl-b', 'Treeni B', 1, [
    ['maastaveto', 3, '5'],
    ['vinopenkki', 3, '8'],
    ['ylatalja', 3, '10'],
    ['askelkyykky', 3, '10'],
    ['hauiskaanto', 3, '10'],
  ]),
  T('tpl-c', 'Treeni C', 2, [
    ['jalkaprassi', 3, '10'],
    ['kh-penkki', 3, '10'],
    ['alatalja', 3, '10'],
    ['sivunosto', 3, '12'],
    ['ojentaja-talja', 3, '12'],
  ]),
];

export const DEFAULT_SETTINGS = {
  unit: 'kg',
  step: 2.5,
  rest: 90,
  bar: 20,
  plates: [25, 20, 15, 10, 5, 2.5, 1.25],
};

export const LB_DEFAULTS = { step: 5, bar: 45, plates: [45, 35, 25, 10, 5, 2.5] };
export const KG_DEFAULTS = { step: 2.5, bar: 20, plates: [25, 20, 15, 10, 5, 2.5, 1.25] };

export const SPORTS = ['Sähly', 'Juoksu', 'Jalkapallo', 'Pyöräily', 'Kävely', 'Uinti', 'Hiihto', 'Muu'];
