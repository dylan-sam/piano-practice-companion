// Chord symbols inside plain text (lesson titles and texts, exercise names), written as a reader
// expects them rather than in the app's short notation: C^7 is Cmaj7, C-7 is C−7, Ch7 is Cø7,
// Co7 is C°7, b9 is ♭9, Bb is B♭, #11 is ♯11.

/** A text with its chord symbols and accidentals written for reading. */
export function prettyChordText(text: string): string {
  return text
    .replace(/Locrian #2/g, 'Locrian ♮2')
    .replace(/([A-G][b#]?)-\^7/g, '$1−maj7')
    .replace(/([A-G][b#]?)\^7/g, '$1maj7')
    .replace(/([A-G][b#]?)h7/g, '$1ø7')
    .replace(/([A-G][b#]?)-(\d)/g, '$1−$2')
    .replace(/([A-G][b#]?|[IV]+)o7/g, '$1°7')
    .replace(/([A-G])b(?![a-z])/g, '$1♭')
    .replace(/([A-G])#/g, '$1♯')
    .replace(/(\d|\b)b(?=1[13]|[35679]\b|[35679][^\d])/g, '$1♭')
    .replace(/\bb(?=[IV])/g, '♭')
    .replace(/#(?=[IV\d])/g, '♯')
}
