import { nameKey } from './amount';

export interface Category {
  id: string;
  name: string;
  /** Former names; items on the server may still carry them in CATEGORIES. */
  aliases: string[];
}

export const FALLBACK_ID = 'andet';

// Default order follows a walk through a typical Danish supermarket.
export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'frugt', name: 'Frugt & grønt', aliases: [] },
  { id: 'broed', name: 'Brød & bagværk', aliases: [] },
  { id: 'koed', name: 'Kød & fisk', aliases: [] },
  { id: 'paalaeg', name: 'Pålæg', aliases: [] },
  { id: 'mejeri', name: 'Mejeri & æg', aliases: [] },
  { id: 'kolonial', name: 'Kolonial', aliases: [] },
  { id: 'frost', name: 'Frost', aliases: [] },
  { id: 'drikke', name: 'Drikkevarer', aliases: [] },
  { id: 'snacks', name: 'Snacks & slik', aliases: [] },
  { id: 'hushold', name: 'Husholdning', aliases: [] },
  { id: 'pleje', name: 'Personlig pleje', aliases: [] },
  { id: FALLBACK_ID, name: 'Andet', aliases: [] },
];

// Danish compounds put the head noun last ("letmælk", "rugbrød"), so a
// keyword matches when a word in the item *ends with* it.
const KEYWORDS: Record<string, string[]> = {
  frugt: [
    'æble', 'æbler', 'pære', 'pærer', 'banan', 'bananer', 'appelsin', 'appelsiner', 'citron', 'citroner',
    'lime', 'mandarin', 'mandariner', 'klementin', 'klementiner', 'vindrue', 'vindruer', 'druer', 'jordbær',
    'hindbær', 'blåbær', 'brombær', 'melon', 'vandmelon', 'ananas', 'mango', 'kiwi', 'avocado', 'avokado',
    'blomme', 'blommer', 'fersken', 'nektarin', 'nektariner', 'kartoffel', 'kartofler', 'løg', 'rødløg',
    'hvidløg', 'forårsløg', 'porre', 'porrer', 'gulerod', 'gulerødder', 'agurk', 'tomat', 'tomater',
    'cherrytomater', 'peberfrugt', 'peberfrugter', 'salat', 'icebergsalat', 'rucola', 'spinat', 'kål',
    'hvidkål', 'rødkål', 'spidskål', 'grønkål', 'blomkål', 'broccoli', 'squash', 'aubergine', 'champignon',
    'champignoner', 'svampe', 'majs', 'ærter', 'bønner', 'selleri', 'pastinak', 'rødbede', 'rødbeder',
    'ingefær', 'chili', 'persille', 'basilikum', 'koriander', 'purløg', 'dild', 'krydderurter', 'frugt',
    'grønt', 'grøntsager', 'radiser', 'asparges', 'sødkartofler', 'squash',
  ],
  broed: [
    'brød', 'rugbrød', 'franskbrød', 'toastbrød', 'boller', 'bolle', 'rundstykker', 'rundstykke', 'baguette',
    'flute', 'croissant', 'croissanter', 'wienerbrød', 'kringle', 'tortilla', 'tortillas', 'wraps', 'pitabrød',
    'burgerboller', 'pølsebrød', 'knækbrød', 'kage', 'kager', 'muffins', 'boller', 'sandwichbrød', 'naan',
  ],
  koed: [
    'kød', 'oksekød', 'hakket oksekød', 'hakkekød', 'svinekød', 'kylling', 'kyllingebryst', 'kyllingelår',
    'bacon', 'pølser', 'pølse', 'medister', 'frikadeller', 'flæsk', 'flæskesteg', 'mørbrad', 'koteletter',
    'bøf', 'bøffer', 'entrecote', 'culotte', 'lam', 'lammekød', 'kalkun', 'andebryst', 'laks', 'torsk', 'fisk',
    'rejer', 'tun', 'sild', 'makrel', 'fiskefrikadeller', 'fiskefilet', 'hakket svinekød', 'kalvekød',
  ],
  paalaeg: [
    'pålæg', 'skinke', 'hamburgerryg', 'spegepølse', 'salami', 'rullepølse', 'leverpostej', 'postej',
    'kyllingepålæg', 'kalkunbryst', 'roastbeef', 'hummus', 'makrel i tomat', 'pate', 'paté', 'pesto',
  ],
  mejeri: [
    'mælk', 'letmælk', 'minimælk', 'sødmælk', 'skummetmælk', 'kærnemælk', 'yoghurt', 'skyr', 'ymer',
    'a38', 'fløde', 'piskefløde', 'madlavningsfløde', 'creme fraiche', 'cremefraiche', 'smør', 'kærgården',
    'margarine', 'ost', 'skiveost', 'revet ost', 'flødeost', 'mozzarella', 'parmesan', 'feta', 'hytteost',
    'æg', 'havremælk', 'sojamælk', 'mandelmælk', 'cheddar', 'brie', 'mascarpone', 'smøreost',
  ],
  kolonial: [
    'pasta', 'spaghetti', 'makaroni', 'penne', 'lasagneplader', 'nudler', 'ris', 'mel', 'hvedemel', 'rugmel',
    'sukker', 'flormelis', 'gær', 'bagepulver', 'havregryn', 'müsli', 'mysli', 'cornflakes', 'morgenmad',
    'olie', 'olivenolie', 'rapsolie', 'eddike', 'salt', 'peber', 'krydderi', 'krydderier', 'karry', 'paprika',
    'kanel', 'bouillon', 'ketchup', 'sennep', 'mayonnaise', 'mayo', 'remoulade', 'dressing', 'soja',
    'sojasovs', 'hakkede tomater', 'flåede tomater', 'tomatpuré', 'passata', 'kokosmælk', 'dåse', 'dåser',
    'bønner på dåse', 'kikærter', 'linser', 'syltetøj', 'marmelade', 'honning', 'nutella', 'peanutbutter',
    'jordnøddesmør', 'kaffe', 'te', 'kakao', 'rosiner', 'nødder', 'mandler', 'chokoladepålæg', 'pålægschokolade',
    'bulgur', 'couscous', 'quinoa', 'tacokrydderi', 'tacoskaller', 'sovs', 'sauce', 'majsstivelse', 'vaniljesukker',
  ],
  frost: [
    'frost', 'frosne', 'frossen', 'is', 'isvafler', 'pizza', 'frostpizza', 'pommes frites', 'fritter',
    'frosne ærter', 'frosne bær', 'frostgrønt', 'fiskepinde', 'lasagne',
  ],
  drikke: [
    'vand', 'danskvand', 'mineralvand', 'sodavand', 'cola', 'juice', 'appelsinjuice', 'æblejuice', 'saft',
    'øl', 'vin', 'rødvin', 'hvidvin', 'rosé', 'cider', 'energidrik', 'kaffe på dåse', 'iste', 'smoothie',
  ],
  snacks: [
    'chips', 'slik', 'chokolade', 'kiks', 'småkager', 'popcorn', 'lakrids', 'vingummi', 'snacks', 'peanuts',
    'saltstænger', 'tyggegummi', 'marcipan', 'flødeboller', 'chokoladebar',
  ],
  hushold: [
    'toiletpapir', 'køkkenrulle', 'køkkenruller', 'opvaskemiddel', 'opvasketabs', 'opvaskebørste',
    'vaskemiddel', 'skyllemiddel', 'rengøring', 'rengøringsmiddel', 'sæbe', 'håndsæbe', 'svamp', 'svampe',
    'karklud', 'karklude', 'affaldsposer', 'skraldeposer', 'poser', 'fryseposer', 'bagepapir', 'sølvpapir',
    'film', 'husholdningsfilm', 'stearinlys', 'lys', 'batterier', 'pærer', 'servietter', 'tændstikker',
    'kattegrus', 'hundemad', 'kattemad', 'wc-rens', 'klorin', 'eddikesyre', 'kost', 'gulvklude',
  ],
  pleje: [
    'tandpasta', 'tandbørste', 'tandtråd', 'shampoo', 'balsam', 'deodorant', 'deo', 'bodylotion', 'creme',
    'barberskraber', 'barberblade', 'bind', 'tamponer', 'bleer', 'vatpinde', 'vat', 'solcreme', 'plaster',
    'hovedpinepiller', 'panodil', 'ipren', 'vitaminer', 'brusegel', 'showergel', 'mundskyl', 'vådservietter',
    'hårgele', 'læbepomade',
  ],
};

