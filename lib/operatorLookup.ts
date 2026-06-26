/**
 * Best-effort operator/country lookup for the ~50 most commonly observed
 * satellites and satellite families. Falls back to "Unknown" for anything
 * not in this table, per the SatelliteInfoCard spec.
 */
const OPERATOR_LOOKUP: Array<{ pattern: RegExp; operator: string }> = [
  { pattern: /^ISS/i, operator: 'NASA / Roscosmos / ESA / JAXA / CSA' },
  { pattern: /^ZARYA/i, operator: 'NASA / Roscosmos / ESA / JAXA / CSA' },
  { pattern: /^CSS|TIANHE|TIANGONG/i, operator: 'CMSA (China)' },
  { pattern: /^HST|HUBBLE/i, operator: 'NASA / ESA' },
  { pattern: /^STARLINK/i, operator: 'SpaceX (USA)' },
  { pattern: /^ONEWEB/i, operator: 'OneWeb (UK)' },
  { pattern: /^IRIDIUM/i, operator: 'Iridium Communications (USA)' },
  { pattern: /^GLOBALSTAR/i, operator: 'Globalstar (USA)' },
  { pattern: /^NOAA/i, operator: 'NOAA (USA)' },
  { pattern: /^GOES/i, operator: 'NOAA (USA)' },
  { pattern: /^METEOR/i, operator: 'Roscosmos (Russia)' },
  { pattern: /^COSMOS/i, operator: 'Roscosmos (Russia)' },
  { pattern: /^SENTINEL/i, operator: 'ESA / Copernicus (EU)' },
  { pattern: /^TERRA|AQUA|LANDSAT/i, operator: 'NASA / USGS (USA)' },
  { pattern: /^GPS|NAVSTAR/i, operator: 'US Space Force' },
  { pattern: /^GALILEO/i, operator: 'European GNSS Agency (EU)' },
  { pattern: /^GLONASS/i, operator: 'Roscosmos (Russia)' },
  { pattern: /^BEIDOU/i, operator: 'CNSA (China)' },
  { pattern: /^NAVIC|IRNSS/i, operator: 'ISRO (India)' },
  { pattern: /^CARTOSAT|RESOURCESAT|RISAT|OCEANSAT/i, operator: 'ISRO (India)' },
  { pattern: /^INSAT|GSAT/i, operator: 'ISRO (India)' },
  { pattern: /^INTELSAT/i, operator: 'Intelsat (Luxembourg)' },
  { pattern: /^SES-?\d/i, operator: 'SES S.A. (Luxembourg)' },
  { pattern: /^EUTELSAT/i, operator: 'Eutelsat (France)' },
  { pattern: /^DIRECTV|DISH/i, operator: 'DirecTV / DISH (USA)' },
  { pattern: /^TIANZHOU|SHENZHOU/i, operator: 'CMSA (China)' },
  { pattern: /^PROGRESS|SOYUZ/i, operator: 'Roscosmos (Russia)' },
  { pattern: /^CYGNUS/i, operator: 'Northrop Grumman (USA)' },
  { pattern: /^DRAGON|CREW DRAGON|CARGO DRAGON/i, operator: 'SpaceX (USA)' },
  { pattern: /^TIANLIAN/i, operator: 'CMSA (China)' },
  { pattern: /^YAOGAN/i, operator: 'CASC (China)' },
  { pattern: /^HIMAWARI/i, operator: 'JMA (Japan)' },
  { pattern: /^QZS/i, operator: 'JAXA (Japan)' },
  { pattern: /^ALOS/i, operator: 'JAXA (Japan)' },
  { pattern: /^METOP/i, operator: 'EUMETSAT (EU)' },
  { pattern: /^SPOT/i, operator: 'CNES (France)' },
  { pattern: /^PLEIADES/i, operator: 'CNES / Airbus (France)' },
  { pattern: /^RADARSAT/i, operator: 'Canadian Space Agency' },
  { pattern: /^AMAZONAS|HISPASAT/i, operator: 'Hispasat (Spain)' },
  { pattern: /^TELSTAR/i, operator: 'Telesat (Canada)' },
  { pattern: /^ANIK/i, operator: 'Telesat (Canada)' },
  { pattern: /^ECHOSTAR/i, operator: 'EchoStar (USA)' },
  { pattern: /^ORBCOMM/i, operator: 'ORBCOMM (USA)' },
  { pattern: /^PLANET|DOVE|SKYSAT/i, operator: 'Planet Labs (USA)' },
  { pattern: /^SPACEBEE|LEMUR/i, operator: 'Spire Global (USA)' },
  { pattern: /^AEOLUS/i, operator: 'ESA' },
  { pattern: /^SWARM/i, operator: 'ESA' },
  { pattern: /^JASON/i, operator: 'NASA / CNES / EUMETSAT / NOAA' },
  { pattern: /^CHANDRAYAAN/i, operator: 'ISRO (India)' },
  { pattern: /^ADITYA/i, operator: 'ISRO (India)' },
];

export function lookupOperator(name: string): string {
  for (const entry of OPERATOR_LOOKUP) {
    if (entry.pattern.test(name)) return entry.operator;
  }
  return 'Unknown';
}
