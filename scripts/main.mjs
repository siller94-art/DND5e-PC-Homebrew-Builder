const MODULE_ID = "dnd5e-pc-homebrew-builder";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

Handlebars.registerHelper("includes", (list, value) => Array.isArray(list) && list.includes(value));

const STEP_LABELS = { rules:"Rules", identity:"Identity", species:"Species / Race", background:"Background", class:"Class", subclass:"Subclass", abilities:"Abilities", feats:"Feats", spells:"Spells", equipment:"Equipment", details:"Details", review:"Review" };
const STEPS = ["rules","identity","species","background","class","subclass","abilities","feats","spells","equipment","details","review"];
const CUSTOM_ID = "__custom__";
/** Steps that offer an inline "Add Custom …" form, and the D&D5e item type each creates. */
const CUSTOM_STEPS = {
  species: { type:"race", label:"Race", placeholder:"Traits, size, speed, languages…" },
  background: { type:"background", label:"Background", placeholder:"Skill and tool proficiencies, origin feat, equipment…" },
  class: { type:"class", label:"Class", placeholder:"Hit points, proficiencies, starting equipment, class features…", hitDie:true },
  subclass: { type:"subclass", label:"Subclass", placeholder:"Subclass features and the level they are gained…" }
};
const ABILITY_KEYS = ["str","dex","con","int","wis","cha"];
const ABILITY_NAMES = { str:"Strength", dex:"Dexterity", con:"Constitution", int:"Intelligence", wis:"Wisdom", cha:"Charisma" };
const STANDARD_ARRAY = [15,14,13,12,10,8];
const POINT_BUY_COST = { 8:0, 9:1, 10:2, 11:3, 12:4, 13:5, 14:7, 15:9 };
const POINT_BUY_BUDGET = 27;
const ABILITY_METHODS = [
  { value:"pointbuy", label:"Point Buy", icon:"fa-coins" },
  { value:"standard", label:"Standard Array", icon:"fa-list-ol" },
  { value:"roll", label:"Roll 4d6", icon:"fa-dice" },
  { value:"manual", label:"Manual", icon:"fa-pen" }
];
/** Best ability scores per class: primary is highlighted, secondary is a softer hint. */
const CLASS_ABILITIES = {
  artificer: { primary:["int"], secondary:["con","dex"] },
  barbarian: { primary:["str"], secondary:["con"] },
  bard: { primary:["cha"], secondary:["dex"] },
  cleric: { primary:["wis"], secondary:["con","str"] },
  druid: { primary:["wis"], secondary:["con"] },
  fighter: { primary:["str","dex"], secondary:["con"], either:true },
  monk: { primary:["dex","wis"], secondary:["con"] },
  paladin: { primary:["str","cha"], secondary:["con"] },
  ranger: { primary:["dex","wis"], secondary:["con"] },
  rogue: { primary:["dex"], secondary:["con","int"] },
  sorcerer: { primary:["cha"], secondary:["con"] },
  warlock: { primary:["cha"], secondary:["con"] },
  wizard: { primary:["int"], secondary:["con","dex"] }
};
const EDITIONS = [{ value:"2014", label:"2014" }, { value:"2024", label:"2024" }, { value:"all", label:"All" }];
const LIST_STEPS = ["species","background","class","subclass","feats","spells","equipment"];
/** Multi-select steps get an "Add Custom …" button that opens Custom Content preset to this item type. */
const MULTI_CUSTOM = { feats:{ type:"feat", label:"Feat" }, spells:{ type:"spell", label:"Spell" }, equipment:{ type:"equipment", label:"Item" } };
const FEAT_CATEGORIES = [
  { value:"", label:"All categories" }, { value:"origin", label:"Origin" }, { value:"general", label:"General" },
  { value:"fightingStyle", label:"Fighting Style" }, { value:"epicBoon", label:"Epic Boon" }
];
const FEAT_CATEGORY_LABELS = { origin:"Origin", general:"General", fightingStyle:"Fighting Style", epicBoon:"Epic Boon" };
const SPELL_LEVELS = [
  { value:"low", label:"Cantrips & 1st level" }, { value:"0", label:"Cantrips" },
  ...[1,2,3,4,5,6,7,8,9].map(n => ({ value:String(n), label:"Level "+n })), { value:"all", label:"All levels" }
];
/** Weapons and armor that only monsters and vehicles use. */
const NON_PLAYER_EQUIPMENT = ["natural","siege","vehicle"];
const CLASS_NAMES = { artificer:"Artificer", barbarian:"Barbarian", bard:"Bard", cleric:"Cleric", druid:"Druid", fighter:"Fighter", monk:"Monk", paladin:"Paladin", ranger:"Ranger", rogue:"Rogue", sorcerer:"Sorcerer", warlock:"Warlock", wizard:"Wizard" };
/**
 * Feats that suit each class or species, by name (2014 and 2024 names).
 * Only feats that exist in your compendiums appear; the SRD itself has few feats.
 */
const FEAT_RECOMMENDATIONS = {
  class: {
    artificer: ["Alert","War Caster","Resilient","Lucky","Magic Initiate","Fey Touched","Tough","Skilled"],
    barbarian: ["Great Weapon Master","Savage Attacker","Tough","Sentinel","Polearm Master","Grappler","Mobile","Charger","Crusher","Alert","Great Weapon Fighting"],
    bard: ["War Caster","Inspiring Leader","Lucky","Alert","Magic Initiate","Skilled","Resilient","Fey Touched","Musician","Actor"],
    cleric: ["War Caster","Resilient","Alert","Magic Initiate","Heavily Armored","Fey Touched","Healer","Tough","Lucky"],
    druid: ["War Caster","Resilient","Alert","Magic Initiate","Telekinetic","Fey Touched","Tough","Healer","Lucky"],
    fighter: ["Great Weapon Master","Sharpshooter","Polearm Master","Sentinel","Crossbow Expert","Savage Attacker","Tough","Alert","Lucky","Shield Master","Heavy Armor Master","Dual Wielder","Archery","Defense","Great Weapon Fighting","Two-Weapon Fighting","Ability Score Improvement"],
    monk: ["Mobile","Alert","Tough","Sentinel","Lucky","Savage Attacker","Grappler","Speedy","Crusher","Skulker"],
    paladin: ["Great Weapon Master","Polearm Master","Sentinel","Shield Master","War Caster","Heavy Armor Master","Inspiring Leader","Resilient","Defense","Great Weapon Fighting","Tough","Alert"],
    ranger: ["Sharpshooter","Crossbow Expert","Alert","Archery","Two-Weapon Fighting","Dual Wielder","Mobile","Skulker","Magic Initiate","Lucky","Fey Touched","Tough"],
    rogue: ["Alert","Mobile","Skulker","Sharpshooter","Crossbow Expert","Lucky","Skilled","Dual Wielder","Piercer","Savage Attacker","Tough"],
    sorcerer: ["War Caster","Elemental Adept","Spell Sniper","Resilient","Alert","Lucky","Metamagic Adept","Fey Touched","Magic Initiate","Tough"],
    warlock: ["War Caster","Spell Sniper","Elemental Adept","Resilient","Alert","Lucky","Fey Touched","Shadow Touched","Inspiring Leader","Tough"],
    wizard: ["War Caster","Resilient","Alert","Lucky","Elemental Adept","Spell Sniper","Magic Initiate","Fey Touched","Telekinetic","Ritual Caster","Tough"]
  },
  species: {
    dragonborn: ["Dragon Fear","Dragon Hide"],
    dwarf: ["Dwarven Fortitude","Squat Nimbleness"],
    elf: ["Elven Accuracy","Drow High Magic","Fey Teleportation","Wood Elf Magic"],
    "half-elf": ["Elven Accuracy","Prodigy"],
    gnome: ["Fade Away","Squat Nimbleness"],
    halfling: ["Bountiful Luck","Second Chance","Squat Nimbleness"],
    "half-orc": ["Orcish Fury","Prodigy"],
    human: ["Prodigy"],
    tiefling: ["Flames of Phlegethos","Infernal Constitution"]
  }
};
/** Highlight color per class, used for "good for your class" picks. */
const CLASS_COLORS = {
  artificer:"#d8963c", barbarian:"#ff7a29", bard:"#e98bd1", cleric:"#f2c94c", druid:"#b0875a", fighter:"#9fb0c0",
  monk:"#26c6da", paladin:"#a9c4ff", ranger:"#39d353", rogue:"#b9b9b9", sorcerer:"#ff4d4d", warlock:"#9b6bff", wizard:"#3d8bff"
};
/** D&D Beyond item rarity colors. */
const RARITIES = {
  common:{ label:"Common", color:"#c8c8c8" }, uncommon:{ label:"Uncommon", color:"#1fc219" }, rare:{ label:"Rare", color:"#4990e2" },
  veryRare:{ label:"Very Rare", color:"#9810e0" }, legendary:{ label:"Legendary", color:"#fea227" }, artifact:{ label:"Artifact", color:"#be8972" }
};
const RARITY_FILTERS = [{ value:"", label:"Any rarity" }, { value:"mundane", label:"Mundane (no rarity)" }, { value:"magic", label:"Any magic item" },
  ...Object.entries(RARITIES).map(([value, r]) => ({ value, label:r.label }))];
