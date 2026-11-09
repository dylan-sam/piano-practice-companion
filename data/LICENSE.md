# Data license

The song catalog of this project, meaning `data/progressions.sqlite`,
`data/common_progressions.json`, `studio/public/catalog/` and
`studio/public/exercises/name-progression.json`, is adapted from
[ChoCo](https://github.com/smashub/choco) and licensed under the
[Creative Commons Attribution 4.0 International license (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/).

You may share and adapt it for any purpose, including commercially, provided
you give appropriate credit, link to the license and indicate if changes were
made.

**Credit.** J. de Berardinis, A. Meroño-Peñuela, A. Poltronieri and
V. Presutti, "ChoCo: a Chord Corpus and a Data Transformation Workflow for
Musical Harmony Knowledge Graphs", *Scientific Data* 10, 641 (2023).
<https://github.com/smashub/choco>

**Changes.** The catalog was rebuilt from ChoCo v1.0.0 and ChoCo's raw
iReal Pro data (commit `5fe168f`): converted to one SQLite database and one
chord notation, curated, de-duplicated, and corrected as described in
[docs/DATA.md](../docs/DATA.md).

**Lead sheets.** `studio/public/leadsheets/catalog.json` holds public domain
lead sheets from [OpenEWLD](https://github.com/00sapo/OpenEWLD) (F. Simonetta;
the scores are public domain, its Discogs genres CC0) and the Nottingham Music
Database (E. Foxley, revised by J. Allwright) as distributed by ChoCo under
CC BY 4.0; the file is shared under CC BY 4.0 as well. Its sources,
`openewld-ec03cbd.zip` and `choco-nottingham-raw-5fe168f.zip`, keep their own
terms (OpenEWLD's license is in the zip).

**Licks and exercises.** `studio/public/licks/licks.json` holds exercises and
licks written or generated for this project (CC BY 4.0; the triad, interval
and rhythm drills follow K. B. Kelly and E. Rasmussen, *A Guide to Exploring
Jazz Improvisation - Book 1*, CC BY 4.0), licks from the OpenEWLD lead sheets
(public domain) and from the Nottingham Music Database (CC BY 4.0, as above);
the file is shared under CC BY 4.0. Licks mined from the Weimar Jazz Database
(ODbL 1.0) are not shipped: they are built only in the `weimar/` folder of a
local copy, which git ignores. See [docs/LICKS.md](../docs/LICKS.md#rights-and-credits).

**Not included.** The ChoCo collections released under CC BY-NC-SA 4.0
(Chordify Annotator Subjectivity Dataset, Mozart Piano Sonatas, Jazz
Audio-Aligned Harmony) are left out, see [ChoCo's license](CHOCO_LICENSE.md).
The iReal Pro forum charts were contributed by users of the iReal Pro forums
and are distributed by ChoCo. The catalog holds chord symbols, titles,
composers, keys and meters only; the rights in the songs themselves belong to
their authors.
