# D&D 5e / 5.5e Custom Character Builder

Guided player-character creation for Foundry VTT V14 and the official D&D5e system.

## v0.4.0
- **Portrait on the Identity step:** upload an image, browse your files, or paste a path. It is used for the character's portrait and token.
- **Edition dropdown** on every list step (Species, Background, Class, Subclass, Feats, Spells, Equipment): 2014 / Legacy, 2024 / 5.5e, or All editions. It defaults to the rules you pick on step 1.
- **Source buttons** on every list step to show only one compendium, e.g. *Races (SRD)* or *Character Origins*.
- **Add Custom Race, Background, Class or Subclass** directly on those steps. A custom class can set its hit die. GMs can also save the custom entry to the world for reuse.
- **Markdown import** in Custom Content, plus a *Content format* choice (Markdown, plain text or HTML).
- The sidebar highlights the current step; the Custom Content form now keeps your chosen rules, type and class.
- Compendiums are indexed once per builder instead of on every step.

## Earlier
- **Build Character** button in the Actors directory.
- Class-aware flow: selecting a class limits subclasses to that class.
- Reads world Items and installed Item compendiums.
- Custom Content editor that imports JSON, selectable-text PDFs (via PDF.js) and Markdown.
- Creates a native D&D5e Character Actor and embeds the selected content.

Target: Foundry VTT 14.367+ and D&D5e 6.0.x.

## Install
Paste this into **Foundry VTT → Add-on Modules → Install Module → Manifest URL**:

```
https://raw.githubusercontent.com/siller94-art/DND5e-PC-Homebrew-Builder/main/module.json
```

Enable the module in your D&D5e world. Open the **Actors** sidebar and click **Build Character**.

## Custom Content
Inside the character builder click **Custom Content**. Homebrew saved there becomes a world Item and is picked up by the builder on the appropriate step.

### Markdown files
Any `.md` file works. The first `# Heading` becomes the name and the rest becomes the description. Optional front matter fills in the other fields:

```markdown
---
name: Coralborn
type: species          # species/race, background, class, subclass, feat, spell, equipment, weapon, tool, consumable
rules: 2024            # 2014 or 2024
identifier: coralborn  # classes and subclasses
class: wizard          # the parent class, for subclasses
features: [Tidal Step, Reef Ward]
---
# Coralborn
Children of the **reef**.

## Traits
- **Speed.** 30 ft., swim 30 ft.
```

For a class or subclass without a `features` list, every `### Heading` becomes a linked feature.

## SRD content
The builder lists whatever is in your D&D5e compendiums, which already include the SRD 5.1 (2014) and SRD 5.2 (2024) races/species, backgrounds and classes. The SRDs only contain a few backgrounds (2024: Acolyte, Criminal, Sage, Soldier; 2014: Acolyte), so use **Add Custom Background** for anything else.

Version: 0.4.0
