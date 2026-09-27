const MODULE_ID="dnd5e-pc-homebrew-builder";
const {ApplicationV2,HandlebarsApplicationMixin}=foundry.applications.api;
const STEPS=["rules","identity","species","background","class","subclass","abilities","feats","spells","equipment","details","review"];
const LABELS={rules:"Rules",identity:"Identity",species:"Species / Race",background:"Background",class:"Class",subclass:"Subclass",abilities:"Abilities",feats:"Feats",spells:"Spells",equipment:"Equipment",details:"Details",review:"Review"};
const ITEM_TYPES={species:["race","species"],background:["background"],class:["class"],subclass:["subclass"],feats:["feat"],spells:["spell"],equipment:["equipment","weapon","consumable","tool","loot","container"]};

class CustomCharacterBuilder extends HandlebarsApplicationMixin(ApplicationV2){
 static DEFAULT_OPTIONS={id:"dnd5e-custom-character-builder",classes:["dnd5e-custom-character-builder"],tag:"form",window:{title:"D&D 5e / 5.5e Character Builder",resizable:true},position:{width:1120,height:820},actions:{next:CustomCharacterBuilder.next,back:CustomCharacterBuilder.back,jump:CustomCharacterBuilder.jump,create:CustomCharacterBuilder.createActor,clear:CustomCharacterBuilder.clear,openHomebrew:CustomCharacterBuilder.openHomebrew}};
 static PARTS={form:{template:`modules/${MODULE_ID}/templates/builder.hbs`}};
 constructor(options={}){super(options);this.step=0;this.draft=this.emptyDraft();this.catalog={};}
 emptyDraft(){return{rules:"2024",name:"",img:"icons/svg/mystery-man.svg",species:"",background:"",class:"",subclass:"",abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},feats:[],spells:[],equipment:[],details:""};}
 async _prepareContext(options){
  await this.loadCatalog();
  const step=STEPS[this.step];
  return{step,stepLabel:LABELS[step],steps:STEPS.map((s,i)=>({id:s,label:LABELS[s],index:i,active:i===this.step,done:i<this.step})),draft:this.draft,catalog:this.catalog[step]??[],canBack:this.step>0,canNext:this.step<STEPS.length-1,isReview:step==="review",isAbilities:step==="abilities",isIdentity:step==="identity",isRules:step==="rules",isDetails:step==="details",isChoice:["species","background","class","subclass"].includes(step),isMulti:["feats","spells","equipment"].includes(step),review:this.reviewRows()};
 }
 _onRender(c,o){super._onRender(c,o);this.element.querySelectorAll("input,select,textarea").forEach(el=>el.addEventListener("change",()=>this.collect()));}
 collect(){
  const f=this.element;
  if(!f)return;
  const val=n=>f.querySelector(`[name="${n}"]`)?.value;
  if(val("rules"))this.draft.rules=val("rules"); if(val("name")!==undefined)this.draft.name=val("name").trim(); if(val("details")!==undefined)this.draft.details=val("details");
  for(const a of ["str","dex","con","int","wis","cha"]){const v=val(a);if(v!==undefined)this.draft.abilities[a]=Math.max(3,Math.min(30,Number(v)||10));}
  const step=STEPS[this.step];
  if(["species","background","class","subclass"].includes(step)){const v=val(step);if(v!==undefined)this.draft[step]=v;}
  if(["feats","spells","equipment"].includes(step))this.draft[step]=[...f.querySelectorAll(`input[name="${step}"]:checked`)].map(x=>x.value);
 }
 async loadCatalog(){
  for(const step of Object.keys(ITEM_TYPES)){
   const types=ITEM_TYPES[step]; const rows=[];
   for(const item of game.items??[])if(types.includes(item.type))rows.push({uuid:item.uuid,name:item.name,type:item.type,source:"World"});
   for(const pack of game.packs??[]){
    if(pack.documentName!=="Item")continue;
    try{const index=await pack.getIndex({fields:["type","system.identifier","system.classIdentifier"]});for(const e of index)if(types.includes(e.type))rows.push({uuid:`Compendium.${pack.collection}.${e._id}`,name:e.name,type:e.type,source:pack.metadata.label??pack.collection});}catch(err){console.debug(MODULE_ID,"pack skipped",pack.collection,err);}
   }
   this.catalog[step]=rows.sort((a,b)=>a.name.localeCompare(b.name));
  }
 }
 reviewRows(){return[
  ["Rules",this.draft.rules==="2014"?"D&D 5e (2014 / Legacy)":"D&D 5e (2024 / 5.5e)"],["Name",this.draft.name||"—"],
  ["Species / Race",this.nameFor(this.draft.species)],["Background",this.nameFor(this.draft.background)],["Class",this.nameFor(this.draft.class)],["Subclass",this.nameFor(this.draft.subclass)],
  ["Abilities",Object.entries(this.draft.abilities).map(([k,v])=>`${k.toUpperCase()} ${v}`).join(" · ")],["Feats",this.draft.feats.length],["Spells",this.draft.spells.length],["Equipment",this.draft.equipment.length]
 ];}
 nameFor(uuid){if(!uuid)return"—";for(const rows of Object.values(this.catalog))for(const r of rows)if(r.uuid===uuid)return r.name;return uuid;}
 static async next(){this.collect();if(STEPS[this.step]==="identity"&&!this.draft.name)return ui.notifications.warn("Enter a character name.");this.step=Math.min(this.step+1,STEPS.length-1);await this.render({force:true});}
 static async back(){this.collect();this.step=Math.max(0,this.step-1);await this.render({force:true});}
 static async jump(event,target){this.collect();this.step=Math.max(0,Math.min(STEPS.length-1,Number(target.dataset.index)||0));await this.render({force:true});}
 static async clear(){this.draft=this.emptyDraft();this.step=0;await this.render({force:true});}
 static async openHomebrew(){new HomebrewImporter().render({force:true});}
 async embed(actor,uuids){for(const uuid of uuids.filter(Boolean)){try{const doc=await fromUuid(uuid);if(doc)await actor.createEmbeddedDocuments("Item",[doc.toObject()]);}catch(err){console.error(MODULE_ID,"embed failed",uuid,err);}}}
 static async createActor(){
  this.collect();if(!this.draft.name)return ui.notifications.warn("Enter a character name.");
  try{
   const actor=await Actor.create({name:this.draft.name,type:"character",img:this.draft.img,system:{abilities:Object.fromEntries(Object.entries(this.draft.abilities).map(([k,v])=>[k,{value:v}]))},flags:{[MODULE_ID]:{rules:this.draft.rules,details:this.draft.details}}});
   await this.embed(actor,[this.draft.species,this.draft.background,this.draft.class,this.draft.subclass,...this.draft.feats,...this.draft.spells,...this.draft.equipment]);
   ui.notifications.info(`Created ${actor.name}. D&D5e will handle native advancements for compatible class/background/species items.`);
   actor.sheet?.render({force:true});this.close();
  }catch(err){console.error(MODULE_ID,err);ui.notifications.error("Character creation failed. Check the console.");}
 }
}