/** Starting gear that suits each class, by item name. */
const EQUIPMENT_RECOMMENDATIONS = {
  artificer: ["Light Crossbow","Crossbow Bolts","Studded Leather Armor","Scale Mail","Thieves' Tools","Tinker's Tools","Dungeoneer's Pack","Dagger"],
  barbarian: ["Greataxe","Handaxe","Javelin","Greatsword","Maul","Explorer's Pack"],
  bard: ["Rapier","Dagger","Leather Armor","Lute","Entertainer's Pack","Diplomat's Pack","Flute","Lyre"],
  cleric: ["Mace","Warhammer","Scale Mail","Chain Mail","Shield","Holy Symbol","Amulet","Emblem","Reliquary","Light Crossbow","Priest's Pack"],
  druid: ["Scimitar","Quarterstaff","Sickle","Leather Armor","Shield","Druidic Focus","Sprig of Mistletoe","Wooden Staff","Herbalism Kit","Explorer's Pack"],
  fighter: ["Longsword","Greatsword","Chain Mail","Shield","Longbow","Arrows","Light Crossbow","Handaxe","Halberd","Glaive","Dungeoneer's Pack"],
  monk: ["Shortsword","Quarterstaff","Spear","Dart","Explorer's Pack","Dungeoneer's Pack"],
  paladin: ["Longsword","Greatsword","Warhammer","Chain Mail","Shield","Javelin","Holy Symbol","Priest's Pack"],
  ranger: ["Longbow","Arrows","Quiver","Shortsword","Scimitar","Scale Mail","Leather Armor","Studded Leather Armor","Druidic Focus","Explorer's Pack"],
  rogue: ["Rapier","Shortsword","Shortbow","Arrows","Dagger","Leather Armor","Thieves' Tools","Burglar's Pack"],
  sorcerer: ["Dagger","Light Crossbow","Quarterstaff","Arcane Focus","Crystal","Orb","Component Pouch","Explorer's Pack"],
  warlock: ["Dagger","Light Crossbow","Leather Armor","Arcane Focus","Component Pouch","Scholar's Pack"],
  wizard: ["Quarterstaff","Dagger","Spellbook","Arcane Focus","Component Pouch","Scholar's Pack"]
};
/**
 * Level 1 spellcasting by class and edition.
 * prepared: a number, or { ability, plus } for "ability modifier + plus" (minimum 1).
 */
const SPELLCASTING = {
  "2014": {
    artificer: { ability:"int", cantrips:2, prepared:{ ability:"int", plus:0 }, slots:2, mode:"prepared" },
    bard: { ability:"cha", cantrips:2, prepared:4, slots:2, mode:"known" },
    cleric: { ability:"wis", cantrips:3, prepared:{ ability:"wis", plus:1 }, slots:2, mode:"prepared" },
    druid: { ability:"wis", cantrips:2, prepared:{ ability:"wis", plus:1 }, slots:2, mode:"prepared" },
    paladin: { ability:"cha", cantrips:0, prepared:0, slots:0, mode:"none", note:"Paladins start casting at level 2." },
    ranger: { ability:"wis", cantrips:0, prepared:0, slots:0, mode:"none", note:"Rangers start casting at level 2." },
    sorcerer: { ability:"cha", cantrips:4, prepared:2, slots:2, mode:"known" },
    warlock: { ability:"cha", cantrips:2, prepared:2, slots:1, mode:"known", pact:true },
    wizard: { ability:"int", cantrips:3, prepared:{ ability:"int", plus:1 }, spellbook:6, slots:2, mode:"prepared" }
  },
  "2024": {
    artificer: { ability:"int", cantrips:2, prepared:2, slots:2, mode:"prepared" },
    bard: { ability:"cha", cantrips:2, prepared:4, slots:2, mode:"prepared" },
    cleric: { ability:"wis", cantrips:3, prepared:4, slots:2, mode:"prepared" },
    druid: { ability:"wis", cantrips:2, prepared:4, slots:2, mode:"prepared" },
    paladin: { ability:"cha", cantrips:0, prepared:2, slots:2, mode:"prepared" },
    ranger: { ability:"wis", cantrips:0, prepared:2, slots:2, mode:"prepared" },
    sorcerer: { ability:"cha", cantrips:4, prepared:2, slots:2, mode:"prepared" },
    warlock: { ability:"cha", cantrips:2, prepared:2, slots:1, mode:"prepared", pact:true },
    wizard: { ability:"int", cantrips:3, prepared:4, spellbook:6, slots:2, mode:"prepared" }
  }
};
const ALIGNMENTS = ["Lawful Good","Neutral Good","Chaotic Good","Lawful Neutral","True Neutral","Chaotic Neutral","Lawful Evil","Neutral Evil","Chaotic Evil","Unaligned"];
const DETAIL_FIELDS = {
  physical: [["gender","Gender"],["age","Age"],["height","Height"],["weight","Weight"],["eyes","Eyes"],["hair","Hair"],["skin","Skin"],["faith","Faith"]],
  personality: [["trait","Personality Traits"],["ideal","Ideals"],["bond","Bonds"],["flaw","Flaws"]]
};
function ordinal(n) { return n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : n + "th"; }

const SPECIES_NAMES = { dragonborn:"Dragonborn", dwarf:"Dwarf", elf:"Elf", "half-elf":"Half-Elf", gnome:"Gnome", halfling:"Halfling", "half-orc":"Half-Orc", human:"Human", tiefling:"Tiefling" };
/** Species whose 2024 version grants an Origin feat, so origin feats are recommended. */
const ORIGIN_FEAT_SPECIES = ["human"];

