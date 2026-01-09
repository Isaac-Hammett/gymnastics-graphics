// Teams Database
// Single source of truth for all team data: logos, rosters, and metadata
// Each team is identified by a unique key in format: 'school-gender' (e.g., 'navy-mens', 'fisk-womens')

const teams = {
  // ============================================
  // WILLIAM & MARY
  // ============================================
  'william-mary-mens': {
    displayName: "William & Mary Men's",
    school: 'William & Mary',
    gender: 'mens',
    logo: 'https://media.virti.us/upload/images/team/MG4yA_-sLEqBckLyfy71-',
    roster: [],
  },
  'william-mary-womens': {
    displayName: "William & Mary Women's",
    school: 'William & Mary',
    gender: 'womens',
    logo: 'https://media.virti.us/upload/images/team/MG4yA_-sLEqBckLyfy71-',
    roster: [],
  },

  // ============================================
  // NAVY
  // ============================================
  'navy-mens': {
    displayName: "Navy Men's",
    school: 'Navy',
    gender: 'mens',
    logo: 'https://media.virti.us/upload/images/team/QtMgsTKjUwl0sEQwnlwNT',
    roster: [
      'Aaron Stein',
      'Aaron Zorgo',
      'Benjamin Thurlow Lam',
      'Benjamin Venters',
      'Boone Washburn',
      'Brian Solomon',
      'Cody Phillips',
      'Colby Prince',
      'Daniel Gurevich',
      'Danilo Viciana',
      'Garrett Lawless',
      'Jonah Soltz',
      'Julian Galvez',
      'Justin Lozano',
      'Kody Tokunaga',
      'Matthew Petros',
      'Matthew Zeigler',
      'McKinley Michel',
      'Michael Romo',
      'Nathan Bunten',
      'Payton Guillory',
      'Saran Alexander',
      'Sean Armstrong',
    ],
  },
  'navy-womens': {
    displayName: "Navy Women's",
    school: 'Navy',
    gender: 'womens',
    logo: 'https://media.virti.us/upload/images/team/QtMgsTKjUwl0sEQwnlwNT',
    roster: [],
  },

  // ============================================
  // CAL (UC BERKELEY)
  // ============================================
  'cal-mens': {
    displayName: "Cal Men's",
    school: 'Cal',
    gender: 'mens',
    logo: 'https://media.virti.us/upload/images/team/jfBUCDAAOrc9urkAN65iZ',
    roster: [
      'Brendan Strom',
      'Carter Kim',
      'Davide Comparin',
      'Evan Wenstad',
      'Finley Chin',
      'Harry Kim',
      'Jasper Smith-Gordon',
      'Jaxon Mitchell',
      'JD Ehinger',
      'Kaien Orion',
      'Khalen Curry',
      'Liam DeWeese',
      'Matteo Bardana',
      'Nathan Underhill',
      'Sam Cirlincione',
      'Theodor Roald Gadderud',
      'Trigg Dudley',
      'Troy Nuesca',
      'Tucker Yasunaga',
      'Will Horenziak',
    ],
  },
  'cal-womens': {
    displayName: "Cal Women's",
    school: 'Cal',
    gender: 'womens',
    logo: 'https://media.virti.us/upload/images/team/jfBUCDAAOrc9urkAN65iZ',
    roster: [],
  },

  // ============================================
  // STANFORD
  // ============================================
  'stanford-mens': {
    displayName: "Stanford Men's",
    school: 'Stanford',
    gender: 'mens',
    logo: 'https://media.virti.us/upload/images/team/TxEa6Awt5quagSXQIhqtk',
    roster: [
      'Arun Chhetri',
      'Asher Hong',
      'Cooper Kim',
      'David Shamah',
      'Deano Roberts',
      'Divier Ramos-Delgado',
      'Jowy Nieves',
      'Junnosuke Iwai',
      'Kai Uemura',
      'Kiran Mandava',
      'Marcus Kushner',
      'Marcus Pietarinen',
      'Michael Scheiner',
      'Nick Kuebler',
      'Reece Landsperger',
      'Toma Murakawa',
      'Wade Nelson',
      'Xander Hong',
      'Zachary Green',
    ],
  },
  'stanford-womens': {
    displayName: "Stanford Women's",
    school: 'Stanford',
    gender: 'womens',
    logo: 'https://media.virti.us/upload/images/team/TxEa6Awt5quagSXQIhqtk',
    roster: [],
  },

  // ============================================
  // FISK UNIVERSITY
  // ============================================
  'fisk-mens': {
    displayName: "Fisk Men's",
    school: 'Fisk',
    gender: 'mens',
    logo: 'https://media.virti.us/upload/images/team/OfBVOo4OcfTz9HyW5LcJz',
    roster: [],
  },
  'fisk-womens': {
    displayName: "Fisk Women's",
    school: 'Fisk',
    gender: 'womens',
    logo: 'https://media.virti.us/upload/images/team/OfBVOo4OcfTz9HyW5LcJz',
    roster: [
      'Aiyana Thomas',
      'Aliyah Reed-Hammon',
      'Allie Berkley',
      'Ciniah Rosby',
      'Hadassah Diggs',
      'Jordynn Cromartie',
      'Kennedi Johnson',
      'Liberty Mora',
      'Makia Rosado',
      'Sophia Pratt',
      'Zanna Brewer',
      'Zyia Coleman',
    ],
  },

  // ============================================
  // CENTENARY COLLEGE
  // ============================================
  'centenary-mens': {
    displayName: "Centenary Men's",
    school: 'Centenary',
    gender: 'mens',
    logo: 'https://media.virti.us/upload/images/team/qf-eFY2ramiGGd-35gIe3',
    roster: [],
  },
  'centenary-womens': {
    displayName: "Centenary Women's",
    school: 'Centenary',
    gender: 'womens',
    logo: 'https://media.virti.us/upload/images/team/qf-eFY2ramiGGd-35gIe3',
    roster: [
      'Amy Foret',
      'Anna Ichiba',
      'Brooke Murdock',
      'Cecilia Paredes',
      'Chloe Gilbert',
      'Claire Flores',
      'Erin Pinder',
      'Hayden Cagle',
      'Lelia Dunlavy',
      'Mallory Stephens',
      'Molly English',
      'Nyah Washington',
      'Olivia Montgomery',
      'Olivia Stratmann',
      'Olivia Williams',
      'Peyton Burford',
      'Riley Navarro',
      'Skyla Cruz',
    ],
  },

  // ============================================
  // WILBERFORCE UNIVERSITY
  // ============================================
  'wilberforce-mens': {
    displayName: "Wilberforce Men's",
    school: 'Wilberforce',
    gender: 'mens',
    logo: 'https://media.virti.us/upload/images/team/zOJ1Nd2gMndq1UlNH-PT4',
    roster: [],
  },
  'wilberforce-womens': {
    displayName: "Wilberforce Women's",
    school: 'Wilberforce',
    gender: 'womens',
    logo: 'https://media.virti.us/upload/images/team/zOJ1Nd2gMndq1UlNH-PT4',
    roster: [
      'Carli Finkley',
      'Danielle Johnson',
      'Diamond Cook',
      'Emily Herrera',
      'Hannah Gouldbourne',
      'Jaidyn Bryant',
      'Kaleigh Garner',
      'Mackenzie Butler',
      'Madison Kelly',
      'Makiyah Davis',
      'Mikayla Clements',
      'Myca Kelly',
      'Myna Caines',
      "N'Diah Brown",
      'Nishayla Riley',
      'Promise Jean-Marie',
      'Sadara Mayhorn',
      'Saniah Smith',
      'Sydney Smith',
    ],
  },

  // ============================================
  // GREENVILLE UNIVERSITY
  // ============================================
  'greenville-mens': {
    displayName: "Greenville Men's",
    school: 'Greenville',
    gender: 'mens',
    logo: 'https://media.virti.us/upload/images/team/DvpQ8aJqMsi2aXyHkqWpb',
    roster: [],
  },
  'greenville-womens': {
    displayName: "Greenville Women's",
    school: 'Greenville',
    gender: 'womens',
    logo: 'https://media.virti.us/upload/images/team/DvpQ8aJqMsi2aXyHkqWpb',
    roster: [
      'Alessia Russo',
      'Alexis Stonebraker',
      'Amara Nelson',
      'Aubrey Kenimer',
      'Christianna Cutler',
      'Ellery Gilmer',
      'Elli Schnieders',
      'Emma Brannon',
      'Faye Jones',
      'Isabella Feltman',
      'Izabella Yanis',
      'Laila Manley',
      'Madison Carter',
      'Madison Ford',
      'Matilda Brougham',
      'Maycee McKnight',
      'Naima Murray',
      'Olivia Tocco',
      'Reagan Rodriguez',
      'Reese Clapper',
      'Roya Zehtab',
      'Taylor Templin',
      'Valeria Arraiz',
    ],
  },

  // ============================================
  // MARYLAND
  // ============================================
  'maryland-mens': {
    displayName: "Maryland Men's",
    school: 'Maryland',
    gender: 'mens',
    logo: 'https://media.virti.us/upload/images/team/b3SmbX-UKRPk1HkzRPrD_',
    roster: [],
  },
  'maryland-womens': {
    displayName: "Maryland Women's",
    school: 'Maryland',
    gender: 'womens',
    logo: 'https://media.virti.us/upload/images/team/b3SmbX-UKRPk1HkzRPrD_',
    roster: [],
  },

  // ============================================
  // GEORGE WASHINGTON
  // ============================================
  'george-washington-mens': {
    displayName: "George Washington Men's",
    school: 'George Washington',
    gender: 'mens',
    logo: 'https://media.virti.us/upload/images/team/R7CeYsmiyWvBNZKrG88UH',
    roster: [],
  },
  'george-washington-womens': {
    displayName: "George Washington Women's",
    school: 'George Washington',
    gender: 'womens',
    logo: 'https://media.virti.us/upload/images/team/R7CeYsmiyWvBNZKrG88UH',
    roster: [],
  },

  // ============================================
  // ILLINOIS
  // ============================================
  'illinois-mens': {
    displayName: "Illinois Men's",
    school: 'Illinois',
    gender: 'mens',
    logo: 'https://media.virti.us/upload/images/team/t9wWLsOPF2bpVZHqjsogl',
    roster: [],
  },
  'illinois-womens': {
    displayName: "Illinois Women's",
    school: 'Illinois',
    gender: 'womens',
    logo: 'https://media.virti.us/upload/images/team/t9wWLsOPF2bpVZHqjsogl',
    roster: [],
  },

  // ============================================
  // SPRINGFIELD
  // ============================================
  'springfield-mens': {
    displayName: "Springfield Men's",
    school: 'Springfield',
    gender: 'mens',
    logo: 'https://media.virti.us/upload/images/team/B90OmKJn62sRjh404Y3eD',
    roster: [
      'Anthony Casciano',
      'Blaise Rousseau',
      'Brian Delf',
      'Broc Rousseau',
      'Cameron Rhymes',
      'Carl Jacob Soederqvist',
      'Devon Felsenstein',
      'Donovan Salva',
      'Evan Reichert',
      'Gustavin Suess',
      'Jesse Listopad',
      'Joshua Szitanko',
      'Kaleb Palacio',
      'Mason Lupp',
      'Michael Dalton',
      'Noam Toledano',
      'Nolan Prim',
      'Owen Carney',
      'Peyton Cramer',
      'Sergio Gasparini',
      'Skyler Cook',
      'Tristan Tacconi',
      'Tyler Beekman',
    ],
  },
  'springfield-womens': {
    displayName: "Springfield Women's",
    school: 'Springfield',
    gender: 'womens',
    logo: 'https://media.virti.us/upload/images/team/B90OmKJn62sRjh404Y3eD',
    roster: [],
  },

  // ============================================
  // MICHIGAN
  // ============================================
  'michigan-mens': {
    displayName: "Michigan Men's",
    school: 'Michigan',
    gender: 'mens',
    logo: 'https://media.virti.us/upload/images/team/OlF6zJbX8C_3TY7v_vL5S',
    roster: [],
  },
  'michigan-womens': {
    displayName: "Michigan Women's",
    school: 'Michigan',
    gender: 'womens',
    logo: 'https://media.virti.us/upload/images/team/OlF6zJbX8C_3TY7v_vL5S',
    roster: [],
  },

  // ============================================
  // SIMPSON
  // ============================================
  'simpson-mens': {
    displayName: "Simpson Men's",
    school: 'Simpson',
    gender: 'mens',
    logo: 'https://media.virti.us/upload/images/team/5iJiCZuUmn0V7FPYx6-Oh',
    roster: [],
  },
  'simpson-womens': {
    displayName: "Simpson Women's",
    school: 'Simpson',
    gender: 'womens',
    logo: 'https://media.virti.us/upload/images/team/5iJiCZuUmn0V7FPYx6-Oh',
    roster: [],
  },

  // ============================================
  // PENN STATE
  // ============================================
  'penn-state-mens': {
    displayName: "Penn State Men's",
    school: 'Penn State',
    gender: 'mens',
    logo: 'https://media.virti.us/upload/images/team/6Ju2q59cmDgc7NU-VCdEg',
    roster: [],
  },
  'penn-state-womens': {
    displayName: "Penn State Women's",
    school: 'Penn State',
    gender: 'womens',
    logo: 'https://media.virti.us/upload/images/team/6Ju2q59cmDgc7NU-VCdEg',
    roster: [],
  },

  // ============================================
  // ARMY
  // ============================================
  'army-mens': {
    displayName: "Army Men's",
    school: 'Army',
    gender: 'mens',
    logo: 'https://media.virti.us/upload/images/team/wmICCck438BshXvBlPHV_',
    roster: [],
  },
  'army-womens': {
    displayName: "Army Women's",
    school: 'Army',
    gender: 'womens',
    logo: 'https://media.virti.us/upload/images/team/wmICCck438BshXvBlPHV_',
    roster: [],
  },
};