class HomebrewImporter extends HandlebarsApplicationMixin(ApplicationV2){
 static DEFAULT_OPTIONS={id:"dnd5e-homebrew-importer",classes:["dnd5e-custom-character-builder"],tag:"form",window:{title:"Custom Content Import",resizable:true},position:{width:760,height:650},actions:{save:HomebrewImporter.save}};
 static PARTS={form:{template:`modules/${MODULE_ID}/templates/importer.hbs`}};
 constructor(o={}){super(o);this.draft={type:"feat",name:"",description:"",identifier:"",classIdentifier:""};}
 async _prepareContext(){return{draft:this.draft,types:["race","background","class","subclass","feat","spell","equipment","weapon","tool","consumable"]};}
 _onRender(c,o){super._onRender(c,o);this.element.querySelector("[name=json]")?.addEventListener("change",e=>this.json(e));this.element.querySelector("[name=pdf]")?.addEventListener("change",e=>this.pdf(e));}
 collect(){const f=this.element;for(const k of ["type","name","description","identifier","classIdentifier"]){const e=f.querySelector(`[name="${k}"]`);if(e)this.draft[k]=e.value;}}
 async json(e){const file=e.currentTarget.files?.[0];if(!file)return;try{const d=JSON.parse(await file.text());const x=Array.isArray(d)?d[0]:(d.items?.[0]??d);this.draft.type=x.type??this.draft.type;this.draft.name=x.name??"";this.draft.description=x.system?.description?.value??x.description??"";this.draft.identifier=x.system?.identifier??x.identifier??"";this.draft.classIdentifier=x.system?.classIdentifier??x.classIdentifier??"";await this.render({force:true});}catch(err){ui.notifications.error("Could not read JSON.");}}
 async pdf(e){const file=e.currentTarget.files?.[0];if(!file)return;this.collect();try{const pdfjs=globalThis.pdfjsLib;if(!pdfjs?.getDocument)throw new Error();const pdf=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;const pages=[];for(let i=1;i<=pdf.numPages;i++){const p=await pdf.getPage(i),c=await p.getTextContent();pages.push(c.items.map(x=>x.str).join(" "));}this.draft.description=pages.join("\n\n");await this.render({force:true});}catch(err){ui.notifications.warn("PDF selected, but Foundry did not expose a PDF text parser. Paste the text into Content.");}}
 static async save(){this.collect();if(!this.draft.name)return ui.notifications.warn("Enter a name.");const system={description:{value:this.draft.description,chat:""}};if(["class","subclass"].includes(this.draft.type))system.identifier=this.draft.identifier||foundry.utils.slugify(this.draft.name,{strict:true});if(this.draft.type==="subclass")system.classIdentifier=this.draft.classIdentifier;try{const item=await Item.create({name:this.draft.name,type:this.draft.type,system,flags:{[MODULE_ID]:{homebrew:true}}});ui.notifications.info(`Created custom ${item.type}: ${item.name}`);item.sheet?.render({force:true});}catch(err){console.error(MODULE_ID,err);ui.notifications.error("D&D5e rejected the custom item data.");}}
}

function addActorButton(app,element){
 if(game.system.id!=="dnd5e")return;
 const root=element instanceof HTMLElement?element:element?.[0];if(!root||root.querySelector("[data-dnd5e-custom-builder]"))return;
 const header=root.querySelector(".directory-header .header-actions,.directory-header")??root.querySelector("header");if(!header)return;
 const b=document.createElement("button");b.type="button";b.dataset.dnd5eCustomBuilder="true";b.className="create-document";b.innerHTML='<i class="fas fa-user-plus"></i> Build Character';b.addEventListener("click",()=>new CustomCharacterBuilder().render({force:true}));header.append(b);
}
Hooks.once("init",()=>console.log(`${MODULE_ID} | v0.3.0 initializing`));
Hooks.on("renderActorDirectory",addActorButton);
Hooks.on("renderActorDirectoryPF2e",addActorButton);
Hooks.once("ready",()=>{game.modules.get(MODULE_ID).api={open:()=>new CustomCharacterBuilder().render({force:true}),homebrew:()=>new HomebrewImporter().render({force:true})};});
globalThis.DND5eCustomCharacterBuilder=CustomCharacterBuilder;
