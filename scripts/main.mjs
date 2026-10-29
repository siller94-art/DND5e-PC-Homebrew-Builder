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
const EDITIONS = [{ value:"2014", label:"2014 / Legacy" }, { value:"2024", label:"2024 / 5.5e" }, { value:"all", label:"All editions" }];
const TYPE_MAP = {
  species: ["race","species"],
  background: ["background"],
  class: ["class"],
  subclass: ["subclass"],
  feats: ["feat"],
  spells: ["spell"],
  equipment: ["equipment","weapon","consumable","tool","loot"]
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
    this.draft = {
      rules: "2024", name: "", img: "", species: "",
      custom: {
        species: { name: "", description: "", save: false },
        background: { name: "", description: "", save: false },
        class: { name: "", description: "", save: false, hitDie: "d8" },
        subclass: { name: "", description: "", save: false }
      }, background: "", class: "", subclass: "",
      abilities: { str:10, dex:10, con:10, int:10, wis:10, cha:10 },
      feats: [], spells: [], equipment: [], details: ""
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
    const allRows = (this.catalog[step] || []).filter(r => edition === "all" || !r.rules || r.rules === edition);
    const sources = [...new Set(allRows.map(r => r.source))].sort((a,b) => a.localeCompare(b));
    let activeSource = this.sourceFilter[step] || "";
    if (activeSource && !sources.includes(activeSource)) activeSource = this.sourceFilter[step] = "";
    const rows = activeSource ? allRows.filter(r => r.source === activeSource) : allRows;
    const customStep = CUSTOM_STEPS[step];
    return {
      step, stepNumber: this.stepIndex + 1, totalSteps: STEPS.length,
      stepTitle: STEP_LABELS[step] || step,
      stepList: STEPS.map((key, i) => ({ label: STEP_LABELS[key] || key, active: i === this.stepIndex, done: i < this.stepIndex })),
      draft: this.draft, rows,
      sourceButtons: sources.length > 1 ? [{ label:"All", value:"", count:allRows.length, active:!activeSource },
        ...sources.map(src => ({ label:src, value:src, count:allRows.filter(r => r.source === src).length, active:src === activeSource }))] : [],
      isList: ["species","background","class","subclass","feats","spells","equipment"].includes(step),
      editions: EDITIONS.map(e => ({ ...e, selected: e.value === edition })),
      hitDice: ["d6","d8","d10","d12"].map(d => ({ value:d, selected: d === this.draft.custom.class.hitDie })),
      customStep, custom: customStep ? this.draft.custom[step] : null,
      customSelected: !!customStep && this.draft[step] === CUSTOM_ID,
      showCustom: !!customStep && (this.showCustom[step] || this.draft[step] === CUSTOM_ID),
      isGM: game.user?.isGM ?? false,
      portrait: this.draft.img || "icons/svg/mystery-man.svg",
      isRules: step === "rules", isIdentity: step === "identity",
      isSingle: ["species","background","class","subclass"].includes(step),
      isAbilities: step === "abilities",
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
    const rules = item.system?.source?.rules;
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
        const index = await pack.getIndex({ fields:["type","system.identifier","system.classIdentifier","system.source.rules","flags."+MODULE_ID+".rules"] });
        for (const item of index) if (allTypes.includes(item.type)) {
          rows.push({ uuid:"Compendium."+pack.collection+"."+item._id, name:item.name, type:item.type, source:pack.metadata.label || pack.collection,
            identifier:item.system?.identifier || "", classIdentifier:item.system?.classIdentifier || "", rules:CharacterBuilder.detectEdition(item, pack) });
        }
      } catch (err) { console.debug(MODULE_ID, "Skipped pack", pack.collection); }
    }
    return this._packCache = rows;
  }

  _classIdentifier() {
    if (this.draft.class === CUSTOM_ID) return foundry.utils.slugify(this.draft.custom.class.name || "custom-class", { strict:true });
    return this._selectedClassIdentifier || "";
  }

  async _scanContent() {
    const worldRows = [];
    for (const item of game.items || []) {
      worldRows.push({ uuid:item.uuid, name:item.name, type:item.type, source:item.flags?.[MODULE_ID]?.homebrew ? "Homebrew" : "World",
        identifier:item.system?.identifier || "", classIdentifier:item.system?.classIdentifier || "", rules:CharacterBuilder.detectEdition(item) });
    }
    const allRows = [...worldRows, ...await this._packRows()];
    if (this.draft.class && this.draft.class !== CUSTOM_ID) {
      const chosen = await fromUuid(this.draft.class);
      this._selectedClassIdentifier = chosen?.system?.identifier || foundry.utils.slugify(chosen?.name || "", { strict:true });
    }
    for (const [key, types] of Object.entries(TYPE_MAP)) {
      let rows = allRows.filter(r => types.includes(r.type));
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
    for (const ability of Object.keys(this.draft.abilities)) {
      if (get(ability) !== undefined) this.draft.abilities[ability] = Math.max(3, Math.min(30, Number(get(ability)) || 10));
    }
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
    const findName = (uuid, key) => {
      if (!uuid) return "None";
      if (uuid === CUSTOM_ID && CUSTOM_STEPS[key]) return (this.draft.custom[key].name || "Unnamed") + " (custom)";
      for (const rows of Object.values(this.catalog)) {
        const row = rows.find(r => r.uuid === uuid);
        if (row) return row.name;
      }
      return uuid;
    };
    return [
      {label:"Rules",value:this.draft.rules === "2014" ? "D&D 5e 2014 / Legacy" : "D&D 2024 / 5.5e"},
      {label:"Name",value:this.draft.name || "Unnamed"},
      {label:"Species / Race",value:findName(this.draft.species, "species")},
      {label:"Background",value:findName(this.draft.background, "background")},
      {label:"Class",value:findName(this.draft.class, "class")},
      {label:"Subclass",value:findName(this.draft.subclass, "subclass")},
      {label:"Feats",value:String(this.draft.feats.length)},
      {label:"Spells",value:String(this.draft.spells.length)},
      {label:"Equipment",value:String(this.draft.equipment.length)}
    ];
  }

  static async next() {
    this._collect();
    if (STEPS[this.stepIndex] === "identity" && !this.draft.name) return ui.notifications.warn("Enter a character name.");
    const stepKey = STEPS[this.stepIndex];
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
    try {
      const abilities = {};
      for (const [key,value] of Object.entries(this.draft.abilities)) abilities[key] = { value };
      const actor = await Actor.create({
        name: this.draft.name,
        type: "character",
        ...(this.draft.img ? { img: this.draft.img, prototypeToken: { texture: { src: this.draft.img } } } : {}),
        system: { abilities },
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
    this.data = { rules:"2024", type:"feat", name:"", description:"", format:"markdown", identifier:"", classIdentifier:"", featureNames:"" };
    this.parentBuilder = options.parentBuilder || null;
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
    if (this.data.type === "subclass") {
      if (!this.data.classIdentifier) return ui.notifications.warn("Choose the class this subclass belongs to.");
      system.classIdentifier = this.data.classIdentifier;
    }
    try {
      const createdFeatures = [];
      if (["class","subclass"].includes(this.data.type)) {
        const parentId = this.data.type === "class" ? system.identifier : this.data.classIdentifier;
        for (const name of this.data.featureNames.split(/\r?\n|,/).map(x=>x.trim()).filter(Boolean)) {
          const feature = await Item.create({ name, type:"feat", system:{ description:{ value:"", chat:"" } }, flags:{ [MODULE_ID]:{ homebrew:true, rules:this.data.rules, featureOf:parentId, featureKind:this.data.type } } });
          createdFeatures.push(feature);
        }
        if (createdFeatures.length) system.advancement = [{ _id:foundry.utils.randomID(), type:"ItemGrant", configuration:{ items:createdFeatures.map((x,i)=>({ uuid:x.uuid, optional:false, sort:i*10000 })), optional:false, sorting:"m", spell:null }, value:{ ability:null, added:{} }, level:1, title:this.data.type === "class" ? "Class Features" : "Subclass Features", icon:"" }];
      }
      const item = await Item.create({ name:this.data.name.trim(), type:this.data.type, system, flags:{ [MODULE_ID]:{ homebrew:true, rules:this.data.rules } } });
      ui.notifications.info("Added "+item.name+(createdFeatures.length ? " with "+createdFeatures.length+" linked features" : "")+" to the character builder.");
      if (this.parentBuilder) { this.parentBuilder._packCache = null; await this.parentBuilder.render({ force:true }); }
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