// Athlete headshots - maps normalized name to Virtius URL
const athleteHeadshots = {
  // Navy
  'aaron stein': 'https://media.virti.us/upload/images/athlete/bVREzuzMfJF5Pi3INKuss',
  'aaron zorgo': 'https://media.virti.us/upload/images/athlete/RNYnjPd8T8bVwuAqicvdA',
  'benjamin thurlow lam': 'https://media.virti.us/upload/images/athlete/ThZW7XIbg2YbyXJ2EnD7H',
  'benjamin venters': 'https://media.virti.us/upload/images/athlete/r-oKniK7q45of_qtKATRp',
  'boone washburn': 'https://media.virti.us/upload/images/athlete/ZQ3tK20Awuf-PB6Xr2tlo',
  'brian solomon': 'https://media.virti.us/upload/images/athlete/zxKpzPO1WD1wuCTqu7yPR',
  'cody phillips': 'https://media.virti.us/upload/images/athlete/CBgJfcoBg99i_6dyApgPK',
  'colby prince': 'https://media.virti.us/upload/images/athlete/G7njrXwnxJ-EEKmGfPNFE',
  'daniel gurevich': 'https://media.virti.us/upload/images/athlete/kkZkc2xI9W89c57kITtbt',
  'danilo viciana': 'https://media.virti.us/upload/images/athlete/cSSPoHA9GXaHtV75aV61n',
  'garrett lawless': 'https://media.virti.us/upload/images/athlete/YbATup9pdxGJULqPmjenU',
  'jonah soltz': 'https://media.virti.us/upload/images/athlete/7Wp4vRjGrChEPu8Mwd_sq',
  'julian galvez': 'https://media.virti.us/upload/images/athlete/5Fmj6ulMKyhrDvUwIKBvm',
  'justin lozano': 'https://media.virti.us/upload/images/athlete/X8uS5pYTvziEg7UctRMTL',
  'kody tokunaga': 'https://media.virti.us/upload/images/athlete/7T-wvjPMsWIpiGClmVOgS',
  'matthew petros': 'https://media.virti.us/upload/images/athlete/Cf_PyziTQlB1O82sDBiww',
  'matthew zeigler': 'https://media.virti.us/upload/images/athlete/a3culpWPBE-_iMG44An6d',
  'mckinley michel': 'https://media.virti.us/upload/images/athlete/Zzm1XxWflm3d6afQPPZFg',
  'michael romo': 'https://media.virti.us/upload/images/athlete/m9Ujh6AViDf4uUUIFKaPQ',
  'payton guillory': 'https://media.virti.us/upload/images/athlete/Ic6oFPMimFW7FMuJtNxMw',
  'saran alexander': 'https://media.virti.us/upload/images/athlete/TrNnHtfYrH5BozHozZzvL',
  'sean armstrong': 'https://media.virti.us/upload/images/athlete/SCrZqcbmFrPnJqOSu77bG',

  // Cal
  'brendan strom': 'https://media.virti.us/upload/images/athlete/1cVXy-T-5mgwnNav4VJ6k',
  'carter kim': 'https://media.virti.us/upload/images/athlete/COfO8fbGgFA_ZBnE37ndJ',
  'davide comparin': 'https://media.virti.us/upload/images/athlete/R8Y1dfHBDHeiszcSGw3Wd',
  'evan wenstad': 'https://media.virti.us/upload/images/athlete/ZmxVIe-6MFDVd1U9wXCdK',
  'finley chin': 'https://media.virti.us/upload/images/athlete/f3STeUMwZ0TVWsu5w6J2b',
  'harry kim': 'https://media.virti.us/upload/images/athlete/hIqN7d97gKOnCC2G_5fk5',
  'jasper smith-gordon': 'https://media.virti.us/upload/images/athlete/ceZUXMm4uDBQSSqVh9zXZ',
  'jaxon mitchell': 'https://media.virti.us/upload/images/athlete/P29GhcR9nqOqN3aVASjaE',
  'jd ehinger': 'https://media.virti.us/upload/images/athlete/kz5pENbBzHno2zd0CllHl',
  'kaien orion': 'https://media.virti.us/upload/images/athlete/wXur_UvfSugKysN6D8Olm',
  'khalen curry': 'https://media.virti.us/upload/images/athlete/nMiYTGBmoDQibJ6cGExHv',
  'liam deweese': 'https://media.virti.us/upload/images/athlete/n9jC3XkZoWTj3D6da3s3M',
  'matteo bardana': 'https://media.virti.us/upload/images/athlete/SmVMJA7m8A6AcYGsi51oD',
  'nathan underhill': 'https://media.virti.us/upload/images/athlete/gLKC-_s0WAuZGXo8LRTzV',
  'sam cirlincione': 'https://media.virti.us/upload/images/athlete/HkzVaqzoshqzieNTnBev7',
  'theodor roald gadderud': 'https://media.virti.us/upload/images/athlete/eMTETdroQg1Nl73PIhR8n',
  'trigg dudley': 'https://media.virti.us/upload/images/athlete/L7dfIQiIDF2ao7T8n4Mm5',
  'troy nuesca': 'https://media.virti.us/upload/images/athlete/iX_ld2SgoQNEyCPNg_ASM',
  'tucker yasunaga': 'https://media.virti.us/upload/images/athlete/EYAEZe97glrJFWqyiReUm',
  'will horenziak': 'https://media.virti.us/upload/images/athlete/3XEFbFASgcKc2x720zZfJ',

  // Stanford
  'arun chhetri': 'https://media.virti.us/upload/images/athlete/j_v4sIFnfBzHUwleTC68X',
  'asher hong': 'https://media.virti.us/upload/images/athlete/aH7Kk874GhAh590PuEVFK',
  'cooper kim': 'https://media.virti.us/upload/images/athlete/0IBtstDrlJxbpErwM_UNp',
  'david shamah': 'https://media.virti.us/upload/images/athlete/QvYoTeG65O4dMEUdjNuBw',
  'deano roberts': 'https://media.virti.us/upload/images/athlete/PYQP_A7cjIs43SZv3i6qb',
  'divier ramos-delgado': 'https://media.virti.us/upload/images/athlete/vJXpAVVkqcDWWnPcbC190',
  'jowy nieves': 'https://media.virti.us/upload/images/athlete/IEXuMRTPVcettEEuebjfV',
  'junnosuke iwai': 'https://media.virti.us/upload/images/athlete/W9sFpRcn6HvjjByDVYpp-',
  'kai uemura': 'https://media.virti.us/upload/images/athlete/n83H-u8_JtPWdGLwlQuzz',
  'kiran mandava': 'https://media.virti.us/upload/images/athlete/yOzUdi_gNYlXjYSer5KfA',
  'marcus kushner': 'https://media.virti.us/upload/images/athlete/fAbKKbZZNJccKh9F8nzWj',
  'marcus pietarinen': 'https://media.virti.us/upload/images/athlete/lOtiWvRbryKEPMpQ14sqK',
  'michael scheiner': 'https://media.virti.us/upload/images/athlete/h59SVg975ou4-i5__6rlH',
  'nick kuebler': 'https://media.virti.us/upload/images/athlete/NohCBsw4JRhcakpVG7BBV',
  'reece landsperger': 'https://media.virti.us/upload/images/athlete/DoN-UgHC2qrI4nbeZg1F6',
  'toma murakawa': 'https://media.virti.us/upload/images/athlete/q-quTVY2a-8bzzI4jnIyd',
  'wade nelson': 'https://media.virti.us/upload/images/athlete/q4wfg5mr_FnE4YrjNwUI6',
  'xander hong': 'https://media.virti.us/upload/images/athlete/quAXgfD40w-f5mLDzqrGQ',
  'zachary green': 'https://media.virti.us/upload/images/athlete/coBnRbQygRwoK6epO36LC',

  // Fisk (Women's)
  'aiyana thomas': 'https://media.virti.us/upload/images/athlete/QCIWQjesQnaUAKhnE-tnL',
  'aliyah reed-hammon': 'https://media.virti.us/upload/images/athlete/M83B6Hrx3nKLNX9e7PSf6',
  'allie berkley': 'https://media.virti.us/upload/images/athlete/1FM5JNidhdVPTWlCIEYTM',
  'ciniah rosby': 'https://media.virti.us/upload/images/athlete/u46EN0dgCtUgN3sAOoiVy',
  'hadassah diggs': 'https://media.virti.us/upload/images/athlete/i72U-MXljHxgEw8A8r5iy',
  'jordynn cromartie': 'https://media.virti.us/upload/images/athlete/S2DO-FlczUy33MMzfU3uq',
  'kennedi johnson': 'https://media.virti.us/upload/images/athlete/6u82DqwshCFIWiAYtBnbd',
  'liberty mora': 'https://media.virti.us/upload/images/athlete/oyGyeVtmmPQQW0lCFD_w8',
  'makia rosado': 'https://media.virti.us/upload/images/athlete/_6WhV5x-9sKeK3lEIlwjr',
  'sophia pratt': 'https://media.virti.us/upload/images/athlete/X7rB2_ZgSFDXfs0eW8UFr',
  'zanna brewer': 'https://media.virti.us/upload/images/athlete/v0oBQIJ7H0TkxBS55xK47',
  'zyia coleman': 'https://media.virti.us/upload/images/athlete/kXS5CGn6ch1iQYC3YRFT5',

  // Centenary (Women's)
  'amy foret': 'https://media.virti.us/upload/images/athlete/YSWTModYqlsFZK3WdnrzK',
  'anna ichiba': 'https://media.virti.us/upload/images/athlete/Fvt_cH77bWufJ6juvuLZR',
  'brooke murdock': 'https://media.virti.us/upload/images/athlete/TwDo2-r9291i3bb5oVzVC',
  'cecilia paredes': 'https://media.virti.us/upload/images/athlete/GiglP2tBIueo166zWsS7d',
  'chloe gilbert': 'https://media.virti.us/upload/images/athlete/MmdqdhRFTWjiOnBSBi61B',
  'claire flores': 'https://media.virti.us/upload/images/athlete/YQeKZjm_C3LHO6Ne7G287',
  'erin pinder': 'https://media.virti.us/upload/images/athlete/s3wYoVHXVoLMulUc15Xyd',
  'hayden cagle': 'https://media.virti.us/upload/images/athlete/4SPIOiKHVs07SAZwDWbXQ',
  'lelia dunlavy': 'https://media.virti.us/upload/images/athlete/KugvvPNIFcWhwFQjE04cP',
  'mallory stephens': 'https://media.virti.us/upload/images/athlete/xSsPI3ZZ2wp14L-g0oQbK',
  'molly english': 'https://media.virti.us/upload/images/athlete/WxKykVl1ufwVxRVCw6iGO',
  'nyah washington': 'https://media.virti.us/upload/images/athlete/BRnuNCn2gSFlC2WDDwP1D',
  'olivia montgomery': 'https://media.virti.us/upload/images/athlete/FzXmVWGhGkfm7OtLm55q1',
  'olivia stratmann': 'https://media.virti.us/upload/images/athlete/Ub9lMyNwtBW8TPnx4nrbv',
  'olivia williams': 'https://media.virti.us/upload/images/athlete/qGG7TVOvXqk5K5sUxGGHN',
  'peyton burford': 'https://media.virti.us/upload/images/athlete/vnemcpLN8OwerOEuAPacV',
  'riley navarro': 'https://media.virti.us/upload/images/athlete/dEyNMURLSl7Rw-SIO1hwt',
  'skyla cruz': 'https://media.virti.us/upload/images/athlete/ChsX3x1OD2yJiwnpV8kts',

  // Wilberforce (Women's)
  'carli finkley': 'https://media.virti.us/upload/images/athlete/jRQJcUOc-91YvL4TF9Gpp',
  'danielle johnson': 'https://media.virti.us/upload/images/athlete/M2kvQSaF6z4Yp6VeoqurV',
  'diamond cook': 'https://media.virti.us/upload/images/athlete/dh8QK5ckClYJSNysBpEBe',
  'emily herrera': 'https://media.virti.us/upload/images/athlete/yciQBEg0HXty3ugDhlwHK',
  'hannah gouldbourne': 'https://media.virti.us/upload/images/athlete/LtoKResa_Bc0u0ZXB_mJx',
  'jaidyn bryant': 'https://media.virti.us/upload/images/athlete/EOLLc780NzbKv6loHhCuX',
  'kaleigh garner': 'https://media.virti.us/upload/images/athlete/rjSs6Hu8q7ympHQ2ZQ1Ng',
  'mackenzie butler': 'https://media.virti.us/upload/images/athlete/V2CeS42mKVR7It524CAWR',
  'madison kelly': 'https://media.virti.us/upload/images/athlete/plCiU8VPx_qLs3YnMVgIx',
  'makiyah davis': 'https://media.virti.us/upload/images/athlete/1Di7Al76uWLhA2sCCar-A',
  'mikayla clements': 'https://media.virti.us/upload/images/athlete/1O41JjAQjiNnR7Uhqq4Oo',
  'myca kelly': 'https://media.virti.us/upload/images/athlete/2W1DlvcyZZHA5rbdwyGLf',
  'myna caines': 'https://media.virti.us/upload/images/athlete/iKFe8UAfJuPWUgwJCDA7g',
  "n'diah brown": 'https://media.virti.us/upload/images/athlete/rf6EYRlhPtyVIaZxx4fhI',
  'nishayla riley': 'https://media.virti.us/upload/images/athlete/87iqde2o7Ht-wZFtMhrc_',
  'promise jean-marie': 'https://media.virti.us/upload/images/athlete/OWZun71ChfPJeV8bIAhX4',
  'sadara mayhorn': 'https://media.virti.us/upload/images/athlete/1pSuBF5AyDypHc4yRc00q',
  'saniah smith': 'https://media.virti.us/upload/images/athlete/GdDVF4oxa-aNTcjolceBC',
  'sydney smith': 'https://media.virti.us/upload/images/athlete/UoRyzVz2LksoEoTj8iSIC',

  // Greenville (Women's)
  'alessia russo': 'https://media.virti.us/upload/images/athlete/smkg4wf_S-ihWRpjgSDFX',
  'alexis stonebraker': 'https://media.virti.us/upload/images/athlete/JF-_Ra50E-f_HcveHgbDS',
  'amara nelson': 'https://media.virti.us/upload/images/athlete/1tGFjzE1os0N5y7g7gQe7',
  'aubrey kenimer': 'https://media.virti.us/upload/images/athlete/7eLgaVnOWsM19QDXn9DIc',
  'christianna cutler': 'https://media.virti.us/upload/images/athlete/UeBdwZMa1LOlYrkDNisQH',
  'ellery gilmer': 'https://media.virti.us/upload/images/athlete/TKHPU0R_3rjvgi_xwm6X5',
  'elli schnieders': 'https://media.virti.us/upload/images/athlete/-OcZrBQdnQA4jiSKVarAx',
  'emma brannon': 'https://media.virti.us/upload/images/athlete/qxlRn2xGi20UwMTOZfwwk',
  'faye jones': 'https://media.virti.us/upload/images/athlete/bLP-Hntcp9yXOhtAo60NJ',
  'isabella feltman': 'https://media.virti.us/upload/images/athlete/3VoKov015ClGqzt9HL4-T',
  'izabella yanis': 'https://media.virti.us/upload/images/athlete/5Y-yKeMM1M1ivbJLU1tW7',
  'laila manley': 'https://media.virti.us/upload/images/athlete/-E8-v9NHgPXuhOSWPGZAb',
  'madison carter': 'https://media.virti.us/upload/images/athlete/SGQWkwNtuLvlWIin7dfCM',
  'madison ford': 'https://media.virti.us/upload/images/athlete/kPVDaeF31R4iso9-ZlJt1',
  'matilda brougham': 'https://media.virti.us/upload/images/athlete/9MnxatWgy46cgqdPDMY3L',
  'maycee mcknight': 'https://media.virti.us/upload/images/athlete/cR2UZ1w6XfaF4eyYieq7G',
  'naima murray': 'https://media.virti.us/upload/images/athlete/ToXEjbKMGSBAjdolhdcvE',
  'olivia tocco': 'https://media.virti.us/upload/images/athlete/KnlNsoKjFdGlJCo6g44-1',
  'reagan rodriguez': 'https://media.virti.us/upload/images/athlete/pSF0sqJQ7c4Dyjp_UaVgl',
  'reese clapper': 'https://media.virti.us/upload/images/athlete/xOxDOKLTx5B2F_Z5OxG_X',
  'roya zehtab': 'https://media.virti.us/upload/images/athlete/7maWXHWLsZvg9X6rcrSYS',
  'taylor templin': 'https://media.virti.us/upload/images/athlete/MAu3yL7pFaNCiAYWH2-Mo',
  'valeria arraiz': 'https://media.virti.us/upload/images/athlete/CXnHDBhbLTupvDgyQyIwm',

  // Springfield (Men's)
  'blaise rousseau': 'https://media.virti.us/upload/images/athlete/vOVhiKevdKfaLNlTlD4qj',
  'cameron rhymes': 'https://media.virti.us/upload/images/athlete/-ZWDDoOVKVfhxricp3XcG',
  'carl jacob soederqvist': 'https://media.virti.us/upload/images/athlete/F_VFNaxUXTxjGdNUDJhz-',
  'devon felsenstein': 'https://media.virti.us/upload/images/athlete/nDWFVWPSY9KrQWQ7ikdt1',
  'donovan salva': 'https://media.virti.us/upload/images/athlete/TRqH7hj1jsVBVXkWYVNch',
  'evan reichert': 'https://media.virti.us/upload/images/athlete/VXAxWV3N62MQK-jy1HZ6r',
  'gustavin suess': 'https://media.virti.us/upload/images/athlete/t9nmGlhWEOowkWKzfrtDf',
  'jesse listopad': 'https://media.virti.us/upload/images/athlete/i9-kYHw-OMUTE7h8HksME',
  'joshua szitanko': 'https://media.virti.us/upload/images/athlete/VPG_oV2WEgelzO2Ub3nAX',
  'kaleb palacio': 'https://media.virti.us/upload/images/athlete/IwzP0gnrW6c8xWuuHqOsx',
  'michael dalton': 'https://media.virti.us/upload/images/athlete/nf5-bylErIeusx57mdrpd',
  'owen carney': 'https://media.virti.us/upload/images/athlete/FGmg7Acd8_afssdcDDeXT',
  'peyton cramer': 'https://media.virti.us/upload/images/athlete/om9woUqh2f-b5cSpVgK70',
  'skyler cook': 'https://media.virti.us/upload/images/athlete/CrgLYjBiG6Jwhky6WHFF1',
  'tristan tacconi': 'https://media.virti.us/upload/images/athlete/O4ZRNgUct5Q4D5-NURYFI',
  'tyler beekman': 'https://media.virti.us/upload/images/athlete/Qw8wiFUtx-nYcuF6WIOdy',
};

