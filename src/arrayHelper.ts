/**
 * Determines if the given string array loosely includes the given value.
 *
 * This is used as Array.includes() uses strict equality, and the strings
 * provided by {Address} are not always the same.
 *
 * This also ensures that when comparison is performed, both strings
 * are lowercase.
 *
 * @param array the array to iterate over
 * @param value the value to check against
 * @returns
 */
export function arrayIncludesLoose(array: string[], value: string): boolean {
  for (let i = 0; i < array.length; i++) {
    if (array[i].toLowerCase() == value.toLowerCase()) return true;
  }

  return false;
}

export function stringArrayToMap(array: string[]): Map<string, string> {
  const newMap = new Map<string, string>();
  for (let i = 0; i < array.length; i++) {
    newMap.set(array[i], array[i]);
  }

  return newMap;
}
