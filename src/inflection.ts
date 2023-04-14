export const snakeToCamel = str =>
  str.toLowerCase().replace(/([-_][a-z])/g, group =>
    group
      .toUpperCase()
      .replace('-', '')
      .replace('_', '')
  );

export const camelToSnake = str => str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
