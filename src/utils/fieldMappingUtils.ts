export const findByDescription = (obj: any, description: string): any => {
  for (const key in obj) {
    if (obj[key] instanceof Object) {
      const result = findByDescription(obj[key], description);
      if (result) {
        return result;
      }
    } else if (key === 'description' && obj[key] === description) {
      return obj;
    }
  }
  return null;
};