function normalizeName(name) {
  return String(name || "").toLowerCase().replace(/[’']/g,"").replace(/[^a-z0-9]+/g," ").trim();
}

/** Match a species name like "Elf, High" or "Lightfoot Halfling" to a recommendation key. */
function speciesKey(name) {
  const n = String(name || "").toLowerCase();
  for (const key of ["half-elf","half-orc","dragonborn","halfling","tiefling","gnome","dwarf","human","elf"]) {
    const pattern = new RegExp("(^|[^a-z])" + key.replace("-", "[- ]?") + "($|[^a-z])");
    if (pattern.test(n)) return key;
  }
  return "";
}
const TYPE_MAP = {
  species: ["race","species"],
  background: ["background"],
  class: ["class"],
  subclass: ["subclass"],
  feats: ["feat"],
  spells: ["spell"],
  equipment: ["equipment","weapon","consumable","tool","loot","container"]
};

class CharacterBuilder extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "dnd5e-pc-character-builder",
    classes: ["dnd5e-pc-character-builder"],
    tag: "form",
    window: { title: "D&D 5e / 5.5e Character Builder", resizable: true },
    position: { width: 1080, height: 800 },
    actions: {
      next: CharacterBuilder.next,
      back: CharacterBuilder.back,
      create: CharacterBuilder.createCharacter,
      custom: CharacterBuilder.customContent,
      filterSource: CharacterBuilder.filterSource,
      edition: CharacterBuilder.setEdition,
      goto: CharacterBuilder.gotoStep,
      removePick: CharacterBuilder.removePick,
      srdToggle: CharacterBuilder.toggleSrd,
      multiCustom: CharacterBuilder.openMultiCustom,
      abilityMethod: CharacterBuilder.setAbilityMethod,
      pointBuy: CharacterBuilder.adjustPointBuy,
      rollAbilities: CharacterBuilder.rollAbilities,
      suggestAbilities: CharacterBuilder.suggestAbilities,
      customEntry: CharacterBuilder.toggleCustom,
      browsePortrait: CharacterBuilder.browsePortrait,
      clearPortrait: CharacterBuilder.clearPortrait
    }
  };

  static PARTS = { form: { template: "modules/dnd5e-pc-homebrew-builder/templates/builder.hbs" } };

  constructor(options={}) {
    super(options);
    this.stepIndex = 0;
    this.catalog = {};
    this.sourceFilter = {};
    this.showCustom = {};
    this.editionFilter = {};
    this.srdOnly = {};
    this.search = {};
    this.classFilter = {};
    this.featCategory = "";
    this.spellLevel = "low";
    this.rarity = "";
    this.draft = {
      rules: "2024", name: "", img: "", species: "",
      custom: {
        species: { name: "", description: "", save: false },
        background: { name: "", description: "", save: false },
        class: { name: "", description: "", save: false, hitDie: "d8" },
        subclass: { name: "", description: "", save: false }
      }, background: "", class: "", subclass: "",
      abilities: { str:10, dex:10, con:10, int:10, wis:10, cha:10 },
      abilityMethod: "pointbuy",
      pointBuy: { str:8, dex:8, con:8, int:8, wis:8, cha:8 },
      arrayAssign: { str:"", dex:"", con:"", int:"", wis:"", cha:"" },
      rolled: [],
      rollAssign: { str:"", dex:"", con:"", int:"", wis:"", cha:"" },
      feats: [], spells: [], equipment: [], details: "",
      info: { alignment:"", gender:"", age:"", height:"", weight:"", eyes:"", hair:"", skin:"", faith:"", trait:"", ideal:"", bond:"", flaw:"", appearance:"" }
    };
  }

  _sanitizeDraftSelections() {
    const validSingle = ["species","background","class","subclass"];
    const validMulti = ["feats","spells","equipment"];
    const allRows = Object.values(this.catalog).flat();
    const validUuids = new Set(allRows.map(row => row.uuid));

    for (const key of validSingle) {
      if (CUSTOM_STEPS[key] && this.draft[key] === CUSTOM_ID) continue;
      if (this.draft[key] && !validUuids.has(this.draft[key])) this.draft[key] = "";
    }

    for (const key of validMulti) {
      if (!Array.isArray(this.draft[key])) this.draft[key] = [];
      this.draft[key] = this.draft[key].filter(uuid => validUuids.has(uuid));
    }

    if (this.draft.subclass && this.draft.class && this.draft.class !== CUSTOM_ID && this.draft.subclass !== CUSTOM_ID) {
      const classRows = this.catalog.class || [];
      const subclassRows = this.catalog.subclass || [];
      const classSelected = classRows.some(row => row.uuid === this.draft.class);
      const subclassSelected = subclassRows.some(row => row.uuid === this.draft.subclass);
      if (!classSelected || !subclassSelected) this.draft.subclass = "";
    }

    if (this.draft.class && this.draft.class !== CUSTOM_ID && !(this.catalog.class || []).some(row => row.uuid === this.draft.class)) {
      this.draft.class = "";
      this.draft.subclass = "";
    }
  }

  async _prepareContext() {
    await this._scanContent();
    this._sanitizeDraftSelections();
    const step = STEPS[this.stepIndex];
    const edition = this.editionFilter[step] || this.draft.rules;
    const srdOnly = !!this.srdOnly[step];
    let allRows = (this.catalog[step] || []).filter(r => (edition === "all" || !r.rules || r.rules === edition) && (!srdOnly || r.srd));
    const extra = LIST_STEPS.includes(step) ? this._stepFilters(step, allRows) : {};
    if (extra.filter) allRows = allRows.filter(extra.filter);
    const sources = [...new Set(allRows.map(r => r.source))].sort((a,b) => a.localeCompare(b));
    let activeSource = this.sourceFilter[step] || "";
    if (activeSource && !sources.includes(activeSource)) activeSource = this.sourceFilter[step] = "";
    let rows = activeSource ? allRows.filter(r => r.source === activeSource) : allRows;
    const search = (this.search[step] || "").trim().toLowerCase();
    rows = rows.map(r => ({ ...r, recommended: !!extra.recommended?.(r), hidden: !!search && !r.name.toLowerCase().includes(search),
      categoryLabel: FEAT_CATEGORY_LABELS[r.category] || "",
      rarityLabel: RARITIES[r.rarity]?.label || "", rarityColor: RARITIES[r.rarity]?.color || "", levelLabel: r.type === "spell" && r.level !== null ? (r.level === 0 ? "Cantrip" : ordinal(r.level) + " Level") : "",
      levelClass: r.type === "spell" && r.level !== null ? "lvl-" + r.level : "", searchName: r.name.toLowerCase() }));
    if (extra.recommended) rows.sort((a,b) => (b.recommended - a.recommended) || a.name.localeCompare(b.name));
    const customStep = CUSTOM_STEPS[step];
    return {
      step, stepNumber: this.stepIndex + 1, totalSteps: STEPS.length,
      stepTitle: STEP_LABELS[step] || step,
      stepList: STEPS.map((key, i) => ({ key, label: STEP_LABELS[key] || key, active: i === this.stepIndex, done: i < this.stepIndex })),
      draft: this.draft, rows,
      sourceButtons: sources.length > 1 ? [{ label:"All", value:"", count:allRows.length, active:!activeSource },
        ...sources.map(src => ({ label:src, value:src, count:allRows.filter(r => r.source === src).length, active:src === activeSource }))] : [],
      isList: ["species","background","class","subclass","feats","spells","equipment"].includes(step),
      editions: EDITIONS.map(e => ({ ...e, active: e.value === edition })),
      srdOnly, search: this.search[step] || "",
      classOptions: extra.classOptions || null, classNote: extra.note || "",
      featCategories: step === "feats" ? FEAT_CATEGORIES.map(c => ({ ...c, selected: c.value === this.featCategory })) : null,
      spellLevels: step === "spells" ? SPELL_LEVELS.map(l => ({ ...l, selected: l.value === this.spellLevel })) : null,
      multiCustom: MULTI_CUSTOM[step] || null,
      isSpells: step === "spells",
      selectedLevels: step === "spells" ? JSON.stringify(this._selectedSpellLevels()) : "",
      spellInfo: step === "spells" || step === "review" ? this._spellAllowance() : null,
      alignments: ALIGNMENTS.map(a => ({ value:a, selected:a === this.draft.info.alignment })),
      physicalFields: DETAIL_FIELDS.physical.map(([key,label]) => ({ key, label, value:this.draft.info[key] })),
      personalityFields: DETAIL_FIELDS.personality.map(([key,label]) => ({ key, label, value:this.draft.info[key] })),
      rarities: step === "equipment" ? RARITY_FILTERS.map(r => ({ ...r, selected: r.value === this.rarity })) : null,
      recColor: extra.color || "#39ff14",
      recFor: [this._selectedClassName || (this.draft.class === CUSTOM_ID ? this.draft.custom.class.name : ""), step === "feats" ? SPECIES_NAMES[this._speciesKey()] : ""].filter(Boolean).join(" / "),
      recommendedCount: rows.filter(r => r.recommended && !r.hidden).length,
      hitDice: ["d6","d8","d10","d12"].map(d => ({ value:d, selected: d === this.draft.custom.class.hitDie })),
      customStep, custom: customStep ? this.draft.custom[step] : null,
      customSelected: !!customStep && this.draft[step] === CUSTOM_ID,
      showCustom: !!customStep && (this.showCustom[step] || this.draft[step] === CUSTOM_ID),
      isGM: game.user?.isGM ?? false,
      portrait: this.draft.img || "icons/svg/mystery-man.svg",
      isRules: step === "rules", isIdentity: step === "identity",
      isSingle: ["species","background","class","subclass"].includes(step),
      isAbilities: step === "abilities",
      ...(step === "abilities" ? this._abilityContext() : {}),
      isMulti: ["feats","spells","equipment"].includes(step),
      isDetails: step === "details", isReview: step === "review",
      canBack: this.stepIndex > 0,
      review: this._review()
    };
  }

  /** Work out whether an item is 2014 (legacy) or 2024 (5.5e) content. Returns "" when unknown. */
  static detectEdition(item, pack) {
    const flagged = item.flags?.[MODULE_ID]?.rules;
    if (flagged) return String(flagged);
    const source = item.system?.source;
    const rules = (source && typeof source === "object") ? source.rules : "";
    if (rules) return String(rules);
    const id = (pack?.collection || "").toLowerCase();
    const label = (pack?.metadata?.label || "").toLowerCase();
    if (/(24|2024)$/.test(id) || /2024|5\.5|phb ?24|srd 5\.2/.test(label)) return "2024";
    if (id.startsWith("dnd5e.") || /\(srd\)|legacy|2014|srd 5\.1/.test(label)) return "2014";
    return "";
  }

  /** Index compendium content once per builder; world items are re-read every time. */
  async _packRows() {
    if (this._packCache) return this._packCache;
    const allTypes = Object.values(TYPE_MAP).flat();
    const rows = [];
    for (const pack of game.packs || []) {
      if (pack.documentName !== "Item") continue;
      try {
        // Ask for whole objects (system.source, system.type), never nested keys: some packs store
        // a number or string there, and Foundry throws when indexing "system.source.rules" on those.
        let index;
        try {
          index = await pack.getIndex({ fields:["img","type","system.identifier","system.classIdentifier","system.source","system.type","system.level","system.rarity","flags."+MODULE_ID] });
        } catch (err) {
          console.warn(MODULE_ID, "Falling back to a basic index for", pack.collection, err);
          index = await pack.getIndex({ fields:["img","type"] });
        }
        for (const item of index) if (allTypes.includes(item.type)) rows.push(CharacterBuilder.makeRow(item, "Compendium."+pack.collection+"."+item._id, pack));
      } catch (err) { console.debug(MODULE_ID, "Skipped pack", pack.collection); }
    }
    return this._packCache = rows;
  }

  /** One catalog row from a world Item or a compendium index entry. */
  static makeRow(item, uuid, pack) {
    const flags = item.flags?.[MODULE_ID] || {};
    const type = (item.system?.type && typeof item.system.type === "object") ? item.system.type : {};
    return {
      uuid, name:item.name, type:item.type, img:item.img || "icons/svg/item-bag.svg",
      source: pack ? (pack.metadata.label || pack.collection) : (flags.homebrew ? "Homebrew" : "World"),
      identifier:item.system?.identifier || "", classIdentifier:item.system?.classIdentifier || "",
      rules:CharacterBuilder.detectEdition(item, pack),
      kind:type.value || "", category:type.subtype || "",
      level: typeof item.system?.level === "number" ? item.system.level : null,
      srd: !!pack && pack.collection.startsWith("dnd5e."),
      rarity: item.system?.rarity || "",
      monsterPack: !!pack && /monster|bestiar|creature|npc/i.test(pack.collection + " " + (pack.metadata.label || "")),
      homebrew: !!flags.homebrew, featureOf: flags.featureOf || ""
    };
  }

  /** Names → normalized, for recommendation lookups. */
  static nameSet(names) { return new Set((names || []).map(normalizeName)); }

  static nameMatches(set, name) {
    const n = normalizeName(name);
    if (set.has(n)) return true;
    for (const rec of set) if (n.startsWith(rec + " ")) return true;
    return false;
  }

  _speciesKey() {
    if (this.draft.species === CUSTOM_ID) return speciesKey(this.draft.custom.species.name);
    const row = (this.catalog.species || []).find(r => r.uuid === this.draft.species);
    return speciesKey(row?.name);
  }

  /** Class identifiers to offer in "for class" dropdowns: known classes plus any in the catalog. */
  _classChoices() {
    const map = new Map(Object.entries(CLASS_NAMES));
    for (const row of this.catalog.class || []) {
      const id = row.identifier || foundry.utils.slugify(row.name, { strict:true });
      if (id && !map.has(id)) map.set(id, row.name);
    }
    if (this.draft.class === CUSTOM_ID && this.draft.custom.class.name) map.set(this._classIdentifier(), this.draft.custom.class.name);
    return [...map.entries()].sort((a,b) => a[1].localeCompare(b[1]));
  }

  _spellListIds(classId) {
    const list = globalThis.dnd5e?.registry?.spellLists?.forType?.("class", classId);
    if (!list) return null;
    try { return new Set(list.identifiers); } catch (err) { return null; }
  }

  /**
   * Extra filters for list steps: the class/species dropdown, what is recommended (highlighted
   * in the class color), feat category, spell level and item rarity.
   */
  _stepFilters(step, rows) {
    const classId = this._classIdentifier();
    const choice = this.classFilter[step] ?? (classId && step === "spells" ? "class:" + classId : "all");
    const color = CLASS_COLORS[classId] || "#39ff14";
    const out = { color };
    const options = [{ value:"all", label: step === "spells" ? "All spells" : step === "feats" ? "All feats" : step === "equipment" ? "All items" : "Everything", selected: choice === "all" }];
    if (["feats","spells","equipment"].includes(step)) {
      options.push(...this._classChoices().map(([id, name]) => ({ value:"class:"+id, label:(step === "spells" ? name + " spell list" : "Good for " + name) + (id === classId ? " (your class)" : ""), selected: choice === "class:"+id })));
    }
    if (step === "feats") {
      options.push(...Object.entries(SPECIES_NAMES).map(([key, name]) => ({ value:"species:"+key, label:"Good for " + name + (key === this._speciesKey() ? " (your species)" : ""), selected: choice === "species:"+key, group:"species" })));
    }
    out.classOptions = options.length > 1 ? options : null;

    const featRecs = (kind, key) => {
      const names = FEAT_RECOMMENDATIONS[kind]?.[key];
      const set = CharacterBuilder.nameSet(names);
      const origin = kind === "species" && ORIGIN_FEAT_SPECIES.includes(key) && this.draft.rules === "2024";
      return r => CharacterBuilder.nameMatches(set, r.name) || (origin && r.category === "origin");
    };
    const filters = [];
    let [kind, key] = choice === "all" ? [null, null] : choice.split(":");

    if (step === "feats") {
      if (this.featCategory) filters.push(r => r.category === this.featCategory);
      if (kind) filters.push(featRecs(kind, key));
      const byClass = classId ? featRecs("class", classId) : null;
      const bySpecies = this._speciesKey() ? featRecs("species", this._speciesKey()) : null;
      out.recommended = r => !!(byClass?.(r) || bySpecies?.(r));
    }
    if (step === "spells") {
      if (this.spellLevel === "low") filters.push(r => r.level === null || r.level <= 1);
      else if (this.spellLevel !== "all") filters.push(r => r.level === Number(this.spellLevel));
      const idsFor = id => this._spellListIds(id);
      const inList = (ids, r) => ids.has(r.identifier || normalizeName(r.name).replace(/ /g,"-"));
      if (kind === "class") {
        const ids = idsFor(key);
        if (ids) filters.push(r => inList(ids, r) || r.homebrew);
        else out.note = "No spell list is registered for " + (CLASS_NAMES[key] || key) + ", so all spells are shown.";
      }
      const mine = classId ? idsFor(classId) : null;
      if (mine) out.recommended = r => inList(mine, r);
    }
    if (step === "equipment") {
      if (this.rarity === "mundane") filters.push(r => !r.rarity);
      else if (this.rarity === "magic") filters.push(r => !!r.rarity);
      else if (this.rarity) filters.push(r => r.rarity === this.rarity);
      if (kind === "class") { const set = CharacterBuilder.nameSet(EQUIPMENT_RECOMMENDATIONS[key]); filters.push(r => CharacterBuilder.nameMatches(set, r.name)); }
      if (classId) { const set = CharacterBuilder.nameSet(EQUIPMENT_RECOMMENDATIONS[classId]); out.recommended = r => CharacterBuilder.nameMatches(set, r.name); }
    }
    if (filters.length) out.filter = r => filters.every(f => f(r));
    return out;
  }

  /** Is this row something a player picks on this step (no monster or class features, no natural weapons)? */
  static isPlayerOption(key, row) {
    if (row.monsterPack && ["feats","equipment","spells"].includes(key)) return false;
    if (key === "feats") return row.kind === "feat" || (!row.kind && row.homebrew && !row.featureOf);
    if (key === "equipment") return !NON_PLAYER_EQUIPMENT.includes(row.kind);
    return true;
  }

  _classIdentifier() {
    if (this.draft.class === CUSTOM_ID) return foundry.utils.slugify(this.draft.custom.class.name || "custom-class", { strict:true });
    return this._selectedClassIdentifier || "";
  }

  async _scanContent() {
    const worldRows = [];
    for (const item of game.items || []) worldRows.push(CharacterBuilder.makeRow(item, item.uuid, null));
    const allRows = [...worldRows, ...await this._packRows()];
    if (this.draft.class && this.draft.class !== CUSTOM_ID) {
      const chosen = await fromUuid(this.draft.class);
      this._selectedClassIdentifier = chosen?.system?.identifier || foundry.utils.slugify(chosen?.name || "", { strict:true });
      const primary = chosen?.system?.primaryAbility?.value;
      this._classPrimaryFromItem = primary ? [...primary].filter(k => ABILITY_KEYS.includes(k)) : [];
      this._selectedClassName = chosen?.name || "";
    } else if (!this.draft.class) {
      this._selectedClassIdentifier = ""; this._classPrimaryFromItem = []; this._selectedClassName = "";
    }
    for (const [key, types] of Object.entries(TYPE_MAP)) {
      let rows = allRows.filter(r => types.includes(r.type) && CharacterBuilder.isPlayerOption(key, r));
      if (key === "subclass") rows = this.draft.class ? rows.filter(r => r.classIdentifier === this._classIdentifier()) : [];
      this.catalog[key] = rows.filter((r,i,a) => a.findIndex(x => x.uuid === r.uuid) === i).sort((a,b) => a.name.localeCompare(b.name) || a.source.localeCompare(b.source));
    }
  }

  _collect() {
    const root = this.element;
    if (!root) return;
    const get = n => {
      const checked = root.querySelector('[name="'+n+'"]:checked');
      if (checked) return checked.value;
      const field = root.querySelector('[name="'+n+'"]');
      if (field?.type === "radio") return "";
      return field?.value ?? undefined;
    };
    if (get("rules")) this.draft.rules = get("rules");
    if (get("name") !== undefined) this.draft.name = get("name").trim();
    if (get("img") !== undefined) this.draft.img = get("img").trim();
    const currentStep = STEPS[this.stepIndex];
    const custom = CUSTOM_STEPS[currentStep] ? this.draft.custom[currentStep] : null;
    if (custom) {
      if (get("customName") !== undefined) custom.name = get("customName").trim();
      if (get("customDescription") !== undefined) custom.description = get("customDescription");
      if (get("customHitDie") !== undefined) custom.hitDie = get("customHitDie");
      const save = root.querySelector('[name="customSave"]');
      if (save) custom.save = save.checked;
    }
    if (get("details") !== undefined) this.draft.details = get("details");
    for (const key of Object.keys(this.draft.info)) if (get("info-"+key) !== undefined) this.draft.info[key] = get("info-"+key);
    for (const ability of ABILITY_KEYS) {
      if (get(ability) !== undefined) this.draft.abilities[ability] = Math.max(3, Math.min(30, Number(get(ability)) || 10));
      const assigned = root.querySelector('[name="assign-'+ability+'"]');
      if (assigned) this._assignMap()[ability] = assigned.value;
    }
    if (STEPS[this.stepIndex] === "abilities") this._applyAbilityMethod();
    const step = STEPS[this.stepIndex];
    // Only overwrite when something visible is picked, so choices hidden by a filter survive.
    if (["species","background","class","subclass"].includes(step) && get(step)) this.draft[step] = get(step);
    if (["feats","spells","equipment"].includes(step)) {
      const boxes = [...root.querySelectorAll('input[name="'+step+'"]')];
      const shown = new Set(boxes.map(x => x.value));
      const kept = (this.draft[step] || []).filter(uuid => !shown.has(uuid));
      this.draft[step] = [...kept, ...boxes.filter(x => x.checked).map(x => x.value)];
    }
  }

  _review() {
    const rowFor = uuid => { for (const rows of Object.values(this.catalog)) { const r = rows.find(x => x.uuid === uuid); if (r) return r; } return null; };
    const single = (key, label) => {
      const value = this.draft[key];
      const custom = value === CUSTOM_ID && CUSTOM_STEPS[key];
      const row = custom ? null : rowFor(value);
      return { step:key, label, value: custom ? (this.draft.custom[key].name || "Unnamed") + " (custom)" : (row?.name || (value ? value : "None")),
        img: row?.img || "", missing: !value };
    };
    const multi = (key, label) => ({
      step:key, label, multi:true, value: this.draft[key].length ? "" : "None",
      items: this.draft[key].map(uuid => { const r = rowFor(uuid); return { uuid, name:r?.name || uuid, img:r?.img || "", tag: r?.type === "spell" && r.level !== null ? (r.level === 0 ? "Cantrip" : ordinal(r.level)) : (RARITIES[r?.rarity]?.label || ""), color: RARITIES[r?.rarity]?.color || "" }; })
    });
    const scores = ABILITY_KEYS.map(k => { const v = this.draft.abilities[k], m = Math.floor((v - 10) / 2); return k.toUpperCase() + " " + v + " (" + (m >= 0 ? "+" : "") + m + ")"; }).join(" · ");
    const info = this.draft.info;
    const look = DETAIL_FIELDS.physical.filter(([k]) => info[k]).map(([k,l]) => l + ": " + info[k]).join(" · ");
    return [
      { step:"rules", label:"Rules", value:this.draft.rules === "2014" ? "D&D 5e 2014 / Legacy" : "D&D 2024 / 5.5e" },
      { step:"identity", label:"Name", value:this.draft.name || "Unnamed", img:this.draft.img || "", missing:!this.draft.name },
      single("species", "Species / Race"), single("background", "Background"), single("class", "Class"), single("subclass", "Subclass"),
      { step:"abilities", label:"Abilities", value:scores },
      multi("feats", "Feats"), multi("spells", "Spells"), multi("equipment", "Equipment"),
      { step:"details", label:"Details", value:[info.alignment, look].filter(Boolean).join(" · ") || "None" }
    ];
  }

  static async next() {
    this._collect();
    if (STEPS[this.stepIndex] === "identity" && !this.draft.name) return ui.notifications.warn("Enter a character name.");
    const stepKey = STEPS[this.stepIndex];
    if (stepKey === "abilities") {
      const problem = this._abilityProblem();
      if (problem) return ui.notifications.warn(problem);
    }
    if (CUSTOM_STEPS[stepKey] && this.draft[stepKey] === CUSTOM_ID && !this.draft.custom[stepKey].name) {
      return ui.notifications.warn("Enter a name for the custom " + CUSTOM_STEPS[stepKey].label.toLowerCase() + ".");
    }
    const current=STEPS[this.stepIndex];
    if(current==="class" && this.draft.class && this.draft.class !== CUSTOM_ID){
      const cls=await fromUuid(this.draft.class);
      const subclassLevel=(cls?.system?.advancement || []).find(a=>a.type==="Subclass")?.level;
      if(!subclassLevel || subclassLevel>1) this.draft.subclass="";
    }
    this.stepIndex = Math.min(STEPS.length - 1, this.stepIndex + 1);
    return this.render({ force:true });
  }

  static async back() {
    this._collect();
    this.stepIndex = Math.max(0, this.stepIndex - 1);
    return this.render({ force:true });
  }

  /* ---------------- Ability scores ---------------- */

  _assignMap() {
    return this.draft.abilityMethod === "roll" ? this.draft.rollAssign : this.draft.arrayAssign;
  }

  _pool() {
    return this.draft.abilityMethod === "roll" ? this.draft.rolled.map(r => r.total) : STANDARD_ARRAY;
  }

  _pointsSpent() {
    return ABILITY_KEYS.reduce((sum, k) => sum + (POINT_BUY_COST[this.draft.pointBuy[k]] ?? 0), 0);
  }

  /** Copy the current method's numbers into draft.abilities. */
  _applyAbilityMethod() {
    const method = this.draft.abilityMethod;
    if (method === "manual") return;
    for (const k of ABILITY_KEYS) {
      if (method === "pointbuy") this.draft.abilities[k] = this.draft.pointBuy[k];
      else {
        const idx = this._assignMap()[k];
        const value = idx === "" ? undefined : this._pool()[Number(idx)];
        this.draft.abilities[k] = value ?? 8;
      }
    }
  }

  _abilityProblem() {
    const method = this.draft.abilityMethod;
    if (method === "pointbuy" && this._pointsSpent() > POINT_BUY_BUDGET) return "You have spent more than " + POINT_BUY_BUDGET + " points.";
    if (method === "roll" && this.draft.rolled.length !== 6) return "Roll your ability scores first.";
    if (method === "standard" || method === "roll") {
      const map = this._assignMap();
      if (ABILITY_KEYS.some(k => map[k] === "")) return "Assign a score to every ability.";
    }
    return "";
  }

  _classAbilities() {
    const known = CLASS_ABILITIES[this._selectedClassIdentifier];
    if (known) return known;
    return { primary: this._classPrimaryFromItem || [], secondary: [] };
  }

  _abilityContext() {
    const method = this.draft.abilityMethod;
    const pool = this._pool();
    const map = this._assignMap();
    const best = this._classAbilities();
    const spent = this._pointsSpent();
    const rows = ABILITY_KEYS.map(k => {
      const value = method === "manual" ? this.draft.abilities[k] : (method === "pointbuy" ? this.draft.pointBuy[k] : this.draft.abilities[k]);
      const mod = Math.floor((value - 10) / 2);
      const pb = this.draft.pointBuy[k];
      const usedBy = idx => ABILITY_KEYS.find(o => o !== k && map[o] === String(idx));
      return {
        key:k, label:k.toUpperCase(), name:ABILITY_NAMES[k], value,
        mod:(mod >= 0 ? "+" : "") + mod,
        primary:best.primary.includes(k), secondary:!best.primary.includes(k) && best.secondary.includes(k),
        assigned: map[k] !== "",
        canInc: pb < 15 && spent - (POINT_BUY_COST[pb] ?? 0) + (POINT_BUY_COST[pb + 1] ?? 99) <= POINT_BUY_BUDGET,
        canDec: pb > 8,
        cost: POINT_BUY_COST[pb] ?? 0,
        options: pool.map((v, i) => ({ index:String(i), value:v, selected:map[k] === String(i), taken:!!usedBy(i), takenBy:(usedBy(i) || "").toUpperCase() }))
      };
    });
    return {
      abilityRows: rows,
      abilityMethods: ABILITY_METHODS.map(m => ({ ...m, active:m.value === method })),
      isPointBuy: method === "pointbuy", isStandard: method === "standard", isRoll: method === "roll", isManual: method === "manual",
      isAssign: method === "standard" || (method === "roll" && this.draft.rolled.length === 6),
      pointsLeft: POINT_BUY_BUDGET - spent, pointBudget: POINT_BUY_BUDGET,
      rolled: this.draft.rolled,
      bestFor: this._selectedClassName || (this.draft.class === CUSTOM_ID ? this.draft.custom.class.name : ""),
      bestPrimary: best.primary.map(k => ABILITY_NAMES[k]).join(best.either ? " or " : " and "),
      bestSecondary: best.secondary.map(k => ABILITY_NAMES[k]).join(", "),
      canSuggest: best.primary.length > 0 && method !== "manual" && !(method === "roll" && this.draft.rolled.length !== 6),
      abilityNote: this.draft.rules === "2024"
        ? "2024 rules: your background adds +2/+1 (or +1/+1/+1) on top of these scores."
        : "2014 rules: your race adds its ability bonuses on top of these scores."
    };
  }

  static setAbilityMethod(event, target) {
    this._collect();
    this.draft.abilityMethod = target.dataset.method;
    this._applyAbilityMethod();
    return this.render({ force:true });
  }

  static adjustPointBuy(event, target) {
    this._collect();
    const k = target.dataset.ability, delta = Number(target.dataset.delta);
    const next = this.draft.pointBuy[k] + delta;
    if (next < 8 || next > 15) return;
    const spent = this._pointsSpent() - POINT_BUY_COST[this.draft.pointBuy[k]] + POINT_BUY_COST[next];
    if (spent > POINT_BUY_BUDGET) return ui.notifications.warn("Not enough points left.");
    this.draft.pointBuy[k] = next;
    this._applyAbilityMethod();
    return this.render({ force:true });
  }

  static async rollAbilities() {
    this._collect();
    const results = [];
    for (let i = 0; i < 6; i++) {
      const roll = await new Roll("4d6kh3").evaluate();
      const dice = roll.dice[0]?.results?.map(r => ({ value:r.result, dropped:!r.active })) ?? [];
      results.push({ total:roll.total, dice });
    }
    this.draft.rolled = results;
    for (const k of ABILITY_KEYS) this.draft.rollAssign[k] = "";
    this._applyAbilityMethod();
    return this.render({ force:true });
  }

  /** Put the highest scores into the class's best abilities, then Constitution, then the rest. */
  static suggestAbilities() {
    this._collect();
    const best = this._classAbilities();
    const order = [...new Set([...best.primary, ...best.secondary, "con", "dex", "wis", "str", "cha", "int"])];
    const method = this.draft.abilityMethod;
    if (method === "pointbuy") {
      // Both spreads cost exactly 27 points.
      const spread = best.primary.length >= 2 && !best.either ? [15, 15, 14, 10, 8, 8] : [15, 14, 13, 12, 10, 8];
      order.forEach((k, i) => { this.draft.pointBuy[k] = spread[i]; });
    } else {
      const pool = this._pool().map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v);
      const map = this._assignMap();
      order.forEach((k, i) => { map[k] = String(pool[i].i); });
    }
    this._applyAbilityMethod();
    return this.render({ force:true });
  }

  /** When a pool value is picked that another ability already has, swap them. */
  _onAssignChange(event) {
    const k = event.target.name.replace("assign-", "");
    const map = this._assignMap();
    const previous = map[k];
    const picked = event.target.value;
    const other = ABILITY_KEYS.find(o => o !== k && map[o] === picked && picked !== "");
    this._collect();
    if (other) map[other] = previous;
    map[k] = picked;
    this._applyAbilityMethod();
    return this.render({ force:true });
  }

  /** Levels of the currently chosen spells, looked up in the catalog. */
  _selectedSpellLevels() {
    const byUuid = new Map((this.catalog.spells || []).map(r => [r.uuid, r.level]));
    const levels = {};
    for (const uuid of this.draft.spells) levels[uuid] = byUuid.get(uuid) ?? null;
    return levels;
  }

  /** How many cantrips and 1st-level spells this class gets at level 1, and how many are picked. */
  _spellAllowance() {
    const classId = this._classIdentifier();
    const className = this._selectedClassName || (this.draft.class === CUSTOM_ID ? this.draft.custom.class.name : "");
    const table = SPELLCASTING[this.draft.rules] || SPELLCASTING["2024"];
    const levels = Object.values(this._selectedSpellLevels());
    const picked = { cantrips: levels.filter(l => l === 0).length, spells: levels.filter(l => l !== 0).length };
    const caster = table[classId];
    if (!classId) return { none:true, message:"Pick a class to see how many spells you get.", picked };
    if (!caster) return { none:true, message: className + " has no spellcasting at level 1. Feats like Magic Initiate can still grant spells.", picked, className };
    const mod = Math.floor(((this.draft.abilities[caster.ability] ?? 10) - 10) / 2);
    let spells = typeof caster.prepared === "number" ? caster.prepared : Math.max(1, mod + caster.prepared.plus);
    let cantrips = caster.cantrips;
    const bonus = [];
    const featNames = this.draft.feats.map(uuid => (this.catalog.feats || []).find(r => r.uuid === uuid)?.name || "");
    if (featNames.some(n => /magic initiate/i.test(n))) { cantrips += 2; spells += 1; bonus.push("Magic Initiate: +2 cantrips, +1 1st-level spell"); }
    const formula = typeof caster.prepared === "number" ? "" : ABILITY_NAMES[caster.prepared.ability] + " modifier" + (caster.prepared.plus ? " + " + caster.prepared.plus : "") + " (min 1)";
    return {
      className, edition: this.draft.rules, ability: ABILITY_NAMES[caster.ability], note: caster.note || "",
      cantrips, spells, slots: caster.slots, pact: !!caster.pact, spellbook: caster.spellbook || 0,
      modeLabel: caster.mode === "known" ? "Spells known" : "Prepared spells", formula, bonus,
      picked, overCantrips: picked.cantrips > cantrips, overSpells: picked.spells > spells,
      none: caster.mode === "none"
    };
  }

  static gotoStep(event, target) {
    this._collect();
    const index = STEPS.indexOf(target.dataset.step);
    if (index < 0) return;
    this.stepIndex = index;
    return this.render({ force:true });
  }

  static removePick(event, target) {
    this._collect();
    const { step, uuid } = target.dataset;
    if (Array.isArray(this.draft[step])) this.draft[step] = this.draft[step].filter(u => u !== uuid);
    return this.render({ force:true });
  }

  static setEdition(event, target) {
    this._collect();
    this.editionFilter[STEPS[this.stepIndex]] = target.dataset.value;
    return this.render({ force:true });
  }

  static toggleSrd() {
    this._collect();
    const step = STEPS[this.stepIndex];
    this.srdOnly[step] = !this.srdOnly[step];
    return this.render({ force:true });
  }

  static openMultiCustom() {
    this._collect();
    const step = STEPS[this.stepIndex];
    const preset = MULTI_CUSTOM[step];
    if (!preset) return;
    return new CustomContentImporter({ parentBuilder:this, type:preset.type, rules:this.draft.rules, selectStep:step }).render({ force:true });
  }

  static filterSource(event, target) {
    this._collect();
    this.sourceFilter[STEPS[this.stepIndex]] = target.dataset.source || "";
    return this.render({ force:true });
  }

  static toggleCustom() {
    this._collect();
    const step = STEPS[this.stepIndex];
    if (!CUSTOM_STEPS[step]) return;
    const open = !(this.showCustom[step] || this.draft[step] === CUSTOM_ID);
    this.showCustom[step] = open;
    if (open) this.draft[step] = CUSTOM_ID;
    else if (this.draft[step] === CUSTOM_ID) this.draft[step] = "";
    return this.render({ force:true });
  }

  static get FilePickerClass() {
    return foundry.applications?.apps?.FilePicker?.implementation ?? globalThis.FilePicker;
  }

  static browsePortrait() {
    this._collect();
    const FP = CharacterBuilder.FilePickerClass;
    return new FP({ type:"image", current:this.draft.img || "", callback:path => { this.draft.img = path; this.render({ force:true }); } }).render({ force:true });
  }

  static clearPortrait() {
    this._collect();
    this.draft.img = "";
    return this.render({ force:true });
  }

  async _uploadPortrait(event) {
    const file = event.target.files?.[0]; if (!file) return;
    this._collect();
    if (!file.type.startsWith("image/")) return ui.notifications.warn("Choose an image file.");
    const FP = CharacterBuilder.FilePickerClass;
    const dir = "worlds/" + game.world.id + "/character-portraits";
    try {
      try { await FP.createDirectory("data", dir); } catch (err) { /* already exists */ }
      const safeName = Date.now() + "-" + file.name.replace(/[^\w.-]+/g, "_");
      const upload = new File([file], safeName, { type:file.type });
      const result = await FP.upload("data", dir, upload, {}, { notify:false });
      if (!result?.path) throw new Error(result?.message || "Upload failed");
      this.draft.img = result.path;
      ui.notifications.info("Portrait uploaded.");
    } catch (err) {
      console.error(MODULE_ID, "Portrait upload failed", err);
      ui.notifications.error("Could not upload the image. You may need file-upload permission; ask your GM or use Browse.");
    }
    return this.render({ force:true });
  }

  _onRender(context, options) {
    super._onRender(context, options);
    this.element.querySelector('[name="editionFilter"]')?.addEventListener("change", e => {
      this._collect();
      this.editionFilter[STEPS[this.stepIndex]] = e.target.value;
      this.render({ force:true });
    });
    const step = STEPS[this.stepIndex];
    const rerenderOn = (name, apply) => this.element.querySelector('[name="'+name+'"]')?.addEventListener("change", e => { this._collect(); apply(e.target.value); this.render({ force:true }); });
    rerenderOn("classFilter", v => { this.classFilter[step] = v; });
    rerenderOn("featCategory", v => { this.featCategory = v; });
    rerenderOn("spellLevel", v => { this.spellLevel = v; });
    rerenderOn("rarityFilter", v => { this.rarity = v; });
    // Search filters the cards in place so typing keeps focus.
    this.element.querySelector('[name="listSearch"]')?.addEventListener("input", e => {
      const q = e.target.value.trim().toLowerCase();
      this.search[step] = e.target.value;
      let shown = 0;
      for (const card of this.element.querySelectorAll(".content-list label[data-name]")) {
        const hide = !!q && !card.dataset.name.includes(q);
        card.classList.toggle("is-hidden", hide);
        if (!hide) shown++;
      }
      const empty = this.element.querySelector(".search-empty");
      if (empty) empty.hidden = shown > 0;
    });
    // Live cantrip / spell counter while ticking spells.
    if (step === "spells") this.element.querySelectorAll('input[name="spells"]').forEach(box => box.addEventListener("change", () => {
      this._collect();
      const info = this._spellAllowance();
      for (const [kind, over] of [["cantrips", info.overCantrips], ["spells", info.overSpells]]) {
        const el = this.element.querySelector('.sa-count[data-kind="'+kind+'"]');
        if (!el) continue;
        el.querySelector(".sa-picked").textContent = info.picked[kind];
        el.classList.toggle("over", !!over);
      }
    }));
    this.element.querySelectorAll('select[name^="assign-"]').forEach(el => el.addEventListener("change", e => this._onAssignChange(e)));
    this.element.querySelector('[name="portraitFile"]')?.addEventListener("change", e => this._uploadPortrait(e));
    this.element.querySelector('[name="img"]')?.addEventListener("change", e => {
      const preview = this.element.querySelector(".portrait-preview img");
      if (preview) preview.src = e.target.value || "icons/svg/mystery-man.svg";
    });
  }

  async _customItemData(step) {
    const entry = this.draft.custom[step];
    const data = {
      name: entry.name, type: CUSTOM_STEPS[step].type,
      system: { description: { value: contentToHtml(entry.description, "markdown"), chat: "" } },
      flags: { [MODULE_ID]: { homebrew: true, rules: this.draft.rules } }
    };
    if (step === "class") Object.assign(data.system, { identifier: this._classIdentifier(), levels: 1, hd: { denomination: entry.hitDie || "d8", spent: 0 } });
    if (step === "subclass") Object.assign(data.system, { identifier: foundry.utils.slugify(entry.name, { strict:true }), classIdentifier: this._classIdentifier() });
    if (entry.save && game.user?.isGM) {
      const item = await Item.create(data);
      return item.toObject();
    }
    return data;
  }

  static customContent() { return new CustomContentImporter({parentBuilder:this}).render({ force:true }); }

  async _embed(actor, uuids) {
    for (const uuid of uuids.filter(Boolean)) {
      try {
        const source = await fromUuid(uuid);
        if (source) await actor.createEmbeddedDocuments("Item", [source.toObject()]);
      } catch (err) { console.error(MODULE_ID, "Could not add", uuid, err); }
    }
  }

  static async createCharacter() {
    this._collect();
    if (!this.draft.name) return ui.notifications.warn("Enter a character name.");
    this._applyAbilityMethod();
    try {
      const abilities = {};
      for (const [key,value] of Object.entries(this.draft.abilities)) abilities[key] = { value };
      const actor = await Actor.create({
        name: this.draft.name,
        type: "character",
        ...(this.draft.img ? { img: this.draft.img, prototypeToken: { texture: { src: this.draft.img } } } : {}),
        system: {
          abilities,
          details: {
            ...Object.fromEntries(Object.entries(this.draft.info).filter(([, v]) => v)),
            ...(this.draft.details ? { biography: { value: contentToHtml(this.draft.details, "markdown") } } : {})
          }
        },
        flags: { [MODULE_ID]: { rules:this.draft.rules, details:this.draft.details } }
      });
      // Species, background, class, then subclass, so a subclass always finds its class.
      for (const step of ["species","background","class","subclass"]) {
        if (this.draft[step] !== CUSTOM_ID) { await this._embed(actor, [this.draft[step]]); continue; }
        try { await actor.createEmbeddedDocuments("Item", [await this._customItemData(step)]); }
        catch (err) { console.error(MODULE_ID, "Could not add custom " + step, err); }
      }
      await this._embed(actor, [
        ...this.draft.feats, ...this.draft.spells, ...this.draft.equipment
      ]);
      ui.notifications.info("Created "+actor.name+".");
      actor.sheet?.render({ force:true });
      return this.close();
    } catch (err) {
      console.error(MODULE_ID, err);
      return ui.notifications.error("Character creation failed. Check the console.");
    }
  }
}

