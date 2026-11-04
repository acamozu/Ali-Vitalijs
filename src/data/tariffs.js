// Mock data only: the tariff is not sent to SAP, the verification does not depend on it.
export const tariffs = [
  { id: 'eco24-a', name: 'ÖkoStrom24', term: 24, usagePrice: 33.8, basePrice: 18.9, bonus: 95, yearly: 824, popular: true },
  { id: 'eco24-b', name: 'ÖkoStrom24', term: 24, usagePrice: 33.8, basePrice: 18.9, bonus: 200, yearly: 872, popular: true },
  { id: 'eco12-a', name: 'ÖkoStrom12', term: 12, usagePrice: 34.2, basePrice: 18.9, bonus: 70, yearly: 854 },
  { id: 'eco12-b', name: 'ÖkoStrom12', term: 12, usagePrice: 34.2, basePrice: 18.9, bonus: 200, yearly: 882 },
];

export const usageOptions = [
  { kwh: 1500, persons: 1 },
  { kwh: 2500, persons: 2 },
  { kwh: 3500, persons: 3 },
  { kwh: 4000, persons: 4 },
  { kwh: 4500, persons: 5 },
];
