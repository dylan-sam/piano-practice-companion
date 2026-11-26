// The catalog progressions of Name the progression, by their numerals: the levels use them, and the
// home screen's statistics name a progression with them. Small on purpose: the home screen loads it.

// Catalog ids (data/common_progressions.json), named here by their numerals
export const P = {
  ii_V_I: 'progression-02', II_V_I: 'progression-19', IV_V_I: 'progression-16', I_IV_V: 'progression-01',
  vi_ii_V_I: 'progression-05', IV_V_I_vi: 'progression-08', iv_V_i: 'progression-20',
  I_V_vi_IV: 'progression-03', vi_IV_I_V: 'progression-04', I_vi_IV_V: 'progression-07',
  ii_bII7_I: 'progression-06', ii_bVII7_I: 'progression-12',
  I_bVII_IV_I: 'progression-18', bVI_bVII_I: 'progression-13',
  V_iv_I: 'progression-17', I_III_IV_iv: 'progression-10',
  i_bVII_bVI_V: 'progression-09', i_bVII_bVI_bVII: 'progression-11',
} as const

/** A catalog progression's name by its numerals ("ii-V-I"), for the home screen's statistics. */
export function progressionName(id: string): string {
  const entry = Object.entries(P).find(([, catalogId]) => catalogId === id)
  return entry ? entry[0].replaceAll('_', '-') : id
}