const CONTENT_TYPES = [
  {value:"race",label:"Species / Race"},{value:"background",label:"Background"},{value:"class",label:"Class"},
  {value:"subclass",label:"Subclass"},{value:"feat",label:"Feat / Feature"},{value:"spell",label:"Spell"},
  {value:"equipment",label:"Equipment"},{value:"weapon",label:"Weapon"},{value:"tool",label:"Tool"},{value:"consumable",label:"Consumable"}
];
const TYPE_ALIASES = { species:"race", race:"race", feature:"feat", feat:"feat", item:"equipment", armor:"equipment", gear:"equipment" };

function escapeHtml(text) {
  return String(text).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function inlineMarkdown(text) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*\*([^*]+)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, (m,a,b) => "<strong>"+(a ?? b)+"</strong>")
    .replace(/\*([^*\s][^*]*)\*|_([^_\s][^_]*)_/g, (m,a,b) => "<em>"+(a ?? b)+"</em>")
    .replace(/~~([^~]+)~~/g, "<s>$1</s>")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m,label,url) => /^(https?:|\/|#)/i.test(url) ? '<a href="'+url+'">'+label+"</a>" : label);
}

/** Small Markdown → HTML converter used when Foundry's showdown is not available. */
function fallbackMarkdown(md) {
  const lines = String(md).replace(/\r\n?/g,"\n").split("\n");
  const out = [];
  let para = [], list = null;
  const flushPara = () => { if (para.length) out.push("<p>"+para.map(inlineMarkdown).join("<br>")+"</p>"); para = []; };
  const flushList = () => { if (list) out.push("<"+list.tag+">"+list.items.map(i=>"<li>"+inlineMarkdown(i)+"</li>").join("")+"</"+list.tag+">"); list = null; };
  const cells = row => row.trim().replace(/^\||\|$/g,"").split("|").map(c=>c.trim());
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) { flushPara(); flushList(); continue; }
    let m;
    if ((m = line.match(/^(#{1,6})\s+(.*)$/))) { flushPara(); flushList(); out.push("<h"+m[1].length+">"+inlineMarkdown(m[2].replace(/#+\s*$/,""))+"</h"+m[1].length+">"); continue; }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { flushPara(); flushList(); out.push("<hr>"); continue; }
    if (/^\s*\|.*\|\s*$/.test(line) && /^\s*\|?\s*:?-{2,}/.test(lines[i+1] || "")) {
      flushPara(); flushList();
      const head = cells(line); i += 1;
      const body = [];
      while (i+1 < lines.length && /^\s*\|.*\|\s*$/.test(lines[i+1])) body.push(cells(lines[++i]));
      out.push("<table><thead><tr>"+head.map(c=>"<th>"+inlineMarkdown(c)+"</th>").join("")+"</tr></thead><tbody>"
        + body.map(r=>"<tr>"+r.map(c=>"<td>"+inlineMarkdown(c)+"</td>").join("")+"</tr>").join("")+"</tbody></table>");
      continue;
    }
    if ((m = line.match(/^\s*>\s?(.*)$/))) { flushPara(); flushList(); out.push("<blockquote><p>"+inlineMarkdown(m[1])+"</p></blockquote>"); continue; }
    if ((m = line.match(/^\s*(?:[-*+]|(\d+)[.)])\s+(.*)$/))) {
      flushPara();
      const tag = m[1] ? "ol" : "ul";
      if (!list || list.tag !== tag) { flushList(); list = { tag, items: [] }; }
      list.items.push(m[2]); continue;
    }
    if (list && /^\s{2,}\S/.test(line)) { list.items[list.items.length-1] += " "+line.trim(); continue; }
    flushList(); para.push(line.trim());
  }
  flushPara(); flushList();
  return out.join("\n");
}

function markdownToHtml(md) {
  try {
    if (globalThis.showdown?.Converter) return new globalThis.showdown.Converter({ tables:true, strikethrough:true, simpleLineBreaks:true }).makeHtml(md);
  } catch (err) { console.debug(MODULE_ID, "showdown failed, using fallback", err); }
  return fallbackMarkdown(md);
}

/** Convert builder text into the HTML that D&D5e stores in item descriptions. */
function contentToHtml(text, format="markdown") {
  if (!text?.trim()) return "";
  if (format === "html") return text;
  if (format === "text") return text.trim().split(/\n{2,}/).map(p => "<p>"+escapeHtml(p).replace(/\n/g,"<br>")+"</p>").join("\n");
  return markdownToHtml(text);
}

/** Read simple YAML front matter (key: value, and "- item" lists) from a Markdown file. */
function parseFrontMatter(text) {
  const match = String(text).replace(/^﻿/,"").match(/^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/);
  if (!match) return { meta:{}, body:String(text) };
  const meta = {}; let lastKey = null;
  for (const raw of match[1].split("\n")) {
    const item = raw.match(/^\s*-\s+(.*)$/);
    if (item && lastKey) { if (!Array.isArray(meta[lastKey])) meta[lastKey] = []; meta[lastKey].push(item[1].trim().replace(/^["']|["']$/g,"")); continue; }
    const kv = raw.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (!kv) continue;
    lastKey = kv[1].toLowerCase();
    const value = kv[2].trim();
    if (value.startsWith("[") && value.endsWith("]")) meta[lastKey] = value.slice(1,-1).split(",").map(x=>x.trim().replace(/^["']|["']$/g,"")).filter(Boolean);
    else meta[lastKey] = value.replace(/^["']|["']$/g,"");
  }
  return { meta, body:String(text).slice(match[0].length) };
}

class CustomContentImporter extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id:"dnd5e-pc-custom-content", classes:["dnd5e-pc-character-builder"], tag:"form",
    window:{ title:"Add Custom Character Content", resizable:true }, position:{ width:760, height:760 },
    actions:{ save:CustomContentImporter.save }
  };
  static PARTS = { form:{ template:"modules/dnd5e-pc-homebrew-builder/templates/importer.hbs" } };

  constructor(options={}) {
    super(options);
    this.data = { rules:options.rules || "2024", type:options.type || "feat", name:"", description:"", format:"markdown", identifier:"", classIdentifier:"", featureNames:"" };
    this.parentBuilder = options.parentBuilder || null;
    this.selectStep = options.selectStep || null;
  }

  async _prepareContext() {
    const classes = [];
    for (const item of game.items || []) if (item.type === "class") classes.push({ name:item.name, identifier:item.system?.identifier || foundry.utils.slugify(item.name,{strict:true}) });
    for (const pack of game.packs || []) {
      if (pack.documentName !== "Item") continue;
      try {
        const idx = await pack.getIndex({ fields:["type","system.identifier"] });
        for (const i of idx) if (i.type === "class") classes.push({ name:i.name, identifier:i.system?.identifier || foundry.utils.slugify(i.name,{strict:true}) });
      } catch (err) { console.debug(MODULE_ID, "Skipped pack", pack.collection); }
    }
    return {
      data:this.data, types:CONTENT_TYPES,
      isClassLike:["class","subclass"].includes(this.data.type), isSubclass:this.data.type === "subclass",
      classes:classes.filter((x,i,a)=>a.findIndex(y=>y.identifier===x.identifier)===i).sort((a,b)=>a.name.localeCompare(b.name))
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const el = this.element;
    el.querySelector('[name="json"]')?.addEventListener("change", e => this._loadJson(e));
    el.querySelector('[name="pdf"]')?.addEventListener("change", e => this._loadPdf(e));
    el.querySelector('[name="markdown"]')?.addEventListener("change", e => this._loadMarkdown(e));
    el.querySelector('[name="type"]')?.addEventListener("change", e => { this._collect(); this.data.type = e.target.value; this.render({ force:true }); });
  }

  _collect() {
    const el = this.element;
    const rules = el.querySelector('[name="rules"]:checked');
    if (rules) this.data.rules = rules.value;
    for (const key of ["type","name","description","format","identifier","classIdentifier","featureNames"]) {
      const field = el.querySelector('[name="'+key+'"]');
      if (field) this.data[key] = field.value;
    }
  }

  async _loadJson(event) {
    const file = event.target.files?.[0]; if (!file) return;
    this._collect();
    try {
      const raw = JSON.parse(await file.text());
      const value = Array.isArray(raw) ? raw[0] : (raw.items?.[0] || raw);
      this.data.type = TYPE_ALIASES[value.type] || value.type || this.data.type;
      this.data.name = value.name || "";
      this.data.description = value.system?.description?.value || value.description || "";
      this.data.format = "html";
      this.data.identifier = value.system?.identifier || value.identifier || "";
      this.data.classIdentifier = value.system?.classIdentifier || value.classIdentifier || "";
      this.data.featureNames = (value.features || value.classFeatures || value.subclassFeatures || []).map(x => typeof x === "string" ? x : x.name).filter(Boolean).join("\n");
      this.data.rules = value.flags?.[MODULE_ID]?.rules || this.data.rules;
      return this.render({ force:true });
    } catch (err) { return ui.notifications.error("Could not read JSON."); }
  }

  async _loadPdf(event) {
    const file = event.target.files?.[0]; if (!file) return;
    this._collect();
    try {
      let pdfjs = globalThis.pdfjsLib || globalThis.pdfjs;
      if (!pdfjs?.getDocument) {
        pdfjs = await import("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";
      }
      const pdf = await pdfjs.getDocument({ data:new Uint8Array(await file.arrayBuffer()) }).promise, pages = [];
      for (let n = 1; n <= pdf.numPages; n++) { const page = await pdf.getPage(n), content = await page.getTextContent(); pages.push(content.items.map(x => x.str).join(" ")); }
      this.data.description = pages.join("\n\n");
      this.data.format = "text";
      if (!this.data.name) this.data.name = file.name.replace(/\.pdf$/i,"");
      return this.render({ force:true });
    } catch (err) {
      console.error(MODULE_ID, "PDF extraction failed", err);
      return ui.notifications.error("PDF text extraction failed. Check the browser console for the exact PDF.js error.");
    }
  }

  /**
   * Markdown import. Optional front matter:
   * ---
   * name: Coralborn
   * type: species        (species/race, background, class, subclass, feat, spell, equipment…)
   * rules: 2024          (2014 or 2024)
   * identifier: coralborn
   * class: wizard        (for subclasses)
   * features: [Tidal Step, Reef Ward]
   * ---
   * Without front matter, the first "# Heading" becomes the name. For classes and
   * subclasses with no features list, each "### Heading" becomes a feature name.
   */
  async _loadMarkdown(event) {
    const file = event.target.files?.[0]; if (!file) return;
    this._collect();
    try {
      const { meta, body } = parseFrontMatter(await file.text());
      let text = body.replace(/^\s+/,"");
      const title = text.match(/^#\s+(.+?)\s*#*\s*$/m);
      const type = TYPE_ALIASES[String(meta.type || "").toLowerCase()] || (CONTENT_TYPES.some(t=>t.value===meta.type) ? meta.type : this.data.type);
      this.data.type = type;
      this.data.name = meta.name || title?.[1] || file.name.replace(/\.(md|markdown|txt)$/i,"");
      if (!meta.name && title && text.startsWith(title[0])) text = text.slice(title[0].length).replace(/^\s+/,"");
      if (["2014","2024"].includes(String(meta.rules))) this.data.rules = String(meta.rules);
      if (meta.identifier) this.data.identifier = meta.identifier;
      const cls = meta.class || meta.classidentifier;
      if (cls) this.data.classIdentifier = foundry.utils.slugify(String(cls), { strict:true });
      let features = Array.isArray(meta.features) ? meta.features : (meta.features ? String(meta.features).split(",") : []);
      if (!features.length && ["class","subclass"].includes(type)) features = [...text.matchAll(/^###\s+(.+?)\s*#*\s*$/gm)].map(m => m[1].replace(/\*|_/g,"").trim());
      if (features.length) this.data.featureNames = features.map(x=>String(x).trim()).filter(Boolean).join("\n");
      this.data.description = text;
      this.data.format = "markdown";
      return this.render({ force:true });
    } catch (err) {
      console.error(MODULE_ID, "Markdown import failed", err);
      return ui.notifications.error("Could not read the Markdown file.");
    }
  }

  static async save() {
    this._collect();
    if (!this.data.name.trim()) return ui.notifications.warn("Enter a content name.");
    const system = { description:{ value:contentToHtml(this.data.description, this.data.format), chat:"" } };
    if (["class","subclass"].includes(this.data.type)) system.identifier = this.data.identifier || foundry.utils.slugify(this.data.name,{strict:true});
    if (this.data.type === "feat") system.type = { value:"feat", subtype:"" };
    if (this.data.type === "subclass") {
      if (!this.data.classIdentifier) return ui.notifications.warn("Choose the class this subclass belongs to.");
      system.classIdentifier = this.data.classIdentifier;
    }
    try {
      const createdFeatures = [];
      if (["class","subclass"].includes(this.data.type)) {
        const parentId = this.data.type === "class" ? system.identifier : this.data.classIdentifier;
        for (const name of this.data.featureNames.split(/\r?\n|,/).map(x=>x.trim()).filter(Boolean)) {
          const feature = await Item.create({ name, type:"feat", system:{ description:{ value:"", chat:"" }, type:{ value:"class", subtype:"" } }, flags:{ [MODULE_ID]:{ homebrew:true, rules:this.data.rules, featureOf:parentId, featureKind:this.data.type } } });
          createdFeatures.push(feature);
        }
        if (createdFeatures.length) system.advancement = [{ _id:foundry.utils.randomID(), type:"ItemGrant", configuration:{ items:createdFeatures.map((x,i)=>({ uuid:x.uuid, optional:false, sort:i*10000 })), optional:false, sorting:"m", spell:null }, value:{ ability:null, added:{} }, level:1, title:this.data.type === "class" ? "Class Features" : "Subclass Features", icon:"" }];
      }
      const item = await Item.create({ name:this.data.name.trim(), type:this.data.type, system, flags:{ [MODULE_ID]:{ homebrew:true, rules:this.data.rules } } });
      ui.notifications.info("Added "+item.name+(createdFeatures.length ? " with "+createdFeatures.length+" linked features" : "")+" to the character builder.");
      if (this.parentBuilder) {
        this.parentBuilder._packCache = null;
        const step = this.selectStep;
        if (step && Array.isArray(this.parentBuilder.draft[step])) this.parentBuilder.draft[step].push(item.uuid);
        await this.parentBuilder.render({ force:true });
      }
      await this.close();
      return item.sheet?.render({ force:true });
    } catch (err) { console.error(MODULE_ID, err); return ui.notifications.error("D&D5e rejected this custom content."); }
  }
}
function addBuildButton(app, html) {
  if(game.system.id !== "dnd5e") return;
  const root = html instanceof HTMLElement ? html : html?.[0];
  if(!root || root.querySelector("[data-dnd5e-pc-builder]")) return;
  const header = root.querySelector(".directory-header .header-actions") || root.querySelector(".directory-header");
  if(!header) return;
  const button=document.createElement("button");
  button.type="button"; button.dataset.dnd5ePcBuilder="true"; button.className="create-document";
  button.innerHTML='<i class="fas fa-user-plus"></i> Build Character';
  button.addEventListener("click",()=>new CharacterBuilder().render({force:true}));
  header.append(button);
}

Hooks.on("renderActorDirectory", addBuildButton);
Hooks.once("ready", () => {
  const mod=game.modules.get(MODULE_ID);
  if(mod) mod.api={open:()=>new CharacterBuilder().render({force:true}),custom:()=>new CustomContentImporter().render({force:true})};
});
globalThis.DND5ePCCharacterBuilder=CharacterBuilder;
