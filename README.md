# D&D 5e / 5.5e Custom Character Builder

Guided player-character creation for Foundry VTT V14 and the official D&D5e system.

## v0.3.0
- Adds **Build Character** to the Actors directory.
- Guided flow: Rules → Identity → Species/Race → Background → Class → Subclass → Abilities → Feats → Spells → Equipment → Details → Review.
- Supports **2014 / Legacy D&D 5e** and **2024 / 5.5e** selection.
- Reads compatible world Items and installed Item compendiums.
- Adds a **Custom Content** editor.
- Imports custom JSON.
- Accepts PDF import when a PDF text parser is exposed by the Foundry client; otherwise text can be pasted into the custom content editor.
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

Version: 0.3.0
