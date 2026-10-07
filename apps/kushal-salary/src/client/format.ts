const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const inr = (v: number) => '₹' + v.toLocaleString('en-IN')
/** ₹96k below a lakh, ₹1.61L from a lakh up. */
export const k = (v: number) => (Math.abs(v) >= 100000 ? '₹' + (v / 100000).toFixed(2) + 'L' : '₹' + Math.round(v / 1000) + 'k')
/** Monthly amount as a yearly figure in lakhs: 125000 -> ₹15.0L. */
export const lakhYear = (monthly: number) => '₹' + ((monthly * 12) / 100000).toFixed(1) + 'L'
export const monLabel = (ym: string) => MON[Number(ym.slice(5, 7)) - 1] + ' ' + ym.slice(0, 4)
export const dayLabel = (d: string) => `${Number(d.slice(8, 10))} ${MON[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`
export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
