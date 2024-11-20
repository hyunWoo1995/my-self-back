const isAfterDate = (a, b) => {
  const dateA = new Date(a);
  const dateB = new Date(b);

  return dateA.getTime() > dateB.getTime();
};

module.exports = { isAfterDate };
