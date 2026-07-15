# Open Ruleset Licensing — Verified Findings (2026-07-04)

**Status:** retained research evidence only. D0 chooses one bespoke, versioned rules chassis and
rejects a selectable-SRD build or wholesale adoption of an external system. D14 may still decide
whether CC0 material can inform balance-reference data. **No SRD text has been adopted.**

Method: parallel research agents fetched the actual license texts/deeds (not
memory), and an independent adversarial pass re-fetched primary sources to
refute each claim. All four verification verdicts: accurate, with the
corrections folded in below. Re-verify anything marked ⚠ before commercial
adoption; licenses named "as of" July 2026.

## Owner constraint (decision 2026-07-04, `.agents/decisions.md`)

License obligations must stay scoped to the ruleset content: any license
requiring the product to be described as **"based on"** the licensed system
is unacceptable — Aetheria is a complete engine and a ruleset option is a
minor addition to it. This excludes **Fate** (Evil Hat's specified CC-BY-3.0
attribution block opens "This work is based on Fate Core System…") and
**ORC / Pathfinder 2e** (the required Attribution Notice pattern is "This
product is based on the following Licensed Material: …"). Factual
containment statements (the D&D SRD's "This work includes material taken
from…" line) are not auto-excluded but need explicit owner sign-off at
adoption time.

## Recommendation ranking for this engine

1. **CC0 (zero obligation — cleanly satisfies the owner constraint):**
   Worlds Without Number SRD (fantasy/post-apoc) and Cities Without Number
   SRD (cyberpunk/noir), Sine Nomine / Kevin Crawford. Verbatim copying,
   modification, commercial use — no attribution, no ShareAlike, nothing
   carried into generated output. One shared chassis across two genres.
   Constraint: may not present products as official Sine Nomine offerings;
   the SRDs exclude the books' setting/GM-tool material (tag *structure*
   reusable, tag *text* not).
2. **CC-BY with factual, scoped wording (owner sign-off required per
   option):** D&D SRD 5.1 / 5.2.1 (CC-BY-4.0; mandated sentence is
   "includes material taken from", placeable on a ruleset credits surface)
   for the classic heroic-fantasy slot; Knave 1e (CC-BY-4.0, credit "in any
   reasonable manner", no mandated sentence) as a light classless fantasy
   toolkit.
3. **Excluded by the owner constraint:** Fate Core/Condensed (specified
   "based on Fate Core System" attribution) and Pathfinder 2e Remaster /
   ORC ("This product is based on…" notice) — regardless of their otherwise
   workable terms. The generated house system covers the genre-neutral slot
   Fate would have filled.
4. **CC-BY-SA (viral — an owner decision, and now unlikely):** Basic
   Fantasy RPG 4e, Cairn. ShareAlike would force any derivative ruleset
   text the engine ships to carry CC-BY-SA itself.
5. **Avoid / not usable:**
   - **OGL 1.0a-only content** (Cepheus Engine SRD, 2008 Traveller SRD, OSE
     SRD): usable in principle, but full-OGL-text boilerplate plus residual
     trust risk ("perpetual" without "irrevocable"; WotC's abandoned 2023
     deauthorization was never litigated). Prefer CC/ORC paths. For
     Traveller-style 2d6 sci-fi, evaluate **FTL: Nomad** (Stellagama, 2025,
     CC-BY-4.0) as the clean non-OGL alternative. ⚠ Mongoose's own open-SRD
     plans appear dropped (April 2026 forum signals, unverified); treat
     Mongoose Traveller 2e as closed.
   - **Year Zero Engine** (Free League "Free Tabletop License" v1.1): grant
     covers print/PDF/VTT modules only and expressly excludes video games —
     an AI GM engine plausibly is one. Do not adopt without written
     permission. (v1.1 also mandates generative-AI disclosure at point of
     sale.)
   - **Knave 2e**: text not openly licensed (1e only). A free "Creator Kit"
     permits mechanics reuse with a non-affiliation disclaimer if ever
     wanted.
   - **Searchers of the Unknown**: commonly mislabeled public domain;
     actually an informal fair-use claim. Not an open ruleset.

## Attribution texts (verbatim, required if adopted)

**D&D SRD 5.1** (CC-BY-4.0):
> This work includes material taken from the System Reference Document 5.1
> ("SRD 5.1") by Wizards of the Coast LLC and available at
> https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1
> is licensed under the Creative Commons Attribution 4.0 International
> License available at https://creativecommons.org/licenses/by/4.0/legalcode.

**D&D SRD 5.2.1** (CC-BY-4.0):
> This work includes material from the System Reference Document 5.2.1
> ("SRD 5.2.1") by Wizards of the Coast LLC, available at
> https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative
> Commons Attribution 4.0 International License, available at
> https://creativecommons.org/licenses/by/4.0/legalcode.

(Reproduce with the original URLs even though the 5.1 URL now redirects. Do
not add any other attribution to Wizards/Hasbro. The only sanctioned
compatibility phrasings are "compatible with fifth edition" / "5E
compatible". 5.1 and 5.2.1 encode different rules editions — offer as
distinct options, never silently mixed.)

**Fate Core/Condensed** — EXCLUDED (decision 2026-07-04): the specified
attribution block opens "This work is based on Fate Core System…", which is
whole-work framing the owner rejects. Recorded here only as the evidence
behind the exclusion.

**Knave 1e** (CC-BY-4.0): credit Ben Milton / Questing Beast, link the
license, indicate changes.

**WWN / CWN SRDs** (CC0): no attribution legally required (crediting Kevin
Crawford / Sine Nomine is courteous). Capture the CC0 waiver text from the
SRD files at adoption time.

## Trademark & content exclusions (apply regardless of license)

- CC licenses never grant trademarks. "Dungeons & Dragons", "D&D", "Dungeon
  Master" (USPTO Reg. 1815460), "Pathfinder", "Traveller", "Fate" logos,
  Free League brands — all off-limits. (The engine's 2026-06-11 GM-not-DM
  terminology decision already avoids the biggest one.)
- SRD exclusions are content exclusions, not just naming: iconic WotC
  monsters (beholder, mind flayer, displacer beast, githyanki, yuan-ti,
  slaad…), named characters (Strahd, Mordenkainen, Tasha…), and all campaign
  settings are NOT in the SRDs. ⚠ Engine-specific risk: these are abundant
  in model training data, so if a D&D SRD option ships, the ruleset/setup
  prompts (or a validation blocklist) must keep generated campaigns from
  importing excluded WotC lore. Same class of risk for Paizo's Golarion
  lore and Free League settings.
- ORC specifics if PF2 is ever adopted: four required notices (ORC Notice
  citing Library of Congress TX 9-307-067, upstream attribution chain per
  book ingested, Reserved Material notice, EDLM statement); new game
  mechanics built on ORC content are automatically licensed back; no DRM on
  ORC text; strip every proper noun from mechanical text. License-mixing:
  CC-BY may flow *into* an ORC work, ORC text may never be relicensed out,
  OGL↔ORC conversion prohibited — keep per-ruleset license lineage tagged
  and separate in the engine's data files.

## Genre coverage map (for the genre-infinite engine)

| Slot | Best-fit verified option | License |
|---|---|---|
| Heroic fantasy (classic) | D&D SRD 5.1 or 5.2.1 (owner sign-off on the "includes material" line) | CC-BY-4.0 |
| Fantasy sandbox / post-apoc | Worlds Without Number SRD | CC0 |
| Cyberpunk / noir | Cities Without Number SRD | CC0 |
| Genre-neutral narrative | Generated house system (Fate excluded 2026-07-04) | — |
| OSR rules-light fantasy | Knave 1e (Cairn only if BY-SA ever accepted) | CC-BY-4.0 / CC-BY-SA-4.0 |
| 2d6 sci-fi (Traveller-feel) | FTL: Nomad ⚠ (evaluate) — else Cepheus (OGL) | CC-BY-4.0 / OGL 1.0a |
| High-crunch tactical fantasy | (Pathfinder 2e / ORC excluded 2026-07-04 — "based on" notice) | — |

## Primary sources consulted

WotC: SRD_CC_v5.1.pdf, SRD_CC_v5.2.1.pdf (attribution texts extracted from
the PDFs), dndbeyond.com/srd, CC-BY-4.0 legal code. Paizo: ORC License FINAL
PDF (azoralaw.com), ORC AxE FINAL PDF, paizo.com/orclicense + /licenses +
/communityuse, 2e.aonprd.com/Licenses.aspx, pf2orc.d20pfsrd.com legal
notice. Evil Hat: fate-srd.com official licensing pages (faterpg.com TLS
broken at check time). Cepheus/Traveller: orffenspace.com Cepheus SRD legal,
traveller-srd.com OGL, mongoosepublishing.com/pages/traveller-licensing.
Free League: Year-Zero-Engine-License-Agreement v1.0 (2023) and v1.1
(2026-03-31) PDFs. OSR: jmhimara.github.io/bfrpg mirror, OSE SRD OGL page,
necroticgnome.com third-party license, cairnrpg.com, questingbeast.itch.io,
CWN SRD preview PDF (CC0 waiver verbatim), CC deeds/legal code.
