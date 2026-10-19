export function passwordChecks(value) {
  return [typeof value==='string' && value.length>=8 && value.length<=200, /[0-9]/.test(value), /[a-z]/.test(value), /[A-Z]/.test(value)];
}
export function validPassword(value) {
  return typeof value==='string' && passwordChecks(value).every(Boolean);
}
