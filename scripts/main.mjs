const MODULE_ID = "dnd5e-pc-homebrew-builder";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

class PCHomebrewBuilder extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "dnd5e-pc-homebrew-builder",
    classes: ["dnd5e-pc-homebrew-builder"],
    tag: "form",
    window: { title: "D&D 5e PC Homebrew Builder", resizable: true },
    position: { width: 920, height: 760 },
    actions: {
      clear: PCHomebrewBuilder.clear,
      save: PCHomebrewBuilder.save
    }
  };

  static PARTS = {
    form: { template: `modules/${MODULE_ID}/templates/builder.hbs` }
  };

  constructor(options = {}) {
    super(options);
    this.draft = this._emptyDraft();
  }

  _emptyDraft() {
    return {
      type: "class",
      name: "",
      identifier: "",
      description: "",
      sourceText: "",
      sourceName: "",
      sourceKind: ""
    };
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    return foundry.utils.mergeObject(context, {
      draft: this.draft,
      itemTypes: ["class", "subclass", "feat", "spell", "background", "equipment"]
    }, { inplace: false });
  }

  _onRender(context, options) {
    super._onRender(context, options);
    this.element.querySelector("[name='pdf']")?.addEventListener("change", event => this._loadPdf(event));
    this.element.querySelector("[name='json']")?.addEventListener("change", event => this._loadJson(event));
  }

  _collect() {
    const form = this.element;
    this.draft.type = form.querySelector("[name='type']")?.value ?? "class";
    this.draft.name = form.querySelector("[name='name']")?.value?.trim() ?? "";
    this.draft.identifier = form.querySelector("[name='identifier']")?.value?.trim() ?? "";
    this.draft.description = form.querySelector("[name='description']")?.value ?? "";
  }

  static async clear(event, target) {
    this.draft = this._emptyDraft();
    await this.render({ force: true });
  }

  static async save(event, target) {
    event.preventDefault();
    this._collect();
    if (!this.draft.name) return ui.notifications.warn("Enter a name first.");

    const system = {
      description: {
        value: this.draft.description,
        chat: ""
      }
    };

    if (["class", "subclass"].includes(this.draft.type)) {
      system.identifier = this.draft.identifier || foundry.utils.slugify(this.draft.name, { strict: true });
    }

    if (this.draft.type === "subclass") {
      system.classIdentifier = "";
    }

    try {
      const item = await Item.create({
        name: this.draft.name,
        type: this.draft.type,
        system
      });

      ui.notifications.info(`Created ${item.name}.`);
      item.sheet?.render({ force: true });
    } catch (err) {
      console.error(`${MODULE_ID} | Item creation failed`, err);
      ui.notifications.error("Foundry rejected this D&D 5e item. See the console for details.");
    }
  }

  async _loadPdf(event) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return ui.notifications.error("Choose a PDF file.");
    }

    this._collect();
    this.draft.sourceName = file.name;
    this.draft.sourceKind = "PDF";

    try {
      const pdfjs = globalThis.pdfjsLib;
      if (!pdfjs?.getDocument) {
        throw new Error("No PDF text parser is exposed by this Foundry client.");
      }

      const bytes = new Uint8Array(await file.arrayBuffer());
      const pdf = await pdfjs.getDocument({ data: bytes }).promise;
      const pages = [];

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        pages.push(content.items.map(item => item.str).join(" "));
      }

      this.draft.sourceText = pages.join("\n\n");
      this.draft.description = [this.draft.description, this.draft.sourceText].filter(Boolean).join("\n\n");
      ui.notifications.info(`Loaded text from ${pdf.numPages} PDF page(s).`);
      await this.render({ force: true });
    } catch (err) {
      console.error(`${MODULE_ID} | PDF load failed`, err);
      ui.notifications.error("PDF selected, but this Foundry client does not expose a PDF text parser.");
      await this.render({ force: true });
    }
  }

  async _loadJson(event) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;

    if (file.type !== "application/json" && !file.name.toLowerCase().endsWith(".json")) {
      return ui.notifications.error("Choose a JSON file.");
    }

    this._collect();
    this.draft.sourceName = file.name;
    this.draft.sourceKind = "JSON";

    try {
      const raw = await file.text();
      const data = JSON.parse(raw);

      const candidate = Array.isArray(data)
        ? data[0]
        : (Array.isArray(data.items) ? data.items[0] : data);

      if (!candidate || typeof candidate !== "object") {
        throw new Error("No usable object found in JSON.");
      }

      const allowedTypes = new Set(["class", "subclass", "feat", "spell", "background", "equipment"]);
      const type = allowedTypes.has(candidate.type) ? candidate.type : this.draft.type;

      this.draft.type = type;
      this.draft.name = candidate.name ?? this.draft.name;
      this.draft.identifier =
        candidate.system?.identifier ??
        candidate.identifier ??
        this.draft.identifier;

      const description =
        candidate.system?.description?.value ??
        candidate.description ??
        "";

      this.draft.sourceText = JSON.stringify(data, null, 2);
      this.draft.description = description || this.draft.description;

      ui.notifications.info(`Loaded JSON from ${file.name}.`);
      await this.render({ force: true });
    } catch (err) {
      console.error(`${MODULE_ID} | JSON load failed`, err);
      ui.notifications.error("The JSON file could not be read.");
    }
  }
}

Hooks.once("init", () => console.log(`${MODULE_ID} | Initializing`));

Hooks.on("renderSettings", (app, element) => {
  if (game.system.id !== "dnd5e") return;
  if (element.querySelector("[data-pc-homebrew-builder]")) return;

  const settingsGame = element.querySelector("#settings-game");
  if (!settingsGame) return;

  const button = document.createElement("button");
  button.type = "button";
  button.dataset.pcHomebrewBuilder = "true";
  button.innerHTML = `<i class="fas fa-hammer"></i> ${game.i18n.localize("PCBuilder.Open")}`;
  button.addEventListener("click", () => new PCHomebrewBuilder().render({ force: true }));
  settingsGame.append(button);
});

globalThis.PCHomebrewBuilder = PCHomebrewBuilder;