// Ambiguous plain words: "pærer" (pears vs light bulbs) — fruit is far more
// common on a grocery list, so drop it from household.
KEYWORDS.hushold = KEYWORDS.hushold.filter((w) => w !== 'pærer' && w !== 'svampe');

function matchScore(key: string, words: string[], kw: string): number {
  if (kw.includes(' ')) return key.includes(kw) ? kw.length + 1 : 0;
  for (const w of words) {
    if (w === kw) return kw.length + 1; // exact word beats a compound suffix
    if (kw.length >= 3 && w.endsWith(kw)) return kw.length;
  }
  return 0;
}

/** Best category id from the built-in dictionary, or null. */
export function dictionaryCategory(name: string): string | null {
  const key = nameKey(name);
  const words = key.split(/[\s,/-]+/).filter(Boolean);
  let best: { id: string; score: number } | null = null;
  for (const [id, kws] of Object.entries(KEYWORDS)) {
    for (const kw of kws) {
      const score = matchScore(key, words, kw);
      if (score > 0 && (!best || score > best.score)) best = { id, score };
    }
  }
  return best?.id ?? null;
}

/** Find the category that a CATEGORIES value refers to (name or alias). */
export function findCategory(categories: Category[], label: string | undefined): Category | undefined {
  if (!label) return undefined;
  const k = nameKey(label);
  return categories.find((c) => nameKey(c.name) === k || c.aliases.some((a) => nameKey(a) === k));
}

/**
 * Category label for a new item: what this name was filed under before
 * (learned) wins, then the dictionary, then "Andet".
 */
export function categorize(name: string, learned: Map<string, string>, categories: Category[]): string {
  const prior = learned.get(nameKey(name));
  if (prior) return findCategory(categories, prior)?.name ?? prior;
  const id = dictionaryCategory(name) ?? FALLBACK_ID;
  const cat = categories.find((c) => c.id === id) ?? categories.find((c) => c.id === FALLBACK_ID);
  return cat?.name ?? 'Andet';
}
