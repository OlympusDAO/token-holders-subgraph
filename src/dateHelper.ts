export const getISO8601StringFromTimestamp = (timestamp: i64): string => {
  const date = new Date(timestamp);
  return date.toISOString();
};

export const getISO8601DateStringFromTimestamp = (timestamp: i64): string => {
  return getISO8601StringFromTimestamp(timestamp).split("T")[0];
};

export const getISO8601DateString = (date: Date): string => {
  return date.toISOString().split("T")[0];
};

export const getDaysBetween = (one: Date, two: Date): i64 => {
  const timeDiff = two.getTime() - one.getTime();

  return timeDiff / (1000 * 60 * 60 * 24);
};
