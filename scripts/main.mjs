const MODULE_ID = "dnd5e-pc-homebrew-builder";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const STEPS = ["rules","identity","species","background","class","subclass","abilities","feats","spells","equipment","details","review"];
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
      custom: CharacterBuilder.customContent
    }
  };

  static PARTS = { form: { template: "modules/dnd5e-pc-homebrew-builder/templates/builder.hbs" } };

  constructor(options={}) {
    super(options);
    this.stepIndex = 0;
    this.catalog = {};
    this.draft = {
      rules: "2024", name: "", species: "", background: "", class: "", subclass: "",
      abilities: { str:10, dex:10, con:10, int:10, wis:10, cha:10 },
      feats: [], spells: [], equipment: [], details: ""
    };
  }

  async _prepareContext() {
    await this._scanContent();
    const step = STEPS[this.stepIndex];
    return {
      step, stepNumber: this.stepIndex + 1, totalSteps: STEPS.length,
      draft: this.draft, rows: this.catalog[step] || [],
      isRules: step === "rules", isIdentity: step === "identity",
      isSingle: ["species","background","class","subclass"].includes(step),
      isAbilities: step === "abilities",
      isMulti: ["feats","spells","equipment"].includes(step),
      isDetails: step === "details", isReview: step === "review",
      canBack: this.stepIndex > 0,
      review: this._review()
    };
  }

  async _scanContent() {
    for (const [key, types] of Object.entries(TYPE_MAP)) {
      const rows = [];
      for (const item of game.items || []) {
        if (types.includes(item.type)) rows.push({ uuid:item.uuid, name:item.name, type:item.type, source:"World", identifier:item.system?.identifier || "", classIdentifier:item.system?.classIdentifier || "", rules:item.system?.source?.rules || "" });
      }
      for (const pack of game.packs || []) {
        if (pack.documentName !== "Item") continue;
        try {
          const index = await pack.getIndex({ fields:["type","system.identifier","system.classIdentifier","system.source.rules","system.source.book"] });
          for (const item of index) if (types.includes(item.type)) {
            rows.push({ uuid:"Compendium."+pack.collection+"."+item._id, name:item.name, type:item.type, source:pack.metadata.label || pack.collection, identifier:item.system?.identifier || "", classIdentifier:item.system?.classIdentifier || "", rules:item.system?.source?.rules || "" });
          }
        } catch (err) { console.debug(MODULE_ID, "Skipped pack", pack.collection); }
      }
      let filtered=rows;
      if(key==="subclass" && this.draft.class){
        const chosen=await fromUuid(this.draft.class);
        const cid=chosen?.system?.identifier || chosen?.identifier || "";
        filtered=rows.filter(r=>r.classIdentifier===cid);
      }
      const wanted=this.draft.rules;
      const ruleMatched=filtered.filter(r=>!r.rules || String(r.rules).includes(wanted));
      this.catalog[key]=(ruleMatched.length?ruleMatched:filtered).filter((r,i,a)=>a.findIndex(x=>x.uuid===r.uuid)===i).sort((a,b)=>a.name.localeCompare(b.name));
    }
  }

  _collect() {
    const root = this.element;
    if (!root) return;
    const get = n => root.querySelector('[name="'+n+'"]')?.value;
    if (get("rules")) this.draft.rules = get("rules");
    if (get("name") !== undefined) this.draft.name = get("name").trim();
    if (get("details") !== undefined) this.draft.details = get("details");
    for (const ability of Object.keys(this.draft.abilities)) {
      if (get(ability) !== undefined) this.draft.abilities[ability] = Math.max(3, Math.min(30, Number(get(ability)) || 10));
    }
    const step = STEPS[this.stepIndex];
    if (["species","background","class","subclass"].includes(step) && get(step) !== undefined) this.draft[step] = get(step);
    if (["feats","spells","equipment"].includes(step)) {
      this.draft[step] = [...root.querySelectorAll('input[name="'+step+'"]:checked')].map(x => x.value);
    }
  }

  _review() {
    const findName = uuid => {
      if (!uuid) return "None";
      for (const rows of Object.values(this.catalog)) {
        const row = rows.find(r => r.uuid === uuid);
        if (row) return row.name;
      }
      return uuid;
    };
    return [
      {label:"Rules",value:this.draft.rules === "2014" ? "D&D 5e 2014 / Legacy" : "D&D 2024 / 5.5e"},
      {label:"Name",value:this.draft.name || "Unnamed"},
      {label:"Species / Race",value:findName(this.draft.species)},
      {label:"Background",value:findName(this.draft.background)},
      {label:"Class",value:findName(this.draft.class)},
      {label:"Subclass",value:findName(this.draft.subclass)},
      {label:"Feats",value:String(this.draft.feats.length)},
      {label:"Spells",value:String(this.draft.spells.length)},
      {label:"Equipment",value:String(this.draft.equipment.length)}
    ];
  }

  static async next() {
    this._collect();
    if (STEPS[this.stepIndex] === "identity" && !this.draft.name) return ui.notifications.warn("Enter a character name.");
    const current=STEPS[this.stepIndex];
    if(current==="class" && this.draft.class){
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

  static customContent() { return new CustomContentImporter().render({ force:true }); }

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
        system: { abilities },
        flags: { [MODULE_ID]: { rules:this.draft.rules, details:this.draft.details } }
      });
      await this._embed(actor, [
        this.draft.species, this.draft.background, this.draft.class, this.draft.subclass,
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

class CustomContentImporter extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id:"dnd5e-pc-custom-content", classes:["dnd5e-pc-character-builder"], tag:"form",
    window:{title:"Custom PC Content",resizable:true}, position:{width:720,height:650},
    actions:{save:CustomContentImporter.save}
  };
  static PARTS = { form:{template:"modules/dnd5e-pc-homebrew-builder/templates/importer.hbs"} };
  constructor(options={}) { super(options); this.data={type:"feat",name:"",description:"",identifier:"",classIdentifier:""}; }
  async _prepareContext() { return { data:this.data, types:["race","background","class","subclass","feat","spell","equipment","weapon","tool","consumable"] }; }
  _onRender(context,options) {
    super._onRender(context,options);
    this.element.querySelector('[name="json"]')?.addEventListener("change", e => this._loadJson(e));
    this.element.querySelector('[name="pdf"]')?.addEventListener("change", e => this._loadPdf(e));
  }
  _collect() {
    for (const key of ["type","name","description","identifier","classIdentifier"]) {
      const el=this.element.querySelector('[name="'+key+'"]'); if(el) this.data[key]=el.value;
    }
  }
  async _loadJson(event) {
    const file=event.target.files?.[0]; if(!file)return;
    try {
      const raw=JSON.parse(await file.text());
      const value=Array.isArray(raw)?raw[0]:(raw.items?.[0] || raw);
      this.data.type=value.type || this.data.type;
      this.data.name=value.name || "";
      this.data.description=value.system?.description?.value || value.description || "";
      this.data.identifier=value.system?.identifier || value.identifier || "";
      this.data.classIdentifier=value.system?.classIdentifier || value.classIdentifier || "";
      return this.render({force:true});
    } catch(err) { return ui.notifications.error("Could not read JSON."); }
  }
  async _loadPdf(event) {
    const file=event.target.files?.[0]; if(!file)return;
    this._collect();
    try {
      const pdfjs=globalThis.pdfjsLib || globalThis.pdfjs;
      if(!pdfjs?.getDocument) throw new Error("PDF parser unavailable");
      const pdf=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
      const pages=[];
      for(let n=1;n<=pdf.numPages;n++){const page=await pdf.getPage(n);const content=await page.getTextContent();pages.push(content.items.map(x=>x.str).join(" "));}
      this.data.description=pages.join("\n\n");
      return this.render({force:true});
    } catch(err) {
      console.error(MODULE_ID,"PDF extraction failed",err);
      return ui.notifications.error("PDF text extraction failed. Check the browser console for the exact PDF.js error.");
    }
  }
  static async save() {
    this._collect();
    if(!this.data.name.trim())return ui.notifications.warn("Enter a content name.");
    const system={description:{value:this.data.description,chat:""}};
    if(["class","subclass"].includes(this.data.type)) system.identifier=this.data.identifier || foundry.utils.slugify(this.data.name,{strict:true});
    if(this.data.type==="subclass") system.classIdentifier=this.data.classIdentifier;
    try {
      const item=await Item.create({name:this.data.name.trim(),type:this.data.type,system,flags:{[MODULE_ID]:{homebrew:true}}});
      ui.notifications.info("Created custom content: "+item.name);
      return item.sheet?.render({force:true});
    } catch(err) { console.error(MODULE_ID,err); return ui.notifications.error("D&D5e rejected this custom item."); }
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
