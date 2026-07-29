export const SITE_URL = 'https://beyondrv.com.au';
export const ORGANIZATION_ID = `${SITE_URL}/#organization`;

export const SITE_IDENTITY = Object.freeze({
  name: 'Beyond RV',
  legalName: 'Passion Industries Pty Ltd',
  abn: '45 145 189 297',
  url: `${SITE_URL}/`,
  logo: `${SITE_URL}/images/site/admin-logo.png`,
  image: `${SITE_URL}/images/site/unimog-hero.jpg`,
  telephone: '+61430863819',
  email: 'beyondcaravans@gmail.com',
  address: Object.freeze({
    streetAddress: '77 Coleyville Rd',
    addressLocality: 'Mutdapilly',
    addressRegion: 'QLD',
    postalCode: '4307',
    addressCountry: 'AU',
  }),
  sameAs: Object.freeze([
    'https://www.youtube.com/@beyondrvcampers4129',
    'https://www.facebook.com/BeyondCaravans',
    'https://www.instagram.com/beyondrvaus/',
  ]),
});

export function buildOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': ['Organization', 'LocalBusiness', 'AutomotiveBusiness'],
    '@id': ORGANIZATION_ID,
    name: SITE_IDENTITY.name,
    legalName: SITE_IDENTITY.legalName,
    taxID: `ABN ${SITE_IDENTITY.abn}`,
    url: SITE_IDENTITY.url,
    logo: SITE_IDENTITY.logo,
    image: SITE_IDENTITY.image,
    telephone: SITE_IDENTITY.telephone,
    email: SITE_IDENTITY.email,
    priceRange: '$$',
    sameAs: [...SITE_IDENTITY.sameAs],
    address: {
      '@type': 'PostalAddress',
      ...SITE_IDENTITY.address,
    },
    areaServed: [
      { '@type': 'Country', name: 'Australia' },
      { '@type': 'State', name: 'Queensland' },
    ],
    openingHoursSpecification: [{
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      opens: '09:00',
      closes: '17:00',
      description: 'Workshop viewings by appointment.',
    }],
  };
}
