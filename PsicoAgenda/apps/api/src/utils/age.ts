/** Menor de edad: cumple 18 años en el futuro respecto a hoy. */
export function isPatientMinor(birthDate: Date | null): boolean {
  if (!birthDate) return false;
  const turnsEighteen = new Date(birthDate);
  turnsEighteen.setFullYear(turnsEighteen.getFullYear() + 18);
  return turnsEighteen > new Date();
}