// ============================================
// TEAM NAME ALIASES
// Maps common variations to the canonical school key (without -mens/-womens)
// ============================================
const schoolAliases = {
  // Cal / California / UC Berkeley
  'california': 'cal',
  'uc berkeley': 'cal',
  'berkeley': 'cal',
  'golden bears': 'cal',
  // Navy
  'naval academy': 'navy',
  'us navy': 'navy',
  'usna': 'navy',
  // Stanford
  'stanford university': 'stanford',
  'cardinal': 'stanford',
  // Penn State
  'penn state': 'penn-state',
  'pennsylvania state': 'penn-state',
  'psu': 'penn-state',
  'nittany lions': 'penn-state',
  // William & Mary
  'william & mary': 'william-mary',
  'william and mary': 'william-mary',
  'w&m': 'william-mary',
  // George Washington
  'george washington': 'george-washington',
  'gw': 'george-washington',
  'gwu': 'george-washington',
  // Fisk
  'fisk university': 'fisk',
  // Centenary
  'centenary college': 'centenary',
  // Wilberforce
  'wilberforce university': 'wilberforce',
  // Greenville
  'greenville university': 'greenville',
  // Springfield
  'springfield college': 'springfield',
  // Illinois
  'university of illinois': 'illinois',
  'fighting illini': 'illinois',
  // Michigan
  'university of michigan': 'michigan',
  'wolverines': 'michigan',
  // Army
  'west point': 'army',
  'us army': 'army',
  'black knights': 'army',
  // Maryland
  'university of maryland': 'maryland',
  'terrapins': 'maryland',
  // Simpson
  'simpson college': 'simpson',
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Normalize a name for lookup (lowercase, trim, collapse spaces)
 */
function normalizeName(name) {
  if (!name) return '';
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Normalize a team/school name for flexible matching
 * Removes common suffixes like "university", "college", etc.
 */
function normalizeSchoolName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\buniversity\b/gi, '')
    .replace(/\bcollege\b/gi, '')
    .replace(/\bof\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Resolve a team name to a canonical school key
 * Handles aliases, variations, and common naming patterns
 * @param {string} input - e.g., 'California', 'Cal', 'Navy Men's', 'navy-mens'
 * @returns {string|null} Canonical school key (e.g., 'cal', 'navy') or null
 */
function resolveSchoolKey(input) {
  if (!input) return null;

  const normalized = normalizeName(input);

  // Check if it's already a full team key (e.g., 'cal-mens', 'navy-womens')
  if (teams[normalized]) {
    // Extract school from team key (remove -mens/-womens)
    return normalized.replace(/-mens$/, '').replace(/-womens$/, '');
  }

  // Remove -mens/-womens suffix if present
  const withoutGender = normalized.replace(/-mens$/, '').replace(/-womens$/, '').replace(/ men'?s?$/i, '').replace(/ women'?s?$/i, '');

  // Check if it's a direct school match
  if (teams[`${withoutGender}-mens`] || teams[`${withoutGender}-womens`]) {
    return withoutGender;
  }

  // Check aliases
  if (schoolAliases[withoutGender]) {
    return schoolAliases[withoutGender];
  }

  // Try normalized version (remove "university", "college", etc.)
  const superNormalized = normalizeSchoolName(withoutGender);
  if (schoolAliases[superNormalized]) {
    return schoolAliases[superNormalized];
  }

  // Check if super-normalized matches any school name in teams
  for (const [teamKey, team] of Object.entries(teams)) {
    const schoolNormalized = normalizeSchoolName(team.school);
    if (schoolNormalized === superNormalized || team.school.toLowerCase() === withoutGender) {
      return teamKey.replace(/-mens$/, '').replace(/-womens$/, '');
    }
  }

  return null;
}

/**
 * Get a team by its key (exact match only)
 * @param {string} teamKey - e.g., 'navy-mens', 'fisk-womens'
 * @returns {object|null} Team data or null if not found
 */
export function getTeam(teamKey) {
  if (!teamKey) return null;
  const normalized = normalizeName(teamKey);
  return teams[normalized] || null;
}

/**
 * Get team logo URL with flexible matching
 * Accepts various formats: 'California', 'Cal', 'cal-mens', 'Navy Men's', etc.
 * @param {string} teamName - Team name in any common format
 * @returns {string} Logo URL or empty string
 */
export function getTeamLogo(teamName) {
  if (!teamName) return '';

  // First try exact team key match
  const exactMatch = getTeam(teamName);
  if (exactMatch) return exactMatch.logo;

  // Resolve to school key and get logo from either mens or womens team
  const schoolKey = resolveSchoolKey(teamName);
  if (schoolKey) {
    // Try mens first, then womens (they should have the same logo)
    const mensTeam = teams[`${schoolKey}-mens`];
    if (mensTeam) return mensTeam.logo;

    const womensTeam = teams[`${schoolKey}-womens`];
    if (womensTeam) return womensTeam.logo;
  }

  return '';
}

/**
 * Check if team has a logo (with flexible matching)
 * @param {string} teamName - Team name in any common format
 * @returns {boolean}
 */
export function hasTeamLogo(teamName) {
  return !!getTeamLogo(teamName);
}

/**
 * Get team roster with flexible matching
 * Accepts various formats: 'California', 'Cal', 'cal-mens', 'Navy Men's', etc.
 * @param {string} teamName - Team name in any common format
 * @param {string} [gender] - Optional: 'mens' or 'womens' to specify gender
 * @returns {string[]} Array of athlete names
 */
export function getTeamRosterFlexible(teamName, gender = null) {
  if (!teamName) return [];

  // First try exact team key match
  const exactMatch = getTeam(teamName);
  if (exactMatch) return exactMatch.roster || [];

  // Resolve to school key
  const schoolKey = resolveSchoolKey(teamName);
  if (!schoolKey) return [];

  // Determine gender from input or use provided gender
  const normalized = normalizeName(teamName);
  let targetGender = gender;
  if (!targetGender) {
    if (normalized.includes('women') || normalized.includes('womens')) {
      targetGender = 'womens';
    } else if (normalized.includes('men') || normalized.includes('mens')) {
      targetGender = 'mens';
    }
  }

  // Try to get roster from specific gender team first
  if (targetGender) {
    const team = teams[`${schoolKey}-${targetGender}`];
    if (team?.roster?.length > 0) return team.roster;
  }

  // Try mens first, then womens (return whichever has a roster)
  const mensTeam = teams[`${schoolKey}-mens`];
  if (mensTeam?.roster?.length > 0) return mensTeam.roster;

  const womensTeam = teams[`${schoolKey}-womens`];
  if (womensTeam?.roster?.length > 0) return womensTeam.roster;

  return [];
}

/**
 * Check if team has a roster (with flexible matching)
 * @param {string} teamName - Team name in any common format
 * @param {string} [gender] - Optional: 'mens' or 'womens'
 * @returns {boolean}
 */
export function hasTeamRoster(teamName, gender = null) {
  return getTeamRosterFlexible(teamName, gender).length > 0;
}

/**
 * Get roster stats with flexible matching
 * @param {string} teamName - Team name in any common format
 * @param {string} [gender] - Optional: 'mens' or 'womens'
 * @returns {{total: number, withHeadshots: number, percentage: number}}
 */
export function getTeamRosterStatsFlexible(teamName, gender = null) {
  const roster = getTeamRosterFlexible(teamName, gender);
  const withHeadshots = roster.filter(name => hasAthleteHeadshot(name)).length;
  return {
    total: roster.length,
    withHeadshots,
    percentage: roster.length > 0 ? Math.round((withHeadshots / roster.length) * 100) : 0,
  };
}

/**
 * Get team roster
 * @param {string} teamKey - e.g., 'navy-mens', 'fisk-womens'
 * @returns {string[]} Array of athlete names
 */
export function getTeamRoster(teamKey) {
  const team = getTeam(teamKey);
  return team?.roster || [];
}

/**
 * Get athlete headshot URL
 * @param {string} athleteName - Full name (case-insensitive)
 * @returns {string} Headshot URL or empty string
 */
export function getAthleteHeadshot(athleteName) {
  if (!athleteName) return '';
  const normalized = normalizeName(athleteName);
  return athleteHeadshots[normalized] || '';
}

/**
 * Check if athlete has a headshot
 * @param {string} athleteName
 * @returns {boolean}
 */
export function hasAthleteHeadshot(athleteName) {
  return !!getAthleteHeadshot(athleteName);
}

/**
 * Get roster with headshot status for each athlete
 * @param {string} teamKey
 * @returns {Array<{name: string, hasHeadshot: boolean, headshotUrl: string}>}
 */
export function getTeamRosterWithHeadshots(teamKey) {
  const roster = getTeamRoster(teamKey);
  return roster.map(name => ({
    name,
    hasHeadshot: hasAthleteHeadshot(name),
    headshotUrl: getAthleteHeadshot(name),
  }));
}

/**
 * Get roster completeness stats
 * @param {string} teamKey
 * @returns {{total: number, withHeadshots: number, percentage: number}}
 */
export function getTeamRosterStats(teamKey) {
  const roster = getTeamRosterWithHeadshots(teamKey);
  const withHeadshots = roster.filter(a => a.hasHeadshot).length;
  return {
    total: roster.length,
    withHeadshots,
    percentage: roster.length > 0 ? Math.round((withHeadshots / roster.length) * 100) : 0,
  };
}

/**
 * Get all team keys
 * @returns {string[]}
 */
export function getAllTeamKeys() {
  return Object.keys(teams);
}

/**
 * Get all teams grouped by school
 * @returns {Object} { schoolName: [{ key, ...teamData }] }
 */
export function getTeamsBySchool() {
  const bySchool = {};
  for (const [key, team] of Object.entries(teams)) {
    if (!bySchool[team.school]) {
      bySchool[team.school] = [];
    }
    bySchool[team.school].push({ key, ...team });
  }
  return bySchool;
}

/**
 * Get all unique schools
 * @returns {string[]}
 */
export function getAllSchools() {
  const schools = new Set();
  for (const team of Object.values(teams)) {
    schools.add(team.school);
  }
  return Array.from(schools).sort();
}

/**
 * Search teams by school name (fuzzy match)
 * @param {string} query
 * @returns {Array<{key: string, ...teamData}>}
 */
export function searchTeams(query) {
  if (!query) return [];
  const normalized = normalizeName(query);
  const results = [];

  for (const [key, team] of Object.entries(teams)) {
    const schoolNormalized = normalizeName(team.school);
    if (schoolNormalized.includes(normalized) || normalized.includes(schoolNormalized)) {
      results.push({ key, ...team });
    }
  }

  return results;
}

// Export the raw data for direct access if needed
export { teams, athleteHeadshots };
export default teams;
