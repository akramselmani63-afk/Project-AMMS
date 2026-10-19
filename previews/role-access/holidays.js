export const holidayDay=()=>new Date().toLocaleDateString('sv-SE',{timeZone:'Africa/Algiers'});
export function validHoliday(value) {
  const date=s=>typeof s==='string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0,10)===s;
  return value===null || value && date(value.departure) && date(value.returnDate) && value.departure<value.returnDate;
}
export function unavailableApprovers(users,day=holidayDay()) {
  const result={};
  for(const role of ['Maintenance Responsible','Production Responsible','HSE']) {
    const accounts=Object.values(users).filter(u=>u.hash && u.role===role);
    if(accounts.length && accounts.every(u=>validHoliday(u.holiday) && u.holiday && u.holiday.departure<=day && day<u.holiday.returnDate))
      result[role]=accounts.map(u=>[u.name,u.surname].filter(Boolean).join(' ')+' ('+u.holiday.departure+' → '+u.holiday.returnDate+')').join('; ');
  }
  return result;
}
