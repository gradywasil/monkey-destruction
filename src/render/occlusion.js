/**
 * True when two {x,y,w,h} boxes share any area.
 * @param {{x:number,y:number,w:number,h:number}} a
 * @param {{x:number,y:number,w:number,h:number}} b
 * @returns {boolean}
 */
export function boxOverlap(a, b) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/**
 * Indices after i whose box overlaps list[i]'s box; crew and carried-prop drawables never occlude.
 * @param {object[]} sortedList
 * @param {number} i
 * @param {(d:object)=>{x:number,y:number,w:number,h:number}|null} boxOf
 * @returns {number[]}
 */
export function occluders(sortedList, i, boxOf) {
  const out = [];
  const me = boxOf(sortedList[i]);
  if (!me) return out;
  for (let j = i + 1; j < sortedList.length; j++) {
    const d = sortedList[j];
    if (d.crew || d.prop) continue;
    const b = boxOf(d);
    if (b && boxOverlap(me, b)) out.push(j);
  }
  return out;
}
