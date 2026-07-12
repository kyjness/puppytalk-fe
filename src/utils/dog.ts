export function calculateDogAge(birthDate: string | Date | null | undefined): string {
  if (birthDate == null) return '';
  const date =
    typeof birthDate === 'string' ? new Date(birthDate.trim() + 'T00:00:00') : birthDate;
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const months =
    (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth());
  if (months < 0) return '';
  if (months < 12) return `${months}개월`;
  const years = Math.floor(months / 12);
  return `${years}살`;
}

export function formatDogGenderLabel(gender: string | null | undefined): string {
  if (gender === 'male') return '♂️';
  if (gender === 'female') return '♀️';
  return gender ? String(gender) : '';
}
